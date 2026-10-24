// GROUND (own file): terrain tiles + one shader that paints every biome.
//   const mat=createGroundMaterial(world,env);   const tiles=buildGroundTiles(world,mat,20);   scene.add(tiles)
// The generator ships two small RGBA textures (1 texel per world unit): biome weights and shore distance. The fragment shader blends the biome colours.
// Biomes are REGIONS now (narrow soft borders), and the look is the forestMap look: height shading, dark forest floor + leaf litter, dirt lanes in the
// forest, steep slopes -> dirt / rock, shores -> sand, river / lake bed -> mud.
import * as T from 'three';
import {BIOMES,NB,PATH_GLSL} from './biomes.js';

const noise=pg=>`
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
float fbm2(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*vn(p);p=p*2.03+7.1;a*=.5;}return s;}
${pg}`;

function dataTex(data,w,h){const t=new T.DataTexture(data,w,h,T.RGBAFormat);t.magFilter=t.minFilter=T.LinearFilter;t.wrapS=t.wrapT=T.ClampToEdgeWrapping;t.generateMipmaps=false;t.needsUpdate=true;return t}

export function createGroundMaterial(world,env=null){
  const col=c=>new T.Color(c),m=new T.MeshStandardMaterial({color:'#ffffff',roughness:.97,metalness:0,envMap:env,envMapIntensity:.4});
  const U={uT1:{value:dataTex(world.tex1,world.nx+1,world.nz+1)},uT2:{value:dataTex(world.tex2,world.nx+1,world.nz+1)},
    uOrg:{value:new T.Vector2(world.x0,world.z0)},uSz:{value:new T.Vector2(world.nx+1,world.nz+1)},
    uGa:{value:BIOMES.map(b=>col(b.ground[0]))},uGb:{value:BIOMES.map(b=>col(b.ground[1]))},uGc:{value:BIOMES.map(b=>col(b.ground[2]))},
    uD1:{value:col('#c9a46b')},uD2:{value:col('#9b7646')},
    uLaneAll:{value:world.path&&world.path.all?1:0},uRock:{value:col('#8c8678')},uSand:{value:col('#d8c48d')},uMud:{value:col('#4b3a28')},uDetail:{value:1}};
  m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,U);
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;varying vec3 vWN;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvWP=(modelMatrix*vec4(transformed,1.)).xyz;vWN=normalize(mat3(modelMatrix)*normal);');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
      varying vec3 vWP;varying vec3 vWN;uniform float uDetail;uniform sampler2D uT1,uT2;uniform vec2 uOrg,uSz;
      uniform vec3 uGa[${NB}],uGb[${NB}],uGc[${NB}];uniform vec3 uRock,uSand,uMud,uD1,uD2;uniform float uLaneAll;${noise(world.path?world.path.glsl:PATH_GLSL)}`)
    .replace('#include <color_fragment>',`#include <color_fragment>
      {vec2 p=vWP.xz;float cd=length(p-cameraPosition.xz),far=smoothstep(30.,110.,cd);
       vec2 uv=(p-uOrg+.5)/uSz;vec4 t1=texture2D(uT1,uv),t2=texture2D(uT2,uv);
       float w[${NB}];w[0]=t1.r;w[1]=t1.g;w[2]=t1.b;w[3]=t1.a;w[4]=t2.r;
       float ws=w[0]+w[1]+w[2]+w[3]+w[4]+1e-4;
       float n1,n2,n3=.5,n4=.5;
       if(uDetail>.5){n1=fbm2(p*.04);n2=fbm2(p*.17+11.);n3=mix(vn(p*1.7),.5,far);n4=mix(vn(p*7.),.5,far);}else{n1=vn(p*.05);n2=vn(p*.2+11.);}
       float wf=w[0]/ws,wj=w[1]/ws,wd=w[3]/ws,wst=w[4]/ws;
       // ---- FOREST colour: exactly the forestMap ground (same maths, same colours)
       vec3 fo=mix(uGa[0],uGb[0],smoothstep(.3,.7,n1));
       fo=mix(fo,uGc[0],smoothstep(.6,.86,n2)*.5);
       fo*=.84+.3*n3;fo*=.92+.16*n4;
       fo*=.9+.028*clamp(vWP.y,-3.,6.);
       if(uDetail>.5)fo=mix(fo,uGb[0]*1.3,step(.94,vn(p*8.))*.3*(1.-far));
       float fw=smoothstep(.38,.58,fbm2(p*.03+7.));                                          // dense woods: patches inside the forest region
       fo=mix(fo,uGa[0]*vec3(.5,.6,.46),fw*.7);                                              // deep, shaded forest floor
       fo=mix(fo,vec3(.3,.24,.13),fw*smoothstep(.55,.7,n3+(n2-.5)*.4)*.55);                  // leaf litter patches
       // ---- the other biomes
       vec3 oc=vec3(0.);
       for(int i=1;i<${NB};i++){vec3 g=mix(mix(uGa[i],uGb[i],smoothstep(.3,.7,n1)),uGc[i],smoothstep(.6,.86,n2)*.5);oc+=g*(w[i]/(ws-w[0]+1e-4));}
       oc*=.84+.3*n3;oc*=.92+.16*n4;
       oc*=.9+.028*clamp(vWP.y,-3.,6.);
       oc*=1.-.07*wd*sin((p.x*.55+p.y*.2+n1*10.)*1.3);                                      // desert: long dune ripples
       oc*=1.-.28*wj*smoothstep(.45,.8,n2);                                                  // jungle floor: dark mossy patches
       if(uDetail>.5)oc=mix(oc,oc*1.3,step(.94,vn(p*8.))*.3*(1.-far));
       oc=mix(oc,vec3(.3,.24,.13),wj*.3*smoothstep(.55,.7,n3+(n2-.5)*.4));
       vec3 c=mix(oc,fo,wf);
       // ---- dirt lanes, only inside the forest region
       float d=pathD(p)+(n2-.5)*1.+(n3-.5)*.4;
       float lane=uLaneAll>.5?1.:smoothstep(.5,.85,wf);
       float pm=(1.-smoothstep(1.3,2.1,d))*lane;
       vec3 dirt=mix(uD1,uD2,smoothstep(.25,.75,n2));dirt*=.86+.28*n4;
       if(uDetail>.5)dirt=mix(dirt,uD2*.55,step(.87,vn(p*15.))*.55*(1.-far));
       c*=1.-.28*smoothstep(1.3,1.9,d)*(1.-smoothstep(1.9,2.6,d))*lane;                     // darker grass hugging the lane
       c=mix(c,dirt,pm);
       // ---- steep slopes: earth, then rock (always rock in the stone highlands)
       float sl=1.-clamp(normalize(vWN).y,0.,1.);
       vec3 slopeC=mix(mix(uD2,uRock,smoothstep(.16,.3,sl)),uRock*(.8+.4*n3)*(.9+.2*n4),wst);
       c=mix(c,slopeC,smoothstep(.07,.2,sl)*(.8+.15*wst)*(1.-pm*.6));
       // ---- water edge: sand, then mud
       float sdv=t2.g*12.-3.+(n2-.5)*.8;                                                   // distance to the water edge (negative = under water)
       c=mix(c,uSand*(.92+.16*n4),(1.-smoothstep(.1,2.4,sdv))*.85);
       c=mix(c,uMud,1.-smoothstep(-.6,.3,sdv));
       if(any(isnan(c))||dot(c,c)<.002)c=uGa[0]*(.9+.2*n3);                                  // safety: a NaN / empty weight sum must never paint the ground black
       diffuseColor.rgb=c;}`)};
  m.userData.U=U;m.customProgramCacheKey=()=>'biomeGround3'+(world.path?world.path.key||'p':'');return m}

/** one tile per chunk (frustum culled) on the same 1-unit grid as terrainAt, plus a flat skirt out to the horizon */
export function buildGroundTiles(world,mat,CS=20){
  const g=new T.Group(),{x0,z0,nx,nz}=world,T_=world.terrainAt;
  for(let tx=x0;tx<x0+nx;tx+=CS)for(let tz=z0;tz<z0+nz;tz+=CS){
    const geo=new T.PlaneGeometry(CS,CS,CS,CS).rotateX(-Math.PI/2).translate(tx+CS/2,0,tz+CS/2),pa=geo.attributes.position,na=geo.attributes.normal;
    for(let i=0;i<pa.count;i++){const x=pa.getX(i),z=pa.getZ(i);pa.setY(i,T_(x,z));
      const dx=T_(x-1,z)-T_(x+1,z),dz=T_(x,z-1)-T_(x,z+1),l=Math.hypot(dx*.5,1,dz*.5);na.setXYZ(i,dx*.5/l,1/l,dz*.5/l)}   // slope normals: no seams between tiles
    const m=new T.Mesh(geo,mat);m.receiveShadow=true;m.matrixAutoUpdate=false;g.add(m)}
  const sk=new T.Shape();sk.moveTo(-1400,-1400);sk.lineTo(1400,-1400);sk.lineTo(1400,1400);sk.lineTo(-1400,1400);sk.closePath();
  const hole=new T.Path();hole.moveTo(x0,z0);hole.lineTo(x0,z0+nz);hole.lineTo(x0+nx,z0+nz);hole.lineTo(x0+nx,z0);hole.closePath();sk.holes.push(hole);
  const skirt=new T.Mesh(new T.ShapeGeometry(sk).rotateX(-Math.PI/2),mat);skirt.receiveShadow=true;g.add(skirt);
  return g}