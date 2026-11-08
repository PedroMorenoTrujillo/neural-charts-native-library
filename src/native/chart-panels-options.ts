import type {NativeAnimationOptions,NativeChartData,NativeChartDiagnostic,NativeChartOptions,NativeInteractionOptions,NativeViewportChange} from './data-options.js';
import type {InteractionSnapshot} from '../library/contracts.js';

export type NativeChartPanelData=Extract<NativeChartData,{readonly type:'mixed'|'line'|'area'|'spline'|'column'|'pie'|'donut'|'gauge'}>;
export interface NativeChartPanel<D extends NativeChartPanelData=NativeChartPanelData>{
  readonly id:string;
  readonly data:D;
}
export interface NativeChartPanelMember {readonly panelId:string;readonly seriesId:string;}
export interface NativeChartPanelLink {readonly id:string;readonly members:readonly NativeChartPanelMember[];}
export interface NativeChartPanelViewportLink {readonly id:string;readonly axis:'x';readonly panelIds:readonly string[];}
export interface NativeChartPanelsData<P extends readonly NativeChartPanel[]=readonly NativeChartPanel[]>{
  readonly panels:P;
  /** Visibility correspondence only; each chart retains its own axes and units. */
  readonly links?:readonly NativeChartPanelLink[];
  /** Explicit correspondence of original X coordinates; never links Y units. */
  readonly viewportLinks?:readonly NativeChartPanelViewportLink[];
}
export interface NativeChartPanelsLayoutOptions{
  readonly columns?:'auto'|1|2;
  /** Auto mode uses two columns only when both panels have this width. */
  readonly minPanelWidth?:number;
  readonly gap?:number;
}
export interface NativeChartPanelsAppearanceOptions{
  readonly locale?:'en'|'es';
  readonly theme?:'light'|'dark'|'system';
}
/** Resolve each supported family once. Indexing this closed map retains the
 * panel/data correlation without distributing an open generic over the catalog. */
export interface NativeChartPanelOptionsByType{
  readonly mixed:NativeChartOptions<'mixed'>;
  readonly line:NativeChartOptions<'line'>;
  readonly area:NativeChartOptions<'area'>;
  readonly spline:NativeChartOptions<'spline'>;
  readonly column:NativeChartOptions<'column'>;
  readonly pie:NativeChartOptions<'pie'>;
  readonly donut:NativeChartOptions<'donut'>;
  readonly gauge:NativeChartOptions<'gauge'>;
}
export type NativeChartPanelsOptions<T extends NativeChartPanelsData=NativeChartPanelsData>=Readonly<{
  layout?:NativeChartPanelsLayoutOptions;
  appearance?:NativeChartPanelsAppearanceOptions;
  animation?:NativeAnimationOptions;
  interaction?:Pick<NativeInteractionOptions,'haptics'|'selectionControls'>;
  /** Common settings above are defaults. A panel can override them explicitly. */
  panels?:{readonly [P in T['panels'][number] as P['id']]?:NativeChartPanelOptionsByType[P['data']['type']]};
}>;
export type NativeChartPanelsVisibility=Readonly<Record<string,readonly string[]>>;
export interface NativeChartPanelInteraction {readonly panelId:string;readonly snapshot:InteractionSnapshot;}
export interface NativeChartPanelDiagnostic {readonly panelId:string|null;readonly diagnostic:NativeChartDiagnostic;}
export interface NativeChartPanelViewportChange {readonly panelId:string;readonly change:NativeViewportChange;readonly linkId:string|null;readonly revision:number;}
