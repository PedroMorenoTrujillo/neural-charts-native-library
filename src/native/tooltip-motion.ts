import {InjectionToken} from '@angular/core';
import {sharedValue,workletStyle,type WorkletStyleSpec} from '@ng-native/components/reanimated';
import {withTiming,cancelAnimation,Easing} from 'react-native-reanimated';

export interface TooltipMotion{
  readonly styles:Readonly<{native?:WorkletStyleSpec;browser?:Record<string,unknown>}>;
  move(x:number,y:number,duration:number):void;
  position():Readonly<{x:number;y:number}>|null;
  hide():void;
  destroy():void;
}
export const CHART_TOOLTIP_MOTION_FACTORY=new InjectionToken<()=>TooltipMotion>('CHART_TOOLTIP_MOTION_FACTORY',{providedIn:'root',factory:()=>()=>new NativeTooltipMotion()});

/** UI-thread movement only. Selection and chart geometry never run per animation frame. */
export class NativeTooltipMotion implements TooltipMotion{
  private readonly x=sharedValue(0);private readonly y=sharedValue(0);
  private visible=false;
  private targetX=0;private targetY=0;
  readonly styles={native:workletStyle([this.x,this.y],(x,y)=>{'worklet';return {transform:[{translateX:x.value},{translateY:y.value}]};})};
  move(x:number,y:number,duration:number):void{
    if(!Number.isFinite(x)||!Number.isFinite(y))return;
    const ms=this.visible?Math.max(0,Math.min(220,Number.isFinite(duration)?duration:0)):0;
    // Keep an in-flight animation toward this target; a zero-duration request
    // still cancels it immediately for resize or reduced motion.
    if(this.visible&&ms>0&&x===this.targetX&&y===this.targetY)return;
    this.targetX=x;this.targetY=y;
    cancelAnimation(this.x);cancelAnimation(this.y);
    this.x.set(ms?withTiming(x,{duration:ms,easing:Easing.out(Easing.cubic)}):x);
    this.y.set(ms?withTiming(y,{duration:ms,easing:Easing.out(Easing.cubic)}):y);
    this.visible=true;
  }
  position():Readonly<{x:number;y:number}>|null{return this.visible?{x:this.x.get(),y:this.y.get()}:null;}
  hide():void{cancelAnimation(this.x);cancelAnimation(this.y);this.visible=false;}
  destroy():void{this.hide();}
}
