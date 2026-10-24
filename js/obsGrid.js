// Spatial hash for the obstacle list (map.obs = trees / rocks as {x,z,r}).
// The 5v5 arena builds the WHOLE map (loadAll), so map.obs can hold thousands of circles. Scanning all of them for every bot steer sample,
// line-of-sight test, bullet and push, every frame, is what made the mode slow. These helpers only look at the few obstacles near the query.
// The grid is cached per obs array and rebuilt on its own if the array changes (streamed maps).
const CELL=6,PAD=3.5,cache=new WeakMap(),EMPTY=[];   // PAD: largest extra radius a point query may use (blocked(...,pad<=PAD), near())

function build(obs){
  const cells=new Map(),n=obs.length;
  for(const o of obs){
    const x0=Math.floor((o.x-o.r-PAD)/CELL),x1=Math.floor((o.x+o.r+PAD)/CELL),z0=Math.floor((o.z-o.r-PAD)/CELL),z1=Math.floor((o.z+o.r+PAD)/CELL);
    for(let i=x0;i<=x1;i++)for(let j=z0;j<=z1;j++){const k=i*65536+j;let a=cells.get(k);if(!a)cells.set(k,a=[]);a.push(o)}}
  const g={n,first:obs[0],last:obs[n-1],cells};cache.set(obs,g);return g}
function grid(obs){const g=cache.get(obs),n=obs.length;return g&&g.n===n&&g.first===obs[0]&&g.last===obs[n-1]?g:build(obs)}

/** obstacles that can touch a circle of radius <=PAD around (x,z) (a short array, do not keep it) */
export function near(obs,x,z){return grid(obs).cells.get(Math.floor(x/CELL)*65536+Math.floor(z/CELL))||EMPTY}
/** is (x,z) inside any obstacle (grown by pad <= PAD)? same as obs.some(o=>hypot<o.r+pad) */
export function blocked(obs,x,z,pad=0){const a=near(obs,x,z);for(let i=0;i<a.length;i++){const o=a[i],m=o.r+pad,dx=x-o.x,dz=z-o.z;if(dx*dx+dz*dz<m*m)return true}return false}
/** does the segment a->b pass through an obstacle (radius * k)? same maths as the old line-of-sight loop */
export function segBlocked(obs,ax,az,bx,bz,k=.9){
  const g=grid(obs),dx=bx-ax,dz=bz-az,l2=dx*dx+dz*dz||1,
        x0=Math.floor(Math.min(ax,bx)/CELL),x1=Math.floor(Math.max(ax,bx)/CELL),z0=Math.floor(Math.min(az,bz)/CELL),z1=Math.floor(Math.max(az,bz)/CELL);
  for(let i=x0;i<=x1;i++)for(let j=z0;j<=z1;j++){const a=g.cells.get(i*65536+j);if(!a)continue;
    for(let q=0;q<a.length;q++){const r=a[q],t=Math.max(0,Math.min(1,((r.x-ax)*dx+(r.z-az)*dz)/l2)),ex=ax+dx*t-r.x,ez=az+dz*t-r.z,m=r.r*k;if(ex*ex+ez*ez<m*m)return true}}
  return false}