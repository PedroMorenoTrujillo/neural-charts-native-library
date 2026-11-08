import type {PlanTemporalAxis} from './plan.js';
import type {NativeUnstackedLayoutOptions,NativeAxisOptions} from './data-options.js';
export interface NativeFlameSpan {readonly id:string;readonly label:string;readonly start:number;readonly end:number;readonly parentId?:string;readonly color?:never;readonly datum?:never;}
export interface NativeFlameData {readonly type:'flame';readonly axes:Readonly<{x:PlanTemporalAxis}>;readonly data:readonly NativeFlameSpan[];readonly family?:never;readonly title?:never;readonly description?:never;readonly rowPadding?:never;}
export interface NativeFlameLayoutOptions extends NativeUnstackedLayoutOptions {readonly rowPadding?:number;readonly stackLabels?:never;}
export interface NativeFlameAxesOptions {readonly x?:NativeAxisOptions<number>;readonly y?:Omit<NativeAxisOptions,'referenceLines'>&Readonly<{referenceLines?:never}>;readonly grid?:boolean;}
export interface NativeViolinSample {readonly id:string;readonly value:number|null;readonly color?:never;readonly datum?:never;}
export interface NativeViolinGroup {readonly id:string;readonly label:string;readonly samples:readonly NativeViolinSample[];readonly color?:never;}
export interface NativeViolinData {readonly type:'violin';readonly groups:readonly NativeViolinGroup[];readonly axes?:Readonly<{y:Readonly<{type:'linear';domain?:readonly[number,number];reversed?:boolean;nice?:boolean;unit?:string}>}>;readonly family?:never;readonly title?:never;readonly description?:never;readonly bandwidth?:never;readonly resolution?:never;readonly normalization?:never;readonly gapRatio?:never;}
export interface NativeViolinLayoutOptions extends NativeUnstackedLayoutOptions {readonly bandwidth?:number;readonly resolution?:number;readonly normalization?:'width'|'area'|'count';readonly gapRatio?:number;readonly stackLabels?:never;}
export interface NativeViolinAxesOptions {readonly x?:Omit<NativeAxisOptions,'referenceLines'>&Readonly<{referenceLines?:never}>;readonly y?:Omit<NativeAxisOptions,'referenceLines'>&Readonly<{referenceLines?:never}>;readonly grid?:boolean;}
