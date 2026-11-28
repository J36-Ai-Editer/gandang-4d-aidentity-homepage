import * as T from 'three';
import {terrainHeight,FOREST_TRAIL,FOREST_STOPS,forestStop,type Position} from './world3d.ts';

export const forestActions={
  deer:{label:'사슴에게 인사하기',icon:'M5 3v5l5 4m9-9v5l-5 4M7 5l-2 3m12-3 2 3M10 12h4l2 5-4 4-4-4Z'},
  herb:{label:'불로초 살펴보기',icon:'M3 13a9 8 0 0 1 18 0ZM10 13v7h4v-7'}
};

export function buildForest(scene:T.Scene){
  const root=new T.Group();root.name='pine-and-mushroom-pass';scene.add(root);
  const materials=new Map<number,T.MeshStandardMaterial>();
  function mesh(parent:T.Object3D,geometry:T.BufferGeometry,color:number,x:number,y:number,z:number){
    if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:.83}));
    const item=new T.Mesh(geometry,materials.get(color));item.position.set(x,y,z);
    item.castShadow=true;item.receiveShadow=true;parent.add(item);return item;
  }
  function oval(parent:T.Object3D,color:number,x:number,y:number,z:number,w:number,h:number,d:number){
    const item=mesh(parent,new T.SphereGeometry(1,16,11),color,x,y,z);item.scale.set(w,h,d);return item;
  }
  const print=new T.CircleGeometry(.115,10);print.rotateX(-Math.PI/2);
  for(let i=1;i<FOREST_TRAIL.length-1;i++){
    const [x,z]=FOREST_TRAIL[i-1],[ex,ez]=FOREST_TRAIL[i];
    const count=Math.ceil(Math.hypot(ex-x,ez-z)/1.3);
    for(let j=0;j<count;j++){
      const direction=Math.atan2(ex-x,ez-z),side=j%2?.33:-.33;
      const px=x+(ex-x)*j/count+Math.cos(direction)*side;
      const pz=z+(ez-z)*j/count-Math.sin(direction)*side;
      for(const toe of [-.08,.08]){
        const a=px+toe*Math.cos(direction),b=pz-toe*Math.sin(direction);
        const mark=mesh(root,print,0x80664a,a,terrainHeight(a,b)+.043,b);
        mark.rotation.y=direction;mark.scale.z=1.6;mark.castShadow=false;
      }
    }
  }
  function at(point:Position,dynamic=false){
    const group=new T.Group();group.position.set(point.x,terrainHeight(point.x,point.z),point.z);
    group.userData.dynamic=dynamic;root.add(group);return group;
  }
  const deer=at(FOREST_STOPS.deer,true);
  oval(deer,0xa8774b,0,1.12,0,.48,.49,.91);
  oval(deer,0xe5c49e,0,.98,.28,.36,.28,.54);
  for(const side of [-1,1])for(const end of [-1,1]){
    mesh(deer,new T.CylinderGeometry(.075,.042,.88,10),0x91613e,side*.29,.48,end*.53);
    oval(deer,0x504238,side*.29,.08,end*.53+.045,.09,.08,.12);
  }
  const neck=new T.Group();neck.position.set(0,1.24,.52);deer.add(neck);
  oval(neck,0xab784c,0,.39,.16,.25,.61,.27).rotation.x=.28;
  oval(neck,0xb28455,0,.94,.3,.28,.26,.36);
  oval(neck,0x533e32,0,.88,.61,.15,.09,.082);
  for(const side of [-1,1]){
    oval(neck,0x382e27,side*.235,.98,.47,.072,.066,.065);
    oval(neck,0xba8a64,side*.32,1.12,.25,.23,.1,.105).rotation.z=side*.42;
    const branch=new T.CatmullRomCurve3([new T.Vector3(side*.16,1.12,.24),new T.Vector3(side*.28,1.47,.12),new T.Vector3(side*.38,1.71,.03)]);
    mesh(neck,new T.TubeGeometry(branch,10,.038,7),0xc1a982,0,0,0);
    const fork=new T.LineCurve3(new T.Vector3(side*.27,1.45,.12),new T.Vector3(side*.26,1.64,.23));
    mesh(neck,new T.TubeGeometry(fork,4,.028,6),0xc1a982,0,0,0);
    for(let i=0;i<4;i++)oval(deer,0xe8cd9b,side*.441,1.22+(i%2)*.11,-.48+i*.24,.035,.047,.055);
  }
  const herbs=at(FOREST_STOPS.herb,true);
  for(const [x,z,size] of [[0,0,1],[.44,-.28,.65],[-.43,.15,.55]]){
    mesh(herbs,new T.CylinderGeometry(.09,.15,.42,12),0xbe9463,x,.21,z);
    oval(herbs,0x6a3629,x,.43,z,.45*size,.15,.36*size);
    oval(herbs,0xc37844,x,.51,z,.39*size,.09,.315*size);
    oval(herbs,0x9f4833,x,.56,z,.26*size,.055,.21*size);
  }
  const found=new Set<keyof typeof FOREST_STOPS>();
  let greeted=-5000,inspected=-5000;
  return {
    interact(player:Position,now:number){
      const key=forestStop(player);if(!key)return false;
      found.add(key);
      if(key==='deer'){greeted=now;deer.rotation.y=Math.atan2(player.x-deer.position.x,player.z-deer.position.z);}
      else inspected=now;
      const status=document.getElementById('wetland-status')!;
      status.textContent=(key==='deer'?'사슴 발견 · 사슴이 고개를 끄덕입니다.':'불로초 발견 · 소나무 아래 영지의 빛깔을 살펴봅니다.')+' '+found.size+'/2';
      status.classList.remove('show');void status.offsetWidth;status.classList.add('show');
      return true;
    },
    update(ms:number){
      const time=ms-greeted;
      neck.rotation.x=time<1800?Math.sin(time/1800*Math.PI)*.51:Math.sin(ms*.0015)*.045;
      const look=ms-inspected;
      herbs.scale.setScalar(look<1300?1+.09*Math.sin(look/1300*Math.PI):1);
    }
  };
}
