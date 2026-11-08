import type {PlanScales} from '@neural-charts/core/plan';
import type {NativeChartOptions} from './data-options.js';
export function nativeLogScales(options:NativeChartOptions):PlanScales|undefined{
 const x=options.axes?.x,y=options.axes?.y,logX=x&&'scale' in x?x.scale:undefined,logY=y&&'scale' in y?y.scale:undefined;
 return logX||logY?{...(logX?{x:logX}:{}),...(logY?{y:logY}:{})}:undefined;
}
export function sameLogScales(a:PlanScales|undefined,b:PlanScales|undefined):boolean{return a===b||a?.x?.type===b?.x?.type&&a?.x?.base===b?.x?.base&&a?.y?.type===b?.y?.type&&a?.y?.base===b?.y?.base;}
