// Gun + melee effects.
//  GUNFIRE: per-weapon muzzle blast (multi-plane flash, hot sparks that cool white -> orange, falling embers, powder flecks, gas ring, smoke, rising wisps, brass),
//           tiny tracer rounds with long thin trail lines for the fast guns, and for the sniper a supersonic aftershock (shock rings along the path,
//           a long lingering line + smoke tube, ground blast at the muzzle, heavy impact).
//  MELEE:   slashHit() = Genshin-style crescent sweep waves (crossed pair for dual blades), cut lines, glow flash, flowing energy wisps + motes, bouncing realistic sparks.
import * as T from 'three';
const cv=(w,h,draw)=>{const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t};
const glowTex=cv(128,128,(g)=>{const r=g.createRadialGradient(64,64,0,64,64,64);[[0,1],[.12,.85],[.35,.42],[.65,.1],[1,0]].forEach(([s,a])=>r.addColorStop(s,`rgba(255,255,255,${a})`));g.fillStyle=r;g.fillRect(0,0,128,128)});
const ringTex=cv(256,256,(g)=>{const r=g.createRadialGradient(128,128,0,128,128,127);[[0,0],[.55,0],[.75,.35],[.86,1],[.93,.5],[1,0]].forEach(([s,a])=>r.addColorStop(s,`rgba(255,255,255,${a})`));g.fillStyle=r;g.fillRect(0,0,256,256)});   // crisp bright-edged ring
const flashTex=cv(256,128,(g,w,h)=>{g.clearRect(0,0,w,h);
  const cone=g.createLinearGradient(20,0,w,0);cone.addColorStop(0,'rgba(255,255,255,1)');cone.addColorStop(.25,'rgba(255,230,150,.95)');cone.addColorStop(.7,'rgba(255,140,40,.55)');cone.addColorStop(1,'rgba(255,90,0,0)');
  g.fillStyle=cone;g.beginPath();g.moveTo(20,h/2-18);g.quadraticCurveTo(110,h/2-14,w,h/2-1);g.lineTo(w,h/2+1);g.quadraticCurveTo(110,h/2+14,20,h/2+18);g.closePath();g.fill();
  [[1,.38],[-1,.38]].forEach(([s,k])=>{g.fillStyle='rgba(255,210,120,.8)';g.beginPath();g.moveTo(30,h/2);g.quadraticCurveTo(70,h/2+s*50*k*2,120,h/2+s*58);g.quadraticCurveTo(80,h/2+s*14,30,h/2);g.fill()});
  const core=g.createRadialGradient(34,h/2,0,34,h/2,38);core.addColorStop(0,'rgba(255,255,255,1)');core.addColorStop(1,'rgba(255,200,90,0)');g.fillStyle=core;g.fillRect(0,0,100,h)});
const tailTex=cv(16,64,(g,w,h)=>{const r=g.createLinearGradient(0,0,0,h);r.addColorStop(0,'rgba(255,255,255,0)');r.addColorStop(.7,'rgba(255,255,255,.55)');r.addColorStop(1,'rgba(255,255,255,1)');g.fillStyle=r;g.fillRect(0,0,w,h)});
const lineTex=cv(256,16,(g,w,h)=>{const r=g.createLinearGradient(0,0,w,0);r.addColorStop(0,'rgba(255,255,255,0)');r.addColorStop(.35,'rgba(255,255,255,.7)');r.addColorStop(.5,'rgba(255,255,255,1)');r.addColorStop(.65,'rgba(255,255,255,.7)');r.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=r;g.beginPath();g.moveTo(0,h/2);g.quadraticCurveTo(w/2,0,w,h/2);g.quadraticCurveTo(w/2,h,0,h/2);g.fill()});

// bullet mark: soft scorch halo, a dark chipped hole in the middle and a few short cracks (white-less, so it reads as damage on any surface)
const markTex=cv(128,128,(g)=>{g.translate(64,64);
  const h=g.createRadialGradient(0,0,2,0,0,60);h.addColorStop(0,'rgba(18,12,8,.78)');h.addColorStop(.35,'rgba(30,22,14,.5)');h.addColorStop(1,'rgba(30,22,14,0)');g.fillStyle=h;g.beginPath();g.arc(0,0,60,0,6.283);g.fill();
  g.fillStyle='rgba(8,5,3,.92)';g.beginPath();for(let i=0;i<14;i++){const a=i/14*6.283,r=(i%2?9:14)+Math.random()*4;i?g.lineTo(Math.cos(a)*r,Math.sin(a)*r):g.moveTo(Math.cos(a)*r,Math.sin(a)*r)}g.closePath();g.fill();
  g.strokeStyle='rgba(10,6,4,.7)';g.lineWidth=1.6;for(let i=0;i<7;i++){const a=Math.random()*6.283,l=22+Math.random()*26;g.beginPath();g.moveTo(Math.cos(a)*12,Math.sin(a)*12);g.lineTo(Math.cos(a+.15)*l*.6,Math.sin(a+.15)*l*.6);g.lineTo(Math.cos(a-.1)*l,Math.sin(a-.1)*l);g.stroke()}});

// HD impact textures: burst of radial light rays, and an anamorphic horizontal streak with a 4-point star core
const rayTex=cv(256,256,(g)=>{g.translate(128,128);g.globalCompositeOperation='lighter';
  for(let i=0;i<36;i++){const a=i/36*6.283+Math.random()*.15,L=70+Math.random()*58,wd=.025+Math.random()*.05,gr=g.createLinearGradient(0,0,Math.cos(a)*L,Math.sin(a)*L);gr.addColorStop(0,'rgba(255,255,255,.9)');gr.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=gr;g.beginPath();g.moveTo(0,0);g.lineTo(Math.cos(a-wd)*L,Math.sin(a-wd)*L);g.lineTo(Math.cos(a+wd)*L,Math.sin(a+wd)*L);g.closePath();g.fill()}
  const c=g.createRadialGradient(0,0,0,0,0,52);c.addColorStop(0,'rgba(255,255,255,1)');c.addColorStop(.4,'rgba(255,255,255,.5)');c.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=c;g.fillRect(-128,-128,256,256)});
const flare2Tex=cv(256,256,(g,w,h)=>{g.globalCompositeOperation='lighter';
  const hz=(y,t,a)=>{const r=g.createLinearGradient(0,0,w,0);r.addColorStop(0,'rgba(255,255,255,0)');r.addColorStop(.5,`rgba(255,255,255,${a})`);r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,y,w,t)};
  hz(110,36,.3);hz(124,8,1);
  const v=g.createLinearGradient(0,0,0,h);v.addColorStop(0,'rgba(255,255,255,0)');v.addColorStop(.5,'rgba(255,255,255,.8)');v.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=v;g.fillRect(125,60,6,136);
  const c=g.createRadialGradient(128,128,0,128,128,44);c.addColorStop(0,'rgba(255,255,255,1)');c.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=c;g.fillRect(0,0,w,h)});

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
// cached per size / colour: bullets used to create a NEW CapsuleGeometry + NEW materials for every shot and never dispose them, so GPU buffers and
// materials piled up the longer a match ran (9 bots fire ~40 rounds a second in 5v5)
const capC={},CG=(r,l,a,b)=>{const k=r+'|'+l+'|'+a+'|'+b;return capC[k]||(capC[k]=new T.CapsuleGeometry(r,l,a,b))},
  tmC={},TM=(c,op)=>{const k=c+'|'+op;return tmC[k]||(tmC[k]=new T.MeshBasicMaterial({map:tailTex,color:c,blending:T.AdditiveBlending,depthWrite:false,transparent:true,side:T.DoubleSide,opacity:op}))};
const tailG=(L,w)=>tailGeo[L+'|'+w]||(tailGeo[L+'|'+w]=new T.PlaneGeometry(w,L).rotateX(-Math.PI/2).translate(0,0,-L/2));

// per-weapon look, worked out from the weapon's stats (speed >= 30 = fast needle rounds, after = sniper-style aftershock, pellets > 1 = shotgun)
const prof=st=>{const sp=(st&&st.speed)||20,after=!!(st&&st.after),fast=sp>=30,pel=(st&&st.pellets)||1,kick=(st&&st.kick)||1;
  if(after)return{size:2.4,fire:1.6,sparks:2,smoke:2,cone:.13,fast:true,after:true};
  if(fast)return{size:1,fire:1,sparks:1.1,smoke:.9,cone:.2,fast:true};
  if(pel>1)return{size:1.15,fire:1.2,sparks:1.3,smoke:1.1,cone:.45};
  return{size:.8+Math.min(.3,(kick-1)*.2),fire:.8,sparks:.8,smoke:.8,cone:.32}};

export function createFX(scene){
  let ground=null;
  const marks=[],MARKMAX=110,markGeo=new T.PlaneGeometry(1,1),markMat=new T.MeshBasicMaterial({map:markTex,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,side:T.DoubleSide});
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
  const crowd=()=>list.length>640?.25:list.length>420?.45:list.length>260?.7:1;
  // one smooth dust puff: eased fade in/out (soft), ease-out growth, drag, slow buoyant rise, lazy spin
  const puffDust=(x,y,z,vx,vy,vz,s0,grow,life,op=.4)=>{const m=new T.Sprite(DM(Math.random()<.5?'#d6caa8':'#bfb292',(Math.random()*3)|0));m.position.set(x,y,z);
    const q=add(m,{s0,grow,vx,vy,vz,drag:3.2,g:-.4,life,fade:op,soft:1,spin:rnd(-.9,.9)});m.material.rotation=rnd(0,6.283);return q};
  let trailT=0,atT=0;
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
    return{m,g,pos,clr,idx,pts:[],lx:0,ly:0,lz:0,has:false,d:0,cr:c.r,cg:c.g,cb:c.b,life:big?.7:.4,w0:big?.03:.02,w1:big?.14:.07,amp:big?.05:.03,ph:Math.random()*6.283,touched:clk}};
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
          ph=q.d*1.9+clk*3.3+r.ph,ox=(Math.sin(ph)+.5*Math.sin(ph*2.3+1.7))*r.amp*e,oy=(Math.sin(ph*1.3+2.1)+.5*Math.sin(ph*2.9))*r.amp*.6*e+a*.04,
          hl=Math.hypot(q.dx,q.dz)||1,hx=-q.dz/hl,hz=q.dx/hl,cx=q.x+hx*ox,cy=q.y+oy,cz=q.z+hz*ox;
        let o=2*i*3;pos[o]=cx-hx*w;pos[o+1]=cy;pos[o+2]=cz-hz*w;pos[o+3]=cx+hx*w;pos[o+4]=cy;pos[o+5]=cz+hz*w;   // flat strip
        o=(2*RMAX+2*i)*3;pos[o]=cx;pos[o+1]=cy-w*.8;pos[o+2]=cz;pos[o+3]=cx;pos[o+4]=cy+w*.8;pos[o+5]=cz;            // upright strip
        for(let s=0;s<2;s++)for(let j=0;j<2;j++){const c=(s*2*RMAX+2*i+j)*4;clr[c]=r.cr;clr[c+1]=r.cg;clr[c+2]=r.cb;clr[c+3]=al}}
      let c=0;for(let s=0;s<2;s++){const b=s*2*RMAX;for(let i=0;i<n-1;i++){const a0=b+2*i;idx[c++]=a0;idx[c++]=a0+1;idx[c++]=a0+2;idx[c++]=a0+1;idx[c++]=a0+3;idx[c++]=a0+2}}
      r.g.setDrawRange(0,c);r.g.index.needsUpdate=true;r.g.attributes.position.needsUpdate=true;r.g.attributes.color.needsUpdate=true}};
  // ---- crescent slash wave (Genshin-style): a thin glowing arc with a white-hot edge and a soft aura that sweeps through the hit while it fades
  const arcC={},_qa=new T.Quaternion(),_Y=new T.Vector3(0,1,0),e3=x=>1-Math.pow(1-x,3);
  // arc in the XZ plane, centred on +z (angle g from -th/2 .. th/2). rows: [kind, alpha, white mix]; kind 0 = outer aura, 1 = bright core edge, 2 = inner glow, 3 = inner edge.
  // The crescent is thick in the middle and pointed at both ends; alpha ramps up towards the leading head so the tail trails off.
  const arcGeo=(col,th)=>{const key=col+'|'+th;if(arcC[key])return arcC[key];
    const n=96,rows=[[0,0,0],[1,1,.85],[2,.5,.2],[3,0,0]],cc=new T.Color(col),wh=new T.Color('#ffffff'),pos=[],clr=[],idx=[];
    for(let i=0;i<=n;i++){const u=i/n,g=-th/2+u*th,sx=Math.sin(g),cz=Math.cos(g),Tk=.32*Math.sin(Math.PI*Math.pow(u,1.6)),au=Math.pow(u,1.1)*Math.min(1,(1-u)*9+.2);
      rows.forEach(([kd,al,wm])=>{const r=kd===0?1.05+.25*Tk:kd===1?1:kd===2?1-.5*Tk:1-Tk,c=cc.clone().lerp(wh,wm).multiplyScalar(kd===1?2.2:kd===2?1.3:.9);pos.push(sx*r,0,cz*r);clr.push(c.r,c.g,c.b,al*au)})}
    for(let i=0;i<n;i++)for(let j=0;j<3;j++){const a=i*4+j,b=(i+1)*4+j;idx.push(a,b,a+1,a+1,b,b+1)}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('color',new T.Float32BufferAttribute(clr,4));g.setIndex(idx);return arcC[key]=g};
  // sd = swing side (+1 / -1), R = radius, th = arc angle. The arc is tilted by the swing slant, grows a little, rotates through the cut and fades.
  const crescent=(p,yaw,sd,col,pw,R,life,th=2.2,roll,ctr,delay=0)=>{
    const m=new T.Mesh(arcGeo(col,th),new T.MeshBasicMaterial({vertexColors:true,transparent:true,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide})),
      fx=Math.sin(yaw),fz=Math.cos(yaw),r=R*pw,qb=new T.Quaternion().setFromEuler(new T.Euler(0,yaw,roll??sd*.5,'YXZ'));
    if(ctr)m.position.set(p.x,p.y+.05,p.z);else m.position.set(p.x-fx*r*.92,p.y+.05,p.z-fz*r*.92);m.quaternion.copy(qb);m.scale.setScalar(.001);
    add(m,{life,delay,s0:1,fade:1,anim:(q,a)=>{const e=e3(Math.min(1,a/.4)),s=r*(.85+.3*e+.1*a);m.scale.set(sd*s,1,s);
      m.quaternion.copy(qb).multiply(_qa.setFromAxisAngle(_Y,sd*th*.45*(e-.6)));m.material.opacity=(1-sm((a-.3)/.7))*Math.min(1,a*25+.25)}})};
  // realistic hit sparks: thin hot streaks, glowing flecks and embers thrown back OPPOSITE to the bullet / blade direction (dx,dz = the way it was travelling), in a cone, falling and bouncing
  const sparkCone=(p,dx,dz,n,pw=1,cols=['#fff7d6','#ffd84a','#ff9a30'])=>{const l=Math.hypot(dx,dz)||1,base=Math.atan2(-dx/l,-dz/l),k=crowd();
    for(let i=0,m=Math.round(n*k);i<m;i++){const g=base+rnd(-.55,.55),sp=rnd(7,22)*pw,h=Math.random(),c=h<.35?cols[0]:h<.75?cols[1]:cols[2];
      streak(p,c,Math.sin(g)*sp,rnd(-.5,4.5),Math.cos(g)*sp,{len:rnd(.3,.8)*pw,w:1.1,g:14,life:rnd(.2,.5),drag:1.8,bounce:1})}
    for(let i=0,m=Math.round(n*.8*k);i<m;i++){const g=base+rnd(-.8,.8),sp=rnd(2,9)*pw;dot(p,i%2?'#ffd070':'#ff8a24',rnd(.014,.03),0,{vx:Math.sin(g)*sp,vy:rnd(.5,4.5),vz:Math.cos(g)*sp,g:14,drag:.9,life:rnd(.35,.8),bounce:1})}
    for(let i=0,m=Math.round(n*.25*k);i<m;i++){const g=base+rnd(-.9,.9),sp=rnd(1.5,5);sprite(SA(i%3?'#ff9a40':'#ffd070'),p,{s0:rnd(.04,.08)*pw,vx:Math.sin(g)*sp,vy:rnd(.8,3.5),vz:Math.cos(g)*sp,g:9,drag:1.3,life:rnd(.5,1),bounce:1,keep:1})}};
  return{
    setGround(fn){ground=fn},
    // ---- bullet marks: a scorched, cracked hole left where a bullet hits the ground (lies flat) or a tree / rock / wall (faces back at the shooter). Oldest marks vanish past the cap.
    mark(p,vx=0,vy=0,vz=0,onGround=false){
      const m=new T.Mesh(markGeo,markMat),sz=rnd(.22,.36);
      if(onGround){const gy=(ground?ground(p.x,p.z):p.y)+.035;m.position.set(p.x,gy,p.z);m.rotation.set(-Math.PI/2,0,rnd(0,6.283))}
      else{const l=Math.hypot(vx,vy,vz)||1,nx=-vx/l,ny=-vy/l,nz=-vz/l;m.position.set(p.x+nx*.1,p.y+ny*.1,p.z+nz*.1);m.quaternion.setFromUnitVectors(Z,new T.Vector3(nx,ny,nz));m.rotateZ(rnd(0,6.283))}
      m.scale.setScalar(sz);m.renderOrder=2;scene.add(m);marks.push(m);
      while(marks.length>MARKMAX){const o=marks.shift();scene.remove(o)}},
    clearMarks(){while(marks.length)scene.remove(marks.pop())},
    // additive white glow sprite parented to a hit creature; the caller flickers its visibility / opacity while it is hurt
    flashGlow(){const sp=new T.Sprite(new T.SpriteMaterial({map:glowTex,color:'#fff4c8',blending:T.AdditiveBlending,depthWrite:false,depthTest:false,transparent:true,opacity:0}));sp.renderOrder=10;sp.visible=false;return sp},
    // ================================================================= shot
    // st = the weapon's stats (speed / after / pellets / kick ...), gy = ground height; enemies call it with neither
    muzzle(p,a,st,gy){const P=prof(st),S=P.size,k=crowd()*((st&&st.lite)||1),sq=Math.sqrt(S),dx=Math.sin(a),dz=Math.cos(a),f=new T.Vector3(p.x+dx*.1,p.y,p.z+dz*.1),
        dir=sp=>{const g=a+rnd(-sp,sp);return[Math.sin(g),Math.cos(g)]},clean=!!P.after;
      // 1) larger glow: a big warm halo + a white-hot core pop right at the muzzle, plus a few flame puffs
      sprite(SA('#ffa030'),f,{life:.11,s0:1.9*S,grow:.5});sprite(SA('#fff4c8'),f,{life:.07,s0:1.1*S,grow:.3});
      fireP(f.x+dx*.12*S,f.y,f.z+dz*.12*S,dx*.4,.05,dz*.4,.55*S,.65,.07,.9,HOT);
      for(let i=0,n=Math.round(4*P.fire*k);i<n;i++){const[vx,vz]=dir(P.cone),v=rnd(1.5,4.5)*sq,o=rnd(0,.35)*S;
        fireP(f.x+dx*o,f.y+rnd(-.03,.07),f.z+dz*o,vx*v,rnd(0,.5),vz*v,rnd(.18,.3)*S,rnd(.8,1.2),rnd(.08,.15),.75,i%2?HOT:ORANGE)}
      // 2) sparks: thin hot streaks, glowing flecks and a few big bright glowing sparks that spit out of the barrel
      for(let i=0,n=Math.round(8*P.sparks*k);i<n;i++){const[vx,vz]=dir(P.cone*1.5),v=rnd(8,22);
        streak(f,i%2?'#ffb040':'#fff0c0',vx*v,rnd(-.3,1.5),vz*v,{len:rnd(.2,.5)*S,g:7,life:rnd(.08,.18),drag:2.4})}
      for(let i=0,n=Math.round(14*P.sparks*k);i<n;i++){const[vx,vz]=dir(P.cone*2),v=rnd(3,13)*sq;
        dot(f,i%3?'#ffb040':'#fff0c0',rnd(.014,.03)*sq,0,{vx:vx*v,vy:rnd(-.2,2.5),vz:vz*v,g:10,drag:1.4,life:rnd(.2,.45),bounce:1})}
      for(let i=0,n=Math.round(5*P.sparks*k);i<n;i++){const[vx,vz]=dir(P.cone*2.2),v=rnd(2,9);
        sprite(SA(i%2?'#ffc060':'#ffe9a0'),f,{s0:rnd(.16,.3)*S,vx:vx*v,vy:rnd(.2,2.2),vz:vz*v,g:7,drag:2,life:rnd(.14,.3),keep:1})}   // larger glowing sparks
      // 3) embers that drift down and bounce, plus fine powder flecks
      for(let i=0,n=Math.round(4*P.sparks*k);i<n;i++){const[vx,vz]=dir(.7),v=rnd(1.5,5);sprite(SA(i%3?'#ff9a40':'#ffd070'),f,{s0:rnd(.06,.11),vx:vx*v,vy:rnd(.5,3),vz:vz*v,g:9,drag:1.4,life:rnd(.4,.8),bounce:1,keep:1})}
      for(let i=0,n=Math.round(8*k);i<n;i++){const[vx,vz]=dir(P.cone*2),v=rnd(2,8);dot(f,'#3a2c20',rnd(.012,.022),0,{vx:vx*v,vy:rnd(0,2),vz:vz*v,g:9,drag:1.6,life:rnd(.2,.4)})}
      // 4) thin smoke (none for the sniper, which stays clean)
      if(!clean){for(let i=0,n=Math.round(2*P.smoke*k);i<n;i++){const[vx,vz]=dir(P.cone),v=rnd(.8,2.2);smokeP(f.x+dx*.1,f.y,f.z+dz*.1,vx*v,rnd(.2,.6),vz*v,.12*S,1.6,rnd(.35,.55),.18,SMOKE2,.03*i)}}
      // 5) ejected brass
      const c=new T.Mesh(shell,GM('#e6c25a'));c.position.copy(p);add(c,{s0:1,vx:dz*rnd(2,3.2)+rnd(-.3,.3),vy:rnd(2.8,4),vz:-dx*rnd(2,3.2)+rnd(-.3,.3),g:16,spin:20,life:1.1,bounce:1,keep:1});
      light.position.copy(f);ltMax=.08+S*.02;ltI=2.6+S*1.2;lt=ltMax},
    // ================================================================= bullet in flight (sp = its speed: >= 30 gives the slim needle round)
    bullet(col='#ffe066',sp=20){const g=new T.Group(),fast=typeof sp==='number'&&sp>=30;
      if(!fast){
        const core=new T.Mesh(CG(.05,.34,3,8),GM('#ffffff'));core.rotation.x=Math.PI/2;g.add(core);
        const t1=new T.Mesh(tailG(1.9,.16),TM(col,1)),t2=t1.clone();t2.rotation.z=Math.PI/2;g.add(t1,t2);
        const glow=new T.Sprite(SA(col));glow.scale.set(.75,.75,1);g.add(glow);return g}
      const big=sp>=60,tail=Math.min(9,2.2+sp*.06),lw=.03+(big?.012:0),core=new T.Mesh(CG(.022+(big?.006:0),.2+(big?.3:0),3,6),GM('#ffffff'));core.rotation.x=Math.PI/2;g.add(core);
      const mk=(w,op,c)=>{const m=new T.Mesh(tailG(tail,w),TM(c,op)),m2=m.clone();m2.rotation.z=Math.PI/2;g.add(m,m2)};
      mk(lw,1,'#ffffff');mk(lw*3.2,.4,col);
      const glow=new T.Sprite(SA(col));glow.scale.setScalar(big?.42:.3);g.add(glow);return g},
    // called every frame per bullet. Slow rounds: glow + a little smoke. Fast rounds (o.fast): a flat-colour smoke ribbon that wobbles, widens and fades out
    trail(p,vx=0,vz=0,col='#ffd54a',o){
      if(!o||!o.fast){const tk=list.length>300?.35:1;if(Math.random()<.7*tk)sprite(SA(col),p,{life:.13,s0:.28});if(Math.random()<.1*tk)smoke(p,rnd(-.3,.3),rnd(.1,.5),rnd(-.3,.3),{s0:.1,grow:3,life:rnd(.35,.6)});return}
      let r=rbOf.get(p);if(!r){r=mkRibbon(!!o.after);rbOf.set(p,r);ribbons.push(r)}
      const vy=o.vy||0,l3=Math.hypot(vx,vy,vz)||1;r.touched=clk;feedRibbon(r,p,vx/l3,vy/l3,vz/l3,o.dt||.016)},
    // ================================================================= hit spark (bullet or melee hits an enemy)
    // vx,vz = the hit direction, pw = power (bigger for kills / heavy hits), ang0 = screen angle of the burst's long axis (random if left out).
    // Drawn in the plane facing the camera (which looks along the hit direction): a jagged pale core pops open, fine red / orange / yellow spikes shoot out
    // (denser along the long axis), a few long thin yellow lines streak away, and little glowing sparks fly off.
    splat(p,vx=0,vz=0,pw=1){const at=new T.Vector3(p.x,p.y+.05,p.z);
      // 3D particles like the tumble: soft dust puffs plus little solid chunks that fly back opposite the hit, fall and bounce
      {const l=Math.hypot(vx,vz)||1,rx=-vx/l,rz=-vz/l,k=crowd();
       for(let i=0,n=Math.round(5*pw*k);i<n;i++){const b=rnd(.6,2.6),sd=rnd(-1.2,1.2);puffDust(at.x,at.y,at.z,rx*b-rz*sd,rnd(.2,1),rz*b+rx*sd,rnd(.22,.34)*pw,rnd(1.4,2.1),rnd(.45,.75),.38)}
       for(let i=0,n=Math.round(8*pw*k);i<n;i++){const m=new T.Mesh(i%3?chip:dropG,GM(['#d9c9a8','#bfae82','#8a7a62','#ffd9a0'][i%4])),b=rnd(1.5,5.5),sd=rnd(-2,2);m.position.copy(at);
         add(m,{s0:rnd(.03,.08),vx:rx*b-rz*sd,vy:rnd(1.5,4.5),vz:rz*b+rx*sd,g:15,spin:rnd(8,20),life:rnd(.45,.8),bounce:1})}}
      for(let i=0;i<3;i++)sprite(SA(i%2?'#ffd84a':'#ffffff'),at,{life:.06,s0:(.7+.3*i%2)*pw,delay:i*.07});   // quick flicker of flashes
      sparkCone(at,vx,vz,Math.round(22*pw),pw);
      for(let i=0,n=Math.round(4*pw);i<n;i++){const m=new T.Mesh(chip,GM('#ffd9a0'));m.position.copy(at);add(m,{s0:rnd(.02,.04),vx:rnd(-2,2)-vx*.08,vy:rnd(1,3.5),vz:rnd(-2,2)-vz*.08,g:14,spin:rnd(8,20),life:rnd(.3,.5),bounce:1})}},
    // ================================================================= impacts
    hit(p,c='#ffe066',n=6){
      for(let i=0;i<n*2;i++){const a=rnd(0,6.283),sp=rnd(3,9);streak(p,i%2?c:'#fff3c0',Math.cos(a)*sp,rnd(1,6),Math.sin(a)*sp,{len:rnd(.14,.32),g:12,life:rnd(.15,.32)})}
      for(let i=0;i<Math.ceil(n/2);i++){const m=new T.Mesh(chip,GM(c));m.position.copy(p);add(m,{s0:rnd(.03,.06),vx:rnd(-3,3),vy:rnd(1,4),vz:rnd(-3,3),g:14,spin:rnd(8,20),life:rnd(.3,.5),bounce:1})}
      for(let i=0;i<2;i++)puffDust(p.x,p.y,p.z,rnd(-.8,.8),rnd(.3,.9),rnd(-.8,.8),rnd(.12,.18),rnd(1.2,1.8),rnd(.3,.5),.25)},
    // bullet / blade hits a wall, tree or the ground: small cloudy dust + a few chips of debris + a couple of sparks. heavy = sniper round (a bit more, still no rings)
    wall(p,c='#ffe066',heavy=false){const k=crowd(),n=Math.round((heavy?9:5)*k);
      for(let i=0;i<n;i++){const a=rnd(0,6.283),sp=rnd(.8,2.4);puffDust(p.x,p.y,p.z,Math.cos(a)*sp,rnd(.4,1.4),Math.sin(a)*sp,rnd(.14,.24)*(heavy?1.3:1),rnd(1.4,2.2),rnd(.4,.7),.4)}
      for(let i=0,m=Math.round((heavy?9:5)*k);i<m;i++){const ch=new T.Mesh(chip,GM(i%2?'#8a7a62':'#5d5144'));ch.position.copy(p);add(ch,{s0:rnd(.025,.055),vx:rnd(-3.5,3.5),vy:rnd(1.5,5),vz:rnd(-3.5,3.5),g:15,spin:rnd(8,20),life:rnd(.4,.7),bounce:1})}
      for(let i=0,m=heavy?5:3;i<m;i++){const a=rnd(0,6.283),sp=rnd(4,9);streak(p,i%2?c:'#fff3c0',Math.cos(a)*sp,rnd(1,5),Math.sin(a)*sp,{len:rnd(.12,.26),g:12,life:rnd(.12,.22)})}},
    // soldier ground smash: a burst of rock / dirt debris that flies out, falls and bounces, with soft dust clouds rolling outward (no rings)
    smash(p,pw=1){const k=crowd(),gy=(ground?ground(p.x,p.z):p.y)+.08;
      for(let i=0,n=Math.round(18*pw*k);i<n;i++){const a=rnd(0,6.283),sp=rnd(2,6.5)*pw,ch=new T.Mesh(chip,GM(['#7a6a52','#5d5144','#8f8068','#4a4036'][i%4]));ch.position.set(p.x+Math.cos(a)*.3,gy,p.z+Math.sin(a)*.3);
        add(ch,{s0:rnd(.05,.14),vx:Math.cos(a)*sp,vy:rnd(3,8)*pw,vz:Math.sin(a)*sp,g:20,spin:rnd(6,16),life:rnd(.6,1.1),bounce:1})}
      for(let i=0,n=Math.round(14*k);i<n;i++){const a=rnd(0,6.283),sp=rnd(.5,2);ch2(p.x,gy,p.z,a,sp)}
      for(let i=0,n=Math.round(12*pw*k);i<n;i++){const a=i/n*6.283+rnd(-.2,.2),sp=rnd(1.8,3.8)*pw;puffDust(p.x,gy+.15,p.z,Math.cos(a)*sp,rnd(.3,.9),Math.sin(a)*sp,rnd(.3,.45),rnd(1.8,2.8),rnd(.7,1.2),.42)}
      for(let i=0;i<4;i++)puffDust(p.x+rnd(-.3,.3),gy+.3,p.z+rnd(-.3,.3),rnd(-.4,.4),rnd(1,1.8),rnd(-.4,.4),rnd(.4,.55),rnd(1.5,2.2),rnd(.9,1.3),.3);
      function ch2(x,y,z,a,sp){const m=new T.Mesh(chip,GM('#9b8b70'));m.position.set(x,y,z);add(m,{s0:rnd(.02,.04),vx:Math.cos(a)*sp*3,vy:rnd(2,5),vz:Math.sin(a)*sp*3,g:16,spin:rnd(8,20),life:rnd(.4,.8),bounce:1})}},
    // weapon-aware bullet impact (flesh = hit a creature)
    impact(p,st,c='#ffe066',flesh=false){const P=prof(st);
      if(flesh)this.hit(p,c,P.after?10:P.fast?8:6);else this.wall(p,c,!!P.after)},
    dust(p,c='#bfae82'){const k=crowd();for(let i=0,n=Math.round(4*k);i<n;i++)puffDust(p.x,p.y,p.z,rnd(-1.4,1.4),rnd(.5,1.4),rnd(-1.4,1.4),rnd(.16,.26),rnd(1.5,2.3),rnd(.4,.7),.4);
      for(let i=0;i<4;i++){const m=new T.Mesh(chip,GM('#8a7a62'));m.position.copy(p);add(m,{s0:rnd(.025,.05),vx:rnd(-3,3),vy:rnd(1.5,4),vz:rnd(-3,3),g:15,spin:rnd(8,20),life:rnd(.35,.6),bounce:1})}},
    shock(p,c='#ffe0a0'){ring(p,c,.7,11,.4);ring(p,'#ffffff',.4,7,.25);for(let i=0;i<14;i++){const a=i/14*6.283;sprite(SN('#bfae82',.6),p,{s0:rnd(.2,.32),grow:2.6,vx:Math.cos(a)*rnd(3,5),vy:rnd(.3,1),vz:Math.sin(a)*rnd(3,5),drag:2.4,life:rnd(.5,.8)});
        streak(p,'#e8dcb0',Math.cos(a)*rnd(5,9),rnd(1,4),Math.sin(a)*rnd(5,9),{len:.2,g:12,life:.3})}},
    puff(p,c,n=10){for(let i=0;i<n;i++)dot(p,c,rnd(.1,.2),4,{vy:rnd(1,4),life:rnd(.4,.7),grow:0});for(let i=0;i<5;i++)dot(p,'#ffffff',.06,5);
      for(let i=0;i<3;i++)puffDust(p.x,p.y,p.z,rnd(-1,1),rnd(.3,1),rnd(-1,1),rnd(.16,.26),rnd(1.3,1.9),rnd(.4,.6),.3)},   // soft dust only: no ring / glow disc
    // ================================================================= melee impact
    // d = swing side (+1 / -1), col = blade colour, pw = power (kills hit bigger), dual = dual-blade hit (bigger, crossed, more sparks), col2 = the off-hand blade colour,
    // flesh = hit a creature (false = hit a wall / collision: only the bullet-style impact), vert = the finisher (both blades down: vertical crescents + shock ring).
    // Every hit also spawns the same impact particles a bullet makes (hit sparks, chips, ring, smoke; + ground dust on world hits).
    // Layers: a sweeping crescent wave (two crossing ones for dual), cut lines, a big soft glow flash + rings, the camera-facing hit-spark burst, soft energy wisps and glow motes
    // that flow along the cut, and realistic sparks (long thin streaks, white-hot -> orange, that fly off, bounce and settle).
    slashHit(p,yaw,d=1,col='#ffe8a8',pw=1,dual=false,col2='#c9a0ff',flesh=true,vert=false){
      const sd=d>=0?1:-1,side=yaw+sd*Math.PI/2,D=dual?1:0,k=crowd(),at=new T.Vector3(p.x,p.y+.1,p.z),
        cut=(ang,len,c,life,w=1)=>{const g=new T.Group();g.position.copy(p);g.rotation.y=ang-Math.PI/2;
          [0,1].forEach(v=>{const m=new T.Mesh(lineG,new T.MeshBasicMaterial({map:lineTex,color:c,blending:T.AdditiveBlending,depthWrite:false,transparent:true,side:T.DoubleSide}));m.scale.set(len,w,1);if(!v)m.rotation.x=-Math.PI/2;g.add(m)});add(g,{life,s0:1,grow:.5})},
        c1=new T.Color(col),heat=[new T.Color('#ffffff').lerp(c1,.3),c1.clone(),c1.clone().multiplyScalar(.3)];
      // hit a wall / collision: exactly the bullet impact (sparks, chips, ring, smoke) + ground dust, no creature-style slash art
      if(!flesh){this.hit(p,col,dual?14:9);this.dust(p);sprite(SA('#fff3b0'),at,{life:.12,s0:1.2*pw});return}
      const cutV=(len,c,life,w=1)=>{const g=new T.Group();g.position.copy(p);g.rotation.y=yaw;
        const m=new T.Mesh(lineG,new T.MeshBasicMaterial({map:lineTex,color:c,blending:T.AdditiveBlending,depthWrite:false,transparent:true,side:T.DoubleSide}));m.scale.set(len,w,1);m.rotation.z=Math.PI/2;g.add(m);add(g,{life,s0:1,grow:.5})};
      // 1) crescent waves (vertical pair for the finisher)  2) cut lines (an X for dual blades, tall lines for the finisher)
      if(vert){crescent(p,yaw,1,col,pw*1.4,1.7,.55,5.4,0,true);crescent(p,yaw,-1,col2,pw*1.2,2.1,.6,5.0,0,true);crescent(p,yaw,1,'#ffffff',pw*1.3,1.9,.5,4.6,0,true,.03);   // spinning finisher: whirling ring waves around the target
        cut(side,3.4*pw,'#ffffff',.22,1.4);cut(side+Math.PI/2,3.4*pw,col,.26,2);cut(side+Math.PI/4,3*pw,col2,.26,2)}
      else{crescent(p,yaw,sd,col,pw*(1+.25*D),1.7+.5*D,.36);crescent(p,yaw,sd,'#ffffff',pw*(1+.25*D)*.96,1.7+.5*D,.3,2.0,undefined,false,.025);crescent(p,yaw,sd,col,pw*(1+.25*D)*1.12,1.7+.5*D,.34,2.3,undefined,false,.05);   // white-hot core + a trailing echo
        if(dual)crescent(p,yaw,-sd,col2,pw*1.25,2.1,.4,2.4);
        cut(side+.45,2.6*pw,'#ffffff',.17,1.2);cut(side+.45,3.4*pw*(1+.2*D),col,.26,2.4);
        if(dual){cut(side-.45,3*pw,'#ffffff',.2,1.4);cut(side-.45,4*pw,col2,.3,2.8)}}
      // 3) glow flash, rings and a light pulse
      sprite(SA(col),at,{life:.34,s0:2.8*pw*(1+.6*D),grow:.9});sprite(SA('#ffffff'),at,{life:.1,s0:1.3*pw*(1+.5*D)});
      if(dual)sprite(SA(col2),at,{life:.3,s0:2.4*pw,grow:.9});
      light.position.copy(at);ltMax=.16;ltI=4+3*D;lt=ltMax;
      // sparks fly back the way the blade came from (opposite the slash direction)
      const sx=Math.sin(yaw),sz=Math.cos(yaw);
      this.splat(p,sx,sz,1.15*pw*(1+.3*D));
      sparkCone(at,sx,sz,Math.round((22+20*D)*pw),1.15*pw,['#ffffff',col,'#ffb040']);
      if(dual)sparkCone(at,sx,sz,18,pw,['#ffffff',col2,'#ffb040']);
      for(let i=0,n=Math.round((8+8*D)*k);i<n;i++){const ang=Math.atan2(-sx,-sz)+rnd(-.5,.5),v=rnd(1.5,4.5);
        fireP(p.x,p.y+rnd(-.1,.3),p.z,Math.sin(ang)*v,rnd(.1,.9),Math.cos(ang)*v,rnd(.2,.34)*pw,rnd(1,1.6),rnd(.25,.4),.5,heat)}
      for(let i=0;i<8;i++){const m=new T.Mesh(chip,GM(i%2?'#ffd9a0':col));m.position.copy(p);add(m,{s0:rnd(.03,.06),vx:-sx*rnd(1,5)+rnd(-2,2),vy:rnd(1.5,4.5),vz:-sz*rnd(1,5)+rnd(-2,2),g:14,spin:rnd(8,20),life:rnd(.3,.55),bounce:1})}},
    // ================================================================= jump / air dash
    // takeoff: a small ring of dust kicked out around the feet
    jump(p){const k=crowd(),n=Math.round(8*k);for(let i=0;i<n;i++){const a=i/n*6.283+rnd(-.2,.2),sp=rnd(1.2,2.4);puffDust(p.x,p.y+.1,p.z,Math.cos(a)*sp,rnd(.2,.6),Math.sin(a)*sp,rnd(.2,.3),rnd(1.3,1.9),rnd(.4,.65),.34)}},
    // start of an air dash: a shock ring across the dash direction, a white pop and speed streaks flying backwards
    airDash(p,dx,dz){const d=new T.Vector3(dx,0,dz);diskRing(p,d,'#cfeaff',.5,7,.32,.85);diskRing(p,d,'#ffffff',.3,5,.22,.9);
      sprite(SA('#ffffff'),p,{life:.12,s0:1.5});sprite(SA('#9fd4ff'),p,{life:.3,s0:1.9,grow:.8});
      for(let i=0,n=Math.round(14*crowd());i<n;i++)streak(p,i%2?'#ffffff':'#9fd4ff',-dx*rnd(8,16)+rnd(-2,2),rnd(-2,3),-dz*rnd(8,16)+rnd(-2,2),{len:rnd(.5,1.1),w:1.1,g:2,life:rnd(.2,.38),drag:2})},
    // every frame while dashing: soft glow puffs + thin speed lines left behind (time-throttled, same at any frame rate)
    airTrail(p,dx,dz,u=1){const now=performance.now();if(now-atT<18||list.length>460)return;atT=now;
      sprite(SA('#cfeaff'),p,{life:.26,s0:.5+.4*u,grow:-.4});
      streak(p,'#ffffff',-dx*rnd(6,10)+rnd(-1,1),rnd(-1,1),-dz*rnd(6,10)+rnd(-1,1),{len:rnd(.6,1.2),w:1.2,g:0,life:.18,drag:3})},
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
