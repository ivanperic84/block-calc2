// BlockCalc — js/pfahlfundament.js
// Pfahlfundament: Eingabe, Lastaufbereitung, renderPfahlbock
// BERECHNUNGSMODELL — Block (Steckner) / Flach (Hansen)
// ════════════════════════════════════════════
let CALC_MODEL = 'block'; // 'block' | 'flach'
let FLACH_MAT  = 'beton'; // 'beton' | 'stahl'
let AUFLASTEN  = [];      // [{Pk, dx, dy}] Ballastierung Stahlplatte
let _bgKoernig = 'grob';  // 'grob' | 'fein' — Bodenart für Steckner-Gültigkeitsprüfung
let _c1Manual  = false;   // true = User hat C₁ manuell gesetzt → autoC1() überschreibt nicht
let _c1Methode = 'auto';  // 'auto' | 'blend' | 'winkler' | 'steckner'

// ── Pfahlbock UI (Stufe 2): Katalog-Dropdowns, Layout, Render ─────────────────
function populatePfahlbockUI(){
  const sysSel = document.getElementById('pb_sys'), korrSel = document.getElementById('pb_korr');
  if(sysSel && !sysSel.options.length){
    getMicropileSystems().forEach((s,i) => { const o=document.createElement('option');
      o.value=i; o.textContent=`${s.hersteller} — ${s.typ}`; sysSel.appendChild(o); });
  }
  if(korrSel && !korrSel.options.length){
    KORROSIONSSCHUTZ.forEach(k => { const o=document.createElement('option');
      o.value=k.id; o.textContent=k.bez; korrSel.appendChild(o); });
  }
  onPbSys(true);
}
function onPbSys(noRender){
  const sysSel=document.getElementById('pb_sys'), varSel=document.getElementById('pb_var');
  if(!sysSel || !varSel) return;
  const sys=getMicropileSystems()[+sysSel.value] || getMicropileSystems()[0];
  varSel.innerHTML='';
  sys.vars.forEach((v,i) => { const o=document.createElement('option');
    o.value=i; o.textContent=`${v.bez} · R_t,k=${micropileRtk(v).toFixed(0)} kN`; varSel.appendChild(o); });
  if(!noRender) renderPfahlbock();
}
// Dropdown der Systeme neu aufbauen (nach Hinzufügen eigener Tragglieder)
function refreshPfahlbockSystems(){
  const sysSel=document.getElementById('pb_sys'); if(!sysSel) return;
  const cur=sysSel.value; sysSel.innerHTML='';
  getMicropileSystems().forEach((s,i)=>{ const o=document.createElement('option');
    o.value=i; o.textContent=`${s.hersteller} — ${s.typ}`; sysSel.appendChild(o); });
  if(cur!=='' && +cur < sysSel.options.length) sysSel.value=cur;
  onPbSys(true);
}
// Eigenes Tragglied erstellen → persistiert unter 'bc_micropiles' (System id='custom')
function addCustomTendon(){
  const bez=(gi('pbc_bez')||'Custom').trim(), da=+gi('pbc_da')||40, As=+gi('pbc_As')||0,
        Ryk=+gi('pbc_Ryk')||0, E=+gi('pbc_E')||210000;
  const msg=document.getElementById('pbc_msg');
  if(As<=0 || Ryk<=0){ if(msg) msg.textContent='A_s und R_t,k müssen > 0 sein.'; return; }
  const custom = dbGet('bc_micropiles') || [];
  let sys = custom.find(s=>s.id==='custom');
  if(!sys){ sys={id:'custom', hersteller:'Eigene', typ:'Benutzerdefiniert', grade:'eigene Eingabe', E, vars:[]}; custom.push(sys); }
  sys.E = E;
  sys.vars.push({ bez, da, As, fy: Math.round(Ryk*1000/Math.max(1,As)), ft:0, Ryk });
  dbSet('bc_micropiles', custom);
  refreshPfahlbockSystems();
  const sysSel=document.getElementById('pb_sys');
  const idx=getMicropileSystems().findIndex(s=>s.id==='custom');
  if(idx>=0 && sysSel){ sysSel.value=idx; onPbSys(true);
    const vs=document.getElementById('pb_var'); if(vs) vs.value=sys.vars.length-1; }
  if(msg) msg.textContent=`„${bez}" hinzugefügt (R_t,k=${Ryk} kN).`;
  renderPfahlbock();
}
// Symmetrisches Pfahlraster (Reihen quer × Spalten längs)
// Ausrichtung der Anordnung im Grundriss: 0 / 90 / 180 / 270° (Feld pb_rot). 90° dreht die
// Anordnung um eine Vierteldrehung — die Reihe aus zwei Pfählen liegt dann längs statt quer, das
// Dreieck zeigt mit der Spitze nach −x statt +y, 2×3 wird zu 3×2. s_x bleibt der Abstand QUER,
// s_y der Abstand LÄNGS (dafür werden die Abstände vor dem Drehen getauscht).
function _pbRot(){ const v=+((document.getElementById('pb_rot')||{}).value||0); return [0,90,180,270].includes(v) ? v : 0; }
function _pbPileLayout(n, sx, sy, rot){
  rot = (rot==null) ? _pbRot() : rot;
  if(rot){
    const q = rot===90||rot===270, base=_pbPileLayout(n, q?sy:sx, q?sx:sy, 0);
    return base.map(p => rot===90 ? {x:-p.y, y:p.x} : rot===180 ? {x:-p.x, y:-p.y} : {x:p.y, y:-p.x})
               .map(p => ({x:p.x+0, y:p.y+0}));   // −0 → 0 (sonst kippt Math.sign die Neigung nicht sauber)
  }
  if(n===1) return [ {x:0,y:0} ];                                          // Einzelpfahl (zentrisch, vertikal)
  if(n===3) return [ {x:-sx/2,y:-sy/2}, {x:sx/2,y:-sy/2}, {x:0,y:sy/2} ];  // Dreieck (nicht kollinear)
  const grid = {2:[2,1], 4:[2,2], 6:[2,3], 8:[2,4], 9:[3,3]}[n] || [2,2];
  const [nr,nc] = grid, piles=[];
  for(let i=0;i<nr;i++) for(let j=0;j<nc;j++)
    piles.push({ x: nr>1 ? (i-(nr-1)/2)*sx : 0, y: nc>1 ? (j-(nc-1)/2)*sy : 0 });
  return piles;
}
// Statisch optimale, SYMMETRISCHE Pfahlneigung: Fuss radial nach aussen; KEINE Neigung auf
// einer Achse, wenn der Pfahl auf deren Mittellinie liegt (p.x≈0 bzw. p.y≈0). Damit bleiben
// 2 (Reihe → α_y=0), 3 (Spitzenpfahl → α_x=0), 6/8 (Mittelreihe → α_y=0) symmetrisch.
// Math.sign(0)=0 erledigt den Mittellinien-Fall automatisch (statt p.x>=0?1:-1, das bei 0
// fälschlich +α erzwingt und die Symmetrie brach).
function _pbIncl(p, ax, ay){ return { axDeg: Math.sign(p.x)*ax, ayDeg: Math.sign(p.y)*ay }; }
// ── Ausführung Pfahlfundament: 'gruppe' (Bankett + Kopf, n Pfähle) | 'einzel' (EIN Pfahl,
//    Lasten direkt am Pfahlkopf — kein Bankett, kein Kopf, kein Hebel, kein Eigengewicht).
//    Der Einzelpfahl ist der Grenzfall der Gruppe: identische Nachweise (Mantelreibung, N+M,
//    Knicken SIA 263, GZG), nur ohne Lastverteilung. n=1 ⇒ _pbPileLayout liefert (0,0),
//    _pbIncl macht ihn über Math.sign(0)=0 automatisch vertikal.
function _pbEinzel(){ return (document.getElementById('pb_mode')||{}).value === 'einzel'; }
function _pbApplyModeUI(){
  const ein=_pbEinzel();
  const blk=document.getElementById('pb-grp-block'), lay=document.getElementById('pb-grp-layout');
  if(blk) blk.style.display = ein ? 'none' : '';
  if(lay) lay.style.display = ein ? 'none' : '';
  // Querschnitt: Einzelpfahl nutzt den Profil-Katalog der Fundamentsicherung (HEB / Krinner V),
  // die Gruppe das Mikropfahl-Tragglied. Verpresskörper-Ø entfällt beim Profil (Ø = Profilbreite).
  const prof=document.getElementById('pb-grp-prof'), tdn=document.getElementById('pb-grp-tendon');
  if(prof) prof.style.display = ein ? '' : 'none';
  if(tdn)  tdn.style.display  = ein ? 'none' : '';
  const _vp=(document.getElementById('pb_einbau')||{}).value==='verpresst';
  const rdG=document.getElementById('pb-row-dG'); if(rdG) rdG.style.display = (ein && !_vp) ? 'none' : '';   // Bohr-/Verpress-Ø nur wenn verpresst
  const rub=document.getElementById('pb-row-ueber'); if(rub) rub.style.display = ein ? '' : 'none';   // Überstand nur Einzelpfahl
  // Innerer Widerstand: Mikropfahl γ_s + η_i · Einzelpfahl (Stahlprofil) γ_M1 nach SIA 263
  document.querySelectorAll('.pb-nur-mp').forEach(el => { el.style.display = ein ? 'none' : ''; });
  document.querySelectorAll('.pb-nur-ein').forEach(el => { el.style.display = ein ? '' : 'none'; });
  const h=document.getElementById('pb_mode_hint');
  if(h) h.textContent = ein
    ? 'Ein einzelner Pfahl (Stahlprofil), Mastlasten wirken direkt am Pfahlkopf (kein Bankett/Kopf, kein Hebel, kein Eigengewicht). Momente trägt der Pfahl über Biegung + Bettung → biegesteifer Kopfanschluss erforderlich.'
    : 'Starres Bankett auf mehreren Pfählen; Lasten werden über das Bankett verteilt.';
}
// Querschnitt des Einzelpfahls aus Profil (HEB / Krinner V / Rammrohr) und Stahlgüte — EINE Quelle
// für Rechnung, Panel und Bericht. Krinner bleibt S355 (Produktannahme), die Güte gilt für HEB und Rohr.
function _pbEinzelProfil(){
  const pt=(document.getElementById('pb_prof')||{}).value||'HEB200';
  const kr=!!KRINNER_PILES[pt], rr=!!RAMMROHRE[pt];
  // Krinner im Dauereinsatz: 1.5 mm Abrostung der Wanddicke (Z-34.15-253, Ziff. 2.4.1)
  const ps=kr ? krinnerAbgerostet(pt, 1.5) : pfahlSection(pt);
  const fy=kr ? (ps.fy||235) : (STAHLGUETEN[(document.getElementById('pb_stahl')||{}).value] || 355);
  const tor=profilTorsion(ps);
  const grade=kr ? 'Krinner V · Rohr Ø '+(KRINNER_PILES[pt].da*1000).toFixed(1)+' × '+(KRINNER_PILES[pt].tNenn*1000).toFixed(1)+' mm · S235 (−1.5 mm Abrostung)' : rr ? 'Rammrohr Ø '+(ps.da*1000).toFixed(1)+' × '+(ps.t*1000).toFixed(1)+' mm · S'+fy : 'HEB · S'+fy;
  const tdn={ bez:rr ? '' : pt, As:ps.A*1e6, da:ps.b*1000, fy, Ryk:ps.A*fy*1000, I:ps.Iy, Wpl:ps.Wply,
              round:!!ps.round, Iz:(ps.Iz!=null?ps.Iz:ps.Iy), Wplz:(ps.Wplz!=null?ps.Wplz:ps.Wply), Wt:tor.Wt };
  // Querschnittsklasse des Rohrs (SIA 263 / EN 1993-1-1, Biegung): d/t ≤ 50ε² Klasse 1, ≤ 70ε² Klasse 2,
  // ≤ 90ε² Klasse 3, darüber 4 (ε² = 235/f_y). Ab Klasse 3 darf nicht plastisch bemessen werden →
  // elastisches Widerstandsmoment. (Ø 610 und Ø 711 × 12.5 in S355 sind Klasse 3.) HEB 160–300 sind
  // bis S460 in Biegung Klasse 1–2.
  let klasse=1;
  if(ps.round){ const t=(ps.t!=null)?ps.t:(ps.da-ps.di)/2, dt=ps.da/t, e2=235/fy;
    klasse = dt<=50*e2 ? 1 : dt<=70*e2 ? 2 : dt<=90*e2 ? 3 : 4;
    if(klasse>=3){ const Wel=ps.Iy/(ps.da/2); tdn.Wpl=Wel; tdn.Wplz=Wel; } }
  return { pt, ps, fy, kr, rr, grade, tdn, klasse };
}
function onPbMode(){ _pbApplyModeUI(); if(typeof renderPfahlbock==='function') renderPfahlbock(); }
// Randabstand Pfahlmitte → nächste Bankettkante (auf UK-Bankett-Niveau, am Pfahlkopf)
function _pbEdgeDist(p, Bbank, Lbank){ return Math.min(Bbank/2-Math.abs(p.x), Lbank/2-Math.abs(p.y)); }
// Konfigurierbarer Mindest-Randabstand (Optionen) — steuert Ampel-Warnschwelle UND Auto-Abstand.
function _pbRandMin(){ return (typeof SETTINGS!=='undefined' && +SETTINGS.pfahlRandMin) || 0.30; }
// Ampel: rot wenn der Pfahl die Kante anschneidet (Mitte < Ø/2 → Querschnitt ragt über/ausserhalb),
// orange wenn Randabstand < Mindestmass (Optionen), sonst ok.
function _pbEdgeStatus(edge, dG, randMin){ randMin=randMin||_pbRandMin();
  if(edge < dG/2 - 1e-9) return 'fail'; if(edge < randMin - 1e-9) return 'warn'; return 'ok'; }
// Layout-Faktoren fx=max|x|/sx, fy=max|y|/sy (Aussenpfahl-Position je Achse) für die Auto-Abstände
function _pbSpacingFactors(n){
  if(n===3) return {fx:0.5, fy:0.5};   // Dreieck: Pfähle bei ±sx/2, ±sy/2
  const g={2:[2,1],4:[2,2],6:[2,3],8:[2,4],9:[3,3]}[n]||[2,2];
  const f={ fx:(g[0]-1)/2, fy:(g[1]-1)/2 };   // x↔nr, y↔nc (vgl. _pbPileLayout)
  const r=_pbRot(); return (r===90||r===270) ? {fx:f.fy, fy:f.fx} : f;   // gedreht: Reihen ↔ Spalten
}
// Maximale Pfahlabstände so, dass der Aussenpfahl EXAKT auf dem Mindest-Randabstand liegt
// (max|x| = B/2 − randMin). fx/fy=0 (Einzelreihe auf der Achse) ⇒ Abstand irrelevant → null.
function _pbMaxSpacing(n, Bbank, Lbank, randMin, SXMIN, SXMAX){
  randMin=randMin||_pbRandMin(); SXMIN=SXMIN||0.5; SXMAX=SXMAX||4.0;
  const {fx,fy}=_pbSpacingFactors(n), q=(ext,f)=> f>1e-6
    ? Math.min(SXMAX, Math.max(SXMIN, Math.floor((ext/2-randMin)/f/0.1 + 1e-6)*0.1)) : null;
  return { sx:q(Bbank,fx), sy:q(Lbank,fy) };
}
// Auto/Manuell-Modus auf die Abstandsfelder anwenden: Auto → max. Wert setzen + Felder sperren;
// Manuell → Felder freigeben (Nutzer kann verkleinern). Irrelevante Achse (fx/fy=0) bleibt gesperrt.
function _pbApplySpacingMode(autoSp, n, Bbank, Lbank, randMin){
  const ms = autoSp ? _pbMaxSpacing(n, Bbank, Lbank, randMin) : null;
  [['pb_sx', ms&&ms.sx],['pb_sy', ms&&ms.sy]].forEach(([id,val])=>{
    const f=document.getElementById(id), r=document.getElementById(id+'_r');
    if(autoSp && val!=null){ if(f) f.value=val.toFixed(2); if(r) r.value=val; }
    [f,r].forEach(el=>{ if(!el) return; el.disabled=autoSp; el.style.opacity=autoSp?'0.55':''; });
  });
  const h=document.getElementById('pb_sp_hint');
  if(h) h.textContent = autoSp
    ? `Abstände automatisch = max. bei Randabstand ≥ ${randMin.toFixed(2)} m (aus Bankett B/L). Für kleinere Abstände auf «manuell» wechseln.`
    : 'Abstände manuell — frei wählbar (kleiner als das Auto-Maximum für grössere Randabstände).';
}
// opt (nur intern): {nurRechnen:true, L:<m>} rechnet mit einer abweichenden Pfahllänge und gibt das
// Ergebnis zurück, ohne Panel, Bericht-Ablage und 3D anzufassen (Längenbemessung pbDimLaenge).
function renderPfahlbock(opt){
  if(CALC_MODEL!=='pfahlbock') return;
  const _nur = !!(opt && opt.nurRechnen === true);
  const cat=getMicropileSystems();
  let sys=cat[+gi('pb_sys')] || cat[0];
  let tdn=sys && (sys.vars[+gi('pb_var')] || sys.vars[0]);
  if(!sys || !tdn) return;
  let _dGrout=(+gi('pb_dG')||150)/1000, _einbau='verpresst', _Uramm=0, _starkQuer=true, _qb=0, _Ab=0, _rT=0;
  // ── Einzelpfahl: Querschnitt aus dem PROFIL-KATALOG der Fundamentsicherung (HEB / Krinner V,
  //    S355) statt eines Mikropfahl-Traggliedes. Die Profiltabelle liefert I_y und W_pl direkt
  //    (kein Kreisquerschnitt) → als tendon-Objekt mit I/Wpl-Override an pfahlbockAnalyse.
  //    Es gibt keinen Verpresskörper: laterale Breite und Mantelumfang folgen der Profilbreite.
  if(_pbEinzel()){
    const _ep=_pbEinzelProfil(), ps=_ep.ps, fy=_ep.fy;
    tdn=_ep.tdn;
    sys={ grade:_ep.grade, E:210000,
          vars:[tdn], LelemMax:(_ep.kr ? 2.0 : 0) };   // nur Krinner gestossen (Stoss = Gelenk), wie Sicherung
    { const rs=document.getElementById('pb-row-stahl'); if(rs) rs.style.display = _ep.kr ? 'none' : ''; }
    // Einbauart: gerammt/eingestellt (kein Verpresskörper, Breite = Profil) oder in einer Bohrung
    // verpresst/einbetoniert (Breite und Mantelfläche = Bohrdurchmesser).
    _einbau=(document.getElementById('pb_einbau')||{}).value==='verpresst' ? 'verpresst' : 'ramm';
    _dGrout=_einbau==='verpresst' ? Math.max(ps.b, (+gi('pb_dG')||150)/1000) : Math.max(0.05, ps.b);
    _Uramm = ps.round ? Math.PI*ps.b : 2*(ps.b + (ps.h||ps.b));           // Umriss für die Mantelreibung
    _starkQuer=(document.getElementById('pb_orient')||{}).value!=='laengs';
    // Spitzenwiderstand (nur Druck): q_b,k frei einzugeben, 0 = nicht angesetzt. Fläche: Stahlquerschnitt
    // oder umschriebene Fläche (Pfropfenbildung bzw. geschlossene Spitze / Bohrlochquerschnitt).
    // Spitzenwiderstand erst ab 0.30 m Pfahlbreite (EA-Pfähle: darunter gilt der Pfahl als Mikropfahl,
    // der nur über Mantelreibung trägt) — schmalere Profile: q_b,k wird NICHT angesetzt.
    const _bSp=_einbau==='verpresst' ? _dGrout : Math.min(ps.b, ps.h||ps.b), _spOk=_bSp >= 0.30 - 1e-9;
    _qb=_spOk ? Math.max(0,+gi('pb_qb')||0) : 0;
    { const f=document.getElementById('pb_qb'), sp=document.getElementById('pb_spitze'), h=document.getElementById('pb_qb_hint');
      [f,sp].forEach(el=>{ if(el){ el.disabled=!_spOk; el.style.opacity=_spOk?'':'0.5'; } });
      if(h){ h.style.display=_spOk?'none':''; h.textContent='Spitzenwiderstand nicht ansetzbar: Pfahlbreite '+(_bSp*1000).toFixed(0)+' mm < 300 mm (EA-Pfähle — schlanke Pfähle tragen rechnerisch nur über Mantelreibung).'; } }
    { const voll=(document.getElementById('pb_spitze')||{}).value==='voll';
      _Ab = !voll ? ps.A : _einbau==='verpresst' ? Math.PI*_dGrout*_dGrout/4
                  : ps.round ? Math.PI*ps.b*ps.b/4 : ps.b*(ps.h||ps.b);
      // Hebelarm der Mantelreibung um die Pfahlachse (Torsion): Rohr d/2; I-Profil ≈ 0.375·b
      // (Reibung an den Flanschaussenflächen mit Hebel h/2 und am Steg, bezogen auf den Umriss 2·(b+h)).
      _rT = _einbau==='verpresst' ? _dGrout/2 : ps.round ? ps.b/2 : 0.375*Math.min(ps.b, ps.h||ps.b); }
    { const ro=document.getElementById('pb-row-orient'); if(ro) ro.style.display = ps.round ? 'none' : ''; }
    const pi=document.getElementById('pb_prof_info');
    if(pi) pi.innerHTML=`${sys.grade} · A=${(ps.A*1e4).toFixed(1)} cm² · I_y=${(ps.Iy*1e8).toFixed(0)} cm⁴ · `
      +`W_pl=${(ps.Wply*1e6).toFixed(0)} cm³`
      +(ps.round ? '' : ` · schwache Achse I_z=${((ps.Iz||ps.Iy)*1e8).toFixed(0)} cm⁴ / W_pl,z=${((ps.Wplz||ps.Wply)*1e6).toFixed(0)} cm³`)+` · N_pl,k=${(ps.A*fy*1000).toFixed(0)} kN · Breite/Ø=${(ps.b*1000).toFixed(0)} mm`
      +(_ep.klasse>=3 ? `<br><span style="color:var(--warn)">Querschnittsklasse ${_ep.klasse}: Biegung elastisch bemessen (W_el = ${(tdn.Wpl*1e6).toFixed(0)} cm³ statt W_pl)${_ep.klasse===4?' — Klasse 4: örtliches Beulen ist gesondert nachzuweisen':''}.</span>` : '')
      +(_ep.kr ? `<br><span style="color:var(--warn)">${KRINNER_HINWEIS} Als biegebeanspruchter Einzelpfahl liegt die Anwendung ausserhalb der Genehmigung.${_ep.ps.zul?'':' Diese Baugrösse ist nicht Teil der Genehmigung (Abmessungen angenommen).'}</span>` : '');
  }
  const _Lfull=(opt && opt.L > 0) ? +opt.L : (+gi('pb_L')||10);                                  // Gesamtlänge (gestossen) — Axial/Bettung/Knicken
  const _LbendMax = sys.LelemMax || 0;                          // längstes Einzelelement → Biegelänge M+N (Stoss=Gelenk)
  // ── Böschung: geneigtes Gelände (auf- ODER abfallend, Pfahl auf/an der Böschung) reduziert die
  //    laterale Bettung der talseitigen (bergab zeigenden) Seite — bei umkehrender Lastrichtung
  //    (Wind ±) ist diese Seite immer massgebend. Faktor Kp,β/Kp mit |β|, global über die Einbinde-
  //    länge angesetzt (konservativ). Globale Standsicherheit (Gleitkreis) NICHT abgedeckt.
  const _slBeta=+gi('bg_beta')||0, _slBtyp=(document.getElementById('bg_btyp')||{}).value||'none';
  const _slopeActive = _slBtyp!=='none' && Math.abs(_slBeta) > 0.1;
  let _bettungFac=1;
  if(_slopeActive){ const _phiSl=+gi('bg_phi')||30;
    const _bfFull = Math.max(0.25, kpSlopeRankine(_phiSl, Math.abs(_slBeta)) / Math.max(1e-6, kpSlopeRankine(_phiSl, 0)));
    // Höhenwirkung (Jul 2026): endliche Böschung (h_β>0) mindert die Bettungsreduktion nur über den Anteil
    // h_β/L_Pfahl der Einbindelänge → weniger Reduktion; durchlaufend (h_β=0) = volle Reduktion (rückw.-kompat.).
    const _hbP=Math.max(0,+gi('bg_bhoehe')||0), _frP = _hbP>0 ? Math.min(1, _hbP/Math.max(0.5,_Lfull)) : 1;
    _bettungFac = 1 - (1 - _bfFull)*_frP; }
  const info=document.getElementById('pb_tendon_info');
  if(info) info.innerHTML=`${sys.grade} · A_s=${tdn.As} mm² · R_t,k=${micropileRtk(tdn).toFixed(0)} kN`+(tdn.Ftk?` · F_tk=${tdn.Ftk} kN`:'')
    +(_LbendMax?`<br><span style="color:var(--xdim)">gestossen: L=${_Lfull.toFixed(2)} m gesamt (N+V) · M+N über längstes Element ${Math.min(_Lfull,_LbendMax).toFixed(2)} m (Stoss = Gelenk)</span>`:'');
  const _ein = _pbEinzel();                    // Einzelpfahl: 1 Pfahl, Last direkt am Kopf
  const n=_ein ? 1 : (+gi('pb_n')||4);
  const ax=_ein ? 0 : (+gi('pb_ax')||0), ay=_ein ? 0 : (+gi('pb_ay')||0);
  // Bankett-Maße zuerst (Block ist Primär-Eingabe) — daraus folgen die max. Pfahlabstände
  const Bbank=Math.max(0.3,+gi('pb_bx')||2.0), Lbank=Math.max(0.3,+gi('pb_by')||2.0);
  const randMin=_pbRandMin();
  // ── Auto-Abstände: max. Pfahlabstand bei eingehaltenem Mindest-Randabstand (Optionen).
  //    Manuell-Modus (pb_auto=0) lässt die Felder frei (kleinere Werte möglich).
  const autoSp = gi('pb_auto')!=='0';
  if(!_ein) _pbApplySpacingMode(autoSp, n, Bbank, Lbank, randMin);
  const sx=+gi('pb_sx')||1.2, sy=+gi('pb_sy')||1.2;
  const piles=_pbPileLayout(n,sx,sy).map(p=>({ x:p.x, y:p.y, ..._pbIncl(p,ax,ay) }));   // Füsse symmetrisch nach aussen
  // ── Einwirkungen: Mastlasten aus Tab «Lasten» (am Lastangriff) → automatisch auf UK Bankett
  const dBank=_ein ? 0 : (+gi('pb_bank_d')||0.8), hKopf=_ein ? 0 : (+gi('pb_hk')||0);
  // Hebel Lastangriff → Pfahlkopf. Gruppe: OK Kopf → UK Bankett = H_Kopf + Bankettdicke.
  // Einzelpfahl: Lasten greifen DIREKT am Pfahlkopf an ⇒ kein Hebel.
  const hl = _ein ? 0 : (hKopf + dBank);
  // Eigengewicht Bankett + Fundamentkopf (Einzelpfahl: keines)
  const kx=_ein ? 0 : (+gi('pb_kx')||0), ky=_ein ? 0 : (+gi('pb_ky')||0), gBet=_gBetonMassiv();
  const G_kopf=kx*ky*hKopf*gBet;                         // Eigengewicht nur Fundamentkopf [kN] (exzentrisch)
  const G_eig=_ein ? 0 : ((Bbank*Lbank*dBank)*gBet + G_kopf);   // Eigengewicht Bankett + Kopf [kN]
  if(!_ein) _clampKopfEcc('pb_bx','pb_kx','pb_by','pb_ky','pb_ex','pb_ey');   // Kopf innerhalb Bankettkante halten
  const exK=_ein ? 0 : (+gi('pb_ex')||0), eyK=_ein ? 0 : (+gi('pb_ey')||0);   // Kopf-Exzentrizität [m]
  // ── Einwirkungen je LASTFALL (LF[]): quer/längs GETRENNT — kein gleichzeitiges Ansetzen
  //    von M_x (aus Längslasten) und M_y (aus Querlasten). Je LF zusätzlich γ_G,inf/sup auf die
  //    Vertikallast (Druck- vs. Zug/Herausziehen-massgebend). Massgebenden je Pfahl/Nachweis.
  const NG=+gi('l_NG')||0, HGx=+gi('l_HGx')||0, HGy=+gi('l_HGy')||0, MGx=+gi('l_MGx')||0, MGy=+gi('l_MGy')||0;
  const HQx=+gi('l_HWx')||0, HQy=+gi('l_HWy')||0, MQx=+gi('l_MWx')||0, MQy=+gi('l_MWy')||0;
  // Torsionsmoment um die Mastachse (ständig / veränderlich). Es hat keine Komponenten-Maske und
  // wirkt in JEDEM Lastfall (sichere Seite). Nur das Pfahlfundament führt es.
  const TG=+gi('l_TG')||0, TQ=+gi('l_TW')||0;
  const gGinf=+gi('lw_G_inf')||0.80;
  // Lastvektor auf UK Bankett aus den im LF aktiven Komponenten — dieselben drei Faktoren wie
  // beim Block (buildCombos, SIA 260 Typ 2): fE = Eigengewicht Fundament (Bankett + Kopf),
  // fG = ständige Mastlasten N_G/H_G/M_G GEMEINSAM (Einwirkungen gleichen Ursprungs tragen
  // denselben Beiwert), fQ = veränderlich. Momenten-Transfer Hy→Mx, Hx→My.
  const lfLoad=(lf,fE,fG,fQ)=>{ const c=lf.comp||{}, a=(f,v)=>f?v:0;
    const Ng=a(c.NG,NG), HxG=a(c.HGx,HGx),HyG=a(c.HGy,HGy),MxG=a(c.MGx,MGx),MyG=a(c.MGy,MGy);
    const HxW=a(c.HWx,HQx),HyW=a(c.HWy,HQy),MxW=a(c.MWx,MQx),MyW=a(c.MWy,MQy);
    const N=fG*Ng+fE*G_eig;
    // Exzentrizitätsmoment: nur die exzentrische Vertikallast (Mast + Kopf-Eigengewicht) — das
    // Bankett ist zentriert; e_x (quer) → M_y, e_y (längs) → M_x (wie Block: N·e).
    const Necc=fG*Ng+fE*G_kopf;
    return { N, Hx:fG*HxG+fQ*HxW, Hy:fG*HyG+fQ*HyW,
      Mx:fG*(MxG+HyG*hl)+fQ*(MxW+HyW*hl) + Necc*eyK, My:fG*(MyG+HxG*hl)+fQ*(MyW+HxW*hl) + Necc*exK,
      // Mast-Moment am OK Kopf (ohne H·Hebel) — für die 3D-Einwirkung, konsistent zum Block (inkl. Exzentrizität)
      MxApp:fG*MxG+fQ*MxW + Necc*eyK, MyApp:fG*MyG+fQ*MyW + Necc*exK,
      Mz:fG*TG+fQ*TQ,
      NMast:fG*Ng, fE, fG, fQ,
      // charakteristische Anteile für die Herleitung im Bericht (nur im Lastfall aktive Komponenten)
      teile:{ NG:Ng, Geig:G_eig, Gkopf:G_kopf, HxG, HxQ:HxW, HyG, HyQ:HyW, MxG, MxQ:MxW, MyG, MyQ:MyW, TG, TQ, hl, ex:exK, ey:eyK } }; };
  const ulsLF=LF.filter(lf=>lf.nw!=='gzg'), gzgLF=LF.filter(lf=>lf.nw!=='gzt');
  const ulsCombos=[];
  const _gfU=getGF({nw:'gzt'});   // Tragsicherheit: immer die GZT-Beiwerte der Lastbeiwerte-Karte
  // Je Lastfall der vollständige Satz von 8 Kombinationen — identisch zum Blockfundament.
  (ulsLF.length?ulsLF:LF).forEach(lf=>{
    const lc=lfLoad(lf,1,1,1);   // charakteristische Last (γ=1) für die k/d-Anzeige im 3D
    buildCombos(gGinf, _gfU.gG, _gfU.gW).forEach(cb=>
      ulsCombos.push({label:lf.name+' · Komb. '+cb.nr, lf:lf.name, nr:cb.nr, load:lfLoad(lf,cb.fE,cb.fG,cb.fQ), loadChar:lc}));
  });
  const gzgFullC=(gzgLF.length?gzgLF:LF).map(lf=>({label:lf.name, lf:lf.name, load:lfLoad(lf,1,1,1)}));
  const gzgVarC =(gzgLF.length?gzgLF:LF).map(lf=>({label:lf.name, lf:lf.name, load:lfLoad(lf,0,0,1)}));
  const r=pfahlbockAnalyse({ piles, L:_Lfull, e:_ein ? Math.max(0,+gi('pb_e')||0) : 0, LbendMax:_LbendMax, bettungFac:_bettungFac,
    zKopf:_ein ? 0 : Math.max(0,+gi('pb_ue')||0)+dBank,   // Tiefe des Pfahlkopfs (UK Bankett) unter Gelände
   
    dGrout:_dGrout, tendon:tdn, E_steel:sys.E, einzel:_ein, einbau:_einbau, Uramm:_Uramm, starkQuer:_starkQuer,
    qb:_qb, Ab:_Ab, rT:_rT, sx:sx, sy:sy,
    ulsCombos, gzgFull:gzgFullC, gzgVar:gzgVarC,
    // SIA 267 Kap. 9: γ_M,a Druck/Zug/quer, η_a nach Art der Bestimmung, innerer Widerstand η_i·R_mat,d.
    // Mikropfahl: Tragglied mit γ_s und η_i · Einzelpfahl (Stahlprofil): SIA 263 γ_M1, η_i = 1.0
    gMD:+gi('pb_gMD')||1.30, gMZ:+gi('pb_gMZ')||1.60, gMQ:+gi('pb_gMQ')||1.40, etaA:+gi('pb_etaA')||0.70,
    etaI:_ein ? 1.0 : (+gi('pb_etaI')||0.80), gammaS:_ein ? (+gi('pb_gM1')||1.05) : (+gi('pb_gS')||1.15),
    alphaZul:_tanZul(true), alphaZulVar:_tanZul(false),   // SBB 1:100 / 1:200 aus den Optionen
    skinFac:+gi('pb_skinfac')||1, zugFac:+gi('pb_zugfac')||1, zykFac:+gi('pb_zykfac')||1 });
  if(_nur) return r;
  // Böschungs-Status fürs Panel + Greifer
  r.slopeActive=_slopeActive; r.slopeBeta=_slBeta; r.slopeFac=_bettungFac;
  // Globale Böschungsstandsicherheit (Bishop) hier ENTFERNT (Jul 2026, Nutzerentscheid): der kritische
  // Gleitkreis schneidet die Tragglieder — für das Lamellenverfahren (reine Bodenscheiben) unzutreffend,
  // zumal der stabilisierende Pfahlbeitrag ohnehin vernachlässigt würde. Bishop bleibt dem FLACH-
  // fundament vorbehalten (Fundament nur als Auflast, kein Bauteil im Gleitkörper).
  r.bishop = null;
  // Knickkurve für ALLE hinterlegten Tragglieder (gleiche Geometrie/Boden → kbed,
  // nur EI und N_pl,k variieren je Stab) — zum Vergleich/zur Auswahl
  r.knickAll = [];
  cat.forEach(sysC => (sysC.vars||[]).forEach(v => {
    const As=(v.As||0)*1e-6, da=(v.da||50)/1000, di=Math.sqrt(Math.max(0, da*da - 4*As/Math.PI));
    const I=Math.PI/64*(Math.pow(da,4)-Math.pow(di,4)), EI=Math.max(1, r.Es*I);
    const Ncr=2*Math.sqrt(Math.max(1e-6, r.kbed*EI)), Npl=micropileRtk(v);
    const lam=Math.sqrt(Math.max(1e-9, Npl/Math.max(1e-6,Ncr)));
    const P=0.5*(1+0.49*(lam-0.2)+lam*lam), chi=Math.min(1, 1/(P+Math.sqrt(Math.max(0,P*P-lam*lam))));
    r.knickAll.push({ sys:sysC.grade||sysC.name||'', bez:v.bez||'', lam:+lam.toFixed(3), chi:+chi.toFixed(3), sel:(v===tdn) });
  }));
  // Draufsicht + Sohlkraft-Readout (links)
  const dGm=(+gi('pb_dG')||150)/1000;
  // Draufsicht + Randabstand nur bei Gruppe (Einzelpfahl hat kein Bankett)
  const dv=document.getElementById('pfahlbock-draufsicht');
  if(dv) dv.innerHTML = _ein ? '' : buildPfahlbockDraufsicht(piles, ax, ay, Bbank, Lbank, dGm);
  // Randabstand-Prüfung → Info-Banner (bei Eingabe Bankettabmessung / Pfahlabstand)
  const edgesB=_ein ? [Infinity] : piles.map(p=>_pbEdgeDist(p,Bbank,Lbank)), minE=Math.min(...edgesB);
  const stB=_ein ? [] : edgesB.map(e=>_pbEdgeStatus(e,dGm,randMin));
  const anyFail=stB.includes('fail'), anyWarn=stB.includes('warn');
  const mb=document.getElementById('pb_rand_msg');
  if(mb){
    if(anyFail||anyWarn){ const col=anyFail?'var(--fail)':'var(--warn)';
      mb.style.cssText='font-size:9.5px;line-height:1.45;padding:6px 8px;border-radius:5px;margin:6px 0;border:1px solid;display:block';
      mb.style.borderColor=col; mb.style.color=col;
      mb.innerHTML = anyFail
        ? `<b>Achtung:</b> Mindestens ein Pfahl schneidet die Bankettkante an oder liegt ausserhalb (Randabstand min ${minE.toFixed(2)} m &lt; Ø/2 = ${(dGm/2).toFixed(3)} m). Bankett vergrössern oder Pfahlabstand verkleinern.`
        : `<b>Hinweis:</b> Randabstand Pfahlmitte→Bankettkante min ${minE.toFixed(2)} m &lt; ${randMin.toFixed(2)} m (Mindestmass aus Optionen unterschritten).`;
    } else { mb.style.display='none'; mb.innerHTML=''; }
  }
  const sl=document.getElementById('pfahlbock-sole');
  const gl=r.govLoad||{};
  if(sl) sl.innerHTML=(_ein
      ? `Einzelpfahl · Lasten direkt am Pfahlkopf (kein Hebel, kein Eigengewicht) · L=${(+gi('pb_L')||0).toFixed(2)} m · Ø_G=${((+gi('pb_dG')||150)).toFixed(0)} mm · ${r.ulsCombosN||0} ULS-Kombinationen (je Lastfall 8, SIA 260)<br>`
      : `Hebel = ${hl.toFixed(2)} m (H_Kopf+Dicke) · Bankett ${Bbank.toFixed(1)}×${Lbank.toFixed(1)}×${dBank.toFixed(2)} m · ü=${(+gi('pb_ue')||0).toFixed(2)} m, G_eig=${G_eig.toFixed(0)} kN · ${r.ulsCombosN||0} ULS-Kombinationen (je Lastfall 8, SIA 260)<br>`)
    +`<b>${_ein?'Pfahlkopf':'UK Bankett'}, massgebend ${r.govCombo||'—'}:</b> N=${(gl.N||0).toFixed(0)} · H_x=${(gl.Hx||0).toFixed(0)} · H_y=${(gl.Hy||0).toFixed(0)} · M_x=${(gl.Mx||0).toFixed(0)} · M_y=${(gl.My||0).toFixed(0)} kN(m)`;
  // Nachweise → rechte Sidebar
  _renderPfahlbockResultsRight(r, piles, n);
  // Ergebnis für den Nachweisbericht ablegen (openNachweisplot → buildNachweisDocPfahl)
  RESULT.pfahlbock = { r, piles, n, viz:null };
  // Export-Button einblenden + beschriften (renderResults läuft im Pfahlfundament-Modus nicht)
  const _btnPlotPB = document.getElementById('btn-plot');
  if(_btnPlotPB){ _btnPlotPB.style.display='inline-flex';
    const _lbl=_btnPlotPB.querySelector('.tb-btn-lbl')||_btnPlotPB.childNodes[_btnPlotPB.childNodes.length-1];
    if(_lbl && _lbl.nodeType===3) _lbl.textContent=' Nachweisbericht Pfahlfundament'; }
  // 3D-Modell: Pfahlkräfte für die Kraftvektoren ablegen + Szene neu aufbauen.
  // Mastlast OHNE Bankett/Kopf-Eigengewicht für den Vertikal-Vektor (wie Block: nur die Einwirkung).
  const mastN = { k: Math.max(0, (r.govLoadChar&&r.govLoadChar.NMast)||0), d: Math.max(0, (r.govLoad&&r.govLoad.NMast)||0) };
  RESULT.pfahlbock.viz = { pileRes:r.pileRes, govLoad:r.govLoad, govLoadChar:r.govLoadChar, govCombo:r.govCombo, mastN };
  try{ rebuildScene(); }catch(err){ console.error('Pfahlfundament-3D rebuild:', err); }
}
// ── Bemessung der Pfahllänge bei gegebenem Querschnitt ──────────────────────────────────────────
// Sucht im 0.5-m-Raster die kleinste Länge, bei der alle aktiven Nachweise erfüllt sind. Einige
// Nachweise hängen nicht von der Länge ab (Querschnitt, Knicken, bei langen Pfählen auch die
// Kopfverformung) — bleibt einer davon unter 1, wird das gemeldet statt endlos zu verlängern.
function _pbGov(r){
  const c=[[nwOn('pfahl','geo')?r.etaGeo:Infinity,'Mantelreibung'],[nwOn('pfahl','geo')&&r.etaTors!=null?r.etaTors:Infinity,'Torsion'],[nwOn('pfahl','geo')&&r.etaAuf!=null?r.etaAuf:Infinity,'Aufbruchsicherheit'],
           [nwOn('pfahl','stahl')?r.etaSteel:Infinity,'Querschnitt'],[nwOn('pfahl','knick')?r.etaKnick:Infinity,'Knicken'],
           [nwOn('pfahl','lat')?r.etaLat:Infinity,'laterale Bodentragfähigkeit'],[nwOn('pfahl','gzg')?r.etaGZG:Infinity,'Gebrauchstauglichkeit']]
          .filter(x=>x[0]!=null && !isNaN(x[0])).sort((a,b)=>a[0]-b[0]);
  return c[0] || [Infinity,'–'];
}
function pbDimLaenge(){
  const msg=document.getElementById('pb_dim_msg'), LMIN=1.0, LMAX=30, STEP=0.5;
  const say=(t,bad)=>{ if(msg){ msg.style.display=''; msg.style.color=bad?'var(--fail)':'var(--dim)'; msg.innerHTML=t; } };
  let found=null, last=null;
  for(let L=LMIN; L<=LMAX+1e-9; L+=STEP){
    const r=renderPfahlbock({nurRechnen:true, L}); if(!r) continue;
    last={L, r};
    if(etaErf(r.eta_massg)){ found=last; break; }
  }
  if(!found){
    if(!last){ say('Keine Berechnung möglich.', true); return; }
    const g=_pbGov(last.r);
    say(`Bis L = ${LMAX.toFixed(0)} m nicht erfüllbar: massgebend bleibt <b>${g[1]}</b> mit η = ${isFinite(g[0])?g[0].toFixed(2):'∞'}. `
       +`Die Länge hilft hier nicht — grösseres Profil wählen`+(g[1]==='Querschnitt'||g[1]==='Knicken'?`, höhere Stahlgüte oder andere Ausrichtung`:``)+`.`, true);
    return;
  }
  const el=document.getElementById('pb_L'), rg=document.getElementById('pb_L_r');
  if(el) el.value=found.L.toFixed(2); if(rg) rg.value=found.L;
  renderPfahlbock();
  const g=_pbGov(found.r);
  say(`Kleinste Länge im 0.5-m-Raster: <b>L = ${found.L.toFixed(2)} m</b> · massgebend ${g[1]}, η = ${isFinite(g[0])?g[0].toFixed(2):'∞'}.`);
  if(typeof _checkDirty==='function') try{ _checkDirty(); }catch(_){}
}
// Pfahlfundament-Nachweise in die rechte Ergebnis-Sidebar (#res-scroll) + Pill
function _renderPfahlbockResultsRight(r, piles, n){
  const scroll=document.getElementById('res-scroll'); if(!scroll) return;
  scroll.style.display=''; scroll.innerHTML=_pbResultHTML(r, piles, n);
  const pill=document.getElementById('overall-pill');
  if(pill){ const e=r&&isFinite(r.eta_massg)?r.eta_massg:0;
    if(_etaRound(e)<1.0){ pill.className='pill pill-f'; pill.textContent='Nicht erfüllt'; }
    else if(r&&r.slopeActive){ pill.className='pill pill-w'; pill.textContent='Prüfen'; }   // Böschung: globale Standsicherheit offen → nicht blind „Erfüllt"
    else { pill.className='pill pill-ok'; pill.textContent='Erfüllt'; } }
  if(typeof _updateDrawerStatus==='function') _updateDrawerStatus();
}
// Draufsicht (SVG, live) — ECHTES Bankett (proportional), Pfähle zu Ø-Massstab, Neigungs-Pfeile,
// Bankett-Vermassung B/L und Randabstand Pfahlmitte→Bankettkante je Pfahl (Ampel: ok/orange/rot).
function buildPfahlbockDraufsicht(piles, ax, ay, Bbank, Lbank, dG){
  if(!piles || !piles.length) return '';
  Bbank=Math.max(0.3,Bbank||2); Lbank=Math.max(0.3,Lbank||2); dG=Math.max(0.05,dG||0.15);
  const rP=dG/2;
  const xs=piles.map(p=>p.x), ys=piles.map(p=>p.y);
  // Darstellungsbereich = Vereinigung Bankett ∪ Pfähle (Pfähle können überstehen)
  const xExt=Math.max(Bbank/2, Math.max(...xs.map(Math.abs))+rP);
  const yExt=Math.max(Lbank/2, Math.max(...ys.map(Math.abs))+rP);
  const mgn=Math.max(0.30, xExt*0.26, yExt*0.26);
  const W=2*(xExt+mgn), H=2*(yExt+mgn);
  const VB=232, padX=30, padTop=22, padBot=34;
  const sc=Math.min((VB-2*padX)/Math.max(0.2,W), 150/Math.max(0.2,H));
  const HB=Math.round(H*sc+padTop+padBot);
  const X=x=>VB/2+x*sc, Y=y=>padTop+10+(yExt+mgn-y)*sc;   // 0-zentriert, y oben = +längs
  const rpx=Math.max(2.8, rP*sc);
  const randMin=_pbRandMin();
  const edges=piles.map(p=>_pbEdgeDist(p,Bbank,Lbank));
  const stat=edges.map(e=>_pbEdgeStatus(e,dG,randMin));
  const colOf={ok:'var(--dim)', warn:'var(--warn)', fail:'var(--fail)'};
  let s=`<svg viewBox="0 0 ${VB} ${HB}" width="100%" style="max-width:264px;display:block;margin:0 auto 8px">
  <rect width="${VB}" height="${HB}" rx="4" fill="var(--s2)" stroke="var(--ol)" stroke-width="0.8"/>
  <text x="${VB/2}" y="13" font-family="var(--f-mono)" font-size="8" letter-spacing=".08em" text-anchor="middle" fill="var(--dim)">DRAUFSICHT — BANKETT &amp; PFÄHLE</text>
  <rect x="${X(-Bbank/2).toFixed(1)}" y="${Y(Lbank/2).toFixed(1)}" width="${(Bbank*sc).toFixed(1)}" height="${(Lbank*sc).toFixed(1)}" rx="2" fill="var(--acc)" fill-opacity="0.06" stroke="var(--on)" stroke-width="1.2"/>`;
  piles.forEach((p,i)=>{ const px=X(p.x), py=Y(p.y), c=colOf[stat[i]];
    const dx=Math.sign(p.x), dy=Math.sign(p.y), nn=Math.hypot(dx,dy)||1, nx=dx/nn, ny=dy/nn, aL=rpx+10;
    if(dx||dy){ s+=`<line x1="${px.toFixed(1)}" y1="${py.toFixed(1)}" x2="${(px+nx*aL).toFixed(1)}" y2="${(py-ny*aL).toFixed(1)}" stroke="var(--xdim)" stroke-width="1"/>
      <polygon points="${(px+nx*aL).toFixed(1)},${(py-ny*aL).toFixed(1)} ${(px+nx*(aL-4)-ny*2.2).toFixed(1)},${(py-ny*(aL-4)-nx*2.2).toFixed(1)} ${(px+nx*(aL-4)+ny*2.2).toFixed(1)},${(py-ny*(aL-4)+nx*2.2).toFixed(1)}" fill="var(--xdim)"/>`; }
    s+=`<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${rpx.toFixed(1)}" fill="${c}" fill-opacity="0.85" stroke="${c}" stroke-width="1.2"/>
    <text x="${px.toFixed(1)}" y="${(py+rpx*0.45).toFixed(1)}" font-family="var(--f-mono)" font-size="${Math.max(6,rpx*0.85).toFixed(0)}" text-anchor="middle" fill="var(--bg)">${i+1}</text>`;
  });
  // ── Vermassungskette Rand–Pfahl–…–Rand (B unten · L links). Rand-Segmente nach Status eingefärbt.
  const uniq=(a)=>[...new Set(a.map(v=>+v.toFixed(3)))].sort((p,q)=>p-q);
  const segCol=d=> d < dG/2 ? 'var(--fail)' : d < randMin ? 'var(--warn)' : 'var(--dim)';
  const DM='var(--dim)';
  const yB=Y(-(yExt+mgn*0.45)), xL=X(-(xExt+mgn*0.45));
  // B-Kette (horizontal): −B/2 · Pfahlspalten · +B/2
  const chX=[-Bbank/2, ...uniq(xs), Bbank/2];
  s+=`<line x1="${X(chX[0]).toFixed(1)}" y1="${yB.toFixed(1)}" x2="${X(chX[chX.length-1]).toFixed(1)}" y2="${yB.toFixed(1)}" stroke="${DM}" stroke-width="0.7"/>`;
  chX.forEach(xw=>{ const xx=X(xw); s+=`<line x1="${xx.toFixed(1)}" y1="${(yB-3).toFixed(1)}" x2="${xx.toFixed(1)}" y2="${(yB+3).toFixed(1)}" stroke="${DM}" stroke-width="0.7"/>`; });
  for(let i=0;i<chX.length-1;i++){ const a=chX[i],b=chX[i+1],len=b-a,mid=(a+b)/2,isEdge=(i===0||i===chX.length-2);
    s+=`<text x="${X(mid).toFixed(1)}" y="${(yB+10).toFixed(1)}" font-family="var(--f-mono)" font-size="7" text-anchor="middle" fill="${isEdge?segCol(len):DM}">${len.toFixed(2)}</text>`; }
  // L-Kette (vertikal): −L/2 · Pfahlreihen · +L/2
  const chY=[-Lbank/2, ...uniq(ys), Lbank/2];
  s+=`<line x1="${xL.toFixed(1)}" y1="${Y(chY[0]).toFixed(1)}" x2="${xL.toFixed(1)}" y2="${Y(chY[chY.length-1]).toFixed(1)}" stroke="${DM}" stroke-width="0.7"/>`;
  chY.forEach(yw=>{ const yy=Y(yw); s+=`<line x1="${(xL-3).toFixed(1)}" y1="${yy.toFixed(1)}" x2="${(xL+3).toFixed(1)}" y2="${yy.toFixed(1)}" stroke="${DM}" stroke-width="0.7"/>`; });
  for(let i=0;i<chY.length-1;i++){ const a=chY[i],b=chY[i+1],len=b-a,mid=(a+b)/2,isEdge=(i===0||i===chY.length-2);
    const yy=Y(mid), tx=(xL-4).toFixed(1);
    s+=`<text x="${tx}" y="${yy.toFixed(1)}" font-family="var(--f-mono)" font-size="7" text-anchor="middle" fill="${isEdge?segCol(len):DM}" transform="rotate(-90 ${tx} ${yy.toFixed(1)})">${len.toFixed(2)}</text>`; }
  s+=`</svg>`;
  return s;
}
// Generisch: Wert im fokussierten Zahlenfeld per Mausrad ändern (Raster = step)
document.addEventListener('wheel', function(e){
  const el=document.activeElement;
  if(!el || el.tagName!=='INPUT' || el.type!=='number' || el!==e.target) return;
  e.preventDefault();
  const step=parseFloat(el.step)||1, dec=(String(el.step).split('.')[1]||'').length;
  let v=(parseFloat(el.value)||0)+(e.deltaY<0?1:-1)*step;
  v=Math.round(v/step)*step;
  if(el.min!=='' && v<parseFloat(el.min)) v=parseFloat(el.min);
  if(el.max!=='' && v>parseFloat(el.max)) v=parseFloat(el.max);
  el.value=dec>0?v.toFixed(dec):String(Math.round(v));
  el.dispatchEvent(new Event('input',{bubbles:true}));
}, {passive:false});

// ════════════════════════════════════════════
