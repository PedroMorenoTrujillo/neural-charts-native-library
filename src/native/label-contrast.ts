function luminance(color:string):number{
  const linear=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  return linear[0]!*.2126+linear[1]!*.7152+linear[2]!*.0722;
}
/** Black/white label ink for an owned opaque #RRGGBB series colour. */
export function labelInk(color:string):string{
  return luminance(color)>.179?'#000000':'#FFFFFF';
}
/** Preserve the series colour when readable, or move it towards a contrasting neutral. */
export function textColorOnSurface(color:string,surface:string):string{
  const background=luminance(surface)+.05;
  const readable=(ink:string)=>{
    const foreground=luminance(ink)+.05;
    return Math.max(foreground,background)/Math.min(foreground,background)>=4.5;
  };
  if(readable(color))return color;
  const fallback=labelInk(surface),target=fallback==='#FFFFFF'?255:0;
  const channels=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
  for(let step=1;step<10;step++){
    const adjusted='#'+channels.map(channel=>Math.round(channel+(target-channel)*step/10).toString(16).padStart(2,'0')).join('');
    if(readable(adjusted))return adjusted;
  }
  return fallback;
}
/** Contrast against the painted cell composited over the actual plot surface. */
export function labelInkOnFill(color:string,opacity:number,surface:string):string{
  const alpha=Math.max(0,Math.min(1,opacity));
  const composite='#'+[1,3,5].map(i=>Math.round(parseInt(color.slice(i,i+2),16)*alpha+parseInt(surface.slice(i,i+2),16)*(1-alpha)).toString(16).padStart(2,'0')).join('');
  return labelInk(composite);
}
