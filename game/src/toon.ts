import {connectPineWind} from './forest-assets.ts';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {legSwing} from './locomotion.ts';
import {buildForest,forestActions} from './forest.ts';
import {FOREST_ENTRY,forestStop} from './world3d.ts';
import {buildWetland,wetlandActions} from './wetland.ts';
import {WETLAND_ENTRY,wetlandStop} from './world3d.ts';
import {buildShelter,shelter,chime} from './shelter.ts';
import * as T from 'three';
import './toon.css';
import {BUILDINGS,BRIDGE_X,canWalk,findRoute,riverCenter,terrainHeight,type Position} from './world3d.ts';
import {buildRetreat,shrine,bell} from './retreat.ts';
import {expandLandscape,batchStaticLandscape} from './landscape.ts';
import {connectVillageAudio} from './village-audio.ts';

const $ = <E extends HTMLElement>(id:string)=>document.getElementById(id) as E;
const canvas=$<HTMLCanvasElement>('world3d');
const scene=new T.Scene();scene.background=new T.Color('#dce4cb');
const walkingFog=new T.Fog('#dce4cb',80,180),mapFog=new T.Fog('#dce4cb',230,440);scene.fog=walkingFog;
let renderer:T.WebGLRenderer;
try{renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}
catch{ showError('WebGL 2를 사용할 수 없습니다. 브라우저의 그래픽 가속 설정을 확인해 주세요.');throw new Error('WebGL 2 unavailable'); }
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
renderer.outputColorSpace=T.SRGBColorSpace;
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
const camera=new T.OrthographicCamera(-20,20,12,-12,.1,600);
const sun=new T.DirectionalLight('#fff1d2',2.4);sun.position.set(-16,28,12);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-28,right:28,top:28,bottom:-28,near:1,far:80});
sun.shadow.normalBias=.035;sun.shadow.bias=-.0002;sun.shadow.radius=3;
scene.add(sun,sun.target,new T.HemisphereLight('#fff7e1','#8e9f79',1.7));
const palette={grass:'#93b57b',sand:'#e8cf9e',wood:'#805a3c',trim:'#ad8054',wall:'#f1dfba',roof:'#52616c',tile:'#74818b',pink:'#e9afbc',leaf:'#6f985b',darkLeaf:'#4d7850',rock:'#b4b6a3',water:'#68c2bd'};
const colors=new Map<string,T.MeshStandardMaterial>();
function mat(color:string){if(!colors.has(color))colors.set(color,new T.MeshStandardMaterial({color,roughness:.86}));return colors.get(color)!;}
function mesh(geometry:T.BufferGeometry,color:string,parent:T.Object3D=scene,x=0,y=0,z=0){const m=new T.Mesh(geometry,mat(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function box(w:number,h:number,d:number,color:string,parent:T.Object3D,x=0,y=0,z=0){return mesh(new T.BoxGeometry(w,h,d),color,parent,x,y,z);}
function ball(r:number,color:string,parent:T.Object3D,x=0,y=0,z=0,sx=1,sy=1,sz=1){const m=mesh(new T.SphereGeometry(r,10,8),color,parent,x,y,z);m.scale.set(sx,sy,sz);return m;}
function cylinder(rt:number,rb:number,h:number,color:string,parent:T.Object3D,x=0,y=0,z=0,segments=12){return mesh(new T.CylinderGeometry(rt,rb,h,segments),color,parent,x,y,z);}
function beam(a:T.Vector3,b:T.Vector3,r:number,color:string,parent:T.Object3D){const m=cylinder(r,r,a.distanceTo(b),color,parent);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());return m;}
function path(points:number[][],width:number,color=palette.sand){const curve=new T.CatmullRomCurve3(points.map(([x,z])=>new T.Vector3(x,.035,z)));const samples=curve.getPoints(70),v:number[]=[],indices:number[]=[];samples.forEach((p,i)=>{const tangent=curve.getTangent(i/(samples.length-1));const dx=-tangent.z*width/2,dz=tangent.x*width/2;v.push(p.x+dx,p.y,p.z+dz,p.x-dx,p.y,p.z-dz);if(i<samples.length-1){const n=i*2;indices.push(n,n+2,n+1,n+1,n+2,n+3);}});const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setIndex(indices);g.computeVertexNormals();const m=mesh(g,color);m.castShadow=false;}
box(400,.25,400,palette.grass,scene,0,-.2,0);
// An open continuous landscape, with a broad readable meeting space.
cylinder(6.8,6.8,.045,palette.sand,scene,0,.025,3,64);
path([[0,19],[0,10],[0,3],[-.8,-5],[0,-17]],5.2);
path([[-15,-1],[-8,.6],[0,3],[7,3],[16,5]],3.8);
let randomSeed=273;
function rand(){randomSeed=(randomSeed*1664525+1013904223)>>>0;return randomSeed/4294967296;}

function roof(w:number,d:number,y:number,parent:T.Object3D){
  // Curved eaves are actual geometry; ribs follow the same curved profile.
  const profile=(t:number)=>y+1.35*(1-Math.abs(t))+.5*Math.abs(t)**4;
  const rise=(x:number,t:number)=>.38*(Math.abs(x)/(w/2))**5*Math.abs(t)**2;
  const vertices:number[]=[],indices:number[]=[],segments=20;
  const columns=20;
  for(let col=0;col<=columns;col++)for(let i=0;i<=segments;i++){
    const x=(col/columns-.5)*w,t=-1+2*i/segments;
    vertices.push(x,profile(t)+rise(x,t),t*d/2);
    if(col<columns&&i<segments){
      const a=col*(segments+1)+i,b=a+segments+1;
      indices.push(a,a+1,b,b,a+1,b+1);
    }
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();const surface=mesh(g,palette.roof,parent);(surface.material as T.Material).side=T.DoubleSide;
  for(let x=-w/2;x<=w/2+.01;x+=.31){const points:Array<T.Vector3>=[];for(let i=0;i<=16;i++){const t=-1+i/8;points.push(new T.Vector3(x,profile(t)+rise(x,t)+.045,t*d/2));}mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),24,.075,5,false),palette.tile,parent);}
  for(const z of [-d/2,d/2]){
    const points=Array.from({length:17},(_,i)=>{
      const x=(i/16-.5)*w;
      return new T.Vector3(x,y+.49+rise(x,1),z);
    });
    mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),28,.085,8,false),palette.trim,parent);
  }
  beam(new T.Vector3(-w/2-.12,y+1.43,0),new T.Vector3(w/2+.12,y+1.43,0),.16,palette.roof,parent);
  for(const side of [-1,1])ball(.22,palette.tile,parent,side*w/2,y+1.48,0,.7,1.3,1);
}
function lantern(parent:T.Object3D,x:number,y:number,z:number){cylinder(.18,.18,.5,'#f8d294',parent,x,y,z);cylinder(.2,.2,.055,palette.wood,parent,x,y+.28,z);cylinder(.2,.2,.055,palette.wood,parent,x,y-.28,z);beam(new T.Vector3(x,y+.28,z),new T.Vector3(x,y+.6,z),.025,palette.wood,parent);}
function hanok(x:number,z:number,w:number,d:number){const root=new T.Group();root.position.set(x,0,z);scene.add(root);
  box(w+.45,.35,d+.55,'#b9b6a0',root,0,.18,0);box(w,.2,d,palette.wood,root,0,.45,0);
  box(w-.25,2.8,d-.2,palette.wall,root,0,1.9,0);
  for(const px of [-w/2+.12,-w/4,w/4,w/2-.12]){box(.17,3,.2,palette.wood,root,px,1.95,d/2+.03);box(.16,3,.2,palette.wood,root,px,1.95,-d/2);}
  for(const yy of [.6,3.1])box(w+.2,.18,d+.12,palette.wood,root,0,yy,0);
  for(const px of [-w*.3,0,w*.3]){box(w*.23,1.85,.08,'#d8b985',root,px,1.9,d/2+.13);for(let col=-2;col<=2;col++)box(.035,1.8,.035,palette.wood,root,px+col*w*.038,1.9,d/2+.2);for(let row=0;row<6;row++)box(w*.23,.035,.035,palette.wood,root,px,1.1+row*.28,d/2+.2);}
  box(w+.4,.2,1.1,palette.trim,root,0,.53,d/2+.45);
  box(2,.15,.5,'#c0bca6',root,0,.25,d/2+1.05);box(2.2,.13,.45,'#cac4ac',root,0,.09,d/2+1.45);
  roof(w+1.25,d+1.5,3.25,root);
  for(let i=0;i<Math.floor(w/.26);i++){
    const px=-w/2+.15+i*.26;
    box(.12,.13,.33,i%3===0?'#6e8776':'#86674b',root,px,3.18,d/2+.22);
    const end=cylinder(.085,.085,.066,'#77848c',root,px,3.78+.38*(Math.abs(px)/((w+1.25)/2))**5,d/2+.69,12);end.rotation.x=Math.PI/2;
  }
  for(let col=0;col<Math.floor(w/.72);col++){
    const px=-w/2+.38+col*.72;
    box(.68,.18,.12,col%2?'#a7a38f':'#c1bba2',root,px,.22,d/2+.29);
  }
  for(const px of [-w/2+.5,w/2-.5])lantern(root,px,2.4,d/2+.65);
  for(const side of [-1,1]){
    const window=box(.075,.95,1.24,'#d9bc8a',root,side*(w/2-.065),2.1,0);
    window.receiveShadow=true;
    for(let i=-2;i<=2;i++)box(.085,.96,.035,palette.wood,root,side*(w/2-.06),2.1,i*.24);
    for(const level of [1.64,1.92,2.21,2.56])box(.1,.05,1.28,palette.wood,root,side*(w/2-.06),level,0);
    const jar=ball(.31,'#89634c',root,side*(w/2-.52),.64,d/2+.58,.9,1.2,.9);
    jar.receiveShadow=true;
    cylinder(.17,.19,.08,'#735442',root,side*(w/2-.52),.98,d/2+.58);
  }
  return root;
}
BUILDINGS.forEach((b,index)=>{
  const fallback=hanok(b.x,b.z,b.width,b.depth);
  if(index!==0)return;
  fallback.userData.dynamic=true;
  const modelUrl=new URL('assets/hanok-anchae.glb',document.baseURI).href;
  void new GLTFLoader().loadAsync(modelUrl).then(({scene:model})=>{
    const bounds=new T.Box3().setFromObject(model);
    const size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
    const scale=Math.min(b.width/size.x,b.depth/size.z);
    model.scale.setScalar(scale);
    model.position.set(b.x-center.x*scale,-bounds.min.y*scale,b.z-center.z*scale);
    model.traverse(part=>{
      if(!(part instanceof T.Mesh))return;
      part.castShadow=true;part.receiveShadow=true;
      const name=part.name+' '+(part.parent?.name??'');
      if(/anchae-(roof|ridge|caps)/.test(name)){
        const shades=Array.isArray(part.material)?part.material:[part.material];
        for(const surface of shades){
          if(surface instanceof T.MeshStandardMaterial){
            surface.color.lerp(new T.Color('#52616c'),.82);
            surface.roughness=.86;surface.metalness=0;
          }
        }
      }
    });
    scene.add(model);fallback.visible=false;
    canvas.dataset.hanok='anchae';
  }).catch(()=>{canvas.dataset.hanok='fallback';});
});
// Pond: shaped basin, rock edge, water lilies and a pavilion.
const pond=new T.Group();pond.position.set(7,0,-5);scene.add(pond);
const basin=cylinder(5.2,5.2,.15,'#c2c5ad',pond,0,.02,0,64);basin.scale.z=.82;
const water=cylinder(4.85,4.85,.06,palette.water,pond,0,.12,0,64);water.scale.z=.79;water.castShadow=false;
for(let i=0;i<38;i++){const angle=i/38*Math.PI*2;ball(.39+rand()*.18,i%3?'#c4c5ae':'#9aa99b',pond,Math.cos(angle)*5.05,.16,Math.sin(angle)*4.05,1.15,.7,1);}
for(let i=0;i<12;i++){const a=rand()*6.28,r=1.5+rand()*2;const x=Math.cos(a)*r,z=Math.sin(a)*r*.8;const leaf=cylinder(.2,.2,.018,'#709e66',pond,x,.17,z);leaf.castShadow=false;if(i%3===0)ball(.115,'#edbcc7',pond,x,.27,z,1,.55,1);}
const pavilion=new T.Group();pavilion.position.set(8.4,0,-6.9);scene.add(pavilion);
cylinder(2.1,2.1,.25,'#b6b5a1',pavilion,0,.2,0,8);cylinder(1.9,1.9,.15,palette.trim,pavilion,0,.65,0,8);
for(const x of [-1.3,1.3])for(const z of [-1.3,1.3])cylinder(.12,.12,2.7,palette.wood,pavilion,x,2,z);
for(const z of [-1.45,1.45]){box(3,.1,.1,palette.trim,pavilion,0,1.45,z);for(let i=-3;i<=3;i++)box(.055,.7,.055,palette.wood,pavilion,i*.43,1.05,z);}
roof(4.4,4.4,3.3,pavilion);cylinder(.55,.55,.15,palette.wood,pavilion,0,1.1,0);

function tree(x:number,z:number,cherry=false,scale=1){const root=new T.Group();root.position.set(x,0,z);root.scale.setScalar(scale);scene.add(root);beam(new T.Vector3(0,0,0),new T.Vector3(.25,3.2,0),.19,palette.wood,root);for(let i=0;i<7;i++){const a=i*2.4,px=Math.cos(a)*1.25,pz=Math.sin(a)*1.1;beam(new T.Vector3(.12,1.8,0),new T.Vector3(px,3.1,pz),.1,palette.wood,root);for(let j=0;j<5;j++){const b=j*2.4;ball(.53+rand()*.25,cherry?['#edb8c3','#f5cbd0','#dfa5b5'][j%3]:['#789952','#8da963','#62874c'][j%3],root,px+Math.cos(b)*.56,3.3+(i%2)*.42+rand()*.5,pz+Math.sin(b)*.5,1,.8,1);}}return root;}
tree(-12,3,true,1.2);tree(-10,11,true,1.2);tree(12,-11,false,1.35);tree(13,11,true,1.3);
for(const [x,z] of [[-22,-10],[-31,-3],[-18,23],[20,25],[30,12],[25,-12],[-5,31]])tree(x,z,true,1.1+rand()*.5);
// Walls and flower beds are made from individual stones and stems.
function wall(x:number,z:number,length:number,rotation=0){const root=new T.Group();root.position.set(x,0,z);root.rotation.y=rotation;scene.add(root);for(let i=0;i<Math.floor(length/.7);i++){for(let r=0;r<2;r++){const block=box(.66,.33,.45,r%2?'#b8b7a2':'#a9af9b',root,-length/2+i*.7+(r%2)*.15,.2+r*.32,0);block.rotation.z=(rand()-.5)*.04;}}box(length,.12,.6,palette.roof,root,-.2,.91,0);}
wall(-12,-3,6,Math.PI/2);wall(-8,9,5);wall(12,7,6,Math.PI/2);wall(-6,-9,7);
function flowers(x:number,z:number,count=9){const root=new T.Group();root.position.set(x,0,z);scene.add(root);for(let i=0;i<count;i++){const px=(rand()-.5)*2.3,pz=(rand()-.5)*1.4,h=.3+rand()*.35;cylinder(.025,.025,h,'#64864f',root,px,h/2,pz,5);for(let j=0;j<5;j++){const a=j/5*6.28;ball(.085,i%3===0?'#f5e2a5':i%2?'#f7c8d0':'#c990a8',root,px+Math.sin(a)*.08,h,pz+Math.cos(a)*.08,1,.55,1);}ball(.045,'#d4aa56',root,px,h+.025,pz);ball(.09,'#789a58',root,px+.08,h*.4,pz,1,.4,1);}}
for(const [x,z] of [[-10,0],[-5,0],[-9,8],[-4,10],[10,1],[13,4],[4,-10],[-11,-8]])flowers(x,z,15);
for(let i=0;i<140;i++){const x=(rand()-.5)*42,z=(rand()-.5)*40;if(Math.abs(x)<3||Math.hypot(x,z-3)<7||!canWalk({x,z}))continue;const grass=mesh(new T.ConeGeometry(.12,.28,4),'#7fa564',scene,x,.13,z);grass.castShadow=false;}
function pot(x:number,z:number,s=1){cylinder(.28*s,.19*s,.48*s,'#927059',scene,x,.24*s,z);cylinder(.3*s,.3*s,.07*s,'#795a49',scene,x,.5*s,z);ball(.25*s,'#87a169',scene,x,.63*s,z,1,.65,1);}
for(let i=0;i<5;i++)pot(-11+i*.63,-.65,.8+rand()*.5);
for(let i=0;i<4;i++){const x=5.6+i*.65;ball(.32,'#795c4a',scene,x,.34,8.5,1,1.1,1);cylinder(.27,.27,.08,'#614e43',scene,x,.68,8.5);}
// Tea table and low stools on the broad porch.
cylinder(.55,.55,.12,palette.trim,scene,-7,.95,-.7);cylinder(.12,.15,.4,palette.wood,scene,-7,.7,-.7);
for(const x of [-7.8,-6.2])cylinder(.3,.3,.18,'#d8bc81',scene,x,.66,-.5);
for(let i=0;i<8;i++){const stone=ball(.34,'#c6bea6',scene,-.7+Math.sin(i)*.32,.06,-2-i*.8,1.3,.15,.8);stone.castShadow=false;}

const retreat=buildRetreat(scene);
const rest=buildShelter(scene);
const wetland=buildWetland(scene);
const forest=buildForest(scene);
const near=(point:Position,x:number,z:number,r:number)=>Math.hypot(point.x-x,point.z-z)<r;
let viewing=false;
const animateLandscape=expandLandscape(scene);
function person(color:string){const root=new T.Group();root.userData.dynamic=true;scene.add(root);
  const body=cylinder(.33,.45,.72,color,root,0,.86,0);
  const head=ball(.44,'#f2cfac',root,0,1.62,.025,1,.98,.92);
  ball(.46,'#393b39',root,0,1.8,-.04,1,.64,.95);
  for(const x of [-.31,-.1,.12,.31])ball(.13,'#393b39',root,x,1.89,.28,1,1.15,.65);
  for(const x of [-.14,.14]){ball(.045,'#343d39',root,x,1.65,.407,.65,1.2,.35);ball(.065,'#e6a49b',root,x*1.6,1.53,.36,1,.45,.25);}
  const collar=box(.09,.43,.04,'#f8e7c8',root,-.06,1.13,.32);collar.rotation.z=-.45;
  const sash=box(.38,.07,.06,'#ecdbad',root,0,.91,.38);sash.rotation.z=-.08;
  const arms:T.Group[]=[],legs:T.Group[]=[];
  for(const side of [-1,1]){const arm=new T.Group();arm.position.set(side*.35,1.16,0);root.add(arm);cylinder(.13,.16,.42,color,arm,side*.06,-.16,0);ball(.12,'#f2cfac',arm,side*.06,-.4,0);arms.push(arm);const leg=new T.Group();leg.position.set(side*.17,.52,0);root.add(leg);box(.23,.3,.25,'#52616c',leg,0,-.11,0);ball(.17,'#5c5345',leg,0,-.35,.06,1,.55,1.3);legs.push(leg);}
  return {root,body,head,arms,legs};
}
// Original zodiac villagers: shared hanbok silhouettes, distinct animal features.
const zodiacColors=['#a8a5b3','#b99b7e','#dfaa55','#f1dfcd','#77ad99','#93af79','#b98a69','#e5d7b7','#b78d72','#d5a35d','#c29a75','#e7b7b1'];
function zodiac(kind:number){
  const actor=person(['#759caa','#bd8693','#8c9b72','#d3b475'][kind%4]);
  const fur=zodiacColors[kind];
  actor.head.visible=false;
  // Replace the human head/hair/face, preserving rigged limbs and clothing.
  actor.root.children.filter(child=>child instanceof T.Mesh && child.position.y>1.4).forEach(child=>child.visible=false);
  ball(.49,fur,actor.root,0,1.66,.02,1,1,.94);
  ball(.25,kind===2?'#f5dfb4':'#f3e5cd',actor.root,0,1.48,.38,1,.65,.48);
  for(const side of [-1,1]){
    ball(.048,'#303931',actor.root,side*.18,1.72,.43,.8,1.2,.5);
    ball(.07,'#df9e98',actor.root,side*.29,1.57,.39,1,.45,.3);
    if(kind===3){ball(.17,fur,actor.root,side*.24,2.18,0,.7,2.5,.6);ball(.1,'#e4b3b1',actor.root,side*.24,2.21,.09,.7,3,.3);}
    else if(![4,5,9].includes(kind))ball(kind===0?.24:.17,fur,actor.root,side*.39,1.99,-.03,1,kind===6?1.8:1,.65);
    if([1,4,7].includes(kind))beam(new T.Vector3(side*.28,1.98,-.08),new T.Vector3(side*.42,2.36,-.16),.065,'#e6d3a2',actor.root);
    if(kind===2)for(let i=0;i<3;i++){const stripe=box(.1,.035,.035,'#715444',actor.root,side*.36,1.88-i*.12,.32);stripe.rotation.z=side*.4;}
  }
  ball(.065,kind===11?'#d18f91':'#57483e',actor.root,0,1.56,.51,kind===11?2:1,.65,.5);
  if(kind===9){for(let i=0;i<3;i++)ball(.13,'#ba6555',actor.root,0,2.12+i*.045,-.12+i*.13,.6,1.5,1);mesh(new T.ConeGeometry(.13,.28,4),'#deb465',actor.root,0,1.54,.57).rotation.x=Math.PI/2;}
  if(kind===4){for(let i=0;i<3;i++)ball(.12,'#d4ba6e',actor.root,0,2.13,-.3+i*.16,.7,1.5,1);}
  if(kind===5){const tail=mesh(new T.TorusGeometry(.35,.1,8,16,Math.PI*1.6),fur,actor.root,0,.36,-.38);tail.rotation.x=Math.PI/2;}
  if(kind===6)for(let i=0;i<5;i++)ball(.13,'#665649',actor.root,0,2.04,-.25+i*.12,.7,1,1);
  if(kind===0||kind===8){
    const tail=new T.CatmullRomCurve3([new T.Vector3(0,.64,-.32),new T.Vector3(.26,.46,-.58),new T.Vector3(.46,.65,-.74),new T.Vector3(.38,.9,-.8)]);
    mesh(new T.TubeGeometry(tail,16,.047,8,false),fur,actor.root);
  }
  if(kind===7)for(let i=0;i<8;i++){
    const angle=i*Math.PI/4;
    ball(.148,'#e9d8bc',actor.root,Math.cos(angle)*.31,1.96+Math.sin(angle)*.12,-.12,.93,1,.8);
  }
  if(kind===10)for(const side of [-1,1]){
    const ear=ball(.17,'#927154',actor.root,side*.44,1.84,-.04,.78,1.6,.62);
    ear.rotation.z=side*.43;
  }
  if(kind===11){
    ball(.145,'#d99294',actor.root,0,1.55,.53,1.18,.72,.48);
    for(const side of [-1,1])ball(.028,'#a66669',actor.root,side*.058,1.56,.595,.8,1,.4);
  }
  return actor;
}
const homes=[[-4,3],[4,3],[-19,9],[1,8],[4,-31],[-2,-5],[-28,7],[24,-11],[7,29],[-3,27],[27,-30],[-8,-29]];
const destinations=[[0,7],[10,10],[-14,12],[2,15],[8,-35],[-2,-10],[-31,13],[27,-6],[13,32],[-8,31],[32,-34],[-12,-35]];
const villagers=homes.map(([x,z],kind)=>{
 const actor=zodiac(kind),home={x,z};
 const [tx,tz]=destinations[kind];
 const outward=findRoute(home,{x:tx,z:tz});
 const path=[home,...outward];
 actor.root.position.set(x,terrainHeight(x,z),z);
 actor.root.rotation.y=kind*.8;
 return {actor,kind,path,distanceWalked:0,index:0,direction:1,waitUntil:kind*620,greetUntil:0};
});

$('greet').onclick=()=>{
 const {x,z}=player.root.position;
 if(forest.interact({x,z},performance.now())||wetland.interact({x,z})){waveAt=performance.now();return;}
 if(near(chime,x,z,1.65)){rest.ring();return;}
 if(near(shelter,x,z,4.5)){rest.toggle();return;}
 if(retreat.interact(x,z))return;
 if(Math.hypot(x-shrine.x,z-shrine.z)<7){viewing=!viewing;overview=false;zoom=viewing?2.4:1;updateCamera();return;}
 const nearest=[...villagers].sort((a,b)=>a.actor.root.position.distanceTo(player.root.position)-b.actor.root.position.distanceTo(player.root.position))[0];
 if(nearest.actor.root.position.distanceTo(player.root.position)>4){message('가까운 주민에게 다가가 주세요.');return;}
 nearest.greetUntil=performance.now()+1800;
 waveAt=performance.now();
 nearest.actor.root.rotation.y=Math.atan2(player.root.position.x-nearest.actor.root.position.x,player.root.position.z-nearest.actor.root.position.z);
 nearest.actor.arms[0].rotation.z=-2;
};
// A small cultivated garden, market stall and warm courtyard details.
for(let row=0;row<4;row++)for(let col=0;col<6;col++){
 const x=-12+col*.65,z=5+row*.65;
 box(.57,.06,.57,'#9a7d55',scene,x,.04,z);
 ball(.19,row%2?'#91ac60':'#7e9c61',scene,x,.22,z,1,.65,1);
 if(row%2===0)ball(.09,'#e4a573',scene,x,.34,z,.7,1.3,.7);
}
for(const x of [-4.4,-1.8]){cylinder(.065,.065,2.3,palette.wood,scene,x,1.15,-7);lantern(scene,x,2.05,-7);}
box(3.3,.12,1.4,palette.trim,scene,-3.1,.8,-7.1);
for(let i=0;i<8;i++)ball(.17,i%2?'#deb766':'#d78c6b',scene,-4+i*.25,.99,-7.1);
const petals=new T.Group();scene.add(petals);
petals.userData.dynamic=true;
for(let i=0;i<42;i++){const petal=mesh(new T.SphereGeometry(.055,5,4),'#f1c4cc',petals,(rand()-.5)*30,1+rand()*7,(rand()-.5)*28);petal.scale.set(1,.25,.65);petal.castShadow=false;}
const ripples:Array<T.Mesh>=[];
for(let i=0;i<4;i++){const ring=mesh(new T.RingGeometry(.45,.47,40),'#b4e3d5',pond,-2+i*1.2,.16,-1+i*.4);ring.userData.dynamic=true;ring.rotation.x=-Math.PI/2;ring.castShadow=false;ripples.push(ring);}
const player=person('#518ca5');
const visit=new URLSearchParams(location.search).get('visit');
const arrival=visit==='forest'?FOREST_ENTRY:visit==='wetland'?WETLAND_ENTRY:visit==='valley'?{x:shelter.x,z:shelter.z+3}:visit==='statue'?{x:shrine.x,z:shrine.z+5}:{x:0,z:5};
player.root.position.set(arrival.x,terrainHeight(arrival.x,arrival.z),arrival.z);
// A small straw hat and its woven rim identify the player without adding instructional text.
cylinder(.71,.74,.055,'#dfbc72',player.root,0,2.04,0,32);
ball(.46,'#c6a066',player.root,0,2.12,0,1,.55,1);
const hatRibbon=mesh(new T.TorusGeometry(.43,.04,5,28),'#7c8463',player.root,0,2.1,0);hatRibbon.rotation.x=Math.PI/2;
ball(.09,'#dea15d',player.root,.16,2.22,.36);
// The artwork's T pose is the neutral rig reference. Shoulder, elbow, hip and knee pivots animate independently.
const playerModel=new T.Group();
while(player.root.children.length)playerModel.add(player.root.children[0]);
player.root.add(playerModel);
const knees=player.legs.map(leg=>{
  const pivot=new T.Group();pivot.position.y=-.17;leg.add(pivot);
  pivot.attach(leg.children[1]);return pivot;
});
const elbows=player.arms.map(arm=>{
  const pivot=new T.Group();pivot.position.y=-.2;arm.add(pivot);
  pivot.attach(arm.children[1]);return pivot;
});
const posing=visit==='rig';
const medal=ball(.115,'#d5aa61',playerModel,.09,1.01,.39,1,1,.27);
medal.castShadow=false;
for(const x of [-.27,.27])ball(.105,'#f0c7a0',playerModel,x*1.55,1.6,.01,.68,1,.75);
for(const side of [-1,1]){
  const eye=ball(.019,'#fff2db',playerModel,side*.14-.008,1.669,.428,.82,1,.45);
  eye.castShadow=false;
  const brow=ball(.056,'#47382c',playerModel,side*.14,1.735,.411,1,.25,.28);
  brow.rotation.z=side*.1;
  const cuff=box(.24,.105,.25,'#e7debe',elbows[side===-1?0:1],side*.06,-.11,0);
  cuff.rotation.z=side*.09;
}
const smile=new T.CatmullRomCurve3([new T.Vector3(-.05,1.527,.429),new T.Vector3(0,1.51,.438),new T.Vector3(.05,1.527,.429)]);
mesh(new T.TubeGeometry(smile,14,.011,6,false),'#956254',playerModel);
for(let i=0;i<6;i++){
  const band=mesh(new T.TorusGeometry(.47+i*.041,.009,6,44),i%2?'#c99759':'#eac883',playerModel,0,2.075,0);
  band.rotation.x=Math.PI/2;
}
const alternateHair=new T.Group();playerModel.add(alternateHair);
ball(.24,'#44362c',alternateHair,0,1.78,-.39,.85,1.22,.9);
ball(.16,'#44362c',alternateHair,0,1.57,-.43,.62,1.7,.8);
ball(.08,'#c77270',alternateHair,0,1.45,-.43,1,.55,.85);
const skirt=cylinder(.31,.51,.62,'#c67983',playerModel,0,.68,0,24);
const clothes=[player.body,...player.arms.map(arm=>arm.children[0])];
const robes=['#518ca5','#cf8793','#879664','#ac845f'];
let feminine=false,robeIndex=0;
function dress(){
  alternateHair.visible=feminine;skirt.visible=feminine;
  const outfit=mat(robes[(robeIndex+(feminine?1:0))%robes.length]);
  for(const part of [...clothes,skirt])if(part instanceof T.Mesh)part.material=outfit;
  canvas.dataset.avatar=feminine?'feminine':'masculine';
  canvas.dataset.outfit=outfit.color.getHexString();
  $('avatar-style').setAttribute('aria-pressed',String(feminine));
}
$('avatar-style').onclick=()=>{if(canChangeClothes()){feminine=!feminine;dress();}};
$('outfit').onclick=()=>{if(canChangeClothes()){robeIndex=(robeIndex+1)%robes.length;dress();}};
dress();
const seats=[
  {x:shelter.x,z:shelter.z-1.45,height:.67},
  {x:-2.5,z:10,height:.52}
];
const bench=seats[1];
box(1.85,.14,.53,palette.trim,scene,bench.x,.45,bench.z);
for(const side of [-1,1])box(.16,.4,.38,palette.wood,scene,bench.x+side*.66,.2,bench.z);
box(1.85,.25,.1,palette.wood,scene,bench.x,.8,bench.z-.24);
let seated:typeof bench|undefined,departedSeat:typeof bench|undefined;
let jumpAt=-1000,waveAt=-1000;
function stand(){
  if(seated)departedSeat=seated;
  seated=undefined;
}
function jump(){if(performance.now()-jumpAt>=630){stand();jumpAt=performance.now();}}
const guide=person('#c7889d');guide.root.position.set(2,0,1);guide.root.rotation.y=-.4;
function canChangeClothes(){
  const {x,z}=player.root.position;
  return !overview&&near(guide.root.position,x,z,2.65);
}
const marker=mesh(new T.RingGeometry(.22,.29,28),'#fff4cd');marker.rotation.x=-Math.PI/2;marker.position.y=.07;marker.visible=false;marker.castShadow=false;
marker.userData.dynamic=true;
let route:Position[]=[],angle=.42,zoom=1,moving=false;
let overview=false;
const focus=player.root.position.clone();
const soundButton=$<HTMLButtonElement>('sound');
const wind=connectPineWind(soundButton,connectVillageAudio(soundButton));
const pressed=new Set<string>();
function message(_text:string){document.querySelector('.stage')?.classList.remove('invalid');requestAnimationFrame(()=>document.querySelector('.stage')?.classList.add('invalid'));}
function showError(description:string){const loading=$('loading');loading.hidden=false;loading.classList.add('error');loading.setAttribute('aria-label',description);const retry=document.createElement('button');retry.setAttribute('aria-label','다시 불러오기');retry.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M20 12a8 8 0 1 0-2 6"/></svg>';retry.onclick=()=>location.reload();loading.append(retry);}
function aimCamera(){const distance=overview?260:38;camera.position.set(focus.x+Math.sin(angle)*distance,distance*31/38+focus.y,focus.z+Math.cos(angle)*distance);camera.lookAt(focus);sun.position.set(focus.x-16,28+focus.y,focus.z+12);sun.target.position.copy(focus);scene.fog=overview?mapFog:walkingFog;}
function updateCamera(){const rect=canvas.getBoundingClientRect(),aspect=rect.width/rect.height,half=(overview?Math.max(132,145/aspect):13)/zoom;camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;aimCamera();camera.updateProjectionMatrix();renderer.setSize(rect.width,rect.height,false);}
new ResizeObserver(updateCamera).observe(canvas);
$('rotate').onclick=()=>{angle+=Math.PI/6;updateCamera();};
$('zoom-in').onclick=()=>{zoom=Math.min(1.6,zoom+.15);updateCamera();};
$('zoom-out').onclick=()=>{zoom=Math.max(.7,zoom-.15);updateCamera();};
$('reset-view').onclick=()=>{overview=false;angle=.42;zoom=1;updateCamera();$('map-view').setAttribute('aria-pressed','false');};
$('map-view').onclick=()=>{overview=!overview;zoom=1;focus.set(overview?0:player.root.position.x,0,overview?-3:player.root.position.z);$('map-view').setAttribute('aria-pressed',String(overview));updateCamera();};
const raycaster=new T.Raycaster(),pointer=new T.Vector2(),plane=new T.Plane(new T.Vector3(0,1,0),0);
canvas.onpointerdown=e=>{canvas.focus();const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);plane.constant=0;const hit=raycaster.ray.intersectPlane(plane,new T.Vector3());if(!hit)return;for(let i=0;i<5;i++){plane.constant=-terrainHeight(hit.x,hit.z);if(!raycaster.ray.intersectPlane(plane,hit))return;}route=findRoute(player.root.position,{x:hit.x,z:hit.z});if(route.length){marker.position.set(hit.x,terrainHeight(hit.x,hit.z)+.07,hit.z);marker.visible=true;}else message('건물과 연못을 피해 빈 땅을 눌러 주세요.');};
const vectors:Record<string,[number,number]>={w:[0,-1],arrowup:[0,-1],s:[0,1],arrowdown:[0,1],a:[-1,0],arrowleft:[-1,0],d:[1,0],arrowright:[1,0]};
window.addEventListener('keydown',e=>{
  if(!e.repeat&&!e.target?.toString().includes('Button')){
    if(e.code==='Space'){e.preventDefault();jump();}
  }
  if(vectors[e.key.toLowerCase()]){e.preventDefault();pressed.add(e.key.toLowerCase());route=[];marker.visible=false;}});
window.addEventListener('keyup',e=>pressed.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>pressed.clear());
document.querySelectorAll<HTMLButtonElement>('[data-move]').forEach(button=>{button.onpointerdown=e=>{button.setPointerCapture(e.pointerId);pressed.add(button.dataset.move!);route=[];};const release=()=>pressed.delete(button.dataset.move!);button.onpointerup=release;button.onpointercancel=release;button.onlostpointercapture=release;});
batchStaticLandscape(scene);
let before=0;
let running=false;
const movingSpeed=()=>running?7:4;
window.addEventListener('keydown',e=>{if(e.key==='Shift')running=true;});
window.addEventListener('keyup',e=>{if(e.key==='Shift')running=false;});
window.addEventListener('blur',()=>{running=false;});
function animate(ms:number){const dt=Math.min((ms-before)/1000,.04);before=ms;let dx=0,dz=0;
  for(const key of pressed){const [x,z]=vectors[key];dx+=x*Math.cos(angle)+z*Math.sin(angle);dz+=-x*Math.sin(angle)+z*Math.cos(angle);}
  if(!pressed.size&&route.length){const p=route[0],dist=Math.hypot(p.x-player.root.position.x,p.z-player.root.position.z);if(dist<.12)route.shift();else{dx=(p.x-player.root.position.x)/dist;dz=(p.z-player.root.position.z)/dist;}}
  const length=Math.hypot(dx,dz);moving=false;
  if(length){stand();dx/=length;dz/=length;const p=player.root.position,nx=p.x+dx*(movingSpeed())*dt,nz=p.z+dz*(movingSpeed())*dt;if(canWalk({x:nx,z:p.z})){p.x=nx;moving=true;}if(canWalk({x:p.x,z:nz})){p.z=nz;moving=true;}player.root.rotation.y=Math.atan2(dx,dz);}
  const jumpProgress=Math.min(1,Math.max(0,(ms-jumpAt)/630));
  const airborne=Math.sin(jumpProgress*Math.PI);
  const position=player.root.position;
  if(departedSeat&&Math.hypot(position.x-departedSeat.x,position.z-departedSeat.z)>1.1)departedSeat=undefined;
  if(!posing&&!seated&&!length&&!pressed.size&&!route.length&&jumpProgress===1){
    seated=seats.find(seat=>seat!==departedSeat&&Math.hypot(position.x-seat.x,position.z-seat.z)<.85);
    if(seated){
      position.x=seated.x;position.z=seated.z;
      player.root.rotation.y=0;marker.visible=false;
    }
  }
  canvas.dataset.seated=String(!!seated);
  skirt.rotation.x=seated?-0.37:0;
  playerModel.position.y=seated?seated.height-.52:airborne*.98;
  player.legs.forEach((leg,i)=>{
    leg.rotation.x=seated?-1.35:airborne*-.43+(moving?legSwing(ms/1000,running,i/2)*.58:0);
    knees[i].rotation.x=seated?1.3:airborne*.65;
  });
  const waving=ms-waveAt<1000;
  player.arms.forEach((arm,i)=>{
    arm.rotation.x=moving?-Math.sin(ms*.014+i*Math.PI)*.42:0;
    arm.rotation.z=posing?(i===0?-1:1)*Math.PI/2:airborne*(i===0?-1:1)*.52;
    elbows[i].rotation.z=waving&&i===1?1+.23*Math.sin(ms*.031):0;
    if(waving&&i===1&&!posing)arm.rotation.z=1.26;
  });
  player.body.position.y=.86+(moving?Math.abs(Math.sin(ms*.012))*.035:0);
  // Camera follows the walker, so the added districts are explorable instead of off-screen decoration.
  const riverDistance=player.root.position.z-riverCenter(player.root.position.x);
  const onBridge=BRIDGE_X.some(x=>Math.abs(player.root.position.x-x)<2)&&Math.abs(riverDistance)<4.5;
  const bridgeHeight=onBridge?.1+.7*Math.sin((riverDistance+4.5)/9*Math.PI):0;
  player.root.position.y=Math.max(terrainHeight(player.root.position.x,player.root.position.z),bridgeHeight);
  if(viewing&&(dx||dz||overview)){viewing=false;zoom=1;updateCamera();}
  if(viewing){focus.lerp(new T.Vector3(shrine.x,terrainHeight(shrine.x,shrine.z)+3,shrine.z),1-Math.exp(-dt*4));aimCamera();}
  else if(!overview){focus.lerp(new T.Vector3(player.root.position.x,player.root.position.y,player.root.position.z-1),1-Math.exp(-dt*4));aimCamera();}
  const wardrobe=$('wardrobe');
  const showWardrobe=canChangeClothes();
  if(wardrobe.hidden===showWardrobe){
    if(!showWardrobe&&wardrobe.contains(document.activeElement))canvas.focus();
    wardrobe.hidden=!showWardrobe;
  }
  const nearBell=Math.hypot(player.root.position.x-bell.x,player.root.position.z-bell.z)<6;
  const nearStatue=Math.hypot(player.root.position.x-shrine.x,player.root.position.z-shrine.z)<7;
  const {x,z}=player.root.position;
  const byChime=near(chime,x,z,1.65),byShelter=near(shelter,x,z,4.5);
  const forestKey=forestStop({x,z}),stop=wetlandStop({x,z});
  const wetlandAction=forestKey?forestActions[forestKey]:stop?wetlandActions[stop]:undefined;
  const action=$('greet'),label=wetlandAction?.label??(byChime?'풍경 건드리기':byShelter?(rest.listening?'계곡 소리 끄기':'계곡 소리 듣기'):nearBell?'범종 울리기':nearStatue?'불상 감상 전환':'가까운 주민에게 인사하기');
  if(action.getAttribute('aria-label')!==label){action.setAttribute('aria-label',label);action.title=label;action.querySelector('path')?.setAttribute('d',wetlandAction?.icon??(byShelter&&!byChime?'M2 8q3-4 6 0t6 0t8 0M2 15q3-4 6 0t6 0t8 0':byChime||nearBell?'M4 17h16l-2-3V9a6 6 0 0 0-12 0v5z M10 20h4':nearStatue?'M2 12Q12 -2 22 12Q12 26 2 12Z M10 12a2 2 0 1 0 4 0a2 2 0 1 0-4 0':'M20 11c0 5-8 10-8 10S4 16 4 11a4 4 0 0 1 8-2 4 4 0 0 1 8 2Z'));}
  canvas.dataset.pineWind=wind(x,z).toFixed(2);
  forest.update(ms);wetland.update(ms);rest.animate(ms,x,z);retreat.animate(ms);animateLandscape(ms);
  guide.head.rotation.z=Math.sin(ms*.001)*.025;
  for(const villager of villagers){
    const {actor,kind,path}=villager;
    const position=actor.root.position;
    const target=path[villager.index+villager.direction];
    let walking=false;
    if(target&&ms>=Math.max(villager.waitUntil,villager.greetUntil)){
      const dx=target.x-position.x,dz=target.z-position.z,distance=Math.hypot(dx,dz);
      const step=dt*(.85+kind%3*.13);
      if(distance<=step){
        position.x=target.x;position.z=target.z;villager.index+=villager.direction;
        if(villager.index===0||villager.index===path.length-1){
          villager.direction*=-1;villager.waitUntil=ms+2100+kind%4*700;
        }
      }else{
        position.x+=dx/distance*step;position.z+=dz/distance*step;
        const heading=Math.atan2(dx,dz),difference=heading-actor.root.rotation.y;
        actor.root.rotation.y+=Math.atan2(Math.sin(difference),Math.cos(difference))*Math.min(1,dt*9);
        villager.distanceWalked+=step;
        walking=true;
      }
    }
    actor.legs.forEach((leg,i)=>leg.rotation.x=walking?legSwing(ms/1000,false,i/2)*.29:0);
    actor.root.position.y=terrainHeight(position.x,position.z);
    if(ms>villager.greetUntil)actor.arms[0].rotation.z=0;
  }
  canvas.dataset.villagersWalked=String(villagers.filter(v=>v.distanceWalked>.25).length);
  petals.children.forEach((petal,i)=>{petal.position.y-=dt*.25;petal.position.x+=Math.sin(ms*.0004+i)*dt*.15;petal.rotation.z+=dt*.5;if(petal.position.y<.12)petal.position.y=7;});
  ripples.forEach((ring,i)=>{ring.scale.setScalar(1+((ms*.00025+i*.25)%1)*1.5);});
  if(!route.length)marker.visible=false;
  $('position').textContent=`3D · 위치 ${player.root.position.x.toFixed(1)}, ${player.root.position.z.toFixed(1)}`;
  renderer.render(scene,camera);canvas.dataset.drawCalls=String(renderer.info.render.calls);canvas.dataset.triangles=String(renderer.info.render.triangles);requestAnimationFrame(animate);
}
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();showError('3D 화면 연결이 끊겼습니다. 다시 불러오기를 선택해 주세요.');});
$('loading').hidden=true;updateCamera();requestAnimationFrame(animate);
