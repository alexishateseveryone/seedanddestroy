// ENGRAVED STONE (put this file next to batch.js).
//   engrave(geometry,seed,{depth,crack,hatch,scale})   call after shaping the rock, BEFORE computeVertexNormals().
// Cuts two kinds of lines into the surface, like a stone that was carved by hand:
//   1) a network of chiselled cracks (the iso-lines of a smooth noise field), and
//   2) patches of parallel hatch lines that follow the strata.
// The lines are pushed in a little (real geometry) and an 'engr' attribute (0..1) is written; Batch.add() turns it into darker colour in the grooves
// and then removes the attribute again, so merged rock meshes keep working.
import * as T from 'three';
import {vnoise,fbm3} from './batch.js';

const sm=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)};

export function engrave(g,seed=0,{depth=.05,crack=.024,hatch=1,scale=1}={}){
  const p=g.attributes.position,n=p.count,E=new Float32Array(n),k=scale;
  for(let i=0;i<n;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),
      c=Math.abs(fbm3(x*2.2*k+seed*3.1,y*2.2*k,z*2.2*k)-.5),g1=1-sm(0,crack,c),                                              // cracks
      hb=Math.abs(Math.sin(y*15*k+(vnoise(x*3*k,y*3*k,z*3*k+seed)-.5)*6)),
      g2=(1-sm(0,.2,hb))*sm(.5,.68,vnoise(x*2.1*k+9+seed,y*2.1*k,z*2.1*k))*hatch,                                              // hatch lines in patches
      e=Math.min(1,g1+g2*.85),f=1-e*depth;
    E[i]=e;p.setXYZ(i,x*f,y*f,z*f)}                                                                                            // groove = pushed towards the centre
  g.setAttribute('engr',new T.BufferAttribute(E,1));return g}
