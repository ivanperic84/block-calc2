// BlockCalc — js/modell.js
// Modellwechsel, Geometrie je Modell, Material Flachfundament
// ── Geometrie pro Modell entkoppeln (Block ↔ Flach) — Boden + Lasten bleiben GLOBAL
// (Standort + zul. Lasten sind vorgegeben). Beim Modellwechsel wird die Geometrie ins
// ausgehende Modell gesichert und die des eingehenden geladen; persistiert via _geom.
// g_gbeton gehört dazu: die Wichte ist beim Flach materialabhängig (Stahlplatte 78.5) und darf
// nicht in den Block oder das Pfahlfundament durchschlagen.
const _GEOM_FIELDS=['g_bx','g_by','g_hblock','g_kx','g_ky','g_hkopf','g_uberd','g_uberd_flach','g_ex','g_ey','g_gbeton'];
let _geom={};            // {block:{feld:wert,…}, flach:{…}}
// Wessen Geometrie steht gerade in den g_-Feldern? Das Pfahlfundament hat eigene Felder und
// ändert den Besitzer NICHT — getauscht wird deshalb gegen den Besitzer, nicht gegen das
// zuletzt aktive Modell (sonst bleibt nach Block → Pfahl → Flach → Pfahl → Block die
// Flach-Geometrie im Block stehen; Okt 2026).
let _geomOwner='block';
// Betonwichte für Bauteile, die immer aus Beton sind (Bankett und Kopf des Pfahlfundaments):
// steht in den Feldern gerade eine Stahlplatte, gilt die Wichte des Block-Slots bzw. 25 kN/m³.
function _gBetonMassiv(){
  if(_geomOwner==='flach' && FLACH_MAT==='stahl') return +(_geom.block && _geom.block.g_gbeton) || 25;
  return +gi('g_gbeton') || 25;
}
let _applyingState=false; // während applyState: keinen Geometrie-Tausch auslösen
function _readGeom(){ const o={}; _GEOM_FIELDS.forEach(f=>{const e=document.getElementById(f); if(e) o[f]=e.value;}); return o; }
function _writeGeom(o){ if(!o) return; _GEOM_FIELDS.forEach(f=>{ if(o[f]!==undefined){ const e=document.getElementById(f); if(e){ e.value=o[f]; const r=document.getElementById(f+'_r'); if(r) r.value=o[f]; } } });
  if(typeof formatMeterInputs==='function') formatMeterInputs(); }

function setModel(m, silent){
  const _prevModel = CALC_MODEL;
  CALC_MODEL = m;
  // Geometrie pro Modell tauschen — nur echte Block↔Flach-Wechsel (Pfahlbock hat eigene Felder;
  // beim State-Laden übernimmt applyState die Slots).
  if(!_applyingState && (m==='block'||m==='flach') && _geomOwner!==m){
    _geom[_geomOwner]=_readGeom();
    if(_geom[m]) _writeGeom(_geom[m]);
    _geomOwner=m;
    // Der Block ist immer aus Beton: eine geerbte Stahlwichte (kein eigener Slot oder Slot aus
    // der Zeit vor der Wichte im Slot) wird zurückgesetzt.
    if(m==='block' && (+gi('g_gbeton')||0) > 40) si('g_gbeton','25');
  }
  _pendingFit = true;   // Modellwechsel → Gesamtmodell einmal neu rahmen
  // Buttons
  document.getElementById('model-btn-block').classList.toggle('active', m==='block');
  document.getElementById('model-btn-flach').classList.toggle('active', m==='flach');
  const pbBtn = document.getElementById('model-btn-pfahlbock');
  if(pbBtn) pbBtn.classList.toggle('active', m==='pfahlbock');
  // Torsion führt nur das Pfahlfundament → Zeile der Lasttabelle sonst ausblenden
  // Torsion: Pfahlfundament (Nachweis) und Blockfundament (nur Reservebetrachtung); Flach führt keine
  document.querySelectorAll('.lt-tors').forEach(el => { el.style.display = (m==='pfahlbock' || m==='block') ? '' : 'none'; });
  // ── Pfahlbock: eigenständiges Panel, separate Pipeline (block/flach-Logik übersprungen)
  const geoStd = document.getElementById('geo-standard');
  const pbSec  = document.getElementById('pfahlbock-section');
  if(m === 'pfahlbock'){
    if(geoStd) geoStd.style.display = 'none';
    if(pbSec)  pbSec.style.display  = '';
    document.getElementById('model-hint').textContent =
      'Pfahlfundament · starres Bankett auf geneigten Mikropfählen (Mantelreibung) · SIA 267. Räumliches Gruppengleichgewicht, GZG nach SBB.';
    const sub = document.querySelector('.tb-sub');
    if(sub) sub.textContent = 'SIA 267 · Pfahlfundament (Mikropfähle)';
    // Tabs/Buttons ausblenden, die nur Block/Flach betreffen
    _applySichEnabledUI();   // Schalter-Zeile und Tab «Sicherung» gibt es nur beim Block
    const vcPf = document.getElementById('vc-pfahl');     if(vcPf)  vcPf.style.display  = 'none';
    const vcKeil = document.getElementById('vc-pfahl-keil'); if(vcKeil) vcKeil.style.display = 'none';
    populatePfahlbockUI();
    _pbApplyModeUI();          // Ausführung (Gruppe/Einzelpfahl) → Sichtbarkeit Bankett/Kopf/Anordnung
    renderPfahlbock();
    return;                                   // block/flach-DOM-Logik überspringen
  }
  if(geoStd) geoStd.style.display = '';
  if(pbSec)  pbSec.style.display  = 'none';
  // Dynamic labels
  const isBlock = m==='block';
  // Frisches Flachfundament (noch kein eigener Geometrie-Slot) → als Stahl-Basisplatte vorbelegen:
  // d=0.09 m, kein Kopf (H_Kopf=0), Material Stahl (γ 78.5). Nutzer-Default.
  // B/L-Slider-Bereich modellabhängig (VOR dem Setzen der Werte, sonst clampt der Slider):
  //   Block 1.0–2.5 m · Flach 1.5–3.0 m.
  { const bxr=document.getElementById('g_bx_r'), byr=document.getElementById('g_by_r');
    const lo = isBlock ? '1.0' : '1.5', hi = isBlock ? '2.5' : '3.0';
    if(bxr){ bxr.min=lo; bxr.max=hi; } if(byr){ byr.min=lo; byr.max=hi; } }
  if(m==='flach' && !_applyingState && !window._SELFTEST_MODE && !_geom.flach && _prevModel!=='flach'){
    si('g_hblock','0.09'); { const hr=document.getElementById('g_hblock_r'); if(hr) hr.value='0.09'; }
    si('g_hkopf','0'); si('g_kx','0'); si('g_ky','0');
    si('g_gbeton','78.5');
    si('g_bx','1.50'); { const r=document.getElementById('g_bx_r'); if(r) r.value='1.50'; }
    si('g_by','3.00'); { const r=document.getElementById('g_by_r'); if(r) r.value='3.00'; }
    FLACH_MAT='stahl'; const ms=document.getElementById('flach-material'); if(ms) ms.value='stahl';
  }
  // Geometry section header
  document.getElementById('geo-sec-block').textContent = isBlock ? 'Blockgeometrie' : 'Fundamentgeometrie';
  // Field labels
  document.getElementById('lbl-bx').innerHTML      = isBlock ? 'B_Block <em>m</em>' : 'B_Fund <em>m</em>';
  document.getElementById('lbl-by').innerHTML      = isBlock ? 'L_Block <em>m</em>' : 'L_Fund <em>m</em>';
  document.getElementById('lbl-hblock').innerHTML  = isBlock ? 'H_Block <em>m</em>' : 'H_Platte <em>m</em>';
  document.getElementById('lbl-gauf').innerHTML    = isBlock ? 'γ Auffüllung <em>kN/m³</em>' : 'γ Hinterfüllung <em>kN/m³</em>';
  // H_Platte-Schieber nur beim Block (Flach: reines Zahlenfeld — Plattendicke ist ein statischer Kleinwert)
  { const hr=document.getElementById('g_hblock_r'), hn=document.getElementById('g_hblock');
    if(hr) hr.style.display = isBlock ? '' : 'none';
    if(hn){ hn.style.width = isBlock ? '' : '100%'; hn.style.minWidth = isBlock ? '' : '0'; hn.style.textAlign = isBlock ? '' : 'left'; } }
  // Kopf section: nur bei Block oder Beton-Flach
  const showKopf = isBlock || FLACH_MAT === 'beton';
  document.getElementById('kopf-section').style.display = showKopf ? '' : 'none';
  // Block-Überdeckung (g_uberd) nur beim Block — bei Flach steuert „Einbindetiefe Sohle" (g_uberd_flach) dieselbe Grösse
  { const br=document.getElementById('block-uberd-row'); if(br) br.style.display = isBlock ? '' : 'none'; }
  // Dimensionierungs-Karte nur beim Block (beim Flach auf Nutzerwunsch ausgeblendet)
  { const dc=document.getElementById('dim-card'); if(dc) dc.style.display = isBlock ? '' : 'none'; }
  // Material-Section: nur bei Flach
  document.getElementById('flach-material-section').style.display = isBlock ? 'none' : '';
  // Bei Flach: Einbindetiefe (g_uberd_flach) → g_uberd spiegeln (das Block-Feld ist ausgeblendet)
  if(!isBlock){ const uf=document.getElementById('g_uberd_flach'); if(uf){ si('g_uberd', uf.value);
    const ur=document.getElementById('g_uberd_r'); if(ur) ur.value=uf.value;
    const ufr=document.getElementById('g_uberd_flach_r'); if(ufr) ufr.value=uf.value; } }
  // Materialkennwerte-Panel umschalten
  const mbp = document.getElementById('mat-block-params');
  const mfp = document.getElementById('mat-flach-params');
  if(mbp) mbp.style.display = isBlock ? '' : 'none';
  try{ _updateDeltaFacUI(); }catch(_){ }
  if(mfp) mfp.style.display = isBlock ? 'none' : '';
  // q_u synchronisieren
  if(!isBlock){ const qf=document.getElementById('bg_qu_flach'); if(qf) qf.value=document.getElementById('bg_qu').value; }
  // γ-Label anpassen
  const lbg = document.getElementById('lbl-gbeton');
  if(lbg) lbg.innerHTML = (!isBlock && FLACH_MAT==='stahl') ? 'γ Stahl <em>kN/m³</em>' : 'γ Beton <em>kN/m³</em>';
  // Hint text
  const hints = {
    block: 'Steckner-Methode: Blockwiderstand inkl. Erdwiderstand an Seitenflächen, Mantelreibung und Kippwiderstand über Erddruckarm.',
    flach: 'Flachfundament · Starre Methode · SIA 267: Grundbruch mit der erweiterten Tragfähigkeitsformel (N_d ≤ R_d), Gleiten, Ausmitte, Gebrauchstauglichkeit.'
  };
  document.getElementById('model-hint').textContent = hints[m];
  // Topbar subtitle
  const sub = document.querySelector('.tb-sub');
  if(sub) sub.textContent = isBlock ? 'SIA 267 · Steckner Blockfundament' : (FLACH_MAT==='stahl' ? 'SIA 267 · Stahl-Basisplatte' : 'SIA 267 · Flachfundament Beton');
  // Überdeckungsfeld: immer sichtbar bei Flach; bei Stahl Hinweistext anpassen
  const uberdRow = document.getElementById('flach-uberd-row');
  if(!isBlock && uberdRow) uberdRow.style.display = '';
  // Felder zurücksetzen wenn Flach+Stahl (nur ohne silent)
  if(!isBlock && !silent && FLACH_MAT==='stahl'){
    si('g_kx','0'); si('g_ky','0'); si('g_hkopf','0');
    updateViewer();
  }
  // Auflasten-Section
  const aufSec = document.getElementById('auflasten-section');
  if(aufSec) aufSec.style.display = (!isBlock && FLACH_MAT==='stahl') ? '' : 'none';
  // Settings-Toggles 5–7 nur bei Blockfundament anzeigen
  document.querySelectorAll('.nw-block-only').forEach(el => {
    el.style.display = isBlock ? '' : 'none';
  });
  // Sicherung-Tab: nur bei Blockfundament UND aktiviertem Toggle (Sicherung/Aushub, selten).
  // _applySichEnabledUI setzt Nav-Tab + Toggle-Zeile konsistent (und verlässt den Tab, wenn aus).
  _applySichEnabledUI();
  // Sicherungs-Layer-Buttons (Sicherung + Keile) zentral: nur Block UND aktive Sicherung
  _updateKeilBtnVis();
  if(!isBlock && document.getElementById('tab-sicherung')?.classList.contains('active')){
    switchTab('lasten');
  }
  // Bei Flachfundament: Sicherung immer deaktivieren (keine Pfahlsicherung für Flach)
  if(!isBlock && showPfahl){
    showPfahl = false;
    if(typeof _updateSicherungBtn === 'function') _updateSicherungBtn();
  }
  // Lastbeiwerte-Sektionen modellabhängig:
  //   Typ 1 (Kippen/Ausmitte) nur Flach — Block ist eingespannt, kein Kippnachweis
  //   GZG (Schiefstellung) nur Block — Steckner Gl.11-21
  const lwT1 = document.getElementById('lw-typ1-sec');
  if(lwT1) lwT1.style.display = isBlock ? 'none' : '';
  const lwGzg = document.getElementById('lw-gzg-sec');
  if(lwGzg) lwGzg.style.display = isBlock ? '' : 'none';
  refreshMatrix();   // Kombinationsmatrix zeigt nur modellrelevante Grenzzustände
  scheduleCalc();
}

function onFlachMaterial(val){
  FLACH_MAT = val;
  const isStahl = val === 'stahl';
  // Einheitengewicht setzen
  si('g_gbeton', isStahl ? '78.5' : '24.0');
  // Kopf-Section: bei Stahl verstecken
  const kopfSec = document.getElementById('kopf-section');
  if(kopfSec) kopfSec.style.display = isStahl ? 'none' : '';
  if(isStahl){
    si('g_kx','0'); si('g_ky','0'); si('g_hkopf','0');
    // g_uberd bleibt wie vom User gesetzt (0 = bündig mit Terrain, >0 = Planumtiefe)
    const uf = document.getElementById('g_uberd_flach');
    si('g_uberd', uf ? uf.value : '0');
  } else {
    const uf = document.getElementById('g_uberd_flach');
    si('g_uberd', uf ? uf.value : '0.30');
  }
  // Auflasten-Section
  const aufSec = document.getElementById('auflasten-section');
  if(aufSec) aufSec.style.display = isStahl ? '' : 'none';
  // γ-Label
  const lbg = document.getElementById('lbl-gbeton');
  if(lbg) lbg.innerHTML = isStahl ? 'γ Stahl <em>kN/m³</em>' : 'γ Beton <em>kN/m³</em>';
  // Topbar
  const sub = document.querySelector('.tb-sub');
  if(sub) sub.textContent = isStahl ? 'SIA 267 · Stahl-Basisplatte' : 'SIA 267 · Flachfundament Beton';
  updateViewer(); scheduleCalc();
}

function renderAuflasten(){
  const el = document.getElementById('auflasten-list'); if(!el) return;
  if(!AUFLASTEN.length){ el.innerHTML='<div style="font-size:9.5px;color:var(--xdim);font-family:var(--f-mono);padding:4px 0 8px">Keine Auflasten definiert.</div>'; return; }
  el.innerHTML = AUFLASTEN.map((a,i)=>{
    const active = a.active !== false;  // Standard: aktiv
    const dim = active ? '' : 'opacity:0.45;pointer-events:none';
    return `
    <div style="background:var(--s2);border:1px solid ${active?'var(--ol)':'var(--ol)'};border-radius:var(--r2);padding:8px 10px;margin-bottom:6px;${active?'':'opacity:0.6'}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
          <input type="checkbox" ${active?'checked':''} style="accent-color:var(--acc);width:13px;height:13px;cursor:pointer"
            onchange="AUFLASTEN[${i}].active=this.checked;renderAuflasten();updateViewer();scheduleCalc()">
          <span style="font-family:var(--f-mono);font-size:10px;color:var(--on2)">Auflast ${i+1}</span>
        </label>
        <button class="btn btn-text btn-sm" style="padding:2px 6px;font-size:10px" onclick="delAuflast(${i})">Entfernen</button>
      </div>
      <div class="g2" style="gap:6px;${dim}">
        <div class="field"><label>P_k <em>kN</em></label><input type="number" value="${a.Pk}" step="1" min="0" oninput="AUFLASTEN[${i}].Pk=+this.value;updateViewer();scheduleCalc()"/></div>
        <div></div>
        <div class="field"><label>d_x <em>m</em></label><input type="number" value="${a.dx}" step="0.05" oninput="AUFLASTEN[${i}].dx=+this.value;updateViewer();scheduleCalc()"/></div>
        <div class="field"><label>d_y <em>m</em></label><input type="number" value="${a.dy}" step="0.05" oninput="AUFLASTEN[${i}].dy=+this.value;updateViewer();scheduleCalc()"/></div>
      </div>
    </div>`;
  }).join('');
}
function addAuflast(){ AUFLASTEN.push({Pk:10, dx:0, dy:0, active:true}); renderAuflasten(); scheduleCalc(); }
function delAuflast(i){ AUFLASTEN.splice(i,1); renderAuflasten(); updateViewer(); scheduleCalc(); }

// ════════════════════════════════════════════
