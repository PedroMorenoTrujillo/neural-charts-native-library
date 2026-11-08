import type {PlanBulletSpec,PlanVariwideSpec,PlanBulletBand} from '@neural-charts/core/plan';

type SourceAxis<T>=T extends unknown?Omit<T,'title'|'grid'|'labels'>&Readonly<{title?:never;grid?:never;labels?:never}>:never;
type SourceAxes<T>={[K in keyof T]:SourceAxis<T[K]>};
type SourcePoint<T>=Omit<T,'color'|'datum'>&Readonly<{color?:never;datum?:never}>;
type SourceSeries<T extends {readonly data:readonly unknown[]}>=Omit<T,'color'|'data'>&Readonly<{color?:never;data:readonly SourcePoint<T['data'][number]>[]}>;
type SourceOnly=Readonly<{family?:never;title?:never;description?:never;color?:never}>;

export interface NativeBulletData extends SourceOnly {
  readonly type:'bullet';
  readonly axes:SourceAxes<PlanBulletSpec['axes']>;
  readonly series:readonly SourceSeries<PlanBulletSpec['series'][number]>[];
  readonly orientation?:never;
  readonly pointPadding?:never;
  readonly bands?:never;
}
export interface NativeVariwideData extends SourceOnly {
  readonly type:'variwide';
  readonly axes:SourceAxes<PlanVariwideSpec['axes']>;
  readonly series:readonly []|readonly [SourceSeries<NonNullable<PlanVariwideSpec['series'][0]>>];
  readonly pointPadding?:never;
}
interface ComparisonLayoutBoundary {
  readonly minRadiusRatio?:never;readonly radiusScale?:never;readonly columns?:never;
  readonly markerRadius?:never;readonly whiskerWidth?:never;readonly capWidth?:never;
  readonly neckWidth?:never;readonly neckHeight?:never;readonly reversed?:never;
}
export interface NativeBulletLayoutOptions extends ComparisonLayoutBoundary {
  readonly orientation?:'horizontal'|'vertical';
  readonly pointPadding?:number;
  readonly bands?:readonly PlanBulletBand[];
  readonly stacking?:never;
  readonly stackLabels?:never;
}
export interface NativeVariwideLayoutOptions extends ComparisonLayoutBoundary {
  readonly pointPadding?:number;
  readonly stacking?:never;
  readonly stackLabels?:never;
}
