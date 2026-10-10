// BlockCalc — js/bericht-flach.js
// Nachweisbericht Flachfundament
// NACHWEISBERICHT FLACHFUNDAMENT
// ════════════════════════════════════════════════════════════════
function buildNachweisDocFlach(results, G){
  var st = collectState();
  var NW = _nwFor('flach');
  var isStahl = FLACH_MAT === 'stahl';
  var B = G.B, L = G.L, d = G.Hb, ue = G.ue||0;
  // G.Hb ist beim Flach die Einbindetiefe t (= ü), nicht die Plattendicke — die steht
  // in g_hblock. Ohne diese Trennung druckte der Bericht t als „Plattendicke" (Aug 2026).
  var dPl = +st.g_hblock || 0;   // Plattendicke H_Platte [m]
  var mat = isStahl ? 'Stahlbasisplatte' : 'Betonflachfundament';
  var now = new Date();
  var datStr = st.p_datum||(now.toLocaleDateString('de-CH'));

  // ── Helfer ────────────────────────────────────────────────────
  function ph(){ return _npPH(st,datStr); }
  var ch=_npCh, hr=_npHr, sh2=_npSh2, fml=_npCalc, nwh=_npNwh;
  function eta(val, inf){
    if(inf) return '<span class="np-eta inf">informativ</span>';
    var ok = etaErf(val);
    return '<span class="np-eta '+(ok?'ok':'fail')+'">η = '+val.toFixed(2)+(ok?' ≥ 1.0 ✓':' < 1.0  ✗')+'</span>';
  }

  // ── Systemquerschnitt SVG Flach ────────────────────────────────
  // 3D-Viewer Screenshot mit Vermassung
  function buildSystemImg(){
    var png = captureViewerWithDimPNG();
    if(png) return '<img src="'+png+'" style="width:100%;border-radius:4px;border:0.5px solid var(--ol)" alt="3D-Modell"/>';
    return '<div style="padding:20px;text-align:center;font-size:8px;color:var(--xdim);border:0.5px solid var(--ol)">3D-Modell nicht verfügbar</div>';
  }

  // Diagramm-Wrapper: Sohlspannung 50%, Grundbruch/Kippen 100%
  function diagWrap(svgHtml, full){
    var w = full ? '100%' : '50%';
    var mw = full ? '400px' : '260px';
    return '<div style="width:'+w+';min-width:'+mw+';margin:8px 0">'+svgHtml+'</div>';
  }

  // ── Titelblatt ─────────────────────────────────────────────────
  var cover = '<div class="np-page np-pb">'+ph()+_npLogo()+
    '<div class="np-firma">'+esc(SETTINGS.firma||'BlockCalc SIA 267')+'</div>'+
    '<div class="np-ct">Standsicherheitsnachweis</div>'+
    '<div class="np-ct" style="font-size:13px;margin-bottom:4px">'+mat+' · Starre Methode · SIA 267:2013</div>'+
    '<div class="np-cs">Nachweis der Standsicherheit (GZT) für ein Flachfundament nach starrer Methode (erweiterte Tragfähigkeitsformel)</div>'+
    '<div class="np-cblock">'+
      '<div class="np-cmeta">'+
        '<span class="k">Bauteil / Objekt</span><span class="v">'+esc(st.p_name||'–')+'</span>'+
        '<span class="k">Projektnummer</span><span class="v">'+esc(st.p_nr||'–')+'</span>'+
        '<span class="k">Bearbeiter</span><span class="v">'+esc(st.p_bearbeiter||SETTINGS.bearbeiter||'–')+'</span>'+
        '<span class="k">Datum</span><span class="v">'+datStr+'</span>'+
        '<span class="k">Fundamentbezeichnung</span><span class="v">'+esc(st.p_fundname||'–')+'</span>'+
        '<span class="k">Bemerkung</span><span class="v">'+esc(st.p_bemerk||'–')+'</span>'+
      '</div>'+
      sh2('Normgrundlagen')+
      '<table class="np-tbl" style="margin-bottom:14px">'+
        '<tr><th>Norm</th><th>Titel</th><th>Anwendung</th></tr>'+
        '<tr><td>SIA 267:2013</td><td>Geotechnik</td><td>Gleiten, Ausmitte, Nachweisformate GZT Typ 1/2</td></tr>'+
        '<tr><td>SIA D 0197 (2004)</td><td>Geotechnik — Bemessungsbeispiele zur Norm SIA 267</td><td>Grundbruchnachweis E_N,d ≤ R_N,d = σ_f·b̄ (Kap. 5.3.4.3)</td></tr>'+
        '<tr><td>Lang / Huder / Amann / Puzrin</td><td>Bodenmechanik und Grundbau, 9. Aufl.</td><td>Erweiterte Tragfähigkeitsformel, Faktoren N, s, d, i, g (Abschn. 9.2.5–9.2.17)</td></tr>'+
        '<tr><td>SIA 261:2020</td><td>Einwirkungen auf Tragwerke</td><td>Lastfallkombinationen, γ_G,sup/inf, γ_Q</td></tr>'+
        '<tr><td>Meyerhof (1963)</td><td>Some Recent Research on the Bearing Capacity of Foundations</td><td>Effektive Fundamentbreite B\'= B−2|e_x|</td></tr>'+
      '</table>'+
      sh2('Berechnungskonzept')+
      '<div style="font-size:8.5px;color:var(--dim);line-height:1.7;margin-bottom:18px">'+
      'Das Flachfundament wird als starr betrachtet (lineare Sohldruckverteilung). '+
      'Der Grundbruchwiderstand folgt der erweiterten Tragfähigkeitsformel nach Lang/Huder/Amann, wie sie die SIA-Dokumentation D 0197 für den Nachweis nach SIA 267 verwendet (Form-, Tiefen-, Lastneigungs- und Geländeneigungsfaktoren); nachgewiesen wird N_d ≤ R_d = σ_f,d·b̄·l̄ mit φ\'_d und c\'_d. '+
      'Die effektive Fläche B\'×L\' berücksichtigt die Lastausmitte (Meyerhof). '+
      'Gleiten wird mit γ_G,inf auf der Widerstandsseite nachgewiesen (SIA 267 Typ 2). '+
      'Kippen/Ausmitte verwendet Typ-1-Faktoren (γ_G,sup='+st.lw_G1_sup+'/γ_G,inf='+st.lw_G1_inf+'). '+
      (isStahl?'Stahlplatte γ=78.5 kN/m³. ':'')+'</div>'+
      '<table class="np-tbl" style="width:55%">'+
        '<tr><th>Rev.</th><th>Datum</th><th>Beschreibung</th><th>Visum</th></tr>'+
        '<tr><td>0</td><td>'+datStr+'</td><td>Erstausgabe</td><td>'+esc(st.p_bearbeiter||SETTINGS.bearbeiter||'')+'</td></tr>'+
      '</table>'+
    '</div>'+
  '</div>';

  // ── Seite 2: System + Baugrundkennwerte ───────────────────────
  var phi_d0 = results[0]?.phi_d || 0;
  var phi_k0 = results[0]?.phi_k_GZT || Math.atan(Math.tan(phi_d0)*(+st.tw_phi||1.20));
  var c_d0   = results[0]?.c_d || 0;
  var Nq0    = results[0]?.Nq || 0;
  var Nc0    = results[0]?.Nc || 0;
  var Ng0    = results[0]?.Ng || 0;
  var page2 = '<div class="np-page np-pb">'+ph()+
    ch('1','System und Geometrie')+
    '<div class="np-geo">'+
      '<div style="width:50%;min-width:240px">'+buildSystemImg()+'</div>'+
      '<div style="flex:1">'+
        sh2('Fundamentgeometrie')+
        '<table class="np-tbl">'+
          '<tr><th>Kenngrösse</th><th>Symbol</th><th class="r">Wert</th></tr>'+
          '<tr><td>Fundamentbreite</td><td>B</td><td class="r">'+B+' m</td></tr>'+
          '<tr><td>Fundamentlänge</td><td>L</td><td class="r">'+L+' m</td></tr>'+
          '<tr><td>Plattendicke</td><td>H_Platte</td><td class="r">'+dPl.toFixed(2)+' m</td></tr>'+
          (ue>0?'<tr><td>Planumtiefe / Überdeckung</td><td>ü</td><td class="r">'+ue.toFixed(2)+' m</td></tr>':'')+
          '<tr><td>Einbindetiefe Sohle</td><td>t = ü</td><td class="r">'+d.toFixed(2)+' m</td></tr>'+
          '<tr><td>Einheitsgew. Fundament</td><td>γ_F</td><td class="r">'+st.g_gbeton+' kN/m³</td></tr>'+
          '<tr><td>Material</td><td>–</td><td class="r">'+(isStahl?'Stahl':'Beton')+'</td></tr>'+
          '<tr><td>Versatz e_x / e_y</td><td>–</td><td class="r">'+st.g_ex+' / '+st.g_ey+' m</td></tr>'+
          '<tr><td>Sohlfläche A = B×L</td><td>A</td><td class="r">'+(B*L).toFixed(3)+' m²</td></tr>'+
        '</table>'+
      '</div>'+
    '</div>'+hr()+
    ch('2','Baugrundkennwerte')+
    sh2('Bodenschichten')+
    '<table class="np-tbl" style="margin-bottom:10px">'+
      '<tr><th>Schicht</th><th>Bezeichnung</th><th class="r">φ\' [°]</th><th class="r">c\' [kPa]</th><th class="r">γ [kN/m³]</th><th class="r">d [m]</th><th class="r">M_E [MN/m²]</th></tr>'+
      SCHICHTEN.map(function(s,i){
        return '<tr><td>'+(i+1)+'</td><td>'+esc(s.name)+'</td><td class="r">'+s.phi+'</td><td class="r">'+s.c+'</td><td class="r">'+s.gamma+'</td><td class="r">'+(s.d===999?'∞':s.d.toFixed(2))+'</td><td class="r">'+s.me+'</td></tr>';
      }).join('')+
    '</table>'+
    sh2('Bemessungswerte (GZT Typ 2)')+
    fml("φ'_d = arctan(tan φ'_k / γ_φ)","arctan(tan "+((phi_k0*180/Math.PI)||+st.bg_phi)+"° / "+st.tw_phi+")",(phi_d0*180/Math.PI).toFixed(2),"°")+
    fml("c'_d = c'_k / γ_c",st.bg_c+" / "+st.tw_c,c_d0.toFixed(2),"kPa")+
    sh2('Tragfähigkeitsfaktoren (Lang/Huder/Amann 9.2.6)')+
    fml("N_q = e^(π·tan φ'_d) · tan²(45°+φ'_d/2)","–",Nq0.toFixed(3),"")+
    fml("N_c = (N_q−1)/tan φ'_d","–",Nc0.toFixed(3),"")+
    fml("N_γ ≈ 1.8·(N_q−1)·tan φ'_d","–",Ng0.toFixed(3),"")+
    sh2('Grenzzustände und Lastbeiwerte')+
    '<table class="np-tbl">'+
      '<tr><th>GZT-Typ</th><th>Nachweis</th><th class="r">γ_G,sup</th><th class="r">γ_G,inf</th><th class="r">γ_Q</th></tr>'+
      '<tr><td>Typ 2</td><td>Grundbruch · Gleiten · Sohlspannung</td><td class="r">'+st.lw_G+'</td><td class="r">1.00 <span style="color:var(--xdim)">(SIA 267 Ziff. 8.5.2.4)</span></td><td class="r">'+st.lw_Q+'</td></tr>'+
      '<tr><td>Typ 1</td><td>Kippen / Ausmitte</td><td class="r">'+st.lw_G1_sup+'</td><td class="r">'+st.lw_G1_inf+'</td><td class="r">'+st.lw_Q1+'</td></tr>'+
    '</table>'+
  '</div>';

  // ── Seite 3: Lasten ────────────────────────────────────────────
  var auf = AUFLASTEN.filter(function(a){return a.active!==false && a.Pk>0;});
  var page3 = '<div class="np-page np-pb">'+ph()+
    ch('3','Einwirkungen')+
    sh2('Charakteristische Mastlasten')+
    '<table class="np-tbl" style="margin-bottom:10px">'+
      '<tr><th>Komponente</th><th>Symbol</th><th class="r">Ständig G</th><th class="r">Veränderlich W</th><th>Einheit</th></tr>'+
      '<tr><td>Vertikalkraft</td><td>N</td><td class="r">'+st.l_NG+'</td><td class="r">–</td><td>kN</td></tr>'+
      '<tr><td>Horizontalkraft x</td><td>H_x</td><td class="r">'+st.l_HGx+'</td><td class="r">'+st.l_HWx+'</td><td>kN</td></tr>'+
      '<tr><td>Horizontalkraft y</td><td>H_y</td><td class="r">'+st.l_HGy+'</td><td class="r">'+st.l_HWy+'</td><td>kN</td></tr>'+
      '<tr><td>Moment x</td><td>M_x</td><td class="r">'+st.l_MGx+'</td><td class="r">'+st.l_MWx+'</td><td>kNm</td></tr>'+
      '<tr><td>Moment y</td><td>M_y</td><td class="r">'+st.l_MGy+'</td><td class="r">'+st.l_MWy+'</td><td>kNm</td></tr>'+
    '</table>'+
    (auf.length?
      sh2('Auflasten (Ballastierung) — ständig, γ_G = '+st.lw_G)+
      '<table class="np-tbl">'+
        '<tr><th>Auflast</th><th class="r">P_k [kN]</th><th class="r">d_x [m]</th><th class="r">d_y [m]</th><th class="r">M_x = P·d_y [kNm]</th><th class="r">M_y = P·d_x [kNm]</th></tr>'+
        auf.map(function(a,i){
          return '<tr><td>Auflast '+(i+1)+'</td><td class="r">'+a.Pk.toFixed(1)+'</td><td class="r">'+a.dx.toFixed(3)+'</td><td class="r">'+a.dy.toFixed(3)+'</td><td class="r">'+(a.Pk*a.dy).toFixed(1)+'</td><td class="r">'+(a.Pk*a.dx).toFixed(1)+'</td></tr>';
        }).join('')+
        '<tr class="hl"><td><b>Summe</b></td><td class="r"><b>'+auf.reduce(function(s,a){return s+a.Pk;},0).toFixed(1)+'</b></td><td>–</td><td>–</td>'+
        '<td class="r"><b>'+auf.reduce(function(s,a){return s+a.Pk*a.dy;},0).toFixed(1)+'</b></td>'+
        '<td class="r"><b>'+auf.reduce(function(s,a){return s+a.Pk*a.dx;},0).toFixed(1)+'</b></td></tr>'+
      '</table>'
    :'')+hr()+
    ch('4','Lastfallkombinationen')+
    '<table class="np-tbl">'+
      '<tr><th>Lastfall</th><th>Typ</th><th>Aktive Komponenten</th><th class="r">γ_G</th><th class="r">γ_Q</th></tr>'+
      LF.map(function(lf){
        var gf = getGF(lf);
        var comps = Object.entries(lf.comp||{}).filter(function(e){return e[1];}).map(function(e){return e[0];}).join(' · ');
        return '<tr><td>'+lf.name+'</td><td>'+(lf.nw||'beide')+'</td><td>'+comps+'</td><td class="r">'+gf.gG+'</td><td class="r">'+gf.gW+'</td></tr>';
      }).join('')+
    '</table>'+
  '</div>';

  // ── Nachweisseiten pro LF ──────────────────────────────────────
  var NWgzg = nwOn('flach','gzg');
  var nwPages = results.filter(function(r){ return r.nw!=='gzg'; }).map(function(r){   // GZG-Lastfälle: kein Nachweis beim Flach
    var gf = getGF(LF.find(function(l){return l.name===r.name;})||{nw:'gzt'});
    var A = B*L;
    var G_plt  = G.G_platte    !== undefined ? G.G_platte    : B*L*dPl*(+st.g_gbeton||24);
    var G_hint = G.G_hinterfuel !== undefined ? G.G_hinterfuel : 0;
    var G_kpf  = G.G_kopf      !== undefined ? G.G_kopf      : 0;   // Fundamentkopf (Beton)
    var G_auf  = G.G_auftrieb  !== undefined ? G.G_auftrieb  : 0;   // Auftrieb unter GW
    var _cov   = Math.max(0, ue - dPl);                              // Erdüberdeckung über der Platte
    var Gk_tot = G.Gk           !== undefined ? G.Gk          : G_plt + G_kpf + G_hint - G_auf;
    // Je Typ-2-Nachweis die Sicht seiner massgebenden Kombination (siehe t2View)
    var rS=t2View(r,'sig'), rG=t2View(r,'gb'), rL=t2View(r,'gl');
    var kz=function(v){ return v&&v.komb ? '<div style="font-size:8.5px;color:var(--dim);margin:2px 0 6px">Massgebende Kombination: '+t2KombText(v)+' &ensp;→&ensp; N_d = '+v.Nd.toFixed(1)+' kN · H_d = '+v.Hd.toFixed(1)+' kN · e_x = '+v.ex.toFixed(3)+' m · e_y = '+v.ey.toFixed(3)+' m</div>' : ''; };

    var kombTab = (r.t2 && r.t2.all) ? sh2('Kombinationen dieses Lastfalls')+_npKombTab(r.t2.all, [
        {t:'N_d [kN]', v:function(k){return k.Nd;}, d:1}, {t:'H_d [kN]', v:function(k){return k.Hd;}, d:1},
        {t:'η Sohlspannung', v:function(k){return k.etaSIG;}, eta:true}, {t:'η Grundbruch', v:function(k){return k.etaGB;}, eta:true},
        {t:'η Gleiten', v:function(k){return k.etaGL;}, eta:true}], 'Jeder Nachweis hat seine eigene massgebende Kombination.') : '';
    return '<div class="np-page np-pb">'+ph()+
      '<div class="np-lfh">'+r.name+'</div>'+
      sh2('Eigengewicht Fundament')+
      '<table class="np-tbl" style="margin-bottom:10px">'+
        '<tr><th>Anteil</th><th>Formel</th><th class="r">Wert [kN]</th></tr>'+
        '<tr><td>G_Platte = B×L×H_Platte×γ_F</td><td class="di">'+B+'×'+L+'×'+dPl.toFixed(2)+'×'+st.g_gbeton+'</td><td class="r">'+G_plt.toFixed(1)+'</td></tr>'+
        (G_kpf>0?'<tr><td>G_Kopf = B_K×L_K×H_Kopf×γ_F</td><td class="di">'+(+st.g_kx||0)+'×'+(+st.g_ky||0)+'×'+(+st.g_hkopf||0)+'×'+st.g_gbeton+'</td><td class="r">'+G_kpf.toFixed(1)+'</td></tr>':'')+
        (G_hint>0?'<tr><td>G_Erdüberd. = (B×L − B_K×L_K)×(ü−H_Platte)×γ_auff</td><td class="di">Überdeckung über der Platte, '+_cov.toFixed(2)+' m</td><td class="r">'+G_hint.toFixed(1)+'</td></tr>':'')+
        (G_auf>0?'<tr><td>− Auftrieb (Sohle unter GW)</td><td class="di">B×L×h_w×γ_w</td><td class="r">−'+G_auf.toFixed(1)+'</td></tr>':'')+
        '<tr class="hl"><td><b>G_k (gesamt)</b></td><td class="di">Eigengewicht Fundament</td><td class="r"><b>'+Gk_tot.toFixed(1)+'</b></td></tr>'+
      '</table>'+
      sh2(r.t2 ? 'Bemessungslasten — Kombination 8 (alle Beiwerte ungünstig)' : 'Lasten — charakteristische Kombination (GZG)')+
      '<table class="np-tbl" style="margin-bottom:10px">'+
        '<tr><th>Grösse</th><th class="r">Wert</th><th>Einheit</th><th>Bemerkung</th></tr>'+
        '<tr><td>N_d</td><td class="r">'+r.Nd.toFixed(1)+'</td><td>kN</td><td>'+(r.t2?'γ_G,sup·':'')+'(N_k + G_k = '+Gk_tot.toFixed(1)+' kN)</td></tr>'+
        '<tr><td>H_xd / H_yd</td><td class="r">'+r.Hxd.toFixed(1)+' / '+r.Hyd.toFixed(1)+'</td><td>kN</td><td>Resultierende H_d = '+r.Hd.toFixed(1)+' kN</td></tr>'+
        '<tr><td>M_xd / M_yd</td><td class="r">'+r.Mxd.toFixed(1)+' / '+r.Myd.toFixed(1)+'</td><td>kNm</td><td>in der Sohle</td></tr>'+
        '<tr><td>e_x = M_yd/N_d</td><td class="r">'+r.ex.toFixed(3)+'</td><td>m</td><td>Ausmitte (Typ 2)</td></tr>'+
        '<tr><td>e_y = M_xd/N_d</td><td class="r">'+r.ey.toFixed(3)+'</td><td>m</td><td></td></tr>'+
      '</table>'+
      (!r.t2?'':'<div style="font-size:8.5px;color:var(--dim);margin:-4px 0 8px">Die Nachweise 1–3 (Typ 2) werden über alle 8 Kombinationen geführt (Eigengewicht inf/sup × ständig inf/sup × veränderlich 0/γ_Q, SIA 260); massgebend ist je Nachweis das kleinste η. Die jeweilige Kombination steht beim Nachweis.</div>')+

      kombTab+
      // ── Nachweis 1: Sohlspannung ──────────────────────────────
      (NW.sohlsp?
        '<div class="np-nw">'+
        nwh('1.','Sohlspannung','SIA 267 §7.1 — informativ für Flachfundament')+kz(rS)+
        fml("σ = N_d/A ± M_xd/W_x ± M_yd/W_y",
          rS.Nd.toFixed(0)+"/"+A.toFixed(2)+" ± "+rS.Mxd.toFixed(0)+"/"+rS.Wy.toFixed(3)+" ± "+rS.Myd.toFixed(0)+"/"+rS.Wx.toFixed(3),
          "σ_max = "+rS.smax.toFixed(1)+" / σ_min = "+rS.smin.toFixed(1),"kPa")+
        diagWrap((function(){try{return buildSohlDiagram(r,G,false);}catch(e){return '';}})())+
        eta(rS.etaSIG, !G.isBlock)+
        '</div>'
      :'')+

      // ── Nachweis 2: Grundbruch ────────────────────────────────
      (NW.grundb?
        '<div class="np-nw">'+
        nwh('2.','Grundbruch','SIA 267 Ziff. 8.5.3.5 · Formel nach SIA D 0197 — GZT Typ 2')+kz(rG)+
        sh2('Effektive Fläche (Meyerhof)')+
        fml("B' = B − 2|e_x|  /  L' = L − 2|e_y|",
          B+"−2·"+Math.abs(rG.ex).toFixed(3)+" / "+L+"−2·"+Math.abs(rG.ey).toFixed(3),
          "B'="+rG.Be.toFixed(3)+"m  /  L'="+rG.Le.toFixed(3)+"m","")+
        diagWrap((function(){try{return buildGrundbDiagram(r,G,false);}catch(e){return '';}})(), true)+
        sh2('Tragfähigkeit')+
        fml("N_q = e^(π·tanφ_d)·tan²(45°+φ_d/2)   N_c = (N_q−1)/tanφ_d   N_γ ≈ 1.8·(N_q−1)·tanφ_d",
          "φ_d = "+(rG.phi_d*180/Math.PI).toFixed(2)+"°",
          "N_q="+rG.gbD.Nq.toFixed(2)+"  N_c="+rG.gbD.Nc.toFixed(2)+"  N_γ="+rG.gbD.Ng.toFixed(2),"")+
        fml("s_c = 1+(b̄/l̄)·N_q/N_c   s_q = 1+(b̄/l̄)·tanφ_d   s_γ = 1−0.4·b̄/l̄",
          "b̄/l̄ = "+(rG.gbD.Bp/rG.gbD.Lp).toFixed(3),
          "s_c="+rG.gbD.sc.toFixed(3)+"  s_q="+rG.gbD.sq.toFixed(3)+"  s_γ="+rG.gbD.sg.toFixed(3),"")+
        fml("d_c = 1+0.007·arctan(t/b̄)   d_q = 1+0.035·tanφ_d·(1−sinφ_d)²·arctan(t/b̄)   d_γ = 1   (arctan in Grad)",
          "t/b̄ = "+rG.gbD.t.toFixed(2)+"/"+rG.gbD.Bp.toFixed(3)+" = "+(rG.gbD.t/rG.gbD.Bp).toFixed(3),
          "d_c="+rG.gbD.dc.toFixed(3)+"  d_q="+rG.gbD.dq.toFixed(3),"")+
        fml("i_q = [1 − ½·T/(N + b̄·l̄·c/tanφ_d)]⁵   i_γ = [1 − 0.7·T/(N + b̄·l̄·c/tanφ_d)]⁵   i_c = i_q − (1−i_q)/(N_q−1)",
          "T = H_d = "+rG.Hd.toFixed(1)+" kN   N = N_d = "+rG.Nd.toFixed(1)+" kN",
          "i_q="+rG.gbD.iq.toFixed(3)+"  i_γ="+rG.gbD.ig.toFixed(3)+"  i_c="+rG.gbD.ic.toFixed(3),"")+
        fml((rG.gb_q<0.9995||rG.gb_g<0.9995) ? "σ_f,d = c'_d·N_c·s_c·d_c·i_c·g_c + q₀·N_q·s_q·d_q·i_q·g_q + ½·γ·b̄·N_γ·s_γ·i_γ·g_γ   (g_c = 1−β°/147°, g_q = g_γ = (1−½·tanβ)⁵)"
                                              : "σ_f,d = c'_d·N_c·s_c·d_c·i_c + q₀·N_q·s_q·d_q·i_q + ½·γ·b̄·N_γ·s_γ·i_γ",
          "c'_d="+rG.c_d.toFixed(1)+" kPa  q₀="+rG.q0.toFixed(1)+" kPa  γ="+rG.gbD.gam.toFixed(1)+" kN/m³  B'="+rG.gbD.Bp.toFixed(3)+" m"
            +((rG.gb_q<0.9995||rG.gb_g<0.9995) ? "  g_q="+rG.gb_q.toFixed(3)+"  g_γ="+rG.gb_g.toFixed(3) : ""),
          rG.Rd.toFixed(1),"kPa")+
        fml("R_d = σ_f,d · b̄ · l̄   →   η = R_d / N_d",
          rG.Rd.toFixed(1)+" · "+rG.gbD.Aeff.toFixed(3)+" = "+rG.gbD.RdKN.toFixed(1)+" kN  /  "+rG.Nd.toFixed(1)+" kN",
          rG.etaGB.toFixed(2),"")+
        eta(rG.etaGB)+
        '</div>'
      :'')+

      // ── Nachweis 3: Gleiten ───────────────────────────────────
      (NW.gleiten?
        '<div class="np-nw">'+
        nwh('3.','Gleiten','SIA 267 Ziff. 8.5.3.4, Gl. (31) — GZT Typ 2')+kz(rL)+
        fml("δ_k = Faktor · φ'_k ≤ 35°     δ_d = arctan(tan δ_k / γ_φ)",
          (+st.bg_delta_sohle||+st.bg_delta_fac||0.667)+" · "+(Math.atan(Math.tan(rL.phi_d)*(+st.tw_phi||1.2))*180/Math.PI).toFixed(1)+"° = "+(rL.glD.dK*180/Math.PI).toFixed(2)+"°     arctan(tan "+(rL.glD.dK*180/Math.PI).toFixed(2)+"° / "+st.tw_phi+")",
          "δ_d = "+(rL.glD.dD*180/Math.PI).toFixed(2),"°")+
        fml("R_gl = N_d · tan δ_d + A' · c'_d",
          (rL.Nd_gl||rL.Nd).toFixed(1)+"·tan("+(rL.glD.dD*180/Math.PI).toFixed(2)+"°) + "+(rL.glD.cAn ? rL.glD.Aeff.toFixed(2)+"·"+(rL.c_d||0).toFixed(1) : "0 (Kohäsion nicht angesetzt, Ziff. 8.4.1.2)"),
          rL.Rgl.toFixed(1),"kN")+
        fml("η = R_gl / H_d",rL.Rgl.toFixed(1)+" / "+rL.Hd.toFixed(1),rL.etaGL.toFixed(2),"")+
        eta(rL.etaGL)+
        diagWrap((function(){try{return buildGleitDiagram(r,G,true);}catch(e){return '';}})(), true)+
        '</div>'
      :'')+

      // ── Nachweis 4: Kippnachweis (SIA 267) ─────────────────
      (NW.kippen?
        (function(){
          var ex_k = r.ex_kipp!==undefined ? r.ex_kipp : r.ex||0;
          var ey_k = r.ey_kipp!==undefined ? r.ey_kipp : r.ey||0;
          var kv   = r.klaf_val!==undefined ? r.klaf_val : (ex_k/G.B)**2+(ey_k/G.L)**2;
          var eklaf = r.eta_klaf!==undefined ? r.eta_klaf : (1/9)/Math.max(1e-6,kv);
          var ok_k = kv <= 1/9+0.00001;
          return '<div class="np-nw">'+
          nwh('4.','Kippnachweis (klaffende Fuge)','SIA 267 — GZT Typ 1, γ_G,sup='+st.lw_G1_sup+' / γ_G,inf='+st.lw_G1_inf)+
          sh2('Ausmitten mit Typ-1-Faktoren')+
          diagWrap((function(){try{return buildKippDiagram(r,G,false);}catch(e){return '';}})(), true)+
          fml('(ea/a)² + (eb/b)² ≤ 1/9  (SIA 267 — klaffende Fuge)',
              '('+Math.abs(ex_k).toFixed(3)+'/'+G.B+')²+('+Math.abs(ey_k).toFixed(3)+'/'+G.L+')²',
              kv.toFixed(5)+'  '+(ok_k?'≤ 1/9 = 0.1111  ✓':'> 1/9 = 0.1111  ✗'),'')+
          '<table class="np-tbl">'+
            '<tr><th>Grösse</th><th class="r">Wert [m]</th><th class="r">e_zul = a/3 [m]</th><th class="r">η</th><th>Status</th></tr>'+
            '<tr><td>Ausmitte e_x (Typ 1)</td><td class="r">'+ex_k.toFixed(3)+'</td><td class="r">'+(G.B/3).toFixed(3)+'</td>'+
              '<td class="r '+(r.etaKx>=1?'ok':'fail')+'">'+(r.etaKx<99?r.etaKx.toFixed(2):'—')+'</td>'+
              '<td class="'+(r.etaKx>=1?'ok':'fail')+'">'+(Math.abs(ex_k)<=(G.B/3)+0.0001?'✓':'✗')+'</td></tr>'+
            '<tr><td>Ausmitte e_y (Typ 1)</td><td class="r">'+ey_k.toFixed(3)+'</td><td class="r">'+(G.L/3).toFixed(3)+'</td>'+
              '<td class="r '+(r.etaKy>=1?'ok':'fail')+'">'+(r.etaKy<99?r.etaKy.toFixed(2):'—')+'</td>'+
              '<td class="'+(r.etaKy>=1?'ok':'fail')+'">'+(Math.abs(ey_k)<=(G.L/3)+0.0001?'✓':'✗')+'</td></tr>'+
            '<tr class="hl"><td><b>(ea/a)²+(eb/b)²</b></td><td class="r '+(ok_k?'ok':'fail')+'"><b>'+kv.toFixed(5)+'</b></td>'+
              '<td class="r">0.1111 (= 1/9)</td>'+
              '<td class="r '+(ok_k?'ok':'fail')+'"><b>'+eklaf.toFixed(2)+'</b></td>'+
              '<td class="'+(ok_k?'ok':'fail')+'"><b>'+(ok_k?'✓':'✗')+'</b></td></tr>'+
          '</table>'+
          eta(eklaf)+
          '</div>';
        })()
      :'')+
    '</div>';
  });

  // ── Globale Böschungsstandsicherheit (Bishop) — eigene Seite, EINMALIG (lastfallunabhängig).
  // Ergänzt den Grundbruch (lokaler Bruchkörper) um den globalen Gleitkreis durch die Böschung.
  const _bish = RESULT.flach && RESULT.flach.bishop;
  const bishPage = (_bish && _bish.ok && isFinite(_bish.eta)) ? '<div class="np-page np-pb">'+ph()+
    ch((5+results.length)+'.','Globale Böschungsstandsicherheit (Gleitkreis)')+
    '<div style="font-size:8.5px;color:var(--dim);line-height:1.65;margin-bottom:8px">'+
    'Eigenständiger Nachweis <b>zusätzlich zum Grundbruch</b>: Der Grundbruch erfasst den lokalen Bruchkörper '+
    'unmittelbar unter der Sohle (die Böschung geht dort nur über die Geländeneigungsbeiwerte ein). Hier wird '+
    'ein grosser Gleitkreis durch die gesamte Böschung untersucht, in dem das Fundament lediglich als Auflast wirkt. '+
    'Beide Mechanismen sind verschieden und daher getrennt nachzuweisen.'+
    '</div>'+
    '<div class="np-nw">'+
      nwh('1.','Gleitkreis nach Bishop (vereinfacht)','SIA 267 — GZT')+
      fml("η = min Σ[c'_d·b + (W − u·b)·tan φ'_d]/m_α  /  Σ W·sin α &ensp;(iterativ, m_α = cos α·(1+tan α·tan φ'_d/η))",
          'kritischer Kreis: R = '+_bish.R.toFixed(2)+' m &ensp;·&ensp; φ′_d = φ′/γ_φ &ensp;·&ensp; c′_d = c′/γ_c',
          _bish.eta.toFixed(2))+
      eta(_bish.eta)+
      (function(){ try{ return diagWrap(buildBishopSVG(_bish,true), true); }catch(e){ return ''; } })()+
      '<div style="font-size:8px;color:var(--xdim);margin-top:3px">Freie Zentrum-Grid-Suche über das reale Geländeprofil; '+
      'Fundamentlast als Flächenpressung (G_k + N_G)/(B·L), GW-Porendruck berücksichtigt. Ebenes 2D-Verfahren (plane strain) — '+
      'die seitliche 3D-Stirnscherung des Bruchkörpers ist konservativ vernachlässigt. Gegen die Taylor-Geschlossenform '+
      '(φ_u = 0) auf &lt; 2 % validiert. Bei η &lt; 1.3 vertiefte geotechnische Untersuchung (mehrere Gleitkörper, Schichtungseffekte).</div>'+
    '</div>'+
  '</div>' : '';

  // ── Inhaltsverzeichnis ─────────────────────────────────────────
  function tocRowF(num, title, sub){
    return '<div class="np-toc-row'+(sub?' np-toc-sub':'')+'">'+
      '<span class="np-toc-num">'+num+'</span>'+
      '<span class="np-toc-title">'+title+'</span>'+
      '<span class="np-toc-dots"></span>'+
    '</div>';
  }
  var nwCount = results.length;
  var lfTocRowsF = results.map(function(r,i){
    var secBase = 5+i;
    return tocRowF(secBase+'.', r.name, false)+
      (NW.sohlsp  ? tocRowF(secBase+'.1', 'Sohlspannung (informativ)',true):'') +
      (NW.grundb  ? tocRowF(secBase+'.2', 'Grundbruch — GZT Typ 2 (erweiterte Tragfähigkeitsformel)',true):'') +
      (NW.gleiten ? tocRowF(secBase+'.3', 'Gleiten — GZT Typ 2',true):'') +
      (NW.kippen  ? tocRowF(secBase+'.4', 'Kippnachweis — GZT Typ 1',true):'');
  }).join('');
  var toc = '<div class="np-page np-pb">'+ph()+
    '<div class="np-toc-hd">Inhaltsverzeichnis</div>'+
    '<div class="np-toc">'+
      tocRowF('1.', 'Systemübersicht und Geometrie', false)+
      tocRowF('2.', 'Baugrundparameter', false)+
      tocRowF('3.', 'Einwirkungen', false)+
      tocRowF('4.', 'Lastfallkombinationen', false)+
      lfTocRowsF+
      (bishPage ? tocRowF((5+nwCount)+'.', 'Globale Böschungsstandsicherheit (Gleitkreis)', false) : '')+
      tocRowF((5+nwCount+(bishPage?1:0))+'.', 'Ergebniszusammenfassung', false)+
    '</div>'+
  '</div>';

  // ── Zusammenfassung ────────────────────────────────────────────
  var allOk = results.every(function(r){return r.ok;});
  var sumHead = results.map(function(r){return '<th class="r">'+r.name+'</th>';}).join('');
  function sumRow(label, etaFn, show, italic){
    if(!show) return '';
    return '<tr><td>'+(italic?'<span style="font-style:italic">'+label+'</span>':label)+'</td>'+
      results.map(function(r){
        var v=etaFn(r); var ok=v>=1; var inf=!isFinite(v)||v>99;
        return '<td class="r '+(ok?'ok':'fail')+'">'+(inf?'–':v.toFixed(2))+'</td>';
      }).join('')+'</tr>';
  }
  var minEta = results.reduce(function(a,b){
    var k=b.eta_klaf!==undefined?b.eta_klaf:Math.min(b.etaKx||99,b.etaKy||99);
    return Math.min(a, b.etaGB||99, b.etaGL||99, k, (NWgzg && b.gzgF) ? b.etaGZG : 99);
  }, 99);
  var _bishOK = !!(_bish && _bish.ok && isFinite(_bish.eta));
  if(_bishOK) minEta = Math.min(minEta, _bish.eta);
  if(_bishOK && _bish.eta < 1) allOk = false;
  var summary = '<div class="np-page np-pb">'+ph()+
    ch((5+nwCount+(bishPage?1:0))+'.','Ergebniszusammenfassung')+
    '<div style="font-size:8.5px;color:var(--dim);margin-bottom:10px">'+
    'Übersicht aller Nachweis-Ausnutzungsgrade η je Lastfall. Nachweis erbracht wenn η ≥ 1.0.'+
    '</div>'+
    '<table class="np-tbl" style="margin-bottom:14px">'+
      '<thead><tr><th>Nachweis / Grenzzustand</th>'+sumHead+'</tr></thead><tbody>'+
      sumRow('Sohlspannung (informativ)', function(r){return r.etaSIG;}, NW.sohlsp, true)+
      sumRow('Grundbruch — GZT Typ 2 (erweiterte Tragfähigkeitsformel)', function(r){return r.etaGB;}, NW.grundb, false)+
      sumRow('Gebrauchstauglichkeit — Kernweite / Verkippung (SIA 267 Ziff. 8.5.4)', function(r){return r.gzgF ? r.etaGZG : Infinity;}, NWgzg, false)+
      sumRow('Gleiten — GZT Typ 2', function(r){return r.etaGL;}, NW.gleiten, false)+
      sumRow('Kippnachweis — GZT Typ 1', function(r){return r.eta_klaf!==undefined ? r.eta_klaf : Math.min(r.etaKx||99,r.etaKy||99);}, NW.kippen, false)+
      (_bishOK ? '<tr><td>Globale Böschungsstandsicherheit (Bishop)</td>'+
        '<td class="r '+(_bish.eta>=1?'ok':'fail')+'" colspan="'+Math.max(1,results.length)+'">'+_bish.eta.toFixed(2)+
        ' <span style="color:var(--xdim);font-size:7.5px">(lastfallunabhängig)</span></td></tr>' : '')+
    '</tbody></table>'+
    '<div class="np-verdict '+(allOk?'ok':'fail')+'">'+
      '<div class="np-verdict-v">'+(allOk?'✓  Alle massgebenden Nachweise sind erfüllt':'✗  Mindestens ein Nachweis ist nicht erfüllt')+'</div>'+
      '<div class="np-verdict-s">Massgebend: η = '+minEta.toFixed(2)+' · Starre Methode · SIA 267:2013 · '+now.toLocaleDateString('de-CH')+'</div>'+
    '</div>'+
  '</div>';

  // ── Gebrauchstauglichkeit je Lastfall (SIA 267 Ziff. 8.5.4): Kernweite + Verkippung
  var zu1=function(v){ return v>1e-9 ? '1:'+Math.round(1/v) : '–'; };
  var gzgPages = !NWgzg ? [] : results.filter(function(r){ return r.gzgF; }).map(function(r){
    var z=r.gzgF, D=z.quer?z.X:z.Y, Mm=Math.abs(z.quer?z.May:z.Max);
    return '<div class="np-page np-pb">'+ph()+
      '<div class="np-lfh">'+r.name+' — Gebrauchstauglichkeit</div>'+
      '<div style="font-size:8.5px;color:var(--dim);margin:-2px 0 8px">Charakteristische Lasten (SIA 267 Ziff. 5.3.3.6: γ_F = 1.0): '+
        'γ_G = '+z.gamG.toFixed(2)+' · γ_Q = '+z.gamQ.toFixed(2)+' · Eigengewicht 1.00. Baugrundwerte charakteristisch (Ziff. 5.3.2.8).</div>'+
      '<div class="np-nw">'+nwh('G1.','Lastexzentrizität — einfache Kernweite','SIA 267 Ziff. 8.5.4.7')+
        fml("e_x = M_y,k / N_k     e_y = M_x,k / N_k",
            Math.abs(z.May).toFixed(1)+" / "+z.N.toFixed(1)+"     "+Math.abs(z.Max).toFixed(1)+" / "+z.N.toFixed(1),
            "e_x = "+z.ex.toFixed(3)+" m   e_y = "+z.ey.toFixed(3)+" m","")+
        fml("|e_x|/B + |e_y|/L ≤ 1/6", z.ex.toFixed(3)+"/"+B+" + "+z.ey.toFixed(3)+"/"+L, z.kern.toFixed(4), z.kern<=1/6+1e-9 ? "≤ 0.1667" : "> 0.1667")+
        fml("η = (1/6) / (|e_x|/B + |e_y|/L)", "0.1667 / "+z.kern.toFixed(4), isFinite(z.etaKern)?z.etaKern.toFixed(2):"∞","")+
        eta(z.etaKern)+
        diagWrap((function(){try{return buildFlachGzgDiagram(r,G,true);}catch(e){return '';}})(), true)+
        (z.kern>1/6 ? '<div style="font-size:8.5px;color:var(--fail);margin-top:4px">Die Sohlfuge klafft unter Gebrauchslasten. Ziff. 8.5.4.7 verlangt einen besonderen Nachweis; die folgende Verkippung setzt eine geschlossene Sohlfuge voraus und ist hier zu klein.</div>' : '')+
      '</div>'+
      '<div class="np-nw">'+nwh('G2.','Verkippung','SIA 267 Ziff. 8.5.4.1 · Grenzwert SBB 0161.1011.0007')+
        fml("G = M_E·(1−2ν) / (2·(1−ν))", D.ME.toFixed(1)+" MN/m² · (1−2·"+z.nu+") / (2·(1−"+z.nu+"))", (D.G/1000).toFixed(2), "MN/m²")+
        fml("r = (4·I/π)^¼    mit I = "+(z.quer?"L·B³/12":"B·L³/12"), "Ersatzradius gleichen Trägheitsmoments", D.r.toFixed(3), "m")+
        fml("tan α = 3·(1−ν)·M_k / (8·G·r³)", "3·(1−"+z.nu+")·"+Mm.toFixed(1)+" / (8·"+D.G.toFixed(0)+"·"+D.r.toFixed(3)+"³)", (z.tan*1000).toFixed(3)+" ‰ = "+zu1(z.tan), "")+
        fml("η = tan α_zul / tan α", zu1(z.tanZul)+" / "+zu1(z.tan), isFinite(z.etaTilt)?z.etaTilt.toFixed(2):"∞","")+
        eta(z.etaTilt)+
        '<table class="np-tbl" style="margin-top:6px"><tr><th>Richtung</th><th class="r">M_k [kNm]</th><th class="r">M_E [MN/m²]</th><th class="r">r [m]</th><th class="r">tan α</th></tr>'+
          '<tr><td>quer (um y)</td><td class="r">'+Math.abs(z.May).toFixed(1)+'</td><td class="r">'+z.X.ME.toFixed(1)+'</td><td class="r">'+z.X.r.toFixed(3)+'</td><td class="r">'+zu1(z.X.tan)+'</td></tr>'+
          '<tr><td>längs (um x)</td><td class="r">'+Math.abs(z.Max).toFixed(1)+'</td><td class="r">'+z.Y.ME.toFixed(1)+'</td><td class="r">'+z.Y.r.toFixed(3)+'</td><td class="r">'+zu1(z.Y.tan)+'</td></tr></table>'+
        '<div style="font-size:8px;color:var(--xdim);margin-top:4px">Starres Fundament auf dem elastischen Halbraum (Borowicka), ν = '+z.nu+'; M_E = harmonisches Mittel der Schichten von der Sohle bis 1.5·Breite darunter. Einbindung und seitliche Stützung sind nicht angesetzt. Die SIA 267 regelt das Berechnungsverfahren nicht; der Grenzwert '+(z.perm?'1:100 (ständig + veränderlich)':'1:200 (nur veränderlich)')+' stammt aus der SBB-Vorgabe.</div>'+
      '</div>'+
      '<div style="font-size:9.5px;margin-top:8px"><b>Gebrauchstauglichkeit: η = min(Kernweite, Verkippung) = '+(isFinite(r.etaGZG)?r.etaGZG.toFixed(2):'∞')+'</b></div>'+
    '</div>'; });
  return cover + toc + page2 + page3 + nwPages.join('') + gzgPages.join('') + bishPage + summary + _npAnnahmen('flach', ph);
}

// ════════════════════════════════════════════════════════════════
