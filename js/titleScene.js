// TITLE SCENERY: the title screen / main menu show their OWN map (built in this file -> js/world/worldMap.js): a mountain, with the cat standing on the summit
// looking out over the land below. Same ground shader, trees, rocks, grass and wind as the game. (It no longer redirects to forestMap.js.)
// main.js:  const TS=createTitleScene(scene,forest)   ->  TS.show(bool)  TS.update(dt,t,camPos,{sun,sky})  TS.setQuality(q)  TS.heightAt(x,z)  TS.cam(t) = {pos,look}   (the cat stands at x=0,z=0 looking +z)
// Only the floating seeds are added here, to give the still view some life.
// CUSTOM MAP: if a  titleMap.js  (World Editor > "Title map" button) sits next to this file (js/titleMap.js), the title shows THAT map instead of the forest.
//   It goes through the game's own world pipeline (js/world/editorWorld.js -> worldMap.js): real ground shader, water, grass, flowers, wind, + your placed objects.
//   Place the middle of the editor world where the cat stands: the cat is at x=0,z=0 looking +z, the camera is at (2.5,-10.5) looking toward +z (see CAM below).
//   No file (or it fails to load) = the real forest, exactly as before.  createTitleScene(scene,forest,{src:'./other.js',env,quality}) changes the file (relative to this file), {src:false} turns it off. env = atm.envMap, quality = ()=>current graphics options.
import * as T from 'three';

const lerp=(a,b,t)=>a+(b-a)*t;
const rng=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};

import {buildEditorMap} from './world/editorWorld.js';
import {makeWorld,rockFormations,sstep} from './world/mapWorld.js';
import {FOREST,STONE} from './world/biomes.js';
import {buildWorldMap} from './world/worldMap.js';

// ---- THE TITLE MAP, built right here (no separate terrain / map file): a mountain, the cat stands on the flat summit (x=0,z=0).
//   Same pipeline as forestMap.js: makeWorld(recipe) -> buildWorldMap(world,env). Tweak the look with these numbers:
//   PEAK = summit height · SIGMA = how wide the mountain is · SUMMIT_R = radius of the flat top · RANGE = height of the distant mountains
const TITLE_W=220,TITLE_H=220,PEAK=36,SIGMA=55,SUMMIT_R=7,RANGE=22,SPAWN={x:0,z:0},KEEP=[[SPAWN.x,SPAWN.z,8]];
export const TITLE_WORLD=makeWorld({
  seed:21,W:TITLE_W,H:TITLE_H,margin:40,pad:30,spawn:SPAWN,rise:4,
  height:(x,z,n)=>{const r=Math.hypot(x,z),
    peak=PEAK*Math.exp(-((r/SIGMA)**2)),                                                       // the mountain
    rough=(n.fbm(x*.03+3.1,z*.03-1.7,4)-.5)*12*sstep(12,45,r),                               // rocky bumps, none on the top
    ridge=(n.fbm(x*.045+8,z*.045,3)-.5)*7*sstep(20,60,r),                                    // spurs running down the sides
    range=sstep(85,125,r)*(RANGE*.55+(n.fbm(x*.022+40,z*.022+9,4)-.5)*RANGE);                // far mountains around the horizon
    return peak+rough+ridge+range},
  flats:[{x:0,z:0,r1:SUMMIT_R,r2:20}],keep:KEEP,                                              // flat clearing on the very top
  lakes:[],
  // grey rock around the summit, forest further down the slopes
  biomes:(x,z,n,w)=>{const r=Math.hypot(x+(n.fbm(x*.06,z*.06,2)-.5)*14,z+(n.fbm(x*.06+9,z*.06,2)-.5)*14),st=1-sstep(14,36,r);w[FOREST]=1-st*.9;w[STONE]=st*.9},
  scatterMul:(x,z)=>.35+1.2*sstep(18,55,Math.hypot(x,z)),                                     // airy on top, denser woods below
  mul:{rock:1.1},
  decor:(w,R)=>{const f=rockFormations(w,R,{count:4,size:1,moss:false,avoid:KEEP});return{rocks:f.rocks,keep:f.zones}}
});
const buildTitleMountain=env=>buildWorldMap(TITLE_WORLD,env);

// camera: low and a little behind the cat, looking out over the land below the summit. Tweak here:
//   x,z = where the camera stands · up = metres above the ground there · tx,tz = the point it looks at · rise = how far above the ground that point is
const CAM={x:2.5,z:-10.5,up:3.2,tx:2.5,tz:60,rise:2.6};

export function createTitleScene(scene,map,opts={}){
  // the title map: its own mountain (built above, in this file), NOT the forest. `map` (the forest) is only kept for the old signature.
  const cat={x:0,z:0,rot:0};let rev=0;   // where the cat stands on the title (set in the World Editor: Character spawn tool, stored in titleMap.js)
  let custom=buildTitleMountain(opts.env);
  const heightAt=(x,z)=>custom.heightAt(x,z);
  const group=new T.Group();group.visible=false;group.name='titleScene';scene.add(group);
  group.add(custom.group);custom.primeAsync(0,0,60);
  // graphics options are applied on the first update, NOT here: opts.quality() reads variables of main.js that do not exist yet while createTitleScene runs ("Cannot access 'lastQ' before initialization")
  let qPending=!!opts.quality;

  // ---- custom map from the World Editor (optional): built in the background, swapped in for the mountain when ready
  if(opts.src!==false)(opts.src?import(/* @vite-ignore */new URL(opts.src,import.meta.url).href):import('./titleMap.js')).then(async mod=>{const d=mod.default;if(!d||d.format!=='title-map')return;if(d.cam)Object.assign(CAM,d.cam);if(d.cat){cat.x=+d.cat.x||0;cat.z=+d.cat.z||0;cat.rot=+d.cat.rot||0;rev++}
    try{const m=await buildEditorMap(d,{env:opts.env,baseY:null});m.setQuality(opts.quality?opts.quality():{});group.add(m.group);await m.primeAsync(cat.x,cat.z,60);
      const old=custom;custom=m;group.remove(old.group);old.dispose&&old.dispose()}catch(e){console.warn('[titleMap] could not build the map:',e)}},()=>{});   // no titleMap.js = the mountain stays

  // ---- floating seeds (dandelion fluff) drifting through the air around the cat
  const R=rng(11),NS=26,sp=new Float32Array(NS*3),seeds=[];
  for(let i=0;i<NS;i++)seeds.push({x:lerp(-20,24,R()),y:lerp(.8,7,R()),z:lerp(-6,30,R()),ph:R()*6,sp:.25+R()*.5});
  const sg=new T.BufferGeometry();sg.setAttribute('position',new T.BufferAttribute(sp,3));
  const sd=new T.Points(sg,new T.PointsMaterial({color:'#ffffff',size:4,sizeAttenuation:false,fog:false,transparent:true,opacity:.9,depthWrite:false}));
  sd.frustumCulled=false;group.add(sd);

  // sky view: on the title screen the camera looks up at the sky; on tap (sky(false)) it tilts down to the forest.
  //   SKY_PITCH = how far up the camera looks (degrees) · SKY_SPEED = how fast it tilts (bigger = faster)
  const SKY_PITCH=52,SKY_SPEED=2.2;
  let skyTarget=1,skyK=1,lastT=null;
  const cam=t=>{
    const dt=lastT===null?0:Math.min(.1,Math.max(0,t-lastT));lastT=t;
    skyK+=(skyTarget-skyK)*(1-Math.exp(-dt*SKY_SPEED));if(Math.abs(skyTarget-skyK)<.001)skyK=skyTarget;
    const e=skyK*skyK*(3-2*skyK);                                  // eased 0..1  (0 = forest, 1 = sky)
    const cr=Math.cos(cat.rot),sr=Math.sin(cat.rot),rot=(ox,oz)=>({x:cat.x+ox*cr+oz*sr,z:cat.z-ox*sr+oz*cr});     // camera offsets (CAM) are relative to the cat and turn with it
    const cp=rot(CAM.x,CAM.z),ct=rot(CAM.tx,CAM.tz);
    const y=heightAt(cp.x,cp.z)+CAM.up,ly=heightAt(ct.x,ct.z)*.35+heightAt(cp.x,cp.z)*.65+CAM.rise;   // look a little over the land ahead, not at a fixed height
    const pos=new T.Vector3(cp.x+Math.sin(t*.11)*.8,y+Math.sin(t*.17)*.12,cp.z);
    const forest=new T.Vector3(ct.x,Math.max(ly,y-.5),ct.z);
    const pr=SKY_PITCH*Math.PI/180,D=70;
    const sky=new T.Vector3(pos.x+Math.sin(t*.07)*3+sr*Math.cos(pr)*D,pos.y+Math.sin(pr)*D,pos.z+cr*Math.cos(pr)*D);   // the sky view turns with the cat too
    return{pos,look:forest.lerp(sky,e)}};

  return{group,heightAt,cam,cat,get catRev(){return rev},get custom(){return !!custom},
    setQuality(q){qPending=false;custom&&custom.setQuality(q)},
    sky(on){skyTarget=on?1:0},   // true = look at the sky (title), false = tilt down to the forest
    show(on){if(group.visible!==on)group.visible=on},
    update(dt,t,camPos,E){
      if(!group.visible)return;
      if(qPending){try{custom.setQuality(opts.quality());qPending=false}catch(e){}}
      if(custom)custom.update(t,{x:cat.x,z:cat.z},E);
      const p=sg.attributes.position;
      for(let i=0;i<NS;i++){const s=seeds[i];s.x-=dt*(.5+s.sp*.8);s.y+=Math.sin(t*s.sp+s.ph)*dt*.35;s.z+=Math.cos(t*.4+s.ph)*dt*.2;if(s.x<-22){s.x=24;s.y=lerp(.8,7,R())}
        p.setXYZ(i,s.x,heightAt(s.x,s.z)+s.y+.4,s.z)}
      p.needsUpdate=true;
    }};
}
