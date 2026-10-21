// 5v5 ARENA: a bigger, hilly forest map (136 x 92) with rolling terrain, flat spawn pads + bomb-site plateaus, winding dirt lanes and ponds in the valleys.
// Same look as forestMap.js (world-space ground shader, swaying grass, merged wind-animated trees, animated water, distant hills),
// but the ground is a real displaced mesh and everything sits on it via heightAt(x,z). Terrain data lives in arenaTerrain.js.
import * as T from 'three';
import {Batch,WIND,windGrass,mat4,vnoise,fbm3} from './batch.js';
import {W,H,HW,HH,SPAWN,SITES,PONDS,PONDL,PATH_GLSL,pathD,heightAt,GRID} from './arenaTerrain.js';
export {W,H};

const rng=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
const col=c=>new T.Color(c);
const NOISE_GLSL=`
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
float fbm2(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*vn(p);p=p*2.03+7.1;a*=.5;}return s;}
${PATH_GLSL}`;

// ------------------------------------------------------------------------------------------------ ground (shader: grass, lanes, slopes -> rock, pond shores)
function groundMaterial(env){
  const m=new T.MeshStandardMaterial({color:'#ffffff',roughness:.97,metalness:0,envMap:env,envMapIntensity:.4});
  const U={uG1:{value:col('#4a903c')},uG2:{value:col('#88c45a')},uG3:{value:col('#a8b45a')},uD1:{value:col('#c9a46b')},uD2:{value:col('#9b7646')},uMud:{value:col('#4b3a28')},uSand:{value:col('#d8c48d')},uRock:{value:col('#8c8678')},uDetail:{value:1},
    uPonds:{value:PONDS.map(p=>new T.Vector3(p[0],p[1],p[2]))}};
  m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,U);
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;varying vec3 vWN;').replace('#include <begin_vertex>','#include <begin_vertex>\nvWP=(modelMatrix*vec4(transformed,1.)).xyz;vWN=normalize(mat3(modelMatrix)*normal);');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
      varying vec3 vWP;varying vec3 vWN;uniform float uDetail;uniform vec3 uG1,uG2,uG3,uD1,uD2,uMud,uSand,uRock;uniform vec3 uPonds[${PONDS.length}];${NOISE_GLSL}`)
    .replace('#include <color_fragment>',`#include <color_fragment>
      {vec2 p=vWP.xz;float cd=length(p-cameraPosition.xz),far=smoothstep(30.,110.,cd);
       float n1,n2,n3=.5,n4=.5;if(uDetail>.5){n1=fbm2(p*.04);n2=fbm2(p*.17+11.);n3=mix(vn(p*1.7),.5,far);n4=mix(vn(p*7.),.5,far);}else{n1=vn(p*.05);n2=vn(p*.2+11.);}
       vec3 grass=mix(uG1,uG2,smoothstep(.3,.7,n1));
       grass=mix(grass,uG3,smoothstep(.6,.86,n2)*.5);
       grass*=.84+.3*n3;grass*=.92+.16*n4;
       grass*=.9+.028*clamp(vWP.y,-3.,5.);                                                          // valleys a touch darker, hilltops a touch brighter
       if(uDetail>.5)grass=mix(grass,uG2*1.3,step(.94,vn(p*8.))*.3*(1.-far));
       float d=pathD(p)+(n2-.5)*1.0+(n3-.5)*.4;
       float pm=1.-smoothstep(1.3,2.1,d);
       vec3 dirt=mix(uD1,uD2,smoothstep(.25,.75,n2));dirt*=.86+.28*n4;
       if(uDetail>.5)dirt=mix(dirt,uD2*.55,step(.87,vn(p*15.))*.55*(1.-far));
       grass*=1.-.28*smoothstep(1.3,1.9,d)*(1.-smoothstep(1.9,2.6,d));
       vec3 c=mix(grass,dirt,pm);
       float sl=1.-clamp(normalize(vWN).y,0.,1.);                                                   // steep ground shows bare earth / rock
       c=mix(c,mix(uD2,uRock,smoothstep(.16,.3,sl)),smoothstep(.07,.2,sl)*.8*(1.-pm*.6));
       for(int i=0;i<${PONDS.length};i++){vec3 pd=uPonds[i];float dd=length(p-pd.xy)-pd.z+(n2-.5)*.8;
         c=mix(c,uSand,(1.-smoothstep(.2,1.6,dd))*.85);
         c=mix(c,uMud,1.-smoothstep(-.3,.5,dd));}
       diffuseColor.rgb=c;}`)};
  m.userData.U=U;m.customProgramCacheKey=()=>'arenaGround';return m}

// ------------------------------------------------------------------------------------------------ water
function waterMaterial(r){
  return new T.ShaderMaterial({transparent:true,fog:true,depthWrite:false,
    uniforms:T.UniformsUtils.merge([T.UniformsLib.fog,{uTime:{value:0},uR:{value:r},uDeep:{value:col('#1d6f9a')},uShallow:{value:col('#5ec2d4')},uSky:{value:col('#9ccdf0')},uSun:{value:new T.Vector3(.4,.6,.5)},uSunCol:{value:col('#fff0cc')}}]),
    vertexShader:`varying vec3 vW;varying vec2 vL;
      #include <fog_pars_vertex>
      void main(){vL=position.xz;vec4 wp=modelMatrix*vec4(position,1.);vW=wp.xyz;vec4 mvPosition=viewMatrix*wp;gl_Position=projectionMatrix*mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader:`varying vec3 vW;varying vec2 vL;uniform float uTime,uR;uniform vec3 uDeep,uShallow,uSky,uSun,uSunCol;
      #include <fog_pars_fragment>
      ${NOISE_GLSL}
      float hgt(vec2 p){float t=uTime;return fbm2(p*1.1+vec2(t*.12,t*.08))*.7+fbm2(p*2.7-vec2(t*.2,-t*.14))*.3;}
      void main(){vec2 p=vW.xz;float e=.06,h0=hgt(p);vec3 N=normalize(vec3((h0-hgt(p+vec2(e,0.)))*5.5,1.,(h0-hgt(p+vec2(0.,e)))*5.5));
        vec3 V=normalize(cameraPosition-vW);float fres=.04+.96*pow(1.-max(dot(N,V),0.),4.);
        float d=length(vL)/uR;vec3 base=mix(uDeep,uShallow,smoothstep(.35,1.,d));
        vec3 R=reflect(-V,N);float sd=max(dot(R,normalize(uSun)),0.);
        vec3 col=mix(base,uSky*.7,clamp(fres*.9,0.,1.));col+=uSunCol*(pow(sd,300.)*2.5+pow(sd,24.)*.08);
        float ring=fbm2(p*.8+uTime*.05);float foam=smoothstep(.9,.99,d+(ring-.5)*.1);col=mix(col,vec3(.95),foam*.5);
        float a=mix(.9,.98,fres);a*=1.-smoothstep(.985,1.,d);
        gl_FragColor=vec4(col,a);
      #include <fog_fragment>
      }`})}

// ------------------------------------------------------------------------------------------------ grass tuft geometry
function tuftGeo(){const pos=[],nor=[],cl=[],idx=[],R=rng(5);let o=0;
  for(let b=0;b<6;b++){const a=R()*6.283,rr=R()*.16,ox=Math.cos(a)*rr,oz=Math.sin(a)*rr,w=.034+R()*.02,ang=R()*6.283,lean=.1+R()*.25,hh=.7+R()*.3,cx=Math.cos(ang),cz=Math.sin(ang);
    const V=[[-w,0,0],[w,0,0],[-w*.7,.5*hh,lean*.5],[w*.7,.5*hh,lean*.5],[0,hh,lean]],C=[.35,.35,.75,.75,1.1];
    V.forEach((v,i)=>{pos.push(ox+v[0]*cx+v[2]*cz,v[1],oz-v[0]*cz+v[2]*cx);nor.push(-cz*.3,1,cx*.3);cl.push(C[i],C[i],C[i])});
    idx.push(o,o+1,o+2,o+2,o+1,o+3,o+2,o+3,o+4);o+=5}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(nor,3));g.setAttribute('color',new T.Float32BufferAttribute(cl,3));g.setIndex(idx);return g}

export function buildArena(seed=11,env=null){
  const R=rng(seed),g=new T.Group(),obs=[],B=new Batch(),dyn=[];
  const KEEP=[[SPAWN.atk.x,SPAWN.atk.z,12],[SPAWN.def.x,SPAWN.def.z,12],[SITES.A.x,SITES.A.z,8],[SITES.B.x,SITES.B.z,8]];
  const free=(x,z,m=0)=>pathD(x,z)>2.6+m&&PONDS.every(p=>Math.hypot(x-p[0],z-p[1])>p[2]+2.5+m)&&KEEP.every(k=>Math.hypot(x-k[0],z-k[1])>k[2]+m);
  const gh=(x,z)=>heightAt(x,z);

  // ---- ground: displaced mesh (same numbers as heightAt) + a flat skirt out to the horizon so the terrain blends into the surroundings
  const gMat=groundMaterial(env),gx=W+60,gz=H+60,geo=new T.PlaneGeometry(gx,gz,gx,gz).rotateX(-Math.PI/2),pa=geo.attributes.position;
  for(let i=0;i<pa.count;i++)pa.setY(i,gh(pa.getX(i),pa.getZ(i)));pa.needsUpdate=true;geo.computeVertexNormals();
  const ground=new T.Mesh(geo,gMat);ground.receiveShadow=true;g.add(ground);
  const sk=new T.Shape();sk.moveTo(-450,-450);sk.lineTo(450,-450);sk.lineTo(450,450);sk.lineTo(-450,450);sk.closePath();
  const hole=new T.Path();hole.moveTo(-gx/2,-gz/2);hole.lineTo(-gx/2,gz/2);hole.lineTo(gx/2,gz/2);hole.lineTo(gx/2,-gz/2);hole.closePath();sk.holes.push(hole);
  const skirt=new T.Mesh(new T.ShapeGeometry(sk).rotateX(-Math.PI/2),gMat);skirt.receiveShadow=true;g.add(skirt);

  // ---- ponds in the valleys (water sits a little below the surrounding ground; the bowl is carved in the heightfield)
  PONDS.forEach(([x,z,r],k)=>{const w=new T.Mesh(new T.CircleGeometry(r+1.4,56).rotateX(-Math.PI/2),waterMaterial(r+1.4));w.position.set(x,PONDL[k],z);w.renderOrder=2;w.userData.dyn=1;g.add(w);dyn.push(w);obs.push({x,z,r:r+.2});
    for(let i=0;i<8;i++){const q=R()*6.28,d=R()*(r-1.3),lx=x+Math.cos(q)*d,lz=z+Math.sin(q)*d,lr=.28+R()*.22;           // lily pads + flowers
      B.add('prop',new T.CircleGeometry(1,10).rotateX(-Math.PI/2),mat4(lx,PONDL[k]+.04,lz,lr,1,lr,0,R()*6,0),'#4aa04c',{varA:.25});
      if(i%3===0)B.add('prop',new T.IcosahedronGeometry(1,1),mat4(lx,PONDL[k]+.08,lz,.1,.07,.1),'#ff9fc4',{varA:.1})}
    for(let i=0;i<30;i++){const q=R()*6.28,d=r+.6+R()*1.6,px=x+Math.cos(q)*d,pz=z+Math.sin(q)*d,pr=.07+R()*.12;
      B.add('rock',new T.IcosahedronGeometry(1,1),mat4(px,gh(px,pz)+pr*.2,pz,pr,pr*.7,pr),'#8d8f8a',{varA:.3,grad:(a,b)=>.8+.3*b})}
    for(let i=0;i<8;i++){const q=R()*6.28,d=r+.3+R()*1.1,px=x+Math.cos(q)*d,pz=z+Math.sin(q)*d,hh=.7+R()*.7;               // reeds
      B.add('foliage',new T.ConeGeometry(.06,hh,4,1).translate(0,hh/2,0),mat4(px,gh(px,pz),pz,1,1,1,(R()-.5)*.3,R()*6,(R()-.5)*.3),'#5d9b45',{wind:{base:0,span:hh,gain:1,phase:R()*20},grad:(a,b)=>.7+.5*(b/hh)})}});

  // ---- trees: simple merged pines + round blossom trees, all standing on the terrain
  const TRUNK=new T.CylinderGeometry(1,1.18,1,6).translate(0,.5,0),CONE=new T.ConeGeometry(1,1,7,1).translate(0,.5,0),BALL=new T.IcosahedronGeometry(1,1);
  const GREEN=['#2f7d3a','#3a8a42','#4a9a48','#2b6f45'],PINK=['#f3a6c8','#eb8fb8'];
  function tree(x,z,sc){const y=gh(x,z),ry=R()*6.28;
    if(R()<.22){const th=1.7*sc;B.add('bark',TRUNK,mat4(x,y,z,.2*sc,th,.2*sc,0,ry,0),'#7a5535');
      const c=PINK[(R()*2)|0];B.add('foliage',BALL,mat4(x,y+th+.5*sc,z,1.55*sc,1.2*sc,1.55*sc,0,ry,0),c,{wind:{base:0,span:2,gain:.3,phase:R()*20},grad:(a,t)=>.8+.3*t});
      B.add('foliage',BALL,mat4(x+.7*sc,y+th+.1*sc,z+.3*sc,.9*sc,.75*sc,.9*sc,0,ry,0),c,{wind:{base:0,span:2,gain:.3,phase:R()*20},grad:(a,t)=>.8+.3*t});return}
    const th=1.5*sc;B.add('bark',TRUNK,mat4(x,y,z,.2*sc,th,.2*sc,0,ry,0),'#6b4a2b');const c=GREEN[(R()*4)|0];
    for(let i=0;i<3;i++){const s=(1-i*.27)*sc;B.add('foliage',CONE,mat4(x,y+th*.65+i*1.25*sc,z,1.55*s,2.2*s,1.55*s,0,ry+i,0),c,{wind:{base:0,span:1,gain:.45,phase:R()*20},grad:(a,t)=>.72+.45*t})}}
  for(let k=0;k<4;k++){const dz=HH+1.5+k*3.4,dx=HW+1.5+k*3.4,sc=1.2+k*.2;      // forest wall all round the arena
    for(let x=-dx-3;x<=dx+3;x+=3){for(const sg of[-1,1])if(R()<.93)tree(x+(R()-.5)*1.8,sg*(dz+(R()-.5)*1.6),sc*(.85+R()*.5))}
    for(let z=-dz;z<=dz;z+=3){for(const sg of[-1,1])if(R()<.93)tree(sg*(dx+(R()-.5)*1.6),z+(R()-.5)*1.8,sc*(.85+R()*.5))}}
  for(let i=0,n=0;i<1200&&n<95;i++){const x=(R()-.5)*(W-8),z=(R()-.5)*(H-8);if(!free(x,z,.4)||obs.some(o=>Math.hypot(o.x-x,o.z-z)<o.r+4))continue;tree(x,z,1+R()*.45);obs.push({x,z,r:.65});n++}
  // ---- rocks (collide), logs and bushes (decor)
  const rock=(x,z,s)=>B.add('rock',new T.IcosahedronGeometry(1,1),mat4(x,gh(x,z)+s*.25,z,s*1.1,s*.8,s,R()*.3,R()*6,R()*.3),'#8f98a3',{varA:.3,grad:(a,b)=>.8+.3*b});
  for(let i=0,n=0;i<1200&&n<42;i++){const x=(R()-.5)*(W-6),z=(R()-.5)*(H-6),r=.7+R()*.9;if(!free(x,z,.2)||obs.some(o=>Math.hypot(o.x-x,o.z-z)<o.r+r+1.5))continue;rock(x,z,r);obs.push({x,z,r:r*.95});n++;
    if(R()<.6)rock(x+r*1.3,z+.3,r*.45);if(R()<.4)rock(x-r*1.1,z-.5,r*.3)}
  for(let i=0;i<260;i++){const x=(R()-.5)*(W+10),z=(R()-.5)*(H+10),pr=.05+R()*.1;if(pathD(x,z)>3.2)continue;B.add('rock',new T.IcosahedronGeometry(1,1),mat4(x,gh(x,z)+pr*.2,z,pr,pr*.7,pr),'#8d8f8a',{varA:.3,grad:(a,b)=>.8+.3*b})}   // lane pebbles
  for(let i=0,n=0;i<300&&n<10;i++){const x=(R()-.5)*(W-12),z=(R()-.5)*(H-12);if(!free(x,z,.6)||obs.some(o=>Math.hypot(o.x-x,o.z-z)<o.r+3))continue;const ry=R()*3,y=gh(x,z);
    const lg=new T.CylinderGeometry(.4,.43,2.7,10,1).rotateZ(Math.PI/2),base=mat4(x,y+.4,z,1,1,1,0,ry,0);B.add('bark',lg,base,'#7d5434',{varS:3,varA:.4});
    [-.8,.8].forEach(d=>obs.push({x:x+Math.cos(ry)*d,z:z-Math.sin(ry)*d,r:.5}));n++}
  for(let i=0;i<110;i++){const x=(R()-.5)*(W-2),z=(R()-.5)*(H-2);if(!free(x,z,-1.2))continue;const s=.7+R()*.8,c=i%3===0?'#4d9a4a':'#3f8a3f';
    B.add('foliage',BALL,mat4(x,gh(x,z)+.3*s,z,s*.9,s*.62,s*.9,0,R()*6,0),c,{wind:{base:0,span:2,gain:.25,phase:R()*20},grad:(a,t)=>.75+.35*t})}
  const shroom=(x,z,k)=>{const y=gh(x,z);B.add('prop',new T.CylinderGeometry(.6,.9,2.2,7).translate(0,1.1,0),mat4(x,y,z,.07*k,.0727*k,.07*k),'#f4ead0',{grad:(a,t)=>.8+.2*t});
    B.add('prop',new T.IcosahedronGeometry(1,1),mat4(x,y+.2*k,z,.2*k,.11*k,.2*k),k>1?'#e8453c':'#ff9a3c',{grad:(a,t)=>.8+.3*t})};
  for(let i=0;i<60;i++){const x=(R()-.5)*(W-2),z=(R()-.5)*(H-2);if(free(x,z,-1))shroom(x,z,.8+R()*.7)}
  g.add(B.build(env));

  // ---- grass tufts + flowers (instanced, wind + player push)
  const grassMat=windGrass(new T.MeshStandardMaterial({vertexColors:true,roughness:.9,side:T.DoubleSide,envMap:env,envMapIntensity:.4})),N=22000;
  const gr=new T.InstancedMesh(tuftGeo(),grassMat,N),d=new T.Object3D(),a=new T.Color(),b=new T.Color();let gi=0;
  const wet=(x,z,m)=>PONDS.some(p=>Math.hypot(x-p[0],z-p[1])<p[2]+m);
  for(let i=0;i<N*3&&gi<N;i++){const x=(R()-.5)*(W+22),z=(R()-.5)*(H+22);if(pathD(x,z)<1.5||wet(x,z,.6))continue;
    const clump=vnoise(x*.12,z*.12,3);if(R()>.28+.85*clump)continue;const s=.6+R()*.9+clump*.5;
    d.position.set(x,gh(x,z),z);d.scale.set(s*.8*(.8+R()*.5),s*.34*(.45+R()*.45),s*.8*(.8+R()*.5));d.rotation.set(0,R()*6.28,0);d.updateMatrix();gr.setMatrixAt(gi,d.matrix);
    gr.setColorAt(gi,a.set('#3d8a38').lerp(b.set('#a6d65a'),R()*.8+clump*.2));gi++}
  const grassN=gi;gr.count=gi;gr.receiveShadow=true;gr.frustumCulled=false;g.add(gr);
  const FN=1400,stemG=new T.CylinderGeometry(.008,.012,1,4,1).translate(0,.5,0),headG=new T.IcosahedronGeometry(1,1),FC=['#ff7ab0','#ffe066','#ffffff','#b9a2ff','#ff9a3c'];
  const stems=new T.InstancedMesh(stemG,windGrass(new T.MeshStandardMaterial({color:'#4f9a45',roughness:.9}),{push:.4}),FN),heads=new T.InstancedMesh(headG,windGrass(new T.MeshStandardMaterial({roughness:.6,emissive:'#ffffff',emissiveIntensity:.0,envMap:env,envMapIntensity:.6}),{push:.4}),FN);
  let fi=0;for(let i=0;i<FN*3&&fi<FN;i++){const x=(R()-.5)*(W+10),z=(R()-.5)*(H+10);if(pathD(x,z)<1.7||wet(x,z,.8))continue;const hh=.22+R()*.22,y=gh(x,z);
    d.position.set(x,y,z);d.scale.set(1,hh,1);d.rotation.set(0,0,0);d.updateMatrix();stems.setMatrixAt(fi,d.matrix);
    d.position.set(x,y+hh,z);d.scale.set(.06+R()*.03,.045,.06+R()*.03);d.updateMatrix();heads.setMatrixAt(fi,d.matrix);heads.setColorAt(fi,a.set(FC[fi%5]));fi++}
  const flowerN=fi;stems.count=heads.count=fi;[stems,heads].forEach(m=>{m.frustumCulled=false;g.add(m)});

  // ---- distant forested hills (bigger rings than the forest map: this arena is larger)
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
  hills(138,14,15,1.7,'#3b7a47');hills(176,26,24,5.3,'#4a8a58');

  // ---- fireflies + drifting pollen (stay near the ground they were placed over)
  const FF=110,fp=new Float32Array(FF*3),fb=[];for(let i=0;i<FF;i++){const x=(R()-.5)*W,z=(R()-.5)*H;fb.push([x,gh(x,z)+1+R()*1.8,z,R()*6])}
  const fc=document.createElement('canvas');fc.width=fc.height=32;const fg=fc.getContext('2d'),gg=fg.createRadialGradient(16,16,0,16,16,16);gg.addColorStop(0,'#fff');gg.addColorStop(.4,'rgba(255,240,150,.6)');gg.addColorStop(1,'rgba(255,240,150,0)');fg.fillStyle=gg;fg.fillRect(0,0,32,32);
  const glow=new T.CanvasTexture(fc);
  const ff=new T.Points(new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(fp,3)),new T.PointsMaterial({size:.3,map:glow,transparent:true,blending:T.AdditiveBlending,depthWrite:false,color:'#fff3a0',sizeAttenuation:true}));ff.frustumCulled=false;ff.userData.dyn=1;g.add(ff);
  const MN=240,mp=new Float32Array(MN*3),mb=[];for(let i=0;i<MN;i++){const x=(R()-.5)*(W+10),z=(R()-.5)*(H+10);mb.push([x,.4+R()*5,z,R()*6,.3+R()*.5,gh(x,z)])}
  const motes=new T.Points(new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(mp,3)),new T.PointsMaterial({size:.09,map:glow,transparent:true,blending:T.AdditiveBlending,depthWrite:false,color:'#ffeccc',opacity:.55,sizeAttenuation:true}));motes.frustumCulled=false;motes.userData.dyn=1;g.add(motes);
  let windOn=true;
  const update=(t,P,E)=>{if(windOn)WIND.uTime.value=t;if(P)WIND.uPlayer.value.set(P.x,0,P.z);
    for(let i=0;i<FF;i++){const f=fb[i];fp[i*3]=f[0]+Math.sin(t*.5+f[3])*1.5;fp[i*3+1]=f[1]+Math.sin(t*1.3+f[3]*2)*.4;fp[i*3+2]=f[2]+Math.cos(t*.4+f[3])*1.5}ff.geometry.attributes.position.needsUpdate=true;ff.material.opacity=.35+.25*Math.sin(t*2)*Math.sin(t*.7);
    for(let i=0;i<MN;i++){const m=mb[i];mp[i*3]=m[0]+Math.sin(t*.2*m[4]+m[3])*2.2;mp[i*3+1]=m[5]+.4+((m[1]+t*.12*m[4])%5.4);mp[i*3+2]=m[2]+Math.cos(t*.17*m[4]+m[3])*2.2}motes.geometry.attributes.position.needsUpdate=true;
    dyn.forEach(w=>{w.material.uniforms.uTime.value=t;if(E){w.material.uniforms.uSun.value.copy(E.sun);w.material.uniforms.uSky.value.copy(E.sky)}})};
  g.traverse(o=>{if(!o.userData.dyn&&o.matrixAutoUpdate&&o!==g){o.updateMatrix();o.matrixAutoUpdate=false}});
  const setQuality=q=>{if(q.grass!==undefined){gr.count=Math.floor(grassN*q.grass);gr.visible=q.grass>0;stems.count=heads.count=Math.floor(flowerN*q.grass);stems.visible=heads.visible=q.grass>0}
    if(q.detail!==undefined)gMat.userData.U.uDetail.value=q.detail?1:0;
    if(q.wind!==undefined)windOn=!!q.wind;
    if(q.particles!==undefined)ff.visible=motes.visible=!!q.particles};
  return{group:g,obs,update,setQuality,ponds:PONDS,W,H,heightAt,sites:SITES,spawn:SPAWN};
}
