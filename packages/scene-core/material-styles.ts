import type {Scene} from '../contracts/schema';
import {makeScene,srgb} from './scene';

export const CRYSTAL_GRADIENT='teal-studio-v3';
export const CRYSTAL_TOP=[.65,.83,.85];
export const GRAPHITE_GRADIENT='graphite-blue-v1';
export function applyGraphiteBackground(scene:Scene,gradient:boolean):void {
 if(scene.materials[0].preset==='amber-glass')return;
 const defaults=makeScene(scene.objects[0].geometryRevisionId,Object.keys(scene.objects[0].partMaterialAssignments));
 Object.assign(scene.materials[0],{absorptionPerMeter:gradient?[68,38,12]:defaults.materials[0].absorptionPerMeter});
 scene.background=gradient?{mode:'auto',driverPartId:Object.keys(scene.objects[0].partMaterialAssignments)[0],algorithmVersion:GRAPHITE_GRADIENT,color:srgb([0,.015,.035])}:defaults.background;
 for(const id of ['fill','rim']){
  const light=scene.lights.find(l=>l.id===id),base=defaults.lights.find(l=>l.id===id);
  if(light&&base){light.color=gradient?srgb(id==='fill'?[.08,.55,1]:[.12,.75,1]):base.color;light.powerWatts=base.powerWatts*(gradient?1.35:1);}
 }
}
export const BLUE_CHROME_GRADIENT='blue-chrome-studio-v1';
export const BLUE_CHROME_BASE='#073678';
export type MaterialStyle='graphite'|'amber'|'blue-chrome';
export function applyMaterialStyle(scene:Scene,style:MaterialStyle):void {
 const defaults=makeScene(scene.objects[0].geometryRevisionId,Object.keys(scene.objects[0].partMaterialAssignments));
 scene.materials=defaults.materials;scene.lights=defaults.lights;scene.background=defaults.background;scene.environment=defaults.environment;
 if(style==='graphite')return;
 if(style==='blue-chrome'){
  Object.assign(scene.materials[0],{preset:'blue-chrome',model:'dielectric',baseColor:srgb([7/255,54/255,120/255]),metalness:0,transmission:1,ior:1.52,absorptionPerMeter:[8,3,1],clearcoat:1,clearcoatRoughness:.02,iridescence:.32,iridescenceIOR:1.7});
  scene.background={mode:'auto',driverPartId:Object.keys(scene.objects[0].partMaterialAssignments)[0],algorithmVersion:BLUE_CHROME_GRADIENT,color:srgb([0,.004,.008])};
  scene.environment.strength=1.05;
  scene.lights=[
   {id:'key',type:'area',position:[-1.7,1,2.4],target:[0,0,0],up:[0,1,0],width:.8,height:3.5,color:srgb([1,1,1]),powerWatts:5},
   {id:'fill',type:'area',position:[1.6,-.7,1.5],target:[0,0,0],up:[0,1,0],width:.45,height:2.8,color:srgb([.05,.58,1]),powerWatts:7},
   {id:'rim',type:'area',position:[.7,1,-1.5],target:[0,0,0],up:[0,1,0],width:.22,height:2.4,color:srgb([.75,.3,1]),powerWatts:4}
  ];return;
 }
 Object.assign(scene.materials[0],{preset:'amber-glass',ior:1.65,absorptionPerMeter:[36,43,55],clearcoat:.7,clearcoatRoughness:.02});
 scene.environment.strength=1.4;
 scene.background={mode:'auto',driverPartId:Object.keys(scene.objects[0].partMaterialAssignments)[0],algorithmVersion:CRYSTAL_GRADIENT,color:srgb([.025,.12,.15])};
 scene.lights=[
  {id:'key',type:'area',position:[-1.6,.2,2],target:[0,0,0],up:[0,1,0],width:.3,height:3,color:srgb([1,.98,.96]),powerWatts:1.5},
  {id:'fill',type:'area',position:[1.8,.5,1.4],target:[0,0,0],up:[0,1,0],width:.25,height:2.8,color:srgb([1,.94,.85]),powerWatts:1},
  {id:'rim',type:'area',position:[-.7,1,-1.3],target:[0,0,0],up:[0,1,0],width:2,height:2,color:srgb([.83,.94,1]),powerWatts:4.5}
 ];
}
