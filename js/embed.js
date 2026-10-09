// BlockCalc — js/embed.js
// Embed-Modus (Host-App, postMessage)
// EMBED-MODUS — Betrieb im iframe einer Host-App (Fundamentbau-App)
// ════════════════════════════════════════════
// Einbindung:  <iframe src="blockcalc/index.html?embed=1">
// Ablauf:      Guest meldet 'ready' → Host schickt 'case' (EIN Rechenfall) → der Ingenieur prüft
//              und dimensioniert → „Ergebnis übernehmen" schickt 'result' (Bauweise + Abmessungen
//              + Nachweise) zurück. Bewusst KEIN Vollautomat: jeder Fall wird gesichtet.
// Sicherheit:  Eingehende Nachrichten werden nur von erlaubten Origins angenommen; Antworten gehen
//              ausschliesslich an das validierte e.origin zurück. Nur die 'ready'-Meldung nutzt '*'
//              — der Guest kennt den Parent-Origin vorher nicht; sie enthält deshalb keine Daten.
// Auslieferung: BlockCalc als Unterordner der Host-App → same-origin, offline lauffähig und
//              versionsfest. Eine feste Version ist Voraussetzung für einen reproduzierbaren
//              Nachweis — ein iframe auf eine lebende URL änderte sonst still das Ergebnis einer
//              bereits geprüften Berechnung.
const EMBED_PROTO   = 1;
const EMBED_VERSION = 'BlockCalc 2026-08-15';
// Zusätzlich erlaubte Host-Origins (nur nötig, wenn Host und BlockCalc auf VERSCHIEDENEN Origins
// liegen). Bei Auslieferung als Unterordner bleibt die Liste leer — same-origin ist immer erlaubt.
const EMBED_ORIGINS = [];
let _embedHost = null;   // {win, origin} des Hosts, sobald validiert
let _embedCase = null;   // aktuell geladener Fall (id + meta) für die Rückmeldung

function _embedOriginOk(o){
  if(!o) return false;
  if(o === location.origin) return true;
  // file://-Auslieferung: beide Seiten haben den undurchsichtigen Origin "null"
  if(location.protocol === 'file:' && (o === 'null' || o === 'file://')) return true;
  return EMBED_ORIGINS.indexOf(o) >= 0;
}
function _embedSend(type, data){
  if(!_embedHost) return;
  try{ _embedHost.win.postMessage(Object.assign({v:EMBED_PROTO, type}, data||{}), _embedHost.origin); }catch(_){}
}
// Feld + zugehörigen Slider setzen (viele Geometriefelder haben ein `_r`-Gegenstück)
function _embedSet(id, v){
  if(v===undefined || v===null || v==='' || !isFinite(+v)) return false;
  const el=document.getElementById(id); if(!el) return false;
  el.value = String(v);
  const r=document.getElementById(id+'_r'); if(r) r.value = String(v);
  return true;
}
const _embedNum = (v, def) => (v===undefined||v===null||v===''||!isFinite(+v)) ? def : +v;

const _EMBED_MODELL_LBL = { block:MODELS.block.label, flach:MODELS.flach.label, pfahlbock:MODELS.pfahlbock.label };

// Praxisgrenzen des Standard-Blockfundaments (SBB): lässt sich ein Standort damit nicht mehr
// abdecken, wird in der Regel ein Pfahlfundament nötig. KEIN Normwert — eine Entscheidungshilfe,
// die der Ingenieur überstimmen kann. Sie ist der Grund, warum die Bauart in BlockCalc wechselbar
// sein muss: in der Fundamentbau-App steht anfangs fast immer ein Blockfundament, weil sich vorab
// nicht abschätzen lässt, ab wann es nicht mehr reicht.
const EMBED_BLOCK_MAX_T = 3.50;   // Blocktiefe [m]
const EMBED_BLOCK_MAX_B = 1.50;   // Grundfläche B bzw. L [m]
function _embedBlockGrenze(){
  if(CALC_MODEL !== 'block') return null;
  const H = +gi('g_hblock')||0, B = +gi('g_bx')||0, L = +gi('g_by')||0;
  const u = [];
  if(H > EMBED_BLOCK_MAX_T + 1e-9)
    u.push('Blocktiefe '+H.toFixed(2)+' m > '+EMBED_BLOCK_MAX_T.toFixed(2)+' m');
  if(Math.max(B,L) > EMBED_BLOCK_MAX_B + 1e-9)
    u.push('Grundfläche '+B.toFixed(2)+'×'+L.toFixed(2)+' m > '+EMBED_BLOCK_MAX_B.toFixed(2)+'×'+EMBED_BLOCK_MAX_B.toFixed(2)+' m');
  return u.length ? u : null;
}

// Lastniveau zum Typenschlüssel suchen (Standardlasten 0161.1011.0002_a liegen als importierte
// DATEN in den Lastniveaus, nicht im Code — SBB-Strukturdaten bleiben so aus der App heraus).
function _embedFindLvl(typ, vFall){
  if(!typ) return null;
  // Auf Buchstaben/Ziffern normalisieren → „DP2a|V150", „DP2a · V=150" und „DP2A V 150" treffen gleich
  const norm = s => String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  const want = norm(typ) + 'V' + (String(vFall)==='min' ? '0' : '150');
  return LOAD_LVLS.find(l => norm(l.key)===want) || LOAD_LVLS.find(l => norm(l.name)===want) || null;
}

// ── Fall anwenden ───────────────────────────────────────────────────────────
// Semantisches Austauschformat → BlockCalc-Felder. Der Mapper lebt bewusst HIER: ändern sich
// BlockCalc-Feldnamen, wird er in derselben Datei nachgezogen; die Host-App bleibt unberührt.
function _embedApplyCase(c){
  const warn = [];
  const g = c.geometrie || {}, b = c.baugrund || {}, la = c.lasten || {};

  // ── Modell
  const MODMAP = { block:'block', blockfundament:'block',
                   flach:'flach', flachfundament:'flach', stahlplatte:'flach', platte:'flach',
                   pfahl:'pfahlbock', pfahlfundament:'pfahlbock', pfahlbock:'pfahlbock' };
  const modell = MODMAP[String(c.modell||'block').toLowerCase().replace(/\s+/g,'')] || 'block';
  if(c.modell && !MODMAP[String(c.modell).toLowerCase().replace(/\s+/g,'')])
    warn.push('Unbekannte Bauweise «'+c.modell+'» — als Blockfundament gerechnet.');
  _applyingState = true;
  try{ setModel(modell, true); } finally { _applyingState = false; }

  // ── Überdeckung / Kopfhöhe
  // Seit Aug 2026 gleiche Konvention wie in der Host-App: H_Kopf = GESAMTMASS OK Block → OK Kopf.
  // Die Kopfhöhe wird also unverändert übernommen; nur die Überdeckung muss noch abgeleitet werden:
  //   ü = kopfHoehe − Überstand        H_Kopf(BlockCalc) = kopfHoehe
  const kh = _embedNum(g.kopfHoehe, 1.00);
  let ue = _embedNum(g.ueberdeckung, null);
  if(ue === null){
    let ust = _embedNum(g.ueberstand, null);
    if(ust === null && g.okKopf!=null && g.terrain!=null) ust = +g.okKopf - +g.terrain;
    ue = (ust === null) ? 0.40 : Math.max(0, kh - ust);   // ohne Terrainhöhe: Standard 0.40 m
    if(ust === null) warn.push('Keine Terrainhöhe übergeben — Überdeckung mit dem Standardwert 0.40 m angesetzt.');
  }
  const hKopf = kh;   // Gesamthöhe, identisch zur Host-App

  if(modell === 'pfahlbock'){
    _embedSet('pb_bx', g.B); _embedSet('pb_by', g.L);
    _embedSet('pb_bank_d', g.H_Bankett ?? g.H_Block);
    _embedSet('pb_kx', g.B_Kopf); _embedSet('pb_ky', g.L_Kopf);
    // pb_hk wird wie g_hkopf ab der Körper-Oberkante (hier OK Bankett) gemessen ⇒ Gesamthöhe
    _embedSet('pb_hk', hKopf);    _embedSet('pb_ue', ue);
    _embedSet('pb_L',  g.pfahlLaenge);
    // Ein einzelner Pfahl ist keine Gruppe: Pfahlfundament auf «Einzelpfahl» stellen
    // (Mastlasten greifen direkt am Pfahlkopf an, kein Bankett, kein Hebel).
    const _ein = +g.pfahlAnzahl === 1;
    const ms = document.getElementById('pb_mode');
    if(ms){ ms.value = _ein ? 'einzel' : 'gruppe'; if(typeof onPbMode==='function') onPbMode(); }
    // Einzelpfahl: der Überstand des Kopfes über Terrain IST die freie Länge über GOK (pb_e).
    // Sie geht unbettet in die Biegung ein — ohne sie wäre das Moment deutlich zu klein.
    if(_ein) _embedSet('pb_e', hKopf);
    if(g.pfahlAnzahl && !_ein){ const s=document.getElementById('pb_n');
      if(s && [...s.options].some(o=>o.value===String(g.pfahlAnzahl))) s.value=String(g.pfahlAnzahl);
      else warn.push('Pfahlzahl '+g.pfahlAnzahl+' nicht im Auswahlsatz — Vorgabe beibehalten.'); }
    _embedSet('pb_ex', g.e_x); _embedSet('pb_ey', g.e_y);
  } else {
    _embedSet('g_bx', g.B); _embedSet('g_by', g.L); _embedSet('g_hblock', g.H_Block);
    _embedSet('g_kx', g.B_Kopf); _embedSet('g_ky', g.L_Kopf);
    _embedSet('g_hkopf', hKopf);
    _embedSet('g_uberd', ue); _embedSet('g_uberd_flach', ue);
    _embedSet('g_ex', g.e_x); _embedSet('g_ey', g.e_y);
  }

  // ── Baugrund
  if(Array.isArray(b.schichten) && b.schichten.length){
    SCHICHTEN = b.schichten.map((s,i,arr)=>({
      name:   s.name || '',
      preset: s.preset || '',
      phi:    _embedNum(s.phi, 27),   c:      _embedNum(s.c, 0),
      gamma:  _embedNum(s.gamma, 20), gamma2: _embedNum(s.gamma2, 10),
      me:     _embedNum(s.me, 25),
      qs:     (s.qs==null||s.qs==='') ? undefined : +s.qs,
      d:      (i===arr.length-1) ? 999 : _embedNum(s.d, 999)   // letzte Schicht immer unendlich
    }));
    renderSchichten();
    _embedSet('bg_me', SCHICHTEN[0].me);
    if(b.qu!=null){ _embedSet('bg_qu', b.qu); _embedSet('bg_qu_flach', b.qu); }
  } else warn.push('Keine Schichtdaten übergeben — Baugrund der Voreinstellung verwendet.');

  // ── Grundwasser
  const gwSel = document.getElementById('bg_gw');
  if(gwSel){
    const hasGW = !!b.gw && b.gwTiefe!=null;
    gwSel.value = hasGW ? 'ja' : 'nein';
    if(hasGW) _embedSet('bg_gwt', b.gwTiefe);
    else if(b.gw && b.gwTiefe==null) warn.push('Grundwasser gemeldet, aber ohne Tiefe — nicht angesetzt.');
  }

  // ── Geländeneigung (konservativ: Klassenobergrenze, Böschung durchlaufend)
  const n = b.neigung || {};
  let beta = _embedNum(n.beta, null);
  if(beta === null && n.klasse){
    const K = { 'flach':0, '<=14':14, '14':14, '14-33':33, '>14':33, '33':33 };
    beta = K[String(n.klasse).toLowerCase().replace(/[°\s]/g,'')] ?? null;
    if(beta === null) warn.push('Neigungsklasse «'+n.klasse+'» unbekannt — Gelände waagrecht gerechnet.');
    else if(beta > 0) warn.push('Neigungsklasse «'+n.klasse+'» konservativ mit der Klassenobergrenze β = '+beta+'° angesetzt.');
  }
  beta = beta === null ? 0 : -Math.abs(beta);         // BlockCalc: abfallend = negativ
  _embedSet('bg_beta', beta);
  const btyp = document.getElementById('bg_btyp');
  if(btyp) btyp.value = Math.abs(beta) > 0.1 ? 'boeschung' : 'none';
  _embedSet('bg_bhoehe', _embedNum(n.hoehe, 0));      // 0 = durchlaufend = volle Abminderung
  _embedSet('bg_bfuss',  _embedNum(n.fuss, 0));

  // ── Lastfälle: quer UND längs einzeln, wie 0161.1011.0002_a es verlangt
  LF = [
    { name:'LF 1 — Quer zum Gleis', preset:'quer', gG:1.35, gW:1.5, nw:'beide',
      comp:{ NG:true, HGx:true, HGy:false, MGx:false, MGy:true, HWx:true, HWy:false, MWx:false, MWy:true } },
    { name:'LF 2 — Längs zum Gleis', preset:'laengs', gG:1.35, gW:1.5, nw:'beide',
      comp:{ NG:true, HGx:false, HGy:true, MGx:true, MGy:false, HWx:false, HWy:true, MWx:true, MWy:false } }
  ];
  renderLF();

  // ── Lasten: explizite Werte haben Vorrang, sonst Auflösung über den Typenschlüssel
  const W = la.werte;
  if(W && typeof W === 'object'){
    ['NG','HGx','HGy','MGx','MGy','HWx','HWy','MWx','MWy'].forEach(k => _embedSet('l_'+k, _embedNum(W[k], 0)));
  } else if(la.typ){
    const lvl = _embedFindLvl(la.typ, la.vFall);
    if(lvl) ['NG','HGx','HGy','MGx','MGy','HWx','HWy','MWx','MWy'].forEach(k => _embedSet('l_'+k, _embedNum(lvl[k], 0)));
    else warn.push('Lastniveau «'+la.typ+' / V='+(la.vFall==='min'?'0':'150')+'» nicht gefunden — Standardlasten importieren oder Werte direkt übergeben.');
  } else warn.push('Keine Lasten übergeben.');
  if(la.torsion) warn.push('Torsionsmoment T = '+la.torsion+' kNm wird von BlockCalc nicht geführt.');

  // ── Projektangaben
  const m = c.meta || {};
  [['p_name',m.projekt],['p_fundname',m.fundament],['p_nr',m.projektNr],['p_km',m.km],
   ['p_mastnr',m.mastNr],['p_bearbeiter',m.bearbeiter],['p_bemerk',m.bemerkung]]
   .forEach(([id,v]) => { if(v!=null){ const el=document.getElementById(id); if(el) el.value=String(v); } });

  // Geometrie-Slot des aktiven Modells mit den geladenen Feldern synchron halten
  if(modell==='block'||modell==='flach') _geom[modell]=_readGeom();

  _currentProjKey = null;              // Embed-Fälle sind keine gespeicherten Positionen
  if(typeof formatMeterInputs==='function') formatMeterInputs();
  if(typeof updateSB==='function') updateSB();
  if(typeof autoC1==='function') autoC1();
  rebuildScene();
  calculate();
  return warn;
}

// ── Ergebnis zusammenstellen ────────────────────────────────────────────────
function _embedBuildResult(){
  const e = _evalCurrent();
  const num = id => +gi(id)||0;
  const BAUWEISE = { block:'Blockfundament',
                     flach:(FLACH_MAT==='stahl' ? 'Stahlplatte' : 'Flachfundament'),
                     pfahlbock:'Pfahlfundament' };
  const g = e.geom || {};
  let vol = null;
  if(e.model!=='pfahlbock' && g.B && g.L)
    vol = +(g.B*g.L*(g.H_Block||0) + (g.B_Kopf||0)*(g.L_Kopf||0)*((g.H_Kopf||0)+(g.ueberdeckung||0))).toFixed(2);
  const vorher = _embedCase ? _embedCase.modell : null;
  const hinweise = ((_embedCase && _embedCase.warn) || []).slice();
  const gr = _embedBlockGrenze();
  if(gr) hinweise.push('Grenze Standard-Blockfundament überschritten ('+gr.join(', ')+') — Pfahlfundament prüfen.');
  return {
    schema: 'blockcalc.result/1',
    id: _embedCase ? _embedCase.id : null,
    version: EMBED_VERSION,
    zeitpunkt: new Date().toISOString(),
    modell: e.model,
    bauweise: BAUWEISE[e.model] || e.model,
    modellVorher: vorher,
    modellGeaendert: !!(vorher && vorher !== e.model),
    bauweiseVorher: vorher ? (BAUWEISE[vorher] || vorher) : null,
    abmessung: g,
    abmessungText: e.dims,
    betonKubatur: vol,
    nachweise: {
      etaGZT: e.etaT, etaGZG: e.etaG, etaMin: e.etaMin,
      massgebend: e.gov, lastfall: e.lf, erfuellt: e.ok
    },
    lasten: _embedCase ? (_embedCase.lasten || null) : null,
    hinweise
  };
}

// ── Nachrichten ─────────────────────────────────────────────────────────────
function _embedOnMessage(ev){
  if(!window._EMBED_MODE) return;
  const d = ev.data;
  if(!d || typeof d !== 'object' || String(d.type||'').indexOf('blockcalc:') !== 0) return;
  if(!_embedOriginOk(ev.origin)){
    console.warn('[BlockCalc] Nachricht von nicht erlaubtem Origin verworfen:', ev.origin);
    return;
  }
  _embedHost = { win: ev.source, origin: ev.origin };
  try{
    if(d.type === 'blockcalc:ping'){ _embedSend('blockcalc:pong', {version:EMBED_VERSION}); return; }
    if(d.type === 'blockcalc:case'){
      const c = d.payload || {};
      const warn = _embedApplyCase(c);
      // Bauart beim Laden festhalten: wechselt der Ingenieur sie hier (Blockfundament reicht nicht
      // mehr → Pfahlfundament), muss der Host das erfahren und übernehmen können.
      _embedCase = { id: c.id ?? null, meta: c.meta || {}, lasten: c.lasten || null,
                     modell: CALC_MODEL, warn };
      _embedRenderBar();
      _embedSend('blockcalc:loaded', { id: _embedCase.id, hinweise: warn });
      if(warn.length) toast(warn.length+' Hinweis'+(warn.length>1?'e':'')+' zur Übernahme — siehe Leiste');
    }
  }catch(err){
    console.error('[BlockCalc] Embed-Fehler:', err);
    _embedSend('blockcalc:error', { id: d.payload&&d.payload.id, message: String(err&&err.message||err) });
  }
}

function _embedSubmit(){
  try{ _embedSend('blockcalc:result', { id: _embedCase?_embedCase.id:null, payload: _embedBuildResult() });
       toast('Ergebnis an die Fundamentbau-App übergeben'); }
  catch(err){ toast('Übergabe fehlgeschlagen: '+(err&&err.message||err)); }
}

// ── Leiste ──────────────────────────────────────────────────────────────────
function _embedRenderBar(){
  const bar = document.getElementById('embed-bar'); if(!bar) return;
  const m = (_embedCase && _embedCase.meta) || {};
  const fund = m.fundament ? String(m.fundament) : '';
  // Mast-Nr. nur zeigen, wenn sie nicht ohnehin im Fundamentnamen steckt („Mast 42" · Mast 42)
  const mast = (m.mastNr && !new RegExp('(^|\\D)'+String(m.mastNr).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'($|\\D)').test(fund))
               ? 'Mast '+m.mastNr : '';
  const t = [fund, mast, m.km ? 'km '+m.km : ''].filter(Boolean).join(' · ') || 'Kein Fall geladen';
  const w = (_embedCase && _embedCase.warn) || [];
  bar.querySelector('.eb-title').textContent = t;
  const wl = bar.querySelector('.eb-warn');
  wl.style.display = w.length ? '' : 'none';
  wl.title = w.join('\n');
  wl.querySelector('span').textContent = w.length + (w.length===1?' Hinweis':' Hinweise');

  // Bauart-Wechsel und Grenzüberschreitung schon BEIM Dimensionieren zeigen, nicht erst danach
  const note = bar.querySelector('.eb-note');
  if(note){
    const vor = _embedCase && _embedCase.modell;
    const parts = [];
    if(vor && vor !== CALC_MODEL)
      parts.push('Bauart geändert: '+(_EMBED_MODELL_LBL[vor]||vor)+' → '+(_EMBED_MODELL_LBL[CALC_MODEL]||CALC_MODEL));
    const gr = _embedBlockGrenze();
    if(gr) parts.push('Grenze Standard-Blockfundament überschritten ('+gr.join(', ')+') — Pfahlfundament prüfen');
    note.style.display = parts.length ? '' : 'none';
    note.textContent = parts.join('   ·   ');
    note.classList.toggle('warn', !!gr);
  }
}
function _embedInit(){
  document.documentElement.classList.add('embed');
  const bar = document.createElement('div');
  bar.id = 'embed-bar'; bar.className = 'embed-bar';
  bar.innerHTML =
    '<svg class="eb-ico" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6">'
    + '<rect x="1.5" y="2.5" width="11" height="9" rx="1"/><path d="M1.5 5.5h11"/></svg>'
    + '<span class="eb-title">Kein Fall geladen</span>'
    + '<button class="eb-warn" type="button" onclick="alert((_embedCase&&_embedCase.warn||[]).join(String.fromCharCode(10,10)))">'
    + '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6">'
    + '<path d="M6 1.5L11 10.5H1z"/><path d="M6 5v2.2"/><path d="M6 8.8v.2"/></svg><span></span></button>'
    + '<span class="eb-note" style="display:none"></span>'
    + '<span style="flex:0 1 auto;min-width:8px"></span>'
    // Nur die Aktion, die etwas bewirkt. Das Verlassen ohne Ergebnis erledigt der Host oben
    // rechts („Schliessen") — ein zweiter, gleich aussehender Abbruch hier wäre dasselbe
    // in Grün und liesse offen, welcher der beiden der harmlose ist.
    + '<button class="eb-btn pri" type="button" onclick="_embedSubmit()">Ergebnis übernehmen</button>';
  (document.querySelector('.app')||document.body).appendChild(bar);
  window.addEventListener('message', _embedOnMessage);
  // Host kennt unseren Origin nicht vorab → 'ready' an '*', ohne jeden Dateninhalt
  try{ window.parent.postMessage({v:EMBED_PROTO, type:'blockcalc:ready', version:EMBED_VERSION}, '*'); }catch(_){}
}
