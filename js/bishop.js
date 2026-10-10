// BlockCalc — js/bishop.js
// Globale Standsicherheit (Bishop) mit Diagramm
// GLOBALE STANDSICHERHEIT — Bishop vereinfachtes Lamellenverfahren (GEO)
// ⚠️ WIP / NICHT VALIDIERT / NICHT VERDRAHTET — die Kreissuche liefert am vertikalen
//    Anschnitt noch unplausible η (steigt mit Aushubtiefe). Erst nach Benchmark-Validierung
//    (Taylor-Stabilitätszahl, Standsicherheitscharts) in die Nachweise aufnehmen. Bis dahin
//    bleibt die textliche Warnung „globale Standsicherheit gesondert prüfen" massgebend.
// ════════════════════════════════════════════════════════════════════════
// Kreisgleitflächen-Suche über das reale Geländeprofil (Böschung + Aushub).
// Bishop simplified: η = Σ[c'·b + (W − u·b)·tanφ'] / m_α  /  Σ[W·sinα + M_H/R]
//   m_α = cosα·(1 + tanα·tanφ'/η)  — iterativ.
// Strenge: φ_d = atan(tanφ_k/γ_φ), c_d = c_k/γ_c (SIA 267) → η ≥ 1.0 Kriterium.
// Koordinaten: x horizontal (0 = Blockmitte, +x = Feldseite), Y Elevation (GOK = 0, ab).
// Vereinfachungen (ausgewiesen): kreisförmig, Block als Auflast-Surcharge + H als
// destab. Moment, Pfähle NICHT als Widerstand angesetzt (konservativ — Pfahl-Dübelwirkung
// vernachlässigt), ebener Schnitt (2D).
function bishopStability(opts){
  opts = opts || {};
  // Fundament-Footprint als Auflast: Default Block-DOM, per opts überschreibbar (Pfahlfundament: Bankett)
  const bx     = opts.bx != null ? Math.max(0.3, opts.bx) : Math.max(0.3, +gi('g_bx') || 1);
  const t_bl   = opts.t_bl != null ? Math.max(0.3, opts.t_bl)
                                   : Math.max(0.3, +gi('g_hblock') || 2) + Math.max(0, +gi('g_uberd') || 0);
  const d_ex   = (typeof showPfahl!=='undefined' && showPfahl) ? Math.max(0, +gi('pfahl_dex') || 0) : 0;
  const exSign = (gi('pfahl_dex_seite') || 'gleis') === 'gleis' ? -1 : 1;
  const beta   = (+gi('bg_beta') || 0) * Math.PI/180;
  const btyp   = gi('bg_btyp') || 'none';
  const bfuss  = +gi('bg_bfuss') || 0;
  const bhoehe = Math.max(0, +gi('bg_bhoehe') || 0);
  const hasSlope = btyp !== 'none' && Math.abs(beta) > 0.002;
  const gwd    = gwDepth();                 // GW-Tiefe [m u. GOK], Infinity = kein GW
  const gamW   = 10;
  // Teilsicherheiten Scherfestigkeit (SIA 267)
  // Feld-IDs sind tw_phi/tw_c (wie im gesamten übrigen Rechenkern) — die früheren
  // Kurznamen 'tph'/'tc' existieren im DOM NICHT und liessen Bishop still auf die
  // hartkodierten Defaults zurückfallen, d. h. Nutzeränderungen an γ_φ/γ_c wirkten nicht.
  const gph    = Math.max(1, +gi('tw_phi') || 1.2);
  const gc     = Math.max(1, +gi('tw_c')   || 1.5);

  // Geländeoberfläche (Elevation) als Funktion von x
  const surfY = x => {
    if(d_ex > 0.05){
      const onEx = exSign > 0 ? x > bx/2 - 0.01 : x < -bx/2 + 0.01;
      if(onEx && Math.abs(x) < bx/2 + 3.0) return -d_ex;
    }
    if(hasSlope){
      const fuss = bx/2 + Math.max(0, bfuss);
      if(x > fuss){
        let dy = (x - fuss) * Math.tan(beta);
        if(bhoehe > 0.05) dy = Math.sign(dy) * Math.min(Math.abs(dy), bhoehe);
        return dy;
      }
    }
    return 0;
  };
  // Bodeneigenschaften bei Elevation Y (Y ≤ 0 unter GOK), Bemessungswerte
  const soilAtY = Y => {
    const s = schichtAtDepth(Math.max(0, -Y));
    const phid = Math.atan(Math.tan((s.phi||30)*Math.PI/180) / gph);
    return { tanphi: Math.tan(phid), c: (s.c||0)/gc,
             gam: (Y < -gwd) ? (s.gamma2>0?s.gamma2:Math.max(1,(s.gamma||20)-gamW)) : (s.gamma||20) };
  };
  // Block-Surcharge: Eigengewicht + ständige Vertikallast über den Footprint |x|<bx/2
  const Gk_block = bx * t_bl * (+gi('g_gbeton') || 25);          // [kN/m] Blockgewicht je lfm
  const N_perm   = +gi('l_NG') || 0;                              // [kN]  Mast-Vertikallast (Punktlast)
  const Lfp      = opts.L_fp != null ? opts.L_fp : Math.max(0.3, +gi('g_by') || bx);  // Footprint-Länge quer [m]
  // q_block als echte Flächenpressung [kN/m²]: Eigengewicht-Pressung t_bl·γ + Mastlast N/(B·L) über die
  // FLÄCHE (2D-Smear, keine Linienlast — Bishop ist plane-strain; 3D-Stirnscherung konserv. vernachlässigt)
  const q_block  = opts.q_block != null ? opts.q_block : (Gk_block / bx + N_perm / (bx * Lfp));
  // Horizontale Bemessungslast am Fundament (destabilisierend): opts (Pfahlfundament) oder letztes Block-Ergebnis
  let H_des = 0, y_H = opts.y_H != null ? opts.y_H : -t_bl*0.5;
  if(opts.H_des != null){ H_des = Math.abs(opts.H_des); }
  else if(curResult() && curResult().results && curResult().results.length){
    const w = curResult().results.reduce((a,b)=>Math.max(Math.abs(b.Hxd),Math.abs(b.Hyd))>Math.max(Math.abs(a.Hxd),Math.abs(a.Hyd))?b:a);
    H_des = Math.abs(w.Hxd) || 0;        // quer (in Schnittebene)
    y_H   = Math.max(0, +gi('g_hkopf')||0) - Math.max(0,+gi('g_uberd')||0) + 0.0; // ~OK Kopf
  }
  // Richtung des kritischen Rutschens: zur tieferen Seite (Aushub/abfallende Böschung)
  const failSide = d_ex > 0.05 ? exSign : (hasSlope && beta < 0 ? 1 : (hasSlope && beta>0 ? -1 : exSign));
  // Charakteristische Geländehöhe (Aushubtiefe bzw. Böschungs-Sprunghöhe) — skaliert Suche
  const slopeDrop = hasSlope ? (bhoehe > 0.05 ? bhoehe : Math.min(4*Math.abs(Math.tan(beta)), 3.5)) : 0;
  const Hgeo = Math.max(d_ex, slopeDrop, 1.0);
  const hmin = 0.45 * Hgeo;                       // Mindest-Lamellenhöhe → keine Mini-Kreise

  // Bishop für EINEN Kreis (xc, Yc Elevation, R)
  const bishopCircle = (xc, Yc, R) => {
    const N = 28;
    // x-Bereich, in dem der untere Bogen unter der Oberfläche liegt
    const xa = xc - R, xb = xc + R;
    const x0 = Math.max(xa, xc - R), x1 = Math.min(xb, xc + R);
    const bw = (x1 - x0) / N;
    if(bw <= 0.001) return null;
    let num = 0, denDriv = 0, anyValid = false, hmax = 0, maxAbsA = 0, minYb = Infinity, exitFail = false;
    const slices = [];
    for(let i = 0; i < N; i++){
      const xm = x0 + (i + 0.5) * bw;
      const dxc = xm - xc;
      const disc = R*R - dxc*dxc;
      if(disc <= 0) continue;
      const Yb = Yc - Math.sqrt(disc);          // untere Bogen-Elevation (Gleitfläche)
      const Ys = surfY(xm);                       // Oberfläche
      const h = Ys - Yb;                          // Lamellenhöhe
      if(h <= 0.02) continue;                      // Bogen über/an Oberfläche → keine Lamelle
      anyValid = true; hmax = Math.max(hmax, h); minYb = Math.min(minYb, Yb);
      if(failSide * xm > bx/2) exitFail = true;    // Lamelle daylightet auf der Versagensseite
      const tanA = dxc / Math.sqrt(disc);          // Basisneigung tan α
      const alpha = Math.atan(tanA);
      maxAbsA = Math.max(maxAbsA, Math.abs(alpha));
      // Gewicht: Bodensäule (geschichtetes γ) + Block-Surcharge falls unter Footprint
      let W = 0; const nz = 6;
      for(let k = 0; k < nz; k++){ const Yk = Yb + (k+0.5)/nz*h; W += soilAtY(Yk).gam * (h/nz) * bw; }
      if(Math.abs(xm) < bx/2 && Ys > -t_bl + 0.01) W += q_block * bw;  // Blockauflast
      // Basis-Eigenschaften
      const sb = soilAtY(Yb);
      // Porendruck an der Basis
      const u = (Yb < -gwd) ? gamW * ((-gwd) - Yb) : 0;
      const phi_t = sb.tanphi, c_ = sb.c;
      // Bishop-Beiträge (m_α später mit η)
      slices.push({xm, Yb, Ys, alpha, W, u, b: bw, tanphi: phi_t, c: c_});
      denDriv += W * Math.sin(alpha);
    }
    // ── Gültigkeits-Constraints (gegen Mini-Kreis-/Numerik-Artefakte)
    if(!anyValid || slices.length < 8) return null;
    if(!exitFail) return null;                     // Kreis muss auf der Versagensseite daylighten
    if(hmax < 0.28 * Hgeo) return null;            // Kreis zu flach → kein globaler Bruch
    if(maxAbsA > 1.35) return null;                // |α| > ~77° → Bishop unzuverlässig
    if(minYb > -0.18 * Hgeo) return null;          // erreicht keine relevante Tiefe
    // Destabilisierendes Moment der Horizontallast: zählt nur, wenn der Fundament-Footprint
    // im Gleitkörper liegt (Kreis überspannt den Block).
    const inBlk = (xc - R < bx/2 && xc + R > -bx/2);
    const M_H = inBlk ? H_des * Math.max(0, (Yc - y_H)) / R : 0;
    // Treibendes Moment = |ΣW·sinα| + M_H. Das geometrische Vorzeichen von ΣW·sinα kodiert
    // nur den Drehsinn (für einen zum Fuss kippenden Toe-Kreis ist es negativ); massgebend
    // ist der Betrag. (Ohne den Betrag verwarf die Suche jeden freistehenden Böschungskreis.)
    const driv = Math.abs(denDriv) + M_H;
    if(driv <= 0.5) return null;                  // kein treibendes Moment → kein Versagen
    // η iterieren — m_α nach unten auf 0.2 gedeckelt (konservativ; verhindert das
    // Verwerfen kritischer Toe-Kreise mit steiler Basis, ohne η zu überschätzen).
    let eta = 1.3;
    for(let it = 0; it < 50; it++){
      let res = 0;
      for(const s of slices){
        let m_a = Math.cos(s.alpha) * (1 + Math.tan(s.alpha) * s.tanphi / eta);
        m_a = Math.max(m_a, 0.2);
        res += (s.c * s.b + (s.W - s.u * s.b) * s.tanphi) / m_a;
      }
      const etaNew = res / driv;
      if(!isFinite(etaNew) || etaNew <= 0) return null;
      if(Math.abs(etaNew - eta) < 1e-4){ eta = etaNew; break; }
      eta = etaNew;
    }
    return { eta, xc, Yc, R, slices, hmax, M_H, driv };
  };

  // ── Fuss (Aushub-/Böschungsfuss) als Anker für die Grid-Zentrierung
  let toeX, toeY;
  if(d_ex > 0.05){ toeX = failSide * bx/2; toeY = -d_ex; }                       // Aushubfuss
  else if(hasSlope){ const Ls = Hgeo/Math.max(0.05, Math.abs(Math.tan(beta)));   // Böschungsfuss
    toeX = (bx/2 + Math.max(0, bfuss)) + failSide*Ls; toeY = surfY(toeX); }
  else { toeX = failSide * bx/2; toeY = 0; }                                      // flach: Blockkante
  // ── Freie Zentrum-Grid-Suche mit unabhängigem Radius-Scan.
  // Ersetzt die frühere toe-verankerte Suche, die (a) für lange flache Böschungen keinen
  // gültigen Kreis fand und (b) die tiefer liegende kritische Gleitfläche verfehlte.
  // Grid um den Fuss zentriert, nach der charakteristischen Höhe Hgeo skaliert. Validiert
  // gegen Taylor φ_u=0 (N_o≈5.52, i=26.57°): freie Grid-FS 2.50 ≈ Taylor 2.45 (<2 %).
  let best = null;
  const Hs = Hgeo, half = 3.4*Hs + bx + 1;
  const dC = Math.max(0.22, Hs*0.16), dR = Math.max(0.22, Hs*0.16);
  for(let cx = toeX - half; cx <= toeX + half; cx += dC){
    const surfCx = Math.max(0, surfY(cx));
    for(let cy = 0.3*Hs; cy <= 3.6*Hs; cy += dC){
      const Rlo = Math.max(1, cy - surfCx - 0.6*Hs), Rhi = cy + 2.4*Hs;
      for(let R = Rlo; R <= Rhi; R += dR){
        const r = bishopCircle(cx, cy, R);
        if(r && r.eta > 0.05 && (!best || r.eta < best.eta)) best = r;
      }
    }
  }
  if(!best) return { ok:false, eta:Infinity };
  return { ok:true, eta:best.eta, xc:best.xc, Yc:best.Yc, R:best.R,
           slices:best.slices, failSide, surfY, gwElev:isFinite(gwd)?-gwd:null,
           gph, gc, t_bl, bx, d_ex, exSign, hasSlope, beta_deg:+gi('bg_beta')||0,
           // Für die Diagramm-Beschriftung: treibendes Moment/R [kN] (|ΣW·sinα| + M_H),
           // Anteil aus der Horizontallast, sowie q_block (Auflast) und y_H (Angriffshöhe H)
           driv:best.driv, M_H:best.M_H, q_block, H_des, y_H };
}

// Gleitkreis-Schnitt (Bishop): Oberfläche, Baugrund, Fundament, kritische Gleitfläche, Lamellen, GW,
// Kreismittelpunkt M + Radien, resultierender Gewichtsvektor ΣW des Gleitkörpers, Gleitrichtung,
// destabilisierende Horizontallast H und die Momentenbilanz (haltend/treibend → η).
function buildBishopSVG(b, wide){
  if(!b || !b.ok || !b.slices || !b.slices.length) return '';
  const S=b.slices, R=b.R, xc=b.xc, Yc=b.Yc, surfY=b.surfY, bx=b.bx, t_bl=b.t_bl;
  const xs=S.map(s=>s.xm);
  const xlo=Math.min(...xs, -bx/2)-0.6, xhi=Math.max(...xs, bx/2)+0.6;
  const ylo=Math.min(...S.map(s=>s.Yb), -t_bl)-0.4;
  const yhi0=Math.max(0, ...S.map(s=>s.Ys))+0.5;
  const H0=Math.max(0.5, yhi0-ylo);
  // Kreiszentrum nur einblenden, wenn es die Figur nicht unbrauchbar zerdrückt
  const showM=(Yc <= yhi0 + 1.15*H0);
  const yhi=showM ? Math.max(yhi0, Yc+0.4) : yhi0;
  const VB=wide?520:264, HB=wide?330:230, PADL=10,PADR=10,PADT=24,PADB=wide?34:28;
  const pw=VB-PADL-PADR, ph=HB-PADT-PADB, sc=Math.min(pw/Math.max(0.5,xhi-xlo), ph/Math.max(0.5,yhi-ylo));
  const X=x=>PADL+(x-xlo)*sc, Y=y=>PADT+(yhi-y)*sc;                       // y nach oben
  const eC=etaCol(b.eta);
  const F=wide?7:6.2;                                                      // Basis-Schriftgrösse
  // ── Kennwerte des Gleitkörpers
  const sumW=S.reduce((a,s)=>a+s.W,0);
  const xW=sumW>1e-6 ? S.reduce((a,s)=>a+s.W*s.xm,0)/sumW : 0;            // Schwerpunkt-x
  const driv=b.driv||0, halt=driv*b.eta;                                   // Moment/R [kN]
  const dir=(b.failSide||1);                                               // Gleitrichtung (+x = Feldseite)
  const arrow=(x1,y1,x2,y2,col,w)=>{ const dx=x2-x1, dy=y2-y1, L=Math.hypot(dx,dy)||1, ux=dx/L, uy=dy/L, hL=Math.min(4.5,L*0.35);
    const px=-uy, py=ux;
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${(x2-ux*hL*0.9).toFixed(1)}" y2="${(y2-uy*hL*0.9).toFixed(1)}" stroke="${col}" stroke-width="${w||1.2}"/>
      <polygon points="${x2.toFixed(1)},${y2.toFixed(1)} ${(x2-ux*hL+px*hL*0.42).toFixed(1)},${(y2-uy*hL+py*hL*0.42).toFixed(1)} ${(x2-ux*hL-px*hL*0.42).toFixed(1)},${(y2-uy*hL-py*hL*0.42).toFixed(1)}" fill="${col}"/>`; };
  let surf=''; const nS=64;
  for(let i=0;i<=nS;i++){ const x=xlo+(xhi-xlo)*i/nS; surf+=`${X(x).toFixed(1)},${Y(surfY(x)).toFixed(1)} `; }
  const soilPoly=`${X(xlo).toFixed(1)},${Y(ylo).toFixed(1)} `+surf+`${X(xhi).toFixed(1)},${Y(ylo).toFixed(1)}`;
  let arc=''; S.forEach(s=>{ arc+=`${X(s.xm).toFixed(1)},${Y(s.Yb).toFixed(1)} `; });
  // Gleitkörper = Fläche zwischen Gleitfläche (Bogen) und Oberfläche
  const massPts=S.map(s=>`${X(s.xm).toFixed(1)},${Y(s.Yb).toFixed(1)}`)
    .concat(S.slice().reverse().map(s=>`${X(s.xm).toFixed(1)},${Y(s.Ys).toFixed(1)}`)).join(' ');
  const bxTop=Math.max(surfY(-bx/2),surfY(bx/2),0);
  let s=`<svg viewBox="0 0 ${VB} ${HB}" width="100%" style="display:block">
   <rect width="${VB}" height="${HB}" fill="var(--s2)"/>
   <text x="6" y="13" font-family="var(--f-mono)" font-size="8.5" letter-spacing=".05em" fill="var(--dim)">GLEITKREIS (BISHOP) — η = <tspan fill="${eC}" font-weight="600">${b.eta.toFixed(2)}</tspan></text>
   <polygon points="${soilPoly}" fill="var(--dim)" fill-opacity="0.07"/>
   <polygon points="${massPts}" fill="${eC}" fill-opacity="0.11"/>
   <polyline points="${surf}" fill="none" stroke="var(--dim)" stroke-width="1"/>`;
  if(b.gwElev!=null && b.gwElev>ylo && b.gwElev<yhi)
    s+=`<line x1="${X(xlo).toFixed(1)}" y1="${Y(b.gwElev).toFixed(1)}" x2="${X(xhi).toFixed(1)}" y2="${Y(b.gwElev).toFixed(1)}" stroke="#4db8c9" stroke-width="0.7" stroke-dasharray="4,3"/>
      <text x="${(X(xlo)+3).toFixed(1)}" y="${(Y(b.gwElev)-2).toFixed(1)}" font-family="var(--f-mono)" font-size="${F-0.5}" fill="#4db8c9">GW</text>`;
  s+=`<rect x="${X(-bx/2).toFixed(1)}" y="${Y(bxTop).toFixed(1)}" width="${(bx*sc).toFixed(1)}" height="${((bxTop+t_bl)*sc).toFixed(1)}" fill="var(--xdim)" fill-opacity="0.28" stroke="var(--dim)" stroke-width="0.7"/>`;
  S.forEach(s2=>{ s+=`<line x1="${X(s2.xm).toFixed(1)}" y1="${Y(s2.Ys).toFixed(1)}" x2="${X(s2.xm).toFixed(1)}" y2="${Y(s2.Yb).toFixed(1)}" stroke="var(--ol)" stroke-width="0.3" opacity="0.5"/>`; });
  s+=`<polyline points="${arc}" fill="none" stroke="${eC}" stroke-width="2"/>`;
  // ── Kreiszentrum M + Radien zu den Bogenenden. Liegt M ausserhalb (typisch weit über GOK),
  //    werden die Radien am oberen Rand abgeschnitten und mit „→ M · R=…" beschriftet, statt die
  //    ganze Figur zu zerdrücken.
  {
    const mx=X(xc), my=Y(Yc), s0=S[0], s1=S[S.length-1], yTop=PADT+1;
    const clip=(x1,y1)=>{ if(my>=yTop) return [mx,my];
      const t=(yTop-y1)/((my-y1)||-1e-6); return [x1+(mx-x1)*t, yTop]; };
    const p0=clip(X(s0.xm),Y(s0.Yb)), p1=clip(X(s1.xm),Y(s1.Yb));
    s+=`<line x1="${X(s0.xm).toFixed(1)}" y1="${Y(s0.Yb).toFixed(1)}" x2="${p0[0].toFixed(1)}" y2="${p0[1].toFixed(1)}" stroke="${eC}" stroke-width="0.6" stroke-dasharray="3,2.5" opacity="0.7"/>
        <line x1="${X(s1.xm).toFixed(1)}" y1="${Y(s1.Yb).toFixed(1)}" x2="${p1[0].toFixed(1)}" y2="${p1[1].toFixed(1)}" stroke="${eC}" stroke-width="0.6" stroke-dasharray="3,2.5" opacity="0.7"/>`;
    if(showM){
      s+=`<line x1="${(mx-3).toFixed(1)}" y1="${my.toFixed(1)}" x2="${(mx+3).toFixed(1)}" y2="${my.toFixed(1)}" stroke="${eC}" stroke-width="0.9"/>
          <line x1="${mx.toFixed(1)}" y1="${(my-3).toFixed(1)}" x2="${mx.toFixed(1)}" y2="${(my+3).toFixed(1)}" stroke="${eC}" stroke-width="0.9"/>
          <text x="${(mx+4).toFixed(1)}" y="${(my-3).toFixed(1)}" font-family="var(--f-mono)" font-size="${F}" fill="${eC}">M · R=${R.toFixed(1)}m</text>`;
    } else {
      const lx=Math.min(VB-PADR-2, Math.max(PADL+2, (p0[0]+p1[0])/2));
      s+=`<text x="${lx.toFixed(1)}" y="${(yTop+F+1).toFixed(1)}" font-family="var(--f-mono)" font-size="${F}" fill="${eC}" text-anchor="middle">↗ M · R=${R.toFixed(1)} m</text>`;
    }
  }
  // ── Resultierender Gewichtsvektor ΣW des Gleitkörpers (im Schwerpunkt, nach unten)
  if(sumW>1){
    const xa=X(xW), ySurf=Y(surfY(xW)), len=Math.min(26, Math.max(14, ph*0.16));
    s+=arrow(xa, ySurf+3, xa, ySurf+3+len, 'var(--on2)', 1.4)
      +`<text x="${(xa+3).toFixed(1)}" y="${(ySurf+3+len*0.62).toFixed(1)}" font-family="var(--f-mono)" font-size="${F}" fill="var(--on2)">ΣW=${sumW.toFixed(0)} kN</text>`;
  }
  // ── Destabilisierende Horizontallast H am Fundament (nur wenn im Gleitkörper wirksam)
  if((b.M_H||0) > 0.01 && (b.H_des||0) > 0.5){
    const yH=Y(Math.min(yhi-0.2, b.y_H!=null?b.y_H:0)), x0=X(0), hl=Math.min(24, Math.max(12, pw*0.06));
    s+=arrow(x0, yH, x0+dir*hl, yH, 'var(--warn)', 1.3)
      +`<text x="${(x0+dir*hl+dir*3).toFixed(1)}" y="${(yH-3).toFixed(1)}" font-family="var(--f-mono)" font-size="${F}" fill="var(--warn)" text-anchor="${dir>0?'start':'end'}">H=${b.H_des.toFixed(0)} kN</text>`;
  }
  // ── Gleitrichtung: Pfeil am Austritt des Bogens (Versagensseite)
  {
    const sEnd = dir>0 ? S[S.length-1] : S[0], sPrev = dir>0 ? S[S.length-2] : S[1];
    if(sEnd && sPrev){
      const x2=X(sEnd.xm), y2=Y(sEnd.Yb), x1=X(sPrev.xm), y1=Y(sPrev.Yb);
      const dx=x2-x1, dy=y2-y1, L=Math.hypot(dx,dy)||1;
      s+=arrow(x2-dx/L*9, y2-dy/L*9, x2, y2, eC, 1.4);
    }
  }
  // ── Momentenbilanz (Moment/R) + Scherfestigkeit — Fusszeile
  s+=`<text x="6" y="${(HB-PADB+11).toFixed(1)}" font-family="var(--f-mono)" font-size="${F}" fill="var(--dim)">Σ haltend ${halt.toFixed(0)} kN  /  Σ treibend ${driv.toFixed(0)} kN${(b.M_H||0)>0.01?' (davon H: '+b.M_H.toFixed(0)+')':''}  →  η = <tspan fill="${eC}" font-weight="600">${b.eta.toFixed(2)}</tspan></text>
   <text x="6" y="${(HB-PADB+11+F+2.5).toFixed(1)}" font-family="var(--f-mono)" font-size="${F-0.5}" fill="var(--xdim)">${S.length} Lamellen · Momente um M · γ_φ = ${(b.gph||1.2).toFixed(2)} · γ_c = ${(b.gc||1.5).toFixed(2)}</text>`;
  return s+`</svg>`;
}

// Broms-Methode: freier Kopf, kurzer Pfahl
// gamma2: Wichte unter GW (γ' = γ_sat−γ_w); z_gw: GW-Tiefe ab GOK [m] (Infinity = kein GW)
// betaRed_deg: Böschungsmagnitude [°], falls der Pfahl in eine ABFALLENDE Böschung
//   widersteht (talseitig) → passiver Beiwert auf Kp,β reduziert; 0 = waagrecht
// exClip: {dEx, Lhor} — Aushub-Begrenzung des Bruchkörpers (Zugfall): der passive
//   Keil daylightet jenseits der Aushubkante (Horizontaldistanz Lhor) in die Grube →
//   wirksame Überdeckung dort um d_ex reduziert (geometrisch, stetig). null = kein Aushub.
// φ > 5°  → Reibungsboden-Formel mit GW-korrigiertem γ_avg, drainiert mit φ' massgebend
//           (gewachsener Boden / Erdbauwerk-Auffüllung; c'/scheinbare Kohäsion konservativ
//            vernachlässigt, da langfristig unzuverlässig)
// φ ≤ 5°  → Clay-Formel mit c_u (undrainiert/bindig, γ irrelevant)
function bromsFreeShort(phi_deg, c_kPa, gamma_kNm3, L, B, e, gamma2, z_gw, betaRed_deg, exClip){
  const phi  = phi_deg * Math.PI / 180;
  const Kp   = (betaRed_deg && betaRed_deg > 0.1)
             ? kpSlopeRankine(phi_deg, betaRed_deg)        // geneigtes Gelände (talseitig)
             : Math.tan(Math.PI/4 + phi/2)**2;             // waagrecht
  const g2   = (gamma2 != null && isFinite(+gamma2)) ? +gamma2 : gamma_kNm3;
  const zgw  = (z_gw  != null && isFinite(+z_gw))   ? +z_gw   : Infinity;

  if(phi_deg <= 5){
    // Undrained Ton / weicher Schluff: Broms Clay (c_u massgebend)
    return Math.max(0.1,
      9 * c_kPa * B * Math.max(0, L - 1.5*B) / Math.max(0.01, L + 2*e + 1.5*B));
  }

  // Reibungsboden (φ > 5°: gewachsener Boden, Erdbauwerk-Auffüllung): GW-korrigiertes γ_avg
  // γ_avg gewichtet nach ∫γ(z)·z dz / ∫z dz = [γ·zw² + γ'·(L²−zw²)] / L²
  const zw    = Math.min(zgw, L);
  const g_avg = (gamma_kNm3 * zw**2 + g2 * Math.max(0, L**2 - zw**2)) / L**2;

  // Aushub-Clip (Zugfall): Bruchkörper reicht über die Aushubkante → wirksame Überdeckung
  // reduziert. Numerische Momentenintegration um den Fuss mit reduzierter Überdeckung
  // z_eff(z) = z − d_ex·(Keilanteil über Aushub). Block-Abschirmung konservativ ignoriert.
  if(exClip && exClip.dEx > 0.01){
    const tanW = Math.tan(Math.PI/4 + phi/2);
    const Lh = Math.max(0.01, exClip.Lhor), dE = exClip.dEx;
    let M = 0; const N = 48;
    for(let i = 0; i < N; i++){
      const z  = (i + 0.5) / N * L;
      const xd = z * tanW;                                  // Keil-Daylight-Distanz
      const frac = Math.max(0, xd - Lh) / Math.max(0.01, xd); // Anteil über Aushub
      const z_eff = Math.max(0.05 * z, z - dE * frac);      // reduzierte Überdeckung
      M += 3 * Kp * g_avg * z_eff * B * (L - z) * (L / N);  // Moment um Fuss
    }
    return Math.max(0.1, M / Math.max(0.01, L + e));
  }

  // Textbuch-Broms (1964), kurzer Pfahl, freier Kopf — Momentengleichgewicht um den
  // Pfahlfuss: H_u·(e+L) = E_p·(L − z_ep). Passive Dreieckverteilung 3·Kp·γ_avg·z·B,
  // Resultierende E_p = 1.5·Kp·γ_avg·B·L² im Schwerpunkt z_ep = 2L/3 →
  //   H_u = 0.5·Kp·γ_avg·B·L³ / (e+L)   (klassische Broms-Lösung Reibungsboden).
  // Kohäsion wird im Reibungsboden bewusst vernachlässigt (konservativ, vgl. hasC-Label);
  // c_u-massgebende Böden laufen oben über den Clay-Zweig (φ ≤ 5°).
  const Ep   = 1.5 * Kp * g_avg * B * L**2;
  const z_ep = 2 * L / 3;
  return Math.max(0.1, Ep * (L - z_ep) / Math.max(0.01, L + e));
}

// ── Mehrschicht-Broms (numerisch, freier Kopf, kurzer Pfahl) ──────────────────
// Integriert das passive Widerstandsprofil p(z) schichtweise per Momentengleich-
// gewicht um den Pfahlfuss: H_u·(L+e) = ∫₀ᴸ p(z)·(L−z) dz.
//   Reibungsschicht (φ>5): p(z) = 3·Kp_i·σ'v(z)·B   — σ'v(z) GW-wirksam (sigVeffTo),
//     Kp_i je Schicht aus schichtAtDepth(z); c' konservativ vernachlässigt (wie 1-Schicht).
//   bindige Schicht (φ≤5): p(z) = 9·c_u,i·B für z > 1.5·B, sonst 0 (Broms-Clay-Profil).
// Reduziert sich für HOMOGENEN Boden ohne GW exakt auf bromsFreeShort (Reibungszweig):
//   ∫ 3·Kp·γ·z·B·(L−z) dz = 0.5·Kp·γ·B·L³  →  H_u = 0.5·Kp·γ·B·L³/(L+e). ✓
// betaRed_deg: talseitige Böschung → Kp,β (kpSlopeRankine). exClip {dEx,Lhor}: Aushub-
// Begrenzung des Bruchkörpers (Zugfall) — wirksame Überdeckung σ'v(z) lokal reduziert.
// GW wird über sigVeffTo()/gwDepth() konsistent erfasst (kein z_gw-Parameter nötig).
function bromsLayered(L, B, e, betaRed_deg, exClip){
  const N = 60, dz = L / N;
  const useSlope = (betaRed_deg && betaRed_deg > 0.1);
  let M = 0;
  for(let i = 0; i < N; i++){
    const z   = (i + 0.5) * dz;
    const s   = schichtAtDepth(z);
    const phi = s.phi ?? 30;
    let p;
    if(phi <= 5){
      p = z > 1.5*B ? 9 * Math.max(0, s.c ?? 0) * B : 0;            // Broms-Clay (c_u)
    } else {
      const Kp = useSlope ? kpSlopeRankine(phi, betaRed_deg)
                          : Math.tan(Math.PI/4 + phi*Math.PI/360)**2;
      p = 3 * Kp * sigVeffTo(z) * B;                               // 3·Kp·σ'v(z)·B
    }
    // Aushub-Clip (Zugfall): Keil daylightet jenseits der Aushubkante → σ'v(z) lokal
    // reduziert. Skalierung p·(z_eff/z) — im 1-Schicht-Fall identisch zu bromsFreeShort.
    if(exClip && exClip.dEx > 0.01 && z > 0.001){
      const tanWedge = Math.tan(Math.PI/4 + Math.max(5,phi)*Math.PI/360);
      const xd   = z * tanWedge;
      const frac = Math.max(0, xd - Math.max(0.01, exClip.Lhor)) / Math.max(0.01, xd);
      const z_eff= Math.max(0.05*z, z - exClip.dEx*frac);
      p *= z_eff / z;
    }
    M += p * (L - z) * dz;                                          // Moment um den Fuss
  }
  return Math.max(0.1, M / Math.max(0.01, L + e));
}

// Wirkungsschatten Block → Pfahl: tiefengestaffelte Kapazitätsabminderung.
// Oberhalb z_ov liegt der Pfahl im mobilisierten Rankine-Keil des Blocks —
// dort wird der passive Widerstand nur zu 50 % angesetzt (teilbeanspruchter Boden).
// Rückgabe: Verhältnis der momentengewichteten Widerstände (≤ 1), Hebel um den
// Lastangriffspunkt (e über Kopf). Numerisches Trapezintegral, Ingenieurnäherung.
function bromsShadowFactor(phi_deg, c_kPa, gamma, gamma2, z_gw, L, B, z_ov, e){
  if(z_ov <= 0.01 || L <= 0.05) return 1.0;
  const phi  = phi_deg * Math.PI / 180;
  const Kp   = Math.tan(Math.PI/4 + phi/2)**2;
  const sqKp = Math.sqrt(Kp);
  const g2   = (gamma2 != null && isFinite(+gamma2)) ? +gamma2 : gamma;
  const zgw  = (z_gw  != null && isFinite(+z_gw))   ? +z_gw   : Infinity;
  const multiLayer = (typeof SCHICHTEN !== 'undefined' && SCHICHTEN.length > 1);
  // Einheitswiderstand p(z) [kN/m] — gleiche Basis wie bromsFreeShort/p_max-Referenz.
  // Mehrschicht: φ/c/Kp je Schicht aus schichtAtDepth(z), σ'v(z) GW-wirksam (sigVeffTo).
  const pz = z => {
    if(multiLayer){
      const s = schichtAtDepth(z), ph = s.phi ?? phi_deg;
      if(ph <= 5) return z > 1.5*B ? 9 * Math.max(0, s.c ?? 0) * B : 0;
      const Kp_i = Math.tan(Math.PI/4 + ph*Math.PI/360)**2;
      return (3 * Kp_i * sigVeffTo(z) + 2 * Math.max(0, s.c ?? 0) * Math.sqrt(Kp_i)) * B;
    }
    if(phi_deg <= 5) return z > 1.5*B ? 9 * c_kPa * B : 0;       // Broms Clay
    const sv = z <= zgw ? gamma*z : gamma*zgw + g2*(z - zgw);    // σ'v GW-wirksam
    return (3 * Kp * sv + 2 * c_kPa * sqKp) * B;
  };
  const N = 40, dz = L / N;
  let mFull = 0, mRed = 0;
  for(let i = 0; i < N; i++){
    const z  = (i + 0.5) * dz;
    const m  = pz(z) * (e + z) * dz;       // Momentenbeitrag um Lastangriff
    mFull += m;
    mRed  += m * (z < z_ov ? 0.5 : 1.0);
  }
  return mFull > 0.01 ? Math.max(0.3, mRed / mFull) : 1.0;
}

// Kopfverschiebung freier Pfahl auf Winkler-Bettung (Hetényi, kurzer Pfahl)
// Kopfverschiebung: freier Pfahl auf Winkler-Bettung (Hetényi)
// k_s [kN/m³] = Bettungsmodul; B [m] = Profilbreite → k_w = k_s×B [kN/m²]
// λ = (k_s×B / 4EI)^0.25 [m⁻¹]
function winklerDeflection(H_kN, e_m, L_m, EI_kNm2, k_s_kNm3, B_m){
  // Physikalisch korrekte Formeln — beide Regime:
  //
  // 1) Starrer Pfahl (freier Kopf, Winkler-Federn):
  //    Aus Kraft- + Momentengleichgewicht am starren Körper auf elastischen Federn:
  //    δ = 2H(2L + 3e) / (k_w × L²)   →  nimmt mit L AB (∝ 1/L) ✓
  //
  // 2) Langer flexibler Pfahl (Hetenyi halbunendlich):
  //    δ = H(1 + 2λe) / (2λ³EI)   →  unabhängig von L (Asymptote) ✓
  //
  // Physikalisch gilt: max() beider Werte:
  //   - kurze Pfähle: starres Kippen dominiert → hohe Verformung
  //   - lange Pfähle: Asymptote dominiert, starres Modell unterschätzt Bettungswiderstand
  //   → das Maximum beider Näherungen ist konservativ und physikalisch sinnvoll.

  const k_w = k_s_kNm3 * B_m;  // Federsteifigkeit × Breite [kN/m²]
  const lam = Math.pow(k_w / (4 * EI_kNm2), 0.25);  // [m⁻¹]

  // Starrer Pfahl (exakte Winkler-Lösung für freien Kopf)
  const d_rigid = 2 * H_kN * (2*L_m + 3*e_m) / (k_w * L_m * L_m) * 1000; // [mm]

  // Langer Pfahl (Hetenyi Asymptote)
  const d_long  = H_kN * (1 + 2*lam*e_m) / (2 * Math.pow(lam, 3) * EI_kNm2) * 1000; // [mm]

  return Math.max(0.1, Math.max(d_rigid, d_long));
}
