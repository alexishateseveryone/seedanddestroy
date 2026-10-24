// Confetti: a party cannon. Chunky purple body, rainbow-striped barrel, scoop handle.
import * as T from 'three';
import {side,lathe,tube,mk,metal,matte,ring,muzzleTip} from './proc.js';
export default {
  id:'confetti',name:'Confetti',kind:'gun',handling:'rifle',lean:-.02,fore:[.55,-.12],
  stats:{cd:.11,dmg:1,spread:.22,speed:21,auto:true,kick:.5,shake:.12,push:.5,zoom:48,color:'#ff5cd6',move:.95,pellets:2,life:.6,mag:5, reload:0.4},
  build(){
    const g=new T.Group(),body=matte('#2a1f3d',.5),dbody=matte('#1a1426',.6),steel=metal('#464a5a',.4,.6),dark=matte('#0f0c16',.8);
    mk(side([[-.22,.14],[.0,.18],[.3,.17],[.36,.11],[.36,-.04],[.0,-.1],[-.22,-.05],[-.28,.05]],.2,{smooth:3,bevel:.022}),body,g);                  // chunky body
    mk(side([[-.18,.16],[.0,.2],[.26,.19],[.3,.16],[-.1,.16]],.12,{smooth:2,bevel:.01}),dbody,g);                                                  // top hump
    mk(side([[-.14,-.06],[.0,-.07],[-.06,-.34],[-.22,-.31]],.1,{smooth:4,bevel:.01}),dbody,g);                                                     // grip
    mk(tube([[.0,-.16,-.1],[.0,-.3,-.34],[.0,-.1,-.46],[.0,.02,-.3]],.022,20,6),steel,g); // handle loop
    const cols=['#ff3b5c','#ff9a2e','#ffe14a','#4be08a','#3aa8ff','#a05cff'];
    cols.forEach((c,i)=>mk(lathe([[.36+i*.09,.095],[.36+(i+1)*.09,.095]],22),matte(c,.4),g));                                                     // rainbow barrel
    mk(lathe([[.9,.1],[.93,.108],[.96,.1]],22),steel,g);                                                                                            // lip
    mk(new T.CircleGeometry(.092,20),dark,g,[0,-.962,0],[Math.PI/2,0,0]);                                                                           // dark mouth
    mk(ring(.1,.012),steel,g,[0,-.36,0]);
    mk(side([[.0,.2],[.04,.27],[.1,.27],[.14,.2]],.03,{smooth:2,bevel:.005}),steel,g);                                                              // sight
    [['#ff3b5c',.02],['#ffe14a',.1],['#3aa8ff',.18]].forEach(([c,u],i)=>mk(new T.SphereGeometry(1,8,6),matte(c,.4),g,[.105,-u-.02,.05+i*.02],[0,0,0],.022));  // buttons
    return {group:g,tip:muzzleTip(g,.97)};
  }
};