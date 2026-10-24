// Remappable PC keys. The rest of the game keeps reading the ORIGINAL key codes (keys.KeyW, keys.Space ...); this module just translates
// the physical key the player presses into the action's default code, so every module (main.js, 5v5.js ...) follows the remap for free.
//   canon(code) -> the default code of the action bound to that physical key, null if that key was rebound away (ignore it), else the code itself.
const KEY='sad.keys';
export const ACTIONS=[
  {id:'fwd',name:'Move forward',def:'KeyW'},{id:'back',name:'Move back',def:'KeyS'},{id:'left',name:'Move left',def:'KeyA'},{id:'right',name:'Move right',def:'KeyD'},
  {id:'fire',name:'Shoot / slash',def:'KeyE'},{id:'jump',name:'Jump',def:'Space'},{id:'roll',name:'Roll / air dash',def:'ShiftLeft'},{id:'reload',name:'Reload',def:'KeyR'},{id:'plant',name:'Plant / defuse (hold)',def:'KeyF'},
  {id:'lookL',name:'Look left',def:'ArrowLeft'},{id:'lookR',name:'Look right',def:'ArrowRight'},{id:'lookU',name:'Look up',def:'ArrowUp'},{id:'lookD',name:'Look down',def:'ArrowDown'},
  {id:'pause',name:'Pause',def:'KeyP'},{id:'settings',name:'Settings',def:'KeyG'}];
const NAMES={Space:'Space',ArrowLeft:'←',ArrowRight:'→',ArrowUp:'↑',ArrowDown:'↓',ShiftLeft:'L-Shift',ShiftRight:'R-Shift',ControlLeft:'L-Ctrl',ControlRight:'R-Ctrl',AltLeft:'L-Alt',AltRight:'R-Alt',
  Tab:'Tab',Enter:'Enter',Backspace:'Backspace',CapsLock:'Caps',Backquote:'`',Minus:'-',Equal:'=',BracketLeft:'[',BracketRight:']',Semicolon:';',Quote:"'",Comma:',',Period:'.',Slash:'/',Backslash:'\\',
  Insert:'Ins',Delete:'Del',Home:'Home',End:'End',PageUp:'PgUp',PageDown:'PgDn'};
export const labelOf=c=>NAMES[c]||String(c).replace(/^Key/,'').replace(/^Digit/,'').replace(/^Numpad/,'Num ');

export function createKeybinds(onChange){
  const def={};ACTIONS.forEach(a=>def[a.id]=a.def);
  let map={...def};try{const j=JSON.parse(localStorage.getItem(KEY)||'{}');ACTIONS.forEach(a=>{if(typeof j[a.id]==='string')map[a.id]=j[a.id]})}catch(e){}
  {const used=new Set();ACTIONS.forEach(a=>{if(used.has(map[a.id]))map[a.id]=a.def;used.add(map[a.id])})}   // old saves had Roll on Space: Jump comes first, so Roll falls back to its new default key
  const defaults=new Set(ACTIONS.map(a=>a.def));let byCode=new Map();
  const build=()=>{byCode=new Map(ACTIONS.map(a=>[map[a.id],a.def]))};build();
  const commit=()=>{build();try{localStorage.setItem(KEY,JSON.stringify(map))}catch(e){}onChange&&onChange()};
  return{
    canon(code){const d=byCode.get(code);if(d)return d;return defaults.has(code)?null:code},
    label:id=>labelOf(map[id]),get:()=>({...map}),
    /** bind a physical key to an action; if another action already uses it, the two swap keys */
    set(id,code){if(code===map[id])return;const other=ACTIONS.find(a=>a.id!==id&&map[a.id]===code);if(other)map[other.id]=map[id];map[id]=code;commit()},
    reset(){map={...def};commit()}}}