// Cat maker: tiles use real 3D renders of the models (ears, headwear, eyewear, collar, cloak ...) or crisp SVG, so nothing is pixelated.
// The colour card on the right is built ONCE and only shows up for categories that have a colour to edit (body / head shape / nose / cheeks / whiskers have none).
// PERFORMANCE: tile icons are rendered one at a time (6 ms budget per frame), the maker UI is built once (only the tile grid is refilled),
// and the scrolling checker background is a pure CSS animation (runs on the GPU at the screen's full refresh rate, no JavaScript per frame).
import * as T from 'three';
import {COATS,COAT_NAMES,EARS,EAR_NAMES,EYECS,COLLARS,COLLAR_TYPES,CLOAKS,CLOAK_COLS,PATTERNS,HEADS,EYEWEAR,GEAR_COLS,EYE_STYLES,EYE_FILE,buildPngEyes,createCatAvatar,eyesReady,NOSES,CHEEKS,TAILS,WHISKERS,HEAD_SHAPES,BODY_SHAPES,HAIRS,HAIR_COLS} from './catAvatar.js';
import {shapedHeadGeo,shapedTorsoGeo} from './catShape.js';
import {buildHairStatic} from './catHair.js';
import {buildNose,buildCheeks,buildTail} from './catFeatures.js';
import {buildEar,buildHeadwear,buildEyewear,buildCloakStatic} from './wearables.js';
import {buildCollarStatic} from './collar.js';
import {makeCoat} from './world/coatShader.js';
import {iconOf} from './iconRender.js';
import {PHYS} from './physics.js';
import {mat} from './blocks.js';

// "Reduce physics" (cloak / collar cloth: 1 constraint pass, 1 collision pass, normals every other step) is forced ON while the maker / My Character preview is open, then the player's own setting comes back
let physUsers=0,physSaved=false;
const physAcquire=()=>{if(physUsers++===0){physSaved=PHYS.reduce;PHYS.reduce=true}};
const physRelease=()=>{if(physUsers>0&&--physUsers===0)PHYS.reduce=physSaved};

// tiles (shapes / styles only). Colours are NOT tabs: they live in the colour card (CAT_COLS says which category shows which colour list).
const TABS=[
  ['cat','Cat',[['pattern','Pattern','bi-grid-3x3-gap'],['bodyS','Body shape','bi-person-standing'],['tail','Tail','bi-bezier2'],['collarT','Collar style','bi-record-circle']]],
  ['face','Face',[['headS','Head shape','bi-hexagon'],['ears','Ears','bi-soundwave'],['eyeS','Eye shape','bi-eye'],['nose','Nose','bi-triangle'],['cheeks','Cheeks','bi-emoji-smile'],['whisk','Whiskers','bi-list'],['hair','Hair style','bi-scissors']]],
  ['acc','Accessories',[['cloak','Cloak','bi-shield'],['head','Headwear','bi-mortarboard'],['eyewear','Eyewear','bi-eyeglasses']]]
];
// the colour card only appears for these categories (anything not listed = no colour card at all)
const CAT_COLS={pattern:['coat'],tail:['coat'],ears:['coat'],collarT:['collar'],eyeS:['eye'],hair:['hair'],cloak:['cloak'],head:['gear'],eyewear:['gear']};
const pick=a=>a[(Math.random()*a.length)|0];
// categories that are edited from BEHIND (the normal in-game camera); everything else swings round to the FRONT of the cat
const BACK_VIEW=new Set(['cloak','tail']);

// ---- styles for the colour card + lazy icons + checker (injected once, so style.css does not need to change) ----
const NV='#1d2748';
function injectCSS(){
  if(document.getElementById('mk2-col-css'))return;
  const s=document.createElement('style');s.id='mk2-col-css';
  s.textContent=`
/* checker: one tile, moved by the compositor in whole background pixels */
@keyframes mk2bg{from{transform:translate3d(0,0,0)}to{transform:translate3d(calc(var(--bgp)*-1),calc(var(--bgp)*-1),0)}}
/* colour card: pixel frame (navy + white, stepped corners) like the main card */
.mk2-col{--p:3px;--st:polygon(2px 0,calc(100% - 2px) 0,calc(100% - 2px) 2px,100% 2px,100% calc(100% - 2px),calc(100% - 2px) calc(100% - 2px),calc(100% - 2px) 100%,2px 100%,2px calc(100% - 2px),0 calc(100% - 2px),0 2px,2px 2px);
  position:fixed;right:max(22px,3vw);top:19vh;width:min(330px,27vw);min-width:236px;max-height:62vh;overflow-y:auto;box-sizing:border-box;padding:12px;background:#e3a977;color:#3a2308;z-index:6;pointer-events:auto;scrollbar-width:none;-ms-overflow-style:none;
  box-shadow:0 calc(-1*var(--p)) 0 0 ${NV},0 var(--p) 0 0 ${NV},calc(-1*var(--p)) 0 0 0 ${NV},var(--p) 0 0 0 ${NV},
    0 calc(-2*var(--p)) 0 0 #fff,0 calc(2*var(--p)) 0 0 #fff,calc(-2*var(--p)) 0 0 0 #fff,calc(2*var(--p)) 0 0 0 #fff,
    calc(-1*var(--p)) calc(-1*var(--p)) 0 0 #fff,var(--p) calc(-1*var(--p)) 0 0 #fff,calc(-1*var(--p)) var(--p) 0 0 #fff,var(--p) var(--p) 0 0 #fff}
.mk2-col::-webkit-scrollbar{display:none}
.mk2-col[hidden],.mk2-cs[hidden]{display:none!important}
.mk2-ch{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 2px 10px}
.mk2-ch h4{margin:0;font-size:17px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:${NV}}
.mk2-ch span.n{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#8a5a3a;opacity:.85;white-space:nowrap}
.mk2-sw{display:grid;grid-template-columns:repeat(auto-fill,minmax(40px,1fr));gap:6px}
/* swatch = a tile like the main card's tiles, with a pixel-rounded colour chip inside */
.mk2-sq{position:relative;width:100%;aspect-ratio:1;min-width:34px;padding:0;border:0;cursor:pointer;background:#efc197;clip-path:var(--st);box-shadow:inset 0 0 0 2px #d89b66;transition:transform .08s,filter .08s}
.mk2-col .mk2-sq .mk2-ring{position:absolute!important;display:block!important;left:6px!important;top:6px!important;right:6px!important;bottom:6px!important;width:auto!important;height:auto!important;background:${NV};clip-path:var(--st);pointer-events:none}
.mk2-col .mk2-sq .mk2-chip{position:absolute!important;display:block!important;left:2px!important;top:2px!important;right:2px!important;bottom:2px!important;width:auto!important;height:auto!important;clip-path:var(--st);image-rendering:pixelated;pointer-events:none}
.mk2-col .mk2-sq .mk2-chip::after{content:'';position:absolute;left:3px;top:3px;width:6px;height:3px;background:rgba(255,255,255,.42)}
.mk2-sq:hover{filter:brightness(1.07);transform:translateY(-2px)}
.mk2-sq.on{background:#ffd9b3;box-shadow:inset 0 0 0 2px ${NV},inset 0 0 0 4px #fff}
.mk2-dot{display:inline-flex;align-items:center;gap:6px;padding:3px 9px 3px 6px;border:0;background:#f3d3ad;color:${NV};font:inherit;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;cursor:pointer;clip-path:var(--st);box-shadow:inset 0 0 0 2px #d89b66}
.mk2-dot i{width:12px;height:12px;background:#fff;box-shadow:inset 0 0 0 2px ${NV}}
.mk2-dot.on{background:#58c878;box-shadow:inset 0 0 0 2px ${NV}}.mk2-dot.on i{background:${NV};box-shadow:inset 0 0 0 2px #fff}
.mk2-tile img{transition:opacity .15s}
.mk2-tile img.mk2-ph{opacity:0}
@media (max-width:900px){.mk2-col{width:212px;min-width:0;top:62px;right:12px;max-height:46vh;padding:8px}.mk2-sw{grid-template-columns:repeat(auto-fill,minmax(32px,1fr))}.mk2-ch h4{font-size:14px}}
/* short desktop windows (e.g. a devtools-docked browser): more tiles per row so the second row of options is not cut off */
@media (max-height:600px) and (min-width:761px){html body #maker .mk2-grid{grid-template-columns:repeat(8,1fr)}}`;
  document.head.appendChild(s);
}

// ---- lazy tile icons: a tile shows the previous icon of the same slot (or a blank) at once, the 3D render is made later, one per frame (6 ms budget), then swapped in.
const BLANK='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const urlCache=new Map(),stale=new Map();let jobs=[],jobId=0,pumpTok=0,pumpRaf=0,slotCat='',slotN=0;
const lazy=(key,build,dir)=>{
  const slot=slotCat+'#'+(++slotN),c=urlCache.get(key);
  if(c){stale.set(slot,c);return `<img src="${c}" alt="" draggable="false">`}
  const id=++jobId,old=stale.get(slot);jobs.push({id,key,build,dir,slot});
  return `<img data-ik="${id}" class="${old?'':'mk2-ph'}" src="${old||BLANK}" alt="" draggable="false">`};   // while the new icon is made, the old one stays visible = no flashing grid
const pumpStop=()=>{pumpTok++;cancelAnimationFrame(pumpRaf);jobs=[]};
function pump(root){
  cancelAnimationFrame(pumpRaf);const tok=++pumpTok,queue=jobs;jobs=[];
  const step=()=>{
    if(tok!==pumpTok)return;const t0=performance.now();
    while(queue.length&&(performance.now()-t0<6)){
      const j=queue.shift(),el=root.querySelector(`[data-ik="${j.id}"]`);if(!el)continue;
      const u=iconOf(j.key,j.build,j.dir);
      if(u){urlCache.set(j.key,u);stale.set(j.slot,u);el.src=u;el.classList.remove('mk2-ph')}}
    if(queue.length)pumpRaf=requestAnimationFrame(step)};
  pumpRaf=requestAnimationFrame(step)}

// ---- icon builders ---------------------------------------------------------
const ball=(fur,pat,pattern)=>new T.Mesh(new T.SphereGeometry(1,56,40),makeCoat({fur,pat,pattern},0));
const earPair=(type,fur,pat)=>{
  const g=new T.Group(),pink=mat('#ff9db8');
  [-1,1].forEach(s=>{const a=new T.Group();a.position.set(s*.56,0,0);a.rotation.z=-s*.5;g.add(a);
    const sw=new T.Group();a.add(sw);const info=buildEar(type,sw,mat(s<0?pat:fur),pink);sw.rotation.set(info.bx,0,-s*info.out)});
  return g};
const collarIcon=(c,t)=>buildCollarStatic(c,t||'normal');

// ---- face / tail icons: crisp SVG for eyes + noses, 3D renders for cheeks + tails ----
const D='#150d0a';
const eyeStyleSVG=s=>`<img src="${EYE_FILE(s)}" alt="" draggable="false" style="width:84%;image-rendering:pixelated;filter:drop-shadow(1.5px 0 0 #2a1a14) drop-shadow(-1.5px 0 0 #2a1a14) drop-shadow(0 1.5px 0 #2a1a14) drop-shadow(0 -1.5px 0 #2a1a14)">`;   // the eye shape PNG itself
const noseSVG=s=>`<svg viewBox="0 0 48 48">${({
  button:`<ellipse cx="24" cy="25" rx="7.5" ry="5.5" fill="#3a2308"/>`,
  pink:`<ellipse cx="24" cy="25" rx="6.5" ry="5" fill="#ff8fa8"/>`,
  triangle:`<path d="M16 20 H32 L24 30 Z" fill="#e0728c" stroke="#e0728c" stroke-width="3" stroke-linejoin="round"/>`,
  heart:`<path d="M24 31 C16 25 15 19 19.5 18 C22 17.5 24 20 24 21 C24 20 26 17.5 28.5 18 C33 19 32 25 24 31 Z" fill="#ff5f8a"/>`,
  big:`<ellipse cx="24" cy="24" rx="10.5" ry="7.5" fill="#2a1a14"/>`,
  dot:`<circle cx="24" cy="25" r="3.2" fill="${D}"/>`,
  dog:`<path d="M24 17 C31 17 38 19 38 25 C38 31 30 37 24 37 C18 37 10 31 10 25 C10 19 17 17 24 17 Z" fill="#1c1514"/><ellipse cx="19.5" cy="25" rx="2" ry="3.4" fill="#000" transform="rotate(-28 19.5 25)"/><ellipse cx="28.5" cy="25" rx="2" ry="3.4" fill="#000" transform="rotate(28 28.5 25)"/><path d="M24 28 V33" stroke="#000" stroke-width="1.4" stroke-linecap="round"/><ellipse cx="19" cy="20.5" rx="3" ry="1.4" fill="#6f6a78" transform="rotate(-15 19 20.5)"/>`,
  wide:`<ellipse cx="24" cy="25" rx="10.5" ry="6.5" fill="#d9798f"/><ellipse cx="20.5" cy="25" rx="2" ry="2.8" fill="#4a1a24"/><ellipse cx="27.5" cy="25" rx="2" ry="2.8" fill="#4a1a24"/>`
})[s]}<path d="M24 32 V37 M24 37 Q18 43 12 38 M24 37 Q30 43 36 38" fill="none" stroke="#3a2a22" stroke-width="2.2" stroke-linecap="round"/></svg>`;
const WS={classic:{},short:{len:9,dr:.5},long:{len:21,dr:3},thick:{w:3.4},many:{n:4},droopy:{len:17,dr:7},white:{c:'#c9bfb2'}};
const whiskSVG=t=>{const o=Object.assign({n:3,len:15,dr:1,w:1.7,c:'#2a1a14'},WS[t]);let d='';
  [-1,1].forEach(sd=>{for(let i=0;i<o.n;i++){const k=i-(o.n-1)/2,y=26+k*5.5,x0=24+sd*6,x1=24+sd*(6+o.len),y1=y+k*3+o.dr;d+=`M${x0} ${y} Q${(x0+x1)/2} ${y+k*1.5-1} ${x1} ${y1} `}});
  return `<svg viewBox="0 0 48 48"><path d="${d}" fill="none" stroke="${o.c}" stroke-width="${o.w}" stroke-linecap="round"/><ellipse cx="24" cy="26" rx="4.2" ry="3.2" fill="#d98a9a"/></svg>`};
const faceIcon=(cfg,type,shape)=>{const g=new T.Group(),h=new T.Mesh(shapedHeadGeo(shape||cfg.headShape||'round'),makeCoat({fur:cfg.fur,pat:cfg.pat,pattern:cfg.pattern||'classic'},0));
  h.scale.set(1,.78,.85);g.add(h);buildPngEyes(cfg.eyeColor||EYECS[0],g,{style:cfg.eyeStyle||'default',dot:!!cfg.eyeDot});buildNose(cfg.nose||'button',g);const c=buildCheeks(type,{fur:cfg.fur,pat:cfg.pat,pattern:cfg.pattern||'classic',headShape:shape||cfg.headShape},g);
  if(c&&c.meshes[0])c.meshes[0].material.userData.u.uRel.value.makeScale(1,1/.78,1/.85);   // icon head is a unit sphere scaled like the real head
  return g};
const bodyIcon=(cfg,shape)=>{const g=new T.Group(),m=new T.Mesh(shapedTorsoGeo(shape),makeCoat({fur:cfg.fur,pat:cfg.pat,pattern:cfg.pattern||'classic'},1));m.scale.set(.56,.62,.5);g.add(m);return g};
const hairIcon=(cfg,style)=>{const g=faceIcon(cfg,'none',cfg.headShape);g.add(buildHairStatic(style,cfg.hairC||HAIR_COLS[0],cfg.headShape||'round'));return g};
const tailIcon=(cfg,type)=>{const g=new T.Group();buildTail(type,g,{fur:cfg.fur,pat:cfg.pat,pattern:cfg.pattern||'classic'});return g};
const noneIcon='<i class="bi bi-slash-circle"></i>';


// ---- live cat preview: its OWN little renderer on top of the pixel checker background (not the 3D forest), drawn at 1/2 resolution so it stays chunky,
// then a 2D pass paints a 1-pixel dark blue outline around the silhouette. Tweak here:
const PV={camY:6.6,       // camera height above the ground: bigger = looks down on the cat more (the camera aims at the cat's middle)
  dist:15,     // camera distance: bigger = smaller cat
  up:0,
  boxH:56,boxAspect:1.3,boxTop:'0vh',   // PERFORMANCE: the cat is only drawn / read back inside a box this big (boxH = % of the screen height). Smaller box = faster
  animate:false,         // false = the cat is a still pose while customizing (eyes still blink). true = idle animation + live physics
  fps:15,                // preview frame rate cap (the background does NOT depend on this: it is a CSS animation)
  hemi:2.1,dir:2.3,      // light strengths: the SAME as the game's cat-maker lighting (atmosphere.js setMode)
  outline:[27,42,94],    // outline colour (r,g,b) = dark blue
  pix:2,                 // 1 preview pixel = 2 screen pixels (3 = chunkier, 1 = fine)
  outlineW:2,            // outline thickness in preview pixels
  shadow:{rx:.62,flat:.4,col:'20,12,16',a1:.2,a2:.34}};   // pixel ground shadow under the feet
function createPreview(canvas,cfg0,opt){
  const P=Object.assign({},PV,opt);
  physAcquire();let physHeld=true;
  canvas.style.cssText=`position:absolute;right:auto;bottom:auto;left:50%;top:${P.boxTop};width:${P.boxH*P.boxAspect}vh;height:${P.boxH}vh;transform:translateX(-50%);display:block;image-rendering:pixelated;pointer-events:none`;
  // glc = the WebGL canvas, tc = a 2D scratch canvas the frame is built on, canvas = what the player sees. A frame only reaches the screen when it really contains the cat
  // (an empty / half-built frame is dropped and the last good one stays) = no more "cat vanishes for a split second".
  const glc=document.createElement('canvas'),tc=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true}),tctx=tc.getContext('2d',{willReadFrequently:true});let r;
  try{r=new T.WebGLRenderer({canvas:glc,antialias:false,alpha:false})}catch(e){physRelease();return null}
  if(!ctx||!tctx){physRelease();return null}
  r.setClearColor(0xff00ff,1);   // key colour: every pixel that is still exactly this after rendering is background (made transparent below)
  const scene=new T.Scene(),cam=new T.PerspectiveCamera(2*Math.atan(P.boxH/100*Math.tan(19*Math.PI/180))*180/Math.PI,1,.1,80),PIX=P.pix,DIST=P.dist;
  scene.add(new T.HemisphereLight(0xffffff,0xd8c8b8,P.hemi));
  const sun=new T.DirectionalLight(0xffffff,P.dir);sun.position.set(2.5,4,3.5);scene.add(sun);
  let avatar=null,blob=null,yaw=0,yawTo=0,raf=0,last=performance.now(),gw=1,gh=1,solid=null,ero=null,body=null,addBuf=null,eyeG=[];
  const size=()=>{const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);gw=Math.ceil(w/PIX);gh=Math.ceil(h/PIX);r.setPixelRatio(1);r.setSize(gw,gh,false);canvas.width=gw;canvas.height=gh;tc.width=gw;tc.height=gh;
    cam.aspect=w/h;cam.updateProjectionMatrix();solid=new Uint8Array(gw*gh);ero=new Uint8Array(gw*gh);body=new Uint8Array(gw*gh);addBuf=new Int32Array(gw*gh)};
  // outline: body = the silhouette without anything thinner than 3 pixels (whiskers, tail tips stay as they are), outline = the empty pixels touching the body.
  // Returns the finished ImageData, or null when the frame has no cat in it.
  const outline=()=>{const img=tctx.getImageData(0,0,gw,gh),d=img.data,[R,G,B]=P.outline,W=P.outlineW;
    let x0=gw,x1=-1,y0=gh,y1=-1;
    for(let y=0,i=0;y<gh;y++)for(let x=0;x<gw;x++,i++){const o=i*4;
      if(d[o]>250&&d[o+1]<8&&d[o+2]>250){solid[i]=0;d[o+3]=0}   // key colour -> transparent
      else{solid[i]=1;d[o+3]=255;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}}
    if(x1<0)return null;
    // everything below only looks at the cat's bounding box (+ the outline width): most of the preview is empty
    const m=W+2,ax=Math.max(1,x0-m),bx=Math.min(gw-2,x1+m),ay=Math.max(1,y0-m),by=Math.min(gh-2,y1+m);
    ero.fill(0);body.fill(0);
    for(let y=ay;y<=by;y++)for(let i=y*gw+ax,e=y*gw+bx;i<=e;i++)if(solid[i]&&solid[i-1]&&solid[i+1]&&solid[i-gw]&&solid[i+gw])ero[i]=1;
    for(let y=ay;y<=by;y++)for(let i=y*gw+ax,e=y*gw+bx;i<=e;i++)if(ero[i]||ero[i-1]||ero[i+1]||ero[i-gw]||ero[i+gw]||ero[i-gw-1]||ero[i-gw+1]||ero[i+gw-1]||ero[i+gw+1])body[i]=1;
    ero.fill(0);   // ero is free again: reuse it as the "already outlined" mask. Each round grows the outline by one pixel (P.outlineW rounds)
    for(let k=0;k<W;k++){let c=0;
      for(let y=ay;y<=by;y++)for(let i=y*gw+ax,e=y*gw+bx;i<=e;i++){if(solid[i]||ero[i])continue;
        if(body[i-1]||body[i+1]||body[i-gw]||body[i+gw]||ero[i-1]||ero[i+1]||ero[i-gw]||ero[i+gw])addBuf[c++]=i}
      for(let j=0;j<c;j++){const i=addBuf[j];ero[i]=1;const o=i*4;d[o]=R;d[o+1]=G;d[o+2]=B;d[o+3]=255}}
    return img};
  // rounded pixel ground shadow: painted BEHIND the cat (destination-over) after the outline pass, two flat tones, hard pixel edges
  const gp=new T.Vector3(),SH=P.shadow;
  const groundShadow=vh=>{
    if(blob)blob.getWorldPosition(gp);else gp.set(0,0,0);
    gp.project(cam);const cx=(gp.x*.5+.5)*gw,cy=(-gp.y*.5+.5)*gh,k=gh/vh,rx=SH.rx*k,ry=rx*SH.flat;
    ctx.save();ctx.globalCompositeOperation='destination-over';
    const y0=Math.floor(cy-ry-1),y1=Math.ceil(cy+ry+1),x0=Math.floor(cx-rx-1),x1=Math.ceil(cx+rx+1);
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
      const d=((x+.5-cx)/rx)**2+((y+.5-cy)/ry)**2;if(d>1)continue;
      ctx.fillStyle=`rgba(${SH.col},${d<.5?SH.a2:SH.a1})`;ctx.fillRect(x,y,1,1)}
    ctx.restore()};
  const BLK=new T.MeshBasicMaterial({color:'#050505'});
  const set=(cfg,black)=>{if(avatar){avatar.userData.dispose&&avatar.userData.dispose();scene.remove(avatar)}
    avatar=createCatAvatar(cfg);
    avatar.rotation.y=yaw;
    if(!P.animate&&avatar.userData.update){const u=avatar.userData;   // let the cloth etc. fall into place at once (hidden: nothing is drawn yet), so no swinging is ever seen
      u.setAim&&u.setAim(0,false);u.setScope&&u.setScope(false);if(u.move){u.move.f=0;u.move.s=0}u.holster&&u.holster(true);u.setFps&&u.setFps(0);
      for(let k=0;k<16;k++)u.update(1/30,false,1)}
    if(black)avatar.traverse(m=>{if(m.isMesh&&m.material&&m.material.colorWrite!==false)m.material=BLK});   // empty slot = black silhouette cat
    avatar.position.set(0,0,0);scene.add(avatar);
    blob=avatar.children.find(c=>c.isMesh&&c.material&&c.material.transparent&&Math.abs(c.material.opacity-.3)<.01)||null;   // the round ground shadow: not wanted here
    // the eye layers ignore the depth buffer (see buildPngEyes), so they would shine through the head / cloak: collect the eye groups so they can be switched off in the back view
    eyeG=[];avatar.traverse(m=>{if(m.isMesh&&m.material&&m.material.isShaderMaterial&&m.material.depthTest===false){const e=m.parent&&m.parent.parent&&m.parent.parent.parent;if(e&&!eyeG.includes(e))eyeG.push(e)}})};
  const frame=now=>{raf=requestAnimationFrame(frame);if(document.hidden)return;if(now-last<1000/P.fps-2)return;const dt=Math.min(.05,(now-last)/1000);last=now;
    yaw=yawTo;   // front / back view SNAP, no smooth turn
    if(avatar){const u=avatar.userData;avatar.rotation.y=yaw;u.setAim&&u.setAim(0,false);u.setScope&&u.setScope(false);if(u.move){u.move.f=0;u.move.s=0}u.holster&&u.holster(true);if(P.animate)u.update(dt,false,1);
      const back=Math.cos(yaw)<0;for(const e of eyeG)e.visible=!back}   // seen from behind (cloak / tail): the eyes are never drawn
    const vh=2*DIST*Math.tan(cam.fov*Math.PI/360);
    if(blob)blob.visible=false;
    cam.position.set(0,P.camY,DIST);cam.lookAt(0,.74,0);r.render(scene,cam);
    // the cat's materials carry the NO_OL define = they write ALPHA 0 (coatShader.js / atmosphere.js, meant for the game's outline pass). Read back through a 2D canvas that alpha-0 colour becomes transparent black = the all-black cat. So: set only the alpha channel to 1 (colours untouched), then put the GL state back.
    {const gl=r.getContext();gl.colorMask(false,false,false,true);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);gl.colorMask(true,true,true,true);gl.clearColor(1,0,1,1)}
    tctx.clearRect(0,0,gw,gh);tctx.drawImage(glc,0,0);   // drawImage right after render (same task) = the frame is still in the buffer
    const img=outline();
    if(img){ctx.putImageData(img,0,0);groundShadow(vh)}};   // no cat in this frame (half-built / lost buffer): keep showing the last good one
  addEventListener('resize',size);
  size();set(cfg0);raf=requestAnimationFrame(frame);
  return{set,view:a=>{yawTo=yaw=a},dispose(){if(physHeld){physHeld=false;physRelease()}cancelAnimationFrame(raf);removeEventListener('resize',size);
    if(avatar){avatar.userData.dispose&&avatar.userData.dispose();scene.remove(avatar);avatar=null}try{r.dispose();r.forceContextLoss()}catch(_){}}}
}

// ---- animated checkered background: rounded pixel squares scrolling diagonally. ONE 32x32 tile is drawn once; a CSS animation (transform, stepped in whole
// background pixels) scrolls it. That runs on the GPU compositor at the screen's full refresh rate and costs the main thread nothing, so it can never lag
// behind the cat preview or the tile rendering.
const BGC={base:'#c3a695',dot:'#d5baab',px:4,      // colours, size of one background pixel on screen
  cell:16,half:7.5,                                  // checker cell size and half the size of a square, in background pixels
  corner:.4,                                         // corner roundness (share of the half size)
  speed:15};                                         // scroll speed in background pixels per second
const BG_HOST='position:absolute;left:0;top:0;width:100%;height:100%;overflow:hidden;pointer-events:none';
function createChecker(host){
  injectCSS();
  const C=BGC.cell,per=C*2,S=Math.max(1,Math.floor(BGC.half)),rc=Math.max(1,Math.round(S*BGC.corner)),tile=document.createElement('canvas');tile.width=tile.height=per;
  const tx=tile.getContext('2d');tx.fillStyle=BGC.base;tx.fillRect(0,0,per,per);tx.fillStyle=BGC.dot;
  const sq=(cx,cy)=>{for(let dy=-S;dy<=S;dy++){const e=Math.abs(dy)-(S-rc),inset=e>0?rc-Math.round(Math.sqrt(Math.max(0,rc*rc-e*e))):0,hw=S-inset;tx.fillRect(cx-hw,cy+dy,hw*2+1,1)}};
  [[0,0],[per,0],[0,per],[per,per],[C,C]].forEach(p=>sq(p[0],p[1]));   // the checker repeats every 2 cells: corner squares wrap around, one in the middle
  const tp=per*BGC.px;
  host.style.cssText=BG_HOST;host.innerHTML='';
  const a=document.createElement('div');
  a.style.cssText=`position:absolute;left:0;top:0;width:calc(100% + ${tp}px);height:calc(100% + ${tp}px);background:url(${tile.toDataURL()}) 0 0/${tp}px ${tp}px;image-rendering:pixelated;--bgp:${tp}px;animation:mk2bg ${per/BGC.speed}s steps(${per}) infinite;will-change:transform`;
  host.appendChild(a);
  return()=>{host.innerHTML=''}}
const CSS_FILL='position:absolute;left:0;top:0;width:100%;height:100%;display:block;image-rendering:pixelated;pointer-events:none';
// My Character screen: the SAME look as the cat maker (checkered background + pixel preview with outline and foot shadow), cat centred. el = a full-screen container
export function createShowcase(el,cfg,black){
  el.innerHTML=`<div></div><canvas style="${CSS_FILL}"></canvas>`;
  const bg=createChecker(el.children[0]),pv=createPreview(el.children[1],cfg,{boxTop:'22vh'});if(pv)pv.set(cfg,black);
  return{set:(c,b)=>{pv&&pv.set(c,b)},dispose(){bg();pv&&pv.dispose();el.innerHTML=''}}}

// pixel two-tone coat chip (fur / pattern colour), a stepped diagonal, as an inline SVG background
const coatBG=(f,p)=>{let r='';for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(x+y>=8)r+=`<rect x='${x}' y='${y}' width='1' height='1'/>`;
  const svg=`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8' shape-rendering='crispEdges'><rect width='8' height='8' fill='${f}'/><g fill='${p}'>${r}</g></svg>`;
  return `background-image:url('data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g,'%27')}');background-size:100% 100%`};   // needs the data:image/svg+xml, prefix: without it the browser asks the server for a file called %3Csvg... (404) and the swatch stays empty

// every tile of one category for a given cat look. L(key,build,dir) makes the tile's icon: the maker passes `lazy` (placeholder now, rendered later),
// the boot-time baking below passes a collector. One list, so what gets baked is exactly what the maker will ask for.
function makeItems(cfg,cat,L){
  const pat=()=>cfg.pattern||'classic',gear=()=>cfg.gearC||GEAR_COLS[0];
  return ({
    pattern:()=>PATTERNS.map(p=>({html:L(`pat|${p[0]}|${cfg.fur}|${cfg.pat}`,()=>ball(cfg.fur,cfg.pat,p[0]),[0,.12,1]),sel:pat()===p[0],set:()=>cfg.pattern=p[0],t:p[1],lab:p[1]})),
    ears:()=>EARS.map(e=>({html:L(`ear|${e}|${cfg.fur}|${cfg.pat}`,()=>earPair(e,cfg.fur,cfg.pat),[0,.25,1]),sel:cfg.ears===e,set:()=>cfg.ears=e,t:EAR_NAMES[e],lab:EAR_NAMES[e]})),
    headS:()=>HEAD_SHAPES.map(x=>({html:L(`hshape|${x[0]}|${cfg.fur}|${cfg.pat}|${pat()}|${cfg.nose}|${cfg.eyeStyle}|${cfg.eyeColor}|${cfg.eyeDot?1:0}`,()=>faceIcon(cfg,'none',x[0]),[0,.05,1]),sel:(cfg.headShape||'round')===x[0],set:()=>cfg.headShape=x[0],t:x[1],lab:x[1]})),
    bodyS:()=>BODY_SHAPES.map(x=>({html:L(`bshape|${x[0]}|${cfg.fur}|${cfg.pat}|${pat()}`,()=>bodyIcon(cfg,x[0]),[0,.1,1]),sel:(cfg.bodyShape||'plush')===x[0],set:()=>cfg.bodyShape=x[0],t:x[1],lab:x[1]})),
    hair:()=>HAIRS.map(x=>({html:x[0]==='none'?noneIcon:L(`hair|${x[0]}|${cfg.hairC}|${cfg.fur}|${cfg.pat}|${cfg.headShape}|${pat()}`,()=>hairIcon(cfg,x[0]),[.35,.3,1]),sel:(cfg.hair||'none')===x[0],set:()=>cfg.hair=x[0],t:x[1],lab:x[1]})),
    eyeS:()=>EYE_STYLES.map(x=>({html:eyeStyleSVG(x[0]),sel:(cfg.eyeStyle||'default')===x[0],set:()=>cfg.eyeStyle=x[0],t:x[1],lab:x[1]})),
    nose:()=>NOSES.map(x=>({html:noseSVG(x[0]),sel:(cfg.nose||'button')===x[0],set:()=>cfg.nose=x[0],t:x[1],lab:x[1]})),
    cheeks:()=>CHEEKS.map(x=>({html:x[0]==='none'?noneIcon:L(`cheek|${x[0]}|${cfg.fur}|${cfg.pat}|${pat()}|${cfg.nose}|${cfg.eyeStyle}|${cfg.eyeColor}|${cfg.headShape}`,()=>faceIcon(cfg,x[0]),[0,.05,1]),sel:(cfg.cheeks||'none')===x[0],set:()=>cfg.cheeks=x[0],t:x[1],lab:x[1]})),
    tail:()=>TAILS.map(x=>({html:L(`tail|${x[0]}|${cfg.fur}|${cfg.pat}|${pat()}`,()=>tailIcon(cfg,x[0]),[1,.35,.25]),sel:(cfg.tail||'classic')===x[0],set:()=>cfg.tail=x[0],t:x[1],lab:x[1]})),
    whisk:()=>WHISKERS.map(x=>({html:x[0]==='none'?noneIcon:whiskSVG(x[0]),sel:(cfg.whiskers||'classic')===x[0],set:()=>cfg.whiskers=x[0],t:x[1],lab:x[1]})),
    collarT:()=>COLLAR_TYPES.map(x=>({html:L(`ctype|${x[0]}|${cfg.collar||COLLARS[0]}`,()=>collarIcon(cfg.collar||COLLARS[0],x[0]),[0,.55,1]),sel:(cfg.collarType||'normal')===x[0],set:()=>cfg.collarType=x[0],t:x[1],lab:x[1]})),
    cloak:()=>CLOAKS.filter(c=>c[0]!=='none').map(c=>({html:L(`cloak|${c[0]}|${cfg.cloakC}`,()=>buildCloakStatic(c[0],cfg.cloakC||CLOAK_COLS[0]),[.25,.25,-1]),sel:cfg.cloak===c[0],set:()=>cfg.cloak=c[0],t:c[1],lab:c[1]})),
    head:()=>HEADS.map(x=>({html:x[0]==='none'?noneIcon:L(`head|${x[0]}|${gear()}`,()=>buildHeadwear(x[0],gear()),[.45,.35,1]),sel:(cfg.head||'none')===x[0],set:()=>cfg.head=x[0],t:x[1],lab:x[1]})),
    eyewear:()=>EYEWEAR.map(x=>({html:x[0]==='none'?noneIcon:L(`eye|${x[0]}|${gear()}`,()=>buildEyewear(x[0],gear()),[.35,.2,1]),sel:(cfg.eyewear||'none')===x[0],set:()=>cfg.eyewear=x[0],t:x[1],lab:x[1]}))
  })[cat]()}

// BAKING: renders every tile icon of every category for one cat look (cfg), one after the other, yielding to the browser often so the loading screen keeps animating.
// Call it behind the boot loading screen: afterwards the maker opens with every icon already there (no placeholders, no 3D rendering while you click).
// Icons depend on the cat's colours (coat, pattern, collar, cloak, gear, eyes, hair): a different look is rendered lazily the first time you pick it.
//   await bakeMakerIcons(cfgOfTheCatYouPlay, p=>setProgress(p))      // p = 0..1
export async function bakeMakerIcons(cfg,onProgress){
  await eyesReady();                                  // the eye PNGs must be loaded, or the baked faces would have no eyes
  const todo=[],seen=new Set(),L=(k,b,d)=>{if(!seen.has(k)&&!urlCache.has(k)){seen.add(k);todo.push([k,b,d])}return ''};
  for(const t of TABS)for(const c of t[2])makeItems(cfg,c[0],L);
  const frame=()=>new Promise(r=>requestAnimationFrame(()=>setTimeout(r,0)));
  let t0=performance.now();
  for(let i=0;i<todo.length;i++){
    const [k,b,d]=todo[i];
    try{const u=iconOf(k,b,d);if(u)urlCache.set(k,u)}catch(e){console.warn('bake failed',k,e)}
    if(onProgress)onProgress((i+1)/todo.length);
    if(performance.now()-t0>10){await frame();t0=performance.now()}}   // ~10 ms of work, then let the page paint
  return todo.length}

export function openMaker(cfg,h){
  injectCSS();
  const el=document.getElementById('maker');el.hidden=false;let tab='cat',cat='pattern',forceBack=null,nmT=0,navTab=null;
  if(el._mkPrev){el._mkPrev.dispose();el._mkPrev=null}
  if(el._mkBg){el._mkBg();el._mkBg=null}
  pumpStop();
  el.innerHTML='<div class="mk2-bg" style="display:none"></div><div class="mk2-checker"></div><canvas class="mk2-prev"></canvas><div class="mk2-ui"></div>';
  el._mkBg=createChecker(el.querySelector('.mk2-checker'));
  const ui=el.querySelector('.mk2-ui'),prev=el._mkPrev=createPreview(el.querySelector('.mk2-prev'),cfg);
  if(!cfg.cloak||cfg.cloak==='none'){cfg.cloak=(CLOAKS.find(c=>c[0]!=='none')||['tattered'])[0];h.change(cfg)}   // the cloak cannot be removed
  const pat=()=>cfg.pattern||'classic',gear=()=>cfg.gearC||GEAR_COLS[0];
  const backNow=()=>forceBack!==null?forceBack:BACK_VIEW.has(cat);   // clicking a cloak colour also shows the back

  // ---- colour sections (the colour card). bg(i) = chip background css, on(i) = selected?, set(i) = apply
  const solid=(t,list,get,set)=>({t,n:list.length,bg:i=>`background:${list[i]}`,name:()=>t,on:i=>get()===list[i],set:i=>set(list[i])});
  const SECT={
    coat:{t:'Coat color',n:COATS.length,bg:i=>coatBG(COATS[i][0],COATS[i][1]),name:i=>COAT_NAMES[i],on:i=>cfg.fur===COATS[i][0]&&cfg.pat===COATS[i][1],set:i=>{cfg.fur=COATS[i][0];cfg.pat=COATS[i][1]}},
    collar:solid('Collar color',COLLARS,()=>cfg.collar||COLLARS[0],c=>cfg.collar=c),
    eye:solid('Eye color',EYECS,()=>cfg.eyeColor||EYECS[0],c=>cfg.eyeColor=c),
    hair:solid('Hair color',HAIR_COLS,()=>cfg.hairC||HAIR_COLS[0],c=>cfg.hairC=c),
    cloak:solid('Cloak color',CLOAK_COLS,()=>cfg.cloakC||CLOAK_COLS[0],c=>cfg.cloakC=c),
    gear:solid('Gear color',GEAR_COLS,gear,c=>cfg.gearC=c)
  };
  const secHTML=id=>{const s=SECT[id];let sw='';for(let i=0;i<s.n;i++)sw+=`<button class="mk2-sq" data-a="col" data-s="${id}" data-v="${i}" title="${s.name(i)}" aria-pressed="false"><span class="mk2-ring"><span class="mk2-chip" style="${s.bg(i)}"></span></span></button>`;
    const dot=id==='eye'?`<button class="mk2-dot" data-a="dot" role="switch" aria-checked="false"><i></i>White dot</button>`:'';
    return `<section class="mk2-cs" data-sec="${id}" hidden><header class="mk2-ch"><h4>${s.t}</h4>${dot||`<span class="n">${s.n} colors</span>`}</header><div class="mk2-sw">${sw}</div></section>`};

  // ---- the whole maker UI is built ONCE; render() only refills the tile grid and flips classes (nothing else reloads)
  ui.innerHTML=`<div class="mk2-name"><span>NAME</span><input id="nm" maxlength="8" value="${(cfg.name||'Ming').replace(/"/g,'&quot;')}" spellcheck="false" autocomplete="off"><i class="bi bi-pencil-fill nmi"></i></div>
    <aside class="mk2-col" aria-label="Colors" hidden>${Object.keys(SECT).map(secHTML).join('')}</aside>
    <div class="mk2-dock">
      <div class="mk2-grp" role="tablist">${TABS.map(t=>`<button class="mk2-g" role="tab" data-a="tab" data-v="${t[0]}" aria-selected="false">${t[1]}</button>`).join('')}</div>
      <nav class="mk2-tabs"></nav>
      <section class="mk2-pnl"><header class="mk2-head"><h3></h3><span></span></header><div class="mk2-grid"></div></section>
      <div class="mk2-foot"><button class="btn red" data-a="cancel"><i class="bi bi-x-lg"></i>Cancel</button><button class="btn gold" data-a="rand"><i class="bi bi-shuffle"></i>Random</button><button class="btn green" data-a="done"><i class="bi bi-check-lg"></i>Done</button></div>
    </div>`;
  const colEl=ui.querySelector('.mk2-col'),grpBtns=[...ui.querySelectorAll('.mk2-g')],nav=ui.querySelector('.mk2-tabs'),hT=ui.querySelector('.mk2-head h3'),hN=ui.querySelector('.mk2-head span'),grid=ui.querySelector('.mk2-grid'),dotBtn=ui.querySelector('.mk2-dot');
  const secEls={},secSw={};for(const id in SECT){secEls[id]=colEl.querySelector(`[data-sec="${id}"]`);secSw[id]=[...secEls[id].querySelectorAll('.mk2-sq')]}
  const syncColors=()=>{
    const ids=CAT_COLS[cat]||[];colEl.hidden=!ids.length;   // body shape / head shape / nose / cheeks / whiskers: no colour card
    for(const id in SECT){const sec=secEls[id],show=ids.includes(id);sec.hidden=!show;if(!show)continue;
      const s=SECT[id],sw=secSw[id];for(let i=0;i<s.n;i++){const on=s.on(i),b=sw[i];if(b.classList.contains('on')!==on){b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)}}}
    if(dotBtn){dotBtn.classList.toggle('on',!!cfg.eyeDot);dotBtn.setAttribute('aria-checked',!!cfg.eyeDot)}};

  // lazy: only the visible category is built, its icons are rendered one per frame (see lazy / pump)
  const items=()=>makeItems(cfg,cat,lazy);
  const cats=()=>TABS.find(t=>t[0]===tab)[2];
  const render=(keepScroll)=>{
    if(h.view)h.view(backNow()?0:Math.PI);   // (the 3D scene behind is hidden now, kept for the game)
    if(prev)prev.view(backNow()?Math.PI:0);   // preview camera is in FRONT of the cat: yaw 0 = face, PI = back (cloak / tail)
    slotCat=cat;slotN=0;
    const list=items(),title=cats().find(c=>c[0]===cat)[1];
    grpBtns.forEach(b=>{const on=b.dataset.v===tab;b.classList.toggle('on',on);b.setAttribute('aria-selected',on)});
    if(navTab!==tab){navTab=tab;nav.innerHTML=cats().map(c=>`<button class="mk2-tab" data-a="cat" data-v="${c[0]}" aria-pressed="false" title="${c[1]}"><i class="bi ${c[2]}"></i></button>`).join('')}   // only rebuilt when the group changes
    [...nav.children].forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===cat));
    hT.textContent=title;hN.textContent=list.length+' options';
    const st=keepScroll?grid.scrollTop:0;
    grid.innerHTML=list.map((it,i)=>`<button class="mk2-tile${it.sel?' on':''}${it.lab?' lab':''}" data-a="pick" data-v="${i}" title="${it.t}">${it.html}${it.lab?`<em>${it.lab}</em>`:''}</button>`).join('');
    grid.scrollTop=st;
    syncColors();   // the colour card is NOT rebuilt: only its selection + visibility are updated
    pump(ui);       // now fill the placeholder tiles, one 3D render per frame
  };
  const leave=()=>{clearTimeout(nmT);pumpStop();if(prev){prev.dispose();el._mkPrev=null}if(el._mkBg){el._mkBg();el._mkBg=null}el.hidden=true};
  el.onclick=e=>{const b=e.target.closest('button');if(!b||b.disabled)return;const{a,v}=b.dataset;let keep=false;
    if(a==='tab'){tab=v;cat=cats()[0][0];forceBack=null}else if(a==='cat'){cat=v;forceBack=null}
    else if(a==='rand'){const c=pick(COATS);Object.assign(cfg,{fur:c[0],pat:c[1],pattern:pick(PATTERNS)[0],ears:pick(EARS),eyeColor:pick(EYECS),collar:pick(COLLARS),collarType:pick(COLLAR_TYPES)[0],cloak:pick(CLOAKS.filter(c=>c[0]!=='none'))[0],cloakC:pick(CLOAK_COLS),head:pick(HEADS)[0],eyewear:pick(EYEWEAR)[0],gearC:pick(GEAR_COLS),eyeStyle:pick(EYE_STYLES)[0],nose:pick(NOSES)[0],cheeks:pick(CHEEKS)[0],tail:pick(TAILS)[0],whiskers:pick(WHISKERS)[0],headShape:pick(HEAD_SHAPES)[0],bodyShape:pick(BODY_SHAPES)[0],hair:pick(HAIRS)[0],hairC:pick(HAIR_COLS)});h.change(cfg);keep=true}
    else if(a==='done'||a==='cancel'){leave();h[a](cfg);return}
    else if(a==='dot'){cfg.eyeDot=!cfg.eyeDot;h.change(cfg);keep=true}
    else if(a==='col'){const id=b.dataset.s;SECT[id].set(+v);forceBack=id==='cloak';h.change(cfg);keep=true}   // colour card
    else if(a==='pick'){items()[+v].set();h.change(cfg);keep=true}
    if(prev&&(a==='rand'||a==='pick'||a==='dot'||a==='col'))prev.set(cfg);
    render(keep)};
  el.oninput=e=>{if(e.target.id==='nm'){cfg.name=e.target.value||'Ming';clearTimeout(nmT);nmT=setTimeout(()=>{h.change(cfg);prev&&prev.set(cfg)},250)}};   // the cat is only rebuilt once the typing pauses
  render();
}
