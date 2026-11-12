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

const BORDER=4;     // softness of a region border in world units (smaller = sharper border, about 5x this many units wide)

/** generate(seed,{size,onProgress}) -> world. onProgress(0..1,'text') is optional; the function yields to the browser between stages. */
export async function generateWorld(seed,{size=800,onProgress=()=>{}}={}){
  const {sn,fbm}=mkNoise(seed),R=mulberry(seed^0x9e3779b9);
  const W=size,H=size,HW=W/2,HH=H/2,GS=1,MG=40,X0=-(HW+MG),Z0=-(HH+MG),NX=W+2*MG,NZ=H+2*MG,N=(NX+1)*(NZ+1),idx=(i,j)=>j*(NX+1)+i;
  const ox=R()*500,oz=R()*500,SEA=0;
  const landR=(x,z)=>Math.hypot(x/HW,z/HH)*(1+(fbm(x*.011+ox*.2,z*.011+oz*.2,3)-.5)*.34);   // island radius metric: <.7 land, .7-.88 coast, beyond = sea

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
      const k=idx(i,j)*NB,st=sstep(.66,.8,mt)*sstep(HW*.32,HW*.48,rad)*(1-sstep(.6,.78,Math.hypot(x/HW,z/HH)));                       // mountain patches never reach the middle
      for(let b=0;b<NB;b++)bw[k+b]=b===STONE?st:wb[b]/sum*(1-st);
      edge[idx(i,j)]=0}
    if(j%60===0)await tick()}

  // ---------------------------------------------------------------- 2. height field (before water)
  onProgress(.2,'Raising mountains and valleys…');await tick();
  const base=new Float32Array(N);
  const hBiome=[
    // A SHORT HIKE STYLE: small, busy landforms (higher noise frequency = hills / knolls / ledges are small next to the cat), plus terraces and rifts below
    (x,z)=>(fbm(x*.026+ox,z*.026,4)-.5)*20+3,                                                    // forest: lots of small knolls
    (x,z)=>(fbm(x*.032,z*.032+oz,4)-.5)*26+4,                                                    // rainforest: steeper
    (x,z)=>(fbm(x*.018+5,z*.018,3)-.5)*10+1.5,                                                   // savanna: low mesas + plains
    (x,z)=>{const n=fbm(x*.02,z*.02+7,3);return(n-.5)*8+Math.abs(Math.sin(x*.07+n*7))*2.4},     // desert: dunes
    (x,z)=>{const n=fbm(x*.026+2,z*.026,5),r=1-Math.abs(2*n-1);return r*r*26+4}                  // stone: ridged peaks
  ];
  const TERRACE=3.4;                                                                             // height of one cliff step (world units)
  const hSpawn=Math.max(2,hBiome[FOREST](0,0));                                                              // the starting clearing is gentle (like forestMap)
  for(let j=0;j<=NZ;j++){
    for(let i=0;i<=NX;i++){
      const x=X0+i,z=Z0+j,k=idx(i,j);let h=0;
      for(let b=0;b<NB;b++){const w=bw[k*NB+b];if(w>.002)h+=w*hBiome[b](x,z)}
      h+=edge[k]*edge[k]*12*(.6+fbm(x*.03,z*.03,3));                      // soft ring of mountains closes the world
      {const far=sstep(26,62,Math.hypot(x,z)),inner=1-edge[k];                                    // the spawn clearing stays gentle
       // CLIFF TERRACES: in patches (mask) the slopes are squeezed into flat shelves with steep rock faces between them
       const tm=sstep(.36,.6,fbm(x*.03+91,z*.03-40,3)),q=h/TERRACE,fl=Math.floor(q),t=clamp((q-fl-.5)*4.5+.5,0,1);
       h=lerp(h,(fl+t*t*(3-2*t))*TERRACE,tm*far*.92);
       // small ledges + rock bumps everywhere
       h+=(fbm(x*.09+13,z*.09,3)-.5)*2.2*far;
       // RIFTS: the winding contour of a noise field is cut into a narrow ravine (a few units wide, ~9 deep)
       const rr=Math.abs(fbm(x*.021+ox*.3,z*.021+oz*.3,3)-.5)*2,rift=(1-sstep(.03,.1,rr))*far*inner;
       h-=rift*9}
      h=lerp(h,hSpawn,1-sstep(10,30,Math.hypot(x,z)));
      const mask=1-sstep(.8,.96,landR(x,z));base[k]=lerp(SEA-5,h+4,mask)}   // ISLAND: land in the middle, sloping down into the sea
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
  for(let t=0;t<900;t++){const x=(R()*2-1)*LIM*.85,z=(R()*2-1)*LIM*.85;if(Math.hypot(x,z)>60&&landR(x,z)<.66)starts.push([x,z,B(x,z)])}
  starts.sort((a,b)=>b[2]-a[2]);
  const picked=[];for(const s of starts){if(picked.length>=7)break;if(picked.every(p=>Math.hypot(p[0]-s[0],p[1]-s[1])>115))picked.push(s)}
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
      if(lakes.some(l=>Math.hypot(l.x-x,l.z-z)<l.r*1.5+10)){end='cross';break}                      // a stream never runs through another lake
      pts.push({x,z});
      const h=B(x,z);if(h<best-.03){best=h;stall=0}else if(++stall>85){end='basin';break}
      if(B(x,z)<SEA+.4&&landR(x,z)>.6){end='sea';break}if(Math.abs(x)>LIM||Math.abs(z)>LIM){end='edge';break}}
    if(pts.length<30)return;
    // water level: smoothed ground height along the path, never rising downstream, always a little below the start
    const n=pts.length,Lv=new Float32Array(n);
    for(let i=0;i<n;i++){let t=0,c=0;for(let q=-3;q<=3;q++){const p=pts[clamp(i+q,0,n-1)];t+=B(p.x,p.z);c++}Lv[i]=t/c}
    Lv[0]-=.6;for(let i=1;i<n;i++)Lv[i]=Math.min(Lv[i-1]-.012,Lv[i]-.05);
    // WATERFALLS: wherever the stream crosses a cliff the water level drops in one step (the carved valley follows it, so the water really pours over a ledge)
    {let lastF=-99;for(let i=4;i<n-5;i++){if(i-lastF>14&&Lv[i-3]-Lv[i+3]>2.2){const hi=Lv[i-3],lo=Lv[i+3];
      for(let j=i-2;j<i;j++)Lv[j]=hi-.02*(j-i+3);for(let j=i;j<=i+2;j++)Lv[j]=lo+.02*(i+2-j);pts[i].fall=true;lastF=i}}}
    for(let i=0;i<n;i++){const t=i/(n-1);pts[i].w=(1.7+t*1.0)*(.85+.3*sn(i*.12,ri*5.5));pts[i].L=Lv[i]}
    rivers.push({pts});
    const last=pts[n-1],lr=end==='basin'?14+R()*10:end==='cross'?5+R()*2:0;if(lr)lakeAt(last.x,last.z,lr,last.L)});   // a stream that reaches the sea just ends in it
  // some lakes of their own in low flat places
  for(let t=0,made=0;t<500&&made<8;t++){const x=(R()*2-1)*LIM*.8,z=(R()*2-1)*LIM*.8;
    if(Math.hypot(x,z)<KEEP+16||landR(x,z)>.62||lakes.some(l=>Math.hypot(l.x-x,l.z-z)<52)||rivers.some(r=>r.pts.some(p=>Math.hypot(p.x-x,p.z-z)<30)))continue;
    const g=Math.hypot(B(x+6,z)-B(x-6,z),B(x,z+6)-B(x,z-6))/12;if(g>.4||B(x,z)>13)continue;lakeAt(x,z,11+R()*13,B(x,z)-.3);made++}

  // signed distance to the nearest water edge + that water's level, per cell
  onProgress(.55,'Flooding the valleys…');await tick();
  const sd=new Float32Array(N).fill(1e9),wl=new Float32Array(N);
  // OCEAN: every cell below sea level that connects to the map border is sea (dips inland stay dry). A distance field to the coastline feeds the same sd / wl as lakes.
  const sea=new Uint8Array(N),qu=new Int32Array(N);let qh=0,qt=0;
  const sp=k=>{if(!sea[k]&&base[k]<SEA){sea[k]=1;qu[qt++]=k}};
  for(let i=0;i<=NX;i++){sp(idx(i,0));sp(idx(i,NZ))}for(let j=0;j<=NZ;j++){sp(idx(0,j));sp(idx(NX,j))}
  while(qh<qt){const k=qu[qh++],i=k%(NX+1),j=(k/(NX+1))|0;if(i>0)sp(k-1);if(i<NX)sp(k+1);if(j>0)sp(k-NX-1);if(j<NZ)sp(k+NX+1)}
  const cham=isSeed=>{const d=new Float32Array(N);for(let k=0;k<N;k++)d[k]=isSeed(k)?0:1e6;
    for(let j=0;j<=NZ;j++)for(let i=0;i<=NX;i++){const k=idx(i,j);let v=d[k];if(i>0)v=Math.min(v,d[k-1]+1);if(j>0){v=Math.min(v,d[k-NX-1]+1);if(i>0)v=Math.min(v,d[k-NX-2]+1.4142);if(i<NX)v=Math.min(v,d[k-NX]+1.4142)}d[k]=v}
    for(let j=NZ;j>=0;j--)for(let i=NX;i>=0;i--){const k=idx(i,j);let v=d[k];if(i<NX)v=Math.min(v,d[k+1]+1);if(j<NZ){v=Math.min(v,d[k+NX+1]+1);if(i<NX)v=Math.min(v,d[k+NX+2]+1.4142);if(i>0)v=Math.min(v,d[k+NX]+1.4142)}d[k]=v}
    return d};
  {const dLand=cham(k=>sea[k]===1),dSea=cham(k=>sea[k]===0);
   for(let k=0;k<N;k++){const o=sea[k]?-(dSea[k]-.5):(dLand[k]-.5);if(o<sd[k]){sd[k]=o;wl[k]=SEA}}}
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
    if(s<5){const L=wl[k];h=lerp(h,L+.35,1-sstep(0,5,s));h=lerp(h,L-1.6,sstep(.6,-1.2,s));   // narrower banks + a channel deep enough that the 2-unit terrain grid always holds the water
    if(s<-.3)waterL[k]=L}
    if(sea[k]&&s<-.3)h=Math.min(h,SEA-1.3-Math.min(5,Math.max(0,-s-2.5)*.08));   // the sea floor drops away from the beach
    terr[k]=h}
  // LOW-POLY TERRAIN: the surface is a mesh of TS x TS unit cells, each split into 2 flat triangles along the P10-P01 diagonal (ground.js builds the very same triangles),
  // so trees / grass / the player stand exactly on the visible facets.
  const TS=2;
  const heightAtT=(x,z)=>{const fx=clamp((x-X0)/TS,0,NX/TS-.0001),fz=clamp((z-Z0)/TS,0,NZ/TS-.0001),i=fx|0,j=fz|0,u=fx-i,v=fz-j,k=(j*TS)*(NX+1)+i*TS,
    a=terr[k],b=terr[k+TS],c=terr[k+TS*(NX+1)],d=terr[k+TS*(NX+1)+TS];
    return u+v<=1?a+u*(b-a)+v*(c-a):d+(1-u)*(c-d)+(1-v)*(b-d)};

  // ---------------------------------------------------------------- 5. texture data for the ground shader + spawn
  onProgress(.82,'Choosing where you wake up…');await tick();
  const dom=new Uint8Array(N);
  for(let k=0;k<N;k++){let bi=0,bv=-1;for(let b=0;b<NB;b++){const w=bw[k*NB+b];if(w>bv){bv=w;bi=b}}dom[k]=bi}
  const tex1=new Uint8Array(N*4),tex2=new Uint8Array(N*4);               // tex1: forest,jungle,savanna,desert weights  tex2: stone weight, shore, river-bank mud
  for(let k=0;k<N;k++){for(let b=0;b<4;b++)tex1[k*4+b]=Math.round(clamp(bw[k*NB+b],0,1)*255);
    tex2[k*4]=Math.round(clamp(bw[k*NB+4],0,1)*255);tex2[k*4+1]=Math.round(clamp((sd[k]+3)/12,0,1)*255);tex2[k*4+2]=sea[k]?255:0;tex2[k*4+3]=255}
  // spawn: always inside the forest region, as close to the middle as possible, flat and dry
  let spawn={x:0,z:0},found=false;
  for(let r=0;r<150&&!found;r+=4)for(let a=0,na=r?12:1;a<na&&!found;a++){const x=Math.cos(a*.5236)*r,z=Math.sin(a*.5236)*r,k=idx(Math.round(x-X0),Math.round(z-Z0));
    const g=Math.hypot(heightAtT(x+2,z)-heightAtT(x-2,z),heightAtT(x,z+2)-heightAtT(x,z-2))/4;
    if(bw[k*NB+FOREST]>.8&&sd[k]>14&&g<.22){spawn={x,z};found=true}}

  const world={seed,W,H,HW,HH,x0:X0,z0:Z0,nx:NX,nz:NZ,gs:GS,ts:TS,margin:MG,terr,waterL,bw,dom,tex1,tex2,rivers,lakes,spawn,sites,
    lakeR,sea:SEA,landR,
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
