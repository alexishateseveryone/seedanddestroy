// Atmosphere: physically based sky (Preetham, three's Sky), procedural volumetric-looking clouds, a warm sun with cascaded-style
// follow shadows, aerial-perspective fog sampled from the real sky colour, image based lighting from the sky for the scenery,
// and a post stack (MSAA, bloom, colour grade + vignette, ACES tone mapping).
//
// APPLE / iOS FIXES (dark, over-saturated screen after a hitch):
//  1. the sky shader output is clamped at the source (the sun disc is ~19000, half-float overflows to Inf/NaN on Apple GPUs and the blur spreads it)
//  2. on iPhone / iPad the render target never uses half-float + MSAA together (framebuffer is "complete" but renders garbage on WebKit)
//  3. webglcontextlost / webglcontextrestored are handled: the sky environment (PMREM) is rebuilt after a restore (it comes back empty = dark scenery)
//  4. pixel ratio capped at 2 and the shadow map at 1024 on Apple (iOS kills the GL context when memory runs out)
import * as T from 'three';
import {Sky} from 'three/addons/objects/Sky.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

export const SUN_ELEV=30,SUN_AZ=250;      // degrees: late-morning sun, from the front-left of the arena
const D2R=Math.PI/180;
const APPLE=typeof navigator!=='undefined'&&(/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1));
const SKY_MAX=24;   // sky colour cap (the sun disc would be ~19000); still above the bloom threshold so the glow stays

// Global scale for every standard material's envMapIntensity, so the sky-based ambient light can fade out at night (story mode day/night cycle)
// without touching the materials one by one. At 1 (everywhere except story nights) nothing changes.
const ENV={k:1};
(()=>{const P=T.MeshStandardMaterial.prototype;if(Object.getOwnPropertyDescriptor(P,'envMapIntensity'))return;
  Object.defineProperty(P,'envMapIntensity',{get(){return(this._ei===undefined?1:this._ei)*ENV.k},set(v){this._ei=v},configurable:true});
  const cp=P.copy;P.copy=function(s){const r=cp.call(this,s);this._ei=s._ei;return r}})();

const CLOUD_VS=`varying vec3 vDir;void main(){vDir=normalize(position);vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}`;
const CLOUD_FS=`varying vec3 vDir;uniform float uTime,uCover;uniform vec3 uSun,uLit,uShade,uRim;
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;mat2 r=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<6;i++){s+=a*noise(p);p=r*p;a*=.5;}return s;}
void main(){vec3 d=normalize(vDir);float h=d.y;if(h<.015)discard;
  vec2 uv=d.xz/(h*.9+.16)*1.25+vec2(uTime*.012,uTime*.005);
  vec2 warp=vec2(fbm(uv*.6+3.1),fbm(uv*.6+7.7))-.5;uv+=warp*.9;
  float n=fbm(uv),dens=smoothstep(uCover,uCover+.3,n);
  if(dens<.003)discard;
  vec2 sd=normalize(uSun.xz+1e-4)*.07;float n2=fbm(uv+sd);                      // density towards the sun: thicker = darker
  float lit=clamp(.62+(n-n2)*4.2,0.,1.);
  float core=smoothstep(uCover,uCover+.6,n);                                    // thick centres are greyer underneath
  vec3 col=mix(uShade,uLit,lit);col=mix(col,uShade*.85,core*.35*(1.-lit));
  float sunA=pow(max(dot(d,uSun),0.),6.);col+=uRim*sunA*.55*(1.-dens*.6);   // silver lining near the sun
  float fade=smoothstep(.015,.2,h);
  gl_FragColor=vec4(col,dens*fade*.96);}`;

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

const GRADE={uniforms:{tDiffuse:{value:null},uTime:{value:0},uVig:{value:.34},uGrain:{value:.012},uSat:{value:1.1},uAb:{value:.004}},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform sampler2D tDiffuse;uniform float uTime,uVig,uGrain,uSat,uAb;varying vec2 vUv;
  float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
  void main(){vec2 c=vUv-.5;float r=dot(c,c);vec2 off=c*r*uAb;
    vec3 col=vec3(texture2D(tDiffuse,vUv+off).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv-off).b);
    float l=dot(col,vec3(.2126,.7152,.0722));col=mix(vec3(l),col,uSat);
    col*=1.-uVig*smoothstep(.12,.62,r*1.7);
    col*=vec3(1.02,1.0,.97+.03*smoothstep(.0,.4,r));                                  // faint warm centre, cool edges
    col+=(hash(vUv*vec2(1731.,911.)+fract(uTime))-.5)*uGrain;
    gl_FragColor=vec4(max(col,0.),1.);}`};

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
  const mkSky=()=>{const s=new Sky();s.scale.setScalar(2000);
    // FIX 1: cap the sky colour in the shader itself. Without this the sun disc (~19000) overflows half-float (max 65504) on Apple GPUs.
    const fs=s.material.fragmentShader,capped=fs.replace(/gl_FragColor\s*=\s*vec4\(\s*retColor\s*,\s*1\.0\s*\)\s*;/,`gl_FragColor=vec4(min(retColor,vec3(${SKY_MAX.toFixed(1)})),1.0);`);
    if(capped!==fs){s.material.fragmentShader=capped;s.material.needsUpdate=true}
    else console.warn('atmosphere: could not clamp the sky shader (Sky.js changed?). Sky colour is not capped.');
    const u=s.material.uniforms;
    u.turbidity.value=3.2;u.rayleigh.value=1.35;u.mieCoefficient.value=.0042;u.mieDirectionalG.value=.82;u.sunPosition.value.copy(sunDir);return s};
  const cloudMat=()=>new T.ShaderMaterial({vertexShader:CLOUD_VS,fragmentShader:CLOUD_FS,transparent:true,depthWrite:false,depthTest:true,side:T.BackSide,fog:false,
    uniforms:{uTime:{value:0},uCover:{value:.5},uSun:{value:sunDir.clone()},uLit:{value:new T.Color('#fff4e4').multiplyScalar(1.5)},uShade:{value:new T.Color('#7f93b3').multiplyScalar(.9)},uRim:{value:new T.Color().setRGB(1,.82,.55)}}});
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
  const hemi=new T.HemisphereLight('#a9ccff','#6d8a4e',1.35),sun=new T.DirectionalLight('#ffe7c2',3.1);
  sun.castShadow=true;sun.shadow.mapSize.set(APPLE?1024:2048,APPLE?1024:2048);const sc=sun.shadow.camera;sc.left=-26;sc.right=26;sc.top=26;sc.bottom=-26;sc.near=1;sc.far=140;
  sun.shadow.bias=-.0004;sun.shadow.normalBias=.035;sun.shadow.radius=3;
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
  const rt=new T.WebGLRenderTarget(size.x,size.y,{type:pick.type,samples:pick.samples});
  const composer=new EffectComposer(renderer,rt),bloom=new UnrealBloomPass(new T.Vector2(size.x,size.y),.22,.6,1.5),grade=new ShaderPass(GRADE),mblur=new ShaderPass(MBLUR);mblur.enabled=false;
  const prevQ=new T.Quaternion().copy(cam.quaternion),relQ=new T.Quaternion(),relE=new T.Euler(),mbVel=mblur.uniforms.uVel.value;
  composer.addPass(new RenderPass(scene,cam));if(pick.type===T.HalfFloatType)composer.addPass(new ShaderPass(SANITIZE));
  composer.addPass(mblur);composer.addPass(bloom);composer.addPass(grade);composer.addPass(new OutputPass());
  let mode='maker',postFail=false,ctxLost=false;const Q={bloom:true,grade:true,aa:true,shadows:2,clouds:true,blur:0};const fog=new T.Fog(fogHaze,45,240);

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
  const L={skyD:new T.Color('#a9ccff'),skyN:new T.Color('#3b5296'),grdD:new T.Color('#6d8a4e'),grdN:new T.Color('#18221c'),
    sunD:new T.Color('#ffe7c2'),sunLow:new T.Color('#ff9a55'),moon:new T.Color('#9db4ff'),fogN:new T.Color('#080d1c'),fogDusk:new T.Color('#ff9c66'),
    litD:new T.Color('#fff4e4').multiplyScalar(1.5),litN:new T.Color('#7f90c8').multiplyScalar(.28),litDusk:new T.Color('#ffb48a').multiplyScalar(1.25),
    shD:new T.Color('#7f93b3').multiplyScalar(.9),shN:new T.Color('#0a1022'),shDusk:new T.Color('#8c6f90').multiplyScalar(.9),
    rimD:new T.Color().setRGB(1,.82,.55),rimN:new T.Color().setRGB(.3,.4,.8)};
  const sst=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)},moonDir=new T.Vector3(),ld=new T.Vector3();
  let cycOn=false,hour=9,night=0;
  function applyTime(h){
    const a=(h-6)/24*Math.PI*2,elev=Math.asin(Math.sin(a)*Math.sin(72*D2R)),az=(90+(h-6)*15)*D2R;      // 6:00 sunrise in the east, 12:00 high in the south, 18:00 sunset
    sunDir.setFromSphericalCoords(1,Math.PI/2-elev,az);moonDir.copy(sunDir).negate();
    const s=sunDir.y,day=sst(-.12,.25,s),tw=Math.exp(-Math.pow((s-.03)/.17,2)),sunMode=s>-.07;night=1-day;
    lightDir.copy(sunMode?sunDir:moonDir);
    const su=sky.material.uniforms;su.sunPosition.value.copy(sunDir);su.turbidity.value=3.2+tw*3.5;su.rayleigh.value=1.35+tw*1.1;su.mieCoefficient.value=.0042+tw*.004;
    hemi.color.lerpColors(L.skyN,L.skyD,day);hemi.groundColor.lerpColors(L.grdN,L.grdD,day);hemi.intensity=.8+.55*day;
    if(sunMode){sun.intensity=3.1*sst(-.07,.22,s);sun.color.lerpColors(L.sunLow,L.sunD,sst(.05,.5,s))}     // the sun / moon swap happens while both are at ~0 intensity: no pop
    else{sun.intensity=.65*sst(.07,.3,-s);sun.color.copy(L.moon)}
    ENV.k=.1+.9*day;
    fogHaze.lerpColors(L.fogN,fogDay,day);if(tw>.01)fogHaze.lerp(L.fogDusk,tw*.6*(.35+.65*day));fog.color.copy(fogHaze);
    const cu=clouds.material.uniforms;cu.uSun.value.copy(lightDir);
    cu.uLit.value.lerpColors(L.litN,L.litD,day).lerp(L.litDusk,tw*.65);cu.uShade.value.lerpColors(L.shN,L.shD,day).lerp(L.shDusk,tw*.6);cu.uRim.value.lerpColors(L.rimN,L.rimD,day);
    const so=sst(-.02,-.25,s),mo=sst(.06,-.04,s);stars.material.uniforms.uOp.value=so;moon.material.uniforms.uOp.value=mo;
    const pl=mode==='play';stars.visible=pl&&so>.01;moon.visible=pl&&mo>.01}
  function resetLook(){
    sunDir.copy(FIXED_SUN);lightDir.copy(FIXED_SUN);night=0;ENV.k=1;
    const su=sky.material.uniforms;su.sunPosition.value.copy(sunDir);su.turbidity.value=3.2;su.rayleigh.value=1.35;su.mieCoefficient.value=.0042;
    fogHaze.copy(fogDay);fog.color.copy(fogHaze);
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
      rt.dispose();composer.renderTarget1.dispose();composer.renderTarget2.dispose();
      composer.setPixelRatio(renderer.getPixelRatio());renderer.getSize(size);composer.setSize(size.x,size.y);
      postFail=false;if(api.onEnv)api.onEnv(envMap);if(api.onRestore)api.onRestore();
    }catch(err){console.warn('WebGL restore failed',err)}
    ctxLost=false;console.warn('WebGL context restored')},false);

  const api={sunDir,lightDir,sun,hemi,get envMap(){return envMap},onEnv:null,onRestore:null,fogColor:fogHaze,sky,clouds,composer,bloom,grade,dayLength:720,hold:false,
    /** story mode clock: on=true starts the cycle at startHour (0-24); on=false goes back to the fixed sun */
    setCycle(on,startHour){on=!!on;if(typeof startHour==='number'&&isFinite(startHour))hour=((startHour%24)+24)%24;
      if(on===cycOn&&!(on&&typeof startHour==='number'))return;
      cycOn=on;if(on){if(mode==='play')applyTime(hour)}else{resetLook();api.setMode(mode)}},
    get hour(){return hour},set hour(v){hour=((+v||0)%24+24)%24},
    get night(){return night},get cycling(){return cycOn},
    setMode(m){mode=m;const play=m==='play';
      sky.visible=play;clouds.visible=play&&Q.clouds;
      renderer.toneMapping=play?T.ACESFilmicToneMapping:T.NoToneMapping;renderer.toneMappingExposure=play?.82:1;
      renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
      sun.castShadow=play&&Q.shadows>0;hemi.intensity=play?1.35:2.1;sun.intensity=play?3.1:2.3;sun.color.set(play?'#ffe7c2':'#fff0c8');
      if(!play){sun.position.set(-8,16,10);sun.target.position.set(0,0,0)}
      hemi.color.set(play?'#a9ccff':'#fff6d8');hemi.groundColor.set(play?'#6d8a4e':'#7aa86a');
      scene.fog=play?fog:null;scene.background=null;
      if(cycOn&&play)applyTime(hour);else{stars.visible=false;moon.visible=false;if(!play)ENV.k=1}},
    // FIX 4: Apple devices get a 3x pixel ratio by default, which is 9x the pixels of 1x and a lot of GPU memory with the post stack. Cap it at 2.
    resize(w,h,pr){if(APPLE)pr=Math.min(pr,2);composer.setPixelRatio(pr);composer.setSize(w,h);bloom.resolution.set(w,h)},
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
      if(mode==='play'&&focus){const d=cycOn?lightDir:sunDir;ld.copy(d);if(ld.y<.22){ld.y=.22;ld.normalize()}      // shadow light never gets lower than ~13 degrees (long shadows would sink into the hills)
        sun.target.position.set(focus.x,0,focus.z);sun.position.set(focus.x+ld.x*70,ld.y*70,focus.z+ld.z*70);sun.target.updateMatrixWorld()}},
    /** graphics options: bloom, grade (vignette/grain/colour), aa (MSAA in the post path), shadows 0|1|2, clouds.
     *  With bloom AND grade off the whole post stack is skipped and the scene goes straight to the screen (cheapest path). */
    setQuality(q){Object.assign(Q,q);bloom.enabled=!!Q.bloom;grade.enabled=!!Q.grade;mblur.enabled=Q.blur>0;
      const n=Q.aa?pick.samples:0;if(rt.samples!==n){[composer.renderTarget1,composer.renderTarget2].forEach(t=>{t.samples=n;t.dispose()})}
      const ms=(Q.shadows>=2&&!APPLE)?2048:1024;if(sun.shadow.mapSize.x!==ms){sun.shadow.mapSize.set(ms,ms);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null}}   // Apple: 1024 max (memory)
      const ext=Q.shadows>=2?26:20;if(sc.right!==ext){sc.left=-ext;sc.right=ext;sc.top=ext;sc.bottom=-ext;sc.updateProjectionMatrix()}
      api.setMode(mode)},
    render(){if(ctxLost)return;   // the context is gone: drawing now would only throw, wait for webglcontextrestored
      if(mode==='play'&&!postFail&&(Q.bloom||Q.grade||Q.blur>0)){
        try{composer.render()}catch(e){postFail=true;console.warn('Post-processing disabled (GPU could not run it):',e);try{renderer.setRenderTarget(null)}catch(_){}renderer.render(scene,cam)}}
      else renderer.render(scene,cam)}};
  api.setMode('maker');return api;
}
