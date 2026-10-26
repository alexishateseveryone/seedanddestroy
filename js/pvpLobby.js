// PVP lobby screens: Host / Join (room code) / lobby with 5v5 slots. Talks to js/net.js (WebRTC, no server).
//
// Lobby messages (all start with "L" so they never collide with the match messages of 5v5.js):
//   guest -> host  {t:'Lhi',name,cfg}   I joined, here is my cat          {t:'Lmove',i}  I want slot i
//   host -> guests {t:'Ls',slots,theme}  the whole lobby state              {t:'Lgo',slots,theme,seed}  start the match
// slots = 10 x {k:'empty'|'ai'|'human', pid, name, cfg}   (0-4 = blue team, 5-9 = red team)
import {cleanCode} from './net.js';

const AI_NAMES=['Mochi','Pixel','Whisker','Biscuit','Nova','Pickle','Sushi','Ziggy','Tofu','Bean','Echo','Miso','Waffle','Pepper'];
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const clip=s=>String(s==null?'':s).slice(0,16);
const empty=()=>({k:'empty',pid:0,name:'',cfg:null});

export function createPvpLobby({$,net,showMenu,headHTML,profile,begin,themes}){
  let mode='off',slots=[],theme='',busy=false;   // mode: off | menu | join | lobby | play
  let aiN=0;

  const me=()=>slots.findIndex(s=>s.k==='human'&&s.pid===net.id);
  const aiName=()=>AI_NAMES[(aiN++)%AI_NAMES.length];
  const status=t=>{const e=$('#srStatus');if(e)e.textContent=t};
  const send=(d,to)=>net.rel(d,to);
  const pub=()=>({slots:slots.map(s=>({k:s.k,pid:s.pid,name:s.name,cfg:s.k==='human'?s.cfg:null})),theme});

  // ---------------------------------------------------------------- rendering
  function slotHTML(s,i){
    const n=`<span class="sn">#${i%5+1}</span>`,mine=s.k==='human'&&s.pid===net.id,host=net.isHost;
    if(s.k==='empty')return `<div class="cslot empty" data-i="${i}" style="--i:${i%5}"><i class="bi bi-plus-lg"></i>${host?'Add AI cat':'Take this slot'}${n}</div>`;
    const h=s.cfg&&headHTML?headHTML(s.cfg):'',head=`<span class="hd">${h||'<i class="bi bi-person-fill" style="font-size:30px"></i>'}</span>`;
    if(s.k==='ai')return `<div class="cslot ai" data-i="${i}" style="--i:${i%5}">${head}<div class="si"><b>${esc(s.name)}</b><span>AI CAT</span></div>${n}${host?'<button class="sb del" data-a="rm" title="Remove"><i class="bi bi-x-lg"></i></button>':''}</div>`;
    const tag=mine?'YOU':s.pid===1?'HOST':'PLAYER';
    return `<div class="cslot${mine?' me':''}" data-i="${i}" style="--i:${i%5}">${head}<div class="si"><b>${esc(s.name)}</b><span>${tag}</span></div>${n}${host&&!mine?'<button class="sb del" data-a="kick" title="Kick"><i class="bi bi-x-lg"></i></button>':''}</div>`;
  }
  // Only the slots that really changed are replaced (the others keep their DOM node), so adding an AI / a player joining /
  // switching places no longer rebuilds the whole lobby and replays every slot's entrance animation.
  const sigs=[];let lastFoot='',lastInfo='',lastCnt='';
  const sig=(s,mine)=>[s.k,s.pid,s.name,mine?1:0,net.isHost?1:0].join('|');
  function patch(box,from){
    const still=box.children.length===5;                       // already painted once: swap quietly, no entrance animation
    for(let j=0;j<5;j++){
      const i=from+j,s=slots[i],g=sig(s,s.k==='human'&&s.pid===net.id),cur=box.children[j];
      if(cur&&sigs[i]===g)continue;
      sigs[i]=g;const t=document.createElement('template');t.innerHTML=slotHTML(s,i).trim();const el=t.content.firstChild;
      if(still)el.classList.add('still');
      cur?box.replaceChild(el,cur):box.appendChild(el);
    }
  }
  function resetView(){sigs.length=0;lastFoot=lastInfo=lastCnt='';$('#lbA').innerHTML='';$('#lbB').innerHTML=''}
  function setText(id,v,last){if(v!==last)$(id).textContent=v;return v}
  function render(){
    if(mode!=='lobby')return;
    patch($('#lbA'),0);patch($('#lbB'),5);
    const a=slots.slice(0,5).filter(s=>s.k!=='empty').length,b=slots.slice(5).filter(s=>s.k!=='empty').length;
    lastCnt=setText('#lbCnt',`${a} v ${b}`,lastCnt);
    lastInfo=setText('#lbInfo',`Room code · ${net.code}`,lastInfo);
    const f=net.isHost?`<button class="btn gold" data-a="copy"><i class="bi bi-clipboard"></i> ${net.code}</button><button class="btn gold" data-a="theme"><i class="bi bi-map"></i> Map: ${esc(theme)}</button><button class="btn green" data-a="start"${a&&b?'':' disabled'}><i class="bi bi-play-fill"></i> Start</button>`:`<span class="msub">Waiting for the host to start…</span>`;
    if(f!==lastFoot){lastFoot=f;$('#lbFoot').innerHTML=f}
  }
  const sync=()=>{if(net.isHost){send({t:'Ls',...pub()});render()}};

  // ---------------------------------------------------------------- host
  async function openHost(){
    if(busy)return;busy=true;
    try{
      mode='lobby';resetView();showMenu('lobby');$('#lbInfo').textContent='Creating room…';
      await net.host();
      const p=profile(),ts=themes();theme=ts[(Math.random()*ts.length)|0]||'';
      slots=Array.from({length:10},empty);slots[0]={k:'human',pid:1,name:clip(p.name),cfg:p.cfg};
      render();
    }catch(e){mode='menu';net.close();showMenu('pvp');alert(e.message||'Could not create the room')}
    finally{busy=false}
  }
  function place(pid,name,cfg){                    // a guest arrives: first empty slot on the emptier team, else replace an AI cat
    const cnt=t=>slots.slice(t*5,t*5+5).filter(s=>s.k!=='empty').length,order=cnt(0)<=cnt(1)?[0,1]:[1,0];
    let i=-1;for(const t of order){i=slots.findIndex((s,j)=>j>=t*5&&j<t*5+5&&s.k==='empty');if(i>=0)break}
    if(i<0)for(const t of order){i=slots.findIndex((s,j)=>j>=t*5&&j<t*5+5&&s.k==='ai');if(i>=0)break}
    if(i<0)return false;
    slots[i]={k:'human',pid,name:clip(name)||'Cat',cfg:cfg&&typeof cfg==='object'?cfg:null};return true}
  function start(){
    const ts=slots.slice(0,5).some(s=>s.k!=='empty'),tb=slots.slice(5).some(s=>s.k!=='empty');if(!ts||!tb)return;
    net.lock(true);mode='play';
    const seed=(Math.random()*1e9)|0,p=pub();
    send({t:'Lgo',...p,seed});
    begin({host:true,mySlot:0,slots:slots.map(s=>({...s})),name:clip(profile().name),theme,seed});
  }

  // ---------------------------------------------------------------- guest
  async function join(){
    if(busy)return;const code=cleanCode($('#srCode').value);$('#srCode').value=code;
    if(code.length!==5){status('Type the 5-letter room code from the host');return}
    busy=true;status('Connecting…');
    try{
      await net.join(code);
      const p=profile();
      mode='lobby';slots=Array.from({length:10},empty);theme='';resetView();showMenu('lobby');$('#lbInfo').textContent='Joining…';$('#lbFoot').innerHTML='<span class="msub">Waiting for the host…</span>';
      send({t:'Lhi',name:clip(p.name),cfg:p.cfg});
    }catch(e){status(e.message||'Could not connect')}
    finally{busy=false}
  }

  // ---------------------------------------------------------------- shared
  function leave(){net.close();slots=[];mode='off';busy=false}
  function back(){
    if(mode==='lobby'||mode==='join'){net.close();mode='menu';showMenu('pvp');return}
    mode='off';showMenu('modes');
  }
  function openMenu(){mode='menu';showMenu('pvp')}
  function openJoin(){mode='join';showMenu('search');status('Ask the host for the room code');const c=$('#srCode');c.value='';setTimeout(()=>c.focus(),50)}

  // host / guest actions on the slot lists + footer
  function listClick(e){
    const el=e.target.closest('.cslot');if(!el||mode!=='lobby')return;
    const i=+el.dataset.i,s=slots[i],a=(e.target.closest('[data-a]')||{dataset:{}}).dataset.a;
    if(net.isHost){
      if(s.k==='empty'){slots[i]={k:'ai',pid:0,name:aiName(),cfg:null};sync()}
      else if(a==='rm'&&s.k==='ai'){slots[i]=empty();sync()}
      else if(a==='kick'&&s.k==='human'&&s.pid!==1){send({t:'Lkick'},s.pid);slots[i]=empty();sync()}
    }else if(s.k==='empty'||s.k==='ai')send({t:'Lmove',i});
  }
  function footClick(e){
    const b=e.target.closest('[data-a]');if(!b||!net.isHost||mode!=='lobby')return;
    const a=b.dataset.a;
    if(a==='copy'){try{navigator.clipboard.writeText(net.code)}catch(_){}}
    else if(a==='theme'){const ts=themes();theme=ts[(ts.indexOf(theme)+1)%ts.length]||theme;sync()}
    else if(a==='start')start();
  }
  $('#lbA').addEventListener('click',listClick);$('#lbB').addEventListener('click',listClick);$('#lbFoot').addEventListener('click',footClick);
  $('#srGo').addEventListener('click',join);
  $('#srCode').addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter')join()});
  $('#srCode').addEventListener('input',e=>{e.target.value=cleanCode(e.target.value)});
  $('#pvpHost').addEventListener('click',openHost);$('#pvpJoin').addEventListener('click',openJoin);
  ['#pvpHost','#pvpJoin'].forEach(s=>$(s).addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();$(s).click()}}));

  return{
    open:openMenu,
    leave,back,
    active:()=>mode==='menu'||mode==='join'||mode==='lobby',

    /** match / lobby data from another player; returns true when it was a lobby message */
    onPeer(from,d){
      if(!d||typeof d.t!=='string'||d.t[0]!=='L')return false;
      if(net.isHost){
        if(mode!=='lobby')return true;
        if(d.t==='Lhi'){const i=slots.findIndex(s=>s.pid===from);if(i<0&&!place(from,d.name,d.cfg))send({t:'Lkick'},from);sync()}
        else if(d.t==='Lmove'){const i=slots.findIndex(s=>s.pid===from),j=+d.i;
          if(i>=0&&j>=0&&j<10&&(slots[j].k==='empty'||slots[j].k==='ai')){slots[j]=slots[i];slots[i]=empty();sync()}}
      }else{
        if(d.t==='Ls'&&mode==='lobby'&&Array.isArray(d.slots)){slots=d.slots.slice(0,10).map(s=>s&&s.k?{k:s.k,pid:+s.pid||0,name:clip(s.name),cfg:s.cfg||null}:empty());while(slots.length<10)slots.push(empty());theme=String(d.theme||'');render()}
        else if(d.t==='Lkick'){net.close();mode='join';showMenu('search');status('You were removed from the lobby')}
        else if(d.t==='Lgo'&&mode==='lobby'){
          const sl=d.slots.map(s=>({k:s.k,pid:s.pid,name:clip(s.name),cfg:s.cfg||null})),my=sl.findIndex(s=>s.k==='human'&&s.pid===net.id);
          if(my<0)return true;mode='play';
          begin({host:false,mySlot:my,slots:sl,name:clip(profile().name),theme:String(d.theme),seed:+d.seed|0});
        }
      }
      return true;
    },

    /** room events from js/net.js: peer+ / peer- (host side), closed (the host left) */
    onSrv(m){
      if(mode==='play')return;
      if(m.t==='peer-'&&net.isHost&&mode==='lobby'){const i=slots.findIndex(s=>s.pid===m.id);if(i>=0){slots[i]=empty();sync()}}
      else if(m.t==='closed'&&!net.isHost&&(mode==='lobby')){net.close();mode='join';showMenu('search');status('The host closed the lobby')}
    }
  };
}
