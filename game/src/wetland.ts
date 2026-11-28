import * as T from 'three';
import {terrainHeight,WETLAND_POOL,WETLAND_STOPS,wetlandStop,type Position} from './world3d.ts';

const eye='M2 12Q12 -2 22 12Q12 26 2 12Z M10 12a2 2 0 1 0 4 0a2 2 0 1 0-4 0';
export const wetlandActions={
  water:{label:'여울 살펴보기',icon:'M2 8q3-4 6 0t6 0t8 0M2 15q3-4 6 0t6 0t8 0',found:'물 발견 · 잔물결이 번집니다.'},
  turtle:{label:'거북에게 인사하기',icon:'M3 15q2-9 9-8 5 0 7 5h3v3H3Zm3 0v3m10-3v3',found:'거북 발견 · 거북이 고개를 내밉니다.'},
  crane:{label:'학 관찰하기',icon:eye,found:'학 발견 · 학이 날개를 펼칩니다.'}
};

export function buildWetland(scene:T.Scene){
  const {x,z,rx,rz}=WETLAND_POOL;
  const root=new T.Group();root.name='reed-wetland';scene.add(root);
  function mesh(parent:T.Object3D,geometry:T.BufferGeometry,color:number,at:number[],dynamic=false){
    const item=new T.Mesh(geometry,new T.MeshStandardMaterial({color,roughness:.83}));
    item.position.set(at[0],at[1],at[2]);item.castShadow=!dynamic;item.receiveShadow=true;parent.add(item);return item;
  }
  function oval(parent:T.Object3D,color:number,at:number[],size:number[]){
    const item=mesh(parent,new T.SphereGeometry(1,16,10),color,at);item.scale.set(size[0],size[1],size[2]);return item;
  }
  const water=mesh(root,new T.CircleGeometry(1,64),0x619b91,[x,.09,z],true);
  water.rotation.x=-Math.PI/2;water.scale.set(rx,rz,1);
  const reeds=new T.InstancedMesh(new T.CylinderGeometry(.025,.055,1,5),new T.MeshStandardMaterial({color:0x8d9a54}),156);
  const reedHeads=new T.InstancedMesh(new T.CapsuleGeometry(.063,.19,3,5),new T.MeshStandardMaterial({color:0x806744}),156);
  const dummy=new T.Object3D();
  for(let i=0;i<156;i++){
    const a=i*2.399, spread=1.04+.12*Math.sin(i*1.36);
    const px=x+Math.cos(a)*rx*spread,pz=z+Math.sin(a)*rz*spread;
    const h=.8+.9*(.5+.5*Math.cos(i*2.1)),ground=terrainHeight(px,pz);
    dummy.rotation.set(.12*Math.sin(i),0,.13*Math.cos(i));
    dummy.position.set(px,ground+h/2,pz);dummy.scale.set(1,h,1);dummy.updateMatrix();reeds.setMatrixAt(i,dummy.matrix);
    dummy.position.set(px,ground+h,pz);dummy.scale.setScalar(1);dummy.updateMatrix();reedHeads.setMatrixAt(i,dummy.matrix);
  }
  root.add(reeds,reedHeads);
  function actor(px:number,pz:number){
    const object=new T.Group();object.userData.dynamic=true;
    object.position.set(px,terrainHeight(px,pz),pz);root.add(object);return object;
  }
  const turtle=actor(WETLAND_STOPS.turtle.x,WETLAND_STOPS.turtle.z);
  oval(turtle,0x53663d,[0,.42,0],[.74,.46,.92]);
  oval(turtle,0x849568,[0,.33,.1],[.7,.27,.92]);
  const head=oval(turtle,0x748859,[0,.36,.91],[.25,.22,.35]);
  for(const side of [-1,1])for(const end of [-1,1])
    oval(turtle,0x61794e,[side*.56,.15,end*.54],[.28,.13,.27]);
  const crane=actor(WETLAND_STOPS.crane.x,WETLAND_STOPS.crane.z);
  for(const side of [-1,1])mesh(crane,new T.CylinderGeometry(.035,.035,1.04,8),0x76695a,[side*.18,.54,0]);
  oval(crane,0xf0e9d5,[0,1.12,0],[.42,.38,.66]);
  const neck=new T.CatmullRomCurve3([new T.Vector3(0,1.16,.34),new T.Vector3(0,1.63,.27),new T.Vector3(0,2.03,.39)]);
  mesh(crane,new T.TubeGeometry(neck,15,.12,10,false),0xf0e9d5,[0,0,0]);
  oval(crane,0xf0e9d5,[0,2.03,.48],[.15,.16,.22]);
  oval(crane,0xa04c42,[0,2.14,.52],[.11,.053,.13]);
  const beak=mesh(crane,new T.ConeGeometry(.077,.43,10),0xab8650,[0,2,.82]);beak.rotation.x=Math.PI/2;
  const wings=[-1,1].map(side=>{
    const pivot=new T.Group();crane.add(pivot);pivot.position.set(side*.28,1.2,0);
    oval(pivot,0xf3eee0,[side*.48,0,0],[.64,.11,.31]);
    oval(pivot,0x4b5350,[side*.87,0,-.04],[.28,.085,.23]);return pivot;
  });
  const rings=Array.from({length:3},()=>{
    const ring=new T.Mesh(new T.RingGeometry(.96,1,36),new T.MeshBasicMaterial({color:0xe2f3dc,transparent:true,depthWrite:false,side:T.DoubleSide}));
    ring.userData.dynamic=true;ring.position.set(x-3,.105,z+2);ring.rotation.x=-Math.PI/2;ring.visible=false;root.add(ring);return ring;
  });
  const found=new Set<string>();
  const time={water:-5000,turtle:-5000,crane:-5000};
  return {
    interact(position:Position){
      const stop=wetlandStop(position);if(!stop)return false;
      time[stop]=performance.now();found.add(stop);
      const status=document.getElementById('wetland-status')!;
      status.textContent=wetlandActions[stop].found+' '+found.size+'/3';
      status.classList.remove('show');void status.offsetWidth;status.classList.add('show');
      return true;
    },
    update(ms:number){
      head.position.z=.91+.36*Math.max(0,1-(ms-time.turtle)/2400);
      wings.forEach((wing,i)=>{
        const progress=Math.max(0,1-(ms-time.crane)/2450);
        wing.rotation.z=(i===0?1:-1)*(1.25-progress*(1+.2*Math.sin(ms*.016)));
      });
      rings.forEach((ring,i)=>{
        const progress=(ms-time.water-i*220)/1600;
        ring.visible=progress>=0&&progress<1;
        if(ring.visible){ring.scale.setScalar(.3+progress*2.5);ring.material.opacity=(1-progress)*.65;}
      });
    }
  };
}
