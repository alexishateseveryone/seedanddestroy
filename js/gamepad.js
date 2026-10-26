// Controller (gamepad) support: Xbox / PlayStation / Switch Pro / most "standard mapping" pads, wired or Bluetooth.
//   In a match   : left stick move, right stick look, RT shoot / slash, LT scope (hold), A jump, B roll (air dash in the air),
//                  X reload, Y plant / defuse (hold), LB / RB (or D-pad left / right) weapon, Start pause, Back = settings
//   In menus     : left stick / D-pad move the highlight, A accept, B back (it feeds the keyboard menu navigation in main.js)
// Settings > Controls > Controller (settings.js) uses get() / set(key,value) / reset() / info().
const KEY='sad.pad';
const DEF={on:1,sens:1,dz:.18,inv:0,vib:1,curve:1,south:0};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function createGamepad(o){
  const {P,keys,mouse}=o;
  const cfg={...DEF};
  try{const j=JSON.parse(localStorage.getItem(KEY)||'null');if(j&&typeof j==='object')for(const k in DEF)if(typeof j[k]==='number')cfg[k]=j[k]}catch(e){}
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(cfg))}catch(e){}};

  let pad=null,prev=[],ownKeys={},fireOn=false,scopeOn=false,hl=false,lastHp=null,rumbleT=0;
  const rep={};                         // menu auto-repeat timers per direction
  const body=document.body;

  // ---------------------------------------------------------------- finding the controller
  const pick=()=>{const l=navigator.getGamepads?navigator.getGamepads():[];let best=null;
    for(const g of l){if(!g||!g.connected)continue;if(g.mapping==='standard')return g;if(!best)best=g}
    return best};
  addEventListener('gamepadconnected',e=>{o.notify&&o.notify('Controller connected',String(e.gamepad.id).replace(/\s*\(.*$/,'').slice(0,40))});
  addEventListener('gamepaddisconnected',()=>{releaseAll();pad=null});

  // ---------------------------------------------------------------- helpers
  const setKey=(code,v)=>{if(v){keys[code]=true;ownKeys[code]=true}else if(ownKeys[code]){keys[code]=false;ownKeys[code]=false}};
  function releaseAll(){for(const k in ownKeys)if(ownKeys[k]){keys[k]=false;ownKeys[k]=false}
    if(fireOn){mouse.l=false;fireOn=false}if(scopeOn){o.scopeSet&&o.scopeSet(false);scopeOn=false}}
  const dead=(x,y)=>{const m=Math.hypot(x,y),dz=cfg.dz;if(m<dz)return[0,0];const k=Math.min(1,(m-dz)/(1-dz))/m;return[x*k,y*k]};
  const bp=(g,i)=>!!(g.buttons[i]&&g.buttons[i].pressed),bv=(g,i)=>g.buttons[i]?g.buttons[i].value:0;
  const hit=(g,i)=>bp(g,i)&&!prev[i];                       // pressed this frame
  /** vibration (strength from the settings, 0 = off) */
  function rumble(ms,weak,strong){
    if(!cfg.vib||!pad||!cfg.on)return;const a=pad.vibrationActuator;if(!a||!a.playEffect)return;
    try{a.playEffect('dual-rumble',{startDelay:0,duration:ms,weakMagnitude:clamp(weak*cfg.vib,0,1),strongMagnitude:clamp(strong*cfg.vib,0,1)}).catch(()=>{})}catch(e){}}

  // ---------------------------------------------------------------- menus: drive the keyboard navigation
  const KEYS={ArrowUp:'ArrowUp',ArrowDown:'ArrowDown',ArrowLeft:'ArrowLeft',ArrowRight:'ArrowRight',Enter:'Enter',Escape:'Escape'};
  function press(code){
    const init={code,key:code,bubbles:true,cancelable:true};
    window.dispatchEvent(new KeyboardEvent('keydown',init));window.dispatchEvent(new KeyboardEvent('keyup',init))}   // keyup at once: nothing stays "held" in the game
  addEventListener('mousemove',e=>{if(Math.abs(e.movementX)+Math.abs(e.movementY)>3){hl=false;body.classList.remove('gpad')}},{passive:true});
  addEventListener('keydown',e=>{if(e.isTrusted){hl=false;body.classList.remove('gpad')}},true);
  function menuKey(code){
    if(document.querySelector('.kbtn.wait'))return;          // Settings is waiting for a new keyboard key: never type into it
    body.classList.add('gpad');
    if(!hl){hl=true;press('ArrowDown');return}                // the first press only shows the highlight (same as the keyboard)
    press(code)}
  function menuFrame(g,dt){
    const [lx,ly]=[g.axes[0]||0,g.axes[1]||0];
    const dirs={ArrowUp:bp(g,12)||ly<-.55,ArrowDown:bp(g,13)||ly>.55,ArrowLeft:bp(g,14)||lx<-.55,ArrowRight:bp(g,15)||lx>.55};
    for(const k in dirs){
      if(!dirs[k]){rep[k]=null;continue}
      if(rep[k]==null){rep[k]=.38;menuKey(k)}                  // first step, then a short delay before it repeats
      else{rep[k]-=dt;if(rep[k]<=0){rep[k]=.11;menuKey(k)}}}
    if(hit(g,0))menuKey('Enter');
    const gfxOpen=(()=>{const e=document.getElementById('gfx');return e&&!e.hidden})();
    if(hit(g,1)){
      if(o.inPlay()&&!gfxOpen&&!document.getElementById('bye')?.offsetParent)o.resume();   // paused match: B resumes
      else menuKey('Escape')}
    if(hit(g,9)&&o.inPlay()&&!gfxOpen)o.resume();                                          // Start also resumes
    if(hit(g,8)&&o.inPlay()&&!gfxOpen)o.settings();
  }

  // ---------------------------------------------------------------- match controls
  function gameFrame(g,dt){
    const south=!!cfg.south,L=south?[g.axes[2]||0,g.axes[3]||0]:[g.axes[0]||0,g.axes[1]||0],R=south?[g.axes[0]||0,g.axes[1]||0]:[g.axes[2]||0,g.axes[3]||0];
    // move (digital, like WASD)
    const [mx,my]=dead(L[0],L[1]);
    setKey('KeyW',my<-.35);setKey('KeyS',my>.35);setKey('KeyA',mx<-.35);setKey('KeyD',mx>.35);
    // look
    let [rx,ry]=dead(R[0],R[1]);
    if(cfg.curve){rx=Math.sign(rx)*rx*rx;ry=Math.sign(ry)*ry*ry}                  // smooth: small pushes aim finely, full push turns fast
    const sp=3.4*cfg.sens,spY=2.5*cfg.sens;
    P.camYaw-=rx*sp*dt;P.camPitch=clamp(P.camPitch-ry*(cfg.inv?-1:1)*spY*dt,-.5,.6);
    // shoot / slash (RT) and scope (LT, hold)
    const fire=bv(g,7)>.35||bp(g,7);
    if(fire!==fireOn){fireOn=fire;mouse.l=fire}
    const sc=bv(g,6)>.35||bp(g,6);if(sc!==scopeOn){scopeOn=sc;o.scopeSet&&o.scopeSet(sc)}
    if(hit(g,0))o.jump();
    if(hit(g,1))o.tumble();
    if(hit(g,2))o.reload&&o.reload();
    setKey('KeyF',bp(g,3));                                                          // plant / defuse = hold
    if(hit(g,4)||hit(g,14))o.weapon(-1);
    if(hit(g,5)||hit(g,15))o.weapon(1);
    if(hit(g,9))o.pause();
    if(hit(g,8))o.settings&&o.settings();
    // rumble when hurt
    if(lastHp!=null&&P.hp<lastHp)rumble(P.hp<=0?420:200,.5,.9);
    lastHp=P.hp;
  }

  return{
    get:()=>cfg,
    set(k,v){if(k in DEF){cfg[k]=+v;save();if(k==='on'&&!+v)releaseAll()}},
    reset(){Object.assign(cfg,DEF);save()},
    rumble,
    info(){const g=pick();return{connected:!!g,name:g?String(g.id).replace(/\s*\(.*$/,'').slice(0,48):'',standard:!!g&&g.mapping==='standard'}},
    update(dt){
      dt=Math.min(dt||0,.05);
      const g=pick();
      if(!g||!cfg.on){if(pad){releaseAll();pad=null;prev=[]}return}
      pad=g;
      // a pad that just woke up must not "press" the buttons it was already holding
      if(!prev.length)prev=g.buttons.map(b=>b.pressed);
      const any=g.buttons.some(b=>b.pressed)||Math.abs(g.axes[0]||0)>.5||Math.abs(g.axes[1]||0)>.5;
      if(any)body.classList.toggle('gpad',!o.inGame());
      if(o.inGame()){gameFrame(g,dt);hl=false}
      else{releaseAll();lastHp=null;menuFrame(g,dt)}
      prev=g.buttons.map(b=>b.pressed);
    }
  };
}
