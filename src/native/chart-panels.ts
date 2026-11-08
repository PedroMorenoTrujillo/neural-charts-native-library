import {Component,computed,effect,input,model,output,signal,linkedSignal,viewChildren,untracked,inject,DestroyRef} from '@angular/core';
import {Text,View} from '@ng-native/components';
import {NativeDataChart} from './data-chart.js';
import type {NativeChartDiagnostic,NativeViewportChange} from './data-options.js';
import type {InteractionSnapshot} from '../library/contracts.js';
import type {NativeChartPanelDiagnostic,NativeChartPanelInteraction,NativeChartPanelViewportChange,NativeChartPanelsData,NativeChartPanelsOptions,NativeChartPanelsVisibility} from './chart-panels-options.js';
import {ownChartPanels,panelVisibility,samePanelVisibility,updatePanelVisibility,type ChartPanelsResult} from './chart-panels-state.js';
import {panelActivations,PanelViewportSync,type NativeChartPanelActivation} from './panel-viewport-sync.js';

/** Natural-height native panels; no overlaid plot or duplicate geometry planner. */
@Component({
  selector:'neu-c-panels, nc-chart-panels',imports:[NativeDataChart,View,Text],
  styles:':host{display:flex;flex-direction:column;align-self:stretch;min-width:0;}',
  template:`@if(diagnostic();as error){<view accessibilityRole="alert" testID="chart-panels-error"><text>{{error.diagnostic.message}}</text></view>}@else{
    <view testID="chart-panels" style="display:flex;flex-direction:row;flex-wrap:wrap;align-items:flex-start;min-width:0" [style.gap]="layout().gap" (layout)="measure($event)">
      @for(panel of panels();track panel.epoch){<view [testID]="'chart-panel-'+panel.id" [style.width]="layout().columns===1?'100%':layout().panelWidth" style="min-width:0;flex-shrink:0">
        <neu-c-chart [data]="panel.data" [options]="panel.options" [hiddenSeriesIds]="visibility()[panel.id]??emptyVisibility" (hiddenSeriesIdsChange)="changeVisibility(panel.id,$event)" (interactionChange)="forwardInteraction(panel.id,$event)" (planningError)="forwardError(panel.id,$event)" (viewportChange)="forwardViewport(panel.id,panel.epoch,$event)"/>
      </view>}
    </view>
  }`,
})
export class NativeChartPanels<T extends NativeChartPanelsData=NativeChartPanelsData>{
  readonly data=input.required<T>();
  readonly options=input<NativeChartPanelsOptions<NoInfer<T>>>({});
  readonly hiddenSeriesIds=model<NativeChartPanelsVisibility>({});
  readonly interactionChange=output<NativeChartPanelInteraction>();
  readonly planningError=output<NativeChartPanelDiagnostic>();
  readonly viewportChange=output<NativeChartPanelViewportChange>();
  protected readonly emptyVisibility:readonly string[]=Object.freeze([]);
  private readonly width=signal(0);
  private readonly prepared=computed<ChartPanelsResult>(()=>ownChartPanels(this.data(),this.options()));
  readonly diagnostic=computed(()=>{const result=this.prepared();return result.status==='invalid'?result.error:null;});
  protected readonly panels=linkedSignal<ChartPanelsResult,readonly NativeChartPanelActivation[]>({source:this.prepared,computation:(result,previous)=>result.status==='ok'?panelActivations(result.value,previous?.value):[]});
  private readonly charts=viewChildren(NativeDataChart);
  private readonly viewportSync=new PanelViewportSync();
  private readonly viewportWork=signal(0);
  readonly visibility=computed(()=>{const result=this.prepared();return result.status==='ok'?panelVisibility(result.value,this.hiddenSeriesIds()):{};},{equal:samePanelVisibility});
  readonly layout=computed(()=>{
    const result=this.prepared(),settings=result.status==='ok'?result.value.layout:{columns:1 as const,minPanelWidth:300,gap:16};
    const width=this.width(),minimum=settings.columns==='auto'?settings.minPanelWidth:160;
    const columns=settings.columns!==1&&this.panels().length>1&&width>=minimum*2+settings.gap?2:1;
    return {columns,gap:settings.gap,panelWidth:columns===2?(width-settings.gap)/2:width};
  });
  constructor(){
    effect(()=>{const error=this.diagnostic();if(error)this.planningError.emit(error);});
    effect(()=>{
      this.viewportWork();const result=this.prepared(),panels=this.panels(),visibility=this.visibility(),charts=this.charts();
      // Observe actual child inputs and scenes, then verify ownership before a
      // command. This does not assume parent/child effect execution order.
      const ready=charts.map(chart=>({chart,data:chart.data(),options:chart.options(),hidden:chart.hiddenSeriesIds(),scene:chart.scene()}));
      untracked(()=>{
        if(result.status!=='ok'){this.viewportSync.clear();return;}
        this.viewportSync.reconcile(result.value,panels,visibility);
        for(const [index,panel]of panels.entries()){
          const child=ready[index],expected=Object.getOwnPropertyDescriptor(visibility,panel.id)?.value??this.emptyVisibility;
          if(!child||child.data!==panel.data||child.options!==panel.options||!child.scene||child.hidden.length!==expected.length||child.hidden.some((id,i)=>id!==expected[i]))continue;
          const error=this.viewportSync.flush(panel.id,panel.epoch,child.chart);if(error)this.planningError.emit(error);
        }
      });
    });
    inject(DestroyRef).onDestroy(()=>this.viewportSync.clear());
  }
  protected measure(event:unknown):void{
    const width=(event as {nativeEvent?:{layout?:{width?:unknown}}}|null)?.nativeEvent?.layout?.width;
    if(typeof width==='number'&&Number.isFinite(width)&&width>0&&width<=10000)this.width.set(width);
  }
  protected changeVisibility(panelId:string,requested:readonly string[]):void{
    const result=this.prepared();if(result.status!=='ok')return;
    const current=this.visibility(),next=updatePanelVisibility(result.value,current,panelId,requested);
    if(!samePanelVisibility(current,next))this.hiddenSeriesIds.set(next);
  }
  protected forwardInteraction(panelId:string,snapshot:InteractionSnapshot):void{this.interactionChange.emit({panelId,snapshot});}
  protected forwardError(panelId:string,diagnostic:NativeChartDiagnostic):void{this.planningError.emit({panelId,diagnostic});}
  protected forwardViewport(panelId:string,epoch:object,event:NativeViewportChange):void{
    const accepted=this.viewportSync.accept(panelId,epoch,event);if(!accepted)return;
    this.viewportWork.update(value=>value+1);this.viewportChange.emit(accepted);
  }
}
