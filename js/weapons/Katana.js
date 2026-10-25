// Katana: a clean, premium blade. Hand-built geometry, vertex colours only (steel, near-black wrap, gold fittings).
//   - blade   : faceted loft (bevel / hira / shinogi / mune) with sori (curve toward the edge), tapering width and a kissaki tip.
//               Colour = polished bevel, a soft wavy hamon fading into the mirror flat, darker ridge and spine.
//   - tsuba   : round iron guard with a thin gold ring
//   - habaki, fuchi, kashira, menuki : gold fittings (lathes + tiny ellipsoids)
//   - tsuka   : the handle, a lofted oval with a diagonal wrap lattice (bump + colour), black-navy with slightly lighter diamonds
// The weapon points along -Y: grip at the origin, the butt behind the hand (+Y), the tip at y = -1.70 (after SHIFT). The edge faces +X.
import * as T from 'three';
import {PI,clamp,lerp,sm,C,grid,bands,lathe,ball,cap,se,goldCol,metalMat,softMat,addMesh} from './wlib.js';

const SHIFT=.08,GIRTH=2.4,ROLL=Math.PI/2;   // SHIFT: slides the whole sword toward the tip so guard / grip / pommel line up with the Wooden Sword. ROLL: turns the sword about its own length so the broad face is seen from the side like the Wooden Sword (edge points down; use -Math.PI/2 to flip it up). GIRTH: widens x/z only (never the length); 1 = original slim look
const B0=.105,B1=1.62,BL=B1-B0,HW0=.0215,HW1=.0165,TZ=.0082;     // blade start / end (u), length, half width at the base / near the tip, half thickness
const HIRA=C('#9aa4b6'),HAMON=C('#eef2f9'),SHINO=C('#6b7589'),MUNE=C('#4c5468'),BEVEL=C('#f7f9fd');
const IRON=C('#1d202b'),ITO=C('#1b1f30'),ITO_L=C('#2f3856'),ITO_H=C('#4a5373'),GOLD=C('#c9a24a');

function bladeSec(t){
  const u=B0+t*BL,y=-u,off=.04*Math.pow(t,1.8),hw=lerp(HW0,HW1,t),tt=clamp((t-.915)/.085,0,1);   // tt: how far into the kissaki
  const W=Math.max(.0006,2*hw*(1-Math.pow(tt,1.7))),tz=Math.max(.0006,TZ*lerp(1,.8,t)*(1-.9*Math.pow(tt,3)));
  const xe=off-hw+W,P=(d,z)=>[xe-d*W,y,z];                       // spine stays put, the edge side closes in at the tip
  return[P(0,0),P(.16,.5*tz),P(.6,tz),P(.97,.86*tz),P(.97,-.86*tz),P(.6,-tz),P(.16,-.5*tz)];
}
function bladeCol(t,k,s,c){
  const hl=.22+.06*Math.sin(t*34)+.035*Math.sin(t*83+1.7);       // wavy hamon line
  if(k===0||k===6){c.copy(BEVEL);return}
  if(k===1||k===5){const x=k===1?s:1-s;c.copy(HIRA).lerp(HAMON,1-sm(clamp((x-hl)/.2,0,1))).multiplyScalar(.93+.1*t);return}
  if(k===3){c.copy(MUNE);return}
  c.copy(SHINO).lerp(HIRA,.12*s)                                  // shinogi-ji (the ridge flats)
}

// ---- guard
const tsubaP=[[.098,0],[.098,.040],[.098,.047],[.098,.052],[.098,.057],[.0985,.0615],[.103,.0655],[.108,.0655],[.1125,.0615],[.113,.057],[.113,.052],[.113,.047],[.113,.040],[.113,0]];
const tsubaCol=(u,r,th,c)=>{c.copy(IRON).multiplyScalar(.9+.25*(r/.06));const g=1-clamp(Math.abs(r-.0525)/.0045,0,1);if(r>.0615)c.lerp(GOLD,.55);c.lerp(GOLD,g*.95)};

// ---- handle (u from the butt -.255 to the guard .100)
const tsuka=grid(100,36,(t,th,o)=>{
  const u=lerp(-.255,.100,t),k=cap(t,.03),[a,b]=se(th,2.4),sw=Math.sin(PI*t),A=Math.sin(u*70+th*3),B=Math.sin(u*70-th*3),m=Math.max(A,B);   // m: the crossing wrap threads
  o.p=[(.0195+.0045*sw+.0011*Math.max(0,m))*a*k,-u,(.0150+.0040*sw+.0011*Math.max(0,m))*b*k];
  o.c.copy(ITO).lerp(ITO_L,clamp((m-.3)/.7,0,1)*.9);if(m<-.55)o.c.lerp(ITO_H,.7)});

export default {
  id:'katana',name:'Katana',kind:'melee',handling:'sword',great:'blade',fore:[-.14,0],
  stats:{range:2.7,arc:-.1,dmg:3.2,dur:.34,dash:1.1,move:1.05},
  build(){
    const g=new T.Group();
    addMesh(g,bands(90,8,bladeSec,bladeCol),metalMat({metalness:.6,roughness:.22}));
    const trim=[
      lathe(tsubaP,{col:tsubaCol,seg:48,ez:.95}),
      lathe([[.103,0],[.103,.0255],[.108,.0285],[.150,.0285],[.157,.0265],[.162,.0235],[.162,0]],{col:goldCol,seg:32,ez:.6}),                                  // habaki (blade collar)
      lathe([[.100,0],[.100,.0235],[.096,.0262],[.082,.0262],[.076,.0245],[.074,0]],{col:goldCol,seg:32,ez:.76}),                                              // fuchi (handle collar)
      lathe([[-.266,0],[-.266,.012],[-.258,.0215],[-.24,.0255],[-.222,.0258],[-.218,.0245],[-.218,0]],{col:goldCol,seg:32,ez:.76})];                          // kashira (butt cap)
    for(const sd of[1,-1])for(const u of[-.04,-.14])trim.push(ball([0,-u,sd*.0185],.0075,GOLD,[1,1.5,.55]));                                                       // menuki
    addMesh(g,trim,metalMat());
    addMesh(g,tsuka,softMat({roughness:.8}));
    g.position.y=-SHIFT;g.scale.set(GIRTH,1,GIRTH);g.rotation.y=ROLL;   // tip lands at u=1.70 (.55 longer than the Wooden Sword) and the butt at about -.19, same as the Wooden Sword
    return {group:g};
  }
};
