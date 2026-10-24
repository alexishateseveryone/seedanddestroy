// 5v5 ARENA (136 x 92) with FOUR MAPS, built from the generated-world assets (world/worldMap.js: biome trees, bushes, mushrooms, cacti, grass, flowers, vines, irregular lakes):
//   'forest'   oak + pine woods with mossy boulders             'jungle'  tall rainforest trees with hanging vines, palms, giant mushrooms
//   'savanna'  golden grass, flat acacias, cacti, rocky outcrops  'stone'   stone highlands: ridges, boulder fields, rock walls with a gap, rock rings with a doorway
// All four share the same layout (spawns, sites A / B, dirt lanes, flat pads) so the 5v5 mode and the bots work on every map.
//
//   const map=buildArena(seed,env,theme)      theme: 'forest' | 'jungle' | 'savanna' | 'stone' | 0..3 | undefined (= a random map)
//   map.theme / map.themeName                 which map was built          ARENA_THEMES = [{id,name}...] for a map picker
//   map.update / setQuality / prime / ripple / walk / stats / obs / sites / spawn / ponds / heightAt   exactly as before
// Obstacles: the whole playfield is built once (loadAll), so map.obs holds EVERY tree / rock of the map and bots far from the player still collide. Only drawing is streamed.
import {buildWorldMap} from './world/worldMap.js';
import {addHills} from './world/mapKit.js';
import {mulberry} from './world/worldGen.js';
import {W,H,SPAWN,SITES,ARENA_THEMES,setTheme,WORLD} from './arenaTerrain.js';
export {W,H,ARENA_THEMES};

/** seed only changes the plants (the terrain, lakes, lanes and rock formations of a theme are fixed) */
export function buildArena(seed=11,env=null,theme){
  const t=setTheme(theme===undefined||theme===null?(Math.random()*ARENA_THEMES.length)|0:theme);     // switches heightAt / terrainAt for 5v5.js too
  const world={...WORLD,seed:(WORLD.seed+Math.imul(seed|0,2654435761))>>>0};
  const map=buildWorldMap(world,env);
  addHills(map.group,env,mulberry(seed^0x51f1),t.hills.rings,t.hills.dark);
  return{...map,sites:SITES,spawn:SPAWN,theme:t.id,themeName:t.name};
}