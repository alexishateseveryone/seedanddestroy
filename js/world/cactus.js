// CACTUS (own file): procedural saguaro with 0-3 arms + a ribbed barrel cactus, both with spines. Pushed into a Batch ('prop' = rigid).
//   addCactus(B,R,x,y,z,k,q)  -> collision radius        q: 'hi' | 'lo' (far chunks get fewer spines)
// Every part is a lofted tube (meshes.js): the trunk, each arm (one smooth tube that leaves the trunk, bends up in a round elbow and ends in a dome - no more
// cut-off cylinders meeting at a corner) and the barrel. Pleats are real geometry; spines are tiny pyramids on the pleat crests.
import * as T from 'three';
import {mat4} from '../batch.js';
import {loft,mk} from './meshes.js';

const G=['#4f9a4a','#5aa854','#468f44'],pick=(a,R)=>a[(R()*a.length)|0];
const FLOWER=new T.IcosahedronGeometry(1,1),SPINE='#f1e8c6';

/** dome that closes a tube: extra rings that shrink to a point. p = last point, r = radius, steps = rings */
function dome(P,Rd,p,r,steps=4){for(let k=1;k<=steps;k++){const f=k/steps*Math.PI/2;P.push([p[0],p[1]+r*Math.sin(f),p[2]]);Rd.push(r*Math.cos(f))}}

/** spines on the pleat crests of a lofted tube. rings = loft() rings, valid(ring)->bool, gap = distance between spine rows, ribs = number of crests */
function spines(rings,ribs,gap,valid,k,R,three){
  const pos=[],idx=[],pn=new T.Vector3(),u=new T.Vector3(),v=new T.Vector3(),d=new T.Vector3(),base=new T.Vector3();let acc=gap;   // acc=gap: the first valid ring gets a row
  const pyr=(b,dir,len,w)=>{u.crossVectors(dir,pn).normalize();if(u.lengthSq()<.5)u.set(0,0,1).cross(dir).normalize();v.crossVectors(dir,u);
    const o=pos.length/3;
    pos.push(b.x+u.x*w,b.y+u.y*w,b.z+u.z*w, b.x+(-u.x*.5+v.x*.87)*w,b.y+(-u.y*.5+v.y*.87)*w,b.z+(-u.z*.5+v.z*.87)*w, b.x+(-u.x*.5-v.x*.87)*w,b.y+(-u.y*.5-v.y*.87)*w,b.z+(-u.z*.5-v.z*.87)*w,
      b.x+dir.x*len,b.y+dir.y*len,b.z+dir.z*len);
    for(const[a,b2]of[[0,1],[1,2],[2,0]]){idx.push(o+a,o+b2,o+3,o+b2,o+a,o+3)}};                 // both windings: visible from any side
  for(let i=1;i<rings.length-1;i++){const g=rings[i],h=g.p.distanceTo(rings[i-1].p);acc+=h;
    if(!valid(g)||acc<gap)continue;acc=0;
    for(let m=0;m<ribs;m++){const a=m/ribs*6.283185;                                                           // crest angles of the pleats
      pn.copy(g.n).multiplyScalar(Math.cos(a)).addScaledVector(g.b,Math.sin(a));
      base.copy(g.p).addScaledVector(pn,g.r);
      const len=(.085+R()*.04)*k,w=.011*k;
      pyr(base,d.copy(pn),len,w);
      if(three){pyr(base,d.copy(pn).addScaledVector(g.t,.9).normalize(),len*.85,w*.9);pyr(base,d.copy(pn).addScaledVector(g.t,-.9).normalize(),len*.85,w*.9)}}}
  return pos.length?mk(pos,idx):null}

export function addCactus(B,R,x,y,z,k=1,q='hi'){
  const col=pick(G,R),ry=R()*6.283,base=mat4(x,y,z,1,1,1,0,ry,0),put=(geo,c,o)=>B.add('prop',geo,base.clone(),c,o);
  const ribsShade=(px)=>.88+.16*Math.abs(Math.sin(px*14)),hi=q!=='lo',gap=(hi?.2:.38)*k;           // soft vertical shading stripes (the pleats do the rest)

  if(R()<.28){                       // barrel cactus: a ribbed ball that is half sunk into the ground
    const r=(.28+R()*.18)*k,P=[],Rd=[],ph=[.35,.7,1.05,1.4,1.75,2.1,2.45,2.8,Math.PI];
    for(const f of ph){P.push([0,r*.8-r*.85*Math.cos(f),0]);Rd.push(r*Math.sin(f))}
    const {geo,rings}=loft(P,Rd,{sides:36,ribs:12,amp:.1});put(geo,col,{grad:ribsShade});
    const sp=spines(rings,12,gap*.9,g=>g.p.y>r*.3&&g.p.y<r*1.5,k,R,hi);sp&&put(sp,SPINE,{grad:()=>1});
    B.add('prop',FLOWER,base.clone().multiply(mat4(0,r*1.62,0,.07*k,.04*k,.07*k)),'#ff6fa4',{varA:.1});return r}

  // ---- saguaro: pleated trunk + dome
  const h=(1.5+R()*1.4)*k,r=(.17+R()*.05)*k,P=[],Rd=[],ph0=R()*6;
  for(let i=0;i<=7;i++){const t=i/7;P.push([0,t*h,0]);Rd.push(r*(1+.12*Math.pow(1-t,3))*(1+.035*Math.sin(t*9+ph0)))}
  dome(P,Rd,P[P.length-1],r);
  const T0=loft(P,Rd,{sides:33,ribs:11,amp:.1});put(T0.geo,col,{grad:ribsShade});
  let sp=spines(T0.rings,11,gap,g=>g.p.y>.12*k&&g.p.y<h+r*.2,k,R,hi);sp&&put(sp,SPINE,{grad:()=>1});

  // ---- arms: one smooth tube each - out of the trunk, round elbow, up, dome
  const arms=(R()*4)|0;
  for(let i=0;i<arms;i++){
    const side=i%2?1:-1,ay=h*(.35+R()*.3),ah=(.5+R()*.6)*k,ar=r*.72,rho=ar*1.8,reach=r+rho+.12*k,hx=reach-rho,AP=[],AR=[];
    for(const f of[0,.45,1]){AP.push([side*hx*f,ay,0]);AR.push(ar)}                           // horizontal part (starts inside the trunk)
    for(let s=1;s<=5;s++){const th=s/5*Math.PI/2;AP.push([side*(hx+rho*Math.sin(th)),ay+rho-rho*Math.cos(th),0]);AR.push(ar)}   // quarter circle elbow
    for(const f of[.5,1]){AP.push([side*reach,ay+rho+ah*f,0]);AR.push(ar*(1-.06*f))}          // vertical part
    dome(AP,AR,AP[AP.length-1],ar*.94);
    const A=loft(AP,AR,{sides:24,ribs:8,amp:.1});put(A.geo,col,{grad:ribsShade});
    sp=spines(A.rings,8,gap,g=>Math.abs(g.p.x)>r*1.12&&g.p.y<ay+rho+ah+ar*.2,k,R,hi);sp&&put(sp,SPINE,{grad:()=>1})}
  if(R()<.35)B.add('prop',FLOWER,base.clone().multiply(mat4(0,h+r*.9,0,.08*k,.05*k,.08*k)),'#ff6fa4',{varA:.1});
  return r*1.6;
}