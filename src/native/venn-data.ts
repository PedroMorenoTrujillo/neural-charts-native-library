import type {NativeUnstackedLayoutOptions} from './data-options.js';
export interface NativeVennSet {readonly id:string;readonly label:string;readonly color?:never;}
/** Inclusive intersection, with a unique original measurement ID. */
export interface NativeVennMeasure {
  readonly id:string;readonly sets:readonly string[];readonly value:number|null;
  readonly color?:never;readonly datum?:never;
}
export interface NativeVennData {
  readonly type:'venn';readonly sets:readonly NativeVennSet[];readonly data:readonly NativeVennMeasure[];
  readonly family?:never;readonly title?:never;readonly description?:never;readonly color?:never;readonly padding?:never;
}
export interface NativeVennLayoutOptions extends NativeUnstackedLayoutOptions {
  readonly padding?:number;readonly stackLabels?:never;
}
