// Leather belt collar WITH CLOTH PHYSICS: a wide strap that sits right under the chin (as in the reference), two Cloth layers
// (outer + lining) so it has thickness and the exact same physics as the cloak. Row 0 is the pinned TOP rim, the strap hangs from it.
// The rough leather (grain colour + bump, stitches) is a canvas texture on the cloth mesh; the buckle, belt holes and studs are
// small meshes that follow the cloth every frame, so everything moves together.
import * as T from 'three';
import {Cloth} from './physics.js';

export const COLLAR_COLS=25,COLLAR_ROWS=4;
const GAP=-.3;                        // negative = the two ends overlap at the back, so there is no cut-out
const TOP=-.69;                       // y of the top rim: right under the head
const HEIGHT=.30;                     // strap height

// rest shape: wide ellipse (shoulder width x, chest depth z), slightly flared at the hem. inset shrinks a layer (lining)
export function collarRest(inset=0){
  const out=[];
  for(let r=0;r<COLLAR_ROWS;r++){
    const k=r/(COLLAR_ROWS-1);
    for(let c=0;c<COLLAR_COLS;c++){
      const a=(c/(COLLAR_COLS-1)-.5)*(Math.PI*2-2*GAP),sp=.03*(c/(COLLAR_COLS-1)),fold=.01*Math.sin(a*7)*k;
      const rx=.72+.05*k+fold-inset+sp,rz=.47+.03*k+fold-inset+sp;
      out.push(new T.Vector3(Math.sin(a)*rx,TOP-HEIGHT*k,Math.cos(a)*rz));
    }
  }
  return out;
}

// ---------- procedural leather texture (shared, created once) ----------
let TEX=null;
function leatherTex(){
  if(TEX)return TEX;
  const W=2048,H=256,c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');
  let s=1234567;const rnd=()=>(s=(s*1664525+1013904223)>>>0)/4294967296;
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
  const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(1.6,1);t.anisotropy=4;t.needsUpdate=true;
  return TEX=t;
}
const leather=(color,dark)=>{const m=new T.MeshStandardMaterial({color:new T.Color(color).lerp(new T.Color('#120c1c'),dark),map:leatherTex(),bumpMap:leatherTex(),bumpScale:2.4,roughness:.96,metalness:0,side:T.DoubleSide});return m};

// ---------- trim that follows the cloth: buckle, belt holes, studs ----------
const GOLD=new T.MeshStandardMaterial({color:'#e8b83a',roughness:.35,metalness:.85});
const GOLD_D=new T.MeshStandardMaterial({color:'#b8892a',roughness:.45,metalness:.8});
const HOLE=new T.MeshBasicMaterial({color:'#120a05'});
const CM=(COLLAR_COLS-1)/2;
function buildTrim(){
  const items=[],grp=new T.Group();
  const add=(obj,c,kind)=>{grp.add(obj);items.push({obj,c,kind})};
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
    const top=P(it.c,0),bot=P(it.c,COLLAR_ROWS-1),mid=_a.copy(top).add(bot).multiplyScalar(.5);
    _n.set(mid.x,0,mid.z).normalize();                                   // outward = radial from the neck axis
    _d.copy(bot).sub(top);const tilt=-Math.atan2(_d.dot(_n),-_d.y);        // strap tilt (bottom swinging out/in)
    it.obj.position.copy(mid).addScaledVector(_n,it.kind==='buckle'?.018:.008);
    it.obj.rotation.set(tilt,Math.atan2(_n.x,_n.z),0,'YXZ');
  }
}

// outer layer shows the stitches; the lining (inside) is darker
function setUV(geo){
  const uv=new Float32Array(COLLAR_COLS*COLLAR_ROWS*2);
  for(let r=0;r<COLLAR_ROWS;r++)for(let c=0;c<COLLAR_COLS;c++){const i=(r*COLLAR_COLS+c)*2;uv[i]=c/(COLLAR_COLS-1);uv[i+1]=1-r/(COLLAR_ROWS-1)}
  geo.setAttribute('uv',new T.BufferAttribute(uv,2));
}

// ---- live belt (cloth physics). colls: {outer:[...], inner:[...]} collider lists (see catAvatar) ----
export function createBelt(cat,color,colls,P0={grav:10,stiff:.03,iter:3}){
  const C=COLLAR_COLS,R=COLLAR_ROWS;
  const outer=new Cloth(cat,collarRest(0),C,R,{...P0,coll:colls.outer,color:()=>'#ffffff'});
  const inner=new Cloth(cat,collarRest(.06),C,R,{...P0,coll:colls.inner,color:()=>'#ffffff'});
  setUV(outer.geo);setUV(inner.geo);outer.mesh.material=leather(color,0);inner.mesh.material=leather(color,.5);
  const trim=buildTrim();cat.add(trim.grp);const P=(c,r)=>outer.lp[r*C+Math.max(0,Math.min(C-1,Math.round(c)))];
  placeTrim(trim.items,P);
  return {step(dt){outer.step(dt);inner.step(dt);placeTrim(trim.items,P)}};
}

// ---- static belt for the maker icon (same shape, no physics) ----
export function buildCollarStatic(color){
  const g=new T.Group(),C=COLLAR_COLS,R=COLLAR_ROWS;
  [[0,0],[.06,.5]].forEach(([inset,dark])=>{
    const rest=collarRest(inset),pos=[],idx=[];rest.forEach(v=>pos.push(v.x,v.y,v.z));
    for(let r=0;r<R-1;r++)for(let c=0;c<C-1;c++){const a=r*C+c,b=a+1,d=a+C,e=d+1;idx.push(a,d,b,b,d,e)}
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setIndex(idx);setUV(geo);geo.computeVertexNormals();
    g.add(new T.Mesh(geo,leather(color,dark)))});
  const trim=buildTrim(),rest=collarRest(0);g.add(trim.grp);placeTrim(trim.items,(c,r)=>rest[r*C+Math.max(0,Math.min(C-1,Math.round(c)))]);
  return g;
}
export const buildBelt=buildCollarStatic;