// BlockCalc — js/layout.js
// Schubladen, Splitter, Projekt-Banner
// WORKSPACE-SPLITTER — intuitive Breitenanpassung (OnePlus-Open-Stil)
// Ziehen = stufenlos · Tippen auf den Griff = Snap-Zyklus durch Schnellbreiten.
// Ersetzt die früheren ⤢-Expand-Buttons (inp-wide) und die feste res-wide-Klasse.
// ════════════════════════════════════════════
let _wsCols = { l:400, r:320 };           // Nutzerbreiten [px] (persistiert in SETTINGS.wsCols); l=Startbreite
let _wsAutoWideR = false;                  // Diagramm expandiert → Ergebnisse temporär breiter
const _WS_SNAP_L = [400, 680], _WS_SNAP_R = [320, 600];   // nur Standard ↔ breit (mittlere Stufe entfernt)
const _WS_MIN = { l:280, r:260 }, _WS_MAX = { l:760, r:680 }, _WS_MID_MIN = 320;
function _wsEl(){ return document.querySelector('.workspace'); }
function applyWorkspaceCols(){
  const ws=_wsEl(); if(!ws) return;
  const wsW = ws.offsetWidth || 1600;
  // Nur noch EINE resizebare Spalte (links). Die Ergebnisse sind eine Schublade (kein Grid-Track).
  // Linke Breite gegen die aktuelle Fensterbreite begrenzen → Viewer nie unter _WS_MID_MIN.
  const l = Math.max(_WS_MIN.l, Math.min(_wsCols.l, Math.max(_WS_MIN.l, wsW - _WS_MID_MIN)));
  ws.style.setProperty('--col-l', l+'px');
}
// Globalen Nachweis-Status (#overall-pill) auf den Schubladen-Griff spiegeln (Farbe + Kurztext).
function _updateDrawerStatus(){
  const tab=document.getElementById('res-drawer-tab'); if(!tab) return;
  const pill=document.getElementById('overall-pill'), lbl=document.getElementById('rdt-label');
  let cls='', txt='Nachweise';
  if(pill){
    if(pill.classList.contains('pill-ok')){ cls='ok';   txt='Erfüllt'; }
    else if(pill.classList.contains('pill-f')){ cls='fail'; txt='Nicht erfüllt'; }
    else if(pill.classList.contains('pill-w')){ cls='warn'; txt='Prüfen'; }
  }
  tab.classList.remove('ok','fail','warn'); if(cls) tab.classList.add(cls);
  if(lbl) lbl.textContent = txt;
  // Massgebende Ausnutzung getrennt nach GZT / GZG über alle Nachweis-Karten (renderer-agnostisch
  // aus dem DOM; Gruppenzuordnung über die vorausgehenden .lf-grp-Köpfe). Ein Frame verzögert, da
  // die Karten teils erst nach dem overall-pill in #res-scroll landen.
  requestAnimationFrame(()=>{
    const scroll=document.getElementById('res-scroll');
    let gGzt=Infinity, gGzg=Infinity, cur='gzt';
    if(scroll) scroll.querySelectorAll('.lf-grp, .nw-hd .nw-eta').forEach(el=>{
      if(el.classList.contains('lf-grp')){ const t=(el.textContent||'').toUpperCase();
        cur = t.includes('GZG')?'gzg' : t.includes('GZT')?'gzt' : cur; return; }
      const m=/η\s*=\s*(-?\d+(?:[.,]\d+)?)/.exec(el.textContent||''); if(!m) return;
      const v=parseFloat(m[1].replace(',','.')); if(!isFinite(v)) return;
      if(cur==='gzg'){ if(v<gGzg) gGzg=v; } else { if(v<gGzt) gGzt=v; }
    });
    const setVal=(id,pfx,val)=>{ const e=document.getElementById(id); if(!e) return;
      if(isFinite(val)){ e.innerHTML='<small>'+pfx+' </small>'+val.toFixed(2);
        e.className='rdt-val '+(val>=1.0?'ok':'fail'); e.style.display=''; }
      else e.style.display='none'; };
    setVal('rdt-gzt','GZT',gGzt); setVal('rdt-gzg','GZG',gGzg);
  });
}
function _clampWsCol(side, w, wsW){
  const other = side==='l' ? _wsCols.r : _wsCols.l;
  const max = Math.min(_WS_MAX[side], (wsW||1600) - other - _WS_MID_MIN);
  return Math.round(Math.max(_WS_MIN[side], Math.min(max, w)));
}
function _persistWsCols(){ if(typeof SETTINGS!=='undefined'){ SETTINGS.wsCols={l:_wsCols.l, r:_wsCols.r}; dbSet('bc_settings', SETTINGS); } }
function _cycleWsSnap(side){
  const P = side==='l' ? _WS_SNAP_L : _WS_SNAP_R, cur=_wsCols[side];
  let nxt = P.find(p=>p > cur+8); if(nxt==null) nxt=P[0];
  _wsCols[side] = _clampWsCol(side, nxt, _wsEl().offsetWidth);
  applyWorkspaceCols(); _persistWsCols();
  if(typeof setViewerDrawerShift==='function') setViewerDrawerShift();   // Buttons/Achsen/Modell animiert mit
  requestAnimationFrame(()=>requestAnimationFrame(resizeViewer));
}
// Projekt-Banner (Metadaten) vertikal aus der Topbar aus-/einklappen.
function toggleProjBanner(force){
  const b=document.getElementById('proj-banner'), btn=document.getElementById('proj-banner-btn');
  if(!b) return;
  const open=(force!==undefined) ? !!force : !b.classList.contains('open');
  b.classList.toggle('open', open);
  if(btn) btn.classList.toggle('open', open);
  // Ausroll-Pille auf die Banner-Unterkante setzen (fährt via CSS-Transition mit): geschlossen an der
  // Topbar-Randlinie, offen an der Banner-Unterkante (Trennlinie zum Arbeitsbereich).
  const roll=document.getElementById('banner-roll');
  if(roll){
    const tbH=(document.querySelector('.topbar')||{}).offsetHeight||48;
    const cap=Math.min(0.78*window.innerHeight, 600);
    const bh=open ? Math.min(b.scrollHeight, cap) : 0;
    roll.style.top=(tbH + bh - 7)+'px';
  }
}
// Offenes Banner einrollen, sobald daneben (Modell/Sidebar) geklickt wird — Klicks im Banner
// oder auf den Toggle-Button schliessen es NICHT (dort übernimmt der eigene Handler).
document.addEventListener('pointerdown', e=>{
  const b=document.getElementById('proj-banner'); if(!b || !b.classList.contains('open')) return;
  const btn=document.getElementById('proj-banner-btn'), roll=document.getElementById('banner-roll');
  // Klicks im Banner, auf den Projektnamen-Toggle ODER auf die Ausroll-Pille schliessen NICHT
  // (dort übernimmt der eigene onclick — sonst würde pointerdown zu / click wieder auf → Doppel-Toggle).
  if(b.contains(e.target) || (btn && btn.contains(e.target)) || (roll && roll.contains(e.target))) return;
  toggleProjBanner(false);
});
// Ergebnis-Schublade ein-/ausfahren (≥768px). Zustand wird in SETTINGS.resDrawerOpen gemerkt.
function toggleResDrawer(force){
  const ws=_wsEl(); if(!ws) return;
  const open = (force!==undefined) ? !!force : !ws.classList.contains('res-open');
  ws.classList.toggle('res-open', open);
  if(typeof SETTINGS!=='undefined'){ SETTINGS.resDrawerOpen=open; if(typeof dbSet==='function') dbSet('bc_settings',SETTINGS); }
  if(typeof setViewerDrawerShift==='function') setViewerDrawerShift();   // Modell aus dem verdeckten Bereich schieben
  requestAnimationFrame(resizeViewer);
}
function _initWsResize(){
  const ws=_wsEl(); if(!ws) return;
  if(typeof SETTINGS!=='undefined' && SETTINGS.wsCols){
    _wsCols.l = +SETTINGS.wsCols.l || _wsCols.l; _wsCols.r = +SETTINGS.wsCols.r || _wsCols.r;
  }
  // Nachweis-Schublade (rechts): gemerkten Zustand anwenden (Default eingeklappt → Fokus auf Modellierung)
  const _drOpen=(typeof SETTINGS!=='undefined' && SETTINGS.resDrawerOpen===true);
  ws.classList.toggle('res-open', _drOpen);
  ws.classList.add('ws-noanim');   // Erstaufbau ohne Transition (kein einmaliges Control-Gleiten)
  applyWorkspaceCols();
  if(typeof setViewerDrawerShift==='function') setViewerDrawerShift();   // Start-Verschiebung (Eingabe-Overlay + ggf. Nachweis)
  setTimeout(()=>ws.classList.remove('ws-noanim'), 80);   // Guard nach Erstaufbau lösen (setTimeout: feuert auch bei RAF-Drosselung)
  _updateDrawerStatus();
  window.addEventListener('resize', ()=>{ applyWorkspaceCols(); if(typeof setViewerDrawerShift==='function') setViewerDrawerShift(); });
  [['ws-split-l','l'],['ws-split-r','r']].forEach(([id,side])=>{
    const h=document.getElementById(id); if(!h) return;
    let drag=false, moved=false, x0=0, w0=0;
    const move=e=>{ if(!drag) return; const x=e.clientX;
      if(Math.abs(x-x0)>3) moved=true;
      const dir = side==='l' ? 1 : -1;
      _wsCols[side] = _clampWsCol(side, w0 + dir*(x-x0), ws.offsetWidth);
      applyWorkspaceCols();
      // Buttons/Achsen/Modell folgen 1:1 mit der Eingabe-Breite (Transition während .resizing aus)
      if(side==='l' && typeof setViewerDrawerShift==='function') setViewerDrawerShift(true); };
    const up=()=>{ if(!drag) return; drag=false; h.classList.remove('drag'); ws.classList.remove('resizing');
      document.body.style.userSelect='';
      window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',up);
      // Tippen (keine Bewegung) = Schnellbreiten-Wechsel Normal↔Breit (Tabellen komplett sichtbar)
      if(!moved) _cycleWsSnap(side);
      else { _persistWsCols();
        if(side==='l' && typeof setViewerDrawerShift==='function') setViewerDrawerShift();   // Endstand animiert einrasten
        requestAnimationFrame(resizeViewer); } };
    h.addEventListener('pointerdown',e=>{ if(window.innerWidth<768) return; e.preventDefault();
      drag=true; moved=false; x0=e.clientX; w0=_wsCols[side];
      h.classList.add('drag'); ws.classList.add('resizing'); document.body.style.userSelect='none';
      window.addEventListener('pointermove',move); window.addEventListener('pointerup',up); });
  });
}

let _gztExpanded = false;

// Diagramm-Expand: Schublade verbreitern (.res-wide-diag) UND sicherstellen dass sie offen ist
// (sonst sieht man das expandierte Diagramm nicht). State via _wsAutoWideR.
function _updateResWide(){
  const pfWide = window['_pfahl_sys_diag_wide'] || window['_pfahl_sn_diag_wide'];
  _wsAutoWideR = !!(_gztExpanded || pfWide);
  const ws=_wsEl(); if(!ws) return;
  ws.classList.toggle('res-wide-diag', _wsAutoWideR);
  if(_wsAutoWideR && !ws.classList.contains('res-open')) toggleResDrawer(true);
  requestAnimationFrame(resizeViewer);
}

function togglePfahlDiagWide(diagId){
  // Beide Pfahl-Diagramme immer gemeinsam expandieren/kollabieren
  const newState = !window[diagId+'_wide'];
  window['_pfahl_sys_diag_wide'] = newState;
  window['_pfahl_sn_diag_wide']  = newState;
  _updateResWide();
  calcPfahlsicherung();
}

function toggleGZTExpand(evt, key){
  if(evt) evt.stopPropagation();
  _gztExpanded = !_gztExpanded;
  _updateResWide();
  // Alle Diagramme im Panel gleichzeitig neu aufbauen
  document.querySelectorAll('.gzt-diagram').forEach(div=>{
    const k = div.dataset.gztKey;
    const data = k && window[k] ? window[k] : null;
    if(!data) return;
    const btnExp = div.querySelector('[onclick*="toggleGZTExpand"]');
    let newSvg;
    if(data.fn === 'buildSohlDiagram')         newSvg = buildSohlDiagram(data.R, data.G, _gztExpanded);
    else if(data.fn === 'buildKippDiagram')    newSvg = buildKippDiagram(data.R, data.G, _gztExpanded);
    else if(data.fn === 'buildGrundbDiagram')  newSvg = buildGrundbDiagram(data.R, data.G, _gztExpanded);
    else if(data.fn === 'buildPbAxialDiagram') newSvg = buildPbAxialDiagram(data.R, data.n, _gztExpanded);
    else if(data.fn === 'buildPbSchnittSVG')   newSvg = buildPbSchnittSVG(data.R, data.n, _gztExpanded);
    else if(data.fn === 'buildPbSystemSVG')    newSvg = buildPbSystemSVG(data.R, data.piles, data.n, _gztExpanded);
    else if(data.fn === 'buildPbSteelDiagram') newSvg = buildPbSteelDiagram(data.R, data.n, _gztExpanded);
    else if(data.fn === 'buildPbKnickDiagram') newSvg = buildPbKnickDiagram(data.R, data.n, _gztExpanded);
    else if(/^buildPb(Aufbruch|Lateral|Einzel)Diagram$/.test(data.fn)) newSvg = window[data.fn](data.R, data.n, _gztExpanded);
    else if(data.fn && typeof window[data.fn] === 'function' && data.G) newSvg = window[data.fn](data.R, data.G, _gztExpanded);   // Block/Flach: (r, g, breit)
    else                                       newSvg = buildGZTDiagram(data.R, data.G, _gztExpanded, false);
    div.innerHTML = '';
    if(btnExp){ btnExp.textContent = _gztExpanded ? '✕' : '⤢'; div.appendChild(btnExp); }
    div.insertAdjacentHTML('beforeend', newSvg);
  });
}

// ════════════════════════════════════════════
