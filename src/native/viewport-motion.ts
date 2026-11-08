import {InjectionToken} from '@angular/core';
import {sharedValue,workletStyle,type WorkletStyleSpec} from '@ng-native/components/reanimated';
import {Gesture} from 'react-native-gesture-handler';
import {scheduleOnRN} from 'react-native-worklets';
import type {ViewportGestureFrame} from './viewport-gestures.js';

export interface ViewportGestureConfig {readonly width:number;readonly height:number;readonly maximumScale?:number;readonly horizontal:boolean;readonly vertical:boolean;readonly pinch:boolean;readonly pan:boolean;readonly enabled:boolean;}
export interface ViewportGestureCallbacks {readonly begin:()=>void;readonly end:(frame:ViewportGestureFrame,success:boolean,source:'pinch'|'pan')=>void;}
export type ViewportMotionStyles=Readonly<{native?:{base:WorkletStyleSpec;preview:WorkletStyleSpec};browser?:{base:Record<string,unknown>;preview:Record<string,unknown>}}>;
export interface ViewportMotion {
  readonly styles:ViewportMotionStyles;
  gesture(config:ViewportGestureConfig,callbacks:ViewportGestureCallbacks,scroll?:ReturnType<typeof Gesture.Native>):ReturnType<typeof Gesture.Simultaneous>|undefined;
  preview(frame:ViewportGestureFrame,config:ViewportGestureConfig):void;
  show():void;
  finish():void;
  destroy():void;
}
export const CHART_VIEWPORT_MOTION_FACTORY=new InjectionToken<()=>ViewportMotion>('CHART_VIEWPORT_MOTION_FACTORY',{providedIn:'root',factory:()=>()=>new NativeViewportMotion()});

/** Affine presentation preview on the UI thread. One RN commit after both
 * recognizers finish; no data projection, SVG rebuild or Angular move callback. */
export class NativeViewportMotion implements ViewportMotion {
  private callbackTarget:{current:ViewportGestureCallbacks|null}|undefined;
  // Generation belongs to RN. A shared-value .set() reaches UI asynchronously;
  // an immediate .get() can still return the preceding epoch on native hosts.
  private readonly generation={current:0};
  private readonly active=sharedValue(0);
  private readonly ready=sharedValue(0);
  private readonly scale=sharedValue(1);
  private readonly dx=sharedValue(0);private readonly dy=sharedValue(0);
  private readonly ax=sharedValue(0);private readonly ay=sharedValue(0);
  private readonly width=sharedValue(0);private readonly height=sharedValue(0);
  private readonly horizontal=sharedValue(0);private readonly vertical=sharedValue(0);
  private readonly epoch=sharedValue(0);
  private readonly count=sharedValue(0);private readonly pinchLive=sharedValue(0);private readonly panLive=sharedValue(0);
  private readonly cancelled=sharedValue(0);private readonly sawPinch=sharedValue(0);
  readonly styles:ViewportMotionStyles={native:{
    base:workletStyle([this.active,this.ready],(active,ready)=>{'worklet';return {opacity:active.value>0&&ready.value>0?0:1};}),
    preview:workletStyle([this.active,this.ready,this.scale,this.dx,this.dy,this.ax,this.ay,this.width,this.height,this.horizontal,this.vertical],(active,ready,scale,dx,dy,ax,ay,width,height,horizontal,vertical)=>{
      'worklet';const sx=horizontal.value?scale.value:1,sy=vertical.value?scale.value:1;
      return {opacity:active.value>0&&ready.value>0?1:0,transform:[{translateX:dx.value+(1-sx)*(ax.value-width.value/2)},{translateY:dy.value+(1-sy)*(ay.value-height.value/2)},{scaleX:sx},{scaleY:sy}]};
    }),
  }};
  gesture(config:ViewportGestureConfig,callbacks:ViewportGestureCallbacks,scroll?:ReturnType<typeof Gesture.Native>){
    if(this.callbackTarget)this.callbackTarget.current=null;
    const target={current:callbacks as ViewportGestureCallbacks|null};this.callbackTarget=target;
    const {generation,active,ready,scale,dx,dy,ax,ay,width,height,horizontal,vertical,epoch,count,pinchLive,panLive,cancelled,sawPinch}=this;
    const maximumScale=Math.max(1,Math.min(4,config.maximumScale??4));
    const token=++generation.current;epoch.set(token);
    count.set(0);pinchLive.set(0);panLive.set(0);cancelled.set(0);sawPinch.set(0);
    // Reconfiguration cancels a live recognizer. A completed preview stays held
    // until the host acknowledges its already-projected replacement frame.
    if(active.get()===1)this.finish();
    width.set(config.width);height.set(config.height);horizontal.set(config.horizontal?1:0);vertical.set(config.vertical?1:0);
    // Remote RN functions can outlive the recognizer in the worklet cache. They
    // hold a revocable target, never a chart/scene callback after teardown.
    const begin=()=>{if(generation.current===token)target.current?.begin();};
    const end=(frame:ViewportGestureFrame,success:boolean,source:'pinch'|'pan')=>{if(generation.current===token)target.current?.end(frame,success,source);};
    const start=(x:number,y:number)=>{
      'worklet';if(epoch.value!==token||active.value===2)return false;
      if(count.value===0){active.value=1;ready.value=0;scale.value=1;dx.value=0;dy.value=0;ax.value=x;ay.value=y;cancelled.value=0;sawPinch.value=0;scheduleOnRN(begin);}
      count.value+=1;return true;
    };
    const finalize=(type:number,success:boolean)=>{
      'worklet';if(epoch.value!==token)return;
      if(type===0){if(!pinchLive.value)return;pinchLive.value=0;}else{if(!panLive.value)return;panLive.value=0;}
      if(!success)cancelled.value=1;count.value=Math.max(0,count.value-1);
      if(count.value!==0)return;
      const ok=cancelled.value===0;active.value=ok?2:0;
      scheduleOnRN(end,{scale:scale.value,x:ax.value,y:ay.value,dx:dx.value,dy:dy.value},ok,sawPinch.value?'pinch':'pan');
    };
    const pinch=Gesture.Pinch().enabled(config.enabled&&config.pinch).runOnJS(false)
      .onStart(event=>{'worklet';if(event.numberOfPointers===2&&start(event.focalX,event.focalY)){pinchLive.value=1;ax.value=event.focalX;ay.value=event.focalY;sawPinch.value=1;}})
      .onUpdate(event=>{'worklet';if(epoch.value!==token||!pinchLive.value||cancelled.value)return;if(event.numberOfPointers>2||!Number.isFinite(event.scale)){cancelled.value=1;return;}scale.value=Math.max(.25,Math.min(maximumScale,event.scale));})
      .onFinalize((_event,success)=>{'worklet';finalize(0,success);});
    // Claim two contacts before an enclosing vertical ScrollView intercepts a
    // diagonal pinch. A stationary centroid never reaches a pan distance threshold.
    // The same recognizer protects pinch-only mode, without applying translation.
    const pan=Gesture.Pan().enabled(config.enabled&&(config.pan||config.pinch)).minPointers(2).maxPointers(2).minDistance(0).averageTouches(true).runOnJS(false)
      .onStart(event=>{'worklet';if(event.numberOfPointers===2&&start(event.x,event.y))panLive.value=1;})
      .onUpdate(event=>{'worklet';if(epoch.value!==token||!panLive.value||cancelled.value)return;if(event.numberOfPointers>2){cancelled.value=1;return;}dx.value=config.pan&&horizontal.value?event.translationX:0;dy.value=config.pan&&vertical.value?event.translationY:0;})
      .onFinalize((_event,success)=>{'worklet';finalize(1,success);});
    if(scroll){pinch.simultaneousWithExternalGesture(scroll);pan.simultaneousWithExternalGesture(scroll);}
    return Gesture.Simultaneous(pinch,pan);
  }
  preview(frame:ViewportGestureFrame,config:ViewportGestureConfig):void{
    this.width.set(config.width);this.height.set(config.height);this.horizontal.set(config.horizontal?1:0);this.vertical.set(config.vertical?1:0);
    this.active.set(1);this.scale.set(config.pinch?Math.max(.25,Math.min(config.maximumScale??4,frame.scale)):1);this.ax.set(frame.x);this.ay.set(frame.y);this.dx.set(config.pan&&config.horizontal?frame.dx:0);this.dy.set(config.pan&&config.vertical?frame.dy:0);
  }
  show():void{this.ready.set(1);}
  finish():void{this.active.set(0);this.ready.set(0);this.scale.set(1);this.dx.set(0);this.dy.set(0);this.count.set(0);this.pinchLive.set(0);this.panLive.set(0);this.cancelled.set(0);}
  destroy():void{if(this.callbackTarget)this.callbackTarget.current=null;this.callbackTarget=undefined;this.epoch.set(++this.generation.current);this.finish();}
}
