// GRASS for the generated worlds: short grass + TALL grass in one file.
//   const grass=createBiomeGrass(env);
//   grass.scatter({kind:'short'|'tall', x0,z0,x1,z1, rng, at(x,z)->y, density(x,z)->0..1, tint(x,z,colour), tries, max}) -> InstancedMesh | null
//   grass.dispose(mesh)
// - Blades are smooth: several segments with a rounded width profile and a curved lean (no hard triangles).
// - Colour is per instance and comes from tint(), which the map feeds from the ground colour of the biome under the tuft (savanna = golden).
// - density() returns 0..1: below 1 the tuft is thinned AND shrunk, so patches fade out softly at the edge of a biome / river / path.
// - Swaying is switched off with distance: beyond SWAY_FAR the vertex shader skips the wind code completely (cheap), and it fades in between.
import * as T from 'three';
import {WIND} from '../batch.js';

export const SWAY_NEAR=14,SWAY_FAR=30;

function bladeTuft({blades,height,width,spread,lean,seg,seed}){
  let s=seed|0;const R=()=>{s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
  const pos=[],nor=[],col=[],idx=[];let o=0;
  for(let b=0;b<blades;b++){
    const a=R()*6.283,rr=R()*spread,ox=Math.cos(a)*rr,oz=Math.sin(a)*rr,w=width*(.75+R()*.5),ang=R()*6.283,ln=lean*(.4+R()*.8),hh=height*(.7+R()*.3),cx=Math.cos(ang),cz=Math.sin(ang),start=o;
    for(let i=0;i<=seg;i++){
      const t=i/seg,ww=i===seg?0:w*(Math.sin((1-t*t)*1.5707)*.9+.1*(1-t)),y=t*hh,f=ln*t*t,shade=.35+.8*t;           // rounded width profile, curved lean
      for(const sx of i===seg?[0]:[-1,1]){const lx=sx*ww,lz=f;pos.push(ox+lx*cx+lz*cz,y,oz-lx*cz+lz*cx);nor.push(-cz*.3,1,cx*.3);col.push(shade,shade,shade);o++}}
    // triangulate the strip: rings of 2 verts, then the single tip vertex
    let r=start;for(let i=0;i<seg;i++){const a0=r,a1=r+1;if(i<seg-1){const b0=r+2,b1=r+3;idx.push(a0,a1,b0,b0,a1,b1);r+=2}else idx.push(a0,a1,r+2)}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(nor,3));g.setAttribute('color',new T.Float32BufferAttribute(col,3));g.setIndex(idx);return g}

/** wind material shared by grass and flowers. rigid: the whole instance moves like its tip (flower heads), colours: use per-vertex colours */
export function swayMaterial({amp=1,push=.5,env=null,tall=false,rigid=false,colors=true,roughness=.9,color=undefined}={}){
  const m=new T.MeshStandardMaterial({vertexColors:colors,roughness,side:T.DoubleSide,envMap:env,envMapIntensity:.4,...(color?{color}:{})});
  m.onBeforeCompile=sh=>{sh.uniforms.uTime=WIND.uTime;sh.uniforms.uPlayer=WIND.uPlayer;sh.uniforms.uSwayNear={value:SWAY_NEAR};sh.uniforms.uSwayFar={value:SWAY_FAR};sh.uniforms.uAmp={value:amp};
    sh.vertexShader=sh.vertexShader.replace('#include <common>',`#include <common>
      uniform float uTime,uSwayNear,uSwayFar,uAmp;uniform vec3 uPlayer;`)
    .replace('#include <project_vertex>',`
      vec4 mvPosition=vec4(transformed,1.);
      #ifdef USE_INSTANCING
        mvPosition=instanceMatrix*mvPosition;
      #endif
      {vec3 ip=vec3(instanceMatrix[3][0],0.,instanceMatrix[3][2]);
       float w=${rigid?'1.':`clamp(position.y/${tall?'1.6':'1.0'},0.,1.)`};w=w*w;
       vec2 d=ip.xz-uPlayer.xz;float l=length(d);
       float sw=1.-smoothstep(uSwayNear,uSwayFar,l);                       // far away: no wind at all
       if(sw>0.001){
         float t=uTime*1.7+ip.x*.43+ip.z*.31;
         float gust=.5+.5*sin(uTime*.35+ip.x*.07+ip.z*.05);
         float k=sw*uAmp*w*(.55+.9*gust);
         mvPosition.x+=(sin(t)*.10+sin(t*2.6+ip.z)*.03)*k;
         mvPosition.z+=(cos(t*.8+ip.x*.2)*.07+sin(t*2.1+ip.x)*.02)*k;
       }
       float pu=smoothstep(1.5,.15,l);
       mvPosition.xz+=d/(l+1e-3)*pu*w*${push.toFixed(2)};mvPosition.y-=pu*w*.28;}
      mvPosition=modelViewMatrix*mvPosition;
      gl_Position=projectionMatrix*mvPosition;`)};
  m.customProgramCacheKey=()=>'biomeGrass'+amp+'_'+push+'_'+tall+'_'+rigid;return m}

export function createBiomeGrass(env=null){
  const KIND={
    short:{geo:bladeTuft({blades:7,height:.8,width:.05,spread:.17,lean:.22,seg:3,seed:5}),mat:swayMaterial({amp:1,push:.55,env}),
      h:[.34,.8],w:[.75,1.1],mult:1},
    tall:{geo:bladeTuft({blades:6,height:1.5,width:.06,spread:.2,lean:.55,seg:5,seed:11}),mat:swayMaterial({amp:1.5,push:.65,env,tall:true}),
      h:[.7,1.15],w:[.8,1.2],mult:.4}};
  const d=new T.Object3D(),c=new T.Color();
  function scatter({kind='short',x0,z0,x1,z1,rng,at,density=()=>1,tint,tries=800,max=800}){
    const K=KIND[kind],m=new T.InstancedMesh(K.geo,K.mat,max);let n=0;
    for(let k=0;k<tries&&n<max;k++){
      const x=x0+rng()*(x1-x0),z=z0+rng()*(z1-z0),dn=density(x,z);if(dn<=0.02||rng()>dn)continue;
      const s=(.65+rng()*.7)*(.35+.65*dn),hs=K.h[0]+(K.h[1]-K.h[0])*rng();                                   // thinner edge => smaller tufts
      d.position.set(x,at(x,z),z);d.scale.set(s*(K.w[0]+rng()*(K.w[1]-K.w[0])),hs*s*(kind==='tall'?1.1:1),s*(K.w[0]+rng()*(K.w[1]-K.w[0])));d.rotation.set(0,rng()*6.283,0);d.updateMatrix();
      m.setMatrixAt(n,d.matrix);tint(x,z,c,rng);m.setColorAt(n,c);n++}
    if(!n){m.dispose();return null}
    m.count=n;m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;m.receiveShadow=true;
    m.computeBoundingSphere();m.userData.n=n;m.userData.kind=kind;return m}
  return{scatter,dispose:m=>{if(m)m.dispose()}};
}
