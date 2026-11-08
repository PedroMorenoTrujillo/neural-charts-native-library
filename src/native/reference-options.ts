import type {PlanReference,PlanReferenceBand} from './plan.js';
import type {NativeChartOptions,NativePointAppearance,NativeReferenceStyle,NativeReferenceBandStyle,NativeReferenceBandOptions} from './data-options.js';
import type {NativeScene} from '../library/contracts.js';
import {identityKey} from '../library/contracts.js';
import {sceneInteractionKey} from '../library/scene.js';

function secondaryAxis(options:NativeChartOptions){return options.axes&&'secondaryY' in options.axes?options.axes.secondaryY:undefined;}
const projectedIds=new WeakMap<object,ReadonlySet<string>>();

/** Fixed-size calculation dependency. Display changes never enter Core input. */
export function nativeReferenceGeometry(options:NativeChartOptions):readonly PlanReference[]{
  return [...(['x','y'] as const).flatMap(axis=>(options.axes?.[axis]?.referenceLines??[]).map(({id,value})=>({id,axis,value} as PlanReference))),...(secondaryAxis(options)?.referenceLines??[]).map(({id,value})=>({id,axis:'y' as const,yAxis:'secondary' as const,value}))].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
}
export function sameReferenceGeometry(a:readonly PlanReference[],b:readonly PlanReference[]):boolean{return a.length===b.length&&a.every((item,index)=>item.id===b[index]?.id&&item.axis===b[index]?.axis&&item.value===b[index]?.value&&item.yAxis===b[index]?.yAxis);}
export function nativeReferenceStyles(options:NativeChartOptions):readonly NativeReferenceStyle[]{
  return [...(['x','y'] as const).flatMap(axis=>(options.axes?.[axis]?.referenceLines??[]).map(({id,label,color,width,dash})=>({id,label,color,width,dash}))),...(secondaryAxis(options)?.referenceLines??[]).map(({id,label,color,width,dash})=>({id,label,color,width,dash}))].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
}
export function sameReferenceStyles(a:readonly NativeReferenceStyle[],b:readonly NativeReferenceStyle[]):boolean{return a.length===b.length&&a.every((item,index)=>{const other=b[index];return item.id===other?.id&&item.label===other.label&&item.color===other.color&&item.width===other.width&&item.dash===other.dash;});}
export interface NativeReferenceBandGroup {readonly axis:'x'|'y';readonly valueAxis?:'secondary';readonly bands:readonly NativeReferenceBandOptions[];}
/** Group access is shared by the defensive options validator and planner input. */
export function nativeReferenceBandGroups(options:NativeChartOptions):readonly NativeReferenceBandGroup[]{
  const groups:NativeReferenceBandGroup[]=[];
  for(const axis of ['x','y'] as const){const configured=options.axes?.[axis];if(configured&&'referenceBands' in configured&&configured.referenceBands!==undefined)groups.push({axis,bands:configured.referenceBands});}
  const secondary=secondaryAxis(options);if(secondary?.referenceBands!==undefined)groups.push({axis:'y',valueAxis:'secondary',bands:secondary.referenceBands});
  return groups;
}
export function nativeReferenceBandGeometry(options:NativeChartOptions):readonly PlanReferenceBand[]{
  const bands:PlanReferenceBand[]=[];
  for(const group of nativeReferenceBandGroups(options))for(const {id,from,to}of group.bands){
    if(group.axis==='y'&&typeof from==='number'&&typeof to==='number')bands.push({id,axis:'y',from,to,...(group.valueAxis?{valueAxis:group.valueAxis}:{})});
    else if(group.axis==='x'&&typeof from==='number'&&typeof to==='number')bands.push({id,axis:'x',from,to});
    else if(group.axis==='x'&&typeof from==='string'&&typeof to==='string')bands.push({id,axis:'x',from,to});
    else throw Error('Invalid reference band endpoints');
  }
  return bands.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
}
export function sameReferenceBandGeometry(a:readonly PlanReferenceBand[],b:readonly PlanReferenceBand[]):boolean{return a.length===b.length&&a.every((band,index)=>{const other=b[index];return band.id===other?.id&&band.axis===other.axis&&band.from===other.from&&band.to===other.to&&band.valueAxis===other.valueAxis;});}
export function nativeReferenceBandStyles(options:NativeChartOptions):readonly NativeReferenceBandStyle[]{return nativeReferenceBandGroups(options).flatMap(group=>group.bands.map(({id,label,color,opacity})=>({id,label,color,opacity}))).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);}
export function sameReferenceBandStyles(a:readonly NativeReferenceBandStyle[],b:readonly NativeReferenceBandStyle[]):boolean{return a.length===b.length&&a.every((band,index)=>{const other=b[index];return band.id===other?.id&&band.label===other.label&&band.color===other.color&&band.opacity===other.opacity;});}
/** Raw-ID validation belongs to optionsDiagnostic; hidden/off-window points
 * stay configured there but do not need paint metadata in the current frame. */
export function visiblePointAppearance(scene:NativeScene,configured:readonly NativePointAppearance[]|undefined):readonly NativePointAppearance[]|undefined{
  if(configured===undefined)return undefined;
  const key=sceneInteractionKey(scene);let ids=projectedIds.get(key);if(!ids){ids=new Set(scene.observations.map(point=>identityKey(point.id)));projectedIds.set(key,ids);}
  return configured.filter(point=>ids.has(identityKey(point)));
}
