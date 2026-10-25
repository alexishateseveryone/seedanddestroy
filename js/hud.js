// In-game HUD: player card, wave/score, minimap, crosshair. (Touch controls live in js/mobile.js.)
import * as T from 'three';
import {WEAPONS} from './weapons/index.js';
import * as AT from './arenaTerrain.js';                       // 5v5 arena: biomes, dirt lanes, lakes (live bindings: always the map that is loaded now)
import {NB,FOREST,JUNGLE,SAVANNA,DESERT,STONE} from './world/biomes.js';

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

const css=document.createElement('style');css.textContent='#wpn .slot span{display:none}#wpn .slot.on span{display:inline}#wpn{gap:6px}'+`
.hud-ammo{position:absolute;right:26px;bottom:118px;display:none;flex-direction:column;align-items:flex-end;gap:4px;text-shadow:var(--sh)}
.hud-ammo .amrow{display:flex;align-items:baseline;gap:6px}
#amN{font:400 40px/1 var(--disp);color:#fff;min-width:1ch;text-align:right}#amM{font:800 16px var(--font);color:#ffffffaa;letter-spacing:.08em}
.ambar{width:120px;height:4px;border-radius:9px;background:#0007;overflow:hidden;opacity:0;transition:opacity .15s}
.ambar i{display:block;height:100%;background:#8fe3ff;transform-origin:left;transform:scaleX(0)}
.hud-ammo.rl .ambar{opacity:1}
#amHint{font:800 12px var(--font);letter-spacing:.16em;color:#fff;min-height:14px}
.hud-ammo.low #amN{color:var(--lemon)}.hud-ammo.empty #amN{color:#ff5a4d}
.hud-ammo.low #amHint,.hud-ammo.empty #amHint{animation:amb 1s ease-in-out infinite}@keyframes amb{50%{opacity:.35}}
body.mobile .hud-ammo{right:auto;left:var(--wpn-x,50%);transform:translateX(-50%);bottom:72px;align-items:center}   /* just above the weapon switch (the paws now live top-left) */
`+`
/* ---- paper minimap frame: torn paper, no outline (the ragged edge is a clip-path set in createHUD) */
.hud-br{filter:drop-shadow(0 5px 5px rgba(40,28,14,.42))}
.hud-br::before{content:'';position:absolute;top:-8px;left:50%;width:56px;height:17px;margin-left:-28px;background:rgba(255,226,140,.82);transform:rotate(2.5deg);box-shadow:0 1px 2px rgba(0,0,0,.2);z-index:3;pointer-events:none}
.hud-br .mini{position:relative!important;width:176px!important;height:176px!important;padding:9px!important;border:none!important;border-radius:0!important;background:radial-gradient(ellipse at 30% 20%,#f7eed6,#efe2bf 70%,#e6d6ad)!important;box-shadow:none!important;transform:rotate(-1.6deg);overflow:hidden!important;box-sizing:border-box}
.hud-br .mini canvas{display:block;width:100%!important;height:100%!important;border:none;border-radius:2px;background:#d9c9a0}
.hud-br .mini::after{content:'';position:absolute;inset:9px;pointer-events:none;background:linear-gradient(90deg,transparent calc(50% - 1px),rgba(58,42,28,.09) 50%,transparent calc(50% + 1px)),linear-gradient(0deg,transparent calc(50% - 1px),rgba(58,42,28,.08) 50%,transparent calc(50% + 1px))}
.hud-br .mini .mn{display:none!important}
`;document.head.appendChild(css);


// ---------------------------------------------------------------- PAPER MINIMAP
// The whole map is painted ONCE (biome colours, hill shading + contour lines, dirt lanes, lakes, trees, rocks, sites, spawns) onto a paper-coloured canvas;
// every frame only that picture is rotated / scrolled under the player and the live dots are drawn on top.
const INK='#3a2a1c',PAPER='#f3e9cd',DESK='#d9c9a0',PS=3;                       // PS = pixels per world unit of the painted map
const BIOME_COL=[];BIOME_COL[FOREST]=[128,166,96];BIOME_COL[JUNGLE]=[84,146,92];BIOME_COL[SAVANNA]=[216,196,116];BIOME_COL[DESERT]=[232,212,162];BIOME_COL[STONE]=[178,172,158];
const DEFCOL=[138,168,104],LANE=[226,198,146],WATER=[124,178,198],DEEP=[92,148,176],SAND=[226,214,168];
const cl=(v,a,b)=>v<a?a:v>b?b:v,mix=(a,b,t)=>a+(b-a)*t;
let pm={map:null,key:'',cv:null,x0:0,z0:0};
function treeBlob(g,x,z,r){g.fillStyle='#4a8450';g.beginPath();g.arc(x,z,r,0,6.283);g.fill();g.fillStyle='rgba(196,228,146,.5)';g.beginPath();g.arc(x-r*.28,z-r*.3,r*.5,0,6.283);g.fill()}      // colour only, no outlines
function rockBlob(g,x,z,r){g.fillStyle='#a8a193';g.beginPath();for(let i=0;i<7;i++){const a=i/7*6.283+x*3.1,q=r*(.82+.22*Math.sin(i*2.3+z));i?g.lineTo(x+Math.cos(a)*q,z+Math.sin(a)*q):g.moveTo(x+Math.cos(a)*q,z+Math.sin(a)*q)}g.closePath();g.fill();g.fillStyle='rgba(255,250,235,.4)';g.beginPath();g.arc(x-r*.25,z-r*.3,r*.35,0,6.283);g.fill()}
// torn paper edge (like the tattered cards of the character select): a ragged polygon, a bit rougher along the bottom
function tornPoly(seed=7){let q=seed;const r=()=>(q=q*16807%2147483647)/2147483647,p=[],n=34;
  for(let i=0;i<=n;i++)p.push([i/n*100,r()*1.6]);
  for(let i=1;i<n;i++)p.push([100-r()*1.6,i/n*100]);
  for(let i=n;i>=0;i--)p.push([i/n*100,100-r()*(i%3?2.2:4.2)]);
  for(let i=n-1;i>0;i--)p.push([r()*1.6,i/n*100]);
  return'polygon('+p.map(([x,y])=>x.toFixed(1)+'% '+y.toFixed(1)+'%').join(',')+')'}
function buildPaperMap(map){
  const hw=map.W/2,hh=map.H/2,w=Math.ceil(map.W*PS),h=Math.ceil(map.H*PS),cv=document.createElement('canvas');cv.width=w;cv.height=h;
  const g=cv.getContext('2d'),Wd=map.world||(map.themeName?AT.WORLD:null),arena=!!(Wd&&Wd.bw),px=(x)=>(x+hw)*PS,pz=(z)=>(z+hh)*PS;
  if(arena){
    const im=g.createImageData(w,h),d=im.data,wt=new Float32Array(NB),NX=Wd.nx,gw=NX+1;
    for(let j=0;j<h;j++)for(let i=0;i<w;i++){
      const x=-hw+(i+.5)/PS,z=-hh+(j+.5)/PS;
      // biome colour: bilinear blend of the biome weights (smooth borders)
      const fx=cl(x-Wd.x0,0,NX-.001),fz=cl(z-Wd.z0,0,Wd.nz-.001),ix=fx|0,iz=fz|0,u=fx-ix,v=fz-iz,k0=(iz*gw+ix)*NB,k1=k0+NB,k2=k0+gw*NB,k3=k2+NB;
      let r=0,gg=0,b=0;for(let q=0;q<NB;q++){const wq=mix(mix(Wd.bw[k0+q],Wd.bw[k1+q],u),mix(Wd.bw[k2+q],Wd.bw[k3+q],u),v);if(wq<.002)continue;const c=BIOME_COL[q]||DEFCOL;r+=c[0]*wq;gg+=c[1]*wq;b+=c[2]*wq}
      // hill shading (light from the top-left) + faint contour lines
      const ht=Wd.terrainAt(x,z),dh=Wd.terrainAt(x-.7,z-.7)-Wd.terrainAt(x+.7,z+.7),sh=1+cl(dh*.08,-.2,.2);r*=sh;gg*=sh;b*=sh;
      // dirt lanes
      const pd=AT.pathD(x,z);if(pd<2.3){const t=cl((2.3-pd)/.9,0,1)*.92;r=mix(r,LANE[0],t);gg=mix(gg,LANE[1],t);b=mix(b,LANE[2],t)}
      // lakes: sandy shore, light water that gets deeper in the middle, thin ink outline
      const sd=Wd.shoreDist(x,z);
      if(sd<.9){if(sd>-.3){const t=cl((.9-sd)/.9,0,1)*.7;r=mix(r,SAND[0],t);gg=mix(gg,SAND[1],t);b=mix(b,SAND[2],t)}
        if(sd<-.3){const t=cl((-sd-.3)/3,0,1);r=mix(WATER[0],DEEP[0],t);gg=mix(WATER[1],DEEP[1],t);b=mix(WATER[2],DEEP[2],t)}}
      const o=(j*w+i)*4;d[o]=r;d[o+1]=gg;d[o+2]=b;d[o+3]=255}
    g.putImageData(im,0,0)
  }else{                                                   // other maps: paper green + circle ponds
    g.fillStyle='rgb(140,170,106)';g.fillRect(0,0,w,h);
    g.fillStyle='rgb(124,178,198)';g.strokeStyle='rgba(60,100,125,.9)';g.lineWidth=1.2;(map.ponds||[]).forEach(([x,z,r])=>{g.beginPath();g.arc(px(x),pz(z),r*PS,0,6.283);g.fill();g.stroke()})}
  // trees + rocks (everything in map.obs); a rock = flagged as one, or a big collider
  const obs=map.themeName?(map.obs||[]).filter(o=>o.r<=3.2).sort((a,b)=>a.z-b.z):[];   // arena: baked once. Streamed worlds add / drop obstacles while you move, so the radar draws those live
  for(const o of obs){const rock=o.rock||o.kind==='rock'||o.type==='rock'||(o.r>1&&o.r!==.6);rock?rockBlob(g,px(o.x),pz(o.z),Math.max(1.4,o.r*PS*.95)):treeBlob(g,px(o.x),pz(o.z),Math.max(2,o.r*PS*2.6))}
  // spawn pads + sites (5v5): colour patches only
  if(map.spawn){for(const [k,c] of[['atk','58,134,214'],['def','217,71,61']]){const s=map.spawn[k];if(!s)continue;g.fillStyle=`rgba(${c},.3)`;g.beginPath();g.arc(px(s.x),pz(s.z),7*PS,0,6.283);g.fill()}}
  if(map.sites){for(const k of['A','B']){const s=map.sites[k];if(!s)continue;g.fillStyle='rgba(255,236,170,.7)';g.beginPath();g.arc(px(s.x),pz(s.z),3.6*PS,0,6.283);g.fill();
    g.fillStyle=INK;g.font="900 "+Math.round(3.6*PS*1.1)+"px Bungee,Impact,sans-serif";g.textAlign='center';g.textBaseline='middle';g.fillText(k,px(s.x),pz(s.z)+1)}}
  // paper: grain + sepia vignette + ink border
  g.globalAlpha=.07;for(let i=0;i<900;i++){g.fillStyle=i%2?'#fff':'#5a4326';g.fillRect(Math.random()*w,Math.random()*h,1.5,1.5)}g.globalAlpha=1;
  const vg=g.createRadialGradient(w/2,h/2,Math.min(w,h)*.35,w/2,h/2,Math.max(w,h)*.72);vg.addColorStop(0,'rgba(120,80,30,0)');vg.addColorStop(1,'rgba(120,80,30,.28)');g.fillStyle=vg;g.fillRect(0,0,w,h);
  return{map,key:AT.THEME,cv,x0:-hw,z0:-hh}}

export function createHUD(root=document.body){
  const $=s=>root.querySelector(s),el=(h)=>{const d=document.createElement('div');d.innerHTML=h.trim();return d.firstChild};
  const hud=$('#hud');
  hud.innerHTML=`
    <div class="hud-tl"><div class="pcard"><div class="pbadge">${PAW}</div>
      <div class="pbody"><div class="pname" id="pname">Cat</div><div class="paws" id="paws"></div>
      <div class="tmb"><i id="tmbFill"></i><span>TUMBLE <em>SPACE</em></span></div></div></div>
      <div class="sbox"><span class="lbl">SCORE</span><b id="score">000000</b>
      <div class="combo" id="combo"><span id="comboTxt">x2</span><i id="comboBar"></i></div>
      <div class="subs"><span>KOs <b id="kos">0</b></span><span>BEST <b id="bestHud">0</b></span></div></div></div>
    <div class="hud-tc"><div class="wplate"><small>WAVE</small><b id="waveN">1</b></div>
      <div class="foes"><div class="foebar"><i id="foeFill"></i></div><span id="foeTxt">&nbsp;</span></div></div>
    <div class="hud-br"><div class="mini"><canvas id="mini" width="220" height="220"></canvas><span class="mn">N</span></div></div>
    <div class="hud-bc" id="wpn">${slotHTML}</div>
    <div class="hud-ammo" id="ammo"><div class="amrow"><b id="amN">0</b><small id="amM"></small></div><div class="ambar"><i id="amFill"></i></div><span id="amHint"></span></div>
    <div class="hud-bl"><div class="hint"><kbd>LMB</kbd> shoot <kbd>RMB</kbd> scope <kbd>SPACE</kbd> tumble <kbd>1-8</kbd> / wheel weapon</div></div>`;
  
  const extra=el(`<div id="hudx"><div id="fps-crosshair"><i class="dot"></i><i class="t t1"></i><i class="t t2"></i><i class="t t3"></i><i class="t t4"></i><div id="hitm"><i></i><i></i><i></i><i></i></div></div>
    <div id="scope-ov"></div><div id="hurt"></div><div id="lowhp"></div><div id="banner"><b id="bnT"></b><span id="bnS"></span></div><div id="ebars"></div>
    
    <div id="pause" hidden><div class="card"><h2>Paused</h2><p class="pk">Click anywhere to jump back in</p>
      <div class="keys"><div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>move</span></div><div><kbd>Mouse</kbd><span>aim</span></div><div><kbd>LMB</kbd><span>shoot / slash</span></div><div><kbd>RMB</kbd><span>scope</span></div><div><kbd>SPACE</kbd><span>tumble</span></div><div><kbd>1-8</kbd><span>weapons (or mouse wheel)</span></div><div><kbd>G</kbd><span>graphics</span></div></div>
      <div class="row"><button id="resume" class="btn green">Resume</button><button id="pgfx" class="btn pink">Settings</button><button id="quit" class="btn gold">Title</button></div></div></div></div>`);
  document.body.appendChild(extra);
  const cross=$('#fps-crosshair'),hitm=$('#hitm'),scopeEl=$('#scope-ov'),hurtEl=$('#hurt'),lowEl=$('#lowhp'),bn=$('#banner'),ebars=$('#ebars'),pauseEl=$('#pause');
  const mini=$('#mini'),mc=mini.getContext('2d'),slots=[...root.querySelectorAll('#wpn .slot')];
  {const fr=mini.parentNode;if(fr)fr.style.clipPath=tornPoly()}   // tattered paper edge
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
    // ammo(cur,max,frac): max=0 hides it (unlimited ammo); frac = reload progress 0..1, or -1 when not reloading
    ammo(cur,max,frac){const a=$('#ammo');if(!max){a.style.display='none';last.am=null;return}
      a.style.display='flex';const rl=frac>=0,low=!rl&&cur<=Math.ceil(max*.25),mob=document.body.classList.contains('mobile');
      set('am',()=>{$('#amN').textContent=cur;$('#amM').textContent='/ '+max;a.classList.toggle('rl',rl);a.classList.toggle('low',low&&cur>0);a.classList.toggle('empty',!rl&&cur<=0);
        $('#amHint').textContent=rl?'RELOADING':cur<=0?(mob?'TAP R':'PRESS R'):low?(mob?'LOW':'LOW · R'):''},cur+'/'+max+'/'+rl+'/'+mob);
      if(rl)$('#amFill').style.transform=`scaleX(${Math.min(1,frac).toFixed(2)})`},
    /** 5v5 roulette: show only these weapon slots (labelled 1, 2); null = show them all again */
    loadout(list){slots.forEach((s,i)=>{const on=!list||list.includes(i);s.style.display=on?'':'none';const k=s.querySelector('kbd');if(k)k.textContent=list?(list.indexOf(i)+1||''):i+1})},
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
    /** build the painted paper map ahead of time (call it right after a new map is loaded so the first frame does not hitch) */
    prepMap(map){pm=buildPaperMap(map)},
    radar(P,enemies,pickups,map,yaw){const S=mini.width,c=S/2,R=24,k=c/R,fx=Math.sin(yaw),fz=Math.cos(yaw),rx=-Math.cos(yaw),rz=Math.sin(yaw);
      const X=(x,z)=>c+((x-P.x)*rx+(z-P.z)*rz)*k,Y=(x,z)=>c-((x-P.x)*fx+(z-P.z)*fz)*k;
      if(pm.map!==map||pm.key!==AT.THEME)pm=buildPaperMap(map);
      mc.setTransform(1,0,0,1,0,0);mc.clearRect(0,0,S,S);mc.fillStyle=DESK;mc.fillRect(0,0,S,S);
      // the painted map: rotate it with the camera and scroll it under the player
      const dx0=pm.x0-P.x,dz0=pm.z0-P.z;
      mc.setTransform(k*rx/PS,-k*fx/PS,k*rz/PS,-k*fz/PS,c+k*(rx*dx0+rz*dz0),c-k*(fx*dx0+fz*dz0));mc.drawImage(pm.cv,0,0);mc.setTransform(1,0,0,1,0,0);
      mc.save();
      if(!map.themeName){                                   // live trees / rocks around you (streamed maps)
        const lim=R*1.5,obs=map.obs||[];
        for(let i=0;i<obs.length;i++){const o=obs[i];if(o.r>3.2||Math.abs(o.x-P.x)>lim||Math.abs(o.z-P.z)>lim)continue;
          const rock=o.rock||o.kind==='rock'||o.type==='rock'||(o.r>1&&o.r!==.6);mc.fillStyle=rock?'#a8a193':'#4a8450';
          mc.beginPath();mc.arc(X(o.x,o.z),Y(o.x,o.z),Math.max(rock?2.2:3,o.r*k*(rock?.95:2.2)),0,6.283);mc.fill()}}
      // view cone
      const g=mc.createRadialGradient(c,c,0,c,c,c*.75);g.addColorStop(0,'rgba(58,42,28,.22)');g.addColorStop(1,'rgba(58,42,28,0)');mc.fillStyle=g;mc.beginPath();mc.moveTo(c,c);mc.arc(c,c,c*.75,-Math.PI/2-.55,-Math.PI/2+.55);mc.closePath();mc.fill();
      mc.shadowColor='rgba(40,28,14,.45)';mc.shadowBlur=4;           // a soft shadow lifts the dots off the paper (no outlines)
      mc.fillStyle='#e8658c';for(const p of pickups){mc.beginPath();mc.arc(X(p.x,p.z),Y(p.x,p.z),4.5,0,6.283);mc.fill()}
      for(const e of enemies){const x=X(e.x,e.z),y=Y(e.x,e.z);mc.fillStyle=e.team?(e.team==='A'?'#2f7fe0':'#e0443a'):e.k==='ranged'?'#f2a43a':'#e0443a';
        if(e.k==='ranged'){mc.beginPath();mc.moveTo(x,y-7);mc.lineTo(x+6.5,y+5);mc.lineTo(x-6.5,y+5);mc.closePath()}else{mc.beginPath();mc.arc(x,y,5.5,0,6.283)}mc.fill()}
      mc.fillStyle='#ffffff';mc.beginPath();mc.moveTo(c,c-10);mc.lineTo(c+8,c+8);mc.lineTo(c,c+3);mc.lineTo(c-8,c+8);mc.closePath();mc.fill();   // you
      mc.shadowBlur=0;mc.shadowColor='transparent';
      // north marker on the paper edge (rotates with the camera)
      {const nx=-rz,ny=fz,m=Math.max(Math.abs(nx),Math.abs(ny))||1,e=c-14,qx=c+nx/m*e,qy=c+ny/m*e;mc.fillStyle='rgba(243,233,205,.92)';mc.beginPath();mc.arc(qx,qy,10,0,6.283);mc.fill();
        mc.fillStyle=INK;mc.font="900 13px Bungee,Impact,sans-serif";mc.textAlign='center';mc.textBaseline='middle';mc.fillText('N',qx,qy+1)}
      mc.restore()}
  };
  api.show(false);
  return api}
