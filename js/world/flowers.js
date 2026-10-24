// FLOWERS: instanced stems + heads (own file). Palette comes from the biome, so a rainforest gets hot pinks / oranges, the savanna yellows.
//   const flowers=createFlowers(env);
//   flowers.scatter({x0,z0,x1,z1,rng,at,density,palette,tries,max})   palette = array of colours, or (x,z,rng)=>colour -> Group (userData.meshes = [stems,heads]) | null
//   flowers.dispose(group)
// They sway like the grass and, like the grass, stop swaying when the player is far away (see swayMaterial).
import * as T from 'three';
import {swayMaterial} from './grassBiome.js';

export function createFlowers(env=null){
  const stemG=new T.CylinderGeometry(.008,.012,1,4,1).translate(0,.5,0),
    headG=new T.IcosahedronGeometry(1,1),
    stemMat=swayMaterial({amp:1,push:.4,env,colors:false,rigid:false,color:'#4f9a45'}),
    headMat=swayMaterial({amp:1,push:.4,env,colors:false,rigid:true,roughness:.6}),
    d=new T.Object3D(),c=new T.Color();
  // a tiny centre disc makes every head read as a flower, not a ball
  const eyeG=new T.IcosahedronGeometry(1,0),eyeMat=swayMaterial({amp:1,push:.4,env,colors:false,rigid:true,color:'#ffcf3a'});
  function scatter({x0,z0,x1,z1,rng,at,density=()=>1,palette,tries=120,max=60}){
    const stems=new T.InstancedMesh(stemG,stemMat,max),heads=new T.InstancedMesh(headG,headMat,max),eyes=new T.InstancedMesh(eyeG,eyeMat,max);let n=0;
    for(let k=0;k<tries&&n<max;k++){
      const x=x0+rng()*(x1-x0),z=z0+rng()*(z1-z0),dn=density(x,z);if(dn<=0.02||rng()>dn)continue;
      const hh=(.2+rng()*.24)*(.6+.4*dn),y=at(x,z),hs=.055+rng()*.035;
      d.position.set(x,y,z);d.scale.set(1,hh,1);d.rotation.set(0,0,0);d.updateMatrix();stems.setMatrixAt(n,d.matrix);
      d.position.set(x,y+hh,z);d.scale.set(hs*1.1,hs*.55,hs*1.1);d.updateMatrix();heads.setMatrixAt(n,d.matrix);heads.setColorAt(n,c.set(typeof palette==='function'?palette(x,z,rng):palette[(rng()*palette.length)|0]));
      d.position.set(x,y+hh+hs*.35,z);d.scale.set(hs*.45,hs*.3,hs*.45);d.updateMatrix();eyes.setMatrixAt(n,d.matrix);eyes.setColorAt(n,c.set('#ffffff'));n++}
    if(!n){stems.dispose();heads.dispose();eyes.dispose();return null}
    const ms=[stems,heads,eyes];
    ms.forEach(m=>{m.count=n;m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;m.computeBoundingSphere();m.userData.n=n});
    const g=new T.Group();g.add(...ms);g.userData.meshes=ms;return g}
  return{scatter,dispose:g=>{if(g)g.userData.meshes.forEach(m=>m.dispose())}};
}
