import {Component, signal} from '@angular/core';
import {GestureRoot} from '@ng-native/components/gestures';
import {
  NativeDataChart, NativeChartType, type NativeLineData, type NativeChartOptions,
} from '@neural-charts/native';
import {NeuButtonComponent} from '@neural-ui/native';

const visits = {
  type: NativeChartType.Line,
  axes: {
    x: {type: 'category', values: [{id: 'mon', label: 'Mon'}, {id: 'tue', label: 'Tue'}]},
    y: {type: 'linear'},
  },
  series: [{
    id: 'visits',
    name: 'Visits',
    data: [{id: 'mon', x: 'mon', y: 29}, {id: 'tue', x: 'tue', y: 0}],
  }],
} as const satisfies NativeLineData;

@Component({
  imports: [GestureRoot, NativeDataChart, NeuButtonComponent],
  template: `
    <gesture-root>
      <neu-button label="Reset" (pressed)="data.set(initialVisits)" />
      <neu-c-chart [data]="data()" [options]="options" />
    </gesture-root>
  `,
})
export class ChartScreen {
  protected readonly initialVisits = visits;
  readonly data = signal<NativeLineData>(visits);
  readonly options = {
    title: 'Weekly visits',
    axes: {y: {title: 'Visits'}},
    legend: {position: 'bottom'},
    tooltip: {content: 'shared', pinnable: true},
  } as const satisfies NativeChartOptions<NativeChartType.Line>;
}
