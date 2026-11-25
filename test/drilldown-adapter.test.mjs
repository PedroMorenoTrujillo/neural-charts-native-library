import assert from 'node:assert/strict';
import test from 'node:test';
import { ownDrilldownGraph } from '../dist/native/drilldown-state.js';

const summary = {
  type: 'column',
  axes: {
    x: { type: 'category', values: [{ id: 'a', label: 'North' }, { id: 'b', label: 'South' }] },
    y: { type: 'linear', domain: [0, 100] },
  },
  series: [{ id: 'sales', name: 'Sales', data: [{ id: 'a', x: 'a', y: 0 }, { id: 'b', x: 'b', y: 60 }] }],
};
const detail = { type: 'pie', data: [{ id: 'source', label: 'Source', value: 12 }] };
const graph = {
  rootId: 'overview',
  nodes: [{ id: 'overview', data: summary }, { id: 'detail', data: detail }],
  links: [{ fromNodeId: 'overview', datumId: { seriesId: 'sales', pointId: 'a' }, toNodeId: 'detail' }],
};
const initial = { x: { firstId: 'a', lastId: 'b' }, y: [20, 75] };
const rootOptions = { viewport: { axes: 'xy', initial }, format: { unit: 'kg' } };

function graphFor(options, source = graph) {
  const result = ownDrilldownGraph(source, options);
  assert.equal(result.status, 'ok', JSON.stringify(result.error));
  return result.value;
}

test('Drilldown merges presentation for each physical chart while retaining coordinate semantics', () => {
  const globalOptions = {
    appearance: { locale: 'es', theme: 'dark' },
    animation: { enabled: true, durationMs: 250 },
    interaction: { haptics: false, selectionControls: true },
    nodes: { overview: rootOptions, detail: { title: 'Original breakdown', appearance: { locale: 'en' } } },
  };
  const owned = graphFor(globalOptions);
  assert.equal(owned.options.size, 2);
  assert.equal(owned.options.has('overview'), true);
  assert.equal(owned.options.has('missing'), false);
  assert.deepEqual([...owned.options.keys()], ['overview', 'detail']);
  assert.deepEqual([...owned.options.values()].map(value => value.appearance.locale), ['es', 'en']);
  assert.deepEqual([...owned.options.entries()], [...owned.options]);
  const visited = [];
  owned.options.forEach(function (value, id, owner) {
    assert.equal(this, visited);
    assert.equal(owner, owned.options);
    assert.equal(value, owner.get(id));
    visited.push(id);
  }, visited);
  assert.deepEqual(visited, ['overview', 'detail']);
  assert.deepEqual(owned.options.get('detail').appearance, { theme: 'dark', locale: 'en' });
  assert.deepEqual(owned.options.get('detail').interaction, { haptics: false, selectionControls: true });

  const changedPresentation = graphFor({
    ...globalOptions, animation: { enabled: false }, nodes: { overview: { ...rootOptions, title: 'Renamed' } },
  });
  const changedUnits = graphFor({ ...globalOptions, nodes: { overview: { ...rootOptions, format: { unit: 'L' } } } });
  const changedRange = graphFor({ nodes: { overview: { viewport: { axes: 'xy', initial: { ...initial, y: [30, 80] } } } } });
  const stacked = graphFor({ nodes: { overview: { layout: {
    stacking: 'sum', stackGroups: [{ id: 'actual', label: 'Actual', seriesIds: ['sales'] }],
  } } } });
  const root = owned.semantics.get('overview');
  assert.equal(changedPresentation.semantics.get('overview'), root);
  assert.notEqual(changedUnits.semantics.get('overview'), root);
  assert.notEqual(changedRange.semantics.get('overview'), root);
  assert.notEqual(stacked.semantics.get('overview'), root);
  assert.deepEqual(JSON.parse(stacked.semantics.get('overview')).stackGroups, [{ id: 'actual', seriesIds: ['sales'] }]);
});

test('Drilldown errors name the failing node and reject unsafe option containers', () => {
  const invalid = (options, reason, path, nodeId = null) => {
    const result = ownDrilldownGraph(graph, options);
    assert.equal(result.status, 'invalid', JSON.stringify(options));
    assert.equal(result.error.nodeId, nodeId);
    assert.equal(result.error.diagnostic.reason, reason);
    assert.equal(result.error.diagnostic.path, path);
  };
  const malformed = 'INVALID_DRILLDOWN_CONFIG';
  invalid(null, malformed, 'options');
  invalid({ appearance: ['es'] }, malformed, 'options');
  invalid({ animation: new Date(0) }, malformed, 'options');
  invalid({ [Symbol('unexpected')]: true }, malformed, 'options');
  invalid({ silent: true }, malformed, 'options');
  invalid({ appearance: { locale: 'invalid' } }, 'INVALID_CHART_OPTION', 'options.appearance.locale');
  invalid({ nodes: { missing: { title: 'Unavailable' } } }, 'UNKNOWN_DRILLDOWN_NODE_OPTIONS', 'options');
  invalid({ nodes: { detail: { viewport: { axes: 'x' } } } }, 'INVALID_CHART_OPTION', 'options.nodes.detail.viewport', 'detail');
  invalid({ nodes: { overview: { viewport: { initial: { y: [80, 20] } } } } },
    'INVALID_CHART_OPTION', 'options.nodes.overview.viewport.initial.y', 'overview');
  const badAccessor = Object.defineProperty({}, 'title', { get() { assert.fail('Option accessor executed'); } });
  invalid({ nodes: { detail: badAccessor } }, malformed, 'options.nodes.detail', 'detail');
  const invalidSource = ownDrilldownGraph({ ...graph, rootId: 'missing' }, {});
  assert.equal(invalidSource.status, 'invalid');
  assert.equal(invalidSource.error.diagnostic.path, 'data.rootId');
});
