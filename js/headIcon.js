// 3D head icon of a saved cat (used by the Save Slots + mode-select screens).
// Renders just the head (coat, eyes, nose, ears, headwear, eyewear) with the same icon renderer the cat maker tiles use.
import * as T from 'three';
import {COATS,EYECS,EARS,GEAR_COLS} from './catAvatar.js';
import {buildEar,buildHeadwear,buildEyewear} from './wearables.js';
import {makeCoat} from './coatShader.js';
import {lumpy,LUMP2,G,mat,BM,M} from './blocks.js';
import {iconOf} from './iconRender.js';

function buildHead(c){
  const o=Object.assign({fur:COATS[0][0],pat:COATS[0][1],pattern:'classic',ears:'pointy',eyeColor:EYECS[0],head:'none',eyewear:'none',gearC:GEAR_COLS[0]},c);
  if(!EARS.includes(o.ears))o.ears='pointy';
  const head=new T.Group(),acc=mat(o.pat),pink=mat('#ff9db8'),dark=BM('#2a1a14');
  M(lumpy(new T.SphereGeometry(1,48,36),.03,0),makeCoat(o,0),[1.0,.78,.85],null,head);
  [-1,1].forEach(s=>{const g=new T.Group();g.position.set(s*.42,-.02,.72);g.rotation.y=s*.25;head.add(g);
    M(G.sph,BM('#150d0a'),[.14,.18,.09],null,g);M(G.sph,BM('#fff'),[.045,.055,.022],[.04,.06,.08],g);M(G.sph,BM(o.eyeColor),[.028,.028,.015],[-.04,-.06,.085],g)});
  M(LUMP2,mat('#3a2308'),[.12,.08,.08],[0,-.14,.84],head);
  M(G.box,dark,[.016,.07,.016],[0,-.22,.75],head);
  [-1,1].forEach(s=>{const m=new T.Mesh(new T.TorusGeometry(.1,.018,6,16,Math.PI),dark);m.rotation.z=Math.PI;m.position.set(s*.1,-.28,.72);head.add(m)});
  [-1,1].forEach(s=>{const g=new T.Group();g.position.set(s*.56,.5,.02);g.rotation.z=-s*.5;head.add(g);
    const sw=new T.Group();g.add(sw);const info=buildEar(o.ears,sw,s<0?acc:mat(o.fur),pink);sw.rotation.set(info.bx,0,-s*info.out)});
  if(o.head!=='hood'){const hw=buildHeadwear(o.head,o.gearC);if(hw)head.add(hw)}   // the hood is cloth physics: left out of the icon
  const ew=buildEyewear(o.eyewear,o.gearC);if(ew)head.add(ew);
  return head;
}
/** data-url of a 3/4 view of the cat's head, or '' if it could not be rendered */
export function headIconURL(cfg){
  try{return iconOf('slothead|'+JSON.stringify(cfg||{}),()=>buildHead(cfg||{}),[.35,.15,1])||''}
  catch(e){console.warn('head icon failed',e);return ''}
}