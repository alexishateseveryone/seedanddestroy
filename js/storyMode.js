// STORY MODE (everything that used to live in main.js): 3 world slots, the New World screen, seeded world generation behind the loading screen,
// per-frame story rules (biome banners, day / night, autosave, cliffs too steep to climb) and the story-only inventory.
// A slot remembers the seed (plus name and where you stood); the world is generated from that seed (js/world/worldGen.js), the first time behind the
// loading screen. Same seed = same world, so nothing big has to be stored. Leaving and re-entering the same slot is instant.
// main.js hands in what this module needs (see createStory(...) there); the game variables it must change (gm, map, state...) go through `game` / `activate`.
import {generateWorld} from './world/worldGen.js';
import {buildWorldMap} from './world/worldMap.js';
import {loading} from './loadingScreen.js';
import {createInventory} from './inventory.js';
import {setOutlineNight} from './catAvatar.js';

export function createStory(c){
  const {$,scene,atm,hud,P,keys,mouse,renderer,cam,tick,game,activate,hideMenus,showMenu,enterTitle,leave5,clearAll,refill,equipIdx,lockPtr,view,quality,getCat,touch}=c;
  const WORLDN=3,WKEY='sad.worlds';
  function loadWorlds(){let s=null;try{s=JSON.parse(localStorage.getItem(WKEY))}catch(e){}if(!Array.isArray(s))s=[];s=s.slice(0,WORLDN).map(x=>x&&typeof x.seed==='number'?x:null);while(s.length<WORLDN)s.push(null);return s}
  let worlds=loadWorlds(),busy=false,storyT=0,lastBiome='',pendBiome='',biomeT=0,lastPhase='',storyMap=null,storySlot=-1,curWorld=-1,cycOn=false,tempOn=false,modal=null;   // tempOn: playing a World Editor map from js/temp/ (no saved slot, no inventory)
  const saveWorlds=()=>{try{localStorage.setItem(WKEY,JSON.stringify(worlds))}catch(e){}};
  const esc=s=>String(s).replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
  const killMap=m=>{try{m.group&&m.group.parent&&m.group.parent.remove(m.group);m.dispose&&m.dispose()}catch(e){}};
  const ago=t=>{const m=Math.max(1,Math.round((Date.now()-t)/6e4));return m<60?m+' MIN AGO':m<1440?Math.round(m/60)+' H AGO':Math.round(m/1440)+' D AGO'};

  // ---- inventory (story only): the two equipped weapons are your loadout (keys 1 / 2, wheel), artifacts show in the HUD bar
  function applyGear(){const lo=inv.weaponIdx();P.loadout=lo;hud.loadout(lo);if(!lo.includes(P.wpn))equipIdx(lo[0]);else hud.weapon(P.wpn);hud.artifacts(inv.artifactIcons())}
  const inv=createInventory({hud,keys,mouse,P,getCat,view,lockPtr,touch,onGear:applyGear,
    canOpen:()=>game.gm==='story'&&!tempOn&&game.state==='play'&&!game.paused&&!P.dead&&!P.frozen});
  // I / Tab open it, Esc / I / Tab close it, Q / E switch tabs; while it is open every other key is kept away from the game
  addEventListener('keydown',e=>{
    if(/INPUT|TEXTAREA|SELECT/.test((e.target&&e.target.tagName)||''))return;
    if(inv.isOpen()){if(e.ctrlKey||e.altKey||e.metaKey)return;
      if(e.code==='Escape'||e.code==='KeyI'||e.code==='Tab'){if(!e.repeat)inv.close()}else if(e.code==='KeyQ')inv.tab('inv');else if(e.code==='KeyE')inv.tab('col');
      e.preventDefault();e.stopImmediatePropagation();return}
    if((e.code==='KeyI'||e.code==='Tab')&&!e.repeat&&!e.ctrlKey&&!e.altKey&&!e.metaKey&&game.gm==='story'&&!tempOn&&game.state==='play'&&!game.paused){inv.open();e.preventDefault();e.stopImmediatePropagation()}
  },true);

  // ---- world slots menu
  function renderWorlds(){
    $('#worldList').innerHTML=worlds.map((w,i)=>w
      ?`<div class="cslot" data-i="${i}" style="--i:${i}"><span class="wic"><i class="bi bi-heart-fill"></i></span>
         <div class="si"><b>${esc(w.name)}</b><span>${esc(w.diff||'NORMS')} · SEED ${esc(w.seedText||w.seed.toString(36).toUpperCase())} · ${w.played?'PLAYED '+ago(w.played):'NOT VISITED YET'}</span></div><span class="sn">#${i+1}</span>
         <button class="sb" data-a="ren" title="Rename"><i class="bi bi-pencil-fill"></i></button><button class="sb del" data-a="del" title="Delete world"><i class="bi bi-trash-fill"></i></button></div>`
      :`<div class="cslot empty" data-i="${i}" style="--i:${i}"><i class="bi bi-plus-circle-fill" style="font-size:26px"></i>Generate New World<span class="sn">#${i+1}</span></div>`).join('')}
  $('#worldList').onclick=e=>{const el=e.target.closest('.cslot');if(!el||busy)return;const i=+el.dataset.i,a=e.target.closest('button')?.dataset.a;
    if(a==='del'){if(confirm('Delete '+worlds[i].name+'? The world will be gone for good.')){worlds[i]=null;saveWorlds();inv.wipe(i);if(storySlot===i&&storyMap){killMap(storyMap);storyMap=null;storySlot=-1}renderWorlds()}return}
    if(a==='ren'){const n=prompt('World name',worlds[i].name);if(n&&n.trim()){worlds[i].name=n.trim().slice(0,24);saveWorlds();renderWorlds()}return}
    if(!worlds[i]){openNewWorld(i);return}
    enterStory(i)};

  // ---- New World screen: name, seed (empty = random; a number is used as is, any other text is hashed to a number), difficulty (UI only for now)
  const DIFFS=['GGEZ','NORMS','HARD','MERCILESS'];let newSlot=-1,newDiff='NORMS';
  const hashStr=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0};
  const parseSeed=s=>{s=String(s||'').trim();if(!s)return{seed:(Math.random()*4294967295)>>>0,text:''};
    return /^\d{1,15}$/.test(s)?{seed:(Number(s)%4294967296)>>>0,text:s}:{seed:hashStr(s),text:s}};
  function setDiff(d){if(!DIFFS.includes(d))d='NORMS';newDiff=d;document.querySelectorAll('#wnDiff .dopt').forEach(b=>b.classList.toggle('on',b.dataset.v===d))}
  function openNewWorld(i){newSlot=i;$('#wnName').value='World '+(i+1);$('#wnSeed').value='';setDiff('NORMS');showMenu('wnew')}
  function createWorld(){const i=newSlot;if(i<0||worlds[i]||busy)return;
    const sd=parseSeed($('#wnSeed').value),name=($('#wnName').value.trim()||'World '+(i+1)).slice(0,24);
    worlds[i]={seed:sd.seed,seedText:sd.text,name,diff:newDiff,created:Date.now(),played:0,time:8};saveWorlds();inv.wipe(i);newSlot=-1;enterStory(i)}
  $('#wnDiff').onclick=e=>{const b=e.target.closest('.dopt');if(b)setDiff(b.dataset.v)};
  $('#wnDice').onclick=()=>{$('#wnSeed').value=String((Math.random()*1e9)|0)};
  $('#wnGo').onclick=createWorld;
  ['#wnName','#wnSeed'].forEach(s=>$(s).addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter')createWorld()}));

  // ---- playing a world
  function saveWorldPos(){if(game.gm!=='story'||curWorld<0||!worlds[curWorld])return;const w=worlds[curWorld];w.x=+P.x.toFixed(2);w.z=+P.z.toFixed(2);w.yaw=+P.camYaw.toFixed(3);if(cycOn)w.time=+atm.hour.toFixed(3);saveWorlds()}
  addEventListener('beforeunload',saveWorldPos);
  function start(i,sx,sz){
    leave5();clearAll();refill();curWorld=i;
    const w=worlds[i];activate(storyMap,sx,sz,w.yaw||0);               // main.js: gm='story', swaps the map, resets the player, shows the HUD
    inv.load(i);applyGear();equipIdx(P.loadout[0]);hud.hp(P.hp,P.max);
    storyT=0;lastBiome='';pendBiome='';biomeT=0;lastPhase='';lockPtr()}
  async function enterStory(i){
    const w=worlds[i];if(!w||busy)return;busy=true;tempOn=false;hideMenus();
    loading.tips(['Rivers always flow downhill and end in lakes.','Every biome grows its own trees, flowers and mushrooms.','Savanna grass is golden, rainforest grass is deep green.','Your world is saved in its slot: come back any time.','Mountains ring the world, rivers start high up in them.']);
    loading.show('','ADVENTURE');await tick();
    try{
      if(storySlot!==i||!storyMap){
        if(storyMap){killMap(storyMap);storyMap=null;storySlot=-1}
        const world=await generateWorld(w.seed,{onProgress:(p,t)=>loading.set(p*.55,t)});
        storyMap=buildWorldMap(world,atm.envMap);storyMap.setQuality(quality());scene.add(storyMap.group);storyMap.group.visible=false;storySlot=i}
      const sx=w.x!==undefined?w.x:storyMap.spawn.x,sz=w.z!==undefined?w.z:storyMap.spawn.z;
      loading.set(.58,'Planting trees and flowers…');
      await storyMap.primeAsync(sx,sz,60,p=>loading.set(.58+.32*p,'Planting trees and flowers…'));
      start(i,sx,sz);
      loading.set(.94,'Compiling shaders…');await tick();try{renderer.compile(scene,cam)}catch(e){}await tick();   // upload shaders + geometry behind the loading screen
      w.played=Date.now();saveWorlds();
      await loading.done();hud.banner(storyMap.biomeName(P.x,P.z),w.name);
    }catch(err){console.error(err);loading.fail('Could not build the world: '+(err&&err.message||err));await new Promise(r=>setTimeout(r,2500));loading.done();enterTitle()}
    finally{busy=false}}

  // ---- Play: modal card to pick a world. Saved worlds (the slots) + every World Editor map (Export map .js / Title map) found in js/temp/
  const TEMP_URL=new URL('./temp/',import.meta.url).href;
  async function listTemp(){
    const found=new Map(),add=(n,u)=>{if(n&&/\.m?js$/i.test(n)&&!/^index\.m?js$/i.test(n))found.set(n,u||TEMP_URL+encodeURIComponent(n))};
    try{const r=await fetch(TEMP_URL,{cache:'no-store'});if(r.ok){const html=await r.text(),re=/href="([^"?#]+)"/gi;let m;while((m=re.exec(html)))add(decodeURIComponent(m[1].split('/').pop()))}}catch(e){}
    if(!found.size)for(const idx of['index.json','worlds.json']){   // when the server hides folder listings: js/temp/index.json = ["myMap.js","island.js"]
      try{const r=await fetch(TEMP_URL+idx,{cache:'no-store'});if(!r.ok)continue;const j=await r.json();for(const f of(Array.isArray(j)?j:(j.files||j.worlds||[])))add(String(typeof f==='string'?f:(f.file||f.name||'')).split('/').pop());if(found.size)break}catch(e){}}
    return[...found].map(([name,url])=>({name,url}));
  }
  function extractObj(text,from){const s0=text.indexOf('{',from);if(s0<0)return null;let d=0,q=0,e=false;
    for(let i=s0;i<text.length;i++){const c=text[i];if(q){if(e)e=false;else if(c==='\\')e=true;else if(c===q)q=0;continue}
      if(c==='"'||c==="'"){q=c;continue}if(c==='{')d++;else if(c==='}'&&--d===0)return text.slice(s0,i+1)}return null}
  function closeModal(){if(!modal)return;removeEventListener('keydown',modalKey,true);modal.remove();modal=null}
  function modalKey(e){if(!modal)return;if(e.code==='Escape'){closeModal()}e.preventDefault();e.stopImmediatePropagation()}
  function openPlayModal(){
    if(busy||modal)return;
    const ov=document.createElement('div');modal=ov;
    ov.style.cssText='position:fixed;inset:0;z-index:99990;display:flex;align-items:center;justify-content:center;background:rgba(5,8,14,.55);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);color:#fff;font-family:inherit';
    ov.innerHTML='<div style="width:min(560px,92vw);max-height:84vh;display:flex;flex-direction:column;gap:10px;padding:18px;border-radius:22px;background:rgba(24,28,38,.9);border:1px solid rgba(255,255,255,.14);box-shadow:0 24px 70px #000a">'
      +'<div style="display:flex;align-items:center;gap:10px;font-size:18px;font-weight:700"><i class="bi bi-play-circle-fill" style="color:#ffd60a"></i><span style="flex:1">CHOOSE A WORLD</span><button data-x style="all:unset;cursor:pointer;padding:4px 8px;border-radius:8px;opacity:.7"><i class="bi bi-x-lg"></i></button></div>'
      +'<div style="overflow:auto;display:flex;flex-direction:column;gap:8px;padding-right:2px"><div data-h style="font-size:11px;letter-spacing:.12em;opacity:.55">YOUR WORLDS</div><div data-mine style="display:flex;flex-direction:column;gap:8px"></div>'
      +'<div data-h style="font-size:11px;letter-spacing:.12em;opacity:.55;margin-top:6px;display:flex;gap:8px;align-items:center">EDITOR WORLDS <span style="opacity:.8">js/temp/</span><button data-r style="all:unset;cursor:pointer;margin-left:auto;padding:2px 8px;border-radius:8px;background:rgba(255,255,255,.1)"><i class="bi bi-arrow-repeat"></i></button></div><div data-temp style="display:flex;flex-direction:column;gap:8px"></div><div data-note style="font-size:12px;opacity:.6;white-space:pre-wrap"></div></div></div>';
    document.body.append(ov);addEventListener('keydown',modalKey,true);
    const q=s=>ov.querySelector(s),row=(box,icon,title,sub,fn,off)=>{const b=document.createElement('button');
      b.style.cssText='all:unset;box-sizing:border-box;display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:14px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.1);'+(off?'opacity:.45;cursor:default':'cursor:pointer');
      b.innerHTML='<i class="bi '+icon+'" style="font-size:22px;color:#ffd60a"></i><span style="flex:1;min-width:0"><b style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(title)+'</b><span style="font-size:11px;opacity:.6">'+esc(sub)+'</span></span>'+(off?'':'<i class="bi bi-play-fill" style="font-size:20px;opacity:.7"></i>');
      if(!off){b.onmouseenter=()=>b.style.background='rgba(255,255,255,.16)';b.onmouseleave=()=>b.style.background='rgba(255,255,255,.08)';b.onclick=fn}box.append(b)};
    ov.addEventListener('pointerdown',e=>{if(e.target===ov)closeModal()});q('[data-x]').onclick=closeModal;
    const mine=q('[data-mine]');
    worlds.forEach((w,i)=>{if(w)row(mine,'bi-heart-fill',w.name,(w.diff||'NORMS')+' · SEED '+(w.seedText||w.seed.toString(36).toUpperCase())+' · '+(w.played?'PLAYED '+ago(w.played):'NOT VISITED YET'),()=>{closeModal();enterStory(i)})});
    const free=worlds.findIndex(w=>!w);
    row(mine,'bi-plus-circle-fill','Generate New World',free>=0?'Pick a name and seed':'All '+WORLDN+' world slots are used (delete one first)',()=>{closeModal();openNewWorld(free)},free<0);
    const fill=async()=>{const box=q('[data-temp]'),note=q('[data-note]');box.innerHTML='';note.textContent='Looking in js/temp/ …';
      const list=await listTemp();if(modal!==ov)return;note.textContent=list.length?'':'No World Editor maps found in js/temp/.\nExport one with "Export map .js" in the World Editor and save it there. If the server hides folder listings, add js/temp/index.json with the file names, e.g. ["myMap.js"].';
      for(const f of list)row(box,'bi-globe-americas',f.name.replace(/\.m?js$/i,''),'World Editor map',()=>{closeModal();enterTemp(f)})};
    q('[data-r]').onclick=fill;fill()}

  /** play a World Editor map (the file written by "Export map .js" / "Title map"): its data block is read and built with js/world/editorWorld.js */
  async function enterTemp(f){
    if(busy)return;busy=true;hideMenus();const title=f.name.replace(/\.m?js$/i,'');
    loading.tips(['Terrain, water and plants come straight from the World Editor.','Re-export the map from the editor to change this world.','Every biome grows its own trees, flowers and mushrooms.']);
    loading.show('',title.toUpperCase());await tick();
    try{
      loading.set(.05,'Reading '+f.name+' …');
      const text=await(await fetch(f.url,{cache:'no-store'})).text();let at=text.indexOf('const DATA=');if(at<0)at=text.indexOf('export default');
      const raw=at<0?null:extractObj(text,at);if(!raw)throw new Error(f.name+' is not a World Editor map file');
      const data=JSON.parse(raw);if(data.format!=='title-map')throw new Error(f.name+' is not a World Editor map file');
      const {buildEditorMap}=await import('./world/editorWorld.js');
      loading.set(.15,'Building the world…');
      if(storyMap){killMap(storyMap);storyMap=null;storySlot=-1}
      const map=await buildEditorMap({...data,seed:7},{env:atm.envMap,baseY:null});
      map.setQuality&&map.setQuality(quality());scene.add(map.group);map.group.visible=false;storyMap=map;storySlot=-1;
      const cat=data.cat||{x:0,z:0,rot:0};
      loading.set(.58,'Planting trees and flowers…');
      if(map.primeAsync)await map.primeAsync(cat.x,cat.z,60,p=>loading.set(.58+.32*p,'Planting trees and flowers…'));
      leave5();clearAll();refill();curWorld=-1;tempOn=true;activate(map,cat.x,cat.z,cat.rot||0);
      P.loadout=null;hud.loadout&&hud.loadout(null);equipIdx(0);hud.hp(P.hp,P.max);
      storyT=0;lastBiome='';pendBiome='';biomeT=0;lastPhase='';lockPtr();
      loading.set(.94,'Compiling shaders…');await tick();try{renderer.compile(scene,cam)}catch(e){}await tick();
      await loading.done();hud.banner(title,'EDITOR WORLD');
    }catch(err){console.error(err);tempOn=false;loading.fail('Could not build the world: '+(err&&err.message||err));await new Promise(r=>setTimeout(r,2500));loading.done();enterTitle()}
    finally{busy=false}}

  return{
    inv,
    invOpen:()=>inv.isOpen(),invSpin:()=>inv.spin(),toggle:()=>inv.toggle(),
    renderWorlds,
        /** Play: opens the world picker card */
    play(){openPlayModal()},   // Play: a modal card (your saved worlds + World Editor maps found in js/temp/)
    openWorlds(){renderWorlds();showMenu('worlds')},   // old world list (no longer reachable from the menu)
    setQuality(q){storyMap&&storyMap.setQuality(q)},
    /** called every frame of a story world (game logic, not while the inventory is open) */
    tick(dt){storyT+=dt;hud.hp(P.hp,P.max);
      setOutlineNight(cycOn?atm.night:0);                          // cat outlines get darker as night falls
      if(cycOn){const ph=atm.night>.55?'night':'day';if(ph!==lastPhase){if(lastPhase)hud.banner(ph==='night'?'Night falls':'A new day begins','');lastPhase=ph}}
      const n=storyMap.biomeName?storyMap.biomeName(P.x,P.z):'';     // banner when you walk into a new biome (after standing in it a moment)
      if(n!==pendBiome){pendBiome=n;biomeT=0}else{biomeT+=dt;if(biomeT>1.2&&n!==lastBiome){lastBiome=n;if(n)hud.banner(n,'')}}
      if(storyT>6){storyT=0;saveWorldPos()}},
    /** day / night: only while you play a story world; every other mode keeps the fixed sun */
    cycle(playing){const want=game.gm==='story'&&playing;
      if(want!==cycOn){if(!want&&worlds[curWorld]){worlds[curWorld].time=+atm.hour.toFixed(3);saveWorlds()}
        cycOn=want;const w=worlds[curWorld];atm.setCycle(want,want?(w&&w.time!==undefined?w.time:8):undefined)}},
    /** cliffs are too steep to climb: undo this frame's move */
    blockSlope(px,pz){const m=game.map;if(m&&m.world&&m.world.slopeAt(P.x,P.z,.8)>1.3){P.x=px;P.z=pz}},
    /** leaving story mode (called from main.js leave5, while gm is still 'story') */
    leave(){tempOn=false;setOutlineNight(0);saveWorldPos();storyMap&&(storyMap.group.visible=false);document.body.classList.remove('story');inv.close(true)}}}
