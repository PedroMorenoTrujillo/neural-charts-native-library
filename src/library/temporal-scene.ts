import type {ChartFamily,Observation,NativeScene,NativeIntervalSummary,NativeEventSummary} from './contracts.js';
import {identityKey} from './contracts.js';
const validText=(value:unknown,max:number):value is string=>typeof value==='string'&&value.length<=max;
const numeric=(...values:number[]):boolean=>values.every(Number.isFinite);
/** Copy temporal source semantics independently of rendered pixel coordinates. */
export function ownTemporalObservation(point:Observation,family:ChartFamily):Pick<Observation,'interval'|'event'>{
  if(family==='flame'||family==='xrange'||point.interval!==undefined){
    const v=point.interval;
    if(family!=='flame'&&family!=='xrange'||!v||point.event!==undefined||!['linear','time'].includes(v.type)||!validText(v.rowId,256)||!v.rowId||!validText(v.rowLabel,256)||!numeric(v.start,v.end,v.duration)||v.end<v.start||v.duration!==v.end-v.start||point.value!==v.duration||point.xValue!==v.start||v.completed!==undefined&&v.completed!==null&&(!Number.isFinite(v.completed)||v.completed<0||v.completed>1)||v.type==='time'&&(!Number.isInteger(v.start)||!Number.isInteger(v.end)||Math.abs(v.start)>8.64e15||Math.abs(v.end)>8.64e15))throw Error('Invalid interval semantics');
    return {interval:{type:v.type,rowId:v.rowId,rowLabel:v.rowLabel,start:v.start,end:v.end,duration:v.duration,...(v.completed===undefined?{}:{completed:v.completed})}};
  }
  if(family==='timeline'||point.event!==undefined){
    const v=point.event;
    if(family!=='timeline'||!v||!['linear','time'].includes(v.type)||!numeric(v.coordinate)||point.value!==v.coordinate||point.xValue!==v.coordinate||point.label!==v.title||!validText(v.title,512)||v.description!==undefined&&!validText(v.description,2048)||v.type==='time'&&(!Number.isInteger(v.coordinate)||Math.abs(v.coordinate)>8.64e15))throw Error('Invalid event semantics');
    return {event:{type:v.type,coordinate:v.coordinate,title:v.title,...(v.description===undefined?{}:{description:v.description})}};
  }
  return {};
}

/** Keep unknown and clipped source values available without creating hit observations. */
export function ownTemporalSource(scene:NativeScene):Pick<NativeScene,'intervals'|'events'>{
  if(scene.intervals===undefined&&scene.events===undefined)return {};
  const ids=new Set<string>(),visibility=new Map((scene.legend?.length?scene.legend:scene.series).map(series=>[series.id,'visible' in series?series.visible:true]));
  const identity=(point:NativeIntervalSummary|NativeEventSummary)=>{
    if(!point.id||!validText(point.id.seriesId,256)||!point.id.seriesId||!validText(point.id.pointId,256)||!point.id.pointId||!visibility.has(point.id.seriesId)||typeof point.visible!=='boolean'||point.visible!==visibility.get(point.id.seriesId))throw Error('Invalid temporal source identity');
    const key=identityKey(point.id);if(ids.has(key))throw Error('Duplicate temporal source identity');ids.add(key);return {seriesId:point.id.seriesId,pointId:point.id.pointId};
  };
  if(scene.intervals!==undefined){
    if(scene.family!=='flame'&&scene.family!=='xrange'||scene.events!==undefined||!Array.isArray(scene.intervals)||scene.intervals.length>2048)throw Error('Invalid interval source');
    const intervals=scene.intervals.map((point):NativeIntervalSummary=>{
      const id=identity(point),missing=point.start===null||point.end===null;
      if(!validText(point.label,256)||!validText(point.rowId,256)||!point.rowId||!validText(point.rowLabel,256)||typeof point.missing!=='boolean'||point.missing!==missing||point.start!==null&&!Number.isFinite(point.start)||point.end!==null&&!Number.isFinite(point.end)||missing&&point.duration!==null||!missing&&(!Number.isFinite(point.duration)||point.end!<point.start!||point.duration!==point.end!-point.start!)||point.completed!==undefined&&point.completed!==null&&(!Number.isFinite(point.completed)||point.completed<0||point.completed>1))throw Error('Invalid interval source semantics');
      return {id,label:point.label,rowId:point.rowId,rowLabel:point.rowLabel,start:point.start,end:point.end,duration:point.duration,visible:point.visible,missing,...(point.completed===undefined?{}:{completed:point.completed})};
    });
    const byId=new Map(intervals.map(point=>[identityKey(point.id),point]));
    for(const point of scene.observations){const source=byId.get(identityKey(point.id)),value=point.interval;if(!source||!source.visible||source.missing||!value||source.start!==value.start||source.end!==value.end||source.duration!==value.duration||source.completed!==value.completed||source.rowId!==value.rowId||source.label!==point.label)throw Error('Interval source differs from its observation');}
    return {intervals};
  }
  if(scene.events!==undefined){
    if(scene.family!=='timeline'||!Array.isArray(scene.events)||scene.events.length>2048)throw Error('Invalid event source');
    const events=scene.events.map((point):NativeEventSummary=>{
      const id=identity(point),missing=point.x===null;
      if(!validText(point.title,512)||point.description!==undefined&&!validText(point.description,2048)||typeof point.missing!=='boolean'||point.missing!==missing||point.x!==null&&!Number.isFinite(point.x))throw Error('Invalid event source semantics');
      return {id,x:point.x,title:point.title,...(point.description===undefined?{}:{description:point.description}),visible:point.visible,missing};
    });
    const byId=new Map(events.map(point=>[identityKey(point.id),point]));
    for(const point of scene.observations){const source=byId.get(identityKey(point.id)),value=point.event;if(!source||!source.visible||source.missing||!value||source.x!==value.coordinate||source.title!==value.title||source.description!==value.description)throw Error('Event source differs from its observation');}
    return {events};
  }
  return {};
}
