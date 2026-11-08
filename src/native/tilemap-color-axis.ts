import {Component,computed,input} from '@angular/core';
import {View,Text} from '@ng-native/components';
import {NgIcon} from '@ng-native/icons';
import type {PlanColorAxisFrame} from '@neural-charts/core/plan';
import {chartNumberFormatter} from './number-format.js';
let axisSequence=0;

/** Native presentation of the Core's exact color scale; no value remapping. */
@Component({
  selector:'nc-tilemap-color-axis',imports:[View,Text,NgIcon],
  template:`<view class="axis" testID="chart-color-axis">
    <text class="heading" [style.color]="ink()">{{locale()==='en'?'Value color scale':'Escala de color del valor'}}</text>
    @if(axis().type==='continuous'){
      <ng-icon class="ramp" testID="chart-color-ramp" [svg]="ramp()"/>
      <text class="range" testID="chart-color-domain" [style.color]="ink()">{{domainLabel()}}</text>
    }@else{
      @for(item of classes();track item.id){<view class="row"><view class="swatch" [style.backgroundColor]="item.color"/><text class="label" [style.color]="ink()">{{item.label}} · {{classRange(item)}}</text></view>}
      <view class="row"><view class="swatch" [style.backgroundColor]="unclassified()"/><text class="label" [style.color]="ink()">{{locale()==='en'?'Outside declared classes':'Fuera de las clases declaradas'}}</text></view>
    }
    @if(missingCount()>0){<view class="row" testID="chart-color-missing"><view class="swatch" [style.backgroundColor]="axis().missingColor"/><text class="label" [style.color]="ink()">{{locale()==='en'?'Unknown':'Desconocido'}} · {{missingCount()}}</text></view>}
  </view>`,
  styles:`:host{display:flex;width:100%;min-width:0}.axis{display:flex;gap:6px;padding-top:10px;padding-bottom:6px;min-width:0}.heading{font-size:12px;font-weight:600}.ramp{width:100%;height:12px}.range{font-size:12px}.row{display:flex;flex-direction:row;align-items:center;gap:7px;min-width:0}.swatch{width:12px;height:12px;border-radius:3px;flex-shrink:0}.label{font-size:12px;flex:1;min-width:0}`,
})
export class NativeTilemapColorAxis {
  readonly axis=input.required<PlanColorAxisFrame>();
  readonly locale=input<'es'|'en'>('en');
  readonly ink=input('#172438');
  readonly unit=input('');
  readonly missingCount=input(0);
  private readonly id='nc-tilemap-axis-'+(++axisSequence);
  private readonly format=computed(()=>chartNumberFormatter(this.locale()));
  protected readonly classes=computed(()=>{const axis=this.axis();return axis.type==='classes'?axis.classes:[];});
  protected readonly unclassified=computed(()=>{const axis=this.axis();return axis.type==='classes'?axis.unclassifiedColor:axis.missingColor;});
  protected readonly ramp=computed(()=>{
    const axis=this.axis();if(axis.type!=='continuous')return '<svg viewBox="0 0 200 12"/>';
    return `<svg viewBox="0 0 200 12" preserveAspectRatio="none"><defs><linearGradient id="${this.id}" x1="0%" y1="0%" x2="100%" y2="0%">${axis.stops.map(stop=>`<stop offset="${stop.at*100}%" stop-color="${stop.color}"/>`).join('')}</linearGradient></defs><rect x="0" y="0" width="200" height="12" rx="3" fill="url(#${this.id})"/></svg>`;
  });
  protected readonly domainLabel=computed(()=>{
    const axis=this.axis();if(axis.type!=='continuous'||axis.domain===null)return this.locale()==='en'?'No known values':'No hay valores conocidos';
    return this.format()(axis.domain[0])+' — '+this.format()(axis.domain[1])+(this.unit()?' '+this.unit():'');
  });
  protected classRange(item:Readonly<{minInclusive?:number;maxExclusive?:number}>):string{
    const format=this.format();
    if(item.minInclusive===undefined&&item.maxExclusive===undefined)return this.locale()==='en'?'All finite values':'Todos los valores finitos';
    if(item.minInclusive===undefined)return '< '+format(item.maxExclusive!);
    if(item.maxExclusive===undefined)return '≥ '+format(item.minInclusive);
    return '['+format(item.minInclusive)+', '+format(item.maxExclusive)+')';
  }
}
