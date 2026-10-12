import {test} from 'node:test';import assert from 'node:assert/strict';
import {FrameBloomPass,bloomSize} from '../packages/renderer-web/frame-bloom';
test('bloom occupies the same frame area in preview and 4K for every ratio',()=>{
 for(const [w,h] of [[16,9],[9,16],[4,3],[3,4],[1,1]]){
  assert.deepEqual(bloomSize(w*30,h*30),bloomSize(w*240,h*240));
  const bloom=new FrameBloomPass();bloom.setSize(w*30,h*30);
  const size=[bloom.renderTargetBright.width,bloom.renderTargetBright.height];
  bloom.setSize(w*240,h*240);assert.deepEqual([bloom.renderTargetBright.width,bloom.renderTargetBright.height],size);
  bloom.dispose();
 }
});

test('export preserves cached halo allocation until preview resumes',()=>{const bloom=new FrameBloomPass();bloom.setSize(301,538);const size=[bloom.renderTargetBright.width,bloom.renderTargetBright.height];bloom.reuseFrame=true;bloom.setSize(2160,3840);assert.deepEqual([bloom.renderTargetBright.width,bloom.renderTargetBright.height],size);bloom.reuseFrame=false;bloom.setSize(960,540);assert.notDeepEqual([bloom.renderTargetBright.width,bloom.renderTargetBright.height],size);bloom.dispose();});
