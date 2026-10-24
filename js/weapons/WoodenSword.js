// Wooden Sword: smooth tapered blade, curved guard, wrapped grip.
import * as T from 'three';
import {side,lathe,mk,matte,ring} from './proc.js';
export default {
  id:'woodensword',name:'Wooden Sword',kind:'melee',handling:'sword',
  stats:{range:2.7,arc:-.05,dmg:3,dur:.5,dash:1.1,move:1,slashColor:'#ffe2a0'},   // slashColor tints the blade trail, embers and hit flash (optional on every melee weapon)
  build(){
    const g=new T.Group(),wood=matte('#d29a58',.7),dwood=matte('#7a4a22',.75),grain=matte('#b57a3c',.8);
    mk(side([[.2,.075],[.55,.082],[.9,.074],[1.08,.03],[1.15,0],[1.08,-.03],[.9,-.074],[.55,-.082],[.2,-.075]],.04,{smooth:3,bevel:.009}),wood,g);   // blade
    mk(side([[.24,.014],[1.0,.012],[1.0,-.012],[.24,-.014]],.05,{bevel:.005}),grain,g);                                                              // centre ridge
    mk(side([[.12,.0],[.16,.1],[.2,.2],[.24,.19],[.22,.0],[.24,-.19],[.2,-.2],[.16,-.1]],.06,{smooth:4,bevel:.01}),dwood,g);                          // curved guard
    mk(lathe([[-.2,.04],[-.12,.05],[0,.056],[.1,.05],[.13,.044]],16),dwood,g);                                                                       // grip
    [-.14,-.06,.02].forEach(u=>mk(ring(.057,.011),wood,g,[0,-u,0]));                                                                                  // wrap
    mk(new T.SphereGeometry(1,14,10),dwood,g,[0,.22,0],[0,0,0],.075);                                                                                 // pommel
    return {group:g};
  }
};