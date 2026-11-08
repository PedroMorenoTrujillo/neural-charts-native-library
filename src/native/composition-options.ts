import type {NativeAxesOptions,NativeAxisOptions,NativeFormatOptions,NativeStackedLayoutOptions} from './data-options.js';
/** Stable partition of the original column series; no source values are duplicated. */
export interface NativeStackGroup{readonly id:string;readonly label:string;readonly seriesIds:readonly string[];}
export interface NativeGroupedStackLayoutOptions extends Omit<NativeStackedLayoutOptions,'stackGroups'>{readonly stackGroups:readonly NativeStackGroup[];}
export interface NativeMixedAxesOptions extends NativeAxesOptions<'mixed'>{readonly secondaryY?:NativeAxisOptions<number,true>;}
export interface NativeMixedFormatOptions extends NativeFormatOptions{readonly secondaryUnit?:string;}
export function sameStackGroups(a:readonly NativeStackGroup[]|undefined,b:readonly NativeStackGroup[]|undefined):boolean{return a===b||!!a&&!!b&&a.length===b.length&&a.every((g,i)=>{const h=b[i]!;return g.id===h.id&&g.label===h.label&&g.seriesIds.length===h.seriesIds.length&&g.seriesIds.every((id,j)=>id===h.seriesIds[j]);});}
