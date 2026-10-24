// MUSHROOMS (own file): small clusters pushed into a Batch as 'prop' geometry.
//   addMushrooms(B,R,x,y,z,k,kind)   kind: 'red' | 'brown' | 'orange' | 'blue' | 'purple' | 'giant'
// 'red' caps get white spots, 'giant' is a big rainforest mushroom you can walk under.
import * as T from 'three';
import {mat4,softLump} from '../batch.js';

const KINDS={
  red:   {cap:'#e8453c',stem:'#f4ead0',spots:true},
  brown: {cap:'#a9703c',stem:'#efe2c4'},
  orange:{cap:'#ff9a3c',stem:'#f6ead0'},
  blue:  {cap:'#4f8fe8',stem:'#e4f0ff',spots:true},
  purple:{cap:'#9a5fd8',stem:'#efe4ff'},
  giant: {cap:'#c25fd8',stem:'#f2e6f6',spots:true,big:true}
};
const STEM=new T.CylinderGeometry(.6,.9,2.2,7).translate(0,1.1,0),CAP=softLump(1,.06,1),SPOT=new T.IcosahedronGeometry(1,0);

export function addMushrooms(B,R,x,y,z,k=1,kind='red'){
  const K=KINDS[kind]||KINDS.red,n=K.big?1:1+((R()*3)|0);
  for(let i=0;i<n;i++){
    const a=R()*6.283,d=i?(.12+R()*.16)*k:0,px=x+Math.cos(a)*d,pz=z+Math.sin(a)*d,s=k*(K.big?3.2:1)*(i?.55+R()*.35:1),sh=.07*s,cr=.2*s;
    B.add('prop',STEM,mat4(px,y,pz,sh,sh*1.04,sh),K.stem,{grad:(px_,py)=>.8+.2*py});
    B.add('prop',CAP,mat4(px,y+.2*s,pz,cr,cr*.55,cr),K.cap,{grad:(px_,py)=>.8+.3*py});
    if(K.spots)for(let j=0;j<5;j++){const sa=R()*6.283,sr=cr*(.25+R()*.55),sy=Math.sqrt(Math.max(0,1-(sr/cr)**2))*cr*.55;
      B.add('prop',SPOT,mat4(px+Math.cos(sa)*sr,y+.2*s+sy*.97,pz+Math.sin(sa)*sr,cr*.12,cr*.07,cr*.12),'#ffffff',{varA:.05})}}
  return K.big?.35*k:0;     // collision radius of the stem (giant only)
}
export const SHROOM_KINDS=Object.keys(KINDS);
