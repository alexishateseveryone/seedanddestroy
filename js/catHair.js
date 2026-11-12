// Hair for the cat avatar: ONE continuous mesh per hairstyle (not separate strands).
// The hair is one continuous thick shell that starts at the crown and runs down the scalp in columns around the head; colour streaks come from vertex colours.
// Physics: one particle per vertex, simulated in world space (verlet + shape matching + distance constraints), so the hair lags and swings with the head.
// The roots are pinned to the (shaped) scalp, the rest is soft; collisions use the head shape itself plus the body ellipsoids.
import * as T from 'three';
import {headMult,HX,HY,HZ} from './catShape.js';

export const HAIRS=[['none','None'],['crop','Crop'],['fringe','Fringe'],['bob','Bob'],['long','Long'],['shaggy','Shaggy'],['puff','Puff']];
export const HAIR_COLS=['#2a1a14','#7a4a2b','#d9b48a','#ffd54a','#e63946','#ff6fa0','#b07aff','#4aa8ff','#58c878','#ffffff','#9aa3b5','#14141c'];

const PI=Math.PI,lerp=(a,b,t)=>a+(b-a)*t;
const sm=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)};
const seeded=s=>()=>(s=(s*16807)%2147483647)/2147483647;

// The hair is a thick shell: an INNER layer that floats just above the scalp and an OUTER layer on top of it. Both are joined at the hem,
// where the thickness shrinks to zero along a round profile, so the edge is a soft rounded lip (puffy) and never a flat cut or a spike.
// The hem is a smooth scallop (rounded lobes, 4 columns per lobe), not a sawtooth.
// Style table. C = columns around the head (multiple of 4), R = rows from crown to hem, pin = fraction of the length held on the scalp,
// kR / kT = shape-memory at the root / tip (1 = rigid; high = calm hair), damp = momentum kept, grav, v = hem length at the lobe dips relative to the lobe tops,
// th = thickness of the shell. f(A, r) per column, A = angle from the front (0 = face, PI = back of the head), r = random 0..1 ->
//   e = elevation where the hair ends on the head (PI/2 = crown, 0 = eye line, negative = below the ears), h = extra length hanging free past that,
//   o(u) = how far the inner layer stands off the scalp along its length (u = 0 root .. 1 tip).
const GAP=.04;   // the inner layer never gets closer than this (plus o) to the scalp
const S={
  crop:  {C:40,R:10,pin:.6, kR:.98,kT:.85,damp:.80,grav:3,v:.90,th:.085,f:A=>({e:lerp(.7,.2,sm(.5,2.4,A)),h:0,o:u=>.03+.04*Math.sin(PI*u)})},
  fringe:{C:44,R:11,pin:.5, kR:.97,kT:.75,damp:.80,grav:4,v:.86,th:.085,f:A=>({e:A<.9?lerp(.38,.55,sm(.4,.9,A)):lerp(.55,-.05,sm(.9,2.4,A)),h:.14*(1-sm(.4,1.1,A)),o:u=>.04+.05*Math.sin(PI*u)})},
  bob:   {C:44,R:12,pin:.5, kR:.96,kT:.55,damp:.82,grav:5,v:.86,th:.09,f:A=>({e:A<.7?lerp(.42,.55,sm(.2,.7,A)):lerp(.55,-.5,sm(.8,1.5,A)),h:.1+.12*sm(1,2.5,A),o:u=>.04+.1*Math.sin(PI*Math.min(1,u*.9))})},
  long:  {C:44,R:14,pin:.42,kR:.95,kT:.4, damp:.84,grav:7,v:.82,th:.09,f:A=>({e:lerp(.55,-.55,sm(.8,1.5,A)),h:lerp(0,.55,sm(1,2.2,A)),o:u=>.04+.08*Math.sin(PI*Math.min(1,u*.9))})},
  shaggy:{C:44,R:12,pin:.46,kR:.95,kT:.5, damp:.82,grav:5,v:.72,th:.09,f:(A,r)=>({e:lerp(.5,-.35,sm(.6,1.6,A))+(r-.5)*.3,h:.18+.3*r+.2*sm(1.4,3,A),o:u=>.04+.1*Math.sin(PI*Math.min(1,u*.9))})},
  puff:  {C:40,R:11,pin:.55,kR:.98,kT:.85,damp:.80,grav:3,v:.92,th:.12,f:A=>({e:A<.8?lerp(.48,.1,sm(.2,.8,A)):lerp(.1,-.12,sm(.8,2.4,A)),h:0,o:u=>.05+.2*Math.pow(Math.sin(PI*Math.min(1,u*.92)),.8)})}
};

// Builds the rest shape (head-local) of one hairstyle. Vertices 0..N1-1 = inner layer, N1..2*N1-1 = outer layer (its hem vertices are unused: the outer
// layer reuses the inner hem vertices, which closes the shell).
function build(style,shape){
  const D=S[style]||S.crop,C=D.C,R=D.R,N1=1+C*(R-1),N=2*N1;
  const rest=new Float32Array(N*3),kk=new Float32Array(N),pin=new Uint8Array(N),U=new Float32Array(N),LOBE=new Float32Array(N),J=new Uint16Array(N),LAY=new Uint8Array(N);
  const vi=(j,i)=>i===0?0:1+j*(R-1)+i-1,vo=(j,i)=>i===R-1?vi(j,i):N1+vi(j,i),rnd=seeded(17),P=new T.Vector3(),Nn=new T.Vector3();
  const place=(a,e,out)=>{   // a point on the (shaped) scalp at azimuth a / elevation e, pushed out along the surface normal
    const ce=Math.cos(e),dx=Math.sin(a)*ce,dy=Math.sin(e),dz=Math.cos(a)*ce,m=headMult(shape,dx,dy,dz);
    P.set(dx*m*HX,dy*m*HY,dz*m*HZ);Nn.set(P.x/(HX*HX),P.y/(HY*HY),P.z/(HZ*HZ)).normalize();P.addScaledVector(Nn,out)};
  const capStart=1-3/(R-1);
  const thick=u=>{const s=Math.max(0,(u-capStart)/(1-capStart));return D.th*Math.sqrt(Math.max(0,1-s*s))*(.8+.2*Math.sin(PI*Math.min(1,u*1.2)))};   // round lip at the hem
  const setV=(x,u,lobe,j,lay)=>{rest[x*3]=P.x;rest[x*3+1]=P.y;rest[x*3+2]=P.z;U[x]=u;LOBE[x]=lobe;J[x]=j;LAY[x]=lay;pin[x]=u<=D.pin?1:0;kk[x]=lerp(D.kR,D.kT,Math.pow(u,.8))};
  const c0=D.f(0,.5).o(0);
  place(0,PI/2,GAP+c0);setV(0,0,1,0,0);kk[0]=1;pin[0]=1;
  place(0,PI/2,GAP+c0+thick(0));setV(N1,0,1,0,1);kk[N1]=1;pin[N1]=1;
  for(let j=0;j<C;j++){
    const a=-PI+2*PI*j/C,A=Math.abs(a),lobe=.5+.5*Math.cos(PI*j/2),c=D.f(A,rnd()),lf=D.v+(1-D.v)*lobe,eEnd=PI/2-(PI/2-c.e)*lf,hang=c.h*lf;
    for(let i=1;i<R;i++){
      const u=i/(R-1),uS=hang>.001?.7:1,s=Math.min(1,u/uS);
      for(let lay=0;lay<2;lay++){
        if(lay===1&&i===R-1)continue;
        place(a,PI/2-(PI/2-eEnd)*s,GAP+c.o(u)+(lay?thick(u):0));
        if(u>uS){const k=(u-uS)/(1-uS);P.y-=hang*k;P.x+=Math.sin(a)*.1*k;P.z+=Math.cos(a)*.1*k}   // past the scalp the hair hangs free
        setV(lay?vo(j,i):vi(j,i),u,lobe,j,lay);
      }
    }
  }
  // the unused outer hem vertices just sit on the hem
  for(let j=0;j<C;j++){const x=N1+vi(j,R-1),y=vi(j,R-1);for(let q=0;q<3;q++)rest[x*3+q]=rest[y*3+q];pin[x]=1;kk[x]=1;U[x]=1;LAY[x]=1}
  const idx=[],ea=[],eb=[],ew=[];
  const edge=(a,b,w)=>{ea.push(a);eb.push(b);ew.push(w)};
  for(let lay=0;lay<2;lay++){const V=lay?vo:vi;
    for(let j=0;j<C;j++){const jn=(j+1)%C;
      for(let i=0;i<R-1;i++){
        const a=V(j,i),b=V(j,i+1),c=V(jn,i),d=V(jn,i+1);
        if(lay===0){if(a!==c)idx.push(a,c,b);idx.push(c,d,b)}else{if(a!==c)idx.push(a,b,c);idx.push(c,b,d)}   // inner layer is wound the other way (it faces the head)
        edge(a,b,1);                                                      // along the lock
      }
      for(let i=1;i<R-(lay?1:0);i++)edge(V(j,i),V(jn,i),.45);              // across the sheet
    }
  }
  edge(0,N1,.9);
  for(let j=0;j<C;j++)for(let i=1;i<R-1;i++)edge(vi(j,i),vo(j,i),.9);       // keeps the thickness
  const E=ea.length,EL=new Float32Array(E),EW=Float32Array.from(ew);
  for(let e=0;e<E;e++){const a=ea[e]*3,b=eb[e]*3;EL[e]=Math.hypot(rest[a]-rest[b],rest[a+1]-rest[b+1],rest[a+2]-rest[b+2])}
  return {N,N1,C,R,rest,kk,pin,U,LOBE,LAY,J,idx,EA:Int32Array.from(ea),EB:Int32Array.from(eb),EL,EW,D};
}

const WHITE=new T.Color('#ffffff');
function colors(d,col){   // streaks: tips lighter, valleys darker, darker at the root, a little per-lock variation
  const c=new T.Color(col),o=new Float32Array(d.N*3),t=new T.Color();
  for(let k=0;k<d.N;k++){
    const u=d.U[k],tip=d.LOBE[k],hj=((d.J[k]*2654435761)>>>0)/4294967296;
    t.copy(c).multiplyScalar((.6+.4*Math.pow(u,.6))*(.88+.12*tip)*(.93+.14*hj)*(d.LAY[k]?1:.8));
    if(tip>.5&&u>.7)t.lerp(WHITE,.12*sm(.7,1,u));
    o[k*3]=t.r;o[k*3+1]=t.g;o[k*3+2]=t.b;
  }
  return o;
}
function makeGeo(d,col){
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.BufferAttribute(Float32Array.from(d.rest),3));
  g.setAttribute('color',new T.BufferAttribute(colors(d,col),3));
  g.setIndex(d.idx);g.computeVertexNormals();return g;
}
const hairMat=()=>new T.MeshStandardMaterial({color:'#ffffff',vertexColors:true,side:T.DoubleSide,roughness:.85});

// static hair (maker icons): same mesh, no physics
export function buildHairStatic(style,col=HAIR_COLS[0],shape='round'){
  const g=new T.Group();if(!style||style==='none')return g;
  g.add(new T.Mesh(makeGeo(build(style,shape),col),hairMat()));return g;
}

// Live hair. head = the head group (the mesh lives in its local space), cat = the cat group (body colliders are in its space),
// o = {style, color, shape (head shape), coll: [[centre],[radii]] body ellipsoids in cat space}. Call step(dt) every frame.
export function createHair(head,cat,o={}){
  const shape=o.shape||'round',d=build(o.style,shape),D=d.D,N=d.N,geo=makeGeo(d,o.color||HAIR_COLS[0]);
  const mesh=new T.Mesh(geo,hairMat());mesh.frustumCulled=false;head.add(mesh);
  const p=new Float32Array(N*3),q=new Float32Array(N*3),tw=new Float32Array(N*3),pos=geo.attributes.position.array,coll=o.coll||[],E=d.EA.length;
  const M=new T.Matrix4(),Mi=new T.Matrix4(),Cw=new T.Matrix4(),Ci=new T.Matrix4(),v=new T.Vector3(),w=new T.Vector3();
  let ready=false;
  function step(dt){
    if(!(dt>0))return;dt=Math.min(dt,1/20);
    head.updateWorldMatrix(true,false);cat.updateWorldMatrix(true,false);
    M.copy(head.matrixWorld);Mi.copy(M).invert();Cw.copy(cat.matrixWorld);Ci.copy(Cw).invert();
    const sc=M.getMaxScaleOnAxis();
    for(let k=0;k<N;k++){v.set(d.rest[k*3],d.rest[k*3+1],d.rest[k*3+2]).applyMatrix4(M);tw[k*3]=v.x;tw[k*3+1]=v.y;tw[k*3+2]=v.z}   // where each vertex would be if the hair were rigid
    if(!ready){p.set(tw);q.set(tw);ready=true}
    const n=Math.min(3,Math.max(1,Math.ceil(dt/.012))),h=dt/n,g=D.grav*sc*h*h,dm=Math.pow(D.damp,h*60);
    for(let s=0;s<n;s++){
      // 1. integrate: momentum (this is what makes the hair lag behind the head), gravity, then a pull back towards the rest shape
      for(let k=0;k<N;k++){const o3=k*3;
        if(d.pin[k]){for(let a=0;a<3;a++){p[o3+a]=q[o3+a]=tw[o3+a]}continue}
        const sk=1-Math.pow(1-d.kk[k],h*60);
        for(let a=0;a<3;a++){const x=p[o3+a],vel=(x-q[o3+a])*dm;q[o3+a]=x;p[o3+a]=x+vel-(a===1?g:0)}
        for(let a=0;a<3;a++)p[o3+a]+=(tw[o3+a]-p[o3+a])*sk;
      }
      // 2. keep the lengths: along every lock (rigid) and across the sheet (soft)
      for(let it=0;it<2;it++)for(let e=0;e<E;e++){
        const ia=d.EA[e],ib=d.EB[e],wa=d.pin[ia]?0:1,wb=d.pin[ib]?0:1,ws=wa+wb;if(!ws)continue;
        const a=ia*3,b=ib*3,dx=p[b]-p[a],dy=p[b+1]-p[a+1],dz=p[b+2]-p[a+2],l=Math.hypot(dx,dy,dz)||1e-6,kc=(l-d.EL[e]*sc)/l*d.EW[e]/ws;
        p[a]+=dx*kc*wa;p[a+1]+=dy*kc*wa;p[a+2]+=dz*kc*wa;p[b]-=dx*kc*wb;p[b+1]-=dy*kc*wb;p[b+2]-=dz*kc*wb;
      }
      // 3. collide with the head (its real shape) and the body ellipsoids
      for(let k=0;k<N;k++){if(d.pin[k])continue;const o3=k*3;
        v.set(p[o3],p[o3+1],p[o3+2]);
        w.copy(v).applyMatrix4(Mi);let x=w.x/HX,y=w.y/HY,z=w.z/HZ,r=Math.hypot(x,y,z);
        if(r<1e-4){x=0;y=1;z=0;r=1}
        const lim=headMult(shape,x/r,y/r,z/r)+.045;
        if(r<lim){const f=lim/r;w.set(x*f*HX,y*f*HY,z*f*HZ);v.copy(w).applyMatrix4(M)}
        if(coll.length){
          w.copy(v).applyMatrix4(Ci);let hit=false;
          for(const [c,rr] of coll){
            const dx=(w.x-c[0])/rr[0],dy=(w.y-c[1])/rr[1],dz=(w.z-c[2])/rr[2],d2=dx*dx+dy*dy+dz*dz;
            if(d2<1){const dd=Math.sqrt(d2)||1e-4;w.set(c[0]+dx/dd*rr[0],c[1]+dy/dd*rr[1],c[2]+dz/dd*rr[2]);hit=true}}
          if(hit)v.copy(w).applyMatrix4(Cw);
        }
        p[o3]=v.x;p[o3+1]=v.y;p[o3+2]=v.z;
      }
    }
    // write the vertices back in head space
    for(let k=0;k<N;k++){v.set(p[k*3],p[k*3+1],p[k*3+2]).applyMatrix4(Mi);pos[k*3]=v.x;pos[k*3+1]=v.y;pos[k*3+2]=v.z}
    geo.attributes.position.needsUpdate=true;geo.computeVertexNormals();
  }
  return {mesh,step,dispose(){head.remove(mesh);geo.dispose();mesh.material.dispose()}};
}
