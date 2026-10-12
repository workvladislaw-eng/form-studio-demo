import express from 'express';
import { createServer as createViteServer } from 'vite';
import { Worker } from 'node:worker_threads';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, writeFile, readFile, access, readdir } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWriteStream } from 'node:fs';
import { dimensions, sceneSchema, validateGeometry, validateScene, type Scene, type GeometryResult } from '../../packages/contracts/schema';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const production=process.env.NODE_ENV==='production';
const host=process.env.HOST??(production?'0.0.0.0':'127.0.0.1');
const port=Number(process.env.PORT??4173);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT має бути цілим числом від 1 до 65535');
const configuredOrigins=(process.env.ALLOWED_ORIGINS??'').split(',').map(value=>value.trim()).filter(Boolean);
const storage=path.join(root,'.local','jobs');await mkdir(storage,{recursive:true});
await writeFile(path.join(root,'packages/contracts/scene.schema.json'),JSON.stringify(sceneSchema,null,2));
const blender=process.env.BLENDER_PATH??path.join(root,'.local/tools/blender-4.3.2-windows-x64/blender.exe');
const available=await access(blender).then(()=>true,()=>false);
const geometries=new Map<string,GeometryResult>();
type Job={id:string;status:string;purpose:string;format:string;width:number;height:number;sceneHash:string;createdAt:string;seconds?:number;device?:string;error?:string;process?:ChildProcess;cancel?:boolean};
const jobs=new Map<string,Job>();let geometryBusy=false;let renderStarting=false;
for(const id of await readdir(storage)){
 if(!/^[0-9a-f-]{36}$/.test(id))continue;
 try{const input=JSON.parse(await readFile(path.join(storage,id,'input.json'),'utf8'));const metrics=JSON.parse(await readFile(path.join(storage,id,'metrics.json'),'utf8'));await access(path.join(storage,id,'result.'+input.format));
  jobs.set(id,{id,status:'completed',purpose:input.purpose,format:input.format,width:input.width,height:input.height,sceneHash:createHash('sha256').update(JSON.stringify(input.scene)).digest('hex'),createdAt:new Date(0).toISOString(),...metrics});
 }catch{/* Incomplete jobs are never resumed or published automatically. */}
}
let geometryWorker:Worker|undefined;
function getGeometryWorker(){if(!geometryWorker){geometryWorker=new Worker(path.join(root,'workers/geometry/worker.mjs'),{resourceLimits:{maxOldGenerationSizeMb:256}});geometryWorker.once('exit',()=>{geometryWorker=undefined;});}return geometryWorker;}
const app=express();app.disable('x-powered-by');
app.use((req,res,next)=>{
 const requestHost=req.headers.host;
 const localOrigins=[`http://127.0.0.1:${port}`,`http://localhost:${port}`];
 if(!production&&(!requestHost||!localOrigins.some(origin=>new URL(origin).host===requestHost)))return res.status(403).json({error:{message:'Local access only'}});
 if(req.headers.origin){
  const sameOrigin=requestHost&&new URL(req.headers.origin).host===requestHost;
  const allowedOrigins=production?configuredOrigins:localOrigins;
  if(!sameOrigin&&!allowedOrigins.includes(req.headers.origin))return res.status(403).json({error:{message:'Origin rejected'}});
 }
 if(req.method==='POST' && req.headers['x-form-prototype']!=='1')return res.status(403).json({error:{message:'Missing local request header'}});
 next();
});
app.use(express.json({limit:'6mb'}));
app.get('/api/prototype/health',(_req,res)=>res.json({data:{blender:available,profile:'cycles-4.3.2-local-v1',localOnly:!production}}));
app.post('/api/prototype/geometry',async(req,res)=>{
 let ownsLock=false;
 try {
  if(geometryBusy)return res.status(429).json({error:{message:'Геометрія вже обчислюється'}});
  if(typeof req.body.svg!=='string')throw new Error('invalid_svg: Потрібен текст SVG');validateGeometry(req.body.parameters);
  geometryBusy=true;ownsLock=true;
  const result=await new Promise<GeometryResult>((resolve,reject)=>{
   const w=getGeometryWorker();
   const cleanup=()=>{clearTimeout(timer);w.off('message',onMessage);w.off('error',onError);w.off('exit',onExit);};
   const onMessage=(m:{error?:string;data:GeometryResult})=>{cleanup();m.error?reject(new Error(m.error)):resolve(m.data);};
   const onError=(e:Error)=>{cleanup();reject(e);};
   const onExit=()=>{cleanup();reject(new Error('resource_limit: Геометричний worker зупинився'));};
   const timer=setTimeout(()=>{cleanup();void w.terminate();geometryWorker=undefined;reject(new Error('resource_limit: Підготовка перевищила 60 секунд'));},60000);
   w.once('message',onMessage);w.once('error',onError);w.once('exit',onExit);w.postMessage(req.body);
  });
  if(geometries.size>=20)geometries.delete(geometries.keys().next().value!);
  geometries.set(result.id,result);res.json({data:result});
 }catch(e){res.status(422).json({error:{message:(e as Error).message}});}finally{if(ownsLock)geometryBusy=false;}
});
const publicJob=(job:Job)=>{const {process:_,cancel:__,...rest}=job;return rest;};
app.post('/api/prototype/renders',async(req,res)=>{
 let ownsLock=false;
 try {
  if(!available)return res.status(503).json({error:{message:'Blender не знайдено. Вкажіть BLENDER_PATH.'}});
  if(renderStarting||[...jobs.values()].some(j=>['rendering','cancel_requested'].includes(j.status)))return res.status(429).json({error:{message:'Дочекайтесь поточного рендера або скасуйте його'}});
  renderStarting=true;ownsLock=true;
  validateScene(req.body.scene);const scene=req.body.scene as Scene;
  const geometry=geometries.get(scene.objects[0].geometryRevisionId);if(!geometry)throw new Error('geometry_not_ready: Підготуйте геометрію повторно');
  const assigned=Object.keys(scene.objects[0].partMaterialAssignments);
  if(assigned.length!==geometry.parts.length||geometry.parts.some(p=>!assigned.includes(p.id)))throw new Error('validation_error: Невідомі частини');
  const {purpose,format,transparent}=req.body;
  if(!['preview','final'].includes(purpose)||!['png','jpg'].includes(format)||typeof transparent!=='boolean'||(format==='jpg'&&transparent)||(purpose==='preview'&&format!=='png'))throw new Error('validation_error: Некоректний формат експорту');
  const [w,h]=dimensions[scene.composition.aspect];const width=w/(purpose==='preview'?4:1),height=h/(purpose==='preview'?4:1);
  const id=randomUUID(),dir=path.join(storage,id);await mkdir(dir);
  const json=JSON.stringify(scene);const sceneHash=createHash('sha256').update(json).digest('hex');
  await writeFile(path.join(dir,'input.json'),JSON.stringify({scene,purpose,format,transparent,width,height}));
  await writeFile(path.join(dir,'mesh.json'),JSON.stringify(geometry));
  const job:Job={id,status:'rendering',purpose,format,width,height,sceneHash,createdAt:new Date().toISOString()};jobs.set(id,job);
  const child=spawn(blender,['--background','--factory-startup','--disable-autoexec','--python-exit-code','1','--python',path.join(root,'workers/render/render.py'),'--',dir],{windowsHide:true});job.process=child;
  const log=createWriteStream(path.join(dir,'render.log'));child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});
  const timer=setTimeout(()=>{job.error='Рендер перевищив 20 хвилин';child.kill();},1200000);
  child.once('error',e=>{clearTimeout(timer);job.status='failed';job.error=e.message;});
  child.once('close',async code=>{clearTimeout(timer);delete job.process;log.end();
   if(job.cancel){job.status='canceled';return;}
   if(code!==0){job.status='failed';job.error??='Cycles не завершив рендер. Діагностика: .local/jobs/'+id+'/render.log';return;}
   try{const metrics=JSON.parse(await readFile(path.join(dir,'metrics.json'),'utf8'));await access(path.join(dir,'result.'+format));Object.assign(job,metrics);job.status='completed';}catch{job.status='failed';job.error='Артефакт або метрики не записано';}
  });res.status(202).json({data:publicJob(job)});
 }catch(e){res.status(422).json({error:{message:(e as Error).message}});}finally{if(ownsLock)renderStarting=false;}
});
app.get('/api/prototype/renders/:id',(req,res)=>{const job=jobs.get(req.params.id);if(!job)return res.sendStatus(404);res.json({data:publicJob(job)});});
app.post('/api/prototype/renders/:id/cancel',(req,res)=>{const job=jobs.get(req.params.id);if(!job)return res.sendStatus(404);if(job.status!=='rendering')return res.status(409).json({error:{message:'Рендер уже завершився'}});job.cancel=true;job.status='cancel_requested';job.process?.kill();res.status(202).json({data:publicJob(job)});});
app.get('/api/prototype/renders/:id/file',(req,res)=>{const job=jobs.get(req.params.id);if(!job)return res.sendStatus(404);if(job.status!=='completed')return res.sendStatus(409);res.setHeader('Content-Disposition',`${req.query.download?'attachment':'inline'}; filename="form-${job.width}x${job.height}.${job.format}"`);res.sendFile(path.join(storage,job.id,'result.'+job.format),{dotfiles:'allow'});});
let closeWeb=async()=>{};
if(production){
 const dist=path.join(root,'dist');
 app.use(express.static(dist,{index:false}));
 app.use((req,res,next)=>req.method==='GET'&&!req.path.startsWith('/api/')?res.sendFile(path.join(dist,'index.html')):next());
}else{
 const vite=await createViteServer({configFile:path.join(root,'vite.config.ts'),server:{middlewareMode:true,hmr:false},appType:'spa'});
 app.use(vite.middlewares);closeWeb=()=>vite.close();
}
app.use((err:Error,_req:express.Request,res:express.Response,_next:express.NextFunction)=>res.status(400).json({error:{message:err.message}}));
const server=app.listen(port,host,()=>console.log(`FORM http://${host}:${port} · Cycles ${available?'available':'unavailable'}`));
const shutdown=()=>{for(const job of jobs.values())job.process?.kill();void geometryWorker?.terminate();server.close();void closeWeb();};process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
