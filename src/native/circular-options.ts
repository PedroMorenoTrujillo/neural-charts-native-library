/** One clockwise sweep from twelve o'clock, supplied in degrees. */
export interface NativeCircularArcOptions{readonly startAngle?:number;readonly endAngle?:number;}
export interface NativePieLayoutOptions extends NativeCircularArcOptions{}
export interface NativeDonutLayoutOptions extends NativeCircularArcOptions{}
export type NativeGaugeLayoutOptions=NativeCircularArcOptions&(
 Readonly<{style?:'solid';tickCount?:never}>|Readonly<{style:'needle';tickCount?:number}>
);
