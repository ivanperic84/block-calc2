// BlockCalc — js/ergebnis.js
// Ergebnisspeicher RESULT, Ergebnis-Panel Block/Flach, Schubladen-Status
// ── Letztes Ergebnis je Tragsystem — EINE Stelle statt verstreuter Variablen
//    (früher _lastResults/_lastG, lastRes, window._pbReport, window._pbViz, window._flachBishop).
//    block/flach: { results, G, worst, bishop }   ·   pfahlbock: { r, piles, n, viz }
//    Getrennt je Modell, damit nach einem Modellwechsel nie das Ergebnis eines anderen
//    Tragsystems gelesen wird. Zugriff auf das aktive Modell über curResult().
const RESULT = { block:null, flach:null, pfahlbock:null };
function curResult(){ return RESULT[CALC_MODEL] || null; }
// Typ-2-Nachweise (Sohlspannung 'sig', Grundbruch 'gb', Gleiten 'gl') werden je Lastfall über die
// 8 Kombinationen ausgewertet; jeder Nachweis hat SEINE massgebende Kombination (r.t2[key]).
// t2View liefert das Ergebnis mit den Feldern dieser Kombination — Panel, Diagramme und Berichte
// müssen für die Herleitung eines Nachweises immer diese Sicht verwenden, nie die flachen Felder
// (die zeigen die Anzeige-Kombination 8 «alles ungünstig»).
function t2View(r, key){ return (r && r.t2 && r.t2[key]) ? Object.assign({}, r, r.t2[key]) : r; }
function t2KombText(v){
  return (v && v.komb) ? 'Komb. '+v.komb+' · γ_Eig '+v.fE.toFixed(2)+' · γ_G '+v.fG.toFixed(2)+' · γ_Q '+v.fQ.toFixed(2) : '';
}
function renderResults(res,worst,g){
  const _R = RESULT[g.isBlock?'block':'flach'] = { results:res, G:g, worst, bishop:null };
  const scroll=document.getElementById('res-scroll');
  // Defensiv: res-scroll immer einblenden wenn Pfahlsicherung nicht aktiv
  if(!showPfahl){ scroll.style.display=''; }
  scroll.innerHTML='';
  const allOk=res.every(r=>r.ok),anyFail=res.some(r=>!r.ok);
  const pill=document.getElementById('overall-pill');
  pill.className='pill '+(allOk?'pill-ok':anyFail?'pill-f':'pill-w');
  if(allOk){
    pill.textContent='Erfüllt';
  } else if(anyFail){
    // Welche Nachweise schlagen fehl?
    const failNames=[];
    const NW=_nwFor(g.isBlock?'block':'flach');
    const worst=res.reduce((a,b)=>(!b.ok?b:a), res[0]);
    if(g.isBlock){
      if(NW.gzt && worst && !_etaOk(worst.etaGZT)) failNames.push('GZT Standsicherheit');
      if(NW.gzg && worst && !_etaOk(worst.etaGZG)) failNames.push('GZG Schiefstellung');
    } else {
      if(NW.sohlsp && worst && !_etaOk(worst.etaSIG)) failNames.push('σ_max');
      if(NW.grundb && worst && !_etaOk(worst.etaGB)) failNames.push('Grundbruch');
      if(NW.gleiten && worst && !_etaOk(worst.etaGL)) failNames.push('Gleiten');
      if(NW.kippen  && worst && (g.isBlock ? !worst.inKern : !_etaOk(worst.eta_klaf??1))) failNames.push(g.isBlock ? 'Ausmitte' : 'Kippnachweis');
    }
    pill.textContent = failNames.length ? `Nicht erfüllt · ${failNames.join(', ')}` : 'Nicht erfüllt';
  } else {
    pill.textContent='Knapp';
  }
  if(typeof _updateDrawerStatus==='function') _updateDrawerStatus();

  // Viewer-Badge (oben mittig im 3D-Viewer)
  const badge=document.getElementById('viewer-nw-badge');
  if(badge){
    if(allOk){
      badge.style.display='none';
    } else {
      badge.style.display='block';
      badge.innerHTML=`<span class="pill ${anyFail?'pill-f':'pill-w'}" style="white-space:nowrap;backdrop-filter:blur(4px)">${pill.textContent}</span>`;
    }
  }

  // Model + terrain info banner
  let banner='';
  const modelLabel = g.isBlock
    ? '<span style="color:var(--acc)">Steckner Blockfundament</span>'
    : FLACH_MAT==='stahl'
      ? '<span style="color:var(--on2)">Stahl-Basisplatte · Hansen starr</span>'
      : '<span style="color:var(--on2)">Flachfundament Beton · Hansen starr</span>';
  banner += `<div style="font-family:var(--f-mono);font-size:9px;color:var(--xdim);padding:8px 0 2px">Modell: ${modelLabel} · SIA 267</div>`;
  if(g.btyp!=='none'&&Math.abs(g.beta_deg)>0.1){
    const betaHint = g.isBlock
      ? (SETTINGS.stecknerSlope===true && g.beta_deg < -0.1
          ? `GZG: C₁×(1+β/40) · GZT Gl.66 <b>Erweiterung</b>: E_p talseitig mit K_p,β (richtungsabhängig)`
          : `GZG: C₁×(1+β/40) · GZT Gl.66: β_a=β_p=0 (Steckner) — Erweiterung „Böschung im GZT" in den Optionen`)
      : `Hansen: g_βq = g_βγ = (1−tan β)² · Grundbruch- und Gleitwiderstand reduziert`;
    const _bhB = +gi('bg_bhoehe')||0;
    banner += wBox('warn', 'Geländeneigung β = '+g.beta_deg+'° — Widerstände abgemindert',
      `${betaHint}${_bhB>0.05
        ? ` · h_β = ${_bhB} m (2. Ebene) — Abminderung anteilig h_β/D_ref abgemildert`
        : ` · durchlaufende Böschung (h_β = 0) — volle Abminderung`}`);
  }
  if(SCHICHTEN.length>1){
    banner+=`<div style="font-family:var(--f-mono);font-size:9px;color:var(--xdim);padding:0 0 4px">${SCHICHTEN.length} Bodenschichten · massgebend: ${worst.soilName}</div>`;
  }

  // Kernweite/klaffende Fuge beim Block informativ ausweisen (Sohldruck ist beim eingespannten
  // Block kein Versagenskriterium — Standsicherheit über Steckner GZT Gl.66).
  const blockKernHint = (g.isBlock && worst.inKern===false)
    ? wBox('info', 'Ausmitte ausserhalb der Kernweite (|e| > B/6)'+(worst.smin<0?' · klaffende Sohlfuge':''),
        `σ_min = ${worst.smin.toFixed(1)} kPa${worst.smin<0?' &lt; 0 → die Sohlfuge klafft rechnerisch':''}.
         Beim <b>eingespannten Block</b> ist das <b>informativ</b> — massgebend ist die Standsicherheit
         nach Steckner GZT (Gl. 66), nicht die Sohldruckverteilung.`)
    : '';
  const sd=document.createElement('div');
  sd.innerHTML=`${banner}<div class="summary"><div class="summary-ttl">Massgebend — ${worst.name}</div>
    <div class="kv-grid">
      <div class="kv"><span>σ_max</span><span>${worst.smax.toFixed(1)} kPa</span></div>
      <div class="kv"><span>σ_min</span><span>${worst.smin.toFixed(1)} kPa</span></div>
      <div class="kv"><span>N_d</span><span>${worst.Nd.toFixed(1)} kN</span></div>
      <div class="kv"><span>H_d</span><span>${worst.Hd.toFixed(1)} kN</span></div>
      <div class="kv"><span>M_xd</span><span>${worst.Mxd.toFixed(1)} kNm</span></div>
      <div class="kv"><span>M_yd</span><span>${worst.Myd.toFixed(1)} kNm</span></div>
      <div class="kv"><span>e_x</span><span>${worst.ex.toFixed(3)} m</span></div>
      <div class="kv"><span>e_y</span><span>${worst.ey.toFixed(3)} m</span></div>
      ${g.isBlock?`<div class="kv"><span>Ep_x</span><span>${worst.Ep_x.toFixed(1)} kN</span></div>
      <div class="kv"><span>Ep_y</span><span>${worst.Ep_y.toFixed(1)} kN</span></div>`:''}
    </div>${blockKernHint}</div>`;
  scroll.appendChild(sd);

  const NW=_nwFor(g.isBlock?'block':'flach');
  res.forEach(r=>{
    const gh=document.createElement('div');gh.className='lf-grp lf-grp-main';
    const activeG=LF_COMP_DEFS.filter(c=>c[3]==='G'&&r.comp&&r.comp[c[0]]).map(c=>c[1]);
    const activeW=LF_COMP_DEFS.filter(c=>c[3]==='W'&&r.comp&&r.comp[c[0]]).map(c=>c[1]);
    const compHint=[...activeG.map(l=>`<span style="color:var(--dim)">${l}</span>`),
                    ...activeW.map(l=>`<span style="color:var(--acc)">${l}</span>`)].join(' ');
    gh.innerHTML=`${r.name}<span style="font-size:8.5px;font-weight:400;letter-spacing:0;text-transform:none;margin-left:4px">${compHint}</span>`;
    scroll.appendChild(gh);

    // Je Typ-2-Nachweis die Sicht seiner massgebenden Kombination
    const rS=t2View(r,'sig'), rG=t2View(r,'gb'), rL=t2View(r,'gl');
    // Build cards dynamically based on model
    const gleitenFormula = g.isBlock
      ? "R_gl = Sohle(N·tan φ_d + c_d·A) + Ep (passiv Seite)"
      : "R_gl = N_d · tan(φ'_d) + c'_d · A";
    const gleitenRows = g.isBlock ? [
      ['Kombination',t2KombText(rL)],
      ['N_d',(rL.Nd_gl??rL.Nd).toFixed(1)+' kN'],
      ['R_gl Sohle',((rL.Nd_gl??rL.Nd)*Math.tan(rL.phi_d)+rL.c_d*g.B*g.L).toFixed(1)+' kN'],
      ['Ep (massgebend)',(Math.abs(rL.Hxd)>=Math.abs(rL.Hyd)?rL.Ep_x:rL.Ep_y).toFixed(1)+' kN'],
      ['R_gl total',rL.Rgl.toFixed(1)+' kN'],
      ['H_d',rL.Hd.toFixed(1)+' kN'],['η',rL.etaGL.toFixed(2)]
    ] : [
      ['Kombination',t2KombText(rL)],
      ['N_d',(rL.Nd_gl??rL.Nd).toFixed(1)+' kN'],
      ['R_gl',rL.Rgl.toFixed(1)+' kN'],['H_d',rL.Hd.toFixed(1)+' kN'],['η',rL.etaGL.toFixed(2)]
    ];

    const grundbFormula = g.isBlock
      ? "R_d = Hansen(Sohle+Tiefenbwt) + T_mantel/A"
      : "R_d = c'_d·Nc·ic + q·Nq·iq + 0.5·γ·B'·Nγ·iγ";
    const grundbRows = [
      ['Kombination',t2KombText(rG)],
      ['N_d / H_d',rG.Nd.toFixed(1)+' / '+rG.Hd.toFixed(1)+' kN'],
      ['Schicht',rG.soilName],
      ['R_d', rG.effAusserhalb ? 'n. führbar' : rG.Rd.toFixed(1)+' kPa'],   // Karte nur beim Flach
      ...(g.isBlock?[['T_mantel/A',(rG.Tf_total/g.B/g.L).toFixed(1)+' kPa'],
                     ['Kp',rG.Kp.toFixed(2)],
                     ['δ_d',(rG.delta_d*180/Math.PI).toFixed(1)+'°']]:[] ),
      ["B'×L'",rG.Be.toFixed(2)+'×'+rG.Le.toFixed(2)+' m'],
      ['Nq / Nc',rG.Nq.toFixed(1)+' / '+rG.Nc.toFixed(1)],
      ['q₀',rG.q0.toFixed(1)+' kPa'],
      ...(Math.abs(g.beta_deg)>0.1?[['g_βq/g_βγ',rG.gb_q.toFixed(3)+'/'+rG.gb_g.toFixed(3)]]:[] ),
      ['η',rG.etaGB.toFixed(2)]
    ];

    const allCards=[
      // ── Flachfundament (Hansen)
      ...(!g.isBlock?[
        {id:'_grp', t:'GZT — Grenzzustand der Tragfähigkeit'},
        {id:'sohlsp',t:'Sohlspannung',e:rS.etaSIG,
         f:'σ = N/A ± M_x/W_x ± M_y/W_y  →  σ_max ≤ q_u',
         rows:[['Kombination',t2KombText(rS)],['N_d',rS.Nd.toFixed(1)+' kN'],['σ_max',rS.smax.toFixed(1)+' kPa'],['σ_min',rS.smin.toFixed(1)+' kPa'],
               ['q_u zul.',g.qu+' kPa'],['η',rS.etaSIG.toFixed(2)]],
         svg: (()=>{ try{ return buildSohlDiagram(r,g,_gztExpanded); }catch(e){ return ''; } })(),
         diagR:r, diagG:g, diagFn:'buildSohlDiagram'},
        {id:'grundb',t:'Grundbruch',e:rG.etaGB,f:grundbFormula,rows:grundbRows,
         // (Die Grundbruch-Karte existiert nur beim Flachfundament — beim Block wird η_GB lediglich
         //  in der Berichts-Zusammenfassung geführt, dort greift der !isBlock-Guard im Rechenkern.)
         note: rG.effAusserhalb
           ? wBox('fail','Resultierende ausserhalb der Sohlfläche — Nachweis nicht führbar',
               `|e_x|/B = ${rG.eRx} bzw. |e_y|/L = ${rG.eRy} ≥ 0.50: die Lastresultierende liegt
                <b>ausserhalb</b> der Sohlfläche, eine effektive Ersatzfläche (Meyerhof) existiert nicht
                mehr. Es wird <b>kein R_d</b> ausgewiesen — das Fundament kippt, ein Sohlgleichgewicht
                ist unmöglich. Massgebend ist der Kippnachweis; die Abmessung ist zu vergrössern bzw.
                die Ausmitte zu reduzieren.`)
           : (rG.effUeberDrittel
               ? wBox('warn','Grosse Ausmitte — Meyerhof-Ersatzfläche als Näherung',
                   `|e_x|/B = ${rG.eRx} bzw. |e_y|/L = ${rG.eRy} &gt; 1/3. Ausserhalb der üblichen
                    Anwendungsgrenze (EC7/DIN 4017) ist die Ersatzflächen-Näherung nur noch bedingt
                    zutreffend — R_d ist hier mit Vorbehalt zu lesen; der Kippnachweis ist massgebend.`)
               : ''),
         svg:(()=>{ try{ return buildGrundbDiagram(r,g,_gztExpanded); }catch(e){ return ''; } })(),
         diagR:r, diagG:g, diagFn:'buildGrundbDiagram'},
        {id:'gleiten',t:'Gleiten',e:rL.etaGL,f:gleitenFormula,rows:gleitenRows},
        {id:'kippen',t:'Kippnachweis',e:r.eta_klaf!==undefined?r.eta_klaf:Math.min(r.etaKx,r.etaKy),
         f:'SIA 267 GZT Typ 1  ·  N_d = γ_G,inf·(N_G+G_k)  ·  e_x = M_y,d/N_d  ·  e_y = M_x,d/N_d  →  (e_x/B)² + (e_y/L)² ≤ 1/9',
         rows:[['e_x (Typ1)',(r.ex_kipp!==undefined?r.ex_kipp:r.ex||0).toFixed(3)+' m'],
               ['e_y (Typ1)',(r.ey_kipp!==undefined?r.ey_kipp:r.ey||0).toFixed(3)+' m'],
               ['Grenze B/3',(g.B/3).toFixed(3)+' m'],['Grenze L/3',(g.L/3).toFixed(3)+' m'],
               ['(ea/B)²+(eb/L)²',r.klaf_val!==undefined?r.klaf_val.toFixed(4):'—'],
               ['Grenzwert 1/9','0.1111'],
               ['η',r.eta_klaf!==undefined?r.eta_klaf.toFixed(2):'—']],
         svg: (()=>{ try{ return buildKippDiagram(r,g,_gztExpanded); }catch(e){ return ''; } })(),
         diagR:r, diagG:g, diagFn:'buildKippDiagram'},
      ]:[]),
      // ── Blockfundament (Steckner) — nur GZT + GZG (je nach lf.nw)
      ...(g.isBlock?[
        ...((r.nw!=='gzg')?[
          {id:'_grp', t:'GZT — Grenzzustand der Tragfähigkeit  ·  Steckner Gl.66'},
          {id:'gzt',t:'Standsicherheit'+(r.komb_GZT?` · massgebend Komb. ${r.komb_GZT}`:''),e:r.etaGZT,
           f:"M_u = −(Ew−Ea+E0ü)·v + (Ep+E0)u·v' + Reib·B/2 + Ru·(t−ü) + Nu·u  ≥  M_d",
           gztR: r, gztG: g,
           svg: (()=>{ try{ return buildGZTDiagram(r,g); }catch(e){ return ''; } })()},
        ]:[]),
        ...((r.nw!=='gzt')?[
          {id:'_grp', t:'GZG — Grenzzustand der Gebrauchstauglichkeit  ·  Steckner Gl.11–21'},
          {id:'gzg',t:'Schiefstellung',e:r.etaGZG,
           f:'M_α(α_zul) ≤ M_u,char  →  η = M_α / M_ok  ≥  1.0  (Steckner Gl.11-21)',
           gzgR:r, gzgG:g},
        ]:[]),
      ]:[]),
    ];
    allCards.forEach(card=>{
      if(card.id==='_grp'){
        const grp=document.createElement('div');
        grp.className='lf-grp'; grp.textContent=card.t;
        scroll.appendChild(grp); return;
      }
      if(!NW[card.id]) return;
      let gztKey = '';
      if(card.gztR){ gztKey='_gzt_'+(r.name||'').replace(/\W/g,'_'); window[gztKey]={R:card.gztR,G:card.gztG}; }
      // Sohl/Kipp-Diagramme: eigener Key für Expand (rebuild-Funktion im data-Attribut)
      let diagKey='', diagFn='';
      if(card.diagR){ diagKey='_diag_'+card.id+'_'+(r.name||'').replace(/\W/g,'_'); window[diagKey]={R:card.diagR,G:card.diagG,fn:card.diagFn}; diagFn=card.diagFn; }
      const el=document.createElement('div');el.className='nw';
      const rowsHtml = card.gztR
        ? `<div data-gzt-rows="${gztKey}">${buildGZTRows(card.gztR, card.gztG, false)}</div>`
        : card.gzgR
          ? buildGZGRows(card.gzgR, card.gzgG)
          : (card.rows||[]).map(([k,v])=>`<div class="nw-row"><span>${k}</span><span>${v}</span></div>`).join('');
      const expandBtn = `<button onclick="toggleGZTExpand(event,'${diagKey||gztKey}')" title="Vergrössern"
        style="position:absolute;top:6px;right:6px;z-index:2;background:var(--s3);border:1px solid var(--ol2);
        border-radius:3px;cursor:pointer;color:var(--dim);padding:1px 6px;font-size:11px;line-height:1.5">⤢</button>`;
      const _eC=eCls(card.e), _utilBar=nwUtilBar(card.e, _eC);
      el.innerHTML=`<div class="nw-hd" onclick="this.parentElement.querySelector('.nw-bd').classList.toggle('open')">
          <span class="nw-ttl">${card.t}</span>
          <span class="nw-eta ${_eC}">${eTxt(card.e)}</span>
        </div>
        ${_utilBar}
        <div class="nw-bd">
          <div class="nw-formula">${card.f}</div>
          ${card.note||''}
          ${rowsHtml}
          ${card.svg
            ? `<div class="gzt-diagram" style="position:relative;margin-top:6px;border-radius:var(--r1);overflow:hidden;border:1px solid var(--ol)"
                 data-gzt-key="${diagKey||gztKey}">
                 ${expandBtn}
                 ${card.svg}
               </div>`
            : ''}
        </div>`;
      scroll.appendChild(el);
    });
  });

  // ── Globale Böschungsstandsicherheit (Gleitkreis, Bishop) — NUR Flachfundament, EINMALIG
  // (lastfallunabhängig: ständige Last als Auflast). Ergänzt den Grundbruch: dort lokaler Bruchkörper
  // unmittelbar unter der Sohle (Böschung nur via Geländeneigungsbeiwerte), hier ein grosser Gleitkreis
  // durch die ganze Böschung mit dem Fundament als blosse Auflast — zwei verschiedene Mechanismen.
  // Block/Pfahlfundament bewusst AUSGENOMMEN: dort läge die Gleitfläche im Beton bzw. schnitte die
  // Tragglieder → Lamellenverfahren (reine Bodenscheiben) nicht gültig.
  _R.bishop = null;   // für den Flach-Nachweisbericht (buildNachweisDocFlach)
  // Nur Flach, nur wenn in den Optionen aktiviert (Standard aus, SETTINGS.nw.bishop)
  if(!g.isBlock && nwOn('flach','bishop')){
    const _bTyp=(document.getElementById('bg_btyp')||{}).value||'none', _bBeta=+gi('bg_beta')||0;
    if(_bTyp!=='none' && Math.abs(_bBeta)>0.1){
      let bres=null;
      try{
        const _Np=+gi('l_NG')||0;
        const _Gk=(g.Gk!==undefined?g.Gk:g.B*g.L*(g.Hb||0)*(+gi('g_gbeton')||24));
        bres=bishopStability({ bx:g.B, L_fp:g.L,
          t_bl:Math.max(0.3, g.Hb||0),
          q_block:(_Gk+_Np)/Math.max(0.09, g.B*g.L) });   // echte Flächenpressung statt t·γ_Beton
      }catch(e){ bres=null; }
      _R.bishop = bres;   // → Nachweisbericht Flachfundament
      const grp=document.createElement('div'); grp.className='lf-grp';
      grp.textContent='Stabilität — Gelände (GZT)'; scroll.appendChild(grp);
      const el=document.createElement('div'); el.className='nw';
      if(bres && bres.ok && isFinite(bres.eta)){
        const _eC=eCls(bres.eta), _bc={ok:'var(--ok)',warn:'var(--warn)',fail:'var(--fail)',dim:'var(--dim)'}[_eC];
        let _svg=''; try{ _svg=buildBishopSVG(bres,false); }catch(e){ _svg=''; }
        el.innerHTML=`<div class="nw-hd" onclick="this.parentElement.querySelector('.nw-bd').classList.toggle('open')">
            <span class="nw-ttl">Globale Standsicherheit (Gleitkreis, Bishop)</span>
            <span class="nw-eta ${_eC}">${eTxt(bres.eta)}</span>
          </div>
          <div class="nwbar" title="Ausnutzung 1/η = ${Math.round(100/bres.eta)}% (Marker = Grenze η=1)"><i style="width:${Math.min(100,(1/bres.eta)*66).toFixed(1)}%;background:${_bc}"></i><u></u></div>
          <div class="nw-bd">
            <div class="nw-formula">η = min Σ[c'_d·b + (W−u·b)·tan φ'_d]/m_α  /  Σ W·sin α  (Bishop vereinfacht, iterativ)</div>
            <div class="nw-row"><span>η massgebender Kreis</span><span>${bres.eta.toFixed(2)}</span></div>
            <div class="nw-row"><span>Radius R</span><span>${bres.R.toFixed(2)} m</span></div>
            <div class="nw-row"><span>Scherfestigkeit (SIA 267)</span><span>φ′_d = φ′/γ_φ · c′_d = c′/γ_c</span></div>
            ${_svg?`<div style="margin-top:6px">${_svg}</div>`:''}
            <div style="font-size:8px;color:var(--xdim);margin-top:3px"><b>Ergänzt den Grundbruch</b> (dort: lokaler Bruchkörper unter der Sohle; hier: globaler Gleitkreis durch die Böschung, Fundament nur als Auflast). Freie Zentrum-Grid-Suche, Fundamentlast als Flächenpressung (G_k+N_G)/(B·L), GW-Porendruck. Ebenes 2D-Verfahren — seitliche 3D-Stirnscherung konservativ vernachlässigt; gegen Taylor φ_u=0 auf &lt;2 % validiert. Bei η &lt; 1.3 vertiefte GEO-Untersuchung.</div>
          </div>`;
      } else {
        el.innerHTML=`<div class="nw-hd"><span class="nw-ttl">Globale Standsicherheit (Gleitkreis, Bishop)</span><span class="nw-eta dim">n.m.</span></div>
          <div class="nw-bd open"><div style="font-size:9px;color:var(--warn);line-height:1.4">Die Gleitkreissuche lieferte kein gültiges Ergebnis — Böschungsgeometrie (Höhe h_β, Fusslage) und Bodenkennwerte prüfen. Globale Standsicherheit gesondert nachweisen.</div></div>`;
      }
      scroll.appendChild(el);
    }
  }
  // Nachweisplot-Button nach Berechnung einblenden
  const btnPlot = document.getElementById('btn-plot');
  if(btnPlot){
    btnPlot.style.display = 'inline-flex';
    btnPlot.querySelector('svg+span,span')?.setAttribute('data-text',
      g.isBlock ? 'Nachweisplot exportieren' : 'Nachweisbericht Flachfundament');
    const lbl = btnPlot.querySelector('.tb-btn-lbl') || btnPlot.childNodes[btnPlot.childNodes.length-1];
    if(lbl && lbl.nodeType===3) lbl.textContent = g.isBlock ? ' Nachweisplot exportieren' : ' Nachweisbericht';
  }
  const d=document.getElementById('sb-dot');
  d.className='sb-dot'+(allOk?'':anyFail?' fail':' warn');
  document.getElementById('sb-txt').textContent=allOk?'Alle Nachweise erfüllt':anyFail?'Nachweis nicht erfüllt':'Knapper Nachweis';
}

// ════════════════════════════════════════════
