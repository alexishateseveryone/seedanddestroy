// Ming the cat: eased idle / run animation, jump, tumble and glide (hold the roll key in the air). Rope-physics tail + whiskers, cloth-physics cloak + collar belt.
// No weapons any more: every weapon / attack / aim / air-dash call that the rest of the game may still make is a harmless no-op (see "old API" below).
import * as T from 'three';
import {lumpy,G,mat,BM,M,mix,shadow} from './blocks.js';
import {Cloth} from './physics.js';
import {makeCoat,bindCoat,PATTERNS,toonMat} from './world/coatShader.js';
import {createBelt,COLLAR_TYPES} from './collar.js';
import {createHood} from './hood.js';
import {LEG_LEN,ARM,LEG,HAND_Y,createLimb} from './catLimbs.js';   // soft tapered arms / legs, one seamless mesh each, bendable
import {NOSES,CHEEKS,TAILS,buildNose,buildCheeks,buildTail,tailColor,WHISKERS,buildWhiskers} from './catFeatures.js';
import {EARS,EAR_NAMES,HEADS,EYEWEAR,GEAR_COLS,buildEar,buildHeadwear,buildEyewear,cloakRest,cloakShape,cloakColor,cloakLining,buildLeaves,kindOf} from './wearables.js';
import {HEAD_SHAPES,BODY_SHAPES,shapedHeadGeo,shapedTorsoGeo,headExt,headLift,bodyK} from './catShape.js';
import {HAIRS,HAIR_COLS,createHair} from './catHair.js';
export {COLLAR_TYPES,PATTERNS,EARS,EAR_NAMES,HEADS,EYEWEAR,GEAR_COLS,NOSES,CHEEKS,TAILS,WHISKERS,HEAD_SHAPES,BODY_SHAPES,HAIRS,HAIR_COLS};

// ================================================================== CAT EYES: your PNG eye shapes (picked in the cat maker) + wandering iris + blinking
// Each eye STYLE is one PNG (the eye shape). The iris wandering and the blinking are done in code on top of whichever shape is chosen,
// so every style wanders and blinks. Same contract as before: returns [leftEye,rightEye] groups; everything animates itself via onBeforeRender.
export const EYE_DIR='assets/images/cat/eyes/';
export const EYE_STYLES=[['default','Default'],['round','Round'],['bored','Bored'],['fierce','Fierce']];     // the files are listed in EYE_FILES below
// the file of each eye shape: put YOUR png files in EYE_DIR and write their exact names here (they stay as you sent them, nothing is renamed)
export const EYE_FILES={default:'charEye.png',round:'charEye-round.png',bored:'charEye-bored.png',fierce:'charEye-fierce.png'};
export const EYE_FILE=s=>encodeURI(EYE_DIR+(EYE_FILES[s]||EYE_FILES.default));
const EYE_PX=[29,17];                                                                         // size of every PNG
// per shape, in PNG pixels: iris centre (cx, cy = 0..1 of the PNG), iris size r, how far it may travel (rx, ry), iris stretch (sx, sy) and rotation (rot, radians). Made with eyeMapper.html
const IRIS_R=6;   // iris radius in PNG pixels: THE SAME for every eye shape (the shape itself still clips it)
const EYE_SHAPE={
  default:{cx:.53,cy:.47,r:IRIS_R,rx:4,ry:1.5,sx:1,sy:1,rot:0},
  round:{cx:.5,cy:.47,r:IRIS_R,rx:3,ry:2,sx:1,sy:1,rot:0},
  bored:{cx:.5,cy:.47,r:IRIS_R,rx:6,ry:.5,sx:1,sy:1,rot:0},
  fierce:{cx:.48,cy:.47,r:IRIS_R,rx:4.5,ry:1.5,sx:1,sy:1,rot:0}
};
const EYE_CFG={irisColor:'#060923',minInterval:.4,maxInterval:1.8,speed:10,blinkMin:2.2,blinkMax:5.5,blinkTime:.16};   // glance timing, snappiness, seconds between blinks, length of a blink
const eyeTexCache={};
const eyeTex=(s,pixel)=>{const k=s+(pixel?'|px':'');
  return eyeTexCache[k]||(eyeTexCache[k]=(()=>{const t=new T.TextureLoader().load(EYE_FILE(s),t=>{t.needsUpdate=true});t.colorSpace=T.SRGBColorSpace;
    if(pixel){t.magFilter=T.NearestFilter;t.minFilter=T.NearestFilter;t.generateMipmaps=false}return t})())};
EYE_STYLES.forEach(x=>eyeTex(x[0]));                                                          // start loading at once, so the cat maker icons already have the eyes
// resolves once every eye PNG has finished loading (the cat maker's baked icons need the eyes) or after `ms` at the latest
export const eyesReady=(ms=5000)=>new Promise(res=>{const t0=performance.now(),chk=()=>{if(Object.values(eyeTexCache).every(t=>t.image)||performance.now()-t0>ms)res();else setTimeout(chk,30)};chk()});
// Eye layers (outline, white shape, iris) all use the SAME simple shader as the iris did (the iris was the one thing that always showed in the game).
// They ignore the depth buffer completely (the lumpy head kept burying them) and are drawn after the head, in order: outline, white, iris.
// To still hide them when the cat looks away, a tiny invisible "probe" mesh checks every frame whether the eye faces the camera.
const eyeShapeMat=(map,color)=>new T.ShaderMaterial({
  transparent:true,depthTest:false,depthWrite:false,side:T.DoubleSide,
  uniforms:{map:{value:map},uCol:{value:new T.Color(color)}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'uniform sampler2D map;uniform vec3 uCol;varying vec2 vUv;void main(){if(texture2D(map,vUv).a<.5)discard;gl_FragColor=vec4(uCol,1.);}'
});
const eyeIrisMat=(map,color)=>new T.ShaderMaterial({
  transparent:true,depthTest:false,depthWrite:false,side:T.DoubleSide,
  uniforms:{map:{value:map},uOff:{value:new T.Vector2()},uSize:{value:new T.Vector2(2,2)},uCol:{value:new T.Color(color)}},
  vertexShader:'uniform vec2 uOff;uniform vec2 uSize;varying vec2 vUv;void main(){vec3 p=position+vec3(uOff,0.);vUv=p.xy/uSize+.5;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',
  fragmentShader:'uniform sampler2D map;uniform vec3 uCol;varying vec2 vUv;void main(){if(texture2D(map,vUv).a<.5)discard;gl_FragColor=vec4(uCol,1.);}'   // the iris only shows where the eye shape is solid
});
// opt: style ('default'|'round'|'bored'|'fierce'), x,y,z,size,tilt,roll,flipZ (placement; z = absolute depth of the eye, null = computed from the head), tint (colour of the white part),
//      outline / outlineW (outline colour + thickness, outlineW 1 = none), pixel (crisp pixels), useColor (iris = the chosen eye colour; false = dark iris), facing (0..1: how far the eye must face the camera to be drawn), iris:{overrides of EYE_CFG}
// The iris is ONE flat colour (no pupil). Both eyes look the same way (the wander offset is multiplied by the eye's mirror side).
export function buildPngEyes(eyeColor,head,opt){
  const o=Object.assign({style:'default',x:.365,y:.09,z:.80,size:.375,tilt:.38,roll:.16,flipZ:false,tint:'#ffffff',dot:false,pixel:false,useColor:true,outline:'#2a1a14',outlineW:1.22,facing:.2},opt);
  if(!EYE_SHAPE[o.style])o.style='default';
  const I=Object.assign({},EYE_CFG,o.iris),S=Object.assign({sx:1,sy:1,rot:0},EYE_SHAPE[o.style]),tex=eyeTex(o.style,o.pixel);
  const hs=[1,.78,.85],W=2,H=2*EYE_PX[1]/EYE_PX[0],u=W/EYE_PX[0];                              // eye-local size of the PNG, and units per PNG pixel
  const rnd=(a,b)=>a+Math.random()*(b-a);
  // shared "brain": both eyes look the same way and blink together
  const st={x:0,y:0,tx:0,ty:0,wait:.6,last:0,blinkIn:rnd(1,3),blinkT:-1,bl:1};
  const step=now=>{
    if(now<=st.last)return;                                                                     // already advanced this frame by the other eye
    const dt=Math.min(.1,st.last?(now-st.last)/1000:.016);st.last=now;
    st.wait-=dt;
    if(st.wait<=0){const a=Math.random()*Math.PI*2,r=Math.sqrt(Math.random());st.tx=Math.cos(a)*r;st.ty=Math.sin(a)*r;st.wait=rnd(I.minInterval,I.maxInterval)}
    const k=1-Math.exp(-dt*I.speed);st.x+=(st.tx-st.x)*k;st.y+=(st.ty-st.y)*k;                 // st.x / st.y are -1..1 inside the iris travel ellipse
    st.blinkIn-=dt;if(st.blinkIn<=0&&st.blinkT<0){st.blinkT=0;st.blinkIn=Math.random()<.2?.25:rnd(I.blinkMin,I.blinkMax)}   // now and then a quick double blink
    st.bl=1;
    if(st.blinkT>=0){st.blinkT+=dt;const p=st.blinkT/I.blinkTime;if(p>=1)st.blinkT=-1;else st.bl=1-.92*Math.sin(p*Math.PI)}   // lids close and open again
  };
  const eyes=[],nrm=new T.Vector3(),wp=new T.Vector3(),cp=new T.Vector3();
  [-1,1].forEach(s=>{
    const x=s*o.x,y=o.y;
    const z=(o.z!=null?o.z:Math.sqrt(Math.max(.05,1-x*x-(y/hs[1])**2))*hs[2]+.012)*(o.flipZ?-1:1);   // sit just outside the ellipsoid head surface
    const eye=new T.Group();eye.position.set(x,y,z);
    eye.rotation.set(0,s*o.tilt*(o.flipZ?-1:1)+(o.flipZ?Math.PI:0),s*o.roll);
    head.add(eye);
    const body=new T.Group();body.scale.setScalar(o.size);eye.add(body);                       // blinking squashes `body` in y
    const flip=new T.Group();flip.scale.x=s;body.add(flip);                                     // the left eye is the mirrored PNG (and mirrored iris)
    const ol=new T.Mesh(new T.PlaneGeometry(1,1),eyeShapeMat(tex,o.outline));                   // dark outline: the same shape, a bit bigger, behind the eye
    ol.scale.set(W*o.outlineW,H*o.outlineW,1);ol.position.z=-.004;ol.renderOrder=100;flip.add(ol);
    const base=new T.Mesh(new T.PlaneGeometry(1,1),eyeShapeMat(tex,o.tint));                     // the white eye shape
    base.scale.set(W,H,1);base.renderOrder=101;flip.add(base);
    // one flat-colour iris. Size / stretch / rotation are baked into the geometry because the shader reads the raw vertex position to find its place in the PNG
    const iris=new T.Mesh(new T.CircleGeometry(S.r*u,40).scale(S.sx,S.sy,1).rotateZ(S.rot),eyeIrisMat(tex,o.useColor?eyeColor:I.irisColor));
    iris.position.z=.01;iris.renderOrder=102;iris.material.uniforms.uSize.value.set(W,H);flip.add(iris);
    // optional white highlight dot on the iris (opt.dot / cat config eyeDot). It uses the iris shader, so it follows the iris and is clipped by the eye shape.
    const dot=new T.Mesh(new T.CircleGeometry(S.r*u*.27,20).translate(-s*S.r*u*.34,S.r*u*.34,0),eyeIrisMat(tex,'#ffffff'));
    dot.material.uniforms.uOff=iris.material.uniforms.uOff;dot.material.uniforms.uSize=iris.material.uniforms.uSize;
    dot.position.z=.012;dot.renderOrder=103;flip.add(dot);
    const un=iris.material.uniforms;
    // probe: a tiny mesh that draws nothing but is always "rendered", so its hook runs every frame (the eye layers themselves get switched off when the eye faces away)
    const probe=new T.Mesh(new T.PlaneGeometry(.02,.02),new T.MeshBasicMaterial({colorWrite:false,depthWrite:false}));probe.frustumCulled=false;eye.add(probe);
    probe.onBeforeRender=(r,sc,cam)=>{
      step(performance.now());
      body.scale.set(o.size,o.size*st.bl,o.size);
      un.uOff.value.set((S.cx-.5)*W+s*st.x*S.rx*u,(.5-S.cy)*H+st.y*S.ry*u);                    // s*: the group is mirrored, so both eyes end up looking the same way
      eye.getWorldPosition(wp);cam.getWorldPosition(cp);cp.sub(wp).normalize();
      nrm.set(0,0,o.flipZ?-1:1).transformDirection(eye.matrixWorld);
      const vis=nrm.dot(cp)>o.facing;ol.visible=base.visible=iris.visible=vis;dot.visible=vis&&!!o.dot;
    };
    eyes.push(eye);
  });
  return eyes;
}
// ================================================================== end of cat eyes

export const COATS=[['#f6dfbd','#ee9a48'],['#ee9a48','#9a5a24'],['#fff4e6','#b9bfcc'],['#3b3a45','#fff4e6'],['#d9b48a','#5a3a28'],['#9aa3b5','#fff4e6'],['#c7b4f0','#fff4e6'],['#7a4a2b','#e8c79a'],['#ffe9a8','#ffb347'],['#e6f4ff','#7fb8e8'],['#2a2a35','#ee9a48'],['#d8f0d0','#7fcf7f'],
  ['#ffc4dc','#ff86b3'],['#ff7aa8','#fff4e6'],['#ffd0b0','#ff9a7a'],['#c92a3a','#fff4e6'],['#a9d8ff','#fff4e6'],['#2f4a8a','#c9d6ff'],['#7b3f8f','#e9c8f5'],['#14141c','#6b6b80'],['#fff1d0','#e8c27a'],['#5c6b7a','#dfe6ee'],['#fff27a','#ffb84a'],['#3fb6a8','#e6fff9']];
export const COAT_NAMES=['Ming','Ginger','Snow','Tux','Mocha','Smoke','Lilac','Cocoa','Butter','Frost','Ember','Mint','Blush','Rose','Peach','Crimson','Sky','Navy','Plum','Midnight','Cream','Slate','Lemon','Teal'];
export const EYECS=['#1e3a8a','#4bd37b','#4aa8ff','#ffc93c','#ff6fa0','#b07aff','#ff7a3c','#7ee6d2','#ff4d6d'];
export const COLLARS=['#e63946','#4aa8ff','#ff8fc0','#58c878','#ffd54a','#b07aff','#ffffff','#2a2433','#ff7a3c','#7ee6d2']; // always worn: no "none"
export const CLOAKS=[['none','None','Off'],['tattered','Tattered','Rags'],['short','Short','Scarf'],['long','Long','Coat'],['royal','Royal','Cape'],['leaves','Leaves','Leafy']];
export const CLOAK_COLS=['#8a5a3a','#6d4cff','#e63946','#2fa8ff','#2fbf71','#ffb300','#2a2433','#ff6fa0','#ffffff','#ff7a3c','#58d6ff','#c58aff'];
// <PART_LAYOUT>
// Body part layout from animation_maker.html (p = move in cat units, r = rotation in radians, s = size multiplier per axis). Re-export from the maker, do not edit by hand.
export const PART_LAYOUT={
  head:{"p":[0,-0.3,0],"r":[0.2618,0,0],"s":[1,1,1]},
  earL:{"p":[0.03,0.0315,-0.0193],"r":[0,0,0],"s":[1.25,0.85,1.4]},
  earR:{"p":[-0.03,0.0315,-0.0193],"r":[0,0,0],"s":[1.25,0.85,1.4]},
  eyeL:{"p":[0,0,0],"r":[0,0,0],"s":[1,1.05,1]},
  eyeR:{"p":[0,0,0],"r":[0,0,0],"s":[1,1.05,1]},
  nose:{"p":[0.0232,-0.0228,-0.0024],"r":[0,0,0],"s":[0.75,0.6,1]},
  mouth:{"p":[0,0,0.05],"r":[0.5236,0,0],"s":[0.7,1,1.45]},
  body:{"p":[0,-0.3,0],"r":[0,0,0],"s":[0.8,0.75,0.6793]},
  armL:{"p":[0.3345,-0.55,-0.05],"r":[0,0,-0.2618],"s":[1,0.9,1.75]},
  armR:{"p":[-0.3345,-0.55,-0.05],"r":[0,0,0.2618],"s":[1,0.9,1.75]},
  legL:{"p":[0.22,-0.25,0.0007],"r":[0,0,-0.0916],"s":[1,0.75,1.1]},
  legR:{"p":[-0.22,-0.25,0.0007],"r":[0,0,0.0916],"s":[1,0.75,1.1]},
  tail:{"p":[0,-0.15,0.2],"r":[0,0,0],"s":[1,0.7704,0.6927]},
  collar:{"p":[0,-0.25,-0.1],"r":[0,0,0],"s":[0.9,1,1]},
  cloak:{"p":[0.0001,-0.35,-0.0484],"r":[0,0,0],"s":[0.85,1,0.95]}
};
// </PART_LAYOUT>
// <ANIMS>
// Additive keyframe clips from animation_maker.html. Play one with  cat.userData.play('name',loop). Re-export from the maker.
export const ANIMS={
  "wave":{fps:30,frames:30,loop:false,keys:[
    {"f":0,"ease":"smooth","pose":{}},
  ]}
};
// </ANIMS>
// pose keys of a clip (all radians, added on top of the cat's own idle / run / jump motion): <part>Rx/Ry/Rz, moveY (body bob), elbowL/R + kneeL/R (extra bend)
export const POSE_PARTS=['head','body','armL','armR','legL','legR','tail'];
export const POSE_KEYS=[...POSE_PARTS.flatMap(n=>['x','y','z'].map(a=>n+'R'+a)),'moveY','elbowL','elbowR','kneeL','kneeR'];
export const EASE={linear:t=>t,smooth:t=>t*t*(3-2*t),in:t=>t*t,out:t=>1-(1-t)*(1-t),hold:()=>0};
export function sampleClip(c,f){   // c = {fps,frames,loop,keys:[{f,ease,pose}]}  ->  {poseKey:value}
  const ks=c.keys,o={};if(!ks.length)return o;let a=ks[0],b=null;
  for(const k of ks){if(k.f<=f)a=k;else{b=k;break}}
  const u=b?(f-a.f)/(b.f-a.f):0,e=(EASE[a.ease]||EASE.smooth)(Math.max(0,Math.min(1,u)));
  for(const k of POSE_KEYS){const x=a.pose[k]||0,y=b?(b.pose[k]||0):x;o[k]=x+(y-x)*e}
  return o}
// legacy exports from the old animation maker (nothing in the avatar uses them any more; safe to delete once no other file imports them)
export const BEND_PARAMS=[['wElbow','Weapon arm: elbow bend','arms',0,2.6,0],['oElbow','Off arm: elbow bend','arms',0,2.6,0],['legLk','Left leg: knee bend','legs',0,2.4,0],['legRk','Right leg: knee bend','legs',0,2.4,0]];
export const BEND_KEYS=BEND_PARAMS.map(p=>p[0]);
export const samplePoseX=()=>({});
function tagTex(name){const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),t=name.toUpperCase();g.fillStyle='#f2c44e';g.fillRect(0,0,64,64);
  let fs=20;g.font='800 '+fs+'px Arial';while(g.measureText(t).width>52&&fs>8){fs--;g.font='800 '+fs+'px Arial'}g.fillStyle='#8a5a14';g.textAlign='center';g.textBaseline='middle';g.fillText(t,32,34);
  const x=new T.CanvasTexture(c);x.colorSpace=T.SRGBColorSpace;return x}
const ease=(dt,k)=>1-Math.exp(-dt*k);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),lerp=(a,b,t)=>a+(b-a)*t,sm=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};

// ---- dark blue pixel outline for the IN-GAME cat (inverted hull). main.js calls addOutline(cat) for the player's cat and setOutline(px,rows) from its Outline slider.
// Whole body (head, ears, arms, legs, tail, hair, collar, cloak...): every solid mesh gets a child copy sharing its geometry, drawn back-faces only and pushed outward by a
// fixed number of SCREEN pixels, so the line keeps the same thickness at any camera distance. px is in GAME pixels (1 px = one pixel of the pixel-art render), rows = rows of
// that render. The push direction is a normal averaged over vertices that share a position, so hard edges / seams of the lumpy shapes do not split open. Eyes, blob shadow and
// transparent parts are skipped. The cat maker / My Character preview paints its own outline in catMaker.js and does not use this.
const OL={px:1,rows:540};
const UK={value:2*OL.px/OL.rows};   // ONE shared uniform: thickness in NDC units (2 / rows per game pixel); 0 = outline off
// Three kinds of hull:  static = solid meshes (normal averaged once, "onrm")  ·  live = meshes whose shape changes every frame (tail ropes: the live normal is used)
//                       sheet  = open cloth (cloak): a back-face hull is invisible on a flat sheet, so the whole sheet is pushed outward from its own centre in screen space and drawn just behind it
// A mesh opts in with userData.olMode = 'static' | 'live' | 'liveInv' (live, but the mesh's outside faces point inward: the hood) | 'sheet' | 'skip' (this also lets shader / basic-material meshes be outlined).
const OL_COL={value:new T.Color('#1b2a5e')},OL_DAY=new T.Color('#1b2a5e'),OL_NIGHT=new T.Color('#03050c');   // ONE shared colour for every hull
export function setOutlineNight(n){OL_COL.value.copy(OL_DAY).lerp(OL_NIGHT,Math.min(1,Math.max(0,n||0)))}   // n = 0 day ... 1 full night: the outline darkens with it
const hullCache={};
const HULL_VS=`uniform float uK;ATTR
void main(){
  vec4 cp=projectionMatrix*modelViewMatrix*vec4(position,1.);
  vec3 nv=normalize(normalMatrix*NRM);
  vec2 nd=(projectionMatrix*vec4(nv,0.)).xy;
  float l=length(nd);nd=l>1e-5?nd/l:vec2(0.);
  float asp=projectionMatrix[1][1]/projectionMatrix[0][0];
  cp.xy+=nd*vec2(1./asp,1.)*uK*cp.w;
  gl_Position=cp;}`;
const SHEET_VS=`uniform float uK;uniform vec3 uC;
void main(){
  mat4 mv=projectionMatrix*modelViewMatrix;
  vec4 cp=mv*vec4(position,1.);vec4 cc=mv*vec4(uC,1.);
  float asp=projectionMatrix[1][1]/projectionMatrix[0][0];
  vec2 d=cp.xy/cp.w-cc.xy/cc.w;d.x*=asp;
  float l=length(d);d=l>1e-5?d/l:vec2(0.,-1.);
  cp.xy+=d*vec2(1./asp,1.)*uK*cp.w;
  gl_Position=cp;}`;
const HULL_FS='uniform vec3 uCol;uniform float uK;void main(){if(uK<=0.)discard;gl_FragColor=vec4(uCol,0.);}';   // alpha 0 like every cat material (NO_OL): the game's own outline pass leaves it alone
const makeHull=mode=>{
  const sheet=mode==='sheet';
  return new T.ShaderMaterial({side:sheet?T.DoubleSide:mode==='liveInv'?T.FrontSide:T.BackSide,fog:false,defines:{NO_OL:''},
    polygonOffset:true,polygonOffsetFactor:sheet?4:1,polygonOffsetUnits:sheet?8:1,   // sits just behind thin / double-sided parts so it never fights them
    uniforms:{uCol:OL_COL,uK:UK,uC:{value:new T.Vector3()}},   // #1b2a5e = the maker preview's (27,42,94)
    vertexShader:sheet?SHEET_VS:HULL_VS.replace('ATTR',mode==='static'?'attribute vec3 onrm;':'').replace('NRM',mode==='live'?'normal':mode==='liveInv'?'(-normal)':'onrm'),
    fragmentShader:HULL_FS})};
const getHull=mode=>mode==='sheet'?makeHull('sheet'):(hullCache[mode]||(hullCache[mode]=makeHull(mode)));   // sheets need their own material (own centre)
export function setOutline(px,rows){if(px!=null)OL.px=px;if(rows)OL.rows=rows;UK.value=2*OL.px/OL.rows}
// run fn with a different outline thickness (px of a render that is `rows` tall) and put the game's own setting back afterwards (the inventory preview draws its own small view)
export function withOutline(px,rows,fn){const p=OL.px,r=OL.rows;setOutline(px,rows);try{fn()}finally{setOutline(p,r)}}
function smoothNormals(g){
  if(g.attributes.onrm)return;
  if(!g.attributes.normal)g.computeVertexNormals();
  const p=g.attributes.position,n=g.attributes.normal,acc=new Map(),key=i=>Math.round(p.getX(i)*1e4)+','+Math.round(p.getY(i)*1e4)+','+Math.round(p.getZ(i)*1e4);
  for(let i=0;i<p.count;i++){const k=key(i);let v=acc.get(k);if(!v)acc.set(k,v=[0,0,0]);v[0]+=n.getX(i);v[1]+=n.getY(i);v[2]+=n.getZ(i)}
  const o=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){const v=acc.get(key(i)),l=Math.hypot(v[0],v[1],v[2])||1;o[i*3]=v[0]/l;o[i*3+1]=v[1]/l;o[i*3+2]=v[2]/l}
  g.setAttribute('onrm',new T.BufferAttribute(o,3))}
// called every pose update: hulls follow a mesh whose geometry was swapped, and sheet hulls re-centre on the moving cloth
function syncOL(list){
  for(const e of list){const {m,h,mode}=e,g=m.geometry;if(!g)continue;
    if(h.geometry!==g){if(mode==='static')smoothNormals(g);else if(mode!=='sheet'&&!g.attributes.normal)g.computeVertexNormals();h.geometry=g}
    if(mode==='sheet'){g.computeBoundingBox();g.boundingBox.getCenter(h.material.uniforms.uC.value)}}}
export function addOutline(root){
  if(!root)return;
  const list=[];
  root.traverse(m=>{
    if(!m.isMesh||m.userData.ol||!m.visible)return;
    const mode=m.userData.olMode;
    if(mode==='skip')return;
    const mt=m.material;
    if(!mt||mt.transparent||mt.colorWrite===false)return;
    if(!mode&&(Array.isArray(mt)||mt.isShaderMaterial||mt.isMeshBasicMaterial))return;   // untagged: only plain lit solids (the old rule)
    if(!m.geometry||!m.geometry.attributes||!m.geometry.attributes.position)return;
    list.push({m,mode:mode||'static'})});
  const live=[];
  for(const e of list){
    const {m,mode}=e,g=m.geometry;
    if(mode==='static'){if(!g.attributes.normal)continue;smoothNormals(g)}
    else if(mode!=='sheet'&&!g.attributes.normal)g.computeVertexNormals();
    const h=new T.Mesh(g,getHull(mode));
    h.userData.ol=true;h.frustumCulled=false;h.castShadow=false;h.receiveShadow=false;
    m.add(h);e.h=h;if(mode!=='static')live.push(e)}
  root.userData.olList=live;syncOL(live)}
export function createCatAvatar(opt={}){
  const o=Object.assign({fur:COATS[0][0],pat:COATS[0][1],pattern:'classic',ears:'pointy',eyeColor:EYECS[0],collar:COLLARS[0],name:'Ming',cloak:'tattered',cloakC:CLOAK_COLS[0],collarType:'normal',head:'none',eyewear:'none',gearC:GEAR_COLS[0],eyeStyle:'default',nose:'button',cheeks:'none',tail:'classic',whiskers:'classic',headShape:'round',bodyShape:'plush',hair:'none',hairC:HAIR_COLS[0],eyeDot:false},opt);
  const LAYO=Object.assign({},PART_LAYOUT,opt.layout||{});   // opt.layout = live override from the animation maker
  if(!COLLARS.includes(o.collar))o.collar=COLLARS[0];          // the collar can no longer be removed
  if(!COLLAR_TYPES.some(x=>x[0]===o.collarType))o.collarType='normal';
  if(o.cloak==='none'||!CLOAKS.some(x=>x[0]===o.cloak))o.cloak='tattered';   // the cloak can no longer be removed
  if(!EARS.includes(o.ears))o.ears='pointy';
  if(!PATTERNS.some(p=>p[0]===o.pattern))o.pattern='classic';
  if(!EYE_STYLES.some(x=>x[0]===o.eyeStyle))o.eyeStyle='default';
  if(!NOSES.some(x=>x[0]===o.nose))o.nose='button';
  if(!CHEEKS.some(x=>x[0]===o.cheeks))o.cheeks='none';
  if(!TAILS.some(x=>x[0]===o.tail))o.tail='classic';
  if(!WHISKERS.some(x=>x[0]===o.whiskers))o.whiskers='classic';
  if(!HEAD_SHAPES.some(x=>x[0]===o.headShape))o.headShape='round';
  if(!BODY_SHAPES.some(x=>x[0]===o.bodyShape))o.bodyShape='plush';
  if(!HAIRS.some(x=>x[0]===o.hair))o.hair='none';
  if(!o.hairC)o.hairC=HAIR_COLS[0];
  const catGroup=new T.Group(),cat=new T.Group(),head=new T.Group(),S=.45,LY=-1.52,FY=.96+(LEG_LEN-.42)*S;cat.scale.setScalar(S);cat.position.y=FY;catGroup.add(cat);cat.add(head);const nCh=catGroup.children.length;shadow(catGroup,.6);{const b=catGroup.children[nCh];if(b&&b.isMesh){b.geometry.computeBoundingBox();const bb=b.geometry.boundingBox,r=Math.max(bb.max.x-bb.min.x,bb.max.y-bb.min.y,bb.max.z-bb.min.z)/2||.5;b.geometry=new T.CircleGeometry(r,14).rotateX(-Math.PI/2);b.rotation.set(0,0,0);b.material=new T.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.3,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});b.castShadow=false;b.receiveShadow=false;b.visible=false}}const shM=catGroup.children[nCh]||null,shY=shM?shM.position.y:0,shS=shM?shM.scale.clone():null;   // the blob shadow stays on the ground while the cat jumps
  const acc=mat(o.pat),pink=mat('#ff9db8'),dark=BM('#2a1a14'),R=Math.PI/2;
  
  const coatMeshes=[];
  const CM=(geo,part,sc,pos,par)=>{const m=M(geo,makeCoat(o,part),sc,pos,par);coatMeshes.push(m);return m};
  CM(lumpy(shapedHeadGeo(o.headShape),.03,0),0,[1.0,0.78,0.85],null,head);   // custom head shape (see catShapes.js)
  const body=CM(lumpy(shapedTorsoGeo(o.bodyShape),.02,3),1,[.56,.62,.5],[0,-1.1,0],cat);

  const eyes=buildPngEyes(o.eyeColor,head,{style:o.eyeStyle,dot:!!o.eyeDot});   // PNG eye shape (o.eyeStyle); the eyes blink and wander on their own
  
  const _n0=head.children.length;buildNose(o.nose,head);const noseKids=head.children.slice(_n0);
  const cheeks=buildCheeks(o.cheeks,o,head);   // fur locks use the head's coat shader + rope physics
  if(cheeks){cheeks.meshes.forEach(m=>coatMeshes.push(m))}
  const mouthKids=[M(G.box,dark,[.016,.07,.016],[0,-.22,.75],head)];
  [-1,1].forEach(s=>{const m=new T.Mesh(new T.TorusGeometry(.1,.018,6,16,Math.PI),dark);m.rotation.z=Math.PI;m.position.set(s*.1,-.28,.72);head.add(m);mouthKids.push(m)});

  const ropes=[];
  if(cheeks)cheeks.ropes.forEach(r=>ropes.push(r));
  {const w0=head.children.length;buildWhiskers(o.whiskers,head).forEach(r=>ropes.push(r));for(let i=w0;i<head.children.length;i++)head.children[i].traverse(x=>{if(x.isMesh)x.userData.olMode='skip'})}   // whiskers never get the pixel outline (game cat + inventory preview)      // whisker style: see catFeatures.js ('none' = no whiskers)  
  const ears=[],earRig=[],earMods=[];
  [-1,1].forEach(s=>{const g=new T.Group();g.position.set(s*.56,.5,.02);g.rotation.z=-s*.5;head.add(g);
    const sw=new T.Group();g.add(sw);const em=s<0?acc:mat(o.fur);
    const info=buildEar(o.ears,sw,em,pink);ears.push(g);if(info.ropes)info.ropes.forEach(r=>ropes.push(r));if(info.mods)info.mods.forEach(m=>earMods.push(m));
    earRig.push({s,sw,k:info.k,fl:info.fl,out:info.out,bx:info.bx,x:0,vx:0,z:0,vz:0,flick:2+Math.random()*4});sw.rotation.set(info.bx,0,-s*info.out)});

  // headwear + eyewear live on the head so they follow every head movement
  const hw=o.head==='hood'?null:buildHeadwear(o.head,o.gearC);if(hw){hw.position.y+=headLift(o.headShape);head.add(hw)}   // the hood is cloth: created below once the collision volumes exist
  const ew=buildEyewear(o.eyewear,o.gearC);if(ew)head.add(ew);

  // collision volumes (cat-local ellipsoids: centre, radii) so cloth can never sink into the player. m = margin
  const BK=bodyK(o.bodyShape),HE=headExt(o.headShape);
  const BODY=m=>[[[0,-.95,0],[.5*BK.w+m,.42+m,.44*BK.d+m]],[[0,-1.35,0],[.62*BK.w+m,.42+m,.54*BK.d+m]]];   // upper torso + pear hips
  const LEGSC=m=>[-1,1].map(s=>[[s*.32,LY-LEG_LEN/2,0],[.22+m,LEG_LEN/2+.04+m,.24+m]]);
  // ---- Leather belt collar (rough leather, stitches, holes, studs, buckle): static, sits wide under the head ----
  const HEADC=m=>[[[0,0,0],[HE[0]+m,.78*HE[1]+m,.85*HE[2]+m]]];
  const _b0=cat.children.length;
  const belt=createBelt(cat,o.collar,{outer:[...BODY(.02),...HEADC(.03)],inner:[...BODY(-.02),...HEADC(0)]},o.collarType);   // cloth belt, same physics as the cloak
  const beltKids=cat.children.slice(_b0);   // the collar's meshes (the animation maker can hide them)
  // cloth-physics hood in the chosen gear colour (dome pinned to the head, neck drape + curled tip free)
  const hood=o.head==='hood'?createHood(head,{outer:o.gearC,inner:mix(o.gearC,'#000000',.55),trimC:mix(o.gearC,'#ffffff',.55),seamC:mix(o.gearC,'#ffffff',.3),coll:[...BODY(.05),...HEADC(.04)]}):null;
  // hair: ONE mesh with its own physics (catHair.js). Hidden under headwear that covers the head.
  const hair=(o.hair!=='none'&&!['hood','helmet','beanie','wizard'].includes(o.head))?createHair(head,cat,{style:o.hair,color:o.hairC,shape:o.headShape,coll:BODY(.03)}):null;
  // name plate: hangs from a gold ring on the bottom-centre of the collar (it follows the collar cloth every frame) and swings like a pendulum
  const tag=new T.Group();cat.add(tag);belt.anchor(tag.position);
  const GOLDM=toonMat('#f0c040');
  const ring1=new T.Mesh(new T.TorusGeometry(.05,.012,8,18),GOLDM);ring1.position.y=-.035;ring1.rotation.y=R;tag.add(ring1);   // ring on the collar side
  const plate=new T.Group();plate.position.y=-.17;tag.add(plate);
  const ring2=new T.Mesh(new T.TorusGeometry(.04,.011,8,18),GOLDM);ring2.position.set(0,.15,0);plate.add(ring2);                 // ring on the plate, interlocked with ring1
  M(G.cyl,mat('#f2c44e',.4),[.15,.027,.15],[0,0,0],plate).rotation.x=R;
  const f=new T.Mesh(new T.CircleGeometry(.14,24),new T.MeshBasicMaterial({map:tagTex(o.name)}));f.position.set(0,0,.03);plate.add(f);
  const tagS={x:0,vx:0,z:0,vz:0};


  // arms and legs: soft tapered limbs with elbow / knee joints (catLimbs.js). No hands / weapons any more.
  const arm=s=>{const p=new T.Group();p.position.set(s*.5,-.76,.05);const w=new T.Group();cat.add(w);w.add(p);p.userData.w=w;const L=createLimb(ARM,o.pat);CM(L.geo,2,[1,1,1],[0,0,0],p);
    const el=new T.Group();p.add(el);p.userData.setBend=a=>L.set(a,el);L.set(0,el);const tip=new T.Object3D();tip.position.set(0,HAND_Y,.012);el.add(tip);p.userData.tip=tip;return p};
  const leg=s=>{const p=new T.Group();p.position.set(s*.32,LY,0);const w=new T.Group();cat.add(w);w.add(p);p.userData.w=w;const L=createLimb(LEG,o.pat);CM(L.geo,3,[1,1,1],[0,0,0],p);
    p.userData.setBend=a=>L.set(a,null);return p};
  const armL=arm(-1),armR=arm(1),legL=leg(-1),legR=leg(1);

  const _c0=cat.children.length;
  let cloth=null,lining=null,leaves=null;
  if(o.cloak!=='none'){
    const kind=kindOf(o.cloak),{cols,rows}=cloakShape(kind),P0={grav:15,stiff:.012};
    const c0=cat.children.length;
    cloth=new Cloth(cat,cloakRest(kind,0,0),cols,rows,{...P0,coll:[...BODY(.04),...LEGSC(.03)],color:(r,c)=>cloakColor(kind,o.cloakC,r,c,rows)});
    const c1=cat.children.length;
    lining=new Cloth(cat,cloakRest(kind,.07,.04),cols,rows,{...P0,coll:[...BODY(0),...LEGSC(0)],color:(r,c)=>cloakLining(kind,o.cloakC,r,rows)});
    const c2=cat.children.length,tagOL=(i0,i1,mode)=>{for(let i=i0;i<i1;i++)cat.children[i].traverse(x=>{if(x.isMesh)x.userData.olMode=mode})};
    tagOL(c0,c1,'sheet');tagOL(c1,c2,'skip');   // outer cloak = sheet outline (the cloth's own mesh is found by diffing the cat's children), lining = none
    [[cloth,'sheet'],[lining,'skip']].forEach(([cl,md])=>{const mm=cl&&(cl.mesh||cl.m);if(mm&&mm.isMesh)mm.userData.olMode=md});
    if(kind==='leaves'){const lv=buildLeaves(cat,cols,rows,o.cloakC),P=(c,r)=>cloth.lp[r*cols+c];lv.place(P);leaves={lv,P}}
  }

  const cloakKids=cat.children.slice(_c0);   // cloak + lining + leaves
  const tail=new T.Group();tail.position.set(0,LY,-.5);cat.add(tail);
  const tailCol=tailColor(o);
  const tf=buildTail(o.tail,tail,o);tf.ropes.forEach(r=>ropes.push(r));      // tail types: see catFeatures.js
  tail.traverse(x=>{if(x.isMesh)x.userData.olMode='live'});   // tail meshes move / reshape every frame: outlined with the live normals

  let time=0,walk=0,amp=0,stop=0,wasMv=false,bl=0,bt=2;
  let jumpS=0,airH=0,airV=0,airW=0,landSq=0,tumT=-1,tumF=1,tumS=0,gliding=false,glW=0,flatN=0,gBankT=0,gB=0,gHard=0,flipT=-1,flipD=1,twT=-1,twD=1,gSpin=0;
  const TUMBLE_D=.55,bs=body.scale.clone(),pivot=new T.Vector3(0,-1.0*S,0),eul=new T.Euler(),pv=new T.Vector3();
  const U=catGroup.userData;U.move={f:0,s:0};U.cfg=Object.assign({},o);   // the look this cat was built from (inventory preview rebuilds the same cat from it)

  // ---- body parts: head, eyeL, eyeR, nose, mouth, body, armL, armR, legL, legR, tail. Each can be moved (p), rotated (r, radians) and resized (s) from animation_maker.html.
  //   U.parts[name] = {obj (scaled), h (holder that is moved), src (what the box is measured from), r}  ·  U.setPart(name,{p:[x,y,z],r:[x,y,z],s:[x,y,z]})
  const partObj={};
  const reg=(n,obj,src,w,mode)=>{const h=w||obj;partObj[n]={obj,h,src,mode:mode||'h',r:[0,0,0],b0:h.position.clone(),s0:obj.scale.clone()}};
  const grp=(kids,def)=>{const g=new T.Group(),c=new T.Vector3();kids.forEach(k=>c.add(k.position));if(kids.length)c.divideScalar(kids.length);else c.set(...def);   // a group pivoting on the middle of its pieces
    g.position.copy(c);head.add(g);kids.forEach(k=>{k.position.sub(c);g.add(k)});
    if(!kids.length)g.add(new T.Mesh(new T.BoxGeometry(.1,.1,.1),new T.MeshBasicMaterial({visible:false})));return g};
  reg('head',head,head.children[0],null,'head');reg('body',body,body,null,'body');reg('tail',tail,tail,null,'tail');
  reg('armL',armL,armL.children[0],armL.userData.w);reg('armR',armR,armR.children[0],armR.userData.w);reg('legL',legL,legL.children[0],legL.userData.w);reg('legR',legR,legR.children[0],legR.userData.w);
  {const g0=grp([eyes[0]],[-.37,.09,.8]),g1=grp([eyes[1]],[.37,.09,.8]),gn=grp(noseKids,[0,-.12,.78]),gm=grp(mouthKids,[0,-.25,.73]);reg('eyeL',g0,g0);reg('eyeR',g1,g1);reg('nose',gn,gn);reg('mouth',gm,gm)}
  // ears, collar and cloak: their meshes move into a wrapper group that is moved / rotated / scaled AROUND A PIVOT (ear root, neck). Cloth physics keeps running unscaled; the drawn result is transformed.
  const pgrp=(n,kids,parent,pv)=>{const w=new T.Group();w.matrixAutoUpdate=false;parent.add(w);kids.forEach(k=>w.add(k));const o=new T.Object3D();o.position.set(pv[0],pv[1],pv[2]);w.add(o);
    partObj[n]={obj:w,src:w,org:o,pivot:new T.Vector3(pv[0],pv[1],pv[2]),mode:'pg',r:[0,0,0],pg:1}};
  pgrp('earL',[ears[0]],head,ears[0].position.toArray());pgrp('earR',[ears[1]],head,ears[1].position.toArray());
  pgrp('collar',[...beltKids,tag],cat,[0,-.75,0]);pgrp('cloak',cloakKids,cat,[0,-.8,0]);
  const setPart=(n,l)=>{const t=partObj[n];if(!t||!l)return;const p=l.p||[0,0,0],s=l.s||[1,1,1],r=l.r||[0,0,0];t.r=r;
    if(t.pg){const v=t.pivot;t.obj.matrix.compose(new T.Vector3(v.x+p[0],v.y+p[1],v.z+p[2]),new T.Quaternion().setFromEuler(new T.Euler(r[0],r[1],r[2])),new T.Vector3(s[0],s[1],s[2])).multiply(new T.Matrix4().makeTranslation(-v.x,-v.y,-v.z));t.obj.matrixWorldNeedsUpdate=true;return}
    t.h.position.set(t.b0.x+p[0],t.b0.y+p[1],t.b0.z+p[2]);t.obj.scale.set(t.s0.x*s[0],t.s0.y*s[1],t.s0.z*s[2]);
    if(t.mode==='h')t.h.rotation.set(r[0],r[1],r[2]);   // head / body / tail get their rotation added inside poseUpdate (the pose code owns their rotation)
    else if(n==='body'){body.rotation.x=r[0];body.rotation.y=r[1]}else if(n==='tail')tail.rotation.z=r[2]};
  for(const n in partObj)setPart(n,LAYO[n]);
  U.parts=partObj;U.setPart=setPart;U.setVisible=(n,on)=>{const t=partObj[n];if(!t)return;if(t.kids)t.kids.forEach(k=>k.visible=on);else t.obj.visible=on};
  U.still=false;   // true = no idle breathing / head look-around / tail + ear sway (the animation maker uses it so you can edit a still cat)U.pose=null;   // U.pose = {poseKey:value}: extra rotation / bend added on top of the procedural motion (the maker sets it; clips set it in the game)
  let clipN=null,clipT=0,clipLoop=false;
  U.clips=ANIMS;U.play=(name,loop)=>{const c=ANIMS[name];if(!c)return false;clipN=c;clipT=0;clipLoop=loop!=null?!!loop:!!c.loop;return true};U.stopClip=()=>{clipN=null;U.pose=null};U.isPlaying=()=>!!clipN;
  // ---- the animation set: idle, run, jump (rising / falling), tumble, glide. All procedural, driven by the game through these calls:
  //   U.update(dt,moving,rel)  U.move={f,s}  U.setAir(heightAboveGround,verticalSpeed)  U.jump()  U.land(strength)  U.tumble(f,s)  U.setGlide(bool)
  U.tumble=(f,s)=>{if(tumT>=0)return false;tumT=0;tumF=f;tumS=s;return true};
  U.setAir=(h,vy)=>{airH=h;airV=vy};U.jump=()=>{jumpS=1};U.land=(p=1)=>{landSq=Math.max(landSq,.3+.7*p)};
  U.setGlide=(on,bank=0)=>{if(on&&!gliding){twT=0;twD=bank<0?-1:1}if(!on)twT=-1;gliding=!!on;gBankT=bank};   // starting a glide = acrobatic somersault + twist first, then the glide pose   // bank = -1..1, how hard the glide is turning (left +, right -): the body leans into it
  // ---- glide trail (A Short Hike style): a thin, crisp white line from each hand that follows the flight path, stays a while, then thins out and vanishes. No glow, no blur.
  const TR_LIFE=1.7,TR_Q=.1,TR_MAX=170,TR_W=.035;
  const trG=new T.Group(),trPts=[[],[]],trLast=[null,null],trV=new T.Vector3();
  const trMat=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,fog:false,uniforms:{uCol:{value:new T.Color('#ffffff')},uW:{value:TR_W}},
    vertexShader:'attribute vec3 aDir;attribute float aSide;attribute float aT;uniform float uW;varying float vA;'+
      'void main(){vec3 c=(modelMatrix*vec4(position,1.)).xyz;vec3 sd=cross(aDir,normalize(cameraPosition-c));float l=length(sd);sd=l>1e-4?sd/l:vec3(0.,1.,0.);'+
      'float w=uW*(1.-smoothstep(.5,1.,aT))+.002;vA=(1.-smoothstep(.7,1.,aT))*smoothstep(0.,.03,aT);gl_Position=projectionMatrix*viewMatrix*vec4(c+sd*aSide*w,1.);}',
    fragmentShader:'uniform vec3 uCol;varying float vA;void main(){gl_FragColor=vec4(uCol,vA*.95);}'});
  const trRib=[0,1].map(()=>{
    const g=new T.BufferGeometry(),pos=new Float32Array(TR_MAX*6),dir=new Float32Array(TR_MAX*6),sd=new Float32Array(TR_MAX*2),tt=new Float32Array(TR_MAX*2),idx=[];
    for(let i=0;i<TR_MAX;i++){sd[i*2]=-1;sd[i*2+1]=1}
    for(let i=0;i<TR_MAX-1;i++){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2)}
    g.setAttribute('position',new T.BufferAttribute(pos,3));g.setAttribute('aDir',new T.BufferAttribute(dir,3));g.setAttribute('aSide',new T.BufferAttribute(sd,1));g.setAttribute('aT',new T.BufferAttribute(tt,1));
    g.setIndex(idx);g.setDrawRange(0,0);const m=new T.Mesh(g,trMat);m.frustumCulled=false;m.visible=false;m.renderOrder=5;trG.add(m);return{g,m,pos,dir,tt}});
  const trackHands=dt=>{
    if(!trG.parent&&catGroup.parent)catGroup.parent.add(trG);
    [armL,armR].forEach((a,h)=>{const P=trPts[h];
      for(let i=P.length-1;i>=0;i--){P[i].age+=dt;if(P[i].age>TR_LIFE)P.splice(i,1)}
      if(glW>.6){a.userData.tip.getWorldPosition(trV);const L=trLast[h];
        if(L){const d=Math.hypot(trV.x-L.x,trV.y-L.y,trV.z-L.z);if(d>=TR_Q){const n=Math.min(8,Math.ceil(d/TR_Q));for(let k=1;k<=n;k++)P.push({x:L.x+(trV.x-L.x)*k/n,y:L.y+(trV.y-L.y)*k/n,z:L.z+(trV.z-L.z)*k/n,age:dt*(1-k/n)});trLast[h]={x:trV.x,y:trV.y,z:trV.z}}}
        else{P.push({x:trV.x,y:trV.y,z:trV.z,age:0});trLast[h]={x:trV.x,y:trV.y,z:trV.z}}}
      else trLast[h]=null;
      while(P.length>TR_MAX)P.shift();
      const R=trRib[h],n=P.length;
      if(n<2){R.m.visible=false;return}
      R.m.visible=true;
      for(let i=0;i<n;i++){const p=P[n-1-i],q=P[Math.max(0,n-2-i)],r=P[Math.min(n-1,n-i)],dx=r.x-q.x,dy=r.y-q.y,dz=r.z-q.z,l=Math.hypot(dx,dy,dz)||1,t=p.age/TR_LIFE;
        for(let s=0;s<2;s++){const o=(i*2+s)*3;R.pos[o]=p.x;R.pos[o+1]=p.y;R.pos[o+2]=p.z;R.dir[o]=dx/l;R.dir[o+1]=dy/l;R.dir[o+2]=dz/l;R.tt[i*2+s]=t}}
      R.g.setDrawRange(0,(n-1)*6);
      for(const k of['position','aDir','aT'])R.g.attributes[k].needsUpdate=true})};
  U.dispose=()=>{if(trG.parent)trG.parent.remove(trG);trRib.forEach(r=>r.g.dispose());trMat.dispose()};
  U.walkPhase=()=>walk;U.isTumbling=()=>tumT>=0;U.isGliding=()=>glW>.5;
  // ---- old API (weapons / attacks / aiming / air dash were removed): kept as no-ops so main.js, 5v5, the cat maker etc. keep working
  const noop=()=>{};
  U.kick=U.equip=U.setAim=U.setScope=U.holster=U.airDash=noop;
  U.slash=()=>false;U.isSlashing=()=>false;U.isAirDashing=()=>false;U.weapon=()=>null;U.scope=()=>0;U.recoil=()=>0;U.animSounds=()=>[];
  U.muzzle=v=>(v||new T.Vector3()).set(0,-.5,.7).applyMatrix4(cat.matrixWorld);   // chest height in front of the cat
  // ---- crowd LOD hooks (used by the 5v5 mode): real shadow casting only for nearby cats, and the tiny detail meshes (studs, stitches, eyes, nose ...) hidden on far cats
  let detailList=null;
  // the cat casts a shadow but does not RECEIVE one (self-shadow noise = shiny white speckles on dark fur), and no env-map shine on its standard materials
  U.flatten=()=>catGroup.traverse(o=>{if(!o.isMesh)return;o.receiveShadow=false;for(const m of (Array.isArray(o.material)?o.material:[o.material])){if(m&&m.isMeshStandardMaterial&&m.metalness<.2){m.envMapIntensity=.15;m.roughness=Math.max(m.roughness,.92)}}});U.flatten();
  U.setShadow=on=>catGroup.traverse(o=>{if(!o.isMesh)return;if(o.userData.cs===undefined)o.userData.cs=o.castShadow;o.castShadow=on&&o.userData.cs});
  U.setDetail=on=>{
    if(!detailList){detailList=[];catGroup.updateMatrixWorld(true);const bb=new T.Box3(),sz=new T.Vector3();
      catGroup.traverse(o=>{if(!o.isMesh||!o.visible||!o.geometry)return;bb.setFromObject(o);bb.getSize(sz);if(sz.length()<.12)detailList.push(o)})}
    for(const m of detailList)m.visible=on};

  // ---- ear sway: damped springs driven by the head's acceleration, plus the odd flick ----
  const eP=new T.Vector3(),eP0=new T.Vector3(),eV=new T.Vector3(),eV0=new T.Vector3(),eA=new T.Vector3(),eAs=new T.Vector3(),hQ=new T.Quaternion(),hP=new T.Vector3(),hS=new T.Vector3();
  let earInit=false;
  const earPhysics=dt=>{
    if(!(dt>0))return;
    head.updateWorldMatrix(true,false);head.matrixWorld.decompose(hP,hQ,hS);
    eP.set(0,.5,0).applyMatrix4(head.matrixWorld);
    if(!earInit){eP0.copy(eP);eV0.set(0,0,0);earInit=true}
    eV.copy(eP).sub(eP0).divideScalar(dt);eP0.copy(eP);
    eA.copy(eV).sub(eV0).divideScalar(dt);eV0.copy(eV);
    hQ.invert();eA.applyQuaternion(hQ).divideScalar(hS.x||1);
    eA.x=Math.max(-150,Math.min(150,eA.x));eA.y=Math.max(-150,Math.min(150,eA.y));eA.z=Math.max(-150,Math.min(150,eA.z));
    eAs.lerp(eA,ease(dt,22));
    const n=Math.ceil(dt/.012),h=dt/n;
    earRig.forEach(r=>{
      if(U.still)r.flick=9;r.flick-=dt;if(r.flick<=0){r.flick=3+Math.random()*5;r.vz+=(Math.random()-.5)*9*r.fl;r.vx+=(Math.random()-.5)*5*r.fl}
      const C=.7*Math.sqrt(r.k),g=r.k*.005*r.fl;
      for(let i=0;i<n;i++){
        r.vz+=(-r.k*r.z-C*r.vz+g*(eAs.x-r.s*eAs.y*.6))*h;r.z+=r.vz*h;
        r.vx+=(-r.k*r.x-C*r.vx-g*eAs.z)*h;r.x+=r.vx*h;
      }
      r.z=Math.max(-.8,Math.min(.8,r.z));r.x=Math.max(-.8,Math.min(.8,r.x));
      r.sw.rotation.set(r.bx+r.x,0,-r.s*r.out+r.z);
    });
    // name plate pendulum: lags behind acceleration (forward accel swings it back, sideways accel swings it sideways)
    const K=55,Ct=3.2,gt=K*.012;
    for(let i=0;i<n;i++){
      tagS.vx+=(-K*tagS.x-Ct*tagS.vx+gt*eAs.z)*h;tagS.x+=tagS.vx*h;
      tagS.vz+=(-K*tagS.z-Ct*tagS.vz-gt*eAs.x)*h;tagS.z+=tagS.vz*h;
    }
    tagS.x=Math.max(-1,Math.min(.3,tagS.x));tagS.z=Math.max(-.9,Math.min(.9,tagS.z));  // can't swing into the chest
    tag.rotation.set(tagS.x,0,tagS.z);
  };

  const poseUpdate=(dt,mv,rel=1)=>{
    time=U.still?0:time+dt;const rolling=tumT>=0;
    if(clipN){clipT+=dt*clipN.fps;const last=clipN.frames-1;if(clipT>=last){if(clipLoop)clipT%=Math.max(1,last);else{clipT=last}}U.pose=sampleClip(clipN,clipT);if(!clipLoop&&clipT>=last)clipN=null}
    // ---- state weights, all eased: airW = off the ground, glW = gliding, amp = running, vN = vertical speed (+ rising, - falling)
    airW+=((airH>.04?1:0)-airW)*ease(dt,airH>.04?22:16);
    const vN=clamp(airV/7.8,-1.4,1.2);jumpS=Math.max(0,jumpS-dt*4.5);
    if(twT>=0){twT+=dt;if(twT>=.4)twT=-1}glW+=(((gliding&&airW>.5&&!rolling)?1:0)-glW)*ease(dt,gliding?9:7);const gl=glW;gB+=(gBankT-gB)*ease(dt,4.5);
    /* U.flatten() now runs from U.update below, every few real frames */   // ears / hair / hats get rebuilt when the look changes: keep them all shadow-free
    if(shM){shM.position.y=shY-airH;shM.scale.copy(shS).multiplyScalar(1-.3*Math.min(1,airH/1.6))}
    amp+=((mv&&!rolling?1:0)-amp)*ease(dt,mv?9:7);
    walk+=dt*(6+9*amp)*amp*(rel<-.2?-1:1);
    if(wasMv&&!mv)stop=1;if(mv)stop=0;wasMv=mv;stop=Math.max(0,stop-dt*1.7);
    landSq=Math.max(0,landSq-dt*5);
    const sw=Math.sin(walk),cs=Math.cos(walk),sk=stop*stop,wob=Math.sin((1-stop)*Math.PI*3)*sk,br=Math.sin(time*2.2),lean=.2*amp-.1*sk+wob*.08;

    // ---- tumble: a somersault in the move direction, curled up
    let tuck=0,rollA=0,rolX=0,rolZ=0;
    if(rolling){tumT+=dt;const u=Math.min(1,tumT/TUMBLE_D),e=u*u*(3-2*u);rollA=e*Math.PI*2;
      if(Math.abs(tumF)>=Math.abs(tumS))rolX=(tumF>=0?1:-1)*rollA;else rolZ=(tumS>=0?1:-1)*rollA;
      tuck=sm(0,.18,u)*(1-sm(.78,1,u));if(tumT>=TUMBLE_D){tumT=-1;landSq=1}}

    // ---- legs: run swing, jump (knees tucked while rising, reaching down while falling), glide (trailing straight behind)
    legL.rotation.x=sw*.95*amp+sk*.4;legR.rotation.x=-sw*.95*amp-sk*.3;legL.rotation.z=legR.rotation.z=0;
    legL.position.y=LY+Math.max(0,cs)*.14*amp;legR.position.y=LY+Math.max(0,-cs)*.14*amp;
    if(airW>.001){const r=sm(-.25,.9,vN);
      legL.rotation.x=lerp(legL.rotation.x,lerp(-.15,-1.15,r),airW);legR.rotation.x=lerp(legR.rotation.x,lerp(.25,-.65,r),airW);
      legL.position.y=lerp(legL.position.y,LY+.1*r,airW);legR.position.y=lerp(legR.position.y,LY+.14*r,airW)}
    if(gl>0){legL.rotation.x=lerp(legL.rotation.x,.55+Math.sin(time*6)*.06,gl);legR.rotation.x=lerp(legR.rotation.x,.4-Math.sin(time*6)*.06,gl);legL.rotation.z=-.12*gl;legR.rotation.z=.12*gl}
    if(tuck>0){legL.rotation.x=lerp(legL.rotation.x,-1.25,tuck);legR.rotation.x=lerp(legR.rotation.x,-1.25,tuck)}

    // ---- arms: opposite to the legs when running, up and out when jumping, spread wide like wings when gliding
    const tilt=.24+amp*.06+br*.015;
    let lX=-sw*.8*amp-br*.015,rX=sw*.8*amp+br*.02,lZ=-tilt,rZ=tilt+.04;
    if(airW>.001){const fa=airW*(1-gl);lX=lerp(lX,-1.75+vN*.15,fa);rX=lerp(rX,-1.75+vN*.15,fa);lZ=lerp(lZ,-.75,fa);rZ=lerp(rZ,.75,fa)}
    if(gl>0){const fl=Math.sin(time*9)*.05;lX=lerp(lX,-.18+fl,gl);rX=lerp(rX,-.18-fl,gl);lZ=lerp(lZ,-1.42,gl);rZ=lerp(rZ,1.42,gl)}
    if(tuck>0){lX=lerp(lX,-.95,tuck);rX=lerp(rX,-.95,tuck);lZ=lerp(lZ,-.45,tuck);rZ=lerp(rZ,.45,tuck)}
    armL.rotation.x=lX;armL.rotation.z=lZ;armR.rotation.x=rX;armR.rotation.z=rZ;

    // ---- joints: elbows fold when running, knees fold with every step
    let eL=.14+br*.02,eR=eL,kL=.07+br*.012,kR=kL;
    eL=lerp(eL,clamp(.55-.75*lX,.1,1.3),amp);eR=lerp(eR,clamp(.55-.75*rX,.1,1.3),amp);
    kL+=amp*(.2+Math.max(0,-cs))+sk*.25;kR+=amp*(.2+Math.max(0,cs))+sk*.25;
    if(airW>.001){const r=sm(-.25,.9,vN);kL=lerp(kL,.3+r,airW);kR=lerp(kR,.25+.9*r,airW);eL=lerp(eL,.35,airW);eR=lerp(eR,.35,airW)}
    if(gl>0){eL=lerp(eL,.08,gl);eR=lerp(eR,.08,gl);kL=lerp(kL,.35,gl);kR=lerp(kR,.3,gl)}
    if(tuck>0){eL=lerp(eL,1.4,tuck);eR=lerp(eR,1.4,tuck);kL=lerp(kL,1.6,tuck);kR=lerp(kR,1.6,tuck)}
    {const P=U.pose||{};armL.userData.setBend(eL+(P.elbowL||0));armR.userData.setBend(eR+(P.elbowR||0));legL.userData.setBend(kL+(P.kneeL||0));legR.userData.setBend(kR+(P.kneeR||0))}

    // ---- body: lean into the run, nose up / down with the jump, dive forward and bank when gliding
    let rx=lean+airW*(-vN)*.22,rz=-U.move.s*.1*amp,ry=sw*.08*amp;
    if(gl>0){rx=lerp(rx,1.4+Math.sin(time*4)*.04,gl);rz=lerp(rz,-gB*.2,gl);ry=lerp(ry,-gB*1.1,gl)}   // glide: lie flat (head forward, belly down); it rolls only with the turn: straight flight = level, turning = rolls into the turn around the body axis
    {const hard=gl>.5&&Math.abs(gB)>.8;gHard=hard?gHard+dt:Math.max(0,gHard-dt*2);if(gHard>.8&&flipT<0){flipT=0;flipD=gB>0?1:-1;gHard=0}   // turning flat out for a while: one full roll, then it settles
      if(flipT>=0){flipT+=dt;const u=Math.min(1,flipT/.4);ry-=flipD*u*u*(3-2*u)*Math.PI*2;if(u>=1)flipT=-1}}
    if(twT>=0){const u=Math.min(1,twT/.4),e=u*u*(3-2*u);ry-=e*Math.PI*2*twD}   // glide start: a fast full barrel roll around the body axis (not a tumble) while it levels out flat
    if(rolling){if(rolX)rx=rolX;if(rolZ)rz=rolZ}
    const hop=rolling?Math.sin(Math.min(1,tumT/TUMBLE_D)*Math.PI)*.1:0;
    eul.set(rx,ry,rz,'XYZ');cat.rotation.copy(eul);pv.copy(pivot).applyEuler(eul);
    cat.position.set(0,FY+Math.abs(cs)*.1*amp*(1-airW)+br*.012*(1-amp)+(pivot.y-pv.y)+hop-landSq*.05+Math.sin(time*3)*.025*gl,pivot.z-pv.z);
    const sq=1-.16*tuck-.1*landSq,stY=1+.16*jumpS+.05*airW*Math.abs(vN),stX=1-.07*jumpS-.025*airW*Math.abs(vN);   // squash on landing / curled, stretch on take-off and when falling fast
    cat.scale.set(S*stX*(1+.07*sk+.1*tuck+.08*landSq),S*stY*(sq-.1*sk-Math.abs(cs)*.025*amp+br*.01*(1-amp)),S*stX*(1+.07*sk+.1*tuck+.08*landSq));
    body.rotation.z=sw*.06*amp;
    head.rotation.x=-lean*.8*(1-gl)-gl*.4+sk*.12+tuck*.5;                                  // glide: the head lifts to look where it is flying
    head.rotation.y=Math.sin(time*.6)*.18*(1-amp)*(1-sk)*(1-gl);                            // idle: looks around
    head.rotation.z=Math.sin(time*.8)*.04+sw*.05*amp;
    ears.forEach((e,i)=>e.rotation.x=-amp*.35+sk*.35+airW*(-vN)*.4-gl*.5+Math.sin(time*3+i*2)*.03);
    tail.rotation.x=-.55*amp+sk*.45+airW*(.3-.35*vN)*(1-gl)-.55*gl;tail.rotation.y=Math.sin(time*(2.5+6*amp))*(.3+.15*amp)+wob*.7;
    
    // ---- layout rotation (maker) + pose / clip rotation, added on top of the procedural motion
    {const P=U.pose||{},g=k=>P[k]||0,pr=partObj;
      head.rotation.x+=pr.head.r[0]+g('headRx');head.rotation.y+=pr.head.r[1]+g('headRy');head.rotation.z+=pr.head.r[2]+g('headRz');
      body.rotation.x=pr.body.r[0]+g('bodyRx');body.rotation.y=pr.body.r[1]+g('bodyRy');body.rotation.z+=g('bodyRz');
      tail.rotation.x+=g('tailRx');tail.rotation.y+=g('tailRy');tail.rotation.z=pr.tail.r[2]+g('tailRz');
      [['armL',armL],['armR',armR],['legL',legL],['legR',legR]].forEach(([n,o])=>{o.rotation.x+=g(n+'Rx');o.rotation.y=g(n+'Ry');o.rotation.z+=g(n+'Rz')});
      cat.position.y+=g('moveY')}
    // ---- physics: whiskers, fur locks, cloak, tail, ears, name plate, collar belt, hood, hair
    ropes.forEach(r=>r.step(dt));if(cloth){cloth.step(dt);lining.step(dt);if(leaves)leaves.lv.place(leaves.P)}tf.update();earMods.forEach(f=>f());
    if(catGroup.userData.olList)syncOL(catGroup.userData.olList);
    trackHands(dt);
    earPhysics(dt);belt.step(dt);belt.anchor(tag.position);if(hood)hood.step(dt);if(hair)hair.step(dt);
  };
  // ---- 12 FPS LOOK: the pose (limbs, body, ears, tail, cloth, hair...) is only refreshed 12 times a second and then held, like hand-drawn animation shot on twos.
  // The cat still travels smoothly across the ground (main.js moves the group every frame); only its animation is stepped.
  //   U.setFps(12) = stepped  ·  U.setFps(0) = every frame (smooth, the old look)
  let fps=12,fAcc=0;
  U.setFps=n=>{fps=+n||0;fAcc=0};
  let flN=0;
  U.update=(dt,mv,rel=1)=>{
    if((flN=(flN+1)%6)===0)U.flatten();   // ears / hair / hats get rebuilt when the look changes: keep them shadow-free every few REAL frames (stepping the pose must not delay it)
    if(fps<=0||dt<=0){fAcc=0;poseUpdate(dt,mv,rel);return}   // dt 0 = a forced refresh (cat maker, first pose): never skip it
    const step=1/fps;fAcc+=dt;
    if(fAcc<step-1e-4)return;                                // hold the last pose
    fAcc-=step;if(fAcc>step*2)fAcc=0;                        // after a long hitch do not run a burst of catch-up frames
    poseUpdate(step,mv,rel)};
  U.flatten();   // right now, so the very first rendered frame of a new / switched cat has no self-shadow either
  catGroup.updateMatrixWorld(true);bindCoat(cat,coatMeshes);
  return catGroup;
}
