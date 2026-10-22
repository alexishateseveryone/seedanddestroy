// Layout + terrain for the big hilly forest (wave mode). Pure maths (no three.js) so the map visuals, the game logic and the tests all agree.
// 240 x 160 world: rolling hills and valleys, three DENSE FOREST areas, four lakes (two of them rocky) and winding dirt lanes through the woods.
// You start in a gentle clearing in the middle.
export const W=240,H=160,HW=W/2,HH=H/2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t,sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const hh=(i,j)=>{const n=Math.sin(i*127.1+j*311.7)*43758.5453;return n-Math.floor(n)};
const sn=(x,y)=>{const i=Math.floor(x),j=Math.floor(y),fx=x-i,fy=y-j,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);return lerp(lerp(hh(i,j),hh(i+1,j),u),lerp(hh(i,j+1),hh(i+1,j+1),u),v)};
const fbm=(x,y)=>{let a=.5,s=0;for(let i=0;i<4;i++){s+=a*sn(x,y);x=x*2.03+7.1;y=y*2.03+3.7;a*=.5}return s};

export const SPAWN={x:0,z:0};
export const FORESTS=[[-62,-34,34],[58,38,36],[-8,54,24]];                      // dense woods: [x, z, radius]
export const PONDS=[[-44,30,13],[52,-32,9],[6,-52,6],[88,12,5]];                // lakes: [x, z, radius]
export const ROCKY=[0,1];                                                      // lakes with boulders standing in the water
/** 0..1: how deep inside a dense forest this point is */
export function forestW(x,z){let w=0;for(const f of FORESTS)w=Math.max(w,1-sstep(f[2]*.45,f[2],Math.hypot(x-f[0],z-f[1])));return w}

// ---------------------------------------------------------------- dirt lanes (the ground shader uses the same formula, see PATH_GLSL)
export function pathD(x,z){return Math.min(Math.abs(z-(9*Math.sin(x*.05)+12*Math.sin(x*.021+1))),Math.abs(x-(10*Math.cos(z*.06)+9*Math.sin(z*.027))))}
export const PATH_GLSL=`float pathD(vec2 p){return min(abs(p.y-(9.*sin(p.x*.05)+12.*sin(p.x*.021+1.))),abs(p.x-(10.*cos(p.y*.06)+9.*sin(p.y*.027))));}`;

// ---------------------------------------------------------------- height field
function base(x,z){
  const h=(fbm(x*.017+11.3,z*.017+4.7)-.47)*14+Math.sin(x*.04+.6)*Math.cos(z*.05+.3)*2.2;
  const e=Math.max(Math.abs(x)-HW-6,Math.abs(z)-HH-6,0);return h*(1-sstep(0,22,e))}                  // fades to flat outside the world
const ANCH=[[SPAWN,8,22]].map(([a,r1,r2])=>({x:a.x,z:a.z,r1,r2,y:base(a.x,a.z)}));                     // the starting clearing is gentle
// lakes: water level a little under the local ground, a bowl in the middle and a raised rim around it
const PL=PONDS.map(([x,z,r])=>({x,z,r,L:base(x,z)-.4}));
export const PONDL=PL.map(p=>p.L);
function rawH(x,z){
  let h=base(x,z);
  for(const a of ANCH)h=lerp(h,a.y,1-sstep(a.r1,a.r2,Math.hypot(x-a.x,z-a.z)));
  for(const p of PL){const d=Math.hypot(x-p.x,z-p.z);h=lerp(h,p.L+.35,1-sstep(p.r+1,p.r+11,d));h=lerp(h,p.L-.9,1-sstep(p.r*.7,p.r+.3,d))}
  return h}
// sampled once on a 1-unit grid. terr = the real ground (mesh + decor), walk = what you stand on (water counts as floor: lakes are walkable)
const GS=1,M=40,X0=-(HW+M),Z0=-(HH+M),NX=W+2*M,NZ=H+2*M,terr=new Float32Array((NX+1)*(NZ+1)),walk=new Float32Array((NX+1)*(NZ+1));
for(let j=0;j<=NZ;j++)for(let i=0;i<=NX;i++){const x=X0+i*GS,z=Z0+j*GS,h=rawH(x,z);let w=h;
  for(const p of PL)if(Math.hypot(x-p.x,z-p.z)<p.r+1.5)w=Math.max(w,p.L);
  terr[j*(NX+1)+i]=h;walk[j*(NX+1)+i]=w}
export const GRID={x0:X0,z0:Z0,nx:NX,nz:NZ,gs:GS,data:terr,margin:M};
function sample(a,x,z){
  const fx=clamp((x-X0)/GS,0,NX-.001),fz=clamp((z-Z0)/GS,0,NZ-.001),i=fx|0,j=fz|0,u=fx-i,v=fz-j,k=j*(NX+1)+i;
  return lerp(lerp(a[k],a[k+1],u),lerp(a[k+NX+1],a[k+NX+2],u),v)}
export const terrainAt=(x,z)=>sample(terr,x,z);      // the actual ground surface (mesh, trees, grass)
export const heightAt=(x,z)=>sample(walk,x,z);       // the surface players, enemies and bullets use
export function waterAt(x,z){for(let k=0;k<PL.length;k++){const p=PL[k];if(Math.hypot(x-p.x,z-p.z)<p.r+1.5&&sample(terr,x,z)<p.L+.02)return k}return -1}
export const slopeAt=(x,z,e=1.2)=>Math.hypot(heightAt(x+e,z)-heightAt(x-e,z),heightAt(x,z+e)-heightAt(x,z-e))/(2*e);
