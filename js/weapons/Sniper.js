// Sniper: long barrel with suppressor, big lens scope, skeleton thumbhole stock, bolt handle.
import * as T from 'three';
import {side,lathe,tube,mk,metal,matte,glass,ring,muzzleTip} from './proc.js';
export default {
  id:'sniper',name:'Sniper',kind:'gun',handling:'sniper',lean:.05,fore:[.7,-.08],
  stats:{cd:.95,dmg:5,spread:.025,speed:62,auto:false,kick:2.4,shake:.35,push:2.6,zoom:18,color:'#c8f0ff',pierce:2,size:1.7,move:.85,scopeSteady:.95,life:1.2,mag:1, reload:1.1,after:1},   // after:1 = big aftershock (shock rings, ground wave, mach crescents, vapour trail, lingering smoke)
  build(){
    const g=new T.Group(),steel=metal('#2e333d'),dark=matte('#1b1d23',.55),stock=matte('#2f3a2a',.65),lens=glass('#4aa8ff',.8);
    mk(side([[-.12,.09],[.3,.1],[.7,.085],[.74,.05],[.74,-.05],[.2,-.08],[-.12,-.07]],.09,{smooth:3}),steel,g);             // action
    mk(side([[-.14,.075],[-.4,.1],[-.8,.07],[-.84,-.04],[-.6,-.1],[-.5,-.22],[-.3,-.24],[-.26,-.08],[-.14,-.06]],.085,{smooth:4}),stock,g);  // stock outline
    mk(side([[.5,-.07],[.8,-.07],[.9,-.1],[.9,-.14],[.5,-.14]],.07,{smooth:2}),stock,g);                                    // fore-end
    mk(side([[-.14,-.05],[0,-.06],[-.04,-.3],[-.2,-.27]],.08,{smooth:4}),dark,g);                                           // grip
    mk(side([[.14,-.07],[.3,-.07],[.31,-.2],[.13,-.21]],.06,{smooth:2}),dark,g);                                            // magazine
    mk(lathe([[.74,.026],[1.5,.034]],14),steel,g);                                                                          // long barrel
    mk(lathe([[1.38,.05],[1.5,.062],[1.72,.062],[1.78,.05]],20),dark,g);                                                     // suppressor
    // scope: tube with bulbous ends + lenses + mounts
    mk(lathe([[.05,.04],[.12,.075],[.2,.06],[.6,.06],[.68,.075],[.74,.04]],22),dark,g,[0,0,.17]);
    [.1,.7].forEach(u=>mk(new T.CircleGeometry(.062,16),lens,g,[0,-(u<.4?u-.06:u+.06),.17],[Math.PI/2*(u<.4?-1:1),0,0]));
    [.22,.55].forEach(u=>mk(ring(.062,.012),steel,g,[0,-u,.17]));
    [.22,.55].forEach(u=>mk(side([[u-.03,.1],[u+.03,.1],[u+.02,.17],[u-.02,.17]],.03,{bevel:.004}),steel,g));
    // bolt handle
    mk(tube([[.05,-.05,.01],[.14,-.05,.02],[.2,-.07,-.01]],.012,8,6),steel,g);mk(new T.SphereGeometry(1,10,8),steel,g,[.2,-.07,-.01],[0,0,0],.026);
    // folded bipod
    [-1,1].forEach(s=>mk(tube([[s*.03,-.86,-.07],[s*.07,-.94,-.12],[s*.1,-1.06,-.15]],.012,10,6),steel,g));
    return {group:g,tip:muzzleTip(g,1.82)};
  }
};
