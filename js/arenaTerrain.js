// Layout + terrain for the 5v5 arena. Pure maths (no three.js) so the map visuals, the 5v5 mode and the tests all agree.
// Attackers spawn in the west, defenders in the east. Two sites (A north, B south) sit on flat plateaus on the defender side,
// connected by winding dirt lanes. Everything else is rolling hills and valleys with ponds in the low spots.
export const W=136,H=92,HW=W/2,HH=H/2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t,sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const hh=(i,j)=>{const n=Math.sin(i*127.1+j*311.7)*43758.5453;return n-Math.floor(n)};
const sn=(x,y)=>{const i=Math.floor(x),j=Math.floor(y),fx=x-i,fy=y-j,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);return lerp(lerp(hh(i,j),hh(i+1,j),u),lerp(hh(i,j+1),hh(i+1,j+1),u),v)};
const fbm=(x,y)=>{let a=.5,s=0;for(let i=0;i<4;i++){s+=a*sn(x,y);x=x*2.03+7.1;y=y*2.03+3.7;a*=.5}return s};

export const SPAWN={atk:{x:-HW+12,z:0},def:{x:HW-12,z:0}};
export const SITES={A:{x:22,z:-30},B:{x:22,z:30}};
export const PONDS=[[-8,-35,5.5],[-6,36,5],[40,19,4],[40,-19,4]];   // [x, z, radius]

// ---------------------------------------------------------------- dirt lanes (the ground shader uses the same formula, see PATH_GLSL)
const SX0=SPAWN.atk.x,SXS=SITES.A.x,ZS=SITES.B.z,PAD=HW-10;
export function pathD(x,z){
  const s=sstep(SX0,SXS,x),w=1-.6*s,cA=-ZS*s+6*Math.sin(x*.09)*w,cB=ZS*s+6*Math.sin(x*.09+2)*w,cM=5*Math.sin(x*.07+.5);
  let d=Math.min(Math.abs(z-cA),Math.abs(z-cB),Math.abs(z-cM));
  d=Math.min(d,Math.abs(x-(SXS+3*Math.sin(z*.1)))+Math.max(0,Math.abs(z)-(ZS+4)));
  return d+Math.max(0,Math.abs(x)-PAD)}
const f=n=>Number(n).toFixed(3);
export const PATH_GLSL=`float pathD(vec2 p){float s=smoothstep(${f(SX0)},${f(SXS)},p.x),w=1.-.6*s,cA=${f(-ZS)}*s+6.*sin(p.x*.09)*w,cB=${f(ZS)}*s+6.*sin(p.x*.09+2.)*w,cM=5.*sin(p.x*.07+.5);
  float d=min(min(abs(p.y-cA),abs(p.y-cB)),abs(p.y-cM));d=min(d,abs(p.x-(${f(SXS)}+3.*sin(p.y*.1)))+max(0.,abs(p.y)-${f(ZS+4)}));
  return d+max(0.,abs(p.x)-${f(PAD)});}`;

// ---------------------------------------------------------------- height field
function base(x,z){
  const h=(fbm(x*.02+11.3,z*.02+4.7)-.47)*11+Math.sin(x*.045+.6)*Math.cos(z*.06+.3)*1.8+2.6*Math.exp(-((x/15)**2+(z/13)**2));   // soft hills + a gentle mound in the middle
  const e=Math.max(Math.abs(x)-HW-6,Math.abs(z)-HH-6,0);return h*(1-sstep(0,22,e))}                                                 // fades to flat outside the arena
// flat plateaus: spawn pads (decals r=7) and sites (decals r=3.6) keep the local height so the blend into the hills stays gentle
const ANCH=[[SPAWN.atk,9,22],[SPAWN.def,9,22],[SITES.A,5.5,14],[SITES.B,5.5,14]].map(([a,r1,r2])=>({x:a.x,z:a.z,r1,r2,y:base(a.x,a.z)}));
// ponds: water level a little under the local ground, a bowl in the middle and a raised rim around it
const PL=PONDS.map(([x,z,r])=>({x,z,r,L:base(x,z)-.4}));
export const PONDL=PL.map(p=>p.L);
function rawH(x,z){
  let h=base(x,z);
  for(const a of ANCH)h=lerp(h,a.y,1-sstep(a.r1,a.r2,Math.hypot(x-a.x,z-a.z)));
  for(const p of PL){const d=Math.hypot(x-p.x,z-p.z);h=lerp(h,p.L+.35,1-sstep(p.r+1,p.r+11,d));h=lerp(h,p.L-.9,1-sstep(p.r*.7,p.r+.3,d))}
  return h}
// sampled once on a 1-unit grid: the mesh uses the same numbers, and heightAt is a cheap bilinear lookup
const GS=1,X0=-(HW+30),Z0=-(HH+30),NX=W+60,NZ=H+60,data=new Float32Array((NX+1)*(NZ+1));
for(let j=0;j<=NZ;j++)for(let i=0;i<=NX;i++)data[j*(NX+1)+i]=rawH(X0+i*GS,Z0+j*GS);
export const GRID={x0:X0,z0:Z0,nx:NX,nz:NZ,gs:GS,data};
export function heightAt(x,z){
  const fx=clamp((x-X0)/GS,0,NX-.001),fz=clamp((z-Z0)/GS,0,NZ-.001),i=fx|0,j=fz|0,u=fx-i,v=fz-j,k=j*(NX+1)+i;
  return lerp(lerp(data[k],data[k+1],u),lerp(data[k+NX+1],data[k+NX+2],u),v)}
export const slopeAt=(x,z,e=1.2)=>Math.hypot(heightAt(x+e,z)-heightAt(x-e,z),heightAt(x,z+e)-heightAt(x,z-e))/(2*e);
