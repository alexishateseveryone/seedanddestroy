// Silhouette icon of the player's cat for the main menu "My Character" tile: the WHOLE body, seen from the front, flat black, WHITE eyes.
// It is the real avatar (createCatAvatar), so ears, tail, cloak, collar, hat, glasses, body shape ... are all in the outline.
// The avatar's own idle animation is played (U.update, no weapon, standing still): ~20 frames are rendered and packed into ONE sprite sheet,
// the tile plays it back and forth with CSS (ping-pong, so the loop has no seam). Two white eyes are parented to the head group,
// so they move with the head; one frame of the loop has them squashed flat = a blink.
// Built once per cat look (cached) and handed to the tile as a data URL.
import * as T from 'three';
import {createCatAvatar} from './catAvatar.js';

const N=48,STEP=2,DT=1/45;          // 48 frames, one every 2 steps of 1/45 s (22.5 fps): ~2.1 s of idle, played forward and back
const BLINK={21:.55,22:.09,23:.55};  // frame number -> eye height factor (a quick 3-frame blink instead of a one-frame snap)
const EYE={x:.42,y:-.02,z:.9,rx:.17,ry:.22,tilt:.14,blink:.09};   // white eyes in HEAD-LOCAL units (same numbers wearables.js uses for the lenses)
const WW=320,WH=480;                 // working render size (2:3), cropped and shrunk into the sheet afterwards
const CELL_H=224,CELL_MAXW=160;     // 48 x 160 = 7680 px wide, under the 8192 texture limit of phones      // one frame of the sheet
// "empty hands" so the avatar is happy to run its normal update(): a melee weapon with the default (woodensword) idle animation, hidden by holster()
const NONE={id:'woodensword',kind:'melee',handling:'normal',stats:{dur:.5},build:()=>({group:new T.Group()})};
const CACHE=new Map();

export const charIconCached=cfg=>CACHE.get(JSON.stringify(cfg||{}))||null;

export function charIconFrames(cfg){
  const key=JSON.stringify(cfg||{});
  if(CACHE.has(key))return CACHE.get(key);
  let res=null;
  try{res=render(cfg||{})}catch(e){console.warn('character icon failed, falling back to the head picture',e)}
  if(res){if(CACHE.size>=6)CACHE.delete(CACHE.keys().next().value);CACHE.set(key,res)}
  return res;   // {sheet (data URL), n, ar (frame width / height), dur (seconds, one way)} or null
}

// the head = the biggest mesh with the head coat shader (coatShader.js tags every coat material with its body part, 0 = head)
function findHeadMesh(av){
  const sz=new T.Vector3();let best=null,bv=0;
  av.updateMatrixWorld(true);
  av.traverse(o=>{
    if(!o.isMesh)return;
    const ms=Array.isArray(o.material)?o.material:[o.material];
    if(!ms.some(m=>m&&m.userData&&m.userData.u&&m.userData.u.uPart&&m.userData.u.uPart.value===0))return;
    new T.Box3().setFromObject(o).getSize(sz);const v=sz.x*sz.y*sz.z;
    if(v>bv){bv=v;best=o}
  });
  return best;
}
const shown=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true};

function render(cfg){
  const cv=document.createElement('canvas');cv.width=WW;cv.height=WH;
  const r=new T.WebGLRenderer({canvas:cv,alpha:true,antialias:true,preserveDrawingBuffer:true});
  const black=new T.MeshBasicMaterial({color:0x07060a,side:T.DoubleSide}),wm=new T.MeshBasicMaterial({color:0xffffff,depthTest:false,transparent:true}),eg=new T.CircleGeometry(1,32);
  try{
    r.setPixelRatio(1);r.setSize(WW,WH,false);r.setClearColor(0x000000,0);
    const scene=new T.Scene(),av=createCatAvatar(cfg),U=av.userData;
    av.position.set(0,0,0);av.rotation.set(0,0,0);scene.add(av);
    U.equip(NONE);U.holster(true);U.setAim&&U.setAim(0,false);                    // standing still, hands empty
    for(let i=0;i<45;i++)U.update(DT,false,1);                                    // settle: idle blend, cloak, tail, collar
    av.updateMatrixWorld(true);

    const headMesh=findHeadMesh(av);if(!headMesh)return null;
    const head=headMesh.parent;                                                   // the head group (the eyewear / hat / ears live in it too)

    // flat black, and drop everything that is not part of the cat's body: the ground shadow blob (a thin flat disc), sprites, lines, points
    const sz=new T.Vector3();
    av.traverse(o=>{
      if(o.isMesh){
        new T.Box3().setFromObject(o).getSize(sz);
        if(sz.y<.03&&sz.x>.12){o.visible=false;return}                             // ground shadow
        o.material=Array.isArray(o.material)?o.material.map(()=>black):black;
      }else if(o.isSprite||o.isPoints||o.isLine)o.visible=false;
    });

    // white eyes ride on the head group (always drawn on top, whatever the head shape)
    const eyes=[-1,1].map(s=>{const m=new T.Mesh(eg,wm);m.position.set(s*EYE.x,EYE.y,EYE.z);m.rotation.set(0,0,s*EYE.tilt);m.scale.set(EYE.rx,EYE.ry,1);m.renderOrder=999;head.add(m);return m});

    // camera: straight in FRONT of the cat (it faces +z), framing the whole settled body (+ margin for the idle sway)
    const box=new T.Box3(),tmp=new T.Box3();
    av.traverse(o=>{if(o.isMesh&&shown(o)&&o.material===black){tmp.setFromObject(o);if(!tmp.isEmpty())box.union(tmp)}});
    const c=box.getCenter(new T.Vector3()),s=box.getSize(new T.Vector3());
    const hh=Math.max(s.y/2*1.14,s.x/2*1.14*(WH/WW)),hw=hh*WW/WH;
    const cam=new T.OrthographicCamera(-hw,hw,hh,-hh,.1,s.z+80);cam.position.set(c.x,c.y,box.max.z+30);

    // play the idle, grab a frame every STEP steps
    const frames=[];
    for(let i=0;i<N;i++){
      for(let k=0;k<STEP;k++)U.update(DT,false,1);
      const ey=EYE.ry*(BLINK[i]!==undefined?BLINK[i]:1);eyes.forEach(e=>e.scale.y=ey);
      r.render(scene,cam);
      const f=document.createElement('canvas');f.width=WW;f.height=WH;f.getContext('2d').drawImage(cv,0,0);frames.push(f);
    }

    // one crop for every frame (union of what was drawn), so nothing jumps when the loop plays
    let x0=WW,y0=WH,x1=-1,y1=-1;
    for(const f of frames){
      const d=f.getContext('2d').getImageData(0,0,WW,WH).data;
      for(let y=0;y<WH;y++)for(let x=0;x<WW;x++)if(d[(y*WW+x)*4+3]>20){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
    }
    if(x1<0)return null;                                                           // nothing drawn: caller falls back
    const pad=Math.round(Math.max(x1-x0,y1-y0)*.05);
    x0=Math.max(0,x0-pad);y0=Math.max(0,y0-pad);x1=Math.min(WW-1,x1+pad);y1=Math.min(WH-1,y1+pad);
    const cw0=x1-x0+1,ch0=y1-y0+1,ar=cw0/ch0;
    let ch=CELL_H,cw=Math.round(ch*ar);if(cw>CELL_MAXW){cw=CELL_MAXW;ch=Math.round(cw/ar)}
    const sheet=document.createElement('canvas');sheet.width=cw*N;sheet.height=ch;
    const g=sheet.getContext('2d');g.imageSmoothingQuality='high';
    frames.forEach((f,i)=>g.drawImage(f,x0,y0,cw0,ch0,i*cw,0,cw,ch));
    return {sheet:sheet.toDataURL('image/png'),n:N,ar:cw/ch,dur:(2*N-2)*STEP*DT};
  }finally{
    black.dispose();wm.dispose();eg.dispose();
    r.dispose();r.forceContextLoss&&r.forceContextLoss();
  }
}

// =====================================================================================================================
// BOOT LOADING SCREEN: the cat RUNNING AWAY, seen from BEHIND. Flat pure WHITE silhouette (no eyes).
// The run cycle length is not known in advance, so ~2.4 s of running are captured and the loop length is found by comparing every
// frame's silhouette with the first one (the best match = one full stride). Only that one stride is packed into the sprite sheet,
// so the loop has no seam. Returns {sheet, n, ar, dur} (dur = seconds for one full loop) or null.
// =====================================================================================================================
const RW=240,RH=320,RSTEP=2,RDT=1/60,RWARM=90,RSAMP=72,RMAX=56,RMIN=6;   // working size, 1/30 s per sample, warm-up steps, samples taken, longest / shortest loop (samples)

export function charRunFrames(cfg){
  try{return renderRun(cfg||{})}catch(e){console.warn('running icon failed',e);return null}
}

function renderRun(cfg){
  const cv=document.createElement('canvas');cv.width=RW;cv.height=RH;
  const r=new T.WebGLRenderer({canvas:cv,alpha:true,antialias:true,preserveDrawingBuffer:true});
  const white=new T.MeshBasicMaterial({color:0xffffff,side:T.DoubleSide});
  try{
    r.setPixelRatio(1);r.setSize(RW,RH,false);r.setClearColor(0x000000,0);
    const scene=new T.Scene(),av=createCatAvatar(cfg),U=av.userData;
    av.position.set(0,0,0);av.rotation.set(0,0,0);scene.add(av);
    U.equip(NONE);U.holster(true);U.setAim&&U.setAim(0,false);
    U.move.f=1;U.move.s=0;                                                       // running forward
    for(let i=0;i<RWARM;i++)U.update(RDT,true,1);
    av.updateMatrixWorld(true);
    const sz=new T.Vector3();
    av.traverse(o=>{
      if(o.isMesh){
        new T.Box3().setFromObject(o).getSize(sz);
        if(sz.y<.03&&sz.x>.12){o.visible=false;return}                             // ground shadow
        o.material=Array.isArray(o.material)?o.material.map(()=>white):white;
      }else if(o.isSprite||o.isPoints||o.isLine)o.visible=false;
    });
    // camera straight BEHIND the cat (it faces +z, so the camera sits at -z). Framed from the union of a stride of motion.
    const box=new T.Box3(),tmp=new T.Box3();
    for(let i=0;i<40;i++){
      for(let k=0;k<RSTEP;k++)U.update(RDT,true,1);av.updateMatrixWorld(true);
      av.traverse(o=>{if(o.isMesh&&shown(o)&&o.material===white){tmp.setFromObject(o);if(!tmp.isEmpty())box.union(tmp)}});
    }
    const c=box.getCenter(new T.Vector3()),s=box.getSize(new T.Vector3());
    const hh=Math.max(s.y/2*1.12,s.x/2*1.3*(RH/RW)),hw=hh*RW/RH;
    const cam=new T.OrthographicCamera(-hw,hw,hh,-hh,.1,s.z+80);cam.position.set(c.x,c.y,box.min.z-30);cam.lookAt(c.x,c.y,c.z);

    // capture RSAMP samples (1/30 s apart): small alpha masks for all, full frames for the first RMAX
    const SMW=64,SMH=48,sm=document.createElement('canvas');sm.width=SMW;sm.height=SMH;const sg=sm.getContext('2d',{willReadFrequently:true});
    const masks=[],frames=[];
    for(let i=0;i<RSAMP;i++){
      for(let k=0;k<RSTEP;k++)U.update(RDT,true,1);
      r.render(scene,cam);
      sg.clearRect(0,0,SMW,SMH);sg.drawImage(cv,0,0,SMW,SMH);
      const d=sg.getImageData(0,0,SMW,SMH).data,m=new Uint8Array(SMW*SMH);for(let p=0;p<m.length;p++)m[p]=d[p*4+3];masks.push(m);
      if(i<RMAX){const f=document.createElement('canvas');f.width=RW;f.height=RH;f.getContext('2d').drawImage(cv,0,0);frames.push(f)}
    }
    // loop length = the first sample after which the silhouette matches the first one again (local minimum, close to the global best)
    const diff=[];let best=1e18;
    for(let k=0;k<RSAMP;k++){let d=0;for(let p=0;p<masks[0].length;p++)d+=Math.abs(masks[0][p]-masks[k][p]);diff.push(d);if(k>=RMIN&&k<=RMAX&&d<best)best=d}
    let P=-1;
    for(let k=RMIN;k<=RMAX;k++)if(diff[k]<=best*1.3&&diff[k]<=diff[k-1]&&diff[k]<=diff[k+1]){P=k;break}
    if(P<0)for(let k=RMIN;k<=RMAX;k++)if(diff[k]===best){P=k;break}
    if(P<0)P=Math.min(RMAX,frames.length);
    const loop=frames.slice(0,P);

    // one crop for every frame
    let x0=RW,y0=RH,x1=-1,y1=-1;
    for(const f of loop){
      const d=f.getContext('2d').getImageData(0,0,RW,RH).data;
      for(let y=0;y<RH;y++)for(let x=0;x<RW;x++)if(d[(y*RW+x)*4+3]>20){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
    }
    if(x1<0)return null;
    const pad=Math.round(Math.max(x1-x0,y1-y0)*.05);
    x0=Math.max(0,x0-pad);y0=Math.max(0,y0-pad);x1=Math.min(RW-1,x1+pad);y1=Math.min(RH-1,y1+pad);
    const cw0=x1-x0+1,ch0=y1-y0+1,ar=cw0/ch0;
    let ch=240,cw=Math.round(ch*ar);if(cw>200){cw=200;ch=Math.round(cw/ar)}
    if(cw*P>8000){cw=Math.floor(8000/P);ch=Math.round(cw/ar)}                      // stay under the 8192 px texture limit of phones
    const sheet=document.createElement('canvas');sheet.width=cw*P;sheet.height=ch;
    const g=sheet.getContext('2d');g.imageSmoothingQuality='high';
    loop.forEach((f,i)=>g.drawImage(f,x0,y0,cw0,ch0,i*cw,0,cw,ch));
    return {sheet:sheet.toDataURL('image/png'),n:P,ar:cw/ch,dur:P*RSTEP*RDT};
  }finally{
    white.dispose();
    r.dispose();r.forceContextLoss&&r.forceContextLoss();
  }
}