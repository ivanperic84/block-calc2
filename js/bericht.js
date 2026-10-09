// BlockCalc — js/bericht.js
// Nachweisbericht: Öffnen, Bausteine, Bericht Blockfundament
// ── Nachweisplot öffnen
function openNachweisplot(){
  const body=document.getElementById('nw-plot-body');
  if(!body) return;
  const M = curModel();
  if(!M.hatErgebnis()){
    body.innerHTML='<div style="padding:40px;text-align:center;font-family:var(--f-mono);font-size:11px;color:var(--xdim)">Bitte zuerst Berechnen</div>';
    document.getElementById('ov-nachweisplot').style.display='flex';
    return;
  }
  // 3D-Modell-Screenshot für den Bericht erfassen (preserveDrawingBuffer:true → toDataURL zuverlässig)
  try { window._npModelImg = (typeof renderer!=='undefined' && renderer && renderer.domElement) ? renderer.domElement.toDataURL('image/png') : null; }
  catch(e){ window._npModelImg = null; }
  // Modellabhängig: Block → Steckner-Bericht, Flach → Hansen-Bericht, Pfahlfundament → Mikropfahl-Bericht
  let doc;
  try {
    doc = M.bericht();
  } catch(e) {
    console.error('Nachweisplot Fehler:', e);
    doc = '<div class="np-page"><div style="padding:40px;font-family:var(--f-mono);font-size:11px;color:var(--fail)">Fehler beim Erstellen des Berichts:<br>'+e.message+'</div></div>';
  }
  const main = document.getElementById('nw-plot-main');
  // Detailtiefe + Abbildungen aus den Optionen (Default: detailliert, mit Abbildungen)
  const simple = (typeof SETTINGS!=='undefined' && SETTINGS.reportDetail==='simple');
  const nofig  = (typeof SETTINGS!=='undefined' && SETTINGS.reportFigs===false);
  if(main) main.innerHTML = '<div class="np-doc'+(simple?' np-simple':'')+(nofig?' np-nofig':'')+'" id="nw-plot-doc">'+doc+'</div>';
  const selD=document.getElementById('np-detail'); if(selD) selD.value = simple?'simple':'full';
  const cbF=document.getElementById('np-figs'); if(cbF) cbF.checked = !nofig;
  // Titel dynamisch anpassen
  const titleEl = document.querySelector('.nw-plot-title');
  if(titleEl) titleEl.textContent = 'Standsicherheitsnachweis — '+M.label+' SIA 267';
  document.getElementById('ov-nachweisplot').style.display='flex';
  // Thumbnails nach kurzem Delay (DOM muss gerendert sein)
  setTimeout(_buildNachweisThumb, 80);
}
function closeNachweisplot(){
  document.getElementById('ov-nachweisplot').style.display='none';
}
// Berichts-Optionen: Detailtiefe (einfach/detailliert) + Abbildungen (an/aus) — reine CSS-Klassen
// auf dem Dokument, keine Neuberechnung. In SETTINGS gemerkt.
function _setReportDetail(v){
  if(typeof SETTINGS!=='undefined'){ SETTINGS.reportDetail=v; if(typeof dbSet==='function') dbSet('bc_settings',SETTINGS); }
  const d=document.getElementById('nw-plot-doc'); if(d) d.classList.toggle('np-simple', v==='simple');
}
function _setReportFigs(on){
  if(typeof SETTINGS!=='undefined'){ SETTINGS.reportFigs=!!on; if(typeof dbSet==='function') dbSet('bc_settings',SETTINGS); }
  const d=document.getElementById('nw-plot-doc'); if(d) d.classList.toggle('np-nofig', !on);
}

function _buildNachweisThumb(){
  const sidebar = document.getElementById('nw-plot-sidebar');
  const main    = document.getElementById('nw-plot-main');
  if(!sidebar || !main) return;
  const pages = main.querySelectorAll('.np-page');
  sidebar.innerHTML = '';
  pages.forEach((page, i) => {
    // Wrapper mit A4-Seitenverhältnis (128 × 181 px)
    const wrap = document.createElement('div');
    wrap.className = 'nw-plot-thumb' + (i===0?' active':'');
    wrap.title = 'Seite '+(i+1);

    // Geklonter Seiteninhalt, skaliert auf 128px Breite (Scale = 128/760 ≈ 0.168)
    const inner = document.createElement('div');
    inner.className = 'nw-plot-thumb-inner';
    inner.innerHTML = page.innerHTML;
    // Bilder + SVGs behalten, interaktive Elemente entfernen
    inner.querySelectorAll('button,input,select,textarea').forEach(el=>el.remove());
    wrap.appendChild(inner);

    // Seitennummer-Label
    const lbl = document.createElement('div');
    lbl.className = 'nw-plot-thumb-lbl';
    lbl.textContent = 'Seite '+(i+1);
    wrap.appendChild(lbl);

    // Klick → zur Seite scrollen
    wrap.addEventListener('click', ()=>{
      sidebar.querySelectorAll('.nw-plot-thumb').forEach(t=>t.classList.remove('active'));
      wrap.classList.add('active');
      page.scrollIntoView({behavior:'smooth', block:'start'});
    });
    sidebar.appendChild(wrap);
  });

  // Scroll-Spy: aktive Seite in Sidebar hervorheben
  main.onscroll = () => {
    const thumbs = sidebar.querySelectorAll('.nw-plot-thumb');
    pages.forEach((page, i) => {
      const rect = page.getBoundingClientRect();
      const mainRect = main.getBoundingClientRect();
      if(rect.top <= mainRect.top + mainRect.height*0.5 && rect.bottom > mainRect.top){
        thumbs.forEach(t=>t.classList.remove('active'));
        if(thumbs[i]) thumbs[i].classList.add('active');
      }
    });
  };
}

// ── 3D-Viewer Snapshot
function captureViewerPNG(){
  try{
    if(!renderer||!scene||!camera) return '';
    renderer.render(scene,camera);
    return renderer.domElement.toDataURL('image/png');
  }catch(e){ return ''; }
}

// ── Viewer-Screenshot mit Vermassung (WebGL + HTML-Labels kombiniert)
function captureViewerWithDimPNG(){
  try {
    if(!renderer||!scene||!camera) return '';
    // Vermassung + Labels sicherstellen
    const prevDim=showDim, prevText=showText, prevLabels=showLabels;
    showDim=true; showText=true; showLabels=true;
    rebuildScene();
    // Zoom näher: Kamera-Radius temporär verkleinern
    const prevR = sph.r;
    sph.r = Math.max(2.5, prevR * 0.55);
    moveCam();
    renderer.render(scene,camera);

    const glCanvas = renderer.domElement;
    const W = glCanvas.width, H = glCanvas.height;

    // Combined canvas: WebGL + Labels
    const combined = document.createElement('canvas');
    combined.width = W; combined.height = H;
    const ctx = combined.getContext('2d');
    ctx.drawImage(glCanvas, 0, 0);

    // Labels projizieren und auf Canvas zeichnen
    // Skalierungsfaktor: Canvas-Pixel vs. CSS-Pixel (devicePixelRatio)
    const dpr = window.devicePixelRatio || 1;
    const fs = Math.round(13 * dpr);
    const tmp = new THREE.Vector3();
    ctx.font = 'bold '+fs+'px "DM Mono", monospace';
    ctx.textBaseline = 'middle';
    _vlEls.forEach(({el, pos})=>{
      tmp.copy(pos).project(camera);
      if(tmp.z > 1) return;
      const isFrc = el.classList.contains('vl-frc');
      const isDim = el.classList.contains('vl-dim');
      if(isFrc) return;  // Einwirkungen im Report-Screenshot ausblenden
      if(!showDim && isDim) return;
      const x = (tmp.x*0.5+0.5)*W;
      const y = (-tmp.y*0.5+0.5)*H;
      const text = el.textContent;
      const tw = ctx.measureText(text).width;
      const pad=Math.round(4*dpr), rh=Math.round(18*dpr);
      // Hintergrund hell
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.strokeStyle = 'rgba(100,120,160,0.4)';
      ctx.lineWidth = dpr;
      ctx.beginPath();
      ctx.roundRect(x-pad, y-rh/2, tw+pad*2, rh, Math.round(3*dpr));
      ctx.fill();
      ctx.stroke();
      // Text dunkel
      ctx.fillStyle = isDim ? '#2a4070' : isFrc ? '#1a3060' : '#334466';
      ctx.fillText(text, x, y);
    });

    // Restore
    showDim=prevDim; showText=prevText; showLabels=prevLabels;
    sph.r = prevR; moveCam();
    rebuildScene();

    return combined.toDataURL('image/png');
  } catch(e){ return captureViewerPNG(); }
}

// ── Dokument-Hilfsfunktionen
function _npN(v,d=2){ return (v==null||!isFinite(v))?'–':v.toFixed(d); }
function _npDeg(r){ return (r*180/Math.PI).toFixed(1)+'°'; }
function _npEta(eta,inf){
  if(inf) return `<span class="np-eta inf">informativ</span>`;
  if(!isFinite(eta)||eta>999) return `<span class="np-eta inf">n.m.</span>`;
  const ok=etaErf(eta);
  return `<span class="np-eta ${ok?'ok':'fail'}">${ok?'✓':'✗'}&ensp;η = ${_npN(eta)}&ensp;${ok?'Erfüllt':'Nicht erfüllt'}</span>`;
}
// Bausteine der Nachweisberichte (Block, Flach, Pfahlfundament teilen sie)
function _npCh(num,title){ return '<div class="np-ch">'+num+'&ensp;'+title+'</div>'; }             // Kapitelkopf
function _npHr(){ return '<div class="np-hr"></div>'; }
function _npSh2(t){ return '<div class="np-sh2">'+t+'</div>'; }                                    // Zwischentitel
function _npNwh(nr,title,norm){                                                                    // Nachweiskopf
  return '<div class="np-nwh"><span class="nr">'+nr+'</span>'+title+(norm!=null&&norm!==''?'<span class="norm">'+norm+'</span>':'')+'</div>';
}
function _npCalc(formula, substitution, result, unit){                                             // Formel / Einsetzen / Ergebnis
  return '<div class="np-calc">'+
    '<div class="np-cf">'+formula+'</div>'+
    (substitution?'<div class="np-cv">= '+substitution+'</div>':'')+
    '<div class="np-cr">= '+result+(unit?' '+unit:'')+'</div>'+
  '</div>';
}
function _npDef(k,desc,v,u){                                                                       // Bezeichnung | Beschreibung | Wert
  return '<div class="np-def"><span class="dk">'+k+'</span><span class="ds">'+desc+'</span><span class="dv">'+v+(u?'&ensp;'+u:'')+'</span></div>';
}
function _npPH(st,datStr){
  const firma=SETTINGS.firma?`<strong>${esc(SETTINGS.firma)}</strong> &ensp;`:'';
  return `<div class="np-ph">${firma}${esc(st.p_name||'–')}&ensp;·&ensp;Nr.&thinsp;${esc(st.p_nr||'–')}<span>SIA 267:2013 &ensp;·&ensp; ${curModel().kopf} &ensp;·&ensp; ${datStr}</span></div>`;
}

// ── Vollständiges Standsicherheitsdokument aufbauen
function buildNachweisDoc(results,G){
  var st=collectState();
  var NW=_nwFor('block');
  var isBlock=G.isBlock;
  var t=G.Hb, ue=G.ue||0;
  var Hblock=t-ue;
  var B=+gi('g_bx'), L=+gi('g_by');
  var now=new Date();
  var datStr=st.p_datum||(now.toLocaleDateString('de-CH'));

  // ── Helfer ──────────────────────────────────────────────────────
  function ph(){return _npPH(st,datStr);}
  var ch=_npCh, hr=_npHr, calc=_npCalc, def=_npDef;
  var r0=results[0]||{};
  var phi_k_rad=r0.phi_k_GZT||0;
  var phi_d_rad=r0.phi_d||0;
  // G_k = nur Betonkörper (Block + Kopf inkl. ü-Bereich); seitliche Auffüllung zählt nicht mehr zur ständigen Vertikallast.
  // G_k NICHT nachrechnen, sondern den tatsächlich verwendeten Wert zeigen (G.Gk).
  // Die frühere Nachrechnung nutzte den Kopfhebel (H_Kopf+ü) der Altkonvention und
  // ignorierte kopf_in_gk sowie den Auftrieb — der gedruckte Wert wich damit vom
  // gerechneten ab (Aug 2026, H_Kopf-Nachprüfung).
  var _gbet   = +gi('g_gbeton');
  var _kopfIn = document.getElementById('kopf_in_gk')?.checked !== false;
  var _Vbl    = B*L*Hblock, _Vkp = (+gi('g_kx'))*(+gi('g_ky'))*(G.Hkopf||0);
  var Gk_brut = (_Vbl + (_kopfIn ? _Vkp : 0))*_gbet;
  var Gk_est  = (typeof G.Gk === 'number') ? G.Gk : Gk_brut;
  var _Gk_auf = Gk_brut - Gk_est;   // > 0 ⇒ Auftrieb wurde abgezogen

  // ────────────────────────────────────────────────────────────────
  // TITELBLATT
  // ────────────────────────────────────────────────────────────────
  var cover='<div class="np-page np-pb">'+ph()+_npLogo()+
    '<div class="np-firma">'+esc(SETTINGS.firma||'BlockCalc SIA 267')+'</div>'+
    '<div class="np-ct">Standsicherheitsnachweis</div>'+
    '<div class="np-ct" style="font-size:13px;margin-bottom:4px">Blockfundament nach Steckner (1989) / SIA 267:2013</div>'+
    '<div class="np-cs">Nachweis der Standsicherheit (GZT) und Gebrauchstauglichkeit (GZG) für ein eingespanntes Blockfundament</div>'+
    '<div class="np-cblock">'+
      '<div class="np-cmeta">'+
        '<span class="k">Bauteil / Objekt</span><span class="v">'+esc(st.p_name||'–')+'</span>'+
        '<span class="k">Projektnummer</span><span class="v">'+esc(st.p_nr||'–')+'</span>'+
        '<span class="k">Bearbeiter</span><span class="v">'+esc(st.p_bearbeiter||SETTINGS.bearbeiter||'–')+'</span>'+
        '<span class="k">Datum</span><span class="v">'+datStr+'</span>'+
        '<span class="k">Berechnungsmodell</span><span class="v">Steckner Blockfundament</span>'+
        '<span class="k">Bemerkung</span><span class="v">'+esc(st.p_bemerk||'–')+'</span>'+
      '</div>'+
      '<div class="np-sh2" style="margin-top:18px">Normgrundlagen</div>'+
      '<table class="np-tbl" style="margin-bottom:14px">'+
        '<tr><th>Norm</th><th>Titel</th><th>Anwendung in diesem Nachweis</th></tr>'+
        '<tr><td>SIA 267:2013</td><td>Geotechnik</td><td>Nachweisformate GZT/GZG, Erddruckansatz, Teilsicherheiten</td></tr>'+
        '<tr><td>SIA 261:2020</td><td>Einwirkungen auf Tragwerke</td><td>Lastfallkombinationen, Sicherheitsbeiwerte γ_G, γ_Q</td></tr>'+
        '<tr><td>Steckner (1989)</td><td>Standsicherheitsnachweis eingespannte Blockfundamente, Bautechnik 66, H.2</td><td>GZT: Gl.66 (Grenzmoment), Nulllinie, b_id; GZG: Winkler-Federmodell</td></tr>'+
        '<tr><td>DIN 4085:2017</td><td>Berechnung des Erddrucks</td><td>Schichtweise Trapez-Integration Ka/Kph/K0</td></tr>'+
      '</table>'+
      '<div class="np-sh2">Berechnungskonzept</div>'+
      '<div style="font-size:8.5px;color:var(--dim);line-height:1.7;margin-bottom:18px">'+
      'Das Blockfundament wird als starrer Körper betrachtet, der sich um eine Nulllinie (Drehpunkt) dreht. '+
      (SETTINGS.stecknerMob!==false
        ? 'Über der Nulllinie wirkt der auf den mobilisierten Anteil abgeminderte Erdwiderstand (E_p,mob = E₀ + mob·(E_p − E₀), mob = '+(SETTINGS.mob??0.25)+'), '
        : 'Über der Nulllinie wirkt der volle passive Erdwiderstand (λ_p, Steckner Gl.32), ')+
      'unter der Nulllinie das reduzierte Passivmass λ\'_p (Gl.29). '+
      'Das Grenzmoment Mu (Steckner Gl.66) umfasst alle Kräfte: Erddrücke, Reibungskomponenten, Sohlreaktionen. '+
      'Der GZT-Nachweis lautet η = Mu/M_d ≥ 1.0 (Bezugspunkt H*: Oberkante Block). '+
      'Der GZG-Nachweis begrenzt die elastische Verdrehung: tan(α) ≤ tan(α)_zul.'+
      '</div>'+
      (window._npModelImg?'<div class="np-fig" style="margin:6px 0 16px;text-align:center">'+
        '<img src="'+window._npModelImg+'" style="max-width:78%;border:1px solid var(--ol);border-radius:3px"/>'+
        '<div style="font-size:8px;color:var(--xdim);margin-top:3px">Abb. 1 — 3D-Modell des Fundaments (aktuelle Ansicht)</div>'+
      '</div>':'')+
      '<table class="np-tbl" style="width:55%">'+
        '<tr><th>Rev.</th><th>Datum</th><th>Beschreibung</th><th>Visum</th></tr>'+
        '<tr><td>0</td><td>'+datStr+'</td><td>Erstausgabe</td><td>'+esc(st.p_bearbeiter||SETTINGS.bearbeiter||'')+'</td></tr>'+
      '</table>'+
    '</div>'+
  '</div>';

  // ────────────────────────────────────────────────────────────────
  // SEITE 2: KAPITEL 1 + 2 (Systemübersicht & Baugrund)
  // ────────────────────────────────────────────────────────────────
  var svgQS=null; // SVG-Skizze ersetzt durch 3D-Screenshot mit Vermassung
  var viewerImg=captureViewerWithDimPNG();
  var gwTyp=gi('bg_gw')||'nein';
  var schRows=SCHICHTEN.map(function(s,i){
    var dStr=s.d===999?'∞':_npN(s.d)+' m';
    return '<tr><td>'+(i+1)+'</td><td>'+esc(s.name||'Schicht '+(i+1))+'</td>'+
      '<td class="r">'+_npN(s.phi)+'°</td><td class="r">'+_npN(s.c)+'</td>'+
      '<td class="r">'+_npN(s.gamma)+'</td><td class="r">'+_npN(s.gamma||0)+'</td>'+
      '<td class="r">'+_npN(s.me||0)+'</td><td>'+dStr+'</td></tr>';
  }).join('');
  var Ka_=r0.Ka_GZT||0, Kph_=r0.Kph_GZT||0, K0_=r0.K0_GZT||0;
  var phi_k_deg=_npDeg(phi_k_rad), phi_d_deg=_npDeg(phi_d_rad);
  var bid_val=r0.bid||0;
  var page2='<div class="np-page np-pb">'+ph()+
    ch('1','Systemübersicht und Geometrie')+
    '<div class="np-geo">'+
      (viewerImg?'<div style="width:50%;min-width:240px"><img src="'+viewerImg+'" style="width:100%;border-radius:4px;border:0.5px solid var(--ol)"/></div>':
        '<div style="width:50%;min-width:240px;padding:20px;text-align:center;font-size:8px;color:var(--xdim);border:0.5px solid var(--ol)">3D-Modell nicht verfügbar</div>')+
      '<div style="flex:1">'+
        '<table class="np-tbl">'+
          '<tr><th colspan="3">Fundamentgeometrie</th></tr>'+
          '<tr><th>Parameter</th><th>Bezeichnung</th><th class="r">Wert</th></tr>'+
          '<tr><td>B / L</td><td>Breite / Länge</td><td class="r">'+_npN(B)+' / '+_npN(L)+' m</td></tr>'+
          '<tr><td>H_Block</td><td>Einbindetiefe (netto)</td><td class="r">'+_npN(Hblock)+' m</td></tr>'+
          '<tr><td>ü</td><td>Überdeckung ab OK Block</td><td class="r">'+_npN(ue)+' m</td></tr>'+
          '<tr class="hl"><td>t = H_Block + ü</td><td>Effektive Einbindetiefe</td><td class="r"><b>'+_npN(t)+' m</b></td></tr>'+
          '<tr><td>Bk / Lk / Hk</td><td>Kopfabmessungen</td><td class="r">'+_npN(+gi('g_kx'))+' / '+_npN(+gi('g_ky'))+' / '+_npN(G.Hkopf||0)+' m</td></tr>'+
          '<tr><td>e_x / e_y</td><td>Fundamentexzentrizität</td><td class="r">'+_npN(+gi('g_ex'))+' / '+_npN(+gi('g_ey'))+' m</td></tr>'+
          '<tr><td>γ_Beton / γ_Auffl.</td><td>Wichte Beton / Auffüllung</td><td class="r">'+_npN(+gi('g_gbeton'))+' / '+_npN(+gi('g_gauf'))+' kN/m³</td></tr>'+
        '</table>'+
      '</div>'+
    '</div>'+
    hr()+
    ch('2','Baugrundparameter')+
    '<table class="np-tbl" style="margin-bottom:8px">'+
      '<tr><th>#</th><th>Bodenschicht</th><th class="r">&#966;&#8242; [°]</th><th class="r">c&#8242; [kPa]</th><th class="r">&#947; [kN/m³]</th><th class="r">&#947;&#8242; [kN/m³]</th><th class="r">M_E [MN/m²]</th><th>Dicke</th></tr>'+
      schRows+
    '</table>'+
    '<div class="np-g2">'+
      '<div>'+
        '<div class="np-sh2">Bemessungswerte der Bodenkennwerte</div>'+
        calc('φ_d = arctan(tan φ_k / γ_φ)',
          'arctan(tan '+phi_k_deg+' / '+_npN(+gi('tw_phi'),2)+')',
          phi_d_deg)+
        calc('c_d = c_k / γ_c',
          _npN(r0.c_d!=null?r0.c_d*(+gi('tw_c')||1.5):0)+' kPa / '+_npN(+gi('tw_c'),2),
          _npN(r0.c_d||0)+' kPa')+
        calc('δ_d = '+gi('bg_delta_fac')+'·φ_d',
          gi('bg_delta_fac')+' × '+phi_d_deg,
          _npDeg(r0.delta_d||0))+
        '<div style="font-size:8px;color:var(--xdim);margin-top:2px">Nachrichtlich: Der Steckner-GZT setzt die Erddruckbeiwerte mit dem <b>charakteristischen</b> φ_k an und führt die Teilsicherheit über die Widerstandsbeiwerte γ_Ea/γ_Ep auf die Erddruckkräfte (ST-Ansatz, kein Doppelabzug). φ_d/δ_d dienen dem Vergleich.</div>'+
      '</div>'+
      '<div>'+
        '<div class="np-sh2">Erddruckbeiwerte (charakteristisch)</div>'+
        '<table class="np-tbl">'+
          '<tr><th>Beiwert</th><th>Formel</th><th class="r">Wert</th></tr>'+
          '<tr><td>Ka</td><td>Coulomb, δ_a=⅔·φ_k (Horiz.komp., Gl.27)</td><td class="r">'+_npN(Ka_,3)+'</td></tr>'+
          '<tr><td>Kph</td><td>Coulomb (δ=−0.5φ_k)</td><td class="r">'+_npN(Kph_,3)+'</td></tr>'+
          '<tr><td>K0</td><td>1−sin(φ_k) (Jaky)</td><td class="r">'+_npN(K0_,3)+'</td></tr>'+
        '</table>'+
        '<div class="np-sh2">Ideelle Druckwandbreite</div>'+
        calc('b_id = B + 0.6·t·tan(φ_k)',
          _npN(B)+' + 0.6·'+_npN(t)+'·tan('+phi_k_deg+')',
          _npN(bid_val)+' m')+
        '<div class="np-sh2">Teilsicherheitsbeiwerte</div>'+
        '<table class="np-tbl">'+
          '<tr><th>γ_G</th><th>γ_Q</th><th>γ_φ</th><th>γ_c</th><th>γ_Ea</th><th>γ_Ep</th></tr>'+
          '<tr><td class="r">'+gi('lw_G')+'</td><td class="r">'+gi('lw_Q')+'</td>'+
              '<td class="r">'+gi('tw_phi')+'</td><td class="r">'+gi('tw_c')+'</td>'+
              '<td class="r">'+gi('tw_Ea')+'</td><td class="r">'+gi('tw_Ep')+'</td></tr>'+
        '</table>'+
        '<div style="font-size:8px;color:var(--xdim);margin-top:4px">'+
        'Grundwasser: '+(gwTyp==='nein'?'nicht vorhanden':'Tiefe '+_npN(+gi('bg_gwt'))+' m u.GOK')+
        ' · Passivdruck über NL: '+(SETTINGS.stecknerMob!==false?('mobilisiert (mob = '+(SETTINGS.mob!=null?SETTINGS.mob:0.25)+')'):'voll (λ_p, Steckner-Papier)')+
        '</div>'+
      '</div>'+
    '</div>'+
  '</div>';

  // ────────────────────────────────────────────────────────────────
  // SEITE 3: KAPITEL 3 (Einwirkungen)
  // ────────────────────────────────────────────────────────────────
  var lfLoadRows=results.map(function(r){
    var lf=LF.find(function(l){return l.name===r.name;})||{nw:'gzt'};
    var lfgf=getGF(lf);
    return '<tr><td><b>'+r.name+'</b></td><td class="r">'+_npN(lfgf.gG,2)+'</td>'+
      '<td class="r">'+_npN(lfgf.gW,2)+'</td>'+
      '<td class="r">'+_npN(r.Nd)+'</td><td class="r">'+_npN(r.Hxd)+'</td><td class="r">'+_npN(r.Hyd)+'</td>'+
      '<td class="r"><b>'+_npN(Math.sqrt(r.Hxd*r.Hxd+r.Hyd*r.Hyd))+'</b></td>'+
      '<td class="r">'+_npN(r.Mxd)+'</td><td class="r">'+_npN(r.Myd)+'</td></tr>';
  }).join('');
  var page3='<div class="np-page np-pb">'+ph()+
    ch('3','Einwirkungen und Schnittgrössen')+
    '<div style="font-size:8px;color:var(--xdim);margin-bottom:8px">'+
    'Bezugspunkt H*: Oberkante Block (= GOK − ü). Momente M_Gx/M_Gy am Bezugspunkt H* direkt eingegeben. '+
    'Hebelarm der Horizontalkräfte vom Lastangriff (OK Kopf) bis zum Bezugspunkt: H_Kopf = '+_npN(G.Hkopf||0)+' m; '+
    'vom Bezugspunkt bis zur Sohle: H_Block = '+_npN(Math.max(0,t-(G.ue||0)))+' m.'+
    '</div>'+
    '<div class="np-sh2">Charakteristische Einwirkungen</div>'+
    '<table class="np-tbl" style="margin-bottom:12px">'+
      '<tr><th>Einwirkung</th><th>Symbol</th><th class="r">Wert</th><th>Einheit</th><th>Typ</th></tr>'+
      '<tr><td>Vertikallast (ständig)</td><td>N_G</td><td class="r">'+_npN(+gi('l_NG'))+'</td><td>kN</td><td>G</td></tr>'+
      '<tr><td>Horizontalkraft quer (ständig)</td><td>H_Gx</td><td class="r">'+_npN(+gi('l_HGx'))+'</td><td>kN</td><td>G</td></tr>'+
      '<tr><td>Horizontalkraft längs (ständig)</td><td>H_Gy</td><td class="r">'+_npN(+gi('l_HGy'))+'</td><td>kN</td><td>G</td></tr>'+
      '<tr><td>Moment x-Achse (ständig, am H*)</td><td>M_Gx</td><td class="r">'+_npN(+gi('l_MGx'))+'</td><td>kNm</td><td>G</td></tr>'+
      '<tr><td>Moment y-Achse (ständig, am H*)</td><td>M_Gy</td><td class="r">'+_npN(+gi('l_MGy'))+'</td><td>kNm</td><td>G</td></tr>'+
      '<tr><td>Horizontalkraft quer (Wind/veränd.)</td><td>H_Wx</td><td class="r">'+_npN(+gi('l_HWx'))+'</td><td>kN</td><td>Q</td></tr>'+
      '<tr><td>Horizontalkraft längs (Wind/veränd.)</td><td>H_Wy</td><td class="r">'+_npN(+gi('l_HWy'))+'</td><td>kN</td><td>Q</td></tr>'+
      '<tr><td>Moment x-Achse (Wind, am H*)</td><td>M_Wx</td><td class="r">'+_npN(+gi('l_MWx'))+'</td><td>kNm</td><td>Q</td></tr>'+
      '<tr><td>Moment y-Achse (Wind, am H*)</td><td>M_Wy</td><td class="r">'+_npN(+gi('l_MWy'))+'</td><td>kNm</td><td>Q</td></tr>'+
    '</table>'+
    '<div class="np-sh2">Eigengewicht Fundament G_k</div>'+
    calc('G_k = V_Block·γ_B'+(_kopfIn?' + V_Kopf·γ_B':'')+(_Gk_auf>0.05?' − Auftrieb':''),
      '('+_npN(B)+'×'+_npN(L)+'×'+_npN(Hblock)+'×'+_npN(_gbet)+')'
      +(_kopfIn?' + ('+_npN((+gi('g_kx'))*(+gi('g_ky')))+'×'+_npN(G.Hkopf||0,2)+'×'+_npN(_gbet)+')':'')
      +(_Gk_auf>0.05?' − '+_npN(_Gk_auf):''),
      _npN(Gk_est)+' kN',
      '(nur Betonkörper Block'+(_kopfIn?'+Kopf':'')+' — Überdeckung/Auffüllung nicht angesetzt'
      +(_kopfIn?'':' · Kopfgewicht per Option ausgeschlossen')+
      ' · H_Kopf = Gesamthöhe OK Block → OK Kopf)')+
    hr()+
    '<div class="np-sh2">Bemessungsgrössen je Lastfall (Bemessungsnormalschnittgrössen an der Sohle)</div>'+
    '<table class="np-tbl">'+
      '<tr><th>Lastfall</th><th class="r">γ_G</th><th class="r">γ_Q</th>'+
      '<th class="r">N_d [kN]</th><th class="r">H_xd [kN]</th><th class="r">H_yd [kN]</th>'+
      '<th class="r">|H_d| [kN]</th><th class="r">M_xd [kNm]</th><th class="r">M_yd [kNm]</th></tr>'+
      lfLoadRows+
    '</table>'+
  '</div>';

  // ────────────────────────────────────────────────────────────────
  // SEITEN 4+: KAPITEL 4–7 PRO LASTFALL
  // ────────────────────────────────────────────────────────────────
  var nwPages=results.map(function(r){
    var use_x=Math.abs(r.Hxd||0)>=Math.abs(r.Hyd||0);
    var A_pl=use_x?B:L;   // massgebende Plattenabmessung in Lastrichtung (Gl.66 A/2-Term, u=(A−x)/2)
    var Hd=use_x?Math.abs(r.Hxd||0):Math.abs(r.Hyd||0);
    // Bemessungsmoment an OK Block (H*) = GENAU der von computeGZT_dir konsumierte Wert (M_ok_x/y_d);
    // damit ist die Berichtsanzeige η = M_u / M_d,H* self-konsistent (M_d = M_u/η). Der frühere
    // Ausdruck |M_d,Sohle − H_d·Hblock| war eine berichtsinterne Hilfsgrösse ohne Bezug zum η-Divisor.
    var Md_ok=use_x?Math.abs(r.M_ok_x_d||0):Math.abs(r.M_ok_y_d||0);
    var dir=use_x?'x (quer)':'y (längs)';
    var phi_k=r.phi_k_GZT||0;
    var mob=r.mob_GZT!=null?r.mob_GZT:0.25;
    var gEa=r.gEa_GZT||1.35, gEp=r.gEp_GZT||1.40;
    var y=r.y_NL_GZT||0, h=t-y;
    var Ea=r.Ea_GZT||0, Ew=r.Ew_GZT||0, Epa=r.Epa_GZT||0, Epb=r.Epb_GZT||0;
    var E0a=r.E0a_GZT||0, E0b=r.E0b_GZT||0;
    var Ra=r.Ra_v_GZT||0, Rpa=r.Rp_va_GZT||0, Rpb=r.Rp_vb_GZT||0;
    var Nu=r.Nu_GZT||0, Ru=r.Ru_GZT||0;
    var u=r.u_ecc_GZT||0, v=r.arm_v_GZT||0, vp=r.arm_vp_GZT||0;
    var Mu=r.Mu_GZT||0;
    // Charakteristische Werte (Zahlen, nicht Strings)
    var Ea_kN=Ea/gEa, Ew_kN=Ew*gEp, Ep_k_aN=Epa*gEp, Ep_k_bN=Epb*gEp;
    // E0a/E0b aus dem Ergebnis sind bereits CHARAKTERISTISCH (f.E0_k / f.E0p_k) — nicht nochmals ×γ_Ep!
    // Sie gehen als charakteristische Reibung R₀ = E0·tan(⅔φ) in Ew_d bzw. E'w_d ein.
    var E0_k_aN=E0a, E0_k_bN=E0b;
    // Formatierte Strings für Anzeige
    var Ea_k=_npN(Ea_kN), Ew_k=_npN(Ew_kN), Ep_k_a=_npN(Ep_k_aN), Ep_k_b=_npN(Ep_k_bN);
    var E0_k_a=_npN(E0_k_aN), E0_k_b=_npN(E0_k_bN);

    // GZT Diagramm
    var gztKey='_gzt_'+r.name.replace(/\W/g,'_');
    var gztData=window[gztKey];
    var gztSvg=gztData?buildGZTDiagram(gztData.R,gztData.G,true,false):'';

    // Term-Berechnung Mu (Steckner Gl.66, neues Modell):
    // Ew enthält bereits −Ea+R0; E'w = E'p + R'0 (R'0 = E0'·tan(⅔φ))
    var R0p_rep=E0b*Math.tan((2/3)*phi_k);
    var term1=-Ew*v;
    var term2=(Epb+R0p_rep)*vp;
    var term3=(Ra+Rpa+Rpb)*(A_pl/2);
    var term4=Ru*(t-ue);
    var term5=Nu*u;

    // GZG — Steckner Gl.11-21
    var tanZul=r.tanZul_GZG!=null?r.tanZul_GZG:_tanZul(true);
    var tan_a1=r.tan_a1_GZG||0, tan_a2=r.tan_a2_GZG||0;
    var M1_g=r.M1_GZG_val||0, M2_g=r.M2_GZG_val||0;
    var Malpha_g=r.Malpha_GZG_val||0, Mu_c=r.Mu_char_GZG||0;
    var M_ok_g=r.M_ok_char_GZG||0;
    var alpha=r.alpha_GZG_calc||0;
    var N_al=r.Nd/1.35;  // N_α charakteristisch (Näherung)
    var Hxk=(r.Hxk||0), Hyk=(r.Hyk||0);
    var Hk_g=use_x?Math.abs(Hxk):Math.abs(Hyk);

    return '<div class="np-page np-pb">'+ph()+
      '<div class="np-lfh">'+r.name+' — Standsicherheitsnachweis Blockfundament</div>'+

      // ── Kap 4: Nulllinie ─────────────────────────────────────────
      ch('4','Ermittlung der Nulllinie (Drehpunkt)')+
      '<div style="font-size:8.5px;color:var(--dim);margin-bottom:7px">'+
      'Massgebende Richtung: <b>'+dir+'</b> &ensp;|&ensp; '+
      'Bemessungsschnittgrössen an Sohle: N_d = '+_npN(r.Nd)+' kN &ensp; H_d = '+_npN(Hd)+' kN &ensp; M_d(Sohle) = '+_npN(use_x?r.Mxd:r.Myd)+' kNm'+
      '</div>'+
      calc('M_d,H* = H_d·H_Kopf + M_ext,d',
        _npN(Hd)+'·'+_npN(+gi('g_hkopf')||0,2)+' + '+_npN(Md_ok-Hd*(+gi('g_hkopf')||0)),
        _npN(Md_ok)+' kNm',
        '(Bezugspunkt H*: OK Block · M_ext,d = γ_G·M_G + γ_Q·M_W + N_d·e)')+
      calc('b_id = B + 0.6·t·tan(φ_k)',
        _npN(B)+' + 0.6·'+_npN(t)+'·tan('+_npDeg(phi_k)+')',
        _npN(bid_val)+' m')+
      '<div style="font-size:8.5px;color:var(--dim);margin:6px 0 3px">'+
      'Gleichgewichtsbedingung (iterativ, Bisektionsverfahren — 2 Pässe, je 50 Iterationen):'+
      '</div>'+
      '<div class="np-calc">'+
        '<div class="np-cf">Ew(y) − Ep,d,u(y) = H_d + R_u</div>'+
        '<div class="np-cv">→ Nulllinie y über UK</div>'+
        '<div class="np-cr">y = '+_npN(y)+' m über UK &ensp;|&ensp; h = t − y = '+_npN(h)+' m (Höhe über NL)</div>'+
      '</div>'+

      hr()+

      // ── Kap 5: Erddruckkomponenten ───────────────────────────────
      ch('5','Erddruckkomponenten und Kräftegleichgewicht')+
      '<div class="np-g2">'+
        '<div>'+
          '<div class="np-sh2">Über der Nulllinie (h = '+_npN(h)+' m)</div>'+
          calc('E_a,d = E_a,k · γ_Ea &ensp;[schichtweise integriert]',
            Ea_k+' kN · '+_npN(gEa,2),
            _npN(Ea)+' kN', '(destabilisierend ←)')+
          calc('E_w,d = E_p,d − E_a,d + R₀,d  (Steckner Gl.43)',
            _npN(Ew+r.Ea_GZT-((r.E0a_GZT||0)*Math.tan(2/3*(r.phi_k_GZT||0))))+' − '+_npN(r.Ea_GZT)+' + R₀',
            _npN(Ew)+' kN', (SETTINGS.stecknerMob!==false ? 'E_p,d mobilisiert (E₀+mob·(E_p−E₀), mob='+(SETTINGS.mob??0.25)+')' : 'E_p,d = voller Passivdruck λ_p (Gl.32)')+' · R₀ = E₀·tan(⅔·φ_k)')+
          calc('E_0,a,k  (Ruhedruck über NL, charakteristisch)',
            '',
            _npN(E0a)+' kN', '(wirkt via R₀ = E0·tan ⅔φ, destab. ←)')+
          '<div class="np-sh2">Unter der Nulllinie (y = '+_npN(y)+' m)</div>'+
          calc('E_p,b,d = Ep,k,unter / γ_Ep &ensp;[schichtweise integriert]',
            Ep_k_b+' / '+_npN(gEp,2),
            _npN(Epb)+' kN', '(passiv unter NL →, stabilisierend)')+
          calc('E'+"'"+'_0,k  (Ruhedruck unter NL, charakteristisch)',
            '',
            _npN(E0b)+' kN', '(wirkt via R'+"'"+'₀ = E0·tan ⅔φ, stab. →)')+
        '</div>'+
        '<div>'+
          (gztSvg?gztSvg:'')+
        '</div>'+
      '</div>'+

      hr()+

      // ── Kap 6: Grenzmoment ───────────────────────────────────────
      ch('6','Grenzzustände und Widerstände (GZT · Steckner Gl.66)')+
      (r.komb_GZT ? '<div class="np-sh2" style="margin-top:0">Massgebende Lastfall-Kombination: Nr. '+r.komb_GZT+' (von 8, generiert aus γ_G sup/inf · γ_Q — min. η)</div>' : '')+
      '<div class="np-sh2">Reibungskräfte (Steckner Gl.38-40, charakteristische Basis)</div>'+
      calc('R_a = E_a,k · tan(δ₁) ,  δ₁ = ⅔·φ_k  (Gl.8)',
        '… · tan(⅔·'+_npDeg(phi_k)+')',
        _npN(Ra)+' kN', '(Reibung Ea ↓, erhöht N_u)')+
      calc('R_p = E_p,k · tan(δ_p)',
        '… · tan(δ_p)',
        _npN(Rpa)+' kN', '(Reibung Ep über NL ↑, reduziert N_u)')+
      calc('R'+"'"+'_p = E'+"'"+'_p,k · tan(δ_p)',
        '… · tan(δ_p)',
        _npN(Rpb)+' kN', '(Reibung Ep unter NL ↓, erhöht N_u — Gl.46!)')+
      calc('N_u = max(0, N_d + R_a − R_p + R'+"'"+'_p) / γ_Ep',
        'max(0, '+_npN(r.Nd_GZT!=null?r.Nd_GZT:r.Nd)+' + '+_npN(Ra)+' − '+_npN(Rpa)+' + '+_npN(Rpb)+') / '+_npN(gEp,2),
        _npN(Nu)+' kN', '(Gl.46, als Widerstand /γ_Ep)')+
      calc('R_u = N_u · tan(φ_k)',
        _npN(Nu)+' · tan('+_npDeg(phi_k)+')',
        _npN(Ru)+' kN', '(Gl.51, Sohlreibung φ₂ = φ_k)')+
      '<div class="np-sh2">Hebelarme (ab H*) und Exzentrizität</div>'+
      '<table class="np-tbl" style="margin-bottom:8px">'+
        '<tr><th>Grösse</th><th>Formel</th><th class="r">Wert</th><th>Bedeutung</th></tr>'+
        '<tr><td>v</td><td>(h−ü)(2h+ü)/(3(h+ü))</td><td class="r">'+_npN(v)+' m</td><td>Hebelarm OK Block → Schwerpunkt Kräfte über NL (Gl.36)</td></tr>'+
        '<tr><td>v'+"'"+'</td><td>h + y·(2t+h)/(3(t+h)) − ü</td><td class="r">'+_npN(vp)+' m</td><td>Hebelarm OK Block → Schwerpunkt Kräfte unter NL (Gl.37)</td></tr>'+
        '<tr><td>u</td><td>(A − x)/2 ,  x = N_u/(B·p_u,d)</td><td class="r">'+_npN(u)+' m</td><td>Exzentrizität der Sohlreaktion (Gl.47/48, Bodendruckkeil)</td></tr>'+
      '</table>'+
      '<div class="np-sh2">Grenzmoment M_u (Steckner Gl.66) — alle 5 Terme</div>'+
      '<div class="np-calc">'+
        '<div class="np-cf">M_u = −E_w,d·v                       [Term 1: Netto-Erdwiderstand über NL (Gl.43: Ep−Ea+R₀)]</div>'+
        '<div class="np-cf">     + E'+"'"+'_w,d·v'+"'"+'                      [Term 2: Netto-Widerstand unter NL (Gl.44: E'+"'"+'p+R'+"'"+'₀)]</div>'+
        '<div class="np-cf">     + (R_a + R_p + R'+"'"+'_p)·A/2          [Term 3: Erddruck-Reibungsmomente]</div>'+
        '<div class="np-cf">     + R_u·(t−ü)                        [Term 4: Sohlreibung × Blockhöhe]</div>'+
        '<div class="np-cf">     + N_u·u                            [Term 5: Sohlreaktion × Exzentrizität]</div>'+
        '<div class="np-cv">= −'+_npN(Ew)+'·'+_npN(v)+'</div>'+
        '<div class="np-cv">  + ('+_npN(Epb)+'+'+_npN(R0p_rep)+')·'+_npN(vp)+'</div>'+
        '<div class="np-cv">  + ('+_npN(Ra)+'+'+_npN(Rpa)+'+'+_npN(Rpb)+')·'+_npN(A_pl/2)+'</div>'+
        '<div class="np-cv">  + '+_npN(Ru)+'·('+_npN(t)+'−'+_npN(ue)+')</div>'+
        '<div class="np-cv">  + '+_npN(Nu)+'·'+_npN(u)+'</div>'+
        '<div class="np-cv">= '+_npN(term1)+' + '+_npN(term2)+' + '+_npN(term3)+' + '+_npN(term4)+' + '+_npN(term5)+'</div>'+
        '<div class="np-cr">= '+_npN(Mu)+' kNm</div>'+
      '</div>'+
      '<div style="margin-top:8px">'+
        calc('η_GZT = M_u / M_d,H*',
          _npN(Mu)+' kNm / '+_npN(Md_ok)+' kNm',
          _npN(r.etaGZT))+
      '</div>'+
      '<div style="margin-top:4px">'+_npEta(r.etaGZT,false)+'</div>'+

      hr()+

      // ── Kap 7: GZG — Steckner 1989 Gl.11-21 ──────────────────────
      ch('7','GZG — Schiefstellung nach Steckner 1989, Gl.11–21')+
      '<div style="font-size:8.5px;color:var(--dim);line-height:1.65;margin-bottom:8px">'+
      'Berechnungsmodell: starrer Block rotiert unter charakteristischen Lasten. '+
      'M₁ = stirnseitige Einspannung (C₁-Bettung), M₂ = Sohlenreaktionsmoment (C₂-Bettung). '+
      'M_α = M₁ + M₂ − HD-Korrektur, begrenzt auf M_u,char (Gl.21). '+
      'Nachweis: M_ok ≤ M_α  →  η = M_α / M_ok ≥ 1.0.'+
      '</div>'+

      '<div class="np-sh2">7.1  Charakteristische Einwirkungen</div>'+
      '<table class="np-tbl" style="margin-bottom:8px">'+
        '<tr><th>Grösse</th><th>Beschreibung</th><th class="r">Wert</th></tr>'+
        '<tr><td>N_α</td><td>Charakteristische Normalkraft (Eigengewicht + Aufbaulast)</td><td class="r">'+_npN(N_al)+' kN</td></tr>'+
        '<tr><td>H_k</td><td>Charakteristische Horizontalkraft ('+(use_x?'x-Richtung':'y-Richtung')+')</td><td class="r">'+_npN(Hk_g)+' kN</td></tr>'+
        '<tr><td>M_ok</td><td>Moment an OK Block (Steckner Bezugspunkt, char.)</td><td class="r">'+_npN(M_ok_g)+' kNm</td></tr>'+
        '<tr><td>C₁ = C₂</td><td>Bettungsziffer</td><td class="r">'+_npN(+gi('bg_c1'))+' MN/m³</td></tr>'+(function(){
          var cd=window._c1Calc||{};
          var meth=cd.zoneKey==='ok'  ? 'Steckner Gl.3 (M_E ≥ '+cd.grenzwert+' MN/m²)' :
                   cd.zoneKey==='mid' ? 'Blend: '+(((cd.w||0)*100).toFixed(0))+'% Steckner + '+((((1-(cd.w||0))*100).toFixed(0)))+'% Winkler M_E·Kp/B' :
                   cd.zoneKey==='soft'? 'Winkler M_E·Kp/B (Steckner nicht gültig — M_E < 12 MN/m²)' : '—';
          var me_info = cd.me_avg!=null ? ' · M_E,avg = '+cd.me_avg.toFixed(0)+' MN/m²' : '';
          return '<tr><td style="font-size:7.5px;color:var(--dim)">C₁-Methode</td><td style="font-size:7.5px;color:var(--dim)">'+meth+me_info+'</td><td></td></tr>';
        })()+
      '</table>'+

      '<div class="np-sh2">7.2  Kennzeichnende Winkel (Gl.11 und Gl.12)</div>'+
      calc('tan α₁ = 6·(N_α·tan φ₂ + H_k) / (B·D²·C₁)',
        '6·('+_npN(N_al)+'·'+_npN(Math.tan(phi_k),3)+' + '+_npN(Hk_g)+') / ('+_npN(B)+'·'+_npN(t*t,2)+'·'+_npN(+gi('bg_c1')*1000,0)+')',
        tan_a1.toFixed(5),'[Überwindung Sohlreibung]')+
      calc('tan α₂ = 2·N_α / (A²·B·C₂)',
        '2·'+_npN(N_al)+' / ('+_npN(+gi('g_by'),2)+'²·'+_npN(B)+'·'+_npN(+gi('bg_c1')*1000,0)+')',
        tan_a2.toFixed(5),'[Abheben hintere Sohlkante]')+
      '<div style="font-size:8px;color:var(--xdim);margin:3px 0 6px">'+
      'Bereich: tan α_zul = '+tanZul+
      (tanZul > 3*tan_a1 ? ' &gt; 3·tan α₁ → <b>Bereich Gl.15+Gl.17+Gl.20</b>' :
       tanZul > tan_a1   ? ' &gt; tan α₁ → <b>Übergangsbereich Gl.14+Gl.16</b>' :
                           ' ≤ tan α₁ → <b>Bereich Gl.13+Gl.16</b>')+
      '</div>'+

      '<div class="np-sh2">7.3  Reaktionsmoment M₁ — stirnseitige Einspannung (Gl.15)</div>'+
      calc('M₁ = (1/36)·B·D³·C₁·tan α_zul',
        '(1/36)·'+_npN(B)+'·'+_npN(Math.pow(t,3),2)+'·'+_npN(+gi('bg_c1')*1000,0)+'·'+tanZul,
        _npN(M1_g)+' kNm')+

      '<div class="np-sh2">7.4  Sohlenreaktionsmoment M₂ (Gl.17)</div>'+
      calc('M₂ = N_α·(A/2 − (1/3)·√(2·N_α / (B·C₂·tan α_zul)))',
        _npN(N_al)+'·('+_npN(+gi('g_by')/2)+' − (1/3)·√(2·'+_npN(N_al)+'/('+_npN(B)+'·'+_npN(+gi('bg_c1')*1000,0)+'·'+tanZul+')))',
        _npN(M2_g)+' kNm')+

      '<div class="np-sh2">7.5  Resultierendes Moment M_α und M_u,char</div>'+
      calc('M_α = M₁ + M₂ − (2/3)·H_k·D',
        _npN(M1_g)+' + '+_npN(M2_g)+' − (2/3)·'+_npN(Hk_g)+'·'+_npN(t),
        _npN(M1_g+M2_g-(2/3)*Hk_g*t)+' kNm', '(ohne M_u-Begrenzung)')+
      calc('M_u,char  (GZT char. Lasten, Gl.21)',
        'N_k = '+_npN(N_al)+' kN · H_k = '+_npN(Hk_g)+' kN (Bisektionsverfahren)',
        _npN(Mu_c)+' kNm')+
      '<div class="np-calc">'+
        '<div class="np-cf">M_α,begrenzt = min(M_α, M_u,char)</div>'+
        '<div class="np-cv">= min('+_npN(M1_g+M2_g-(2/3)*Hk_g*t)+' ; '+_npN(Mu_c)+')</div>'+
        '<div class="np-cr">= '+_npN(Malpha_g)+' kNm</div>'+
      '</div>'+

      '<div class="np-sh2">7.6  Schiefstellung und Nachweis</div>'+
      '<div class="np-calc">'+
        '<div class="np-cf">tan(α)_res: Lösung M_α(α) = M_ok  →  Bisektionsverfahren</div>'+
        '<div class="np-cv">M_ok = '+_npN(M_ok_g)+' kNm</div>'+
        '<div class="np-cr">tan(α)_res = '+alpha.toFixed(5)+'  ≤  tan(α)_zul = '+tanZul+'</div>'+
      '</div>'+
      calc('η_GZG = M_α / M_ok',
        _npN(Malpha_g)+' kNm / '+_npN(M_ok_g)+' kNm',
        _npN(r.etaGZG))+
      '<table class="np-tbl" style="margin:8px 0">'+
        '<tr><th>Grösse</th><th>Beschreibung</th><th class="r">Wert</th><th class="r">Grenzwert</th><th>Beurteilung</th></tr>'+
        '<tr><td>tan(α)_res</td><td>Resultierende Schiefstellung</td><td class="r">'+alpha.toFixed(5)+'</td>'+
             '<td class="r">'+tanZul.toFixed(5)+'</td>'+
             '<td class="'+(alpha<=tanZul?'ok':'fail')+'">'+(alpha<=tanZul?'✓ Erfüllt':'✗ Nicht erfüllt')+'</td></tr>'+
        '<tr class="hl"><td>η_GZG</td><td>M_α / M_ok</td><td class="r"><b>'+_npN(r.etaGZG)+'</b></td>'+
             '<td class="r">≥ 1.0</td>'+
             '<td class="'+(etaErf(r.etaGZG)?'ok':'fail')+'">'+(etaErf(r.etaGZG)?'✓ Erfüllt':'✗ Nicht erfüllt')+'</td></tr>'+
      '</table>'+
      _npEta(r.etaGZG,false)+
    '</div>';
  }).join('');

  // ────────────────────────────────────────────────────────────────
  // INHALTSVERZEICHNIS
  // ────────────────────────────────────────────────────────────────
  function tocRow(num, title, sub){
    return '<div class="np-toc-row'+(sub?' np-toc-sub':'')+'">'+
      '<span class="np-toc-num">'+num+'</span>'+
      '<span class="np-toc-title">'+title+'</span>'+
      '<span class="np-toc-dots"></span>'+
    '</div>';
  }
  var lfCount = results.length;
  var lfTocRows = results.map(function(r,i){
    var secBase = 5+i;
    return tocRow(secBase+'.', r.name, false)+
      (NW.sohlsp  ? tocRow(secBase+'.1', 'Sohlspannung (informativ)',true):'') +
      (NW.grundb  ? tocRow(secBase+'.2', 'Grundbruch — GZT Typ 2',true):'') +
      (NW.gleiten ? tocRow(secBase+'.3', 'Gleiten — GZT Typ 2',true):'') +
      (NW.kippen  ? tocRow(secBase+'.4', 'Kippnachweis — GZT Typ 1',true):'') +
      (NW.gzt     ? tocRow(secBase+'.5', 'GZT Standsicherheit (Steckner Gl.66)',true):'') +
      (NW.gzg     ? tocRow(secBase+'.6', 'GZG Schiefstellung',true):'');
  }).join('');
  var toc = '<div class="np-page np-pb">'+ph()+
    '<div class="np-toc-hd">Inhaltsverzeichnis</div>'+
    '<div class="np-toc">'+
      tocRow('1.', 'Systemübersicht und Geometrie', false)+
      tocRow('2.', 'Baugrundparameter', false)+
      tocRow('3.', 'Einwirkungen', false)+
      tocRow('4.', 'Lastfallkombinationen', false)+
      lfTocRows+
      tocRow((5+lfCount)+'.', 'Ergebniszusammenfassung', false)+
    '</div>'+
  '</div>';

  // ────────────────────────────────────────────────────────────────
  // LETZTE SEITE: ZUSAMMENFASSUNG (erweitert)
  // ────────────────────────────────────────────────────────────────
  var sumHead=results.map(function(r){return '<th>'+r.name+'</th>';}).join('');
  function sumRowBlock(label, etaFn, show, note){
    // Abgeschaltete Nachweise werden AUSGEWIESEN, nicht stillschweigend weggelassen — sonst
    // sieht der Bericht vollständig aus, obwohl ein Nachweis fehlt (Optionen je Tragsystem).
    if(!show) return '<tr><td style="color:var(--xdim)">'+label+'</td>'+
      '<td class="r" colspan="'+Math.max(1,results.length)+'" style="color:var(--xdim);font-style:italic">'+
      'nicht geführt (in den Optionen abgeschaltet)</td></tr>';
    return '<tr><td>'+(note?'<span style="font-style:italic">'+label+'</span>':label)+'</td>'+
      results.map(function(r){
        var v=etaFn(r);
        var inf=!isFinite(v)||v>99;
        var ok=v>=1;
        return '<td class="r '+(ok?'ok':'fail')+'">'+
          (inf?'–':v.toFixed(2))+
        '</td>';
      }).join('')+'</tr>';
  }
  var gztRow=results.map(function(r){
    var ok=r.etaGZT>=1.0&&isFinite(r.etaGZT);
    return '<td class="'+(ok?'ok':'fail')+' r">'+(ok?'✓':'✗')+' η = '+_npN(r.etaGZT)+'</td>';
  }).join('');
  var gzgRow=results.map(function(r){
    var ok=r.etaGZG>=1.0&&isFinite(r.etaGZG);
    return '<td class="'+(ok?'ok':'fail')+' r">'+(ok?'✓':'✗')+' η = '+_npN(r.etaGZG)+'</td>';
  }).join('');
  var allOk=results.every(function(r){return r.ok;});

  var summary='<div class="np-page">'+ph()+
    ch((5+lfCount)+'.','Ergebniszusammenfassung')+
    '<div style="font-size:8.5px;color:var(--dim);margin-bottom:10px">'+
    'Übersicht aller Nachweis-Ausnutzungsgrade η je Lastfall. Nachweis erbracht wenn η ≥ 1.0.'+
    '</div>'+
    '<table class="np-tbl" style="margin-bottom:14px">'+
      '<thead><tr><th>Nachweis / Grenzzustand</th>'+sumHead+'</tr></thead><tbody>'+
      sumRowBlock('Sohlspannung (informativ)', function(r){return r.etaSIG;}, NW.sohlsp, true)+
      sumRowBlock('Grundbruch — GZT Typ 2 (Hansen)', function(r){return r.etaGB;}, NW.grundb)+
      sumRowBlock('Gleiten — GZT Typ 2', function(r){return r.etaGL;}, NW.gleiten)+
      sumRowBlock('Kippnachweis — GZT Typ 1', function(r){return isFinite(r.eta_klaf)?r.eta_klaf:Math.min(r.etaKx,r.etaKy);}, NW.kippen)+
      '<tr class="hl"><td><b>GZT — Standsicherheit (Steckner Gl.66)</b></td>'+gztRow+'</tr>'+
      (NW.gzg?'<tr><td>GZG — Schiefstellung</td>'+gzgRow+'</tr>':'')+
    '</tbody></table>'+
    '<div class="np-verdict '+(allOk?'ok':'fail')+'">'+
      '<div class="np-verdict-v">'+(allOk?'✓  Alle massgebenden Nachweise (GZT und GZG) sind erfüllt':'✗  Mindestens ein Nachweis ist nicht erfüllt')+'</div>'+
      '<div class="np-verdict-s">Berechnungsmodell: Steckner Blockfundament · SIA 267:2013 · '+datStr+'</div>'+
    '</div>'+
  '</div>';

  return '<div class="np-wrap">'+cover+toc+page2+page3+nwPages+summary+'</div>';
}

// ════════════════════════════════════════════════════════════════
