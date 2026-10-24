// Spear: long wooden shaft (lathe), leaf-shaped steel head, collar and tassel. Two-handed thrust.
import * as T from 'three';
import {side,lathe,mk,metal,matte,ring} from './proc.js';
export default {
  id:'spear',name:'Spear',kind:'melee',handling:'spear',fore:[.55,0],
  stats:{range:3.9,arc:.6,dmg:4,dur:.6,dash:1.6,move:.95},
  build(){
    const g=new T.Group(),wood=matte('#8a5a2b',.65),dwood=matte('#5f3b1a',.7),steel=metal('#cfd6e2',.25,.7),gold=metal('#c9a24a',.35,.5),red=matte('#c0392b',.8);
    mk(lathe([[-.4,.03],[-.3,.036],[.2,.04],[.9,.036],[1.05,.03]],14),wood,g);                                                 // shaft
    mk(lathe([[-.46,.022],[-.4,.045],[-.34,.05],[-.3,.038]],14),gold,g);                                                       // butt cap
    mk(lathe([[.98,.04],[1.03,.058],[1.1,.06],[1.14,.04]],16),gold,g);                                                         // collar
    mk(side([[1.12,.045],[1.2,.095],[1.38,.105],[1.6,.04],[1.72,0],[1.6,-.04],[1.38,-.105],[1.2,-.095],[1.12,-.045]],.035,{smooth:4,bevel:.008}),steel,g); // leaf head
    mk(side([[1.14,.012],[1.6,.008],[1.6,-.008],[1.14,-.012]],.05,{bevel:.005}),metal('#8d97aa',.35,.6),g);                    // central ridge
    for(let i=0;i<5;i++){const a=i/5*Math.PI*2;                                                                                // tassel strands
      mk(new T.ConeGeometry(.018,.2,6),red,g,[Math.sin(a)*.045,-.9,Math.cos(a)*.045],[Math.PI-Math.cos(a)*.3,0,Math.sin(a)*.3]);}
    mk(ring(.04,.01),dwood,g,[0,-.55,0]);mk(ring(.04,.01),dwood,g,[0,-.15,0]);                                                 // grip wraps
    return {group:g};
  }
};