// BIG HILLY FOREST (wave mode): 240 x 160, built like the 5v5 arena:
//  - premade models (addTree / addBush from trees.js, polished rocks, merged + wind-animated by batch.js), grass + flowers from their own model (grass.js)
//  - CHUNK STREAMING: only the layout (collision list + where everything goes) exists at start. A 20x20 chunk gets its meshes the first time it is
//    near the player, is drawn only while near (grass / flowers have shorter ranges) and is freed when far. Ground is tiled too, so it is frustum culled.
//  - AREAS: three dense forests (hundreds of trees, mossy floor, logs, mushrooms), open meadows with a few hero trees, four lakes (walkable water that
//    ripples) and two rocky lakes with boulders standing in the water, plus dirt lanes winding through the woods.
import * as T from 'three';
import {addTree,addBush} from './trees.js';
import {addRockPolished} from './rocksPolish.js';
import {createGrass} from './grass.js';
import {Batch,WIND,mat4,softLump,vnoise,fbm3} from './batch.js';
import {W,H,HW,HH,SPAWN,FORESTS,PONDS,ROCKY,PONDL,PATH_GLSL,pathD,forestW,terrainAt,heightAt,waterAt,GRID} from './forestTerrain.js';
export {W,H};

const rng=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
const hseed=(a,b,c)=>(Math.imul(a+101,73856093)^Math.imul(b+211,19349663)^Math.imul(c,83492791))>>>0;
const col=c=>new T.Color(c);
const NOISE_GLSL=`
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
float fbm2(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*vn(p);p=p*2.03+7.1;a*=.5;}return s;}
${PATH_GLSL}`;

// ------------------------------------------------------------------------------------------------ ground (grass, mossy forest floor, lanes, steep slopes -> rock, lake shores)
function groundMaterial(env){
  const m=new T.MeshStandardMaterial({color:'#ffffff',roughness:.97,metalness:0,envMap:env,envMapIntensity:.4});
  const U={uG1:{value:col('#4a903c')},uG2:{value:col('#88c45a')},uG3:{value:col('#a8b45a')},uD1:{value:col('#c9a46b')},uD2:{value:col('#9b7646')},uMud:{value:col('#4b3a28')},uSand:{value:col('#d8c48d')},uRock:{value:col('#8c8678')},uDetail:{value:1},
    uPonds:{value:PONDS.map(p=>new T.Vector3(p[0],p[1],p[2]))},uFor:{value:FORESTS.map(f=>new T.Vector3(f[0],f[1],f[2]))}};
  m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,U);
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;varying vec3 vWN;').replace('#include <begin_vertex>','#include <begin_vertex>\nvWP=(modelMatrix*vec4(transformed,1.)).xyz;vWN=normalize(mat3(modelMatrix)*normal);');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
      varying vec3 vWP;varying vec3 vWN;uniform float uDetail;uniform vec3 uG1,uG2,uG3,uD1,uD2,uMud,uSand,uRock;uniform vec3 uPonds[${PONDS.length}];uniform vec3 uFor[${FORESTS.length}];${NOISE_GLSL}`)
    .replace('#include <color_fragment>',`#include <color_fragment>
      {vec2 p=vWP.xz;float cd=length(p-cameraPosition.xz),far=smoothstep(30.,110.,cd);
       float n1,n2,n3=.5,n4=.5;if(uDetail>.5){n1=fbm2(p*.04);n2=fbm2(p*.17+11.);n3=mix(vn(p*1.7),.5,far);n4=mix(vn(p*7.),.5,far);}else{n1=vn(p*.05);n2=vn(p*.2+11.);}
       vec3 grass=mix(uG1,uG2,smoothstep(.3,.7,n1));
       grass=mix(grass,uG3,smoothstep(.6,.86,n2)*.5);
       grass*=.84+.3*n3;grass*=.92+.16*n4;
       grass*=.9+.028*clamp(vWP.y,-3.,6.);
       if(uDetail>.5)grass=mix(grass,uG2*1.3,step(.94,vn(p*8.))*.3*(1.-far));
       float fw=0.;for(int i=0;i<${FORESTS.length};i++){vec3 f=uFor[i];fw=max(fw,1.-smoothstep(f.z*.45,f.z,length(p-f.xy)+(n2-.5)*7.));}
       grass=mix(grass,uG1*vec3(.5,.6,.46),fw*.7);                                  // deep, shaded forest floor
       grass=mix(grass,vec3(.3,.24,.13),fw*smoothstep(.55,.7,n3+(n2-.5)*.4)*.55);    // leaf litter patches
       float d=pathD(p)+(n2-.5)*1.0+(n3-.5)*.4;
       float pm=1.-smoothstep(1.3,2.1,d);
       vec3 dirt=mix(uD1,uD2,smoothstep(.25,.75,n2));dirt*=.86+.28*n4;
       if(uDetail>.5)dirt=mix(dirt,uD2*.55,step(.87,vn(p*15.))*.55*(1.-far));
       grass*=1.-.28*smoothstep(1.3,1.9,d)*(1.-smoothstep(1.9,2.6,d));
       vec3 c=mix(grass,dirt,pm);
       float sl=1.-clamp(normalize(vWN).y,0.,1.);
       c=mix(c,mix(uD2,uRock,smoothstep(.16,.3,sl)),smoothstep(.07,.2,sl)*.8*(1.-pm*.6));
       for(int i=0;i<${PONDS.length};i++){vec3 pd=uPonds[i];float dd=length(p-pd.xy)-pd.z+(n2-.5)*.8;
         c=mix(c,uSand,(1.-smoothstep(.2,1.6,dd))*.85);
         c=mix(c,uMud,1.-smoothstep(-.3,.5,dd));}
       diffuseColor.rgb=c;}`)};
  m.userData.U=U;m.customProgramCacheKey=()=>'forestGround';return m}

// ------------------------------------------------------------------------------------------------ water (+ ripples from up to 16 recent footsteps)
function waterMaterial(r,RIP){
  const m=new T.ShaderMaterial({transparent:true,fog:true,depthWrite:false,
    uniforms:T.UniformsUtils.merge([T.UniformsLib.fog,{uTime:{value:0},uR:{value:r},uDeep:{value:col('#1d6f9a')},uShallow:{value:col('#5ec2d4')},uSky:{value:col('#9ccdf0')},uSun:{value:new T.Vector3(.4,.6,.5)},uSunCol:{value:col('#fff0cc')},uRip:{value:RIP}}]),
    vertexShader:`varying vec3 vW;varying vec2 vL;
      #include <fog_pars_vertex>
      void main(){vL=position.xz;vec4 wp=modelMatrix*vec4(position,1.);vW=wp.xyz;vec4 mvPosition=viewMatrix*wp;gl_Position=projectionMatrix*mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader:`varying vec3 vW;varying vec2 vL;uniform float uTime,uR;uniform vec3 uDeep,uShallow,uSky,uSun,uSunCol;uniform vec4 uRip[16];
      #include <fog_pars_fragment>
      ${NOISE_GLSL}
      // expanding rings: uRip[i] = (x, z, start time, strength)
      float ripH(vec2 p){float h=0.;for(int i=0;i<16;i++){vec4 r=uRip[i];float age=uTime-r.z;
        if(age>0.&&age<2.8&&r.w>0.){float d=length(p-r.xy),x=d-age*1.6;h+=sin(x*13.)*exp(-x*x*3.)*(1.-age/2.8)*r.w/(1.+d*.5);}}return h;}
      float hgt(vec2 p){float t=uTime;return fbm2(p*1.1+vec2(t*.12,t*.08))*.7+fbm2(p*2.7-vec2(t*.2,-t*.14))*.3+ripH(p)*.3;}
      void main(){vec2 p=vW.xz;float e=.06,h0=hgt(p);vec3 N=normalize(vec3((h0-hgt(p+vec2(e,0.)))*5.5,1.,(h0-hgt(p+vec2(0.,e)))*5.5));
        vec3 V=normalize(cameraPosition-vW);float fres=.04+.96*pow(1.-max(dot(N,V),0.),4.);
        float d=length(vL)/uR;vec3 base=mix(uDeep,uShallow,smoothstep(.35,1.,d));
        vec3 R=reflect(-V,N);float sd=max(dot(R,normalize(uSun)),0.);
        vec3 col=mix(base,uSky*.7,clamp(fres*.9,0.,1.));col+=uSunCol*(pow(sd,300.)*2.5+pow(sd,24.)*.08);
        col+=vec3(.8,.93,1.)*clamp(abs(ripH(p))*.8,0.,.45);
        float ring=fbm2(p*.8+uTime*.05);float foam=smoothstep(.9,.99,d+(ring-.5)*.1);col=mix(col,vec3(.95),foam*.5);
        float a=mix(.9,.98,fres);a*=1.-smoothstep(.985,1.,d);
        gl_FragColor=vec4(col,a);
      #include <fog_fragment>
      }`});
  m.uniforms.uRip.value=RIP;return m}

// ------------------------------------------------------------------------------------------------ tuning
const CS=20,ACT=72,ACT_G=46,ACT_F=32,UNLOAD=100;   // chunk size; draw range of scenery / grass / flowers; chunks beyond UNLOAD are freed (speed vs. view distance)
const cid=v=>Math.floor(v/CS);

export function buildMap(seed=7,env=null){
  const R=rng(seed),g=new T.Group(),obs=[],dyn=[],chunks=new Map(),sd=()=>(R()*1e9)|0;
  const chunkAt=(x,z)=>{const cx=cid(x),cz=cid(z),k=cx+','+cz;let c=chunks.get(k);
    if(!c){c={cx,cz,x0:cx*CS,z0:cz*CS,x1:cx*CS+CS,z1:cz*CS+CS,trees:[],bushes:[],rocks:[],pebbles:[],logs:[],shrooms:[],pond:[],loaded:false,grp:null,grass:null,flowers:null,d:1e9};chunks.set(k,c)}return c};
  // collision list + a spatial hash so the layout can ask "is something within r of here?" quickly even with hundreds of obstacles
  const OG=new Map(),okey=(x,z)=>Math.floor(x/6)+','+Math.floor(z/6);
  const addObs=o=>{obs.push(o);const k=okey(o.x,o.z);let a=OG.get(k);if(!a)OG.set(k,a=[]);a.push(o)};
  const clear=(x,z,m)=>{const cx=Math.floor(x/6),cz=Math.floor(z/6);for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){const a=OG.get((cx+i)+','+(cz+j));if(a)for(const o of a)if(Math.hypot(o.x-x,o.z-z)<o.r+m)return false}return true};
  const KEEP=[[SPAWN.x,SPAWN.z,9]];
  const free=(x,z,m=0)=>pathD(x,z)>2.6+m&&PONDS.every(p=>Math.hypot(x-p[0],z-p[1])>p[2]+2.5+m)&&KEEP.every(k=>Math.hypot(x-k[0],z-k[1])>k[2]+m);
  const wet=(x,z,m)=>PONDS.some(p=>Math.hypot(x-p[0],z-p[1])<p[2]+m);
  const inW=(x,z,m=4)=>Math.abs(x)<HW-m&&Math.abs(z)<HH-m;

  // ---- lakes: lily pads, flowers, reeds, shore pebbles.  Lakes are NOT in obs: you can walk on the water and bullets pass over it.
  PONDS.forEach(([x,z,r],k)=>{const L=PONDL[k];
    for(let i=0,n=Math.round(r*1.2);i<n;i++){const q=R()*6.28,d=R()*(r-1.3),lx=x+Math.cos(q)*d,lz=z+Math.sin(q)*d;chunkAt(lx,lz).pond.push({t:'lily',x:lx,z:lz,y:L+.03,s:.28+R()*.22,ry:R()*6,fl:i%3===0})}
    for(let i=0,n=Math.round(r*4);i<n;i++){const q=R()*6.28,d=r+.6+R()*1.8,px=x+Math.cos(q)*d,pz=z+Math.sin(q)*d;chunkAt(px,pz).pebbles.push({x:px,z:pz,r:.07+R()*.13,seed:sd()})}
    for(let i=0,n=Math.round(r*1.1);i<n;i++){const q=R()*6.28,d=r+.3+R()*1.1,px=x+Math.cos(q)*d,pz=z+Math.sin(q)*d;chunkAt(px,pz).pond.push({t:'reed',x:px,z:pz,h:.7+R()*.7,tilt:[(R()-.5)*.3,R()*6,(R()-.5)*.3],ph:R()*20})}});
  // rocky lakes: boulders standing IN the water (they collide), small stepping stones, and a rocky shore
  for(const k of ROCKY){const [x,z,r]=PONDS[k],L=PONDL[k];
    for(let i=0,n=0;i<200&&n<Math.round(r*.9);i++){const q=R()*6.28,d=R()*(r-1.5),bx=x+Math.cos(q)*d,bz=z+Math.sin(q)*d,br=.8+R()*1.1;if(!clear(bx,bz,br+.9))continue;
      chunkAt(bx,bz).rocks.push({x:bx,z:bz,r:br,moss:R()<.4,seed:sd(),y:L-.3});addObs({x:bx,z:bz,r:br*.95});n++;
      if(R()<.6){const sx=bx+br*1.2,sz=bz+br*.4;chunkAt(sx,sz).rocks.push({x:sx,z:sz,r:br*.4,moss:false,seed:sd(),y:L-.2})}}
    for(let i=0,n=Math.round(r*1.4);i<n;i++){const q=R()*6.28,d=R()*(r-.6),sx=x+Math.cos(q)*d,sz=z+Math.sin(q)*d;chunkAt(sx,sz).pebbles.push({x:sx,z:sz,r:.2+R()*.25,seed:sd(),y:L-.12})}
    for(let i=0,n=0;i<200&&n<Math.round(r*.8);i++){const q=R()*6.28,d=r+1.2+R()*2.4,bx=x+Math.cos(q)*d,bz=z+Math.sin(q)*d,br=.6+R()*.9;if(!inW(bx,bz)||!clear(bx,bz,br+.8))continue;
      chunkAt(bx,bz).rocks.push({x:bx,z:bz,r:br,moss:R()<.5,seed:sd()});addObs({x:bx,z:bz,r:br*.95});n++}}

  // ---- forest wall around the world (premade trees, low detail, no collision needed) ...
  for(let k=0;k<3;k++){const dz=HH+1.5+k*3.6,dx=HW+1.5+k*3.6,sc=1.2+k*.2,st=4.2;
    for(let x=-dx-3;x<=dx+3;x+=st)for(const sg of[-1,1])if(R()<.93){const tx=x+(R()-.5)*2,tz=sg*(dz+(R()-.5)*1.6);chunkAt(tx,tz).trees.push({x:tx,z:tz,s:sc*(.85+R()*.5),q:'lo',seed:sd()})}
    for(let z=-dz;z<=dz;z+=st)for(const sg of[-1,1])if(R()<.93){const tx=sg*(dx+(R()-.5)*1.6),tz=z+(R()-.5)*2;chunkAt(tx,tz).trees.push({x:tx,z:tz,s:sc*(.85+R()*.5),q:'lo',seed:sd()})}}
  // ---- ... DENSE FORESTS: trees packed between the lanes, thickest at the middle of each wood
  FORESTS.forEach(([fx,fz,fr])=>{
    for(let i=0,n=0;i<5000&&n<150;i++){const a=R()*6.283,d=Math.sqrt(R())*fr,x=fx+Math.cos(a)*d,z=fz+Math.sin(a)*d,w=forestW(x,z);
      if(!inW(x,z,3)||R()>Math.pow(w,.7)||!free(x,z,.3)||!clear(x,z,1.35))continue;
      chunkAt(x,z).trees.push({x,z,s:.95+R()*.6,q:R()<.4?'hi':'lo',seed:sd()});addObs({x,z,r:.65});n++}
    for(let i=0,n=0;i<400&&n<34;i++){const a=R()*6.283,d=Math.sqrt(R())*fr*.9,x=fx+Math.cos(a)*d,z=fz+Math.sin(a)*d;if(!inW(x,z,3)||!free(x,z,.5)||!clear(x,z,1.4))continue;     // fallen logs
      const ry=R()*3;chunkAt(x,z).logs.push({x,z,ry,seed:sd()});[-.8,.8].forEach(dd=>addObs({x:x+Math.cos(ry)*dd,z:z-Math.sin(ry)*dd,r:.5}));n++}
    for(let i=0,n=0;i<400&&n<14;i++){const a=R()*6.283,d=Math.sqrt(R())*fr*.9,x=fx+Math.cos(a)*d,z=fz+Math.sin(a)*d,r=.8+R()*1.0;if(!inW(x,z,3)||!free(x,z,.2)||!clear(x,z,r+1.2))continue;   // mossy boulders
      chunkAt(x,z).rocks.push({x,z,r,moss:true,seed:sd()});addObs({x,z,r:r*.95});n++}
    for(let i=0;i<70;i++){const a=R()*6.283,d=Math.sqrt(R())*fr,x=fx+Math.cos(a)*d,z=fz+Math.sin(a)*d;if(inW(x,z,2)&&free(x,z,-1.2))chunkAt(x,z).bushes.push({x,z,k:.8+R()*.8,berries:R()<.3,seed:sd()})}   // undergrowth
    for(let i=0;i<34;i++){const a=R()*6.283,d=Math.sqrt(R())*fr,x=fx+Math.cos(a)*d,z=fz+Math.sin(a)*d;if(inW(x,z,2)&&free(x,z,-1))chunkAt(x,z).shrooms.push({x,z,k:.8+R()*.7})}});
  // ---- meadows between the woods: a few hero trees, rocks, logs, bushes, mushrooms
  for(let i=0,n=0;i<4000&&n<90;i++){const x=(R()-.5)*(W-8),z=(R()-.5)*(H-8);if(forestW(x,z)>.15||!free(x,z,.4)||!clear(x,z,4.5))continue;
    chunkAt(x,z).trees.push({x,z,s:.95+R()*.45,q:'hi',seed:sd()});addObs({x,z,r:.65});n++}
  for(let i=0,n=0;i<4000&&n<46;i++){const x=(R()-.5)*(W-6),z=(R()-.5)*(H-6),r=.7+R()*.9;if(forestW(x,z)>.15||!free(x,z,.2)||!clear(x,z,r+1.5))continue;
    chunkAt(x,z).rocks.push({x,z,r,moss:R()<.5,seed:sd()});addObs({x,z,r:r*.95});n++;
    if(R()<.6){const sx=x+r*1.3,sz=z+.3;chunkAt(sx,sz).rocks.push({x:sx,z:sz,r:r*.45,moss:R()<.5,seed:sd()})}
    if(R()<.4){const sx=x-r*1.1,sz=z-.5;chunkAt(sx,sz).rocks.push({x:sx,z:sz,r:r*.3,moss:false,seed:sd()})}}
  for(let i=0;i<700;i++){const x=(R()-.5)*(W+10),z=(R()-.5)*(H+10);if(pathD(x,z)>3.2||wet(x,z,1))continue;chunkAt(x,z).pebbles.push({x,z,r:.05+R()*.1,seed:sd()})}   // lane pebbles
  for(let i=0,n=0;i<600&&n<12;i++){const x=(R()-.5)*(W-12),z=(R()-.5)*(H-12);if(forestW(x,z)>.15||!free(x,z,.6)||!clear(x,z,3))continue;const ry=R()*3;
    chunkAt(x,z).logs.push({x,z,ry,seed:sd()});[-.8,.8].forEach(d=>addObs({x:x+Math.cos(ry)*d,z:z-Math.sin(ry)*d,r:.5}));n++}
  for(let i=0;i<150;i++){const x=(R()-.5)*(W-2),z=(R()-.5)*(H-2);if(forestW(x,z)<=.15&&free(x,z,-1.2))chunkAt(x,z).bushes.push({x,z,k:.8+R()*.8,berries:i%3===0,seed:sd()})}
  for(let i=0;i<60;i++){const x=(R()-.5)*(W-2),z=(R()-.5)*(H-2);if(forestW(x,z)<=.15&&free(x,z,-1))chunkAt(x,z).shrooms.push({x,z,k:.8+R()*.7})}

  // ---- ground: tiles (one per chunk, same 1-unit grid as terrainAt, so the renderer can cull them) + a flat skirt out to the horizon
  const gMat=groundMaterial(env),GX0=GRID.x0,GZ0=GRID.z0,GXW=GRID.nx,GZW=GRID.nz,tiles=new T.Group();g.add(tiles);
  for(let tx=GX0;tx<GX0+GXW;tx+=CS)for(let tz=GZ0;tz<GZ0+GZW;tz+=CS){
    const geo=new T.PlaneGeometry(CS,CS,CS,CS).rotateX(-Math.PI/2).translate(tx+CS/2,0,tz+CS/2),pa=geo.attributes.position,na=geo.attributes.normal;
    for(let i=0;i<pa.count;i++){const x=pa.getX(i),z=pa.getZ(i);pa.setY(i,terrainAt(x,z));
      const nx=terrainAt(x-1,z)-terrainAt(x+1,z),nz=terrainAt(x,z-1)-terrainAt(x,z+1),l=Math.hypot(nx*.5,1,nz*.5);na.setXYZ(i,nx*.5/l,1/l,nz*.5/l)}   // slope normals: no seams between tiles
    const m=new T.Mesh(geo,gMat);m.receiveShadow=true;m.matrixAutoUpdate=false;tiles.add(m)}
  const sk=new T.Shape();sk.moveTo(-600,-600);sk.lineTo(600,-600);sk.lineTo(600,600);sk.lineTo(-600,600);sk.closePath();
  const hole=new T.Path();hole.moveTo(GX0,GZ0);hole.lineTo(GX0,GZ0+GZW);hole.lineTo(GX0+GXW,GZ0+GZW);hole.lineTo(GX0+GXW,GZ0);hole.closePath();sk.holes.push(hole);
  const skirt=new T.Mesh(new T.ShapeGeometry(sk).rotateX(-Math.PI/2),gMat);skirt.receiveShadow=true;g.add(skirt);

  // ---- water: flat discs at the walking level + ripple emitters
  const RIP=Array.from({length:16},()=>new T.Vector4(0,0,-99,0));let ri=0,lastT=0;const walkT=new Map(),ponds3d=[];
  PONDS.forEach(([x,z,r],k)=>{const w=new T.Mesh(new T.CircleGeometry(r+1.4,56).rotateX(-Math.PI/2),waterMaterial(r+1.4,RIP));w.position.set(x,PONDL[k]-.03,z);w.renderOrder=2;w.userData.dyn=1;g.add(w);dyn.push(w);ponds3d.push(w)});
  const ripple=(x,z,a=1)=>{RIP[ri].set(x,z,lastT,a);ri=(ri+1)&15};
  /** call every frame for anything that walks: makes a ripple (max ~5 per second per walker) when it moves on water */
  const walk=(id,x,z,moving)=>{if(!moving||waterAt(x,z)<0)return;if(lastT-(walkT.get(id)??-9)<.2)return;walkT.set(id,lastT);ripple(x,z,.85)};

  // ---- chunk building
  const grass=createGrass(env),CHUNKROOT=new T.Group();g.add(CHUNKROOT);let gFrac=1;
  const okGrass=(x,z)=>pathD(x,z)>=1.5&&!wet(x,z,.7)&&Math.abs(terrainAt(x+1,z)-terrainAt(x-1,z))+Math.abs(terrainAt(x,z+1)-terrainAt(x,z-1))<1;
  const okFlower=(x,z)=>pathD(x,z)>=1.7&&!wet(x,z,.9)&&forestW(x,z)<.7;     // fewer flowers deep in the woods
  function buildChunk(c){
    const B=new Batch(),y0=(x,z)=>terrainAt(x,z);
    // the premade models place themselves at y=0: this wrapper lifts every piece onto the terrain and shifts the sway base with it
    const on=y=>({add:(kind,geo,m,color,o)=>{const mm=m.clone();mm.elements[13]+=y;B.add(kind,geo,mm,color,o&&o.wind?{...o,wind:{...o.wind,base:o.wind.base+y}}:o)}});
    for(const t of c.trees)addTree(on(y0(t.x,t.z)),rng(t.seed),t.x,t.z,t.s,t.q);
    for(const b of c.bushes)addBush(on(y0(b.x,b.z)),rng(b.seed),b.x,b.z,b.k,b.berries);
    for(const r of c.rocks)addRockPolished(B,rng(r.seed),r.x,r.z,r.r,r.moss,r.y??y0(r.x,r.z));
    for(const p of c.pebbles)addRockPolished(B,rng(p.seed),p.x,p.z,p.r,false,p.y??y0(p.x,p.z));
    for(const l of c.logs){const R2=rng(l.seed),ca=Math.cos(l.ry),sa=Math.sin(l.ry),y=Math.max(y0(l.x,l.z),y0(l.x+ca*1.35,l.z-sa*1.35),y0(l.x-ca*1.35,l.z+sa*1.35))-.05;
      const lg=new T.CylinderGeometry(.4,.43,2.7,10,1).rotateZ(Math.PI/2),base=mat4(l.x,y+.4,l.z,1,1,1,0,l.ry,0);
      B.add('bark',lg,base,'#7d5434',{varS:3,varA:.4});[-1,1].forEach(s=>B.add('prop',new T.CylinderGeometry(.37,.37,.05,10).rotateZ(Math.PI/2),base.clone().multiply(mat4(s*1.35,0,0)),'#e8c79a',{varA:.15}));
      B.add('foliage',softLump(1,.2,3),base.clone().multiply(mat4(.3,.32,.05,.55,.18,.3)),'#5c9a4a',{wind:{base:y,span:2,gain:.2,phase:R2()*9}})}
    for(const s of c.shrooms){const y=y0(s.x,s.z),k=s.k;
      B.add('prop',new T.CylinderGeometry(.6,.9,2.2,7).translate(0,1.1,0),mat4(s.x,y,s.z,.07*k,.0727*k,.07*k),'#f4ead0',{grad:(a,t)=>.8+.2*t});
      B.add('prop',softLump(1,.06,1),mat4(s.x,y+.2*k,s.z,.2*k,.11*k,.2*k),k>1?'#e8453c':'#ff9a3c',{grad:(a,t)=>.8+.3*t})}
    for(const p of c.pond){
      if(p.t==='lily'){B.add('prop',new T.CircleGeometry(1,10).rotateX(-Math.PI/2),mat4(p.x,p.y,p.z,p.s,1,p.s,0,p.ry,0),'#4aa04c',{varA:.25});
        if(p.fl)B.add('prop',new T.IcosahedronGeometry(1,1),mat4(p.x,p.y+.04,p.z,.1,.07,.1),'#ff9fc4',{varA:.1})}
      else{const y=y0(p.x,p.z);B.add('foliage',new T.ConeGeometry(.06,p.h,4,1).translate(0,p.h/2,0),mat4(p.x,y,p.z,1,1,1,p.tilt[0],p.tilt[1],p.tilt[2]),'#5d9b45',{wind:{base:y,span:p.h,gain:1,phase:p.ph},grad:(a,b)=>.7+.5*(b/p.h)})}}
    c.grp=B.build(env);CHUNKROOT.add(c.grp);
    const Rg=rng(hseed(c.cx,c.cz,seed)),area=(c.x1-c.x0)*(c.z1-c.z0);
    c.grass=grass.scatter({x0:c.x0,z0:c.z0,x1:c.x1,z1:c.z1,rng:Rg,at:y0,accept:okGrass,tries:Math.round(area*2.6),max:Math.round(area*1.9)});
    c.flowers=grass.flowers({x0:c.x0,z0:c.z0,x1:c.x1,z1:c.z1,rng:Rg,at:y0,accept:okFlower,tries:Math.round(area*.3),max:Math.round(area*.14)});
    if(c.grass)CHUNKROOT.add(c.grass);if(c.flowers)CHUNKROOT.add(c.flowers);
    [c.grp,c.grass,c.flowers].forEach(o=>o&&o.traverse(m=>{m.matrixAutoUpdate=false;m.updateMatrix()}));   // static
    c.loaded=true;applyQ(c)}
  function unloadChunk(c){
    c.grp.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose()}});CHUNKROOT.remove(c.grp);c.grp=null;
    if(c.grass){grass.dispose(c.grass);CHUNKROOT.remove(c.grass);c.grass=null}
    if(c.flowers){grass.disposeFlowers(c.flowers);CHUNKROOT.remove(c.flowers);c.flowers=null}
    c.loaded=false}
  function applyQ(c){if(c.grass){c.grass.count=Math.floor(c.grass.userData.n*gFrac)}
    if(c.flowers)c.flowers.userData.meshes.forEach(m=>m.count=Math.floor(m.userData.n*gFrac))}
  const near=(c,x,z)=>Math.hypot(Math.max(c.x0-x,0,x-c.x1),Math.max(c.z0-z,0,z-c.z1));
  /** load the chunks closest to (x,z); always at least one per call, then as many as fit in budgetMs. Also unloads far ones and sets what is drawn. */
  function stream(px,pz,budgetMs){
    const need=[];
    for(const c of chunks.values()){c.d=near(c,px,pz);if(!c.loaded&&c.d<=ACT)need.push(c);else if(c.loaded&&c.d>UNLOAD)unloadChunk(c)}
    need.sort((a,b)=>a.d-b.d);const t0=performance.now();
    for(let i=0;i<need.length;i++){if(i>0&&performance.now()-t0>budgetMs)break;buildChunk(need[i])}
    for(const c of chunks.values()){if(!c.loaded)continue;c.grp.visible=c.d<=ACT+8;
      if(c.grass)c.grass.visible=gFrac>0&&c.d<=ACT_G;if(c.flowers)c.flowers.visible=gFrac>0&&c.d<=ACT_F}
    ponds3d.forEach((w,k)=>w.visible=near({x0:PONDS[k][0],x1:PONDS[k][0],z0:PONDS[k][1],z1:PONDS[k][1]},px,pz)<ACT+PONDS[k][2])}
  /** build everything within radius of (x,z) right now (used at start, so there is no pop-in around you) */
  function prime(x,z,radius=60){for(const c of chunks.values())if(!c.loaded&&near(c,x,z)<=radius)buildChunk(c);stream(x,z,0)}

  // ---- distant forested hills
  const d=new T.Object3D(),a=new T.Color(),b=new T.Color();
  const hills=(Rr,h0,h1,seedK,tone)=>{const SEG=180,pos=[],cl=[],idx=[],prof=[[Rr+16,-6,0],[Rr,1,1],[Rr-10,.55,.5],[Rr-26,-.5,.05]];
    const crest=an=>h0+h1*fbm3(Math.cos(an)*1.4+seedK,Math.sin(an)*1.4,seedK)+h1*.5*vnoise(an*9,seedK,1);
    for(let i=0;i<=SEG;i++){const an=i/SEG*Math.PI*2,hh=crest(an);prof.forEach(([r,f,c])=>{pos.push(Math.cos(an)*r,f<0?f:hh*f,Math.sin(an)*r);const k=.55+.45*c,t=new T.Color(tone).multiplyScalar(k);cl.push(t.r,t.g,t.b)})}
    for(let i=0;i<SEG;i++)for(let r=0;r<3;r++){const p=i*4+r,q=(i+1)*4+r;idx.push(p,p+1,q,q,p+1,q+1)}
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('color',new T.Float32BufferAttribute(cl,3));geo.setIndex(idx);geo.computeVertexNormals();
    g.add(new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,roughness:1,side:T.DoubleSide,envMap:env,envMapIntensity:.3})));
    const TN=900,cones=new T.InstancedMesh(new T.ConeGeometry(1,1,6,1).translate(0,.5,0),new T.MeshStandardMaterial({roughness:1,envMap:env,envMapIntensity:.3}),TN);
    for(let i=0;i<TN;i++){const an=R()*6.283,dd=R(),r=Rr+8-dd*24,hh=crest(an)*(dd<.35?1-(1-dd/.35)*.2:.55*(1-(dd-.35)/.65)+.12),s=3+R()*5;
      d.position.set(Math.cos(an)*r,hh-.5,Math.sin(an)*r);d.scale.set(s*.45,s,s*.45);d.rotation.set(0,R()*6,0);d.updateMatrix();cones.setMatrixAt(i,d.matrix);cones.setColorAt(i,a.set(tone).lerp(b.set('#1d4a35'),R()*.6).multiplyScalar(.7+R()*.4))}
    g.add(cones)};
  hills(212,14,15,1.7,'#3b7a47');hills(262,26,24,5.3,'#4a8a58');

  // ---- fireflies + pollen: only a bubble around the player, re-wrapped as you move (nothing simulated far away)
  const FF=90,fp=new Float32Array(FF*3),fo=[];for(let i=0;i<FF;i++)fo.push([(R()-.5)*60,1+R()*1.8,(R()-.5)*60,R()*6]);
  const fc=document.createElement('canvas');fc.width=fc.height=32;const fg=fc.getContext('2d'),gg=fg.createRadialGradient(16,16,0,16,16,16);gg.addColorStop(0,'#fff');gg.addColorStop(.4,'rgba(255,240,150,.6)');gg.addColorStop(1,'rgba(255,240,150,0)');fg.fillStyle=gg;fg.fillRect(0,0,32,32);
  const glow=new T.CanvasTexture(fc);
  const ff=new T.Points(new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(fp,3)),new T.PointsMaterial({size:.3,map:glow,transparent:true,blending:T.AdditiveBlending,depthWrite:false,color:'#fff3a0',sizeAttenuation:true}));ff.frustumCulled=false;ff.userData.dyn=1;g.add(ff);
  const MN=160,mp=new Float32Array(MN*3),mo=[];for(let i=0;i<MN;i++)mo.push([(R()-.5)*80,R()*5,(R()-.5)*80,R()*6,.3+R()*.5]);
  const motes=new T.Points(new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(mp,3)),new T.PointsMaterial({size:.09,map:glow,transparent:true,blending:T.AdditiveBlending,depthWrite:false,color:'#ffeccc',opacity:.55,sizeAttenuation:true}));motes.frustumCulled=false;motes.userData.dyn=1;g.add(motes);
  const wrap=(v,c,s)=>c+(((v-c+s/2)%s)+s)%s-s/2;
  let windOn=true,partOn=true;
  const update=(t,P,E)=>{lastT=t;if(windOn)WIND.uTime.value=t;const px=P?P.x:0,pz=P?P.z:0;if(P){WIND.uPlayer.value.set(P.x,0,P.z);stream(px,pz,5)}
    if(partOn){for(let i=0;i<FF;i++){const f=fo[i],x=wrap(f[0],px,60)+Math.sin(t*.5+f[3])*1.5,z=wrap(f[2],pz,60)+Math.cos(t*.4+f[3])*1.5;fp[i*3]=x;fp[i*3+1]=heightAt(x,z)+f[1]+Math.sin(t*1.3+f[3]*2)*.4;fp[i*3+2]=z}
      ff.geometry.attributes.position.needsUpdate=true;ff.material.opacity=.35+.25*Math.sin(t*2)*Math.sin(t*.7);
      for(let i=0;i<MN;i++){const m=mo[i],x=wrap(m[0],px,80)+Math.sin(t*.2*m[4]+m[3])*2.2,z=wrap(m[2],pz,80)+Math.cos(t*.17*m[4]+m[3])*2.2;mp[i*3]=x;mp[i*3+1]=heightAt(x,z)+.4+((m[1]+t*.12*m[4])%5.4);mp[i*3+2]=z}motes.geometry.attributes.position.needsUpdate=true}
    dyn.forEach(w=>{w.material.uniforms.uTime.value=t;if(E){w.material.uniforms.uSun.value.copy(E.sun);w.material.uniforms.uSky.value.copy(E.sky)}})};
  g.traverse(o=>{if(!o.userData.dyn&&o.matrixAutoUpdate&&o!==g&&o!==CHUNKROOT){o.updateMatrix();o.matrixAutoUpdate=false}});
  /** graphics options: grass 0..1 (share of tufts/flowers), detail (ground shader), wind (sway), particles (fireflies + pollen) */
  const setQuality=q=>{if(q.grass!==undefined){gFrac=q.grass;for(const c of chunks.values())if(c.loaded){applyQ(c);if(c.grass)c.grass.visible=gFrac>0&&c.d<=ACT_G;if(c.flowers)c.flowers.visible=gFrac>0&&c.d<=ACT_F}}
    if(q.detail!==undefined)gMat.userData.U.uDetail.value=q.detail?1:0;
    if(q.wind!==undefined)windOn=!!q.wind;
    if(q.particles!==undefined){partOn=!!q.particles;ff.visible=motes.visible=partOn}};
  const stats=()=>{let loaded=0,vis=0;for(const c of chunks.values())if(c.loaded){loaded++;if(c.grp.visible)vis++}return{chunks:chunks.size,loaded,visible:vis,obstacles:obs.length}};
  return{group:g,obs,update,setQuality,prime,ripple,walk,stats,ponds:PONDS,W,H,heightAt,spawn:SPAWN};
}
