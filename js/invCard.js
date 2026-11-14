// Inventory card: a rounded-square card that lives INSIDE the game scene (three.js), floating in front of the camera.
// It is a real 3D object: it pops in (scale + spin, springy), idles with a tiny sway and tilts a little towards the mouse or
// the keyboard (arrow keys / W A S D). The inventory HTML (js/inventory.js) is glued to it: every frame the card's four front corners
// are projected to the screen and the HTML layer gets the matching CSS matrix3d, so perspective / tilt / pop are exact and every button still works.
//
//   main.js      : InvCard.init({scene,cam,renderer,keys}) once, InvCard.update(dt) every frame (after the camera is final),
//                  InvCard.viewShift() = how far the camera view is slid so the character stands in the free half, InvCard.spinY = drag-turn of the cat.
//   inventory.js : InvCard.bind(el,onLayout), InvCard.show(), InvCard.hide(done), InvCard.nudge(), InvCard.tiltScale(k).
import * as T from 'three';

const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const easeOutBack=t=>{const c1=1.70158,c3=c1+1,u=t-1;return 1+c3*u*u*u+c1*u*u};   // 0 -> 1 with a small overshoot
const OPEN_T=.55,CLOSE_T=.22;          // pop in / pop out seconds
const DIST=2.2;                         // metres in front of the camera (only sets how strong the perspective of the tilt is)
const DEPTH=26,RAD=36;                  // card thickness / corner radius, in design pixels
const MAX_YAW=.17,MAX_PITCH=.12;        // max tilt in radians (about 10 / 7 degrees): "a little bit"
const FACE='#fbf3dc',SIDE='#cdb98a';

// Where the card sits on screen and how big the HTML design canvas is. s = screen pixels per design pixel (the HTML is laid out on a W x H canvas).
export function layout(vw,vh){
  const portrait=vw<vh*.95;let cw,ch,cx,cy,s;
  if(portrait){cw=vw*.96;ch=Math.min(vh*.64,cw*1.6);cx=vw/2;cy=vh-ch/2-Math.max(8,vh*.012);s=clamp(cw/470,.72,1.25)}   // phones upright: card = bottom sheet, the cat above it
  else{const ch0=vh*.86;cw=Math.min(vw*.6,1400);ch=cw/1.45;if(ch>ch0){ch=ch0;cw=ch*1.45}                                  // landscape: card on the right, the cat on the left
    cx=vw-Math.max(12,vw*.025)-cw/2;cy=vh/2;s=clamp(Math.min(ch/700,cw/600),.72,1.25)}
  return{portrait,cw,ch,cx,cy,s,W:Math.round(cw/s),H:Math.round(ch/s)}}

// quad (4 screen points: top-left, top-right, bottom-right, bottom-left) -> CSS matrix3d that maps a W x H box onto it
export function quadMatrix(q,W,H){
  const x0=q[0],y0=q[1],x1=q[2],y1=q[3],x2=q[4],y2=q[5],x3=q[6],y3=q[7];
  const dx1=x1-x2,dx2=x3-x2,dy1=y1-y2,dy2=y3-y2,sx=x0-x1+x2-x3,sy=y0-y1+y2-y3;
  let a,b,c,d,e,f,g,h;
  if(Math.abs(sx)<1e-9&&Math.abs(sy)<1e-9){a=x1-x0;b=x3-x0;c=x0;d=y1-y0;e=y3-y0;f=y0;g=0;h=0}
  else{const den=dx1*dy2-dx2*dy1;if(Math.abs(den)<1e-12)return null;
    g=(sx*dy2-dx2*sy)/den;h=(dx1*sy-sx*dy1)/den;a=x1-x0+g*x1;b=x3-x0+h*x3;c=x0;d=y1-y0+g*y1;e=y3-y0+h*y3;f=y0}
  const m=[a/W,d/W,0,g/W,b/H,e/H,0,h/H,0,0,1,0,c,f,0,1];
  return m.every(Number.isFinite)?'matrix3d('+m.map(n=>n.toFixed(14)).join(',')+')':null}

function roundedShape(w,h,r){const s=new T.Shape(),x=-w/2,y=-h/2;
  s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s}

export const InvCard=(()=>{
  let scene=null,cam=null,rd=null,keys={},inited=false;
  let el=null,onLayout=null;
  const group=new T.Group();group.visible=false;
  let mesh=null,shadow=null;
  const mk=(c,o)=>new T.MeshBasicMaterial(Object.assign({color:c,fog:false,toneMapped:false,transparent:true,depthTest:false,depthWrite:false},o));
  const matFace=mk(FACE),matSide=mk(SIDE),matShadow=mk('#000000',{opacity:.3});   // always drawn on top of the world (no depth test), last (renderOrder)
  let st=0,t=0,doneCb=null;                   // st: 0 hidden, 1 popping in, 2 open, 3 popping out
  let ry=0,rx=0,kick=0,tiltK=1,mx=0,my=0,hasM=false,clock=0;
  let lw=0,lh=0,L=null,lW=0,lH=0;
  const v=new T.Vector3(),fw=new T.Vector3(),eul=new T.Euler(),tq=new T.Quaternion();

  function build(W,H){
    if(mesh){group.remove(mesh,shadow);mesh.geometry.dispose();shadow.geometry.dispose()}
    const sh=roundedShape(W,H,RAD);
    const g=new T.ExtrudeGeometry(sh,{depth:DEPTH,bevelEnabled:false,curveSegments:10});
    g.translate(0,0,-DEPTH);                                   // front face on z = 0 (the plane the HTML sits on), the thickness goes backwards
    g.groups.sort((a,b)=>b.materialIndex-a.materialIndex);     // side walls first, front face on top
    mesh=new T.Mesh(g,[matFace,matSide]);mesh.renderOrder=1000001;mesh.frustumCulled=false;
    shadow=new T.Mesh(new T.ShapeGeometry(sh,10),matShadow);shadow.position.set(14,-20,-DEPTH-2);shadow.renderOrder=1000000;shadow.frustumCulled=false;
    group.add(shadow,mesh)}

  const size=()=>{const cv=rd&&rd.domElement;return[(cv&&cv.clientWidth)||innerWidth,(cv&&cv.clientHeight)||innerHeight]};

  const api={
    spinY:0,                                    // how far the player dragged the cat round (radians), read by main.js
    init(o){if(inited)return;scene=o.scene;cam=o.cam;rd=o.renderer;keys=o.keys||{};scene.add(group);
      addEventListener('pointermove',e=>{mx=e.clientX;my=e.clientY;hasM=true},{passive:true});inited=true},
    /** the HTML element that is glued to the card + a callback({W,H,s,portrait,cw,ch}) when its design size changes */
    bind(e,cb){el=e;onLayout=cb;lw=0},
    show(){if(!inited){if(el){el.style.visibility='visible';el.style.transform=''}return}
      st=1;t=0;doneCb=null;group.visible=true;lw=0;rx=ry=0;kick=0},
    hide(done){if(!inited||st===0){done&&done();return}if(st===3)return;st=3;t=0;doneCb=done||null},
    isShown:()=>st!==0,
    nudge(){kick=.045},                          // little bump (tab switch)
    tiltScale(k){tiltK=k},                       // 0 = no tilt (the map tab needs a flat surface to pan on)
    /** fraction of the screen the camera view must slide so the character stands in the free area next to the card (x: sideways, y: portrait phones) */
    viewShift(){const[vw,vh]=size(),l=layout(vw,vh);
      return l.portrait?{x:0,y:Math.max(0,(vh-(l.cy-l.ch/2))/(2*vh))}:{x:Math.max(0,(vw-(l.cx-l.cw/2))/(2*vw)),y:0}},

    /** call once per frame, AFTER the camera has its final position / rotation */
    update(dt){
      if(!inited||!st)return;
      dt=Math.min(dt,.1);clock+=dt;t+=dt;
      const[vw,vh]=size();
      if(vw!==lw||vh!==lh){lw=vw;lh=vh;L=layout(vw,vh);if(L.W!==lW||L.H!==lH){lW=L.W;lH=L.H;build(lW,lH)}onLayout&&onLayout(L)}
      // ---- pop animation: p = 0..1 (a little over 1 while popping in)
      let p=1;
      if(st===1){const u=Math.min(1,t/OPEN_T);p=easeOutBack(u);if(u>=1)st=2}
      else if(st===3){const u=Math.min(1,t/CLOSE_T);p=1-u*u;
        if(u>=1){st=0;group.visible=false;if(el)el.style.visibility='hidden';const d=doneCb;doneCb=null;d&&d();return}}
      // ---- tilt: the keyboard (arrow keys / W A S D) wins, otherwise the card turns a little towards the mouse
      const kx=((keys.ArrowRight||keys.KeyD)?1:0)-((keys.ArrowLeft||keys.KeyA)?1:0),ky=((keys.ArrowDown||keys.KeyS)?1:0)-((keys.ArrowUp||keys.KeyW)?1:0);
      let nx=0,ny=0;
      if(kx||ky){nx=kx;ny=ky}else if(hasM){nx=clamp((mx-L.cx)/(vw*.5),-1,1);ny=clamp((my-L.cy)/(vh*.5),-1,1)}
      const k=1-Math.exp(-dt*9);
      ry+=(nx*MAX_YAW*tiltK-ry)*k;rx+=(ny*MAX_PITCH*tiltK-rx)*k;kick*=Math.exp(-dt*9);
      const sway=tiltK?1:0,pin=1-clamp(p,0,1);                       // pin: 1 at the start of the pop, 0 when it is done
      eul.set(rx+Math.cos(clock*.7)*.01*sway,ry+Math.sin(clock*.9)*.014*sway-pin*.95,pin*.22,'YXZ');   // popping in: it spins in from the side and straightens up
      tq.setFromEuler(eul);
      // ---- place it: in front of the camera, on the screen spot the layout wants, facing the camera
      cam.updateMatrixWorld();
      v.set(L.cx/vw*2-1,-(L.cy/vh)*2+1,.5).unproject(cam).sub(cam.position);
      cam.getWorldDirection(fw);v.multiplyScalar(DIST/Math.max(1e-4,v.dot(fw))).add(cam.position);
      group.position.copy(v);group.quaternion.copy(cam.quaternion).multiply(tq);
      const px=2*DIST*Math.tan(T.MathUtils.degToRad(cam.getEffectiveFOV()*.5))/vh;                  // world metres per screen pixel at that distance
      group.scale.setScalar(Math.max(1e-4,L.s*px*p*(1+kick)));
      // ---- glue the HTML on: project the 4 front corners, turn them into a matrix3d
      if(el){
        if(p<.04){el.style.visibility='hidden';return}
        group.updateMatrixWorld(true);
        const hw=lW/2,hh=lH/2,q=[];
        for(const c of[[-hw,hh],[hw,hh],[hw,-hh],[-hw,-hh]]){v.set(c[0],c[1],0).applyMatrix4(group.matrixWorld).project(cam);q.push((v.x*.5+.5)*vw,(-v.y*.5+.5)*vh)}
        const m=quadMatrix(q,lW,lH);
        if(m){el.style.transform=m;el.style.opacity=String(clamp((p-.35)/.45,0,1));el.style.visibility='visible'}}}
  };
  return api})();
