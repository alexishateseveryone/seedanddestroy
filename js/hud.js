// In-game HUD: player card, wave/score, minimap, crosshair, and touch controls for mobile.
import * as T from 'three';
import {WEAPONS} from './weapons/index.js';

const SWORD=`<svg viewBox="0 0 24 24" class="wi"><path d="M20.5 3.5l-.7 4.2-9.6 9.6-3.5-3.5 9.6-9.6z" fill="currentColor"/><path d="M5.2 12.6l6.2 6.2" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M8 16l-3.6 3.6" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><circle cx="3.9" cy="20.1" r="1.5" fill="currentColor"/></svg>`;
const BLASTER=`<svg viewBox="0 0 24 24" class="wi"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H19a2 2 0 0 1 2 2v4.2a1.8 1.8 0 0 1-1.8 1.8H13l-.9 1.6H9.6l.4-1.6H6.6L5.6 19.4a1.6 1.6 0 0 1-1.5 1H3.2z" fill="currentColor"/><rect x="16.2" y="7.2" width="3" height="2.2" rx="1" fill="#2b2150" opacity=".55"/></svg>`;
const PAW='<svg class="paw"><use href="#paw"/></svg>';
const SV=d=>`<svg viewBox="0 0 24 24" class="wi">${d}</svg>`;
const ICONS={
  peashooter:BLASTER,woodensword:SWORD,
  ak47:SV('<path d="M1 12.5l4.5-2.2H12l1-1.3h7.5l1.5 1.3v1.6H15l-1 1H11l-.5 5H8l.6-5H6l-2.2 1.6H1z" fill="currentColor"/>'),
  armalite:SV('<path d="M1 12l4-2h2l1-1.6h3.2l.8 1.2h9l1 1.2v1.3H14l-1 1.2h-2.4l-.4 5H7.8L8.4 13H5.5L3 14.4H1z" fill="currentColor"/>'),
  machinegun:SV('<path d="M1 11.5l3-1.6h8l.8-1h7.7v1.4l1.5 1v1.5H14l-1 1h-1.5v3H6v-3.2H4.5L1 14z" fill="currentColor"/><rect x="5" y="14" width="6" height="4" rx="1" fill="currentColor" opacity=".8"/>'),
  sniper:SV('<path d="M0.5 13l4-1.6 2-1.4h9.5l2-.6H23v1.4h-5l-1.6 1.2H11l-.6 4.5H8.2l.6-4.2H6l-2.5 1.6H.5z" fill="currentColor"/><rect x="8" y="6.6" width="8" height="2.4" rx="1.2" fill="currentColor"/>'),
  dualdagger:SV('<path d="M5 3.5l2.2 8-2.5 3.2-1.4-3.4z" fill="currentColor"/><path d="M4.8 15l-.5 5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M17.5 3.5l-2.2 8 2.5 3.2 1.4-3.4z" fill="currentColor"/><path d="M17.7 15l.5 5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>'),
  spear:SV('<path d="M20.5 2.5l-1.2 5.2-2-2z" fill="currentColor"/><path d="M18 6.2L3 21.2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>')
};
const slotHTML=WEAPONS.map((w,i)=>`<div class="slot${i===0?' on':''}" data-w="${i}"><kbd>${i+1}</kbd>${ICONS[w.id]||BLASTER}<span>${w.name}</span></div>`).join('');

const mobileCSS = document.createElement('style');
mobileCSS.textContent = `
  #mob-ctrls { display: none; position: fixed; inset: 0; pointer-events: none; z-index: 990; }
  body.mobile #mob-ctrls { display: block; }
  .m-joy-base { position: absolute; bottom: 30px; left: 30px; width: 130px; height: 130px; background: rgba(255,255,255,0.12); border: 2px solid rgba(255,255,255,0.3); border-radius: 50%; pointer-events: auto; touch-action: none; }
  .m-joy-thumb { position: absolute; top: 35px; left: 35px; width: 60px; height: 60px; background: rgba(255,255,255,0.5); border-radius: 50%; pointer-events: none; transition: transform 0.05s linear; }
  .m-btn { position: absolute; pointer-events: auto; touch-action: none; background: rgba(43,33,80,0.75); border: 2px solid rgba(255,255,255,0.4); color: #fff; border-radius: 50%; display: grid; place-items: center; font-weight: bold; font-family: 'Baloo 2', sans-serif; box-shadow: 0 4px 12px rgba(0,0,0,0.4); }
  .m-btn:active { background: rgba(255,213,74,0.85); color: #2b2150; transform: scale(0.92); }
  #mob-fire { bottom: 35px; right: 35px; width: 80px; height: 80px; font-size: 16px; background: rgba(239,68,68,0.85); border-color: #fca5a5; }
  #mob-tumble { bottom: 135px; right: 45px; width: 55px; height: 55px; font-size: 11px; }
  #mob-weapon { bottom: 35px; right: 135px; width: 60px; height: 60px; font-size: 12px; }
  #mob-pause { top: 20px; right: 20px; width: 45px; height: 45px; font-size: 14px; border-radius: 12px; }
  #mob-look-zone { position: absolute; top: 0; right: 0; width: 60%; height: 70%; pointer-events: auto; touch-action: none; }
`;
document.head.appendChild(mobileCSS);
const css=document.createElement('style');css.textContent='#wpn .slot span{display:none}#wpn .slot.on span{display:inline}#wpn{gap:6px}';document.head.appendChild(css);

export function createHUD(root=document.body){
  const $=s=>root.querySelector(s),el=(h)=>{const d=document.createElement('div');d.innerHTML=h.trim();return d.firstChild};
  const hud=$('#hud');
  hud.innerHTML=`
    <div class="hud-tl"><div class="pcard"><div class="pbadge">${PAW}</div>
      <div class="pbody"><div class="pname" id="pname">Cat</div><div class="paws" id="paws"></div>
      <div class="tmb"><i id="tmbFill"></i><span>TUMBLE <em>SPACE</em></span></div></div></div></div>
    <div class="hud-tc"><div class="wplate"><small>WAVE</small><b id="waveN">1</b></div>
      <div class="foes"><div class="foebar"><i id="foeFill"></i></div><span id="foeTxt">&nbsp;</span></div></div>
    <div class="hud-tr"><div class="sbox"><span class="lbl">SCORE</span><b id="score">000000</b>
      <div class="combo" id="combo"><span id="comboTxt">x2</span><i id="comboBar"></i></div>
      <div class="subs"><span>KOs <b id="kos">0</b></span><span>BEST <b id="bestHud">0</b></span></div></div></div>
    <div class="hud-br"><div class="mini"><canvas id="mini" width="220" height="220"></canvas><span class="mn">N</span></div></div>
    <div class="hud-bc" id="wpn">${slotHTML}</div>
    <div class="hud-bl"><div class="hint"><kbd>LMB</kbd> shoot <kbd>RMB</kbd> scope <kbd>SPACE</kbd> tumble <kbd>1-8</kbd> / wheel weapon</div></div>`;
  
  const extra=el(`<div id="hudx"><div id="fps-crosshair"><i class="dot"></i><i class="t t1"></i><i class="t t2"></i><i class="t t3"></i><i class="t t4"></i><div id="hitm"><i></i><i></i><i></i><i></i></div></div>
    <div id="scope-ov"></div><div id="hurt"></div><div id="lowhp"></div><div id="banner"><b id="bnT"></b><span id="bnS"></span></div><div id="ebars"></div>
    
    <!-- Mobile Touch Controls Overlay -->
    <div id="mob-ctrls">
      <div id="mob-look-zone"></div>
      <div class="m-joy-base" id="mob-joystick"><div class="m-joy-thumb" id="mob-thumb"></div></div>
      <button class="m-btn" id="mob-fire">FIRE</button>
      <button class="m-btn" id="mob-tumble">DASH</button>
      <button class="m-btn" id="mob-weapon">WPN</button>
      <button class="m-btn" id="mob-pause">⏸</button>
    </div>

    <div id="pause" hidden><div class="card"><h2>Paused</h2><p class="pk">Click anywhere to jump back in</p>
      <div class="keys"><div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>move</span></div><div><kbd>Mouse</kbd><span>aim</span></div><div><kbd>LMB</kbd><span>shoot / slash</span></div><div><kbd>RMB</kbd><span>scope</span></div><div><kbd>SPACE</kbd><span>tumble</span></div><div><kbd>1-8</kbd><span>weapons (or mouse wheel)</span></div><div><kbd>G</kbd><span>graphics</span></div></div>
      <div class="row"><button id="resume" class="btn green">Resume</button><button id="pgfx" class="btn pink">Graphics</button><button id="quit" class="btn gold">Title</button></div></div></div></div>`);
  document.body.appendChild(extra);
  const cross=$('#fps-crosshair'),hitm=$('#hitm'),scopeEl=$('#scope-ov'),hurtEl=$('#hurt'),lowEl=$('#lowhp'),bn=$('#banner'),ebars=$('#ebars'),pauseEl=$('#pause');
  const mini=$('#mini'),mc=mini.getContext('2d'),slots=[...root.querySelectorAll('#wpn .slot')];
  const v=new T.Vector3(),pool=[];let last={};
  const set=(k,fn,val)=>{if(last[k]!==val){last[k]=val;fn(val)}};
  const api={
    show(b){hud.hidden=!b;extra.style.display=b?'block':'none';if(!b){this.pause(false);bn.className='';}},
    reset(){last={};this.banner('','');hurtEl.style.opacity=0;ebars.innerHTML='';pool.length=0},
    name(n){$('#pname').textContent=n||'Cat'},
    hp(hp,max){set('hp',()=>{$('#paws').innerHTML=Array.from({length:max},(_,i)=>`<span class="pw${i<hp?'':' off'}">${PAW}</span>`).join('');lowEl.classList.toggle('on',hp<=1&&hp>0)},hp+'/'+max)},
    wave(n){set('wave',x=>{$('#waveN').textContent=x;$('#waveN').parentNode.classList.remove('pop');void $('#waveN').offsetWidth;$('#waveN').parentNode.classList.add('pop')},n)},
    foes(left,total,txt){set('foes',()=>{$('#foeFill').style.width=(total?100*(1-left/total):0)+'\%';$('#foeTxt').textContent=txt??(left>0?`${left} enemies left`:'Area clear')},left+'/'+total+txt)},
    score(s,k,b){set('score',()=>{$('#score').textContent=String(s).padStart(6,'0');$('#kos').textContent=k;$('#bestHud').textContent=b;const e=$('#score');e.classList.remove('bump');void e.offsetWidth;e.classList.add('bump')},s+'|'+k+'|'+b)},
    combo(mult,chain,frac){const c=$('#combo');c.classList.toggle('on',chain>1&&frac>0);if(chain>1){set('cmb',()=>{$('#comboTxt').textContent=`x${mult}  ·  ${chain} chain`},mult+'/'+chain);$('#comboBar').style.transform=`scaleX(${Math.max(0,frac)})`}},
    weapon(w){slots.forEach(s=>s.classList.toggle('on',+s.dataset.w===w))},
    banner(t,s='',cls=''){bn.className='';$('#bnT').textContent=t;$('#bnS').textContent=s;if(!t)return;void bn.offsetWidth;bn.className='on '+cls},
    hit(kill){hitm.className='';void hitm.offsetWidth;hitm.className=kill?'kill':'hit'},
    hurt(){hurtEl.style.transition='none';hurtEl.style.opacity=.95;void hurtEl.offsetWidth;hurtEl.style.transition='opacity .7s ease-out';hurtEl.style.opacity=0},
    pause(b){pauseEl.hidden=!b},
    scope(a){scopeEl.style.opacity=a;cross.style.opacity=1-a*.7},
    crosshair(spread,vis){cross.style.display=vis?'block':'none';cross.style.setProperty('--sp',spread.toFixed(1)+'px')},
    tumble(frac){set('tmb',()=>{const f=$('#tmbFill');f.style.transform=`scaleX(${frac})`;f.parentNode.classList.toggle('rdy',frac>=1)},Math.round(frac*40))},
    bars(enemies,cam,time){let n=0;const w=innerWidth,h=innerHeight;
      for(const e of enemies){if(!(e.hbT>0)||e.hp<=0)continue;v.set(e.x,1.55+(e.jy||0),e.z).project(cam);if(v.z>1||v.z<-1)continue;
        let b=pool[n];if(!b){b=el('<div class="eb"><i></i></div>');ebars.appendChild(b);pool[n]=b}
        b.style.display='block';b.style.transform=`translate(${((v.x*.5+.5)*w).toFixed(0)}px,${((-v.y*.5+.5)*h).toFixed(0)}px) translate(-50%,-50%)`;b.firstChild.style.transform=`scaleX(${Math.max(0,e.hp/e.mhp)})`;b.style.opacity=Math.min(1,e.hbT*2);n++}
      for(let i=n;i<pool.length;i++)pool[i].style.display='none'},
    radar(P,enemies,pickups,map,yaw){const S=mini.width,c=S/2,R=24,k=c/R,fx=Math.sin(yaw),fz=Math.cos(yaw),rx=-Math.cos(yaw),rz=Math.sin(yaw);
      const X=(x,z)=>c+((x-P.x)*rx+(z-P.z)*rz)*k,Y=(x,z)=>c-((x-P.x)*fx+(z-P.z)*fz)*k;
      mc.clearRect(0,0,S,S);mc.save();mc.beginPath();mc.arc(c,c,c-2,0,6.283);mc.clip();
      mc.fillStyle='#2a3a3a';mc.fillRect(0,0,S,S);
      const hw=map.W/2,hh=map.H/2;mc.beginPath();[[-hw,-hh],[hw,-hh],[hw,hh],[-hw,hh]].forEach(([x,z],i)=>mc[i?'lineTo':'moveTo'](X(x,z),Y(x,z)));mc.closePath();mc.fillStyle='#4c8a45';mc.fill();mc.lineWidth=3;mc.strokeStyle='#ffffff90';mc.stroke();
      mc.fillStyle='#4aa8e8';map.ponds.forEach(([x,z,r])=>{mc.beginPath();mc.arc(X(x,z),Y(x,z),r*k,0,6.283);mc.fill()});
      for(const o of map.obs){if(o.r>3)continue;mc.fillStyle=o.r===.6?'#2a6a3a':'#8f98a3';mc.beginPath();mc.arc(X(o.x,o.z),Y(o.x,o.z),Math.max(2,o.r*k*.8),0,6.283);mc.fill()}
      mc.fillStyle='#ff9db8';for(const p of pickups){mc.beginPath();mc.arc(X(p.x,p.z),Y(p.x,p.z),4.5,0,6.283);mc.fill()}
      for(const e of enemies){const x=X(e.x,e.z),y=Y(e.x,e.z);mc.fillStyle=e.k==='ranged'?'#ffb23a':'#ff4d4d';mc.strokeStyle='#2b2150';mc.lineWidth=2;
        if(e.k==='ranged'){mc.beginPath();mc.moveTo(x,y-7);mc.lineTo(x+6.5,y+5);mc.lineTo(x-6.5,y+5);mc.closePath()}else{mc.beginPath();mc.arc(x,y,5.5,0,6.283)}mc.fill();mc.stroke()}
      const g=mc.createRadialGradient(c,c,0,c,c,c*.7);g.addColorStop(0,'rgba(255,255,255,.28)');g.addColorStop(1,'rgba(255,255,255,0)');mc.fillStyle=g;mc.beginPath();mc.moveTo(c,c);mc.arc(c,c,c*.7,-Math.PI/2-.55,-Math.PI/2+.55);mc.closePath();mc.fill();
      mc.fillStyle='#fff';mc.strokeStyle='#2b2150';mc.lineWidth=2.5;mc.beginPath();mc.moveTo(c,c-9);mc.lineTo(c+7,c+7);mc.lineTo(c,c+3);mc.lineTo(c-7,c+7);mc.closePath();mc.fill();mc.stroke();mc.restore()}
  };
  api.show(false);
  return api}
