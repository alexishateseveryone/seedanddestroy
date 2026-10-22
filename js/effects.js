// Gun + melee effects.
//  GUNFIRE: per-weapon muzzle blast (multi-plane flash, hot sparks that cool white -> orange, falling embers, powder flecks, gas ring, smoke, rising wisps, brass),
//           tiny tracer rounds with long thin trail lines for the fast guns, and for the sniper a supersonic aftershock (shock rings along the path,
//           a long lingering line + smoke tube, ground blast at the muzzle, heavy impact).
//  MELEE:   slashHit() = crossed cut lines (an X for dual blades), directional spark spray, shock ring, flash and debris.
import * as T from 'three';
const cv=(w,h,draw)=>{const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t};
const glowTex=cv(64,64,(g)=>{const r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.35,'rgba(255,255,255,.55)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,64,64)});
const ringTex=cv(64,64,(g)=>{const r=g.createRadialGradient(32,32,18,32,32,31);r.addColorStop(0,'rgba(255,255,255,0)');r.addColorStop(.6,'rgba(255,255,255,.95)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,64,64)});
const flashTex=cv(256,128,(g,w,h)=>{g.clearRect(0,0,w,h);
  const cone=g.createLinearGradient(20,0,w,0);cone.addColorStop(0,'rgba(255,255,255,1)');cone.addColorStop(.25,'rgba(255,230,150,.95)');cone.addColorStop(.7,'rgba(255,140,40,.55)');cone.addColorStop(1,'rgba(255,90,0,0)');
  g.fillStyle=cone;g.beginPath();g.moveTo(20,h/2-18);g.quadraticCurveTo(110,h/2-14,w,h/2-1);g.lineTo(w,h/2+1);g.quadraticCurveTo(110,h/2+14,20,h/2+18);g.closePath();g.fill();
  [[1,.38],[-1,.38]].forEach(([s,k])=>{g.fillStyle='rgba(255,210,120,.8)';g.beginPath();g.moveTo(30,h/2);g.quadraticCurveTo(70,h/2+s*50*k*2,120,h/2+s*58);g.quadraticCurveTo(80,h/2+s*14,30,h/2);g.fill()});
  const core=g.createRadialGradient(34,h/2,0,34,h/2,38);core.addColorStop(0,'rgba(255,255,255,1)');core.addColorStop(1,'rgba(255,200,90,0)');g.fillStyle=core;g.fillRect(0,0,100,h)});
const tailTex=cv(16,64,(g,w,h)=>{const r=g.createLinearGradient(0,0,0,h);r.addColorStop(0,'rgba(255,255,255,0)');r.addColorStop(.7,'rgba(255,255,255,.55)');r.addColorStop(1,'rgba(255,255,255,1)');g.fillStyle=r;g.fillRect(0,0,w,h)});
const lineTex=cv(256,16,(g,w,h)=>{const r=g.createLinearGradient(0,0,w,0);r.addColorStop(0,'rgba(255,255,255,0)');r.addColorStop(.35,'rgba(255,255,255,.7)');r.addColorStop(.5,'rgba(255,255,255,1)');r.addColorStop(.65,'rgba(255,255,255,.7)');r.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=r;g.beginPath();g.moveTo(0,h/2);g.quadraticCurveTo(w/2,0,w,h/2);g.quadraticCurveTo(w/2,h,0,h/2);g.fill()});

// soft cloudy dust puffs: one big feathered blob + a few overlapping smaller ones, white so the material colour tints them
const dustTex=[0,1,2].map(()=>cv(128,128,(g,w,h)=>{const blob=(x,y,r,a)=>{const q=g.createRadialGradient(x,y,0,x,y,r);q.addColorStop(0,`rgba(255,255,255,${a})`);q.addColorStop(.45,`rgba(255,255,255,${a*.55})`);q.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=q;g.fillRect(0,0,w,h)};
  blob(64,64,62,.5);for(let j=0;j<6;j++){const a=Math.random()*6.283,d=10+Math.random()*16;blob(64+Math.cos(a)*d,64+Math.sin(a)*d,24+Math.random()*14,.32)}}));
const dm={},DM=(c,i)=>{const k=c+i;return dm[k]||(dm[k]=new T.SpriteMaterial({map:dustTex[i],color:c,depthWrite:false,transparent:true,opacity:1}))};
// lumpy cauliflower puffs for flame + smoke: many overlapping soft blobs give a ragged, billowing edge (white, tinted per particle)
const lump=(n,spread,r0,r1)=>cv(128,128,(g,w,h)=>{for(let j=0;j<n;j++){const a=Math.random()*6.283,d=Math.pow(Math.random(),.65)*spread,x=64+Math.cos(a)*d,y=64+Math.sin(a)*d,r=r0+Math.random()*(r1-r0),q=g.createRadialGradient(x,y,0,x,y,r);q.addColorStop(0,'rgba(255,255,255,.5)');q.addColorStop(.55,'rgba(255,255,255,.26)');q.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=q;g.beginPath();g.arc(x,y,r,0,6.283);g.fill()}
  g.globalCompositeOperation='destination-in';const m=g.createRadialGradient(64,64,30,64,64,63);m.addColorStop(0,'rgba(0,0,0,1)');m.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=m;g.fillRect(0,0,w,h)});
const lumpTex=[0,1,2,3].map(()=>lump(46,30,9,24));
const fm={},FM=(add,c,i)=>{const k=(add?'a':'n')+c+i;return fm[k]||(fm[k]=new T.SpriteMaterial({map:lumpTex[i],color:c,blending:add?T.AdditiveBlending:T.NormalBlending,depthWrite:false,transparent:true}))};
// hit-spark pieces: a jagged pale starburst core (long axis along +x), thin sharp spikes (pivot at the left edge, pointing right) and a round drop mesh
const starTex=[0,1,2].map(()=>cv(128,128,g=>{const R=Math.random,n=16;g.fillStyle='#fff';g.translate(64,64);g.beginPath();
  for(let i=0;i<n*2;i++){const a=i/(n*2)*6.283+R()*.12,r=i%2?12+R()*8:24+R()*22,x=Math.cos(a)*r*1.3,y=Math.sin(a)*r*.82;i?g.lineTo(x,y):g.moveTo(x,y)}g.closePath();g.fill()}));
const spikeTex=[4,6].map(w=>cv(128,16,g=>{g.fillStyle='#fff';g.beginPath();g.moveTo(0,8-w);g.lineTo(127,8);g.lineTo(0,8+w);g.closePath();g.fill()}));
const stm={},STM=(c,i)=>{const k=c+i;return stm[k]||(stm[k]=new T.SpriteMaterial({map:starTex[i],color:c,depthWrite:false,transparent:true}))},
  skm={},SKM=(c,i)=>{const k=c+i;return skm[k]||(skm[k]=new T.SpriteMaterial({map:spikeTex[i],color:c,depthWrite:false,transparent:true}))},
  dropG=new T.SphereGeometry(1,10,8);
const sc={},ac={},gm={},
  SA=(c,tx=glowTex)=>{const k=c+tx.uuid;return sc[k]||(sc[k]=new T.SpriteMaterial({map:tx,color:c,blending:T.AdditiveBlending,depthWrite:false,transparent:true}))},
  SN=(c,o=.55)=>{const k='n'+c+o;return sc[k]||(sc[k]=new T.SpriteMaterial({map:glowTex,color:c,depthWrite:false,transparent:true,opacity:o}))},
  BA=c=>ac[c]||(ac[c]=new T.MeshBasicMaterial({color:c,blending:T.AdditiveBlending,depthWrite:false,transparent:true})),
  GM=c=>gm[c]||(gm[c]=new T.MeshBasicMaterial({color:c}));
const ball=new T.SphereGeometry(1,8,6),shell=new T.CylinderGeometry(.025,.025,.1,6),streakG=new T.BoxGeometry(.016,.016,1),chip=new T.BoxGeometry(1,1,1),
  flashG=new T.PlaneGeometry(1.5,.62),ringG=new T.RingGeometry(.86,1,40),lineG=new T.PlaneGeometry(1,.12),
  rnd=(a,b)=>a+Math.random()*(b-a),Z=new T.Vector3(0,0,1),_v=new T.Vector3(),tailGeo={};
const tailG=(L,w)=>tailGeo[L+'|'+w]||(tailGeo[L+'|'+w]=new T.PlaneGeometry(w,L).rotateX(-Math.PI/2).translate(0,0,-L/2));

// per-weapon look, worked out from the weapon's stats (speed >= 30 = fast needle rounds, after = sniper-style aftershock, pellets > 1 = shotgun)
const prof=st=>{const sp=(st&&st.speed)||20,after=!!(st&&st.after),fast=sp>=30,pel=(st&&st.pellets)||1,kick=(st&&st.kick)||1;
  if(after)return{size:2.4,fire:1.6,sparks:2,smoke:2,cone:.13,fast:true,after:true};
  if(fast)return{size:1,fire:1,sparks:1.1,smoke:.9,cone:.2,fast:true};
  if(pel>1)return{size:1.15,fire:1.2,sparks:1.3,smoke:1.1,cone:.45};
  return{size:.8+Math.min(.3,(kick-1)*.2),fire:.8,sparks:.8,smoke:.8,cone:.32}};

export function createFX(scene){
  let ground=null;
  const list=[],light=new T.PointLight('#ffb040',0,9,2);scene.add(light);let lt=0,ltMax=.09,ltI=4.5,sonicT=0;
  const add=(m,o)=>{scene.add(m);const q=Object.assign({m,vx:0,vy:0,vz:0,g:0,life:.4,s0:1,grow:0,spin:0,drag:0,delay:0,st:0,w:1,fade:0},o);q.max=q.life;if(q.delay>0)m.visible=false;if(q.fade){m.material=m.material.clone();m.material.opacity=q.fade}list.push(q);return q};
  const sprite=(mat,p,o)=>{const s=new T.Sprite(mat);s.position.copy(p);return add(s,o)};
  const dot=(p,c,s,v,o)=>{const m=new T.Mesh(ball,GM(c));m.position.copy(p);add(m,Object.assign({s0:s,vx:rnd(-v,v),vy:rnd(0,v),vz:rnd(-v,v),g:9,life:rnd(.2,.4)},o))};
  const streak=(p,c,vx,vy,vz,o)=>{const m=new T.Mesh(streakG,BA(c));m.position.copy(p);add(m,Object.assign({vx,vy,vz,st:1,len:.28,s0:1,life:rnd(.14,.3),g:7},o))};
  const smoke=(p,vx,vy,vz,o)=>sprite(SN('#c9c9c9',.5),p,Object.assign({s0:.22,grow:3.2,vx,vy,vz,drag:2.2,life:rnd(.5,.9)},o));
  const ring=(p,c,s,grow,life)=>sprite(SA(c,ringTex),p,{s0:s,grow,life});
  // a ring standing perpendicular to a direction (shock / supersonic crack ring)
  const diskRing=(p,dir,c,s0,grow,life,op=.7)=>{const m=new T.Mesh(ringG,new T.MeshBasicMaterial({color:c,blending:T.AdditiveBlending,depthWrite:false,transparent:true,side:T.DoubleSide}));
    m.position.copy(p);m.quaternion.setFromUnitVectors(Z,dir);add(m,{s0,grow,life,fade:op,ringFade:1})};
  const crowd=()=>list.length>420?.4:1;
  // one smooth dust puff: eased fade in/out (soft), ease-out growth, drag, slow buoyant rise, lazy spin
  const puffDust=(x,y,z,vx,vy,vz,s0,grow,life,op=.4)=>{const m=new T.Sprite(DM(Math.random()<.5?'#d6caa8':'#bfb292',(Math.random()*3)|0));m.position.set(x,y,z);
    const q=add(m,{s0,grow,vx,vy,vz,drag:3.2,g:-.4,life,fade:op,soft:1,spin:rnd(-.9,.9)});m.material.rotation=rnd(0,6.283);return q};
  let trailT=0;
  const sm=t=>t<=0?0:t>=1?1:t*t*(3-2*t);   // smoothstep
  // ---- flame + smoke puffs: lumpy sprites that billow out, slow down fast, and change colour with age (heat = [young, mid, old])
  const HOT=['#fffdf0','#ffc24a','#9a4512'].map(c=>new T.Color(c)),ORANGE=['#ffd27a','#ff7a1a','#5e2a0c'].map(c=>new T.Color(c)),
    SMOKE=['#4d3e30','#6c655d','#8c8984'].map(c=>new T.Color(c)),SMOKE2=['#7a756f','#9a9894','#b4b3b0'].map(c=>new T.Color(c));
  const lumpP=(addv,x,y,z,vx,vy,vz,s0,grow,life,op,heat,o)=>{const m=new T.Sprite(FM(addv,'#ffffff',(Math.random()*4)|0));m.position.set(x,y,z);
    const q=add(m,Object.assign({s0,grow,vx,vy,vz,drag:addv?4.5:3,g:addv?-.3:-.45,life,fade:op,soft:1,heat,spin:rnd(-1.2,1.2)},o));m.material.rotation=rnd(0,6.283);m.material.color.copy(heat[0]);return q};
  const fireP=(x,y,z,vx,vy,vz,s0,grow,life,op,heat)=>lumpP(true,x,y,z,vx,vy,vz,s0,grow,life,op,heat),
    smokeP=(x,y,z,vx,vy,vz,s0,grow,life,op,heat,delay=0)=>lumpP(false,x,y,z,vx,vy,vz,s0,grow,life,op,heat,{delay});
  // ---- smoke ribbons behind fast bullets: one flat-coloured strip per bullet that wobbles, widens and fades out along its length
  const RMAX=160,RSTEP=.3,ribbons=[],rbOf=new WeakMap();let clk=0;
  const ribMat=new T.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,side:T.DoubleSide});
  const mkRibbon=big=>{const g=new T.BufferGeometry(),V=RMAX*4,pos=new Float32Array(V*3),clr=new Float32Array(V*4),idx=new Uint16Array(RMAX*12);
    g.setAttribute('position',new T.BufferAttribute(pos,3).setUsage(T.DynamicDrawUsage));g.setAttribute('color',new T.BufferAttribute(clr,4).setUsage(T.DynamicDrawUsage));g.setIndex(new T.BufferAttribute(idx,1).setUsage(T.DynamicDrawUsage));g.setDrawRange(0,0);
    const m=new T.Mesh(g,ribMat);m.frustumCulled=false;scene.add(m);const c=new T.Color(big?'#dfe7f0':'#e6e2da');
    return{m,g,pos,clr,idx,pts:[],lx:0,ly:0,lz:0,has:false,d:0,cr:c.r,cg:c.g,cb:c.b,life:big?1.5:.85,w0:big?.07:.04,w1:big?.62:.34,amp:big?.4:.24,ph:Math.random()*6.283,touched:clk}};
  const feedRibbon=(r,p,dx,dy,dz,dt)=>{
    const push=(x,y,z,t)=>{r.pts.push({x,y,z,dx,dy,dz,t,d:r.d});if(r.pts.length>RMAX)r.pts.shift()};
    if(!r.has){r.has=true;r.lx=p.x;r.ly=p.y;r.lz=p.z;push(p.x,p.y,p.z,clk);return}
    const ex=p.x-r.lx,ey=p.y-r.ly,ez=p.z-r.lz,dist=Math.hypot(ex,ey,ez),n=Math.floor(dist/RSTEP);
    for(let i=1;i<=n;i++){const fr=i*RSTEP/dist;r.d+=RSTEP;push(r.lx+ex*fr,r.ly+ey*fr,r.lz+ez*fr,clk-dt*(1-fr))}
    if(n){const fr=n*RSTEP/dist;r.lx+=ex*fr;r.ly+=ey*fr;r.lz+=ez*fr}};
  const updRibbons=dt=>{clk+=dt;
    for(let ri=ribbons.length-1;ri>=0;ri--){const r=ribbons[ri],pts=r.pts;
      while(pts.length&&clk-pts[0].t>r.life)pts.shift();
      const n=pts.length;
      if(!n&&clk-r.touched>.2){scene.remove(r.m);r.g.dispose();ribbons.splice(ri,1);continue}
      if(n<2){r.g.setDrawRange(0,0);continue}
      const pos=r.pos,clr=r.clr,idx=r.idx;
      for(let i=0;i<n;i++){const q=pts[i],a=Math.min(1,(clk-q.t)/r.life),e=1-(1-a)*(1-a),w=r.w0+(r.w1-r.w0)*e,
          al=.5*Math.pow(1-a,1.5)*Math.min(1,.3+a*40),
          ph=q.d*1.9+clk*3.3+r.ph,ox=(Math.sin(ph)+.5*Math.sin(ph*2.3+1.7))*r.amp*e,oy=(Math.sin(ph*1.3+2.1)+.5*Math.sin(ph*2.9))*r.amp*.6*e+a*.3,
          hl=Math.hypot(q.dx,q.dz)||1,hx=-q.dz/hl,hz=q.dx/hl,cx=q.x+hx*ox,cy=q.y+oy,cz=q.z+hz*ox;
        let o=2*i*3;pos[o]=cx-hx*w;pos[o+1]=cy;pos[o+2]=cz-hz*w;pos[o+3]=cx+hx*w;pos[o+4]=cy;pos[o+5]=cz+hz*w;   // flat strip
        o=(2*RMAX+2*i)*3;pos[o]=cx;pos[o+1]=cy-w*.8;pos[o+2]=cz;pos[o+3]=cx;pos[o+4]=cy+w*.8;pos[o+5]=cz;            // upright strip
        for(let s=0;s<2;s++)for(let j=0;j<2;j++){const c=(s*2*RMAX+2*i+j)*4;clr[c]=r.cr;clr[c+1]=r.cg;clr[c+2]=r.cb;clr[c+3]=al}}
      let c=0;for(let s=0;s<2;s++){const b=s*2*RMAX;for(let i=0;i<n-1;i++){const a0=b+2*i;idx[c++]=a0;idx[c++]=a0+1;idx[c++]=a0+2;idx[c++]=a0+1;idx[c++]=a0+3;idx[c++]=a0+2}}
      r.g.setDrawRange(0,c);r.g.index.needsUpdate=true;r.g.attributes.position.needsUpdate=true;r.g.attributes.color.needsUpdate=true}};
  return{
    setGround(fn){ground=fn},
    // ================================================================= shot
    // st = the weapon's stats (speed / after / pellets / kick ...), gy = ground height; enemies call it with neither
    muzzle(p,a,st,gy){const P=prof(st),S=P.size,k=crowd(),sq=Math.sqrt(S),dx=Math.sin(a),dz=Math.cos(a),f=new T.Vector3(p.x+dx*.1,p.y,p.z+dz*.1),ground=(gy??p.y-1)+.12,
        dir=sp=>{const g=a+rnd(-sp,sp);return[Math.sin(g),Math.cos(g)]};
      // 1) fireball: a white-hot flash, then billowing lumpy flame puffs (hot ones start white, outer ones orange) that cool to brown as they fade
      fireP(f.x+dx*.15*S,f.y,f.z+dz*.15*S,dx*.6,.1,dz*.6,1.05*S,.9,.075,.95,HOT);
      for(let i=0,n=Math.round(12*P.fire*k);i<n;i++){const[vx,vz]=dir(P.cone*1.4),v=rnd(1.5,6.5)*sq,o=rnd(0,.55)*S;
        fireP(f.x+dx*o,f.y+rnd(-.06,.14),f.z+dz*o,vx*v,rnd(-.2,1.2),vz*v,rnd(.3,.5)*S,rnd(1.1,1.9),rnd(.15,.27),.85,i%5<2?HOT:ORANGE)}
      // 2) fine speckle spray (orange + dark flecks) and a few glinting sparks
      for(let i=0,n=Math.round(30*P.sparks*k);i<n;i++){const[vx,vz]=dir(P.cone*2.6),v=rnd(5,20)*sq;
        dot(f,i%3?'#ff9a40':'#34261a',rnd(.012,.026)*sq,0,{vx:vx*v,vy:rnd(-.6,3),vz:vz*v,g:9,drag:1.6,life:rnd(.18,.42)})}
      for(let i=0,n=Math.round(7*P.sparks*k);i<n;i++){const[vx,vz]=dir(P.cone*1.8),v=rnd(8,24);
        streak(f,i%2?'#ffb040':'#fff0c0',vx*v,rnd(-.4,2),vz*v,{len:rnd(.2,.5)*S,g:7,life:rnd(.1,.22),drag:2.4})}
      // 3) embers that fall and bounce
      for(let i=0,n=Math.round(5*P.sparks*k);i<n;i++){const[vx,vz]=dir(.8),v=rnd(1.5,6);sprite(SA(i%3?'#ff9a40':'#ffd070'),f,{s0:rnd(.05,.09),vx:vx*v,vy:rnd(.5,3),vz:vz*v,g:9,drag:1.4,life:rnd(.4,.9),bounce:1,keep:1})}
      // 4) smoke: dark brown billow right behind the flame, then paler wisps that rise and linger
      for(let i=0,n=Math.round(5*P.smoke*k);i<n;i++){const[vx,vz]=dir(P.cone*1.3),v=rnd(1,3.5),o=rnd(.1,.6)*S;
        smokeP(f.x+dx*o,f.y+rnd(0,.1),f.z+dz*o,vx*v,rnd(.3,1),vz*v,rnd(.28,.42)*S,rnd(2,3),rnd(.6,1),.42,SMOKE,.03+i*.012)}
      for(let i=0,n=Math.round(3*P.smoke*k);i<n;i++)smokeP(f.x,f.y,f.z,dx*.3+rnd(-.2,.2),rnd(.7,1.4),dz*.3+rnd(-.2,.2),.2*S,3.5,rnd(1.1,1.7),.26,SMOKE2,.1+i*.07);
      // 5) ejected brass
      const c=new T.Mesh(shell,GM('#e6c25a'));c.position.copy(p);add(c,{s0:1,vx:dz*rnd(2,3.2)+rnd(-.3,.3),vy:rnd(2.8,4),vz:-dx*rnd(2,3.2)+rnd(-.3,.3),g:16,spin:20,life:1.1,bounce:1,keep:1});
      if(P.after)for(let i=0;i<14;i++){const ang=i/14*6.283+rnd(-.2,.2),sp=rnd(3,6);puffDust(p.x,ground+.1,p.z,Math.cos(ang)*sp,rnd(.1,.5),Math.sin(ang)*sp,rnd(.3,.45),rnd(1.8,2.6),rnd(.6,1),.38)}   // low rolling dust cloud
      light.position.copy(f);ltMax=.09+S*.02;ltI=3+S*1.6;lt=ltMax},
    // ================================================================= bullet in flight (sp = its speed: >= 30 gives the slim needle round)
    bullet(col='#ffe066',sp=20){const g=new T.Group(),fast=typeof sp==='number'&&sp>=30;
      if(!fast){
        const core=new T.Mesh(new T.CapsuleGeometry(.05,.34,3,8),GM('#ffffff'));core.rotation.x=Math.PI/2;g.add(core);
        const t1=new T.Mesh(tailG(1.9,.16),new T.MeshBasicMaterial({map:tailTex,color:col,blending:T.AdditiveBlending,depthWrite:false,transparent:true,side:T.DoubleSide})),t2=t1.clone();t2.rotation.z=Math.PI/2;g.add(t1,t2);
        const glow=new T.Sprite(SA(col));glow.scale.set(.75,.75,1);g.add(glow);return g}
      const big=sp>=60,tail=Math.min(8,1.6+sp*.05),lw=.03+(big?.012:0),core=new T.Mesh(new T.CapsuleGeometry(.022+(big?.006:0),.2+(big?.3:0),3,6),GM('#ffffff'));core.rotation.x=Math.PI/2;g.add(core);
      const mk=(w,op,c)=>{const m=new T.Mesh(tailG(tail,w),new T.MeshBasicMaterial({map:tailTex,color:c,blending:T.AdditiveBlending,depthWrite:false,transparent:true,side:T.DoubleSide,opacity:op})),m2=m.clone();m2.rotation.z=Math.PI/2;g.add(m,m2)};
      mk(lw,1,'#ffffff');mk(lw*3.2,.4,col);
      const glow=new T.Sprite(SA(col));glow.scale.setScalar(big?.42:.3);g.add(glow);return g},
    // called every frame per bullet. Slow rounds: glow + a little smoke. Fast rounds (o.fast): a flat-colour smoke ribbon that wobbles, widens and fades out
    trail(p,vx=0,vz=0,col='#ffd54a',o){
      if(!o||!o.fast){if(Math.random()<.7)sprite(SA(col),p,{life:.13,s0:.28});if(Math.random()<.35)smoke(p,rnd(-.3,.3),rnd(.1,.5),rnd(-.3,.3),{s0:.1,grow:3,life:rnd(.35,.6)});return}
      let r=rbOf.get(p);if(!r){r=mkRibbon(!!o.after);rbOf.set(p,r);ribbons.push(r)}
      const vy=o.vy||0,l3=Math.hypot(vx,vy,vz)||1;r.touched=clk;feedRibbon(r,p,vx/l3,vy/l3,vz/l3,o.dt||.016)},
    // ================================================================= hit spark (bullet or melee hits an enemy)
    // vx,vz = the hit direction, pw = power (bigger for kills / heavy hits), ang0 = screen angle of the burst's long axis (random if left out).
    // Drawn in the plane facing the camera (which looks along the hit direction): a jagged pale core pops open, fine red / orange / yellow spikes shoot out
    // (denser along the long axis), a few long thin yellow lines streak away, and little glowing sparks fly off.
    splat(p,vx=0,vz=0,pw=1,ang0){const l=Math.hypot(vx,vz),dx=l?vx/l:0,dz=l?vz/l:1,c=crowd(),bx=p.x-dx*.35,by=p.y+.1,bz=p.z-dz*.35,at=new T.Vector3(bx,by,bz),Rx=-dz,Rz=dx,floor=p.y-.85,axis=ang0??rnd(0,3.1416);
      const drop=(x,y,z,ang,sp,col,r,life)=>{const m=new T.Mesh(dropG,GM(col)),f=rnd(.2,1.1),ca=Math.cos(ang),sa=Math.sin(ang);m.position.set(x,y,z);
        const q=add(m,{s0:r,vx:Rx*ca*sp+dx*sp*f*.5,vy:sa*sp+rnd(0,2),vz:Rz*ca*sp+dz*sp*f*.5,g:13,drag:.5,life,drop:1,floor}),gl=new T.Sprite(SA(col));gl.scale.setScalar(4);m.add(gl);return q};
      const mkS=(tx,col,ti,order,o)=>{const m=new T.Sprite(tx(col,ti));m.position.set(bx,by,bz);m.scale.setScalar(.001);const q=add(m,Object.assign({vx:0,vy:0,vz:0,g:0,drag:0,s0:1,fade:1},o));m.material.depthTest=false;m.renderOrder=order;return q};
      // core: springy pop, then it shrinks and fades
      const core=(S,col,order,life)=>{const q=mkS(STM,col,(Math.random()*3)|0,order,{life,
          anim:(q,a)=>{const s=1-Math.exp(-a*14)*Math.cos(a*28),sz=Math.max(S*s*(1-.45*sm((a-.25)/.75)),.001);q.m.scale.set(sz,sz,1);q.m.material.opacity=1-sm((a-.35)/.65)}});q.m.material.rotation=axis;return q};
      // short spike: shoots out fast, then thins and fades
      const spike=(ang,L,W,col,order)=>{const q=mkS(SKM,col,(Math.random()*2)|0,order,{L,W,life:.42,
          anim:(q,a)=>{const e=1-Math.pow(1-Math.min(1,a/.2),3);q.m.scale.set(Math.max(q.L*e*(1-.4*sm((a-.4)/.6)),.001),Math.max(q.W*(1-.8*sm((a-.3)/.7)),.001),1);q.m.material.opacity=1-sm((a-.5)/.5)}});
        q.m.center.set(0,.5);q.m.material.rotation=ang;return q};
      // long thin line: the head races out, the tail follows, so it reads as a streak flying away from the hit
      const line=(ang,Lm,W,col,order)=>{const ca=Math.cos(ang),sa=Math.sin(ang),q=mkS(SKM,col,1,order,{life:.36,
          anim:(q,a)=>{const head=Lm*(1-Math.pow(1-Math.min(1,a/.3),3)),tail=Lm*.85*(1-Math.pow(1-Math.max(0,Math.min(1,(a-.08)/.6)),2));
            q.m.position.set(bx+Rx*ca*tail,by+sa*tail,bz+Rz*ca*tail);q.m.scale.set(Math.max(head-tail,.001),W,1);q.m.material.opacity=1-sm((a-.7)/.3)}});
        q.m.center.set(0,.5);q.m.material.rotation=ang;return q};
      const along=()=>axis+(Math.random()<.5?0:Math.PI)+rnd(-.6,.6);   // an angle near the long axis (either end)
      // glow (additive) + a white pop
      sprite(SA('#ff9a30'),at,{life:.24,s0:1.9*pw,grow:.5});sprite(SA('#ffffff'),at,{life:.08,s0:.9*pw});
      for(let i=0,n=Math.round(6*c);i<n;i++)line(Math.random()<.7?along():rnd(0,6.283),rnd(1.4,2.6)*pw,rnd(.04,.07),i%3?'#ffd84a':'#ffffff',1);
      for(let i=0,n=Math.round(38*c);i<n;i++){const on=Math.random()<.65,r=Math.random(),k=r<.35?0:r<.75?1:2;
        spike(on?along():rnd(0,6.283),(.28+Math.random()*.42)*(on?1.35:1)*pw,rnd(.05,.09),['#e5392b','#ff7a2a','#ffb52e'][k],2+k)}
      core(.62*pw,'#f1f1f1',5,.4);core(.34*pw,'#ffffff',6,.28);
      for(let i=0,n=Math.round(9*c);i<n;i++)drop(bx,by,bz,rnd(0,6.283),rnd(4,10),['#ffd84a','#ff8a24','#ffffff'][i%3],rnd(.025,.05),rnd(.3,.5))},
    // ================================================================= impacts
    hit(p,c='#ffe066',n=6){
      for(let i=0;i<n*2;i++){const a=rnd(0,6.283),sp=rnd(3,9);streak(p,i%2?c:'#fff3c0',Math.cos(a)*sp,rnd(1,6),Math.sin(a)*sp,{len:rnd(.14,.32),g:12,life:rnd(.15,.32)})}
      for(let i=0;i<Math.ceil(n/2);i++){const m=new T.Mesh(chip,GM(c));m.position.copy(p);add(m,{s0:rnd(.03,.06),vx:rnd(-3,3),vy:rnd(1,4),vz:rnd(-3,3),g:14,spin:rnd(8,20),life:rnd(.3,.5),bounce:1})}
      sprite(SA('#fff3b0'),p,{life:.1,s0:.9});ring(p,c,.25,5,.16);smoke(p,0,.4,0,{s0:.15,life:.45})},
    // weapon-aware bullet impact (flesh = hit a creature)
    impact(p,st,c='#ffe066',flesh=false){const P=prof(st);
      if(P.after){this.hit(p,c,16);this.shock(p,'#ffe9b8');sprite(SA('#ffffff'),p,{life:.14,s0:1.8});if(!flesh)this.dust(p)}
      else if(P.fast)this.hit(p,c,10);else this.hit(p,c,flesh?8:6)},
    dust(p,c='#bfae82'){for(let i=0;i<5;i++)sprite(SN(c,.55),p,{s0:rnd(.15,.26),grow:2.6,vx:rnd(-1.4,1.4),vy:rnd(.6,1.8),vz:rnd(-1.4,1.4),drag:2,life:rnd(.4,.7)});
      for(let i=0;i<6;i++){const a=rnd(0,6.283),sp=rnd(2,6);streak(p,'#e8dcb0',Math.cos(a)*sp,rnd(1,4),Math.sin(a)*sp,{len:.14,g:12,life:.25})}},
    shock(p,c='#ffe0a0'){ring(p,c,.7,11,.4);ring(p,'#ffffff',.4,7,.25);for(let i=0;i<14;i++){const a=i/14*6.283;sprite(SN('#bfae82',.6),p,{s0:rnd(.2,.32),grow:2.6,vx:Math.cos(a)*rnd(3,5),vy:rnd(.3,1),vz:Math.sin(a)*rnd(3,5),drag:2.4,life:rnd(.5,.8)});
        streak(p,'#e8dcb0',Math.cos(a)*rnd(5,9),rnd(1,4),Math.sin(a)*rnd(5,9),{len:.2,g:12,life:.3})}},
    puff(p,c,n=10){for(let i=0;i<n;i++)dot(p,c,rnd(.1,.2),4,{vy:rnd(1,4),life:rnd(.4,.7),grow:0});for(let i=0;i<5;i++)dot(p,'#ffffff',.06,5);
      sprite(SA(c),p,{life:.25,s0:1.8});ring(p,c,.4,6,.3)},
    // ================================================================= melee impact
    // d = swing side (+1 / -1), col = blade colour, pw = power (kills hit bigger): a slanted cut line + the hit-spark burst + flying sparks
    slashHit(p,yaw,d=1,col='#ffe8a8',pw=1){
      const sd=d>=0?1:-1,side=yaw+sd*Math.PI/2,cut=(ang,len,c,life,w=1)=>{const g=new T.Group();g.position.copy(p);g.rotation.y=ang-Math.PI/2;
        [0,1].forEach(v=>{const m=new T.Mesh(lineG,new T.MeshBasicMaterial({map:lineTex,color:c,blending:T.AdditiveBlending,depthWrite:false,transparent:true,side:T.DoubleSide}));m.scale.set(len,w,1);if(!v)m.rotation.x=-Math.PI/2;g.add(m)});add(g,{life,s0:1,grow:.5})};
      cut(side+.45,2.6*pw,'#ffffff',.17,1.2);cut(side+.45,3.4*pw,col,.24,2.4);
      this.splat(p,Math.sin(yaw),Math.cos(yaw),1.15*pw,sd>0?.55:Math.PI-.55);
      for(let i=0,n=Math.round(12*crowd());i<n;i++){const ang=side+(i%2?0:Math.PI)+rnd(-.55,.55),sp=rnd(5,15);   // sparks spray along the cut line, both ways
        streak(p,i%3?'#ffd84a':'#fff7d6',Math.sin(ang)*sp,rnd(-.5,3),Math.cos(ang)*sp,{len:rnd(.3,.65),w:1.4,g:10,life:rnd(.14,.3),drag:2})}
      for(let i=0;i<4;i++){const m=new T.Mesh(chip,GM(i%2?'#ffd9a0':col));m.position.copy(p);add(m,{s0:rnd(.03,.06),vx:rnd(-4,4),vy:rnd(1.5,4.5),vz:rnd(-4,4),g:14,spin:rnd(8,20),life:rnd(.3,.55),bounce:1})}},
    // ================================================================= tumble / dash dust (smooth soft puffs)
    // start of a tumble: dust kicked up behind and to the sides
    dash(p,dx,dz){const k=crowd(),sx=-dz,sz=dx;
      for(let i=0,n=Math.round(9*k);i<n;i++){const b=rnd(.8,3.2),sd=rnd(-1.7,1.7);
        puffDust(p.x-dx*rnd(0,.3)+sx*rnd(-.2,.2),p.y+.22,p.z-dz*rnd(0,.3)+sz*rnd(-.2,.2),-dx*b+sx*sd,rnd(.25,.9),-dz*b+sz*sd,rnd(.3,.44),rnd(1.5,2.3),rnd(.55,.85),.42)}},
    // every frame while rolling: a thin continuous wake (time-throttled so it looks the same at any frame rate)
    dashTrail(p,dx,dz,u=1){const now=performance.now();if(now-trailT<26||list.length>460)return;trailT=now;
      for(let i=0;i<2;i++)puffDust(p.x+rnd(-.18,.18),p.y+.2,p.z+rnd(-.18,.18),-dx*rnd(.4,1.4)+rnd(-.5,.5),rnd(.2,.7),-dz*rnd(.4,1.4)+rnd(-.5,.5),rnd(.2,.3),rnd(1.4,2),rnd(.5,.75),.14+.2*u)},
    // end of a tumble: a soft ring of dust that rolls outward, pushed a little further the way you were going
    land(p,dx,dz){const k=crowd(),n=Math.round(11*k);
      for(let i=0;i<n;i++){const a=i/n*6.283+rnd(-.2,.2),sp=rnd(1.4,3);
        puffDust(p.x,p.y+.2,p.z,Math.cos(a)*sp+dx*1.4,rnd(.2,.7),Math.sin(a)*sp+dz*1.4,rnd(.26,.38),rnd(1.6,2.4),rnd(.6,.95),.36)}
      for(let i=0;i<3;i++)puffDust(p.x+dx*.3,p.y+.3,p.z+dz*.3,dx*rnd(.5,1.5)+rnd(-.3,.3),rnd(.5,1),dz*rnd(.5,1.5)+rnd(-.3,.3),rnd(.4,.55),rnd(1.4,2),rnd(.8,1.1),.3)},
    // step-dash while swinging a melee weapon: a short scuff of dust behind the feet
    lunge(p,dx,dz){const k=crowd(),sx=-dz,sz=dx;
      for(let i=0,n=Math.round(5*k);i<n;i++){const b=rnd(.8,2.4),sd=rnd(-1,1);puffDust(p.x-dx*.1,p.y+.2,p.z-dz*.1,-dx*b+sx*sd,rnd(.2,.6),-dz*b+sz*sd,rnd(.22,.32),rnd(1.4,2),rnd(.4,.65),.34)}},
    update(dt){updRibbons(dt);lt=Math.max(0,lt-dt);light.intensity=lt>0?ltI*lt/ltMax:0;
      for(let i=list.length-1;i>=0;i--){const q=list[i],m=q.m;
        if(q.delay>0){q.delay-=dt;if(q.delay>0)continue;m.visible=true}
        q.life-=dt;if(q.life<=0){scene.remove(m);if(q.fade)m.material.dispose();list.splice(i,1);continue}
        if(q.drag){const f=Math.exp(-q.drag*dt);q.vx*=f;q.vy*=f;q.vz*=f}
        m.position.x+=q.vx*dt;m.position.y+=q.vy*dt;m.position.z+=q.vz*dt;q.vy-=q.g*dt;
        if(q.floor!==undefined&&m.position.y<q.floor)q.life=0;
        const gyb=(ground?ground(m.position.x,m.position.z):0)+.04;   // bounce on the real terrain height, not y=0
        if(q.bounce&&m.position.y<gyb){m.position.y=gyb;q.vy=Math.abs(q.vy)*.3;q.vx*=.5;q.vz*=.5;q.spin*=.3}
        const k=q.life/q.max;
        if(q.anim){q.anim(q,1-k);continue}
        if(q.drop){_v.set(q.vx,q.vy,q.vz);const sp=_v.length();if(sp>.01)m.quaternion.setFromUnitVectors(Z,_v.multiplyScalar(1/sp));const r=q.s0*Math.min(1,k*4);m.scale.set(r,r,r*(1+Math.min(2.4,sp*.13)));continue}
        if(q.heat){const ha=1-k,h=q.heat,hc=m.material.color;if(ha<.45)hc.copy(h[0]).lerp(h[1],ha/.45);else hc.copy(h[1]).lerp(h[2],(ha-.45)/.55)}
        if(q.fade){if(q.soft){const a=Math.min(1,(1-k)*(q.pop?30:8)),b=q.hold?Math.min(1,k/q.hold):k;m.material.opacity=q.fade*a*a*(3-2*a)*b*b*(3-2*b)}else m.material.opacity=q.fade*k}
        if(q.st){if(!q.fixedQ){_v.set(q.vx,q.vy,q.vz);const sp=_v.length();if(sp>.01)m.quaternion.setFromUnitVectors(Z,_v.multiplyScalar(1/sp));m.scale.set(k*q.w,k*q.w,Math.max(.01,q.len*(.3+.7*k)*Math.min(1.6,.4+sp*.1)))}
          else m.scale.set(k*q.w,k*q.w,q.len);continue}
        if(q.soft){m.material.rotation+=q.spin*dt;const s=q.s0*(1+q.grow*(q.pop?1-Math.pow(k,q.pop):1-k*k));m.scale.set(s,s,1);continue}
        m.rotation.x+=q.spin*dt;
        const s=q.ringFade?q.s0*(1+(1-k)*q.grow):q.s0*(1+(1-k)*q.grow)*(q.grow?Math.min(1,k*2):(q.keep?Math.min(1,k*3):k));
        if(m.isSprite)m.scale.set(s,s,1);else m.scale.setScalar(Math.max(s,.001))}}
  };
}
