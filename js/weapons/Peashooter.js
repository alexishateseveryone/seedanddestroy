// Peashooter: a leafy green pistol with a flared mouth.
import * as T from 'three';
import {side,lathe,mk,matte,ring,muzzleTip} from './proc.js';
export default {
  id:'peashooter',name:'Peashooter',kind:'gun',handling:'pistol',lean:0,
  stats:{cd:.22,dmg:1,spread:.09,speed:24,auto:true,kick:1,shake:.1,push:1.2,zoom:44,color:'#9be84f',move:1},
  build(){
    const g=new T.Group(),green=matte('#58c23a',.5),dgreen=matte('#2f8a2a',.6),dark=matte('#1f2a1c',.8),pod=matte('#8fe05a',.45);
    mk(side([[-.14,.1],[.1,.125],[.3,.095],[.32,.0],[.3,-.06],[.04,-.075],[-.14,-.06]],.13,{smooth:5}),green,g);       // frame
    mk(side([[-.14,-.04],[.0,-.04],[-.03,-.3],[-.18,-.28]],.11,{smooth:4}),dgreen,g);                                  // grip
    mk(lathe([[.2,.05],[.4,.06],[.5,.075],[.56,.115],[.62,.145],[.65,.13],[.66,.07]],24),green,g);                    // barrel with flared mouth
    mk(ring(.075,.013),dgreen,g,[0,-.45,0]);mk(ring(.14,.014),dgreen,g,[0,-.62,0]);                                     // bands
    mk(new T.CircleGeometry(.105,18),dark,g,[0,-.667,0],[Math.PI/2,0,0]);                                               // dark mouth
    mk(new T.SphereGeometry(1,14,10),pod,g,[0,-.6,0],[0,0,0],[.07,.07,.07]);                                            // pea in the barrel
    [-1,1].forEach(s=>mk(new T.SphereGeometry(1,12,8),dgreen,g,[s*.09,-.06,.1],[0,0,s*.5],[.045,.17,.09]));            // little leaves
    return {group:g,tip:muzzleTip(g,.7)};
  }
};