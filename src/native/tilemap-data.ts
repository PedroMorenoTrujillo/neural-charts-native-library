export type NativeTileShape='hexagon'|'circle'|'diamond'|'square';
export interface NativeTilemapPoint {
  readonly id:string;readonly x:number;readonly y:number;readonly value:number|null;readonly name?:string;
  readonly color?:never;readonly datum?:never;
}
export interface NativeTilemapSeries {readonly id:string;readonly name:string;readonly data:readonly NativeTilemapPoint[];readonly color?:never;}
export interface NativeTilemapData {
  readonly type:'tilemap';readonly unit?:string;
  readonly series:readonly [NativeTilemapSeries];
  readonly family?:never;readonly title?:never;readonly description?:never;readonly color?:never;
  readonly tileShape?:never;readonly pointPadding?:never;readonly opacity?:never;readonly colorAxis?:never;
}
export interface NativeTilemapLayoutOptions {
  readonly tileShape?:NativeTileShape;readonly pointPadding?:number;
  readonly minRadiusRatio?:never;readonly radiusScale?:never;readonly columns?:never;
  readonly markerRadius?:never;readonly whiskerWidth?:never;readonly capWidth?:never;
  readonly neckWidth?:never;readonly neckHeight?:never;readonly reversed?:never;
  readonly stacking?:never;readonly stackLabels?:never;
}
export interface NativeColorStop {readonly at:number;readonly color:string;}
export interface NativeColorClass {readonly id:string;readonly label:string;readonly minInclusive?:number;readonly maxExclusive?:number;readonly color:string;}
export type NativeColorAxisScale=(
  Readonly<{type:'continuous';domain?:readonly [number,number];stops:readonly NativeColorStop[];missingColor:string}>
  |Readonly<{type:'classes';classes:readonly NativeColorClass[];missingColor:string;unclassifiedColor:string}>
);
export interface NativeTilemapColorAxisOptions {readonly visible?:boolean;readonly scale?:NativeColorAxisScale;}
