import assert from 'node:assert/strict';
import {test} from 'node:test';
import {planChartData} from '../dist/native/data-planning.js';
import {chartEmptyState,showVariwideSourceWarning} from '../dist/library/empty-state.js';

const data=width=>({
  type:'variwide',
  axes:{x:{type:'category',values:[{id:'north',label:'North'}]},y:{type:'linear',domain:[0,100]}},
  series:[{id:'output',name:'Output',data:[{id:'north-output',x:'north',y:72,z:width}]}],
});
function scene(width,hidden=[]){
  const result=planChartData(data(width),hidden,{width:360,height:300});
  assert(['ok','empty'].includes(result.status),JSON.stringify(result));
  return result.scene;
}
test('hiding the last variwide series reports visibility instead of bad source widths',()=>{
  const hidden=scene(180,['output']);
  assert.equal(hidden.variwideLayout.status,'no-positive-width');
  assert.equal(showVariwideSourceWarning(hidden),false);
  assert.equal(chartEmptyState(hidden,'en').title,'All series are hidden');
  assert.equal(chartEmptyState(hidden,'es').title,'Todas las series están ocultas');
  assert.equal(showVariwideSourceWarning(scene(180)),false);
});
test('genuine zero source widths retain their diagnostic',()=>{
  const zero=scene(0);
  assert.equal(showVariwideSourceWarning(zero),true);
  assert.equal(chartEmptyState(zero,'en').title,'No positive widths');
});
