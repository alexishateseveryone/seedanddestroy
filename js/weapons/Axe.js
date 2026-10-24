// Axe: a bearded battle axe. Hand-built geometry, vertex colours only (polished steel, walnut haft, dark leather, gold inlay).
//   - head   : faceted loft along the cutting edge. The edge is a convex crescent with a swept lower beard, the body is thickest at the eye.
//              Colour = bright bevel, steel face that darkens toward the eye, one thin gold inlay line following the edge.
//   - haft   : lathed oval walnut shaft with a flared knob, slight taper and soft grain streaks
//   - grip   : leather sleeve with a diagonal stitched wrap, framed by two gold collars
//   - socket : flanged steel collar around the eye, plus a spike that continues the haft past the head, and two gold rivets
// The weapon points along -Y: grip at the origin, the knob behind the hand, the head near y = -.8, the spike tip at y = -1.22. The edge faces +X.
import * as T from 'three';
import {PI,clamp,lerp,sm,C,grid,bands,lathe,ball,cap,h2,vn,goldCol,metalMat,softMat,woodMat,addMesh} from './wlib.js';

const WOOD=C('#5a3921'),WOOD_L=C('#8a5b36'),LEATHER=C('#241b1c'),STITCH=C('#3d302d'),GOLD=C('#c9a24a');
const BEVEL=C('#f3f6fb'),FACE=C('#a3adc0'),DARKF=C('#4f566a'),BACK=C('#3b4152'),STEEL_D=C('#6e788d'),STEEL=C('#aab3c4');

// ---- haft
const haftR=u=>.0205-.0022*clamp(u/1.1,0,1)+.0075*Math.exp(-Math.pow((u+.275)/.035,2));
const hp=[[-.305,0],[-.302,.013],[-.294,.021]];for(let u=-.27;u<=1.095;u+=.04)hp.push([u,haftR(u)]);hp.push([1.1,.0165],[1.103,0]);
const woodCol=(u,r,th,c)=>{const g=.5+.5*Math.sin(th*7+Math.sin(u*9)*1.3);c.copy(WOOD).lerp(WOOD_L,clamp(g*.5+.35*vn(u*14,th*1.3),0,1))};
const GU0=-.22,GU1=.22;
const grip=grid(70,32,(t,th,o)=>{
  const u=lerp(GU0,GU1,t),k=cap(t,.02),w=Math.sin(u*85+th*2),r=(haftR(u)+.0032+.0011*Math.max(0,w))*k;
  o.p=[r*Math.cos(th),-u,r*Math.sin(th)*.82];o.c.copy(LEATHER).lerp(STITCH,clamp(w*1.2-.2,0,1)*.8)});
const collar=u0=>{const r=haftR(u0)+.0042;return lathe([[u0,0],[u0,r],[u0+.005,r+.0025],[u0+.017,r+.0025],[u0+.022,r],[u0+.022,0]],{col:goldCol,seg:32,ez:.82})};

// ---- head: sections along the edge (t=0 beard tip ... t=1 top horn), each a 7-point polygon from the edge back toward the haft
const HU0=.52,HU1=1.07;
const xe=t=>.17+.07*Math.sin(PI*t)+.05*Math.pow(1-t,3);              // how far the edge sticks out from the haft
const dep=t=>Math.pow(Math.sin(PI*t),.72);                           // 0 at the horns, 1 at the eye
function headSec(t){
  const u=lerp(HU0,HU1,t),y=-u,e=xe(t),D=e*dep(t),k=cap(t,.05),tb=.027*(.55+.45*dep(t)),tm=.016*(.6+.4*dep(t));
  const P=(d,z)=>[e-d*D,y,z*k];
  return[P(0,0),P(.14,.0075),P(.5,tm),P(1,tb),P(1,-tb),P(.5,-tm),P(.14,-.0075)];
}
function headCol(t,k,s,c){
  if(k===0||k===6){c.copy(BEVEL);return}
  if(k===3){c.copy(BACK);return}
  if(k===1||k===5){const x=k===1?s:1-s;c.copy(BEVEL).lerp(FACE,sm(x));return}
  const x=k===2?s:1-s,de=dep(t);                                       // the big face: steel, darker toward the eye, one gold inlay line
  c.copy(FACE).lerp(DARKF,sm(clamp((x-.55)/.45,0,1))*.6);
  c.lerp(GOLD,(1-clamp(Math.abs(x-.25)/.09,0,1))*clamp((de-.2)/.3,0,1)*.95);
}

export default {
  id:'axe',name:'Battle Axe',kind:'melee',handling:'sword',
  stats:{range:2.5,arc:-.1,dmg:5.5,dur:.68,dash:.8,move:.92},
  build(){
    const g=new T.Group();
    addMesh(g,[lathe(hp,{col:woodCol,seg:36,ez:.82})],woodMat({roughness:.55}));
    addMesh(g,[grip],softMat({roughness:.85}));
    addMesh(g,bands(64,12,headSec,headCol),metalMat({metalness:.6,roughness:.24}));
    const trim=[collar(GU0-.012),collar(GU1-.01),
      lathe([[.66,0],[.66,.030],[.675,.0345],[.70,.0345],[.72,.0315],[.86,.0315],[.88,.0345],[.905,.0345],[.92,.030],[.92,0]],{col:(u,r,th,c)=>c.copy(STEEL_D).lerp(STEEL,.4+.3*Math.sin(th)),seg:36,ez:.95}),   // socket
      lathe([[1.09,0],[1.09,.0195],[1.10,.024],[1.115,.0225],[1.13,.017],[1.17,.007],[1.225,0]],{col:(u,r,th,c)=>c.copy(STEEL).lerp(BEVEL,clamp((u-1.13)/.09,0,1)),seg:28,ez:.9})];                  // top spike
    for(const sd of[1,-1])trim.push(ball([.075,-.79,sd*.0205],.0075,GOLD,[1,1,.6]));                                                                                                                   // rivets
    addMesh(g,trim,metalMat());
    return {group:g};
  }
};