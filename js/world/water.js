// WATER (own file): winding river ribbons + irregular lakes, one shared shader material.
//   const water=createWater(world);   scene.add(water.group);
//   water.update(t,{sun,sky})   every frame (animation + sun / sky colour)
//   water.ripple(x,z,strength)  / water.walk(id,x,z,moving)   footstep rings (max 16 alive at once)
//   addLily(B,R,x,y,z,s,flower) / addReed(B,R,x,y,z,h)         shore + surface plants pushed into a Batch
// Rivers flow: the surface pattern scrolls along the river direction. Edges fade out softly and carry a bit of foam.
import * as T from 'three';
import {mat4} from '../batch.js';
import {ENV} from '../atmosphere.js';   // ENV.k = 1 by day, 0.1 at night
const dayAmt=()=>Math.min(1,Math.max(0,(ENV.k-.1)/.9)),SUN_DAY=new T.Color('#fff0cc'),SUN_NIGHT=new T.Color('#9fb0d8');

const NOISE_GLSL=`
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
float fbm2(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*vn(p);p=p*2.03+7.1;a*=.5;}return s;}`;

function waterMaterial(RIP,world){
  const tex=new T.DataTexture(world.tex2,world.nx+1,world.nz+1,T.RGBAFormat);tex.magFilter=tex.minFilter=T.LinearFilter;tex.wrapS=tex.wrapT=T.ClampToEdgeWrapping;tex.generateMipmaps=false;tex.needsUpdate=true;   // same shore-distance data the ground shader uses
  return new T.ShaderMaterial({transparent:true,fog:true,depthWrite:true,side:T.DoubleSide,
    uniforms:T.UniformsUtils.merge([T.UniformsLib.fog,{uTime:{value:0},uDeep:{value:new T.Color('#2b655f')},uShallow:{value:new T.Color('#86b89a')},uSky:{value:new T.Color('#a9c4bd')},uMurk:{value:new T.Color('#5d7a4a')},uRipOn:{value:0},uDay:{value:1},uCa:{value:new T.Color('#61d4e8')},uCb:{value:new T.Color('#267ac4')},uFoam:{value:new T.Color('#f2ffff')},
      uSun:{value:new T.Vector3(.4,.6,.5)},uSunCol:{value:new T.Color('#fff0cc')},uRip:{value:RIP},uT2:{value:tex},uOrg:{value:new T.Vector2(world.x0,world.z0)},uSz:{value:new T.Vector2(world.nx+1,world.nz+1)}}]),
    vertexShader:`attribute float aDepth,aFall,aSea;attribute vec2 aFlow;varying vec3 vW;varying float vD,vFl,vSea;varying vec2 vF;
      #include <fog_pars_vertex>
      void main(){vD=aDepth;vFl=aFall;vSea=aSea;vF=aFlow;vec4 wp=modelMatrix*vec4(position,1.);vW=wp.xyz;vec4 mvPosition=viewMatrix*wp;gl_Position=projectionMatrix*mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader:`varying vec3 vW;varying float vD,vFl,vSea;varying vec2 vF;uniform float uTime,uRipOn,uDay;uniform vec3 uCa,uCb,uFoam;uniform vec4 uRip[16];uniform sampler2D uT2;uniform vec2 uOrg,uSz;
      #include <fog_pars_fragment>
      // CARTOON WATER: flat depth bands (shallow aqua -> deep blue), thin light contour rings that drift like the ripples in a hand-painted game, white foam on the water's own edge,
      // a tide that breathes in and out, and white streaky waterfalls. Everything is sampled on a 9-cells-per-unit grid so it stays pixel-art.
      float hs(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hs(i),hs(i+vec2(1.,0.)),f.x),mix(hs(i+vec2(0.,1.)),hs(i+vec2(1.,1.)),f.x),f.y);}
      // two copies of the pattern slide along the flow and cross-fade, so a bending river never shears the pattern
      float flowN(vec2 p,vec2 fl,float sc,float rate,float dist,float off){float a=fract(uTime*rate),b=fract(uTime*rate+.5),w=1.-abs(1.-2.*a);
        return vn((p-fl*a*dist)*sc+off)*w+vn((p-fl*b*dist)*sc+off+17.3)*(1.-w);}
      void main(){
        bool river=length(vF)>.01;vec2 fl=river?normalize(vF)*1.6:vec2(.5,.18);                 // lakes / sea: lazy drift
        vec2 w=vW.xz+vec2(sin(vW.z*1.7+uTime*.8),cos(vW.x*1.3+uTime*.6))*.12;                   // gentle warp
        vec2 q=floor(w*9.)/9.;                                                                  // the pixel grid
        float n=flowN(q,fl,1.3,.14,5.,0.)*.6+flowN(q,fl,2.3,.2,6.,7.)*.4;
        vec4 tx=texture2D(uT2,(vW.xz-uOrg+.5)/uSz);float sdv=tx.g*12.-3.;                       // distance to the water edge (negative = inside); tx.b = open sea
        if(vSea>.5){if(tx.b<.15)discard;}else if(tx.b>.5)discard;                               // the sea plane draws only on the sea, rivers / lakes never on it: no doubled water
        float dep=min(vD,.12+smoothstep(-.3,-6.,sdv)*.9);                                       // shallow near any shore, deeper away from it
        vec3 c=mix(uCa,uCb,floor(dep*3.+.5)/3.);                                                // flat cartoon depth bands
        float n2=flowN(q,fl,.5,.1,5.,3.);float ring=step(abs(fract(n2*3.5+uTime*.03)-.5),.04);c=mix(c,vec3(.86,1.,1.),ring*.45);   // calm, wide contour rings (low-frequency noise: no speckle)
        // TIDE: the waterline breathes in and out (differently along the shore); each swell washes up the sand and pulls back
        float tide=.5+.5*sin(uTime*.6+vn(q*.22)*5.);
        float sdt=sdv-tide*(river?.15:.7)+.1,WL=-.4;
        float fade=1.-smoothstep(WL-.1,WL+.04,sdt);
        // FOAM on the water's side: a bright rim at the waterline + wave lines rolling in from the deep and breaking on the shore
        float wob=(vn(q*3.+uTime*.7)-.5)*.14;
        float foam=step(abs(sdt-WL+.06+wob),.12)*.95;
        float ph=fract(uTime*.2+vn(q*.18)*2.),wpos=WL-1.7*(1.-ph);
        foam=max(foam,step(abs(sdt-wpos+wob),.06)*(1.-smoothstep(.45,1.,ph))*step(wpos-.15,WL-.3)*.7);
        if(uRipOn>.5){for(int i=0;i<16;i++){vec4 r=uRip[i];float age=uTime-r.z;if(age>0.&&age<1.2&&r.w>0.){float d=distance(q,r.xy),rad=age*2.4*r.w;
          foam=max(foam,(1.-age/1.2)*(step(abs(d-rad),.1)+step(abs(d-rad*.6),.07)*.7));}}}
        float fall=step(.5,vFl);
        if(fall>.5){                                                                            // WATERFALL: white streaks pouring down, stepped like the rest
          float sx=floor((vW.x+vW.z)*7.)/7.,sy=floor((vW.y*.9+uTime*2.6)*5.)/5.,st=vn(vec2(sx*2.6,sy));
          c=mix(vec3(.55,.9,.98),uFoam,step(.5,st));foam=0.;}
        else foam=max(foam,step(.12,vFl)*step(vFl,.5)*.9);                                      // white splash band at the lip and at the foot of the fall
        c=mix(c,uFoam,clamp(foam,0.,1.));
        c*=mix(vec3(.05,.07,.11),vec3(1.),uDay);                                                // the water follows the day / night cycle
        float body=mix(.7,.96,smoothstep(.1,.8,dep))*smoothstep(0.,.02,vD)*fade;
        float fm=clamp(foam,0.,1.)*smoothstep(0.,.02,vD)*(1.-smoothstep(WL+.2,WL+.45,sdt));    // foam never spills onto dry sand
        float al=max(body,fm*.95);if(fall>.5)al=.97;
        if(al<.02)discard;gl_FragColor=vec4(c,al);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
      }`});
}

/** triangle strip along a river: 3 vertices per point (left edge, middle, right edge) */
function riverGeometry(pts){
  const n=pts.length,pos=[],dep=[],flw=[],fal=[],idx=[];
  for(let i=0;i<n;i++){
    const a=pts[Math.max(0,i-1)],b=pts[Math.min(n-1,i+1)],p=pts[i];let tx=b.x-a.x,tz=b.z-a.z;const l=Math.hypot(tx,tz)||1;tx/=l;tz/=l;
    const w=(p.w+.8)*(.35+.65*Math.min(1,i/9)),y=p.L-.03;                              // a river starts as a thin spring
    pos.push(p.x-tz*w,y,p.z+tx*w, p.x,y,p.z, p.x+tz*w,y,p.z-tx*w);dep.push(0,1,0);flw.push(tx,tz,tx,tz,tx,tz);{const f=(p.fall||(pts[i+1]&&pts[i+1].fall))?1:0;fal.push(f,f,f)}}
  for(let i=0;i<n-1;i++){const a=i*3,b=a+3;idx.push(a,b,a+1,b,b+1,a+1,a+1,b+1,a+2,b+1,b+2,a+2)}   // counter-clockwise seen from above (the old order faced down and was culled)
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('aDepth',new T.Float32BufferAttribute(dep,1));g.setAttribute('aFlow',new T.Float32BufferAttribute(flw,2));g.setAttribute('aFall',new T.Float32BufferAttribute(fal,1));g.setAttribute('aSea',new T.Float32BufferAttribute(new Float32Array(n*3),1));g.setIndex(idx);
  g.computeBoundingSphere();return g}

/** irregular lake outline (the generator's noisy radius), flat surface at the lake level */
function lakeGeometry(l,lakeR){
  const K=72,pos=[l.x,l.L-.03,l.z],dep=[1],flw=[0,0],idx=[];
  for(let ring=1;ring<=2;ring++)for(let i=0;i<K;i++){const th=i/K*6.283,r=(lakeR(l,th)+.8)*(ring===1?.55:1);
    pos.push(l.x+Math.cos(th)*r,l.L-.03,l.z+Math.sin(th)*r);dep.push(ring===1?.7:0);flw.push(0,0)}
  for(let i=0;i<K;i++){const j=(i+1)%K;idx.push(0,1+j,1+i);idx.push(1+i,1+j,1+K+i,1+K+i,1+j,1+K+j)}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('aDepth',new T.Float32BufferAttribute(dep,1));g.setAttribute('aFlow',new T.Float32BufferAttribute(flw,2));g.setAttribute('aFall',new T.Float32BufferAttribute(new Float32Array(dep.length),1));g.setAttribute('aSea',new T.Float32BufferAttribute(new Float32Array(dep.length),1));g.setIndex(idx);
  g.computeBoundingSphere();return g}

/** the sea: one big quad at sea level; the shore shape comes from the shore-distance texture */
function seaGeometry(world){const x0=world.x0,z0=world.z0,x1=x0+world.nx,z1=z0+world.nz,y=world.sea-.03,g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute([x0,y,z0,x1,y,z0,x1,y,z1,x0,y,z1],3));g.setAttribute('aDepth',new T.Float32BufferAttribute([1,1,1,1],1));g.setAttribute('aFlow',new T.Float32BufferAttribute(new Float32Array(8),2));g.setAttribute('aFall',new T.Float32BufferAttribute(new Float32Array(4),1));g.setAttribute('aSea',new T.Float32BufferAttribute([1,1,1,1],1));
  g.setIndex([0,2,1,0,3,2]);g.computeBoundingSphere();return g}

export function createWater(world){
  const RIP=Array.from({length:16},()=>new T.Vector4(0,0,-99,0)),mat=waterMaterial(RIP,world),group=new T.Group();mat.uniforms.uRip.value=RIP;   // merge() copies uniforms: point it back at our live array
  let ri=0,lastT=0,lastRip=-99,fxr=null;const walkT=new Map(),skyTint=new T.Color('#a9c4bd');
  for(const r of world.rivers){const m=new T.Mesh(riverGeometry(r.pts),mat);m.renderOrder=2;group.add(m)}
  if(world.sea!==undefined){const m=new T.Mesh(seaGeometry(world),mat);m.renderOrder=1;m.frustumCulled=false;group.add(m)}
  for(const l of world.lakes){const m=new T.Mesh(lakeGeometry(l,world.lakeR),mat);m.renderOrder=2;group.add(m)}
  const ripple=(x,z,a=1)=>{RIP[ri].set(x,z,lastT,a);ri=(ri+1)&15;lastRip=lastT};
  return{group,material:mat,
    update(t,E){lastT=t;mat.uniforms.uTime.value=t;const day=(E&&typeof E.day==='number')?E.day:dayAmt();mat.uniforms.uDay.value=day;mat.uniforms.uSunCol.value.copy(SUN_DAY).lerp(SUN_NIGHT,1-day).multiplyScalar(.3+.7*day);mat.uniforms.uRipOn.value=t-lastRip<3?1:0;
      if(E){const s=E.sun,k=E.sky;      // never let a NaN / zero vector reach the shader: it turns the whole water black
        if(s&&isFinite(s.x+s.y+s.z)&&s.lengthSq()>1e-6)mat.uniforms.uSun.value.copy(s).normalize();
        if(k&&isFinite(k.r+k.g+k.b))mat.uniforms.uSky.value.copy(k).lerp(skyTint,.6)}},
    ripple,
    walk(id,x,z,moving){if(!moving||world.waterAt(x,z)===null)return;if(lastT-(walkT.get(id)??-9)<.2)return;walkT.set(id,lastT);ripple(x,z,.85);if(fxr)fxr.splashStep(x,z)},
    /** call once after creating both: water.link(fx). Lets the effects know where the water is (jump / dash / step / bullet splashes) and ring the surface. */
    link(fx){fxr=fx;fx.setWater((x,z)=>{const v=world.waterAt(x,z);if(v===null||v===undefined||v===false)return null;return typeof v==='number'?v:(v.L??v.level??v.y)},ripple,dayAmt)}};
}

const PAD=new T.CircleGeometry(1,10).rotateX(-Math.PI/2),BLOOM=new T.IcosahedronGeometry(1,1);
export function addLily(B,R,x,y,z,s,flower){
  B.add('prop',PAD,mat4(x,y,z,s,1,s,0,R()*6,0),'#4aa04c',{varA:.25});
  if(flower)B.add('prop',BLOOM,mat4(x,y+.04,z,.1,.07,.1),'#ff9fc4',{varA:.1})}
export function addReed(B,R,x,y,z,h){
  const tilt=[(R()-.5)*.3,R()*6,(R()-.5)*.3];
  B.add('foliage',new T.ConeGeometry(.06,h,4,1).translate(0,h/2,0),mat4(x,y,z,1,1,1,tilt[0],tilt[1],tilt[2]),'#5d9b45',{wind:{base:y,span:h,gain:1,phase:R()*20},grad:(a,b)=>.7+.5*(b/h)})}
