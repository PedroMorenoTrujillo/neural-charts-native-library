import type {NativeUnstackedLayoutOptions} from './data-options.js';
export interface NativeDendrogramNode {
  readonly id:string;readonly label?:string;readonly height?:number;
  readonly children?:readonly NativeDendrogramNode[];
}
export interface NativeDendrogramData {
  readonly type:'dendrogram';readonly root:NativeDendrogramNode;readonly unit?:string;
  readonly family?:never;readonly title?:never;readonly description?:never;readonly orientation?:never;
}
export interface NativeDendrogramLayoutOptions extends NativeUnstackedLayoutOptions {readonly orientation?:'horizontal'|'vertical';readonly stackLabels?:never;}
export interface NativeDendrogramAxesOptions {readonly visible?:boolean;readonly x?:never;readonly y?:never;readonly grid?:never;}
