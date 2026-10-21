import * as T from 'three';
import {LUMP,LUMP2,G,mat,BM,M,eyes,shadow,limb} from '../blocks.js';
export const stats={hp:3,r:.6,h:.6};
export function buildFrog(){
  const g=new T.Group(),b=new T.Group();g.add(b);shadow(g,.7);
  M(LUMP,mat('#6fd36b'),[.58,.42,.62],[0,.42,0],b);M(LUMP2,mat('#e6f9c0'),[.4,.24,.42],[0,.3,.14],b);
  const sac=M(LUMP2,mat('#f6a8a0'),[.2,.12,.15],[0,.32,.5],b);
  [[-.2,.7,-.1],[.15,.72,-.25],[.3,.62,.05]].forEach(p=>M(LUMP2,mat('#4fae55'),[.1,.06,.1],p,b));
  [-1,1].forEach(s=>{M(LUMP2,mat('#6fd36b'),[.19,.19,.19],[s*.3,.8,.3],b);M(LUMP2,mat('#ff9db8',.9),[.09,.05,.07],[s*.42,.5,.45],b);
    limb(b,s*.5,.45,-.2,.28,.2,'#58b858','#d4f5ae');limb(b,s*.38,.4,.35,.2,.1,'#58b858','#d4f5ae')});
  eyes(b,.84,.42,.3,.11);M(G.box,BM('#2a3a2a'),[.3,.02,.02],[0,.4,.62],b);
  g.userData.update=(t,mv)=>{b.scale.set(mv?.9:1,mv?1.18:1+Math.sin(t*4.5)*.04,mv?.95:1);sac.scale.y=.12+Math.abs(Math.sin(t*5))*.06};
  return g;
}