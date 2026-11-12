// ALL biome trees in ONE file, pushed into a Batch like js/trees.js (real geometry, baked per-vertex colour, wind attributes).
//   addBiomeTree(B,R,x,z,scale,kind,quality)   kind: 'oak' | 'pine' | 'jungle' | 'palm' | 'acacia' | 'dead'
// Every kind returns the collision radius it needs, so the map can add an obstacle.
import * as T from 'three';
import {mat4,softLump,vnoise} from '../batch.js';
import {curveTube} from './wood.js';
// SHORT HIKE look: simple low-poly trunks / limbs (6 and 5 sided prisms) instead of furrowed bark
const barkTube=(len,rb,rt,R,o={})=>{const g=new T.CylinderGeometry(rt,rb*(o.flare===false?1:1.12),len,o.sides&&o.sides<7?o.sides:6,1);g.translate(0,len/2,0);return g};      // procedural wood: furrowed bark, root flare + buttress lobes, curved roots, curved ringed palm trunk

const AUTUMN=true;   // true = orange / yellow autumn leaves like the Short Hike screenshot, false = summer greens
const OAK=AUTUMN?['#e8692c','#f2923a','#eab63c','#cf4f2a','#a3c041']:['#3f8f4a','#4fa352','#33803f','#5fae4d','#6aa944'],PINE=['#2c6b44','#357b4a','#27613f','#3f8a50'],JUNG=['#1f7a34','#2a8f3c','#34a046','#1b6a30'],
  PALM=['#3f9a3a','#52ad43','#6bb84a'],ACAC=['#7c9a3c','#8aa743','#6f8c36'],BARK=['#6b4a30','#7a5636','#5d4129'],DEADB=['#8a7b6a','#7a6c5c','#968675'],JBARK=['#6e5a44','#5f4d3a'];
const CAN_HI=[0,1,2].map(i=>softLump(1,.26,i*3.7)),CAN_LO=[0,1,2].map(i=>softLump(0,.22,i*3.7));   // faceted blobs, flat shaded by the batch material
const FLAT=softLump(1,.16,9.1),FROND=(()=>{const g=new T.PlaneGeometry(1,1,6,1),p=g.attributes.position;       // palm frond: a long blade that droops towards its tip
  for(let i=0;i<p.count;i++){const t=p.getX(i)+.5,w=p.getY(i);p.setXYZ(i,t,-.45*t*t,w*.34*(1-t*.8))}g.computeVertexNormals();return g})();
// ONE-MESH PINE: a single lathe with a saw-tooth profile (5 skirts), unit height / unit base radius, 6 sides. Replaces the 5 separate cones.
const PINE_GEO=(()=>{const n=5,pts=[new T.Vector2(0,0)];for(let i=0;i<n;i++){const y=i/n*.78,r=1-.74*i/(n-1),y2=(i+1)/n*.78,r2=i<n-1?1-.74*(i+1)/(n-1):0;
  pts.push(new T.Vector2(r,y));if(i<n-1)pts.push(new T.Vector2(r2*.55,y2+.02))}
  pts.push(new T.Vector2(.0,1));return new T.LatheGeometry(pts,6)})();
const BLOB=[0,1,2].map(i=>softLump(2,.07,i*3.7));
const CONE=new T.ConeGeometry(1,1,6,1).translate(0,.5,0);
const BANDS=(px,py)=>py>.3?1.16:(py>-.3?.92:.68);
const CBANDS=(px,py)=>py<.34?.74:(py<.67?.95:1.15);
const pick=(a,R)=>a[(R()*a.length)|0],mix2=(a,b,t)=>'#'+new T.Color(a).lerp(new T.Color(b),t).getHexString();

const MOSS=tl=>({col:'#4d6a2c',fn:(px,py,pz)=>Math.max(0,1-py/Math.max(.6,tl*.28))*(.25+.5*vnoise(px*9,py*3,pz*9))});
/** trunk = furrowed tapered tube with root flare + buttress lobes; moss creeps up the foot */
function trunk(put,R,tl,rb,rt,bark,wind,moss=false){
  put('bark',barkTube(tl,rb,rt,R,{sides:rb>.28?14:12,rough:.13}),mat4(0,0,0),bark,
    {grad:(px,py,pz)=>(.6+.45*Math.min(1,py/tl))*(.78+.44*vnoise(px*14,py*1.1,pz*14)),wind,...(moss?{moss:MOSS(tl)}:{})})}
const branch=(len,rb,rt,R)=>barkTube(len,rb,rt,R,{sides:6,rough:.07,flare:false,bend:.12});
/** a limb + twigs forking off it. bm = matrix of the limb (local to the tree) */
function limb(put,R,bm,len,rb,rt,bark,wind,twigs=2){
  put('bark',branch(len,rb,rt,R),bm,bark,{grad:()=>.85,wind});
  for(let k=0;k<twigs;k++){const ta=(k%2?1:-1)*(.55+R()*.5),tl2=len*(.4+R()*.25);
    put('bark',branch(tl2,rb*.5,rt*.4,R),bm.clone().multiply(mat4(0,len*(.5+.18*k),0,1,1,1,ta*.8,R()*6,ta*.5)),bark,{grad:()=>.85,wind})}}
/** roots: curved, tapering roots that leave the trunk, arch over the ground and dive into it */
function roots(){}   // no root flare: Short Hike trunks are plain

/** vines: optional callback (worldX,worldY,worldZ,length,scale,seed) - jungle trees hand their hanging vines to the simulated vine system (vines.js) instead of baking static sticks */
export function addBiomeTree(B,R,x,z,s=1,kind='oak',q='hi',vines=null){
  const ph=R()*20,ry=R()*6.283,base=mat4(x,0,z,1,1,1,0,ry,0),can=q==='hi'?CAN_HI:CAN_LO,hi=q==='hi';
  const GL=()=>1;      // ONE soft light-top / darker-bottom step, no blotchy variation
  const put=(k,geo,local,col,o={})=>B.add(k,geo,base.clone().multiply(local),col,{...(k==='foliage'?{grad:GL}:{}),...o,varA:k==='foliage'?0:(o.varA??.3)*.3});
  const W=(span,gain=1)=>({base:0,span,gain,phase:ph});
  const bark=pick(BARK,R);
  if(kind==='pine'){
    const h=(2.6+R()*1.6)*s,tl=h*.78,rb=(.27+R()*.05)*s,tiers=5+((R()*2)|0),gr=pick(PINE,R),y0=h*.36,dy=(h*.52+.9*s)/(tiers-1);
    trunk(put,R,tl,rb,rb*.32,bark,W(h+2.6*s,.28),true);roots(put,R,rb,s,bark);
    const PH=(h*.52+.9*s)+1.1*s,PR=1.75*s*(.92+R()*.16);   // the whole crown = ONE mesh
    put('foliage',PINE_GEO,mat4(0,y0,0,PR,PH,PR,0,R()*6,0),gr,{grad:()=>1,wind:W(h+2.6*s)})
    return .65*s}
  if(kind==='oak'){
    const h=(2.3+R()*1.5)*s,tl=h*.72,rb=(.34+R()*.07)*s,blossom=R()<.08,gr=blossom?'#f1a9c8':pick(OAK,R),n=4+((R()*2)|0);
    trunk(put,R,tl,rb,rb*.55,bark,W(h+2.6*s,.28),true);roots(put,R,rb,s,bark,5,.8);
    for(let i=0;i<4;i++){const a=i/4*6.283+R()*.8,len=(1.2+R()*.7)*s;                     // 4 big limbs, each forking into twigs
      limb(put,R,mat4(0,tl*.78,0,1,1,1,Math.cos(a)*.85,0,Math.sin(a)*-.85),len,.13*s,.05*s,bark,W(h+2.6*s,.4),hi?2:1)}
    // ONE solid round crown (a main blob + 3 fused ones, SAME colour): the shader paints it flat, light on top / dark underneath
    put('foliage',BLOB[0],mat4(0,h*.82,0,1.55*s,1.25*s,1.55*s,0,R()*6,0),gr,{grad:()=>1,wind:W(h+2.6*s)});
    for(let i=0;i<3;i++){const a=i/3*6.283+R()*.8;
      put('foliage',BLOB[1],mat4(Math.cos(a)*1.0*s,h*.8+(R()-.3)*.4*s,Math.sin(a)*1.0*s,.95*s,.8*s,.95*s,0,R()*6,0),gr,{grad:()=>1,wind:W(h+2.6*s)})}
    return .65*s}
  if(kind==='jungle'){          // very tall, buttress roots, a high umbrella of canopy clumps and hanging vines
    const h=(6.5+R()*3.5)*s,rb=(.42+R()*.1)*s,tl=h*.88,gr=pick(JUNG,R),jb=pick(JBARK,R);
    trunk(put,R,tl,rb,rb*.38,jb,W(h+2*s,.18),true);roots(put,R,rb,s,jb,6,1.6);
    const n=6+((R()*3)|0);
    for(let i=0;i<n;i++){const a=i/n*6.283+R()*.5,d=(1.1+R()*1.3)*s,r=(1.3+R()*.8)*s,yy=h*.96+(R()*.9-.2)*s;
      put('foliage',can[i%3],mat4(Math.cos(a)*d,yy,Math.sin(a)*d,r*1.25,r*.6,r*1.25,0,R()*6,0),gr,{grad:(px,py)=>.6+.5*(py*.5+.5),wind:W(h+2*s),varS:1.4,varA:.4})}
    put('foliage',can[0],mat4(0,h*1.05,0,1.7*s,.75*s,1.7*s,0,R()*6,0),gr,{grad:(px,py)=>.7+.45*(py*.5+.5),wind:W(h+2*s),varS:1.4,varA:.36});
    if(vines){const nv=5+((R()*3)|0),c=Math.cos(ry),sn=Math.sin(ry);       // hanging vines: simulated, see vines.js
      for(let i=0;i<nv;i++){const a=R()*6.283,d=(.8+R()*1.6)*s,lx=Math.cos(a)*d,lz=Math.sin(a)*d,vl=Math.min((2.6+R()*4)*s,h*.8);
        vines(x+lx*c+lz*sn,h*.92,z-lx*sn+lz*c,vl,s,R()*100)}}
    else for(let i=0;i<4;i++){const a=R()*6.283,d=(.8+R()*1.4)*s,vl=(2+R()*3)*s,vg=new T.CylinderGeometry(.018*s,.03*s,vl,4,1);vg.translate(0,-vl/2,0);
      put('foliage',vg,mat4(Math.cos(a)*d,h*.92,Math.sin(a)*d),'#3f8a3a',{grad:(px,py)=>.8+.3*(py/vl+1),wind:{base:0,span:h,gain:.5,phase:ph+i}})}
    return .9*s}
  if(kind==='palm'){            // curved trunk made of leaning segments + a crown of drooping fronds and coconuts
    const h=(4+R()*2.2)*s,lean=(.25+R()*.45)*s,rb=.2*s,gr=pick(PALM,R),da=R()*6.283,dirx=Math.cos(da),dirz=Math.sin(da);
    const P=t=>new T.Vector3(dirx*lean*t*t*h*.5,h*t,dirz*lean*t*t*h*.5),up=new T.Vector3(0,1,0);
    const NP=hi?14:9,pts=Array.from({length:NP},(_,i)=>P(i/(NP-1)));
    put('bark',curveTube(pts,u=>rb*(1-u*.5)*(1+.55*Math.exp(-u*14)),hi?9:7,{noise:.09,ph:R()*30}),mat4(0,0,0),pick(DEADB,R),
      {grad:(px,py)=>.74+.2*Math.sin(py*13)+.12*Math.min(1,py/h),wind:{base:0,span:h,gain:.35,phase:ph}});    // curved smooth trunk, sin(py) = the dark ring scars of old fronds
    const top=P(1),topx=top.x,topz=top.z;
    const nf=9+((R()*3)|0);
    for(let i=0;i<nf;i++){const a=i/nf*6.283+R()*.3,fl=(1.9+R()*.7)*s;
      put('foliage',FROND,mat4(topx,h*.97,topz,fl,1,fl*.9,(R()-.5)*.25,a,.25+R()*.4),gr,{grad:(px,py)=>.7+.5*(px+.5),wind:{base:0,span:h,gain:1.2,phase:ph+i*.3},varS:2,varA:.3})}
    for(let i=0;i<3;i++)B.add('prop',new T.IcosahedronGeometry(1,1),base.clone().multiply(mat4(topx+(R()-.5)*.3,h*.9,topz+(R()-.5)*.3,.13*s,.13*s,.13*s)),'#6b4a22',{varA:.1});
    return .35*s}
  if(kind==='acacia'){          // thin forked trunk, wide flat umbrella canopy
    const h=(3.2+R()*1.6)*s,rb=.24*s,gr=pick(ACAC,R),tl=h*.8;
    trunk(put,R,tl,rb,rb*.55,pick(DEADB,R),W(h+2*s,.2));roots(put,R,rb,s,bark,3,.4);
    const nb=2+((R()*2)|0);
    for(let i=0;i<nb;i++){const a=i/nb*6.283+R(),len=(1.1+R()*.5)*s;
      limb(put,R,mat4(0,tl*.78,0,1,1,1,Math.cos(a)*.65,0,Math.sin(a)*-.65),len,.11*s,.06*s,bark,W(h+2*s,.35),hi?2:1)}
    const n=3+((R()*2)|0);
    for(let i=0;i<n;i++){const a=i/n*6.283+R()*.6,d=i?(1+R()*.9)*s:0,r=(1.5+R()*.8)*s*(i?.85:1.15);
      put('foliage',FLAT,mat4(Math.cos(a)*d,h+(R()-.5)*.3*s,Math.sin(a)*d,r*1.5,r*.3,r*1.5,0,R()*6,0),gr,{grad:(px,py)=>.7+.45*(py*.5+.5),wind:W(h+2*s),varS:1.4,varA:.34})}
    return .5*s}
  // dead tree: bare trunk + crooked branches, no leaves
  const h=(2.4+R()*1.8)*s,rb=(.2+R()*.06)*s,bk=pick(DEADB,R);
  trunk(put,R,h,rb,rb*.3,bk,W(h+1,.15));roots(put,R,rb,s,bk,4,.4);
  const nb=4+((R()*3)|0);
  for(let i=0;i<nb;i++){const a=R()*6.283,len=(.8+R()*1.1)*s,y=h*(.45+R()*.5);
    limb(put,R,mat4(0,y,0,1,1,1,Math.cos(a)*(.7+R()*.5),0,Math.sin(a)*-(.7+R()*.5)),len,.07*s,.025*s,bk,W(h+1,.3),hi?2:1)}
  return .4*s;
}
export const TREE_KINDS=['oak','pine','jungle','palm','acacia','dead'];
