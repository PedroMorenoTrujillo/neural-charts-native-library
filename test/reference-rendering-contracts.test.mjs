import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ownReferences, ownReferenceStyles, ownReferenceBands, ownReferenceBandStyles,
  ownPointAppearance, samePointAppearance, sameReferenceStyle, sameReferenceBandStyle,
} from '../dist/library/scene-styles.js';
import {
  nativeReferenceGeometry, nativeReferenceStyles, nativeReferenceBandGeometry, nativeReferenceBandStyles,
  sameReferenceGeometry, sameReferenceStyles, sameReferenceBandGeometry, sameReferenceBandStyles,
  visiblePointAppearance,
} from '../dist/native/reference-options.js';
import { planNativeChart } from '../dist/native/plan.js';

const plot = { family: 'line', width: 100, height: 80 };
const line = { id: 'median', axis: 'y', status: 'visible', line: { x1: 0, y1: 40, x2: 100, y2: 40 } };
const band = { id: 'acceptable', axis: 'y', from: 5, to: 10, status: 'visible', box: { x: 0, y: 20, width: 100, height: 20 } };

test('Reference lines accept exact plot bounds and reject impossible or wrongly transposed geometry', () => {
  assert.deepEqual(ownReferences([line], plot), [line]);
  assert.deepEqual(ownReferences([{ id: 'missing', axis: 'y', status: 'outside' }], plot),
    [{ id: 'missing', axis: 'y', status: 'outside' }]);
  assert.throws(() => ownReferences([line, line], plot), /Duplicate reference/);
  assert.throws(() => ownReferences([line], { ...plot, family: 'donut' }), /Invalid native references/);
  assert.throws(() => ownReferences([{ ...line, status: 'unavailable' }], plot), /Invisible reference/);
  assert.throws(() => ownReferences([{ ...line, status: 'clipped' }], plot), /Invalid reference state/);
  for (const field of ['x1', 'x2', 'y1', 'y2']) {
    for (const value of [-1, 101, Infinity]) {
      assert.throws(() => ownReferences([{ ...line, line: { ...line.line, [field]: value } }], plot), /Invalid reference coordinates/);
    }
  }
  assert.throws(() => ownReferences([{ ...line, line: { ...line.line, y2: 41 } }], plot), /Expected horizontal/);
  assert.throws(() => ownReferences([{ ...line, axis: 'x' }], plot), /Expected vertical/);
  const bar = { ...plot, family: 'bar' };
  const barLine = { ...line, line: { x1: 50, y1: 0, x2: 50, y2: 80 } };
  assert.deepEqual(ownReferences([barLine], bar), [barLine]);
  assert.throws(() => ownReferences([line], bar), /Expected vertical/);
  const mixed = { ...plot, family: 'mixed', mixedAxes: {} };
  const secondary = { ...line, valueAxis: 'secondary' };
  assert.deepEqual(ownReferences([secondary], mixed), [secondary]);
  assert.throws(() => ownReferences([secondary], plot), /Invalid reference value scale/);
  assert.throws(() => ownReferences([{ ...secondary, axis: 'x' }], mixed), /Invalid reference value scale/);
});

test('Reference bands cannot invent visible boxes for unavailable or out-of-domain source ranges', () => {
  assert.deepEqual(ownReferenceBands([band], plot), [band]);
  const category = { ...band, axis: 'x', from: 'a', to: 'a' };
  assert.deepEqual(ownReferenceBands([category], plot), [category]);
  assert.throws(() => ownReferenceBands([band, band], plot), /Duplicate reference band/);
  assert.throws(() => ownReferenceBands([band], { ...plot, family: 'pie' }), /Invalid native reference bands/);
  for (const candidate of [{ ...band, axis: 'value' }, { ...band, status: 'unknown' }, { ...band, valueAxis: 'secondary' }]) {
    assert.throws(() => ownReferenceBands([candidate], plot), /Invalid reference band state/);
  }
  for (const patch of [{ axis: 'y' }, { from: '' }, { to: '' }, { to: 20 }]) {
    assert.throws(() => ownReferenceBands([{ ...category, ...patch }], plot), /Invalid reference band endpoints/);
  }
  for (const patch of [{ from: 10 }, { to: NaN }, { to: 'north' }, { from: {} }]) {
    assert.throws(() => ownReferenceBands([{ ...band, ...patch }], plot), /Invalid reference band endpoints/);
  }
  assert.throws(() => ownReferenceBands([{ ...band, status: 'outside' }], plot), /Invisible reference band/);
  for (const patch of [{ x: -1 }, { y: -1 }, { width: 0 }, { height: 0 }, { width: 101 }, { height: 80 }, { y: Infinity }]) {
    assert.throws(() => ownReferenceBands([{ ...band, box: { ...band.box, ...patch } }], plot), /Invalid reference band coordinates/);
  }
  const { box, ...unavailable } = { ...band, status: 'unavailable' };
  assert.deepEqual(ownReferenceBands([unavailable], plot), [unavailable]);
});

test('Native presentation owns bounded colors and keeps popup text separate from paint', () => {
  const factory = (id, pointId, color) => ({ seriesId: id, pointId, color });
  const points = [factory('b', 'same-point', '#223344'), factory('a', 'same-point', '#334455')];
  const styles = ownPointAppearance(points);
  assert.deepEqual(styles.map(point => point.seriesId), ['a', 'b']);
  assert.deepEqual(points.map(point => point.seriesId), ['b', 'a']);
  assert(samePointAppearance(styles, structuredClone(styles)));
  assert(!samePointAppearance(styles, [{ ...styles[0], pointId: 'other' }, styles[1]]));
  assert(!samePointAppearance(styles, [{ ...styles[0], color: '#445577' }, styles[1]]));
  assert(!samePointAppearance(styles, points));
  assert.throws(() => ownPointAppearance([points[0], points[0]]), /Duplicate point color/);
  for (const point of [factory('', 'a', '#223344'), factory('a', '', '#223344'), factory('a', 'b', 'red')]) {
    assert.throws(() => ownPointAppearance([point]), /Invalid point color/);
  }

  const reference = { id: 'threshold', label: 'Before', color: '#443322', width: 0.5, dash: 'dot' };
  assert.deepEqual(ownReferenceStyles([reference]), [reference]);
  assert(!sameReferenceStyle(reference, { ...reference, label: 'After' }));
  assert(!sameReferenceStyle(reference, { ...reference, dash: 'solid' }));
  for (const patch of [{ label: 'a'.repeat(201) }, { width: '1' }, { width: NaN }, { width: 7 }, { dash: 'dotted' }]) {
    assert.throws(() => ownReferenceStyles([{ ...reference, ...patch }]), /Invalid reference style/);
  }
  const fill = { id: 'range', color: '#445577', opacity: 0 };
  assert.deepEqual(ownReferenceBandStyles([fill]), [fill]);
  assert(!sameReferenceBandStyle(fill, { ...fill, opacity: 0.5 }));
  assert(!sameReferenceBandStyle(fill, { ...fill, label: 'Label' }));
  for (const value of [-0.1, Infinity, 1.1, '0']) {
    assert.throws(() => ownReferenceBandStyles([{ ...fill, opacity: value }]), /Invalid reference band style/);
  }
  const getter = Object.defineProperty([fill], '0', { get() { assert.fail('Accessor executed'); } });
  for (const entries of [getter, Object.assign([fill], { note: true }), Object.assign([fill], { [Symbol('note')]: true })]) {
    assert.throws(() => ownReferenceBandStyles(entries), /Invalid reference band array property/);
  }
  assert.throws(() => ownReferenceBandStyles(Array(1)), /Invalid reference band entry/);
});

test('Native keeps reference palette edits out of the planner cache and distinguishes the secondary value scale', () => {
  const original = { axes: {
    x: { referenceLines: [{ id: 'end', value: 'north' }], referenceBands: [{ id: 'season', from: 'east', to: 'north', color: '#777777' }] },
    y: { referenceLines: [{ id: 'target', value: 40, label: 'Threshold' }], referenceBands: [{ id: 'trend', from: 20, to: 30 }] },
    secondaryY: { referenceLines: [{ id: 'pace', value: 8 }], referenceBands: [{ id: 'capacity', from: 1, to: 5, opacity: 0 }] },
  } };
  const lines = nativeReferenceGeometry(original);
  const bands = nativeReferenceBandGeometry(original);
  assert.deepEqual(lines, [
    { id: 'end', axis: 'x', value: 'north' },
    { id: 'pace', axis: 'y', yAxis: 'secondary', value: 8 },
    { id: 'target', axis: 'y', value: 40 },
  ]);
  assert.deepEqual(bands, [
    { id: 'capacity', axis: 'y', valueAxis: 'secondary', from: 1, to: 5 },
    { id: 'season', axis: 'x', from: 'east', to: 'north' },
    { id: 'trend', axis: 'y', from: 20, to: 30 },
  ]);
  const updated = structuredClone(original);
  updated.axes.secondaryY.referenceLines[0].label = 'Alternative';
  updated.axes.secondaryY.referenceBands[0].opacity = 0.5;
  assert(sameReferenceGeometry(lines, nativeReferenceGeometry(updated)));
  assert(sameReferenceBandGeometry(bands, nativeReferenceBandGeometry(updated)));
  assert(!sameReferenceStyles(nativeReferenceStyles(original), nativeReferenceStyles(updated)));
  assert(!sameReferenceBandStyles(nativeReferenceBandStyles(original), nativeReferenceBandStyles(updated)));
  updated.axes.secondaryY.referenceLines[0].value = 10;
  updated.axes.secondaryY.referenceBands[0].to = 3;
  assert(!sameReferenceGeometry(lines, nativeReferenceGeometry(updated)));
  assert(!sameReferenceBandGeometry(bands, nativeReferenceBandGeometry(updated)));
  assert(!sameReferenceGeometry(lines, lines.slice(1)));
  assert(!sameReferenceBandGeometry(bands, bands.slice(1)));
  assert.throws(() => nativeReferenceBandGeometry({ axes: { x: { referenceBands: [{ id: 'mixed', from: 'east', to: 3 }] } } }), /endpoints/);
});

test('Native preserves configured point colors when their source series goes off the visible window', () => {
  const data = {
    family: 'line', title: 'Readings',
    axes: { x: { type: 'linear', domain: [0, 100] }, y: { type: 'linear', domain: [0, 100] } },
    series: [{ id: 's', name: 'Source', data: [{ id: 'left', x: 0, y: 25 }, { id: 'right', x: 100, y: 75 }] }],
  };
  const appearance = [
    { seriesId: 's', pointId: 'left', color: '#224488' },
    { seriesId: 's', pointId: 'right', color: '#448822' },
  ];
  const prepare = value => planNativeChart(data, { width: 600, height: 320, viewport: { axes: 'x', value } });
  const first = prepare({ x: [0, 40] });
  const second = prepare({ x: [60, 100] });
  assert.equal(first.status, 'ok');
  assert.equal(second.status, 'ok');
  assert.deepEqual(visiblePointAppearance(first.scene, appearance), [appearance[0]]);
  assert.deepEqual(visiblePointAppearance(first.scene, appearance), [appearance[0]]);
  assert.deepEqual(visiblePointAppearance(second.scene, appearance), [appearance[1]]);
  assert.equal(visiblePointAppearance(second.scene, undefined), undefined);
  assert.deepEqual(appearance.map(point => point.pointId), ['left', 'right']);
});
