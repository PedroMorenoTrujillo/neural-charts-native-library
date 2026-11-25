import assert from 'node:assert/strict';
import test from 'node:test';
import { dataIdentities } from '../dist/native/data-identities.js';
import { gaugeEntrance } from '../dist/native/gauge-entrance.js';
import { pictorialShapeIssue } from '../dist/native/pictorial-options.js';

test('Native identity lookup limits and owns IDs without reading source values or accessors', () => {
  const guard = () => assert.fail('The identity pass evaluated a source accessor');
  const point = Object.defineProperty({ id: 'same' }, 'y', { get: guard });
  const make = (type, series, ids = ['north']) => ({
    type, series,
    axes: { x: { type: 'category', values: ids.map(id => ({ id })) } },
  });
  const rows = [{ id: 'sales', data: [point] }, { id: 'forecast', data: [point] }];
  const input = make('column', rows);
  const lookup = dataIdentities(input);
  assert.equal(dataIdentities(input), lookup);
  assert.deepEqual([...lookup.series].map(([id, data]) => [id, [...data]]), [['sales', ['same']], ['forecast', ['same']]]);
  assert.deepEqual([...lookup.categories], ['north']);
  assert.equal(dataIdentities({ type: 'histogram' }).xKind, 'category');
  assert.equal(dataIdentities({ type: 'bellcurve' }).xKind, 'linear');
  assert.equal(dataIdentities(make('bullet', rows, ['b'.repeat(256)])).categories.size, 1);
  const invalid = [
    null, 1, { type: 'line' },
    make('column', Array(17).fill(rows[0])),
    make('column', [{ id: '', data: [] }]),
    make('column', [{ id: 'b'.repeat(129), data: [] }]),
    make('column', [{ id: 'sales', data: null }]),
    make('column', [{ id: 'sales', data: Array(10001) }]),
    make('column', [rows[0], rows[0]]),
    make('column', [{ id: 'sales', data: [point, point] }]),
    make('column', [{ id: 'sales', data: [{ id: 'b'.repeat(129) }] }]),
    make('column', [{ id: 'sales', data: [Object.defineProperty({}, 'id', { get: guard })] }]),
    make('column', rows, ['', 'south']),
    make('column', rows, ['north', 'north']),
    make('column', rows, ['b'.repeat(129)]),
    make('variwide', rows, ['b'.repeat(257)]),
    make('column', rows, Array.from({ length: 65 }, (_, i) => String(i))),
    { ...input, axes: { x: { type: 'category', values: null } } },
  ];
  for (const value of invalid) {
    assert.equal(dataIdentities(value), null);
    assert.equal(dataIdentities(value), null);
  }
});

test('Pictorial silhouettes validate serialization budgets and keep topology ownership in Core', () => {
  const mesh = { type: 'mesh', mesh: { vertices: [[0, 0], [1, 0], [0, 1]], triangles: [[0, 1, 2]] } };
  assert.equal(pictorialShapeIssue(mesh), null);
  assert.equal(pictorialShapeIssue({ type: 'preset', name: 'heart' }), null);
  const repeated = {};
  const cycle = {};
  cycle.root = cycle;
  const blocked = Object.defineProperty({}, 'coordinates', { get() { assert.fail('Silhouette accessor executed'); } });
  let deep = true;
  for (let i = 0; i < 9; i++) deep = [deep];
  for (const [input, issue] of [
    [null, /typed preset/],
    [true, /typed preset/],
    [[], /typed preset/],
    [undefined, /typed preset/],
    [{ type: 'mesh' }, /normalized triangle mesh/],
    [{ ...mesh, color: null }, /normalized triangle mesh/],
    [{ type: 'preset', name: 'logo' }, /Choose person/],
    [{ type: 'preset', name: 'heart', precision: 2 }, /Choose person/],
    [{ type: 'preset', name: 'b'.repeat(257) }, /256 characters/],
    [{ type: 'mesh', mesh: [[Infinity, 2]] }, /finite/],
    [{ type: 'mesh', mesh: cycle }, /cycles/],
    [{ type: 'mesh', mesh: [repeated, repeated] }, /repeated object/],
    [{ type: 'mesh', mesh: blocked }, /accessors/],
    [{ type: 'mesh', mesh: new Date() }, /plain objects/],
    [{ type: 'mesh', mesh: Object.setPrototypeOf([1], null) }, /plain objects/],
    [{ type: 'mesh', mesh: { [Symbol('meta')]: 1 } }, /objects exceed/],
    [{ type: 'mesh', mesh: Array(193) }, /arrays exceed/],
    [{ type: 'mesh', mesh: Array.from({ length: 32 }, () => Array(80).fill(0)) }, /safety budget/],
    [{ type: 'mesh', mesh: deep }, /safety budget/],
    [new Proxy({}, { ownKeys() { throw Error('caller proxy'); } }), /could not be read safely/],
  ]) assert.match(pictorialShapeIssue(input), issue);
});

test('Circular gauge entrance consumes the painted arc and rejects malformed or reversed paths', () => {
  const hit = { type: 'sector', radius: 20, cx: 50, cy: 50, start: 0 };
  const frame = (path, overrides = {}) => ({
    family: 'gauge', observations: [{ id: { seriesId: 'reading' }, hit }], series: [{ id: 'reading', path }], ...overrides,
  });
  assert.deepEqual(gaugeEntrance(frame(undefined)), { startRadians: 0, sweepRadians: 0 });
  assert.deepEqual(gaugeEntrance(frame('M50 30 A20 20 0 0 1 70 50 L50 50 Z')), {
    startRadians: 0, sweepRadians: Math.PI / 2,
  });
  assert.deepEqual(gaugeEntrance(frame('M50 30 A20 20 0 1 1 30 50 L50 50 Z')), {
    startRadians: 0, sweepRadians: 3 * Math.PI / 2,
  });
  for (const path of [
    'not-a-path', 'A20 20 0 0 1 70 50', 'M50', 'M1e999 30',
    'M50 15 A20 20 0 0 1 70 50', 'M50 30 M70 50', 'M50 30 A20 20 0 0 0 70 50',
    'M50 30 A20 20 0 2 1 70 50', 'M50 30 A21 20 0 0 1 70 50',
    'M50 30 A20 20 0 0 1 71 50', 'M50 30 A20 20 0 0 1 30 50',
    'M50 30 A20 20 0 1 1 70 50', 'M50 30 A20 20 0 1 1 30 50 A20 20 0 1 1 50 70',
  ]) assert.equal(gaugeEntrance(frame(path)), undefined, path);
  assert.equal(gaugeEntrance(frame(undefined, { family: 'pie' })), undefined);
  assert.equal(gaugeEntrance(frame(undefined, { observations: [] })), undefined);
  assert.equal(gaugeEntrance(frame(undefined, { observations: [{ id: { seriesId: 'reading' }, hit: { ...hit, radius: 0 } }] })), undefined);
});
