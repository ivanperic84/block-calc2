// BlockCalc Service Worker — Offline-Fähigkeit für den Feldeinsatz
//
// Die App besteht aus index.html, css/app.css und den Skripten unter js/ (seit Okt 2026 mehrere
// Dateien). Drei Regeln:
//   1. Eigener Code (index.html, css/, js/, handbuch.html): NETZ ZUERST, Cache nur als
//      Offline-Fallback — ein Update kommt sofort an, es gibt keinen Mischstand aus alt und neu.
//   2. Unveränderliche Dateien (vendor/, Icon, Manifest, Google Fonts): CACHE ZUERST.
//   3. Alles wird beim Installieren vorgeladen, damit die App schon nach dem ERSTEN Besuch
//      offline startet.
// VERSION wird von werkzeug/version-setzen.sh gesetzt und muss mit dem ?v= in index.html
// übereinstimmen (die Dateien werden mit genau dieser Adresse angefragt und abgelegt).
const VERSION = '2026-10-10h';
const CACHE = 'blockcalc-' + VERSION;

const APP_DATEIEN = [
  'css/app.css',
  'js/boot.js',
  'js/helfer.js',
  'js/speicher.js',
  'js/einstellungen.js',
  'js/templates.js',
  'js/viewer.js',
  'js/viewer-sicherung.js',
  'js/lasten.js',
  'js/boden.js',
  'js/pfahlfundament.js',
  'js/pfahlfundament-ergebnis.js',
  'js/modell.js',
  'js/lastniveaus.js',
  'js/bettung.js',
  'js/erddruck.js',
  'js/kataloge.js',
  'js/bishop.js',
  'js/pfahl-bettung.js',
  'js/pfahlfundament-kern.js',
  'js/sicherung.js',
  'js/rechenkern.js',
  'js/dimensionierung.js',
  'js/bemessung.js',
  'js/fundamentliste.js',
  'js/nachweis-zeilen.js',
  'js/bericht.js',
  'js/bericht-flach.js',
  'js/bericht-pfahl.js',
  'js/diagramme.js',
  'js/diagramm-gzt.js',
  'js/ergebnis.js',
  'js/layout.js',
  'js/projekt.js',
  'js/mobil.js',
  'js/selbsttest.js',
  'js/tastatur.js',
  'js/embed.js',
  'js/start.js'
];
const PRECACHE = [
  './index.html',
  './handbuch.html',
  './manifest.webmanifest',
  './icon.svg',
  './vendor/three.min.js',
  './vendor/jspdf.umd.min.js',
  ...APP_DATEIEN.map(f => './' + f + '?v=' + VERSION),
  'https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      // Einzeln adden: eine fehlgeschlagene Datei (offline installiert) bricht nicht alles ab
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

// Netz zuerst; nur erfolgreiche Antworten ablegen (eine Fehlerseite im Cache würde den
// Offline-Fallback dauerhaft zerstören).
function netzZuerst(req, cacheKey){
  return fetch(req)
    .then(res => {
      if(res && res.ok){ const cp = res.clone(); caches.open(CACHE).then(c => c.put(cacheKey || req, cp)); }
      return res;
    })
    .catch(() => caches.match(cacheKey || req));
}
function cacheZuerst(req){
  return caches.match(req).then(hit => hit || fetch(req).then(res => {
    if(res && (res.ok || res.type === 'opaque')){
      const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp));
    }
    return res;
  }));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const fontHost = ['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname);
  if(!sameOrigin && !fontHost) return;   // fremde Adressen: Standardverhalten des Browsers

  if(sameOrigin){
    const p = url.pathname;
    // Navigation zur App: immer unter './index.html' ablegen (unabhängig von ?embed=1 usw.)
    if(req.mode === 'navigate' && !p.endsWith('/handbuch.html')){ e.respondWith(netzZuerst(req, './index.html')); return; }
    if(p.endsWith('/index.html')){ e.respondWith(netzZuerst(req, './index.html')); return; }
    // Eigener Code: Netz zuerst
    if(p.endsWith('.html') || /\/(js|css)\/[^/]+$/.test(p)){ e.respondWith(netzZuerst(req)); return; }
  }
  // vendor/, Icon, Manifest, Fonts: Cache zuerst
  e.respondWith(cacheZuerst(req));
});
