// week-06 앱 확인 도구 (week-05 게임 확인 도구를 날씨 앱에 맞게 고침)
//
// 쓰는 법 (QUEST-TRACK-2 폴더에서):
//   node week-06/check/check.js          → 내 앱 (week-06/index.html) 확인
//
// 하는 일:
//   1. 화면 없는 Chrome(또는 Edge)으로 앱을 열어요. 파일을 두 번 누른 것처럼 file:// 로 열어요.
//   2. 네 가지 경우를 만들어서 화면에 무엇이 나오는지 봐요.
//        진짜      : 진짜 Open-Meteo 에서 날씨를 받아 와요
//        불러오는중 : 답이 오지 않는 것처럼 꾸며요
//        연결실패   : 인터넷이 끊긴 것처럼 꾸며요
//        서버오류   : 서버가 500 오류를 돌려준 것처럼 꾸며요
//   3. 폰·태블릿·컴퓨터 화면 폭을 흉내 내서, 옆으로 잘리거나 넘치는 것이 있는지 봐요.
//      (화면 없는 Chrome 은 창을 500px 보다 좁게 만들지 못해서, 창 크기 대신
//       Chrome 의 '기기 흉내' 기능(DevTools)으로 폰 폭을 만들어요.)
//   4. 화면 사진을 찍어서 check/shots 에 저장해요.
//
// check/shots(사진)와 check/tmp(브라우저 임시 폴더)는 커밋하지 않아요 (.gitignore).
// 새로 설치할 것은 없어요. Node.js(22 이상)와 이미 있는 Chrome/Edge 만 써요.

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const CHECK_DIR = __dirname;
const WEEK_DIR = path.dirname(CHECK_DIR);
const ROOT_DIR = path.dirname(WEEK_DIR);
const SHOTS_DIR = path.join(CHECK_DIR, 'shots');
const TMP_DIR = path.join(CHECK_DIR, 'tmp');
const PROFILE_DIR = path.join(TMP_DIR, 'browser-profile');

const BROWSERS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

// 확인할 화면 크기 (mobile: 폰처럼 흉내 냄)
const SIZES = [
  { name: 'phone-small', w: 360, h: 740, mobile: true },   // 작은 폰
  { name: 'phone', w: 390, h: 844, mobile: true },         // 보통 폰
  { name: 'tablet', w: 768, h: 1024, mobile: true },       // 태블릿
  { name: 'desktop', w: 1280, h: 720, mobile: false },     // 컴퓨터
];

// 꾸며 볼 경우들. expect 는 그때 보여야 하는 화면이에요.
const MODES = [
  { name: 'real', label: '진짜', expect: 'weather' },
  { name: 'loading', label: '불러오는중', expect: 'loading' },
  { name: 'offline', label: '연결실패', expect: 'error' },
  { name: 'server500', label: '서버오류', expect: 'error' },
];
const REPORT_AFTER = 3000; // 페이지를 열고 이만큼(밀리초) 기다린 뒤 결과를 모아요

// 앱 스크립트보다 먼저 실행돼서, 오류를 기록하고 fetch 를 경우에 맞게 바꿔요.
function hookScript(mode) {
  return `(function () {
  const R = window.__check = { errors: [] };
  addEventListener('error', e => { if (!e.target || e.target === window) R.errors.push(e.message); }, true);
  addEventListener('unhandledrejection', e => R.errors.push(String(e.reason && e.reason.message || e.reason)));
  const mode = ${JSON.stringify(mode)};
  const realFetch = window.fetch.bind(window);
  window.fetch = function (url, opts) {
    if (mode === 'loading') return new Promise(() => {});
    if (mode === 'offline') return Promise.reject(new TypeError('Failed to fetch'));
    if (mode === 'server500') return Promise.resolve(new Response('error', { status: 500 }));
    return realFetch(url, opts);
  };
})();`;
}

// 결과를 모으는 코드 (페이지 안에서 실행)
const REPORT_JS = `(() => {
  const vis = id => { const el = document.getElementById(id); return !!el && !el.hidden && el.offsetParent !== null; };
  const text = id => { const el = document.getElementById(id); return el ? el.innerText.trim().replace(/\\s+/g, ' ') : ''; };
  const W = document.documentElement.clientWidth;
  const outside = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.offsetParent === null || el.tagName === 'SCRIPT') continue;
    const r = el.getBoundingClientRect();
    if (r.width && (r.left < -1 || r.right > W + 1))
      outside.push(el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + ' ' + Math.round(r.left) + '~' + Math.round(r.right));
  }
  return JSON.stringify({
    errors: (window.__check || { errors: [] }).errors,
    shown: ['loading', 'error', 'weather'].filter(vis),
    texts: { loading: text('loading'), error: text('error-text'), temp: text('temp'), desc: text('desc'), max: text('max'), min: text('min'), time: text('time') },
    width: W,
    scrollWidth: document.documentElement.scrollWidth,
    outside: outside.slice(0, 5),
  });
})()`;

function pathToFileUrl(p) {
  return 'file:///' + path.resolve(p).replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/').replace('%3A', ':');
}

const wait = ms => new Promise(r => setTimeout(r, ms));

// Chrome 을 켜고 DevTools 연결 주소를 알아내요.
async function startBrowser(browser) {
  const portFile = path.join(PROFILE_DIR, 'DevToolsActivePort');
  try { fs.unlinkSync(portFile); } catch (e) {}
  const proc = spawn(browser, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--hide-scrollbars',
    '--disable-quic', // 이 컴퓨터에서는 QUIC(HTTP/3) 연결이 날씨 서버에서 멈춰서 꺼요
    '--remote-debugging-port=0',
    `--user-data-dir=${PROFILE_DIR}`,
    'about:blank',
  ], { stdio: 'ignore' });
  for (let i = 0; i < 100; i++) {
    if (fs.existsSync(portFile)) {
      const [port, wsPath] = fs.readFileSync(portFile, 'utf8').trim().split('\n');
      if (wsPath) return { proc, url: `ws://127.0.0.1:${port}${wsPath}` };
    }
    await wait(100);
  }
  proc.kill();
  throw new Error('Chrome 이 DevTools 연결을 열지 않았어요.');
}

// DevTools 에 명령을 보내고 답을 받는 작은 도우미
function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 0;
    const pending = new Map();
    ws.onmessage = ev => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { ok, fail } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? fail(new Error(msg.error.message)) : ok(msg.result);
      }
    };
    ws.onerror = () => reject(new Error('DevTools 에 연결하지 못했어요.'));
    ws.onopen = () => resolve({
      send(method, params = {}, sessionId) {
        return new Promise((ok, fail) => {
          const n = ++id;
          pending.set(n, { ok, fail });
          ws.send(JSON.stringify({ id: n, method, params, sessionId }));
        });
      },
      close() { ws.close(); },
    });
  });
}

// 한 경우·한 크기로 앱을 열어서 결과와 (원하면) 사진을 얻어요.
async function visit(cdp, pageUrl, mode, size, shotFile) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const s = (m, p) => cdp.send(m, p, sessionId);
  try {
    await s('Page.enable');
    await s('Emulation.setDeviceMetricsOverride', {
      width: size.w, height: size.h, deviceScaleFactor: 1, mobile: size.mobile,
    });
    await s('Page.addScriptToEvaluateOnNewDocument', { source: hookScript(mode) });
    await s('Page.navigate', { url: pageUrl });
    await wait(REPORT_AFTER);
    const { result } = await s('Runtime.evaluate', { expression: REPORT_JS, returnByValue: true });
    const rep = JSON.parse(result.value);
    if (shotFile) {
      const { data } = await s('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(shotFile, Buffer.from(data, 'base64'));
    }
    return rep;
  } catch (e) {
    return null;
  } finally {
    await cdp.send('Target.closeTarget', { targetId }).catch(() => {});
  }
}

const SCREEN_NAME = { loading: '불러오는 중', error: '못 받아 옴', weather: '날씨' };

async function main() {
  const appDir = WEEK_DIR;
  const appFile = path.join(appDir, 'index.html');
  if (!fs.existsSync(appFile)) {
    console.log(`index.html 이 없어요: ${appDir}`);
    process.exit(1);
  }
  const browser = BROWSERS.find(b => fs.existsSync(b));
  if (!browser) {
    console.log('Chrome 이나 Edge 를 찾지 못했어요.');
    process.exit(1);
  }
  if (typeof WebSocket === 'undefined') {
    console.log('이 Node.js 에는 WebSocket 이 없어요. Node.js 22 이상이 필요해요.');
    process.exit(1);
  }
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
  fs.mkdirSync(PROFILE_DIR, { recursive: true });

  const { proc, url } = await startBrowser(browser);
  const cdp = await connect(url);
  const pageUrl = pathToFileUrl(appFile);

  const ok = [];
  const bad = [];
  const shots = [];
  const errors = new Set();

  try {
    for (const mode of MODES) {
      const results = [];
      for (const size of SIZES) {
        // 진짜 경우는 모든 크기로, 나머지는 작은 폰 크기로만 사진을 찍어요.
        const shotFile = (mode.name === 'real' || size === SIZES[0])
          ? path.join(SHOTS_DIR, `my-app-${mode.name}-${size.name}-${size.w}x${size.h}.png`) : null;
        const rep = await visit(cdp, pageUrl, mode.name, size, shotFile);
        if (rep && shotFile) shots.push(shotFile);
        results.push({ size, rep });
      }

      // 화면이 맞게 나왔는지
      const wrong = results.filter(r => !r.rep || r.rep.shown.length !== 1 || r.rep.shown[0] !== mode.expect);
      const first = results.find(r => r.rep);
      if (wrong.length) {
        bad.push(`[${mode.label}] ${SCREEN_NAME[mode.expect]} 화면이어야 하는데 다르게 나옴: `
          + wrong.map(r => `${r.size.w}×${r.size.h} → ${r.rep ? (r.rep.shown.map(x => SCREEN_NAME[x]).join('+') || '아무것도 안 보임') : '결과 못 읽음'}`).join(', '));
      } else {
        const t = first.rep.texts;
        const what = mode.expect === 'weather' ? `기온 ${t.temp} · ${t.desc} · 최고 ${t.max} · 최저 ${t.min} · ${t.time}`
          : mode.expect === 'loading' ? `"${t.loading}"`
          : `"${t.error}"`;
        ok.push(`[${mode.label}] 화면 크기 4가지 모두 ${SCREEN_NAME[mode.expect]} 화면: ${what}`);
        if (mode.expect === 'weather' && /알 수 없는 날씨/.test(t.desc)) bad.push(`[${mode.label}] 날씨 번호를 낱말로 못 바꿈: ${t.desc}`);
      }

      // 옆으로 넘치는지 (흉내 낸 폭이 맞게 들어갔는지도 함께 봐요)
      for (const r of results) {
        if (!r.rep) continue;
        if (r.rep.width !== r.size.w)
          bad.push(`[${mode.label}] ${r.size.w}×${r.size.h} 를 흉내 냈는데 실제 폭이 ${r.rep.width} 이라 확인이 믿을 만하지 않아요`);
        if (r.rep.scrollWidth > r.rep.width || r.rep.outside.length)
          bad.push(`[${mode.label}] ${r.size.w}×${r.size.h} 에서 옆으로 넘침 (폭 ${r.rep.width}, 내용 ${r.rep.scrollWidth}) ${r.rep.outside.join(', ')}`);
        for (const e of r.rep.errors) errors.add(e);
      }
    }
  } finally {
    cdp.close();
    proc.kill();
  }

  if (!bad.some(b => b.includes('넘침') || b.includes('흉내'))) {
    ok.push('옆으로 잘리거나 넘치는 것: 없음 (' + SIZES.map(s => `${s.w}×${s.h}`).join(', ') + ', 경우 4가지 모두)');
  }
  if (errors.size) bad.push('자바스크립트 오류: ' + [...errors].join(' / '));
  else ok.push('자바스크립트 오류: 없음');
  ok.push(`화면 사진 ${shots.length}장 찍음:`);

  const unchecked = [
    '진짜 폰에서 열었을 때 (여기서는 Chrome 의 기기 흉내로 폰 폭만 맞춰 봤어요)',
    '"다시 불러오기" 단추를 사람이 눌렀을 때',
    '10초 동안 답이 없을 때 나오는 안내 (시험에서는 3초까지만 봤어요)',
    '받아 온 날씨가 진짜 바깥 날씨와 맞는지',
  ];

  console.log(`\n=== 확인 결과: 내 앱 (${path.relative(ROOT_DIR, appFile)}) ===`);
  console.log(`브라우저: ${path.basename(browser)}`);
  console.log('\n[확인한 것]');
  for (const line of ok) console.log('- ' + line);
  for (const s of shots) console.log('    ' + path.relative(ROOT_DIR, s));
  if (bad.length) {
    console.log('\n[문제]');
    for (const line of bad) console.log('- ' + line);
  }
  console.log('\n[확인하지 못한 것]');
  for (const line of unchecked) console.log('- ' + line);
  console.log('');
  process.exit(bad.length ? 1 : 0);
}

main().catch(e => { console.log('확인 도구가 멈췄어요: ' + e.message); process.exit(1); });
