import type {PlanVennLayout,PlanVennSummary,PlanVennValue} from '@neural-charts/core/plan';
import type {NativeScene,Observation} from './contracts.js';
import {VennHitIndex} from './venn-hit.js';
export interface NativeVennGeometry {readonly data:readonly PlanVennSummary[];readonly layout:PlanVennLayout;}
const text=(v:unknown,max:number):v is string=>typeof v==='string'&&v.length>0&&v.length<=max;
const nonnegative=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
const integer=(v:unknown,max:number)=>nonnegative(v)&&Number.isInteger(v)&&v<=max;
/** Validate the measured circle roles once, including exact region anchors. */
export function ownVennScene(scene:NativeScene):Readonly<{venn?:NativeVennGeometry}>{
  const v=scene.venn;
  if(scene.family!=='venn'){if(v||scene.observations.some(p=>p.venn!==undefined))throw Error('Venn metadata on another family');return {};}
  const legend=scene.legend??[],layout=v?.layout;
  if(!v||!layout||!Array.isArray(v.data)||legend.length>3||v.data.length!==(1<<legend.length)-1||scene.observations.length>7||!Array.isArray(layout.circles)||layout.circles.length>3||!Array.isArray(layout.errors)||layout.errors.length>4||!['exact','approximate','unknown','allZero','hidden','noSource'].includes(layout.status)||!nonnegative(layout.maxErrorRatio)||!integer(layout.objectiveEvaluations,577)||typeof layout.budgetExhausted!=='boolean'||!integer(layout.omittedAnchors,7))throw Error('Invalid bounded Venn source');
  const setIds=new Set(legend.map(set=>set.id));if(setIds.size!==legend.length)throw Error('Duplicate Venn set');
  const sourceIds=new Set<string>(),sourceMasks=new Set<number>();
  const maskOf=(sets:readonly string[])=>legend.reduce((mask,set,index)=>sets.includes(set.id)?mask|(1<<index):mask,0);
  const data=v.data.map(row=>{
    if(!row||!text(row.id?.pointId,128)||!text(row.id?.seriesId,128)||sourceIds.has(row.id.pointId)||!Array.isArray(row.sets)||row.sets.length<1||row.sets.length>3||new Set(row.sets).size!==row.sets.length||row.sets.some((id:string)=>!setIds.has(id))||row.sets[0]!==row.id.seriesId||!text(row.label,1024)||row.value!==null&&!nonnegative(row.value)||typeof row.visible!=='boolean'||row.visible!==row.sets.every((id:string)=>legend.find(set=>set.id===id)!.visible))throw Error('Invalid original Venn measurement');
    const mask=maskOf(row.sets);if(sourceMasks.has(mask))throw Error('Duplicate Venn relation');sourceMasks.add(mask);sourceIds.add(row.id.pointId);
    return {id:{...row.id},sets:[...row.sets],label:row.label,value:row.value,visible:row.visible};
  });
  const sourceById=new Map(data.map(row=>[row.id.pointId,row])),singletons=new Map(data.filter(row=>row.sets.length===1).map(row=>[row.sets[0]!,row]));
  const circles=layout.circles.map(c=>{
    const index=legend.findIndex(set=>set.id===c.id),source=singletons.get(c.id);
    if(index<0||!legend[index]!.visible||c.bit!==1<<index||!source||source.value===null||c.value!==source.value)throw Error('Circle differs from original set');
    return {id:c.id,bit:c.bit,cx:c.cx,cy:c.cy,radius:c.radius,value:c.value};
  });
  const known=data.filter(row=>row.visible&&row.value!==null);
  if(known.length!==scene.observations.length||layout.omittedAnchors!==scene.observations.filter(p=>p.venn?.geometry==='omitted').length)throw Error('Missing known Venn observation');
  const placed:Readonly<{mask:number;point:Observation}>[]=scene.observations.filter(p=>p.venn?.geometry==='placed').map(point=>({mask:point.venn!.mask,point}));
  const hits=new VennHitIndex(circles,placed,scene.width,scene.height);
  for(const point of scene.observations){
    const source=sourceById.get(point.id.pointId),detail=point.venn;
    if(!source||!source.visible||source.value===null||source.id.seriesId!==point.id.seriesId||source.value!==point.value||!detail||detail.type!=='inclusive-intersection'||detail.mask!==maskOf(source.sets)||!['placed','omitted'].includes(detail.geometry)||!Array.isArray(detail.sets)||detail.sets.length!==source.sets.length||detail.sets.some((id,i)=>id!==source.sets[i])||point.hit!==undefined)throw Error('Venn observation differs from source');
    if(detail.geometry==='placed'&&hits.pick(point.x,point.y)!==point)throw Error('Venn anchor outside its exact region');
  }
  const visible=legend.filter(set=>set.visible),ready=layout.status==='exact'||layout.status==='approximate';
  if(ready&&circles.length!==visible.length||!ready&&circles.length||layout.status==='exact'&&layout.maxErrorRatio>1e-7||layout.status==='approximate'&&layout.maxErrorRatio<=1e-7||layout.status==='noSource'&&legend.length||layout.status==='hidden'&&visible.length||layout.status==='unknown'&&!data.some(row=>row.visible&&row.value===null)||layout.status==='allZero'&&known.some(row=>row.value!==0))throw Error('Invalid Venn layout status');
  if(scene.series.length!==visible.length)throw Error('Missing visible Venn series');
  for(const series of scene.series){
    const circle=circles.find(c=>c.id===series.id),expected=circle&&circle.radius>0?1:0;
    if(!visible.some(set=>set.id===series.id)||series.path||series.areaPath||series.nodePath||series.bars?.length||series.cells?.length||series.textGlyphs?.length||(series.circles?.length??0)!==expected)throw Error('Unsupported Venn rendering role');
    const primitive=series.circles?.[0];if(primitive&&circle&&(primitive.pointId!==singletons.get(series.id)!.id.pointId||primitive.cx!==circle.cx||primitive.cy!==circle.cy||primitive.radius!==circle.radius))throw Error('Circle rendering differs from layout');
  }
  const maximum=Math.max(0,...visible.map(set=>singletons.get(set.id)?.value??0));let maxError=0;
  const errors=layout.errors.map(error=>{
    if(!Array.isArray(error.sets))throw Error('Invalid Venn fit members');
    const source=data.find(row=>maskOf(row.sets)===maskOf(error.sets));
    if(!Array.isArray(error.sets)||error.sets.length<2||error.sets.length>3||new Set(error.sets).size!==error.sets.length||error.sets.some((id:string)=>!visible.some(set=>set.id===id))||!source||source.value!==error.expected||!nonnegative(error.actual)||!nonnegative(error.expected))throw Error('Invalid Venn fit residual');
    maxError=Math.max(maxError,maximum?Math.abs(error.actual/maximum-error.expected/maximum):0);return {sets:[...error.sets],expected:error.expected,actual:error.actual};
  });
  if(Math.abs(maxError-layout.maxErrorRatio)>1e-8)throw Error('Venn fit error differs');
  return {venn:{data,layout:{...layout,circles,errors}}};
}
export function ownVennPoint(point:Observation,family:NativeScene['family']):Readonly<{venn?:PlanVennValue}>{
  if(family!=='venn')return {};
  const v=point.venn!;return {venn:{type:v.type,sets:[...v.sets],mask:v.mask,geometry:v.geometry}};
}
