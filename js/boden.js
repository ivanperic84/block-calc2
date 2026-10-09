// BlockCalc — js/boden.js
// Bodenprofile, Schichten, Boden-Templates
// BAUGRUND PRESETS
// ════════════════════════════════════════════
const BGP = {
  kies:         { phi:38, c:0,   gamma:20.0, gamma2:10.5, qu:400, me:80,  warn:null },
  sand:         { phi:32, c:0,   gamma:19.0, gamma2:9.5,  qu:250, me:40,  warn:null },
  schluff:      { phi:28, c:5,   gamma:18.5, gamma2:8.5,  qu:150, me:15,  warn:null },
  ton:          { phi:20, c:20,  gamma:18.0, gamma2:8.0,  qu:100, me:12,  warn:null },
  fels:         { phi:45, c:100, gamma:26.0, gamma2:16.0, qu:800, me:500, warn:null },
  ton_weich:    { phi:18, c:15,  gamma:17.5, gamma2:7.5,  qu:60,  me:6,   warn:'M_E = Erfahrungswert für weichen Ton — Feldversuche (Plattendruckversuch, CPT) empfohlen' },
  sand_locker:  { phi:28, c:0,   gamma:17.5, gamma2:8.0,  qu:150, me:18,  warn:null },
  aufsch_verd:  { phi:30, c:0,   gamma:20.0, gamma2:10.0, qu:150, me:20,  warn:'Auffüllung — M_E = Erfahrungswert (verdichtet). Feldnachweis durch Plattendruckversuch empfohlen.' },
  aufsch_locker:{ phi:25, c:0,   gamma:18.0, gamma2:8.5,  qu:80,  me:5,   warn:'Auffüllung locker — M_E sehr tief. Steckner GZG nicht gültig. Feldnachweis zwingend empfohlen.' },
  // Modellboden = projektspezifischer Referenzboden (Standard-Annahme ohne Baugrunduntersuchung).
  // Werte vom Nutzer vorgegeben (Jul 2026): φ'=27, c'=0, γ=20, M_E=25 — über die Tabelle anpassbar.
  modellboden:  { phi:27, c:0,   gamma:20.0, gamma2:10.0, qu:200, me:25,  warn:'Modellboden = Standard-Referenz ohne Baugrunduntersuchung — Werte projektspezifisch anpassen und durch Feldnachweis bestätigen.' },
};
// Reihenfolge + Anzeigenamen + Gruppe der Standard-Bodenprofile (eine Quelle für Tabelle + Dropdown)
const BGP_META = [
  {key:'kies',          name:'Kies',                   grp:'std'},
  {key:'sand',          name:'Sand',                   grp:'std'},
  {key:'schluff',       name:'Schluff',                grp:'std'},
  {key:'ton',           name:'Ton, steif',             grp:'std'},
  {key:'fels',          name:'Fels',                   grp:'std'},
  {key:'ton_weich',     name:'Ton, weich',             grp:'spec'},
  {key:'sand_locker',   name:'Sand, locker',           grp:'spec'},
  {key:'aufsch_verd',   name:'Auffüllung, verdichtet', grp:'spec'},
  {key:'aufsch_locker', name:'Auffüllung, locker',     grp:'spec'},
  {key:'modellboden',   name:'Modellboden',            grp:'modell'},
];
// Standard-Presets sind editierbar: Nutzer-Overrides (bc_bgp_over) über die Defaults gemischt (je Feld,
// inkl. Name aus BGP_META als Basis → per Override umbenennbar).
function bgpMerged(){ const ov=dbGet('bc_bgp_over')||{}; const o={};
  for(const k in BGP){ const meta=BGP_META.find(m=>m.key===k);
    o[k]=Object.assign({ name: meta?meta.name:k }, BGP[k], ov[k]||{}); } return o; }
function bgpOverField(key, field, val){
  const ov=dbGet('bc_bgp_over')||{}; if(!ov[key]) ov[key]={};
  ov[key][field]=val; dbSet('bc_bgp_over', ov);
  renderBGPresetTable();   // • Marke + evtl. Reset-Knopf
  renderSchichten();       // Dropdown-Labels (M_E) nachführen — bestehende Schichten behalten ihre Werte
  scheduleCalc();
}
function bgpResetKey(key){
  const ov=dbGet('bc_bgp_over')||{}; delete ov[key]; dbSet('bc_bgp_over', ov);
  renderBGPresetTable(); renderSchichten(); scheduleCalc();
}
// Editierbare Tabelle der Standard-Bodenprofile (φ'/c'/γ/M_E). Edit gilt für NEUE Schicht-Zuweisungen;
// bereits zugewiesene Schichten behalten ihre kopierten Werte. „•" = überschrieben, Reset stellt Default her.
function renderBGPresetTable(){
  const el=document.getElementById('bgp-std-list'); if(!el) return;
  const M=bgpMerged(), ov=dbGet('bc_bgp_over')||{};
  const rowsFor = grp => BGP_META.filter(m=>m.grp===grp).map(m=>{ const p=M[m.key], edited=!!ov[m.key];
    return `<tr>
      <td style="text-align:left;white-space:nowrap"><input class="ll-inp ll-name" value="${p.name||m.name}" style="width:100px"
        onchange="bgpOverField('${m.key}','name',this.value)"/>${edited?' <span style="color:var(--acc)" title="überschrieben">•</span>':''}</td>
      <td><input class="ll-inp" type="number" value="${p.phi}" step="0.5" onchange="bgpOverField('${m.key}','phi',+this.value)"/></td>
      <td><input class="ll-inp" type="number" value="${p.c}" step="0.5" onchange="bgpOverField('${m.key}','c',+this.value)"/></td>
      <td><input class="ll-inp" type="number" value="${p.gamma}" step="0.5" onchange="bgpOverField('${m.key}','gamma',+this.value)"/></td>
      <td><input class="ll-inp" type="number" value="${p.me}" step="1" onchange="bgpOverField('${m.key}','me',+this.value)"/></td>
      <td>${edited?`<button class="btn btn-tonal btn-sm" title="Auf Standard zurücksetzen" onclick="bgpResetKey('${m.key}')" style="padding:0 6px">↺</button>`:''}</td>
    </tr>`; }).join('');
  const grpHd = t => `<tr><td colspan="6" style="text-align:left;padding-top:5px;color:var(--xdim);font-size:8.5px;letter-spacing:.04em;border:none">${t}</td></tr>`;
  const groups=[['STANDARD','std'],['SONDERBÖDEN','spec'],['MODELLBODEN','modell']];
  const body=groups.map(([lbl,g])=>{ const r=rowsFor(g); return r?grpHd(lbl)+r:''; }).join('');
  el.innerHTML = `<div class="ll-wrap"><table class="ll-tbl">
    <thead><tr><th style="text-align:left">Bodenprofil</th><th>φ' °</th><th>c' kPa</th><th>γ kN/m³</th><th>M_E</th><th></th></tr></thead>
    <tbody>${body}</tbody></table></div>`;
  const sum=document.getElementById('bgp-std-summary');
  if(sum){ const nOv=Object.keys(ov).length; sum.textContent = nOv?`${BGP_META.length} Profile · ${nOv} bearbeitet`:`${BGP_META.length} Profile`; }
}

function updateGWField(){
  const wrap = document.getElementById('bg_gwt_wrap');
  if(!wrap) return;
  const hasGW = gi('bg_gw') === 'ja';
  wrap.style.opacity = hasGW ? '1' : '0.35';
  wrap.style.pointerEvents = hasGW ? '' : 'none';
}

function autoBtyp(){
  const beta=Math.abs(+gi('bg_beta'));
  const bfuss=+gi('bg_bfuss');
  const sel=document.getElementById('bg_btyp');
  if(!sel)return;
  if(beta<0.1)       sel.value='none';
  else if(bfuss<=0)  sel.value='aufgegraben';
  else               sel.value='boeschung';
  updateViewer();
}

// ════════════════════════════════════════════
// BODENSCHICHTEN
// ════════════════════════════════════════════
let SCHICHTEN = [
  {phi:35, c:0, gamma:20.0, gamma2:10.0, d:999, name:'Schicht 1 (ab GOK)', preset:'kies', me:80}
];

// Bodentyp-Chip aus Schichteigenschaften
function schichtTypeInfo(s){
  const p = s.preset;
  if(p==='kies'||s.phi>=36)  return {label:'Kies',   cls:'kies'};
  if(p==='sand'||s.phi>=30)  return {label:'Sand',   cls:'sand'};
  if(p==='schluff'||s.phi>=24) return {label:'Schluff',cls:'schluff'};
  if(p==='ton'||s.phi>=15)   return {label:'Ton',    cls:'ton'};
  if(p==='fels'||s.phi>=44)  return {label:'Fels',   cls:'fels'};
  return {label:'Boden', cls:''};
}

// Tiefenbereich für Schicht i berechnen
function schichtDepthStr(i){
  let z=0;
  for(let j=0;j<i;j++) z += SCHICHTEN[j].d===999 ? 0 : SCHICHTEN[j].d;
  const top = z.toFixed(1);
  const bot = SCHICHTEN[i].d===999 ? '∞' : (z+SCHICHTEN[i].d).toFixed(1);
  return `${top} – ${bot} m`;
}

// Dropdown für Preset-Auswahl im Kartenkopf
// Kurzbezeichnung für Kartenkopf
function schichtHeaderLabel(s){
  const M = bgpMerged();
  if(s.preset && M[s.preset]) return (M[s.preset].name||s.preset).slice(0,14);   // editierbare Standard-Presets
  if(s.preset){
    const tpl = getBGTemplates().find(t=>t.id===s.preset);
    if(tpl) return (tpl.kuerzel || tpl.name).slice(0,14);
  }
  return s.name ? s.name.slice(0,14) : '—';
}

// Dropdown für Profil-Auswahl (jetzt im Card-Body)
function schichtPresetDropdown(i){
  const s = SCHICHTEN[i];
  const cur = s.preset||'';
  const M = bgpMerged();
  const tpls = getBGTemplates();
  const stdKeys = BGP_META.map(m=>m.key);
  const isCustom = !stdKeys.includes(cur) && !tpls.find(t=>t.id===cur);
  const opt = k => { const p=M[k];
    return `<option value="${k}" ${cur===k?'selected':''}>${p.name} (M_E ${p.me})${p.warn?' ⚠':''}</option>`; };
  const g = grp => BGP_META.filter(m=>m.grp===grp).map(m=>opt(m.key)).join('');
  return `<select class="sch-preset-sel" id="sch-sel-${i}"
    onchange="applySchichtPreset(${i},this.value)">
    <optgroup label="Standard">${g('std')}</optgroup>
    <optgroup label="Sonderböden">${g('spec')}</optgroup>
    <optgroup label="Modellboden">${g('modell')}</optgroup>
    ${tpls.length?`<optgroup label="Gespeichert">${tpls.map(t=>`<option value="__tpl__${t.id}" ${cur===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</optgroup>`:''}
    ${isCustom?`<option value="" selected>—</option>`:''}
  </select>`;
}

function renderSchichten(){
  const list = document.getElementById('schichten-list');
  if(!list) return;
  // Offene Karten merken
  const openSet = new Set();
  list.querySelectorAll('.lf-card').forEach((el,i)=>{ if(el.classList.contains('open')) openSet.add(i); });
  list.innerHTML = '';
  SCHICHTEN.forEach((s,i)=>{
    const {label,cls} = schichtTypeInfo(s);
    const depthStr = schichtDepthStr(i);
    const isOpen = openSet.has(i) || (openSet.size===0 && i===0); // erste Schicht standardmässig offen
    const card = document.createElement('div');
    card.className = 'lf-card' + (isOpen?' open':'');

    // Schicht 1: globale Felder mit IDs; Schicht 2+: inline SCHICHTEN-Update
    const phiField = i===0
      ? `<div class="sl-wrap"><input type="range" class="sl-rng" id="bg_phi_r" min="20" max="40" step="1" value="${s.phi}" oninput="slSync('bg_phi',this.value);SCHICHTEN[0].phi=+this.value;updateSchichtChip(0);scheduleCalc()"><input id="bg_phi" type="number" value="${s.phi}" step="0.5" oninput="slSync('bg_phi',this.value);SCHICHTEN[0].phi=+this.value;updateSchichtChip(0);scheduleCalc()"/></div>`
      : `<input type="number" value="${s.phi}" step="0.5" oninput="SCHICHTEN[${i}].phi=+this.value;updateSchichtChip(${i});scheduleCalc()"/>`;
    const cField = i===0
      ? `<input id="bg_c" type="number" value="${s.c}" step="0.5" oninput="SCHICHTEN[0].c=+this.value;scheduleCalc()"/>`
      : `<input type="number" value="${s.c}" step="0.5" oninput="SCHICHTEN[${i}].c=+this.value;scheduleCalc()"/>`;
    const gammaField = i===0
      ? `<input id="bg_gamma" type="number" value="${s.gamma}" step="0.5" oninput="SCHICHTEN[0].gamma=+this.value;scheduleCalc()"/>`
      : `<input type="number" value="${s.gamma}" step="0.5" oninput="SCHICHTEN[${i}].gamma=+this.value;scheduleCalc()"/>`;
    card.innerHTML = `
      <div class="lf-card-head" onclick="toggleSchichtCard(${i})">
        <span class="sch-badge">${i+1}</span>
        <span class="sch-preset-lbl" id="sch-lbl-${i}">${schichtHeaderLabel(s)}</span>
        <span class="sch-depth-lbl" id="sch-depth-${i}">${depthStr}</span>
        <svg class="lf-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 2l4 4-4 4"/></svg>
        ${SCHICHTEN.length>1?`<button class="btn btn-text" style="padding:0 4px;height:22px;flex-shrink:0" onclick="event.stopPropagation();removeSchicht(${i})"><svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 2l8 8M10 2L2 10"/></svg></button>`:''}
      </div>
      <div class="lf-card-body">
        <div class="g2">
          <div class="field"><label>Bodenprofil</label>${schichtPresetDropdown(i)}</div>
          <div class="field"><label>Schichtdicke <em>m</em></label><input type="number" value="${s.d===999?'':s.d}" step="0.1" placeholder="∞ (letzte)" oninput="SCHICHTEN[${i}].d=this.value===''?999:+this.value;refreshSchichtDepths();scheduleCalc()"/></div>
        </div>
        <div class="g2">
          <div class="field"><label>γ Wichte <em>kN/m³</em></label>${gammaField}</div>
          ${i===0?`<div class="field"><label>γ' Auftriebswichte <em>kN/m³</em></label><input id="bg_gamma2" type="number" value="${s.gamma2??10.0}" step="0.5" oninput="SCHICHTEN[0].gamma2=+this.value;scheduleCalc()"/></div>`:`<div class="field"><label>γ' Auftriebswichte <em>kN/m³</em></label><input type="number" value="${s.gamma2??10.0}" step="0.5" oninput="SCHICHTEN[${i}].gamma2=+this.value;scheduleCalc()"/></div>`}
        </div>
        <div class="field"><label>φ' Reibungswinkel <em>°</em></label>${phiField}</div>
        <div class="g2">
          <div class="field"><label>c' Kohäsion <em>kPa</em></label>${cField}</div>
          <div class="field"><label>M_E Steifemodul <em>MN/m²</em></label><input type="number" value="${s.me??20}" step="1" oninput="SCHICHTEN[${i}].me=+this.value;scheduleCalc()"/></div>
        </div>
        <div class="field"><label>q_s,k Mantelreibung Mikropfahl <em>kPa</em></label><input type="number" value="${s.qs??''}" step="5" placeholder="auto: ${Math.round(microQsExp(s))} kPa (EA-Pfähle)" oninput="SCHICHTEN[${i}].qs=this.value===''?undefined:+this.value;scheduleCalc()"/></div>
      </div>`;
    list.appendChild(card);
  });
  if(typeof formatMeterInputs==='function') formatMeterInputs(list); // Schichtdicke (m) 2 Dezimalst.
}

function toggleSchichtCard(i){
  const cards = document.querySelectorAll('#schichten-list .lf-card');
  if(cards[i]) cards[i].classList.toggle('open');
}

function updateSchichtChip(i){
  const lbl = document.getElementById(`sch-lbl-${i}`);
  if(lbl) lbl.textContent = schichtHeaderLabel(SCHICHTEN[i]);
}

function refreshSchichtDepths(){
  SCHICHTEN.forEach((_,i)=>{
    const el = document.getElementById(`sch-depth-${i}`);
    if(el) el.textContent = schichtDepthStr(i);
  });
}

function applySchichtPreset(i, key){
  if(key.startsWith('__tpl__')){
    const id = key.replace('__tpl__','');
    const tpl = getBGTemplates().find(t=>t.id===id);
    if(!tpl) return;
    // Werte aus gespeichertem Profil (primäre Parameter)
    const d = tpl.data;
    SCHICHTEN[i].phi    = parseFloat(d.bg_phi)||35;
    SCHICHTEN[i].c      = parseFloat(d.bg_c)||0;
    SCHICHTEN[i].gamma  = parseFloat(d.bg_gamma)||20;
    SCHICHTEN[i].gamma2 = parseFloat(d.bg_gamma2)||10;
    SCHICHTEN[i].me     = parseFloat(d.bg_me)||20;
    SCHICHTEN[i].preset = id;
    if(i===0) applyBGState(d);
  } else {
    const p = bgpMerged()[key]; if(!p) return;   // editierbare Standard-Presets (Nutzer-Overrides)
    SCHICHTEN[i].phi    = p.phi;
    SCHICHTEN[i].c      = p.c;
    SCHICHTEN[i].gamma  = p.gamma;
    SCHICHTEN[i].gamma2 = p.gamma2??10.0;
    SCHICHTEN[i].me     = p.me??20;
    SCHICHTEN[i].preset = key;
    if(i===0){
      si('bg_phi',p.phi); si('bg_c',p.c);
      si('bg_gamma',p.gamma); si('bg_gamma2',p.gamma2??10.0);
      si('bg_qu',p.qu); si('bg_me',p.me??20);
    }
  }
  renderSchichten(); // neu rendern für Chip-Update + Preset-Markierung
  // Warn-Hinweis für Auffüllungen und Sonderböden
  const warnEl = document.getElementById('bg_preset_warn');
  if(warnEl){
    const warnTxt = (!key.startsWith('__tpl__') && BGP[key]) ? (BGP[key].warn||'') : '';
    warnEl.textContent = warnTxt;
    warnEl.style.display = warnTxt ? '' : 'none';
  }
  autoC1();
  scheduleCalc();
}

function addSchicht(){
  if(SCHICHTEN.length >= 4){ toast('Maximal 4 Schichten'); return; }
  if(SCHICHTEN[SCHICHTEN.length-1].d===999) SCHICHTEN[SCHICHTEN.length-1].d = 2.0;
  SCHICHTEN.push({phi:30,c:5,gamma:19.0,gamma2:10.0,d:999,name:`Schicht ${SCHICHTEN.length+1}`,me:15});
  renderSchichten();
  // Neue Karte öffnen
  const cards = document.querySelectorAll('#schichten-list .lf-card');
  if(cards.length) cards[cards.length-1].classList.add('open');
  scheduleCalc();
}

function removeSchicht(i){
  SCHICHTEN.splice(i,1);
  if(SCHICHTEN.length>0) SCHICHTEN[SCHICHTEN.length-1].d=999;
  SCHICHTEN.forEach((s,j)=>{ if(s.name===`Schicht ${j+2}`) s.name=`Schicht ${j+1}`; });
  renderSchichten();
  scheduleCalc();
}

// Summary-Label-Updates für kollabierbare Karten
function updateMatCardSummary(){
  const el=document.getElementById('mat-card-summary');
  if(!el) return;
  const deltaMap={'0':'δ=0','0.5':'δ=φ/2','0.667':'δ=2/3φ','1.0':'δ=φ'};
  const d=gi('bg_delta_fac'), qu=gi('bg_qu'), c1=gi('bg_c1');
  el.textContent = `${deltaMap[d]||'δ=2/3φ'} · q_u=${qu} kPa · C₁=${c1} MN/m³`;
}
function updateGWCardSummary(){
  const el=document.getElementById('gw-card-summary');
  if(!el) return;
  el.textContent = gi('bg_gw')==='ja' ? `GW bei ${gi('bg_gwt')} m` : 'Kein GW';
}
function updateBoeCardSummary(){
  const el=document.getElementById('boe-card-summary');
  if(!el) return;
  const hb=+gi('bg_bhoehe')||0;
  el.textContent = `β = ${gi('bg_beta')}°` + (hb>0.05 ? ` · h_β = ${hb} m` : '');
}

// Get the soil properties at a given depth below GOK
function schichtAtDepth(depth){
  let z=0;
  for(let s of cSchichten()){
    const bot = s.d===999 ? Infinity : z+s.d;
    if(depth<=bot || s===cSchichten()[cSchichten().length-1]) return s;
    z+=s.d;
  }
  return cSchichten()[cSchichten().length-1];
}

// Weighted average gamma from GOK to given depth (for overburden pressure)
function avgGammaToDepth(depth){
  if(cSchichten().length===1) return cSchichten()[0].gamma;
  let z=0, sumG=0;
  for(let s of cSchichten()){
    const thick = s.d===999 ? Math.max(0,depth-z) : Math.min(s.d, Math.max(0,depth-z));
    sumG += s.gamma * thick;
    z += (s.d===999 ? depth : s.d);
    if(z>=depth) break;
  }
  return depth>0 ? sumG/depth : cSchichten()[0].gamma;
}

// ════════════════════════════════════════════
// BODEN-TEMPLATES
// ════════════════════════════════════════════
const BG_FIELDS = ['bg_phi','bg_c','bg_gamma','bg_gamma2','bg_qu','bg_me','bg_c1','bg_delta_fac','bg_gw','bg_gwt','bg_beta','bg_bfuss','bg_bhoehe','bg_btyp'];

function getBGTemplates(){ return dbGet('bc_bg_tpls')||[]; }
function saveBGTemplates(arr){ dbSet('bc_bg_tpls', arr); }

function applyBGState(st){
  BG_FIELDS.forEach(f=>{const el=document.getElementById(f);if(el&&st[f]!==undefined)el.value=st[f];});
}

function saveBGTemplate(){
  const arr = getBGTemplates();
  const newId = 'bg_'+Date.now();
  arr.push({
    id: newId, name: 'Neues Profil',
    phi: 30, c: 0, gamma: 20.0, me: 20,
    data: { bg_phi:'30', bg_c:'0', bg_gamma:'20', bg_gamma2:'10', bg_me:'20', bg_qu:'250' }
  });
  saveBGTemplates(arr);
  renderBGTplTable();
  renderSchichten();
  // Neue Zeile fokussieren
  setTimeout(()=>{
    const inputs = document.querySelectorAll('#bg-tpl-list .ll-name');
    if(inputs.length) inputs[inputs.length-1].select();
  }, 50);
}

function renderBGTplDropdown(){ renderBGTplTable(); renderBGPresetTable(); } // Compat-Alias (beide Tabellen)

function renderBGTplTable(){
  const el = document.getElementById('bg-tpl-list');
  if(!el) return;
  const arr = getBGTemplates();
  const sum=document.getElementById('bgp-user-summary'); if(sum) sum.textContent = arr.length?`${arr.length} Profil${arr.length>1?'e':''}`:'keine';
  if(!arr.length){
    el.innerHTML = '<div style="color:var(--xdim);font-size:9.5px;font-family:var(--f-mono);padding:2px 0 8px">Keine gespeicherten Profile.</div>';
    return;
  }
  el.innerHTML = `<div class="ll-wrap"><table class="ll-tbl">
    <thead><tr>
      <th style="text-align:left">Bezeichnung</th>
      <th>Kürzel</th>
      <th>φ' °</th><th>c' kPa</th><th>γ kN/m³</th><th>M_E MN/m²</th>
      <th></th>
    </tr></thead>
    <tbody>${arr.map((tpl,i)=>{
      const phi = tpl.data?.bg_phi   ?? tpl.phi   ?? 30;
      const c   = tpl.data?.bg_c     ?? tpl.c     ?? 0;
      const gam = tpl.data?.bg_gamma ?? tpl.gamma ?? 20;
      const me  = tpl.data?.bg_me    ?? tpl.me    ?? 20;
      const kuerzel = tpl.kuerzel ?? '';
      return `<tr>
        <td><input class="ll-inp ll-name" value="${esc(tpl.name)}" style="width:80px"
          onchange="bgTplField('${tpl.id}','name',this.value)"/></td>
        <td><input class="ll-inp" value="${kuerzel}" style="width:54px" placeholder="—"
          onchange="bgTplField('${tpl.id}','kuerzel',this.value)"/></td>
        <td><input class="ll-inp" type="number" value="${phi}" step="0.5"
          onchange="bgTplField('${tpl.id}','bg_phi',+this.value)"/></td>
        <td><input class="ll-inp" type="number" value="${c}" step="0.5"
          onchange="bgTplField('${tpl.id}','bg_c',+this.value)"/></td>
        <td><input class="ll-inp" type="number" value="${gam}" step="0.5"
          onchange="bgTplField('${tpl.id}','bg_gamma',+this.value)"/></td>
        <td><input class="ll-inp" type="number" value="${me}" step="1"
          onchange="bgTplField('${tpl.id}','bg_me',+this.value)"/></td>
        <td>
          <button class="btn btn-danger" onclick="deleteBGTpl('${tpl.id}')">−</button>
        </td></tr>`;
    }).join('')}
    </tbody></table></div>`;
}

function bgTplField(id, field, val){
  const arr = getBGTemplates();
  const tpl = arr.find(t=>t.id===id);
  if(!tpl) return;
  if(field === 'name'){
    tpl.name = val;
  } else if(field === 'kuerzel'){
    tpl.kuerzel = val;
  } else {
    if(!tpl.data) tpl.data = {};
    tpl.data[field] = val;
    // Spiegel auf Top-Level für Rückwärtskompatibilität
    if(field==='bg_phi')   { tpl.phi   = val; }
    if(field==='bg_c')     { tpl.c     = val; }
    if(field==='bg_gamma') { tpl.gamma = val; }
    if(field==='bg_me')    { tpl.me    = val; }
  }
  saveBGTemplates(arr);
  renderSchichten(); // Preset-Chips in Schichten aktualisieren
}

function deleteBGTpl(id){
  if(!confirm('Bodenprofil löschen?')) return;
  saveBGTemplates(getBGTemplates().filter(t=>t.id!==id));
  renderBGTplTable();
  renderSchichten();
}

// ════════════════════════════════════════════
