// week-07 작품(플레이리스트 사이트) 확인 도구. week-06 앱 확인 도구를 이 작품에 맞게 고침.
//
// 쓰는 법 (QUEST-TRACK-2 폴더에서):
//   node week-07/check/check.js
//
// 하는 일 (파일을 두 번 누른 것처럼 file:// 로 열어서 사람이 하는 것을 따라 해요):
//   1. 처음 열기      : 예시 2개가 보이고, 다른 사람 것에는 고치기·지우기가 없는지, 로그인 자리가 빈 칸인지
//   1-2. + 칸      : 새 플레이리스트 만들기가 + 칸으로 카드 옆에 있고, 눌러 열고 취소·Esc·만든 뒤 닫히는지
//   2. 만들기·고치기   : 만들기, 곡 넣고 빼기, 별점, 이름 바꾸기, 지우기(되묻기 포함), 빈칸 안내
//   3. 남기기         : 새로 열어도 그대로인지
//   4. 남이 만든 것    : 내 표시가 달라지면(다른 기기처럼) 내 것도 보기만 되는지 (내 아이디어)
//   4-2. 재생      : 재생·멈춤·이어 듣기·다음 곡·이전 곡, 저절로 다음 곡, 목록을 바꾸면 앞 목록이 멈추는지
//   4-3. 찾기·정렬  : 이름으로 찾기(띄어쓰기 무시), 없는 이름 안내, 별점 높은 순, 둘을 같이 쓰기
//   4-4. 곡 순서    : 끌어서 옮기기(마우스·터치), 키보드 화살표, 남의 목록엔 손잡이 없음, 듣는 중에 옮겨도 따라가는지
//   4-5. 섞기·반복  : 한 곡 반복(끝나도 같은 곡), 섞어 듣기(모든 곡이 한 번씩), 옮기고 곡을 넣어도 차례가 맞는지
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
  // 끌기·섞기 시험은 같은 결과가 나오도록 Math.random 을 정해진 수열로 바꿔요
  if (mode === 'drag') Math.random = (() => { const seq = [0.1, 0.9, 0.5, 0.3, 0.7, 0.2]; let i = 0; return () => seq[i++ % seq.length]; })();
  if (mode === 'blocked') {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('막힘', 'SecurityError'); } });
    return;
  }
  try {
    if (!sessionStorage.getItem('__started')) {
      sessionStorage.setItem('__started', '1');
      localStorage.clear();
      if (mode === 'drag') {
        const song = t => ({ t, a: '밴드' });
        localStorage.setItem(${JSON.stringify(SAVE_KEY)}, JSON.stringify({ myId: 'me', nick: '별', playlists: [
          { id: 'drag-1', owner: 'me', maker: '별', name: '끌기 시험', songs: ['가곡', '나곡', '다곡', '라곡'].map(song), ratings: {} },
          { id: 'sample-1', owner: 'sample-a', maker: '구름이', name: '비 오는 날 듣는 노래',
            songs: [{ t: '빗소리 산책', a: '달빛 밴드' }, { t: '우산 아래서', a: '하늘 트리오' }], ratings: {} },
        ] }));
      }
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
    shuffle: c.querySelector('[data-role=shuffle]') ? c.querySelector('[data-role=shuffle]').getAttribute('aria-pressed') : null,
    repeat: c.querySelector('[data-role=repeat]') ? c.querySelector('[data-role=repeat]').getAttribute('aria-pressed') : null,
    players: $$('.player', c).length, handles: $$('.handle', c).length,
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
    noMatch: !document.getElementById('no-match').hidden ? document.getElementById('no-match').innerText : null,
    search: document.getElementById('search').value, sort: document.getElementById('sort').value,
    count: document.getElementById('count').innerText,
    notice: notice && !notice.hidden ? notice.innerText : null,
    slotText: slot ? slot.innerText.trim() : null,
    slotControls: slot ? slot.querySelectorAll('button, a, input').length : -1,
    createMsg: document.getElementById('create-msg').innerText,
    add: (() => {
      const t = document.getElementById('add-tile'), b = document.getElementById('add-open'), f = document.getElementById('create-form');
      const rc = el => { if (!el) return null; const r = el.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; };
      return { btnShown: b.offsetParent !== null, btnText: b.innerText.replace(/\\s+/g, ' ').trim(), formShown: f.offsetParent !== null,
        expanded: b.getAttribute('aria-expanded'), focus: document.activeElement.id, tile: rc(t), card: rc(document.querySelector('.card')),
        oldPanel: !!document.getElementById('create-title') };
    })(),
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
const OPEN = "(() => { const f = document.getElementById('create-form'); if (f.hidden) document.getElementById('add-open').click(); })(); ";
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
      check(r.cards.every(c => !c.addForm && !c.renameForm && !c.deleteBtn && !c.removeBtns && !c.handles && c.note === 1),
        '[남이 만든 것] 예시(다른 사람 것)에는 곡 넣기·빼기·이름 바꾸기·지우기가 없고 "볼 수만 있어요" 안내만 있음',
        '[남이 만든 것] 다른 사람 것에 고치기·지우기 단추가 보임');
      check(r.slotText === '로그인 자리' && r.slotControls === 0,
        '[로그인 자리] 화면 위쪽에 "로그인 자리"라고만 적힌 빈 칸이 있고, 누를 단추나 입력칸은 없음',
        `[로그인 자리] 문구/내용이 다름: "${r.slotText}", 단추 ${r.slotControls}개`);

      // + 칸
      check(r.add.btnShown && r.add.btnText === '+ 새 플레이리스트 만들기' && !r.add.formShown && r.add.expanded === 'false' && !r.add.oldPanel,
        `[+ 칸] 처음엔 입력칸 대신 "${r.add.btnText}" 칸(+)만 보이고, 위쪽의 따로 있던 만들기 칸은 없음`, `[+ 칸] 처음 모습이 이상함: ${JSON.stringify(r.add)}`);
      check(r.add.card && r.add.tile[1] < r.add.card[3], '[+ 칸] + 칸이 플레이리스트 카드들과 같은 목록 안, 맨 앞에 놓임', '[+ 칸] + 칸이 카드 아래로 밀려남');
      await act(tab, `document.getElementById('add-open').click()`);
      r = await report(tab);
      check(!r.add.btnShown && r.add.formShown && r.add.expanded === 'true' && r.add.focus === 'new-name',
        '[+ 칸] +를 누르면 그 자리가 입력칸(이름·별명·만들기·취소)으로 바뀌고 이름 칸에 커서가 감', `[+ 칸] 열었는데 이상함: ${JSON.stringify(r.add)}`);
      await act(tab, `document.getElementById('new-name').value = '쓰다 만 것'; document.getElementById('add-cancel').click()`);
      r = await report(tab);
      check(r.add.btnShown && !r.add.formShown && r.cards.length === 2 && r.createMsg === '', '[+ 칸] 취소하면 아무것도 만들지 않고 다시 +로 돌아옴', `[+ 칸] 취소가 이상함: ${JSON.stringify(r.add)} 카드 ${r.cards.length}개`);
      await act(tab, `document.getElementById('add-open').click()`);
      r = await report(tab);
      check(r.add.formShown && (await evaluate(tab, `document.getElementById('new-name').value`)) === '', '[+ 칸] 취소한 뒤 다시 열면 쓰다 만 글자는 비어 있음', '[+ 칸] 쓰다 만 글자가 남아 있음');
      await act(tab, `document.getElementById('new-name').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
      r = await report(tab);
      check(r.add.btnShown && !r.add.formShown, '[+ 칸] Esc 키로도 닫힘', '[+ 칸] Esc 로 안 닫힘');

      // 2. 만들기
      await act(tab, `${OPEN}document.getElementById('create-form').requestSubmit()`);
      r = await report(tab);
      check(r.cards.length === 2 && /이름/.test(r.createMsg),
        `[만들기] 이름 없이 만들면 안내가 나오고 안 만들어짐: "${r.createMsg}"`, `[만들기] 이름 없이 눌렀을 때 안내/동작이 이상함: "${r.createMsg}", 카드 ${r.cards.length}개`);
      await act(tab, `${OPEN}document.getElementById('new-name').value='산책할 때'; document.getElementById('new-nick').value=''; document.getElementById('create-form').requestSubmit();`);
      r = await report(tab);
      check(r.cards.length === 2 && /별명/.test(r.createMsg),
        `[만들기] 별명 없이 만들면 안내: "${r.createMsg}"`, `[만들기] 별명 없이 눌렀을 때 안내/동작이 이상함: "${r.createMsg}"`);
      await act(tab, `${OPEN}document.getElementById('new-nick').value='  테스트  별명 '; document.getElementById('create-form').requestSubmit();`);
      r = await report(tab); collect(r);
      const mine = r.cards.find(c => c.mine);
      check(r.add.btnShown && !r.add.formShown, '[+ 칸] 만들고 나면 입력칸이 닫히고 다시 +가 보임', `[+ 칸] 만든 뒤에도 입력칸이 열려 있음: ${JSON.stringify(r.add)}`);
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

      // 6번 기능: 찾기와 정렬
      const setSearch = v => act(tab, `(() => { const e = document.getElementById('search'); e.value = ${JSON.stringify(v)}; e.dispatchEvent(new Event('input', { bubbles: true })); })()`);
      const setSort = v => act(tab, `(() => { const e = document.getElementById('sort'); e.value = ${JSON.stringify(v)}; e.dispatchEvent(new Event('change', { bubbles: true })); })()`);
      const names = rr => rr.cards.map(c => c.name);
      r = await report(tab);
      check(r.count === '전체 3개 중 3개 보여요' && r.sort === 'new' && names(r).join('|') === '아침 산책 노래|비 오는 날 듣는 노래|운동할 때 듣는 노래',
        `[정렬] 처음엔 최근 만든 순: ${names(r).join(' → ')}, "${r.count}"`, `[정렬] 처음 순서/개수가 이상함: ${names(r).join(' → ')}, "${r.count}"`);
      await setSort('stars');
      r = await report(tab);
      check(names(r).join('|') === '운동할 때 듣는 노래|비 오는 날 듣는 노래|아침 산책 노래',
        `[정렬] 별점 높은 순: ${names(r).join(' → ')} (${r.cards.map(c => c.avg.split(' ')[0]).join(' > ')})`, `[정렬] 별점 높은 순이 이상함: ${names(r).join(' → ')} ${r.cards.map(c => c.avg).join(' / ')}`);
      await act(tab, `${mineCard}.querySelector('button.star[data-n="5"]').click()`);
      await setSort('new'); await setSort('stars');
      r = await report(tab);
      check(names(r)[0] === '아침 산책 노래' && r.cards[0].avg.startsWith('5.0점'), '[정렬] 내 별점을 5개로 바꾸면 별점 높은 순에서 맨 위로 올라감', `[정렬] 별점을 바꿨는데 순서가 그대로: ${names(r).join(' → ')}`);
      await act(tab, `${mineCard}.querySelector('button.star[data-n="5"]').click()`); // 별점 취소 → 별점 없음
      await setSort('new'); await setSort('stars');
      r = await report(tab);
      check(names(r).join('|') === '운동할 때 듣는 노래|비 오는 날 듣는 노래|아침 산책 노래' && /아직 별점이 없어요/.test(r.cards[2].avg),
        '[정렬] 별점이 없는 것은 별점 높은 순에서 맨 뒤로 감 (최근 만든 순에서는 맨 위였음)', `[정렬] 별점 없는 것의 자리가 이상함: ${names(r).join(' → ')}`);
      await act(tab, `${mineCard}.querySelector('button.star[data-n="4"]').click()`); // 원래대로 4개
      await setSort('new');

      await setSearch('산책');
      r = await report(tab);
      check(names(r).join('|') === '아침 산책 노래' && r.count === '전체 3개 중 1개 보여요', `[찾기] "산책"으로 찾으면 그것만 보임: ${names(r).join(', ')} / "${r.count}"`, `[찾기] "산책" 결과가 이상함: ${names(r).join(', ')} / "${r.count}"`);
      await setSearch('  운동 ');
      r = await report(tab);
      check(names(r).join('|') === '운동할 때 듣는 노래', '[찾기] 앞뒤 띄어쓰기는 무시하고 찾음 ("  운동 " → 운동할 때 듣는 노래)', `[찾기] 띄어쓰기가 있으면 못 찾음: ${names(r).join(', ')}`);
      await setSearch('노 래');
      r = await report(tab);
      check(r.cards.length === 3, '[찾기] "노 래"처럼 띄어 써도 이름 속 "노래"를 찾음 (3개 모두)', `[찾기] "노 래" 결과가 이상함: ${r.cards.length}개`);
      await setSearch('없는이름');
      r = await report(tab);
      check(r.cards.length === 0 && r.noMatch && !r.empty && r.count === '전체 3개 중 0개 보여요', `[찾기] 없는 이름이면 빈 화면 대신 안내가 나옴: "${r.noMatch}"`, `[찾기] 없는 이름일 때 안내가 이상함: 카드 ${r.cards.length}개, 안내 ${r.noMatch}`);
      await setSearch('노래'); await setSort('stars');
      r = await report(tab);
      check(names(r).join('|') === '운동할 때 듣는 노래|비 오는 날 듣는 노래|아침 산책 노래' && !r.noMatch, '[찾기+정렬] 찾기와 정렬을 같이 쓸 수 있음 ("노래" + 별점 높은 순)', `[찾기+정렬] 이상함: ${names(r).join(' → ')}`);
      await setSearch(''); await setSort('new');
      r = await report(tab);
      check(r.cards.length === 3 && !r.noMatch && r.count === '전체 3개 중 3개 보여요', '[찾기] 찾기를 비우면 모두 돌아옴', `[찾기] 비웠는데 ${r.cards.length}개`);
      // 찾는 중에 새로 만들면 찾기가 비워져서 새 것이 보여야 함
      await setSearch('운동');
      await act(tab, `${OPEN}document.getElementById('new-name').value = '새로 만든 것'; document.getElementById('create-form').requestSubmit();`);
      r = await report(tab); collect(r);
      check(r.search === '' && r.cards[0] && r.cards[0].name === '새로 만든 것' && r.count === '전체 4개 중 4개 보여요',
        '[찾기] 찾는 중에 새로 만들어도 찾기가 비워져서 새 플레이리스트가 바로 보임', `[찾기] 새로 만든 것이 안 보일 수 있음: 찾기 "${r.search}", ${names(r).join(', ')}`);
      await act(tab, `${mineCard}.querySelector('button.delete').click()`);
      await act(tab, `${mineCard}.querySelector('.confirm-delete').click()`);
      r = await report(tab);
      check(r.cards.length === 3 && r.saved.playlists.length === 3 && r.count === '전체 3개 중 3개 보여요', '[찾기] 시험으로 만든 것을 지워 3개로 되돌림 (개수 표시도 맞음)', `[찾기] 되돌리기 실패: ${r.cards.length}개`);
      await tab.s('Page.reload'); await wait(800);
      r = await report(tab);
      check(r.search === '' && r.sort === 'new' && r.cards.length === 3, '[찾기] 새로 열면 찾기·정렬은 처음 상태 (저장하지 않음, 목록은 그대로)', `[찾기] 새로 열었을 때 이상함: 찾기 "${r.search}", 정렬 ${r.sort}`);

      // 4. 내 아이디어: 내 표시가 달라지면(다른 기기에서 열면) 내 것도 보기만 됨
      await act(tab, `(() => { const d = JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)})); d.myId = 'another-device'; localStorage.setItem(${JSON.stringify(SAVE_KEY)}, JSON.stringify(d)); })()`);
      await tab.s('Page.reload'); await wait(800);
      r = await report(tab); collect(r);
      const theirs = r.cards.find(c => c.name === '아침 산책 노래');
      check(theirs && !theirs.mine && !theirs.addForm && !theirs.renameForm && !theirs.deleteBtn && !theirs.removeBtns && !theirs.handles && theirs.note === 1 && theirs.songs.length === 1,
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

    // 7번 기능: 곡 순서 바꾸기 (끌어서 옮기기)
    {
      const rowsOf = async (t, which) => (await evaluate(t, `(() => { document.querySelector('.card[data-id="drag-1"]').scrollIntoView({ block: 'center' }); return [...document.querySelectorAll('.card[data-id="drag-1"] li.song')].map(li => {
        const b = li.querySelector('.handle'), r = li.getBoundingClientRect(), h = b && b.getBoundingClientRect();
        return { text: li.innerText.replace(/\\s+/g, ' ').replace(/ ?빼기$/, '').split(' · ')[0], hx: h && h.left + h.width / 2, hy: h && h.top + h.height / 2, cy: r.top + r.height / 2 };
      }); })()`));
      const orderOf = async t => (await rowsOf(t)).map(x => x.text);
      const savedOf = async t => (await evaluate(t, `JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)})).playlists.find(p => p.id === 'drag-1').songs.map(s => s.t)`));
      const handlesOf = async t => (await report(t)).cards.map(cd => cd.id + ':' + cd.handles).join(' ');
      const same = (a, b) => a.join(',') === b.join(',');

      // 마우스로 끌기 (컴퓨터)
      const dt = await openApp(cdp, pageUrl, 'drag', SIZES[3]);
      try {
        const mouse = async (type, x, y) => { await dt.s('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' ? 'none' : 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 }); };
        const dragRow = async (from, toRow, extra) => {
          const rows = await rowsOf(dt);
          const x = rows[from].hx, y0 = rows[from].hy, y1 = rows[toRow].cy + extra;
          await mouse('mousePressed', x, y0);
          for (let k = 1; k <= 5; k++) await mouse('mouseMoved', x, y0 + (y1 - y0) * k / 5);
          await mouse('mouseReleased', x, y1);
          await wait(250);
        };
        let rep0 = await report(dt); collect(rep0);
        const hs = await handlesOf(dt);
        check(hs === 'drag-1:4 sample-1:0', `[곡 순서] 내 목록의 곡마다 끌 손잡이(≡)가 있고, 남이 만든 목록에는 없음 (${hs})`, `[곡 순서] 손잡이가 이상함: ${hs}`);
        let o = await orderOf(dt);
        check(same(o, ['가곡', '나곡', '다곡', '라곡']), `[곡 순서] 처음 순서: ${o.join(' → ')}`, `[곡 순서] 처음 순서가 이상함: ${o.join(' → ')}`);

        await dragRow(0, 2, 4); // 첫 곡을 세 번째 자리로
        o = await orderOf(dt); let sv = await savedOf(dt);
        check(same(o, ['나곡', '다곡', '가곡', '라곡']) && same(sv, ['나곡', '다곡', '가곡', '라곡']), `[곡 순서] 마우스로 첫 곡을 아래로 끌면 옮겨지고 저장됨: ${o.join(' → ')}`, `[곡 순서] 아래로 끌기가 이상함: 화면 ${o.join(' → ')} / 저장 ${sv.join(' → ')}`);
        await dragRow(3, 0, -4); // 마지막 곡을 맨 위로
        o = await orderOf(dt); sv = await savedOf(dt);
        check(same(o, ['라곡', '나곡', '다곡', '가곡']) && same(sv, o), `[곡 순서] 마지막 곡을 맨 위로 끌어 올릴 수 있음: ${o.join(' → ')}`, `[곡 순서] 위로 끌기가 이상함: 화면 ${o.join(' → ')} / 저장 ${sv.join(' → ')}`);
        {
          const rows = await rowsOf(dt), x = rows[1].hx, y = rows[1].hy;
          await mouse('mousePressed', x, y); await mouse('mouseMoved', x, y + 6); await mouse('mouseReleased', x, y + 6); await wait(250);
        }
        o = await orderOf(dt);
        check(same(o, ['라곡', '나곡', '다곡', '가곡']), '[곡 순서] 조금만 움직였다 놓으면 순서가 그대로임', `[곡 순서] 조금 움직였는데 바뀜: ${o.join(' → ')}`);

        // 끄는 도중 모습 (사진)
        {
          const rows = await rowsOf(dt), x = rows[0].hx, y = rows[0].hy;
          await mouse('mousePressed', x, y);
          for (let k = 1; k <= 4; k++) await mouse('mouseMoved', x, y + k * 20);
          await wait(250);
          const mid = await evaluate(dt, `(() => { const li = document.querySelector('.card[data-id="drag-1"] li.dragging'); return !!li && li.style.transform.startsWith('translateY'); })()`);
          check(mid, '[곡 순서] 끄는 동안 그 곡이 손을 따라 움직이고 표시(.dragging)가 됨', '[곡 순서] 끄는 동안 움직임 표시가 없음');
          await shoot(dt, path.join(SHOTS_DIR, `music-dragging-${SIZES[3].name}-${SIZES[3].w}x${SIZES[3].h}.png`), shots);
          await mouse('mouseReleased', x, y + 80); await wait(250);
        }

        const beforeReload = await orderOf(dt);
        await dt.s('Page.reload'); await wait(800);
        o = await orderOf(dt);
        check(same(o, beforeReload) && o.length === 4, `[곡 순서] 새로 열어도 바꾼 순서가 그대로: ${o.join(' → ')}`, `[곡 순서] 새로 열었더니 이상함: ${o.join(' → ')}`);

        // 키보드
        const key = (row, k) => evaluate(dt, `document.querySelectorAll('.card[data-id="drag-1"] li.song')[${row}].querySelector('.handle').dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, bubbles: true, cancelable: true }))`).then(() => wait(150));
        const before = await orderOf(dt);
        await evaluate(dt, `document.querySelectorAll('.card[data-id="drag-1"] li.song')[1].querySelector('.handle').focus()`);
        await key(1, 'ArrowDown');
        o = await orderOf(dt);
        const exp = [before[0], before[2], before[1], before[3]];
        const focusText = await evaluate(dt, `(document.activeElement.closest('li') || {}).innerText || ''`);
        check(same(o, exp) && focusText.includes(before[1]), `[곡 순서] 키보드: ≡ 에서 아래 화살표를 누르면 한 칸 내려가고, 손잡이 위치(포커스)도 따라감: ${o.join(' → ')}`, `[곡 순서] 키보드 아래가 이상함: ${o.join(' → ')}, 포커스 "${focusText}"`);
        await key(0, 'ArrowUp');
        check(same(await orderOf(dt), exp), '[곡 순서] 맨 위에서 위 화살표를 눌러도 아무 일 없음 (오류 없음)', '[곡 순서] 맨 위에서 위 화살표가 순서를 바꿈');

        // 듣는 중에 순서를 바꿔도 듣던 곡을 따라감
        const cur = (await orderOf(dt))[0];
        await act(dt, `document.querySelector('.card[data-id="drag-1"] [data-role="play"]').click()`);
        await key(0, 'ArrowDown');
        let pr = (await report(dt)).cards.find(cd => cd.id === 'drag-1');
        check(pr.nowText.startsWith(`재생 중: ${cur}`) && pr.nowText.endsWith('(2/4)') && pr.nowSongs[0].includes(cur),
          `[곡 순서+재생] 듣고 있던 곡("${cur}")을 아래로 옮겨도 그 곡이 계속 나오고 (2/4)로 따라감`, `[곡 순서+재생] 듣던 곡을 놓침: ${JSON.stringify(pr.nowText)}`);
        await key(2, 'ArrowUp'); // 듣는 곡 뒤에 있던 곡을 듣는 곡 앞으로
        pr = (await report(dt)).cards.find(cd => cd.id === 'drag-1');
        check(pr.nowText.startsWith(`재생 중: ${cur}`) && pr.nowText.endsWith('(3/4)'), '[곡 순서+재생] 다른 곡이 듣는 곡 앞으로 와도 듣던 곡을 따라감 (3/4)', `[곡 순서+재생] 이상함: ${JSON.stringify(pr.nowText)}`);
        rep0 = await report(dt); collect(rep0);
        check(!rep0.errors.length, '[곡 순서] 끌고 옮기는 동안 자바스크립트 오류 없음', '[곡 순서] 오류: ' + rep0.errors.join(' / '));
      } finally {
        await dt.close();
      }

      // 손가락으로 끌기 (폰)
      const pt = await openApp(cdp, pageUrl, 'drag', SIZES[1]);
      try {
        await pt.s('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
        const touch = (type, x, y) => pt.s('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
        const rows = await rowsOf(pt);
        const x = rows[1].hx, y0 = rows[1].hy, y1 = rows[3].cy + 4;
        await touch('touchStart', x, y0);
        for (let k = 1; k <= 5; k++) await touch('touchMove', x, y0 + (y1 - y0) * k / 5);
        await wait(200);
        await shoot(pt, path.join(SHOTS_DIR, `music-dragging-touch-${SIZES[1].name}-${SIZES[1].w}x${SIZES[1].h}.png`), shots);
        await touch('touchEnd', x, y1);
        await wait(300);
        const o = await orderOf(pt), sv = await savedOf(pt);
        check(same(o, ['가곡', '다곡', '라곡', '나곡']) && same(sv, o), `[곡 순서] 폰처럼 손가락으로 끌어도 됨 (터치): ${o.join(' → ')}`, `[곡 순서] 손가락 끌기가 이상함: 화면 ${o.join(' → ')} / 저장 ${sv.join(' → ')}`);
        const rr = await report(pt); collect(rr);
        check(rr.scrollWidth <= rr.width, '[곡 순서] 폰 폭에서 손잡이를 넣어도 옆으로 넘치지 않음', `[곡 순서] 폰에서 넘침 ${rr.outside.join(', ')}`);
      } finally {
        await pt.close();
      }
    }

    // 8번 기능: 섞어 듣기와 한 곡 반복
    {
      const ft = await openApp(cdp, pageUrl, 'drag', SIZES[3]);
      try {
        const clk = (id, role) => act(ft, `document.querySelector('.card[data-id="${id}"] [data-role="${role}"]').click()`);
        const card = async () => (await report(ft)).cards.find(cd => cd.id === 'drag-1');
        const song = cd => (cd.nowSongs[0] || '').split(' · ')[0].replace(/^\\d+\\.\\s*/, '');
        let cd = await card();
        let rr = await report(ft); collect(rr);
        check(rr.cards.every(x => x.shuffle === 'false' && x.repeat === 'false'), '[섞기·반복] 곡이 있는 목록마다 "섞어 듣기"와 "한 곡 반복" 단추가 있고, 처음엔 꺼져 있음', `[섞기·반복] 단추가 없거나 처음부터 켜져 있음: ${JSON.stringify(rr.cards.map(x => [x.shuffle, x.repeat]))}`);

        // 한 곡 반복
        await clk('drag-1', 'play');
        await clk('drag-1', 'repeat');
        cd = await card();
        check(cd.repeat === 'true' && cd.nowText.includes('한 곡 반복') && cd.nowText.startsWith('재생 중: 가곡'), `[한 곡 반복] 켜면 단추가 켜진 모양이 되고 안내에 표시됨: "${cd.nowText}"`, `[한 곡 반복] 켰는데 이상함: ${JSON.stringify(cd.nowText)}`);
        await wait(4700);
        cd = await card();
        check(cd.nowText.startsWith('재생 중: 가곡') && cd.nowText.includes('(1/4)'), '[한 곡 반복] 곡이 끝나도(약 4초 뒤) 다음 곡으로 안 넘어가고 같은 곡이 다시 나옴', `[한 곡 반복] 반복이 안 됨: ${JSON.stringify(cd.nowText)}`);
        await clk('drag-1', 'repeat');
        await wait(4700);
        cd = await card();
        check(cd.repeat === 'false' && cd.nowText.startsWith('재생 중: 나곡') && !cd.nowText.includes('한 곡 반복'), '[한 곡 반복] 끄면 곡이 끝났을 때 다시 다음 곡(나곡)으로 넘어감', `[한 곡 반복] 끈 뒤가 이상함: ${JSON.stringify(cd.nowText)}`);
        await clk('drag-1', 'repeat'); await clk('drag-1', 'next');
        cd = await card();
        check(cd.nowText.startsWith('재생 중: 다곡'), '[한 곡 반복] 반복을 켜 둬도 "다음 곡" 단추는 다음 곡으로 감', `[한 곡 반복] 반복 중 다음 곡이 이상함: ${JSON.stringify(cd.nowText)}`);
        await clk('drag-1', 'repeat');

        // 섞어 듣기
        const walk = async () => { // 지금 곡부터 "다음 곡"을 끝까지 눌러 가며 곡 이름을 모아요
          const seen = [];
          for (let k = 0; k < 10; k++) {
            const x = await card();
            seen.push((x.nowSongs[0] || '').split(' ')[0].replace(/^\\d+\\./, '') || x.nowSongs[0]);
            if (x.nextOff) break;
            await clk('drag-1', 'next');
          }
          return seen;
        };
        await clk('drag-1', 'shuffle');
        cd = await card();
        check(cd.shuffle === 'true' && cd.nowText.startsWith('재생 중: 다곡') && cd.nowText.includes('(1/4)') && cd.nowText.includes('섞어 듣기'),
          `[섞어 듣기] 듣는 중에 켜도 듣던 곡(다곡)은 그대로 이어지고, 그 곡이 섞인 차례의 첫째(1/4)가 됨: "${cd.nowText}"`, `[섞어 듣기] 켰는데 이상함: ${JSON.stringify(cd.nowText)}`);
        let seen = await walk();
        const uniq = new Set(seen);
        check(seen.length === 4 && uniq.size === 4 && seen[0].includes('다곡') && seen.some(n => n.includes('가곡') || n.includes('나곡')) && (await card()).nextOff,
          `[섞어 듣기] "다음 곡"을 계속 누르면 모든 곡이 한 번씩만 나오고, 줄 순서로는 못 가는 앞쪽 곡도 나옴 (섞였음): ${seen.join(' → ')}`, `[섞어 듣기] 섞은 차례가 이상함: ${seen.join(' → ')}`);
        await clk('drag-1', 'prev');
        cd = await card();
        check(cd.nowSongs[0] && !cd.nowSongs[0].includes((seen[3] || '#')) , '[섞어 듣기] "이전 곡"은 섞인 차례에서 바로 앞에 들은 곡으로 돌아감', `[섞어 듣기] 이전 곡이 이상함: ${JSON.stringify(cd.nowText)}`);
        await clk('drag-1', 'shuffle');
        cd = await card();
        check(cd.shuffle === 'false' && !cd.nowText.includes('섞어 듣기') && cd.nowSongs.length === 1, '[섞어 듣기] 끄면 표시가 사라지고 듣던 곡은 그대로', `[섞어 듣기] 끈 뒤가 이상함: ${JSON.stringify(cd.nowText)}`);

        // 섞어 듣기 + 순서 바꾸기 + 곡 넣기
        await clk('drag-1', 'shuffle');
        const before = song(await card());
        await evaluate(ft, `document.querySelectorAll('.card[data-id="drag-1"] li.song')[0].querySelector('.handle').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))`);
        await wait(150);
        await act(ft, `(() => { const f = document.querySelector('.card[data-id="drag-1"] form.add-song'); f.elements.title.value = '마곡'; f.elements.artist.value = '밴드'; f.requestSubmit(); })()`);
        cd = await card();
        check(cd.shuffle === 'true' && cd.nowText.includes('재생 중') && cd.nowText.includes('/5)') && cd.nowSongs.length === 1, '[섞어 듣기] 섞어 듣는 중에 곡을 옮기고 새 곡을 넣어도 듣던 곡이 이어지고, 곡 수가 5로 늘어남', `[섞어 듣기] 옮기고 넣은 뒤가 이상함: ${JSON.stringify(cd.nowText)}`);
        seen = await walk();
        check(new Set(seen).size === 5 && seen.length === 5 && seen.some(n => n.includes('마곡')), `[섞어 듣기] 순서를 바꾸고 새 곡을 넣은 뒤에도 5곡이 한 번씩 모두 나오고, 새 곡(마곡)도 들어 있음: ${seen.join(' → ')}`, `[섞어 듣기] 옮긴 뒤 차례가 어긋남: ${seen.join(' → ')}`);

        // 저장하지 않음
        await ft.s('Page.reload'); await wait(800);
        rr = await report(ft); collect(rr);
        check(rr.cards.every(x => x.shuffle === 'false' && x.repeat === 'false'), '[섞기·반복] 새로 열면 두 단추는 꺼진 처음 상태 (저장하지 않음)', '[섞기·반복] 새로 열었는데 켜져 있음');
        check(!rr.errors.length, '[섞기·반복] 시험하는 동안 자바스크립트 오류 없음', '[섞기·반복] 오류: ' + rr.errors.join(' / '));
        await shoot(ft, path.join(SHOTS_DIR, `music-player-${SIZES[3].name}-${SIZES[3].w}x${SIZES[3].h}.png`), shots);
      } finally {
        await ft.close();
      }
    }

    // 5. 저장이 막힐 때
    const blockedTab = await openApp(cdp, pageUrl, 'blocked', SIZES[0]);
    try {
      let r = await evaluate(blockedTab, REPORT_JS.replace(/saved: \(\(\) => \{.*?\}\)\(\),/s, 'saved: null,'));
      check(r.cards.length === 2 && r.notice && r.notice.includes('저장'), `[저장 막힘] 저장이 막혀도 화면은 열리고 안내가 나옴: "${r.notice}"`, `[저장 막힘] 안내가 없거나 화면이 안 열림: 카드 ${r.cards.length}개, 안내 ${r.notice}`);
      await evaluate(blockedTab, `${OPEN}document.getElementById('new-name').value='막힌 곳'; document.getElementById('new-nick').value='별명'; document.getElementById('create-form').requestSubmit();`);
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
        const sameRow = r.add.card && Math.abs(r.add.tile[1] - r.add.card[1]) <= 2 && r.add.tile[2] <= r.add.card[0] + 2;
        const stacked = r.add.card && r.add.tile[3] <= r.add.card[1] + 2;
        check(sz.w >= 768 ? sameRow : stacked, `[+ 칸 ${sz.w}×${sz.h}] ${sz.w >= 768 ? '+ 칸이 플레이리스트 카드와 같은 줄에, 맨 앞에 나란히 놓임' : '좁은 폰 화면에서는 + 칸이 카드 바로 위에 놓임'}`, `[+ 칸 ${sz.w}×${sz.h}] + 칸 자리가 이상함: 칸 ${JSON.stringify(r.add.tile)}, 첫 카드 ${JSON.stringify(r.add.card)}`);
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
