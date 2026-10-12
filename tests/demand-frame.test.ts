import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DemandFrame} from '../packages/renderer-web/demand-frame';

function harness(){
 let id=0,renders=0;
 const queue=new Map<number,()=>void>();
 const scheduler=new DemandFrame(cb=>{queue.set(++id,cb);return id;},key=>{queue.delete(key);},()=>{renders++;});
 const flush=()=>{const callbacks=[...queue.values()];queue.clear();callbacks.forEach(cb=>cb());};
 return {scheduler,queue,flush,get renders(){return renders;}};
}
test('coalesces changes and schedules no further work at rest',()=>{
 const h=harness();
 for(let i=0;i<100;i++)h.scheduler.invalidate();
 assert.equal(h.queue.size,1);h.flush();
 assert.equal(h.renders,1);assert.equal(h.queue.size,0);
 h.flush();assert.equal(h.renders,1);
});
test('hidden view cancels work and renders latest changes once on return',()=>{
 const h=harness();h.scheduler.invalidate();h.scheduler.setVisible(false);
 h.scheduler.invalidate();h.flush();assert.equal(h.renders,0);
 h.scheduler.setVisible(true);h.flush();assert.equal(h.renders,1);
 h.scheduler.setVisible(false);h.scheduler.setVisible(true);
 assert.equal(h.queue.size,0);
});
test('disposal cancels pending work and ignores subsequent changes',()=>{
 const h=harness();h.scheduler.invalidate();h.scheduler.dispose();h.scheduler.invalidate();h.flush();
 assert.equal(h.renders,0);assert.equal(h.queue.size,0);
});
