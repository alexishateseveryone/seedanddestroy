// Scythe: a reaper's scythe. Hand-built geometry, vertex colours only (blackened blade with a polished edge, ebony snath, gold fittings).
//   - blade  : faceted loft along a crescent centreline (integrated from a turning angle, so the curve is smooth). The edge is on the inner
//              side, the width tapers to a needle tip. Colour = bright polished edge fading into a dark gunmetal flat, one gold line by the spine.
//   - snath  : long lathed oval ebony shaft (very subtle grain), gold ferrule at the butt
//   - nib    : the little side handle (swept tube) with a gold cap
//   - mount  : gold collar where the blade meets the snath, with a dark ring
// The weapon points along -Y: grip at the origin, ferrule behind the hand, the mount at y = -1.2, the blade sweeps out to +X (about 1.5 wide) and curls back toward the hand.
import * as T from 'three';
import {PI,clamp,lerp,sm,C,grid,bands,lathe,tube,ball,vn,goldCol,metalMat,softMat,woodMat,addMesh} from './wlib.js';

const SIZE=1.35,LEN=1.15,ROLL=Math.PI/2;   // SIZE: overall scale. LEN: extra stretch along the length only. ROLL: turns the weapon about its own length so the broad face is seen from the side (same as Wooden Sword / Katana; edge points down, -Math.PI/2 flips it up)
const EBONY=C('#1c1b24'),EBONY_L=C('#2e2d3b'),GOLD=C('#c9a24a'),GOLD_D=C('#8f6f2a'),BEVEL=C('#f2f5fb'),POL=C('#b4bccb'),GUN=C('#262b39'),GUN_D=C('#1b1e29');

// ---- blade centreline: direction angle turns from slightly "up" to well "down" along the blade
const TOP=.3,BUTT=.35,TH=1.22;   // handle: extra length above the hand (TOP, the blade rides up with it) and behind it (BUTT), thickness multiplier (TH)
const BL=1.9,BW=4.8,BT=1.7;   // blade size: length (was .98), width (x BW) and thickness (x BT) of the blade, so the crescent towers over the cat
const LB=BL,PHI0=.22,PHI1=-1.35,BU0=1.195+TOP,BX0=0,NC=400,CL=[];
{let x=BX0,u=BU0;for(let i=0;i<=NC;i++){const t=i/NC,phi=lerp(PHI0,PHI1,Math.pow(t,1.15));CL.push({x,u,phi});x+=Math.cos(phi)*LB/NC;u+=Math.sin(phi)*LB/NC}}
const cl=t=>{const f=t*NC,i=Math.min(NC-1,Math.floor(f)),a=CL[i],b=CL[i+1],q=f-i;return{x:lerp(a.x,b.x,q),u:lerp(a.u,b.u,q),phi:lerp(a.phi,b.phi,q)}};
function bladeSec(t){
  const{x,u,phi}=cl(t),ix=Math.sin(phi),iu=-Math.cos(phi);                                   // (ix,iu): unit vector toward the edge side in the (x,u) plane
  const w=.092*BW*Math.pow(1-t,.6)*(.5+.5*sm(clamp(t/.14,0,1))),tz=.0092*BT*Math.sqrt(clamp((1-t)/.07,0,1))*lerp(1,.8,t)+.0004;
  const P=(a,z)=>[x+ix*a,-(u+iu*a),z];
  return[P(w,0),P(.78*w,.3*tz),P(0,tz),P(0,-tz),P(.78*w,-.3*tz)];                           // edge, bevel, spine (top / bottom)
}
function bladeCol(t,k,s,c){
  if(k===0||k===4){c.copy(BEVEL);return}
  if(k===2){c.copy(GUN_D);return}
  const x=k===1?s:1-s;                                                                        // 0 at the bevel, 1 at the spine
  c.copy(POL).lerp(GUN,sm(clamp(x/.55,0,1)));c.lerp(GOLD,(1-clamp(Math.abs(x-.9)/.09,0,1))*.9);
}

// ---- snath (long ebony handle)
const SU0=-.43-BUTT,SU1=1.2+TOP,snR=u=>TH*(.0215-.002*clamp((u-SU0)/(SU1-SU0),0,1));
const sp=[[SU0,0],[SU0+.003,.012]];for(let u=SU0+.03;u<SU1-.02;u+=.045)sp.push([u,snR(u)]);sp.push([SU1-.004,snR(SU1)],[SU1,0]);
const snCol=(u,r,th,c)=>c.copy(EBONY).lerp(EBONY_L,clamp(.35*Math.sin(th*5+u*4)+.5*vn(u*18,th),0,1)*.6);

const fit=(P,du,k=TH)=>P.map(([u,r])=>[u+du,r*k]);   // move a trim profile along the handle and thicken it with the handle

export default {
  id:'scythe',name:'Scythe',kind:'melee',handling:'sword',great:'shoulder',fore:[-.4,0],
  stats:{range:3,arc:.1,dmg:4.5,dur:.74,dash:.9,move:.95},
  build(){
    const g=new T.Group();
    addMesh(g,bands(80,10,bladeSec,bladeCol),metalMat({metalness:.6,roughness:.24}));
    addMesh(g,[lathe(sp,{col:snCol,seg:32,ez:.88}),tube([[-.012,-.40,0],[-.06,-.405,0],[-.10,-.39,0],[-.125,-.355,0]],{rx:.0095*TH,col:(t,th,c)=>snCol(0,0,th,c),per:6,nth:12,end:.08})],woodMat({roughness:.45,clearcoat:.9}));
    const trim=[
      lathe(fit([[-.45,0],[-.45,.012],[-.435,.0195],[-.41,.0225],[-.385,.0205],[-.385,0]],-BUTT),{col:goldCol,seg:28,ez:.88}),                                              // ferrule
      lathe(fit([[-.16,0],[-.16,.0215],[-.155,.0235],[-.14,.0235],[-.135,.0215],[-.135,0]],0),{col:goldCol,seg:28,ez:.88}),                                              // hand rings
      lathe(fit([[.135,0],[.135,.0205],[.14,.0225],[.155,.0225],[.16,.0205],[.16,0]],0),{col:goldCol,seg:28,ez:.88}),
      lathe(fit([[1.08,0],[1.08,.026],[1.10,.031],[1.13,.0285],[1.17,.028],[1.20,.0285],[1.225,.032],[1.255,.026],[1.27,0]],TOP),{col:(u,r,th,c)=>{c.copy(GOLD).lerp(GOLD_D,.3+.25*Math.sin(th*2));if(u>1.165+TOP&&u<1.205+TOP)c.copy(GUN)},seg:32,ez:.9}),   // blade mount
      ball([-.125,-.355,0],.0125*TH,GOLD)];                                                                                                                         // nib cap
    addMesh(g,trim,metalMat());
    g.scale.set(SIZE,SIZE*LEN,SIZE);g.rotation.y=ROLL;
    return {group:g};
  }
};
