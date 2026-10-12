import { parentPort } from 'node:worker_threads';
import { tsImport } from 'tsx/esm/api';
const { buildGeometry }=await tsImport('../../packages/geometry-core/geometry.ts',import.meta.url);
parentPort.on('message',data=>{
 try {parentPort.postMessage({data:buildGeometry(data.svg,data.parameters)});}
 catch(error) {parentPort.postMessage({error:error.message});}
});
