// wlib.js: shared hand-built geometry helpers for the katana / axe / scythe / shotgun (same spirit as PeanutJelly.js and Skybreaker.js).
// No primitives. Everything is one of:
//   grid()   smooth wrapped loft      fn(t,theta,out) -> out.p=[x,y,z], out.c=Color
//   bands()  faceted loft             a closed polygon section swept along the weapon, every polygon edge is its own strip (crisp bevels)
//   lathe()  surface of revolution    around the Y axis (optionally offset), profile [[u,r],...]
//   tube()   swept tube               along a spline
// All helpers work directly in the weapon group's frame: x = sideways, y = -u (weapon points along -Y, grip at the origin), z = up / thickness.
import * as T from 'three';

export const PI=Math.PI,TAU=PI*2;
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t,sm=t=>t*t*(3-2*t);
export const rng=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
export const h2=(x,y)=>{const s=Math.sin(x*127.1+y*311.7)*43758.5453;return s-Math.floor(s)};
export const vn=(x,y)=>{const xi=Math.floor(x),yi=Math.floor(y),xf=sm(x-xi),yf=sm(y-yi);return lerp(lerp(h2(xi,yi),h2(xi+1,yi),xf),lerp(h2(xi,yi+1),h2(xi+1,yi+1),xf),yf)};
export const C=h=>new T.Color(h);
const tc=new T.Color();

// plain-array vectors
export const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
export const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const nrm=a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return[a[0]/l,a[1]/l,a[2]/l]};
export const se=(th,n)=>{const c=Math.cos(th),s=Math.sin(th);return[Math.sign(c)*Math.pow(Math.abs(c),2/n),Math.sign(s)*Math.pow(Math.abs(s),2/n)]};   // rounded-rectangle section (n=2 ellipse, bigger = boxier)
export const cap=(t,e)=>{const x=Math.min(t,1-t)/e;return x>=1?1:Math.sqrt(Math.max(0,1-(1-x)*(1-x)))};                                              // rounds the ends of a loft

// a "part" is {pos,col,idx}; parts are merged into one BufferGeometry per material
function orient(p){const{pos,idx}=p;let v=0;for(let i=0;i<idx.length;i+=3){const a=idx[i]*3,b=idx[i+1]*3,c=idx[i+2]*3;
  v+=pos[a]*(pos[b+1]*pos[c+2]-pos[b+2]*pos[c+1])+pos[a+1]*(pos[b+2]*pos[c]-pos[b]*pos[c+2])+pos[a+2]*(pos[b]*pos[c+1]-pos[b+1]*pos[c])}
  if(v<0)for(let i=0;i<idx.length;i+=3){const t=idx[i+1];idx[i+1]=idx[i+2];idx[i+2]=t}}      // closed surfaces always face outward

export function grid(nt,nth,fn){
  const n=(nt+1)*nth,pos=new Array(n*3),col=new Array(n*3),idx=[],o={p:[0,0,0],c:tc};
  for(let i=0;i<=nt;i++)for(let j=0;j<nth;j++){const k=i*nth+j;fn(i/nt,j/nth*TAU,o);pos[k*3]=o.p[0];pos[k*3+1]=o.p[1];pos[k*3+2]=o.p[2];col[k*3]=o.c.r;col[k*3+1]=o.c.g;col[k*3+2]=o.c.b}
  for(let i=0;i<nt;i++)for(let j=0;j<nth;j++){const a=i*nth+j,b=i*nth+(j+1)%nth,c=(i+1)*nth+j,d=(i+1)*nth+(j+1)%nth;idx.push(a,b,c,b,d,c)}
  const p={pos,col,idx};orient(p);return p}

export function merge(parts){const pos=[],col=[],idx=[];let off=0;
  for(const p of parts){for(const x of p.pos)pos.push(x);for(const x of p.col)col.push(x);for(const i of p.idx)idx.push(i+off);off+=p.pos.length/3}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('color',new T.Float32BufferAttribute(col,3));g.setIndex(idx);g.computeVertexNormals();return g}

// faceted loft: secFn(t) returns a closed polygon [[x,y,z],...] (same vertex count every t). Each polygon edge becomes its own strip
// (duplicated vertices, so the bevels stay crisp), subdivided `sub` times across so colour can vary across a face. colFn(t,edgeIndex,s,color).
export function bands(nt,sub,secFn,colFn){
  const secs=[];for(let i=0;i<=nt;i++)secs.push(secFn(i/nt));
  const m=secs[0].length,W=sub+1,pos=[],col=[],idx=[],c=new T.Color();
  for(let k=0;k<m;k++)for(let i=0;i<=nt;i++){const A=secs[i][k],B=secs[i][(k+1)%m];
    for(let j=0;j<=sub;j++){const s=j/sub;pos.push(A[0]+(B[0]-A[0])*s,A[1]+(B[1]-A[1])*s,A[2]+(B[2]-A[2])*s);colFn(i/nt,k,s,c);col.push(c.r,c.g,c.b)}}
  const id=(k,i,j)=>(k*(nt+1)+i)*W+j;
  for(let k=0;k<m;k++)for(let i=0;i<nt;i++)for(let j=0;j<sub;j++){const a=id(k,i,j),b=id(k,i,j+1),c2=id(k,i+1,j),d=id(k,i+1,j+1);idx.push(a,b,c2,b,d,c2)}
  for(const i of[0,nt]){                                                                           // flat end caps (fan around the centroid)
    const S=secs[i],base=pos.length/3,cen=[0,0,0];for(const p of S){cen[0]+=p[0]/m;cen[1]+=p[1]/m;cen[2]+=p[2]/m}
    pos.push(cen[0],cen[1],cen[2]);colFn(i/nt,0,0,c);col.push(c.r,c.g,c.b);
    for(let k=0;k<m;k++){pos.push(S[k][0],S[k][1],S[k][2]);colFn(i/nt,k,0,c);col.push(c.r,c.g,c.b)}
    for(let k=0;k<m;k++){const a=base+1+k,b=base+1+(k+1)%m;if(i===nt)idx.push(base,a,b);else idx.push(base,b,a)}}
  const p={pos,col,idx};orient(p);return p}

// Catmull-Rom through points of any dimension
export function spline(pts,per=8){const out=[];for(let i=0;i<pts.length-1;i++){const p0=pts[Math.max(0,i-1)],p1=pts[i],p2=pts[i+1],p3=pts[Math.min(pts.length-1,i+2)];
  for(let k=0;k<per;k++){const t=k/per,t2=t*t,t3=t2*t;out.push(p1.map((_,d)=>.5*(2*p1[d]+(-p0[d]+p2[d])*t+(2*p0[d]-5*p1[d]+4*p2[d]-p3[d])*t2+(-p0[d]+3*p1[d]-3*p2[d]+p3[d])*t3)))}}
  out.push(pts[pts.length-1]);return out}

// tube along a spline of [x,y,z] points; rx / rz may be numbers or fn(t); col may be a Color or fn(t,theta,color)
export function tube(ctrl,{rx=.02,rz=rx,col=C('#ffffff'),per=8,nth=14,end=.1,ref=[0,0,1],n=2}={}){
  const path=spline(ctrl,per),N=path.length;
  return grid(N-1,nth,(t,th,o)=>{const i=Math.round(t*(N-1)),Tg=nrm(sub(path[Math.min(N-1,i+1)],path[Math.max(0,i-1)]));let r=ref;if(Math.abs(dot(Tg,r))>.95)r=[1,0,0];
    const n1=nrm(cross(Tg,r)),n2=cross(Tg,n1),k=cap(t,end),[a,b]=se(th,n),sx=typeof rx==='function'?rx(t):rx,sz=typeof rz==='function'?rz(t):rz;
    o.p=add(path[i],add(mul(n1,sx*k*a),mul(n2,sz*k*b)));typeof col==='function'?col(t,th,o.c):o.c.copy(col)})}

// surface of revolution around the Y axis (y = -u). profile [[u,r],...] should start and end on the axis (r=0). ez squashes z; cx/cz offset the axis.
export function lathe(profile,{col=C('#ffffff'),seg=28,ez=1,cx=0,cz=0,smooth=0}={}){
  const pts=smooth?spline(profile,smooth):profile,nt=pts.length-1;
  return grid(nt,seg,(t,th,o)=>{const[u,r]=pts[Math.round(t*nt)];o.p=[cx+r*Math.cos(th),-u,cz+r*Math.sin(th)*ez];typeof col==='function'?col(u,r,th,o.c):o.c.copy(col)})}

export const ball=(c,r,col,s=[1,1,1])=>grid(10,16,(t,th,o)=>{const ph=t*PI;o.p=[c[0]+s[0]*r*Math.sin(ph)*Math.cos(th),c[1]+s[1]*r*Math.cos(ph),c[2]+s[2]*r*Math.sin(ph)*Math.sin(th)];o.c.copy(col)});

// ---- materials (vertex colours carry all the look). Raise metalness a little if your scene has an environment map.
export const metalMat=(o={})=>new T.MeshStandardMaterial({vertexColors:true,metalness:.55,roughness:.3,...o});
export const softMat=(o={})=>new T.MeshStandardMaterial({vertexColors:true,metalness:0,roughness:.75,...o});
export const woodMat=(o={})=>new T.MeshPhysicalMaterial({vertexColors:true,metalness:0,roughness:.5,clearcoat:.7,clearcoatRoughness:.25,...o});
export function addMesh(g,parts,mat){const m=new T.Mesh(merge(Array.isArray(parts)?parts:[parts]),mat);g.add(m);return m}

// shared palette: steel + dark wood + one gold accent
export const PAL={gold:C('#c9a24a'),goldD:C('#8f6f2a'),steel:C('#aab3c4'),steelL:C('#eef2f9'),gun:C('#262b39'),gunD:C('#1a1d28'),ebony:C('#1c1b24'),walnut:C('#5a3921'),walnutL:C('#8a5b36')};
export const goldCol=(u,r,th,c)=>{c.copy(PAL.gold).lerp(PAL.goldD,.22+.22*Math.sin(th*2))};