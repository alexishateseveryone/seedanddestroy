// Gunslinger: a long-barrelled six-shooter. Navy steel, fluted cylinder, golden grip, spur hammer.
import * as T from 'three';
import {side,lathe,mk,metal,matte,ring,muzzleTip} from './proc.js';
export default {
  id:'gunslinger',name:'Gunslinger',kind:'gun',handling:'pistol',lean:0,
  stats:{cd:.1,dmg:3,spread:.018,speed:46,auto:false,kick:1.9,shake:.2,push:1.6,zoom:38,color:'#ffd24a',move:1,scopeSteady:.8,mag:6, reload:1.1},
  build(){
    const g=new T.Group(),steel=metal('#30345a',.34,.65),dsteel=metal('#1d2040',.4,.6),gold=matte('#f2b632',.5),dgold=matte('#b97a1c',.6),brass=metal('#d9b24a',.3,.7);
    mk(side([[-.17,.11],[-.1,.15],[.04,.15],[.16,.13],[.38,.125],[.38,.055],[.16,.045],[.1,-.03],[-.1,-.03],[-.17,.0]],.075,{smooth:2,bevel:.008}),steel,g);   // frame
    mk(lathe([[.1,.092],[.36,.092]],20),dsteel,g,[0,0,.035]);                                                                                                 // cylinder
    [.115,.235,.345].forEach(u=>mk(ring(.094,.012,18),steel,g,[0,-u,.035]));
    for(let i=0;i<6;i++){const a=i/6*Math.PI*2;mk(new T.CylinderGeometry(.018,.018,.2,8),dsteel,g,[Math.sin(a)*.094,-.235,.035+Math.cos(a)*.094]);}  // flutes
    mk(lathe([[.36,.042],[.98,.044]],18),steel,g,[0,0,.092]);                                                                                                 // long barrel
    mk(side([[.36,.1],[.96,.088],[.96,.135],[.36,.15]],.028,{bevel:.004}),dsteel,g);                                                                          // top rib
    mk(side([[.34,.07],[.8,.07],[.8,.0],[.34,.01]],.055,{smooth:1,bevel:.006}),steel,g);                                                                      // ejector shroud
    mk(ring(.05,.01),brass,g,[0,-.96,.092]);                                                                                                                  // muzzle ring
    mk(side([[.9,.136],[.93,.17],[.97,.136]],.012,{bevel:.003}),brass,g);                                                                                     // front sight
    mk(side([[-.16,.12],[-.24,.19],[-.19,.205],[-.1,.15]],.03,{smooth:1,bevel:.005}),dsteel,g);                                                               // hammer
    mk(side([[-.1,-.03],[.04,-.03],[.0,-.12],[-.02,-.3],[-.2,-.31],[-.27,-.15],[-.2,.0]],.085,{smooth:3,bevel:.01}),gold,g);                                // grip
    mk(side([[-.07,-.045],[.0,-.045],[-.03,-.2],[-.1,-.2]],.09,{smooth:2,bevel:.006}),dgold,g);                                                               // grip plate
    mk(side([[.02,-.02],[.22,-.02],[.22,-.11],[.12,-.16],[.04,-.12]],.026,{smooth:2,bevel:.004,holes:[[[.07,-.04],[.18,-.04],[.18,-.1],[.115,-.125],[.07,-.1]]]}),steel,g); // trigger guard
    mk(side([[.08,-.03],[.12,-.03],[.1,-.09],[.07,-.09]],.012,{bevel:.003}),dsteel,g);                                                                        // trigger
    return {group:g,tip:muzzleTip(g,1.02,.092)};
  }
};