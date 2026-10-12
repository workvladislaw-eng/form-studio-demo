import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Euler,Quaternion,Color} from 'three';
import {Viewer} from '../../../packages/renderer-web/viewer';
import {trackStudioLights} from '../../../packages/scene-core/studio-lighting';
import {makeScene,srgb} from '../../../packages/scene-core/scene';
import {applyMaterialStyle,BLUE_CHROME_BASE,BLUE_CHROME_GRADIENT,type MaterialStyle} from '../../../packages/scene-core/material-styles';
import {dimensions,type Scene,type GeometryParams,type GeometryResult} from '../../../packages/contracts/schema';
import './style.css';
import './layout-overrides.css';
import './minimal-ui.css';
import './bloom.css';

const DEMO='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill-rule="evenodd" d="M 30 4 L 70 4 Q 96 4 96 30 L 96 70 Q 96 96 70 96 L 30 96 Q 4 96 4 70 L 4 30 Q 4 4 30 4 Z M 50 29 A 21 21 0 1 0 50 71 A 21 21 0 1 0 50 29 Z"/></svg>';
const RING='<svg xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M 50 0 A 50 50 0 1 1 50 100 A 50 50 0 1 1 50 0 Z M 50 26 A 24 24 0 1 0 50 74 A 24 24 0 1 0 50 26 Z"/></svg>';
async function api(url:string,body?:unknown){const r=await fetch('/api/prototype/'+url,body?{method:'POST',headers:{'Content-Type':'application/json','X-Form-Prototype':'1'},body:JSON.stringify(body)}:undefined);const j=await r.json();if(!r.ok)throw Object.assign(new Error(j.error?.message??'Помилка запиту'),{status:r.status});return j.data;}
type Job={id:string;status:string;purpose:string;format:string;width:number;height:number;seconds?:number;device?:string;error?:string};
function App(){
 const [scene,setScene]=useState<Scene|null>(null),[geometry,setGeometry]=useState<GeometryResult|null>(null);
 const [svg,setSvg]=useState(DEMO),[name,setName]=useState('Form mark.svg');
 const [params,setParams]=useState<GeometryParams>({depth:.18,bevelRadius:.01,bevelSegments:8,curveTolerance:.0004});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[ready,setReady]=useState(false),[blender,setBlender]=useState(false),[job,setJob]=useState<Job|null>(null),[result,setResult]=useState<Job|null>(null),[exporting,setExporting]=useState(false);
 const [color,setColor]=useState('#525b6b'),[blueHue,setBlueHue]=useState(215),[format,setFormat]=useState('png'),[transparent,setTransparent]=useState(false);
 const canvas=useRef<HTMLCanvasElement>(null),viewer=useRef<Viewer|null>(null),input=useRef<HTMLInputElement>(null),latest=useRef(scene),request=useRef(0),drag=useRef<{x:number;y:number;q:Quaternion}|null>(null);
 latest.current=scene;
 const update=(fn:(s:Scene)=>void)=>setScene(old=>{if(!old)return old;const next=structuredClone(old);fn(next);adaptBlueChromeLook(next);trackStudioLights(next);return next;});
 useEffect(()=>{api('health').then(h=>setBlender(h.blender)).catch(e=>setError(e.message));
  try{viewer.current=new Viewer(canvas.current!);}catch{setError('WebGL недоступний. Увімкніть апаратне прискорення браузера.');}
  const observer=new ResizeObserver(()=>viewer.current?.draw());observer.observe(canvas.current!);return()=>{observer.disconnect();viewer.current?.dispose();};},[]);
 useEffect(()=>{let disposed=false;const seq=++request.current;setReady(false);const timer=setTimeout(async()=>{
  setBusy(true);setError('');
  try{let g:GeometryResult|undefined;for(let attempt=0;attempt<45&&!disposed;attempt++){try{g=await api('geometry',{svg,parameters:params});break;}catch(e){if((e as {status?:number}).status!==429||attempt===44)throw e;await new Promise(resolve=>setTimeout(resolve,500));}}if(!g||disposed||seq!==request.current)return;const result=g;setGeometry(result);viewer.current?.geometry(result);
   setScene(old=>{const s=old?structuredClone(old):makeScene(result.id,result.parts.map(p=>p.id));s.objects[0].geometryRevisionId=result.id;s.objects[0].partMaterialAssignments=Object.fromEntries(result.parts.map(p=>[p.id,'material_1']));if(!old)s.objects[0].transform.rotation=new Quaternion().setFromEuler(new Euler(.18,-.38,-.08)).toArray();adaptBlueChromeLook(s);trackStudioLights(s);return s;});setReady(true);
  }catch(e){if(!disposed)setError((e as Error).message);}finally{if(!disposed)setBusy(false);}
 },350);return()=>{disposed=true;clearTimeout(timer);};},[svg,params]);
 useEffect(()=>{if(scene)viewer.current?.update(scene);},[scene]);
 useEffect(()=>{if(!job||!['rendering','cancel_requested'].includes(job.status))return;const timer=setInterval(async()=>{try{const next=await api('renders/'+job.id);setJob(next);if(next.status==='completed')setResult(next);if(next.status==='failed')setError(next.error);}catch(e){setError((e as Error).message);}},1500);return()=>clearInterval(timer);},[job?.id,job?.status]);
 function setBlueChromeHue(hue:number){const base=new Color(BLUE_CHROME_BASE),hsl={h:0,s:0,l:0};base.getHSL(hsl);const c=new Color().setHSL(hue/360,hsl.s,hsl.l);const rgb=c.getRGB(new Color(),'srgb');setBlueHue(hue);setColor('#'+c.getHexString());update(s=>{if(s.materials[0].preset==='blue-chrome')s.materials[0].baseColor=srgb([rgb.r,rgb.g,rgb.b]);});}
 function chooseStyle(style:MaterialStyle){setBlueHue(215);setColor(style==='blue-chrome'?BLUE_CHROME_BASE:style==='amber'?'#685741':'#525b6b');if(style==='amber'&&scene?.materials[0].preset!=='amber-glass')setParams(p=>({...p,depth:Math.max(p.depth,.32)}));update(s=>applyMaterialStyle(s,style));}
 async function upload(file?:File){if(!file)return;if(file.size>5242880){setError('Максимальний розмір — 5 MiB');return;}setName(file.name);setSvg(await file.text());}
 async function exportLive(mode:'frame'|'4k'){if(!scene||!ready||!viewer.current||exporting)return;setError('');setExporting(true);try{const [width,height]=mode==='frame'?[viewer.current.canvas.width,viewer.current.canvas.height]:dimensions[scene.composition.aspect];const blob=await viewer.current.exportImage(width,height,format as 'png'|'jpg',transparent,mode);const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`form-${width}x${height}.${format}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){setError((e as Error).message);}finally{setExporting(false);}}
 const active=job&&['rendering','cancel_requested'].includes(job.status),material=scene?.materials[0].preset??'glass';
 return <div className="app">
  <header><a className="brand" href="/">f<span>o</span>rm<span className="brand-dot">®</span></a><div className="header-title">Вектор. Об’єм. Характер.</div><div className="local"><i/> Локальна студія <span>PROTOTYPE 01</span></div></header>
  <div className="minimal-actions" aria-label="Основні дії">
   <button className="minimal-action" onClick={()=>input.current?.click()}><svg className="minimal-action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V14"/></svg><span>Завантажити SVG</span></button>
   <button className="minimal-action" disabled={!ready||exporting||!!active} onClick={()=>void exportLive('4k')}><svg className="minimal-action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v12m0 0-4.5-4.5M12 16l4.5-4.5M5 19.5h14"/></svg><span>{exporting?'Експорт…':'Експорт'}</span></button>
  </div>
  <div className="minimal-controls" aria-label="Швидкі налаштування">
   <Control label="Потужність світла" value={scene?.lights[0].powerWatts??14} min={0} max={50} step={.5} onChange={v=>update(s=>{s.lights[0].powerWatts=v;})}/>
   <Control label="Глибина 3D" value={params.depth} min={.05} max={.5} step={.005} onChange={v=>setParams(p=>({...p,depth:v}))}/>
   <Control label="Кут освітлення" value={(scene?.lighting?.keyAngleRad??0)*180/Math.PI} min={-180} max={180} step={1} onChange={v=>update(s=>{s.lighting={keyAngleRad:v*Math.PI/180};})}/>
   <div className="minimal-material"><span>Матеріал</span><strong>{material==='blue-chrome'?'Синій хром':material==='amber-glass'?'Бурштиновий кришталь':'Графітове скло'}</strong></div>
   <div className="minimal-materials" aria-label="Вибір матеріалу">
    {([['graphite','Графіт'],['amber','Кришталь'],['blue-chrome','Хром']] as const).map(([style,label])=><button key={style} className={material===(style==='graphite'?'glass':style==='amber'?'amber-glass':'blue-chrome')?'selected':''} onClick={()=>chooseStyle(style)}>{label}</button>)}
   </div>
   {material==='blue-chrome'&&<label className="minimal-hue"><span>Відтінок <output>{blueHue}°</output></span><input className="hue-slider" aria-label="Відтінок синього хрому" type="range" min={0} max={360} step={1} value={blueHue} onChange={e=>setBlueChromeHue(Number(e.target.value))}/></label>}
  </div>
  <main>
   <aside className="left"><div className="section-heading"><span>01 / ДЖЕРЕЛО</span><span>SVG</span></div>
    <button className="upload" onClick={()=>input.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();void upload(e.dataTransfer.files[0]);}}><span className="upload-icon">↥</span><strong>Додайте свою форму</strong><small>Перетягніть SVG або виберіть файл</small><span className="file-name">{name}</span></button>
    <input ref={input} type="file" accept=".svg,image/svg+xml" hidden onChange={e=>void upload(e.target.files?.[0])}/>
    <div className="examples"><button onClick={()=>{setSvg(DEMO);setName('Form mark.svg');}}>▣ Знак</button><button onClick={()=>{setSvg(RING);setName('Ring.svg');}}>◯ Кільце</button></div>
    <div className="section-heading"><span>02 / МАТЕРІАЛ</span></div>
    <div className="materials">{([['graphite','glass','Графітове скло'],['amber','amber-glass','Бурштиновий кришталь'],['blue-chrome','blue-chrome','Синій хром']] as const).map(([style,preset,label])=><button key={style} disabled={!scene} aria-pressed={material===preset} className={material===preset?'selected':''} onClick={()=>chooseStyle(style)}><span className={'sphere '+preset}/>{label}</button>)}</div>
    <p className="hint">{material==='blue-chrome'?'Полірований дзеркальний хром: срібляста база, білі студійні відблиски, сині та фіолетові неонові рефлекси.':material==='amber-glass'?'Товстий прозорий кришталь, димчастий бурштин і м’які студійні відбиття.':'Графітове скло з нижньою світловою смугою та блакитним засвітом.'}</p>
    {material==='blue-chrome'&&<label className="control"><span>Смуга відтінку<output>{blueHue}°</output></span><input className="hue-slider" aria-label="Смуга відтінку" type="range" min={0} max={360} step={1} value={blueHue} onChange={e=>setBlueChromeHue(Number(e.target.value))}/><small className="hint">Базовий тон {BLUE_CHROME_BASE.toUpperCase()}; змінюється лише відтінок, без довільного вибору кольору.</small></label>}
    <div className="section-heading"><span>03 / ОБ’ЄМ</span></div>
    <Control label="Глибина" value={params.depth} min={.05} max={.5} step={.005} onChange={v=>setParams(p=>({...p,depth:v}))}/>
    <div className="fixed-setting"><span>Фаска</span><strong>0.010</strong><small>Фіксована для всіх елементів; якщо контур не підтримує фаску, вона вимикається лише для нього.</small></div>
    <div className="section-heading"><span>04 / СЦЕНА</span></div>
    <div className="derived-background"><span>Фон</span><strong>{material==='amber-glass'?'Синьо-бірюзовий градієнт':scene?.background.algorithmVersion===BLUE_CHROME_GRADIENT?'Темна синьо-чорна студія':'Чорний · #000000'}</strong><small>{material==='amber-glass'?'Світлий верхній лівий кут → темний нижній правий.':material==='blue-chrome'?'М’який блакитний перелив знизу та темний центр.':'Засвіт навколо яскравих відбиттів.'}</small><i style={{background:material==='amber-glass'?'linear-gradient(135deg,#a6d4d9,#06262f)':material==='blue-chrome'?'linear-gradient(145deg,#052557,#020812 52%,#087dbb)':'#000'}}/></div>
    <Control label="Основне світло" value={scene?.lights[0].powerWatts??14} min={0} max={50} step={.5} onChange={v=>update(s=>{s.lights[0].powerWatts=v;})}/>
    <Control label="Кут освітлення" value={(scene?.lighting?.keyAngleRad??0)*180/Math.PI} min={-180} max={180} step={1} onChange={v=>update(s=>{s.lighting={keyAngleRad:v*Math.PI/180};})}/>
    <p className="hint">Посилений засвіт активний постійно: м’який ореол навколо яскравих відбиттів також потрапляє у 4K-файл.</p>
   </aside>
    <section className={'workspace workspace-'+material}><div className="workspace-top"><div><span className="eyebrow">ВАША ФОРМА У НОВОМУ ВИМІРІ</span><h1>Дайте формі <em>глибину.</em></h1></div><span className="view-badge">● Живий перегляд</span></div>
    <div className="stage-wrap"><div className="stage" style={{aspectRatio:scene?.composition.aspect.replace(':',' / ')??'16 / 9'}}>
     <canvas ref={canvas} aria-label="3D перегляд об’єкта" onPointerDown={e=>{if(!scene)return;e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,y:e.clientY,q:new Quaternion().fromArray(scene.objects[0].transform.rotation)};}} onPointerMove={e=>{const d=drag.current;if(!d)return;const q=new Quaternion().setFromEuler(new Euler((e.clientY-d.y)*.008,(e.clientX-d.x)*.008,0)).multiply(d.q).normalize();update(s=>{s.objects[0].transform.rotation=q.toArray();});}} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onWheel={e=>update(s=>{s.camera.position[2]=Math.max(1,Math.min(6,s.camera.position[2]+e.deltaY*.002));})}/>
     <span className="stage-label">FORM / {material.toUpperCase()}</span><span className="stage-corner">{scene?.composition.aspect??'16:9'}</span>
     {busy&&<div className="working">Побудова геометрії…</div>}
    </div></div>
    <div className="viewer-toolbar"><span>↔ Потягніть для обертання <b>·</b> Прокрутіть для масштабу</span><button onClick={()=>update(s=>{s.objects[0].transform.rotation=[0,0,0,1];s.camera.position=[0,0,2.5];})}>↺ Скинути ракурс</button></div>
    {error&&<div className="error" role="alert">{error}</div>}
    <div className="bottom-note"><span><i className={ready?'ok':'pending'}/>{ready?'Геометрія перевірена':geometry?'Показано попередню геометрію':'Підготовка сцени'}{geometry&&<small> · {geometry.triangleCount.toLocaleString()} трикутників</small>}</span><span>Справжня геометрія. Ваш силует.</span></div>
   </section>
   <aside className="right"><div className="section-heading"><span>05 / ЕКСПОРТ</span><span>4K</span></div><h2>Фінальний кадр</h2><p className="hint">Той самий матеріал, фон і світло, що в робочому кадрі.</p>
    <label className="field-title">Пропорції кадру</label><div className="aspects">{Object.keys(dimensions).map(a=><button key={a} className={scene?.composition.aspect===a?'selected':''} onClick={()=>update(s=>{s.composition.aspect=a as Scene['composition']['aspect'];})}><span className="ratio-icon" style={{aspectRatio:a.replace(':',' / ')}}/>{a}</button>)}</div>
    <div className="resolution"><span>Роздільність</span><strong>{scene?dimensions[scene.composition.aspect].join(' × '):'3840 × 2160'} <small>px</small></strong></div>
    <label className="field-title">Формат файлу</label><div className="segmented"><button className={format==='png'?'selected':''} onClick={()=>setFormat('png')}>PNG</button><button className={format==='jpg'?'selected':''} onClick={()=>{setFormat('jpg');setTransparent(false);}}>JPG</button></div>
    <div className="render-card"><span className="eyebrow">LIVE WEBGL EXPORT</span><strong>Експорт поточного кадру</strong><p>Кадр завантажується миттєво. 4K‑експорт рендерить ту саму WebGL‑сцену у 3840×2160 без запуску Cycles.</p></div>
    <button className="button secondary" disabled={!ready||exporting||!!active} onClick={()=>void exportLive('frame')}>{exporting?'Кодування…':'Скачати кадр'} <span>↓</span></button>
    <button className="button primary" disabled={!ready||exporting||!!active} onClick={()=>void exportLive('4k')}>{exporting?'Кодування…':'Скачати 4К'} <span>↓</span></button>
    {active&&<div className="job-state"><span className="spinner"/> {job?.status==='cancel_requested'?'Скасування…':'Обчислення світла…'}<button onClick={async()=>{try{setJob(await api('renders/'+job!.id+'/cancel',{}));}catch(e){setError((e as Error).message);}}}>Скасувати</button></div>}
    {job?.status==='canceled'&&<p className="hint">Рендер скасовано.</p>}
    {result&&<div className="result"><a href={'/api/prototype/renders/'+result.id+'/file'} target="_blank"><img alt="Готовий Cycles рендер" src={'/api/prototype/renders/'+result.id+'/file'}/></a><strong>{result.width} × {result.height} · {result.seconds} с</strong><span>Знімок сцени на момент запуску</span><a className="download" href={'/api/prototype/renders/'+result.id+'/file?download=1'}>Завантажити {result.format.toUpperCase()} ↓</a></div>}
    <p className="local-note">Файли обробляються на цьому комп’ютері. Прототип без хмарних завантажень.</p>
   </aside>
  </main><footer><span>FORM LAB / 001</span><span>SVG → 3D</span><span>Експериментуйте з формою.</span></footer>
 </div>;
}
function adaptBlueChromeLook(scene:Scene){
 if(scene.materials[0].preset!=='blue-chrome')return;
 const base=new Color().setRGB(scene.materials[0].baseColor.value[0],scene.materials[0].baseColor.value[1],scene.materials[0].baseColor.value[2],'srgb');
 const hsl={h:0,s:0,l:0};base.getHSL(hsl);
 const color=(h:number,s:number,l:number)=>{const c=new Color().setHSL((h+1)%1,s,l);const rgb=c.getRGB(new Color(),'srgb');return [rgb.r,rgb.g,rgb.b] as [number,number,number];};
 const key=scene.lights.find(l=>l.id==='key'),fill=scene.lights.find(l=>l.id==='fill'),rim=scene.lights.find(l=>l.id==='rim');
 if(key)key.color=srgb(color(hsl.h,.16,.94));
 if(fill)fill.color=srgb(color(hsl.h,.82,.62));
 if(rim)rim.color=srgb(color(hsl.h+.08,.62,.68));
 scene.background.color=srgb(color(hsl.h,.72,.018));
}
function Control({label,value,min,max,step,onChange}:{label:string;value:number;min:number;max:number;step:number;onChange:(n:number)=>void}){return <label className="control"><span>{label}<output>{step>=1?Math.round(value):value.toFixed(3)}</output></span><input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))}/></label>;}
createRoot(document.getElementById('root')!).render(<App/>);


