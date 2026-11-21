/* RzTify service worker: aplikasi tetap terbuka tanpa internet.
   Lagu unduhan disimpan di IndexedDB oleh aplikasi, bukan di sini. */
const VER = 'rztify-v28';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const CDN = /(^|\.)((gstatic|googleapis)\.com|jsdelivr\.net|cdnjs\.cloudflare\.com|unpkg\.com)$/;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VER).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VER).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || r.headers.has('range')) return;          // audio / range: biarkan langsung ke jaringan
  const u = new URL(r.url);
  if (r.mode === 'navigate') {                                       // halaman: jaringan dulu (3 dtk), lalu salinan tersimpan
    e.respondWith((async () => {
      const c = await caches.open(VER);
      try {
        const res = await Promise.race([fetch(r), new Promise((_, j) => setTimeout(() => j('t'), 3500))]);
        if (res && res.ok) c.put('./index.html', res.clone());
        return res;
      } catch (_) {
        return (await c.match('./index.html')) || (await c.match('./')) || new Response('Offline', { status: 503 });
      }
    })());
    return;
  }
  if (u.origin === location.origin || CDN.test(u.hostname)) {         // aset: cache dulu, perbarui di belakang
    e.respondWith((async () => {
      const c = await caches.open(VER);
      const hit = await c.match(r);
      const net = fetch(r).then(res => { if (res && (res.ok || res.type === 'opaque')) c.put(r, res.clone()); return res; }).catch(() => null);
      return hit || (await net) || new Response('', { status: 504 });
    })());
  }
});

/* notifikasi pemutar: tombol Jeda/Putar dan Berikutnya diteruskan ke halaman */
self.addEventListener('notificationclick', e => {
  const a = e.action;
  e.waitUntil((async () => {
    const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (a && cs.length) { cs.forEach(c => c.postMessage({ rz: 'ntf', a })); return; }
    e.notification.close();
    if (cs.length) { const c = cs.find(x => 'focus' in x) || cs[0]; try { return await c.focus(); } catch (_) {} }
    return self.clients.openWindow('./');
  })());
});
