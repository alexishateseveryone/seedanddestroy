// catLimbs.js: soft, chubby, tapered arms and legs that BEND SEAMLESSLY.
// Each limb is ONE dense procedural mesh (about 900 vertices, 20 around x 56 along). Bending does not use two rigid parts:
// the whole tube is re-curved along a smooth spine every time the bend value changes, so an elbow / knee looks like soft rubber.
// To change the shape, edit ARM and LEG below (length, joint position, thickness along the limb, where the white paw / sock starts).
import * as T from 'three';

// len   = length of the limb (shoulder / hip -> start of the round end)
// j, w  = where the joint is (distance from the shoulder / hip) and half the width of the bending zone (bigger w = rounder, softer bend)
// sign  = +1: bends forward (elbow), -1: bends backward (knee)
// knots = thickness along the limb: [position 0..1, radius]. The last knot is the round end (paw / foot), a little thicker = pear shape
// flat  = (optional) end the limb with a flat sole whose corners are rounded with this radius, instead of a half-sphere
// white = from this point (0..1) on, the limb is painted white (paw / sock). hand = where a weapon is held (arm only)
export const ARM={len:.60,j:.29,w:.11,sign:1,flat:.07,hand:.56,white:.72,knots:[[0,.12],[.5,.115],[1,.12]]};
export const LEG={len:.42,j:.21,w:.09,sign:-1,flat:.08,white:.55,knots:[[0,.17],[.5,.165],[1,.17]]};   // nearly the same thickness all the way = a cylinder; the ends are full half-spheres

export const ARM_REACH=ARM.hand;                                  // shoulder -> hand
export const LEG_LEN=LEG.len+(LEG.flat||LEG.knots[LEG.knots.length-1][1]);    // hip -> sole (the avatar lifts itself by this so the feet stay on the ground)
export const HAND_Y=-(ARM.hand-(ARM.j+ARM.w));                    // where the hand sits inside the arm's joint group (see createLimb)

const SOCK='#fff7ee';
const sm=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)},dsm=x=>x<=0||x>=1?0:6*x*(1-x);   // smoothstep and its slope

// smooth thickness curve through the knots (cubic Hermite)
function profile(kn){
  const n=kn.length,m=kn.map((k,i)=>{const a=kn[Math.max(0,i-1)],b=kn[Math.min(n-1,i+1)];return(b[1]-a[1])/(b[0]-a[0])});
  return t=>{let i=0;while(i<n-2&&t>kn[i+1][0])i++;
    const [t0,r0]=kn[i],[t1,r1]=kn[i+1],h=t1-t0,u=Math.max(0,Math.min(1,(t-t0)/h)),u2=u*u,u3=u2*u;
    return(2*u3-3*u2+1)*r0+(u3-2*u2+u)*h*m[i]+(-2*u3+3*u2)*r1+(u3-u2)*h*m[i+1]}}

// Builds one limb. Returns {geo, set(angle, joint)}.
//   geo   : the mesh geometry (hangs down from y=0; give it to the coat material)
//   set(a): bend by `a` radians (0 = straight). `joint` (optional Group) is moved / rotated to the exact bent position of the limb just past the
//           joint, so a hand child placed at (0, HAND_Y) follows the real bent mesh.
export function createLimb(spec,fur){
  const {len,j,w,sign}=spec,rp=profile(spec.knots),SEG=20,HC=9,N=44,H=Math.PI/2,r0=rp(0),r1=rp(1),ring=[];   // ring = [s,radius]  (s = distance down the limb)
  for(let i=0;i<=HC;i++){const a=i/HC*H;ring.push([-r0*Math.cos(a),r0*Math.sin(a)])}                  // round top (hidden in the body)
  for(let m=1;m<N;m++){const t=m/N;ring.push([len*t,rp(t)])}                                          // shaft
  if(spec.flat){const rc=spec.flat;                                                                      // flat sole with rounded corners (radius rc)
    for(let i=0;i<=HC;i++){const a=i/HC*H;ring.push([len+rc*Math.sin(a),r1-rc+rc*Math.cos(a)])}
    for(let m=1;m<=5;m++)ring.push([len+rc,(r1-rc)*(1-m/5)])}
  else for(let i=0;i<=HC;i++){const a=H+i/HC*H;ring.push([len-r1*Math.cos(a),r1*Math.sin(a)])}          // round end
  const R=ring.length,pos=new Float32Array(R*SEG*3),col=new Float32Array(R*SEG*3),idx=[],cf=new T.Color(fur),cw=new T.Color(SOCK);
  ring.forEach(([s,r],i)=>{const c=s>len*spec.white?cw:cf;for(let k=0;k<SEG;k++){const a=k/SEG*Math.PI*2,o=(i*SEG+k)*3;
    pos[o]=Math.cos(a)*r;pos[o+1]=-s;pos[o+2]=Math.sin(a)*r;col[o]=c.r;col[o+1]=c.g;col[o+2]=c.b}});
  for(let i=0;i<R-1;i++)for(let k=0;k<SEG;k++){const a=i*SEG+k,b=i*SEG+(k+1)%SEG,c=(i+1)*SEG+k,d=(i+1)*SEG+(k+1)%SEG;idx.push(a,b,c,b,d,c)}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(pos,3).setUsage(T.DynamicDrawUsage));geo.setAttribute('color',new T.BufferAttribute(col,3));
  geo.setIndex(idx);geo.computeVertexNormals();
  const nrm=geo.attributes.normal;nrm.setUsage(T.DynamicDrawUsage);
  const restP=pos.slice(),restN=nrm.array.slice();
  geo.boundingSphere=new T.Sphere(new T.Vector3(0,-len/2,.1),len+.6);     // generous, so it never gets culled while bending

  // centre line of the bent limb at distance s: integrate the direction. The direction angle phi grows smoothly from 0 to th across the joint zone.
  const phiAt=(s,th)=>th*sm((s-(j-w))/(2*w));
  const spine=(s,th)=>{const steps=Math.max(2,Math.ceil(Math.abs(s)/.01)),ds=s/steps;let y=0,z=0;
    for(let k=0;k<steps;k++){const p=phiAt((k+.5)*ds,th);y-=Math.cos(p)*ds;z+=Math.sin(p)*ds}return[y,z]};
  let last=NaN;
  function set(a,joint){
    const th=sign*a;
    if(joint){const q=spine(j+w,th);joint.position.set(0,q[0],q[1]);joint.rotation.set(-th,0,0)}
    if(Math.abs(a-last)<1e-4)return;last=a;
    for(let i=0;i<R;i++){
      const s=ring[i][0],q=spine(s,th),p=phiAt(s,th),dphi=th*dsm((s-(j-w))/(2*w))/(2*w),c=Math.cos(p),sn=Math.sin(p);
      for(let k=0;k<SEG;k++){const o=(i*SEG+k)*3;let zo=restP[o+2];
        const t=zo*dphi;if(t>0)zo=zo/(1+t);                              // the inner side of a bend is squeezed, so it never folds over itself
        pos[o]=restP[o];pos[o+1]=q[0]+zo*sn;pos[o+2]=q[1]+zo*c;
        const ny=restN[o+1],nz=restN[o+2];nrm.array[o]=restN[o];nrm.array[o+1]=ny*c+nz*sn;nrm.array[o+2]=-ny*sn+nz*c}}
    geo.attributes.position.needsUpdate=true;nrm.needsUpdate=true;
  }
  set(0,null);
  return{geo,set};
}
