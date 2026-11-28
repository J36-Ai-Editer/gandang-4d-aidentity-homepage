export type Position = { x:number; z:number };
export type Obstacle = { x:number; z:number; width:number; depth:number };
export const WETLAND_POOL={x:63,z:-48,rx:10,rz:7};
export const WETLAND_ENTRY={x:48,z:-42};
export const WETLAND_STOPS={water:{x:56,z:-41},turtle:{x:70,z:-39},crane:{x:76,z:-49}} as const;
export function wetlandStop(p:Position){
  const stops=Object.keys(WETLAND_STOPS) as Array<keyof typeof WETLAND_STOPS>;
  return stops.find(key=>Math.hypot(p.x-WETLAND_STOPS[key].x,p.z-WETLAND_STOPS[key].z)<3.1);
}
function wetlandRadius(x:number,z:number){
  return Math.hypot((x-WETLAND_POOL.x)/WETLAND_POOL.rx,(z-WETLAND_POOL.z)/WETLAND_POOL.rz);
}
export const FOREST_TRAIL=[[74,-58],[76,-65],[72,-72],[65,-75],[61,-82],[67,-87],[76,-87],[83,-79],[83,-67],[76,-61]];
export const FOREST_ROCKS=[
  {x:78,z:-69,height:.66},{x:69,z:-66,height:.78},{x:68,z:-79,height:.68},
  {x:61,z:-87,height:.92},{x:73,z:-92,height:.9},{x:86,z:-83,height:.72}
];
function nearForestTrail(x:number,z:number){
  return FOREST_TRAIL.slice(1).some(([bx,bz],i)=>{
    const [ax,az]=FOREST_TRAIL[i],dx=bx-ax,dz=bz-az;
    const t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));
    return Math.hypot(x-ax-t*dx,z-az-t*dz)<3.7;
  });
}
export const FOREST_ENTRY={x:76,z:-65};
export const FOREST_STOPS={deer:{x:63,z:-79},herb:{x:76,z:-87}} as const;
export function forestStop(point:Position){
  return (Object.keys(FOREST_STOPS) as Array<keyof typeof FOREST_STOPS>).find(key=>
    Math.hypot(point.x-FOREST_STOPS[key].x,point.z-FOREST_STOPS[key].z)<2.85);
}
export const WORLD_LIMIT=104;
export const BRIDGE_X=[-25,0,25];
export function riverCenter(x:number):number{return -22+3.6*Math.sin(x*.08)+1.2*Math.sin(x*.19);}
export function riverHalfWidth(x:number):number{return 3+.55*Math.sin(x*.1)+.28*Math.sin(x*.27);}
const smooth=(a:number,b:number,v:number)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
/** Flat village courts blend continuously into walkable rolling hills and a low river channel. */
export function terrainHeight(x:number,z:number):number {
  const outskirts=smooth(0,1,Math.max((Math.abs(x)-30)/18,(Math.abs(z)-33)/16));
  const hill=(cx:number,cz:number,h:number,r:number)=>h*Math.exp(-((x-cx)**2+(z-cz)**2)/(r*r));
  const height=hill(74,-96,10,23)+hill(10,-82,14,28)+hill(-75,62,10,35)+hill(80,54,12,33)+hill(-47,16,5.6,18)+hill(43,36,7,21)+hill(18,-48,5,17)+hill(-38,-46,4.5,19);
  if(wetlandRadius(x,z)<1)return -.2*(1-wetlandRadius(x,z));
  return outskirts*height*smooth(riverHalfWidth(x)+.7,riverHalfWidth(x)+10,Math.abs(z-riverCenter(x)));
}
export const GROVE_TREES:Array<{x:number;z:number;scale:number;peach:boolean}>=[];
let groveSeed=7235;
const groveRand=()=>{groveSeed=(groveSeed*1664525+1013904223)>>>0;return groveSeed/4294967296;};
for(const [cx,cz] of [[-62,52],[-77,71],[-40,83],[34,86],[76,62],[82,44],[-18,-80],[28,-88],[-47,8],[-38,35],[-16,50],[22,47],[48,25],[49,-7],[35,-45],[-22,-46],[-50,-39]]){
  for(let i=0;i<11;i++){
    const a=groveRand()*Math.PI*2,r=3+groveRand()*8,x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r;
    if(Math.abs(z-riverCenter(x))<5||GROVE_TREES.some(t=>Math.hypot(t.x-x,t.z-z)<2.5))continue;
    GROVE_TREES.push({x,z,scale:.8+groveRand()*.6,peach:i%4!==0});
  }
}
for(const [cx,cz] of [[59,-70],[84,-70],[87,-89],[58,-91],[70,-96],[94,-80]]){
  for(let i=0;i<8;i++){
    const angle=groveRand()*6.283,radius=1.6+groveRand()*6;
    const x=cx+Math.cos(angle)*radius,z=cz+Math.sin(angle)*radius;
    if(nearForestTrail(x,z)||GROVE_TREES.some(tree=>Math.hypot(x-tree.x,z-tree.z)<2.4))continue;
    GROVE_TREES.push({x,z,scale:1+groveRand()*.8,peach:false});
  }
}
export const BUILDINGS:Obstacle[] = [
  {x:-7,z:-4,width:7,depth:5},
  {x:8,z:6,width:5.5,depth:4},
  {x:-5,z:-14,width:6,depth:4},
];
export const EXPANSION_BUILDINGS:Obstacle[]=[
  {x:10,z:-82,width:5.2,depth:5.2},{x:-1,z:-76,width:3.6,depth:2.8},{x:-25,z:15,width:6.6,depth:5.3},{x:25,z:17,width:6.6,depth:5.3},
  {x:-16,z:-32,width:6.6,depth:5.3},{x:15,z:-32,width:6.6,depth:5.3},
  {x:-18,z:3,width:4,depth:2},{x:-24,z:3,width:4,depth:2},{x:19,z:6,width:4,depth:2},
  {x:-17,z:10,width:3,depth:3},{x:18,z:14,width:3,depth:2},
];
export function canWalk(p:Position):boolean {
  if(!Number.isFinite(p.x)||!Number.isFinite(p.z)||Math.abs(p.x)>WORLD_LIMIT||Math.abs(p.z)>WORLD_LIMIT)return false;
  if(Math.abs(p.z-riverCenter(p.x))<riverHalfWidth(p.x)+.2&&!BRIDGE_X.some(x=>Math.abs(p.x-x)<1.55))return false;
  if(FOREST_ROCKS.some(rock=>Math.hypot(rock.x-p.x,rock.z-p.z)<rock.height*.8))return false;
  if(wetlandRadius(p.x,p.z)<1.01)return false;
  if(Math.hypot(p.x+48,p.z+34)<4.5)return false;
  if(GROVE_TREES.some(t=>Math.hypot(t.x-p.x,t.z-p.z)<.65))return false;
  if(((p.x-7)/5.4)**2+((p.z+5)/4.5)**2<1)return false;
  if([...BUILDINGS,...EXPANSION_BUILDINGS].some(b=>Math.abs(p.x-b.x)<b.width/2+.4&&Math.abs(p.z-b.z)<b.depth/2+.4))return false;
  return ![{x:-12,z:3},{x:-10,z:11},{x:12,z:-11},{x:13,z:11}].some(t=>Math.hypot(p.x-t.x,p.z-t.z)<.9);
}
export function findRoute(from:Position,to:Position):Position[] {
  if(!canWalk(from)||!canWalk(to))return [];
  const step=.5, key=(p:Position)=>`${p.x},${p.z}`;
  const start={x:Math.round(from.x/step),z:Math.round(from.z/step)};
  const goal={x:Math.round(to.x/step),z:Math.round(to.z/step)};
  if(!canWalk({x:goal.x*step,z:goal.z*step}))return [];
  const queue=[start],parent=new Map<string,Position|null>([[key(start),null]]);
  for(let i=0;i<queue.length;i++){
    const current=queue[i];
    if(key(current)===key(goal)){
      const result:Position[]=[to];let p:Position|null=current;
      while(p){result.push({x:p.x*step,z:p.z*step});p=parent.get(key(p))??null;}
      result.reverse();result.shift();return result;
    }
    for(const [x,z] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const next={x:current.x+x,z:current.z+z};
      if(parent.has(key(next))||!canWalk({x:next.x*step,z:next.z*step}))continue;
      parent.set(key(next),current);queue.push(next);
    }
  }
  return [];
}
