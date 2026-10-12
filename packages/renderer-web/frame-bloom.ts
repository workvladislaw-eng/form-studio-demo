import {Vector2,type WebGLRenderer,type WebGLRenderTarget} from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';

// Blur is measured in frame coordinates, not in output pixels. Only the soft
// halo uses this fixed working resolution; scene geometry stays at full 4K.
export const BLOOM_LONG_EDGE=960;
export function bloomSize(width:number,height:number):[number,number] {
 const scale=BLOOM_LONG_EDGE/Math.max(1,width,height);
 return [Math.max(1,Math.round(width*scale)),Math.max(1,Math.round(height*scale))];
}
export class FrameBloomPass extends UnrealBloomPass {
 reuseFrame=false;
 private cachedQuad:FullScreenQuad;
 constructor(){
  super(new Vector2(1,1),.12,.15,1);
  // A small blue contribution below the white HDR threshold keeps cool
  // reflections softly luminous without raising the whole black background.
  this.materialHighPassFilter.fragmentShader=this.materialHighPassFilter.fragmentShader.replace(
   'gl_FragColor = mix( outputColor, texel, alpha );',
   'float blueAccent = smoothstep(0.12, 0.65, texel.b) * smoothstep(0.04, 0.22, texel.b - texel.r) * 0.22; gl_FragColor = mix( outputColor, texel, max(alpha, blueAccent) );'
  );
  this.cachedQuad=new FullScreenQuad(this.blendMaterial);
 }
 override render(renderer:WebGLRenderer,writeBuffer:WebGLRenderTarget,readBuffer:WebGLRenderTarget,deltaTime:number,maskActive:boolean):void {
  if(!this.reuseFrame){super.render(renderer,writeBuffer,readBuffer,deltaTime,maskActive);return;}
  const autoClear=renderer.autoClear;
  try {renderer.autoClear=false;renderer.setRenderTarget(readBuffer);this.cachedQuad.render(renderer);}
  finally {renderer.autoClear=autoClear;}
 }
 override dispose():void {this.cachedQuad.dispose();super.dispose();}
 override setSize(width:number,height:number):void {
  if(!this.reuseFrame)super.setSize(...bloomSize(width,height));
 }
}
