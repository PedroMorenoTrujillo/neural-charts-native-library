import {ChangeDetectionStrategy,Component,DestroyRef,computed,inject,input,signal} from '@angular/core';
import {Pressable,Text,View,type LayoutEvent} from '@ng-native/components';
import {NativeGesture} from '@ng-native/components/gestures';
import {ColorScheme} from '@ng-native/device';
import {NgIcon} from '@ng-icons/core';
import {Gesture} from 'react-native-gesture-handler';
import type {NativeAppearanceOptions,NativeChartData,NativeNumericWindow} from './data-options.js';
import type {PlanViewportState,PlanViewportValue} from './plan.js';
import {pointLease} from './input-lease.js';
import {moveNavigatorEdge,navigatorOverview,navigatorRange,navigatorViewport} from './navigator-range.js';
import {sameViewportValue} from './viewport-state.js';

const copy={
  en:{title:'Visible range',overview:'Chart range overview',start:'Start',end:'End',reset:'Show full range',
    earlierStart:'Move start earlier',laterStart:'Move start later',earlierEnd:'Move end earlier',laterEnd:'Move end later'},
  es:{title:'Rango visible',overview:'Vista general del rango',start:'Inicio',end:'Fin',reset:'Mostrar todo el rango',
    earlierStart:'Adelantar inicio',laterStart:'Retrasar inicio',earlierEnd:'Adelantar fin',laterEnd:'Retrasar fin'},
} as const;

type RangeDrag=Readonly<{state:PlanViewportState;edge:0|1;value:NativeNumericWindow}>;
interface NavigatorChart {
  data():NativeChartData;
  options():Readonly<{appearance?:Pick<NativeAppearanceOptions,'locale'|'theme'>}>;
  hiddenSeriesIds():readonly string[];
  viewportState():PlanViewportState|undefined;
  setViewport(value:PlanViewportValue):boolean;
}

/** Select the horizontal window of a numeric or time line chart. */
@Component({
  selector:'neu-c-navigator, nc-chart-navigator',
  changeDetection:ChangeDetectionStrategy.OnPush,
  imports:[View,Text,Pressable,NativeGesture,NgIcon],
  template:`
    @if(range()){
      <view class="navigator" [style.backgroundColor]="dark()?'#17263A':'#F1F6FC'">
        <text class="title" accessibilityRole="header" [style.color]="ink()">{{labels().title}}</text>
        <view class="track" testID="chart-navigator-track" [accessible]="true" accessibilityRole="image" [accessibilityLabel]="labels().overview" [gesture]="gesture" (layout)="measure($event)"
          [style.backgroundColor]="dark()?'#233B57':'#DCEAF8'">
          @if(svg();as drawing){
            <view class="art" pointerEvents="none" [accessible]="false" [accessibilityElementsHidden]="true" importantForAccessibility="no-hide-descendants">
              <ng-icon class="art" [svg]="drawing"/>
            </view>
          }
          @if(positions();as positions){
            <view class="window" [style.left]="positions.start" [style.width]="positions.end-positions.start"
              [style.borderColor]="accent()" [style.backgroundColor]="dark()?'#87BFFF24':'#0064CC24'" pointerEvents="none" />
            <view class="handle" [style.left]="positions.startHandle" [style.backgroundColor]="accent()" pointerEvents="none" />
            <view class="handle" [style.left]="positions.endHandle" [style.backgroundColor]="accent()" pointerEvents="none" />
          }
        </view>
        <view class="controls">
          @for(control of controls();track control.edge){
            <view class="boundary">
              <text class="value" [style.color]="ink()" [testID]="control.edge===0?'chart-navigator-start':'chart-navigator-end'">{{control.label}} · {{control.value}}</text>
              <view class="buttons">
                <pressable class="button" accessibilityRole="button" [accessibilityLabel]="control.earlier"
                  [disabled]="!control.canDecrease" [accessibilityState]="{disabled:!control.canDecrease}"
                  [style.borderColor]="accent()" [style.opacity]="control.canDecrease?1:.45" (press)="step(control.edge,-1)">
                  <text [style.color]="ink()" [accessible]="false">−</text>
                </pressable>
                <pressable class="button" accessibilityRole="button" [accessibilityLabel]="control.later"
                  [disabled]="!control.canIncrease" [accessibilityState]="{disabled:!control.canIncrease}"
                  [style.borderColor]="accent()" [style.opacity]="control.canIncrease?1:.45" (press)="step(control.edge,1)">
                  <text [style.color]="ink()" [accessible]="false">+</text>
                </pressable>
              </view>
            </view>
          }
        </view>
        <pressable class="button reset" accessibilityRole="button" [accessibilityLabel]="labels().reset" [disabled]="!canReset()"
          [accessibilityState]="{disabled:!canReset()}" [style.borderColor]="accent()" [style.opacity]="canReset()?1:.45" (press)="reset()">
          <text [style.color]="ink()">{{labels().reset}}</text>
        </pressable>
      </view>
    }
  `,
  styles:`
    .navigator{gap:10px;padding:12px;border-radius:12px;}
    .title{font-size:14px;font-weight:700;}
    .track{position:relative;height:54px;border-radius:8px;overflow:hidden;}
    .art{position:absolute;top:0;left:0;width:100%;height:100%;}
    .window{position:absolute;top:0;bottom:0;border-width:1px;border-radius:4px;}
    .handle{position:absolute;top:14px;width:4px;height:26px;border-radius:2px;}
    .controls{flex-direction:row;flex-wrap:wrap;gap:8px;}
    .boundary{flex-grow:1;min-width:124px;gap:4px;}
    .value{font-size:13px;font-weight:600;}
    .buttons{flex-direction:row;gap:6px;}
    .button{min-height:44px;min-width:44px;align-items:center;justify-content:center;padding:6px;border-width:1px;border-radius:8px;}
    .reset{align-self:flex-start;}
  `,
})
export class NativeChartNavigator {
  /** The chart owns the window, including zoom and pan initiated elsewhere. */
  readonly chart=input.required<NavigatorChart>();
  /** An optional visible series used for the overview. Defaults to the first visible series. */
  readonly seriesId=input<string>();

  private readonly scheme=inject(ColorScheme);
  private readonly trackWidth=signal(0);
  private readonly drag=signal<RangeDrag|undefined>(undefined);
  private readonly model=computed(()=>this.chart().viewportState());
  protected readonly range=computed(()=>this.chart().data().type==='line'?navigatorRange(this.model()):undefined);
  private readonly locale=computed(()=>this.chart().options().appearance?.locale??'es');
  protected readonly labels=computed(()=>copy[this.locale()]);
  protected readonly dark=computed(()=>{
    const theme=this.chart().options().appearance?.theme??'system';
    return theme==='system'?this.scheme.current()==='dark':theme==='dark';
  });
  protected readonly ink=computed(()=>this.dark()?'#EEF5FF':'#14243B');
  protected readonly accent=computed(()=>this.dark()?'#9AD0FF':'#165DAA');
  private readonly domain=computed(()=>this.range()?.domain,{equal:(a,b)=>a===b||a?.[0]===b?.[0]&&a?.[1]===b?.[1]});
  private readonly points=computed(()=>{
    const chart=this.chart(),data=chart.data(),id=this.seriesId();
    if(data.type!=='line')return;
    const hidden=chart.hiddenSeriesIds();
    return data.series.find(series=>(id===undefined||series.id===id)&&!hidden.includes(series.id))?.data;
  });
  protected readonly svg=computed(()=>{
    const domain=this.domain(),data=this.points();
    const drawing=domain&&data?navigatorOverview(data,domain):'';
    return drawing?'<svg viewBox="0 0 160 36" preserveAspectRatio="none"><path d="'+drawing+'" fill="none" stroke="'+this.accent()+'" stroke-width="1.3"/></svg>':'';
  });
  private readonly currentWindow=computed(()=>{
    const drag=this.drag();
    return drag&&drag.state===this.model()?drag.value:this.range()?.value;
  });
  protected readonly positions=computed(()=>{
    const value=this.currentWindow(),domain=this.domain(),width=this.trackWidth();
    if(!value||!domain||width<=0)return;
    const project=(v:number)=>Math.max(0,Math.min(width,(v-domain[0])/(domain[1]-domain[0])*width));
    const start=project(value[0]),end=project(value[1]);
    const handle=(v:number)=>Math.max(0,Math.min(width-4,v-2));
    return {start,end,startHandle:handle(start),endHandle:handle(end)};
  });
  private readonly formatter=computed(()=>{
    const locale=this.locale();
    return this.range()?.time
      ? new Intl.DateTimeFormat(locale,{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'UTC'})
      : new Intl.NumberFormat(locale,{maximumSignificantDigits:12});
  });
  protected readonly controls=computed(()=>{
    const range=this.range(),value=this.currentWindow();
    if(!range||!value)return [];
    const [start,end]=value,[min,max]=range.domain,span=range.minimumSpan,labels=this.labels(),format=this.formatter();
    return [
      {edge:0 as const,label:labels.start,value:format.format(start),earlier:labels.earlierStart,later:labels.laterStart,canDecrease:start>min,canIncrease:start<end-span},
      {edge:1 as const,label:labels.end,value:format.format(end),earlier:labels.earlierEnd,later:labels.laterEnd,canDecrease:end>start+span,canIncrease:end<max},
    ];
  });
  protected readonly canReset=computed(()=>this.model()?.value.x!==undefined);

  private readonly lease=pointLease({start:e=>this.begin(e.x),move:e=>this.move(e.x),end:(e,success)=>this.end(e.x,success),
    finalize:()=>this.drag.set(undefined),tap:()=>{}});
  protected readonly gesture=Gesture.Pan().activeOffsetX([-6,6]).failOffsetY([-12,12]).maxPointers(1).runOnJS(true)
    .onStart(this.lease.callbacks.start).onUpdate(this.lease.callbacks.move).onEnd(this.lease.callbacks.end).onFinalize(this.lease.callbacks.finalize);

  constructor(){inject(DestroyRef).onDestroy(()=>this.lease.revoke());}

  protected measure(event:LayoutEvent):void{
    const width=event.nativeEvent.layout.width;
    if(!Number.isFinite(width)||width<=0||width===this.trackWidth())return;
    this.drag.set(undefined);
    this.trackWidth.set(width);
  }

  protected step(edge:0|1,direction:-1|1):void{
    const state=this.model(),range=this.range();
    if(!state||!range)return;
    this.drag.set(undefined);
    const step=Math.max(range.minimumSpan,(range.domain[1]-range.domain[0])/20);
    this.commit(state,moveNavigatorEdge(range,edge,range.value[edge]+direction*step));
  }

  protected reset():void{
    const state=this.model();
    if(state&&this.canReset()){
      this.drag.set(undefined);
      this.commit(state);
    }
  }

  private valueAt(x:number):number{
    const range=this.range(),width=this.trackWidth();
    if(!range||width<=0)return NaN;
    const [min,max]=range.domain;
    return min+Math.max(0,Math.min(1,x/width))*(max-min);
  }

  private begin(x:number):void{
    const state=this.model(),range=this.range(),value=this.valueAt(x);
    if(!state||!range||!Number.isFinite(value))return;
    const [start,end]=range.value;
    const edge=Math.abs(value-start)<=Math.abs(value-end)?0:1;
    this.drag.set({state,edge,value:moveNavigatorEdge(range,edge,value)});
  }

  private move(x:number):void{
    const drag=this.drag(),range=this.range();
    if(!drag||drag.state!==this.model()||!range)return;
    const value=moveNavigatorEdge(range,drag.edge,this.valueAt(x));
    this.drag.set({...drag,value});
  }

  private end(x:number,success:boolean):void{
    if(success){
      this.move(x);
      const drag=this.drag();
      if(drag&&drag.state===this.model())this.commit(drag.state,drag.value);
    }
    this.drag.set(undefined);
  }

  private commit(state:PlanViewportState,value?:NativeNumericWindow):void{
    const next=navigatorViewport(state,value);
    if(!sameViewportValue(state.value,next))this.chart().setViewport(next);
  }
}
