import { Ajv } from 'ajv';
import type { FromSchema } from 'json-schema-to-ts';

const num = {type:'number'} as const;
const vec3 = {type:'array',items:num,minItems:3,maxItems:3} as const;
const color = {type:'object',additionalProperties:false,required:['space','value'],properties:{space:{const:'srgb'},value:{type:'array',items:{type:'number',minimum:0,maximum:1},minItems:3,maxItems:3}}} as const;
export const sceneSchema = {
  $id:'https://form.local/scene-v2',type:'object',additionalProperties:false,
  required:['schemaVersion','metersPerUnit','objects','materials','camera','lights','environment','background','composition','colorManagement','volumetrics','styleOrigin'],
  properties:{
    schemaVersion:{const:2},metersPerUnit:{const:0.1},
    postprocessing:{type:'object',additionalProperties:false,required:['enhancedBloom'],properties:{enhancedBloom:{type:'boolean'}}},
    objects:{type:'array',minItems:1,maxItems:1,items:{type:'object',additionalProperties:false,required:['id','geometryRevisionId','transform','partMaterialAssignments'],properties:{
      id:{type:'string'},geometryRevisionId:{type:'string'},partMaterialAssignments:{type:'object',additionalProperties:{type:'string'}},
      transform:{type:'object',additionalProperties:false,required:['position','rotation','scale'],properties:{position:vec3,rotation:{type:'array',items:num,minItems:4,maxItems:4},scale:{type:'number',exclusiveMinimum:0,maximum:10}}}
    }}},
    materials:{type:'array',minItems:1,maxItems:100,items:{type:'object',additionalProperties:false,required:['id','preset','model','baseColor','roughness','metalness','transmission','ior','absorptionPerMeter','texture','emissiveColor','emissiveIntensity','clearcoat','clearcoatRoughness','iridescence','iridescenceIOR'],properties:{
      id:{type:'string'},preset:{enum:['neon','blue-chrome','amber-glass','crystal','glass','metal','chrome']},model:{enum:['dielectric','conductor']},baseColor:color,roughness:{type:'number',minimum:0,maximum:1},metalness:{enum:[0,1]},transmission:{enum:[0,1]},ior:{type:'number',minimum:1,maximum:2.5},absorptionPerMeter:{type:'array',items:{type:'number',minimum:0},minItems:3,maxItems:3},texture:{type:'null'},emissiveColor:color,emissiveIntensity:{type:'number',minimum:0,maximum:20},clearcoat:{type:'number',minimum:0,maximum:1},clearcoatRoughness:{type:'number',minimum:0,maximum:1},iridescence:{type:'number',minimum:0,maximum:1},iridescenceIOR:{type:'number',minimum:1,maximum:2.5}
    }}},
    camera:{type:'object',additionalProperties:false,required:['type','position','target','up','verticalFovRad','near','far'],properties:{type:{const:'perspective'},position:vec3,target:vec3,up:vec3,verticalFovRad:{type:'number',exclusiveMinimum:0,exclusiveMaximum:3.14},near:{type:'number',exclusiveMinimum:0},far:{type:'number',exclusiveMinimum:0}}},
    lights:{type:'array',maxItems:5,items:{type:'object',additionalProperties:false,required:['id','type','position','target','up','width','height','color','powerWatts'],properties:{id:{type:'string'},type:{const:'area'},position:vec3,target:vec3,up:vec3,width:{type:'number',exclusiveMinimum:0},height:{type:'number',exclusiveMinimum:0},color,powerWatts:{type:'number',minimum:0,maximum:1000}}}},
    environment:{type:'object',additionalProperties:false,required:['resourceId','rotationRad','strength'],properties:{resourceId:{type:'null'},rotationRad:num,strength:{type:'number',minimum:0}}},
    background:{type:'object',additionalProperties:false,required:['mode','driverPartId','algorithmVersion','color'],properties:{mode:{enum:['auto','manual']},driverPartId:{type:['string','null']},algorithmVersion:{type:['string','null']},color}},
    composition:{type:'object',additionalProperties:false,required:['aspect'],properties:{aspect:{enum:['16:9','9:16','4:3','3:4','1:1']}}},
    colorManagement:{type:'object',additionalProperties:false,required:['profile','exposureEV'],properties:{profile:{const:'standard-srgb-v1'},exposureEV:{type:'number',minimum:-5,maximum:5}}},styleOrigin:{type:'null'}
    ,lighting:{type:'object',additionalProperties:false,required:['keyAngleRad'],properties:{keyAngleRad:{type:'number',minimum:-3.141592653589793,maximum:3.141592653589793}}}
    ,volumetrics:{type:'object',additionalProperties:false,required:['enabled','density','anisotropy','intensity'],properties:{enabled:{type:'boolean'},density:{type:'number',minimum:0,maximum:1},anisotropy:{type:'number',minimum:-0.9,maximum:0.9},intensity:{type:'number',minimum:0,maximum:10}}}
  }
} as const;
export type Scene = FromSchema<typeof sceneSchema>;
export const geometrySchema = {type:'object',additionalProperties:false,required:['depth','bevelRadius','bevelSegments','curveTolerance'],properties:{depth:{type:'number',minimum:0.005,maximum:1},bevelRadius:{type:'number',minimum:0,maximum:0.2},bevelSegments:{type:'integer',minimum:1,maximum:12},curveTolerance:{type:'number',minimum:0.00001,maximum:0.001}}} as const;
export type GeometryParams = FromSchema<typeof geometrySchema>;
const ajv = new Ajv({allErrors:true,strict:true});
const checkScene = ajv.compile(sceneSchema), checkGeometry=ajv.compile(geometrySchema);
export function validateScene(data:unknown): asserts data is Scene {
  if(!checkScene(data)) throw new Error('validation_error: Некоректний опис сцени: '+ajv.errorsText(checkScene.errors));
  const s=data as Scene;
  const ids=new Set(s.materials.map(m=>m.id));
  if(ids.size!==s.materials.length) throw new Error('validation_error: Повторені матеріали');
  for(const m of s.materials) {
    const glass=['glass','amber-glass','crystal','blue-chrome'].includes(m.preset);
    const neon=m.preset==='neon';
    const conductor=['metal','chrome'].includes(m.preset);
    if(m.model!==(glass||neon?'dielectric':'conductor') || m.metalness!==(glass||neon?0:1) || m.transmission!==(glass?1:0) || (glass && m.preset!=='blue-chrome' && m.baseColor.value.some(v=>v!==1)) || (conductor && (m.ior!==1.5 || m.absorptionPerMeter.some(v=>v!==0))) || (neon && m.emissiveIntensity<=0)) throw new Error('validation_error: Несумісні параметри матеріалу');
  }
  for(const o of s.objects) {
    if(Math.abs(Math.hypot(...o.transform.rotation)-1)>1e-6) throw new Error('validation_error: Quaternion має бути одиничним');
    if(Object.values(o.partMaterialAssignments).some(id=>!ids.has(id))) throw new Error('validation_error: Матеріал не існує');
  }
  for(const c of [s.camera,...s.lights]) {
    const d=c.position.map((v,i)=>v-c.target[i]);
    const cross=[d[1]*c.up[2]-d[2]*c.up[1],d[2]*c.up[0]-d[0]*c.up[2],d[0]*c.up[1]-d[1]*c.up[0]];
    if(Math.hypot(...cross)<1e-8 || Math.abs(Math.hypot(...c.up)-1)>1e-6) throw new Error('validation_error: Некоректний напрямок камери/світла');
  }
  if(s.camera.far<=s.camera.near) throw new Error('validation_error: Некоректні межі камери');
  if(s.background.mode==='manual' && (s.background.driverPartId!==null || s.background.algorithmVersion!==null)) throw new Error('validation_error: Manual background');
}
export function validateGeometry(data:unknown): asserts data is GeometryParams {
  if(!checkGeometry(data)) throw new Error('validation_error: Некоректні параметри геометрії');
  if((data as GeometryParams).bevelRadius*2 >= (data as GeometryParams).depth && (data as GeometryParams).bevelRadius>0) throw new Error('invalid_geometry: Фаска має бути меншою за половину глибини');
}
export const dimensions = {'16:9':[3840,2160],'9:16':[2160,3840],'4:3':[3840,2880],'3:4':[2880,3840],'1:1':[3840,3840]} as const;
export interface MeshPart {id:string;positions:number[];normals:number[];uvs:number[];indices:number[]}
export interface GeometryResult {id:string;parts:MeshPart[];triangleCount:number;parameters:GeometryParams;meshSha256:string}
