// Axe: an ornate bearded battle axe. Hand-built geometry, vertex colours only (polished steel, walnut haft, dark leather, gold inlay).
//   - head   : a custom meshed PLATE (see plate()). The outline is triangulated with holes (a trefoil + two crescents), refined to an even density,
//              then lifted into a thickness field: a hollow-ground bevel on the cutting edge, a thick rolled back and beaded hole rims.
//              Colour = mirror bevel, steel face that darkens toward the eye, gold inlay line, engraved border + scrollwork.
//   - fluke  : the long swept back-pick (faceted loft, gold centre inlay), balances the crescent blade
//   - spike  : the big faceted spear point on top (star-fluted octagon loft) on an ornate collar
//   - socket : ornate steel boss around the eye (swell + gold rings), two langets running down the haft, gold rivets
//   - haft   : lathed oval walnut shaft with a flared knob and a steel butt cap, leather grip between two gold collars
// The weapon points along -Y: grip at the origin, the knob behind the hand, the head near y = -.77, the spike tip at y = -1.64. The edge faces +X, the fluke goes -X.
import * as T from 'three';
import {PI,clamp,lerp,sm,C,grid,bands,lathe,tube,ball,cap,vn,goldCol,metalMat,softMat,woodMat,addMesh} from './wlib.js';

const SIZE=1.35,LEN=1.15,ROLL=Math.PI/2;   // SIZE: overall scale. LEN: extra stretch along the length only. ROLL: turns the weapon about its own length so the broad face is seen from the side (same as Wooden Sword / Katana; edge points down, -Math.PI/2 flips it up)
const WOOD=C('#5a3921'),WOOD_L=C('#8a5b36'),LEATHER=C('#241b1c'),STITCH=C('#3d302d'),GOLD=C('#c9a24a'),GOLD_D=C('#8f6f2a');
const BEVEL=C('#f3f6fb'),FACE=C('#a3adc0'),DARKF=C('#4f566a'),BACK=C('#3b4152'),STEEL_D=C('#6e788d'),STEEL=C('#aab3c4');
const ss=(a,b,x)=>sm(clamp((x-a)/(b-a),0,1));

// ---- haft
const haftR=u=>.0205-.0022*clamp(u/1.1,0,1)+.0075*Math.exp(-Math.pow((u+.275)/.035,2));
const hp=[[-.305,0],[-.302,.013],[-.294,.021]];for(let u=-.27;u<=1.095;u+=.04)hp.push([u,haftR(u)]);hp.push([1.1,.0165],[1.103,0]);
const woodCol=(u,r,th,c)=>{const g=.5+.5*Math.sin(th*7+Math.sin(u*9)*1.3);c.copy(WOOD).lerp(WOOD_L,clamp(g*.5+.35*vn(u*14,th*1.3),0,1))};
const GU0=-.22,GU1=.22;
const grip=grid(70,32,(t,th,o)=>{
  const u=lerp(GU0,GU1,t),k=cap(t,.02),w=Math.sin(u*85+th*2),r=(haftR(u)+.0032+.0011*Math.max(0,w))*k;
  o.p=[r*Math.cos(th),-u,r*Math.sin(th)*.82];o.c.copy(LEATHER).lerp(STITCH,clamp(w*1.2-.2,0,1)*.8)});
const collar=u0=>{const r=haftR(u0)+.0042;return lathe([[u0,0],[u0,r],[u0+.005,r+.0025],[u0+.017,r+.0025],[u0+.022,r],[u0+.022,0]],{col:goldCol,seg:32,ez:.82})};

// ---- plate mesher: a flat outline (with holes) in a 2D domain, lifted into a solid with a thickness field.
//   contour / holes : arrays of [s,w] points.  h : the longest edge allowed after refinement.
//   fn(s,w,o)       : o.p=[x,y,halfThickness], o.c=Color.   Returns a part {pos,col,idx} for merge() / addMesh().
// Steps: 1) ear-clip triangulation with holes  2) conforming refinement (every edge longer than h is bisected, shared edges share their midpoint,
// so there are no cracks)  3) top + bottom surfaces  4) a rim wall on every boundary edge (own vertices: crisp edge, smooth around the curve).
function plate(contour,holes,h,fn){
  const V=[...contour,...holes.flat()],v2=p=>new T.Vector2(p[0],p[1]);
  let F=T.ShapeUtils.triangulateShape(contour.map(v2),holes.map(hh=>hh.map(v2)));
  const mid=new Map(),mp=(i,j)=>{const k=i<j?i*1048576+j:j*1048576+i;let m=mid.get(k);if(m===undefined){m=V.length;V.push([(V[i][0]+V[j][0])/2,(V[i][1]+V[j][1])/2]);mid.set(k,m)}return m};
  const L=(i,j)=>Math.hypot(V[i][0]-V[j][0],V[i][1]-V[j][1]);
  for(let pass=0;pass<14;pass++){
    let ch=false;const N=[];
    for(const T3 of F){
      const[a,b,c]=T3,e0=L(a,b)>h,e1=L(b,c)>h,e2=L(c,a)>h,n=e0+e1+e2;
      if(!n){N.push(T3);continue}ch=true;
      if(n===3){const x=mp(a,b),y=mp(b,c),z=mp(c,a);N.push([a,x,z],[x,b,y],[z,y,c],[x,y,z])}
      else if(n===1){const k=e0?0:e1?1:2,p=T3[k],q=T3[(k+1)%3],r=T3[(k+2)%3],m=mp(p,q);N.push([p,m,r],[m,q,r])}
      else{const k=!e0?0:!e1?1:2,w2=T3[k],w0=T3[(k+1)%3],w1=T3[(k+2)%3],m1=mp(w0,w1),m2=mp(w1,w2);N.push([m1,w1,m2],[w0,m1,m2],[w0,m2,w2])}   // k = the unsplit edge (w2,w0)
    }
    F=N;if(!ch)break}
  let A=0;for(const[a,b,c]of F)A+=(V[b][0]-V[a][0])*(V[c][1]-V[a][1])-(V[c][0]-V[a][0])*(V[b][1]-V[a][1]);
  if(A>0)F=F.map(([a,b,c])=>[a,c,b]);              // clockwise in the domain = counter-clockwise (normal +z) in the weapon frame
  const n=V.length,pos=new Array(n*6),col=new Array(n*6),idx=[],X=new Array(n),Y=new Array(n),Z=new Array(n),o={p:[0,0,0],c:new T.Color()};
  for(let i=0;i<n;i++){fn(V[i][0],V[i][1],o);X[i]=o.p[0];Y[i]=o.p[1];Z[i]=o.p[2];
    pos[i*3]=X[i];pos[i*3+1]=Y[i];pos[i*3+2]=Z[i];pos[(n+i)*3]=X[i];pos[(n+i)*3+1]=Y[i];pos[(n+i)*3+2]=-Z[i];
    for(const k of[i,n+i]){col[k*3]=o.c.r;col[k*3+1]=o.c.g;col[k*3+2]=o.c.b}}
  const dir=new Set();
  for(const[a,b,c]of F){idx.push(a,b,c,n+a,n+c,n+b);dir.add(a*1048576+b);dir.add(b*1048576+c);dir.add(c*1048576+a)}
  const wall=new Map(),wv=i=>{let k=wall.get(i);if(k===undefined){k=pos.length/3;wall.set(i,k);
    pos.push(X[i],Y[i],Z[i],X[i],Y[i],-Z[i]);for(let q=0;q<2;q++)col.push(col[i*3]*.8,col[i*3+1]*.8,col[i*3+2]*.8)}return k};
  for(const[a,b,c]of F)for(const[i,j]of[[a,b],[b,c],[c,a]])if(!dir.has(j*1048576+i)){const ti=wv(i),tj=wv(j);idx.push(ti,ti+1,tj+1,ti,tj+1,tj)}   // outward-facing rim wall
  return{pos,col,idx}}

// ---- head shape. Domain = (s = height along the haft u, w = depth from the cutting edge x WD).
//   t runs beard tip (0) ... top horn (1); xe(t) = how far the edge sticks out, dep(t) = fraction of that which is solid web.
const HU0=.46,HU1=1.08,HM=.77,WD=.30;
const xe=t=>.07+.25*Math.pow(Math.sin(PI*t),.8)+.04*Math.pow(1-t,3);
const dep=t=>Math.pow(Math.sin(PI*t),.5);
const toDom=(x,u)=>{const t=(u-HU0)/(HU1-HU0),E=xe(t);return[u,(E-x)/(E*dep(t))*WD]};      // weapon (x,u) -> plate domain (s,w)

// cut-outs, designed in weapon space (x,u): a trefoil in the eye and two crescents either side of it
const trefoil=(cx,cy,n=64)=>{const p=[];for(let i=0;i<n;i++){const a=i/n*2*PI,r=.013+.023*Math.pow(Math.abs(Math.cos(1.5*a)),.8);p.push([cx+r*Math.cos(a),cy+r*Math.sin(a)])}return p};
function lune(cx,cy,R,r,d,ang,n=36){      // crescent = disc R minus disc r pushed d along ang; the thick part faces away from ang
  const pa=ang,al=Math.acos((R*R+d*d-r*r)/(2*R*d)),be=Math.acos((r*r+d*d-R*R)/(2*r*d)),px=cx+d*Math.cos(pa),py=cy+d*Math.sin(pa),pb=pa+PI,pts=[];
  for(let i=0;i<=n;i++){const a=pa+al+(2*PI-2*al)*i/n;pts.push([cx+R*Math.cos(a),cy+R*Math.sin(a)])}
  for(let i=1;i<n;i++){const a=pb+be-2*be*i/n;pts.push([px+r*Math.cos(a),py+r*Math.sin(a)])}
  return pts}
const HOLES_W=[trefoil(.15,HM),lune(.14,HM+.16,.055,.044,.028,PI+.45),lune(.14,HM-.16,.055,.044,.028,PI-.45)];
const dseg=(px,py,ax,ay,bx,by)=>{const dx=bx-ax,dy=by-ay,t=clamp(((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(px-ax-dx*t,py-ay-dy*t)};
const dpoly=(x,u,P)=>{let m=9;for(let i=0,n=P.length;i<n;i++){const a=P[i],b=P[(i+1)%n];m=Math.min(m,dseg(x,u,a[0],a[1],b[0],b[1]))}return m};
const SCROLLS=[[.15,.535,1],[.15,1.005,-1]];     // engraved spirals: x, u, turning direction

function headAt(s,w,o){
  const t=clamp((s-HU0)/(HU1-HU0),0,1),v=clamp(w/WD,0,1),E=xe(t),dp=dep(t),D=E*dp,x=E-v*D,d=v*D,u=s;
  let dh=9;for(const P of HOLES_W)dh=Math.min(dh,dpoly(x,u,P));
  // thickness: hollow-ground bevel on the cutting edge, thick rolled back near the eye, a bead around every hole
  const tm=.012+.008*ss(.35,1,v)*Math.min(1,dp*1.1);
  const f=.0022+(tm-.0022)*ss(0,.06,d)+.0045*(1-ss(0,.022,dh));
  o.p=[x,-u,f];
  // colour
  const c=o.c;
  c.copy(FACE).lerp(DARKF,ss(.5,1,v)*.55*clamp(dp*1.2,0,1));
  c.multiplyScalar(.95+.08*vn(u*70,x*5));                                                  // faint brushed grain
  c.lerp(BEVEL,1-ss(0,.05,d));                                                              // mirror bevel on the edge
  c.lerp(GOLD,(1-clamp(Math.abs(d-.075)/.007,0,1))*.95*ss(.2,.5,dp));                       // gold inlay following the edge
  c.multiplyScalar(1-.4*(1-clamp(Math.abs(d-.095)/.004,0,1)));                              // engraved border groove
  for(const[sx,su,sg]of SCROLLS){const dx=x-sx,du=u-su,r=Math.hypot(dx,du);
    if(r<.075&&d>.11&&dh>.02){const m=Math.pow(.5+.5*Math.cos(r*85-sg*2*Math.atan2(du,dx)),10);c.multiplyScalar(1-.45*m*ss(.075,.05,r)*ss(.11,.14,d))}}   // scrollwork
  c.multiplyScalar(.7+.3*ss(0,.012,dh));                                                    // shadowed hole rims
}
const contour=(()=>{const P=[],edge=(a,b)=>{const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.12);for(let i=0;i<n;i++)P.push([lerp(a[0],b[0],i/n),lerp(a[1],b[1],i/n)])};
  const c=[[HU0,0],[HU1,0],[HU1,WD],[HU0,WD]];for(let i=0;i<4;i++)edge(c[i],c[(i+1)%4]);return P})();

// ---- fluke: the swept back pick (loft along a curved centreline, tapering to a needle point)
const FL=.40;
function flukeSec(t){
  const x=-.03-FL*t,u=HM+.2*Math.pow(t,2.1),dx=-FL,du=.2*2.1*Math.pow(t,1.1),l=Math.hypot(dx,du),nx=-du/l,nu=dx/l;
  const w=.075*Math.pow(1-t,.75)*(.55+.45*ss(0,.25,t))+.0006,tz=.016*Math.pow(1-t,.8)*(1-.3*t)+.0006,P=(a,z)=>[x+nx*a,-(u+nu*a),z];
  return[P(w,0),P(.5*w,tz),P(-.5*w,tz),P(-w,0),P(-.5*w,-tz),P(.5*w,-tz)];
}
function flukeCol(t,k,s,c){
  if(k===1||k===4){c.copy(FACE).lerp(DARKF,.25*t);c.lerp(GOLD,(1-clamp(Math.abs(s-.5)/.07,0,1))*.9*ss(.05,.2,t)*(1-ss(.75,.95,t)));c.multiplyScalar(1-.25*Math.pow(Math.max(0,Math.sin(t*70)),12)*(1-ss(.8,.95,t)));return}
  const q=(k===0||k===3)?s:1-s;c.copy(BEVEL).lerp(FACE,ss(0,1,q))}

// ---- spike: big faceted spear point (octagon with alternating radii = fluted facets)
const SP0=1.14,SP1=1.64;
function spikeSec(t){
  const u=SP0+t*(SP1-SP0),r=.0235*Math.pow(1-t,.9)*(1+.35*Math.sin(PI*Math.min(1,t*3.2))*(1-t))+.0004,p=[];
  for(let i=0;i<8;i++){const a=i/8*2*PI+PI/8,rr=r*(i%2?.74:1);p.push([rr*Math.cos(a),-u,rr*Math.sin(a)*.9])}return p}
function spikeCol(t,k,s,c){c.copy(k%2?STEEL_D:STEEL).lerp(BEVEL,.25+.55*t*t+.2*s*(k%2?0:1))}

export default {
  id:'axe',name:'Battle Axe',kind:'melee',handling:'sword',great:'shoulder',fore:[-.3,0],
  stats:{range:2.5,arc:-.1,dmg:5.5,dur:.68,dash:.8,move:.92},
  build(){
    const g=new T.Group();
    addMesh(g,[lathe(hp,{col:woodCol,seg:36,ez:.82})],woodMat({roughness:.55}));
    addMesh(g,[grip],softMat({roughness:.85}));
    addMesh(g,[plate(contour,HOLES_W.map(P=>P.map(([x,u])=>toDom(x,u))),.018,headAt),bands(44,4,flukeSec,flukeCol),bands(48,1,spikeSec,spikeCol)],metalMat({metalness:.6,roughness:.22}));
    const stCol=(u,r,th,c)=>c.copy(STEEL_D).lerp(STEEL,.4+.3*Math.sin(th));
    const sockCol=(u,r,th,c)=>{stCol(u,r,th,c);if(u<.625||u>.915||Math.abs(u-.77)<.014)c.copy(GOLD).lerp(GOLD_D,.25+.2*Math.sin(th*2))};
    const trim=[collar(GU0-.012),collar(GU1-.01),
      lathe([[.60,0],[.60,.030],[.614,.0365],[.64,.0375],[.655,.032],[.675,.0315],[.70,.036],[.72,.044],[.745,.0525],[.77,.0555],[.795,.0525],[.82,.044],[.84,.036],[.865,.0315],[.885,.032],[.90,.0375],[.926,.0365],[.94,.030],[.94,0]],{col:sockCol,seg:40,ez:.95}),   // ornate socket boss
      lathe([[1.085,0],[1.085,.027],[1.10,.0335],[1.115,.0315],[1.125,.024],[1.14,.0265],[1.15,.0245],[1.16,.019],[1.17,0]],{col:goldCol,seg:28,ez:.9}),                                                        // spike collar
      lathe([[-.40,0],[-.395,.006],[-.36,.0135],[-.33,.0185],[-.31,.0225],[-.298,.0225],[-.298,0]],{col:stCol,seg:24,ez:.85})];                                                                                   // butt cap
    for(const sx of[1,-1])trim.push(tube([[sx*(haftR(.5)+.0015),-.60,0],[sx*(haftR(.35)+.0015),-.33,0]],{rx:.0035,rz:t=>.011*(1-.55*t*t),col:C('#7a859b'),n:3,per:4,nth:12,end:.15}));   // langets
    for(const sd of[1,-1])for(const u of[.69,.85])trim.push(ball([.08,-u,sd*.019],.0075,GOLD,[1,1,.6]));                                                                                                          // rivets
    addMesh(g,trim,metalMat());
    g.scale.set(SIZE,SIZE*LEN,SIZE);g.rotation.y=ROLL;
    return {group:g};
  }
};
