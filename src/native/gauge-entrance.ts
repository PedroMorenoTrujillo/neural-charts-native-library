import type {NativeScene} from '../library/contracts.js';

export interface GaugeEntrance {readonly startRadians:number;readonly sweepRadians:number;}
const numberPattern=/[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi;

/** Read only the already projected outer arcs; never derive angles from values/domains. */
export function gaugeEntrance(scene:NativeScene):GaugeEntrance|undefined{
  if(scene.family!=='gauge'||scene.observations[0]?.id.seriesId!=='reading')return undefined;
  const frame=scene.observations[0].hit;if(frame?.type!=='sector'||frame.radius<=0)return undefined;
  const path=scene.series.find(series=>series.id==='reading')?.path;
  if(!path)return {startRadians:frame.start,sweepRadians:0};
  const outer=path.slice(0,2048).split(/[LZ]/,1)[0]!,commands=outer.match(/[MA][^MA]*/g);
  if(!commands?.length||commands[0]![0]!=='M')return undefined;
  const first=commands[0]!.slice(1).match(numberPattern)?.map(Number);if(first?.length!==2||!first.every(Number.isFinite))return undefined;
  const epsilon=Math.max(1,frame.radius)*1e-6,tau=Math.PI*2;
  if(Math.abs(Math.hypot(first[0]!-frame.cx,first[1]!-frame.cy)-frame.radius)>epsilon)return undefined;
  const startRadians=Math.atan2(first[0]!-frame.cx,frame.cy-first[1]!);let previous=startRadians,sweepRadians=0;
  for(const command of commands.slice(1)){
    if(command[0]!=='A')return undefined;
    const values=command.slice(1).match(numberPattern)?.map(Number);
    if(values?.length!==7||!values.every(Number.isFinite)||values[4]!==1||values[3]!==0&&values[3]!==1)return undefined;
    if(Math.abs(values[0]!-frame.radius)>epsilon||Math.abs(values[1]!-frame.radius)>epsilon)return undefined;
    const x=values[5]!,y=values[6]!;
    if(Math.abs(Math.hypot(x-frame.cx,y-frame.cy)-frame.radius)>epsilon)return undefined;
    const angle=Math.atan2(x-frame.cx,frame.cy-y),delta=(angle-previous+tau)%tau;
    if(values[3]===0&&delta>Math.PI+epsilon||values[3]===1&&delta<Math.PI-epsilon)return undefined;
    sweepRadians+=delta;previous=angle;
  }
  return sweepRadians<=tau+epsilon?{startRadians,sweepRadians:Math.min(tau,sweepRadians)}:undefined;
}
