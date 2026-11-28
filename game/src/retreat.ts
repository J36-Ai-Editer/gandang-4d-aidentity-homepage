import * as T from 'three';
import {terrainHeight} from './world3d.ts';

export const shrine = {x: 10, z: -82};
export const bell = {x: -1, z: -76};

export function buildRetreat(scene:T.Scene) {
  const bronze = new T.MeshStandardMaterial({color:0xa78651, metalness:.35, roughness:.57});
  const stone = new T.MeshStandardMaterial({color:0xb2ad9c, roughness:.93});
  const timber = new T.MeshStandardMaterial({color:0x664638});
  const roof = new T.MeshStandardMaterial({color:0x525e62});
  function at(x:number,z:number) {
    const group=new T.Group(); group.position.set(x,terrainHeight(x,z),z); scene.add(group);return group;
  }
  const statue=at(shrine.x,shrine.z);
  function part(parent:T.Group,geo:T.BufferGeometry,mat:T.Material,x:number,y:number,z:number) {
    const mesh=new T.Mesh(geo,mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  function oval(x:number,y:number,z:number,w:number,h:number,d:number,mat=bronze) {
    const mesh=part(statue,new T.SphereGeometry(1,36,24),mat,x,y,z);mesh.scale.set(w,h,d);return mesh;
  }
  function turned(parent:T.Group, profile:number[][],mat:T.Material,y=0) {
    return part(parent,new T.LatheGeometry(profile.map(([r,h])=>new T.Vector2(r,h)),64),mat,0,y,0);
  }
  turned(statue,[[0,0],[2.7,0],[2.7,.28],[2.38,.4],[2.24,.78],[2.48,.86],[2.38,1],[0,1]],stone);
  for(let i=0;i<24;i++){
    const a=i*Math.PI/12;
    oval(Math.sin(a)*2.12,.71,Math.cos(a)*2.12,.35,.36,.15).rotation.y=a;
  }
  oval(0,1.48,0,1.98,.58,1.13);
  turned(statue,[[0,0],[1.44,.05],[1.35,.65],[1.1,1.5],[.94,1.82],[.5,2.03],[0,2.03]],bronze,1.42);
  oval(0,4.09,0,.73,.91,.66);
  oval(0,4.65,-.08,.73,.56,.65);oval(0,5.12,-.08,.32,.31,.32);
  for(const side of [-1,1]){
    oval(side*.7,4.03,0,.13,.38,.17);
    oval(side*.29,4.13,.57,.19,.035,.06,roof).rotation.z=side*.07;
    oval(side*1.08,2.51,.13,.36,.88,.42).rotation.z=side*.27;
    oval(side*.6,1.98,.75,.68,.23,.31).rotation.z=side*.13;
  }
  oval(0,4.02,.64,.105,.19,.1);oval(0,3.79,.60,.17,.036,.045);
  for(let i=0;i<5;i++){
    const y=2+i*.18;
    const curve=new T.CatmullRomCurve3([new T.Vector3(-1,y+.38,.51),new T.Vector3(-.3,y,.99),new T.Vector3(.45,y-.08,.96),new T.Vector3(1.13,y+.1,.48)]);
    part(statue,new T.TubeGeometry(curve,28,.038,8,false),bronze,0,0,0);
  }
  part(statue,new T.TorusGeometry(1.57,.065,12,96),bronze,0,4,-.84);
  const finish=document.createElement('canvas');
  finish.width=finish.height=512;
  const surface=finish.getContext('2d')!;
  surface.fillStyle='#b9b9b9';surface.fillRect(0,0,512,512);
  for(let i=0;i<12000;i++){
    const grain=(Math.sin(i*131.7)*43758.5453)%1;
    surface.fillStyle=i%3?'rgba(63,63,63,.12)':'rgba(247,247,247,.14)';
    surface.fillRect(Math.abs(grain)*512,(i*71.83)%512,1+i%4,1+i%3);
  }
  const patina=new T.CanvasTexture(finish);
  patina.anisotropy=4;
  bronze.bumpMap=patina;bronze.bumpScale=.033;bronze.roughnessMap=patina;
  const fill=new T.PointLight(0xffe1b4,24,13,2);
  fill.position.set(3,5,5);statue.add(fill);
  const rim=new T.PointLight(0xc4ddd5,17,11,2);
  rim.position.set(-3,5,-2);statue.add(rim);
  const pavilion=at(bell.x,bell.z);
  for(const x of [-1.8,1.8])for(const z of [-1.4,1.4])
    part(pavilion,new T.CylinderGeometry(.16,.22,3.6,16),timber,x,1.8,z);
  part(pavilion,new T.BoxGeometry(4.5,.3,3.6),timber,0,3.54,0);
  const cap=part(pavilion,new T.ConeGeometry(3.6,1.48,4),roof,0,4.37,0);cap.rotation.y=Math.PI/4;cap.scale.z=.83;
  const gong=turned(pavilion,[[.83,.8],[.9,.87],[.84,1.02],[.69,1.91],[.66,2.42],[.53,2.62],[.14,2.72],[.1,3.48]],bronze);
  gong.userData.dynamic=true;
  let until=0;let sound:AudioContext|undefined;
  return {
    interact(x:number,z:number){
      if(Math.hypot(x-bell.x,z-bell.z)>6)return false;
      until=performance.now()+4000;
      sound??=new AudioContext();const ctx=sound;
      void ctx.resume().then(()=>{
        for(const [hz,volume] of [[146,.12],[345,.07],[570,.025]]){
          const osc=ctx.createOscillator(),gain=ctx.createGain(),now=ctx.currentTime;
          osc.frequency.value=hz;gain.gain.setValueAtTime(.0001,now);
          gain.gain.exponentialRampToValueAtTime(volume,now+.04);
          gain.gain.exponentialRampToValueAtTime(.0001,now+4);
          osc.connect(gain).connect(ctx.destination);osc.start();osc.stop(now+4.1);
        }
      }).catch(()=>{});return true;
    },
    animate(ms:number){gong.rotation.z=.055*Math.sin(ms*.009)*Math.max(0,(until-ms)/4000);}
  };
}
