import {prepareWordCloudMeasurements,type PlanWordCloudSpec,type PlanWordCloudPreparation} from '@neural-charts/core/plan';
import {ownScene} from '../library/scene.js';
import type {NativeScene} from '../library/contracts.js';
import type {NativeWordCloudData,NativeWordCloudLayoutOptions} from './wordcloud-data.js';
import type {NativePlanningResult} from './plan.js';
export type NativeWordCloudPreparation=Readonly<{status:'ok';spec:PlanWordCloudSpec;width:number;height:number;fontKey:string;preparation:PlanWordCloudPreparation}>
  |Extract<NativePlanningResult,{status:'invalid'}>;
const invalid=(path:string,message:string):Extract<NativePlanningResult,{status:'invalid'}>=>({status:'invalid',diagnostic:{code:'INVALID_CONFIG',reason:'INVALID_WORDCLOUD_INPUT',path,message}});
/** Native font/style restrictions; all placement mathematics stays in Core. */
export function prepareNativeWordCloud(data:NativeWordCloudData,layout:NativeWordCloudLayoutOptions|undefined,viewport:Readonly<{width:number;height:number}>|undefined,hidden:readonly string[],fontKey:string):NativeWordCloudPreparation{
  if(!data||typeof data!=='object'||Object.values(Object.getOwnPropertyDescriptors(data)).some(d=>d.get||d.set))return invalid('data','Expected plain Wordcloud source data.');
  if(Reflect.ownKeys(data).some(key=>!['type','words','groups'].includes(String(key))))return invalid('data','Words and groups belong to data; font and packing settings belong to options.layout.');
  if(Array.isArray(data.words)&&data.words.length<=2048)for(let i=0;i<data.words.length;i++){
    const word=Object.getOwnPropertyDescriptor(data.words,String(i))?.value,label=word&&Object.getOwnPropertyDescriptor(word,'text')?.value;
    if(typeof label==='string'&&/[\r\n\u000b\u000c\u0085\u2028\u2029]/u.test(label))return invalid('data.words.'+i+'.text','Use a single-line label.');
  }
  const width=Math.max(64,Math.min(10000,viewport?.width??320)),height=Math.max(64,Math.min(10000,viewport?.height??260));
  const spec:PlanWordCloudSpec={family:'wordcloud',title:'Words',words:data.words,...(data.groups===undefined?{}:{groups:data.groups}),...layout};
  const result=prepareWordCloudMeasurements(spec,{width,height,fontKey,hiddenSeriesIds:hidden});
  return result.status==='invalid'?result:{status:'ok',spec,width,height,fontKey,preparation:result.preparation};
}
export function measuringWordCloud(input:Extract<NativeWordCloudPreparation,{status:'ok'}>):NativeScene{
  return ownScene({schema:'nc-native-scene/0',family:'wordcloud',title:'',description:'',unit:'',width:input.width,height:input.height,
    wordcloud:{status:'measuring',fontKey:input.fontKey},legend:input.preparation.legend,series:input.preparation.legend.filter(item=>item.visible).map(item=>({id:item.id,name:item.name,color:item.color,textGlyphs:[]})),observations:[],grid:[],labels:[]});
}
