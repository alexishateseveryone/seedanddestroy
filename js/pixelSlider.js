// Pixel-size slider (bottom-left). Pixel size = how many screen pixels one "game pixel" covers. 1 = off-ish (sharp), 4 = Short Hike, 8 = very chunky.
// Press P to hide / show it. The value is remembered.
export function addPixelSlider(atm,{def=4,min=1,max=10}={}){
  let v=+localStorage.getItem('pixelSize')||def;
  const box=document.createElement('div');
  box.style.cssText='position:fixed;left:12px;bottom:12px;z-index:99999;background:#000a;color:#fff;font:12px sans-serif;padding:6px 10px;border-radius:8px;display:flex;gap:8px;align-items:center;pointer-events:auto';
  const lab=document.createElement('span'),r=document.createElement('input');
  r.type='range';r.min=min;r.max=max;r.step=1;r.value=v;r.style.width='120px';
  const apply=()=>{v=+r.value;lab.textContent='Pixel size '+v;localStorage.setItem('pixelSize',v);
    if(v<=1)atm.setPixel(false);else{atm.setPixel(true);atm.setArtRows(Math.round(innerHeight/v))}};
  r.oninput=apply;box.append(lab,r);document.body.appendChild(box);
  addEventListener('resize',apply);
  addEventListener('keydown',e=>{if(e.key==='p'||e.key==='P'){if(!/INPUT|TEXTAREA/.test(document.activeElement.tagName))box.style.display=box.style.display==='none'?'flex':'none'}});
  apply();
}
