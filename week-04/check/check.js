// week-04 게임 확인 도구
//
// 쓰는 법 (QUEST-TRACK-2 폴더에서):
//   node week-04/check/check.js practice   → 연습 게임 확인
//   node week-04/check/check.js .          → 내 게임 (week-04/index.html) 확인
//
// 하는 일:
//   1. 화면 없는 Chrome(또는 Edge)으로 게임을 열어요. 파일을 두 번 누른 것처럼 file:// 로 열어요.
//   2. 그림·소리를 다 불러왔는지, 자바스크립트 오류가 났는지, 화면이 창에 꽉 차는지 봐요.
//   3. → 키를 누르고 스페이스를 눌러 본 뒤 상태를 봐요.
//   4. 여러 창 크기로 화면 사진을 찍어서 check/shots 에 저장해요.
//
// check/shots(사진)와 check/tmp(시험용 페이지, 브라우저 임시 폴더)는 커밋하지 않아요 (.gitignore).
// 새로 설치할 것은 없어요. Node.js 와 이미 있는 Chrome/Edge 만 써요.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CHECK_DIR = __dirname;
const WEEK_DIR = path.dirname(CHECK_DIR);
const SHOTS_DIR = path.join(CHECK_DIR, 'shots');
const TMP_DIR = path.join(CHECK_DIR, 'tmp');
const PROFILE_DIR = path.join(TMP_DIR, 'browser-profile');

const BROWSERS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

// 사진을 찍을 창 크기
const SIZES = [
  { name: 'wide', w: 1280, h: 720 },  // 보통 모니터 비율
  { name: 'tall', w: 1000, h: 800 },  // 세로가 긴 창
  { name: 'small', w: 640, h: 400 },  // 작은 창
];

// 키를 눌러 보는 순서 (밀리초)
const KEY_SCRIPT = [
  { at: 200, type: 'keydown', code: 'ArrowRight' },
  { at: 500, type: 'keydown', code: 'Space' },
  { at: 550, type: 'keyup', code: 'Space' },
  { at: 900, type: 'keyup', code: 'ArrowRight' },
];
const REPORT_AT = 1500; // 이때 결과를 모아요

// 게임 스크립트보다 먼저 실행돼서, 그림·소리 불러오기와 오류를 기록해요.
function hookScript(pressKeys) {
  return `<script>
(function () {
  const R = { errors: [], notes: [], images: [], sounds: [] };
  addEventListener('error', e => {
    if (e.target && e.target !== window) return; // 그림·소리 실패는 아래에서 따로 기록
    R.errors.push(e.message);
  }, true);
  addEventListener('unhandledrejection', e => {
    const msg = String(e.reason && (e.reason.name + ': ' + e.reason.message) || e.reason);
    // 사람이 누르지 않은 키로는 브라우저가 소리 재생을 막아요. 오류가 아니라 참고로만 적어요.
    if (/NotAllowedError/.test(msg)) R.notes.push('브라우저가 자동 재생을 막음 (사람이 직접 누르면 재생돼요)');
    else R.errors.push(msg);
  });

  const OrigImage = window.Image;
  window.Image = function (w, h) {
    const img = new OrigImage(w, h);
    const rec = { img, state: '불러오는 중' };
    R.images.push(rec);
    img.addEventListener('load', () => rec.state = img.naturalWidth + '×' + img.naturalHeight);
    img.addEventListener('error', () => rec.state = '실패');
    return img;
  };

  const OrigAudio = window.Audio;
  window.Audio = function (src) {
    const a = new OrigAudio(src);
    const rec = { a, state: '불러오는 중' };
    R.sounds.push(rec);
    a.addEventListener('loadedmetadata', () => rec.state = a.duration.toFixed(2) + '초');
    a.addEventListener('error', () => rec.state = '실패');
    return a;
  };

  ${pressKeys ? `
  for (const k of ${JSON.stringify(KEY_SCRIPT)})
    setTimeout(() => dispatchEvent(new KeyboardEvent(k.type, { code: k.code, key: k.code === 'Space' ? ' ' : k.code })), k.at);
  ` : ''}

  setTimeout(() => {
    const canvas = document.querySelector('canvas');
    const box = canvas && canvas.getBoundingClientRect();
    const out = {
      errors: R.errors,
      notes: [...new Set(R.notes)],
      images: R.images.map(r => ({ src: decodeURI(r.img.src.split('/').pop()), state: r.state })),
      sounds: R.sounds.map(r => ({ src: decodeURI(r.a.src.split('/').pop()), state: r.state, loop: r.a.loop })),
      window: { w: innerWidth, h: innerHeight },
      canvas: box && { w: Math.round(box.width), h: Math.round(box.height) },
    };
    const pre = document.createElement('pre');
    pre.id = '__check';
    pre.style.display = 'none';
    pre.textContent = JSON.stringify(out);
    document.body.appendChild(pre);
  }, ${REPORT_AT});
})();
</script>`;
}

// 게임 index.html 에 기록용 스크립트를 넣은 시험용 사본을 check/tmp 에 만들어요.
// <base> 로 게임 폴더를 가리키게 해서 assets 경로는 원래대로 찾아가요.
function makeTestPage(gameDir, pressKeys, name) {
  const html = fs.readFileSync(path.join(gameDir, 'index.html'), 'utf8');
  const base = `<base href="${pathToFileUrl(gameDir)}/">`;
  if (!/<head[^>]*>/i.test(html)) throw new Error('index.html 에 <head> 가 없어요.');
  const out = html.replace(/<head[^>]*>/i, m => m + base + hookScript(pressKeys));
  const file = path.join(TMP_DIR, name);
  fs.writeFileSync(file, out);
  return file;
}

function pathToFileUrl(p) {
  return 'file:///' + path.resolve(p).replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/').replace('%3A', ':');
}

function runBrowser(browser, args) {
  return execFileSync(browser, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--mute-audio',
    `--user-data-dir=${PROFILE_DIR}`,
    `--virtual-time-budget=${REPORT_AT + 1000}`,
    ...args,
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 60000 });
}

function readReport(dom) {
  const m = dom.match(/<pre id="__check"[^>]*>([\s\S]*?)<\/pre>/);
  if (!m) return null;
  const text = m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  return JSON.parse(text);
}

function main() {
  const target = process.argv[2] || 'practice';
  const gameDir = path.resolve(WEEK_DIR, target);
  const label = target === '.' ? 'my-game' : path.basename(gameDir);
  if (!fs.existsSync(path.join(gameDir, 'index.html'))) {
    console.log(`index.html 이 없어요: ${gameDir}`);
    process.exit(1);
  }
  const browser = BROWSERS.find(b => fs.existsSync(b));
  if (!browser) {
    console.log('Chrome 이나 Edge 를 찾지 못했어요.');
    process.exit(1);
  }
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });

  const idlePage = makeTestPage(gameDir, false, `${label}-idle.html`);
  const keysPage = makeTestPage(gameDir, true, `${label}-keys.html`);

  // 1) 상태 기록 (키를 누르지 않은 것 / 누른 것)
  const sizeArg = `--window-size=${SIZES[0].w},${SIZES[0].h}`;
  const idle = readReport(runBrowser(browser, [sizeArg, '--dump-dom', pathToFileUrl(idlePage)]));
  const keys = readReport(runBrowser(browser, [sizeArg, '--dump-dom', pathToFileUrl(keysPage)]));

  // 2) 사진
  const shots = [];
  for (const s of SIZES) {
    const file = path.join(SHOTS_DIR, `${label}-${s.name}-${s.w}x${s.h}.png`);
    runBrowser(browser, [`--window-size=${s.w},${s.h}`, `--screenshot=${file}`, pathToFileUrl(idlePage)]);
    shots.push(file);
  }
  const keysShot = path.join(SHOTS_DIR, `${label}-after-keys-${SIZES[0].w}x${SIZES[0].h}.png`);
  runBrowser(browser, [sizeArg, `--screenshot=${keysShot}`, pathToFileUrl(keysPage)]);
  shots.push(keysShot);

  // 3) 결과 알려 주기
  const ok = [];
  const bad = [];
  const unchecked = [];

  if (!idle) {
    bad.push('결과를 읽지 못했어요. 게임 페이지가 열리지 않았을 수 있어요.');
  } else {
    const imgFail = idle.images.filter(i => i.state === '실패' || i.state === '불러오는 중');
    if (idle.images.length === 0) unchecked.push('그림: new Image() 로 불러온 그림이 없어서 확인하지 못했어요.');
    else if (imgFail.length) bad.push('그림 못 불러옴: ' + imgFail.map(i => `${i.src}(${i.state})`).join(', '));
    else ok.push(`그림 ${idle.images.length}개 모두 불러옴: ` + idle.images.map(i => `${i.src} ${i.state}`).join(', '));

    const sndFail = idle.sounds.filter(s => s.state === '실패');
    const sndWait = idle.sounds.filter(s => s.state === '불러오는 중');
    if (idle.sounds.length === 0) unchecked.push('소리: new Audio() 로 불러온 소리가 없어서 확인하지 못했어요.');
    if (sndFail.length) bad.push('소리 못 불러옴: ' + sndFail.map(s => s.src).join(', '));
    if (sndWait.length) unchecked.push('소리 파일 상태를 시간 안에 알지 못함: ' + sndWait.map(s => s.src).join(', '));
    const sndOk = idle.sounds.filter(s => !sndFail.includes(s) && !sndWait.includes(s));
    if (sndOk.length) ok.push(`소리 파일 ${sndOk.length}개 불러옴: ` + sndOk.map(s => `${s.src} ${s.state}${s.loop ? ' (반복)' : ''}`).join(', '));

    if (idle.canvas) {
      const fullW = Math.abs(idle.canvas.w - idle.window.w) <= 2;
      const fullH = Math.abs(idle.canvas.h - idle.window.h) <= 2;
      const msg = `창 ${idle.window.w}×${idle.window.h} → 게임 화면 ${idle.canvas.w}×${idle.canvas.h}`;
      if (fullW || fullH) ok.push(`화면 크기: ${msg} (${fullW && fullH ? '꽉 참' : '한쪽이 꽉 참, 나머지는 검은 띠'})`);
      else bad.push(`화면 크기: ${msg} (창에 꽉 차지 않음)`);
    } else {
      unchecked.push('화면 크기: canvas 가 없어서 확인하지 못했어요.');
    }
  }

  const errors = [...new Set([...(idle ? idle.errors : []), ...(keys ? keys.errors : [])])];
  if (idle || keys) {
    if (errors.length) bad.push('자바스크립트 오류: ' + errors.join(' / '));
    else ok.push('자바스크립트 오류: 없음 (키를 누르기 전과 누른 뒤 모두)');
  }
  if (keys) ok.push('→ 키와 스페이스를 눌렀을 때 멈추지 않고 계속 돌아감');
  else bad.push('키를 누르는 시험의 결과를 읽지 못했어요.');

  ok.push('화면 사진 ' + shots.length + '장 찍음 (그림이 맞게 보이는지는 사진을 열어 봐야 알아요):');
  const notes = [...new Set([...(idle ? idle.notes : []), ...(keys ? keys.notes : [])])];

  unchecked.push('소리가 실제로 들리는지 (화면 없는 브라우저는 소리를 내지 않아요). 직접 열고 키를 눌러 들어 봐 주세요.');
  unchecked.push('사람이 직접 키를 눌렀을 때의 느낌 (속도, 점프 높이 같은 것)');

  console.log(`\n=== 확인 결과: ${label} (${path.relative(path.dirname(WEEK_DIR), gameDir) || '.'}\\index.html) ===`);
  console.log(`브라우저: ${path.basename(browser)}`);
  console.log('\n[확인한 것]');
  for (const line of ok) console.log('- ' + line);
  for (const s of shots) console.log('    ' + path.relative(path.dirname(WEEK_DIR), s));
  if (bad.length) {
    console.log('\n[문제]');
    for (const line of bad) console.log('- ' + line);
  }
  if (notes.length) {
    console.log('\n[참고]');
    for (const line of notes) console.log('- ' + line);
  }
  console.log('\n[확인하지 못한 것]');
  for (const line of unchecked) console.log('- ' + line);
  console.log('');
  process.exit(bad.length ? 1 : 0);
}

main();
