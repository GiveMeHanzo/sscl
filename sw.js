/* ============================================================
   Service Worker — 电子场记单 PWA
   实现离线缓存，确保无网络时应用仍可正常加载

   ⚠️ 部署更新说明：
   每次推送新代码后，修改下方 CACHE_VERSION 后缀（例如 -a → -b），
   否则浏览器会继续使用旧缓存。也可改成日期格式如 20260622。
   ============================================================ */

// ★ 改这里：每次部署 +1 或者改成今天的日期
const CACHE_VERSION = '20260622-a';
const CACHE_NAME = 'clapperboard-' + CACHE_VERSION;
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './sw.js'
];

// Install: pre-cache the app shell
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching app shell');
      return cache.addAll(APP_SHELL).catch((err) => {
        // Individual file failures shouldn't block install
        console.warn('[SW] Some files failed to cache:', err);
      });
    }).then(() => {
      // Force the waiting service worker to become active
      return self.skipWaiting();
    })
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      // Take control of all clients immediately
      return self.clients.claim();
    })
  );
});

// Fetch: cache-first strategy for app shell, network-first for everything else
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Skip non-http(s) requests (chrome-extension://, etc.)
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached response immediately, but update cache in background
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        }).catch(() => {
          // Network failed, cached version is fine
        });

        // Don't wait for the network update
        return cachedResponse;
      }

      // Not in cache: fetch from network
      return fetch(event.request).then((networkResponse) => {
        // Cache successful responses
        if (networkResponse && networkResponse.ok) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch((error) => {
        // Network failed and nothing cached
        console.warn('[SW] Fetch failed:', error);
        // Return a simple offline page for navigation requests
        if (event.request.mode === 'navigate') {
          return new Response(
            '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">' +
            '<meta name="viewport" content="width=device-width,initial-scale=1.0">' +
            '<title>场记单 - 离线</title><style>' +
            'body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;' +
            'align-items:center;justify-content:center;height:100vh;margin:0;' +
            'background:#f0f2f5;color:#202124;text-align:center;}' +
            'h1{font-size:1.5rem;}p{color:#5f6368;}' +
            '</style></head><body><div><h1>📋 电子场记单</h1>' +
            '<p>当前处于离线状态</p><p style="font-size:0.85rem;">请连接网络后刷新页面</p>' +
            '<p style="font-size:0.8rem;color:#9aa0a6;">已缓存的数据不会丢失</p></div></body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        }
        throw error;
      });
    })
  );
});

// Listen for messages from the page
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
