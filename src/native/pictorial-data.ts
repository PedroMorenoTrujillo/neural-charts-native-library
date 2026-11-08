export interface NativePictorialVertex {readonly x:number;readonly y:number;}
export interface NativePictorialMesh {
  readonly id:string;
  readonly aspectRatio:number;
  readonly vertices:readonly NativePictorialVertex[];
  readonly triangles:readonly (readonly [number,number,number])[];
}
export type NativePictorialShape=Readonly<{type:'preset';name:'person'|'bottle'|'heart'}>|Readonly<{type:'mesh';mesh:NativePictorialMesh}>;
export interface NativePictorialPoint {
  readonly id:string;readonly x:string;readonly y:number|null;
  readonly color?:never;readonly datum?:never;
}
export interface NativePictorialSeries {
  readonly id:string;readonly name:string;readonly data:readonly NativePictorialPoint[];
  readonly color?:never;
}
export interface NativePictorialAxesData {
  readonly x:Readonly<{type:'category';values:readonly Readonly<{id:string;label:string}>[];title?:never;grid?:never;labels?:never}>;
  readonly y:Readonly<{type:'linear';domain?:readonly [0,number];unit?:string;title?:never;grid?:never;labels?:never}>;
}
/** Measurements and semantic axes only; silhouette and paint belong to options. */
export interface NativePictorialData {
  readonly type:'pictorial';
  readonly axes:NativePictorialAxesData;
  readonly series:readonly NativePictorialSeries[];
  readonly family?:never;readonly title?:never;readonly description?:never;
  readonly color?:never;readonly pictorial?:never;
}
export interface NativePictorialLayoutOptions {
  readonly minRadiusRatio?:never;readonly radiusScale?:never;readonly columns?:never;
  readonly markerRadius?:never;readonly whiskerWidth?:never;readonly capWidth?:never;
  readonly neckWidth?:never;readonly neckHeight?:never;readonly reversed?:never;
  readonly shape?:NativePictorialShape;
  readonly gap?:number;
  readonly background?:boolean;
  readonly stacking?:'sum'|'percent';
  readonly stackLabels?:never;
}
