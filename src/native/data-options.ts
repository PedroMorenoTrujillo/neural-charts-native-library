import type {PlanMixedRangeSpec} from './plan.js';
import type {NativeGroupedStackLayoutOptions,NativeMixedAxesOptions,NativeMixedFormatOptions} from './composition-options.js';
export type {NativeStackGroup,NativeGroupedStackLayoutOptions,NativeMixedAxesOptions,NativeMixedFormatOptions} from './composition-options.js';
import type {NativeFanData,NativeRegressionData} from './uncertainty-data.js';
import type {NativePieLayoutOptions,NativeDonutLayoutOptions,NativeGaugeLayoutOptions} from './circular-options.js';
export type {NativeCircularArcOptions,NativePieLayoutOptions,NativeDonutLayoutOptions,NativeGaugeLayoutOptions} from './circular-options.js';
export type {NativeFanData,NativeFanBand,NativeFanPoint,NativeFanInterval,NativeFanCategory,NativeFanCategoryAxis,NativeFanContinuousAxis,NativeFanBase,NativeFanCategoryData,NativeFanNumericData,NativeUncertaintyNumericAxis,NativeUncertaintyTicks,NativeRegressionData,NativeRegressionSeries,NativeRegressionPoint} from './uncertainty-data.js';
import type {NativeFlameData,NativeFlameLayoutOptions,NativeFlameAxesOptions,NativeViolinData,NativeViolinLayoutOptions,NativeViolinAxesOptions} from './profile-data.js';
export type {NativeFlameData,NativeFlameSpan,NativeFlameLayoutOptions,NativeFlameAxesOptions,NativeViolinData,NativeViolinSample,NativeViolinGroup,NativeViolinLayoutOptions,NativeViolinAxesOptions} from './profile-data.js';
import type {NativeDendrogramData,NativeDendrogramLayoutOptions,NativeDendrogramAxesOptions} from './dendrogram-data.js';
export type {NativeDendrogramData,NativeDendrogramNode,NativeDendrogramLayoutOptions,NativeDendrogramAxesOptions} from './dendrogram-data.js';
import type {NativeParallelData,NativeParallelLayoutOptions,NativeParallelAxesOptions} from './parallel-data.js';
export type {NativeParallelData,NativeParallelAxis,NativeParallelSeries,NativeParallelPoint,NativeParallelLayoutOptions,NativeParallelAxesOptions} from './parallel-data.js';
import type {NativeHeatmapData,NativeHeatmapLayoutOptions,NativeHeatmapColorAxisOptions,NativeHeatmapAxesOptions} from './heatmap-data.js';
export type {NativeHeatmapData,NativeHeatmapCell,NativeHeatmapAxis,NativeHeatmapCategory,NativeHeatmapLayoutOptions,NativeHeatmapColorAxisOptions,NativeHeatmapAxisOptions,NativeHeatmapAxesOptions} from './heatmap-data.js';
import type {NativeVennData,NativeVennLayoutOptions} from './venn-data.js';
export type {NativeVennData,NativeVennSet,NativeVennMeasure,NativeVennLayoutOptions} from './venn-data.js';
import type {NativeWordCloudData,NativeWordCloudLayoutOptions} from './wordcloud-data.js';
export type {NativeWordCloudData,NativeWordCloudWord,NativeWordCloudGroup,NativeWordCloudLayoutOptions} from './wordcloud-data.js';
import type {NativePictorialData,NativePictorialLayoutOptions} from './pictorial-data.js';
export type {NativePictorialData,NativePictorialLayoutOptions,NativePictorialShape,NativePictorialMesh,NativePictorialVertex,NativePictorialPoint,NativePictorialSeries,NativePictorialAxesData} from './pictorial-data.js';
import type {NativeTilemapData,NativeTilemapLayoutOptions,NativeTilemapColorAxisOptions} from './tilemap-data.js';
export type {NativeTilemapData,NativeTilemapLayoutOptions,NativeTilemapColorAxisOptions,NativeTileShape,NativeTilemapPoint,NativeTilemapSeries,NativeColorAxisScale,NativeColorStop,NativeColorClass} from './tilemap-data.js';
import type {NativeContourData,NativeContourLayoutOptions} from './contour-data.js';
export type {NativeContourData,NativeContourGrid,NativeContourLayoutOptions,NativeContourLevel} from './contour-data.js';
import type {NativeDependencyWheelData,NativeChordData,NativeArcDiagramData,NativeRadialRelationshipLayoutOptions,NativeArcDiagramLayoutOptions} from './relationship-data.js';
export type {NativeDependencyWheelData,NativeChordData,NativeArcDiagramData,NativeRadialRelationshipLayoutOptions,NativeArcDiagramLayoutOptions} from './relationship-data.js';
import type {PlanWindRoseSpec,PlanRadialBarSpec,PlanXRangeSpec,PlanTimelineSpec} from './plan.js';
import type {NativeBulletData,NativeVariwideData,NativeBulletLayoutOptions,NativeVariwideLayoutOptions} from './comparison-data.js';
export type {NativeBulletData,NativeVariwideData,NativeBulletLayoutOptions,NativeVariwideLayoutOptions} from './comparison-data.js';
import type {PlanSankeySpec} from './plan.js';
import type {PlanNetworkgraphSpec,PlanPackedBubbleSpec,PlanTreegraphSpec,PlanOrganizationSpec,PlanVariablePieSpec,PlanItemSpec,PlanPolygonSpec,PlanLollipopSpec,PlanDumbbellSpec,PlanColumnPyramidSpec,PlanBoxplotSpec,PlanErrorbarSpec,PlanSpec,PlanFunnelSpec,PlanPyramidSpec,PlanColumnSpec,PlanWaterfallPoint,NativePlanningResult,PlanViewportValue} from './plan.js';
import type {ChartFamily,LegendPosition,TooltipMode,NativeTextStyleOptions,NativeMarkerStyle,NativeReferenceStyle,NativeReferenceBandStyle,NativePointAppearance} from '../library/contracts.js';
import type {chartCapabilities,fixedDataLabelFamilies} from '../library/chart-capabilities.js';
export type {NativeTextStyleOptions,NativeMarkerStyle,NativeMarkerShape,NativeReference,NativeReferenceStyle,NativeReferenceDash,NativeReferenceBand,NativeReferenceBandStyle,NativePointAppearance} from '../library/contracts.js';

type DataPoint<T> = T extends object ? Omit<T,'color'|'datum'> & {readonly color?:never;readonly datum?:never} : T;
type DataSeries<T> = T extends {readonly data:readonly (infer P)[]} ? Omit<T,'color'|'markers'|'dash'|'data'> & {readonly color?:never;readonly markers?:never;readonly dash?:never;readonly data:readonly DataPoint<P>[]} : T;
type DataAxis<T> = T extends object ? Omit<T,'title'|'grid'|'labels'> & {readonly title?:never;readonly grid?:never;readonly labels?:never} : never;
type DataDefinition<T> = T extends PlanSpec ? {
  readonly [K in keyof T as K extends 'title'|'description'|'color' ? never : K extends 'family' ? 'type' : K]:
    K extends 'axes' ? {[A in keyof T[K]]: DataAxis<T[K][A]>} :
    K extends 'series' ? T[K] extends readonly (infer S)[] ? readonly DataSeries<S>[] : T[K] :
    K extends 'data' ? T[K] extends readonly (infer P)[] ? readonly DataPoint<P>[] : T[K] : T[K];
} & {readonly title?:never;readonly description?:never;readonly color?:never;readonly family?:never} : never;

/** Numeric data and axis semantics. Titles and series colors belong exclusively to options. */
export type NativeTreemapNode=Readonly<{id:string;label?:string;datum?:never; colorValue?:never}>&(Readonly<{value:number|null;children?:never}>|Readonly<{children:readonly NativeTreemapNode[];value?:never}>);
export interface NativeTreemapData {readonly type:'treemap';readonly root:NativeTreemapNode;readonly family?:never;readonly title?:never;readonly description?:never;readonly color?:never;}
export type NativeWaterfallPoint=PlanWaterfallPoint&Readonly<{datum?:never;color?:never}>;
export interface NativeWaterfallSeries {readonly id:string;readonly name:string;readonly data:readonly NativeWaterfallPoint[];readonly color?:never;}
export interface NativeWaterfallData {readonly type:'waterfall';readonly axes:DataDefinition<PlanColumnSpec>['axes'];readonly series:readonly [NativeWaterfallSeries];readonly startValue?:number;readonly groupGap?:number;readonly maxBarWidth?:number;readonly family?:never;readonly title?:never;readonly description?:never;readonly color?:never;}
export type NativeFunnelData=DataDefinition<Omit<PlanFunnelSpec,'neckWidth'|'neckHeight'|'reversed'>>&Readonly<{neckWidth?:never;neckHeight?:never;reversed?:never}>;
export type NativeFunnelPoint=NativeFunnelData['data'][number];
export type NativePyramidData=DataDefinition<Omit<PlanPyramidSpec,'reversed'>>&Readonly<{reversed?:never}>;
type GlyphData<T extends PlanSpec>=T extends unknown?DataDefinition<Omit<T,'whiskerWidth'|'capWidth'|'markerRadius'>>&Readonly<{whiskerWidth?:never;capWidth?:never;markerRadius?:never}>:never;
type VariablePieData<T>=T extends PlanVariablePieSpec?DataDefinition<Omit<T,'minRadiusRatio'|'radiusScale'>>&Readonly<{minRadiusRatio?:never;radiusScale?:never}>:never;
type ItemData<T>=T extends PlanItemSpec?DataDefinition<Omit<T,'columns'>>&Readonly<{columns?:never}>:never;
export type NativeSunburstData=Omit<NativeTreemapData,'type'>&Readonly<{type:'sunburst'}>;
export type NativeSankeyData=DataDefinition<Omit<PlanSankeySpec,'orientation'|'nodeWidth'|'nodePadding'>>&{readonly orientation?:never;readonly nodeWidth?:never;readonly nodePadding?:never};
export type NativeNetworkgraphData=DataDefinition<PlanNetworkgraphSpec>;
export type NativePackedBubbleData=DataDefinition<Omit<PlanPackedBubbleSpec,'splitSeries'>>&Readonly<{splitSeries?:never}>;
export type NativeTreegraphData=DataDefinition<PlanTreegraphSpec>;
export type NativeOrganizationData=DataDefinition<PlanOrganizationSpec>;
export type NativeVariablePieData=VariablePieData<PlanVariablePieSpec>;
export type NativeItemData=ItemData<PlanItemSpec>;
export type NativePolygonData=DataDefinition<PlanPolygonSpec>;
export type NativeLollipopData=GlyphData<PlanLollipopSpec>;
export type NativeDumbbellData=GlyphData<PlanDumbbellSpec>;
export type NativeColumnPyramidData=DataDefinition<PlanColumnPyramidSpec>;
export type NativeBoxplotData=GlyphData<PlanBoxplotSpec>;
export type NativeErrorbarData=GlyphData<PlanErrorbarSpec>;
export type NativeXRangeData=DataDefinition<Omit<PlanXRangeSpec,'grouping'|'rowPadding'>>&Readonly<{grouping?:never;rowPadding?:never}>;
export type NativeTimelineData=DataDefinition<Omit<PlanTimelineSpec,'labelPosition'|'labelMaxWidth'|'markerRadius'>>&Readonly<{labelPosition?:never;labelMaxWidth?:never;markerRadius?:never}>;
export type NativeWindRoseData=DataDefinition<Omit<PlanWindRoseSpec,'gapRatio'|'stacking'>>&Readonly<{gapRatio?:never;stacking?:never}>;
export type NativeRadialBarData=DataDefinition<Omit<PlanRadialBarSpec,'gapRatio'|'innerRadiusRatio'>>&Readonly<{gapRatio?:never;innerRadiusRatio?:never}>;
export interface NativeWindRoseLayoutOptions extends Omit<NativeUnstackedLayoutOptions,'stacking'> {readonly gapRatio?:number;readonly stacking?:'sum'|'percent';readonly stackLabels?:never;}
export interface NativeRadialBarLayoutOptions extends NativeUnstackedLayoutOptions {readonly gapRatio?:number;readonly innerRadiusRatio?:number;readonly stackLabels?:never;}
export type NativeChartData = NativeFanData|NativeRegressionData|NativeFlameData|NativeViolinData|NativeDendrogramData|NativeParallelData|NativeWindRoseData|NativeRadialBarData| NativeHeatmapData|NativeVennData|NativeWordCloudData|NativePictorialData|NativeTilemapData|NativeContourData|NativeDependencyWheelData|NativeChordData|NativeArcDiagramData|NativeBulletData|NativeVariwideData|NativeXRangeData|NativeTimelineData|NativeSankeyData|NativePackedBubbleData|NativeSunburstData|NativeVariablePieData|NativeItemData|NativeLollipopData|NativeDumbbellData|NativeBoxplotData|NativeErrorbarData| DataDefinition<Exclude<PlanSpec,{family:'fan'|'regression'|'flame'|'violin'|'dendrogram'|'parallel'|'windrose'|'radialbar'|'heatmap'|'venn'|'wordcloud'|'pictorial'|'tilemap'|'contour'|'dependencywheel'|'arcdiagram'|'chord'|'bullet'|'variwide'|'xrange'|'timeline'|'sankey'|'packedbubble'|'sunburst'|'variablepie'|'item'|'lollipop'|'dumbbell'|'boxplot'|'errorbar'|'funnel'|'pyramid'|'treemap'|'waterfall'}>>|NativeFunnelData|NativePyramidData|NativeTreemapData|NativeWaterfallData;
export type NativeChartDiagnostic = Extract<NativePlanningResult,{status:'invalid'}>['diagnostic'];
export type NativeParetoData=Extract<NativeChartData,{type:'pareto'}>;
export type NativeRadarData=Extract<NativeChartData,{type:'radar'}>;
export type NativeRadarSeries=NativeRadarData['series'][number];
export type NativePolarData=Extract<NativeChartData,{type:'polar'}>;
export type NativeLineData = Extract<NativeChartData,{type:'line'}>;
export type NativeAreaData=Extract<NativeChartData,{type:'area'}>;
export type NativeStreamgraphData=Extract<NativeChartData,{type:'streamgraph'}>;
export type NativeAreaSplineData=Extract<NativeChartData,{type:'areaspline'}>;
export type NativeAreaRangeData=Extract<NativeChartData,{type:'arearange'}>;
export type NativeAreaSplineRangeData=Extract<NativeChartData,{type:'areasplinerange'}>;
export type NativeColumnRangeData=Extract<NativeChartData,{type:'columnrange'}>;
export type NativeHistogramData=Extract<NativeChartData,{type:'histogram'}>;
export type NativeBellcurveData=Extract<NativeChartData,{type:'bellcurve'}>;
export type NativeSplineData=Extract<NativeChartData,{type:'spline'}>;
export type NativeVectorData=Extract<NativeChartData,{type:'vector'}>;
export type NativeWindbarbData=Extract<NativeChartData,{type:'windbarb'}>;
export type NativeScatterData=Extract<NativeChartData,{type:'scatter'}>;
export type NativeMixedRangeData=DataDefinition<PlanMixedRangeSpec>;
export type NativeMixedRangeSeries=Extract<NativeMixedRangeData['series'][number],{type:'arearange'|'areasplinerange'}>;
export type NativeMixedRangePoint=NativeMixedRangeSeries['data'][number];
export type NativeMixedRangeLineSeries=Extract<NativeMixedRangeData['series'][number],{type:'line'}>;
export type NativeMixedData=Extract<NativeChartData,{type:'mixed'}>;
export type NativeColumnData = Extract<NativeChartData,{type:'column'}>;
export type NativePieData = Extract<NativeChartData,{type:'pie'}>;
export type NativeDonutData = Extract<NativeChartData,{type:'donut'}>;
export type NativeGaugeData = Extract<NativeChartData,{type:'gauge'}>;
export type NativeBubbleData = Extract<NativeChartData,{type:'bubble'}>;

export interface NativeReferenceLineOptions<V extends string|number=string|number> extends NativeReferenceStyle {readonly value:V;}
/** Endpoints use represented axis units: percent-stacked Y uses 0–100. */
export interface NativeReferenceBandOptions<V extends string|number=string|number> extends NativeReferenceBandStyle {readonly from:V;readonly to:V;}
export interface NativeAxisPresentationOptions<V extends string|number=string|number> {
  readonly visible?:boolean;
  readonly title?:string;
  readonly titleStyle?:NativeTextStyleOptions;
  readonly referenceLines?:readonly NativeReferenceLineOptions<V>[];
}
export interface NativeBandedAxisOptions<V extends string|number=string|number> extends NativeAxisPresentationOptions<V> {readonly referenceBands?:readonly NativeReferenceBandOptions<V>[];}
export interface NativeUnbandedAxisOptions<V extends string|number=string|number> extends NativeAxisPresentationOptions<V> {readonly referenceBands?:never;}
/** Projection only: data coordinates, windows and tooltip values stay original. */
export interface NativeLogScaleOptions {readonly type:'log';readonly base?:10;}
export interface NativeLogarithmicAxisOptions<V extends string|number=string|number> extends NativeBandedAxisOptions<V> {readonly scale?:NativeLogScaleOptions;}
/** Resolved structural branches keep unbanded axes assignable to a supported
 * banded axis, while unsupported chart families still reject referenceBands. */
export type NativeAxisOptions<V extends string|number=string|number,Bands extends boolean=false>=Bands extends true?NativeBandedAxisOptions<V>:NativeUnbandedAxisOptions<V>;
export type NativeAxisScaleOptions<F extends ChartFamily>=F extends 'line'|'scatter'|'bubble'?Readonly<{scale?:NativeLogScaleOptions}>:Readonly<{scale?:never}>;
export interface NativeAxesOptions<F extends ChartFamily=ChartFamily> {
  readonly grid?:F extends 'timeline'?never:boolean;
  readonly x?:NativeAxisOptions<F extends 'bullet'|'variwide'|'column'|'bar'?string:F extends 'contour'|'xrange'|'timeline'|'vector'|'windbarb'|'polygon'|'bubble'|'scatter'?number:string|number,F extends 'line'|'area'|'spline'|'areaspline'|'column'|'bar'|'mixed'|'scatter'|'bubble'?true:false>&NativeAxisScaleOptions<F>&(F extends 'histogram'|'bellcurve'|'pareto'|'radar'|'polar'|'windrose'|'waterfall'|'column'|'bar'?{readonly referenceLines?:never}:unknown);
  readonly y?:F extends 'timeline'?never:NativeAxisOptions<number,F extends 'line'|'area'|'spline'|'areaspline'|'column'|'bar'|'mixed'|'scatter'|'bubble'?true:false>&NativeAxisScaleOptions<F>&(F extends 'xrange'|'histogram'|'bellcurve'|'pareto'|'radar'|'polar'|'windrose'?{readonly referenceLines?:never}:unknown);
}
export interface NativePictorialAxesOptions {
  readonly x?:Omit<NativeAxisOptions<string>,'referenceLines'>&Readonly<{referenceLines?:never}>;
  readonly y?:never;readonly grid?:never;
}
export interface NativeFormatOptions {
  readonly unit?:string;
}
export interface NativeMarkersOptions extends NativeMarkerStyle {
  readonly visible?:boolean;
  readonly diameter?:number;
}
export interface NativeWaterfallAppearance {readonly positiveColor?:string;readonly negativeColor?:string;readonly totalColor?:string;readonly connectorColor?:string;}
export interface NativeSeriesAppearance<F extends ChartFamily=ChartFamily> {
  readonly id:F extends 'gauge'?'reading':string;
  readonly color:string;
  readonly name?:string;
}
export interface NativeLegendOptions {
  readonly visible?:boolean;
  readonly position?:LegendPosition;
  readonly interactive?:boolean;
}
export interface NativeTooltipOptions<F extends ChartFamily=ChartFamily> {
  readonly mode?:TooltipMode;
  readonly content?:F extends 'fan'|'parallel'|'bullet'|'lollipop'|'dumbbell'|'columnpyramid'|'boxplot'|'errorbar'|'arearange'|'areasplinerange'|'columnrange'|'pareto'|'line'|'area'|'streamgraph'|'areaspline'|'spline'|'mixed'|'column'|'bar' ? 'point'|'shared' : 'point';
  readonly pinnable?:boolean;
  readonly crosshair?:F extends 'fan'|'regression'|'bullet'|'variwide'|'xrange'|'timeline'|'vector'|'windbarb'|'polygon'|'lollipop'|'dumbbell'|'columnpyramid'|'boxplot'|'errorbar'|'arearange'|'areasplinerange'|'columnrange'|'histogram'|'bellcurve'|'pareto'|'waterfall'|'line'|'area'|'streamgraph'|'areaspline'|'spline'|'mixed'|'scatter'|'column'|'bar'|'bubble' ? boolean : never;
}
export interface NativeAnimationOptions {
  readonly enabled?:boolean;
  readonly durationMs?:number;
  /** Increment to clear selection and replay entrance without remounting. */
  readonly revision?:number;
}
export interface NativeInteractionOptions {
  readonly mode?:'explore'|'tap';
  readonly haptics?:boolean;
  /** Show Previous, Next and Clear. Defaults to true. */
  readonly selectionControls?:boolean;
}
export interface NativeFunnelLayoutOptions {readonly minRadiusRatio?:never;readonly radiusScale?:never;readonly columns?:never;readonly markerRadius?:never;readonly whiskerWidth?:never;readonly capWidth?:never;readonly neckWidth?:number;readonly neckHeight?:number;readonly reversed?:boolean;readonly stacking?:never;readonly stackLabels?:never;}
export interface NativePyramidLayoutOptions {readonly minRadiusRatio?:never;readonly radiusScale?:never;readonly columns?:never;readonly markerRadius?:never;readonly whiskerWidth?:never;readonly capWidth?:never;readonly reversed?:boolean;readonly neckWidth?:never;readonly neckHeight?:never;readonly stacking?:never;readonly stackLabels?:never;}
export interface NativeStackedLayoutOptions {readonly minRadiusRatio?:never;readonly radiusScale?:never;readonly columns?:never;readonly markerRadius?:never;readonly whiskerWidth?:never;readonly capWidth?:never;readonly neckWidth?:never;readonly neckHeight?:never;readonly reversed?:never;readonly stacking:'sum'|'percent';readonly stackLabels?:boolean;readonly stackGroups?:never;}
export interface NativeUnstackedLayoutOptions {readonly minRadiusRatio?:never;readonly radiusScale?:never;readonly columns?:never;readonly markerRadius?:never;readonly whiskerWidth?:never;readonly capWidth?:never;readonly neckWidth?:never;readonly neckHeight?:never;readonly reversed?:never;readonly stacking?:never;readonly stackLabels?:false;readonly stackGroups?:never;}
export interface NativeXRangeLayoutOptions extends NativeUnstackedLayoutOptions {readonly grouping?:'grouped'|'overlap';readonly rowPadding?:number;}
export interface NativeTimelineLayoutOptions extends Omit<NativeUnstackedLayoutOptions,'markerRadius'> {readonly labelPosition?:'alternate'|'above'|'below';readonly labelMaxWidth?:number;readonly markerRadius?:number;}
export interface NativeSankeyLayoutOptions extends NativeUnstackedLayoutOptions {readonly orientation?:'horizontal'|'vertical';readonly nodeWidth?:number;readonly nodePadding?:number;}
export interface NativeHierarchyLayoutOptions extends NativeUnstackedLayoutOptions {readonly orientation?:'horizontal'|'vertical';}
export interface NativeBoxplotLayoutOptions {readonly minRadiusRatio?:never;readonly radiusScale?:never;readonly columns?:never;readonly markerRadius?:never;readonly whiskerWidth?:number;readonly capWidth?:never;readonly neckWidth?:never;readonly neckHeight?:never;readonly reversed?:never;readonly stacking?:never;readonly stackLabels?:never;}
export interface NativeErrorbarLayoutOptions {readonly minRadiusRatio?:never;readonly radiusScale?:never;readonly columns?:never;readonly markerRadius?:never;readonly capWidth?:number;readonly whiskerWidth?:never;readonly neckWidth?:never;readonly neckHeight?:never;readonly reversed?:never;readonly stacking?:never;readonly stackLabels?:never;}
export interface NativeMarkerGlyphLayoutOptions {readonly minRadiusRatio?:never;readonly radiusScale?:never;readonly columns?:never;readonly markerRadius?:number;readonly whiskerWidth?:never;readonly capWidth?:never;readonly neckWidth?:never;readonly neckHeight?:never;readonly reversed?:never;readonly stacking?:never;readonly stackLabels?:never;}
export interface NativeVariablePieLayoutOptions {readonly minRadiusRatio?:number;readonly radiusScale?:'area'|'radius';readonly columns?:never;readonly markerRadius?:never;readonly whiskerWidth?:never;readonly capWidth?:never;readonly neckWidth?:never;readonly neckHeight?:never;readonly reversed?:never;readonly stacking?:never;readonly stackLabels?:never;}
export interface NativeItemLayoutOptions {readonly columns?:number;readonly minRadiusRatio?:never;readonly radiusScale?:never;readonly markerRadius?:never;readonly whiskerWidth?:never;readonly capWidth?:never;readonly neckWidth?:never;readonly neckHeight?:never;readonly reversed?:never;readonly stacking?:never;readonly stackLabels?:never;}
export type NativeLayoutOptions=NativeStackedLayoutOptions|NativeUnstackedLayoutOptions;
export type NativeNumericWindow=readonly[number,number];
export interface NativeCategoryWindow {readonly firstId:string;readonly lastId:string;}
export type NativeViewportValue<F extends ChartFamily=ChartFamily>=F extends 'variwide'?Readonly<{y?:NativeNumericWindow}>:F extends 'flame'|'xrange'|'timeline'?Readonly<{x?:NativeNumericWindow}>:F extends 'pareto'?Readonly<{x?:NativeCategoryWindow}>:F extends 'column'|'bar'
  ? Readonly<{x?:NativeCategoryWindow;y?:NativeNumericWindow}>
  : F extends 'contour'|'vector'|'windbarb'|'networkgraph'|'packedbubble'|'treegraph'|'organization'|'polygon'|'bubble'|'scatter'?Readonly<{x?:NativeNumericWindow;y?:NativeNumericWindow}>:PlanViewportValue;
export interface NativeViewportOptions<F extends ChartFamily=ChartFamily> {
  /** Data axes; horizontal bars map category X to the physical vertical axis. */
  readonly axes?:F extends 'variwide'?'y':F extends 'packedbubble'|'sankey'?'xy':F extends 'flame'|'xrange'|'timeline'|'pareto'?'x':'x'|'y'|'xy';
  readonly pinch?:boolean;
  /** Two-finger pan leaves one-finger point exploration available. */
  readonly pan?:boolean;
  readonly controls?:boolean;
  readonly initial?:NativeViewportValue<F>;
}
export interface NativeViewportChange {readonly value:PlanViewportValue;readonly source:'controls'|'pinch'|'pan'|'api';}
export type NativeLabelLayout='auto'|'all'|'truncate';
export interface NativeAppearanceOptions<F extends ChartFamily=ChartFamily> {
  readonly opacity?:F extends 'heatmap'|'tilemap'?number:never;
  readonly waterfall?:F extends 'waterfall'?NativeWaterfallAppearance:never;
  readonly locale?:'es'|'en';
  readonly theme?:'light'|'dark'|'system';
  readonly title?:NativeTextStyleOptions;
  readonly subtitle?:NativeTextStyleOptions;
  readonly plotHeight?:number;
  /** Minimum data-area width in logical pixels, 0–1600. Surrounding content stays fixed. */
  readonly minPlotWidth?:F extends 'fan'|'regression'|'flame'|'violin'|'parallel'|'heatmap'|'pictorial'|'contour'|'arcdiagram'|'bullet'|'variwide'|'xrange'|'timeline'|'vector'|'windbarb'|'polygon'|'lollipop'|'dumbbell'|'columnpyramid'|'boxplot'|'errorbar'|'arearange'|'areasplinerange'|'columnrange'|'histogram'|'bellcurve'|'pareto'|'waterfall'|'line'|'area'|'streamgraph'|'areaspline'|'spline'|'mixed'|'scatter'|'column'|'bar'|'bubble' ? number : never;
  readonly lineWidth?:F extends 'fan'|'regression'|'violin'|'dendrogram'|'parallel'|'contour'|'pareto'|'radar'|'line'|'area'|'areaspline'|'spline'|'mixed' ? number : never;
  readonly markers?:F extends 'fan'|'regression'|'pareto'|'radar'|'line'|'area'|'areaspline'|'spline'|'mixed' ? NativeMarkersOptions : never;
  readonly dataLabels?:F extends 'parallel'|'wordcloud'|'pictorial'|'tilemap'|'gauge' ? never : boolean;
  /** Use all to allow overlap, or truncate to limit each label's width. Defaults to auto. */
  readonly dataLabelLayout?:F extends typeof fixedDataLabelFamilies[number]?never:NativeLabelLayout;
  /** Cartesian tick labels. Defaults to auto. */
  readonly axisLabelLayout?:F extends ChartFamily?typeof chartCapabilities[F]['axes'] extends 'cartesian'?NativeLabelLayout:never:never;
  /** Stable series/slice IDs; gauge reading uses "reading". No geometry is recalculated. */
  readonly series?:F extends 'heatmap'|'tilemap'?never:readonly NativeSeriesAppearance<F>[];
  readonly points?:F extends 'waterfall'|'line'|'area'|'areaspline'|'spline'|'mixed'|'scatter'|'column'|'bar'|'bubble'?readonly NativePointAppearance[]:never;
}
export interface NativeRenderingOptions {readonly active?:boolean;}
export interface NativeChartOptionGroups<F extends ChartFamily=ChartFamily> {
  /** Set false while a mounted host screen is hidden. No input data is discarded. */
  readonly rendering?:NativeRenderingOptions;
  readonly title?:string;
  readonly subtitle?:string;
  /** Value suffix; independent of axis titles. Gauges use data.unit. */
  readonly format?:F extends 'flame'|'violin'|'dendrogram'|'parallel'|'gauge'|'vector'|'windbarb' ? never : F extends 'mixed'?NativeMixedFormatOptions:NativeFormatOptions;
  readonly axes?:F extends 'mixed'?NativeMixedAxesOptions:F extends 'flame'?NativeFlameAxesOptions:F extends 'violin'?NativeViolinAxesOptions:F extends 'dendrogram'?NativeDendrogramAxesOptions:F extends 'parallel'?NativeParallelAxesOptions:F extends 'heatmap'?NativeHeatmapAxesOptions:F extends 'pictorial'?NativePictorialAxesOptions:F extends 'fan'|'regression'|'contour'|'bullet'|'variwide'|'xrange'|'timeline'|'vector'|'windbarb'|'polygon'|'lollipop'|'dumbbell'|'columnpyramid'|'boxplot'|'errorbar'|'arearange'|'areasplinerange'|'columnrange'|'histogram'|'bellcurve'|'pareto'|'radar'|'polar'|'windrose'|'waterfall'|'line'|'area'|'streamgraph'|'areaspline'|'spline'|'mixed'|'scatter'|'column'|'bar'|'bubble' ? NativeAxesOptions<F> : never;
  readonly legend?:F extends 'flame'|'dendrogram'|'heatmap'|'gauge'|'treemap' ? never : NativeLegendOptions;
  readonly tooltip?:NativeTooltipOptions<F>;
  readonly animation?:NativeAnimationOptions;
  readonly interaction?:NativeInteractionOptions;
  readonly colorAxis?:F extends 'heatmap'?NativeHeatmapColorAxisOptions:F extends 'tilemap'?NativeTilemapColorAxisOptions:never;
  readonly layout?:F extends 'pie'?NativePieLayoutOptions:F extends 'donut'?NativeDonutLayoutOptions:F extends 'gauge'?NativeGaugeLayoutOptions:F extends 'flame'?NativeFlameLayoutOptions:F extends 'violin'?NativeViolinLayoutOptions:F extends 'dendrogram'?NativeDendrogramLayoutOptions:F extends 'parallel'?NativeParallelLayoutOptions:F extends 'windrose'?NativeWindRoseLayoutOptions:F extends 'radialbar'?NativeRadialBarLayoutOptions:F extends 'heatmap'?NativeHeatmapLayoutOptions:F extends 'venn'?NativeVennLayoutOptions:F extends 'wordcloud'?NativeWordCloudLayoutOptions:F extends 'pictorial'?NativePictorialLayoutOptions:F extends 'tilemap'?NativeTilemapLayoutOptions:F extends 'contour'?NativeContourLayoutOptions:F extends 'dependencywheel'|'chord'?NativeRadialRelationshipLayoutOptions:F extends 'arcdiagram'?NativeArcDiagramLayoutOptions:F extends 'bullet'?NativeBulletLayoutOptions:F extends 'variwide'?NativeVariwideLayoutOptions:F extends 'xrange'?NativeXRangeLayoutOptions:F extends 'timeline'?NativeTimelineLayoutOptions:F extends 'sankey'?NativeSankeyLayoutOptions:F extends 'treegraph'|'organization'?NativeHierarchyLayoutOptions:F extends 'packedbubble'?NativeUnstackedLayoutOptions&Readonly<{splitSeries?:boolean}>:F extends 'variablepie'?NativeVariablePieLayoutOptions:F extends 'item'?NativeItemLayoutOptions:F extends 'lollipop'|'dumbbell'?NativeMarkerGlyphLayoutOptions:F extends 'boxplot'?NativeBoxplotLayoutOptions:F extends 'errorbar'?NativeErrorbarLayoutOptions:F extends 'funnel'?NativeFunnelLayoutOptions:F extends 'pyramid'?NativePyramidLayoutOptions:F extends 'column'|'bar'?NativeLayoutOptions|NativeGroupedStackLayoutOptions:F extends 'area'|'areaspline'?NativeLayoutOptions:never;
  readonly viewport?:F extends 'fan'|'regression'|'flame'|'contour'|'variwide'|'xrange'|'timeline'|'sankey'|'vector'|'windbarb'|'packedbubble'|'networkgraph'|'treegraph'|'organization'|'polygon'|'lollipop'|'dumbbell'|'columnpyramid'|'boxplot'|'errorbar'|'arearange'|'areasplinerange'|'columnrange'|'pareto'|'waterfall'|'line'|'area'|'streamgraph'|'areaspline'|'spline'|'mixed'|'scatter'|'column'|'bar'|'bubble'?NativeViewportOptions<F>:never;
  readonly appearance?:NativeAppearanceOptions<F>;
}
/** Isoline thresholds are required for Contour; appearance groups stay optional. */
export type NativeChartOptions<F extends ChartFamily=ChartFamily>=NativeChartOptionGroups<F>&(F extends 'contour'?Readonly<{layout:NativeContourLayoutOptions}>:unknown);
