// Armalite (AR-15 style): flat-top upper, round ribbed handguard, straight mag, tube stock.
import * as T from 'three';
import {side,lathe,mk,metal,matte,ring,muzzleTip} from './proc.js';
export default {
  id:'armalite',name:'Armalite',kind:'gun',handling:'rifle',lean:.02,fore:[.7,-.075],
  sfx:{shoot:'assets/sfx/weapons/armalite.mp3',vol:.6,pitch:.01},   // gun sound: your file, played at +-8% random pitch. Melee weapons use slash:'...' instead
  stats:{cd:.09,dmg:1,spread:.045,speed:34,auto:true,kick:.5,shake:.1,push:.4,zoom:44,color:'#ffe7a0',move:1,mag:20, reload:1.1},
  build(){
    const g=new T.Group(),poly=matte('#1e2026',.55),steel=metal('#454a55'),dsteel=metal('#2c3038');
    mk(side([[-.08,.1],[.5,.105],[.54,.07],[.54,-.01],[-.08,-.01]],.1,{smooth:3}),dsteel,g);                                    // upper receiver
    mk(side([[-.08,-.01],[.34,-.01],[.34,-.09],[.14,-.095],[.02,-.11],[-.08,-.08]],.1,{smooth:3}),poly,g);                     // lower receiver
    mk(side([[-.06,.1],[.44,.1],[.44,.13],[-.06,.13]],.05,{bevel:.006}),steel,g);                                              // flat-top rail
    mk(side([[-.05,.13],[.0,.17],[.06,.17],[.1,.13]],.035,{smooth:2,bevel:.005}),steel,g);                                     // rear sight
    mk(side([[-.14,-.05],[.0,-.06],[-.05,-.3],[-.19,-.27]],.085,{smooth:4}),poly,g);                                           // grip
    mk(side([[.12,-.09],[.24,-.09],[.245,-.34],[.115,-.36]],.07,{smooth:2}),poly,g);                                           // straight magazine
    mk(lathe([[-.55,.05],[-.1,.05]],14),dsteel,g);                                                                              // buffer tube
    mk(side([[-.2,.07],[-.58,.085],[-.62,-.09],[-.26,-.06]],.08,{smooth:4}),poly,g);                                           // stock
    mk(lathe([[.54,.062],[.62,.07],[.7,.062],[.78,.07],[.86,.062],[.94,.07]],20),poly,g);                                      // ribbed round handguard
    mk(lathe([[.94,.026],[1.12,.026]],12),steel,g);                                                                            // barrel
    mk(lathe([[1.12,.036],[1.17,.05],[1.24,.05],[1.28,.04]],16),dsteel,g);                                                     // flash hider
    mk(side([[.86,.03],[.88,.12],[.93,.12],[.95,.03]],.025,{bevel:.004}),steel,g);                                            // front sight tower
    return {group:g,tip:muzzleTip(g,1.33)};
  }
};