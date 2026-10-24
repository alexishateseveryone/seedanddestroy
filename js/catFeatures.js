// Face + tail options for the cat avatar: eye styles, noses, cheek fur and tails.
// Everything is built in head-local space (eyes, nose, cheeks) or tail-local space (tails), same as the rest of the avatar.
import * as T from 'three';
import {Rope,VM} from './physics.js';
import {LUMP2} from './blocks.js';
import {makeCoat} from './coatShader.js';

export const EYE_STYLES=[['classic','Classic'],['big','Glossy'],['beady','Beady'],['slit','Slit'],['sleepy','Sleepy'],['happy','Happy'],['sharp','Sharp'],['lashes','Lashes']];
export const NOSES=[['button','Button'],['pink','Pink'],['triangle','Triangle'],['heart','Heart'],['big','Big'],['dot','Dot'],['wide','Wide'],['dog','Dog']];
export const CHEEKS=[['none','None'],['fluff','Fluffy'],['ruff','Ruff'],['sideburns','Sideburns'],['blush','Blush'],['freckles','Freckles']];
export const TAILS=[['classic','Classic'],['fluffy','Fluffy'],['long','Long'],['spiky','Spiky'],['bob','Bobtail'],['curly','Curly'],['double','Double']];

const std=(c,r=.8,m=0)=>new T.MeshStandardMaterial({color:c,roughness:r,metalness:m});
const bas=c=>new T.MeshBasicMaterial({color:c});
const SPH=new T.SphereGeometry(1,20,14);
const Y=new T.Vector3(0,1,0),Z=new T.Vector3(0,0,1);
const ell=(par,m,s,p,rot)=>{const x=new T.Mesh(SPH,m);x.scale.set(...s);x.position.set(...p);if(rot)x.rotation.set(...rot);par.add(x);return x};

const spike=(w,h)=>new T.ConeGeometry(w,h,6).translate(0,h/2,0);

// ------------------------------------------------------------------ eyes
// Returns the two eye groups (the avatar scales them on Y to blink).
export function buildEyes(style,col,fur,head){
  const dk=bas('#150d0a'),wh=bas('#ffffff'),ir=bas(col),lid=std(fur,.9),liner=bas('#2a1a14');
  return [-1,1].map(s=>{
    const g=new T.Group();g.position.set(s*.42,-.02,.72);g.rotation.y=s*.25;head.add(g);
    switch(style){
      case 'big':      // large glossy anime eyes: dark rim, coloured iris, big + small highlight
        ell(g,dk,[.17,.21,.1],[0,0,0]);ell(g,ir,[.13,.165,.05],[0,-.01,.065]);ell(g,dk,[.08,.11,.03],[0,-.01,.09]);
        ell(g,wh,[.05,.06,.02],[.05,.075,.1]);ell(g,wh,[.025,.03,.012],[-.06,-.08,.1]);break;
      case 'beady':
        ell(g,dk,[.11,.11,.08],[0,0,0]);ell(g,wh,[.035,.035,.02],[.03,.04,.07]);break;
      case 'slit':     // cat-like vertical pupil
        ell(g,ir,[.15,.17,.07],[0,0,0]);ell(g,dk,[.03,.14,.03],[0,0,.06]);ell(g,wh,[.03,.04,.015],[.05,.07,.075]);break;
      case 'sleepy':   // half-closed lid in the fur colour
        ell(g,dk,[.15,.17,.09],[0,0,0]);ell(g,ir,[.1,.12,.05],[0,-.02,.06]);ell(g,dk,[.055,.08,.03],[0,-.02,.085]);ell(g,wh,[.03,.035,.015],[.04,.03,.095]);
        ell(g,lid,[.18,.11,.12],[0,.1,.02]);break;
      case 'happy':    // ^ ^ closed smiling eyes
        {const m=new T.Mesh(new T.TorusGeometry(.13,.03,8,18,Math.PI),dk);m.position.set(0,-.05,.06);g.add(m)}break;
      case 'sharp':    // angled lid = serious / mischievous look
        ell(g,dk,[.14,.17,.09],[0,-.02,0]);ell(g,ir,[.1,.12,.05],[0,-.03,.06]);ell(g,dk,[.05,.08,.03],[0,-.03,.085]);ell(g,wh,[.03,.035,.015],[.04,.03,.095]);
        ell(g,liner,[.2,.04,.09],[0,.12,.05],[0,0,s*.4]);break;
      case 'lashes':
        ell(g,dk,[.13,.17,.09],[0,0,0]);ell(g,ir,[.095,.12,.05],[0,-.01,.06]);ell(g,dk,[.05,.07,.03],[0,-.01,.085]);ell(g,wh,[.04,.045,.02],[.04,.06,.1]);
        for(let i=0;i<3;i++){const f=.5+i*.45,c=new T.Mesh(spike(.018,.12),liner);c.position.set(s*Math.sin(f)*.14,Math.cos(f)*.17,.06);c.rotation.z=-s*f;g.add(c)}break;
      default:         // classic (the original look)
        ell(g,dk,[.14,.18,.09],[0,0,0]);ell(g,wh,[.045,.055,.022],[.04,.06,.08]);ell(g,ir,[.028,.028,.015],[-.04,-.06,.085]);
    }
    return g;
  });
}

// ------------------------------------------------------------------ nose
export function buildNose(type,head){
  const g=new T.Group();g.position.set(0,-.14,.84);head.add(g);
  switch(type){
    case 'pink': ell(g,std('#ff8fa8',.5),[.1,.07,.07],[0,0,0]);break;
    case 'triangle':{const m=new T.Mesh(new T.CylinderGeometry(.09,.09,.1,3),std('#e0728c',.5));m.rotation.x=Math.PI/2;m.position.y=.01;g.add(m);break}
    case 'heart':{
      const s=new T.Shape();s.moveTo(0,-.7);s.bezierCurveTo(-.2,-.5,-.6,-.2,-.6,.15);s.bezierCurveTo(-.6,.5,-.1,.6,0,.25);
      s.bezierCurveTo(.1,.6,.6,.5,.6,.15);s.bezierCurveTo(.6,-.2,.2,-.5,0,-.7);
      const geo=new T.ExtrudeGeometry(s,{depth:.4,bevelEnabled:true,bevelThickness:.15,bevelSize:.08,bevelSegments:3,curveSegments:14});geo.translate(0,0,-.2);
      const m=new T.Mesh(geo,std('#ff5f8a',.45));m.scale.setScalar(.13);m.position.y=.01;g.add(m);break}
    case 'big': ell(g,std('#2a1a14',.4),[.17,.12,.1],[0,0,0]);ell(g,bas('#6b5a52'),[.04,.025,.02],[-.05,.05,.085]);break;
    case 'dot': ell(g,std('#150d0a',.4),[.05,.05,.045],[0,.01,0]);break;
    case 'dog':{     // big wet rounded-shield dog nose with angled nostrils, a centre groove and a shine
      const s=new T.Shape();s.moveTo(0,.38);s.bezierCurveTo(.3,.4,.62,.32,.62,.12);s.bezierCurveTo(.62,-.2,.25,-.45,0,-.45);
      s.bezierCurveTo(-.25,-.45,-.62,-.2,-.62,.12);s.bezierCurveTo(-.62,.32,-.3,.4,0,.38);
      const geo=new T.ExtrudeGeometry(s,{depth:.3,bevelEnabled:true,bevelThickness:.2,bevelSize:.1,bevelSegments:4,curveSegments:16});geo.translate(0,0,-.15);
      const m=new T.Mesh(geo,std('#1c1514',.18,.05));m.scale.setScalar(.2);g.add(m);
      const bk=bas('#000000');[-1,1].forEach(sd=>ell(g,bk,[.03,.055,.02],[sd*.075,-.005,.066],[0,0,sd*.5]));
      ell(g,bk,[.008,.06,.012],[0,-.065,.07]);ell(g,bas('#6f6a78'),[.045,.022,.01],[-.06,.075,.074],[0,0,.3]);break}
    case 'wide':{ell(g,std('#d9798f',.55),[.17,.1,.08],[0,0,0]);const n=bas('#4a1a24');[-1,1].forEach(s=>ell(g,n,[.03,.045,.02],[s*.06,-.005,.07]));break}
    default: ell(g,std('#3a2308',.7),[.12,.08,.08],[0,0,0]);
  }
  return g;
}

// ------------------------------------------------------------------ cheeks
// Fur locks: tapered, flattened blades (custom mesh) hanging from the cheek on rope physics. They are drawn with the HEAD's coat shader,
// so they pick up exactly the same colours / pattern as the face around them (no separate-coloured cones).
const HX=1,HY=.78,HZ=.85;                      // the head ellipsoid
const HR=[HX*1.03,HY*1.03,HZ*1.03];            // locks are kept outside this (so they never sink into the face)
function surf(az,el,s,out=0){                  // point + normal on the head surface (az: from front towards the side, el: up/down)
  const ce=Math.cos(el),x=s*Math.sin(az)*ce*HX,y=Math.sin(el)*HY,z=Math.cos(az)*ce*HZ;
  const n=new T.Vector3(x/(HX*HX),y/(HY*HY),z/(HZ*HZ)).normalize();
  return {p:new T.Vector3(x,y,z).addScaledVector(n,out),n};
}
const _lt=new T.Vector3(),_ln=new T.Vector3(),_lb=new T.Vector3(),_le=new T.Vector3();
class Lock extends Rope{                       // Rope physics, but the rings are flat ellipses whose width follows a leaf profile
  fit(){
    const n=this.n,nR=this.o.nR,P=this.lp,pos=this.geo.attributes.position.array,pf=this.o.prof;
    if(this.o.clamp)for(let i=2;i<=n;i++){const v=P[i];_le.set(v.x/HR[0],v.y/HR[1],v.z/HR[2]);const l=_le.length();if(l<1&&l>1e-4)v.set(_le.x/l*HR[0],_le.y/l*HR[1],_le.z/l*HR[2])}
    for(let i=0;i<=n;i++){
      _lt.subVectors(P[Math.min(i+1,n)],P[Math.max(i-1,0)]).normalize();
      _ln.copy(this.ref).addScaledVector(_lt,-this.ref.dot(_lt));if(_ln.lengthSq()<1e-6)_ln.set(1,0,0).addScaledVector(_lt,-_lt.x);_ln.normalize();_lb.crossVectors(_lt,_ln);
      const [w,th]=pf(i/n);
      for(let j=0;j<=nR;j++){const a=j/nR*6.2832,c=Math.cos(a)*w,s=Math.sin(a)*th,k=(i*(nR+1)+j)*3;
        pos[k]=P[i].x+_ln.x*c+_lb.x*s;pos[k+1]=P[i].y+_ln.y*c+_lb.y*s;pos[k+2]=P[i].z+_ln.z*c+_lb.z*s}}
    this.geo.attributes.position.needsUpdate=true;this.geo.computeVertexNormals();
  }
}
// o = {fur,pat,pattern} (the cat's coat). Returns {group, ropes, meshes, update}: push `ropes` into the avatar's rope list (they are stepped
// there) and add `meshes` to the list passed to bindCoat() so the shader pattern lines up with the head.
export function buildCheeks(type,o,head){
  if(!type||type==='none')return null;
  const grp=new T.Group();head.add(grp);const ropes=[],meshes=[];
  let sd=7;const rnd=()=>(sd=(sd*16807)%2147483647)/2147483647;
  const mat=makeCoat(o,0);mat.userData.u.uLS.value.set(HX,HY,HZ);mat.userData.u.uKeep.value=1;mat.side=T.DoubleSide;   // uKeep: fur is never drawn over the eyes / nose / mouth zone   // uLS: positions are head-local (already scaled)
  const down=new T.Vector3(0,-1,0),back=new T.Vector3(0,0,-1);
  const lock=(az,el,s,len,W)=>{
    const {p,n}=surf(az,el,s,-.05),pts=[],ref=new T.Vector3().crossVectors(n,down).normalize();
    for(let k=0;k<=5;k++){const t=k/5;pts.push(p.clone().addScaledVector(n,len*.5*(1-(1-t)*(1-t))).addScaledVector(down,len*.95*t).addScaledVector(back,len*.12*t))}
    const r=new Lock(head,pts,{radius:.05,nR:6,clamp:true,stiff:.16,soft:.3,damp:.88,grav:3,ref:[ref.x,ref.y,ref.z],
      prof:t=>{const w=W*Math.sqrt(Math.max(0,1-t))*(.6+.4*Math.min(1,t*4));return [w,Math.max(.008,w*.45)]}});
    r.mesh.material=mat;ropes.push(r);meshes.push(r.mesh)};
  const lay=(rows,azs,W)=>rows.forEach(([el,len])=>azs.forEach(az=>[-1,1].forEach(s=>lock(az+(rnd()-.5)*.1,el+(rnd()-.5)*.08,s,len*(.85+.3*rnd()),W*(.9+.2*rnd())))));
  if(type==='fluff')          lay([[-.2,.4],[-.45,.46],[-.68,.4]],[.98,1.18,1.38],.19);       // puffy mass of wide soft locks
  else if(type==='ruff')      lay([[-.28,.6],[-.6,.7]],[.9,1.08,1.26,1.42,1.52],.12);              // longer, pointier shaggy ruff
  else if(type==='sideburns') [[1.15,.85],[1.3,1.0],[1.42,.95],[1.5,.8]].forEach(([az,len])=>[-1,1].forEach(s=>lock(az,-.12,s,len*(.9+.2*rnd()),.1)));
  else if(type==='blush'){
    const m=new T.MeshBasicMaterial({color:'#ff7a9a',transparent:true,opacity:.5,depthWrite:false});
    [-1,1].forEach(s=>{const {p,n}=surf(.72,-.28,s,.02),d=new T.Mesh(new T.CircleGeometry(.15,20),m);d.scale.set(1,.65,1);d.position.copy(p);d.quaternion.setFromUnitVectors(Z,n);grp.add(d)});
  }else if(type==='freckles'){
    const m=bas('#8a5a3a');
    [-1,1].forEach(s=>[[.66,-.22],[.8,-.2],[.72,-.34]].forEach(([az,el])=>{const {p,n}=surf(az,el,s,.006),d=ell(grp,m,[.03,.03,.012],[0,0,0]);d.position.copy(p);d.quaternion.setFromUnitVectors(Z,n)}));
  }
  return {group:grp,ropes,meshes,update(){}};
}

// ------------------------------------------------------------------ tails
// Tail colour along its length (t = 0 root .. 1 tip), follows the coat pattern.
export const tailColor=o=>t=>{switch(o.pattern){
  case 'solid':return o.fur;
  case 'tabby':return ((t*13+.5)|0)%3===0?o.pat:o.fur;
  case 'tuxedo':return t>.82?o.pat:o.fur;
  case 'calico':return t<.35?o.fur:t<.7?o.pat:o.fur;
  case 'spots':return ((t*20)|0)%4===0?o.pat:o.fur;
  case 'points':return t>.25?o.pat:o.fur;
  case 'patches':return t>.3&&t<.65?o.pat:o.fur;
  case 'hearts':return t>.8?o.pat:o.fur;
  default:return ((t*13+.5)|0)%5<2?'#fff7ee':o.pat}};

const V3=a=>a.map(p=>new T.Vector3(...p));
const curve=(pts,n)=>new T.CatmullRomCurve3(V3(pts)).getPoints(n);
const CLASSIC=[[0,0,0],[0,.05,-.45],[0,.45,-.85],[0,1,-.9],[0,1.35,-.55]];
const CURL=(()=>{const p=[[0,0,0],[0,.05,-.45]];for(let i=0;i<=10;i++){const u=i/10,th=-.65*Math.PI-u*1.9*Math.PI,r=.5-.3*u;p.push([0,.85+r*Math.sin(th),-.55+r*Math.cos(th)])}return p})();
const seeded=s=>()=>(s=(s*16807)%2147483647)/2147483647;
const WHITE=new T.Color('#ffffff');

// A spine (the physics rope) with a stable frame (tangent, normal, binormal) per point and a sampler for fractional positions.
class Spine{
  constructor(rope,ref=[1,0,0],out=null){this.ref=new T.Vector3(...ref);this.out=out;this.r=rope;this.n=rope.n;this.seg=rope.total/rope.n;this.T=[];this.N=[];this.B=[];
    for(let i=0;i<=this.n;i++){this.T.push(new T.Vector3());this.N.push(new T.Vector3());this.B.push(new T.Vector3())}}
  frames(){const P=this.r.lp,n=this.n;
    for(let i=0;i<=n;i++){_t.subVectors(P[Math.min(i+1,n)],P[Math.max(i-1,0)]).normalize();
      _n.copy(this.ref).addScaledVector(_t,-this.ref.dot(_t));if(_n.lengthSq()<1e-6)_n.set(0,0,1).addScaledVector(_t,-_t.z);_n.normalize();_b.crossVectors(_t,_n);if(this.out&&_b.dot(this.out)<0)_b.negate();
      this.T[i].copy(_t);this.N[i].copy(_n);this.B[i].copy(_b)}}
  at(q,o){const n=this.n,P=this.r.lp;   // position q along the spine in point units (can run past the end: extrapolates along the last tangent)
    if(q>=n){o.p.copy(P[n]).addScaledVector(this.T[n],(q-n)*this.seg);o.t.copy(this.T[n]);o.n.copy(this.N[n]);o.b.copy(this.B[n])}
    else{const i=Math.max(0,Math.floor(q)),f=q-i;o.p.lerpVectors(P[i],P[i+1],f);o.t.lerpVectors(this.T[i],this.T[i+1],f).normalize();o.n.lerpVectors(this.N[i],this.N[i+1],f);o.b.lerpVectors(this.B[i],this.B[i+1],f)}}
}
const mkS=()=>({p:new T.Vector3(),t:new T.Vector3(),n:new T.Vector3(),b:new T.Vector3()});
const _S=mkS(),_p=new T.Vector3(),_r=new T.Vector3(),_w=new T.Vector3();

// SPIKY: a thick fox-style brush. Two layers of thin pointed strands (flat tapered blades) lie along a solid core, flare out a little and
// end in sharp tips; they converge into a pointed brush tip. One custom mesh, rebuilt every frame from the physics spine.
class Strands{
  constructor(frame,rope,col,R,op={}){      // R(s) -> radius, or [width,thickness] for a flat (ear-like) cross-section; op: {ref,out,M,arc:[a0,a1],over}
    this.sp=new Spine(rope,op.ref,op.out);this.R=R;const n=rope.n,rnd=seeded(11),S=this.S=[],K=this.K=5,M=op.M||12,arc=op.arc||[0,Math.PI*2],over=op.over??1.2;
    for(let lay=0;lay<2;lay++)for(let i=0;i<n;i++)for(let j=0;j<M;j++){          // lay 0 = short inner layer (fills the volume), lay 1 = long outer layer (spiky silhouette)
      const len=Math.min((lay?2.4:1.6)+rnd()*(lay?2:1.2),n+over-i);if(len<.9)continue;
      S.push({i,a:arc[0]+(arc[1]-arc[0])*((j+((i+lay)&1)*.5)/M+rnd()*.3/(M*.9)),len,w:(lay?.07:.09)+rnd()*.05,fat:(lay?1:.72)*(.92+rnd()*.25)})}
    const NV=S.length*K*2,cl=new Float32Array(NV*3),idx=[],c=new T.Color();
    S.forEach((s,m)=>{const base=col(s.i/n);
      for(let k=0;k<K;k++){const u=k/(K-1);c.set(base).lerp(WHITE,.1*u+.05*rnd()).multiplyScalar(.82+.18*u);   // darker at the root, lighter at the tip
        for(let q=0;q<2;q++){const v=(m*K+k)*2+q;cl[v*3]=c.r;cl[v*3+1]=c.g;cl[v*3+2]=c.b}
        if(k<K-1){const a=(m*K+k)*2;idx.push(a,a+1,a+2,a+1,a+3,a+2)}}});
    this.pos=new Float32Array(NV*3);const g=this.geo=new T.BufferGeometry();
    g.setAttribute('position',new T.BufferAttribute(this.pos,3));g.setAttribute('color',new T.BufferAttribute(cl,3));g.setIndex(idx);
    this.mesh=new T.Mesh(g,VM);this.mesh.frustumCulled=false;frame.add(this.mesh);
  }
  update(){
    const sp=this.sp,n=sp.n,K=this.K,pos=this.pos;sp.frames();let o=0;
    for(const s of this.S){const ca=Math.cos(s.a),sa=Math.sin(s.a);
      for(let k=0;k<K;k++){
        const u=k/(K-1),q=s.i+u*s.len;sp.at(q,_S);
        _r.copy(_S.n).multiplyScalar(ca).addScaledVector(_S.b,sa).normalize();
        const Rv=this.R(Math.min(1,q/n)),rw=Array.isArray(Rv)?Rv[0]:Rv,rt=Array.isArray(Rv)?Rv[1]:Rv,f=(.6+.5*Math.pow(u,1.3))*s.fat;
        _p.copy(_S.p).addScaledVector(_S.n,ca*rw*f).addScaledVector(_S.b,sa*rt*f);
        _w.crossVectors(_r,_S.t).normalize();
        const w=s.w*Math.pow(1-u,.85)*(.6+.4*Math.min(1,u*5));
        pos[o++]=_p.x-_w.x*w;pos[o++]=_p.y-_w.y*w;pos[o++]=_p.z-_w.z*w;
        pos[o++]=_p.x+_w.x*w;pos[o++]=_p.y+_w.y*w;pos[o++]=_p.z+_w.z*w}}
    this.geo.attributes.position.needsUpdate=true;this.geo.computeVertexNormals();
  }
}

// A flat ribbon (elliptical rings: width along the spine's normal, thickness along its binormal) rebuilt from the spine every frame.
class Ribbon{
  constructor(frame,sp,i0,i1,wf,tf,shift,mat,NR=10){
    this.sp=sp;this.i0=i0;this.i1=i1;this.wf=wf;this.tf=tf;this.shift=shift;this.NR=NR;
    const rings=i1-i0+1,idx=[];
    for(let r=0;r<rings-1;r++)for(let j=0;j<NR;j++){const a=r*(NR+1)+j,b=(r+1)*(NR+1)+j;idx.push(a,a+1,b,b,a+1,b+1)}
    this.pos=new Float32Array(rings*(NR+1)*3);const g=this.geo=new T.BufferGeometry();
    g.setAttribute('position',new T.BufferAttribute(this.pos,3));g.setIndex(idx);
    this.mesh=new T.Mesh(g,mat);this.mesh.frustumCulled=false;frame.add(this.mesh);
  }
  update(){
    const sp=this.sp,P=sp.r.lp,n=sp.n,NR=this.NR,pos=this.pos;sp.frames();let o=0;
    for(let i=this.i0;i<=this.i1;i++){const u=i/n,w=this.wf(u),t=this.tf(u),N=sp.N[i],B=sp.B[i],p=P[i];
      for(let j=0;j<=NR;j++){const a=j/NR*6.2832,c=Math.cos(a)*w,sn=Math.sin(a)*t+this.shift;
        pos[o++]=p.x+N.x*c+B.x*sn;pos[o++]=p.y+N.y*c+B.y*sn;pos[o++]=p.z+N.z*c+B.z*sn}}
    this.geo.attributes.position.needsUpdate=true;this.geo.computeVertexNormals();
  }
}

// FLUFFY: a cumulus cloud. Big lumpy body lobes with random smaller bumps stuck all around them (merged spheres, one custom mesh) follow the
// spine: irregular silhouette, no regular segments, soft round end.
class Puffs{
  constructor(frame,rope,col,R){
    this.sp=new Spine(rope);const n=rope.n,rnd=seeded(5),L=this.L=[];
    const add=(s,a,off,r)=>L.push({q:s*n,a,off,r,s});
    const NS=7;
    for(let k=0;k<NS;k++){const s=(k+.5)/NS,Rr=R(s);
      add(s,rnd()*6.283,rnd()*.3*Rr,Rr*(.85+.3*rnd()));                                               // body lobe
      const m=3+((rnd()*2)|0);for(let j=0;j<m;j++)add(Math.min(1,Math.max(0,s+(rnd()-.5)*.1)),rnd()*6.283,Rr*(.55+.4*rnd()),Rr*(.5+.3*rnd()))}   // bumps
    add(1,0,0,R(1)*.9);add(.02,0,0,R(0)*.8);
    const sph=new T.SphereGeometry(1,12,9),vn=this.vn=sph.attributes.position.count,NP=L.length;this.U=Float32Array.from(sph.attributes.position.array);
    const nor=new Float32Array(NP*vn*3),cl=new Float32Array(NP*vn*3),idx=[],c=new T.Color();
    L.forEach((p,m)=>{nor.set(this.U,m*vn*3);c.set(col(p.s)).lerp(WHITE,.05+.1*rnd());
      for(let v=0;v<vn;v++){const k=(m*vn+v)*3;cl[k]=c.r;cl[k+1]=c.g;cl[k+2]=c.b}
      for(const ix of sph.index.array)idx.push(ix+m*vn)});
    this.pos=new Float32Array(NP*vn*3);const g=this.geo=new T.BufferGeometry();
    g.setAttribute('position',new T.BufferAttribute(this.pos,3));g.setAttribute('normal',new T.BufferAttribute(nor,3));g.setAttribute('color',new T.BufferAttribute(cl,3));g.setIndex(idx);
    this.mesh=new T.Mesh(g,VM);this.mesh.frustumCulled=false;frame.add(this.mesh);
  }
  update(){
    const sp=this.sp,vn=this.vn,U=this.U,pos=this.pos;sp.frames();let o=0;
    for(const p of this.L){sp.at(p.q,_S);const ca=Math.cos(p.a)*p.off,sa=Math.sin(p.a)*p.off,
      cx=_S.p.x+_S.n.x*ca+_S.b.x*sa,cy=_S.p.y+_S.n.y*ca+_S.b.y*sa,cz=_S.p.z+_S.n.z*ca+_S.b.z*sa;
      for(let v=0;v<vn;v++){pos[o]=cx+U[v*3]*p.r;pos[o+1]=cy+U[v*3+1]*p.r;pos[o+2]=cz+U[v*3+2]*p.r;o+=3}}
    this.geo.attributes.position.needsUpdate=true;
  }
}

const _t=new T.Vector3(),_n=new T.Vector3(),_b=new T.Vector3();

// Builds the tail inside the `tail` frame. Returns {ropes, update()}. Push `ropes` into the avatar's rope list (they are stepped there)
// and call update() after stepping so the tips / strands / puffs follow the rope.
export function buildTail(type,tail,o){
  const col=tailColor(o),ropes=[],tips=[],mods=[];
  const rope=(pts,opt)=>{const r=new Rope(tail,pts,Object.assign({ref:[1,0,0],nR:8,color:col,stiff:.09,soft:.75,damp:.955,grav:20},opt));ropes.push(r);return r};
  const tip=(r,s)=>{const m=new T.Mesh(LUMP2,new T.MeshStandardMaterial({color:col(1),roughness:.85}));m.scale.set(s,s,s);m.frustumCulled=false;tail.add(m);tips.push({r,m})};
  switch(type){
    case 'fluffy':{   // cloud
      const r=rope(curve([[0,0,0],[0,.1,-.45],[0,.5,-.8],[0,1.0,-.75],[0,1.3,-.42]],12),{radius:.18,taper:.1,stiff:.075,soft:.8,grav:18});
      mods.push(new Puffs(tail,r,col,s=>.16+.2*Math.sin(Math.PI*(.1+.8*s))));break}
    case 'spiky':{    // fox-brush of pointed strands
      const r=rope(curve([[0,0,0],[0,.05,-.5],[0,.4,-1.0],[0,1.0,-1.25],[0,1.6,-1.0]],16),{radius:.28,taper:.75,stiff:.08,soft:.75});     // solid core so the brush is thick, not wispy
      mods.push(new Strands(tail,r,col,s=>.1+.26*Math.pow(Math.sin(Math.PI*Math.min(1,s+.05)),.7)));break}
    case 'long':{
      const r=rope(curve([[0,0,0],[0,.05,-.5],[0,.4,-1.0],[0,1.1,-1.25],[0,1.9,-1.0],[0,2.4,-.5]],20),{radius:.13,taper:.45,stiff:.06,soft:.8});tip(r,.11);break}
    case 'bob':{
      const r=rope(curve([[0,0,0],[0,.12,-.3],[0,.32,-.5]],6),{radius:.21,taper:.1,stiff:.12,soft:.5,grav:12});tip(r,.22);break}
    case 'curly':{
      const r=rope(curve(CURL,18),{radius:.13,taper:.35,stiff:.1,soft:.6,grav:16});tip(r,.12);break}
    case 'double':
      [-1,1].forEach(s=>{const r=rope(curve(CLASSIC.map((p,k)=>[p[0]+s*(.05+.22*k/4),p[1],p[2]]),13),{radius:.13,taper:.4,stiff:.1});tip(r,.11)});break;
    default:{        // classic (the original tail)
      const r=rope(curve(CLASSIC,13),{radius:.18,taper:.35});tip(r,.14)}
  }
  const update=()=>{for(const k of tips)k.m.position.copy(k.r.lp[k.r.n]);for(const m of mods)m.update()};
  update();
  return {ropes,main:ropes[0],update};
}

// ------------------------------------------------------------------ fluffy ear
// Built exactly like the spiky tail: ONE physics spine (a rope inside the ear) + custom meshes that are rebuilt from that spine every frame,
// so the whole ear moves as one connected piece (nothing is a separate floating rope):
//   leaf core (flat ribbon) + pink inner-ear patch at the root + two layers of pointed fur strands across the ear's width.
// Everything is in HEAD space (a `pose` group cancels the ear anchor's transform) and the spine is clamped outside the skull.
export function buildFluffyEar(sw,em,pink){
  const g=sw.parent,s=g&&g.position.x<0?-1:1,pose=new T.Group();sw.add(pose);
  if(g){g.updateMatrix();new T.Matrix4().copy(g.matrix).invert().decompose(pose.position,pose.quaternion,pose.scale)}   // pose-local == head space
  // resting shape: leaves the top of the head, bulges out around the widest part of the skull, hangs down past the cheek
  const cur=new T.CatmullRomCurve3([[.58,.56,.02],[.86,.5,0],[1.06,.28,0],[1.13,-.05,0],[1.07,-.38,0],[.98,-.6,0]].map(p=>new T.Vector3(p[0]*s,p[1],p[2])));
  const NS=12,out=new T.Vector3(s,0,0);
  const hw=u=>.34*(.55+.45*Math.sin(Math.min(1,u*2.2)*Math.PI/2))*Math.sqrt(Math.max(0,1-Math.pow(u,3.2))),th=u=>.045+.03*(1-u);
  const spine=new Lock(pose,cur.getPoints(NS),{radius:.01,nR:4,clamp:true,stiff:.12,soft:.5,damp:.92,grav:6,ref:[0,0,1],prof:()=>[.001,.001]});
  spine.mesh.visible=false;                                    // the rope is only the physics skeleton
  const sp=new Spine(spine,[0,0,1],out);
  const matL=em.clone(),matP=pink.clone();matL.side=matP.side=T.DoubleSide;
  const leaf=new Ribbon(pose,sp,0,NS,hw,th,0,matL),
        patch=new Ribbon(pose,sp,0,5,u=>hw(u)*.55,u=>th(u)*.6,th(0)*.85,matP),
        fur=new Strands(pose,spine,()=>em.color,u=>[hw(u),th(u)+.08],{ref:[0,0,1],out,M:11,arc:[-.2*Math.PI,1.2*Math.PI],over:3});
  const update=()=>{leaf.update();patch.update();fur.update()};update();
  return {ropes:[spine],mods:[update],pose};
}

// ------------------------------------------------------------------ whiskers
export const WHISKERS=[['none','None'],['classic','Classic'],['short','Short'],['long','Long'],['thick','Thick'],['many','Many'],['droopy','Droopy'],['white','White']];
// Rope-physics whiskers on the head. Returns the ropes (push them into the avatar's rope list). 'none' returns [].
export function buildWhiskers(type,head){
  if(type==='none')return [];
  const P={classic:{},short:{n:4,st:.13},long:{n:7,st:.22,stiff:.16},thick:{rad:.03},many:{rows:[-1.5,-.5,.5,1.5],sp:.085},droopy:{grav:11,stiff:.12,droop:.02},white:{col:'#fff7ee'}}[type]||{};
  const o=Object.assign({n:5,st:.2,rad:.016,stiff:.2,soft:.5,grav:5,droop:.008,col:'#2a1a14',rows:[-1,0,1],sp:.11},P),ropes=[];
  [-1,1].forEach(s=>o.rows.forEach(i=>{const rest=[];
    for(let k=0;k<o.n;k++)rest.push(new T.Vector3(s*(.68+k*o.st),-.1+i*o.sp+i*k*.025*(o.st/.2)-k*k*o.droop,.5-k*.03));
    ropes.push(new Rope(head,rest,{radius:o.rad,taper:.6,nR:4,ref:[0,1,0],stiff:o.stiff,soft:o.soft,damp:.9,grav:o.grav,color:()=>o.col}))}));
  return ropes;
}