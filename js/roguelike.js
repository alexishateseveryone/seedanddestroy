// ROGUELIKE MODE (endless waves). Everything that belongs only to this mode lives here; main.js just calls it.
//   - the wave state (how many enemies are left, intro / fight / clear phases) and the run stats (wave, kills, score)
//   - enemy spawning (the title-screen demo reuses spawn() too)
//   - the WEAPON ROULETTE: at the start of every wave TWO weapons are offered, the roulette spins and whichever one it lands on is
//     equipped for that wave. Wave 1 always offers the Peashooter and the Wooden Sword; every later wave offers two random weapons.
//
//   const rogue=createRoguelike({P,enemies,ebul,scene,fx,hud,audio,WEAPONS,buildEnemy,STATS,getMap,getBest,equipIdx,casts,prepare});
//   rogue.start()              begin a new run (Play / Try Again / R)        rogue.update(dt)   wave logic, call every frame while playing
//   rogue.onKill()             an enemy died (chain + score + kills)          rogue.hudAll()     repaint hp / wave / foes / score
//   rogue.R                    {wave,kills,score} for the game-over card      rogue.cancel()     the player died: stop a spinning roulette
//   rogue.stop()               leave the mode (title, 5v5, story)             rogue.active()/locked()  used by main.js to restrict weapon switching
//   rogue.demoReset()/demoUpdate(dt)  the title screen's attract mode borrows the enemy spawner
import * as T from 'three';

const LOCK_WEAPON=true;   // true: you fight the whole wave with the weapon the roulette gave you. false: you may flip between the two offered weapons yourself
const START=[['peashooter',w=>w.kind==='gun'],['woodensword',w=>w.kind!=='gun']];   // wave 1 offer: [weapon id, fallback test]
const icoOf=w=>w&&w.kind==='gun'?'bi-crosshair':'bi-slash-lg';

const quota=w=>Math.min(44,4+w*2),maxAlive=w=>Math.min(4+Math.floor(w*1.2),12);
const rnd=(a,b)=>a+Math.random()*(b-a);

export function createRoguelike(ctx){
  const {P,enemies,ebul,scene,fx,hud,audio,WEAPONS,buildEnemy,STATS}=ctx;
  const R={wave:1,kills:0,score:0,spawnT:1};                       // run stats (spawnT also times the title demo's spawns)
  const WV={phase:'intro',t:0,left:0,total:0,spawnT:0};            // phase: roll | intro | fight | clear
  let on=false,timer=0;

  // ---------------------------------------------------------------- which two weapons are offered
  const mk=i=>({i,icon:icoOf(WEAPONS[i]),name:WEAPONS[i].name||'Weapon'});
  const startPair=()=>{const out=[];START.forEach(([id,fb])=>{let i=WEAPONS.findIndex(w=>w.id===id);if(i<0)i=WEAPONS.findIndex(fb);if(i>=0&&!out.some(p=>p.i===i))out.push(mk(i))});return out};
  function randomPair(){
    const idx=WEAPONS.map((_,i)=>i);
    for(let k=idx.length-1;k>0;k--){const j=(Math.random()*(k+1))|0;[idx[k],idx[j]]=[idx[j],idx[k]]}   // shuffle, take the first two
    return idx.slice(0,2).map(mk)}
  const offerFor=w=>w===1?startPair():randomPair();

  // ---------------------------------------------------------------- roulette overlay (paper theme: reuses the tokens from style.css, with fallbacks)
  let ui=null;
  function mkUI(){
    if(ui)return ui;
    const css=document.createElement('style');css.textContent=`
    #rgRoll{position:fixed;left:50%;top:13%;transform:translateX(-50%);z-index:60;pointer-events:none;text-align:center;font-family:var(--font,'Baloo 2',system-ui,sans-serif);color:var(--cream,#f1e8d2);transition:opacity .25s,transform .25s}
    #rgRoll[hidden]{display:none}#rgRoll.out{opacity:0;transform:translateX(-50%) translateY(-14px)}
    #rgRoll h3{margin:0;font:400 46px/1 var(--disp,Impact,sans-serif);color:var(--cream,#f1e8d2);-webkit-text-stroke:10px var(--k,#17100e);paint-order:stroke fill;letter-spacing:.02em;transform:rotate(-2deg)}
    #rgRoll p{display:inline-block;margin:10px 0 18px;padding:4px 20px;background:var(--k,#17100e);color:var(--cream,#f1e8d2);border-radius:3px;font-weight:800;font-size:14px;letter-spacing:.16em;text-transform:uppercase;transform:rotate(1deg)}
    #rgRoll .rgcards{display:flex;gap:20px;justify-content:center;align-items:flex-start}
    #rgRoll .rgc{--sheet:var(--paper,#efe4c8);--cut:var(--s3,none);--rot:-1.5deg;--sc:.94;position:relative;isolation:isolate;box-sizing:border-box;width:156px;min-height:128px;padding:18px 10px 14px;color:var(--k,#17100e);opacity:.72;
      transform:rotate(var(--rot)) scale(var(--sc));transition:transform .08s,opacity .08s,color .08s;
      filter:drop-shadow(2px 0 0 #17100e) drop-shadow(-2px 0 0 #17100e) drop-shadow(0 2px 0 #17100e) drop-shadow(0 -2px 0 #17100e) drop-shadow(0 7px 0 rgba(23,16,14,.55)) drop-shadow(0 13px 16px rgba(0,0,0,.4))}
    #rgRoll .rgc:nth-child(2){--cut:var(--s6,none);--rot:1.6deg}
    #rgRoll .rgc::before{content:'';position:absolute;inset:0;z-index:-1;pointer-events:none;background-color:var(--sheet);background-image:var(--grain,none);clip-path:var(--cut);transition:background-color .08s}
    #rgRoll .rgc i{display:block;font-size:48px;line-height:1.1}
    #rgRoll .rgc b{display:block;margin-top:6px;font:400 17px/1.1 var(--disp,Impact,sans-serif);letter-spacing:.02em;text-transform:uppercase;word-break:break-word}
    #rgRoll .rgc.on{--sheet:var(--paper3,#f6edd6);--sc:1.07;opacity:1}
    #rgRoll .rgc.on i{color:var(--blood,#c4161c)}
    #rgRoll .rgc.win{--sheet:var(--blood,#c4161c);--sc:1.14;opacity:1;color:var(--cream,#f1e8d2);animation:rgPop .5s ease-out}
    #rgRoll .rgc.win i{color:var(--cream,#f1e8d2)}
    @keyframes rgPop{0%{transform:rotate(var(--rot)) scale(.95)}60%{transform:rotate(var(--rot)) scale(1.24)}100%{transform:rotate(var(--rot)) scale(1.14)}}
    @media (max-height:480px){#rgRoll{top:8%}#rgRoll h3{font-size:28px;-webkit-text-stroke:7px var(--k,#17100e)}#rgRoll .rgcards{gap:12px}#rgRoll .rgc{width:112px;min-height:92px;padding:10px 6px 8px}#rgRoll .rgc i{font-size:32px}#rgRoll .rgc b{font-size:12px}#rgRoll p{margin:4px 0 8px;font-size:11px}}`;
    document.head.appendChild(css);
    const el=document.createElement('div');el.id='rgRoll';el.hidden=true;
    el.innerHTML='<h3></h3><p>Weapon roulette</p><div class="rgcards"></div>';
    document.body.appendChild(el);return ui=el}
  const tick=k=>{try{audio.play('click',{vol:.22,pitch:.9+k*.025})}catch(e){}};
  function hideUI(){clearTimeout(timer);timer=0;if(ui){ui.hidden=true;ui.classList.remove('out')}}

  /** spin for wave w over the two offered weapons; calls done(offerIndex) when it lands (the result is decided up front, the animation only slows down onto it) */
  function roulette(w,offer,done){
    if(offer.length<2){done(offer.length?0:-1);return}
    const el=mkUI(),box=el.querySelector('.rgcards');
    box.innerHTML=offer.map(p=>`<div class="rgc"><i class="bi ${p.icon}"></i><b>${p.name}</b></div>`).join('');
    const cards=[...box.children],n=cards.length,target=(Math.random()*n)|0;
    let last=15;while(last%n!==target)last++;                            // enough turns, and the last step lands on the winner
    el.querySelector('h3').textContent='WAVE '+w;el.classList.remove('out');el.hidden=false;
    let s=0;
    const step=()=>{
      if(!on){hideUI();return}
      cards.forEach((c,k)=>c.classList.toggle('on',k===s%n));tick(s);
      if(s>=last){cards[target].className='rgc win';audio.play('win',{vol:.5});
        timer=setTimeout(()=>{el.classList.add('out');timer=setTimeout(()=>{hideUI();done(target)},260)},850);return}
      const u=s/last;s++;timer=setTimeout(step,70+u*u*u*430)}            // 70 ms per step at first, slowing to ~500 ms
    step()}

  // ---------------------------------------------------------------- waves
  const hudAll=()=>{hud.hp(P.hp,P.max);hud.wave(R.wave);hud.foes(WV.left+enemies.length,WV.total);hud.score(R.score,R.kills,ctx.getBest())};
  function beginWave(w){
    R.wave=w;WV.total=WV.left=quota(w);WV.phase='roll';WV.spawnT=.4;P.chain=0;hudAll();
    const offer=offerFor(w);
    roulette(w,offer,k=>{if(!on||k<0)return;
      const lo=offer.map(p=>p.i);P.loadout=lo;hud.loadout(lo);ctx.equipIdx(offer[k].i);   // this wave's two weapons; the roulette winner is in your hands
      WV.phase='intro';WV.t=2.2;hud.banner(`WAVE ${w}`,`${WV.total} enemies`);hudAll()})}

  function spawn(){const map=ctx.getMap(),wave=R.wave,k=Math.random()<Math.min(.55,.22+wave*.08)?'ranged':'melee';let x,z,n=0;
    do{const a=rnd(0,6.283),d=rnd(13,18);x=P.x+Math.cos(a)*d;z=P.z+Math.sin(a)*d}while(n++<25&&(Math.abs(x)>map.W/2-2||Math.abs(z)>map.H/2-2||map.obs.some(o=>Math.hypot(o.x-x,o.z-z)<o.r+.9)));
    x=Math.max(-map.W/2+2,Math.min(map.W/2-2,x));z=Math.max(-map.H/2+2,Math.min(map.H/2-2,z));const g=buildEnemy(k);ctx.casts(g);scene.add(g);const hp=Math.ceil(STATS[k].hp*(1+(wave-1)*.15));
    enemies.push({g,k,x,z,y:0,hp,mhp:hp,hbT:0,r:STATS[k].r,t:rnd(0,3),s:0,st:'idle',sta:1,cd:rnd(.6,1.4),fl:0,yaw:Math.atan2(P.x-x,P.z-z),alert:rnd(0,1)<.5?4:0,
      wx:null,wz:0,wt:0,dodge:0,dcd:0,dsd:1,ddx:0,ddz:0,lastB:null,stun:0,pt:0,hit:false,burst:0,bcd:0,aimT:0,mt:0,sneak:false,strafe:1,jcd:rnd(1.5,4),jy:0,jx:0,jz:0,tx:0,tz:0,dc:k==='ranged'?.35:.2});
    fx.puff(new T.Vector3(x,.3,z),g.userData.col,4)}

  return{
    R,hudAll,spawn,
    active:()=>on,
    locked:()=>on&&LOCK_WEAPON&&WEAPONS.length>1,

    /** new run: shared match set-up (ctx.prepare), then wave 1 and its roulette */
    start(){
      ctx.prepare();hideUI();
      R.wave=1;R.kills=0;R.score=0;R.spawnT=.5;on=true;
      P.unarmed=false;const sp=startPair();if(sp.length){const lo=sp.map(p=>p.i);P.loadout=lo;hud.loadout(lo);ctx.equipIdx(lo[0])}
      beginWave(1)},

    /** wave logic: call every frame while the roguelike is being played */
    update(dt){
      if(!on)return;
      if(WV.phase==='intro'){WV.t-=dt;if(WV.t<=0)WV.phase='fight'}
      else if(WV.phase==='fight'){
        WV.spawnT-=dt;if(WV.left>0&&enemies.length<maxAlive(R.wave)&&WV.spawnT<=0){spawn();WV.left--;WV.spawnT=Math.max(.45,1.8-R.wave*.12);hudAll()}
        if(WV.left<=0&&enemies.length===0){WV.phase='clear';WV.t=4.5;const bonus=100*R.wave;R.score+=bonus;if(P.hp<P.max)P.hp++;
          ebul.forEach(b=>scene.remove(b.m));ebul.length=0;fx.shock(new T.Vector3(P.x,.1,P.z),'#9be84f');audio.play('win');hud.banner('WAVE CLEARED',`+${bonus} bonus   ·   +1 paw`,'clear long');hudAll();hud.foes(0,WV.total,'Area clear')}}
      else if(WV.phase==='clear'){WV.t-=dt;hud.foes(0,WV.total,`Next wave in ${Math.ceil(WV.t)}`);if(WV.t<=0)beginWave(R.wave+1)}
      // 'roll': the roulette is spinning, nothing spawns until it lands
      P.chainT=Math.max(0,P.chainT-dt);if(P.chainT<=0)P.chain=0},

    /** an enemy was defeated */
    onKill(){P.chain++;P.chainT=3.2;R.score+=10*Math.min(5,1+Math.floor(P.chain/3));R.kills++},

    /** the player died: the run is over, drop a spinning roulette */
    cancel(){hideUI()},
    /** left the mode (title, 5v5, story) */
    stop(){on=false;hideUI()},

    // the title screen's attract mode: a bot fights waves of the same enemies, with wave-3 strength
    demoReset(){R.wave=3;R.spawnT=.6},
    demoUpdate(dt){R.spawnT-=dt;if(R.spawnT<=0&&enemies.length<5){spawn();R.spawnT=2.2}}
  };
}
