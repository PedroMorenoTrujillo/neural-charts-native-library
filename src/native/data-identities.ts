interface DataIdentities {readonly series:ReadonlyMap<string,ReadonlySet<string>>;readonly categories:ReadonlySet<string>;readonly xKind:unknown;}
const indices=new WeakMap<object,DataIdentities|null>();
const value=(input:unknown,key:string):unknown=>input&&typeof input==='object'?Object.getOwnPropertyDescriptor(input,key)?.value:undefined;
/** Input references are immutable by contract. Inspect identity fields once;
 * never invoke accessors or normalize values during a style-only change. */
export function dataIdentities(data:unknown):DataIdentities|null{
  if(!data||typeof data!=='object')return null;
  if(indices.has(data))return indices.get(data)!;
  const reject=()=>{indices.set(data,null);return null;};
  const type=value(data,'type');
  if(type==='histogram'||type==='bellcurve'){const result={series:new Map([['distribution',new Set<string>()]]),categories:new Set<string>(),xKind:type==='histogram'?'category':'linear'};indices.set(data,result);return result;}
  const rows=value(data,'series');if(!Array.isArray(rows)||rows.length>16)return reject();
  const series=new Map<string,ReadonlySet<string>>();let total=0;
  for(let i=0;i<rows.length;i++){
    const row=value(rows,String(i)),id=value(row,'id'),points=value(row,'data');
    if(typeof id!=='string'||!id||id.length>128||series.has(id)||!Array.isArray(points)||(total+=points.length)>10000)return reject();
    const ids=new Set<string>();
    for(let j=0;j<points.length;j++){const point=value(points,String(j)),pointId=value(point,'id');if(typeof pointId!=='string'||!pointId||pointId.length>128||ids.has(pointId))return reject();ids.add(pointId);}
    series.set(id,ids);
  }
  const x=value(value(data,'axes'),'x'),xKind=value(x,'type'),categories=new Set<string>(),values=value(x,'values');
  if(xKind==='category'){
    if(!Array.isArray(values)||values.length>64)return reject();
    for(let i=0;i<values.length;i++){const id=value(value(values,String(i)),'id');if(typeof id!=='string'||!id||id.length>((type==='bullet'||type==='variwide')?256:128)||categories.has(id))return reject();categories.add(id);}
  }
  const result={series,categories,xKind};indices.set(data,result);return result;
}
