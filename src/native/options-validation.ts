import {pictorialShapeIssue} from './pictorial-options.js';
import {chartCapabilities,isChartFamily,supportsDataLabelLayout,supportsReferenceAxis} from '../library/chart-capabilities.js';
import type {NativeChartData,NativeChartOptions} from './data-options.js';
import type {NativePlanningResult} from './plan.js';
import {dataIdentities} from './data-identities.js';
import {identityKey} from '../library/contracts.js';
import {nativeReferenceBandGroups} from './reference-options.js';
type Diagnostic=Extract<NativePlanningResult,{status:'invalid'}>['diagnostic'];
type Rule='stackGroups'|'sourceSeriesIds'|'pictorialShape'|'colorScale'|'colorStops'|'colorClasses'|'contourLevels'|'wordRotations'|'bulletBands'|'boolean'|'number'|'string'|'color'|'fontSize'|'fontWeight'|'markerDiameter'|'markerBorder'|'referenceWidth'|'referenceValue'|'referenceLines'|'referenceBands'|'referenceOpacity'|'points'|'series'|'window'|'numericWindow'|readonly string[]|{readonly [key:string]:Rule};
const logScale:Rule={type:['log'],base:'number'};
const textStyle:Rule={align:['left','center','right'],color:'color',fontSize:'fontSize',fontWeight:'fontWeight'};
const rules:Rule={
  rendering:{active:'boolean'},
  colorAxis:{visible:'boolean',scale:'colorScale'},title:'string',subtitle:'string',format:{unit:'string',secondaryUnit:'string'},
  axes:{secondaryY:{visible:'boolean',title:'string',titleStyle:textStyle,referenceLines:'referenceLines',referenceBands:'referenceBands'},visible:'boolean',labels:'boolean',ticks:'boolean',grid:'boolean',x:{scale:logScale,visible:'boolean',title:'string',titleStyle:textStyle,referenceLines:'referenceLines',referenceBands:'referenceBands'},y:{scale:logScale,visible:'boolean',title:'string',titleStyle:textStyle,referenceLines:'referenceLines',referenceBands:'referenceBands'}},
  legend:{visible:'boolean',position:['top','bottom','left','right'],interactive:'boolean'},
  tooltip:{mode:['floating','docked','off'],content:['point','shared'],pinnable:'boolean',crosshair:'boolean'},
  animation:{enabled:'boolean',durationMs:'number',revision:'number'},
  interaction:{mode:['explore','tap'],haptics:'boolean',selectionControls:'boolean'},
  layout:{style:['solid','needle'],endAngle:'number',tickCount:'number',bandwidth:'number',resolution:'number',normalization:['width','area','count'],coordinates:['cartesian','polar'],innerRadiusRatio:'number',gapRatio:'number',minFontSize:'number',maxFontSize:'number',padding:'number',seed:'number',maxWords:'number',rotations:'wordRotations',shape:'pictorialShape',gap:'number',background:'boolean',tileShape:['hexagon','circle','diamond','square'],levels:'contourLevels',segmentBudget:'number',startAngle:'number',nodeRadius:'number',linkWidth:'number',bands:'bulletBands',pointPadding:'number',grouping:['grouped','overlap'],rowPadding:'number',labelPosition:['alternate','above','below'],labelMaxWidth:'number',orientation:['horizontal','vertical'],nodeWidth:'number',nodePadding:'number',splitSeries:'boolean',columns:'number',minRadiusRatio:'number',radiusScale:['area','radius'],markerRadius:'number',whiskerWidth:'number',capWidth:'number',neckWidth:'number',neckHeight:'number',reversed:'boolean',stacking:['sum','percent'],stackGroups:'stackGroups',stackLabels:'boolean'},
  viewport:{axes:['x','y','xy'],pinch:'boolean',pan:'boolean',controls:'boolean',initial:{x:'window',y:'numericWindow'}},
  appearance:{opacity:'number',waterfall:{positiveColor:'color',negativeColor:'color',totalColor:'color',connectorColor:'color'},locale:['es','en'],theme:['light','dark','system'],title:textStyle,subtitle:textStyle,plotHeight:'number',minPlotWidth:'number',lineWidth:'number',markers:{visible:'boolean',diameter:'markerDiameter',shape:['circle','square','diamond','triangle'],fillColor:'color',borderColor:'color',borderWidth:'markerBorder'},dataLabels:'boolean',dataLabelLayout:['auto','all','truncate'],axisLabelLayout:['auto','all','truncate'],series:'series',points:'points'},
};
const invalid=(path:string,message='Unsupported chart option.'):Diagnostic=>({code:'INVALID_CONFIG',reason:'INVALID_CHART_OPTION',path,message});
function validate(value:unknown,rule:Rule,path:string,longSeries=false):Diagnostic|null{
  if(value===undefined)return null;
  if(rule==='stackGroups'||rule==='sourceSeriesIds'){
    const limit=rule==='stackGroups'?8:16;
    if(!Array.isArray(value)||value.length<1||value.length>limit)return invalid(path,'Expected a bounded nonempty partition.');
    const ids=new Set<string>();
    for(let i=0;i<value.length;i++){
      const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d||d.get||d.set)return invalid(path+'.'+i);
      const item=d.value;
      if(rule==='sourceSeriesIds'){
        if(typeof item!=='string'||!item||item.length>64||ids.has(item))return invalid(path+'.'+i);ids.add(item);
      }else{
        const issue=validate(item,{id:'string',label:'string',seriesIds:'sourceSeriesIds'},path+'.'+i);if(issue)return issue;
        if(!item||typeof item.id!=='string'||!item.id||item.id.length>64||ids.has(item.id)||typeof item.label!=='string'||!Array.isArray(item.seriesIds))return invalid(path+'.'+i);ids.add(item.id);
      }
    }
    return null;
  }
  if(rule==='pictorialShape'){const issue=pictorialShapeIssue(value);return issue?invalid(path,issue):null;}
  if(rule==='colorScale'){
    if(!value||typeof value!=='object'||Array.isArray(value))return invalid(path);
    const type=Object.getOwnPropertyDescriptor(value,'type')?.value;
    return type==='continuous'?validate(value,{type:['continuous'],domain:'numericWindow',stops:'colorStops',missingColor:'color'},path):type==='classes'?validate(value,{type:['classes'],classes:'colorClasses',missingColor:'color',unclassifiedColor:'color'},path):invalid(path+'.type');
  }
  if(rule==='colorStops'||rule==='colorClasses'){
    const limit=rule==='colorStops'?8:16;if(!Array.isArray(value)||value.length>(limit)||value.length<(rule==='colorStops'?2:1))return invalid(path);
    for(let i=0;i<value.length;i++){const descriptor=Object.getOwnPropertyDescriptor(value,String(i));if(!descriptor||descriptor.get||descriptor.set)return invalid(path+'.'+i);const error=validate(descriptor.value,rule==='colorStops'?{at:'number',color:'color'}:{id:'string',label:'string',minInclusive:'referenceValue',maxExclusive:'referenceValue',color:'color'},path+'.'+i);if(error)return error;}
    return null;
  }
  if(rule==='wordRotations'){
    if(!Array.isArray(value)||value.length<1||value.length>2)return invalid(path,'Use zero and/or ninety degrees.');
    const seen=new Set<number>();
    for(let i=0;i<value.length;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d||d.get||d.set||(d.value!==0&&d.value!==90)||seen.has(d.value))return invalid(path,'Use unique rotations of zero or ninety degrees.');seen.add(d.value);}
    return null;
  }
  if(rule==='contourLevels'){
    if(!Array.isArray(value)||value.length<1||value.length>8)return invalid(path,'Use one to eight strictly increasing isoline thresholds.');
    const ids=new Set<string>();let previous=-Infinity;
    for(let index=0;index<value.length;index++){
      const descriptor=Object.getOwnPropertyDescriptor(value,String(index));if(!descriptor||descriptor.get||descriptor.set)return invalid(path+'.'+index);
      const item=descriptor.value,error=validate(item,{id:'string',value:'number'},path+'.'+index);if(error)return error;
      if(!item||typeof item.id!=='string'||!item.id||item.id.length>128||ids.has(item.id)||!Number.isFinite(item.value)||item.value<=previous)return invalid(path+'.'+index,'Use unique IDs and strictly increasing finite values.');
      ids.add(item.id);previous=item.value;
    }
    return null;
  }
  if(rule==='bulletBands'){
    if(!Array.isArray(value)||value.length>32)return invalid(path,'Maximum 32 qualitative bands.');
    const ids=new Set<string>();
    for(let index=0;index<value.length;index++){
      const descriptor=Object.getOwnPropertyDescriptor(value,String(index));if(!descriptor||descriptor.get||descriptor.set)return invalid(path+'.'+index);
      const item=descriptor.value,error=validate(item,{id:'string',from:'number',to:'number',label:'string',color:'color'},path+'.'+index);if(error)return error;
      if(!item||typeof item.id!=='string'||!item.id||item.id.length>128||ids.has(item.id)||!Number.isFinite(item.from)||!Number.isFinite(item.to)||item.to<=item.from||item.label!==undefined&&item.label.length>256)return invalid(path+'.'+index,'Use unique IDs and increasing finite band bounds.');
      ids.add(item.id);
    }
    return null;
  }
  if(rule==='color')return typeof value==='string'&&/^#[\da-f]{6}$/i.test(value)?null:invalid(path,'Use a #RRGGBB color.');
  if(rule==='fontWeight')return typeof value==='number'&&[400,500,600,700].includes(value)?null:invalid(path,'Use numeric font weight 400, 500, 600 or 700.');
  if(rule==='referenceWidth')return typeof value==='number'&&Number.isFinite(value)&&value>=.5&&value<=6?null:invalid(path,'Use 0.5–6 logical points.');
  if(rule==='referenceValue')return typeof value==='number'&&Number.isFinite(value)||typeof value==='string'&&value.length>0&&value.length<=256?null:invalid(path,'Use a finite number or category ID.');
  if(rule==='referenceOpacity')return typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1?null:invalid(path,'Use opacity between 0 and 1.');
  if(rule==='referenceBands'){
    if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length>32)return invalid(path,'Use a plain array with at most 32 reference bands across all axes.');
    const fields=Object.getOwnPropertyDescriptors(value);
    if(Reflect.ownKeys(fields).some(key=>typeof key!=='string'||key!=='length'&&(!/^(0|[1-9]\d*)$/.test(key)||Number(key)>=value.length)||typeof key==='string'&&(fields[key]?.get||fields[key]?.set)))return invalid(path,'Reference band arrays cannot contain extra properties, symbols or accessors.');
    const ids=new Set<string>();
    for(let index=0;index<value.length;index++){
      const descriptor=fields[String(index)];if(!descriptor||descriptor.get||descriptor.set)return invalid(path+'.'+index);
      const item=descriptor.value,error=validate(item,{id:'string',from:'referenceValue',to:'referenceValue',label:'string',color:'color',opacity:'referenceOpacity'},path+'.'+index);if(error)return error;
      if(!item||typeof item.id!=='string'||!item.id||item.id.length>64||item.from===undefined||item.to===undefined||item.label!==undefined&&item.label.length>200)return invalid(path+'.'+index,'Use an ID, from/to endpoints and an optional label up to 200 characters.');
      if(ids.has(item.id))return invalid(path+'.'+index+'.id','Duplicate reference band ID.');ids.add(item.id);
    }
    return null;
  }
  if(rule==='points'||rule==='referenceLines'){
    const maximum=rule==='points'?256:16;
    if(!Array.isArray(value)||value.length>maximum)return invalid(path,`Maximum ${maximum} entries.`);
    const ids=new Set<string>();
    for(let index=0;index<value.length;index++){
      const descriptor=Object.getOwnPropertyDescriptor(value,String(index));if(!descriptor||descriptor.get||descriptor.set)return invalid(path+'.'+index);
      const item=descriptor.value,error=validate(item,rule==='points'?{seriesId:'string',pointId:'string',color:'color'}:{id:'string',value:'referenceValue',label:'string',color:'color',width:'referenceWidth',dash:['solid','dash','dot']},path+'.'+index);if(error)return error;
      if(!item||typeof item!=='object')return invalid(path+'.'+index);
      if(rule==='points'){
        if(typeof item.seriesId!=='string'||!item.seriesId||item.seriesId.length>128||typeof item.pointId!=='string'||!item.pointId||item.pointId.length>128||typeof item.color!=='string')return invalid(path+'.'+index);
      }else if(typeof item.id!=='string'||!item.id||item.id.length>64||item.value===undefined)return invalid(path+'.'+index);
      const key=rule==='points'?identityKey(item):item.id;if(ids.has(key))return invalid(path+'.'+index,'Duplicate identity.');ids.add(key);
    }
    return null;
  }
  if(rule==='fontSize'||rule==='markerDiameter'||rule==='markerBorder'){
    const [minimum,maximum]:readonly[number,number]=rule==='fontSize'?[10,40]:rule==='markerDiameter'?[2,12]:[0,6];
    return typeof value==='number'&&Number.isFinite(value)&&value>=minimum&&value<=maximum?null:invalid(path,`Use ${minimum}–${maximum} logical points.`);
  }
  if(rule==='window'||rule==='numericWindow'){
    if(Array.isArray(value)){
      if(value.length!==2)return invalid(path,'Expected increasing numeric bounds.');
      const low=Object.getOwnPropertyDescriptor(value,'0'),high=Object.getOwnPropertyDescriptor(value,'1');
      if(!low||!high||low.get||low.set||high.get||high.set||typeof low.value!=='number'||typeof high.value!=='number'||!Number.isFinite(low.value)||!Number.isFinite(high.value)||low.value>=high.value)return invalid(path,'Expected finite increasing numeric bounds.');
      return null;
    }
    if(rule==='numericWindow')return invalid(path,'This axis requires a numeric window.');
    const error=validate(value,{firstId:'string',lastId:'string'},path);if(error)return error;
    const descriptors=Object.getOwnPropertyDescriptors(value as object);
    return descriptors['firstId']?.value&&descriptors['lastId']?.value&&descriptors['firstId']!.value.length<=128&&descriptors['lastId']!.value.length<=128?null:invalid(path,'Expected firstId and lastId category identities.');
  }
  if(rule==='series'){
    if(!Array.isArray(value)||value.length>16)return invalid(path);
    const ids=new Set<string>();
    for(let i=0;i<value.length;i++){
      const descriptor=Object.getOwnPropertyDescriptor(value,String(i));
      if(!descriptor||descriptor.get||descriptor.set)return invalid(path+'.'+i);
      const item=descriptor.value,error=validate(item,{id:'string',color:'string',name:'string'},path+'.'+i,longSeries);if(error)return error;
      if(!item?.id||item.id.length>128||ids.has(item.id)||typeof item.color!=='string'||!/^#[\da-f]{6}$/i.test(item.color))return invalid(path+'.'+i);
      ids.add(item.id);
    }
    return null;
  }
  if(typeof rule==='string'){
    if(typeof value!==rule||rule==='number'&&!Number.isFinite(value))return invalid(path);
    if(rule==='string'){
      const maximum=longSeries&&path.startsWith('options.appearance.series.')&&path.endsWith('.name')?256:path==='options.subtitle'?1000:path==='options.format.unit'||path==='options.format.secondaryUnit'?64:200;
      if((value as string).length>maximum)return invalid(path,`Maximum ${maximum} characters.`);
    }
    return null;
  }
  if(Array.isArray(rule))return typeof value==='string'&&rule.includes(value)?null:invalid(path);
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)return invalid(path);
  const keys=Reflect.ownKeys(value);
  if(keys.length>Object.keys(rule).length)return invalid(path,'Too many option properties.');
  for(const key of keys){
    if(typeof key!=='string'||!Object.hasOwn(rule,key))return invalid(path+'.'+String(key));
    const descriptor=Object.getOwnPropertyDescriptor(value,key)!;
    if(descriptor.get||descriptor.set)return invalid(path+'.'+key);
    const error=validate(descriptor.value,(rule as {[key:string]:Rule})[key]!,path+'.'+key,longSeries);if(error)return error;
  }
  return null;
}
export function optionsDiagnostic(data:NativeChartData,options:NativeChartOptions):Diagnostic|null{
  const family=data&&typeof data==='object'?Object.getOwnPropertyDescriptor(data,'type')?.value:undefined;
  const error=validate(options,rules,'options',family==='pictorial'||family==='venn');if(error)return error;
  if(!options||typeof options!=='object')return invalid('options');
  if(isChartFamily(family)){
    if(options.appearance?.dataLabelLayout!==undefined&&!supportsDataLabelLayout(family))return invalid('options.appearance.dataLabelLayout','This chart uses its own data label layout.');
    if(options.appearance?.axisLabelLayout!==undefined&&chartCapabilities[family].axes!=='cartesian')return invalid('options.appearance.axisLabelLayout','This option applies to Cartesian axes.');
  }
  for(const axis of ['x','y'] as const){
    const settings=options.axes?.[axis],scale=settings&&'scale' in settings?settings.scale:undefined;if(scale===undefined)continue;
    if(!['line','scatter','bubble'].includes(family)||scale.type!=='log'||scale.base!==undefined&&scale.base!==10)return invalid('options.axes.'+axis+'.scale','Logarithmic projection supports line, scatter and bubble with base 10 only.');
    const source=Object.getOwnPropertyDescriptor(data,'axes')?.value,coordinate=source&&Object.getOwnPropertyDescriptor(source,axis)?.value;
    if(!coordinate||coordinate.type!=='linear'||coordinate.includeZero===true)return invalid('options.axes.'+axis+'.scale','Use a positive numeric source axis without includeZero. Category/time axes cannot use a logarithmic projection.');
  }
  const circular=family==='pie'||family==='donut'||family==='gauge',layout=options.layout;
  if(layout&&circular){
    const allowed=family==='gauge'?['startAngle','endAngle','style','tickCount']:['startAngle','endAngle'];
    if(Reflect.ownKeys(layout).some(key=>typeof key!=='string'||!allowed.includes(key)))return invalid('options.layout','This circular chart supports only its arc and dial options.');
    const start='startAngle' in layout?layout.startAngle:undefined,end='endAngle' in layout?layout.endAngle:undefined;
    const ring=data.type==='gauge'&&data.preset==='ring',from=start??(family==='gauge'&&!ring?-90:0),to=end??(family==='gauge'&&!ring?90:360);
    if(from< -360||from>360||to< -359||to>720||to-from<1||to-from>360)return invalid('options.layout','Use a clockwise sweep of 1–360 degrees within the documented angle bounds.');
    const style='style' in layout?layout.style:undefined,ticks='tickCount' in layout?layout.tickCount:undefined;
    if(ticks!==undefined&&(style!=='needle'||!Number.isInteger(ticks)||ticks<2||ticks>12))return invalid('options.layout.tickCount','Needle dials accept a target density of 2–12 ticks.');
  }
  if(layout&&!circular&&['endAngle','style','tickCount'].some(key=>Object.getOwnPropertyDescriptor(layout,key)?.value!==undefined))return invalid('options.layout','Arc end and dial options require pie, donut or gauge data.');
  const layoutStacking=options.layout&&'stacking' in options.layout?options.layout.stacking:undefined;
  const layoutStackLabels=options.layout&&'stackLabels' in options.layout?options.layout.stackLabels:undefined;
  const layoutNeckWidth=options.layout&&'neckWidth' in options.layout?options.layout.neckWidth:undefined;
  const layoutNeckHeight=options.layout&&'neckHeight' in options.layout?options.layout.neckHeight:undefined;
  const layoutReversed=options.layout&&'reversed' in options.layout?options.layout.reversed:undefined;
  const layoutWhiskerWidth=options.layout&&'whiskerWidth' in options.layout?options.layout.whiskerWidth:undefined;
  const layoutCapWidth=options.layout&&'capWidth' in options.layout?options.layout.capWidth:undefined;
  const layoutMarkerRadius=options.layout&&'markerRadius' in options.layout?options.layout.markerRadius:undefined;
  const layoutColumns=options.layout&&'columns' in options.layout?options.layout.columns:undefined;
  const layoutMinRadiusRatio=options.layout&&'minRadiusRatio' in options.layout?options.layout.minRadiusRatio:undefined;
  const layoutRadiusScale=options.layout&&'radiusScale' in options.layout?options.layout.radiusScale:undefined;
  const secondary=options.axes&&'secondaryY' in options.axes?options.axes.secondaryY:undefined,secondaryUnit=options.format&&'secondaryUnit' in options.format?options.format.secondaryUnit:undefined;
  const sourceAxes=Object.getOwnPropertyDescriptor(data,'axes')?.value,hasSecondary=family==='mixed'&&sourceAxes&&typeof sourceAxes==='object'&&!!Object.getOwnPropertyDescriptor(sourceAxes,'secondaryY');
  if((secondary!==undefined||secondaryUnit!==undefined)&&!hasSecondary)return invalid('options.axes.secondaryY','Declare data.axes.secondaryY and assign source series before styling its axis or unit.');
  if(secondary?.referenceLines?.some(r=>typeof r.value!=='number'||!Number.isFinite(r.value)))return invalid('options.axes.secondaryY.referenceLines','Secondary references require finite original numeric values.');
  const groups=options.layout&&'stackGroups' in options.layout?options.layout.stackGroups:undefined;
  if(groups!==undefined){
    if(family!=='column'||!layoutStacking)return invalid('options.layout.stackGroups','Grouped stacks require column data and sum/percent stacking.');
    const known=dataIdentities(data)?.series,assigned=new Set<string>();
    for(const g of groups)for(const id of g.seriesIds){if(!known?.has(id)||assigned.has(id))return invalid('options.layout.stackGroups','Every original series must belong to exactly one group.');assigned.add(id);}
    if(assigned.size!==known?.size)return invalid('options.layout.stackGroups','Every original series must belong to exactly one group.');
  }
  const referenceIds=[...(['x','y'] as const).flatMap(axis=>options.axes?.[axis]?.referenceLines??[]),...(secondary?.referenceLines??[])].map(r=>r.id);
  if(referenceIds.length>16||new Set(referenceIds).size!==referenceIds.length)return invalid('options.axes','Use at most 16 reference lines with unique IDs across all axes.');
  const bandGroups=nativeReferenceBandGroups(options),bandIds=bandGroups.flatMap(group=>group.bands.map(band=>band.id));
  if(bandIds.length>32||new Set(bandIds).size!==bandIds.length)return invalid('options.axes','Use at most 32 reference bands with unique IDs across all axes.');
  if(bandGroups.length&&!['line','area','spline','areaspline','column','mixed','scatter','bubble'].includes(family))return invalid('options.axes','Reference bands support line, area, spline, area spline, column/bar, mixed, scatter and bubble only.');
  const bandIdentities=bandGroups.length?dataIdentities(data):undefined;
  for(const group of bandGroups)for(const [index,band]of group.bands.entries()){
    const path='options.axes.'+(group.valueAxis==='secondary'?'secondaryY':group.axis)+'.referenceBands.'+index;
    if(group.axis==='x'&&bandIdentities?.xKind==='category'){
      const categories=[...bandIdentities.categories],first=typeof band.from==='string'?categories.indexOf(band.from):-1,last=typeof band.to==='string'?categories.indexOf(band.to):-1;
      if(first<0||last<first)return invalid(path,'Use existing category IDs in source order; both endpoints are inclusive.');
    }else{
      if(typeof band.from!=='number'||typeof band.to!=='number'||!Number.isFinite(band.from)||!Number.isFinite(band.to)||band.from>=band.to)return invalid(path,'Use increasing finite endpoints in the represented axis units (percent-stacked Y uses 0–100).');
      if(group.axis==='x'&&bandIdentities?.xKind==='time'&&(!Number.isInteger(band.from)||!Number.isInteger(band.to)||Math.abs(band.from)>8.64e15||Math.abs(band.to)>8.64e15))return invalid(path,'Time endpoints must be supported integer timestamps.');
    }
  }
  if(family==='heatmap'){if(options.axes?.grid!==undefined)return invalid('options.axes.grid','Matrix separation uses layout.gapRatio.');if(options.legend!==undefined)return invalid('options.legend','Use the quantitative colorAxis; matrix cells are not visibility series.');if(options.tooltip?.crosshair!==undefined)return invalid('options.tooltip.crosshair');if(options.appearance?.series!==undefined)return invalid('options.appearance.series','Use colorAxis.scale.');if(options.axes?.x?.referenceLines!==undefined||options.axes?.y?.referenceLines!==undefined)return invalid('options.axes','Reference lines are not supported on this category matrix.');}
  if(family==='tilemap'&&options.tooltip?.crosshair!==undefined)return invalid('options.tooltip.crosshair','Tilemaps have no numeric crosshair.');
  if(options.colorAxis&&family!=='tilemap'&&family!=='heatmap')return invalid('options.colorAxis','Color axes apply to tilemaps.');
  if(options.appearance?.opacity!==undefined&&(!['heatmap','tilemap'].includes(family)||options.appearance.opacity<0||options.appearance.opacity>1))return invalid('options.appearance.opacity','Use opacity from zero to one on tilemaps.');
  if(family==='tilemap'&&(options.appearance?.series!==undefined||options.appearance?.dataLabels!==undefined))return invalid('options.appearance','Tilemap cell colors come from colorAxis.scale; inline data labels are unsupported.');
  if(options.appearance?.waterfall&&family!=='waterfall')return invalid('options.appearance.waterfall');
  if(options.axes&&(!isChartFamily(family)||chartCapabilities[family].axes==='none'&&family!=='parallel'&&family!=='dendrogram'))return invalid('options.axes','This chart family has no configurable axes.');
  if(options.viewport&&(!isChartFamily(family)||chartCapabilities[family].viewport===false))return invalid('options.viewport','This chart type does not support viewport controls.');
  if(family==='pictorial'){
    if(options.axes?.y!==undefined||options.axes?.grid!==undefined||options.axes?.x?.referenceLines!==undefined)return invalid('options.axes','Pictorial supports category X labels and titles only.');
    if(options.appearance?.dataLabels!==undefined)return invalid('options.appearance.dataLabels','Pictorial values are available through touch and accessible navigation; inline labels are not supported.');
    if(options.tooltip?.crosshair!==undefined)return invalid('options.tooltip.crosshair','Pictorial has no numeric crosshair.');
  }
  if(family==='timeline'&&options.axes?.y!==undefined)return invalid('options.axes.y','Timeline has no Y data axis; lane labels are derived from its series.');
  if(family==='timeline'&&options.axes?.grid!==undefined)return invalid('options.axes.grid','Timeline has no numeric grid.');
  if(family==='variwide'&&options.viewport&&(options.viewport.axes!==undefined&&options.viewport.axes!=='y'||options.viewport.initial!==undefined&&Object.hasOwn(options.viewport.initial,'x')))return invalid('options.viewport','Variwide supports numeric Y zoom only; weighted X zoom is unavailable.');
  if((family==='flame'||family==='xrange'||family==='timeline')&&options.viewport&&(options.viewport.axes!==undefined&&options.viewport.axes!=='x'||options.viewport.initial!==undefined&&Object.hasOwn(options.viewport.initial,'y')))return invalid('options.viewport','Temporal charts support a numeric or UTC X viewport only.');
  if((family==='xrange'||family==='timeline')&&options.axes?.y?.referenceLines!==undefined)return invalid('options.axes.y.referenceLines','Temporal charts support X reference lines only.');
  if(family==='pareto'&&options.viewport&&(options.viewport.axes!==undefined&&options.viewport.axes!=='x'||options.viewport.initial!==undefined&&Object.hasOwn(options.viewport.initial,'y')))return invalid('options.viewport','Pareto supports a category X viewport only.');
  if(family==='sankey'&&options.viewport?.axes!==undefined&&options.viewport.axes!=='xy')return invalid('options.viewport.axes','Sankey uses normalized XY layout zoom.');
  if(family==='packedbubble'&&options.viewport?.axes!==undefined&&options.viewport.axes!=='xy')return invalid('options.viewport.axes','Packed bubbles require equal-scale XY zoom.');
  if(family==='contour'&&(!options.layout||!('levels' in options.layout)||options.layout.levels===undefined))return invalid('options.layout.levels','Provide isoline threshold IDs and values.');
  if(options.layout&&!circular&&!['flame','violin','dendrogram','parallel','windrose','radialbar','heatmap','venn','wordcloud','pictorial','tilemap','contour','dependencywheel','arcdiagram','chord','bullet','variwide','xrange','timeline','sankey','treegraph','organization','packedbubble','variablepie','item','lollipop','dumbbell','boxplot','errorbar','funnel','pyramid','column','area','areaspline'].includes(family))return invalid('options.layout','Stacking applies to area, area spline, column and horizontal bar charts.');
  if(family==='wordcloud'&&(options.tooltip?.crosshair!==undefined||options.appearance?.dataLabels!==undefined))return invalid('options','Words are their own labels and do not use a numeric crosshair.');
  if(options.axes&&family!=='parallel'&&family!=='dendrogram'&&Reflect.ownKeys(options.axes).some(k=>['visible','labels','ticks'].includes(String(k))))return invalid('options.axes','Independent-axis display flags apply only to parallel coordinates.');
  if((family==='treegraph'||family==='organization')&&options.layout&&Reflect.ownKeys(options.layout).some(key=>key!=='orientation'))return invalid('options.layout','Tree and organization layouts accept orientation only.');
  if(family==='dendrogram'){if(options.axes&&Reflect.ownKeys(options.axes).some(k=>k!=='visible'))return invalid('options.axes','Dendrogram exposes axes.visible only.');if(options.format)return invalid('options.format','Use the source distance unit, or explicitly computed topology levels.');if(options.layout&&Reflect.ownKeys(options.layout).some(k=>k!=='orientation'))return invalid('options.layout','Dendrogram exposes orientation only.');}
  if(family==='flame'||family==='violin'){if(options.format)return invalid('options.format','Measurement units belong to source axes.');if(family==='violin'&&(options.axes?.x?.referenceLines!==undefined||options.axes?.y?.referenceLines!==undefined))return invalid('options.axes','Violin does not expose reference lines.');if(family==='flame'&&options.axes?.y?.referenceLines!==undefined)return invalid('options.axes.y.referenceLines','Flame supports X references only.');}
  if(family==='parallel'&&options.axes&&Reflect.ownKeys(options.axes).some(k=>!['visible','labels','ticks'].includes(String(k))))return invalid('options.axes','Parallel coordinates use per-dimension source axes.');
  if(family==='parallel'&&options.appearance?.dataLabels!==undefined)return invalid('options.appearance.dataLabels','Use axis ticks and original point tooltips.');
  if(family==='parallel'&&options.layout&&'coordinates' in options.layout&&options.layout.coordinates==='polar'&&(options.appearance?.minPlotWidth??0)>0)return invalid('options.appearance.minPlotWidth','Horizontal plot scrolling applies only to Cartesian parallel coordinates.');
  if(options.layout){
    if(family==='flame'&&Reflect.ownKeys(options.layout).some(k=>k!=='rowPadding'))return invalid('options.layout','Flame supports rowPadding only.');
    if(family==='violin'&&Reflect.ownKeys(options.layout).some(k=>!['bandwidth','resolution','normalization','gapRatio'].includes(String(k))))return invalid('options.layout','Only density bandwidth, resolution, normalisation and spacing apply.');
    if('bandwidth' in options.layout&&options.layout.bandwidth!==undefined&&(family!=='violin'||options.layout.bandwidth<=0))return invalid('options.layout.bandwidth');
    if('resolution' in options.layout&&options.layout.resolution!==undefined&&(family!=='violin'||!Number.isInteger(options.layout.resolution)||options.layout.resolution<32||options.layout.resolution>128))return invalid('options.layout.resolution');
    if('normalization' in options.layout&&options.layout.normalization!==undefined&&family!=='violin')return invalid('options.layout.normalization');
    if(family==='parallel'&&Reflect.ownKeys(options.layout).some(k=>k!=='coordinates'))return invalid('options.layout','Parallel coordinates support coordinates only.');
    if('coordinates' in options.layout&&family!=='parallel')return invalid('options.layout.coordinates');
    if((family==='windrose'||family==='radialbar')&&Reflect.ownKeys(options.layout).some(key=>!['gapRatio',family==='windrose'?'stacking':'innerRadiusRatio'].includes(String(key))))return invalid('options.layout','Only the typed circular band options apply.');
    if('innerRadiusRatio' in options.layout&&options.layout.innerRadiusRatio!==undefined&&(family!=='radialbar'||options.layout.innerRadiusRatio<0||options.layout.innerRadiusRatio>.8))return invalid('options.layout.innerRadiusRatio');
    if(family==='heatmap'&&Reflect.ownKeys(options.layout).some(key=>key!=='gapRatio'))return invalid('options.layout','Heatmap supports gapRatio only.');
    if('gapRatio' in options.layout&&options.layout.gapRatio!==undefined&&(!['violin','heatmap','windrose','radialbar'].includes(family)||options.layout.gapRatio<0||options.layout.gapRatio>(family==='violin'?.8:.5)))return invalid('options.layout.gapRatio');
    if(family==='venn'&&Reflect.ownKeys(options.layout).some(key=>key!=='padding'))return invalid('options.layout','Venn supports padding only; it does not stack or use axes.');
    if(family==='venn'&&'padding' in options.layout&&options.layout.padding!==undefined&&(options.layout.padding<0||options.layout.padding>64))return invalid('options.layout.padding','Use spacing from0 to64 logical points.');
    const wordKeys=['minFontSize','maxFontSize','padding','seed','maxWords','rotations'];
    if(family==='wordcloud'&&Reflect.ownKeys(options.layout).some(key=>typeof key!=='string'||!wordKeys.includes(key)))return invalid('options.layout','Wordcloud supports font sizes, padding, rotations, seed and maxWords only.');
    for(const key of wordKeys)if(Object.hasOwn(options.layout,key)&&family!=='wordcloud'&&!(key==='padding'&&family==='venn'))return invalid('options.layout.'+key);
    if(family==='wordcloud'){
      const l=options.layout as import('./wordcloud-data.js').NativeWordCloudLayoutOptions;
      for(const key of ['minFontSize','maxFontSize'] as const)if(l[key]!==undefined&&(l[key]!<4||l[key]!>128))return invalid('options.layout.'+key,'Use a measured logical font size from4 to128.');
      if((l.minFontSize??12)>(l.maxFontSize??48))return invalid('options.layout.maxFontSize','Maximum font size must be at least the minimum.');
      if(l.padding!==undefined&&(l.padding<0||l.padding>16))return invalid('options.layout.padding');
      if(l.maxWords!==undefined&&(!Number.isInteger(l.maxWords)||l.maxWords<1||l.maxWords>128))return invalid('options.layout.maxWords');
      if(l.seed!==undefined&&(!Number.isInteger(l.seed)||l.seed<0||l.seed>4294967295))return invalid('options.layout.seed');
    }
    for(const key of ['shape','gap','background'] as const)if(Object.getOwnPropertyDescriptor(options.layout,key)?.value!==undefined&&family!=='pictorial')return invalid('options.layout.'+key);
    if(family==='pictorial'&&layoutStackLabels!==undefined)return invalid('options.layout.stackLabels','Pictorial has no inline stack labels.');
    if(family==='pictorial'&&'gap' in options.layout&&options.layout.gap!==undefined&&(options.layout.gap<0||options.layout.gap>64))return invalid('options.layout.gap','Use logical spacing from 0 to 64.');
    if('tileShape' in options.layout&&options.layout.tileShape!==undefined&&family!=='tilemap')return invalid('options.layout.tileShape');
    if(family==='tilemap'&&(layoutStacking!==undefined||layoutStackLabels!==undefined))return invalid('options.layout','Tilemap does not support stacking.');
    if('levels' in options.layout&&options.layout.levels!==undefined&&family!=='contour')return invalid('options.layout.levels');
    if('segmentBudget' in options.layout&&options.layout.segmentBudget!==undefined&&(family!=='contour'||!Number.isInteger(options.layout.segmentBudget)||options.layout.segmentBudget<1||options.layout.segmentBudget>8192))return invalid('options.layout.segmentBudget','Use an integer from1 to8192; overflow returns a diagnostic, never partial lines.');
    if(family==='contour'&&Reflect.ownKeys(options.layout).some(key=>key!=='levels'&&key!=='segmentBudget'))return invalid('options.layout','Contour supports levels and segmentBudget only.');
    const relation=family==='dependencywheel'||family==='chord'||family==='arcdiagram',ring=family==='dependencywheel'||family==='chord';
    if(relation&&(layoutStacking!==undefined||layoutStackLabels!==undefined))return invalid('options.layout','Relationship charts do not support stacking.');
    if('startAngle' in options.layout&&options.layout.startAngle!==undefined&&(!ring&&!circular||options.layout.startAngle< -360||options.layout.startAngle>360))return invalid('options.layout.startAngle');
    if('nodeRadius' in options.layout&&options.layout.nodeRadius!==undefined&&(family!=='arcdiagram'||options.layout.nodeRadius<2||options.layout.nodeRadius>24))return invalid('options.layout.nodeRadius');
    if('linkWidth' in options.layout&&options.layout.linkWidth!==undefined&&(family!=='arcdiagram'||options.layout.linkWidth<1||options.layout.linkWidth>48))return invalid('options.layout.linkWidth');
    if((family==='bullet'||family==='variwide')&&(layoutStacking!==undefined||layoutStackLabels!==undefined))return invalid('options.layout','Comparison charts do not support stacking or stack labels.');
    if('pointPadding' in options.layout&&options.layout.pointPadding!==undefined&&(!['tilemap','bullet','variwide'].includes(family)||options.layout.pointPadding<0||options.layout.pointPadding>(family==='tilemap'?32:.9)))return invalid('options.layout.pointPadding','Use a fraction from zero to0.9.');
    if('bands' in options.layout&&options.layout.bands!==undefined&&family!=='bullet')return invalid('options.layout.bands','Qualitative bands belong to bullet charts.');
    if((family==='xrange'||family==='timeline')&&(layoutStacking!==undefined||layoutStackLabels!==undefined&&layoutStackLabels!==false))return invalid('options.layout','Temporal charts do not support stacking or stack labels.');
    if('grouping' in options.layout&&options.layout.grouping!==undefined&&family!=='xrange')return invalid('options.layout.grouping');
    if('rowPadding' in options.layout&&options.layout.rowPadding!==undefined&&(!['flame','xrange'].includes(family)||options.layout.rowPadding<0||options.layout.rowPadding>.9))return invalid('options.layout.rowPadding');
    if('labelPosition' in options.layout&&options.layout.labelPosition!==undefined&&family!=='timeline')return invalid('options.layout.labelPosition');
    if('labelMaxWidth' in options.layout&&options.layout.labelMaxWidth!==undefined&&(family!=='timeline'||options.layout.labelMaxWidth<24||options.layout.labelMaxWidth>240))return invalid('options.layout.labelMaxWidth');
    const shape=family==='funnel'||family==='pyramid',glyph=family==='variablepie'||family==='item'||family==='boxplot'||family==='errorbar'||family==='lollipop'||family==='dumbbell';
    if('orientation' in options.layout&&options.layout.orientation!==undefined&&!['dendrogram','sankey','bullet','treegraph','organization'].includes(family))return invalid('options.layout.orientation');
    if('nodeWidth' in options.layout&&options.layout.nodeWidth!==undefined&&(!['sankey','dependencywheel','chord'].includes(family)||options.layout.nodeWidth<2||options.layout.nodeWidth>64))return invalid('options.layout.nodeWidth');
    if('nodePadding' in options.layout&&options.layout.nodePadding!==undefined&&(!['sankey','dependencywheel','chord'].includes(family)||options.layout.nodePadding<0||options.layout.nodePadding>(ring?20:64)))return invalid('options.layout.nodePadding');
    if('splitSeries' in options.layout&&options.layout.splitSeries!==undefined&&family!=='packedbubble')return invalid('options.layout.splitSeries');
    if(layoutColumns!==undefined&&(family!=='item'||!Number.isInteger(layoutColumns)||layoutColumns<1||layoutColumns>32))return invalid('options.layout.columns');
    if(layoutMinRadiusRatio!==undefined&&(family!=='variablepie'||layoutMinRadiusRatio<0||layoutMinRadiusRatio>1))return invalid('options.layout.minRadiusRatio');
    if(layoutRadiusScale!==undefined&&family!=='variablepie')return invalid('options.layout.radiusScale');
    if(layoutMarkerRadius!==undefined&&(!['timeline','lollipop','dumbbell'].includes(family)||layoutMarkerRadius<(family==='timeline'?0:1)||layoutMarkerRadius>16))return invalid('options.layout.markerRadius');
    if(glyph&&(layoutStacking!==undefined||layoutStackLabels!==undefined))return invalid('options.layout','Statistical glyphs have a fixed layout.');
    if(layoutWhiskerWidth!==undefined&&(family!=='boxplot'||layoutWhiskerWidth<0||layoutWhiskerWidth>1))return invalid('options.layout.whiskerWidth');
    if(layoutCapWidth!==undefined&&(family!=='errorbar'||layoutCapWidth<0||layoutCapWidth>1))return invalid('options.layout.capWidth');
    if(shape&&(layoutStacking!==undefined||layoutStackLabels!==undefined))return invalid('options.layout','Funnel and pyramid do not support stacking.');
    if(!shape&&(layoutNeckWidth!==undefined||layoutNeckHeight!==undefined||layoutReversed!==undefined&&family!=='arcdiagram'))return invalid('options.layout','Shape layout options require funnel or pyramid.');
    if(family==='pyramid'&&(layoutNeckWidth!==undefined||layoutNeckHeight!==undefined))return invalid('options.layout','A pyramid has no neck.');
    for(const key of ['neckWidth','neckHeight'] as const){const value=key==='neckWidth'?layoutNeckWidth:layoutNeckHeight;if(value!==undefined&&(value<0||value>1))return invalid('options.layout.'+key,'Use a fraction from zero to one.');}
  }
  if(layoutStackLabels&&!layoutStacking)return invalid('options.layout.stackLabels','Stack labels require sum or percent stacking.');
  if(options.legend&&(family==='flame'||family==='dendrogram'||family==='gauge'||family==='treemap'))return invalid('options.legend','This chart has no visibility legend.');
  if(family==='parallel'&&options.format)return invalid('options.format','Each dimension declares its own unit in data.axes.');
  if(options.format&&['gauge','vector','windbarb'].includes(family))return invalid('options.format','This type uses its source unit; wind speeds are always m/s.');
  if(family==='gauge'&&options.appearance?.series?.some(series=>series.id!=='reading'))return invalid('options.appearance.series','Gauge appearance configures the reading ID. Semantic band colors belong to data.bands.');
  if(options.tooltip?.content==='shared'&&!['fan','parallel','bullet','streamgraph','lollipop','dumbbell','columnpyramid','boxplot','errorbar','arearange','areasplinerange','columnrange','pareto','line','area','streamgraph','areaspline','spline','mixed','column'].includes(family))return invalid('options.tooltip.content','Shared detail requires line or column/bar data.');
  if(options.tooltip?.crosshair!==undefined&&!['fan','regression','bullet','variwide','xrange','timeline','vector','windbarb','polygon','streamgraph','lollipop','dumbbell','columnpyramid','boxplot','errorbar','arearange','areasplinerange','columnrange','histogram','bellcurve','pareto','waterfall','line','area','streamgraph','areaspline','spline','mixed','scatter','column','bubble'].includes(family))return invalid('options.tooltip.crosshair');
  if(options.appearance?.markers!==undefined&&!['fan','regression','pareto','radar','line','area','areaspline','spline','mixed'].includes(family)||options.appearance?.lineWidth!==undefined&&!['fan','regression','violin','dendrogram','parallel','contour','pareto','radar','line','area','areaspline','spline','mixed'].includes(family))return invalid('options.appearance','Markers and line width apply only to lines.');
  if(options.appearance?.dataLabels!==undefined&&family==='gauge')return invalid('options.appearance.dataLabels');
  if(family==='contour'){
    const levels=options.layout&&'levels' in options.layout?options.layout.levels:undefined;
    const ids=new Set(levels?.map(level=>level.id)??[]);
    if(options.appearance?.series?.some(series=>!ids.has(series.id)))return invalid('options.appearance.series','Use an ID declared in layout.levels.');
    if(options.viewport?.initial&&'x' in options.viewport.initial&&options.viewport.initial.x!==undefined&&!Array.isArray(options.viewport.initial.x))return invalid('options.viewport.initial.x','Contour requires numeric X bounds.');
  }
  const points=options.appearance?.points;
  if(points!==undefined){
    if(family==='pareto')return invalid('options.appearance.points','Use series colours for the generated Pareto layers.');
    if(!['waterfall','line','area','areaspline','spline','mixed','scatter','column','bubble'].includes(family))return invalid('options.appearance.points','Point colors require a cartesian chart. Use appearance.series for slices or a gauge reading.');
    const identities=dataIdentities(data);for(let index=0;index<points.length;index++){const point=points[index]!;if(!identities?.series.get(point.seriesId)?.has(point.pointId))return invalid('options.appearance.points.'+index,'Unknown seriesId/pointId.');}
  }
  if(['histogram','bellcurve','pareto','radar','polar','windrose'].includes(family)&&(options.axes?.x?.referenceLines!==undefined||options.axes?.y?.referenceLines!==undefined))return invalid('options.axes','Radial reference lines are not supported.');
  for(const axis of ['x','y'] as const)if(options.axes?.[axis]?.referenceLines!==undefined&&(!isChartFamily(family)||!supportsReferenceAxis(family,axis)))return invalid('options.axes.'+axis+'.referenceLines','This chart does not support reference lines on this axis.');
  const references=(['x','y'] as const).flatMap(axis=>(options.axes?.[axis]?.referenceLines??[]).map((reference,index)=>({axis,reference,index})));
  if((family==='column'||family==='waterfall')&&options.axes?.x?.referenceLines!==undefined)return invalid('options.axes.x.referenceLines','Column and bar references use the semantic Y value axis.');
  if(references.length>16||new Set(references.map(item=>item.reference.id)).size!==references.length)return invalid('options.axes','Use at most 16 reference lines with unique IDs across both axes.');
  for(const {axis,reference,index} of references){
    const path='options.axes.'+axis+'.referenceLines.'+index+'.value',identities=dataIdentities(data);
    if((family==='column'||family==='waterfall')&&axis==='x')return invalid(path,'Column and bar references use the semantic Y value axis.');
    if(axis==='x'&&['bullet','variwide','streamgraph','lollipop','dumbbell','columnpyramid','boxplot','errorbar','arearange','areasplinerange','columnrange','line','area','streamgraph','areaspline','spline','mixed'].includes(family)&&identities?.xKind==='category'){
      if(typeof reference.value!=='string'||!identities.categories.has(reference.value))return invalid(path,'Use an existing category ID.');
    }else if(typeof reference.value!=='number'||!Number.isFinite(reference.value))return invalid(path,'This axis requires a finite numeric reference value.');
  }
  const minimum=options.appearance?.minPlotWidth;
  if(minimum!==undefined&&(!isChartFamily(family)||chartCapabilities[family].axes!=='cartesian'&&family!=='arcdiagram'&&family!=='parallel'||minimum<0||minimum>1600))return invalid('options.appearance.minPlotWidth','Use 0–1600 logical pixels with a supported horizontally scrollable plot.');
  return null;
}
