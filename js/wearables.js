// Ear types, headwear, eyewear and a static cloak model (used for icons).
// Everything is built in head-local space (same space the head group uses).
import * as T from 'three';
import {G,LUMP2,M,mat} from './blocks.js';
import {createHood} from './hood.js';
import {buildFluffyEar} from './catFeatures.js';

export const EARS=['pointy','round','folded','tall','lop','bunny','bat','bear','tufted','fluffy'];
export const EAR_NAMES={pointy:'Pointy',round:'Round',folded:'Folded',tall:'Tall',lop:'Lop',bunny:'Bunny',bat:'Bat',bear:'Bear',tufted:'Tufted',fluffy:'Fluffy'};
export const HEADS=[['none','None'],['hood','Hood'],['helmet','Helmet'],['beanie','Beanie'],['crown','Crown'],['wizard','Wizard']];
export const EYEWEAR=[['none','None'],['glasses','Glasses'],['shades','Shades'],['goggles','Goggles']];
export const GEAR_COLS=['#9aa3b5','#e63946','#4aa8ff','#58c878','#ffd54a','#2a2433','#ff6fa0','#b07aff','#ff7a3c','#ffffff','#7ee6d2','#8a5a3a'];

const std=(c,r=.7,m=0)=>new T.MeshStandardMaterial({color:c,roughness:r,metalness:m});
const tint=(hex,to,t)=>'#'+new T.Color(hex).lerp(new T.Color(to),t).getHexString();
const mesh=(geo,m,p=[0,0,0],s=[1,1,1],par)=>{const x=new T.Mesh(geo,m);x.position.set(...p);x.scale.set(...s);if(par)par.add(x);return x};
const bar=(a,b,r,m,par)=>{const A=new T.Vector3(...a),B=new T.Vector3(...b),d=B.clone().sub(A),L=d.length();
  const x=new T.Mesh(new T.CylinderGeometry(r,r,L,8),m);x.position.copy(A).add(B).multiplyScalar(.5);
  x.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());par.add(x);return x};

// teardrop / leaf shape with its base at the origin, pointing up +Y
function leafGeo(w,h,th,pt=.8){
  const g=new T.SphereGeometry(1,24,18),p=g.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),t=(y+1)/2,f=Math.pow(Math.max(0,1-t*.985),pt);
    p.setXYZ(i,x*w*f,t*h,z*th*(.4+.6*f));
  }
  g.computeVertexNormals();return g;
}

// Builds one ear into `sw` (the sway group). Returns the physics params:
// k = spring stiffness, fl = floppiness, out = extra outward tilt, bx = extra forward tilt
export function buildEar(type,sw,em,pink){
  const add=(geo,m,s,p,r)=>{const x=M(geo,m,s,p,sw);if(r)x.rotation.set(...r);return x};
  let k=120,fl=1,out=0,bx=0,ropes=[],mods=[];
  switch(type){
    case 'round':
      add(LUMP2,em,[.34,.36,.14],[0,.2,0]);add(LUMP2,pink,[.22,.24,.08],[0,.18,.07]);k=170;fl=.8;break;
    case 'folded':
      add(G.cone,em,[.36,.57,.18],[0,.22,.07],[.9,0,0]);add(G.cone,pink,[.23,.4,.1],[0,.2,.17],[.9,0,0]);k=70;fl=1.4;break;
    case 'tall':
      add(G.cone,em,[.26,.95,.15],[0,.42,0]);add(G.cone,pink,[.16,.65,.09],[0,.34,.06]);k=105;fl=1.2;break;
    case 'fluffy':   // long ear resting against the side of the head + physics fur fringe (built in head space, see catFeatures.js)
      {const f=buildFluffyEar(sw,em,pink);ropes=f.ropes;mods=f.mods}k=200;fl=.6;out=0;bx=0;break;
    case 'lop':
      add(leafGeo(.27,.78,.12,.7),em,[1,1,1],[0,-.02,0]);add(leafGeo(.16,.58,.07,.7),pink,[1,1,1],[0,.02,.06]);
      k=38;fl=2.1;out=1.3;bx=.2;break;
    case 'bunny':
      add(leafGeo(.2,1.05,.1,.6),em,[1,1,1],[0,-.02,0]);add(leafGeo(.12,.84,.06,.6),pink,[1,1,1],[0,.03,.05]);
      k=52;fl=1.5;out=-.1;break;
    case 'bat':
      add(leafGeo(.46,.92,.1,.95),em,[1,1,1],[0,-.02,0]);add(leafGeo(.3,.72,.07,.95),pink,[1,1,1],[0,.02,.05]);
      k=95;fl=1;out=-.3;break;
    case 'bear':
      add(new T.SphereGeometry(1,20,14),em,[.3,.3,.12],[0,.1,0]);add(new T.SphereGeometry(1,20,14),pink,[.19,.19,.08],[0,.09,.07]);
      k=240;fl=.5;out=-.15;break;
    case 'tufted':{
      add(G.cone,em,[.36,.64,.18],[0,.25,0]);add(G.cone,pink,[.23,.46,.1],[0,.2,.07]);
      const dk=mat('#2a1a14');
      [-1,0,1].forEach(i=>add(G.cone,dk,[.045,.3,.045],[i*.05,.64,0],[0,0,-i*.3]));
      k=130;fl=1;break;}
    default:
      add(G.cone,em,[.36,.64,.18],[0,.25,0]);add(G.cone,pink,[.23,.46,.1],[0,.2,.07]);
  }
  return {k,fl,out,bx,ropes,mods};
}

// ---------------------------------------------------------------- headwear
export function buildHeadwear(kind,col='#9aa3b5'){
  if(!kind||kind==='none')return null;
  const grp=new T.Group(),body=std(col,.75),dark=std(tint(col,'#000000',.35),.9),light=std(tint(col,'#ffffff',.3),.7);
  if(kind==='hood'){createHood(grp,{outer:col,inner:tint(col,'#000000',.55),trimC:tint(col,'#ffffff',.55),seamC:tint(col,'#ffffff',.3)}).refresh();grp.position.y=-.05}
  else if(kind==='helmet'){
    mesh(new T.SphereGeometry(1,40,24,0,Math.PI*2,0,1.62),body,[0,.06,0],[1.06,.92,.98],grp);
    const band=mesh(new T.TorusGeometry(1,.07,10,48),light,[0,.015,0],[1.06,.98,1],grp);band.rotation.x=Math.PI/2;
    mesh(new T.BoxGeometry(.12,.5,.08),light,[0,-.14,.98],[1,1,1],grp);                     // nasal guard
    [-1,1].forEach(s=>mesh(new T.BoxGeometry(.1,.42,.46),dark,[s*1.0,-.12,.08],[1,1,1],grp)); // cheek flaps
    mesh(new T.BoxGeometry(.08,.12,1.3),dark,[0,.99,0],[1,1,1],grp);                         // crest
    for(let i=0;i<7;i++){const a=-1.2+i*.4;mesh(new T.SphereGeometry(.04,8,6),std('#ffd54a',.4,.2),[Math.sin(a)*1.07,.015,Math.cos(a)*.99],[1,1,1],grp)}
  }
  else if(kind==='beanie'){
    mesh(new T.SphereGeometry(1,40,24,0,Math.PI*2,0,1.7),body,[0,.05,0],[1.04,.88,.96],grp);
    const br=mesh(new T.TorusGeometry(1,.12,12,48),light,[0,.0,0],[1.05,.97,1],grp);br.rotation.x=Math.PI/2;
    mesh(new T.SphereGeometry(.2,16,12),light,[0,1.0,0],[1,1,1],grp);
  }
  else if(kind==='crown'){
    const gold=std(col,.35,.25),r=.43;
    const ring=mesh(new T.CylinderGeometry(r,r+.04,.22,28,1,true),gold,[0,0,0],[1,1,1],grp);ring.material.side=T.DoubleSide;
    for(let i=0;i<5;i++){const a=i/5*Math.PI*2;
      mesh(new T.ConeGeometry(.09,.26,10),gold,[Math.sin(a)*r,.2,Math.cos(a)*r],[1,1,1],grp);
      mesh(new T.SphereGeometry(.045,10,8),std(i%2?'#4aa8ff':'#ff4d6d',.2),[Math.sin(a)*r,.35,Math.cos(a)*r],[1,1,1],grp)}
    mesh(new T.TorusGeometry(r+.02,.025,8,28),std(tint(col,'#ffffff',.35),.3,.25),[0,-.1,0],[1,1,1],grp).rotation.x=Math.PI/2;
    grp.position.set(0,.74,0);grp.rotation.x=-.08;
  }
  else if(kind==='wizard'){
    const brim=mesh(new T.CylinderGeometry(.95,.95,.05,32),body,[0,.0,0],[1,1,1],grp);
    mesh(new T.CylinderGeometry(.5,.5,.1,24),dark,[0,.08,0],[1,1,1],grp);
    mesh(new T.ConeGeometry(.5,.8,24),body,[0,.45,0],[1,1,1],grp);
    const tip=mesh(new T.ConeGeometry(.26,.6,18),body,[.08,1.0,0],[1,1,1],grp);tip.rotation.z=-.4;
    mesh(new T.TorusGeometry(.5,.045,8,28),light,[0,.12,0],[1,1,1],grp).rotation.x=Math.PI/2;
    mesh(new T.SphereGeometry(.06,10,8),std('#ffd54a',.3,.2),[.25,1.3,0],[1,1,1],grp);
    brim.rotation.z=0;grp.position.set(0,.72,0);grp.rotation.x=-.12;
  }
  return grp;
}

// ---------------------------------------------------------------- eyewear
export function buildEyewear(kind,col='#9aa3b5'){
  if(!kind||kind==='none')return null;
  const grp=new T.Group(),fm=std(col,.45,.1);
  const EZ=.845,EY=-.02,EX=.42,RY=.25;
  const lensAt=(fn)=>[-1,1].forEach(s=>{const g=new T.Group();g.position.set(s*EX,EY,EZ);g.rotation.y=s*RY;grp.add(g);fn(g,s)});
  if(kind==='glasses'){
    const lens=new T.MeshStandardMaterial({color:'#bfe9ff',transparent:true,opacity:.3,roughness:.1,side:T.DoubleSide});
    lensAt(g=>{mesh(new T.TorusGeometry(.215,.026,10,32),fm,[0,0,0],[1,1.05,1],g);mesh(new T.CircleGeometry(.205,28),lens,[0,0,.002],[1,1.05,1],g)});
    bar([-.21,.03,.885],[.21,.03,.885],.02,fm,grp);
    [-1,1].forEach(s=>bar([s*.63,.02,.775],[s*.97,.03,.05],.018,fm,grp));
  }
  else if(kind==='shades'){
    const lens=std('#14141f',.15,.1);
    lensAt(g=>{mesh(new T.SphereGeometry(1,22,14),lens,[0,0,0],[.255,.2,.04],g);
      mesh(new T.TorusGeometry(.225,.04,10,32),fm,[0,0,0],[1.1,.9,1],g);
      mesh(new T.SphereGeometry(1,8,6),std('#ffffff',.2),[-.08,.07,.035],[.05,.02,.01],g)});
    bar([-.22,.04,.885],[.22,.04,.885],.03,fm,grp);
    [-1,1].forEach(s=>bar([s*.66,.03,.77],[s*.97,.03,.05],.028,fm,grp));
  }
  else if(kind==='goggles'){
    const lens=new T.MeshStandardMaterial({color:'#ffb347',transparent:true,opacity:.6,roughness:.15});
    lensAt(g=>{mesh(new T.TorusGeometry(.245,.065,12,32),fm,[0,0,0],[1,1,1],g);mesh(new T.SphereGeometry(1,22,14),lens,[0,0,-.01],[.235,.235,.05],g)});
    bar([-.2,.0,.88],[.2,.0,.88],.04,fm,grp);
    const strap=mesh(new T.TorusGeometry(1,.07,8,56),std(tint(col,'#000000',.25),.8),[0,EY,0],[1.03,.88,1],grp);strap.rotation.x=Math.PI/2;
  }
  return grp;
}

// ---------------------------------------------------------------- cloak
// The cloak starts at the BOTTOM EDGE of the collar's back band (tucked a hair under the hem) and flares out below it,
// so the collar's back is the top of the cloak and the two never occupy the same space. Clean, even hem (no torn shapes).
// Types: short, long, royal (wide cape with a gold + ermine hem), leaves (overlapping leaf meshes riding on the cloth).
const SHAPES={
  short:{cols:11,rows:6,Hh:.85,arc:.98,fl:.6},
  long:{cols:11,rows:9,Hh:1.5,arc:.98,fl:.6},
  royal:{cols:13,rows:10,Hh:1.8,arc:1.1,fl:.85},
  leaves:{cols:11,rows:7,Hh:1.05,arc:.98,fl:.55},
  tattered:{cols:11,rows:7,Hh:1.1,arc:.98,fl:.6,lf:[1,.78,.95,.58,.9,.7,1,.62,.92,.74,1]}   // torn hem: uneven length per column (no extra meshes)
};
export const kindOf=k=>k===true?'long':(!k||k===false)?'short':(SHAPES[k]?k:'short');   // also accepts the old boolean (long?)
export const cloakShape=k=>{const s=SHAPES[kindOf(k)];return {cols:s.cols,rows:s.rows,Hh:s.Hh}};
const sstep=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)};
export const CLOAK_TOP=-.84;                                             // y of the collar hem at the back
export function cloakRest(kind,inset=0,dz=0){
  const {cols,rows,Hh,arc,fl,lf}=SHAPES[kindOf(kind)],out=[];
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    const a=(c/(cols-1)-.5)*Math.PI*arc,k=r/(rows-1),rad=.56-inset+fl*sstep(.1,1,k),w=sstep(0,.4,k),ex=.73-inset*.5,ez=.48-inset*.5;
    out.push(new T.Vector3(Math.sin(a)*(ex+(rad-ex)*w),CLOAK_TOP-k*(Hh-.28)*(lf?lf[c]:1),-Math.cos(a)*(ez+(rad*.88-ez)*w)-k*.05+dz));   // top row = the collar's back hem ellipse
  }
  return out;
}
const cmix=(a,b,t)=>'#'+new T.Color(a).lerp(new T.Color(b),t).getHexString();
export function cloakColor(kind,base,r,c,rows){      // outer colour of cloth vertex (r,c)
  kind=kindOf(kind);
  if(kind==='tattered'){                                                            // worn gradient, scuffed hem, a patch and two tears
    let col=cmix(base,'#1a1430',.14*r/rows);
    if(r>=rows-2)col=cmix(col,'#2a1a10',.38);
    if(r>=2&&r<=3&&c>=3&&c<=4)col='#b79a6b';
    if(c===7&&r>=1&&r<rows-1)col=cmix(col,'#0b0612',.82);
    if(c===2&&r===rows-3)col=cmix(col,'#0b0612',.7);
    if(r===rows-1)col=cmix(col,'#e8dcc0',.4);
    return col;
  }
  if(kind==='royal'){
    if(r>=rows-2)return (r===rows-2&&c%2===1)?'#1c1a1f':'#f6f1e4';                 // ermine hem with dark tails
    if(r===rows-3)return '#e0b13a';                                                // gold edge above it
    return cmix(base,'#1a1430',.1*r/rows);
  }
  if(kind==='leaves')return cmix(base,'#0c1208',.5+.1*r/rows);                      // dark base so the leaves stand out
  return cmix(base,'#1a1430',.14*r/rows);
}
export function cloakLining(kind,base,r,rows){       // inner lining colour
  kind=kindOf(kind);
  if(kind==='tattered')return r===rows-1?'#d9cdb0':cmix('#120c1c',base,.22+.1*r/rows);
  if(kind==='royal')return cmix('#fff2d2',base,.2+.1*r/rows);                       // pale silk lining
  if(kind==='leaves')return cmix('#0c1208',base,.25);
  return cmix('#120c1c',base,.22+.1*r/rows);
}

// leaves: overlapping leaf meshes riding on the cloak cloth. P(col,row) -> Vector3 (cat-local)
const _lx=new T.Vector3(),_ly=new T.Vector3(),_lz=new T.Vector3(),_ld=new T.Vector3(),_lt=new T.Vector3(),_la=new T.Vector3(),_lb=new T.Vector3(),_lc=new T.Vector3(),_lm=new T.Matrix4();
const leafAt=(P,cols,c,r,out)=>{const cc=Math.max(0,Math.min(cols-1,c)),i=Math.floor(cc),j=Math.min(cols-1,i+1);return out.lerpVectors(P(i,r),P(j,r),cc-i)};
export function buildLeaves(parent,cols,rows,base){
  const geo=leafGeo(.13,.36,.035,.8),items=[],g=new T.Group();parent.add(g);
  const mats=[cmix(base,'#ffffff',.18),base,cmix(base,'#000000',.22)].map(c=>new T.MeshStandardMaterial({color:c,roughness:.8,side:T.DoubleSide}));
  let sd=31;const rnd=()=>(sd=(sd*16807)%2147483647)/2147483647;
  for(let r=1;r<rows;r++)for(let k=0;k<cols-(r&1);k++){
    const m=new T.Mesh(geo,mats[(rnd()*3)|0]);m.scale.setScalar(.85+.3*rnd()+.04*r);m.frustumCulled=false;g.add(m);
    items.push({m,c:k+(r&1)*.5,r,tw:(rnd()-.5)*.3})}
  const place=P=>{
    for(const it of items){
      const a=leafAt(P,cols,it.c,it.r,_la);
      if(it.r<rows-1)_ld.copy(leafAt(P,cols,it.c,it.r+1,_lb)).sub(a);
      else _ld.copy(a).sub(leafAt(P,cols,it.c,it.r-1,_lb));                         // last row: continue the previous direction
      _ld.normalize();
      _lt.copy(leafAt(P,cols,it.c+1,it.r,_lb)).sub(leafAt(P,cols,it.c-1,it.r,_lc));
      _lz.crossVectors(_lt,_ld).normalize();                                          // outward (towards the back of the cat)
      _ly.copy(_ld).addScaledVector(_lz,.35).normalize();                             // leaves tilt outward so they overlap like scales
      _lz.addScaledVector(_ly,-_lz.dot(_ly)).normalize();
      _lx.crossVectors(_ly,_lz);
      _lm.makeBasis(_lx,_ly,_lz);it.m.quaternion.setFromRotationMatrix(_lm);
      it.m.rotateY(it.tw);
      it.m.position.copy(a).addScaledVector(_lz,.02+.004*it.r);
    }};
  return {group:g,place};
}

// static cloak (used for icons)
export function buildCloakStatic(kind,col='#6d4cff'){
  const g=new T.Group();if(kind==='none')return g;
  kind=kindOf(kind);const {cols,rows}=cloakShape(kind),rest=cloakRest(kind);
  const pos=[],idx=[],col3=[],cc=new T.Color();
  rest.forEach((v,i)=>{const r=Math.floor(i/cols),c=i%cols;pos.push(v.x,v.y,v.z);cc.set(cloakColor(kind,col,r,c,rows));col3.push(cc.r,cc.g,cc.b)});
  for(let r=0;r<rows-1;r++)for(let c=0;c<cols-1;c++){const a=r*cols+c,b=a+1,d=a+cols,e=d+1;idx.push(a,d,b,b,d,e)}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));
  geo.setAttribute('color',new T.Float32BufferAttribute(col3,3));geo.setIndex(idx);geo.computeVertexNormals();
  g.add(new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.9})));
  if(kind==='leaves')buildLeaves(g,cols,rows,col).place((c,r)=>rest[r*cols+c]);
  return g;
}