import type {PlanFlameLayout,PlanFlameValue,PlanViolinLayout,PlanViolinValue} from '@neural-charts/core/plan';
import type {NativeScene} from './contracts.js';
export type NativeFlameLayout=PlanFlameLayout;
export type NativeFlameValue=PlanFlameValue;
export type NativeViolinLayout=PlanViolinLayout;
export type NativeViolinValue=PlanViolinValue;
const integer=(v:number,min:number,max:number)=>Number.isInteger(v)&&v>=min&&v<=max;
const text=(v:unknown,max:number)=>typeof v==='string'&&v.length<=max;
export function ownFlameValue(v:NativeFlameValue):NativeFlameValue{
  if(!v||!integer(v.depth,0,31)||!integer(v.childCount,0,2048)||!Number.isFinite(v.selfDuration)||v.selfDuration<0||v.parentId!==undefined&&(!text(v.parentId,128)||!v.parentId)||v.depth===0&&v.parentId!==undefined||v.depth>0&&v.parentId===undefined)throw Error('Invalid flame observation');
  return {...(v.parentId===undefined?{}:{parentId:v.parentId}),depth:v.depth,childCount:v.childCount,selfDuration:v.selfDuration};
}
export function ownFlame(v:NativeFlameLayout,scene:NativeScene):NativeFlameLayout{
  if(scene.family!=='flame'||!v||!integer(v.maxDepth,0,31)||!integer(v.nodeCount,0,2048)||!integer(v.rootCount,0,v.nodeCount)||v.nodeCount>0&&v.rootCount===0||(scene.legend?.length??0)!==0||scene.series.length!==1||scene.series[0]?.id!=='profile'||scene.observations.length>v.nodeCount||scene.intervals?.length!==v.nodeCount)throw Error('Invalid flame layout');
  const sources=new Set(scene.intervals!.map(p=>p.id.pointId));
  for(const p of scene.observations){const f=ownFlameValue(p.flame!);if(p.id.seriesId!=='profile'||!p.interval||p.interval.completed!==undefined||f.depth>v.maxDepth||f.selfDuration>p.value||f.parentId!==undefined&&!sources.has(f.parentId)||p.interval.rowId!=='depth-'+f.depth)throw Error('Invalid flame source role');}
  return Object.freeze({maxDepth:v.maxDepth,nodeCount:v.nodeCount,rootCount:v.rootCount});
}
export function ownViolinValue(v:NativeViolinValue):NativeViolinValue{
  if(!v||v.derived!==true||!integer(v.sampleCount,1,4096)||!integer(v.missingCount,0,4096)||v.sampleCount+v.missingCount>4096||![v.minimum,v.q1,v.median,v.q3,v.maximum,v.mean].every(Number.isFinite)||v.minimum>v.q1||v.q1>v.median||v.median>v.q3||v.q3>v.maximum||v.mean<v.minimum||v.mean>v.maximum||v.bandwidth!==null&&(!Number.isFinite(v.bandwidth)||v.bandwidth<=0)||v.bandwidth===null&&v.minimum!==v.maximum)throw Error('Invalid violin summary');
  return {derived:true,sampleCount:v.sampleCount,missingCount:v.missingCount,minimum:v.minimum,q1:v.q1,median:v.median,q3:v.q3,maximum:v.maximum,mean:v.mean,bandwidth:v.bandwidth};
}
export function ownViolin(v:NativeViolinLayout,scene:NativeScene):NativeViolinLayout{
  if(scene.family!=='violin'||!v||v.kernel!=='epanechnikov'||!['width','area','count'].includes(v.normalization)||!integer(v.resolution,32,128)||!Array.isArray(v.groups)||v.groups.length>16)throw Error('Invalid violin layout');
  const ids=new Set<string>(),byId=new Map(scene.observations.map(p=>[p.id.seriesId,p]));let sourceCount=0;
  const groups=v.groups.map(g=>{
    if(!g||!text(g.id,128)||!g.id||ids.has(g.id)||!text(g.label,200)||typeof g.visible!=='boolean'||!integer(g.sampleCount,0,4096)||!integer(g.missingCount,0,4096)||(sourceCount+=g.sampleCount+g.missingCount)>4096||!Array.isArray(g.density)||g.density.length!==0&&g.density.length!==v.resolution+1)throw Error('Invalid violin group');ids.add(g.id);
    const summary=g.summary?ownViolinValue(g.summary):undefined;
    if(!!summary!==(g.sampleCount>0)||summary&&(summary.sampleCount!==g.sampleCount||summary.missingCount!==g.missingCount||summary.bandwidth===null&&g.density.length!==0||summary.bandwidth!==null&&g.density.length===0))throw Error('Invalid violin summary ownership');
    const density=g.density.map((p:NativeViolinLayout['groups'][number]['density'][number],i:number)=>{if(!p||!Number.isFinite(p.value)||!Number.isFinite(p.density)||p.density<0||i>0&&p.value<=g.density[i-1]!.value)throw Error('Invalid violin density');return Object.freeze({value:p.value,density:p.density});});
    const p=byId.get(g.id);if(g.visible&&summary){if(!p||p.id.pointId!=='summary'||p.value!==summary.median||p.hit?.type!=='polygon'||!p.violin||Object.keys(summary).some(k=>p.violin![k as keyof NativeViolinValue]!==summary[k as keyof NativeViolinValue]))throw Error('Invalid violin observation ownership');}else if(p)throw Error('Hidden or unknown violin group cannot invent a summary');
    return Object.freeze({id:g.id,label:g.label,visible:g.visible,sampleCount:g.sampleCount,missingCount:g.missingCount,...(summary?{summary:Object.freeze(summary)}:{}),density:Object.freeze(density)});
  });
  if(scene.observations.some(p=>!ids.has(p.id.seriesId)||!p.violin)||(scene.legend?.length??0)!==groups.length||scene.legend?.some(p=>!ids.has(p.id)))throw Error('Invalid violin identities');
  return Object.freeze({kernel:'epanechnikov',normalization:v.normalization,resolution:v.resolution,groups:Object.freeze(groups)});
}
