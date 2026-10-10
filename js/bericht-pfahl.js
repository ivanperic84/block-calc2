// BlockCalc — js/bericht-pfahl.js
// Nachweisbericht Pfahlfundament
// NACHWEISBERICHT PFAHLFUNDAMENT (Mikropfahl-Gruppe)
// ════════════════════════════════════════════════════════════════
function buildNachweisDocPfahl(r, piles, n){
  const st=collectState();
  const now=new Date(), datStr=st.p_datum||now.toLocaleDateString('de-CH');
  const N=(v,d)=>_npN(v,d);
  const ph=()=>_npPH(st,datStr);
  const ch=_npCh, sh2=_npSh2, hr=_npHr, fml=_npCalc, nwh=_npNwh;
  const eta=v=>{ if(!isFinite(v)) return `<span class="np-eta ok">η = ∞ ✓</span>`; const ok=etaErf(v); return `<span class="np-eta ${ok?'ok':'fail'}">η = ${v.toFixed(2)}${ok?' ≥ 1.0 ✓':' < 1.0 ✗'}</span>`; };
  // Abbildung aus einem Diagramm-Builder (try/catch — ein Diagrammfehler bricht den Bericht nicht;
  // .np-fig → wird vom Abbildungen-Toggle mitgeschaltet). SVG in max. 460 px Breite skaliert.
  // wide=true → grössere viewBox; beim Einpassen in max-width 440px skaliert die SVG-Schrift HERUNTER
  // (statt hoch wie bei den kompakten Sidebar-Diagrammen) → Diagrammtext ≈/≤ Berichttext.
  const figFn=(fn,cap)=>{ let s=''; try{ s=fn()||''; }catch(e){ s=''; }
    return s?`<div class="np-fig" style="margin:8px 0;text-align:center"><div style="max-width:440px;margin:0 auto">${s}</div>${cap?`<div style="font-size:8px;color:var(--xdim);margin-top:2px">${cap}</div>`:''}</div>`:''; };

  // ── Geometrie/Eingaben
  const Bb=+gi('pb_bx')||2, Lb=+gi('pb_by')||2, dB=+gi('pb_bank_d')||0.8, ue=+gi('pb_ue')||0;
  const kx=+gi('pb_kx')||0, ky=+gi('pb_ky')||0, hk=+gi('pb_hk')||0, ex=+gi('pb_ex')||0, ey=+gi('pb_ey')||0;
  const ax=+gi('pb_ax')||0, ay=+gi('pb_ay')||0, Lp=+gi('pb_L')||10, dG=(+gi('pb_dG')||150)/1000;
  const gR=r.gMD||1.3, gS=r.gammaS||1.15;   // γ_M,a Druck bzw. γ_s / γ_M1 aus dem Ergebnis
  const cat=(typeof getMicropileSystems==='function')?getMicropileSystems():[];
  let sys=cat[+gi('pb_sys')]||cat[0]||{grade:'',vars:[]};
  let tdn=(sys.vars&&sys.vars[+gi('pb_var')])||(sys.vars&&sys.vars[0])||{};
  // Einzelpfahl: Querschnitt aus dem Sicherungs-Profilkatalog (HEB/Krinner) statt Tragglied
  if(_pbEinzel()){
    const ep=_pbEinzelProfil();
    tdn=ep.tdn; sys={ grade:ep.grade, vars:[tdn] };
  }
  const modelImg=window._npModelImg||null;
  const viewImg=(typeof captureViewerWithDimPNG==='function')?captureViewerWithDimPNG():null;

  const gL=r.govLoad||{}, Hd=Math.hypot(gL.Hx||0, gL.Hy||0);
  const govF=r.govPile>=0?Math.abs((r.pileRes[r.govPile]||{}).F||0):0;
  const govZug=r.govPile>=0 && !!(r.pileRes[r.govPile]||{}).zug;
  const g=r.gzgFull, gv=r.gzgVar;
  const etaInner=Math.min(r.etaSteel, r.etaKnick);
  const allOk=isFinite(r.eta_massg) && r.eta_massg>=1.0;

  // ── Deckblatt
  const cover=`<div class="np-page np-pb">${ph()}${_npLogo()}
    <div class="np-firma">${esc(SETTINGS.firma||'BlockCalc SIA 267')}</div>
    <div class="np-ct">Standsicherheitsnachweis</div>
    <div class="np-ct" style="font-size:13px;margin-bottom:4px">Pfahlfundament · Mikropfahl-Gruppe · SIA 267:2013</div>
    <div class="np-cs">${_pbEinzel()
      ? 'Standsicherheit (GZT) und Gebrauchstauglichkeit (GZG) eines Einzelpfahls mit Lastangriff am Pfahlkopf (Mantelreibung)'
      : 'Standsicherheit (GZT) und Gebrauchstauglichkeit (GZG) eines starren Banketts auf geneigten Mikropfählen (Mantelreibung)'}</div>
    <div class="np-cblock">
      <div class="np-cmeta">
        <span class="k">Bauteil / Objekt</span><span class="v">${esc(st.p_name||'–')}</span>
        <span class="k">Fundamentbezeichnung</span><span class="v">${esc(st.p_fundname||'–')}</span>
        <span class="k">Projektnummer</span><span class="v">${esc(st.p_nr||'–')}</span>
        <span class="k">Bearbeiter</span><span class="v">${esc(st.p_bearbeiter||SETTINGS.bearbeiter||'–')}</span>
        <span class="k">Datum</span><span class="v">${datStr}</span>
        <span class="k">${_pbEinzel()?'Profil':'Tragglied'}</span><span class="v">${(sys.grade||'')}${tdn.bez?' · '+tdn.bez:''}</span>
      </div>
      ${sh2('Normgrundlagen')}
      <table class="np-tbl" style="margin-bottom:14px">
        <tr><th>Norm</th><th>Titel</th><th>Anwendung</th></tr>
        <tr><td>SIA 267:2013</td><td>Geotechnik</td><td>Nachweisformate GZT/GZG, Teilsicherheiten, Mantelreibung (γ_R)</td></tr>
        <tr><td>SIA 263</td><td>Stahlbau</td><td>Knicknachweis (Knickkurve c, elastische Bettung)</td></tr>
        <tr><td>EA-Pfähle / DIN 4128</td><td>Verpress-/Mikropfähle</td><td>Erfahrungswerte Mantelreibung q_s,k (tiefenkonstant)</td></tr>
        <tr><td>SBB 0161.1011.0007</td><td>Fahrleitungsfundamente</td><td>GZG-Grenzwerte Schiefstellung / Horizontalverschiebung</td></tr>
      </table>
      ${sh2('Berechnungskonzept')}
      <div style="font-size:8.5px;color:var(--dim);line-height:1.7;margin-bottom:14px">
      ${_pbEinzel()
        ? 'Die Mastlasten greifen <b>direkt am Pfahlkopf</b> an (kein Bankett, kein Fundamentkopf, kein Lasthebel, kein Eigengewicht). Der Pfahl trägt die Vertikallast axial'
        : 'Das starre Bankett verteilt die Mastlasten über räumliches Gruppengleichgewicht (6 Freiheitsgrade) auf die geneigten Mikropfähle. Jeder Pfahl trägt primär axial'}
      (${r.Rb_k>0 ? 'Mantelreibung und Spitzenwiderstand aus eingegebenem q_b,k' : _pbEinzel() ? 'Mantelreibung; Spitzenwiderstand nicht angesetzt' : 'Mantelreibung; Spitzendruck bei d_G ≤ 300 mm vernachlässigt'}); die laterale
      Bettung (p-y, geschichtet) liefert die Biegung${_pbEinzel()?' — das Moment wird allein über Biegung und Bettung abgetragen (biegesteifer Kopfanschluss vorausgesetzt)':''}. Nachgewiesen: äusserer Tragwiderstand (R_s,d), innerer Tragwiderstand
      (Querschnitt N+M sowie Knicken SIA 263) und GZG (Schiefstellung / Verschiebung nach SBB).
      Nachweis η = Widerstand / Einwirkung ≥ 1.0. Bei geneigtem Gelände wird die laterale Bettung talseitig abgemindert.
      </div>
      ${modelImg?`<div class="np-fig" style="margin:6px 0 14px;text-align:center"><img src="${modelImg}" style="max-width:74%;border:1px solid var(--ol);border-radius:3px"/><div style="font-size:8px;color:var(--xdim);margin-top:3px">Abb. 1 — 3D-Modell (aktuelle Ansicht)</div></div>`:''}
      <table class="np-tbl" style="width:55%"><tr><th>Rev.</th><th>Datum</th><th>Beschreibung</th><th>Visum</th></tr><tr><td>0</td><td>${datStr}</td><td>Erstausgabe</td><td>${esc(st.p_bearbeiter||SETTINGS.bearbeiter||'')}</td></tr></table>
    </div>
  </div>`;

  // ── Kap 1: System und Geometrie
  const page1=`<div class="np-page np-pb">${ph()}
    ${ch('1','System und Geometrie')}
    <div class="np-geo">
      ${viewImg?`<div style="width:50%;min-width:240px"><img src="${viewImg}" style="width:100%;border-radius:4px;border:0.5px solid var(--ol)"/></div>`:''}
      <div style="flex:1">
        ${_pbEinzel() ? `
        ${sh2('Ausführung')}
        <table class="np-tbl">
          <tr><th>Grösse</th><th>Symbol</th><th class="r">Wert</th></tr>
          <tr><td>Fundamentart</td><td>–</td><td class="r">Einzelpfahl</td></tr>
          <tr><td>Bankett / Fundamentkopf</td><td>–</td><td class="r">keine</td></tr>
          <tr><td>Lastangriff</td><td>–</td><td class="r">direkt am Pfahlkopf</td></tr>
        </table>` : `
        ${sh2('Bankett und Fundamentkopf')}
        <table class="np-tbl">
          <tr><th>Grösse</th><th>Symbol</th><th class="r">Wert</th></tr>
          <tr><td>Bankett B × L × d</td><td>B/L/d</td><td class="r">${N(Bb)} × ${N(Lb)} × ${N(dB)} m</td></tr>
          <tr><td>Überdeckung</td><td>ü</td><td class="r">${N(ue)} m</td></tr>
          <tr><td>Fundamentkopf B × L × H</td><td>–</td><td class="r">${N(kx)} × ${N(ky)} × ${N(hk)} m</td></tr>
          <tr><td>Kopf-Exzentrizität</td><td>e_x / e_y</td><td class="r">${N(ex)} / ${N(ey)} m</td></tr>
        </table>`}
        ${sh2(_pbEinzel()?'Pfahl':'Pfahlgruppe')}
        <table class="np-tbl">
          <tr><th>Grösse</th><th>Symbol</th><th class="r">Wert</th></tr>
          <tr><td>Pfahlzahl</td><td>n</td><td class="r">${n}</td></tr>
          <tr><td>Neigung quer / längs</td><td>α_x / α_y</td><td class="r">${N(ax)}° / ${N(ay)}°</td></tr>
          <tr><td>Pfahllänge (Einbindung)</td><td>L</td><td class="r">${N(Lp)} m</td></tr>
          <tr><td>Verpresskörper-Ø</td><td>d_G</td><td class="r">${(dG*1000).toFixed(0)} mm</td></tr>
          <tr><td>${_pbEinzel()?'Profil':'Tragglied'}</td><td>–</td><td class="r">${(sys.grade||'')}${tdn.bez?' '+tdn.bez:''}</td></tr>
          <tr><td>R_t,k Streckgrenzkraft</td><td>R_t,k</td><td class="r">${N(r.N_pl_k)} kN</td></tr>
        </table>
      </div>
    </div>
  </div>`;

  // ── Kap 2: Baugrund
  const schRows=SCHICHTEN.map((s,i)=>`<tr><td>${i+1}</td><td>${esc(s.name||'Schicht '+(i+1))}</td><td class="r">${N(s.phi)}</td><td class="r">${N(s.c)}</td><td class="r">${N(s.gamma)}</td><td class="r">${s.d===999?'∞':N(s.d)}</td><td class="r">${N(s.me||0)}</td></tr>`).join('');
  const skL=r.skinLayers||[];
  const skRows=skL.map((l,i)=>`<tr><td>${l.name||l.preset||'Schicht '+(i+1)}</td><td class="r">${N(l.z0)}–${N(l.z1)} m</td><td class="r">${l.qs}</td><td class="r">${N(l.dz)} m</td><td class="r">${N(l.dRk)}</td></tr>`).join('');
  const page2=`<div class="np-page np-pb">${ph()}
    ${ch('2','Baugrund')}
    ${sh2('Bodenschichten')}
    <table class="np-tbl" style="margin-bottom:10px">
      <tr><th>#</th><th>Bezeichnung</th><th class="r">φ' [°]</th><th class="r">c' [kPa]</th><th class="r">γ [kN/m³]</th><th class="r">d [m]</th><th class="r">M_E [MN/m²]</th></tr>
      ${schRows}
    </table>
    ${sh2('Mantelreibung q_s,k je Schicht (Umfang U = π·d_G = '+N(Math.PI*dG,3)+' m)')}
    <table class="np-tbl">
      <tr><th>Schicht</th><th class="r">Tiefe</th><th class="r">q_s,k [kPa]</th><th class="r">Δz [m]</th><th class="r">ΔR = q_s,k·U·Δz [kN]</th></tr>
      ${skRows}
      <tr class="hl"><td colspan="4"><b>Σ R_s,k (charakteristisch, η_g = ${N(r.grpEta||1,2)})</b></td><td class="r"><b>${N(r.Rskin_k)} kN</b></td></tr>
    </table>
    <div style="font-size:8px;color:var(--xdim);margin-top:4px">${r.skinModel==='ramm' ? 'Gerammtes/eingedrehtes Stahlprofil ohne Verpresskörper: q_s(z) = K₀·σ′v·tan(⅔·φ′) am Profilumriss (tiefenabhängig); Kohäsion nicht angesetzt.' : 'q_s,k = Erfahrungswert (EA-Pfähle, verpresster Mikropfahl, tiefenkonstant) bzw. Tabellen-/Probebelastungswert.'} Gruppenwirkungsgrad η_g aus mittlerem Achsabstand s̄/D (volle Effizienz ab 6·D). ${r.Rb_k>0 ? 'Spitzenwiderstand aus eingegebenem q_b,k = '+r.qb+' kPa (nur Druck).' : 'Spitzendruck nicht angesetzt.'}</div>
  </div>`;

  // ── Herleitung der Bemessungslasten der massgebenden Kombination aus den charakteristischen Anteilen
  const herleitung=(()=>{ const T=gL.teile; if(!T) return '';
    const fE=gL.fE, fG=gL.fG, fQ=gL.fQ, f=(v,d)=>(+v||0).toFixed(d==null?1:d), h=T.hl||0, ein=_pbEinzel();
    const z=(sym,formel,ein_,res,u)=>`<tr><td>${sym}</td><td>${formel}</td><td>${ein_}</td><td class="r"><b>${f(res)}</b> ${u}</td></tr>`;
    const Necc=fG*T.NG+fE*T.Gkopf;
    let rows='';
    rows+=z('N_d', ein?'γ_G·N_G':'γ_G·N_G + γ_Eig·G_eig', ein?`${f(fG,2)}·${f(T.NG)}`:`${f(fG,2)}·${f(T.NG)} + ${f(fE,2)}·${f(T.Geig)}`, gL.N, 'kN');
    rows+=z('H_xd', 'γ_G·H_Gx + γ_Q·H_Wx', `${f(fG,2)}·${f(T.HxG)} + ${f(fQ,2)}·${f(T.HxQ)}`, gL.Hx, 'kN');
    rows+=z('H_yd', 'γ_G·H_Gy + γ_Q·H_Wy', `${f(fG,2)}·${f(T.HyG)} + ${f(fQ,2)}·${f(T.HyQ)}`, gL.Hy, 'kN');
    rows+=z('M_yd', ein?'γ_G·M_Gy + γ_Q·M_Wy':'γ_G·(M_Gy + H_Gx·h) + γ_Q·(M_Wy + H_Wx·h) + N_exz·e_x',
            ein?`${f(fG,2)}·${f(T.MyG)} + ${f(fQ,2)}·${f(T.MyQ)}`:`${f(fG,2)}·(${f(T.MyG)} + ${f(T.HxG)}·${f(h,2)}) + ${f(fQ,2)}·(${f(T.MyQ)} + ${f(T.HxQ)}·${f(h,2)}) + ${f(Necc)}·${f(T.ex,2)}`, gL.My, 'kNm');
    rows+=z('M_xd', ein?'γ_G·M_Gx + γ_Q·M_Wx':'γ_G·(M_Gx + H_Gy·h) + γ_Q·(M_Wx + H_Wy·h) + N_exz·e_y',
            ein?`${f(fG,2)}·${f(T.MxG)} + ${f(fQ,2)}·${f(T.MxQ)}`:`${f(fG,2)}·(${f(T.MxG)} + ${f(T.HyG)}·${f(h,2)}) + ${f(fQ,2)}·(${f(T.MxQ)} + ${f(T.HyQ)}·${f(h,2)}) + ${f(Necc)}·${f(T.ey,2)}`, gL.Mx, 'kNm');
    if(Math.abs(T.TG)+Math.abs(T.TQ)>1e-9) rows+=z('T_d', 'γ_G·T_G + γ_Q·T_W', `${f(fG,2)}·${f(T.TG)} + ${f(fQ,2)}·${f(T.TQ)}`, gL.Mz, 'kNm');
    return sh2('Herleitung der Bemessungswerte — '+(r.govCombo||''))
      +`<div style="font-size:8px;color:var(--xdim);margin-bottom:6px">Beiwerte dieser Kombination: γ_Eig = ${f(fE,2)} (Eigengewicht Fundament) · γ_G = ${f(fG,2)} (ständige Mastlasten) · γ_Q = ${f(fQ,2)} (veränderlich). Eingesetzt sind die im Lastfall aktiven charakteristischen Anteile${ein?'':`; h = ${f(h,2)} m (OK Kopf → UK Bankett), N_exz = γ_G·N_G + γ_Eig·G_Kopf = ${f(Necc)} kN (exzentrischer Anteil), G_eig = ${f(T.Geig)} kN (Bankett + Kopf)`}.</div>`
      +`<table class="np-tbl"><tr><th>Grösse</th><th>Formel</th><th>Einsetzen</th><th class="r">Bemessungswert</th></tr>${rows}</table>`; })();
  // ── Alle Kombinationen mit Lasten und η (C1)
  const kombTab=(()=>{ const K=r.kombs||[]; if(!K.length) return '';
    const lfs=[...new Set(K.map(k=>k.lf))];
    return lfs.map(lf=>sh2('Kombinationen — '+esc(lf))+_npKombTab(K.filter(k=>k.lf===lf).map(k=>({nr:k.nr, fE:k.load.fE, fG:k.load.fG, fQ:k.load.fQ, l:k.load, eta:k.eta})), [
      {t:'N_d [kN]', v:k=>k.l.N, d:1}, {t:'H_xd [kN]', v:k=>k.l.Hx, d:1}, {t:'H_yd [kN]', v:k=>k.l.Hy, d:1},
      {t:'M_xd [kNm]', v:k=>k.l.Mx, d:1}, {t:'M_yd [kNm]', v:k=>k.l.My, d:1},
      {t:'η min', v:k=>k.eta, eta:true}], 'η min = kleinstes η aus Mantelreibung und Querschnitt über alle Pfähle; Knicken, laterale Bodentragfähigkeit'+(r.etaTors!=null?', Torsion':'')+' und Gebrauchstauglichkeit stehen in Kap. 5 und 6.')).join(''); })();
  // ── Kap 3: Einwirkungen
  const page3=`<div class="np-page np-pb">${ph()}
    ${ch('3','Einwirkungen')}
    ${sh2('Charakteristische Mastlasten (OK Kopf)')}
    <table class="np-tbl" style="margin-bottom:10px">
      <tr><th>Komponente</th><th>Symbol</th><th class="r">Ständig G</th><th class="r">Veränderlich W</th><th>Einheit</th></tr>
      <tr><td>Vertikalkraft</td><td>N</td><td class="r">${N(+gi('l_NG'))}</td><td class="r">–</td><td>kN</td></tr>
      <tr><td>Horizontalkraft quer</td><td>H_x</td><td class="r">${N(+gi('l_HGx'))}</td><td class="r">${N(+gi('l_HWx'))}</td><td>kN</td></tr>
      <tr><td>Horizontalkraft längs</td><td>H_y</td><td class="r">${N(+gi('l_HGy'))}</td><td class="r">${N(+gi('l_HWy'))}</td><td>kN</td></tr>
      <tr><td>Moment x-Achse</td><td>M_x</td><td class="r">${N(+gi('l_MGx'))}</td><td class="r">${N(+gi('l_MWx'))}</td><td>kNm</td></tr>
      <tr><td>Moment y-Achse</td><td>M_y</td><td class="r">${N(+gi('l_MGy'))}</td><td class="r">${N(+gi('l_MWy'))}</td><td>kNm</td></tr>
      ${(+gi('l_TG')||+gi('l_TW')) ? `<tr><td>Torsion um die Mastachse</td><td>T</td><td class="r">${N(+gi('l_TG'))}</td><td class="r">${N(+gi('l_TW'))}</td><td>kNm</td></tr>` : ''}
    </table>
    ${sh2(_pbEinzel() ? 'Kräfte am Pfahlkopf — massgebende Kombination' : 'Sohlkräfte UK Bankett — massgebende Kombination')}
    <div style="font-size:8px;color:var(--xdim);margin-bottom:6px">${_pbEinzel()
      ? `Mastlasten wirken direkt am Pfahlkopf — kein Momenten-Transfer (Hebel = 0), kein Eigengewicht, keine Exzentrizität.`
      : `Momenten-Transfer OK Kopf → UK Bankett: H_y→M_x, H_x→M_y (Hebel H_Kopf + Bankettdicke), inkl. Bankett-/Kopf-Eigengewicht und Kopf-Exzentrizität.`} ${r.ulsCombosN||0} ULS-Kombinationen (je Lastfall 8: Eigengewicht inf/sup × ständig inf/sup × veränderlich 0/γ_Q, SIA 260).</div>
    <table class="np-tbl">
      <tr><th>Massgebend</th><th class="r">N_d [kN]</th><th class="r">H_xd [kN]</th><th class="r">H_yd [kN]</th><th class="r">|H_d| [kN]</th><th class="r">M_xd [kNm]</th><th class="r">M_yd [kNm]</th></tr>
      <tr class="hl"><td><b>${r.govCombo||'—'}</b></td><td class="r">${N(gL.N)}</td><td class="r">${N(gL.Hx)}</td><td class="r">${N(gL.Hy)}</td><td class="r"><b>${N(Hd)}</b></td><td class="r">${N(gL.Mx)}</td><td class="r">${N(gL.My)}</td></tr>
    </table>
    ${herleitung}
  </div>`;

  // ── Kap 4: Pfahlkräfte
  const pileRows=(r.pileRes||[]).map((p,i)=>{
    const eg=Math.min(p.eGeo,p.eSteel);
    const govCls=(i===r.govPile)?' class="hl"':'';
    return `<tr${govCls}><td>P${i+1}${i===r.govPile?' <b>(massg.)</b>':''}</td><td>${(p.lf||'').replace(/\s*·.*/,'')}</td><td class="r">${N(p.F)}</td><td>${p.zug?'Zug':'Druck'}</td><td class="r">${N(p.Mp)}</td><td class="r ${eg>=1?'ok':'fail'}">${isFinite(eg)?eg.toFixed(2):'∞'}</td></tr>`;
  }).join('');
  const page4=`<div class="np-page np-pb">${ph()}
    ${ch('4','Pfahlkräfte (ULS, Bemessungswerte)')}
    <div style="font-size:8px;color:var(--xdim);margin-bottom:6px">Axialkraft je Pfahl aus dem räumlichen Gruppengleichgewicht, massgebende Kombination je Pfahl über alle ${r.ulsCombosN||0} Kombinationen. Vorzeichen N: + Druck / − Zug. η = min(η_Geo, η_Stahl).</div>
    <table class="np-tbl">
      <tr><th>Pfahl</th><th>Lastfall</th><th class="r">N [kN]</th><th>Art</th><th class="r">M [kNm]</th><th class="r">η</th></tr>
      ${pileRows}
    </table>
    ${kombTab}
  </div>`;

  // ── Kap 5: GZT-Nachweise
  const page5=`<div class="np-page np-pb">${ph()}
    ${ch('5','Grenzzustand der Tragfähigkeit (GZT)')}
    <div class="np-nw">
      ${nwh('5.1','Äusserer Tragwiderstand — Mantelreibung','SIA 267 · EA-Pfähle')}
      ${fml("R_s,d = η_a · R_s,k / γ_M,a  ·  R_s,k = Σ q_s,k · U · Δz · η_g   (SIA 267 Gl. 42)", `${N(r.etaA,2)} · ${N(r.Rskin_k)} / ${N(gR,2)}`, `${N(r.Rskin_d)}`,'kN')}
      <div style="font-size:8px;color:var(--xdim);margin:2px 0 4px">η_a = ${N(r.etaA,2)}: ${r.etaA>=0.999?'statische Probebelastung':r.etaA>=0.899?'vergleichbare Erfahrung bzw. dynamische Versuche':'Berechnung des Tragwiderstands'} (Ziff. 9.5.2.2.5) · γ_M,a = ${N(r.gMD,2)} Druck / ${N(r.gMZ,2)} Zug (Gl. 43/44).</div>
      <table class="np-tbl" style="margin:4px 0">
        <tr><td>q_s,k Mittel ${r.qsTab?'(Tab./Erfahrung)':'(Erfahrungswert)'}</td><td class="r">${r.qsAvg} kPa</td></tr>
        ${r.qsMax>r.qsMin+0.1?`<tr><td>q_s,k Bereich je Schicht</td><td class="r">${r.qsMin} … ${r.qsMax} kPa</td></tr>`:''}
        ${isFinite(r.grpSd) ? `<tr><td>Gruppenwirkungsgrad η_g (s̄/D = ${r.grpSd})</td><td class="r">× ${N(r.grpEta||1,2)}</td></tr>` : `<tr><td>Gruppenwirkungsgrad η_g</td><td class="r">entfällt (Einzelpfahl)</td></tr>`}
        ${r.zykFac<0.999?`<tr><td>Abminderung zyklische Beanspruchung (Eingabe; in R_s,k enthalten)</td><td class="r">× ${N(r.zykFac,2)}</td></tr>`:''}
        <tr><td>R_s,d Druck</td><td class="r">${N(r.Rskin_d)} kN</td></tr>
        ${r.Rb_k>0?`<tr><td>Spitzenwiderstand R_b,k = q_b,k · A_b = ${r.qb} kPa · ${(r.Ab*1e4).toFixed(0)} cm² (nur Druck, q_b,k eingegeben)</td><td class="r">${N(r.Rb_k)} kN</td></tr>
        <tr><td>R_d Druck = η_a · (R_s,k + R_b,k) / γ_M,a</td><td class="r">${N(r.Rskin_d+r.Rb_d)} kN</td></tr>`:''}
        ${r.zugFac<0.999?`<tr><td>R_s,d Zug (× ${N(r.zugFac,2)}, Herausziehen)</td><td class="r">${N(r.Rskin_dZ)} kN</td></tr>`:''}
        <tr><td>|N|_max (P${r.govPile+1}, ${govZug?'Zug':'Druck'})</td><td class="r">${N(govF)} kN</td></tr>
      </table>
      ${fml(r.Rb_k>0&&!govZug ? "η_Geo = R_d / |N|_max" : "η_Geo = R_s,d / |N|_max", `${N(govZug?r.Rskin_dZ:r.Rskin_d+(r.Rb_d||0))} / ${N(govF)}`, `${isFinite(r.etaGeo)?r.etaGeo.toFixed(2):'∞'}`)}
      ${eta(r.etaGeo)}
      ${r.auf ? fml("Aufbruchsicherheit (SIA 267 Ziff. 9.5.3.3): G_E,k = n_Z·[l_a·l_b·(L − ⅓·√(l_a²+l_b²)·cot φ′)]·η_Z·γ′   ·   η = γ_G,inf·G_E,k / Z_d", `n_Z = ${r.auf.nZ} · l_a × l_b = ${N(r.auf.la,2)} × ${N(r.auf.lb,2)} m · wirksame Höhe ${N(r.auf.hE,2)} m · η_Z = 0.80 · γ′ = ${N(r.auf.gam,1)} kN/m³ · φ′ = ${N(r.auf.phi,1)}° ⇒ G_E,k = ${N(r.auf.GEk)} kN · Z_d = ${N(r.auf.Z)} kN (${r.auf.label||''})`, `η = 0.90·${N(r.auf.GEk)}/${N(r.auf.Z)} = ${r.etaAuf.toFixed(2)}`) + eta(r.etaAuf)
        + `<div style="font-size:8px;color:var(--xdim);margin-top:3px">Angehängter Bodenkörper je Zugpfahl nach EA-Pfähle / DIN 1054 (die SIA 267 verlangt den Nachweis, nennt kein Verfahren). Grenzzustand Typ 1 mit γ_G,inf = 0.90 (SIA 260 Tab. 1); Rastermass am Pfahlkopf, Reibung am Umfang des Bodenkörpers nicht angesetzt.</div>` : ''}
      ${r.tors ? fml("Torsion: T_Rd = r_T · R_s,d  ·  η = 1 / √((|N|/R_d)² + (T_Ed/T_Rd)²)", `T_Ed = ${N(r.tors.T)} kNm · r_T = ${(r.tors.rT*1000).toFixed(0)} mm · T_Rd = ${N(r.tors.TRgeo)} kNm · Anteile ${N(r.tors.uN,2)} / ${N(r.tors.uT,2)} (${r.tors.label||''})`, `η = ${isFinite(r.etaTors)?r.etaTors.toFixed(2):'∞'}`) + eta(r.etaTors)
        + `<div style="font-size:8px;color:var(--xdim);margin-top:3px">Das Torsionsmoment um die Pfahlachse wird über die Mantelreibung mit dem Hebel r_T abgetragen (Rohr d/2, I-Profil ≈ 0.375·b); dieselbe Mantelreibung trägt die Axialkraft, darum die vektorielle Überlagerung. Der Erdwiderstand an den Flanschen ist nicht angesetzt.</div>` : ''}
      ${figFn(()=>buildPbAxialDiagram(r,n,true),'Abb. — Mantelreibungswiderstand R(z) über die Tiefe (Druck/Zug) vs. angesetzte Pfahlkräfte')}
      ${r.auf ? figFn(()=>buildPbAufbruchDiagram(r,n,true),'Abb. — Aufbruchsicherheit: angehängter Bodenkörper je Zugpfahl gegen die Zugkraft Z_d') : ''}
    </div>
    <div class="np-nw">
      ${nwh('5.2','Innerer Tragwiderstand — Querschnitt (N+M)','SIA 267')}
      ${r.einzel
        ? fml("|N|/R_t,d + M_quer/M_Rd,quer + M_längs/M_Rd,längs ≤ 1  ·  M aus dem Bettungsbalken mit H und M am Pfahlkopf", `R_t,d = ${N(r.Rt_d)} kN · M_Rd quer/längs = ${N(r.einzel.MRq)} / ${N(r.einzel.MRl)} kNm · M_Ed quer/längs = ${N(r.einzel.Mq)} / ${N(r.einzel.Ml)} kNm (${r.einzel.starkQuer?'starke Achse trägt quer':'starke Achse trägt längs'})`, `η = ${isFinite(r.etaSteel)?r.etaSteel.toFixed(2):'∞'}`)
        : fml("|N|/R_t,d + |M|/M_Rd ≤ 1  ·  M_Rd = η_i·W_pl·f_yk/γ_s", `R_t,d = ${N(r.Rt_d)} kN · M_Rd = ${N(r.M_Rd)} kNm · M_max = ${N(r.Mmax)} kNm`, `η = ${isFinite(r.etaSteel)?r.etaSteel.toFixed(2):'∞'}`)}
      ${r.einzel && r.einzel.T>0.005 ? fml("Torsion: τ = T_Ed/W_t ≤ f_yk/(√3·γ_s)  ·  Überlagerung √(σ-Anteil² + τ-Anteil²) ≤ 1 (von Mises)", `T_Ed = ${N(r.einzel.T)} kNm · T_Rd = ${N(r.einzel.TRst)} kNm · σ-Anteil ${N(r.einzel.us,2)} · τ-Anteil ${N(r.einzel.uT,2)}`, `Ausnutzung ${N(Math.hypot(r.einzel.us,r.einzel.uT),2)}`) : ''}
      ${eta(r.etaSteel)}
      ${figFn(()=>buildPbSchnittSVG(r,n,true),'Abb. — Schnittgrössen massg. Pfahl: Verschiebung y, Querkraft V, Moment M über die Tiefe')}
      ${figFn(()=>buildPbSteelDiagram(r,n,true),'Abb. — N+M-Interaktion (Betriebspunkte je Pfahl vs. Grenzlinie)')}
      ${r.einzel ? figFn(()=>buildPbEinzelDiagram(r,n,true),'Abb. — Ausnutzung des Stahlquerschnitts: Anteile aus N, M quer, M längs und Torsion') : ''}
    </div>
    <div class="np-nw">
      ${nwh('5.3','Innerer Tragwiderstand — Knicken','SIA 263, elast. Bettung')}
      ${fml("N_cr = 2·√(k_bed·EI) · λ̄ = √(N_pl,k/N_cr) · N_b,Rd = χ·N_pl,k/γ_s", `N_cr = ${N(r.N_cr)} kN · λ̄ = ${N(r.lamBar,2)} · χ = ${N(r.chi,3)}`, `N_b,Rd = ${N(r.N_bRd)} kN`)}
      ${fml("η_Knick = N_b,Rd / N_Ed", `${N(r.N_bRd)} / ${N(r.Ncomp)}`, `${isFinite(r.etaKnick)?r.etaKnick.toFixed(2):'∞'}`)}
      ${eta(r.etaKnick)}
      ${r.knickValid===false?`<div style="font-size:8px;color:var(--warn);margin-top:3px">L = ${N(r.L,2)} m &lt; Knick-Halbwelle L_hw = ${N(r.L_hw,2)} m — die längenunabhängige Euler-auf-Bettung-Formel ist hier ungültig; massgebend ist die laterale Bodentragfähigkeit (5.4).</div>`:''}
      ${figFn(()=>buildPbKnickDiagram(r,n,true),'Abb. — Knickkurve c χ(λ̄) mit Betriebspunkt; graue Punkte = übrige Katalog-Tragglieder')}
    </div>
    ${r.etaLat!=null?`<div class="np-nw">
      ${nwh('5.4','Äusserer Tragwiderstand — Laterale Bodentragfähigkeit','Grenzgleichgewicht p_u')}
      <div class="np-cf" style="margin-bottom:4px">Rotations-/Kick-out-Versagen des Pfahls im Boden — plastische p_u-Hüllkurve (Reibung 3·Kp·σ'v·d, bindig 9·c_u·d). ${_pbEinzel()?'Einzelpfahl: der Kopf trägt die volle Mast-Horizontallast und das Mast-Moment.':'Gruppe: massgebender Pfahl über die laterale Kopfkraft.'}</div>
      <table class="np-tbl" style="margin:4px 0">
        <tr><td>V_u,d = η_a·V_u,k/γ_M,a quer (Querkraft-Grenzlast, /γ_R)</td><td class="r">${N(r.Vcap_d)} kN</td></tr>
        <tr><td>M_u,d = η_a·M_u,k/γ_M,a quer (Moment-Grenzwiderstand, /γ_R)</td><td class="r">${N(r.Mcap_d)} kNm</td></tr>
        <tr><td>Einwirkung V_d / M_gl,d</td><td class="r">${N(r.latVd)} kN / ${N(r.latMd)} kNm</td></tr>
      </table>
      ${fml("η_lateral = 1 / (V_d/V_u,d + M_gl,d/M_u,d)", `1 / (${N(r.latVd)}/${N(r.Vcap_d)} + ${N(r.latMd)}/${N(r.Mcap_d)})`, `${isFinite(r.etaLat)?r.etaLat.toFixed(2):'∞'}`)}
      ${eta(r.etaLat)}
      ${figFn(()=>buildPbLateralDiagram(r,n,true),'Abb. — Seitliche Bettung k_s(z) (gestrichelt: ohne oberflächennahe Abminderung) und Grenzwiderstand p_u(z)')}
    </div>`:''}
    <div style="font-size:8px;color:var(--xdim);margin-top:4px">SIA 267 Kap. 9: η_a = ${N(r.etaA,2)} · γ_M,a = ${N(r.gMD,2)} Druck / ${N(r.gMZ,2)} Zug / ${N(r.gMQ,2)} quer · innerer Widerstand ${r.einzel ? 'Stahlprofil nach SIA 263, γ_M1 = '+N(gS,2) : 'η_i = '+N(r.etaI,2)+' · γ_s = '+N(gS,2)} · voller A_s (kein Abrostzuschlag, ASTRA-Bericht 717) · Knicken = elast. Verzweigung (Imperfektion gem. Lieferant) · laterale Bodentragfähigkeit = plastisches Grenzgleichgewicht (Kick-out/Rotation).</div>
  </div>`;

  // ── Kap 6: GZG
  const page6=`<div class="np-page np-pb">${ph()}
    ${ch('6','Gebrauchstauglichkeit (GZG) — SBB 0161.1011.0007')}
    <div class="np-nw">
      ${nwh('6.1','Schiefstellung und Horizontalverschiebung','SBB')}
      <div class="np-cf" style="margin-bottom:4px">θ ≤ 1:100 (ständig+veränderlich) · 1:200 (veränderlich quer)${n<=2?' · u ≤ ±20/±10 mm':''}</div>
      <table class="np-tbl">
        <tr><th>Kriterium</th><th class="r">Wert</th><th class="r">Grenzwert</th><th>Status</th></tr>
        ${g?`<tr><td>Schiefstellung θ (st+ver)</td><td class="r">${(1000*Math.max(g.tiltQuer,g.tiltLaengs)).toFixed(1)} ‰</td><td class="r">10 ‰ (1:100)</td><td class="${1000*Math.max(g.tiltQuer,g.tiltLaengs)<=10?'ok':'fail'}">${1000*Math.max(g.tiltQuer,g.tiltLaengs)<=10?'✓':'✗'}</td></tr>`:''}
        ${gv?`<tr><td>Schiefstellung θ quer (ver)</td><td class="r">${(1000*gv.tiltQuer).toFixed(1)} ‰</td><td class="r">5 ‰ (1:200)</td><td class="${1000*gv.tiltQuer<=5?'ok':'fail'}">${1000*gv.tiltQuer<=5?'✓':'✗'}</td></tr>`:''}
        ${(g&&n<=2)?`<tr><td>Horiz.verschiebung (st+ver)</td><td class="r">${Math.max(g.uQuer,g.uLaengs).toFixed(1)} mm</td><td class="r">20 mm</td><td class="${Math.max(g.uQuer,g.uLaengs)<=20?'ok':'fail'}">${Math.max(g.uQuer,g.uLaengs)<=20?'✓':'✗'}</td></tr>`:''}
        ${(gv&&n<=2)?`<tr><td>Horiz.verschiebung quer (ver)</td><td class="r">${gv.uQuer.toFixed(1)} mm</td><td class="r">10 mm</td><td class="${gv.uQuer<=10?'ok':'fail'}">${gv.uQuer<=10?'✓':'✗'}</td></tr>`:''}
      </table>
      ${n>2?`<div style="font-size:8px;color:var(--xdim);padding:2px 0">Verschiebungslimit ±20/±10 mm gilt für 1-/2-Pfahlfundamente.</div>`:''}
      ${eta(r.etaGZG)}
      ${r.einzel ? '' : figFn(()=>buildPbSystemSVG(r,piles,n,true),'Abb. — Systemverformung quer (Schiefstellung θ + Horizontalverschiebung, überhöht)')}
    </div>
    <div class="np-nw">
      ${nwh('6.2',_pbEinzel()?'Setzung Pfahlkopf':'Setzung Bankett','informativ — kein Grenzwert')}
      ${fml("k_ax = EA·λ·tanh(λL)  (Lastübertragung t-z, Randolph)", `k_ax = ${N((r.kAx||0)/1000,1)} MN/m (Stahl allein ${N((r.kAxSteel||0)/1000,1)})`, `Setzung = ${r.settle_mm} mm`)}
      ${_pbEinzel()?'':`<div style="font-size:8px;color:var(--xdim);margin-top:3px">Bankett starr angenommen (Translation + Kippen, keine Eigenbiegung). Bei dünnem/grossem Bankett gesondert prüfen.</div>`}
    </div>
  </div>`;

  // ── Zusammenfassung
  const sumRow=(label,val,gov)=>`<tr${gov?' class="hl"':''}><td>${label}</td><td class="r ${isFinite(val)?(val>=1?'ok':'fail'):'ok'}">${isFinite(val)?val.toFixed(2):'∞'}</td></tr>`;
  const summary=`<div class="np-page np-pb">${ph()}
    ${ch('7','Ergebniszusammenfassung')}
    <div style="font-size:8.5px;color:var(--dim);margin-bottom:10px">Übersicht der Nachweis-Ausnutzungsgrade η. Nachweis erbracht wenn η ≥ 1.0.</div>
    <table class="np-tbl" style="margin-bottom:14px">
      <thead><tr><th>Nachweis / Grenzzustand</th><th class="r">η</th></tr></thead><tbody>
        ${sumRow(r.Rb_k>0 ? 'GZT — Äusserer Tragwiderstand (Mantel + Spitze)' : 'GZT — Äusserer Tragwiderstand (Mantelreibung)', r.etaGeo)}
        ${r.etaTors!=null?sumRow('GZT — Torsion über Mantelreibung', r.etaTors):''}
        ${r.etaAuf!=null?sumRow('GZT — Aufbruchsicherheit der Zugpfähle', r.etaAuf):''}
        ${r.etaLat!=null?sumRow('GZT — Laterale Bodentragfähigkeit (Kick-out)', r.etaLat):''}
        ${sumRow('GZT — Innerer Tragwiderstand (Querschnitt N+M)', r.etaSteel)}
        ${sumRow('GZT — Innerer Tragwiderstand (Knicken)', r.etaKnick)}
        ${sumRow('GZG — Schiefstellung / Verschiebung', r.etaGZG)}
        ${sumRow('MASSGEBEND (min)', r.eta_massg, true)}
      </tbody>
    </table>
    <div class="np-verdict ${allOk?'ok':'fail'}">
      <div class="np-verdict-v">${allOk?'✓  Alle massgebenden Nachweise sind erfüllt':'✗  Mindestens ein Nachweis ist nicht erfüllt'}</div>
      <div class="np-verdict-s">Massgebend: η = ${isFinite(r.eta_massg)?r.eta_massg.toFixed(2):'–'} · Mikropfahl-Gruppe · SIA 267:2013 · ${datStr}</div>
    </div>
  </div>`;

  return `<div class="np-wrap">${cover}${page1}${page2}${page3}${page4}${page5}${page6}${summary}${_npAnnahmen('pfahl', ph)}</div>`;
}

// d/k-Anzeige der Einwirkungen und Erddruck-Spannungen — wirkt NUR auf das 3D-Modell.
// Start: k (charakteristisch). Nachweise, Diagramme und Bericht zeigen immer Bemessungswerte (d).
let _gztCharMode = true;
function toggleGZTChar(evt){
  if(evt) evt.stopPropagation();
  _gztCharMode = !_gztCharMode;
  const vcBtn = document.getElementById('vc-char-toggle');
  if(vcBtn){
    vcBtn.textContent = _gztCharMode ? 'k' : 'd';
    vcBtn.classList.toggle('on', _gztCharMode);
  }
  if(typeof rebuildScene === 'function') rebuildScene();
}

// ══════════════════════════════════════════════════════════
