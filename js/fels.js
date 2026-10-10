// BlockCalc — js/fels.js
// Felsfundament: Betonsockel auf Fels mit ungespannten Felsankern (Ausführung «fels» des Pfahlfundaments)
// ══════════════════════════════════════════════════════════
// Bezug: SBB 0161.1011.0002 nennt für felsigen Baugrund nur «Abmessung gem. Bemessung, Nachweis erforderlich»
// (Zeichnung 0161.1011.0601 liegt nicht in Grundlagen/). Bauweise nach Nutzerentscheid (Okt 2026): Sockel auf
// dem Fels, Kippmoment über Zuganker im Fels und Druck auf den Fels.
//
// MODELL (Annahmen des Programms — im Bericht und im Handbuch Anhang C ausgewiesen):
//  · Starrer Sockel; je Kipprichtung plastische Druckzone an der Druckkante mit σ_R,d über die Länge x,
//    Zug nur in der ÄUSSERSTEN Ankerreihe:  C = N + Z,  x = C/(σ_R,d·l),  M = Z·a + C·(b/2 − x/2).
//  · Ohne Ankerzug (Resultierende in der Sohle): x_erf = N/(σ_R,d·l) gegen die Ersatzlänge b − 2e (Meyerhof).
//    Mit Ankerzug: Druckzone höchstens die halbe Sockelbreite (η = (b/2)/x).
//  · Zweiachsig (Lastfall mit beiden Richtungen): beide Richtungen je mit vollem N, Ankerkräfte addiert.
//  · Anker = ungespannte Zugglieder, bemessen wie Zugpfähle nach SIA 267 Kap. 9: innerer Widerstand
//    η_i·A_s·f_y/γ_s, äusserer Widerstand (Verbund Mörtel–Fels) η_a·τ_k·π·d_B·l_v/γ_M,a (Zug 1.6).
//    SIA 267 Kap. 10 regelt vorgespannte Anker und wird hier nicht angewendet.
//  · Felsausbruch: Gewicht des Ausbruchkegels je Anker (halber Öffnungswinkel α; entlang der ziehenden Reihe bei
//    engem Abstand auf den Streifen s/(2r) gekürzt), ohne Zugfestigkeit des Felses:  0.90·G_E ≥ Z_1.
//  · Gleiten: (N + Z)·tan δ_k/γ_φ ≥ H, ohne Dübelwirkung der Anker.
//  · Verbundspannung τ_k und Felspressung σ_R,d sind EINGABEN ohne Vorschlagswert (leer/0 ⇒ Nachweis nicht erfüllt).
//  · Gebrauchstauglichkeit (Schiefstellung): unter charakteristischer Last dehnt sich der Zuganker über die freie
//    Dehnlänge l_frei = Sockeldicke + l_v/2:  δ = Z_1·l_frei/(E_s·A_s),  tan α = δ/(a + b/2 − x/2). Die
//    Zusammendrückung des Felses ist vernachlässigt; ohne Ankerzug ist tan α = 0. Grenzwerte SBB 1:100 / 1:200.
// Nicht nachgewiesen: Verbund Stahl–Mörtel, Ankerkopf/Ankerplatte, Sockelbewehrung.
function _pbFels(){ return (document.getElementById('pb_mode')||{}).value === 'fels'; }

// Beschriftungen und Sichtbarkeit der Eingaben im Felsmodus (die Felder selbst sind die des Pfahlfundaments)
const _FELS_TXT = { 'Bankett (Pfahlkopfplatte)':'Sockel', 'Pfahl-Anordnung':'Anker-Anordnung', 'Pfahl':'Anker',
  'Tragglied (Mikropfahl-System)':'Zugglied (Stabanker)', 'Teilsicherheiten Pfahl':'Teilsicherheiten Anker',
  'Pfahlanordnung & Sohlkräfte':'Ankeranordnung & Sohlkräfte', 'B Bankett ':'B Sockel ', 'L Bankett ':'L Sockel ',
  'Pfahllänge L ':'Verankerungslänge l_v ', 'Verpresskörper-Ø ':'Bohrloch-Ø ' };
function _pbFelsUI(fels){
  const sec = document.getElementById('pfahlbock-section'); if(!sec) return;
  sec.querySelectorAll('.sec, label').forEach(el => { const tn = el.firstChild; if(!tn || tn.nodeType !== 3) return;
    if(el.dataset.txt0 == null) el.dataset.txt0 = tn.nodeValue;
    const neu = _FELS_TXT[el.dataset.txt0]; tn.nodeValue = (fels && neu != null) ? neu : el.dataset.txt0;
    if(el.classList.contains('sec') && el.dataset.txt0 === 'Mantelreibung') el.style.display = fels ? 'none' : ''; });
  ['pb_skinfac','pb_zugfac','pb_zykfac','pb_gMD','pb_gMQ','pb_korr'].forEach(id => { const f = (document.getElementById(id)||{closest(){return null;}}).closest('.field'); if(f) f.style.display = fels ? 'none' : ''; });
  sec.querySelectorAll('button[onclick*="pbDimLaenge"]').forEach(b => { b.style.display = fels ? 'none' : ''; });
}

function felsAchse(N, M, b, l, coords, sigRd){
  const sigL = sigRd*l, xm = Math.max(0, ...coords.map(c => Math.abs(c)));
  const nOut = Math.max(1, xm < 1e-6 ? coords.length : coords.filter(c => Math.abs(c - xm) < 1e-6).length);
  if(!(sigL > 0)) return { Z:0, x:0, etaP:0, nOut, xm, e:0, ohneSig:true };
  if(N <= 1e-9){ const Z = -N + (M > 0 ? M/Math.max(xm, 1e-6) : 0); return { Z, x:0, etaP:Infinity, nOut, xm, e:Infinity }; }
  const e = M/N; let x = N/sigL;
  if(e <= b/2 - x/2 + 1e-12) return { Z:0, x, etaP:(b - 2*e)/x, nOut, xm, e };     // kein Ankerzug
  let Z = 0;
  for(let i = 0; i < 80; i++){ x = (N + Z)/sigL; const arm = xm + b/2 - x/2;
    if(arm <= 1e-6) return { Z:Infinity, x, etaP:0, nOut, xm, e };
    Z = Math.max(0, (M - N*(b/2 - x/2))/arm); }
  x = (N + Z)/sigL;
  return { Z, x, etaP:(b/2)/x, nOut, xm, e };
}

function felsankerAnalyse(cfg){
  const P = cfg.piles, n = P.length, xs = P.map(p => p.x), ys = P.map(p => p.y);
  const Rt_d = cfg.etaI * micropileRtd(cfg.tendon, cfg.gammaS);                              // Stahl [kN]
  const Ra_k = cfg.tau * Math.PI * cfg.dB * cfg.lv, Ra_d = cfg.etaA * Ra_k / cfg.gMZ;       // Verbund Mörtel–Fels [kN]
  const rK = cfg.lv * Math.tan(cfg.alpha*Math.PI/180);
  const fS = s => (s > 1e-6 && rK > 1e-9) ? Math.min(1, s/(2*rK)) : 1;
  const mehrX = new Set(xs.map(v => v.toFixed(3))).size > 1, mehrY = new Set(ys.map(v => v.toFixed(3))).size > 1;
  // Ausbruchkegel je Anker; gekürzt wird nur ENTLANG der ziehenden Reihe (dort überschneiden sich die Kegel der
  // Zuganker). Kippt der Sockel quer, liegt die Zugreihe längs (Abstand s_y) und umgekehrt; zweiachsig beides.
  const GE0 = cfg.gamF * Math.PI/3 * rK*rK * cfg.lv;
  const fVon = (zQ, zL) => (zQ && mehrY ? fS(cfg.sy) : 1) * (zL && mehrX ? fS(cfg.sx) : 1);
  const tanD = cfg.mu / cfg.gPhi;
  const fin = v => isFinite(v) ? v : (v > 0 ? 1e9 : 0);
  let gov = null;
  const kombs = cfg.ulsCombos.map(c => { const L = c.load;
    const qx = felsAchse(L.N, Math.abs(L.My||0), cfg.B, cfg.L, xs.map(v => (L.My||0) >= 0 ? -v : v), cfg.sigRd);   // quer
    const ly = felsAchse(L.N, Math.abs(L.Mx||0), cfg.L, cfg.B, ys.map(v => (L.Mx||0) >= 0 ? -v : v), cfg.sigRd);   // längs
    const F = P.map((p, i) => { let z = 0;
      const cx = ((L.My||0) >= 0 ? -p.x : p.x), cy = ((L.Mx||0) >= 0 ? -p.y : p.y);
      if(qx.Z > 0 && (qx.xm < 1e-6 || Math.abs(cx - qx.xm) < 1e-6)) z += qx.Z/qx.nOut;
      if(ly.Z > 0 && (ly.xm < 1e-6 || Math.abs(cy - ly.xm) < 1e-6)) z += ly.Z/ly.nOut;
      return -z; });
    const Z1 = Math.max(0, ...F.map(f => -f)), Zsum = (isFinite(qx.Z)?qx.Z:0) + (isFinite(ly.Z)?ly.Z:0);
    const H = Math.hypot(L.Hx||0, L.Hy||0), C = Math.max(0, L.N + Zsum);
    const eS = Z1 > 1e-9 ? Rt_d/Z1 : Infinity, eV = Z1 > 1e-9 ? Ra_d/Z1 : Infinity, fK = fVon(qx.Z > 0, ly.Z > 0), GE1 = GE0*fK, eA = Z1 > 1e-9 ? 0.9*GE1/Z1 : Infinity;
    const eP = Math.min(qx.etaP, ly.etaP), eG = H > 1e-9 ? C*tanD/H : Infinity;
    const eta = Math.min(eS, eV, eA, eP, eG);
    const k = { label:c.label, lf:c.lf, nr:c.nr, load:L, loadChar:c.loadChar, F, Z1, Zsum, C, H, qx, ly, fK, GE1, eS, eV, eA, eP, eG, eta };
    if(!gov || eta < gov.eta) gov = k; return k; });
  const mn = key => { let b = null; kombs.forEach(k => { if(!b || k[key] < b[key]) b = k; }); return b; };
  const gS = mn('eS'), gV = mn('eV'), gA = mn('eA'), gP = mn('eP'), gG = mn('eG');
  const r2 = v => isFinite(v) ? +v.toFixed(2) : Infinity;
  const r = { fels:true, n, Rt_d:+Rt_d.toFixed(1), Ra_k:+Ra_k.toFixed(1), Ra_d:+Ra_d.toFixed(1), GE1:+((gA ? gA.GE1 : GE0)).toFixed(1), rK:+rK.toFixed(2), fK:+((gA ? gA.fK : 1)).toFixed(2),
    tanD:+tanD.toFixed(3), cfg,
    etaSteel:r2(gS ? gS.eS : Infinity), etaVerb:r2(gV ? gV.eV : Infinity), etaAusb:r2(gA ? gA.eA : Infinity),
    etaPress:r2(gP ? gP.eP : Infinity), etaGleit:r2(gG ? gG.eG : Infinity),
    govS:gS, govV:gV, govA:gA, govP:gP, govG:gG, gov,
    kombs, ulsCombosN:kombs.length,
    pileRes: gov ? gov.F.map(f => ({ F:+f.toFixed(1), zug:f < 0 })) : [],
    govLoad: gov ? gov.load : {}, govLoadChar: gov ? gov.loadChar : null, govCombo: gov ? gov.label : '—' };
  // Gebrauchstauglichkeit: Schiefstellung aus der Ankerdehnung unter charakteristischer Last
  const As = (cfg.tendon && cfg.tendon.As || 0)*1e-6, EA = Math.max(1e-9, (cfg.Es||205000)*1000*As), lFrei = cfg.dSockel + cfg.lv/2;
  // Schiefstellung eines Lastzustands (grössere der beiden Richtungen)
  const tanVon = L => { let b = { tan:0, Z1:0, dl:0, arm:0, ri:'quer', x:0 };
    [[Math.abs(L.My||0), cfg.B, cfg.L, xs, 'quer'], [Math.abs(L.Mx||0), cfg.L, cfg.B, ys, 'längs']].forEach(([M, bb, ll, co, ri]) => {
      const a = felsAchse(L.N, M, bb, ll, co, cfg.sigRd);          // symmetrische Anordnung: Betrag genügt
      const Z1 = isFinite(a.Z) ? (a.Z > 0 ? a.Z/a.nOut : 0) : Infinity;
      const dl = Z1*lFrei/EA, arm = a.xm + bb/2 - a.x/2, tan = Z1 > 0 ? (arm > 1e-6 ? dl/arm : Infinity) : 0;
      if(tan > b.tan) b = { tan, Z1, dl, arm, ri, x:a.x }; });
    return b; };
  // Je Lastfall: gesamte Schiefstellung (ständig + veränderlich) gegen 1:100 und der Zuwachs aus den
  // veränderlichen Lasten (gesamt − nur ständig) gegen 1:200. Das Eigengewicht wirkt in beiden Zuständen.
  r.gzg = null;
  (cfg.gzgFull||[]).forEach((c, i) => { const Lf = c.load, Lv = ((cfg.gzgVar||[])[i]||{}).load || {};
    const Lg = { N:Lf.N-(Lv.N||0), Hx:Lf.Hx-(Lv.Hx||0), Hy:Lf.Hy-(Lv.Hy||0), Mx:Lf.Mx-(Lv.Mx||0), My:Lf.My-(Lv.My||0) };
    const tF = tanVon(Lf), tG = tanVon(Lg), dT = Math.max(0, tF.tan - tG.tan);
    const eF = tF.tan > 1e-12 ? cfg.alphaZul/tF.tan : Infinity, eV = dT > 1e-12 ? cfg.alphaZulVar/dT : Infinity;
    const k = eF <= eV ? Object.assign({}, tF, { eta:eF, zul:cfg.alphaZul, art:'ständig + veränderlich', label:c.label, tanG:tG.tan, tanF:tF.tan })
                       : Object.assign({}, tF, { eta:eV, tan:dT, zul:cfg.alphaZulVar, art:'Zuwachs aus veränderlich', label:c.label, tanG:tG.tan, tanF:tF.tan });
    if(!r.gzg || k.eta < r.gzg.eta) r.gzg = k; });
  if(r.gzg){ r.gzg.lFrei = lFrei; r.gzg.EA = EA; }
  r.etaGZG = r.gzg ? r2(r.gzg.eta) : Infinity;
  r.eta_massg = Math.min(r.etaSteel, r.etaVerb, r.etaAusb, r.etaPress, r.etaGleit, r.etaGZG);
  r.etaGeo = Math.min(r.etaVerb, r.etaAusb);      // für Fundamentliste / Schubladen-Status
  return r;
}

// Rechte Schublade
function _felsResultHTML(r){
  const z = (v, d) => isFinite(v) ? (+v).toFixed(d == null ? 1 : d) : '∞';
  const row = (k, v) => `<div class="nw-row"><span>${k}</span><span>${v}</span></div>`;
  const fo = t => `<div class="nw-formula">${t}</div>`;
  const m = Math.min(r.etaSteel, r.etaVerb, r.etaAusb, r.etaPress, r.etaGleit, r.etaGZG), g = e => e === m;
  const K = k => k ? k.label : '—', c = r.cfg, gl = r.govLoad || {};
  const zugK = r.kombs.some(k => k.Z1 > 1e-9);
  const fehlt = [];
  if(!(c.tau > 0)) fehlt.push('Verbundspannung τ_k Mörtel–Fels');
  if(!(c.sigRd > 0)) fehlt.push('Felspressung σ_R,d');
  const ax = k => { if(!k) return ''; const a = (k.qx.Z >= k.ly.Z) ? k.qx : k.ly, quer = a === k.qx;
    return row('Kipprichtung · Ausmitte e = M/N', (quer?'quer':'längs')+' · '+z(a.e, 3)+' m')
         + row('Druckzone x = (N + Z)/(σ_R,d·l)', z(a.x, 3)+' m')
         + row('Ankerzug der äussersten Reihe Z', z(a.Z)+' kN ('+a.nOut+' Anker)'); };
  return `<div style="font-family:var(--f-mono);font-size:9.5px;color:var(--dim);margin:2px 0 8px">Modell: <span style="color:var(--acc)">Pfahlfundament</span> · <span style="color:var(--acc)">Sockel mit Felsankern</span> · SIA 267</div>
    ${fehlt.length ? wBox('fail', 'Felskennwerte fehlen', 'Bitte eingeben: <b>'+fehlt.join('</b> und <b>')+'</b>. Das Programm schlägt dafür keine Werte vor (Baugrundgutachten / Ankerversuch). Ohne Eingabe gelten die zugehörigen Nachweise als nicht erfüllt.') : ''}
    <div class="nw" style="padding:8px 10px;margin-bottom:8px"><div style="font-family:var(--f-mono);font-size:9px;letter-spacing:.05em;text-transform:uppercase;color:var(--dim);margin-bottom:4px">Massgebend — ${esc(r.govCombo)}</div>
      <div class="kv-grid">${[['N_d', z(gl.N)+' kN'], ['H_d', z(Math.hypot(gl.Hx||0, gl.Hy||0))+' kN'], ['M_xd', z(gl.Mx)+' kNm'], ['M_yd', z(gl.My)+' kNm']].map(([a,b]) => `<span>${a}</span><span>${b}</span>`).join('')}</div></div>
    <div class="lf-grp">GZT — Grenzzustand der Tragfähigkeit · Sockel mit Felsankern</div>
    <div class="gzt-diagram" style="position:relative;margin:0 0 8px;border-radius:var(--r1);overflow:hidden;border:1px solid var(--ol)" data-gzt-key="_pbdiag_fels">
      <button onclick="toggleGZTExpand(event,'_pbdiag_fels')" title="Vergrössern" style="position:absolute;top:6px;right:6px;z-index:2;background:var(--s3);border:1px solid var(--ol2);border-radius:3px;cursor:pointer;color:var(--dim);padding:1px 6px;font-size:11px;line-height:1.5">⤢</button>
      ${(() => { try{ window['_pbdiag_fels'] = {R:r, n:r.n, fn:'buildFelsDiagram'}; return buildFelsDiagram(r, r.n, typeof _gztExpanded!=='undefined' && _gztExpanded); }catch(e){ return ''; } })()}
    </div>
    ${nwCardHd('Ankerstahl (innerer Widerstand)', r.etaSteel, null, g(r.etaSteel))}
      ${fo('R_i,d = η_i · A_s · f_y / γ_s  ≥  Z_1')}
      ${row('massgebend', esc(K(r.govS)))}${ax(r.govS)}
      ${row('Z_1 je Anker', z(r.govS ? r.govS.Z1 : 0)+' kN')}${row('R_i,d', r.Rt_d+' kN')}${row('η', z(r.etaSteel, 2))}
      ${zugK ? '' : '<div style="font-size:9px;color:var(--xdim);margin:2px 0 4px">In keiner Kombination entsteht Ankerzug — die Resultierende bleibt in der Sohlfläche.</div>'}
    ${NW_CARD_END}
    ${nwCardHd('Verbund Mörtel–Fels (äusserer Widerstand)', r.etaVerb, null, g(r.etaVerb))}
      ${fo('R_a,d = η_a · τ_k · π · d_B · l_v / γ_M,a  ≥  Z_1')}
      ${row('τ_k · π · d_B · l_v', z(c.tau, 0)+' kPa · π · '+z(c.dB*1000, 0)+' mm · '+z(c.lv, 2)+' m = '+r.Ra_k+' kN')}
      ${row('η_a / γ_M,a (Zug)', z(c.etaA, 2)+' / '+z(c.gMZ, 2))}${row('R_a,d', r.Ra_d+' kN')}${row('Z_1 je Anker', z(r.govV ? r.govV.Z1 : 0)+' kN')}${row('η', z(r.etaVerb, 2))}
    ${NW_CARD_END}
    ${nwCardHd('Felsausbruch', r.etaAusb, null, g(r.etaAusb))}
      ${fo('0.90 · G_E ≥ Z_1  ·  G_E = γ_Fels · π/3 · r² · l_v · f  ·  r = l_v · tan α')}
      ${row('r = l_v·tan α', z(c.lv, 2)+' · tan '+z(c.alpha, 0)+'° = '+r.rK+' m')}${row('Abminderung Ankerabstand f', z(r.fK, 2))}
      ${row('G_E je Anker', r.GE1+' kN')}${row('Z_1 je Anker', z(r.govA ? r.govA.Z1 : 0)+' kN')}${row('η', z(r.etaAusb, 2))}
      <div style="font-size:9px;color:var(--xdim);margin:2px 0 4px">Nur das Gewicht des Ausbruchkegels, ohne Zugfestigkeit des Felses.</div>
    ${NW_CARD_END}
    ${nwCardHd('Felspressung', r.etaPress, null, g(r.etaPress))}
      ${fo('ohne Ankerzug: x_erf = N/(σ_R,d·l) ≤ b − 2e  ·  mit Ankerzug: x ≤ b/2')}
      ${row('massgebend', esc(K(r.govP)))}${row('σ_R,d (Eingabe)', z(c.sigRd, 0)+' kPa')}${ax(r.govP)}${row('η', z(r.etaPress, 2))}
    ${NW_CARD_END}
    ${nwCardHd('Gleiten', r.etaGleit, null, g(r.etaGleit))}
      ${fo('R = (N + Z) · tan δ_k / γ_φ  ≥  H_d')}
      ${row('massgebend', esc(K(r.govG)))}${row('N + Z', z(r.govG ? r.govG.C : 0)+' kN')}${row('tan δ_k / γ_φ', z(c.mu, 2)+' / '+z(c.gPhi, 2)+' = '+z(r.tanD, 3))}
      ${row('H_d', z(r.govG ? r.govG.H : 0)+' kN')}${row('η', z(r.etaGleit, 2))}
      <div style="font-size:9px;color:var(--xdim);margin:2px 0 4px">Ohne Dübelwirkung der Anker.</div>
    ${NW_CARD_END}
    <div class="lf-grp">GZG — Gebrauchstauglichkeit · SBB 0161.1011.0007</div>
    ${nwCardHd('Schiefstellung', r.etaGZG, null, g(r.etaGZG))}
      ${fo('δ = Z_1 · l_frei / (E_s · A_s)  ·  tan α = δ / (a + b/2 − x/2)  ≤  tan α_zul')}
      ${r.gzg ? row('massgebend', esc(r.gzg.label)+' · '+r.gzg.ri+' · '+r.gzg.art)
        + row('Z_1 (charakteristisch)', z(r.gzg.Z1)+' kN') + row('l_frei = Sockeldicke + l_v/2', z(r.gzg.lFrei, 2)+' m')
        + row('Ankerdehnung δ', z(r.gzg.dl*1000, 3)+' mm') + row('Hebel a + b/2 − x/2', z(r.gzg.arm, 3)+' m')
        + row('tan α / zulässig', (r.gzg.tan > 1e-9 ? '1:'+Math.round(1/r.gzg.tan) : '0')+' / 1:'+Math.round(1/r.gzg.zul)) + row('η', z(r.etaGZG, 2)) : ''}
      <div style="font-size:9px;color:var(--xdim);margin:2px 0 4px">Nur die Dehnung der Zuganker; die Zusammendrückung des Felses ist vernachlässigt. Ohne Ankerzug unter Gebrauchslast ist die Schiefstellung null.</div>
    ${NW_CARD_END}
    <div style="font-size:9px;color:var(--xdim);line-height:1.5;margin-top:6px">Ungespannte Felsanker, bemessen wie Zugpfähle nach SIA 267 Kap. 9. Nicht nachgewiesen: Verbund Stahl–Mörtel, Ankerkopf, Sockelbewehrung. Die Ankertragfähigkeit ist durch Versuche zu bestätigen.</div>`;
}

// Nachweisbericht (2 Seiten)
function buildNachweisDocFels(r, piles, n){
  const st = collectState(), now = new Date(), datStr = st.p_datum || now.toLocaleDateString('de-CH');
  const N = (v, d) => _npN(v, d), ph = () => _npPH(st, datStr), c = r.cfg;
  const eta = v => { if(!isFinite(v)) return '<span class="np-eta ok">η = ∞ ✓</span>'; const ok = etaErf(v);
    return '<span class="np-eta '+(ok?'ok':'fail')+'">η = '+v.toFixed(2)+(ok?' ≥ 1.0 ✓':' &lt; 1.0 ✗')+'</span>'; };
  const tr = (a, b, d) => '<tr><td>'+a+'</td><td>'+b+'</td><td class="r">'+d+'</td></tr>';
  const A = k => !k ? {} : ((k.qx.Z >= k.ly.Z) ? k.qx : k.ly);
  const kt = '<table class="np-tbl"><tr><th>Kombination</th><th class="r">N_d</th><th class="r">H_d</th><th class="r">M_xd</th><th class="r">M_yd</th><th class="r">Z_1</th><th class="r">η</th></tr>'
    + r.kombs.map(k => '<tr'+(k === r.gov ? ' class="hl"' : '')+'><td>'+esc(k.label)+'</td><td class="r">'+N(k.load.N)+'</td><td class="r">'+N(k.H)+'</td><td class="r">'+N(k.load.Mx)+'</td><td class="r">'+N(k.load.My)+'</td><td class="r">'+N(k.Z1)+'</td><td class="r">'+(isFinite(k.eta)?k.eta.toFixed(2):'∞')+'</td></tr>').join('')+'</table>';
  const nw = (nr, t, q, form, werte, e) => '<div class="np-nw">'+_npNwh(nr, t, q)+_npCalc(form, werte, 'η = '+(isFinite(e)?e.toFixed(2):'∞'))+eta(e)+'</div>';
  const s1 = '<div class="np-page">'+ph()+_npCh('1', 'Felsfundament — Sockel mit Felsankern')+
    '<div style="font-size:8.5px;color:var(--dim);margin-bottom:8px">Betonsockel auf dem Fels. Das Kippmoment wird über ungespannte Zuganker im Fels und über Druck auf den Fels abgetragen. SBB 0161.1011.0002: bei felsigem Baugrund Abmessung gemäss Bemessung, Nachweis erforderlich.</div>'+
    _npSh2('1.1  Geometrie und Baustoffe')+
    '<table class="np-tbl"><tr><th>Grösse</th><th>Beschreibung</th><th class="r">Wert</th></tr>'+
      tr('B × L × d', 'Sockel (quer × längs × Dicke)', N(c.B, 2)+' × '+N(c.L, 2)+' × '+N(c.dSockel, 2)+' m')+
      tr('n', 'Felsanker', n+' Stück, Abstand '+N(c.sx, 2)+' / '+N(c.sy, 2)+' m')+
      tr('Zugglied', esc((c.tendon && c.tendon.bez) || '—'), 'A_s·f_y/γ_s → R_i,d = '+N(r.Rt_d)+' kN')+
      tr('d_B / l_v', 'Bohrloch-Ø / Verankerungslänge im Fels', N(c.dB*1000, 0)+' mm / '+N(c.lv, 2)+' m')+
      tr('τ_k', 'Verbundspannung Mörtel–Fels (Eingabe)', N(c.tau, 0)+' kPa')+
      tr('σ_R,d', 'Bemessungswert der Felspressung (Eingabe)', N(c.sigRd, 0)+' kPa')+
      tr('tan δ_k', 'Reibungsbeiwert Sockel–Fels', N(c.mu, 2))+
      tr('α / γ_Fels', 'halber Öffnungswinkel des Ausbruchkegels / Wichte Fels', N(c.alpha, 0)+'° / '+N(c.gamF, 1)+' kN/m³')+
    '</table>'+
    _npSh2('1.2  Kombinationen (Lasten an der UK Sockel)')+kt+
    _npSh2('1.3  Annahmen des Programms')+
    '<div style="font-size:8.5px;color:var(--dim);line-height:1.6">Starrer Sockel; plastische Druckzone mit σ_R,d an der Druckkante; Zug nur in der äussersten Ankerreihe. '+
      'Ohne Ankerzug gilt die Ersatzlänge b − 2e (Meyerhof), mit Ankerzug höchstens die halbe Sockelbreite als Druckzone. Bei Lasten in beiden Richtungen werden die Ankerkräfte beider Richtungen addiert. '+
      'Die Anker sind ungespannte Zugglieder und werden wie Zugpfähle nach SIA 267 Kap. 9 bemessen (η_a = '+N(c.etaA, 2)+', γ_M,a = '+N(c.gMZ, 2)+', η_i = '+N(c.etaI, 2)+', γ_s = '+N(c.gammaS, 2)+'); Kap. 10 der Norm regelt vorgespannte Anker. '+
      'Felsausbruch nur über das Gewicht des Ausbruchkegels, ohne Zugfestigkeit des Felses. Gleiten ohne Dübelwirkung der Anker. τ_k und σ_R,d sind Eingaben aus dem Baugrundgutachten bzw. aus Ankerversuchen; das Programm schlägt keine Werte vor. '+
      'Gebrauchstauglichkeit: Schiefstellung nur aus der Dehnung der Zuganker über l_frei = Sockeldicke + l_v/2, ohne Zusammendrückung des Felses. '+
      '<b>Nicht nachgewiesen:</b> Verbund Stahl–Mörtel, Ankerkopf und Ankerplatte, Bewehrung des Sockels.</div></div>';
  const aS = A(r.govS), aP = A(r.govP);
  const s2 = '<div class="np-page np-pb">'+ph()+_npCh('2', 'Nachweise der Tragsicherheit')+
    nw('2.1', 'Ankerzug und Ankerstahl', 'SIA 267 Kap. 9 (Zugpfahl), innerer Widerstand',
       'M = Z·a + (N + Z)·(b/2 − x/2)   ·   x = (N + Z)/(σ_R,d·l)   ·   R_i,d = η_i·A_s·f_y/γ_s ≥ Z_1',
       esc((r.govS||{}).label||'—')+': e = '+N(aS.e, 3)+' m · x = '+N(aS.x, 3)+' m · Z = '+N(aS.Z)+' kN auf '+(aS.nOut||0)+' Anker → Z_1 = '+N((r.govS||{}).Z1)+' kN · R_i,d = '+N(r.Rt_d)+' kN', r.etaSteel)+
    nw('2.2', 'Verbund Mörtel–Fels', 'SIA 267 Gl. (42), (44) — äusserer Widerstand auf Zug',
       'R_a,d = η_a·τ_k·π·d_B·l_v / γ_M,a ≥ Z_1',
       N(c.etaA, 2)+'·'+N(c.tau, 0)+'·π·'+N(c.dB, 3)+'·'+N(c.lv, 2)+' / '+N(c.gMZ, 2)+' = '+N(r.Ra_d)+' kN · Z_1 = '+N((r.govV||{}).Z1)+' kN', r.etaVerb)+
    nw('2.3', 'Felsausbruch', 'Gewicht des Ausbruchkegels (Annahme des Programms)',
       '0.90·G_E ≥ Z_1   ·   G_E = γ_Fels·π/3·r²·l_v·f   ·   r = l_v·tan α',
       'r = '+N(r.rK, 2)+' m · f = '+N(r.fK, 2)+' · G_E = '+N(r.GE1)+' kN · Z_1 = '+N((r.govA||{}).Z1)+' kN', r.etaAusb)+
    nw('2.4', 'Felspressung', 'plastische Druckzone (Annahme des Programms)',
       'ohne Ankerzug: x_erf = N/(σ_R,d·l) ≤ b − 2e   ·   mit Ankerzug: x ≤ b/2',
       esc((r.govP||{}).label||'—')+': σ_R,d = '+N(c.sigRd, 0)+' kPa · x = '+N(aP.x, 3)+' m · e = '+N(aP.e, 3)+' m', r.etaPress)+
    nw('2.5', 'Gleiten', 'SIA 267 Gl. (31) sinngemäss, γ_φ auf tan δ',
       'R = (N + Z)·tan δ_k/γ_φ ≥ H_d',
       esc((r.govG||{}).label||'—')+': ('+N((r.govG||{}).C)+')·'+N(r.tanD, 3)+' ≥ '+N((r.govG||{}).H)+' kN', r.etaGleit)+
    '<div class="np-fig" style="max-width:440px;margin:8px auto">'+(function(){ try{ return buildFelsDiagram(r, n, true); }catch(e){ return ''; } })()+'<div style="font-size:8px;color:var(--xdim);margin-top:2px;text-align:center">Abb. — Schnitt in Kipprichtung: Druckzone am Fels, Zuganker mit Ausbruchkegel, Kräfte der massgebenden Kombination</div></div>'+
    (r.gzg ? nw('2.6', 'Gebrauchstauglichkeit — Schiefstellung', 'SBB 0161.1011.0007 · Ankerdehnung (Annahme des Programms)',
       'δ = Z_1·l_frei/(E_s·A_s)   ·   tan α = δ/(a + b/2 − x/2) ≤ tan α_zul',
       esc(r.gzg.label)+' ('+r.gzg.ri+', '+r.gzg.art+'): Z_1 = '+N(r.gzg.Z1)+' kN · l_frei = '+N(r.gzg.lFrei, 2)+' m · δ = '+N(r.gzg.dl*1000, 3)+' mm · Hebel '+N(r.gzg.arm, 3)+' m · tan α = '+(r.gzg.tan > 1e-9 ? '1:'+Math.round(1/r.gzg.tan) : '0')+' · zul. 1:'+Math.round(1/r.gzg.zul), r.etaGZG) : '')+
    _npSh2('Zusammenfassung')+'<div style="margin-top:4px">'+eta(r.eta_massg)+' &nbsp; massgebend: '+esc(r.govCombo)+'</div></div>';
  return s1 + s2;
}

// Schnitt in der massgebenden Kipprichtung: Sockel, Druckzone, Zuganker mit Ausbruchkegel, Kräfte
function buildFelsDiagram(r, n, wide){
  const k = r.govS || r.gov; if(!k) return '';
  const c = r.cfg, quer = k.qx.Z >= k.ly.Z, a = quer ? k.qx : k.ly, b = quer ? c.B : c.L, M = Math.abs(quer ? (k.load.My||0) : (k.load.Mx||0));
  const VB = wide?480:272, HB = wide?250:214, top = 44, cx = VB*0.42;
  const sc = Math.min((VB*0.5)/b, (HB-top-52)/(c.dSockel + c.lv)), bw = b*sc, yF = top + c.dSockel*sc, yE = yF + c.lv*sc;
  const xD = cx + bw/2, xZ = cx - a.xm*sc, xw = Math.max(2, Math.min(bw, a.x*sc)), cE = dgEta(r.eta_massg);
  let s = dgOpen(VB, HB, 'FELSFUNDAMENT — KRÄFTE IN KIPPRICHTUNG', (quer?'quer':'längs')+' zum Gleis · '+esc(k.label));
  s += dgL(8, yF, VB-8, yF, {c:DG.ax}) + dgT(VB-8, yF-3, 'OK Fels', {a:'end', z:DG.kl, c:DG.xdim});
  s += `<rect x="${(cx-bw/2).toFixed(1)}" y="${top}" width="${bw.toFixed(1)}" height="${(yF-top).toFixed(1)}" fill="${DG.fl}" stroke="${DG.ax}" stroke-width="1"/>`;
  // Druckzone an der Druckkante
  s += `<rect x="${(xD-xw).toFixed(1)}" y="${yF}" width="${xw.toFixed(1)}" height="9" fill="${DG.acc}" fill-opacity="0.45" stroke="${DG.acc}" stroke-width="0.8"/>`;
  s += dgT(xD+4, yF+9, 'x = '+dgZ(a.x, 3)+' m', {z:DG.kl, c:DG.acc}) + dgT(xD+4, yF+19, 'σ_R,d = '+dgZ(c.sigRd, 0)+' kPa', {z:DG.kl, c:DG.acc});
  // Anker (äusserste Reihe auf Zug, übrige grau) mit Ausbruchkegel
  const reihen = [...new Set((quer ? r.cfg.piles.map(p => p.x) : r.cfg.piles.map(p => p.y)).map(v => +v.toFixed(3)))];
  reihen.forEach(v => { const xx = cx + v*sc * (xZ <= cx ? 1 : 1), zug = a.Z > 0 && Math.abs(Math.abs(v) - a.xm) < 1e-6 && (cx + v*sc) <= cx + 1e-6;
    s += dgL(cx + v*sc, top+4, cx + v*sc, yE, {c: zug ? DG.warn : DG.xdim, w: zug ? 2.2 : 1.2}); });
  if(a.Z > 0 && isFinite(a.Z)){
    const rk = Math.min(r.rK, (quer ? c.sx : c.sy)/2 || r.rK)*sc;
    s += `<polygon points="${xZ.toFixed(1)},${yE.toFixed(1)} ${(xZ-rk).toFixed(1)},${yF.toFixed(1)} ${(xZ+rk).toFixed(1)},${yF.toFixed(1)}" fill="${DG.warn}" fill-opacity="0.10" stroke="${DG.warn}" stroke-width="0.8" stroke-dasharray="3,2"/>`;
    s += dgPfeil(xZ, yF + (yE-yF)*0.45, xZ, yF + (yE-yF)*0.45 + 20, DG.warn) + dgT(xZ-5, yF + (yE-yF)*0.45 + 14, 'Z = '+dgZ(a.Z)+' kN', {a:'end', c:DG.warn});
  }
  s += dgT(xZ, yE+10, 'l_v = '+dgZ(c.lv, 2)+' m', {a:'middle', z:DG.kl, c:DG.xdim});
  // Einwirkungen
  s += dgPfeil(cx, top-18, cx, top-2, DG.on) + dgT(cx+5, top-9, 'N_d = '+dgZ(k.load.N)+' kN', {c:DG.on});
  s += dgT(8, top-9, 'M_d = '+dgZ(M)+' kNm', {c:DG.on}) + dgT(8, top+2, 'H_d = '+dgZ(k.H)+' kN', {c:DG.on});
  s += dgT(8, HB-19, 'Anker: Z_1 = '+dgZ(k.Z1)+' kN · R_i,d = '+r.Rt_d+' kN · R_a,d = '+r.Ra_d+' kN', {z:DG.kl});
  s += dgT(8, HB-8, 'η massgebend = '+dgZ(r.eta_massg, 2), {c:cE, w:600});
  return s+'</svg>';
}
