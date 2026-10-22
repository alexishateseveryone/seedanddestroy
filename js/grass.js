// GRASS MODEL: swaying grass tufts + flowers as their own module, so any map can use them.
//   const grass=createGrass(env);
//   const mesh=grass.scatter({x0,z0,x1,z1,rng,at,accept,tries,max})     -> InstancedMesh (or null) covering the rectangle
//   const flowers=grass.flowers({x0,z0,x1,z1,rng,at,accept,tries,max})  -> Group with stems + heads (or null)
//   grass.dispose(mesh)  frees the per-instance buffers (the shared geometry / materials stay alive for the next chunk)
// Blades bend with the wind and away from the player (windGrass in batch.js). One tuft = 6 blades. Colour is per instance.
import * as T from 'three';
import {windGrass,vnoise} from './batch.js';

export function tuftGeometry(seed=5){
  let s=seed|0;const R=()=>{s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
  const pos=[],nor=[],cl=[],idx=[];let o=0;
  for(let b=0;b<6;b++){const a=R()*6.283,rr=R()*.16,ox=Math.cos(a)*rr,oz=Math.sin(a)*rr,w=.034+R()*.02,ang=R()*6.283,lean=.1+R()*.25,hh=.7+R()*.3,cx=Math.cos(ang),cz=Math.sin(ang);
    const V=[[-w,0,0],[w,0,0],[-w*.7,.5*hh,lean*.5],[w*.7,.5*hh,lean*.5],[0,hh,lean]],C=[.35,.35,.75,.75,1.1];     // C = darker at the root, lighter at the tip
    V.forEach((v,i)=>{pos.push(ox+v[0]*cx+v[2]*cz,v[1],oz-v[0]*cz+v[2]*cx);nor.push(-cz*.3,1,cx*.3);cl.push(C[i],C[i],C[i])});
    idx.push(o,o+1,o+2,o+2,o+1,o+3,o+2,o+3,o+4);o+=5}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(nor,3));g.setAttribute('color',new T.Float32BufferAttribute(cl,3));g.setIndex(idx);return g}

export function createGrass(env=null){
  const geo=tuftGeometry(),mat=windGrass(new T.MeshStandardMaterial({vertexColors:true,roughness:.9,side:T.DoubleSide,envMap:env,envMapIntensity:.4}));
  const stemG=new T.CylinderGeometry(.008,.012,1,4,1).translate(0,.5,0),headG=new T.IcosahedronGeometry(1,1),
    stemMat=windGrass(new T.MeshStandardMaterial({color:'#4f9a45',roughness:.9}),{push:.4}),
    headMat=windGrass(new T.MeshStandardMaterial({roughness:.6,envMap:env,envMapIntensity:.6}),{push:.4}),
    FC=['#ff7ab0','#ffe066','#ffffff','#b9a2ff','#ff9a3c'],d=new T.Object3D(),a=new T.Color(),b=new T.Color();
  // bounding sphere per mesh => the renderer skips tufts that are off screen
  const finish=m=>{if(m.computeBoundingSphere)m.computeBoundingSphere();else m.frustumCulled=false;m.userData.n=m.count;return m};

  function scatter({x0,z0,x1,z1,rng,at,accept=()=>true,tries=800,max=800}){
    const m=new T.InstancedMesh(geo,mat,max);let i=0;
    for(let k=0;k<tries&&i<max;k++){const x=x0+rng()*(x1-x0),z=z0+rng()*(z1-z0);if(!accept(x,z))continue;
      const clump=vnoise(x*.12,z*.12,3);if(rng()>.28+.85*clump)continue;const s=.6+rng()*.9+clump*.5;           // grows in clumps
      d.position.set(x,at(x,z),z);d.scale.set(s*.8*(.8+rng()*.5),s*.34*(.45+rng()*.45),s*.8*(.8+rng()*.5));d.rotation.set(0,rng()*6.283,0);d.updateMatrix();
      m.setMatrixAt(i,d.matrix);m.setColorAt(i,a.set('#3d8a38').lerp(b.set('#a6d65a'),rng()*.8+clump*.2));i++}
    if(!i){m.dispose();return null}
    m.count=i;m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;m.receiveShadow=true;return finish(m)}

  function flowers({x0,z0,x1,z1,rng,at,accept=()=>true,tries=120,max=60}){
    const stems=new T.InstancedMesh(stemG,stemMat,max),heads=new T.InstancedMesh(headG,headMat,max);let i=0;
    for(let k=0;k<tries&&i<max;k++){const x=x0+rng()*(x1-x0),z=z0+rng()*(z1-z0);if(!accept(x,z))continue;const hh=.22+rng()*.22,y=at(x,z);
      d.position.set(x,y,z);d.scale.set(1,hh,1);d.rotation.set(0,0,0);d.updateMatrix();stems.setMatrixAt(i,d.matrix);
      d.position.set(x,y+hh,z);d.scale.set(.06+rng()*.03,.045,.06+rng()*.03);d.updateMatrix();heads.setMatrixAt(i,d.matrix);heads.setColorAt(i,a.set(FC[(rng()*5)|0]));i++}
    if(!i){stems.dispose();heads.dispose();return null}
    stems.count=heads.count=i;stems.instanceMatrix.needsUpdate=heads.instanceMatrix.needsUpdate=true;if(heads.instanceColor)heads.instanceColor.needsUpdate=true;
    const g=new T.Group();g.add(finish(stems),finish(heads));g.userData.meshes=[stems,heads];return g}

  return{scatter,flowers,dispose:m=>{if(m)m.dispose()},
    /** dispose a flowers() group */
    disposeFlowers:g=>{if(g)g.userData.meshes.forEach(m=>m.dispose())}};
}
