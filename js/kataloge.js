// BlockCalc — js/kataloge.js
// Profil- und Tragglied-Kataloge (HEB, Krinner, Mikropfähle)
// PFAHLSICHERUNG — Vordimensionierung
// Broms-Methode (freier Kopf, kurzer Pfahl)
// Winkler-Verformung (Hetényi)
// ════════════════════════════════════════════

// b=Breite, h=Höhe, tw=Stegdicke, tf=Flanschdicke [m]; Iy[m⁴], Wply[m³], A[m²]
// Iy/Wply = starke Achse, Iz/Wplz = schwache Achse (Okt 2026 ergänzt — der Einzelpfahl wird in
// beiden Richtungen gebogen; mit der starken Achse für beide wäre die schwache Richtung zu günstig).
const HEB_PROFILES = {
  'HEB160': { b:0.160, h:0.160, tw:0.0080, tf:0.013, Iy:2492e-8,  Wply:354e-6,  A:54.3e-4, Iz:889.2e-8, Wplz:170.0e-6 },
  'HEB180': { b:0.180, h:0.180, tw:0.0085, tf:0.014, Iy:3831e-8,  Wply:481.4e-6, A:65.3e-4, Iz:1363e-8, Wplz:231.0e-6 },
  'HEB200': { b:0.200, h:0.200, tw:0.0090, tf:0.015, Iy:5696e-8,  Wply:642e-6,  A:78.1e-4, Iz:2003e-8, Wplz:305.8e-6 },
  'HEB220': { b:0.220, h:0.220, tw:0.0095, tf:0.016, Iy:8091e-8,  Wply:827e-6,  A:91.0e-4, Iz:2843e-8, Wplz:393.9e-6 },
  'HEB240': { b:0.240, h:0.240, tw:0.0100, tf:0.017, Iy:11260e-8, Wply:1053e-6, A:106e-4, Iz:3923e-8, Wplz:498.4e-6 },
  'HEB260': { b:0.260, h:0.260, tw:0.0100, tf:0.0175,Iy:14920e-8, Wply:1283e-6, A:118.4e-4, Iz:5135e-8, Wplz:602.2e-6 },
  'HEB280': { b:0.280, h:0.280, tw:0.0105, tf:0.018, Iy:19270e-8, Wply:1534e-6, A:131.4e-4, Iz:6595e-8, Wplz:717.6e-6 },
  'HEB300': { b:0.300, h:0.300, tw:0.0110, tf:0.019, Iy:25170e-8, Wply:1869e-6, A:149e-4, Iz:8563e-8, Wplz:870.1e-6 },
};
// Krinner V-Serie (Schraubpfahl). Kenndaten aus der allgemeinen Bauartgenehmigung DIBt Z-34.15-253
// vom 22.12.2023 (gültig bis 22.12.2028), Anlage 1 — bis Okt 2026 standen hier ANNAHMEN (S355, t = 5 mm):
//   KSF V 89   Ø  88.9 × 5.0 mm   S235 JRH
//   KSF V 114  Ø 114.3 × 5.0 mm   S235 JRH
//   KSF V 140  Ø 139.7 × 6.3 mm   S235 JRH
// V 76 und V 168 sind NICHT Gegenstand der Genehmigung (zul:false) — Abmessungen bleiben Annahmen.
// Aus dem Bescheid, für die Anwendung massgebend:
//   · Ziff. 1(6) / 2.2(7): planmässig NUR AXIAL (Zug/Druck); Horizontallasten höchstens 3 % der
//     Vertikallast; Biegung ist konstruktiv zu vermeiden (≥ 3 Pfähle unter einer Einzellast).
//   · Ziff. 2.4.1: innere Tragfähigkeit mit 1.5 mm Abrostung der Nennwanddicke (Dauereinsatz).
//   · Ziff. 2.4.2 / 2.5: äussere Tragfähigkeit je Baugrösse durch Probebelastung; max. Prüfkraft
//     Zug 113 / 197 / 243 kN (V 89 / 114 / 140); Einbindung ≥ 1.20 m in die tragfähige Schicht.
//   · Stoss: Steckverbindung (gepresster 8-Kant) mit zwei Bolzen M24 → im Programm als Gelenk.
// Die Verwendung als biegebeanspruchter Sicherungs- oder Einzelpfahl liegt damit AUSSERHALB der
// Genehmigung; das Programm rechnet sie weiter (Bauzustand), weist aber darauf hin.
// abrost [mm]: Abzug von der Wanddicke (aussen angesetzt). round:true → 3D als Zylinder.
function _krinnerRohr(da_mm, t_mm, zul, pmax){
  const q=_rohrQuerschnitt(da_mm, t_mm);
  return { ...q, durchgehend:false, fy:235, zul:!!zul, tNenn:t_mm/1000, FpMax:pmax||0 };
}
function krinnerAbgerostet(typ, abrost_mm){
  const p=KRINNER_PILES[typ]; if(!p) return null;
  const t=Math.max(0.5, p.tNenn*1000-(abrost_mm||0)), q=_rohrQuerschnitt(p.da*1000-2*(abrost_mm||0), t);
  return { ...p, ...q, durchgehend:false, b:p.b, h:p.h, da:q.da, di:q.di, t:q.t };
}
// Rammrohre (Stahlrohr, durchgehend — KEIN Stoss-Gelenk wie beim Krinner-Rohr), nur Einzelpfahl des
// Pfahlfundaments. Abmessungen da × t nach EN 10219; Querschnittswerte aus der Kreisringformel
// (exakt): I = π/64·(da⁴−di⁴), W_pl = (da³−di³)/6, A = π/4·(da²−di²).
function _rohrQuerschnitt(da_mm, t_mm){
  const da=da_mm/1000, t=t_mm/1000, di=da-2*t;
  return { da, di, t, b:da, h:da, round:true, durchgehend:true,
           Iy:Math.PI/64*(Math.pow(da,4)-Math.pow(di,4)), Wply:(Math.pow(da,3)-Math.pow(di,3))/6,
           A:Math.PI/4*(da*da-di*di) };
}
const KRINNER_PILES = {
  'KRV76':  _krinnerRohr( 76.1, 5.0, false),
  'KRV89':  _krinnerRohr( 88.9, 5.0, true, 113),
  'KRV114': _krinnerRohr(114.3, 5.0, true, 197),
  'KRV140': _krinnerRohr(139.7, 6.3, true, 243),
  'KRV168': _krinnerRohr(168.3, 6.3, false),
};
const KRINNER_HINWEIS = 'Krinner V-Serie: nach Bauartgenehmigung DIBt Z-34.15-253 planmässig nur axial belastbar (Horizontallast ≤ 3 % der Vertikallast), äusserer Widerstand durch Probebelastung.';
const RAMMROHRE = {
  'RR324': _rohrQuerschnitt(323.9, 10.0),
  'RR406': _rohrQuerschnitt(406.4, 10.0),
  'RR508': _rohrQuerschnitt(508.0, 12.5),
  'RR610': _rohrQuerschnitt(610.0, 12.5),
  'RR711': _rohrQuerschnitt(711.0, 12.5),
};
// Stahlgüten für Walzprofile und Rammrohre des Einzelpfahls (f_yk in N/mm², Nennwert bis t = 40 mm).
const STAHLGUETEN = { '235':235, '275':275, '355':355, '460':460 };
// Pfahl-Querschnitt: HEB-Profil, Krinner-V-Rohr oder Rammrohr (Fallback HEB200).
function pfahlSection(typ){ return HEB_PROFILES[typ] || KRINNER_PILES[typ] || RAMMROHRE[typ] || HEB_PROFILES['HEB200']; }
// Torsionswiderstandsmoment W_t [m³] (elastisch, St. Venant):
//   I-Profil (offen):  I_T = (2·b·t_f³ + (h−2·t_f)·t_w³)/3 — ohne Ausrundungen, also auf der sicheren
//                      Seite (Tabellenwert HEB 200: 59.3 cm⁴, Formel 49.1 cm⁴);  W_t = I_T / t_f
//   Rohr (geschlossen): W_t = 2·A_m·t  mit A_m = π·d_m²/4 (Bredt)
function profilTorsion(ps){
  if(!ps) return { It:0, Wt:0 };
  if(ps.round){ const t=(ps.t!=null) ? ps.t : (ps.da-ps.di)/2, dm=ps.da-t, Am=Math.PI*dm*dm/4;
    return { It:Am*dm*t, Wt:2*Am*t }; }
  const It=(2*ps.b*Math.pow(ps.tf,3) + (ps.h-2*ps.tf)*Math.pow(ps.tw,3))/3;
  return { It, Wt:It/ps.tf };
}

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
    `EI = ${(EI/1000).toFixed(0)} MNm²  ·  ${p.round?'Ø':'B'} = ${(p.b*100).toFixed(0)} cm  ·  W_pl = ${(p.Wply*1e6).toFixed(0)} cm³  ·  S${p.fy||355}`
    + (KRINNER_PILES[val] ? '  ·  '+KRINNER_HINWEIS+(p.zul?'':' Diese Baugrösse ist nicht Teil der Genehmigung (Abmessungen angenommen).') : '');
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
