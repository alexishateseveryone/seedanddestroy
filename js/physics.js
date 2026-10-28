// Verlet physics in world space, rebuilt as meshes in the parent's local space: Rope (tail, whiskers) and Cloth (cloak).
import * as T from 'three';
// "Reduce physics" (Settings > Graphics). The flag lives on globalThis so settings.js can flip it without importing this file.
// Reduced = every Cloth (cloak, collar, scarf tail) still simulates every frame, but with 1 constraint iteration instead of 3, a single
// collision pass, and its normals recomputed only every other frame (cats alternate so the work is spread). It still moves and drapes the
// same way, the cloth is just a little looser. Costs about half. (Ropes: tail / whiskers / ear fur are cheap and unchanged.)
export const PHYS=globalThis.__SAD_PHYS||(globalThis.__SAD_PHYS={reduce:false});
let _cn=0;
export const VM=new T.MeshStandardMaterial({vertexColors:true,roughness:1,side:T.DoubleSide});
const _t=new T.Vector3(),_n=new T.Vector3(),_b=new T.Vector3(),_d=new T.Vector3(),_s=new T.Vector3(),_c=new T.Color(),_i=new T.Matrix4();
const paint=(a,i,h)=>{_c.set(h);a[i*3]=_c.r;a[i*3+1]=_c.g;a[i*3+2]=_c.b};
export class Rope{
  constructor(frame,rest,o={}){
    this.f=frame;this.rest=rest;const n=this.n=rest.length-1,O=this.o=Object.assign({radius:.05,taper:0,nR:6,stiff:.12,soft:.6,damp:.95,grav:18,ref:[1,0,0],color:()=>'#fff'},o),nR=O.nR;
    this.rw=rest.map(()=>new T.Vector3());this.p=rest.map(()=>new T.Vector3());this.pv=rest.map(()=>new T.Vector3());this.lp=rest.map(v=>v.clone());
    this.total=0;for(let i=1;i<=n;i++)this.total+=rest[i].distanceTo(rest[i-1]);
    const pos=new Float32Array((n+1)*(nR+1)*3),cl=new Float32Array(pos.length),idx=[];
    for(let i=0;i<=n;i++)for(let j=0;j<=nR;j++){paint(cl,i*(nR+1)+j,O.color(i/n));if(i<n&&j<nR){const a=i*(nR+1)+j,b=(i+1)*(nR+1)+j;idx.push(a,a+1,b,b,a+1,b+1)}}
    const g=this.geo=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));g.setAttribute('color',new T.BufferAttribute(cl,3));g.setIndex(idx);
    this.mesh=new T.Mesh(g,VM);this.mesh.frustumCulled=false;frame.add(this.mesh);this.ref=new T.Vector3(...O.ref);this.init=false;this.fit();
  }
  fit(){const n=this.n,nR=this.o.nR,P=this.lp,pos=this.geo.attributes.position.array;
    for(let i=0;i<=n;i++){_t.subVectors(P[Math.min(i+1,n)],P[Math.max(i-1,0)]).normalize();
      _n.copy(this.ref).addScaledVector(_t,-this.ref.dot(_t));if(_n.lengthSq()<1e-6)_n.set(0,0,1).addScaledVector(_t,-_t.z);_n.normalize();_b.crossVectors(_t,_n);
      const r=this.o.radius*(1-this.o.taper*i/n);
      for(let j=0;j<=nR;j++){const a=j/nR*6.2832,c=Math.cos(a)*r,s=Math.sin(a)*r,k=(i*(nR+1)+j)*3;pos[k]=P[i].x+_n.x*c+_b.x*s;pos[k+1]=P[i].y+_n.y*c+_b.y*s;pos[k+2]=P[i].z+_n.z*c+_b.z*s}}
    this.geo.attributes.position.needsUpdate=true;this.geo.computeVertexNormals()}
  step(dt){dt=Math.min(dt,1/30);if(!(dt>0))return;
    const f=this.f,n=this.n,o=this.o,{rw,p,pv,rest}=this;f.updateWorldMatrix(true,false);const Mx=f.matrixWorld,sc=_s.setFromMatrixScale(Mx).x;
    for(let i=0;i<=n;i++)rw[i].copy(rest[i]).applyMatrix4(Mx);
    if(!this.init||p[n].distanceTo(rw[n])>this.total*sc*1.6){for(let i=0;i<=n;i++){p[i].copy(rw[i]);pv[i].copy(rw[i])}this.init=true}
    const f60=dt*60,damp=Math.pow(o.damp,f60);
    for(let i=1;i<=n;i++){const q=p[i],pr=pv[i],vx=(q.x-pr.x)*damp,vy=(q.y-pr.y)*damp,vz=(q.z-pr.z)*damp;pr.copy(q);q.x+=vx;q.y+=vy-o.grav*sc*dt*dt;q.z+=vz;q.lerp(rw[i],1-Math.pow(1-o.stiff*(1-o.soft*i/n),f60))}
    p[0].copy(rw[0]);pv[0].copy(rw[0]);
    for(let it=0;it<3;it++)for(let i=1;i<=n;i++){const a=p[i-1],b=p[i],d=_d.subVectors(b,a),len=d.length()||1e-6,diff=(len-rw[i].distanceTo(rw[i-1]))/len;
      if(i===1)b.addScaledVector(d,-diff);else{b.addScaledVector(d,-diff*.5);a.addScaledVector(d,diff*.5)}}
    _i.copy(Mx).invert();for(let i=0;i<=n;i++)this.lp[i].copy(p[i]).applyMatrix4(_i);
    if(!isFinite(this.lp[n].x+this.lp[n].y+this.lp[n].z)){this.init=false;for(let i=0;i<=n;i++)this.lp[i].copy(rest[i])}
    this.fit()}
}
export class Cloth{ // rest: local points, row-major [r*cols+c]; top row is pinned to the frame
  constructor(frame,rest,cols,rows,o={}){
    this.f=frame;this.rest=rest;this.cols=cols;this.rows=rows;const N=this.N=rest.length,O=this.o=Object.assign({grav:16,damp:.965,stiff:.012,iter:3,color:()=>'#fff',coll:null},o);
    this.rw=rest.map(()=>new T.Vector3());this.p=rest.map(()=>new T.Vector3());this.pv=rest.map(()=>new T.Vector3());this.lp=rest.map(v=>v.clone());this.links=[];this.pinned=rest.map((_,i)=>O.pin?!!O.pin(i):i<cols);   // pin(i)->bool: which particles follow the frame rigidly (default: top row)
    const id=(r,c)=>r*cols+c;for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){if(c<cols-1)this.links.push([id(r,c),id(r,c+1)]);if(r<rows-1){this.links.push([id(r,c),id(r+1,c)]);
      if(c<cols-1){this.links.push([id(r,c),id(r+1,c+1)]);this.links.push([id(r,c+1),id(r+1,c)])}}}
    this.tl=this.links.map(()=>0);const cl=new Float32Array(N*3),idx=[];
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){paint(cl,id(r,c),O.color(r,c));if(r<rows-1&&c<cols-1){idx.push(id(r,c),id(r+1,c),id(r,c+1),id(r,c+1),id(r+1,c),id(r+1,c+1))}}
    const g=this.geo=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(N*3),3));g.setAttribute('color',new T.BufferAttribute(cl,3));g.setIndex(idx);
    this.mesh=new T.Mesh(g,VM);this.mesh.frustumCulled=false;frame.add(this.mesh);this.init=false;this._f=(_cn++)&1;this.write();
    const C=O.coll;this.colls=C?(typeof C[0][0]==='number'?[C]:C).map(([c,r])=>({c:new T.Vector3(...c),r:new T.Vector3(...r)})):[];   // list of ellipsoid colliders (centre, radii) in the frame's local space
  }
  write(noNorm){const a=this.geo.attributes.position.array;this.lp.forEach((v,i)=>{a[i*3]=v.x;a[i*3+1]=v.y;a[i*3+2]=v.z});this.geo.attributes.position.needsUpdate=true;if(!noNorm)this.geo.computeVertexNormals()}
  step(dt){dt=Math.min(dt,1/30);if(!(dt>0))return;
    const red=PHYS.reduce;   // Settings > Graphics > Reduce physics
    const f=this.f,{rw,p,pv,rest,cols,N,o}=this;f.updateWorldMatrix(true,false);const Mx=f.matrixWorld,sc=_s.setFromMatrixScale(Mx).x;
    for(let i=0;i<N;i++)rw[i].copy(rest[i]).applyMatrix4(Mx);
    if(!this.init||p[N-1].distanceTo(rw[N-1])>3*sc){for(let i=0;i<N;i++){p[i].copy(rw[i]);pv[i].copy(rw[i])}this.init=true}
    const f60=dt*60,damp=Math.pow(o.damp,f60),k=1-Math.pow(1-o.stiff,f60);
    const pn=this.pinned;for(let i=0;i<N;i++){if(pn[i])continue;const q=p[i],pr=pv[i],vx=(q.x-pr.x)*damp,vy=(q.y-pr.y)*damp,vz=(q.z-pr.z)*damp;pr.copy(q);q.x+=vx;q.y+=vy-o.grav*sc*dt*dt;q.z+=vz;q.lerp(rw[i],k)}
    for(let i=0;i<N;i++)if(pn[i]){p[i].copy(rw[i]);pv[i].copy(rw[i])}
    this.links.forEach(([a,b],i)=>this.tl[i]=rw[a].distanceTo(rw[b]));
    for(let it=0,nit=red?1:o.iter;it<nit;it++)this.links.forEach(([a,b],i)=>{const A=p[a],B=p[b],d=_d.subVectors(B,A),l=d.length()||1e-6,df=(l-this.tl[i])/l;
      if(pn[a]&&pn[b])return;if(pn[a])B.addScaledVector(d,-df);else if(pn[b])A.addScaledVector(d,df);else{B.addScaledVector(d,-df*.5);A.addScaledVector(d,df*.5)}});
    _i.copy(Mx).invert();
    for(let i=0;i<N;i++){const v=this.lp[i].copy(p[i]).applyMatrix4(_i);
      if(!pn[i]&&this.colls.length){let hit=false;for(let pass=0;pass<(red?1:2);pass++)for(const e of this.colls){_n.copy(v).sub(e.c).divide(e.r);const l=_n.length();if(l<1&&l>1e-4){v.copy(_n).divideScalar(l).multiply(e.r).add(e.c);hit=true}}
        if(hit)p[i].copy(v).applyMatrix4(Mx)}}
    if(!isFinite(this.lp[N-1].x+this.lp[N-1].y)){this.init=false;this.lp.forEach((v,i)=>v.copy(rest[i]))}
    this.write(red&&(this._f^=1)===1)}   // reduced: normals only every other step
}
// A tube that follows a list of points every frame (used for the hood's trim, which rides on the cloth's edge particles).
export class Tube{
  constructor(frame,n,radius,nR,material,o={}){
    this.n=n-1;this.nR=nR;this.r=radius;this.ref=new T.Vector3(...(o.ref||[1,0,0]));
    const pos=new Float32Array(n*(nR+1)*3),idx=[];
    for(let i=0;i<n-1;i++)for(let j=0;j<nR;j++){const a=i*(nR+1)+j,b=(i+1)*(nR+1)+j;idx.push(a,a+1,b,b,a+1,b+1)}
    const g=this.geo=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));g.setIndex(idx);
    this.mesh=new T.Mesh(g,material);this.mesh.frustumCulled=false;frame.add(this.mesh);
  }
  set(P){const n=this.n,nR=this.nR,pos=this.geo.attributes.position.array;
    for(let i=0;i<=n;i++){_t.subVectors(P[Math.min(i+1,n)],P[Math.max(i-1,0)]).normalize();
      _n.copy(this.ref).addScaledVector(_t,-this.ref.dot(_t));if(_n.lengthSq()<1e-6)_n.set(0,0,1).addScaledVector(_t,-_t.z);_n.normalize();_b.crossVectors(_t,_n);
      for(let j=0;j<=nR;j++){const a=j/nR*6.2832,c=Math.cos(a)*this.r,s=Math.sin(a)*this.r,k=(i*(nR+1)+j)*3;pos[k]=P[i].x+_n.x*c+_b.x*s;pos[k+1]=P[i].y+_n.y*c+_b.y*s;pos[k+2]=P[i].z+_n.z*c+_b.z*s}}
    this.geo.attributes.position.needsUpdate=true;this.geo.computeVertexNormals()}
}
