import * as T from 'three';

// Dark studio with separated reflection cards. Created once, never per frame.
export function createCrystalStudio():T.Scene {
 const scene=new T.Scene();scene.background=new T.Color(.012,.014,.017);
 const cards:[number,number,number,number,number,number,number][]=[
  [-3,1,4,.5,6,5,0xffffff],[-1.7,.4,4,.22,5,3,0xf4f7ff],
  [2.8,1,3,.65,5,4,0xfff3e3],[4,-.4,1,.25,5,3,0xffecd6],
  [-3,0,-3,.8,5,4,0xdceaff],[2,1,-4,.4,6,5,0xfff6ed],
  [0,4,1,5,.6,3,0xffffff],[0,-3,2,4,.25,2,0xe8edf5]
 ];
 for(const [x,y,z,width,height,intensity,color] of cards){
  const material=new T.MeshBasicMaterial({color:new T.Color(color).multiplyScalar(intensity),side:T.DoubleSide});
  const card=new T.Mesh(new T.PlaneGeometry(width,height),material);card.position.set(x,y,z);card.lookAt(0,0,0);scene.add(card);
 }
 return scene;
}
export function disposeCrystalStudio(scene:T.Scene):void {
 scene.traverse(child=>{if(child instanceof T.Mesh){child.geometry.dispose();const materials=Array.isArray(child.material)?child.material:[child.material];materials.forEach(m=>m.dispose());}});
}
