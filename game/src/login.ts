const musicToggle = document.querySelector<HTMLButtonElement>('#login-music')!;
const music = new Audio(new URL('assets/login-promenade.wav', document.baseURI).href);
music.loop = true;
music.volume = .38;
let wantsMusic = true;
function syncMusic() {
  musicToggle.setAttribute('aria-pressed', String(!music.paused));
  musicToggle.setAttribute('aria-label', music.paused ? '배경음악 켜기' : '배경음악 끄기');
}
function playMusic() {
  if (!wantsMusic || document.hidden) return;
  void music.play().then(syncMusic).catch(syncMusic);
}
musicToggle.addEventListener('click', () => {
  wantsMusic = music.paused;
  if (wantsMusic) playMusic();
  else { music.pause(); syncMusic(); }
});
document.addEventListener('pointerdown', event => {
  if (event.target instanceof Node && !musicToggle.contains(event.target)) playMusic();
});
document.addEventListener('keydown', event => {
  if (event.target !== musicToggle) playMusic();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { music.pause(); syncMusic(); }
  else playMusic();
});
playMusic();
const status = document.querySelector<HTMLParagraphElement>('#auth-status')!;
const toggle = document.querySelector<HTMLButtonElement>('#email-toggle')!;
const form = document.querySelector<HTMLFormElement>('#email-form')!;
const submit = form.querySelector<HTMLButtonElement>('button[type=submit]')!;
const language = document.querySelector<HTMLSelectElement>('#login-language')!;
const copy = {
  ko: ['3초 만에 회원가입','이메일로 로그인','로그인 없이 체험하기','이메일','비밀번호','로그인','소셜 로그인은 연결 준비 중입니다.','이메일과 비밀번호를 확인해 주세요.','인증 서버에 연결할 수 없습니다.','잠시 후 다시 시도해 주세요.','언어'],
  en: ['Quick sign-up','Sign in with email','Play as guest','Email','Password','Sign in','Social sign-in is coming soon.','Check your email and password.','Could not reach the sign-in service.','Please try again later.','Language'],
  ja: ['かんたん登録','メールでログイン','ゲストで遊ぶ','メールアドレス','パスワード','ログイン','ソーシャルログインは準備中です。','メールアドレスとパスワードをご確認ください。','認証サービスに接続できません。','しばらくしてからお試しください。','言語'],
  zh: ['快速注册','使用邮箱登录','以访客身份体验','邮箱','密码','登录','社交登录正在准备中。','请检查邮箱和密码。','无法连接登录服务。','请稍后重试。','语言']
} as const;
function applyLanguage(value: string) {
  const locale = Object.hasOwn(copy, value) ? value as keyof typeof copy : 'ko';
  language.value = locale;
  document.documentElement.lang = locale === 'zh' ? 'zh-Hans' : locale;
  const strings = copy[locale];
  const ids = ['entry-title','email-toggle','guest-label','email-label','password-label'];
  ids.forEach((id,index) => { document.getElementById(id)!.textContent = strings[index]; });
  submit.textContent = strings[5];
  language.setAttribute('aria-label',strings[10]);
  const names = locale === 'ko' ? ['구글','네이버','카카오','애플'] : ['Google','NAVER','Kakao','Apple'];
  document.querySelectorAll('[data-provider]').forEach((button,index) => {
    button.setAttribute('aria-label', names[index]);
  });
  status.hidden = true;
  return strings;
}
let strings = applyLanguage(localStorage.getItem('gandang-login-language') ?? 'ko');
language.addEventListener('change', () => {
  strings = applyLanguage(language.value);
  localStorage.setItem('gandang-login-language', language.value);
});
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-provider]')) {
  button.addEventListener('click', () => {
    status.textContent = strings[6];
    status.hidden = false;
  });
}

toggle.addEventListener('click', () => {
  form.hidden = !form.hidden;
  toggle.setAttribute('aria-expanded', String(!form.hidden));
  status.hidden = true;
  if (!form.hidden) form.querySelector<HTMLInputElement>('input')?.focus();
});
form.addEventListener('submit', async event => {
  event.preventDefault();
  const {email, password} = Object.fromEntries(new FormData(form));
  submit.disabled = true;
  status.hidden = true;
  try {
    const result = await fetch('/api/v1/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email, password})
    });
    if (!result.ok) {
      const failure = result.status >= 500 ? strings[8] :
        result.status === 429 ? strings[9] : strings[7];
      throw new Error(failure);
    }
    const {access_token} = await result.json() as {access_token?: string};
    if (!access_token) throw new Error(strings[8]);
    form.reset();
    location.assign('./');
  } catch (error) {
    status.textContent = error instanceof TypeError ? strings[8] :
      error instanceof Error ? error.message : strings[8];
    status.hidden = false;
  } finally {
    submit.disabled = false;
  }
});

const layer = document.querySelector('.petals')!;
for (let index = 0; index < 23; index += 1) {
  const petal = document.createElement('span');
  petal.className = 'petal';
  petal.style.setProperty('--left', `${index * 37 % 105 - 10}%`);
  petal.style.setProperty('--size', `${6 + index * 7 % 9}px`);
  petal.style.setProperty('--duration', `${9 + index * 5 % 10}s`);
  petal.style.setProperty('--delay', `-${index * 1.71}s`);
  layer.append(petal);
}
export {};
