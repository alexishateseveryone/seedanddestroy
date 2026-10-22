// Seedler: a wooden revolver grown, not built. Grain-painted frame, fluted cylinder loaded with seeds, bark-ridged barrel with a
// vine wrapped round it, a forked-branch grip, and a drawstring sack of overlapping leaves tied over the muzzle.
// Everything is custom procedural meshing: noise-displaced bark, vertex-coloured wood grain, and hand-built leaf grids.
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {side,lathe,tube,mk,matte,muzzleTip} from './proc.js';

// ---------------------------------------------------------------- noise + painting helpers
const h3=(x,y,z)=>{const s=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453;return s-Math.floor(s)};
const vn=(x,y,z)=>{const xi=Math.floor(x),yi=Math.floor(y),zi=Math.floor(z),xf=x-xi,yf=y-yi,zf=z-zi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf),w=zf*zf*(3-2*zf),l=(a,b,t)=>a+(b-a)*t;
  return l(l(l(h3(xi,yi,zi),h3(xi+1,yi,zi),u),l(h3(xi,yi+1,zi),h3(xi+1,yi+1,zi),u),v),l(l(h3(xi,yi,zi+1),h3(xi+1,yi,zi+1),u),l(h3(xi,yi+1,zi+1),h3(xi+1,yi+1,zi+1),u),v),w)};
const fbm=(x,y,z)=>vn(x,y,z)*.6+vn(x*2.1,y*2.1,z*2.1)*.28+vn(x*4.3,y*4.3,z*4.3)*.12;
const C=(h)=>new T.Color(h),mix=(a,b,t)=>a.clone().lerp(b,Math.max(0,Math.min(1,t)));
const paint=(geo,fn)=>{const p=geo.attributes.position,n=geo.attributes.normal,col=new Float32Array(p.count*3),c=new T.Color();
  for(let i=0;i<p.count;i++){fn(c,p.getX(i),p.getY(i),p.getZ(i),n?n.getX(i):0,n?n.getY(i):0,n?n.getZ(i):1);col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b}
  geo.setAttribute('color',new T.BufferAttribute(col,3));return geo};
const dense=(prof,step=.022)=>{const o=[];for(let i=0;i<prof.length-1;i++){const [u0,r0]=prof[i],[b,s]=prof[i+1],n=Math.max(1,Math.ceil(Math.abs(b-u0)/step));for(let k=0;k<n;k++){const t=k/n;o.push([u0+(b-u0)*t,r0+(s-r0)*t])}}o.push(prof[prof.length-1]);return o};
// wood grain: long rings that wander with the noise (axis = Y)
const WOODS=[C('#b97b3e'),C('#7d4a22'),C('#3f2210')];
const grain=(geo,fq=9,tone=0)=>paint(geo,(c,x,y,z)=>{const w=fbm(x*3,y*.8,z*3),r=.5+.5*Math.sin((x*5+z*7+w*3.2)*fq+y*3),k=Math.pow(r,1.3);c.copy(mix(WOODS[0],WOODS[1],k*1.15+tone));if(w>.55)c.lerp(WOODS[2],(w-.55)*2.6)});
// bark: noise displaced along the radial direction in long ridges, dark in the grooves
const bark=(geo,amp=.012,fq=20,flute=0)=>{const p=geo.attributes.position,col=new Float32Array(p.count*3),c=new T.Color();
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),r=Math.hypot(x,z)||1,rx=x/r,rz=z/r,
      n=fbm(x*fq*3,y*fq*.5,z*fq*3),ridge=Math.abs(Math.sin(Math.atan2(z,x)*7+y*9+n*6)),d=amp*(n-.45)*2+amp*.5*ridge+(flute?flute*Math.cos(6*Math.atan2(z,x)):0);
    p.setXYZ(i,x+rx*d,y,z+rz*d);c.copy(mix(C('#33190a'),C('#9a6232'),.1+n*.9+ridge*.2));col.set([c.r,c.g,c.b],i*3)}
  geo.setAttribute('color',new T.BufferAttribute(col,3));geo.computeVertexNormals();return geo};
const barkTube=(pts,r,amp=.008,seg=48)=>{const g=tube(pts,r,seg,10);
  // TubeGeometry: displace along its own normals
  const p=g.attributes.position,nn=g.attributes.normal,col=new Float32Array(p.count*3),c=new T.Color();
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),n=fbm(x*45,y*10,z*45),d=amp*(n-.42)*2;p.setXYZ(i,x+nn.getX(i)*d,y+nn.getY(i)*d,z+nn.getZ(i)*d);c.copy(mix(C('#33190a'),C('#9a6232'),.1+n*1.1));col.set([c.r,c.g,c.b],i*3)}
  g.setAttribute('color',new T.BufferAttribute(col,3));g.computeVertexNormals();return g};

// painted wood-grain texture (long streaks, a few knots). Flat carved parts use it as-is; lathes get a copy rotated so the grain runs along them.
const mkGrainTex=(rot)=>{try{const cv=document.createElement('canvas');cv.width=512;cv.height=256;const g=cv.getContext('2d');g.fillStyle='#f2d9b8';g.fillRect(0,0,512,256);
  let sd=7;const rnd=()=>{sd=(sd*16807)%2147483647;return sd/2147483647};
  for(let i=0;i<150;i++){const y=rnd()*256,th=.6+rnd()*2.6,a=.1+rnd()*.32,ph=rnd()*6,amp=1+rnd()*4;g.strokeStyle=`rgba(${70+rnd()*40|0},${38+rnd()*20|0},12,${a})`;g.lineWidth=th;g.beginPath();
    for(let x=0;x<=512;x+=8)g.lineTo(x,y+Math.sin(x*.02+ph)*amp+Math.sin(x*.05+ph*2)*amp*.4);g.stroke()}
  for(let k=0;k<3;k++){const x=rnd()*512,y=rnd()*256;for(let r=1;r<9;r++){g.strokeStyle=`rgba(80,42,14,${.35-r*.03})`;g.lineWidth=1.6;g.beginPath();g.ellipse(x,y,r*8,r*3.2,0,0,6.3);g.stroke()}}
  const t=new T.CanvasTexture(cv);t.wrapS=t.wrapT=T.RepeatWrapping;t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;if(rot){t.center.set(.5,.5);t.rotation=Math.PI/2}return t}catch(e){return null}};

// ---------------------------------------------------------------- leaves: a grid mesh (7 across x 9 along), folded along the midrib, curled at the tip
function leafGeo(L=1,W=.42,curl=.3,fold=.35){
  const N=9,M=3,pos=[],col=[],idx=[],c=new T.Color(),dark=C('#245f2a'),mid=C('#3f9a3a'),lite=C('#8fd14f'),rib=C('#c9ec86');
  for(let iy=0;iy<=N;iy++){const t=iy/N,w=W*Math.sin(Math.PI*Math.pow(t,.72))*(1+.08*Math.sin(t*9));
    for(let ix=-M;ix<=M;ix++){const s=ix/M,x=s*w,y=t*L,z=fold*Math.abs(x)*(1-t*.4)+curl*t*t*L;pos.push(x,y,z);
      c.copy(mix(mix(dark,mid,t*1.4),lite,t*t*.8));if(Math.abs(ix)<=0)c.lerp(rib,.55);else if(Math.abs(ix)===1)c.lerp(rib,.08);
      c.multiplyScalar(.86+.28*Math.abs(s));col.push(c.r,c.g,c.b)}}
  const row=2*M+1;for(let iy=0;iy<N;iy++)for(let ix=0;ix<row-1;ix++){const a=iy*row+ix,b=a+1,d=a+row,e=d+1;idx.push(a,b,d,b,e,d)}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('color',new T.Float32BufferAttribute(col,3));g.setIndex(idx);g.computeVertexNormals();return g}
const LEAFS=[leafGeo(1,.42,.34),leafGeo(1,.34,.2,.45),leafGeo(1,.5,.42,.25)];
const _m=new T.Matrix4(),_x=new T.Vector3(),_y=new T.Vector3(),_z=new T.Vector3(),_o=new T.Vector3();
const place=(list,li,pos,dir,out,len,wid,roll=0)=>{_y.copy(dir).normalize();_z.copy(out).addScaledVector(_y,-out.dot(_y)).normalize();
  if(roll){_x.crossVectors(_y,_z);_z.addScaledVector(_x,Math.sin(roll)).normalize()}
  _x.crossVectors(_y,_z).normalize();_m.makeBasis(_x.multiplyScalar(wid),_y.clone().multiplyScalar(len),_z.clone().multiplyScalar(wid));_m.setPosition(pos);
  list.push(LEAFS[li%3].clone().applyMatrix4(_m))};

export default {
  id:'seedler',name:'Seedler',kind:'gun',handling:'pistol',lean:0,
  stats:{cd:.26,dmg:1,spread:.07,speed:30,auto:true,kick:.9,shake:.1,push:.9,zoom:44,color:'#9bd14a',move:1,pellets:2,size:1.1,life:.9,mag:12, reload:1.1},
  build(){
    const g=new T.Group();
    const tF=mkGrainTex(false),tR=mkGrainTex(true);if(tF)tF.repeat.set(3,5);if(tR)tR.repeat.set(5,3);
    const wood=new T.MeshStandardMaterial({vertexColors:true,roughness:.8,metalness:.02,map:tF}),woodR=new T.MeshStandardMaterial({vertexColors:true,roughness:.8,metalness:.02,map:tR}),woodP=new T.MeshStandardMaterial({vertexColors:true,roughness:.8}),leaf=new T.MeshStandardMaterial({vertexColors:true,roughness:.5,metalness:0,side:T.DoubleSide}),
      sackM=new T.MeshStandardMaterial({vertexColors:true,roughness:.7}),dark=matte('#120d08',.9),seedM=matte('#d8c458',.5),rope=matte('#b99a5a',.8),moss=matte('#4f9a3c',.9),capM=matte('#d8443a',.6),stemM=matte('#f1e6c8',.7),petal=matte('#fff6e0',.6),gold=matte('#ffcf2e',.5);
    const AX=.09;   // height of the barrel / sack axis

    // ---- frame, grain painted (same revolver silhouette as a real six-shooter, but chunkier and carved)
    mk(grain(side([[-.18,.12],[-.1,.16],[.04,.165],[.17,.14],[.4,.135],[.4,.05],[.17,.04],[.1,-.03],[-.1,-.03],[-.18,.0]],.085,{smooth:3,bevel:.012}),9),wood,g);
    mk(grain(side([[-.12,.16],[-.02,.2],[.1,.19],[.2,.15],[.1,.15]],.05,{smooth:2,bevel:.008}),12,.15),wood,g);                       // raised top strap
    mk(grain(side([[.3,.095],[.44,.085],[.44,.0],[.3,.01]],.098,{smooth:2,bevel:.01}),7,.2),wood,g);                                    // forward block carrying the barrel

    // ---- cylinder: fluted, ringed, six chambers with a seed in each
    const cyl=lathe(dense([[.1,.1],[.12,.112],[.37,.112],[.385,.1]],.018),44);bark(cyl,.005,30,.014);paint(cyl,(c,x,y,z)=>{const w=fbm(x*5,y*1.2,z*5);c.copy(mix(WOODS[1],WOODS[0],w*1.3))});
    mk(cyl,woodR,g,[0,0,.04]);
    [.12,.375].forEach(u=>mk(barkTube(Array.from({length:25},(_,i)=>{const a=i/24*Math.PI*2;return[Math.sin(a)*.113,-u,.04+Math.cos(a)*.113]}),.011,.003,48),wood,g));   // wooden hoops
    for(let i=0;i<6;i++){const a=i/6*Math.PI*2,x=Math.sin(a)*.068,z=.04+Math.cos(a)*.068;
      mk(new T.CircleGeometry(.03,16),dark,g,[x,-.388,z],[Math.PI/2,0,0]);
      mk(new T.SphereGeometry(1,10,8),seedM,g,[x,-.378,z],[0,0,0],[.019,.024,.019]).rotation.z=a;}                                    // seeds peeking out
    mk(new T.CircleGeometry(.036,14),dark,g,[0,-.388,.04],[Math.PI/2,0,0]);mk(new T.CylinderGeometry(.02,.02,.04,10),wood,g,[0,-.392,.04],[Math.PI/2,0,0]);   // arbor pin

    // ---- barrel: bark-ridged, tapering, with collars, an ejector twig and a vine winding round it
    const bar=lathe(dense([[.38,.056],[.5,.052],[.66,.05],[.8,.05],[.86,.056]],.016),36);bark(bar,.011,22);mk(bar,woodR,g,[0,0,AX]);
    [.5,.62,.74].forEach((u,i)=>mk(barkTube(Array.from({length:19},(_,k)=>{const a=k/18*Math.PI*2;return[Math.sin(a)*.056,-u,AX+Math.cos(a)*.056]}),.009,.003,36),wood,g));
    mk(barkTube([[.0,-.4,.02],[.0,-.6,.02],[.0,-.78,.025]],.012,.004),wood,g);                                                          // ejector twig under the barrel
    mk(barkTube([[.0,-.38,.052],[.0,-.58,.05],[.0,-.7,.052]],.016,.004),wood,g);
    const vine=[];for(let i=0;i<=44;i++){const t=i/44,a=t*Math.PI*6.2,y=-(.42+t*.34),r=.062+.006*Math.sin(t*20);vine.push([Math.sin(a)*r,y,AX+Math.cos(a)*r])}
    mk(tube(vine,.0095,90,6),leaf,g).geometry=paint(tube(vine,.0095,90,6),(c,x,y)=>c.copy(mix(C('#2f7a32'),C('#6cbd45'),fbm(x*30,y*30,0))));
    for(let i=0;i<5;i++){const t=.12+i*.2,a=t*Math.PI*6.2,y=-(.42+t*.34),p=new T.Vector3(Math.sin(a)*.07,y,AX+Math.cos(a)*.07),o=new T.Vector3(Math.sin(a),0,Math.cos(a));
      const lg=[];place(lg,i,p,new T.Vector3(i%2?.5:-.5,-.5,0).add(o.clone().multiplyScalar(.9)),o,.09,.06,i);mk(mergeGeometries(lg),leaf,g)}   // little leaves on the vine
    mk(grain(side([[.7,.1],[.72,.15],[.78,.15],[.8,.1]],.02,{smooth:2,bevel:.004}),10),wood,g,[0,0,.0]);                                  // front sight bud-stand

    // ---- hammer (curled twig), trigger (thorn), vine trigger guard
    mk(barkTube([[0,.17,.14],[0,.24,.2],[0,.27,.27],[0,.2,.3],[0,.16,.25]],.016,.004,40),wood,g);
    mk(new T.SphereGeometry(1,12,10),leaf,g,[0,.155,.25],[0,0,0],.026).geometry=paint(new T.SphereGeometry(1,12,10),(c,x,y,z)=>c.copy(mix(C('#3f9a3a'),C('#9be84f'),(y+1)/2)));
    mk(new T.ConeGeometry(.02,.1,8),wood,g,[0,-.11,-.1],[Math.PI+.35,0,0]);
    const guard=[[0,-.0,-.03],[0,-.13,-.03],[0,-.22,-.09],[0,-.16,-.19],[0,-.06,-.19],[0,.01,-.12],[0,.03,-.05]];
    mk(barkTube(guard,.017,.004,60),wood,g);
    { const lg=[];place(lg,1,new T.Vector3(.0,-.2,-.1),new T.Vector3(.6,-.6,-.3),new T.Vector3(.8,0,.3),.1,.06,.3);place(lg,2,new T.Vector3(.0,-.2,-.1),new T.Vector3(-.5,-.5,-.5),new T.Vector3(-.8,0,.3),.09,.05,-.3);mk(mergeGeometries(lg),leaf,g)}

    // ---- grip: carved plate over a forked branch, with a cut end showing growth rings
    mk(grain(side([[-.1,-.03],[.04,-.03],[.0,-.12],[-.03,-.3],[-.18,-.33],[-.27,-.16],[-.2,.0]],.095,{smooth:3,bevel:.014}),11,.1),wood,g);
    mk(grain(side([[-.06,-.05],[.0,-.05],[-.03,-.2],[-.12,-.22],[-.19,-.12]],.108,{smooth:3,bevel:.008}),15,.3),wood,g);               // lighter carved inlay
    mk(barkTube([[.0,.16,-.28],[.0,.23,-.33],[.0,.28,-.33]],.03,.006),wood,g);                                                           // lopped branch stub at the heel
    { const r=.032,d=new T.CircleGeometry(r,26);paint(d,(c,x,yy)=>{const rr=Math.hypot(x,yy)/r;c.copy(mix(C('#e0b074'),C('#8a5428'),.5+.5*Math.sin(rr*26+fbm(x*40,yy*40,0)*2)))});
      const m=mk(d,woodP,g,[0,.292,-.33],[-Math.PI/2+.0,0,0]);m.rotation.set(Math.PI/2*-1,0,0);m.rotation.x=Math.PI/2;m.position.set(0,.292,-.33);m.scale.set(1,1,1);m.rotation.x=-Math.PI/2*-1;}   // growth rings on the cut end
    mk(new T.SphereGeometry(1,16,12),moss,g,[.0,.02,.17],[0,0,0],[.09,.06,.015]).position.set(.02,-.06,.19);                           // moss on the strap
    mk(new T.SphereGeometry(1,12,8),moss,g,[0,0,0],[0,0,0],[.04,.05,.02]).position.set(-.03,.1,.2);
    // a toadstool and a daisy growing out of the frame
    mk(new T.CylinderGeometry(.007,.01,.05,8),stemM,g,[.045,-.2,.17],[0,0,-.25]);mk(new T.SphereGeometry(1,12,8,0,Math.PI*2,0,Math.PI/2),capM,g,[.052,-.2,.195],[0,0,-.25],[.03,.022,.03]);
    for(let i=0;i<6;i++){const a=i/6*Math.PI*2;mk(new T.SphereGeometry(1,8,6),petal,g,[.047+Math.sin(a)*.018*.4,-.275+Math.cos(a)*.018,.12+Math.sin(a)*.0],[0,0,0],[.003,.011,.005]).rotation.x=a}
    mk(new T.SphereGeometry(1,8,6),gold,g,[.049,-.275,.12],[0,0,0],.007);

    // ---- the leaf sack on the muzzle: lumpy dark pouch, shingled with leaves, tied with a twisted drawstring, open mouth of leaves
    const u0=.8,len=.3,Rm=.2,rho=t=>Rm*Math.pow(Math.sin(Math.PI*(.05+.9*t)),.75)+.02;
    const sackG=lathe(dense([[u0,.03],[u0+len*.1,rho(.1)*.9],[u0+len*.5,rho(.5)*.92],[u0+len*.9,rho(.9)*.9],[u0+len,.07]],.016),36);
    paint(sackG,(c,x,y,z)=>c.copy(mix(C('#1f5a2a'),C('#2f7a35'),fbm(x*14,y*14,z*14))));
    { const p=sackG.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),r=Math.hypot(x,z)||1,d=(fbm(x*10,y*10,z*10)-.45)*.05;p.setXYZ(i,x+x/r*d,y,z+z/r*d)}sackG.computeVertexNormals()}
    mk(sackG,sackM,g,[0,0,AX]);
    const L1=[],rows=9;
    for(let i=0;i<rows;i++){const t=(i+.5)/rows,u=u0+t*len,r=rho(t),dr=(rho(Math.min(1,t+.05))-rho(Math.max(0,t-.05)))/(len*.1),n=Math.max(6,Math.round(r*46)),off=(i%2)*.5;
      for(let k=0;k<n;k++){const th=(k+off+(h3(i,k,1)-.5)*.5)/n*Math.PI*2,rh=new T.Vector3(Math.sin(th),0,Math.cos(th)),pos=new T.Vector3(rh.x*r,-u,AX+rh.z*r),
        dir=rh.clone().multiplyScalar(dr+.12+h3(i,k,2)*.12).add(new T.Vector3(0,-1,0));place(L1,i+k,pos,dir,rh,.12+h3(i,k,3)*.04,.085+h3(i,k,4)*.03,(h3(i,k,5)-.5)*.8)}}
    for(let i=0;i<5;i++){const t=(i+.7)/5.2,u=u0+t*len,r=rho(t)*1.0,n=Math.round(r*34);   // fluffy outer layer, lifted away
      for(let k=0;k<n;k++){const th=(k+.3+i*.37)/n*Math.PI*2,rh=new T.Vector3(Math.sin(th),0,Math.cos(th)),pos=new T.Vector3(rh.x*r,-u,AX+rh.z*r),
        dir=rh.clone().multiplyScalar(.5+h3(i,k,6)*.3).add(new T.Vector3(0,-1,0));place(L1,k+i,pos,dir,rh,.11+h3(i,k,7)*.04,.08,(h3(i,k,8)-.5)*1.1)}}
    mk(mergeGeometries(L1),leaf,g);
    // open mouth: ring of leaves curling forward around the muzzle hole
    const L2=[];for(let k=0;k<11;k++){const th=k/11*Math.PI*2,rh=new T.Vector3(Math.sin(th),0,Math.cos(th)),pos=new T.Vector3(rh.x*.075,-(u0+len-.01),AX+rh.z*.075);
      place(L2,k,pos,rh.clone().multiplyScalar(.35).add(new T.Vector3(0,-1,0)),rh,.07,.05,(h3(k,2,9)-.5)*.5)}mk(mergeGeometries(L2),leaf,g);
    mk(new T.CircleGeometry(.062,18),dark,g,[0,-(u0+len+.005),AX],[Math.PI/2,0,0]);mk(new T.SphereGeometry(1,10,8),seedM,g,[0,-(u0+len-.03),AX],[0,0,0],[.026,.036,.026]);   // dark mouth + seed ready to fire
    // drawstring: two twisted strands + knot + dangling ends
    [0,1.6].forEach(ph=>mk(tube(Array.from({length:61},(_,i)=>{const a=i/60*Math.PI*2;return[Math.sin(a)*(.066+.011*Math.sin(a*9+ph)),-(u0-.005),AX+Math.cos(a)*(.066+.011*Math.sin(a*9+ph))]}),.0085,120,6),rope,g));
    mk(new T.SphereGeometry(1,10,8),rope,g,[0,-(u0-.005),AX-.075],[0,0,0],.018);
    mk(tube([[.0,-(u0-.005),AX-.08],[.012,-(u0-.0),AX-.12],[.01,-(u0+.02),AX-.16]],.006,12,5),rope,g);mk(tube([[.0,-(u0-.005),AX-.08],[-.012,-(u0-.02),AX-.11],[-.02,-(u0-.03),AX-.15]],.006,12,5),rope,g);
    // tiny flower on the sack
    for(let i=0;i<7;i++){const a=i/7*Math.PI*2;mk(new T.SphereGeometry(1,8,6),petal,g,[.1+.003,-(u0+.12)+Math.cos(a)*.016,AX+.1+Math.sin(a)*.016],[0,0,0],[.004,.012,.006]).rotation.x=a}
    mk(new T.SphereGeometry(1,8,6),gold,g,[.103,-(u0+.12),AX+.1],[0,0,0],.008);
    return {group:g,tip:muzzleTip(g,u0+len+.03,AX)};
  }
};