// BlockCalc — js/lasten.js
// Lastfälle, Lastbeiwerte, Kombinationen, Kombinationsmatrix
// LASTFÄLLE — Komponentenbasiert
// x = quer zum Gleis, y = parallel zum Gleis
// ════════════════════════════════════════════
// comp flags: which load components are active in this LF
// G = ständig, W = veränderlich (Wind)
const LF_COMP_DEFS = [
  // id,    label,   axis,  group
  ['NG',  'N_G',  'z',   'G'],
  ['HGx', 'H_Gx', 'x',   'G'],
  ['HGy', 'H_Gy', 'y',   'G'],
  ['MGx', 'M_Gx', 'x-x', 'G'],
  ['MGy', 'M_Gy', 'y-y', 'G'],
  ['HWx', 'H_Wx', 'x',   'W'],
  ['HWy', 'H_Wy', 'y',   'W'],
  ['MWx', 'M_Wx', 'x-x', 'W'],
  ['MWy', 'M_Wy', 'y-y', 'W'],
];

let LF = [
  {
    name:'LF 1 — Quer zum Gleis', preset:'quer',  gG:1.35, gW:1.5, nw:'beide',
    comp:{ NG:true, HGx:true, HGy:false, MGx:false, MGy:true,
           HWx:true, HWy:false, MWx:false, MWy:true }
  },
  {
    name:'LF 2 — Längs zum Gleis', preset:'laengs', gG:1.35, gW:1.5, nw:'beide',
    comp:{ NG:true, HGx:false, HGy:true, MGx:true, MGy:false,
           HWx:false, HWy:true, MWx:true, MWy:false }
  },
];

function lfPresetLabel(p){
  if(p==='quer')   return '<span class="lf-preset-chip quer">Quer x</span>';
  if(p==='laengs') return '<span class="lf-preset-chip laengs">Längs y</span>';
  return '<span class="lf-preset-chip">Benutzer</span>';
}

function refreshMatrix(){
  const mw = document.getElementById('lf-matrix-wrap');
  if(mw) mw.innerHTML = buildLFMatrix();
}

// Zuklappbare Sektion: blendet den Ziel-Container um und dreht den Chevron
function toggleSecWrap(id, head){
  const w = document.getElementById(id);
  if(!w) return;
  const isOpen = w.style.display !== 'none';
  w.style.display = isOpen ? 'none' : '';
  head.classList.toggle('open', !isOpen);
}

function resetSIALastbeiwerte(){
  const vals = {
    lw_G:'1.35', lw_G_inf:'0.80', lw_Q:'1.50',
    lw_G1_sup:'1.20', lw_G1_inf:'0.80', lw_Q1:'1.50',
    lw_G_gzg:'1.00', lw_Q_gzg:'1.00'
  };
  Object.entries(vals).forEach(([id,v])=>si(id,v));
  refreshMatrix();
  _checkTWOverrides();
  scheduleCalc();
  toast('SIA 267 Lastbeiwerte wiederhergestellt');
}

function resetSIABodenbeiwerte(){
  const vals = { tw_phi:'1.20', tw_c:'1.50', tw_Ea:'1.35', tw_Ep:'1.40' };
  Object.entries(vals).forEach(([id,v])=>si(id,v));
  _checkTWOverrides();
  scheduleCalc();
  toast('SIA 267 Widerstandsbeiwerte wiederhergestellt');
}

// Lastbeiwerte für einen Lastfall ermitteln (aus Lastbeiwerte-Karte, nicht LF-Felder)
function getGF(lf){
  if(lf.nw === 'gzg'){
    return { gG: _gzgFac('lw_G_gzg',1.00), gW: _gzgFac('lw_Q_gzg',1.00) };
  }
  // gzt, beide, undefined → Typ 2 / ST
  return { gG: +cgi('lw_G')||1.35, gW: +cgi('lw_Q')||1.50 };
}
// ── Lastkombinatorik — EINE Quelle für alle Tragsysteme ─────────────────────────────
// Die Beiwerte kommen ausschliesslich aus den Feldern der Lastbeiwerte-Karte (getGF).
// Die in den LF-Objekten mitgeführten lf.gG/lf.gW sind Altbestand: sie werden nach dem
// Anlegen nie nachgeführt und dürfen NICHT gelesen werden (das Pfahlfundament und der
// 3D-Viewer taten das bis Okt 2026 und ignorierten damit geänderte Lastbeiwerte).
// Vollständiger Satz nach SIA 260: Eigengewicht {inf,sup} × ständig {inf,sup} × veränderlich {0,γ_Q}
// γ_G,inf für die Typ-2-Nachweise. Allgemein SIA 260 Tab. 1 (0.80, Feld lw_G_inf). Für Gleiten und
// Grundbruch von FLACHFUNDATIONEN legt SIA 267 Ziff. 8.5.2.4 fest: «…gilt in der Regel für die günstig
// wirkende Eigenlast von Fundament und Hinterfüllung sowie für die vorsichtig bestimmten Eigenlasten
// aus dem Überbau folgender Lastbeiwert: γ_G,inf = 1,0 (35)». Darum rechnet das Flachfundament fest
// mit 1.00 — unabhängig vom Feld, das für Blockfundament und Pfahlfundament gilt.
function gGinfT2(model){
  if((model || CALC_MODEL) === 'flach') return 1.00;
  const v = +cgi('lw_G_inf'); return v > 0 ? v : 0.80;
}
function buildCombos(gInf, gSup, gQ){
  const A = []; let k = 1;
  for(const fE of [gInf, gSup]) for(const fG of [gInf, gSup]) for(const fQ of [0, gQ])
    A.push({nr:k++, fE, fG, fQ});
  return A;
}

function renderLF(){
  const container = document.getElementById('lf-cards');
  if(!container) return;
  container.innerHTML = '';
  LF.forEach((lf, i) => {
    const card = document.createElement('div');
    card.className = 'lf-card' + (i < 2 ? ' open' : '');
    card.id = `lf-card-${i}`;

    // Build component checkboxes
    const D = Object.fromEntries(LF_COMP_DEFS.map(c=>[c[0],c]));
    const mkComp = (c) => {
      const [id, lbl, ax] = c;
      const checked = lf.comp[id] ? 'checked' : '';
      const axKey = ax.replace('-','');
      const axBadge = ax ? `<span class="ax ax-${axKey}">(${ax})</span>` : '';
      return `<div class="lf-cr">
        <input type="checkbox" class="lf-cb" id="lfc-${i}-${id}" ${checked}
          onchange="LF[${i}].comp['${id}']=this.checked;LF[${i}].preset='custom';renderLF();scheduleCalc()">
        <label for="lfc-${i}-${id}">${lbl} ${axBadge}</label>
      </div>`;
    };

    card.innerHTML = `
      <div class="lf-card-head" onclick="toggleLFCard(${i})">
        <input class="lf-card-name-inp" value="${lf.name}"
          onclick="event.stopPropagation()"
          onchange="LF[${i}].name=this.value;LF[${i}].preset='custom';renderLF();scheduleCalc()">
        ${lfPresetLabel(lf.preset)}
        <svg class="lf-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 2l4 4-4 4"/></svg>
        <button class="btn btn-text" style="padding:0 4px;height:22px;flex-shrink:0" onclick="event.stopPropagation();removeLF(${i})">
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 2l8 8M10 2L2 10"/></svg>
        </button>
      </div>
      <div class="lf-card-body">
        ${CALC_MODEL==='block' ? `
        <div class="lf-gam-row" style="margin-top:0">
          <div class="lf-gf" style="grid-column:1/-1"><label>Nachweis</label>
            <select style="width:100%;background:var(--s2);border:1px solid var(--ol);border-radius:var(--r1);color:var(--on);padding:4px 6px;font-family:var(--f-mono);font-size:11px"
              onchange="LF[${i}].nw=this.value;scheduleCalc()">
              <option value="beide" ${(!lf.nw||lf.nw==='beide')?'selected':''}>GZT + GZG</option>
              <option value="gzt"   ${lf.nw==='gzt'?'selected':''}>GZT — Standsicherheit</option>
              <option value="gzg"   ${lf.nw==='gzg'?'selected':''}>GZG — Schiefstellung</option>
            </select>
          </div>
        </div>` : `
        <div style="font-family:var(--f-mono);font-size:9px;color:var(--xdim);padding:2px 0 6px">
          Faktoren gemäss Lastbeiwerte-Karte (Typ 1/2)
        </div>`}
        <div class="lf-comp-sec">Ständige Lasten G</div>
        ${mkComp(D.NG)}
        <div class="lf-comp-grid">${mkComp(D.HGx)}${mkComp(D.HGy)}</div>
        <div class="lf-comp-grid">${mkComp(D.MGx)}${mkComp(D.MGy)}</div>
        <div class="lf-comp-sec">Veränderliche Lasten W</div>
        <div class="lf-comp-grid">${mkComp(D.HWx)}${mkComp(D.HWy)}</div>
        <div class="lf-comp-grid">${mkComp(D.MWx)}${mkComp(D.MWy)}</div>
        <div style="margin-top:8px;display:flex;gap:6px">
          <button class="btn btn-tonal btn-xs" onclick="setLFPreset(${i},'quer')">Quer (x)</button>
          <button class="btn btn-tonal btn-xs" onclick="setLFPreset(${i},'laengs')">Längs (y)</button>
          <button class="btn btn-tonal btn-xs" onclick="setLFPreset(${i},'alle')">Alle</button>
          <button class="btn btn-tonal btn-xs" onclick="setLFPreset(${i},'keine')">Keine</button>
        </div>
      </div>`;
    container.appendChild(card);
  });
  syncLFSel();
  // Kombinationsmatrix immer aktualisieren
  const _mw = document.getElementById('lf-matrix-wrap');
  if(_mw) _mw.innerHTML = buildLFMatrix();
}

function toggleLFCard(i){
  const card = document.getElementById(`lf-card-${i}`);
  if(card) card.classList.toggle('open');
}

function setLFPreset(i, preset){
  if(preset==='quer'){
    // Quer (x): H in x + zugehöriges Moment M_y-y (Kippmoment um y-Achse)
    LF[i].comp = { NG:true, HGx:true, HGy:false, MGx:false, MGy:true,
                   HWx:true, HWy:false, MWx:false, MWy:true };
    LF[i].preset = 'quer';
  } else if(preset==='laengs'){
    // Längs (y): H in y + zugehöriges Moment M_x-x (Kippmoment um x-Achse)
    LF[i].comp = { NG:true, HGx:false, HGy:true, MGx:true, MGy:false,
                   HWx:false, HWy:true, MWx:true, MWy:false };
    LF[i].preset = 'laengs';
  } else if(preset==='alle'){
    LF_COMP_DEFS.forEach(c=>LF[i].comp[c[0]]=true);
    LF[i].preset = 'custom';
  } else {
    LF_COMP_DEFS.forEach(c=>LF[i].comp[c[0]]=false);
    LF[i].comp.NG = true; // N_G immer aktiv
    LF[i].preset = 'custom';
  }
  renderLF();
  scheduleCalc();
}

function addLF(){
  LF.push({
    name: `LF ${LF.length + 1}`,
    preset: 'quer', gG: 1.35, gW: 1.5, nw: 'beide',
    // Vorgabe: eine Richtung (quer). Beide Richtungen überlagert nur auf ausdrückliche Wahl («Alle»).
    comp: { NG:true, HGx:true, HGy:false, MGx:false, MGy:true,
            HWx:true, HWy:false, MWx:false, MWy:true }
  });
  renderLF();
}

function removeLF(i){
  const name = LF[i]?.name || `Lastfall ${i + 1}`;
  confirmDelete(`Lastfall «${name}» entfernen?`, () => { LF.splice(i, 1); renderLF(); scheduleCalc(); });
}


function buildLFMatrix(){
  const cols = LF_COMP_DEFS;

  // Aktuelle Lastbeiwerte aus Lastbeiwerte-Karte lesen
  const gG2s = +gi('lw_G')     || 1.35;  // Typ 2 sup
  const gG2i = gGinfT2();  // Typ 2 inf (Flach fest 1.00, SIA 267 Ziff. 8.5.2.4)
  const gQ2  = +gi('lw_Q')     || 1.50;  // Typ 2 Q
  const gG1s = +gi('lw_G1_sup')|| 1.20;  // Typ 1 sup
  const gG1i = +gi('lw_G1_inf')|| 0.80;  // Typ 1 inf (N_G stabilisierend)
  const gQ1  = +gi('lw_Q1')    || 1.50;  // Typ 1 Q
  const gGz  = _gzgFac('lw_G_gzg', 1.00);  // GZG
  const gQz  = _gzgFac('lw_Q_gzg', 1.00);  // GZG Q

  // Grenzzustände: modellabhängig + benutzerdefinierte Beschriftungen aus SETTINGS
  const isBlock = CALC_MODEL === 'block';
  const sys = CALC_MODEL === 'pfahlbock' ? 'pfahl' : (isBlock ? 'block' : 'flach');   // Zeile der Beschriftungs-Matrix

  // Block (eingespannt): kein Kippen/Ausmitte-Nachweis → keine Typ-1-Zeile
  // Typ 2 / ST wird als 8 Kombinationszeilen direkt in der Matrix dargestellt (s.u.)
  const GZ_BLOCK = [
    {
      label: 'GZG',
      sub:   gzLabel('gzg_'+sys),
      color: 'var(--dim)',
      gk:    1.00,   // GZG: Eigengewicht immer 1.00
      gamma: (c) => c[3]==='W' ? gQz : gGz
    }
  ];

  // Flach: Typ 2 steht als 8 Kombinationszeilen in der Matrix (wie beim Block); hier nur Typ 1.
  const GZ_FLACH = [
    {
      label: 'Typ 1',
      sub:   gzLabel('t1_flach'),
      color: 'var(--warn)',
      gk:    gG1i,   // Eigengewicht wirkt beim Kippen günstig → γ_G,inf
      gamma: (c) => { if(c[3]==='W') return gQ1; if(c[0]==='NG') return gG1i; return gG1s; }
    }
  ];

  // Benutzerdefinierte Zusatz-GZ aus SETTINGS
  const GZ_CUSTOM = (SETTINGS.gz_custom || []).map(gz=>({
    label: gz.label,
    sub:   gz.sub,
    color: 'var(--on2)',
    gamma: (c) => c[3]==='W' ? (gz.gQ||1.50) : (gz.gG||1.35)
  }));

  // Block und Pfahlfundament: GZG-Zeile · Flach: Typ-1-Zeile (Kippen)
  const GZ = [...(sys==='flach' ? [...GZ_FLACH, ...GZ_BLOCK] : GZ_BLOCK), ...GZ_CUSTOM];

  const thV = `font-family:var(--f-mono);font-size:9px;letter-spacing:.04em;color:var(--dim);padding:3px 5px;text-align:center;border-bottom:1px solid var(--ol);border-right:1px solid var(--ol);white-space:nowrap;writing-mode:vertical-rl;transform:rotate(180deg);height:52px;vertical-align:bottom`;
  const thL = `font-family:var(--f-mono);font-size:9px;letter-spacing:.04em;color:var(--dim);padding:3px 8px;text-align:left;border-bottom:1px solid var(--ol);border-right:1px solid var(--ol);white-space:nowrap;vertical-align:bottom;height:52px`;
  const tdS = `padding:4px 5px;text-align:center;border-bottom:1px solid var(--ol);border-right:1px solid var(--ol);font-family:var(--f-mono);font-size:9.5px;font-weight:500`;
  const tdN = `padding:4px 8px;text-align:left;border-bottom:1px solid var(--ol);border-right:1px solid var(--ol);font-family:var(--f-mono);font-size:9px`;

  let html = `<table style="border-collapse:collapse;width:100%;font-size:9px">
    <thead><tr>
      <th style="${thL}">Grenzzustand</th>
      <th style="${thV};color:var(--on2)" title="Eigengewicht Fundament (Beton + Hinterfüllung)">G_k Fund.</th>`;
  cols.forEach(c => {
    const col = c[3]==='W' ? `color:var(--acc)` : `color:var(--on2)`;
    html += `<th style="${thV};${col}">${c[1]}</th>`;
  });
  html += `</tr></thead><tbody>`;

  // Je Lastfall ein eigener Block mit den WIRKSAMEN Beiwerten: eine im Lastfall nicht aktivierte
  // Komponente trägt keinen Beiwert («·»). Quer und längs werden damit sichtbar getrennt geführt
  // (so rechnet der Kern seit jeher — lf.comp); überlagert wird nur, was ein Lastfall ausdrücklich
  // aktiviert (Vorlage «Alle» oder einzelne Häkchen).
  const dot = `<span style="color:var(--xdim);font-size:9px">·</span>`;
  const hdS = `padding:4px 8px;font-family:var(--f-mono);font-size:8.5px;letter-spacing:0.06em;text-transform:uppercase;color:var(--xdim);border-bottom:1px solid var(--ol);background:var(--s2)`;
  const zelle = (lf, c, v, farbe) => lf.comp?.[c[0]]
    ? `<td style="${tdS};color:${farbe}">${v.toFixed(2)}</td>`
    : `<td style="${tdS}">${dot}</td>`;
  const richt = lf => { const r = _lfRichtung(lf); const c = lf.comp||{}, h = LF_COMP_DEFS.some(d => d[0]!=='NG' && c[d[0]]);
    return r==='quer' ? 'quer (x)' : r==='laengs' ? 'längs (y)' : h ? 'quer + längs überlagert' : 'nur vertikal'; };
  const gzZeile = (lf, gz, i) => {
    let h = `<tr style="${i%2===1 ? 'background:var(--s1)' : ''}">
      <td style="${tdN}">
        <span style="color:${gz.color};font-weight:500">${gz.label}</span>
        <span style="color:var(--xdim);font-size:9px;display:block;margin-top:1px">${gz.sub}</span>
      </td>
      <td style="${tdS};color:var(--on2)">${gz.gk !== undefined ? gz.gk.toFixed(2) : dot}</td>`;
    cols.forEach(c => {
      const isN_G_inf = gz.label==='Typ 1' && c[0]==='NG';
      h += zelle(lf, c, +gz.gamma(c), c[3]==='W' ? 'var(--acc)' : (isN_G_inf ? 'var(--warn)' : 'var(--ok)'));
    });
    return h + `</tr>`;
  };

  LF.forEach((lf, li) => {
    const nwLf = lf.nw || 'beide';
    const doGZT = nwLf !== 'gzg', doGZG = nwLf !== 'gzt';
    html += `<tr><td colspan="${cols.length+2}" style="${hdS};color:var(--on2);${li ? 'border-top:2px solid var(--ol);' : ''}">${esc(lf.name)} <span style="color:var(--xdim)">· ${richt(lf)}</span></td></tr>`;
    if(doGZT){
      html += `<tr><td colspan="${cols.length+2}" style="${hdS}">Typ 2 — ${esc(gzLabel('t2_'+sys))}</td></tr>`;
      let _k = 1;
      for(const fE of [gG2i, gG2s]) for(const fG of [gG2i, gG2s]) for(const fQ of [0, gQ2]){
        html += `<tr style="${_k%2===0 ? 'background:var(--s1)' : ''}">
          <td style="${tdN}"><span style="color:var(--acc);font-weight:500">Komb. ${_k}</span></td>
          <td style="${tdS};color:var(--on2)">${fE.toFixed(2)}</td>`;
        cols.forEach(c => { const isW = c[3]==='W'; html += zelle(lf, c, isW ? fQ : fG, isW ? 'var(--acc)' : 'var(--ok)'); });
        html += `</tr>`;
        _k++;
      }
    }
    GZ.forEach((gz, i) => {
      const istGzg = gz.label === 'GZG';
      if(istGzg ? !doGZG : !doGZT) return;
      html += gzZeile(lf, gz, i);
    });
  });

  html += `</tbody></table>`;

  html += `<div class="hint" style="margin-top:6px">Je Lastfall werden nur die aktivierten Komponenten angesetzt («·» = nicht angesetzt): quer und längs werden getrennt nachgewiesen, nicht überlagert. Sollen beide Richtungen gleichzeitig wirken, einen Lastfall mit der Vorlage «Alle» oder eigenen Häkchen anlegen. Je Lastfall laufen alle 8 Kombinationen; massgebend ist das kleinste η. G_k = Eigengewicht Fundament.</div>`;
  return html;
}

// ════════════════════════════════════════════
