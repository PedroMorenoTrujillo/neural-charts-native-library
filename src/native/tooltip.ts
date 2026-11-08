import { Component, computed, effect, input, output } from '@angular/core';
import {comparisonDetails} from './comparison-format.js';
import {relationshipPrimaryLabel} from './relationship-format.js';
import {observationValue,observationUnit,directionalDetails} from './observation-format.js';
import type {ChartFamily} from '../library/contracts.js';
import { Text, View, ScrollView, Pressable, type LayoutEvent } from '@ng-native/components';
import type { Observation,SharedSelection } from '../library/contracts.js';
import {chartNumberFormatter,chartPercentageFormatter} from './number-format.ts';

/** Presentation only. The chart owns selection and bounded positioning. */
@Component({
  selector:'nc-native-tooltip', imports:[Text,View,ScrollView,Pressable],
  template:`<view class="tooltip" testID="chart-tooltip" [style.height]="compactHeight()" [pointerEvents]="allowScroll() ? 'auto' : 'none'" (layout)="measure($event)"
    [style.backgroundColor]="dark()?'#17263A':'#FFFFFF'" [style.borderColor]="point().color">
    @if(pinned()){
      <view class="tooltip-heading"><text class="pinned-label" [style.color]="dark()?'#D6E2F2':'#3D4B60'">{{locale()==='en'?'Pinned':'Fijado'}}</text><pressable class="close" accessibilityRole="button" [accessibilityLabel]="locale()==='en'?'Close pinned tooltip':'Cerrar tooltip fijado'" (press)="dismiss.emit()"><text [style.color]="dark()?'#F2F6FC':'#172438'">{{locale()==='en'?'Close':'Cerrar'}}</text></pressable></view>
    }
    <scroll-view class="tooltip-body" testID="chart-tooltip-body" [style.maxHeight]="allowScroll()?maximumHeight():undefined" [nestedScrollEnabled]="true" [scrollEnabled]="allowScroll()">
    <view class="tooltip-content">
    @if(shared();as group){
      <text class="label" [numberOfLines]="compactHeight()!==undefined?1:allowScroll()?undefined:2" [style.color]="dark()?'#D6E2F2':'#3D4B60'">{{group.label}}</text>
        @for(row of group.rows;track row.seriesId){<view class="shared-row" [style.flexDirection]="family()==='boxplot'?'column':'row'">
          <view class="swatch" [style.backgroundColor]="row.color" [accessible]="false"/>
          <text class="row-name" [numberOfLines]="compactHeight()!==undefined?1:allowScroll()?undefined:2" [style.color]="dark()?'#D6E2F2':'#3D4B60'">{{row.name}}</text>
          <view class="row-values" [style.maxWidth]="family()==='boxplot'?'100%':'45%'"><text class="row-value" [numberOfLines]="family()==='boxplot'?undefined:compactHeight()!==undefined?1:undefined" [style.color]="dark()?'#F2F6FC':'#172438'">{{row.point ? pointValue(row.point)+' '+pointUnit(row.point) : locale()==='en'?'No value':'Sin dato'}}</text>
          @if(row.point&&row.point.percentage!==undefined){<text class="row-percentage" [numberOfLines]="compactHeight()!==undefined?1:undefined" [style.color]="dark()?'#B6C8DD':'#536174'">{{percentageValue(row.point.percentage)}}%</text>}@if(row.point){@for(detail of rowDetails(row.point);track $index){<text class="row-percentage" [numberOfLines]="compactHeight()!==undefined?1:undefined" [style.color]="dark()?'#B6C8DD':'#536174'">{{detail}}</text>}}</view>
        </view>}
    }@else{
    <text class="label" [numberOfLines]="compactHeight()!==undefined?1:allowScroll()?undefined:2" [style.color]="dark()?'#D6E2F2':'#3D4B60'">{{point().label}}{{family()!=='heatmap' && point().seriesName && point().seriesName!==point().label && point().seriesName!==unit() ? ' · '+point().seriesName : ''}}</text>
    <text class="value" [numberOfLines]="compactHeight()!==undefined?1:allowScroll()?undefined:2" [style.color]="dark()?'#F2F6FC':'#172438'">{{formatted()}} {{pointUnit(point())}}</text>
    @if(point().minimumValue!==undefined){<text class="extra" [style.color]="dark()?'#B6C8DD':'#536174'">{{locale()==='en'?'Minimum':'Mínimo'}}: {{number(point().minimumValue!)}} · Q1: {{number(point().q1Value!)}}</text><text class="extra" [style.color]="dark()?'#B6C8DD':'#536174'">Q3: {{number(point().q3Value!)}} · {{locale()==='en'?'Maximum':'Máximo'}}: {{number(point().maximumValue!)}}</text>}
    @if(point().node;as node){@if(node.directed!==false){<text class="extra" [style.color]="dark()?'#B6C8DD':'#536174'">{{locale()==='en'?'Incoming':'Entrantes'}}: {{number(node.incoming)}} · {{locale()==='en'?'Outgoing':'Salientes'}}: {{number(node.outgoing)}}</text><text class="extra" [style.color]="dark()?'#B6C8DD':'#536174'">{{locale()==='en'?'Depth':'Profundidad'}}: {{number(node.depth)}}</text>}}
    @if(point().subtotal){<text class="extra" [numberOfLines]="1" [style.color]="dark()?'#B6C8DD':'#536174'">{{locale()==='en'?(point().incomplete?'Known subtotal · incomplete':'Subtotal'):(point().incomplete?'Subtotal conocido · incompleto':'Subtotal')}}</text>}
    @if(point().computedKind){<text class="extra" [numberOfLines]="1" [style.color]="dark()?'#B6C8DD':'#536174'">{{point().computedKind==='total'?(locale()==='en'?'Calculated total':'Total calculado'):(locale()==='en'?'Calculated subtotal':'Subtotal calculado')}}</text>}
    @for(detail of details();track $index){<text class="extra" [numberOfLines]="compactHeight()!==undefined?1:undefined" [style.color]="dark()?'#B6C8DD':'#536174'">{{detail}}</text>}
    @if(point().xValue !== undefined&&!point().interval&&!point().event){<text class="extra" [numberOfLines]="compactHeight()!==undefined?1:undefined" [style.color]="dark()?'#B6C8DD':'#536174'">{{xTitle()||'X'}}: {{xValue()}}</text>}
    @if(point().percentage !== undefined){<text class="extra" [numberOfLines]="compactHeight()!==undefined?1:undefined" [style.color]="dark()?'#B6C8DD':'#536174'">{{percentage()}}%</text>}
    @if(point().sizeValue !== undefined){<text class="extra" [numberOfLines]="compactHeight()!==undefined?1:undefined" [style.color]="dark()?'#B6C8DD':'#536174'">{{locale()==='en'?'Size':'Tamaño'}}: {{size()}}</text>}
    }
    </view></scroll-view>
  </view>`,
  styles:`:host{display:flex;min-width:0;} .tooltip{border-width:1px;border-radius:9px;overflow:hidden;}
    .tooltip-body{flex-grow:0;flex-shrink:1;} .tooltip-content{padding:12px;gap:3px;}
    .tooltip-heading{flex-direction:row;align-items:center;gap:8px;padding:8px;} .pinned-label{flex:1;font-size:13px;font-weight:600;} .close{min-height:48px;min-width:64px;padding:8px;align-items:center;justify-content:center;border-radius:6px;}
    .label{font-size:12px;line-height:16px;font-weight:500;} .value{font-size:19px;line-height:25px;font-weight:600;} .extra{font-size:12px;line-height:16px;}
    .shared-row{flex-direction:row;align-items:flex-start;gap:8px;padding-top:7px;padding-bottom:7px;}
    .swatch{width:8px;height:8px;border-radius:4px;flex-shrink:0;margin-top:4px;} .row-name{flex:1;min-width:0;font-size:13px;line-height:18px;} .row-values{flex-shrink:1;max-width:45%;gap:3px;} .row-value{font-size:13px;line-height:18px;font-weight:600;}.row-percentage{font-size:12px;line-height:16px;}`,
})
export class NativeTooltip {
  private lastLayout:Readonly<{width:number;height:number}>|undefined;
  readonly point=input.required<Observation>();
  readonly compactHeight=input<number|undefined>(undefined);
  readonly detailRows=input<readonly string[]|undefined>(undefined);
  readonly shared=input<SharedSelection|undefined>(undefined);
  readonly allowScroll=input(false);
  readonly pinned=input(false);
  readonly maximumHeight=input(220);
  readonly dismiss=output<void>();
  readonly unit=input('');readonly secondaryUnit=input('');readonly xTitle=input('');readonly locale=input<'es'|'en'>('es');readonly dark=input(false);
  readonly measured=output<Readonly<{width:number;height:number}>>();
  private readonly formatter=computed(()=>chartNumberFormatter(this.locale()));
  readonly family=input<ChartFamily>('line');
  protected readonly formatted=computed(()=>{
    const point=this.point(),format=this.formatter(),locale=this.locale();
    if(this.family()==='boxplot')return (locale==='en'?'Median: ':'Mediana: ')+format(point.medianValue??point.value);
    // Compact tooltips may ellipsize the descriptor, but must retain the value.
    if(point.relationship)return format(point.value)+' · '+relationshipPrimaryLabel(point,locale);
    return observationValue(point,this.family(),format,locale);
  });
  protected pointUnit(point:Observation):string{return observationUnit(point,this.family(),this.unit(),this.secondaryUnit());}
  protected rowDetails(point:Observation):readonly string[]{return comparisonDetails(point,this.locale(),this.formatter(),this.unit()).map(detail=>detail.label+': '+detail.value);}
  protected pointValue(point:Observation):string{return observationValue(point,this.family(),this.formatter(),this.locale());}
  private readonly percentageFormat=computed(()=>chartPercentageFormatter(this.locale()));
  protected readonly percentage=computed(()=>this.percentageFormat()(this.point().percentage??0));
  protected percentageValue(value:number):string{return this.percentageFormat()(value);}
  protected readonly size=computed(()=>this.formatter()(this.point().sizeValue??0));
  protected readonly details=computed(()=>this.detailRows()??directionalDetails(this.point(),this.formatter(),this.locale(),this.unit(),this.family()));
  protected readonly xValue=computed(()=>this.formatter()(this.point().xValue??0));
  protected number(value:number):string{return this.formatter()(value);}
  constructor(){
    effect(onCleanup=>{
      if(this.allowScroll()||this.compactHeight()!==undefined)return;
      this.point();this.shared();this.unit();this.locale();
      // Native onLayout need not fire when different text has exactly the same size.
      // Reconfirm the latest layout after paint, retaining one cancellable frame.
      let frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(()=>{frame=0;if(this.lastLayout)this.measured.emit(this.lastLayout);});});
      onCleanup(()=>{if(frame)cancelAnimationFrame(frame);});
    });
  }
  protected measure(e:LayoutEvent):void{this.lastLayout=e.nativeEvent.layout;this.measured.emit(this.lastLayout);}
}
