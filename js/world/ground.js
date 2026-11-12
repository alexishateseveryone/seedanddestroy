// GROUND (own file): LOW-POLY terrain tiles + one PIXEL-ART shader that paints every biome ("A Short Hike" look).
//   const mat=createGroundMaterial(world,env);   const tiles=buildGroundTiles(world,mat,20);   scene.add(tiles)
// - Terrain is built from flat triangles on a world.ts (=2) unit grid: the SAME triangles worldGen.terrainAt() evaluates, so everything stands on the facets.
// - Every texture lookup is snapped to a chunky PIXEL_CELL grid, so borders, dirt paths, cliffs and shores all have stair-stepped pixel edges (no smooth curves).
// - Hard colour steps only (no smoothstep blends): 3 flat tones of grass, orange dirt paths, striped cliff rock, sand shore with a pale foam line.
import * as T from 'three';
import {BIOMES,NB,PATH_GLSL} from './biomes.js';
import {toonMat} from './coatShader.js';

export const PIXEL_CELL=.02;      // size of one ground "pixel" in world units (smaller = finer pixels, larger = chunkier)
const USE_TOON=false;            // true = old toonMat lighting steps (adds extra shadow layers), false = plain lighting: one soft light / one soft shadow

const noise=pg=>`
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
float fbm2(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*vn(p);p=p*2.03+7.1;a*=.5;}return s;}
${pg}`;

function dataTex(data,w,h){const t=new T.DataTexture(data,w,h,T.RGBAFormat);t.magFilter=t.minFilter=T.LinearFilter;t.wrapS=t.wrapT=T.ClampToEdgeWrapping;t.generateMipmaps=false;t.needsUpdate=true;return t}

export function createGroundMaterial(world,env=null){
  const col=c=>new T.Color(c),m=USE_TOON?toonMat('#ffffff'):new T.MeshStandardMaterial({color:'#ffffff',roughness:1,metalness:0});
  const U={uT1:{value:dataTex(world.tex1,world.nx+1,world.nz+1)},uT2:{value:dataTex(world.tex2,world.nx+1,world.nz+1)},
    uOrg:{value:new T.Vector2(world.x0,world.z0)},uSz:{value:new T.Vector2(world.nx+1,world.nz+1)},uCell:{value:PIXEL_CELL},
    uGa:{value:BIOMES.map(b=>col(b.ground[0]))},uGb:{value:BIOMES.map(b=>col(b.ground[1]))},uGc:{value:BIOMES.map(b=>col(b.ground[2]))},
    uD1:{value:col('#e08a3a')},uD2:{value:col('#c9702e')},                                   // orange dirt path (light / dark)
    uLaneAll:{value:world.path&&world.path.all?1:0},uRock:{value:col('#9a8f86')},uSand:{value:col('#ecd9a0')},uMud:{value:col('#c2a46c')},uDetail:{value:0}};   // uDetail is unused by the pixel shader but worldMap.js setQuality() writes to it   // uMud = the sandy bed under water
  m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,U);
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;varying vec3 vWN;attribute float aSl;varying float vSl;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvWP=(modelMatrix*vec4(transformed,1.)).xyz;vWN=normalize(mat3(modelMatrix)*normal);vSl=aSl;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
      varying vec3 vWP;varying vec3 vWN;varying float vSl;uniform sampler2D uT1,uT2;uniform vec2 uOrg,uSz;uniform float uCell;
      uniform vec3 uGa[${NB}],uGb[${NB}],uGc[${NB}];uniform vec3 uRock,uSand,uMud,uD1,uD2;uniform float uLaneAll;${noise(world.path?world.path.glsl:PATH_GLSL)}`)
    .replace('#include <color_fragment>',`#include <color_fragment>
      {vec2 p=vWP.xz;
       vec2 cp=floor(p/uCell);vec2 q=(cp+.5)*uCell;                                          // snap to the pixel grid: everything below uses q, so edges are stair-stepped
       vec2 uv=(q-uOrg+.5)/uSz;vec4 t1=texture2D(uT1,uv),t2=texture2D(uT2,uv);
       float n1=fbm2(q*.35),n2=fbm2(q*1.1+11.3),n3=vn(q*2.7+3.1),n4=h21(cp*1.37+9.7);
       float w[${NB}];w[0]=t1.r;w[1]=t1.g;w[2]=t1.b;w[3]=t1.a;w[4]=t2.r;
       float ws=w[0]+w[1]+w[2]+w[3]+w[4]+1e-4;
       // ---- biome: the strongest weight wins (hard, pixel-stepped border)
       int bi=0;float bm=-1.;for(int i=0;i<${NB};i++){float v=w[i]+(n3-.5)*.1;if(v>bm){bm=v;bi=i;}}
       vec3 ca=vec3(0.),cb=vec3(0.),cc=vec3(0.);for(int i=0;i<${NB};i++){if(i==bi){ca=uGa[i];cb=uGb[i];cc=uGc[i];}}
       // ---- 3 flat tones of ground in blotchy pixel patches + single-pixel speckles
       float nb=fbm2(q*.06+5.);vec3 c=nb>.58?ca:cb;                                      // FLAT colour: one tone with big soft-edged patches of a second tone, no speckles
       // ---- dirt paths: hard pixel edge, orange, only inside the forest region
       float d=pathD(q)+(n2-.5)*.5;
       float lane=uLaneAll>.5?1.:step(.5,w[0]/ws);
       float pm=step(d,1.75)*lane;
       vec3 dirt=d>1.45?uD2:uD1;
       if(pm>.5)c=dirt;
       // ---- slopes: stippled earth first, then cliff rock with horizontal strata (always rock in the stone biome)
       // SMOOTH slope from the height field (not the flat facet normal): grass -> darker earth -> rock is a soft blend, with no hard polygon edge and no dither
       float sl=vSl+(n1-.5)*.035;
       float slm=max(smoothstep(.06,.24,sl),smoothstep(.25,.75,w[4]/ws));
       float band=floor(vWP.y*1.4+(vn(q*.5)-.5)*2.);float bh=h21(vec2(band,3.1));
       vec3 rk=uRock*(bh<.5?.88:1.06);
       if(pm<.5){c=mix(c,c*.72,smoothstep(0.,.5,slm));c=mix(c,rk,smoothstep(.4,.95,slm));}   // earth darkens first, then the striped rock takes over
       // ---- water edge: sand, a pale foam line right at the water, sandy bed underneath
       float sdv=t2.g*12.-3.+(n2-.5)*.8;
       if(sdv<2.+(n3-.5)*.7)c=uSand;
       if(sdv>0.&&sdv<.35+n3*.3)c=vec3(.96,.94,.86);
       if(sdv<0.)c=uMud;
       if(any(isnan(c))||dot(c,c)<.002)c=uGa[0];
       diffuseColor.rgb=c;}`)};
  m.defines=Object.assign(m.defines||{},{CEL_FLAT:''});   // the ground paints its own colours: no per-facet sun shading, so the ONLY dark layer on it is the cast shadow
  m.userData.U=U;m.customProgramCacheKey=()=>'biomeGround-soft3'+(world.path?world.path.key||'p':'')+(USE_TOON?'t':'s');return m}

/** LOW-POLY tiles: one tile per chunk (frustum culled), flat triangles on a world.ts grid (same split as worldGen: diagonal P10-P01), plus a flat skirt to the horizon */
export function buildGroundTiles(world,mat,CS=20){
  const g=new T.Group(),{x0,z0,nx,nz}=world,H=world.terrainAt,S=world.ts||1,n=Math.round(CS/S);
  for(let tx=x0;tx<x0+nx;tx+=CS)for(let tz=z0;tz<z0+nz;tz+=CS){
    const pos=new Float32Array(n*n*18),nor=new Float32Array(n*n*18),slA=new Float32Array(n*n*6);let o=0,so=0;
    const cs=new Float32Array((n+1)*(n+1));   // smooth slope (1 - normal.y) at every grid corner, from the height field: interpolated across each facet
    for(let i=0;i<=n;i++)for(let j=0;j<=n;j++){const x=tx+i*S,z=tz+j*S,gx=(H(x-S,z)-H(x+S,z))/(2*S),gz=(H(x,z-S)-H(x,z+S))/(2*S);cs[i*(n+1)+j]=1-1/Math.sqrt(1+gx*gx+gz*gz)}
    const sv=(a,b,c)=>{slA[so++]=a;slA[so++]=b;slA[so++]=c};
    const tri=(ax,az,bx,bz,cx,cz)=>{const ay=H(ax,az),by=H(bx,bz),cy=H(cx,cz),ux=bx-ax,uy=by-ay,uz=bz-az,vx=cx-ax,vy=cy-ay,vz=cz-az;
      let nx_=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz_=ux*vy-uy*vx;const l=Math.hypot(nx_,ny,nz_)||1;nx_/=l;ny/=l;nz_/=l;
      pos.set([ax,ay,az,bx,by,bz,cx,cy,cz],o);nor.set([nx_,ny,nz_,nx_,ny,nz_,nx_,ny,nz_],o);o+=9};
    for(let i=0;i<n;i++)for(let j=0;j<n;j++){const x=tx+i*S,z=tz+j*S;
      const c00=cs[i*(n+1)+j],c01=cs[i*(n+1)+j+1],c10=cs[(i+1)*(n+1)+j],c11=cs[(i+1)*(n+1)+j+1];
      tri(x,z, x,z+S, x+S,z);sv(c00,c01,c10);          // A, C, B   (counter-clockwise seen from above)
      tri(x+S,z, x,z+S, x+S,z+S);sv(c10,c01,c11)}      // B, C, D
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(pos,3));geo.setAttribute('normal',new T.BufferAttribute(nor,3));geo.setAttribute('aSl',new T.BufferAttribute(slA,1));geo.computeBoundingSphere();
    const m=new T.Mesh(geo,mat);m.receiveShadow=true;m.matrixAutoUpdate=false;g.add(m)}
  const sk=new T.Shape();sk.moveTo(-1400,-1400);sk.lineTo(1400,-1400);sk.lineTo(1400,1400);sk.lineTo(-1400,1400);sk.closePath();
  const hole=new T.Path();hole.moveTo(x0,z0);hole.lineTo(x0,z0+nz);hole.lineTo(x0+nx,z0+nz);hole.lineTo(x0+nx,z0);hole.closePath();sk.holes.push(hole);
  const skirt=new T.Mesh(new T.ShapeGeometry(sk).rotateX(-Math.PI/2),mat);skirt.receiveShadow=true;skirt.geometry.setAttribute('aSl',new T.BufferAttribute(new Float32Array(skirt.geometry.attributes.position.count),1));g.add(skirt);
  return g}
