import * as T from 'three';
import {LUMP,G,mat,BM,M,eyes,shadow} from '../blocks.js';
export const stats={hp:2,r:.5,h:.55};
export function buildSpider(){
  const g=new T.Group(),b=new T.Group(),legs=[],A=[.15,.4,.65,.9];g.add(b);shadow(g,.7);
  M(LUMP,mat('#4a3466'),[.42,.32,.42],[0,.45,.1],b);const ab=M(LUMP,mat('#5c4380'),[.52,.42,.58],[0,.52,-.5],b);
  M(G.sph,mat('#ff4d6d'),[.13,.06,.13],[0,.76,-.5],b);[[-.22,.7,-.7],[.22,.7,-.35],[.18,.7,-.8]].forEach(p=>M(G.sph,mat('#8a6ac0'),[.08,.04,.08],p,b));
  [-1,1].forEach(s=>{M(G.cone,mat('#fff4e6'),[.04,.16,.04],[s*.1,.28,.5],b).rotation.x=Math.PI;
    [.15,.4,.65,.9].forEach((a,i)=>{const p=new T.Group();p.position.set(0,.45,.1);p.rotation.y=s*(a+.5);b.add(p);
      M(G.cyl,mat('#2e2142'),[.045,.55,.045],[s*.4,.2,0],p).rotation.z=-s*.9;M(G.sph,mat('#6a4c9a'),[.07,.07,.07],[s*.8,.02,0],p);legs.push({p,i,s})})});
  eyes(b,.6,.44,.14,.08);eyes(b,.5,.46,.07,.05);
  g.userData.update=(t,mv)=>{b.position.y=mv?Math.abs(Math.sin(t*10))*.08:0;ab.scale.y=.42+Math.sin(t*3)*.02;legs.forEach(o=>o.p.rotation.y=o.s*(.5+A[o.i])+(mv?Math.sin(t*14+o.i*1.7)*.15:0))};
  return g;
}