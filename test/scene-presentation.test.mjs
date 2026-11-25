import assert from 'node:assert/strict';
import test from 'node:test';
import { NativeChartSession } from '../dist/library/index.js';
import {
  sameScenePaint, sceneInteractionKey, sceneMotionSignature, sceneSvg, updateScenePresentation,
} from '../dist/library/scene.js';
import { planNativeChart } from '../dist/native/plan.js';

const dimensions = { width: 360, height: 220 };
const data = {
  family: 'line', title: 'Meter readings',
  axes: { x: { type: 'linear', domain: [0, 10] }, y: { type: 'linear', domain: [0, 10] } },
  series: [{ id: 'actual', name: 'Actual', data: [{ id: 'zero', x: 0, y: 0 }, { id: 'end', x: 10, y: 8 }] }],
};
const geometry = {
  ...dimensions,
  references: [{ id: 'target', axis: 'y', value: 6 }, { id: 'outside', axis: 'y', value: 12 }],
  referenceBands: [{ id: 'acceptable', axis: 'y', from: 1, to: 3 }],
};

function scene(spec = data, options = geometry) {
  const result = planNativeChart(spec, options);
  assert.equal(result.status, 'ok', JSON.stringify(result.diagnostic));
  return result.scene;
}

test('Native labels can change on a selected scene without invalidating hits, motion or paint', () => {
  const original = scene();
  assert.equal(updateScenePresentation(original, {}), original);
  const named = updateScenePresentation(original, {
    title: 'New title', description: 'Measured at source', unit: 'kWh', series: [{ id: 'actual', name: 'Readings' }],
  });
  assert.equal(named.observations[0].seriesName, 'Readings');
  assert.equal(named.observations[0].value, 0);
  assert.equal(original.observations[0].seriesName, 'Actual');
  assert.equal(sceneInteractionKey(original), sceneInteractionKey(named));
  assert.equal(sceneMotionSignature(original), sceneMotionSignature(named));
  assert.equal(sameScenePaint(original, named), true);

  const updates = [];
  const session = new NativeChartSession(original, { request: () => 1, cancel: () => {} },
    { allowed: () => false, selection: () => assert.fail('Haptics disabled') }, change => updates.push(change));
  try {
    session.step('first');
    assert.equal(session.setPinned(true), true);
    assert.equal(session.updatePresentation(named), true);
    assert.deepEqual(session.snapshot.selected, { seriesId: 'actual', pointId: 'zero' });
    assert.equal(session.snapshot.pinned, true);
    assert.equal(session.updatePresentation(scene(data, { ...geometry, width: 420 })), false);
    assert.equal(updates.at(-1).selected.pointId, 'zero');
  } finally { session.destroy(); }
});

test('Native paint revisions separate source geometry from series, points and references', () => {
  const original = scene();
  const styles = {
    series: [{ id: 'actual', color: '#112233' }],
    points: [{ seriesId: 'actual', pointId: 'zero', color: '#335577' }],
    referenceStyles: [{ id: 'target', color: '#772255', width: 3, dash: 'dash' }, { id: 'outside', color: '#772255' }],
    referenceBandStyles: [{ id: 'acceptable', color: '#227744', opacity: .45, label: 'Expected band' }],
  };
  const styled = updateScenePresentation(original, styles);
  const equivalent = updateScenePresentation(original, { ...styles, title: 'Readable name' });
  assert.equal(sameScenePaint(original, styled), false);
  assert.equal(sameScenePaint(styled, equivalent), true);
  assert.equal(sceneInteractionKey(original), sceneInteractionKey(styled));
  assert.deepEqual(styled.references.map(x => x.status), ['visible', 'outside']);
  const series = sceneSvg(styled, '#999999', dimensions, true, { layer: 'series', seriesIds: ['actual'], showMarkers: true });
  assert.match(series, /#112233/);
  assert.match(series, /#335577/);
  assert.doesNotMatch(series, /#772255|#227744/);
  const ref = sceneSvg(styled, '#999999', dimensions, false, { layer: 'references' });
  assert.equal((ref.match(/#772255/g) ?? []).length, 1);
  assert.match(ref, /stroke-dasharray=/);
  const grid = sceneSvg(styled, '#999999', dimensions, true, { layer: 'grid', surfaceColor: '#111111' });
  assert.match(grid, /fill="#227744" fill-opacity="0\.45"/);
  assert.doesNotMatch(grid, /#112233|#335577|#772255/);
  assert.doesNotMatch(sceneSvg(original, '#999999'), /#112233|#335577|#772255/);
});

test('Native presentation rejects unsupported styles and preserves the owned scene', () => {
  const original = scene();
  const invalid = [
    [{ title: 'x'.repeat(201) }, /Invalid scene presentation/],
    [{ description: 'x'.repeat(1001) }, /Invalid scene presentation/],
    [{ unit: 'x'.repeat(65) }, /Invalid scene presentation/],
    [{ secondaryUnit: '%' }, /Invalid scene presentation/],
    [{ series: [{ id: 'actual', color: 'red' }] }, /Invalid series presentation/],
    [{ series: [{ id: 'unknown', name: 'Hidden' }] }, /Invalid series presentation/],
    [{ series: [{ id: 'actual' }, { id: 'actual' }] }, /Invalid series presentation/],
    [{ points: [{ seriesId: 'actual', pointId: 'missing', color: '#335577' }] }, /Unknown point color identity/],
    [{ referenceStyles: [{ id: 'missing', color: '#335577' }] }, /Unknown reference style ID/],
    [{ referenceBandStyles: [{ id: 'missing', color: '#335577' }] }, /Unknown reference band style ID/],
  ];
  for (const [patch, diagnostic] of invalid) assert.throws(() => updateScenePresentation(original, patch), diagnostic);
  assert.throws(() => sceneSvg(original, 'red'), /Invalid grid color/);
  assert.throws(() => sceneSvg(original, '#999999', undefined, true, { surfaceColor: 'red' }), /Invalid surface color/);
  assert.throws(() => sceneSvg(original, '#999999', { width: 0, height: 1 }), /Invalid SVG viewport/);
  assert.equal(updateScenePresentation(original, {}), original);
  assert.equal(original.observations[0].value, 0);
});

test('Native shared details keep zero while representing explicitly missing series as absent rows', () => {
  const shared = scene({
    ...data,
    series: [
      data.series[0],
      { id: 'forecast', name: 'Forecast', data: [{ id: 'gap', x: 0, y: null }, { id: 'value', x: 10, y: 5 }] },
      { id: 'someone-else', name: 'Other', data: [{ id: 'other-later', x: 10, y: 9 }] },
    ],
  });
  const session = new NativeChartSession(shared, { request: () => 1, cancel: () => {} },
    { allowed: () => false, selection: () => assert.fail('Haptics disabled') }, () => {}, null, 'shared');
  try {
    assert.deepEqual(session.navigationRange, { min: 1, max: 2, now: 1 });
    assert.equal(session.setPinned(true), false);
    session.step('first');
    const first = session.snapshot.shared;
    assert.equal(first.points[0].value, 0);
    assert.deepEqual(first.rows.map(row => [row.seriesId, row.point?.value ?? null]),
      [['actual', 0], ['forecast', null], ['someone-else', null]]);
    assert.equal(session.snapshot.shared, first);
    assert(Object.isFrozen(first) && Object.isFrozen(first.rows));
    const changed = updateScenePresentation(shared, { series: [{ id: 'forecast', name: 'Forecast revised' }] });
    assert.equal(session.updatePresentation(changed), true);
    assert.equal(session.snapshot.shared.rows[1].name, 'Forecast revised');
    assert.equal(session.snapshot.shared.points[0].value, 0);
    session.step(1);
    assert.equal(session.navigationRange.now, 2);
    assert.deepEqual(session.snapshot.shared.rows.map(row => row.point.value), [8, 5, 9]);
    const observation = session.snapshot.shared.points[1];
    session.tap(observation.x, observation.y, 12);
    assert.equal(session.snapshot.selected, null, 'Any row in the same group dismisses shared details');
    assert.equal(session.snapshot.shared, undefined);
  } finally { session.destroy(); }
});

test('Native donut selection respects the visible annulus and each sector boundary', () => {
  const donut = scene({
    family: 'donut', title: 'Parts of a total',
    data: [{ id: 'first', label: 'First', value: 60 }, { id: 'second', label: 'Second', value: 40 }],
  }, dimensions);
  const session = new NativeChartSession(donut, { request: () => 1, cancel: () => {} },
    { allowed: () => false, selection: () => assert.fail('Haptics disabled') }, () => {});
  try {
    const hit = donut.observations[0].hit;
    assert.equal(hit.type, 'sector');
    assert(hit.innerRadius > 0);
    session.tap(hit.cx, hit.cy, 24);
    assert.equal(session.snapshot.selected, null);
    for (const point of donut.observations) {
      const { cx, cy, radius, innerRadius, start, end } = point.hit;
      const angle = (start + end) / 2;
      const distance = (radius + innerRadius) / 2;
      session.tap(cx + Math.sin(angle) * distance, cy - Math.cos(angle) * distance);
      assert.deepEqual(session.snapshot.selected, point.id);
      session.tap(NaN, cy);
      assert.deepEqual(session.snapshot.selected, point.id);
    }
    session.tap(-1, hit.cy, 500);
    assert.equal(session.snapshot.selected, null);
  } finally { session.destroy(); }
});

test('A pending or failed haptic leaves Native exploration and destruction responsive', async () => {
  const source = scene();
  const updates = [];
  const pending = new Map();
  let sequence = 0;
  let vibrations = 0;
  let fail;
  let checkThrows = true;
  const session = new NativeChartSession(source, {
    request: callback => { pending.set(++sequence, callback); return sequence; },
    cancel: handle => pending.delete(handle),
  }, {
    allowed: () => {
      if (checkThrows) {
        checkThrows = false;
        throw new Error('Haptic provider temporarily unavailable');
      }
      return true;
    },
    selection: () => {
      vibrations++;
      return new Promise((_, reject) => { fail = reject; });
    },
  }, value => updates.push(value));
  session.step('first');
  assert.deepEqual(session.snapshot.selected, source.observations[0].id);
  assert.equal(vibrations, 0);
  session.step('last');
  assert.equal(vibrations, 1);
  const [first, last] = source.observations;
  session.begin(last.x, last.y);
  session.move(first.x, first.y);
  session.move(last.x, last.y);
  assert.equal(pending.size, 1);
  session.setPinned(true);
  assert.equal(pending.size, 0);
  assert.deepEqual(session.snapshot.selected, last.id);
  assert.equal(vibrations, 1);
  fail(new Error('Haptic rejected by platform'));
  await new Promise(setImmediate);
  session.setPinned(false);
  session.step('first');
  assert.equal(vibrations, 2);
  session.destroy();
  const emitted = updates.length;
  fail(new Error('Haptic died with screen'));
  await new Promise(setImmediate);
  session.step('last');
  assert.equal(updates.length, emitted);
  assert.equal(vibrations, 2);
  assert.equal(pending.size, 0);
});
