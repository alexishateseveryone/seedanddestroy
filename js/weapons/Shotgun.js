// Shotgun: a pump-action. Hand-built geometry, vertex colours only (blued steel, matte black receiver, polished walnut, brass/gold accents).
//   - receiver : lofted rounded-box body with a dark ejection port
//   - barrel   : lathed barrel with a hollow bore, vent rib on top and a gold bead sight
//   - magazine : lathed tube under the barrel with a gold end cap, joined to the barrel by a gold clamp
//   - forend   : walnut pump grip with cut grooves
//   - stock    : lofted walnut stock (straight comb, dipped wrist, taller butt) with a dark recoil pad
//   - guard    : swept tube trigger guard + gold trigger
// Built in (u forward, v up, w sideways) and mapped to the group as x=w, y=-u, z=v (same as the other guns). Muzzle at u = .875.
import * as T from 'three';
import {PI,clamp,lerp,sm,C,grid,lathe,tube,ball,cap,se,h2,vn,goldCol,metalMat,woodMat,addMesh} from './wlib.js';
import {muzzleTip} from './proc.js';

const P=(u,v,w)=>[w,-u,v],VC=.06;                          // height of the barrel axis
const BLUE=C('#343c52'),RCV=C('#252937'),RCV_L=C('#3a4054'),PORT=C('#0d0e15'),RIB=C('#14161f'),GOLD=C('#c9a24a'),PAD=C('#15161d'),WALN=C('#5a3921'),WALN_L=C('#8a5b36');
const wood=(u,th,c)=>{const g=.5+.5*Math.sin(th*3+u*9+Math.sin(u*31)*.7);c.copy(WALN).lerp(WALN_L,clamp(g*.55+.3*vn(u*12,th),0,1))};
const steelCol=(u,r,th,c)=>c.copy(BLUE).multiplyScalar(.8+.35*Math.max(0,Math.sin(th)));

// ---- receiver
const receiver=grid(60,28,(t,th,o)=>{
  const u=lerp(-.035,.345,t),k=cap(t,.03),[a,b]=se(th,4.2),top=.094-.006*sm(clamp((u-.30)/.05,0,1)),bot=-.03,hw=.0265-.003*sm(clamp((u-.28)/.07,0,1)),v=(top+bot)/2+(top-bot)/2*a*k;
  o.p=P(u,v,hw*b*k);o.c.copy(RCV).lerp(RCV_L,clamp(a*.5+.3,0,1)*.45);
  if(b>.9&&u>.10&&u<.24&&v>.05&&v<.085)o.c.copy(PORT)});                                    // ejection port

// ---- stock: straight comb, dipped wrist, taller butt
const stock=grid(50,26,(t,th,o)=>{
  const u=lerp(-.015,-.43,t),k=cap(t,.03),[a,b]=se(th,3.4),top=.088-.04*t,bot=.015-.04*t-.07*sm(clamp((t-.4)/.6,0,1)),hw=.019+.003*t;
  o.p=P(u,(top+bot)/2+(top-bot)/2*a*k,hw*b*k);wood(u,th,o.c);if(t>.965)o.c.copy(PAD)});

// ---- pump forend (grooves on the underside)
const forend=grid(50,32,(t,th,o)=>{
  const u=lerp(.40,.61,t),k=cap(t,.07),[a,b]=se(th,2.6),gr=Math.pow(Math.max(0,Math.sin(u*160)),2)*sm(clamp(-a*2,0,1)),r=1-.075*gr;
  o.p=P(u,VC-.046+.0268*a*k*r,.0255*b*k*r);wood(u,th,o.c);o.c.multiplyScalar(1-.25*gr)});

// ---- barrel details
const rib=grid(30,14,(t,th,o)=>{const k=cap(t,.02),[a,b]=se(th,4);o.p=P(lerp(.31,.862,t),VC+.0205+.0032*a*k,.0048*b*k);o.c.copy(RIB)});
const clampBand=grid(10,24,(t,th,o)=>{const k=cap(t,.18),[a,b]=se(th,3.5);o.p=P(lerp(.66,.684,t),VC-.023+.046*a*k,.0215*b*k);o.c.copy(GOLD).lerp(C('#8f6f2a'),.25+.2*Math.sin(th*2))});

const barrelP=[[.30,0],[.30,.0195],[.86,.0195],[.866,.0205],[.874,.0205],[.8745,.013],[.8665,.0125],[.8665,0]];
const barrelCol=(u,r,th,c)=>{if(r<.0135&&u>.866)c.set('#07070b');else steelCol(u,r,th,c)};

export default {
  id:'shotgun',name:'Shotgun',kind:'gun',handling:'rifle',lean:0,
  stats:{cd:.8,dmg:.8,spread:.11,speed:34,auto:false,kick:1.6,shake:.3,push:1.2,zoom:48,color:'#ffd27a',move:.95,pierce:0,mag:6,reload:2.2,pellets:8},
  build(){
    const g=new T.Group(),TV=VC-.046;
    addMesh(g,[receiver,
      lathe(barrelP,{col:barrelCol,seg:32,cz:VC}),rib,
      lathe([[.30,0],[.30,.0155],[.745,.0155],[.76,.0165],[.762,0]],{col:steelCol,seg:24,cz:TV})],metalMat({metalness:.5,roughness:.3}));
    addMesh(g,[clampBand,
      lathe([[.296,0],[.296,.0225],[.300,.0235],[.316,.0235],[.320,.0225],[.320,0]],{col:goldCol,seg:32,cz:VC}),                           // breech ring
      lathe([[.735,0],[.735,.0175],[.74,.0185],[.76,.0185],[.768,.0165],[.77,0]],{col:goldCol,seg:24,cz:TV}),                               // magazine cap
      ball(P(.858,VC+.0238,0),.0042,GOLD),                                                                                                  // bead sight
      tube([P(.125,-.035,0),P(.12,-.06,0),P(.108,-.08,0)],{rx:.0055,col:GOLD,per:5,nth:10})],metalMat({metalness:.65,roughness:.28}));        // trigger
    addMesh(g,[tube([P(.04,-.03,0),P(.05,-.07,0),P(.10,-.092,0),P(.17,-.086,0),P(.205,-.045,0),P(.21,-.03,0)],{rx:.0075,col:C('#3a4054'),per:6,nth:10})],metalMat());   // trigger guard
    addMesh(g,[stock,forend],woodMat({roughness:.5}));
    return {group:g,tip:muzzleTip(g,.875,VC)};
  }
};