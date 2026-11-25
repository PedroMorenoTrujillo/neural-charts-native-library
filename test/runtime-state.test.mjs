import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const candidate = process.env.NEURAL_CHARTS_NATIVE_CANDIDATE ?? process.cwd();
const load = name => import(pathToFileURL(resolve(candidate, 'dist/native', name + '.js')).href);
const { inputLease, pointLease } = await load('input-lease');
const { prepareNativeWordCloud, measuringWordCloud } = await load('wordcloud-planning');
const { WordCloudMeasurements } = await load('wordcloud-measurements');
const { ownChartPanels, panelVisibility } = await load('chart-panels-state');
const { panelActivations, PanelViewportSync } = await load('panel-viewport-sync');
const { tooltipOccupancy, tooltipOverlap } = await load('tooltip-occupancy');
const { tooltipLayout } = await load('tooltip-layout');
const { barCategoryLabels } = await load('bar-labels');
const { nativeTimeAxisLabels } = await load('time-axis-labels');
const { nativeReferenceLabels } = await load('reference-labels');
const { variwideAxisLabels } = await load('variwide-labels');

test('Native tooltip layout anchors near observations and docks when the viewport has no room', () => {
  const view = { width: 400, height: 240 };
  assert.deepEqual(tooltipLayout(view, { x: 200, y: 140 }, 60),
    { width: 220, x: 90, y: 62, bottom: 118, docked: false });
  assert.deepEqual(tooltipLayout(view, { x: 12, y: 20 }, 60),
    { width: 220, x: 8, y: 38, bottom: undefined, docked: false });
  assert.deepEqual(tooltipLayout({ width: 120, height: 80 }, { x: 60, y: 40 }, 70),
    { width: 104, x: 8, y: 8, bottom: undefined, docked: true });
});

test('Native bar labels preserve projected ticks and bound the number of fallback labels', () => {
  const observation = (pointId, y, label) => ({ id: { pointId }, y, label });
  const bars = [observation('alpha', 15, 'Álpha'), observation('beta', 40, 'Beta')];
  const yLabels = [{ id: 'beta', y: 41, label: 'Beta proyectado' }];
  assert.equal(barCategoryLabels({ yLabels, observations: bars }), yLabels);
  assert.deepEqual(barCategoryLabels({ observations: [...bars, observation('alpha', 16, 'Serie secundaria')] }),
    [{ id: 'alpha', y: 15, label: 'Álpha' }, { id: 'beta', y: 40, label: 'Beta' }]);
  const dense = Array.from({ length: 65 }, (_, index) => observation(String(index), index, 'Barra ' + index));
  assert.equal(barCategoryLabels({ observations: dense.slice(0, 64) }).length, 64);
  assert.deepEqual(barCategoryLabels({ observations: dense }), []);
  assert.equal(dense.length, 65);
});

test('Native time labels compact UTC ticks without shifting points or rewriting the source labels', () => {
  const fixtures = [
    [['2024-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'], ['2024', '2026']],
    [['2024-02-01T00:00:00.000Z', '2025-03-01T00:00:00.000Z'], ['2024-02', '2025-03']],
    [['2024-01-02T00:00:00.000Z', '2024-01-03T00:00:00.000Z'], ['2024-01-02', '2024-01-03']],
    [['2024-01-01T01:00:00.000Z', '2024-01-01T02:00:00.000Z'], ['01:00:00', '02:00:00']],
    [['2024-01-01T01:00:00.125Z', '2024-01-01T01:00:01.250Z'], ['01:00:00.125', '01:00:01.250']],
  ];
  for (const [instants, expected] of fixtures) {
    const labels = instants.map((label, index) => ({ label, x: 140 - index * 120 }));
    const displayed = nativeTimeAxisLabels(labels, undefined, true);
    assert.deepEqual(displayed, expected.map((label, index) => ({ label, x: labels[index].x })));
    assert.deepEqual(labels.map(item => item.label), instants);
    assert.equal(nativeTimeAxisLabels(labels, undefined, false), labels);
  }
  const unparsed = [{ x: 20, label: 'Enero' }];
  assert.equal(nativeTimeAxisLabels(unparsed, undefined, true), unparsed);
  const crowded = Array.from({ length: 5 }, (_, index) => ({ x: index * 8, label: '2024-01-01T00:00:0' + index + 'Z' }));
  assert.deepEqual(nativeTimeAxisLabels(crowded, undefined, true), [{ x: 0, label: '00:00:00' }]);
});

test('Native reference labels clip to the scroll window and keep source labels for hidden paint', () => {
  const view = { width: 420, height: 240 };
  const line = (id, x, label, status = 'visible') =>
    ({ id, status, label, line: { x1: x, x2: x, y1: 10, y2: 220 } });
  const band = (id, x, width, label, status = 'visible') =>
    ({ id, status, label, box: { x, y: 110, width, height: 60 } });
  const scene = {
    ...view,
    family: 'column',
    references: [
      line('hidden', 120, 'Hidden', 'outside'),
      line('offscreen', 30, 'Offscreen'),
      line('limit', 130, 'Límite'),
      line('overlap', 131, 'Overlap'),
      { id: 'average', status: 'visible', label: 'Media', color: '#123456', line: { x1: 110, x2: 350, y1: 82, y2: 82 } },
    ],
    referenceBands: [band('narrow', 105, 12, 'Demasiado estrecha'), band('scale', 180, 90, '水'), band('missing', 270, 100)],
  };
  const labels = nativeReferenceLabels(scene, view, 1.5, { x: 100, width: 230 }, '#FFFFFF', '#101010');
  assert.deepEqual(labels.map(item => item.text), ['Límite', 'Media', '水']);
  assert.equal(labels[1].color, '#123456');
  assert.deepEqual([labels[2].color, labels[2].backgroundColor], ['#FFFFFF', '#101010']);
  assert.ok(labels.every(item => item.x >= 108 && item.x + item.width <= 322 && item.y >= 8 && item.y + item.height <= 232));
  assert.deepEqual(nativeReferenceLabels(scene, view, 1, { x: 100, width: 28 }), []);
  assert.equal(scene.references[1].label, 'Offscreen');
  assert.equal(scene.referenceBands[0].label, 'Demasiado estrecha');
});

test('Native variwide labels share weighted centers and retain hidden names in the source', () => {
  const scene = {
    family: 'variwide',
    categoryBands: [
      { categoryId: 'absent', left: null, right: null, status: 'outside' },
      { categoryId: 'narrow', left: 0, right: 8, status: 'visible' },
      { categoryId: 'wide', left: 8, right: 60, status: 'visible' },
      { categoryId: 'offscreen', left: 60, right: 100, status: 'outside' },
    ],
    labels: [{ x: 4, label: 'Narrow' }, { x: 34, label: 'Wide' }, { x: 80, label: 'Offscreen' }],
  };
  const transform = { x: 5, sx: 2 };
  assert.deepEqual(variwideAxisLabels(scene, transform), [{ id: 'wide', label: 'Wide', left: 33, width: 80 }]);
  assert.deepEqual(variwideAxisLabels(scene, transform, true), [
    { id: 'narrow', label: 'Narrow', left: 1, width: 24 },
    { id: 'wide', label: 'Wide', left: 33, width: 80 },
  ]);
  assert.deepEqual(variwideAxisLabels({ ...scene, family: 'column' }, transform), []);
  assert.equal(scene.labels[0].label, 'Narrow');
});

const ranges = { first: { x: [0, 75], y: [0, 20] }, second: { x: [0, 75], y: [10, 80] } };
const panelData = {
  type: 'line',
  axes: { x: { type: 'linear', domain: [0, 100] }, y: { type: 'linear' } },
  series: [{ id: 'usage', name: 'Usage', data: [{ id: 'a', x: 25, y: 5 }, { id: 'b', x: 60, y: 10 }] }],
};
const panels = {
  panels: [{ id: 'first', data: panelData }, { id: 'second', data: panelData }],
  viewportLinks: [{ id: 'shared', axis: 'x', panelIds: ['first', 'second'] }],
};
const options = {
  panels: Object.fromEntries(Object.entries(ranges).map(([id, initial]) => [id, { viewport: { axes: 'xy', initial } }])),
};
function own(data, config = options) {
  const result = ownChartPanels(data, config);
  assert.equal(result.status, 'ok', JSON.stringify(result.error));
  return result.value;
}

test('panel synchronization queues only the linked X window and absorbs a synchronous API echo', () => {
  const owned = own(panels);
  const active = panelActivations(owned);
  const [first, second] = active.map(item => item.epoch);
  const sync = new PanelViewportSync();
  const visibility = panelVisibility(owned, {});
  sync.reconcile(owned, active, visibility);
  assert.equal(sync.flush('second', second, { setViewport: () => assert.fail('Initial viewport is already applied') }), null);
  assert.equal(sync.accept('second', second, { value: { x: [0, 75], y: [30, 80] }, source: 'gesture' }).linkId, 'shared');
  const accepted = sync.accept('first', first, { value: { x: [20, 55], y: [5, 15] }, source: 'gesture' });
  assert.equal(accepted.panelId, 'first');
  assert.equal(sync.flush('second', second, { setViewport(value) {
    assert.deepEqual(value, { x: [20, 55], y: [30, 80] });
    assert.equal(sync.accept('second', second, { value, source: 'api' }), null);
    return true;
  } }), null);
  assert.equal(sync.flush('first', first, { setViewport: () => assert.fail('Echo would reapply the source') }), null);
  assert.equal(sync.flush('second', second, { setViewport: () => assert.fail('Pending request has been consumed') }), null);

  sync.reconcile(owned, active, panelVisibility(owned, { first: ['usage'] }));
  assert.equal(sync.flush('second', second, { setViewport(value) {
    assert.deepEqual(value, { x: [0, 75], y: [30, 80] });
    return true;
  } }), null);
});

test('panel synchronization keeps the last accepted window when a peer throws or rejects', () => {
  const owned = own(panels);
  const active = panelActivations(owned);
  const [first, second] = active.map(item => item.epoch);
  const sync = new PanelViewportSync();
  const visibility = panelVisibility(owned, {});
  sync.reconcile(owned, active, visibility);
  sync.accept('first', first, { value: { x: [15, 50] }, source: 'gesture' });
  assert.equal(sync.flush('second', second, { setViewport: () => false }).diagnostic.reason, 'PANEL_VIEWPORT_REJECTED');
  sync.accept('first', first, { value: { x: [30, 60] }, source: 'gesture' });
  assert.equal(sync.flush('second', second, { setViewport() { throw new Error('Peer unmounted'); } }).diagnostic.reason, 'PANEL_VIEWPORT_REJECTED');
  const themed = own(panels, { ...options, appearance: { theme: 'dark' } });
  assert.equal(panelActivations(themed, active)[1].epoch, second);
  const replacement = own({ ...panels, panels: [panels.panels[0], { id: 'second', data: structuredClone(panelData) }] });
  const newActive = panelActivations(replacement, active);
  assert.notEqual(newActive[1].epoch, second);
  sync.reconcile(replacement, newActive, visibility);
  assert.equal(sync.accept('second', second, { value: { x: [30, 60] }, source: 'api' }), null);
  sync.clear();
  assert.equal(sync.accept('first', first, { value: { x: [10, 20] }, source: 'gesture' }), null);
});

test('a detached input owner cannot consume taps or receive queued pointer, viewport or keyboard callbacks', () => {
  let active = true;
  let enabled = true;
  const events = [];
  const capture = name => (...args) => events.push([name, ...args]);
  const viewport = {
    pinch: true, pan: false, enabled: () => true,
    begin: capture('viewport-start'), update: capture('viewport-update'), end: capture('viewport-end'),
  };
  const lease = inputLease({
    active: () => active, enabled: () => enabled, layout: capture('layout'), consumeTap: () => true,
    begin: capture('begin'), move: capture('move'), tap: capture('tap'), end: capture('end'),
    step: capture('step'), jump: capture('jump'), clear: capture('clear'), viewport,
  });
  const { callbacks: input } = lease;
  assert.equal(input.consumeTap(2, 3), true);
  assert.equal(input.viewport.pinch, true);
  assert.equal(input.viewport.enabled(), true);
  input.begin(1, 2); input.move(3, 4); input.end(true);
  input.tap(3, 4); input.step(1); input.jump('last');
  input.viewport.begin(10); input.viewport.update(20); input.viewport.end(true);
  assert.equal(events.length, 9);
  enabled = false;
  assert.equal(input.enabled(), false);
  assert.equal(input.active(), true);
  input.layout(400, 320); input.clear(); input.tap(5, 6);
  assert.deepEqual(events.slice(-2).map(([name]) => name), ['layout', 'clear']);
  active = false;
  input.layout(10, 20); input.clear();
  lease.revoke();
  active = enabled = true;
  input.tap(0, 0); input.viewport.update(1); input.step(1);
  assert.equal(input.consumeTap(1, 2), false);
  assert.equal(input.viewport.enabled(), false);
  assert.equal(events.length, 11);
  const points = pointLease({ start: capture('start'), move: capture('move'), end: capture('end'), finalize: capture('finalize'), tap: capture('tap') });
  const point = { x: 2, y: 3 };
  points.callbacks.start(point); points.callbacks.move(point); points.callbacks.end(point, true);
  points.callbacks.finalize(point, true); points.callbacks.tap(point, true);
  points.revoke();
  points.callbacks.tap(point, true);
  assert.equal(events.length, 16);
});

test('word measurements deduplicate identical glyphs, reject stale tokens and keep an LRU of actual bounds', () => {
  const request = (wordId, text = wordId) => ({ wordId, text, fontSize: 16, fontKey: 'system-es' });
  const a = request('a', 'uno'), b = request('b', 'uno'), c = request('c', 'tres'), d = request('d', 'cuatro');
  assert.throws(() => new WordCloudMeasurements(0), /limits/);
  const owner = new WordCloudMeasurements(2, 1);
  assert.throws(() => owner.begin([a, a]), /measurement request/);
  assert.throws(() => owner.begin([{ ...a, fontSize: Infinity }]), /measurement request/);
  assert.equal(owner.begin([a, b, c]), true);
  assert.equal(owner.begin([a, b, c]), false);
  assert.equal(owner.snapshot.remaining, 3);
  const token = owner.snapshot.probes[0].token;
  assert.equal(owner.accept(token, { width: 16, height: 9 }), true);
  assert.equal(owner.accept(token, { width: 1, height: 1 }), false);
  assert.equal(owner.snapshot.remaining, 1);
  const stale = owner.snapshot.probes[0].token;
  assert.equal(owner.begin([b, d]), true);
  assert.equal(owner.accept(stale, { width: 45, height: 12 }), false);
  owner.accept(owner.snapshot.probes[0].token, { width: 27, height: 11 });
  assert.deepEqual(owner.snapshot.measurements.map(({ wordId, width, height }) => [wordId, width, height]), [['b', 16, 9], ['d', 27, 11]]);
  assert.equal(owner.begin([c]), true);
  owner.accept(owner.snapshot.probes[0].token, { width: 22, height: 14 });
  assert.equal(owner.cachedMeasurements, 2);
  owner.begin([a]);
  assert.equal(owner.snapshot.remaining, 1);
  owner.accept(owner.snapshot.probes[0].token, { width: -1, height: 11 });
  assert.equal(owner.snapshot.error, 'INVALID_TEXT_BOUNDS');
  owner.begin([d, a]);
  assert.equal(owner.reject(owner.snapshot.probes[0].token), true);
  assert.equal(owner.snapshot.error, 'TEXT_MEASUREMENT_UNAVAILABLE');
  owner.destroy();
  owner.destroy();
  assert.equal(owner.cachedMeasurements, 0);
  assert.equal(owner.snapshot.measurements, null);
  assert.equal(owner.begin([a]), false);
  assert.equal(owner.reject(stale), false);
});

test('wordcloud planning requests native measurements before accepting a scene', () => {
  const data = { type: 'wordcloud', words: [{ id: 'uno', text: 'Árbol', weight: 1 }] };
  const outcome = prepareNativeWordCloud(data, undefined, { width: 300, height: 180 }, [], 'native-scale-1');
  assert.equal(outcome.status, 'ok', JSON.stringify(outcome.diagnostic));
  const pending = measuringWordCloud(outcome);
  assert.equal(pending.wordcloud.status, 'measuring');
  assert.deepEqual(pending.observations, []);
  assert.equal(outcome.preparation.requests[0].text, 'Árbol');
  const multiline = { ...data, words: [{ ...data.words[0], text: 'Dos\nlíneas' }] };
  assert.equal(prepareNativeWordCloud(multiline, {}, undefined, [], 'font').diagnostic.path, 'data.words.0.text');
  assert.equal(prepareNativeWordCloud({ ...data, fontSize: 12 }, {}, undefined, [], 'font').diagnostic.path, 'data');
});

test('tooltip placement counts only visible original observations, leaving fitted regression geometry out', () => {
  const view = { width: 240, height: 200 };
  const observations = [
    { x: 48, y: 45, hit: { type: 'circle', cx: 48, cy: 45, radius: 12 } },
    { x: 182, y: 164, hit: { type: 'polygon', vertices: [{ x: 170, y: 155 }, { x: 198, y: 160 }, { x: 182, y: 178 }] } },
    { x: 120, y: 100, regression: { type: 'fit' } },
  ];
  const scene = { ...view, family: 'regression', observations };
  const map = tooltipOccupancy(scene, view, 240);
  assert.ok(tooltipOverlap(map, { x: 30, y: 29, width: 40, height: 38 }) > 0);
  assert.ok(tooltipOverlap(map, { x: 160, y: 140, width: 50, height: 46 }) > 0);
  assert.equal(tooltipOverlap(map, { x: 110, y: 90, width: 20, height: 20 }), 0);
  const scrolled = tooltipOccupancy(scene, view, 120, 110);
  assert.equal(tooltipOverlap(scrolled, { x: 0, y: 20, width: 40, height: 50 }), 0);
  assert.ok(tooltipOverlap(scrolled, { x: 50, y: 140, width: 50, height: 45 }) > 0);
});
