// Static scenery batching + wind shaders.
//  - Batch: collects hundreds of trees / rocks / bushes as world-space pieces with baked per-vertex colour (painterly variation,
//    height gradients, moss) and wind attributes, then emits 3-4 merged meshes. The whole forest costs a handful of draw calls.
//  - windify(): vertex sway for the baked foliage.  windGrass(): instanced grass/flowers that sway and bend away from the player.
import * as T from 'three';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';

export const WIND={uTime:{value:0},uPlayer:{value:new T.Vector3(1e5,0,1e5)}};

export const hash=(x,y=0,z=0)=>{const h=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453;return h-Math.floor(h)};
const sm=t=>t*t*(3-2*t);
export function vnoise(x,y=0,z=0){const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z),fx=sm(x-ix),fy=sm(y-iy),fz=sm(z-iz),L=(a,b,t)=>a+(b-a)*t;
  const c=(dx,dy,dz)=>hash(ix+dx,iy+dy,iz+dz);
  return L(L(L(c(0,0,0),c(1,0,0),fx),L(c(0,1,0),c(1,1,0),fx),fy),L(L(c(0,0,1),c(1,0,1),fx),L(c(0,1,1),c(1,1,1),fx),fy),fz)}
export const fbm3=(x,y,z)=>vnoise(x,y,z)*.55+vnoise(x*2.1,y*2.1,z*2.1)*.3+vnoise(x*4.3,y*4.3,z*4.3)*.15;

// ------------------------------------------------------------------------------------------------ wind shaders
export function windify(m,{amp=1,flutter=1}={}){
  m.onBeforeCompile=sh=>{sh.uniforms.uTime=WIND.uTime;sh.uniforms.uAmp={value:amp};sh.uniforms.uFlutter={value:flutter};
    sh.vertexShader=sh.vertexShader.replace('#include <common>',`#include <common>
      attribute vec2 aWind;uniform float uTime,uAmp,uFlutter;`)
    .replace('#include <begin_vertex>',`#include <begin_vertex>
      {float wv=aWind.y*uAmp,t=uTime*1.25+aWind.x;
       transformed.x+=(sin(t)+.55*sin(t*2.3+position.z*.35))*wv*.075;
       transformed.z+=(cos(t*.93+position.x*.3)+.4*sin(t*1.9))*wv*.055;
       transformed.y+=sin(t*2.1+position.x)*wv*.012;
       transformed.xyz+=vec3(sin(t*5.+position.y*2.7),sin(t*4.3+position.x*3.1),cos(t*4.7+position.z*2.9))*wv*.02*uFlutter;}`)};
  m.customProgramCacheKey=()=>'windify'+amp+'_'+flutter;return m}

export function windGrass(m,{push=.55}={}){
  m.onBeforeCompile=sh=>{sh.uniforms.uTime=WIND.uTime;sh.uniforms.uPlayer=WIND.uPlayer;
    sh.vertexShader=sh.vertexShader.replace('#include <common>',`#include <common>
      uniform float uTime;uniform vec3 uPlayer;`)
    .replace('#include <project_vertex>',`
      vec4 mvPosition=vec4(transformed,1.);
      #ifdef USE_INSTANCING
        mvPosition=instanceMatrix*mvPosition;
      #endif
      {vec3 ip=vec3(instanceMatrix[3][0],0.,instanceMatrix[3][2]);
       float w=clamp(position.y,0.,1.);w=w*w;
       float t=uTime*1.7+ip.x*.43+ip.z*.31;
       float gust=.5+.5*sin(uTime*.35+ip.x*.07+ip.z*.05);
       mvPosition.x+=(sin(t)*.10+sin(t*2.6+ip.z)*.03)*w*(.55+.9*gust);
       mvPosition.z+=(cos(t*.8+ip.x*.2)*.07+sin(t*2.1+ip.x)*.02)*w*(.55+.9*gust);
       vec2 d=ip.xz-uPlayer.xz;float l=length(d);float pu=smoothstep(1.5,.15,l);
       mvPosition.xz+=d/(l+1e-3)*pu*w*${push.toFixed(2)};mvPosition.y-=pu*w*.28;}
      mvPosition=modelViewMatrix*mvPosition;
      gl_Position=projectionMatrix*mvPosition;`)};
  m.customProgramCacheKey=()=>'windGrass'+push;return m}

// ------------------------------------------------------------------------------------------------ batch
const _c=new T.Color(),_p=new T.Vector3(),_n=new T.Vector3(),_nm=new T.Matrix3();
export class Batch{
  constructor(){this.k={};this.mats={}}
  /** kind: 'foliage'|'bark'|'rock'|'prop'.  o.grad(x,y,z,nx,ny,nz)->colour multiplier in the part's local space.
   *  o.wind={base,span,gain,phase}: sway weight rises with world height above base over span. */
  add(kind,geo,matrix,color,o={}){
    let g=geo.clone();if(g.attributes.uv)g.deleteAttribute('uv');if(!g.index)g=mergeVertices(g);
    const P=g.attributes.position,N=g.attributes.normal,n=P.count,mult=new Float32Array(n);
    const mossT=o.moss?new Float32Array(n):null,mossC=o.moss?new T.Color(o.moss.col):null;
    for(let i=0;i<n;i++){mult[i]=o.grad?o.grad(P.getX(i),P.getY(i),P.getZ(i),N.getX(i),N.getY(i),N.getZ(i)):1;
      if(mossT)mossT[i]=o.moss.fn(P.getX(i),P.getY(i),P.getZ(i),N.getX(i),N.getY(i),N.getZ(i))}
    g.applyMatrix4(matrix);
    const col=new Float32Array(n*3),wd=new Float32Array(n*2),base=new T.Color(color),W=o.wind,vs=o.varS??.9,va=o.varA??.3;
    for(let i=0;i<n;i++){_p.fromBufferAttribute(g.attributes.position,i);
      const v=1-va*.5+va*fbm3(_p.x*vs,_p.y*vs,_p.z*vs),m=mult[i]*v;
      _c.copy(base);if(mossT)_c.lerp(mossC,mossT[i]);col[i*3]=_c.r*m;col[i*3+1]=_c.g*m;col[i*3+2]=_c.b*m;
      if(W){const t=Math.min(1,Math.max(0,(_p.y-W.base)/W.span));wd[i*2]=W.phase;wd[i*2+1]=Math.pow(t,1.6)*(W.gain??1)}}
    g.setAttribute('color',new T.BufferAttribute(col,3));g.setAttribute('aWind',new T.BufferAttribute(wd,2));
    (this.k[kind]??=[]).push(g)}
  /** build merged meshes. env: PMREM texture for ambient/reflection on the scenery. */
  build(env){const grp=new T.Group(),R={foliage:.82,bark:.95,rock:.88,prop:.8};
    for(const kind in this.k){const g=mergeGeometries(this.k[kind],false);this.k[kind].forEach(x=>x.dispose());
      const m=new T.MeshStandardMaterial({vertexColors:true,side:kind==='foliage'?T.DoubleSide:T.FrontSide,roughness:R[kind]??.9,metalness:0,envMap:env||null,envMapIntensity:kind==='foliage'?.7:.55});
      if(kind==='foliage')windify(m,{amp:1,flutter:1});else if(kind==='bark')windify(m,{amp:.35,flutter:0});
      const mesh=new T.Mesh(g,m);mesh.castShadow=true;mesh.receiveShadow=true;mesh.matrixAutoUpdate=false;mesh.name='batch-'+kind;grp.add(mesh)}
    this.k={};return grp}
}
export const mat4=(px,py,pz,sx=1,sy=sx,sz=sx,rx=0,ry=0,rz=0)=>new T.Matrix4().compose(_p.set(px,py,pz).clone(),new T.Quaternion().setFromEuler(new T.Euler(rx,ry,rz)),new T.Vector3(sx,sy,sz));

// smooth, indexed, lumpy sphere (for canopies, bushes, caps)
export function softLump(detail=2,amp=.2,seed=0){
  let g=new T.IcosahedronGeometry(1,detail);g.deleteAttribute('uv');g.deleteAttribute('normal');g=mergeVertices(g);const p=g.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),f=1+amp*(vnoise(x*1.7+seed,y*1.7,z*1.7)-.5)*2+amp*.5*(vnoise(x*4.1+seed,y*4.1,z*4.1)-.5)*2;p.setXYZ(i,x*f,y*f,z*f)}
  g.computeVertexNormals();return g}
