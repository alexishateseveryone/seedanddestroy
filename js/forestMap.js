// HILLY FOREST (wave mode): 180 x 120, built from the generated-world assets (world/worldMap.js):
//  - biome trees (oak + pine, noisy trunks, roots, grown branches), bushes, mushrooms, logs, polished rocks, swaying grass / tall grass / flowers, fireflies + pollen
//  - IRREGULAR lakes with flowing-style water shader, reeds and lily pads (walkable water that ripples), two rocky lakes with boulders standing in the water
//  - three dense woods, open meadows, dirt lanes, forest that continues beyond the border + distant hills (no bare edge)
//  - CHUNK STREAMING like worldMap.js: only chunks near the player are built / drawn, far ones are freed.
// Same interface as before: const map=buildMap(seed,env); map.update(t,player,env) ...  (group, obs, update, setQuality, prime, ripple, walk, stats, ponds, W, H, heightAt, spawn)
// Extra: map.primeAsync(x,z,radius,onProgress), map.dispose()
import {buildWorldMap} from './world/worldMap.js';
import {addHills} from './world/mapKit.js';
import {mulberry} from './world/worldGen.js';
import {W,H,WORLD} from './forestTerrain.js';
export {W,H};

const HILLS=[{r:170,h0:14,h1:15,k:1.7,tone:'#3b7a47'},{r:215,h0:26,h1:24,k:5.3,tone:'#4a8a58'}];

/** seed only changes the plants (the terrain, lakes and rock landmarks are fixed, forestTerrain.js and the game logic share them) */
export function buildMap(seed=7,env=null){
  const world={...WORLD,seed:(WORLD.seed+Math.imul(seed|0,2654435761))>>>0};
  const map=buildWorldMap(world,env);
  addHills(map.group,env,mulberry(seed^0x51f1),HILLS,'#1d4a35');
  return map;
}