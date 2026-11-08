import type {NativeUnstackedLayoutOptions} from './data-options.js';
export interface NativeParallelAxis {readonly id:string;readonly label?:string;readonly type:'linear';readonly unit?:string;readonly domain?:readonly[number,number];readonly reversed?:boolean;readonly nice?:boolean;readonly ticks?:Readonly<{targetCount?:number}>;}
export interface NativeParallelPoint {readonly id:string;readonly axisId:string;readonly value:number|null;readonly color?:never;readonly datum?:never;}
export interface NativeParallelSeries {readonly id:string;readonly name:string;readonly data:readonly NativeParallelPoint[];readonly color?:never;}
export interface NativeParallelData {
  readonly type:'parallel';readonly axes:readonly NativeParallelAxis[];readonly series:readonly NativeParallelSeries[];
  readonly family?:never;readonly title?:never;readonly description?:never;readonly color?:never;readonly coordinates?:never;
}
export interface NativeParallelLayoutOptions extends NativeUnstackedLayoutOptions {readonly coordinates?:'cartesian'|'polar';readonly stackLabels?:never;}
export interface NativeParallelAxesOptions {readonly visible?:boolean;readonly labels?:boolean;readonly ticks?:boolean;readonly grid?:never;readonly x?:never;readonly y?:never;}
