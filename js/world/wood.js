// PROCEDURAL WOOD + LEAVES (replaces barkTube / rootGeo from meshes.js, same signatures).
//   barkTube(len,rb,rt,R,opts)   straight-ish trunk/branch along +Y: root flare, buttress lobes, ridged bark furrows, gentle bend, no seam
//   curveTube(points,radius,sides,opts)   tube along any curve (roots, palm trunks)
//   rootGeo(rb,reach,hgt,angle,R)         curved root that arches over the ground and dives into it
//   leafClump(opts)   a ball of real leaf cards (folded along the midrib, drooping, smooth canopy normals)
//   frondGeo(stations)   palm frond with a rachis and pinnate leaflets
// Everything is indexed + smooth-shaded, and has NO uv (Batch deletes them anyway).
import * as T from 'three';
import {vnoise} from '../batch.js';

const lerp=(a,b,t)=>a+(b-a)*t;
const mk=(pos,idx)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g};

/** trunk / branch. Ring angle runs from +z towards +x. Rings wrap around (no duplicated seam vertex) so the normals are smooth all the way round. */
export function barkTube(len,rb,rt,R,{sides=10,rough=.1,flare=true,bend=.05,rings=0}={}){
  const RN=rings||Math.max(6,Math.min(16,Math.ceil(len/.3))),S=sides,ph=R()*50,
    bx=(R()-.5)*2*bend*len,bz=(R()-.5)*2*bend*len,lobes=3+((R()*3)|0),lp=R()*6.283,c=1.6+rb*4,pos=[],idx=[];
  let cx=0,cz=0;
  for(let i=0;i<=RN;i++){
    const t=i/RN,y=(flare&&i===0)?-.22:t*len,yy=Math.max(0,y);                                  // first ring sinks into the ground
    cx=bx*t*t+(vnoise(yy*.5+ph,3.1)-.5)*rb*.5;cz=bz*t*t+(vnoise(yy*.5+ph,9.7)-.5)*rb*.5;       // slow bend + wobble of the centre line
    const r0=lerp(rb,rt,Math.pow(t,.85)),fl=flare?1+.9*Math.exp(-yy/(rb*1.4+.08)):1;           // root flare
    for(let j=0;j<S;j++){
      const a=j/S*6.2832,sa=Math.sin(a),ca=Math.cos(a);
      const lobe=flare?1+.55*Math.exp(-yy/(rb*2.6+.1))*Math.pow(Math.max(0,Math.sin(a*lobes+lp)),2):1;   // buttress lobes at the foot
      const n1=vnoise(sa*c+ph,yy*.65,ca*c+ph),rid=1-Math.abs(2*n1-1),n2=vnoise(sa*c*2.6+ph,yy*2.1,ca*c*2.6+ph);   // stretched noise = vertical furrows
      const r=r0*fl*lobe*(1+rough*2*(rid*.65+n2*.35-.5));
      pos.push(cx+sa*r,y,cz+ca*r)}}
  for(let i=0;i<RN;i++)for(let j=0;j<S;j++){const j1=(j+1)%S,a=i*S+j,b=i*S+j1,c2=(i+1)*S+j,d=(i+1)*S+j1;idx.push(a,b,c2,b,d,c2)}
  const ap=pos.length/3,L=RN*S;pos.push(cx,len+rt*.3,cz);for(let j=0;j<S;j++)idx.push(L+j,L+(j+1)%S,ap);   // rounded top
  return mk(pos,idx)}

/** tube along a list of Vector3. radius: array (one per point) or function(u 0..1). Tip is closed with a point. */
export function curveTube(P,rad,S=6,{noise=0,ph=0}={}){
  const n=P.length,pos=[],idx=[],t=new T.Vector3(),s=new T.Vector3(),nn=new T.Vector3(),ref=new T.Vector3();
  for(let i=0;i<n;i++){
    t.subVectors(P[Math.min(n-1,i+1)],P[Math.max(0,i-1)]).normalize();
    const vert=Math.abs(t.y)>.6;ref.set(vert?1:0,vert?0:1,0);s.crossVectors(ref,t).normalize();nn.crossVectors(t,s);
    const u=i/(n-1),r=typeof rad==='function'?rad(u):rad[i];
    for(let j=0;j<S;j++){const a=j/S*6.2832,ca=Math.cos(a),sa=Math.sin(a),d=1+noise*(vnoise(ca*3+ph,u*8,sa*3+ph)-.5)*2;
      pos.push(P[i].x+(s.x*ca+nn.x*sa)*r*d,P[i].y+(s.y*ca+nn.y*sa)*r*d,P[i].z+(s.z*ca+nn.z*sa)*r*d)}}
  for(let i=0;i<n-1;i++)for(let j=0;j<S;j++){const j1=(j+1)%S,a=i*S+j,b=i*S+j1,c=(i+1)*S+j,d=(i+1)*S+j1;idx.push(a,b,c,b,d,c)}
  t.subVectors(P[n-1],P[n-2]).normalize();const e=P[n-1],r=typeof rad==='function'?rad(1):rad[n-1],ap=pos.length/3,L=(n-1)*S;
  pos.push(e.x+t.x*r*.6,e.y+t.y*r*.6,e.z+t.z*r*.6);for(let j=0;j<S;j++)idx.push(L+j,L+(j+1)%S,ap);
  return mk(pos,idx)}

/** root: leaves the trunk at height hgt, arches outwards and dives under the ground */
export function rootGeo(rb,reach,hgt,a,R){
  const dx=Math.cos(a),dz=Math.sin(a),sx=-dz,sz=dx,N=8,wob=(R()-.5)*.45,P=[],rad=[];
  for(let i=0;i<=N;i++){const t=i/N,dist=rb*.5+reach*t,y=hgt*Math.pow(1-t,1.7)-.18*t,lat=wob*Math.sin(t*3.1)*reach*.25;
    P.push(new T.Vector3(dx*dist+sx*lat,y,dz*dist+sz*lat));rad.push(Math.max(.02,rb*.46*Math.pow(1-t,.9)+.02))}
  return curveTube(P,rad,5,{noise:.18,ph:R()*30})}

/** A clump of leaf cards inside a unit ellipsoid (scale it with the matrix, like softLump).
 *  Each leaf has the same outline as the vine leaves (vines.js): a base, widening then narrowing stations along the midrib, a pointed tip,
 *  ovate (widest near the base), folded up along the midrib, tip curled down. stations: 2 = 8 tris/leaf (lo), 3 = 12 (hi), 4 = 16 (same as the vines).
 *  Vertex normals are blended with the canopy-sphere normal, so the whole clump shades like one soft mass and the leaves only add breakup. */
const LST={2:[.28,.62],3:[.16,.4,.68],4:[.12,.3,.52,.76]};      // station positions along the midrib: widest at ~40% (ovate), then a long taper to the tip
export function leafClump({n=80,size=.3,seed=1,droop=.3,shell=.55,stations=2,thick=0,flat=1}={}){   // flat<1: the clump is a flattened ellipsoid built directly (scale it UNIFORMLY with the matrix, so the leaves are not squashed into shards)
        // thick>0: every leaf gets a back layer (thick*size below the front) = a leaf with real thickness
  let s=(seed*7919+1)|0;const R=()=>{s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
  const SN=Math.max(2,Math.min(4,stations|0)),LT=LST[SN],NV=2+3*SN;
  const pos=[],nor=[],idx=[],V=T.Vector3,dir=new V(),nrm=new V(),ax=new V(),ay=new V(),al=new V(),sd=new V(),up=new V(0,1,0);
  const P=Array.from({length:NV},()=>new V()),N=Array.from({length:NV},()=>new V()),tilt=new Array(NV).fill(0);
  for(let m=0;m<SN;m++){tilt[1+3*m]=-.18;tilt[3+3*m]=.18}
  const tris=[[0,1,2],[0,2,3]];                                                                              // base fan: 0 = base, then L/M/R of each station
  for(let i=0;i<SN-1;i++){const L0=1+3*i,M0=2+3*i,R0=3+3*i,L1=L0+3,M1=M0+3,R1=R0+3;tris.push([L0,L1,M0],[M0,L1,M1],[M0,M1,R0],[R0,M1,R1])}
  {const Ll=1+3*(SN-1),Ml=Ll+1,Rl=Ll+2,tip=NV-1;tris.push([Ll,tip,Ml],[Ml,tip,Rl])}
  for(let k=0;k<n;k++){
    const u=R()*2-1,th=R()*6.2832,rr=Math.sqrt(1-u*u),rad=shell+(1-shell)*Math.sqrt(R());
    dir.set(rr*Math.cos(th),u,rr*Math.sin(th));
    nrm.set(dir.x,dir.y/flat,dir.z).normalize();nrm.set(nrm.x+(R()-.5)*.3,nrm.y+(R()-.5)*.3,nrm.z+(R()-.5)*.3).normalize();   // lies ON the surface like a roof shingle
    al.set(0,-1,0).addScaledVector(nrm,nrm.y);                                                              // points down the slope, so the leaves overlap and look connected
    if(al.lengthSq()<.05){const f=R()*6.2832;al.set(Math.cos(f),0,Math.sin(f));al.addScaledVector(nrm,-al.dot(nrm))}
    al.normalize();sd.crossVectors(nrm,al);{const g=(R()-.5)*2.2,cg=Math.cos(g),sg=Math.sin(g);al.multiplyScalar(cg).addScaledVector(sd,sg)}
    al.y-=droop*.3*(.4+R()*.6);al.addScaledVector(nrm,-al.dot(nrm)*.9).normalize();
    sd.crossVectors(nrm,al).normalize();nrm.crossVectors(al,sd).normalize();
    const L=size*1.6*(.8+R()*.4),W=L*.32*(.9+R()*.2),cx=dir.x*rad,cy=dir.y*rad*flat,cz=dir.z*rad,o=pos.length/3;
    const set=(i,a,b,c)=>P[i].set(cx+al.x*a+sd.x*b+nrm.x*c,cy+al.y*a+sd.y*b+nrm.y*c,cz+al.z*a+sd.z*b+nrm.z*c);
    set(0,0,0,0);
    for(let m=0;m<SN;m++){const t=LT[m],w=W*Math.sin(Math.PI*Math.pow(t,.65))*(1-.1*t),a=L*t,cv=-.14*L*t*t,lift=w*.28,sag=w*.1;   // ovate outline, folded up at the midrib
      set(1+3*m,a,-w,cv-sag);set(2+3*m,a,0,cv+lift);set(3+3*m,a,w,cv-sag)}
    set(NV-1,L,0,-.2*L);                                                                                    // pointed tip, curled down
    for(let i=0;i<NV;i++){pos.push(P[i].x,P[i].y,P[i].z);N[i].copy(nrm).multiplyScalar(.45).addScaledVector(sd,tilt[i]).addScaledVector(dir,.55).normalize();nor.push(N[i].x,N[i].y,N[i].z)}
    if(thick>0){const th=size*thick;for(let i=0;i<NV;i++){const e=(i===0||i===NV-1)?.3:1;pos.push(P[i].x-nrm.x*th*e,P[i].y-nrm.y*th*e,P[i].z-nrm.z*th*e);   // back layer, lit as the underside
      N[i].copy(nrm).multiplyScalar(-.45).addScaledVector(sd,tilt[i]).addScaledVector(dir,.55).normalize();nor.push(N[i].x,N[i].y,N[i].z)}}
    for(const [a,b,c] of tris){                                                                             // wind the triangles so the face normal = leaf normal
      const e1=P[b].clone().sub(P[a]),e2=P[c].clone().sub(P[a]);e1.cross(e2);
      const fr=e1.dot(nrm)>=0;if(fr)idx.push(o+a,o+b,o+c);else idx.push(o+a,o+c,o+b);
      if(thick>0){const q=o+NV;if(fr)idx.push(q+a,q+c,q+b);else idx.push(q+a,q+b,q+c)}}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(nor,3));g.setIndex(idx);return g}

/** SOLID canopy lump: an icosphere (detail 2 = 320 tris, 3 = 1280) pushed out by random sharp bumps (cauliflower lobes with creases between them)
 *  plus fine noise, flattened (flat<1, flatter underneath). Smooth shaded, no uv, ~10x cheaper than a clump of leaf cards. Scale it UNIFORMLY (or mildly) with the matrix.
 *  Colour it with a grad that darkens the creases (radius < 1) and brightens the bumps, see lgrad in treesBiome.js. */
export function lobeLump({seed=1,detail=2,lobes=14,bump=.28,sharp=7,flat=.62,fine=.07}={}){
  let s=(seed*7919+1)|0;const R=()=>{s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
  const q=(1+Math.sqrt(5))/2,V=[[-1,q,0],[1,q,0],[-1,-q,0],[1,-q,0],[0,-1,q],[0,1,q],[0,-1,-q],[0,1,-q],[q,0,-1],[q,0,1],[-q,0,-1],[-q,0,1]].map(v=>{const l=Math.hypot(...v);return v.map(c=>c/l)});
  let F=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
  for(let d=0;d<detail;d++){const cache=new Map(),mid=(a,b)=>{const k=a<b?a*65536+b:b*65536+a;let m=cache.get(k);if(m===undefined){const p=V[a],r=V[b],v=[p[0]+r[0],p[1]+r[1],p[2]+r[2]],l=Math.hypot(...v);V.push([v[0]/l,v[1]/l,v[2]/l]);m=V.length-1;cache.set(k,m)}return m},N=[];
    for(const[a,b,c]of F){const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);N.push([a,ab,ca],[b,bc,ab],[c,ca,bc],[ab,bc,ca])}F=N}
  const B=[];for(let i=0;i<lobes;i++){const u=R()*1.55-.55,th=R()*6.2832,rr=Math.sqrt(1-u*u);B.push({x:rr*Math.cos(th),y:u,z:rr*Math.sin(th),a:bump*(.45+R()*.8),k:sharp*(.7+R()*.7)})}   // more bumps on the upper half
  const ph=R()*40,pos=[];
  for(const v of V){let r=0;for(const b of B)r+=b.a*Math.exp(b.k*(v[0]*b.x+v[1]*b.y+v[2]*b.z-1));r=1+.45*Math.tanh(r/.45);   // soft cap: overlapping bumps never make spikes
   
    r+=(vnoise(v[0]*3.1+ph,v[1]*3.1,v[2]*3.1+ph)-.5)*2*fine;r*=.86;
    pos.push(v[0]*r,v[1]*r*(v[1]<0?flat*.7:flat),v[2]*r)}
  const idx=[];for(const f of F)idx.push(f[0],f[1],f[2]);
  return mk(pos,idx)}

/** palm frond: x = length 0..1 (droops), z = width. A thin midrib ribbon and pairs of pointed leaflets that sweep forward and hang down. */
export function frondGeo(M=12){
  const pos=[],idx=[],ny=t=>-.45*t*t,V=(x,y,z)=>{pos.push(x,y,z);return pos.length/3-1};
  for(let i=0;i<M;i++){const t0=i/M,t1=(i+1)/M,w0=.014*(1-t0*.7),w1=.014*(1-t1*.7),a=V(t0,ny(t0),-w0),b=V(t0,ny(t0),w0),c=V(t1,ny(t1),-w1),d=V(t1,ny(t1),w1);idx.push(a,b,c,b,d,c)}
  for(let i=0;i<M;i++){const t0=.06+.92*i/M,len=.05+.17*Math.sin(Math.PI*Math.min(1,t0*.85+.1)),dx=.9/M*.9;
    for(const sg of[-1,1]){const b0=V(t0,ny(t0),0),b1=V(t0+dx,ny(t0+dx),0),tip=V(t0+dx+len*.5,ny(t0+dx)-len*.4,sg*len);
      if(sg>0)idx.push(b0,tip,b1);else idx.push(b0,b1,tip)}}
  return mk(pos,idx)}
