// AK-47: smooth profile receiver, banana magazine, wood furniture, gas tube.
import * as T from 'three';
import {side,lathe,mk,metal,matte,ring,muzzleTip} from './proc.js';
export default {
  id:'ak47',name:'AK-47',kind:'gun',handling:'rifle',lean:.03,fore:[.78,-.09],
  stats:{cd:.11,dmg:1,spread:.08,speed:30,auto:true,kick:.7,shake:.13,push:.6,zoom:46,color:'#ffd27a',move:1},
  build(){
    const g=new T.Group(),steel=metal('#3d424d'),dark=matte('#22252c',.65),wood=matte('#a2602f',.55),dwood=matte('#6b3d1c',.6);
    mk(side([[-.1,.1],[.2,.11],[.55,.1],[.6,.07],[.6,-.06],[.1,-.085],[-.1,-.07]],.1,{smooth:3}),steel,g);                 // receiver
    mk(side([[-.08,.098],[.22,.14],[.52,.118],[.58,.1],[.1,.095]],.09,{smooth:3,bevel:.008}),steel,g);                      // dust cover
    mk(side([[-.12,-.04],[.02,-.05],[-.02,-.3],[-.17,-.28]],.085,{smooth:4}),dark,g);                                        // pistol grip
    mk(side([[.14,-.06],[.28,-.06],[.31,-.16],[.39,-.3],[.29,-.335],[.2,-.2],[.13,-.12]],.075,{smooth:3}),dark,g);           // curved magazine
    mk(side([[.58,.085],[.92,.075],[.96,.04],[.96,-.05],[.92,-.075],[.58,-.08]],.11,{smooth:4}),wood,g);                     // handguard
    mk(side([[-.1,.075],[-.34,.115],[-.6,.085],[-.64,-.1],[-.42,-.13],[-.3,-.06],[-.1,-.055]],.095,{smooth:4}),wood,g);       // stock
    mk(lathe([[.92,.028],[1.06,.028],[1.1,.04],[1.17,.046],[1.23,.04]],16),steel,g);                                         // barrel + muzzle brake
    mk(lathe([[.5,.026],[.92,.026]],10),steel,g,[0,0,.092]);                                                                 // gas tube
    mk(side([[1.0,.028],[1.02,.085],[1.07,.085],[1.07,.028]],.02,{bevel:.004}),steel,g);                                      // front sight
    mk(side([[.12,.1],[.22,.125],[.3,.125],[.34,.1]],.03,{smooth:2,bevel:.005}),steel,g);                                    // rear sight
    mk(ring(.045,.01),steel,g,[0,-.93,0]);
    return {group:g,tip:muzzleTip(g,1.3)};
  }
};