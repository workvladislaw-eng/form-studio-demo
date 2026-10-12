import * as T from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import type {GeometryResult,Scene} from '../contracts/schema';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {FrameBloomPass} from './frame-bloom';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {DemandFrame} from './demand-frame';
import {CRYSTAL_GRADIENT,CRYSTAL_TOP,GRAPHITE_GRADIENT,BLUE_CHROME_GRADIENT} from '../scene-core/material-styles';
import {createCrystalStudio,disposeCrystalStudio} from './crystal-studio';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

export class Viewer {
 renderer:T.WebGLRenderer;world=new T.Scene();camera=new T.PerspectiveCamera();object=new T.Group();lights=new T.Group();volumetric=new T.Group();
 private composer:EffectComposer;
 private crystalEnvironment:T.WebGLRenderTarget|null=null;
 private crystalEnvironmentVersion='';
 private bloom:FrameBloomPass;
 private output:OutputPass;
 private backgroundMesh:T.Mesh;
 private materials:T.MeshPhysicalMaterial[]=[];
 private depth=0.1;
 private materialKey='';private lightKey='';
 private materialMap=new Map<string,T.MeshPhysicalMaterial>();
 private volumetricKey='';
 private width=0;private height=0;
 private previewAspect=1;
 private frames:DemandFrame;
 private visibility=()=>this.frames.setVisible(!document.hidden);
 constructor(public canvas:HTMLCanvasElement){
  RectAreaLightUniformsLib.init();
  this.renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true,preserveDrawingBuffer:true});this.renderer.setPixelRatio(1);this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.NoToneMapping;this.renderer.setClearColor(0,0);
  const backgroundMaterial=new T.ShaderMaterial({depthWrite:false,depthTest:false,side:T.DoubleSide,uniforms:{topColor:{value:new T.Color()},bottomColor:{value:new T.Color()},blueMode:{value:0},blueColor:{value:new T.Color().setRGB(.01,.36,.78,T.SRGBColorSpace)},cornerColor:{value:new T.Color().setRGB(.008,.12,.3,T.SRGBColorSpace)},haloColor:{value:new T.Color().setRGB(.015,.08,.24,T.SRGBColorSpace)}},vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.999,1.0);}',fragmentShader:`uniform vec3 topColor,bottomColor,blueColor,cornerColor,haloColor; uniform float blueMode; varying vec2 vUv;
  void main(){
   float d=length(vec2(vUv.x,(1.0-vUv.y)*0.95));
   float t=pow(clamp(1.0-d/1.25,0.0,1.0),2.4);
   vec3 color=mix(bottomColor,topColor,t);
   if(blueMode>0.5){
    float lower=1.0-smoothstep(-0.30,0.70,vUv.y-0.35*vUv.x);
    float corner=exp(-3.2*length(vec2(vUv.x,1.0-vUv.y)))*.55;
    float halo=exp(-8.0*length(vUv-vec2(.5,.5)));
    float sweep=exp(-22.0*abs(vUv.y-(.12+.18*vUv.x)))*.22;
    color=(bottomColor+blueColor*(lower*.16+sweep)+cornerColor*corner*.24+haloColor*halo*.06)*.28;
   }
   gl_FragColor=vec4(color,1.0);
  }`});
  this.backgroundMesh=new T.Mesh(new T.PlaneGeometry(2,2),backgroundMaterial);this.backgroundMesh.frustumCulled=false;this.backgroundMesh.position.z=-4;this.backgroundMesh.renderOrder=-10;
  this.volumetric.renderOrder=-1;this.world.add(this.backgroundMesh,this.volumetric,this.object,this.lights);
  const target=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,samples:4});
  this.composer=new EffectComposer(this.renderer,target);
  this.composer.addPass(new RenderPass(this.world,this.camera));
  this.bloom=new FrameBloomPass();
  this.output=new OutputPass();this.composer.addPass(this.bloom);this.composer.addPass(this.output);
  this.frames=new DemandFrame(callback=>requestAnimationFrame(callback),id=>cancelAnimationFrame(id),()=>this.renderFrame());
  document.addEventListener('visibilitychange',this.visibility);this.visibility();
 }
 geometry(g:GeometryResult){
  this.depth=g.parameters.depth;
  this.object.children.forEach(o=>(o as T.Mesh).geometry.dispose());this.object.clear();
  for(const p of g.parts){const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p.positions,3));geo.setAttribute('normal',new T.Float32BufferAttribute(p.normals,3));geo.setAttribute('uv',new T.Float32BufferAttribute(p.uvs,2));geo.setIndex(p.indices);const mesh=new T.Mesh(geo);mesh.name=p.id;this.object.add(mesh);}
 }
 update(s:Scene){
  const rgb=(c:number[])=>new T.Color().setRGB(c[0],c[1],c[2],T.SRGBColorSpace);
  const crystal=s.materials[0].preset==='amber-glass';
  const blueChrome=s.materials[0].preset==='blue-chrome';
  const studioVersion=s.background.algorithmVersion??'teal-studio-v1';
  if((crystal||blueChrome)&&(!this.crystalEnvironment||this.crystalEnvironmentVersion!==studioVersion)){
   this.crystalEnvironment?.dispose();
   const legacy=!['teal-studio-v2',CRYSTAL_GRADIENT,BLUE_CHROME_GRADIENT].includes(studioVersion);
   const room=legacy?new RoomEnvironment():createCrystalStudio(),generator=new T.PMREMGenerator(this.renderer);
   this.crystalEnvironment=generator.fromScene(room,legacy?.03:.015);disposeCrystalStudio(room);generator.dispose();this.crystalEnvironmentVersion=studioVersion;
  }
  this.world.environment=(crystal||blueChrome)?this.crystalEnvironment!.texture:null;
  this.world.environmentIntensity=s.environment.strength;
  const materialKey=JSON.stringify([s.materials,this.depth,s.objects[0].transform.scale,studioVersion]);
  if(materialKey!==this.materialKey){
  this.materials.forEach(m=>m.dispose());this.materials=[];
  this.materialMap=new Map(s.materials.map(m=>{
   const color=rgb(m.baseColor.value);
   const glass=['glass','amber-glass','crystal','blue-chrome'].includes(m.preset);const mat=new T.MeshPhysicalMaterial({color,metalness:m.metalness,roughness:m.roughness,transmission:m.transmission,ior:m.ior,thickness:glass?this.depth*s.objects[0].transform.scale:0,attenuationColor:new T.Color(...m.absorptionPerMeter.map(v=>Math.exp(-v*.1)) as [number,number,number]),attenuationDistance:1,emissive:rgb(m.emissiveColor.value),emissiveIntensity:m.emissiveIntensity,clearcoat:m.clearcoat,clearcoatRoughness:m.clearcoatRoughness,iridescence:m.iridescence,iridescenceIOR:m.iridescenceIOR});
   if((m.preset==='amber-glass'&&studioVersion===CRYSTAL_GRADIENT)||m.preset==='blue-chrome'){
    // Include rear faces in Three's transmission pass. Thickness is local;
    // the transmission shader applies model scale once.
    mat.side=T.DoubleSide;mat.thickness=this.depth;
   }
   this.materials.push(mat);return [m.id,mat] as const;
  }));
  this.materialKey=materialKey;
  }
  const o=s.objects[0];this.object.position.fromArray(o.transform.position);this.object.quaternion.fromArray(o.transform.rotation);this.object.scale.setScalar(o.transform.scale);
  for(const mesh of this.object.children as T.Mesh[])mesh.material=this.materialMap.get(o.partMaterialAssignments[mesh.name])!;
  const lightKey=JSON.stringify([s.lights,s.materials[0].preset]);
  if(lightKey!==this.lightKey){
  this.lights.clear();
  for(const l of s.lights){
   // Graphite gets its separation from a real rear softbox. This produces a
   // surface reflection instead of an enlarged duplicate mesh, so holes and
   // sharp SVG corners are not surrounded by a synthetic white stroke.
   const graphiteRim=s.materials[0].preset==='glass'&&l.id==='rim'?2.8:1;
   const light=new T.RectAreaLight(rgb(l.color.value),l.powerWatts/(l.width*l.height)*1.5*graphiteRim,l.width,l.height);light.position.fromArray(l.position);light.up.fromArray(l.up);light.lookAt(new T.Vector3().fromArray(l.target));this.lights.add(light);
  }
  this.lightKey=lightKey;
  }
  const volumeKey=JSON.stringify([s.volumetrics,s.lights]);
  if(volumeKey!==this.volumetricKey){
   this.volumetric.children.forEach(child=>{const mesh=child as T.Mesh;mesh.geometry.dispose();(mesh.material as T.Material).dispose();});this.volumetric.clear();
   if(s.volumetrics.enabled){
    for(const l of s.lights){const from=new T.Vector3().fromArray(l.position),to=new T.Vector3().fromArray(l.target),axis=to.clone().sub(from),length=axis.length();if(length<1e-4)continue;const opacity=Math.min(.075,s.volumetrics.density*s.volumetrics.intensity*1.15);const material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,uniforms:{lightColor:{value:rgb(l.color.value)},beamOpacity:{value:opacity},beamRadius:{value:Math.max(l.width,l.height)*.18},beamLength:{value:length}},vertexShader:'varying vec3 vLocal; void main(){vLocal=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform vec3 lightColor; uniform float beamOpacity; uniform float beamRadius; uniform float beamLength; varying vec3 vLocal; void main(){float radius=max(0.001,(0.5-vLocal.y/beamLength)*beamRadius);float edge=clamp(1.0-length(vLocal.xz)/radius,0.0,1.0);float along=smoothstep(-beamLength*.5,-beamLength*.35,vLocal.y)*(1.0-smoothstep(beamLength*.2,beamLength*.5,vLocal.y));float alpha=beamOpacity*edge*edge*along;gl_FragColor=vec4(lightColor,alpha);}'});const cone=new T.Mesh(new T.ConeGeometry(Math.max(l.width,l.height)*.18,length,32,1,true),material);cone.position.copy(from).add(to).multiplyScalar(.5);cone.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),axis.normalize());this.volumetric.add(cone);}
   }
   this.volumetricKey=volumeKey;
  }
  this.backgroundMesh.visible=(['teal-studio-v1','teal-studio-v2',CRYSTAL_GRADIENT].includes(studioVersion)&&crystal)||[GRAPHITE_GRADIENT,BLUE_CHROME_GRADIENT].includes(studioVersion);
  const gradient=this.backgroundMesh.material as T.ShaderMaterial;
  gradient.uniforms.blueMode.value=[GRAPHITE_GRADIENT,BLUE_CHROME_GRADIENT].includes(studioVersion)?1:0;
  if(blueChrome){
   // Keep the background in the same hue family as the glass. Lower saturation
   // and value preserve a dark studio while making the material and backdrop
   // read as one controlled lighting setup.
   const accent=rgb(s.materials[0].baseColor.value),hsl={h:0,s:0,l:0};accent.getHSL(hsl);
   accent.setHSL(hsl.h,.82,.38);
   gradient.uniforms.blueColor.value.copy(accent).multiplyScalar(.24);
   gradient.uniforms.cornerColor.value.copy(accent).multiplyScalar(.10);
   gradient.uniforms.haloColor.value.copy(accent).multiplyScalar(.14);
  }
  gradient.uniforms.topColor.value.copy(rgb(CRYSTAL_TOP));gradient.uniforms.bottomColor.value.copy(rgb(s.background.color.value));
  const baseBloom=blueChrome?0.025:crystal?(studioVersion==='teal-studio-v1'?0.035:0.008):0.12;
  this.bloom.strength=s.postprocessing?.enhancedBloom===false?baseBloom:(crystal?0.04:(blueChrome?0.25:0.25));
  this.world.background=rgb(s.background.color.value);this.camera.position.fromArray(s.camera.position);this.camera.up.fromArray(s.camera.up);this.camera.lookAt(new T.Vector3().fromArray(s.camera.target));this.camera.fov=T.MathUtils.radToDeg(s.camera.verticalFovRad);this.camera.near=s.camera.near;this.camera.far=s.camera.far;
  const [w,h]=s.composition.aspect.split(':').map(Number);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.draw();
 }
 draw(){this.frames.invalidate();}
 async exportImage(width:number,height:number,format:'png'|'jpg',transparent=false,mode:'frame'|'4k'='frame'):Promise<Blob>{
  const output=document.createElement('canvas');output.width=width;output.height=height;
  this.renderFrame();
  const previousSize=this.renderer.getSize(new T.Vector2());
  try {
   if(mode==='4k'){
    this.bloom.reuseFrame=true;
    this.renderer.setSize(width,height,false);this.composer.setSize(width,height);
    this.camera.aspect=width/height;this.camera.updateProjectionMatrix();
    this.composer.render();
   }
   output.getContext('2d')!.drawImage(this.canvas,0,0,width,height);
  } finally {
   if(mode==='4k'){
    this.bloom.reuseFrame=false;this.renderer.setSize(previousSize.x,previousSize.y,false);this.composer.setSize(previousSize.x,previousSize.y);
    this.camera.aspect=this.previewAspect;this.camera.updateProjectionMatrix();this.renderFrame();
   }
  }
  return await new Promise<Blob>((resolve,reject)=>output.toBlob(blob=>blob?resolve(blob):reject(new Error('Не вдалося закодувати зображення')),format==='png'?'image/png':'image/jpeg',format==='jpg'?.95:undefined));
 }
 private renderFrame(){
  const r=this.canvas.getBoundingClientRect();const width=Math.floor(r.width),height=Math.floor(r.height);
  if(!width||!height)return;
  if(width!==this.width||height!==this.height){this.renderer.setSize(width,height,false);this.composer.setSize(width,height);this.width=width;this.height=height;}
  this.previewAspect=width/height;
  if(Math.abs(this.camera.aspect-this.previewAspect)>1e-5){this.camera.aspect=this.previewAspect;this.camera.updateProjectionMatrix();}
  this.composer.render();
  if(import.meta.env.DEV)this.canvas.dataset.renderCount=String(Number(this.canvas.dataset.renderCount??0)+1);
 }
 dispose(){this.frames.dispose();document.removeEventListener('visibilitychange',this.visibility);this.object.children.forEach(o=>(o as T.Mesh).geometry.dispose());this.materials.forEach(m=>m.dispose());this.backgroundMesh.geometry.dispose();(this.backgroundMesh.material as T.Material).dispose();this.crystalEnvironment?.dispose();this.bloom.dispose();this.output.dispose();this.composer.dispose();this.renderer.dispose();}
}
