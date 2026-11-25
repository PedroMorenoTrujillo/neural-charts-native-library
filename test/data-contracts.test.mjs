import assert from 'node:assert/strict';
import test from 'node:test';
import { planChartData } from '../dist/native/data-planning.js';
import { sameInteractionContent } from '../dist/library/interaction-content.js';

function rejectData(data, path, reason = 'PRESENTATION_IN_DATA') {
  const result = planChartData(data);
  assert.equal(result.status, 'invalid');
  assert.equal(result.diagnostic.reason, reason, path);
  assert.equal(result.diagnostic.path, path);
}

test('Native data rejects presentation fields before they can alter the source contract', () => {
  const keys = {
    fan: ['centerName', 'centerColor'],
    flame: ['rowPadding'],
    violin: ['bandwidth', 'resolution', 'normalization', 'gapRatio'],
    dendrogram: ['orientation'],
    parallel: ['coordinates'],
    windrose: ['gapRatio', 'innerRadiusRatio', 'stacking'],
    heatmap: ['gapRatio', 'opacity', 'colorAxis'],
    venn: ['padding'],
    wordcloud: ['minFontSize', 'maxFontSize', 'padding', 'rotations', 'seed', 'maxWords'],
    pictorial: ['pictorial'],
    tilemap: ['tileShape', 'pointPadding', 'opacity', 'colorAxis'],
    contour: ['contour', 'levels', 'segmentBudget'],
    chord: ['startAngle', 'nodePadding', 'nodeWidth', 'reversed', 'nodeRadius', 'linkWidth'],
    variablepie: ['columns', 'minRadiusRatio', 'radiusScale'],
    timeline: ['grouping', 'rowPadding', 'labelPosition', 'labelMaxWidth', 'markerRadius'],
    bullet: ['orientation', 'pointPadding', 'bands'],
    packedbubble: ['splitSeries'],
    funnel: ['neckWidth', 'neckHeight', 'reversed'],
    boxplot: ['whiskerWidth', 'capWidth', 'markerRadius'],
  };
  for (const [type, fields] of Object.entries(keys)) {
    for (const key of fields) rejectData({ type, [key]: undefined }, 'data.' + key);
  }
  rejectData({ type: 'violin', groups: [{ color: '#336699' }] }, 'data.groups.0.color');
  rejectData({ type: 'fan', bands: [{ color: '#336699' }] }, 'data.bands.0.color');
  rejectData({ type: 'line', axes: { y: { labels: false } } }, 'data.axes.y.labels');
  rejectData({ type: 'line', series: [{ markers: true }] }, 'data.series.0.markers');
  rejectData({ type: 'line', series: [{ dash: 'dash' }] }, 'data.series.0.dash');
  rejectData({ type: 'line', series: [{ data: [{ datum: {} }] }] }, 'data.series.0.data.0.datum');
  rejectData({ type: 'pie', data: [{ datum: {} }] }, 'data.data.0.datum');
});

test('Native data limits source sizes and declines accessor-backed plot inputs without invoking them', () => {
  const fail = () => assert.fail('Native called a source accessor');
  const getter = (key, target = {}) => Object.defineProperty(target, key, { get: fail });
  rejectData(null, 'data', 'INVALID_DATA_TYPE');
  rejectData({ type: 'bar' }, 'data.type', 'INVALID_DATA_TYPE');
  rejectData({ family: 'line', type: 'line' }, 'data.family', 'LEGACY_DATA_DISCRIMINATOR');
  rejectData(getter('type'), 'data');
  rejectData({ type: 'line', axes: getter('x') }, 'data.axes.x');
  rejectData({ type: 'line', series: [getter('data')] }, 'data.series.0.data');
  rejectData({ type: 'fan', bands: getter('0', []) }, 'data.bands.0');
  rejectData({ type: 'timeline', series: [getter('id')] }, 'data.series.0.id');
  rejectData({ type: 'line', series: [{ data: getter('0', []) }] }, 'data.series.0.data.0');
  rejectData({ type: 'timeline', series: [{ id: 'a'.repeat(129) }] }, 'data.series.0.id', 'SERIES_ID_LIMIT');

  for (const [type, field, length] of [
    ['fan', 'bands', 7], ['fan', 'data', 1025], ['regression', 'series', 9],
    ['heatmap', 'data', 4097], ['flame', 'data', 2049], ['pareto', 'data', 65], ['line', 'series', 17],
  ]) rejectData({ type, [field]: Array(length) }, 'data.' + field, 'INPUT_LIMIT');
  rejectData({ type: 'line', series: [{ data: Array(5001) }, { data: Array(5000) }] }, 'data.series', 'INPUT_LIMIT');
});

test('A refreshed interaction announces changes to represented values and metadata without duplicating geometry updates', () => {
  const active = {
    id: { seriesId: 'measurements', pointId: 'sample-a' }, label: 'Sample A', seriesName: 'Readings',
    value: 4, x: 30, y: 50, color: '#336699',
  };
  const snapshot = (point, shared) => ({ active: point, selected: point?.id ?? null, scrubbing: false, shared });
  const first = snapshot(active);
  assert.equal(sameInteractionContent(first, snapshot({ ...active, id: { ...active.id }, x: 75, y: 91 })), true);
  assert.equal(sameInteractionContent(first, snapshot(null)), false);
  assert.equal(sameInteractionContent(first, { ...first, pinned: true }), false);
  assert.equal(sameInteractionContent(first, { ...first, scrubbing: true }), false);
  for (const change of [
    { id: { ...active.id, pointId: 'sample-b' } }, { label: 'Renamed' }, { seriesName: 'Renamed series' }, { value: 0 },
    { yValue: 2 }, { minimumValue: 0 }, { q1Value: 0 }, { medianValue: 0 }, { q3Value: 0 }, { maximumValue: 0 },
    { lowValue: 0 }, { highValue: 0 }, { valueUnit: 'kg' }, { subtotal: true }, { incomplete: true },
    { color: '#334455' }, { xValue: 0 }, { sizeValue: 0 }, { percentage: 0 }, { wind: { direction: null } },
    { vector: { dx: 1, dy: 0 } }, { node: { incoming: 1, outgoing: 0, directed: false } },
  ]) assert.equal(sameInteractionContent(first, snapshot({ ...active, ...change })), false, JSON.stringify(change));

  const shared = { key: 'a', label: 'A', coordinate: 2, rows: [{ seriesId: 'measurements', name: 'Readings', color: '#336699', point: active }] };
  const selected = snapshot(active, shared);
  const revised = (patch = {}, row = {}) => snapshot(active, { ...shared, rows: [{ ...shared.rows[0], ...row }], ...patch });
  assert.equal(sameInteractionContent(selected, revised({ coordinate: 25 })), true);
  for (const update of [
    first, revised({ key: 'b' }), revised({ label: 'B' }), revised({ rows: [] }),
    revised({}, { seriesId: 'other' }), revised({}, { name: 'Other series' }), revised({}, { color: '#112233' }),
    revised({}, { point: null }),
  ]) assert.equal(sameInteractionContent(selected, update), false);
});

test('Changing a tile name, source coordinate or color classification republishes the selected tile', () => {
  const tilemap = { sourceX: 0, sourceY: 1, name: 'Region', color: { type: 'continuous', color: '#336699', ratio: 0.5, clamped: false } };
  const make = tile => ({
    active: { id: { seriesId: 'tilemap', pointId: 'north' }, label: 'North', seriesName: 'Regions', value: 2, tilemap: tile },
    selected: null, scrubbing: false,
  });
  assert.equal(sameInteractionContent(make(tilemap), make(structuredClone(tilemap))), true);
  for (const tile of [
    undefined, { ...tilemap, sourceX: 1 }, { ...tilemap, sourceY: 2 }, { ...tilemap, name: 'Changed' },
    { ...tilemap, classLabel: 'High' }, { ...tilemap, color: { ...tilemap.color, color: '#112233' } },
    { ...tilemap, color: { ...tilemap.color, ratio: 0.8 } }, { ...tilemap, color: { ...tilemap.color, clamped: true } },
  ]) assert.equal(sameInteractionContent(make(tilemap), make(tile)), false);
  const classified = id => make({ ...tilemap, color: { type: 'class', color: '#336699', classId: id } });
  assert.equal(sameInteractionContent(classified('low'), classified('low')), true);
  assert.equal(sameInteractionContent(classified('low'), classified('high')), false);
});
