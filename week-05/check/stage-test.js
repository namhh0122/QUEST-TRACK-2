// week-05 내 게임 시험 도구 (외계인과 티라노)
//
// 쓰는 법 (QUEST-TRACK-2 폴더에서):
//   node week-05/check/stage-test.js
//
// 하는 일: 화면 없는 Chrome(또는 Edge)으로 week-05/index.html 을 열고,
// 게임 안의 값을 직접 바꿔 가며 아래를 차례로 시험해요. 사람이 끝까지 플레이하지 않아도 돼요.
//   1. A·D 이동, 크기, 목숨 5개, 배터리·떠 있는 땅·스테이지가 없는지
//   2. Q 구르기: 빨리 움직이고, 구르는 동안 안 맞고, 끝나자마자 또 구를 수 있는지
//   3. 마우스 왼쪽 클릭 = 칼: 가로 베기·올려 베기를 번갈아 쓰고, 티라노 체력이 줄어드는지
//   4. 티라노 공격 3가지(할퀴기·불 뿜기·돌진): 예고("!") 동안은 안 맞고, 공격이 오면 목숨이 줄어드는지
//   5. 체력 절반 → 하늘로(땅이 사라지고 우주선) → 5번 피하면 반격하기 버튼 → 반격하면 체력 5분의 1 깎이고 땅으로
//   6. 체력 0 → 티라노를 물리쳤어요
//   7. 타격감: 맞히면 살짝, 맞으면 크게, 반격은 더 크게 흔들리고 번쩍이는지
// 사진 네 장을 check/shots 에 찍어요: 땅에서 칼 휘두르기(#ground), 하늘에서 불꽃 피하기(#sky), 돌진 빨간 예고(#warn), 맞아서 번쩍(#hit)
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

// 게임 스크립트 뒤에 붙여서 실행하는 시험. 게임의 let 변수(alien, rex, ship, phase, dodged ...)를 그대로 읽고 바꿔요.
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
  // 외계인을 티라노 바로 앞에 세우고 티라노 쪽을 클릭해서 한 번 베요
  function slashRex() {
    alien.x = rex.x + 18 * REX_SIZE - ALIEN - 10; alien.y = GROUND_Y - ALIEN; alien.hurt = 999;
    alien.swingWait = 0;
    click(rex.x + REX_W / 2, GROUND_Y - 30);
    step(0.3);
  }

  // 1. 이동·크기·없앤 것
  fresh();
  const x0 = alien.x;
  key('keydown', 'KeyD'); step(0.3); key('keyup', 'KeyD');
  check('D 키로 오른쪽 이동', alien.x > x0 + 20, Math.round(x0) + ' → ' + Math.round(alien.x));
  const x1 = alien.x;
  key('keydown', 'KeyA'); step(0.2); key('keyup', 'KeyA');
  check('A 키로 왼쪽 이동', alien.x < x1 - 10, Math.round(x1) + ' → ' + Math.round(alien.x));
  const ab = alienBox(), rb = rexBox();
  check('외계인 48px, 티라노 몸통은 외계인의 2배', ALIEN === 48 && Math.abs(rb.h / ab.h - 2) < 0.1, '외계인 몸통 ' + ab.w + '×' + ab.h + ', 티라노 몸통 ' + rb.w + '×' + rb.h);
  check('목숨 5개', LIVES === 5 && lives === 5, '목숨 ' + lives);
  check('배터리·떠 있는 땅·스테이지가 없음', typeof batteries === 'undefined' && typeof PLATFORMS === 'undefined' && typeof startStage === 'undefined', '');
  check('티라노 체력이 많아짐', REX_HP === 100 && rex.hp === 100, '체력 ' + rex.hp + ' (칼 한 번에 ' + SWORD_DAMAGE + ')');

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
  fireballs.push({ x: alien.x + ALIEN / 2, y: GROUND_Y - 20, vx: 0, vy: 0, floor: GROUND_Y - 20, time: 0 });
  step(0.1);
  check('구르는 동안은 불꽃에 안 맞음', lives === LIVES, '목숨 ' + lives);

  // 3. 칼
  fresh();
  const hp0 = rex.hp;
  slashRex();
  check('클릭하면 칼로 베어서 티라노 체력 -2', rex.hp === hp0 - SWORD_DAMAGE, '체력 ' + hp0 + ' → ' + rex.hp);
  const types = [];
  fresh();
  for (let i = 0; i < 3; i++) { alien.swingWait = 0; click(rex.x, GROUND_Y - 30); types.push(alien.slash && alien.slash.type); step(0.35); }
  check('가로 베기·올려 베기를 번갈아 씀', types.join(',') === 'h,u,h', types.join(' → ') + ' (h 가로, u 올려)');
  fresh();
  alien.x = 40;
  click(rex.x + REX_W / 2, GROUND_Y - 30);
  step(0.3);
  check('멀리서 휘두르면 안 닿음', rex.hp === REX_HP, '체력 ' + rex.hp);

  // 4. 티라노 공격 세 가지
  function attackTest(kind, alienX) {
    fresh();
    rex.x = 300; rex.dir = -1;
    alien.x = alienX;
    rex.attack = kind; rex.wait = ATTACKS[kind].windup; rex.state = 'windup'; rex.time = 0;
    step(ATTACKS[kind].windup - 0.05);
    const safeInWindup = lives === LIVES;
    let boomed = false;
    for (let i = 0; i < 120; i++) { step(1 / 60); if (booms.length) boomed = true; }
    return { safeInWindup, hit: lives < LIVES, boomed };
  }
  const claw = attackTest('claw', 300 - 40);
  check('할퀴기: 예고 동안은 안 맞고, 앞에 있으면 목숨 -1', claw.safeInWindup && claw.hit, '예고 ' + ATTACKS.claw.windup + '초');
  const fire = attackTest('fire', 60);
  check('불 뿜기: 예고 동안은 안 맞고, 불꽃에 목숨 -1', fire.safeInWindup && fire.hit, '예고 ' + ATTACKS.fire.windup + '초');
  check('불꽃에 맞으면 터지는 그림이 나옴', fire.boomed, '');
  const charge = attackTest('charge', 60);
  check('돌진: 예고 동안은 안 맞고, 달려와서 목숨 -1', charge.safeInWindup && charge.hit, '예고 ' + ATTACKS.charge.windup + '초');
  // 공격 예고: 준비하는 동안 빨간 표시가 있고, 표시 안에 서 있으면 실제로 맞아요
  for (const [kind, alienX] of [['claw', 300 - 40], ['fire', 60], ['charge', 60]]) {
    fresh();
    rex.x = 300; rex.dir = -1; alien.x = alienX;
    rex.attack = kind; rex.wait = ATTACKS[kind].windup; rex.state = 'windup'; rex.time = 0;
    const areas = warningAreas();
    const inside = areas.some(a => overlap(alienBox(), a));
    step(ATTACKS[kind].windup + 0.02);
    const gone = warningAreas().length === 0;
    step(2);
    check('빨간 예고 표시: ' + kind + ' (준비 중에만 보이고, 그 안에 있으면 맞음)', areas.length > 0 && inside && gone && lives < LIVES, '표시 ' + areas.length + '개, 외계인이 표시 안 ' + inside + ', 목숨 ' + lives);
  }
  fresh();
  rex.x = 300; rex.dir = -1; alien.x = 300 - 40;
  rex.attack = 'claw'; rex.wait = ATTACKS.claw.windup; rex.state = 'windup';
  alien.x = 40;
  check('할퀴기 예고 표시 밖에 있으면 안 맞음', !warningAreas().some(a => overlap(alienBox(), a)) && (step(1), lives === LIVES), '목숨 ' + lives);
  fresh();
  rex.x = 300; rex.state = 'walk'; rex.think = 999;
  alien.x = rex.x + REX_W / 2 - ALIEN / 2;
  step(1);
  check('걷거나 서 있는 티라노 몸에 닿으면 안 맞음', lives === LIVES, '목숨 ' + lives);

  // 5. 하늘 싸움
  fresh();
  rex.hp = REX_HP / 2 + SWORD_DAMAGE;
  slashRex();
  check('체력이 절반이 되면 하늘로 올라감', phase === 'rising' && alien.aboard, 'phase=' + phase + ', 체력 ' + rex.hp);
  step(RISE_TIME + 0.1);
  check('땅이 사라지고 우주선을 탐', phase === 'sky' && groundShift() > H - GROUND_Y && alien.aboard, 'phase=' + phase);
  alien.hurt = 0;
  // 한 번은 일부러 맞아 봐요: 피한 횟수가 안 오르고 목숨만 줄어야 해요
  const livesSky = lives;
  for (let i = 0; i < 600 && fireballs.length === 0; i++) step(1 / 60);
  for (let i = 0; i < 600 && fireballs.length; i++) { ship.x = Math.max(0, Math.min(W - SHIP_W, fireballs[0].x - SHIP_W / 2)); step(1 / 60); }
  for (let i = 0; i < 60; i++) step(1 / 60);
  check('하늘에서 불꽃에 맞으면 목숨 -1, 피한 횟수는 그대로', lives === livesSky - 1 && dodged === 0, '목숨 ' + livesSky + ' → ' + lives + ', 피함 ' + dodged);
  // 이제 계속 피해요: 불꽃이 날아오면 우주선을 불꽃에서 먼 쪽 끝으로 옮겨요
  for (let i = 0; i < 6000 && !counterReady; i++) {
    if (fireballs.length) {
      const fx = fireballs.reduce((s, f) => s + f.x, 0) / fireballs.length;
      ship.x = fx > W / 2 ? 0 : W - SHIP_W;
    }
    step(1 / 60);
  }
  check('불꽃을 5번 피하면 반격하기 버튼이 뜸', counterReady && dodged === 5, '피함 ' + dodged + '/' + DODGE_GOAL);
  const hpBefore = rex.hp;
  click(COUNTER_BUTTON.x + COUNTER_BUTTON.w / 2, COUNTER_BUTTON.y + COUNTER_BUTTON.h / 2);
  check('반격하기 버튼을 누르면 반격', phase === 'counter', 'phase=' + phase);
  step(COUNTER_TIME + 0.05);
  check('반격하면 티라노 체력이 5분의 1(20) 깎임', rex.hp === hpBefore - COUNTER_DAMAGE, '체력 ' + hpBefore + ' → ' + rex.hp);
  step(RISE_TIME + 0.1);
  check('반격 뒤 다시 땅으로 내려와 싸움', phase === 'ground' && !alien.aboard && groundShift() === 0 && Math.abs(alien.y + ALIEN - GROUND_Y) < 1, 'phase=' + phase);
  rex.hp = REX_HP / 2 - 2; freezeRex();
  slashRex();
  check('하늘 싸움은 한 번만', phase === 'ground', 'phase=' + phase);

  // 6. 이기기
  fresh();
  rex.hp = SWORD_DAMAGE; skyDone = true;
  slashRex();
  step(2.5);
  check('체력이 0 이 되면 "티라노를 물리쳤어요"', win, 'win=' + win);

  // 7. 타격감: 맞히거나 맞으면 화면이 흔들리고 번쩍여요
  // slashRex 는 0.3초를 돌려서 흔들림이 이미 끝나 있어요. 그래서 칼이 닿는 순간을 1/60초씩 봐요.
  fresh();
  alien.x = rex.x + 18 * REX_SIZE - ALIEN - 10; alien.hurt = 999; alien.swingWait = 0;
  click(rex.x + REX_W / 2, GROUND_Y - 30);
  let felt = false;
  for (let i = 0; i < 15 && !felt; i++) { step(1 / 60); felt = shakeTime > 0 && flashTime > 0; }
  check('칼로 맞히면 화면이 살짝 흔들리고 하얗게 번쩍', felt && shakePower === 3 && flashColor.startsWith('rgba(255, 255, 255'), '흔들림 ' + shakePower + 'px');
  step(0.5);
  check('흔들림·번쩍임은 잠깐 뒤 멈춤', shakeTime <= 0 && flashTime <= 0, '');
  fresh();
  rex.x = 300; rex.dir = -1; alien.x = 300 - 40;
  rex.attack = 'claw'; rex.wait = 0.01; rex.state = 'windup';
  felt = false;
  for (let i = 0; i < 40 && !felt; i++) { step(1 / 60); felt = lives < LIVES; }
  check('맞으면 화면이 크게 흔들리고 빨갛게 번쩍', felt && shakeTime > 0 && shakePower === 5 && flashColor.startsWith('rgba(255, 40, 40'), '흔들림 ' + shakePower + 'px, 목숨 ' + lives);
  fresh();
  rex.hp = REX_HP / 2; startRising(); step(RISE_TIME + 0.1);
  counterReady = true; startCounter();
  felt = false;
  for (let i = 0; i < 60 && !felt; i++) { step(1 / 60); felt = counterHit; }
  check('반격하면 더 크게 흔들림', felt && shakePower === 7 && shakeTime > 0, '흔들림 ' + shakePower + 'px');
  fresh();
  alien.x = 40; alien.swingWait = 0;
  shakeTime = flashTime = 0;
  click(rex.x + REX_W / 2, GROUND_Y - 30);
  step(0.3);
  check('헛손질(안 맞힘)이면 안 흔들림', shakeTime <= 0 && flashTime <= 0, '');

  // 사진용 장면. 주소 뒤 #ground / #sky / #warn / #hit 으로 골라요. 사진 찍을 때까지 그대로 있게 게임을 멈춰요.
  resetGame();
  if (location.hash === '#sky') {
    rex.hp = 50; startRising(); step(RISE_TIME + 0.1);
    dodged = 3; lives = 4;
    ship.x = 120;
    rex.state = 'fire';
    fireballs.push({ x: 300, y: 200, vx: -120, vy: 200, floor: Infinity, time: 0 });
    fireballs.push({ x: 380, y: 160, vx: 0, vy: 230, floor: Infinity, time: 0.2 });
    fireballs.push({ x: 460, y: 200, vx: 120, vy: 200, floor: Infinity, time: 0.1 });
  } else if (location.hash === '#hit') {
    rex.x = 300; rex.dir = -1; rex.state = 'idle'; rex.wait = 999;
    alien.x = 300 - 40;
    hurtAlien(rex.x + REX_W / 2);
    flashTime = flashLength * 0.8; // 번쩍임이 보이는 순간에서 멈춰요
  } else if (location.hash === '#warn') {
    rex.x = 380; rex.dir = -1;
    rex.attack = 'charge'; rex.state = 'windup'; rex.wait = 999;
    alien.x = 140;
  } else {
    rex.hp = 76; rex.x = 360; rex.dir = -1; rex.state = 'idle'; rex.wait = 999;
    alien.x = rex.x + 18 * REX_SIZE - ALIEN - 10; aimX = rex.x + 100; aimY = 260;
    alien.flip = false;
    alien.slash = { type: 'h', time: 0.12, dir: 1, hit: true };
    booms.push({ x: 120, y: GROUND_Y - 20, time: 0.1 });
  }
  update = function () {};

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
  const shots = [];
  for (const scene of ['ground', 'sky', 'warn', 'hit']) {
    const shot = path.join(SHOTS_DIR, `my-game-${scene}.png`);
    runBrowser(browser, [`--screenshot=${shot}`, pathToFileUrl(file) + '#' + scene]);
    shots.push(shot);
  }

  console.log('\n=== 게임 시험 (week-05\\index.html) ===');
  if (!m) { console.log('결과를 읽지 못했어요. 시간이 모자랐거나 게임이 멈췄을 수 있어요.'); process.exit(1); }
  const text = m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  const results = JSON.parse(text);
  for (const r of results) console.log(`${r.pass ? '[통과]' : '[실패]'} ${r.name}${r.detail ? ' (' + r.detail + ')' : ''}`);
  for (const shot of shots) console.log('사진: ' + path.relative(path.dirname(GAME_DIR), shot));
  console.log('');
  process.exit(results.every(r => r.pass) ? 0 : 1);
}

main();
