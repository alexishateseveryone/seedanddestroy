// Peanut and Jelly: a baguette club. All geometry is built by hand (no primitives, no lathe helpers):
//   - the loaf        : a lofted tube with tapered ends, bumpy crust, diagonal score cuts (carved into the vertices) and flour dust
//   - the paper cover : a crumpled sleeve over the handle end, flared torn rim, twisted tuft at the butt, a printed red band
//   - peanut butter   : a thick rounded layer that sits on the loaf's top / tip and dips over the sides in drips
//   - pink jelly      : a glossy layer on top of the peanut butter with its own drips
//   - peanut bits     : crushed peanuts scattered on the peanut butter
// Colours are baked into vertex colours (no textures). The weapon points along -Y like every other weapon here: the grip is at the
// origin, the paper end is behind the hand (+Y) and the tip with the spread is at about y = -1.1.
import * as T from 'three';

const PI=Math.PI,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t,sm=t=>t*t*(3-2*t);
// tiny deterministic value noise; nz() wraps around the loaf so there is no seam
const h2=(x,y)=>{const s=Math.sin(x*127.1+y*311.7)*43758.5453;return s-Math.floor(s)};
const vn=(x,y)=>{const xi=Math.floor(x),yi=Math.floor(y),xf=sm(x-xi),yf=sm(y-yi);return lerp(lerp(h2(xi,yi),h2(xi+1,yi),xf),lerp(h2(xi,yi+1),h2(xi+1,yi+1),xf),yf)};
const nz=(t,th,fa,fk)=>vn(t*fa+Math.cos(th)*fk+11.3,Math.sin(th)*fk+5.7);
const rng=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};

// ---- layout (u runs from the paper end towards the tip; y = -u)
const U0=-.26,U1=1.10,L=U1-U0,R0=.112,FLAT=.84,TOP=PI/2;   // loaf start / end, length, max radius, squash of the cross-section, angle of the "top" side
const sdt=th=>Math.atan2(Math.sin(th-TOP),Math.cos(th-TOP));   // signed angle from the top side

// ---- colours
const C=h=>new T.Color(h);
const CR_L=C('#e8bd7a'),CR_D=C('#bf7a33'),FLOUR=C('#f4e4c4'),INNER=C('#f6deaa'),EAR=C('#9a5420');
const PAPER=C('#ebdfc4'),PAPER_D=C('#cdb88c'),RED=C('#c94b3b');
const PB_L=C('#a1561f'),PB_D=C('#6f3912'),JL_L=C('#ff8cbc'),JL_D=C('#e6367c');
const tc=new T.Color();

// ---- generic grid surface: fn(t,theta,out) fills out.p=[x,y,z] and out.c=Color. Winding gives outward normals.
function surf(nt,nth,fn){
  const n=(nt+1)*nth,pos=new Float32Array(n*3),col=new Float32Array(n*3),idx=[],o={p:[0,0,0],c:tc};
  for(let i=0;i<=nt;i++)for(let j=0;j<nth;j++){const k=i*nth+j;fn(i/nt,j/nth*PI*2,o);pos.set(o.p,k*3);col[k*3]=o.c.r;col[k*3+1]=o.c.g;col[k*3+2]=o.c.b}
  for(let i=0;i<nt;i++)for(let j=0;j<nth;j++){const a=i*nth+j,b=i*nth+(j+1)%nth,c=(i+1)*nth+j,d=(i+1)*nth+(j+1)%nth;idx.push(a,b,c,b,d,c)}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));g.setAttribute('color',new T.BufferAttribute(col,3));g.setIndex(idx);g.computeVertexNormals();return g}
const place=(o,t,th,R)=>{o.p[0]=R*Math.cos(th);o.p[1]=-(U0+t*L);o.p[2]=R*Math.sin(th)*FLAT};

// ================================================================== the loaf
const loafR=(t,th)=>{const s=Math.sin(PI*t);return s<=0?0:R0*Math.pow(s,.32)*(1+.07*(nz(t,th,8,1.1)-.5))};   // tapered ends + a bumpy outline
const SLASH=[.40,.49,.58,.67,.76,.85],TILT=.55;
function loafGeo(){
  const ct=Math.cos(TILT),st=Math.sin(TILT);
  return surf(120,40,(t,th,o)=>{
    const r=loafR(t,th),d0=sdt(th),arc=d0*r;let g=0,e=0;
    for(const tcn of SLASH){const a=(t-tcn)*L,p=a*ct+arc*st,q=-a*st+arc*ct,fall=Math.exp(-Math.pow(p/.085,4));
      g+=Math.exp(-(q/.016)*(q/.016))*fall;e+=Math.exp(-((q-.028)/.013)*((q-.028)/.013))*fall}   // cut groove + the raised lip beside it
    place(o,t,th,Math.max(.002,r-.017*g+.011*e));
    const u=(1+Math.cos(d0))/2,c=o.c;c.copy(CR_L).lerp(CR_D,Math.pow(u,1.4)*.9).multiplyScalar(.9+.2*nz(t,th,10,2.2));
    const f=nz(t,th,16,3.1);if(f>.7)c.lerp(FLOUR,clamp((f-.7)/.3,0,1)*.6);                       // flour dust
    c.lerp(INNER,clamp(g*1.7,0,1)).lerp(EAR,clamp(e*.7,0,1)).multiplyScalar(lerp(.78,1,clamp(Math.sin(PI*t)*6,0,1)))});
}

// ================================================================== the paper sleeve
const tooth=(th,n)=>Math.abs(((th/(PI*2)*n)%1)-.5)*2;   // triangle wave: torn / pleated edge
function paperGeo(){
  return surf(70,48,(s,th,o)=>{
    const us=-.40-.025*tooth(th,6)-.012*nz(0,th,0,3),ur=.24+.05*tooth(th,9)+.03*(nz(0,th,0,2)-.5),u=lerp(us,ur,s),t=(u-U0)/L;
    let e=t>0&&t<1?R0*Math.pow(Math.sin(PI*t),.32)+.016:0;e=Math.max(e,.022);
    if(u<-.30)e+=.04*sm(clamp((-.30-u)/.10,0,1));                          // twisted tuft flares out behind the loaf
    e+=.022*sm(clamp((s-.78)/.22,0,1));                                       // rim flares open
    const w=.008*Math.sin(th*7+u*9)+.006*Math.sin(th*13-u*5)+.007*(nz(u*6,th,1,2.5)-.5)*2;e=Math.max(.014,e+w);
    o.p[0]=e*Math.cos(th);o.p[1]=-u;o.p[2]=e*Math.sin(th)*.92;
    const c=o.c;c.copy(PAPER).multiplyScalar(.9+clamp(w/.012,-.5,.5)*.22);
    const band=sm(clamp(1-Math.abs(u-.055)/.028,0,1));c.lerp(RED,band*.9);                                              // printed band
    c.lerp(PAPER_D,sm(clamp((s-.9)/.1,0,1))*.7).lerp(PAPER_D,sm(clamp((.12-s)/.12,0,1))*.5)});                          // stained rim and tuft
}

// ================================================================== peanut butter + jelly (height fields over the loaf)
// a layer exists where d > 0 (d = distance in metres to its edge); the thickness rounds off like a blob; d <= 0 sinks below the crust (hidden, deeper than the score grooves)
const edgeH=(d,H)=>d<=0?Math.max(-.035,d*1.6):H*Math.sqrt(clamp(d/.03,0,1));   // continuous through 0 so the edge line is smooth
const PBDRIP=[[[.70,.55,.035],[.80,.95,.03],[.90,.40,.04]],[[.73,.80,.032],[.84,.50,.035],[.93,.90,.03]]];   // [t, extra reach (rad), width] for the left / right side
const JLDRIP=[[[.80,.70,.03],[.90,.45,.035]],[[.76,.50,.03],[.86,.85,.03],[.93,.35,.025]]];
function pbH(t,th){
  const d0=sdt(th),a=Math.abs(d0),sg=d0>=0?0:1;let am=1.35+.12*Math.sin(t*21+1.3)+.28*(vn(t*8,sg*3.7)-.5);
  for(const [ti,A,w] of PBDRIP[sg])am+=A*Math.exp(-((t-ti)/w)*((t-ti)/w));
  am+=PI*sm(clamp((t-.90)/.07,0,1));                                               // the tip is dipped all the way round
  const tb=.62+.05*(a/PI)+.1*(vn(a*3,2.1)-.5),d=Math.min((am-a)*Math.max(loafR(t,th),.06),(t-tb)*L);
  return edgeH(d,.024)*(.9+.2*nz(t,th,26,2.5))*Math.sqrt(clamp((1-t)/.03,0,1));
}
function jlH(t,th){
  const d0=sdt(th),a=Math.abs(d0),sg=d0>=0?0:1;let am=.80+.1*Math.sin(t*17+.4)+.1*(vn(t*9,sg*5.1)-.5);
  for(const [ti,A,w] of JLDRIP[sg])am+=A*Math.exp(-((t-ti)/w)*((t-ti)/w));
  const tb=.73+.08*(vn(a*3,7.7)-.5),d=Math.min((am-a)*Math.max(loafR(t,th),.06),(t-tb)*L,(.965-t)*L);
  return edgeH(d,.026);
}
function pbGeo(){
  return surf(110,56,(t,th,o)=>{const h=pbH(t,th);place(o,t,th,Math.max(.002,loafR(t,th)+h));
    o.c.copy(PB_D).lerp(PB_L,clamp(h/.02,0,1)).multiplyScalar(.93+.14*nz(t,th,30,3))});
}
function jellyGeo(){
  return surf(110,56,(t,th,o)=>{const h=jlH(t,th),pb=Math.max(pbH(t,th),0);place(o,t,th,Math.max(.002,loafR(t,th)+pb+h));
    o.c.copy(JL_D).lerp(JL_L,clamp(h/.026,0,1)*.85+.1*nz(t,th,20,3))});
}

// crushed peanut bits: little faceted lumps merged into one geometry, sitting on the peanut butter
function bitsGeo(){
  const R=rng(7),pos=[],nor=[],col=[],cols=[C('#dba969'),C('#c68b4a'),C('#e8c48a')];let n=0;
  for(let tries=0;tries<400&&n<20;tries++){
    const t=.66+R()*.32,th=TOP+(R()-.5)*2.6;if(pbH(t,th)<.018||jlH(t,th)>0)continue;
    const g=new T.IcosahedronGeometry(1,1),s=.009+R()*.008;g.scale(s*(1+R()*.5),s*.8,s*(1+R()*.5));g.rotateX(R()*6);g.rotateY(R()*6);g.rotateZ(R()*6);
    const R_=loafR(t,th)+pbH(t,th)+s*.3,y=-(U0+t*L);g.translate(R_*Math.cos(th),y,R_*Math.sin(th)*FLAT);g.computeVertexNormals();
    const c=cols[(R()*3)|0],p=g.attributes.position,nn=g.attributes.normal;
    for(let i=0;i<p.count;i++){pos.push(p.getX(i),p.getY(i),p.getZ(i));nor.push(nn.getX(i),nn.getY(i),nn.getZ(i));col.push(c.r,c.g,c.b)}n++}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(nor,3));g.setAttribute('color',new T.Float32BufferAttribute(col,3));return g}

export default {
  id:'peanutjelly',name:'Peanut and Jelly',kind:'melee',handling:'sword',
  stats:{range:2.5,arc:-.1,dmg:3.5,dur:.46,dash:1.2,move:1},
  build(){
    const g=new T.Group(),add=(geo,mat)=>{const m=new T.Mesh(geo,mat);g.add(m);return m};
    add(loafGeo(),new T.MeshStandardMaterial({vertexColors:true,roughness:.85}));
    add(paperGeo(),new T.MeshStandardMaterial({vertexColors:true,roughness:.95,side:T.DoubleSide}));
    add(pbGeo(),new T.MeshStandardMaterial({vertexColors:true,roughness:.5}));
    add(jellyGeo(),new T.MeshPhysicalMaterial({vertexColors:true,roughness:.18,clearcoat:1,clearcoatRoughness:.08}));
    add(bitsGeo(),new T.MeshStandardMaterial({vertexColors:true,roughness:.8,flatShading:true}));
    return {group:g};
  }
};