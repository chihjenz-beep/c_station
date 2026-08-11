// =====================================================================
// 平安長照醫療體系排班系統 — Service Worker
// 只負責快取「網頁殼」本身（schedule.html + manifest + icon），
// 讓使用者離線或訊號不穩時也能打開App。
//
// 重要：完全不攔截跨網域的GAS請求（script.google.com）。
// 這個系統的真實資料存取（讀寫排班/請假等）都是即時打GAS API，
// 攔截快取這些請求會造成資料不同步、甚至寫入失敗卻誤以為成功的風險。
// 離線時的資料readonly能力，交給schedule.html原本就有的
// 「localStorage本機優先」機制處理，Service Worker不介入資料層。
//
// 每次修改 schedule.html 內容後，記得把下面的 CACHE_NAME 版本號往上加一碼，
// 否則使用者裝置上快取的舊版APP殼可能不會即時更新。
// =====================================================================

const CACHE_NAME = 'pingan-schedule-v2';
const APP_SHELL = [
  './schedule.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting(); // 新版SW安裝完立即接手，不用等使用者關掉所有分頁
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  // 只處理「同網域 + GET」的請求（頁面本身/manifest/icon）；
  // 跨網域的GAS請求（讀寫排班資料）完全不攔截，交給瀏覽器正常處理
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) {
    return;
  }
  event.respondWith(
    // cache:'no-store' → 繞過瀏覽器自己的HTTP快取，確保每次開啟都直接跟伺服器要最新內容，
    // 不會因為Cache-Control標頭而拿到瀏覽器磁碟裡的舊版本
    fetch(req, { cache: 'no-store' })
      .then(res => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, resClone));
        return res;
      })
      .catch(() => caches.match(req)) // 離線時（連網路都連不上）才退回使用上次快取的版本
  );
});
