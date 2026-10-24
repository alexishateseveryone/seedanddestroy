// Biome definitions: pure data (no three.js), shared by the generator, the map builder and the menus.
//   ground  : base / light / dry colours used by the ground shader
//   grass   : [dark, light] tint of grass + tall grass (grass follows the ground, so savanna grass is golden)
//   d       : tree/bush/shroom/rock/cactus/log = chance that a 4x4 world-unit cell holds one of them (worldMap.js rolls them in this order, at most one per cell).
//             grass/tall/flower = share of the maximum tuft count.
//   trees   : tree kinds that grow here (weights), see treesBiome.js
export const BIOMES=[
  {id:'forest',name:'Forest',
    ground:['#4a903c','#88c45a','#a8b45a'],grass:['#3d8a38','#a6d65a'],flowers:['#ff7ab0','#ffe066','#ffffff','#b9a2ff','#ff9a3c'],
    d:{grass:1,tall:.12,flower:.55,tree:.30,bush:.16,shroom:.08,rock:.02,cactus:0,log:.02},
    trees:{oak:.55,pine:.45},bush:['#3f8f4a','#4fa352','#357a40','#5aa84a'],shrooms:['red','brown','orange']},
  {id:'jungle',name:'Rainforest',
    ground:['#2e7a33','#4aa83c','#3a8f4a'],grass:['#1f7a34','#5dc24a'],flowers:['#ff4d8d','#ffb02e','#ff6a3c','#c36bff','#ffffff'],
    d:{grass:.9,tall:.6,flower:.5,tree:.42,bush:.22,shroom:.16,rock:.015,cactus:0,log:.02},
    trees:{jungle:.8,palm:.14,oak:.06},bush:['#2f8f45','#3aa04a','#277a3c','#4fb350'],shrooms:['blue','purple','red','giant']},
  {id:'savanna',name:'Savanna',
    ground:['#b8a24e','#d8c26a','#a98e44'],grass:['#b79b45','#e8d684'],flowers:['#ffd23a','#ff9a3c','#ffffff','#e8453c'],
    d:{grass:.9,tall:.6,flower:.15,tree:.05,bush:.1,shroom:0,rock:.035,cactus:.01,log:.005},
    trees:{acacia:.92,dead:.08},bush:['#9a9a4a','#a8a455','#8b8a40'],shrooms:['brown']},
  {id:'desert',name:'Desert',
    ground:['#dcc080','#efd7a0','#cdae70'],grass:['#c8ad66','#e2cc8a'],flowers:['#ff7ab0','#ffe066'],
    d:{grass:.06,tall:0,flower:.02,tree:.004,bush:.03,shroom:0,rock:.04,cactus:.09,log:0},
    trees:{dead:.7,palm:.3},bush:['#8f8a4a','#a09a55'],shrooms:['brown']},
  {id:'stone',name:'Stone Highlands',
    ground:['#8c8678','#a39e90','#767063'],grass:['#6f8f55','#9db57c'],flowers:['#ffffff','#b9a2ff'],
    d:{grass:.18,tall:0,flower:.03,tree:.05,bush:.03,shroom:0,rock:.22,cactus:0,log:.005},
    trees:{pine:.55,dead:.45},bush:['#5f7f50','#6d8a58'],shrooms:['brown']}
];
export const NB=BIOMES.length;
export const FOREST=0,JUNGLE=1,SAVANNA=2,DESERT=3,STONE=4;

// ---------------------------------------------------------------- dirt lanes of the forest (same formula as forestTerrain.js, JS + GLSL)
// The ground shader paints them, the map keeps trees / grass off them. They only show inside the forest region.
export function pathD(x,z){return Math.min(Math.abs(z-(9*Math.sin(x*.05)+12*Math.sin(x*.021+1))),Math.abs(x-(10*Math.cos(z*.06)+9*Math.sin(z*.027))))}
export const PATH_GLSL=`float pathD(vec2 p){return min(abs(p.y-(9.*sin(p.x*.05)+12.*sin(p.x*.021+1.))),abs(p.x-(10.*cos(p.y*.06)+9.*sin(p.y*.027))));}`;