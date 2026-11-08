import type {NativeUnstackedLayoutOptions} from './data-options.js';
/** One single-line label per original ID; null is unknown and zero has no glyph. */
export interface NativeWordCloudWord {
  readonly id:string;readonly text:string;readonly weight:number|null;readonly groupId?:string;
  readonly color?:never;readonly datum?:never;
}
export interface NativeWordCloudGroup {readonly id:string;readonly label:string;}
export interface NativeWordCloudData {
  readonly type:'wordcloud';readonly words:readonly NativeWordCloudWord[];readonly groups?:readonly NativeWordCloudGroup[];
  readonly family?:never;readonly title?:never;readonly description?:never;readonly color?:never;
  readonly minFontSize?:never;readonly maxFontSize?:never;readonly padding?:never;
  readonly rotations?:never;readonly seed?:never;readonly maxWords?:never;
}
/** System font, normal weight. The renderer measures every requested size. */
export interface NativeWordCloudLayoutOptions extends NativeUnstackedLayoutOptions {
  readonly minFontSize?:number;readonly maxFontSize?:number;
  readonly padding?:number;readonly rotations?:readonly (0|90)[];
  readonly seed?:number;readonly maxWords?:number;readonly stackLabels?:never;
}
