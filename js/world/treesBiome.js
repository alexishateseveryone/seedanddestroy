// ALL biome trees in ONE file, pushed into a Batch like js/trees.js (real geometry, baked per-vertex colour, wind attributes).
//   addBiomeTree(B,R,x,z,scale,kind,quality)   kind: 'oak' | 'pine' | 'jungle' | 'palm' | 'acacia' | 'dead'
// Every kind returns the collision radius it needs, so the map can add an obstacle.
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {mat4,softLump,vnoise} from '../batch.js';
import {curveTube} from './wood.js';
// SHORT HIKE look: simple low-poly trunks / limbs (6 and 5 sided prisms) instead of furrowed bark
const barkTube=(len,rb,rt,R,o={})=>{const g=new T.CylinderGeometry(rt,rb*(o.flare===false?1:1.12),len,o.sides&&o.sides<7?o.sides:6,1);g.translate(0,len/2,0);return g};      // procedural wood: furrowed bark, root flare + buttress lobes, curved roots, curved ringed palm trunk

const AUTUMN=true;   // true = orange / yellow autumn leaves like the Short Hike screenshot, false = summer greens
const OAK=AUTUMN?['#e8692c','#f2923a','#eab63c','#cf4f2a','#a3c041']:['#3f8f4a','#4fa352','#33803f','#5fae4d','#6aa944'],PINE=['#4f9a5c','#5fae6a','#6bb872','#7ec47c','#58a463'],JUNG=['#1f7a34','#2a8f3c','#34a046','#1b6a30'],
  PALM=['#3f9a3a','#52ad43','#6bb84a'],ACAC=['#7c9a3c','#8aa743','#6f8c36'],BARK=['#6b4a30','#7a5636','#5d4129'],DEADB=['#8a7b6a','#7a6c5c','#968675'],JBARK=['#6e5a44','#5f4d3a'];
const CAN_HI=[0,1,2].map(i=>softLump(1,.26,i*3.7)),CAN_LO=[0,1,2].map(i=>softLump(0,.22,i*3.7));   // faceted blobs, flat shaded by the batch material
const FLAT=softLump(1,.16,9.1),FROND=(()=>{const g=new T.PlaneGeometry(1,1,6,1),p=g.attributes.position;       // palm frond: a long blade that droops towards its tip
  for(let i=0;i<p.count;i++){const t=p.getX(i)+.5,w=p.getY(i);p.setXYZ(i,t,-.45*t*t,w*.34*(1-t*.8))}g.computeVertexNormals();return g})();
// ONE-MESH PINE: a single lathe with a saw-tooth profile (5 skirts), unit height / unit base radius, 6 sides. Replaces the 5 separate cones.
const PINE_GEO=(()=>{const n=5,pts=[new T.Vector2(0,0)];for(let i=0;i<n;i++){const y=i/n*.78,r=1-.74*i/(n-1),y2=(i+1)/n*.78,r2=i<n-1?1-.74*(i+1)/(n-1):0;
  pts.push(new T.Vector2(r,y));if(i<n-1)pts.push(new T.Vector2(r2*.55,y2+.02))}
  pts.push(new T.Vector2(.0,1));return new T.LatheGeometry(pts,6)})();
const BLOB=[0,1,2].map(i=>softLump(2,.07,i*3.7));
// ---- TEXTURED CROWNS: instead of rounded blobs, a crown is a cloud of leaf.png cards (unit ellipsoid). Normals point away from the centre, so the cloud still shades like a soft round mass.
const srand=s=>()=>{s=(s*16807)%2147483647;return(s-1)/2147483646};
function leafCluster(n,seed,{size=.6,shell=.12,ys=1}={}){   // shell .12 = cards fill the whole volume down to the centre (no hollow, floating shell)
  const r=srand(Math.floor(seed*1000)+7),parts=[];
  for(let i=0;i<n;i++){let x,y,z;do{x=r()*2-1;y=r()*2-1;z=r()*2-1}while(x*x+y*y+z*z>1||x*x+y*y+z*z<.01);
    const l=Math.hypot(x,y,z),k=shell+(1-shell)*r(),px=x/l*k,py=y/l*k*ys,pz=z/l*k,s=size*(.8+.45*r());
    const g=new T.PlaneGeometry(s,s);g.rotateX((r()-.5)*3.2);g.rotateY(r()*6.283);g.rotateZ((r()-.5)*2);g.translate(px,py,pz);
    const P=g.attributes.position,N=new Float32Array(P.count*3);
    for(let v=0;v<P.count;v++){const a=P.getX(v),b=P.getY(v)/Math.max(ys,.01),c=P.getZ(v),q=Math.hypot(a,b,c)||1;N[v*3]=a/q;N[v*3+1]=b/q;N[v*3+2]=c/q}
    g.setAttribute('normal',new T.BufferAttribute(N,3));parts.push(g)}
  return mergeGeometries(parts,false)}
const LEAF_SIZE=.19;   // size of one leaf.png card in crown units: smaller = finer leaves (more cards below to keep the crown full)
const CL_HI=[0,1,2].map(i=>leafCluster(260,i*3.7+1,{size:LEAF_SIZE})),CL_LO=[0,1,2].map(i=>leafCluster(100,i*3.7+1,{size:LEAF_SIZE*1.5})),
  CL_FLAT=leafCluster(240,9.1,{size:LEAF_SIZE*1.1,ys:.3});
// OLD PINE SHAPE (5 stacked skirts) textured with pinetree.png: each skirt is an open cone whose UV bottom edge (v=0) is the rim, so the PNG's tattered edge is the skirt's hem
const mkSkirts=n=>{const parts=[];
  for(let i=0;i<n;i++){const y=i/n*.78,r=1-.74*i/(n-1),last=i===n-1,y2=last?1:(i+1)/n*.78+.02,r2=last?0:(1-.74*(i+1)/(n-1))*.55,h=y2-y;
    const g=new T.CylinderGeometry(Math.max(r2,.001),r,h,9,1,true);g.translate(0,y+h/2,0);
    const uv=g.attributes.uv;for(let v=0;v<uv.count;v++)uv.setX(v,uv.getX(v)*3);parts.push(g)}   // texture repeats 3x around each skirt
  return mergeGeometries(parts,false)};
const PINE_SKIRTS={3:mkSkirts(3),4:mkSkirts(4),5:mkSkirts(5)};   // low layered pines: 3, 4 or 5 layers (never more than 5)
const LAYER_TONE=[1.08,.9,1.12,.94,1.06];                          // each layer gets its own shade of the pine colour
// PINE CROWN: tiers of leaflong.png blades fanning out from the trunk and drooping, unit height / unit base radius (same box as the old lathe)
const NEEDLE_GEO=(()=>{const parts=[],tiers=5;
  // blades leave the trunk sideways and DROOP (tilt > 90deg = pointing outward and down, like real pine branches); nothing points up
  for(let t=0;t<tiers;t++){const y=.2+t/tiers*.68,rr=1-.7*t/(tiers-1),tilt=2.05-.1*t,len=rr/Math.sin(tilt)*.95,cnt=9-(t>>1);
    for(let c=0;c<cnt;c++){const a=c/cnt*6.283+t*.6,g=new T.PlaneGeometry(len*.55,len);g.translate(0,len/2,0);g.rotateX(tilt);g.rotateY(a);g.translate(0,y,0);parts.push(g)}}
  for(let c=0;c<5;c++){const a=c/5*6.283,len=.3,g=new T.PlaneGeometry(len*.55,len);g.translate(0,len/2,0);g.rotateX(1.5);g.rotateY(a);g.translate(0,.93,0);parts.push(g)}   // small flat cap, sideways not upward
  for(const g of parts){const P=g.attributes.position,N=new Float32Array(P.count*3);
    for(let v=0;v<P.count;v++){const a=P.getX(v),c=P.getZ(v),q=Math.hypot(a,.6,c);N[v*3]=a/q;N[v*3+1]=.6/q;N[v*3+2]=c/q}g.setAttribute('normal',new T.BufferAttribute(N,3))}
  return mergeGeometries(parts,false)})();
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
  const card=k=>k==='leaf'||k==='needle',cl=hi?CL_HI:CL_LO;
  const put=(k,geo,local,col,o={})=>B.add(k,geo,base.clone().multiply(local),col,{...(k==='foliage'||k==='leaf'?{grad:GL}:{}),...o,varA:k==='foliage'?0:card(k)?(o.varA??.2):(o.varA??.3)*.3});
  const W=(span,gain=1)=>({base:0,span,gain,phase:ph});
  const bark=pick(BARK,R);
  if(kind==='pine'){
    const h=(2.6+R()*1.6)*s,tl=h*.78,rb=(.27+R()*.05)*s,tiers=5+((R()*2)|0),gr=pick(PINE,R),y0=h*.36,dy=(h*.52+.9*s)/(tiers-1);
    trunk(put,R,tl,rb,rb*.32,bark,W(h+2.6*s,.28),true);roots(put,R,rb,s,bark);
    const PH=(h*.52+.9*s)+1.1*s,PR=1.75*s*(.92+R()*.16);   // the whole crown = ONE mesh
    const nl=3+((R()*3)|0),lo=R()*2;       // 3..5 layers
    put('needle',PINE_SKIRTS[nl],mat4(0,y0,0,PR,PH,PR,0,R()*6,0),gr,{wind:W(h+2.6*s),varA:.3,
      grad:(px,py)=>{const f=Math.min(nl-.001,Math.max(0,py/.78*nl)),ly=Math.floor(f);return LAYER_TONE[(ly+(lo|0))%5]*(.88+.2*(f-ly))}})   // lighter at the top of every layer, different tone per layer
    return .65*s}
  if(kind==='oak'){
    const h=(2.3+R()*1.5)*s,tl=h*.72,rb=(.34+R()*.07)*s,blossom=R()<.08,gr=blossom?'#f1a9c8':pick(OAK,R),n=4+((R()*2)|0);
    trunk(put,R,tl,rb,rb*.55,bark,W(h+2.6*s,.28),true);roots(put,R,rb,s,bark,5,.8);
    for(let i=0;i<4;i++){const a=i/4*6.283+R()*.8,len=(1.2+R()*.7)*s;                     // 4 big limbs, each forking into twigs
      limb(put,R,mat4(0,tl*.78,0,1,1,1,Math.cos(a)*.85,0,Math.sin(a)*-.85),len,.13*s,.05*s,bark,W(h+2.6*s,.4),hi?2:1)}
    // ONE solid round crown (a main blob + 3 fused ones, SAME colour): the shader paints it flat, light on top / dark underneath
    put('leaf',cl[0],mat4(0,h*.82,0,1.75*s,1.4*s,1.75*s,0,R()*6,0),gr,{grad:(px,py)=>.78+.3*(py*.5+.5),wind:W(h+2.6*s)});
    for(let i=0;i<3;i++){const a=i/3*6.283+R()*.8;
      put('leaf',cl[1],mat4(Math.cos(a)*1.0*s,h*.8+(R()-.3)*.4*s,Math.sin(a)*1.0*s,1.05*s,.9*s,1.05*s,0,R()*6,0),gr,{grad:(px,py)=>.78+.3*(py*.5+.5),wind:W(h+2.6*s)})}
    return .65*s}
  if(kind==='jungle'){          // very tall, buttress roots, a high umbrella of canopy clumps and hanging vines
    const h=(6.5+R()*3.5)*s,rb=(.42+R()*.1)*s,tl=h*.88,gr=pick(JUNG,R),jb=pick(JBARK,R);
    trunk(put,R,tl,rb,rb*.38,jb,W(h+2*s,.18),true);roots(put,R,rb,s,jb,6,1.6);
    const n=6+((R()*3)|0);
    for(let i=0;i<n;i++){const a=i/n*6.283+R()*.5,d=(1.1+R()*1.3)*s,r=(1.3+R()*.8)*s,yy=h*.96+(R()*.9-.2)*s;
      put('leaf',cl[i%3],mat4(Math.cos(a)*d,yy,Math.sin(a)*d,r*1.25,r*.7,r*1.25,0,R()*6,0),gr,{grad:(px,py)=>.6+.5*(py*.5+.5),wind:W(h+2*s),varS:1.4,varA:.3})}
    put('leaf',cl[0],mat4(0,h*1.05,0,1.7*s,.85*s,1.7*s,0,R()*6,0),gr,{grad:(px,py)=>.7+.45*(py*.5+.5),wind:W(h+2*s),varS:1.4,varA:.28});
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
      put('leaf',CL_FLAT,mat4(Math.cos(a)*d,h+(R()-.5)*.3*s,Math.sin(a)*d,r*1.5,r*1.4,r*1.5,0,R()*6,0),gr,{grad:(px,py)=>.7+.45*(py*.5+.5),wind:W(h+2*s),varS:1.4,varA:.3})}
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
