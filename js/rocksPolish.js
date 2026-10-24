// POLISHED ROCKS for the 5v5 arena: smooth, high-resolution boulders instead of faceted low-poly ones.
// Each rock starts as a dense sphere and is shaped by (1) low-frequency lumps, (2) a handful of soft "chisel" planes that give it
// weathered broken faces with rounded edges, (3) two octaves of fine surface roughness + horizontal strata, (4) a flat base so it
// sits on the ground. Normals are smooth (indexed mesh, computeVertexNormals). Colour is baked per vertex: strata bands, darker
// crevices near the base, moss on the upward-facing surfaces. Same call style as addRock() in rocks.js, plus a ground height.
import * as T from 'three';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {mat4,vnoise,fbm3} from './batch.js';

const smooth=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)};
const lcg=s=>()=>((s=(s*1664525+1013904223)>>>0)/4294967296);
const softPlus=(d,k)=>Math.log(1+Math.exp(d*k))/k;                      // soft ReLU: rounds the chisel edges
const GREY=['#8b95a1','#7f8a97','#968f86','#858f8b','#9a9488','#78828c'];

function makeRock(detail,seed){
  const r=lcg(seed*977+13);
  let g=new T.IcosahedronGeometry(1,detail);g.deleteAttribute('uv');g.deleteAttribute('normal');g=mergeVertices(g);   // indexed => smooth shading
  const planes=[],np=6+((r()*3)|0);
  for(let i=0;i<np;i++){const a=r()*6.283,y=r()*2-1,s=Math.sqrt(1-y*y);planes.push([Math.cos(a)*s,y,Math.sin(a)*s,.55+r()*.28])}
  const p=g.attributes.position,v=new T.Vector3();
  for(let i=0;i<p.count;i++){
    v.fromBufferAttribute(p,i).normalize();
    const n1=fbm3(v.x*1.4+seed,v.y*1.4,v.z*1.4)-.5,f=1+n1*.55;                                                        // big lumps
    let x=v.x*f,y=v.y*f,z=v.z*f;
    for(const [nx,ny,nz,c] of planes){const d=x*nx+y*ny+z*nz-c;if(d>-.3){const cut=softPlus(d,14)*.92;x-=nx*cut;y-=ny*cut;z-=nz*cut}}   // weathered broken faces
    const len=Math.hypot(x,y,z)||1,rough=(vnoise(x*4.2+seed,y*4.2,z*4.2)-.5)*.07+(vnoise(x*9+seed,y*9,z*9)-.5)*.025+Math.sin(y*11+n1*6)*.012;
    const k=1+rough/len;x*=k;y*=k;z*=k;                                                                              // fine roughness + strata ripples
    if(y<-.5)y=-.5+(y+.5)*.25;                                                                                       // flat-ish base
    p.setXYZ(i,x,y,z)}
  g.computeVertexNormals();return g}

const CACHE={};
const rockGeo=(detail,variant)=>CACHE[detail+'_'+variant]||(CACHE[detail+'_'+variant]=makeRock(detail,variant*7+detail*31+3));

/** B: Batch, R: rng, (x,z): position, r: radius, moss: bool, y: ground height under the rock */
export function addRockPolished(B,R,x,z,r,moss=true,y=0){
  const detail=r>1.25?4:r>.5?3:r>.18?2:1,v=(R()*3)|0,col=GREY[(R()*GREY.length)|0],sy=.7+R()*.25,
    m=mat4(x,y+r*sy*.42,z,r*(.95+R()*.25),r*sy,r*(.9+R()*.25),(R()-.5)*.2,R()*6.28,(R()-.5)*.2);
  B.add('rock',rockGeo(detail,v),m,col,{varS:1.6,varA:.28,
    grad:(px,py)=>(.88+.1*Math.sin(py*8+px*2.5))*(.62+.5*smooth(-.55,.3,py)),                                        // strata + darker base
    moss:moss?{col:'#4f8f3f',fn:(px,py,pz,nx,ny)=>smooth(.45,.85,ny)*.85*smooth(-.2,.3,py)}:null});
}