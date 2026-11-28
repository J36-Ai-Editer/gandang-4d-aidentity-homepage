export type Point = { x: number; y: number };
export type Decoration = Point & { kind: 'flower' | 'lantern' };
export type VillageSave = { version: 1; player: Point; placed: Decoration[]; quest: number };
export const WIDTH = 1280, HEIGHT = 720;
export const SPAWN: Point = { x: 610, y: 500 };
export const GUIDE: Point = { x: 665, y: 375 };
export const SAVE_KEY = 'gandang-village-scene-v2';
// Feet-only navigation follows the visible plaza and northern lane.
const AREAS: Point[][] = [
  [[455,320],[605,285],[720,320],[805,365],[1005,420],[870,500],[790,535],[685,575],[645,705],[565,705],[525,600],[365,555],[280,535],[365,450]].map(([x,y])=>({x,y})),
  [[605,320],[620,235],[660,160],[710,105],[755,95],[710,190],[695,270],[720,330]].map(([x,y])=>({x,y}))
];
export const distance = (a:Point,b:Point) => Math.hypot(a.x-b.x,a.y-b.y);
export function inside(p:Point, polygon:Point[]): boolean {
  let result=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[i], b=polygon[j];
    if(((a.y>p.y)!==(b.y>p.y)) && p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x) result=!result;
  }
  return result;
}
export function walkable(p:Point, placed:Decoration[]=[]):boolean {
  return Number.isFinite(p.x)&&Number.isFinite(p.y)&&AREAS.some(a=>inside(p,a))&&
    distance(p,GUIDE)>22 && !placed.some(a=>distance(p,a)<23);
}
export function placeable(p:Point,placed:Decoration[],player:Point):boolean {
  return walkable(p,placed)&&distance(p,player)>40&&p.y>330&&p.y<580;
}
export function screenPoint(x:number,y:number,rect:{left:number;top:number;width:number;height:number}):Point {
  return {x:(x-rect.left)*WIDTH/rect.width,y:(y-rect.top)*HEIGHT/rect.height};
}
export function pathTo(from:Point,to:Point,placed:Decoration[]):Point[] {
  const cell=16, cols=80, rows=45;
  const start={x:Math.round(from.x/cell),y:Math.round(from.y/cell)};
  const goal={x:Math.round(to.x/cell),y:Math.round(to.y/cell)};
  if(!walkable(to,placed))return [];
  const key=(p:Point)=>p.y*cols+p.x;
  const queue=[start], parents=new Map<number,Point|null>([[key(start),null]]);
  for(let head=0;head<queue.length;head++) {
    const current=queue[head];
    if(key(current)===key(goal)) {
      const path:Point[]=[to];let cursor:Point|null=current;
      while(cursor){path.push({x:cursor.x*cell,y:cursor.y*cell});cursor=parents.get(key(cursor))??null;}
      path.reverse();path.shift();return path;
    }
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const next={x:current.x+dx,y:current.y+dy};
      if(next.x<0||next.y<0||next.x>=cols||next.y>=rows||parents.has(key(next))||!walkable({x:next.x*cell,y:next.y*cell},placed))continue;
      parents.set(key(next),current);queue.push(next);
    }
  }
  return [];
}
export function decodeVillage(raw:string|null):VillageSave {
  const fresh:VillageSave={version:1,player:{...SPAWN},placed:[],quest:0};
  if(!raw)return fresh;
  try {
    const d:unknown=JSON.parse(raw);
    if(typeof d!=='object'||d===null)return fresh;
    const obj=d as Record<string,unknown>;
    if(obj.version!==1||!Array.isArray(obj.placed))return fresh;
    const placed:Decoration[]=[];
    for(const item of obj.placed.slice(0,40)) {
      if(typeof item!=='object'||item===null)continue;
      const v=item as Record<string,unknown>;
      if(typeof v.x!=='number'||typeof v.y!=='number'||(v.kind!=='flower'&&v.kind!=='lantern'))continue;
      const candidate:Decoration={x:v.x,y:v.y,kind:v.kind};
      if(placeable(candidate,placed,SPAWN))placed.push(candidate);
    }
    const p=obj.player;
    let player={...SPAWN};
    if(typeof p==='object'&&p!==null&&'x' in p&&'y' in p&&typeof p.x==='number'&&typeof p.y==='number'&&walkable({x:p.x,y:p.y},placed))player={x:p.x,y:p.y};
    const quest=typeof obj.quest==='number'&&Number.isInteger(obj.quest)&&obj.quest>=0&&obj.quest<=3?obj.quest:0;
    return {version:1,player,placed,quest};
  }catch{return fresh;}
}
