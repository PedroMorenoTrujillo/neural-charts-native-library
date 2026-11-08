import type {NativeColorAxisScale} from './tilemap-data.js';
import type {NativeTextStyleOptions} from '../library/contracts.js';
import type {NativeUnstackedLayoutOptions} from './data-options.js';
export interface NativeHeatmapCategory {readonly id:string;readonly label?:string;}
export interface NativeHeatmapAxis {readonly type:'category';readonly values:readonly NativeHeatmapCategory[];readonly reversed?:boolean;}
export interface NativeHeatmapCell {readonly id:string;readonly rowId:string;readonly columnId:string;readonly value:number|null;readonly datum?:never;readonly color?:never;}
export interface NativeHeatmapData {
  readonly type:'heatmap';readonly axes:Readonly<{x:NativeHeatmapAxis;y:NativeHeatmapAxis}>;readonly data:readonly NativeHeatmapCell[];readonly unit?:string;
  readonly family?:never;readonly title?:never;readonly description?:never;readonly color?:never;readonly colorAxis?:never;readonly gapRatio?:never;readonly opacity?:never;
}
export interface NativeHeatmapLayoutOptions extends NativeUnstackedLayoutOptions {readonly gapRatio?:number;readonly stackLabels?:never;}
export interface NativeHeatmapColorAxisOptions {readonly visible?:boolean;readonly scale?:NativeColorAxisScale;}
export interface NativeHeatmapAxisOptions {readonly visible?:boolean;readonly title?:string;readonly titleStyle?:NativeTextStyleOptions;readonly referenceLines?:never;}
export interface NativeHeatmapAxesOptions {readonly x?:NativeHeatmapAxisOptions;readonly y?:NativeHeatmapAxisOptions;readonly grid?:never;}
