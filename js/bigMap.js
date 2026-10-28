// FULL-SCREEN MAP PAGE (press M). A page of its own, not a pop-up: dark top bar (title / where you are / close), the map filling the screen, a bottom bar with the controls.
//   * The whole world is charted once as a small pixel image (about RES pixels along the long side) and shown with no smoothing, so it looks chunky / pixelated.
//     Colours come from the biome under each pixel (map.biomeName), shading from the terrain height (map.heightAt) and contour steps; water from map.world.shoreDist when it exists.
//   * Trees, cacti and rocks are little pixel sprites placed by biome (maps that list every obstacle, like the arena, use the real ones instead).
//   * Biome names are written on the map (connected areas of the same biome get a label each).
//   * Wheel / + - zoom, drag or WASD / arrows move, C centres on you. The game stands still while this page is open (main.js checks hud.bigmapOn()).
// The chart is built in small time slices (a few ms per frame) so the game never stalls; the picture fills in while you look at it.
const DISP="Bungee,Impact,sans-serif",RES=420,STEP_MS=9;
const INK='#17100e',CREAM='#f1e8d2';

// biome kinds, matched on the biome's name: [kind, name pattern, ground colour, tree density]
const KINDS=[
  ['water',/water|lake|river|ocean|\bsea\b|pond|lagoon/i,[92,148,176],0],
  ['jungle',/jungle|rain/i,[58,124,72],.46],
  ['forest',/forest|wood|taiga|grove/i,[104,150,86],.3],
  ['swamp',/swamp|marsh|bog|mangrove/i,[88,112,80],.14],
  ['savanna',/savann|plain|grass|meadow|field|steppe/i,[200,180,96],.05],
  ['desert',/desert|dune|sand|badland|mesa|waste/i,[226,202,142],.022],
  ['snow',/snow|ice|tundra|frozen|glacier/i,[228,234,240],.1],
  ['stone',/stone|rock|mount|cliff|peak|highland|alpine|crag|canyon/i,[156,150,140],.07]];
const hsl=(h,s,l)=>{const a=s*Math.min(l,1-l),f=n=>{const k=(n+h/30)%12;return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1))))};return[f(0),f(8),f(4)]};
function kindOf(name){for(const k of KINDS)if(k[1].test(name))return k;let h=0;for(const ch of name)h=(h*31+ch.charCodeAt(0))>>>0;return['other',null,hsl(h%360,.35,.55),.12]}
const hash=(a,b)=>{let h=Math.imul(a|0,374761393)^Math.imul(b|0,668265263);h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296};
const cl=(v,a,b)=>v<a?a:v>b?b:v;

const css=document.createElement('style');css.textContent=`
body.bigmap #hud{visibility:hidden}
#bigmap{position:fixed;inset:0;z-index:1100;display:flex;flex-direction:column;color:${CREAM};font-family:var(--font);-webkit-user-select:none;user-select:none;touch-action:none;
  background:#0f0b09 linear-gradient(rgba(241,232,210,.05) 1px,transparent 1px) 0 0/34px 34px,linear-gradient(90deg,rgba(241,232,210,.05) 1px,transparent 1px) 0 0/34px 34px;animation:bmin .16s ease-out}
#bigmap[hidden]{display:none}@keyframes bmin{from{opacity:0}}
#bigmap .bm-top,#bigmap .bm-bot{position:absolute;left:0;right:0;z-index:3;display:flex;align-items:center;gap:18px;padding:0 max(22px,env(safe-area-inset-left));pointer-events:none}
#bigmap .bm-top{top:max(16px,env(safe-area-inset-top));justify-content:space-between}
#bigmap .bm-bot{bottom:max(16px,env(safe-area-inset-bottom));justify-content:center}
#bigmap .bm-top button,#bigmap .bm-bot button{pointer-events:auto}
#bigmap .bm-top,#bigmap .bm-bot{text-shadow:0 2px 0 rgba(0,0,0,.75),0 0 8px rgba(0,0,0,.6)}
#bigmap .bm-ti{position:absolute;left:50%;transform:translateX(-50%);font:400 clamp(22px,3.6vmin,32px)/1 var(--disp);letter-spacing:.24em}
#bigmap .bm-you{font:800 13px var(--font);letter-spacing:.2em;opacity:.9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:34vw}
#bigmap .bm-you b{font-weight:800;color:#ffd54a}
#bigmap .bm-x,#bigmap .bm-b{appearance:none;border:0;cursor:pointer;text-shadow:none;background:rgba(23,16,14,.78);color:${CREAM};font:400 15px var(--disp);letter-spacing:.08em;padding:7px 14px;border-radius:3px;transition:background .12s}
#bigmap .bm-x:hover,#bigmap .bm-b:hover{background:var(--blood)}
#bigmap .bm-b{padding:5px 11px;margin-left:6px}
#bigmap kbd{font:700 11px/1 var(--mono);background:rgba(23,16,14,.75);border:1px solid rgba(241,232,210,.4);border-radius:3px;padding:3px 5px;margin-left:6px;vertical-align:middle;color:${CREAM}}
#bigmap .bm-bot>span{font:800 12px var(--font);letter-spacing:.12em;opacity:.92;display:flex;align-items:center;gap:2px;margin:0 12px}
#bigmap .bm-bot b{font-weight:800;color:#ffd54a;letter-spacing:.2em;margin-right:8px}
#bigmap .bm-map{position:absolute;inset:0}
#bigmap canvas{position:absolute;inset:0;width:100%;height:100%;cursor:grab;image-rendering:pixelated}
#bigmap canvas:active{cursor:grabbing}
#bigmap .bm-vig{position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 90px rgba(0,0,0,.4)}
#bigmap .bm-prog{position:absolute;left:50%;top:18px;transform:translateX(-50%);font:400 14px var(--disp);letter-spacing:.2em;background:rgba(23,16,14,.82);padding:7px 16px;border-radius:3px;pointer-events:none}
#bigmap .bm-prog:empty{display:none}
body.mobile #bigmap .bm-kb{display:none}
@media (max-width:760px){#bigmap .bm-bot>span{margin:0 4px}#bigmap .bm-you{display:none}}
`;document.head.appendChild(css);

export function createBigMap(o={}){
  const root=document.createElement('div');root.id='bigmap';root.hidden=true;
  root.innerHTML=`<div class="bm-top"><div class="bm-you" id="bmYou"></div><div class="bm-ti">MAP</div><button class="bm-x" data-x="1">CLOSE<kbd class="bm-kb">ESC</kbd></button></div>
    <div class="bm-map" id="bmMap"><canvas id="bmC"></canvas><div class="bm-vig"></div><div class="bm-prog" id="bmP"></div></div>
    <div class="bm-bot"><span class="bm-kb"><b>MOVE</b><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>&nbsp;or drag</span>
      <span><b>ZOOM</b><button class="bm-b" data-z="-1">&minus;</button><button class="bm-b" data-z="1">+</button><span class="bm-kb">&nbsp;&nbsp;wheel</span></span>
      <span><b>CENTER</b><button class="bm-b" data-c="1">YOU</button><kbd class="bm-kb">C</kbd></span>
      <span class="bm-kb"><b>BACK</b><kbd>M</kbd></span></div>`;
  document.body.appendChild(root);
  const $=s=>root.querySelector(s),cv=$('#bmC'),g=cv.getContext('2d'),mapEl=$('#bmMap'),youEl=$('#bmYou'),progEl=$('#bmP');
  let on=false,chart=null,cw=1,ch=1,dpr=1,lastP=null,lastT=0,youTxt='';
  const v={cx:0,cz:0,z:1,zmin:1},held={};

  // ---------------------------------------------------------------- the chart (pixel image of the whole world)
  const dims=m=>({W:m.W||(m.world&&m.world.W)||1000,H:m.H||(m.world&&m.world.H)||1000});
  function newChart(map){
    const {W,H}=dims(map),cell=Math.max(W,H)/RES,rw=Math.ceil(W/cell),rh=Math.ceil(H/cell),c=document.createElement('canvas');c.width=rw;c.height=rh;
    const g2=c.getContext('2d'),hf=typeof map.heightAt==='function'?(x,z)=>map.heightAt(x,z):()=>0,hasB=typeof map.biomeName==='function';
    let lo=1e9,hi=-1e9;for(let j=0;j<24;j++)for(let i=0;i<24;i++){const h=hf(-W/2+(i+.5)/24*W,-H/2+(j+.5)/24*H);if(h<lo)lo=h;if(h>hi)hi=h}   // height range -> contour spacing
    const sd=map.world&&typeof map.world.shoreDist==='function'?map.world.shoreDist.bind(map.world):null;
    return{map,W,H,cell,rw,rh,cv:c,g:g2,im:g2.createImageData(rw,rh),row:0,hf,hasB,sd,hstep:Math.max(.5,(hi-lo)/14),
      bio:new Uint8Array(rw*rh),names:[],kinds:[],idx:{},done:false,labels:[],ponds:map.ponds||[]}}
  function stepChart(c,ms){
    const t0=performance.now(),d=c.im.data,{rw,cell}=c,band=h=>Math.floor(h/c.hstep);
    while(c.row<c.rh&&performance.now()-t0<ms){
      const j=c.row++,z=-c.H/2+(j+.5)*cell;
      for(let i=0;i<rw;i++){
        const x=-c.W/2+(i+.5)*cell,name=c.hasB?(c.map.biomeName(x,z)||'Land'):'Land';
        let bi=c.idx[name];if(bi===undefined){bi=c.names.length;c.idx[name]=bi;c.names.push(name);c.kinds.push(kindOf(name))}
        const kind=c.kinds[bi],h=c.hf(x,z),hx=c.hf(x+cell,z),hz=c.hf(x,z+cell);
        let r,gg,b,water=kind[0]==='water';
        if(c.sd){const s=c.sd(x,z);if(s<-.3)water=true}
        else for(const p of c.ponds){if(Math.hypot(x-p[0],z-p[1])<p[2])water=true}
        if(water){const w=((i+j)&3)===0?1.1:1;r=92*w;gg=148*w;b=176*w}
        else{
          const col=kind[2],dh=(h-hx)+(h-hz),sh=Math.round(cl(1+dh/cell*.55,.66,1.34)*12)/12;   // light from the top-left, in a few flat steps (pixel-art look)
          r=col[0]*sh;gg=col[1]*sh;b=col[2]*sh;
          const bh=band(h);if(bh!==band(hx)||bh!==band(hz)){r*=.86;gg*=.86;b*=.86}                     // contour step
        }
        const o=(j*rw+i)*4;d[o]=r;d[o+1]=gg;d[o+2]=b;d[o+3]=255;c.bio[j*rw+i]=water?255:bi}
    }
    c.g.putImageData(c.im,0,0);
    if(c.row>=c.rh){decorate(c);labelBiomes(c);c.g.putImageData(c.im,0,0);c.done=true}}

  // ---- pixel sprites
  const put=(c,x,y,col)=>{if(x<0||y<0||x>=c.rw||y>=c.rh)return;const o=(y*c.rw+x)*4,d=c.im.data;d[o]=col[0];d[o+1]=col[1];d[o+2]=col[2];d[o+3]=255};
  const CAN=[44,98,56],HI=[92,150,80],TRK=[92,64,40],OLV=[104,122,52],CAC=[66,118,70],RK=[118,114,106],RKH=[172,168,158],PIN=[40,86,66],WH=[240,244,248];
  function sprite(c,kind,x,y){
    switch(kind){
      case'savanna':[[0,0],[1,0],[2,0],[1,-1]].forEach(([a,b])=>put(c,x+a,y+b,b?HI:OLV));put(c,x+1,y+1,TRK);put(c,x+1,y+2,TRK);break;                 // flat-topped acacia
      case'desert':[[1,0],[1,1],[1,2],[0,1],[2,0]].forEach(([a,b])=>put(c,x+a,y+b,CAC));break;                                                      // cactus
      case'stone':put(c,x,y,RKH);put(c,x+1,y,RK);put(c,x,y+1,RK);put(c,x+1,y+1,RK);break;                                                           // rock
      case'snow':put(c,x+1,y,WH);for(let a=0;a<3;a++){put(c,x+a,y+1,PIN);put(c,x+a,y+2,PIN)}put(c,x+1,y+3,TRK);break;                               // snowy pine
      case'swamp':put(c,x,y,CAN);put(c,x+1,y+1,CAN);put(c,x+1,y,HI);break;
      default:put(c,x+1,y,HI);for(let a=0;a<3;a++){put(c,x+a,y+1,CAN);put(c,x+a,y+2,CAN)}put(c,x,y+1,HI);put(c,x+1,y+3,TRK)}                      // round tree
  }
  function decorate(c){
    const {map}=c,real=map.themeName&&Array.isArray(map.obs)&&map.obs.length;
    if(real){                                                                               // arena etc.: every obstacle is known, draw the real ones
      for(const ob of map.obs){const i=Math.round((ob.x+c.W/2)/c.cell),j=Math.round((ob.z+c.H/2)/c.cell),rock=ob.rock||ob.kind==='rock'||ob.type==='rock'||(ob.r>1&&ob.r!==.6);
        sprite(c,rock?'stone':'forest',i-1,j-1)}
      return}
    for(let j=2;j<c.rh-4;j+=4)for(let i=1;i<c.rw-3;i+=3){
      const bi=c.bio[(j+1)*c.rw+i+1];if(bi===255)continue;const k=c.kinds[bi];
      if(hash(i,j)<k[3]){const ox=(hash(i+7,j)*2)|0,oy=(hash(i,j+9)*2)|0;if(c.bio[(j+oy+1)*c.rw+i+ox+1]===255)continue;sprite(c,k[0],i+ox,j+oy)}}
  }

  // ---- biome labels: coarse grid of the biome ids, connected areas of one biome each get a label
  function labelBiomes(c){
    if(!c.hasB)return;
    const s=Math.max(4,Math.round(Math.max(c.rw,c.rh)/44)),gw=Math.ceil(c.rw/s),gh=Math.ceil(c.rh/s),id=new Int16Array(gw*gh).fill(-1),seen=new Uint8Array(gw*gh),out=[];
    for(let j=0;j<gh;j++)for(let i=0;i<gw;i++){                                              // biome of a cell = the most common one among a few pixels (ignoring water)
      const cnt={};let best=-1,bc=0;for(let q=0;q<5;q++){const px=cl(i*s+(q%3)*(s>>1),0,c.rw-1),py=cl(j*s+(q>>1&1)*(s>>1)+(q>2?1:0),0,c.rh-1),b=c.bio[py*c.rw+px];if(b===255)continue;cnt[b]=(cnt[b]||0)+1;if(cnt[b]>bc){bc=cnt[b];best=b}}
      id[j*gw+i]=best}
    for(let st=0;st<gw*gh;st++){
      if(seen[st]||id[st]<0)continue;const b=id[st],q=[st],cells=[];seen[st]=1;
      for(let k=0;k<q.length;k++){const n=q[k],x=n%gw,y=(n/gw)|0;cells.push(n);
        for(const[nx,ny]of[[x+1,y],[x-1,y],[x,y+1],[x,y-1]]){if(nx<0||ny<0||nx>=gw||ny>=gh)continue;const m=ny*gw+nx;if(!seen[m]&&id[m]===b){seen[m]=1;q.push(m)}}}
      if(cells.length<5)continue;
      let mx=0,my=0;for(const n of cells){mx+=n%gw;my+=(n/gw)|0}mx/=cells.length;my/=cells.length;
      let pick=cells[0],pd=1e9;for(const n of cells){const d=Math.hypot(n%gw-mx,((n/gw)|0)-my);if(d<pd){pd=d;pick=n}}   // the cell of the area closest to its centre (so the label sits inside it)
      out.push({name:c.names[b],n:cells.length,x:-c.W/2+((pick%gw)+.5)*s*c.cell,z:-c.H/2+(((pick/gw)|0)+.5)*s*c.cell})}
    out.sort((a,b)=>b.n-a.n);const keep=[],min=Math.max(c.W,c.H)*.07;
    for(const l of out)if(!keep.some(k=>Math.hypot(k.x-l.x,k.z-l.z)<min&&k.name===l.name))keep.push(l);
    c.labels=keep}

  // ---------------------------------------------------------------- view
  const clampView=()=>{if(!chart)return;const hw=cw/2/v.z,hh=ch/2/v.z;                  // keep the map covering the screen; when zoomed out far enough to see all of it, centre it
    v.cx=chart.W<=hw*2?0:cl(v.cx,-chart.W/2+hw,chart.W/2-hw);v.cz=chart.H<=hh*2?0:cl(v.cz,-chart.H/2+hh,chart.H/2-hh)};
  function zoomBy(f,ax=cw/2,ay=ch/2){const wx=v.cx+(ax-cw/2)/v.z,wz=v.cz+(ay-ch/2)/v.z;v.z=cl(v.z*f,v.zmin,v.zmin*14);v.cx=wx-(ax-cw/2)/v.z;v.cz=wz-(ay-ch/2)/v.z;clampView()}
  const center=()=>{if(lastP){v.cx=lastP.x;v.cz=lastP.z;clampView()}};
  const cover=()=>Math.max(cw/chart.W,ch/chart.H);                                          // the smallest zoom: the map still covers the whole screen (the game behind it is never visible)
  function fit(){if(!chart)return;v.zmin=cover();v.z=v.zmin*1.6;center()}   // opens a little closer than the minimum, centred on you

  // ---------------------------------------------------------------- input (only while open)
  root.addEventListener('click',e=>{const b=e.target.closest('[data-x],[data-z],[data-c]');if(!b)return;if(b.dataset.x)set(false);else if(b.dataset.z)zoomBy(b.dataset.z>0?1.5:1/1.5);else center()});
  cv.addEventListener('wheel',e=>{e.preventDefault();const r=cv.getBoundingClientRect();zoomBy(Math.exp(-e.deltaY*.0016),e.clientX-r.left,e.clientY-r.top)},{passive:false});
  let drag=null;
  cv.addEventListener('pointerdown',e=>{drag={id:e.pointerId,x:e.clientX,y:e.clientY};try{cv.setPointerCapture(e.pointerId)}catch(_){}});
  cv.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;v.cx-=(e.clientX-drag.x)/v.z;v.cz-=(e.clientY-drag.y)/v.z;drag.x=e.clientX;drag.y=e.clientY;clampView()});
  for(const t of['pointerup','pointercancel'])cv.addEventListener(t,e=>{if(drag&&e.pointerId===drag.id)drag=null});
  const PAN={KeyW:[0,-1],ArrowUp:[0,-1],KeyS:[0,1],ArrowDown:[0,1],KeyA:[-1,0],ArrowLeft:[-1,0],KeyD:[1,0],ArrowRight:[1,0]};
  addEventListener('keydown',e=>{if(!on)return;
    if(e.code==='Escape'||e.code==='KeyM'){if(!e.repeat)set(false)}
    else if(PAN[e.code])held[e.code]=true;
    else if(e.code==='Equal'||e.code==='NumpadAdd')zoomBy(1.4);else if(e.code==='Minus'||e.code==='NumpadSubtract')zoomBy(1/1.4);
    else if(e.code==='KeyC'||e.code==='Home')center();
    else return;
    e.preventDefault();e.stopImmediatePropagation()},true);
  addEventListener('keyup',e=>{if(PAN[e.code])delete held[e.code]},true);
  addEventListener('blur',()=>{for(const k in held)delete held[k]});

  function set(b){b=!!b;if(b===on)return;on=b;root.hidden=!b;for(const k in held)delete held[k];drag=null;
    if(b){lastT=performance.now();youTxt='';if(chart&&lastP)fit()}
    o.onChange&&o.onChange(b)}

  // ---------------------------------------------------------------- one frame (called by hud.bigradar while the page is open)
  function draw(P,enemies,pickups,map){
    if(!on)return;lastP=P;
    const w=mapEl.clientWidth||innerWidth,h=mapEl.clientHeight||innerHeight,dp=Math.min(2,devicePixelRatio||1);
    if(w!==cw||h!==ch||dp!==dpr){cw=w;ch=h;dpr=dp;cv.width=Math.round(w*dp);cv.height=Math.round(h*dp);if(chart){const f=cover();v.z=cl(v.z/v.zmin*f,f,f*14);v.zmin=f}}
    if(!chart||chart.map!==map){chart=newChart(map);cw=w;ch=h;fit()}
    if(!chart.done)stepChart(chart,STEP_MS);
    const now=performance.now(),dt=Math.min(.05,(now-lastT)/1000);lastT=now;
    {let px=0,pz=0;for(const k in held){px+=PAN[k][0];pz+=PAN[k][1]}if(px||pz){const sp=900*dt/v.z;v.cx+=px*sp;v.cz+=pz*sp;clampView()}}
    progEl.textContent=chart.done?'':'CHARTING THE WORLD…  '+Math.round(chart.row/chart.rh*100)+'%';
    const name=chart.hasB?map.biomeName(P.x,P.z):'';const tx=name?'YOU ARE IN  <b>'+String(name).toUpperCase()+'</b>':'';if(tx!==youTxt){youTxt=tx;youEl.innerHTML=tx}

    const SX=x=>Math.round(cw/2+(x-v.cx)*v.z),SY=z=>Math.round(ch/2+(z-v.cz)*v.z);
    g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,cw,ch);g.imageSmoothingEnabled=false;
    const x0=SX(-chart.W/2),y0=SY(-chart.H/2),mw=Math.round(chart.W*v.z),mh=Math.round(chart.H*v.z);
    g.fillStyle='rgba(0,0,0,.5)';g.fillRect(x0+7,y0+9,mw,mh);g.fillStyle='#2a2118';g.fillRect(x0,y0,mw,mh);
    g.drawImage(chart.cv,x0,y0,mw,mh);
    g.strokeStyle=CREAM;g.globalAlpha=.85;g.lineWidth=3;g.strokeRect(x0-1.5,y0-1.5,mw+3,mh+3);g.globalAlpha=1;

    // pickups / enemies: little squares, same size at every zoom
    for(const p of pickups||[]){g.fillStyle='#e8658c';g.fillRect(SX(p.x)-3,SY(p.z)-3,6,6)}
    for(const e of enemies||[]){const x=SX(e.x),y=SY(e.z);g.fillStyle=e.team?(e.team==='A'?'#2f7fe0':'#e0443a'):e.k==='ranged'?'#f2a43a':'#e0443a';g.fillRect(x-4,y-4,8,8);g.strokeStyle=INK;g.lineWidth=1.5;g.strokeRect(x-3.5,y-3.5,7,7)}

    // biome labels
    if(chart.labels.length){const fs=Math.round(cl(13+4*Math.sqrt(v.z/v.zmin),15,30));g.font=`${fs}px ${DISP}`;g.textAlign='center';g.textBaseline='middle';if('letterSpacing'in g)g.letterSpacing=Math.round(fs*.16)+'px';
      g.lineJoin='round';g.lineWidth=Math.max(4,fs*.3);g.strokeStyle='rgba(23,16,14,.92)';g.fillStyle=CREAM;
      for(const l of chart.labels){const t=l.name.toUpperCase(),tw=g.measureText(t).width/2+6;let x=SX(l.x),y=SY(l.z);x=cl(x,x0+tw,x0+mw-tw);y=cl(y,y0+fs,y0+mh-fs);if(x<-120||y<-30||x>cw+120||y>ch+30)continue;g.strokeText(t,x,y);g.fillText(t,x,y)}
      if('letterSpacing'in g)g.letterSpacing='0px'}

    // you: pulsing ring + an arrow facing the way the camera looks (map: +x right, +z down)
    {const x=SX(P.x),y=SY(P.z),pu=(now%1400)/1400;g.strokeStyle='rgba(255,255,255,'+(.75*(1-pu)).toFixed(2)+')';g.lineWidth=3;g.beginPath();g.arc(x,y,10+pu*22,0,6.283);g.stroke();
      g.save();g.translate(x,y);g.rotate(Math.PI-(P.camYaw||0));g.fillStyle='#fff';g.strokeStyle=INK;g.lineWidth=2.4;g.lineJoin='miter';
      g.beginPath();g.moveTo(0,-14);g.lineTo(10,11);g.lineTo(0,5);g.lineTo(-10,11);g.closePath();g.stroke();g.fill();g.restore()}
    // north marker
    g.font=`18px ${DISP}`;g.textAlign='center';g.fillStyle=CREAM;g.strokeStyle='rgba(23,16,14,.9)';g.lineWidth=5;g.strokeText('N',cw-34,92);g.fillText('N',cw-34,92);g.beginPath();g.moveTo(cw-34,106);g.lineTo(cw-41,120);g.lineTo(cw-34,116);g.lineTo(cw-27,120);g.closePath();g.stroke();g.fill();
  }

  return{set,isOpen:()=>on,draw}}