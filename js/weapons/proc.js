// Procedural modelling helpers for weapons (no boxes): smooth side-profile extrusions, lathes, tubes.
// Weapon space: the weapon points along -Y (u = distance forward = -y), width is X, "up" is +Z, the grip hangs at -Z.
import * as T from 'three';

export const metal=(c,r=.38,m=.55)=>new T.MeshStandardMaterial({color:c,roughness:r,metalness:m});
export const matte=(c,r=.75)=>new T.MeshStandardMaterial({color:c,roughness:r,metalness:.04});
export const glass=(c,o=.75)=>new T.MeshStandardMaterial({color:c,roughness:.1,metalness:.3,transparent:true,opacity:o});

// smooth normals that keep hard creases: average only face normals within `deg` of each other
export function crease(g,deg=40){
  const p=g.attributes.position,n=p.count,tri=n/3,cosT=Math.cos(deg*Math.PI/180);
  const fn=new Float32Array(tri*3),key=i=>Math.round(p.getX(i)*2000)+','+Math.round(p.getY(i)*2000)+','+Math.round(p.getZ(i)*2000),map=new Map();
  const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
  for(let f=0;f<tri;f++){
    a.fromBufferAttribute(p,f*3);b.fromBufferAttribute(p,f*3+1);c.fromBufferAttribute(p,f*3+2);
    b.sub(a);c.sub(a);b.cross(c);fn[f*3]=b.x;fn[f*3+1]=b.y;fn[f*3+2]=b.z;   // area-weighted
    for(let k=0;k<3;k++){const kk=key(f*3+k);(map.get(kk)||map.set(kk,[]).get(kk)).push(f)}
  }
  const out=new Float32Array(n*3),nf=new T.Vector3(),ng=new T.Vector3(),acc=new T.Vector3();
  for(let f=0;f<tri;f++){
    nf.set(fn[f*3],fn[f*3+1],fn[f*3+2]);const lf=nf.length()||1;
    for(let k=0;k<3;k++){acc.set(0,0,0);
      for(const h of map.get(key(f*3+k))){ng.set(fn[h*3],fn[h*3+1],fn[h*3+2]);const lh=ng.length()||1;if(nf.dot(ng)/(lf*lh)>cosT)acc.add(ng)}
      acc.normalize();out.set([acc.x,acc.y,acc.z],(f*3+k)*3)}
  }
  g.setAttribute('normal',new T.BufferAttribute(out,3));return g;
}

const smoothPts=(pts,div)=>{
  const c=new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(p[0],p[1],0)),true,'centripetal');
  const r=c.getPoints(pts.length*div).map(v=>new T.Vector2(v.x,v.y));r.pop();return r;
};

// Closed outline in the (u,v) plane -> extruded across the weapon's width, bevelled and softly shaded.
// pts: [[u,v],...]  w: width (X)   opts: smooth (subdivisions per point), bevel, holes
export function side(pts,w,o={}){
  const {smooth=0,bevel=.012,holes=null}=o;
  const outline=smooth?smoothPts(pts,smooth):pts.map(p=>new T.Vector2(p[0],p[1]));
  const sh=new T.Shape(outline);
  if(holes)holes.forEach(h=>sh.holes.push(new T.Path(smooth?smoothPts(h,smooth):h.map(p=>new T.Vector2(p[0],p[1])))));
  const depth=Math.max(.002,w-2*bevel);
  const g=new T.ExtrudeGeometry(sh,{depth,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:2,curveSegments:6,steps:1});
  const p=g.attributes.position;
  for(let i=0;i<p.count;i++){const a=p.getX(i),b=p.getY(i),c=p.getZ(i)-depth/2;p.setXYZ(i,c,-a,b)}   // (u,v,w) -> (x=w, y=-u, z=v)
  for(let i=0;i<p.count;i+=3){ // the axis swap mirrors the mesh: flip winding
    const x=p.getX(i+1),y=p.getY(i+1),z=p.getZ(i+1);p.setXYZ(i+1,p.getX(i+2),p.getY(i+2),p.getZ(i+2));p.setXYZ(i+2,x,y,z)}
  return crease(g);
}

// Solid of revolution along the barrel axis. prof: [[u,radius],...] ascending in u (ends are capped automatically)
export function lathe(prof,seg=20){
  const P=[[prof[0][0],0],...prof,[prof[prof.length-1][0],0]].map(([u,r])=>new T.Vector2(r,-u)).reverse();
  return new T.LatheGeometry(P,seg);
}
// tube through weapon-space points [[x,y,z],...]
export const tube=(pts,r,seg=24,rs=8)=>new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(p[0],p[1],p[2]))),seg,r,rs,false);
export const ring=(r,t,seg=14)=>{const g=new T.TorusGeometry(r,t,8,seg);g.rotateX(Math.PI/2);return g};   // wraps around the barrel axis

export const mk=(geo,m,par,pos=[0,0,0],rot=[0,0,0],scl=1)=>{
  const x=new T.Mesh(geo,m);x.position.set(pos[0],pos[1],pos[2]);x.rotation.set(rot[0],rot[1],rot[2]);
  if(typeof scl==='number')x.scale.setScalar(scl);else x.scale.set(scl[0],scl[1],scl[2]);par.add(x);return x;
};
export const muzzleTip=(g,u,v=0)=>{const t=new T.Object3D();t.position.set(0,-u,v);g.add(t);return t};