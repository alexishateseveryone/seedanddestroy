// MAP WORLD (pure maths, no three.js): builds a SMALL hand-laid world with exactly the same shape worldGen.js returns, so worldMap.js (trees, grass, flowers, water,
// vines, ground shader ...) can draw it. forestTerrain.js / arenaTerrain.js describe their map as a config and call makeWorld(cfg).
//
//   cfg.W, cfg.H          size of the playfield          cfg.margin   extra terrain around it (default 40)      cfg.pad   scenery that continues beyond the border (so there is no bare edge)
//   cfg.height(x,z,n)     base ground height              cfg.rise     height of the hills that ring the border   cfg.flats [{x,z,r1,r2}] flat pads (keep the local height)
//   cfg.biomes(x,z,n,w)   fill w[FOREST..STONE] (weights, normalised afterwards)
//   cfg.lakes [[x,z,r,rocky?]]  IRREGULAR lakes (noisy, stretched outline - never a circle)
//   cfg.keep [[x,z,r]]    zones kept free of scenery (spawns, sites)       cfg.path {d,glsl,all,key}  own dirt-lane formula (all: lanes in every biome)
//   cfg.mul {tree,bush,rock,cactus,log,shroom}  density multipliers        cfg.scatterMul(x,z)  extra multiplier for trees / bushes / logs / shrooms (dense woods vs meadows)
//   cfg.loadAll           build every playfield chunk (the 5v5 bots need the obstacles of the whole arena, not only the ones near the player)
//   cfg.decor(w,R)        -> {rocks:[landmark rocks], keep:[zones]}  see rockFormations() / lakeRocks()
import {NB,FOREST,STONE} from './biomes.js';
import {mulberry} from './worldGen.js';

export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t,sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};

export function mkNoise(seed){
  const s=(seed>>>0)||1;
  const hh=(i,j)=>{let h=(Math.imul(i,374761393)+Math.imul(j,668265263)+Math.imul(s,2147483647))|0;h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return(h>>>0)/4294967296};
  const sn=(x,y)=>{const i=Math.floor(x),j=Math.floor(y),fx=x-i,fy=y-j,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
    return lerp(lerp(hh(i,j),hh(i+1,j),u),lerp(hh(i,j+1),hh(i+1,j+1),u),v)};
  const fbm=(x,y,o=4)=>{let a=.5,t=0,n=0;for(let i=0;i<o;i++){t+=a*sn(x,y);n+=a;x=x*2.03+7.1;y=y*2.03+3.7;a*=.5}return t/n};
  return{sn,fbm};
}

export function makeWorld(cfg){
  const {seed=1,W,H,margin:MG=40,pad=0,spawn={x:0,z:0},height,biomes,flats=[],lakes:lakeCfg=[],rise=0,riseFrom=16,path=null,keep=[],mul=null,scatterMul=null,loadAll=false,decor=null}=cfg;
  const HW=W/2,HH=H/2,X0=-(HW+MG),Z0=-(HH+MG),NX=W+2*MG,NZ=H+2*MG,N=(NX+1)*(NZ+1),idx=(i,j)=>j*(NX+1)+i;
  const n=mkNoise(seed),{sn,fbm}=n,R=mulberry(seed^0x9e3779b9);
  const sampleG=(a,x,z)=>{const fx=clamp(x-X0,0,NX-.001),fz=clamp(z-Z0,0,NZ-.001),i=fx|0,j=fz|0,u=fx-i,v=fz-j,k=j*(NX+1)+i;
    return lerp(lerp(a[k],a[k+1],u),lerp(a[k+NX+1],a[k+NX+2],u),v)};

  // ---- 1. base height: the map's own hills + a ring of hills around the border, flat pads, fades to 0 outside (the flat skirt of ground.js starts there)
  const raw=(x,z)=>{let h=height(x,z,n);
    if(rise){const e=Math.max(Math.abs(x)-(HW-riseFrom),Math.abs(z)-(HH-riseFrom),0),t=sstep(0,riseFrom,e);h+=t*t*rise*(.6+.8*fbm(x*.03+3.1,z*.03,3))}
    return h};
  const anch=flats.map(a=>({...a,y:raw(a.x,a.z)})),base=new Float32Array(N);
  for(let j=0;j<=NZ;j++)for(let i=0;i<=NX;i++){const x=X0+i,z=Z0+j;let h=raw(x,z);
    for(const a of anch)h=lerp(h,a.y,1-sstep(a.r1,a.r2,Math.hypot(x-a.x,z-a.z)));
    const out=Math.max(Math.abs(x)-HW-6,Math.abs(z)-HH-6,0);base[idx(i,j)]=h*(1-sstep(0,26,out))}

  // ---- 2. lakes: noisy outline (two noise octaves) stretched along a random axis, so every lake has its own shape
  const lakes=lakeCfg.map(([x,z,r,rocky])=>({x,z,r,rocky:!!rocky,el:.15+R()*.2,ph:R()*3.1416,a:R()*50,b:R()*50,L:sampleG(base,x,z)-.4}));
  const lakeR=(l,th)=>l.r*(.62+.42*sn(Math.cos(th)*1.5+l.a,Math.sin(th)*1.5+l.b)+.16*sn(Math.cos(th)*4+l.b,Math.sin(th)*4+l.a))*(1+l.el*Math.cos(2*(th-l.ph)));
  const sd=new Float32Array(N).fill(1e9),wl=new Float32Array(N);
  for(const l of lakes){const reach=l.r*2.1+11,i0=Math.max(0,Math.floor(l.x-reach-X0)),i1=Math.min(NX,Math.ceil(l.x+reach-X0)),j0=Math.max(0,Math.floor(l.z-reach-Z0)),j1=Math.min(NZ,Math.ceil(l.z+reach-Z0));
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const x=X0+i,z=Z0+j,s=Math.hypot(x-l.x,z-l.z)-lakeR(l,Math.atan2(z-l.z,x-l.x)),k=idx(i,j);if(s<sd[k]){sd[k]=s;wl[k]=l.L}}}
  // carve: banks ease into the water level, a bowl under the water, record where it is wet
  const terr=new Float32Array(N),waterL=new Float32Array(N).fill(-1e4);
  for(let k=0;k<N;k++){let h=base[k];const s=sd[k];
    if(s<9){const L=wl[k];h=lerp(h,L+.35,1-sstep(0,9,s));h=lerp(h,L-1.3,sstep(.5,-2.5,s));if(s<-.3)waterL[k]=L}
    terr[k]=h}

  // ---- 3. biome weights + the two textures of the ground shader (same layout as worldGen.js)
  const bw=new Float32Array(N*NB),dom=new Uint8Array(N),w=new Float32Array(NB);
  for(let j=0;j<=NZ;j++)for(let i=0;i<=NX;i++){const x=X0+i,z=Z0+j,k=idx(i,j);w.fill(0);biomes(x,z,n,w);
    let sum=0;for(let b=0;b<NB;b++)sum+=w[b];if(sum<=1e-6){w[FOREST]=1;sum=1}
    let bi=0,bv=-1;for(let b=0;b<NB;b++){const v=w[b]/sum;bw[k*NB+b]=v;if(v>bv){bv=v;bi=b}}dom[k]=bi}
  const tex1=new Uint8Array(N*4),tex2=new Uint8Array(N*4);
  for(let k=0;k<N;k++){for(let b=0;b<4;b++)tex1[k*4+b]=Math.round(clamp(bw[k*NB+b],0,1)*255);
    tex2[k*4]=Math.round(clamp(bw[k*NB+STONE],0,1)*255);tex2[k*4+1]=Math.round(clamp((sd[k]+3)/12,0,1)*255);tex2[k*4+2]=0;tex2[k*4+3]=255}

  const cell=(x,z)=>idx(clamp(Math.round(x-X0),0,NX),clamp(Math.round(z-Z0),0,NZ)),terrainAt=(x,z)=>sampleG(terr,x,z);
  const world={seed,W,H,HW,HH,x0:X0,z0:Z0,nx:NX,nz:NZ,gs:1,margin:MG,terr,waterL,bw,dom,tex1,tex2,rivers:[],lakes,lakeR,spawn:{x:spawn.x,z:spawn.z},sites:[],
    pad,path,mul,scatterMul,loadAll,keep:keep.length?keep.slice():[[spawn.x,spawn.z,9]],landmarks:[],
    terrainAt,
    heightAt:(x,z)=>{const t=terrainAt(x,z),wv=sampleG(waterL,x,z);return wv>-1e3&&wv>t?Math.max(t,wv-.3):t},         // water is wadeable, a bit below the surface
    waterAt:(x,z)=>{const t=terrainAt(x,z),k=cell(x,z);return waterL[k]>-1e3&&waterL[k]>t+.02?waterL[k]:null},
    shoreDist:(x,z)=>sampleG(sd,x,z),
    biomeAt:(x,z)=>dom[cell(x,z)],
    weightsAt:(x,z,out)=>{const k=cell(x,z)*NB;for(let b=0;b<NB;b++)out[b]=bw[k+b];return out},
    slopeAt:(x,z,e=1.2)=>Math.hypot(terrainAt(x+e,z)-terrainAt(x-e,z),terrainAt(x,z+e)-terrainAt(x,z-e))/(2*e)};
  if(decor){const d=decor(world,R)||{};world.landmarks=d.rocks||[];world.keep=world.keep.concat(d.keep||[])}
  return world;
}

/** index of the lake whose water covers (x,z), or -1 (the old PONDS index API) */
export function lakeIndexAt(w,x,z){
  if(w.waterAt(x,z)===null)return -1;
  let b=0,bd=1e9;w.lakes.forEach((l,i)=>{const d=Math.hypot(x-l.x,z-l.z)-w.lakeR(l,Math.atan2(z-l.z,x-l.x));if(d<bd){bd=d;b=i}});return b}

/** ROCK FORMATIONS: clusters (a big boulder with smaller ones around it), walls (a line of boulders with a gap you can slip through) and rings (a rocky
 *  fort with a doorway). Returns landmark rocks (collide) + the zones the random scenery has to keep out of. */
export function rockFormations(w,R,{count=6,margin=12,avoid=[],lane=null,size=1,moss=false,types=['cluster','wall','ring']}={}){
  const rocks=[],zones=[];
  for(let t=0,k=0;t<700&&k<count;t++){
    const x=(R()*2-1)*(w.HW-margin),z=(R()*2-1)*(w.HH-margin),fr=(3.4+R()*2.2)*size,zr=fr*1.3+2.6;
    if(avoid.some(a=>Math.hypot(a[0]-x,a[1]-z)<a[2]+zr)||zones.some(a=>Math.hypot(a[0]-x,a[1]-z)<a[2]+zr+4))continue;
    if(lane&&lane(x,z)<zr*.6)continue;
    if(w.waterAt(x,z)!==null||w.shoreDist(x,z)<zr+1||w.slopeAt(x,z)>.5)continue;
    const type=types[(R()*types.length)|0],ang=R()*6.283,put=(px,pz,r)=>rocks.push({x:px,z:pz,r,moss,seed:(R()*1e9)|0,hit:true});
    if(type==='cluster'){put(x,z,(1.9+R()*1.3)*size);for(let i=0,m=4+((R()*3)|0);i<m;i++){const a=R()*6.283,d=fr*(.5+R()*.5);put(x+Math.cos(a)*d,z+Math.sin(a)*d,(.8+R()*1.3)*size)}}
    else if(type==='wall'){const m=6+((R()*3)|0),gap=1+((R()*(m-2))|0),ca=Math.cos(ang),sa=Math.sin(ang);
      for(let i=0;i<m;i++){if(i===gap)continue;const f=(i/(m-1)-.5)*fr*2.4,j=(R()-.5)*.9;put(x+ca*f-sa*j,z+sa*f+ca*j,(1.2+R()*1)*size)}}
    else{const m=8+((R()*3)|0),door=(R()*m)|0;for(let i=0;i<m;i++){if(i===door||i===(door+1)%m)continue;const a=ang+i/m*6.283;put(x+Math.cos(a)*fr,z+Math.sin(a)*fr,(1.2+R()*.9)*size)}
      if(R()<.5)put(x,z,(.7+R()*.5)*size)}
    zones.push([x,z,zr]);k++}
  return{rocks,zones}}

/** ROCKY LAKES (cfg.lakes entries with rocky=true): boulders standing in the water, stepping stones and a rocky shore. */
export function lakeRocks(w,R,avoid=[]){
  const rocks=[],near=(x,z,r)=>rocks.some(o=>Math.hypot(o.x-x,o.z-z)<o.r+r+.9),
    ok=(x,z,r)=>!near(x,z,r)&&Math.abs(x)<w.HW-3&&Math.abs(z)<w.HH-3&&avoid.every(a=>Math.hypot(a[0]-x,a[1]-z)>a[2]+r),sd=()=>(R()*1e9)|0;
  for(const l of w.lakes){if(!l.rocky)continue;
    for(let t=0,k=0,N=Math.round(l.r*.9);t<200&&k<N;t++){const q=R()*6.283,d=R()*Math.max(.5,w.lakeR(l,q)-1.8),x=l.x+Math.cos(q)*d,z=l.z+Math.sin(q)*d,r=.8+R()*1.1;
      if(!ok(x,z,r))continue;rocks.push({x,z,r,moss:R()<.4,seed:sd(),y:l.L-.3,hit:true});k++;
      if(R()<.6)rocks.push({x:x+r*1.2,z:z+r*.4,r:r*.4,moss:false,seed:sd(),y:l.L-.2,hit:false})}
    for(let i=0,N=Math.round(l.r*1.4);i<N;i++){const q=R()*6.283,d=R()*(w.lakeR(l,q)-.6);rocks.push({x:l.x+Math.cos(q)*d,z:l.z+Math.sin(q)*d,r:.2+R()*.25,moss:false,seed:sd(),y:l.L-.12,hit:false})}
    for(let t=0,k=0,N=Math.round(l.r*.8);t<200&&k<N;t++){const q=R()*6.283,d=w.lakeR(l,q)+1.2+R()*2.4,x=l.x+Math.cos(q)*d,z=l.z+Math.sin(q)*d,r=.6+R()*.9;
      if(!ok(x,z,r))continue;rocks.push({x,z,r,moss:R()<.5,seed:sd(),hit:true});k++}}
  return rocks}