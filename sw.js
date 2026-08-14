// BlockCalc Service Worker — Offline-Fähigkeit für den Feldeinsatz (U4, Jul 2026)
// Strategie:
//   App-Shell (index.html/Navigation): Netz zuerst (Updates kommen sofort an), Cache als Offline-Fallback.
//   Statische Assets + Google Fonts: Cache zuerst, beim ersten Abruf befüllt.
// Cache-Version beim Deployment MITZIEHEN, wenn sich Abhängigkeiten ändern.
// v2 (Aug 2026): Runtime-Cache auf bekannte Hosts begrenzt, Navigation cacht nur res.ok.
// v3 (Aug 2026): Three.js/jsPDF liegen lokal unter vendor/ statt auf cdnjs — sie sind damit
//   Teil der App-Shell (same-origin) und ab dem ersten Start offline verfügbar.
//   Alte Caches löscht 'activate'.
const CACHE = 'blockcalc-v3';

const PRECACHE = [
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './vendor/three.min.js',
  './vendor/jspdf.umd.min.js',
  'https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      // Einzeln adden: ein fehlgeschlagenes CDN-Asset (offline installiert) bricht nicht alles ab
      .then(c => Promise.allSettled(PRECACHE.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;

  // Navigation / App-Shell: Netz zuerst, Offline-Fallback aus dem Cache
  if(req.mode === 'navigate' || new URL(req.url).pathname.endsWith('/index.html')){
    e.respondWith(
      fetch(req)
        // NUR erfolgreiche Antworten cachen: eine 404-/Fehlerseite als index.html abzulegen
        // würde den Offline-Fallback dauerhaft zerstören.
        .then(res => {
          if(res && res.ok){ const cp = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', cp)); }
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Alles andere: Cache zuerst. In den Cache kommen aber NUR eigene Dateien und die
  // bekannten CDN-/Font-Hosts — sonst würde jede beliebige Fremd-URL dauerhaft und
  // unkontrolliert im Cache landen (inkl. opaker Antworten, die nicht prüfbar sind).
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const allowedHost = ['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname);
  if(!sameOrigin && !allowedHost) return;   // Standardverhalten des Browsers, kein SW-Eingriff

  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if(res && (res.ok || res.type === 'opaque')){
        const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp));
      }
      return res;
    }))
  );
});
