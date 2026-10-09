// BlockCalc — js/erddruck.js
// Grundwasser, Vertikalspannung, Erddruck-Integrale
// MEHRSCHICHT-HILFSFUNKTIONEN (SIA 267 / DIN 4085)
// ════════════════════════════════════════════

// Grundwassertiefe [m u. GOK] — Infinity wenn kein GW vorhanden
// GW-Tiefe [m u. GOK], Infinity = kein Grundwasser.
// BUGFIX (Aug 2026): früher `+gi('bg_gwt')||3.0` — der ||-Operator wertet die Eingabe **0** als
// falsy und ersetzte sie durch 3.0 m. Damit wurde ausgerechnet der UNGÜNSTIGSTE Fall (GW an GOK)
// stillschweigend verworfen und verhielt sich wie „kein GW" (verifiziert: t=2.0 m, GW 0 ⇒ Auftrieb
// und γ' blieben unberücksichtigt, Ergebnis identisch zu bg_gw='nein'). Jetzt zählt 0 als 0.
function gwDepth(){
  if(cgi('bg_gw') !== 'ja') return Infinity;
  const raw = cgi('bg_gwt');
  if(raw == null || String(raw).trim() === '') return 3.0;   // nur ein LEERES Feld fällt zurück
  const v = +raw;
  return isFinite(v) ? Math.max(0, v) : 3.0;                 // „0" ist ein gültiger Wert (GW an GOK)
}

// Effektive Wichte einer Schicht unterhalb GW (γ' Eingabe, sonst γ−10)
function gamEff(s){ return s.gamma2 > 0 ? s.gamma2 : Math.max(1, s.gamma - 10); }

// Schichtweises Integral des Erddrucks von GOK bis h [kN]
// mode: 'a'  = aktiv     — Steckner Gl.27: λa mit δ₁=+2/3·φ (Gl.8), Horizontalkomponente
//       'p'  = passiv    — coulombWF: Steckner Gl.28: λp mit δp=dpFac·φ (über NL)
//                          sonst: Rankine Kp (Gleiten/Seitenwiderstand, Bemessungsbasis)
//       'pp' = passiv    — Steckner Gl.29: λ'p mit δ=dpFac·φ (unter NL, Rückseite)
//       '0'  = Ruhedruck — Jaky λ0 = 1−sinφ (Gl.30)
// charPhi: K aus φ_k (nicht φ_d) — für GZT charakteristische Kräfte
// dpFac:   Wandreibungsfaktor δp/φ der passiven Beiwerte (Default 0.5 = ST-Fundament-konform;
//          wird bei Nu<0 stufenweise herabgesetzt — Steckner Gl.49/50, §5.4)
// Grundwasser: unterhalb gwDepth() wirkt γ' — effektive Spannungen (ST-verifiziert Test02)
// zSurf:   abgesenkte Geländeoberfläche [m ab GOK] (einseitiger Aushub, Zustand A).
//          Oberhalb zSurf: kein Druck UND keine σ'v-Vorlast. Schicht-/GW-Tiefen bleiben absolut.
function intEarthPress(h, bid, mode, gph, gc_, charPhi, coulombWF, dpFac, zSurf) {
  zSurf = zSurf > 0 ? zSurf : 0;
  if(h <= 0 || h <= zSurf) return {E:0, cz:0};
  if(dpFac === undefined || dpFac === null || dpFac === true) dpFac = 0.5;
  const z_gw = gwDepth();
  let E=0, Earm=0, z=0, sv=0;
  for(const s of cSchichten()) {
    const z_top = z;
    const dz_layer = s.d === 999 ? Math.max(0, h - z_top) : s.d;
    const z_bot = Math.min(z_top + dz_layer, h);
    if(z_top >= h || dz_layer <= 0) break;
    const phi_k_i = s.phi * Math.PI / 180;
    const phi_i   = charPhi ? phi_k_i : Math.atan(Math.tan(phi_k_i) / gph);
    const c_d_i   = s.c / gc_;
    let K_i;
    if(mode === 'p'){
      if(coulombWF) {
        // Gl.28: λp = [cosφ / (1 − √(sin(φ+δp)·sinφ / cosδp))]²  (Horizontalkomponente)
        const dp = dpFac * phi_i, cd = Math.cos(dp);
        const sq = Math.sin(phi_i + dp) * Math.sin(phi_i) / cd;
        const den = 1 - Math.sqrt(Math.max(0, Math.min(0.9999, sq)));
        K_i = (Math.cos(phi_i) / Math.max(0.05, den)) ** 2;
      } else {
        K_i = Math.tan(Math.PI/4 + phi_i/2)**2;
      }
    } else if(mode === 'pp'){
      // Gl.29: λ'p = [cosφ / (1 − √(sin(φ−δ)·sinφ / cosδ))]²  (unter NL, Rückseite)
      const dp = dpFac * phi_i, cd = Math.cos(dp);
      const sq = Math.sin(phi_i - dp) * Math.sin(phi_i) / cd;
      const den = 1 - Math.sqrt(Math.max(0, Math.min(0.9999, sq)));
      K_i = (Math.cos(phi_i) / Math.max(0.05, den)) ** 2;
    } else if(mode === 'a'){
      // Gl.27: λa = [cosφ / (1 + √(sin(φ+δ₁)·sinφ / cosδ₁))]²,  δ₁ = 2/3·φ (Gl.8)
      const da = (2/3) * phi_i;
      const inner_a = Math.sin(phi_i + da) * Math.sin(phi_i) / Math.cos(da);
      const denom_a = 1 + Math.sqrt(Math.max(0, inner_a));
      K_i = denom_a > 0.001 ? (Math.cos(phi_i) / denom_a) ** 2 : 0.001;
    } else { // '0' Ruhedruck
      K_i = 1 - Math.sin(phi_i);
    }
    const c_c = (mode==='p'||mode==='pp') ? 2*c_d_i*Math.sqrt(K_i)
              : (mode==='a' ? -2*c_d_i*Math.sqrt(K_i) : 0);
    // Segment ggf. am GW-Spiegel teilen — unterhalb γ' (effektive Spannungen)
    const segs = [];
    if(z_gw > z_top && z_gw < z_bot){
      segs.push([z_top, z_gw, s.gamma], [z_gw, z_bot, gamEff(s)]);
    } else {
      segs.push([z_top, z_bot, z_top >= z_gw ? gamEff(s) : s.gamma]);
    }
    for(const seg of segs){
      let s0 = seg[0], s1 = seg[1];
      if(zSurf > 0){
        if(s1 <= zSurf) continue;     // Segment vollständig im Aushub — kein Druck, keine Vorlast
        if(s0 < zSurf) s0 = zSurf;    // Teilsegment unterhalb Aushubsohle
      }
      const dz = s1 - s0;
      if(dz <= 0) continue;
      // Integral: K*(σ'_v_top·dz + γ·dz²/2) + c_c·dz — exaktes Trapez-Integral
      const E_i = (K_i*(sv*dz + seg[2]*dz*dz/2) + c_c*dz) * bid;
      E += E_i;
      Earm += E_i * (s0 + s1) / 2;
      sv += seg[2] * dz;
    }
    z = z_bot;
    if(z >= h) break;
  }
  const Epos = Math.max(0, E);
  return { E: Epos, cz: Epos > 0.001 ? Earm / E : h * 0.667 };
}

// Effektive Vertikalspannung σ'v in Tiefe zq [kN/m²] (GW-wirksam) — für pu (Gl.5)
function sigVeffTo(zq){
  if(zq <= 0) return 0;
  const z_gw = gwDepth();
  let sv=0, z=0;
  for(const s of cSchichten()){
    const dz_layer = s.d === 999 ? Math.max(0, zq - z) : s.d;
    const z_bot = Math.min(z + dz_layer, zq);
    if(z >= zq || dz_layer <= 0) break;
    if(z_gw > z && z_gw < z_bot){ sv += s.gamma*(z_gw - z) + gamEff(s)*(z_bot - z_gw); }
    else sv += (z >= z_gw ? gamEff(s) : s.gamma) * (z_bot - z);
    z = z_bot;
    if(z >= zq) break;
  }
  return sv;
}

// Mittlere vertikale Spannung von GOK bis t (für Mantelreibung)
function avgSigV(t) {
  if(t <= 0) return 0;
  let integral=0, z=0, sv=0;
  for(const s of cSchichten()) {
    const dz_layer = s.d===999 ? Math.max(0, t-z) : s.d;
    const z_bot = Math.min(z + dz_layer, t);
    if(z >= t || dz_layer <= 0) break;
    const dz = z_bot - z;
    integral += sv*dz + s.gamma*dz*dz/2;
    sv += s.gamma*dz;
    z = z_bot;
    if(z >= t) break;
  }
  return integral / t;
}

// Harmonischer Mittelwert C₁ über alle Schichten bis t [MN/m³]
function c1Effective_layers(t, B) {
  let t_sum=0, harm=0, z=0;
  for(const s of cSchichten()) {
    const thick = Math.min(s.d===999 ? Math.max(0,t-z) : s.d, Math.max(0,t-z));
    if(thick <= 0) break;
    const phi_k_i = s.phi*Math.PI/180;
    const Kp_i    = Math.tan(Math.PI/4+phi_k_i/2)**2;
    const me_i    = Math.max(0.5, cSchichten().length>1 ? (s.me ?? +cgi('bg_me')) : (+cgi('bg_me')||20));
    const c1_i    = me_i * Kp_i / Math.max(0.1, B);   // MN/m³
    harm  += thick / Math.max(0.001, c1_i);
    t_sum += thick;
    z     += s.d===999 ? thick : s.d;
    if(z >= t) break;
  }
  return harm > 0 ? t_sum / harm : Math.max(0.1, +cgi('bg_c1'));
}

// Massgebende Bodenkennwerte für Grundbruch (Hansen):
// φ'_min und zugehöriges c' in der Bruchkörperzone [t … t+1.6·B]
function govSoilHansen(t_sohle, B) {
  const z_from = t_sohle;
  const z_to   = t_sohle + 1.6*B;
  let phi_min=Infinity, c_gov=0, z=0;
  for(const s of cSchichten()) {
    const z_top = z;
    const z_bot = s.d===999 ? z_to+1 : z_top + s.d;
    if(z_top < z_to && z_bot > z_from) {   // Überlappung mit Bruchkörperzone
      if(s.phi < phi_min){ phi_min=s.phi; c_gov=s.c; }
    }
    z = z_bot;
    if(z > z_to) break;
  }
  if(phi_min === Infinity){ const s=schichtAtDepth(t_sohle); phi_min=s.phi; c_gov=s.c; }
  return { phi:phi_min, c:c_gov };
}

// ════════════════════════════════════════════
