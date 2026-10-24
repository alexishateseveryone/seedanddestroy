// Procedural coat patterns evaluated per-pixel in the fragment shader.
// No UV unwrapping and no vertex colours, so there are no stretched / pixelated shapes
// and the edges are anti-aliased with fwidth() at any resolution.
import * as T from 'three';

// [id, label, whitePaws]
export const PATTERNS=[
  ['classic','Classic',1],['solid','Solid',0],['tabby','Tabby',1],
  ['tuxedo','Tuxedo',1],['calico','Calico',1],['spots','Spots',0],
  ['points','Points',0],['patches','Patches',0],['hearts','Hearts',0]
];
const MODE=Object.fromEntries(PATTERNS.map((p,i)=>[p[0],i]));
const PAWS=Object.fromEntries(PATTERNS.map(p=>[p[0],p[2]]));

const COMMON=/* glsl */`
varying vec3 vCP;varying vec3 vLP;
uniform vec3 uFur;uniform vec3 uPat;uniform vec3 uWhite;
uniform float uMode;uniform float uPart;uniform float uPaws;uniform vec3 uLS;uniform float uKeep;
float h31(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float vn(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
  return mix(mix(mix(h31(i),h31(i+vec3(1.,0.,0.)),f.x),mix(h31(i+vec3(0.,1.,0.)),h31(i+vec3(1.,1.,0.)),f.x),f.y),
             mix(mix(h31(i+vec3(0.,0.,1.)),h31(i+vec3(1.,0.,1.)),f.x),mix(h31(i+vec3(0.,1.,1.)),h31(i+vec3(1.,1.,1.)),f.x),f.y),f.z);}
// anti-aliased step: 0 -> 1 as v crosses 0, width follows the screen-space derivative
float edg(float v){float w=clamp(fwidth(v)*1.2,.002,.06);return smoothstep(-w,w,v);}
float heartSD(vec2 p){p.x=abs(p.x);
  if(p.y+p.x>1.){vec2 d=p-vec2(.25,.75);return length(d)-.35355;}
  vec2 a=p-vec2(0.,1.);vec2 b=p-.5*max(p.x+p.y,0.);
  return sqrt(min(dot(a,a),dot(b,b)))*sign(p.x-p.y);}
vec3 coatColor(){
  vec3 p=vCP;vec3 q=vec3(abs(p.x),p.y,p.z);vec3 l=vLP;
  bool hd=uPart<.5;bool bd=uPart>.5&&uPart<1.5;bool arm=uPart>1.5&&uPart<2.5;bool leg=uPart>2.5;
  int md=int(uMode+.5);vec3 c=uFur;float m=0.;
  if(md==0){ // classic: patch on head, body in accent colour with a belly
    if(hd){float w=sin(l.y*6.+l.z*4.)*.06;float ex=(l.x+.62)/.66,ey=(l.y-.18)/.9;float e=ex*ex+ey*ey+w;
      m=max(edg(1.-e),edg(-l.z)*edg(-.1+w-l.x));c=mix(uFur,uPat,m);}
    else{c=uPat;if(bd){float ex=l.x/.5,ey=(l.y-.3)/.6;m=edg(1.-ex*ex-ey*ey)*edg(l.z-.25);c=mix(c,uWhite,m);}}
  }else if(md==1){ // solid
    c=uFur;
  }else if(md==2){ // tabby
    float n=vn(q*3.5+3.1);
    if(hd){m=edg(sin(q.x*17.+n*3.)-.35)*edg(l.y-.15)*edg(l.z+.2);
      m=max(m,edg(sin(l.y*26.+n*2.)-.5)*edg(abs(l.x)-.62)*edg(l.z));}
    else m=edg(sin(p.y*15.+n*4.)-.3);
    c=mix(uFur,uPat,m);
  }else if(md==3){ // tuxedo
    if(hd){m=edg(l.z-.42)*edg(.0-l.y);m=max(m,edg(.13-abs(l.x))*edg(l.y+.05)*edg(l.z-.1));}
    else if(bd){float ex=p.x/.42,ey=(p.y+1.12)/.62;m=edg(1.-ex*ex-ey*ey)*edg(p.z-.1);}
    c=mix(uFur,uPat,m);
  }else if(md==4){ // calico
    float n1=vn(p*1.6+1.7),n2=vn(p*1.6+9.2);
    c=mix(uFur,uPat,edg(n1-.52));c=mix(c,uWhite,edg(n2-.58));
  }else if(md==5){ // spots
    m=edg(vn(p*7.+vec3(4.))-.68);c=mix(uFur,uPat,m);
  }else if(md==6){ // points (siamese)
    float ex=0.;
    if(hd){float f=exp(-(l.x*l.x*2.8+(l.y+.12)*(l.y+.12)*2.2));ex=f*smoothstep(.05,.55,l.z);}
    else if(bd)ex=smoothstep(-1.5,-1.75,p.y)*.6;
    else if(arm)ex=smoothstep(-.9,-1.12,p.y);
    else ex=smoothstep(-1.6,-1.82,p.y);
    c=mix(uFur,uPat,clamp(ex*1.1,0.,1.));
  }else if(md==7){ // patches
    m=edg(vn(p*1.15+vec3(2.,5.,1.))-.5);c=mix(uFur,uPat,m);
  }else{ // hearts
    float u=atan(p.x,p.z)*(hd?.955:.7958);float v=p.y*(hd?1.15:1.7);
    vec2 g=vec2(u,v);g.x+=floor(g.y)*.5;vec2 cc=fract(g)-.5;
    float d=heartSD(vec2(cc.x*2.6,cc.y*2.6+.55));
    m=edg(-d);c=mix(uFur,uPat,m);
  }
  if(uPaws>.5&&(arm||leg))c=mix(c,uWhite,edg((arm?-1.07:-1.667)-p.y));
  return c;
}
`;

export function makeCoat(o,part){
  const pattern=o.pattern in MODE?o.pattern:'classic';
  const u={
    uRel:{value:new T.Matrix4()},
    uFur:{value:new T.Color(o.fur)},uPat:{value:new T.Color(o.pat)},uWhite:{value:new T.Color('#fff7ee')},
    uLS:{value:new T.Vector3(1,1,1)},uKeep:{value:0},uMode:{value:MODE[pattern]},uPart:{value:part},uPaws:{value:PAWS[pattern]}
  };
  const m=new T.MeshStandardMaterial({color:'#ffffff',roughness:.82,metalness:0});
  m.userData.u=u;
  m.onBeforeCompile=sh=>{
    Object.assign(sh.uniforms,u);
    sh.vertexShader=sh.vertexShader
      .replace('#include <common>','#include <common>\nvarying vec3 vCP;varying vec3 vLP;uniform mat4 uRel;uniform vec3 uLS;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvLP=position/uLS;vCP=(uRel*vec4(position,1.0)).xyz;');
    sh.fragmentShader=sh.fragmentShader
      .replace('#include <common>','#include <common>\n'+COMMON)
      .replace('#include <color_fragment>','#include <color_fragment>\nif(uKeep>.5){vec3 hh=vLP*uLS;float ke=pow(hh.x/.76,2.)+pow((hh.y+.12)/.52,2.);if(ke<1.&&hh.z>.25)discard;}\ndiffuseColor.rgb=coatColor();');
  };
  m.customProgramCacheKey=()=>'catcoat-v3';
  return m;
}

// Pattern coordinates are expressed in the cat's rest pose, so every body part lines up.
// Call once after the avatar is fully assembled (at rest pose, before any animation).
export function bindCoat(root,meshes){
  root.updateWorldMatrix(true,false);
  const inv=root.matrixWorld.clone().invert();
  root.updateMatrixWorld(true);
  meshes.forEach(m=>m.material.userData.u.uRel.value.multiplyMatrices(inv,m.matrixWorld));
}