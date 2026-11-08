import {Component,computed,effect,inject,input,linkedSignal,output,signal,untracked} from '@angular/core';
import {controlAccessibilityState} from './control-accessibility.js';
import {Pressable,Text,View} from '@ng-native/components';
import {ColorScheme} from '@ng-native/device';
import {NativeDataChart} from './data-chart.js';
import type {InteractionSnapshot} from '../library/contracts.js';
import type {NativeChartDiagnostic,NativeViewportChange} from './data-options.js';
import type {NativeChartDrilldownData,NativeChartDrilldownDiagnostic,NativeChartDrilldownInteraction,NativeChartDrilldownNavigation,NativeChartDrilldownOptions,NativeChartDrilldownOptionsByType} from './drilldown-options.js';
import {backDrilldown,createDrilldownState,currentDrilldownNode,drilldownDestination,drilldownGeneration,enterDrilldown,ownDrilldownGraph,reconcileDrilldown,rememberDrilldownView,restoredDrilldownView,type DrilldownGeneration,type DrilldownSelection,type DrilldownState} from './drilldown-state.js';

/** One actual chart at a time. Navigation is an explicit native action; point
 * exploration, scrubbing and observation Next never enter a detail implicitly. */
@Component({
 selector:'neu-c-drilldown, nc-chart-drilldown',imports:[NativeDataChart,View,Text,Pressable],
 styles:':host{display:flex;flex-direction:column;align-self:stretch;min-width:0;}',
 template:`@if(diagnostic();as error){<view accessibilityRole="alert" testID="chart-drilldown-error"><text>{{error.diagnostic.message}}</text></view>}@else{
  <view testID="chart-drilldown-navigation" style="padding:16px;gap:12px">
   <text [style.color]="ink()" accessibilityRole="header" testID="chart-drilldown-trail">{{trailLabel()}}</text>
   <view style="flex-direction:row;flex-wrap:wrap;gap:8px">
    <pressable testID="chart-drilldown-back" accessibilityRole="button" [accessibilityLabel]="english()?'Back to parent chart':'Volver a la gráfica anterior'" [disabled]="trail().length<2" [accessibilityState]="controlAccessibilityState(trail().length<2)" [style.opacity]="trail().length<2?0.45:1" [style.backgroundColor]="controlColor()" style="padding:12px;min-height:44px;border-radius:10px" (press)="back()"><text [style.color]="ink()">{{english()?'Back':'Volver'}}</text></pressable>
    @if(destination()){<pressable testID="chart-drilldown-enter" accessibilityRole="button" [accessibilityLabel]="english()?'View selected detail':'Ver el detalle seleccionado'" [style.backgroundColor]="controlColor()" style="padding:12px;min-height:44px;border-radius:10px" (press)="enter()"><text [style.color]="ink()">{{english()?'View detail':'Ver detalle'}}</text></pressable>}
   </view>
  </view>
  @for(context of render();track context.token.generation){<neu-c-chart [data]="context.data" [options]="context.options" [hiddenSeriesIds]="visibility()" (hiddenSeriesIdsChange)="changeVisibility(context.token,$event)" (viewportChange)="changeViewport(context.token,$event)" (interactionChange)="interact(context.token,$event)" (planningError)="childError(context.token,$event)"/>}
 }`,
})
export class NativeChartDrilldown<T extends NativeChartDrilldownData=NativeChartDrilldownData>{
 protected readonly controlAccessibilityState=controlAccessibilityState;
 readonly data=input.required<T>();
 readonly options=input<NativeChartDrilldownOptions<NoInfer<T>>>({});
 readonly navigationChange=output<NativeChartDrilldownNavigation>();
 readonly interactionChange=output<NativeChartDrilldownInteraction>();
 readonly planningError=output<NativeChartDrilldownDiagnostic>();
 private readonly scheme=inject(ColorScheme);
 private readonly prepared=computed(()=>ownDrilldownGraph(this.data(),this.options()));
 private readonly state=linkedSignal<ReturnType<typeof this.prepared>,DrilldownState|null>({source:this.prepared,computation:(result,previous)=>result.status==='invalid'?null:previous?.value?reconcileDrilldown(previous.value,result.value):createDrilldownState(result.value)});
 private readonly generation=computed(()=>this.state()?.generation??null);
 // Restore only when entering/re-entering a node. Live viewport events must
 // never rewrite initial options and reset their own current gesture window.
 private readonly activationView=linkedSignal({source:this.generation,computation:()=>untracked(()=>{const state=this.state();return state?restoredDrilldownView(state):undefined;})});
 protected readonly visibility=linkedSignal<readonly string[]>(()=>{this.generation();return this.activationView()?.hiddenSeriesIds??[];});
 private readonly selection=signal<DrilldownSelection|null>(null);
 readonly diagnostic=computed(()=>{const result=this.prepared();return result.status==='invalid'?result.error:null;});
 readonly trail=computed(()=>this.state()?.trail??[]);
 readonly nodeId=computed(()=>{const state=this.state();return state?currentDrilldownNode(state):null;});
 protected readonly english=computed(()=>this.options().appearance?.locale==='en');
 private readonly dark=computed(()=>{const theme=this.options().appearance?.theme??'system';return theme==='system'?this.scheme.current()==='dark':theme==='dark';});
 protected readonly ink=computed(()=>this.dark()?'#E7EEF9':'#182331');
 protected readonly controlColor=computed(()=>this.dark()?'#202E42':'#EDF2F8');
 protected readonly trailLabel=computed(()=>{const state=this.state();return state?state.trail.map(id=>state.graph.options.get(id)?.title??id).join(' / '):'';});
 protected readonly destination=computed(()=>{const state=this.state(),selection=this.selection();return state&&selection?drilldownDestination(state,selection):undefined;});
 protected readonly render=computed(()=>{
  const state=this.state();if(!state)return [];
  const nodeId=currentDrilldownNode(state),node=state.graph.nodes.get(nodeId)!,settings=state.graph.options.get(nodeId)!,view=this.activationView();
  const options={...settings,...(settings.viewport&&view?.viewport?{viewport:{...settings.viewport,initial:view.viewport}}:{})} as NativeChartDrilldownOptionsByType[keyof NativeChartDrilldownOptionsByType];
  return [{token:drilldownGeneration(state),data:node.data,options}];
 });
 constructor(){effect(()=>{const error=this.diagnostic();if(error)this.planningError.emit(error);});}
 private accepts(token:DrilldownGeneration):boolean{const state=this.state();return !!state&&token.generation===state.generation&&token.nodeId===currentDrilldownNode(state);}
 protected interact(token:DrilldownGeneration,snapshot:InteractionSnapshot):void{
  if(!this.accepts(token))return;
  this.selection.set(snapshot.selected?{...token,datumId:snapshot.selected}:null);
  this.interactionChange.emit({nodeId:token.nodeId,snapshot});
 }
 protected changeVisibility(token:DrilldownGeneration,ids:readonly string[]):void{
  if(!this.accepts(token))return;
  this.visibility.set(ids);const state=this.state()!,previous=restoredDrilldownView(state);
  this.state.set(rememberDrilldownView(state,token,{hiddenSeriesIds:ids,...(previous?.viewport?{viewport:previous.viewport}:{})}));
 }
 protected changeViewport(token:DrilldownGeneration,event:NativeViewportChange):void{
  if(!this.accepts(token))return;
  this.state.set(rememberDrilldownView(this.state()!,token,{hiddenSeriesIds:this.visibility(),viewport:event.value}));
 }
 protected childError(token:DrilldownGeneration,diagnostic:NativeChartDiagnostic):void{if(this.accepts(token))this.planningError.emit({nodeId:token.nodeId,diagnostic});}
 enter():void{const state=this.state(),selection=this.selection();if(state&&selection)this.navigate(enterDrilldown(state,selection));}
 back():void{const state=this.state();if(state)this.navigate(backDrilldown(state));}
 private navigate(next:DrilldownState):void{
  if(next===this.state())return;this.state.set(next);this.selection.set(null);
  this.navigationChange.emit({nodeId:currentDrilldownNode(next),trail:next.trail});
 }
}
