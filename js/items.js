// Item catalogue for the story-mode inventory: weapons (built from WEAPONS), armor, artifacts and curse-objects.
// Stats here are display values for now; only the two equipped weapons and the HUD artifact icons are wired into the game.
import {WEAPONS} from './weapons/index.js';
import {WEAPON_ICONS,BLASTER} from './weaponIcons.js';

const I=d=>`<svg viewBox="0 0 24 24" class="wi">${d}</svg>`;
export const GHOST={
  weapon:BLASTER,
  head:I('<path d="M4 15a8 8 0 0 1 16 0v4h-4v-3H8v3H4z" fill="currentColor"/>'),
  chest:I('<path d="M7 3l5 2.2L17 3l4 4-2.5 3V21h-13V10L3 7z" fill="currentColor"/>'),
  boots:I('<path d="M8 3h6v9l5 2.5V19H5v-4l3-1z" fill="currentColor"/>'),
  artifact:I('<path d="M12 2l7 6-7 14L5 8z" fill="currentColor"/><path d="M5 8h14" stroke="#17100e" stroke-opacity=".35" stroke-width="1.2"/>'),
  curse:I('<path fill-rule="evenodd" d="M12 3a8 8 0 0 0-8 8c0 3 1.5 4.7 3 5.7V21h3v-2h4v2h3v-4.3c1.5-1 3-2.7 3-5.7a8 8 0 0 0-8-8zM9 10.4a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8zm6 0a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8z" fill="currentColor"/>')
};
export const RARITY={common:'COMMON',rare:'RARE',unique:'UNIQUE'};
export const GROUP_LABEL={weapon:'Weapon',head:'Headgear',chest:'Chestplate',boots:'Boots',artifact:'Artifact',curse:'Curse-Object'};
export const GROUP_ORDER=['weapon','head','chest','boots','artifact','curse'];
export const GROUP_TITLE={weapon:'Weapons',head:'Headgear',chest:'Chestplates',boots:'Boots',artifact:'Artifacts',curse:'Curse-Objects'};

export const ITEMS={};
const add=it=>{ITEMS[it.id]=it;return it};

// ---- weapons: one item per weapon the game already has
WEAPONS.forEach((w,i)=>{const s=w.stats||{},power=Math.round(10+(s.dmg||1)*5),gun=w.kind==='gun',lines=[];
  if(s.dmg!=null)lines.push(['Damage',s.dmg]);
  if(gun){if(s.cd)lines.push(['Fire rate',(1/s.cd).toFixed(1)+' / s']);if(s.mag)lines.push(['Magazine',s.mag]);if(s.pellets>1)lines.push(['Pellets',s.pellets])}
  else if(s.range)lines.push(['Reach',s.range]);
  add({id:'w_'+w.id,grp:'weapon',wi:i,name:w.name,power,rarity:power>=40?'unique':power>=24?'rare':'common',icon:WEAPON_ICONS[w.id]||BLASTER,
    desc:gun?'A ranged weapon. Keep your distance and let the shots do the talking.':'A close-range weapon. Get in, swing, get out.',lines})});

// ---- armor / artifacts / curse-objects: none exist yet. Add real ones here with
//   mk('head'|'chest'|'boots'|'artifact'|'curse', id, name, power, 'common'|'rare'|'unique', description, defense?)
const mk=(grp,id,name,power,rarity,desc,def)=>add({id,grp,name,power,rarity,desc,icon:GHOST[grp],lines:def?[['Defense',def]]:[]});

// ---- equipment slots
export const SLOTS=[
  {id:'w0',grp:'weapon'},{id:'w1',grp:'weapon'},
  {id:'head',grp:'head'},{id:'chest',grp:'chest'},{id:'boots',grp:'boots'},
  {id:'a0',grp:'artifact'},{id:'a1',grp:'artifact'},{id:'a2',grp:'artifact'},
  {id:'c0',grp:'curse'},{id:'c1',grp:'curse'},{id:'c2',grp:'curse'},{id:'c3',grp:'curse'},{id:'c4',grp:'curse'}];
export const SLOT=Object.fromEntries(SLOTS.map(s=>[s.id,s]));
export const SECTIONS=[
  {name:'WEAPONS',slots:['w0','w1']},
  {name:'ARMOR',slots:['head','chest','boots']},
  {name:'ARTIFACTS',slots:['a0','a1','a2']},
  {name:'CURSE-OBJECTS',slots:['c0','c1','c2','c3','c4']}];

// ---- what a brand-new world starts with
export const START={
  owned:WEAPONS.map(w=>'w_'+w.id),
  eq:{w0:'w_'+WEAPONS[0].id,w1:'w_'+(WEAPONS[1]||WEAPONS[0]).id,head:null,chest:null,boots:null,a0:null,a1:null,a2:null,c0:null,c1:null,c2:null,c3:null,c4:null}};