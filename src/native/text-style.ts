import type {NativeTextStyleOptions} from '../library/contracts.js';

export type ResolvedTextStyle=Readonly<{textAlign:'left'|'center'|'right';color:string;fontSize:number;fontWeight:'400'|'500'|'600'|'700';lineHeight:number|undefined}>;
export function nativeTextStyle(input:NativeTextStyleOptions|undefined,defaults:Readonly<{align:'left'|'center'|'right';color:string;fontSize:number;fontWeight:400|500|600|700}>):ResolvedTextStyle{
  if(input!==undefined&&(!input||typeof input!=='object'||Array.isArray(input)))throw Error('Invalid text style');
  const descriptors=input?Object.getOwnPropertyDescriptors(input):{};
  for(const key of Reflect.ownKeys(descriptors))if(typeof key!=='string'||!['align','color','fontSize','fontWeight'].includes(key)||descriptors[key]?.get||descriptors[key]?.set)throw Error('Invalid text style property');
  const align=descriptors['align']?.value??defaults.align,color=descriptors['color']?.value??defaults.color,fontSize=descriptors['fontSize']?.value??defaults.fontSize,fontWeight=descriptors['fontWeight']?.value??defaults.fontWeight;
  if(!['left','center','right'].includes(align)||typeof color!=='string'||!/^#[\da-f]{6}$/i.test(color)||typeof fontSize!=='number'||!Number.isFinite(fontSize)||fontSize<10||fontSize>40||![400,500,600,700].includes(fontWeight))throw Error('Invalid text style value');
  return {textAlign:align,color,fontSize,fontWeight:String(fontWeight) as ResolvedTextStyle['fontWeight'],lineHeight:descriptors['fontSize']?.value===undefined?undefined:Math.ceil(fontSize*1.45)};
}
export function sameTextStyle(a:ResolvedTextStyle,b:ResolvedTextStyle):boolean{return a.textAlign===b.textAlign&&a.color===b.color&&a.fontSize===b.fontSize&&a.fontWeight===b.fontWeight&&a.lineHeight===b.lineHeight;}
