// BlockCalc — js/diagramm-gzt.js
// GZT-Diagramm nach Steckner Bild 4 (2D-SVG). EINE Quelle für App (Panel, Bericht) und Handbuch —
// die Datei wird von index.html UND handbuch.html geladen. Die Funktion ist eigenständig: sie
// liest nur ihre Argumente (Ergebnis r, Geometrie g) und keine Eingabefelder oder Einstellungen.
function buildGZTDiagram(r, g, wide=false, charMode=false) {
  const W = wide ? 500 : 296;
  const t    = g.Hb;
  const uberd = g.uberd || 0;
  const y    = r.y_NL_GZT;
  const B    = g.B;
  const Hkopf = g.Hkopf || 0;
  const Bk    = g.Bk || B;
  const phi_k = r.phi_k_GZT || 0;

  // Einwirkungen
  const useX   = Math.abs(r.Hxd||0) >= Math.abs(r.Hyd||0);
  const H_crit = useX ? Math.abs(r.Hxd||0) : Math.abs(r.Hyd||0);
  const N_crit = r.Nd || 0;
  const M_ok   = useX
    ? Math.abs((r.Mxd||0) - (r.Hxd||0)*t)
    : Math.abs((r.Myd||0) - (r.Hyd||0)*t);

  const sc    = W / 296;
  const botM  = Math.round(74 * sc);   // Platz für Sohldruckblock p_u + N_u/R_u + u/x-Masse (Steckner Bild 4)
  // Schritt 1: approx pxPerM — Anteil Kopf über GOK (H_Kopf ab OK-Block, OK-Block = ü unter GOK)
  const approxPxPerM = (wide ? 110 : 65) * sc;
  const headAboveGOK_approx = Math.max(0, Hkopf - uberd) * approxPxPerM;
  // topM: Platz für Kopf-über-GOK + 55px für Lastvektoren (min 90px)
  const topM  = Math.round(Math.max(90 * sc, headAboveGOK_approx + 55 * sc));
  // SVG-Höhe wächst mit topM
  const H_base = wide ? 720 : 340;
  const H      = H_base + Math.max(0, topM - Math.round(90 * sc));
  const drawH  = H - topM - botM;
  const pxPerM = drawH / t;

  // fundW proportional zu tatsächlichem B/t-Verhältnis
  const fundW = Math.round(Math.min(100*sc, Math.max(40*sc, pxPerM * B * 0.55)));
  const cx = W / 2;
  const fundL = cx - fundW/2, fundR = cx + fundW/2;
  const diagW = Math.round(58*sc);

  const h_nl  = Math.max(0.01, t - y);
  const nlY   = topM + (t - y) * pxPerM;
  const ukY   = topM + t * pxPerM;
  const okbY  = topM + uberd * pxPerM;  // OK-Block (ü unter GOK)

  // Fundamentkopf: H_Kopf ab OK-Block gemessen → okKopfY = okbY - headH
  const headH   = Math.round(Hkopf * pxPerM);
  const headW   = Math.round(fundW * (Bk / B));
  const okKopfY = okbY - headH;  // OK-Kopf (kann über oder unter GOK liegen)

  const col = {
    fund:'var(--s3)', ea:'var(--dim)', ew:'var(--on2)',
    ep:'var(--acc)', e0:'var(--xdim)', nl:'var(--warn)',
    dim:'var(--dim)', gok:'var(--ol)', line:'var(--ol2)',
    ru:'var(--ok)', nu:'var(--on2)'
  };

  // Einheitsspannungen an Schlüsseltiefen (Design-Werte)
  const gs_   = r.gs_GZT  || 18;
  const Ka_k  = r.Ka_GZT  || 0.333;
  const Kph_  = r.Kph_GZT || 3.0;
  const K0_   = r.K0_GZT  || 0.5;
  const cd_   = r.cd_GZT  || 0;
  const gEa_  = r.gEa_GZT || 1.35;
  const gEp_  = r.gEp_GZT || 1.40;
  const mob_  = (r.mobEff_GZT != null ? r.mobEff_GZT : (r.mob_GZT || 0.25));   // folgt der mob-Option
  // Aktiver Einheitsdruck (Design oder charakteristisch)
  const fEa = charMode ? 1.0 : gEa_;
  const fEp = charMode ? 1.0 : gEp_;
  function sigA(z){ return Math.max(0, Ka_k*gs_*z*fEa - 2*cd_*Math.sqrt(Ka_k)*fEa); }
  const Kmob_ = charMode ? (K0_ + mob_*(Kph_ - K0_)) : (K0_ + mob_*(Kph_ - K0_)) / gEp_;
  function sigPm(z){ return Math.max(0, Kmob_*gs_*z); }
  function sigEp(z){ return Math.max(0, Kph_*gs_*z/fEp); }                 // λ_p  — über NL
  const Kpp_ = r.Kpp_GZT || 1.866;
  function sigEpp(z){ return Math.max(0, Kpp_*gs_*z/fEp); }                // λ'_p — unter NL (Gl.29)

  // Tiefe NL von GOK
  const z_nl = t - y;   // = h_nl
  const z_okb = uberd;

  // Breiten der Trapeze proportional zu Spannungen normiert auf diagW
  // Normierung: maximaler Druck an UK (passiv, voller Wert)
  const sigMax = Math.max(sigA(t), sigEp(z_okb), sigEpp(t), sigPm(z_nl), 0.1);
  function sw(sig){ return Math.max(0, (sig/sigMax)*diagW); }

  const eaX = fundL - 6;
  const ewX = fundR + 6;

  // ── LINKS: Ea (OK-Block → NL) + E'p (NL → UK) ──────────────────────────
  // Ea: Formel 31 — Dreieck/Trapez nur bis NL (Höhe h = D-y)
  const eaTopW = sw(sigA(z_okb));
  const eaW    = sw(sigA(z_nl));     // Breite bei NL (aktiver Druck bei NL-Tiefe)
  const ea_pts = eaTopW < 1
    ? `${eaX},${okbY} ${eaX-eaW},${nlY} ${eaX},${nlY}`
    : `${eaX},${okbY} ${eaX-eaTopW},${okbY} ${eaX-eaW},${nlY} ${eaX},${nlY}`;

  // E'p links: Formel 33 — Trapez NL→UK, Kph (Sprung bei NL: Kph >> Ka, deutlich sichtbar)
  const epbTopW_L = sw(sigEpp(z_nl));
  const epbBotW_L = Math.min(diagW*1.8, sw(sigEpp(t)));
  const epb_L_pts = `${eaX},${nlY} ${eaX-epbTopW_L},${nlY} ${eaX-epbBotW_L},${ukY} ${eaX},${ukY}`;

  // ── RECHTS: Ep_voll (gestrichelt) + Ew (mobilisiert, gefüllt) + E'0 (Ruhedruck) ─
  // Ep_full über NL: volle passive Fläche (gestrichelt = nicht mobilisierter Anteil)
  const epTopW = sw(sigEp(z_okb));   // Ep bei OK-Block (viel grösser als Ew)
  const epW    = sw(sigEp(z_nl));    // Ep bei NL
  const ep_pts = epTopW < 1
    ? `${ewX},${okbY} ${ewX+epW},${nlY} ${ewX},${nlY}`
    : `${ewX},${okbY} ${ewX+epTopW},${okbY} ${ewX+epW},${nlY} ${ewX},${nlY}`;

  // Ew: Formel 32 mob — mobilisierter Passivwiderstand, Trapez okbY→nlY
  const ewTopW = sw(sigPm(z_okb));
  const ewW    = sw(sigPm(z_nl));
  const ew_pts = ewTopW < 1
    ? `${ewX},${okbY} ${ewX+ewW},${nlY} ${ewX},${nlY}`
    : `${ewX},${okbY} ${ewX+ewTopW},${okbY} ${ewX+ewW},${nlY} ${ewX},${nlY}`;

  // E'0 rechts: Formel 35 — Ruhedruck Trapez NL→UK (Ruhedruck, kleiner)
  const e0bTopW = Math.max(2, sw(K0_*gs_*z_nl/gEp_));
  const e0bW    = Math.max(3, sw(K0_*gs_*t/gEp_));
  const e0b_pts = `${ewX},${nlY} ${ewX+e0bTopW},${nlY} ${ewX+e0bW},${ukY} ${ewX},${ukY}`;

  // Einheitliche Pfeilänge für alle Kraft-Vektoren
  const arrLen = Math.round(32*sc);

  // Reibungsvektoren — aus korrigierter Formel (Ep_full, nicht Ew_mob)
  const Ra = r.Ra_v_GZT  || (r.Ea_GZT||0) * Math.tan(0.5  * phi_k);
  const Rp = r.Rp_va_GZT || (r.Ew_GZT||0) * Math.tan(0.667* phi_k);
  const Rp_b = r.Rp_vb_GZT || 0;  // Reibung Ep unter NL
  // Separate Skalierung: Wandreibung vs. Sohlkräfte (rw noch für ältere Referenzen)
  const maxRwall = Math.max(Ra, Rp, 1);
  const maxRbase = Math.max(r.Nu_GZT||0, r.Ru_GZT||0, 1);
  const maxRpx = Math.round(28*sc);
  function rw(f, mx){ return Math.max(10, (f/mx)*maxRpx); }

  // Spannungslabel-Hilfsfunktion
  function sigLbl(x, y, val, anchor){
    if(val < 0.5) return '';
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="7.5" fill="var(--dim)" text-anchor="${anchor}" font-family="var(--f-mono)">${val.toFixed(0)} kPa</text>`;
  }

  function arrow(x1,y1,x2,y2,c,lbl,side='l'){
    const dx=x2-x1,dy=y2-y1,len=Math.sqrt(dx*dx+dy*dy);
    if(len<2) return '';
    const ux=dx/len,uy=dy/len,ax=x2-ux*7,ay=y2-uy*7,px=-uy*3,py=ux*3;
    const lx=side==='l'?x1-3:x1+3, anch=side==='l'?'end':'start';
    return `<line x1="${x1}" y1="${y1}" x2="${ax.toFixed(1)}" y2="${ay.toFixed(1)}" stroke="${c}" stroke-width="1.2"/>
<polygon points="${x2},${y2} ${(ax+px).toFixed(1)},${(ay+py).toFixed(1)} ${(ax-px).toFixed(1)},${(ay-py).toFixed(1)}" fill="${c}"/>
<text x="${lx}" y="${(y1+4).toFixed(1)}" font-size="8" fill="${c}" text-anchor="${anch}" font-family="var(--f-mono)">${lbl}</text>`;
  }

  function lbl(x,y,txt,anchor='middle',c='var(--dim)'){
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="8" fill="${c}" text-anchor="${anchor}" font-family="var(--f-mono)">${txt}</text>`;
  }

  // Vertikaler Pfeil (nach unten)
  function arrowDown(x,y1,y2,c,txt){
    if(y2<=y1+6) return '';
    return `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2-7}" stroke="${c}" stroke-width="1.2"/>
<polygon points="${x},${y2} ${x-3},${y2-7} ${x+3},${y2-7}" fill="${c}"/>
<text x="${x+4}" y="${((y1+y2)/2+3).toFixed(1)}" font-size="8" fill="${c}" text-anchor="start" font-family="var(--f-mono)">${txt}</text>`;
  }

  // Vertikaler Pfeil (nach oben)
  function arrowUp(x,y1,y2,c,txt,side='r'){
    if(y1<=y2+6) return '';
    const lx=side==='r'?x+4:x-4, anch=side==='r'?'start':'end';
    return `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2+7}" stroke="${c}" stroke-width="1.2"/>
<polygon points="${x},${y2} ${x-3},${y2+7} ${x+3},${y2+7}" fill="${c}"/>
<text x="${lx}" y="${((y1+y2)/2+3).toFixed(1)}" font-size="8" fill="${c}" text-anchor="${anch}" font-family="var(--f-mono)">${txt}</text>`;
  }

  // Kraft-Werte: Design oder charakteristisch
  const Ea_val  = charMode ? (r.Ea_GZT||0)/gEa_  : (r.Ea_GZT||0);
  const Ew_val  = charMode ? (r.Ew_GZT||0)*gEp_  : (r.Ew_GZT||0);
  const Epb_val = charMode ? (r.Epb_GZT||0)*gEp_ : (r.Epb_GZT||0);
  const E0a_val = charMode ? (r.E0a_GZT||0)*gEp_ : (r.E0a_GZT||0);
  const E0b_val = charMode ? (r.E0b_GZT||0)*gEp_ : (r.E0b_GZT||0);
  const vSfx = charMode ? 'k' : 'd';

  // R_0 / R_0': Ruhedruck-Wandreibung (Steckner: R_0 = 2·E_0·tan δ₁)
  const R0  = E0a_val * 2 * Math.tan(0.5 * phi_k);
  const R0p = E0b_val * 2 * Math.tan(0.5 * phi_k);

  // Schwerpunkt eines Trapezes (y-Koordinate in SVG)
  function trapCentroidY(y1, y2, s1, s2) {
    if(s1+s2 < 0.001) return (y1+y2)/2;
    return y1 + (y2-y1)*(s1+2*s2)/(3*(s1+s2));
  }
  const y_R0  = trapCentroidY(okbY, nlY, K0_*gs_*z_okb, K0_*gs_*z_nl);
  const y_R0p = trapCentroidY(nlY,  ukY, K0_*gs_*z_nl,  K0_*gs_*t);

  // E₀ Trapez-Punkte (über NL, rechts, gestrichelt — wie E'₀ unter NL)
  const e0aTopW = Math.max(2, sw(K0_*gs_*z_okb/gEp_));
  const e0aW    = e0bTopW;  // Breite bei NL (= obere Breite von E'₀)
  const e0a_pts = e0aTopW < 2
    ? `${ewX},${okbY} ${ewX+e0aW},${nlY} ${ewX},${nlY}`
    : `${ewX},${okbY} ${ewX+e0aTopW},${okbY} ${ewX+e0aW},${nlY} ${ewX},${nlY}`;

  // Spannungsverteilung R₀/R₀' an Mastachse (K₀-basiert, skaliert auf fundW/2)
  function sigR0(z){ return Math.max(0, K0_*gs_*z*2*Math.tan(0.5*phi_k)/gEp_); }
  const sigR0max = Math.max(sigR0(t), 0.1);
  function sr0(sig){ return Math.max(0, (sig/sigR0max)*Math.floor(fundW*0.44)); }

  // Pfeilbreite für R₀/R₀' — gleich wie alle anderen Kraft-Pfeile
  const r0ArrW  = arrLen;
  const r0pArrW = arrLen;

  // Ra/Rp direkt an der Blockfläche (wie Theorie: Ea+Ra zusammen, Ep+Rp zusammen)
  const rpH = arrLen;
  const raH = arrLen;
  const rpXnew = ewX + Math.round(8*sc);   // rechts, am Blockrand
  const raXnew = eaX - Math.round(8*sc);   // links, am Blockrand

  // R₀/R₀' Spalten-Positionen (ausserhalb der Druckzonen)
  const maxEwW = Math.max(ewW, e0bW);
  const maxEaW = Math.max(eaW, epbBotW_L);
  const r0ColX  = ewX + Math.max(Math.round(maxEwW*1.15), Math.round(diagW*0.8));
  const r0pColX = eaX - Math.max(Math.round(maxEaW*1.0),  Math.round(diagW*0.7));

  // Sohlzone
  const sY1 = ukY, sY2 = ukY + 14;
  const Nu = r.Nu_GZT || 0;
  const Ru = r.Ru_GZT || 0;

  // ── Lastvektoren: Skalierung (gemeinsame Basis) ──────────────────────────
  const colLoad = 'var(--warn)';
  const hArrW   = arrLen;
  const nArrH   = 18;  // fix (Gd geht zum Blockmittelpunkt)
  // Bogen-Moment: Radius proportional zu M_ok
  const mRad   = Math.min(26*sc, Math.max(14*sc, Math.sqrt(M_ok)*2.0*sc));
  // Lasten an OK Kopf (falls Kopf vorhanden), sonst fixer Abstand über GOK
  const loadY  = Hkopf > 0.05 ? okKopfY : topM - Math.round(46*sc);
  const lblEinwY = loadY - Math.round(20*sc);  // "Einwirkungen" Label (mehr Abstand)
  // H-Pfeil Ansatzpunkt: Kopf- oder Block-Seitenfläche
  const hAnchorX = cx - (Hkopf > 0.05 ? headW : fundW) / 2 - 4;

  // arcArrow: SVG-Bogen mit Pfeilspitze (Moment-Symbol)
  function arcArrow(cx_, cy_, rad, startDeg, endDeg, c, clockwise) {
    const sd=startDeg*Math.PI/180, ed=endDeg*Math.PI/180;
    const sx=cx_+rad*Math.cos(sd), sy=cy_+rad*Math.sin(sd);
    const ex=cx_+rad*Math.cos(ed), ey=cy_+rad*Math.sin(ed);
    const sw=clockwise?1:0;
    // Pfeilspitze
    const tang=(ed+Math.PI/2*(clockwise?1:-1));
    const ax=ex+5*Math.cos(tang), ay=ey+5*Math.sin(tang);
    const bx=ex+5*Math.cos(tang+2.4), by=ey+5*Math.sin(tang+2.4);
    return `<path d="M${sx.toFixed(1)},${sy.toFixed(1)} A${rad},${rad} 0 0,${sw} ${ex.toFixed(1)},${ey.toFixed(1)}" fill="none" stroke="${c}" stroke-width="1.5"/>
<polygon points="${ex.toFixed(1)},${ey.toFixed(1)} ${ax.toFixed(1)},${ay.toFixed(1)} ${bx.toFixed(1)},${by.toFixed(1)}" fill="${c}"/>`;
  }

  const svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;${wide?'':'max-width:'+W+'px;'}margin:8px auto 4px">

  <!-- ═══ EINWIRKUNGEN an OK Kopf ════════════════════════════════════ -->
  ${lbl(cx, lblEinwY, 'Einwirkungen', 'middle', colLoad)}

  <!-- H_d: horizontal →, endet an Kopf-/Blockfläche -->
  ${H_crit>0.5 ? arrow(hAnchorX-hArrW, loadY, hAnchorX, loadY, colLoad, 'H='+H_crit.toFixed(0)+'kN', 'l') : ''}

  <!-- Gd: Eigengewicht ↓, gleich lang wie alle anderen Vektoren -->
  ${N_crit>0.5 ? arrowDown(cx, lblEinwY-4, lblEinwY-4+arrLen, col.dim, 'Gd='+N_crit.toFixed(0)+'kN') : ''}

  <!-- M_d: Bogen im Uhrzeigersinn, zentriert auf OK Kopf -->
  ${M_ok>0.5 ? arcArrow(cx, loadY+4, mRad, -170, 10, colLoad, true) : ''}
  ${M_ok>0.5 ? lbl(cx+mRad+4, loadY+8, 'M='+M_ok.toFixed(0)+'kNm', 'start', colLoad) : ''}

  <!-- GOK -->
  <line x1="${fundL-diagW-18}" y1="${topM}" x2="${fundR+diagW+18}" y2="${topM}" stroke="${col.gok}" stroke-width="1" stroke-dasharray="4,2"/>
  ${lbl(fundL-diagW-6, topM+3, 'GOK', 'end', col.dim)}

  <!-- Fundamentkopf: von OK-Kopf (= okbY-headH) bis OK-Block (okbY) -->
  ${Hkopf > 0.05 ? `<rect x="${cx-headW/2}" y="${okKopfY}" width="${headW}" height="${okbY-okKopfY}"
    fill="${col.fund}" opacity="0.32" rx="1"/>
  <rect x="${cx-headW/2}" y="${okKopfY}" width="${headW}" height="${okbY-okKopfY}"
    fill="none" stroke="${col.line}" stroke-width="1.2" rx="1"/>
  ${lbl(cx, okKopfY+(okbY-okKopfY)*0.5+3, 'Bk='+Bk.toFixed(2)+'m', 'middle', col.dim)}` : ''}

  <!-- Fundament (OK-Block bis UK) -->
  <rect x="${fundL}" y="${okbY}" width="${fundW}" height="${ukY-okbY}" fill="${col.fund}" opacity="0.28" rx="1"/>
  <rect x="${fundL}" y="${okbY}" width="${fundW}" height="${ukY-okbY}" fill="none" stroke="${col.line}" stroke-width="1.2" rx="1"/>
  ${lbl(cx, okbY + (ukY-okbY)*0.5+3, 'B='+B.toFixed(2)+'m', 'middle', col.dim)}

  <!-- Drehachse (vertikal, gestrichelt) durch Block-Mitte (bis OK Kopf) -->
  <line x1="${cx}" y1="${Hkopf>0.05?okKopfY:okbY-6}" x2="${cx}" y2="${ukY+6}" stroke="${col.dim}" stroke-width="0.8" stroke-dasharray="4,3" opacity="0.55"/>

  <!-- Drehpunkt-Kreis bei NL auf der Achse -->
  <circle cx="${cx}" cy="${nlY}" r="4.5" fill="none" stroke="${col.nl}" stroke-width="1.5"/>
  <circle cx="${cx}" cy="${nlY}" r="1.5" fill="${col.nl}"/>

  <!-- NL gestrichelt + Drehpunkt-Symbol -->
  <line x1="${fundL-diagW-14}" y1="${nlY}" x2="${fundR+diagW+14}" y2="${nlY}" stroke="${col.nl}" stroke-width="1" stroke-dasharray="5,3"/>
  ${lbl(fundR+diagW+16, nlY+3, 'NL · y='+y.toFixed(2)+'m', 'start', col.nl)}
  <!-- Drehpunkt D -->
  ${lbl(cx-8, nlY+4, 'D', 'end', col.nl)}

  <!-- OK-Block Label -->
  ${uberd > 0.02 ? lbl(fundR+5, okbY+3, 'OK-Block', 'start', col.dim) : ''}

  <!-- UK -->
  <line x1="${fundL-6}" y1="${ukY}" x2="${fundR+6}" y2="${ukY}" stroke="${col.line}" stroke-width="0.8"/>
  ${lbl(cx, ukY+10, 'UK  t='+t.toFixed(2)+'m', 'middle', col.dim)}

  <!-- ═══ LINKS: Ea (okbY→nlY, treibend) + E'p (nlY→ukY, stabilisierend) ═══ -->

  <!-- Ea: Formel 31 — Trapez OK-Block → NL -->
  <polygon points="${ea_pts}" fill="${col.ea}" opacity="0.28"/>
  <polygon points="${ea_pts}" fill="none" stroke="${col.ea}" stroke-width="1"/>
  <!-- kPa-Labels: am Aussenrand der Druckfigur -->
  ${sigLbl(eaX - Math.max(eaTopW, eaW) - 4, okbY+4, sigA(z_okb), 'end')}
  ${sigLbl(eaX - Math.max(eaTopW, eaW) - 4, nlY-2, sigA(z_nl), 'end')}
  <!-- Kraft-Pfeil am echten Flächenschwerpunkt + italic ÜBER dem Label -->
  ${(()=>{const ym_ea=trapCentroidY(okbY,nlY,sigA(z_okb),sigA(z_nl)), xstart=eaX-arrLen;
    window._ym_ea=ym_ea;  // für Ra-Positionierung
    return arrow(xstart, ym_ea, eaX, ym_ea, col.ea, 'Ea='+Ea_val.toFixed(0)+'kN', 'l')
     +`<text x="${(xstart-2).toFixed(1)}" y="${(ym_ea-3).toFixed(1)}" font-size="7" fill="${col.ea}" text-anchor="end" font-style="italic" font-family="var(--f-mono)">treibend</text>`;
  })()}

  <!-- E'p links: Formel 33 — Trapez NL→UK (Sprung bei NL deutlich, Kph >> Ka) -->
  <polygon points="${epb_L_pts}" fill="${col.ep}" opacity="0.30"/>
  <polygon points="${epb_L_pts}" fill="none" stroke="${col.ep}" stroke-width="1.2"/>
  <!-- kPa-Labels -->
  ${sigLbl(eaX - Math.max(epbTopW_L, epbBotW_L) - 4, nlY+5, sigEpp(z_nl), 'end')}
  ${sigLbl(eaX - epbBotW_L - 4, ukY-1, sigEpp(t), 'end')}
  <!-- Kraft-Pfeil -->
  ${(()=>{const ym=nlY+(ukY-nlY)*0.5, xstart=eaX-arrLen;
    return arrow(xstart, ym, eaX, ym, col.ep, "E'p="+Epb_val.toFixed(0)+'kN', 'l')
     +`<text x="${(xstart-2).toFixed(1)}" y="${(ym-3).toFixed(1)}" font-size="7" fill="${col.ep}" text-anchor="end" font-style="italic" font-family="var(--f-mono)">stabilisierend</text>`;
  })()}

  <!-- Ra ↓: am Schwerpunkt-y von Ea, am linken Blockrand -->
  ${Ra>0.5 ? arrowDown(raXnew, window._ym_ea||okbY, (window._ym_ea||okbY)+raH, col.ea, 'Ra='+Ra.toFixed(0)+'kN') : ''}

  <!-- ═══ RECHTS: Ep_voll (gestrichelt) + Ew mob (gefüllt) + E'0 (Ruhedruck) ═══ -->

  <!-- Ep_voll: volle passive Fläche als gestrichelter Umriss (nicht mobilisierter Rest) -->
  <polygon points="${ep_pts}" fill="${col.ep}" opacity="0.07"/>
  <polygon points="${ep_pts}" fill="none" stroke="${col.ep}" stroke-width="0.9" stroke-dasharray="4,2" opacity="0.8"/>
  ${sigLbl(ewX + Math.max(epTopW, epW) + 4, okbY+4, sigEp(z_okb), 'start')}
  ${sigLbl(ewX + Math.max(epTopW, epW) + 4, nlY-2, sigEp(z_nl), 'start')}
  <!-- Label: mob=25% Markierung -->
  ${epW > ewW + 6 ? `<text x="${(ewX+ewW+(epW-ewW)/2+2).toFixed(1)}" y="${((okbY+nlY)/2).toFixed(1)}" font-size="7" fill="${col.ep}" text-anchor="start" font-family="var(--f-mono)" opacity="0.7" transform="rotate(-90,${(ewX+ewW+(epW-ewW)/2+2).toFixed(1)},${((okbY+nlY)/2).toFixed(1)})">mob=25%</text>` : ''}

  <!-- Ew: mobilisierter Anteil (Formel 32) — Trapez OK-Block → NL (gefüllt) -->
  <polygon points="${ew_pts}" fill="${col.ew}" opacity="0.25"/>
  <polygon points="${ew_pts}" fill="none" stroke="${col.ew}" stroke-width="1.4"/>
  <!-- kPa-Labels Ew: am rechten Rand des Ew-Trapezes (leicht versetzt von Ep-Labels) -->
  ${sigLbl(ewX + ewTopW + 4, okbY + 12, sigPm(z_okb), 'start')}
  ${sigLbl(ewX + ewW    + 4, nlY  -  8, sigPm(z_nl),  'start')}
  ${(()=>{const ym_ep=trapCentroidY(okbY,nlY,sigPm(z_okb),sigPm(z_nl)), xstart=ewX+arrLen;
    window._ym_ep=ym_ep;  // für Rp-Positionierung
    return arrow(xstart, ym_ep, ewX, ym_ep, col.ew, 'Ew='+Ew_val.toFixed(0)+'kN', 'r')
     +`<text x="${(xstart+2).toFixed(1)}" y="${(ym_ep-3).toFixed(1)}" font-size="7" fill="${col.ew}" text-anchor="start" font-style="italic" font-family="var(--f-mono)">Widerstand</text>`;
  })()}

  <!-- Rp ↑: am Schwerpunkt-y von Ep, am rechten Blockrand -->
  ${Rp>0.5 ? arrowUp(rpXnew, (window._ym_ep||okbY)+rpH, window._ym_ep||okbY, col.ew, 'Rp='+Rp.toFixed(0)+'kN', 'r') : ''}

  <!-- R₀/R₀': Spannungsverteilungen an der Fundamentachse (cx) mit kPa-Labels -->
  ${(()=>{
    // R₀ (über NL): Trapez rechts von cx — K₀-Reibung oben
    const r0tw = sr0(sigR0(z_okb)), r0bw = sr0(sigR0(z_nl));
    const e0a_cx = r0tw<1
      ? `${cx},${okbY} ${cx+r0bw},${nlY} ${cx},${nlY}`
      : `${cx},${okbY} ${cx+r0tw},${okbY} ${cx+r0bw},${nlY} ${cx},${nlY}`;
    // R₀' (unter NL): Trapez links von cx — K₀-Reibung unten
    const r0ptw = sr0(sigR0(z_nl)), r0pbw = sr0(sigR0(t));
    const e0p_cx = `${cx},${nlY} ${cx-r0ptw},${nlY} ${cx-r0pbw},${ukY} ${cx},${ukY}`;
    // kPa-Werte an den Eckpunkten (Reibungsspannung = K₀·γ·z·tan δ)
    const s0_okb = sigR0(z_okb), s0_nl = sigR0(z_nl), s0_uk = sigR0(t);
    return `<polygon points="${e0a_cx}" fill="${col.e0}" opacity="0.22"/>
<polygon points="${e0a_cx}" fill="none" stroke="${col.e0}" stroke-width="0.9" stroke-dasharray="2,2"/>
<polygon points="${e0p_cx}" fill="${col.e0}" opacity="0.22"/>
<polygon points="${e0p_cx}" fill="none" stroke="${col.e0}" stroke-width="0.9" stroke-dasharray="2,2"/>
${s0_okb>0.3 ? sigLbl(cx+r0tw+4, okbY+4, s0_okb, 'start') : ''}
${sigLbl(cx+r0bw+4, nlY-2, s0_nl, 'start')}
${sigLbl(cx-r0pbw-4, ukY-1, s0_uk, 'end')}`;
  })()}

  <!-- R_0 ←: Resultante an Fundamentachse cx (Schwerpunkt E₀ über NL, destabilisierend) -->
  ${R0>0.5 ? arrow(cx, y_R0, cx-r0ArrW, y_R0, col.e0, 'R₀='+R0.toFixed(0)+'kN', 'r') : ''}
  ${R0>0.5 ? `<text x="${(cx-r0ArrW-2).toFixed(1)}" y="${(y_R0-4).toFixed(1)}" font-size="7" fill="${col.e0}" text-anchor="end" font-style="italic" font-family="var(--f-mono)">destab.</text>` : ''}

  <!-- R_0' →: Resultante an Fundamentachse cx (Schwerpunkt E₀' unter NL, stabilisierend) -->
  ${R0p>0.5 ? arrow(cx, y_R0p, cx+r0pArrW, y_R0p, col.e0, 'R₀′='+R0p.toFixed(0)+'kN', 'l') : ''}
  ${R0p>0.5 ? `<text x="${(cx+r0pArrW+2).toFixed(1)}" y="${(y_R0p-4).toFixed(1)}" font-size="7" fill="${col.e0}" text-anchor="start" font-style="italic" font-family="var(--f-mono)">stabilis.</text>` : ''}

  <!-- Sohlenpressung p_u + Sohlkräfte N_u/R_u (Steckner Bild 4: p_u gleichverteilt über x am Druckrand,
       N_u = Resultante am Blockschwerpunkt im Abstand u von der Achse, R_u horizontal entgegen H) -->
  ${(()=>{
    const pxB = fundW / Math.max(0.01, B);            // px pro m Fundamentbreite
    const u_m = r.u_ecc_GZT || 0;
    const x_m = Math.max(0, B - 2*u_m);               // Sohldruck-Blocklänge x (Gl.47/48)
    const xpx = Math.max(5, x_m*pxB);
    const upx = u_m*pxB;
    const pu_d = (r.pu_d_GZT!=null) ? r.pu_d_GZT : (x_m>0.001 ? Nu/(Math.max(0.01,B)*x_m) : 0);
    const compR = fundR;                               // Druckrand = Passivseite (rechts, H drückt dorthin)
    const blkL  = Math.max(fundL, compR - xpx);
    const nuX   = cx + upx;                            // N_u am Schwerpunkt des p_u-Blocks
    const puH   = Math.round(18*sc);
    const bY    = ukY;
    let s='';
    // p_u-Block (gleichverteilt am Druckrand, unter der Sohle)
    s+=`<rect x="${blkL.toFixed(1)}" y="${bY}" width="${(compR-blkL).toFixed(1)}" height="${puH}" fill="${col.ru}" opacity="0.22"/>`;
    s+=`<rect x="${blkL.toFixed(1)}" y="${bY}" width="${(compR-blkL).toFixed(1)}" height="${puH}" fill="none" stroke="${col.ru}" stroke-width="1"/>`;
    s+=`<text x="${(compR+4).toFixed(1)}" y="${(bY+puH*0.65).toFixed(1)}" font-size="7.5" fill="${col.ru}" text-anchor="start" font-family="var(--f-mono)">p_u=${pu_d.toFixed(0)} kPa</text>`;
    // x-Mass (Blocklänge am Druckrand)
    s+=`<line x1="${blkL.toFixed(1)}" y1="${bY+puH+3}" x2="${compR}" y2="${bY+puH+3}" stroke="${col.dim}" stroke-width="0.6"/>`;
    s+=`<text x="${((blkL+compR)/2).toFixed(1)}" y="${(bY+puH+11).toFixed(1)}" font-size="7" fill="${col.dim}" text-anchor="middle" font-family="var(--f-mono)">x=${x_m.toFixed(2)}m</text>`;
    // N_u ↑ am Schwerpunkt des Blocks (Abstand u von der Fundamentachse)
    s+= Nu>0.5 ? arrowUp(nuX, bY+puH+arrLen, bY+puH, col.nu, 'Nu='+Nu.toFixed(0)+'kN', 'r') : '';
    // u-Mass (Achse cx → N_u)
    s+=`<line x1="${cx}" y1="${bY+puH+arrLen+5}" x2="${nuX.toFixed(1)}" y2="${bY+puH+arrLen+5}" stroke="${col.dim}" stroke-width="0.6"/>`;
    s+=`<line x1="${cx}" y1="${bY+puH+arrLen+2}" x2="${cx}" y2="${bY+puH+arrLen+8}" stroke="${col.dim}" stroke-width="0.6"/>`;
    s+=`<text x="${((cx+nuX)/2).toFixed(1)}" y="${(bY+puH+arrLen+14).toFixed(1)}" font-size="7" fill="${col.dim}" text-anchor="middle" font-family="var(--f-mono)">u=${u_m.toFixed(2)}m</text>`;
    // R_u → horizontal an der Sohle in H-RICHTUNG: die Sohle bewegt sich (Drehung um die tiefliegende NL)
    // ENTGEGEN H → die mobilisierte Sohlreibung wirkt MIT H; ihr Moment R_u·(t−ü) ist rückstellend
    // (Steckner Gl.54: H*−E_w+E'_w+R_u=0 → R_u gleiches Vorzeichen wie H*; Gl.66 Term 4 positiv).
    s+= Ru>0.5 ? arrow(cx-arrLen, bY+Math.round(9*sc), cx, bY+Math.round(9*sc), col.ru, 'Ru='+Ru.toFixed(0)+'kN','l') : '';
    return s;
  })()}

  <!-- Tiefenmass links: ü (GOK→OK-Block) + H_Block (OK-Block→UK) -->
  ${(()=>{const tx=fundL-diagW-Math.round(16*sc);
    const Hb = t - uberd;  // H_Block = t_eff - ü
    let s=`<line x1="${tx}" y1="${topM}" x2="${tx}" y2="${ukY}" stroke="${col.dim}" stroke-width="0.7"/>
  <line x1="${tx-3}" y1="${topM}" x2="${tx+3}" y2="${topM}" stroke="${col.dim}" stroke-width="0.7"/>
  <line x1="${tx-3}" y1="${ukY}" x2="${tx+3}" y2="${ukY}" stroke="${col.dim}" stroke-width="0.7"/>
  `;
    if(uberd>0.02){
      // Tick + Label OK-Block
      s+=`<line x1="${tx-5}" y1="${okbY}" x2="${tx+5}" y2="${okbY}" stroke="${col.dim}" stroke-width="1"/>`;
      // Segment ü (GOK→OK-Block)
      s+=lbl(tx-4, (topM+okbY)/2+3, 'ü='+uberd.toFixed(2)+'m', 'end', col.dim);
      // Segment H_Block (OK-Block→UK)
      s+=lbl(tx-4, (okbY+ukY)/2+3, 'H='+Hb.toFixed(2)+'m', 'end', col.dim);
    } else {
      // Kein ü: nur Gesamtmass
      s+=lbl(tx-4, (topM+ukY)/2+3, t.toFixed(2)+'m', 'end', col.dim);
    }
    return s;
  })()}

  <!-- Mu-Formelhinweis rechts oben -->
  ${wide ? `<text x="${W-8}" y="${topM+14}" font-size="7" fill="var(--xdim)" text-anchor="end" font-family="var(--f-mono)">Mu = −(Ew−Ea+E0ü)·v + (Ep+E0u)·v' + Reib·A/2 + Ru·H + Nu·u</text>` : ''}

  <!-- Hebelarm v (OK-Block → NL, rechts vom Fundament) -->
  ${(()=>{
    const av = r.arm_v_GZT || 0; if(av < 0.01) return '';
    const ax = fundR + diagW + Math.round(12*sc);
    return `<line x1="${ax}" y1="${okbY}" x2="${ax}" y2="${nlY}" stroke="var(--acc)" stroke-width="0.8" stroke-dasharray="3,2"/>
<text x="${ax+3}" y="${((okbY+nlY)/2+3).toFixed(1)}" font-size="7" fill="var(--acc)" text-anchor="start" font-family="var(--f-mono)">v=${av.toFixed(2)}m</text>`;
  })()}

  <!-- Hebelarm v' (NL → UK, rechts, unter v) -->
  ${(()=>{
    const avp = r.arm_vp_GZT || 0; if(avp < 0.01) return '';
    const ax = fundR + diagW + Math.round(12*sc);
    return `<line x1="${ax}" y1="${nlY}" x2="${ax}" y2="${ukY}" stroke="var(--ok)" stroke-width="0.8" stroke-dasharray="3,2"/>
<text x="${ax+3}" y="${((nlY+ukY)/2+3).toFixed(1)}" font-size="7" fill="var(--ok)" text-anchor="start" font-family="var(--f-mono)">v'=${avp.toFixed(2)}m</text>`;
  })()}

  <!-- Achssystem x/z — 3× grösser, in unterer linker Ecke der Box -->
  ${(()=>{
    const axX=Math.round(12*sc), axY=H-Math.round(14*sc), axL=Math.round(48*sc);
    return `<line x1="${axX}" y1="${axY}" x2="${axX+axL}" y2="${axY}" stroke="${col.dim}" stroke-width="1.4"/>
<polygon points="${axX+axL},${axY} ${axX+axL-7},${axY-4} ${axX+axL-7},${axY+4}" fill="${col.dim}"/>
<text x="${axX+axL+4}" y="${axY+4}" font-size="11" fill="${col.dim}" text-anchor="start" font-family="var(--f-mono)">x</text>
<line x1="${axX}" y1="${axY}" x2="${axX}" y2="${axY-axL}" stroke="${col.dim}" stroke-width="1.4"/>
<polygon points="${axX},${axY-axL} ${axX-4},${axY-axL+7} ${axX+4},${axY-axL+7}" fill="${col.dim}"/>
<text x="${axX}" y="${axY-axL-4}" font-size="11" fill="${col.dim}" text-anchor="middle" font-family="var(--f-mono)">z</text>`;
  })()}
</svg>`;
  return svg;
}
