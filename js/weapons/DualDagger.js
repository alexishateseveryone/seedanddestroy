// Dual Dagger: two curved blades (one per hand). build() returns the main-hand blade and the off-hand blade.
import * as T from 'three';
import {side,lathe,mk,metal,matte,ring} from './proc.js';
const dagger=()=>{
  const g=new T.Group(),steel=metal('#c9d2e0',.22,.7),dark=matte('#1d1b24',.7),red=matte('#c0392b',.55),gold=metal('#c9a24a',.35,.5);
  mk(side([[.1,.04],[.3,.07],[.5,.068],[.68,.0],[.7,-.012],[.5,.0],[.3,-.03],[.1,-.04]],.03,{smooth:4,bevel:.007}),steel,g);   // curved blade
  mk(side([[.12,.012],[.5,.012],[.5,-.006],[.12,-.006]],.036,{bevel:.004}),metal('#7d8798',.4,.6),g);                          // fuller
  mk(side([[.06,.0],[.1,.1],[.14,.06],[.14,-.06],[.1,-.1]],.05,{smooth:4,bevel:.008}),gold,g);                                // guard
  mk(lathe([[-.2,.034],[-.1,.04],[0,.042],[.06,.038]],14),dark,g);                                                             // grip
  [-.15,-.07,.01].forEach(u=>mk(ring(.043,.009),red,g,[0,-u,0]));                                                              // wrap
  mk(new T.TorusGeometry(.06,.012,8,16),gold,g,[0,.24,0],[0,Math.PI/2,0]);                                                     // ring pommel
  return g;
};
export default {
  id:'dualdagger',name:'Dual Dagger',kind:'melee',handling:'dual',
  stats:{range:2.2,arc:-.35,dmg:2,dur:.42,dash:.7,move:1.1},
  build(){return {group:dagger(),off:dagger()}}
};