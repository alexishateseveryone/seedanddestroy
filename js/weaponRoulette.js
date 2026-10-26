// 3D WEAPON ROULETTE (5v5): two slot-machine drums covered in real weapon models spin and stop on ONE random ranged weapon (left drum) and ONE random melee weapon (right drum).
//   import {spinRoulette} from './js/weaponRoulette.js';
//   const picks = await spinRoulette(WEAPONS, {count:2, wait:loadingDonePromise});     // -> [rangedIndex, meleeIndex]  (indexes into WEAPONS)
// It draws with its own small WebGL renderer inside a paper-style card (no changes to the game renderer), and removes everything when it is done.
// Weapons are shown with weapon.build().group (the same models the game uses). No buttons: it builds itself hidden while the loading screen is still up ({wait:promise}), starts spinning the moment that promise resolves, and closes by itself a moment after both drums stop.
import * as T from 'three';

const R=2.6,M=10;                                         // drum radius, weapons per drum
const CSS=`
#wr{pointer-events:none;position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at 50% 45%,rgba(60,38,16,.78),rgba(14,9,4,.9));font-family:'Baloo 2',system-ui,sans-serif;opacity:0;transition:opacity .25s}
#wr.on{opacity:1}
#wr .wrap{position:relative;filter:drop-shadow(0 10px 14px rgba(0,0,0,.55));transform:rotate(-.6deg) scale(.96);transition:transform .35s cubic-bezier(.2,1.3,.4,1)}
#wr.on .wrap{transform:rotate(-.6deg) scale(1)}
#wr .wrap::before{content:'';position:absolute;top:-11px;left:50%;width:84px;height:22px;margin-left:-42px;background:rgba(255,226,140,.88);transform:rotate(2deg);box-shadow:0 1px 2px rgba(0,0,0,.25);z-index:2}
#wr .card{width:min(94vw,680px);padding:26px 24px 18px;box-sizing:border-box;text-align:center;color:#3a2a1c;background:radial-gradient(ellipse at 30% 12%,#f9f0da,#efe2bf 70%,#e4d3a6)}
#wr h2{margin:0;font:400 32px/1 'Bungee',Impact,sans-serif;letter-spacing:.05em}
#wr p{margin:6px 0 12px;font:700 14px 'Baloo 2',sans-serif;opacity:.75}
#wr .stage{position:relative;border-radius:8px;background:radial-gradient(ellipse at 50% 55%,#fff6dc 0,#f1e3bd 55%,#dfcb98 100%);box-shadow:inset 0 0 22px rgba(120,80,30,.35),0 0 0 3px rgba(120,80,30,.18);overflow:hidden}
#wr .stage::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(60,35,10,.38),transparent 26%,transparent 74%,rgba(60,35,10,.38));pointer-events:none}
#wr .sel{position:absolute;top:50%;width:41%;height:46%;transform:translate(-50%,-50%);border:3px solid rgba(58,42,28,.55);border-radius:12px;box-shadow:0 0 0 2px rgba(255,255,255,.4),inset 0 0 18px rgba(255,255,255,.35);z-index:1;transition:border-color .3s,box-shadow .3s}
#wr .sel::before,#wr .sel::after{content:'';position:absolute;top:50%;margin-top:-7px;border:7px solid transparent}
#wr .sel::before{left:-17px;border-left-color:rgba(58,42,28,.7)}#wr .sel::after{right:-17px;border-right-color:rgba(58,42,28,.7)}
#wr .sel.done{border-color:#e8a317;box-shadow:0 0 0 2px #fff3b0,0 0 22px 4px rgba(255,190,40,.75),inset 0 0 18px rgba(255,230,140,.6);animation:wrpop .5s}
@keyframes wrpop{0%{transform:translate(-50%,-50%) scale(1)}40%{transform:translate(-50%,-50%) scale(1.07)}100%{transform:translate(-50%,-50%) scale(1)}}
#wr canvas{display:block;width:100%;aspect-ratio:2/1}
#wr .names{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}
#wr .nm{padding:7px 8px 9px;border-radius:8px;background:rgba(255,255,255,.42);min-height:56px;border:2px dashed rgba(58,42,28,.25);transition:background .3s,border-color .3s}
#wr .nm small{display:block;font:800 11px 'Baloo 2',sans-serif;letter-spacing:.16em;opacity:.6}
#wr .nm b{display:block;font:400 21px/1.1 'Bungee',Impact,sans-serif;opacity:.25;transition:opacity .3s,transform .3s}
#wr .nm.done{background:rgba(255,248,214,.9);border:2px solid #e8a317}
#wr .nm.done b{opacity:1;transform:scale(1.06)}
`;

const rnd=a=>a[(Math.random()*a.length)|0],shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=(Math.random()*(i+1))|0;[a[i],a[j]]=[a[j],a[i]]}return a};
function tornPoly(){let q=11;const r=()=>(q=q*16807%2147483647)/2147483647,p=[],n=30;
  for(let i=0;i<=n;i++)p.push([i/n*100,r()*1.4]);for(let i=1;i<n;i++)p.push([100-r()*1.4,i/n*100]);
  for(let i=n;i>=0;i--)p.push([i/n*100,100-r()*(i%3?2:3.6)]);for(let i=n-1;i>0;i--)p.push([r()*1.4,i/n*100]);
  return'polygon('+p.map(([x,y])=>x.toFixed(1)+'% '+y.toFixed(1)+'%').join(',')+')'}

// a weapon model, centred, long side along X, scaled to a common size
function normalised(w){
  const g=w.build().group,wrap=new T.Group();wrap.add(g);
  let box=new T.Box3().setFromObject(wrap),sz=box.getSize(new T.Vector3());
  // side view like the weapons overview: barrel / blade pointing RIGHT (weapons are built along -Y), grip + magazine hanging DOWN
  if(sz.y>=sz.x&&sz.y>=sz.z)g.rotation.z=Math.PI/2;
  else if(sz.z>=sz.x&&sz.z>=sz.y)g.rotation.y=-Math.PI/2;
  wrap.updateMatrixWorld(true);box=new T.Box3().setFromObject(wrap);box.getSize(sz);
  // roll around the barrel axis so the off-axis mass (grip, magazine, stock) points down
  {const c0=box.getCenter(new T.Vector3()),v=new T.Vector3();let n=0,my=0,mz=0;
    g.traverse(o=>{if(o.isMesh&&o.geometry&&o.geometry.attributes.position){const p=o.geometry.attributes.position;for(let k=0;k<p.count;k+=2){v.fromBufferAttribute(p,k).applyMatrix4(o.matrixWorld);my+=v.y-c0.y;mz+=v.z-c0.z;n++}}});
    if(n){my/=n;mz/=n;if(Math.hypot(my,mz)>.04*Math.max(sz.y,sz.z,.01)){wrap.rotation.x=Math.PI-Math.atan2(mz,my);wrap.updateMatrixWorld(true);box=new T.Box3().setFromObject(wrap);box.getSize(sz)}}}
  const c=box.getCenter(new T.Vector3()),s=2.6/Math.max(sz.x,sz.y*1.6,.01);
  wrap.position.sub(c);
  const h=new T.Group();h.add(wrap);h.scale.setScalar(s);return h}

export function spinRoulette(WEAPONS,{count=2,wait=null}={}){
  return new Promise((resolve,reject)=>{
    let renderer=null,raf=0,root=null,autoT=0,closed=false;
    // drum 0 = ranged weapons, drum 1 = melee weapons: the match always gets one random gun AND one random melee weapon
    const all=WEAPONS.map((_,i)=>i),guns=all.filter(i=>WEAPONS[i].kind==='gun'),melee=all.filter(i=>WEAPONS[i].kind!=='gun'),
      pools=guns.length&&melee.length?[guns,melee]:[all,all],
      picks=pools.map((p,i)=>{const a=p[(Math.random()*p.length)|0];return pools[0]===pools[1]&&i&&p.length>1?rnd(p.filter(x=>x!==a)):a}).slice(0,Math.max(2,count));
    if(pools[0]===pools[1]&&picks[0]===picks[1])picks[1]=rnd(all.filter(x=>x!==picks[0])||all);
    const swallow=e=>{e.stopPropagation()};                                   // while the card is open, keys must not reach the game (Esc = pause ...)
    const finish=ok=>{if(closed)return;closed=true;clearTimeout(autoT);cancelAnimationFrame(raf);removeEventListener('keydown',swallow,true);removeEventListener('keyup',swallow,true);
      try{renderer&&(renderer.dispose(),renderer.forceContextLoss&&renderer.forceContextLoss())}catch(e){}
      if(root){const r=root;r.classList.remove('on');setTimeout(()=>r.remove(),260)}
      ok?resolve(picks.slice()):reject(new Error('roulette failed'))};
    try{
      if(!document.getElementById('wr-css')){const st=document.createElement('style');st.id='wr-css';st.textContent=CSS;document.head.appendChild(st)}
      root=document.createElement('div');root.id='wr';
      root.innerHTML=`<div class="wrap"><div class="card"><h2>WEAPON ROULETTE</h2><p>Two random weapons for this match</p>
        <div class="stage"><canvas></canvas>${picks.map((_,i)=>`<div class="sel" style="left:${25+i*50}%"></div>`).join('')}</div>
        <div class="names">${picks.map((_,i)=>`<div class="nm"><small>WEAPON ${i+1}</small><b>?</b></div>`).join('')}</div></div></div>`;
      root.querySelector('.card').style.clipPath=tornPoly();
      document.body.appendChild(root);                                        // invisible (opacity 0) until `wait` resolves
      addEventListener('keydown',swallow,true);addEventListener('keyup',swallow,true);

      const canvas=root.querySelector('canvas'),W=Math.max(320,Math.min(innerWidth*.9,640)-48),H=W/2;
      renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(W,H,false);renderer.setClearColor(0,0);
      const scene=new T.Scene(),cam=new T.PerspectiveCamera(32,2,.1,60);cam.position.set(0,0,11);cam.lookAt(0,0,0);
      scene.add(new T.AmbientLight('#ffffff',1.1));const key=new T.DirectionalLight('#fff4dc',2.4);key.position.set(3,5,7);scene.add(key);const rim=new T.DirectionalLight('#9fd0ff',.8);rim.position.set(-5,2,-3);scene.add(rim);

      // models: built once per weapon, cloned for every drum slot (clones share geometry + materials)
      const proto=new Map(),model=i=>{let p=proto.get(i);if(!p){p=normalised(WEAPONS[i]);proto.set(i,p)}return p.clone(true)};
      const drums=picks.map((target,di)=>{
        const others=shuffle(pools[di].filter(i=>i!==target)),list=[];
        const t=(Math.random()*M)|0;for(let k=0;k<M;k++)list.push(k===t?target:others[k%Math.max(1,others.length)]);
        const g=new T.Group();g.position.x=(di-(picks.length-1)/2)*4.8;scene.add(g);
        const body=new T.Mesh(new T.CylinderGeometry(R*.8,R*.8,3.2,36,1,true),new T.MeshBasicMaterial({color:'#e9d9ae',transparent:true,opacity:.45,side:T.DoubleSide,depthWrite:false}));body.rotation.z=Math.PI/2;g.add(body);
        const items=list.map((wi,k)=>{const a=k/M*Math.PI*2,it=new T.Group();it.add(model(wi));it.position.set(0,Math.sin(a)*R,Math.cos(a)*R);it.rotation.x=-a;g.add(it);return it});
        return{g,items,t,target,thetaT:t/M*Math.PI*2+Math.PI*2*(5+di*2),dur:2400+di*900,done:false}});

      const names=[...root.querySelectorAll('.nm')];
      let t0=0,started=false;
      const allDone=()=>drums.every(d=>d.done);
      const sels=[...root.querySelectorAll('.sel')];
      const reveal=i=>{const d=drums[i];d.done=true;const w=WEAPONS[d.target],n=names[i];n.classList.add('done');sels[i]&&sels[i].classList.add('done');n.querySelector('b').textContent=w.name;n.querySelector('small').textContent='WEAPON '+(i+1);
        if(allDone())autoT=setTimeout(()=>finish(true),1700)};
      const frame=now=>{
        if(closed)return;const t=now-t0;
        drums.forEach((d,i)=>{const p=Math.min(1,t/d.dur),e=1-Math.pow(1-p,4);d.g.rotation.x=d.thetaT*e;
          if(p>=1&&!d.done)reveal(i);
          if(d.done){const w=d.items[d.t].children[0];w.rotation.y=Math.sin(now*.0025+i)*.3;w.scale.setScalar(1+.05*Math.sin(now*.004+i))}});
        renderer.render(scene,cam);raf=requestAnimationFrame(frame)};
      // warm-up: upload every model / shader now (hidden, behind the loading screen) so the first visible frame does not hitch
      try{renderer.compile(scene,cam);renderer.render(scene,cam)}catch(e){}
      const begin=()=>{if(closed||started)return;started=true;root.classList.add('on');t0=performance.now();raf=requestAnimationFrame(frame)};
      Promise.resolve(wait).then(begin,begin);
    }catch(e){console.error(e);finish(false)}
  })}
