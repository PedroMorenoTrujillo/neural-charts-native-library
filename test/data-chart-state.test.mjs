import assert from 'node:assert/strict';
import test from 'node:test';
import { ownScene, sceneInteractionKey, sceneMotionSignature } from '../dist/library/scene.js';
import { createDataChartHarness } from './data-chart-harness.mjs';

const numeric = { type: 'linear', domain: [0, 100] };
const measures = {
  type: 'line', axes: { x: numeric, y: numeric },
  series: [
    { id: 'actual', name: 'Actual', data: [{ id: 'a', x: 0, y: 10 }, { id: 'b', x: 50, y: 50 }] },
    { id: 'target', name: 'Target', data: [{ id: 'a', x: 0, y: 20 }, { id: 'b', x: 50, y: 65 }] },
  ],
};
const options = { title: 'Pressure', format: { unit: 'Pa' }, viewport: { axes: 'xy', initial: { y: [5, 90] } } };

function fixture(t, initialData = measures, initialOptions = options) {
  const f = createDataChartHarness(initialData, initialOptions);
  t.after(f.destroy);
  return f;
}

test('NativeDataChart owns viewport feedback, diagnoses rejected bounds and clears selection on suspension', t => {
  const f = fixture(t);
  const { chart } = f;
  assert.deepEqual(chart.viewportState().value, { y: [5, 90] });
  assert.equal(chart.scene().observations.length, 4);
  assert.equal(chart.diagnostic(), null);
  const windows = f.windowEvents;
  assert.equal(chart.setViewport({ x: [10, 65], y: [5, 90] }), true);
  assert.deepEqual(windows, [{ value: { x: [10, 65], y: [5, 90] }, source: 'api' }]);
  assert.equal(chart.setViewport({ x: [10, 65], y: [5, 90] }), true);
  assert.equal(windows.length, 1);
  const applied = chart.viewportState();
  assert.equal(chart.setViewport({ x: [70, 20] }), false);
  assert.equal(chart.viewportState(), applied);
  assert.equal(f.errors.length, 1);
  chart.zoomBy(0);
  assert.equal(f.errors.length, 2);
  assert.equal(windows.length, 1);
  chart.resetViewport();
  assert.deepEqual(chart.viewportState().value, {});
  assert.deepEqual(windows.at(-1), { value: {}, source: 'api' });
  chart.zoomBy(2);
  assert.deepEqual(chart.viewportState().value.x, [25, 75]);
  assert.deepEqual(chart.viewportState().value.y, [25, 75]);

  const active = chart.scene().observations[0];
  chart.forwardInteraction({ active, selected: active.id, scrubbing: false });
  f.setAppStatus('inactive');
  assert.equal(chart.scene(), null);
  assert.equal(chart.viewportState(), undefined);
  assert.deepEqual(f.interactions.at(-1), { active: null, selected: null, scrubbing: false });
  assert.equal(chart.setViewport({}), false);
  chart.forwardInteraction({ active, selected: active.id, scrubbing: false });
  assert.equal(f.interactions.length, 2);
  f.setAppStatus('active');
  assert.equal(chart.scene().observations.length, 2);
  assert.deepEqual(chart.viewportState().value.x, [25, 75]);
  f.destroy();
  assert.equal(f.subscribers.size, 0);
  assert.equal(chart.setViewport({}), false);
});

test('NativeDataChart separates input paint from geometry and owns visible series IDs', t => {
  const f = fixture(t);
  const { chart } = f;
  const original = chart.scene();
  f.apply(undefined, { ...options, title: 'Updated pressure', appearance: {
    series: [{ id: 'target', color: '#226644', name: 'Expected' }],
    markers: { shape: 'diamond', fillColor: '#334455', borderWidth: 2 },
  } });
  const styled = chart.scene();
  assert.equal(styled.title, 'Updated pressure');
  assert.equal(styled.series.find(series => series.id === 'target').color, '#226644');
  assert.equal(sceneInteractionKey(styled), sceneInteractionKey(original));
  assert.equal(sceneMotionSignature(styled), sceneMotionSignature(original));

  // Input normalization must never evaluate an element accessor or retain a
  // visibility switch for a series which no longer belongs to the data.
  const requested = ['target', 'target', 'missing', null, ''];
  Object.defineProperty(requested, '4', { get() { assert.fail('Caller accessor executed'); } });
  chart.hiddenSeriesIds.set(requested);
  f.flush();
  assert.deepEqual(chart.hiddenSeriesIds(), ['target']);
  assert.deepEqual([...new Set(chart.scene().observations.map(point => point.id.seriesId))], ['actual']);
  f.apply({ ...measures, series: [measures.series[0]] });
  assert.deepEqual(chart.hiddenSeriesIds(), []);

  const invalid = { ...options, appearance: { points: [{ seriesId: 'missing', pointId: 'a', color: '#226644' }] } };
  f.apply(undefined, invalid);
  assert.equal(chart.scene(), null);
  assert.equal(chart.diagnostic().path, 'options.appearance.points.0');
  assert.equal(f.errors.at(-1).path, 'options.appearance.points.0');
  f.apply(undefined, options);
  assert.equal(chart.scene().observations.length, 2);
  f.apply(undefined, { ...options, rendering: { active: false } });
  assert.equal(chart.scene(), null);
  f.apply(undefined, options);
  assert.equal(chart.scene().unit, 'Pa');
  assert.equal(chart.noticeColor(), '#526176');
  f.scheme.set('dark');
  assert.equal(chart.noticeColor(), '#B6C4D7');
  f.apply(undefined, { ...options, appearance: { theme: 'light' } });
  assert.equal(chart.noticeColor(), '#526176');
});

test('NativeDataChart uses only the current platform measurements for word layouts', t => {
  const words = { type: 'wordcloud', words: [{ id: 'ready', text: 'Native', weight: 12 }, { id: 'other', text: 'Charts', weight: 4 }] };
  const layout = { minFontSize: 14, maxFontSize: 28, rotations: [0, 90] };
  const f = fixture(t, words, { layout });
  const { chart } = f;
  assert.equal(chart.scene().wordcloud.status, 'measuring');
  const probes = () => chart.wordMetrics().snapshot.probes;
  const first = probes();
  assert.equal(first.length, 2);
  f.apply(undefined, { title: 'Terms', layout: { ...layout, rotations: [...layout.rotations] } });
  assert.deepEqual(probes().map(probe => probe.token), first.map(probe => probe.token));
  for (const { token, request } of first) {
    chart.acceptWordBounds({ token, width: request.fontSize * 3, height: request.fontSize });
  }
  f.flush();
  assert.equal(chart.diagnostic(), null);
  assert.deepEqual(chart.scene().observations.map(point => [point.id.pointId, point.value]), [['ready', 12], ['other', 4]]);
  assert.equal(probes().length, 0);

  f.scale.set(1.6);
  f.flush();
  assert.equal(chart.scene().wordcloud.status, 'measuring');
  const next = probes();
  assert.notEqual(next[0].token, first[0].token);
  chart.acceptWordBounds({ token: first[0].token, width: 0, height: 0 });
  assert.equal(probes()[0].token, next[0].token);
  chart.rejectWordBounds(next[0].token);
  f.flush();
  assert.equal(chart.scene(), null);
  assert.equal(chart.diagnostic().reason, 'TEXT_MEASUREMENT_UNAVAILABLE');
  f.setAppStatus('inactive');
  assert.equal(probes().length, 0);
  f.setAppStatus('active');
  assert.equal(chart.scene().wordcloud.status, 'measuring');
  f.apply({ ...words, words: [{ id: 'bad', text: 'Multiple\nlines', weight: 1 }] });
  assert.equal(chart.scene(), null);
  assert.match(chart.diagnostic().path, /words/);
});

test('NativeDataChart gives localized numeric-range and missing-data notices while retaining the input readings', t => {
  const original = { type: 'gauge', value: -100, domain: [0, 100], unit: 'kg' };
  const f = fixture(t, original);
  const { chart } = f;
  for (const [value, es, en] of [
    [-100, /por debajo/, /below the dial range/],
    [200, /supera el rango/, /exceeds the dial range/],
  ]) {
    const layout = { style: value < 0 ? 'needle' : 'solid' };
    f.apply({ ...original, value }, { layout, appearance: { locale: 'es' } });
    assert.equal(chart.diagnostic(), null);
    assert.match(chart.circularNotice(), es);
    assert.equal(chart.scene().observations.find(point => point.id.seriesId === 'reading').value, value);
    f.apply(undefined, { layout, appearance: { locale: 'en' } });
    assert.match(chart.circularNotice(), en);
  }
  const layout = { startAngle: 0, endAngle: 180 };
  f.apply({
    type: 'pie', data: [{ id: 'a', label: 'Known', value: 12 }, { id: 'unknown', label: 'Unknown', value: null }],
  }, { layout, appearance: { locale: 'en' } });
  assert.match(chart.circularNotice(), /known visible subtotal/);
  for (const locale of ['es', 'en']) {
    f.apply({
      type: 'pie', data: [{ id: 'a', label: 'First', value: 1e308 }, { id: 'b', label: 'Second', value: 1e308 }],
    }, { layout, appearance: { locale } });
    assert.equal(chart.diagnostic(), null);
    assert.equal(chart.scene().radialSummary.overflow, true);
    assert.match(chart.circularNotice(), locale === 'es' ? /rango numérico/ : /numeric range/);
    assert.deepEqual(chart.scene().observations.map(point => point.value), [1e308, 1e308]);
  }
});

test('NativeDataChart explains both unavailable regression fits in both locales', t => {
  const data = {
    ...measures,
    type: 'regression',
    series: [
      { id: 'single', name: 'Single observation', data: [{ id: 'one', x: 2, y: 4 }] },
      { id: 'fixed', name: 'Fixed X', data: [{ id: 'one', x: 10, y: 1 }, { id: 'two', x: 10, y: 5 }] },
    ],
  };
  const f = fixture(t, data, { appearance: { locale: 'es' } });
  const { chart } = f;
  assert.equal(chart.diagnostic(), null);
  assert.match(chart.regressionNotice(), /Single observation: Sin ajuste: se necesitan al menos dos pares XY conocidos/);
  assert.match(chart.regressionNotice(), /Fixed X: Sin ajuste: las X conocidas son iguales/);
  f.apply(undefined, { appearance: { locale: 'en' } });
  assert.match(chart.regressionNotice(), /Single observation: No fit: at least two known XY pairs are required/);
  assert.match(chart.regressionNotice(), /Fixed X: No fit: known X values are equal/);
  assert.deepEqual(chart.scene().observations.filter(point => point.id.seriesId === 'fixed').map(point => point.value), [1, 5]);
});

test('NativeDataChart acknowledges expired gesture models without committing over the new viewport', t => {
  const f = fixture(t);
  const { chart } = f;
  const initial = chart.viewportContext();
  chart.requestViewport({ model: initial.model, intent: { type: 'zoom', factor: 2 }, source: 'gesture' });
  const current = chart.viewportContext();
  assert.equal(current.acknowledgment, initial.acknowledgment + 1);
  assert.equal(current.revision, initial.revision + 1);
  assert.deepEqual(current.model.value.x, [25, 75]);
  chart.requestViewport({ model: initial.model, intent: { type: 'reset' }, source: 'gesture' });
  const acknowledged = chart.viewportContext();
  assert.equal(acknowledged.acknowledgment, current.acknowledgment + 1);
  assert.equal(acknowledged.revision, current.revision);
  assert.equal(acknowledged.model, current.model);
  assert.equal(f.windowEvents.length, 1);
  f.apply(undefined, { ...options, viewport: undefined });
  assert.equal(chart.viewportContext(), undefined);
  assert.equal(chart.setViewport({}), false);
  f.setAppStatus('inactive');
  chart.zoomBy(2);
  assert.equal(f.windowEvents.length, 1);
});

test('Native circular charts validate their projected frame without redefining the original reading', t => {
  const data = { type: 'gauge', value: 75, domain: [0, 50] };
  const f = fixture(t, data, { layout: { style: 'needle', tickCount: 4 } });
  const scene = f.chart.scene();
  assert.equal(f.chart.diagnostic(), null);
  const { circular } = scene;
  assert.equal(circular.style, 'needle-gauge');
  assert.equal(circular.valueState, 'over');
  assert.equal(scene.observations[0].value, 75);
  const rejects = (changes, error) => assert.throws(() => ownScene({ ...scene, circular: { ...circular, ...changes } }), error);
  rejects({ startAngle: 800 }, /Invalid circular sweep/);
  rejects({ innerRadius: circular.radius }, /Invalid circular frame/);
  rejects({ bounds: { ...circular.bounds, width: -1 } }, /Invalid circular fit extent/);
  rejects({ domain: [50, 0] }, /Invalid scalar dial/);
  rejects({ valueState: 'within' }, /Scalar value lost its original domain state/);
  rejects({ style: 'solid-gauge' }, /Needle roles require a needle dial/);
  rejects({ needle: { ...circular.needle, to: null } }, /Invalid needle state/);
  rejects({ ticks: [{ ...circular.ticks[0], value: 51 }] }, /Invalid dial tick/);
  const pie = { type: 'pie', data: [{ id: 'north', label: 'North', value: 4 }, { id: 'south', label: 'South', value: 0 }] };
  f.apply(pie, { layout: { startAngle: 0, endAngle: 180 } });
  const radial = f.chart.scene();
  assert.equal(f.chart.diagnostic(), null);
  assert.equal(radial.radialSummary.knownTotal, 4);
  assert.throws(() => ownScene({ ...radial, circular: { ...radial.circular, domain: [0, 10] } }), /Foreign scalar dial roles/);
  assert.throws(() => ownScene({
    ...radial, radialSummary: { ...radial.radialSummary, missingCount: 1 },
  }), /Invalid radial denominator summary/);
});
