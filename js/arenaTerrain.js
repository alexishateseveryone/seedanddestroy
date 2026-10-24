// Layout + terrain for the 5v5 arena, now with FOUR MAPS (themes). Pure maths (no three.js) so the map visuals, the 5v5 mode and the tests all agree.
// Attackers spawn in the west, defenders in the east. Two sites (A north, B south) sit on flat plateaus on the defender side, connected by winding dirt lanes.
// The layout (spawns, sites, lanes) is the same in every theme, so the bots and the 5v5 rules do not care which map is loaded - the ground, plants, lakes and cover differ:
//   'forest'  oak + pine woods, mossy boulders          'jungle'  tall rainforest trees, vines, big mushrooms
//   'savanna' golden grass, flat acacias, rocky outcrops  'stone'   stone highlands: ridges, boulder fields, rock walls / rings / clusters
// setTheme(id) switches the terrain every exported function below reads (buildArena in arenaMap.js calls it). id = 'forest' | 'jungle' | 'savanna' | 'stone' | 0..3
import {makeWorld,rockFormations,lakeIndexAt,sstep} from './world/mapWorld.js';
import {FOREST,JUNGLE,SAVANNA,DESERT,STONE} from './world/biomes.js';

export const W=136,H=92,HW=W/2,HH=H/2;
export const SPAWN={atk:{x:-HW+12,z:0},def:{x:HW-12,z:0}};
export const SITES={A:{x:22,z:-30},B:{x:22,z:30}};

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

// ---------------------------------------------------------------- shared layout
const KEEP=[[SPAWN.atk.x,SPAWN.atk.z,12],[SPAWN.def.x,SPAWN.def.z,12],[SITES.A.x,SITES.A.z,8],[SITES.B.x,SITES.B.z,8]];
const FLATS=[[SPAWN.atk,9,22],[SPAWN.def,9,22],[SITES.A,5.5,14],[SITES.B,5.5,14]].map(([a,r1,r2])=>({x:a.x,z:a.z,r1,r2}));    // spawn pads + site plateaus keep the local height
const forms=o=>(w,R)=>{const r=rockFormations(w,R,{avoid:KEEP,lane:pathD,...o});return{rocks:r.rocks,keep:r.zones}};
const patch=(x,z,n,a,b,s=.03,o=0)=>sstep(a,b,n.fbm(x*s+o,z*s-o,3));                                                    // soft random patches 0..1
const hill=(x,z,n,amp,sc)=>(n.fbm(x*sc+11.3,z*sc+4.7)-.47)*amp+Math.sin(x*.045+.6)*Math.cos(z*.06+.3)*1.8+2.6*Math.exp(-((x/15)**2+(z/13)**2));   // soft hills + a gentle mound in the middle

const THEMES=[
  {id:'forest',name:'Forest',
    hills:{dark:'#1d4a35',rings:[{r:138,h0:14,h1:15,k:1.7,tone:'#3b7a47'},{r:176,h0:26,h1:24,k:5.3,tone:'#4a8a58'}]},
    world:{seed:11,rise:5,height:(x,z,n)=>hill(x,z,n,11,.02),
      biomes:(x,z,n,w)=>{const st=.8*patch(x,z,n,.7,.82,.03,4);w[FOREST]=1-st;w[STONE]=st},
      lakes:[[-8,-35,5.5],[-6,36,5],[40,19,4],[40,-19,4]],
      mul:{tree:.5,bush:.9,rock:1.3,log:1.5},decor:forms({count:3,size:.9,moss:true})}},
  {id:'jungle',name:'Rainforest',
    hills:{dark:'#14502e',rings:[{r:138,h0:16,h1:16,k:2.9,tone:'#2c7a3c'},{r:176,h0:28,h1:24,k:6.1,tone:'#3a8f4a'}]},
    world:{seed:23,rise:7,height:(x,z,n)=>hill(x,z,n,15,.024)+1,
      biomes:(x,z,n,w)=>{const st=.6*patch(x,z,n,.72,.84,.035,8);w[JUNGLE]=1-st;w[STONE]=st},
      lakes:[[-8,-35,5.5],[-6,36,5],[40,19,4],[40,-19,4],[-34,14,4]],
      mul:{tree:.55,bush:1,rock:1.2},decor:forms({count:3,size:.9,moss:true})}},
  {id:'savanna',name:'Savanna',
    hills:{dark:'#6b7a3a',rings:[{r:138,h0:10,h1:10,k:3.7,tone:'#a89a52'},{r:176,h0:18,h1:16,k:7.3,tone:'#bfae66'}]},
    world:{seed:37,rise:2.5,height:(x,z,n)=>(n.fbm(x*.011+5,z*.011,3)-.5)*5+1.5+Math.sin(x*.03)*Math.cos(z*.04)*.8+1.6*Math.exp(-((x/15)**2+(z/13)**2)),
      biomes:(x,z,n,w)=>{const dr=.7*patch(x,z,n,.64,.8,.03,2);w[SAVANNA]=1-dr;w[DESERT]=dr},
      lakes:[[-8,-33,7.5],[-6,34,7],[44,18,4.5],[44,-18,4.5]],
      mul:{tree:2.2,bush:1.3,rock:3,cactus:1.5},decor:forms({count:5,size:1,moss:false,types:['cluster','wall']})}},     // kopjes: rocky outcrops to hide behind
  {id:'stone',name:'Rock Formations',
    hills:{dark:'#5c584e',rings:[{r:138,h0:18,h1:18,k:4.3,tone:'#8c8678'},{r:176,h0:32,h1:28,k:8.1,tone:'#a39e90'}]},
    world:{seed:53,rise:11,
      height:(x,z,n)=>{const q=n.fbm(x*.03+2,z*.03,4),r=1-Math.abs(2*q-1);return r*r*10+(n.fbm(x*.07,z*.07,3)-.5)*2.5+1},
      biomes:(x,z,n,w)=>{const g=.5*patch(x,z,n,.66,.8,.03,6);w[STONE]=1-g;w[FOREST]=g},
      lakes:[[-10,-33,4.5],[-8,34,4.2],[44,15,3.6],[42,-22,3.6]],
      mul:{rock:.55,tree:1.5},decor:forms({count:9,size:1.2,moss:false})}}];                                              // walls with a gap, rock rings with a doorway, boulder clusters

export const ARENA_THEMES=THEMES.map(({id,name})=>({id,name}));

// ---------------------------------------------------------------- the active theme: every export below reads it
let world=null;
export let WORLD=null,THEME='forest',GRID=null,PONDS=[],PONDL=[];
export function setTheme(id){
  const t=typeof id==='number'?THEMES[((id%THEMES.length)+THEMES.length)%THEMES.length]:THEMES.find(q=>q.id===id)||THEMES[0];
  if(!t.w)t.w=makeWorld({W,H,margin:40,pad:20,spawn:{x:SPAWN.atk.x,z:0},flats:FLATS,keep:KEEP,path:{d:pathD,glsl:PATH_GLSL,all:true,key:'arena'},loadAll:true,...t.world});
  world=WORLD=t.w;THEME=t.id;
  GRID={x0:world.x0,z0:world.z0,nx:world.nx,nz:world.nz,gs:1,data:world.terr,margin:world.margin};
  PONDS=world.lakes.map(l=>[l.x,l.z,l.r]);PONDL=world.lakes.map(l=>l.L);
  return t}
setTheme('forest');

export const terrainAt=(x,z)=>world.terrainAt(x,z);      // the actual ground surface (mesh, trees, grass)
export const heightAt=(x,z)=>world.heightAt(x,z);        // the surface players, bots and bullets use (water is wadeable, nothing blocks you)
export const waterAt=(x,z)=>lakeIndexAt(world,x,z);      // index of the lake under (x,z), or -1
export const slopeAt=(x,z,e=1.2)=>Math.hypot(heightAt(x+e,z)-heightAt(x-e,z),heightAt(x,z+e)-heightAt(x,z-e))/(2*e);