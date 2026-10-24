// Blade trail for melee weapons: a clean, smooth anime-style slash smear that follows the real blade (tip -> base). NO particles.
//  - crisp white-hot rim along the leading edge that tapers to a point at both ends
//  - a hot core, a blade-coloured body and a shifted-hue (cyan -> pink) fringe, all made of jagged shard streaks that flow along the swing
//  - soft halo behind it, colours pushed above 1.0 so bloom picks them up
// Catmull-Rom smoothing (4 sub-steps per sample) so fast swings are one fluid curve. Pure procedural geometry, additive, world-space (it stays in the air when you move).
// The blade extent is measured from the weapon's own meshes.
// setBlade(node,color,core,{w:widthMul,a:alphaMul}) lets a weapon (e.g. dual daggers) ask for a bigger / brighter trail.
import * as T from 'three';
const N=36,SUB=4,LIFE=.46,MAXK=(N-1)*SUB+1;
const tex=(w,h,draw,rep)=>{const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;if(rep)t.wrapS=T.RepeatWrapping;return t};
const stops=(gr,a)=>{a.forEach(([s,v])=>gr.addColorStop(s,`rgba(255,255,255,${v})`));return gr};
// ribbon profiles: v runs across the ribbon (canvas top = leading edge / tip side), u along it (tiles)
const auraTex=tex(64,64,(g,w,h)=>{g.fillStyle=stops(g.createLinearGradient(0,0,0,h),[[0,0],[.17,.85],[.4,.45],[.75,.12],[1,0]]);g.fillRect(0,0,w,h)});
const edgeTex=tex(256,32,(g,w,h)=>{g.fillStyle=stops(g.createLinearGradient(0,0,0,h),[[0,0],[.14,1],[.42,.5],[1,0]]);g.fillRect(0,0,w,h)});
// jagged shard streaks: thin tapered slivers of different lengths, densest on the leading edge, wrapped so the texture tiles along the ribbon
const streaks=(n,minL,maxL)=>tex(512,128,(g,w,h)=>{
  g.fillStyle=stops(g.createLinearGradient(0,0,0,h),[[0,.8],[.1,.5],[.4,.15],[1,0]]);g.fillRect(0,0,w,h);
  g.globalCompositeOperation='lighter';
  for(let i=0;i<n;i++){const y=Math.pow(Math.random(),1.3)*h*.93,x0=Math.random()*w,len=w*(minL+Math.random()*(maxL-minL)),th=1.5+Math.random()*4.5,tilt=(Math.random()-.5)*th*3.2,a=.35+Math.random()*.65;
    for(const o of[-w,0,w]){const x=x0+o,gr=g.createLinearGradient(x,0,x+len,0);gr.addColorStop(0,'rgba(255,255,255,0)');gr.addColorStop(.28,`rgba(255,255,255,${a})`);gr.addColorStop(1,'rgba(255,255,255,0)');
      g.fillStyle=gr;g.beginPath();g.moveTo(x,y);g.lineTo(x+len*.3,y-th/2);g.lineTo(x+len,y+tilt);g.lineTo(x+len*.3,y+th/2);g.closePath();g.fill()}}},true);
const strk=[streaks(60,.12,.55),streaks(46,.1,.45),streaks(30,.08,.35)];
const _m=new T.Matrix4(),_v=new T.Vector3(),_b=new T.Box3(),WHITE=new T.Color('#ffffff');
const cr=(a,b,c,d,f)=>.5*(2*b+(-a+c)*f+(2*a-5*b+4*c-d)*f*f+(-a+3*b-3*c+d)*f*f*f);   // Catmull-Rom
const accent=(c,k)=>{const o={};k.copy(c).getHSL(o);return k.setHSL((o.h+.36)%1,.9,.66)};   // hue-shifted fringe colour (cyan -> pink)

// how far the weapon reaches from the grip and along which local axis (the blade / shaft axis)
function span(node){
  node.updateWorldMatrix(true,true);const inv=new T.Matrix4().copy(node.matrixWorld).invert();_b.makeEmpty();
  node.traverse(o=>{if(!(o.isMesh&&o.geometry))return;if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();const bb=o.geometry.boundingBox;_m.multiplyMatrices(inv,o.matrixWorld);
    for(const x of[bb.min.x,bb.max.x])for(const y of[bb.min.y,bb.max.y])for(const z of[bb.min.z,bb.max.z])_b.expandByPoint(_v.set(x,y,z).applyMatrix4(_m))});
  if(_b.isEmpty())return null;
  const mn=_b.min.toArray(),mx=_b.max.toArray(),ext=mn.map((a,i)=>Math.max(Math.abs(a),Math.abs(mx[i]))),ax=ext.indexOf(Math.max(...ext)),sg=Math.abs(mx[ax])>=Math.abs(mn[ax])?1:-1,L=ext[ax];
  const ctr=_b.getCenter(new T.Vector3()),tip=ctr.clone();tip.setComponent(ax,sg*L);
  const base=tip.clone();base.setComponent(ax,sg*L*.38);                       // the sweep covers the outer 62% of the weapon
  return{tip,base,len:L}}

// ribbon layers. rows = [fraction from tip towards base (negative = beyond the tip), alpha, colour index (0 white-hot, 1 blade colour, 2 hot blend, 3 hue-shifted fringe)]; gain > 1 = HDR for bloom
const LAYERS=[
  {w:1.7,o:5,map:auraTex,gain:.7,a:.42,rep:1,rows:[[-.3,1,2],[1.35,1,2]]},                    // soft halo
  {w:1,o:6,map:strk[0],gain:1.5,a:.95,rep:1.6,flow:.5,rows:[[-.02,1,3],[1.3,1,3]]},           // fringe shards (pink)
  {w:1,o:7,map:strk[1],gain:2,a:1,rep:1.3,flow:.8,rows:[[-.02,1,1],[.85,1,1]]},               // body shards (blade colour)
  {w:1,o:8,map:strk[2],gain:2.6,a:1,rep:1.1,flow:1,rows:[[-.02,1,2],[.5,1,2]]},               // hot core
  {w:1,o:9,map:edgeTex,gain:3.4,a:1,rep:1,rows:[[-.06,1,0],[.07,1,0]]}];                      // crisp white rim

export class BladeTrail{
  constructor(root){
    this.root=root;this.node=null;this.tipL=new T.Vector3();this.baseL=new T.Vector3();this.s=[];this.clk=0;
    this.col=new T.Color('#fff3c4');this.core=new T.Color('#ffffff');this.hot=new T.Color('#ffffff');this.acc=new T.Color('#ffc0f0');this.inv=new T.Matrix4();
    this.wM=1;this.aM=1;this.W=new Float32Array(MAXK*7);
    this.L=LAYERS.map(Ly=>{const g=new T.BufferGeometry(),pos=new Float32Array(MAXK*2*3),col=new Float32Array(MAXK*2*4),uv=new Float32Array(MAXK*2*2),idx=[];
      for(let i=0;i<MAXK-1;i++){const a=i*2,b=(i+1)*2;idx.push(a,b,a+1,a+1,b,b+1)}
      g.setAttribute('position',new T.BufferAttribute(pos,3));g.setAttribute('color',new T.BufferAttribute(col,4));g.setAttribute('uv',new T.BufferAttribute(uv,2));g.setIndex(idx);g.setDrawRange(0,0);
      const m=new T.Mesh(g,new T.MeshBasicMaterial({map:Ly.map,vertexColors:true,transparent:true,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide}));m.frustumCulled=false;m.renderOrder=Ly.o;root.add(m);
      return{...Ly,g,pos,col,uv,m}});
  }
  clear(){this.node=null;this.s.length=0;this.L.forEach(Ly=>Ly.g.setDrawRange(0,0))}
  setBlade(node,color,core='#ffffff',opt={}){const sp=span(node);if(!sp){this.clear();return}this.node=node;this.tipL.copy(sp.tip);this.baseL.copy(sp.base);this.col.set(color);this.core.set(core);
    this.hot.copy(this.col).lerp(WHITE,.6);accent(this.col,this.acc);this.wM=opt.w??1;this.aM=opt.a??1;this.s.length=0}
  update(dt,active){
    if(!this.node)return;
    const root=this.root,S=this.s,clk=this.clk+=dt;
    if(active||S.length){root.updateWorldMatrix(true,true);this.inv.copy(root.matrixWorld).invert()}
    // ---- sample the blade this frame
    if(active){const t=this.node.localToWorld(this.tipL.clone()),b=this.node.localToWorld(this.baseL.clone());S.push({t,b,age:0});if(S.length>N)S.shift()}
    // ---- age + smooth the samples into a dense curve
    for(const s of S)s.age+=dt;while(S.length&&S[0].age>LIFE)S.shift();
    const n=S.length,Wp=this.W;let K=0;
    const put=(p0,p1,p2,p3,f)=>{const o=K*7;
      Wp[o]=cr(p0.t.x,p1.t.x,p2.t.x,p3.t.x,f);Wp[o+1]=cr(p0.t.y,p1.t.y,p2.t.y,p3.t.y,f);Wp[o+2]=cr(p0.t.z,p1.t.z,p2.t.z,p3.t.z,f);
      Wp[o+3]=cr(p0.b.x,p1.b.x,p2.b.x,p3.b.x,f);Wp[o+4]=cr(p0.b.y,p1.b.y,p2.b.y,p3.b.y,f);Wp[o+5]=cr(p0.b.z,p1.b.z,p2.b.z,p3.b.z,f);
      Wp[o+6]=p1.age+(p2.age-p1.age)*f;K++};
    if(n>1){for(let i=0;i<n-1;i++){const p0=S[Math.max(i-1,0)],p1=S[i],p2=S[i+1],p3=S[Math.min(i+2,n-1)];for(let k=0;k<SUB;k++)put(p0,p1,p2,p3,k/SUB)}
      put(S[n-2],S[n-1],S[n-1],S[n-1],0)}
    // ---- rebuild the ribbon layers: pointed at both ends, alpha + width fade with age, the shard streaks scroll along the swing
    const cols=[this.core,this.col,this.hot,this.acc];
    for(const Ly of this.L){const P=Ly.pos,C=Ly.col,UV=Ly.uv,sc=Ly.flow?-clk*1.7*Ly.flow:0;
      for(let i=0;i<K;i++){const o=i*7,fade=Math.max(0,1-Wp[o+6]/LIFE),a=Math.pow(fade,1.2),u=i/Math.max(1,K-1),tw=Math.min(1,u*2.4),hw=.5+.5*Math.min(1,(1-u)*10),
          w=Ly.w*this.wM*(.16+.84*fade)*(.25+.75*tw)*hw;
        const tx=Wp[o],ty=Wp[o+1],tz=Wp[o+2],dx=Wp[o+3]-tx,dy=Wp[o+4]-ty,dz=Wp[o+5]-tz;
        for(let r=0;r<2;r++){const row=Ly.rows[r],f=row[0]*w,q=i*2+r,c=cols[row[2]];
          _v.set(tx+dx*f,ty+dy*f,tz+dz*f).applyMatrix4(this.inv);P[q*3]=_v.x;P[q*3+1]=_v.y;P[q*3+2]=_v.z;
          C[q*4]=c.r*Ly.gain;C[q*4+1]=c.g*Ly.gain;C[q*4+2]=c.b*Ly.gain;C[q*4+3]=row[1]*a*tw*this.aM*Ly.a;
          UV[q*2]=u*Ly.rep+sc;UV[q*2+1]=r===0?1:0}}
      Ly.g.setDrawRange(0,K>1?(K-1)*6:0);Ly.g.attributes.position.needsUpdate=true;Ly.g.attributes.color.needsUpdate=true;Ly.g.attributes.uv.needsUpdate=true}}
}
BladeTrail.ground=null;   // kept for compatibility, no longer used (the trail has no particles)