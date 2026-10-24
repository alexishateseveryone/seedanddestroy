// Shared building blocks: soft lumpy geometry + flat matte materials (no clay bump texture).
import * as T from 'three';
export const mix=(a,b,t)=>'#'+new T.Color(a).lerp(new T.Color(b),t).getHexString();
export function lumpy(geo,amp=.06,seed=0){
  const p=geo.attributes.position,v=new T.Vector3();
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);const l=v.length(),n=v.clone().normalize(),
    f=1+amp*(Math.sin(v.x*3.3+1.3+seed)*Math.sin(v.y*2.9+.4)+.8*Math.sin(v.z*3.7+2.1+seed));p.setXYZ(i,n.x*f*l,n.y*f*l,n.z*f*l)}
  geo.computeVertexNormals();return geo;
}
export const LUMP=lumpy(new T.SphereGeometry(1,24,16),.05,0), LUMP2=lumpy(new T.SphereGeometry(1,16,12),.08,2);
export const G={sph:new T.SphereGeometry(1,16,12),cone:new T.ConeGeometry(1,1,16),box:new T.BoxGeometry(1,1,1),cyl:new T.CylinderGeometry(1,1,1,16)};
const mc={},bc={};
export const mat=(c,r=.9)=>mc[c+r]||(mc[c+r]=new T.MeshStandardMaterial({color:c,roughness:r,metalness:0}));
export const BM=c=>bc[c]||(bc[c]=new T.MeshBasicMaterial({color:c}));
export function M(geo,m,s,p,parent){const o=new T.Mesh(geo,m);if(s)o.scale.set(...s);if(p)o.position.set(...p);if(parent)parent.add(o);return o}
export const eyes=(g,y,z,sp,r)=>[-1,1].forEach(s=>{M(G.sph,BM('#fff'),[r,r,r],[s*sp,y,z],g);M(G.sph,BM('#1a1420'),[r*.55,r*.55,r*.55],[s*sp,y,z+r*.6],g)});
export const shadow=(g,r)=>{const s=new T.Mesh(new T.CircleGeometry(r,24),new T.MeshBasicMaterial({color:'#000',transparent:true,opacity:.26,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3}));s.rotation.x=-Math.PI/2;s.position.y=.035;s.renderOrder=2;g.add(s);return s};
export const limb=(parent,x,y,z,len,w,color,tip)=>{const p=new T.Group();p.position.set(x,y,z);parent.add(p);M(LUMP2,mat(color),[w,len,w],[0,-len*.9,0],p);if(tip)M(LUMP2,mat(tip),[w*1.15,w*.8,w*1.4],[0,-len*1.85,w*.4],p);return p};