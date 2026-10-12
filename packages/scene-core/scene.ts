import type { Scene } from '../contracts/schema';
export const srgb=(value:number[])=>({space:'srgb' as const,value});
export function makeScene(geometryId:string,parts:string[]):Scene {
 return {schemaVersion:2,metersPerUnit:0.1,objects:[{id:'object_1',geometryRevisionId:geometryId,transform:{position:[0,0,0],rotation:[0,0,0,1],scale:1},partMaterialAssignments:Object.fromEntries(parts.map(p=>[p,'material_1']))}],materials:[{id:'material_1',preset:'glass',model:'dielectric',baseColor:srgb([1,1,1]),roughness:0.02,metalness:0,transmission:1,ior:1.8,absorptionPerMeter:[45.9,41.2,34.8],texture:null,emissiveColor:srgb([0,0,0]),emissiveIntensity:0,clearcoat:1,clearcoatRoughness:0.055,iridescence:0,iridescenceIOR:1.7}],camera:{type:'perspective',position:[0,0,2.5],target:[0,0,0],up:[0,1,0],verticalFovRad:0.6,near:0.01,far:100},lights:[
 {id:'key',type:'area',position:[-1.2,-1.6,2.4],target:[0,0,0],up:[0,1,0],width:3.2,height:0.75,color:srgb([0.9,0.95,1]),powerWatts:14},
 {id:'fill',type:'area',position:[1.7,0.3,2.2],target:[0,0,0],up:[0,1,0],width:0.45,height:3.4,color:srgb([0.45,0.7,1]),powerWatts:6},
 {id:'rim',type:'area',position:[0,1,-1],target:[0,0,0],up:[0,0,1],width:2.5,height:1.2,color:srgb([0.42,0.68,1]),powerWatts:2.4}
 ],environment:{resourceId:null,rotationRad:0,strength:1},background:{mode:'manual',driverPartId:null,algorithmVersion:null,color:srgb([0,0,0])},composition:{aspect:'16:9'},colorManagement:{profile:'standard-srgb-v1',exposureEV:0},lighting:{keyAngleRad:0},volumetrics:{enabled:false,density:0.004,anisotropy:0.35,intensity:1.4},postprocessing:{enhancedBloom:true},styleOrigin:null};
}

