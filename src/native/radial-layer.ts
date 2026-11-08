import {Component,input,computed} from '@angular/core';
import {View} from '@ng-native/components';
import {AnimatedStyle} from '@ng-native/components/animations';
import {WorkletStyle} from '@ng-native/components/reanimated';
import {NgIcon} from '@ng-native/icons';
import type {WorkletStyleSpec} from '@ng-native/components/reanimated';
import type {RadialEntrance} from './radial-entrance.js';

export interface RadialNativeStyles {readonly first:WorkletStyleSpec;readonly firstCounter:WorkletStyleSpec;readonly second:WorkletStyleSpec;readonly secondCounter:WorkletStyleSpec;}
export interface RadialBrowserStyles {readonly first:Record<string,unknown>;readonly firstCounter:Record<string,unknown>;readonly second:Record<string,unknown>;readonly secondCounter:Record<string,unknown>;}

/** Two transparent rotating clips. Counter-rotation keeps Core geometry fixed. */
@Component({
  selector:'nc-chart-radial-layer',imports:[View,AnimatedStyle,WorkletStyle,NgIcon],
  styles:`:host{position:absolute;left:0;top:0;width:100%;height:100%;}.frame,.half,.square,.drawing{position:absolute;top:0;}.half{overflow:hidden;}.drawing{pointer-events:none;}`,
  template:`<view class="frame" [style.left]="layout().left" [style.top]="layout().top" [style.width]="layout().size" [style.height]="layout().size" [animatedStyle]="layout().baseStyle" pointerEvents="none">
    <view class="half" [collapsable]="false" [style.left]="layout().radius" [style.width]="layout().radius" [style.height]="layout().size" pointerEvents="none">
      @if(native();as motion){
        <view class="square" [collapsable]="false" [style.left]="-layout().radius" [style.width]="layout().size" [style.height]="layout().size" [workletStyle]="motion.first" pointerEvents="none">
          <view class="half" [collapsable]="false" [style.left]="0" [style.width]="layout().radius" [style.height]="layout().size" pointerEvents="none"><view class="square" [collapsable]="false" [style.left]="0" [style.width]="layout().size" [style.height]="layout().size" [workletStyle]="motion.firstCounter" pointerEvents="none"><ng-icon class="drawing" [style.left]="layout().canvasLeft" [style.top]="layout().canvasTop" [style.width]="layout().canvasWidth" [style.height]="layout().canvasHeight" [svg]="drawing()"/></view></view>
        </view>
      }@else if(browser();as motion){
        <view class="square" [style.left]="-layout().radius" [style.width]="layout().size" [style.height]="layout().size" [animatedStyle]="motion.first" pointerEvents="none">
          <view class="half" [style.left]="0" [style.width]="layout().radius" [style.height]="layout().size" pointerEvents="none"><view class="square" [style.left]="0" [style.width]="layout().size" [style.height]="layout().size" [animatedStyle]="motion.firstCounter" pointerEvents="none"><ng-icon class="drawing" [style.left]="layout().canvasLeft" [style.top]="layout().canvasTop" [style.width]="layout().canvasWidth" [style.height]="layout().canvasHeight" [svg]="drawing()"/></view></view>
        </view>
      }
    </view>
    @if(secondHalf()){
    <view class="half" [collapsable]="false" [style.left]="0" [style.width]="layout().radius" [style.height]="layout().size" pointerEvents="none">
      @if(native();as motion){
        <view class="square" [collapsable]="false" [style.left]="0" [style.width]="layout().size" [style.height]="layout().size" [workletStyle]="motion.second" pointerEvents="none">
          <view class="half" [collapsable]="false" [style.left]="layout().radius" [style.width]="layout().radius" [style.height]="layout().size" pointerEvents="none"><view class="square" [collapsable]="false" [style.left]="-layout().radius" [style.width]="layout().size" [style.height]="layout().size" [workletStyle]="motion.secondCounter" pointerEvents="none"><ng-icon class="drawing" [style.left]="layout().canvasLeft" [style.top]="layout().canvasTop" [style.width]="layout().canvasWidth" [style.height]="layout().canvasHeight" [svg]="drawing()"/></view></view>
        </view>
      }@else if(browser();as motion){
        <view class="square" [style.left]="0" [style.width]="layout().size" [style.height]="layout().size" [animatedStyle]="motion.second" pointerEvents="none">
          <view class="half" [style.left]="layout().radius" [style.width]="layout().radius" [style.height]="layout().size" pointerEvents="none"><view class="square" [style.left]="-layout().radius" [style.width]="layout().size" [style.height]="layout().size" [animatedStyle]="motion.secondCounter" pointerEvents="none"><ng-icon class="drawing" [style.left]="layout().canvasLeft" [style.top]="layout().canvasTop" [style.width]="layout().canvasWidth" [style.height]="layout().canvasHeight" [svg]="drawing()"/></view></view>
        </view>
      }
    </view>
    }
  </view>`,
})
export class NativeRadialLayer {
  readonly layout=input.required<RadialEntrance>();readonly drawing=input.required<string>();
  protected readonly secondHalf=computed(()=>this.layout().sweepRadians>Math.PI);
  readonly native=input<RadialNativeStyles|undefined>(undefined);readonly browser=input<RadialBrowserStyles|undefined>(undefined);
}
