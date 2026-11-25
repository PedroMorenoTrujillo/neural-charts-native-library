import { registerHooks } from 'node:module';
import '@angular/compiler';
import * as angular from '@angular/core';
import { Accessibility, ColorScheme } from '@ng-native/device';
import { CHART_ACTIVITY_ENVIRONMENT } from '../dist/native/activity.js';

// Exercise the real adapter's Angular input, output and effect graph in Node.
// The child renderer is exercised by the installed Native lab.
const adapter = new URL('../dist/native/data-chart.js', import.meta.url);
const stub = 'data:text/javascript,' + encodeURIComponent('export class NativeChart {}');
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === './chart.js' && context.parentURL === adapter.href) return { url: stub, shortCircuit: true };
    return next(specifier, context);
  },
});
let NativeDataChart;
try {
  ({ NativeDataChart } = await import(adapter.href));
} finally {
  hooks.deregister();
}

function setInput(signal, value) {
  const node = signal[angular.ɵSIGNAL];
  node.applyValueToInputSignal(node, value);
}

export function createDataChartHarness(data, options) {
  const subscribers = new Set();
  const scale = angular.signal(1);
  const scheme = angular.signal('light');
  const injector = angular.createEnvironmentInjector([
    { provide: angular.ɵINJECTOR_SCOPE, useValue: 'root' },
    angular.provideZonelessChangeDetection(),
    { provide: CHART_ACTIVITY_ENVIRONMENT, useValue: {
      current: () => 'active',
      subscribe(listener) { subscribers.add(listener); return () => subscribers.delete(listener); },
    } },
    { provide: ColorScheme, useValue: { current: scheme } },
    { provide: Accessibility, useValue: { fontScale: scale, reduceMotion: () => false } },
  ], angular.Injector.NULL);
  let destroyed = false;
  const destroy = () => {
    if (destroyed) return;
    injector.destroy();
    destroyed = true;
  };
  try {
    const chart = angular.runInInjectionContext(injector, () => new NativeDataChart());
    const flush = () => injector.get(angular.ɵEffectScheduler).flush();
    const apply = (data, options) => {
      if (data !== undefined) setInput(chart.data, data);
      if (options !== undefined) setInput(chart.options, options);
      flush();
    };
    const setAppStatus = state => {
      for (const listener of subscribers) listener(state);
      flush();
    };
    const windowEvents = [], errors = [], interactions = [];
    chart.viewportChange.subscribe(value => windowEvents.push(value));
    chart.planningError.subscribe(value => errors.push(value));
    chart.interactionChange.subscribe(value => interactions.push(value));
    apply(data, options);
    return { chart, apply, setAppStatus, flush, scale, scheme, subscribers, windowEvents, errors, interactions, destroy };
  } catch (error) {
    destroy();
    throw error;
  }
}
