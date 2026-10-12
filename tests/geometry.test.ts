import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildGeometry,checkMesh} from '../packages/geometry-core/geometry';
const p={depth:.18,bevelRadius:.02,bevelSegments:4,curveTolerance:.0004};
const svg=(s:string)=>'<svg xmlns="http://www.w3.org/2000/svg">'+s+'</svg>';
test('rectangle: canonical bounds, bevel, closed oriented mesh',()=>{
 const g=buildGeometry(svg('<rect width="100" height="60"/>'),p);assert.equal(g.parts.length,1);checkMesh(g.parts[0]);
 const pos=g.parts[0].positions;assert.ok(Math.abs(Math.max(...pos.filter((_,i)=>i%3===0))-.5)<1e-6);assert.ok(Math.abs(Math.max(...pos.filter((_,i)=>i%3===2))-.09)<1e-6);
});
test('hole remains open in top cap',()=>{
 const g=buildGeometry(svg('<path fill-rule="evenodd" d="M0 0H100V100H0Z M30 30H70V70H30Z"/>'),p);checkMesh(g.parts[0]);
 const part=g.parts[0];for(let i=0;i<part.indices.length;i+=3){const t=part.indices.slice(i,i+3).map(n=>part.positions.slice(n*3,n*3+3));if(t.every(v=>Math.abs(v[2]-.09)<1e-6)){const x=t.reduce((n,v)=>n+v[0],0)/3,y=t.reduce((n,v)=>n+v[1],0)/3;assert.ok(Math.abs(x)>=.2||Math.abs(y)>=.2);}}
});
test('circle and compound curves generate manifold geometry',()=>{checkMesh(buildGeometry(svg('<circle r="50" cx="50" cy="50"/>'),p).parts[0]);});
test('unsafe and unsupported SVG fail explicitly',()=>{for(const source of ['<script>alert(1)</script>','<text>Hello</text>','<rect width="100" height="100" stroke="red"/>','<image href="https://example.com/x"/>'])assert.throws(()=>buildGeometry(svg(source),p),/unsupported_feature/);});
test('open filled paths are closed for extrusion',()=>{assert.equal(buildGeometry(svg('<path d="M0 0L100 0L100 100L0 100"/>'),p).parts.length,1);});
test('overlapping filled layers remain importable while invalid thickness fails',()=>{assert.equal(buildGeometry(svg('<rect width="100" height="100"/><rect x="50" width="100" height="100"/>'),p).parts.length,2);assert.throws(()=>buildGeometry(svg('<rect width="100" height="2"/>'),p),/invalid_geometry/);});
test('same input produces same geometry and stable parts',()=>{const source=svg('<rect width="100" height="60"/>');const a=buildGeometry(source,p),b=buildGeometry(source,p),c=buildGeometry(source,{...p,depth:.2});assert.equal(a.meshSha256,b.meshSha256);assert.equal(a.parts[0].id,c.parts[0].id);assert.notEqual(a.id,c.id);});
test('disjoint parts and nested transforms survive import',()=>{const g=buildGeometry(svg('<g transform="translate(20 30)"><rect width="20" height="30"/><circle cx="60" cy="15" r="10"/></g>'),p);assert.equal(g.parts.length,2);});
test('common xlink namespace declaration is ignored safely',()=>{
 const source='<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><path d="M0 0H100V100H0Z"/></svg>';
 assert.equal(buildGeometry(source,p).parts.length,1);
});
test('prefixed editor namespaces on descendants do not block geometry',()=>{
 const source='<svg xmlns="http://www.w3.org/2000/svg"><g xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" inkscape:label="mark"><path d="M0 0H100V100H0Z"/></g></svg>';
 assert.equal(buildGeometry(source,p).parts.length,1);
});
test('embedded stylesheet and class attributes are accepted',()=>{
 const source='<svg xmlns="http://www.w3.org/2000/svg"><style>.shape{fill:#fff}</style><path class="shape" d="M0 0H100V100H0Z"/></svg>';
 assert.equal(buildGeometry(source,p).parts.length,1);
});
