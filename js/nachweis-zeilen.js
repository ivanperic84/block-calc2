// BlockCalc — js/nachweis-zeilen.js
// Erfüllt-Regel, Formelzeilen der Nachweise (GZT/GZG)
// RENDER RESULTS
// ════════════════════════════════════════════
// Ampel auf dem ANGEZEIGTEN (2-Dezimal-)Wert klassifizieren, damit Farbe/Status zur gezeigten Zahl passen
// (η=0.997 zeigt „1.00" → soll grün/erfüllt sein; erst ≤0.99 ist rot). Grenzwert effektiv η ≥ 0.995.
function _etaRound(e){ return Math.round(e*100)/100; }
function _etaOk(e){ return isFinite(e) && _etaRound(e)>=1.0; }   // Erfüllt-Entscheid auf dem angezeigten 2-Dezimal-Wert
// Erfüllt-Entscheid und Ampelfarbe — EINE Regel für Panel, Diagramme und Berichte: entschieden
// wird auf dem angezeigten 2-Dezimal-Wert (η ≥ 0.995 gilt als erfüllt), ∞ gilt als erfüllt.
function etaErf(e){ return e===Infinity || _etaOk(e); }
function etaCol(e){ return etaErf(e) ? 'var(--ok)' : 'var(--fail)'; }
function eCls(e){if(e===Infinity||isNaN(e))return'dim';return _etaRound(e)>=1.0?'ok':'fail';}
function eTxt(e){if(e===Infinity||isNaN(e))return'n.m.';return`η = ${e.toFixed(2)}`;}

// ── Formel-Definitionen für GZT-Zeilen (Steckner Typ C) ─────────────────────
const GZT_ROW_IDS = ['Hd','Md','bid','NL','Ead','Ewd','E0a','Epd','Epb','E0b','Nu','Ru','u','Mu','eta'];

const NW_FORMULAS = {
  Hd:  { sym:'H_d = γ_G·H_G + γ_W·H_W',
         num:(R,G)=>{ const use_x=Math.abs(R.Hxd)>=Math.abs(R.Hyd);
           const H=use_x?Math.abs(R.Hxd):Math.abs(R.Hyd);
           const gG=R.gG_lf??1.35, gW=R.gW_lf??1.5;
           return `γ_G=${gG}·H_G + γ_W=${gW}·H_W = ${H.toFixed(1)} kN`; }},
  Md:  { sym:'M_d = |M_xd – H_d · t|  (Moment am OK Fundament = H*)',
         num:(R,G,cm)=>{ const use_x=Math.abs(R.Hxd)>=Math.abs(R.Hyd);
           const t=G.Hb;
           const Md=use_x?Math.abs(R.Mxd-R.Hxd*t):Math.abs(R.Myd-R.Hyd*t);
           return `t=${t.toFixed(2)} m, ü=${(G.ue||0).toFixed(2)} m → M_d = ${Md.toFixed(1)} kNm`; }},
  bid: { sym:'b_id = B + 0.6·t·tan(φ_k)  [Steckner Gl. 25/26, ST-kalibriert]',
         num:(R,G)=>{ const phi=R.phi_k_GZT||0; const t=G.Hb;
           const V=(0.6*t*Math.tan(phi)).toFixed(3);
           return `B=${G.B} m + 0.6·${t.toFixed(2)}·tan(${(phi*180/Math.PI).toFixed(1)}°) = ${R.bid.toFixed(3)} m`; }},
  NL:  { sym:'Gleichgewicht: Ew(y) – Ep_unter(y) = H_d + R_u  →  Bisektionsverfahren',
         num:(R,G)=>{ const y=R.y_NL_GZT||0; const t=G.Hb;
           return `y = ${y.toFixed(3)} m über UK,  h = ${(t-y).toFixed(3)} m bis Nulllinie`; }},
  Ead: { sym:'Ea = ∫₀ʰ Ka·σᵥ(z)·bid dz – 2·c_d·√Ka·h·bid  (schichtweise)',
         num:(R,G,cm)=>{ const gEa=R.gEa_GZT||1.35;
           const Ea=cm?(R.Ea_GZT/gEa):R.Ea_GZT;
           const t=G.Hb, h=(t-(R.y_NL_GZT||0)).toFixed(2);
           const Ka=(R.Ka_GZT||0.333).toFixed(3);
           return `Ka=${Ka}, h=${h} m, bid=${R.bid.toFixed(2)} m → Ea,${cm?'k':'d'}=${Ea.toFixed(1)} kN`; }},
  Ewd: { sym:'Ew = (E0 + mob·(Ep–E0)) / γ_Ep  (mobilisierter Widerstand, mob=0.25)',
         num:(R,G,cm)=>{ const gEp=R.gEp_GZT||1.4;
           const Ew=cm?(R.Ew_GZT*gEp):R.Ew_GZT;
           const mob=(R.mob_GZT||0.25).toFixed(2);
           const t=G.Hb, h=(t-(R.y_NL_GZT||0)).toFixed(2);
           return `mob=${mob}, Kph=${(R.Kph_GZT||3).toFixed(2)}, h=${h} m, bid=${R.bid.toFixed(2)} m → ${Ew.toFixed(1)} kN`; }},
  E0a: { sym:'E0_über = K0·γ·bid·h²/2  (Ruhedruck über NL — destabilisierend!)',
         num:(R,G,cm)=>{ const gEp=R.gEp_GZT||1.4;
           const E0a=cm?((R.E0a_GZT||0)*gEp):(R.E0a_GZT||0);
           const t=G.Hb, y=R.y_NL_GZT||0, h=(t-y).toFixed(2);
           const K0=(R.K0_GZT||0.5).toFixed(3);
           return `K0=${K0}, h=${h} m → −E0_über·v = destab. Term in Mu`; }},
  Epd: { sym:'Ep_über = Kph·γ·bid·h²/2  (voller passiver Druck über NL)',
         num:(R,G,cm)=>{ const gEp=R.gEp_GZT||1.4;
           const Ep=cm?((R.Epa_GZT||0)*gEp):(R.Epa_GZT||0);
           const t=G.Hb, h=(t-(R.y_NL_GZT||0)).toFixed(2);
           return `Kph=${(R.Kph_GZT||3).toFixed(2)}, h=${h} m → Ep_über=${Ep.toFixed(1)} kN  (Reibung: R_p,v = Ep·tan(⅔φ))`; }},
  Epb: { sym:'Ep_unter = Kph·γ·bid·(t·y – y²/2)  (passiv unter NL)',
         num:(R,G,cm)=>{ const gEp=R.gEp_GZT||1.4;
           const Ep=cm?((R.Epb_GZT||0)*gEp):(R.Epb_GZT||0);
           const y=(R.y_NL_GZT||0).toFixed(3);
           return `y=${y} m, bid=${R.bid.toFixed(2)} m → Ep_unter=${Ep.toFixed(1)} kN`; }},
  E0b: { sym:"E0_unter = K0·γ·bid·(t·y/2 – y²/6)  (Ruhedruck unter NL — stabilisierend)",
         num:(R,G,cm)=>{ const gEp=R.gEp_GZT||1.4;
           const E0=cm?((R.E0b_GZT||0)*gEp):(R.E0b_GZT||0);
           const K0=(R.K0_GZT||0.5).toFixed(3), y=(R.y_NL_GZT||0).toFixed(3);
           return `K0=${K0}, y=${y} m → E0_unter=${E0.toFixed(1)} kN`; }},
  Nu:  { sym:'N_u = N_d + Ra,v − Rp,v_über − Rp,v_unter  (korrekte Vorzeichen nach ST)',
         num:(R,G)=>{ const Nu=(R.Nu_GZT||0).toFixed(1);
           const Ra=(R.Ra_v_GZT||0).toFixed(1);
           const Rpa=(R.Rp_va_GZT||0).toFixed(1), Rpb=(R.Rp_vb_GZT||0).toFixed(1);
           return `N_d=${(R.Nd_GZT??R.Nd).toFixed(1)} + Ra,v=${Ra} − Rp,v_ü=${Rpa} − Rp,v_u=${Rpb} = ${Nu} kN`; }},
  Ru:  { sym:'R_u = N_u · tan(φ_k)  (Sohlreibung, φ_k charakteristisch nach ST)',
         num:(R,G)=>{ const Ru=(R.Ru_GZT||0).toFixed(1);
           const phi=R.phi_k_GZT||0;
           return `N_u=${(R.Nu_GZT||0).toFixed(1)} kN · tan(${(phi*180/Math.PI).toFixed(1)}°) = ${Ru} kN`; }},
  u:   { sym:'u ≈ (B/2)·(1−(y/B)²)  [Winkler-Näherung: Exzentrizität Sohlreaktion]',
         num:(R,G)=>{ const u=(R.u_ecc_GZT||0).toFixed(3);
           const y=(R.y_NL_GZT||0).toFixed(3);
           return `B/2=${(G.B/2).toFixed(3)} m, y=${y} m → u = ${u} m`; }},
  Mu:  { sym:'M_u = −(Ew−Ea+E0_ü)·v + (Ep_u+E0_u)·v\' + (Ra+Rp+Rp\')·A/2 + Ru·(D−ü) + Nu·u  [Gl.66]',
         num:(R,G,cm)=>{ const gEp=R.gEp_GZT||1.4;
           const Mu=cm?(R.Mu_GZT*gEp):R.Mu_GZT;
           const av=(R.arm_v_GZT||0).toFixed(2), avp=(R.arm_vp_GZT||0).toFixed(2);
           const ue=(R.ue_GZT||0).toFixed(2);
           const h_block=(G.Hb-(R.ue_GZT||0)).toFixed(2);
           return `v=${av} m, v'=${avp} m, H_Block=${h_block} m → M_u=${Mu.toFixed(1)} kNm`; }},
  eta: { sym:'η = M_u / M_d  ≥ 1.0  (η=1: Grenzzustand nach Steckner, Bezug: OK Block)',
         num:(R,G,cm)=>{ const gEp=R.gEp_GZT||1.4;
           const use_x=Math.abs(R.Hxd)>=Math.abs(R.Hyd);
           // M_d an OK Block (= Hd×(Hk+ü) + My_ext) — konsistent mit M_ok_x in Berechnung
           const Md_d=use_x?(R.M_ok_x_d||0):(R.M_ok_y_d||0);
           const Md_k=use_x?(R.M_ok_x_k||0):(R.M_ok_y_k||0);
           const Mu_=cm?(R.Mu_GZT*gEp):R.Mu_GZT;
           const Md_=cm?Md_k:Md_d;
           const eta=(Md_>0.001?Math.max(0,Mu_)/Md_:Infinity);
           return `${Mu_.toFixed(1)} kNm / ${Md_.toFixed(1)} kNm = ${isFinite(eta)?eta.toFixed(3):'—'}`; }},

  // ── GZG Schiefstellung — Steckner 1989 Gl.11–21
  gzgHk: { sym:'H_k = γ_G,gzg·H_G + γ_Q,gzg·H_W  (massgebende Richtung)',
    num:(R,G)=>`H_k = ${(R.H_k_GZG||0).toFixed(1)} kN` },
  gzgNk: { sym:'N_k = γ_G,gzg·N_G + G_k  (Eigengewicht γ = 1.00, SIA 267 §4.4.3)',
    num:(R,G)=>`N_k = ${(R.N_k_GZG||0).toFixed(1)} kN` },
  gzgC1: { sym:'C₁ aus Boden-Tab (Steckner Gl.3 / Winkler M_E·Kp/B) · C₂ = C₁',
    num:(R,G)=>`C₁ = ${((R.C1_GZG||0)/1000).toFixed(1)} MN/m³` },
  gzgTa1: { sym:'tan α₁ = 6·(N_k·tan φ_k + H_k) / (B·D²·C₁)  [Gl.11 — Überwindung Sohlreibung]',
    num:(R,G)=>`6·(${(R.N_k_GZG||0).toFixed(1)}·tanφ_k + ${(R.H_k_GZG||0).toFixed(1)}) / (${G.B}·${G.Hb.toFixed(2)}²·C₁) = ${(R.tan_a1_GZG||0).toFixed(5)}` },
  gzgTa2: { sym:'tan α₂ = 2·N_k / (A²·B·C₂)  [Gl.12 — Abheben der hinteren Sohlkante]',
    num:(R,G)=>`2·${(R.N_k_GZG||0).toFixed(1)} / (${G.L}²·${G.B}·C₂) = ${(R.tan_a2_GZG||0).toFixed(5)}` },
  gzgM1: { sym:'M₁(α): α≤α₁ → B·D³·C₁·α/12 [Gl.13] · α≤3α₁ → D·(N_k·tanφ+H_k)/2 [Gl.14] · sonst B·D³·C₁·α/36 [Gl.15]',
    num:(R,G)=>{ const tz=R.tanZul_GZG??_tanZul(true); const ta1=R.tan_a1_GZG||0;
      const reg = tz<=ta1?'Gl.13':(tz<=3*ta1?'Gl.14':'Gl.15');
      return `α_zul=${tz.toFixed(4)} vs α₁=${ta1.toFixed(4)} → ${reg}: M₁ = ${(R.M1_GZG_val||0).toFixed(1)} kNm`; }},
  gzgM2: { sym:'M₂(α): α≤α₂ → B·A³·C₂·α/12 [Gl.16] · sonst N_k·(A/2 − √(2N_k/(B·C₂·α))/3) [Gl.17]',
    num:(R,G)=>{ const tz=R.tanZul_GZG??_tanZul(true); const ta2=R.tan_a2_GZG||0;
      return `α_zul=${tz.toFixed(4)} vs α₂=${ta2.toFixed(4)} → ${tz<=ta2?'Gl.16':'Gl.17'}: M₂ = ${(R.M2_GZG_val||0).toFixed(1)} kNm`; }},
  gzgMuc: { sym:'M_u,char: GZT-Grenzmoment (Gl.66) mit charakteristischen Lasten — γ_Ea = γ_Ep = 1, N = N_k  [Gl.21]',
    num:(R,G)=>`M_u,char = ${(R.Mu_char_GZG||0).toFixed(1)} kNm` },
  gzgMa: { sym:'M_α = M₁ + M₂ − HD-Korrektur [Gl.18–20], begrenzt auf M_u,char [Gl.21]',
    num:(R,G)=>`M₁+M₂ = ${((R.M1_GZG_val||0)+(R.M2_GZG_val||0)).toFixed(1)} kNm → min(M_α, M_u,char=${(R.Mu_char_GZG||0).toFixed(1)}) = ${(R.Malpha_GZG_val||0).toFixed(1)} kNm` },
  gzgMok: { sym:'M_ok = |H_k·H_Kopf + M_G,k + M_W,k + N_k·e|  (Moment an OK Block, charakteristisch)',
    num:(R,G)=>`M_ok = ${(R.M_ok_char_GZG||0).toFixed(1)} kNm` },
  gzgTanRes: { sym:'tan(α)_res aus M_α(α) = M_ok  (Bisektion — resultierende Schiefstellung unter H_k)',
    num:(R,G)=>{ const a=R.alpha_GZG_calc||0;
      return a<1e-9?'—':`tan(α)_res = ${a.toFixed(5)}  (= ${(a*1000).toFixed(1)} mm/m)`; }},
  gzgTanZul: { sym:'tan(α)_zul — zulässige Schiefstellung (SBB 0161.1011.0007: 1/100 ständig+veränderlich, 1/200 veränderlich allein; Grenzwerte in den Optionen)',
    num:(R,G)=>`tan(α)_zul = ${(R.tanZul_GZG??_tanZul(true)).toFixed(4)}` + ((R.gzgPerm===false) ? ' (veränderlich allein)' : ' (ständig + veränderlich)') },
  gzgEta: { sym:'η = M_α / M_ok  ≥ 1.0  (aufnehmbares Moment bei zul. Schiefstellung ≥ vorhandenes Moment)',
    num:(R,G)=>`${(R.Malpha_GZG_val||0).toFixed(1)} / ${(R.M_ok_char_GZG||0).toFixed(1)} = ${R.etaGZG===Infinity?'—':R.etaGZG.toFixed(3)}` }
};

// Baut HTML-String der GZT kv-Zeilen (k oder d Modus)
function buildGZTRows(R, G, charMode) {
  const cm = charMode;
  const gEa = R.gEa_GZT||1.35, gEp = R.gEp_GZT||1.4;
  const use_x = Math.abs(R.Hxd)>=Math.abs(R.Hyd);
  const sfx = cm ? 'k' : 'd';
  const t = G.Hb;          // G.Hb = H_Block + ü = effektive Einbindetiefe
  const ue = G.ue || 0;   // ü = Überdeckung

  const H_val   = cm ? (use_x?Math.abs(R.Hxk||0):Math.abs(R.Hyk||0))
                     : (use_x?Math.abs(R.Hxd):Math.abs(R.Hyd));
  const M_val   = cm ? (use_x?(R.M_ok_x_k||0):(R.M_ok_y_k||0))
                     : (use_x?(R.M_ok_x_d||0):(R.M_ok_y_d||0));
  const Ea_val  = cm ? (R.Ea_GZT/gEa)             : R.Ea_GZT;
  const E0a_val = cm ? ((R.E0a_GZT||0)*gEp)        : (R.E0a_GZT||0);
  const Ew_val  = cm ? (R.Ew_GZT*gEp)              : R.Ew_GZT;
  const Epa_val = cm ? ((R.Epa_GZT||0)*gEp)        : (R.Epa_GZT||0);
  const Epb_val = cm ? ((R.Epb_GZT||0)*gEp)        : (R.Epb_GZT||0);
  const E0b_val = cm ? ((R.E0b_GZT||0)*gEp)        : (R.E0b_GZT||0);
  const Mu_val  = cm ? (R.Mu_GZT*gEp)              : R.Mu_GZT;
  const eta_val = M_val > 0.001 ? Math.max(0,Mu_val) / M_val : Infinity;
  const y_nl = R.y_NL_GZT||0;
  const Nu_val  = R.Nu_GZT||0;
  const Ru_val  = R.Ru_GZT||0;
  const u_val   = R.u_ecc_GZT||0;
  const av      = R.arm_v_GZT||0;
  const avp     = R.arm_vp_GZT||0;
  const Ra_v    = R.Ra_v_GZT||0;
  const Rp_va   = R.Rp_va_GZT||0;
  const Rp_vb   = R.Rp_vb_GZT||0;
  const h_nl    = t - y_nl;

  const rows = [
    ['Hd',  `H_${sfx}`,                            H_val.toFixed(1)+' kN'],
    ['Md',  `M_${sfx}  (OK Fund.)`,                M_val.toFixed(1)+' kNm'],
    ['bid', 'b_id',                                  R.bid.toFixed(3)+' m'],
    ['NL',  'Nulllinie y',                           y_nl.toFixed(3)+' m  (über UK)'],
    ['Ead', `Ea,${sfx}  (über NL)`,                Ea_val.toFixed(1)+' kN'],
    ['Ewd', `Ew,${sfx}  mob. passiv (über NL)`,    Ew_val.toFixed(1)+' kN'],
    ['E0a', `E0,${sfx}  (über NL) — destab.`,      E0a_val.toFixed(1)+' kN'],
    ['Epd', `Ep,${sfx}  passiv (über NL)`,         Epa_val.toFixed(1)+' kN'],
    ['Epb', `Ep,${sfx}  passiv (unter NL)`,        Epb_val.toFixed(1)+' kN'],
    ['E0b', `E0,${sfx}  (unter NL)`,               E0b_val.toFixed(1)+' kN'],
    ['Nu',  `N_u  =Nd+Ra−Rp−Rp'`,                  Nu_val.toFixed(1)+' kN'],
    ['Ru',  'R_u  = N_u·tan(φ_k)',                  Ru_val.toFixed(1)+' kN'],
    ['u',   'u  (Exzentrizität Sohlreaktion)',       u_val.toFixed(3)+' m'],
    ['Mu',  `M_u,${sfx}  (Grenzmoment Gl.66)`,     Mu_val.toFixed(1)+' kNm'],
    ['eta', 'η = M_u / M_d',                         isFinite(eta_val)?eta_val.toFixed(3):'—'],
  ];

  return rows.map(([id,k,v])=>{
    const fDef = NW_FORMULAS[id];
    const fHtml = fDef ? `<div class="nw-row-formula" id="fml-${id}">
      <div class="f-sym">${fDef.sym}</div>
      <div class="f-num">= ${fDef.num(R,G,cm)}</div></div>` : '';
    return `<div class="nw-row clickable" onclick="toggleGZTFormula('fml-${id}',this)">
      <span>${k}</span><span>${v}</span></div>${fHtml}`;
  }).join('');
}

function toggleGZTFormula(id, row) {
  const el = row.nextElementSibling;
  if(el && el.classList.contains('nw-row-formula')){
    el.classList.toggle('open');
  }
}

// Baut HTML der GZG kv-Zeilen — klickbare Zeilen mit Formel-Aufschlüsselung (wie GZT)
function buildGZGRows(R, G){
  const tanZul = R.tanZul_GZG ?? _tanZul(true);
  // Massgebende Kombination — bewusst als ZAHLENVERGLEICH statt als Erklärtext: der GZG wählt
  // zwischen den beiden Richtungen (grösseres |H_k| ⇒ grösseres M_ok). Eine γ-Variation wie im
  // GZT (8 Kombinationen aus γ_G sup/inf × γ_Q) gibt es hier nicht — der GZG ist nach SIA 267
  // die charakteristische Kombination mit γ = 1.00; das steht als EIN Satz darunter.
  const dir = R.gzgDir || '—';
  const cmpRow = (lbl, H, M, gov) =>
    `<div style="display:flex;gap:8px;padding:1px 0;color:${gov?'var(--acc)':'var(--dim)'}">
       <span style="width:44px">${gov?'▸ ':'&nbsp;&nbsp;'}${lbl}</span>
       <span style="width:118px">|H_k| = ${H.toFixed(1)} kN</span>
       <span>M_ok = ${M.toFixed(1)} kNm</span></div>`;
  const kombDetail =
    cmpRow('quer',  R.gzgHxk||0, R.gzgMxk||0, dir==='quer') +
    cmpRow('längs', R.gzgHyk||0, R.gzgMyk||0, dir==='längs') +
    `<div style="margin-top:4px;color:var(--xdim)">GZG = charakteristische Kombination
      (γ_G = ${(R.gzgGamG??1).toFixed(2)} · γ_Q = ${(R.gzgGamQ??1).toFixed(2)}, SIA 267) — anders als
      im GZT keine γ-Variation; gewählt wird die Richtung.</div>`;
  const rows = [
    ['gzgKomb',  'Massgebende Kombination',  dir, kombDetail],
    ['gzgHk',    'H_k  (charakteristisch)',  (R.H_k_GZG||0).toFixed(1)+' kN'],
    ['gzgNk',    'N_k  (inkl. G_k)',         (R.N_k_GZG||0).toFixed(1)+' kN'],
    ['gzgC1',    'C₁  Bettungsziffer',       ((R.C1_GZG||0)/1000).toFixed(1)+' MN/m³'],
    // E4 — zweite, unabhängige Herleitung als Vergleichswert (reine Anzeige, geht NICHT in die
    // Rechnung ein). EAB EB 102: k_h = f_h · M_E / t mit f_h = 0.5 (horizontal weicher als
    // vertikal). Weicht die Steckner-Bettungsziffer stark davon ab, ist das ein Prüfsignal —
    // beide Herleitungen sind etabliert, EB 102 stammt aber aus dem Baugrubenwandbau.
    ['gzgKh',    'k_h Vergleich (EAB EB 102)', (()=>{
        const t_ = Math.max(0.1, (G&&G.Hb) || 0);
        const me = Math.max(0.3, +gi('bg_me') || 10);
        const kh = 0.5 * me / t_;
        const c1 = (R.C1_GZG||0)/1000;
        const q  = kh > 0.01 ? (c1/kh) : 0;
        return kh.toFixed(1)+' MN/m³'+(q>0?'  ·  C₁/k_h = '+q.toFixed(1):'');
      })(),
      `Unabhängige Abschätzung der horizontalen Bettungsziffer:
       <b>k_h = f_h · M_E / t</b> mit f_h = 0.50 (EAB EB 102, horizontal weicher als vertikal),
       M_E = ${(+gi('bg_me')||10).toFixed(0)} MN/m², t = ${(((G&&G.Hb)||0)).toFixed(2)} m.<br>
       Dient nur dem Quervergleich zu C₁ (Steckner Gl.3/4) — die Rechnung nutzt ausschliesslich C₁.
       Die beiden Ansätze integrieren unterschiedlich (C₁ über die Blockhöhe, EB 102 über die
       Einbindetiefe), ein Faktor in dieser Grössenordnung ist daher normal; ein Vielfaches wäre
       ein Anlass, die Baugrundkennwerte zu prüfen.`],
    ['gzgTa1',   'tan α₁  (Gl.11)',          (R.tan_a1_GZG||0).toFixed(5)],
    ['gzgTa2',   'tan α₂  (Gl.12)',          (R.tan_a2_GZG||0).toFixed(5)],
    ['gzgM1',    'M₁  (Gl.13–15)',           (R.M1_GZG_val||0).toFixed(1)+' kNm'],
    ['gzgM2',    'M₂  (Gl.16/17)',           (R.M2_GZG_val||0).toFixed(1)+' kNm'],
    ['gzgMuc',   'M_u,char  (Gl.21)',        (R.Mu_char_GZG||0).toFixed(1)+' kNm'],
    ['gzgMa',    'M_α  (Gl.18–21)',          (R.Malpha_GZG_val||0).toFixed(1)+' kNm'],
    ['gzgMok',   'M_ok  (charakteristisch)', (R.M_ok_char_GZG||0).toFixed(1)+' kNm'],
    ['gzgTanRes','tan(α)_res',               (R.alpha_GZG_calc||0)<1e-9?'—':R.alpha_GZG_calc.toFixed(5)],
    ['gzgTanZul','tan(α)_zul',               tanZul.toFixed(5)],
    ['gzgEta',   'η = M_α / M_ok',           R.etaGZG===Infinity?'—':R.etaGZG.toFixed(3)],
  ];
  const warn = R.gzgBettungKollaps
    ? `<div class="nw-row" style="background:var(--fail-bg,rgba(200,60,60,.12));color:var(--fail);
        font-size:10px;line-height:1.35;padding:6px 8px;border-radius:var(--r1)">
        Stirnbettung rechnerisch erschöpft: M₁ &lt; H·D bei zul. Schiefstellung (C₁ durch
        steile Böschung stark reduziert, Steckner-Faktor 1+β/40). η auf 0 gesetzt = Nachweis
        nicht erfüllt. Steckner Gl.4 gilt nur für milde Geländeneigung — bei β ≲ −30° das
        Schiefstellungsmodell nicht mehr anwenden (globale Böschungs-/Gleitkreis­standsicherheit
        massgebend).</div>`
    : '';
  return warn + rows.map(([id,k,v,d])=>{
    const fDef = NW_FORMULAS[id];
    // Aufklapp-Inhalt: entweder die hinterlegte Formel oder ein zeilen-eigener Erklärtext (4. Element)
    const fHtml = fDef ? `<div class="nw-row-formula" id="fml-${id}">
      <div class="f-sym">${fDef.sym}</div>
      <div class="f-num">= ${fDef.num(R,G)}</div></div>`
      : (d ? `<div class="nw-row-formula" id="fml-${id}"><div class="f-num">${d}</div></div>` : '');
    return `<div class="nw-row clickable" onclick="toggleGZTFormula('fml-${id}',this)">
      <span>${k}</span><span>${v}</span></div>${fHtml}`;
  }).join('');
}
