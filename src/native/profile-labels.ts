import type {PlanFrame} from '@neural-charts/core/plan';
import type {NativeAnnotation} from '../library/contracts.js';
/** Text placement inside actual Core rectangles; no interval projection is repeated. */
export function flameNativeLabels(frame:PlanFrame):readonly NativeAnnotation[]{
  if(frame.family!=='flame')return [];
  const points=new Map(frame.observations.map(p=>[p.id.pointId,p])),labels:NativeAnnotation[]=[];
  for(const s of frame.series)for(const bar of s.bars??[]){
    if(labels.length>=64)return labels;if(bar.width<48||bar.height<18||!bar.pointId)continue;
    const p=points.get(bar.pointId);if(!p)continue;
    labels.push({x:bar.x+bar.width/2,y:bar.y+bar.height/2,text:p.label,role:'label',box:{width:bar.width-8,height:bar.height,seriesId:s.id}});
  }
  return labels;
}
