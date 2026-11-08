import type {NativeAnimationOptions,NativeChartData,NativeChartDiagnostic,NativeChartOptions,NativeInteractionOptions} from './data-options.js';
import type {DatumId} from '../library/contracts.js';
import type {InteractionSnapshot} from '../library/contracts.js';
import type {PlanViewportValue} from './plan.js';

export type NativeChartDrilldownKind='column'|'pie'|'donut'|'treemap'|'sunburst'|'treegraph'|'organization';
export type NativeChartDrilldownChartData=Extract<NativeChartData,{readonly type:NativeChartDrilldownKind}>;
export interface NativeChartDrilldownNode<D extends NativeChartDrilldownChartData=NativeChartDrilldownChartData>{
  readonly id:string;
  readonly data:D;
}
export interface NativeChartDrilldownLink{
  readonly fromNodeId:string;
  readonly datumId:DatumId;
  readonly toNodeId:string;
}
export interface NativeChartDrilldownData<N extends readonly NativeChartDrilldownNode[]=readonly NativeChartDrilldownNode[]>{
  readonly rootId:N[number]['id'];
  readonly nodes:N;
  readonly links:readonly NativeChartDrilldownLink[];
}
/** Closed lookup avoids distributing the full catalog over an open generic. */
export interface NativeChartDrilldownOptionsByType{
  readonly column:NativeChartOptions<'column'>;
  readonly pie:NativeChartOptions<'pie'>;
  readonly donut:NativeChartOptions<'donut'>;
  readonly treemap:NativeChartOptions<'treemap'>;
  readonly sunburst:NativeChartOptions<'sunburst'>;
  readonly treegraph:NativeChartOptions<'treegraph'>;
  readonly organization:NativeChartOptions<'organization'>;
}
export type NativeChartDrilldownOptions<T extends NativeChartDrilldownData=NativeChartDrilldownData>=Readonly<{
  appearance?:Readonly<{locale?:'en'|'es';theme?:'light'|'dark'|'system'}>;
  animation?:NativeAnimationOptions;
  interaction?:Pick<NativeInteractionOptions,'haptics'|'selectionControls'>;
  nodes?:{readonly [N in T['nodes'][number] as N['id']]?:NativeChartDrilldownOptionsByType[N['data']['type']]};
}>;
export interface NativeChartDrilldownDiagnostic{
  readonly nodeId:string|null;
  readonly diagnostic:NativeChartDiagnostic;
}
export interface NativeChartDrilldownNavigation{
  readonly nodeId:string;
  readonly trail:readonly string[];
}
export interface NativeChartDrilldownInteraction{
  readonly nodeId:string;
  readonly snapshot:InteractionSnapshot;
}
/** These are the only restorable view properties. There is deliberately no
 * selection, active point, tooltip position or pin in a saved node view. */
export interface NativeChartDrilldownView{
  readonly hiddenSeriesIds:readonly string[];
  readonly viewport?:PlanViewportValue;
}
