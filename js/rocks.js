// Faceted rocks with strata, darker crevices and moss on the sun-facing planes (baked into vertex colour).
import * as T from 'three';
import {mat4,vnoise} from './batch.js';

const smooth=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)};
const ROCKS=[0,1,2].map(i=>{const g=new T.IcosahedronGeometry(1,2),p=g.attributes.position;
  for(let k=0;k<p.count;k++){const x=p.getX(k),y=p.getY(k),z=p.getZ(k),f=1+.3*(vnoise(x*1.6+i*5,y*1.6,z*1.6)-.5)+.12*(vnoise(x*4+i,y*4,z*4)-.5);p.setXYZ(k,x*f,y*f,z*f)}
  g.computeVertexNormals();return g});            // non-indexed => flat shaded facets
const GREY=['#8b95a1','#7f8a97','#968f86','#858f8b'];
export function addRock(B,R,x,z,r,moss=true){
  const col=GREY[(R()*4)|0],sy=.7+R()*.2,m=mat4(x,r*sy*.55,z,r,r*sy,r*(.9+R()*.25),(R()-.5)*.25,R()*6.28,(R()-.5)*.25);
  B.add('rock',ROCKS[(R()*3)|0],m,col,{varS:1.8,varA:.3,
    grad:(px,py)=>(.9+.12*Math.sin(py*9+px*2))*(.72+.4*smooth(-.9,.2,py)),                    // strata + darker crevices near the base
    moss:moss?{col:'#4f8f3f',fn:(px,py,pz,nx,ny)=>smooth(.5,.85,ny)*.9}:null});               // moss on the upward-facing planes
}