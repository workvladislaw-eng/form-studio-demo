import { JSDOM } from 'jsdom';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { BufferGeometry, Float32BufferAttribute, ShapeUtils, Vector2, type Curve, type Shape, type Path } from 'three';
import { createHash } from 'node:crypto';
import { validateGeometry, type GeometryParams, type GeometryResult, type MeshPart } from '../contracts/schema';

const dom=new JSDOM('');
globalThis.DOMParser=dom.window.DOMParser as unknown as typeof DOMParser;
const fail=(s:string):never=>{throw new Error(s);};
const area=(p:Vector2[])=>ShapeUtils.area(p);
const cross=(a:Vector2,b:Vector2,c:Vector2)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const eps=1e-9;
function intersects(a:Vector2,b:Vector2,c:Vector2,d:Vector2) {
  if(Math.max(a.x,b.x)+eps<Math.min(c.x,d.x)||Math.max(c.x,d.x)+eps<Math.min(a.x,b.x)||Math.max(a.y,b.y)+eps<Math.min(c.y,d.y)||Math.max(c.y,d.y)+eps<Math.min(a.y,b.y)) return false;
  return cross(a,b,c)*cross(a,b,d)<=eps*eps && cross(c,d,a)*cross(c,d,b)<=eps*eps;
}
function inside(p:Vector2,ring:Vector2[]) {let yes=false; for(let i=0,j=ring.length-1;i<ring.length;j=i++) {const a=ring[i],b=ring[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x) yes=!yes;}return yes;}
function checkRing(r:Vector2[]) {
 if(r.length<3||Math.abs(area(r))<1e-10) fail('invalid_geometry: Контур не має площі');
 for(let i=0;i<r.length;i++)for(let j=i+1;j<r.length;j++) {
  if(j===i+1 || (i===0&&j===r.length-1))continue;
  if(intersects(r[i],r[(i+1)%r.length],r[j],r[(j+1)%r.length])) fail('invalid_geometry: Самоперетин контуру або завелика фаска');
 }
}
function crossRings(a:Vector2[],b:Vector2[]) {for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++) if(intersects(a[i],a[(i+1)%a.length],b[j],b[(j+1)%b.length])) return true;return false;}
function checkShape(rings:Vector2[][]) {
 rings.forEach(checkRing);
 for(let i=1;i<rings.length;i++) {
  if(!inside(rings[i][0],rings[0])||crossRings(rings[0],rings[i]))fail('invalid_geometry: Отвір виходить за контур');
  for(let j=1;j<i;j++)if(crossRings(rings[i],rings[j])||inside(rings[i][0],rings[j])||inside(rings[j][0],rings[i]))fail('invalid_geometry: Отвори перетинаються');
 }
}
function inset(r:Vector2[],distance:number) {
 return r.map((p,i)=>{
  const prev=r[(i+r.length-1)%r.length],next=r[(i+1)%r.length];
  const a=p.clone().sub(prev).normalize(),b=next.clone().sub(p).normalize();
  const n1=new Vector2(-a.y,a.x),n2=new Vector2(-b.y,b.x),bis=n1.clone().add(n2);
  const denom=bis.dot(n1); if(denom<1e-5)fail('invalid_geometry: Надто гострий кут для фаски');
  return p.clone().addScaledVector(bis,distance/denom);
 });
}
function clean(points:Vector2[]) {
 const r=points.filter((p,i)=>i===0||p.distanceToSquared(points[i-1])>1e-18);
 if(r.length>1&&r[0].distanceToSquared(r[r.length-1])<1e-18)r.pop();
 for(let i=r.length-1;i>=0&&r.length>3;i--)if(Math.abs(cross(r[(i+r.length-1)%r.length],r[i],r[(i+1)%r.length]))<1e-12)r.splice(i,1);
 return r;
}
function sample(path:Path,tolerance:number) {
 const points:Vector2[]=[];
 const walk=(c:Curve<Vector2>,a:number,b:number,level:number)=>{
  const p=c.getPoint(a),q=c.getPoint(b),v=q.clone().sub(p); let error=0;
  for(const t of [.25,.5,.75]) {const m=c.getPoint(a+(b-a)*t); const s=v.lengthSq()?Math.max(0,Math.min(1,m.clone().sub(p).dot(v)/v.lengthSq())):0;error=Math.max(error,m.distanceTo(p.clone().addScaledVector(v,s)));}
  if(error>tolerance) {if(level>18)fail('resource_limit: Надто складна крива');walk(c,a,(a+b)/2,level+1);walk(c,(a+b)/2,b,level+1);}else points.push(p);
  if(points.length>2000)fail('resource_limit: Прототип підтримує до 2000 сегментів');
 };
 for(const curve of path.curves)walk(curve,0,1,0);
 if(path.curves.length)points.push(path.curves.at(-1)!.getPoint(1));
 return clean(points);
}
function sanitize(svg:string) {
 if(Buffer.byteLength(svg)>5242880)fail('resource_limit: SVG перевищує 5 MiB');
 if(/<!DOCTYPE|<!ENTITY/i.test(svg))fail('unsupported_feature: DTD та entities заборонено');
 // Namespace declarations are editor metadata, not geometry. Remove prefixed
 // declarations before parsing so files from Illustrator/Figma/Inkscape do not
 // fail merely because they declare xlink, sodipodi or inkscape namespaces.
 // Prefixed resource attributes (for example xlink:href) are still checked
 // after parsing and remain unsupported unless explicitly mapped to geometry.
 const normalizedSvg=svg
  .replace(/\s+xmlns:[A-Za-z_][\w.-]*\s*=\s*(?:"[^"]*"|'[^']*')/gi,'')
  .replace(/\s+[A-Za-z_][\w.-]*:[A-Za-z_][\w.-]*\s*=\s*(?:"[^"]*"|'[^']*')/gi,'');
 const xml=new dom.window.DOMParser().parseFromString(normalizedSvg,'image/svg+xml');
 if(xml.querySelector('parsererror')||xml.documentElement.localName!=='svg')fail('invalid_svg: Некоректний SVG');
 const nodes=Array.from(xml.querySelectorAll('*'));
 if(nodes.length>10000)fail('resource_limit: Забагато XML-вузлів');
 const allowed=new Set(['svg','g','path','rect','circle','ellipse','polygon','title','desc','style']);
 // `xmlns:xlink` is a harmless namespace declaration emitted by Illustrator,
 // Figma and many SVG exporters. It does not add a drawable feature, so it is
 // accepted while xlink resource references remain unsupported below.
 const attrs=new Set(['xmlns','xmlns:xlink','id','class','version','viewBox','width','height','x','y','rx','ry','cx','cy','r','d','points','transform','fill','fill-rule','stroke','opacity','fill-opacity','display','visibility','style','enable-background']);
 for(const el of nodes) {
  if(!allowed.has(el.localName))fail('unsupported_feature: Елемент '+el.localName+' не підтримується. Перетворіть його на замкнуті контури.');
  if(el.localName==='style')continue;
  for(const a of Array.from(el.attributes)) {
   const namespaceDeclaration=/^xmlns(?::[A-Za-z_][\w.-]*)?$/i.test(a.name);
   if(!attrs.has(a.name)||/url\s*\(|javascript:|https?:/i.test(a.value)&&!namespaceDeclaration)fail('unsupported_feature: Атрибут '+a.name+' не підтримується');
  }
  if(el.hasAttribute('style')) {
   for(const declaration of el.getAttribute('style')!.split(';').filter(s=>s.trim())) {
    const [key,value,...extra]=declaration.split(':').map(v=>v.trim());
    if(extra.length||!['fill','fill-rule','stroke','opacity','fill-opacity','display','visibility','enable-background'].includes(key))fail('unsupported_feature: CSS-властивість '+key);
    el.setAttribute(key,value);
   }el.removeAttribute('style');
  }
  if(el.localName==='path') {
   const d=el.getAttribute('d')?.trim()??'';
   const commands=d.match(/[a-df-z]/ig)??[];
   if(commands.length && commands.at(-1)?.toLowerCase()!=='z') {
    // Filled SVG paths are surfaces; close an open contour so it can be
    // extruded. Explicit strokes are still rejected below because their
    // width must first be converted to an outline by the authoring tool.
    el.setAttribute('d',d+' Z');
   }
  }
  if(el.hasAttribute('stroke')&&el.getAttribute('stroke')!=='none')fail('unsupported_feature: Перетворіть обводки на залиті контури');
  for(const k of ['opacity','fill-opacity'])if(el.hasAttribute(k)&&Number(el.getAttribute(k))!==1)fail('unsupported_feature: Часткова прозорість SVG не підтримується');
  for(const k of ['x','y','width','height','rx','ry','cx','cy','r'])if(el.hasAttribute(k)&&!/^[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?(?:px)?$/i.test(el.getAttribute(k)!))fail('unsupported_feature: Одиниці координат: лише px або число');
 }
 for(const el of nodes)if(el.getAttribute('display')==='none'||el.getAttribute('visibility')==='hidden'||['title','desc'].includes(el.localName))el.remove();
 return new dom.window.XMLSerializer().serializeToString(xml);
}
export function buildGeometry(svg:string,parameters:GeometryParams):GeometryResult {
 // A coarse bevel makes broad studio reflections break into visible bands on
 // curved SVG edges. Keep the public parameter contract, but guarantee enough
 // samples for a continuous highlight even when older clients send 4 segments.
 const fixedParameters={...parameters,bevelRadius:.01,bevelSegments:Math.max(8,parameters.bevelSegments)};
 validateGeometry(fixedParameters);
 const text=sanitize(svg), parsed=new SVGLoader().parse(text);
 const shapes:Shape[]=[];
 for(const path of parsed.paths)if((path.userData?.style as {fill?:string})?.fill!=='none')shapes.push(...path.toShapes());
 if(!shapes.length)fail('invalid_svg: SVG не містить видимих залитих форм');
 const rough=shapes.flatMap(s=>s.getPoints(24));
 const minX=Math.min(...rough.map(p=>p.x)),maxX=Math.max(...rough.map(p=>p.x)),minY=Math.min(...rough.map(p=>p.y)),maxY=Math.max(...rough.map(p=>p.y));
 const size=Math.max(maxX-minX,maxY-minY);if(!Number.isFinite(size)||size<=0)fail('invalid_geometry: Порожні межі');
 const rings=shapes.map(s=>[s,...s.holes].map((p,i)=>{
  const r=sample(p,fixedParameters.curveTolerance*size).map(v=>new Vector2((v.x-(minX+maxX)/2)/size,-(v.y-(minY+maxY)/2)/size));
  if((area(r)>0)!==(i===0))r.reverse();return r;
 }));
 if(rings.flat().reduce((n,r)=>n+r.length,0)>2000)fail('resource_limit: Прототип підтримує до 2000 сегментів');
 rings.forEach(checkShape);
 // SVG artwork frequently contains intentionally overlapping filled paths
 // (logos, highlights and exported boolean layers). Keep them as separate
 // watertight solids; Three.js can render the overlap and rejecting the whole
 // file makes common editor exports unusable. Self-intersections and invalid
 // holes are still rejected by checkShape above.
 const parts=rings.map((r,index)=>{
  try{return extrude(r,fixedParameters,'part_'+(index+1));}
  catch(error){
   const message=error instanceof Error?error.message:'';
   if(!message.startsWith('invalid_geometry:')||!/фаск|деталь/i.test(message))throw error;
   return extrude(r,{...fixedParameters,bevelRadius:0},'part_'+(index+1));
  }
 });
 const id=createHash('sha256').update(text+JSON.stringify(fixedParameters)+'geometry-v1').digest('hex');
 const meshSha256=createHash('sha256').update(JSON.stringify(parts)).digest('hex');
 return {id,parts,parameters:fixedParameters,triangleCount:parts.reduce((n,p)=>n+p.indices.length/3,0),meshSha256};
}
function extrude(rings:Vector2[][],p:GeometryParams,id:string):MeshPart {
 const positions:number[]=[],indices:number[]=[],uvs:number[]=[];
 const layers:{z:number;rings:Vector2[][]}[]=[];
 if(p.bevelRadius>0) {
  for(let i=0;i<=p.bevelSegments;i++) {const theta=i/p.bevelSegments*Math.PI/2;layers.push({z:-p.depth/2+p.bevelRadius*(1-Math.cos(theta)),rings:rings.map(r=>inset(r,p.bevelRadius*(1-Math.sin(theta))))});}
  for(let i=p.bevelSegments;i>=0;i--) {const theta=i/p.bevelSegments*Math.PI/2;layers.push({z:p.depth/2-p.bevelRadius*(1-Math.cos(theta)),rings:rings.map(r=>inset(r,p.bevelRadius*(1-Math.sin(theta))))});}
 }else layers.push({z:-p.depth/2,rings},{z:p.depth/2,rings});
 for(const layer of layers) {
  checkShape(layer.rings);
  layer.rings.forEach((r,i)=>{if(Math.sign(area(r))!==Math.sign(area(rings[i])))fail('invalid_geometry: Фаска знищує деталь');
   for(let j=0;j<r.length;j++){const prev=rings[i][j],next=rings[i][(j+1)%r.length],a=r[j],b=r[(j+1)%r.length];if(b.clone().sub(a).dot(next.clone().sub(prev))<=0)fail('invalid_geometry: Завелика фаска');}
  });
 }
 const count=rings.flat().length;
 for(const layer of layers)for(const r of layer.rings)for(const v of r){positions.push(v.x,v.y,layer.z);uvs.push(v.x+.5,v.y+.5);}
 for(let l=0;l<layers.length-1;l++){let offset=0;for(const r of rings){for(let i=0;i<r.length;i++){const a=l*count+offset+i,b=l*count+offset+(i+1)%r.length,c=b+count,d=a+count;indices.push(a,b,c,a,c,d);}offset+=r.length;}}
 for(const [layerIndex,top] of [[0,false],[layers.length-1,true]] as const) {
  const layer=layers[layerIndex],offset=positions.length/3;
  for(const r of layer.rings)for(const v of r){positions.push(v.x,v.y,layer.z);uvs.push(v.x+.5,v.y+.5);}
  for(const face of ShapeUtils.triangulateShape(layer.rings[0],layer.rings.slice(1))){const [a,b,c]=face;indices.push(offset+a,offset+(top?b:c),offset+(top?c:b));}
 }
 const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
 const part={id,positions:Array.from(g.getAttribute('position').array),normals:Array.from(g.getAttribute('normal').array),uvs,indices};g.dispose();
 checkMesh(part);return part;
}
export function checkMesh(part:MeshPart) {
 const key=(i:number)=>part.positions.slice(i*3,i*3+3).map(n=>Math.round(n*1e7)).join(',');
 const edges=new Map<string,{count:number;direction:number}>();let volume=0;
 for(let i=0;i<part.indices.length;i+=3){const ids=part.indices.slice(i,i+3),points=ids.map(v=>part.positions.slice(v*3,v*3+3));
  const [a,b,c]=points; const u=b.map((v,j)=>v-a[j]),v=c.map((v,j)=>v-a[j]);const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  if(Math.hypot(...n)<1e-13)fail('invalid_geometry: Вироджений трикутник');
  volume+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
  for(let j=0;j<3;j++){const a=key(ids[j]),b=key(ids[(j+1)%3]),k=a<b?a+'|'+b:b+'|'+a;const e=edges.get(k)??{count:0,direction:0};e.count++;e.direction+=a<b?1:-1;edges.set(k,e);}
 }
 if(volume<=0||[...edges.values()].some(e=>e.count!==2||e.direction!==0))fail('invalid_geometry: Геометрія не є замкнутою оболонкою');
}
