/** Browser media starts only inside a user's pointer/key gesture; no silent autoplay failure. */
export function connectVillageAudio(button:HTMLButtonElement) {
  const audio=new Audio(new URL('assets/gandang-theme.mp3',document.baseURI).href);
  audio.loop=true;audio.preload='none';audio.volume=.24;
  let enabled=false;
  const sync=()=>{button.setAttribute('aria-pressed',String(enabled));button.setAttribute('aria-label',enabled?'배경음악 끄기':'배경음악 켜기');};
  const toggle=async()=>{
    if(enabled){audio.pause();enabled=false;sync();return;}
    try{await audio.play();enabled=true;sync();}
    catch{enabled=false;sync();button.setAttribute('aria-label','배경음악 재생 실패, 다시 시도하기');}
  };
  button.onclick=()=>void toggle();sync();
  document.addEventListener('visibilitychange',()=>{if(document.hidden)audio.pause();else if(enabled)void audio.play().catch(()=>{enabled=false;sync();});});
  return audio;
}
