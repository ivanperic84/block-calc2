// BlockCalc — js/boot.js
// Startschalter (Selbsttest-/Embed-Modus) und Service-Worker-Registrierung
// Selbsttest-Modus (?selftest=1): Golden-/Analytik-Anker fahren, Draft-Save unterdrückt
window._SELFTEST_MODE = /[?&]selftest=1/.test(location.search);
// Embed-Modus (?embed=1): BlockCalc läuft im iframe einer Host-App (Fundamentbau-App) und wird
// über postMessage mit einem Rechenfall gefüttert. Den Zustand führt dann der Host — der
// Auto-Entwurf (bc_draft) des eigenständigen Betriebs bleibt deshalb unangetastet.
window._EMBED_MODE = /[?&]embed=1/.test(location.search) && window.parent !== window;
// PWA/Offline (Feldeinsatz): Service Worker cached App-Shell + CDN-Assets (Three.js/jsPDF/Fonts).
// Nur über http(s) — bei file://-Nutzung (Chrome-Extension-Workflow) bleibt alles wie bisher.
if('serviceWorker' in navigator && /^https?:$/.test(location.protocol)){
  window.addEventListener('load', ()=>{ navigator.serviceWorker.register('sw.js').catch(()=>{}); });
}
// ════════════════════════════════════════════
