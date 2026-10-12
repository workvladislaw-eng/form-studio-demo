import {makeScene} from '../packages/scene-core/scene';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:4173/api/prototype';
async function call(route:string,data?:unknown){const response=await fetch(base+route,data?{method:'POST',headers:{'Content-Type':'application/json','X-Form-Prototype':'1'},body:JSON.stringify(data)}:undefined);const result=await response.json();if(!response.ok)throw new Error(JSON.stringify(result));return result.data;}
const svg='<svg xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M0 0H100V100H0Z M30 30H70V70H30Z"/></svg>';
const geometry=await call('/geometry',{svg,parameters:{depth:.18,bevelRadius:.02,bevelSegments:5,curveTolerance:.0004}});
const scene=makeScene(geometry.id,geometry.parts.map((p:{id:string})=>p.id));
scene.materials[0].preset='metal';scene.materials[0].roughness=.28;
const job=await call('/renders',{scene,purpose:'final',format:'png',transparent:false});
assert.equal(job.width,3840);assert.equal(job.height,2160);
await mkdir('.local/verification',{recursive:true});await writeFile('.local/verification/final-job.json',JSON.stringify(job,null,2));
console.log('4K render started:',job.id);
// Negative HTTP checks do not wait for rendering.
const invalid=await fetch(base+'/geometry',{method:'POST',headers:{'Content-Type':'application/json','X-Form-Prototype':'1'},body:JSON.stringify({svg:'<svg><script/></svg>',parameters:geometry.parameters})});assert.equal(invalid.status,422);
const forbidden=await fetch(base+'/renders',{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://example.com'},body:'{}'});assert.equal(forbidden.status,403);
console.log('Invalid SVG and cross-origin request rejected.');
