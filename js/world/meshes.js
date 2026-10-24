// PROCEDURAL MESH HELPERS (own file): pure geometry builders shared by trees and cacti. Everything returns an indexed BufferGeometry with position / normal / uv,
// so it can be pushed into a Batch exactly like the stock three.js geometries.
//   mk(pos,idx)                          -> geometry from flat arrays (normals computed)
//   loft(P,R,{sides,ribs,amp,rough,seed,cap}) -> {geo,rings}   a smooth tube along the polyline P ([x,y,z]...) with radius R[i] at every point.
//                                           ribs/amp = pleats (cactus), rough = bumpy surface (bark). The frame is parallel-transported, so bends never twist or pinch.
//   wander(R,amp,freq)                   -> t=>[dx,dz]  smooth random sideways drift (0 at t=0), used so no trunk / limb is a straight, hard-coded pipe
//   trunkGeo(len,rb,rt,R,opts)           -> {geo,at(t)}  noisy, leaning, irregular trunk that starts BURIED under the ground (flare melts into the soil)
//   limbGeo(p0,dir,len,r0,r1,R,opts)     -> {geo,at(t),end,endDir,rEnd}  a branch that wanders, reaches for the light (up) or sags (droop)
//   rootGeo(rb,reach,hgt,angle,R,opts)   -> one root: leaves the trunk low, arches over the ground and dives into the soil (the far half is buried)
//   barkTube(len,rb,rt,R,opts)           -> kept for old callers: trunkGeo(...).geo
import * as T from 'three';

export function mk(pos,idx){
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(pos.length/3*2),2));
  g.setIndex(idx);g.computeVertexNormals();return g}

// smooth, seam-free surface noise (integer frequencies around the ring), -1..1
const nz=(a,y,s)=>Math.sin(a*2+y*1.7+s)*.5+Math.sin(a*3-y*2.6+s*1.9)*.3+Math.sin(a*5+y*4.1+s*.7)*.2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function loft(P,Rd,o={}){
  const {sides=10,ribs=0,amp=0,rough=0,seed=0,cap=false}=o,n=P.length,pos=[],idx=[],rings=[];
  const t=new T.Vector3(),nn=new T.Vector3(),bb=new T.Vector3();
  for(let i=0;i<n;i++){
    const A=P[Math.max(0,i-1)],B=P[Math.min(n-1,i+1)];t.set(B[0]-A[0],B[1]-A[1],B[2]-A[2]);if(t.lengthSq()<1e-12)t.set(0,1,0);t.normalize();
    if(i===0){if(Math.abs(t.x)<.8)nn.set(1,0,0);else nn.set(0,0,1)}
    nn.addScaledVector(t,-nn.dot(t));if(nn.lengthSq()<1e-9)nn.set(0,0,1).addScaledVector(t,-t.z);nn.normalize();   // parallel transport of the previous normal
    bb.crossVectors(t,nn);
    rings.push({p:new T.Vector3(P[i][0],P[i][1],P[i][2]),n:nn.clone(),b:bb.clone(),t:t.clone(),r:Rd[i]});
    for(let j=0;j<sides;j++){
      const a=j/sides*6.283185307;let m=1;
      if(ribs)m-=amp*(1-Math.abs(Math.cos(ribs*a/2)));          // crest = 1, valley = 1-amp
      if(rough)m+=rough*nz(a,P[i][1]+P[i][0]*.7,seed);
      const rad=Rd[i]*m,c=Math.cos(a)*rad,s=Math.sin(a)*rad;
      pos.push(P[i][0]+nn.x*c+bb.x*s,P[i][1]+nn.y*c+bb.y*s,P[i][2]+nn.z*c+bb.z*s)}}
  for(let i=0;i<n-1;i++)for(let j=0;j<sides;j++){
    const a=i*sides+j,a1=i*sides+(j+1)%sides,b=a+sides,b1=a1+sides;idx.push(a,a1,b,a1,b1,b)}   // outward facing
  if(cap){const c=pos.length/3,L=P[n-1],last=(n-1)*sides;pos.push(L[0],L[1],L[2]);
    for(let j=0;j<sides;j++)idx.push(c,last+j,last+(j+1)%sides)}
  return{geo:mk(pos,idx),rings}}

/** smooth random drift: sum of 3 sines with random phases / frequencies. f(t) = [dx,dz] for t in 0..1, always 0 at t=0 so the foot stays put. */
export function wander(R,amp=1,freq=1){
  const a=[];for(let i=0;i<3;i++)a.push([R()*6.283,R()*6.283,(.7+R()*1.1)*freq*(1+i*.9),.55/(1+i*.8)]);
  return t=>{let x=0,z=0;for(const[p,q,f,w]of a){x+=Math.sin(t*f*3.1416+p)*w;z+=Math.sin(t*f*3.1416+q)*w}return[x*amp*t,z*amp*t]}}

/** Trunk standing on y=0, growing along +y. It starts `bury` units UNDER the ground and is wider there, so it grows out of the soil instead of sitting on it.
 *  lean = sideways lean at the top, wob = random sideways wobble, flare = how much the foot widens, sides = faces around, rough = bark bumps.
 *  Rings are spaced irregularly and every ring gets its own small radius noise, so two trunks are never alike. */
export function trunkGeo(len,rb,rt,R,o={}){
  const {sides=8,rough=.1,lean=0,wob=.25,flare=.35,bury=.35,tilt=0}=o,seed=R()*10,W=wander(R,wob,1+R()*.8),ang=R()*6.283,lx=Math.cos(ang),lz=Math.sin(ang),ys=[-bury];
  for(const y of[.1,.32,.65])if(y<len*.3)ys.push(y+(R()-.5)*.08);
  for(let y=ys[ys.length-1]+.7+R()*.5;y<len-.4;y+=.7+R()*.6)ys.push(y);
  ys.push(len);
  const ph=[R()*6,R()*6],pt=y=>{const t=clamp(y/len,0,1),w=W(t);return[lx*lean*t*t+lx*tilt*t+w[0],y,lz*lean*t*t+lz*tilt*t+w[1]]};
  const radius=y=>{const t=clamp(y/len,0,1),base=rb+(rt-rb)*t,fl=1+flare*Math.pow(Math.max(0,1-Math.max(0,y)/(.4+rb*1.7)),2)*(y<0?1.25:1);return base*fl};
  const P=ys.map(pt),Rd=ys.map((y,i)=>radius(y)*(1+.06*Math.sin(i*2.1+ph[0])+.035*Math.sin(i*4.7+ph[1])));
  const geo=loft(P,Rd,{sides,rough,seed,cap:true}).geo;
  const at=t=>{const y=clamp(t,0,1)*len,p=pt(y),q=pt(Math.min(len,y+.2)),d=new T.Vector3(q[0]-p[0],q[1]-p[1],q[2]-p[2]).normalize();
    return{x:p[0],y:p[1],z:p[2],r:radius(y),dx:d.x,dy:d.y,dz:d.z}};
  return{geo,at}}

/** A branch from p0 in direction dir. Every step the direction drifts randomly (noise), is pulled towards the sky (up) or sags (droop).
 *  Local tree coordinates, so it can be pushed with an identity matrix. at(t) gives position / direction / radius to hang sub-branches on. */
export function limbGeo(p0,d0,len,r0,r1,R,o={}){
  const {sides=5,up=0,noise=.3,droop=0,rough=.05}=o,K=Math.max(3,Math.ceil(len/.5)),st=len/K,ph=[R()*6,R()*6];
  const d=new T.Vector3(d0[0],d0[1],d0[2]).normalize(),p=new T.Vector3(p0[0],p0[1],p0[2]),P=[],Rd=[],D=[];
  for(let i=0;i<=K;i++){
    const t=i/K;P.push([p.x,p.y,p.z]);D.push([d.x,d.y,d.z]);Rd.push((r0+(r1-r0)*t)*(1+.08*Math.sin(i*2.3+ph[0])));
    d.x+=Math.sin(i*1.3+ph[0])*noise*.45+(R()-.5)*noise*.5;d.z+=Math.sin(i*1.1+ph[1])*noise*.45+(R()-.5)*noise*.5;
    d.y+=up*.3*(1-t*.5)-droop*(.15+t*.4);d.normalize();p.addScaledVector(d,st)}
  const geo=loft(P,Rd,{sides,rough,seed:R()*10,cap:true}).geo;
  const at=t=>{const i=clamp(Math.round(t*K),0,K);return{x:P[i][0],y:P[i][1],z:P[i][2],r:Rd[i],dx:D[i][0],dy:D[i][1],dz:D[i][2]}};
  return{geo,at,end:P[K],endDir:D[K],rEnd:Rd[K]}}

/** A root: starts INSIDE the trunk near the ground, humps over the soil for `reach` units, wanders sideways (curl) and dives `dive` units into the ground, so
 *  the far end is buried. hgt = height of the hump at the trunk, thick = radius relative to the trunk. */
export function rootGeo(rb,reach,hgt,angle,R,o={}){
  const {thick=.55,curl=.5,dive=.7}=o,K=8,ph=R()*6,P=[],Rd=[],r0=rb*thick;
  for(let i=0;i<K;i++){
    const t=i/(K-1),dist=rb*.2+reach*t,a=angle+Math.sin(t*3+ph)*curl*t*.6,y=hgt*Math.pow(1-t,1.4)-dive*1.5*t*t*t+.05;
    P.push([Math.cos(a)*dist,y,Math.sin(a)*dist]);Rd.push(r0*(1-.78*t)*(1+.1*Math.sin(i*2+ph)))}
  return loft(P,Rd,{sides:5,rough:.08,seed:R()*10,cap:true}).geo}

/** kept for old callers (cactus does not use it) */
export function barkTube(len,rb,rt,R,o={}){return trunkGeo(len,rb,rt,R,{sides:o.sides||8,rough:o.rough??.08,flare:o.flare===false?0:.3,bury:o.flare===false?0:.3}).geo}