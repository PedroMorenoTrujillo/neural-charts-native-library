import type {PlanCommand,PlanFrame,PlanPictorialFrame} from '@neural-charts/core/plan';

/** Narrow public roles without accepting a new family in Native automatically.
 * Full defensive ownership is still required at the scene boundary. */
export function hasPictorialFrameRoles(frame:PlanFrame):frame is PlanPictorialFrame{
  return frame.family==='pictorial'&&Array.isArray(frame.pictorialGlyphs)&&Array.isArray(frame.pictorialData)&&frame.pictorialLayout!==undefined&&
    frame.series.every(series=>Array.isArray(series.pictorialFills))&&
    frame.observations.every(point=>point.pictorial!==undefined&&(point.hit===undefined||point.hit.type==='compoundPolygon'));
}

export interface NativePictorialPaint {
  readonly backgroundPath:string;
  readonly series:readonly Readonly<{id:string;name:string;color:string;fillPath:string}>[];
}
export type PictorialCommandSerializer=(commands:readonly PlanCommand[])=>string;
const pathLimit=1_000_000;
function batch(commands:readonly (readonly PlanCommand[])[],serialize:PictorialCommandSerializer,reason:string):string{
  const parts:string[]=[];let length=0;
  for(const input of commands){const part=serialize(input);length+=part.length;if(length>pathLimit)throw Error(reason);parts.push(part);}
  return parts.join('');
}
/** One neutral background and at most eight opaque series batches. The Core
 * already clipped every band to the silhouette. Only numeric commands enter
 * the existing serializer; source data never supplies SVG/XML. */
export function pictorialPaint(frame:PlanPictorialFrame,serialize:PictorialCommandSerializer):NativePictorialPaint{
  return {
    backgroundPath:batch(frame.pictorialGlyphs.map(glyph=>glyph.backgroundCommands),serialize,'PICTORIAL_BACKGROUND_PATH_LIMIT'),
    series:frame.series.map(series=>({id:series.id,name:series.name,color:series.color,
      fillPath:batch(series.pictorialFills.map(fill=>fill.commands),serialize,'PICTORIAL_SERIES_PATH_LIMIT')})),
  };
}
