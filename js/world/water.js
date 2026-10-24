// WATER (own file): winding river ribbons + irregular lakes, one shared shader material.
//   const water=createWater(world);   scene.add(water.group);
//   water.update(t,{sun,sky})   every frame (animation + sun / sky colour)
//   water.ripple(x,z,strength)  / water.walk(id,x,z,moving)   footstep rings (max 16 alive at once)
//   addLily(B,R,x,y,z,s,flower) / addReed(B,R,x,y,z,h)         shore + surface plants pushed into a Batch
// Rivers flow: the surface pattern scrolls along the river direction. Edges fade out softly and carry a bit of foam.
import * as T from 'three';
import {mat4} from '../batch.js';

const NOISE_GLSL=`
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
float fbm2(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*vn(p);p=p*2.03+7.1;a*=.5;}return s;}`;

function waterMaterial(RIP,world){
  const tex=new T.DataTexture(world.tex2,world.nx+1,world.nz+1,T.RGBAFormat);tex.magFilter=tex.minFilter=T.LinearFilter;tex.wrapS=tex.wrapT=T.ClampToEdgeWrapping;tex.generateMipmaps=false;tex.needsUpdate=true;   // same shore-distance data the ground shader uses
  return new T.ShaderMaterial({transparent:true,fog:true,depthWrite:false,
    uniforms:T.UniformsUtils.merge([T.UniformsLib.fog,{uTime:{value:0},uDeep:{value:new T.Color('#2b655f')},uShallow:{value:new T.Color('#86b89a')},uSky:{value:new T.Color('#a9c4bd')},uMurk:{value:new T.Color('#5d7a4a')},uRipOn:{value:0},
      uSun:{value:new T.Vector3(.4,.6,.5)},uSunCol:{value:new T.Color('#fff0cc')},uRip:{value:RIP},uT2:{value:tex},uOrg:{value:new T.Vector2(world.x0,world.z0)},uSz:{value:new T.Vector2(world.nx+1,world.nz+1)}}]),
    vertexShader:`attribute float aDepth;attribute vec2 aFlow;varying vec3 vW;varying float vD;varying vec2 vF;
      #include <fog_pars_vertex>
      void main(){vD=aDepth;vF=aFlow;vec4 wp=modelMatrix*vec4(position,1.);vW=wp.xyz;vec4 mvPosition=viewMatrix*wp;gl_Position=projectionMatrix*mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader:`varying vec3 vW;varying float vD;varying vec2 vF;uniform float uTime;uniform vec3 uDeep,uShallow,uSky,uSun,uSunCol,uMurk;uniform float uRipOn;uniform vec4 uRip[16];uniform sampler2D uT2;uniform vec2 uOrg,uSz;
      #include <fog_pars_fragment>
      ${NOISE_GLSL}
      float ripH(vec2 p){float h=0.;if(uRipOn<.5)return 0.;for(int i=0;i<16;i++){vec4 r=uRip[i];float age=uTime-r.z;
        if(age>0.&&age<2.8&&r.w>0.){float d=length(p-r.xy),x=d-age*1.6;h+=sin(x*13.)*exp(-x*x*3.)*(1.-age/2.8)*r.w/(1.+d*.5);}}return h;}
      vec2 flow;
      // flow-map scrolling: two copies of the pattern slide along the river and are cross-faded, each one resets before the changing flow direction can shear it
      vec2 flowDir(){return length(flow)>.01?flow:vec2(.35,.25)*.35;}                 // lakes: just a lazy drift
      float fbm3w(vec2 p){float a=.5,s=0.;for(int i=0;i<3;i++){s+=a*vn(p);p=p*2.03+7.1;a*=.5;}return s*1.14;}
      float flowFbm(vec2 p,float sc,float rate,float dist){vec2 fl=flowDir();float a=fract(uTime*rate),b=fract(uTime*rate+.5),w=1.-abs(1.-2.*a);
        return fbm3w((p-fl*a*dist)*sc)*w+fbm3w((p-fl*b*dist)*sc+17.3)*(1.-w);}
      float hgt(vec2 p){return flowFbm(p,1.1,.16,6.)*.7+flowFbm(p,2.7,.24,7.)*.3+ripH(p)*.3;}
      void main(){vec2 p=vW.xz;flow=vF;float e=.06;
        float cdist=length(cameraPosition-vW),far=smoothstep(35.,110.,cdist);              // far away: no ripple normals at all (3 noise taps saved)
        vec3 N=vec3(0.,1.,0.);
        if(far<.98){float h0=hgt(p),k=5.5*(1.-far);N=normalize(vec3((h0-hgt(p+vec2(e,0.)))*k,1.,(h0-hgt(p+vec2(0.,e)))*k));}
        vec3 V=normalize(cameraPosition-vW);float fres=.04+.96*pow(1.-max(dot(N,V),0.),4.);
        vec3 base=mix(uShallow,uDeep,smoothstep(.05,.85,vD));
        base=mix(base,uMurk,.35*(1.-smoothstep(.0,.55,vD)));                                  // muddy, green shallows instead of clear blue
        vec3 R=reflect(-V,N);float sd=max(dot(R,normalize(uSun+vec3(1e-5))),0.);
        vec3 col=mix(base,uSky*.5,clamp(fres*.65,0.,1.));col+=uSunCol*(pow(sd,300.)*2.2+pow(sd,24.)*.06);
        col+=vec3(.8,.93,1.)*clamp(abs(ripH(p))*.8,0.,.45);
        if(far<.9&&length(flow)>.01){float streak=flowFbm(p,2.2,.3,9.);col+=vec3(.12,.16,.18)*smoothstep(.62,.82,streak);}   // fast white water on rivers
        float foam=(1.-smoothstep(.04,.2,vD))*(.45+.55*fbm2(p*3.+uTime*.15));col=mix(col,vec3(.95),clamp(foam,0.,1.)*.55);
        float sdv=texture2D(uT2,(p-uOrg+.5)/uSz).g*12.-3.;                                    // distance to the water edge (negative = inside), same field as the ground mud
        float a=mix(.84,.97,fres)*smoothstep(0.,.16,vD)*(1.-smoothstep(-1.3,-.35,sdv));
        gl_FragColor=vec4(col,a);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
      }`});
}

/** triangle strip along a river: 3 vertices per point (left edge, middle, right edge) */
function riverGeometry(pts){
  const n=pts.length,pos=[],dep=[],flw=[],idx=[];
  for(let i=0;i<n;i++){
    const a=pts[Math.max(0,i-1)],b=pts[Math.min(n-1,i+1)],p=pts[i];let tx=b.x-a.x,tz=b.z-a.z;const l=Math.hypot(tx,tz)||1;tx/=l;tz/=l;
    const w=(p.w+.8)*(.35+.65*Math.min(1,i/9)),y=p.L-.03;                              // a river starts as a thin spring
    pos.push(p.x-tz*w,y,p.z+tx*w, p.x,y,p.z, p.x+tz*w,y,p.z-tx*w);dep.push(0,1,0);flw.push(tx,tz,tx,tz,tx,tz)}
  for(let i=0;i<n-1;i++){const a=i*3,b=a+3;idx.push(a,b,a+1,b,b+1,a+1,a+1,b+1,a+2,b+1,b+2,a+2)}   // counter-clockwise seen from above (the old order faced down and was culled)
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('aDepth',new T.Float32BufferAttribute(dep,1));g.setAttribute('aFlow',new T.Float32BufferAttribute(flw,2));g.setIndex(idx);
  g.computeBoundingSphere();return g}

/** irregular lake outline (the generator's noisy radius), flat surface at the lake level */
function lakeGeometry(l,lakeR){
  const K=72,pos=[l.x,l.L-.03,l.z],dep=[1],flw=[0,0],idx=[];
  for(let ring=1;ring<=2;ring++)for(let i=0;i<K;i++){const th=i/K*6.283,r=(lakeR(l,th)+.8)*(ring===1?.55:1);
    pos.push(l.x+Math.cos(th)*r,l.L-.03,l.z+Math.sin(th)*r);dep.push(ring===1?.7:0);flw.push(0,0)}
  for(let i=0;i<K;i++){const j=(i+1)%K;idx.push(0,1+j,1+i);idx.push(1+i,1+j,1+K+i,1+K+i,1+j,1+K+j)}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('aDepth',new T.Float32BufferAttribute(dep,1));g.setAttribute('aFlow',new T.Float32BufferAttribute(flw,2));g.setIndex(idx);
  g.computeBoundingSphere();return g}

export function createWater(world){
  const RIP=Array.from({length:16},()=>new T.Vector4(0,0,-99,0)),mat=waterMaterial(RIP,world),group=new T.Group();mat.uniforms.uRip.value=RIP;   // merge() copies uniforms: point it back at our live array
  let ri=0,lastT=0,lastRip=-99;const walkT=new Map(),skyTint=new T.Color('#a9c4bd');
  for(const r of world.rivers){const m=new T.Mesh(riverGeometry(r.pts),mat);m.renderOrder=2;group.add(m)}
  for(const l of world.lakes){const m=new T.Mesh(lakeGeometry(l,world.lakeR),mat);m.renderOrder=2;group.add(m)}
  const ripple=(x,z,a=1)=>{RIP[ri].set(x,z,lastT,a);ri=(ri+1)&15;lastRip=lastT};
  return{group,material:mat,
    update(t,E){lastT=t;mat.uniforms.uTime.value=t;mat.uniforms.uRipOn.value=t-lastRip<3?1:0;
      if(E){const s=E.sun,k=E.sky;      // never let a NaN / zero vector reach the shader: it turns the whole water black
        if(s&&isFinite(s.x+s.y+s.z)&&s.lengthSq()>1e-6)mat.uniforms.uSun.value.copy(s).normalize();
        if(k&&isFinite(k.r+k.g+k.b))mat.uniforms.uSky.value.copy(k).lerp(skyTint,.6)}},
    ripple,
    walk(id,x,z,moving){if(!moving||world.waterAt(x,z)===null)return;if(lastT-(walkT.get(id)??-9)<.2)return;walkT.set(id,lastT);ripple(x,z,.85)}};
}

const PAD=new T.CircleGeometry(1,10).rotateX(-Math.PI/2),BLOOM=new T.IcosahedronGeometry(1,1);
export function addLily(B,R,x,y,z,s,flower){
  B.add('prop',PAD,mat4(x,y,z,s,1,s,0,R()*6,0),'#4aa04c',{varA:.25});
  if(flower)B.add('prop',BLOOM,mat4(x,y+.04,z,.1,.07,.1),'#ff9fc4',{varA:.1})}
export function addReed(B,R,x,y,z,h){
  const tilt=[(R()-.5)*.3,R()*6,(R()-.5)*.3];
  B.add('foliage',new T.ConeGeometry(.06,h,4,1).translate(0,h/2,0),mat4(x,y,z,1,1,1,tilt[0],tilt[1],tilt[2]),'#5d9b45',{wind:{base:y,span:h,gain:1,phase:R()*20},grad:(a,b)=>.7+.5*(b/h)})}