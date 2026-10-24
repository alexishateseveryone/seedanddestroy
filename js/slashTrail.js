// Slash trail: a smooth glowing ribbon that follows the blade through a swing.
// World space, the last few blade positions are Catmull-Rom smoothed into a long arc; a tinted glow ribbon + a hot white core ribbon on the cutting edge.
// Usage: const tr=createSlashTrail(); tr.attach(scene); every frame: tr.push(bladeBase,bladeTip,'#color') while swinging, else tr.stop(); then tr.update(dt).
import * as T from 'three';
const M=40,H=12;   // M = vertices along the finished ribbon, H = raw blade samples kept
let TEX=null;
// u (x) runs from the blade's current position (0) to the old end of the trail (1); v (y) from the hilt side (0) to the cutting edge (1)
const tex=()=>{if(TEX)return TEX;const W=128,Hh=32,c=document.createElement('canvas');c.width=W;c.height=Hh;const g=c.getContext('2d'),im=g.createImageData(W,Hh);
  for(let y=0;y<Hh;y++)for(let x=0;x<W;x++){const u=x/(W-1),v=1-y/(Hh-1),a=Math.pow(1-u,1.5)*(.08+.92*Math.pow(v,2))*Math.min(1,.35+u*10),i=(y*W+x)*4;
    im.data[i]=im.data[i+1]=im.data[i+2]=255;im.data[i+3]=Math.min(255,a*330)}
  g.putImageData(im,0,0);TEX=new T.CanvasTexture(c);TEX.colorSpace=T.SRGBColorSpace;return TEX};
const ribbon=()=>{const pos=new Float32Array(M*2*3),uv=new Float32Array(M*2*2),idx=[];
  for(let i=0;i<M;i++){const u=i/(M-1);uv.set([u,0,u,1],i*4)}
  for(let i=0;i<M-1;i++){const a=i*2;idx.push(a,a+1,a+2,a+2,a+1,a+3)}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3).setUsage(T.DynamicDrawUsage));g.setAttribute('uv',new T.BufferAttribute(uv,2));g.setIndex(idx);
  const m=new T.Mesh(g,new T.MeshBasicMaterial({map:tex(),color:'#ffffff',transparent:true,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide}));
  m.frustumCulled=false;m.visible=false;m.renderOrder=6;return m};

export function createSlashTrail(){
  const glow=ribbon(),core=ribbon(),hist=[],mix=new T.Vector3();let active=false,fade=0,acc=0,parent=null;
  const rebuild=()=>{
    if(hist.length<2||fade<=0){glow.visible=core.visible=false;return}
    const pb=new T.CatmullRomCurve3(hist.map(h=>h.b),false,'centripetal').getPoints(M-1),pt=new T.CatmullRomCurve3(hist.map(h=>h.t),false,'centripetal').getPoints(M-1),
      a=glow.geometry.attributes.position,c=core.geometry.attributes.position;
    for(let i=0;i<M;i++){
      a.setXYZ(i*2,pb[i].x,pb[i].y,pb[i].z);a.setXYZ(i*2+1,pt[i].x,pt[i].y,pt[i].z);
      mix.copy(pb[i]).lerp(pt[i],.74);c.setXYZ(i*2,mix.x,mix.y,mix.z);c.setXYZ(i*2+1,pt[i].x,pt[i].y,pt[i].z)}
    a.needsUpdate=true;c.needsUpdate=true;
    glow.material.opacity=Math.min(1,fade)*.9;core.material.opacity=Math.min(1,fade);glow.visible=core.visible=true};
  return{
    attach(p){parent=p;p.add(glow,core)},
    push(b,t,col){if(!active){hist.length=0;active=true}fade=1;hist.unshift({b:b.clone(),t:t.clone()});if(hist.length>H)hist.pop();glow.material.color.set(col||'#ffe8a8')},
    stop(){active=false},
    update(dt){
      if(!active){fade-=dt*5;acc+=dt;while(acc>=.016&&hist.length){acc-=.016;hist.pop()}if(fade<=0||hist.length<2){fade=0;hist.length=0}}
      if(fade>0||glow.visible)rebuild()},
    dispose(){if(parent){parent.remove(glow,core)}[glow,core].forEach(m=>{m.geometry.dispose();m.material.dispose()})}
  };
}