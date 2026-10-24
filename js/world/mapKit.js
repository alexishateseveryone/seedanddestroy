// MAP KIT (three.js helpers shared by forestMap.js and arenaMap.js)
//   addHills(group,env,R,rings,dark)   distant ring hills with little spires on them (trees for forests, rock needles for the stone map).
//                                      rings = [{r,h0,h1,k,tone}]  r = radius of the crest, h0/h1 = base height / variation, k = noise seed, tone = colour
import * as T from 'three';
import {vnoise,fbm3} from '../batch.js';

export function addHills(g,env,R,rings,dark='#1d4a35'){
  const d=new T.Object3D(),a=new T.Color(),b=new T.Color();
  for(const {r:Rr,h0,h1,k:seedK,tone} of rings){
    const SEG=180,pos=[],cl=[],idx=[],prof=[[Rr+16,-6,0],[Rr,1,1],[Rr-10,.55,.5],[Rr-26,-.5,.05]];
    const crest=an=>h0+h1*fbm3(Math.cos(an)*1.4+seedK,Math.sin(an)*1.4,seedK)+h1*.5*vnoise(an*9,seedK,1);
    for(let i=0;i<=SEG;i++){const an=i/SEG*Math.PI*2,hh=crest(an);prof.forEach(([r,f,c])=>{pos.push(Math.cos(an)*r,f<0?f:hh*f,Math.sin(an)*r);const k=.55+.45*c,t=new T.Color(tone).multiplyScalar(k);cl.push(t.r,t.g,t.b)})}
    for(let i=0;i<SEG;i++)for(let r=0;r<3;r++){const p=i*4+r,q=(i+1)*4+r;idx.push(p,p+1,q,q,p+1,q+1)}
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('color',new T.Float32BufferAttribute(cl,3));geo.setIndex(idx);geo.computeVertexNormals();
    g.add(new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,roughness:1,side:T.DoubleSide,envMap:env,envMapIntensity:.3})));
    const TN=900,cones=new T.InstancedMesh(new T.ConeGeometry(1,1,6,1).translate(0,.5,0),new T.MeshStandardMaterial({roughness:1,envMap:env,envMapIntensity:.3}),TN);
    for(let i=0;i<TN;i++){const an=R()*6.283,dd=R(),r=Rr+8-dd*24,hh=crest(an)*(dd<.35?1-(1-dd/.35)*.2:.55*(1-(dd-.35)/.65)+.12),s=3+R()*5;
      d.position.set(Math.cos(an)*r,hh-.5,Math.sin(an)*r);d.scale.set(s*.45,s,s*.45);d.rotation.set(0,R()*6,0);d.updateMatrix();cones.setMatrixAt(i,d.matrix);cones.setColorAt(i,a.set(tone).lerp(b.set(dark),R()*.6).multiplyScalar(.7+R()*.4))}
    g.add(cones)}
}