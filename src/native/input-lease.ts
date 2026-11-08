import type {ChartInputHandlers} from './input-bridge.js';
/** Old host callbacks retain only this revocable box after disconnection. */
export function inputLease(handlers:ChartInputHandlers){
  const target:{current:ChartInputHandlers|null}={current:handlers};
  const live=()=>target.current&&target.current.active?.()!==false?target.current:null;
  const current=()=>{const value=live();return value&&value.enabled?.()!==false?value:null;};
  const callbacks:ChartInputHandlers={
    active:()=>live()!==null,enabled:()=>current()!==null,
    layout:(...args)=>live()?.layout?.(...args),
    consumeTap:(...args)=>current()?.consumeTap?.(...args)??false,
    begin:(...args)=>current()?.begin(...args),tap:(...args)=>current()?.tap?.(...args),
    move:(...args)=>current()?.move(...args),end:commit=>current()?.end(commit),
    step:delta=>current()?.step(delta),clear:()=>live()?.clear(),
    ...(handlers.jump?{jump:(edge:'first'|'last')=>current()?.jump?.(edge)}:{}),
    ...(handlers.viewport?{viewport:{
      enabled:()=>current()?.viewport?.enabled()??false,pinch:handlers.viewport.pinch,pan:handlers.viewport.pan,
      begin:(...args:Parameters<NonNullable<ChartInputHandlers['viewport']>['begin']>)=>current()?.viewport?.begin(...args),
      update:(...args:Parameters<NonNullable<ChartInputHandlers['viewport']>['update']>)=>current()?.viewport?.update(...args),
      end:(...args:Parameters<NonNullable<ChartInputHandlers['viewport']>['end']>)=>current()?.viewport?.end(...args),
    }}:{}),
  };
  return {callbacks,revoke:()=>{target.current=null;}};
}
export interface PointEvent{readonly x:number;readonly y:number;readonly numberOfPointers?:number;}
export interface PointCallbacks{
  start(event:PointEvent):void;move(event:PointEvent):void;end(event:PointEvent,success:boolean):void;
  finalize(event:unknown,success:boolean):void;tap(event:PointEvent,success:boolean):void;
}
export function pointLease(handlers:PointCallbacks){
  const target:{current:PointCallbacks|null}={current:handlers};
  const callbacks:PointCallbacks={start:e=>target.current?.start(e),move:e=>target.current?.move(e),end:(e,s)=>target.current?.end(e,s),finalize:(e,s)=>target.current?.finalize(e,s),tap:(e,s)=>target.current?.tap(e,s)};
  return {callbacks,revoke:()=>{target.current=null;}};
}
