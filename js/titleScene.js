// TITLE SCENERY: the title screen / main menu now show the REAL forest (js/forestMap.js -> js/world/worldMap.js: the same terrain, trees,
// bushes, rocks, grass, water and sky as the game), seen from a fixed camera behind the cat. Nothing is baked or generated here any more.
// main.js:  const TS=createTitleScene(scene,forest)   ->  TS.show(bool)  TS.update(dt,t,camPos)  TS.heightAt(x,z)  TS.cam(t) = {pos,look}   (the cat stands at x=0,z=0 looking +z)
// Only the floating seeds are added here, to give the still view some life.
import * as T from 'three';

const lerp=(a,b,t)=>a+(b-a)*t;
const rng=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};

// camera: low and a little behind the cat, looking out over the forest. Tweak here:
//   x,z = where the camera stands · up = metres above the ground there · tx,tz = the point it looks at · rise = how far above the ground that point is
const CAM={x:2.5,z:-10.5,up:3.2,tx:2.5,tz:60,rise:2.6};

export function createTitleScene(scene,map){
  const heightAt=(x,z)=>map.heightAt(x,z);
  const group=new T.Group();group.visible=false;group.name='titleScene';scene.add(group);

  // ---- floating seeds (dandelion fluff) drifting through the air around the cat
  const R=rng(11),NS=26,sp=new Float32Array(NS*3),seeds=[];
  for(let i=0;i<NS;i++)seeds.push({x:lerp(-20,24,R()),y:lerp(.8,7,R()),z:lerp(-6,30,R()),ph:R()*6,sp:.25+R()*.5});
  const sg=new T.BufferGeometry();sg.setAttribute('position',new T.BufferAttribute(sp,3));
  const sd=new T.Points(sg,new T.PointsMaterial({color:'#ffffff',size:4,sizeAttenuation:false,fog:false,transparent:true,opacity:.9,depthWrite:false}));
  sd.frustumCulled=false;group.add(sd);

  // sky view: on the title screen the camera looks up at the sky; on tap (sky(false)) it tilts down to the forest.
  //   SKY_PITCH = how far up the camera looks (degrees) · SKY_SPEED = how fast it tilts (bigger = faster)
  const SKY_PITCH=52,SKY_SPEED=2.2;
  let skyTarget=1,skyK=1,lastT=null;
  const cam=t=>{
    const dt=lastT===null?0:Math.min(.1,Math.max(0,t-lastT));lastT=t;
    skyK+=(skyTarget-skyK)*(1-Math.exp(-dt*SKY_SPEED));if(Math.abs(skyTarget-skyK)<.001)skyK=skyTarget;
    const e=skyK*skyK*(3-2*skyK);                                  // eased 0..1  (0 = forest, 1 = sky)
    const y=heightAt(CAM.x,CAM.z)+CAM.up,ly=heightAt(CAM.tx,CAM.tz)*.35+heightAt(CAM.x,CAM.z)*.65+CAM.rise+CAM.up*0;   // look a little over the land ahead, not at a fixed height
    const pos=new T.Vector3(CAM.x+Math.sin(t*.11)*.8,y+Math.sin(t*.17)*.12,CAM.z);
    const forest=new T.Vector3(CAM.tx,Math.max(ly,y-.5),CAM.tz);
    const pr=SKY_PITCH*Math.PI/180,D=70;
    const sky=new T.Vector3(pos.x+Math.sin(t*.07)*3,pos.y+Math.sin(pr)*D,pos.z+Math.cos(pr)*D);
    return{pos,look:forest.lerp(sky,e)}};

  return{group,heightAt,cam,
    sky(on){skyTarget=on?1:0},   // true = look at the sky (title), false = tilt down to the forest
    show(on){if(group.visible!==on)group.visible=on},
    update(dt,t){
      if(!group.visible)return;
      const p=sg.attributes.position;
      for(let i=0;i<NS;i++){const s=seeds[i];s.x-=dt*(.5+s.sp*.8);s.y+=Math.sin(t*s.sp+s.ph)*dt*.35;s.z+=Math.cos(t*.4+s.ph)*dt*.2;if(s.x<-22){s.x=24;s.y=lerp(.8,7,R())}
        p.setXYZ(i,s.x,heightAt(s.x,s.z)+s.y+.4,s.z)}
      p.needsUpdate=true;
    }};
}
