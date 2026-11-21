// 화면 없는 Chrome(또는 Edge)을 켜고 DevTools 로 조종하는 도우미.
// check.js 와 icons/make-icons.js 가 같이 써요. 새로 설치할 것은 없어요 (Node.js 22 이상).

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PROFILE_DIR = path.join(__dirname, 'tmp', 'browser-profile');

const BROWSERS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

const wait = ms => new Promise(r => setTimeout(r, ms));

function findBrowser() {
  return BROWSERS.find(b => fs.existsSync(b));
}

// Chrome 을 켜고 DevTools 에 연결해요. { cdp, browser, close } 를 돌려줘요.
async function launch() {
  const browser = findBrowser();
  if (!browser) throw new Error('Chrome 이나 Edge 를 찾지 못했어요.');
  if (typeof WebSocket === 'undefined') throw new Error('이 Node.js 에는 WebSocket 이 없어요. Node.js 22 이상이 필요해요.');
  fs.mkdirSync(PROFILE_DIR, { recursive: true });
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
  let url = null;
  for (let i = 0; i < 100 && !url; i++) {
    if (fs.existsSync(portFile)) {
      const [port, wsPath] = fs.readFileSync(portFile, 'utf8').trim().split('\n');
      if (wsPath) url = `ws://127.0.0.1:${port}${wsPath}`;
    }
    if (!url) await wait(100);
  }
  if (!url) { proc.kill(); throw new Error('Chrome 이 DevTools 연결을 열지 않았어요.'); }
  const cdp = await connect(url);
  return { cdp, browser, close() { cdp.close(); proc.kill(); } };
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

// 새 탭을 열어요. s(명령, 값) 으로 그 탭에 명령을 보내고, close() 로 닫아요.
async function openTab(cdp) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  return {
    s: (m, p) => cdp.send(m, p, sessionId),
    close: () => cdp.send('Target.closeTarget', { targetId }).catch(() => {}),
  };
}

// 페이지 안에서 식을 계산해서 값을 돌려줘요 (Promise 면 끝날 때까지 기다려요).
async function evaluate(tab, expression) {
  const { result, exceptionDetails } = await tab.s('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (exceptionDetails) throw new Error(exceptionDetails.exception ? exceptionDetails.exception.description : exceptionDetails.text);
  return result.value;
}

function pathToFileUrl(p) {
  return 'file:///' + path.resolve(p).replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/').replace('%3A', ':');
}

module.exports = { launch, openTab, evaluate, wait, pathToFileUrl };
