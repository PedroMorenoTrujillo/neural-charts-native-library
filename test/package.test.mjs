import assert from 'node:assert/strict';
import {test} from 'node:test';
import {NativeChartSession} from '../dist/library/index.js';
import {planNativeChart} from '../dist/native/plan.js';

test('compiled planner and interaction share stable selection IDs', () => {
  const result = planNativeChart({
    family: 'line',
    title: 'Visits',
    axes: {x: {type: 'linear'}, y: {type: 'linear'}},
    series: [{id: 'visits', name: 'Visits', data: [
      {id: 'mon', x: 1, y: 29},
      {id: 'tue', x: 2, y: 35},
    ]}],
  }, {width: 360, height: 280});
  assert.equal(result.status, 'ok', result.status === 'invalid' ? JSON.stringify(result.diagnostic) : undefined);
  const snapshots = [];
  const session = new NativeChartSession(result.scene, {
    request: () => 1,
    cancel: () => {},
  }, {
    allowed: () => false,
    selection: () => assert.fail('Haptics are disabled'),
  }, snapshot => snapshots.push(snapshot));
  try {
    session.step('first');
    assert.deepEqual(session.snapshot.selected, {seriesId: 'visits', pointId: 'mon'});
    session.step('last');
    assert.deepEqual(snapshots.at(-1)?.selected, {seriesId: 'visits', pointId: 'tue'});
    session.clear();
    assert.equal(session.snapshot.selected, null);
  } finally {
    session.destroy();
  }
});

test('compiled planner rejects a malformed chart', () => {
  assert.equal(planNativeChart({family: 'line'}, {width: 360, height: 280}).status, 'invalid');
});
