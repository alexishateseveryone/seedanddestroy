// Atmosphere: physically based sky (Preetham, three's Sky), procedural volumetric-looking clouds, a warm sun with cascaded-style
// follow shadows, aerial-perspective fog sampled from the real sky colour, image based lighting from the sky for the scenery,
// and a post stack (MSAA, bloom, colour grade + vignette, ACES tone mapping).
import * as T from 'three';
import {Sky} from 'three/addons/objects/Sky.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

export const SUN_ELEV=30,SUN_AZ=250;      // degrees: late-morning sun, from the front-left of the arena

const CLOUD_VS=`varying vec3 vDir;void main(){vDir=normalize(position);vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}`;
const CLOUD_FS=`varying vec3 vDir;uniform float uTime,uCover;uniform vec3 uSun,uLit,uShade;
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
  float sunA=pow(max(dot(d,uSun),0.),6.);col+=vec3(1.,.82,.55)*sunA*.55*(1.-dens*.6);   // silver lining near the sun
  float fade=smoothstep(.015,.2,h);
  gl_FragColor=vec4(col,dens*fade*.96);}`;

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

export function createAtmosphere(renderer,scene,cam){
  const sunDir=new T.Vector3().setFromSphericalCoords(1,(90-SUN_ELEV)*Math.PI/180,SUN_AZ*Math.PI/180);
  // ---------------------------------------------------------------- sky + clouds (one builder so the environment probe gets its own copy)
  const mkSky=()=>{const s=new Sky();s.scale.setScalar(2000);const u=s.material.uniforms;
    u.turbidity.value=3.2;u.rayleigh.value=1.35;u.mieCoefficient.value=.0042;u.mieDirectionalG.value=.82;u.sunPosition.value.copy(sunDir);return s};
  const cloudMat=()=>new T.ShaderMaterial({vertexShader:CLOUD_VS,fragmentShader:CLOUD_FS,transparent:true,depthWrite:false,depthTest:true,side:T.BackSide,fog:false,
    uniforms:{uTime:{value:0},uCover:{value:.5},uSun:{value:sunDir.clone()},uLit:{value:new T.Color('#fff4e4').multiplyScalar(1.5)},uShade:{value:new T.Color('#7f93b3').multiplyScalar(.9)}}});
  const mkClouds=()=>{const m=new T.Mesh(new T.SphereGeometry(300,32,16),cloudMat());m.renderOrder=-1;m.frustumCulled=false;return m};
  const sky=mkSky(),clouds=mkClouds();sky.renderOrder=-2;scene.add(sky,clouds);
  // ---------------------------------------------------------------- environment probe (sky -> PMREM) for the scenery's ambient + reflections
  const pm=new T.PMREMGenerator(renderer),envScene=new T.Scene(),eSky=mkSky(),eClouds=mkClouds();envScene.add(eSky,eClouds);
  const envMap=pm.fromScene(envScene,0,.1,1000).texture;
  // fog colour = the sky's real horizon colour (read back from a tiny float render), so distant things melt into the sky
  let fogColor=new T.Color('#b9cde0');
  try{const rt=new T.WebGLRenderTarget(8,8,{type:T.FloatType}),hc=new T.PerspectiveCamera(30,1,.1,5000),buf=new Float32Array(4*64);
    hc.lookAt(new T.Vector3(Math.sin(SUN_AZ*Math.PI/180+Math.PI*.5),.07,Math.cos(SUN_AZ*Math.PI/180+Math.PI*.5)));hc.updateMatrixWorld();
    renderer.setRenderTarget(rt);renderer.clear();renderer.render(envScene,hc);renderer.readRenderTargetPixels(rt,0,0,8,8,buf);renderer.setRenderTarget(null);
    let r=0,g=0,b=0;for(let i=0;i<64;i++){r+=buf[i*4];g+=buf[i*4+1];b+=buf[i*4+2]}fogColor=new T.Color(r/64,g/64,b/64);rt.dispose()}catch(e){}
  const fogHaze=fogColor.clone().lerp(new T.Color('#ffe9cf'),.12);
  // ---------------------------------------------------------------- lights
  const hemi=new T.HemisphereLight('#a9ccff','#6d8a4e',1.35),sun=new T.DirectionalLight('#ffe7c2',3.1);
  sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);const sc=sun.shadow.camera;sc.left=-26;sc.right=26;sc.top=26;sc.bottom=-26;sc.near=1;sc.far=140;
  sun.shadow.bias=-.0004;sun.shadow.normalBias=.035;sun.shadow.radius=3;
  scene.add(hemi,sun,sun.target);
  // ---------------------------------------------------------------- post stack
  const size=new T.Vector2();renderer.getSize(size);
  const rt=new T.WebGLRenderTarget(size.x,size.y,{type:T.HalfFloatType,samples:4});
  const composer=new EffectComposer(renderer,rt),bloom=new UnrealBloomPass(new T.Vector2(size.x,size.y),.22,.6,1.5),grade=new ShaderPass(GRADE);
  composer.addPass(new RenderPass(scene,cam));composer.addPass(bloom);composer.addPass(grade);composer.addPass(new OutputPass());
  let mode='maker',fogOn=null;const fog=new T.Fog(fogHaze,45,240);
  const api={sunDir,sun,hemi,envMap,fogColor:fogHaze,sky,clouds,composer,bloom,grade,
    setMode(m){mode=m;const play=m==='play';
      sky.visible=clouds.visible=play;
      renderer.toneMapping=play?T.ACESFilmicToneMapping:T.NoToneMapping;renderer.toneMappingExposure=play?.82:1;
      renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
      sun.castShadow=play;hemi.intensity=play?1.35:2.1;sun.intensity=play?3.1:2.3;sun.color.set(play?'#ffe7c2':'#fff0c8');
      hemi.color.set(play?'#a9ccff':'#fff6d8');hemi.groundColor.set(play?'#6d8a4e':'#7aa86a');
      scene.fog=play?fog:null;scene.background=null},
    resize(w,h,pr){composer.setPixelRatio(pr);composer.setSize(w,h);bloom.resolution.set(w,h)},
    update(dt,t,focus){
      sky.position.copy(cam.position);clouds.position.copy(cam.position);clouds.material.uniforms.uTime.value=t;grade.uniforms.uTime.value=t;
      if(mode==='play'&&focus){sun.target.position.set(focus.x,0,focus.z);sun.position.set(focus.x+sunDir.x*70,sunDir.y*70,focus.z+sunDir.z*70);sun.target.updateMatrixWorld()}},
    render(){if(mode==='play')composer.render();else renderer.render(scene,cam)}};
  api.setMode('maker');return api;
}      if(!play){sun.position.set(-8,16,10);sun.target.position.set(0,0,0)}
