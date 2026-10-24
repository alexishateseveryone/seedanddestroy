// BUSHES (own file): a few soft lumps (foliage = swaying), optional berries. Colours come from the biome palette.
//   addBiomeBush(B,R,x,y,z,k,palette,berries)
import * as T from 'three';
import {mat4,softLump} from '../batch.js';

const LUMP=[0,1,2].map(i=>softLump(1,.18,i*3.7)),BERRY=new T.IcosahedronGeometry(1,1);
export function addBiomeBush(B,R,x,y,z,k=1,palette=['#3f8f4a'],berries=false){
  const col=palette[(R()*palette.length)|0],ph=R()*20;
  for(let j=0;j<4;j++){const a=j/4*6.283+R(),d=j?.42*k:0,r=(.5+R()*.22)*k;
    B.add('foliage',LUMP[j%3],mat4(x+Math.cos(a)*d,y+.32*k+(j?0:.12*k),z+Math.sin(a)*d,r,r*.8,r,0,R()*6,0),col,{grad:(px,py)=>.62+.5*(py*.5+.5),wind:{base:y,span:1.1*k,gain:.5,phase:ph},varS:2,varA:.34})}
  if(berries)for(let j=0;j<6;j++){const a=R()*6.283,d=.45*k*(.6+R()*.5);
    B.add('prop',BERRY,mat4(x+Math.cos(a)*d,y+.35*k+R()*.3*k,z+Math.sin(a)*d,.06,.06,.06),'#e8453c',{varA:.1})}
}
