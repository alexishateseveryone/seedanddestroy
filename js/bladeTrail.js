// Blade trail for melee weapons: a glowing swept ribbon that follows the real blade (tip -> mid -> base), tapering and fading as it ages,
// plus hot sparks flung off the tip while the blade is moving fast. Pure procedural geometry, additive, world-space (it stays in the air when you move).
// The blade extent is measured from the weapon's own meshes, so it works for any melee model (sword, dual daggers, spear ...).
import * as T from 'three';
const N=26,LIFE=.26,PN=40;
const glowTex=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.4,'rgba(255,255,255,.5)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,64,64);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t})();
const rnd=(a,b)=>a+Math.random()*(b-a),_m=new T.Matrix4(),_v=new T.Vector3(),_b=new T.Box3();

// how far the weapon reaches from the grip and along which local axis (the blade / shaft axis)
function span(node){
  node.updateWorldMatrix(true,true);const inv=new T.Matrix4().copy(node.matrixWorld).invert();_b.makeEmpty();
  node.traverse(o=>{if(!(o.isMesh&&o.geometry))return;if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();const bb=o.geometry.boundingBox;_m.multiplyMatrices(inv,o.matrixWorld);
    for(const x of[bb.min.x,bb.max.x])for(const y of[bb.min.y,bb.max.y])for(const z of[bb.min.z,bb.max.z])_b.expandByPoint(_v.set(x,y,z).applyMatrix4(_m))});
  if(_b.isEmpty())return null;
  const mn=_b.min.toArray(),mx=_b.max.toArray(),ext=mn.map((a,i)=>Math.max(Math.abs(a),Math.abs(mx[i]))),ax=ext.indexOf(Math.max(...ext)),sg=Math.abs(mx[ax])>=Math.abs(mn[ax])?1:-1,L=ext[ax];
  const ctr=_b.getCenter(new T.Vector3()),tip=ctr.clone();tip.setComponent(ax,sg*L);
  const base=tip.clone();base.setComponent(ax,sg*L*.38);                       // the sweep covers the outer 62% of the weapon
  return{tip,base,len:L}}

export class BladeTrail{
  constructor(root){
    this.root=root;this.node=null;this.tipL=new T.Vector3();this.baseL=new T.Vector3();this.on=false;this.s=[];this.prev=null;this.sp=[];
    this.col=new T.Color('#fff3c4');this.core=new T.Color('#ffffff');this.inv=new T.Matrix4();
    const g=this.geo=new T.BufferGeometry(),pos=new Float32Array(N*3*3),col=new Float32Array(N*3*4),idx=[];
    for(let i=0;i<N-1;i++)for(let r=0;r<2;r++){const a=i*3+r,b=(i+1)*3+r;idx.push(a,b,a+1,a+1,b,b+1)}
    g.setAttribute('position',new T.BufferAttribute(pos,3));g.setAttribute('color',new T.BufferAttribute(col,4));g.setIndex(idx);g.setDrawRange(0,0);
    this.mesh=new T.Mesh(g,new T.MeshBasicMaterial({vertexColors:true,transparent:true,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide}));this.mesh.frustumCulled=false;this.mesh.renderOrder=6;root.add(this.mesh);
    const pg=this.pg=new T.BufferGeometry();pg.setAttribute('position',new T.BufferAttribute(new Float32Array(PN*3),3));pg.setAttribute('color',new T.BufferAttribute(new Float32Array(PN*4),4));
    this.pts=new T.Points(pg,new T.PointsMaterial({size:.17,map:glowTex,vertexColors:true,transparent:true,blending:T.AdditiveBlending,depthWrite:false,sizeAttenuation:true}));this.pts.frustumCulled=false;this.pts.renderOrder=7;root.add(this.pts);
    for(let i=0;i<PN;i++)this.sp.push({p:new T.Vector3(),v:new T.Vector3(),life:0,max:1});
  }
  clear(){this.node=null;this.s.length=0;this.prev=null;this.geo.setDrawRange(0,0)}
  setBlade(node,color,core='#ffffff'){const sp=span(node);if(!sp){this.clear();return}this.node=node;this.tipL.copy(sp.tip);this.baseL.copy(sp.base);this.col.set(color);this.core.set(core);this.s.length=0;this.prev=null}
  update(dt,active){
    if(!this.node){return}
    const root=this.root;
    if(active||this.s.length||this.sp.some(p=>p.life>0)){root.updateWorldMatrix(true,true);this.inv.copy(root.matrixWorld).invert()}
    // ---- sample the blade this frame
    if(active){const t=this.node.localToWorld(this.tipL.clone()),b=this.node.localToWorld(this.baseL.clone());this.s.push({t,b,age:0});if(this.s.length>N)this.s.shift();
      if(this.prev){const sp=t.distanceTo(this.prev)/Math.max(dt,1e-3);if(sp>5)for(let k=0;k<(sp>12?2:1);k++)this.emit(t,this.prev,sp)}this.prev=t.clone()}
    else this.prev=null;
    // ---- age + rebuild the ribbon
    for(const s of this.s)s.age+=dt;while(this.s.length&&this.s[0].age>LIFE)this.s.shift();
    const P=this.geo.attributes.position.array,C=this.geo.attributes.color.array,n=this.s.length;
    for(let i=0;i<n;i++){const s=this.s[i],a=Math.pow(Math.max(0,1-s.age/LIFE),1.5),w=.3+.7*a,
      T0=_v.copy(s.t),B=s.b;const tx=s.t.x,ty=s.t.y,tz=s.t.z,bx=tx+(B.x-tx)*w,by=ty+(B.y-ty)*w,bz=tz+(B.z-tz)*w,mx=tx+(B.x-tx)*w*.3,my=ty+(B.y-ty)*w*.3,mz=tz+(B.z-tz)*w*.3;
      const q=[[tx,ty,tz],[mx,my,mz],[bx,by,bz]],al=[a,a*.75,0],cl=[this.core,this.col,this.col];
      for(let r=0;r<3;r++){_v.set(q[r][0],q[r][1],q[r][2]).applyMatrix4(this.inv);const o=(i*3+r);P[o*3]=_v.x;P[o*3+1]=_v.y;P[o*3+2]=_v.z;C[o*4]=cl[r].r;C[o*4+1]=cl[r].g;C[o*4+2]=cl[r].b;C[o*4+3]=al[r]}}
    this.geo.setDrawRange(0,n>1?(n-1)*12:0);this.geo.attributes.position.needsUpdate=true;this.geo.attributes.color.needsUpdate=true;
    // ---- sparks
    const SP=this.pg.attributes.position.array,SC=this.pg.attributes.color.array;
    for(let i=0;i<PN;i++){const p=this.sp[i];
      if(p.life>0){p.life-=dt;p.v.multiplyScalar(Math.exp(-1.6*dt));p.v.y-=7*dt;p.p.addScaledVector(p.v,dt)}
      const k=Math.max(0,p.life/p.max);_v.copy(p.p).applyMatrix4(this.inv);SP[i*3]=_v.x;SP[i*3+1]=_v.y;SP[i*3+2]=_v.z;
      const hot=k>.5?1:k*2;SC[i*4]=1;SC[i*4+1]=.75+.25*hot;SC[i*4+2]=.45+.55*hot;SC[i*4+3]=p.life>0?Math.min(1,k*1.6):0}
    this.pg.attributes.position.needsUpdate=true;this.pg.attributes.color.needsUpdate=true}
  emit(t,prev,sp){const p=this.sp.find(s=>s.life<=0);if(!p)return;p.p.copy(t);p.v.copy(t).sub(prev).normalize().multiplyScalar(sp*.12).add(_v.set(rnd(-2,2),rnd(.3,2.5),rnd(-2,2)));p.max=p.life=rnd(.22,.46)}
}
