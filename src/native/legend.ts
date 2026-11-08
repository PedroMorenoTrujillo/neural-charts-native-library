import {Component,computed,input,output,signal} from '@angular/core';
import {View,Text,Pressable,ScrollView,type LayoutEvent} from '@ng-native/components';
import type {NativeLegendItem} from '../library/contracts.js';

/** Presentation only. The chart owns visibility, selection and replanning. */
@Component({
  selector:'nc-native-legend',imports:[View,Text,Pressable,ScrollView],
  template:`<scroll-view class="viewport" testID="chart-legend-scroll" [style.maxHeight]="boundedMaximum()" [nestedScrollEnabled]="true" [showsVerticalScrollIndicator]="false">
    <view class="legend" [style.flexDirection]="vertical()?'column':'row'" [style.flexWrap]="vertical()?'nowrap':'wrap'" testID="chart-legend-content" (layout)="measure($event)">
      @for(series of items();track series.id){
        @if(interactive()){
          <pressable class="legend-item legend-toggle" accessibilityRole="button" [accessibilityState]="{selected:series.visible}" [accessibilityLabel]="(locale()==='en'?(series.visible?'Hide ':'Show '):(series.visible?'Ocultar ':'Mostrar '))+series.name" (press)="toggle.emit(series.id)">
            <view class="swatch" [style.backgroundColor]="series.color" [style.opacity]="series.visible?1:0.35"/>
            <text class="legend-name" [style.color]="series.visible?ink():muted()">{{series.name}}</text>
            @if(!series.visible){<text class="legend-hidden" [style.color]="muted()">{{locale()==='en'?'Hidden':'Oculta'}}</text>}
          </pressable>
        }@else{
          <view class="legend-item"><view class="swatch" [style.backgroundColor]="series.color" [style.opacity]="series.visible?1:0.35"/><text class="legend-name" [style.color]="series.visible?ink():muted()">{{series.name}}</text>@if(!series.visible){<text class="legend-hidden" [style.color]="muted()">{{locale()==='en'?'Hidden':'Oculta'}}</text>}</view>
        }
      }
    </view>
  </scroll-view>
  @if(overflow()){<text class="scroll-hint" [style.color]="muted()">{{locale()==='en'?'Scroll to see more series':'Desliza para ver más series'}}</text>}`,
  styles:`:host{min-width:0;}.viewport{flex-grow:0;flex-shrink:1;}.legend{flex-direction:row;flex-wrap:wrap;gap:18px;padding-top:6px;}.legend-item{flex-direction:row;align-items:center;gap:7px;max-width:100%;min-width:0;}.legend-name{flex-shrink:1;min-width:0;font-size:15px;}.legend-toggle{min-height:48px;padding-top:8px;padding-bottom:8px;}.legend-hidden{font-size:12px;flex-shrink:0;}.swatch{width:18px;height:3px;flex-shrink:0;}.scroll-hint{font-size:12px;margin-top:6px;}`,
})
export class NativeLegend{
  readonly items=input.required<readonly NativeLegendItem[]>();
  readonly interactive=input(false);
  readonly vertical=input(false);
  readonly maximumHeight=input(144);
  readonly locale=input<'es'|'en'>('es');
  readonly ink=input('#263449');readonly muted=input('#536174');
  readonly toggle=output<string>();
  private readonly contentHeight=signal(0);
  protected readonly boundedMaximum=computed(()=>Math.max(80,Math.min(600,Number.isFinite(this.maximumHeight())?this.maximumHeight():144)));
  protected readonly overflow=computed(()=>this.contentHeight()>this.boundedMaximum()+1);
  protected measure(event:LayoutEvent):void{const height=event.nativeEvent.layout.height;if(Number.isFinite(height)&&height>=0)this.contentHeight.set(height);}
}
