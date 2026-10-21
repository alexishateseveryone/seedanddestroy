import * as T from 'three';
import {LUMP,LUMP2,G,mat,M,eyes} from '../blocks.js';
export const stats={hp:2,r:.45};
export function buildBee(){
  const g=new T.Group(),b=new T.Group(),wings=[];g.add(b);
  M(LUMP,mat('#ffd23a'),[.4,.36,.5],[0,0,0],b);
  [-.2,.05].forEach(z=>{const t=new T.Mesh(new T.TorusGeometry(1,.15,8,16),mat('#2a2433'));t.scale.set(.38,.34,.38);t.position.z=z;t.rotation.y=Math.PI/2;b.add(t)});
  M(G.cone,mat('#2a2433'),[.08,.3,.08],[0,0,-.6],b).rotation.x=-Math.PI/2;eyes(b,.1,.4,.17,.08);
  [-1,1].forEach(s=>wings.push({s,w:M(LUMP2,new T.MeshBasicMaterial({color:'#e8f8ff',transparent:true,opacity:.7}),[.4,.04,.2],[s*.4,.35,0],b)}));
  g.userData.update=t=>{b.position.y=Math.sin(t*3)*.08;wings.forEach(o=>o.w.rotation.z=o.s*Math.sin(t*50)*.6)};
  return g;
}