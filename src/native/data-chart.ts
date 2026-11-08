import {nativeLogScales,sameLogScales} from './log-options.js';
import {sameStackGroups} from './composition-options.js';
import {Accessibility,ColorScheme} from '@ng-native/device';
import {WordCloudTextProbes,type WordCloudLayoutMeasurement} from './wordcloud-probes.js';
import {WordCloudMeasurements} from './wordcloud-measurements.js';
import {prepareNativeWordCloud,measuringWordCloud,type NativeWordCloudPreparation} from './wordcloud-planning.js';
import type {NativeWordCloudLayoutOptions} from './wordcloud-data.js';
import {planNativeChart} from './plan.js';
import {chartCapabilities,dataLabelsByDefault,isChartFamily} from '../library/chart-capabilities.js';
import {waterfallAppearance} from './waterfall-appearance.js';
import {Component,computed,contentChild,effect,inject,DestroyRef,input,linkedSignal,model,output,signal,type OutputEmitterRef,type Signal} from '@angular/core';
import {NativeChartTooltipTemplate,type NativeChartLabelFormatters} from './chart-presentation.js';
import {Text,View} from '@ng-native/components';
import {NativeChart as NativeSceneChart} from './chart.js';
import {transformPlanViewport,type NativePlanningResult,type PlanViewportValue} from './plan.js';
import {planChartData} from './data-planning.js';
import {optionsDiagnostic} from './options-validation.js';
import {updateScenePresentation} from '../library/scene.js';
import type {InteractionSnapshot} from '../library/contracts.js';
import type {NativeChartData,NativeChartOptions,NativeChartDiagnostic,NativeViewportChange} from './data-options.js';
import {sameViewportValue,type NativeViewportRequest,type NativeViewportContext} from './viewport-state.js';
import {nativeReferenceGeometry,sameReferenceGeometry,nativeReferenceStyles,sameReferenceStyles,nativeReferenceBandGeometry,sameReferenceBandGeometry,nativeReferenceBandStyles,sameReferenceBandStyles,visiblePointAppearance} from './reference-options.js';
import {samePointAppearance} from '../library/scene-styles.js';
import {ChartActivity} from './activity.js';

function sameWordLayout(a:NativeWordCloudLayoutOptions|undefined,b:NativeWordCloudLayoutOptions|undefined):boolean{return a===b||!!a&&!!b&&a.minFontSize===b.minFontSize&&a.maxFontSize===b.maxFontSize&&a.padding===b.padding&&a.seed===b.seed&&a.maxWords===b.maxWords&&a.rotations?.length===b.rotations?.length&&(a.rotations??[]).every((v,i)=>v===b.rotations?.[i]);}
function sameContourLevels(a:readonly Readonly<{id:string;value:number}>[]|undefined,b:readonly Readonly<{id:string;value:number}>[]|undefined):boolean{return a===b||!!a&&!!b&&a.length===b.length&&a.every((level,index)=>level.id===b[index]!.id&&level.value===b[index]!.value);}
interface NativeViewportWindowState {readonly value:PlanViewportValue;readonly prepared:NativePlanningResult|null;readonly revision:number;}

/** Data/options controller; the existing scene component remains the native renderer. */
@Component({
  selector:'neu-c-chart, nc-chart',imports:[NativeSceneChart,View,Text,WordCloudTextProbes],
  styles:':host{display:flex;flex-direction:column;min-width:0;align-self:stretch;}',
  template:`@if(renderActive()){@if(data().type==='wordcloud'){<nc-wordcloud-text-probes [probes]="wordMetrics().snapshot.probes" (measuredBounds)="acceptWordBounds($event)" (measurementFailed)="rejectWordBounds($event.token)"/>}@if(scene();as projected){
    @if(regressionNotice();as notice){<view testID="chart-regression-status" style="padding:12px"><text [style.color]="noticeColor()" style="font-size:14px;line-height:20px">{{notice}}</text></view>}
    @if(circularNotice();as notice){<view testID="chart-circular-status" style="padding:12px"><text [style.color]="noticeColor()" style="font-size:14px;line-height:20px">{{notice}}</text></view>}
    <neu-c-scene [scene]="projected"
      [viewportContext]="viewportContext()" (viewportRequest)="requestViewport($event)"
      [locale]="options().appearance?.locale??'es'" [theme]="options().appearance?.theme??'system'"
      [showDendrogramAxis]="parallelAxes().visible" [showParallelAxes]="parallelAxes().visible" [showParallelNames]="parallelAxes().labels" [showParallelTicks]="parallelAxes().ticks" [showColorAxis]="options().colorAxis?.visible??true" [showLegend]="data().type==='heatmap'?false:(options().legend?.visible??true)" [legendPosition]="options().legend?.position??'top'" [legendInteractive]="options().legend?.interactive??true"
      [showGrid]="data().type==='dendrogram'?(parallelAxes().visible):data().type==='pictorial'?false:(options().axes?.grid??true)" [showXAxis]="physicalAxes().x?.visible??true" [showYAxis]="data().type==='pictorial'?false:(physicalAxes().y?.visible??true)"
      [showSecondaryYAxis]="data().type==='mixed'?(physicalAxes().secondary?.visible??true):undefined" [secondaryYAxisTitle]="physicalAxes().secondary?.title??''" [secondaryYAxisTitleStyle]="physicalAxes().secondary?.titleStyle"
      [xAxisTitle]="physicalAxes().x?.title??''" [yAxisTitle]="physicalAxes().y?.title??''"
      [titleStyle]="options().appearance?.title ?? undefined" [subtitleStyle]="options().appearance?.subtitle ?? undefined" [xAxisTitleStyle]="physicalAxes().x?.titleStyle ?? undefined" [yAxisTitleStyle]="physicalAxes().y?.titleStyle ?? undefined"
      [tooltipMode]="options().tooltip?.mode??'floating'" [tooltipContent]="options().tooltip?.content??'point'" [tooltipPinnable]="options().tooltip?.pinnable??false" [showCrosshair]="options().tooltip?.crosshair??false"
      [tooltipTemplate]="tooltipTemplate()?.template" [labelFormatters]="labelFormatters()"
      [animationEnabled]="options().animation?.enabled??true" [skipEntrance]="suppressResumeMotion()" [animationDuration]="options().animation?.durationMs??1100" [animationKey]="options().animation?.revision??0"
      [interactionMode]="options().interaction?.mode??'explore'" [hapticsEnabled]="options().interaction?.haptics??true"
      [selectionControls]="options().interaction?.selectionControls??true"
      [dataLabelLayout]="options().appearance?.dataLabelLayout??'auto'" [axisLabelLayout]="options().appearance?.axisLabelLayout??'auto'"
      [plotHeight]="options().appearance?.plotHeight??260" [minPlotWidth]="options().appearance?.minPlotWidth??0" [strokeWidth]="options().appearance?.lineWidth??2" [markerSize]="options().appearance?.markers?.diameter??6"
      [showMarkers]="options().appearance?.markers?.visible??true" [showDataLabels]="options().appearance?.dataLabels??defaultDataLabels()" [showStackLabels]="stackLabels()"
      [markerStyle]="markerAppearance()"
      (viewportChange)="viewport.set($event)" (legendChange)="hiddenSeriesIds.set($event)" (interactionChange)="forwardInteraction($event)" />
  }@else if(diagnostic();as error){<view accessibilityRole="alert"><text>{{error.message}}</text></view>}}`,
})
export class NativeDataChart<T extends NativeChartData=NativeChartData> {
  readonly data=input.required<T>();
  protected readonly defaultDataLabels=computed(()=>dataLabelsByDefault(this.data().type));
  // An omitted Contour layout is reported by optionsDiagnostic. Other families
  // have valid empty defaults; the exported Contour options type requires levels.
  readonly options=input<NativeChartOptions<NoInfer<T['type']>>>({} as NativeChartOptions<NoInfer<T['type']>>);
  readonly labelFormatters=input<NativeChartLabelFormatters>();
  protected readonly tooltipTemplate=contentChild(NativeChartTooltipTemplate);
  /** Optional two-way binding; internal state works without an event handler. */
  readonly hiddenSeriesIds=model<readonly string[]>([]);
  readonly interactionChange=output<InteractionSnapshot>();
  readonly planningError:OutputEmitterRef<NativeChartDiagnostic>=output<NativeChartDiagnostic>();
  readonly viewportChange=output<NativeViewportChange>();
  private readonly activity=inject(ChartActivity);
  private destroyed=false;
  protected readonly renderActive=computed(()=>this.activity.active()&&this.options().rendering?.active!==false);
  protected readonly suppressResumeMotion=signal(false);
  private readonly noticeScheme=inject(ColorScheme);
  protected readonly noticeColor=computed(()=>{const theme=this.options().appearance?.theme??'system';return (theme==='system'?this.noticeScheme.current()==='dark':theme==='dark')?'#B6C4D7':'#526176';});
  protected readonly circularNotice=computed(()=>{
    const scene=this.scene(),en=this.options().appearance?.locale==='en',summary=scene?.radialSummary,c=scene?.circular;
    if(summary?.overflow)return en?'The total exceeds the numeric range. Percentages use normalized original values.':'El total supera el rango numérico. Los porcentajes usan los valores originales normalizados.';
    if(summary?.missingCount)return en?'Some values are unknown. Percentages refer to the known visible subtotal.':'Hay valores desconocidos. Los porcentajes se refieren al subtotal visible conocido.';
    if(c?.style!=='sectors'&&c?.valueState==='under')return en?'The value is below the dial range. Only the pointer is bounded; the tooltip retains the original value.':'El valor está por debajo del rango. Solo se limita el indicador; el tooltip conserva el valor original.';
    if(c?.style!=='sectors'&&c?.valueState==='over')return en?'The value exceeds the dial range. Only the pointer is bounded; the tooltip retains the original value.':'El valor supera el rango. Solo se limita el indicador; el tooltip conserva el valor original.';
    return '';
  });
  protected readonly markerAppearance=computed(()=>{
    const {shape,fillColor,borderColor,borderWidth}=this.options().appearance?.markers??{};
    return {shape,fillColor,borderColor,borderWidth};
  });
  protected readonly regressionNotice=computed(()=>{const scene=this.scene(),en=this.options().appearance?.locale==='en';return scene?.regression?.models.filter(m=>m.status!=='ready').map(m=>{const name=scene.legend?.find(l=>l.id===m.sourceSeriesId)?.name??m.sourceSeriesId;return name+': '+(m.status==='constant-x'?(en?'No fit: known X values are equal.':'Sin ajuste: las X conocidas son iguales.'):(en?'No fit: at least two known XY pairs are required.':'Sin ajuste: se necesitan al menos dos pares XY conocidos.'));}).join(' ')??'';});
  private lastInteraction:InteractionSnapshot|undefined;
  protected readonly viewport=signal<Readonly<{width:number;height:number}>|undefined>(undefined);
  private readonly planningViewport=computed(()=>{
    const data=this.data(),type=data&&typeof data==='object'?Object.getOwnPropertyDescriptor(data,'type')?.value:undefined;return isChartFamily(type)&&chartCapabilities[type].measured?this.viewport():undefined;
  });
  protected forwardInteraction(snapshot:InteractionSnapshot):void{if(this.destroyed||!this.renderActive()&&snapshot.active)return;this.lastInteraction=snapshot;this.interactionChange.emit(snapshot);}
  private readonly requestedVisibility=computed(()=>{
    const value=this.hiddenSeriesIds(),ids:string[]=[];
    if(Array.isArray(value))for(let i=0;i<Math.min(16,value.length);i++){const id=Object.getOwnPropertyDescriptor(value,String(i))?.value;if(typeof id==='string'&&id.length>0&&!ids.includes(id))ids.push(id);}
    return ids;
  },{equal:(a,b)=>a.length===b.length&&a.every((id,i)=>id===b[i])});
  private readonly visibility=computed(()=>{
    const data=this.data();if(!data||typeof data!=='object')return [];
    const descriptors=Object.getOwnPropertyDescriptors(data),items=descriptors['type']?.value==='venn'?descriptors['sets']?.value:descriptors['series']?.value??descriptors['data']?.value;
    const ids:string[]=[];
    if(Array.isArray(items)&&items.length<=16)for(let i=0;i<items.length;i++){const item=Object.getOwnPropertyDescriptor(items,String(i))?.value,id=item&&Object.getOwnPropertyDescriptor(item,'id')?.value;if(typeof id==='string')ids.push(id);}
    const type=descriptors['type']?.value;if(type==='fan'){const bands=descriptors['bands']?.value;return this.requestedVisibility().filter(id=>id==='center'||Array.isArray(bands)&&bands.length<=6&&bands.some(b=>b?.id===id));}if(type==='flame')return [];if(type==='violin'){const groups=descriptors['groups']?.value;if(Array.isArray(groups)&&groups.length<=16)for(const group of groups){const id=group&&Object.getOwnPropertyDescriptor(group,'id')?.value;if(typeof id==='string')ids.push(id);}}if(type==='heatmap')return [];
    if(type==='wordcloud'){const words=descriptors['words']?.value,groups=descriptors['groups']?.value;if(Array.isArray(groups)&&groups.length<=15)for(const group of groups){const id=group&&Object.getOwnPropertyDescriptor(group,'id')?.value;if(typeof id==='string')ids.push(id);}if(Array.isArray(words)&&words.length<=2048&&words.some(word=>word&&Object.getOwnPropertyDescriptor(word,'groupId')?.value===undefined))ids.push('words');}
        if(type==='dependencywheel'||type==='arcdiagram'||type==='chord'||type==='sankey'||type==='networkgraph'||type==='treegraph'||type==='organization'){ids.push('nodes');const groups=descriptors['groups']?.value;if(Array.isArray(groups)&&groups.length<=15)for(let i=0;i<groups.length;i++){const group=Object.getOwnPropertyDescriptor(groups,String(i))?.value,id=group&&Object.getOwnPropertyDescriptor(group,'id')?.value;if(typeof id==='string')ids.push(id);}}
    if(type==='sunburst'){const root=descriptors['root']?.value,children=root&&Object.getOwnPropertyDescriptor(root,'children')?.value;if(Array.isArray(children)&&children.length<=15)for(let i=0;i<children.length;i++){const item=Object.getOwnPropertyDescriptor(children,String(i))?.value,id=item&&Object.getOwnPropertyDescriptor(item,'id')?.value;if(typeof id==='string')ids.push(id);}else{const id=root&&Object.getOwnPropertyDescriptor(root,'id')?.value;if(typeof id==='string')ids.push(id);}}
    if(type==='contour'&&!this.optionError()){const layout=this.options().layout;if(layout&&'levels' in layout)for(const level of layout.levels??[])ids.push(level.id);}
    if(type==='regression')ids.push(...ids.map(id=>'ols:'+id));
    const allowed=new Set(type==='pareto'?['values','cumulative']:type==='histogram'||type==='bellcurve'?['distribution']:ids);
    return this.requestedVisibility().filter(id=>allowed.has(id));
  },{equal:(a,b)=>a.length===b.length&&a.every((id,i)=>id===b[i])});
  protected readonly stackLabels=computed(()=>{const layout=this.options().layout;return layout&&'stackLabels' in layout?layout.stackLabels??false:false;});
  protected readonly parallelAxes=computed(()=>{const axes=this.options().axes;return {visible:axes&&'visible' in axes?axes.visible??true:true,labels:axes&&'labels' in axes?axes.labels??true:true,ticks:axes&&'ticks' in axes?axes.ticks??true:true};});
  private readonly logScales=computed(()=>this.optionError()?undefined:nativeLogScales(this.options()),{equal:sameLogScales});
  private readonly referenceGeometry=computed(()=>this.optionError()?[]:nativeReferenceGeometry(this.options()),{equal:sameReferenceGeometry});
  private readonly referenceStyles=computed(()=>this.optionError()?[]:nativeReferenceStyles(this.options()),{equal:sameReferenceStyles});
  private readonly referenceBandGeometry=computed(()=>this.optionError()?[]:nativeReferenceBandGeometry(this.options()),{equal:sameReferenceBandGeometry});
  private readonly referenceBandStyles=computed(()=>this.optionError()?[]:nativeReferenceBandStyles(this.options()),{equal:sameReferenceBandStyles});
  private readonly planInputs=computed(()=>{
    const error=this.optionError(),options=error?undefined:this.options(),view=options?.viewport;
    return {circularStart:options?.layout&&'startAngle' in options.layout?options.layout.startAngle:undefined,circularEnd:options?.layout&&'endAngle' in options.layout?options.layout.endAngle:undefined,gaugeStyle:options?.layout&&'style' in options.layout?options.layout.style:undefined,gaugeTicks:options?.layout&&'tickCount' in options.layout?options.layout.tickCount:undefined,profileBandwidth:options?.layout&&'bandwidth' in options.layout?options.layout.bandwidth:undefined,profileResolution:options?.layout&&'resolution' in options.layout?options.layout.resolution:undefined,profileNormalization:options?.layout&&'normalization' in options.layout?options.layout.normalization:undefined,parallelCoordinates:options?.layout&&'coordinates' in options.layout?options.layout.coordinates:undefined,circularInner:options?.layout&&'innerRadiusRatio' in options.layout?options.layout.innerRadiusRatio:undefined,heatmapGap:options?.layout&&'gapRatio' in options.layout?options.layout.gapRatio:undefined,vennPadding:options?.layout&&'padding' in options.layout?options.layout.padding:undefined,wordLayout:options?.layout as NativeWordCloudLayoutOptions|undefined,pictorialShape:options?.layout&&'shape' in options.layout?options.layout.shape:undefined,pictorialGap:options?.layout&&'gap' in options.layout?options.layout.gap:undefined,pictorialBackground:options?.layout&&'background' in options.layout?options.layout.background:undefined,tileShape:options?.layout&&'tileShape' in options.layout?options.layout.tileShape:undefined,tileOpacity:options?.appearance?.opacity,tileColorAxis:options?.colorAxis?.scale,contourLevels:options?.layout&&'levels' in options.layout?options.layout.levels:undefined,contourBudget:options?.layout&&'segmentBudget' in options.layout?options.layout.segmentBudget:undefined,comparisonPointPadding:options?.layout&&'pointPadding' in options.layout?options.layout.pointPadding:undefined,comparisonBands:options?.layout&&'bands' in options.layout?options.layout.bands:undefined,data:this.data(),hidden:this.visibility(),dimensions:this.planningViewport(),temporalGrouping:options?.layout&&'grouping' in options.layout?options.layout.grouping:undefined,temporalRowPadding:options?.layout&&'rowPadding' in options.layout?options.layout.rowPadding:undefined,temporalLabelPosition:options?.layout&&'labelPosition' in options.layout?options.layout.labelPosition:undefined,temporalLabelMaxWidth:options?.layout&&'labelMaxWidth' in options.layout?options.layout.labelMaxWidth:undefined,stacking:(options?.layout&&'stacking' in options.layout?options.layout.stacking:undefined),stackGroups:options?.layout&&'stackGroups' in options.layout?options.layout.stackGroups:undefined,neckWidth:(options?.layout&&'neckWidth' in options.layout?options.layout.neckWidth:undefined),neckHeight:(options?.layout&&'neckHeight' in options.layout?options.layout.neckHeight:undefined),reversed:(options?.layout&&'reversed' in options.layout?options.layout.reversed:undefined),whiskerWidth:(options?.layout&&'whiskerWidth' in options.layout?options.layout.whiskerWidth:undefined),capWidth:(options?.layout&&'capWidth' in options.layout?options.layout.capWidth:undefined),markerRadius:(options?.layout&&'markerRadius' in options.layout?options.layout.markerRadius:undefined),columns:(options?.layout&&'columns' in options.layout?options.layout.columns:undefined),splitSeries:options?.layout&&'splitSeries' in options.layout?options.layout.splitSeries:undefined,minRadiusRatio:(options?.layout&&'minRadiusRatio' in options.layout?options.layout.minRadiusRatio:undefined),radiusScale:(options?.layout&&'radiusScale' in options.layout?options.layout.radiusScale:undefined),sankeyOrientation:options?.layout&&'orientation' in options.layout?options.layout.orientation:undefined,relationshipStartAngle:options?.layout&&'startAngle' in options.layout?options.layout.startAngle:undefined,relationshipNodeRadius:options?.layout&&'nodeRadius' in options.layout?options.layout.nodeRadius:undefined,relationshipLinkWidth:options?.layout&&'linkWidth' in options.layout?options.layout.linkWidth:undefined,sankeyNodeWidth:options?.layout&&'nodeWidth' in options.layout?options.layout.nodeWidth:undefined,sankeyNodePadding:options?.layout&&'nodePadding' in options.layout?options.layout.nodePadding:undefined,scales:this.logScales(),references:this.referenceGeometry(),referenceBands:this.referenceBandGeometry(),axes:view?.axes??(this.data().type==='variwide'?'y':this.data().type==='contour'||this.data().type==='sankey'||this.data().type==='packedbubble'||this.data().type==='networkgraph'||this.data().type==='treegraph'||this.data().type==='organization'?'xy':'x'),enabled:!!view,initial:(view?.initial??{}) as PlanViewportValue,error};
  },{equal:(a,b)=>a.circularStart===b.circularStart&&a.circularEnd===b.circularEnd&&a.gaugeStyle===b.gaugeStyle&&a.gaugeTicks===b.gaugeTicks&&a.profileBandwidth===b.profileBandwidth&&a.profileResolution===b.profileResolution&&a.profileNormalization===b.profileNormalization&&a.parallelCoordinates===b.parallelCoordinates&&a.circularInner===b.circularInner&&a.heatmapGap===b.heatmapGap&&a.vennPadding===b.vennPadding&&sameWordLayout(a.wordLayout,b.wordLayout)&&sameContourLevels(a.contourLevels,b.contourLevels)&&a.contourBudget===b.contourBudget&&a.pictorialShape===b.pictorialShape&&a.pictorialGap===b.pictorialGap&&a.pictorialBackground===b.pictorialBackground&&a.tileShape===b.tileShape&&a.tileOpacity===b.tileOpacity&&a.tileColorAxis===b.tileColorAxis&&a.relationshipStartAngle===b.relationshipStartAngle&&a.relationshipNodeRadius===b.relationshipNodeRadius&&a.relationshipLinkWidth===b.relationshipLinkWidth&&a.comparisonPointPadding===b.comparisonPointPadding&&a.comparisonBands===b.comparisonBands&&a.data===b.data&&a.hidden===b.hidden&&a.dimensions===b.dimensions&&a.temporalGrouping===b.temporalGrouping&&a.temporalRowPadding===b.temporalRowPadding&&a.temporalLabelPosition===b.temporalLabelPosition&&a.temporalLabelMaxWidth===b.temporalLabelMaxWidth&&a.stacking===b.stacking&&sameStackGroups(a.stackGroups,b.stackGroups)&&a.neckWidth===b.neckWidth&&a.neckHeight===b.neckHeight&&a.reversed===b.reversed&&a.whiskerWidth===b.whiskerWidth&&a.capWidth===b.capWidth&&a.markerRadius===b.markerRadius&&a.columns===b.columns&&a.splitSeries===b.splitSeries&&a.minRadiusRatio===b.minRadiusRatio&&a.radiusScale===b.radiusScale&&a.sankeyOrientation===b.sankeyOrientation&&a.sankeyNodeWidth===b.sankeyNodeWidth&&a.sankeyNodePadding===b.sankeyNodePadding&&a.scales===b.scales&&a.references===b.references&&a.referenceBands===b.referenceBands&&a.axes===b.axes&&a.enabled===b.enabled&&sameViewportValue(a.initial,b.initial)&&a.error?.path===b.error?.path&&a.error?.message===b.error?.message});
  private readonly viewState=linkedSignal<ReturnType<typeof this.planInputs>,NativeViewportWindowState>({source:this.planInputs,computation:(input,previous)=>{
    const old=previous?.source,retain=old&&old.circularStart===input.circularStart&&old.circularEnd===input.circularEnd&&old.gaugeStyle===input.gaugeStyle&&old.gaugeTicks===input.gaugeTicks&&sameContourLevels(old.contourLevels,input.contourLevels)&&old.contourBudget===input.contourBudget&&old.pictorialShape===input.pictorialShape&&old.pictorialGap===input.pictorialGap&&old.pictorialBackground===input.pictorialBackground&&old.tileShape===input.tileShape&&old.tileOpacity===input.tileOpacity&&old.tileColorAxis===input.tileColorAxis&&old.comparisonPointPadding===input.comparisonPointPadding&&old.comparisonBands===input.comparisonBands&&old.scales===input.scales&&old.data===input.data&&old.hidden===input.hidden&&old.stacking===input.stacking&&sameStackGroups(old.stackGroups,input.stackGroups)&&old.neckWidth===input.neckWidth&&old.neckHeight===input.neckHeight&&old.reversed===input.reversed&&old.whiskerWidth===input.whiskerWidth&&old.capWidth===input.capWidth&&old.markerRadius===input.markerRadius&&old.columns===input.columns&&old.minRadiusRatio===input.minRadiusRatio&&old.radiusScale===input.radiusScale&&old.sankeyOrientation===input.sankeyOrientation&&old.sankeyNodeWidth===input.sankeyNodeWidth&&old.sankeyNodePadding===input.sankeyNodePadding&&old.axes===input.axes&&old.enabled===input.enabled&&sameViewportValue(old.initial,input.initial)&&!old.error&&!input.error;
    const prior=retain?previous?.value:undefined;return {value:prior?.value??input.initial,prepared:null,revision:prior?.revision??0};
  }});
  private readonly wordAccessibility=inject(Accessibility);
  private readonly wordQueue=new WordCloudMeasurements();
  private readonly wordPreparation=computed(()=>{
    if(!this.renderActive())return null;
    const input=this.planInputs();if(input.data.type!=='wordcloud'||input.error)return null;
    return prepareNativeWordCloud(input.data,input.wordLayout,input.dimensions,input.hidden,'system-normal-400:'+this.wordAccessibility.fontScale());
  });
  protected readonly wordMetrics=signal<Readonly<{input:NativeWordCloudPreparation|null;snapshot:WordCloudMeasurements['snapshot']}>>({input:null,snapshot:this.wordQueue.snapshot});
  protected acceptWordBounds(value:WordCloudLayoutMeasurement):void{if(this.wordQueue.accept(value.token,value))this.wordMetrics.update(state=>({...state,snapshot:this.wordQueue.snapshot}));}
  protected rejectWordBounds(token:string):void{this.wordQueue.reject(token);this.wordMetrics.update(state=>({...state,snapshot:this.wordQueue.snapshot}));}
  private calculateWindow(value:PlanViewportValue):NativePlanningResult{
    const input=this.planInputs();if(input.error)return {status:'invalid',diagnostic:input.error};
    if(input.data.type==='wordcloud'){
      const preparation=this.wordPreparation();if(!preparation)return {status:'invalid',diagnostic:{code:'INVALID_CONFIG',reason:'INVALID_WORDCLOUD_INPUT',path:'data',message:'Unable to prepare words.'}};
      if(preparation.status==='invalid')return preparation;
      const state=this.wordMetrics(),metrics=state.input===preparation?state.snapshot:null;
      if(metrics?.error)return {status:'invalid',diagnostic:{code:'INVALID_CONFIG',reason:metrics.error,path:'data.words',message:'The renderer could not measure these single-line words.'}};
      if(!metrics?.measurements)return {status:'empty',scene:measuringWordCloud(preparation)};
      return planNativeChart(preparation.spec,{width:preparation.width,height:preparation.height,hiddenSeriesIds:input.hidden,wordcloudText:{fontKey:preparation.fontKey,measurements:metrics.measurements}});
    }
    return planChartData(input.data,input.hidden,input.dimensions,{...((input.data.type==='pie'||input.data.type==='donut'||input.data.type==='gauge')&&(input.circularStart!==undefined||input.circularEnd!==undefined||input.gaugeStyle!==undefined||input.gaugeTicks!==undefined)?{radialDisplay:{...(input.circularStart===undefined?{}:{startAngle:input.circularStart}),...(input.circularEnd===undefined?{}:{endAngle:input.circularEnd}),...(input.gaugeStyle===undefined?{}:{gaugeStyle:input.gaugeStyle}),...(input.gaugeTicks===undefined?{}:{tickCount:input.gaugeTicks})}}:{}),...((input.data.type==='flame'||input.data.type==='violin')?{profile:{...(input.data.type==='flame'&&input.temporalRowPadding!==undefined?{rowPadding:input.temporalRowPadding}:{}),...(input.data.type==='violin'?{...(input.profileBandwidth===undefined?{}:{bandwidth:input.profileBandwidth}),...(input.profileResolution===undefined?{}:{resolution:input.profileResolution}),...(input.profileNormalization===undefined?{}:{normalization:input.profileNormalization}),...(input.heatmapGap===undefined?{}:{gapRatio:input.heatmapGap})}:{})}}:{}),...(input.data.type==='dendrogram'?{dendrogram:{...(input.sankeyOrientation===undefined?{}:{orientation:input.sankeyOrientation})}}:{}),...(input.data.type==='parallel'?{parallel:{...(input.parallelCoordinates===undefined?{}:{coordinates:input.parallelCoordinates})}}:{}),...((input.data.type==='windrose'||input.data.type==='radialbar')?{circular:{...(input.heatmapGap===undefined?{}:{gapRatio:input.heatmapGap}),...(input.circularInner===undefined?{}:{innerRadiusRatio:input.circularInner}),...(input.stacking===undefined?{}:{stacking:input.stacking})}}:{}),...(input.data.type==='heatmap'?{heatmap:{...(input.heatmapGap===undefined?{}:{gapRatio:input.heatmapGap}),...(input.tileOpacity===undefined?{}:{opacity:input.tileOpacity}),...(input.tileColorAxis===undefined?{}:{colorAxis:input.tileColorAxis})}}:{}),...(input.data.type==='venn'?{venn:{...(input.vennPadding===undefined?{}:{padding:input.vennPadding})}}:{}),...(input.data.type==='pictorial'?{pictorial:{...(input.pictorialShape===undefined?{}:{shape:input.pictorialShape}),...(input.pictorialGap===undefined?{}:{gap:input.pictorialGap}),...(input.pictorialBackground===undefined?{}:{background:input.pictorialBackground})}}:{}),...(input.data.type==='tilemap'?{tilemap:{...(input.tileShape===undefined?{}:{tileShape:input.tileShape}),...(input.comparisonPointPadding===undefined?{}:{pointPadding:input.comparisonPointPadding}),...(input.tileOpacity===undefined?{}:{opacity:input.tileOpacity}),...(input.tileColorAxis===undefined?{}:{colorAxis:input.tileColorAxis})}}:{}),...(input.data.type==='contour'?{contour:{levels:input.contourLevels??[],segmentBudget:input.contourBudget??4096}}:{}),...((input.data.type==='dependencywheel'||input.data.type==='chord')?{relationship:{...(input.relationshipStartAngle===undefined?{}:{startAngle:input.relationshipStartAngle}),...(input.sankeyNodeWidth===undefined?{}:{nodeWidth:input.sankeyNodeWidth}),...(input.sankeyNodePadding===undefined?{}:{nodePadding:input.sankeyNodePadding})}}:input.data.type==='arcdiagram'?{relationship:{...(input.reversed===undefined?{}:{reversed:input.reversed}),...(input.relationshipNodeRadius===undefined?{}:{nodeRadius:input.relationshipNodeRadius}),...(input.relationshipLinkWidth===undefined?{}:{linkWidth:input.relationshipLinkWidth})}}:{}),...((input.data.type==='bullet'||input.data.type==='variwide')?{comparison:{...(input.data.type==='bullet'&&input.sankeyOrientation!==undefined?{orientation:input.sankeyOrientation}:{}),...(input.comparisonPointPadding===undefined?{}:{pointPadding:input.comparisonPointPadding}),...(input.data.type==='bullet'&&input.comparisonBands!==undefined?{bands:input.comparisonBands}:{})}}:{}),...((input.data.type==='xrange'||input.data.type==='timeline')?{temporal:{...(input.temporalGrouping===undefined?{}:{grouping:input.temporalGrouping}),...(input.temporalRowPadding===undefined?{}:{rowPadding:input.temporalRowPadding}),...(input.temporalLabelPosition===undefined?{}:{labelPosition:input.temporalLabelPosition}),...(input.temporalLabelMaxWidth===undefined?{}:{labelMaxWidth:input.temporalLabelMaxWidth}),...(input.markerRadius===undefined?{}:{markerRadius:input.markerRadius})}}:{}),...((input.data.type==='treegraph'||input.data.type==='organization')&&input.sankeyOrientation!==undefined?{hierarchy:{orientation:input.sankeyOrientation}}:{}),...(input.data.type==='sankey'?{sankey:{...(input.sankeyOrientation===undefined?{}:{orientation:input.sankeyOrientation}),...(input.sankeyNodeWidth===undefined?{}:{nodeWidth:input.sankeyNodeWidth}),...(input.sankeyNodePadding===undefined?{}:{nodePadding:input.sankeyNodePadding})}}:{}),...((input.data.type==='packedbubble'||input.data.type==='variablepie'||input.data.type==='item'||input.data.type==='boxplot'||input.data.type==='errorbar'||input.data.type==='lollipop'||input.data.type==='dumbbell')?{glyphs:{...(input.splitSeries===undefined?{}:{splitSeries:input.splitSeries}),...(input.columns===undefined?{}:{columns:input.columns}),...(input.minRadiusRatio===undefined?{}:{minRadiusRatio:input.minRadiusRatio}),...(input.radiusScale===undefined?{}:{radiusScale:input.radiusScale}),...(input.markerRadius===undefined?{}:{markerRadius:input.markerRadius}),...(input.whiskerWidth===undefined?{}:{whiskerWidth:input.whiskerWidth}),...(input.capWidth===undefined?{}:{capWidth:input.capWidth})}}:{}),...((input.data.type==='funnel'||input.data.type==='pyramid')?{shape:{...(input.neckWidth===undefined?{}:{neckWidth:input.neckWidth}),...(input.neckHeight===undefined?{}:{neckHeight:input.neckHeight}),...(input.reversed===undefined?{}:{reversed:input.reversed})}}:{}),...(input.stacking&&input.data.type!=='windrose'?{stacking:input.stacking}:{}),...(input.stackGroups?{stackGroups:input.stackGroups}:{}),...(input.scales?{scales:input.scales}:{}),...(input.references.length?{references:input.references}:{}),...(input.referenceBands.length?{referenceBands:input.referenceBands}:{}),...(input.enabled?{viewport:{axes:input.axes,value}}:{})});
  }
  private readonly planning=computed(()=>this.renderActive()?(this.viewState().prepared??this.calculateWindow(this.viewState().value)):null);
  protected readonly viewportModel=computed(()=>{const result=this.planning();return !result||result.status==='invalid'?undefined:result.viewport;});
  protected readonly viewportRevision=computed(()=>this.viewState().revision);
  private readonly viewportAcknowledgment=signal(0);
  protected readonly viewportContext=computed<NativeViewportContext|undefined>(()=>{
    const model=this.viewportModel(),settings=this.options().viewport;if(!model||!settings)return undefined;
    return {model,generation:this.planInputs(),revision:this.viewState().revision,acknowledgment:this.viewportAcknowledgment(),pinch:settings.pinch??true,pan:settings.pan??true,controls:settings.controls??true};
  },{equal:(a,b)=>a===b||!!a&&!!b&&a.model===b.model&&a.generation===b.generation&&a.revision===b.revision&&a.acknowledgment===b.acknowledgment&&a.pinch===b.pinch&&a.pan===b.pan&&a.controls===b.controls});
  protected requestViewport(request:NativeViewportRequest):void{
    if(this.destroyed||!this.renderActive())return;
    try{
      const model=this.viewportModel();if(!model||request.model&&request.model!==model)return;
      const result=transformPlanViewport(model,request.intent);
      if(result.status==='invalid'){this.planningError.emit(result.diagnostic);return;}
      this.commitViewport(result.value,request.source,true);
    }finally{this.viewportAcknowledgment.update(value=>value+1);}
  }
  private commitViewport(value:PlanViewportValue,source:NativeViewportChange['source'],owned=false):boolean{
    if(this.destroyed||!this.renderActive())return false;
    if(!this.planInputs().enabled)return false;
    if(owned&&sameViewportValue(value,this.viewState().value))return true;
    // Validate/project once before committing. A rejected gesture keeps the
    // current chart and its reset controls; computed planning reuses this result.
    const result=this.calculateWindow(value);if(result.status==='invalid'){this.planningError.emit(result.diagnostic);return false;}
    const committed=result.viewport?.value;if(!committed)return false;
    if(sameViewportValue(committed,this.viewState().value))return true;
    this.viewState.set({value:committed,prepared:result,revision:this.viewState().revision+1});
    this.viewportChange.emit({value:committed,source});return true;
  }
  setViewport(value:PlanViewportValue):boolean{return this.commitViewport(value,'api');}
  resetViewport():void{this.requestViewport({intent:{type:'reset'},source:'api'});}
  zoomBy(factor:number):void{this.requestViewport({intent:{type:'zoom',factor},source:'api'});}
  private readonly metadata=computed(()=>{
    const options=this.options(),paint=waterfallAppearance(this.data(),options);return {title:options.title??'',description:options.subtitle??'',secondaryUnit:options.format&&'secondaryUnit' in options.format?options.format.secondaryUnit:undefined,unit:options.format?.unit??(this.data().type==='column'?'':this.data().type==='networkgraph'||this.data().type==='treegraph'||this.data().type==='organization'?(options.appearance?.locale==='en'?'Connections':'Conexiones'):undefined),series:this.data().type==='pareto'?[{id:'values',name:options.appearance?.locale==='en'?'Values':'Valores',color:'#2C6DCD'},{id:'cumulative',name:options.appearance?.locale==='en'?'Cumulative':'Acumulado',color:'#638A35'}].map(item=>({...item,...paint.series?.find(series=>series.id===item.id)})):paint.series,points:paint.points,referenceStyles:this.referenceStyles(),referenceBandStyles:this.referenceBandStyles()};
  },{equal:(a,b)=>a.title===b.title&&a.description===b.description&&a.unit===b.unit&&a.secondaryUnit===b.secondaryUnit&&samePointAppearance(a.points,b.points)&&a.referenceStyles===b.referenceStyles&&a.referenceBandStyles===b.referenceBandStyles&&a.series?.length===b.series?.length&&(a.series??[]).every((item,i)=>item.id===b.series?.[i]?.id&&item.name===b.series?.[i]?.name&&item.color===b.series?.[i]?.color)});
  protected readonly physicalAxes=computed(()=>{
    const data=this.data(),settings=this.options(),axes=settings.axes,layout=settings.layout;
    const horizontal=data.type==='column'&&data.orientation==='horizontal'||data.type==='bullet'&&(layout&&'orientation' in layout?layout.orientation??'horizontal':'horizontal')==='horizontal';
    return horizontal?{x:axes?.y,y:axes?.x,secondary:undefined}:{x:axes?.x,y:axes?.y,secondary:axes&&'secondaryY' in axes?axes.secondaryY:undefined};
  });
  private readonly presentation=computed<NativePlanningResult|null>(()=>{
    const result=this.planning();if(!result||result.status==='invalid')return result;
    const error=this.optionError();if(error)return {status:'invalid',diagnostic:error};
    const metadata=this.metadata();
    // A null gauge has no drawable reading yet. Retain the option for its next
    // valid value instead of treating the deliberately empty scene as a bad ID.
    const series=this.data().type==='gauge'&&result.scene.observations.length===0?[]:metadata.series;
    try{return {status:result.status,scene:updateScenePresentation(result.scene,{...metadata,points:visiblePointAppearance(result.scene,metadata.points),series,unit:metadata.unit??result.scene.unit})};}
    catch{return {status:'invalid',diagnostic:{code:'INVALID_CONFIG',reason:'INVALID_PRESENTATION',path:'options',message:'Check title lengths and series IDs/colors in appearance.series.'}};}
  });
  private readonly optionError=computed(()=>optionsDiagnostic(this.data(),this.options()));
  readonly diagnostic:Signal<NativeChartDiagnostic|null>=computed(()=>{const result=this.presentation();return !result?null:result.status==='invalid'?result.diagnostic:this.optionError();});
  readonly scene=computed(()=>{const result=this.presentation();return !result||result.status==='invalid'||this.optionError()?null:result.scene;});
  constructor(){
    inject(DestroyRef).onDestroy(this.activity.onSuspend(()=>{
      this.suppressResumeMotion.set(true);
      this.viewState.update(state=>state.prepared?{...state,prepared:null}:state);
      this.wordQueue.begin([]);this.wordMetrics.set({input:null,snapshot:this.wordQueue.snapshot});this.wordPreparation();
      this.scene();this.viewportContext();
      if(this.lastInteraction?.active||this.lastInteraction?.selected||this.lastInteraction?.scrubbing||this.lastInteraction?.pinned)this.forwardInteraction({active:null,selected:null,scrubbing:false});
    }));
    let wasActive=false,everActive=false,previousData:T|undefined,previousOptions:NativeChartOptions<NoInfer<T['type']>>|undefined,previousHidden:readonly string[]|undefined;
    effect(()=>{
      const active=this.renderActive(),data=this.data(),options=this.options(),hidden=this.hiddenSeriesIds();
      const suspending=wasActive&&!active;
      if(active&&!wasActive){this.suppressResumeMotion.set(everActive);everActive=true;}
      else if(active&&(data!==previousData||options!==previousOptions||hidden!==previousHidden))this.suppressResumeMotion.set(false);
      wasActive=active;previousData=data;previousOptions=options;previousHidden=hidden;
      if(!active){
        if(suspending)this.viewState.update(state=>state.prepared?{...state,prepared:null}:state);
        // Re-evaluate nullable caches so they release their previous geometry.
        this.scene();this.viewportContext();
        if(this.lastInteraction?.active||this.lastInteraction?.selected||this.lastInteraction?.scrubbing||this.lastInteraction?.pinned)this.forwardInteraction({active:null,selected:null,scrubbing:false});
      }
    });
    effect(()=>{const input=this.wordPreparation();this.wordQueue.begin(input?.status==='ok'?input.preparation.requests:[]);this.wordMetrics.set({input,snapshot:this.wordQueue.snapshot});});
    inject(DestroyRef).onDestroy(()=>{this.destroyed=true;this.wordQueue.destroy();});
    effect(()=>{if(!this.renderActive())return;const requested=this.hiddenSeriesIds(),effective=this.visibility();if(!Array.isArray(requested)||requested.length!==effective.length||requested.some((id,i)=>id!==effective[i]))this.hiddenSeriesIds.set(effective);});
    effect(()=>{const error=this.diagnostic();if(error){
      if(this.lastInteraction?.active||this.lastInteraction?.selected||this.lastInteraction?.scrubbing||this.lastInteraction?.pinned)this.forwardInteraction({active:null,selected:null,scrubbing:false});
      this.planningError.emit(error);
    }});
  }
}
