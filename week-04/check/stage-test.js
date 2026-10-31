// week-04 내 게임 스테이지 시험 도구
//
// 쓰는 법 (QUEST-TRACK-2 폴더에서):
//   node week-04/check/stage-test.js
//
// 하는 일: 화면 없는 Chrome(또는 Edge)으로 week-04/index.html 을 열고,
// 게임 안의 값을 직접 바꿔 가며 아래를 차례로 시험해요. 사람이 끝까지 플레이하지 않아도 돼요.
//   1. D 키를 누르면 외계인이 오른쪽으로 가는지
//   2. 1스테이지 배터리가 3개이고, 먹을 때마다 오른쪽 위 숫자(got)가 오르는지
//   3. 다 모으면 우주선이 내려오고, 타면 2스테이지(배터리 4개, got 0)로 넘어가는지
//   4. 10스테이지(배터리 12개)를 마치면 "모든 스테이지 클리어"가 되는지
//   5. 티라노 머리를 밟으면 쓰러지고, 옆에서 닿으면 목숨이 줄어드는지
// 마지막에 "우주선이 기다리는 3스테이지" 화면 사진을 check/shots 에 찍어요.
//
// check/shots 와 check/tmp 는 커밋하지 않아요 (.gitignore).

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CHECK_DIR = __dirname;
const GAME_DIR = path.dirname(CHECK_DIR);
const SHOTS_DIR = path.join(CHECK_DIR, 'shots');
const TMP_DIR = path.join(CHECK_DIR, 'tmp');
const PROFILE_DIR = path.join(TMP_DIR, 'browser-profile');

const BROWSERS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

// 게임 스크립트 뒤에 붙여서 실행하는 시험. 게임의 let 변수(alien, rex, ship, got, stage ...)를 그대로 읽고 바꿔요.
const TEST_SCRIPT = `<script>
(function () {
  const results = [];
  const check = (name, pass, detail) => results.push({ name, pass: !!pass, detail });
  const key = (type, code) => dispatchEvent(new KeyboardEvent(type, { code }));
  const safe = () => { alien.hurt = 999; }; // 시험하는 동안 티라노에게 맞지 않게
  // 화면 없는 브라우저는 화면 갱신이 느려서, 게임을 1/60초씩 직접 돌려요.
  const step = seconds => { for (let t = 0; t < seconds; t += 1 / 60) update(1 / 60); };

  // 배터리를 하나씩 외계인 자리로 옮겨서 먹게 해요
  function collectAll() {
    while (batteries.length) {
      safe();
      batteries[0].x = alien.x + ALIEN / 2 - BATTERY / 2;
      batteries[0].y = alien.y + ALIEN / 2 - BATTERY / 2;
      step(1 / 60);
    }
  }
  // 우주선이 내려올 때까지 기다렸다가 외계인을 문 앞에 세우고, 날아갈 때까지 돌려요
  function boardShip(fromStage) {
    for (let i = 0; i < 600 && ship.state !== 'waiting'; i++) step(1 / 60);
    const landed = ship.state === 'waiting';
    safe();
    alien.x = ship.x + SHIP_W / 2 - ALIEN / 2;
    alien.y = GROUND_Y - ALIEN;
    for (let i = 0; i < 600 && stage === fromStage && !allClear; i++) step(1 / 60);
    return landed;
  }

  // 1. A·D 키
  safe();
  const x0 = alien.x;
  key('keydown', 'KeyD'); step(0.3); key('keyup', 'KeyD');
  check('D 키로 오른쪽 이동', alien.x > x0 + 20, Math.round(x0) + ' → ' + Math.round(alien.x));
  const x1 = alien.x;
  key('keydown', 'KeyA'); step(0.2); key('keyup', 'KeyA');
  check('A 키로 왼쪽 이동', alien.x < x1 - 10, Math.round(x1) + ' → ' + Math.round(alien.x));
  check('외계인이 티라노만큼 커짐', ALIEN === 48, '외계인 ' + ALIEN + 'px, 티라노 몸통 약 44px');

  // 2. 1스테이지 배터리
  check('1스테이지 배터리 3개', stage === 1 && batteries.length === 3, '화면에 ' + batteries.length + '개');
  safe();
  batteries[0].x = alien.x + ALIEN / 2 - BATTERY / 2; batteries[0].y = alien.y + ALIEN / 2 - BATTERY / 2;
  step(1 / 60);
  check('배터리를 먹으면 오른쪽 위 숫자가 1 오름', got === 1, got + '/' + batteriesFor(stage));

  // 3. 우주선 타고 2스테이지
  collectAll();
  step(1 / 60);
  check('3개 다 모으면 우주선이 옴', ship.state !== 'hidden', 'ship=' + ship.state);
  check('우주선이 바닥에 내려와 기다림', boardShip(1), '');
  check('우주선을 타면 2스테이지로', stage === 2, 'stage=' + stage);
  check('2스테이지 배터리 4개, 숫자는 0 부터', batteries.length === 4 && got === 0, '화면에 ' + batteries.length + '개, ' + got + '/' + batteriesFor(stage));

  // 4. 마지막 스테이지
  startStage(10);
  check('10스테이지 배터리 12개', batteries.length === 12, '화면에 ' + batteries.length + '개 (마지막 스테이지 ' + LAST_STAGE + ')');
  collectAll();
  step(1 / 60);
  boardShip(10);
  check('10스테이지를 마치면 모든 스테이지 클리어', allClear, 'allClear=' + allClear);

  // 5. 티라노
  resetGame();
  rex = newRex(300); rex.dir = 1;
  alien.hurt = 0;
  alien.x = rex.x + 40 - ALIEN / 2; alien.y = rex.y + 20 - ALIEN - 4; alien.vy = 200;
  step(0.1);
  check('티라노 머리를 밟으면 쓰러짐', rex.state === 'hit' || rex.state === 'death', 'rex=' + rex.state);
  resetGame();
  rex = newRex(300); rex.dir = -1;
  alien.hurt = 0;
  alien.x = rex.x + 30; alien.y = GROUND_Y - ALIEN; alien.vy = 0;
  step(0.05);
  check('티라노에게 옆으로 닿으면 목숨 -1', lives === LIVES - 1, '목숨 ' + LIVES + ' → ' + lives);
  resetGame();
  rex = newRex(300); rex.dir = -1; alien.x = 0; safe();
  step(1);
  check('티라노가 1초에 90px 감 (이전 50px)', Math.abs(300 - rex.x - 90) < 3, Math.round(300 - rex.x) + 'px');

  // 사진용: 3스테이지, 배터리 다 모음, 우주선 기다리는 중
  startStage(3);
  collectAll();
  for (let i = 0; i < 600 && ship.state !== 'waiting'; i++) step(1 / 60);
  alien.hurt = 0;
  rex.x = 250;

  const pre = document.createElement('pre');
  pre.id = '__stage';
  pre.style.display = 'none';
  pre.textContent = JSON.stringify(results);
  document.body.appendChild(pre);
})();
</script>`;

function pathToFileUrl(p) {
  return 'file:///' + path.resolve(p).replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/').replace('%3A', ':');
}

function runBrowser(browser, args) {
  return execFileSync(browser, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--mute-audio',
    `--user-data-dir=${PROFILE_DIR}`,
    '--virtual-time-budget=3000',
    '--window-size=1280,720',
    ...args,
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 120000 });
}

function main() {
  const browser = BROWSERS.find(b => fs.existsSync(b));
  if (!browser) { console.log('Chrome 이나 Edge 를 찾지 못했어요.'); process.exit(1); }
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });

  const html = fs.readFileSync(path.join(GAME_DIR, 'index.html'), 'utf8');
  const base = `<base href="${pathToFileUrl(GAME_DIR)}/">`;
  const page = html.replace(/<head[^>]*>/i, m => m + base).replace(/<\/body>/i, TEST_SCRIPT + '</body>');
  const file = path.join(TMP_DIR, 'my-game-stage-test.html');
  fs.writeFileSync(file, page);

  const dom = runBrowser(browser, ['--dump-dom', pathToFileUrl(file)]);
  const m = dom.match(/<pre id="__stage"[^>]*>([\s\S]*?)<\/pre>/);
  const shot = path.join(SHOTS_DIR, 'my-game-stage3-ship.png');
  runBrowser(browser, [`--screenshot=${shot}`, pathToFileUrl(file)]);

  console.log('\n=== 스테이지 시험 (week-04\\index.html) ===');
  if (!m) { console.log('결과를 읽지 못했어요. 시간이 모자랐거나 게임이 멈췄을 수 있어요.'); process.exit(1); }
  const text = m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  const results = JSON.parse(text);
  for (const r of results) console.log(`${r.pass ? '[통과]' : '[실패]'} ${r.name}${r.detail ? ' (' + r.detail + ')' : ''}`);
  console.log('사진: ' + path.relative(path.dirname(GAME_DIR), shot));
  console.log('');
  process.exit(results.every(r => r.pass) ? 0 : 1);
}

main();
