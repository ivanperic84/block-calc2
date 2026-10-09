// BlockCalc — js/bettung.js
// Bettungsziffer C₁ (Winkler/Steckner)
// BERECHNUNG — SIA 267
//   Block: Steckner-Methode (Sohle + Seitenflächen)
//   Flach: Hansen-Methode (nur Sohle)
// ════════════════════════════════════════════
// ── Auto-Schätzung Bettungsziffer C₁ nach Steckner:
// C₁ = M_E · Kp(φ') / B   [MN/m³]
// Kp = tan²(45°+φ'/2) — passiver Erddruckbeiwert aus charakteristischem Reibungswinkel
// ── Steckner 1989, Gl.3/4: C₁ aus φ_k und Einbindetiefe t
// C = {4 + 0.6·(φ−20)} · 10⁴ · t/2 · (1 + β_p/40)  [kN/m³]
// β_p < 0: abfallendes Gelände (Gl.4); β_p ≥ 0: eben/ansteigend → Gl.3 (β=0)
// Steckner Gl.4 — Böschungsabminderung der Bettungsziffer: eine abfallende Böschung (β<0) mindert
// C₁ um (1+β/40). Höhenwirkung (Jul 2026): eine ENDLICHE Böschung (h_β>0) legt nur den Anteil der
// Einbindetiefe frei, der über ihre Höhe reicht → frac = h_β/t (gekappt auf 1) → geringere
// Abminderung; durchlaufend (h_β=0, Sentinel „unendlich") = volle Reduktion (frac=1, rückwärtskompatibel).
// WICHTIG: Der Böschungseinfluss ist ein GEOMETRIE-Effekt (freier Erdwiderstand talseitig) und damit
// UNABHÄNGIG davon, mit welcher Methode C₁ abgeschätzt wird. Deshalb wird dieser Faktor sowohl auf den
// Steckner-Ast (Gl.3) ALS AUCH auf den Winkler-Ast (M_E·Kp/B) angewandt — d. h. die Böschung wirkt auch
// dann, wenn die Steckner-Einsatzbedingungen (M_E ≥ 12/25, φ ≥ 27°) NICHT erfüllt sind (Jul 2026).
function _c1SlopeFactor(beta_deg, hbeta, t){
  if(!(beta_deg < 0)) return 1.0;
  const frac = (hbeta > 0) ? Math.min(1, hbeta / Math.max(0.1, t)) : 1;
  return 1 + (beta_deg / 40) * frac;   // → 0 bei β=−40° (Modellgrenze); Flooring erfolgt am C₁-Wert
}

function c1Steckner(phi_k_deg, t, beta_deg, hbeta) {
  const C_base = (4 + 0.6 * (phi_k_deg - 20)) * 1e4 * (t / 2); // [kN/m³]
  return Math.max(1, C_base * _c1SlopeFactor(beta_deg, hbeta, t) / 1000); // → MN/m³
}

// Tiefengewichteter Mittelwert φ_k [°] über alle Schichten bis Tiefe t
function avgPhiToDepth(t) {
  let phi_sum = 0, z = 0;
  for(const s of SCHICHTEN) {
    const thick = Math.min(s.d === 999 ? Math.max(0, t - z) : s.d, Math.max(0, t - z));
    if(thick <= 0) break;
    phi_sum += s.phi * thick;
    z += thick;
    if(z >= t) break;
  }
  return z > 0 ? phi_sum / z : (+gi('bg_phi') || 30);
}

// Tiefengewichteter Mittelwert M_E [MN/m²] über alle Schichten bis Tiefe t
function avgMeToDepth(t){
  let me_sum=0, z=0;
  for(const s of SCHICHTEN){
    const thick=Math.min(s.d===999?Math.max(0,t-z):s.d, Math.max(0,t-z));
    if(thick<=0) break;
    me_sum += Math.max(0.5, s.me ?? (+gi('bg_me') || 20)) * thick;
    z += thick; if(z>=t) break;
  }
  return z>0 ? me_sum/z : (+gi('bg_me')||20);
}

// Aktualisiert Zone-Chip, mehrzeiligen Hint und Methoden-Dropdown
// Wandreibung δ (bg_delta_fac) — Reichweite im Blockfundament:
//   · Steckner-GZT und GZG: KEIN Einfluss. computeGZT_dir startet mit fest dpf = 0.5
//     (δ_p = ½·φ_k, Gl.49/50, nur bei N_u < 0 stufenweise reduziert) und nutzt für
//     λ_a/R_a/R₀ fest δ₁ = ⅔·φ_k (Gl.8) — ST-/DC-kalibriert, bewusst nicht einstellbar.
//   · Grundbruch: über den Mantelreibungszuschlag T = (c'_d + σ'_v,m·tan δ_d)·A_Mantel,
//     beim Block aber ein INFORMATIVER Nachweis.
//   · Sicherung/Aushub: dpFac in rigidBlockBalance (Starrkörperbilanz, Kernweite).
// Sind beide Verbraucher aus, ist das Feld wirkungslos → ausgrauen statt still mitlaufen.
function _updateDeltaFacUI(){
  const sel  = document.getElementById('bg_delta_fac');
  const fld  = document.getElementById('bg_delta_fac_field');
  const hint = document.getElementById('bg_delta_fac_hint');
  if(!sel || !fld || !hint) return;
  const grundb = (typeof nwOn === 'function') ? nwOn('block', 'info') : true;
  const sich   = (typeof _sichEnabled !== 'undefined') && _sichEnabled === true;
  const wirkt  = grundb || sich;
  sel.disabled   = !wirkt;
  fld.style.opacity = wirkt ? '' : '0.5';
  const ziele = [];
  if(grundb) ziele.push('den <b>informativen</b> Grundbruch (Mantelreibungszuschlag)');
  if(sich)   ziele.push('die Starrkörperbilanz im Aushubzustand');
  hint.innerHTML = wirkt
    ? 'Wirkt <b>nicht</b> auf GZT und GZG — der Steckner-Kern rechnet mit fest '
      + 'δ_p = ½·φ_k (Gl. 49/50) und δ₁ = ⅔·φ_k (Gl. 8). Beeinflusst ' + ziele.join(' und ') + '.'
    : '<b>Ohne Wirkung</b> auf die aktuelle Berechnung: GZT und GZG rechnen mit festem δ '
      + '(Steckner), und die einzigen Verbraucher — Sohlgrössen/Grundbruch und Sicherung/Aushub '
      + '— sind abgeschaltet.';
}

function _updateC1UI(me_avg, grenzwert, c1_steck, c1_me, c1_eff, zoneKey, stecknerGueltig, w){
  const hint = document.getElementById('bg_c1_hint');
  const chip = document.getElementById('c1-zone-chip');

  // Chip
  const chipLabels = {soft:'Unter Grenze', mid:'Übergangsbereich', ok:'Steckner gültig'};
  const chipCls    = {soft:'chip-fail',    mid:'chip-warn',        ok:'chip-ok'};
  if(chip){ chip.textContent=chipLabels[zoneKey]; chip.className='c1-zone-chip '+chipCls[zoneKey]; }

  // Zeile 1: Zone + Kontext
  const koernigLbl = _bgKoernig==='fein' ? 'Feinkörnig' : 'Grobkörnig';
  const methForcedLbl = _c1Methode==='winkler'  ? ' · Winkler erzwungen' :
                        _c1Methode==='steckner' ? ' · Steckner erzwungen' :
                        _c1Methode==='blend'    ? ' · Blend erzwungen' : '';
  const zoneLbl = zoneKey==='soft'
    ? `M_E=${me_avg.toFixed(0)} MN/m² — unter Minimum (< 12) · ${koernigLbl}${methForcedLbl}`
    : zoneKey==='mid'
    ? `M_E=${me_avg.toFixed(0)} MN/m² — Übergangsbereich · ${koernigLbl}${methForcedLbl}`
    : `M_E=${me_avg.toFixed(0)} MN/m² — Steckner gültig (≥ ${grenzwert}) · ${koernigLbl}${methForcedLbl}`;

  // Zeile 2: Zwischenwerte
  const blendLbl = zoneKey==='mid'
    ? `Blend ${(w*100).toFixed(0)}% St + ${((1-w)*100).toFixed(0)}% Wk`
    : zoneKey==='ok' ? 'Steckner' : 'Winkler';
  const autoVal = _c1Manual ? ` · Auto wäre: ${c1_eff.toFixed(1)}` : '';
  const valLbl = `St: ${c1_steck.toFixed(1)}  Wk: ${c1_me.toFixed(1)}  [${blendLbl}]  →  C₁ = ${_c1Manual?(+gi('bg_c1')||0).toFixed(1):c1_eff.toFixed(1)} MN/m³${autoVal}`;

  // Zeile 3: Manuell-Hinweis
  const manualLbl = _c1Manual ? `Manuell überschrieben — Reset-Button zum Zurücksetzen` : '';

  if(hint){
    hint.className = `c1-zone-${zoneKey}`;
    hint.innerHTML =
      `<span>${zoneLbl}</span>` +
      `<span style="color:var(--xdim)">${valLbl}</span>` +
      (manualLbl ? `<span style="color:var(--warn)">${manualLbl}</span>` : '');
  }

  // C₁-Feld visuell als überschrieben markieren wenn manuell
  const c1El = document.getElementById('bg_c1');
  if(c1El) c1El.closest('.field')?.classList.toggle('field-overridden', _c1Manual);

  // Methoden-Dropdown + subtext dynamisch anpassen
  _updateC1MethodOptions(me_avg, grenzwert);
  const mhint = document.getElementById('c1-methode-hint');
  if(mhint){
    if(_c1Methode === 'winkler')  mhint.textContent = 'Winkler erzwungen — M_E · Kp / B';
    else if(_c1Methode === 'steckner') mhint.textContent = 'Steckner erzwungen — φ-abhängig';
    else if(zoneKey==='soft') mhint.textContent = `auto — Winkler (M_E < 12, Steckner ungültig)`;
    else if(zoneKey==='mid')  mhint.textContent = `auto — Blend ${(w*100).toFixed(0)}% Steckner / ${((1-w)*100).toFixed(0)}% Winkler`;
    else                      mhint.textContent = `auto — Steckner Gl.3 (M_E ≥ ${grenzwert})`;
  }
}

// Blendet nicht sinnvolle Methoden-Optionen aus
function _updateC1MethodOptions(me_avg, grenzwert){
  const sel = document.getElementById('bg_c1_methode');
  if(!sel) return;
  const steckOk = me_avg >= grenzwert;
  const opts = [
    { v:'auto',     lbl:'Automatisch',                   show: true },
    { v:'winkler',  lbl:'Winkler — M_E · Kp / B',        show: !steckOk },
    { v:'steckner', lbl:'Steckner Gl.3 — φ-abhängig',    show: steckOk },
  ];
  const prev = sel.value || _c1Methode;
  sel.innerHTML = opts.filter(o=>o.show).map(o=>`<option value="${o.v}">${o.lbl}</option>`).join('');
  const stillValid = opts.find(o=>o.v===prev && o.show);
  if(stillValid){ sel.value=prev; }
  else { sel.value='auto'; _c1Methode='auto'; }
}

// Vergleicht γ-Felder mit SETTINGS-Defaults und markiert Abweichungen
function _checkTWOverrides(){
  const pairs = [
    ['tw_phi',   SETTINGS.tph  ?? 1.20],
    ['tw_c',     SETTINGS.tc   ?? 1.50],
    ['tw_Ea',    SETTINGS.tEa  ?? 1.35],
    ['tw_Ep',    SETTINGS.tEp  ?? 1.40],
    ['lw_G',      SETTINGS.lw_G      ?? 1.35],
    ['lw_G_inf',  SETTINGS.lw_G_inf  ?? 1.00],
    ['lw_Q',      SETTINGS.lw_Q      ?? 1.50],
    ['lw_G1_sup', SETTINGS.lw_G1_sup ?? 1.20],
    ['lw_G1_inf', SETTINGS.lw_G1_inf ?? 0.80],
    ['lw_Q1',     SETTINGS.lw_Q1     ?? 1.50],
    ['lw_G_gzg',  SETTINGS.lw_G_gzg  ?? 1.00],
    ['lw_Q_gzg',  SETTINGS.lw_Q_gzg  ?? 1.00],
  ];
  pairs.forEach(([id, def]) => {
    const el = document.getElementById(id);
    if(!el) return;
    const fd = el.closest('.field');
    if(!fd) return;
    fd.classList.toggle('field-overridden', Math.abs((+el.value) - def) > 0.001);
  });
}

// Öffnet Info-Panel mit Berechnungsdetails für C₁
function openC1Info(){
  const d = window._c1Calc;
  if(!d){ return; }
  const Kp = Math.tan(Math.PI/4 + d.phi_avg*Math.PI/360)**2;
  const blendText = d.zoneKey==='mid'
    ? `\nBlend (M_E im Übergangsbereich 12–25 MN/m²):\n  w = (${d.me_avg.toFixed(1)}−12) / 13 = ${(d.w*100).toFixed(0)}%  →  ${((1-d.w)*100).toFixed(0)}% Winkler + ${(d.w*100).toFixed(0)}% Steckner\n  C₁ = ${(1-d.w).toFixed(3)}·${d.c1_me.toFixed(1)} + ${d.w.toFixed(3)}·${d.c1_steck.toFixed(1)} = ${d.c1_eff.toFixed(1)} MN/m³`
    : d.zoneKey==='soft'
    ? `\nSteckner Gl.3 nicht gültig (M_E < 12 MN/m²):\n  C₁ = C₁_ME = ${d.c1_eff.toFixed(1)} MN/m³`
    : `\nSteckner Gl.3 maßgebend (M_E ≥ ${d.grenzwert} MN/m²):\n  C₁ = C₁_Steckner = ${d.c1_eff.toFixed(1)} MN/m³`;
  const phiOk = d.phi_avg >= 27;
  const meOkFein = d.me_avg >= 12;
  const meOkGrob = d.me_avg >= 25;
  const slpOn  = d.slopeFac != null && d.slopeFac < 0.999;   // abfallende Böschung wirkt
  const slpTxt = slpOn ? ` · ${d.slopeFac.toFixed(3)} (Böschung Gl.4)` : '';
  const lines = [
    `Bettungsziffer C₁ — Berechnungsdetails`,
    `${'─'.repeat(52)}`,
    `Bodenart:   ${d.koernig==='fein'?'Feinkörnig (CL, ML, MH, CH …)':'Grobkörnig (GW, GP, SW, SP, SM …)'}`,
    `Grenzwert:  M_E ≥ ${d.grenzwert} MN/m²  (Minimalanforderung Steckner GZG)`,
    ``,
    `Eingangsparameter:`,
    `  φ'_avg = ${d.phi_avg.toFixed(1)}°   (tiefengewichtet, t = ${d.t.toFixed(2)} m)`,
    `  M_E,avg = ${d.me_avg.toFixed(1)} MN/m²  (tiefengewichtet)`,
    `  B = ${d.B.toFixed(2)} m`,
    ``,
    `Methode 1 — Steckner (1989) Gl.3${slpOn?'/4':''}:`,
    `  C₁ = {4 + 0.6·(${d.phi_avg.toFixed(1)}−20)} · 10⁴ · ${(d.t/2).toFixed(2)}${slpTxt} = ${d.c1_steck.toFixed(1)} MN/m³`,
    ``,
    `Methode 2 — Winkler horizontal (M_E · Kp / B):`,
    `  Kp = tan²(45+${(d.phi_avg/2).toFixed(1)}°) = ${Kp.toFixed(3)}`,
    `  C₁_ME = ${d.me_avg.toFixed(1)} · ${Kp.toFixed(3)} / ${d.B.toFixed(2)}${slpTxt} = ${d.c1_me.toFixed(1)} MN/m³`,
    blendText,
    ``,
    `Gültigkeitsprüfung (Projektunterlage):`,
    `  φ'_k = ${d.phi_avg.toFixed(1)}° ${phiOk?'≥':'<'} 27°  ${phiOk?'✓':'✗'}`,
    `  M_E = ${d.me_avg.toFixed(1)} MN/m²:  ≥ 12 (feinkörnig) ${meOkFein?'✓':'✗'}  |  ≥ 25 (grobkörnig) ${meOkGrob?'✓':'✗'}`,
    `  → ${d.stecknerGueltig?'Steckner für gewählte Bodenart gültig':'Steckner für gewählte Bodenart NICHT voll gültig — '+( d.zoneKey==='soft'?'Winkler-Ansatz':'Blend')+' angewendet'}`,
    ...(slpOn ? [`  Böschung β = ${d.beta.toFixed(0)}° (Gl.4-Faktor ${d.slopeFac.toFixed(3)}) mindert C₁ in BEIDEN Methoden`,
                `  → wirkt auch, wenn Steckner-Einsatzbedingung nicht erfüllt ist (Winkler/Blend)`] : []),
    ``,
    `${'─'.repeat(52)}`,
    `Quellen: Steckner (1989) Bautechnik 2/89 Gl.3`,
    `         SN 670 004-2b-NA (USCS), Minimalanforderungen`,
    `         Winkler-Bettung horizontal: M_E · Kp / B`,
  ].join('\n');
  // Overlay öffnen
  let ov = document.getElementById('ov-c1-info');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'ov-c1-info';
    ov.style.cssText='position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45)';
    ov.addEventListener('click',e=>{ if(e.target===ov) ov.style.display='none'; });
    document.body.appendChild(ov);
  }
  ov.innerHTML=`<div style="background:var(--s1);border:1px solid var(--ol);border-radius:6px;padding:20px 22px;max-width:520px;width:95vw;max-height:80vh;overflow-y:auto">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <span style="font-size:11px;font-weight:700;letter-spacing:.04em">C₁ Berechnungsdetails</span>
      <button class="btn btn-tonal btn-sm" onclick="document.getElementById('ov-c1-info').style.display='none'" style="padding:0 8px">✕</button>
    </div>
    <pre style="font-family:var(--f-mono);font-size:9px;line-height:1.7;margin:0;white-space:pre-wrap;color:var(--dim)">${lines}</pre>
  </div>`;
  ov.style.display='flex';
}

// Reiner Auto-C₁-Wert (3-Zonen-Blend Winkler/Steckner, β/B/t/φ-abhängig) — ohne UI-Effekte.
// Wird von autoC1() (mit UI) UND von _doCalculate() (Auto-Modus, live) genutzt, damit C₁ der
// Geländeneigung, Geometrie und φ immer folgt. Quelle: Steckner 1989 Gl.3/4.
function c1AutoValue(){
  const t         = Math.max(0.1, +gi('g_hblock') + Math.max(0,+gi('g_uberd')||0));
  const B         = Math.max(0.1, +gi('g_bx'));
  const beta      = +gi('bg_beta')||0;
  const hbeta     = Math.max(0, +gi('bg_bhoehe')||0);   // Böschungshöhe (0 = durchlaufend)
  const grenzwert = _bgKoernig==='fein' ? 12 : 25;
  const phi_avg   = SCHICHTEN.length>1 ? avgPhiToDepth(t) : (+gi('bg_phi')||30);
  const me_avg    = SCHICHTEN.length>1 ? avgMeToDepth(t) : (SCHICHTEN[0]?.me ?? 20);
  const slopeFac  = _c1SlopeFactor(beta, hbeta, t);           // Steckner Gl.4 (β/h_β-abhängig)
  const c1_steck  = c1Steckner(phi_avg, t, beta, hbeta);      // Gl.3 · Gl.4 (Faktor bereits enthalten)
  // Winkler-Ast (M_E·Kp/B) trägt die Böschungsabminderung ebenfalls → C₁ folgt der Neigung auch,
  // wenn die Steckner-Einsatzbedingungen (M_E, φ) nicht erfüllt sind (Winkler/Blend-Zone).
  const c1_me     = Math.max(1, c1Effective_layers(t, B) * slopeFac);
  let c1_eff, zoneKey, w=0;
  if(_c1Methode === 'winkler'){
    c1_eff=c1_me; zoneKey='soft'; w=0;
  } else if(_c1Methode === 'steckner'){
    c1_eff=c1_steck; zoneKey='ok'; w=1;
  } else {
    if(me_avg < 12){ c1_eff=c1_me; zoneKey='soft'; w=0; }
    else if(me_avg < grenzwert){
      w=(me_avg-12)/Math.max(1, grenzwert-12);
      c1_eff=(1-w)*c1_me+w*c1_steck; zoneKey='mid';
    } else { c1_eff=c1_steck; zoneKey='ok'; w=1; }
  }
  return {c1_eff, zoneKey, w, phi_avg, me_avg, B, t, beta, grenzwert, slopeFac,
          c1_steck, c1_me, stecknerGueltig: me_avg >= grenzwert};
}

function autoC1(){
  const a = c1AutoValue();
  let {c1_eff, zoneKey, w, phi_avg, me_avg, B, t, beta, grenzwert, slopeFac,
       c1_steck, c1_me, stecknerGueltig} = a;
  // bg_me als Display-Feld aktualisieren
  const bgMeEl = document.getElementById('bg_me');
  if(bgMeEl) bgMeEl.value = me_avg.toFixed(1);

  // Feld nur setzen wenn nicht manuell überschrieben
  if(!_c1Manual){
    document.getElementById('bg_c1').value = c1_eff.toFixed(1);
  } else {
    // Manueller Wert — c1_eff für _c1Calc aktualisieren aber Feld nicht anfassen
    c1_eff = +gi('bg_c1') || c1_eff;
  }
  _updateC1UI(me_avg, grenzwert, c1_steck, c1_me, c1_eff, zoneKey, stecknerGueltig, w);

  // Details für Info-Panel und Nachweisbericht
  window._c1Calc = {phi_avg,me_avg,B,t,beta,grenzwert,slopeFac,c1_steck,c1_me,c1_eff,zoneKey,
                    stecknerGueltig,w,koernig:_bgKoernig,manual:_c1Manual};
  calculate();
}

// ════════════════════════════════════════════
