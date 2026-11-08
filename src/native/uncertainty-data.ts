/** Source estimates and intervals. Probabilities and forecasts are supplied by the caller. */
export interface NativeFanBand {readonly id:string;readonly label:string;readonly coverage:number;readonly color?:never;}
export interface NativeFanInterval{readonly bandId:string;readonly low:number|null;readonly high:number|null;}
export interface NativeFanPoint<TX=string|number>{readonly id:string;readonly x:TX;readonly value:number|null;readonly intervals:readonly NativeFanInterval[];readonly color?:never;readonly datum?:never;}
export interface NativeUncertaintyTicks{readonly targetCount?:number;}
export interface NativeUncertaintyNumericAxis{readonly type:'linear';readonly domain?:readonly[number,number];readonly includeZero?:boolean;readonly reversed?:boolean;readonly nice?:boolean;readonly ticks?:NativeUncertaintyTicks;readonly title?:never;readonly grid?:never;readonly labels?:never;}
export interface NativeFanCategory{readonly id:string;readonly label?:string;}
export interface NativeFanCategoryAxis{readonly type:'category';readonly values:readonly NativeFanCategory[];readonly edgeSpacing?:number;readonly ticks?:NativeUncertaintyTicks;readonly title?:never;readonly grid?:never;readonly labels?:never;}
export interface NativeFanContinuousAxis{readonly type:'linear'|'time';readonly domain?:readonly[number,number];readonly nice?:boolean;readonly ticks?:NativeUncertaintyTicks;readonly reversed?:never;readonly includeZero?:never;readonly title?:never;readonly grid?:never;readonly labels?:never;}
export interface NativeFanBase{readonly type:'fan';readonly bands:readonly NativeFanBand[];readonly family?:never;readonly title?:never;readonly description?:never;readonly centerName?:never;readonly centerColor?:never;}
export interface NativeFanCategoryData extends NativeFanBase{readonly axes:Readonly<{x:NativeFanCategoryAxis;y:NativeUncertaintyNumericAxis}>;readonly data:readonly NativeFanPoint<string>[];}
export interface NativeFanNumericData extends NativeFanBase{readonly axes:Readonly<{x:NativeFanContinuousAxis;y:NativeUncertaintyNumericAxis}>;readonly data:readonly NativeFanPoint<number>[];}
export type NativeFanData=NativeFanCategoryData|NativeFanNumericData;
export interface NativeRegressionPoint{readonly id:string;readonly x:number|null;readonly y:number|null;readonly color?:never;readonly datum?:never;}
export interface NativeRegressionSeries{readonly id:string;readonly name:string;readonly data:readonly NativeRegressionPoint[];readonly color?:never;readonly markers?:never;readonly datum?:never;}
/** Original samples only. Derived fits retain independent IDs and visibility. */
export interface NativeRegressionData{readonly type:'regression';readonly axes:Readonly<{x:NativeUncertaintyNumericAxis;y:NativeUncertaintyNumericAxis}>;readonly series:readonly NativeRegressionSeries[];readonly family?:never;readonly title?:never;readonly description?:never;}
