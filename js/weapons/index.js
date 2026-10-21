// Weapon registry. Number keys 1..8 in the game map to this order.
import Peashooter from './Peashooter.js';
import WoodenSword from './WoodenSword.js';
import AK47 from './AK47.js';
import DualDagger from './DualDagger.js';
import Spear from './Spear.js';
import Armalite from './Armalite.js';
import MachineGun from './MachineGun.js';
import Sniper from './Sniper.js';
export const WEAPONS=[Peashooter,WoodenSword,AK47,DualDagger,Spear,Armalite,MachineGun,Sniper];
export const byId=id=>WEAPONS.find(w=>w.id===id)||WEAPONS[0];