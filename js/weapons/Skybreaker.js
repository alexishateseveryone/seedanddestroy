// Skybreaker: an angel-winged sidearm. Everything is procedural, hand-built geometry (lofts, sweeps, lathes, feather blades):
//   - slide         : glowing red/orange shell (per-vertex emissive heat gradient, slanted heat vents, glowing seam + rib), fresnel aura + muzzle bloom
//   - frame         : lofted dark body with rear sight
//   - grip          : lofted, slanted back, with finger grooves and a base plate;  trigger guard / trigger: swept tubes
//   - muzzle        : a lathed emitter cone with a glowing red core, a red rim ring and four curved electrode prongs
//   - wings         : three layered fans of metal feather blades (lens-shaped solids, curved, edge-darkened) on each side of the
//                     slide's head, each with a glowing red vein along the feather
//   - electric red  : jagged lightning arcs between the prong tips, the wing tips and the slide. Three arc shapes flicker in turn
//                     (a render hook swaps them every frame, no framework support needed) + a pulsing red halo at the muzzle
// Frame: the weapon is built in (u forward, v up, w sideways) and mapped to the group as x=w, y=-u, z=v (same as the other guns).
import * as T from 'three';
import {muzzleTip} from './proc.js';

const PI=Math.PI,TAU=PI*2,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t,sm=t=>t*t*(3-2*t);
const rng=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
const h2=(x,y)=>{const s=Math.sin(x*127.1+y*311.7)*43758.5453;return s-Math.floor(s)};
const W3=(u,v,w)=>[w,-u,v];
const VC=.06;                                   // height of the barrel axis
const C=h=>new T.Color(h),tc=new T.Color();
const SLATE=C('#7a819c'),SLATE_D=C('#3b4058'),DARK=C('#2a2d40'),GRIP=C('#2b2e42'),STEEL=C('#9aa1ba'),EDGE=C('#39406a'),RED_DK=C('#7a1f22');

// ------------------------------------------------------------------ small vector helpers (plain arrays)
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const nrm=a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return[a[0]/l,a[1]/l,a[2]/l]};
const se=(th,n)=>{const c=Math.cos(th),s=Math.sin(th);return[Math.sign(c)*Math.pow(Math.abs(c),2/n),Math.sign(s)*Math.pow(Math.abs(s),2/n)]};   // rounded-rectangle section
const cap=(t,e)=>{const x=Math.min(t,1-t)/e;return x>=1?1:Math.sqrt(Math.max(0,1-(1-x)*(1-x)))};                                              // rounds the ends of a loft

// ------------------------------------------------------------------ geometry "parts": {pos,col,idx}; merged into one BufferGeometry per material
function orient(pos,idx){let v=0;for(let i=0;i<idx.length;i+=3){const a=idx[i]*3,b=idx[i+1]*3,c=idx[i+2]*3;
  v+=pos[a]*(pos[b+1]*pos[c+2]-pos[b+2]*pos[c+1])+pos[a+1]*(pos[b+2]*pos[c]-pos[b]*pos[c+2])+pos[a+2]*(pos[b]*pos[c+1]-pos[b+1]*pos[c])}
  if(v<0)for(let i=0;i<idx.length;i+=3){const t=idx[i+1];idx[i+1]=idx[i+2];idx[i+2]=t}}      // closed surfaces always face outward
function grid(nt,nth,fn){   // fn(t,theta,out): out.p=[u,v,w], out.c=Color. theta wraps around, t does not.
  const n=(nt+1)*nth,pos=new Array(n*3),col=new Array(n*3),idx=[],o={p:[0,0,0],c:tc};
  for(let i=0;i<=nt;i++)for(let j=0;j<nth;j++){const k=i*nth+j;fn(i/nt,j/nth*TAU,o);const p=W3(o.p[0],o.p[1],o.p[2]);pos[k*3]=p[0];pos[k*3+1]=p[1];pos[k*3+2]=p[2];col[k*3]=o.c.r;col[k*3+1]=o.c.g;col[k*3+2]=o.c.b}
  for(let i=0;i<nt;i++)for(let j=0;j<nth;j++){const a=i*nth+j,b=i*nth+(j+1)%nth,c=(i+1)*nth+j,d=(i+1)*nth+(j+1)%nth;idx.push(a,b,c,b,d,c)}
  orient(pos,idx);return{pos,col,idx}}
function merge(parts,closedFix=false){const pos=[],col=[],idx=[];let off=0;
  for(const p of parts){for(const x of p.pos)pos.push(x);for(const x of p.col)col.push(x);for(const i of p.idx)idx.push(i+off);off+=p.pos.length/3}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('color',new T.Float32BufferAttribute(col,3));g.setIndex(idx);g.computeVertexNormals();return g}
function strip(path,width,planeN,wfn){   // flat ribbon along a 3D path, lying in the plane with normal planeN (open, double-sided)
  const pos=[],col=[],idx=[],n=path.length;
  for(let i=0;i<n;i++){const t=nrm(sub(path[Math.min(n-1,i+1)],path[Math.max(0,i-1)])),a=nrm(cross(t,planeN)),hw=(wfn?wfn(i/(n-1)):1)*width/2;
    for(const sg of[1,-1]){const p=W3(...add(path[i],mul(a,sg*hw)));pos.push(p[0],p[1],p[2]);col.push(1,1,1)}}
  for(let i=0;i<n-1;i++){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2)}
  return{pos,col,idx}}
function spline(pts,per=8){const out=[];for(let i=0;i<pts.length-1;i++){const p0=pts[Math.max(0,i-1)],p1=pts[i],p2=pts[i+1],p3=pts[Math.min(pts.length-1,i+2)];
  for(let k=0;k<per;k++){const t=k/per,t2=t*t,t3=t2*t;out.push(p1.map((_,d)=>.5*(2*p1[d]+(-p0[d]+p2[d])*t+(2*p0[d]-5*p1[d]+4*p2[d]-p3[d])*t2+(-p0[d]+3*p1[d]-3*p2[d]+p3[d])*t3)))}}
  out.push(pts[pts.length-1]);return out}
function sweep(ctrl,ra,rb,col,{ref=[0,0,1],per=7,nth=12,end=.1}={}){   // tube along a spline, elliptical section ra x rb, closed (tapered) ends
  const path=spline(ctrl,per),n=path.length;
  return grid(n-1,nth,(t,th,o)=>{const i=Math.round(t*(n-1)),T_=nrm(sub(path[Math.min(n-1,i+1)],path[Math.max(0,i-1)]));let r_=ref;if(Math.abs(dot(T_,ref))>.95)r_=[0,1,0];
    const n1=nrm(cross(T_,r_)),n2=cross(T_,n1),k=cap(t,end),a=ra*k*Math.cos(th),b=rb*k*Math.sin(th);
    o.p=add(path[i],add(mul(n1,a),mul(n2,b)));o.c.copy(col)})}
function lathe(profile,colfn,{smooth=0,seg=28}={}){   // profile [[u,r],...] around the barrel axis (v=VC, w=0); should start and end on the axis (r=0)
  const pts=smooth?spline(profile,smooth):profile,nt=pts.length-1;
  return grid(nt,seg,(t,th,o)=>{const[u,r]=pts[Math.round(t*nt)];o.p=[u,VC+r*Math.cos(th),r*Math.sin(th)];colfn(u,r,th,o.c)})}
const box=(cu,cv,cw,hu,hv,hw,col,n=5)=>grid(14,18,(t,th,o)=>{const k=cap(t,.22),[a,b]=se(th,n);o.p=[cu+(t*2-1)*hu,cv+hv*a*k,cw+hw*b*k];o.c.copy(col)});
const ball=(c,r,col)=>grid(10,14,(t,th,o)=>{const ph=t*PI;o.p=[c[0]+r*Math.cos(ph),c[1]+r*Math.sin(ph)*Math.cos(th),c[2]+r*Math.sin(ph)*Math.sin(th)];o.c.copy(col)});
const ring=(u,R,r,col)=>grid(40,10,(t,th,o)=>{const a=t*TAU,rad=R+r*Math.cos(th);o.p=[u+r*Math.sin(th),VC+rad*Math.cos(a),rad*Math.sin(a)];o.c.copy(col)});

// ================================================================== slide, frame, grip, guard, sights  (one metal mesh)
function bodyParts(){
  const P=[];
  // (slide is built separately by slideGeo(), it is the glowing red/orange part)
  // frame / dust cover under the slide
  P.push(grid(60,26,(t,th,o)=>{const u=lerp(.0,.68,t),k=cap(t,.05),bot=-.05+.018*sm(clamp((u-.2)/.45,0,1)),top=.0,[a,b]=se(th,5);
    o.p=[u,(top+bot)/2+(top-bot)/2*a*k,.036*b*k];o.c.copy(C('#3a1a1e')).multiplyScalar(.9+.3*(a*.5+.5))}));
  // grip: slanted loft with finger grooves on the front
  P.push(grid(64,36,(t,th,o)=>{const v=lerp(-.02,-.295,t),k=cap(t,.05),uc=lerp(-.065,-.125,t),hu=.068+.006*t,hw=.041-.002*t,[cx,cs]=se(th,3.2);
    let gr=0;for(const vg of[-.10,-.155,-.21])gr+=Math.exp(-Math.pow((v-vg)/.011,2));
    o.p=[uc+hu*cx*k-.0065*gr*sm(clamp(cx,0,1)),v,hw*cs*k];
    o.c.copy(GRIP).multiplyScalar(.85+.3*h2(v*90,cx*4)).lerp(SLATE_D,sm(clamp((-cx-.9)/.1,0,1))*.4)}));
  P.push(box(-.125,-.30,0,.079,.014,.046,SLATE_D,6));                                               // magazine base plate
  // trigger guard + trigger (swept tubes), sights, wing mounts
  P.push(sweep([[.035,-.045,0],[.04,-.10,0],[.09,-.135,0],[.17,-.125,0],[.21,-.085,0],[.215,-.03,0]],.0095,.012,STEEL,{ref:[0,0,1]}));
  P.push(sweep([[.125,-.04,0],[.118,-.075,0],[.105,-.102,0]],.0075,.007,C('#c9cde0'),{ref:[0,0,1],per:5}));
  P.push(box(.64,.145,0,.012,.013,.008,DARK),box(-.105,.152,0,.022,.011,.026,DARK),box(-.105,.152,0,.004,.012,.02,SLATE));   // front sight, rear sight (+ notch ridge)
  for(const sd of[1,-1])P.push(box(.50,.112,sd*.0445,.058,.034,.0065,STEEL,7));                           // mounting plates for the wings
  return P}

// ================================================================== the slide: glowing red/orange shell with heat vents (colors drive the emissive glow)
const HOT0=C('#3d0a0d'),HOT1=C('#c91f0e'),ORG=C('#ff7a1c'),YEL=C('#ffc860');
function slideGeo(infl=0,colored=true){
  const u0=-.16,u1=.70,Lu=u1-u0;
  return grid(230,44,(t,th,o)=>{
    const u=u0+t*Lu,k=cap(t,.016/Lu),[cx,cs]=se(th,4.5),front=sm(clamp((u-.46)/.12,0,1));
    const top=.14-.052*sm(clamp((u-.55)/.15,0,1))+infl,bot=-.015+.02*sm(clamp((u-.5)/.2,0,1))-infl,cv=(top+bot)/2,hh=(top-bot)/2;
    let g=0;for(let i=0;i<7;i++)g+=Math.exp(-Math.pow((u+.145-i*.016)/.0048,2));
    const side=sm(clamp((Math.abs(cx)-.72)/.22,0,1))*(1-sm(clamp((Math.abs(cs)-.6)/.3,0,1)));
    const ph=(u+.07*cs)/.05,fr=ph-Math.floor(ph),vent=(u>.12&&u<.46)?sm(clamp(1-Math.abs(fr-.5)/.2,0,1))*side*sm(clamp((u-.12)/.03,0,1))*sm(clamp((.46-u)/.03,0,1)):0;   // slanted heat vents
    const line=Math.exp(-Math.pow((cs-.28)/.05,2))*side*sm(clamp((u+.02)/.05,0,1))*sm(clamp((.6-u)/.05,0,1));                                                       // glowing seam
    const ribw=Math.exp(-Math.pow(cx*.045/.0042,2))*sm(clamp(cs*3,0,1))*sm(clamp((u+.02)/.1,0,1))*sm(clamp((.62-u)/.05,0,1));
    const hw=.043+.011*front*(1-.5*sm(clamp((u-.66)/.04,0,1)))-.004*sm(clamp((-.05-u)/.1,0,1))-.007*g*sm(clamp((Math.abs(cx)-.7)/.25,0,1))-.0042*vent+infl;
    const rib=.007*ribw*(infl?0:1);
    o.p=[u,cv+hh*cs*k+rib,cx*hw*k];
    if(!colored)return;
    const heat=(.3+.7*sm(clamp((u-.08)/.62,0,1)))*(.62+.38*(cs*.5+.5));
    o.c.copy(HOT0).lerp(HOT1,heat).multiplyScalar(.9+.2*h2(u*60,cs*5)).lerp(HOT0,clamp(g,0,1)*.7)
      .lerp(ORG,clamp(vent*.95+line*.8+front*.22*(cs*.5+.5),0,1)).lerp(YEL,clamp(ribw*.7+vent*vent*.35,0,1))})}

// ================================================================== barrel + muzzle emitter + prongs
const PRONG=[];   // tip positions, used for the arcs
function muzzleParts(){
  const P=[],dk=(u,r,th,c)=>c.copy(HOT0).lerp(HOT1,.5).lerp(ORG,Math.sin(u*150)>.55?.85:0),steel=(u,r,th,c)=>c.copy(HOT1).lerp(ORG,clamp((u-.84)/.1,0,1)*.9+.1*Math.cos(th)).lerp(YEL,clamp((u-.93)/.03,0,1)*.6);
  P.push(lathe([[.60,0],[.60,.031],[.62,.034],[.80,.037],[.80,0]],dk));                                                // barrel
  P.push(lathe([[.80,0],[.80,.050],[.812,.057],[.826,.057],[.832,.049],[.836,.046],[.872,.053],[.915,.067],[.948,.066],[.952,.060],[.944,.051],[.91,.043],[.878,.035],[.872,0]],steel,{smooth:3,seg:32}));   // emitter cone (hollow)
  const red=[];const bits={red};
  for(let i=0;i<4;i++){const a=PI/4+i*PI/2,ca=Math.cos(a),sa=Math.sin(a);                                                // four curved electrode prongs
    const ctrl=[[.915,VC+.060*ca,.060*sa],[.950,VC+.074*ca,.074*sa],[.985,VC+.077*ca,.077*sa],[1.015,VC+.066*ca,.066*sa]];
    P.push(sweep(ctrl,.0065,.0065,C('#ff8a3a'),{ref:[0,Math.cos(a+PI/2),Math.sin(a+PI/2)],per:5,nth:8,end:.18}));
    PRONG.push(add(ctrl[3],[.004,0,0]));red.push(ball(add(ctrl[3],[.006,0,0]),.0085,C('#ff4b3a')))}
  red.push(ring(.944,.062,.0045,C('#ff3b2e')));                                                                          // glowing rim
  red.push(lathe([[.874,0],[.874,.030],[.896,.036],[.918,.034],[.918,0]],(u,r,th,c)=>c.set('#ff5a44')));                  // hot core inside the cone
  return{metal:P,red}}

// ================================================================== wings: layered fans of metal feather blades
function wingLayer(sd,{roll,scale,n,cA,cB,seed,root=[.54,.10,.05],hs=1,a0=-4,a1=96,lenK=.66,widK=.092}){
  const cr=Math.cos(roll),sr=Math.sin(roll),R=[root[0],root[1],sd*root[2]],eh=[0,hs*cr,hs*sd*sr],en=[0,-sd*sr,cr],rg=rng(seed);
  const Pw=(pu,ph,pn)=>[R[0]+pu,R[1]+ph*eh[1]+pn*en[1],R[2]+ph*eh[2]+pn*en[2]];
  const feathers=[],veins=[],tips=[],N=20;
  for(let k=0;k<n;k++){
    const q=n>1?k/(n-1):0,th0=(a0+(a1-a0)*q)*PI/180,len=lenK*scale*(.55+.45*Math.sin(PI*(.15+.8*q)))*(.96+.08*rg()),wid=widK*Math.pow(scale,.8),bend=.42+.2*rg(),
      bu=.06-.12*q,bh=-.004+.05*q,nOff=(k%2?.0058:0)+k*.0007;
    const spine=[],dirs=[];let pu=bu,ph=bh;
    for(let i=0;i<=N;i++){const s=i/N,a=th0-bend*s;spine.push([pu,ph]);dirs.push([-Math.cos(a),Math.sin(a)]);pu+=-Math.cos(a)*len/N;ph+=Math.sin(a)*len/N}
    const wS=s=>s<.45?lerp(.55,1,sm(s/.45)):Math.pow(1-(s-.45)/.55,.72),tk=s=>.0042*(1-.45*s)+.0016;
    feathers.push(grid(N,12,(s,ph_,o)=>{const i=Math.round(s*N),[du,dh]=dirs[i],ac=[-dh,du],k_=Math.sqrt(Math.max(0,1-Math.pow(1-Math.min(1,s/.06),2))),w_=wid*wS(s)*k_*(1+.04*Math.sin(s*46+k)),cf=Math.cos(ph_),sf=Math.sin(ph_);
      o.p=Pw(spine[i][0]+ac[0]*w_*cf,spine[i][1]+ac[1]*w_*cf,nOff+tk(s)*k_*sf*(s>.9?(1-s)*10:1));
      o.c.copy(cA).lerp(cB,s*.9).multiplyScalar(.92+.16*Math.abs(sf)).lerp(EDGE,sm(clamp((Math.abs(cf)-.84)/.16,0,1))*.8)}));
    const vp=[];for(let i=2;i<=N-2;i++){const s=i/N;vp.push(Pw(spine[i][0],spine[i][1],nOff+tk(s)+.0016))}
    veins.push(strip(vp,.0046,en,s=>1-.55*s));
    tips.push(Pw(spine[N][0],spine[N][1],nOff));
  }
  return{feathers,veins,tips,joint:Pw(0,0,.012),en}}

// ================================================================== lightning arcs
function arcPts(a,b,seed,amp,segs){
  const R=rng(seed),d=sub(b,a),len=Math.hypot(d[0],d[1],d[2]),dir=nrm(d),ref=Math.abs(dir[2])>.9?[0,1,0]:[0,0,1],p1=nrm(cross(dir,ref)),p2=cross(dir,p1),pts=[a];
  for(let i=1;i<segs;i++){const t=i/segs,env=Math.sin(PI*t)*amp*len,base=add(a,mul(d,t));pts.push(add(base,add(mul(p1,(R()-.5)*2*env),mul(p2,(R()-.5)*2*env))))}
  pts.push(b);return pts}
function arcVariant(pairs,seed){
  const lines=[],R=rng(seed*7+1);
  pairs.forEach((p,i)=>{const pts=arcPts(p[0],p[1],seed*100+i,.16,7);lines.push(pts);
    if(R()<.45){const m=pts[3],e=add(m,[(R()-.5)*.14,(R()-.5)*.14,(R()-.5)*.14]);lines.push(arcPts(m,e,seed*100+i+50,.2,3))}});   // small side branches
  const glow=[],core=[];
  for(const l of lines){                                                                                                  // crossed ribbons so it reads from any side
    for(const nrmv of[[0,1,0],[0,0,1],[1,0,0]]){glow.push(strip(l,.0085,nrmv,s=>Math.sin(PI*Math.min(1,s*1.15))*.9+.1));core.push(strip(l,.0028,nrmv,s=>Math.sin(PI*Math.min(1,s*1.15))*.9+.1))}}
  return{glow:merge(glow),core:merge(core)}}

export default {
  id:'skybreaker',name:'Skybreaker',kind:'gun',handling:'pistol',lean:0,
  stats:{cd:.05,dmg:1,spread:.045,speed:42,auto:true,kick:.5,shake:.09,push:.5,zoom:44,color:'#ff6a5a',move:1.05,pierce:1,mag:6, reload:1.1},
  build(){
    PRONG.length=0;
    const g=new T.Group(),mk=(geo,mat)=>{const m=new T.Mesh(geo,mat);g.add(m);return m};
    const metal=new T.MeshStandardMaterial({vertexColors:true,metalness:.4,roughness:.42}),
          feather=new T.MeshStandardMaterial({vertexColors:true,metalness:.35,roughness:.32}),
          glowRed=new T.MeshBasicMaterial({color:'#ff3b2e',side:T.DoubleSide}),
          add_=c=>new T.MeshBasicMaterial({color:c,transparent:true,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide});
    // body + muzzle
    const mz=muzzleParts(),red=[...mz.red];
    mk(merge(bodyParts()),metal);
    const hot=new T.MeshStandardMaterial({vertexColors:true,metalness:.55,roughness:.34,emissive:'#ffffff',emissiveIntensity:.8});
    hot.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('vec3 totalEmissiveRadiance = emissive;','vec3 totalEmissiveRadiance = emissive * vColor * 1.5;')};   // per-vertex glow: hot parts shine, dark parts don't
    mk(merge([slideGeo(0,true),...mz.metal]),hot);
    // AAA glow: fresnel heat aura over the slide + a bloom sphere at the muzzle (both additive, no lights needed)
    const fres=(c,k)=>new T.ShaderMaterial({uniforms:{col:{value:new T.Color(c)},k:{value:k}},transparent:true,depthWrite:false,blending:T.AdditiveBlending,
      vertexShader:'varying vec3 vN;varying vec3 vV;void main(){vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
      fragmentShader:'uniform vec3 col;uniform float k;varying vec3 vN;varying vec3 vV;void main(){float f=pow(1.-abs(dot(normalize(vN),normalize(vV))),2.4);gl_FragColor=vec4(col*f*k,1.);}'});
    const auraM=fres('#ff5a18',1.25),bloomM=fres('#ff6a22',1.6);
    mk(merge([slideGeo(.0075,false)]),auraM);
    mk(merge([ball([.985,VC,0],.15,C('#ffffff'))]),bloomM);
    const addV=new T.MeshBasicMaterial({vertexColors:true,transparent:true,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide});
    const flare=(rv,rw,col)=>grid(7,32,(t,th,o)=>{o.p=[.99,VC+rv*t*Math.sin(th),rw*t*Math.cos(th)];o.c.copy(col).multiplyScalar(Math.pow(1-t,2.2))});
    mk(merge([flare(.15,.15,C('#ff7a2a')),flare(.012,.42,C('#ffb060')),flare(.3,.01,C('#ff5a20'))]),addV);   // soft flare + anamorphic streak
    // wings (3 layers per side) with joints and red veins
    const wings=[],wingParts=[],secs=[];
    for(const sd of[1,-1]){
      const layers=[{roll:.30,scale:1,n:9,cA:C('#f4f6ff'),cB:C('#c3cae4'),seed:3},{roll:.70,scale:.8,n:7,cA:C('#d3d9ee'),cB:C('#97a2c6'),seed:9},{roll:1.05,scale:.58,n:6,cA:C('#f4f6ff'),cB:C('#b4bcd9'),seed:15}]
        .map((o,i)=>wingLayer(sd,{...o,seed:o.seed+(sd>0?0:40)}));
      layers.forEach((L,i)=>{wingParts.push(...L.feathers);if(i!==1)red.push(...L.veins)});
      wingParts.push(ball(layers[0].joint,.022,STEEL));red.push(ball(add(layers[0].joint,mul(layers[0].en,.016)),.0095,C('#ff4b3a')));
      wings.push(layers)
      const sec=[{root:[.22,.118,.05],roll:.6,hs:1,a0:2,a1:26,n:5,scale:1,lenK:.5,widK:.05,cA:C('#f4f6ff'),cB:C('#b4bcd9'),seed:21},
                 {root:[.22,.118,.052],roll:1.0,hs:1,a0:6,a1:30,n:4,scale:.75,lenK:.42,widK:.045,cA:C('#d3d9ee'),cB:C('#97a2c6'),seed:27}]
        .map((o,i)=>wingLayer(sd,{...o,seed:o.seed+(sd>0?0:40)}));
      sec.forEach((L,i)=>{wingParts.push(...L.feathers);if(i%2===0)red.push(...L.veins);wingParts.push(ball(L.joint,.014,STEEL))});
      secs.push(sec)}
    mk(merge(wingParts),feather);
    mk(merge(red),glowRed);
    // electric arcs: prong to prong, wing tips to the prongs / slide, feather to feather
    const pairs=[];for(let i=0;i<4;i++)pairs.push([PRONG[i],PRONG[(i+1)%4]]);
    wings.forEach((layers,s)=>{const t1=layers[0].tips,t3=layers[2].tips,pr=PRONG[s?1:0];
      pairs.push([t1[1],t1[3]],[t1[4],t1[6]],[t1[0],[.62,.15,0]],[t3[2],t1[5]],[layers[0].joint,t1[7]]);
      if(t1[2])pairs.push([t1[2],pr]);const q=secs[s];pairs.push([q[0].tips[3],t1[5]],[q[0].tips[1],t1[0]]);});
    const variants=[1,2,3].map(sd=>{const v=arcVariant(pairs,sd),grp=new T.Group();grp.add(new T.Mesh(v.glow,add_('#ff4a14')),new T.Mesh(v.core,add_('#ffe6b0')));g.add(grp);return grp});
    variants.forEach((v,i)=>v.visible=i===0);
    // pulsing halo at the muzzle; its render hook also drives the arc flicker
    const halo=mk(merge([grid(12,16,(t,th,o)=>{const ph=t*PI,r=.055;o.p=[.975+r*Math.cos(ph),VC+r*Math.sin(ph)*Math.cos(th),r*Math.sin(ph)*Math.sin(th)];o.c.set('#ff5a20')})]),add_('#ff4a14'));
    halo.material.opacity=.25;
    halo.onBeforeRender=()=>{const t=performance.now()*.001,i=Math.floor(t*16)%3;variants.forEach((v,k)=>{v.visible=k===i});halo.material.opacity=.2+.1*Math.sin(t*34);
      hot.emissiveIntensity=.8+.18*Math.sin(t*6.5)+.1*Math.sin(t*23);auraM.uniforms.k.value=1.2+.3*Math.sin(t*5.3);bloomM.uniforms.k.value=1.5+.5*Math.sin(t*31)*Math.sin(t*3.7)};
    return {group:g,tip:muzzleTip(g,.97,.06)};
  }
};