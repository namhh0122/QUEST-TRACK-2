// week-06 앱 아이콘 만들기
//
// 쓰는 법 (QUEST-TRACK-2 폴더에서):
//   node week-06/icons/make-icons.js
//
// 아래 그림(SVG: 파란 하늘, 해, 흰 구름)을 화면 없는 Chrome 으로 그려서 PNG 로 저장해요.
//   icon-192.png, icon-512.png   : 보통 아이콘
//   icon-maskable-512.png        : 폰이 동그랗게·둥근 네모로 잘라도 그림이 남도록 가운데로 모은 아이콘
//   apple-touch-icon.png (180)   : 아이폰 홈 화면용
// 그림을 바꾸고 싶으면 iconSvg 를 고치고 다시 돌리면 돼요.

const fs = require('fs');
const path = require('path');
const { launch, openTab, wait } = require('../check/browser');

const OUT_DIR = __dirname;

// scale: 가운데 그림 크기 (1 = 보통, 작을수록 가운데로 모임)
function iconSvg(scale) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#4a7fc1"/>
      <stop offset="1" stop-color="#24476e"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" fill="url(#sky)"/>
  <g transform="translate(50 50) scale(${scale}) translate(-53 -55)">
    <circle cx="62" cy="38" r="17" fill="#ffd34d"/>
    <g fill="#ffffff">
      <circle cx="40" cy="60" r="14"/>
      <circle cx="55" cy="53" r="19"/>
      <circle cx="72" cy="63" r="12"/>
      <rect x="23" y="60" width="61" height="15" rx="7.5"/>
    </g>
  </g>
</svg>`;
}

const ICONS = [
  { file: 'icon-192.png', size: 192, scale: 1 },
  { file: 'icon-512.png', size: 512, scale: 1 },
  { file: 'icon-maskable-512.png', size: 512, scale: 0.72 },
  { file: 'apple-touch-icon.png', size: 180, scale: 0.9 },
];

async function main() {
  const { cdp, close } = await launch();
  try {
    for (const icon of ICONS) {
      const tab = await openTab(cdp);
      await tab.s('Emulation.setDeviceMetricsOverride', { width: icon.size, height: icon.size, deviceScaleFactor: 1, mobile: false });
      const html = `<!doctype html><html><body style="margin:0;overflow:hidden">${iconSvg(icon.scale)}</body></html>`;
      await tab.s('Page.navigate', { url: 'data:text/html;base64,' + Buffer.from(html).toString('base64') });
      await wait(300);
      const { data } = await tab.s('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(OUT_DIR, icon.file), Buffer.from(data, 'base64'));
      console.log(`만듦: week-06/icons/${icon.file} (${icon.size}×${icon.size})`);
      await tab.close();
    }
  } finally {
    close();
  }
}

main().catch(e => { console.log('아이콘을 만들지 못했어요: ' + e.message); process.exit(1); });
