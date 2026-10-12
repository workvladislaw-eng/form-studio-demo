import {test} from 'node:test';import assert from 'node:assert/strict';
import {makeScene} from '../packages/scene-core/scene';
import {applyMaterialStyle,applyGraphiteBackground,CRYSTAL_GRADIENT,GRAPHITE_GRADIENT} from '../packages/scene-core/material-styles';
test('graphite background adapts optics reversibly and preserves composition',()=>{
 const s=makeScene('g',['p']);trackStudioLights(s);const original=structuredClone(s);
 applyGraphiteBackground(s,true);trackStudioLights(s);validateScene(JSON.parse(JSON.stringify(s)));
 assert.equal(s.background.algorithmVersion,GRAPHITE_GRADIENT);
 assert.ok(s.materials[0].absorptionPerMeter[0]>s.materials[0].absorptionPerMeter[2]);
 assert.deepEqual(s.objects,original.objects);assert.deepEqual(s.camera,original.camera);
 applyGraphiteBackground(s,false);trackStudioLights(s);
 assert.deepEqual(s.materials,original.materials);assert.deepEqual(s.lights,original.lights);assert.deepEqual(s.background,original.background);
 applyMaterialStyle(s,'amber');const crystal=structuredClone(s);applyGraphiteBackground(s,true);assert.deepEqual(s,crystal);
});
import {trackStudioLights} from '../packages/scene-core/studio-lighting';
import {validateScene} from '../packages/contracts/schema';
test('blue chrome is reflective dielectric glass; graphite returns to original black setup',()=>{
 const s=makeScene('g',['p']);const original=structuredClone(s);
 applyMaterialStyle(s,'blue-chrome');trackStudioLights(s);validateScene(JSON.parse(JSON.stringify(s)));
 assert.equal(s.materials[0].model,'dielectric');assert.deepEqual(s.materials[0].baseColor.value,[7/255,54/255,120/255]);assert.equal(s.materials[0].transmission,1);assert.equal(s.materials[0].ior,1.52);assert.equal(s.materials[0].roughness,.02);assert.equal(s.materials[0].iridescence,.32);assert.equal(s.environment.strength,1.05);assert.equal(s.lights.length,3);assert.ok(s.materials[0].absorptionPerMeter[0]>s.materials[0].absorptionPerMeter[2]);
 assert.deepEqual(s.objects,original.objects);assert.deepEqual(s.camera,original.camera);
 applyMaterialStyle(s,'graphite');assert.deepEqual(s,original);
});
test('bloom survives scene serialization and style changes; legacy scenes remain valid',()=>{
 const s=makeScene('g',['p']);validateScene(s);
 s.postprocessing={enhancedBloom:true};applyMaterialStyle(s,'amber');
 const restored=JSON.parse(JSON.stringify(s));validateScene(restored);
 assert.equal(restored.postprocessing?.enhancedBloom,true);
 applyMaterialStyle(restored,'graphite');assert.equal(restored.postprocessing?.enhancedBloom,true);
 assert.throws(()=>validateScene({...restored,postprocessing:{enhancedBloom:'true'}}),/validation_error/);
});
test('switching styles preserves geometry and composition and restores graphite lighting',()=>{
 const s=makeScene('g',['p']);s.composition.aspect='3:4';s.objects[0].transform.scale=1.2;
 const object=structuredClone(s.objects);applyMaterialStyle(s,'amber');trackStudioLights(s);validateScene(JSON.parse(JSON.stringify(s)));
 assert.deepEqual(s.objects,object);assert.equal(s.composition.aspect,'3:4');assert.equal(s.background.algorithmVersion,CRYSTAL_GRADIENT);
 assert.equal(s.materials[0].roughness,.02);assert.equal(s.materials[0].transmission,1);assert.equal(s.lights.length,3);
 assert.ok(s.materials[0].absorptionPerMeter[2]>s.materials[0].absorptionPerMeter[0]);
 applyMaterialStyle(s,'graphite');trackStudioLights(s);validateScene(s);
 assert.equal(s.materials[0].preset,'glass');assert.deepEqual(s.background.color.value,[0,0,0]);assert.equal(s.lights.length,5);assert.deepEqual(s.objects,object);
});
