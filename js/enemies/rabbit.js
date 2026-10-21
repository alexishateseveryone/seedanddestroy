import * as T from 'three';
import {LUMP,LUMP2,G,mat,M,eyes} from '../blocks.js';
export const stats={hp:3,r:.55};
export function buildRabbit(){
  const g=new T.Group(),b=new T.Group();g.add(b);
  M(LUMP,mat('#d9c3a0'),[.45,.55,.42],[0,.55,0],b);M(LUMP2,mat('#fff4e6'),[.3,.3,.2],[0,.45,.3],b);M(LUMP,mat('#d9c3a0'),[.4,.36,.38],[0,1.15,.05],b);
  [-1,1].forEach(s=>{M(G.cone,mat('#d9c3a0'),[.13,.7,.1],[s*.17,1.7,0],b).rotation.z=-s*.12;M(G.cone,mat('#ff9db8'),[.07,.5,.05],[s*.17,1.66,.05],b).rotation.z=-s*.12});
  eyes(b,1.2,.34,.16,.07);M(LUMP2,mat('#ff9db8'),[.06,.05,.05],[0,1.1,.4],b);
  const spear=new T.Group();spear.position.set(.5,.7,.3);b.add(spear);
  M(G.cyl,mat('#8a5a3a'),[.04,1.1,.04],[0,0,.5],spear).rotation.x=Math.PI/2;M(G.cone,mat('#cfd6e0',.3),[.09,.3,.09],[0,0,1.2],spear).rotation.x=Math.PI/2;
  g.userData.update=(t,mv,lunge=0)=>{b.position.y=mv?Math.abs(Math.sin(t*10))*.08:0;spear.position.z=.3+lunge*.5};
  return g;
}