/** Shorten painted numeric ticks without changing positions or observations.
 * Increase precision when a narrow viewport would otherwise duplicate labels. */
export function nativeLogAxisLabels<T extends Readonly<{label:string}>>(labels:readonly T[],enabled:boolean):readonly T[]{
  if(!enabled||!labels.length)return labels;
  const values=labels.map(item=>Number(item.label));
  if(values.some(value=>!Number.isFinite(value)||value<=0))return labels;
  for(let precision=5;precision<=15;precision++){
    const text=values.map(value=>String(Number(value.toPrecision(precision))));
    if(new Set(text).size===new Set(values).size)return labels.map((item,index)=>({...item,label:text[index]!}));
  }
  return labels;
}
