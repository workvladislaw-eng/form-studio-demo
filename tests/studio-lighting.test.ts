import {test} from 'node:test';import assert from 'node:assert/strict';
import {makeScene} from '../packages/scene-core/scene';import {trackStudioLights} from '../packages/scene-core/studio-lighting';import {validateScene} from '../packages/contracts/schema';
test('tracking lights remain valid through a full rotation and move with the object',()=>{
 const scene=makeScene('g',['p']);
 for(let i=0;i<=36;i++){const a=i*Math.PI/18;scene.objects[0].transform.rotation=[0,Math.sin(a/2),0,Math.cos(a/2)];trackStudioLights(scene);validateScene(scene);for(const light of scene.lights.filter(l=>!l.id.startsWith('key'))){assert.ok(Math.abs(Math.hypot(...light.position)-2.8)<1e-10);assert.deepEqual(light.target,[0,0,0]);}assert.ok(scene.lights[0].position[1]<0);assert.ok(Math.abs(scene.lights[0].up[1]-1)<1e-10);assert.equal(scene.lights.length,5);}
 scene.objects[0].transform.rotation=[0,0,0,1];trackStudioLights(scene);const before=[...scene.lights[0].position];scene.objects[0].transform.position=[1,2,3];scene.camera.position=[1,2,5.5];trackStudioLights(scene);scene.lights[0].position.forEach((v,i)=>assert.ok(Math.abs(v-before[i]-[1,2,3][i])<1e-10));
});
test('graphite glass is non-emissive dielectric on black',()=>{const s=makeScene('g',['p']);assert.equal(s.materials[0].metalness,0);assert.equal(s.materials[0].transmission,1);assert.equal(s.materials[0].emissiveIntensity,0);assert.deepEqual(s.background.color.value,[0,0,0]);});
test('key position stays continuous across the former dominant-face boundary',()=>{
 const s=makeScene('g',['p']);
 const position=(a:number)=>{s.objects[0].transform.rotation=[0,Math.sin(a/2),0,Math.cos(a/2)];trackStudioLights(s);return [...s.lights[0].position];};
 const a=position(Math.PI/4-.0001),b=position(Math.PI/4+.0001);
 assert.ok(Math.hypot(...a.map((v,i)=>v-b[i]))<.002);
 s.lights[0].powerWatts=9;trackStudioLights(s);
 assert.ok(s.lights.filter(l=>l.id.startsWith('key')).every(l=>l.powerWatts===9));
});
test('key angle rotates the studio softbox and remains schema-valid',()=>{
 const s=makeScene('g',['p']);
 trackStudioLights(s);
 const base=[...s.lights.find(l=>l.id==='key')!.position];
 s.lighting={keyAngleRad:Math.PI/2};
 trackStudioLights(s);
 const rotated=s.lights.find(l=>l.id==='key')!.position;
 assert.ok(Math.hypot(...base.map((v,i)=>v-rotated[i]))>.1);
 validateScene(s);
});
test('key angle also affects the blue chrome studio setup',()=>{
 const s=makeScene('g',['p']);s.materials[0].preset='blue-chrome';
 trackStudioLights(s);const base=[...s.lights.find(l=>l.id==='key')!.position];
 s.lighting={keyAngleRad:-Math.PI/2};trackStudioLights(s);
 const rotated=s.lights.find(l=>l.id==='key')!.position;
 assert.ok(Math.hypot(...base.map((v,i)=>v-rotated[i]))>.1);validateScene(s);
});
