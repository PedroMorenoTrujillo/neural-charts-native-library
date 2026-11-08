import type {PlanFanLayout,PlanFanValue,PlanRegressionLayout,PlanRegressionValue} from '@neural-charts/core/plan';
import type {NativeScene} from './contracts.js';
export type NativeFanLayout=PlanFanLayout;
export type NativeFanValue=PlanFanValue;
export type NativeRegressionLayout=PlanRegressionLayout;
export type NativeRegressionValue=PlanRegressionValue;
export function ownFanValue(v:NativeFanValue):NativeFanValue{
  if(!v||v.type!=='center'&&v.type!=='interval')throw Error('Invalid uncertainty role');
  if(v.type==='center')return Object.freeze({type:'center'});
  if(![v.coverage,v.low,v.high].every(Number.isFinite)||v.coverage<=0||v.coverage>=1||v.low>v.high)throw Error('Invalid uncertainty interval');
  return Object.freeze({type:'interval',coverage:v.coverage,low:v.low,high:v.high});
}
export function ownFan(v:NativeFanLayout,s:NativeScene):NativeFanLayout{
  if(s.family!=='fan'||!v||v.centerId!=='center'||!Array.isArray(v.bands)||v.bands.length<1||v.bands.length>6||s.observations.length>7168)throw Error('Invalid uncertainty layout');
  const ids=new Set<string>(['center']);let coverage=0;
  const bands=v.bands.map(b=>{if(!b||typeof b.id!=='string'||!b.id||b.id.length>64||ids.has(b.id)||typeof b.label!=='string'||b.label.length>200||!Number.isFinite(b.coverage)||b.coverage<=coverage||b.coverage>=1)throw Error('Invalid uncertainty band');ids.add(b.id);coverage=b.coverage;return Object.freeze({id:b.id,label:b.label,coverage:b.coverage});});
  const byId=new Map(bands.map(b=>[b.id,b]));
  for(const p of s.observations){const f=ownFanValue(p.fan!);if(!p.group||f.type==='center'&&p.id.seriesId!=='center'||f.type==='interval'&&(byId.get(p.id.seriesId)?.coverage!==f.coverage||p.lowValue!==f.low||p.highValue!==f.high))throw Error('Uncertainty source ownership mismatch');}
  if(s.series.some(x=>!ids.has(x.id))||s.legend?.some(x=>!ids.has(x.id)))throw Error('Unknown uncertainty identity');
  return Object.freeze({centerId:'center',bands:Object.freeze(bands)});
}
export function ownRegressionValue(v:NativeRegressionValue):NativeRegressionValue{
  if(!v||!['sample','fit'].includes(v.type)||typeof v.modelId!=='string'||!v.modelId||v.modelId.length>96)throw Error('Invalid regression role');
  return Object.freeze({type:v.type,modelId:v.modelId});
}
export function ownRegression(v:NativeRegressionLayout,s:NativeScene):NativeRegressionLayout{
  if(s.family!=='regression'||!v||v.method!=='ordinary-least-squares'||!Array.isArray(v.models)||v.models.length>8||s.observations.length>4112)throw Error('Invalid regression layout');
  const ids=new Set<string>();let count=0;
  const models=v.models.map(m=>{if(!m||typeof m.sourceSeriesId!=='string'||!m.sourceSeriesId||m.sourceSeriesId.length>96||ids.has(m.sourceSeriesId)||m.fitSeriesId!=='ols:'+m.sourceSeriesId||!Number.isInteger(m.sampleCount)||m.sampleCount<0||!Number.isInteger(m.missingCount)||m.missingCount<0||(count+=m.sampleCount+m.missingCount)>4096||!['ready','insufficient-data','constant-x'].includes(m.status))throw Error('Invalid regression source');ids.add(m.sourceSeriesId);
    if(m.status==='ready'){if(m.sampleCount<2||![m.slope,m.intercept,m.minX,m.maxX].every(Number.isFinite)||m.minX>=m.maxX||m.rSquared!==null&&(!Number.isFinite(m.rSquared)||m.rSquared<0||m.rSquared>1))throw Error('Invalid regression coefficients');return Object.freeze({...m});}
    if(m.status==='insufficient-data'&&m.sampleCount>=2||m.status==='constant-x'&&m.sampleCount<2)throw Error('Invalid unavailable regression');return Object.freeze({sourceSeriesId:m.sourceSeriesId,fitSeriesId:m.fitSeriesId,sampleCount:m.sampleCount,missingCount:m.missingCount,status:m.status});
  });
  const byId=new Map(models.map(m=>[m.sourceSeriesId,m]));
  for(const p of s.observations){const f=ownRegressionValue(p.regression!),m=byId.get(f.modelId);if(!m||p.id.seriesId!==(f.type==='sample'?m.sourceSeriesId:m.fitSeriesId)||f.type==='fit'&&(m.status!=='ready'||p.hit?.type!=='polygon'))throw Error('Regression observation ownership mismatch');}
  const seriesIds=new Set(models.flatMap(m=>m.status==='ready'?[m.sourceSeriesId,m.fitSeriesId]:[m.sourceSeriesId]));
  if(s.series.some(x=>!seriesIds.has(x.id))||s.legend?.some(x=>!seriesIds.has(x.id)))throw Error('Unknown regression series');
  return Object.freeze({method:'ordinary-least-squares',models:Object.freeze(models)});
}
