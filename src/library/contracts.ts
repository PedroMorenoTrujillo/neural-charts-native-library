import type {NativeMixedRangesLayout} from './composition-scene.js';
export type {NativeMixedRangesLayout} from './composition-scene.js';
import type {NativeFanLayout,NativeFanValue,NativeRegressionLayout,NativeRegressionValue} from './uncertainty-scene.js';
export type {NativeFanLayout,NativeFanValue,NativeRegressionLayout,NativeRegressionValue} from './uncertainty-scene.js';
import type {NativeFlameLayout,NativeFlameValue,NativeViolinLayout,NativeViolinValue} from './profile-scene.js';
export type {NativeFlameLayout,NativeFlameValue,NativeViolinLayout,NativeViolinValue} from './profile-scene.js';
import type {NativeDendrogramLayout,NativeDendrogramValue} from './dendrogram-scene.js';
export type {NativeDendrogramLayout,NativeDendrogramValue} from './dendrogram-scene.js';
import type {NativeParallelLayout,NativeParallelValue} from './parallel-scene.js';
export type {NativeParallelLayout,NativeParallelValue} from './parallel-scene.js';
import type {NativeHeatmapGeometry,NativeHeatmapValue} from './heatmap-scene.js';
import type {NativeVennGeometry} from './venn-scene.js';
import type {PlanVennValue} from '@neural-charts/core/plan';
/** Experimental native transport, NOT the frozen/private web SceneFrame contract. */
export type DatumId = Readonly<{ seriesId: string; pointId: string }>;
import type {ComparisonFields,ComparisonPoint} from './comparison-scene.js';
import type {NativePictorialGeometry} from './pictorial-scene.js';
import type {PlanPictorialValue,PlanCompoundPolygonHit} from '@neural-charts/core/plan';
import type {NativeTilemapGeometry,NativeTilemapValue} from './tilemap-scene.js';
import type {PlanCellPaint} from '@neural-charts/core/plan';
import type {PlanContourValue,PlanContourLayout} from '@neural-charts/core/plan';
import type {PlanRelationshipMetadata} from '@neural-charts/core/plan';
import type {NativeStackGroupsLayout,NativeMixedAxesLayout} from './composition-scene.js';
import type {NativeCircularFrame,NativeRadialSummary} from './circular-scene.js';
export type {NativeCircularGeometry,NativeSectorCircularFrame,NativeGaugeCircularBase,NativeSolidGaugeFrame,NativeNeedleGaugeFrame,NativeCircularFrame,NativeRadialSummary} from './circular-scene.js';
export type {NativeStackGroupsLayout,NativeMixedAxesLayout,NativeMixedYAxisFrame} from './composition-scene.js';
export type ChartFamily = 'fan' | 'regression' | 'flame' | 'violin' | 'dendrogram' | 'parallel' | 'heatmap' | 'venn' | 'wordcloud' | 'pictorial' | 'tilemap' | 'contour' | 'dependencywheel' | 'arcdiagram' | 'chord' | 'bullet' | 'variwide' | 'xrange' | 'timeline' | 'sankey' | 'vector' | 'windbarb' | 'networkgraph' | 'packedbubble' | 'sunburst' | 'treegraph' | 'organization' | 'variablepie' | 'item' | 'polygon' | 'lollipop' | 'dumbbell' | 'columnpyramid' | 'boxplot' | 'errorbar' | 'streamgraph' | 'areaspline' | 'arearange' | 'areasplinerange' | 'columnrange' | 'histogram' | 'bellcurve' | 'funnel' | 'pyramid' | 'pareto' | 'radar' | 'polar' | 'windrose' | 'radialbar' | 'waterfall' | 'treemap' | 'line' | 'area' | 'spline' | 'mixed' | 'scatter' | 'column' | 'bar' | 'pie' | 'donut' | 'gauge' | 'bubble';
export type TooltipMode = 'floating' | 'docked' | 'off';
export type TooltipContent = 'point' | 'shared';
export type LegendPosition = 'top' | 'bottom' | 'left' | 'right';
export interface NativeTextStyleOptions {
  readonly align?:'left'|'center'|'right';
  readonly color?:string;
  /** Logical text size; native system font scaling remains enabled. */
  readonly fontSize?:number;
  readonly fontWeight?:400|500|600|700;
}
export type NativeMarkerShape='circle'|'square'|'diamond'|'triangle';
export interface NativeMarkerStyle {
  readonly shape?:NativeMarkerShape;
  readonly fillColor?:string;
  readonly borderColor?:string;
  readonly borderWidth?:number;
}
export type NativeReferenceDash='solid'|'dash'|'dot';
export interface NativeReferenceStyle {
  readonly id:string;
  readonly label?:string;
  readonly color?:string;
  readonly width?:number;
  readonly dash?:NativeReferenceDash;
}
export type NativeReference=NativeReferenceStyle&Readonly<{axis:'x'|'y';valueAxis?:'secondary'}>&(
  Readonly<{status:'visible';line:Readonly<{x1:number;y1:number;x2:number;y2:number}>}>
  |Readonly<{status:'outside'|'unavailable';line?:never}>
);
export interface NativeReferenceBandStyle {
  readonly id:string;
  readonly label?:string;
  readonly color?:string;
  readonly opacity?:number;
}
/** Metadata and a clipped rectangle supplied by Core, in represented axis units. */
export type NativeReferenceBand=NativeReferenceBandStyle&Readonly<{axis:'x'|'y';from:string|number;to:string|number;valueAxis?:'secondary'}>&(
  Readonly<{status:'visible';box:Readonly<{x:number;y:number;width:number;height:number}>}>
  |Readonly<{status:'outside'|'unavailable';box?:never}>
);
export interface NativePointAppearance {readonly seriesId:string;readonly pointId:string;readonly color:string;}
/** Presentation inputs for reusable configurations. Bind fields to NativeChart inputs. */
export interface NativeChartPresentation {
  readonly animationKey?: number;
  readonly animationEnabled?: boolean;
  readonly animationDuration?: number;
  readonly hapticsEnabled?: boolean;
  readonly showLegend?: boolean;
  readonly legendPosition?: LegendPosition;
  readonly legendInteractive?: boolean;
  readonly showGrid?: boolean;
  readonly showXAxis?: boolean;
  readonly showYAxis?: boolean;
  readonly showSecondaryYAxis?:boolean;
  readonly secondaryYAxisTitle?:string;
  readonly secondaryYAxisTitleStyle?:NativeTextStyleOptions;
  readonly xAxisTitle?: string;
  readonly yAxisTitle?: string;
  readonly locale?: 'es' | 'en';
  readonly theme?: 'light' | 'dark' | 'system';
  readonly tooltipMode?: TooltipMode;
  readonly tooltipContent?: TooltipContent;
  readonly tooltipPinnable?: boolean;
  readonly showCrosshair?: boolean;
  readonly showMarkers?: boolean;
  readonly showDataLabels?: boolean;
  readonly strokeWidth?: number;
  readonly markerSize?: number;
  readonly markerStyle?:NativeMarkerStyle;
  readonly titleStyle?:NativeTextStyleOptions;
  readonly subtitleStyle?:NativeTextStyleOptions;
  readonly xAxisTitleStyle?:NativeTextStyleOptions;
  readonly yAxisTitleStyle?:NativeTextStyleOptions;
  readonly plotHeight?: number;
  readonly interactionMode?: 'explore' | 'tap';
}
export type HitRegion = PlanCompoundPolygonHit | Readonly<{type:'polygon';vertices:readonly Readonly<{x:number;y:number}>[]}> | Readonly<{type:'circle';cx:number;cy:number;radius:number}>
  /** Radians, clockwise from twelve o'clock; sectors share one unwrapped turn. */
  | Readonly<{type:'sector';cx:number;cy:number;innerRadius:number;radius:number;start:number;end:number}>;
/** Semantic group key comes from the planner, never from a formatted label or a hit pixel. */
export type ObservationGroup = Readonly<{key:string;label:string;coordinate:number}>;
export type Observation = Readonly<{
  readonly valueAxis?:'primary'|'secondary';
  readonly fan?:NativeFanValue;
  readonly regression?:NativeRegressionValue;
  readonly flame?:NativeFlameValue;
  readonly violin?:NativeViolinValue;
  readonly dendrogram?:NativeDendrogramValue;
  readonly parallel?:NativeParallelValue;
  readonly heatmap?:NativeHeatmapValue;
  readonly venn?:PlanVennValue;
  readonly pictorial?:PlanPictorialValue;
  readonly tilemap?:NativeTilemapValue;
  readonly contour?:PlanContourValue;
  readonly relationship?:PlanRelationshipMetadata;
  readonly bullet?:ComparisonPoint['bullet'];
  readonly variwide?:ComparisonPoint['variwide'];
  id: DatumId;
  label: string;
  seriesName: string;
  value: number;
  readonly sankey?:(Readonly<{type:'node';incoming:number;outgoing:number}>|Readonly<{type:'link';from:string;to:string;fromLabel:string;toLabel:string}>)&Readonly<{geometryOmitted?:true}>;
  readonly interval?:Readonly<{type:'linear'|'time';rowId:string;rowLabel:string;start:number;end:number;duration:number;completed?:number|null}>;
  readonly event?:Readonly<{type:'linear'|'time';coordinate:number;title:string;description?:string}>;
  readonly vector?:Readonly<{dx:number;dy:number}>;
  readonly wind?:Readonly<{direction:number|null}>;
  readonly yValue?:number;
  readonly node?:Readonly<{incoming:number;outgoing:number}&({depth:number;directed?:true}|{directed:false;depth?:never})>;
  readonly stem?:Readonly<{x:number;startY:number;endY:number}>;
  readonly minimumValue?:number;readonly q1Value?:number;readonly medianValue?:number;readonly q3Value?:number;readonly maximumValue?:number;
  readonly lowValue?:number;readonly highValue?:number;
  /** Coordinates in the scene's plot-local viewBox, independent of physical pixels. */
  /** Columns use centre X / value-end Y; horizontal bars use value-end X / centre Y. */
  x: number;
  y: number;
  color: string;
  hit?: HitRegion;
  sizeValue?: number;
  xValue?: number;
  percentage?: number;
  subtotal?:boolean;
  incomplete?:boolean;
  valueUnit?:'%';
  computedKind?:'subtotal'|'total';
  group?: ObservationGroup;
}>;
export interface NativeBar {readonly pointId?:string;readonly x:number;readonly y:number;readonly width:number;readonly height:number;}
export interface NativeCircle {readonly pointId?:string;readonly cx:number;readonly cy:number;readonly radius:number;}
export interface NativeLegendItem {readonly id:string;readonly name:string;readonly color:string;readonly visible:boolean;}
export interface NativeSeries {
  readonly textGlyphs?:readonly import('@neural-charts/core/plan').PlanWordCloudTextGlyph[];
  readonly cells?:readonly PlanCellPaint[];
  readonly id:string;
  readonly name:string;
  readonly color:string;
  readonly path?:string;
  readonly areaPath?:string;
  /** Opaque relationship nodes, painted above every ribbon. */
  readonly nodePath?:string;
  readonly fill?:boolean;
  readonly circles?:readonly NativeCircle[];
  readonly bars?:readonly NativeBar[];
}
interface NativeAxisTickValue {readonly value?:number;readonly type?:'number'|'time';}
export interface NativeGridTick extends NativeAxisTickValue {readonly y:number;readonly label:string;}
export interface NativeAxisLabel extends NativeAxisTickValue {readonly x:number;readonly label:string;}
export interface NativeCategoryLabel {readonly id:string;readonly y:number;readonly label:string;}
export interface NativeAnnotation {readonly x:number;readonly y:number;readonly text:string;readonly role:'value'|'label';readonly box?:Readonly<{width:number;height:number;seriesId:string}>;readonly stackTotal?:Readonly<{value:number;sign:'positive'|'negative';percentage?:true}>;}
export interface NativeIntervalSummary {
  readonly id:DatumId;readonly label:string;readonly rowId:string;readonly rowLabel:string;
  readonly start:number|null;readonly end:number|null;readonly duration:number|null;readonly completed?:number|null;
  /** Series/legend visibility, independent of viewport clipping. */
  readonly visible:boolean;readonly missing:boolean;
}
export interface NativeEventSummary {
  readonly id:DatumId;readonly x:number|null;readonly title:string;readonly description?:string;
  /** Series/legend visibility, independent of viewport clipping. */
  readonly visible:boolean;readonly missing:boolean;
}
export interface NativeScene extends ComparisonFields {
  readonly circular?:NativeCircularFrame;
  readonly radialSummary?:NativeRadialSummary;
  readonly stackGroups?:NativeStackGroupsLayout;
  readonly mixedRanges?:NativeMixedRangesLayout;
  readonly mixedAxes?:NativeMixedAxesLayout;
  readonly secondaryUnit?:string;
  readonly fan?:NativeFanLayout;
  readonly regression?:NativeRegressionLayout;
  readonly flame?:NativeFlameLayout;
  readonly violin?:NativeViolinLayout;
  readonly dendrogram?:NativeDendrogramLayout;
  readonly parallel?:NativeParallelLayout;
  readonly heatmap?:NativeHeatmapGeometry;
  readonly venn?:NativeVennGeometry;
  readonly wordcloud?:import('./wordcloud-scene.js').NativeWordCloudGeometry;
  readonly pictorial?:NativePictorialGeometry;
  readonly tilemap?:NativeTilemapGeometry;
  readonly contour?:PlanContourLayout;
  readonly intervals?:readonly NativeIntervalSummary[];
  readonly events?:readonly NativeEventSummary[];
  readonly clip?:Readonly<{x:number;y:number;width:number;height:number}>;
  readonly distribution?:Readonly<{derived:true;sampleCount:number;mean?:number;sampleStandardDeviation?:number}>;
  readonly secondaryGrid?:readonly NativeGridTick[];
  readonly polarGrid?:Readonly<{cx:number;cy:number;radius:number;rings:readonly Readonly<{radius:number;label:string;path?:string}>[];spokes:readonly Readonly<{id:string;x:number;y:number;label:string}>[]}>;
  readonly schema: 'nc-native-scene/0';
  readonly family: ChartFamily;
  readonly title: string;
  readonly description: string;
  readonly unit: string;
  readonly width: number;
  readonly height: number;
  /** All legend items, including those hidden by the planner. */
  readonly legend?:readonly NativeLegendItem[];
  /** Render-only geometry. Paths may exceed the plot for clipping, within safety bounds. */
  readonly series: readonly NativeSeries[];
  readonly grid: readonly NativeGridTick[];
  readonly labels: readonly NativeAxisLabel[];
  readonly yLabels?: readonly NativeCategoryLabel[];
  /** Missing observations have no hit target. Zero remains a valid observation. */
  readonly observations: readonly Observation[];
  readonly annotations?: readonly NativeAnnotation[];
  readonly references?:readonly NativeReference[];
  readonly referenceBands?:readonly NativeReferenceBand[];
  readonly points?:readonly NativePointAppearance[];
}
export interface FrameClock {
  request(callback: () => void): number;
  cancel(handle: number): void;
}
export interface HapticPort {
  /** A live query: false for opt-out, missing/unsupported hardware, or OS restrictions. */
  allowed(): boolean;
  selection(): void | Promise<void>;
}
export type InteractionSnapshot = Readonly<{
  active: Observation | null;
  selected: DatumId | null;
  scrubbing: boolean;
  /** Present only while the current point/group is pinned. */
  pinned?:true;
  shared?:SharedSelection;
}>;
export type SharedSelection=Readonly<{
  key:string;label:string;coordinate:number;points:readonly Observation[];
  rows:readonly Readonly<{seriesId:string;name:string;color:string;point:Observation|null}>[];
}>;
export const identityKey = (id: DatumId): string => JSON.stringify([id.seriesId, id.pointId]);
