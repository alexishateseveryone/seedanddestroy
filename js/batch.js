// Static scenery batching + wind shaders.
//  - Batch: collects hundreds of trees / rocks / bushes as world-space pieces with baked per-vertex colour (painterly variation,
//    height gradients, moss) and wind attributes, then emits 3-4 merged meshes. The whole forest costs a handful of draw calls.
//  - windify(): vertex sway for the baked foliage.  windGrass(): instanced grass/flowers that sway and bend away from the player.
import * as T from 'three';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';

export const WIND={uTime:{value:0},uPlayer:{value:new T.Vector3(1e5,0,1e5)},uFade:{value:new T.Vector4(1e5,1e5,1e5,0)},uDim:{value:new T.Vector3(1,1,1)}};   // uDim = colour multiplier for the unlit-style scenery shaders (foliage, grass): (1,1,1) by day, a dark blue tint at night (set every frame in main.js from atm.night)   // uFade = (x,y,z of the cat's body, 1 while a match is on): scenery between the camera and the cat turns see-through

// ------------------------------------------------------------------------------------------------ textures
// Put leaf.png, leaflong.png and stone.png in this folder (path is relative to the page that loads the game).
const TEX_PATH='assets/images/env/';
const LEAF_TINT=.85;   // 0 = show the PNG's own colours, 1 = use only its light/dark pattern and paint it with the tree's colour (keeps the autumn oranges)
const loadTex=(f,repeat=false)=>{const t=new T.TextureLoader().load(TEX_PATH+f);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;if(repeat)t.wrapS=t.wrapT=T.RepeatWrapping;return t};
export const TEX={leaf:loadTex('leaf.png'),needle:loadTex('pinetree.png',true),stone:loadTex('stone.png',true)};
for(const k of ['leaf','needle']){TEX[k].magFilter=T.NearestFilter;TEX[k].minFilter=T.NearestMipmapNearestFilter}   // crisp: you see the PNG's real pixels, no blur   // TEX.stone: use it on the stone terrain (see ground shader)

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
  m.defines=Object.assign(m.defines||{},{NO_OL:''});   // grass never gets the pixel outline
  m.onBeforeCompile=sh=>{sh.uniforms.uTime=WIND.uTime;sh.uniforms.uPlayer=WIND.uPlayer;sh.uniforms.uDim=WIND.uDim;
    // NIGHT: the grass is unlit, so it has to be dimmed explicitly (same uDim as the tree foliage, set every frame from atm.night)
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
      uniform vec3 uDim;`).replace('#include <dithering_fragment>',`gl_FragColor.rgb*=uDim;
      #include <dithering_fragment>`);
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
  m.customProgramCacheKey=()=>'windGrass_dim'+push;return m}

// SEE-THROUGH SCENERY: anything between the camera and the cat fades out with a smooth, soft-edged circle of real transparency (no dither / checker pattern), so you never lose the cat behind a trunk or canopy.
export function seeThrough(m){const w0=m.onBeforeCompile,k0=m.customProgramCacheKey;
  m.transparent=true;m.depthWrite=true;      // blended, but nearer pieces still hide farther ones, so a canopy does not turn into soup
  m.onBeforeCompile=sh=>{if(w0)w0.call(m,sh);sh.uniforms.uFade=WIND.uFade;
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
      uniform vec4 uFade;`)
    .replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
      float fadeA=1.;
      if(uFade.w>.5){vec4 pv=viewMatrix*vec4(uFade.xyz,1.);vec3 fv=-vViewPosition;
        if(pv.z<-.5&&fv.z<-.5){float d=length(fv.xy/-fv.z-pv.xy/-pv.z)*(-pv.z),front=smoothstep(.1,1.2,fv.z-pv.z);   // d = sideways distance from the cat (at the cat's depth), front = how far this piece is in front of it
          fadeA=1.-front*(1.-smoothstep(1.1,2.9,d))*.82;}}`)
    .replace('vec4 diffuseColor = vec4( diffuse, opacity );','vec4 diffuseColor = vec4( diffuse, opacity*fadeA );')};
  m.customProgramCacheKey=()=>(k0?k0.call(m):'')+'seeThru2';return m}

// TEXTURED LEAF CARDS: quads with leaf.png / leaflong.png. Cut-out by the PNG alpha (discard, so the see-through fade stays soft), swaying via windify.
function leafMaterial(kind,env){
  const m=new T.MeshStandardMaterial({map:TEX[kind],vertexColors:true,side:T.DoubleSide,roughness:.85,metalness:0,envMap:env||null,envMapIntensity:.35});
  const amp=kind==='needle'?.9:1.35,flut=kind==='needle'?.8:1.6;
  windify(m,{amp,flutter:flut});const w0=m.onBeforeCompile;
  m.onBeforeCompile=sh=>{w0(sh);sh.uniforms.uDim=WIND.uDim;
    const k=sh.fragmentShader.includes('#include <opaque_fragment>')?'#include <opaque_fragment>':'#include <output_fragment>';
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
      uniform vec3 uDim;`)
    .replace('#include <map_fragment>',`#ifdef USE_MAP
      vec4 tx=texture2D(map,vMapUv);if(tx.a<.45)discard;
      float lum=dot(tx.rgb,vec3(.3,.59,.11));
      diffuseColor.rgb*=mix(tx.rgb,vec3(lum*1.7),${LEAF_TINT.toFixed(2)});
      #endif`)
    .replace(k,`{vec3 up=normalize((viewMatrix*vec4(0.,1.,0.,0.)).xyz);float u=dot(normalize(normal),up);
      float tn=u>.2?1.1:.82;outgoingLight=mix(diffuseColor.rgb*tn,outgoingLight,.25);}
      outgoingLight*=uDim;
      `+k)};
  m.customProgramCacheKey=()=>'leafCard_'+kind+'_'+LEAF_TINT;return m}

// Shadow caster for leaf cards: same wind sway as the visible leaves + alpha cut-out from the PNG, so the shadow on the ground is the moving leaf shape.
function leafDepthMaterial(kind){
  const amp=kind==='needle'?.9:1.35,flut=kind==='needle'?.8:1.6;
  const d=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,map:TEX[kind],alphaTest:.45});
  d.onBeforeCompile=sh=>{sh.uniforms.uTime=WIND.uTime;
    sh.vertexShader=sh.vertexShader.replace('#include <common>',`#include <common>
      attribute vec2 aWind;uniform float uTime;`)
    .replace('#include <begin_vertex>',`#include <begin_vertex>
      {float wv=aWind.y*${amp.toFixed(2)},t=uTime*1.25+aWind.x;
       transformed.x+=(sin(t)+.55*sin(t*2.3+position.z*.35))*wv*.075;
       transformed.z+=(cos(t*.93+position.x*.3)+.4*sin(t*1.9))*wv*.055;
       transformed.y+=sin(t*2.1+position.x)*wv*.012;
       transformed.xyz+=vec3(sin(t*5.+position.y*2.7),sin(t*4.3+position.x*3.1),cos(t*4.7+position.z*2.9))*wv*.02*${flut.toFixed(2)};}`)};
  d.customProgramCacheKey=()=>'leafDepth_'+kind;return d}

// ------------------------------------------------------------------------------------------------ batch
const _c=new T.Color(),_p=new T.Vector3(),_n=new T.Vector3(),_nm=new T.Matrix3();
export class Batch{
  constructor(){this.k={};this.mats={}}
  /** kind: 'foliage'|'bark'|'rock'|'prop'.  o.grad(x,y,z,nx,ny,nz)->colour multiplier in the part's local space.
   *  o.wind={base,span,gain,phase}: sway weight rises with world height above base over span. */
  add(kind,geo,matrix,color,o={}){
    const keepUV=kind==='leaf'||kind==='needle';   // textured leaf cards need their UVs
    let g=geo.clone();if(!keepUV&&g.attributes.uv)g.deleteAttribute('uv');if(!g.index)g=mergeVertices(g);
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
      const isCard=kind==='leaf'||kind==='needle';
      const m=isCard?leafMaterial(kind,env):new T.MeshStandardMaterial({vertexColors:true,side:kind==='foliage'?T.DoubleSide:T.FrontSide,roughness:R[kind]??.9,metalness:0,envMap:env||null,envMapIntensity:kind==='foliage'?.35:.3,flatShading:kind!=='foliage'});
      if(kind==='foliage'){windify(m,{amp:1,flutter:1});const w0=m.onBeforeCompile;      // FLAT PAINTED FOLIAGE: 3 hard tones by how much the surface faces the sky, no facets
        m.onBeforeCompile=sh=>{w0(sh);const k=sh.fragmentShader.includes('#include <opaque_fragment>')?'#include <opaque_fragment>':'#include <output_fragment>';
          sh.uniforms.uDim=WIND.uDim;
          sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
            uniform vec3 uDim;`).replace(k,`{vec3 up=normalize((viewMatrix*vec4(0.,1.,0.,0.)).xyz);float u=dot(normalize(normal),up);
            float tn=u>.2?1.1:.8;outgoingLight=mix(diffuseColor.rgb*tn,outgoingLight,.12);}
            outgoingLight*=uDim;   // the flat paint ignores the scene lights, so the night has to dim it explicitly
            `+k)};
        m.customProgramCacheKey=()=>'windifyFlatFoliage2'}else if(kind==='bark')windify(m,{amp:.35,flutter:0});
      if(kind==='foliage'||kind==='bark'||kind==='rock'||isCard)seeThrough(m);
      const mesh=new T.Mesh(g,m);mesh.castShadow=true;
      if(isCard)mesh.customDepthMaterial=leafDepthMaterial(kind);   // shadow = the PNG's real shape, swaying with the leavesmesh.receiveShadow=(kind==='rock'||kind==='prop');   // trees do NOT receive shadows: only the ground shows one soft shadow
      mesh.matrixAutoUpdate=false;mesh.name='batch-'+kind;grp.add(mesh)}
    this.k={};return grp}
}
export const mat4=(px,py,pz,sx=1,sy=sx,sz=sx,rx=0,ry=0,rz=0)=>new T.Matrix4().compose(_p.set(px,py,pz).clone(),new T.Quaternion().setFromEuler(new T.Euler(rx,ry,rz)),new T.Vector3(sx,sy,sz));

// smooth, indexed, lumpy sphere (for canopies, bushes, caps)
export function softLump(detail=2,amp=.2,seed=0){
  let g=new T.IcosahedronGeometry(1,detail);g.deleteAttribute('uv');g.deleteAttribute('normal');g=mergeVertices(g);const p=g.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),f=1+amp*(vnoise(x*1.7+seed,y*1.7,z*1.7)-.5)*2+amp*.5*(vnoise(x*4.1+seed,y*4.1,z*4.1)-.5)*2;p.setXYZ(i,x*f,y*f,z*f)}
  g.computeVertexNormals();return g}
