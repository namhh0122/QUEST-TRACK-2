// 평택시 날씨 앱의 서비스 워커
// - 앱 화면(index.html, manifest, 아이콘)을 폰에 저장해 둬서 인터넷이 끊겨도 앱이 열리게 해요.
// - 날씨 정보(Open-Meteo)는 여기서 건드리지 않아요. 마지막 날씨는 index.html 이 따로 저장해요.
// - 앱 파일을 바꾸면 아래 CACHE 이름의 숫자를 올려 주세요. 그래야 폰에 새 파일이 들어가요.

const CACHE = 'week06-weather-v1';
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('week06-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  // 다른 사이트(날씨 API)로 가는 요청과 GET 이 아닌 요청은 그대로 보내요.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // 앱 화면: 먼저 인터넷에서 새것을 받고, 안 되면 저장해 둔 것을 보여 줘요.
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); }
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 아이콘 같은 나머지 파일: 저장해 둔 것이 있으면 그것을 써요.
  event.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});
