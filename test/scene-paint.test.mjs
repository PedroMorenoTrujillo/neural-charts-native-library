import assert from 'node:assert/strict';
import test from 'node:test';
import { identityKey } from '../dist/library/contracts.js';
import { sceneSvg, updateScenePresentation } from '../dist/library/scene.js';
import { barPaintBatches, circlePaintBatches, paintGroups, pointOverrideColor, pointPaint, referencePaint } from '../dist/library/scene-paint.js';
import { planNativeChart } from '../dist/native/plan.js';

const base = '#336699';
const highlight = '#aa2244';
const id = pointId => ({ seriesId: 's', pointId });

test('Native paint resolves overrides by both identities and keeps unstyled marks in the source color', () => {
  const scene = { points: [{ ...id('highlight'), color: highlight }, { seriesId: 'peer', pointId: 'highlight', color: '#ddaa00' }] };
  assert.equal(pointPaint(scene), pointPaint(scene));
  assert.equal(pointOverrideColor(scene, id('highlight')), highlight);
  assert.equal(pointOverrideColor(scene, id('normal')), undefined);
  const plain = { shape: 'guide' };
  const normal = { pointId: 'normal' };
  const marked = { pointId: 'highlight' };
  assert.deepEqual([...paintGroups('s', base, [plain, marked, normal, marked], pointPaint(scene))],
    [[base, [plain, normal]], [highlight, [marked, marked]]]);
});

test('Circle batches preserve guarded overlaps and color order with a bounded mask', () => {
  const circle = (cx, cy, radius, pointId) => ({ cx, cy, radius, pointId });
  const first = circle(20, 20, 3);
  const overlaps = circle(23, 22, 3, 'normal');
  const apart = circle(300, 20, 3);
  const huge = circle(600, 400, 180);
  const marked = circle(33, 20, 3, 'highlight');
  const last = circle(340, 20, 3);
  const overrides = new Map([[identityKey(id('highlight')), highlight]]);
  const batches = circlePaintBatches('s', base, [first, overlaps, apart, huge, marked, last], overrides);
  assert.deepEqual(batches, [
    [base, [first, apart]], [base, [overlaps]], [base, [huge]], [highlight, [marked]], [base, [last]],
  ]);
  const crowded = Array.from({ length: 1050 }, (_, i) => circle(5, 5, 2, 'normal-' + i));
  const crowdedBatches = circlePaintBatches('s', base, crowded, overrides, 9);
  assert.equal(crowdedBatches.length, crowded.length);
  assert.deepEqual(crowdedBatches.map(([color, items]) => {
    assert.equal(color, base);
    assert.equal(items.length, 1);
    return items[0];
  }), crowded);
});

test('Bar paths maintain stacking order when opacity or stroke makes overlap visible', () => {
  const rect = (x, y, pointId) => ({ x, y, width: 8, height: 8, pointId });
  const center = rect(40, 40);
  const left = rect(0, 40);
  const right = rect(80, 40);
  const top = rect(40, 0);
  const bottom = rect(40, 80, 'unconfigured');
  const touchesStroke = rect(49, 40);
  const marked = rect(80, 40, 'highlight');
  const last = rect(1, 40);
  const items = [center, left, right, top, bottom, touchesStroke, marked, last];
  const overrides = new Map([[identityKey(id('highlight')), highlight]]);
  assert.deepEqual(barPaintBatches('s', base, items, overrides, true, 1), [
    [base, [center, left, right, top, bottom]], [base, [touchesStroke]], [highlight, [marked]], [base, [last]],
  ]);
  assert.deepEqual(barPaintBatches('s', base, items, overrides, false), [
    [base, items.slice(0, 6)], [highlight, [marked]], [base, [last]],
  ]);
});

test('Reference paint transforms only visible lines and respects solid, dot and default dash', () => {
  const line = { x1: 2, y1: 3, x2: 5, y2: 7 };
  const transform = { x: 10, y: 20, sx: 2, sy: 3 };
  const output = referencePaint([
    { status: 'viewport-clipped' },
    { status: 'visible', line, dash: 'solid', width: 2, color: base },
    { status: 'visible', line, dash: 'dot' },
    { status: 'visible', line },
  ], transform);
  assert.equal(output.split('M14 29L20 41').length - 1, 3);
  assert.match(output, /stroke="#336699" stroke-width="2"\/>/);
  assert.match(output, /stroke-dasharray="1 4" stroke-linecap="round"/);
  assert.match(output, /stroke="#8B6CCE" stroke-width="1.5" stroke-dasharray="6 4"/);
  assert.equal(referencePaint(undefined, transform), '');
});

test('Dense column paint keeps the source geometry, the override and the original zero across resize', () => {
  const names = Array.from({ length: 60 }, (_, i) => 'c' + i);
  const colors = ['#336699', '#115577', '#227766', '#aa2244', '#aabb44'];
  const spec = {
    family: 'column', title: 'Original readings',
    axes: {
      x: { type: 'category', values: names.map(id => ({ id, label: id })) },
      y: { type: 'linear', domain: [0, 100], nice: false },
    },
    series: colors.map((color, i) => ({
      id: 'series-' + i, name: 'Series ' + i, color,
      data: names.map((x, index) => ({ id: x, x, y: index === 0 ? 0 : (index + 30) % 100 })),
    })),
  };
  const result = planNativeChart(spec, { width: 1120, height: 260 });
  assert.equal(result.status, 'ok', JSON.stringify(result.diagnostic));
  const scene = result.scene;
  assert.equal(scene.observations.length, 300);
  assert.equal(scene.observations.filter(point => point.value === 0).length, 5);
  assert(scene.series.reduce((count, item) => count + item.bars.length, 0) > 256);
  const styled = updateScenePresentation(scene, { points: [{ seriesId: 'series-0', pointId: 'c12', color: '#a119cc' }] });
  for (const width of [420, 1100]) {
    const svg = sceneSvg(styled, base, { width, height: 260 }, false, { layer: 'series' });
    assert.match(svg, /fill="#a119cc"/);
    assert.equal((svg.match(/Z/g) ?? []).length, 295);
    assert.equal((svg.match(/<rect/g) ?? []).length, 0);
    assert(!/NaN|Infinity/.test(svg));
  }
  assert.throws(() => sceneSvg(scene, 'blue'), /Invalid grid color/);
  assert.throws(() => sceneSvg(scene, base, undefined, true, { surfaceColor: 'blue' }), /Invalid surface color/);
  assert.throws(() => sceneSvg(scene, base, { width: 0, height: 240 }), /Invalid SVG viewport/);
});
