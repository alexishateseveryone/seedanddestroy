// Trees are pushed into a Batch as real geometry: tapered trunks with root flare and branches, tiered ragged pines,
// and broadleaf trees with clustered lumpy canopies (some in blossom). Colours vary per vertex so canopies read as leaf clumps.
import * as T from 'three';
import {mat4,softLump,hash} from './batch.js';

const PINE=['#2c6b44','#357b4a','#27613f','#3f8a50'],LEAF=['#3f8f4a','#4fa352','#33803f','#5fae4d','#6aa944'],BARK=['#6b4a30','#7a5636','#5d4129'];
const CAN_HI=[0,1,2].map(i=>softLump(2,.2,i*3.7)),CAN_LO=[0,1,2].map(i=>softLump(1,.18,i*3.7));
;
const PCONE=new T.ConeGeometry(1,1,10,2);
// ragged rim for the pine tiers: radial noise + droop (applied once, cached on the geometry)
{const p=PCONE.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),r=Math.hypot(x,z);if(r<1e-3)continue;
  const a=Math.atan2(z,x),k=1+.16*Math.sin(a*3+1.3)+.1*Math.sin(a*7+.4)+.06*Math.sin(a*13),f=y<-.4?k:(1+(k-1)*.5);p.setXYZ(i,x*f,y-(y<-.4?.07*(k-.85):0),z*f)}PCONE.computeVertexNormals()}

export function addTree(B,R,x,z,s=1,q='hi'){
  const pine=R()>.5,h=(2.3+R()*1.5)*s,ry=R()*6.283,base=mat4(x,0,z,1,1,1,0,ry,0),ph=R()*20,bark=BARK[(R()*3)|0],can=q==='hi'?CAN_HI:CAN_LO;
  const W=(gain=1)=>({base:0,span:h+2.6*s,gain,phase:ph});
  const put=(kind,geo,local,col,o)=>B.add(kind,geo,base.clone().multiply(local),col,o);
  // trunk: tapered, flared roots
  const tl=pine?h*.78:h*.72,rb=(.27+R()*.05)*s,rt=rb*(pine?.32:.5);
  const tg=new T.CylinderGeometry(rt,rb,tl,7,3);tg.translate(0,tl/2,0);
  put('bark',tg,mat4(0,0,0),bark,{grad:(px,py)=>.7+.4*Math.min(1,py/tl),wind:W(.28)});
  for(let i=0;i<4;i++){const a=i/4*6.283+R(),rg=new T.ConeGeometry(rb*.6,.55*s,5,1);rg.translate(0,.2*s,0);
    put('bark',rg,mat4(Math.cos(a)*rb*.75,0,Math.sin(a)*rb*.75,1,1,1,Math.sin(a)*.5,0,-Math.cos(a)*.5),bark,{grad:()=>.78})}
  if(pine){
    const tiers=5+((R()*2)|0),gr=PINE[(R()*4)|0],y0=h*.36,dy=(h*.52+.9*s)/(tiers-1);
    for(let i=0;i<tiers;i++){const t=i/(tiers-1),rad=(1.75-1.3*t)*s*(.92+R()*.16),hh=(1.35-.3*t)*s,y=y0+i*dy+hh*.5,sy=hh;
      put('foliage',PCONE,mat4(0,y,0,rad,sy,rad,(R()-.5)*.08,R()*6,(R()-.5)*.08),gr,
        {grad:(px,py)=>.58+.62*Math.min(1,Math.max(0,py+.5))*(1-.15*i/tiers),wind:W(1),varS:1.3,varA:.34})}
  }else{
    const blossom=R()<.1,gr=blossom?'#f1a9c8':LEAF[(R()*5)|0],n=5+((R()*3)|0),cy=h*.88;
    // forked branches to the canopy clumps
    for(let i=0;i<3;i++){const a=i/3*6.283+R(),len=(.9+R()*.4)*s,bg=new T.CylinderGeometry(.05*s,.1*s,len,5,1);bg.translate(0,len/2,0);
      put('bark',bg,mat4(0,tl*.78,0,1,1,1,Math.cos(a)*.7,0,Math.sin(a)*-.7),bark,{grad:()=>.85,wind:W(.4)})}
    for(let i=0;i<n;i++){const a=i/n*6.283+R()*.7,d=i?(.55+R()*.5)*s:0,r=(.85+R()*.5)*s*(i?1:1.15),yy=h*.8+(i?(R()*.8-.1)*s:.55*s);
      put('foliage',can[i%3],mat4(Math.cos(a)*d,yy,Math.sin(a)*d,r,r*.82,r,0,R()*6,0),i%2?mix2(gr,'#c8ff8a',.12):gr,
        {grad:(px,py)=>.66+.5*(py*.5+.5),wind:W(1),varS:1.5,varA:.36})}
  }
}
const mix2=(a,b,t)=>'#'+new T.Color(a).lerp(new T.Color(b),t).getHexString();

// bushes: a few soft lumps (foliage = swaying) + optional berries
export function addBush(B,R,x,z,k=1,berries=false){
  const col=['#3f8f4a','#4fa352','#357a40','#5aa84a'][(R()*4)|0],ph=R()*20;
  for(let j=0;j<4;j++){const a=j/4*6.283+R(),d=j?.42*k:0,r=(.5+R()*.22)*k;
    B.add('foliage',CAN_LO[j%3],mat4(x+Math.cos(a)*d,.32*k+(j?0:.12*k),z+Math.sin(a)*d,r,r*.8,r,0,R()*6,0),col,{grad:(px,py)=>.62+.5*(py*.5+.5),wind:{base:0,span:1.1*k,gain:.5,phase:ph},varS:2,varA:.34})}
  if(berries)for(let j=0;j<6;j++){const a=R()*6.283,d=.45*k*(.6+R()*.5);B.add('prop',BERRY,mat4(x+Math.cos(a)*d,.35*k+R()*.3*k,z+Math.sin(a)*d,.06,.06,.06),'#e8453c',{varA:.1})}
}
const BERRY=new T.IcosahedronGeometry(1,1);