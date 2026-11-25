import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';
import '@angular/compiler';
import * as angular from '@angular/core';
import { ColorScheme } from '@ng-native/device';
import { createDataChartHarness } from './data-chart-harness.mjs';
import { ownChartPanels } from '../dist/native/chart-panels-state.js';
import { ownDrilldownGraph } from '../dist/native/drilldown-state.js';

const { NativeChartDrilldown } = await import('../dist/native/chart-drilldown.js');
const { NativeChartPanels } = await import('../dist/native/chart-panels.js');
const { NativeTooltip } = await import('../dist/native/tooltip.js');
const { NativeLegend } = await import('../dist/native/legend.js');

// Use the real components and their Angular effect graph. Native view queries
// and platform gestures are supplied at their respective boundaries.
const navigatorUrl = new URL('../dist/native/chart-navigator.js', import.meta.url);
const navigatorModules = {
  '@ng-native/components/gestures': 'export class NativeGesture {}',
  'react-native-gesture-handler': `
    export const Gesture = { Pan() {
      const state = { handlers: {} };
      for (const name of ['activeOffsetX', 'failOffsetY', 'maxPointers', 'runOnJS']) state[name] = () => state;
      for (const event of ['onStart', 'onUpdate', 'onEnd', 'onFinalize']) {
        state[event] = callback => { state.handlers[event] = callback; return state; };
      }
      return state;
    } };
  `,
};
const navigatorHooks = registerHooks({
  resolve(specifier, context, next) {
    const source = context.parentURL === navigatorUrl.href && navigatorModules[specifier];
    return source ? { url: 'data:text/javascript,' + encodeURIComponent(source), shortCircuit: true } : next(specifier, context);
  },
});
let NativeChartNavigator;
try {
  ({ NativeChartNavigator } = await import(navigatorUrl.href));
} finally {
  navigatorHooks.deregister();
}

function component(t, Type, inputs, prepare = () => {}) {
  const scheme = angular.signal('light');
  const injector = angular.createEnvironmentInjector([
    { provide: angular.ɵINJECTOR_SCOPE, useValue: 'root' },
    angular.provideZonelessChangeDetection(),
    { provide: ColorScheme, useValue: { current: scheme } },
  ], angular.Injector.NULL);
  t.after(() => injector.destroy());
  const chart = angular.runInInjectionContext(injector, () => new Type());
  prepare(chart);
  const flush = () => injector.get(angular.ɵEffectScheduler).flush();
  const set = values => {
    for (const [name, value] of Object.entries(values)) {
      const node = chart[name][angular.ɵSIGNAL];
      node.applyValueToInputSignal(node, value);
    }
    flush();
  };
  const record = (...names) => Object.fromEntries(names.map(name => {
    const events = [];
    chart[name].subscribe(value => events.push(value));
    return [name, events];
  }));
  set(inputs);
  return { chart, set, flush, record, scheme };
}

const line = {
  type: 'line',
  axes: { x: { type: 'linear', domain: [0, 100], nice: false }, y: { type: 'linear', domain: [0, 100], nice: false } },
  series: [{ id: 'actual', name: 'Actual', data: [
    { id: 'a', x: 0, y: 0 }, { id: 'b', x: 25, y: 40 }, { id: 'c', x: 50, y: 70 }, { id: 'd', x: 100, y: 90 },
  ] }, { id: 'other', name: 'Other', data: [{ id: 'a', x: 0, y: 10 }, { id: 'b', x: 100, y: 80 }] }],
};
const pie = { type: 'pie', data: [{ id: 'total', label: 'Total', value: 42 }] };
const viewport = { axes: 'xy', initial: { x: [10, 90], y: [5, 95] } };
const selected = { active: null, selected: { seriesId: 'actual', pointId: 'a' }, scrubbing: false };
const invalid = { code: 'INVALID_CONFIG', reason: 'INVALID_CHART_OPTION', path: 'options', message: 'Recorded child diagnostic' };
const layout = width => ({ nativeEvent: { layout: { width } } });

test('Native drilldown restores the original parent viewport and visibility and drops late child events', t => {
  const categories = [{ id: 'north', label: 'North' }, { id: 'south', label: 'South' }];
  const column = {
    type: 'column',
    axes: { x: { type: 'category', values: categories }, y: line.axes.y },
    series: line.series.map(series => ({
      ...series, data: series.data.slice(0, 2).map((point, index) => ({ ...point, x: categories[index].id })),
    })),
  };
  const initial = { x: { firstId: 'north', lastId: 'south' }, y: viewport.initial.y };
  const data = {
    rootId: 'overview',
    nodes: [{ id: 'overview', data: column }, { id: 'detail', data: pie }],
    links: [{ fromNodeId: 'overview', datumId: selected.selected, toNodeId: 'detail' }],
  };
  const options = { nodes: { overview: { title: 'Overview', viewport: { axes: 'xy', initial } }, detail: { title: 'Detail' } } };
  const f = component(t, NativeChartDrilldown, { data, options });
  const { chart } = f;
  const events = f.record('navigationChange', 'planningError', 'interactionChange');
  assert.equal(chart.diagnostic(), null, JSON.stringify(chart.diagnostic()));
  assert.equal(chart.trailLabel(), 'Overview');
  assert.equal(chart.nodeId(), 'overview');
  assert.equal(chart.english(), false);
  assert.equal(chart.ink(), '#182331');
  f.scheme.set('dark');
  assert.equal(chart.ink(), '#E7EEF9');
  assert.equal(chart.controlColor(), '#202E42');
  chart.back();
  chart.enter();
  assert.deepEqual(events.navigationChange, []);
  const root = chart.render()[0].token;
  const value = { x: { firstId: 'north', lastId: 'north' }, y: [15, 90] };
  chart.changeViewport(root, { value, source: 'api' });
  chart.changeVisibility(root, ['other']);
  assert.deepEqual(chart.visibility(), ['other']);
  assert.deepEqual(chart.render()[0].options.viewport.initial, initial);
  chart.interact(root, { ...selected, selected: null });
  assert.equal(chart.destination(), undefined);
  chart.interact(root, selected);
  assert.equal(chart.destination(), 'detail');
  chart.enter();
  assert.deepEqual(chart.trail(), ['overview', 'detail']);
  assert.equal(chart.nodeId(), 'detail');
  assert.equal(chart.trailLabel(), 'Overview / Detail');
  assert.deepEqual(chart.visibility(), []);
  chart.childError(root, invalid);
  chart.changeVisibility(root, ['actual']);
  chart.changeViewport(root, { value: {}, source: 'api' });
  chart.interact(root, selected);
  const detail = chart.render()[0].token;
  chart.childError(detail, invalid);
  assert.deepEqual(events.planningError, [{ nodeId: 'detail', diagnostic: invalid }]);
  assert.equal(events.interactionChange.length, 2);
  chart.back();
  assert.deepEqual(chart.render()[0].options.viewport.initial, value);
  assert.deepEqual(chart.visibility(), ['other']);
  assert.deepEqual(events.navigationChange, [
    { nodeId: 'detail', trail: ['overview', 'detail'] }, { nodeId: 'overview', trail: ['overview'] },
  ]);
  f.set({ options: { ...options, appearance: { locale: 'en', theme: 'light' } } });
  assert(chart.english());
  assert.equal(chart.controlColor(), '#EDF2F8');
  assert.deepEqual(chart.render()[0].options.viewport.initial, value);
  f.set({ data: { ...data, rootId: 'absent' } });
  assert.match(chart.diagnostic().diagnostic.path, /rootId/);
  assert.equal(chart.nodeId(), null);
  assert.deepEqual(chart.render(), []);
  assert.equal(chart.trailLabel(), '');
  assert.deepEqual(chart.trail(), []);
  assert.deepEqual(chart.visibility(), []);
  assert.equal(events.planningError.length, 2);
  chart.back();
});

test('Native panels apply one linked X update to a ready child while retaining its Y window', t => {
  const data = {
    panels: [{ id: 'north', data: line }, { id: 'south', data: line }],
    links: [{ id: 'observed', members: [{ panelId: 'north', seriesId: 'actual' }, { panelId: 'south', seriesId: 'actual' }] }],
    viewportLinks: [{ id: 'calendar', axis: 'x', panelIds: ['north', 'south'] }],
  };
  const options = { panels: { north: { viewport }, south: { viewport: { ...viewport, initial: { x: [10, 90], y: [20, 80] } } } } };
  const children = angular.signal([]);
  const f = component(t, NativeChartPanels, { data, options }, chart => { chart.charts = children; });
  const { chart } = f;
  assert.equal(chart.diagnostic(), null);
  const events = f.record('viewportChange', 'planningError', 'interactionChange');
  assert.deepEqual(chart.layout(), { columns: 1, gap: 16, panelWidth: 0 });
  chart.measure(layout(616));
  assert.deepEqual(chart.layout(), { columns: 2, gap: 16, panelWidth: 300 });
  chart.measure(layout(NaN));
  assert.equal(chart.layout().panelWidth, 300);
  chart.measure(layout(600));
  assert.deepEqual(chart.layout(), { columns: 1, gap: 16, panelWidth: 600 });

  const views = chart.panels().map(panel => {
    const fixture = createDataChartHarness(panel.data, panel.options);
    t.after(fixture.destroy);
    fixture.chart.viewportChange.subscribe(event => chart.forwardViewport(panel.id, panel.epoch, event));
    return fixture;
  });
  const value = { x: [22, 88], y: [15, 60] };
  assert(views[0].chart.setViewport(value));
  f.flush();
  assert.deepEqual(views[1].chart.viewportState().value, { x: [10, 90], y: [20, 80] });
  children.set(views.map(view => view.chart));
  f.flush();
  assert.deepEqual(views[1].chart.viewportState().value, { x: [22, 88], y: [20, 80] });
  assert.deepEqual(views[1].windowEvents, [{ value: { x: [22, 88], y: [20, 80] }, source: 'api' }]);
  assert.equal(events.viewportChange.length, 1);
  assert.equal(events.viewportChange[0].linkId, 'calendar');
  assert.equal(events.viewportChange[0].panelId, 'north');
  chart.forwardViewport('north', {}, { value: {}, source: 'api' });
  assert.equal(events.viewportChange.length, 1);
  chart.forwardInteraction('south', selected);
  chart.forwardError('south', invalid);
  assert.deepEqual(events.interactionChange, [{ panelId: 'south', snapshot: selected }]);
  assert.deepEqual(events.planningError, [{ panelId: 'south', diagnostic: invalid }]);
  chart.changeVisibility('north', ['actual']);
  assert.deepEqual(chart.visibility(), { north: ['actual'], south: ['actual'] });
  chart.changeVisibility('missing', ['other']);
  assert.deepEqual(chart.visibility(), { north: ['actual'], south: ['actual'] });
  f.set({ data: { ...data, panels: [] } });
  assert.deepEqual(chart.visibility(), {});
  assert.deepEqual(chart.panels(), []);
  assert(chart.diagnostic());
  assert.equal(events.planningError.length, 2);
  chart.changeVisibility('north', []);
});

test('Native navigator previews a drag then commits once, retains Y and cancels a stale drag', t => {
  const model = createDataChartHarness(line, { viewport, appearance: { locale: 'en', theme: 'system' } });
  t.after(model.destroy);
  const f = component(t, NativeChartNavigator, { chart: model.chart, seriesId: undefined });
  const { chart } = f;
  assert.equal(chart.positions(), undefined);
  assert.match(chart.svg(), /<path/);
  assert.equal(chart.labels().title, 'Visible range');
  assert.equal(chart.ink(), '#14243B');
  f.scheme.set('dark');
  assert.equal(chart.accent(), '#9AD0FF');
  chart.measure(layout(100));
  chart.measure(layout(100));
  chart.measure(layout(-1));
  assert.deepEqual(chart.positions(), { start: 10, end: 90, startHandle: 8, endHandle: 88 });
  assert.deepEqual(chart.controls().map(control => control.value), ['10', '90']);
  chart.begin(90);
  chart.move(75);
  assert.equal(chart.positions().end, 75);
  assert.deepEqual(model.windowEvents, []);
  chart.end(70, false);
  assert.equal(chart.positions().end, 90);
  assert.deepEqual(model.windowEvents, []);
  chart.begin(10);
  chart.end(35, true);
  assert.deepEqual(model.windowEvents, [{ value: { x: [35, 90], y: [5, 95] }, source: 'api' }]);
  chart.begin(90);
  assert(model.chart.setViewport({ x: [22, 77], y: [8, 85] }));
  chart.end(60, true);
  assert.equal(model.windowEvents.length, 2);
  chart.step(1, -1);
  assert.deepEqual(model.chart.viewportState().value, { x: [22, 72], y: [8, 85] });
  assert(chart.canReset());
  chart.reset();
  chart.reset();
  assert.deepEqual(model.chart.viewportState().value, { y: [8, 85] });
  assert.equal(model.windowEvents.length, 4);
  assert.equal(chart.canReset(), false);
  f.set({ seriesId: 'missing' });
  assert.equal(chart.svg(), '');
  f.set({ seriesId: 'other' });
  assert.match(chart.svg(), /<path/);
  model.chart.hiddenSeriesIds.set(['other']);
  model.flush();
  assert.equal(chart.svg(), '');
  model.apply(pie, {});
  assert.equal(chart.range(), undefined);
  assert.deepEqual(chart.controls(), []);
  assert.equal(chart.labels().title, 'Rango visible');
  chart.begin(0);
  chart.step(0, 1);
  chart.reset();
});

test('Native tooltip confirms the last layout after content changes and cancels superseded animation frames', t => {
  const frames = new Map();
  let next = 1;
  const runFrame = () => {
    const previous = [...frames];
    for (const [id] of previous) frames.delete(id);
    for (const [, callback] of previous) callback();
  };
  const originals = new Map(['requestAnimationFrame', 'cancelAnimationFrame'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.assign(globalThis, {
    requestAnimationFrame(callback) { const id = next++; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
  });
  try {
    const point = { label: 'Observations', color: '#113366', value: 22, medianValue: 21.5, percentage: 12.5, xValue: 10, sizeValue: 30 };
    const f = component(t, NativeTooltip, { point, family: 'boxplot', unit: 'kg' });
    const { chart } = f;
    const { measured } = f.record('measured');
    assert.equal(chart.formatted(), 'Mediana: 21,5');
    assert.equal(chart.percentage(), '12,5');
    assert.equal(chart.percentageValue(12.5), '12,5');
    assert.equal(chart.size(), '30');
    assert.equal(chart.xValue(), '10');
    assert.equal(chart.number(4.5), '4,5');
    assert.equal(chart.pointUnit(point), 'kg');
    runFrame();
    runFrame();
    assert.deepEqual(measured, []);
    const bounds = { width: 210, height: 90 };
    chart.measure({ nativeEvent: { layout: bounds } });
    assert.deepEqual(measured, [bounds]);
    f.set({ locale: 'en', point: { ...point, medianValue: undefined } });
    assert.equal(chart.formatted(), 'Median: 22');
    runFrame();
    assert.equal(frames.size, 1);
    f.set({ locale: 'es' });
    assert.equal(frames.size, 1);
    runFrame();
    assert.deepEqual(measured, [bounds]);
    runFrame();
    assert.deepEqual(measured, [bounds, bounds]);
    const comparison = { label: 'Value', value: 20, targetValue: 25, color: '#112233' };
    f.set({ point: comparison, family: 'bullet', detailRows: ['Supplied detail'], allowScroll: true });
    assert.equal(chart.pointValue(comparison), '20');
    assert.deepEqual(chart.details(), ['Supplied detail']);
    assert.equal(chart.percentage(), '0');
    assert.equal(chart.size(), '0');
    assert.equal(chart.xValue(), '0');
    assert.equal(frames.size, 0);
    assert(chart.rowDetails(comparison).every(line => typeof line === 'string'));
    f.set({ compactHeight: 66, allowScroll: false, detailRows: undefined });
    assert(Array.isArray(chart.details()));
    assert.equal(frames.size, 0);
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});

test('Native legend reserves scroll hints for content beyond the measured bounded viewport', t => {
  const items = [
    { id: 'actual', name: 'Current observation', color: '#112233', visible: true },
    { id: 'other', name: 'Expected observation', color: '#445566', visible: false },
  ];
  const f = component(t, NativeLegend, { items, interactive: true, vertical: true, maximumHeight: 40 });
  const { chart } = f;
  const measure = height => chart.measure({ nativeEvent: { layout: { height } } });
  assert.equal(chart.boundedMaximum(), 80);
  assert.equal(chart.overflow(), false);
  measure(81);
  assert.equal(chart.overflow(), false);
  measure(82);
  measure(NaN);
  measure(-1);
  assert.equal(chart.overflow(), true);
  f.set({ maximumHeight: Infinity });
  assert.equal(chart.boundedMaximum(), 144);
  assert.equal(chart.overflow(), false);
  f.set({ maximumHeight: 1000 });
  assert.equal(chart.boundedMaximum(), 600);
  measure(602);
  assert.equal(chart.overflow(), true);
  measure(0);
  assert.equal(chart.overflow(), false);
  assert.deepEqual(chart.items(), items);
});

test('Native panel and drilldown envelope diagnostics retain the owner of invalid child input', () => {
  const panel = { id: 'north', data: line };
  const panels = { panels: [panel] };
  const fail = () => assert.fail('Caller accessor executed');
  for (const [data, options, panelId, reason] of [
    [new Date(), {}, null, 'INVALID_PANEL_CONFIG'],
    [panels, { animation: { durationMs: 'slow' } }, null, 'INVALID_CHART_OPTION'],
    [panels, { panels: { north: { appearance: { locale: 'fr' } } } }, 'north', 'INVALID_CHART_OPTION'],
    [{ panels: Array(1) }, {}, null, 'INVALID_PANEL_CONFIG'],
    [{ panels: Object.assign([panel], { [Symbol('input')]: true }) }, {}, null, 'INVALID_PANEL_CONFIG'],
    [{ panels: Object.defineProperty([panel], 0, { get: fail }) }, {}, null, 'INVALID_PANEL_CONFIG'],
    [{ panels: [undefined] }, {}, null, 'INVALID_PANEL_CONFIG'],
    [{ panels: [{ ...panel, data: { ...line, series: [...line.series, line.series[0]] } }] }, {}, 'north', 'INVALID_PANEL_CONFIG'],
  ]) {
    const result = ownChartPanels(data, options);
    assert.equal(result.status, 'invalid', JSON.stringify(result));
    assert.equal(result.error.panelId, panelId, JSON.stringify(result));
    assert.equal(result.error.diagnostic.reason, reason, JSON.stringify(result));
  }
  const column = {
    type: 'column',
    axes: { x: { type: 'category', values: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] }, y: line.axes.y },
    series: [{ id: 'actual', name: 'Actual', data: [{ id: 'a', x: 'a', y: 1 }, { id: 'b', x: 'b', y: 2 }] }],
  };
  const drilldown = { rootId: 'overview', nodes: [{ id: 'overview', data: column }], links: [] };
  assert.equal(ownDrilldownGraph(drilldown).status, 'ok');
  for (const [initial, expected] of [
    [{ y: [2, 2] }, /finite increasing numeric bounds/],
    [{ y: [10, 2] }, /finite increasing numeric bounds/],
    [{ y: [2, Infinity] }, /finite increasing numeric bounds/],
    [{ y: [1, 3, 4] }, /increasing numeric bounds/],
    [{ y: Array(2) }, /finite increasing numeric bounds/],
    [{ y: Object.defineProperty([1, 3], 0, { get: fail }) }, /finite increasing numeric bounds/],
    [{ y: Object.assign([1, 3], { unit: 'kg' }) }, /Custom array/],
    [{ y: { firstId: 'a', lastId: 'b' } }, /requires a numeric window/],
    [{ x: { firstId: '', lastId: 'b' } }, /firstId and lastId category identities/],
  ]) {
    const result = ownDrilldownGraph(drilldown, { nodes: { overview: { viewport: { initial } } } });
    assert.equal(result.status, 'invalid', JSON.stringify(result));
    assert.equal(result.error.nodeId, 'overview');
    assert.match(result.error.diagnostic.message, expected);
  }
});
