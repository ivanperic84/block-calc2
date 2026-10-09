// BlockCalc — js/diagramme.js
// Diagramme (SVG): Sohlspannung, Grundbruch, Kippen, GZT, Pfahl
// SOHLSPANNUNGS-DIAGRAMM
// ══════════════════════════════════════════════════════════
// ── Shared helpers für Sohl- und Kipp-Diagramm ──────────────────────────
function _sohlColors(smax, qu){
  const c_ok='#6fcf8e', c_warn='#c9a84c', c_fail='#cf7070';
  return { c_ok, c_warn, c_fail,
    c_sig: smax>qu ? c_fail : (smax>qu*0.8 ? c_warn : c_ok),
    c_fund:'#7b9ccc', c_dim:'var(--dim)', c_on2:'var(--on2)', c_ol:'var(--ol)' };
}

// ── 1. SOHLSPANNUNGS-DIAGRAMM (Schnitt) ─────────────────────────────────
// ── Erddruckdiagramm Pfahlsicherung (Broms passiv)
function buildPfahlSchnittSVG(params, wide=false){
  const {H_1, e_eff, L_emb, k_s, B_pf, EI, Mpl, etaStahl,
         phi_deg, gamma, gamma2, z_gw, hasGW, useClay, hasC,
         aL, pfahlTypLabel, d_ex, pfaehle_im_aushub,
         alpha_lat, gamma_R} = params;
  const g2  = (gamma2 != null) ? gamma2 : gamma;
  const zgw = (z_gw   != null && isFinite(z_gw)) ? z_gw : Infinity;

  const k_w   = k_s * B_pf;                                  // [kN/m²] Federsteifigkeit×B
  const pts_y = [], pts_p = [], pts_M = [], pts_V = [];
  const usePy = params.pyProfile && params.pyProfile.length > 3;
  const psc   = params.pyScale ?? H_1;                       // 1 = Profil bereits bei realer Last
  let z_r;
  if(usePy){
    // ── p-y-Lösung (Bettungsbalken): Profil skalieren (pyScale=1 → schon reale Last)
    for(const pt of params.pyProfile){
      pts_y.push({z: pt.z, v: pt.y_mm * psc});     // mm
      pts_p.push({z: pt.z, v: pt.p   * psc});      // kN/m
      pts_M.push({z: pt.z, v: pt.M   * psc});      // kNm
      pts_V.push({z: pt.z, v: (pt.V ?? 0) * psc}); // kN (Querkraft)
    }
    // Nulllinie: Vorzeichenwechsel der Verschiebung (Rotationspunkt)
    z_r = L_emb/2;
    for(let i=1;i<pts_y.length;i++){
      if(pts_y[i].z >= 0 && pts_y[i-1].v*pts_y[i].v < 0){
        const t = Math.abs(pts_y[i-1].v)/(Math.abs(pts_y[i-1].v)+Math.abs(pts_y[i].v));
        z_r = pts_y[i-1].z + t*(pts_y[i].z - pts_y[i-1].z); break;
      }
    }
  } else {
    // ── Fallback: analytische Lösung starrer freier Pfahl (Winkler)
    const delta0 = 2*H_1*(2*L_emb + 3*e_eff) / (k_w * L_emb**2);
    const theta  = 6*H_1*(2*e_eff + L_emb)   / (k_w * L_emb**3);
    z_r    = delta0 / Math.max(1e-9, theta);
    const N = 60, z_total = e_eff + L_emb;
    for(let i=0; i<=N; i++){
      const z = -e_eff + i/N * z_total;
      const y_m = delta0 - z*theta;
      const p   = z < 0 ? 0 : k_w * y_m;
      const M   = z < 0 ? H_1*(e_eff + z) : H_1*(e_eff + z) - k_w*(delta0*z**2/2 - theta*z**3/6);
      pts_y.push({z, v: y_m * 1000}); pts_p.push({z, v: p}); pts_M.push({z, v: M});
    }
  }

  const M_max  = Math.max(...pts_M.map(p=>p.v));
  const M_min  = Math.min(...pts_M.map(p=>p.v));
  const M_gov  = Math.abs(M_max) >= Math.abs(M_min) ? M_max : M_min;
  const z_Mmax = pts_M.find(p=>p.v===M_gov)?.z ?? L_emb/2;
  const y_max  = Math.max(...pts_y.map(p=>Math.abs(p.v)));

  // p_u(z) = 3·Kp·γ_eff(z)·z·B  (Broms passive Grenzspannung, mit GW-Knick)
  // bei talseitiger Böschung mit reduziertem Kp,β (geneigtes Gelände)
  const phi_r   = phi_deg * Math.PI/180;
  const Kp      = params.kp_eff ?? Math.tan(Math.PI/4 + phi_r/2)**2;
  const g_eff   = z => z < zgw ? (gamma ?? 20) : g2;
  // p_u-Hüllkurve: bevorzugt die Berechnungs-Funktion params.puAt (schichtweise, GW,
  // Böschung) — identisch zum p-y-Deckel; Fallback homogen 3·Kp·γ·z·B / 9·c_u·B.
  const pu_fn   = z => params.puAt ? Math.max(0, params.puAt(z))
    : (useClay ? 9 * (params.c_kPa ?? 0) * B_pf : 3 * Kp * g_eff(z) * z * B_pf);
  const p_u_max = Math.max(pu_fn(L_emb), ...(usePy ? pts_p.map(p=>pu_fn(Math.max(0,p.z))) : [0]));
  const p_max   = Math.max(...pts_p.map(p=>Math.abs(p.v)), p_u_max);

  // ── SVG Layout — Panels: y | p | (V) | M. Mit p-y zusätzlich Querkraft V(z).
  const n_panels = usePy ? 4 : 3;
  const VB = usePy ? (wide ? 520 : 440) : 380, H_VB = wide ? 420 : 320;
  const PAD_L=16, PAD_R=10, PAD_T=38, PAD_B=44;
  const ph = H_VB - PAD_T - PAD_B;  // plot height px
  const pw = VB - PAD_L - PAD_R;    // total width px
  const col_w = pw / n_panels;
  const axis_x = Array.from({length:n_panels}, (_,i)=>PAD_L + col_w*(i+0.5)); // Nullachsen
  const iY=0, iP=1, iV=usePy?2:-1, iM=usePy?3:2;    // Panel-Indizes
  const V_max = usePy ? Math.max(0.001, ...pts_V.map(p=>Math.abs(p.v))) : 1;

  // Tiefen-Pixel
  const depPy = z => PAD_T + ((z + e_eff) / (e_eff + L_emb)) * ph;
  const gok_y = depPy(0);

  const _lt   = (typeof SETTINGS!=='undefined') && SETTINGS.theme==='light';
  const c_s2  = _lt?'#ffffff':'#15161a', c_ol=_lt?'#d0d0da':'#353740';
  const c_dim = _lt?'#70727e':'#787a84', c_xdim=_lt?'#9a9caa':'#4e5058';
  const c_on2 = _lt?'#3a3c48':'#b8bac4';
  const c_acc = '#7c8de0', c_ep='#ffaa44', c_ok='#6fcf8e';
  const c_fail= '#cf7070', c_warn='#c9a84c', c_pu_v='#4db8c9';
  const etaCls = e => e>=1.0?c_ok:c_fail;

  // Skalierung: Wert → Pixel-Abstand von Nullachse
  const sc_y = v => (v / Math.max(0.001, y_max)) * col_w * 0.42;
  const sc_p = v => (v / Math.max(0.001, p_max)) * col_w * 0.42;
  const sc_M = v => (v / Math.max(0.001, Math.max(Math.abs(M_max), Math.abs(M_min)))) * col_w * 0.42;
  const sc_V = v => (v / V_max) * col_w * 0.42;

  // Kurve → SVG Polyline
  const curve = (pts, scFn, ax, col, fillPos=false) => {
    const line_pts = pts.map(p=>`${ax + scFn(p.v)},${depPy(p.z)}`).join(' ');
    const fill_pts = `${ax},${depPy(pts[0].z)} ${line_pts} ${ax},${depPy(pts[pts.length-1].z)}`;
    return `${fillPos ? `<polygon points="${fill_pts}" fill="${col}" fill-opacity="0.15"/>` : ''}
    <polyline points="${line_pts}" fill="none" stroke="${col}" stroke-width="1.5"/>`;
  };

  // M_pl Grenzen
  const Mpl_px = sc_M(Mpl);

  // Nulllinie horizontal (durch alle 3 Panels)
  const nl_y   = depPy(Math.min(z_r, L_emb));
  const Mmax_y = depPy(Math.min(z_Mmax, L_emb));

  // Tiefenskala (links)
  let depScale = '';
  const step = L_emb <= 2 ? 0.5 : 1.0;
  for(let z=0; z<=L_emb+0.01; z+=step){
    const ty = depPy(z);
    depScale += `<line x1="${PAD_L-1}" y1="${ty}" x2="${PAD_L+3}" y2="${ty}"
      stroke="${c_dim}" stroke-width="0.8"/>
    <text x="${PAD_L-3}" y="${ty+3}" font-family="'DM Mono',monospace" font-size="6.5"
      fill="${c_xdim}" text-anchor="end">${z.toFixed(z%1?1:0)}</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB} ${H_VB}"
    width="100%" style="max-width:${wide?460:320}px;display:block">
  <rect width="${VB}" height="${H_VB}" rx="4" fill="${c_s2}" stroke="${c_ol}" stroke-width="0.8"/>

  <!-- Titel -->
  <text x="${VB/2}" y="14" font-family="'DM Mono',monospace" font-size="8" letter-spacing=".07em"
    text-anchor="middle" fill="${c_dim}">${usePy ? 'p-y SCHNITTGRÖSSEN — FE-BETTUNG'+(params.multiLayer?' (mehrschichtig)':'') : 'WINKLER SCHNITTGRÖSSEN — STARRER PFAHL'}</text>
  <text x="${VB/2}" y="25" font-family="'DM Mono',monospace" font-size="7.5"
    text-anchor="middle" fill="${c_dim}">H_1=${H_1.toFixed(1)}kN · k_s=${(k_s/1000).toFixed(0)} MN/m³ · γ_R=${gamma_R.toFixed(2)} · λL=${aL.toFixed(1)} (${pfahlTypLabel})</text>

  <!-- Boden-Hintergrund -->
  <rect x="${PAD_L}" y="${gok_y}" width="${pw}" height="${depPy(L_emb)-gok_y}"
    fill="${c_dim}" fill-opacity="0.05"/>

  <!-- Trennlinien Panels -->
  ${Array.from({length:n_panels-1},(_,i)=>`<line x1="${PAD_L+col_w*(i+1)}" y1="${PAD_T-6}" x2="${PAD_L+col_w*(i+1)}" y2="${PAD_T+ph+4}"
    stroke="${c_ol}" stroke-width="0.8" stroke-dasharray="3,2"/>`).join('')}

  <!-- Panel-Titel -->
  <text x="${axis_x[iY]}" y="${PAD_T-8}" font-family="'DM Mono',monospace" font-size="7.5"
    text-anchor="middle" fill="${c_acc}">y(z) [mm]</text>
  <text x="${axis_x[iP]}" y="${PAD_T-8}" font-family="'DM Mono',monospace" font-size="7.5"
    text-anchor="middle" fill="${c_ep}">p(z) [kN/m]</text>
  ${usePy ? `<text x="${axis_x[iV]}" y="${PAD_T-8}" font-family="'DM Mono',monospace" font-size="7.5"
    text-anchor="middle" fill="${c_pu_v}">V(z) [kN]</text>` : ''}
  <text x="${axis_x[iM]}" y="${PAD_T-8}" font-family="'DM Mono',monospace" font-size="7.5"
    text-anchor="middle" fill="${etaCls(etaStahl??1)}">M(z) [kNm]</text>

  <!-- Null-Achsen -->
  ${axis_x.map(ax=>`<line x1="${ax}" y1="${PAD_T}" x2="${ax}" y2="${PAD_T+ph}"
    stroke="${c_dim}" stroke-width="0.7" stroke-dasharray="2,2"/>`).join('')}

  <!-- GOK-Linie über alle Panels -->
  <line x1="${PAD_L}" y1="${gok_y}" x2="${PAD_L+pw}" y2="${gok_y}"
    stroke="${c_on2}" stroke-width="0.9" stroke-dasharray="4,2"/>
  <text x="${PAD_L+2}" y="${gok_y-3}" font-family="'DM Mono',monospace" font-size="7"
    fill="${c_on2}">GOK</text>

  <!-- Grundwasserlinie -->
  ${hasGW && zgw < L_emb ? (() => {
    const gy = depPy(zgw);
    return `<line x1="${PAD_L}" y1="${gy}" x2="${PAD_L+pw}" y2="${gy}"
      stroke="#5599cc" stroke-width="1.1" stroke-dasharray="6,2" opacity="0.85"/>
    <text x="${PAD_L+2}" y="${gy-3}" font-family="'DM Mono',monospace" font-size="7"
      fill="#5599cc">GW z=${zgw.toFixed(1)}m</text>
    <text x="${PAD_L+pw-2}" y="${gy+9}" font-family="'DM Mono',monospace" font-size="6.5"
      fill="#5599cc" text-anchor="end">γ'=${g2} kN/m³</text>`;
  })() : ''}

  <!-- Bodenmodell-Hinweise -->
  ${useClay ? `<text x="${axis_x[1]}" y="${PAD_T+8}" font-family="'DM Mono',monospace" font-size="6.5"
    text-anchor="middle" fill="${c_warn}">bindig (c_u, undrainiert)</text>` : ''}
  ${hasC ? `<text x="${axis_x[1]}" y="${PAD_T+8}" font-family="'DM Mono',monospace" font-size="6.5"
    text-anchor="middle" fill="${c_warn}">c′ vernachlässigt (konservativ)</text>` : ''}

  <!-- Nulllinie (Rotationszentrum) -->
  ${z_r > 0 && z_r < L_emb ? `
  <line x1="${PAD_L}" y1="${nl_y}" x2="${PAD_L+pw}" y2="${nl_y}"
    stroke="${c_ok}" stroke-width="1" stroke-dasharray="3,2" opacity="0.8"/>
  <text x="${PAD_L+2}" y="${nl_y-3}" font-family="'DM Mono',monospace" font-size="7"
    fill="${c_ok}">NL  z=${Math.min(z_r,L_emb).toFixed(2)}m</text>` : ''}

  <!-- M_max Linie -->
  ${Math.abs(M_gov) > 0.01 ? `
  <line x1="${axis_x[iM]-col_w*0.5}" y1="${Mmax_y}" x2="${PAD_L+pw}" y2="${Mmax_y}"
    stroke="${etaCls(etaStahl??1)}" stroke-width="0.8" stroke-dasharray="2,2" opacity="0.6"/>
  <text x="${axis_x[iM]-col_w*0.5+2}" y="${Mmax_y-3}" font-family="'DM Mono',monospace" font-size="7"
    fill="${etaCls(etaStahl??1)}">M_max=${Math.abs(M_gov).toFixed(1)}kNm</text>` : ''}

  <!-- M_pl Grenzlinien -->
  <line x1="${axis_x[iM]+Mpl_px}" y1="${PAD_T}" x2="${axis_x[iM]+Mpl_px}" y2="${PAD_T+ph}"
    stroke="${c_fail}" stroke-width="1" stroke-dasharray="4,2" opacity="0.7"/>
  <text x="${axis_x[iM]+Mpl_px+2}" y="${PAD_T+10}" font-family="'DM Mono',monospace" font-size="6.5"
    fill="${c_fail}">M_pl=${(Mpl).toFixed(0)}</text>

  <!-- p_u(z) Grenzwert der Bettungsreaktion — gestrichelte Polylinie im p-Panel -->
  ${(() => {
    // Reserve-Füllung zwischen p(z) und p_u(z) (nur wo p < p_u)
    const reservePts = pts_p.filter(pt=>pt.z>=0).map(pt=>{
      const pu = pu_fn(pt.z);
      const px_mob = axis_x[iP] + sc_p(Math.min(pt.v, pu));
      const px_pu  = axis_x[iP] + sc_p(pu);
      return {z:pt.z, px_mob, px_pu};
    });
    const reserveFill = reservePts.map(r=>`${r.px_pu},${depPy(r.z)}`).join(' ')
      + ' ' + [...reservePts].reverse().map(r=>`${r.px_mob},${depPy(r.z)}`).join(' ');
    // p_u als Polylinie (schichtweise korrekt, nicht-linear bei Schichtung)
    const puLine = reservePts.map(r=>`${r.px_pu},${depPy(r.z)}`).join(' ');
    const last = reservePts[reservePts.length-1];
    // Lokale Überlastung: wo mobilisiertes p > p_u (sollte bei p-y-Deckel = 0 sein)
    const overPts = pts_p.filter(pt=>pt.z>=0 && pt.v > pu_fn(pt.z)+0.01);
    const overFill = overPts.length > 1
      ? overPts.map(pt=>`${axis_x[iP]+sc_p(pt.v)},${depPy(pt.z)}`).join(' ')
        + ' ' + [...overPts].reverse().map(pt=>`${axis_x[iP]+sc_p(pu_fn(pt.z))},${depPy(pt.z)}`).join(' ')
      : '';
    return `
    <!-- Reserve-Fläche (grün) zwischen p_mob und p_u -->
    ${reservePts.length>1 ? `<polygon points="${reserveFill}"
      fill="${c_ok}" fill-opacity="0.08"/>` : ''}
    <!-- Überlastungs-Fläche (rot) wo p > p_u -->
    ${overFill ? `<polygon points="${overFill}"
      fill="${c_fail}" fill-opacity="0.20"/>` : ''}
    <!-- p_u-Linie gestrichelt (Polylinie) -->
    <polyline points="${puLine}" fill="none"
      stroke="${c_ok}" stroke-width="1.2" stroke-dasharray="5,3" opacity="0.85"/>
    <text x="${(last?last.px_pu:axis_x[iP])+3}" y="${depPy(L_emb)-3}" font-family="'DM Mono',monospace" font-size="6.5"
      fill="${c_ok}" opacity="0.9">p_u</text>`;
  })()}

  <!-- Querkraft V(z) (nur p-y): aus der Bettung; V=0 markiert M_max -->
  ${usePy ? curve(pts_V, sc_V, axis_x[iV], c_pu_v, true) : ''}
  ${usePy ? `<text x="${axis_x[iV]}" y="${H_VB-PAD_B+16}" font-family="'DM Mono',monospace" font-size="7"
    text-anchor="middle" fill="${c_pu_v}">V_Kopf=${(pts_V[0]?Math.abs(pts_V[0].v):0).toFixed(0)} kN</text>` : ''}

  <!-- Kurven -->
  ${curve(pts_y, sc_y, axis_x[iY], c_acc, true)}
  ${curve(pts_p.map(p=>({z:p.z, v:p.v})), sc_p, axis_x[iP], c_ep, true)}
  ${curve(pts_M, sc_M, axis_x[iM], etaCls(etaStahl??1), true)}

  <!-- Tiefenskala -->
  ${depScale}
  <text x="${PAD_L-3}" y="${PAD_T-4}" font-family="'DM Mono',monospace" font-size="6.5"
    fill="${c_xdim}" text-anchor="end">m</text>

  <!-- Skalenwerte unten -->
  <text x="${axis_x[iY]}" y="${H_VB-PAD_B+16}" font-family="'DM Mono',monospace" font-size="7"
    text-anchor="middle" fill="${c_acc}">±${y_max.toFixed(1)} mm</text>
  <text x="${axis_x[iP]}" y="${H_VB-PAD_B+16}" font-family="'DM Mono',monospace" font-size="7"
    text-anchor="middle" fill="${c_ep}">p=${Math.max(...pts_p.map(p=>Math.abs(p.v))).toFixed(0)} / p_u=${p_u_max.toFixed(0)} kN/m</text>
  <text x="${axis_x[iM]}" y="${H_VB-PAD_B+16}" font-family="'DM Mono',monospace" font-size="7"
    text-anchor="middle" fill="${etaCls(etaStahl??1)}">M_max=${Math.abs(M_gov).toFixed(1)} kNm</text>

  <!-- Modell-Hinweis -->
  ${usePy
    ? `<text x="${VB/2}" y="${H_VB-6}" font-family="'DM Mono',monospace" font-size="6.5"
        text-anchor="middle" fill="${c_xdim}">p-y-Bettungsbalken${params.pyNonlin?', elasto-plastisch (p≤p_u)':', linear'}${params.pyYielded?' · Boden teilw. plastisch':''} · λL=${aL.toFixed(1)} (${pfahlTypLabel})</text>`
    : (aL > 2.0 ? `<text x="${VB/2}" y="${H_VB-6}" font-family="'DM Mono',monospace" font-size="6.5"
        text-anchor="middle" fill="${c_warn}">Näherung starrer Pfahl — λL=${aL.toFixed(1)} > 2.0, flexibles Verhalten möglich</text>` : '')}
</svg>`;
}

// Stützenkraft-Zerlegung am Pfahlkopf — kleines Vektordiagramm.
// Vertikaler Pfahl + geneigte Stütze (α SIGNIERT): F_s = H_eff/cos α (Stab), zerlegt in
// H_eff (horizontal, Broms-Lateral) + V = H_eff·|tan α| (axial). strutZug = F_s Zug/Druck;
// pullout = Axialrichtung am Pfahl (Herausziehen vs. Druck) — kann von strutZug abweichen,
// wenn der Pfahlkopf höher/tiefer als der Anschluss liegt (α-Vorzeichen).
function buildStrutDecompSVG(alpha_deg, H_eff, F_s, V_pf, H_pf, strutZug, pullout){
  const a   = alpha_deg * Math.PI/180;                 // signiert
  const _lt = (typeof SETTINGS!=='undefined') && SETTINGS.theme==='light';
  const c_s2=_lt?'#ffffff':'#15161a', c_ol=_lt?'#d0d0da':'#353740';
  const c_dim=_lt?'#70727e':'#787a84', c_xdim=_lt?'#9a9caa':'#4e5058';
  const c_acc='#7c8de0', c_warn='#c9a84c', c_pu='#4db8c9';
  const dirC = strutZug ? c_warn : c_acc;
  const VB=270, HB=126;
  const px=176, py=64;                                 // Pfahlkopf-Knoten
  const Lh=104;
  let Lv = Lh*Math.tan(a); Lv = Math.max(-44, Math.min(44, Lv));  // signiert, gedeckelt
  const bx=px-Lh, by=py-Lv;                            // Blockanschluss (über/unter je nach Vorzeichen)
  const arr=(x1,y1,x2,y2,col,w=1.8)=>{const dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L,ah=5;
    return `<line x1="${x1}" y1="${y1}" x2="${x2-ux*ah}" y2="${y2-uy*ah}" stroke="${col}" stroke-width="${w}"/>
    <polygon points="${x2},${y2} ${x2-ux*ah-uy*3},${y2-uy*ah+ux*3} ${x2-ux*ah+uy*3},${y2-uy*ah-ux*3}" fill="${col}"/>`;};
  const sgnH = strutZug ? -1 : 1;          // H: zum Block (Zug, −x) / vom Block weg (Druck, +x)
  const sgnV = pullout ? -1 : 1;           // Bild-y: hoch = Herausziehen · runter = Druck
  const hx2  = px + sgnH*62, vy2 = py + sgnV*34;
  // Block tiefer als Pfahlkopf? (α<0) → Hinweis
  const lowBlock = a < -0.005;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB} ${HB}" width="100%" style="max-width:300px;display:block">
  <rect width="${VB}" height="${HB}" rx="4" fill="${c_s2}" stroke="${c_ol}" stroke-width="0.8"/>
  <text x="8" y="13" font-family="'DM Mono',monospace" font-size="7.5" letter-spacing=".05em" fill="${c_dim}">KRAFTZERLEGUNG STÜTZE → PFAHLKOPF</text>
  <text x="${VB-7}" y="13" font-family="'DM Mono',monospace" font-size="7.5" font-weight="500" fill="${dirC}" text-anchor="end">STÜTZE ${strutZug?'ZUG':'DRUCK'}</text>
  <!-- Block-Anschluss -->
  <rect x="${bx-13}" y="${by-7}" width="13" height="14" rx="1" fill="${c_acc}" fill-opacity="0.5" stroke="${c_acc}" stroke-width="0.8"/>
  <text x="${bx-6}" y="${by + (lowBlock?20:-10)}" font-family="'DM Mono',monospace" font-size="6" fill="${c_dim}" text-anchor="middle">Anschluss</text>
  <!-- Pfahl (vertikal) -->
  <rect x="${px-3}" y="${py-10}" width="6" height="52" rx="1" fill="${c_acc}" fill-opacity="0.5" stroke="${c_acc}" stroke-width="0.8"/>
  <text x="${px+6}" y="${py+44}" font-family="'DM Mono',monospace" font-size="6.5" fill="${c_dim}">Pfahl (vert.)</text>
  <!-- Horizontale Referenz (gestrichelt) am Kopf -->
  <line x1="${px-34}" y1="${py}" x2="${px}" y2="${py}" stroke="${c_dim}" stroke-width="0.5" stroke-dasharray="2,2"/>
  <!-- Stütze F_s entlang Achse -->
  <line x1="${bx}" y1="${by}" x2="${px}" y2="${py}" stroke="${dirC}" stroke-width="2.4" stroke-linecap="round"/>
  <text x="${(bx+px)/2}" y="${(by+py)/2 + (lowBlock?10:-4)}" font-family="'DM Mono',monospace" font-size="7" fill="${dirC}" text-anchor="middle">F_s=${F_s.toFixed(1)}</text>
  <text x="${px-36}" y="${py + (lowBlock?9:-3)}" font-family="'DM Mono',monospace" font-size="6.5" fill="${c_dim}" text-anchor="end">α=${alpha_deg.toFixed(1)}°</text>
  <!-- H_eff horizontal (Broms-Lateral) -->
  ${arr(px, py, hx2, py, c_pu)}
  <text x="${hx2 + sgnH*2}" y="${py - 5}" font-family="'DM Mono',monospace" font-size="7" fill="${c_pu}" text-anchor="${strutZug?'end':'start'}">H=${H_pf.toFixed(1)} (Broms)</text>
  <!-- V vertikal (axial) -->
  ${arr(px, py, px, vy2, c_pu)}
  <text x="${px+5}" y="${vy2 + (sgnV>0?9:-3)}" font-family="'DM Mono',monospace" font-size="7" fill="${c_pu}">V=${V_pf.toFixed(1)} (${pullout?'Herausziehen':'Druck'})</text>
  <text x="${VB-7}" y="${HB-6}" font-family="'DM Mono',monospace" font-size="6.5" fill="${c_xdim}" text-anchor="end">F_s=H/cos α · V=H·|tan α|</text>
</svg>`;
}

// ── p-y-Kennlinie (Erklär-Skizze): p = min(k_s·B·y, p_u) ──────────────────────
// Zeigt das elasto-plastische Bettungsgesetz: elastischer Anstieg (k_s·B) bis zum
// Grenzwert p_u (Bodenfliessen), darüber konstant. Arbeitspunkt = aktuelle max.
// Ausnutzung p/p_u im Pfahl; Reserve = Abstand zur Grenze.
function buildPyKennlinieSVG(mobRatio, yielded){
  const _lt = (typeof SETTINGS!=='undefined') && SETTINGS.theme==='light';
  const c_s2=_lt?'#ffffff':'#15161a', c_ol=_lt?'#d0d0da':'#353740', c_dim=_lt?'#70727e':'#787a84',
        c_xdim=_lt?'#9a9caa':'#4e5058', c_acc='#7c8de0', c_ok='#6fcf8e', c_pu='#4db8c9', c_warn='#c9a84c';
  const VB=300, HB=148, PADL=20, PADB=26, PADT=22, PADR=58;
  const x0=PADL, y0=HB-PADB, pw=VB-PADL-PADR, ph=HB-PADT-PADB;
  const yYx = x0 + pw*0.46;                 // Fliessknick (Verschiebung y bei p=p_u)
  const puY = PADT + ph*0.10;               // p_u-Niveau
  const mob = Math.max(0.04, Math.min(1, isFinite(mobRatio)?mobRatio:0.5));
  let wx, wy, onPlateau = (mob>=0.999)||yielded;
  if(onPlateau){ wx = yYx + (x0+pw - yYx)*0.45; wy = puY; }
  else { wx = x0 + (yYx-x0)*mob; wy = y0 + (puY-y0)*mob; }
  const wc = onPlateau ? c_warn : c_ok;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB} ${HB}" width="100%" style="max-width:320px;display:block">
  <rect width="${VB}" height="${HB}" rx="4" fill="${c_s2}" stroke="${c_ol}" stroke-width="0.8"/>
  <text x="${VB/2}" y="13" font-family="'DM Mono',monospace" font-size="7.5" letter-spacing=".06em" text-anchor="middle" fill="${c_dim}">p-y-KENNLINIE  ·  p = min(k_s·B·y , p_u)</text>
  <!-- Achsen -->
  <line x1="${x0}" y1="${PADT-4}" x2="${x0}" y2="${y0}" stroke="${c_dim}" stroke-width="0.8"/>
  <line x1="${x0}" y1="${y0}" x2="${x0+pw+6}" y2="${y0}" stroke="${c_dim}" stroke-width="0.8"/>
  <text x="${x0-3}" y="${PADT+2}" font-family="'DM Mono',monospace" font-size="7" text-anchor="end" fill="${c_dim}">p</text>
  <text x="${x0+pw+6}" y="${y0+10}" font-family="'DM Mono',monospace" font-size="7" text-anchor="end" fill="${c_dim}">y</text>
  <!-- p_u-Niveau gestrichelt -->
  <line x1="${x0}" y1="${puY}" x2="${x0+pw}" y2="${puY}" stroke="${c_pu}" stroke-width="1" stroke-dasharray="4,3"/>
  <text x="${x0+pw+4}" y="${puY+3}" font-family="'DM Mono',monospace" font-size="7" fill="${c_pu}">p_u</text>
  <text x="${x0+pw+4}" y="${puY+13}" font-family="'DM Mono',monospace" font-size="6" fill="${c_xdim}">Boden-</text>
  <text x="${x0+pw+4}" y="${puY+21}" font-family="'DM Mono',monospace" font-size="6" fill="${c_xdim}">fliessen</text>
  <!-- Reserve-Band (Arbeitspunkt → p_u) -->
  ${!onPlateau ? `<line x1="${wx}" y1="${wy}" x2="${wx}" y2="${puY}" stroke="${c_ok}" stroke-width="0.7" stroke-dasharray="2,2" opacity="0.8"/>
  <text x="${wx+3}" y="${(wy+puY)/2+2}" font-family="'DM Mono',monospace" font-size="6" fill="${c_ok}">Reserve</text>`:''}
  <!-- Kennlinie: elastisch + Plateau -->
  <path d="M ${x0},${y0} L ${yYx},${puY} L ${x0+pw},${puY}" fill="none" stroke="${c_acc}" stroke-width="1.8"/>
  <!-- Steigung-Label -->
  <text x="${x0+(yYx-x0)*0.5-2}" y="${y0-(y0-puY)*0.5-3}" font-family="'DM Mono',monospace" font-size="6.5" fill="${c_acc}" transform="rotate(-32 ${x0+(yYx-x0)*0.5} ${y0-(y0-puY)*0.5})">k_s·B (elastisch)</text>
  <text x="${(yYx+x0+pw)/2}" y="${puY-4}" font-family="'DM Mono',monospace" font-size="6.5" text-anchor="middle" fill="${c_warn}">plastisch (p = p_u)</text>
  <!-- Arbeitspunkt -->
  <circle cx="${wx}" cy="${wy}" r="3" fill="${wc}" stroke="${c_s2}" stroke-width="0.8"/>
  <text x="${wx}" y="${y0+10}" font-family="'DM Mono',monospace" font-size="6.5" text-anchor="middle" fill="${wc}">Arbeitspkt. ${(mob*100).toFixed(0)}%</text>
  </svg>`;
}

function buildPfahlSystemSVG(params, wide=false){
  const {phi_deg, gamma, gamma2, z_gw, hasGW, useClay, hasC,
         t_bl, G_ue, G_bx, d_abst, B_pf, L_emb, e_h, d_ex,
         d_krit_ov, r_overlap, f_overlap, z_ov, f_shadow, Hu_1, Hu_gruppe, H_pfahl_total,
         eta_H, eta_V, etaStahl, delta_gruppe_mm, neig_mm_m, n, typ,
         k_s, alpha_lat, gamma_R, aL, pfahlTypLabel, d_krit_v,
         pfaehle_im_aushub, Hu_1k, ex_seite, fall_zug, kp_eff, betaRed,
         exClipRed, L_horiz_ex, puAt, puAtEx} = params;

  const phi   = phi_deg * Math.PI/180;
  const Kp    = kp_eff ?? Math.tan(Math.PI/4 + phi/2)**2;
  const g2sys = (gamma2 != null) ? gamma2 : gamma;
  const zgwS  = (z_gw != null && isFinite(z_gw)) ? z_gw : Infinity;
  const g_eff_s = z => z < zgwS ? gamma : g2sys;
  // p_u(z) [kN/m] — bevorzugt die Berechnungs-Hüllkurve (schichtweise/GW/Böschung),
  // Fallback homogen. puR = reduziert (Aushub-Clip, Zugfall); puF = voll (Referenz).
  const puF = z => puAt ? Math.max(0, puAt(Math.max(0,z))) : 3*Kp*g_eff_s(z)*z*B_pf;
  const puR = z => puAtEx ? Math.max(0, puAtEx(Math.max(0,z))) : puF(z);
  let p_max = puF(L_emb);
  for(let i=0;i<=20;i++) p_max = Math.max(p_max, puF(i/20*L_emb));
  const z_r   = (2*L_emb + 3*e_h) * L_emb / (3*(2*e_h + L_emb));  // (nur noch Layout-Hilfsgrösse)

  // ── Layout
  const VB = 430, H_VB = wide ? 440 : 350;
  const PAD_L=46, PAD_R=12, PAD_T=42, PAD_B=62;
  const ph = H_VB - PAD_T - PAD_B;

  // Tiefenbereich
  const z_top = -(e_h + 0.3), z_bot = Math.max(t_bl, L_emb) + 0.4;
  const z_rng = z_bot - z_top;
  const depY  = z => PAD_T + (z - z_top) / z_rng * ph;
  const gok_y = depY(0);

  // Horizontales Layout (teilweise skaliert)
  // Aushub liegt im Schnitt IMMER gegenüber den Pfählen → links vom Block
  const EXC_W     = d_ex > 0.05 ? 26 : 0;
  const geo_avail = (VB - PAD_L - EXC_W - PAD_R) * 0.42;
  const geo_sc    = geo_avail / (G_bx + d_abst + B_pf);
  const blk_w_px  = Math.max(32, Math.min(56, G_bx * geo_sc));
  const d_px      = Math.max(44, Math.min(130, d_abst * geo_sc));
  const blk_l = PAD_L + EXC_W, blk_r = blk_l + blk_w_px;
  const pile_cx = blk_r + d_px;
  const pile_w  = 14;
  const pile_l  = pile_cx - pile_w/2, pile_r = pile_cx + pile_w/2;
  const ep_x0   = pile_r + 4;
  const ep_xmax = VB - PAD_R - 8;
  const ep_avl  = ep_xmax - ep_x0;
  const p_px_fn = v => (v / Math.max(0.1, p_max)) * ep_avl * 0.88;

  // Schlüssel-y
  const blk_ty = depY(G_ue), blk_by = depY(t_bl);
  const pl_ty  = depY(-e_h),  pl_by = depY(L_emb);
  const nl_y   = depY(Math.min(z_r, L_emb));
  // Rankine-Keil Spitze: bei GOK auf Höhe d_krit (darf hinter Pfahl liegen)
  const wd_tip_x = Math.min(ep_xmax - 10, blk_r + d_krit_ov * geo_sc);

  // Pfahl-Bodenpressung (Broms): Grenzwert-Hüllkurve 0…L (gestrichelt) +
  // mobilisierbarer Anteil bis Drehpunkt z_r gefüllt (Broms-Mechanismus:
  // rückseitige Reaktion unter z_r wird als konzentrierte Fusskraft angesetzt).
  // ZUGFALL: Pfahl wird zum Block gezogen → Druckzone GESPIEGELT (links vom Pfahl)
  const zugS   = !!fall_zug;
  const pp_avl = zugS ? Math.max(24, pile_l - blk_r - 10) : ep_avl;
  const pp_x0  = zugS ? pile_l - 4 : ep_x0;
  const pp_sgn = zugS ? -1 : 1;
  const pp_x   = v => pp_x0 + pp_sgn * (v / Math.max(0.1, p_max)) * pp_avl * 0.88;
  const nSeg = 24;
  const _tanW_s = Math.tan(Math.PI/4 + phi/2);
  const exA     = !!fall_zug && (exClipRed > 0.005) && d_ex > 0.05 && (L_horiz_ex > 0);
  const zClear  = exA ? L_horiz_ex / _tanW_s : 0;
  // p_u-Grenzhüllkurve (voll, 0…L) — schichtweise aus puF. Bei Aushub-Clip zusätzlich die
  // reduzierte Hüllkurve puR (gefüllt) → die Abminderung wird als Differenz sichtbar.
  let epPts = `${pp_x0},${gok_y}`;
  for(let i=0; i<=nSeg; i++){ const zz = i/nSeg*L_emb; epPts += ` ${pp_x(puF(zz))},${depY(zz)}`; }
  epPts += ` ${pp_x0},${pl_by}`;
  let epRedPts = `${pp_x0},${gok_y}`;
  for(let i=0; i<=nSeg; i++){ const zz = i/nSeg*L_emb; epRedPts += ` ${pp_x(puR(zz))},${depY(zz)}`; }
  epRedPts += ` ${pp_x0},${pl_by}`;

  // Überlappungszone
  const ov_l = blk_r, ov_r = Math.min(pile_l - 1, wd_tip_x);
  const ov_t = gok_y, ov_b = Math.min(pl_by, blk_by);
  const showOv = r_overlap > 0.02 && ov_r > ov_l + 2;

  // Aushub: gegenüber den Pfählen → Stufe in der Oberfläche links vom Block
  const excLine = d_ex > 0.05 ? (() => {
    const ey = depY(Math.min(d_ex, z_bot - 0.2));
    return `<rect x="${PAD_L}" y="${gok_y}" width="${blk_l-PAD_L}" height="${ey-gok_y}"
      fill="#cf7070" fill-opacity="0.08"/>
    <line x1="${PAD_L}" y1="${ey}" x2="${blk_l}" y2="${ey}"
      stroke="#cf7070" stroke-width="1.2"/>
    <line x1="${blk_l}" y1="${gok_y}" x2="${blk_l}" y2="${ey}"
      stroke="#cf7070" stroke-width="0.9" stroke-dasharray="3,2"/>
    <text x="${PAD_L+1}" y="${ey+9}" font-family="'DM Mono',monospace" font-size="6.5"
      fill="#cf7070">d_ex=${d_ex.toFixed(1)}m</text>
    <text x="${PAD_L+1}" y="${ey+17}" font-family="'DM Mono',monospace" font-size="6"
      fill="#cf7070">${ex_seite==='feld'?'Feldseite':'Gleisseite'}</text>`;
  })() : '';

  // Tiefenskala
  const step = L_emb <= 2 ? 0.5 : 1.0;
  let depTicks = '';
  for(let z=0; z<=L_emb+0.01; z+=step){
    const ty = depY(z);
    depTicks += `<line x1="${PAD_L-1}" y1="${ty}" x2="${PAD_L+3}" y2="${ty}" stroke="#787a84" stroke-width="0.8"/>
    <text x="${PAD_L-3}" y="${ty+3}" font-family="'DM Mono',monospace" font-size="6.5" fill="#4e5058" text-anchor="end">${z.toFixed(z%1?1:0)}</text>`;
  }

  const _lt = (typeof SETTINGS!=='undefined') && SETTINGS.theme==='light';
  const c_s2 = _lt?'#ffffff':'#15161a', c_ol=_lt?'#d0d0da':'#353740';
  const c_dim= _lt?'#70727e':'#787a84', c_xdim=_lt?'#9a9caa':'#4e5058';
  const c_on2= _lt?'#3a3c48':'#b8bac4';
  const c_acc='#7c8de0', c_ep='#ffaa44', c_pu='#4db8c9';
  const c_ok='#6fcf8e', c_fail='#cf7070', c_warn='#c9a84c';
  const etaCls = v => v>=1.0?c_ok:c_fail;
  const fOvCol = r_overlap>0.15?c_warn:r_overlap>0.02?c_ep:c_ok;

  const etaBox = (lbl,val,x,y,w=82) => {
    const cl = isFinite(val)?etaCls(val):c_dim;
    const tx = isFinite(val)?`η = ${val.toFixed(2)}`:'n.m.';
    return `<rect x="${x}" y="${y}" width="${w}" height="17" rx="3"
      fill="${cl}" fill-opacity="0.15" stroke="${cl}" stroke-width="0.8"/>
    <text x="${x+w/2}" y="${y+11.5}" font-family="'DM Mono',monospace" font-size="8"
      fill="${cl}" text-anchor="middle">${lbl} ${tx}</text>`;
  };

  // Schraffur Overlap
  const ovHatch = showOv ? Array.from({length:Math.ceil((ov_b-ov_t+ov_r-ov_l)/9)},(_,i)=>{
    const off=i*9;
    const cx1=Math.max(ov_l,Math.min(ov_r,ov_l)), cy1=Math.max(ov_t,Math.min(ov_b,ov_t+off));
    const cx2=Math.max(ov_l,Math.min(ov_r,ov_l+off)), cy2=Math.max(ov_t,Math.min(ov_b,ov_t));
    return `<line x1="${ov_l}" y1="${Math.min(ov_b,ov_t+off)}" x2="${Math.min(ov_r,ov_l+off)}" y2="${ov_t}"
      stroke="${c_fail}" stroke-width="0.6" opacity="0.45"/>`;
  }).join('') : '';

  const alphaWedge = Math.round(Math.atan2(t_bl, d_krit_ov)*180/Math.PI);
  const h_arr_y = e_h > 0.1 ? depY(-e_h*0.52) : gok_y - 12;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB} ${H_VB}"
    width="100%" style="max-width:${wide?500:380}px;display:block">
  <rect width="${VB}" height="${H_VB}" rx="4" fill="${c_s2}" stroke="${c_ol}" stroke-width="0.8"/>

  <text x="${VB/2}" y="15" font-family="'DM Mono',monospace" font-size="8" letter-spacing=".07em"
    text-anchor="middle" fill="${c_dim}">SYSTEMSCHNITT — BLOCK / PFAHL</text>
  <text x="${VB/2}" y="27" font-family="'DM Mono',monospace" font-size="7.5"
    text-anchor="middle" fill="${c_dim}">${n}× ${typ} · L=${L_emb.toFixed(1)}m · H_tot=${H_pfahl_total.toFixed(1)}kN · η_H=${eta_H.toFixed(2)}</text>

  <!-- Boden -->
  <rect x="${PAD_L}" y="${gok_y}" width="${VB-PAD_L-PAD_R}" height="${depY(z_bot)-gok_y}"
    fill="${c_dim}" fill-opacity="${_lt?'0.08':'0.05'}"/>

  <!-- Rankine Keil (vollständig von GOK bis UK Block) -->
  <polygon points="${blk_r},${gok_y} ${blk_r},${blk_by} ${wd_tip_x},${gok_y}"
    fill="${c_ep}" fill-opacity="0.18" stroke="${c_ep}" stroke-width="1.2" stroke-dasharray="5,3"/>
  <line x1="${blk_r}" y1="${blk_by}" x2="${wd_tip_x}" y2="${gok_y}"
    stroke="${c_ep}" stroke-width="1.8"/>
  <text x="${blk_r+7}" y="${blk_by-6}" font-family="'DM Mono',monospace"
    font-size="7.5" fill="${c_ep}">${alphaWedge}°</text>

  <!-- Überlappung -->
  ${showOv ? `<rect x="${ov_l}" y="${ov_t}" width="${ov_r-ov_l}" height="${ov_b-ov_t}"
    fill="${c_fail}" fill-opacity="0.10" stroke="${c_fail}" stroke-width="0.7" stroke-dasharray="2,1.5"/>
  ${ovHatch}` : ''}

  <!-- Pfahl-Bettungsgrenzwert p_u(z) (türkis): Grenzhüllkurve der Bettungsreaktion
       (= Kapazität). Voll gestrichelt; bei Aushub-Clip zusätzlich die reduzierte
       Hüllkurve gefüllt (Differenz = Verlust). Die mobilisierte Reaktion steht im
       p-y-Schnittgrössen-Diagramm — hier nur die Grenze. -->
  ${exA ? `<polygon points="${epRedPts}" fill="${c_pu}" fill-opacity="0.16"
    stroke="${c_pu}" stroke-width="1"/>` : ''}
  <polygon points="${epPts}" fill="${exA?'none':c_pu}" fill-opacity="0.10"
    stroke="${exA?c_warn:c_pu}" stroke-width="1" stroke-dasharray="4,3"/>
  <text x="${zugS?pp_x0:ep_xmax}" y="${pl_by+9}" font-family="'DM Mono',monospace"
    font-size="7" fill="${c_pu}" opacity="0.8" text-anchor="end">p_u,max=${p_max.toFixed(0)} kN/m</text>
  <text x="${pp_x(p_max*0.6)}" y="${gok_y+12}" font-family="'DM Mono',monospace"
    font-size="7" fill="${c_pu}" text-anchor="${zugS?'end':'start'}">p_u (Grenzwert Bettung)${zugS?' · Zugfall':''}</text>
  <!-- Aushub-Begrenzung (Zugfall): z_clear-Marke + Verlust-Label -->
  ${exA ? (() => {
    const zc_y = depY(Math.min(zClear, L_emb));
    const lx = pile_r + 5;
    return `<line x1="${zugS?pile_l:pile_r}" y1="${zc_y}" x2="${lx}" y2="${zc_y}" stroke="${c_warn}" stroke-width="0.5" stroke-dasharray="1,1" opacity="0.6"/>
    <text x="${lx}" y="${zc_y-2}" font-family="'DM Mono',monospace" font-size="6.5"
      fill="${c_warn}" text-anchor="start">z_clear=${zClear.toFixed(1)}m</text>
    <text x="${lx}" y="${zc_y+8}" font-family="'DM Mono',monospace" font-size="6.5"
      fill="${c_warn}" text-anchor="start">Bruchkörper→Aushub: H_u −${(exClipRed*100).toFixed(0)}%</text>` ;
  })() : ''}
  <!-- Richtungsannotation Zug/Druck am Pfahlkopf -->
  <text x="${pile_cx}" y="${pl_ty-4}" font-family="'DM Mono',monospace" font-size="6.5"
    text-anchor="middle" fill="${zugS?c_warn:c_acc}">${zugS?'ZUG → Keil zum Aushub':'DRUCK → Keil vom Block weg'}</text>

  <!-- Block -->
  <rect x="${blk_l}" y="${blk_ty}" width="${blk_r-blk_l}" height="${blk_by-blk_ty}"
    fill="${c_acc}" fill-opacity="0.80" stroke="${c_acc}" stroke-width="1.2" rx="1"/>
  <text x="${(blk_l+blk_r)/2}" y="${(blk_ty+blk_by)/2+4}" font-family="'DM Mono',monospace"
    font-size="7" fill="white" text-anchor="middle">Block</text>

  <!-- Überdeckung ü -->
  ${G_ue > 0.05 ? `<rect x="${blk_l}" y="${gok_y}" width="${blk_r-blk_l}" height="${blk_ty-gok_y}"
    fill="${c_dim}" fill-opacity="0.20" stroke="${c_dim}" stroke-width="0.5" stroke-dasharray="2,2"/>
  <text x="${(blk_l+blk_r)/2}" y="${gok_y+(blk_ty-gok_y)/2+3}"
    font-family="'DM Mono',monospace" font-size="6" fill="${c_dim}" text-anchor="middle">ü=${G_ue.toFixed(2)}m</text>` : ''}

  <!-- Pfahl -->
  <rect x="${pile_l}" y="${pl_ty}" width="${pile_r-pile_l}" height="${pl_by-pl_ty}"
    fill="${c_acc}" fill-opacity="0.75" stroke="${c_acc}" stroke-width="1.2" rx="1"/>

  <!-- GOK -->
  <line x1="${PAD_L-5}" y1="${gok_y}" x2="${VB-PAD_R+3}" y2="${gok_y}"
    stroke="${c_on2}" stroke-width="0.9" stroke-dasharray="4,2"/>
  <text x="${PAD_L-7}" y="${gok_y-3}" font-family="'DM Mono',monospace" font-size="7"
    fill="${c_on2}" text-anchor="end">GOK</text>

  <!-- Grundwasserlinie -->
  ${hasGW && zgwS < L_emb ? (() => {
    const gy = depY(zgwS);
    return `<line x1="${PAD_L-5}" y1="${gy}" x2="${VB-PAD_R+3}" y2="${gy}"
      stroke="#5599cc" stroke-width="1.1" stroke-dasharray="5,2" opacity="0.9"/>
    <text x="${PAD_L-7}" y="${gy+3}" font-family="'DM Mono',monospace" font-size="6.5"
      fill="#5599cc" text-anchor="end">GW</text>
    <text x="${ep_xmax-2}" y="${gy-3}" font-family="'DM Mono',monospace" font-size="6.5"
      fill="#5599cc" text-anchor="end">γ'=${g2sys}</text>`;
  })() : ''}

  <!-- Aushub -->
  ${excLine}

  <!-- H Pfeil: Druckfall stösst den Pfahl vom Block weg (→), Zugfall zieht ihn hin (←) -->
  ${zugS ? `
  <line x1="${pile_l-2}" y1="${h_arr_y}" x2="${blk_r+12}" y2="${h_arr_y}"
    stroke="${c_warn}" stroke-width="1.5"/>
  <polygon points="${blk_r+6},${h_arr_y} ${blk_r+13},${h_arr_y-4} ${blk_r+13},${h_arr_y+4}"
    fill="${c_warn}"/>
  <text x="${PAD_L+4}" y="${h_arr_y-4}" font-family="'DM Mono',monospace" font-size="7.5"
    fill="${c_warn}">H=${H_pfahl_total.toFixed(1)}kN — ZUG</text>` : `
  <line x1="${PAD_L+2}" y1="${h_arr_y}" x2="${pile_l-2}" y2="${h_arr_y}"
    stroke="${c_acc}" stroke-width="1.5"/>
  <polygon points="${pile_l-2},${h_arr_y} ${pile_l-9},${h_arr_y-4} ${pile_l-9},${h_arr_y+4}"
    fill="${c_acc}"/>
  <text x="${PAD_L+4}" y="${h_arr_y-4}" font-family="'DM Mono',monospace" font-size="7.5"
    fill="${c_acc}">H=${H_pfahl_total.toFixed(1)}kN</text>`}

  <!-- H_u,1 Netto-Lateraltragfähigkeit (Resultante der p_u-Grenzhüllkurve, Schwerpunkt
       ~2/3·L), wirkt der Pfahlbewegung entgegen: Druckfall ← · Zugfall → -->
  ${(() => {
    const z_res = L_emb*2/3;
    const arr_y = depY(z_res);
    if(zugS){
      const arr_x1 = Math.max(blk_r + 4, pp_x(puF(z_res)) - 30);
      const arr_x2 = pile_l - 7;
      return `<line x1="${arr_x1}" y1="${arr_y}" x2="${arr_x2}" y2="${arr_y}"
        stroke="${c_pu}" stroke-width="1.4"/>
      <polygon points="${pile_l-2},${arr_y} ${pile_l-9},${arr_y-4} ${pile_l-9},${arr_y+4}" fill="${c_pu}"/>
      <text x="${pile_r+6}" y="${arr_y+12}" font-family="'DM Mono',monospace" font-size="7"
        fill="${c_pu}">H_u,1=${Hu_1.toFixed(1)}kN (γ_R=${gamma_R.toFixed(2)})</text>`;
    }
    const arr_x1 = Math.min(ep_xmax - 4, pp_x(puF(z_res)) + 38);
    const arr_x2 = ep_x0 + 3;
    return `<line x1="${arr_x1}" y1="${arr_y}" x2="${arr_x2}" y2="${arr_y}"
      stroke="${c_pu}" stroke-width="1.4"/>
    <polygon points="${arr_x2},${arr_y} ${arr_x2+6},${arr_y-4} ${arr_x2+6},${arr_y+4}" fill="${c_pu}"/>
    <text x="${arr_x2+8}" y="${arr_y+12}" font-family="'DM Mono',monospace" font-size="7"
      fill="${c_pu}">H_u,1=${Hu_1.toFixed(1)}kN (γ_R=${gamma_R.toFixed(2)})</text>`;
  })()}

  <!-- Tiefenskala -->
  ${depTicks}
  <text x="${PAD_L-3}" y="${PAD_T-5}" font-family="'DM Mono',monospace" font-size="6.5"
    fill="${c_xdim}" text-anchor="end">m</text>

  <!-- Dimension d -->
  <line x1="${blk_r}" y1="${gok_y-15}" x2="${pile_cx}" y2="${gok_y-15}"
    stroke="${c_on2}" stroke-width="0.8"/>
  <line x1="${blk_r}"  y1="${gok_y-19}" x2="${blk_r}"  y2="${gok_y-11}" stroke="${c_on2}" stroke-width="0.8"/>
  <line x1="${pile_cx}" y1="${gok_y-19}" x2="${pile_cx}" y2="${gok_y-11}" stroke="${c_on2}" stroke-width="0.8"/>
  <text x="${(blk_r+pile_cx)/2}" y="${gok_y-17}" font-family="'DM Mono',monospace" font-size="7.5"
    fill="${c_on2}" text-anchor="middle">d=${d_abst.toFixed(1)}m</text>

  <!-- d_krit -->
  <line x1="${blk_r}" y1="${H_VB-PAD_B+18}" x2="${Math.min(ep_xmax, blk_r + d_krit_ov*geo_sc)}" y2="${H_VB-PAD_B+18}"
    stroke="${c_ep}" stroke-width="0.9" stroke-dasharray="4,2"/>
  <text x="${blk_r + Math.min(ep_xmax-blk_r, d_krit_ov*geo_sc)/2}" y="${H_VB-PAD_B+14}"
    font-family="'DM Mono',monospace" font-size="7" fill="${c_ep}" text-anchor="middle">d_krit=${d_krit_ov.toFixed(1)}m</text>

  <!-- t / L Bemaßungen -->
  <line x1="${blk_l-10}" y1="${gok_y}" x2="${blk_l-10}" y2="${blk_by}"
    stroke="${c_on2}" stroke-width="0.8"/>
  <line x1="${blk_l-14}" y1="${gok_y}" x2="${blk_l-6}" y2="${gok_y}" stroke="${c_on2}" stroke-width="0.8"/>
  <line x1="${blk_l-14}" y1="${blk_by}" x2="${blk_l-6}" y2="${blk_by}" stroke="${c_on2}" stroke-width="0.8"/>
  <text x="${blk_l-14}" y="${(gok_y+blk_by)/2+3}" font-family="'DM Mono',monospace" font-size="7"
    fill="${c_on2}" text-anchor="end">t=${t_bl.toFixed(1)}m</text>

  <!-- Wirkungsschatten Box -->
  <rect x="${VB-PAD_R-90}" y="${PAD_T+4}" width="86" height="30" rx="3"
    fill="${r_overlap>0.02?'rgba(201,168,76,0.10)':'rgba(111,207,142,0.10)'}"
    stroke="${fOvCol}" stroke-width="0.8"/>
  <text x="${VB-PAD_R-47}" y="${PAD_T+16}" font-family="'DM Mono',monospace" font-size="9"
    text-anchor="middle" font-weight="500" fill="${fOvCol}">f_sch = ${(f_shadow ?? f_overlap).toFixed(2)}</text>
  <text x="${VB-PAD_R-47}" y="${PAD_T+27}" font-family="'DM Mono',monospace" font-size="7"
    text-anchor="middle" fill="${c_dim}">${(z_ov??0)<0.02?'Pfahl ausserhalb Keil':'Schatten bis z='+(z_ov??0).toFixed(1)+'m'}</text>

  <!-- Legende -->
  <rect x="${PAD_L}"     y="${H_VB-PAD_B+34}" width="7" height="7" fill="${c_ep}" fill-opacity="0.4" stroke="${c_ep}" stroke-width="0.7"/>
  <text x="${PAD_L+10}"  y="${H_VB-PAD_B+41}" font-family="'DM Mono',monospace" font-size="6.5" fill="${c_dim}">Rankine (Block)</text>
  <rect x="${PAD_L+82}"  y="${H_VB-PAD_B+34}" width="7" height="7" fill="${c_pu}" fill-opacity="0.20" stroke="${c_pu}" stroke-width="0.7" stroke-dasharray="2,1"/>
  <text x="${PAD_L+92}"  y="${H_VB-PAD_B+41}" font-family="'DM Mono',monospace" font-size="6.5" fill="${c_dim}">p_u (Grenzwert)</text>
  ${exA ? `<rect x="${PAD_L+178}" y="${H_VB-PAD_B+34}" width="7" height="7" fill="${c_pu}" fill-opacity="0.16" stroke="${c_pu}" stroke-width="0.7"/>
  <text x="${PAD_L+188}" y="${H_VB-PAD_B+41}" font-family="'DM Mono',monospace" font-size="6.5" fill="${c_dim}">p_u reduz. (Aushub)</text>` : ''}
  ${showOv ? `<rect x="${PAD_L+248}" y="${H_VB-PAD_B+34}" width="7" height="7" fill="${c_fail}" fill-opacity="0.4" stroke="${c_fail}" stroke-width="0.7"/>
  <text x="${PAD_L+258}" y="${H_VB-PAD_B+41}" font-family="'DM Mono',monospace" font-size="6.5" fill="${c_fail}">Überlappung</text>` : ''}

  <!-- Werte -->
  <text x="${PAD_L}" y="${H_VB-7}" font-family="'DM Mono',monospace" font-size="6.5" fill="${c_dim}">
    H_u,k=${Hu_1k?.toFixed(1)??'—'}kN · H_u,d=${Hu_1.toFixed(1)}kN · δ=${isFinite(delta_gruppe_mm)?delta_gruppe_mm.toFixed(1)+'mm':'≫ Grenzlast'} · ${isFinite(neig_mm_m)?neig_mm_m.toFixed(1)+'mm/m':'—'} · α_lat=${alpha_lat.toFixed(2)}
  </text>
</svg>`;
}

function buildSohlDiagram(r, g, wide=false){
  // Arbeite mit festem internem Koordinatensystem (VB = viewBox-Breite)
  // SVG skaliert dann per viewBox auf die verfügbare Containerbreite
  const VB = 267;  // interne Breite (÷1.5)
  const W = wide ? 334 : VB;

  const B = g.B, L = g.L;
  const ex = r.ex||0, ey = r.ey||0;
  const smax = r.smax||0, smin = r.smin||0;
  const qu = g.qu||300;
  const {c_ok,c_warn,c_fail,c_sig,c_fund,c_dim,c_on2} = _sohlColors(smax,qu);

  // Massgebende Richtung
  const domX = Math.abs(ex)/(B/6+0.001) >= Math.abs(ey)/(L/6+0.001);
  const e_dom = domX ? ex : ey;
  const B_dom = domX ? B : L;
  const lbl_dom = domX ? 'B' : 'L';
  const klaff = Math.abs(e_dom) > B_dom/6 + 0.0001;
  const b_eff = klaff ? Math.max(0.01, 3*(B_dom/2 - Math.abs(e_dom))) : B_dom;

  // Internes Layout
  const PAD=28, sc_w=VB-2*PAD;
  const sig_h_max=80;
  // q_u-Linie nur zeigen wenn σ_max > 40% von q_u (sonst riesiger Leerraum)
  const showQu = smax >= qu * 0.4;
  const sig_scale = showQu
    ? sig_h_max / Math.max(smax, qu, 0.001)
    : sig_h_max / Math.max(smax, 0.001);
  const px_smax = Math.min(sig_h_max, smax*sig_scale);
  const px_smin = klaff ? 0 : Math.min(sig_h_max, Math.max(0,smin)*sig_scale);
  const px_qu   = showQu ? Math.min(sig_h_max, qu*sig_scale) : 0;

  // Dynamische Höhe: Inhalt von oben (Titel+Pfeil=48) bis unten (Kalkzeilen+Fallabel=~110)
  const content_h = 48 + Math.max(px_smax, px_qu, 20) + 115 + (klaff?20:0);
  const H_vb = Math.round(content_h);
  const gnd_y = 48;  // Sohllinie (UK Platte)
  const fund_y = gnd_y;
  const e_px = (e_dom/B_dom)*sc_w;
  const scX_c = v => PAD+sc_w/2+(v/B_dom)*sc_w;
  const arr_x = PAD+sc_w/2+e_px;

  // Spannungsfigur
  let sig_pts, klaff_x_gap_l, klaff_x_gap_r;
  if(klaff){
    const sign = e_dom>=0 ? 1 : -1;
    const x_peak = scX_c(sign*B_dom/2);
    const x_zero = x_peak - sign*b_eff*(sc_w/B_dom);
    sig_pts = sign>0
      ? `${x_zero},${gnd_y} ${x_peak},${gnd_y} ${x_peak},${gnd_y+px_smax}`
      : `${x_peak},${gnd_y} ${x_zero},${gnd_y} ${x_peak},${gnd_y+px_smax}`;
    klaff_x_gap_l = sign>0 ? PAD : x_zero;
    klaff_x_gap_r = sign>0 ? x_zero : PAD+sc_w;
  } else {
    const px_l = e_dom>=0 ? px_smin : px_smax;
    const px_r = e_dom>=0 ? px_smax : px_smin;
    sig_pts = `${PAD},${gnd_y} ${PAD+sc_w},${gnd_y} ${PAD+sc_w},${gnd_y+px_r} ${PAD},${gnd_y+px_l}`;
  }
  const lbl_smax_x = e_dom>=0 ? PAD+sc_w-2 : PAD+2;
  const lbl_smin_x = e_dom>=0 ? PAD+2 : PAD+sc_w-2;
  const anc_max = e_dom>=0 ? 'end':'start';
  const anc_min = e_dom>=0 ? 'start':'end';
  const qu_y = gnd_y+px_qu;
  const caseLabel = klaff ? 'Klaffende Sohlfuge'
    : (Math.abs(ex)<0.001&&Math.abs(ey)<0.001) ? 'Mittige Belastung'
    : 'Vollständig überdrückt';
  const nLines=8;

  // Im Normal-Modus: responsive via viewBox (passt sich der Containerbreite an)
  // Im Wide-Modus: absolute Grösse 500px
  const svgAttrs = wide
    ? `width="${W}" height="${H_vb}"`
    : `width="100%" viewBox="0 0 ${VB} ${H_vb}" preserveAspectRatio="xMidYMid meet"`;

  return `<svg xmlns="http://www.w3.org/2000/svg" ${svgAttrs}
    style="display:block;font-family:var(--f-mono)">
  <defs>
    <marker id="arsd" markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto">
      <polygon points="0,0 5,2.5 0,5" fill="${c_on2}"/></marker>
    <pattern id="klaff-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="6" stroke="${c_fail}" stroke-width="1.2" opacity="0.35"/>
    </pattern>
  </defs>
  <!-- Titel -->
  <text x="${VB/2}" y="11" text-anchor="middle" font-size="8.5" fill="${c_dim}" letter-spacing="0.06em">SCHNITT  (${lbl_dom}-Richtung)</text>
  <!-- q_u Referenz (nur wenn σ_max ≥ 40% von q_u) -->
  ${showQu ? `
  <line x1="${PAD}" y1="${qu_y}" x2="${PAD+sc_w}" y2="${qu_y}" stroke="${c_warn}" stroke-width="0.8" stroke-dasharray="3,2" opacity="0.7"/>
  <text x="${PAD+sc_w+2}" y="${qu_y+3}" font-size="7.5" fill="${c_warn}">q_u</text>
  <text x="${PAD+4}" y="${qu_y-4}" font-size="7.5" fill="${c_warn}" opacity="0.85">q_u = ${qu.toFixed(0)} kPa  (zul. Sohlspannung)</text>
  ` : `
  <text x="${PAD+4}" y="${gnd_y+px_smax+38}" font-size="7.5" fill="${c_warn}" opacity="0.75">q_u = ${qu.toFixed(0)} kPa  (η = ${r.etaSIG?r.etaSIG.toFixed(1):'—'})</text>
  `}
  <!-- Klaffende Fuge: Schraffur + Label -->
  ${klaff ? `
  <rect x="${klaff_x_gap_l}" y="${fund_y}" width="${klaff_x_gap_r-klaff_x_gap_l}" height="${fund_h}"
    fill="url(#klaff-hatch)" opacity="0.7"/>
  <rect x="${klaff_x_gap_l}" y="${fund_y}" width="${klaff_x_gap_r-klaff_x_gap_l}" height="${fund_h}"
    fill="none" stroke="${c_fail}" stroke-width="0.8" stroke-dasharray="2,2"/>
  <line x1="${klaff_x_gap_l}" y1="${gnd_y}" x2="${klaff_x_gap_l}" y2="${gnd_y+px_smax+12}"
    stroke="${c_fail}" stroke-width="0.8" stroke-dasharray="2,2" opacity="0.6"/>
  <text x="${(klaff_x_gap_l+klaff_x_gap_r)/2}" y="${gnd_y+14}" text-anchor="middle"
    font-size="7" fill="${c_fail}">Klaff.</text>
  <text x="${(klaff_x_gap_l+klaff_x_gap_r)/2}" y="${gnd_y+23}" text-anchor="middle"
    font-size="7" fill="${c_fail}">b=${(B_dom-b_eff).toFixed(2)}m</text>
  ` : ''}
  <!-- Spannungsfigur -->
  <polygon points="${sig_pts}" fill="${c_sig}" opacity="0.32"/>
  <polygon points="${sig_pts}" fill="none" stroke="${c_sig}" stroke-width="1.3"/>
  <!-- Erdlinie -->
  <line x1="${PAD-8}" y1="${gnd_y}" x2="${PAD+sc_w+8}" y2="${gnd_y}" stroke="${c_dim}" stroke-width="1.2"/>
  ${Array.from({length:nLines},(_,i)=>{const xh=PAD-6+i*(sc_w+16)/(nLines-1);
    return `<line x1="${xh}" y1="${gnd_y}" x2="${xh-6}" y2="${gnd_y+7}" stroke="${c_dim}" stroke-width="0.8" opacity="0.4"/>`;}).join('')}
  <!-- Sohle (UK Platte) — dicker Strich -->
  <line x1="${PAD-4}" y1="${gnd_y}" x2="${PAD+sc_w+4}" y2="${gnd_y}"
    stroke="${c_fund}" stroke-width="4" stroke-linecap="round"/>
  <!-- N-Pfeil -->
  <line x1="${arr_x}" y1="14" x2="${arr_x}" y2="${gnd_y-3}"
    stroke="${c_on2}" stroke-width="1.4" marker-end="url(#arsd)"/>
  <text x="${arr_x+3}" y="23" font-size="8" fill="${c_on2}">N_d=${r.Nd?r.Nd.toFixed(0):'—'} kN</text>
  <!-- e-Bemaßung -->
  ${Math.abs(e_dom)>0.005?`
  <line x1="${PAD+sc_w/2}" y1="${fund_y-7}" x2="${arr_x}" y2="${fund_y-7}" stroke="${c_warn}" stroke-width="0.8"/>
  <line x1="${PAD+sc_w/2}" y1="${fund_y-10}" x2="${PAD+sc_w/2}" y2="${fund_y-4}" stroke="${c_warn}" stroke-width="0.8"/>
  <line x1="${arr_x}" y1="${fund_y-10}" x2="${arr_x}" y2="${fund_y-4}" stroke="${c_warn}" stroke-width="0.8"/>
  <text x="${(PAD+sc_w/2+arr_x)/2}" y="${fund_y-9}" text-anchor="middle" font-size="7" fill="${c_warn}">e=${Math.abs(e_dom).toFixed(3)}m</text>
  `:''}
  <!-- σ Labels: außerhalb der grünen Fläche (unterhalb mit Verbindungslinie) -->
  <!-- σ_max: Verbindungslinie von Spitze Dreieck nach unten -->
  <line x1="${lbl_smax_x}" y1="${gnd_y+px_smax}" x2="${lbl_smax_x}" y2="${gnd_y+px_smax+14}"
    stroke="${c_sig}" stroke-width="0.9" opacity="0.7"/>
  <text x="${lbl_smax_x}" y="${gnd_y+px_smax+24}" text-anchor="${anc_max}"
    font-size="9" fill="${c_sig}" font-weight="600">σ_max = ${smax.toFixed(1)} kPa</text>
  ${!klaff&&smin>0.5?`
  <line x1="${lbl_smin_x}" y1="${gnd_y+px_smin}" x2="${lbl_smin_x}" y2="${gnd_y+px_smax+14}"
    stroke="${c_dim}" stroke-width="0.9" opacity="0.6"/>
  <text x="${lbl_smin_x}" y="${gnd_y+px_smax+24}" text-anchor="${anc_min}"
    font-size="9" fill="${c_dim}" font-weight="500">σ_min = ${smin.toFixed(1)} kPa</text>
  `:''}
  ${klaff?`
  <text x="${lbl_smax_x}" y="${gnd_y+px_smax+36}" text-anchor="${anc_max}"
    font-size="8" fill="${c_fail}">σ_min = 0  (klaff)</text>
  `:''}

  <!-- Berechnungszeilen: σ₀, Δσ, η -->
  ${(()=>{
    const s0_ = r.s0 || (r.Nd/((g.B||1)*(g.L||1)));
    const dsig = smax - s0_;
    const A_ = (g.B||1)*(g.L||1);
    const ly = gnd_y + px_smax + 46;
    return `
  <line x1="${PAD}" y1="${ly-4}" x2="${PAD+sc_w}" y2="${ly-4}" stroke="var(--ol)" stroke-width="0.6" opacity="0.5"/>
  <text x="${PAD}" y="${ly+8}" font-size="8" fill="${c_dim}">σ₀ = N_d/A = ${r.Nd?r.Nd.toFixed(1):'—'}/${A_.toFixed(2)} = ${s0_.toFixed(1)} kPa</text>
  <text x="${PAD}" y="${ly+20}" font-size="8" fill="${c_dim}">Δσ = σ_max − σ₀ = ${dsig.toFixed(1)} kPa  (aus Moment)</text>
  <text x="${PAD}" y="${ly+32}" font-size="8" fill="${c_sig}">η = q_u / σ_max = ${(g.qu||300).toFixed(0)} / ${smax.toFixed(1)} = ${r.etaSIG?r.etaSIG.toFixed(2):'—'}</text>`;
  })()}

  <!-- Fall-Label -->
  <text x="${VB/2}" y="${H_vb-5}" text-anchor="middle" font-size="9" fill="${klaff?c_fail:c_dim}" font-style="italic">
    ${caseLabel}${klaff?' — b_eff = '+b_eff.toFixed(2)+' m':''}
  </text>
</svg>`;
}

// ── 2. KERNNACHWEIS-DIAGRAMM (Grundriss) ────────────────────────────────
function buildKippDiagram(r, g, wide=false){
  const B = g.B, L = g.L;
  const ex_k = r.ex_kipp !== undefined ? r.ex_kipp : (r.ex||0);
  const ey_k = r.ey_kipp !== undefined ? r.ey_kipp : (r.ey||0);
  const inKern_k = Math.abs(ex_k)<=B/6+0.0001 && Math.abs(ey_k)<=L/6+0.0001;
  const etaKx = (B/6)/Math.max(0.001,Math.abs(ex_k));
  const etaKy = (L/6)/Math.max(0.001,Math.abs(ey_k));
  const eta = Math.min(etaKx,etaKy);
  const {c_ok,c_fail,c_fund,c_dim,c_on2} = _sohlColors(0,300);

  // Layout: Diagramm links, Legende rechts (nebeneinander wenn wide)
  const W = wide ? 750 : 444;  // ×1.5
  const diagW = wide ? 510 : W;
  const legX  = diagW + 14;

  // Skalierung: Grundriss passt in diagW × verfügbare Höhe
  const sc = Math.min((diagW-50)/(B||1), 240/(L||1), wide?82:63);  // ×1.5
  const H  = wide ? 390 : Math.round(sc*L + 98);  // ×1.5
  const pl_bpx = B*sc, pl_lpx = L*sc;
  const pl_cx = diagW/2;
  const pl_cy = H/2 + 5;
  const pl_x0 = pl_cx-pl_bpx/2, pl_y0 = pl_cy-pl_lpx/2;
  const isFlach = !r.inKern && r.eta_klaf !== undefined || (r.eta_klaf !== undefined && isFinite(r.eta_klaf));
  const useKlaf = r.eta_klaf !== undefined && isFinite(r.eta_klaf);
  const kb = (B/6)*sc, kl = (L/6)*sc;
  // SIA 267 Ellipse: Halbachsen B/3 × L/3
  const ke_x = (B/3)*sc, ke_y = (L/3)*sc;
  const kern_pts=`${pl_cx},${pl_cy-kl} ${pl_cx+kb},${pl_cy} ${pl_cx},${pl_cy+kl} ${pl_cx-kb},${pl_cy}`;
  const ep_x = pl_cx + ex_k*sc;
  const ep_y = pl_cy + ey_k*sc;
  const klaf_ok = useKlaf ? r.eta_klaf >= 1 : inKern_k;
  const ep_col = (useKlaf ? klaf_ok : inKern_k) ? c_ok : c_fail;
  const fs = wide ? 9 : 7.5;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"
    style="display:block;font-family:var(--f-mono)">
  <!-- Titel -->
  <text x="${diagW/2}" y="11" text-anchor="middle" font-size="8.5" fill="${c_dim}" letter-spacing="0.06em">GRUNDRISS  (Kernnachweis · Typ 1)</text>

  <!-- Fundament -->
  <rect x="${pl_x0}" y="${pl_y0}" width="${pl_bpx}" height="${pl_lpx}"
    fill="${c_fund}" fill-opacity="0.18" stroke="${c_fund}" stroke-width="1.4"/>
  <!-- Mittellinien -->
  <line x1="${pl_x0-5}" y1="${pl_cy}" x2="${pl_x0+pl_bpx+5}" y2="${pl_cy}"
    stroke="${c_dim}" stroke-width="0.6" stroke-dasharray="5,2.5" opacity="0.45"/>
  <line x1="${pl_cx}" y1="${pl_y0-5}" x2="${pl_cx}" y2="${pl_y0+pl_lpx+5}"
    stroke="${c_dim}" stroke-width="0.6" stroke-dasharray="5,2.5" opacity="0.45"/>
  <!-- Kern (1. Kernweite — Referenz, dünn gestrichelt) -->
  <polygon points="${kern_pts}" fill="none" stroke="${c_ok}" stroke-width="0.8" stroke-dasharray="3,2" opacity="0.4"/>
  ${useKlaf ? `
  <!-- SIA 267 Ellipse: Halbachsen B/3 × L/3 -->
  <ellipse cx="${pl_cx}" cy="${pl_cy}" rx="${ke_x}" ry="${ke_y}"
    fill="${c_ok}" fill-opacity="0.14" stroke="${c_ok}" stroke-width="1.5"/>
  <line x1="${pl_cx}" y1="${pl_cy}" x2="${pl_cx+ke_x}" y2="${pl_cy}" stroke="${c_ok}" stroke-width="0.8" stroke-dasharray="2,2"/>
  <line x1="${pl_cx}" y1="${pl_cy}" x2="${pl_cx}" y2="${pl_cy-ke_y}" stroke="${c_ok}" stroke-width="0.8" stroke-dasharray="2,2"/>
  <text x="${pl_cx+ke_x/2}" y="${pl_cy-3}" text-anchor="middle" font-size="${fs}" fill="${c_ok}">B/3=${(B/3).toFixed(2)}m</text>
  <text x="${pl_cx+ke_x+3}" y="${pl_cy-ke_y/2+3}" font-size="${fs}" fill="${c_ok}">L/3=${(L/3).toFixed(2)}m</text>
  ` : `
  <!-- Kernweite (B/6, L/6) -->
  <line x1="${pl_cx}" y1="${pl_cy}" x2="${pl_cx+kb}" y2="${pl_cy}" stroke="${c_ok}" stroke-width="0.8" stroke-dasharray="2,2"/>
  <line x1="${pl_cx}" y1="${pl_cy}" x2="${pl_cx}" y2="${pl_cy-kl}" stroke="${c_ok}" stroke-width="0.8" stroke-dasharray="2,2"/>
  <text x="${pl_cx+kb/2}" y="${pl_cy-3}" text-anchor="middle" font-size="${fs}" fill="${c_ok}">B/6=${(B/6).toFixed(2)}m</text>
  <text x="${pl_cx+kb+3}" y="${pl_cy-kl/2+3}" font-size="${fs}" fill="${c_ok}">L/6=${(L/6).toFixed(2)}m</text>
  `}
  <!-- Achsenbeschriftung -->
  <text x="${pl_x0+pl_bpx+5}" y="${pl_cy+4}" font-size="${fs+1}" fill="${c_dim}">x</text>
  <text x="${pl_cx+4}" y="${pl_y0-3}" font-size="${fs+1}" fill="${c_dim}">y</text>
  <!-- B / L Bemaßung -->
  <line x1="${pl_x0}" y1="${pl_y0+pl_lpx+8}" x2="${pl_x0+pl_bpx}" y2="${pl_y0+pl_lpx+8}" stroke="${c_dim}" stroke-width="0.7"/>
  <text x="${pl_cx}" y="${pl_y0+pl_lpx+18}" text-anchor="middle" font-size="${fs}" fill="${c_dim}">B = ${B} m</text>
  <line x1="${pl_x0-10}" y1="${pl_y0}" x2="${pl_x0-10}" y2="${pl_y0+pl_lpx}" stroke="${c_dim}" stroke-width="0.7"/>
  <text x="${pl_x0-20}" y="${pl_cy+3}" text-anchor="middle" font-size="${fs}" fill="${c_dim}" transform="rotate(-90,${pl_x0-20},${pl_cy})">L = ${L} m</text>
  <!-- Ausmitte-Punkt -->
  <circle cx="${ep_x}" cy="${ep_y}" r="${wide?6:4.5}" fill="${ep_col}" opacity="0.9"/>
  <circle cx="${ep_x}" cy="${ep_y}" r="${wide?6:4.5}" fill="none" stroke="${ep_col}" stroke-width="1.2"/>
  <!-- e-Koordinaten neben dem Punkt -->
  <text x="${ep_x+(ep_x>pl_cx?8:-8)}" y="${ep_y-6}"
    text-anchor="${ep_x>pl_cx?'start':'end'}"
    font-size="${fs}" fill="${ep_col}" font-weight="500">e(${ex_k.toFixed(3)}, ${ey_k.toFixed(3)})</text>

  ${wide ? `<!-- Trennlinie -->
  <line x1="${legX-4}" y1="18" x2="${legX-4}" y2="${H-10}" stroke="var(--ol)" stroke-width="0.8" opacity="0.5"/>` : ''}

  <!-- Legende / Status rechts (wide) oder unten (normal) -->
  ${wide ? `
  <text x="${legX}" y="32" font-size="9" fill="${c_dim}" font-weight="500">Nachweis</text>
  <text x="${legX}" y="48" font-size="8.5" fill="${ep_col}" font-weight="500">${useKlaf?(klaf_ok?'Kippnachweis erf.':'Kippnachweis n.e.'):(inKern_k?'Im Kern':'Ausserhalb Kern')}</text>
  <text x="${legX}" y="64" font-size="11" fill="${ep_col}" font-weight="500">η = ${isFinite(useKlaf?r.eta_klaf:eta)&&(useKlaf?r.eta_klaf:eta)<99?(useKlaf?r.eta_klaf:eta).toFixed(2):'—'}</text>
  <line x1="${legX}" y1="74" x2="${W-12}" y2="74" stroke="var(--ol)" stroke-width="0.6" opacity="0.5"/>
  <text x="${legX}" y="90" font-size="8.5" fill="${c_dim}">Typ-1-Faktoren (Kippen):</text>
  <text x="${legX}" y="104" font-size="8" fill="var(--on2)">γ_G,sup = ${+gi('lw_G1_sup')||1.20}  ·  γ_G,inf = ${+gi('lw_G1_inf')||0.80}</text>
  <text x="${legX}" y="118" font-size="8" fill="var(--on2)">γ_Q  = ${+gi('lw_Q1')||1.50}</text>
  <line x1="${legX}" y1="128" x2="${W-12}" y2="128" stroke="var(--ol)" stroke-width="0.6" opacity="0.5"/>
  <text x="${legX}" y="143" font-size="8.5" fill="${c_dim}">Ausmitten (Typ 1):</text>
  <text x="${legX}" y="157" font-size="8" fill="${ep_col}">e_x = ${ex_k.toFixed(3)} m</text>
  <text x="${legX}" y="170" font-size="8" fill="${ep_col}">e_y = ${ey_k.toFixed(3)} m</text>
  <text x="${legX}" y="184" font-size="8" fill="${c_dim}">${useKlaf?'Ellipse B/3 = '+(B/3).toFixed(3)+' m':'Kern B/6 = '+(B/6).toFixed(3)+' m'}</text>
  <text x="${legX}" y="197" font-size="8" fill="${c_dim}">${useKlaf?'Ellipse L/3 = '+(L/3).toFixed(3)+' m':'Kern L/6 = '+(L/6).toFixed(3)+' m'}</text>
  <text x="${legX}" y="211" font-size="8" fill="${c_dim}">${useKlaf?'(ea/B)²+(eb/L)² = '+(r.klaf_val!==undefined?r.klaf_val.toFixed(4):'—'):'η_x = '+(etaKx<99?etaKx.toFixed(2):'—')+'  ·  η_y = '+(etaKy<99?etaKy.toFixed(2):'—')}</text>
  ` : `
  <text x="${diagW/2}" y="${H-5}" text-anchor="middle" font-size="8.5"
    fill="${ep_col}" font-weight="500">${useKlaf?(klaf_ok?'Kippnachweis erf.':'Kippnachweis n.e.'):(inKern_k?'Im Kern':'Ausserhalb')} — η =${isFinite(useKlaf?r.eta_klaf:eta)&&(useKlaf?r.eta_klaf:eta)<99?(useKlaf?r.eta_klaf:eta).toFixed(2):'—'}</text>
  `}
</svg>`;
}

// ── 3. GRUNDBRUCH-DIAGRAMM (effektive Fläche Meyerhof) ──────────────────
function buildGrundbDiagram(r, g, wide=false){
  const W = wide ? 750 : 444;  // ×1.5
  const B = g.B, L = g.L;
  const ex = r.ex||0, ey = r.ey||0;
  const Be = r.Be||B, Le = r.Le||L;
  const {c_ok,c_warn,c_fail,c_fund,c_dim} = _sohlColors(0,300);
  const c_eff = '#7bc4a0';  // effektive Fläche (grün)

  // Flächenreduktion in %
  const redPct = Math.round((1 - (Be*Le)/(B*L))*100);

  // Layout: Diagramm links, Legende rechts (wide) oder unten (normal)
  const diagW = wide ? 450 : W;  // ×1.5
  const legX  = diagW + 14;
  const PAD = 45;  // ×1.5

  // Skalierung & dynamische Höhe
  const sc = Math.min((diagW-2*PAD)/(B||1), 225/(L||1), wide?90:68);  // ×1.5
  const pl_bpx = B*sc, pl_lpx = L*sc;
  const H = wide ? 330 : Math.round(pl_lpx + 113);  // ×1.5
  const pl_cx = diagW/2, pl_cy = H/2 + 5;
  const pl_x0 = pl_cx - pl_bpx/2, pl_y0 = pl_cy - pl_lpx/2;

  // Effektive Fläche: Meyerhof — zentriert auf Lastangriffspunkt
  const be_px = Be*sc, le_px = Le*sc;
  // Lastangriffspunkt = pl_cx + ex*sc, pl_cy + ey*sc
  const load_x = pl_cx + ex*sc, load_y = pl_cy + ey*sc;
  const eff_x0 = load_x - be_px/2, eff_y0 = load_y - le_px/2;

  // Abgeschnittene Streifen (Meyerhof: symmetrisch zur Lastachse)
  const strip_bx = (B - Be)/2 * sc;  // Streifen links und rechts
  const strip_ly = (L - Le)/2 * sc;  // Streifen oben und unten

  const fs = wide ? 9 : 7.5;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"
    style="display:block;font-family:var(--f-mono)">
  <defs>
    <pattern id="strip-hatch" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="5" stroke="${c_dim}" stroke-width="1" opacity="0.3"/>
    </pattern>
  </defs>
  <!-- Titel -->
  <text x="${diagW/2}" y="11" text-anchor="middle" font-size="8.5" fill="${c_dim}" letter-spacing="0.06em">GRUNDRISS  (Meyerhof — wirksame Fläche)</text>

  <!-- Volles Fundament (Hintergrund) -->
  <rect x="${pl_x0}" y="${pl_y0}" width="${pl_bpx}" height="${pl_lpx}"
    fill="${c_fund}" fill-opacity="0.12" stroke="${c_fund}" stroke-width="1.2" stroke-dasharray="4,2"/>

  <!-- Abgeschnittene Streifen (schraffiert) -->
  ${strip_bx > 0.5 ? `
  <rect x="${pl_x0}" y="${pl_y0}" width="${strip_bx}" height="${pl_lpx}" fill="url(#strip-hatch)"/>
  <rect x="${pl_x0+pl_bpx-strip_bx}" y="${pl_y0}" width="${strip_bx}" height="${pl_lpx}" fill="url(#strip-hatch)"/>` : ''}
  ${strip_ly > 0.5 ? `
  <rect x="${pl_x0}" y="${pl_y0}" width="${pl_bpx}" height="${strip_ly}" fill="url(#strip-hatch)"/>
  <rect x="${pl_x0}" y="${pl_y0+pl_lpx-strip_ly}" width="${pl_bpx}" height="${strip_ly}" fill="url(#strip-hatch)"/>` : ''}

  <!-- Effektive Fläche B'×L' -->
  <rect x="${eff_x0}" y="${eff_y0}" width="${be_px}" height="${le_px}"
    fill="${c_eff}" fill-opacity="0.28" stroke="${c_eff}" stroke-width="1.8"/>

  <!-- Mittellinien -->
  <line x1="${pl_x0-4}" y1="${pl_cy}" x2="${pl_x0+pl_bpx+4}" y2="${pl_cy}"
    stroke="${c_dim}" stroke-width="0.5" stroke-dasharray="4,2" opacity="0.35"/>
  <line x1="${pl_cx}" y1="${pl_y0-4}" x2="${pl_cx}" y2="${pl_y0+pl_lpx+4}"
    stroke="${c_dim}" stroke-width="0.5" stroke-dasharray="4,2" opacity="0.35"/>

  <!-- Lastangriffspunkt -->
  <circle cx="${load_x}" cy="${load_y}" r="3.5" fill="${c_warn}" opacity="0.9"/>
  <line x1="${pl_cx}" y1="${pl_cy}" x2="${load_x}" y2="${load_y}"
    stroke="${c_warn}" stroke-width="0.8" stroke-dasharray="2,2" opacity="0.7"/>

  <!-- B / L Bemaßung (voll) -->
  <line x1="${pl_x0}" y1="${pl_y0+pl_lpx+8}" x2="${pl_x0+pl_bpx}" y2="${pl_y0+pl_lpx+8}"
    stroke="${c_fund}" stroke-width="0.7"/>
  <text x="${pl_cx}" y="${pl_y0+pl_lpx+17}" text-anchor="middle" font-size="${fs}" fill="${c_fund}">B=${B}m</text>
  <text x="${pl_x0-20}" y="${pl_cy+3}" text-anchor="middle" font-size="${fs}" fill="${c_fund}"
    transform="rotate(-90,${pl_x0-20},${pl_cy})">L=${L}m</text>

  <!-- B' / L' Bemaßung (eff.) -->
  <line x1="${eff_x0}" y1="${eff_y0-7}" x2="${eff_x0+be_px}" y2="${eff_y0-7}"
    stroke="${c_eff}" stroke-width="0.9" marker-start="url(#)" marker-end="url(#)"/>
  <text x="${load_x}" y="${eff_y0-9}" text-anchor="middle" font-size="${fs}" fill="${c_eff}" font-weight="500">B'=${Be.toFixed(2)}m</text>
  <text x="${eff_x0+be_px+4}" y="${load_y+3}" font-size="${fs}" fill="${c_eff}" font-weight="500">L'=${Le.toFixed(2)}m</text>

  <!-- Achsen -->
  <text x="${pl_x0+pl_bpx+4}" y="${pl_cy+4}" font-size="${fs+1}" fill="${c_dim}">x</text>
  <text x="${pl_cx+4}" y="${pl_y0-2}" font-size="${fs+1}" fill="${c_dim}">y</text>

  ${wide ? `
  <!-- Trennlinie -->
  <line x1="${legX-4}" y1="18" x2="${legX-4}" y2="${H-10}" stroke="var(--ol)" stroke-width="0.8" opacity="0.5"/>
  <!-- Legende -->
  <text x="${legX}" y="30" font-size="9" fill="${c_dim}" font-weight="500">Meyerhof-Reduktion</text>
  <rect x="${legX}" y="38" width="10" height="10" fill="${c_eff}" fill-opacity="0.35" stroke="${c_eff}" stroke-width="1.2"/>
  <text x="${legX+14}" y="47" font-size="8.5" fill="${c_dim}">Wirksam B'×L'</text>
  <rect x="${legX}" y="54" width="10" height="10" fill="url(#strip-hatch)"/>
  <text x="${legX+14}" y="63" font-size="8.5" fill="${c_dim}">Abgemindert</text>
  <line x1="${legX}" y1="74" x2="${W-12}" y2="74" stroke="var(--ol)" stroke-width="0.6" opacity="0.5"/>
  <text x="${legX}" y="88" font-size="8.5" fill="${c_eff}" font-weight="500">B' = ${Be.toFixed(3)} m</text>
  <text x="${legX}" y="102" font-size="8.5" fill="${c_eff}" font-weight="500">L' = ${Le.toFixed(3)} m</text>
  <text x="${legX}" y="116" font-size="8" fill="${c_dim}">A' = ${(Be*Le).toFixed(3)} m²</text>
  <text x="${legX}" y="130" font-size="8" fill="${c_dim}">A  = ${(B*L).toFixed(3)} m²</text>
  <line x1="${legX}" y1="140" x2="${W-12}" y2="140" stroke="var(--ol)" stroke-width="0.6" opacity="0.5"/>
  <text x="${legX}" y="154" font-size="8" fill="${c_dim}">e_x = ${ex.toFixed(3)} m</text>
  <text x="${legX}" y="168" font-size="8" fill="${c_dim}">e_y = ${ey.toFixed(3)} m</text>
  <line x1="${legX}" y1="178" x2="${W-12}" y2="178" stroke="var(--ol)" stroke-width="0.6" opacity="0.5"/>
  <text x="${legX}" y="192" font-size="9" fill="${redPct>30?c_fail:redPct>15?c_warn:c_ok}" font-weight="500">−${redPct}% Fläche</text>
  <text x="${legX}" y="206" font-size="8.5" fill="${c_dim}">R_d = ${r.Rd?r.Rd.toFixed(1):'—'} kPa</text>
  ` : `
  <!-- Status unten -->
  <text x="${diagW/2}" y="${H-16}" text-anchor="middle" font-size="8" fill="${c_dim}">
    B'=${Be.toFixed(2)}m · L'=${Le.toFixed(2)}m · A'=${(Be*Le).toFixed(2)}m²
  </text>
  <text x="${diagW/2}" y="${H-4}" text-anchor="middle" font-size="8"
    fill="${redPct>30?c_fail:redPct>15?c_warn:c_ok}" font-weight="500">−${redPct}% wirksame Fläche</text>
  `}
</svg>`;
}

