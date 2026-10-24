// Hotdog Machine: a heavy machine gun that is, unmistakably, a hotdog. Bun, sausage, lettuce, tomato, mustard, pretzel-strap grips.
import * as T from 'three';
import {side,lathe,tube,mk,metal,matte,muzzleTip} from './proc.js';
export default {
  id:'hotdogmachine',name:'Hotdog Machine',kind:'gun',handling:'lmg',lean:-.05,fore:[.55,-.14],
  stats:{cd:.07,dmg:1,spread:.15,speed:27,auto:true,kick:.35,shake:.14,push:.3,zoom:52,color:'#e0782f',move:.8,scopeSteady:.4,size:1.2,mag:20, reload:1.1},
  build(){
    const g=new T.Group(),bun=matte('#dba25c',.7),crust=matte('#b9803a',.75),dog=matte('#b8452d',.55),lettuce=matte('#5bb04a',.6),tomato=matte('#e0342b',.5),mustard=matte('#f2cf2f',.5),tray=metal('#8f96a6',.4,.6),strap=matte('#7a4a22',.7),dark=matte('#2b1a14',.8);
    mk(side([[-.42,-.02],[.96,-.02],[1.0,-.06],[.92,-.1],[-.4,-.1],[-.46,-.06]],.2,{smooth:1,bevel:.012}),tray,g);                                // foil tray
    const b=mk(lathe([[-.42,.0],[-.38,.13],[-.2,.17],[.5,.17],[.86,.15],[.94,.08],[.96,.0]],28),bun,g,[0,0,.04],[0,0,0],[1,1,.78]);               // bun
    mk(lathe([[-.38,.0],[-.34,.1],[-.2,.12],[.5,.12],[.84,.1],[.9,.05]],24),crust,g,[0,0,.0],[0,0,0],[1.02,1.02,.7]);                              // bun underside
    mk(lathe([[-.46,.0],[-.44,.085],[-.3,.1],[.7,.1],[.92,.09],[.98,.06],[1.0,.0]],24),dog,g,[0,0,.12]);                                           // sausage
    for(let i=0;i<7;i++){const u=-.25+i*.15;mk(new T.SphereGeometry(1,10,6),lettuce,g,[(i%2?1:-1)*.05,-u,.19],[0,0,0],[.075,.09,.025]).rotation.z=i*.7}   // lettuce
    for(let i=0;i<4;i++)mk(new T.CylinderGeometry(.06,.06,.018,14),tomato,g,[0,-(.0+i*.22),.215],[Math.PI/2,0,0]);                                  // tomato slices
    mk(tube(Array.from({length:14},(_,i)=>[(i%2?.035:-.035),-(-.4+i*.1),.225]),.012,40,5),mustard,g);                                              // mustard zigzag
    [.05,.38].forEach(u=>mk(new T.TorusGeometry(.1,.032,8,18,Math.PI*1.2),strap,g,[0,-u,-.1],[0,Math.PI/2,Math.PI*.9]));                               // pretzel straps
    mk(side([[-.2,-.06],[-.04,-.07],[-.08,-.34],[-.24,-.31]],.09,{smooth:4,bevel:.01}),strap,g);                                                   // grip
    mk(new T.CircleGeometry(.09,16),dark,g,[0,-1.0,.12],[Math.PI/2,0,0]);                                                                          // bore
    return {group:g,tip:muzzleTip(g,1.03,.12)};
  }
};