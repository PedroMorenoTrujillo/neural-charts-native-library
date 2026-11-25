import assert from 'node:assert/strict';
import test from 'node:test';
import { optionsDiagnostic } from '../dist/native/options-validation.js';

const line = {
  type: 'line',
  axes: { x: { type: 'linear' }, y: { type: 'linear' } },
  series: [{ id: 'sales', name: 'Sales', data: [{ id: 'a', x: 0, y: 2 }, { id: 'b', x: 1, y: 4 }] }],
};
const band = { id: 'target', from: 0, to: 2, opacity: .2, color: '#335577' };
const reference = { id: 'threshold', value: 3, width: 1.5, color: '#448877' };

function rejects(data, options, path) {
  const result = optionsDiagnostic(data, options);
  const context = data.type + ' ' + path + ' ' + JSON.stringify(result);
  assert.equal(result?.reason, 'INVALID_CHART_OPTION', context);
  assert.equal(result.path, path ? 'options.' + path : 'options', context);
}

test('Native style lists own plain bounded records and never evaluate a caller accessor', () => {
  const bands = referenceBands => ({ axes: { y: { referenceBands } } });
  const lines = referenceLines => ({ axes: { y: { referenceLines } } });
  const swatches = points => ({ appearance: { points } });
  const point = { seriesId: 'sales', pointId: 'a', color: '#445577' };
  const inaccessible = Object.defineProperty([], '0', { get() { assert.fail('Accessor executed'); } });
  const symbolList = Object.assign([band], { [Symbol('unexpected')]: true });
  const extra = Object.assign([band], { notes: true });
  for (const input of [inaccessible, symbolList, extra, Array(33).fill(band), Object.setPrototypeOf([band], null)]) {
    rejects(line, bands(input), 'axes.y.referenceBands');
  }
  rejects(line, bands(Array(1)), 'axes.y.referenceBands.0');
  rejects(line, bands([band, { ...band }]), 'axes.y.referenceBands.1.id');
  rejects(line, bands([{ ...band, opacity: -1 }]), 'axes.y.referenceBands.0.opacity');
  rejects(line, bands([{ ...band, label: 'x'.repeat(201) }]), 'axes.y.referenceBands.0.label');
  rejects(line, lines([reference, reference]), 'axes.y.referenceLines.1');
  rejects(line, lines([{ ...reference, width: 7 }]), 'axes.y.referenceLines.0.width');
  rejects(line, lines([{ ...reference, value: '' }]), 'axes.y.referenceLines.0.value');
  rejects(line, lines(inaccessible), 'axes.y.referenceLines.0');
  rejects(line, swatches([point, point]), 'appearance.points.1');
  rejects(line, swatches([{ ...point, pointId: '' }]), 'appearance.points.0');
  rejects(line, swatches([{ ...point, color: 'red' }]), 'appearance.points.0.color');
  assert.equal(optionsDiagnostic(line, { axes: { y: { referenceBands: [band], referenceLines: [reference] } }, ...swatches([point]) }), null);
});

test('Native rejects ambiguous viewport bounds and limits layout inputs before planning', () => {
  const viewport = initial => ({ viewport: { axes: 'xy', initial } });
  const sparse = Array(2);
  sparse[1] = 4;
  for (const x of [[1], [1, 1], [1, Infinity], sparse, { firstId: 'a' }, { firstId: 'a', lastId: '' }]) {
    rejects(line, viewport({ x }), 'viewport.initial.x');
  }
  rejects(line, viewport({ y: { firstId: 'a', lastId: 'b' } }), 'viewport.initial.y');
  rejects(line, { axes: { x: { scale: { type: 'log', base: 2 } } } }, 'axes.x.scale');
  const includeZero = { ...line, axes: { ...line.axes, x: { type: 'linear', includeZero: true } } };
  rejects(includeZero, { axes: { x: { scale: { type: 'log' } } } }, 'axes.x.scale');
  assert.equal(optionsDiagnostic(line, viewport({ x: [0, 1], y: [1, 4] })), null);

  for (const layout of [{ startAngle: -361 }, { endAngle: 721 }, { startAngle: 20, endAngle: 19 }, { endAngle: 361 }]) {
    rejects({ type: 'pie' }, { layout }, 'layout');
  }
  rejects({ type: 'gauge' }, { layout: { style: 'solid', tickCount: 4 } }, 'layout.tickCount');
  rejects({ type: 'gauge' }, { layout: { style: 'needle', tickCount: 2.5 } }, 'layout.tickCount');
  rejects(line, { layout: { endAngle: 120 } }, 'layout');
  assert.equal(optionsDiagnostic({ type: 'gauge' }, { layout: { style: 'needle', tickCount: 2 } }), null);
});

test('Native rejects ambiguous qualitative bands, color stops and word rotations', () => {
  const qualitative = { id: 'healthy', from: 10, to: 20, color: '#335577' };
  rejects({ type: 'bullet' }, { layout: { bands: Array(33).fill(qualitative) } }, 'layout.bands');
  rejects({ type: 'bullet' }, { layout: { bands: [qualitative, qualitative] } }, 'layout.bands.1');
  rejects({ type: 'bullet' }, { layout: { bands: [{ ...qualitative, to: 5 }] } }, 'layout.bands.0');
  const colorAxis = scale => ({ colorAxis: { visible: true, scale } });
  rejects({ type: 'tilemap' }, colorAxis(null), 'colorAxis.scale');
  rejects({ type: 'tilemap' }, colorAxis({ type: 'legend' }), 'colorAxis.scale.type');
  rejects({ type: 'tilemap' }, colorAxis({ type: 'continuous', stops: [{ at: 0, color: '#000000' }] }),
    'colorAxis.scale.stops');
  rejects({ type: 'tilemap' }, colorAxis({ type: 'classes', classes: [{ color: 'bad' }] }), 'colorAxis.scale.classes.0.color');
  rejects({ type: 'wordcloud' }, { layout: { rotations: [0, 0] } }, 'layout.rotations');
  rejects({ type: 'wordcloud' }, { layout: { rotations: [15] } }, 'layout.rotations');
});

test('Family-specific options reject settings that would silently misrepresent axes or values', () => {
  const cases = [
    ['heatmap', { axes: { grid: true } }, 'axes.grid'],
    ['heatmap', { legend: { interactive: true } }, 'legend'],
    ['heatmap', { tooltip: { crosshair: true } }, 'tooltip.crosshair'],
    ['heatmap', { appearance: { series: [] } }, 'appearance.series'],
    ['heatmap', { axes: { x: { referenceLines: [reference] } } }, 'axes'],
    ['tilemap', { tooltip: { crosshair: false } }, 'tooltip.crosshair'],
    ['tilemap', { appearance: { opacity: -0.1 } }, 'appearance.opacity'],
    ['tilemap', { appearance: { dataLabels: false } }, 'appearance'],
    ['line', { colorAxis: { visible: true } }, 'colorAxis'],
    ['line', { appearance: { opacity: 0.5 } }, 'appearance.opacity'],
    ['line', { appearance: { waterfall: {} } }, 'appearance.waterfall'],
    ['pie', { axes: { grid: true } }, 'axes'],
    ['pie', { viewport: { axes: 'x' } }, 'viewport'],
    ['pictorial', { axes: { y: { visible: true } } }, 'axes'],
    ['pictorial', { appearance: { dataLabels: true } }, 'appearance.dataLabels'],
    ['pictorial', { tooltip: { crosshair: true } }, 'tooltip.crosshair'],
    ['timeline', { axes: { y: { visible: true } } }, 'axes.y'],
    ['timeline', { axes: { grid: true } }, 'axes.grid'],
    ['variwide', { viewport: { axes: 'xy' } }, 'viewport'],
    ['xrange', { viewport: { axes: 'x', initial: { y: [0, 1] } } }, 'viewport'],
    ['xrange', { axes: { y: { referenceLines: [reference] } } }, 'axes.y.referenceLines'],
    ['pareto', { viewport: { axes: 'y' } }, 'viewport'],
    ['sankey', { viewport: { axes: 'x' } }, 'viewport.axes'],
    ['packedbubble', { viewport: { axes: 'y' } }, 'viewport.axes'],
    ['wordcloud', { tooltip: { crosshair: true } }, ''],
    ['line', { axes: { ticks: true } }, 'axes'],
    ['organization', { layout: { padding: 2 } }, 'layout'],
    ['dendrogram', { format: { unit: 'km' } }, 'format'],
    ['dendrogram', { axes: { ticks: false } }, 'axes'],
    ['dendrogram', { layout: { padding: 0 } }, 'layout'],
    ['violin', { format: { unit: 'kg' } }, 'format'],
    ['violin', { axes: { x: { referenceLines: [reference] } } }, 'axes'],
    ['violin', { layout: { resolution: 31 } }, 'layout.resolution'],
    ['violin', { layout: { resolution: 128.5 } }, 'layout.resolution'],
    ['flame', { axes: { y: { referenceLines: [reference] } } }, 'axes.y.referenceLines'],
    ['parallel', { axes: { x: { visible: false } } }, 'axes'],
    ['parallel', { appearance: { dataLabels: true } }, 'appearance.dataLabels'],
    ['parallel', { layout: { coordinates: 'polar' }, appearance: { minPlotWidth: 520 } }, 'appearance.minPlotWidth'],
    ['parallel', { layout: { padding: 2 } }, 'layout'],
    ['radialbar', { layout: { innerRadiusRatio: 0.81 } }, 'layout.innerRadiusRatio'],
  ];
  for (const [type, options, path] of cases) rejects({ type }, options, path);
  for (const [type, options] of [
    ['heatmap', { appearance: { opacity: 0 } }],
    ['tilemap', { appearance: { opacity: 1 } }],
    ['parallel', { layout: { coordinates: 'cartesian' }, axes: { visible: false, labels: true, ticks: false } }],
    ['dendrogram', { layout: { orientation: 'horizontal' }, axes: { visible: false } }],
    ['violin', { layout: { resolution: 128 } }],
  ]) assert.equal(optionsDiagnostic({ type }, options), null, type);
});

test('Layout controls retain valid endpoints and reject overflows on the represented family', () => {
  const levels = [{ id: 'threshold', value: 5 }];
  const cases = [
    ['pictorial', { gap: 64 }, [{ gap: -1 }, { gap: 65 }], 'gap'],
    ['wordcloud', { maxWords: 128 }, [{ maxWords: 0 }, { maxWords: 129 }, { maxWords: 2.5 }], 'maxWords'],
    ['wordcloud', { seed: 4294967295 }, [{ seed: -1 }, { seed: 4294967296 }, { seed: 1.5 }], 'seed'],
    ['contour', { levels, segmentBudget: 8192 }, [{ levels, segmentBudget: 0 }, { levels, segmentBudget: 8193 }, { levels, segmentBudget: 2.5 }], 'segmentBudget'],
    ['arcdiagram', { nodeRadius: 2 }, [{ nodeRadius: 1 }, { nodeRadius: 25 }], 'nodeRadius'],
    ['arcdiagram', { linkWidth: 48 }, [{ linkWidth: 0 }, { linkWidth: 49 }], 'linkWidth'],
    ['chord', { startAngle: -360 }, [{ startAngle: -361 }, { startAngle: 361 }], 'startAngle'],
    ['chord', { nodePadding: 20 }, [{ nodePadding: -1 }, { nodePadding: 21 }], 'nodePadding'],
    ['sankey', { nodePadding: 64 }, [{ nodePadding: 65 }], 'nodePadding'],
    ['sankey', { nodeWidth: 64 }, [{ nodeWidth: 1 }, { nodeWidth: 65 }], 'nodeWidth'],
    ['bullet', { pointPadding: 0.9 }, [{ pointPadding: -0.1 }, { pointPadding: 0.91 }], 'pointPadding'],
    ['tilemap', { pointPadding: 32 }, [{ pointPadding: 33 }], 'pointPadding'],
    ['xrange', { rowPadding: 0.9 }, [{ rowPadding: -0.01 }, { rowPadding: 0.91 }], 'rowPadding'],
    ['timeline', { labelMaxWidth: 240 }, [{ labelMaxWidth: 23 }, { labelMaxWidth: 241 }], 'labelMaxWidth'],
    ['timeline', { markerRadius: 0 }, [{ markerRadius: -1 }, { markerRadius: 17 }], 'markerRadius'],
    ['dumbbell', { markerRadius: 1 }, [{ markerRadius: 0 }], 'markerRadius'],
    ['item', { columns: 32 }, [{ columns: 0 }, { columns: 33 }, { columns: 3.5 }], 'columns'],
    ['variablepie', { minRadiusRatio: 1 }, [{ minRadiusRatio: -0.1 }, { minRadiusRatio: 1.1 }], 'minRadiusRatio'],
    ['boxplot', { whiskerWidth: 0 }, [{ whiskerWidth: -0.1 }, { whiskerWidth: 1.1 }], 'whiskerWidth'],
    ['errorbar', { capWidth: 1 }, [{ capWidth: -0.1 }, { capWidth: 1.1 }], 'capWidth'],
    ['funnel', { neckWidth: 0, neckHeight: 1 }, [{ neckWidth: -0.1 }, { neckWidth: 1.1 }], 'neckWidth'],
  ];
  for (const [type, valid, bad, property] of cases) {
    const data = { type };
    assert.equal(optionsDiagnostic(data, { layout: valid }), null, type);
    for (const layout of bad) rejects(data, { layout }, 'layout.' + property);
  }
  for (const [type, layout, path] of [
    ['pictorial', { stackLabels: true }, 'layout.stackLabels'],
    ['tilemap', { stacking: 'sum' }, 'layout'],
    ['contour', { levels, gap: 2 }, 'layout.gap'],
    ['contour', { levels, orientation: 'horizontal' }, 'layout'],
    ['chord', { stacking: 'sum' }, 'layout'],
    ['variwide', { stackLabels: true }, 'layout'],
    ['timeline', { stackLabels: true }, 'layout'],
    ['timeline', { grouping: 'overlap' }, 'layout.grouping'],
    ['xrange', { labelPosition: 'above' }, 'layout.labelPosition'],
    ['item', { stacking: 'sum' }, 'layout'],
    ['funnel', { stackLabels: true }, 'layout'],
    ['pyramid', { neckHeight: 0.5 }, 'layout'],
  ]) rejects({ type }, { layout }, path);
});

test('Reference and series styling are scoped to compatible source axes and identities', () => {
  const mixed = { type: 'mixed', axes: { ...line.axes, secondaryY: { type: 'linear' } } };
  rejects(line, { format: { secondaryUnit: 'L' } }, 'axes.secondaryY');
  rejects(mixed, { axes: { secondaryY: { referenceLines: [{ ...reference, value: 'north' }] } } },
    'axes.secondaryY.referenceLines');
  const repeated = { axes: { x: { referenceLines: [reference] }, secondaryY: { referenceLines: [reference] } } };
  rejects(mixed, repeated, 'axes');
  assert.equal(optionsDiagnostic(mixed, { axes: { secondaryY: { referenceLines: [reference] } } }), null);

  const categories = { ...line, axes: { ...line.axes, x: { type: 'category', values: [{ id: 'north', label: 'North' }] } } };
  const xRef = value => ({ axes: { x: { referenceLines: [{ ...reference, value }] } } });
  assert.equal(optionsDiagnostic(categories, xRef('north')), null);
  rejects(categories, xRef('missing'), 'axes.x.referenceLines.0.value');
  rejects(categories, xRef(0), 'axes.x.referenceLines.0.value');
  rejects(line, xRef('north'), 'axes.x.referenceLines.0.value');

  const contour = { type: 'contour' };
  const contourLayout = { levels: [{ id: 'threshold', value: 5 }] };
  const series = id => ({ color: '#448877', id });
  assert.equal(optionsDiagnostic(contour, { layout: contourLayout, appearance: { series: [series('threshold')] } }), null);
  rejects(contour, { layout: contourLayout, appearance: { series: [series('missing')] } }, 'appearance.series');
  rejects(contour, { layout: contourLayout, viewport: { initial: { x: { firstId: 'a', lastId: 'b' } } } }, 'viewport.initial.x');
  rejects({ type: 'gauge' }, { appearance: { series: [series('threshold')] } }, 'appearance.series');
  assert.equal(optionsDiagnostic({ type: 'gauge' }, { appearance: { series: [series('reading')] } }), null);
  rejects({ type: 'gauge' }, { appearance: { dataLabels: true } }, 'appearance.dataLabels');
  assert.equal(optionsDiagnostic(line, { appearance: { minPlotWidth: 1600 } }), null);
  rejects(line, { appearance: { minPlotWidth: 1601 } }, 'appearance.minPlotWidth');
  rejects({ type: 'pie' }, { appearance: { minPlotWidth: 640 } }, 'appearance.minPlotWidth');
});

test('Stack groups partition original series and reference bands preserve the source axis type', () => {
  const columns = {
    type: 'column',
    axes: {
      x: { type: 'category', values: [{ id: 'a', label: 'North' }, { id: 'b', label: 'South' }] },
      y: line.axes.y,
    },
    series: ['first', 'second'].map(id => ({ id, name: id, data: [{ id: 'a', x: 'a', y: 1 }, { id: 'b', x: 'b', y: 2 }] })),
  };
  const first = { id: 'actual', label: 'Actual', seriesIds: ['first'] };
  const second = { id: 'projected', label: 'Projected', seriesIds: ['second'] };
  const stack = stackGroups => ({ layout: { stacking: 'sum', stackGroups } });
  assert.equal(optionsDiagnostic(columns, stack([first, second])), null);
  rejects(columns, stack([]), 'layout.stackGroups');
  rejects(columns, stack([first]), 'layout.stackGroups');
  rejects(columns, stack([first, { ...second, seriesIds: ['first'] }]), 'layout.stackGroups');
  rejects(columns, stack([first, { ...second, id: first.id }]), 'layout.stackGroups.1');
  rejects(columns, stack([first, { ...second, seriesIds: ['second', 'second'] }]), 'layout.stackGroups.1.seriesIds.1');
  rejects(columns, { layout: { stackGroups: [first, second] } }, 'layout.stackGroups');
  const xBand = (from, to) => ({ axes: { x: { referenceBands: [{ ...band, from, to }] } } });
  assert.equal(optionsDiagnostic(columns, xBand('a', 'b')), null);
  rejects(columns, xBand('b', 'a'), 'axes.x.referenceBands.0');
  rejects(columns, xBand(0, 1), 'axes.x.referenceBands.0');
  const time = { ...line, axes: { ...line.axes, x: { type: 'time' } } };
  rejects(time, xBand(0, 1.5), 'axes.x.referenceBands.0');
  rejects(time, xBand(0, 9e15), 'axes.x.referenceBands.0');
  assert.equal(optionsDiagnostic(time, xBand(0, 3600000)), null);
});

test('Native accepts bounded text weights and validates nested style shape before reading properties', () => {
  for (const fontWeight of [400, 500, 600, 700]) {
    assert.equal(optionsDiagnostic(line, { appearance: { title: { fontWeight }, subtitle: { fontWeight } } }), null);
  }
  for (const fontWeight of [300, 650, '700', Infinity]) {
    rejects(line, { appearance: { title: { fontWeight } } }, 'appearance.title.fontWeight');
  }
  const title = Object.defineProperty({}, 'fontWeight', { get() { assert.fail('Accessor executed'); } });
  rejects(line, { appearance: { title } }, 'appearance.title.fontWeight');
  for (const title of [undefined, Object.assign(Object.create(null), { fontWeight: 600 })]) {
    assert.equal(optionsDiagnostic(line, { appearance: { title } }), null);
  }
  rejects(line, { appearance: { title: new Date() } }, 'appearance.title');
  rejects(line, { appearance: false }, 'appearance');
});

test('Native rejects malformed owned array entries and duplicate IDs at the original index', () => {
  const trap = () => Object.defineProperty(Array(1), 0, { get() { assert.fail('Accessor executed'); } });
  const colorAxis = stops => ({ colorAxis: { scale: { type: 'continuous', stops } } });
  const contour = levels => ({ layout: { levels } });
  const bullet = bands => ({ layout: { bands } });
  const series = entries => ({ appearance: { series: entries } });
  const bands = referenceBands => ({ axes: { y: { referenceBands } } });
  const references = referenceLines => ({ axes: { y: { referenceLines } } });
  const range = { id: 'low', from: 0, to: 10 };
  const threshold = { id: 'threshold', value: 5 };
  const swatch = { id: 'sales', color: '#336677' };
  const tile = { type: 'tilemap' }, isoline = { type: 'contour' }, target = { type: 'bullet' };
  const cases = [
    [tile, colorAxis(Object.assign(trap(), { 1: { at: 1, color: '#223344' } })), 'colorAxis.scale.stops.0'],
    [isoline, contour(trap()), 'layout.levels.0'],
    [isoline, contour(Array(1)), 'layout.levels.0'],
    [isoline, contour([{ id: false, value: 5 }]), 'layout.levels.0.id'],
    [isoline, contour([threshold, { ...threshold, value: 6 }]), 'layout.levels.1'],
    [isoline, contour([{ ...threshold, id: 'b'.repeat(129) }]), 'layout.levels.0'],
    [isoline, contour([{ id: 'missing-value' }]), 'layout.levels.0'],
    [target, bullet(trap()), 'layout.bands.0'],
    [target, bullet([{ ...range, color: 'transparent' }]), 'layout.bands.0.color'],
    [target, bullet([range, { ...range, from: 10, to: 20 }]), 'layout.bands.1'],
    [line, series(trap()), 'appearance.series.0'],
    [line, series(Array(17).fill(swatch)), 'appearance.series'],
    [line, series([{ ...swatch, id: 'b'.repeat(129) }]), 'appearance.series.0'],
    [line, series([{ ...swatch, color: 100 }]), 'appearance.series.0.color'],
    [line, bands([{ ...band, label: 'b'.repeat(201) }]), 'axes.y.referenceBands.0.label'],
    [line, bands(Array(1)), 'axes.y.referenceBands.0'],
    [line, references(Array(17).fill(reference)), 'axes.y.referenceLines'],
    [line, references([{ id: '', value: 0 }]), 'axes.y.referenceLines.0'],
    [line, references([{ id: 'threshold' }]), 'axes.y.referenceLines.0'],
  ];
  for (const [data, options, path] of cases) rejects(data, options, path);
  assert.equal(optionsDiagnostic(isoline, contour([threshold, { id: 'high', value: 6 }])), null);
  assert.equal(optionsDiagnostic(target, bullet([{ ...range, label: 'Approaching target' }])), null);
});

test('Native reports incompatible display options before they can change the meaning of observations', () => {
  for (const [type, options, path] of [
    ['pie', { appearance: { axisLabelLayout: 'truncate' } }, 'appearance.axisLabelLayout'],
    ['variwide', { viewport: { initial: { x: [0, 1] } } }, 'viewport'],
    ['pareto', { viewport: { initial: { y: [0, 1] } } }, 'viewport'],
    ['venn', { layout: { minFontSize: 20 } }, 'layout'],
    ['wordcloud', { layout: { rotations: [] } }, 'layout.rotations'],
    ['wordcloud', { layout: { minFontSize: 3 } }, 'layout.minFontSize'],
    ['wordcloud', { layout: { maxFontSize: 129 } }, 'layout.maxFontSize'],
    ['wordcloud', { layout: { padding: 17 } }, 'layout.padding'],
    ['parallel', { format: { unit: 'kg' } }, 'format'],
    ['vector', { format: { unit: 'km' } }, 'format'],
    ['flame', { legend: { visible: true } }, 'legend'],
    ['pie', { tooltip: { content: 'shared' } }, 'tooltip.content'],
    ['pie', { tooltip: { crosshair: false } }, 'tooltip.crosshair'],
    ['pie', { appearance: { markers: { visible: false } } }, 'appearance'],
    ['area', { layout: { stackLabels: true } }, 'layout.stackLabels'],
  ]) rejects({ type }, options, path);
});

test('Native keeps chart-specific layouts, references and styling on their own axes and families', () => {
  const levels = [{ id: 'valid', value: 3 }];
  const cases = [
    ['tilemap', { appearance: { dataLabelLayout: 'all' } }, 'appearance.dataLabelLayout'],
    ['pie', { layout: { style: 'needle' } }, 'layout'],
    ['radialbar', { layout: { grouping: 'grouped' } }, 'layout'],
    ['column', { layout: { normalization: 'area' } }, 'layout.normalization'],
    ['column', { layout: { bandwidth: 1 } }, 'layout.bandwidth'],
    ['column', { layout: { coordinates: 'polar' } }, 'layout.coordinates'],
    ['column', { layout: { gapRatio: .5 } }, 'layout.gapRatio'],
    ['column', { layout: { padding: 2 } }, 'layout.padding'],
    ['column', { layout: { orientation: 'horizontal' } }, 'layout.orientation'],
    ['column', { layout: { tileShape: 'hexagon' } }, 'layout.tileShape'],
    ['column', { layout: { levels } }, 'layout.levels'],
    ['column', { layout: { bands: [] } }, 'layout.bands'],
    ['column', { layout: { splitSeries: true } }, 'layout.splitSeries'],
    ['column', { layout: { radiusScale: 'area' } }, 'layout.radiusScale'],
    ['wordcloud', { layout: { orientation: 'vertical' } }, 'layout'],
    ['contour', { layout: { levels: Array.from({ length: 9 }, (_, i) => ({ id: 'level-' + i, value: i })) } }, 'layout.levels'],
    ['pareto', { appearance: { points: [{ seriesId: 'values', pointId: 'north', color: '#345678' }] } }, 'appearance.points'],
    ['radar', { axes: { y: { referenceLines: [reference] } } }, 'axes'],
    ['scatter', { axes: { x: { referenceBands: [band] }, y: { referenceBands: [band] } } }, 'axes'],
    ['polar', { axes: { y: { referenceBands: [band] } } }, 'axes'],
  ];
  for (const [type, options, path] of cases) rejects({ type }, options, path);

  const row = { id: 'stack', label: 'Stack', seriesIds: ['sales'] };
  rejects({ ...line, type: 'column' }, { layout: { stacking: 'sum', stackGroups: Array(1) } }, 'layout.stackGroups.0');
  rejects({ ...line, type: 'column' }, { layout: { stacking: 'sum', stackGroups: [{ ...row, seriesIds: Array(1) }] } },
    'layout.stackGroups.0.seriesIds.0');
  rejects(line, { appearance: { title: { fontSize: 9 } } }, 'appearance.title.fontSize');
  rejects(line, { viewport: { initial: { x: { firstId: 'a', lastId: true } } } }, 'viewport.initial.x.lastId');
  rejects(line, { appearance: { title: { [Symbol('metadata')]: true } } }, 'appearance.title.Symbol(metadata)');
  rejects(line, { appearance: { title: { align: 'left', color: '#123456', fontWeight: 400, fontSize: 16, other: true } } },
    'appearance.title');
});
