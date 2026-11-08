import type {PlanDendrogramValue,PlanDendrogramLayout} from '@neural-charts/core/plan';
import type {NativeScene} from './contracts.js';
export type NativeDendrogramValue=PlanDendrogramValue;
export type NativeDendrogramLayout=PlanDendrogramLayout;
export function ownDendrogramValue(v:NativeDendrogramValue):NativeDendrogramValue{
  if(!v||!['leaf','cluster'].includes(v.type)||!['distance','topology'].includes(v.heightMode)||!['source','topology','leafZero'].includes(v.heightSource)||!Number.isInteger(v.leafCount)||v.leafCount<1||v.leafCount>64||!Number.isInteger(v.depth)||v.depth<0||v.depth>16||typeof v.unit!=='string'||v.unit.length>64||v.type==='leaf'&&v.leafCount!==1||v.heightMode==='distance'&&v.heightSource==='topology'||v.heightMode==='topology'&&v.unit!=='levels')throw Error('Invalid dendrogram node role');
  return {type:v.type,heightMode:v.heightMode,heightSource:v.heightSource,leafCount:v.leafCount,depth:v.depth,unit:v.unit};
}
export function ownDendrogram(v:NativeDendrogramLayout,scene:Pick<NativeScene,'family'|'unit'|'observations'|'series'|'legend'>):NativeDendrogramLayout{
  if(scene.family!=='dendrogram'||!v||!['horizontal','vertical'].includes(v.orientation)||!['distance','topology'].includes(v.heightMode)||!Number.isFinite(v.maxHeight)||v.maxHeight<0||!Number.isInteger(v.nodeCount)||v.nodeCount<1||v.nodeCount>128||!Number.isInteger(v.leafCount)||v.leafCount<1||v.leafCount>64||v.leafCount>v.nodeCount||typeof v.unit!=='string'||v.unit!==scene.unit||v.heightMode==='topology'&&v.unit!=='levels'||(scene.legend?.length??0)||scene.series.length!==1||scene.series[0]?.id!=='tree'||scene.observations.length!==v.nodeCount)throw Error('Invalid dendrogram layout');
  let leafCount=0;const roots=scene.observations.filter(p=>p.dendrogram?.depth===0);if(roots.length!==1||roots[0]?.value!==v.maxHeight||roots[0]?.dendrogram?.leafCount!==v.leafCount)throw Error('Invalid dendrogram root');
  const circles=scene.series[0]!.circles;if(!circles||circles.length!==v.nodeCount)throw Error('Missing dendrogram nodes');const nodes=new Map(circles.map(c=>[c.pointId,c]));
  for(const p of scene.observations){const role=ownDendrogramValue(p.dendrogram!),c=nodes.get(p.id.pointId);if(p.id.seriesId!=='tree'||p.value<0||p.value>v.maxHeight||role.heightMode!==v.heightMode||role.unit!==v.unit||!c||c.cx!==p.x||c.cy!==p.y||p.hit?.type!=='circle'||p.hit.cx!==p.x||p.hit.cy!==p.y||role.type==='leaf'&&p.value!==0)throw Error('Invalid dendrogram observation ownership');if(role.type==='leaf')leafCount++;}
  if(leafCount!==v.leafCount)throw Error('Invalid dendrogram leaf count');
  return Object.freeze({orientation:v.orientation,heightMode:v.heightMode,maxHeight:v.maxHeight,nodeCount:v.nodeCount,leafCount:v.leafCount,unit:v.unit});
}
