import type {NativeScene} from '../library/contracts.js';

/** Consume Core labels as supplied. Never manufacture a second tick/layout engine. */
export function barCategoryLabels(scene:NativeScene){
  if(scene.yLabels)return scene.yLabels;
  const labels=new Map<string,{id:string;y:number;label:string}>();
  for(const p of scene.observations){
    if(!labels.has(p.id.pointId))labels.set(p.id.pointId,{id:p.id.pointId,y:p.y,label:p.label});
    // Dense consumers must supply bounded Core-projected labels. Keep all data available
    // for touch/accessible navigation instead of mounting thousands of native Text views.
    if(labels.size>64)return [];
  }
  return [...labels.values()];
}
