import assert from 'node:assert/strict';
import test from 'node:test';
import { NativeChartSession } from '../dist/library/index.js';
import { planNativeChart, transformPlanViewport } from '../dist/native/plan.js';
import { planChartData } from '../dist/native/data-planning.js';
import { nativeLogScales, sameLogScales } from '../dist/native/log-options.js';

const dimensions = { width: 420, height: 300 };
const haptics = { allowed: () => false, selection: () => assert.fail('Haptics are disabled') };

function createClock() {
  const frames = new Map();
  let next = 0;
  return {
    request(callback) { frames.set(++next, callback); return next; },
    cancel(id) { frames.delete(id); },
    count() { return frames.size; },
    flush() {
      const queued = [...frames.values()];
      frames.clear();
      for (const callback of queued) callback();
    },
  };
}

function planned(data) {
  const result = planNativeChart(data, dimensions);
  assert.equal(result.status, 'ok', JSON.stringify(result.diagnostic));
  return result.scene;
}

test('Mixed charts select columns in their painted area and the line at its own anchor', () => {
  const categories = ['a', 'b', 'c'];
  const points = values => categories.map((x, index) => ({ id: x, x, y: values[index] }));
  const data = {
    family: 'mixed', title: 'Actual and forecast',
    axes: { x: { type: 'category', values: categories.map(id => ({ id, label: id.toUpperCase() })) },
      y: { type: 'linear', domain: [0, 100] } },
    series: [
      { type: 'column', id: 'actual', name: 'Actual', data: points([90, 65, 80]) },
      { type: 'line', id: 'forecast', name: 'Forecast', data: points([5, 8, 10]) },
    ],
  };
  const scene = planned(data);
  const chart = new NativeChartSession(scene, createClock(), haptics, () => {});
  const bars = scene.series.find(series => series.id === 'actual').bars;
  assert.equal(bars.length, categories.length);
  for (const bar of bars) {
    const anchor = scene.observations.find(point => point.id.seriesId === 'forecast' && point.id.pointId === bar.pointId);
    chart.tap(bar.x + bar.width / 2, bar.y + bar.height * .8, 12);
    assert.deepEqual(chart.snapshot.selected, { seriesId: 'actual', pointId: bar.pointId });
    chart.tap(anchor.x, anchor.y, 12);
    assert.deepEqual(chart.snapshot.selected, anchor.id);
  }
  chart.destroy();

  const point = scene.observations.find(point => point.id.pointId === 'b');
  const shared = new NativeChartSession(scene, createClock(), haptics, () => {}, null, 'shared', point.group.key);
  assert.deepEqual(shared.navigationRange, { min: 1, max: 3, now: 2 });
  assert.deepEqual(shared.snapshot.shared.rows.map(row => [row.seriesId, row.point.value]), [['actual', 65], ['forecast', 8]]);
  assert.equal(shared.setPinned(true), true);
  shared.step('last');
  assert.equal(shared.snapshot.shared.label, 'B');
  assert.equal(shared.setPinned(false), false);
  shared.step('last');
  assert.equal(shared.snapshot.shared.label, 'C');
  shared.step('first');
  assert.equal(shared.snapshot.shared.label, 'A');
  shared.destroy();
  assert.equal(shared.setPinned(true), false);
});

test('Scatter exploration coalesces hits, restores the committed point on cancel and ignores invalid coordinates', () => {
  const data = {
    family: 'scatter', title: 'Measurements',
    axes: { x: { type: 'linear', domain: [0, 10] }, y: { type: 'linear', domain: [0, 10] } },
    series: [{ id: 's', name: 'Readings', data: [{ id: 'a', x: 2, y: 8 }, { id: 'b', x: 8, y: 2 }] }],
  };
  const scene = planned(data);
  const [a, b] = scene.observations;
  const clock = createClock();
  const changes = [];
  const chart = new NativeChartSession(scene, clock, haptics, snapshot => changes.push(snapshot), a.id);
  assert.equal(chart.setPinned(false), false);
  chart.tap(NaN, a.y);
  chart.begin(a.x, Infinity);
  chart.move(b.x, b.y);
  chart.end(true);
  assert.equal(changes.length, 0);
  assert.deepEqual(chart.snapshot.selected, a.id);

  chart.begin(a.x, a.y, Infinity);
  chart.move(b.x, b.y);
  chart.move(-1, -1);
  assert.equal(clock.count(), 1);
  clock.flush();
  assert.equal(chart.snapshot.active, null);
  chart.move(b.x, b.y);
  chart.end(false);
  assert.equal(clock.count(), 0);
  assert.deepEqual(chart.snapshot.active.id, a.id);
  assert.deepEqual(chart.snapshot.selected, a.id);

  chart.begin(a.x, a.y);
  chart.move(b.x, b.y);
  chart.end(true);
  assert.deepEqual(chart.snapshot.selected, b.id);
  chart.tap(b.x, b.y, -99);
  assert.equal(chart.snapshot.selected, null);
  assert.equal(chart.setPinned(true), false);
  chart.step(-1);
  assert.deepEqual(chart.snapshot.selected, b.id);
  chart.destroy();
  chart.clear();
  assert.equal(chart.snapshot.selected, null);
});

test('Resetting an empty logarithmic bubble window restores every original observation', () => {
  const raw = {
    type: 'bubble',
    axes: { x: { type: 'linear' }, y: { type: 'linear', includeZero: false } },
    series: [{ id: 'measured', name: 'Measured', data: [
      { id: 'a', x: 1, y: 2, z: 0 }, { id: 'b', x: 10, y: 20, z: 4 },
      { id: 'c', x: 100, y: 200, z: 12 }, { id: 'd', x: 1000, y: 2000, z: 20 },
    ] }],
  };
  const axes = { x: { scale: { type: 'log' } }, y: { scale: { type: 'log' } } };
  const scales = nativeLogScales({ axes });
  const plan = value => planChartData(raw, [], { width: 1002, height: 420 }, { scales, viewport: { axes: 'xy', value } });
  const outside = plan({ x: [4.64, 88.39], y: [24.43, 465.37] });
  assert.equal(outside.status, 'empty');
  assert.deepEqual(outside.scene.observations, []);
  const reset = transformPlanViewport(outside.viewport, { type: 'reset' });
  assert.deepEqual(reset, { status: 'ok', value: {} });
  const restored = plan(reset.value);
  assert.equal(restored.status, 'ok');
  assert.deepEqual(restored.scene.observations.map(point => [point.id.pointId, point.xValue, point.value, point.sizeValue]),
    raw.series[0].data.map(point => [point.id, point.x, point.y, point.z]));
  assert.deepEqual(restored.viewport.value, {});
  assert(sameLogScales(scales, nativeLogScales({ axes: structuredClone(axes) })));
  assert(!sameLogScales(scales, nativeLogScales({ axes: { x: axes.x } })));
  assert.equal(nativeLogScales({ axes: { y: { title: 'Unchanged linear scale' } } }), undefined);
});
