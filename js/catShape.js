// Procedural head and body shapes for the cat avatar.
// The head is a unit sphere whose radius is changed per direction (headMult), so every shape is one smooth custom mesh.
// A "face mask" keeps the front of the face (eyes, nose, mouth) on the original surface, so the face features never sink in
// or float, whatever the skull shape is. The body is a super-ellipsoid reshaped by a width / depth profile (hips, waist, chest, belly).
import * as T from 'three';

export const HX=1,HY=.78,HZ=.85;                       // the head ellipsoid the avatar scales the unit mesh by
const lerp=(a,b,t)=>a+(b-a)*t;
const sm=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)};   // a > b works too (falling edge)
const gs=(x,c,w)=>Math.exp(-(((x-c)/w)**2));

// ------------------------------------------------------------------ head
export const HEAD_SHAPES=[['round','Round'],['bean','Bean'],['boxy','Boxy'],['heart','Heart'],['pear','Pear'],['tall','Tall'],['wide','Wide'],['wedge','Wedge']];
// raw radius multiplier for a unit direction (x right, y up, z forward)
const RAW={
  bean:(x,y,z)=>1+.12*gs(y,-.3,.5)*sm(.25,.9,Math.abs(x))-.06*sm(.4,1,y),                       // full low cheeks, flatter crown
  boxy:(x,y,z)=>{const n=Math.pow(x**4+y**4+z**4,.25)||1;return lerp(1,1/n,.55)/1.05},          // rounded cube
  heart:(x,y,z)=>1+.1*sm(-.1,.6,y)*sm(.2,.9,Math.abs(x))-.15*sm(-.25,-.95,y),                    // broad forehead, narrow chin
  pear:(x,y,z)=>1+.13*sm(.2,-.7,y)*Math.sqrt(Math.max(0,1-y*y))-.05*sm(.3,1,y),                  // heavy jaw
  tall:(x,y,z)=>1+.1*sm(.1,.95,y)-.06*sm(.3,.9,Math.abs(x)),                                      // high dome, slimmer sides
  wide:(x,y,z)=>1+.09*sm(.35,.95,Math.abs(x))-.04*sm(.4,1,y),                                     // broad flat head
  wedge:(x,y,z)=>1+.13*sm(.3,.9,Math.abs(x))*gs(y,-.25,.45)+.12*gs(y,-.62,.22)*sm(.2,.9,z)*gs(x,0,.45)-.07*sm(.3,1,y)   // cat face: wide cheeks, pointed chin
};
// (x,y,z) = unit direction in ellipsoid space. Returns the radius multiplier (about .86 .. 1.14).
export function headMult(shape,x,y,z){
  const f=RAW[shape];if(!f)return 1;
  const raw=f(x,y,z),face=sm(.3,.8,z)*(1-sm(.45,.9,-y));       // face = 1 on the front of the face, 0 on the back / top / chin
  const m=1+(raw-1)*(1-.9*face);
  return m<.86?.86:m>1.14?1.14:m;
}
export const headExt=s=>[Math.max(headMult(s,1,0,0),headMult(s,-1,0,0)),Math.max(headMult(s,0,1,0),headMult(s,0,-1,0)),headMult(s,0,0,-1)];   // collider radii factors
export const headLift=s=>HY*(headMult(s,0,1,0)-1);              // how much higher the top of the head is (headwear is raised by this)
export function shapedHeadGeo(shape='round'){
  const g=new T.SphereGeometry(1,64,48),p=g.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),l=Math.hypot(x,y,z)||1,m=headMult(shape,x/l,y/l,z/l);p.setXYZ(i,x*m,y*m,z*m)}
  g.computeVertexNormals();return g;
}

// ------------------------------------------------------------------ body
export const BODY_SHAPES=[['plush','Plush'],['chonk','Chonk'],['slim','Slim'],['pear','Pear']];
// width (x) and depth (z) profile at t = 0 (bottom) .2 (hips) .5 (waist) .8 (chest) 1 (neck), plus the belly bulge
const BODY={
  plush:{wx:[.9,1,.95,.85,.7],dz:[.9,1,.95,.88,.72],belly:.08,k:{w:1,d:1}},
  chonk:{wx:[.95,1.1,1.08,.94,.76],dz:[.95,1.1,1.1,.95,.78],belly:.2,k:{w:1.1,d:1.1}},
  slim:{wx:[.8,.88,.8,.8,.64],dz:[.84,.9,.84,.82,.66],belly:0,k:{w:.88,d:.9}},
  pear:{wx:[.95,1.14,.9,.78,.62],dz:[.95,1.1,.9,.8,.66],belly:.06,k:{w:1.1,d:1.08}}
};
const KN=[0,.2,.5,.8,1];
const prof=(a,t)=>{let i=0;while(i<3&&t>KN[i+1])i++;return lerp(a[i],a[i+1],sm(KN[i],KN[i+1],t))};
export const bodyK=s=>(BODY[s]||BODY.plush).k;                   // collider scale (width, depth) for cloth
export function shapedTorsoGeo(shape='plush'){
  const B=BODY[shape]||BODY.plush,g=new T.SphereGeometry(1,56,40),p=g.attributes.position;
  const sp=(v,e)=>Math.sign(v)*Math.pow(Math.abs(v),e),E1=2.7,E2=2.4;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),phi=Math.asin(Math.max(-1,Math.min(1,y))),th=Math.atan2(z,x);
    const cp=sp(Math.cos(phi),2/E1),sy=sp(Math.sin(phi),2/E1),t=(sy+1)/2;
    let nx=cp*sp(Math.cos(th),2/E2)*prof(B.wx,t),nz=cp*sp(Math.sin(th),2/E2)*prof(B.dz,t);
    if(nz>0)nz*=1+B.belly*gs(t,.3,.2)*sm(0,.4,nz);                  // belly
    else nz*=1-.05*gs(t,.55,.22)*sm(0,-.4,nz);                      // slight curve of the back
    p.setXYZ(i,nx,sy,nz);
  }
  g.computeVertexNormals();return g;
}
