// Atmosphere, "A Short Hike" look: a stylised gradient sky with a flat sun disc, flat two-tone pixel clouds, a warm sun with follow shadows,
// fog sampled from the sky's horizon colour, sky-based ambient light for the scenery, and a post stack that renders the WHOLE game at low
// resolution (about 300 lines tall), upscales it with nearest-neighbour filtering (chunky pixels) and snaps the colours to a dithered palette.
// No MSAA, no chromatic aberration, no grain, gentle neutral tone mapping instead of cinematic ACES.
//
// APPLE / iOS FIXES (dark, over-saturated screen after a hitch):
//  1. the sky shader output is clamped at the source (the sun disc is ~19000, half-float overflows to Inf/NaN on Apple GPUs and the blur spreads it)
//  2. on iPhone / iPad the render target never uses half-float + MSAA together (framebuffer is "complete" but renders garbage on WebKit)
//  3. webglcontextlost / webglcontextrestored are handled: the sky environment (PMREM) is rebuilt after a restore (it comes back empty = dark scenery)
//  4. pixel ratio capped at 2 and the shadow map at 1024 on Apple (iOS kills the GL context when memory runs out)
import * as T from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {Pass,FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

export const SUN_ELEV=30,SUN_AZ=250;      // degrees: late-morning sun, from the front-left of the arena
const D2R=Math.PI/180;
const APPLE=typeof navigator!=='undefined'&&(/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1));
const SKY_MAX=24;   // sky colour cap (the sun disc would be ~19000); still above the bloom threshold so the glow stays

// Global scale for every standard material's envMapIntensity, so the sky-based ambient light can fade out at night (story mode day/night cycle)
// without touching the materials one by one. At 1 (everywhere except story nights) nothing changes.
export const ENV={k:1};
(()=>{const P=T.MeshStandardMaterial.prototype;if(Object.getOwnPropertyDescriptor(P,'envMapIntensity'))return;
  Object.defineProperty(P,'envMapIntensity',{get(){return(this._ei===undefined?1:this._ei)*ENV.k},set(v){this._ei=v},configurable:true});
  const cp=P.copy;P.copy=function(s){const r=cp.call(this,s);this._ei=s._ei;return r}})();

// ---------------------------------------------------------------- CEL LIGHTING: ONE lit tone + ONE shadow tone
// Before: smooth N.L gradient + hemisphere gradient + toon bands + shadow map = 3-4 stacked layers of "shadow" on every surface.
// Now every Standard / Lambert / Phong material gets a hard two-state sun term (lit or not) and a CONSTANT sky ambient. The cast shadow from the
// shadow map and the shaded side of a surface are therefore the very same flat tone (the ambient colour), so they merge instead of stacking.
// Per material, a define picks the mode:  (none) = hard step,  CEL_FLAT = always lit (only the cast shadow darkens it: the ground uses this),  CEL_SMOOTH = original smooth lighting.
// This runs at import time, before any material has been compiled.
export const CEL={lit:.85,cut:.12,amb:.68};
(()=>{const SC=T.ShaderChunk,NL='float dotNL = saturate( dot( geometryNormal, directLight.direction ) );';
  const rep=(k,a,b)=>{if(!SC[k]||!SC[k].includes(a)){console.warn('[cel] lighting patch skipped for '+k+' (three.js chunk text differs in this version)');return}SC[k]=SC[k].replace(a,b)};
  ['lights_physical_pars_fragment','lights_lambert_pars_fragment','lights_phong_pars_fragment'].forEach(k=>rep(k,NL,NL+`
	#if defined( CEL_FLAT )
		dotNL = ${CEL.lit.toFixed(3)};
	#elif !defined( CEL_SMOOTH )
		dotNL = dotNL > ${CEL.cut.toFixed(3)} ? ${CEL.lit.toFixed(3)} : 0.;
	#endif`));
  rep('lights_pars_begin','float hemiDiffuseWeight = 0.5 * dotNL + 0.5;',`float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
	#if !defined( CEL_SMOOTH )
		hemiDiffuseWeight = ${CEL.amb.toFixed(3)};
	#endif`)})();

// ---------------------------------------------------------------- SOFT OUTLINE (depth based, drawn on the LOW-RES image => exactly 1 art pixel wide, aliased on purpose)
// The scene is rendered into its own low-res target with a depth texture. A pixel gets the outline when a neighbour is clearly NEARER than it is AND the
// opposite neighbour does not continue the same slope (so flat ground seen at a grazing angle never outlines itself). The outline is the pixel's own
// colour darkened and pulled towards a deep indigo: a soft coloured line, never pure black. Sky is never outlined; far things fade out.
// Materials with the define NO_OL (the cat, the grass) write alpha 0 into the scene target; the outline pass reads that as "never outline this".
(()=>{const SC=T.ShaderChunk,add=`
	#ifdef NO_OL
		gl_FragColor.a = 0.;
	#endif`;let ok=false;for(const k of['opaque_fragment','output_fragment'])if(SC[k]&&SC[k].includes('gl_FragColor')){SC[k]+=add;ok=true;break}
  if(!ok)console.warn('[outline] NO_OL patch skipped (three.js chunk differs)')})();
const OL_VS=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const OL_FS=`uniform sampler2D tColor,tDepth;uniform vec2 uTexel;uniform float uNear,uFar,uStr,uFade;uniform vec3 uTint;varying vec2 vUv;
float lin(vec2 uv){float d=texture2D(tDepth,uv).x;return 2.*uNear*uFar/(uFar+uNear-(d*2.-1.)*(uFar-uNear));}
// nearer neighbour flagged NO_OL (alpha 0) = no outline is drawn because of it; a flagged pixel itself is never outlined either
bool edge(vec2 uv,vec2 o,float zc,float t){float zn=lin(uv+o),zo=min(lin(uv-o),zc*1.1);float d1=zc-zn,d2=zo-zc;return d1>t&&(d1-d2)>t&&texture2D(tColor,uv+o).a>.5;}
void main(){vec4 c=texture2D(tColor,vUv);
  if(uStr>0.&&c.a>.5&&texture2D(tDepth,vUv).x<.99999){
    float zc=lin(vUv),t=.035*zc+.02;
    if(zc<uFade&&(edge(vUv,vec2(uTexel.x,0.),zc,t)||edge(vUv,vec2(-uTexel.x,0.),zc,t)||edge(vUv,vec2(0.,uTexel.y),zc,t)||edge(vUv,vec2(0.,-uTexel.y),zc,t)))
      c.rgb=mix(c.rgb*.5,uTint,.22);}
  gl_FragColor=vec4(c.rgb,1.);}`;
// replaces RenderPass: renders the scene into an own target (with depth), then composites the outline into the composer's read buffer
// Finds everything that must not be outlined and gives its materials the NO_OL define: the whole cat (any object whose userData has setAim = the avatar root,
// so hair, ears, tail, whiskers, collar, wearables, weapons all count), wind grass, and instanced scatter (grass / flowers / pebbles). Runs a few times a second.
const NOOL=m=>{for(const x of Array.isArray(m)?m:[m]){if(x&&!(x.defines&&x.defines.NO_OL!==undefined)){x.defines=Object.assign(x.defines||{},{NO_OL:''});x.needsUpdate=true}}};
function markNoOutline(o,inCat){const cat=inCat||!!(o.userData&&o.userData.setAim);
  if(o.material&&(cat||o.isInstancedMesh||(o.material.customProgramCacheKey&&String(o.material.customProgramCacheKey()).startsWith('windGrass'))))NOOL(o.material);
  for(const c of o.children)markNoOutline(c,cat)}
class ScenePass extends Pass{
  constructor(scene,cam,type){super();this.scene=scene;this.cam=cam;this.needsSwap=false;
    this.rt=new T.WebGLRenderTarget(16,16,{type,minFilter:T.NearestFilter,magFilter:T.NearestFilter,depthTexture:new T.DepthTexture(16,16)});
    this.mat=new T.ShaderMaterial({vertexShader:OL_VS,fragmentShader:OL_FS,depthTest:false,depthWrite:false,
      uniforms:{tColor:{value:null},tDepth:{value:null},uTexel:{value:new T.Vector2(1/16,1/16)},uNear:{value:.1},uFar:{value:480},uStr:{value:1},uFade:{value:120},uTint:{value:new T.Color('#0b0a28')}}});
    this.fsq=new FullScreenQuad(this.mat)}
  setSize(w,h){this.rt.setSize(w,h);this.mat.uniforms.uTexel.value.set(1/w,1/h)}
  render(renderer,writeBuffer,readBuffer){
    if((this.sw=(this.sw||0)+1)%15===1)markNoOutline(this.scene,false);
    const ac=renderer.autoClear,u=this.mat.uniforms;renderer.autoClear=false;
    renderer.setRenderTarget(this.rt);renderer.clear();renderer.render(this.scene,this.cam);renderer.autoClear=ac;
    u.tColor.value=this.rt.texture;u.tDepth.value=this.rt.depthTexture;u.uNear.value=this.cam.near;u.uFar.value=this.cam.far;
    renderer.setRenderTarget(this.renderToScreen?null:readBuffer);this.fsq.render(renderer)}
  dispose(){this.rt.dispose();this.mat.dispose();this.fsq.dispose()}
}

const CLOUD_VS=`varying vec3 vDir;void main(){vDir=normalize(position);vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}`;
// flat cartoon clouds: a hard edge and only TWO tones (lit top, shaded belly), so after the pixelation they read as pixel-art puffs
const CLOUD_FS=`varying vec3 vDir;uniform float uTime,uCover;uniform vec3 uSun,uLit,uShade,uRim;
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;mat2 r=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<4;i++){s+=a*noise(p);p=r*p;a*=.5;}return s;}
void main(){vec3 d=normalize(vDir);float h=d.y;if(h<.03)discard;
  vec2 uv=d.xz/(h*.9+.16)*.9+vec2(uTime*.012,uTime*.005);
  float n=fbm(uv),edge=uCover+.09;
  if(n<edge)discard;                                                            // hard cloud edge
  vec2 sd=normalize(uSun.xz+1e-4)*.09;float n2=fbm(uv+sd);                      // density towards the sun: thicker = in shade
  float band=step(.5,.62+(n-n2)*4.2);                                           // 1 = lit top, 0 = shaded belly
  vec3 col=mix(uShade,uLit,band);
  col+=uRim*pow(max(dot(d,uSun),0.),8.)*.25*band;                               // tiny warm glow towards the sun
  gl_FragColor=vec4(col,smoothstep(.03,.14,h));}`;

// stylised sky: a soft vertical gradient (horizon -> zenith), a warm glow and a flat sun disc. Pinned to the far plane like the clouds.
const SKY_VS=`varying vec3 vDir;void main(){vDir=normalize(position);vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}`;
const SKY_FS=`varying vec3 vDir;uniform vec3 uSun,uZen,uHor,uGlow,uSunCol;
void main(){vec3 d=normalize(vDir);float h=max(d.y,0.);
  vec3 col=mix(uHor,uZen,pow(smoothstep(0.,.9,h),.7));
  float sd=max(dot(d,normalize(uSun)),0.);
  col+=uGlow*pow(sd,6.)*.5;
  col=mix(col,uSunCol,smoothstep(.9968,.9974,sd));
  gl_FragColor=vec4(min(col,vec3(4.)),1.);}`;

// Half-float targets can hold values far above 1 (the sky's sun disc is ~19000). Some phone GPUs turn that into Inf/NaN, and the bloom blur
// spreads it into dark blotches / a darkened screen. This pass removes NaN / Inf and caps the range before anything else reads the image.
const SANITIZE={uniforms:{tDiffuse:{value:null}},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform sampler2D tDiffuse;varying vec2 vUv;
  void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;if(any(isnan(c))||any(isinf(c)))c=vec3(0.);gl_FragColor=vec4(clamp(c,vec3(0.),vec3(48.)),1.);}`};

// night sky: stars + moon are point sprites pinned to the far plane (gl_Position.xyww), so terrain always covers them
const STAR_VS=`attribute float aS;uniform float uPx;varying float vS;void main(){vS=aS;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;gl_PointSize=uPx*aS;}`;
const STAR_FS=`uniform float uOp;varying float vS;void main(){float d=length(gl_PointCoord-.5)*2.;float a=smoothstep(1.,.1,d);
  gl_FragColor=vec4(mix(vec3(.75,.85,1.),vec3(1.,.93,.82),fract(vS*7.3)),a*uOp*min(1.,vS*.8));}`;
const MOON_VS=`uniform float uPx;void main(){vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;gl_PointSize=uPx;}`;
const MOON_FS=`uniform float uOp;void main(){vec2 c=gl_PointCoord-.5;float r=length(c)*2.;float disc=smoothstep(.46,.42,r),glow=exp(-r*r*6.)*.4;
  vec3 col=vec3(.93,.95,1.)*(1.-.08*sin(c.x*41.)*sin(c.y*37.+1.))*disc+vec3(.5,.62,1.)*glow;
  gl_FragColor=vec4(col,clamp(disc+glow,0.,1.)*uOp);}`;

// colour grade for the pixel look: punchy saturation, a soft vignette, then the colours are snapped to uLv steps per channel with a 4x4 ordered
// (Bayer) dither. This pass runs on the LOW-RES image, so gl_FragCoord is one art pixel and the dither pattern is chunky too.
const GRADE={uniforms:{tDiffuse:{value:null},uTime:{value:0},uVig:{value:.07},uSat:{value:1.14},uNight:{value:0},uLv:{value:26}},   // fewer colour steps = crunchier flat colour; no dither, no grain; barely any vignette
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform sampler2D tDiffuse;uniform float uTime,uVig,uSat,uNight,uLv;varying vec2 vUv;
  float b2(vec2 p){p=mod(floor(p),2.);return fract(p.x*.5+p.y*p.y*.75);}
  float b4(vec2 p){return (b2(p)*4.+b2(p*.5))/4.;}
  void main(){vec2 c=vUv-.5;float r=dot(c,c);
    vec3 col=texture2D(tDiffuse,vUv).rgb;
    float l=dot(col,vec3(.2126,.7152,.0722));col=mix(vec3(l),col,uSat*mix(1.,.7,uNight));   // night: calmer colours
    col*=1.-uVig*smoothstep(.15,.65,r*1.7);
    vec3 g=pow(clamp(col,0.,1.),vec3(1./2.2));                                       // snap in a perceptual space so the steps look even
    g=floor(g*uLv+.5)/uLv;   // soft dither (30%) + more steps = smooth flat colour, not grainy
    gl_FragColor=vec4(pow(g,vec3(2.2)),1.);}`};

// Camera motion blur: the screen-space shift caused by the camera turning this frame (uVel, in uv units) is smeared symmetrically over a few taps.
const MBLUR={uniforms:{tDiffuse:{value:null},uVel:{value:new T.Vector2()}},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform sampler2D tDiffuse;uniform vec2 uVel;varying vec2 vUv;
  void main(){vec3 s=vec3(0.);float w=0.;
    for(int i=0;i<12;i++){float t=float(i)/11.-.5;float k=1.-abs(t)*.9;s+=texture2D(tDiffuse,clamp(vUv+uVel*t,vec2(.001),vec2(.999))).rgb*k;w+=k;}
    gl_FragColor=vec4(s/w,1.);}`};
const MB_LEVEL=[0,.35,.65,1.1];   // Off / Low / Medium / High: fraction of a 1/60 s shutter

export function createAtmosphere(renderer,scene,cam){
  const sunDir=new T.Vector3().setFromSphericalCoords(1,(90-SUN_ELEV)*D2R,SUN_AZ*D2R),FIXED_SUN=sunDir.clone(),lightDir=sunDir.clone();
  // ---------------------------------------------------------------- sky + clouds (one builder so the environment probe gets its own copy)
  // (FIX 1 of the old version, capping the sun disc, is no longer needed: this sky never goes above ~4, far below the half-float limit)
  const mkSky=()=>{const s=new T.Mesh(new T.SphereGeometry(100,24,12),new T.ShaderMaterial({vertexShader:SKY_VS,fragmentShader:SKY_FS,side:T.BackSide,depthWrite:false,fog:false,
      uniforms:{uSun:{value:sunDir.clone()},uZen:{value:new T.Color('#4aa3f2')},uHor:{value:new T.Color('#cdeefa')},uGlow:{value:new T.Color('#ffd9a0')},uSunCol:{value:new T.Color('#fff6d8').multiplyScalar(2.5)}}}));
    s.frustumCulled=false;return s};
  const cloudMat=()=>new T.ShaderMaterial({vertexShader:CLOUD_VS,fragmentShader:CLOUD_FS,transparent:true,depthWrite:false,depthTest:true,side:T.BackSide,fog:false,
    uniforms:{uTime:{value:0},uCover:{value:.5},uSun:{value:sunDir.clone()},uLit:{value:new T.Color('#fff4e4').multiplyScalar(1.5)},uShade:{value:new T.Color('#aebfe6').multiplyScalar(.95)},uRim:{value:new T.Color().setRGB(1,.82,.55)}}});
  const mkClouds=()=>{const m=new T.Mesh(new T.SphereGeometry(300,32,16),cloudMat());m.renderOrder=-1;m.frustumCulled=false;return m};
  const sky=mkSky(),clouds=mkClouds();sky.renderOrder=-2;scene.add(sky,clouds);
  // ---------------------------------------------------------------- environment probe (sky -> PMREM) for the scenery's ambient + reflections
  const pm=new T.PMREMGenerator(renderer),envScene=new T.Scene(),eSky=mkSky(),eClouds=mkClouds();envScene.add(eSky,eClouds);
  let envRT=pm.fromScene(envScene,0,.1,1000),envMap=envRT.texture;
  // fog colour = the sky's real horizon colour, so distant things melt into the sky.
  // It is read back from a tiny render. That render MUST be 8-bit: float read-back is not supported on most phones, where three silently returns
  // zeros -> the old code got a BLACK fog colour, which turned everything in the distance (and the whole 5v5 arena edge) dark. The result is also
  // validated, with a safe sky-blue fallback.
  let fogColor=new T.Color('#b9cde0');
  try{const rt=new T.WebGLRenderTarget(8,8,{type:T.UnsignedByteType}),hc=new T.PerspectiveCamera(30,1,.1,5000),buf=new Uint8Array(4*64);
    hc.lookAt(new T.Vector3(Math.sin(SUN_AZ*D2R+Math.PI*.5),.07,Math.cos(SUN_AZ*D2R+Math.PI*.5)));hc.updateMatrixWorld();
    renderer.setRenderTarget(rt);renderer.clear();renderer.render(envScene,hc);renderer.readRenderTargetPixels(rt,0,0,8,8,buf);renderer.setRenderTarget(null);
    let r=0,g=0,b=0;for(let i=0;i<64;i++){r+=buf[i*4];g+=buf[i*4+1];b+=buf[i*4+2]}
    const c=new T.Color(r/(64*255),g/(64*255),b/(64*255)),lum=c.r*.2126+c.g*.7152+c.b*.0722;
    if(isFinite(lum)&&lum>.08)fogColor=c;
    rt.dispose()}catch(e){try{renderer.setRenderTarget(null)}catch(_){}}
  const fogDay=fogColor.clone().lerp(new T.Color('#ffe9cf'),.12),fogHaze=fogDay.clone();
  // ---------------------------------------------------------------- lights
  const SUN_I=1.7,HEMI_P=1.9;   // a bit lower than before: neutral tone mapping keeps colours brighter than ACES did
  const hemi=new T.HemisphereLight('#bfe0ff','#7fae5a',HEMI_P),sun=new T.DirectionalLight('#fff0cc',SUN_I);
  sun.castShadow=true;sun.shadow.mapSize.set(APPLE?1024:2048,APPLE?1024:2048);const sc=sun.shadow.camera;sc.left=-26;sc.right=26;sc.top=26;sc.bottom=-26;sc.near=1;sc.far=140;
  sun.shadow.bias=-.0004;sun.shadow.normalBias=.035;sun.shadow.radius=0;
  scene.add(hemi,sun,sun.target);
  // ---------------------------------------------------------------- post stack
  // Pick a render target the GPU can really draw to: half-float + MSAA where supported, then fall back step by step (phones often lack one of them;
  // an unsupported target gives an incomplete framebuffer = black / darkened image). Each candidate is tested with a real 16x16 target.
  const pick=(()=>{const gl=renderer.getContext(),ms=renderer.capabilities.maxSamples||0,ex=renderer.extensions,
      half=renderer.capabilities.isWebGL2!==false&&(ex.has('EXT_color_buffer_float')||ex.has('EXT_color_buffer_half_float')),tries=[];
    if(half){tries.push([T.HalfFloatType,Math.min(4,ms)]);tries.push([T.HalfFloatType,0])}
    tries.push([T.UnsignedByteType,Math.min(4,ms)],[T.UnsignedByteType,0]);
    // FIX 2: on Apple devices half-float + MSAA reports a complete framebuffer but renders broken (dark, over-saturated) colours.
    // Use plain 8-bit targets there (MSAA still allowed): no float overflow is possible, and it uses far less memory.
    if(APPLE){tries.length=0;tries.push([T.UnsignedByteType,Math.min(4,ms)],[T.UnsignedByteType,0])}
    for(const [type,samples] of tries){let t=null;
      try{gl.getError();t=new T.WebGLRenderTarget(16,16,{type,samples});renderer.setRenderTarget(t);renderer.clear();
        const ok=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE&&gl.getError()===gl.NO_ERROR;
        renderer.setRenderTarget(null);t.dispose();if(ok)return{type,samples}}
      catch(e){try{renderer.setRenderTarget(null);t&&t.dispose()}catch(_){}}}
    return{type:T.UnsignedByteType,samples:0}})();
  const size=new T.Vector2();renderer.getSize(size);
  const rt=new T.WebGLRenderTarget(size.x,size.y,{type:pick.type,samples:0});   // no MSAA: hard pixel edges are the point
  const composer=new EffectComposer(renderer,rt),bloom=new UnrealBloomPass(new T.Vector2(size.x,size.y),.1,.5,1.2),grade=new ShaderPass(GRADE),mblur=new ShaderPass(MBLUR);mblur.enabled=false;
  // nearest-neighbour filtering: the final pass stretches the low-res image over the screen WITHOUT smoothing it
  [composer.renderTarget1,composer.renderTarget2].forEach(t=>{t.texture.minFilter=t.texture.magFilter=T.NearestFilter});
  let ART_H=270;let rw=size.x,rh=size.y,rpr=1,pixOn=true;   // ART_H = how many pixel rows the picture has (about); pixOn = pixel look on / off
  const applyRes=()=>{const ps=pixOn?Math.max(2,Math.round(rh/ART_H)):0;composer.setPixelRatio(ps?1/ps:rpr);composer.setSize(rw,rh)};
  const prevQ=new T.Quaternion().copy(cam.quaternion),relQ=new T.Quaternion(),relE=new T.Euler(),mbVel=mblur.uniforms.uVel.value;
  const scenePass=new ScenePass(scene,cam,pick.type);composer.addPass(scenePass);if(pick.type===T.HalfFloatType)composer.addPass(new ShaderPass(SANITIZE));
  composer.addPass(mblur);composer.addPass(bloom);composer.addPass(grade);composer.addPass(new OutputPass());
  let mode='maker',postFail=false,ctxLost=false;const Q={bloom:false,grade:true,aa:false,shadows:2,clouds:true,blur:0,pixel:true,outline:true};const fog=new T.Fog(fogHaze,45,240);

  // ---------------------------------------------------------------- night sky: stars + moon
  const maxPt=(()=>{try{const gl=renderer.getContext();return gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1]||64}catch(e){return 64}})();
  let sd=12345;const rnd=()=>((sd=(sd*1664525+1013904223)>>>0)/4294967296);
  const NS=700,sp=new Float32Array(NS*3),ss=new Float32Array(NS);
  for(let i=0;i<NS;i++){const y=rnd()*2-1,a=rnd()*Math.PI*2,r=Math.sqrt(1-y*y);sp[i*3]=Math.cos(a)*r*100;sp[i*3+1]=y*100;sp[i*3+2]=Math.sin(a)*r*100;ss[i]=.7+Math.pow(rnd(),3)*1.1}
  const sg=new T.BufferGeometry();sg.setAttribute('position',new T.BufferAttribute(sp,3));sg.setAttribute('aS',new T.BufferAttribute(ss,1));
  const stars=new T.Points(sg,new T.ShaderMaterial({vertexShader:STAR_VS,fragmentShader:STAR_FS,transparent:true,depthWrite:false,fog:false,uniforms:{uOp:{value:0},uPx:{value:2.4}}}));
  stars.frustumCulled=false;stars.renderOrder=-1.5;stars.visible=false;
  const moon=new T.Points(new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(new Float32Array(3),3)),
    new T.ShaderMaterial({vertexShader:MOON_VS,fragmentShader:MOON_FS,transparent:true,depthWrite:false,fog:false,uniforms:{uOp:{value:0},uPx:{value:50}}}));
  moon.frustumCulled=false;moon.renderOrder=-1.4;moon.visible=false;scene.add(stars,moon);

  // ---------------------------------------------------------------- day / night cycle (story mode). Off = the old fixed late-morning sun, byte for byte.
  const L={skyD:new T.Color('#a9ccff'),skyN:new T.Color('#434f78'),grdD:new T.Color('#6d8a4e'),grdN:new T.Color('#18221c'),
    sunD:new T.Color('#ffe7c2'),sunLow:new T.Color('#f2ab78'),moon:new T.Color('#aab8dc'),fogN:new T.Color('#0a0e18'),fogDusk:new T.Color('#e6a585'),
    litD:new T.Color('#fff4e4').multiplyScalar(1.5),litN:new T.Color('#838daf').multiplyScalar(.28),litDusk:new T.Color('#eab8a0').multiplyScalar(1.25),
    shD:new T.Color('#aebfe6').multiplyScalar(.95),shN:new T.Color('#0a1022'),shDusk:new T.Color('#80708a').multiplyScalar(.9),
    rimD:new T.Color().setRGB(1,.82,.55),rimN:new T.Color().setRGB(.35,.4,.6)};
  const SK={zD:new T.Color('#4aa3f2'),zN:new T.Color('#0b1030'),zDusk:new T.Color('#7a86d6'),hD:new T.Color('#cdeefa'),hN:new T.Color('#1a2448'),hDusk:new T.Color('#ffb98a'),gl:new T.Color('#ffd9a0')};
  function skyLook(day,tw){const u=sky.material.uniforms;u.uSun.value.copy(sunDir);   // gradient colours for day / night / sunset, and the glow around the sun
    u.uZen.value.lerpColors(SK.zN,SK.zD,day).lerp(SK.zDusk,tw*.5);u.uHor.value.lerpColors(SK.hN,SK.hD,day).lerp(SK.hDusk,tw*.75);u.uGlow.value.copy(SK.gl).multiplyScalar(day)}
  const sst=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)},moonDir=new T.Vector3(),ld=new T.Vector3();
  let cycOn=false,hour=9,night=0;
  function applyTime(h){
    const a=(h-6)/24*Math.PI*2,elev=Math.asin(Math.sin(a)*Math.sin(72*D2R)),az=(90+(h-6)*15)*D2R;      // 6:00 sunrise in the east, 12:00 high in the south, 18:00 sunset
    sunDir.setFromSphericalCoords(1,Math.PI/2-elev,az);moonDir.copy(sunDir).negate();
    const s=sunDir.y,day=sst(-.12,.25,s),tw=Math.exp(-Math.pow((s-.03)/.17,2)),sunMode=s>-.07;night=1-day;grade.uniforms.uNight.value=night;
    lightDir.copy(sunMode?sunDir:moonDir);
    skyLook(day,tw);
    hemi.color.lerpColors(L.skyN,L.skyD,day);hemi.groundColor.lerpColors(L.grdN,L.grdD,day);hemi.intensity=.7+(HEMI_P-.7)*day;
    if(sunMode){sun.intensity=SUN_I*sst(-.07,.22,s);sun.color.lerpColors(L.sunLow,L.sunD,sst(.05,.5,s))}     // the sun / moon swap happens while both are at ~0 intensity: no pop
    else{sun.intensity=.65*sst(.07,.3,-s);sun.color.copy(L.moon)}   // (moon light)
    ENV.k=.1+.9*day;
    fogHaze.lerpColors(L.fogN,fogDay,day);if(tw>.01)fogHaze.lerp(L.fogDusk,tw*.6*(.35+.65*day));fog.color.copy(fogHaze);
    const cu=clouds.material.uniforms;cu.uSun.value.copy(lightDir);
    cu.uLit.value.lerpColors(L.litN,L.litD,day).lerp(L.litDusk,tw*.65);cu.uShade.value.lerpColors(L.shN,L.shD,day).lerp(L.shDusk,tw*.6);cu.uRim.value.lerpColors(L.rimN,L.rimD,day);
    const so=sst(-.02,-.25,s),mo=sst(.06,-.04,s);stars.material.uniforms.uOp.value=so;moon.material.uniforms.uOp.value=mo;
    const pl=mode==='play';stars.visible=pl&&so>.01;moon.visible=pl&&mo>.01}
  function resetLook(){
    sunDir.copy(FIXED_SUN);lightDir.copy(FIXED_SUN);night=0;ENV.k=1;
    skyLook(1,0);
    fogHaze.copy(fogDay);fog.color.copy(fogHaze);grade.uniforms.uNight.value=0;
    const cu=clouds.material.uniforms;cu.uSun.value.copy(sunDir);cu.uLit.value.copy(L.litD);cu.uShade.value.copy(L.shD);cu.uRim.value.copy(L.rimD);
    stars.visible=false;moon.visible=false}

  // ---------------------------------------------------------------- FIX 3: WebGL context loss (iOS drops the context when memory runs low)
  // A lost context comes back with EMPTY render targets: the PMREM sky environment is blank, which turns all the scenery dark and harsh.
  // On restore the environment is rebuilt and handed to whoever uses it (scene.environment is re-pointed here, main.js can also listen to api.onEnv).
  const cv=renderer.domElement;
  cv.addEventListener('webglcontextlost',e=>{e.preventDefault();ctxLost=true;console.warn('WebGL context lost')},false);
  cv.addEventListener('webglcontextrestored',()=>{
    try{
      const old=envMap;
      envRT=pm.fromScene(envScene,0,.1,1000);envMap=envRT.texture;
      if(scene.environment===old)scene.environment=envMap;
      scene.traverse(o=>{const ms=o.material?(Array.isArray(o.material)?o.material:[o.material]):[];for(const m of ms){if(m.envMap===old)m.envMap=envMap;m.needsUpdate=true}});
      rt.dispose();scenePass.rt.dispose();composer.renderTarget1.dispose();composer.renderTarget2.dispose();
      renderer.getSize(size);rw=size.x;rh=size.y;rpr=renderer.getPixelRatio();applyRes();
      postFail=false;if(api.onEnv)api.onEnv(envMap);if(api.onRestore)api.onRestore();
    }catch(err){console.warn('WebGL restore failed',err)}
    ctxLost=false;console.warn('WebGL context restored')},false);

  const SNP={f:new T.Vector3(),r:new T.Vector3(),u:new T.Vector3(),up:new T.Vector3(0,1,0),p:new T.Vector3()};
  const api={sunDir,lightDir,sun,hemi,get envMap(){return envMap},onEnv:null,onRestore:null,fogColor:fogHaze,sky,clouds,composer,bloom,grade,dayLength:720,hold:false,
    /** story mode clock: on=true starts the cycle at startHour (0-24); on=false goes back to the fixed sun */
    setCycle(on,startHour){on=!!on;if(typeof startHour==='number'&&isFinite(startHour))hour=((startHour%24)+24)%24;
      if(on===cycOn&&!(on&&typeof startHour==='number'))return;
      cycOn=on;if(on){if(mode==='play')applyTime(hour)}else{resetLook();api.setMode(mode)}},
    get hour(){return hour},set hour(v){hour=((+v||0)%24+24)%24},
    get night(){return night},get cycling(){return cycOn},
    setMode(m){mode=m;const play=m==='play';
      sky.visible=play;clouds.visible=play&&Q.clouds;
      renderer.toneMapping=play?(T.NeutralToneMapping||T.LinearToneMapping):T.NoToneMapping;renderer.toneMappingExposure=1;   // neutral = keeps the bright cartoon colours (ACES made them dull and contrasty)
      renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.BasicShadowMap;                                          // plain PCF: crisper, blockier shadow edges that match the pixels
      sun.castShadow=play&&Q.shadows>0;hemi.intensity=play?HEMI_P:2.1;sun.intensity=play?SUN_I:2.3;sun.color.set(play?'#fff0cc':'#fff0c8');
      if(!play){sun.position.set(-8,16,10);sun.target.position.set(0,0,0)}
      hemi.color.set(play?'#bfe0ff':'#fff6d8');hemi.groundColor.set(play?'#7fae5a':'#7aa86a');
      scene.fog=play?fog:null;scene.background=null;
      if(cycOn&&play)applyTime(hour);else{stars.visible=false;moon.visible=false;if(!play)ENV.k=1}},
    // FIX 4: Apple devices get a 3x pixel ratio by default, which is 9x the pixels of 1x and a lot of GPU memory with the post stack. Cap it at 2.
    // w, h = CSS size of the screen. In pixel mode the image is rendered about 300 rows tall (every art pixel = several screen pixels).
    resize(w,h,pr){if(APPLE)pr=Math.min(pr,2);rw=w;rh=h;rpr=pr;applyRes()},
    setPixel(on){pixOn=!!on;applyRes()},setArtRows(n){ART_H=Math.max(40,Math.min(720,n|0));applyRes()},get pixelRows(){return pixOn?Math.round(rh/Math.max(2,Math.round(rh/ART_H))):rh*rpr},
    update(dt,t,focus){
      sky.position.copy(cam.position);clouds.position.copy(cam.position);clouds.material.uniforms.uTime.value=t;grade.uniforms.uTime.value=t;
      if(cycOn&&mode==='play'){if(!api.hold)hour=(hour+dt*24/api.dayLength)%24;applyTime(hour);
        const pr=renderer.getPixelRatio();stars.position.copy(cam.position);stars.material.uniforms.uPx.value=2.4*pr;
        moon.position.copy(cam.position).addScaledVector(moonDir,100);moon.material.uniforms.uPx.value=Math.min(maxPt,54*pr)}
      // motion blur: how far the view turned since last frame -> screen-space velocity, scaled to a fixed shutter time so it looks the same at any FPS
      relQ.copy(prevQ).invert().multiply(cam.quaternion);prevQ.copy(cam.quaternion);
      if(mblur.enabled){relE.setFromQuaternion(relQ,'YXZ');
        const th=Math.tan(cam.fov*Math.PI/360),sx=1/(2*th*cam.aspect),sy=1/(2*th),k=(MB_LEVEL[Q.blur]||0)/60/Math.max(dt,1/240);
        let vx=Math.tan(relE.y)*sx*k,vy=-Math.tan(relE.x)*sy*k;const l=Math.hypot(vx,vy),mx=.05;if(l>mx){vx*=mx/l;vy*=mx/l}
        if(l<.0004){vx=0;vy=0}   // ignore sub-pixel jitter
        mbVel.set(vx,vy)}
      if(mode==='play'&&focus){const d=cycOn?lightDir:sunDir;ld.copy(d);if(ld.y<.62){ld.y=.62;ld.normalize()}      // shadow light never gets lower than ~13 degrees (long shadows would sink into the hills)
        {const S=SNP,tx=2*sc.right/sun.shadow.mapSize.x;S.f.copy(ld).negate();S.r.crossVectors(S.f,S.up).normalize();S.u.crossVectors(S.r,S.f);   // snap the shadow camera to whole shadow texels (in light space): the shadow no longer swims / shimmers when the cat moves
          const ra=Math.round((focus.x*S.r.x+focus.z*S.r.z)/tx)*tx,ua=Math.round((focus.x*S.u.x+focus.z*S.u.z)/tx)*tx,fa=focus.x*S.f.x+focus.z*S.f.z;
          S.p.set(0,0,0).addScaledVector(S.r,ra).addScaledVector(S.u,ua).addScaledVector(S.f,fa);
          sun.target.position.copy(S.p);sun.position.copy(S.p).addScaledVector(ld,70);sun.target.updateMatrixWorld()}}},
    /** graphics options: bloom, grade (vignette/grain/colour), aa (MSAA in the post path), shadows 0|1|2, clouds.
     *  With bloom AND grade off the whole post stack is skipped and the scene goes straight to the screen (cheapest path). */
    setOutline(on){Q.outline=!!on;scenePass.mat.uniforms.uStr.value=Q.outline?1:0},
    setQuality(q){Object.assign(Q,q);scenePass.mat.uniforms.uStr.value=Q.outline?1:0;bloom.enabled=!!Q.bloom;grade.enabled=!!Q.grade;mblur.enabled=Q.blur>0;
      if(!!Q.pixel!==pixOn){pixOn=!!Q.pixel;applyRes()}   // Q.aa is ignored: the pixel look never uses MSAA
      const ms=(Q.shadows>=2&&!APPLE)?2048:1024;if(sun.shadow.mapSize.x!==ms){sun.shadow.mapSize.set(ms,ms);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null}}   // Apple: 1024 max (memory)
      const ext=Q.shadows>=2?26:20;if(sc.right!==ext){sc.left=-ext;sc.right=ext;sc.top=ext;sc.bottom=-ext;sc.updateProjectionMatrix()}
      api.setMode(mode)},
    render(){if(ctxLost)return;   // the context is gone: drawing now would only throw, wait for webglcontextrestored
      if(!postFail){   // always through the post stack (also in the cat maker): it is what makes the picture low-res and pixelated
        try{composer.render()}catch(e){postFail=true;console.warn('Post-processing disabled (GPU could not run it):',e);try{renderer.setRenderTarget(null)}catch(_){}renderer.render(scene,cam)}}
      else renderer.render(scene,cam)}};
  api.setMode('maker');return api;
}
