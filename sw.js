/* 旅行手帖 service worker
   每次更新 index.html，請把下面的版本號改成跟 index.html 裡的 APP_VERSION 一樣，
   使用者打開 App 時才會出現「有新版本，點這裡更新」。 */
const CACHE = "tripnote-2.6.0";
const CORE = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];

self.addEventListener("install", e => {
  // 有的檔案不存在也沒關係，能存幾個就存幾個
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(CORE.map(u => c.add(u)))));
});

self.addEventListener("message", e => {
  if (e.data === "skipWaiting") self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("tripnote-") && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // 天氣、匯率、地點搜尋：一律走網路，不存快取（App 自己會記住上次的結果）
  if (/open-meteo\.com|er-api\.com|met\.no|openstreetmap\.org/.test(url.hostname)) return;

  // 字型：先用快取，沒有再下載
  if (/fonts\.(googleapis|gstatic)\.com/.test(url.hostname)) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }))
    );
    return;
  }

  if (url.origin !== location.origin) return;

  // 匯率檔：一律拿網路上最新的
  if (url.pathname.endsWith("rates.json")) return;

  // 頁面本身：先拿網路上最新的，沒網路時用快取
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put("index.html", copy));
        return res;
      }).catch(() => caches.match("index.html").then(r => r || caches.match("./")))
    );
    return;
  }

  // 圖示等檔案：先用快取
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }))
  );
});
