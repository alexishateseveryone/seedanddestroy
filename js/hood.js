// Assassin hood with cloth physics, shared by the soldiers and the player's cat maker.
// The dome that sits on the head (crown included) is pinned to it; the hem skirt (neck drape) and the very tip are free cloth, so they
// sway, lag and settle with every movement. Gold trim rides on the cloth's edge particles.
import * as T from 'three';
import {Cloth,Tube} from './physics.js';

const TAU=Math.PI*2,sm=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)};
export const HOOD_RV=9,HOOD_CU=14;                       // rows (hem -> tip), columns (left opening edge -> back -> right opening edge)
const wf=t=>.95*(1-sm(.10,.62,t));                       // half-angle of the face opening at height t
const P=(t,phi)=>{
  const y=-.7+2.6*t,g=sm(.28,1,t);
  let r=1.12*(1-g)+.12*(1-sm(0,.25,t));                  // dome, flaring out at the hem
  r*=1+.14*Math.max(0,Math.cos(phi))*Math.exp(-(((t-.42)/.13)**2));   // brow overhang
  const c=Math.pow(Math.max(0,(t-.5)/.5),2.2);           // tip curls back and droops
  return new T.Vector3(Math.sin(phi)*r+.12*c,y-.15*c,Math.cos(phi)*r*.93-.85*c);
};
const cols=HOOD_CU+1,rows=HOOD_RV+1;
export function hoodRest(){const out=[];
  for(let i=0;i<rows;i++){const t=i/HOOD_RV,w=wf(t);for(let j=0;j<cols;j++)out.push(P(t,w+(TAU-2*w)*j/HOOD_CU))}
  return out}
const gold=c=>new T.MeshStandardMaterial({color:c,roughness:.4,metalness:.25});

// parent: the head group. opts: outerM / outer (colour), innerM / inner, trimC, seamC, coll (head-local ellipsoids), grav
export function createHood(parent,o={}){
  const outerM=o.outerM||new T.MeshStandardMaterial({color:o.outer||'#6f8f45',roughness:.92}),
        innerM=o.innerM||new T.MeshStandardMaterial({color:o.inner||'#1c1c24',roughness:.95});
  outerM.side=T.BackSide;innerM.side=T.FrontSide;        // the surface's front faces point inward: outside = back side, lining = front side
  const cloth=new Cloth(parent,hoodRest(),cols,rows,{grav:o.grav??13,stiff:.06,damp:.94,iter:3,coll:o.coll||null,
    pin:i=>{const r=Math.floor(i/cols);return r>=2&&r<=7}});          // rows 0-1 (neck drape) and 8-9 (the very tip) are free; the whole dome incl. the crown is pinned
  cloth.mesh.material=outerM;
  const lining=new T.Mesh(cloth.geo,innerM);lining.frustumCulled=false;parent.add(lining);
  // trim: face-opening arch, hem, back seam. They read the cloth's edge particles each frame.
  const id=(r,c)=>r*cols+c,edge=[];for(let r=0;r<rows;r++)if(wf(r/HOOD_RV)>.03)edge.push(r);
  const arch=[...edge.map(r=>id(r,0)),...edge.slice().reverse().map(r=>id(r,cols-1))],hem=Array.from({length:cols},(_,c)=>id(0,c)),
        seam=Array.from({length:rows-3},(_,k)=>id(k+3,Math.floor(cols/2)));
  const tm=gold(o.trimC||'#c9a24a'),sm_=gold(o.seamC||'#8a6d2a');
  const tubes=[[arch,.045,tm],[hem,.05,tm],[seam,.016,sm_]].map(([ix,r,m])=>({ix,t:new Tube(parent,ix.length,r,6,m,{ref:[1,0,0]})}));
  const trim=()=>tubes.forEach(({ix,t})=>t.set(ix.map(i=>cloth.lp[i])));
  trim();
  return{cloth,
    step(dt){cloth.step(dt);trim()},
    refresh:trim,                                                      // static pose (icons)
    group:parent};
}