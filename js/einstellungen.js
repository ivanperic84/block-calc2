// BlockCalc — js/einstellungen.js
// SETTINGS, Nachweisauswahl je Tragsystem, Optionen-Overlay
// SETTINGS
// ════════════════════════════════════════════
let SETTINGS = {
  theme:'dark', lang:'de', firma:'', bearbeiter:'',
  tG:1.35, tQ:1.5, tph:1.20, tc:1.5, tEa:1.35, tEp:1.40,
  mob:0.25, alphaZul:0.005, alphaZulFull:0.010, kappaE:1/6,
  pfahlGzgDecouple:true,   // GZG-Verformung Standard: entkoppelt (Schrägstellung vernachlässigt)
  bauzustandGred:false, bauzustandGredVal:1.20, bauzustandGredSpezial:false,
  nw:null,                 // Nachweisauswahl je Tragsystem — _nwNorm() füllt aus _NW_DEF
  gz_labels:{
    t2_block:'Grundbruch · Gleiten · Sohlsp. · Steckner GZT',
    gzg_block:'Schiefstellung (Steckner Gl.11–21)',
    t2_flach:'Grundbruch · Gleiten · Sohlspannung',
    t1_flach:'Kippen / Ausmitte'
  },
  gz_custom:[],  // Benutzerdefinierte Grenzzustände [{label, sub, gG, gQ}]
  sl:{gbx:{min:1.0,max:2.5},gby:{min:1.0,max:2.5},ghb:{min:1.4,max:3.6},
      gkx:{min:0.40,max:0.80},gky:{min:0.40,max:0.80},ghk:{min:0.40,max:1.00},
      phi:{min:20,max:40},beta:{min:-40,max:0}}
};

// mob-Eingabe an den Mobilisierungs-Toggle koppeln: Toggle aus ⇒ Feld ausgegraut + auf 100 % (voller Passivdruck λ_p)
function _syncMobUI(){
  const t=document.getElementById('set-steckner-mob'), m=document.getElementById('set-mob'), h=document.getElementById('set-mob-hint');
  if(!t||!m) return;
  if(t.checked){
    m.disabled=false; m.style.opacity=''; m.style.cursor='';
    if(m.dataset.saved!=null && m.dataset.saved!=='') { m.value=m.dataset.saved; delete m.dataset.saved; }
    if(h) h.textContent='Ew = E₀ + mob·(Ep − E₀) — mobilisierter Passivwiderstand über Nulllinie';
  } else {
    if(!m.disabled) m.dataset.saved=m.value;   // realen Wert vor dem Ausgrauen merken
    m.disabled=true; m.style.opacity='0.45'; m.style.cursor='not-allowed'; m.value='1.00';
    if(h) h.textContent='mob = 100 % — voller Passivwiderstand λ_p (Steckner-Papier Gl.32)';
  }
}
// ══════════════════════════════════════════════════════════════════════════
// Aktive Nachweise — je Tragsystem getrennt (Aug 2026)
// Vorher lag EIN flacher Satz Flags für alle Modelle in SETTINGS.nw; er griff nur auf
// Gesamtstatus und Bericht, nicht auf die Karten, und Pfahlfundament/Sicherung ignorierten
// ihn ganz. Jetzt führt jedes System seine eigene Liste, und die Flags wirken durchgängig.
const _NW_DEF = {
  block: { gzt:true, gzg:true, info:true },
  flach: { sohlsp:true, grundb:true, gleiten:true, kippen:true, bishop:false },
  pfahl: { geo:true, stahl:true, knick:true, lat:true, gzg:true },
  sich:  { lat:true, ax:true, stahl:true, sys:true, kern:true, verf:true, gzgsys:true }
};
// Normalisiert SETTINGS.nw und migriert den alten flachen Satz auf die Systemstruktur.
function _nwNorm(){
  const src = SETTINGS.nw || {};
  const alt = (src.block===undefined && src.flach===undefined) ? src : null;   // Altformat?
  const out = {};
  for(const sys in _NW_DEF){
    out[sys] = {};
    for(const k in _NW_DEF[sys]) out[sys][k] = _NW_DEF[sys][k];
  }
  if(alt){
    // Altformat: sohlsp/grundb/gleiten/kippen/gzt/gzg/bishop → auf Block und Flach abbilden
    if(alt.gzt    !== undefined) out.block.gzt    = alt.gzt    !== false;
    if(alt.gzg    !== undefined) out.block.gzg    = alt.gzg    !== false;
    if(alt.sohlsp !== undefined) out.flach.sohlsp = alt.sohlsp !== false;
    if(alt.grundb !== undefined) out.flach.grundb = alt.grundb !== false;
    if(alt.gleiten!== undefined) out.flach.gleiten= alt.gleiten!== false;
    if(alt.kippen !== undefined) out.flach.kippen = alt.kippen !== false;
    if(alt.bishop !== undefined) out.flach.bishop = alt.bishop === true;
  } else {
    for(const sys in _NW_DEF)
      for(const k in _NW_DEF[sys])
        if(src[sys] && src[sys][k] !== undefined) out[sys][k] = src[sys][k] !== false;
  }
  SETTINGS.nw = out;
  return out;
}
// Kompatibilitäts-Sicht: liefert für Block/Flach die alten Schlüsselnamen, damit die
// bestehenden `NW.sohlsp`-Aufrufstellen in Rechenkern, Panel und Bericht unverändert bleiben.
// Beim BLOCK sind Sohlspannung/Grundbruch/Gleiten/Kernweite informativ und hängen daher
// gemeinsam am Schalter `block.info`.
function _nwFor(sys){
  if(sys==='block'){
    const inf = nwOn('block','info');
    return { gzt:nwOn('block','gzt'), gzg:nwOn('block','gzg'),
             sohlsp:inf, grundb:inf, gleiten:inf, kippen:inf, bishop:false };
  }
  return { gzt:false, gzg:false,
           sohlsp:nwOn('flach','sohlsp'),  grundb:nwOn('flach','grundb'),
           gleiten:nwOn('flach','gleiten'), kippen:nwOn('flach','kippen'),
           bishop:nwOn('flach','bishop') };
}

// Ist der Nachweis `key` im System `sys` aktiv? Unbekannte Schlüssel gelten als aktiv.
function nwOn(sys, key){
  const s = (SETTINGS.nw && SETTINGS.nw[sys]) ? SETTINGS.nw[sys] : null;
  if(!s) return _NW_DEF[sys] ? _NW_DEF[sys][key] !== false : true;
  return s[key] !== false;
}

// Zulaessige Schiefstellung tan(α) — SBB 0161.1011.0007 kennt ZWEI Grenzwerte:
// 1:100 fuer staendig+veraenderlich, 1:200 fuer die veraenderliche Last allein.
// Welcher gilt, haengt am GZG-Lastbeiwert lw_G_gzg: > 0 ⇒ der staendige Anteil ist
// enthalten ⇒ 1:100; = 0 ⇒ reiner Veraenderlich-Fall ⇒ 1:200.
// Lastbeiwert lesen: `+gi(id) || 1.00` verschluckt eine eingegebene 0 (falsy) und liefert 1.00 —
// wer γ_G,GZG = 0 setzt, um den reinen Veraenderlich-Fall zu rechnen, bekam still den vollen
// staendigen Anteil. Nur ein LEERES Feld faellt auf die Vorgabe zurueck (wie bei gwDepth).
// ── Rechenkontext ──────────────────────────────────────────────────────────────────
// Während _doCalculate läuft, zeigt _CALC_CTX auf das Eingabepaket. Die tiefen Helfer
// (Grundwasser, Schichten, Erddruck, Lastbeiwerte) lesen über cgi()/cSchichten() daraus —
// ausserhalb einer Berechnung fallen beide auf DOM bzw. globale SCHICHTEN zurück.
// Damit lassen sich auch Boden-, Grundwasser- und Lastbeiwert-Varianten über den Pure-Kern
// rechnen:  _doCalculate({...collectCalcInputs(), raw:{...}, SCHICHTEN:[...], _pure:true}).
let _CALC_CTX = null;
function cgi(id){ const r=_CALC_CTX && _CALC_CTX.raw; return (r && r[id]!==undefined) ? r[id] : gi(id); }
function cSchichten(){ return (_CALC_CTX && _CALC_CTX.SCHICHTEN) || SCHICHTEN; }
function _gzgFac(id, dflt){
  const _r = _CALC_CTX && _CALC_CTX.raw;
  const el = document.getElementById(id);
  const raw = (_r && _r[id]!==undefined) ? String(_r[id]).trim() : (el ? String(el.value).trim() : '');
  if(raw === '') return dflt;
  const v = +raw;
  return isFinite(v) ? v : dflt;
}

function _tanZul(hasPermanent){
  return hasPermanent ? (SETTINGS.alphaZulFull ?? 0.010) : (SETTINGS.alphaZul ?? 0.005);
}

function loadSettings(){
  const s = dbGet('bc_settings');
  if(s) SETTINGS = Object.assign(SETTINGS, s);
  // Theme
  document.documentElement.setAttribute('data-theme', SETTINGS.theme||'dark');
  const lEl = document.getElementById('set-light');
  if(lEl) lEl.checked = (SETTINGS.theme==='light');
  // UI-Felder befüllen
  const set = (id,v)=>{ const el=document.getElementById(id); if(el) el.value=v; };
  const chk = (id,v)=>{ const el=document.getElementById(id); if(el) el.checked=!!v; };
  set('set-lang',    SETTINGS.lang||'de');
  set('set-firma',   SETTINGS.firma||'');
  set('set-bearbeiter', SETTINGS.bearbeiter||'');
  if(typeof _loadLogoUI==='function') _loadLogoUI();
  set('set-tG',   SETTINGS.tG??1.35);
  set('set-tQ',   SETTINGS.tQ??1.5);
  set('set-tph',  SETTINGS.tph??1.20);
  set('set-tc',   SETTINGS.tc??1.5);
  set('set-tEa',  SETTINGS.tEa??1.35);
  set('set-tEp',  SETTINGS.tEp??1.40);
  set('set-mob',     SETTINGS.mob??0.25);
  set('set-alpha-zul', SETTINGS.alphaZul??0.005);
  set('set-alpha-zul-full', SETTINGS.alphaZulFull??0.010);
  chk('set-steckner-mob', SETTINGS.stecknerMob !== false);     // Standard AN (Passivdruck mobilisiert)
  _syncMobUI();   // mob-Eingabe an den Toggle koppeln (aus ⇒ ausgegraut, 100 %)
  _sichEnabled = SETTINGS.sichEnabled === true;                 // Sicherung/Aushub-Tab (Standard aus, selten)
  chk('sich-enable', _sichEnabled);
  try{ if(typeof _applySichEnabledUI==='function') _applySichEnabledUI(); }catch(_){ }
  chk('set-steckner-slope', SETTINGS.stecknerSlope===true);   // Standard aus (Original-Steckner)
  set('set-pfahl-randmin', SETTINGS.pfahlRandMin??0.30);
  set('set-pfahl-alat', SETTINGS.pfahlAlphaLat??0.30);
  set('set-pfahl-lcrit', SETTINGS.pfahlLcrit??10);
  { const _ke=document.getElementById('set-kappa-e');
    if(_ke) _ke.value = ((SETTINGS.kappaE ?? (1/6)) > 0.25) ? '0.3333' : '0.1667'; }
  chk('set-bz-gred', SETTINGS.bauzustandGred===true);
  set('set-bz-gred-val', SETTINGS.bauzustandGredVal??1.20);
  chk('set-bz-gred-spezial', SETTINGS.bauzustandGredSpezial===true);
  chk('set-pfahl-decouple', SETTINGS.pfahlGzgDecouple);
  chk('set-pfahl-latgrp', SETTINGS.pfahlLatGroup!==false);   // Standard an (p-Multiplier)
  // _bgKoernig / _c1Methode sind PROJEKT-Zustand (FDS-Array, via applyState wiederhergestellt) und werden
  // im Boden-Tab gewählt — NICHT aus SETTINGS überschreiben. Sonst setzt jedes Öffnen der Optionen die
  // Boden-Auswahl (USCS-Bodenart / C₁-Methode) auf den veralteten SETTINGS-Wert zurück → C₁ und damit der
  // Erfüllungsgrad ändern sich nach dem Speichern (gemeldeter Bug, Jul 2026). loadSettings lässt sie intakt.
  const nw = _nwNorm();
  chk('nw-b-gzt',     nw.block.gzt);      chk('nw-b-gzg',   nw.block.gzg);
  chk('nw-b-info',    nw.block.info);
  chk('nw-f-sohlsp',  nw.flach.sohlsp);   chk('nw-f-grundb', nw.flach.grundb);
  chk('nw-f-gleiten', nw.flach.gleiten);  chk('nw-f-kippen', nw.flach.kippen);
  chk('nw-f-bishop',  nw.flach.bishop);   // Standard inaktiv
  chk('nw-p-geo',     nw.pfahl.geo);      chk('nw-p-stahl',  nw.pfahl.stahl);
  chk('nw-p-knick',   nw.pfahl.knick);    chk('nw-p-lat',    nw.pfahl.lat);
  chk('nw-p-gzg',     nw.pfahl.gzg);
  chk('nw-s-lat',     nw.sich.lat);       chk('nw-s-ax',     nw.sich.ax);
  chk('nw-s-stahl',   nw.sich.stahl);     chk('nw-s-sys',    nw.sich.sys);
  chk('nw-s-kern',    nw.sich.kern);      chk('nw-s-verf',   nw.sich.verf);
  chk('nw-s-gzgsys',  nw.sich.gzgsys);
  // Slider-Bereiche
  const sl=SETTINGS.sl||{};
  const SLD=[['sl-gbx','gbx',1.0,2.5],['sl-gby','gby',1.0,2.5],['sl-ghb','ghb',1.4,3.6],
             ['sl-gkx','gkx',0.4,0.8],['sl-gky','gky',0.4,0.8],['sl-ghk','ghk',0.4,1.0],
             ['sl-phi','phi',20,40],   ['sl-beta','beta',-40,0]];
  SLD.forEach(([pfx,key,dmin,dmax])=>{
    set(pfx+'-min', sl[key]?sl[key].min:dmin);
    set(pfx+'-max', sl[key]?sl[key].max:dmax);
  });
  if(typeof loadVizUI==='function') loadVizUI();   // 3D-Darstellungs-Optionen befüllen
  if(typeof applyCameraMode==='function') applyCameraMode();
  if(typeof applyGridStyle==='function') applyGridStyle();
}

function updateSliderRanges(){
  const sl=SETTINGS.sl||{};
  [['g_bx','gbx'],['g_by','gby'],['g_hblock','ghb'],
   ['g_kx','gkx'],['g_ky','gky'],['g_hkopf','ghk']].forEach(([fid,key])=>{
    const r=document.getElementById(fid+'_r'); if(r&&sl[key]){r.min=sl[key].min;r.max=sl[key].max;}
  });
  const rp=document.getElementById('bg_phi_r'); if(rp&&sl.phi){rp.min=sl.phi.min;rp.max=sl.phi.max;}
  const rb=document.getElementById('bg_beta_r'); if(rb&&sl.beta){rb.min=sl.beta.min;rb.max=sl.beta.max;}
  const nb=document.getElementById('bg_beta'); if(nb&&sl.beta){nb.min=sl.beta.min;nb.max=sl.beta.max;}
}

// GZ-Labels in Settings-Felder laden
function loadGZLabels(){
  const lbl = SETTINGS.gz_labels || {};
  const defs = {
    t2_block:'Grundbruch · Gleiten · Sohlsp. · Steckner GZT',
    gzg_block:'Schiefstellung (Steckner Gl.11–21)',
    t2_flach:'Grundbruch · Gleiten · Sohlspannung',
    t1_flach:'Kippen / Ausmitte'
  };
  Object.entries(defs).forEach(([k,def])=>{
    const el=document.getElementById('gz_'+k);
    if(el) el.value = lbl[k]||def;
  });
  renderCustomGZList();
}

function renderCustomGZList(){
  const el=document.getElementById('gz-custom-list'); if(!el) return;
  const list = SETTINGS.gz_custom||[];
  if(!list.length){ el.innerHTML='<div style="font-size:9.5px;color:var(--xdim);font-family:var(--f-mono);padding:4px 0">Keine benutzerdefinierten Grenzzustände.</div>'; return; }
  el.innerHTML = list.map((gz,i)=>`
    <div style="background:var(--s2);border:1px solid var(--ol);border-radius:var(--r1);padding:6px 8px;margin-bottom:4px">
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px">
        <input type="text" value="${gz.label||''}" placeholder="Bezeichnung" style="flex:1;font-family:var(--f-mono);font-size:10px;background:var(--s3);border:1px solid var(--ol);border-radius:var(--r1);color:var(--on);padding:3px 6px"
          oninput="SETTINGS.gz_custom[${i}].label=this.value;refreshMatrix()"/>
        <button class="btn btn-text btn-sm" style="padding:2px 6px;display:flex;align-items:center" title="Entfernen" onclick="delCustomGZ(${i})"><svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M5 5l10 10M15 5L5 15"/></svg></button>
      </div>
      <input type="text" value="${gz.sub||''}" placeholder="Nachweise (z.B. Setzung · Schwingung)" style="width:100%;font-family:var(--f-mono);font-size:9.5px;background:var(--s3);border:1px solid var(--ol);border-radius:var(--r1);color:var(--on2);padding:3px 6px;margin-bottom:4px"
        oninput="SETTINGS.gz_custom[${i}].sub=this.value;refreshMatrix()"/>
      <div style="display:flex;gap:8px">
        <div class="field" style="flex:1"><label>γ_G</label><input type="number" value="${gz.gG||1.35}" step="0.05"
          oninput="SETTINGS.gz_custom[${i}].gG=+this.value;refreshMatrix()"/></div>
        <div class="field" style="flex:1"><label>γ_Q</label><input type="number" value="${gz.gQ||1.50}" step="0.05"
          oninput="SETTINGS.gz_custom[${i}].gQ=+this.value;refreshMatrix()"/></div>
      </div>
    </div>`).join('');
}

function addCustomGZ(){
  if(!SETTINGS.gz_custom) SETTINGS.gz_custom=[];
  SETTINGS.gz_custom.push({label:'GZ '+( SETTINGS.gz_custom.length+1), sub:'', gG:1.35, gQ:1.50});
  renderCustomGZList(); refreshMatrix();
}
function delCustomGZ(i){
  SETTINGS.gz_custom.splice(i,1); renderCustomGZList(); refreshMatrix();
}

function resetSIAPartials(){
  const sv=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v;};
  sv('set-tG',1.35); sv('set-tQ',1.50);
  sv('set-tph',1.20); sv('set-tc',1.50);
  sv('set-tEa',1.35); sv('set-tEp',1.40);
}

function applySettings(){
  const gv = id=>{ const el=document.getElementById(id); return el?+el.value:0; };
  const gvs= id=>{ const el=document.getElementById(id); return el?el.value:''; };
  const gc = id=>{ const el=document.getElementById(id); return el?el.checked:true; };
  SETTINGS.lang       = gvs('set-lang');
  SETTINGS.firma      = gvs('set-firma');
  SETTINGS.bearbeiter = gvs('set-bearbeiter');
  SETTINGS.tG   = gv('set-tG');   SETTINGS.tQ  = gv('set-tQ');
  SETTINGS.tph  = gv('set-tph');  SETTINGS.tc  = gv('set-tc');
  SETTINGS.tEa  = gv('set-tEa');  SETTINGS.tEp = gv('set-tEp');
  if(gc('set-steckner-mob')) SETTINGS.mob = gv('set-mob');   // nur bei aktiver Mobilisierung übernehmen (aus ⇒ Feld = 100 %, realer Wert bleibt erhalten)
  SETTINGS.alphaZul= gv('set-alpha-zul');
  SETTINGS.alphaZulFull = gv('set-alpha-zul-full');
  try{ _updateDeltaFacUI(); }catch(_){ }   // Reichweite haengt an nwOn('block','info')
  SETTINGS.stecknerMob = gc('set-steckner-mob');   // Passivdruck-Mobilisierung (Standard an)
  SETTINGS.stecknerSlope = gc('set-steckner-slope');
  SETTINGS.pfahlRandMin = gv('set-pfahl-randmin');
  SETTINGS.pfahlAlphaLat = Math.min(1.0, Math.max(0.1, gv('set-pfahl-alat')||0.30));   // laterale Bettung k_s
  // 0 = kein Deckel (bewusst zugelassen), sonst auf einen sinnvollen Bereich geklemmt
  { const _lc = gv('set-pfahl-lcrit'); SETTINGS.pfahlLcrit = (_lc>0) ? Math.min(40, Math.max(1, _lc)) : 0; }
  // Kernweite-Grenze: nur die zwei normativ sinnvollen Stufen (1/6 klaffungsfrei, 1/3 SIA)
  { const _ke=document.getElementById('set-kappa-e');
    SETTINGS.kappaE = (_ke && +_ke.value > 0.25) ? (1/3) : (1/6); }
  SETTINGS.bauzustandGred        = gc('set-bz-gred');
  SETTINGS.bauzustandGredVal     = Math.min(1.5, Math.max(1.0, gv('set-bz-gred-val')||1.20));
  SETTINGS.bauzustandGredSpezial = gc('set-bz-gred-spezial');
  SETTINGS.pfahlGzgDecouple = gc('set-pfahl-decouple');
  SETTINGS.pfahlLatGroup = gc('set-pfahl-latgrp');   // lateraler Gruppeneffekt (p-Multiplier)
  // bg_koernig / c1_methode NICHT in SETTINGS spiegeln — sie sind Projekt-Zustand (FDS/applyState).
  // (Früher hier gespeichert + in loadSettings zurückgelesen → überschrieb die Boden-Auswahl beim Öffnen.)
  SETTINGS.nw = {
    block: { gzt:gc('nw-b-gzt'), gzg:gc('nw-b-gzg'), info:gc('nw-b-info') },
    flach: { sohlsp:gc('nw-f-sohlsp'), grundb:gc('nw-f-grundb'), gleiten:gc('nw-f-gleiten'),
             kippen:gc('nw-f-kippen'), bishop:gc('nw-f-bishop') },
    pfahl: { geo:gc('nw-p-geo'), stahl:gc('nw-p-stahl'), knick:gc('nw-p-knick'),
             lat:gc('nw-p-lat'), gzg:gc('nw-p-gzg') },
    sich:  { lat:gc('nw-s-lat'), ax:gc('nw-s-ax'), stahl:gc('nw-s-stahl'), sys:gc('nw-s-sys'),
             kern:gc('nw-s-kern'), verf:gc('nw-s-verf'), gzgsys:gc('nw-s-gzgsys') }
  };
  // GZ-Labels aus Feldern lesen
  if(!SETTINGS.gz_labels) SETTINGS.gz_labels = {};
  ['t2_block','gzg_block','t2_flach','t1_flach'].forEach(k=>{
    const el=document.getElementById('gz_'+k); if(el) SETTINGS.gz_labels[k]=el.value;
  });
  SETTINGS.sl = {
    gbx: {min:gv('sl-gbx-min'),  max:gv('sl-gbx-max')},
    gby: {min:gv('sl-gby-min'),  max:gv('sl-gby-max')},
    ghb: {min:gv('sl-ghb-min'),  max:gv('sl-ghb-max')},
    gkx: {min:gv('sl-gkx-min'),  max:gv('sl-gkx-max')},
    gky: {min:gv('sl-gky-min'),  max:gv('sl-gky-max')},
    ghk: {min:gv('sl-ghk-min'),  max:gv('sl-ghk-max')},
    phi: {min:gv('sl-phi-min'),  max:gv('sl-phi-max')},
    beta:{min:gv('sl-beta-min'), max:gv('sl-beta-max')}
  };
  dbSet('bc_settings', SETTINGS);
  updateSliderRanges();
  if(CALC_MODEL==='pfahlbock' && typeof renderPfahlbock==='function') renderPfahlbock();
  else if(typeof calculate==='function') calculate();   // Nachweise neu (z. B. Bishop-Toggle wirkt sofort)
  closeOverlay('ov-settings');
  toast('Einstellungen gespeichert');
}

function openHandbuch(){
  window.open('handbuch.html?theme='+(SETTINGS.theme||'dark'), '_blank');
}

// ── Optionen-Overlay: Reiter statt einer langen Liste ─────────────────────
// Elf Sektionen ergaben ~400 Zeilen Fliesstext am Stück. Jetzt: fünf Reiter, und
// innerhalb eines Reiters ist jede Gruppe ein <details> — der Kopf bleibt sichtbar.
let _ovSetTab = 'allg';          // zuletzt gewählter Reiter (nur für diese Sitzung)
function setOvTab(name){
  const ov = document.getElementById('ov-settings'); if(!ov) return;
  _ovSetTab = name;
  ov.querySelectorAll('.set-tab').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
  ov.querySelectorAll('.set-pane').forEach(p => { p.style.display = (p.dataset.tab === name) ? '' : 'none'; });
  const bd = ov.querySelector('.ov-body'); if(bd) bd.scrollTop = 0;
}
// Zähler „aktiv / gesamt" am Kopf jeder Tragsystem-Gruppe — zeigt zugeklappt, ob
// dort etwas abgeschaltet ist (sonst müsste man jede Gruppe einzeln aufklappen).
function _nwCounts(){
  document.querySelectorAll('#ov-settings .nw-sub[data-sys]').forEach(d => {
    const cb = d.querySelectorAll('input[type=checkbox]');
    const on = [...cb].filter(c => c.checked).length;
    const el = d.querySelector('.nw-cnt'); if(!el) return;
    el.textContent = on + ' / ' + cb.length;
    el.classList.toggle('part', on < cb.length);
  });
}
let _nwCntWired = false;

function openSettings(){
  loadSettings();
  loadGZLabels();
  setOvTab(_ovSetTab);
  if(!_nwCntWired){
    document.getElementById('ov-settings')?.addEventListener('change', ev => {
      if(ev.target && ev.target.type === 'checkbox') _nwCounts();
    });
    _nwCntWired = true;
  }
  _nwCounts();
  document.getElementById('ov-settings')?.classList.add('open');
}

function closeOverlay(id){
  document.getElementById(id)?.classList.remove('open');
}

// ── Firmenlogo (U6): Upload → verkleinert als DataURL in SETTINGS.logo, Deckblatt der Berichte
function _loadLogoUI(){
  const p=document.getElementById('set-logo-prev'), c=document.getElementById('set-logo-clear');
  const has=!!SETTINGS.logo;
  if(p){ p.style.display=has?'':'none'; if(has) p.src=SETTINGS.logo; }
  if(c) c.style.display=has?'':'none';
}
function _setLogoFile(input){
  const f=input.files && input.files[0]; if(!f) return;
  const rd=new FileReader();
  rd.onload=()=>{
    const img=new Image();
    img.onload=()=>{
      // Verkleinern (max 420×160 px) — hält bc_settings klein, reicht fürs Deckblatt
      const sc=Math.min(1, 420/img.width, 160/img.height);
      const cv=document.createElement('canvas');
      cv.width=Math.max(1,Math.round(img.width*sc)); cv.height=Math.max(1,Math.round(img.height*sc));
      cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
      SETTINGS.logo=cv.toDataURL('image/png');
      dbSet('bc_settings',SETTINGS);
      _loadLogoUI(); toast('Logo gespeichert');
    };
    img.onerror=()=>toast('Bild konnte nicht gelesen werden');
    img.src=rd.result;
  };
  rd.readAsDataURL(f);
  input.value='';
}
function _clearLogo(){
  delete SETTINGS.logo;
  dbSet('bc_settings',SETTINGS);
  _loadLogoUI(); toast('Logo entfernt');
}
// Deckblatt-Baustein für alle drei Berichte
function _npLogo(){
  return SETTINGS.logo
    ? '<div style="text-align:right;margin-bottom:6px"><img src="'+SETTINGS.logo+'" alt="" style="max-height:52px;max-width:210px"/></div>'
    : '';
}

function toggleTheme(isLight){
  SETTINGS.theme = isLight ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', SETTINGS.theme);
  dbSet('bc_settings', SETTINGS);
  try { localStorage.setItem('bc_theme', SETTINGS.theme); } catch(e) {}
  if(typeof scene !== 'undefined' && scene)
    scene.background = new THREE.Color(isLight ? 0xe8e8ee : 0x090a0d);
  if(typeof invalidateViewer==='function') invalidateViewer();
}

// ════════════════════════════════════════════
