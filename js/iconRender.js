// Renders a three.js object ONCE and turns it into a flat 2D pixel-art PNG data-URL, so the customizer tiles show the real model (ears, headwear, eyewear,
// collar, cloak, coat swatches ...) as a crisp 2D sprite in the same pixel style as the cat preview: chunky pixels + a dark-blue 1-pixel outline.
// 3D -> 2D steps:  draw the model into a small render target  ->  read the pixels  ->  shrink to a GRID x GRID pixel sprite  ->  add the outline  ->  scale up with nearest-neighbour.
// It draws with the GAME'S OWN renderer (call useIconRenderer(renderer) once in main.js). A second private renderer is only a fallback.
// A blank result is never cached, so a tile simply retries next time.
import * as T from 'three';

const SIZE=96,                 // size of the 3D render and of the final PNG
  GRID=32,                     // sprite resolution: 32 x 32 pixels (SIZE/GRID = 3 screen pixels per sprite pixel). Smaller = chunkier, bigger = finer
  OUTLINE=[27,42,94],          // outline colour (same dark blue as the cat preview)
  FIT=1.3;                     // how much empty space around the model (room for the outline)
const K=SIZE/GRID,cache=new Map();
let shared=null,own=null,RT,scene,cam,key,cvOut,cxOut,cvSm,cxSm,imgSm,buf,warned=new Set();

export function useIconRenderer(r){shared=r}

function setup(){
  if(scene)return;
  RT=new T.WebGLRenderTarget(SIZE,SIZE,{depthBuffer:true});RT.texture.colorSpace=T.SRGBColorSpace;
  cvOut=document.createElement('canvas');cvOut.width=cvOut.height=SIZE;cxOut=cvOut.getContext('2d');
  cvSm=document.createElement('canvas');cvSm.width=cvSm.height=GRID;cxSm=cvSm.getContext('2d');imgSm=cxSm.createImageData(GRID,GRID);
  buf=new Uint8Array(SIZE*SIZE*4);
  scene=new T.Scene();
  scene.add(new T.HemisphereLight('#fff6d8','#9aa0c8',1.9));
  key=new T.DirectionalLight('#fff0c8',2.2);scene.add(key,key.target);
  cam=new T.PerspectiveCamera(28,1,.01,100);
}
function ownRenderer(){
  if(own&&!own.getContext().isContextLost())return own;
  try{own=new T.WebGLRenderer({alpha:false,antialias:false,preserveDrawingBuffer:true});own.setPixelRatio(1);own.setSize(SIZE,SIZE)}
  catch(e){console.warn('icon renderer unavailable',e);own=null}
  return own;
}

// The cat's materials carry the define NO_OL = they write ALPHA 0 (meant for the game's outline pass). The old code removed that define for every icon,
// which forced a shader recompile per tile (very slow). Now the background is a KEY COLOUR (magenta) instead: whatever is not magenta is the model,
// whatever alpha it wrote. No define is touched, so no shader is ever recompiled for an icon.
const isKey=(r,g,b)=>r>250&&g<8&&b>250;

// the 3D -> 2D conversion. Returns a data-URL ('' when nothing was drawn)
function toSprite(){
  const o=imgSm.data,solid=new Uint8Array(GRID*GRID);let any=0;
  for(let gy=0;gy<GRID;gy++)for(let gx=0;gx<GRID;gx++){
    // readPixels is bottom-up: take the pixel in the middle of this GRID cell
    const px=gx*K+(K>>1),py=SIZE-1-(gy*K+(K>>1)),s=(py*SIZE+px)*4,t=(gy*GRID+gx)*4;
    if(isKey(buf[s],buf[s+1],buf[s+2])){o[t]=o[t+1]=o[t+2]=o[t+3]=0}
    else{o[t]=buf[s];o[t+1]=buf[s+1];o[t+2]=buf[s+2];o[t+3]=255;solid[gy*GRID+gx]=1;any=1}}
  if(!any)return '';
  for(let y=0;y<GRID;y++)for(let x=0;x<GRID;x++){const i=y*GRID+x;if(solid[i])continue;   // 1-pixel outline on every empty pixel that touches the sprite
    if((x>0&&solid[i-1])||(x<GRID-1&&solid[i+1])||(y>0&&solid[i-GRID])||(y<GRID-1&&solid[i+GRID])){const t=i*4;o[t]=OUTLINE[0];o[t+1]=OUTLINE[1];o[t+2]=OUTLINE[2];o[t+3]=255}}
  cxSm.putImageData(imgSm,0,0);
  cxOut.clearRect(0,0,SIZE,SIZE);cxOut.imageSmoothingEnabled=false;cxOut.drawImage(cvSm,0,0,SIZE,SIZE);   // nearest-neighbour upscale = crisp pixels
  return cvOut.toDataURL('image/png');
}

// draw obj with renderer R, return a data-URL ('' when nothing was drawn)
function draw(R,obj,dir,fit){
  const isShared=R===shared;
  const prev=isShared?{rt:R.getRenderTarget(),col:R.getClearColor(new T.Color()),a:R.getClearAlpha(),auto:R.autoClear}:null;
  try{
    scene.add(obj);obj.updateMatrixWorld(true);
    const box=new T.Box3().setFromObject(obj),c=box.getCenter(new T.Vector3()),sz=box.getSize(new T.Vector3());
    const r=Math.max(sz.x,sz.y,sz.z,.01)*.62;
    const d=new T.Vector3(...dir).normalize(),dist=r/Math.sin(cam.fov*Math.PI/360)*fit;
    cam.position.copy(c).addScaledVector(d,dist);cam.lookAt(c);cam.updateProjectionMatrix();
    key.position.copy(cam.position).add(new T.Vector3(-1.2,1.8,1).multiplyScalar(r));key.target.position.copy(c);
    R.setClearColor(0xff00ff,1);R.autoClear=true;
    R.setRenderTarget(RT);R.clear();R.render(scene,cam);
    R.readRenderTargetPixels(RT,0,0,SIZE,SIZE,buf);
    return toSprite();
  }finally{
    scene.remove(obj);
    try{R.setRenderTarget(isShared?prev.rt:null)}catch(_){}
    if(isShared){R.setClearColor(prev.col,prev.a);R.autoClear=prev.auto}
  }
}

// key_: cache key (include everything the look depends on: colours, type ...)
// build: () => Object3D, dir: camera direction from the object's centre
export function iconOf(key_,build,dir=[.3,.3,1],fit=FIT){
  if(cache.has(key_))return cache.get(key_);
  let url='';
  setup();
  const tries=[shared,null];                                         // game renderer first, private renderer as the fallback
  for(const t of tries){
    try{
      const R=t||ownRenderer();if(!R)continue;
      url=draw(R,build(),dir,fit);
      if(url)break;
    }catch(e){if(!warned.has(key_)){warned.add(key_);console.warn('icon render failed',key_,e)}}
  }
  if(!url&&!warned.has(key_)){warned.add(key_);console.warn('icon render produced nothing',key_)}
  if(url)cache.set(key_,url);return url;   // never cache a failed / empty render, so the tile retries next time
}
