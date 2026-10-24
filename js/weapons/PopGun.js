// Pop Gun: a steampunk scatter-pistol. Big brass gear, riveted dark body, corked trumpet muzzle.
import * as T from 'three';
import {side,lathe,mk,metal,matte,ring,muzzleTip} from './proc.js';
const gear=(cx,cz,r1,r2,n)=>{const p=[];for(let i=0;i<n*4;i++){const a=i/(n*4)*Math.PI*2,r=(i%4<2)?r2:r1;p.push([cx+Math.cos(a)*r,cz+Math.sin(a)*r])}return p};
export default {
  id:'popgun',name:'Pop Gun',kind:'gun',handling:'pistol',lean:0,
  stats:{cd:.62,dmg:1,spread:.2,speed:25,auto:false,kick:2,shake:.22,push:2,zoom:44,color:'#ffc766',move:1,pellets:5,life:.5,mag:25, reload:1.1},
  build(){
    const g=new T.Group(),dark=metal('#262836',.45,.5),ink=matte('#1c1d28',.7),brass=metal('#c9a24a',.32,.75),lbrass=metal('#e8c86a',.3,.75),steel=metal('#8d93a6',.35,.7),cork=matte('#c99a5b',.8);
    mk(side([[-.16,.1],[.0,.12],[.3,.1],[.34,.04],[.3,-.05],[.0,-.08],[-.16,-.05]],.13,{smooth:4,bevel:.012}),dark,g);                  // body
    mk(side([[-.14,-.04],[.0,-.05],[-.04,-.32],[-.2,-.3]],.095,{smooth:4,bevel:.01}),ink,g);                                              // grip
    mk(side(gear(.1,.15,.14,.185,10),.05,{bevel:.006}),brass,g,[.075,0,0]);                                                               // big gear
    mk(new T.TorusGeometry(.095,.016,8,24),lbrass,g,[.1,-.1,.15],[0,Math.PI/2,0]);                                                         // gear ring
    mk(new T.SphereGeometry(1,12,10),lbrass,g,[.1,-.1,.15],[0,0,0],.04);                                                                  // hub
    for(let i=0;i<4;i++){const a=i*Math.PI/2;mk(new T.BoxGeometry(.012,.012,.17),steel,g,[.1,-.1,.15],[a/2,0,0]);}                         // spokes
    mk(side(gear(.1,.15,.1,.135,8),.04,{bevel:.005}),steel,g,[-.07,0,0]);                                                                  // small back gear
    mk(lathe([[.3,.068],[.5,.072],[.56,.095],[.7,.1],[.76,.125],[.84,.16],[.88,.15]],24),ink,g);                                            // barrel flaring to a trumpet
    mk(ring(.1,.015),steel,g,[0,-.56,0]);mk(ring(.105,.012),brass,g,[0,-.7,0]);                                                           // bands
    mk(new T.CylinderGeometry(.1,.1,.08,16),cork,g,[0,-.86,0]);                                                                            // cork plug
    for(let i=0;i<9;i++){const a=i/9*Math.PI*2,c=mk(new T.ConeGeometry(.016,.13,6),ink,g,[Math.sin(a)*.14,-.92,Math.cos(a)*.14]);c.rotation.set(-Math.PI/2+Math.cos(a)*.35,0,-Math.sin(a)*.35)}   // frayed rim
    [.04,.2].forEach(u=>mk(new T.SphereGeometry(1,8,6),lbrass,g,[.07,-u,.04],[0,0,0],.014));                                               // rivets
    return {group:g,tip:muzzleTip(g,.97)};
  }
};