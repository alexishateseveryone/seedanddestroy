// GENERATED WORLD MAP (story mode). Takes a world from worldGen.js and turns it into a streamed three.js scene with the same interface as forestMap.js
// ({group,obs,update,setQuality,prime,ripple,walk,stats,W,H,heightAt,spawn}) so main.js can use it exactly like the forest.
//   const map=buildWorldMap(world,env);  await map.primeAsync(x,z,60,(p)=>loading.set(p));
// CHUNK STREAMING: a 20x20 chunk gets its scenery (trees, rocks, bushes, mushrooms, cacti, logs, lily pads, reeds, grass, tall grass, flowers) the first
// time the player is near, is drawn only while near, and is freed when far. Placement is a hashed 4x4 cell grid, so a chunk looks the same every time it loads
// and neighbouring chunks never need to know about each other. map.obs only holds the obstacles of loaded chunks (cheap collision for main.js).
// Everything is made from the biome files (treesBiome / bushes / grassBiome / flowers). The forest region has dirt lanes and the forestMap ground look,
// plus the same fireflies + pollen bubble around the player (fireflies glow in the forest / rainforest, pollen floats everywhere).
import * as T from 'three';
import {Batch,WIND,mat4,softLump,vnoise} from '../batch.js';
import {addRockPolished} from '../rocksPolish.js';
import {BIOMES,NB,FOREST,pathD} from './biomes.js';
import {mulberry} from './worldGen.js';
import {addBiomeTree} from './treesBiome.js';
import {addBiomeBush} from './bushes.js';
import {addMushrooms} from './mushrooms.js';
import {addCactus} from './cactus.js';
import {createBiomeGrass} from './grassBiome.js';
import {createFlowers} from './flowers.js';
import {createWater,addLily,addReed} from './water.js';
import {createVines} from './vines.js';
import {createGroundMaterial,buildGroundTiles} from './ground.js';

const CS=20,CELL=4,ACT=64,ACT_G=46,ACT_T=36,ACT_F=32,UNLOAD=92;
const hseed=(a,b,c)=>(Math.imul(a+101,73856093)^Math.imul(b+211,19349663)^Math.imul(c,83492791))>>>0;
const sstep=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
const tick=()=>new Promise(r=>setTimeout(r,0));

export function buildWorldMap(world,env=null){
  const {W,H,HW,HH,seed,terrainAt,spawn}=world,g=new T.Group(),obs=[],chunks=new Map(),live=[];
  // optional extras a world may carry (makeWorld in mapWorld.js sets them): keep-clear zones, own lane formula, scenery beyond the border, density multipliers, landmark rocks, 'build every playfield chunk'
  const pad=world.pad||0,keep=world.keep||[[spawn.x,spawn.z,9]],pD=world.path?world.path.d:pathD,laneAll=!!(world.path&&world.path.all),mu=world.mul||{},sMul=world.scatterMul||null,lm=world.landmarks||[],loadAll=!!world.loadAll;
  const gMat=createGroundMaterial(world,env);g.add(buildGroundTiles(world,gMat,CS));
  const water=createWater(world);g.add(water.group);
  const dbg=new URLSearchParams(location.search);if(dbg.has('nowater'))water.group.visible=false;   // DEBUG: open the game with ?nowater to hide rivers + lakes
  const grass=createBiomeGrass(env),flowers=createFlowers(env),CHUNKROOT=new T.Group();g.add(CHUNKROOT);
  const vines=createVines(env,world);g.add(vines.mesh);
  let gFrac=1,windOn=true,partOn=true;
  const Wt=new Float32Array(NB),GC=BIOMES.map(b=>[new T.Color(b.grass[0]),new T.Color(b.grass[1])]),tmpC=new T.Color();

  // ---- helpers: which biome is here, how dense should grass be, what colour is it
  const pickBiome=(x,z,rng)=>{world.weightsAt(x,z,Wt);let s=0;for(let b=0;b<NB;b++)s+=Wt[b];let r=rng()*s;for(let b=0;b<NB;b++){r-=Wt[b];if(r<=0)return b}return 0};
  const pickKey=(obj,rng)=>{let s=0;for(const k in obj)s+=obj[k];let r=rng()*s;for(const k in obj){r-=obj[k];if(r<=0)return k}return Object.keys(obj)[0]};
  const dens=key=>(x,z)=>{world.weightsAt(x,z,Wt);let d=0;for(let b=0;b<NB;b++)d+=Wt[b]*BIOMES[b].d[key];if(d<=0)return 0;
    d*=sstep(.8,3.4,world.shoreDist(x,z));d*=1-(laneAll?1:sstep(.5,.85,Wt[FOREST]))*(1-sstep(1.2,2.0,pD(x,z)));   // grass stays off the dirt lanes
                                     // thins out towards water and shrinks to nothing at the bank
    d*=1-sstep(.55,1,world.slopeAt(x,z,1));
    if(key==='tall')d*=sstep(.3,.62,vnoise(x*.06+9,z*.06,5));               // tall grass grows in big patches
    else if(key==='grass')d*=Math.min(1,.28+.85*vnoise(x*.12,z*.12,3));     // short grass grows in clumps
    return Math.min(1,d)};
  const densG=dens('grass'),densT=dens('tall'),densF=dens('flower');
  const tint=(x,z,c,rng)=>{world.weightsAt(x,z,Wt);c.setRGB(0,0,0);const cl=vnoise(x*.12,z*.12,3);let s=0;
    for(let b=0;b<NB;b++){const w=Wt[b];if(w<.001)continue;tmpC.copy(GC[b][0]).lerp(GC[b][1],rng()*.8+cl*.2);c.r+=tmpC.r*w;c.g+=tmpC.g*w;c.b+=tmpC.b*w;s+=w}
    if(s>0){c.r/=s;c.g/=s;c.b/=s}return c};
  const flowerPal=(x,z,rng)=>{const f=BIOMES[pickBiome(x,z,rng)].flowers;return f[(rng()*f.length)|0]};

  // ---- chunks
  const chunkAt=(cx,cz)=>{const k=cx+','+cz;let c=chunks.get(k);if(!c){c={cx,cz,x0:cx*CS,z0:cz*CS,x1:cx*CS+CS,z1:cz*CS+CS,loaded:false,grp:null,grass:null,tall:null,flowers:null,vines:null,obs:[],d:1e9};c.core=loadAll&&c.x0<HW&&c.x1>-HW&&c.z0<HH&&c.z1>-HH;chunks.set(k,c)}return c};
  const near=(c,x,z)=>Math.hypot(Math.max(c.x0-x,0,x-c.x1),Math.max(c.z0-z,0,z-c.z1));
  const rebuildObs=()=>{obs.length=0;for(const c of live)for(const o of c.obs)obs.push(o)};
  const inW=(x,z,m)=>Math.abs(x)<HW-m&&Math.abs(z)<HH-m;

  function buildChunk(c){
    const B=new Batch(),cobs=[],cv=[],q=c.d<30?'hi':'lo';
    const on=y=>({add:(kind,geo,m,color,o)=>{const mm=m.clone();mm.elements[13]+=y;B.add(kind,geo,mm,color,o&&o.wind?{...o,wind:{...o.wind,base:o.wind.base+y}}:o)}});
    for(let ix=Math.floor(c.x0/CELL);ix<Math.ceil(c.x1/CELL);ix++)for(let iz=Math.floor(c.z0/CELL);iz<Math.ceil(c.z1/CELL);iz++){
      const R=mulberry(hseed(ix,iz,seed)),x=(ix+.15+R()*.7)*CELL,z=(iz+.15+R()*.7)*CELL;
      if(!inW(x,z,3-pad)||keep.some(k=>Math.hypot(x-k[0],z-k[1])<k[2]))continue;
      const y=terrainAt(x,z),sd=world.shoreDist(x,z),wl=world.waterAt(x,z),u=R();
      if(wl!==null){if(sd<-1.6&&u<.2)addLily(B,R,x,wl+.03,z,.28+R()*.22,R()<.3);continue}
      const b=pickBiome(x,z,R),D=BIOMES[b].d,wF=Wt[FOREST];
      if((laneAll||wF>.5)&&pD(x,z)<2.6)continue;                                                              // the dirt lanes of the forest stay clear
      if(sd<3){                                                                                       // shore: reeds + pebbles, nothing big
        if(sd>.1&&sd<1.9&&b!==3&&b!==4&&u<.5)for(let k=0,n=2+((R()*3)|0);k<n;k++)addReed(B,R,x+(R()-.5)*.8,y,z+(R()-.5)*.8,.7+R()*.7);
        else if(sd>.4&&u>.7)addRockPolished(B,R,x,z,.08+R()*.14,false,y);
        continue}
      const sl=world.slopeAt(x,z),clump=.35+1.3*vnoise(x*.045,z*.045,7);let acc=0;const fm=sMul?sMul(x,z):1;
      if(u<(acc+=D.tree*clump*fm*(mu.tree??1))){
        if(sl>.8)continue;const kind=pickKey(BIOMES[b].trees,R),r=addBiomeTree(on(y),mulberry(hseed(ix,iz,seed^7)),x,z,.95+R()*.6,kind,q,(vx,vy,vz,vl,vs,sdd)=>cv.push({x:vx,y:y+vy,z:vz,len:vl,s:vs,seed:sdd}));
        cobs.push({x,z,r});continue}
      if(u<(acc+=D.rock*(mu.rock??1))){
        const big=b===4,r=(big?.9+R()*1.6:.7+R()*.9);addRockPolished(B,R,x,z,r,b<=1,y);cobs.push({x,z,r:r*.95});
        if(R()<.5){const sx=x+r*1.3,sz=z+.3,sr=r*.4;addRockPolished(B,R,sx,sz,sr,false,terrainAt(sx,sz))}continue}
      if(u<(acc+=D.cactus*(mu.cactus??1))){if(sl<.7)cobs.push({x,z,r:addCactus(B,R,x,y,z,.8+R()*.6,q)});continue}
      if(u<(acc+=D.bush*clump*fm*(mu.bush??1))){addBiomeBush(B,R,x,y,z,.8+R()*.8,BIOMES[b].bush,R()<.3);continue}
      if(u<(acc+=D.log*fm*(mu.log??1))){
        const ry=R()*3,ca=Math.cos(ry),sa=Math.sin(ry),yy=Math.max(y,terrainAt(x+ca*1.35,z-sa*1.35),terrainAt(x-ca*1.35,z+sa*1.35))-.05,
          lg=new T.CylinderGeometry(.4,.43,2.7,10,1).rotateZ(Math.PI/2),base=mat4(x,yy+.4,z,1,1,1,0,ry,0);
        B.add('bark',lg,base,'#7d5434',{varS:3,varA:.4});
        [-1,1].forEach(s=>B.add('prop',new T.CylinderGeometry(.37,.37,.05,10).rotateZ(Math.PI/2),base.clone().multiply(mat4(s*1.35,0,0)),'#e8c79a',{varA:.15}));
        B.add('foliage',softLump(1,.2,3),base.clone().multiply(mat4(.3,.32,.05,.55,.18,.3)),'#5c9a4a',{wind:{base:yy,span:2,gain:.2,phase:R()*9}});
        [-.8,.8].forEach(d=>cobs.push({x:x+ca*d,z:z-sa*d,r:.5}));continue}
      if(u<(acc+=D.shroom*clump*fm*(mu.shroom??1))){const kind=BIOMES[b].shrooms[(R()*BIOMES[b].shrooms.length)|0],r=addMushrooms(B,R,x,y,z,.8+R()*.7,kind);if(r>0)cobs.push({x,z,r})}
    }
    for(const L of lm)if(L.x>=c.x0&&L.x<c.x1&&L.z>=c.z0&&L.z<c.z1){addRockPolished(B,mulberry(L.seed),L.x,L.z,L.r,L.moss,L.y??terrainAt(L.x,L.z));if(L.hit)cobs.push({x:L.x,z:L.z,r:L.r*.95})}   // landmark rocks (rock formations, boulders in the lakes)
    c.grp=B.build(env);CHUNKROOT.add(c.grp);
    const Rg=mulberry(hseed(c.cx,c.cz,seed^0x55)),area=CS*CS,base={x0:c.x0,z0:c.z0,x1:c.x1,z1:c.z1,rng:Rg,at:terrainAt};
    c.grass=grass.scatter({...base,kind:'short',density:densG,tint,tries:Math.round(area*2.4),max:Math.round(area*1.7)});
    c.tall=grass.scatter({...base,kind:'tall',density:densT,tint,tries:Math.round(area*.9),max:Math.round(area*.5)});
    c.flowers=flowers.scatter({...base,density:densF,palette:flowerPal,tries:Math.round(area*.3),max:Math.round(area*.14)});
    [c.grass,c.tall,c.flowers].forEach(o=>o&&CHUNKROOT.add(o));
    [c.grp,c.grass,c.tall,c.flowers].forEach(o=>o&&o.traverse(m=>{m.matrixAutoUpdate=false;m.updateMatrix()}));
    c.obs=pad?cobs.filter(o=>inW(o.x,o.z,0)):cobs;c.vines=cv.length?vines.add(cv):null;c.loaded=true;live.push(c);applyQ(c)}
  function unloadChunk(c){
    c.grp.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose()}});CHUNKROOT.remove(c.grp);c.grp=null;
    if(c.grass){grass.dispose(c.grass);CHUNKROOT.remove(c.grass);c.grass=null}
    if(c.tall){grass.dispose(c.tall);CHUNKROOT.remove(c.tall);c.tall=null}
    if(c.flowers){flowers.dispose(c.flowers);CHUNKROOT.remove(c.flowers);c.flowers=null}
    if(c.vines){vines.remove(c.vines);c.vines=null}
    c.loaded=false;c.obs=[];const i=live.indexOf(c);if(i>=0)live.splice(i,1)}
  function applyQ(c){[c.grass,c.tall].forEach(m=>m&&(m.count=Math.floor(m.userData.n*gFrac)));if(c.flowers)c.flowers.userData.meshes.forEach(m=>m.count=Math.floor(m.userData.n*gFrac))}
  const setVis=c=>{c.grp.visible=c.d<=ACT+8;const on=gFrac>0;if(c.grass)c.grass.visible=on&&c.d<=ACT_G;if(c.tall)c.tall.visible=on&&c.d<=ACT_T;if(c.flowers)c.flowers.visible=on&&c.d<=ACT_F;};

  /** chunks near (x,z) that are not built yet, nearest first */
  function wanted(px,pz,radius,core){const out=[],cr=Math.ceil(radius/CS)+1,cpx=Math.floor(px/CS),cpz=Math.floor(pz/CS);
    for(let cx=cpx-cr;cx<=cpx+cr;cx++)for(let cz=cpz-cr;cz<=cpz+cr;cz++){
      if(cx*CS>=HW+pad||cx*CS+CS<=-HW-pad||cz*CS>=HH+pad||cz*CS+CS<=-HH-pad)continue;
      const c=chunkAt(cx,cz);c.d=near(c,px,pz);if(!c.loaded&&((core&&c.core)||c.d<=radius))out.push(c)}
    return out.sort((a,b)=>a.d-b.d)}
  /** load the chunks closest to (x,z); always at least one per call, then as many as fit in budgetMs. Also frees far ones and sets what is drawn. */
  function stream(px,pz,budgetMs){
    const need=wanted(px,pz,ACT,true),t0=performance.now();let changed=false;
    for(const c of live.slice())if((c.d=near(c,px,pz))>UNLOAD&&!c.core){unloadChunk(c);changed=true}
    for(let i=0;i<need.length;i++){if(i>0&&performance.now()-t0>budgetMs)break;buildChunk(need[i]);changed=true}
    if(changed)rebuildObs();
    for(const c of live){c.d=near(c,px,pz);setVis(c)}}
  /** build everything within radius right now (no pop-in around you) */
  function prime(x,z,radius=60){for(const c of wanted(x,z,radius))buildChunk(c);rebuildObs();stream(x,z,0)}
  /** same, but yields between chunks so the loading screen can animate. onProgress(0..1) */
  async function primeAsync(x,z,radius=60,onProgress=()=>{}){
    const list=wanted(x,z,radius);for(let i=0;i<list.length;i++){buildChunk(list[i]);onProgress((i+1)/list.length);await tick()}
    rebuildObs();stream(x,z,0)}

  // ---- fireflies + pollen (same as forestMap): only a bubble around the player, re-wrapped as you move (nothing simulated far away).
  //      fireflies only glow where there is forest / rainforest under you, the pollen floats everywhere.
  const RP=mulberry(seed^0xf1f1f1),FF=90,fp=new Float32Array(FF*3),fo=[];for(let i=0;i<FF;i++)fo.push([(RP()-.5)*60,1+RP()*1.8,(RP()-.5)*60,RP()*6]);
  const fc=document.createElement('canvas');fc.width=fc.height=32;const fg=fc.getContext('2d'),gg=fg.createRadialGradient(16,16,0,16,16,16);gg.addColorStop(0,'#fff');gg.addColorStop(.4,'rgba(255,240,150,.6)');gg.addColorStop(1,'rgba(255,240,150,0)');fg.fillStyle=gg;fg.fillRect(0,0,32,32);
  const glow=new T.CanvasTexture(fc);
  const ff=new T.Points(new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(fp,3)),new T.PointsMaterial({size:.3,map:glow,transparent:true,blending:T.AdditiveBlending,depthWrite:false,color:'#fff3a0',sizeAttenuation:true}));ff.frustumCulled=false;g.add(ff);
  const MN=160,mp=new Float32Array(MN*3),mo=[];for(let i=0;i<MN;i++)mo.push([(RP()-.5)*80,RP()*5,(RP()-.5)*80,RP()*6,.3+RP()*.5]);
  const motes=new T.Points(new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(mp,3)),new T.PointsMaterial({size:.09,map:glow,transparent:true,blending:T.AdditiveBlending,depthWrite:false,color:'#ffeccc',opacity:.55,sizeAttenuation:true}));motes.frustumCulled=false;g.add(motes);
  const wrap=(v,c,s)=>c+(((v-c+s/2)%s)+s)%s-s/2;
  const hAt=world.heightAt;

  const update=(t,P,E)=>{if(windOn)WIND.uTime.value=t;const px=P?P.x:spawn.x,pz=P?P.z:spawn.z;if(P){WIND.uPlayer.value.set(P.x,0,P.z);stream(px,pz,5)}
    if(partOn){world.weightsAt(px,pz,Wt);const lf=Math.min(1,Wt[FOREST]+Wt[1]);ff.visible=lf>.03;
      if(ff.visible){for(let i=0;i<FF;i++){const f=fo[i],x=wrap(f[0],px,60)+Math.sin(t*.5+f[3])*1.5,z=wrap(f[2],pz,60)+Math.cos(t*.4+f[3])*1.5;fp[i*3]=x;fp[i*3+1]=hAt(x,z)+f[1]+Math.sin(t*1.3+f[3]*2)*.4;fp[i*3+2]=z}
        ff.geometry.attributes.position.needsUpdate=true;ff.material.opacity=(.35+.25*Math.sin(t*2)*Math.sin(t*.7))*lf}
      for(let i=0;i<MN;i++){const m=mo[i],x=wrap(m[0],px,80)+Math.sin(t*.2*m[4]+m[3])*2.2,z=wrap(m[2],pz,80)+Math.cos(t*.17*m[4]+m[3])*2.2;mp[i*3]=x;mp[i*3+1]=hAt(x,z)+.4+((m[1]+t*.12*m[4])%5.4);mp[i*3+2]=z}motes.geometry.attributes.position.needsUpdate=true}
    vines.update(t,P,windOn);water.update(t,E)};
  /** graphics options: grass 0..1, detail (ground shader), wind (sway), particles (fireflies + pollen) */
  const setQuality=q=>{
    if(q.grass!==undefined){gFrac=q.grass;for(const c of live){applyQ(c);setVis(c)}}
    if(q.detail!==undefined)gMat.userData.U.uDetail.value=q.detail?1:0;
    if(q.wind!==undefined)windOn=!!q.wind;
    if(q.particles!==undefined){partOn=!!q.particles;if(!partOn)ff.visible=false;motes.visible=partOn}};
  const stats=()=>({chunks:chunks.size,loaded:live.length,visible:live.filter(c=>c.grp.visible).length,obstacles:obs.length});
  /** free everything (used when you leave the world) */
  function dispose(){for(const c of live.slice())unloadChunk(c);obs.length=0;vines.dispose();glow.dispose();ff.geometry.dispose();ff.material.dispose();motes.geometry.dispose();motes.material.dispose();
    g.traverse(o=>{if(o.isMesh){o.geometry&&o.geometry.dispose()}});g.parent&&g.parent.remove(g)}

  return{group:g,obs,update,setQuality,prime,primeAsync,ripple:water.ripple,walk:water.walk,stats,dispose,W,H,heightAt:world.heightAt,spawn,world,
    biomeAt:(x,z)=>world.biomeAt(x,z),biomeName:(x,z)=>BIOMES[world.biomeAt(x,z)].name,ponds:(world.lakes||[]).map(l=>[l.x,l.z,l.r])};
}
