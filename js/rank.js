// Ranked play for 5v5 Spike Rush: 8 tiers x 3 divisions x 100 RR (Legend is open-ended), saved in localStorage.
// The rank decides how good the 9 AI cats in your lobby are (see skillOf / rollLobby, used by 5v5.js + enemies/playersAi.js).
const KEY='sad.rank',PER=300,RR=100,ROMAN=['','I','II','III'];
export const TIERS=[
  {n:'Kitten',c:'#a9b0bd'},{n:'Stray',c:'#c58b55'},{n:'Alley Cat',c:'#d7dde8'},{n:'Tabby',c:'#ffd54a'},
  {n:'Panther',c:'#58d6c8'},{n:'Tiger',c:'#ff8a3c'},{n:'Lion',c:'#ff6a9a'},{n:'Legend',c:'#b88aff'}];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),rnd=(a,b)=>a+Math.random()*(b-a),gauss=()=>(Math.random()+Math.random()+Math.random()-1.5)*1.15;

export function info(rp){
  rp=Math.max(0,Math.round(rp));const ti=Math.min(7,Math.floor(rp/PER)),t=TIERS[ti],top=ti===7;
  const within=top?rp-PER*7:rp-ti*PER,div=top?0:Math.floor(within/RR)+1,rr=top?within:within%RR;
  return{rp,tier:ti,div,rr,name:t.n,color:t.c,label:top?'Legend':`${t.n} ${ROMAN[div]}`,pct:top?Math.min(100,rr%100):rr,top,
    chevrons:top?3:div,key:ti*4+div}
}
const fresh=()=>({rp:300,matches:0,wins:0,losses:0,peak:300,form:[]});
export function load(){try{return Object.assign(fresh(),JSON.parse(localStorage.getItem(KEY)||'{}'))}catch(e){return fresh()}}
const save=s=>{try{localStorage.setItem(KEY,JSON.stringify(s))}catch(e){}};

// result of a finished match: a:rounds won by your team, b: rounds won by the enemy, k/d: your kills / deaths
export function applyMatch({win,a,b,k,d}){
  const s=load(),before=info(s.rp),placement=s.matches<3,perf=clamp((k-d)/6,-1,1);
  let delta=win?20+Math.abs(a-b)*2+perf*6:-(18-perf*5-Math.min(a,b)*1.5);
  delta=Math.round(win?clamp(delta,12,40):clamp(delta,-26,-6));
  if(placement)delta=Math.round(delta*(win?1.8:.6));
  s.rp=Math.max(0,s.rp+delta);s.matches++;win?s.wins++:s.losses++;s.peak=Math.max(s.peak,s.rp);s.form=[...s.form.slice(-9),win?1:0];save(s);
  const after=info(s.rp);
  return{before,after,delta,placement,promoted:after.key>before.key,demoted:after.key<before.key,rec:{w:s.wins,l:s.losses}};
}

// AI skill 0..1 from a rating (Kitten ~0.22 ... Legend ~0.96). 5v5 AI uses it for reaction time, aim error, dodging, scoping, retreating...
export const skillOf=rp=>.22+.74*Math.pow(Math.min(1,rp/2100),.85);
export const botOf=rp=>{rp=Math.max(0,rp);return{rp,rank:info(rp),skill:clamp(skillOf(rp)+gauss()*.04,.15,.97)}};
// matchmaking: 4 allies a little below you (you carry), 5 enemies around your rank with a random edge
export function rollLobby(rp){
  const edge=rnd(-70,90),ally=()=>botOf(rp-25+gauss()*70),foe=()=>botOf(rp+edge+gauss()*70);
  const A=Array.from({length:4},ally),B=Array.from({length:5},foe),avg=l=>l.reduce((s,b)=>s+b.rp,0)/l.length;
  return{A,B,avgA:Math.round((avg(A)*4+rp)/5),avgB:Math.round(avg(B))};
}

// ---------------------------------------------------------------- visuals
export function badge(inf,size=30){
  const c=inf.color,n=inf.chevrons,ys=n===1?[17]:n===2?[14,20]:[12,17,22];
  return `<svg viewBox="0 0 32 32" width="${size}" height="${size}" class="rkbadge"><path d="M16 2l12 5v9c0 7-5 12-12 14C9 28 4 23 4 16V7z" fill="${c}" stroke="#14151a" stroke-width="2"/><path d="M16 4.5l9.5 4v7.5c0 5.5-4 9.7-9.5 11.5" fill="#fff" opacity=".18"/>${ys.map(y=>`<path d="M10.5 ${y}l5.5 3 5.5-3" fill="none" stroke="#14151a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}</svg>`;
}
// tiny canvas version for the in-world name plates
export function drawBadge(g,x,y,r,inf){
  g.save();g.translate(x,y);g.beginPath();g.moveTo(0,-r);g.lineTo(r*.9,-r*.6);g.lineTo(r*.9,r*.2);g.quadraticCurveTo(r*.8,r*.9,0,r*1.05);g.quadraticCurveTo(-r*.8,r*.9,-r*.9,r*.2);g.lineTo(-r*.9,-r*.6);g.closePath();
  g.fillStyle=inf.color;g.fill();g.lineWidth=3;g.strokeStyle='#14151a';g.stroke();g.strokeStyle='#14151a';g.lineWidth=2.4;g.lineCap='round';
  const n=inf.chevrons,ys=n===1?[r*.15]:n===2?[-r*.1,r*.3]:[-r*.3,r*.05,r*.4];
  ys.forEach(yy=>{g.beginPath();g.moveTo(-r*.45,yy);g.lineTo(0,yy+r*.3);g.lineTo(r*.45,yy);g.stroke()});g.restore();
}
export function renderPill(el){
  if(!el)return;const s=load(),i=info(s.rp);
  el.innerHTML=`${badge(i,34)}<div class="rkt"><b>${i.label}</b><div class="rkbar"><i style="width:${i.pct}%"></i></div></div><small>${i.rr} RR<br>${s.wins}W ${s.losses}L</small>`;
}

const css=document.createElement('style');css.textContent=`
.rkpill{display:flex;align-items:center;gap:10px;background:rgba(43,33,80,.6);border:3px solid #ffffff30;border-radius:18px;padding:6px 14px 6px 10px;color:#fff;margin:0 0 6px;min-width:230px;box-sizing:border-box}
.rkpill .rkt{flex:1}.rkpill .rkt b{display:block;font:800 17px/1 'Baloo 2',sans-serif;letter-spacing:.02em}
.rkpill small{font:500 11px/1.3 'DM Mono',monospace;opacity:.75;text-align:right;letter-spacing:.06em}
.rkbar{height:6px;border-radius:9px;background:#ffffff26;overflow:hidden;margin-top:5px}.rkbar i{display:block;height:100%;background:var(--lemon,#ffd54a);border-radius:9px;transition:width 1.1s cubic-bezier(.2,.8,.2,1)}
.rkbox{background:#f4e6cf;border-radius:18px;padding:10px 16px 12px;margin:12px 0 4px;text-align:left;color:var(--ink,#2b2150)}
.rkbox .rkh{display:flex;align-items:center;gap:12px}.rkbox .rkh>div{flex:1}.rkbox .rkh b.rkn{display:block;font:800 22px/1 'Baloo 2',sans-serif}
.rkbox .rkh small{font:700 11px 'DM Mono',monospace;letter-spacing:.1em;opacity:.55}
.rkbox .rkd{font:400 22px 'Bungee',sans-serif}.rkbox .rkd.up{color:#2f8a2a}.rkbox .rkd.dn{color:#c0392b}
.rkbox .rkbar{background:#00000018}.rkbox .rkbar i{background:#5fcf4a}.rkbox.dn .rkbar i{background:#e8453c}
.rkbox .rkx{font:400 15px 'Bungee',sans-serif;text-align:center;margin-top:8px;letter-spacing:.08em}
`;document.head.appendChild(css);