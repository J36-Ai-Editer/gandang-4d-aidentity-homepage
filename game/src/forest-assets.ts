import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {terrainHeight} from './world3d.ts';

export type ForestProp = {x:number;z:number;height:number;fallback?:T.Group};
export function loadForestProps(root:T.Group,pines:ForestProp[],rocks:ForestProp[]){
  const loader=new GLTFLoader();
  async function place(file:string,prefix:string,points:ForestProp[]){
    const {scene}=await loader.loadAsync(new URL('assets/'+file,document.baseURI).href);
    const variants:T.Object3D[]=[];
    scene.traverse(node=>{if(node.name.startsWith(prefix)&&/^\d+$/.test(node.name.slice(prefix.length)))variants.push(node);});
    if(!variants.length)throw new Error('Forest asset has no matching meshes');
    for(const [i,{x,z,height,fallback}] of points.entries()){
      const model=variants[i%variants.length].clone();
      model.position.set(0,0,0);
      const bounds=new T.Box3().setFromObject(model);
      const size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
      const anchor=new T.Group();
      anchor.scale.setScalar(Math.min(height/size.y,(prefix==='PineTree_'?3.6:height*1.45)/Math.max(size.x,size.z)));
      anchor.position.set(x,terrainHeight(x,z),z);
      anchor.rotation.y=i*2.399;
      model.position.set(-center.x,-bounds.min.y,-center.z);
      model.traverse(part=>{if(part instanceof T.Mesh){part.castShadow=true;part.receiveShadow=true;}});
      anchor.add(model);root.add(anchor);
      if(fallback)fallback.visible=false;
    }
    return points.length;
  }
  return Promise.all([place('quaternius-pine.glb','PineTree_',pines),place('quaternius-rock.glb','Rock_',rocks)]);
}

export function connectPineWind(button:HTMLButtonElement, music:HTMLAudioElement){
  let context:AudioContext|undefined;
  let gain:GainNode|undefined;
  button.addEventListener('click',()=>{
    if(!context){
      context=new AudioContext();
      const buffer=context.createBuffer(1,context.sampleRate*12,context.sampleRate);
      const samples=buffer.getChannelData(0);
      let filtered=0;
      for(let i=0;i<samples.length;i++){
        filtered=.86*filtered+.14*(Math.random()*2-1);
        const time=i/context.sampleRate;
        samples[i]=filtered*(.62+.24*Math.cos(time*Math.PI/6)+.14*Math.sin(time*Math.PI/2));
      }
      samples[0]=samples[samples.length-1]=0;
      const source=context.createBufferSource();source.buffer=buffer;source.loop=true;
      const filter=context.createBiquadFilter();filter.type='bandpass';filter.frequency.value=850;filter.Q.value=.48;
      gain=context.createGain();gain.gain.value=0;
      source.connect(filter).connect(gain).connect(context.destination);source.start();
    }
    void context.resume().catch(()=>{});
  });
  return (x:number,z:number)=>{
    const blend=Math.max(0,Math.min(1,1-Math.hypot((x-74)/24,(z+78)/23)));
    const enabled=button.getAttribute('aria-pressed')==='true'&&!document.hidden;
    if(context&&gain)gain.gain.setTargetAtTime(enabled?.41*blend:0,context.currentTime,.42);
    music.volume=.24-.1*blend;
    return enabled&&context?.state==='running'?blend:0;
  };
}
