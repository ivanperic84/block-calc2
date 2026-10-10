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

// ── Bettungsmodul aus der Setzungsberechnung mit Wiederbelastung ────────────────────────────────
// Lang/Huder/Amann, Bodenmechanik und Grundbau: Abschn. 11.6 (k_sm = p′_m / s_m, mittlere Setzung des
// starren Fundaments im kennzeichnenden Punkt K, Eigengewicht inbegriffen) und Abschn. 8.5 (kombinierte
// Ent- und Belastung): bis zum Gewicht des ausgehobenen Bodens σ′_v(t) wird WIEDERbelastet (M′_E), nur
// der Rest ist Erstbelastung (M_E):  Δs = Δσ_I·Δz/M′_E + (Δσ_II − Δσ_I)·Δz/M_E.
// Last: Eigengewicht des Fundamentkörpers (Block + Kopf), abzüglich Auftrieb — ohne Mastlast (Nutzervorgabe).
// Summation mit dem Einflussfaktor J nach Boussinesq (Rechtecklast, Punkt K bei 0.37·B / 0.37·L),
// abgebrochen, wo J < 10 % (Abschn. 8.4). M_E je Schicht in der Tiefe t + z.
// ANNAHMEN DES PROGRAMMS (Nutzerentscheid Okt 2026): M′_E = Verhältnis · M_E mit dem Startwert 5
// (Feld bg_me_ratio; die Literatur nennt keinen Wert — er gehört aus dem Ödometerversuch bestimmt), und
// der so bestimmte vertikale Bettungsmodul gilt auch für die Stirnflächen (C₁ = C₂ = k_sm).
function _boussJEcke(a, b, z){
  if(z <= 0) return 0.25;
  const R = Math.sqrt(a*a + b*b + z*z);
  return (Math.atan(a*b/(z*R)) + a*b*z/R*(1/(a*a+z*z) + 1/(b*b+z*z))) / (2*Math.PI);
}
function _boussJ(B, L, x, y, z){
  let s = 0;
  for(const a of [B/2 - x, B/2 + x]) for(const b of [L/2 - y, L/2 + y]) s += _boussJEcke(a, b, z);
  return s;
}
function c1Setzung(o){
  const {B, L, t, G} = o, ratio = Math.max(1, +o.ratio || 1);
  const zgw = gwDepth(), u = isFinite(zgw) && t > zgw ? 10 * (t - zgw) : 0;
  const p   = Math.max(0, G / (B*L) - u);            // wirksame Sohlpressung aus Eigengewicht [kPa]
  const sv0 = Math.max(0, sigVeffTo(t));             // Gewicht des ausgehobenen Bodens [kPa]
  const pWB = Math.min(p, sv0), pErst = Math.max(0, p - sv0);
  const meAt = z => Math.max(0.5, (SCHICHTEN.length > 1 ? schichtAtDepth(t + z).me : null) ?? (+gi('bg_me') || 20)) * 1000;
  const dz = 0.02; let z = dz/2, s = 0, I = 0;
  for(; z < 30; z += dz){
    const J = _boussJ(B, L, 0.37*B, 0.37*L, z);
    if(J < 0.10) break;
    const me = meAt(z);
    s += J * dz * (pWB/(ratio*me) + pErst/me); I += J * dz;
  }
  const k = s > 1e-12 ? p / s / 1000 : 0;            // [MN/m³]
  return { k, p, sv0, pWB, pErst, s, I, zEnd: z, ratio, G, u };
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

function _updateC1UI(me_avg, grenzwert, c1_steck, c1_me, c1_eff, zoneKey, stecknerGueltig, w, c1_setz){
  const hint = document.getElementById('bg_c1_hint');
  const chip = document.getElementById('c1-zone-chip');

  // Chip
  const chipLabels = {soft:'M_E massgebend', mid:'Mischung', ok:'Steckner massgebend'};
  const chipCls    = {soft:'chip-warn',      mid:'chip-warn', ok:'chip-ok'};
  if(chip){ chip.textContent=_c1Methode==='setzung' ? 'Setzungsmethode' : chipLabels[zoneKey]; chip.className='c1-zone-chip '+chipCls[zoneKey]; }

  // Zeile 1: Zone + Kontext
  const koernigLbl = _bgKoernig==='fein' ? 'Feinkörnig' : 'Grobkörnig';
  const methForcedLbl = _c1Methode==='setzung'  ? ' · Setzung mit Wiederbelastung gewählt' :
                        _c1Methode==='winkler'  ? ' · Winkler erzwungen' :
                        _c1Methode==='steckner' ? ' · Steckner erzwungen' :
                        _c1Methode==='blend'    ? ' · Blend erzwungen' : '';
  const zoneLbl = zoneKey==='soft'
    ? `M_E=${me_avg.toFixed(0)} MN/m² — M_E·Kp/B begrenzt Steckner · ${koernigLbl}${methForcedLbl}`
    : `M_E=${me_avg.toFixed(0)} MN/m² — Steckner Gl.3 ist der kleinere Wert · ${koernigLbl}${methForcedLbl}`;

  // Zeile 2: Zwischenwerte
  const blendLbl = _c1Methode==='auto' ? 'kleinerer Wert' : _c1Methode==='setzung' ? 'Setzung' : zoneKey==='ok' ? 'Steckner' : 'Winkler';
  const autoVal = _c1Manual ? ` · Auto wäre: ${c1_eff.toFixed(1)}` : '';
  const valLbl = `St: ${c1_steck.toFixed(1)}  Wk: ${c1_me.toFixed(1)}  Setz: ${(c1_setz||0).toFixed(1)}  [${blendLbl}]  →  C₁ = ${_c1Manual?(+gi('bg_c1')||0).toFixed(1):c1_eff.toFixed(1)} MN/m³${autoVal}`;

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
    if(_c1Methode === 'setzung')  mhint.textContent = 'Setzung aus Eigengewicht mit Wiederbelastung — gilt für Sohle und Stirnflächen (Annahme)';
    else if(_c1Methode === 'winkler')  mhint.textContent = 'Winkler erzwungen — M_E · Kp / B';
    else if(_c1Methode === 'steckner') mhint.textContent = 'Steckner erzwungen — φ-abhängig';
    else if(zoneKey==='soft') mhint.textContent = `auto — kleinerer Wert: M_E · Kp / B (Steckner Gl.3 läge höher)`;
    else                      mhint.textContent = `auto — kleinerer Wert: Steckner Gl.3`;
  }
}

// Blendet nicht sinnvolle Methoden-Optionen aus
function _updateC1MethodOptions(me_avg, grenzwert){
  const sel = document.getElementById('bg_c1_methode');
  if(!sel) return;
  const steckOk = me_avg >= grenzwert;
  const opts = [
    { v:'auto',     lbl:'Automatisch — kleinerer Wert',  show: true },
    { v:'winkler',  lbl:'Winkler — M_E · Kp / B',        show: true },
    { v:'steckner', lbl:'Steckner Gl.3 — φ-abhängig',    show: true },
    { v:'setzung',  lbl:'Setzung mit Wiederbelastung',   show: true },
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
    ['lw_G_inf',  SETTINGS.lw_G_inf  ?? 0.80],
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
  const sz = d.setz || {};
  const blendText = _c1Methode==='setzung'
    ? `\nMethode 3 — Setzung mit Wiederbelastung (Lang/Huder/Amann 11.6 und 8.5):\n  Eigengewicht Fundamentkörper G = ${(sz.G||0).toFixed(1)} kN  →  p = ${(sz.p||0).toFixed(1)} kPa\n  Aushubgewicht σ'v(t) = ${(sz.sv0||0).toFixed(1)} kPa  →  Wiederbelastung ${(sz.pWB||0).toFixed(1)} · Erstbelastung ${(sz.pErst||0).toFixed(1)} kPa\n  M'_E = ${(sz.ratio||5).toFixed(1)} · M_E (Startwert 5 = Annahme)\n  Setzung s = ${((sz.s||0)*1000).toFixed(2)} mm (Boussinesq, Punkt K, bis ${(sz.zEnd||0).toFixed(2)} m unter der Sohle)\n  k_sm = p / s = ${(sz.k||0).toFixed(1)} MN/m³  →  C₁ = C₂ = ${d.c1_eff.toFixed(1)} MN/m³\n  Annahme: der vertikale Wert gilt auch für die Stirnflächen.`
    : _c1Methode!=='auto'
    ? `\nMethode fest gewählt (${_c1Methode==='winkler'?'Winkler':'Steckner'}):\n  C₁ = ${d.c1_eff.toFixed(1)} MN/m³`
    : `\nAutomatisch — der kleinere Wert gilt:\n  C₁ = min(${d.c1_steck.toFixed(1)} ; ${d.c1_me.toFixed(1)}) = ${d.c1_eff.toFixed(1)} MN/m³  (${d.zoneKey==='soft'?'M_E · Kp / B':'Steckner Gl.3'})\n  Steckner Gl.3 kennt M_E nicht und setzt tragfähigen Baugrund voraus; der\n  gemessene M_E begrenzt darum nach oben. M_E·Kp/B entspricht in der\n  Drehsteifigkeit etwa SIA 267 Gl. (53) k_s = E_s/D.`;
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
    `  → ${d.stecknerGueltig?'Minimalanforderung der gewählten Bodenart erfüllt':'Minimalanforderung der gewählten Bodenart NICHT erfüllt (Hinweis, ohne Einfluss auf C₁)'}`,
    ...(slpOn ? [`  Böschung β = ${d.beta.toFixed(0)}° (Gl.4-Faktor ${d.slopeFac.toFixed(3)}) mindert C₁ in BEIDEN Methoden`,
                `  → wirkt auch, wenn Steckner-Einsatzbedingung nicht erfüllt ist (Winkler/Blend)`] : []),
    ``,
    `${'─'.repeat(52)}`,
    `Quellen: Steckner (1989) Bautechnik 2/89 Gl.3 · SIA 267 Ziff. 9.5.4.5 Gl. (53)`,
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

// Reiner Auto-C₁-Wert (kleinerer Wert aus Steckner Gl.3 und M_E·Kp/B; β/B/t/φ-abhängig) — ohne UI-Effekte.
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
  // Setzungsmethode (wählbar): Eigengewicht des Fundamentkörpers, Böschungsabminderung wie die anderen Äste
  const _Ls = Math.max(0.1, +gi('g_by') || B), _gb = (typeof _gBetonMassiv==='function' && CALC_MODEL!=='block') ? _gBetonMassiv() : (+gi('g_gbeton') || 25);
  const _Gs = (B*_Ls*Math.max(0, +gi('g_hblock')||0) + Math.max(0,+gi('g_kx')||0)*Math.max(0,+gi('g_ky')||0)*Math.max(0,+gi('g_hkopf')||0)) * _gb;
  const _rs = +gi('bg_me_ratio'), setz = c1Setzung({B, L:_Ls, t, G:_Gs, ratio: _rs >= 1 ? _rs : 5});
  const c1_setz = Math.max(1, setz.k * slopeFac);
  let c1_eff, zoneKey, w=0;
  if(_c1Methode === 'setzung'){
    c1_eff=c1_setz; zoneKey='soft'; w=0;
  } else if(_c1Methode === 'winkler'){
    c1_eff=c1_me; zoneKey='soft'; w=0;
  } else if(_c1Methode === 'steckner'){
    c1_eff=c1_steck; zoneKey='ok'; w=1;
  } else {
    // Okt 2026 (Nutzerentscheid): C₁ = min(Steckner Gl.3, M_E·Kp/B). Steckner Gl.3 kennt M_E nicht
    // (abgeleitet aus Sulzbergers Tabelle Bodenart → C → φ, vorausgesetzt ist «tragfähiger» Baugrund);
    // bei günstigem φ und kleinem M_E überschätzte sie die Bettung um Faktor 3–6. Der gemessene M_E
    // begrenzt darum nach oben. M_E·Kp/B entspricht in der Drehsteifigkeit etwa SIA 267 Gl. (53)
    // k_s = E_s/D (Dreieck mit C₁ an der Sohle ≙ konstant C₁/3; Kp ≈ 3). Der frühere Sprung bei
    // M_E = 12 (feinkörnig) und die Überblendung 12…25 (grobkörnig) entfallen.
    if(c1_me < c1_steck){ c1_eff=c1_me; zoneKey='soft'; w=0; }
    else { c1_eff=c1_steck; zoneKey='ok'; w=1; }
  }
  return {c1_eff, zoneKey, w, phi_avg, me_avg, B, t, beta, grenzwert, slopeFac,
          c1_steck, c1_me, c1_setz, setz, stecknerGueltig: me_avg >= grenzwert};
}

function autoC1(){
  const a = c1AutoValue();
  let {c1_eff, zoneKey, w, phi_avg, me_avg, B, t, beta, grenzwert, slopeFac,
       c1_steck, c1_me, c1_setz, setz, stecknerGueltig} = a;
  const _rf = document.getElementById('bg_me_ratio_field'); if(_rf) _rf.style.display = _c1Methode==='setzung' ? '' : 'none';
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
  _updateC1UI(me_avg, grenzwert, c1_steck, c1_me, c1_eff, zoneKey, stecknerGueltig, w, c1_setz);

  // Details für Info-Panel und Nachweisbericht
  window._c1Calc = {phi_avg,me_avg,B,t,beta,grenzwert,slopeFac,c1_steck,c1_me,c1_setz,setz,methode:_c1Methode,c1_eff,zoneKey,
                    stecknerGueltig,w,koernig:_bgKoernig,manual:_c1Manual};
  calculate();
}

// ════════════════════════════════════════════
