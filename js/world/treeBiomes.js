// ALL biome trees in ONE file, pushed into a Batch like js/trees.js (real geometry, baked per-vertex colour, wind attributes).
//   addBiomeTree(B,R,x,z,scale,kind,quality)   kind: 'oak' | 'pine' | 'jungle' | 'palm' | 'acacia' | 'dead'
// Every kind returns the collision radius it needs, so the map can add an obstacle.
import * as T from 'three';
import {mat4,softLump} from '../batch.js';
import {barkTube,rootGeo} from './meshes.js';

const OAK=['#3f8f4a','#4fa352','#33803f','#5fae4d','#6aa944'],PINE=['#2c6b44','#357b4a','#27613f','#3f8a50'],JUNG=['#1f7a34','#2a8f3c','#34a046','#1b6a30'],
  PALM=['#3f9a3a','#52ad43','#6bb84a'],ACAC=['#7c9a3c','#8aa743','#6f8c36'],BARK=['#6b4a30','#7a5636','#5d4129'],DEADB=['#8a7b6a','#7a6c5c','#968675'],JBARK=['#6e5a44','#5f4d3a'];
const CAN_HI=[0,1,2].map(i=>softLump(2,.2,i*3.7)),CAN_LO=[0,1,2].map(i=>softLump(1,.18,i*3.7));
const FLAT=softLump(2,.14,9.1),FROND=(()=>{const g=new T.PlaneGeometry(1,1,6,1),p=g.attributes.position;       // palm frond: a long blade that droops towards its tip
  for(let i=0;i<p.count;i++){const t=p.getX(i)+.5,w=p.getY(i);p.setXYZ(i,t,-.45*t*t,w*.34*(1-t*.8))}g.computeVertexNormals();return g})();
const PCONE=new T.ConeGeometry(1,1,10,2);
{const p=PCONE.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),r=Math.hypot(x,z);if(r<1e-3)continue;
  const a=Math.atan2(z,x),k=1+.16*Math.sin(a*3+1.3)+.1*Math.sin(a*7+.4)+.06*Math.sin(a*13),f=y<-.4?k:(1+(k-1)*.5);p.setXYZ(i,x*f,y-(y<-.4?.07*(k-.85):0),z*f)}PCONE.computeVertexNormals()}
const pick=(a,R)=>a[(R()*a.length)|0],mix2=(a,b,t)=>'#'+new T.Color(a).lerp(new T.Color(b),t).getHexString();

/** trunk = rough tapered tube with a root flare (see meshes.js); branches = the same without the flare */
function trunk(put,R,tl,rb,rt,bark,wind){put('bark',barkTube(tl,rb,rt,R),mat4(0,0,0),bark,{grad:(px,py)=>(.7+.4*Math.min(1,py/tl))*(.94+.06*Math.sin(px*46)),wind})}
const branch=(len,rb,rt,R)=>barkTube(len,rb,rt,R,{sides:6,rough:.05,flare:false});
/** roots: curved, tapering roots that leave the trunk, arch over the ground and dive into it (no more cones sticking out) */
function roots(put,R,rb,s,bark,n=4,len=.55){for(let i=0;i<n;i++){const a=i/n*6.283+R()*.8,reach=(len*s*1.25+rb*.8)*(.85+R()*.3),hgt=Math.min(len*s*.5,rb*2.2)+.12;
  put('bark',rootGeo(rb,reach,hgt,a,R),mat4(0,0,0),bark,{grad:(px,py)=>.72+.22*Math.min(1,Math.max(0,py/(hgt+.2)))})}}

/** vines: optional callback (worldX,worldY,worldZ,length,scale,seed) - jungle trees hand their hanging vines to the simulated vine system (vines.js) instead of baking static sticks */
export function addBiomeTree(B,R,x,z,s=1,kind='oak',q='hi',vines=null){
  const ph=R()*20,ry=R()*6.283,base=mat4(x,0,z,1,1,1,0,ry,0),can=q==='hi'?CAN_HI:CAN_LO;
  const put=(k,geo,local,col,o)=>B.add(k,geo,base.clone().multiply(local),col,o);
  const W=(span,gain=1)=>({base:0,span,gain,phase:ph});
  const bark=pick(BARK,R);
  if(kind==='pine'){
    const h=(2.6+R()*1.6)*s,tl=h*.78,rb=(.27+R()*.05)*s,tiers=5+((R()*2)|0),gr=pick(PINE,R),y0=h*.36,dy=(h*.52+.9*s)/(tiers-1);
    trunk(put,R,tl,rb,rb*.32,bark,W(h+2.6*s,.28));roots(put,R,rb,s,bark);
    for(let i=0;i<tiers;i++){const t=i/(tiers-1),rad=(1.75-1.3*t)*s*(.92+R()*.16),hh=(1.35-.3*t)*s,y=y0+i*dy+hh*.5;
      put('foliage',PCONE,mat4(0,y,0,rad,hh,rad,(R()-.5)*.08,R()*6,(R()-.5)*.08),gr,{grad:(px,py)=>.58+.62*Math.min(1,Math.max(0,py+.5))*(1-.15*i/tiers),wind:W(h+2.6*s),varS:1.3,varA:.34})}
    return .65*s}
  if(kind==='oak'){
    const h=(2.3+R()*1.5)*s,tl=h*.72,rb=(.27+R()*.05)*s,blossom=R()<.08,gr=blossom?'#f1a9c8':pick(OAK,R),n=5+((R()*3)|0);
    trunk(put,R,tl,rb,rb*.5,bark,W(h+2.6*s,.28));roots(put,R,rb,s,bark);
    for(let i=0;i<3;i++){const a=i/3*6.283+R(),len=(.9+R()*.4)*s,bg=branch(len,.1*s,.05*s,R);
      put('bark',bg,mat4(0,tl*.78,0,1,1,1,Math.cos(a)*.7,0,Math.sin(a)*-.7),bark,{grad:()=>.85,wind:W(h+2.6*s,.4)})}
    for(let i=0;i<n;i++){const a=i/n*6.283+R()*.7,d=i?(.55+R()*.5)*s:0,r=(.85+R()*.5)*s*(i?1:1.15),yy=h*.8+(i?(R()*.8-.1)*s:.55*s);
      put('foliage',can[i%3],mat4(Math.cos(a)*d,yy,Math.sin(a)*d,r,r*.82,r,0,R()*6,0),i%2?mix2(gr,'#c8ff8a',.12):gr,{grad:(px,py)=>.66+.5*(py*.5+.5),wind:W(h+2.6*s),varS:1.5,varA:.36})}
    return .65*s}
  if(kind==='jungle'){          // very tall, buttress roots, a high umbrella of canopy clumps and hanging vines
    const h=(6.5+R()*3.5)*s,rb=(.42+R()*.1)*s,tl=h*.88,gr=pick(JUNG,R),jb=pick(JBARK,R);
    trunk(put,R,tl,rb,rb*.38,jb,W(h+2*s,.18));roots(put,R,rb,s,jb,6,1.6);
    const n=6+((R()*3)|0);
    for(let i=0;i<n;i++){const a=i/n*6.283+R()*.5,d=(1.1+R()*1.3)*s,r=(1.3+R()*.8)*s,yy=h*.96+(R()*.9-.2)*s;
      put('foliage',can[i%3],mat4(Math.cos(a)*d,yy,Math.sin(a)*d,r*1.25,r*.6,r*1.25,0,R()*6,0),i%2?mix2(gr,'#9be86a',.14):gr,{grad:(px,py)=>.6+.5*(py*.5+.5),wind:W(h+2*s),varS:1.4,varA:.4})}
    put('foliage',can[0],mat4(0,h*1.05,0,1.7*s,.75*s,1.7*s,0,R()*6,0),gr,{grad:(px,py)=>.7+.45*(py*.5+.5),wind:W(h+2*s),varS:1.4,varA:.36});
    if(vines){const nv=5+((R()*3)|0),c=Math.cos(ry),sn=Math.sin(ry);       // hanging vines: simulated, see vines.js
      for(let i=0;i<nv;i++){const a=R()*6.283,d=(.8+R()*1.6)*s,lx=Math.cos(a)*d,lz=Math.sin(a)*d,vl=Math.min((2.6+R()*4)*s,h*.8);
        vines(x+lx*c+lz*sn,h*.92,z-lx*sn+lz*c,vl,s,R()*100)}}
    else for(let i=0;i<4;i++){const a=R()*6.283,d=(.8+R()*1.4)*s,vl=(2+R()*3)*s,vg=new T.CylinderGeometry(.018*s,.03*s,vl,4,1);vg.translate(0,-vl/2,0);
      put('foliage',vg,mat4(Math.cos(a)*d,h*.92,Math.sin(a)*d),'#3f8a3a',{grad:(px,py)=>.8+.3*(py/vl+1),wind:{base:0,span:h,gain:.5,phase:ph+i}})}
    return .9*s}
  if(kind==='palm'){            // curved trunk made of leaning segments + a crown of drooping fronds and coconuts
    const h=(4+R()*2.2)*s,lean=(.25+R()*.45)*s,segs=6,rb=.2*s,gr=pick(PALM,R),da=R()*6.283,dirx=Math.cos(da),dirz=Math.sin(da);
    const P=t=>new T.Vector3(dirx*lean*t*t*h*.5,h*t,dirz*lean*t*t*h*.5),up=new T.Vector3(0,1,0);
    for(let i=0;i<segs;i++){const t0=i/segs,t1=(i+1)/segs,p0=P(t0),p1=P(t1),d=p1.clone().sub(p0),len=d.length(),r0=rb*(1-t0*.5),r1=rb*(1-t1*.5);
      const g=new T.CylinderGeometry(r1,r0,len*1.06,6,1);g.translate(0,len/2,0);
      const m=new T.Matrix4().compose(p0,new T.Quaternion().setFromUnitVectors(up,d.normalize()),new T.Vector3(1,1,1));
      put('bark',g,m,pick(DEADB,R),{grad:(px,py)=>.8+.3*(py/len),wind:{base:0,span:h,gain:.35,phase:ph}})}
    const top=P(1),topx=top.x,topz=top.z;
    const nf=9+((R()*3)|0);
    for(let i=0;i<nf;i++){const a=i/nf*6.283+R()*.3,fl=(1.9+R()*.7)*s;
      put('foliage',FROND,mat4(topx,h*.97,topz,fl,1,fl*.9,(R()-.5)*.25,a,.25+R()*.4),i%2?mix2(gr,'#c8ff8a',.15):gr,{grad:(px,py)=>.7+.5*(px+.5),wind:{base:0,span:h,gain:1.2,phase:ph+i*.3},varS:2,varA:.3})}
    for(let i=0;i<3;i++)B.add('prop',new T.IcosahedronGeometry(1,1),base.clone().multiply(mat4(topx+(R()-.5)*.3,h*.9,topz+(R()-.5)*.3,.13*s,.13*s,.13*s)),'#6b4a22',{varA:.1});
    return .35*s}
  if(kind==='acacia'){          // thin forked trunk, wide flat umbrella canopy
    const h=(3.2+R()*1.6)*s,rb=.24*s,gr=pick(ACAC,R),tl=h*.8;
    trunk(put,R,tl,rb,rb*.55,pick(DEADB,R),W(h+2*s,.2));roots(put,R,rb,s,bark,3,.4);
    const nb=2+((R()*2)|0);
    for(let i=0;i<nb;i++){const a=i/nb*6.283+R(),len=(1.1+R()*.5)*s,bg=branch(len,.11*s,.06*s,R);
      put('bark',bg,mat4(0,tl*.78,0,1,1,1,Math.cos(a)*.65,0,Math.sin(a)*-.65),bark,{grad:()=>.85,wind:W(h+2*s,.35)})}
    const n=3+((R()*2)|0);
    for(let i=0;i<n;i++){const a=i/n*6.283+R()*.6,d=i?(1+R()*.9)*s:0,r=(1.5+R()*.8)*s*(i?.85:1.15);
      put('foliage',FLAT,mat4(Math.cos(a)*d,h+(R()-.5)*.3*s,Math.sin(a)*d,r*1.5,r*.3,r*1.5,0,R()*6,0),i%2?mix2(gr,'#e8e38a',.15):gr,{grad:(px,py)=>.7+.45*(py*.5+.5),wind:W(h+2*s),varS:1.4,varA:.34})}
    return .5*s}
  // dead tree: bare trunk + crooked branches, no leaves
  const h=(2.4+R()*1.8)*s,rb=(.2+R()*.06)*s,bk=pick(DEADB,R);
  trunk(put,R,h,rb,rb*.3,bk,W(h+1,.15));roots(put,R,rb,s,bk,4,.4);
  const nb=4+((R()*3)|0);
  for(let i=0;i<nb;i++){const a=R()*6.283,len=(.8+R()*1.1)*s,y=h*(.45+R()*.5),bg=branch(len,.07*s,.025*s,R);
    put('bark',bg,mat4(0,y,0,1,1,1,Math.cos(a)*(.7+R()*.5),0,Math.sin(a)*-(.7+R()*.5)),bk,{grad:()=>.85,wind:W(h+1,.3)})}
  return .4*s;
}
export const TREE_KINDS=['oak','pine','jungle','palm','acacia','dead'];