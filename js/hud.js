// In-game HUD: player card, wave/score, minimap, crosshair. (Touch controls live in js/mobile.js.)
import * as T from 'three';
import {WEAPONS} from './weapons/index.js';
import {BLASTER,WEAPON_ICONS as ICONS} from './weaponIcons.js';
import {createBigMap} from './bigMap.js';
import * as AT from './arenaTerrain.js';                       // 5v5 arena: biomes, dirt lanes, lakes (live bindings: always the map that is loaded now)
import {NB,FOREST,JUNGLE,SAVANNA,DESERT,STONE} from './world/biomes.js';

const PAW='<svg class="paw"><use href="#paw"/></svg>';
const BAG='<svg viewBox="0 0 24 24"><path d="M4.5 8.5h15l1 11.5h-17z" fill="currentColor"/><path d="M8.5 8.5V6.8a3.5 3.5 0 0 1 7 0v1.7" fill="none" stroke="currentColor" stroke-width="2"/><rect x="10.2" y="12.5" width="3.6" height="3" rx=".6" fill="#2b1d17"/></svg>';
const DASH='<svg viewBox="0 0 24 24"><path d="M3 5l8 7-8 7v-4l4.5-3L3 9zM12 5l8 7-8 7v-4l4.5-3L12 9z" fill="currentColor"/></svg>';


// ---- the health heart: a ragged (tattered paper) heart outline, built once. A red "water" level rises and falls inside it, two waves drift across.
const HEART=(()=>{let q=11;const r=()=>(q=q*16807%2147483647)/2147483647,N=72,pts=[];
  for(let i=0;i<N;i++){const t=i/N*Math.PI*2,x=16*Math.sin(t)**3,y=13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t);
    const dx=16*3*Math.sin(t)**2*Math.cos(t),dy=-13*Math.sin(t)+10*Math.sin(2*t)+6*Math.sin(3*t)+4*Math.sin(4*t),l=Math.hypot(dx,dy)||1,nx=dy/l,ny=-dx/l;   // outward normal
    const j=(i%5===0?r()*3.2-.4:r()*1.5-.35);                                    // every few points a bigger torn notch
    pts.push([(50+x*2.82+nx*j).toFixed(1),(37-y*2.62+ny*-j).toFixed(1)])}
  return'M'+pts.map(p=>p.join(',')).join('L')+'Z'})();
const WAVE=(a,y=0)=>`M0,${y}`+Array.from({length:4},(_,i)=>`Q${i*50+25},${y+(i%2?a:-a)} ${i*50+50},${y}`).join('')+'V130H0Z';   // 4 half-waves = 2 periods (200 wide, slides 100 per loop)
const HEART_SVG=`<svg class="hb-heart" id="hbHp" viewBox="0 0 100 92"><defs><clipPath id="hbHC"><path d="${HEART}"/></clipPath></defs>
  <path d="${HEART}" fill="#1a0b0a"/>
  <g clip-path="url(#hbHC)"><g class="liq" id="hpLiq" style="transform:translateY(-6px)">
    <g class="wv wv2"><path d="${WAVE(3.2,1.5)}" fill="#9d1118" opacity=".85"/></g>
    <g class="wv"><path d="${WAVE(3.6)}" fill="#d9232b"/></g>
    <path d="M0,24H200V130H0Z" fill="#c4161c" opacity=".0"/>
    <circle class="bub" cx="40" cy="80" r="2.2"/><circle class="bub" cx="58" cy="86" r="1.7"/><circle class="bub" cx="49" cy="70" r="1.4"/>
  </g></g>
  <path d="${HEART}" fill="none" stroke="#f1e8d2" stroke-width="2.6" stroke-linejoin="bevel" opacity=".92"/>
  <text id="hpTxt" x="50" y="50">5/5</text></svg>`;

const BAR_CSS=`
/* ---- minimap key hint + full-screen map (M) */
.hud-br .mini .mk{position:absolute;right:13px;bottom:11px;z-index:2;font:800 10px/1 var(--mono);color:#f1e8d2;background:rgba(58,42,28,.82);padding:3px 5px;border-radius:2px;pointer-events:none}
body.mobile .hud-br{pointer-events:auto}
/* ---- bottom-centre bar: [bag] [health bar] [weapon 1][weapon 2] [artifact x3] [dash]   (bag + dash are story-only) */
.hud-tl .pcard{display:none}
.hb{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);display:flex;align-items:center;gap:12px;padding:12px 22px;isolation:isolate;color:var(--cream);font-family:var(--font);
  filter:drop-shadow(0 4px 0 rgba(0,0,0,.55)) drop-shadow(0 8px 14px rgba(0,0,0,.4))}
.hb::before{content:'';position:absolute;inset:0;z-index:-1;background:linear-gradient(#2b1d17,#17100d);clip-path:var(--L2)}
.hb-grp{display:flex;gap:8px;align-items:center}
.hb-i,.hb-d{position:relative;width:46px;height:46px;display:grid;place-items:center;color:var(--cream)}
.hb-i svg,.hb-d svg{width:30px;height:30px}
#hud .hb kbd{position:absolute;font:800 10px/1 var(--mono);color:var(--k);background:none;border:0;padding:0;margin:0;opacity:.6}
#hud .hb-i kbd{right:-2px;bottom:-3px;color:var(--cream);background:rgba(0,0,0,.55);padding:2px 4px;border-radius:2px;opacity:.9}
.hb-heart{position:relative;flex:none;width:84px;height:78px;margin:-22px 0 -10px;overflow:visible;filter:drop-shadow(0 3px 0 rgba(0,0,0,.6))}
.hb-heart .liq{transition:transform .45s cubic-bezier(.3,.8,.3,1)}
.hb-heart .wv{animation:hbwave 2.6s linear infinite}.hb-heart .wv2{animation-duration:4.1s;animation-direction:reverse}
@keyframes hbwave{to{transform:translateX(-100px)}}
.hb-heart .bub{fill:#ffd0c4;opacity:0;animation:hbbub 3.4s ease-in infinite}.hb-heart .bub:nth-of-type(2){animation-delay:1.1s}.hb-heart .bub:nth-of-type(3){animation-delay:2.2s}
@keyframes hbbub{0%{opacity:0;transform:translateY(0)}15%{opacity:.7}100%{opacity:0;transform:translateY(-30px)}}
.hb-heart text{font:400 17px var(--disp);letter-spacing:.04em;fill:#fff;text-anchor:middle;paint-order:stroke;stroke:rgba(40,6,8,.85);stroke-width:3.5px;stroke-linejoin:round}
.hb.low .hb-heart{animation:hbbeat .8s ease-in-out infinite;transform-origin:50% 55%}@keyframes hbbeat{20%{transform:scale(1.09)}40%{transform:scale(.97)}60%{transform:scale(1.05)}}
.hb.low .hb-heart .liq{filter:brightness(1.3)}
.hb-s{position:relative;isolation:isolate;width:54px;height:54px;display:grid;place-items:center;color:var(--k)}
.hb-s::before{content:'';position:absolute;inset:0;z-index:-1;background:var(--grain) var(--paper);clip-path:var(--s3);transition:background-color .12s}
.hb-grp .hb-s:nth-child(2)::before{clip-path:var(--s6)}.hb-grp .hb-s:nth-child(3)::before{clip-path:var(--s5)}
.hb-s .ic{display:grid;place-items:center;width:30px;height:30px}.hb-s .wi{width:100%;height:100%}
#hud .hb-s kbd{left:6px;top:4px}
.hb-s.empty{opacity:.5}
.hb-w .hb-s.on{color:var(--cream);opacity:1}.hb-w .hb-s.on::before{background-color:var(--blood)}
.hb-s .nm{display:none;position:absolute;left:50%;bottom:calc(100% + 14px);transform:translateX(-50%);white-space:nowrap;font:800 13px var(--font);letter-spacing:.1em;text-transform:uppercase;text-shadow:var(--ol);color:var(--cream)}
.hb-w .hb-s.on .nm{display:block}
.hb-a .hb-s{width:46px;height:46px}.hb-a .hb-s .ic{width:26px;height:26px}
.hb-d .df{position:absolute;left:5px;right:5px;bottom:1px;height:4px;border-radius:9px;background:rgba(241,232,210,.22);overflow:hidden}
.hb-d .df i{display:block;height:100%;background:var(--cream);transform-origin:left;transform:scaleX(1)}
.hb-d.rdy{color:#8fe3ff}.hb-d.rdy .df i{background:#8fe3ff}
body:not(.story) .hb-i,body:not(.story) .hb-d{display:none}
@media (max-width:900px){.hb{transform:translateX(-50%) scale(.8);transform-origin:bottom center}}
body.mobile .hb{left:calc(8px + env(safe-area-inset-left));top:8px;bottom:auto;transform:scale(.62);transform-origin:top left}
body.mobile .hb-s .nm{display:none!important}
body.mobile .hud-tl{top:62px}
`;
const css=document.createElement('style');css.textContent=BAR_CSS+`
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
    <div class="hud-tl"><div class="sbox"><span class="lbl">SCORE</span><b id="score">000000</b>
      <div class="combo" id="combo"><span id="comboTxt">x2</span><i id="comboBar"></i></div>
      <div class="subs"><span>KOs <b id="kos">0</b></span><span>BEST <b id="bestHud">0</b></span></div></div></div>
    <div class="hud-tc"><div class="wplate"><small>WAVE</small><b id="waveN">1</b></div>
      <div class="foes"><div class="foebar"><i id="foeFill"></i></div><span id="foeTxt">&nbsp;</span></div></div>
    <div class="hud-br"><div class="mini"><canvas id="mini" width="220" height="220"></canvas><span class="mn">N</span><span class="mk">M</span></div></div>
    <div class="hb" id="hbar">
      <div class="hb-i" id="hbInv">${BAG}<kbd>I</kbd></div>
      ${HEART_SVG}
      <div class="hb-grp hb-w" id="hbW">${[0,1].map(n=>`<div class="hb-s empty" data-n="${n}"><kbd>${n+1}</kbd><span class="ic"></span><span class="nm"></span></div>`).join('')}</div>
      <div class="hb-grp hb-a" id="hbA">${[0,1,2].map(n=>`<div class="hb-s empty" data-n="${n}"><span class="ic"></span></div>`).join('')}</div>
      <div class="hb-d" id="hbD">${DASH}<div class="df"><i id="hbDf"></i></div></div>
    </div>
    <div class="hud-ammo" id="ammo"><div class="amrow"><b id="amN">0</b><small id="amM"></small></div><div class="ambar"><i id="amFill"></i></div><span id="amHint"></span></div>
    <div class="hud-bl"><div class="hint"><kbd>LMB</kbd> shoot <kbd>RMB</kbd> scope <kbd>SPACE</kbd> jump <kbd>SHIFT</kbd> roll <kbd>1-2</kbd> / wheel weapon <kbd>M</kbd> map <kbd>I</kbd> inventory</div></div>`;
  
  const extra=el(`<div id="hudx"><div id="fps-crosshair"><i class="dot"></i><i class="t t1"></i><i class="t t2"></i><i class="t t3"></i><i class="t t4"></i><div id="hitm"><i></i><i></i><i></i><i></i></div></div>
    <div id="scope-ov"></div><div id="hurt"></div><div id="lowhp"></div><div id="banner"><b id="bnT"></b><span id="bnS"></span></div><div id="ebars"></div>
    
    <div id="pause" hidden><div class="card"><h2>Paused</h2><p class="pk">Click anywhere to jump back in</p>
      <div class="keys"><div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>move</span></div><div><kbd>Mouse</kbd><span>aim</span></div><div><kbd>LMB</kbd><span>shoot / slash</span></div><div><kbd>RMB</kbd><span>scope</span></div><div><kbd>SPACE</kbd><span>tumble</span></div><div><kbd>1-8</kbd><span>weapons (or mouse wheel)</span></div><div><kbd>G</kbd><span>graphics</span></div></div>
      <div class="row"><button id="resume" class="btn green">Resume</button><button id="pgfx" class="btn pink">Settings</button><button id="quit" class="btn gold">Title</button></div></div></div></div>`);
  document.body.appendChild(extra);
  const cross=$('#fps-crosshair'),hitm=$('#hitm'),scopeEl=$('#scope-ov'),hurtEl=$('#hurt'),lowEl=$('#lowhp'),bn=$('#banner'),ebars=$('#ebars'),pauseEl=$('#pause');
  const mini=$('#mini'),mc=mini.getContext('2d');
  const hbar=$('#hbar'),wEls=[...root.querySelectorAll('#hbW .hb-s')],aEls=[...root.querySelectorAll('#hbA .hb-s')];
  let slotsW=[0,1],curW=0;                                           // weapon indices shown in the two weapon slots, and the one in your hands
  const drawW=()=>wEls.forEach((e,n)=>{const i=slotsW[n],w=i!=null?WEAPONS[i]:null;e.classList.toggle('empty',!w);e.classList.toggle('on',!!w&&i===curW);
    e.querySelector('.ic').innerHTML=w?(ICONS[w.id]||BLASTER):'';e.querySelector('.nm').textContent=w?w.name:''});
  {const fr=mini.parentNode;if(fr)fr.style.clipPath=tornPoly()}   // tattered paper edge
  // ---- full-screen map page (js/bigMap.js): M or a tap on the minimap opens it; main.js freezes the game while it is open
  const bm=createBigMap({onChange:b=>{document.body.classList.toggle('bigmap',b);api.onMap&&api.onMap(b)}});
  {const fr=mini.parentNode;if(fr)fr.addEventListener('click',()=>api.bigmap(true))}   // touch: tap the minimap
  const v=new T.Vector3(),pool=[];let last={};
  const set=(k,fn,val)=>{if(last[k]!==val){last[k]=val;fn(val)}};
  const api={
    show(b){hud.hidden=!b;extra.style.display=b?'block':'none';if(!b){this.pause(false);bn.className='';this.bigmap(false)}},
    reset(){last={};this.banner('','');hurtEl.style.opacity=0;ebars.innerHTML='';pool.length=0},
    name(n){hbar.dataset.name=n||'Cat'},
    hp(hp,max){set('hp',()=>{$('#hpLiq').style.transform=`translateY(${(-5+(1-(max?Math.max(0,Math.min(1,hp/max)):0))*104).toFixed(1)}px)`;$('#hpTxt').textContent=Math.max(0,hp)+'/'+max;
      const lo=hp<=1&&hp>0;lowEl.classList.toggle('on',lo);hbar.classList.toggle('low',lo)},hp+'/'+max)},
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
    /** the two weapon slots: list = weapon indices (labelled 1, 2; an empty list = empty hands); null = the default pair */
    loadout(list){slotsW=list?[list[0]??null,list[1]??null]:[0,1];drawW()},
    weapon(w){curW=w;drawW()},
    /** the three artifact slots: [{icon,name}|null x3] */
    artifacts(list){aEls.forEach((e,n)=>{const a=list&&list[n];e.classList.toggle('empty',!a);e.querySelector('.ic').innerHTML=a?a.icon:'';e.title=a?a.name:''})},
    banner(t,s='',cls=''){bn.className='';$('#bnT').textContent=t;$('#bnS').textContent=s;if(!t)return;void bn.offsetWidth;bn.className='on '+cls},
    hit(kill){hitm.className='';void hitm.offsetWidth;hitm.className=kill?'kill':'hit'},
    hurt(){hurtEl.style.transition='none';hurtEl.style.opacity=.95;void hurtEl.offsetWidth;hurtEl.style.transition='opacity .7s ease-out';hurtEl.style.opacity=0},
    pause(b){pauseEl.hidden=!b;if(b)this.bigmap(false)},
    onMap:null,                                       // main.js sets this: called with true / false when the map page opens / closes
    bigmap(b){bm.set(b)},
    bigmapOn:()=>bm.isOpen(),
    bigradar(P,enemies,pickups,map){bm.draw(P,enemies,pickups,map)},
    scope(a){scopeEl.style.opacity=a;cross.style.opacity=1-a*.7},
    crosshair(spread,vis){cross.style.display=vis?'block':'none';cross.style.setProperty('--sp',spread.toFixed(1)+'px')},
    tumble(frac){set('tmb',()=>{$('#hbDf').style.transform=`scaleX(${Math.max(0,Math.min(1,frac))})`;$('#hbD').classList.toggle('rdy',frac>=1)},Math.round(frac*40))},
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
  drawW();
  api.show(false);
  return api}
