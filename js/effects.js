// Gunfire effects: cone-shaped muzzle flash (crossed star planes) + shock ring + hot sparks + gas/smoke + lingering wisps,
// ejected brass that bounces, glowing tracer rounds with streak tails and smoke trails, spark/debris/shock-ring impacts, dust, death puffs.
import * as T from 'three';
const cv=(w,h,draw)=>{const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t};
const glowTex=cv(64,64,(g)=>{const r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.35,'rgba(255,255,255,.55)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,64,64)});
const ringTex=cv(64,64,(g)=>{const r=g.createRadialGradient(32,32,18,32,32,31);r.addColorStop(0,'rgba(255,255,255,0)');r.addColorStop(.6,'rgba(255,255,255,.95)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,64,64)});
// muzzle blast: hot core on the left, long tapered cone to the right, small side spikes
const flashTex=cv(256,128,(g,w,h)=>{g.clearRect(0,0,w,h);
  const cone=g.createLinearGradient(20,0,w,0);cone.addColorStop(0,'rgba(255,255,255,1)');cone.addColorStop(.25,'rgba(255,230,150,.95)');cone.addColorStop(.7,'rgba(255,140,40,.55)');cone.addColorStop(1,'rgba(255,90,0,0)');
  g.fillStyle=cone;g.beginPath();g.moveTo(20,h/2-18);g.quadraticCurveTo(110,h/2-14,w,h/2-1);g.lineTo(w,h/2+1);g.quadraticCurveTo(110,h/2+14,20,h/2+18);g.closePath();g.fill();
  [[1,.38],[-1,.38]].forEach(([s,k])=>{g.fillStyle='rgba(255,210,120,.8)';g.beginPath();g.moveTo(30,h/2);g.quadraticCurveTo(70,h/2+s*50*k*2,120,h/2+s*58);g.quadraticCurveTo(80,h/2+s*14,30,h/2);g.fill()});
  const core=g.createRadialGradient(34,h/2,0,34,h/2,38);core.addColorStop(0,'rgba(255,255,255,1)');core.addColorStop(1,'rgba(255,200,90,0)');g.fillStyle=core;g.fillRect(0,0,100,h)});
// bullet tail: bright at the round, fading backwards
const tailTex=cv(16,64,(g,w,h)=>{const r=g.createLinearGradient(0,0,0,h);r.addColorStop(0,'rgba(255,255,255,0)');r.addColorStop(1,'rgba(255,255,255,1)');g.fillStyle=r;g.fillRect(0,0,w,h)});

const sc={},ac={},gm={},
  SA=(c,tx=glowTex)=>{const k=c+tx.uuid;return sc[k]||(sc[k]=new T.SpriteMaterial({map:tx,color:c,blending:T.AdditiveBlending,depthWrite:false,transparent:true}))},    // additive sprite
  SN=(c,o=.55)=>{const k='n'+c+o;return sc[k]||(sc[k]=new T.SpriteMaterial({map:glowTex,color:c,depthWrite:false,transparent:true,opacity:o}))},                       // normal-blend sprite (smoke)
  BA=c=>ac[c]||(ac[c]=new T.MeshBasicMaterial({color:c,blending:T.AdditiveBlending,depthWrite:false,transparent:true})),
  GM=c=>gm[c]||(gm[c]=new T.MeshBasicMaterial({color:c}));
const ball=new T.SphereGeometry(1,8,6),shell=new T.CylinderGeometry(.025,.025,.1,6),streakG=new T.BoxGeometry(.016,.016,1),chip=new T.BoxGeometry(1,1,1),
  flashG=new T.PlaneGeometry(1.5,.62),tailG=new T.PlaneGeometry(.16,1.9).rotateX(-Math.PI/2).translate(0,0,-.95),
  rnd=(a,b)=>a+Math.random()*(b-a),Z=new T.Vector3(0,0,1),_v=new T.Vector3();

export function createFX(scene){
  const list=[],light=new T.PointLight('#ffb040',0,8,2);scene.add(light);let lt=0;
  const add=(m,o)=>{scene.add(m);const q=Object.assign({m,vx:0,vy:0,vz:0,g:0,life:.4,s0:1,grow:0,spin:0,drag:0,delay:0,st:0},o);q.max=q.life;if(q.delay>0)m.visible=false;list.push(q);return q};
  const sprite=(mat,p,o)=>{const s=new T.Sprite(mat);s.position.copy(p);return add(s,o)};
  const dot=(p,c,s,v,o)=>{const m=new T.Mesh(ball,GM(c));m.position.copy(p);add(m,Object.assign({s0:s,vx:rnd(-v,v),vy:rnd(0,v),vz:rnd(-v,v),g:9,life:rnd(.2,.4)},o))};
  const streak=(p,c,vx,vy,vz,o)=>{const m=new T.Mesh(streakG,BA(c));m.position.copy(p);add(m,Object.assign({vx,vy,vz,st:1,len:.28,s0:1,life:rnd(.14,.3),g:7},o))};
  const smoke=(p,vx,vy,vz,o)=>sprite(SN('#c9c9c9',.5),p,Object.assign({s0:.22,grow:3.2,vx,vy,vz,drag:2.2,life:rnd(.5,.9)},o));
  const ring=(p,c,s,grow,life)=>sprite(SA(c,ringTex),p,{s0:s,grow,life});
  return{
    // ---------------------------------------------------------------- shot
    muzzle(p,a){const dx=Math.sin(a),dz=Math.cos(a),f=new T.Vector3(p.x+dx*.12,p.y,p.z+dz*.12);
      const g=new T.Group();g.position.copy(f);g.rotation.y=a-Math.PI/2;                                   // local +x = firing direction
      [0,1].forEach(k=>{const m=new T.Mesh(flashG,new T.MeshBasicMaterial({map:flashTex,blending:T.AdditiveBlending,depthWrite:false,transparent:true,side:T.DoubleSide}));
        m.position.x=.7;if(!k)m.rotation.x=-Math.PI/2;g.add(m)});
      add(g,{life:.07,s0:rnd(.85,1.15)});
      sprite(SA('#ffffff'),f,{life:.05,s0:.7});sprite(SA('#ffa030'),f,{life:.1,s0:1.6});                     // core + soft bloom
      ring(f,'#ffd9a0',.35,6,.14);                                                                        // shock ring
      for(let i=0;i<12;i++){const sp=rnd(7,17),ang=a+rnd(-.38,.38);streak(f,i%3?'#ffd060':'#fff3c0',Math.sin(ang)*sp,rnd(-.5,2),Math.cos(ang)*sp,{len:rnd(.18,.4),g:5,life:rnd(.1,.22),drag:1.5})}
      for(let i=0;i<5;i++){const ang=a+rnd(-.5,.5);smoke(f,Math.sin(ang)*rnd(2,5),rnd(.3,1.1),Math.cos(ang)*rnd(2,5),{s0:rnd(.16,.26)})}      // muzzle gas
      for(let i=0;i<3;i++)smoke(f,dx*.2+rnd(-.2,.2),rnd(.8,1.5),dz*.2+rnd(-.2,.2),{delay:.07+i*.06,life:rnd(.9,1.4),s0:.12,grow:4})            // wisps rising off the barrel
      const c=new T.Mesh(shell,GM('#e6c25a'));c.position.copy(p);add(c,{s0:1,vx:dz*rnd(2,3.2)+rnd(-.3,.3),vy:rnd(2.8,4),vz:-dx*rnd(2,3.2)+rnd(-.3,.3),g:16,spin:20,life:1.1,bounce:1,keep:1});
      light.position.copy(f);lt=.09},
    // ---------------------------------------------------------------- bullet in flight
    bullet(col='#ffe066'){const g=new T.Group();
      const core=new T.Mesh(new T.CapsuleGeometry(.05,.34,3,8),GM('#ffffff'));core.rotation.x=Math.PI/2;g.add(core);
      const t1=new T.Mesh(tailG,new T.MeshBasicMaterial({map:tailTex,color:col,blending:T.AdditiveBlending,depthWrite:false,transparent:true,side:T.DoubleSide})),t2=t1.clone();t2.rotation.z=Math.PI/2;g.add(t1,t2);
      const glow=new T.Sprite(SA(col));glow.scale.set(.75,.75,1);g.add(glow);return g},
    trail(p,vx=0,vz=0,col='#ffd54a'){const sp=Math.hypot(vx,vz)||1;
      if(Math.random()<.7)sprite(SA(col),p,{life:.13,s0:.28});
      if(Math.random()<.35)smoke(p,rnd(-.3,.3),rnd(.1,.5),rnd(-.3,.3),{s0:.1,grow:3,life:rnd(.35,.6)})},
    // ---------------------------------------------------------------- impacts
    hit(p,c='#ffe066',n=6){
      for(let i=0;i<n*2;i++){const a=rnd(0,6.283),sp=rnd(3,9);streak(p,i%2?c:'#fff3c0',Math.cos(a)*sp,rnd(1,6),Math.sin(a)*sp,{len:rnd(.14,.32),g:12,life:rnd(.15,.32)})}
      for(let i=0;i<Math.ceil(n/2);i++){const m=new T.Mesh(chip,GM(c));m.position.copy(p);add(m,{s0:rnd(.03,.06),vx:rnd(-3,3),vy:rnd(1,4),vz:rnd(-3,3),g:14,spin:rnd(8,20),life:rnd(.3,.5),bounce:1})}
      sprite(SA('#fff3b0'),p,{life:.1,s0:.9});ring(p,c,.25,5,.16);smoke(p,0,.4,0,{s0:.15,life:.45})},
    dust(p,c='#bfae82'){for(let i=0;i<5;i++)sprite(SN(c,.55),p,{s0:rnd(.15,.26),grow:2.6,vx:rnd(-1.4,1.4),vy:rnd(.6,1.8),vz:rnd(-1.4,1.4),drag:2,life:rnd(.4,.7)});
      for(let i=0;i<6;i++){const a=rnd(0,6.283),sp=rnd(2,6);streak(p,'#e8dcb0',Math.cos(a)*sp,rnd(1,4),Math.sin(a)*sp,{len:.14,g:12,life:.25})}},
    shock(p,c='#ffe0a0'){ring(p,c,.7,11,.4);ring(p,'#ffffff',.4,7,.25);for(let i=0;i<14;i++){const a=i/14*6.283;sprite(SN('#bfae82',.6),p,{s0:rnd(.2,.32),grow:2.6,vx:Math.cos(a)*rnd(3,5),vy:rnd(.3,1),vz:Math.sin(a)*rnd(3,5),drag:2.4,life:rnd(.5,.8)});
        streak(p,'#e8dcb0',Math.cos(a)*rnd(5,9),rnd(1,4),Math.sin(a)*rnd(5,9),{len:.2,g:12,life:.3})}},
    puff(p,c,n=10){for(let i=0;i<n;i++)dot(p,c,rnd(.1,.2),4,{vy:rnd(1,4),life:rnd(.4,.7),grow:0});for(let i=0;i<5;i++)dot(p,'#ffffff',.06,5);
      sprite(SA(c),p,{life:.25,s0:1.8});ring(p,c,.4,6,.3)},
    update(dt){lt=Math.max(0,lt-dt);light.intensity=lt>0?4.5*lt/.09:0;
      for(let i=list.length-1;i>=0;i--){const q=list[i],m=q.m;
        if(q.delay>0){q.delay-=dt;if(q.delay>0)continue;m.visible=true}
        q.life-=dt;if(q.life<=0){scene.remove(m);list.splice(i,1);continue}
        if(q.drag){const f=Math.exp(-q.drag*dt);q.vx*=f;q.vy*=f;q.vz*=f}
        m.position.x+=q.vx*dt;m.position.y+=q.vy*dt;m.position.z+=q.vz*dt;q.vy-=q.g*dt;
        if(q.bounce&&m.position.y<.04){m.position.y=.04;q.vy=Math.abs(q.vy)*.3;q.vx*=.5;q.vz*=.5;q.spin*=.3}
        const k=q.life/q.max;
        if(q.st){_v.set(q.vx,q.vy,q.vz);const sp=_v.length();if(sp>.01)m.quaternion.setFromUnitVectors(Z,_v.multiplyScalar(1/sp));m.scale.set(k,k,Math.max(.01,q.len*(.3+.7*k)*Math.min(1.6,.4+sp*.1)));continue}
        m.rotation.x+=q.spin*dt;
        const s=q.s0*(1+(1-k)*q.grow)*(q.grow?Math.min(1,k*2):(q.keep?Math.min(1,k*3):k));
        if(m.isSprite)m.scale.set(s,s,1);else m.scale.setScalar(Math.max(s,.001))}}
  };
}