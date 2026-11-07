// week-05 내 게임 시험 도구 (외계인과 티라노)
//
// 쓰는 법 (QUEST-TRACK-2 폴더에서):
//   node week-05/check/stage-test.js
//
// 하는 일: 화면 없는 Chrome(또는 Edge)으로 week-05/index.html 을 열고,
// 게임 안의 값을 직접 바꿔 가며 아래를 차례로 시험해요. 사람이 끝까지 플레이하지 않아도 돼요.
//   1. A·D 이동, 크기 (외계인 48px, 티라노 몸통은 외계인의 2배), 배터리·떠 있는 땅이 없는지
//   2. Q 구르기: 빨리 움직이고, 구르는 동안 안 맞고, 끝나자마자 또 구를 수 있는지
//   3. 마우스 왼쪽 클릭: 총알이 마우스 쪽으로 나가서 티라노 체력이 줄어드는지
//   4. 티라노 공격 3가지(할퀴기·불 뿜기·돌진): 예고("!") 동안은 안 맞고, 공격이 오면 목숨이 줄어드는지
//   5. 티라노를 쓰러뜨리면 우주선 → 2스테이지, 10스테이지를 마치면 "모든 스테이지 클리어"
// 마지막에 "티라노가 불 뿜기를 준비하는" 화면 사진을 check/shots 에 찍어요.
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

// 게임 스크립트 뒤에 붙여서 실행하는 시험. 게임의 let 변수(alien, rex, ship, bullets, stage ...)를 그대로 읽고 바꿔요.
const TEST_SCRIPT = `<script>
(function () {
  const results = [];
  const check = (name, pass, detail) => results.push({ name, pass: !!pass, detail });
  const key = (type, code) => dispatchEvent(new KeyboardEvent(type, { code }));
  // 게임 세상 좌표 (wx, wy) 를 눌렀다고 치고 마우스 왼쪽 클릭을 보내요
  function click(wx, wy) {
    const r = canvas.getBoundingClientRect();
    dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientX: r.left + wx / W * r.width, clientY: r.top + wy / H * r.height }));
  }
  const freezeRex = () => { rex.state = 'idle'; rex.wait = 999; }; // 시험하는 동안 티라노를 세워 둬요
  // 화면 없는 브라우저는 화면 갱신이 느려서, 게임을 1/60초씩 직접 돌려요.
  const step = seconds => { for (let t = 0; t < seconds; t += 1 / 60) update(1 / 60); };
  function fresh() { resetGame(); freezeRex(); alien.hurt = 0; }

  // 1. 이동·크기·없앤 것
  fresh();
  const x0 = alien.x;
  key('keydown', 'KeyD'); step(0.3); key('keyup', 'KeyD');
  check('D 키로 오른쪽 이동', alien.x > x0 + 20, Math.round(x0) + ' → ' + Math.round(alien.x));
  const x1 = alien.x;
  key('keydown', 'KeyA'); step(0.2); key('keyup', 'KeyA');
  check('A 키로 왼쪽 이동', alien.x < x1 - 10, Math.round(x1) + ' → ' + Math.round(alien.x));
  check('외계인은 원래(24px)의 2배', ALIEN === 48, ALIEN + 'px');
  const ab = alienBox(), rb = rexBox();
  check('티라노 몸통은 외계인의 2배', Math.abs(rb.h / ab.h - 2) < 0.1 && Math.abs(rb.w / ab.w - 2.5) < 0.6, '외계인 몸통 ' + ab.w + '×' + ab.h + ', 티라노 몸통 ' + rb.w + '×' + rb.h);
  check('배터리와 떠 있는 땅이 없음', typeof batteries === 'undefined' && typeof PLATFORMS === 'undefined', '');

  // 2. 구르기
  fresh();
  alien.x = 40; alien.flip = false;
  key('keydown', 'KeyQ'); key('keyup', 'KeyQ');
  const rolling = alien.roll > 0;
  step(ROLL_TIME + 0.02);
  check('Q 를 누르면 앞으로 구름', rolling && alien.x > 140, '40 → ' + Math.round(alien.x));
  key('keydown', 'KeyQ'); key('keyup', 'KeyQ');
  check('구르기가 끝나자마자 또 구를 수 있음 (쿨타임 없음)', alien.roll > 0, '');
  fresh();
  alien.x = 300;
  key('keydown', 'KeyQ'); key('keyup', 'KeyQ');
  fireballs.push({ x: alien.x + ALIEN / 2, y: GROUND_Y - 22, vx: 0, time: 0 });
  step(0.1);
  check('구르는 동안은 불덩이에 안 맞음', lives === LIVES, '목숨 ' + lives);

  // 3. 총
  fresh();
  alien.x = 40;
  const hp0 = rex.hp;
  click(rex.x + REX_W / 2, rex.y + REX_H * 0.6);
  const flying = bullets.length === 1 && bullets[0].vx > 0;
  check('왼쪽 클릭하면 마우스 쪽으로 총알이 나감', flying, '총알 ' + bullets.length + '개');
  step(1);
  check('총알이 티라노에 맞으면 체력 -1', rex.hp === hp0 - 1, '체력 ' + hp0 + ' → ' + rex.hp);

  // 4. 티라노 공격 세 가지
  function attackTest(kind, alienX) {
    fresh();
    rex.x = 300; rex.dir = -1;
    alien.x = alienX;
    rex.attack = kind; rex.wait = ATTACKS[kind].windup; rex.state = 'windup'; rex.time = 0;
    step(ATTACKS[kind].windup - 0.05);
    const safeInWindup = lives === LIVES;
    step(2);
    return { safeInWindup, hit: lives < LIVES };
  }
  const claw = attackTest('claw', 300 - 40);
  check('할퀴기: 예고 동안은 안 맞음', claw.safeInWindup, '예고 ' + ATTACKS.claw.windup + '초');
  check('할퀴기: 앞에 있으면 목숨 -1', claw.hit, '');
  const fire = attackTest('fire', 60);
  check('불 뿜기: 예고 동안은 안 맞음', fire.safeInWindup, '예고 ' + ATTACKS.fire.windup + '초');
  check('불 뿜기: 멀리 있어도 불덩이에 목숨 -1', fire.hit, '');
  const charge = attackTest('charge', 60);
  check('돌진: 예고 동안은 안 맞음', charge.safeInWindup, '예고 ' + ATTACKS.charge.windup + '초');
  check('돌진: 달려와서 목숨 -1', charge.hit, '');
  fresh();
  rex.x = 300; rex.state = 'walk'; rex.think = 0.01; alien.x = 40; alien.hurt = 999;
  const seen = new Set();
  for (let i = 0; i < 40; i++) { rex.state = 'walk'; rex.think = 0.01; step(1 / 60); seen.add(rex.attack); alien.x = i % 2 ? 40 : rex.x - 30; }
  check('티라노가 세 가지 공격을 골라 씀', seen.has('claw') && seen.has('fire') && seen.has('charge'), [...seen].join(', '));

  // 5. 스테이지
  fresh();
  rex.hp = 1;
  click(rex.x + REX_W / 2, rex.y + REX_H * 0.6);
  step(1.1); // 총알이 티라노까지 날아가는 시간
  check('체력이 0 이 되면 티라노가 쓰러짐', rex.state === 'hit' || rex.state === 'death', 'rex=' + rex.state);
  for (let i = 0; i < 600 && ship.state !== 'waiting'; i++) step(1 / 60);
  check('쓰러지면 우주선이 내려와 기다림', ship.state === 'waiting', 'ship=' + ship.state);
  alien.hurt = 999;
  alien.x = ship.x + SHIP_W / 2 - ALIEN / 2;
  for (let i = 0; i < 600 && stage === 1; i++) step(1 / 60);
  check('우주선을 타면 2스테이지, 티라노 체력이 늘어남', stage === 2 && rex.maxHp > rexHpFor(1), 'stage=' + stage + ', 체력 ' + rexHpFor(1) + ' → ' + rex.maxHp);
  startStage(LAST_STAGE); freezeRex(); rex.hp = 0; rex.state = 'gone';
  for (let i = 0; i < 600 && ship.state !== 'waiting'; i++) step(1 / 60);
  alien.hurt = 999; alien.x = ship.x + SHIP_W / 2 - ALIEN / 2;
  for (let i = 0; i < 600 && !allClear; i++) step(1 / 60);
  check('10스테이지를 마치면 모든 스테이지 클리어', allClear, 'allClear=' + allClear);

  // 사진용: 3스테이지, 티라노가 불 뿜기를 준비하는 중 (사진 찍을 때까지 그대로 있게 길게)
  resetGame();
  startStage(3);
  rex.x = 380; rex.dir = -1; rex.hp = Math.round(rex.maxHp * 0.6);
  rex.attack = 'fire'; rex.state = 'windup'; rex.wait = 999;
  alien.x = 120; alien.hurt = 0;
  aimX = rex.x + REX_W / 2; aimY = rex.y + 60;
  bullets.push({ x: 230, y: 250, vx: 0, vy: 0 });

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
  const shot = path.join(SHOTS_DIR, 'my-game-stage3-fire.png');
  runBrowser(browser, [`--screenshot=${shot}`, pathToFileUrl(file)]);

  console.log('\n=== 게임 시험 (week-05\\index.html) ===');
  if (!m) { console.log('결과를 읽지 못했어요. 시간이 모자랐거나 게임이 멈췄을 수 있어요.'); process.exit(1); }
  const text = m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  const results = JSON.parse(text);
  for (const r of results) console.log(`${r.pass ? '[통과]' : '[실패]'} ${r.name}${r.detail ? ' (' + r.detail + ')' : ''}`);
  console.log('사진: ' + path.relative(path.dirname(GAME_DIR), shot));
  console.log('');
  process.exit(results.every(r => r.pass) ? 0 : 1);
}

main();
