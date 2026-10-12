import type {Scene} from '../contracts/schema';
// Studio softboxes follow the three principal surface directions. Positions are
// saved in the scene, so export does not need a separate lighting calculation.
export function trackStudioLights(scene:Scene):void {
 const o=scene.objects[0],p=o.transform.position,[x,y,z,w]=o.transform.rotation;
 const axes=[[1-2*(y*y+z*z),2*(x*y+z*w),2*(x*z-y*w)],
 [2*(x*y-z*w),1-2*(x*x+z*z),2*(y*z+x*w)],
 [2*(x*z+y*w),2*(y*z-x*w),1-2*(x*x+y*y)]];
 const view=scene.camera.position.map((v,i)=>v-p[i]);const length=Math.hypot(...view);if(length<1e-6)return;
 const v=view.map(c=>c/length);
 const keyAngle=scene.lighting?.keyAngleRad??0;
 const rotateY=(a:number[])=>{const c=Math.cos(keyAngle),s=Math.sin(keyAngle);return [a[0]*c-a[2]*s,a[1],a[0]*s+a[2]*c];};
 const styled=['amber-glass','blue-chrome'].includes(scene.materials[0].preset);
 // Keep one white strip for each surface family. Never switch the only key
 // away from the front face when a side becomes dominant.
 const key=scene.lights.find(l=>l.id==='key');
  if(key&&!styled)for(const id of ['key-side','key-top']){
  let support=scene.lights.find(l=>l.id===id);
  if(!support){support=structuredClone(key);support.id=id;scene.lights.push(support);}
  support.powerWatts=key.powerWatts;support.width=key.width;support.height=key.height;support.color=structuredClone(key.color);
 }
 // Key covers front/back caps; fills cover the sides when the SVG is edge-on.
 for(const [id,axis] of [['key',axes[2]],['fill',axes[0]],['rim',axes[1]],['key-side',axes[0]],['key-top',axes[1]]] as [string,number[]][]) {
  const light=scene.lights.find(l=>l.id===id);if(!light)continue;
  const dot=axis.reduce((sum,n,j)=>sum+n*v[j],0);
 const direction=axis.map((n,j)=>2*dot*n-v[j]);
  if(id.startsWith('key')) {
   // Reflect a camera-aligned virtual softbox across the dominant surface.
   // Moving that virtual image down preserves its horizontal orientation.
   const normal=axis;
   const upDot=scene.camera.up.reduce((a,c,j)=>a+c*v[j],0);
   const up=scene.camera.up.map((c,j)=>c-upDot*v[j]);
   const upLength=Math.hypot(...up);for(let j=0;j<3;j++)up[j]/=upLength;
   const reflect=(a:number[])=>{const d=a.reduce((sum,c,j)=>sum+c*normal[j],0);return a.map((c,j)=>c-2*d*normal[j]);};
   const offset=rotateY(reflect(v.map((c,j)=>-2.8*c-.65*o.transform.scale*up[j])));
   light.position=offset.map((c,j)=>p[j]+c);
   const forward=rotateY(reflect(v));
   light.target=light.position.map((c,j)=>c+forward[j]);
   light.up=rotateY(reflect(up));
   continue;
  }
  const directionLength=Math.hypot(...direction);
  light.position=direction.map((n,j)=>p[j]+n/directionLength*2.8);
  light.target=[...p];
  light.up=Math.abs(direction[1])>.95?[1,0,0]:[0,1,0];
 }
}
