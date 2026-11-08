import {Directive, TemplateRef, inject} from '@angular/core';
import type {NativeLegendItem, Observation, SharedSelection} from '../library/contracts.js';

export interface NativeChartAxisLabelContext {
  readonly axis: 'x' | 'y' | 'secondaryY';
  readonly text: string;
  readonly value?: string | number;
  readonly type?: 'number' | 'time' | 'category';
}

export interface NativeChartDataLabelContext {
  readonly point: Observation;
  readonly value: number;
  readonly text: string;
}

export type NativeChartLegendLabelContext = NativeLegendItem & Readonly<{text: string}>;

/** Return undefined to keep the default text. */
export interface NativeChartLabelFormatters {
  readonly dataLabel?: (context: NativeChartDataLabelContext) => string | undefined;
  readonly legendLabel?: (context: NativeChartLegendLabelContext) => string | undefined;
  readonly xAxisLabel?: (context: NativeChartAxisLabelContext) => string | undefined;
  readonly yAxisLabel?: (context: NativeChartAxisLabelContext) => string | undefined;
}

export interface NativeChartTooltipContext {
  readonly $implicit: Observation;
  readonly shared: SharedSelection | undefined;
  readonly pinned: boolean;
  readonly scrubbing: boolean;
  readonly unit: string;
  readonly locale: 'es' | 'en';
}

/** A native template for the chart's docked tooltip content. */
@Directive({selector: 'ng-template[neuChartTooltip]'})
export class NativeChartTooltipTemplate {
  readonly template = inject(TemplateRef<NativeChartTooltipContext>);

  static ngTemplateContextGuard(
    _directive: NativeChartTooltipTemplate,
    _context: unknown,
  ): _context is NativeChartTooltipContext {
    return true;
  }
}
