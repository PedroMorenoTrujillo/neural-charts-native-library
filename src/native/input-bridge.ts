import {InjectionToken} from '@angular/core';
import type {NativeScene} from '../library/contracts.js';
import type {ViewportGestureFrame} from './viewport-gestures.js';

export interface ChartInputHandlers {
  /** Host lifecycle; pinned detail may disable exploration while remaining active. */
  active?():boolean;
  enabled?():boolean;
  layout?(width: number, height: number): void;
  /** Consume a visible overlay before point exploration starts. */
  consumeTap?(x:number,y:number,width:number,height:number):boolean;
  begin(x: number, y: number, width: number, height: number): void;
  tap?(x:number,y:number,width:number,height:number):void;
  move(x: number, y: number): void;
  end(commit: boolean): void;
  step(delta: -1 | 1): void;
  jump?(edge: 'first' | 'last'): void;
  clear(): void;
  viewport?:Readonly<{
    enabled():boolean;
    pinch:boolean;
    pan:boolean;
    begin(frame:ViewportGestureFrame,width:number,height:number):void;
    update(frame:ViewportGestureFrame):void;
    end(frame:ViewportGestureFrame,success:boolean):void;
  }>;
}
/** Optional host-specific input. Native uses its recognizers; the docs host supplies Pointer Events. */
export interface ChartInputBridge {
  connect(target: unknown, handlers: ChartInputHandlers, scene: NativeScene): () => void;
}
export const CHART_INPUT_BRIDGE = new InjectionToken<ChartInputBridge>('chart-input-host');
