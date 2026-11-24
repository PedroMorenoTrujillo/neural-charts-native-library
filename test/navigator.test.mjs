import assert from 'node:assert/strict';
import {test} from 'node:test';
import {moveNavigatorEdge,navigatorOverview,navigatorRange,navigatorViewport} from '../dist/native/navigator-range.js';
import {planNativeChart} from '../dist/native/plan.js';

const spec={family:'line',title:'History',axes:{x:{type:'linear',domain:[0,100]},y:{type:'linear',domain:[0,100]}},
  series:[{id:'load',name:'Load',data:[{id:'before',x:0,y:10},{id:'middle',x:50,y:45},{id:'after',x:100,y:75}]}]};
function window(value,axes='xy'){
  const result=planNativeChart(spec,{width:320,height:220,viewport:{axes,value}});
  assert.equal(result.status,'ok');
  assert.ok(result.viewport);
  return result.viewport;
}

test('the navigator reads a planned range and preserves Y when changing or resetting X',()=>{
  const state=window({x:[10,70],y:[20,80]});
  const range=navigatorRange(state);
  assert.deepEqual(range.domain,[0,100]);
  assert.deepEqual(range.value,[10,70]);
  assert.deepEqual(moveNavigatorEdge(range,0,-30),[0,70]);
  assert.deepEqual(moveNavigatorEdge(range,1,120),[10,100]);
  assert.ok(moveNavigatorEdge(range,1,-Infinity)===range.value);
  const narrowed=moveNavigatorEdge(range,0,97);
  assert.ok(narrowed[0]<narrowed[1]);
  assert.deepEqual(navigatorViewport(state,[5,75]),{x:[5,75],y:[20,80]});
  assert.deepEqual(navigatorViewport(state,[0,100]),{y:[20,80]});
  assert.deepEqual(navigatorViewport(state),{y:[20,80]});
  assert.deepEqual(navigatorRange(window({y:[20,80]})).value,[0,100]);
  assert.equal(navigatorRange(window({y:[20,80]},'y')),undefined);
});

test('time handles snap to milliseconds and clamp against planner limits',()=>{
  const state=window({x:[10,70]});
  const bounds={...state.bounds,x:{type:'time',domain:[0,100],limits:{minSpan:3}}};
  const range=navigatorRange({...state,bounds});
  assert.equal(range.time,true);
  assert.deepEqual(moveNavigatorEdge(range,0,24.7),[25,70]);
  assert.deepEqual(moveNavigatorEdge(range,1,11),[10,13]);
});

test('overview bounds the display path, retains peaks and shows a gap for missing values',()=>{
  const points=Array.from({length:1024},(_,x)=>({x,y:x===75?40:x===600?null:x===882?-5:2}));
  const path=navigatorOverview(points,[0,1023]);
  assert.ok(path.length>10);
  assert.ok((path.match(/[ML]/g)??[]).length<=160);
  assert.ok((path.match(/M/g)??[]).length>1);
  assert.match(path,/ 4\.00/);
  assert.match(path,/ 32\.00/);
  assert.doesNotMatch(path,/NaN|Infinity|null/);
  assert.equal(navigatorOverview([{x:'date',y:1},{x:5,y:null}],[0,100]),'');
});
