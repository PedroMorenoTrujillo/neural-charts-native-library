import type {NativeScene, Observation} from './contracts.js';
import {containsPolygon} from './polygon-hit.js';

interface Entry {readonly point: Observation; stamp: number;}
function touchesRoundedEdge(vertices:Extract<NonNullable<Observation['hit']>,{type:'polygon'}>['vertices'],x:number,y:number):boolean{
  // Core keeps the exact value anchor while serializing polygon vertices to
  // four decimals. This tolerance covers that rounding only, not a wider bar.
  const squared=.0002**2;
  for(let i=0;i<vertices.length;i++){
    const a=vertices[i]!,b=vertices[(i+1)%vertices.length]!,dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
    const t=length?Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/length)):0;
    if((x-a.x-t*dx)**2+(y-a.y-t*dy)**2<=squared)return true;
  }
  return false;
}

/** Index the owned Core hit geometry once; touch moves allocate no candidate arrays. */
export class TemporalHitIndex {
  private readonly cells = new Map<number, Entry[]>();
  private stamp = 0;
  constructor(private readonly scene: NativeScene,private readonly roundedPolygonAnchors=false) {
    for (const point of scene.observations) {
      const hit = point.hit; if (!hit || hit.type !== 'circle' && hit.type !== 'polygon') continue;
      const left = hit.type === 'circle' ? hit.cx - hit.radius : Math.min(...hit.vertices.map(p => p.x));
      const right = hit.type === 'circle' ? hit.cx + hit.radius : Math.max(...hit.vertices.map(p => p.x));
      const top = hit.type === 'circle' ? hit.cy - hit.radius : Math.min(...hit.vertices.map(p => p.y));
      const bottom = hit.type === 'circle' ? hit.cy + hit.radius : Math.max(...hit.vertices.map(p => p.y));
      const entry: Entry = {point, stamp: 0};
      for (let row = this.cell(top, scene.height); row <= this.cell(bottom, scene.height); row++)
        for (let column = this.cell(left, scene.width); column <= this.cell(right, scene.width); column++) {
          const key = row * 12 + column, entries = this.cells.get(key) ?? [];
          entries.push(entry); this.cells.set(key, entries);
        }
    }
  }
  private cell(value: number, extent: number): number {return Math.max(0, Math.min(11, Math.floor(value / extent * 12)));}
  pick(x: number, y: number, tolerance = 0): Observation | null {
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > this.scene.width || y > this.scene.height) return null;
    const stamp = ++this.stamp,padding=Math.max(tolerance,this.roundedPolygonAnchors?.0002:0);
    let selected: Observation | null = null, score = Infinity, rowScore = Infinity;
    for (let row = this.cell(y - padding, this.scene.height); row <= this.cell(y + padding, this.scene.height); row++)
      for (let column = this.cell(x - padding, this.scene.width); column <= this.cell(x + padding, this.scene.width); column++)
        for (const entry of this.cells.get(row * 12 + column) ?? []) {
          if (entry.stamp === stamp) continue; entry.stamp = stamp;
          const point = entry.point, hit = point.hit!;
          const distance = (x - point.x) ** 2 + (y - point.y) ** 2;
          const contains = hit.type === 'circle' ? (x - hit.cx) ** 2 + (y - hit.cy) ** 2 <= Math.max(hit.radius, tolerance) ** 2
            : hit.type === 'polygon' && (containsPolygon(hit, x, y)||this.roundedPolygonAnchors&&touchesRoundedEdge(hit.vertices,x,y));
          // Expanded touch targets may overlap adjacent flame rows. Stay in the
          // row being touched before comparing interval centres within that row.
          const rowDistance = Math.abs(y - point.y);
          if (contains && (this.scene.family === 'flame'
            ? rowDistance < rowScore || rowDistance === rowScore && distance < score
            : distance < score)) {selected = point; score = distance; rowScore = rowDistance;}
        }
    return selected;
  }
  destroy(): void {this.cells.clear();}
}
