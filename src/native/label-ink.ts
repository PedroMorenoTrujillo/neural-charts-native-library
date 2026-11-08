/** Choose opaque black/white text against the actual composited series fill. */
export function labelInk(color:string,background?:string,opacity=1):string{
  const rgb=[1,3,5].map(i=>(parseInt(color.slice(i,i+2),16)*opacity+(background?parseInt(background.slice(i,i+2),16)*(1-opacity):0))/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  return rgb[0]!*.2126+rgb[1]!*.7152+rgb[2]!*.0722>.179?'#000000':'#FFFFFF';
}
