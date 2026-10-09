// BlockCalc — js/pfahlfundament-kern.js
// Pfahlfundament: Gruppengleichgewicht, Mantelreibung, pfahlbockAnalyse
// PFAHLBOCK — räumliches Gruppengleichgewicht (starres Bankett, geneigte Mikropfähle)
// ════════════════════════════════════════════════════════════════════════
// Mikropfahl = primär AXIALES Glied (Mantelreibung, Ø≤300 mm): die Neigung (Batter) trägt
// die Horizontallast axial ab, Biegung ist sekundär (Lateral-p-y separat). Starres Bankett,
// 6 Freiheitsgrade q=[u,v,w,θx,θy,θz] an der Referenz (UK Sockel).
//   Pfahl i: Einheits-Achsvektor abwärts u_i = normalize(tan(αx), tan(αy), −1)
//            (αx/αy = Neigung quer/längs [°], tan = Horizontal/Vertikal).
//            Kopf-Position r_i = [x_i, y_i, 0]; Axialdehnung e_i = u_i·(u_trans + θ×r_i)
//            = B_i·q  mit B_i = [u_i ; r_i×u_i]. Axialkraft F_i = kAx_i·e_i (>0 = Druck).
//   K = Σ kAx_i·B_iB_iᵀ  (6×6) ; Last P = [Hx,Hy,−N,Mx,My,Mz] (N>0 = Druck abwärts).
// Jeder Pfahlkopf trägt eine 3×3-Translationssteifigkeit diag(kAx, kLat, kLat) im lokalen
// Rahmen (Achse + 2 ⊥); kLat (p-y-Lateralsteifigkeit) schliesst die sonst freien DOF (Torsion,
// Querverschiebung) — Default 0.05·kAx (Mikropfahl biegeweich). Kopf gelenkig (keine Momenten-
// einleitung in den schlanken Pfahl). δ_i = T_i·q mit T_i=[I3 | −skew(r_i)]; K_i = T_iᵀ·Kg_i·T_i.
// piles[i] = {x, y, axDeg, ayDeg, kAx, kLat?}. Rückgabe {q, dir:[u_i], F:[F_i axial], FLat:[…]} | null.
// verticalAxis=true: Pfahlachse für die Steifigkeit senkrecht idealisiert (tx=ty=0) → die
// Schrägstellung wird für die VERFORMUNG vernachlässigt (Kopplungsterm K[u,θ] entfällt:
// Moment → reine Verdrehung θ=M/Σ kAx·xᵢ², Horizontalkraft → reine Verschiebung u=H/Σ kLat).
// Opt-in über SETTINGS.pfahlGzgDecouple; NUR für die GZG-Verformung — die Kraftberechnung
// (Axialkräfte) läuft immer mit echter Neigung (verticalAxis=false).
function solvePfahlbock(piles, load, verticalAxis){
  if(!piles || !piles.length) return null;
  const K = Array.from({length:6}, () => new Array(6).fill(0));
  const store = [];
  for(const p of piles){
    const tx = verticalAxis ? 0 : Math.tan((p.axDeg||0)*Math.PI/180),
          ty = verticalAxis ? 0 : Math.tan((p.ayDeg||0)*Math.PI/180);
    const Ln = Math.hypot(tx, ty, 1);
    const u = [tx/Ln, ty/Ln, -1/Ln];                     // Achse abwärts
    // zwei Senkrechte zur Achse
    const ref = Math.abs(u[2]) > 0.9 ? [1,0,0] : [0,0,1];
    const cross = (a,b)=>[a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
    let e2 = cross(u, ref); const n2 = Math.hypot(...e2)||1; e2 = e2.map(v=>v/n2);
    const e3 = cross(u, e2);
    const kAx = Math.max(1e-6, p.kAx), kLat = Math.max(1e-9, p.kLat!=null ? p.kLat : 0.05*kAx);
    const axes = [u, e2, e3], kloc = [kAx, kLat, kLat];
    // globale 3×3-Kopfsteifigkeit Kg = Σ k_a · (axis_a ⊗ axis_a)
    const Kg = [[0,0,0],[0,0,0],[0,0,0]];
    for(let a=0;a<3;a++) for(let i=0;i<3;i++) for(let j=0;j<3;j++) Kg[i][j] += kloc[a]*axes[a][i]*axes[a][j];
    const r = [p.x||0, p.y||0, 0];
    // T (3×6) = [I3 | −skew(r)] ;  −skew(r) Spalten 3..5
    const T = [ [1,0,0,  0,    0,   -r[1]],
                [0,1,0,  0,    0,    r[0]],
                [0,0,1,  r[1],-r[0], 0   ] ];
    for(let a=0;a<6;a++) for(let b=0;b<6;b++){ let s=0;
      for(let i=0;i<3;i++) for(let j=0;j<3;j++) s += T[i][a]*Kg[i][j]*T[j][b];
      K[a][b] += s; }
    // Kopf-Drehfixität: nur bei kollinearer/Einzel-Anordnung gesetzt (p.kRot>0, biegesteifer
    // Anschluss vorausgesetzt) — schliesst die sonst freie Rotation um die Pfahllinie. Im
    // Regelfall (≥3 nicht-kollinear) ist p.kRot=0 → rein gelenkiges (konservatives) Modell.
    const kR = Math.max(0, p.kRot || 0);
    K[3][3] += kR; K[4][4] += kR; K[5][5] += kR;
    store.push({u, e2, e3, kAx, kLat, T});
  }
  const P = [ load.Hx||0, load.Hy||0, -(load.N||0), load.Mx||0, load.My||0, load.Mz||0 ];
  const q = solveLinearDense(K, P);
  if(!q) return null;
  const F=[], FLat=[], dir=[];
  for(const s of store){
    const d = [0,1,2].map(i => s.T[i].reduce((acc,Tij,j)=>acc+Tij*q[j], 0)); // Kopfverschiebung
    const eA = s.u[0]*d[0]+s.u[1]*d[1]+s.u[2]*d[2];       // axiale Komponente
    const eL2= s.e2[0]*d[0]+s.e2[1]*d[1]+s.e2[2]*d[2];
    const eL3= s.e3[0]*d[0]+s.e3[1]*d[1]+s.e3[2]*d[2];
    F.push(s.kAx*eA);                                     // >0 = Druck
    FLat.push(s.kLat*Math.hypot(eL2, eL3));               // resultierende Lateral-Kopfkraft
    dir.push(s.u);
  }
  return { q, dir, F, FLat };
}

// ── Pfahlbock-Analyse: Steifigkeiten, ULS-Pfahlkräfte, Axial-/Stahlnachweis, GZG ──────
// Mikropfahl: Tragglied (Katalog) im Verpresskörper Ø dG (≤0.30 m, nur Mantelreibung).
// Axialsteifigkeit kAx = E_s·A_s/L (Stahldehnung dominiert); kLat aus p-y (bddBeamPY).
// Mantelreibung schichtweise am Verpresskörper-Umfang U=π·dG; Axialwiderstand =
// min(Stahl R_t,d, Mantelreibung R_s,d) für Druck UND Herausziehen (keine Spitze).
// GZG (charakteristisch, SBB Last-Zeitdiagramm 0161.1011.0007):
//   Schiefstellung ≤ 1:100 (ständig+veränderlich quer & längs) · ≤ 1:200 (veränderlich quer)
//   Horiz.verschiebung ≤ ±20 mm (st.+ver.) · ≤ ±10 mm (ver. quer) — für 1-/2-Pfahlfundamente
// cfg: {piles:[{x,y,axDeg,ayDeg}], L, e, dGrout, tendon (Katalog-Var.), E_steel [N/mm²],
//       loadULS, loadGZG_full, loadGZG_var (je {N,Hx,Hy,Mx,My} an UK Sockel),
//       gammaR, gammaS, alphaZul, alphaZulVar, uLim, uLimVar, dispCheck}
// ── Mantelreibung Mikropfahl (schichtweise, am Verpresskörper Ø dG) ──────────────
// Verpresspfahl ⇒ q_s,k aus Verpressdruck, NICHT aus K₀·σ'v (β-Methode = Bohrpfahl, ~10× zu tief).
// q_s,k je Schicht: explizit (Tabelle/Probebelastung, s.qs [kPa]) ODER bodenart-bezogener
// Erfahrungswert nach EA-Pfähle / DIN 4128 (tiefenkonstant, Verpress-/Mikropfahl).
// skinFac: globale Abminderung (verrohrt ≈ 0.40 · verpresst 1.0). Rückgabe R_s,k [kN].
//
// VORGABEWERTE q_s,k [kPa] — Okt 2026 gegen die EA-Pfähle abgeglichen und GESENKT (Nutzer:
// «zu optimistisch»). Bezug: EA-Pfähle, verpresste Mikropfähle (D_s ≤ 0.30 m), Bruchwert q_s1,k:
//   Tab. 5.29 nichtbindig   q_c =  7.5 MN/m²: 135–175 ·  15: 215–280 ·  ≥ 25: 255–315
//   Tab. 5.30 bindig        c_u =  60 kN/m²:   55–65  · 150:  95–105
//   Als tragfähig gilt erst q_c ≥ 7.5 MN/m² bzw. c_u ≥ 60 kN/m².
// Ohne Sondierung ist die Lagerungsdichte unbekannt ⇒ angesetzt wird die UNTERE Grenze der
// NIEDRIGSTEN tragfähigen Klasse (Sand, Schluff, Ton) bzw. für Kies die untere Grenze bei
// q_c ≈ 10 MN/m² (zwischen 135 und 215 interpoliert). Böden unter der Tragfähigkeitsschwelle
// (lockerer Sand, weicher Ton, lockere Auffüllung) erhalten deutlich reduzierte Werte.
// Die früheren Werte (Kies 200 · Sand 150 · Schluff 80 · Ton 70) entsprachen einer mitteldichten
// bis dichten Lagerung bzw. steifer Konsistenz, die ohne Nachweis nicht vorausgesetzt werden darf.
// Fels: keine Tabelle in der EA-Pfähle — Wert unverändert, nur mit Probebelastung belastbar.
const QS_EXP = { kies:160, sand:135, schluff:55, ton:55, fels:400,
                 sand_locker:80, aufsch_verd:100, aufsch_locker:40, ton_weich:30 };
function microQsExp(s){
  if(s && s.preset && QS_EXP[s.preset] != null) return QS_EXP[s.preset];
  const phi = +(s && s.phi != null ? s.phi : 30), c = +(s && s.c != null ? s.c : 0);
  if(c >= 15 && phi <= 27) return Math.min(100, Math.max(30, 2.75*c));  // bindig: aus c′ (Ton/Schluff)
  return Math.min(160, Math.max(80, 100 + (phi-30)*10));                // nichtbindig: φ als Dichte-Proxy
}
function microSkinFriction(L, dG, skinFac, alphaC, Lcrit){
  const U = Math.PI * dG, sf = (skinFac > 0 ? skinFac : 1);
  // WIRKSAME VERPRESSLÄNGE (Aug 2026): q_s,k ist ein tiefenkonstanter Erfahrungswert (EA-Pfähle/
  // DIN 4128) — ohne Deckel wüchse R_s,k unbegrenzt linear mit L. Real ist die mitwirkende Länge
  // begrenzt: der Verpresskörper entbindet fortschreitend (die elastische Dehnung des Traggliedes
  // wächst schneller als die Verschiebung, bei der die Mantelreibung ihr Maximum erreicht), und die
  // q_s,k-Tabellen sind für übliche Verpresslängen kalibriert, nicht für beliebige Extrapolation.
  // Umsetzung als KONSTRUKTIVE OBERGRENZE L_eff = min(L, L_crit) — bewusst eine transparente
  // Bemessungsregel, KEINE Normformel; L_crit in den Optionen einstellbar (0 = kein Deckel).
  const Lc = (Lcrit > 0) ? Math.min(L, Lcrit) : L;
  // Schichtweise EXAKT an den Schichtgrenzen (innerhalb der wirksamen Länge [0,L_eff], Tiefe ab
  // Pfahlkopf/GOK) → Widerstand je Schicht + Verlauf über die Tiefe. q_s,k: explizit (Tabelle/
  // Probebelastung, s.qs) hat Vorrang, sonst Erfahrungswert. dRk je Schicht inkl. Verrohrung sf.
  const layers = []; let z = 0;
  for(let k=0; k<SCHICHTEN.length && z < Lc-1e-6; k++){
    const s = SCHICHTEN[k], isLast = (k===SCHICHTEN.length-1);
    const bot = (s.d===999 || isLast) ? Lc : Math.min(Lc, z + (+s.d||0));
    const z0 = z, z1 = Math.min(Lc, bot);
    if(z1 > z0 + 1e-6){
      let qs = (s.qs != null && +s.qs > 0) ? +s.qs : microQsExp(s); qs = Math.max(0, qs);
      layers.push({ name:(s.name||''), preset:(s.preset||''), z0, z1, dz:z1-z0, qs, dRk: qs*U*(z1-z0)*sf });
    }
    z = bot;
  }
  const Rk = layers.reduce((a,l)=>a + l.dRk, 0);
  const qsAvg = Lc>0 ? layers.reduce((a,l)=>a + l.qs*l.dz, 0)/Lc : 0;
  const qsArr = layers.map(l=>l.qs);
  return { Rk, qsAvg, qsMin: qsArr.length?Math.min(...qsArr):0, qsMax: qsArr.length?Math.max(...qsArr):0,
           layers, L, Leff: Lc, Lcrit: (Lcrit>0?Lcrit:0), capped: Lc < L - 1e-6 };
}

// ── Axiale Kopfsteifigkeit Mikropfahl: Lastübertragung (t-z, Randolph) ───────────
// Bettungsbalken in Achsrichtung: EA-Stab + verteilte Mantelfedern k_shaft(z) = 2π·G/ζ,
// G aus M_E je Schicht (E_oed→G), ζ = ln(r_m/r_0), r_m ≈ 2.5·L·(1−ν). Freier Fuss (nur
// Mantelreibung, keine Spitze). Erfasst Stahldehnung (mit Lastabbau) UND Boden-Last-Setzung
// in einem → ersetzt das frühere E_s·A_s/L (das den Lastabbau ignorierte). 1D-FE, N=40.
function microAxialStiffness(L, dG, EA){
  const nu = 0.3, Gfac = (1-2*nu)/(2*(1-nu));          // E_oed → G
  const r0 = Math.max(0.02, dG/2), rm = Math.max(2*r0, 2.5*L*(1-nu));
  const zeta = Math.max(0.5, Math.log(rm/r0));
  const ksAx = z => { const me = Math.max(0.3, schichtAtDepth(Math.max(0,z)).me ?? (+gi('bg_me')||10));
    return 2*Math.PI*(Gfac*me*1000)/zeta; };                 // verteilte Mantelfeder [kN/m je m]
  const M = 40, le = L/M, ND = M+1;
  const K = Array.from({length:ND},()=>new Array(ND).fill(0)), F = new Array(ND).fill(0);
  for(let el=0; el<M; el++){
    const ax = EA/le;                                        // Stab-Axialsteifigkeit
    K[el][el]+=ax; K[el][el+1]-=ax; K[el+1][el]-=ax; K[el+1][el+1]+=ax;
    const ks = ksAx((el+0.5)*le)*le;                         // gelumpte Mantelfeder, halb je Knoten
    K[el][el]+=ks/2; K[el+1][el+1]+=ks/2;
  }
  F[0] = 1;                                                  // Einheits-Kopfkraft, Fuss frei
  const w = solveLinearDense(K, F);
  return (w && w[0] > 1e-12) ? 1/w[0] : EA/L;                // Kopfsteifigkeit [kN/m] (Fallback EA/L)
}

// ── Gruppenwirkungsgrad η_g (axiale Mantelreibung) ───────────────────────────────
// Einfacher, selbst-deaktivierender Faktor auf Basis des MITTLEREN Achsabstands über die
// Einbindelänge (Kopf + Fuss-Spreizung durch Batter, weil q_s,k tiefenkonstant). Geneigte
// Pfähle spreizen auf → s_mittel gross → η_g≈1 (kein künstlicher Abzug); nur senkrecht-eng
// stehende Pfähle (s/D klein über die ganze Länge) bekommen Abzug. KEIN Converse-Labarre-Grid
// (Layout-unabhängig, robust): volle Effizienz ab s/D≥6, linear bis 0.70 bei s/D=2 (konservativ).
function pileGroupEfficiency(piles, L, dG){
  const nn = pts => { if(pts.length < 2) return Infinity;
    let sum = 0; for(let i=0;i<pts.length;i++){ let d = Infinity;
      for(let j=0;j<pts.length;j++) if(i!==j) d = Math.min(d, Math.hypot(pts[i].x-pts[j].x, pts[i].y-pts[j].y));
      sum += d; } return sum/pts.length; };
  const heads = piles.map(p => ({x:+(p.x||0), y:+(p.y||0)}));
  const toes  = piles.map(p => ({x:+(p.x||0)+L*Math.sin((p.axDeg||0)*Math.PI/180),
                                  y:+(p.y||0)+L*Math.sin((p.ayDeg||0)*Math.PI/180)}));
  const sCap = nn(heads), sToe = nn(toes), sMean = 0.5*(sCap + sToe);
  const sd = sMean / Math.max(0.01, dG);
  const eta = isFinite(sd) ? Math.max(0.70, Math.min(1, 0.70 + (sd-2)/4*0.30)) : 1;
  return { eta:+eta.toFixed(3), sCap:+sCap.toFixed(2), sToe:+sToe.toFixed(2),
           sMean:+sMean.toFixed(2), sd:isFinite(sd)?+sd.toFixed(1):Infinity };
}

// ── Lateraler Gruppenfaktor (p-Multiplier) ───────────────────────────────────────────────
// Eng stehende Pfähle überlagern ihre lateralen Druckzonen ("shadowing") → die p-y-Kurve der
// Gruppe ist gegenüber dem Einzelpfahl abgemindert (Reese & Van Impe; API RP-2A; AASHTO).
// Streng ist p_m reihenweise (Führungsreihe ≈ 0.8, Folgereihen 0.3–0.5 bei s/D = 3); hier
// bewusst EIN Gruppenmittel über s/D — Vordimensionierungs-Niveau und identisch zur Kurve, die
// das Sicherungsmodul seit je verwendet: volle Wirkung ab s/D ≥ 5, 0.65 bei s/D ≤ 3, linear dazwischen.
// Wirkt auf Steifigkeit UND Grenzwiderstand (der p-Multiplier skaliert die ganze p-y-Kurve).
function latGroupFactor(sOverD){
  const r = +sOverD;
  if(!isFinite(r) || r >= 5) return 1.0;
  if(r <= 3) return 0.65;
  return 0.65 + (r - 3) / 2 * 0.35;
}

function pfahlbockAnalyse(cfg){
  const n = cfg.piles.length;
  const L = Math.max(0.5, cfg.L||6), e = Math.max(0, cfg.e||0);
  const dG = Math.min(0.30, Math.max(0.05, cfg.dGrout||0.15));
  const tdn = cfg.tendon || {As:1970, da:76, fy:520, Ryk:1000};
  const Es = (cfg.E_steel || 210000) * 1000;               // N/mm² → kN/m²
  const As = (tdn.As||0) * 1e-6;                           // m²
  const da = (tdn.da||50) / 1000;                          // Tendon-Ø [m]
  const di = Math.sqrt(Math.max(0, da*da - 4*As/Math.PI)); // Innen-Ø aus A (Hohlstab)
  // Querschnittswerte: Mikropfahl-Tragglied → aus da/di abgeleitet (Voll-/Hohlkreis).
  // Walzprofil (HEB/Krinner beim Einzelpfahl) → tdn.I / tdn.Wpl direkt aus der Profiltabelle.
  const I  = (tdn.I != null) ? tdn.I : Math.PI/64 * (Math.pow(da,4) - Math.pow(di,4));
  const EI = Math.max(1, Es * I);                          // kNm²
  const kAxSteel = Es * As / L;                           // reine Stahldehnung (Referenz)
  const kAx = microAxialStiffness(L, dG, Es * As);        // kN/m: Stahl + Boden-Last-Setzung (t-z)
  // Gruppenwirkungsgrad (axial, Mantelreibung) — hier oben berechnet, weil der LATERALE
  // Gruppenfaktor dieselbe Abstandskennzahl s̄/D nutzt und schon in ksAt/puAtL eingehen muss.
  const grp      = pileGroupEfficiency(cfg.piles, L, dG);
  // Lateraler Gruppeneffekt (p-Multiplier, Option SETTINGS.pfahlLatGroup, Standard AN): mindert die
  // p-y-Kurve — Steifigkeit (ksAt) UND Grenzwiderstand (puAtL) — bei engem Achsabstand. Geneigte
  // Pfähle spreizen mit der Tiefe auf ⇒ s̄/D gross ⇒ Faktor 1.0 (selbst-deaktivierend, wie bei η_g).
  const latGrpOn  = (typeof SETTINGS === 'undefined') || SETTINGS.pfahlLatGroup !== false;
  const latGrpFac = latGrpOn ? latGroupFactor(grp.sd) : 1;
  // Laterale Bettung (schichtweise M_E) + p-y-Kopfsteifigkeit
  const nu = 0.3, alat = Math.min(1, Math.max(0.1, +(SETTINGS.pfahlAlphaLat ?? 0.30)));
  // Böschung (abfallend) reduziert die laterale Bettung/Stützung (Talseite) — Faktor Kp,β/Kp aus renderPfahlbock.
  const bettungFac = Math.min(1, Math.max(0.1, cfg.bettungFac ?? 1));
  const ksAt = z => { const s = schichtAtDepth(Math.max(0,z)); const me = Math.max(0.5, s.me ?? (+gi('bg_me')||10));
                      return me*1000 / ((1-nu*nu)*dG) * alat * bettungFac * latGrpFac; };
  const py1 = bddBeamPY(EI, dG, e, L, 1, ksAt);
  const kLat = py1 ? Math.max(1, 1000/Math.max(1e-3, py1.yHead_mm)) : 0.02*kAx;
  // Mantelreibung am Verpresskörper — schichtweise, q_s je Schicht (s.qs) oder α_c·c + β·σ'v.
  // Globale Abminderung skinFac (verrohrt ≈ 0.40); Zug/Herausziehen zusätzlich zugFac.
  const skinFac = Math.min(1, Math.max(0.05, cfg.skinFac ?? 1));
  const zugFac  = Math.min(1, Math.max(0.05, cfg.zugFac ?? 1));
  const alphaC  = +(SETTINGS.pfahlAlphaC ?? 1.0);
  // Wirksame Verpresslänge: Deckel auf die mitwirkende Mantelfläche (Optionen, 0 = aus)
  const _Lcrit   = Math.max(0, +(SETTINGS.pfahlLcrit ?? 10));
  const _sk      = microSkinFriction(L, dG, skinFac, alphaC, _Lcrit);
  const Rskin_k  = _sk.Rk * grp.eta;                            // Druck (charakteristisch), η_g-reduziert
  const Rskin_kZ = Rskin_k * zugFac;                            // Zug (Herausziehen)
  const gR = Math.max(1, cfg.gammaR ?? 1.40), gS = Math.max(1, cfg.gammaS ?? 1.15);
  const Rskin_d  = Rskin_k  / gR;                               // Druck-Bemessungswiderstand
  const Rskin_dZ = Rskin_kZ / gR;                               // Zug-Bemessungswiderstand
  // ── Laterale BODEN-Tragfähigkeit (ULS) — Grenzgleichgewicht der p_u-Hüllkurve (Rotations-/Kick-out-
  //    Versagen des kurzen Pfahls). Fehlte bisher (nur lineare Bettung) → sehr kurze Pfähle „bestanden".
  //    p_u(z) schichtweise (Reibung 3·Kp·σ'v·B, bindig 9·c_u·B), Böschung via bettungFac. Gilt für den
  //    EINZELPFAHL (Kopf trägt volle Mast-H+M) UND als Reserve-Check je Pfahl der Gruppe.
  //    latGrpFac: p-Multiplier (Gruppen-Shadowing) — skaliert die p-y-Kurve, also auch p_u.
  const puAtL = z => { const s=schichtAtDepth(Math.max(0,z)), ph=s.phi??30;
    if(ph<=5) return z>1.5*dG ? 9*Math.max(0,s.c??0)*dG*latGrpFac : 0;
    const Kp=Math.tan(Math.PI/4+ph*Math.PI/360)**2; return 3*Kp*sigVeffTo(z)*dG*bettungFac*latGrpFac; };
  const Vcap_k = pileLatCapLimitEq(L, dG, 0, puAtL) || 0;       // reine Querkraft-Grenzlast am GOK [kN]
  const Mcap_k = pileLatMomCap(L, dG, puAtL) || 0;              // reines Moment-Grenzwiderstand [kNm]
  const Vcap_d = Vcap_k/gR, Mcap_d = Mcap_k/gR;
  // Knick-Deckel: die Euler-auf-Bettung-Formel N_cr=2√(k·EI) ist längenunabhängig und nur gültig, wenn die
  // Einbindelänge mindestens eine Knick-Halbwelle L_hw=π·(EI/(k·B))^0.25 umfasst — sonst ist sie ungültig
  // (der laterale Nachweis wird dann massgebend). Flag zur Kennzeichnung im Panel/Bericht.
  let _ksMinL = Infinity; for(let i=0;i<=20;i++) _ksMinL = Math.min(_ksMinL, ksAt(i/20*L));
  const kbedL = Math.max(1e-6, _ksMinL * dG);
  const L_hw = Math.PI * Math.pow(EI/kbedL, 0.25);   // Knick-Halbwellenlänge [m]
  const knickValid = L >= L_hw;                       // Euler-auf-Bettung nur oberhalb gültig
  const Rt_d = micropileRtd(tdn, gS);                     // Stahl axial (Streckgrenzkraft)
  // Biegewiderstand Tragglied: W_pl ≈ (da³−di³)/6 (Voll-/Hohlkreis), M_Rd = W_pl·f_yk/γ_s
  const Wpl  = (tdn.Wpl != null) ? tdn.Wpl : (Math.pow(da,3) - Math.pow(di,3)) / 6;   // m³
  const M_Rd = Wpl * (tdn.fy||500)*1000 / gS;             // kNm
  // Biegemoment für M+N: bei gestossenen Pfählen (Stoss = Gelenk, nur N+V) baut sich Moment nur
  // innerhalb des längsten Einzelelements auf (M=0 am Stoss) → Biegelänge auf LbendMax begrenzen.
  // Das obere Element wird als eigenständiger Bettungsbalken (freie/gelenkige Enden) gerechnet.
  const Lbend = (cfg.LbendMax && cfg.LbendMax > 0) ? Math.min(L, cfg.LbendMax) : L;
  const pyBend = (Lbend < L - 1e-6) ? bddBeamPY(EI, dG, e, Lbend, 1, ksAt) : py1;
  const Mmax1 = pyBend ? pyBend.Mmax_kNm : (py1 ? py1.Mmax_kNm : 0);  // Biegemoment je kN Lateral-Kopflast (über Biegelänge)
  // Konsistent GELENKIGER (pinned) Kopf — konservativ: KEINE Kopf-Drehfixität der Pfähle.
  // Die translatorischen Kopfsteifigkeiten (kAx, kLat) an ihren Hebelarmen halten die Bankett-
  // Rotation über das Druck/Zug-Paar — vollständig, solange die Pfähle NICHT kollinear sind
  // (≥3 nicht-kollinear, 2D-Raster). Bei kollinearer/Einzel-Anordnung bliebe die Rotation um
  // die Pfahllinie frei → singulär; NUR dort Drehfixität kRot=2·EI·λ ansetzen, was einen
  // biegesteifen Kopfanschluss VORAUSSETZT (Warnung im Panel via headFixReq).
  const lam = Math.pow(Math.max(1e-9, ksAt(0)*dG/(4*EI)), 0.25);
  const _xs = cfg.piles.map(p => +(p.x||0)), _ys = cfg.piles.map(p => +(p.y||0));
  const _spanX = Math.max(..._xs) - Math.min(..._xs), _spanY = Math.max(..._ys) - Math.min(..._ys);
  const headFixReq = cfg.piles.length < 3 || _spanX < 0.05 || _spanY < 0.05;  // kollinear/Einzel
  const kRot = headFixReq ? 2 * EI * lam : 0;             // 0 = rein gelenkig (Regelfall ≥3 nicht-kollinear)
  const piles = cfg.piles.map(p => ({...p, kAx, kLat, kRot}));
  // ── ULS: jede Lastkombination (LF quer/längs × γ_G,inf/sup) lösen + komponentenweise
  //    Aufschlüsselung (lineare Superposition). Massgebenden je Pfahl über alle Kombos.
  const ulsCombos = (cfg.ulsCombos && cfg.ulsCombos.length) ? cfg.ulsCombos
                  : (cfg.loadULS ? [{label:'ULS', lf:'ULS', load:cfg.loadULS}] : []);
  const _comps = ['N','Hx','Hy','Mx','My'];
  const ulsData = ulsCombos.map(c => {
    const sol = solvePfahlbock(piles, c.load);
    const comps = {};
    _comps.forEach(k => { const ld = {}; ld[k] = c.load[k] || 0; const s = solvePfahlbock(piles, ld); comps[k] = s ? s.F : null; });
    return { label:c.label, lf:c.lf, load:c.load, sol, F:sol?sol.F:null, FLat:sol?sol.FLat:null, comps };
  });
  const np = piles.length;
  let etaSteel = Infinity, etaGeo = Infinity, govPile = -1, govComboIdx = -1, Ncomp = 0, Mmax = 0, govLat = -1, FLatMax = 0;
  const pileRes = [], pileDecomp = [];
  for(let i=0;i<np;i++){
    let eGeo_i = Infinity, eSteel_i = Infinity, geoCombo = -1;
    ulsData.forEach((u,ci) => {
      if(!u.F) return;
      const F = u.F[i], FLat = u.FLat[i], Mp = Mmax1 * FLat;
      const Rsd = F < 0 ? Rskin_dZ : Rskin_d;               // Zug (Herausziehen) vs Druck
      const eG = Math.abs(F) > 0.01 ? Rsd/Math.abs(F) : Infinity;
      const utilS = Math.abs(F)/Math.max(0.01,Rt_d) + Math.abs(Mp)/Math.max(0.01,M_Rd);
      const eS = utilS > 1e-6 ? 1/utilS : Infinity;
      if(eG < eGeo_i){ eGeo_i = eG; geoCombo = ci; }
      if(eS < eSteel_i) eSteel_i = eS;
      if(F > Ncomp) Ncomp = F;
      if(Math.abs(Mp) > Mmax) Mmax = Math.abs(Mp);
      if(Math.abs(FLat) > FLatMax){ FLatMax = Math.abs(FLat); govLat = i; }
    });
    const rep = geoCombo >= 0 ? geoCombo : 0;              // repräsentative Kombo (geo-massgebend)
    const Frep = ulsData[rep] && ulsData[rep].F ? ulsData[rep].F[i] : 0;
    const FLatRep = ulsData[rep] && ulsData[rep].FLat ? ulsData[rep].FLat[i] : 0;
    pileRes.push({ F:+Frep.toFixed(1), zug:Frep<0, Mp:+(Mmax1*FLatRep).toFixed(1), Flat:+FLatRep.toFixed(1),
      eGeo:+eGeo_i.toFixed(2), eSteel:+eSteel_i.toFixed(2), lf: ulsData[rep]?ulsData[rep].lf:'' });
    const parts = {}; let sum = 0;
    _comps.forEach(k => { const v = (ulsData[rep] && ulsData[rep].comps[k] ? ulsData[rep].comps[k][i] : 0) || 0; parts[k] = +v.toFixed(1); sum += v; });
    pileDecomp.push({ total:+Frep.toFixed(1), parts, sum:+sum.toFixed(1), lf: ulsData[rep]?ulsData[rep].lf:'' });
    if(eGeo_i < etaGeo){ etaGeo = eGeo_i; govPile = i; govComboIdx = rep; }
    if(eSteel_i < etaSteel) etaSteel = eSteel_i;
  }
  // ── Laterale Boden-Tragfähigkeit (ULS) je Kombo: Interaktion Querkraft V + Grundmoment M_gl.
  //    Einzelpfahl (np=1): der Kopf trägt die volle Mast-Horizontallast + das Mast-Moment (M_gl =
  //    M_Kopf + V·e). Gruppe: massgebender Pfahl über die laterale Kopfkraft FLat (Moment steckt im
  //    axialen Kräftepaar → dort via η_Geo/η_Stahl erfasst) → konservativer Reserve-Check.
  let etaLat = Infinity, latGovCombo = -1, latVd = 0, latMd = 0;
  ulsData.forEach((u,ci) => {
    let Vd, Mgl;
    if(np === 1){ const ld = u.load || {};
      Vd  = Math.hypot(ld.Hx||0, ld.Hy||0);
      Mgl = Math.hypot(ld.Mx||0, ld.My||0) + Vd*e;          // Grundmoment = Kopfmoment + V·freie Länge
    } else {
      Vd  = u.FLat ? Math.max(...u.FLat.map(v=>Math.abs(v))) : 0;
      Mgl = Vd*e;                                            // Gruppe: Kopfmoment ≈ 0 (axiales Kräftepaar)
    }
    const util = (Vcap_d>1e-6 ? Vd/Vcap_d : (Vd>1e-6?9e9:0)) + (Mcap_d>1e-6 ? Mgl/Mcap_d : (Mgl>1e-6?9e9:0));
    const eL = util>1e-9 ? 1/util : Infinity;
    if(eL < etaLat){ etaLat = eL; latGovCombo = ci; latVd = Vd; latMd = Mgl; }
  });
  const uls = (govComboIdx >= 0 && ulsData[govComboIdx]) ? ulsData[govComboIdx].sol : (ulsData[0] ? ulsData[0].sol : null);
  const govCombo = (govComboIdx >= 0 && ulsData[govComboIdx]) ? ulsData[govComboIdx].label : (ulsData[0]?ulsData[0].label:'');
  const govLoad = (govComboIdx >= 0 && ulsData[govComboIdx]) ? ulsData[govComboIdx].load : (ulsData[0]?ulsData[0].load:{});
  const govLoadChar = (govComboIdx >= 0 && ulsCombos[govComboIdx]) ? ulsCombos[govComboIdx].loadChar : (ulsCombos[0]?ulsCombos[0].loadChar:null);
  // ── Knicknachweis SIA 263: elast. Verzweigungslast (Euler auf Winkler-Bettung, weichste
  // Schicht) → bez. Schlankheit λ̄ = √(N_pl,k/N_cr) → Abminderung χ (Knickkurve c, α=0.49
  // für Stahl-Voll/Hohlstäbe) → Knickwiderstand N_b,Rd = χ·N_pl,k/γ_s. η = N_b,Rd/N_Ed.
  let ksMin = Infinity; for(let i=0;i<=20;i++) ksMin = Math.min(ksMin, ksAt(i/20*L));
  const N_cr  = 2 * Math.sqrt(Math.max(1e-6, ksMin*dG*EI));  // [kN] elastische Knicklast
  const N_pl_k = micropileRtk(tdn);                          // char. Streckgrenzkraft (= R_t,k)
  const lamBar = Math.sqrt(Math.max(1e-9, N_pl_k / Math.max(1e-6, N_cr)));   // bez. Schlankheit
  const alphaImp = 0.49;                                     // Imperfektionsbeiwert Knickkurve c
  const Phi = 0.5 * (1 + alphaImp*(lamBar - 0.2) + lamBar*lamBar);
  const chi = Math.min(1, 1 / (Phi + Math.sqrt(Math.max(0, Phi*Phi - lamBar*lamBar))));
  const N_bRd = chi * N_pl_k / gS;                           // [kN] Knickwiderstand (Bemessung)
  const etaKnick = Ncomp > 0.01 ? N_bRd/Ncomp : Infinity;
  // ── GZG: Schiefstellung, Horizontalverschiebung, Setzung (charakteristisch) — je LF,
  //    massgebenden (max) über die Lastfälle nehmen. Akzeptiert Kombo-Arrays oder Einzellast.
  const gzgEval = combos => {
    const arr = Array.isArray(combos) ? combos : (combos ? [{load:combos}] : []);
    if(!arr.length) return null;
    let tQ=0,tL=0,uQ=0,uL=0,w=0, any=false, govSol=null, govT=-1, govLd=null, govLbl=null;
    // Zusätzlich mitschreiben, WELCHE Kombination den jeweiligen Maximalwert liefert (Anzeige)
    let lblTQ=null, lblTL=null, lblUQ=null, lblUL=null;
    // Standard (Optionen): Verformung ohne Schrägstellungs-Kopplung (entkoppelt). Kräfte (s.F) bleiben
    // gekoppelt. Default entkoppelt → nur explizites false schaltet auf das gekoppelte Modell.
    const dec = (typeof SETTINGS==='undefined') || SETTINGS.pfahlGzgDecouple!==false;
    arr.forEach(c => {
      const s = solvePfahlbock(piles, c.load || {}); if(!s) return;
      const sD = dec ? (solvePfahlbock(piles, c.load || {}, true) || s) : s;   // Verformung (ggf. entkoppelt)
      any=true;
      const _lb = c.label || c.lf || '';
      if(Math.abs(sD.q[4])      > tQ){ tQ=Math.abs(sD.q[4]);      lblTQ=_lb; }
      if(Math.abs(sD.q[3])      > tL){ tL=Math.abs(sD.q[3]);      lblTL=_lb; }
      if(Math.abs(sD.q[0])*1000 > uQ){ uQ=Math.abs(sD.q[0])*1000; lblUQ=_lb; }
      if(Math.abs(sD.q[1])*1000 > uL){ uL=Math.abs(sD.q[1])*1000; lblUL=_lb; }
      w=Math.max(w,Math.abs(sD.q[2])*1000);
      // massgebende GZG-Lösung (max. Quer-Schiefstellung) für die Systemverformungs-Figur:
      // entkoppelte Verformung (sD.q, konsistent zu den gemeldeten Werten), Kräfte gekoppelt (s.F)
      if(Math.abs(sD.q[4]) >= govT){ govT=Math.abs(sD.q[4]); govSol={q:sD.q, F:s.F, FLat:s.FLat}; govLd=c.load||{}; govLbl=_lb; } });
    // Quer-Horizontalverschiebung (q[0]) der massgebenden Kombo in Anteil aus HORIZONTALLAST und aus
    // MOMENT zerlegen (lineare Superposition, gleicher gekoppelt/entkoppelt-Zustand). Im gekoppelten
    // Modell wirken die Anteile gegensinnig (Kompensation) → resultierend uH+uM; entkoppelt uM≈0.
    if(govSol && govLd){
      const sH = solvePfahlbock(piles, {Hx:govLd.Hx||0, Hy:govLd.Hy||0}, dec);
      const sM = solvePfahlbock(piles, {Mx:govLd.Mx||0, My:govLd.My||0}, dec);
      govSol.uH = sH ? sH.q[0]*1000 : 0;   // [mm] Anteil aus Horizontallast
      govSol.uM = sM ? sM.q[0]*1000 : 0;   // [mm] Anteil aus Moment
    }
    return any ? { tiltQuer:tQ, tiltLaengs:tL, uQuer:uQ, uLaengs:uL, w_mm:w, sol:govSol,
                   gov:govLbl, govTiltQuer:lblTQ, govTiltLaengs:lblTL, govUQuer:lblUQ, govULaengs:lblUL,
                   nCombos:arr.length } : null;
  };
  const gFull = gzgEval(cfg.gzgFull || cfg.loadGZG_full), gVar = gzgEval(cfg.gzgVar || cfg.loadGZG_var);
  const aZul = cfg.alphaZul ?? 0.01, aZulV = cfg.alphaZulVar ?? 0.005;
  const uLim = cfg.uLim ?? 20, uLimV = cfg.uLimVar ?? 10;
  const dispCheck = (cfg.dispCheck != null) ? cfg.dispCheck : (n <= 2);
  const etas = [];
  if(gFull){ etas.push(aZul/Math.max(1e-9, Math.max(gFull.tiltQuer, gFull.tiltLaengs)));
             if(dispCheck) etas.push(uLim/Math.max(1e-6, Math.max(gFull.uQuer, gFull.uLaengs))); }
  if(gVar){  etas.push(aZulV/Math.max(1e-9, gVar.tiltQuer));
             if(dispCheck) etas.push(uLimV/Math.max(1e-6, gVar.uQuer)); }
  const etaGZG = etas.length ? Math.min(...etas) : Infinity;
  return { kAx, kLat, EI, di:+di.toFixed(4), Rskin_k:+Rskin_k.toFixed(1), Rskin_d:+Rskin_d.toFixed(1),
           Rskin_kZ:+Rskin_kZ.toFixed(1), Rskin_dZ:+Rskin_dZ.toFixed(1),
           skinFac:+skinFac.toFixed(2), zugFac:+zugFac.toFixed(2), alphaC:+alphaC.toFixed(2),
           qsAvg:+_sk.qsAvg.toFixed(1), qsMin:+_sk.qsMin.toFixed(1), qsMax:+_sk.qsMax.toFixed(1),
           qsTab: SCHICHTEN.some(s=>s.qs!=null && +s.qs>0),
           // Wirksame Verpresslänge (konstruktiver Deckel, Optionen)
           skinLeff:+_sk.Leff.toFixed(2), skinLcrit:_sk.Lcrit, skinCapped:_sk.capped,
           // Widerstand je Schicht über die Tiefe (char η_g-reduziert · Bemessung Druck/Zug) — Diagramm + Drill-down
           skinLayers: _sk.layers.map(l=>({ name:l.name, preset:l.preset, z0:+l.z0.toFixed(2), z1:+l.z1.toFixed(2),
             dz:+l.dz.toFixed(2), qs:Math.round(l.qs),
             dRk:+(l.dRk*grp.eta).toFixed(1), dRd:+(l.dRk*grp.eta/gR).toFixed(1), dRdZ:+(l.dRk*grp.eta*zugFac/gR).toFixed(1) })),
           grpEta:grp.eta, grpSMean:grp.sMean, grpSd:grp.sd, grpSCap:grp.sCap, grpSToe:grp.sToe,
           latGrpFac:+latGrpFac.toFixed(3), latGrpOn,
           Rt_d:+Rt_d.toFixed(1), M_Rd:+M_Rd.toFixed(1), Mmax:+Mmax.toFixed(1),
           da:+da.toFixed(4), Wpl:Wpl, fyk:(tdn.fy||500), gammaS:+gS.toFixed(2),
           N_cr:+N_cr.toFixed(0), etaKnick:+etaKnick.toFixed(2), Ncomp:+Ncomp.toFixed(1),
           N_pl_k:+N_pl_k.toFixed(0), lamBar:+lamBar.toFixed(2), chi:+chi.toFixed(3), N_bRd:+N_bRd.toFixed(0),
           knickValid, L_hw:+L_hw.toFixed(2),
           etaLat:+etaLat.toFixed(2), Vcap_k:+Vcap_k.toFixed(1), Vcap_d:+Vcap_d.toFixed(1),
           Mcap_k:+Mcap_k.toFixed(1), Mcap_d:+Mcap_d.toFixed(1), latVd:+latVd.toFixed(1), latMd:+latMd.toFixed(1),
           Es:Es, kbed:+(ksMin*dG).toFixed(4), kAxSteel:kAxSteel, headFixReq,
           pileDecomp, govCombo, govLoad, govLoadChar, ulsCombosN:ulsCombos.length,
           settle_mm: gFull ? +gFull.w_mm.toFixed(1) : 0,
           uls, pileRes, govPile, etaGeo:+etaGeo.toFixed(2), etaSteel:+etaSteel.toFixed(2),
           gzgFull:gFull, gzgVar:gVar, etaGZG:+etaGZG.toFixed(2),
           e:+e.toFixed(3), L:+L.toFixed(3), dG:+dG.toFixed(4), Mmax1:+Mmax1.toFixed(4),
           govLatPile:govLat, FLatMax:+FLatMax.toFixed(2), pyProfile: py1?py1.profile:null,
           bettungFac:+bettungFac.toFixed(3), Lbend:+Lbend.toFixed(2),
           // Nur AKTIVE Nachweise bestimmen die massgebende Sicherheit (Optionen je Tragsystem).
           eta_massg:+Math.min(
             nwOn('pfahl','geo')   ? etaGeo   : Infinity,
             nwOn('pfahl','stahl') ? etaSteel : Infinity,
             nwOn('pfahl','knick') ? etaKnick : Infinity,
             nwOn('pfahl','gzg')   ? etaGZG   : Infinity,
             nwOn('pfahl','lat')   ? etaLat   : Infinity).toFixed(2) };
}

// Sichtbarkeit f_eff-Eingabe nach Lastverteilungs-Modus
function _updateLvModeUI(){
  const wrap = document.getElementById('pfahl-laf-wrap');
  if(wrap) wrap.style.display = (gi('pfahl_lv_mode') || 'auto') === 'manuell' ? '' : 'none';
}

// Karten-Summaries Sicherungs-Tab (Werte auf einen Blick ohne Aufklappen)
function _updateSichSummaries(){
  const s = (id,t) => { const el=document.getElementById(id); if(el) el.textContent=t; };
  s('sich-sum-pfahl', `${gi('pfahl_anzahl')||2}× ${gi('pfahl_typ')||'HEB200'} · L = ${(+gi('pfahl_l')||0).toFixed(1)} m`);
  const zf = (gi('pfahl_zugfest')||'ja') !== 'nein';
  const al = gi('pfahl_alpha');
  s('sich-sum-stuetze', `d = ${(+gi('pfahl_abstand')||0).toFixed(2)} m${al?' · α = '+(+al).toFixed(0)+'°':''} · ${zf?'zugfest':'nur Druck'}`);
  const dx = +gi('pfahl_dex')||0;
  s('sich-sum-aushub', dx>0.01
    ? `d_ex = ${dx.toFixed(1)} m · ${(gi('pfahl_dex_seite')||'gleis')==='gleis'?'Gleisseite':'Feldseite'}`
    : 'kein Aushub');
  s('sich-sum-param', `${(gi('pfahl_lv_mode')||'auto')==='auto'?'Lastverteilung auto':'f_eff = '+(+(document.getElementById('pfahl_laf')?.value||1)).toFixed(2)} · ${gi('pfahl_dm')||5}/${gi('pfahl_dk')||15} mm/m`);
}

// ── Zuklappbare Warnbox für die Nachweis-Sidebar (Sicherung UND Pfahlfundament) ──────────
// Einzeilige Zusammenfassung immer sichtbar, Begründung erst auf Klick (Nutzerwunsch: die Sidebar
// wurde durch lange Warntexte unübersichtlich). kind: 'warn' (Default) | 'fail'.
// ── Zuklappbare Nachweis-Karte (Kopf mit η-Pille und Ausnutzungsbalken) — gemeinsam für
//    Pfahlfundament und Sicherung. gov=true markiert die massgebende Karte (Akzentrahmen).
//    Abschluss jeder Karte mit NW_CARD_END.
// Ausnutzungsbalken unter dem Kartenkopf (Füllung 1/η, Marker bei η = 1) — alle Panels
function nwUtilBar(etaVal, cl){
  if(!(isFinite(etaVal) && etaVal>0)) return '';
  const bc={ok:'var(--ok)',warn:'var(--warn)',fail:'var(--fail)',dim:'var(--dim)'}[cl];
  return `<div class="nwbar" title="Ausnutzung 1/η = ${Math.round(100/etaVal)}% (Marker = Grenze η=1)"><i style="width:${Math.min(100,(1/etaVal)*66).toFixed(1)}%;background:${bc}"></i><u></u></div>`;
}
function nwCardHd(title, etaVal, rightTxt=null, gov=false){
  // Erfüllt-Entscheid wie überall auf dem ANGEZEIGTEN 2-Dezimal-Wert (_etaOk) — sonst stünde
  // bei η = 0.997 «η = 1.00» in Rot.
  const cl = rightTxt!=null ? 'dim' : !isFinite(etaVal) ? 'dim' : _etaOk(etaVal)?'ok':'fail';
  const tx = rightTxt!=null ? rightTxt : (isFinite(etaVal) ? 'η = '+etaVal.toFixed(2) : 'n.m.');
  const bar = rightTxt==null ? nwUtilBar(etaVal, cl) : '';
  return `<div class="nw"${gov?' style="border-color:var(--acc)"':''}><div class="nw-hd" onclick="this.parentElement.querySelector('.nw-bd').classList.toggle('open')">
      <span class="nw-ttl">${title}${gov?' <span style="color:var(--acc);font-size:8px;letter-spacing:.05em">MASSGEBEND</span>':''}</span><span class="nw-eta ${cl}">${tx}</span>
    </div>${bar}<div class="nw-bd">`;
}
const NW_CARD_END = '</div></div>';

function wBox(kind, title, body){
  const cls = kind==='fail' ? ' f' : kind==='info' ? ' i' : '';
  return `<details class="nw-warn${cls}">
      <summary><svg class="nww-chev" width="9" height="9" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg><span>${title}</span></summary>
      <div>${body}</div>
    </details>`;
}

// ── q_s,k-Plausibilität (Mikropfahl-Mantelreibung) ───────────────────────────────────────
// Bei gesetztem Bodenprofil liefert microQsExp() den TABELLENWERT des Presets (EA-Pfähle/
// DIN 4128) — das eingegebene φ' geht NICHT ein. Liegt φ' deutlich UNTER dem Preset-φ (also
// lockerere Lagerung als der Tabellenwert unterstellt), ist q_s,k unkonservativ.
// Verifiziert: Preset „Sand" (q_s 150 kPa) mit φ'=24° ⇒ φ-Heuristik 100 kPa ⇒ +50 % zu hoch;
// Preset „Kies" mit φ'=30° ⇒ +100 %. Nur die UNKONSERVATIVE Richtung wird gemeldet.
function _qsPlausibility(L){
  const out = [];
  if(typeof SCHICHTEN === 'undefined' || typeof QS_EXP === 'undefined') return out;
  const bgp = (typeof bgpMerged === 'function') ? bgpMerged()
            : (typeof BGP !== 'undefined' ? BGP : {});
  let z = 0;
  for(let k = 0; k < SCHICHTEN.length && z < L - 1e-6; k++){
    const s = SCHICHTEN[k], isLast = (k === SCHICHTEN.length - 1);
    const bot = (s.d === 999 || isLast) ? L : Math.min(L, z + (+s.d || 0));
    const manuell = (s.qs != null && +s.qs > 0);        // Tabelle/Probebelastung → kein Hinweis
    if(bot > z + 1e-6 && !manuell && s.preset && QS_EXP[s.preset] != null){
      const phiP = bgp[s.preset] ? +bgp[s.preset].phi : null;
      const phiI = +(s.phi ?? phiP);
      if(phiP != null && isFinite(phiP) && isFinite(phiI) && phiI < phiP - 3.5){
        const qsT = QS_EXP[s.preset];
        const qsH = microQsExp({phi: phiI, c: +(s.c || 0)});   // ohne preset ⇒ φ-Heuristik
        if(qsH > 0 && qsT > qsH * 1.15)
          out.push({ name: s.name || s.preset, phiP, phiI, qsT, qsH: Math.round(qsH),
                     over: Math.round(100 * (qsT / qsH - 1)) });
      }
    }
    z = bot;
  }
  return out;
}

// ══ Reduzierter Lastbeiwert für Bauzustände (SIA 267 Ziff. 5.4.3.6) ════════════════
