/** Validate the bounded JSON boundary only. The public Core remains the sole
 * owner of silhouette topology, triangles, coordinate and gap semantics. */
function checkPictorialShape(value:unknown):string|null{
  const pending:{value:unknown;depth:number}[]=[{value,depth:0}],seen=new WeakSet<object>();let count=0;
  while(pending.length){
    const item=pending.pop()!,v=item.value;
    if(++count>2048||item.depth>8)return 'Silhouette JSON exceeds its safety budget.';
    if(v===null||typeof v==='boolean')continue;
    if(typeof v==='string'){if(v.length>256)return 'Silhouette strings exceed 256 characters.';continue;}
    if(typeof v==='number'){if(!Number.isFinite(v))return 'Silhouette coordinates must be finite.';continue;}
    if(!v||typeof v!=='object')return 'Use a typed preset or normalized triangle mesh.';
    if(seen.has(v))return 'Silhouette JSON cannot contain cycles or repeated object references.';
    seen.add(v);
    const array=Array.isArray(v),prototype=Object.getPrototypeOf(v);
    if(array?prototype!==Array.prototype:prototype!==Object.prototype&&prototype!==null)return 'Silhouette JSON must contain plain objects and arrays.';
    const keys=Reflect.ownKeys(v);
    if(keys.length>193||keys.some(key=>typeof key!=='string'))return 'Silhouette objects exceed their safety budget.';
    const descriptors=Object.getOwnPropertyDescriptors(v);
    if(array&&((descriptors['length']?.value??Infinity)>192))return 'Silhouette arrays exceed their safety budget.';
    for(const [key,descriptor]of Object.entries(descriptors)){
      if(array&&key==='length')continue;
      if(descriptor.get||descriptor.set)return 'Silhouette JSON cannot contain accessors.';
      pending.push({value:descriptor.value,depth:item.depth+1});
    }
  }
  if(!value||typeof value!=='object'||Array.isArray(value))return 'Use a typed preset or normalized triangle mesh.';
  const d=Object.getOwnPropertyDescriptors(value),type=d['type']?.value;
  if(type==='preset')return Object.keys(d).some(k=>k!=='type'&&k!=='name')||!['person','bottle','heart'].includes(d['name']?.value)?'Choose person, bottle or heart.':null;
  if(type==='mesh')return Object.keys(d).some(k=>k!=='type'&&k!=='mesh')||!d['mesh']?.value||typeof d['mesh'].value!=='object'?'Use a normalized triangle mesh.':null;
  return 'Use a typed preset or normalized triangle mesh.';
}
export function pictorialShapeIssue(value:unknown):string|null{
  try{return checkPictorialShape(value);}catch{return 'Silhouette JSON could not be read safely.';}
}
