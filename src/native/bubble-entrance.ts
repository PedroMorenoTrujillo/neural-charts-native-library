import type {NativeScene} from '../library/contracts.js';
import {sceneTransform} from '../library/scene.js';
import {pointOverrideColor} from '../library/scene-paint.js';

export interface BubbleEntranceItem {
  readonly id:string;readonly left:number;readonly top:number;readonly size:number;readonly drawing:string;
}

export function hasBubbleEntrance(scene:NativeScene):boolean{
  if(scene.family!=='bubble'&&scene.family!=='scatter'&&scene.family!=='packedbubble')return false;
  // Dense scenes retain one batched drawing rather than allocating a view per datum.
  if(scene.series.some(series=>series.path||series.bars?.length)||scene.series.reduce((n,series)=>n+(series.circles?.length??0),0)>32)return false;
  return scene.series.some(series=>series.circles?.some(circle=>circle.radius>0));
}

/** Bounded presentation views; centres and radii remain the Core's projection. */
export function bubbleEntrance(scene:NativeScene,viewport:Readonly<{width:number;height:number}>):readonly BubbleEntranceItem[]|undefined{
  if(!hasBubbleEntrance(scene))return undefined;
  const t=sceneTransform(scene,viewport),items:BubbleEntranceItem[]=[];
  for(const series of scene.series)for(const [index,circle]of (series.circles??[]).entries()){
    if(circle.radius<=0)continue;
    const radius=circle.radius*t.sx,stroke=2*t.sx,half=radius+stroke/2+1,size=half*2;
    const color=circle.pointId===undefined?series.color:pointOverrideColor(scene,{seriesId:series.id,pointId:circle.pointId})??series.color;
    items.push({id:JSON.stringify([series.id,circle.pointId===undefined?{index}:{id:circle.pointId}]),left:t.x+circle.cx*t.sx-half,top:t.y+circle.cy*t.sy-half,size,
      drawing:`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${half}" cy="${half}" r="${radius}" fill="${color}" fill-opacity="0.64" stroke="${color}" stroke-width="${stroke}"/></svg>`});
  }
  return items.length?items:undefined;
}
