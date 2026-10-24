// Battle damage for the soldiers, all generated procedurally (no textures, no models):
//  * branches: tapered tubes along a jittered curve, side twigs (recursive), leaves in pairs + a terminal cluster
//  * leaves: a grid mesh with a folded midrib, a cupped blade and a drooping tip, per-vertex colour (midrib lighter, tip darker)
//  * rips: jagged holes with a frayed lighter edge,  shreds: torn cloth strips that sway
// Static pieces are merged into one mesh per parent; pieces on the cloak follow the cloth particles.
import * as T from 'three';
import {mix} from './blocks.js';
import {hoodRest,HOOD_CU} from './hood.js';

export const FOLIAGE_MAT=new T.MeshStandardMaterial({vertexColors:true,roughness:.88,side:T.DoubleSide});
export const DECAL_MAT=new T.MeshStandardMaterial({vertexColors:true,roughness:1,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
const Y=new T.Vector3(0,1,0),Zv=new T.Vector3(0,0,1),lerp=(a,b,t)=>a+(b-a)*t;
const rng=s=>()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};

class GB{constructor(){this.p=[];this.c=[];this.i=[]}
  vert(v,col){this.p.push(v.x,v.y,v.z);this.c.push(col.r,col.g,col.b);return this.p.length/3-1}
  tri(a,b,c){this.i.push(a,b,c)}
  geo(){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(this.p,3));g.setAttribute('color',new T.Float32BufferAttribute(this.c,3));g.setIndex(this.i);g.computeVertexNormals();return g}}

function addTube(B,pts,r0,r1,col,seg=5){
  const N=pts.length,rings=[],t=new T.Vector3(),b=new T.Vector3(),nrm=new T.Vector3(0,0,1);
  for(let i=0;i<N;i++){t.subVectors(pts[Math.min(i+1,N-1)],pts[Math.max(i-1,0)]).normalize();
    nrm.addScaledVector(t,-nrm.dot(t));if(nrm.lengthSq()<1e-6)nrm.set(1,0,0).addScaledVector(t,-t.x);nrm.normalize();b.crossVectors(t,nrm);
    const r=lerp(r0,r1,i/(N-1)),ring=[];
    for(let j=0;j<seg;j++){const a=j/seg*6.2832,v=pts[i].clone().addScaledVector(nrm,Math.cos(a)*r).addScaledVector(b,Math.sin(a)*r);ring.push(B.vert(v,col.clone().multiplyScalar(.82+.22*((i+j)%2))))}
    rings.push(ring)}
  for(let i=0;i<N-1;i++)for(let j=0;j<seg;j++){const a=rings[i][j],c=rings[i][(j+1)%seg],d=rings[i+1][j],e=rings[i+1][(j+1)%seg];B.tri(a,d,c);B.tri(c,d,e)}
}
// leaf: 5 rows x 3 columns (left edge, midrib, right edge) -> tapered outline, folded along the midrib, drooping tip
function addLeaf(B,o,axis,roll,len,wid,col){
  const y=axis.clone().normalize(),ref=Math.abs(y.y)<.9?Y:new T.Vector3(1,0,0),x=new T.Vector3().crossVectors(ref,y).normalize(),z=new T.Vector3().crossVectors(y,x),
    cr=Math.cos(roll),sr=Math.sin(roll),x2=x.clone().multiplyScalar(cr).addScaledVector(z,sr),z2=z.clone().multiplyScalar(cr).addScaledVector(x,-sr),R=5,ids=[],c=new T.Color();
  for(let r=0;r<R;r++){const t=r/(R-1),w=wid*Math.sin(Math.PI*Math.pow(t,.7))*(1-.25*t)+.002;
    for(let u=-1;u<=1;u++){const v=o.clone().addScaledVector(y,t*len).addScaledVector(x2,u*w).addScaledVector(z2,Math.abs(u)*w*.35-t*t*len*.22);
      c.copy(col).lerp(new T.Color('#ffffff'),u===0?.16:0).multiplyScalar(1-.2*t);ids.push(B.vert(v,c))}}
  for(let r=0;r<R-1;r++)for(let k=0;k<2;k++){const a=r*3+k;B.tri(ids[a],ids[a+3],ids[a+1]);B.tri(ids[a+1],ids[a+3],ids[a+4])}
}
function grow(B,rand,o){
  const n=6,pts=[o.p.clone()],d=o.d.clone().normalize();
  for(let i=0;i<n;i++){d.x+=(rand()-.5)*.5;d.y+=(rand()-.5)*.4-.03;d.z+=(rand()-.5)*.5;d.normalize();pts.push(pts[i].clone().addScaledVector(d,o.len/n))}
  addTube(B,pts,o.r,o.r*.25,o.bark);
  const dirAt=i=>pts[Math.min(i+1,n)].clone().sub(pts[i]).normalize(),pickLeaf=()=>o.leaf[(rand()*o.leaf.length)|0];
  for(let i=2;i<=n;i+=o.depth>0?1:2){const dd=dirAt(i-1),side=new T.Vector3().crossVectors(dd,Y).normalize();
    for(const sg of[-1,1]){const ax=dd.clone().multiplyScalar(.6).addScaledVector(side,sg*.8).add(new T.Vector3(0,.15,0));
      addLeaf(B,pts[i],ax,rand()*6.28,o.sc*(.22+rand()*.1),o.sc*(.085+rand()*.04),pickLeaf())}}
  for(let k=0;k<2;k++)addLeaf(B,pts[n],dirAt(n-1).add(new T.Vector3(rand()-.5,rand()*.3,rand()-.5)),rand()*6.28,o.sc*(.24+rand()*.08),o.sc*.1,pickLeaf());
  if(o.depth>0)[2,4].forEach(i=>{const dd=dirAt(i),a=(rand()<.5?-1:1)*(.7+rand()*.4),side=new T.Vector3().crossVectors(dd,Y).normalize();
    grow(B,rand,{...o,p:pts[i],d:dd.clone().multiplyScalar(Math.cos(a)).addScaledVector(side,Math.sin(a)),len:o.len*.55,r:o.r*.55,depth:o.depth-1})});
}
export function foliageGeo(rand,leaf,bark,{len=.7,branches=2,sc=1,depth:dp=1}={}){
  const B=new GB();for(let i=0;i<branches;i++){const a=rand()*6.28,tilt=.15+rand()*.7;
    grow(B,rand,{p:new T.Vector3(0,0,0),d:new T.Vector3(Math.sin(a)*tilt,1,Math.cos(a)*tilt),len:len*(.8+rand()*.4),r:.022*sc,depth:dp,leaf,bark,sc})}
  return B.geo();
}
// jagged hole: dark underlayer + lighter frayed rim (one decal geometry, vertex colours)
export function ripGeo(rand,w,h,under,edge){
  const B=new GB(),n=12,mk=(k,z,col)=>{const c=B.vert(new T.Vector3(0,0,z),col),ids=[];
    for(let i=0;i<n;i++){const a=i/n*6.2832,r=(i%2?.55+rand()*.25:.9+rand()*.35)*k;ids.push(B.vert(new T.Vector3(Math.cos(a)*w*r,Math.sin(a)*h*r,z),col))}
    for(let i=0;i<n;i++)B.tri(c,ids[i],ids[(i+1)%n])};
  const r0=rand;mk(1.2,0,edge);mk(.92,.004,under);return B.geo();
}
// torn cloth strip hanging from y=0 down to -len, ragged edges and a jagged hem
export function shredGeo(rand,len,w){
  const B=new GB(),c=new T.Color('#ffffff'),R=6,rows=[];
  for(let r=0;r<R;r++){const t=r/(R-1),ww=w*(1-.55*t)*(.8+rand()*.4),y=-t*len*(r===R-1?1:.92+rand()*.08),sk=(rand()-.5)*.05;
    rows.push([B.vert(new T.Vector3(-ww+sk,y,(rand()-.5)*.01),c),B.vert(new T.Vector3(ww+sk,y-rand()*len*.1,(rand()-.5)*.01),c)])}
  for(let r=0;r<R-1;r++){B.tri(rows[r][0],rows[r+1][0],rows[r][1]);B.tri(rows[r][1],rows[r+1][0],rows[r+1][1])}
  return B.geo();
}
const merge=list=>{if(!list.length)return null;let n=0;list.forEach(g=>n+=g.attributes.position.count);
  const p=new Float32Array(n*3),c=new Float32Array(n*3),idx=[];let o=0;
  list.forEach(g=>{p.set(g.attributes.position.array,o*3);c.set(g.attributes.color.array,o*3);const ix=g.index.array;for(let i=0;i<ix.length;i++)idx.push(ix[i]+o);o+=g.attributes.position.count});
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(p,3));g.setAttribute('color',new T.BufferAttribute(c,3));g.setIndex(idx);g.computeVertexNormals();return g};

const _a=new T.Vector3(),_b=new T.Vector3(),_n=new T.Vector3(),_q=new T.Quaternion(),_q2=new T.Quaternion();

export function dressSoldier({hooded=true,pal,seed,cat,head,tg,bodyPos,bodyScale,cloth,cols,rows,shredMat}){
  const R=rng(Math.floor(seed*977)+13),leaf=[pal[1],pal[3],mix(pal[1],'#e9d36a',.35),mix(pal[0],'#ffffff',.15),'#7a5a2a'].map(c=>new T.Color(c)),bark=new T.Color(mix(pal[2],'#5a3a1c',.6)),
    under=new T.Color(mix(pal[2],'#000000',.6)),edge=new T.Color('#cbbd96');
  const place=(geo,pos,dir,s=1,roll=0)=>{_q.setFromUnitVectors(Y,dir.clone().normalize());_q2.setFromAxisAngle(Y,roll);_q.multiply(_q2);
    return geo.applyMatrix4(new T.Matrix4().compose(pos,_q,new T.Vector3(s,s,s)))};
  const decal=(geo,pos,n)=>{_q.setFromUnitVectors(Zv,n.clone().normalize());_q2.setFromAxisAngle(Zv,R()*6.28);_q.multiply(_q2);return geo.applyMatrix4(new T.Matrix4().compose(pos,_q,new T.Vector3(1,1,1)))};
  // ---- torso surface samples (position + outward normal) from the actual tunic geometry
  const tp=tg.attributes.position,tn=tg.attributes.normal,sample=f=>{for(let k=0;k<300;k++){const i=(R()*tp.count)|0,
    v=new T.Vector3(tp.getX(i)*bodyScale.x+bodyPos.x,tp.getY(i)*bodyScale.y+bodyPos.y,tp.getZ(i)*bodyScale.z+bodyPos.z),
    n=new T.Vector3(tn.getX(i)/bodyScale.x,tn.getY(i)/bodyScale.y,tn.getZ(i)/bodyScale.z).normalize();if(f(v,n))return{v,n}}return null};
  const tuftsT=[],ripsT=[],tuftsH=[],ripsH=[];
  const tuft=(arr,s,pos,n,o)=>{if(!s)return;const g=foliageGeo(R,leaf,bark,o);arr.push(place(g,pos.clone().addScaledVector(s.n||n,.02),(s.n||n).clone().multiplyScalar(.8).add(new T.Vector3(0,.35,0)),1,R()*6))};
  // torso: ragged branches poking out of the back + shoulders, tufts on the chest/sides, torn holes
  for(let i=0;i<3;i++){const s=sample((v,n)=>n.z<-.2&&v.y>-1.1);if(s)tuftsT.push(place(foliageGeo(R,leaf,bark,{len:.68,branches:2,sc:1.05}),s.v.clone().addScaledVector(s.n,.02),s.n.clone().multiplyScalar(.7).add(new T.Vector3(0,.55,0)),1,R()*6))}
  for(let i=0;i<3;i++){const s=sample((v,n)=>Math.abs(n.y)<.6&&n.z>-.3&&v.y<-.8);if(s)tuftsT.push(place(foliageGeo(R,leaf,bark,{len:.45,branches:1,sc:.9}),s.v.clone().addScaledVector(s.n,.02),s.n.clone().multiplyScalar(.8).add(new T.Vector3(0,.3,0)),1,R()*6))}
  for(let i=0;i<4;i++){const s=sample((v,n)=>Math.abs(n.y)<.55&&n.z>-.5);if(s)ripsT.push(decal(ripGeo(R,.09+R()*.08,.07+R()*.08,under,edge),s.v.clone().addScaledVector(s.n,.014),s.n))}
  // hood dome: pinned rows only, so these stay glued to the head
  const hr=hoodRest(),cu=HOOD_CU+1,cols_=[...Array(cu).keys()];
  const hv=(r,c)=>hr[r*cu+c],hn=p=>p.clone().sub(new T.Vector3(0,.15,0)).normalize();
  if(hooded){   // hood-mounted pieces only exist on hooded soldiers
  for(let i=0;i<2;i++){const p=hv(4+((R()*2)|0),3+((R()*(cu-6))|0));tuftsH.push(place(foliageGeo(R,leaf,bark,{len:.5,branches:1,sc:.9}),p.clone().addScaledVector(hn(p),.02),hn(p).multiplyScalar(.8).add(new T.Vector3(0,.35,0)),1,R()*6))}
  {const p=hv(7,(cu/2)|0);tuftsH.push(place(foliageGeo(R,leaf,bark,{len:.62,branches:2,sc:1}),p.clone(),new T.Vector3(.1,1,-.35),1,0))}   // branch sprouting from the crown
  {const p=hv(4,2+((R()*2)|0));ripsH.push(decal(ripGeo(R,.1,.08,under,edge),p.clone().addScaledVector(hn(p),.012),hn(p)))}
  }
  const mk=(list,mat,parent)=>{const g=merge(list);if(!g)return;const m=new T.Mesh(g,mat);m.frustumCulled=false;parent.add(m)};
  mk(tuftsT,FOLIAGE_MAT,cat);mk(ripsT,DECAL_MAT,cat);mk(tuftsH,FOLIAGE_MAT,head);mk(ripsH,DECAL_MAT,head);
  // ---- cloak: pieces ride on cloth particles (position + surface normal every physics step)
  const fol=[],addF=(geo,mat,r,c,off,kind,roll)=>{const m=new T.Mesh(geo,mat);m.frustumCulled=false;cat.add(m);fol.push({m,r,c,off,kind,roll})};
  [[3,2],[4,6],[2,5]].forEach(([r,c])=>addF(foliageGeo(R,leaf,bark,{len:.5,branches:1,sc:.9}),FOLIAGE_MAT,Math.min(r,rows-1),c,.02,0,R()*6));
  [[2,1],[3,7],[4,3]].forEach(([r,c])=>addF(ripGeo(R,.12,.1,under,edge),DECAL_MAT,Math.min(r,rows-1),c,.014,1,R()*6));
  const id=(r,c)=>r*cols+c,Zq=new T.Quaternion();
  const follow=()=>{const lp=cloth.lp;fol.forEach(f=>{const{r,c}=f;
    _a.subVectors(lp[id(r,Math.min(c+1,cols-1))],lp[id(r,Math.max(c-1,0))]);_b.subVectors(lp[id(Math.min(r+1,rows-1),c)],lp[id(Math.max(r-1,0),c)]);_n.crossVectors(_a,_b).normalize();   // outward normal
    f.m.position.copy(lp[id(r,c)]).addScaledVector(_n,f.off);
    if(f.kind)_q.setFromUnitVectors(Zv,_n);else _q.setFromUnitVectors(Y,_a.copy(_n).multiplyScalar(.75).add(new T.Vector3(0,-.4,0)).normalize());
    _q2.setFromAxisAngle(f.kind?Zv:Y,f.roll);f.m.quaternion.copy(_q).multiply(_q2)})};
  // ---- torn cloth strips hanging off the hem and the shoulders
  const shreds=[],addS=(x,y,z,len,w)=>{const piv=new T.Group();piv.position.set(x,y,z);cat.add(piv);piv.add(new T.Mesh(shredGeo(R,len,w),shredMat));shreds.push({piv,ph:R()*6})};
  for(let i=0;i<6;i++){const a=R()*6.28;addS(Math.cos(a)*.52,-1.5,Math.sin(a)*.46,.3+R()*.3,.1+R()*.05)}
  [-1,1].forEach(s=>addS(s*.52,-.74,.02,.28+R()*.12,.09));
  const sway=(time,amp,rvel)=>shreds.forEach(s=>s.piv.rotation.set(Math.sin(time*2.4+s.ph)*.1-amp*.45-rvel*.01,0,Math.sin(time*1.7+s.ph)*.08));
  follow();
  return{follow,sway};
}