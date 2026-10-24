// JUNGLE VINES (own file): hanging vines that really move. Each vine is a Verlet chain (same integration as the Rope in physics.js) pinned to the canopy:
// gravity, damping, a soft pull back to its hanging shape, a breeze, and the player pushes it aside when walking through. The mesh is a knobbly stem with heart-ish leaves.
// Only the vines nearest to the player are simulated and drawn (MAXV of them, all in ONE dynamic mesh = 1 draw call); the others cost nothing.
//   const vines=createVines(env,world);  scene.add(vines.mesh)
//   const h=vines.add([{x,y,z,len,s,seed}...])   chunk loaded      vines.remove(h)   chunk freed
//   vines.update(t,P,windOn)   every frame (P = player {x,y?,z})     vines.dispose()
import * as T from 'three';

const N=9,S=5,LV=8,MAXV=56,RANGE=44,RANGE2=RANGE*RANGE;
const VV=N*S+LV*4,IV=(N-1)*S*6+LV*6;                 // vertices / indices per vine
const STEM=['#436f33','#4f7d38','#3d6a30'],LEAF=['#2f8a3a','#3aa04a','#4fb350','#2a7a38','#45a844'];
const _c=new T.Color();

export function createVines(env=null,world=null){
  const pos=new Float32Array(MAXV*VV*3),col=new Float32Array(MAXV*VV*3),idx=new Uint16Array(MAXV*IV);
  for(let sl=0;sl<MAXV;sl++){const vb=sl*VV;let k=sl*IV;
    for(let i=0;i<N-1;i++)for(let j=0;j<S;j++){const a=vb+i*S+j,a1=vb+i*S+(j+1)%S,b=a+S,b1=a1+S;idx[k++]=a;idx[k++]=a1;idx[k++]=b;idx[k++]=a1;idx[k++]=b1;idx[k++]=b}
    for(let l=0;l<LV;l++){const q=vb+N*S+l*4;idx[k++]=q;idx[k++]=q+1;idx[k++]=q+2;idx[k++]=q;idx[k++]=q+2;idx[k++]=q+3}}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(pos,3).setUsage(T.DynamicDrawUsage));geo.setAttribute('color',new T.BufferAttribute(col,3));
  geo.setAttribute('normal',new T.BufferAttribute(new Float32Array(pos.length),3).setUsage(T.DynamicDrawUsage));geo.setIndex(new T.BufferAttribute(idx,1));
  const mesh=new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,roughness:.85,side:T.DoubleSide,envMap:env,envMapIntensity:.4}));
  mesh.frustumCulled=false;mesh.matrixAutoUpdate=false;

  const all=new Set(),slots=new Array(MAXV).fill(null);let lastT=0,lastSel=-9,selX=1e9,selZ=1e9;

  // ---- the simulation state of one vine lives in a slot while the vine is close to the player
  function paintVine(st){const v=st.v,vb=st.slot*VV,sc=STEM[(v.seed|0)%3];
    for(let i=0;i<N;i++){_c.set(sc).multiplyScalar(.85+.3*i/(N-1));for(let j=0;j<S;j++){const k=(vb+i*S+j)*3;col[k]=_c.r;col[k+1]=_c.g;col[k+2]=_c.b}}
    for(let l=0;l<LV;l++){_c.set(LEAF[(((v.seed*7+l*3)|0)%LEAF.length+LEAF.length)%LEAF.length]);
      for(let q=0;q<4;q++){const f=q===0?.7:q===2?1.12:1,k=(vb+N*S+l*4+q)*3;col[k]=_c.r*f;col[k+1]=_c.g*f;col[k+2]=_c.b*f}}
    geo.attributes.color.needsUpdate=true}
  function claim(v,sl){
    const st={v,slot:sl,p:new Float32Array(N*3),pv:new Float32Array(N*3),rest:new Float32Array(N*3),seg:v.len/(N-1)};
    for(let i=0;i<N;i++){const f=i/(N-1),k=i*3,wob=.09*v.s*f;                      // rest shape: hangs straight down with a lazy meander
      st.rest[k]=v.x+Math.sin(i*.8+v.seed)*wob;st.rest[k+1]=v.y-i*st.seg;st.rest[k+2]=v.z+Math.cos(i*.65+v.seed*1.3)*wob;
      st.p[k]=st.pv[k]=st.rest[k];st.p[k+1]=st.pv[k+1]=st.rest[k+1];st.p[k+2]=st.pv[k+2]=st.rest[k+2]}
    slots[sl]=st;v.st=st;paintVine(st);return st}
  function release(st){slots[st.slot]=null;st.v.st=null;const a=st.slot*VV*3;pos.fill(0,a,a+VV*3);geo.attributes.position.needsUpdate=true}

  function select(px,pz){
    const cand=[];for(const v of all){const dx=v.x-px,dz=v.z-pz,d=dx*dx+dz*dz;if(d<RANGE2){v._d=d;cand.push(v)}}
    cand.sort((a,b)=>a._d-b._d);if(cand.length>MAXV)cand.length=MAXV;
    const keep=new Set(cand);
    for(let i=0;i<MAXV;i++){const st=slots[i];if(st&&!keep.has(st.v))release(st)}
    for(const v of cand){if(v.st)continue;const sl=slots.indexOf(null);if(sl<0)break;claim(v,sl)}}

  const _t=new T.Vector3(),_n=new T.Vector3(),_b=new T.Vector3(),_u=new T.Vector3(),_d=new T.Vector3(),_s=new T.Vector3();
  function step(st,dt,t,pl,wind){
    const p=st.p,pv=st.pv,rest=st.rest,v=st.v,f60=dt*60,damp=Math.pow(.965,f60),g=18*v.s*dt*dt;
    const gust=wind?.5+.5*Math.sin(t*.35+v.x*.07+v.z*.05):0;
    for(let i=1;i<N;i++){const k=i*3,f=i/(N-1);
      let vx=(p[k]-pv[k])*damp,vy=(p[k+1]-pv[k+1])*damp,vz=(p[k+2]-pv[k+2])*damp;pv[k]=p[k];pv[k+1]=p[k+1];pv[k+2]=p[k+2];
      p[k]+=vx;p[k+1]+=vy-g;p[k+2]+=vz;
      if(wind){const w=(.55+.9*gust)*f*dt*dt*60;                                         // breeze: small, slow, stronger towards the free end
        p[k]+=(Math.sin(t*1.3+v.x*.4+i*.5)*.5+Math.sin(t*2.7+v.z*.3)*.2)*w*.9;p[k+2]+=(Math.cos(t*1.1+v.z*.35+i*.4)*.4)*w*.9}
      const sk=1-Math.pow(1-.03*(1-.55*f),f60);                                           // soft pull back to the hanging shape
      p[k]+=(rest[k]-p[k])*sk;p[k+1]+=(rest[k+1]-p[k+1])*sk;p[k+2]+=(rest[k+2]-p[k+2])*sk;
      if(pl){const dx=p[k]-pl.x,dz=p[k+2]-pl.z,d=Math.hypot(dx,dz),R=.62;                 // the cat walks through: push the vine out of the way
        if(d<R&&p[k+1]>pl.y-.3&&p[k+1]<pl.y+1.7){if(d>1e-3){p[k]+=dx/d*(R-d);p[k+2]+=dz/d*(R-d)}else p[k]+=R}}}
    p[0]=rest[0];p[1]=rest[1];p[2]=rest[2];pv[0]=p[0];pv[1]=p[1];pv[2]=p[2];
    for(let it=0;it<4;it++)for(let i=1;i<N;i++){const a=(i-1)*3,b=i*3,dx=p[b]-p[a],dy=p[b+1]-p[a+1],dz=p[b+2]-p[a+2],l=Math.hypot(dx,dy,dz)||1e-6,df=(l-st.seg)/l;
      if(i===1){p[b]-=dx*df;p[b+1]-=dy*df;p[b+2]-=dz*df}else{const h=df*.5;p[b]-=dx*h;p[b+1]-=dy*h;p[b+2]-=dz*h;p[a]+=dx*h;p[a+1]+=dy*h;p[a+2]+=dz*h}}
    if(!isFinite(p[N*3-1]+p[N*3-2])){p.set(rest);pv.set(rest)}                           // never let a NaN poison the mesh
    write(st,t,wind)}

  function write(st,t,wind){
    const p=st.p,v=st.v,vb=st.slot*VV,sc=v.s,r0=.045*sc;
    _n.set(1,0,0);
    for(let i=0;i<N;i++){const a=Math.max(0,i-1)*3,b=Math.min(N-1,i+1)*3,k=i*3;
      _t.set(p[b]-p[a],p[b+1]-p[a+1],p[b+2]-p[a+2]);if(_t.lengthSq()<1e-12)_t.set(0,-1,0);_t.normalize();
      _n.addScaledVector(_t,-_n.dot(_t));if(_n.lengthSq()<1e-9)_n.set(0,0,1).addScaledVector(_t,-_t.z);_n.normalize();_b.crossVectors(_t,_n);   // parallel transport: no twisting
      const f=i/(N-1),r=r0*(1-.55*f)*(1+.18*Math.sin(i*2.3+v.seed));                      // slightly knobbly
      for(let j=0;j<S;j++){const an=j/S*6.283185,c=Math.cos(an)*r,s=Math.sin(an)*r,o=(vb+i*S+j)*3;
        pos[o]=p[k]+_n.x*c+_b.x*s;pos[o+1]=p[k+1]+_n.y*c+_b.y*s;pos[o+2]=p[k+2]+_n.z*c+_b.z*s}
      if(i>=1){const l=i-1,ang=l*2.4+v.seed,ca=Math.cos(ang),sa=Math.sin(ang),fl=Math.sin(Math.PI*f),L=(.2+.16*fl)*sc*(i===N-1?.75:1),W=L*.4,
          fx=wind?Math.sin(t*3+l*1.7+v.seed)*.14:0,o=(vb+N*S+l*4)*3;
        _u.set(_n.x*ca+_b.x*sa,_n.y*ca+_b.y*sa,_n.z*ca+_b.z*sa);                           // side the leaf grows on (round and round the stem)
        _d.copy(_u).multiplyScalar(.95).addScaledVector(_t,.3);_d.y-=.55;_d.addScaledVector(_u,fx).normalize();                   // leaves droop
        _s.crossVectors(_d,_t);if(_s.lengthSq()<1e-6)_s.copy(_b);_s.normalize();
        pos[o]=p[k]+_u.x*r;pos[o+1]=p[k+1]+_u.y*r;pos[o+2]=p[k+2]+_u.z*r;                    // base on the stem
        pos[o+3]=p[k]+_d.x*L*.5+_s.x*W;pos[o+4]=p[k+1]+_d.y*L*.5+_s.y*W;pos[o+5]=p[k+2]+_d.z*L*.5+_s.z*W;
        pos[o+6]=p[k]+_d.x*L;pos[o+7]=p[k+1]+_d.y*L-.1*L;pos[o+8]=p[k+2]+_d.z*L;              // tip curls down a little
        pos[o+9]=p[k]+_d.x*L*.5-_s.x*W;pos[o+10]=p[k+1]+_d.y*L*.5-_s.y*W;pos[o+11]=p[k+2]+_d.z*L*.5-_s.z*W}}}

  let lastWind=true;
  return{mesh,
    add(list){const out=[];for(const d of list){const v={x:d.x,y:d.y,z:d.z,len:d.len,s:d.s,seed:d.seed,st:null,_d:0};all.add(v);out.push(v)}lastSel=-9;return out},
    remove(list){if(!list)return;for(const v of list){if(v.st)release(v.st);all.delete(v)}},
    update(t,P,windOn=true){
      const dt=Math.min(Math.max(t-lastT,0),1/30);lastT=t;if(!P||!(dt>0))return;
      if(t-lastSel>.4||Math.hypot(P.x-selX,P.z-selZ)>2.5){select(P.x,P.z);lastSel=t;selX=P.x;selZ=P.z}
      const py=Number.isFinite(P.y)?P.y:(world?world.heightAt(P.x,P.z):0),pl={x:P.x,z:P.z,y:py};
      for(let i=0;i<MAXV;i++){const st=slots[i];if(st)step(st,dt,t,pl,windOn)}
      geo.attributes.position.needsUpdate=true;geo.computeVertexNormals();geo.attributes.normal.needsUpdate=true},
    dispose(){geo.dispose();mesh.material.dispose();mesh.parent&&mesh.parent.remove(mesh);all.clear()}};
}