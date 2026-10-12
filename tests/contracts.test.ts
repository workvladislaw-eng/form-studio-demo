import {test} from 'node:test';import assert from 'node:assert/strict';
import {validateScene,dimensions} from '../packages/contracts/schema';import {makeScene} from '../packages/scene-core/scene';
test('scene survives JSON round trip',()=>{const scene=makeScene('g',['part_1']);validateScene(JSON.parse(JSON.stringify(scene)));});
test('unknown fields and malformed transforms fail',()=>{const s=makeScene('g',['p']);assert.throws(()=>validateScene({...s,extra:true}));s.objects[0].transform.rotation=[1,1,1,1];assert.throws(()=>validateScene(s),/Quaternion/);});
test('material invariants and camera degeneracy fail',()=>{const s=makeScene('g',['p']);s.materials[0].metalness=1;assert.throws(()=>validateScene(s));const b=makeScene('g',['p']);b.camera.target=b.camera.position;assert.throws(()=>validateScene(b));});
test('volumetric lighting is explicit and bounded',()=>{const s=makeScene('g',['p']);assert.equal(s.volumetrics.enabled,false);s.volumetrics.enabled=true;s.volumetrics.density=.02;s.volumetrics.anisotropy=.4;s.volumetrics.intensity=1.5;validateScene(s);assert.throws(()=>validateScene({...s,volumetrics:{...s.volumetrics,density:2}}));});
test('all output ratios are exact at 4K long edge',()=>{for(const [aspect,[w,h]] of Object.entries(dimensions)){const [a,b]=aspect.split(':').map(Number);assert.equal(w*b,h*a);assert.equal(Math.max(w,h),3840);}});
