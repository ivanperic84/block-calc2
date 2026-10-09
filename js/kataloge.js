// BlockCalc — js/kataloge.js
// Profil- und Tragglied-Kataloge (HEB, Krinner, Mikropfähle)
// PFAHLSICHERUNG — Vordimensionierung
// Broms-Methode (freier Kopf, kurzer Pfahl)
// Winkler-Verformung (Hetényi)
// ════════════════════════════════════════════

// b=Breite, h=Höhe, tw=Stegdicke, tf=Flanschdicke [m]; Iy[m⁴], Wply[m³], A[m²]
const HEB_PROFILES = {
  'HEB160': { b:0.160, h:0.160, tw:0.0080, tf:0.013, Iy:2492e-8,  Wply:354e-6,  A:54.3e-4  },
  'HEB200': { b:0.200, h:0.200, tw:0.0090, tf:0.015, Iy:5696e-8,  Wply:642e-6,  A:78.1e-4  },
  'HEB220': { b:0.220, h:0.220, tw:0.0095, tf:0.016, Iy:8091e-8,  Wply:827e-6,  A:91.0e-4  },
  'HEB240': { b:0.240, h:0.240, tw:0.0100, tf:0.017, Iy:11260e-8, Wply:1053e-6, A:106e-4   },
  'HEB260': { b:0.260, h:0.260, tw:0.0100, tf:0.0175,Iy:14920e-8, Wply:1283e-6, A:118.4e-4 },
  'HEB300': { b:0.300, h:0.300, tw:0.0110, tf:0.019, Iy:25170e-8, Wply:1869e-6, A:149e-4   },
};
// Krinner V-Serie als Sicherungs-Pfahl (Stahlrohr S355, Wandstärke t=5 mm, di=da−10 mm, gestossen).
// b=da (laterale Breite für Broms/Bettung), Iy=π/64·(da⁴−di⁴), Wply=(da³−di³)/6, A=π/4·(da²−di²).
// round:true → 3D als Zylinder (statt I-Profil). Stahlgüte S355 (Mpl nutzt fy=355, wie HEB).
const KRINNER_PILES = {
  'KRV76':  { da:0.076, di:0.066, b:0.076, h:0.076, round:true, Iy:7.06e-7,  Wply:25.3e-6,  A:11.15e-4 },
  'KRV89':  { da:0.089, di:0.079, b:0.089, h:0.089, round:true, Iy:1.168e-6, Wply:35.3e-6,  A:13.19e-4 },
  'KRV114': { da:0.114, di:0.104, b:0.114, h:0.114, round:true, Iy:2.548e-6, Wply:59.4e-6,  A:17.12e-4 },
  'KRV140': { da:0.140, di:0.130, b:0.140, h:0.140, round:true, Iy:4.840e-6, Wply:91.2e-6,  A:21.21e-4 },
  'KRV168': { da:0.168, di:0.158, b:0.168, h:0.168, round:true, Iy:8.512e-6, Wply:133.0e-6, A:25.61e-4 },
};
// Sicherungs-Pfahl-Querschnitt: HEB-Profil ODER Krinner-V-Rohr (Fallback HEB200).
function pfahlSection(typ){ return HEB_PROFILES[typ] || KRINNER_PILES[typ] || HEB_PROFILES['HEB200']; }

// ════════════════════════════════════════════════════════════════════════
// MIKROPFAHL-SYSTEME (CH-Raum) — Tragglied-Kennwerte für das Pfahlbock-Modul
// ════════════════════════════════════════════════════════════════════════
// KEIN Abrostzuschlag (SIA 267): in der Schweiz ist der Korrosions-/Materialzuschlag für
// zugbelastete Mikropfähle & ungespannte Anker EXPLIZIT ausgeschlossen (ASTRA-Bericht 717
// „Dauerhaftigkeit von Mikropfählen…", 2023, §5.4.8 — Korrosion ist lokal/muldenförmig, nicht
// flächig → Materialzuschlag unzweckmässig). Der VOLLE Stahlquerschnitt A_s zählt; die
// Dauerhaftigkeit wird über die Schutzart geregelt (siehe KORROSIONSSCHUTZ), NICHT über A-Abzug.
//
// Variante: {bez, da [mm] Aussen-Ø, di [mm] Innen-Ø (0 = Vollstab), As [mm²] Stahlquerschnitt,
//            fy, ft [N/mm²]}. Stahltragwiderstand R_t,k = A_s·f_y/1000 [kN] (Streckgrenzkraft).
// Vollstäbe (GEWI): A_s = π/4·d² (exakt). Hohlstäbe (Titan/Selbstbohr): A_s = NETTO-Stahl-
// querschnitt lt. Datenblatt (Gewinde reduziert ggü. Vollkreisring) → hier RICHTWERTE,
// massgebend ist das aktuelle Herstellerdatenblatt. Alle Werte editierbar; eigene Typen möglich.
const MICROPILE_SYSTEMS = [
  { id:'stahlton_gewi', hersteller:'Stahlton AG', typ:'Gewindestab, gebohrt (Vollverbund)',
    grade:'GEWI S555/700', E:205000, vars:[
      {bez:'Ø32',   da:32,   di:0, As:804,  fy:555, ft:700},
      {bez:'Ø40',   da:40,   di:0, As:1257, fy:555, ft:700},
      {bez:'Ø50',   da:50,   di:0, As:1963, fy:555, ft:700},
      {bez:'Ø63.5', da:63.5, di:0, As:3167, fy:555, ft:700},
    ]},
  { id:'dywidag_gewi', hersteller:'DYWIDAG', typ:'Gewindestab GEWI, gebohrt (Vollverbund)',
    grade:'B500B / S555', E:205000, vars:[
      {bez:'Ø28', da:28, di:0, As:616,  fy:500, ft:550},
      {bez:'Ø32', da:32, di:0, As:804,  fy:500, ft:550},
      {bez:'Ø40', da:40, di:0, As:1257, fy:500, ft:550},
      {bez:'Ø50', da:50, di:0, As:1963, fy:500, ft:550},
    ]},
  // Küchler KSB® Standard B500 (Selbstbohr-Hohlstab) — Datenblatt kuechler-technik.ch (Aug. 2024).
  // Ryk = Streckgrenze F_yk [kN], Ftk = Bruchlast F_tk [kN] (charakteristisch, direkt aus Datenblatt
  // — NICHT A·fy, da Gewinde den Querschnitt reduziert). A = Nennquerschnitt [mm²].
  { id:'kuechler_ksb', hersteller:'Küchler AG', typ:'KSB® Standard B500 (Selbstbohr-Hohlstab)',
    grade:'B500 (SIA 262 B 500 B)', E:210000, vars:[
      {bez:'R32/22', da:32,  As:360,  fy:580, ft:720, Ryk:200,  Ftk:250},
      {bez:'R32/20', da:32,  As:420,  fy:580, ft:720, Ryk:240,  Ftk:295},
      {bez:'R32/17', da:32,  As:530,  fy:600, ft:700, Ryk:300,  Ftk:360},
      {bez:'R32/15', da:32,  As:580,  fy:600, ft:700, Ryk:340,  Ftk:400},
      {bez:'R38/17', da:38,  As:740,  fy:600, ft:700, Ryk:400,  Ftk:500},
      {bez:'R38/15', da:38,  As:800,  fy:600, ft:700, Ryk:450,  Ftk:580},
      {bez:'R51/35', da:51,  As:950,  fy:600, ft:700, Ryk:540,  Ftk:660},
      {bez:'R51/28', da:51,  As:1150, fy:600, ft:700, Ryk:630,  Ftk:800},
      {bez:'R51/25', da:51,  As:1370, fy:600, ft:760, Ryk:800,  Ftk:1000},
      {bez:'T64/42', da:64,  As:1710, fy:600, ft:730, Ryk:1000, Ftk:1200},
      {bez:'T64/36', da:64,  As:1920, fy:580, ft:740, Ryk:1100, Ftk:1400},
      {bez:'T76/59', da:76,  As:1650, fy:520, ft:650, Ryk:850,  Ftk:1100},
      {bez:'T76/55', da:76,  As:1970, fy:520, ft:650, Ryk:1000, Ftk:1300},
      {bez:'T76/51', da:76,  As:2420, fy:520, ft:650, Ryk:1200, Ftk:1600},
      {bez:'T76/41', da:76,  As:2930, fy:580, ft:750, Ryk:1600, Ftk:2000},
      {bez:'T114/92',da:114, As:3280, fy:520, ft:640, Ryk:1650, Ftk:2050},
    ]},
  // Küchler KSB® INOX (nichtrostend) — Datenblatt kuechler-technik.ch (Aug. 2024).
  { id:'kuechler_ksb_inox', hersteller:'Küchler AG', typ:'KSB® INOX (nichtrostender Hohlstab)',
    grade:'INOX, f_yk 650 N/mm²', E:200000, vars:[
      {bez:'R32 INOX',    da:32, As:480,  fy:650, ft:800, Ryk:300, Ftk:360},
      {bez:'R38 INOX',    da:38, As:800,  fy:650, ft:800, Ryk:460, Ftk:630},
      {bez:'R51 INOX',    da:51, As:1300, fy:650, ft:800, Ryk:760, Ftk:950},
      {bez:'R38 INOX 3b', da:38, As:800,  fy:650, ft:800, Ryk:460, Ftk:630},
    ]},
];
// Hinweis: Die Krinner V-Serie ist KEIN Mikropfahl (Verpresskörper) → sie gehört ins SICHERUNGS-Modul
// (Block + Richtstütze + Pfahl) als `KRINNER_PILES` (Stahlrohr-Querschnitt), nicht in diesen Katalog.

// Korrosionsschutz-/Dauerhaftigkeitsstufen (SIA 267 — KEINE Querschnittsreduktion;
// regelt Schutzart & Lebensdauer, vgl. ASTRA 717 Tab. 22).
const KORROSIONSSCHUTZ = [
  { id:'temp',     bez:'Temporär (< 2 Jahre)',                 dauerhaft:false,
    hinweis:'Zementumhüllung (GCP); kein permanenter Schutz erforderlich' },
  { id:'perm_gcp', bez:'Permanent — einfacher KS (Zementumhüllung GCP)', dauerhaft:true,
    hinweis:'Verrohrte Bohrung sichert Umhüllungsdicke; SIA 267' },
  { id:'perm_dcp', bez:'Permanent — doppelter KS (Kunststoffhüllrohr DCP)', dauerhaft:true,
    hinweis:'Werkseitiges Hüllrohr + Verpresskörper — höchste Dauerhaftigkeit' },
];

// Katalog inkl. benutzerdefinierter Systeme (persistiert unter 'bc_micropiles')
function getMicropileSystems(){
  const custom = (typeof dbGet==='function' ? dbGet('bc_micropiles') : null) || [];
  return MICROPILE_SYSTEMS.concat(custom);
}
// Stahltragwiderstand des Traggliedes (charakteristisch / Bemessung) — OHNE Abrostzuschlag.
// Bevorzugt die Datenblatt-Streckgrenzkraft Ryk = F_yk [kN] (Hohlstäbe: Gewinde reduziert A);
// Fallback A_s·f_yk für Vollstäbe (GEWI) ohne explizites Ryk.
function micropileRtk(v){ return v && v.Ryk != null ? Math.max(0, v.Ryk)
                               : Math.max(0, (v.As||0) * (v.fy||0) / 1000); }      // [kN]
function micropileRtd(v, gammaS){ return micropileRtk(v) / Math.max(1, gammaS||1.15); }

function onPfahlTyp(val){
  const p = pfahlSection(val);
  if(!p) return;
  const EI = 210e6 * p.Iy; // kNm²  (E = 210'000 MPa = 210e6 kN/m²)
  const el = document.getElementById('pfahl-ei-row');
  if(el) el.textContent =
    `EI = ${(EI/1000).toFixed(0)} MNm²  ·  ${p.round?'Ø':'B'} = ${(p.b*100).toFixed(0)} cm  ·  W_pl = ${(p.Wply*1e6).toFixed(0)} cm³`;
  calcPfahlsicherung();
}

// ── Geometrie-Kopplung: d, α, e_h, h_s sind geometrisch abhängig
// Constraint: tan(α) = (h_s - e_h) / d  →  h_s = e_h + d × tan(α)
// Benutzer kann d oder α ändern → h_s wird berechnet und angezeigt

// Kehrt die Wirkungsrichtung der Einwirkungen um: alle Horizontalkräfte und Momente
// wechseln das Vorzeichen, die Normalkraft N_G bleibt (sie wirkt immer abwärts).
// Wirkt auf das Ergebnis nur, wo die Richtung überhaupt unterschieden wird — Böschung im
// GZT (Option), Aushub/Sicherung (Passiv-/Aktivseite), asymmetrischer Kopfversatz.
// Der Original-Steckner ohne diese Einflüsse ist richtungssymmetrisch.
const _FLIP_FIELDS = ['l_HGx','l_HGy','l_MGx','l_MGy','l_HWx','l_HWy','l_MWx','l_MWy'];
function flipLastrichtung(){
  let n = 0;
  _FLIP_FIELDS.forEach(id=>{
    const el = document.getElementById(id); if(!el) return;
    const v = +el.value || 0;
    if(v !== 0){ el.value = String(-v); n++; }
  });
  const h = document.getElementById('flip-hint');
  if(h) h.textContent = n
    ? `Richtung umgekehrt — ${n} Wert${n>1?'e':''} negiert (N_G unverändert).`
    : 'Nichts umzukehren — alle Horizontalkräfte und Momente sind null.';
  try{ updateViewer(); }catch(_){}
  calculate();
}

function _updatePfahlGeomHint(){
  // h_s ist Offset ab OK Fundamentkopf (0 = OK Kopf, negativ = darunter)
  const d       = +gi('pfahl_abstand') || 2.0;
  const e       = +(document.getElementById('pfahl_e')?.value ?? '0');
  const hs_off  = +gi('pfahl_hs')      || 0;    // Offset ab OK Kopf
  const hk      = Math.max(0, +gi('g_hkopf') || 0);
  const ue      = Math.max(0, +gi('g_uberd')  || 0);

  // Anschlusshöhe über GOK: OK Kopf über GOK + Offset
  const y_ok_kopf_gok = Math.max(0, hk - ue);           // OK Kopf über GOK
  const h_anschluss   = y_ok_kopf_gok + hs_off;         // Anschluss über GOK
  // Stütze: vom PFAHLKOPF (y = e = OK Pfahlkopf über GOK) zum Blockanschluss (y = h_anschluss).
  // delta_y signiert: > 0 = Anschluss höher (Stütze steigt zum Block) · < 0 = Pfahlkopf höher
  // (Stütze fällt zum Block → α negativ, Axialkomponente kehrt sich um). FRÜHER e ignoriert
  // (Pfahlkopf fälschlich auf GOK angenommen) → α/F_s/V falsch, sobald e ≠ h_anschluss.
  const delta_y       = h_anschluss - e;
  const alpha_eff     = Math.atan2(delta_y, d) * 180 / Math.PI;
  const L_stuetze     = Math.sqrt(d*d + delta_y*delta_y);

  // α-Feld aktualisieren (readonly, aus Geometrie)
  si('pfahl_alpha', alpha_eff.toFixed(1));

  // β: Horizontalwinkel zwischen den zwei Druckstützen (Plan)
  // Stütze 1 von (x_p, z1=−s/2) zu Kopf (x_kopf, z_ma1=ey+0.20·sign(z1))
  // Stütze 2 von (x_p, z2=+s/2) zu Kopf (x_kopf, z_ma2=ey+0.20·sign(z2))
  const n_p  = +gi('pfahl_anzahl') || 2;
  const s_p  = +gi('pfahl_s')      || 0.5;
  let beta_deg = 0;
  if(n_p >= 2){
    const sign_pf = 1;  // Pfähle auf +x Seite (Gegenseite Aushub)
    const kx      = Math.max(0, +gi('g_kx') || 0);
    const bx      = +gi('g_bx') || 1;
    const ex_val  = +gi('g_ex') || 0;
    const ey_val  = +gi('g_ey') || 0;
    const x_kopf  = kx > 0.01 ? ex_val + sign_pf*(kx/2) : sign_pf*(bx/2);
    const x_p_val = sign_pf * (bx/2 + d);
    const z1 = -s_p/2, z2 = +s_p/2;
    const zm1 = ey_val + Math.sign(z1)*0.20;
    const zm2 = ey_val + Math.sign(z2)*0.20;
    // Vektoren in Plan: Pfahl → Kopf
    const v1x = x_kopf - x_p_val, v1z = zm1 - z1;
    const v2x = x_kopf - x_p_val, v2z = zm2 - z2;
    const dot  = v1x*v2x + v1z*v2z;
    const len1 = Math.sqrt(v1x*v1x + v1z*v1z);
    const len2 = Math.sqrt(v2x*v2x + v2z*v2z);
    beta_deg = len1 > 0 && len2 > 0
      ? Math.acos(Math.min(1, Math.max(-1, dot/(len1*len2)))) * 180/Math.PI : 0;
  }
  si('pfahl_beta', beta_deg.toFixed(1));

  const hint = document.getElementById('pfahl-geom-hint');
  if(hint) hint.textContent =
    `OK Kopf = ${y_ok_kopf_gok.toFixed(2)} m · Anschluss = ${h_anschluss.toFixed(2)} m · α = ${alpha_eff.toFixed(1)}° · β = ${beta_deg.toFixed(1)}° · L_s = ${L_stuetze.toFixed(2)} m`;
}

// d, e oder h_s geändert → α wird aus Geometrie abgeleitet
function onPfahlGeomD(){     _updatePfahlGeomHint(); }
function onPfahlGeomE(){     _updatePfahlGeomHint(); }

// Passiver Erddruckbeiwert bei geneigtem Gelände (Rankine) — für Pfähle, die in eine
// abfallende Böschung hinein widerstehen. β = Böschungsmagnitude [°]. Reduziert sich für
// β→0 exakt auf Kp = tan²(45+φ/2); bei β→φ kollabiert der passive Keil (Restwert cosφ).
//   Kp,β = cosβ · (cosβ + √(cos²β − cos²φ)) / (cosβ − √(cos²β − cos²φ))
function kpSlopeRankine(phi_deg, beta_deg){
  const phi = phi_deg * Math.PI / 180;
  const b   = Math.min(Math.abs(beta_deg), phi_deg - 0.5) * Math.PI / 180;  // β < φ erzwingen
  const cb = Math.cos(b), cp = Math.cos(phi);
  const disc = cb*cb - cp*cp;
  if(disc <= 1e-6) return Math.cos(phi);   // β ≈ φ: unterer Grenzwert
  const root = Math.sqrt(disc);
  return cb * (cb + root) / (cb - root);
}

// ════════════════════════════════════════════════════════════════════════
