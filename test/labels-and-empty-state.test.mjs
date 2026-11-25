import assert from 'node:assert/strict';
import test from 'node:test';
import { chartEmptyState, showVariwideSourceWarning } from '../dist/library/empty-state.js';
import { planNativeChart } from '../dist/native/plan.js';
import { nativeValueLabels } from '../dist/native/value-labels.js';
import { parallelLabels } from '../dist/native/parallel-labels.js';

const view = { width: 480, height: 320 };
const labels = { points: true, stacks: false, fontScale: 1, left: 0, visibleWidth: view.width };
const bare = { series: [], observations: [] };

test('Native empty states preserve the difference between hidden, zero and unknown data', () => {
  const states = [
    [{ family: 'line', legend: [{ id: 'a', visible: false }] }, 'All series are hidden', 'Todas las series están ocultas'],
    [{ family: 'contour', contour: { emptyReason: 'outsideViewport' } }, 'No isolines in this window', 'Sin isolíneas en esta ventana'],
    [{ family: 'contour', contour: { emptyReason: 'missing' } }, 'Unknown samples', 'Muestras desconocidas'],
    [{ family: 'contour', contour: {} }, 'No level crossings', 'Sin cruces de nivel'],
    [{ family: 'bellcurve' }, 'No drawable density curve', 'Sin curva de densidad representable'],
    [{ family: 'variwide', variwideLayout: { status: 'no-positive-width' } }, 'No positive widths', 'Sin anchuras positivas'],
    [{ family: 'venn', venn: { layout: { status: 'unknown' } } }, 'Unknown intersection', 'Intersección desconocida'],
    [{ family: 'venn', venn: { layout: { status: 'allZero' } } }, 'All values are zero', 'Todos los valores son cero'],
    [{ family: 'line', observations: [{ value: 0 }] }, 'All values are zero', 'Todos los valores son cero'],
    [{ family: 'line' }, 'No data available', 'Sin datos disponibles'],
    [{ family: 'line', observations: [{ value: 10 }] }, 'No visible marks', 'Sin marcas visibles'],
  ];
  for (const [scene, english, spanish] of states) {
    assert.equal(chartEmptyState({ ...bare, ...scene }, 'en').title, english);
    assert.equal(chartEmptyState({ ...bare, ...scene }, 'es').title, spanish);
  }
  assert.equal(chartEmptyState({ ...bare, family: 'wordcloud', wordcloud: { status: 'measuring' } }, 'en'), undefined);
  assert.equal(chartEmptyState({ ...bare, family: 'line', series: [{ bars: [{ width: 2, height: 0 }] }] }, 'en').title,
    'No data available');
  assert.equal(chartEmptyState({ ...bare, family: 'line', series: [{ bars: [{ width: 2, height: 8 }] }] }, 'en'), undefined);
  const variwide = { family: 'variwide', variwideLayout: { status: 'no-positive-width' } };
  assert(showVariwideSourceWarning(variwide));
  assert(showVariwideSourceWarning({ ...variwide, legend: [{ visible: true }, { visible: false }] }));
  assert(!showVariwideSourceWarning({ ...variwide, legend: [{ visible: false }] }));
});

test('Variable pie labels show the original radius value and respect visible width at large type sizes', () => {
  const result = planNativeChart({
    family: 'variablepie', title: 'Direct and partner', zDomain: [0, 100],
    data: [{ id: 'direct', label: 'Direct', value: 80, z: 40 }, { id: 'partner', label: 'Partner', value: 20, z: 90 }],
  }, view);
  assert.equal(result.status, 'ok', JSON.stringify(result.diagnostic));
  const { scene } = result, values = [];
  const custom = point => {
    values.push([point.point.id.pointId, point.value]);
    return 'Original radius ' + point.value;
  };
  const forced = nativeValueLabels(scene, view, String, { ...labels, layout: 'truncate', fontScale: 2, pointFormatter: custom });
  assert.deepEqual(values, [['direct', 40], ['partner', 90]]);
  assert.deepEqual(forced.map(label => label.text), ['Original radius 40', 'Original radius 90']);
  assert(forced.every(label => label.x >= 0 && label.x + label.width <= view.width && label.y >= 0 && label.y + label.height <= view.height));
  assert(forced.every(label => label.width <= 128));
  assert.deepEqual(nativeValueLabels(scene, view, String, { ...labels, visibleWidth: 20 }), []);
  assert.deepEqual(nativeValueLabels(scene, view, String, { ...labels, points: false }), []);
  const automatic = nativeValueLabels(scene, view, String, labels);
  assert(automatic.length > 0);
  assert(automatic.every(label => ['40', '90'].includes(label.text)));
});

test('Parallel charts keep source axis units and hide labels and ticks independently at the measured width', () => {
  const axes = [
    { id: 'load', label: 'Load', type: 'linear', unit: 'kg', domain: [0, 50] },
    { id: 'delay', label: 'Wait', type: 'linear', unit: 's', domain: [0, 80] },
    { id: 'volume', label: 'Volume', type: 'linear', unit: 'L', domain: [0, 100] },
  ];
  const options = { axes: true, names: true, ticks: true };
  const data = {
    family: 'parallel', title: 'Load and volume', axes,
    series: [{ id: 'run', name: 'Run', data: axes.map((axis, i) => ({ id: axis.id, axisId: axis.id, value: i * 20 })) }],
  };
  for (const coordinates of ['cartesian', 'polar']) {
    const result = planNativeChart({ ...data, coordinates }, view);
    assert.equal(result.status, 'ok', JSON.stringify(result.diagnostic));
    const { scene } = result;
    assert.deepEqual(parallelLabels(scene, view, 1, { ...options, axes: false }), []);
    assert.deepEqual(parallelLabels(scene, { ...view, width: 160 }, 1, options), []);
    assert.deepEqual(parallelLabels(scene, view, 2.8, options), []);
    const names = parallelLabels(scene, view, 1, { ...options, ticks: false });
    assert(names.some(label => label.id === 'load/name' && label.text === 'Load · kg'));
    assert(names.every(label => label.type === 'name' && label.left >= 0 && label.left + label.width <= view.width));
    const ticks = parallelLabels(scene, view, 1, { ...options, names: false });
    assert(ticks.length > 0 && ticks.every(label => label.type === 'tick'));
    if (coordinates === 'polar') assert(ticks.some(label => label.text === '0–100'));
    else assert(ticks.some(label => label.text === '0'));
  }
});
