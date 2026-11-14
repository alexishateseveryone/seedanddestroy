// EDITOR WORLD: turns a map made in the World Editor (js/titleMap.js, "Title map" button) into a normal world for worldMap.js, exactly like mapWorld.js makeWorld() does
// for forestTerrain.js / arenaTerrain.js. So the editor map is drawn by the REAL game renderer: the pixel ground shader, cartoon water, swaying grass / flowers, wind, vines.
//   const map=await buildEditorMap(data,{env,baseY});  scene.add(map.group);  await map.primeAsync(0,0,60);  map.update(t,{x:0,z:0},{sun,sky})
//   map = the same object buildWorldMap() returns (group, heightAt, update, setQuality, primeAsync ...)
//
// What is taken from the editor:  terrain heights · biome regions (Biome paint) · water (sea level + painted lakes / rivers) · the objects you placed.
//   Ground paint (dirt paths, sand, ...) is drawn on top of the biome ground by ground.js (data.paint). If the map border is under water, the sea continues beyond the map edge.
//   Painted water is drawn as a set of small round lakes whose shape is cut to your painted outline by the shore-distance texture (water.js fades at the shore).
//   data.scatter = true : the game also scatters trees / bushes / rocks / mushrooms by biome (like in a normal world); false = only the objects you placed. Grass + flowers always grow by biome.
// Placed objects are rebuilt from your own asset functions (addBiomeTree, addBiomeBush, addMushrooms, addCactus ... any addXxx(B,R,x,[y,]z,scale,...)) into one Batch.
import {Batch,mat4} from '../batch.js';
import {NB} from './biomes.js';
import {buildWorldMap} from './worldMap.js';
import {mulberry} from './worldGen.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t,sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const NO_W=-1e4,MG=40;
const unb64=(s,Type)=>{const bin=atob(s),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return new Type(u.buffer)};

/** d = editor data. baseY = null: heights are used exactly as painted in the editor (use this). A number lifts / lowers the whole map so its ground at (0,0) has that height. */
export function worldFromEditor(d,baseY=null){
  const N=d.size,n1=N+1,HW=N/2,HH=N/2,X0=-(HW+MG),Z0=-(HH+MG),NX=N+2*MG,NZ=N+2*MG,NN=(NX+1)*(NZ+1),idx=(i,j)=>j*(NX+1)+i;
  const Hh=unb64(d.heights,Float32Array),WS=d.ws?unb64(d.ws,Float32Array):new Float32Array(n1*n1).fill(NO_W),BI=d.biomes?unb64(d.biomes,Uint8Array):new Uint8Array(n1*n1);
  const eIdx=(x,z)=>clamp(Math.round(z+HH),0,N)*n1+clamp(Math.round(x+HW),0,N);   // editor grid cell of a world position
  const yShift=baseY==null?0:baseY-Hh[eIdx(0,0)];
  const CX=d.cat?+d.cat.x||0:0,CZ=d.cat?+d.cat.z||0:0;   // where the character stands (World Editor > Character spawn); nothing grows around it

  // ---- ground height: the editor grid + the same fade to flat ground outside the playfield that makeWorld does (ground.js has a flat skirt at y=0 beyond the terrain)
  const terr=new Float32Array(NN);
  for(let j=0;j<=NZ;j++)for(let i=0;i<=NX;i++){const x=X0+i,z=Z0+j,out=Math.max(Math.abs(x)-HW-6,Math.abs(z)-HH-6,0);
    const e=eIdx(x,z),h=Hh[e],lv=d.showWater!==false&&h<d.water?d.water:(WS[e]>NO_W/2&&WS[e]-h>.01?WS[e]:null),tg=lv==null?0:Math.min(0,lv+yShift-1.5);   // border under water: keep sinking below the sea instead of rising back to the flat skirt
    terr[idx(i,j)]=lerp(h+yShift,tg,sstep(0,26,out))}

  // ---- water: sea level (cells below it) + painted water (own level per cell). wet = any water, seaM = the open-sea part
  const lvl=new Float32Array(NN).fill(NO_W),wet=new Uint8Array(NN),seaM=new Uint8Array(NN),seaL=d.water;let anySea=false;
  for(let j=0;j<=N;j++)for(let i=0;i<=N;i++){const e=j*n1+i,h=Hh[e],ws=WS[e],k=idx(i+MG,j+MG);let L=NO_W,sea=false;
    if(d.showWater!==false&&h<seaL){L=seaL;sea=true}
    if(ws>NO_W/2&&ws-h>.01&&ws>L){L=ws;sea=false}
    if(L>NO_W/2){lvl[k]=L+yShift;wet[k]=1;if(sea){seaM[k]=1;anySea=true}}}
  // outside the editor grid: where the map border is under water the sea goes on to the horizon (no flat land around the map)
  let outLv=NO_W;
  for(let j=0;j<=NZ;j++)for(let i=0;i<=NX;i++){if(i>=MG&&i<=MG+N&&j>=MG&&j<=MG+N)continue;const e=eIdx(X0+i,Z0+j),h=Hh[e],ws=WS[e],k=idx(i,j);let L=NO_W;
    if(d.showWater!==false&&h<seaL)L=seaL;if(ws>NO_W/2&&ws-h>.01&&ws>L)L=ws;
    if(L>NO_W/2){lvl[k]=L+yShift;wet[k]=1;seaM[k]=1;anySea=true;outLv=Math.max(outLv,L)}}
  const seaLv=d.showWater!==false&&seaL>-20?seaL:(outLv>NO_W/2?outLv:seaL);
  // signed distance to the water edge (negative inside), same chamfer as worldGen.js
  const cham=isSeed=>{const dd=new Float32Array(NN);for(let k=0;k<NN;k++)dd[k]=isSeed(k)?0:1e6;
    for(let j=0;j<=NZ;j++)for(let i=0;i<=NX;i++){const k=idx(i,j);let v=dd[k];if(i>0)v=Math.min(v,dd[k-1]+1);if(j>0){v=Math.min(v,dd[k-NX-1]+1);if(i>0)v=Math.min(v,dd[k-NX-2]+1.4142);if(i<NX)v=Math.min(v,dd[k-NX]+1.4142)}dd[k]=v}
    for(let j=NZ;j>=0;j--)for(let i=NX;i>=0;i--){const k=idx(i,j);let v=dd[k];if(i<NX)v=Math.min(v,dd[k+1]+1);if(j<NZ){v=Math.min(v,dd[k+NX+1]+1);if(i<NX)v=Math.min(v,dd[k+NX+2]+1.4142);if(i>0)v=Math.min(v,dd[k+NX]+1.4142)}dd[k]=v}
    return dd};
  const dWet=cham(k=>wet[k]===1),dDry=cham(k=>wet[k]===0),sd=new Float32Array(NN);
  for(let k=0;k<NN;k++)sd[k]=wet[k]?-(dDry[k]-.5):(dWet[k]-.5);
  // painted lakes / rivers: cover the painted cells with small round lakes (water.js draws one mesh per lake); the texture above trims them to the real outline
  const lakes=[],cov=new Uint8Array(NN),RD=5,RC=4;
  for(let j=MG;j<=MG+N;j++)for(let i=MG;i<=MG+N;i++){const k=idx(i,j);if(!wet[k]||seaM[k]||cov[k])continue;
    lakes.push({x:X0+i,z:Z0+j,r:RD,L:lvl[k],a:0,b:0});
    for(let q=Math.max(0,j-RC);q<=Math.min(NZ,j+RC);q++)for(let p=Math.max(0,i-RC);p<=Math.min(NX,i+RC);p++)if(Math.hypot(p-i,q-j)<=RC)cov[idx(p,q)]=1}

  // ---- biome weights (editor biome ids, softened at the borders) + the two textures of the ground shader (same layout as worldGen.js / mapWorld.js)
  const bw=new Float32Array(NN*NB),dom=new Uint8Array(NN);
  for(let j=0;j<=NZ;j++)for(let i=0;i<=NX;i++){const x=X0+i,z=Z0+j,k=idx(i,j)*NB;
    for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){const b=BI[eIdx(x+di*2,z+dj*2)];bw[k+(b<NB?b:0)]+=1/9}
    let bi=0,bv=-1;for(let b=0;b<NB;b++)if(bw[k+b]>bv){bv=bw[k+b];bi=b}dom[idx(i,j)]=bi}
  const tex1=new Uint8Array(NN*4),tex2=new Uint8Array(NN*4);
  for(let k=0;k<NN;k++){for(let b=0;b<4;b++)tex1[k*4+b]=Math.round(clamp(bw[k*NB+b],0,1)*255);
    tex2[k*4]=Math.round(clamp(bw[k*NB+4],0,1)*255);tex2[k*4+1]=Math.round(clamp((sd[k]+3)/12,0,1)*255);tex2[k*4+2]=seaM[k]?255:0;tex2[k*4+3]=255}

  // ---- sampling helpers (same as makeWorld)
  const sampleG=(a,x,z)=>{const fx=clamp(x-X0,0,NX-.001),fz=clamp(z-Z0,0,NZ-.001),i=fx|0,j=fz|0,u=fx-i,v=fz-j,k=j*(NX+1)+i;return lerp(lerp(a[k],a[k+1],u),lerp(a[k+NX+1],a[k+NX+2],u),v)};
  const cell=(x,z)=>idx(clamp(Math.round(x-X0),0,NX),clamp(Math.round(z-Z0),0,NZ)),terrainAt=(x,z)=>sampleG(terr,x,z);
  const world={seed:(d.seed|0)||1,W:N,H:N,HW,HH,x0:X0,z0:Z0,nx:NX,nz:NZ,gs:1,margin:MG,terr,waterL:lvl,bw,dom,tex1,tex2,rivers:[],lakes,lakeR:l=>l.r,spawn:{x:CX,z:CZ},sites:[],
    pad:0,loadAll:false,scatterMul:null,landmarks:[],keep:[[CX,CZ,9]],   // the cat stands at the Character spawn: nothing grows within 9 units
    mul:d.scatter===false?{tree:0,bush:0,rock:0,cactus:0,log:0,shroom:0}:null,
    path:{d:()=>1000,glsl:'float pathD(vec2 p){return 1000.;}',all:false,key:'nopath'},   // no dirt lanes (the lane formula belongs to the old forest)
    terrainAt,
    heightAt:(x,z)=>{const t=terrainAt(x,z),wv=sampleG(lvl,x,z);return wv>-1e3&&wv>t?Math.max(t,wv-.3):t},
    waterAt:(x,z)=>{const t=terrainAt(x,z),k=cell(x,z);return lvl[k]>-1e3&&lvl[k]>t+.02?lvl[k]:null},
    shoreDist:(x,z)=>sampleG(sd,x,z),biomeAt:(x,z)=>dom[cell(x,z)],
    weightsAt:(x,z,out)=>{const k=cell(x,z)*NB;for(let b=0;b<NB;b++)out[b]=bw[k+b];return out},
    slopeAt:(x,z,e=1.2)=>Math.hypot(terrainAt(x+e,z)-terrainAt(x-e,z),terrainAt(x,z+e)-terrainAt(x,z-e))/(2*e)};
  world.paint=d.paint?{...d.paint,ox:-HW,oz:-HH}:null;   // painted ground (dirt paths etc.): ground.js draws it; the grid starts at the editor's corner
  if(anySea)world.sea=seaLv+yShift;   // open sea: water.js draws one big plane, the shore texture cuts it
  return{world,yShift};
}

// ---- the objects you placed: the editor stores a recipe (file + function + parameter layout), here the real asset functions are called with the real Batch
const modCache=new Map();
function loadMod(file){   // the editor stores the path relative to the folder it fetched from: try it as is and under js/
  if(!modCache.has(file))modCache.set(file,(async()=>{let last;for(const c of[file,'js/'+file]){try{return await import(/* @vite-ignore */new URL(c,document.baseURI).href)}catch(e){last=e}}throw last})());
  return modCache.get(file)}
// recipe = the parameters after (B,R): 'x','y','z' -> 0 (the position comes from the matrix), 'scale' -> 1 (the matrix scales), 'kind' -> variant, 'q' -> 'hi', 'flag:name' -> the stored flag
const callAsset=(fn,recipe,B,R,variant,flags)=>fn(B,R,...recipe.map(r=>r==='x'||r==='y'||r==='z'?0:r==='scale'?1:r==='kind'?variant:r==='q'?'hi':typeof r==='string'&&r.startsWith('flag:')?(flags||{})[r.slice(5)]:undefined));

async function addObjects(map,d,yShift,env){
  if(!d.objects||!d.objects.length)return;
  const B=new Batch(),fns=new Map();let built=0,failed=0;
  for(const o of d.objects){const A=d.assets[o.a];
    try{const key=A.fn+'@'+A.file;let fn=fns.get(key);if(!fn){const mod=await loadMod(A.file);fn=mod[A.fn];if(typeof fn!=='function')throw new Error(A.fn+' not found in '+A.file);fns.set(key,fn)}
      const M=mat4(o.x,o.y+yShift,o.z,o.s,o.s*o.sy,o.s,0,o.rot,0),wy=M.elements[13];   // position + yaw + size of this object (the editor's own transform)
      const on={add:(kind,geo,m,color,opt)=>B.add(kind,geo,M.clone().multiply(m),color,opt&&opt.wind?{...opt,wind:{...opt.wind,base:opt.wind.base+wy}}:opt)};
      callAsset(fn,A.recipe||[],on,mulberry(o.seed),A.variant,o.flags);built++}
    catch(e){failed++;console.warn('[titleMap] '+(A?A.fn+' ('+A.file+')':'?')+': '+e.message)}}
  map.group.add(B.build(env));
  console.log('[titleMap] '+built+' placed objects'+(failed?', '+failed+' could not be built (see warnings)':''));
}

/** the finished map: worldMap.js does the ground, water, grass, flowers, vines and (when data.scatter) the biome scenery; your placed objects are added on top */
export async function buildEditorMap(d,{env=null,baseY=null}={}){
  const {world,yShift}=worldFromEditor(d,baseY),map=buildWorldMap(world,env);
  await addObjects(map,d,yShift,env);
  return map;
}
