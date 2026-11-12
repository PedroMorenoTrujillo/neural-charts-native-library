import assert from 'node:assert/strict';
import {test} from 'node:test';
import {NativeChartSession} from '../dist/library/index.js';
import {planNativeChart} from '../dist/native/plan.js';

test('compiled planner preserves zero and skips missing data during selection', () => {
  const result = planNativeChart({
    family: 'line',
    title: 'Visits',
    axes: {
      x: {type: 'category', values: [
        {id: 'mon', label: 'Mon'}, {id: 'tue', label: 'Tue'}, {id: 'wed', label: 'Wed'},
      ]},
      y: {type: 'linear'},
    },
    series: [{id: 'visits', name: 'Visits', data: [
      {id: 'mon', x: 'mon', y: 29},
      {id: 'wed', x: 'wed', y: 0},
    ]}],
  }, {width: 360, height: 280});
  assert.equal(result.status, 'ok', result.status === 'invalid' ? JSON.stringify(result.diagnostic) : undefined);
  assert.deepEqual(result.scene.observations.map(({id, value}) => [id.pointId, value]), [
    ['mon', 29], ['wed', 0],
  ]);
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
    session.step(1);
    assert.deepEqual(snapshots.at(-1)?.selected, {seriesId: 'visits', pointId: 'wed'});
    session.clear();
    assert.equal(session.snapshot.selected, null);
  } finally {
    session.destroy();
  }
});

test('compiled planner rejects a malformed chart', () => {
  assert.equal(planNativeChart({family: 'line'}, {width: 360, height: 280}).status, 'invalid');
});
