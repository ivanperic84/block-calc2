// BlockCalc — js/pfahl-bettung.js
// p-y-Bettungsbalken, lineares Gleichungssystem, laterale Grenzlast
// ── Dichtes Gleichungssystem A·x = b (Gauss mit Teilpivotisierung) ─────────────
function solveLinearDense(A, b){
  const n = b.length;
  // Arbeitskopien
  const M = A.map(r => r.slice()), x = b.slice();
  for(let col = 0; col < n; col++){
    // Pivot
    let piv = col, mx = Math.abs(M[col][col]);
    for(let r = col+1; r < n; r++){ const v = Math.abs(M[r][col]); if(v > mx){ mx = v; piv = r; } }
    if(mx < 1e-300) return null;                       // singulär
    if(piv !== col){ const tm = M[piv]; M[piv] = M[col]; M[col] = tm;
                     const tb = x[piv]; x[piv] = x[col]; x[col] = tb; }
    const dgn = M[col][col];
    for(let r = col+1; r < n; r++){
      const f = M[r][col] / dgn;
      if(f === 0) continue;
      for(let k = col; k < n; k++) M[r][k] -= f * M[col][k];
      x[r] -= f * x[col];
    }
  }
  // Rückwärts
  const sol = new Array(n).fill(0);
  for(let r = n-1; r >= 0; r--){
    let s = x[r];
    for(let k = r+1; k < n; k++) s -= M[r][k] * sol[k];
    sol[r] = s / M[r][r];
  }
  return sol;
}

// ── p-y-Pfahl: elastischer Mehrschicht-Bettungsbalken (Hermite-Balken-FE) ──────
// Euler-Bernoulli-Balken auf Winkler-Bettung: EI·y'''' + k_s(z)·B·y = 0.
// Modelliert ab dem Lastangriffspunkt (Pfahlkopf): freie Länge e (k=0), dann
// Einbindelänge L mit schichtweiser Bettung k_s(z). Beide Enden frei — die Bettung
// stabilisiert das System (keine Lagerung nötig). Last H als Knotenkraft am Kopf.
// Hermite-FE (kubische Ansatzfunktionen, 2 DOF/Knoten w,θ): exakt im lastfreien Feld,
// konsistente Bettungsmatrix (∫ k·NᵀN); Punktlast exakt am Knoten → schnelle, stabile
// Konvergenz (kein Punktlast-Diskretisierungsfehler wie bei FD). Ein Knoten liegt exakt
// auf GOK (s=e). ksAt(z): laterale Bettungsziffer [kN/m³] in Tiefe z. Validiert gegen
// Hetényi (langer Pfahl).
// opts.puAt(z): optionaler Grenzwert der Bettungsreaktion p_u(z) [kN/m] (Reese-artige
//   elasto-plastische p-y-Kennlinie: p = min(k_s·B·|y|, p_u)·sign(y)). Sekanten-Iteration
//   mit Unterrelaxation; ohne puAt → 1 linearer Solve (skalierbar). Reaktion p im Profil
//   ist gedeckelt. Querkraft V(z)=EI·w''' (je Element konstant) zusätzlich im Profil.
// Rückgabe: {yHead_mm, yGround_mm, Mmax_kNm, sMmax, Vhead_kN, profile:[{z,y_mm,M,p,V}],
//            converged, yielded} oder null.
// ── Seitliche Bettung der Pfähle nach SIA 267 Ziff. 9.5.4.5 Gl. (53): k_s,k = E_s,k / D ─────────────
// (Okt 2026, Nutzerentscheid; vorher pauschal 0.30·M_E/((1−ν²)·d) — eine Faustregel ohne belegte Quelle.)
// Die Norm verlangt zusätzlich: «Im oberflächennahen Bereich ist der Bettungsmodul entsprechend dem
// reduzierten Tragwiderstand bzw. der reduzierten Steifigkeit des Baugrunds abzumindern», nennt aber
// kein Mass. ANNAHME DES PROGRAMMS: linearer Anstieg von 0 an der Oberfläche auf den vollen Wert in
// der Tiefe KS_RAMPE_D · d (Bereich des oberflächennahen Bruchkeils).
const KS_RAMPE_D = 3;
function ksRampe(z, d){ return Math.min(1, Math.max(0, z) / Math.max(1e-6, KS_RAMPE_D * d)); }

function bddBeamPY(EI, B, e, L, H, ksAt, opts){
  opts = opts || {};
  const puAt = (typeof opts === 'function') ? null : opts.puAt;        // (Alt-Aufrufe ohne opts)
  // Vernetzung: Knoten exakt auf GOK; Elementgrösse (Push nutzt gröber für Tempo)
  const dTarget = opts.dTarget || 0.10;
  // Freie Länge e=0 (Pfahlkopf auf GOK) → keine freien Knoten, sonst Null-Längen-Elemente
  // mit unverbundenen DOF → singuläre Matrix (Pfahlfundament-Bankett auf Terrain).
  const nFree = e > 1e-6 ? Math.max(2, Math.round(e / dTarget)) : 0;
  const nEmb  = Math.max(20, Math.round(L / dTarget));
  const sNodes = [];
  if(nFree > 0){ for(let i = 0; i <= nFree; i++) sNodes.push(e * i / nFree); }  // 0..e
  else sNodes.push(0);                                                          // e=0: Kopf auf GOK
  for(let i = 1; i <= nEmb;  i++) sNodes.push(e + L * i / nEmb);       // e..e+L
  const NN = sNodes.length, ND = 2 * NN, nEl = NN - 1;
  const lEl = [], zMid = [], kLin = [];                                // Element-Geometrie + lin. Bettung
  for(let el = 0; el < nEl; el++){
    lEl[el]  = sNodes[el+1] - sNodes[el];
    const sM = 0.5 * (sNodes[el] + sNodes[el+1]);
    zMid[el] = sM - e;
    kLin[el] = sM >= e - 1e-9 ? Math.max(0, ksAt(sM - e)) * B : 0;     // [kN/m²]
  }
  // Solve mit gegebener Element-Bettung kArr → Verschiebungsvektor u
  const assembleSolve = kArr => {
    const K = Array.from({length: ND}, () => new Array(ND).fill(0));
    const F = new Array(ND).fill(0);
    for(let el = 0; el < nEl; el++){
      const l = lEl[el]; if(l <= 1e-9) continue;
      const l2 = l*l, eb = EI / (l2*l), fb = kArr[el] * l / 420;
      const Ke = [
        [ eb*12 + fb*156,   eb*6*l + fb*22*l,   -eb*12 + fb*54,   eb*6*l - fb*13*l ],
        [ eb*6*l + fb*22*l, eb*4*l2 + fb*4*l2,  -eb*6*l + fb*13*l, eb*2*l2 - fb*3*l2],
        [ -eb*12 + fb*54,  -eb*6*l + fb*13*l,    eb*12 + fb*156,  -eb*6*l - fb*22*l ],
        [ eb*6*l - fb*13*l, eb*2*l2 - fb*3*l2,  -eb*6*l - fb*22*l, eb*4*l2 + fb*4*l2]
      ];
      const map = [2*el, 2*el+1, 2*el+2, 2*el+3];
      for(let a = 0; a < 4; a++) for(let bb = 0; bb < 4; bb++) K[map[a]][map[bb]] += Ke[a][bb];
    }
    F[0] = H;                                                          // Schub am Kopf
    // Kopfmoment M0 [kNm], positiv im SELBEN Drehsinn wie H·e (kippt den Kopf in Lastrichtung).
    // Der Drehfreiheitsgrad ist θ = dw/ds (s nach unten); ein solches Moment verkleinert dw/ds,
    // die arbeitskonjugierte Knotenlast ist darum −M0.
    if(opts.M0) F[1] = -opts.M0;
    return solveLinearDense(K, F);
  };
  // Element-Mittenverschiebung aus Knoten-DOF (Hermite, ξ=0.5)
  const yMidEl = (u, el) => {
    const l = lEl[el], w1=u[2*el], t1=u[2*el+1], w2=u[2*el+2], t2=u[2*el+3];
    return 0.5*w1 + 0.5*w2 + l*(t1 - t2)/8;                            // N(0.5)·u
  };
  let u = assembleSolve(kLin), converged = true, yielded = false;
  if(!u) return null;
  if(puAt){
    // Elasto-plastische p-y: k_sec = min(k_lin, p_u/|y|), Sekanten-Iteration mit
    // Unterrelaxation + kleiner Resttragsteifigkeit (1 % Verfestigung → stabil, keine
    // Singularität). Bei Nicht-Konvergenz (nahe Grenzlast) Fallback auf linear.
    const uLinear = u;                                                 // linearer Startwert (Fallback)
    const kSec = kLin.slice();
    const kFloor = kLin.map(k => 0.01 * k);                            // Resttragsteifigkeit
    converged = false;
    const maxIt = opts.maxIt || 90;
    for(let it = 0; it < maxIt; it++){
      let maxRel = 0;
      for(let el = 0; el < nEl; el++){
        if(kLin[el] <= 0){ kSec[el] = 0; continue; }
        const y  = Math.abs(yMidEl(u, el));
        const pu = Math.max(0, puAt(zMid[el]));
        let kNew = (pu > 0 && kLin[el]*y > pu && y > 1e-9)
                 ? Math.max(pu / y, kFloor[el]) : kLin[el];
        kNew = Math.min(kNew, kLin[el]);
        const kRel = 0.5*kNew + 0.5*kSec[el];                          // Unterrelaxation
        maxRel = Math.max(maxRel, Math.abs(kRel - kSec[el]) / Math.max(1e-6, kLin[el]));
        kSec[el] = kRel;
      }
      const uNew = assembleSolve(kSec);
      if(!uNew) break;
      const dHead = Math.abs(uNew[0] - u[0]) / Math.max(1e-9, Math.abs(uNew[0]));
      u = uNew;
      if(maxRel < 5e-4 && dHead < 2e-5){ converged = true; break; }
    }
    yielded = kSec.some((k, el) => kLin[el] > 0 && k < 0.99*kLin[el]);
    if(!converged) u = uLinear;                                        // Fallback: lineare Antwort
  }
  // Profil: y, Bodenreaktion p (gedeckelt), Moment M, Querkraft V
  const profile = [];
  for(let i = 0; i < NN; i++){
    const z = sNodes[i] - e;
    let p = 0;
    if(z >= -1e-9){
      const pl = Math.max(0, ksAt(z)) * B * u[2*i];                    // linear
      p = (puAt) ? Math.sign(pl) * Math.min(Math.abs(pl), Math.max(0, puAt(z))) : pl;
    }
    profile.push({ z, y_mm: u[2*i]*1000, M: 0, p, V: 0 });
  }
  let Mmax = 0, sMmax = 0;
  for(let el = 0; el < nEl; el++){
    const l = lEl[el]; if(l <= 1e-9) continue;
    const w1=u[2*el], t1=u[2*el+1], w2=u[2*el+2], t2=u[2*el+3];
    const M1 = EI/(l*l) * ( 6*w1 + 4*l*t1 - 6*w2 + 2*l*t2);            // M = EI·w''(0)
    const M2 = EI/(l*l) * (-6*w1 - 2*l*t1 + 6*w2 - 4*l*t2);            // M = EI·w''(l)
    const Vel = -EI/(l*l*l) * (12*w1 + 6*l*t1 - 12*w2 + 6*l*t2);       // V = -EI·w''' (const/Element)
    if(Math.abs(M1) > Math.abs(profile[el].M))   profile[el].M   = M1;
    if(Math.abs(M2) > Math.abs(profile[el+1].M)) profile[el+1].M = M2;
    // Querkraft: Elementwert beiden Knoten zuordnen (stückweise konstant, gemittelt am Knoten)
    profile[el].V   += Vel * 0.5;
    profile[el+1].V += Vel * 0.5;
  }
  profile[0].V = -EI/(lEl[0]**3) * (12*u[0] + 6*lEl[0]*u[1] - 12*u[2] + 6*lEl[0]*u[3]); // Kopf voll
  for(const p of profile){ if(p.z >= -1e-9 && Math.abs(p.M) > Math.abs(Mmax)){ Mmax = p.M; sMmax = p.z + e; } }
  const iGround = nFree;
  return { yHead_mm: u[0]*1000, yGround_mm: u[2*iGround]*1000,
           thetaHead: -u[1],                          // Kopfverdrehung [rad], positiv = Neigung in Lastrichtung
           Mmax_kNm: Math.abs(Mmax), sMmax, Vhead_kN: profile[0].V,
           profile, converged, yielded };
}

// ── Laterale Grenzlast: plastisches Grenzgleichgewicht (Rotationspunkt-Mechanismus) ──
// Freier kurzer Pfahl: p = +p_u über [0,z_r], −p_u über [z_r,L]. Momentengleichgewicht
// um den Lastangriff (Kopf, e über GOK) liefert z_r, Horizontalgleichgewicht H_u.
// Schichtweise über puAt(z) (GW/Böschung stecken in puAt). Exakt der Grenzwert, gegen
// den der inkrementelle p-y-Push konvergiert → robuster Bracket/Fallback. H_u,k [kN].
function pileLatCapLimitEq(L, B, e, puAt){
  const integ = (z1, z2) => {                         // ∫p_u dz, ∫p_u·(e+z) dz auf [z1,z2]
    const n = Math.max(4, Math.round((z2-z1)/0.05)), h = (z2-z1)/n;
    let i0=0, i1=0;
    for(let i=0;i<n;i++){ const z=z1+(i+0.5)*h, pu=Math.max(0,puAt(z)); i0+=pu*h; i1+=pu*(e+z)*h; }
    return {i0, i1};
  };
  const Mfn = zr => integ(0, zr).i1 - integ(zr, L).i1;  // = 0 am Rotationspunkt
  let lo = 1e-3, hi = L - 1e-3;
  if(Mfn(lo) * Mfn(hi) > 0) return null;                // kein Vorzeichenwechsel
  for(let i=0;i<44;i++){ const mid=(lo+hi)/2; if(Mfn(mid) < 0) lo=mid; else hi=mid; }
  const zr = (lo+hi)/2;
  const Hu = integ(0, zr).i0 - integ(zr, L).i0;
  return Math.max(0, Hu);
}

// Ultimate groundline MOMENT capacity of the embedded pile (rigid short-pile rotation, p_u-envelope).
// Reines Kopfmoment ohne Netto-Querkraft: Rotation um Tiefe a mit ∫p_u[0,a]=∫p_u[a,L] (Querkraft-Nulldurch-
// gang) → M_u = ∫₀^L p_u·|z−a| dz (plastisches Widerstandsmoment um den Rotationspunkt). [kNm]
function pileLatMomCap(L, B, puAt){
  const I0=(z1,z2)=>{ const n=Math.max(4,Math.round((z2-z1)/0.05)),h=(z2-z1)/n; let s=0;
    for(let i=0;i<n;i++){ const z=z1+(i+0.5)*h; s+=Math.max(0,puAt(z))*h; } return s; };
  const Iabs=(z1,z2,a)=>{ const n=Math.max(4,Math.round((z2-z1)/0.05)),h=(z2-z1)/n; let s=0;
    for(let i=0;i<n;i++){ const z=z1+(i+0.5)*h; s+=Math.max(0,puAt(z))*Math.abs(z-a)*h; } return s; };
  const F0=zr=>I0(0,zr)-I0(zr,L);                 // <0 bei zr→0, >0 bei zr→L → Vorzeichenwechsel garantiert
  let lo=1e-3, hi=L-1e-3;
  for(let i=0;i<40;i++){ const m=(lo+hi)/2; if(F0(m)<0) lo=m; else hi=m; }
  const a=(lo+hi)/2;
  return Iabs(0,L,a);
}

// ── Laterale Grenzlast aus dem inkrementellen p-y-Push ──
// Steigert die Kopflast bis zum Verformungs-Kollaps (Mechanismus): grobe Kopf-
// verschiebung > 8 % L. Bisektion, gröberes Netz (Tempo), gebracketed durch das
// Grenzgleichgewicht (Hseed). Liefert charakteristische H_u,k [kN].
function pileLatCapPush(EI, B, e, L, ksAt, puAt, Hseed){
  if(!(Hseed > 0)) return null;
  // Tangenten-Kollaps: H steigern, dδ/dH verfolgen; bricht die Tangentensteifigkeit auf
  // <4 % der elastischen Anfangssteifigkeit ein → Mechanismus (= plastischer Grenzwert,
  // schwellwert-unabhängig). Grobes Netz (Tempo). Start nahe Hseed.
  const sol = H => bddBeamPY(EI,B,e,L,H,ksAt,{puAt, dTarget:0.22});
  const Href = 0.05*Hseed, p0 = sol(Href);
  if(!p0 || !p0.converged || p0.yHead_mm <= 0) return null;
  const k0 = Href / p0.yHead_mm;                       // elastische Anfangssteifigkeit [kN/mm]
  let Hp = Href, yp = p0.yHead_mm;
  for(let H = 0.5*Hseed; H < 2.2*Hseed; H *= 1.06){
    const py = sol(H);
    if(!py || !py.converged || py.yHead_mm <= yp) return Hp;
    const kT = (H - Hp) / (py.yHead_mm - yp);          // Tangentensteifigkeit [kN/mm]
    if(kT < 0.04 * k0) return Hp;                       // Kollaps → Grenzlast
    Hp = H; yp = py.yHead_mm;
  }
  return Hp;
}

// ════════════════════════════════════════════════════════════════════════
