// Sunray: a sunflower blaster. Cream body with sun-spots, green stem grip, a ring of golden petals around the muzzle.
import * as T from 'three';
import {side,lathe,tube,mk,metal,matte,ring,muzzleTip} from './proc.js';
export default {
  id:'sunray',name:'Sunray',kind:'gun',handling:'pistol',lean:0,
  stats:{cd:.13,dmg:1.4,spread:.03,speed:38,auto:true,kick:.45,shake:.1,push:.4,zoom:44,color:'#ffe14a',move:1,pierce:2,size:1.3,mag:12, reload:1.1},
  build(){
    const g=new T.Group(),cream=matte('#f6f0d6',.55),navy=matte('#1d2d6a',.5),green=matte('#3f9a3a',.6),dgreen=matte('#2a6e2c',.65),gold=matte('#ffcf2e',.45),orange=matte('#f59a1e',.5),brown=matte('#5a3a1a',.8),spot=matte('#ffe14a',.4);
    mk(side([[-.16,.1],[.0,.135],[.3,.12],[.5,.1],[.52,.0],[.3,-.05],[.0,-.07],[-.16,-.05]],.12,{smooth:4,bevel:.012}),cream,g);                  // body
    mk(side([[.26,.115],[.52,.1],[.52,.0],[.26,-.04]],.126,{smooth:2,bevel:.01}),navy,g);                                                        // navy fore-section
    [[.1,.05,.07],[.22,.0,.06],[.36,.06,.065],[.44,-.01,.055]].forEach(([u,v,s],i)=>[1,-1].forEach(sd=>mk(new T.SphereGeometry(1,8,6),spot,g,[sd*.065,-u,v],[0,0,0],[.012,s*.5,s*.5])));   // sun spots
    mk(tube([[0,.14,-.32],[0,.12,-.2],[0,.04,-.06],[0,-.04,.0]],.05,16,8),green,g);                                                              // stem grip
    mk(new T.SphereGeometry(1,10,8),dgreen,g,[.07,.1,-.24],[0,0,0],[.07,.04,.1]).rotation.set(0,0,.6);                                          // leaf on the stem
    mk(new T.SphereGeometry(1,10,8),dgreen,g,[-.07,.13,-.14],[0,0,0],[.07,.04,.09]).rotation.set(0,0,-.6);
    mk(lathe([[.5,.07],[.66,.075]],18),navy,g);                                                                                                  // barrel
    // sunflower: two rings of petals + a seed-head
    for(let i=0;i<14;i++){const a=i/14*Math.PI*2,m=mk(new T.SphereGeometry(1,10,8),i%2?gold:orange,g,[Math.sin(a)*.15,-.7,Math.cos(a)*.15],[0,0,0],[.028,.022,.1]);m.rotation.y=a}
    for(let i=0;i<14;i++){const a=(i+.5)/14*Math.PI*2,m=mk(new T.SphereGeometry(1,10,8),gold,g,[Math.sin(a)*.12,-.675,Math.cos(a)*.12],[0,0,0],[.026,.02,.085]);m.rotation.y=a}
    mk(new T.CylinderGeometry(.095,.095,.05,22),brown,g,[0,-.71,0]);                                                                              // seed-head
    mk(new T.CircleGeometry(.045,16),matte('#1a0f06',.9),g,[0,-.737,0],[Math.PI/2,0,0]);                                                         // muzzle
    return {group:g,tip:muzzleTip(g,.76)};
  }
};