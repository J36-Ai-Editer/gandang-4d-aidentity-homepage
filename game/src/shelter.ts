import * as T from 'three';
import {terrainHeight} from './world3d.ts';

export const shelter = {x:-40,z:-35};
export const chime = {x:-38,z:-34};

export function buildShelter(scene:T.Scene) {
  const group=new T.Group();
  group.position.set(shelter.x,terrainHeight(shelter.x,shelter.z),shelter.z);
  scene.add(group);
  const wood=new T.MeshStandardMaterial({color:0x704c36,roughness:.85});
  const tile=new T.MeshStandardMaterial({color:0x404d50,roughness:.8});
  const brass=new T.MeshStandardMaterial({color:0xbc9353,metalness:.55,roughness:.47});
  function mesh(geometry:T.BufferGeometry,material:T.Material,x:number,y:number,z:number,parent:T.Object3D=group){
    const item=new T.Mesh(geometry,material);
    item.position.set(x,y,z);item.castShadow=true;item.receiveShadow=true;parent.add(item);
    return item;
  }
  mesh(new T.BoxGeometry(5,.32,4),wood,0,.1,0);
  mesh(new T.BoxGeometry(3.3,.2,.55),wood,0,.57,-1.45);
  for(const x of [-2.15,2.15])for(const z of [-1.65,1.65])
    mesh(new T.CylinderGeometry(.15,.18,3.3,12),wood,x,1.75,z);
  for(let side=-1;side<=1;side+=2){
    const panel=mesh(new T.BoxGeometry(5.8,.23,2.6),tile,0,3.95,side*1.18);
    panel.rotation.x=side*.37;
    for(let i=0;i<24;i++){
      const rib=mesh(new T.CylinderGeometry(.067,.082,2.6,8),tile,-2.77+i*.24,4.07,side*1.17);
      rib.rotation.x=Math.PI/2+side*.37;
    }
  }
  mesh(new T.BoxGeometry(5.95,.27,.22),tile,0,4.52,0);
  const windBell=new T.Group();
  windBell.userData.dynamic=true;windBell.position.set(2,3.46,1);group.add(windBell);
  mesh(new T.CylinderGeometry(.02,.02,.48,8),brass,0,-.24,0,windBell);
  mesh(new T.CylinderGeometry(.11,.24,.31,24,1,true),brass,0,-.56,0,windBell);
  mesh(new T.BoxGeometry(.17,.28,.035),brass,0,-.93,0,windBell);

  let audio:AudioContext|undefined;
  let creekBuffer:AudioBuffer|undefined;
  let stream:AudioBufferSourceNode|undefined;
  let streamGain:GainNode|undefined;
  let listening=false;
  let ringAt=-10000;
  function stop(){
    if(stream&&audio&&streamGain){
      streamGain.gain.setTargetAtTime(.0001,audio.currentTime,.16);
      stream.stop(audio.currentTime+.9);
    }
    stream=undefined;streamGain=undefined;listening=false;
  }
  return {
    get listening(){return listening;},
    toggle(){
      if(listening){stop();return;}
      audio??=new AudioContext();
      void audio.resume().catch(()=>{});
      if(!creekBuffer){
        const length=audio.sampleRate*16;
        creekBuffer=audio.createBuffer(1,length,audio.sampleRate);
        const samples=creekBuffer.getChannelData(0);
        let current=0, gravel=0, ripple=0;
        for(let i=0;i<length;i++){
          const noise=Math.random()*2-1;
          current=.96*current+.04*noise;
          gravel=.75*gravel+.25*noise;
          ripple=.998*ripple+.002*noise;
          const t=i/audio.sampleRate;
          const swell=.85+.1*Math.sin(t*1.8)+.05*Math.sin(t*4.3);
          const seam=Math.min(1,i/1600,(length-1-i)/1600);
          samples[i]=(current*.73+(gravel-current)*(.18+ripple))*swell*seam;
        }
      }
      stream=audio.createBufferSource();
      stream.buffer=creekBuffer;stream.loop=true;
      const filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=2200;
      streamGain=audio.createGain();streamGain.gain.setValueAtTime(0,audio.currentTime);
      streamGain.gain.setTargetAtTime(.36,audio.currentTime,.32);
      stream.connect(filter).connect(streamGain).connect(audio.destination);
      const source=stream, gain=streamGain;
      source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
      stream.start();listening=true;
    },
    ring(){
      if(performance.now()-ringAt<700)return;
      ringAt=performance.now();
      audio??=new AudioContext();const context=audio;
      void context.resume().catch(()=>{});
      for(const [frequency,volume,duration] of [[670,.048,2.7],[1109,.021,1.75],[1738,.008,.71],[2465,.003,.27]]){
        const tone=context.createOscillator(), envelope=context.createGain(),now=context.currentTime;
        tone.onended=()=>{tone.disconnect();envelope.disconnect();};
        tone.frequency.value=frequency*(.99+Math.random()*.02);
        envelope.gain.setValueAtTime(.0001,now);
        envelope.gain.exponentialRampToValueAtTime(volume,now+.025);
        envelope.gain.exponentialRampToValueAtTime(.0001,now+duration);
        tone.connect(envelope).connect(context.destination);tone.start();tone.stop(now+duration);
      }
    },
    animate(ms:number,x:number,z:number){
      if(listening&&(Math.hypot(x-shelter.x,z-shelter.z)>8||document.hidden))stop();
      if(streamGain&&audio){
        const distance=Math.hypot(x-shelter.x,z-shelter.z);
        streamGain.gain.setTargetAtTime(.36*Math.max(.06,1-distance/9),audio.currentTime,.24);
      }
      const elapsed=ms-ringAt;
      windBell.rotation.z=.055*Math.sin(ms*.002)+.48*Math.sin(elapsed*.012)*Math.exp(-elapsed/770);
    }
  };
}
