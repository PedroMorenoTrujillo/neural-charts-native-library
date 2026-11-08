import type {PlanContourAxis,PlanContourGrid} from '@neural-charts/core/plan';
import type {NativeUnstackedLayoutOptions} from './data-options.js';

export interface NativeContourGrid extends PlanContourGrid {
  readonly id:string;
  readonly x:readonly number[];
  readonly y:readonly number[];
  readonly ids:readonly string[];
  readonly values:readonly(number|null)[];
  readonly unit?:string;
}
/** Source measurements only. Isoline thresholds belong to options.layout. */
export interface NativeContourData {
  readonly type:'contour';
  readonly axes:Readonly<{x:Omit<PlanContourAxis,'title'|'grid'|'labels'>&Readonly<{title?:never;grid?:never;labels?:never}>;y:Omit<PlanContourAxis,'title'|'grid'|'labels'>&Readonly<{title?:never;grid?:never;labels?:never}>}>;
  readonly grid:NativeContourGrid;
  readonly family?:never;readonly title?:never;readonly description?:never;readonly color?:never;
  readonly contour?:never;readonly levels?:never;readonly segmentBudget?:never;
}
export interface NativeContourLevel {readonly id:string;readonly value:number;readonly name?:never;readonly color?:never;}
export interface NativeContourLayoutOptions extends NativeUnstackedLayoutOptions {
  readonly stackLabels?:never;
  /** One to eight strictly increasing finite scalar values, with stable unique IDs. */
  readonly levels:readonly NativeContourLevel[];
  /** Complete calculation budget, before clipping. Default4096, maximum8192. */
  readonly segmentBudget?:number;
}
