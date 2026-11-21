// week-07 작품(플레이리스트 사이트) 확인 도구. week-06 앱 확인 도구를 이 작품에 맞게 고침.
//
// 쓰는 법 (QUEST-TRACK-2 폴더에서):
//   node week-07/check/check.js
//
// 하는 일 (파일을 두 번 누른 것처럼 file:// 로 열어서 사람이 하는 것을 따라 해요):
//   1. 처음 열기      : 예시 2개가 보이고, 다른 사람 것에는 고치기·지우기가 없는지, 로그인 자리가 빈 칸인지
//   2. 만들기·고치기   : 만들기, 곡 넣고 빼기, 별점, 이름 바꾸기, 지우기(되묻기 포함), 빈칸 안내
//   3. 남기기         : 새로 열어도 그대로인지
//   4. 남이 만든 것    : 내 표시가 달라지면(다른 기기처럼) 내 것도 보기만 되는지 (내 아이디어)
//   4-2. 재생      : 재생·멈춤·이어 듣기·다음 곡·이전 곡, 저절로 다음 곡, 목록을 바꾸면 앞 목록이 멈추는지
//   5. 저장이 막힐 때  : 브라우저가 저장을 막아도 멈추지 않고 안내하는지
//   6. 화면 크기      : 폰·태블릿·컴퓨터 폭에서 옆으로 잘리거나 넘치는 것이 있는지 (긴 글자 포함), 사진 찍기
//
// check/shots(사진)와 check/tmp(브라우저 임시 폴더)는 커밋하지 않아요 (.gitignore).
// 새로 설치할 것은 없어요. Node.js(22 이상)와 이미 있는 Chrome/Edge 만 써요.

const fs = require('fs');
const path = require('path');
const { launch, openTab, evaluate, wait, pathToFileUrl } = require('./browser');

const CHECK_DIR = __dirname;
const WEEK_DIR = path.dirname(CHECK_DIR);
const ROOT_DIR = path.dirname(WEEK_DIR);
const SHOTS_DIR = path.join(CHECK_DIR, 'shots');
const SAVE_KEY = 'week07-music';

const SIZES = [
  { name: 'phone-small', w: 360, h: 740, mobile: true },
  { name: 'phone', w: 390, h: 844, mobile: true },
  { name: 'tablet', w: 768, h: 1024, mobile: true },
  { name: 'desktop', w: 1280, h: 720, mobile: false },
];

// 앱보다 먼저 실행돼요. mode: fresh(저장 지우고 시작) / keep(그대로) / blocked(저장 막힘) / long(긴 글자로 가득)
function hookScript(mode) {
  return `(function () {
  const R = window.__check = { errors: [] };
  addEventListener('error', e => { if (!e.target || e.target === window) R.errors.push(e.message); }, true);
  addEventListener('unhandledrejection', e => R.errors.push(String(e.reason && e.reason.message || e.reason)));
  const mode = ${JSON.stringify(mode)};
  if (mode === 'blocked') {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('막힘', 'SecurityError'); } });
    return;
  }
  try {
    if (!sessionStorage.getItem('__started')) {
      sessionStorage.setItem('__started', '1');
      localStorage.clear();
      if (mode === 'long') {
        const A = 'ㄱ'.repeat(40), N = 'ㄴ'.repeat(20), T = 'ㅌ'.repeat(60), S = 'ㅅ'.repeat(40);
        localStorage.setItem(${JSON.stringify(SAVE_KEY)}, JSON.stringify({ myId: 'me', nick: N, playlists: [
          { id: 'long-1', owner: 'me', maker: N, name: A, songs: [{ t: T, a: S }, { t: 'abc', a: 'def' }], ratings: { me: 3, x: 5 } },
          { id: 'long-2', owner: 'other', maker: N, name: A, songs: [{ t: T, a: S }], ratings: {} },
          { id: 'sample-1', owner: 'sample-a', maker: '구름이', name: '비 오는 날 듣는 노래',
            songs: [{ t: '빗소리 산책', a: '달빛 밴드' }], ratings: { x1: 5 } },
        ] }));
      }
    }
  } catch (e) {}
})();`;
}

// 화면 상태를 모으는 코드 (페이지 안에서 실행)
const REPORT_JS = `(() => {
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)].filter(el => el.offsetParent !== null);
  const W = document.documentElement.clientWidth;
  const outside = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.offsetParent === null || el.tagName === 'SCRIPT') continue;
    const r = el.getBoundingClientRect();
    if (r.width && (r.left < -1 || r.right > W + 1))
      outside.push(el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + '.' + el.className + ' ' + Math.round(r.left) + '~' + Math.round(r.right));
  }
  const cards = $$('.card').map(c => ({
    id: c.dataset.id, mine: c.dataset.mine === 'true',
    name: c.querySelector('h2').innerText, maker: c.querySelector('.maker strong').innerText,
    avg: c.querySelector('.avg').innerText,
    stars: $$('button.star.on', c).length,
    songs: $$('.song', c).map(li => li.innerText.replace(/\\s+/g, ' ').replace(/ ?빼기$/, '')),
    removeBtns: $$('.remove-song', c).length,
    addForm: $$('form.add-song', c).length, renameForm: $$('form.rename', c).length,
    deleteBtn: $$('button.delete', c).length, note: $$('.no-edit-note', c).length,
    confirm: $$('.confirm-delete', c).length, badge: c.querySelector('.badge').innerText,
    players: $$('.player', c).length,
    playLabel: (c.querySelector('[data-role=play]') || {}).innerText || null,
    prevOff: c.querySelector('[data-role=prev]') ? c.querySelector('[data-role=prev]').disabled : null,
    nextOff: c.querySelector('[data-role=next]') ? c.querySelector('[data-role=next]').disabled : null,
    nowText: c.querySelector('.now-text') ? c.querySelector('.now-text').innerText : null,
    nowSongs: $$('li.now', c).map(li => li.innerText.replace(/s+/g, ' ').replace(/ ?빼기$/, '')),
  }));
  const notice = document.getElementById('notice');
  const slot = document.getElementById('login-slot');
  return {
    errors: (window.__check || { errors: [] }).errors,
    cards,
    empty: !document.getElementById('empty').hidden,
    notice: notice && !notice.hidden ? notice.innerText : null,
    slotText: slot ? slot.innerText.trim() : null,
    slotControls: slot ? slot.querySelectorAll('button, a, input').length : -1,
    createMsg: document.getElementById('create-msg').innerText,
    width: W, scrollWidth: document.documentElement.scrollWidth,
    outside: outside.slice(0, 5),
    saved: (() => { try { return JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)})); } catch (e) { return null; } })(),
  };
})()`;

async function shoot(tab, file, shots) {
  const { data } = await tab.s('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
  shots.push(file);
}

async function openApp(cdp, pageUrl, mode, size) {
  const tab = await openTab(cdp);
  await tab.s('Page.enable');
  await tab.s('Emulation.setDeviceMetricsOverride', { width: size.w, height: size.h, deviceScaleFactor: 1, mobile: size.mobile });
  await tab.s('Page.addScriptToEvaluateOnNewDocument', { source: hookScript(mode) });
  await tab.s('Page.navigate', { url: pageUrl });
  await wait(800);
  return tab;
}

const report = tab => evaluate(tab, REPORT_JS);
const act = async (tab, js) => { const v = await evaluate(tab, js); await wait(150); return v; };
const mineCard = `document.querySelector('.card[data-mine="true"]')`;
const sampleCard = `document.querySelector('.card[data-id="sample-1"]')`;
const fillSubmit = (formExpr, values) => `(() => { const f = ${formExpr}; if (!f) return 'form 없음';
  ${Object.entries(values).map(([k, v]) => `f.elements[${JSON.stringify(k)}].value = ${JSON.stringify(v)};`).join(' ')}
  f.requestSubmit(); return 'ok'; })()`;

async function main() {
  const appFile = path.join(WEEK_DIR, 'index.html');
  if (!fs.existsSync(appFile)) { console.log(`index.html 이 없어요: ${WEEK_DIR}`); process.exit(1); }
  fs.mkdirSync(SHOTS_DIR, { recursive: true });

  const { cdp, browser, close } = await launch();
  const pageUrl = pathToFileUrl(appFile);
  const ok = [], bad = [], shots = [], errors = new Set();
  const check = (cond, good, wrong) => (cond ? ok : bad).push(cond ? good : wrong);
  const collect = rep => rep.errors.forEach(e => errors.add(e));

  try {
    // 1~4. 하나의 탭에서 사람처럼 차례로 해 봐요
    const size = SIZES[1];
    const tab = await openApp(cdp, pageUrl, 'fresh', size);
    try {
      let r = await report(tab); collect(r);

      // 1. 처음 열기
      check(r.cards.length === 2 && r.cards.every(c => !c.mine),
        `[처음] 예시 플레이리스트 ${r.cards.length}개 (${r.cards.map(c => `"${c.name}" by ${c.maker}`).join(', ')}), 내 것은 아직 없음`,
        `[처음] 예시 2개가 보여야 하는데 ${JSON.stringify(r.cards.map(c => c.name))}`);
      check(r.cards.every(c => c.songs.length >= 1 && c.avg.includes('점')),
        `[처음] 예시마다 곡과 별점이 보임 (${r.cards.map(c => c.avg).join(' / ')}), 첫 곡: "${r.cards[0] && r.cards[0].songs[0]}"`,
        '[처음] 예시에 곡이나 별점이 안 보임');
      check(r.cards.every(c => !c.addForm && !c.renameForm && !c.deleteBtn && !c.removeBtns && c.note === 1),
        '[남이 만든 것] 예시(다른 사람 것)에는 곡 넣기·빼기·이름 바꾸기·지우기가 없고 "볼 수만 있어요" 안내만 있음',
        '[남이 만든 것] 다른 사람 것에 고치기·지우기 단추가 보임');
      check(r.slotText === '로그인 자리' && r.slotControls === 0,
        '[로그인 자리] 화면 위쪽에 "로그인 자리"라고만 적힌 빈 칸이 있고, 누를 단추나 입력칸은 없음',
        `[로그인 자리] 문구/내용이 다름: "${r.slotText}", 단추 ${r.slotControls}개`);

      // 2. 만들기
      await act(tab, `document.getElementById('create-form').requestSubmit()`);
      r = await report(tab);
      check(r.cards.length === 2 && /이름/.test(r.createMsg),
        `[만들기] 이름 없이 만들면 안내가 나오고 안 만들어짐: "${r.createMsg}"`, `[만들기] 이름 없이 눌렀을 때 안내/동작이 이상함: "${r.createMsg}", 카드 ${r.cards.length}개`);
      await act(tab, `document.getElementById('new-name').value='산책할 때'; document.getElementById('new-nick').value=''; document.getElementById('create-form').requestSubmit();`);
      r = await report(tab);
      check(r.cards.length === 2 && /별명/.test(r.createMsg),
        `[만들기] 별명 없이 만들면 안내: "${r.createMsg}"`, `[만들기] 별명 없이 눌렀을 때 안내/동작이 이상함: "${r.createMsg}"`);
      await act(tab, `document.getElementById('new-nick').value='  테스트  별명 '; document.getElementById('create-form').requestSubmit();`);
      r = await report(tab); collect(r);
      const mine = r.cards.find(c => c.mine);
      check(mine && r.cards[0].mine && mine.name === '산책할 때' && mine.maker === '테스트 별명' && /아직 별점이 없어요/.test(mine.avg),
        `[만들기] 새 플레이리스트가 맨 위에 생김: "${mine && mine.name}" by ${mine && mine.maker} (공백 정리됨), "${mine && mine.avg}"`,
        `[만들기] 새 플레이리스트가 이상함: ${JSON.stringify(mine)}`);
      check(mine && mine.addForm === 1 && mine.renameForm === 1 && mine.deleteBtn === 1 && mine.badge === '내가 만든 것',
        '[내 것] 내가 만든 것에는 곡 넣기·이름 바꾸기·지우기가 있음', '[내 것] 내 것의 고치기 도구가 빠짐');

      // 곡 넣기·빼기
      await act(tab, fillSubmit(`${mineCard}.querySelector('form.add-song')`, { title: '', artist: '가수' }));
      r = await report(tab);
      check(r.cards.find(c => c.mine).songs.length === 0, '[곡] 곡 이름이 비면 안 들어감 (안내 나옴)', '[곡] 곡 이름이 빈 채로 들어감');
      await act(tab, fillSubmit(`${mineCard}.querySelector('form.add-song')`, { title: '첫 곡', artist: '가수 하나' }));
      await act(tab, fillSubmit(`${mineCard}.querySelector('form.add-song')`, { title: '둘째 곡', artist: '가수 둘' }));
      r = await report(tab); collect(r);
      let m = r.cards.find(c => c.mine);
      check(m.songs.length === 2 && m.songs[0].includes('첫 곡') && m.songs[1].includes('둘째 곡') && m.removeBtns === 2,
        `[곡] 곡 2개 들어감: ${m.songs.join(' / ')}`, `[곡] 곡 넣기가 이상함: ${JSON.stringify(m.songs)}`);
      await act(tab, `${mineCard}.querySelector('.remove-song').click()`);
      r = await report(tab);
      m = r.cards.find(c => c.mine);
      check(m.songs.length === 1 && m.songs[0].includes('둘째 곡'), '[곡] 첫 곡을 빼면 둘째 곡만 남음', `[곡] 빼기가 이상함: ${JSON.stringify(m.songs)}`);

      // 별점
      await act(tab, `${mineCard}.querySelector('button.star[data-n="4"]').click()`);
      await act(tab, `${sampleCard}.querySelector('button.star[data-n="5"]').click()`);
      r = await report(tab); collect(r);
      m = r.cards.find(c => c.mine);
      const s1 = r.cards.find(c => c.id === 'sample-1');
      check(m.avg.startsWith('4.0점 (1명)') && m.stars === 4, `[별점] 내 것에 별 4개 → "${m.avg}", 켜진 별 ${m.stars}개`, `[별점] 내 것 별점이 이상함: "${m.avg}", ${m.stars}개`);
      check(s1.avg.startsWith('4.5점 (4명)') && s1.stars === 5, `[별점] 남이 만든 것에도 별점은 줄 수 있음 → "${s1.avg}"`, `[별점] 남의 것 별점이 이상함: "${s1.avg}"`);
      await act(tab, `${sampleCard}.querySelector('button.star[data-n="5"]').click()`);
      r = await report(tab);
      check(r.cards.find(c => c.id === 'sample-1').avg.startsWith('4.3점 (3명)'), '[별점] 같은 별을 다시 누르면 내 별점이 취소됨 (4.3점·3명으로 돌아감)', `[별점] 다시 눌러도 취소가 안 됨: "${r.cards.find(c => c.id === 'sample-1').avg}"`);

      // 이름 바꾸기
      await act(tab, fillSubmit(`${mineCard}.querySelector('form.rename')`, { name: '   ' }));
      r = await report(tab);
      check(r.cards.find(c => c.mine).name === '산책할 때', '[이름] 이름을 비우면 바뀌지 않음', '[이름] 이름이 빈 값으로 바뀜');
      await act(tab, fillSubmit(`${mineCard}.querySelector('form.rename')`, { name: '아침 산책 노래' }));
      r = await report(tab);
      check(r.cards.find(c => c.mine).name === '아침 산책 노래', '[이름] 이름 바꾸기 됨: "아침 산책 노래"', '[이름] 이름 바꾸기가 안 됨');

      // 5번 기능: 재생·멈춤·다음 곡·이전 곡
      const click = (id, role) => act(tab, `document.querySelector('.card[data-id="${id}"] [data-role="${role}"]').click()`);
      const pcard = async id => (await report(tab)).cards.find(c => c.id === id);
      let p = await pcard('sample-1');
      check(p.players === 1 && p.playLabel === '재생' && p.prevOff && p.nextOff && p.nowText.includes('첫 곡부터') && !p.nowSongs.length,
        `[재생] 곡이 있는 목록마다 재생 줄이 있음 (처음: "${p.playLabel}", 이전·다음은 꺼짐, "${p.nowText}")`, `[재생] 처음 재생 줄이 이상함: ${JSON.stringify(p)}`);
      r = await report(tab);
      check(r.cards.every(c => c.players === (c.songs.length ? 1 : 0)), '[재생] 곡이 없는 목록에는 재생 줄이 없음', '[재생] 곡 없는 목록에 재생 줄이 있거나 곡 있는 목록에 없음');
      await click('sample-1', 'play');
      p = await pcard('sample-1');
      check(p.playLabel === '멈춤' && p.nowText === '재생 중: 빗소리 산책 · 달빛 밴드 (1/3)' && p.nowSongs.length === 1 && p.nowSongs[0].includes('빗소리 산책') && !p.prevOff && !p.nextOff,
        `[재생] 재생을 누르면 첫 곡이 시작: "${p.nowText}", 단추는 "멈춤", 목록에서 그 곡이 표시됨`, `[재생] 재생 시작이 이상함: ${JSON.stringify(p)}`);
      await click('sample-1', 'next'); await click('sample-1', 'next');
      p = await pcard('sample-1');
      check(p.nowText.startsWith('재생 중: 창가의 오후') && p.nowText.endsWith('(3/3)') && p.nextOff,
        `[다음 곡] 다음 곡을 두 번 누르면 마지막 곡(3/3)이고, 더 갈 곳이 없어 "다음 곡"이 꺼짐`, `[다음 곡] 이상함: ${JSON.stringify(p)}`);
      await click('sample-1', 'prev');
      p = await pcard('sample-1');
      check(p.nowText.startsWith('재생 중: 우산 아래서') && p.nowText.endsWith('(2/3)') && p.nowSongs[0].includes('우산 아래서'),
        '[이전 곡] 이전 곡을 누르면 2/3 곡으로 돌아가고 목록 표시도 따라감', `[이전 곡] 이상함: ${JSON.stringify(p)}`);
      await click('sample-1', 'play');
      p = await pcard('sample-1');
      check(p.playLabel === '재생' && p.nowText.startsWith('멈춤: 우산 아래서'), `[멈춤] 멈춤을 누르면 "${p.nowText}"로 멈추고 단추가 "재생"으로 바뀜`, `[멈춤] 이상함: ${JSON.stringify(p)}`);
      await click('sample-1', 'play');
      p = await pcard('sample-1');
      check(p.playLabel === '멈춤' && p.nowText.startsWith('재생 중: 우산 아래서'), '[멈춤] 다시 재생을 누르면 멈춘 곡에서 이어짐', `[멈춤] 이어 듣기가 이상함: ${JSON.stringify(p)}`);
      await click('sample-2', 'play');
      p = await pcard('sample-2');
      const p1 = await pcard('sample-1');
      check(p.nowText.startsWith('재생 중: 한 바퀴 더') && p1.playLabel === '재생' && p1.nowText.includes('첫 곡부터') && !p1.nowSongs.length,
        '[재생] 다른 목록을 재생하면 앞 목록은 멈추고(처음 상태로), 새 목록이 첫 곡부터 나옴 (동시에 두 목록이 나오지 않음)', `[재생] 목록을 바꿨는데 이상함: ${JSON.stringify([p, p1])}`);
      await wait(4700);
      p = await pcard('sample-2');
      check(p.nowText.startsWith('재생 중: 숨이 차도') && p.nowText.endsWith('(2/3)'), '[재생] 곡이 끝나면(약 4초) 저절로 다음 곡(2/3)으로 넘어감', `[재생] 저절로 안 넘어감: "${p.nowText}"`);
      await click('sample-2', 'play'); await wait(5000); await click('sample-2', 'play');
      p = await pcard('sample-2');
      check(p.nowText.startsWith('재생 중: 숨이 차도'), '[멈춤] 멈춰 둔 5초 동안은 곡이 넘어가지 않음 (시간도 같이 멈춤)', `[멈춤] 멈춘 사이에 넘어가 버림: "${p.nowText}"`);
      await click('sample-2', 'next');
      await wait(4700);
      p = await pcard('sample-2');
      check(p.playLabel === '재생' && p.nowText.includes('첫 곡부터') && !p.nowSongs.length, '[재생] 마지막 곡이 끝나면 멈추고 처음 상태로 돌아감', `[재생] 마지막 곡 뒤가 이상함: ${JSON.stringify(p)}`);
      r = await report(tab); collect(r);
      check(!r.errors.length, '[재생] 재생하는 동안 자바스크립트 오류 없음', '[재생] 오류: ' + r.errors.join(' / '));

      // 3. 새로 열어도 그대로
      await tab.s('Page.reload'); await wait(800);
      r = await report(tab); collect(r);
      m = r.cards.find(c => c.mine);
      check(m && m.name === '아침 산책 노래' && m.maker === '테스트 별명' && m.songs.length === 1 && m.avg.startsWith('4.0점') && r.cards.length === 3,
        `[남기기] 새로 열어도 그대로: "${m && m.name}" · ${m && m.maker} · 곡 ${m && m.songs.length}개 · ${m && m.avg}, 남의 것에 준 별점도 유지(${(r.cards.find(c => c.id === 'sample-1') || {}).avg})`,
        `[남기기] 새로 열었더니 달라짐: ${JSON.stringify(r.cards.map(c => [c.name, c.avg, c.songs.length]))}`);
      check(r.saved && r.saved.playlists.length === 3, '[남기기] 저장 칸(localStorage)에 3개가 들어 있음', '[남기기] 저장 칸 내용이 이상함');

      // 4. 내 아이디어: 내 표시가 달라지면(다른 기기에서 열면) 내 것도 보기만 됨
      await act(tab, `(() => { const d = JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)})); d.myId = 'another-device'; localStorage.setItem(${JSON.stringify(SAVE_KEY)}, JSON.stringify(d)); })()`);
      await tab.s('Page.reload'); await wait(800);
      r = await report(tab); collect(r);
      const theirs = r.cards.find(c => c.name === '아침 산책 노래');
      check(theirs && !theirs.mine && !theirs.addForm && !theirs.renameForm && !theirs.deleteBtn && !theirs.removeBtns && theirs.note === 1 && theirs.songs.length === 1,
        '[남이 만든 것] 다른 기기(내 표시가 다름)에서 열면 내가 만든 것도 보이긴 하지만 곡·이름·지우기 도구가 없음',
        `[남이 만든 것] 다른 기기에서 열었는데 고칠 수 있거나 안 보임: ${JSON.stringify(theirs)}`);
      check(r.cards.every(c => !c.mine), '[남이 만든 것] 그 기기에서는 "내가 만든 것"이 하나도 없음', '[남이 만든 것] 내 것으로 잘못 보이는 카드가 있음');
      await act(tab, `(() => { const d = JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)})); d.myId = d.playlists.find(p => p.name === '아침 산책 노래').owner; localStorage.setItem(${JSON.stringify(SAVE_KEY)}, JSON.stringify(d)); })()`);
      await tab.s('Page.reload'); await wait(800);

      // 지우기 (되묻기)
      await act(tab, `${mineCard}.querySelector('[data-role="play"]').click()`); // 재생 중에 지우면 어떻게 되는지 보려고 먼저 재생
      await act(tab, `${mineCard}.querySelector('button.delete').click()`);
      r = await report(tab);
      check(r.cards.find(c => c.mine) && r.cards.find(c => c.mine).confirm === 1 && r.cards.length === 3, '[지우기] 지우기를 누르면 바로 지우지 않고 "정말 지울까요?"를 물음', '[지우기] 되묻지 않았거나 바로 지워짐');
      await act(tab, `${mineCard}.querySelector('.cancel-delete').click()`);
      r = await report(tab);
      check(r.cards.length === 3 && r.cards.find(c => c.mine).confirm === 0, '[지우기] 취소하면 그대로 남음', '[지우기] 취소했는데 이상함');
      await act(tab, `${mineCard}.querySelector('button.delete').click()`);
      await act(tab, `${mineCard}.querySelector('.confirm-delete').click()`);
      r = await report(tab); collect(r);
      check(r.cards.length === 2 && !r.cards.some(c => c.mine) && r.saved.playlists.length === 2, '[지우기] 지우기를 확인하면 사라지고 저장에서도 빠짐', `[지우기] 지웠는데 남음: ${r.cards.length}개`);
      check(r.cards.every(c => !c.deleteBtn), '[지우기] 예시(남의 것)는 지울 방법이 없음', '[지우기] 남의 것에 지우기가 있음');
      check(r.cards.every(c => c.playLabel === '재생' && !c.nowSongs.length), '[재생] 재생 중이던 내 목록을 지우면 소리도 멈춤 (남은 목록은 모두 "재생" 상태)', `[재생] 지운 뒤에도 재생 상태가 남음: ${JSON.stringify(r.cards.map(c => [c.name, c.playLabel]))}`);

      await tab.s('Runtime.evaluate', { expression: 'localStorage.removeItem(' + JSON.stringify(SAVE_KEY) + ')' });
    } finally {
      await tab.close();
    }

    // 5. 저장이 막힐 때
    const blockedTab = await openApp(cdp, pageUrl, 'blocked', SIZES[0]);
    try {
      let r = await evaluate(blockedTab, REPORT_JS.replace(/saved: \(\(\) => \{.*?\}\)\(\),/s, 'saved: null,'));
      check(r.cards.length === 2 && r.notice && r.notice.includes('저장'), `[저장 막힘] 저장이 막혀도 화면은 열리고 안내가 나옴: "${r.notice}"`, `[저장 막힘] 안내가 없거나 화면이 안 열림: 카드 ${r.cards.length}개, 안내 ${r.notice}`);
      await evaluate(blockedTab, `document.getElementById('new-name').value='막힌 곳'; document.getElementById('new-nick').value='별명'; document.getElementById('create-form').requestSubmit();`);
      await wait(200);
      r = await evaluate(blockedTab, REPORT_JS.replace(/saved: \(\(\) => \{.*?\}\)\(\),/s, 'saved: null,'));
      check(r.cards.some(c => c.mine && c.name === '막힌 곳'), '[저장 막힘] 저장이 막혀도 만들기는 지금 화면에서 됨', '[저장 막힘] 만들기가 멈춤');
      collect(r);
      await shoot(blockedTab, path.join(SHOTS_DIR, `music-blocked-${SIZES[0].name}-${SIZES[0].w}x${SIZES[0].h}.png`), shots);
    } finally {
      await blockedTab.close();
    }

    // 6. 화면 크기 (긴 글자로 가득 채운 상태)
    for (const sz of SIZES) {
      const t = await openApp(cdp, pageUrl, 'long', sz);
      try {
        const r = await report(t); collect(r);
        const bad1 = [];
        if (r.width !== sz.w) bad1.push(`흉내 낸 폭이 ${r.width} 이라 믿을 만하지 않음`);
        if (r.scrollWidth > r.width || r.outside.length) bad1.push(`옆으로 넘침 (폭 ${r.width}, 내용 ${r.scrollWidth}) ${r.outside.join(', ')}`);
        if (r.cards.length !== 3) bad1.push(`카드 ${r.cards.length}개`);
        check(!bad1.length, `[화면 ${sz.w}×${sz.h}] 아주 긴 이름·곡 이름(띄어쓰기 없이 40~60자)도 안 잘리고 안 넘침`, `[화면 ${sz.w}×${sz.h}] ${bad1.join(' / ')}`);
        await shoot(t, path.join(SHOTS_DIR, `music-long-${sz.name}-${sz.w}x${sz.h}.png`), shots);
      } finally {
        await t.close();
      }
    }
    // 보통 상태 사진 (처음 열기)
    for (const sz of SIZES) {
      const t = await openApp(cdp, pageUrl, 'fresh', sz);
      try {
        const r = await report(t); collect(r);
        check(r.scrollWidth <= r.width && !r.outside.length, `[화면 ${sz.w}×${sz.h}] 처음 화면도 안 넘침`, `[화면 ${sz.w}×${sz.h}] 처음 화면이 넘침: ${r.outside.join(', ')}`);
        await shoot(t, path.join(SHOTS_DIR, `music-fresh-${sz.name}-${sz.w}x${sz.h}.png`), shots);
      } finally {
        await t.close();
      }
    }
  } finally {
    close();
  }

  if (errors.size) bad.push('자바스크립트 오류: ' + [...errors].join(' / '));
  else ok.push('자바스크립트 오류: 없음');
  ok.push(`화면 사진 ${shots.length}장 찍음:`);

  const unchecked = [
    '진짜 폰에서 손가락으로 눌러 보기 (별·단추 누르기 편한지는 사진과 크기로만 봤어요)',
    '진짜 다른 사람의 기기에서 내 플레이리스트가 보이는지 (이 기기 안에서 "내 표시가 다른 기기"를 흉내 낸 것뿐이에요. 진짜는 로그인과 보관함이 있어야 해요)',
    '스피커로 소리가 실제로 들리는지 (화면 없는 브라우저라서 단추·표시·시간 흐름만 봤어요. 귀로 들어 보는 건 직접 해 보셔야 해요)',
    '여러 탭을 동시에 열어 두고 고칠 때 서로 덮어쓰는지',
    '브라우저 저장 공간이 꽉 찼을 때 (저장 막힘 안내로만 흉내 냈어요)',
  ];

  console.log(`\n=== 확인 결과: 내 작품 (${path.relative(ROOT_DIR, appFile)}) ===`);
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
