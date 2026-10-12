// Schedule only invalidated frames; never keep an animation loop alive at rest.
export class DemandFrame {
 private pending:number|null=null;
 private dirty=false;
 private visible=true;
 private disposed=false;
 constructor(private request:(callback:()=>void)=>number,private cancel:(id:number)=>void,private render:()=>void){}
 invalidate(){
  if(this.disposed)return;
  this.dirty=true;
  if(!this.visible||this.pending!==null)return;
  this.pending=this.request(()=>{
   this.pending=null;
   if(this.disposed||!this.visible||!this.dirty)return;
   this.dirty=false;
   this.render();
  });
 }
 setVisible(visible:boolean){
  this.visible=visible;
  if(!visible&&this.pending!==null){this.cancel(this.pending);this.pending=null;}
  if(visible&&this.dirty)this.invalidate();
 }
 dispose(){this.disposed=true;if(this.pending!==null)this.cancel(this.pending);this.pending=null;}
}
