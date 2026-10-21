// Enemies: camouflaged cat soldiers. 'melee' rushes you, attacks, then rests. 'ranged' carries a gun.
import {buildSoldier} from './soldier.js';
export const STATS={melee:{hp:4,r:.5},ranged:{hp:3,r:.5}};
export const buildEnemy=kind=>buildSoldier(kind);