import assert from 'node:assert/strict';
import test from 'node:test';
import { panelViewportValue, panelXContract, panelXKey } from '../dist/native/panel-viewport-contract.js';
import { sameViewportValue } from '../dist/native/viewport-state.js';

const line = x => ({ type: 'line', axes: { x } });
const viewport = initial => ({ viewport: { axes: 'xy', initial } });

test('Linked native panels require equal original coordinates and ordered category windows', () => {
  const categories = ['north', 'south', 'east'].map(id => ({ id, label: id }));
  const input = { type: 'category', values: categories };
  const source = { x: { firstId: 'south', lastId: 'east' }, y: [-2, 4] };
  const a = panelXContract(line(input), viewport(source));
  const relabeled = { ...input, values: categories.map(item => ({ ...item, label: item.label.toUpperCase() })) };
  const b = panelXContract(line(relabeled), viewport(source));
  assert.equal(a.key, b.key);
  assert.equal(a.initialKey, b.initialKey);
  assert.notEqual(panelXContract(line({ ...input, values: [...categories].reverse() }), { viewport: {} }).key, a.key);
  assert.notEqual(panelXContract(line(input), viewport({ ...source, y: [-3, 4] })).epochKey, a.epochKey);
  assert(Object.isFrozen(a.initial) && Object.isFrozen(a.initial.x) && Object.isFrozen(a.initial.y));
  source.x.firstId = 'north';
  source.y[0] = -9;
  assert.deepEqual(a.initial, { x: { firstId: 'south', lastId: 'east' }, y: [-2, 4] });
  assert.equal(panelXKey(undefined), 'reset');
  assert.equal(panelXContract(line(input), { viewport: {} }).initialKey, 'reset');

  for (const values of [[], [categories[0], categories[0]], [{ id: '' }], [{ id: 'a'.repeat(129) }]]) {
    assert.throws(() => panelXContract(line({ ...input, values }), { viewport: {} }), /unique original IDs/);
  }
  for (const x of [[0, 1], { firstId: 'east', lastId: 'north' }, { firstId: 'missing', lastId: 'east' }]) {
    assert.throws(() => panelXContract(line(input), viewport({ x })), /ordered interval/);
  }
  assert.throws(() => panelXContract({ type: 'pie' }, { viewport: {} }), /line, area, spline/);
  assert.throws(() => panelXContract(line(input), { viewport: { axes: 'y' } }), /enable an X or XY/);
  assert.throws(() => panelXContract(line(input), {}), /enable an X or XY/);
  assert.throws(() => panelXContract(line(input), { viewport: {}, axes: { x: { scale: { type: 'log' } } } }), /Logarithmic/);
});

test('Numeric and UTC windows reject implicit scope, unsupported timestamps and caller accessors', () => {
  const time = { type: 'time', domain: [0, 1000] };
  assert.deepEqual(panelXContract(line(time), viewport({ x: [20, 100] })).initial, { x: [20, 100] });
  for (const domain of [[0, 0.5], [0, 8.64e15 + 1]]) {
    assert.throws(() => panelXContract(line({ ...time, domain }), { viewport: {} }), /integer timestamps/);
  }
  for (const x of [[0.5, 100], [-1, 100], [10, 2000], { firstId: 'a', lastId: 'b' }]) {
    assert.throws(() => panelXContract(line(time), viewport({ x })), /original numeric\/time domain/);
  }
  assert.throws(() => panelXContract(line({ ...time, nice: true }), { viewport: {} }), /nice:false/);
  assert.throws(() => panelXContract(line({ type: 'log' }), { viewport: {} }), /Unsupported linked X/);
  const accessor = () => assert.fail('Caller property was invoked');
  assert.throws(() => panelViewportValue(Object.defineProperty({}, 'x', { get: accessor })), /accessors/);
  assert.throws(() => panelViewportValue({ x: Object.assign([0, 1], { [Symbol('extra')]: 2 }) }), /array property/);
  assert.throws(() => panelViewportValue({ x: Object.defineProperty([0, 1], '0', { get: accessor }) }), /array property/);
  assert.throws(() => panelViewportValue({ x: Array(2) }), /Sparse viewport/);
  assert.throws(() => panelViewportValue({ x: Object.setPrototypeOf([0, 1], null) }), /coordinate array/);
  assert.throws(() => panelViewportValue({ x: [0, Infinity] }), /numeric viewport interval/);
  assert.throws(() => panelViewportValue({ x: { firstId: 'a', lastId: '' } }), /category viewport interval/);
  assert.throws(() => panelViewportValue({ y: { firstId: 'a', lastId: 'b' } }), /must remain numeric/);
});

test('Native window equality distinguishes missing, numeric and category bounds without rolling data', () => {
  const a = { x: { firstId: 'a', lastId: 'b' }, y: [20, 80] };
  assert.equal(sameViewportValue(a, structuredClone(a)), true);
  assert.equal(sameViewportValue(a, {}), false);
  assert.equal(sameViewportValue(a, { ...a, x: [0, 1] }), false);
  assert.equal(sameViewportValue(a, { ...a, x: { ...a.x, lastId: 'c' } }), false);
  assert.equal(sameViewportValue(a, { ...a, x: { ...a.x, firstId: 'b' } }), false);
  assert.equal(sameViewportValue(a, { ...a, y: [21, 80] }), false);
  assert.equal(sameViewportValue(a, { ...a, y: [20, 100] }), false);
});
