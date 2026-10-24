// ALL biome trees in ONE file, pushed into a Batch like js/trees.js (real geometry, baked per-vertex colour, wind attributes).
//   addBiomeTree(B,R,x,z,scale,kind,quality)   kind: 'oak' | 'pine' | 'jungle' | 'palm' | 'acacia' | 'dead'
// Every kind returns the collision radius it needs, so the map can add an obstacle.
// NOTHING here is a fixed shape: trunks lean and wobble (noise), branches are grown step by step (they drift, reach for the light, fork), roots are 2-8 per tree
// with random length / thickness / angle and are buried in the soil, foliage clumps hang on the branch tips with random size / squash / colour. The palette stays
// low-poly and flat coloured. Same seed => same tree, so chunks rebuild identically.
import * as T from 'three';
import {mat4,softLump} from '../batch.js';
import {trunkGeo,limbGeo,rootGeo,loft,wander} from './meshes.js';

const OAK=['#3f8f4a','#4fa352','#33803f','#5fae4d','#6aa944'],PINE=['#2c6b44','#357b4a','#27613f','#3f8a50'],JUNG=['#1f7a34','#2a8f3c','#34a046','#1b6a30'],
  PALM=['#3f9a3a','#52ad43','#6bb84a'],ACAC=['#7c9a3c','#8aa743','#6f8c36'],BARK=['#6b4a30','#7a5636','#5d4129','#654630'],DEADB=['#8a7b6a','#7a6c5c','#968675'],JBARK=['#6e5a44','#5f4d3a'];
const CAN_HI=[0,1,2].map(i=>softLump(2,.2,i*3.7)),CAN_LO=[0,1,2].map(i=>softLump(1,.18,i*3.7));
const FROND=(()=>{const g=new T.PlaneGeometry(1,1,6,1),p=g.attributes.position;       // palm frond: a long blade that droops towards its tip
  for(let i=0;i<p.count;i++){const t=p.getX(i)+.5,w=p.getY(i);p.setXYZ(i,t,-.45*t*t,w*.34*(1-t*.8))}g.computeVertexNormals();return g})();
const COCO=new T.IcosahedronGeometry(1,1);
/** pine tier cones: a few different lumpy variants so the tiers of one tree (and the trees of one forest) are not copies */
const coneVar=seed=>{const g=new T.ConeGeometry(1,1,9,2),p=g.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),r=Math.hypot(x,z);if(r<1e-3)continue;
    const a=Math.atan2(z,x),k=1+.16*Math.sin(a*3+1.3+seed)+.1*Math.sin(a*7+.4+seed*1.7)+.07*Math.sin(a*13+seed*.6),f=y<-.4?k:(1+(k-1)*.5);p.setXYZ(i,x*f,y-(y<-.4?.07*(k-.85):0),z*f)}
  g.computeVertexNormals();return g};
const PCONES=[0,1,2,3,4].map(i=>coneVar(i*2.7+.5));
const pick=(a,R)=>a[(R()*a.length)|0],mix2=(a,b,t)=>'#'+new T.Color(a).lerp(new T.Color(b),t).getHexString(),rnd=(R,a,b)=>a+(b-a)*R();
const I=()=>mat4(0,0,0);
const dirFrom=(yaw,pit)=>[Math.cos(yaw)*Math.cos(pit),Math.sin(pit),Math.sin(yaw)*Math.cos(pit)];

export function addBiomeTree(B,R,x,z,s=1,kind='oak',q='hi',vines=null){
  const ph=R()*20,ry=R()*6.283,base=mat4(x,0,z,1,1,1,0,ry,0),can=q==='hi'?CAN_HI:CAN_LO;
  const put=(k,geo,local,col,o)=>B.add(k,geo,base.clone().multiply(local),col,o);
  const W=(span,gain=1)=>({base:0,span,gain,phase:ph});
  const bark=pick(BARK,R);

  /** trunk: noisy + leaning + buried foot (meshes.js). Returns {at(t)} to hang limbs / foliage on. */
  const trunk=(len,rb,rt,o,col,wind)=>{const Tk=trunkGeo(len,rb,rt,R,o);
    put('bark',Tk.geo,I(),col,{grad:(px,py)=>(.7+.4*Math.min(1,Math.max(0,py)/len))*(.94+.06*Math.sin(px*46)),wind});return Tk};
  /** roots: 2-8 per tree at random angles, random reach / thickness / hump height / sideways curl, always diving into the soil. tall = big buttress roots. */
  const roots=(rb,n=4,len=.55,col=bark,tall=false)=>{n=Math.max(2,Math.round(n+(R()-.5)*2));let a=R()*6.283;
    for(let i=0;i<n;i++){a+=6.283/n*(.55+R()*.9);
      const reach=(len*s*1.25+rb*.8)*(.55+R()*.9),hgt=(Math.min(len*s*.5,rb*2.2)*(.45+R()*.8)+.1)*(tall?1.5:1),thick=(.38+R()*.42)*(tall?1.35:1);
      put('bark',rootGeo(rb,reach,hgt,a,R,{thick,curl:(R()-.5)*1.8,dive:.5+R()*.7}),I(),col,{grad:(px,py)=>.7+.25*Math.min(1,Math.max(0,py+.2)/(hgt+.3))})}};
  /** grow a branch and (depth>0) fork it. Branch tips are collected in ctx.tips for foliage. */
  const grow=(ctx,p,d,len,r0,r1,depth,o)=>{
    const L=limbGeo(p,d,len,r0,r1,R,{sides:depth?5:6,up:o.up,noise:o.noise,droop:o.droop,rough:.06});
    put('bark',L.geo,I(),ctx.bark,{grad:()=>.8+.1*R(),wind:ctx.wind});
    if(depth>0){const n=1+(R()<.65?1:0)+(R()<.25?1:0);
      for(let i=0;i<n;i++){const qq=L.at(.4+R()*.5),nd=[qq.dx+(R()-.5)*1.7,qq.dy+R()*.55-.1,qq.dz+(R()-.5)*1.7];
        grow(ctx,[qq.x,qq.y,qq.z],nd,len*(.4+R()*.35),qq.r*.8,r1*.7,depth-1,o)}}
    ctx.tips.push({pos:L.end,r:L.rEnd});return L};
  /** foliage clumps on the tips: random size, squash, tilt and a slightly different green each */
  const canopy=(tips,gr,light,size,flat,wind,extra=0)=>{
    for(const tp of tips){const n=tp.big?2+((R()*2)|0):1+(R()<.45?1:0);
      for(let j=0;j<n;j++){const r=size*(.7+R()*.6)*(tp.big?1.15:1),jr=r*.7;
        put('foliage',can[(R()*3)|0],mat4(tp.pos[0]+(R()-.5)*jr,tp.pos[1]+(R()-.15)*r*.5+r*.3,tp.pos[2]+(R()-.5)*jr,r*(1+(R()-.5)*.35),r*flat*(.85+R()*.3),r*(1+(R()-.5)*.35),(R()-.5)*.35,R()*6,(R()-.5)*.35),
          R()<.55?mix2(gr,light,.08+R()*.2):gr,{grad:(px,py)=>.66+.5*(py*.5+.5),wind,varS:1.5,varA:.36})}}
    for(let i=0;i<extra;i++){const tp=tips[(R()*tips.length)|0],r=size*(.55+R()*.4);                      // a few loose clumps so no crown has holes in it
      put('foliage',can[(R()*3)|0],mat4(tp.pos[0]+(R()-.5)*size*1.4,tp.pos[1]+(R()-.3)*size*.8,tp.pos[2]+(R()-.5)*size*1.4,r,r*flat*.9,r,0,R()*6,0),mix2(gr,light,R()*.2),{grad:(px,py)=>.66+.5*(py*.5+.5),wind,varS:1.5,varA:.36})}};

  if(kind==='pine'){
    const h=rnd(R,2.5,4.6)*s,tl=h*rnd(R,.72,.86),rb=rnd(R,.23,.35)*s,gr=pick(PINE,R),wnd=W(h+2.6*s,.28);
    const Tk=trunk(tl,rb,rb*rnd(R,.22,.38),{lean:(R()-.5)*.5*s,wob:.14*s,flare:.2+R()*.3,sides:7},bark,wnd);roots(rb,2+R()*3,.5);
    for(let i=0,n=1+((R()*3)|0);i<n;i++){const qq=Tk.at(.12+R()*.3),yaw=R()*6.283;                              // short dead stubs low on the trunk
      const L=limbGeo([qq.x,qq.y,qq.z],dirFrom(yaw,.1+R()*.4),(.25+R()*.4)*s,qq.r*.35,.02*s,R,{sides:4,noise:.2,droop:.2});put('bark',L.geo,I(),bark,{grad:()=>.8,wind:wnd})}
    const tiers=5+((R()*4)|0),y0=h*rnd(R,.26,.42),dy=(h*.55+.9*s)/(tiers-1);let y=y0;
    for(let i=0;i<tiers;i++){const t=i/(tiers-1),rad=(1.75-1.3*t)*s*rnd(R,.8,1.2),hh=(1.35-.3*t)*s*rnd(R,.85,1.2),qq=Tk.at(Math.min(1,y/tl)),sq=rnd(R,.88,1.12);
      put('foliage',PCONES[(R()*PCONES.length)|0],mat4(qq.x+(R()-.5)*.14*s,y+hh*.5,qq.z+(R()-.5)*.14*s,rad*sq,hh,rad/sq,(R()-.5)*.2,R()*6,(R()-.5)*.2),R()<.4?mix2(gr,'#4a9a58',R()*.3):gr,
        {grad:(px,py)=>.58+.62*Math.min(1,Math.max(0,py+.5))*(1-.15*i/tiers),wind:W(h+2.6*s),varS:1.3,varA:.34});
      y+=dy*rnd(R,.8,1.25)}
    return .65*s}

  if(kind==='oak'){
    const h=rnd(R,2.4,4)*s,tl=h*rnd(R,.55,.75),rb=rnd(R,.24,.37)*s,blossom=R()<.08,gr=blossom?'#f1a9c8':pick(OAK,R),wnd=W(h+2.6*s,.28);
    const Tk=trunk(tl,rb,rb*rnd(R,.35,.6),{lean:(R()-.5)*.8*s,wob:rnd(R,.15,.5)*s,flare:.25+R()*.4,sides:8},bark,wnd);roots(rb,3+R()*3,.6);
    const ctx={bark,wind:W(h+2.6*s,.4),tips:[]},nl=2+((R()*3)|0);let yaw=R()*6.283;
    for(let i=0;i<nl;i++){yaw+=6.283/nl*(.6+R()*.8);const qq=Tk.at(.6+R()*.38);
      grow(ctx,[qq.x,qq.y,qq.z],dirFrom(yaw,.2+R()*.9),rnd(R,.9,2)*s,qq.r*.7,.035*s,R()<.7?1:0,{up:.45,noise:.5,droop:.1})}
    const top=Tk.at(1);ctx.tips.push({pos:[top.x,top.y,top.z],r:top.r,big:1});
    canopy(ctx.tips,gr,'#c8ff8a',rnd(R,.8,1.25)*s,.82,W(h+2.6*s),2);
    return .65*s}

  if(kind==='jungle'){          // very tall, noisy trunk, big buttress roots, an umbrella of canopy clumps and hanging vines
    const h=rnd(R,6.5,10)*s,rb=rnd(R,.4,.56)*s,tl=h*.88,gr=pick(JUNG,R),jb=pick(JBARK,R),wnd=W(h+2*s,.18);
    const Tk=trunk(tl,rb,rb*rnd(R,.3,.45),{lean:(R()-.5)*1.4*s,wob:.6*s,flare:.55,sides:9,bury:.5},jb,wnd);roots(rb,5+R()*3,1.6,jb,true);
    const ctx={bark:jb,wind:W(h+2*s,.25),tips:[]},nl=2+((R()*3)|0);let yaw=R()*6.283;
    for(let i=0;i<nl;i++){yaw+=6.283/nl*(.6+R()*.8);const qq=Tk.at(.72+R()*.25);
      grow(ctx,[qq.x,qq.y,qq.z],dirFrom(yaw,.15+R()*.6),rnd(R,1.4,3.2)*s,qq.r*.7,.05*s,1,{up:.35,noise:.5,droop:0})}
    const top=Tk.at(1);ctx.tips.push({pos:[top.x,top.y,top.z],r:top.r,big:1});
    canopy(ctx.tips,gr,'#9be86a',rnd(R,1.3,1.9)*s,.5,W(h+2*s),3);
    if(vines){const nv=5+((R()*3)|0),c=Math.cos(ry),sn=Math.sin(ry);       // hanging vines: simulated, see vines.js
      for(let i=0;i<nv;i++){const a=R()*6.283,d=(.8+R()*1.6)*s,lx=Math.cos(a)*d+top.x,lz=Math.sin(a)*d+top.z,vl=Math.min((2.6+R()*4)*s,h*.8);
        vines(x+lx*c+lz*sn,h*.92,z-lx*sn+lz*c,vl,s,R()*100)}}
    else for(let i=0;i<4;i++){const a=R()*6.283,d=(.8+R()*1.4)*s,vl=(2+R()*3)*s,vg=new T.CylinderGeometry(.018*s,.03*s,vl,4,1);vg.translate(0,-vl/2,0);
      put('foliage',vg,mat4(Math.cos(a)*d,h*.92,Math.sin(a)*d),'#3f8a3a',{grad:(px,py)=>.8+.3*(py/vl+1),wind:{base:0,span:h,gain:.5,phase:ph+i}})}
    return .9*s}

  if(kind==='palm'){            // curved, noisy trunk (rings) + a crown of drooping fronds of random length / droop and coconuts
    const h=rnd(R,3.8,6.4)*s,lean=rnd(R,.2,.9)*s,segs=7+((R()*3)|0),rb=rnd(R,.17,.24)*s,gr=pick(PALM,R),da=R()*6.283,dx=Math.cos(da),dz=Math.sin(da),Wd=wander(R,.35*s,1),ph2=R()*6;
    const P=[],Rd=[];for(let i=-1;i<=segs;i++){const t=Math.max(0,i/segs),w=Wd(t);P.push([dx*lean*t*t*h*.5+w[0],i<0?-.3:h*t,dz*lean*t*t*h*.5+w[1]]);Rd.push(rb*(1-t*.5)*(1+.07*Math.sin(i*2.6+ph2))*(i<0?1.2:1))}
    put('bark',loft(P,Rd,{sides:7,rough:.06,seed:R()*10,cap:true}).geo,I(),pick(DEADB,R),{grad:(px,py)=>.8+.3*Math.min(1,Math.max(0,py)/h),wind:{base:0,span:h,gain:.35,phase:ph}});
    const top=P[P.length-1],topx=top[0],topz=top[2],nf=8+((R()*5)|0);
    for(let i=0;i<nf;i++){const a=i/nf*6.283+R()*.5,fl=rnd(R,1.6,2.8)*s;
      put('foliage',FROND,mat4(topx,top[1]*.99,topz,fl,1,fl*rnd(R,.75,1.05),(R()-.5)*.3,a,.15+R()*.6),R()<.5?mix2(gr,'#c8ff8a',.1+R()*.15):gr,{grad:(px,py)=>.7+.5*(px+.5),wind:{base:0,span:h,gain:1.2,phase:ph+i*.3},varS:2,varA:.3})}
    for(let i=0,n=2+((R()*3)|0);i<n;i++)B.add('prop',COCO,base.clone().multiply(mat4(topx+(R()-.5)*.3,top[1]-.1-R()*.15,topz+(R()-.5)*.3,.12*s,.12*s,.12*s)),'#6b4a22',{varA:.1});
    return .35*s}

  if(kind==='acacia'){          // thin leaning trunk, forked limbs that reach up and out, wide flat umbrella clumps on the tips
    const h=rnd(R,3,5)*s,rb=rnd(R,.2,.3)*s,gr=pick(ACAC,R),tl=h*rnd(R,.6,.8),bk=pick(DEADB,R),wnd=W(h+2*s,.2);
    const Tk=trunk(tl,rb,rb*rnd(R,.45,.7),{lean:(R()-.5)*1.4*s,wob:.4*s,flare:.3,sides:7},bk,wnd);roots(rb,2+R()*2,.4,bk);
    const ctx={bark:bk,wind:W(h+2*s,.35),tips:[]},nl=2+((R()*3)|0);let yaw=R()*6.283;
    for(let i=0;i<nl;i++){yaw+=6.283/nl*(.6+R()*.8);const qq=Tk.at(.7+R()*.3);
      grow(ctx,[qq.x,qq.y,qq.z],dirFrom(yaw,.45+R()*.6),rnd(R,1,2.1)*s,qq.r*.75,.04*s,1,{up:.55,noise:.45,droop:0})}
    const top=Tk.at(1);ctx.tips.push({pos:[top.x,top.y,top.z],r:top.r,big:1});
    for(const tp of ctx.tips){const r=rnd(R,1.2,2.1)*s*(tp.big?1.1:.85);
      put('foliage',can[(R()*3)|0],mat4(tp.pos[0],tp.pos[1]+(R()-.2)*.3*s,tp.pos[2],r*1.5,r*.3,r*1.5,(R()-.5)*.15,R()*6,(R()-.5)*.15),R()<.5?mix2(gr,'#e8e38a',.1+R()*.15):gr,{grad:(px,py)=>.7+.45*(py*.5+.5),wind:W(h+2*s),varS:1.4,varA:.34})}
    return .5*s}

  // dead tree: bare crooked trunk (sometimes broken off) + twisted, drooping branches, no leaves
  const h=rnd(R,2.3,4.4)*s,rb=rnd(R,.19,.3)*s,bk=pick(DEADB,R),wnd=W(h+1,.15);
  const Tk=trunk(h,rb,rb*rnd(R,.2,.45),{lean:(R()-.5)*1.1*s,wob:rnd(R,.3,.8)*s,flare:.3,sides:7,rough:.14},bk,wnd);roots(rb,3+R()*2,.45,bk);
  const ctx={bark:bk,wind:W(h+1,.3),tips:[]},nb=3+((R()*4)|0);let yaw=R()*6.283;
  for(let i=0;i<nb;i++){yaw+=6.283/nb*(.5+R()*1);const qq=Tk.at(.35+R()*.62);
    grow(ctx,[qq.x,qq.y,qq.z],dirFrom(yaw,rnd(R,-.2,.8)),rnd(R,.7,1.8)*s,qq.r*.6,.02*s,R()<.6?1:0,{up:rnd(R,-.2,.3),noise:.7,droop:R()*.25})}
  return .4*s;
}
export const TREE_KINDS=['oak','pine','jungle','palm','acacia','dead'];