// Renders a three.js object to a PNG data-URL so the customizer tiles can show the
// real 3D model (ears, headwear, eyewear, collar, cloak, coat swatches) as their icon.
import * as T from 'three';

const SIZE=192,cache=new Map();
let R,scene,cam,key,ready=false;

function init(){
  if(ready)return !!R;
  ready=true;
  try{
    R=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
    R.setPixelRatio(1);R.setSize(SIZE,SIZE);R.setClearColor(0x000000,0);
    scene=new T.Scene();
    scene.add(new T.HemisphereLight('#fff6d8','#9aa0c8',1.9));
    key=new T.DirectionalLight('#fff0c8',2.2);scene.add(key,key.target);
    cam=new T.PerspectiveCamera(28,1,.01,100);
  }catch(e){console.warn('icon renderer unavailable',e);R=null}
  return !!R;
}

// key: cache key (include everything the look depends on: colours, type ...)
// build: () => Object3D, dir: camera direction from the object's centre
export function iconOf(key_,build,dir=[.3,.3,1],fit=1.12){
  if(cache.has(key_))return cache.get(key_);
  let url='';
  try{
    if(init()){
      const obj=build();scene.add(obj);obj.updateMatrixWorld(true);
      const box=new T.Box3().setFromObject(obj),c=box.getCenter(new T.Vector3()),sz=box.getSize(new T.Vector3());
      const r=Math.max(sz.x,sz.y,sz.z,.01)*.62;
      const d=new T.Vector3(...dir).normalize(),dist=r/Math.sin(cam.fov*Math.PI/360)*fit;
      cam.position.copy(c).addScaledVector(d,dist);cam.lookAt(c);cam.updateProjectionMatrix();
      key.position.copy(cam.position).add(new T.Vector3(-1.2,1.8,1).multiplyScalar(r));key.target.position.copy(c);
      R.render(scene,cam);url=R.domElement.toDataURL('image/png');
      scene.remove(obj);
    }
  }catch(e){console.warn('icon render failed',key_,e)}
  cache.set(key_,url);return url;
}