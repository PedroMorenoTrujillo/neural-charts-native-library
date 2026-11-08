import type {PlanViewportValue,PlanViewportIntent,PlanViewportState} from './plan.js';
import type {NativeViewportChange} from './data-options.js';

export interface NativeViewportRequest {readonly intent:PlanViewportIntent;readonly source:NativeViewportChange['source'];readonly model?:PlanViewportState;}
/** Internal render context. Data/window math remains in the public Core. */
export interface NativeViewportContext {
  readonly model:PlanViewportState;
  readonly generation:object;
  readonly revision:number;
  readonly acknowledgment:number;
  readonly pinch:boolean;
  readonly pan:boolean;
  readonly controls:boolean;
}
/** Two axes only; never walk observations, stringify data or compare labels. */
export function sameViewportValue(a:PlanViewportValue,b:PlanViewportValue):boolean{
  return (['x','y'] as const).every(axis=>{
    const x=a[axis],y=b[axis];if(x===y)return true;if(!x||!y)return false;
    if(Array.isArray(x)&&Array.isArray(y))return x[0]===y[0]&&x[1]===y[1];
    return !Array.isArray(x)&&!Array.isArray(y)&&'firstId' in x&&'firstId' in y&&x.firstId===y.firstId&&x.lastId===y.lastId;
  });
}
