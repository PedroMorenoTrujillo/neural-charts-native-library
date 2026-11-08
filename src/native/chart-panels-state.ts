import {optionsDiagnostic} from './options-validation.js';
import type {NativeChartPanel,NativeChartPanelData,NativeChartPanelDiagnostic,NativeChartPanelLink,NativeChartPanelViewportLink,NativeChartPanelOptionsByType,NativeChartPanelsData,NativeChartPanelsVisibility} from './chart-panels-options.js';
import {panelXContract,type PanelXContract} from './panel-viewport-contract.js';

type Row=Readonly<Record<string,unknown>>;
/** One closed runtime instantiation, rather than the full catalog option union. */
export type NativeChartPanelRuntimeOptions=NativeChartPanelOptionsByType[NativeChartPanelData['type']];
export interface NativeChartPanelRender extends NativeChartPanel {readonly options:NativeChartPanelRuntimeOptions;}
const kinds=new Set(['mixed','line','area','spline','column','pie','donut','gauge']);
const id=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=128;
function record(value:unknown,keys?:readonly string[]):Row{
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Expected a plain object.');
  const prototype=Object.getPrototypeOf(value);if(prototype!==Object.prototype&&prototype!==null)throw Error('Expected a plain object.');
  const descriptors=Object.getOwnPropertyDescriptors(value),names=Reflect.ownKeys(descriptors);
  if(names.some(name=>typeof name!=='string'||descriptors[name]!.get||descriptors[name]!.set||keys&&!keys.includes(name)))throw Error('Unknown property or accessor.');
  return value as Row;
}
function array(value:unknown,min:number,max:number):readonly unknown[]{
  if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length<min||value.length>max)throw Error(`Expected a plain array with ${min}–${max} entries.`);
  const fields=Object.getOwnPropertyDescriptors(value);
  if(Reflect.ownKeys(fields).some(key=>typeof key!=='string'||key!=='length'&&(!/^(0|[1-9]\d*)$/.test(key)||Number(key)>=value.length)||typeof key==='string'&&(fields[key]?.get||fields[key]?.set)))throw Error('Array properties, symbols and accessors are not supported.');
  return Object.freeze(Array.from({length:value.length},(_,i)=>{const d=fields[String(i)];if(!d||d.get||d.set)throw Error('Sparse entries or accessors are not supported.');return d.value;}));
}
function sourceIds(data:NativeChartPanelData):readonly string[]{
  if(data.type==='gauge')return Object.freeze([]);
  const source=record(data),items=array(source['series']??source['data'],0,16),ids:string[]=[];
  for(const item of items){const row=record(item);if(!id(row['id'])||ids.includes(row['id']))throw Error('Expected unique original series/segment IDs.');ids.push(row['id']);}
  return Object.freeze(ids);
}
export interface OwnedChartPanels{
  readonly panels:readonly NativeChartPanel[];
  readonly links:readonly NativeChartPanelLink[];
  readonly viewportLinks:readonly NativeChartPanelViewportLink[];
  readonly viewports:ReadonlyMap<string,PanelXContract>;
  readonly series:ReadonlyMap<string,readonly string[]>;
  readonly options:ReadonlyMap<string,NativeChartPanelRuntimeOptions>;
  readonly layout:Readonly<{columns:'auto'|1|2;minPanelWidth:number;gap:number}>;
}
export type ChartPanelsResult=Readonly<{status:'ok';value:OwnedChartPanels}>|Readonly<{status:'invalid';error:NativeChartPanelDiagnostic}>;

/** Bounded presentation ownership. Each existing NativeDataChart still owns its
 * original-data validation, Core planning, projection and interaction lifecycle. */
export function ownChartPanels(data:NativeChartPanelsData,options:unknown):ChartPanelsResult{
  let path='data',panelId:string|null=null;
  const fail=(reason:string,message:string):ChartPanelsResult=>({status:'invalid',error:{panelId,diagnostic:{code:'INVALID_CONFIG',reason,path,message}}});
  try{
    const source=record(data,['panels','links','viewportLinks']),series=new Map<string,readonly string[]>(),panels:NativeChartPanel[]=[];
    const input=array(source['panels'],1,4);
    for(let i=0;i<input.length;i++){
      panelId=null;path=`data.panels[${i}]`;const row=record(input[i],['id','data']);
      if(!id(row['id'])||series.has(row['id']))return fail('INVALID_PANEL_ID','Panel IDs must be unique nonempty strings of at most128 characters.');
      panelId=row['id'];path+= '.data';const definition=record(row['data']);
      if(!kinds.has(String(definition['type'])))return fail('UNSUPPORTED_PANEL_TYPE','Panels support mixed, line, area, spline, column, pie, donut and gauge data.');
      const chartData=definition as unknown as NativeChartPanelData;
      series.set(panelId,sourceIds(chartData));panels.push(Object.freeze({id:panelId,data:chartData}));
    }
    panelId=null;path='data.links';const links:NativeChartPanelLink[]=[],linkIds=new Set<string>(),members=new Set<string>();
    for(const [i,item]of array(source['links']??[],0,32).entries()){
      path=`data.links[${i}]`;const link=record(item,['id','members']);
      if(!id(link['id'])||linkIds.has(link['id']))return fail('INVALID_LINK_ID','Link IDs must be unique nonempty strings.');linkIds.add(link['id']);
      const panelMembers=new Set<string>(),owned=[];
      for(const [j,entry]of array(link['members'],2,4).entries()){
        path=`data.links[${i}].members[${j}]`;const member=record(entry,['panelId','seriesId']);
        if(!id(member['panelId'])||!id(member['seriesId'])||!series.get(member['panelId'])?.includes(member['seriesId']))return fail('UNKNOWN_PANEL_MEMBER','A link must name an existing panel and original series/segment ID.');
        const key=JSON.stringify([member['panelId'],member['seriesId']]);
        if(panelMembers.has(member['panelId'])||members.has(key))return fail('CONFLICTING_PANEL_MEMBER','A link has one member per panel and each member belongs to at most one link.');
        panelMembers.add(member['panelId']);members.add(key);owned.push(Object.freeze({panelId:member['panelId'],seriesId:member['seriesId']}));
      }
      links.push(Object.freeze({id:link['id'],members:Object.freeze(owned)}));
    }
    path='options';const config=record(options,['layout','appearance','animation','interaction','panels']);
    const layout=record(config['layout']??{},['columns','minPanelWidth','gap']);
    const columns=layout['columns']??'auto',minPanelWidth=layout['minPanelWidth']??300,gap=layout['gap']??16;
    if(columns!=='auto'&&columns!==1&&columns!==2)return fail('INVALID_PANEL_LAYOUT','columns must be auto,1 or2.');
    if(typeof minPanelWidth!=='number'||!Number.isFinite(minPanelWidth)||minPanelWidth<160||minPanelWidth>1200||typeof gap!=='number'||!Number.isFinite(gap)||gap<0||gap>64)return fail('INVALID_PANEL_LAYOUT','minPanelWidth must be160–1200 and gap0–64 logical pixels.');
    path='options.appearance';const appearance=record(config['appearance']??{},['locale','theme']);
    if(appearance['locale']!==undefined&&!['en','es'].includes(String(appearance['locale']))||appearance['theme']!==undefined&&!['light','dark','system'].includes(String(appearance['theme'])))return fail('INVALID_PANEL_APPEARANCE','Unsupported locale or theme.');
    path='options.animation';const animation=record(config['animation']??{},['enabled','durationMs','revision']);
    path='options.interaction';const interaction=record(config['interaction']??{},['haptics','selectionControls']);
    const commonError=optionsDiagnostic(panels[0]!.data,{appearance,animation,interaction});
    if(commonError)return {status:'invalid',error:{panelId:null,diagnostic:{...commonError,path:'options.'+commonError.path.replace(/^options\./,'')}}};
    path='options.panels';const overrides=record(config['panels']??{});
    if(Object.keys(overrides).some(key=>!series.has(key)))return fail('UNKNOWN_PANEL_OPTIONS','Panel options must name an existing panel ID.');
    const prepared=new Map<string,NativeChartPanelRuntimeOptions>();
    for(const panel of panels){
      panelId=panel.id;path=`options.panels.${panel.id}`;const own=record(Object.getOwnPropertyDescriptor(overrides,panel.id)?.value??{});
      // Object literals cannot mutate a user-owned options object or its groups.
      const merged={...own,appearance:{...appearance,...record(own['appearance']??{})},animation:{...animation,...record(own['animation']??{})},interaction:{...interaction,...record(own['interaction']??{})}} as NativeChartPanelRuntimeOptions;
      const error=optionsDiagnostic(panel.data,merged);if(error)return {status:'invalid',error:{panelId,diagnostic:{...error,path:path+'.'+error.path.replace(/^options\./,'')}}};
      prepared.set(panel.id,Object.freeze(merged));
    }
    panelId=null;path='data.viewportLinks';const viewportLinks:NativeChartPanelViewportLink[]=[],viewportIds=new Set<string>(),viewportPanels=new Set<string>(),viewports=new Map<string,PanelXContract>();
    for(const [index,item]of array(Object.getOwnPropertyDescriptor(source,'viewportLinks')?.value??[],0,4).entries()){
      path=`data.viewportLinks[${index}]`;const link=record(item,['id','axis','panelIds']);
      if(!id(link['id'])||viewportIds.has(link['id'])||link['axis']!=='x')return fail('INVALID_VIEWPORT_LINK','Viewport links require a unique ID and axis:x.');viewportIds.add(link['id']);
      const members:string[]=[];let common:PanelXContract|undefined;
      for(const [j,member]of array(link['panelIds'],2,4).entries()){
        path=`data.viewportLinks[${index}].panelIds[${j}]`;
        if(!id(member)||!series.has(member)||viewportPanels.has(member))return fail('INVALID_VIEWPORT_MEMBER','Each viewport link names existing panels, each in at most one viewport link.');
        const panel=panels.find(panel=>panel.id===member)!;
        let contract:PanelXContract;try{contract=panelXContract(panel.data,prepared.get(member)!);}catch(error){return fail('INCOMPATIBLE_PANEL_VIEWPORT',error instanceof Error?error.message:'Invalid linked coordinate contract.');}
        if(common&&(common.key!==contract.key||common.initialKey!==contract.initialKey))return fail('INCOMPATIBLE_PANEL_VIEWPORT','Linked X axes require identical category IDs/order or explicit numeric/time domains, compatible coordinate types and equal initial X windows.');
        common??=contract;viewportPanels.add(member);viewports.set(member,contract);members.push(member);
      }
      viewportLinks.push(Object.freeze({id:link['id'],axis:'x',panelIds:Object.freeze(members)}));
    }
    return {status:'ok',value:Object.freeze({panels:Object.freeze(panels),links:Object.freeze(links),viewportLinks:Object.freeze(viewportLinks),viewports,series,options:prepared,layout:Object.freeze({columns,minPanelWidth,gap})})};
  }catch(error){return fail('INVALID_PANEL_CONFIG',error instanceof Error?error.message:'Invalid panel configuration.');}
}

export function panelVisibility(owned:OwnedChartPanels,input:NativeChartPanelsVisibility):NativeChartPanelsVisibility{
  const result=new Map<string,Set<string>>();
  for(const panel of owned.panels){
    const descriptor=input&&typeof input==='object'?Object.getOwnPropertyDescriptor(input,panel.id):undefined;
    const values=descriptor&&!descriptor.get&&!descriptor.set&&Array.isArray(descriptor.value)?descriptor.value:[],hidden:string[]=[];
    for(let i=0;i<Math.min(values.length,16);i++){const d=Object.getOwnPropertyDescriptor(values,String(i)),value=d&&!d.get&&!d.set?d.value:undefined;if(typeof value==='string'&&owned.series.get(panel.id)!.includes(value))hidden.push(value);}
    result.set(panel.id,new Set(hidden));
  }
  for(const link of owned.links)if(link.members.some(member=>result.get(member.panelId)!.has(member.seriesId)))for(const member of link.members)result.get(member.panelId)!.add(member.seriesId);
  return Object.freeze(Object.fromEntries(owned.panels.map(panel=>[panel.id,Object.freeze(owned.series.get(panel.id)!.filter(id=>result.get(panel.id)!.has(id)))])));
}
export function updatePanelVisibility(owned:OwnedChartPanels,current:NativeChartPanelsVisibility,panelId:string,requested:readonly string[]):NativeChartPanelsVisibility{
  const ids=owned.series.get(panelId);if(!ids||!Array.isArray(requested))return current;
  const next=new Set(requested.filter(id=>ids.includes(id))),before=new Set(current[panelId]??[]),result=new Map(owned.panels.map(panel=>[panel.id,new Set(current[panel.id]??[])]));
  result.set(panelId,next);
  for(const id of ids)if(before.has(id)!==next.has(id))for(const link of owned.links)if(link.members.some(member=>member.panelId===panelId&&member.seriesId===id))for(const member of link.members){const target=result.get(member.panelId)!;if(next.has(id))target.add(member.seriesId);else target.delete(member.seriesId);}
  return Object.freeze(Object.fromEntries(owned.panels.map(panel=>[panel.id,Object.freeze(owned.series.get(panel.id)!.filter(id=>result.get(panel.id)!.has(id)))])));
}
export function samePanelVisibility(a:NativeChartPanelsVisibility,b:NativeChartPanelsVisibility):boolean{
  const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(key=>a[key]?.length===b[key]?.length&&a[key]!.every((value,index)=>value===b[key]?.[index]));
}
