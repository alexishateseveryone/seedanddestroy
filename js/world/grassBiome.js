// GRASS for the generated worlds: short grass + TALL grass in one file.
//   const grass=createBiomeGrass(env);
//   grass.scatter({kind:'short'|'tall', x0,z0,x1,z1, rng, at(x,z)->y, density(x,z)->0..1, tint(x,z,colour), tries, max, clump}) -> InstancedMesh | null
//   grass.dispose(mesh)
// v2 - thin, plentiful and still cheap:
// - Blades are THIN, tapered to a point, with a dark-root -> bright-tip gradient and soft (mostly upward) normals: lots of fine blades instead of a few fat ones.
// - Scatter is stratified (one jittered sample per grid cell) so tufts never clump into bald spots, and `clump` (0..1) modulates density with
//   a slow noise so the meadow has natural patches instead of an even carpet.
// - Distance LOD happens in the vertex shader (no extra meshes, no CPU work): between THIN_NEAR and THIN_FAR a growing share of the tufts shrinks to
//   nothing (degenerate triangles cost almost nothing) and the survivors get wider, so the field keeps the same look but costs far less.
//   Blades also stop swaying beyond SWAY_FAR.
// - density() still returns 0..1: below 1 the tuft is thinned AND shrunk, so patches fade softly at the edge of a biome / river / path.
import * as T from 'three';
import {WIND,vnoise} from '../batch.js';

export const SWAY_NEAR=14,SWAY_FAR=30;
export const THIN_NEAR=22,THIN_FAR=62;     // grass thinning distances (world units from the player)

function bladeTuft({blades,height,width,spread,lean,seg,seed}){
  let s=seed|0;const R=()=>{s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
  const pos=[],nor=[],col=[],idx=[];let o=0;
  for(let b=0;b<blades;b++){
    const a=R()*6.283,rr=Math.sqrt(R())*spread,ox=Math.cos(a)*rr,oz=Math.sin(a)*rr,w=width*(.7+R()*.6),ang=R()*6.283,ln=lean*(.35+R()*.9),
      hh=height*(.55+R()*.45),cx=Math.cos(ang),cz=Math.sin(ang),start=o,tone=.85+R()*.3,nl=Math.hypot(cz*.45,1,cx*.45);
    for(let i=0;i<=seg;i++){
      const t=i/seg,ww=i===seg?0:w*(1-Math.pow(t,1.6)*.85),y=t*hh,f=ln*t*t,shade=(.3+.8*Math.pow(t,.8))*tone;   // tapered width, curved lean, dark root -> light tip
      for(const sx of i===seg?[0]:[-1,1]){const lx=sx*ww,lz=f;pos.push(ox+lx*cx+lz*cz,y,oz-lx*cz+lz*cx);nor.push(cz*.45/nl,1/nl,cx*.45/nl);col.push(shade,shade,shade);o++}}
    // triangulate the strip: rings of 2 verts, then the single tip vertex
    let r=start;for(let i=0;i<seg;i++){const a0=r,a1=r+1;if(i<seg-1){const b0=r+2,b1=r+3;idx.push(a0,a1,b0,b0,a1,b1);r+=2}else idx.push(a0,a1,r+2)}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(nor,3));g.setAttribute('color',new T.Float32BufferAttribute(col,3));g.setIndex(idx);return g}

/** wind material shared by grass and flowers. rigid: the whole instance moves like its tip (flower heads), colours: use per-vertex colours,
 *  thin: enable the distance thinning (grass only - flowers keep their old behaviour) */
export function swayMaterial({amp=1,push=.5,env=null,tall=false,rigid=false,colors=true,roughness=.9,color=undefined,thin=false}={}){
  const m=new T.MeshStandardMaterial({vertexColors:colors,roughness,side:T.DoubleSide,envMap:env,envMapIntensity:.4,...(color?{color}:{})});
  m.onBeforeCompile=sh=>{sh.uniforms.uTime=WIND.uTime;sh.uniforms.uPlayer=WIND.uPlayer;sh.uniforms.uSwayNear={value:SWAY_NEAR};sh.uniforms.uSwayFar={value:SWAY_FAR};sh.uniforms.uAmp={value:amp};
    sh.uniforms.uThinNear={value:THIN_NEAR};sh.uniforms.uThinFar={value:THIN_FAR};
    sh.vertexShader=sh.vertexShader.replace('#include <common>',`#include <common>
      uniform float uTime,uSwayNear,uSwayFar,uAmp,uThinNear,uThinFar;uniform vec3 uPlayer;`)
    .replace('#include <project_vertex>',`
      vec4 mvPosition=vec4(transformed,1.);
      #ifdef USE_INSTANCING
        mvPosition=instanceMatrix*mvPosition;
      #endif
      {vec3 ip=vec3(instanceMatrix[3][0],0.,instanceMatrix[3][2]);
       float w=${rigid?'1.':`clamp(position.y/${tall?'1.6':'1.0'},0.,1.)`};w=w*w;
       vec2 d=ip.xz-uPlayer.xz;float l=length(d);
       ${thin?`
       float hs=fract(sin(dot(ip.xz,vec2(12.9898,78.233)))*43758.5453);          // stable per-tuft random number
       float tf=smoothstep(uThinNear,uThinFar,l);
       float vis=1.-smoothstep(1.1-.9*tf-.1,1.1-.9*tf,hs);                       // far away most tufts shrink away one by one
       mvPosition.xz=ip.xz+(mvPosition.xz-ip.xz)*(1.+.9*tf)*vis;                  // survivors get wider to keep the field looking full
       mvPosition.y=instanceMatrix[3][1]+(mvPosition.y-instanceMatrix[3][1])*vis*(1.-.25*tf);`:''}
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
  m.customProgramCacheKey=()=>'biomeGrass2'+amp+'_'+push+'_'+tall+'_'+rigid+'_'+thin;return m}

export function createBiomeGrass(env=null){
  // many thin blades per tuft = full-looking grass without fat triangles. Blade count / width are the knobs for "thickness".
  const KIND={
    short:{geo:bladeTuft({blades:9,height:.85,width:.03,spread:.2,lean:.24,seg:3,seed:5}),mat:swayMaterial({amp:1,push:.55,env,thin:true}),
      h:[.4,.95],w:[.8,1.15]},
    tall:{geo:bladeTuft({blades:7,height:1.6,width:.04,spread:.24,lean:.6,seg:4,seed:11}),mat:swayMaterial({amp:1.5,push:.65,env,tall:true,thin:true}),
      h:[.7,1.15],w:[.8,1.2]}};
  const d=new T.Object3D(),c=new T.Color();
  /** tries = roughly how many tufts are attempted (stratified over the rectangle); max = instance buffer size; clump 0..1 = strength of the natural patchiness */
  function scatter({kind='short',x0,z0,x1,z1,rng,at,density=()=>1,tint,tries=800,max=800,clump=.45}){
    const K=KIND[kind],m=new T.InstancedMesh(K.geo,K.mat,max),cs=Math.sqrt((x1-x0)*(z1-z0)/Math.max(1,tries)),
      nx=Math.max(1,Math.ceil((x1-x0)/cs)),nz=Math.max(1,Math.ceil((z1-z0)/cs)),sx=(x1-x0)/nx,sz=(z1-z0)/nz;let n=0;
    for(let i=0;i<nx&&n<max;i++)for(let j=0;j<nz&&n<max;j++){
      const x=x0+(i+rng())*sx,z=z0+(j+rng())*sz;let dn=density(x,z);if(dn<=0.02)continue;
      if(clump>0)dn*=1-clump+clump*Math.min(1,Math.max(0,(vnoise(x*.11+3.1,z*.11)-.25)/.5));        // slow noise: meadow patches
      if(rng()>dn)continue;
      const s=(.65+rng()*.7)*(.35+.65*Math.min(1,dn)),hs=K.h[0]+(K.h[1]-K.h[0])*rng();                    // thinner edge => smaller tufts
      d.position.set(x,at(x,z),z);d.scale.set(s*(K.w[0]+rng()*(K.w[1]-K.w[0])),hs*s*(kind==='tall'?1.1:1),s*(K.w[0]+rng()*(K.w[1]-K.w[0])));d.rotation.set(0,rng()*6.283,0);d.updateMatrix();
      m.setMatrixAt(n,d.matrix);tint(x,z,c,rng);m.setColorAt(n,c);n++}
    if(!n){m.dispose();return null}
    m.count=n;m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;m.receiveShadow=true;
    m.computeBoundingSphere();m.userData.n=n;m.userData.kind=kind;return m}
  return{scatter,dispose:m=>{if(m)m.dispose()}};
}
