// WORLD GENERATOR: pure maths (no three.js). Same seed => same world, so a save slot only has to remember the seed.
//   biomes : REGIONS. A forest region always sits in the middle (the spawn is in it). Around it, jungle / savanna / desert regions are placed on a ring
//            and a second, outer ring; every cell belongs to its nearest region (a warped Voronoi diagram) with a narrow soft border.
//            Stone highlands are mountain patches in the outer part of the world plus a mountain ring at the edge.
//   rivers : traced downhill from high ground with meanders, the water level only ever drops downstream, the valley is carved around it.
//            A river that gets stuck in a basin ends in an irregular lake (never a circle). Rivers and lakes keep away from the spawn.
//   output : height grid (1 unit), water-level grid, biome weights, river centre lines, lakes, spawn point + sampling helpers
import {NB,STONE,FOREST,JUNGLE,SAVANNA,DESERT} from './biomes.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t,sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const tick=()=>new Promise(r=>setTimeout(r,0));

function mkNoise(seed){
  const s=(seed>>>0)||1;
  const hh=(i,j)=>{let h=(Math.imul(i,374761393)+Math.imul(j,668265263)+Math.imul(s,2147483647))|0;h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return(h>>>0)/4294967296};
  const sn=(x,y)=>{const i=Math.floor(x),j=Math.floor(y),fx=x-i,fy=y-j,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
    return lerp(lerp(hh(i,j),hh(i+1,j),u),lerp(hh(i,j+1),hh(i+1,j+1),u),v)};
  const fbm=(x,y,o=4)=>{let a=.5,t=0,n=0;for(let i=0;i<o;i++){t+=a*sn(x,y);n+=a;x=x*2.03+7.1;y=y*2.03+3.7;a*=.5}return t/n};
  return{sn,fbm};
}
export const mulberry=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};

const BORDER=7;     // softness of a region border in world units (smaller = sharper border, about 5x this many units wide)

/** generate(seed,{size,onProgress}) -> world. onProgress(0..1,'text') is optional; the function yields to the browser between stages. */
export async function generateWorld(seed,{size=800,onProgress=()=>{}}={}){
  const {sn,fbm}=mkNoise(seed),R=mulberry(seed^0x9e3779b9);
  const W=size,H=size,HW=W/2,HH=H/2,GS=1,MG=40,X0=-(HW+MG),Z0=-(HH+MG),NX=W+2*MG,NZ=H+2*MG,N=(NX+1)*(NZ+1),idx=(i,j)=>j*(NX+1)+i;
  const ox=R()*500,oz=R()*500;

  // ---------------------------------------------------------------- 0. region sites (the "capitals" of the regions)
  const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=(R()*(i+1))|0;[a[i],a[j]]=[a[j],a[i]]}return a};
  const sites=[{x:0,z:0,b:FOREST,s:1.8}];                                                             // the forest region is in the middle and the biggest one
  const a0=R()*6.283185;
  shuffle([JUNGLE,SAVANNA,DESERT]).forEach((b,i)=>{const a=a0+i*2.0944+(R()-.5)*.4,r=HW*(.5+R()*.08);sites.push({x:Math.cos(a)*r,z:Math.sin(a)*r,b,s:1})});
  shuffle([FOREST,JUNGLE,SAVANNA,DESERT,SAVANNA]).forEach((b,i)=>{const a=a0+1.0472+i*1.2566+(R()-.5)*.3,r=HW*(.8+R()*.08);sites.push({x:Math.cos(a)*r,z:Math.sin(a)*r,b,s:1.1})});

  // ---------------------------------------------------------------- 1. biome weights
  onProgress(.04,'Painting the regions…');await tick();
  const bw=new Float32Array(N*NB),edge=new Float32Array(N),sc=new Float32Array(sites.length),wb=new Float32Array(NB);
  for(let j=0;j<=NZ;j++){
    for(let i=0;i<=NX;i++){
      const x=X0+i,z=Z0+j,wx=x+(fbm(x*.008+ox,z*.008,3)-.5)*110,wz=z+(fbm(x*.008,z*.008+oz,3)-.5)*110;     // domain warp: curvy borders
      let m=1e9;for(let s=0;s<sites.length;s++){const S=sites[s],v=Math.hypot(wx-S.x,wz-S.z)/S.s;sc[s]=v;if(v<m)m=v}
      wb.fill(0);let sum=0;for(let s=0;s<sites.length;s++){const w=Math.exp(-(sc[s]-m)/BORDER);wb[sites[s].b]+=w;sum+=w}
      const mt=fbm(wx*.006+31.7,wz*.006-12.4,3),rad=Math.hypot(x,z),e=Math.max(Math.abs(x)-(HW-28),Math.abs(z)-(HH-28),0),em=sstep(0,26,e);
      const k=idx(i,j)*NB,st=Math.max(sstep(.66,.8,mt)*sstep(HW*.32,HW*.48,rad),em);                       // mountain patches never reach the middle
      for(let b=0;b<NB;b++)bw[k+b]=b===STONE?st:wb[b]/sum*(1-st);
      edge[idx(i,j)]=em}
    if(j%60===0)await tick()}

  // ---------------------------------------------------------------- 2. height field (before water)
  onProgress(.2,'Raising mountains and valleys…');await tick();
  const base=new Float32Array(N);
  const hBiome=[
    (x,z)=>(fbm(x*.012+ox,z*.012,4)-.5)*16+3,                                                    // forest: rolling hills
    (x,z)=>(fbm(x*.016,z*.016+oz,4)-.5)*22+4,                                                    // rainforest: steeper
    (x,z)=>(fbm(x*.008+5,z*.008,3)-.5)*7+1.5,                                                    // savanna: wide plains
    (x,z)=>{const n=fbm(x*.009,z*.009+7,3);return(n-.5)*6+Math.abs(Math.sin(x*.045+n*7))*2.4},  // desert: dunes
    (x,z)=>{const n=fbm(x*.014+2,z*.014,5),r=1-Math.abs(2*n-1);return r*r*24+4}                  // stone: ridged peaks
  ];
  const hSpawn=hBiome[FOREST](0,0);                                                              // the starting clearing is gentle (like forestMap)
  for(let j=0;j<=NZ;j++){
    for(let i=0;i<=NX;i++){
      const x=X0+i,z=Z0+j,k=idx(i,j);let h=0;
      for(let b=0;b<NB;b++){const w=bw[k*NB+b];if(w>.002)h+=w*hBiome[b](x,z)}
      h+=(sn(x*.16,z*.16)-.5)*.5+edge[k]*edge[k]*12*(.6+fbm(x*.03,z*.03,3));                      // soft ring of mountains closes the world
      h=lerp(h,hSpawn,1-sstep(10,30,Math.hypot(x,z)));
      const outside=Math.max(Math.abs(x)-HW-6,Math.abs(z)-HH-6,0);base[k]=h*(1-sstep(0,26,outside))}
    if(j%60===0)await tick()}
  const sampleG=(a,x,z)=>{const fx=clamp(x-X0,0,NX-.001),fz=clamp(z-Z0,0,NZ-.001),i=fx|0,j=fz|0,u=fx-i,v=fz-j,k=j*(NX+1)+i;
    return lerp(lerp(a[k],a[k+1],u),lerp(a[k+NX+1],a[k+NX+2],u),v)};
  const B=(x,z)=>sampleG(base,x,z);

  // ---------------------------------------------------------------- 3. rivers + lakes
  onProgress(.4,'Carving rivers…');await tick();
  const rivers=[],lakes=[],LIM=HW-38,KEEP=34;                                                    // KEEP: rivers / lakes stay this far from the spawn
  const lakeAt=(x,z,r,L)=>lakes.push({x,z,r,L,a:R()*50,b:R()*50});
  // start points: the highest spots that are well apart from each other (rivers start in the hills / mountains)
  const starts=[];
  for(let t=0;t<900;t++){const x=(R()*2-1)*LIM*.85,z=(R()*2-1)*LIM*.85;if(Math.hypot(x,z)>60)starts.push([x,z,B(x,z)])}
  starts.sort((a,b)=>b[2]-a[2]);
  const picked=[];for(const s of starts){if(picked.length>=9)break;if(picked.every(p=>Math.hypot(p[0]-s[0],p[1]-s[1])>110))picked.push(s)}
  picked.forEach((s,ri)=>{
    let x=s[0],z=s[1],dx=-(B(s[0]+6,s[1])-B(s[0]-6,s[1])),dz=-(B(s[0],s[1]+6)-B(s[0],s[1]-6)),l=Math.hypot(dx,dz);if(l<1e-3){dx=R()*2-1;dz=R()*2-1;l=Math.hypot(dx,dz)||1}dx/=l;dz/=l;   // start by flowing downhill
    const pts=[];let best=B(x,z),stall=0,end='edge';
    for(let i=0;i<700;i++){
      const e=4+stall*.12,gx=(B(x+e*2,z)-B(x-e*2,z))/(4*e),gz=(B(x,z+e*2)-B(x,z-e*2))/(4*e),gl=Math.hypot(gx,gz),pull=Math.min(1,gl*9);
      let wx=gl>1e-4?-gx/gl:dx,wz=gl>1e-4?-gz/gl:dz;
      const m=(sn(i*.07+ri*13.1,ri*3.7)-.5)*2,px=-dz,pz=dx;                                       // meander: wander sideways
      const odx=dx,odz=dz;let ndx=dx*.84+wx*.16*pull+px*m*.12,ndz=dz*.84+wz*.16*pull+pz*m*.12;l=Math.hypot(ndx,ndz)||1;ndx/=l;ndz/=l;
      const da=clamp(Math.atan2(odx*ndz-odz*ndx,odx*ndx+odz*ndz),-.13,.13),ca=Math.cos(da),sa=Math.sin(da);dx=odx*ca-odz*sa;dz=odx*sa+odz*ca;   // gentle bends only: no spirals
      x+=dx*2.2;z+=dz*2.2;
      if(Math.hypot(x,z)<KEEP){end='cross';break}                                                  // never flow through the spawn clearing
      let crossed=false;for(let q=0;q<pts.length-28;q++)if(Math.hypot(pts[q].x-x,pts[q].z-z)<6){crossed=true;break}
      if(crossed){end='cross';break}
      pts.push({x,z});
      const h=B(x,z);if(h<best-.03){best=h;stall=0}else if(++stall>85){end='basin';break}
      if(Math.abs(x)>LIM||Math.abs(z)>LIM){end='edge';break}}
    if(pts.length<30)return;
    // water level: smoothed ground height along the path, never rising downstream, always a little below the start
    const n=pts.length,Lv=new Float32Array(n);
    for(let i=0;i<n;i++){let t=0,c=0;for(let q=-3;q<=3;q++){const p=pts[clamp(i+q,0,n-1)];t+=B(p.x,p.z);c++}Lv[i]=t/c}
    Lv[0]-=.6;for(let i=1;i<n;i++)Lv[i]=Math.min(Lv[i-1]-.012,Lv[i]-.05);
    for(let i=0;i<n;i++){const t=i/(n-1);pts[i].w=(1.7+t*2.6)*(.85+.3*sn(i*.12,ri*5.5));pts[i].L=Lv[i]}
    rivers.push({pts});
    const last=pts[n-1];lakeAt(last.x,last.z,end==='basin'?9+R()*7:5+R()*3,last.L)});
  // some lakes of their own in low flat places
  for(let t=0,made=0;t<200&&made<6;t++){const x=(R()*2-1)*LIM*.8,z=(R()*2-1)*LIM*.8;
    if(Math.hypot(x,z)<KEEP+16||lakes.some(l=>Math.hypot(l.x-x,l.z-z)<80))continue;
    const g=Math.hypot(B(x+6,z)-B(x-6,z),B(x,z+6)-B(x,z-6))/12;if(g>.25||B(x,z)>9)continue;lakeAt(x,z,8+R()*8,B(x,z)-.3);made++}

  // signed distance to the nearest water edge + that water's level, per cell
  onProgress(.55,'Flooding the valleys…');await tick();
  const sd=new Float32Array(N).fill(1e9),wl=new Float32Array(N);
  const mark=(cx,cz,reach,fn)=>{const i0=Math.max(0,Math.floor(cx-reach-X0)),i1=Math.min(NX,Math.ceil(cx+reach-X0)),j0=Math.max(0,Math.floor(cz-reach-Z0)),j1=Math.min(NZ,Math.ceil(cz+reach-Z0));
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const x=X0+i,z=Z0+j,s=fn(x,z),k=idx(i,j);if(s.sd<sd[k]){sd[k]=s.sd;wl[k]=s.L}}};
  for(const rv of rivers){const P=rv.pts;
    for(let i=0;i<P.length-1;i++){const a=P[i],b=P[i+1],steps=3;
      for(let q=0;q<steps;q++){const t=q/steps,px=lerp(a.x,b.x,t),pz=lerp(a.z,b.z,t),w=lerp(a.w,b.w,t),L=lerp(a.L,b.L,t);
        mark(px,pz,w+11,(x,z)=>({sd:Math.hypot(x-px,z-pz)-w,L}))}}
    await tick()}
  const lakeR=(l,th)=>l.r*(.78+.45*sn(Math.cos(th)*1.7+l.a,Math.sin(th)*1.7+l.b)+.18*sn(Math.cos(th)*4.3+l.b,Math.sin(th)*4.3+l.a));
  lakes.forEach(l=>mark(l.x,l.z,l.r*1.6+11,(x,z)=>({sd:Math.hypot(x-l.x,z-l.z)-lakeR(l,Math.atan2(z-l.z,x-l.x)),L:l.L})));

  // ---------------------------------------------------------------- 4. final ground: carve the valleys, raise banks, record water
  onProgress(.7,'Shaping the shores…');await tick();
  const terr=new Float32Array(N),waterL=new Float32Array(N).fill(-1e4);
  for(let k=0;k<N;k++){let h=base[k];const s=sd[k];
    if(s<9){const L=wl[k];h=lerp(h,L+.35,1-sstep(0,9,s));h=lerp(h,L-1.3,sstep(.5,-2.5,s));if(s<-.3)waterL[k]=L}
    terr[k]=h}
  const heightAtT=(x,z)=>sampleG(terr,x,z);

  // ---------------------------------------------------------------- 5. texture data for the ground shader + spawn
  onProgress(.82,'Choosing where you wake up…');await tick();
  const dom=new Uint8Array(N);
  for(let k=0;k<N;k++){let bi=0,bv=-1;for(let b=0;b<NB;b++){const w=bw[k*NB+b];if(w>bv){bv=w;bi=b}}dom[k]=bi}
  const tex1=new Uint8Array(N*4),tex2=new Uint8Array(N*4);               // tex1: forest,jungle,savanna,desert weights  tex2: stone weight, shore, river-bank mud
  for(let k=0;k<N;k++){for(let b=0;b<4;b++)tex1[k*4+b]=Math.round(clamp(bw[k*NB+b],0,1)*255);
    tex2[k*4]=Math.round(clamp(bw[k*NB+4],0,1)*255);tex2[k*4+1]=Math.round(clamp((sd[k]+3)/12,0,1)*255);tex2[k*4+2]=0;tex2[k*4+3]=255}
  // spawn: always inside the forest region, as close to the middle as possible, flat and dry
  let spawn={x:0,z:0},found=false;
  for(let r=0;r<150&&!found;r+=4)for(let a=0,na=r?12:1;a<na&&!found;a++){const x=Math.cos(a*.5236)*r,z=Math.sin(a*.5236)*r,k=idx(Math.round(x-X0),Math.round(z-Z0));
    const g=Math.hypot(heightAtT(x+2,z)-heightAtT(x-2,z),heightAtT(x,z+2)-heightAtT(x,z-2))/4;
    if(bw[k*NB+FOREST]>.8&&sd[k]>14&&g<.22){spawn={x,z};found=true}}

  const world={seed,W,H,HW,HH,x0:X0,z0:Z0,nx:NX,nz:NZ,gs:GS,margin:MG,terr,waterL,bw,dom,tex1,tex2,rivers,lakes,spawn,sites,
    lakeR,
    terrainAt:heightAtT,
    /** surface the player stands on: water is wadeable, a bit below the surface */
    heightAt:(x,z)=>{const t=heightAtT(x,z),w=sampleG(waterL,x,z);return w>-1e3&&w>t?Math.max(t,w-.3):t},
    /** water level at x,z or null */
    waterAt:(x,z)=>{const t=heightAtT(x,z),k=idx(clamp(Math.round(x-X0),0,NX),clamp(Math.round(z-Z0),0,NZ));return waterL[k]>-1e3&&waterL[k]>t+.02?waterL[k]:null},
    shoreDist:(x,z)=>sampleG(sd,x,z),
    biomeAt:(x,z)=>dom[idx(clamp(Math.round(x-X0),0,NX),clamp(Math.round(z-Z0),0,NZ))],
    /** biome weights at x,z written into out[0..NB-1] */
    weightsAt:(x,z,out)=>{const k=idx(clamp(Math.round(x-X0),0,NX),clamp(Math.round(z-Z0),0,NZ))*NB;for(let b=0;b<NB;b++)out[b]=bw[k+b];return out},
    slopeAt:(x,z,e=1.2)=>Math.hypot(heightAtT(x+e,z)-heightAtT(x-e,z),heightAtT(x,z+e)-heightAtT(x,z-e))/(2*e)};
  onProgress(.9,'World ready');await tick();
  return world;
}