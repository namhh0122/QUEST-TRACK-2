// week-06 앱 확인 도구 (week-05 게임 확인 도구를 날씨 앱에 맞게 고침)
//
// 쓰는 법 (QUEST-TRACK-2 폴더에서):
//   node week-06/check/check.js          → 내 앱 (week-06/index.html) 확인
//
// 하는 일:
//   1. 파일을 두 번 누른 것처럼(file://) 앱을 열고, 다섯 가지 경우를 만들어 화면을 봐요.
//        진짜          : 진짜 Open-Meteo 에서 날씨를 받아 와요
//        불러오는중     : 답이 오지 않는 것처럼 꾸며요
//        연결실패       : 인터넷이 끊긴 것처럼 꾸며요 (저장된 날씨 없음)
//        서버오류       : 서버가 500 오류를 돌려준 것처럼 꾸며요 (저장된 날씨 없음)
//        끊김+저장됨    : 인터넷이 끊겼고, 25분 전에 받은 날씨가 저장돼 있는 것처럼 꾸며요
//   2. 폰·태블릿·컴퓨터 화면 폭을 흉내 내서, 옆으로 잘리거나 넘치는 것이 있는지 봐요.
//      (화면 없는 Chrome 은 창을 500px 보다 좁게 만들지 못해서, Chrome 의 '기기 흉내' 기능으로 폭을 맞춰요.)
//   3. 폰 설치(PWA) 시험: GitHub Pages 와 같은 주소 모양(/QUEST-TRACK-2/week-06/)으로
//      내 컴퓨터에 잠깐 서버를 띄워서, manifest·아이콘·서비스 워커·설치 가능 여부를 봐요.
//      그다음 서버를 끄고 인터넷도 끊어서, 앱이 열리고 마지막 날씨가 받은 때와 함께 나오는지 봐요.
//   4. 화면 사진을 찍어서 check/shots 에 저장해요.
//
// check/shots(사진)와 check/tmp(브라우저 임시 폴더)는 커밋하지 않아요 (.gitignore).
// 새로 설치할 것은 없어요. Node.js(22 이상)와 이미 있는 Chrome/Edge 만 써요.

const fs = require('fs');
const path = require('path');
const http = require('http');
const { launch, openTab, evaluate, wait, pathToFileUrl } = require('./browser');

const CHECK_DIR = __dirname;
const WEEK_DIR = path.dirname(CHECK_DIR);
const ROOT_DIR = path.dirname(WEEK_DIR);
const SHOTS_DIR = path.join(CHECK_DIR, 'shots');
const REPO = path.basename(ROOT_DIR); // GitHub Pages 주소의 저장소 이름 (QUEST-TRACK-2)
const SAVE_KEY = 'week06-weather-last';

// 확인할 화면 크기 (mobile: 폰처럼 흉내 냄)
const SIZES = [
  { name: 'phone-small', w: 360, h: 740, mobile: true },   // 작은 폰
  { name: 'phone', w: 390, h: 844, mobile: true },         // 보통 폰
  { name: 'tablet', w: 768, h: 1024, mobile: true },       // 태블릿
  { name: 'desktop', w: 1280, h: 720, mobile: false },     // 컴퓨터
];

// 꾸며 볼 경우들. expect 는 그때 보여야 하는 화면, notice 는 '마지막 날씨' 안내가 보여야 하는지예요.
const MODES = [
  { name: 'real', label: '진짜', expect: 'weather', notice: false },
  { name: 'loading', label: '불러오는중', expect: 'loading', notice: false },
  { name: 'offline', label: '연결실패', expect: 'error', notice: false },
  { name: 'server500', label: '서버오류', expect: 'error', notice: false },
  { name: 'offline-saved', label: '끊김+저장됨', expect: 'weather', notice: true },
];
const REPORT_AFTER = 3000; // 페이지를 열고 이만큼(밀리초) 기다린 뒤 결과를 모아요

// 앱 스크립트보다 먼저 실행돼서, 오류를 기록하고 경우에 맞게 꾸며요.
function hookScript(mode) {
  return `(function () {
  const R = window.__check = { errors: [] };
  addEventListener('error', e => { if (!e.target || e.target === window) R.errors.push(e.message); }, true);
  addEventListener('unhandledrejection', e => R.errors.push(String(e.reason && e.reason.message || e.reason)));
  const mode = ${JSON.stringify(mode)};
  if (mode === 'none') return; // 꾸미지 않고 오류만 기록
  // 저장된 날씨: 끊김+저장됨 경우에만 25분 전 날씨를 넣어 두고, 나머지는 지워요.
  try {
    if (mode === 'offline-saved') localStorage.setItem(${JSON.stringify(SAVE_KEY)}, JSON.stringify({
      temp: 12.4, code: 3, max: 15.1, min: 6.8, time: '2026-01-01T09:00', savedAt: Date.now() - 25 * 60000 }));
    else localStorage.removeItem(${JSON.stringify(SAVE_KEY)});
  } catch (e) {}
  if (mode === 'offline-saved') Object.defineProperty(navigator, 'onLine', { get: () => false });
  const realFetch = window.fetch.bind(window);
  window.fetch = function (url, opts) {
    if (mode === 'loading') return new Promise(() => {});
    if (mode === 'offline' || mode === 'offline-saved') return Promise.reject(new TypeError('Failed to fetch'));
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
  let saved = null;
  try { saved = localStorage.getItem(${JSON.stringify(SAVE_KEY)}); } catch (e) {}
  return {
    errors: (window.__check || { errors: [] }).errors,
    shown: ['loading', 'error', 'weather'].filter(vis),
    notice: vis('notice') ? text('notice-title') + ' ' + text('notice-text') : null,
    texts: { loading: text('loading'), error: text('error-text'), temp: text('temp'), desc: text('desc'), max: text('max'), min: text('min'), time: text('time') },
    saved: !!saved,
    width: W,
    scrollWidth: document.documentElement.scrollWidth,
    outside: outside.slice(0, 5),
  };
})()`;

const SCREEN_NAME = { loading: '불러오는 중', error: '못 받아 옴', weather: '날씨' };

async function shoot(tab, file, shots) {
  const { data } = await tab.s('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
  shots.push(file);
}

// 한 경우·한 크기로 앱을 열어서 결과와 (원하면) 사진을 얻어요.
async function visit(cdp, pageUrl, mode, size, shotFile, shots) {
  const tab = await openTab(cdp);
  try {
    await tab.s('Page.enable');
    await tab.s('Emulation.setDeviceMetricsOverride', { width: size.w, height: size.h, deviceScaleFactor: 1, mobile: size.mobile });
    await tab.s('Page.addScriptToEvaluateOnNewDocument', { source: hookScript(mode) });
    await tab.s('Page.navigate', { url: pageUrl });
    await wait(REPORT_AFTER);
    const rep = await evaluate(tab, REPORT_JS);
    if (shotFile) await shoot(tab, shotFile, shots);
    return rep;
  } catch (e) {
    return null;
  } finally {
    await tab.close();
  }
}

// GitHub Pages 처럼 /QUEST-TRACK-2/... 주소로 이 폴더의 파일을 내 주는 작은 서버
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png',
};
function startServer() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (!p.startsWith(`/${REPO}/`)) { res.writeHead(404); return res.end('not found'); }
    p = p.slice(REPO.length + 2);
    if (p === '' || p.endsWith('/')) p += 'index.html';
    const file = path.resolve(ROOT_DIR, p);
    if (!file.startsWith(ROOT_DIR + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) { res.writeHead(301, { Location: req.url + '/' }); return res.end(); }
      res.writeHead(404); return res.end('not found');
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r(server)));
}

// 폰 설치(PWA)와 인터넷이 끊겼을 때를 시험해요.
async function pwaTest(cdp, ok, bad, shots, errors) {
  const server = await startServer();
  const base = `http://localhost:${server.address().port}/${REPO}/week-06/`;
  const size = SIZES[1];
  const tab = await openTab(cdp);
  try {
    await tab.s('Page.enable');
    await tab.s('Emulation.setDeviceMetricsOverride', { width: size.w, height: size.h, deviceScaleFactor: 1, mobile: true });
    await tab.s('Page.addScriptToEvaluateOnNewDocument', { source: hookScript('none') });
    await tab.s('Page.navigate', { url: base });
    await wait(REPORT_AFTER);

    // manifest
    const man = await tab.s('Page.getAppManifest');
    let manifest = null;
    try { manifest = JSON.parse(man.data); } catch (e) {}
    if (!man.url) bad.push('[설치] index.html 에서 manifest 를 찾지 못함');
    else if (man.errors && man.errors.length) bad.push('[설치] manifest 오류: ' + man.errors.map(e => e.message).join(' / '));
    else if (manifest) ok.push(`[설치] manifest 읽음: 이름 "${manifest.name}", 짧은 이름 "${manifest.short_name}", 시작 주소 "${manifest.start_url}", ${manifest.display}`);

    // 아이콘
    if (manifest && manifest.icons) {
      const res = await evaluate(tab, `Promise.all(${JSON.stringify(manifest.icons)}.map(async i => {
        try {
          const r = await fetch(new URL(i.src, ${JSON.stringify(new URL('manifest.webmanifest', base).href)}));
          const b = await createImageBitmap(await r.blob());
          return { src: i.src, sizes: i.sizes, purpose: i.purpose || 'any', real: b.width + 'x' + b.height, status: r.status };
        } catch (e) { return { src: i.src, sizes: i.sizes, error: String(e) }; }
      }))`);
      const badIcons = res.filter(i => i.error || i.status !== 200 || i.real !== i.sizes);
      if (badIcons.length) bad.push('[설치] 아이콘 문제: ' + badIcons.map(i => `${i.src} (${i.error || (i.status + ', 실제 ' + i.real + ' / 적힌 ' + i.sizes)})`).join(', '));
      else ok.push('[설치] 아이콘 ' + res.length + '개 모두 불러옴, 적힌 크기와 같음: ' + res.map(i => `${i.src} ${i.real} ${i.purpose}`).join(', '));
    }

    // 서비스 워커
    const sw = await evaluate(tab, `Promise.race([
      navigator.serviceWorker.ready.then(async r => ({ state: r.active && r.active.state, scope: r.scope,
        controlled: !!navigator.serviceWorker.controller,
        cached: (await Promise.all((await caches.keys()).map(async k => (await (await caches.open(k)).keys()).length))).reduce((a, b) => a + b, 0) })),
      new Promise(r => setTimeout(() => r(null), 5000)),
    ])`);
    if (!sw) bad.push('[설치] 서비스 워커가 5초 안에 준비되지 않음');
    else ok.push(`[설치] 서비스 워커 ${sw.state}, 범위 ${sw.scope.replace(/^http:\/\/localhost:\d+/, '')}, 저장한 파일 ${sw.cached}개`);

    // 설치할 수 있는지 (Chrome 이 판단)
    try {
      const { installabilityErrors } = await tab.s('Page.getInstallabilityErrors');
      if (installabilityErrors.length) bad.push('[설치] Chrome 이 설치할 수 없다고 함: ' + installabilityErrors.map(e => e.errorId).join(', '));
      else ok.push('[설치] Chrome 이 설치할 수 있는 앱이라고 판단함 (설치 막는 문제 없음)');
    } catch (e) {
      bad.push('[설치] 설치 가능 여부를 묻지 못함: ' + e.message);
    }

    const online = await evaluate(tab, REPORT_JS);
    online.errors.forEach(e => errors.add(e));
    if (online.shown[0] === 'weather' && online.saved) ok.push(`[설치] 서버 주소로 열었을 때 날씨 나옴 (${online.texts.temp} · ${online.texts.desc}), 마지막 날씨를 저장함`);
    else bad.push('[설치] 서버 주소로 열었을 때 날씨가 나오지 않거나 저장되지 않음: ' + JSON.stringify(online.shown));
    await shoot(tab, path.join(SHOTS_DIR, `my-app-pwa-online-${size.name}-${size.w}x${size.h}.png`), shots);

    // 인터넷 끊기: 서버를 끄고, 브라우저도 오프라인으로 만든 뒤 다시 열어요.
    server.close();
    server.closeAllConnections();
    await tab.s('Network.enable');
    await tab.s('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await tab.s('Page.reload');
    await wait(REPORT_AFTER);
    const off = await evaluate(tab, REPORT_JS);
    off.errors.forEach(e => errors.add(e));
    if (off.shown[0] === 'weather' && off.notice && off.notice.includes('받은 때'))
      ok.push(`[끊김] 서버도 인터넷도 끊긴 채 다시 열어도 앱이 열리고, 마지막 날씨를 보여 줌: ${off.texts.temp} · ${off.texts.desc} / "${off.notice}"`);
    else bad.push('[끊김] 끊긴 채 다시 열었을 때 마지막 날씨가 나오지 않음: ' + JSON.stringify({ shown: off.shown, notice: off.notice, error: off.texts.error }));
    await shoot(tab, path.join(SHOTS_DIR, `my-app-pwa-offline-${size.name}-${size.w}x${size.h}.png`), shots);
  } finally {
    await tab.close();
    server.close();
  }
}

async function main() {
  const appFile = path.join(WEEK_DIR, 'index.html');
  if (!fs.existsSync(appFile)) {
    console.log(`index.html 이 없어요: ${WEEK_DIR}`);
    process.exit(1);
  }
  fs.mkdirSync(SHOTS_DIR, { recursive: true });

  const { cdp, browser, close } = await launch();
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
        results.push({ size, rep: await visit(cdp, pageUrl, mode.name, size, shotFile, shots) });
      }

      // 화면이 맞게 나왔는지
      const wrong = results.filter(r => !r.rep || r.rep.shown.length !== 1 || r.rep.shown[0] !== mode.expect || !!r.rep.notice !== mode.notice);
      const first = results.find(r => r.rep);
      if (wrong.length) {
        bad.push(`[${mode.label}] ${SCREEN_NAME[mode.expect]} 화면${mode.notice ? '+마지막 날씨 안내' : ''}여야 하는데 다르게 나옴: `
          + wrong.map(r => `${r.size.w}×${r.size.h} → ${r.rep ? ((r.rep.shown.map(x => SCREEN_NAME[x]).join('+') || '아무것도 안 보임') + (r.rep.notice ? '+안내' : '')) : '결과 못 읽음'}`).join(', '));
      } else {
        const t = first.rep.texts;
        const what = mode.notice ? `${t.temp} · ${t.desc} / "${first.rep.notice}"`
          : mode.expect === 'weather' ? `기온 ${t.temp} · ${t.desc} · 최고 ${t.max} · 최저 ${t.min} · ${t.time}`
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

    await pwaTest(cdp, ok, bad, shots, errors);
  } finally {
    close();
  }

  if (!bad.some(b => b.includes('넘침') || b.includes('흉내')))
    ok.push('옆으로 잘리거나 넘치는 것: 없음 (' + SIZES.map(s => `${s.w}×${s.h}`).join(', ') + `, 경우 ${MODES.length}가지 모두)`);
  if (errors.size) bad.push('자바스크립트 오류: ' + [...errors].join(' / '));
  else ok.push('자바스크립트 오류: 없음');
  ok.push(`화면 사진 ${shots.length}장 찍음:`);

  const unchecked = [
    `진짜 GitHub Pages 주소(https://...github.io/${REPO}/week-06/)에서 돌아가는지 (올리기 전이라 내 컴퓨터 서버에서 같은 주소 모양으로만 봤어요)`,
    '진짜 폰에 설치해 보기 (홈 화면 아이콘 모양, 앱처럼 열리는지)',
    '"다시 불러오기" 단추를 사람이 눌렀을 때, 인터넷이 다시 연결되면 저절로 새 날씨를 받는지',
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
