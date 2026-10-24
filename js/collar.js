// Collars WITH CLOTH PHYSICS, three types: normal (leather belt), furry (fur ruff) and scarf (knitted wrap + hanging tail).
// A wide strap sits right under the chin; two Cloth layers (outer + lining) give it thickness and the exact same physics as the cloak.
// Row 0 is the pinned TOP rim, the strap hangs from it. The surface (leather / fur / knit) is a canvas texture on the cloth mesh;
// buckle + studs (normal), fur puffs (furry) and the scarf tail (scarf, its own cloth) follow the cloth every frame.
// belt.anchor(v) gives the point at the bottom-centre of the collar so the name plate can hang from it.
import * as T from 'three';
import {Cloth} from './physics.js';

export const COLLAR_COLS=25,COLLAR_ROWS=4;
export const COLLAR_TYPES=[['normal','Normal'],['furry','Furry'],['scarf','Scarf']];
const GAP=-.3;                        // negative = the two ends overlap at the back, so there is no cut-out
const TOP=-.69;                       // y of the top rim: right under the head
// per type: strap height, ellipse radii (shoulder width x, chest depth z) and how much it flares at the hem
const TY={normal:{h:.30,rx:.72,rz:.47,fx:.05,fz:.03},furry:{h:.36,rx:.78,rz:.52,fx:.10,fz:.07},scarf:{h:.40,rx:.77,rz:.51,fx:.06,fz:.04}};
const tyOf=t=>TY[t]||TY.normal;

// rest shape: wide ellipse, slightly flared at the hem. inset shrinks a layer (lining)
export function collarRest(inset=0,type='normal'){
  const out=[],Y=tyOf(type);
  for(let r=0;r<COLLAR_ROWS;r++){
    const k=r/(COLLAR_ROWS-1),bul=type==='scarf'?.035*Math.sin(Math.PI*k):0;   // the scarf bulges in the middle like a wrapped roll
    for(let c=0;c<COLLAR_COLS;c++){
      const a=(c/(COLLAR_COLS-1)-.5)*(Math.PI*2-2*GAP),sp=.03*(c/(COLLAR_COLS-1)),fold=(type==='furry'?0:.01)*Math.sin(a*7)*k;
      const rx=Y.rx+Y.fx*k+fold-inset+sp+bul,rz=Y.rz+Y.fz*k+fold-inset+sp+bul;
      out.push(new T.Vector3(Math.sin(a)*rx,TOP-Y.h*k,Math.cos(a)*rz));
    }
  }
  return out;
}

// ---------- procedural surface textures (grey-scale, tinted by the material colour; each created once) ----------
const TX={};
function canvas(W,H){const c=document.createElement('canvas');c.width=W;c.height=H;return [c,c.getContext('2d')]}
function finish(c,rx,ry){const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(rx,ry);t.anisotropy=4;t.needsUpdate=true;return t}
const seeded=s=>()=>(s=(s*1664525+1013904223)>>>0)/4294967296;

function leatherTex(){
  if(TX.leather)return TX.leather;
  const W=2048,H=256,[c,g]=canvas(W,H),rnd=seeded(1234567);
  g.fillStyle='#d4d4d4';g.fillRect(0,0,W,H);
  for(let i=0;i<9000;i++){const x=rnd()*W,y=rnd()*H,r=6+rnd()*22;                        // soft mottling
    g.fillStyle=rnd()<.5?`rgba(0,0,0,${.012+rnd()*.03})`:`rgba(255,255,255,${.012+rnd()*.03})`;g.beginPath();g.arc(x,y,r,0,6.283);g.fill()}
  for(let i=0;i<42000;i++){const x=rnd()*W,y=rnd()*H,r=.7+rnd()*1.9;                       // grain: pits and highlights
    g.fillStyle=rnd()<.55?`rgba(0,0,0,${.10+rnd()*.22})`:`rgba(255,255,255,${.10+rnd()*.2})`;g.beginPath();g.arc(x,y,r,0,6.283);g.fill()}
  g.lineCap='round';
  for(let i=0;i<520;i++){let x=rnd()*W,y=rnd()*H;g.strokeStyle=`rgba(0,0,0,${.14+rnd()*.2})`;g.lineWidth=.7+rnd()*1.1;g.beginPath();g.moveTo(x,y);   // cracks
    const a0=rnd()*6.283,n=4+((rnd()*6)|0);for(let k=0;k<n;k++){x+=Math.cos(a0+rnd()-.5)*(5+rnd()*7);y+=Math.sin(a0+rnd()-.5)*(5+rnd()*7);g.lineTo(x,y)}g.stroke()}
  for(const v of [.1,.9]){const y=H*(1-v),rr=(x,w)=>{g.beginPath();g.roundRect?g.roundRect(x,y-4,w,7,3):g.rect(x,y-4,w,7);g.fill()};   // stitches near both edges
    g.fillStyle='rgba(0,0,0,.35)';for(let x=0;x<W;x+=28){g.save();g.translate(1,2);rr(x,16);g.restore()}
    g.fillStyle='#f3e4b8';for(let x=0;x<W;x+=28)rr(x,16)}
  return TX.leather=finish(c,1.6,1);
}
function furTex(){                                       // dense short hair strands, mostly hanging down
  if(TX.fur)return TX.fur;
  const W=1024,H=256,[c,g]=canvas(W,H),rnd=seeded(777);
  g.fillStyle='#e4e4e4';g.fillRect(0,0,W,H);
  for(let i=0;i<2500;i++){const x=rnd()*W,y=rnd()*H,r=8+rnd()*20;g.fillStyle=rnd()<.5?`rgba(0,0,0,${.02+rnd()*.05})`:`rgba(255,255,255,${.03+rnd()*.06})`;g.beginPath();g.arc(x,y,r,0,6.283);g.fill()}
  g.lineCap='round';
  for(let i=0;i<20000;i++){const x=rnd()*W,y=rnd()*H,a=Math.PI/2+(rnd()-.5)*.9,l=5+rnd()*11;
    g.strokeStyle=rnd()<.5?`rgba(0,0,0,${.07+rnd()*.16})`:`rgba(255,255,255,${.18+rnd()*.3})`;g.lineWidth=.8+rnd()*1.3;
    g.beginPath();g.moveTo(x,y);g.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l);g.stroke()}
  return TX.fur=finish(c,2,1);
}
function knitTex(){                                      // knitted V stitches + two stripes
  if(TX.knit)return TX.knit;
  const W=1024,H=256,[c,g]=canvas(W,H),rnd=seeded(4242);
  g.fillStyle='#ececec';g.fillRect(0,0,W,H);
  g.fillStyle='#a8a8a8';[[.16,.28],[.72,.84]].forEach(([a,b])=>g.fillRect(0,H*a,W,H*(b-a)));
  g.lineCap='round';g.lineJoin='round';
  for(let y=0;y<H;y+=10)for(let x=((y/10)&1)*6;x<W;x+=12){
    g.strokeStyle=`rgba(0,0,0,${.2+rnd()*.08})`;g.lineWidth=2.4;g.beginPath();g.moveTo(x,y);g.lineTo(x+6,y+8);g.lineTo(x+12,y);g.stroke();
    g.strokeStyle='rgba(255,255,255,.28)';g.lineWidth=1.1;g.beginPath();g.moveTo(x,y-1);g.lineTo(x+6,y+7);g.lineTo(x+12,y-1);g.stroke()}
  return TX.knit=finish(c,2,1);
}
const TEXF={normal:leatherTex,furry:furTex,scarf:knitTex},BUMP={normal:2.4,furry:1.8,scarf:2.0};
const strapMat=(type,color,dark)=>{const t=(TEXF[type]||leatherTex)();
  return new T.MeshStandardMaterial({color:new T.Color(color).lerp(new T.Color('#120c1c'),dark),map:t,bumpMap:t,bumpScale:BUMP[type]||2.4,roughness:type==='normal'?.96:1,metalness:0,side:T.DoubleSide})};
const hex=(a,b,t)=>'#'+new T.Color(a).lerp(new T.Color(b),t).getHexString();

// ---------- trim that follows the cloth ----------
const GOLD=new T.MeshStandardMaterial({color:'#e8b83a',roughness:.35,metalness:.85});
const GOLD_D=new T.MeshStandardMaterial({color:'#b8892a',roughness:.45,metalness:.8});
const HOLE=new T.MeshBasicMaterial({color:'#120a05'});
const PUFF=new T.IcosahedronGeometry(1,1);
const CM=(COLLAR_COLS-1)/2;
function buildTrim(type,color){
  const items=[],grp=new T.Group();
  const add=(obj,c,kind,extra)=>{grp.add(obj);items.push(Object.assign({obj,c,kind},extra))};
  if(type==='furry'){                                    // fluffy puffs on every row, slightly randomised
    const rnd=seeded(99),ml=new T.MeshStandardMaterial({color:hex(color,'#ffffff',.18),roughness:1}),md=new T.MeshStandardMaterial({color:hex(color,'#000000',.1),roughness:1});
    for(let r=0;r<COLLAR_ROWS;r++)for(let c=0;c<COLLAR_COLS;c++){
      const m=new T.Mesh(PUFF,rnd()<.55?ml:md),s=(r===0||r===COLLAR_ROWS-1?.1:.085)*(.8+rnd()*.5);m.scale.set(s,s*.85,s);
      add(m,c,'puff',{r,j:new T.Vector3((rnd()-.5)*.03,(rnd()-.5)*.03,(rnd()-.5)*.03)})}
    return {grp,items};
  }
  if(type==='scarf')return {grp,items};
  const box=(w,h,d,m,x,y,z,par)=>{const b=new T.Mesh(new T.BoxGeometry(w,h,d),m);b.position.set(x,y,z);par.add(b)};
  // buckle (centre front)
  const bk=new T.Group(),W=.26,Hh=.2,f=.04;
  box(W,Hh,.016,GOLD_D,0,0,0,bk);box(W,f,.03,GOLD,0,Hh/2-f/2,.012,bk);box(W,f,.03,GOLD,0,-Hh/2+f/2,.012,bk);
  box(f,Hh,.03,GOLD,-W/2+f/2,0,.012,bk);box(f,Hh,.03,GOLD,W/2-f/2,0,.012,bk);box(.032,Hh-.05,.03,GOLD,0,0,.014,bk);
  const pr=new T.Mesh(new T.SphereGeometry(1,10,8),GOLD);pr.scale.set(.026,.026,.02);pr.position.set(.07,0,.03);bk.add(pr);
  add(bk,CM,'buckle');
  // belt holes: row to the left of the buckle
  [7,8,9,10].forEach(c=>{const h=new T.Group(),ring=new T.Mesh(new T.TorusGeometry(.03,.009,6,14),GOLD_D),dot=new T.Mesh(new T.CircleGeometry(.03,14),HOLE);dot.position.z=.002;h.add(ring,dot);add(h,c,'hole')});
  // studs
  [CM+3,CM+6,CM+9,CM-6,CM-9].forEach(c=>{const s=new T.Mesh(new T.SphereGeometry(1,10,8),GOLD);s.scale.set(.032,.032,.02);add(s,c,'stud')});
  return {grp,items};
}
// place the trim from a position lookup P(col,row) -> Vector3 (cat-local)
const _a=new T.Vector3(),_b=new T.Vector3(),_n=new T.Vector3(),_d=new T.Vector3();
function placeTrim(items,P){
  for(const it of items){
    if(it.kind==='puff'){const p=P(it.c,it.r);_n.set(p.x,0,p.z).normalize();it.obj.position.copy(p).addScaledVector(_n,.025).add(it.j);continue}
    const top=P(it.c,0),bot=P(it.c,COLLAR_ROWS-1),mid=_a.copy(top).add(bot).multiplyScalar(.5);
    _n.set(mid.x,0,mid.z).normalize();                                   // outward = radial from the neck axis
    _d.copy(bot).sub(top);const tilt=-Math.atan2(_d.dot(_n),-_d.y);        // strap tilt (bottom swinging out/in)
    it.obj.position.copy(mid).addScaledVector(_n,it.kind==='buckle'?.018:.008);
    it.obj.rotation.set(tilt,Math.atan2(_n.x,_n.z),0,'YXZ');
  }
}

function setUV(geo){
  const uv=new Float32Array(COLLAR_COLS*COLLAR_ROWS*2);
  for(let r=0;r<COLLAR_ROWS;r++)for(let c=0;c<COLLAR_COLS;c++){const i=(r*COLLAR_COLS+c)*2;uv[i]=c/(COLLAR_COLS-1);uv[i+1]=1-r/(COLLAR_ROWS-1)}
  geo.setAttribute('uv',new T.BufferAttribute(uv,2));
}

// ---------- scarf tail: a short cloth that hangs from the front-left of the wrap ----------
const TAIL_C=4,TAIL_R=6;
function tailRest(){
  const out=[];
  for(let r=0;r<TAIL_R;r++)for(let c=0;c<TAIL_C;c++){
    const x=-(.18+c*.1),zc=Math.cos(Math.asin(Math.min(.95,Math.abs(x)/.77)))*.51;
    out.push(new T.Vector3(x,-.80-r*.16,zc+.02+r*.02));
  }
  return out;
}
const tailColor=color=>(r,c)=>r===TAIL_R-1?hex(color,'#ffffff',.55):(r===1||r===4)?hex(color,'#000000',.3):hex(color,'#ffffff',.08);

// ---- live collar (cloth physics). colls: {outer:[...], inner:[...]} collider lists (see catAvatar) ----
export function createBelt(cat,color,colls,type='normal',P0={grav:10,stiff:.03,iter:3}){
  if(type&&typeof type==='object'){P0=type;type='normal'}
  if(!TY[type])type='normal';
  const C=COLLAR_COLS,R=COLLAR_ROWS;
  const outer=new Cloth(cat,collarRest(0,type),C,R,{...P0,coll:colls.outer,color:()=>'#ffffff'});
  const inner=new Cloth(cat,collarRest(.06,type),C,R,{...P0,coll:colls.inner,color:()=>'#ffffff'});
  setUV(outer.geo);setUV(inner.geo);outer.mesh.material=strapMat(type,color,0);inner.mesh.material=strapMat(type,color,.5);
  const trim=buildTrim(type,color);cat.add(trim.grp);const P=(c,r)=>outer.lp[r*C+Math.max(0,Math.min(C-1,Math.round(c)))];
  placeTrim(trim.items,P);
  let tail=null;
  if(type==='scarf'){
    tail=new Cloth(cat,tailRest(),TAIL_C,TAIL_R,{grav:12,stiff:.02,iter:3,coll:colls.outer,color:tailColor(color),pin:i=>i<TAIL_C});
    if(tail.mesh&&tail.mesh.material)tail.mesh.material.side=T.DoubleSide;
  }
  const bot=new T.Vector3();
  return {type,
    step(dt){outer.step(dt);inner.step(dt);if(tail)tail.step(dt);placeTrim(trim.items,P)},
    // bottom-centre of the collar, pushed a hair outwards: where the name plate hangs from
    anchor(v){bot.copy(P(CM,R-1));_n.set(bot.x,0,bot.z).normalize();return v.copy(bot).addScaledVector(_n,.04)}};
}

// ---- static collar for the maker icon (same shape, no physics) ----
export function buildCollarStatic(color,type='normal'){
  if(!TY[type])type='normal';
  const g=new T.Group(),C=COLLAR_COLS,R=COLLAR_ROWS;
  [[0,0],[.06,.5]].forEach(([inset,dark])=>{
    const rest=collarRest(inset,type),pos=[],idx=[];rest.forEach(v=>pos.push(v.x,v.y,v.z));
    for(let r=0;r<R-1;r++)for(let c=0;c<C-1;c++){const a=r*C+c,b=a+1,d=a+C,e=d+1;idx.push(a,d,b,b,d,e)}
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setIndex(idx);setUV(geo);geo.computeVertexNormals();
    g.add(new T.Mesh(geo,strapMat(type,color,dark)))});
  const trim=buildTrim(type,color),rest=collarRest(0,type);g.add(trim.grp);placeTrim(trim.items,(c,r)=>rest[r*C+Math.max(0,Math.min(C-1,Math.round(c)))]);
  if(type==='scarf'){
    const tr=tailRest(),tc=tailColor(color),pos=[],col=[],idx=[],cc=new T.Color();
    tr.forEach((v,i)=>{pos.push(v.x,v.y,v.z);cc.set(tc(Math.floor(i/TAIL_C),i%TAIL_C));col.push(cc.r,cc.g,cc.b)});
    for(let r=0;r<TAIL_R-1;r++)for(let c=0;c<TAIL_C-1;c++){const a=r*TAIL_C+c,b=a+1,d=a+TAIL_C,e=d+1;idx.push(a,d,b,b,d,e)}
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('color',new T.Float32BufferAttribute(col,3));geo.setIndex(idx);geo.computeVertexNormals();
    g.add(new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:1})));
  }
  return g;
}
export const buildBelt=buildCollarStatic;