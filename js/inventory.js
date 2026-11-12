// Story-mode inventory screen (Inventory / Collectibles tabs), drawn as a solid pixel-cloud card (bumpy chunky edge, a few stray pixel chunks).
// main.js slides the camera view so the cat stands in the free left area and turns to face the camera while this screen is open.
// Layout: the character stands on the LEFT (main.js slides the camera view); the pixel-cloud card sits on the RIGHT with the tabs + close on top and items | details below (no inner box).
//   Tabs and item cards are plain flat cards with no outline; drag anywhere outside the card to turn the character.
//   INVENTORY    : 2 weapon slots, 3 armor slots (headgear, chestplate, boots), 3 artifact slots, 5 curse-object slots.
//                  Click a slot to see the item, then click an item in the list to equip it.
//   COLLECTIBLES : every item collected so far.
// Progress is saved per world slot (localStorage "sad.inv.<slot>").
import {ITEMS,SLOTS,SLOT,SECTIONS,GROUP_LABEL,GROUP_ORDER,GROUP_TITLE,GHOST,RARITY,START} from './items.js';

const KEYP='sad.inv.';
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

const css=document.createElement('style');css.textContent=`
body.inv-open #hud,body.inv-open #fps-crosshair,body.inv-open #ebars,body.inv-open #banner,body.inv-open #mob{display:none!important}
#inv{--ink:#2a1d18;--cr:#fbf3dc;--tan:#ecdcb2;--tan2:#dcc994;--edge:#cdb98a;--teal:#5cc4b2;--teald:#4aa595;--red:#b3392b;--M:70px;--pw:min(46vw,720px);--gap:40px;   /* card width + its gap to the screen edge: main.js (invViewF) uses the same numbers to place the character */
 
  position:fixed;inset:0;z-index:1200;color:var(--ink);font-family:var(--font);touch-action:none;-webkit-user-select:none;user-select:none;cursor:grab}
#inv[hidden]{display:none}
#inv button{font-family:inherit}
/* stepped pixel box: one flat fill with notched corners, no outline */
#inv .px{--f:var(--tan);--b:var(--edge);--n:4px;position:relative;isolation:isolate;appearance:none;border:0;background:none;color:var(--ink)}
#inv .px::before,#inv .px::after{content:'';position:absolute;z-index:-1;
  clip-path:polygon(0 var(--n),var(--n) var(--n),var(--n) 0,calc(100% - var(--n)) 0,calc(100% - var(--n)) var(--n),100% var(--n),100% calc(100% - var(--n)),calc(100% - var(--n)) calc(100% - var(--n)),calc(100% - var(--n)) 100%,var(--n) 100%,var(--n) calc(100% - var(--n)),0 calc(100% - var(--n)))}
#inv .px::before{display:none}   /* no outline layer */
#inv .px::after{inset:0;background:var(--f);--n:3px}
#inv button.px{cursor:pointer;transition:transform .08s steps(2)}
#inv button.px:hover{--f:#fff8e2;transform:translateY(-2px)}
#inv button.px:active{transform:translateY(1px)}
/* the card: a soft cream body whose edges dissolve into drifting smoke (drawn on the canvas behind the content) */
#inv .iv-cloud{position:absolute;right:var(--gap);top:50%;width:var(--pw);height:min(82vh,720px);--ty:-50%;transform:translateY(var(--ty));transform-origin:100% 50%;cursor:default;animation:ivPop .3s cubic-bezier(.2,.9,.3,1.12) both}
#inv.closing{pointer-events:none}
#inv .iv-fx{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}   /* round particles: burst when the card pops in, blown off the card when it dissolves */
#inv .iv-cv{position:absolute;left:calc(-1*var(--M));top:calc(-1*var(--M));width:calc(100% + 2*var(--M));height:calc(100% + 2*var(--M));pointer-events:none;image-rendering:pixelated}
#inv .iv-cv2{position:absolute;left:calc(-1*var(--M));top:calc(-1*var(--M));width:calc(100% + 2*var(--M));height:calc(100% + 2*var(--M));pointer-events:none}   /* smooth layer: the loose round chunks around the card */
@keyframes ivPop{0%{transform:translateY(var(--ty)) scale(.6);opacity:0}100%{transform:translateY(var(--ty)) scale(1);opacity:1}}
#inv .iv-in{position:absolute;inset:0;display:flex;flex-direction:column;gap:12px;padding:34px 44px 34px}
#inv .iv-top{display:flex;gap:14px;justify-content:center;flex:none}
#inv .iv-top button{min-width:0;flex:1;padding:9px 14px 10px;font:400 clamp(15px,2.3vmin,21px)/1 var(--disp);letter-spacing:.08em;--f:#f6ecd0;white-space:nowrap}
#inv .iv-top button:hover{--f:#fffdf4}
#inv .iv-top button.on{--f:#fffdf4}
#inv .iv-top button.iv-x{flex:none}
#inv kbd{font:700 10px/1 var(--mono);background:var(--ink);border-radius:2px;padding:3px 4px;margin-left:8px;vertical-align:middle;color:var(--cr)}
#inv .iv-body{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:22px;padding:0}
#inv .iv-main,#inv .iv-det{min-height:0;overflow-y:auto;scrollbar-width:none;padding:6px 2px 18px;cursor:auto}
#inv .iv-main::-webkit-scrollbar,#inv .iv-det::-webkit-scrollbar{display:none}
#inv .iv-gp{display:flex;align-items:center;flex-wrap:wrap;gap:6px 16px;margin:0 0 12px}
#inv .iv-gp small{font:800 12px var(--font);letter-spacing:.2em;display:block;opacity:.7}
#inv .iv-gp b{font:400 clamp(30px,5vmin,44px)/1 var(--disp)}
#inv .iv-chips{display:flex;gap:6px;flex-wrap:wrap}
#inv .iv-chip{display:flex;flex-direction:column;align-items:center;min-width:46px;padding:3px 8px;background:var(--tan);font:400 17px/1.1 var(--disp);clip-path:polygon(0 3px,3px 3px,3px 0,calc(100% - 3px) 0,calc(100% - 3px) 3px,100% 3px,100% 100%,0 100%)}
#inv .iv-chip span{font:800 9px var(--font);letter-spacing:.16em;opacity:.65}
#inv .iv-sec{margin:0 0 14px}
#inv .iv-sec h4{margin:0 0 7px;font:800 12px var(--font);letter-spacing:.24em;opacity:.7}
#inv .iv-row,#inv .iv-grid{display:flex;flex-wrap:wrap;gap:10px}
#inv .iv-s,#inv .iv-t{width:var(--ts,56px);height:var(--ts,56px);padding:0;display:grid;place-items:center}
#inv .iv-s.sel,#inv .iv-t.sel{--f:#fffdf4}
#inv .iv-s.empty{opacity:.6}
#inv .iv-s .wi,#inv .iv-t .wi{width:60%;height:60%}
#inv .iv-s.empty .wi{opacity:.35}
#inv .iv-s em,#inv .iv-t em{position:absolute;right:4px;bottom:4px;font:800 10px/1 var(--font);font-style:normal;padding:2px 4px;color:var(--cr);background:#6b6253}
#inv .iv-s em.r-rare,#inv .iv-t em.r-rare{background:#2b6cb0}
#inv .iv-s em.r-unique,#inv .iv-t em.r-unique{background:#c2640a}
#inv .iv-t{--ts:64px}
#inv .iv-t b{position:absolute;left:-6px;right:-6px;bottom:-17px;text-align:center;font:800 10px var(--font);letter-spacing:.03em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#inv .iv-grid{row-gap:28px}
#inv .iv-cnt{font:800 12px var(--font);letter-spacing:.2em;margin:0 0 14px;opacity:.75}
#inv .iv-eqd{display:inline-block;font:800 10px var(--font);letter-spacing:.22em;background:var(--ink);color:var(--cr);padding:3px 9px;margin:0 0 9px}
#inv .iv-nh{display:flex;gap:12px;align-items:center;margin:0 0 8px}
#inv .iv-ic{flex:none;display:grid;place-items:center;width:58px;height:58px}
#inv .iv-ic .wi{width:100%;height:100%}
#inv .iv-pw{font:400 28px/1 var(--disp);display:flex;align-items:center;gap:10px}
#inv .iv-pw small{font:800 10px var(--font);letter-spacing:.16em;color:var(--cr);background:#6b6253;padding:3px 7px}
#inv .iv-pw small.r-rare{background:#2b6cb0}#inv .iv-pw small.r-unique{background:#c2640a}
#inv .iv-det h3{margin:2px 0 0;font:400 clamp(19px,3vmin,26px)/1.05 var(--disp);color:var(--red)}
#inv .iv-gr{font:800 11px var(--font);letter-spacing:.16em;text-transform:uppercase;opacity:.55}
#inv .iv-ds{margin:7px 0 10px;font:800 15px/1.3 var(--font);opacity:.85}
#inv .iv-ln{display:flex;justify-content:space-between;font:800 14px var(--font);padding:5px 0;border-top:2px dotted var(--tan2)}
#inv .iv-ln span:first-child{opacity:.6}
#inv .iv-sw{margin:14px 0 6px;font:800 11px var(--font);letter-spacing:.22em;opacity:.65}
#inv .iv-r{width:100%;display:flex;align-items:center;gap:10px;padding:8px 12px;margin:0 0 7px;text-align:left;font:800 15px var(--font);--n:3px}
#inv .iv-r .ic{flex:none;width:28px;height:28px;display:grid;place-items:center}
#inv .iv-r .wi{width:100%;height:100%}
#inv .iv-r b{flex:1;font-weight:800;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#inv .iv-r em{font:400 15px var(--disp);font-style:normal}
#inv .iv-r small{font:800 9px var(--font);letter-spacing:.14em;opacity:.55}
#inv .iv-un{margin:4px 0;padding:8px 14px;font:800 13px var(--font);letter-spacing:.14em}
#inv .iv-empty{opacity:.65;font:800 15px var(--font)}
@media (max-width:1000px),(max-height:560px){
  #inv{--M:44px}
  #inv .iv-in{padding:26px 22px;gap:8px}
  #inv .iv-top{gap:6px}#inv .iv-top button{padding:6px 6px 7px;font-size:13px;letter-spacing:.03em}
  #inv kbd{display:none}
  #inv .iv-body{display:block;overflow-y:auto;scrollbar-width:none}
  #inv .iv-main,#inv .iv-det{overflow:visible;padding:8px 6px}
  #inv .iv-s{--ts:50px}#inv .iv-t{--ts:56px}
}
/* phones in portrait: the card becomes a bottom sheet, the character stays above it */
@media (max-width:760px){
  #inv{--pw:96vw;--gap:2vw}
  #inv .iv-cloud{top:auto;bottom:3vh;height:min(56vh,520px);--ty:0px;transform-origin:50% 100%}
}
@media (prefers-reduced-motion:reduce){#inv .iv-cloud{animation:none!important}}`;document.head.appendChild(css);

// ---- the card: one flat solid blob drawn with small square pixels (3px, 2px on small screens). Its bumpy edge (lobes) breathes quickly, ROUND chunks drift off it and re-form,
//      and on close it dissolves pixel by pixel (a random threshold per pixel, sweeping left -> right) while every pixel that goes becomes a round particle.
function pixelCloud(cv,ov,inner){
  const g=cv.getContext('2d'),og=ov.getContext('2d'),TAU=Math.PI*2,FILL='rgb(251,243,220)',B=.35;   // B = how wide (random) the dissolving front is
  let W=0,H=0,M=0,PX=3,K=2,raf=0,running=false,last=0,lobes=[],stray=[],mask=null,img=null,th=null,dis=null,dead=false;   // K = how many of our pixels fit in the old 6px pixel
  const rr=Math.random,clearMask=()=>{inner.style.maskImage='';inner.style.webkitMaskImage=''};
  function edgePt(d,a,b){let x,y,nx,ny;const x0=M,y0=M;if(d<a){x=x0+d;y=y0;nx=0;ny=-1}else if(d<a+b){x=x0+a;y=y0+d-a;nx=1;ny=0}else if(d<2*a+b){x=x0+a-(d-a-b);y=y0+b;nx=0;ny=1}else{x=x0;y=y0+b-(d-2*a-b);nx=-1;ny=0}return{x,y,nx,ny}}
  function resp(c,warm){const a=W-2*M,b=H-2*M,e=edgePt(rr()*2*(a+b),a,b);c.x=e.x;c.y=e.y;c.nx=e.nx;c.ny=e.ny;c.sz=1+((rr()*rr()*4)|0);c.sp=(2.6+rr()*5.5)*K;c.life=1.5+rr()*2.1;c.age=warm?rr()*c.life:0;c.d0=(2+rr()*5)*K;c.ph=rr()*TAU;return c}
  function size(){const w=cv.offsetWidth,h=cv.offsetHeight;if(!w)return false;PX=w<700?2:3;K=6/PX;const nw=Math.max(30,Math.round(w/PX)),nh=Math.max(24,Math.round(h/PX));
    if(nw!==W||nh!==H){W=nw;H=nh;cv.width=W;cv.height=H;img=g.createImageData(W,H);mask=new Uint8Array(W*H);
      const d=Math.min(devicePixelRatio||1,2);ov.width=Math.round(w*d);ov.height=Math.round(h*d);
      M=Math.round((parseFloat(getComputedStyle(cv.parentNode.parentNode).getPropertyValue('--M'))||70)/PX);
      const a=W-2*M,b=H-2*M,per=2*(a+b),rb=5.2*K,n=Math.round(per/(rb*1.9));lobes=[];
      for(let k=0;k<n;k++){const e=edgePt(per*k/n,a,b);lobes.push({x:e.x,y:e.y,r:rb*(.7+.55*rr()),ph:rr()*TAU,sp:.6+rr()*.9})}
      for(const[cx,cy]of[[M,M],[M+a,M],[M+a,M+b],[M,M+b]])lobes.push({x:cx,y:cy,r:rb*1.25,ph:rr()*TAU,sp:.9})
      stray=[];for(let k=0;k<48;k++)stray.push(resp({},true));
      // dissolve order: each pixel gets a threshold = how far left->right it is, blended with noise (part per pixel, part per 3x3 block so it breaks into crumbs)
      th=new Float32Array(W*H);const bw=Math.ceil(W/3)+1,br=new Float32Array(bw*(Math.ceil(H/3)+1));for(let i=0;i<br.length;i++)br[i]=rr();
      for(let y=0;y<H;y++)for(let x=0;x<W;x++){const pos=Math.min(1,Math.max(0,(x-M)/Math.max(1,a))),rn=.6*br[((y/3)|0)*bw+((x/3)|0)]+.4*rr();th[y*W+x]=pos*(1-B)+rn*B}}
    return true}
  function frame(t,dt){
    if(dead){g.clearRect(0,0,W,H);og.clearRect(0,0,ov.width,ov.height);return}
    const x0=M,y0=M,x1=W-M,y1=H-M;mask.fill(0);
    for(let y=y0;y<y1;y++)mask.fill(1,y*W+x0,y*W+x1);
    for(const L of lobes){const r=L.r*(1+.2*Math.sin(t*L.sp*3.6+L.ph)),r2=r*r,ya=Math.max(0,Math.floor(L.y-r)),yb=Math.min(H-1,Math.ceil(L.y+r));   // fast breathing edge
      for(let y=ya;y<=yb;y++){const dy=y-L.y,dx=Math.sqrt(Math.max(0,r2-dy*dy)),xa=Math.max(0,Math.ceil(L.x-dx)),xb=Math.min(W-1,Math.floor(L.x+dx));if(xb>=xa)mask.fill(1,y*W+xa,y*W+xb+1)}}
    if(dis){   // dissolving: pixels whose threshold the front has passed disappear, and some of them fly off as round particles
      const u=Math.min(1,(t-dis.t0)/dis.dur),p=u<.5?2*u*u:1-2*(1-u)*(1-u),sp=.02*PX*PX/9;
      for(let i=0,n=W*H;i<n;i++){if(!mask[i])continue;const v=th[i];if(v<=p){mask[i]=0;if(v>dis.pp&&rr()<sp)dis.emit(dis.l+((i%W)-M+.5)*PX,dis.t+(((i/W)|0)-M+.5)*PX)}}
      dis.pp=p;dis.p=p;const f=(p-.5*B)/(1-B);   // the texts / items fade out along the same front
      inner.style.maskImage=inner.style.webkitMaskImage='linear-gradient(to right,transparent '+((f-.12)*100).toFixed(1)+'%,#000 '+((f+.12)*100).toFixed(1)+'%)';
      if(u>=1)dis.fin=true}
    const d=img.data;for(let i=0,n=W*H;i<n;i++){const o=i*4;if(mask[i]){d[o]=251;d[o+1]=243;d[o+2]=220;d[o+3]=255}else d[o+3]=0}
    g.putImageData(img,0,0);
    // loose chunks: smooth round dots that grow in, drift off the edge and shrink away
    og.clearRect(0,0,ov.width,ov.height);og.fillStyle=FILL;og.beginPath();const s=ov.width/W,sw=Math.max(1,W-2*M);
    for(const c of stray){c.age+=dt;if(c.age>=c.life){resp(c,false);continue}
      const u=c.age/c.life,k=c.d0+c.sp*c.age,x=c.x+c.nx*k+Math.sin(t*1.6+c.ph)*1.6*K,y=c.y+c.ny*k+Math.cos(t*1.4+c.ph)*1.6*K-u*1.5*K,env=Math.min(1,u/.15,(1-u)/.15);
      if(env<=.05||(dis&&(x-M)/sw<=dis.p))continue;const r=c.sz*s*.5*env,X=(x+c.sz/2)*s,Y=(y+c.sz/2)*s;og.moveTo(X+r,Y);og.arc(X,Y,r,0,TAU)}
    og.fill();
    if(dis&&dis.fin){const q=dis;dis=null;dead=true;q.done&&q.done()}}
  function loop(now){if(!running)return;raf=requestAnimationFrame(loop);if(now-last<(dis?14:42))return;const dt=Math.min(.12,(now-last)/1000||.042);last=now;if(size())frame(now/1000,dt)}
  return{start(){dis=null;dead=false;clearMask();if(running)return;running=true;last=performance.now();W=H=0;raf=requestAnimationFrame(loop)},
    stop(){running=false;cancelAnimationFrame(raf);dis=null;dead=false;clearMask();og.clearRect(0,0,ov.width,ov.height)},
    cancel(){dis=null;dead=false;clearMask()},resize(){W=H=0},
    // r = the card's screen rect; emit(x,y) is called (screen px) for the pixels that become particles; done() when the card is gone
    dissolve(dur,r,emit,done){dead=false;dis={t0:performance.now()/1000,dur,l:r.l,t:r.t,emit,done,pp:-1,p:0,fin:false}}}}

// ---- round particles on a full-screen, smooth (not pixelated) layer
function pixelBurst(cv){
  const g=cv.getContext('2d'),TAU=Math.PI*2,COL=['#fbf3dc','#fbf3dc','#fff9e6','#ecdcb2','#dcc994'],rr=Math.random;
  let ps=[],raf=0,last=0;
  function prep(){const d=Math.min(devicePixelRatio||1,2),w=Math.round(innerWidth*d),h=Math.round(innerHeight*d);if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h}g.setTransform(d,0,0,d,0,0)}
  function tick(now){const dt=Math.min(.05,(now-last)/1000||.016);last=now;g.clearRect(0,0,innerWidth,innerHeight);
    for(let i=ps.length-1;i>=0;i--){const p=ps[i];p.age+=dt;if(p.age>=p.life){ps[i]=ps[ps.length-1];ps.pop();continue}
      const dr=Math.exp(-dt*p.dr);p.vx*=dr;p.vy=p.vy*dr+p.g*dt;p.x+=p.vx*dt;p.y+=p.vy*dt}
    for(let c=0;c<COL.length;c++){g.fillStyle=COL[c];g.beginPath();   // one path per colour; each dot shrinks away over its life
      for(const p of ps){if(p.c!==c)continue;const u=p.age/p.life,r=p.r*(1-u*u);if(r<.3)continue;g.moveTo(p.x+r,p.y);g.arc(p.x,p.y,r,0,TAU)}g.fill()}
    if(ps.length)raf=requestAnimationFrame(tick);else{raf=0;g.clearRect(0,0,innerWidth,innerHeight)}}
  const kick=()=>{if(!raf){last=performance.now();raf=requestAnimationFrame(tick)}};
  return{prep,
    clear(){ps.length=0;g.clearRect(0,0,innerWidth,innerHeight)},
    // a bit of the card blown away to the right / up (used for every pixel that dissolves)
    puff(x,y){if(ps.length>2800)return;ps.push({x,y,vx:50+rr()*230+(rr()-.5)*70,vy:-(10+rr()*130)+(rr()-.5)*70,g:-15,dr:1.7,life:.45+rr()*.5,age:0,r:1.1+rr()*rr()*2.6,c:(rr()*COL.length)|0});kick()},
    // r = the card's screen rect: round particles burst out of its edge as it pops in
    burst(r){prep();const cx=r.l+r.w/2,cy=r.t+r.h/2,s=.9,w=r.w*s,h=r.h*s,l=cx-w/2,t=cy-h/2,per=2*(w+h);
      for(let k=0;k<300;k++){let x,y;const d=rr()*per;if(d<w){x=l+d;y=t}else if(d<w+h){x=l+w;y=t+d-w}else if(d<2*w+h){x=l+w-(d-w-h);y=t+h}else{x=l;y=t+h-(d-2*w-h)}
        let dx=x-cx,dy=y-cy;const len=Math.hypot(dx,dy)||1;dx/=len;dy/=len;const sp=140+rr()*420,a=(rr()-.5)*.9,ca=Math.cos(a),sa=Math.sin(a);
        ps.push({x,y,vx:(dx*ca-dy*sa)*sp,vy:(dx*sa+dy*ca)*sp,g:60,dr:2.4,life:.5+rr()*.5,age:0,r:1.2+rr()*rr()*3.4,c:(rr()*COL.length)|0})}
      kick()}}}

export function createInventory(o){
  const {hud,keys,mouse,P,getCat,lockPtr,touch,canOpen,onGear}=o;   // (the camera shift that puts the character on the left is done in main.js, see invViewF)
  let world=-1,st=fresh(),isOpen=false,tab='inv',sel='w0',selItem=null,spin=0,cloud=null,fx=null,closeT=0;
  const root=document.createElement('div');root.id='inv';root.hidden=true;document.body.appendChild(root);

  function fresh(){return{owned:new Set(START.owned),eq:{...START.eq},level:1}}
  function fixWeapons(){const own=[...st.owned].filter(id=>ITEMS[id]&&ITEMS[id].grp==='weapon');
    if(!st.eq.w0||!st.owned.has(st.eq.w0))st.eq.w0=own[0];
    if(!st.eq.w1||!st.owned.has(st.eq.w1)||st.eq.w1===st.eq.w0)st.eq.w1=own.find(id=>id!==st.eq.w0)||st.eq.w0}
  function load(i){world=i;st=fresh();
    try{const j=JSON.parse(localStorage.getItem(KEYP+i)||'null');
      if(j){(j.owned||[]).forEach(id=>{if(ITEMS[id])st.owned.add(id)});
        for(const s of SLOTS){if(!j.eq||!(s.id in j.eq))continue;const id=j.eq[s.id];if(id===null&&s.grp!=='weapon')st.eq[s.id]=null;else if(id&&ITEMS[id]&&ITEMS[id].grp===s.grp&&st.owned.has(id))st.eq[s.id]=id}
        if(+j.level>0)st.level=+j.level}}catch(e){}
    fixWeapons()}
  function save(){if(world<0)return;try{localStorage.setItem(KEYP+world,JSON.stringify({owned:[...st.owned],eq:st.eq,level:st.level}))}catch(e){}}
  function wipe(i){try{localStorage.removeItem(KEYP+i)}catch(e){}}
  fixWeapons();

  const it=sid=>st.eq[sid]?ITEMS[st.eq[sid]]:null;
  function stats(){const eq=SLOTS.map(s=>it(s.id)).filter(Boolean),sum=(ids,k)=>ids.reduce((a,s)=>a+((it(s)&&it(s)[k])||0),0);
    const def=['head','chest','boots'].reduce((a,s)=>a+((it(s)&&(it(s).lines.find(l=>l[0]==='Defense')||[0,0])[1])||0),0);
    return{gp:eq.length?Math.round(eq.reduce((a,b)=>a+b.power,0)/eq.length):0,atk:Math.round(sum(['w0','w1'],'power')/2),def,art:sum(['a0','a1','a2'],'power'),crs:['c0','c1','c2','c3','c4'].filter(s=>it(s)).length}}

  // ---- rendering
  const slotBtn=sid=>{const s=SLOT[sid],x=it(sid);
    return`<button class="px iv-s${selItem===null&&sel===sid&&tab==='inv'?' sel':''}${x?'':' empty'}" data-s="${sid}" title="${GROUP_LABEL[s.grp]}">${x?x.icon+`<em class="r-${x.rarity}">${x.power}</em>`:GHOST[s.grp]}</button>`};
  const card=(x,equipped)=>`${equipped?'<div class="iv-eqd">EQUIPPED</div>':''}
    <div class="iv-nh"><span class="iv-ic">${x.icon}</span><div><div class="iv-pw">${x.power}<small class="r-${x.rarity}">${RARITY[x.rarity]}</small></div><h3>${esc(x.name)}</h3><span class="iv-gr">${GROUP_LABEL[x.grp]}</span></div></div>
    <p class="iv-ds">${esc(x.desc)}</p>${x.lines.map(l=>`<div class="iv-ln"><span>${esc(l[0])}</span><span>${esc(l[1])}</span></div>`).join('')}`;
  function detail(){
    if(tab==='col'){const x=selItem&&ITEMS[selItem];return x?card(x,Object.values(st.eq).includes(x.id)):'<div class="iv-empty">Pick an item to read about it.</div>'}
    const s=SLOT[sel],cur=it(sel);
    const pool=[...st.owned].map(id=>ITEMS[id]).filter(x=>x.grp===s.grp&&x.id!==st.eq[sel]).sort((a,b)=>b.power-a.power);
    const used=id=>SLOTS.some(q=>q.grp===s.grp&&q.id!==sel&&st.eq[q.id]===id);
    return(cur?card(cur,true)+(s.grp==='weapon'?'':'<button class="px iv-un" data-un="1">UNEQUIP</button>'):`<div class="iv-empty">Empty ${GROUP_LABEL[s.grp].toLowerCase()} slot.</div>`)
      +`<div class="iv-sw">${cur?'SWAP WITH':'EQUIP'}</div>`
      +(pool.length?pool.map(x=>`<button class="px iv-r" data-i="${x.id}"><span class="ic">${x.icon}</span><b>${esc(x.name)}</b>${used(x.id)?'<small>IN USE</small>':''}<em>${x.power}</em></button>`).join(''):'<div class="iv-empty">Nothing else collected for this slot yet.</div>')}
  function main(){
    if(tab==='inv'){const S=stats();
      return`<div class="iv-gp"><div><small>GEAR POWER</small><b>${S.gp}</b></div><div class="iv-chips"><div class="iv-chip">${S.atk}<span>ATK</span></div><div class="iv-chip">${S.def}<span>DEF</span></div><div class="iv-chip">${S.art}<span>ART</span></div><div class="iv-chip">${S.crs}/5<span>CURSE</span></div></div></div>`
        +SECTIONS.map(sc=>`<div class="iv-sec"><h4>${sc.name}</h4><div class="iv-row">${sc.slots.map(slotBtn).join('')}</div></div>`).join('')}
    const total=Object.keys(ITEMS).length;
    return`<div class="iv-cnt">COLLECTED ${st.owned.size} / ${total}</div>`+GROUP_ORDER.map(g=>{
      const list=[...st.owned].map(id=>ITEMS[id]).filter(x=>x.grp===g);if(!list.length)return'';
      return`<div class="iv-sec"><h4>${GROUP_TITLE[g].toUpperCase()}</h4><div class="iv-grid">${list.map(x=>`<button class="px iv-t${selItem===x.id?' sel':''}" data-c="${x.id}" title="${esc(x.name)}">${x.icon}<em class="r-${x.rarity}">${x.power}</em><b>${esc(x.name)}</b></button>`).join('')}</div></div>`}).join('')}
  function render(){
    if(!root.firstChild){root.innerHTML=`<div class="iv-cloud"><canvas class="iv-cv"></canvas><canvas class="iv-cv2"></canvas>
      <div class="iv-in"><div class="iv-top"></div><div class="iv-body"><div class="iv-main"></div><div class="iv-det"></div></div></div></div><canvas class="iv-fx"></canvas>`;
      cloud=pixelCloud(root.querySelector('.iv-cv'),root.querySelector('.iv-cv2'),root.querySelector('.iv-in'));fx=pixelBurst(root.querySelector('.iv-fx'))}
    const $=q=>root.querySelector(q),m=$('.iv-main'),d=$('.iv-det'),sc=[m.scrollTop,d.scrollTop];
    $('.iv-top').innerHTML=`<button class="px${tab==='inv'?' on':''}" data-t="inv">INVENTORY${touch?'':'<kbd>Q</kbd>'}</button><button class="px${tab==='col'?' on':''}" data-t="col">COLLECTIBLES${touch?'':'<kbd>E</kbd>'}</button><button class="px iv-x" data-x="1">CLOSE${touch?'':'<kbd>ESC</kbd>'}</button>`;
    m.innerHTML=main();d.innerHTML=detail();m.scrollTop=sc[0];d.scrollTop=sc[1];
  }

  // ---- actions
  function equip(sid,id){const s=SLOT[sid],other=SLOTS.find(q=>q.grp===s.grp&&q.id!==sid&&st.eq[q.id]===id);
    if(other)st.eq[other.id]=st.eq[sid]||null;     // already worn in another slot of this kind: swap them
    st.eq[sid]=id;fixWeapons();save();render();onGear&&onGear()}
  function unequip(sid){if(SLOT[sid].grp==='weapon'||!st.eq[sid])return;st.eq[sid]=null;save();render();onGear&&onGear()}
  function collect(id){if(!ITEMS[id]||st.owned.has(id))return false;st.owned.add(id);save();if(isOpen)render();hud.banner('Collected',ITEMS[id].name);return true}
  function setTab(t){if(t===tab)return;tab=t;selItem=null;render()}
  root.addEventListener('click',e=>{const t=e.target.closest('[data-s],[data-i],[data-c],[data-t],[data-un],[data-x]');if(!t)return;const d=t.dataset;
    if(d.x)close();else if(d.t)setTab(d.t);else if(d.s){sel=d.s;selItem=null;render()}else if(d.i)equip(sel,d.i);else if(d.c){selItem=d.c;render()}else if(d.un)unequip(sel)});
  // drag anywhere outside the cloud turns the character
  let drag=null;
  root.addEventListener('pointerdown',e=>{if(!e.target.closest('.iv-cloud')){drag={id:e.pointerId,x:e.clientX};try{e.target.setPointerCapture(e.pointerId)}catch(_){}}});
  root.addEventListener('pointermove',e=>{if(drag&&e.pointerId===drag.id){spin+=(e.clientX-drag.x)*.011;drag.x=e.clientX}});
  for(const t of['pointerup','pointercancel'])root.addEventListener(t,e=>{if(drag&&e.pointerId===drag.id)drag=null});

  function open(){if(isOpen||!canOpen())return;isOpen=true;hud.bigmap&&hud.bigmap(false);spin=0;tab='inv';sel='w0';selItem=null;
    for(const k in keys)keys[k]=false;mouse.l=false;P.scope=false;P.mv=false;P.dash=0;
    const c=getCat();if(c&&c.userData.move){c.userData.move.f=0;c.userData.move.s=0}
    document.body.classList.add('inv-open');try{document.exitPointerLock&&document.exitPointerLock()}catch(e){}
    render();if(closeT){clearTimeout(closeT);closeT=0}root.classList.remove('closing');const cl=root.querySelector('.iv-cloud');cloud.cancel();fx.clear();
    root.hidden=false;cloud&&cloud.start();cl.style.animation='none';void root.offsetWidth;cl.style.animation='';if(!calm())fx.burst(cardRect())}   // the card pops in with an ease + a burst of pixels; the character slides left (main.js)
  const calm=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
  function cardRect(){const c=root.querySelector('.iv-cloud'),w=c.offsetWidth,h=c.offsetHeight;return{l:c.offsetLeft,t:innerWidth<=760?c.offsetTop:c.offsetTop-h/2,w,h}}   // final on-screen box (offset* ignores the pop animation's scale)
  function hideNow(){closeT=0;root.hidden=true;root.classList.remove('closing');cloud&&cloud.stop();fx&&fx.clear()}
  function close(silent){if(!isOpen)return;isOpen=false;document.body.classList.remove('inv-open');if(!silent&&!touch)lockPtr();
    if(silent||calm()){hideNow();return}
    // the card does not shrink: it crumbles pixel by pixel (left -> right), every pixel that goes is blown away as a round particle
    root.classList.add('closing');fx.prep();
    cloud.dissolve(.6,cardRect(),(x,y)=>fx.puff(x,y),()=>{closeT=setTimeout(hideNow,650)});   // when the card is gone, wait for the last particles
    closeT=setTimeout(hideNow,1800)}   // safety net

  return{load,wipe,open,close,collect,
    toggle(){isOpen?close():open()},
    isOpen:()=>isOpen,tab:setTab,spin:()=>spin,
    weaponIdx:()=>[ITEMS[st.eq.w0].wi,ITEMS[st.eq.w1].wi],
    artifactIcons:()=>['a0','a1','a2'].map(s=>it(s)?{icon:it(s).icon,name:it(s).name}:null)}}
