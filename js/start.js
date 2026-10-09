// BlockCalc — js/start.js
// Start: Initialisierung nach DOMContentLoaded
document.addEventListener('DOMContentLoaded',async()=>{
  // (Aug 2026) Die früheren Reparenting-Workarounds sind entfallen: tab-baugrund liegt jetzt als
  // echtes Geschwister-Panel neben tab-geometrie und dim-card am Ende von geo-standard — direkt
  // im Markup, nicht mehr erst zur Laufzeit korrigiert.
  await dbInit();
  loadSettings();
  updateSliderRanges();
  document.getElementById('p_datum').value=new Date().toISOString().slice(0,10);
  loadLLVLS();
  renderLF();renderProjList();renderTemplates();renderBGTplDropdown();renderSchichten();renderLoadLvls();syncLFSel();
  updateMatCardSummary();updateGWCardSummary();updateBoeCardSummary();
  initViewer();updateSB();
  _initWsResize();   // Splitter-Griffe + gespeicherte Spaltenbreiten
  setModel(CALC_MODEL, true);
  autoC1();
  initSicherung();
  rebuildScene(); // Initiale Szene aufbauen
  formatMeterInputs(); // Felder mit Einheit m auf 2 Dezimalstellen
  if(SETTINGS.bearbeiter) si('p_bearbeiter',SETTINGS.bearbeiter);
  // Auto-Entwurf: letzten Arbeitsstand wiederherstellen (Datensicherheit nach Reload/Absturz)
  // Im Selbsttest-Modus übersprungen (deterministischer Startzustand, Draft bleibt unberührt)
  const _restored = (!window._SELFTEST_MODE && typeof _restoreDraft==='function') ? _restoreDraft() : false;
  if(_restored) toast('Letzter Stand wiederhergestellt');
  setTimeout(()=>{ histInit(); if(!_restored){ _savedSnap=_histSnap(); _dirty=false; _updateDirtyUI(); } _checkDirty(); }, 800);
  if(window._SELFTEST_MODE) setTimeout(runSelfTest, 600);
  // Embed-Modus zuletzt: die Leiste hängt an .app, und 'ready' darf erst raus, wenn die App steht
  if(window._EMBED_MODE) _embedInit();
});
