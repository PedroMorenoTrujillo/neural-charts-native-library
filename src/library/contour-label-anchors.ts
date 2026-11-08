import type {NativeScene} from './contracts.js';

/** Pick existing projected observations for decoration; never fit or smooth isolines. */
export function contourLabelAnchors(scene:NativeScene):readonly Readonly<{id:string;value:number;x:number;y:number}>[]{
  if(!scene.contour)return [];
  const best=new Map<string,{score:number;x:number;y:number}>();
  for(const point of scene.observations){
    const contour=point.contour;if(!contour)continue;
    const score=(contour.end.x-contour.start.x)**2+(contour.end.y-contour.start.y)**2;
    if(score>(best.get(contour.levelId)?.score??-1))best.set(contour.levelId,{score,x:point.x,y:point.y});
  }
  return scene.contour.levels.flatMap(level=>{
    const declared=scene.annotations?.find(label=>label.box?.seriesId===level.id);
    const anchor=declared??best.get(level.id);
    return anchor?[{id:level.id,value:level.value,x:anchor.x,y:anchor.y}]:[];
  });
}
