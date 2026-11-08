import {
  ownDrilldownGraph as ownCoreDrilldownGraph,
  type OwnedDrilldownGraph as CoreDrilldownGraph,
  type DrilldownState as CoreDrilldownState,
} from '@neural-charts/core/drilldown';
import {optionsDiagnostic} from './options-validation.js';
import type {PlanViewportValue} from './plan.js';
import type {NativeChartDrilldownChartData,NativeChartDrilldownData,NativeChartDrilldownDiagnostic,NativeChartDrilldownOptionsByType} from './drilldown-options.js';

export {
  currentDrilldownNode,drilldownGeneration,createDrilldownState,
  drilldownDestination,enterDrilldown,backDrilldown,rememberDrilldownView,
  restoredDrilldownView,reconcileDrilldown,
  type DrilldownGeneration,type DrilldownSelection,
} from '@neural-charts/core/drilldown';

type Row=Readonly<Record<string,unknown>>;
type NodeOptions=NativeChartDrilldownOptionsByType[keyof NativeChartDrilldownOptionsByType];
const validId=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=128;
function record(value:unknown,keys?:readonly string[]):Row{
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Expected a plain object.');
  const proto=Object.getPrototypeOf(value);if(proto!==Object.prototype&&proto!==null)throw Error('Expected a plain object.');
  if(Object.getOwnPropertySymbols(value).length)throw Error('Symbol properties are not supported.');
  const descriptors=Object.getOwnPropertyDescriptors(value);
  if(Object.keys(descriptors).some(key=>descriptors[key]!.get||descriptors[key]!.set||keys&&!keys.includes(key)))throw Error('Unknown property or accessor.');
  return value as Row;
}
function array(value:unknown,min:number,max:number):readonly unknown[]{
  if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length<min||value.length>max)throw Error(`Expected ${min}–${max} plain array entries.`);
  if(Reflect.ownKeys(value).some(key=>typeof key!=='string'||key!=='length'&&!/^(0|[1-9][0-9]*)$/.test(key)))throw Error('Custom array properties are not supported.');
  for(let i=0;i<value.length;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d||d.get||d.set)throw Error('Sparse entries or accessors are not supported.');}
  return value;
}
function numericPair(value:unknown):readonly[number,number]|undefined{
  if(value===undefined)return undefined;const pair=array(value,2,2);
  if(!pair.every(v=>typeof v==='number'&&Number.isFinite(v))||pair[0]===pair[1])throw Error('Invalid numeric source window.');
  return Object.freeze([pair[0] as number,pair[1] as number]);
}
function ownWindow(value:unknown):PlanViewportValue|undefined{
  if(value===undefined)return undefined;const input=record(value,['x','y']);const out:{x?:PlanViewportValue['x'];y?:PlanViewportValue['y']}={};
  for(const axis of ['x','y'] as const){const v=input[axis];if(v===undefined)continue;
    if(Array.isArray(v)){const pair=numericPair(v)!;if(pair[0]>=pair[1])throw Error('Expected an increasing original-unit window.');out[axis]=pair;}
    else{if(axis!=='x')throw Error('Only X can contain category window IDs.');const category=record(v,['firstId','lastId']);if(!validId(category['firstId'])||!validId(category['lastId']))throw Error('Invalid original category window.');out.x=Object.freeze({firstId:category['firstId'],lastId:category['lastId']});}
  }
  return Object.freeze(out);
}

/** Deliberately bounded semantic key. Presentation-only title, palette, legend
 * position and motion changes do not invalidate original-unit viewport values. */
function semanticKey(data:NativeChartDrilldownChartData,options:NodeOptions):string{
  const source=record(data),axes=source['axes']===undefined?{}:record(source['axes']),settings=record(options),viewport=settings['viewport']===undefined?undefined:record(settings['viewport']),layout=settings['layout']===undefined?{}:record(settings['layout']),format=settings['format']===undefined?{}:record(settings['format']);
  const axis=(name:string)=>{
    const raw=axes[name];if(raw===undefined)return undefined;const a=record(raw),type=a['type'];
    return {type,domain:numericPair(a['domain']),reversed:a['reversed'],categoryIds:type==='category'?array(a['values'],0,64).map(v=>record(v)['id']):undefined};
  };
  const stackGroups=layout['stackGroups']===undefined?undefined:array(layout['stackGroups'],0,16).map(raw=>{const group=record(raw);return {id:group['id'],seriesIds:array(group['seriesIds'],1,16)};});
  const defaultViewportAxes=data.type==='treegraph'||data.type==='organization'?'xy':'x';
  const initial=ownWindow(viewport?.['initial']),normalizedInitial=initial&&Object.keys(initial).length?initial:undefined;
  return JSON.stringify({type:data.type,orientation:source['orientation']??'vertical',hierarchyOrientation:layout['orientation'],x:axis('x'),y:axis('y'),stacking:layout['stacking'],stackGroups,unit:format['unit'],viewport:viewport?{axes:viewport['axes']??defaultViewportAxes,initial:normalizedInitial}:null});
}

export interface OwnedDrilldownGraph extends CoreDrilldownGraph<NativeChartDrilldownChartData>{
  readonly options:ReadonlyMap<string,NodeOptions>;
}
export type DrilldownState=CoreDrilldownState<OwnedDrilldownGraph>;
export type DrilldownGraphResult=Readonly<{status:'ok';value:OwnedDrilldownGraph}>|Readonly<{status:'invalid';error:NativeChartDrilldownDiagnostic}>;

/** The adapter validates native options; Core owns source identity and navigation. */
export function ownDrilldownGraph(data:NativeChartDrilldownData,options:unknown={}):DrilldownGraphResult{
  const source=ownCoreDrilldownGraph(data);
  if(source.status==='invalid')return source;
  let path='options',nodeId:string|null=null;
  const invalid=(reason:string,message:string):DrilldownGraphResult=>({status:'invalid',error:{nodeId,diagnostic:{code:'INVALID_CONFIG',reason,path,message}}});
  try{
    const {nodes}=source.value;
    nodeId=null;path='options';const config=record(options,['appearance','animation','interaction','nodes']);
    const appearance=record(config['appearance']??{},['locale','theme']),animation=record(config['animation']??{},['enabled','durationMs','revision']),interaction=record(config['interaction']??{},['haptics','selectionControls']);
    const first=nodes.values().next().value!;const commonError=optionsDiagnostic(first.data,{appearance,animation,interaction});if(commonError)return {status:'invalid',error:{nodeId:null,diagnostic:commonError}};
    const overrides=record(config['nodes']??{});if(Object.keys(overrides).some(id=>!nodes.has(id)))return invalid('UNKNOWN_DRILLDOWN_NODE_OPTIONS','Node options must name a declared node ID.');
    const prepared=new Map<string,NodeOptions>(),semantics=new Map<string,string>();
    for(const node of nodes.values()){
      nodeId=node.id;path='options.nodes.'+node.id;const own=record(Object.getOwnPropertyDescriptor(overrides,node.id)?.value??{});
      const merged={...own,appearance:{...appearance,...record(own['appearance']??{})},animation:{...animation,...record(own['animation']??{})},interaction:{...interaction,...record(own['interaction']??{})}} as NodeOptions;
      const error=optionsDiagnostic(node.data,merged);if(error)return {status:'invalid',error:{nodeId,diagnostic:{...error,path:path+'.'+error.path.replace(/^options\./,'')}}};
      prepared.set(node.id,Object.freeze(merged));semantics.set(node.id,semanticKey(node.data,merged));
    }
    const graph=ownCoreDrilldownGraph(data,{semantics:Object.fromEntries(semantics)});
    if(graph.status==='invalid')return graph;
    const ownedOptions:ReadonlyMap<string,NodeOptions>=Object.freeze({
      get size(){return prepared.size;},
      get:(id:string)=>prepared.get(id),has:(id:string)=>prepared.has(id),
      keys:()=>prepared.keys(),values:()=>prepared.values(),entries:()=>prepared.entries(),
      [Symbol.iterator]:()=>prepared[Symbol.iterator](),
      forEach:(callback:(value:NodeOptions,key:string,map:ReadonlyMap<string,NodeOptions>)=>void,thisArg?:unknown)=>{
        prepared.forEach((value,key)=>callback.call(thisArg,value,key,ownedOptions));
      },
    });
    return {status:'ok',value:Object.freeze({...graph.value,options:ownedOptions})};
  }catch(error){return invalid('INVALID_DRILLDOWN_CONFIG',error instanceof Error?error.message:'Invalid drilldown configuration.');}
}
