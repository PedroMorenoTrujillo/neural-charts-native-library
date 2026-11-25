import assert from 'node:assert/strict';
import test from 'node:test';
import { planChartData } from '../dist/native/data-planning.js';
import { viewportCanvas, viewportGestureRequest, viewportScaleLimit } from '../dist/native/viewport-gestures.js';
import { tilemapCircleOutline } from '../dist/native/tilemap-selection.js';

const size = { width: 560, height: 280 };
const linear = { type: 'linear', domain: [0, 100], reversed: true };
const scatter = {
  type: 'scatter', axes: { x: linear, y: { ...linear, reversed: false } },
  series: [{ id: 's', name: 'Source', data: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 100, y: 100 }] }],
};
const scatterPlan = planChartData(scatter, [], size, { viewport: { axes: 'xy' } });
const context = { model: scatterPlan.viewport, pinch: true, pan: true };

test('Native viewport maps touch anchors into reversed source coordinates and clamps movement input', () => {
  assert.equal(scatterPlan.status, 'ok', JSON.stringify(scatterPlan.diagnostic));
  const canvas = viewportCanvas(scatterPlan.scene, context, size);
  assert(canvas.horizontal && canvas.vertical && !canvas.positiveX && !canvas.positiveY);
  const frame = { scale: 9, x: canvas.x - 10, y: canvas.y + canvas.height + 10,
    dx: canvas.width / 4, dy: -canvas.height / 2 };
  const intent = viewportGestureRequest(scatterPlan.scene, context, size, frame, 'pinch');
  assert.equal(intent.model, scatterPlan.viewport);
  assert.equal(intent.source, 'pinch');
  assert.deepEqual(intent.intent, { type: 'transform', factor: 4, anchor: { x: 1, y: 0 }, delta: { x: 0.25, y: -0.5 } });
  const withoutPan = viewportGestureRequest(scatterPlan.scene, { ...context, pan: false }, size, { ...frame, scale: 0.1 }, 'pinch');
  assert.deepEqual(withoutPan.intent, { type: 'transform', factor: 0.25, anchor: { x: 1, y: 0 } });
  const withoutPinch = viewportGestureRequest(scatterPlan.scene, { ...context, pinch: false }, size, frame, 'pan');
  assert.equal(withoutPinch.intent.factor, 1);
  for (const patch of [{ scale: -1 }, { scale: NaN }, { x: Infinity }, { y: NaN }, { dx: Infinity }, { dy: Infinity }]) {
    assert.equal(viewportGestureRequest(scatterPlan.scene, context, size, { ...frame, ...patch }, 'pan'), null);
  }
  for (const dimensions of [{ width: 0, height: 1 }, { width: 1, height: 0 }, { width: 1, height: NaN }]) {
    assert.equal(viewportGestureRequest(scatterPlan.scene, context, dimensions, frame, 'pan'), null);
  }
});

test('Native transposes the value axis for horizontal bars without shifting the source categories', () => {
  const data = {
    type: 'column', orientation: 'horizontal',
    axes: { x: { type: 'category', values: [{ id: 'a', label: 'North' }, { id: 'b', label: 'South' }] },
      y: { ...linear, reversed: false } },
    series: [{ id: 's', name: 'Source', data: [{ id: 'a', x: 'a', y: 20 }, { id: 'b', x: 'b', y: 80 }] }],
  };
  const result = planChartData(data, [], size, { viewport: { axes: 'x' } });
  assert.equal(result.status, 'ok', JSON.stringify(result.diagnostic));
  const categoryOnly = { ...context, model: result.viewport };
  const canvas = viewportCanvas(result.scene, categoryOnly, size);
  assert.equal(canvas.axisX, 'y');
  assert.equal(canvas.axisY, 'x');
  assert.equal(canvas.horizontal, false);
  assert.equal(canvas.vertical, true);
  const intent = viewportGestureRequest(result.scene, categoryOnly, size, {
    scale: 2, x: canvas.x, dx: 400, y: canvas.y + canvas.height / 2, dy: canvas.height / 4,
  }, 'pan');
  assert.deepEqual(intent.intent.anchor, { x: 0.5 });
  assert(Math.abs(intent.intent.delta.x) === 0.25);
  assert.equal(viewportScaleLimit(result.viewport), 4);
  const numericOnly = planChartData(data, [], size, { viewport: { axes: 'y', value: { y: [25, 26] } } });
  assert.equal(numericOnly.status, 'ok');
  const bounds = numericOnly.viewport.bounds.y;
  const displayed = numericOnly.viewport.displayed.y;
  const limit = { ...bounds, limits: { minSpan: (displayed[1] - displayed[0]) / 2 } };
  const constrained = { ...numericOnly.viewport, bounds: { ...numericOnly.viewport.bounds, y: limit } };
  assert.equal(viewportScaleLimit(constrained), 2);
});

test('Tile selection outlines use the projected circle radius and reject empty or polygon hits', () => {
  const view = { width: 320, height: 260 };
  const transform = { x: 4, y: 5, sx: 2, sy: 2 };
  assert.equal(tilemapCircleOutline(undefined, view, transform, '#224488'), undefined);
  assert.equal(tilemapCircleOutline({ type: 'polygon', vertices: [] }, view, transform, '#224488'), undefined);
  assert.equal(tilemapCircleOutline({ type: 'circle', cx: 10, cy: 20, radius: 0 }, view, transform, '#224488'), undefined);
  const svg = tilemapCircleOutline({ type: 'circle', cx: 10, cy: 20, radius: 7 }, view, transform, '#224488');
  assert.match(svg, /translate\(4 5\) scale\(2 2\)/);
  assert.match(svg, /cx="10" cy="20" r="7" fill="none" stroke="#224488" stroke-width="2"/);
  assert.match(svg, /stroke="#FFFFFF" stroke-width="1"/);
});
