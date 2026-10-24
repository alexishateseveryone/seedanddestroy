// Machine Gun: heavy receiver, ventilated barrel shroud, carry handle, bipod and a draped ammo belt.
import * as T from 'three';
import {side,lathe,tube,mk,metal,matte,ring,muzzleTip} from './proc.js';
export default {
  id:'machinegun',name:'Machine Gun',kind:'gun',handling:'lmg',lean:-.07,fore:[.62,-.1],
  stats:{cd:.065,dmg:1,spread:.13,speed:28,auto:true,kick:.35,shake:.14,push:.25,zoom:52,color:'#ffb347',move:.78,scopeSteady:.4,mag:50, reload:1.1},
  build(){
    const g=new T.Group(),steel=metal('#3a3f48'),dark=matte('#24272e',.6),od=matte('#4a5a3a',.7),brass=metal('#d9b24a',.3,.7),wood=matte('#7a4a22',.65);
    mk(side([[-.18,.12],[.2,.14],[.55,.12],[.6,.08],[.6,-.08],[.2,-.1],[-.18,-.09]],.14,{smooth:3}),steel,g);                 // receiver
    mk(side([[-.1,.14],[.3,.17],[.5,.15],[.5,.13],[-.1,.12]],.1,{smooth:2,bevel:.008}),dark,g);                               // feed cover
    mk(side([[-.16,-.05],[.0,-.06],[-.06,-.34],[-.22,-.31]],.1,{smooth:4}),dark,g);                                           // pistol grip
    mk(side([[-.18,.09],[-.46,.1],[-.7,.06],[-.74,-.14],[-.5,-.2],[-.3,-.1],[-.18,-.07]],.12,{smooth:4}),wood,g);              // butt stock
    mk(side([[.06,-.1],[.4,-.1],[.42,-.34],[.04,-.34]],.2,{smooth:3,bevel:.015}),od,g);                                       // ammo box
    mk(lathe([[.6,.05],[1.28,.05]],14),steel,g);                                                                               // heavy barrel
    mk(lathe([[.6,.085],[.7,.09],[.72,.07],[.78,.09],[.8,.07],[.86,.09],[.88,.07],[.94,.09],[1.0,.085]],20),dark,g);           // ventilated shroud
    mk(lathe([[1.28,.05],[1.34,.07],[1.42,.07],[1.46,.05]],16),steel,g);                                                       // flash hider
    mk(tube([[-.06,-.52,.15],[.0,-.62,.3],[.0,-.78,.3],[-.06,-.86,.16]].map(p=>[p[0],p[1],p[2]]),.022,16,6),steel,g);          // carry handle (arch)
    // folded bipod
    [-1,1].forEach(s=>{mk(tube([[s*.03,-.9,-.06],[s*.1,-.98,-.12],[s*.16,-1.12,-.16]],.014,10,6),steel,g)});
    // ammo belt: brass rounds draped from the box up into the feeder
    const belt=[[.1,-.12,-.1],[.12,-.1,-.06],[.1,-.14,.0],[.06,-.18,.06],[.02,-.22,.1]];
    for(let i=0;i<9;i++){const t=i/8,x=.095*Math.sin(t*3.1),y=-.1-.11*t,z=-.1+.22*t;
      mk(new T.CapsuleGeometry(.018,.05,3,8),brass,g,[x,-y*0-.12-.06*t,z],[0,0,Math.PI/2+.3]);}
    return {group:g,tip:muzzleTip(g,1.5)};
  }
};