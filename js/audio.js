// Audio: sound effects (WebAudio, random pitch on every play) + background music (crossfaded per screen), with saved volumes.
//
//  SOUND EFFECTS  -> put your files in assets/sfx/   (names below; edit SFX to change a path or add variants: files:['a.wav','b.wav'] picks one at random)
//  GUN SOUNDS     -> assets/sfx/weapons/<weapon>.wav, referenced from the weapon's own js file:  sfx:{shoot:'assets/sfx/weapons/armalite.wav'}
//                    (optional per weapon: vol:.6, pitch:.08). A gun without sfx falls back to the generic shoot sound.
//  MELEE SOUNDS   -> NOT played from here any more. Swing / hit / step sounds are set on the animation's events in animation_maker.html (Sound & events tab),
//                    exported into js/catAvatar.js, and played by the cat itself on the exact frame. createAudio() hooks every cat automatically (no wiring needed).
//  SYNC           -> play(id,{delay,skip}): delay = seconds from now (the cat passes it so the sound lands on the exact animation frame),
//                    skip = seconds of leading silence to trim off the file so the first transient is the swing.
//                    api.preload(paths) decodes sounds ahead of time; createAudio() does this for every animation sound.
//  MUSIC          -> assets/bgm/  (title / wave / v5 below). Any format the browser plays (mp3, ogg, wav...). Keep the path in BGM in sync.
// A missing or empty file is silently skipped, so the game never breaks if a sound isn't there yet.
const KEY='sad.audio';
export const SFX={
  click:{files:['assets/sfx/click.wav'],vol:.6,pitch:.06},     // any button
  shoot:{files:['assets/sfx/shoot.wav'],vol:.5,pitch:.10},     // generic gun shot (weapons override with their own sfx.shoot)
  hit:  {files:['assets/sfx/hit.wav'],  vol:.6,pitch:.15},     // you hit an enemy
  win:  {files:['assets/sfx/win.wav'],  vol:.8,pitch:.03},     // wave cleared / match won
  lose: {files:['assets/sfx/lose.wav'], vol:.8,pitch:.03}};    // cat down / match lost
export const BGM={title:'assets/bgm/title.wav',wave:'assets/bgm/wave.wav',v5:'assets/bgm/v5.wav'};

export function createAudio(){
  const AC=window.AudioContext||window.webkitAudioContext;let ctx=null,master,sfxG,musG;
  let vol={master:.8,sfx:1,music:.5};try{Object.assign(vol,JSON.parse(localStorage.getItem(KEY)||'{}'))}catch(e){}
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(vol))}catch(e){}};
  const buffers=new Map(),last={},bad=new Set();let ducked=false,want=null,cur=null,curKey=null;
  try{ctx=new AC({latencyHint:'interactive'});master=ctx.createGain();sfxG=ctx.createGain();musG=ctx.createGain();sfxG.connect(master);musG.connect(master);master.connect(ctx.destination)}catch(e){ctx=null}
  const apply=()=>{if(!ctx)return;master.gain.value=vol.master;sfxG.gain.value=vol.sfx;musG.gain.setTargetAtTime(vol.music*(ducked?.35:1),ctx.currentTime,.15)};apply();
  // decode a file once (cached; null = missing / undecodable, so we never retry)
  const pending=new Map();
  const load=url=>{if(!buffers.has(url)){buffers.set(url,null);
    pending.set(url,fetch(url).then(r=>r.ok?r.arrayBuffer():Promise.reject(new Error('HTTP '+r.status))).then(b=>new Promise((ok,no)=>ctx.decodeAudioData(b,ok,no))).then(b=>buffers.set(url,b)).catch(e=>console.warn('[audio] could not load '+url+' ('+((e&&e.message)||'not decodable')+') - check the path is relative to the game page')))}return buffers.get(url)};
  if(ctx)Object.values(SFX).forEach(d=>d.files.forEach(load));
  const drop=t=>{try{t.el.pause();t.src.disconnect();t.g.disconnect()}catch(e){}};
  const fadeOut=(t,s=.8)=>{t.g.gain.setTargetAtTime(0,ctx.currentTime,s/3);setTimeout(()=>drop(t),s*1000+100)};
  function startMusic(key){
    const url=BGM[key];if(!url||!ctx||bad.has(key))return;const el=new Audio(url);el.loop=true;
    const src=ctx.createMediaElementSource(el),g=ctx.createGain();g.gain.value=0;src.connect(g);g.connect(musG);
    const t={el,src,g,blocked:false};cur=t;curKey=key;
    const fail=()=>{bad.add(key);drop(t);if(cur===t){cur=null;curKey=null}};   // missing / unplayable file: give up on this track (no retry loop)
    el.addEventListener('error',fail);
    const p=el.play();if(p&&p.catch)p.catch(e=>{if(e&&e.name==='NotAllowedError')t.blocked=true;else fail()});   // autoplay blocked: retried on the first click / key press
    g.gain.setTargetAtTime(1,ctx.currentTime,.4)}
  const api={
    /** play a sound effect by name ('hit', 'click'...) or by file path (weapon sounds). o: {vol, pitch} override the defaults. Pitch is randomised by +-pitch each time. */
    play(id,o={}){if(!ctx||ctx.state==='suspended'&&!api.unlocked)return;
      const path=id.includes('/'),d=path?{files:[id],vol:1,pitch:.08,skip:0}:SFX[id];if(!d)return;
      const url=d.files[(Math.random()*d.files.length)|0],buf=load(url);
      if(!buf){const pr=pending.get(url);if(pr&&!o.retry)pr.then(()=>{if(buffers.get(url))api.play(id,{...o,retry:1,delay:0})});return}   // first use of a file that is still loading: play it the moment it is ready
      const now=performance.now();if(now-(last[id]||0)<35)return;last[id]=now;   // shotgun pellets / multi-hits don't stack into a wall of noise
      const s=ctx.createBufferSource(),g=ctx.createGain(),p=o.pitch??d.pitch;
      s.buffer=buf;s.playbackRate.value=1+(Math.random()*2-1)*p;g.gain.value=(o.vol??1)*d.vol;s.connect(g);g.connect(sfxG);s.start(ctx.currentTime+Math.max(0,o.delay||0),Math.max(0,o.skip??d.skip??0))},   // delay: lands exactly on the animation frame; skip: trims leading silence
    /** decode sounds ahead of time (call when a weapon is equipped: api.preload([w.sfx.shoot])) */
    preload(list){if(ctx)[].concat(list).forEach(u=>u&&load(u))},
    /** connect a cat to the sounds made in the animation maker: every event with a sound plays it (vol / pitch / skip / frame delay from the editor).
     *  The cat decides WHEN (the exact animation frame); nothing else in the game should play the swing sound. */
    bindCat(cat){const U=cat&&cat.userData;if(U)U.onAnimSfx=(path,o)=>api.play(path,o)},   // optional: only needed to override the automatic hook for one cat
    /** pick which background track should be playing (null = silence). Safe to call every frame. */
    music(key){want=key;if(!ctx||key===curKey)return;if(cur){fadeOut(cur);cur=null;curKey=null}if(key&&ctx.state==='running')startMusic(key)},
    duck(v){if(v!==ducked){ducked=v;apply()}},                       // music gets quieter while paused
    /** call from a user gesture: browsers keep audio locked until the player clicks / presses a key */
    unlock(){if(!ctx)return;api.unlocked=true;
      const go=()=>{if(cur&&cur.blocked){cur.blocked=false;cur.el.play().catch(()=>{})}else if(want&&!cur)api.music(want)};
      if(ctx.state==='suspended')ctx.resume().then(go);else go()},
    get:()=>vol,set(k,v){vol[k]=Math.max(0,Math.min(1,v));apply();save()},unlocked:false};
  if(ctx){globalThis.__animSfx=(path,o)=>api.play(path,o);globalThis.__audioPreload=l=>api.preload(l)}   // catAvatar.js looks these up when an animation event has a sound: no import between the two files, nothing to wire
  return api}
