import type {NativePointAppearance,NativeReference,NativeReferenceStyle,NativeReferenceBand,NativeReferenceBandStyle,NativeScene} from './contracts.js';
import {identityKey} from './contracts.js';
import {supportsReferenceAxis} from './chart-capabilities.js';

const hex=/^#[\da-f]{6}$/i;
const text=(value:unknown,maximum:number)=>typeof value==='string'&&value.length>0&&value.length<=maximum;
export function ownPrimitiveId(input:object):string|undefined{const descriptor=Object.getOwnPropertyDescriptor(input,'pointId');if(descriptor?.get||descriptor?.set)throw Error('Invalid primitive identity');return descriptor?.value;}
function record(value:unknown,keys:readonly string[]):Record<string,PropertyDescriptor>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid presentation record');
  const descriptors=Object.getOwnPropertyDescriptors(value);
  for(const key of Reflect.ownKeys(descriptors))if(typeof key!=='string'||!keys.includes(key)||descriptors[key]?.get||descriptors[key]?.set)throw Error('Invalid presentation property');
  return descriptors;
}
function referenceStyle(input:unknown,extra:readonly string[]=[]):NativeReferenceStyle{
  const fields=record(input,['id','label','color','width','dash',...extra]);
  const id=fields['id']?.value,label=fields['label']?.value,color=fields['color']?.value,width=fields['width']?.value,dash=fields['dash']?.value;
  if(!text(id,64)||label!==undefined&&(typeof label!=='string'||label.length>200)||color!==undefined&&(typeof color!=='string'||!hex.test(color))||width!==undefined&&(typeof width!=='number'||!Number.isFinite(width)||width<.5||width>6)||dash!==undefined&&!['solid','dash','dot'].includes(dash))throw Error('Invalid reference style');
  return {id,...(label===undefined?{}:{label}),...(color===undefined?{}:{color}),...(width===undefined?{}:{width}),...(dash===undefined?{}:{dash})};
}
export function ownReferenceStyles(input:readonly NativeReferenceStyle[]):readonly NativeReferenceStyle[]{
  if(!Array.isArray(input)||input.length>16)throw Error('Unbounded reference styles');
  const ids=new Set<string>();return input.map(item=>{const style=referenceStyle(item);if(ids.has(style.id))throw Error('Duplicate reference ID');ids.add(style.id);return style;});
}
export function ownReferences(input:readonly NativeReference[]|undefined,scene:Pick<NativeScene,'width'|'height'|'family'|'bulletOrientation'|'mixedAxes'>):readonly NativeReference[]|undefined{
  if(input===undefined)return undefined;
  if(!Array.isArray(input)||input.length>16||!supportsReferenceAxis(scene.family,'x')&&!supportsReferenceAxis(scene.family,'y'))throw Error('Invalid native references');
  const ids=new Set<string>();return input.map(item=>{
    const style=referenceStyle(item,['axis','status','line','valueAxis']);if(ids.has(style.id))throw Error('Duplicate reference ID');ids.add(style.id);
    const fields=Object.getOwnPropertyDescriptors(item),axis=fields['axis']?.value,status=fields['status']?.value,valueAxis=fields['valueAxis']?.value,role=valueAxis===undefined?{}:{valueAxis};
    if(valueAxis!==undefined&&(valueAxis!=='secondary'||axis!=='y'||scene.family!=='mixed'||!scene.mixedAxes))throw Error('Invalid reference value scale');
    if(!['x','y'].includes(axis)||!supportsReferenceAxis(scene.family,axis)||!['visible','outside','unavailable'].includes(status))throw Error('Invalid reference state');
    if(status!=='visible'){if(Object.hasOwn(fields,'line'))throw Error('Invisible reference cannot have a line');return {...style,...role,axis,status};}
    const lineFields=record(fields['line']?.value,['x1','y1','x2','y2']),line={x1:lineFields['x1']?.value,y1:lineFields['y1']?.value,x2:lineFields['x2']?.value,y2:lineFields['y2']?.value};
    if(!Object.values(line).every(value=>typeof value==='number'&&Number.isFinite(value))||line.x1<0||line.x2<0||line.x1>scene.width||line.x2>scene.width||line.y1<0||line.y2<0||line.y1>scene.height||line.y2>scene.height)throw Error('Invalid reference coordinates');
    if((scene.family==='bar'||scene.family==='bullet'&&scene.bulletOrientation==='horizontal')?axis==='y':axis==='x'){if(line.x1!==line.x2)throw Error('Expected vertical reference');}else if(line.y1!==line.y2)throw Error('Expected horizontal reference');
    return {...style,...role,axis,status:'visible' as const,line};
  });
}
export function ownPointAppearance(input:readonly NativePointAppearance[]|undefined):readonly NativePointAppearance[]|undefined{
  if(input===undefined)return undefined;
  if(!Array.isArray(input)||input.length>256)throw Error('Unbounded point colors');
  const ids=new Set<string>();const points=input.map(item=>{
    const fields=record(item,['seriesId','pointId','color']),seriesId=fields['seriesId']?.value,pointId=fields['pointId']?.value,color=fields['color']?.value;
    if(!text(seriesId,128)||!text(pointId,128)||typeof color!=='string'||!hex.test(color))throw Error('Invalid point color');
    const point={seriesId,pointId,color},key=identityKey(point);if(ids.has(key))throw Error('Duplicate point color');ids.add(key);return point;
  });
  return points.sort((a,b)=>{const first=identityKey(a),last=identityKey(b);return first<last?-1:first>last?1:0;});
}
export function samePointAppearance(a:readonly NativePointAppearance[]|undefined,b:readonly NativePointAppearance[]|undefined):boolean{return (a?.length??0)===(b?.length??0)&&(a??[]).every((point,index)=>point.seriesId===b?.[index]?.seriesId&&point.pointId===b[index]!.pointId&&point.color===b[index]!.color);}
export function sameReferenceStyle(a:NativeReferenceStyle,b:NativeReferenceStyle):boolean{return a.label===b.label&&sameReferencePaint(a,b);}
export function sameReferencePaint(a:NativeReferenceStyle,b:NativeReferenceStyle):boolean{return a.color===b.color&&a.width===b.width&&a.dash===b.dash;}
function referenceBandStyle(input:unknown,extra:readonly string[]=[]):NativeReferenceBandStyle{
  const fields=record(input,['id','label','color','opacity',...extra]);
  const id=fields['id']?.value,label=fields['label']?.value,color=fields['color']?.value,opacity=fields['opacity']?.value;
  if(!text(id,64)||label!==undefined&&(typeof label!=='string'||label.length>200)||color!==undefined&&(typeof color!=='string'||!hex.test(color))||opacity!==undefined&&(typeof opacity!=='number'||!Number.isFinite(opacity)||opacity<0||opacity>1))throw Error('Invalid reference band style');
  return {id,...(label===undefined?{}:{label}),...(color===undefined?{}:{color}),...(opacity===undefined?{}:{opacity})};
}
function referenceBandEntries(input:unknown):readonly unknown[]{
  if(!Array.isArray(input)||Object.getPrototypeOf(input)!==Array.prototype||input.length>32)throw Error('Invalid reference band array');
  const fields=Object.getOwnPropertyDescriptors(input);
  if(Reflect.ownKeys(fields).some(key=>typeof key!=='string'||key!=='length'&&(!/^(0|[1-9]\d*)$/.test(key)||Number(key)>=input.length)||typeof key==='string'&&(fields[key]?.get||fields[key]?.set)))throw Error('Invalid reference band array property');
  return Array.from({length:input.length},(_,index)=>{const descriptor=fields[String(index)];if(!descriptor||descriptor.get||descriptor.set)throw Error('Invalid reference band entry');return descriptor.value;});
}
export function ownReferenceBandStyles(input:readonly NativeReferenceBandStyle[]):readonly NativeReferenceBandStyle[]{
  const ids=new Set<string>();return referenceBandEntries(input).map(item=>{const style=referenceBandStyle(item);if(ids.has(style.id))throw Error('Duplicate reference band ID');ids.add(style.id);return style;});
}
export function ownReferenceBands(input:readonly NativeReferenceBand[]|undefined,scene:Pick<NativeScene,'width'|'height'|'family'|'mixedAxes'>):readonly NativeReferenceBand[]|undefined{
  if(input===undefined)return undefined;
  if(!['line','area','spline','areaspline','column','bar','mixed','scatter','bubble'].includes(scene.family))throw Error('Invalid native reference bands');
  const ids=new Set<string>();return referenceBandEntries(input).map(item=>{
    const style=referenceBandStyle(item,['axis','from','to','valueAxis','status','box']);if(ids.has(style.id))throw Error('Duplicate reference band ID');ids.add(style.id);
    const fields=record(item,['id','label','color','opacity','axis','from','to','valueAxis','status','box']),axis=fields['axis']?.value,from=fields['from']?.value,to=fields['to']?.value,status=fields['status']?.value,valueAxis=fields['valueAxis']?.value;
    if(!['x','y'].includes(axis)||!['visible','outside','unavailable'].includes(status)||valueAxis!==undefined&&(valueAxis!=='secondary'||axis!=='y'||scene.family!=='mixed'||!scene.mixedAxes))throw Error('Invalid reference band state');
    if(typeof from==='string'?axis!=='x'||!text(from,128)||!text(to,128):typeof from!=='number'||typeof to!=='number'||!Number.isFinite(from)||!Number.isFinite(to)||from>=to)throw Error('Invalid reference band endpoints');
    const source={...style,axis,from,to,...(valueAxis===undefined?{}:{valueAxis})};
    if(status!=='visible'){if(Object.hasOwn(fields,'box'))throw Error('Invisible reference band cannot have a box');return {...source,status};}
    const values=record(fields['box']?.value,['x','y','width','height']),box={x:values['x']?.value,y:values['y']?.value,width:values['width']?.value,height:values['height']?.value};
    if(!Object.values(box).every(value=>typeof value==='number'&&Number.isFinite(value))||box.x<0||box.y<0||box.width<=0||box.height<=0||box.x+box.width>scene.width||box.y+box.height>scene.height)throw Error('Invalid reference band coordinates');
    return {...source,status:'visible' as const,box};
  });
}
export function sameReferenceBandPaint(a:NativeReferenceBandStyle,b:NativeReferenceBandStyle):boolean{return a.color===b.color&&a.opacity===b.opacity;}
export function sameReferenceBandStyle(a:NativeReferenceBandStyle,b:NativeReferenceBandStyle):boolean{return a.label===b.label&&sameReferenceBandPaint(a,b);}
