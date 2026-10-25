// animPlayer.js - shared by animation_maker.html and the game.
// An animation (as saved by the maker) looks like:
//   { name, fps, frames, loop, groups:{arms,weapon,body,legs,head}, keys:[{f, ease, pose:{...}}], events:[{f, name}] }
// - keys: key poses on frame numbers; `ease` is how the pose blends INTO THE NEXT key (linear | smooth | in | out | inOut | hold)
// - groups: a group set to false is left to the game's normal procedural animation (e.g. legs keep running)
// - events: named markers (swing, hit, ...) fired while playing; map your sound effects / damage to these.
//
// In the game:
//   import {AnimPlayer} from './animPlayer.js';
//   const ap = new AnimPlayer(cat.userData);                  // cat = createCatAvatar(...)
//   const data = await (await fetch('animations.json')).json();
//   ap.play(data.weapons.axe.animations.smash, {onEvent: n => { if (n==='swing') sfxSwing(); if (n==='hit') dealDamage(); }});
//   // every frame, BEFORE cat.userData.update(dt, moving):   ap.update(dt);

export const GROUPS=[['arms','Arms'],['weapon','Weapon & wrist'],['body','Body'],['legs','Legs'],['head','Head']];

// [key, label, group, min, max, default]   (arms: "main" = the weapon arm, which is the cat's own right arm; negative spread = outwards for the main arm)
export const PARAMS=[
  ['wX','Main arm swing (- = forward/up)','arms',-3.6,3.6,0],
  ['wZ','Main arm spread (- = out)','arms',-2.2,2.2,-.24],
  ['oX','Off arm swing','arms',-3.6,3.6,0],
  ['oZ','Off arm spread (+ = out)','arms',-2.2,2.2,.28],
  ['wrist','Wrist angle','weapon',-3.6,3.6,-.75],
  ['wrist2','Off-hand wrist (dual blades)','weapon',-3.6,3.6,-.85],
  ['roll','Weapon roll (edge direction)','weapon',-3.2,3.2,0],
  ['grip','Off hand grips the shaft','weapon',0,1,0],
  ['bodyX','Lean (+ forward)','body',-1.5,1.5,0],
  ['bodyY','Turn (+ = to the left)','body',-7,7,0],
  ['bodyZ','Bend (+ = to the right)','body',-1.5,1.5,0],
  ['lift','Lift / crouch','body',-.5,1,0],
  ['legLx','Main-side leg swing','legs',-1.6,1.6,0],
  ['legRx','Other leg swing','legs',-1.6,1.6,0],
  ['legLz','Main-side leg splay','legs',-.8,.8,0],
  ['legRz','Other leg splay','legs',-.8,.8,0],
  ['headX','Head tilt (+ down)','head',-1,1,0],
  ['headY','Head turn','head',-1.6,1.6,0],
  ['headZ','Head roll','head',-.8,.8,0],
  ['trail','Blade trail on','fx',0,1,0]
];
export const STEPPED=new Set(['trail']);   // these switch at the next key instead of blending

export const EASE={
  linear:t=>t,
  smooth:t=>t*t*(3-2*t),
  in:t=>t*t*t,
  out:t=>1-Math.pow(1-t,3),
  inOut:t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2,
  hold:t=>t<1?0:1
};

export const defaultPose=()=>{const p={};for(const q of PARAMS)p[q[0]]=q[5];return p};

// pose at (fractional) frame `fr`. all=true returns every parameter, otherwise parameters of disabled groups are left out.
export function samplePose(anim,fr,all=false){
  const ks=anim.keys;if(!ks||!ks.length)return all?defaultPose():{};
  const s=[...ks].sort((a,b)=>a.f-b.f);let a=s[0],b=s[0];
  if(fr>=s[s.length-1].f){a=b=s[s.length-1]}
  else if(fr>s[0].f){for(let i=0;i<s.length-1;i++)if(fr>=s[i].f&&fr<s[i+1].f){a=s[i];b=s[i+1];break}}
  const e=a===b?0:(EASE[a.ease]||EASE.smooth)((fr-a.f)/(b.f-a.f)),out={};
  for(const [k,,g,,,d] of PARAMS){
    if(!all&&g!=='fx'&&anim.groups&&anim.groups[g]===false)continue;
    const va=a.pose[k]===undefined?d:a.pose[k],vb=b.pose[k]===undefined?d:b.pose[k];
    out[k]=STEPPED.has(k)?(a===b||fr<b.f?va:vb):va+(vb-va)*e;
  }
  return out;
}

export class AnimPlayer{
  constructor(U){this.U=U;this.anim=null;this.t=0;this.w=0;this.target=0;this.speed=1;this.fade=.06;this.onEvent=null;this.onEnd=null;this._last=-1}
  get playing(){return !!this.anim&&this.target>0}
  play(anim,o={}){this.anim=anim;this.t=0;this._last=-1;this.target=1;this.speed=o.speed||1;this.fade=o.fade===undefined?.06:o.fade;this.onEvent=o.onEvent||null;this.onEnd=o.onEnd||null;this.ended=false}
  stop(){this.target=0}
  update(dt){
    const A=this.anim;if(!A)return;
    if(this.target>0){
      this.t+=dt*this.speed;const last=A.frames-1;let fr=this.t*A.fps;
      if(this.onEvent&&A.events)for(const e of A.events)if(e.f>this._last&&e.f<=fr)this.onEvent(e.name,e);
      this._last=fr;
      if(fr>=last){
        if(A.loop){this.t=0;this._last=-1;fr=0}
        else{fr=last;if(!this.ended){this.ended=true;this.target=0;if(this.onEnd)this.onEnd()}}
      }
      this._fr=fr;
    }
    const rate=dt/Math.max(.001,this.fade);
    this.w+=Math.max(-rate,Math.min(rate,this.target-this.w));
    if(this.w<=0&&this.target<=0){this.U.pose=null;this.U.poseW=1;this.anim=null;return}
    this.U.pose=samplePose(A,this._fr===undefined?0:this._fr);this.U.poseW=this.w;
  }
}

// ---- starter animations (the heavy weapon chain, rebuilt as keyframes so you can edit them)
const P=o=>Object.assign(defaultPose(),o),K=(f,o,ease='smooth')=>({f,ease,pose:P(o)});
const mk=(name,frames,keys,events)=>({name,fps:30,frames,loop:false,groups:{arms:true,weapon:true,body:true,legs:false,head:false},keys,events});
const SW={wX:-1.5,wZ:-1.8,wrist:-.15,roll:-1.57,bodyY:-.9,bodyX:-.2,bodyZ:.4,trail:1},SW2={wX:-1.5,wZ:1.35,wrist:-.15,roll:-1.57,bodyY:1,bodyX:.4,bodyZ:-.55};
const SM1={wX:-2.5,wZ:-.8,wrist:-.6,bodyX:-.3,bodyZ:.3,lift:.1},SM2={wX:-1,wZ:-.2,wrist:-.3,bodyX:.6,bodyZ:-.12};
export const STARTERS={heavy:()=>({
  sweep:mk('sweep',36,[K(0,{}),K(10,{wX:-.8,wZ:-1,wrist:-.4,roll:-.8,bodyY:-.45,bodyZ:.2,bodyX:-.1}),K(18,SW),K(22,{...SW2,trail:1}),K(24,{...SW2,wZ:1.47,trail:1}),K(27,SW2),K(35,{})],[{f:17,name:'swing'},{f:20,name:'hit'}]),
  smash:mk('smash',36,[K(0,{}),K(10,{wX:-1.4,wZ:-.5,wrist:-.8,bodyX:-.15,bodyZ:.15,lift:.05}),K(18,SM1),K(21,{...SM2,trail:1}),K(24,{...SM2,wX:-.85,trail:1}),K(27,SM2),K(35,{})],[{f:17,name:'swing'},{f:20,name:'hit'}]),
  spin:mk('spin',39,[K(0,{}),K(12,{wX:-.9,wZ:-.8,wrist:-.4,roll:-.8,bodyY:-.45,bodyZ:.12}),K(20,{wX:-1.45,wZ:-1.3,wrist:-.15,roll:-1.57,bodyY:-.9,bodyZ:.25,trail:1}),K(24,{wX:-1.45,wZ:-.45,wrist:-.15,roll:-1.57,bodyY:2.6,bodyZ:.1,lift:.12,trail:1}),K(28,{wX:-1.45,wZ:.4,wrist:-.15,roll:-1.57,bodyY:6.08,trail:1}),K(31,{wX:-1.45,wZ:.4,wrist:-.15,roll:-1.57,bodyY:6.283}),K(37,{bodyY:6.283},'hold'),K(38,{})],[{f:19,name:'swing'},{f:26,name:'hit'}])
})};