/** Bounded presentation formatting: never turn a small nonzero value into a displayed zero. */
export function chartNumberFormatter(locale:'es'|'en'):(value:number)=>string {
  const standard=new Intl.NumberFormat(locale,{maximumSignificantDigits:10});
  let scientific:Intl.NumberFormat|undefined;
  try{scientific=new Intl.NumberFormat(locale,{notation:'scientific',maximumSignificantDigits:6});}catch{/* Older native Intl implementations still get a bounded readable exponent. */}
  return value=>{
    if(!Number.isFinite(value))return'—';if(value===0)return'0';
    if(Math.abs(value)>=1e9||Math.abs(value)<.001)return scientific?.format(value)??value.toExponential(5).replace('e','E').replace('.',locale==='es'?',':'.');
    return standard.format(value);
  };
}

/** Readable derived percentages, retaining small nonzero contributions. */
export function chartPercentageFormatter(locale:'es'|'en'):(value:number)=>string{
  const compact=new Intl.NumberFormat(locale,{maximumFractionDigits:2}),precise=chartNumberFormatter(locale);
  return value=>!Number.isFinite(value)||value!==0&&Math.abs(value)<.01?precise(value):compact.format(value);
}
