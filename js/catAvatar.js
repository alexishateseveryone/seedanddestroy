// Ming the cat: eased run/stop animation, rope-physics tail + whiskers, cloth-physics cloak, pistol arm.
import * as T from 'three';
import {lumpy,LUMP2,G,mat,BM,M,mix,shadow} from './blocks.js';
import {Rope,Cloth,VM} from './physics.js';
import {makeCoat,bindCoat,PATTERNS} from './coatShader.js';
import {createBelt,COLLAR_TYPES} from './collar.js';
import {createHood} from './hood.js';
import {BladeTrail} from './bladeTrail.js';
import {samplePose} from './animPlayer.js';
import {EYE_STYLES,NOSES,CHEEKS,TAILS,buildEyes,buildNose,buildCheeks,buildTail,tailColor,WHISKERS,buildWhiskers} from './catFeatures.js';
import {EARS,EAR_NAMES,HEADS,EYEWEAR,GEAR_COLS,buildEar,buildHeadwear,buildEyewear,cloakRest,cloakShape,cloakColor,cloakLining,buildLeaves,kindOf} from './wearables.js';
export {COLLAR_TYPES,PATTERNS,EARS,EAR_NAMES,HEADS,EYEWEAR,GEAR_COLS,EYE_STYLES,NOSES,CHEEKS,TAILS,WHISKERS};
export const COATS=[['#f6dfbd','#ee9a48'],['#ee9a48','#9a5a24'],['#fff4e6','#b9bfcc'],['#3b3a45','#fff4e6'],['#d9b48a','#5a3a28'],['#9aa3b5','#fff4e6'],['#c7b4f0','#fff4e6'],['#7a4a2b','#e8c79a'],['#ffe9a8','#ffb347'],['#e6f4ff','#7fb8e8'],['#2a2a35','#ee9a48'],['#d8f0d0','#7fcf7f'],
  ['#ffc4dc','#ff86b3'],['#ff7aa8','#fff4e6'],['#ffd0b0','#ff9a7a'],['#c92a3a','#fff4e6'],['#a9d8ff','#fff4e6'],['#2f4a8a','#c9d6ff'],['#7b3f8f','#e9c8f5'],['#14141c','#6b6b80'],['#fff1d0','#e8c27a'],['#5c6b7a','#dfe6ee'],['#fff27a','#ffb84a'],['#3fb6a8','#e6fff9']];
export const COAT_NAMES=['Ming','Ginger','Snow','Tux','Mocha','Smoke','Lilac','Cocoa','Butter','Frost','Ember','Mint','Blush','Rose','Peach','Crimson','Sky','Navy','Plum','Midnight','Cream','Slate','Lemon','Teal'];
export const EYECS=['#4bd37b','#4aa8ff','#ffc93c','#ff6fa0','#b07aff','#ff7a3c','#7ee6d2','#ff4d6d'];
export const COLLARS=['#e63946','#4aa8ff','#ff8fc0','#58c878','#ffd54a','#b07aff','#ffffff','#2a2433','#ff7a3c','#7ee6d2']; // always worn: no "none"
export const CLOAKS=[['none','None','Off'],['tattered','Tattered','Rags'],['short','Short','Scarf'],['long','Long','Coat'],['royal','Royal','Cape'],['leaves','Leaves','Leafy']];
export const CLOAK_COLS=['#8a5a3a','#6d4cff','#e63946','#2fa8ff','#2fbf71','#ffb300','#2a2433','#ff6fa0','#ffffff','#ff7a3c','#58d6ff','#c58aff'];

function painted(geo,fn){const p=geo.attributes.position,c=new Float32Array(p.count*3),col=new T.Color(),v=new T.Vector3();
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);col.set(fn(v));c.set([col.r,col.g,col.b],i*3)}geo.setAttribute('color',new T.BufferAttribute(c,3));return geo}
function tagTex(name){const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),t=name.toUpperCase();g.fillStyle='#f2c44e';g.fillRect(0,0,64,64);
  let fs=20;g.font='800 '+fs+'px Arial';while(g.measureText(t).width>52&&fs>8){fs--;g.font='800 '+fs+'px Arial'}g.fillStyle='#8a5a14';g.textAlign='center';g.textBaseline='middle';g.fillText(t,32,34);
  const x=new T.CanvasTexture(c);x.colorSpace=T.SRGBColorSpace;return x}
// ---- animation sounds: the sound of an animation event (set in the maker) goes to ONE handler for every cat: globalThis.__animSfx, registered by audio.js (createAudio). No import between the two files. cat.userData.onAnimSfx overrides it for one cat.
const animSounds=()=>{const out=new Set();for(const id in WEAPON_ANIMS)for(const n in WEAPON_ANIMS[id].anims)(WEAPON_ANIMS[id].anims[n].events||[]).forEach(e=>{if(e.sfx)out.add(e.sfx)});return [...out]};   // every sound file used by an animation event
const ease=(dt,k)=>1-Math.exp(-dt*k);
const HV_SPEED=1,HV_FADE=.06,TAU2=Math.PI*2;   // HV_SPEED = playback speed of the authored attacks (1 = exactly as made in the maker); HV_FADE = blend in/out seconds
const mixPose=(a,b,t)=>{const o={};for(const k in b)o[k]=a[k]===undefined?b[k]:a[k]+(b[k]-a[k])*t;return o};
// <WEAPON_ANIMS>
// Animations exported from animation_maker.html (do not edit by hand: re-export from the maker).
// One set per WEAPON (axe, scythe, katana...). 'type:<type>' = shared fallback for weapons of that type with no set of their own; without it the type's main weapon is used (normal = woodensword, heavy = axe, dual = dualdagger, longblade = katana).
// chain = attack combo order, state = idle / run / air / dash. Events may carry sfx/vol/pitch/skip.
const WEAPON_ANIMS={
 "woodensword":{chain:["attack1","attack2"],state:{"idle":"idle","run":"run","air":"air","dash":"dash"},anims:{
  "attack1":{fps:30,frames:16,loop:false,role:"attack",dir:1,groups:{"arms":true,"weapon":true,"body":true,"legs":true,"head":true},
   keys:[
    {"f":2,"ease":"linear","pose":{"wX":-2.206,"wZ":0.357,"oX":0.402,"oZ":0.284,"wrist":-0.149,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":-0.096,"bodyY":0.321,"bodyZ":0,"lift":0,"legLx":0.07,"legRx":0.154,"legLz":0,"legRz":0,"headX":0.038,"headY":-0.224,"headZ":0.04,"trail":0}},
    {"f":3,"ease":"linear","pose":{"wX":-2.492,"wZ":0.347,"oX":0.497,"oZ":0.283,"wrist":-0.029,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":-0.079,"bodyY":0.305,"bodyZ":0,"lift":0,"legLx":0.054,"legRx":0.12,"legLz":0,"legRz":0,"headX":0.031,"headY":-0.214,"headZ":0.04,"trail":1}},
    {"f":4,"ease":"linear","pose":{"wX":-0.885,"wZ":-0.686,"oX":0.5,"oZ":0.282,"wrist":-0.186,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.193,"bodyY":-0.309,"bodyZ":0,"lift":0,"legLx":-0.164,"legRx":-0.361,"legLz":0,"legRz":0,"headX":-0.077,"headY":0.097,"headZ":0.04,"trail":1}},
    {"f":5,"ease":"linear","pose":{"wX":-0.317,"wZ":-1.048,"oX":0.5,"oZ":0.281,"wrist":-0.243,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.289,"bodyY":-0.524,"bodyZ":0,"lift":0,"legLx":-0.241,"legRx":-0.53,"legLz":0,"legRz":0,"headX":-0.115,"headY":0.208,"headZ":0.04,"trail":1}},
    {"f":6,"ease":"linear","pose":{"wX":-0.249,"wZ":-1.091,"oX":0.5,"oZ":0.28,"wrist":-0.25,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.3,"bodyY":-0.549,"bodyZ":0,"lift":0,"legLx":-0.25,"legRx":-0.55,"legLz":0,"legRz":0,"headX":-0.12,"headY":0.224,"headZ":0.04,"trail":1}},
    {"f":7,"ease":"linear","pose":{"wX":-0.168,"wZ":-1.188,"oX":0.5,"oZ":0.279,"wrist":-0.25,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.3,"bodyY":-0.468,"bodyZ":0,"lift":0,"legLx":-0.25,"legRx":-0.55,"legLz":0,"legRz":0,"headX":-0.12,"headY":0.187,"headZ":0.039,"trail":1}},
    {"f":8,"ease":"linear","pose":{"wX":-0.166,"wZ":-1.189,"oX":0.5,"oZ":0.278,"wrist":-0.25,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.3,"bodyY":-0.466,"bodyZ":0,"lift":0,"legLx":-0.25,"legRx":-0.55,"legLz":0,"legRz":0,"headX":-0.12,"headY":0.189,"headZ":0.039,"trail":1}},
    {"f":9,"ease":"linear","pose":{"wX":-0.215,"wZ":-1.081,"oX":0.479,"oZ":0.277,"wrist":-0.271,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.288,"bodyY":-0.502,"bodyZ":0,"lift":0,"legLx":-0.24,"legRx":-0.527,"legLz":0,"legRz":0,"headX":-0.115,"headY":0.211,"headZ":0.039,"trail":1}},
    {"f":10,"ease":"linear","pose":{"wX":-0.196,"wZ":-0.904,"oX":0.392,"oZ":0.276,"wrist":-0.357,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.236,"bodyY":-0.432,"bodyZ":0,"lift":0,"legLx":-0.197,"legRx":-0.432,"legLz":0,"legRz":0,"headX":-0.094,"headY":0.18,"headZ":0.039,"trail":1}},
    {"f":11,"ease":"linear","pose":{"wX":-0.132,"wZ":-0.693,"oX":0.266,"oZ":0.275,"wrist":-0.48,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.162,"bodyY":-0.297,"bodyZ":0,"lift":0,"legLx":-0.135,"legRx":-0.297,"legLz":0,"legRz":0,"headX":-0.065,"headY":0.115,"headZ":0.038,"trail":0}},
    {"f":13,"ease":"linear","pose":{"wX":-0.014,"wZ":-0.302,"oX":0.032,"oZ":0.273,"wrist":-0.709,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.024,"bodyY":-0.045,"bodyZ":0,"lift":0,"legLx":-0.02,"legRx":-0.045,"legLz":0,"legRz":0,"headX":-0.01,"headY":-0.003,"headZ":0.038,"trail":0}},
    {"f":14,"ease":"linear","pose":{"wX":0.008,"wZ":-0.232,"oX":-0.011,"oZ":0.272,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0,"bodyY":0,"bodyZ":0,"lift":0,"legLx":0,"legRx":0,"legLz":0,"legRz":0,"headX":0,"headY":-0.022,"headZ":0.037,"trail":0}},
    {"f":15,"ease":"linear","pose":{"wX":0.009,"wZ":-0.231,"oX":-0.012,"oZ":0.271,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0,"bodyY":0,"bodyZ":0,"lift":0,"legLx":0,"legRx":0,"legLz":0,"legRz":0,"headX":0,"headY":-0.019,"headZ":0.037,"trail":0}},
   ],
   events:[{"f":3,"name":"swing","sfx":"assets/sfx/slash.wav"},{"f":5,"name":"hit"}]
  },
  "attack2":{fps:30,frames:16,loop:false,role:"attack",dir:-1,groups:{"arms":true,"weapon":true,"body":true,"legs":true,"head":true},
   keys:[
    {"f":0,"ease":"linear","pose":{"wX":-0.381,"wZ":-0.333,"oX":0.055,"oZ":0.266,"wrist":-0.643,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":-0.017,"bodyY":-0.057,"bodyZ":0,"lift":0,"legLx":0.028,"legRx":0.013,"legLz":0,"legRz":0,"headX":0.007,"headY":0.067,"headZ":0.028,"trail":0}},
    {"f":2,"ease":"linear","pose":{"wX":-2.202,"wZ":-0.828,"oX":0.397,"oZ":0.266,"wrist":-0.149,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":-0.096,"bodyY":-0.321,"bodyZ":0,"lift":0,"legLx":0.154,"legRx":0.07,"legLz":0,"legRz":0,"headX":0.038,"headY":0.206,"headZ":0.026,"trail":0}},
    {"f":3,"ease":"linear","pose":{"wX":-2.99,"wZ":-1.09,"oX":0.497,"oZ":0.267,"wrist":-0.029,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":-0.36,"bodyY":-0.305,"bodyZ":0,"lift":0,"legLx":0.12,"legRx":0.054,"legLz":0,"legRz":0,"headX":-0.09,"headY":-0.09,"headZ":0.025,"trail":1}},
    {"f":4,"ease":"linear","pose":{"wX":-0.885,"wZ":0.216,"oX":0.5,"oZ":0.267,"wrist":-0.186,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.193,"bodyY":0.309,"bodyZ":0,"lift":0,"legLx":-0.361,"legRx":-0.164,"legLz":0,"legRz":0,"headX":-0.077,"headY":-0.102,"headZ":0.024,"trail":1}},
    {"f":5,"ease":"linear","pose":{"wX":-0.317,"wZ":0.579,"oX":0.5,"oZ":0.268,"wrist":-0.243,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.289,"bodyY":0.524,"bodyZ":0,"lift":0,"legLx":-0.53,"legRx":-0.241,"legLz":0,"legRz":0,"headX":-0.115,"headY":-0.206,"headZ":0.023,"trail":1}},
    {"f":6,"ease":"linear","pose":{"wX":-0.249,"wZ":0.623,"oX":0.5,"oZ":0.269,"wrist":-0.25,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.3,"bodyY":0.549,"bodyZ":0,"lift":0,"legLx":-0.55,"legRx":-0.25,"legLz":0,"legRz":0,"headX":-0.12,"headY":-0.215,"headZ":0.023,"trail":1}},
    {"f":7,"ease":"linear","pose":{"wX":-0.168,"wZ":0.72,"oX":0.5,"oZ":0.269,"wrist":-0.25,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.3,"bodyY":0.468,"bodyZ":0,"lift":0,"legLx":-0.55,"legRx":-0.25,"legLz":0,"legRz":0,"headX":-0.12,"headY":-0.171,"headZ":0.022,"trail":1}},
    {"f":8,"ease":"linear","pose":{"wX":-0.166,"wZ":0.721,"oX":0.5,"oZ":0.27,"wrist":-0.25,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.3,"bodyY":0.466,"bodyZ":0,"lift":0,"legLx":-0.55,"legRx":-0.25,"legLz":0,"legRz":0,"headX":-0.12,"headY":-0.167,"headZ":0.021,"trail":1}},
    {"f":9,"ease":"linear","pose":{"wX":-0.214,"wZ":0.614,"oX":0.479,"oZ":0.271,"wrist":-0.271,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.288,"bodyY":0.502,"bodyZ":0,"lift":0,"legLx":-0.527,"legRx":-0.24,"legLz":0,"legRz":0,"headX":-0.115,"headY":-0.182,"headZ":0.02,"trail":1}},
    {"f":10,"ease":"linear","pose":{"wX":-0.195,"wZ":0.436,"oX":0.391,"oZ":0.272,"wrist":-0.357,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.236,"bodyY":0.432,"bodyZ":0,"lift":0,"legLx":-0.432,"legRx":-0.197,"legLz":0,"legRz":0,"headX":-0.094,"headY":-0.144,"headZ":0.019,"trail":1}},
    {"f":11,"ease":"linear","pose":{"wX":-0.132,"wZ":0.226,"oX":0.265,"oZ":0.273,"wrist":-0.48,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.162,"bodyY":0.297,"bodyZ":0,"lift":0,"legLx":-0.297,"legRx":-0.135,"legLz":0,"legRz":0,"headX":-0.065,"headY":-0.072,"headZ":0.018,"trail":0}},
    {"f":13,"ease":"linear","pose":{"wX":-0.016,"wZ":-0.166,"oX":0.034,"oZ":0.275,"wrist":-0.709,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.024,"bodyY":0.045,"bodyZ":0,"lift":0,"legLx":-0.045,"legRx":-0.02,"legLz":0,"legRz":0,"headX":-0.01,"headY":0.06,"headZ":0.016,"trail":0}},
    {"f":14,"ease":"linear","pose":{"wX":0.004,"wZ":-0.236,"oX":-0.005,"oZ":0.276,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0,"bodyY":0,"bodyZ":0,"lift":0,"legLx":0,"legRx":0,"legLz":0,"legRz":0,"headX":0,"headY":0.086,"headZ":0.015,"trail":0}},
    {"f":15,"ease":"linear","pose":{"wX":0.003,"wZ":-0.237,"oX":-0.004,"oZ":0.277,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0,"bodyY":0,"bodyZ":0,"lift":0,"legLx":0,"legRx":0,"legLz":0,"legRz":0,"headX":0,"headY":0.089,"headZ":0.014,"trail":0}},
   ],
   events:[{"f":3,"name":"swing","sfx":"assets/sfx/slash.wav"},{"f":5,"name":"hit"}]
  },
  "idle":{fps:30,frames:85,loop:true,role:"idle",dir:0,groups:{"arms":true,"weapon":true,"body":true,"legs":true,"head":true},
   keys:[
    {"f":0,"ease":"linear","pose":{"wX":-0.015,"wZ":-0.255,"oX":0.02,"oZ":0.295,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0,"bodyY":0,"bodyZ":0,"lift":0,"legLx":0,"legRx":0,"legLz":0,"legRz":0,"headX":0,"headY":0.073,"headZ":0.021,"trail":0}},
    {"f":57,"ease":"linear","pose":{"wX":0.008,"wZ":-0.232,"oX":-0.011,"oZ":0.272,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0,"bodyY":0,"bodyZ":0,"lift":0,"legLx":0,"legRx":0,"legLz":0,"legRz":0,"headX":0,"headY":0.18,"headZ":0.035,"trail":0}},
    {"f":83,"ease":"linear","pose":{"wX":-0.015,"wZ":-0.255,"oX":0.019,"oZ":0.295,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0,"bodyY":0,"bodyZ":0,"lift":0,"legLx":0,"legRx":0,"legLz":0,"legRz":0,"headX":0,"headY":0.157,"headZ":0.014,"trail":0}},
    {"f":84,"ease":"linear","pose":{"wX":-0.015,"wZ":-0.255,"oX":0.02,"oZ":0.295,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0,"bodyY":0,"bodyZ":0,"lift":0,"legLx":0,"legRx":0,"legLz":0,"legRz":0,"headX":0,"headY":0.073,"headZ":0.021,"trail":0}},
   ],
   events:[]
  },
  "run":{fps:30,frames:14,loop:true,role:"run",dir:0,groups:{"arms":true,"weapon":true,"body":true,"legs":true,"head":true},
   keys:[
    {"f":0,"ease":"linear","pose":{"wX":0.008,"wZ":-0.288,"oX":-0.006,"oZ":0.328,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.2,"bodyY":0.001,"bodyZ":0,"lift":0,"legLx":0.011,"legRx":-0.011,"legLz":0,"legRz":0,"headX":-0.16,"headY":0,"headZ":-0.035,"trail":0}},
    {"f":1,"ease":"linear","pose":{"wX":-0.155,"wZ":-0.288,"oX":0.412,"oZ":0.328,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.2,"bodyY":0.038,"bodyZ":0,"lift":0,"legLx":0.451,"legRx":-0.451,"legLz":0,"legRz":0,"headX":-0.16,"headY":0,"headZ":-0.012,"trail":0}},
    {"f":2,"ease":"linear","pose":{"wX":-0.28,"wZ":-0.289,"oX":0.732,"oZ":0.329,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.2,"bodyY":0.066,"bodyZ":0,"lift":0,"legLx":0.788,"legRx":-0.788,"legLz":0,"legRz":0,"headX":-0.16,"headY":0,"headZ":0.005,"trail":0}},
    {"f":3,"ease":"linear","pose":{"wX":-0.338,"wZ":-0.29,"oX":0.881,"oZ":0.33,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.2,"bodyY":0.08,"bodyZ":0,"lift":0,"legLx":0.944,"legRx":-0.944,"legLz":0,"legRz":0,"headX":-0.16,"headY":0,"headZ":0.013,"trail":0}},
    {"f":4,"ease":"linear","pose":{"wX":-0.316,"wZ":-0.291,"oX":0.825,"oZ":0.331,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.2,"bodyY":0.074,"bodyZ":0,"lift":0,"legLx":0.884,"legRx":-0.884,"legLz":0,"legRz":0,"headX":-0.16,"headY":0,"headZ":0.009,"trail":0}},
    {"f":5,"ease":"linear","pose":{"wX":-0.221,"wZ":-0.292,"oX":0.578,"oZ":0.332,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.2,"bodyY":0.052,"bodyZ":0,"lift":0,"legLx":0.621,"legRx":-0.621,"legLz":0,"legRz":0,"headX":-0.16,"headY":0,"headZ":-0.005,"trail":0}},
    {"f":8,"ease":"linear","pose":{"wX":0.241,"wZ":-0.294,"oX":-0.612,"oZ":0.334,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.2,"bodyY":-0.054,"bodyZ":0,"lift":0,"legLx":-0.638,"legRx":0.638,"legLz":0,"legRz":0,"headX":-0.16,"headY":0,"headZ":-0.072,"trail":0}},
    {"f":9,"ease":"linear","pose":{"wX":0.333,"wZ":-0.295,"oX":-0.851,"oZ":0.335,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.2,"bodyY":-0.075,"bodyZ":0,"lift":0,"legLx":-0.892,"legRx":0.892,"legLz":0,"legRz":0,"headX":-0.16,"headY":0,"headZ":-0.086,"trail":0}},
    {"f":10,"ease":"linear","pose":{"wX":0.351,"wZ":-0.296,"oX":-0.897,"oZ":0.336,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.2,"bodyY":-0.079,"bodyZ":0,"lift":0,"legLx":-0.942,"legRx":0.942,"legLz":0,"legRz":0,"headX":-0.16,"headY":0,"headZ":-0.088,"trail":0}},
    {"f":11,"ease":"linear","pose":{"wX":0.288,"wZ":-0.297,"oX":-0.738,"oZ":0.337,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.2,"bodyY":-0.065,"bodyZ":0,"lift":0,"legLx":-0.775,"legRx":0.775,"legLz":0,"legRz":0,"headX":-0.16,"headY":0,"headZ":-0.08,"trail":0}},
    {"f":12,"ease":"linear","pose":{"wX":0.16,"wZ":-0.298,"oX":-0.411,"oZ":0.338,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.2,"bodyY":-0.036,"bodyZ":0,"lift":0,"legLx":-0.431,"legRx":0.431,"legLz":0,"legRz":0,"headX":-0.16,"headY":0,"headZ":-0.062,"trail":0}},
    {"f":13,"ease":"linear","pose":{"wX":0.008,"wZ":-0.288,"oX":-0.006,"oZ":0.328,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.2,"bodyY":0.001,"bodyZ":0,"lift":0,"legLx":0.011,"legRx":-0.011,"legLz":0,"legRz":0,"headX":-0.16,"headY":0,"headZ":-0.035,"trail":0}},
   ],
   events:[]
  },
  "air":{fps:30,frames:21,loop:false,role:"air",dir:0,groups:{"arms":true,"weapon":true,"body":true,"legs":true,"head":true},
   keys:[
    {"f":0,"ease":"linear","pose":{"wX":-0.837,"wZ":-0.511,"oX":-0.824,"oZ":0.53,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":-0.114,"bodyY":0,"bodyZ":0,"lift":0,"legLx":-0.597,"legRx":-0.338,"legLz":0,"legRz":0,"headX":0,"headY":-0.141,"headZ":-0.031,"trail":0}},
    {"f":1,"ease":"linear","pose":{"wX":-1.245,"wZ":-0.635,"oX":-1.239,"oZ":0.644,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":-0.152,"bodyY":0,"bodyZ":0,"lift":0,"legLx":-0.885,"legRx":-0.5,"legLz":0,"legRz":0,"headX":0,"headY":-0.143,"headZ":-0.031,"trail":0}},
    {"f":2,"ease":"linear","pose":{"wX":-1.451,"wZ":-0.695,"oX":-1.449,"oZ":0.699,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":-0.155,"bodyY":0,"bodyZ":0,"lift":0,"legLx":-1.002,"legRx":-0.559,"legLz":0,"legRz":0,"headX":0,"headY":-0.145,"headZ":-0.03,"trail":0}},
    {"f":3,"ease":"linear","pose":{"wX":-1.559,"wZ":-0.723,"oX":-1.558,"oZ":0.725,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":-0.144,"bodyY":0,"bodyZ":0,"lift":0,"legLx":-1.007,"legRx":-0.542,"legLz":0,"legRz":0,"headX":0,"headY":-0.147,"headZ":-0.029,"trail":0}},
    {"f":5,"ease":"linear","pose":{"wX":-1.656,"wZ":-0.744,"oX":-1.656,"oZ":0.744,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":-0.106,"bodyY":0,"bodyZ":0,"lift":0,"legLx":-0.845,"legRx":-0.381,"legLz":0,"legRz":0,"headX":0,"headY":-0.151,"headZ":-0.028,"trail":0}},
    {"f":10,"ease":"linear","pose":{"wX":-1.753,"wZ":-0.75,"oX":-1.753,"oZ":0.75,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.006,"bodyY":0,"bodyZ":0,"lift":0,"legLx":-0.249,"legRx":0.161,"legLz":0,"legRz":0,"headX":0,"headY":-0.16,"headZ":-0.024,"trail":0}},
    {"f":12,"ease":"linear","pose":{"wX":-1.784,"wZ":-0.75,"oX":-1.784,"oZ":0.75,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.051,"bodyY":0,"bodyZ":0,"lift":0,"legLx":-0.151,"legRx":0.249,"legLz":0,"legRz":0,"headX":0,"headY":-0.163,"headZ":-0.022,"trail":0}},
    {"f":20,"ease":"linear","pose":{"wX":-1.908,"wZ":-0.75,"oX":-1.908,"oZ":0.75,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.231,"bodyY":0,"bodyZ":0,"lift":0,"legLx":-0.15,"legRx":0.25,"legLz":0,"legRz":0,"headX":0,"headY":-0.173,"headZ":-0.014,"trail":0}},
   ],
   events:[]
  },
  "dash":{fps:30,frames:11,loop:false,role:"dash",dir:0,groups:{"arms":true,"weapon":true,"body":true,"legs":true,"head":true},
   keys:[
    {"f":0,"ease":"linear","pose":{"wX":0.722,"wZ":-0.248,"oX":0.72,"oZ":0.253,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.89,"bodyY":0,"bodyZ":0,"lift":0,"legLx":0.756,"legRx":0.534,"legLz":0,"legRz":0,"headX":0,"headY":-0.169,"headZ":0.018,"trail":0}},
    {"f":1,"ease":"linear","pose":{"wX":0.81,"wZ":-0.25,"oX":0.81,"oZ":0.25,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":1,"bodyY":0,"bodyZ":0,"lift":0,"legLx":0.85,"legRx":0.6,"legLz":0,"legRz":0,"headX":0,"headY":-0.168,"headZ":0.019,"trail":0}},
    {"f":5,"ease":"linear","pose":{"wX":0.81,"wZ":-0.25,"oX":0.81,"oZ":0.25,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":1,"bodyY":0,"bodyZ":0,"lift":0,"legLx":0.85,"legRx":0.6,"legLz":0,"legRz":0,"headX":0,"headY":-0.162,"headZ":0.022,"trail":0}},
    {"f":6,"ease":"linear","pose":{"wX":0.72,"wZ":-0.249,"oX":0.721,"oZ":0.254,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.89,"bodyY":0,"bodyZ":0,"lift":0,"legLx":0.756,"legRx":0.534,"legLz":0,"legRz":0,"headX":0,"headY":-0.161,"headZ":0.023,"trail":0}},
    {"f":7,"ease":"linear","pose":{"wX":0.279,"wZ":-0.246,"oX":0.284,"oZ":0.272,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.347,"bodyY":0,"bodyZ":0,"lift":0,"legLx":0.295,"legRx":0.208,"legLz":0,"legRz":0,"headX":0,"headY":-0.159,"headZ":0.024,"trail":0}},
    {"f":8,"ease":"linear","pose":{"wX":-0.004,"wZ":-0.244,"oX":0.006,"oZ":0.284,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0,"bodyY":0,"bodyZ":0,"lift":0,"legLx":0,"legRx":0,"legLz":0,"legRz":0,"headX":0,"headY":-0.157,"headZ":0.025,"trail":0}},
    {"f":10,"ease":"linear","pose":{"wX":-0.006,"wZ":-0.246,"oX":0.008,"oZ":0.286,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0,"bodyY":0,"bodyZ":0,"lift":0,"legLx":0,"legRx":0,"legLz":0,"legRz":0,"headX":0,"headY":-0.154,"headZ":0.027,"trail":0}},
   ],
   events:[]
  },
 }},
 "axe":{chain:["sweep","smash","spin"],state:{"idle":"idle","run":"run","air":"air","dash":"dash"},anims:{
  "sweep":{fps:30,frames:36,loop:false,role:"attack",dir:1,groups:{"arms":true,"weapon":true,"body":true,"legs":true,"head":true},
   keys:[
    {"f":0,"ease":"smooth","pose":{"wX":0,"wZ":-0.24,"oX":0,"oZ":0.28,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0,"bodyY":0,"bodyZ":0,"lift":0,"legLx":0,"legRx":0,"legLz":0,"legRz":0,"headX":0,"headY":0,"headZ":0,"trail":0}},
    {"f":4,"ease":"smooth","pose":{"wX":-0.2816,"wZ":-0.5075,"oX":0,"oZ":0.28,"wrist":-0.6268,"wrist2":-0.85,"roll":-0.2816,"grip":0,"bodyX":-0.09,"bodyY":-0.1584,"bodyZ":0.0704,"lift":0,"legLx":0,"legRx":0,"legLz":0,"legRz":0,"headX":-0.2,"headY":-0.47,"headZ":0,"trail":0}},
    {"f":10,"ease":"smooth","pose":{"wX":-0.8,"wZ":-1.07,"oX":-1.67,"oZ":0.34,"wrist":-0.44,"wrist2":-2.02,"roll":-1.95,"grip":0,"bodyX":-0.1,"bodyY":-0.45,"bodyZ":0.2,"lift":0,"legLx":0.36,"legRx":-0.83,"legLz":0,"legRz":0,"headX":0,"headY":0,"headZ":0,"trail":0}},
    {"f":18,"ease":"smooth","pose":{"wX":-1.5,"wZ":-1.91,"oX":0.32,"oZ":1.47,"wrist":-0.15,"wrist2":-0.85,"roll":-1.57,"grip":0,"bodyX":-0.2,"bodyY":-0.9,"bodyZ":0.4,"lift":0,"legLx":0.03,"legRx":0.18,"legLz":-0.73,"legRz":0.58,"headX":0,"headY":0,"headZ":0,"trail":1}},
    {"f":22,"ease":"smooth","pose":{"wX":-1.23,"wZ":0.45,"oX":1.61,"oZ":0.84,"wrist":0.15,"wrist2":-0.2,"roll":-1.61,"grip":0,"bodyX":0.45,"bodyY":1,"bodyZ":-0.54,"lift":0,"legLx":-1.26,"legRx":-0.66,"legLz":0.03,"legRz":0.2,"headX":0.4,"headY":0.77,"headZ":0,"trail":1}},
    {"f":24,"ease":"smooth","pose":{"wX":-1.5,"wZ":1.47,"oX":0.76,"oZ":-0.21,"wrist":-0.15,"wrist2":-0.85,"roll":-1.57,"grip":0,"bodyX":0.4,"bodyY":1,"bodyZ":-0.55,"lift":0,"legLx":0.18,"legRx":-0.83,"legLz":-0.8,"legRz":0.26,"headX":0.38,"headY":0.91,"headZ":0,"trail":1}},
    {"f":27,"ease":"smooth","pose":{"wX":-1.5,"wZ":1.35,"oX":0,"oZ":0.28,"wrist":-0.15,"wrist2":-0.85,"roll":-1.57,"grip":0,"bodyX":0.4,"bodyY":1,"bodyZ":-0.55,"lift":0,"legLx":0.53,"legRx":-0.91,"legLz":-0.66,"legRz":0,"headX":0.46,"headY":1.12,"headZ":0,"trail":0}},
    {"f":35,"ease":"smooth","pose":{"wX":-2.31,"wZ":-1.16,"oX":0.12,"oZ":0.95,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0,"bodyY":0,"bodyZ":0,"lift":0,"legLx":-0.04,"legRx":0,"legLz":0,"legRz":0,"headX":0,"headY":0,"headZ":0,"trail":0}},
   ],
   events:[{"f":17,"name":"swing","sfx":"assets/sfx/slash.wav"},{"f":20,"name":"hit"},{"f":21,"name":"step"}]
  },
  "smash":{fps:30,frames:36,loop:false,role:"attack",dir:0,groups:{"arms":true,"weapon":true,"body":true,"legs":true,"head":true},
   keys:[
    {"f":0,"ease":"smooth","pose":{"wX":0,"wZ":-0.24,"oX":0,"oZ":0.28,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0,"bodyY":0,"bodyZ":0,"lift":0,"legLx":0,"legRx":0,"legLz":0,"legRz":0,"headX":0,"headY":0,"headZ":0,"trail":0}},
    {"f":10,"ease":"smooth","pose":{"wX":-1.4,"wZ":-0.02,"oX":-0.82,"oZ":1,"wrist":-0.8,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":-0.3,"bodyY":-0.28,"bodyZ":0.15,"lift":-0.05,"legLx":0.56,"legRx":-0.79,"legLz":-0.33,"legRz":0.27,"headX":-0.29,"headY":0,"headZ":0,"trail":0}},
    {"f":18,"ease":"smooth","pose":{"wX":-2.99,"wZ":-0.97,"oX":-0.23,"oZ":1.11,"wrist":-1.43,"wrist2":-1.2,"roll":-0.86,"grip":0.09,"bodyX":-0.34,"bodyY":0,"bodyZ":0.1,"lift":-0.07,"legLx":0.88,"legRx":-1.05,"legLz":-0.19,"legRz":-0.21,"headX":-0.41,"headY":0,"headZ":0,"trail":1}},
    {"f":22,"ease":"smooth","pose":{"wX":-1,"wZ":-0.2,"oX":1.61,"oZ":1.4,"wrist":-0.3,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.38,"bodyY":0,"bodyZ":-0.12,"lift":-0.04,"legLx":1,"legRx":-0.72,"legLz":0.08,"legRz":0,"headX":0.42,"headY":0,"headZ":0,"trail":1}},
    {"f":24,"ease":"smooth","pose":{"wX":-0.85,"wZ":-0.2,"oX":0,"oZ":0.28,"wrist":-0.3,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.49,"bodyY":0,"bodyZ":-0.12,"lift":-0.12,"legLx":-0.81,"legRx":-0.85,"legLz":0,"legRz":0,"headX":0,"headY":0,"headZ":0,"trail":0}},
    {"f":27,"ease":"smooth","pose":{"wX":-1.2,"wZ":-0.7,"oX":0,"oZ":0.28,"wrist":-0.12,"wrist2":-0.85,"roll":-1.22,"grip":0,"bodyX":0.16,"bodyY":0,"bodyZ":-0.12,"lift":-0.12,"legLx":-0.81,"legRx":-0.85,"legLz":0,"legRz":0,"headX":0,"headY":0,"headZ":0,"trail":0}},
    {"f":35,"ease":"smooth","pose":{"wX":0,"wZ":-0.24,"oX":0,"oZ":0.28,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0,"bodyY":0,"bodyZ":0,"lift":0,"legLx":0,"legRx":0,"legLz":0,"legRz":0,"headX":0,"headY":0,"headZ":0,"trail":0}},
   ],
   events:[{"f":18,"name":"swing","sfx":"assets/sfx/slash.wav","pitch":0.23},{"f":22,"name":"hit"}]
  },
  "spin":{fps:30,frames:39,loop:false,role:"attack",dir:-1,groups:{"arms":true,"weapon":true,"body":true,"legs":true,"head":true},
   keys:[
    {"f":0,"ease":"smooth","pose":{"wX":0,"wZ":-0.24,"oX":0,"oZ":0.28,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0,"bodyY":0,"bodyZ":0,"lift":0,"legLx":0,"legRx":0,"legLz":0,"legRz":0,"headX":0,"headY":0,"headZ":0,"trail":0}},
    {"f":12,"ease":"smooth","pose":{"wX":-0.9,"wZ":-0.8,"oX":0.67,"oZ":0.91,"wrist":-0.4,"wrist2":-0.85,"roll":-0.8,"grip":0,"bodyX":0,"bodyY":-0.45,"bodyZ":0.12,"lift":-0.05,"legLx":0.52,"legRx":-0.96,"legLz":0,"legRz":0.46,"headX":0,"headY":0,"headZ":0,"trail":0}},
    {"f":20,"ease":"smooth","pose":{"wX":-1.45,"wZ":-1.3,"oX":-1.9,"oZ":1.25,"wrist":-0.15,"wrist2":-0.85,"roll":-1.57,"grip":0,"bodyX":0,"bodyY":-0.9,"bodyZ":0.25,"lift":-0.03,"legLx":-0.64,"legRx":0,"legLz":0,"legRz":0.52,"headX":0,"headY":-0.29,"headZ":0,"trail":1}},
    {"f":24,"ease":"smooth","pose":{"wX":-1.45,"wZ":-0.45,"oX":-1.35,"oZ":0.7,"wrist":-0.15,"wrist2":-0.85,"roll":-1.57,"grip":0,"bodyX":0,"bodyY":2.6,"bodyZ":0.1,"lift":0.12,"legLx":0,"legRx":0,"legLz":0,"legRz":0,"headX":0,"headY":0,"headZ":0,"trail":1}},
    {"f":28,"ease":"smooth","pose":{"wX":-1.45,"wZ":0.4,"oX":-1.23,"oZ":1.63,"wrist":-0.15,"wrist2":-0.85,"roll":-1.57,"grip":0,"bodyX":0,"bodyY":6.08,"bodyZ":0,"lift":0,"legLx":0,"legRx":0,"legLz":0,"legRz":0,"headX":0,"headY":0,"headZ":0,"trail":1}},
    {"f":31,"ease":"smooth","pose":{"wX":-1.45,"wZ":0.4,"oX":0,"oZ":0.28,"wrist":-0.15,"wrist2":-0.85,"roll":-1.57,"grip":0,"bodyX":0,"bodyY":6.283,"bodyZ":0,"lift":0,"legLx":0,"legRx":0,"legLz":0,"legRz":0,"headX":0,"headY":0,"headZ":0,"trail":0}},
    {"f":37,"ease":"hold","pose":{"wX":0,"wZ":-0.24,"oX":0,"oZ":0.28,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0,"bodyY":6.283,"bodyZ":0,"lift":0,"legLx":0,"legRx":0,"legLz":0,"legRz":0,"headX":0,"headY":0,"headZ":0,"trail":0}},
    {"f":38,"ease":"smooth","pose":{"wX":0,"wZ":-0.24,"oX":0,"oZ":0.28,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0,"bodyY":0,"bodyZ":0,"lift":0,"legLx":0,"legRx":0,"legLz":0,"legRz":0,"headX":0,"headY":0,"headZ":0,"trail":0}},
   ],
   events:[{"f":19,"name":"swing","sfx":"assets/sfx/slash.wav"},{"f":26,"name":"hit"},{"f":21,"name":"custom","sfx":"assets/sfx/slash.wav","pitch":0.25}]
  },
  "idle":{fps:30,frames:85,loop:true,role:"idle",dir:0,groups:{"arms":true,"weapon":true,"body":true,"legs":true,"head":true},
   keys:[
    {"f":0,"ease":"linear","pose":{"wX":-0.23,"wZ":-0.9,"oX":-0.011,"oZ":0.271,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0,"bodyY":0,"bodyZ":-0.05,"lift":0,"legLx":0,"legRx":0,"legLz":0,"legRz":0,"headX":0,"headY":-0.115,"headZ":0.032,"trail":0}},
    {"f":36,"ease":"smooth","pose":{"wX":-0.33,"wZ":-1.06,"oX":-0.011,"oZ":0.271,"wrist":1.1,"wrist2":-0.85,"roll":0.45,"grip":0,"bodyX":0,"bodyY":0,"bodyZ":-0.05,"lift":0,"legLx":0,"legRx":0,"legLz":0,"legRz":0,"headX":0,"headY":-0.115,"headZ":0.032,"trail":0}},
    {"f":84,"ease":"smooth","pose":{"wX":-0.23,"wZ":-0.9,"oX":-0.011,"oZ":0.271,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0,"bodyY":0,"bodyZ":-0.05,"lift":0,"legLx":0,"legRx":0,"legLz":0,"legRz":0,"headX":0,"headY":-0.115,"headZ":0.032,"trail":0}},
   ],
   events:[]
  },
  "run":{fps:30,frames:14,loop:true,role:"run",dir:0,groups:{"arms":true,"weapon":true,"body":true,"legs":true,"head":true},
   keys:[
    {"f":0,"ease":"smooth","pose":{"wX":0.23,"wZ":-1.17,"oX":0.031,"oZ":0.352,"wrist":0.1,"wrist2":0,"roll":-0.7,"grip":0,"bodyX":0.2,"bodyY":0.001,"bodyZ":0,"lift":0,"legLx":0.015,"legRx":-0.015,"legLz":0,"legRz":0,"headX":-0.16,"headY":0,"headZ":-0.035,"trail":0}},
    {"f":3,"ease":"smooth","pose":{"wX":0.46,"wZ":-1.28,"oX":0.031,"oZ":0.352,"wrist":-0.1,"wrist2":0,"roll":-0.7,"grip":0,"bodyX":0.34,"bodyY":0.001,"bodyZ":0,"lift":-0.07,"legLx":-1.15,"legRx":0.53,"legLz":0,"legRz":0,"headX":-0.16,"headY":0,"headZ":-0.035,"trail":0}},
    {"f":4,"ease":"smooth","pose":{"wX":0.46,"wZ":-1.28,"oX":0.031,"oZ":0.352,"wrist":-0.1,"wrist2":0,"roll":-0.7,"grip":0,"bodyX":0.34,"bodyY":0.001,"bodyZ":0,"lift":-0.07,"legLx":-1.15,"legRx":0.53,"legLz":0,"legRz":0,"headX":-0.16,"headY":0,"headZ":-0.035,"trail":0}},
    {"f":6,"ease":"linear","pose":{"wX":0.49,"wZ":-1.44,"oX":0.031,"oZ":0.352,"wrist":-0.54,"wrist2":0,"roll":-0.7,"grip":0,"bodyX":0.17,"bodyY":0.001,"bodyZ":0,"lift":-0.14,"legLx":-0.25,"legRx":-0.81,"legLz":0,"legRz":0,"headX":-0.16,"headY":0,"headZ":-0.035,"trail":0}},
    {"f":9,"ease":"smooth","pose":{"wX":0.49,"wZ":-1.44,"oX":0.031,"oZ":0.352,"wrist":-0.54,"wrist2":0,"roll":-0.7,"grip":0,"bodyX":0.4,"bodyY":0.001,"bodyZ":0,"lift":-0.04,"legLx":1,"legRx":-1.48,"legLz":0,"legRz":0,"headX":-0.16,"headY":0,"headZ":-0.035,"trail":0}},
    {"f":11,"ease":"smooth","pose":{"wX":0.49,"wZ":-1.44,"oX":0.031,"oZ":0.352,"wrist":-0.54,"wrist2":0,"roll":-0.7,"grip":0,"bodyX":0.17,"bodyY":0.001,"bodyZ":0,"lift":-0.14,"legLx":-0.25,"legRx":-0.81,"legLz":0,"legRz":0,"headX":-0.16,"headY":0,"headZ":-0.035,"trail":0}},
    {"f":13,"ease":"smooth","pose":{"wX":0.23,"wZ":-1.17,"oX":0.031,"oZ":0.352,"wrist":0.1,"wrist2":0,"roll":-0.7,"grip":0,"bodyX":0.2,"bodyY":0.001,"bodyZ":0,"lift":0,"legLx":0.015,"legRx":-0.015,"legLz":0,"legRz":0,"headX":-0.16,"headY":0,"headZ":-0.035,"trail":0}},
   ],
   events:[]
  },
  "air":{fps:30,frames:21,loop:false,role:"air",dir:0,groups:{"arms":true,"weapon":true,"body":true,"legs":true,"head":true},
   keys:[
    {"f":0,"ease":"linear","pose":{"wX":0.004,"wZ":-0.75,"oX":-0.303,"oZ":0.356,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":-0.114,"bodyY":0,"bodyZ":-0.05,"lift":0,"legLx":-0.597,"legRx":-0.338,"legLz":0,"legRz":0,"headX":0,"headY":0.142,"headZ":-0.031,"trail":0}},
    {"f":1,"ease":"linear","pose":{"wX":-0.172,"wZ":-0.75,"oX":-0.445,"oZ":0.399,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":-0.152,"bodyY":0,"bodyZ":-0.05,"lift":0,"legLx":-0.885,"legRx":-0.5,"legLz":0,"legRz":0,"headX":0,"headY":0.144,"headZ":-0.03,"trail":0}},
    {"f":2,"ease":"linear","pose":{"wX":-0.26,"wZ":-0.75,"oX":-0.516,"oZ":0.42,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":-0.155,"bodyY":0,"bodyZ":-0.05,"lift":0,"legLx":-1.002,"legRx":-0.559,"legLz":0,"legRz":0,"headX":0,"headY":0.147,"headZ":-0.029,"trail":0}},
    {"f":3,"ease":"linear","pose":{"wX":-0.306,"wZ":-0.75,"oX":-0.553,"oZ":0.43,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":-0.144,"bodyY":0,"bodyZ":-0.05,"lift":0,"legLx":-1.007,"legRx":-0.542,"legLz":0,"legRz":0,"headX":0,"headY":0.149,"headZ":-0.029,"trail":0}},
    {"f":5,"ease":"linear","pose":{"wX":-0.346,"wZ":-0.75,"oX":-0.586,"oZ":0.438,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":-0.106,"bodyY":0,"bodyZ":-0.05,"lift":0,"legLx":-0.845,"legRx":-0.381,"legLz":0,"legRz":0,"headX":0,"headY":0.153,"headZ":-0.027,"trail":0}},
    {"f":10,"ease":"linear","pose":{"wX":-0.385,"wZ":-0.75,"oX":-0.615,"oZ":0.443,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.006,"bodyY":0,"bodyZ":-0.05,"lift":0,"legLx":-0.249,"legRx":0.161,"legLz":0,"legRz":0,"headX":0,"headY":0.161,"headZ":-0.023,"trail":0}},
    {"f":12,"ease":"linear","pose":{"wX":-0.397,"wZ":-0.75,"oX":-0.624,"oZ":0.445,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.051,"bodyY":0,"bodyZ":-0.05,"lift":0,"legLx":-0.151,"legRx":0.249,"legLz":0,"legRz":0,"headX":0,"headY":0.164,"headZ":-0.021,"trail":0}},
    {"f":20,"ease":"linear","pose":{"wX":-0.446,"wZ":-0.75,"oX":-0.66,"oZ":0.45,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.231,"bodyY":0,"bodyZ":-0.05,"lift":0,"legLx":-0.15,"legRx":0.25,"legLz":0,"legRz":0,"headX":0,"headY":0.174,"headZ":-0.014,"trail":0}},
   ],
   events:[]
  },
  "dash":{fps:30,frames:11,loop:false,role:"dash",dir:0,groups:{"arms":true,"weapon":true,"body":true,"legs":true,"head":true},
   keys:[
    {"f":0,"ease":"linear","pose":{"wX":0.79,"wZ":-0.305,"oX":0.722,"oZ":0.254,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.89,"bodyY":0,"bodyZ":-0.05,"lift":0,"legLx":0.756,"legRx":0.534,"legLz":0,"legRz":0,"headX":0,"headY":0.168,"headZ":0.019,"trail":0}},
    {"f":1,"ease":"linear","pose":{"wX":0.845,"wZ":-0.25,"oX":0.81,"oZ":0.25,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":1,"bodyY":0,"bodyZ":-0.05,"lift":0,"legLx":0.85,"legRx":0.6,"legLz":0,"legRz":0,"headX":0,"headY":0.167,"headZ":0.019,"trail":0}},
    {"f":5,"ease":"linear","pose":{"wX":0.845,"wZ":-0.25,"oX":0.81,"oZ":0.25,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":1,"bodyY":0,"bodyZ":-0.05,"lift":0,"legLx":0.85,"legRx":0.6,"legLz":0,"legRz":0,"headX":0,"headY":0.161,"headZ":0.023,"trail":0}},
    {"f":6,"ease":"linear","pose":{"wX":0.791,"wZ":-0.305,"oX":0.72,"oZ":0.253,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.89,"bodyY":0,"bodyZ":-0.05,"lift":0,"legLx":0.756,"legRx":0.534,"legLz":0,"legRz":0,"headX":0,"headY":0.16,"headZ":0.024,"trail":0}},
    {"f":7,"ease":"linear","pose":{"wX":0.525,"wZ":-0.576,"oX":0.278,"oZ":0.267,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.347,"bodyY":0,"bodyZ":-0.05,"lift":0,"legLx":0.295,"legRx":0.208,"legLz":0,"legRz":0,"headX":0,"headY":0.158,"headZ":0.025,"trail":0}},
    {"f":8,"ease":"linear","pose":{"wX":0.355,"wZ":-0.75,"oX":-0.007,"oZ":0.275,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0,"bodyY":0,"bodyZ":-0.05,"lift":0,"legLx":0,"legRx":0,"legLz":0,"legRz":0,"headX":0,"headY":0.156,"headZ":0.026,"trail":0}},
    {"f":10,"ease":"linear","pose":{"wX":0.357,"wZ":-0.75,"oX":-0.009,"oZ":0.273,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0,"bodyY":0,"bodyZ":-0.05,"lift":0,"legLx":0,"legRx":0,"legLz":0,"legRz":0,"headX":0,"headY":0.152,"headZ":0.027,"trail":0}},
   ],
   events:[]
  },
 }},
 "scythe":{chain:["sweep","spin","smash"],state:{"idle":"idle","run":"run","air":"air","dash":"dash"},anims:{
  "sweep":{fps:30,frames:24,loop:false,role:"attack",dir:1,groups:{"arms":true,"weapon":true,"body":true,"legs":true,"head":true},
   keys:[
    {"f":0,"ease":"smooth","pose":{"wX":0,"wZ":-0.24,"oX":0,"oZ":0.28,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0,"bodyY":0,"bodyZ":0,"lift":0,"legLx":0,"legRx":0,"legLz":0,"legRz":0,"headX":0,"headY":0,"headZ":0,"trail":0}},
    {"f":2,"ease":"smooth","pose":{"wX":-0.2816,"wZ":-0.5075,"oX":0,"oZ":0.28,"wrist":-0.6268,"wrist2":-0.85,"roll":-0.2816,"grip":0,"bodyX":-0.09,"bodyY":-0.1584,"bodyZ":0.0704,"lift":0,"legLx":0,"legRx":0,"legLz":0,"legRz":0,"headX":-0.2,"headY":-0.47,"headZ":0,"trail":0}},
    {"f":5,"ease":"smooth","pose":{"wX":-0.8,"wZ":-1.07,"oX":-1.67,"oZ":0.34,"wrist":-0.44,"wrist2":-2.02,"roll":-1.95,"grip":0,"bodyX":-0.1,"bodyY":-0.45,"bodyZ":0.2,"lift":0,"legLx":0.36,"legRx":-0.83,"legLz":0,"legRz":0,"headX":0,"headY":0,"headZ":0,"trail":0}},
    {"f":7,"ease":"smooth","pose":{"wX":-1.5,"wZ":-1.91,"oX":0.32,"oZ":1.47,"wrist":-0.15,"wrist2":-0.85,"roll":-1.57,"grip":0,"bodyX":-0.2,"bodyY":-0.9,"bodyZ":0.4,"lift":0,"legLx":0.03,"legRx":0.18,"legLz":-0.73,"legRz":0.58,"headX":0,"headY":0,"headZ":0,"trail":1}},
    {"f":10,"ease":"smooth","pose":{"wX":-1.23,"wZ":0.45,"oX":1.61,"oZ":0.84,"wrist":0.15,"wrist2":-0.2,"roll":-1.61,"grip":0,"bodyX":0.45,"bodyY":1,"bodyZ":-0.54,"lift":0,"legLx":-1.26,"legRx":-0.66,"legLz":0.03,"legRz":0.2,"headX":0.4,"headY":0.77,"headZ":0,"trail":1}},
    {"f":12,"ease":"smooth","pose":{"wX":-1.5,"wZ":1.47,"oX":0.76,"oZ":-0.21,"wrist":-0.15,"wrist2":-0.85,"roll":-1.57,"grip":0,"bodyX":0.4,"bodyY":1,"bodyZ":-0.55,"lift":0,"legLx":0.18,"legRx":-0.83,"legLz":-0.8,"legRz":0.26,"headX":0.38,"headY":0.91,"headZ":0,"trail":1}},
    {"f":16,"ease":"smooth","pose":{"wX":-1.5,"wZ":1.35,"oX":0,"oZ":0.28,"wrist":-0.15,"wrist2":-0.85,"roll":-1.57,"grip":0,"bodyX":0.4,"bodyY":1,"bodyZ":-0.55,"lift":0,"legLx":0.53,"legRx":-0.91,"legLz":-0.66,"legRz":0,"headX":0.46,"headY":1.12,"headZ":0,"trail":0}},
    {"f":23,"ease":"smooth","pose":{"wX":-2.31,"wZ":-1.16,"oX":0.12,"oZ":0.95,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0,"bodyY":0,"bodyZ":0,"lift":0,"legLx":-0.04,"legRx":0,"legLz":0,"legRz":0,"headX":0,"headY":0,"headZ":0,"trail":0}},
   ],
   events:[{"f":10,"name":"swing","sfx":"assets/sfx/slash.wav"},{"f":12,"name":"hit"},{"f":13,"name":"step"}]
  },
  "spin":{fps:30,frames:25,loop:false,role:"attack",dir:-1,groups:{"arms":true,"weapon":true,"body":true,"legs":true,"head":true},
   keys:[
    {"f":0,"ease":"smooth","pose":{"wX":-2.31,"wZ":-1.16,"oX":0.12,"oZ":0.95,"wrist":-0.75,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0,"bodyY":0,"bodyZ":0,"lift":0,"legLx":-0.04,"legRx":0,"legLz":0,"legRz":0,"headX":0,"headY":0,"headZ":0,"trail":0}},
    {"f":3,"ease":"smooth","pose":{"wX":-0.9,"wZ":-0.8,"oX":0.67,"oZ":0.91,"wrist":-0.4,"wrist2":-0.85,"roll":-0.8,"grip":0,"bodyX":0,"bodyY":-0.45,"bodyZ":0.12,"lift":-0.05,"legLx":0.52,"legRx":-0.96,"legLz":0,"legRz":0.46,"headX":0,"headY":0,"headZ":0,"trail":0}},
    {"f":5,"ease":"smooth","pose":{"wX":-1.45,"wZ":-1.3,"oX":-1.9,"oZ":1.25,"wrist":-0.15,"wrist2":-0.85,"roll":-1.57,"grip":0,"bodyX":0,"bodyY":-0.9,"bodyZ":0.25,"lift":-0.03,"legLx":-0.64,"legRx":0,"legLz":0,"legRz":0.52,"headX":0,"headY":-0.29,"headZ":0,"trail":1}},
    {"f":10,"ease":"smooth","pose":{"wX":-1.45,"wZ":0.4,"oX":-1.23,"oZ":1.63,"wrist":-0.15,"wrist2":-0.85,"roll":-1.57,"grip":0,"bodyX":0,"bodyY":6.08,"bodyZ":0,"lift":0,"legLx":0,"legRx":0,"legLz":0,"legRz":0,"headX":0,"headY":0,"headZ":0,"trail":1}},
    {"f":14,"ease":"smooth","pose":{"wX":-1.45,"wZ":0.4,"oX":0,"oZ":0.28,"wrist":-0.15,"wrist2":-0.85,"roll":-1.57,"grip":0,"bodyX":0.28,"bodyY":6.8,"bodyZ":0,"lift":0,"legLx":-0.64,"legRx":0,"legLz":0,"legRz":0.27,"headX":0.16,"headY":0.35,"headZ":0,"trail":0}},
    {"f":24,"ease":"smooth","pose":{"wX":-1.71,"wZ":-1.33,"oX":0,"oZ":0.28,"wrist":0.26,"wrist2":-0.85,"roll":1.43,"grip":0,"bodyX":0.06,"bodyY":6.5,"bodyZ":0,"lift":-0.09,"legLx":-0.64,"legRx":0,"legLz":0,"legRz":0.27,"headX":-0.24,"headY":-0.24,"headZ":0,"trail":0}},
   ],
   events:[{"f":4,"name":"swing","sfx":"assets/sfx/slash.wav"},{"f":7,"name":"hit"}]
  },
  "smash":{fps:30,frames:25,loop:false,role:"attack",dir:0,groups:{"arms":true,"weapon":true,"body":true,"legs":true,"head":true},
   keys:[
    {"f":0,"ease":"smooth","pose":{"wX":-1.12,"wZ":0.62,"oX":-0.28,"oZ":0.28,"wrist":-0.92,"wrist2":-0.85,"roll":1.32,"grip":0,"bodyX":-0.22,"bodyY":0.2,"bodyZ":0,"lift":-0.09,"legLx":0,"legRx":0,"legLz":0,"legRz":0,"headX":0.2,"headY":0.57,"headZ":-0.26,"trail":0}},
    {"f":2,"ease":"smooth","pose":{"wX":-1.25,"wZ":0.97,"oX":-1.79,"oZ":1.28,"wrist":-0.71,"wrist2":-0.49,"roll":1.41,"grip":0,"bodyX":-0.28,"bodyY":0.35,"bodyZ":0,"lift":-0.07,"legLx":0,"legRx":0,"legLz":0,"legRz":0,"headX":0.21,"headY":0.7,"headZ":-0.26,"trail":0}},
    {"f":4,"ease":"smooth","pose":{"wX":-1.3,"wZ":0.78,"oX":-1.79,"oZ":1.28,"wrist":-0.51,"wrist2":-0.49,"roll":1.41,"grip":0,"bodyX":-0.37,"bodyY":0.35,"bodyZ":0,"lift":-0.07,"legLx":0.56,"legRx":0.42,"legLz":0,"legRz":0,"headX":0.21,"headY":0.7,"headZ":-0.26,"trail":0}},
    {"f":5,"ease":"smooth","pose":{"wX":-1.3,"wZ":0.78,"oX":-1.79,"oZ":1.28,"wrist":-0.51,"wrist2":-0.49,"roll":1.41,"grip":0,"bodyX":-0.4,"bodyY":0.6,"bodyZ":0,"lift":-0.07,"legLx":0.92,"legRx":0.42,"legLz":0,"legRz":0.3,"headX":0.21,"headY":0.7,"headZ":-0.26,"trail":1}},
    {"f":7,"ease":"smooth","pose":{"wX":-2.71,"wZ":-1.65,"oX":0,"oZ":0.28,"wrist":-0.23,"wrist2":-0.97,"roll":2.5,"grip":0,"bodyX":0.45,"bodyY":0,"bodyZ":0,"lift":-0.1,"legLx":-1.08,"legRx":-0.03,"legLz":0,"legRz":0,"headX":-0.26,"headY":0,"headZ":0,"trail":1}},
    {"f":10,"ease":"smooth","pose":{"wX":-2.6,"wZ":-1.84,"oX":0,"oZ":0.28,"wrist":-0.23,"wrist2":-0.97,"roll":2.5,"grip":0,"bodyX":0.45,"bodyY":-0.55,"bodyZ":0,"lift":-0.1,"legLx":-1.08,"legRx":-0.03,"legLz":0,"legRz":0,"headX":-0.26,"headY":0,"headZ":0,"trail":0}},
    {"f":24,"ease":"smooth","pose":{"wX":-0.94,"wZ":-1.4,"oX":-0.28,"oZ":0.28,"wrist":0.15,"wrist2":-0.85,"roll":1.36,"grip":0,"bodyX":-0.22,"bodyY":-0.55,"bodyZ":0,"lift":-0.09,"legLx":0,"legRx":0,"legLz":0,"legRz":0,"headX":0.51,"headY":0.14,"headZ":-0.26,"trail":0}},
   ],
   events:[{"f":7,"name":"swing","sfx":"assets/sfx/slash.wav","pitch":0.23},{"f":10,"name":"hit"}]
  },
  "idle":{fps:30,frames:85,loop:true,role:"idle",dir:0,groups:{"arms":true,"weapon":true,"body":true,"legs":true,"head":true},
   keys:[
    {"f":0,"ease":"linear","pose":{"wX":-0.23,"wZ":-0.9,"oX":-0.011,"oZ":0.271,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0,"bodyY":0,"bodyZ":-0.05,"lift":0,"legLx":0,"legRx":0,"legLz":0,"legRz":0,"headX":0,"headY":-0.115,"headZ":0.032,"trail":0}},
    {"f":36,"ease":"smooth","pose":{"wX":-0.33,"wZ":-1.06,"oX":-0.011,"oZ":0.271,"wrist":1.1,"wrist2":-0.85,"roll":0.45,"grip":0,"bodyX":0,"bodyY":0,"bodyZ":-0.05,"lift":0,"legLx":0,"legRx":0,"legLz":0,"legRz":0,"headX":0,"headY":-0.115,"headZ":0.032,"trail":0}},
    {"f":84,"ease":"smooth","pose":{"wX":-0.23,"wZ":-0.9,"oX":-0.011,"oZ":0.271,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0,"bodyY":0,"bodyZ":-0.05,"lift":0,"legLx":0,"legRx":0,"legLz":0,"legRz":0,"headX":0,"headY":-0.115,"headZ":0.032,"trail":0}},
   ],
   events:[]
  },
  "run":{fps:30,frames:14,loop:true,role:"run",dir:0,groups:{"arms":true,"weapon":true,"body":true,"legs":true,"head":true},
   keys:[
    {"f":0,"ease":"smooth","pose":{"wX":0.23,"wZ":-1.17,"oX":0.031,"oZ":0.352,"wrist":0.1,"wrist2":0,"roll":-0.7,"grip":0,"bodyX":0.2,"bodyY":0.001,"bodyZ":0,"lift":0,"legLx":0.015,"legRx":-0.015,"legLz":0,"legRz":0,"headX":-0.16,"headY":0,"headZ":-0.035,"trail":0}},
    {"f":3,"ease":"smooth","pose":{"wX":0.46,"wZ":-1.28,"oX":0.031,"oZ":0.352,"wrist":-0.1,"wrist2":0,"roll":-0.7,"grip":0,"bodyX":0.34,"bodyY":0.001,"bodyZ":0,"lift":-0.07,"legLx":-1.15,"legRx":0.53,"legLz":0,"legRz":0,"headX":-0.16,"headY":0,"headZ":-0.035,"trail":0}},
    {"f":4,"ease":"smooth","pose":{"wX":0.46,"wZ":-1.28,"oX":0.031,"oZ":0.352,"wrist":-0.1,"wrist2":0,"roll":-0.7,"grip":0,"bodyX":0.34,"bodyY":0.001,"bodyZ":0,"lift":-0.07,"legLx":-1.15,"legRx":0.53,"legLz":0,"legRz":0,"headX":-0.16,"headY":0,"headZ":-0.035,"trail":0}},
    {"f":6,"ease":"linear","pose":{"wX":0.49,"wZ":-1.44,"oX":0.031,"oZ":0.352,"wrist":-0.54,"wrist2":0,"roll":-0.7,"grip":0,"bodyX":0.17,"bodyY":0.001,"bodyZ":0,"lift":-0.14,"legLx":-0.25,"legRx":-0.81,"legLz":0,"legRz":0,"headX":-0.16,"headY":0,"headZ":-0.035,"trail":0}},
    {"f":9,"ease":"smooth","pose":{"wX":0.49,"wZ":-1.44,"oX":0.031,"oZ":0.352,"wrist":-0.54,"wrist2":0,"roll":-0.7,"grip":0,"bodyX":0.4,"bodyY":0.001,"bodyZ":0,"lift":-0.04,"legLx":1,"legRx":-1.48,"legLz":0,"legRz":0,"headX":-0.16,"headY":0,"headZ":-0.035,"trail":0}},
    {"f":11,"ease":"smooth","pose":{"wX":0.49,"wZ":-1.44,"oX":0.031,"oZ":0.352,"wrist":-0.54,"wrist2":0,"roll":-0.7,"grip":0,"bodyX":0.17,"bodyY":0.001,"bodyZ":0,"lift":-0.14,"legLx":-0.25,"legRx":-0.81,"legLz":0,"legRz":0,"headX":-0.16,"headY":0,"headZ":-0.035,"trail":0}},
    {"f":13,"ease":"smooth","pose":{"wX":0.23,"wZ":-1.17,"oX":0.031,"oZ":0.352,"wrist":0.1,"wrist2":0,"roll":-0.7,"grip":0,"bodyX":0.2,"bodyY":0.001,"bodyZ":0,"lift":0,"legLx":0.015,"legRx":-0.015,"legLz":0,"legRz":0,"headX":-0.16,"headY":0,"headZ":-0.035,"trail":0}},
   ],
   events:[]
  },
  "air":{fps:30,frames:21,loop:false,role:"air",dir:0,groups:{"arms":true,"weapon":true,"body":true,"legs":true,"head":true},
   keys:[
    {"f":0,"ease":"linear","pose":{"wX":0.004,"wZ":-0.75,"oX":-0.303,"oZ":0.356,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":-0.114,"bodyY":0,"bodyZ":-0.05,"lift":0,"legLx":-0.597,"legRx":-0.338,"legLz":0,"legRz":0,"headX":0,"headY":0.142,"headZ":-0.031,"trail":0}},
    {"f":1,"ease":"linear","pose":{"wX":-0.172,"wZ":-0.75,"oX":-0.445,"oZ":0.399,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":-0.152,"bodyY":0,"bodyZ":-0.05,"lift":0,"legLx":-0.885,"legRx":-0.5,"legLz":0,"legRz":0,"headX":0,"headY":0.144,"headZ":-0.03,"trail":0}},
    {"f":2,"ease":"linear","pose":{"wX":-0.26,"wZ":-0.75,"oX":-0.516,"oZ":0.42,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":-0.155,"bodyY":0,"bodyZ":-0.05,"lift":0,"legLx":-1.002,"legRx":-0.559,"legLz":0,"legRz":0,"headX":0,"headY":0.147,"headZ":-0.029,"trail":0}},
    {"f":3,"ease":"linear","pose":{"wX":-0.306,"wZ":-0.75,"oX":-0.553,"oZ":0.43,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":-0.144,"bodyY":0,"bodyZ":-0.05,"lift":0,"legLx":-1.007,"legRx":-0.542,"legLz":0,"legRz":0,"headX":0,"headY":0.149,"headZ":-0.029,"trail":0}},
    {"f":5,"ease":"linear","pose":{"wX":-0.346,"wZ":-0.75,"oX":-0.586,"oZ":0.438,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":-0.106,"bodyY":0,"bodyZ":-0.05,"lift":0,"legLx":-0.845,"legRx":-0.381,"legLz":0,"legRz":0,"headX":0,"headY":0.153,"headZ":-0.027,"trail":0}},
    {"f":10,"ease":"linear","pose":{"wX":-0.385,"wZ":-0.75,"oX":-0.615,"oZ":0.443,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.006,"bodyY":0,"bodyZ":-0.05,"lift":0,"legLx":-0.249,"legRx":0.161,"legLz":0,"legRz":0,"headX":0,"headY":0.161,"headZ":-0.023,"trail":0}},
    {"f":12,"ease":"linear","pose":{"wX":-0.397,"wZ":-0.75,"oX":-0.624,"oZ":0.445,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.051,"bodyY":0,"bodyZ":-0.05,"lift":0,"legLx":-0.151,"legRx":0.249,"legLz":0,"legRz":0,"headX":0,"headY":0.164,"headZ":-0.021,"trail":0}},
    {"f":20,"ease":"linear","pose":{"wX":-0.446,"wZ":-0.75,"oX":-0.66,"oZ":0.45,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.231,"bodyY":0,"bodyZ":-0.05,"lift":0,"legLx":-0.15,"legRx":0.25,"legLz":0,"legRz":0,"headX":0,"headY":0.174,"headZ":-0.014,"trail":0}},
   ],
   events:[]
  },
  "dash":{fps:30,frames:11,loop:false,role:"dash",dir:0,groups:{"arms":true,"weapon":true,"body":true,"legs":true,"head":true},
   keys:[
    {"f":0,"ease":"linear","pose":{"wX":0.79,"wZ":-0.305,"oX":0.722,"oZ":0.254,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.89,"bodyY":0,"bodyZ":-0.05,"lift":0,"legLx":0.756,"legRx":0.534,"legLz":0,"legRz":0,"headX":0,"headY":0.168,"headZ":0.019,"trail":0}},
    {"f":1,"ease":"linear","pose":{"wX":0.845,"wZ":-0.25,"oX":0.81,"oZ":0.25,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":1,"bodyY":0,"bodyZ":-0.05,"lift":0,"legLx":0.85,"legRx":0.6,"legLz":0,"legRz":0,"headX":0,"headY":0.167,"headZ":0.019,"trail":0}},
    {"f":5,"ease":"linear","pose":{"wX":0.845,"wZ":-0.25,"oX":0.81,"oZ":0.25,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":1,"bodyY":0,"bodyZ":-0.05,"lift":0,"legLx":0.85,"legRx":0.6,"legLz":0,"legRz":0,"headX":0,"headY":0.161,"headZ":0.023,"trail":0}},
    {"f":6,"ease":"linear","pose":{"wX":0.791,"wZ":-0.305,"oX":0.72,"oZ":0.253,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.89,"bodyY":0,"bodyZ":-0.05,"lift":0,"legLx":0.756,"legRx":0.534,"legLz":0,"legRz":0,"headX":0,"headY":0.16,"headZ":0.024,"trail":0}},
    {"f":7,"ease":"linear","pose":{"wX":0.525,"wZ":-0.576,"oX":0.278,"oZ":0.267,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.347,"bodyY":0,"bodyZ":-0.05,"lift":0,"legLx":0.295,"legRx":0.208,"legLz":0,"legRz":0,"headX":0,"headY":0.158,"headZ":0.025,"trail":0}},
    {"f":8,"ease":"linear","pose":{"wX":0.355,"wZ":-0.75,"oX":-0.007,"oZ":0.275,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0,"bodyY":0,"bodyZ":-0.05,"lift":0,"legLx":0,"legRx":0,"legLz":0,"legRz":0,"headX":0,"headY":0.156,"headZ":0.026,"trail":0}},
    {"f":10,"ease":"linear","pose":{"wX":0.357,"wZ":-0.75,"oX":-0.009,"oZ":0.273,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0,"bodyY":0,"bodyZ":-0.05,"lift":0,"legLx":0,"legRx":0,"legLz":0,"legRz":0,"headX":0,"headY":0.152,"headZ":0.027,"trail":0}},
   ],
   events:[]
  },
 }},
 "dualdagger":{chain:["attack1","attack2"],state:{"idle":"idle","run":"run","air":"air","dash":"dash"},anims:{
  "attack1":{fps:30,frames:13,loop:false,role:"attack",dir:1,groups:{"arms":true,"weapon":true,"body":true,"legs":true,"head":true},
   keys:[
    {"f":0,"ease":"linear","pose":{"wX":-0.592,"wZ":-1.15,"oX":-0.768,"oZ":1.01,"wrist":-1,"wrist2":-0.925,"roll":0,"grip":0,"bodyX":0.257,"bodyY":0.298,"bodyZ":-0.1,"lift":0,"legLx":0.017,"legRx":0.038,"legLz":-0.2,"legRz":0.2,"headX":-0.229,"headY":-0.374,"headZ":0.033,"trail":0}},
    {"f":1,"ease":"linear","pose":{"wX":-0.37,"wZ":-1.15,"oX":-1.877,"oZ":1.03,"wrist":-1,"wrist2":-0.46,"roll":0,"grip":0,"bodyX":0.208,"bodyY":0.46,"bodyZ":-0.1,"lift":0,"legLx":0.052,"legRx":0.115,"legLz":-0.2,"legRz":0.2,"headX":-0.209,"headY":-0.453,"headZ":0.033,"trail":0}},
    {"f":2,"ease":"linear","pose":{"wX":-0.183,"wZ":-1.15,"oX":-2.633,"oZ":1.047,"wrist":-1,"wrist2":-0.07,"roll":0,"grip":0,"bodyX":0.01,"bodyY":2.04,"bodyZ":-0.24,"lift":0,"legLx":0.075,"legRx":0.165,"legLz":-0.2,"legRz":0.2,"headX":-0.23,"headY":-0.02,"headZ":0.034,"trail":1}},
    {"f":3,"ease":"linear","pose":{"wX":-0.15,"wZ":-0.831,"oX":-1.155,"oZ":0.029,"wrist":-1,"wrist2":-0.159,"roll":0,"grip":0,"bodyX":0.428,"bodyY":1.04,"bodyZ":-0.1,"lift":0,"legLx":-0.128,"legRx":-0.281,"legLz":-0.2,"legRz":0.2,"headX":-0.297,"headY":-0.225,"headZ":0.035,"trail":1}},
    {"f":4,"ease":"linear","pose":{"wX":-0.15,"wZ":-0.666,"oX":-0.329,"oZ":-0.5,"wrist":-1,"wrist2":-0.242,"roll":0,"grip":0,"bodyX":0.567,"bodyY":-0.3,"bodyZ":-0.1,"lift":0,"legLx":-0.239,"legRx":-0.527,"legLz":-0.2,"legRz":0.2,"headX":-0.353,"headY":-0.065,"headZ":0.035,"trail":1}},
    {"f":5,"ease":"linear","pose":{"wX":-0.15,"wZ":-0.65,"oX":-0.243,"oZ":-0.558,"wrist":-1,"wrist2":-0.25,"roll":0,"grip":0,"bodyX":0.58,"bodyY":-0.323,"bodyZ":-0.1,"lift":0,"legLx":-0.25,"legRx":-0.55,"legLz":-0.2,"legRz":0.2,"headX":-0.358,"headY":-0.051,"headZ":0.036,"trail":1}},
    {"f":6,"ease":"linear","pose":{"wX":-0.15,"wZ":-0.65,"oX":-0.151,"oZ":-0.669,"wrist":-1,"wrist2":-0.25,"roll":0,"grip":0,"bodyX":0.58,"bodyY":-0.231,"bodyZ":-0.1,"lift":0,"legLx":-0.25,"legRx":-0.55,"legLz":-0.2,"legRz":0.2,"headX":-0.358,"headY":-0.095,"headZ":0.036,"trail":1}},
    {"f":7,"ease":"linear","pose":{"wX":-0.152,"wZ":-0.652,"oX":-0.195,"oZ":-0.605,"wrist":-1,"wrist2":-0.254,"roll":0,"grip":0,"bodyX":0.579,"bodyY":-0.273,"bodyZ":-0.1,"lift":0,"legLx":-0.249,"legRx":-0.548,"legLz":-0.2,"legRz":0.2,"headX":-0.357,"headY":-0.071,"headZ":0.036,"trail":1}},
    {"f":8,"ease":"linear","pose":{"wX":-0.235,"wZ":-0.727,"oX":-0.234,"oZ":-0.22,"wrist":-1,"wrist2":-0.389,"roll":0,"grip":0,"bodyX":0.534,"bodyY":-0.245,"bodyZ":-0.1,"lift":0,"legLx":-0.211,"legRx":-0.465,"legLz":-0.2,"legRz":0.2,"headX":-0.34,"headY":-0.082,"headZ":0.037,"trail":1}},
    {"f":9,"ease":"linear","pose":{"wX":-0.39,"wZ":-0.868,"oX":-0.206,"oZ":0.297,"wrist":-1,"wrist2":-0.642,"roll":0,"grip":0,"bodyX":0.449,"bodyY":-0.09,"bodyZ":-0.1,"lift":0,"legLx":-0.141,"legRx":-0.31,"legLz":-0.2,"legRz":0.2,"headX":-0.306,"headY":-0.156,"headZ":0.037,"trail":0}},
    {"f":10,"ease":"linear","pose":{"wX":-0.557,"wZ":-1.02,"oX":-0.176,"oZ":0.731,"wrist":-1,"wrist2":-0.916,"roll":0,"grip":0,"bodyX":0.358,"bodyY":0.077,"bodyZ":-0.1,"lift":0,"legLx":-0.065,"legRx":-0.143,"legLz":-0.2,"legRz":0.2,"headX":-0.269,"headY":-0.237,"headZ":0.038,"trail":0}},
    {"f":11,"ease":"linear","pose":{"wX":-0.676,"wZ":-1.128,"oX":-0.154,"oZ":0.962,"wrist":-1,"wrist2":-1.111,"roll":0,"grip":0,"bodyX":0.293,"bodyY":0.196,"bodyZ":-0.1,"lift":0,"legLx":-0.011,"legRx":-0.024,"legLz":-0.2,"legRz":0.2,"headX":-0.243,"headY":-0.294,"headZ":0.038,"trail":0}},
    {"f":12,"ease":"linear","pose":{"wX":-0.7,"wZ":-1.15,"oX":-0.15,"oZ":1,"wrist":-1,"wrist2":-1.15,"roll":0,"grip":0,"bodyX":0.28,"bodyY":0.22,"bodyZ":-0.1,"lift":0,"legLx":0,"legRx":0,"legLz":-0.2,"legRz":0.2,"headX":-0.238,"headY":-0.303,"headZ":0.038,"trail":0}},
   ],
   events:[{"f":2,"name":"swing","sfx":"assets/sfx/slash.wav","pitch":0.05},{"f":4,"name":"hit"}]
  },
  "attack2":{fps:30,frames:13,loop:false,role:"attack",dir:-1,groups:{"arms":true,"weapon":true,"body":true,"legs":true,"head":true},
   keys:[
    {"f":0,"ease":"linear","pose":{"wX":-1.124,"wZ":-1.13,"oX":-0.042,"oZ":1,"wrist":-0.805,"wrist2":-1.15,"roll":0,"grip":0,"bodyX":0.257,"bodyY":0.142,"bodyZ":-0.1,"lift":0,"legLx":0.038,"legRx":0.017,"legLz":-0.2,"legRz":0.2,"headX":-0.229,"headY":-0.212,"headZ":0.04,"trail":0}},
    {"f":1,"ease":"linear","pose":{"wX":-1.965,"wZ":-1.09,"oX":0.18,"oZ":1,"wrist":-0.4,"wrist2":-1.15,"roll":0,"grip":0,"bodyX":0.208,"bodyY":-0.02,"bodyZ":-0.1,"lift":0,"legLx":0.115,"legRx":0.052,"legLz":-0.2,"legRz":0.2,"headX":-0.209,"headY":-0.128,"headZ":0.039,"trail":0}},
    {"f":2,"ease":"linear","pose":{"wX":-3.6,"wZ":-1.51,"oX":0.367,"oZ":1,"wrist":-0.06,"wrist2":-1.15,"roll":0,"grip":0,"bodyX":0.06,"bodyY":-0.6,"bodyZ":-0.1,"lift":0,"legLx":0.165,"legRx":0.075,"legLz":-0.2,"legRz":0.2,"headX":-0.38,"headY":-0.52,"headZ":0.039,"trail":1}},
    {"f":3,"ease":"linear","pose":{"wX":-1.155,"wZ":-0.029,"oX":0.4,"oZ":0.681,"wrist":-0.159,"wrist2":-1.15,"roll":0,"grip":0,"bodyX":0.428,"bodyY":0.426,"bodyZ":-0.1,"lift":0,"legLx":-0.281,"legRx":-0.128,"legLz":-0.2,"legRz":0.2,"headX":-0.297,"headY":-0.344,"headZ":0.039,"trail":1}},
    {"f":4,"ease":"linear","pose":{"wX":-0.329,"wZ":0.5,"oX":0.4,"oZ":0.516,"wrist":-0.242,"wrist2":-1.15,"roll":0,"grip":0,"bodyX":0.567,"bodyY":0.74,"bodyZ":-0.1,"lift":0,"legLx":-0.527,"legRx":-0.239,"legLz":-0.2,"legRz":0.2,"headX":-0.353,"headY":-0.497,"headZ":0.039,"trail":1}},
    {"f":5,"ease":"linear","pose":{"wX":-0.243,"wZ":0.558,"oX":0.4,"oZ":0.5,"wrist":-0.25,"wrist2":-1.15,"roll":0,"grip":0,"bodyX":0.58,"bodyY":0.763,"bodyZ":-0.1,"lift":0,"legLx":-0.55,"legRx":-0.25,"legLz":-0.2,"legRz":0.2,"headX":-0.358,"headY":-0.505,"headZ":0.039,"trail":1}},
    {"f":6,"ease":"linear","pose":{"wX":-0.151,"wZ":0.669,"oX":0.4,"oZ":0.5,"wrist":-0.25,"wrist2":-1.15,"roll":0,"grip":0,"bodyX":0.58,"bodyY":0.671,"bodyZ":-0.1,"lift":0,"legLx":-0.55,"legRx":-0.25,"legLz":-0.2,"legRz":0.2,"headX":-0.358,"headY":-0.456,"headZ":0.038,"trail":1}},
    {"f":7,"ease":"linear","pose":{"wX":-0.198,"wZ":0.604,"oX":0.398,"oZ":0.502,"wrist":-0.253,"wrist2":-1.15,"roll":0,"grip":0,"bodyX":0.579,"bodyY":0.713,"bodyZ":-0.1,"lift":0,"legLx":-0.548,"legRx":-0.249,"legLz":-0.2,"legRz":0.2,"headX":-0.357,"headY":-0.473,"headZ":0.038,"trail":1}},
    {"f":8,"ease":"linear","pose":{"wX":-0.319,"wZ":0.178,"oX":0.315,"oZ":0.577,"wrist":-0.366,"wrist2":-1.15,"roll":0,"grip":0,"bodyX":0.534,"bodyY":0.685,"bodyZ":-0.1,"lift":0,"legLx":-0.465,"legRx":-0.211,"legLz":-0.2,"legRz":0.2,"headX":-0.34,"headY":-0.456,"headZ":0.038,"trail":1}},
    {"f":9,"ease":"linear","pose":{"wX":-0.446,"wZ":-0.4,"oX":0.16,"oZ":0.718,"wrist":-0.577,"wrist2":-1.15,"roll":0,"grip":0,"bodyX":0.449,"bodyY":0.53,"bodyZ":-0.1,"lift":0,"legLx":-0.31,"legRx":-0.141,"legLz":-0.2,"legRz":0.2,"headX":-0.306,"headY":-0.375,"headZ":0.037,"trail":0}},
    {"f":10,"ease":"linear","pose":{"wX":-0.583,"wZ":-0.871,"oX":-0.007,"oZ":0.87,"wrist":-0.805,"wrist2":-1.15,"roll":0,"grip":0,"bodyX":0.358,"bodyY":0.363,"bodyZ":-0.1,"lift":0,"legLx":-0.143,"legRx":-0.065,"legLz":-0.2,"legRz":0.2,"headX":-0.269,"headY":-0.288,"headZ":0.037,"trail":0}},
    {"f":11,"ease":"linear","pose":{"wX":-0.681,"wZ":-1.112,"oX":-0.126,"oZ":0.978,"wrist":-0.968,"wrist2":-1.15,"roll":0,"grip":0,"bodyX":0.293,"bodyY":0.244,"bodyZ":-0.1,"lift":0,"legLx":-0.024,"legRx":-0.011,"legLz":-0.2,"legRz":0.2,"headX":-0.243,"headY":-0.224,"headZ":0.036,"trail":0}},
    {"f":12,"ease":"linear","pose":{"wX":-0.7,"wZ":-1.15,"oX":-0.15,"oZ":1,"wrist":-1,"wrist2":-1.15,"roll":0,"grip":0,"bodyX":0.28,"bodyY":0.22,"bodyZ":-0.1,"lift":0,"legLx":0,"legRx":0,"legLz":-0.2,"legRz":0.2,"headX":-0.238,"headY":-0.209,"headZ":0.036,"trail":0}},
   ],
   events:[{"f":2,"name":"swing","sfx":"assets/sfx/slash.wav"},{"f":4,"name":"hit"}]
  },
  "idle":{fps:30,frames:85,loop:true,role:"idle",dir:0,groups:{"arms":true,"weapon":true,"body":true,"legs":true,"head":true},
   keys:[
    {"f":0,"ease":"linear","pose":{"wX":-0.7,"wZ":-1.15,"oX":-0.15,"oZ":1,"wrist":-1,"wrist2":-1.15,"roll":0,"grip":0,"bodyX":0.28,"bodyY":0.22,"bodyZ":-0.1,"lift":0,"legLx":0,"legRx":0,"legLz":-0.2,"legRz":0.2,"headX":-0.238,"headY":-0.188,"headZ":0.004,"trail":0}},
    {"f":64,"ease":"linear","pose":{"wX":-0.7,"wZ":-1.15,"oX":-0.15,"oZ":1,"wrist":-1,"wrist2":-1.15,"roll":0,"grip":0,"bodyX":0.28,"bodyY":0.22,"bodyZ":-0.1,"lift":0,"legLx":0,"legRx":0,"legLz":-0.2,"legRz":0.2,"headX":-0.238,"headY":-0.024,"headZ":0.039,"trail":0}},
    {"f":83,"ease":"linear","pose":{"wX":-0.7,"wZ":-1.15,"oX":-0.15,"oZ":1,"wrist":-1,"wrist2":-1.15,"roll":0,"grip":0,"bodyX":0.28,"bodyY":0.22,"bodyZ":-0.1,"lift":0,"legLx":0,"legRx":0,"legLz":-0.2,"legRz":0.2,"headX":-0.238,"headY":-0.022,"headZ":0.03,"trail":0}},
    {"f":84,"ease":"linear","pose":{"wX":-0.7,"wZ":-1.15,"oX":-0.15,"oZ":1,"wrist":-1,"wrist2":-1.15,"roll":0,"grip":0,"bodyX":0.28,"bodyY":0.22,"bodyZ":-0.1,"lift":0,"legLx":0,"legRx":0,"legLz":-0.2,"legRz":0.2,"headX":-0.238,"headY":-0.188,"headZ":0.004,"trail":0}},
   ],
   events:[]
  },
  "run":{fps:30,frames:11,loop:true,role:"run",dir:0,groups:{"arms":true,"weapon":true,"body":true,"legs":true,"head":true},
   keys:[
    {"f":0,"ease":"linear","pose":{"wX":1.198,"wZ":-0.32,"oX":1.202,"oZ":0.288,"wrist":-0.1,"wrist2":-0.1,"roll":0,"grip":0,"bodyX":0.72,"bodyY":0.001,"bodyZ":0,"lift":0,"legLx":0.017,"legRx":-0.017,"legLz":-0.12,"legRz":0.12,"headX":-0.602,"headY":0,"headZ":-0.02,"trail":0}},
    {"f":1,"ease":"linear","pose":{"wX":1.128,"wZ":-0.32,"oX":1.272,"oZ":0.288,"wrist":-0.1,"wrist2":-0.1,"roll":0,"grip":0,"bodyX":0.72,"bodyY":0.048,"bodyZ":0,"lift":0,"legLx":0.807,"legRx":-0.807,"legLz":-0.12,"legRz":0.12,"headX":-0.602,"headY":0,"headZ":0.008,"trail":0}},
    {"f":2,"ease":"linear","pose":{"wX":1.085,"wZ":-0.32,"oX":1.315,"oZ":0.288,"wrist":-0.1,"wrist2":-0.1,"roll":0,"grip":0,"bodyX":0.72,"bodyY":0.076,"bodyZ":0,"lift":0,"legLx":1.289,"legRx":-1.289,"legLz":-0.12,"legRz":0.12,"headX":-0.602,"headY":0,"headZ":0.025,"trail":0}},
    {"f":3,"ease":"linear","pose":{"wX":1.086,"wZ":-0.32,"oX":1.314,"oZ":0.288,"wrist":-0.1,"wrist2":-0.1,"roll":0,"grip":0,"bodyX":0.72,"bodyY":0.076,"bodyZ":0,"lift":0,"legLx":1.279,"legRx":-1.279,"legLz":-0.12,"legRz":0.12,"headX":-0.602,"headY":0,"headZ":0.024,"trail":0}},
    {"f":4,"ease":"linear","pose":{"wX":1.131,"wZ":-0.32,"oX":1.269,"oZ":0.288,"wrist":-0.1,"wrist2":-0.1,"roll":0,"grip":0,"bodyX":0.72,"bodyY":0.046,"bodyZ":0,"lift":0,"legLx":0.78,"legRx":-0.78,"legLz":-0.12,"legRz":0.12,"headX":-0.602,"headY":0,"headZ":0.004,"trail":0}},
    {"f":6,"ease":"linear","pose":{"wX":1.272,"wZ":-0.32,"oX":1.128,"oZ":0.288,"wrist":-0.1,"wrist2":-0.1,"roll":0,"grip":0,"bodyX":0.72,"bodyY":-0.048,"bodyZ":0,"lift":0,"legLx":-0.807,"legRx":0.807,"legLz":-0.12,"legRz":0.12,"headX":-0.602,"headY":0,"headZ":-0.056,"trail":0}},
    {"f":7,"ease":"linear","pose":{"wX":1.315,"wZ":-0.32,"oX":1.085,"oZ":0.288,"wrist":-0.1,"wrist2":-0.1,"roll":0,"grip":0,"bodyX":0.72,"bodyY":-0.076,"bodyZ":0,"lift":0,"legLx":-1.289,"legRx":1.289,"legLz":-0.12,"legRz":0.12,"headX":-0.602,"headY":0,"headZ":-0.075,"trail":0}},
    {"f":8,"ease":"linear","pose":{"wX":1.314,"wZ":-0.32,"oX":1.086,"oZ":0.288,"wrist":-0.1,"wrist2":-0.1,"roll":0,"grip":0,"bodyX":0.72,"bodyY":-0.076,"bodyZ":0,"lift":0,"legLx":-1.279,"legRx":1.279,"legLz":-0.12,"legRz":0.12,"headX":-0.602,"headY":0,"headZ":-0.075,"trail":0}},
    {"f":9,"ease":"linear","pose":{"wX":1.269,"wZ":-0.32,"oX":1.131,"oZ":0.288,"wrist":-0.1,"wrist2":-0.1,"roll":0,"grip":0,"bodyX":0.72,"bodyY":-0.046,"bodyZ":0,"lift":0,"legLx":-0.78,"legRx":0.78,"legLz":-0.12,"legRz":0.12,"headX":-0.602,"headY":0,"headZ":-0.057,"trail":0}},
    {"f":10,"ease":"linear","pose":{"wX":1.198,"wZ":-0.32,"oX":1.202,"oZ":0.288,"wrist":-0.1,"wrist2":-0.1,"roll":0,"grip":0,"bodyX":0.72,"bodyY":0.001,"bodyZ":0,"lift":0,"legLx":0.017,"legRx":-0.017,"legLz":-0.12,"legRz":0.12,"headX":-0.602,"headY":0,"headZ":-0.02,"trail":0}},
   ],
   events:[]
  },
  "air":{fps:30,frames:21,loop:false,role:"air",dir:0,groups:{"arms":true,"weapon":true,"body":true,"legs":true,"head":true},
   keys:[
    {"f":0,"ease":"linear","pose":{"wX":-0.863,"wZ":-1.077,"oX":-0.413,"oZ":0.954,"wrist":-0.999,"wrist2":-1.149,"roll":0,"grip":0,"bodyX":0.166,"bodyY":0.22,"bodyZ":-0.1,"lift":0,"legLx":-0.597,"legRx":-0.338,"legLz":-0.2,"legRz":0.2,"headX":-0.238,"headY":-0.278,"headZ":-0.04,"trail":0}},
    {"f":1,"ease":"linear","pose":{"wX":-0.946,"wZ":-1.042,"oX":-0.544,"oZ":0.932,"wrist":-0.999,"wrist2":-1.149,"roll":0,"grip":0,"bodyX":0.128,"bodyY":0.22,"bodyZ":-0.1,"lift":0,"legLx":-0.885,"legRx":-0.5,"legLz":-0.2,"legRz":0.2,"headX":-0.238,"headY":-0.282,"headZ":-0.04,"trail":0}},
    {"f":2,"ease":"linear","pose":{"wX":-0.989,"wZ":-1.025,"oX":-0.61,"oZ":0.922,"wrist":-1,"wrist2":-1.15,"roll":0,"grip":0,"bodyX":0.125,"bodyY":0.22,"bodyZ":-0.1,"lift":0,"legLx":-1.002,"legRx":-0.559,"legLz":-0.2,"legRz":0.2,"headX":-0.238,"headY":-0.285,"headZ":-0.04,"trail":0}},
    {"f":3,"ease":"linear","pose":{"wX":-1.013,"wZ":-1.017,"oX":-0.645,"oZ":0.917,"wrist":-1,"wrist2":-1.15,"roll":0,"grip":0,"bodyX":0.136,"bodyY":0.22,"bodyZ":-0.1,"lift":0,"legLx":-1.007,"legRx":-0.542,"legLz":-0.2,"legRz":0.2,"headX":-0.238,"headY":-0.288,"headZ":-0.039,"trail":0}},
    {"f":5,"ease":"linear","pose":{"wX":-1.037,"wZ":-1.012,"oX":-0.678,"oZ":0.913,"wrist":-1,"wrist2":-1.15,"roll":0,"grip":0,"bodyX":0.174,"bodyY":0.22,"bodyZ":-0.1,"lift":0,"legLx":-0.845,"legRx":-0.381,"legLz":-0.2,"legRz":0.2,"headX":-0.238,"headY":-0.294,"headZ":-0.039,"trail":0}},
    {"f":10,"ease":"linear","pose":{"wX":-1.069,"wZ":-1.01,"oX":-0.711,"oZ":0.912,"wrist":-1,"wrist2":-1.15,"roll":0,"grip":0,"bodyX":0.286,"bodyY":0.22,"bodyZ":-0.1,"lift":0,"legLx":-0.249,"legRx":0.161,"legLz":-0.2,"legRz":0.2,"headX":-0.238,"headY":-0.309,"headZ":-0.038,"trail":0}},
    {"f":12,"ease":"linear","pose":{"wX":-1.08,"wZ":-1.01,"oX":-0.722,"oZ":0.912,"wrist":-1,"wrist2":-1.15,"roll":0,"grip":0,"bodyX":0.331,"bodyY":0.22,"bodyZ":-0.1,"lift":0,"legLx":-0.151,"legRx":0.249,"legLz":-0.2,"legRz":0.2,"headX":-0.238,"headY":-0.315,"headZ":-0.037,"trail":0}},
    {"f":20,"ease":"linear","pose":{"wX":-1.123,"wZ":-1.01,"oX":-0.765,"oZ":0.912,"wrist":-1,"wrist2":-1.15,"roll":0,"grip":0,"bodyX":0.511,"bodyY":0.22,"bodyZ":-0.1,"lift":0,"legLx":-0.15,"legRx":0.25,"legLz":-0.2,"legRz":0.2,"headX":-0.238,"headY":-0.336,"headZ":-0.033,"trail":0}},
   ],
   events:[]
  },
  "dash":{fps:30,frames:11,loop:false,role:"dash",dir:0,groups:{"arms":true,"weapon":true,"body":true,"legs":true,"head":true},
   keys:[
    {"f":0,"ease":"linear","pose":{"wX":0.581,"wZ":-0.349,"oX":0.691,"oZ":0.333,"wrist":-1,"wrist2":-1.15,"roll":0,"grip":0,"bodyX":1.17,"bodyY":0.22,"bodyZ":-0.1,"lift":0,"legLx":0.756,"legRx":0.534,"legLz":-0.2,"legRz":0.2,"headX":-0.238,"headY":-0.379,"headZ":-0.005,"trail":0}},
    {"f":1,"ease":"linear","pose":{"wX":0.74,"wZ":-0.25,"oX":0.795,"oZ":0.25,"wrist":-1,"wrist2":-1.15,"roll":0,"grip":0,"bodyX":1.28,"bodyY":0.22,"bodyZ":-0.1,"lift":0,"legLx":0.85,"legRx":0.6,"legLz":-0.2,"legRz":0.2,"headX":-0.238,"headY":-0.379,"headZ":-0.004,"trail":0}},
    {"f":5,"ease":"linear","pose":{"wX":0.74,"wZ":-0.25,"oX":0.795,"oZ":0.25,"wrist":-1,"wrist2":-1.15,"roll":0,"grip":0,"bodyX":1.28,"bodyY":0.22,"bodyZ":-0.1,"lift":0,"legLx":0.85,"legRx":0.6,"legLz":-0.2,"legRz":0.2,"headX":-0.238,"headY":-0.38,"headZ":0,"trail":0}},
    {"f":6,"ease":"linear","pose":{"wX":0.581,"wZ":-0.349,"oX":0.691,"oZ":0.333,"wrist":-1,"wrist2":-1.15,"roll":0,"grip":0,"bodyX":1.17,"bodyY":0.22,"bodyZ":-0.1,"lift":0,"legLx":0.756,"legRx":0.534,"legLz":-0.2,"legRz":0.2,"headX":-0.238,"headY":-0.38,"headZ":0.001,"trail":0}},
    {"f":7,"ease":"linear","pose":{"wX":-0.2,"wZ":-0.837,"oX":0.178,"oZ":0.739,"wrist":-1,"wrist2":-1.15,"roll":0,"grip":0,"bodyX":0.627,"bodyY":0.22,"bodyZ":-0.1,"lift":0,"legLx":0.295,"legRx":0.208,"legLz":-0.2,"legRz":0.2,"headX":-0.238,"headY":-0.38,"headZ":0.002,"trail":0}},
    {"f":8,"ease":"linear","pose":{"wX":-0.7,"wZ":-1.15,"oX":-0.15,"oZ":1,"wrist":-1,"wrist2":-1.15,"roll":0,"grip":0,"bodyX":0.28,"bodyY":0.22,"bodyZ":-0.1,"lift":0,"legLx":0,"legRx":0,"legLz":-0.2,"legRz":0.2,"headX":-0.238,"headY":-0.38,"headZ":0.003,"trail":0}},
    {"f":10,"ease":"linear","pose":{"wX":-0.7,"wZ":-1.15,"oX":-0.15,"oZ":1,"wrist":-1,"wrist2":-1.15,"roll":0,"grip":0,"bodyX":0.28,"bodyY":0.22,"bodyZ":-0.1,"lift":0,"legLx":0,"legRx":0,"legLz":-0.2,"legRz":0.2,"headX":-0.238,"headY":-0.379,"headZ":0.005,"trail":0}},
   ],
   events:[]
  },
 }},
 "katana":{chain:["attack1","attack2"],state:{"idle":"idle","run":"run","air":"air","dash":"dash"},anims:{
  "attack1":{fps:30,frames:11,loop:false,role:"attack",dir:1,groups:{"arms":true,"weapon":true,"body":true,"legs":true,"head":true},
   keys:[
    {"f":0,"ease":"linear","pose":{"wX":-0.38,"wZ":-0.069,"oX":-0.828,"oZ":0.7,"wrist":0.718,"wrist2":-0.85,"roll":0,"grip":0.33,"bodyX":0.258,"bodyY":-0.159,"bodyZ":-0.05,"lift":0,"legLx":0.025,"legRx":0.054,"legLz":-0.2,"legRz":0.2,"headX":-0.238,"headY":0.146,"headZ":0.04,"trail":0}},
    {"f":1,"ease":"linear","pose":{"wX":-2.038,"wZ":0.308,"oX":0.101,"oZ":0.7,"wrist":0.216,"wrist2":-0.85,"roll":0,"grip":0.551,"bodyX":0.182,"bodyY":0.092,"bodyZ":-0.05,"lift":0,"legLx":0.069,"legRx":0.151,"legLz":-0.2,"legRz":0.2,"headX":-0.208,"headY":0.024,"headZ":0.04,"trail":0}},
    {"f":2,"ease":"linear","pose":{"wX":-1.676,"wZ":-0.217,"oX":0.5,"oZ":0.7,"wrist":-0.107,"wrist2":-0.85,"roll":0,"grip":0.699,"bodyX":0.375,"bodyY":-0.31,"bodyZ":-0.05,"lift":0,"legLx":-0.057,"legRx":-0.126,"legLz":-0.2,"legRz":0.2,"headX":-0.285,"headY":0.229,"headZ":0.039,"trail":1}},
    {"f":3,"ease":"linear","pose":{"wX":-0.348,"wZ":-1.068,"oX":0.5,"oZ":0.7,"wrist":-0.24,"wrist2":-0.85,"roll":0,"grip":0.798,"bodyX":0.655,"bodyY":-0.941,"bodyZ":-0.05,"lift":0,"legLx":-0.237,"legRx":-0.521,"legLz":-0.2,"legRz":0.2,"headX":-0.397,"headY":0.548,"headZ":0.039,"trail":1}},
    {"f":4,"ease":"linear","pose":{"wX":-0.228,"wZ":-1.156,"oX":0.5,"oZ":0.7,"wrist":-0.25,"wrist2":-0.85,"roll":0,"grip":0.865,"bodyX":0.675,"bodyY":-0.96,"bodyZ":-0.05,"lift":0,"legLx":-0.25,"legRx":-0.55,"legLz":-0.2,"legRz":0.2,"headX":-0.405,"headY":0.561,"headZ":0.039,"trail":1}},
    {"f":5,"ease":"linear","pose":{"wX":-0.158,"wZ":-1.24,"oX":0.5,"oZ":0.7,"wrist":-0.25,"wrist2":-0.85,"roll":0,"grip":0.909,"bodyX":0.675,"bodyY":-0.873,"bodyZ":-0.05,"lift":0,"legLx":-0.25,"legRx":-0.55,"legLz":-0.2,"legRz":0.2,"headX":-0.405,"headY":0.521,"headZ":0.039,"trail":1}},
    {"f":6,"ease":"linear","pose":{"wX":-0.175,"wZ":-1.074,"oX":0.351,"oZ":0.7,"wrist":-0.149,"wrist2":-0.85,"roll":0,"grip":0.939,"bodyX":0.645,"bodyY":-0.919,"bodyZ":-0.05,"lift":0,"legLx":-0.23,"legRx":-0.506,"legLz":-0.2,"legRz":0.2,"headX":-0.393,"headY":0.547,"headZ":0.038,"trail":1}},
    {"f":7,"ease":"linear","pose":{"wX":0.069,"wZ":-0.791,"oX":-0.239,"oZ":0.7,"wrist":0.249,"wrist2":-0.85,"roll":0,"grip":0.959,"bodyX":0.525,"bodyY":-0.713,"bodyZ":-0.05,"lift":0,"legLx":-0.15,"legRx":-0.33,"legLz":-0.2,"legRz":0.2,"headX":-0.345,"headY":0.448,"headZ":0.038,"trail":0}},
    {"f":8,"ease":"linear","pose":{"wX":0.367,"wZ":-0.474,"oX":-0.928,"oZ":0.7,"wrist":0.715,"wrist2":-0.85,"roll":0,"grip":0.973,"bodyX":0.386,"bodyY":-0.457,"bodyZ":-0.05,"lift":0,"legLx":-0.057,"legRx":-0.126,"legLz":-0.2,"legRz":0.2,"headX":-0.289,"headY":0.323,"headZ":0.038,"trail":0}},
    {"f":9,"ease":"linear","pose":{"wX":0.544,"wZ":-0.287,"oX":-1.336,"oZ":0.7,"wrist":0.99,"wrist2":-0.85,"roll":0,"grip":0.982,"bodyX":0.303,"bodyY":-0.305,"bodyZ":-0.05,"lift":0,"legLx":-0.002,"legRx":-0.004,"legLz":-0.2,"legRz":0.2,"headX":-0.256,"headY":0.251,"headZ":0.037,"trail":0}},
    {"f":10,"ease":"linear","pose":{"wX":0.55,"wZ":-0.28,"oX":-1.35,"oZ":0.7,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0.988,"bodyX":0.3,"bodyY":-0.3,"bodyZ":-0.05,"lift":0,"legLx":0,"legRx":0,"legLz":-0.2,"legRz":0.2,"headX":-0.255,"headY":0.252,"headZ":0.037,"trail":0}},
   ],
   events:[{"f":2,"name":"swing","sfx":"assets/sfx/slash.wav"},{"f":3,"name":"hit"}]
  },
  "attack2":{fps:30,frames:11,loop:false,role:"attack",dir:-1,groups:{"arms":true,"weapon":true,"body":true,"legs":true,"head":true},
   keys:[
    {"f":0,"ease":"linear","pose":{"wX":-0.38,"wZ":-0.491,"oX":-0.828,"oZ":0.7,"wrist":0.718,"wrist2":-0.85,"roll":0,"grip":0.331,"bodyX":0.258,"bodyY":-0.441,"bodyZ":-0.05,"lift":0,"legLx":0.054,"legRx":0.025,"legLz":-0.2,"legRz":0.2,"headX":-0.238,"headY":0.38,"headZ":0.027,"trail":0}},
    {"f":1,"ease":"linear","pose":{"wX":-2.038,"wZ":-0.868,"oX":0.101,"oZ":0.7,"wrist":0.216,"wrist2":-0.85,"roll":0,"grip":0.552,"bodyX":0.182,"bodyY":-0.692,"bodyZ":-0.05,"lift":0,"legLx":0.151,"legRx":0.069,"legLz":-0.2,"legRz":0.2,"headX":-0.208,"headY":0.509,"headZ":0.027,"trail":1}},
    {"f":2,"ease":"linear","pose":{"wX":-1.676,"wZ":-0.343,"oX":0.5,"oZ":0.7,"wrist":-0.107,"wrist2":-0.85,"roll":0,"grip":0.7,"bodyX":0.375,"bodyY":-0.29,"bodyZ":-0.05,"lift":0,"legLx":-0.126,"legRx":-0.057,"legLz":-0.2,"legRz":0.2,"headX":-0.285,"headY":0.311,"headZ":0.026,"trail":1}},
    {"f":3,"ease":"linear","pose":{"wX":-0.348,"wZ":0.508,"oX":0.5,"oZ":0.7,"wrist":-0.24,"wrist2":-0.85,"roll":0,"grip":0.799,"bodyX":0.655,"bodyY":0.341,"bodyZ":-0.05,"lift":0,"legLx":-0.521,"legRx":-0.237,"legLz":-0.2,"legRz":0.2,"headX":-0.397,"headY":-0.001,"headZ":0.025,"trail":1}},
    {"f":4,"ease":"linear","pose":{"wX":-0.228,"wZ":0.596,"oX":0.5,"oZ":0.7,"wrist":-0.25,"wrist2":-0.85,"roll":0,"grip":0.865,"bodyX":0.675,"bodyY":0.36,"bodyZ":-0.05,"lift":0,"legLx":-0.55,"legRx":-0.25,"legLz":-0.2,"legRz":0.2,"headX":-0.405,"headY":-0.007,"headZ":0.024,"trail":1}},
    {"f":5,"ease":"linear","pose":{"wX":-0.158,"wZ":0.68,"oX":0.5,"oZ":0.7,"wrist":-0.25,"wrist2":-0.85,"roll":0,"grip":0.91,"bodyX":0.675,"bodyY":0.273,"bodyZ":-0.05,"lift":0,"legLx":-0.55,"legRx":-0.25,"legLz":-0.2,"legRz":0.2,"headX":-0.405,"headY":0.04,"headZ":0.023,"trail":1}},
    {"f":6,"ease":"linear","pose":{"wX":-0.175,"wZ":0.514,"oX":0.351,"oZ":0.7,"wrist":-0.149,"wrist2":-0.85,"roll":0,"grip":0.939,"bodyX":0.645,"bodyY":0.319,"bodyZ":-0.05,"lift":0,"legLx":-0.506,"legRx":-0.23,"legLz":-0.2,"legRz":0.2,"headX":-0.393,"headY":0.02,"headZ":0.022,"trail":1}},
    {"f":7,"ease":"linear","pose":{"wX":0.069,"wZ":0.231,"oX":-0.239,"oZ":0.7,"wrist":0.249,"wrist2":-0.85,"roll":0,"grip":0.959,"bodyX":0.525,"bodyY":0.113,"bodyZ":-0.05,"lift":0,"legLx":-0.33,"legRx":-0.15,"legLz":-0.2,"legRz":0.2,"headX":-0.345,"headY":0.127,"headZ":0.022,"trail":0}},
    {"f":8,"ease":"linear","pose":{"wX":0.367,"wZ":-0.086,"oX":-0.928,"oZ":0.7,"wrist":0.715,"wrist2":-0.85,"roll":0,"grip":0.973,"bodyX":0.386,"bodyY":-0.143,"bodyZ":-0.05,"lift":0,"legLx":-0.126,"legRx":-0.057,"legLz":-0.2,"legRz":0.2,"headX":-0.289,"headY":0.258,"headZ":0.021,"trail":0}},
    {"f":9,"ease":"linear","pose":{"wX":0.544,"wZ":-0.273,"oX":-1.336,"oZ":0.7,"wrist":0.99,"wrist2":-0.85,"roll":0,"grip":0.982,"bodyX":0.303,"bodyY":-0.295,"bodyZ":-0.05,"lift":0,"legLx":-0.004,"legRx":-0.002,"legLz":-0.2,"legRz":0.2,"headX":-0.256,"headY":0.337,"headZ":0.02,"trail":0}},
    {"f":10,"ease":"linear","pose":{"wX":0.55,"wZ":-0.28,"oX":-1.35,"oZ":0.7,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0.988,"bodyX":0.3,"bodyY":-0.3,"bodyZ":-0.05,"lift":0,"legLx":0,"legRx":0,"legLz":-0.2,"legRz":0.2,"headX":-0.255,"headY":0.343,"headZ":0.019,"trail":0}},
   ],
   events:[{"f":2,"name":"swing","sfx":"assets/sfx/slash.wav"},{"f":3,"name":"hit"}]
  },
  "idle":{fps:30,frames:85,loop:true,role:"idle",dir:0,groups:{"arms":true,"weapon":true,"body":true,"legs":true,"head":true},
   keys:[
    {"f":0,"ease":"linear","pose":{"wX":0.55,"wZ":-0.28,"oX":-1.35,"oZ":0.7,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.3,"bodyY":-0.3,"bodyZ":-0.05,"lift":0,"legLx":0,"legRx":0,"legLz":-0.2,"legRz":0.2,"headX":-0.255,"headY":0.363,"headZ":0.027,"trail":0}},
    {"f":56,"ease":"linear","pose":{"wX":0.55,"wZ":-0.28,"oX":-1.35,"oZ":0.7,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.3,"bodyY":-0.3,"bodyZ":-0.05,"lift":0,"legLx":0,"legRx":0,"legLz":-0.2,"legRz":0.2,"headX":-0.255,"headY":0.449,"headZ":0.032,"trail":0}},
    {"f":83,"ease":"linear","pose":{"wX":0.55,"wZ":-0.28,"oX":-1.35,"oZ":0.7,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.3,"bodyY":-0.3,"bodyZ":-0.05,"lift":0,"legLx":0,"legRx":0,"legLz":-0.2,"legRz":0.2,"headX":-0.255,"headY":0.415,"headZ":0.008,"trail":0}},
    {"f":84,"ease":"linear","pose":{"wX":0.55,"wZ":-0.28,"oX":-1.35,"oZ":0.7,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.3,"bodyY":-0.3,"bodyZ":-0.05,"lift":0,"legLx":0,"legRx":0,"legLz":-0.2,"legRz":0.2,"headX":-0.255,"headY":0.363,"headZ":0.027,"trail":0}},
   ],
   events:[]
  },
  "run":{fps:30,frames:11,loop:true,role:"run",dir:0,groups:{"arms":true,"weapon":true,"body":true,"legs":true,"head":true},
   keys:[
    {"f":0,"ease":"linear","pose":{"wX":1.197,"wZ":-0.32,"oX":1.203,"oZ":0.288,"wrist":0.25,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.44,"bodyY":0.002,"bodyZ":0,"lift":0,"legLx":0.031,"legRx":-0.031,"legLz":0,"legRz":0,"headX":-0.364,"headY":0,"headZ":-0.037,"trail":0}},
    {"f":1,"ease":"linear","pose":{"wX":1.127,"wZ":-0.32,"oX":1.273,"oZ":0.288,"wrist":0.25,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.44,"bodyY":0.048,"bodyZ":0,"lift":0,"legLx":0.818,"legRx":-0.818,"legLz":0,"legRz":0,"headX":-0.364,"headY":0,"headZ":-0.008,"trail":0}},
    {"f":2,"ease":"linear","pose":{"wX":1.085,"wZ":-0.32,"oX":1.315,"oZ":0.288,"wrist":0.25,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.44,"bodyY":0.077,"bodyZ":0,"lift":0,"legLx":1.293,"legRx":-1.293,"legLz":0,"legRz":0,"headX":-0.364,"headY":0,"headZ":0.009,"trail":0}},
    {"f":3,"ease":"linear","pose":{"wX":1.087,"wZ":-0.32,"oX":1.313,"oZ":0.288,"wrist":0.25,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.44,"bodyY":0.075,"bodyZ":0,"lift":0,"legLx":1.274,"legRx":-1.274,"legLz":0,"legRz":0,"headX":-0.364,"headY":0,"headZ":0.008,"trail":0}},
    {"f":4,"ease":"linear","pose":{"wX":1.132,"wZ":-0.32,"oX":1.268,"oZ":0.288,"wrist":0.25,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.44,"bodyY":0.046,"bodyZ":0,"lift":0,"legLx":0.768,"legRx":-0.768,"legLz":0,"legRz":0,"headX":-0.364,"headY":0,"headZ":-0.011,"trail":0}},
    {"f":6,"ease":"linear","pose":{"wX":1.273,"wZ":-0.32,"oX":1.127,"oZ":0.288,"wrist":0.25,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.44,"bodyY":-0.048,"bodyZ":0,"lift":0,"legLx":-0.818,"legRx":0.818,"legLz":0,"legRz":0,"headX":-0.364,"headY":0,"headZ":-0.07,"trail":0}},
    {"f":7,"ease":"linear","pose":{"wX":1.315,"wZ":-0.32,"oX":1.085,"oZ":0.288,"wrist":0.25,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.44,"bodyY":-0.077,"bodyZ":0,"lift":0,"legLx":-1.293,"legRx":1.293,"legLz":0,"legRz":0,"headX":-0.364,"headY":0,"headZ":-0.088,"trail":0}},
    {"f":8,"ease":"linear","pose":{"wX":1.313,"wZ":-0.32,"oX":1.087,"oZ":0.288,"wrist":0.25,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.44,"bodyY":-0.075,"bodyZ":0,"lift":0,"legLx":-1.274,"legRx":1.274,"legLz":0,"legRz":0,"headX":-0.364,"headY":0,"headZ":-0.087,"trail":0}},
    {"f":9,"ease":"linear","pose":{"wX":1.268,"wZ":-0.32,"oX":1.132,"oZ":0.288,"wrist":0.25,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.44,"bodyY":-0.046,"bodyZ":0,"lift":0,"legLx":-0.768,"legRx":0.768,"legLz":0,"legRz":0,"headX":-0.364,"headY":0,"headZ":-0.068,"trail":0}},
    {"f":10,"ease":"linear","pose":{"wX":1.197,"wZ":-0.32,"oX":1.203,"oZ":0.288,"wrist":0.25,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.44,"bodyY":0.002,"bodyZ":0,"lift":0,"legLx":0.031,"legRx":-0.031,"legLz":0,"legRz":0,"headX":-0.364,"headY":0,"headZ":-0.037,"trail":0}},
   ],
   events:[]
  },
  "air":{fps:30,frames:21,loop:false,role:"air",dir:0,groups:{"arms":true,"weapon":true,"body":true,"legs":true,"head":true},
   keys:[
    {"f":0,"ease":"linear","pose":{"wX":0.159,"wZ":-0.366,"oX":-1.394,"oZ":0.709,"wrist":0.999,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.186,"bodyY":-0.3,"bodyZ":-0.05,"lift":0,"legLx":-0.597,"legRx":-0.338,"legLz":-0.2,"legRz":0.2,"headX":-0.255,"headY":0.118,"headZ":-0.028,"trail":0}},
    {"f":1,"ease":"linear","pose":{"wX":-0.033,"wZ":-0.407,"oX":-1.42,"oZ":0.713,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.148,"bodyY":-0.3,"bodyZ":-0.05,"lift":0,"legLx":-0.885,"legRx":-0.5,"legLz":-0.2,"legRz":0.2,"headX":-0.255,"headY":0.116,"headZ":-0.027,"trail":0}},
    {"f":2,"ease":"linear","pose":{"wX":-0.129,"wZ":-0.426,"oX":-1.437,"oZ":0.715,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.145,"bodyY":-0.3,"bodyZ":-0.05,"lift":0,"legLx":-1.002,"legRx":-0.559,"legLz":-0.2,"legRz":0.2,"headX":-0.255,"headY":0.115,"headZ":-0.026,"trail":0}},
    {"f":3,"ease":"linear","pose":{"wX":-0.178,"wZ":-0.436,"oX":-1.447,"oZ":0.716,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.156,"bodyY":-0.3,"bodyZ":-0.05,"lift":0,"legLx":-1.007,"legRx":-0.542,"legLz":-0.2,"legRz":0.2,"headX":-0.255,"headY":0.113,"headZ":-0.025,"trail":0}},
    {"f":5,"ease":"linear","pose":{"wX":-0.22,"wZ":-0.442,"oX":-1.463,"oZ":0.717,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.194,"bodyY":-0.3,"bodyZ":-0.05,"lift":0,"legLx":-0.845,"legRx":-0.381,"legLz":-0.2,"legRz":0.2,"headX":-0.255,"headY":0.109,"headZ":-0.023,"trail":0}},
    {"f":10,"ease":"linear","pose":{"wX":-0.256,"wZ":-0.444,"oX":-1.491,"oZ":0.717,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.306,"bodyY":-0.3,"bodyZ":-0.05,"lift":0,"legLx":-0.249,"legRx":0.161,"legLz":-0.2,"legRz":0.2,"headX":-0.255,"headY":0.102,"headZ":-0.019,"trail":0}},
    {"f":12,"ease":"linear","pose":{"wX":-0.267,"wZ":-0.444,"oX":-1.502,"oZ":0.717,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.351,"bodyY":-0.3,"bodyZ":-0.05,"lift":0,"legLx":-0.151,"legRx":0.249,"legLz":-0.2,"legRz":0.2,"headX":-0.255,"headY":0.1,"headZ":-0.017,"trail":0}},
    {"f":20,"ease":"linear","pose":{"wX":-0.31,"wZ":-0.445,"oX":-1.545,"oZ":0.717,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.531,"bodyY":-0.3,"bodyZ":-0.05,"lift":0,"legLx":-0.15,"legRx":0.25,"legLz":-0.2,"legRz":0.2,"headX":-0.255,"headY":0.093,"headZ":-0.009,"trail":0}},
   ],
   events:[]
  },
  "dash":{fps:30,frames:11,loop:false,role:"dash",dir:0,groups:{"arms":true,"weapon":true,"body":true,"legs":true,"head":true},
   keys:[
    {"f":0,"ease":"linear","pose":{"wX":0.83,"wZ":-0.253,"oX":0.452,"oZ":0.3,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":1.19,"bodyY":-0.3,"bodyZ":-0.05,"lift":0,"legLx":0.756,"legRx":0.534,"legLz":-0.2,"legRz":0.2,"headX":-0.255,"headY":0.108,"headZ":0.023,"trail":0}},
    {"f":1,"ease":"linear","pose":{"wX":0.865,"wZ":-0.25,"oX":0.675,"oZ":0.25,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":1.3,"bodyY":-0.3,"bodyZ":-0.05,"lift":0,"legLx":0.85,"legRx":0.6,"legLz":-0.2,"legRz":0.2,"headX":-0.255,"headY":0.11,"headZ":0.023,"trail":0}},
    {"f":5,"ease":"linear","pose":{"wX":0.865,"wZ":-0.25,"oX":0.675,"oZ":0.25,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":1.3,"bodyY":-0.3,"bodyZ":-0.05,"lift":0,"legLx":0.85,"legRx":0.6,"legLz":-0.2,"legRz":0.2,"headX":-0.255,"headY":0.117,"headZ":0.027,"trail":0}},
    {"f":6,"ease":"linear","pose":{"wX":0.83,"wZ":-0.253,"oX":0.452,"oZ":0.3,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":1.19,"bodyY":-0.3,"bodyZ":-0.05,"lift":0,"legLx":0.756,"legRx":0.534,"legLz":-0.2,"legRz":0.2,"headX":-0.255,"headY":0.118,"headZ":0.028,"trail":0}},
    {"f":7,"ease":"linear","pose":{"wX":0.659,"wZ":-0.27,"oX":-0.646,"oZ":0.544,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.647,"bodyY":-0.3,"bodyZ":-0.05,"lift":0,"legLx":0.295,"legRx":0.208,"legLz":-0.2,"legRz":0.2,"headX":-0.255,"headY":0.12,"headZ":0.028,"trail":0}},
    {"f":8,"ease":"linear","pose":{"wX":0.55,"wZ":-0.28,"oX":-1.35,"oZ":0.7,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.3,"bodyY":-0.3,"bodyZ":-0.05,"lift":0,"legLx":0,"legRx":0,"legLz":-0.2,"legRz":0.2,"headX":-0.255,"headY":0.122,"headZ":0.029,"trail":0}},
    {"f":10,"ease":"linear","pose":{"wX":0.55,"wZ":-0.28,"oX":-1.35,"oZ":0.7,"wrist":1,"wrist2":-0.85,"roll":0,"grip":0,"bodyX":0.3,"bodyY":-0.3,"bodyZ":-0.05,"lift":0,"legLx":0,"legRx":0,"legLz":-0.2,"legRz":0.2,"headX":-0.255,"headY":0.127,"headZ":0.03,"trail":0}},
   ],
   events:[]
  },
 }}
};
const ANIM_ALIAS={};   // optional: a weapon that borrows another weapon's animations
// </WEAPON_ANIMS>

// ---- which animation set a weapon plays: its own entry > the weapon it is aliased to > a shared 'type:<type>' entry > the main weapon of its type > none (procedural motion) ----
const TYPE_OF=d=>d.kind==='gun'?'rifle':d.handling==='dual'?'dual':d.great==='shoulder'?'heavy':d.great?'longblade':'normal';
const TYPE_MAIN={normal:'woodensword',heavy:'axe',dual:'dualdagger',longblade:'katana'};
const animsFor=d=>{const t=TYPE_OF(d);return WEAPON_ANIMS[d.id]||WEAPON_ANIMS[ANIM_ALIAS[d.id]]||WEAPON_ANIMS['type:'+t]||WEAPON_ANIMS[TYPE_MAIN[t]]||null};
// dual-blade pose tuning (radians). Arm X: negative = forward/up, positive = swept back. Arm Z magnitude = how wide the arm spreads out.
const DUAL={wX:-.7,wZ:1.15,oX:-.15,oZ:1.0,blade:-1.0,blade2:-1.15,   // stance: weapon arm raised wide, off arm lower + wide, blades angled outward-forward
  runX:1.2,runZ:.32,runBlade:-.1,                                     // ninja run: both arms swept back, blades trailing behind
  lean:.28,runLean:.24,crouch:.09,splay:.2,twist:.22};                // body lean (stance / extra when running), crouch depth, leg splay, torso turn

// long / heavy weapon pose tuning (weapons flagged great:'blade' = katana, great:'shoulder' = axe, scythe). Same arm convention as DUAL.
//   'blade'    : stand = anime iai ready (sword hand at the hip, blade pointing straight back, free arm reaching forward, body leaning in);
//                run = ninja (both arms swept back, the sword trailing behind in the hand)
//   'shoulder' : big weapons rest on the shoulder (hand up at the shoulder, shaft across it, head behind). SAME arm pose standing and running, only the free arm swings.
//                roll turns the weapon a quarter turn about its own length so the broad face shows sideways (readable from behind); it rolls back to edge-first during a swing.
//   x / z = weapon arm swing / spread, sw = wrist angle (weapon angle = x + sw), offX / offZ = free arm (standing), lean / runLean / crouch / splay / twist = body
const GREAT={runX:1.2,runZ:.32,runBlade:.25,
  blade:{x:.55,z:.28,sw:1.0,roll:0,offX:-1.35,offZ:.7,lean:.3,runLean:-.06,crouch:.1,splay:.2,twist:-.3},
  shoulder:{x:.35,z:.75,sw:1.0,roll:0,offX:0,offZ:0,lean:0,runLean:0,crouch:0,splay:0,twist:0}};   // heavy weapons now use the normal melee handling (arm swing, run, off arm); z = how wide the main arm is spread, sw = wrist angle (more forward than a sword so the long head stays off the ground)

// 2. Short, chubby, non-floating Leg Generator
function createLegGeo(height, topR, botR, furCol) {
  const geo = new T.SphereGeometry(1, 20, 16);
  const pos = geo.attributes.position;
  for(let i=0; i<pos.count; i++){
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    let normY = (y + 1) / 2;
    let currentRadius = botR * (1 - normY) + topR * normY;
    pos.setX(i, x * currentRadius * 0.9);
    pos.setY(i, (y * 0.5) * height - height/2);
    pos.setZ(i, z * currentRadius);
  }
  geo.computeVertexNormals();
  return painted(geo, v => (v.y < -height * 0.35) ? '#fff7ee' : furCol);
}

const lerp=(a,b,t)=>a+(b-a)*t,sm=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)},rg=(a,b,x)=>Math.min(1,Math.max(0,(x-a)/(b-a))),e3=x=>1-Math.pow(1-x,3);

function createBentArmGeo(len,s,furCol,tipCol='#fff7ee'){
  const N=30,SEG=20,curve=t=>new T.Vector3(s*.03*Math.sin(Math.PI*t),-len*t,.02*Math.sin(Math.PI*t));
  const rad=t=>{let r=.105+.035*Math.exp(-(((t-.1)/.16)**2))+.04*Math.exp(-(((t-.8)/.13)**2));
    if(t<.06)r*=Math.sqrt(Math.max(0,1-((.06-t)/.06)**2));if(t>.9)r*=Math.sqrt(Math.max(0,1-((t-.9)/.1)**2));return r};
  const pos=[],col=[],idx=[],c1=new T.Color(furCol),c2=new T.Color(tipCol),cc=new T.Color(),ref=new T.Vector3(0,0,1);
  for(let i=0;i<=N;i++){const t=i/N,P=curve(t),Tn=curve(Math.min(1,t+.01)).sub(curve(Math.max(0,t-.01))).normalize();
    const Nn=new T.Vector3().crossVectors(Tn,ref).normalize(),Bn=new T.Vector3().crossVectors(Tn,Nn).normalize(),r=rad(t);
    cc.copy(c1).lerp(c2,sm(.68,.8,t));
    for(let j=0;j<=SEG;j++){const a=j/SEG*Math.PI*2,cx=Math.cos(a)*r,sy=Math.sin(a)*r;
      pos.push(P.x+Nn.x*cx+Bn.x*sy,P.y+Nn.y*cx+Bn.y*sy,P.z+Nn.z*cx+Bn.z*sy);col.push(cc.r,cc.g,cc.b)}}
  for(let i=0;i<N;i++)for(let j=0;j<SEG;j++){const a=i*(SEG+1)+j,b=a+SEG+1;idx.push(a,a+1,b,b,a+1,b+1)}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('color',new T.Float32BufferAttribute(col,3));
  g.setIndex(idx);g.computeVertexNormals();g.userData.end=curve(.8);return g}

// Rounded-box torso (super-ellipsoid) that tapers towards the shoulders: less round, more "plush toy"
function createTorsoGeo(){
  const g=new T.SphereGeometry(1,56,40),p=g.attributes.position;
  const sp=(v,e)=>Math.sign(v)*Math.pow(Math.abs(v),e),E1=2.7,E2=2.4;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    const phi=Math.asin(Math.max(-1,Math.min(1,y))),th=Math.atan2(z,x);
    const cp=sp(Math.cos(phi),2/E1),sy=sp(Math.sin(phi),2/E1);
    let nx=cp*sp(Math.cos(th),2/E2),nz=cp*sp(Math.sin(th),2/E2);
    const t=(sy+1)/2,w=1-.26*sm(.1,1,t);
    const belly=nz>0?1+.06*(1-t):1;
    p.setXYZ(i,nx*w,sy,nz*w*belly);
  }
  g.computeVertexNormals();return g}

export function createCatAvatar(opt={}){
  const o=Object.assign({fur:COATS[0][0],pat:COATS[0][1],pattern:'classic',ears:'pointy',eyeColor:EYECS[0],collar:COLLARS[0],name:'Ming',cloak:'tattered',cloakC:CLOAK_COLS[0],collarType:'normal',head:'none',eyewear:'none',gearC:GEAR_COLS[0],eyeStyle:'classic',nose:'button',cheeks:'none',tail:'classic',whiskers:'classic'},opt);
  if(!COLLARS.includes(o.collar))o.collar=COLLARS[0];          // the collar can no longer be removed
  if(!COLLAR_TYPES.some(x=>x[0]===o.collarType))o.collarType='normal';
  if(!CLOAKS.some(x=>x[0]===o.cloak))o.cloak='tattered';
  if(!EARS.includes(o.ears))o.ears='pointy';
  if(!PATTERNS.some(p=>p[0]===o.pattern))o.pattern='classic';
  if(!EYE_STYLES.some(x=>x[0]===o.eyeStyle))o.eyeStyle='classic';
  if(!NOSES.some(x=>x[0]===o.nose))o.nose='button';
  if(!CHEEKS.some(x=>x[0]===o.cheeks))o.cheeks='none';
  if(!TAILS.some(x=>x[0]===o.tail))o.tail='classic';
  if(!WHISKERS.some(x=>x[0]===o.whiskers))o.whiskers='classic';
  const catGroup=new T.Group(),cat=new T.Group(),head=new T.Group(),S=.45,LY=-1.52,FY=0.96;cat.scale.setScalar(S);cat.position.y=FY;catGroup.add(cat);cat.add(head);const nCh=catGroup.children.length;shadow(catGroup,.6);const shM=catGroup.children[nCh]||null,shY=shM?shM.position.y:0,shS=shM?shM.scale.clone():null;   // the blob shadow stays on the ground while the cat jumps
  const acc=mat(o.pat),pink=mat('#ff9db8'),dark=BM('#2a1a14'),R=Math.PI/2;
  
  const coatMeshes=[];
  const CM=(geo,part,sc,pos,par)=>{const m=M(geo,makeCoat(o,part),sc,pos,par);coatMeshes.push(m);return m};
  CM(lumpy(new T.SphereGeometry(1,64,48),.03,0),0,[1.0,0.78,0.85],null,head);
  const body=CM(lumpy(createTorsoGeo(),.02,3),1,[.56,.62,.5],[0,-1.1,0],cat);

  const eyes=buildEyes(o.eyeStyle,o.eyeColor,o.fur,head);
  
  buildNose(o.nose,head);
  const cheeks=buildCheeks(o.cheeks,o,head);   // fur locks use the head's coat shader + rope physics
  if(cheeks){cheeks.meshes.forEach(m=>coatMeshes.push(m))}
  M(G.box,dark,[.016,.07,.016],[0,-.22,.75],head);
  [-1,1].forEach(s=>{const m=new T.Mesh(new T.TorusGeometry(.1,.018,6,16,Math.PI),dark);m.rotation.z=Math.PI;m.position.set(s*.1,-.28,.72);head.add(m)});

  const ropes=[];
  if(cheeks)cheeks.ropes.forEach(r=>ropes.push(r));
  buildWhiskers(o.whiskers,head).forEach(r=>ropes.push(r));      // whisker style: see catFeatures.js ('none' = no whiskers)  
  const ears=[],earRig=[],earMods=[];
  [-1,1].forEach(s=>{const g=new T.Group();g.position.set(s*.56,.5,.02);g.rotation.z=-s*.5;head.add(g);
    const sw=new T.Group();g.add(sw);const em=s<0?acc:mat(o.fur);
    const info=buildEar(o.ears,sw,em,pink);ears.push(g);if(info.ropes)info.ropes.forEach(r=>ropes.push(r));if(info.mods)info.mods.forEach(m=>earMods.push(m));
    earRig.push({s,sw,k:info.k,fl:info.fl,out:info.out,bx:info.bx,x:0,vx:0,z:0,vz:0,flick:2+Math.random()*4});sw.rotation.set(info.bx,0,-s*info.out)});

  // headwear + eyewear live on the head so they follow every head movement
  const hw=o.head==='hood'?null:buildHeadwear(o.head,o.gearC);if(hw)head.add(hw);   // the hood is cloth: created below once the collision volumes exist
  const ew=buildEyewear(o.eyewear,o.gearC);if(ew)head.add(ew);

  // collision volumes (cat-local ellipsoids: centre, radii) so cloth can never sink into the player. m = margin
  const BODY=m=>[[[0,-.95,0],[.5+m,.42+m,.44+m]],[[0,-1.35,0],[.62+m,.42+m,.54+m]]];   // upper torso + pear hips
  const LEGSC=m=>[-1,1].map(s=>[[s*.32,-1.73,0],[.22+m,.26+m,.24+m]]);
  // ---- Leather belt collar (rough leather, stitches, holes, studs, buckle): static, sits wide under the head ----
  const HEADC=m=>[[[0,0,0],[1+m,.78+m,.85+m]]];
  const belt=createBelt(cat,o.collar,{outer:[...BODY(.02),...HEADC(.03)],inner:[...BODY(-.02),...HEADC(0)]},o.collarType);   // cloth belt, same physics as the cloak
  // cloth-physics hood in the chosen gear colour (dome pinned to the head, neck drape + curled tip free)
  const hood=o.head==='hood'?createHood(head,{outer:o.gearC,inner:mix(o.gearC,'#000000',.55),trimC:mix(o.gearC,'#ffffff',.55),seamC:mix(o.gearC,'#ffffff',.3),coll:[...BODY(.05),...HEADC(.04)]}):null;
  // name plate: hangs from a gold ring on the bottom-centre of the collar (it follows the collar cloth every frame) and swings like a pendulum
  const tag=new T.Group();cat.add(tag);belt.anchor(tag.position);
  const GOLDM=new T.MeshStandardMaterial({color:'#e8b83a',roughness:.35,metalness:.85});
  const ring1=new T.Mesh(new T.TorusGeometry(.05,.012,8,18),GOLDM);ring1.position.y=-.035;ring1.rotation.y=R;tag.add(ring1);   // ring on the collar side
  const plate=new T.Group();plate.position.y=-.17;tag.add(plate);
  const ring2=new T.Mesh(new T.TorusGeometry(.04,.011,8,18),GOLDM);ring2.position.set(0,.15,0);plate.add(ring2);                 // ring on the plate, interlocked with ring1
  M(G.cyl,mat('#f2c44e',.4),[.15,.027,.15],[0,0,0],plate).rotation.x=R;
  const f=new T.Mesh(new T.CircleGeometry(.14,24),new T.MeshBasicMaterial({map:tagTex(o.name)}));f.position.set(0,0,.03);plate.add(f);
  const tagS={x:0,vx:0,z:0,vz:0};

  const WS=-1;
  const armGeos={'-1':createBentArmGeo(.5,-1,o.pat),'1':createBentArmGeo(.5,1,o.pat)}, legGeo=createLegGeo(.42,.14,.22,o.pat);
  const arm=s=>{const p=new T.Group();p.position.set(s*.47,-.76,.05);cat.add(p);CM(armGeos[s],2,[1,1,1],[0,0,0],p);return p};
  const leg=s=>{const p=new T.Group();p.position.set(s*.32,LY,0);cat.add(p);CM(legGeo,3,[1,1,1],[0,0,0],p);return p};
  const armL=arm(-1),armR=arm(1),legL=leg(-1),legR=leg(1);
  const wArm=WS<0?armL:armR,oArm=WS<0?armR:armL;

  const hand=new T.Group();hand.position.copy(armGeos[WS].userData.end);wArm.add(hand);
  // weapons are modules (js/weapons/*.js) built procedurally and equipped through U.equip(def)
  const wg=new T.Group();hand.add(wg);
  const hand2=new T.Group();hand2.position.copy(armGeos[-WS].userData.end);oArm.add(hand2);const wg2=new T.Group();hand2.add(wg2);
  let tip=new T.Object3D();wg.add(tip);
  let W=null,isGun=true,HD='pistol',dual=false,spear=false,great=false,shoulder=false,twoH=false,foreP=null,slashD=.5,wLean=0,supW=0,spearOff=0;
  const supM=new T.Matrix4(),supV=new T.Vector3(),supQ=new T.Quaternion(),DOWN=new T.Vector3(0,-1,0),reachO=armGeos[-WS].userData.end.length()||.42;
  const qCat=new T.Quaternion(),aimD=new T.Vector3(),aimU=new T.Vector3(),aX=new T.Vector3(),aY=new T.Vector3(),aZ=new T.Vector3(),mA=new T.Matrix4(),qAim=new T.Quaternion(),qKick=new T.Quaternion(),AXX=new T.Vector3(1,0,0);
  // blade trails (ribbon + sparks) follow the real blade of whatever melee weapon is equipped: one per hand
  const trA=new BladeTrail(catGroup),trB=new BladeTrail(catGroup),TCOL={woodensword:['#ffe9a8','#ffffff'],dualdagger:['#8fe8ff','#e8fbff'],spear:['#dcecff','#ffffff']};

  let cloth=null,lining=null,leaves=null;
  if(o.cloak!=='none'){
    const kind=kindOf(o.cloak),{cols,rows}=cloakShape(kind),P0={grav:15,stiff:.012};
    cloth=new Cloth(cat,cloakRest(kind,0,0),cols,rows,{...P0,coll:[...BODY(.04),...LEGSC(.03)],color:(r,c)=>cloakColor(kind,o.cloakC,r,c,rows)});
    lining=new Cloth(cat,cloakRest(kind,.07,.04),cols,rows,{...P0,coll:[...BODY(0),...LEGSC(0)],color:(r,c)=>cloakLining(kind,o.cloakC,r,rows)});
    if(kind==='leaves'){const lv=buildLeaves(cat,cols,rows,o.cloakC),P=(c,r)=>cloth.lp[r*cols+c];lv.place(P);leaves={lv,P}}
  }

  const tail=new T.Group();tail.position.set(0,LY,-.5);cat.add(tail);
  const tailCol=tailColor(o);
  const tf=buildTail(o.tail,tail,o);tf.ropes.forEach(r=>ropes.push(r));      // tail types: see catFeatures.js

  let time=0,walk=0,amp=0,stop=0,wasMv=false,bl=0,bt=2;
  let rv=0,rvel=0,fireW=0,aimW=0,scopeOn=false,wpn=1,swapT=0,aimP=0,aimPT=0,aimOn=false,rdy=0,hTrk=0,gW=0;
  let slashT=-1,combo=0,hvStep=0,hvKind=0,hvIdle=9,hvAnim=null,hvFired=[],hvPose=null,hvW=0,wa=null,stA=null,stT=0,stPose=null,stW=0,xf=null,xfT=1,swingSnd=false,hitDone=false,tumT=-1,tumF=1,tumS=0,landSq=0;
  let jumpS=0,airH=0,airV=0,airW=0,dashT=-1,dashF=1,dashS=0;   // jump / air dash state (fed by the game through U.setAir / U.jump / U.land / U.airDash)
  const TUMBLE_D=.55,bs=body.scale.clone(),pivot=new T.Vector3(0,-1.0*S,0),eul=new T.Euler(),pv=new T.Vector3();
  const U=catGroup.userData;U.move={f:0,s:0};
  U.kick=(p=1)=>{if(!isGun)return;rvel+=15*p;fireW=1};
  U.equip=def=>{
    while(wg.children.length)wg.remove(wg.children[0]);while(wg2.children.length)wg2.remove(wg2.children[0]);
    W=def;isGun=def.kind==='gun';HD=def.handling;dual=HD==='dual';spear=HD==='spear';great=!!def.great;shoulder=def.great==='shoulder';const fr=def.fore||(great?[-.2,0]:null);twoH=!!fr;wLean=def.lean||0;
    slashD=(def.stats&&def.stats.dur)||.5;wa=animsFor(def);   // see animsFor(): own animations, else the ones of its type (normal / heavy / dual / longblade)
    hvAnim=null;hvPose=null;hvW=0;stA=null;stPose=null;stW=0;xf=null;foreP=fr?new T.Vector3(0,-fr[0],fr[1]):null;
    const b=def.build();wg.add(b.group);tip=b.tip||new T.Object3D();if(!b.tip)wg.add(tip);if(b.off)wg2.add(b.off);
    trA.clear();trB.clear();if(!isGun){const tc=TCOL[def.id]||['#fff3c4','#ffffff'];const bo=dual?{w:1.5,sp:1.3,a:1.15}:{w:1.15,sp:.9};trA.setBlade(wg,tc[0],tc[1],bo);if(dual&&b.off)trB.setBlade(wg2,'#c9a0ff','#f4ecff',bo)}
    swapT=1;slashT=-1;hitDone=false;wg.position.set(0,0,0);oArm.scale.y=1;
  };
  U.weapon=()=>W;
  U.animSounds=animSounds;if(globalThis.__audioPreload)globalThis.__audioPreload(animSounds());   // decode this cat's event sounds ahead of time
  // ---- crowd LOD hooks (used by the 5v5 mode): real shadow casting only for nearby cats (the sun's shadow pass draws every caster a 2nd time),
  // and the tiny detail meshes (studs, stitches, eyes, nose ...) hidden on far cats. Weapon parts are never hidden.
  let detailList=null;
  const inWeapon=o=>{for(let p=o;p&&p!==catGroup;p=p.parent)if(p===hand||p===hand2)return true;return false};
  U.setShadow=on=>catGroup.traverse(o=>{if(!o.isMesh)return;if(o.userData.cs===undefined)o.userData.cs=o.castShadow;o.castShadow=on&&o.userData.cs});
  U.setDetail=on=>{
    if(!detailList){detailList=[];catGroup.updateMatrixWorld(true);const bb=new T.Box3(),sz=new T.Vector3();
      catGroup.traverse(o=>{if(!o.isMesh||!o.visible||!o.geometry||inWeapon(o))return;bb.setFromObject(o);bb.getSize(sz);if(sz.length()<.12)detailList.push(o)})}
    for(const m of detailList)m.visible=on};
  U.setScope=b=>{scopeOn=!!b};
  // crosshair following: pitch = look-up angle of the crosshair (radians, + is up); on = in gameplay (gun ready, head tracks)
  U.setAim=(pitch,on)=>{aimOn=!!on;aimPT=on?Math.max(-.55,Math.min(.6,pitch)):0};
  // melee: one swing per press, hands alternate (dual blades: left, right, left ...). U.onSlashHit(dd) is called when the blade connects.
  U.slash=()=>{if(isGun||slashT>=0||tumT>=0)return false;slashT=0;hitDone=false;swingSnd=false;combo^=1;hvAnim=null;if(wa&&!U.rawProc&&wa.chain.length){if(hvIdle>1.6)hvStep=0;hvKind=hvStep%wa.chain.length;hvStep=(hvKind+1)%wa.chain.length;hvAnim=wa.anims[wa.chain[hvKind]];hvFired=[]}return true};   // U.onSwing(name,idx) fires when the REAL swing starts: put the slash SFX there
  U.tumble=(f,s)=>{if(tumT>=0)return false;tumT=0;tumF=f;tumS=s;slashT=-1;return true};
  U.setAir=(h,vy)=>{airH=h;airV=vy};U.jump=()=>{jumpS=1};U.land=(p=1)=>{landSq=Math.max(landSq,.3+.7*p)};U.airDash=(f,s)=>{dashT=0;dashF=f;dashS=s;slashT=-1};U.isAirDashing=()=>dashT>=0;
  U.walkPhase=()=>walk;U.isTumbling=()=>tumT>=0;U.isSlashing=()=>slashT>=0;U.scope=()=>aimW;U.recoil=()=>rv;
  U.muzzle=v=>tip.getWorldPosition(v||new T.Vector3());U.holster=b=>{hand.visible=!b;hand2.visible=!b};

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
      r.flick-=dt;if(r.flick<=0){r.flick=3+Math.random()*5;r.vz+=(Math.random()-.5)*9*r.fl;r.vx+=(Math.random()-.5)*5*r.fl}
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

  U.update=(dt,mv,rel=1)=>{
    time+=dt;const rolling=tumT>=0,slashing=slashT>=0;if(slashing)hvIdle=0;else hvIdle+=dt;
    // ---- attack animations from WEAPON_ANIMS (made in the animation maker): advances time, fires events (sound / hit) and samples the pose
    // ---- animation-maker override: U.pose = {wX,wZ,oX,oZ,wrist,wrist2,roll,bodyX,bodyY,bodyZ,lift,legLx,legRx,legLz,legRz,headX,headY,headZ,grip,trail} (any key may be missing = keep the procedural value), U.poseW = blend weight 0..1 (default 1); the maker's live preview always wins over the stored animations
    if(slashing&&hvAnim){
      slashT+=dt;const A=hvAnim,fps=A.fps*HV_SPEED,fr=Math.min(A.frames-1,slashT*fps),K=hvKind,look=(Math.min(dt,.05)+.004)*fps;   // look = one display frame ahead, in animation frames
      A.events.forEach((e,i)=>{
        const sw=e.name==='swing';if(hvFired[i]||e.f>fr+(sw||e.sfx?look:0))return;hvFired[i]=1;   // swing / sound events fire up to one frame EARLY and pass the remaining delay, so sound lands on the exact frame
        if(sw){swingSnd=true;if(U.onSwing)U.onSwing(wa.chain[K],K,Math.max(0,(e.f-fr)/fps))}
        else if(e.name==='hit'){hitDone=true;if(A.dir===0)landSq=Math.max(landSq,.8);if(U.onSlashHit)U.onSlashHit(A.dir!==undefined&&A.dir!==0?A.dir:0)}   // dir: 1 / -1 = side, 0 = overhead slam (also squashes the landing)
        {const snd=U.onAnimSfx||globalThis.__animSfx;if(e.sfx&&snd)snd(e.sfx,{vol:e.vol,pitch:e.pitch,skip:e.skip,delay:Math.max(0,(e.f-fr)/fps)},e.name,K)}   // audio.js sets globalThis.__animSfx for every cat; U.onAnimSfx overrides it for one cat
        if(U.onAnimEvent)U.onAnimEvent(e.name,K)});
      hvPose=samplePose(A,fr);if(fr>=A.frames-1)slashT=-1}
    {const on=slashT>=0&&hvAnim?1:0,r=dt/HV_FADE;hvW+=Math.max(-r,Math.min(r,on-hvW));if(hvW<=0&&!on)hvPose=null}
    let PO=null,pw=0;const ov=(c,k)=>PO&&PO[k]!==undefined?lerp(c,PO[k],pw):c;
    // ---- air state: airW eases 0 -> 1 while off the ground, vN = vertical speed (+ rising, - falling), dW = air dash pose weight
    airW+=((airH>.04?1:0)-airW)*ease(dt,airH>.04?22:16);const vN=Math.max(-1.4,Math.min(1.2,airV/7.8));jumpS=Math.max(0,jumpS-dt*4.5);
    let dW=0;if(dashT>=0){dashT+=dt;const u=Math.min(1,dashT/.3);dW=sm(0,.14,u)*(1-sm(.72,1,u));if(dashT>=.3)dashT=-1}
    if(shM){shM.position.y=shY-airH;shM.scale.copy(shS).multiplyScalar(1-.3*Math.min(1,airH/1.6))}
    amp+=((mv&&!rolling?1:0)-amp)*ease(dt,mv?9:7);
    walk+=dt*(6+9*amp)*amp*(rel<-.2?-1:1)*(dual?1+.25*gW:1)*(great?(shoulder?1-.05*gW:1+.22*gW):1);   // ninja-run blades are quick, shoulder-carried heavy weapons a touch slower
    if(wasMv&&!mv)stop=1;if(mv)stop=0;wasMv=mv;stop=Math.max(0,stop-dt*1.7);
    rvel+=(-170*rv-13*rvel)*dt;rv+=rvel*dt;
    fireW=Math.max(0,fireW-dt*2.2);swapT=Math.max(0,swapT-dt*3);landSq=Math.max(0,landSq-dt*5);
    aimW+=(((scopeOn&&isGun&&!rolling&&!slashing)?1:0)-aimW)*ease(dt,12);
    aimP+=(aimPT-aimP)*ease(dt,16);hTrk+=((aimOn&&!rolling?1:0)-hTrk)*ease(dt,8);
    rdy+=(((aimOn&&isGun&&!rolling&&!slashing)?1:0)-rdy)*ease(dt,10);   // gun stays raised and pointed at the crosshair
    const pW=isGun?Math.max(aimW,Math.min(1,fireW*3),rdy):0,aW=isGun?Math.max(aimW,rdy*.8):0;
    gW+=(((aimOn&&!rolling)?1:0)-gW)*ease(dt,10);   // melee guard poses only while playing (arms rest in the maker / menus)
    supW+=(((twoH&&!rolling)?(isGun?rdy:gW*(great?(slashing?1:0):1)):0)-supW)*ease(dt,12);   // support hand on the foregrip / shaft
    const GP=great?(shoulder?GREAT.shoulder:GREAT.blade):null,nj=(dual||(great&&!shoulder))?amp*gW:0,dLean=dual?gW*(DUAL.lean+DUAL.runLean*amp):great?gW*(GP.lean+GP.runLean*amp):0,dStance=dual?gW*(1-amp):0,gStand=great?gW*(1-amp):0,gTw=great?gStand*GP.twist:0;   // ninja-run blend, forward lean, standing-stance blend
    {const hvOn=hvW>0&&hvAnim&&slashT>=0,want=rolling||hvOn||!wa||U.rawProc?null:dW>0?'dash':airW>.35?'air':amp>.25?'run':'idle',SA=want&&wa.state[want]?wa.anims[wa.state[want]]:null;
      if(SA!==stA){xf=stPose&&stW>0?mixPose(stPose,stPose,0):null;xfT=0;stA=SA;stT=0}
      if(SA){stT+=dt;const n=SA.frames-1,fr=want==='run'?(((walk/TAU2)%1+1)%1)*n:SA.loop?(stT*SA.fps)%n:Math.min(n,stT*SA.fps);   // run is phase-locked to the footsteps, so speed follows movement
        stPose=samplePose(SA,fr)}
      xfT=Math.min(1,xfT+dt/.12);const r2=dt/.1;stW+=Math.max(-r2,Math.min(r2,(SA?1:0)-stW));if(stW<=0&&!SA){stPose=null;xf=null}
      const sp=stPose&&xf&&xfT<1?mixPose(xf,stPose,xfT):stPose;
      PO=U.pose||(hvW>0?hvPose:(stW>0?sp:null));pw=PO?(U.pose?(U.poseW===undefined?1:U.poseW):hvW>0?hvW:stW):0}
    const sw=Math.sin(walk),cs=Math.cos(walk),sk=stop*stop,wob=Math.sin((1-stop)*Math.PI*3)*sk,br=Math.sin(time*2.2);
    const lean=.2*amp-.1*sk+wob*.08,ph=s=>s<0?-sw:sw;

    const st=.95+.4*nj,spl=dual?DUAL.splay*gW*(1-amp*.4):great?GP.splay*gStand:0;legL.rotation.x=sw*st*amp+sk*.4;legR.rotation.x=-sw*st*amp-sk*.3;legL.rotation.z=-spl;legR.rotation.z=spl;
    legL.position.y=LY+Math.max(0,cs)*.14*amp;legR.position.y=LY+Math.max(0,-cs)*.14*amp;
    if(airW>.001){const r=sm(-.25,.9,vN);   // rising: knees tucked up; falling: legs reach down for the ground
      legL.rotation.x=lerp(legL.rotation.x,lerp(-.15,-1.15,r),airW);legR.rotation.x=lerp(legR.rotation.x,lerp(.25,-.65,r),airW);
      legL.position.y=lerp(legL.position.y,LY+.1*r,airW);legR.position.y=lerp(legR.position.y,LY+.14*r,airW)}
    if(dW>0){legL.rotation.x=lerp(legL.rotation.x,.85,dW);legR.rotation.x=lerp(legR.rotation.x,.6,dW)}   // air dash: legs trail behind
    if(PO){legL.rotation.x=ov(legL.rotation.x,'legLx');legR.rotation.x=ov(legR.rotation.x,'legRx');legL.rotation.z=ov(legL.rotation.z,'legLz');legR.rotation.z=ov(legR.rotation.z,'legRz')}

    const tilt=.24+amp*.06+br*.015;
    let wX=ph(WS)*.35*amp-br*.015-swapT*.5,wZ=WS*tilt,oX=ph(-WS)*.9*amp+br*.02,oZ=-WS*(tilt+.04);
    wX=lerp(wX,-1.45,pW)-rv*.55;wZ=lerp(wZ,-WS*.1,pW);
    oX=lerp(oX,-1.15,aW)-rv*.22-aimP*aW;oZ=lerp(oZ,WS*.55,aW);
    // handling poses for the melee types
    if(dual){ // wide stance: arms spread so the blades stay clear of the body and visible; running: ninja style, arms swept back with the blades trailing
      const sx=lerp(DUAL.wX,DUAL.runX+ph(WS)*.12,amp),sz=lerp(DUAL.wZ,DUAL.runZ,amp),ox=lerp(DUAL.oX,DUAL.runX+ph(-WS)*.12,amp),oz=lerp(DUAL.oZ,DUAL.runZ*.9,amp);
      wX=lerp(wX,sx,gW);wZ=lerp(wZ,WS*sz,gW);oX=lerp(oX,ox,gW);oZ=lerp(oZ,-WS*oz,gW)}
    else if(spear){wX=lerp(wX,-1.0+ph(WS)*.1*amp,gW);wZ=lerp(wZ,-WS*.12,gW);oX=lerp(oX,-1.0,gW);oZ=lerp(oZ,WS*.2,gW)}
    else if(great){ // long / heavy weapons
      if(shoulder){ // weapon rests on the shoulder, identical arm pose standing and running (the free arm keeps its normal run swing)
        wX=lerp(wX,wX+GP.x,gW);wZ=lerp(wZ,WS*(GP.z+.04*amp),gW)}   // normal melee arm swing / stance, but the main arm is held a bit back (samurai style) and spread wide
      else{ // blade: iai ready standing, ninja run (arms swept back)
        const nx=GREAT.runX+ph(WS)*.12,nox=GREAT.runX+ph(-WS)*.12;
        wX=lerp(wX,lerp(GP.x,nx,amp),gW);wZ=lerp(wZ,WS*lerp(GP.z,GREAT.runZ,amp),gW);oX=lerp(oX,lerp(GP.offX,nox,amp),gW);oZ=lerp(oZ,-WS*lerp(GP.offZ,GREAT.runZ*.9,amp),gW)}}
    if(airW>.001){const fa=airW*(1-pW)*(dual||spear||great?.35:1);   // in the air the arms fly up and out (guns keep their aim, blades keep most of their guard)
      wX=lerp(wX,-1.75+vN*.15,fa);wZ=lerp(wZ,WS*.75,fa);oX=lerp(oX,-1.75+vN*.15,fa*(1-aW));oZ=lerp(oZ,-WS*.75,fa)}
    if(dW>0){wX=lerp(wX,.9,dW*.9);oX=lerp(oX,.9,dW*.9);wZ=lerp(wZ,WS*.25,dW);oZ=lerp(oZ,-WS*.25,dW)}   // air dash: arms swept back
    let swr=dual?lerp(-.85,lerp(DUAL.blade,DUAL.runBlade,amp),gW):spear?0:great?lerp(-.75,shoulder?GP.sw:lerp(GP.sw,GREAT.runBlade,amp),gW):-.75,swr2=dual?lerp(-.85,lerp(DUAL.blade2,DUAL.runBlade,amp),gW):-.85,twist=0,fwd=0;spearOff=0;
    let swA=false,swB=false,lunge=0,lungeSide=1,jmp=0,gRoll=shoulder?gW:0,hroll=0,spin=0,bend=0;
    if(slashing&&hvAnim){}   // attacks that have a stored animation (WEAPON_ANIMS) are played by the keyframe player above; no procedural pose here
    else if(slashing){
      const SD=slashD;slashT+=dt;const t=slashT/SD,wind=sm(0,.28,t),swing=e3(rg(.26,.46,t)),over=sm(.46,.56,t)*(1-sm(.56,.72,t)),rec=sm(.62,1,t),d=combo?1:-1;
      // ONE swing for every melee (sword, spear, dual blades with alternating hands): wind-up, a fast eased cut with overshoot, then settle
      const useO=dual&&combo===1,dd=dual?(useO?1:-1):d,bx=useO?oX:wX,bz=useO?oZ:wZ,env=wind*(1-rec),bz2=dual?lerp(bz,dd*.3,env):bz,bx2=dual?lerp(bx,-.85,env):bx;     // dual (the wide stance is eased toward a normal guard while swinging, so the raise + cut read like the sword): outward = away from the body, so each hand winds up outward and cuts across the front
      let ax=lerp(bx2,-2.75,wind);ax=lerp(ax,-.25,swing);ax=lerp(ax,-.05,over*.5);ax=lerp(ax,bx,rec);
      let az=bz2+dd*(.75*wind-1.6*swing-.12*over);az=lerp(az,bz,rec);
      const base=useO?swr2:swr;let sr=lerp(base,0,wind);sr=lerp(sr,-.25,swing);sr=lerp(sr,base,rec);
      if(useO){oX=ax;oZ=az;swr2=sr}else{wX=ax;wZ=az;swr=sr;if(!dual)oX=lerp(oX,.5,wind*(1-rec))}
      if(dual){const k2=1-rec,oi=-dd;if(useO){wX+=.55*wind*k2;wZ-=oi*.5*swing*k2}else{oX+=.55*wind*k2;oZ-=oi*.5*swing*k2}}   // the free hand counter-swings (pulls back + in) like the sword's off-hand
      const gm=great?1.25:1;gRoll*=1-env;   // the shoulder-carried weapon turns edge-first for the cut
      twist=gm*dd*(wind*.4-swing*.95+over*.1)*(1-rec);fwd=gm*(swing*(1-rec)*.3-wind*(1-swing)*.12);   // heavier weapons commit more body into the cut; lean back in the wind-up, lunge into the cut
      lunge=swing*(1-rec)-wind*(1-swing)*.35;lungeSide=dd;
      if(t>.22&&!swingSnd){swingSnd=true;if(U.onSwing)U.onSwing('slash',-1)}
      if(t>(dual?.33:.38)&&!hitDone){hitDone=true;if(U.onSlashHit)U.onSlashHit(dd)}
      swA=t>.2&&t<.74&&!useO;swB=t>.2&&t<.74&&useO;
      if(t>=1)slashT=-1;
    }
    if(lunge!==0&&!rolling){const f=Math.max(-.3,lunge);legR.rotation.x-=f*(lungeSide>0?.55:.25);legL.rotation.x-=f*(lungeSide>0?.25:.55)}   // step into the cut
    if(PO){wX=ov(wX,'wX');wZ=ov(wZ,'wZ');oX=ov(oX,'oX');oZ=ov(oZ,'oZ');swr=ov(swr,'wrist');swr2=ov(swr2,'wrist2');hroll=ov(hroll,'roll');supW=ov(supW,'grip');if(PO.trail>.5&&pw>.5){swA=true;if(dual)swB=true}}
    wg.rotation.set(isGun?lerp(-.55,0,pW)+rv*.15:swr,(shoulder?GP.roll*gRoll:0)+hroll,0);wg2.rotation.x=swr2;wg.position.set(0,spearOff,0);
    wArm.rotation.x=wX;wArm.rotation.z=wZ;oArm.rotation.x=oX;oArm.rotation.z=oZ;

    let rx=lean+fwd-rv*.14+aimW*.05-aimP*.12*Math.max(pW,hTrk*.5)+wLean*pW+dLean,rz=-U.move.s*.1*amp-dStance*.1-gStand*.05+bend,ry=twist+spin+sw*.08*amp+dStance*DUAL.twist+gTw,tuck=0,rollA=0;
    rx+=airW*(-vN)*.22;   // nose up while rising, nose down while falling
    if(dW>0){if(Math.abs(dashF)>=Math.abs(dashS))rx+=(dashF>=0?1:-1)*dW*1.0;else rz+=(dashS>=0?1:-1)*dW*1.0}   // air dash: the body dives in the dash direction
    if(PO){rx=ov(rx,'bodyX');ry=ov(ry,'bodyY');rz=ov(rz,'bodyZ');jmp=ov(jmp,'lift')}
    if(rolling){
      tumT+=dt;const u=Math.min(1,tumT/TUMBLE_D),e=u*u*(3-2*u);rollA=e*Math.PI*2;
      const fw=Math.abs(tumF)>=Math.abs(tumS);
      if(fw)rx=(tumF>=0?1:-1)*rollA;else rz=(tumS>=0?1:-1)*rollA;
      tuck=sm(0,.18,u)*(1-sm(.78,1,u));
      legL.rotation.x=legR.rotation.x=-1.25*tuck;oArm.rotation.x=wArm.rotation.x=-.95*tuck;
      oArm.rotation.z=-WS*.45*tuck;wArm.rotation.z=WS*.45*tuck;
      if(tumT>=TUMBLE_D){tumT=-1;landSq=1}
    }
    const hop=rolling?Math.sin(Math.min(1,tumT/TUMBLE_D)*Math.PI)*.1:0;
    eul.set(rx,ry,rz,'XYZ');
    if(isGun&&pW>.01&&!rolling){ // gun arm aims exactly along the crosshair line (barrel follows the look angle)
      qCat.setFromEuler(eul).invert();aimD.set(0,Math.sin(aimP),Math.cos(aimP)).applyQuaternion(qCat);aimU.set(0,1,0).applyQuaternion(qCat);
      aimU.addScaledVector(aimD,-aimU.dot(aimD)).normalize();aY.copy(aimD).negate();aZ.copy(aimU);aX.crossVectors(aY,aZ);
      qAim.setFromRotationMatrix(mA.makeBasis(aX,aY,aZ));wArm.quaternion.slerp(qAim,pW);
      qKick.setFromAxisAngle(AXX,-rv*.55);wArm.quaternion.multiply(qKick);
    }
    if(supW>.01&&!rolling&&foreP){ // support hand reaches the foregrip / spear shaft (arm stretches a little if needed)
      wArm.updateMatrix();hand.updateMatrix();wg.updateMatrix();
      supM.copy(wArm.matrix).multiply(hand.matrix).multiply(wg.matrix);
      supV.copy(foreP).applyMatrix4(supM).sub(oArm.position);const len=supV.length()||1;supV.divideScalar(len);
      supQ.setFromUnitVectors(DOWN,supV);oArm.quaternion.slerp(supQ,supW);
      oArm.scale.y=lerp(1,Math.max(.75,Math.min(1.8,len/reachO)),supW);
    }else oArm.scale.y=1;
    cat.rotation.copy(eul);pv.copy(pivot).applyEuler(eul);
    cat.position.set(0,FY+Math.abs(cs)*.1*amp*(1-airW)+br*.012*(1-amp)+(pivot.y-pv.y)+hop+jmp-landSq*.05-(dual?gW*(DUAL.crouch-.03*amp):great?gStand*GP.crouch:0),(pivot.z-pv.z)-rv*.1);
    const sq=1-.16*tuck-.1*landSq;
    const stY=1+.16*jumpS+.05*airW*Math.abs(vN),stX=1-.07*jumpS-.025*airW*Math.abs(vN);   // stretch on takeoff and when falling fast
    cat.scale.set(S*stX*(1+.07*sk+.1*tuck+.08*landSq),S*stY*(sq-.1*sk-Math.abs(cs)*.025*amp+br*.01*(1-amp)),S*stX*(1+.07*sk+.1*tuck+.08*landSq));
    body.scale.set(bs.x*(1+rv*.06),bs.y*(1-rv*.05),bs.z*(1+rv*.06));body.rotation.z=sw*.06*amp;
    head.rotation.x=-lean*.8+sk*.12+rv*.2+aimW*.12+tuck*.5-fwd*.4-aimP*.85*hTrk-dLean*.85;   // head looks where the crosshair points
    head.rotation.y=Math.sin(time*.6)*.18*(1-amp)*(1-sk)*(1-pW)-twist*.5-dStance*.2-gTw*.9;
    head.rotation.z=Math.sin(time*.8)*.04+sw*.05*amp;
    if(PO){head.rotation.x=ov(head.rotation.x,'headX');head.rotation.y=ov(head.rotation.y,'headY');head.rotation.z=ov(head.rotation.z,'headZ')}
    ears.forEach((e,i)=>e.rotation.x=-amp*.35+sk*.35-rv*.5+airW*(-vN)*.4+Math.sin(time*3+i*2)*.03);
    tail.rotation.x=-.55*amp-.35*nj+sk*.45+rv*.6+airW*(.3-.35*vN);tail.rotation.y=Math.sin(time*(2.5+6*amp))*(.3+.15*amp)+wob*.7;
    bt-=dt;if(bt<=0){bl=.15;bt=2+Math.random()*2.5}bl=Math.max(0,bl-dt);eyes.forEach(e=>e.scale.y=bl>0?.1:(1+rv*.06));
    ropes.forEach(r=>r.step(dt));if(cloth){cloth.step(dt);lining.step(dt);if(leaves)leaves.lv.place(leaves.P)}tf.update();earMods.forEach(f=>f());
    earPhysics(dt);belt.step(dt);belt.anchor(tag.position);if(hood)hood.step(dt);
    trA.update(dt,swA);trB.update(dt,swB);
    if(U.wantOut)U.out={wX,wZ,oX,oZ,wrist:swr,wrist2:swr2,roll:hroll,grip:supW,bodyX:rx,bodyY:ry,bodyZ:rz,lift:jmp,legLx:legL.rotation.x,legRx:legR.rotation.x,legLz:legL.rotation.z,legRz:legR.rotation.z,headX:head.rotation.x,headY:head.rotation.y,headZ:head.rotation.z,trail:(swA||swB)?1:0};   // read by the animation maker to turn the built-in motion into editable keyframes
  };
  catGroup.updateMatrixWorld(true);bindCoat(cat,coatMeshes);
  return catGroup;
}
