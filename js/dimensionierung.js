// BlockCalc — js/dimensionierung.js
// Dimensionierungs-Karte
// ── U1/U2: Auto-Dimensionierung + Sensitivität (Sweep über den Pure-Rechenkern) ────────
// Kleinste B×L (Raster 0.05 m, Seitenverhältnis fest, H_Block fest) mit η ≥ 1.0 über die
// massgebenden Nachweise. C₁ (Auto-Modus) bleibt beim Sweep auf dem Startwert eingefroren
// (leichte Näherung) — nach «Übernehmen» rechnet die App exakt und zeigt das echte η.
function _dimEtaMin(r){
  const w=r.worst;
  const es = r.G.isBlock ? [w.etaGZT, w.etaGZG] : [w.etaGB, w.etaGL, w.eta_klaf, w.etaSIG];
  const f = es.filter(isFinite);
  return f.length ? Math.min(...f) : Infinity;
}
function _dimGovName(r){
  const w=r.worst, e=_dimEtaMin(r);
  const map = r.G.isBlock
    ? [[w.etaGZT,'GZT Standsicherheit'],[w.etaGZG,'GZG Schiefstellung']]
    : [[w.etaGB,'Grundbruch'],[w.etaGL,'Gleiten'],[w.eta_klaf,'Kippen'],[w.etaSIG,'Sohlspannung']];
  const hit = map.find(([v])=>isFinite(v) && Math.abs(v-e)<1e-9);
  return hit ? hit[1] : '–';
}
function autoDimension(){
  const out=document.getElementById('dim-result'); if(!out) return;
  if(!curModel().dimensionierbar){ out.innerHTML='<div class="hint">Nur für Block-/Flachfundament (Pfahlfundament: Pfahllänge/-zahl massgebend).</div>'; return; }
  out.innerHTML='<div class="hint">Berechne Vorschlag…</div>';
  setTimeout(()=>{ try{ _autoDimensionRun(out); }catch(e){ out.innerHTML='<div class="hint">Dimensionierung fehlgeschlagen: '+(e&&e.message||e)+'</div>'; } }, 30);
}
// Staffel B×L aus resultierendem charakteristischem Moment (ständig + veränderlich),
// SBB-Praxis: bis 80 kNm → 1.10 m · bis 135 → 1.20 m · bis 230 → 1.40 m
const _DIM_BL_STAFFEL=[[80,1.10],[135,1.20],[230,1.40]];
let _dimBLManual=false;   // true = Nutzer hat das B×L-Feld von Hand gesetzt (leeren = wieder auto)
function _autoDimensionRun(out){
  const base=collectCalcInputs();
  const step=0.05;
  // C₁ LIVE je Sweep-Schritt (Aug 2026 — vorher eingefroren auf der Eingangsgeometrie).
  // c1AutoValue() liest die Geometrie aus dem DOM, also wird die Suchgeometrie vor jedem Schritt
  // gesetzt und am Ende wieder hergestellt. Wirkt nur im GZG-/Böschungs-Ast (der GZT ist C₁-frei).
  // ACHTUNG Richtung: der eingefrorene Wert konnte je nach Startgeometrie zu GROSS sein (Start
  // tiefer als die Lösung ⇒ C₁ überschätzt ⇒ zu kleines H vorgeschlagen = unkonservativ) oder zu
  // klein. Verifiziert β=−30°/M_E=20: Start H=2.20 ⇒ eingefroren H_req 1.60, live 1.75 m.
  // Gleiches Muster wie runBemessung.
  // Bauzustand (Option): mit reduziertem ständigem Lastbeiwert dimensionieren. Der Sweep läuft
  // über den Pure-Kern, der lw_G aus dem Snapshot liest — deshalb wird der Wert dort ersetzt.
  const _dimGfull = Math.max(1, +base.raw.lw_G || 1.35);
  const _dimGred  = _bzGred(_dimGfull);
  const _dimBz    = Math.abs(_dimGred - _dimGfull) > 1e-9;
  if(_dimBz) base.raw = { ...base.raw, lw_G: String(_dimGred) };
  const _dimBak={ g_bx:gi('g_bx'), g_by:gi('g_by'), g_hblock:gi('g_hblock') };
  const _dimRestore=()=>{ si('g_bx',_dimBak.g_bx); si('g_by',_dimBak.g_by); si('g_hblock',_dimBak.g_hblock); };
  const liveC1=fb=>{ try{ return c1AutoValue().c1_eff; }catch(_){ return fb; } };
  const c1For=()=> base.c1_manual ? base.c1_auto_eff : liveC1(base.c1_auto_eff);
  const snap=v=>+(Math.round(v/step)*step).toFixed(2);
  // Resultierendes charakteristisches Moment aus den Mastlasten (MG + MW, quer/längs vektoriell)
  const MresK=Math.hypot((+base.raw.l_MGx||0)+(+base.raw.l_MWx||0), (+base.raw.l_MGy||0)+(+base.raw.l_MWy||0));
  const stf=_DIM_BL_STAFFEL.find(([m])=>MresK<=m+1e-9);
  const blAuto=stf?stf[1]:_DIM_BL_STAFFEL[_DIM_BL_STAFFEL.length-1][1];   // über Staffel → 1.40 + Hinweis
  const blField=document.getElementById('dim-bl');
  if(!_dimBLManual || !blField.value){ blField.value=blAuto.toFixed(2); _dimBLManual=false; }
  const blLim=snap(Math.max(0.5, +blField.value||blAuto));
  const Bk_=+base.raw.g_kx||0, Lk_=+base.raw.g_ky||0;
  const fmt=v=>v.toFixed(2), fe=e=>!isFinite(e)?'n.m.':e.toFixed(2);
  const row=(l,v,c)=>`<div style="display:flex;justify-content:space-between;gap:10px;font-family:var(--f-mono);font-size:10.5px;padding:2px 0"><span style="color:var(--dim)">${l}</span><span style="color:${c||'var(--on2)'}">${v}</span></div>`;
  let html='';
  if(_dimBz) html+='<div class="hint" style="margin:0 0 6px;color:var(--warn);line-height:1.5">'
    +'<b>Bauzustand:</b> dimensioniert mit γ_G,red = '+_dimGred.toFixed(2)+' statt '+_dimGfull.toFixed(2)
    +' (SIA 267 Ziff. 5.4.3.6). <b>Nicht für den Endzustand verwenden</b> — dafür die Option in den '
    +'Einstellungen ausschalten und neu rechnen.</div>';
  else if(_bzGredBlocked()) html+='<div class="hint" style="margin:0 0 6px;color:var(--fail);line-height:1.5">'
    +'γ_G,red ist eingeschaltet, greift hier aber nicht: Spezialfundament (nur Standard-Blockfundament '
    +'ist typengeprüft). Dimensioniert mit vollem γ_G,sup.</div>';

  if(CALC_MODEL==='block'){
    // ── BLOCK: B×L fest auf dem Limit — bemessen wird NUR die Blocktiefe H (Nutzerwunsch Jul 2026)
    if(blLim < Math.max(Bk_, Lk_)-1e-9){
      out.innerHTML='<div class="hint">B×L-Limit ('+fmt(blLim)+' m) ist kleiner als der Fundamentkopf ('+fmt(Math.max(Bk_,Lk_))+' m) — Limit erhöhen.</div>';
      return;
    }
    const calcH=H=>{
      const Hs=snap(H);
      si('g_bx',String(blLim)); si('g_by',String(blLim)); si('g_hblock',String(Hs));   // DOM setzen → C₁ live
      const r=_doCalculate({ ...base, c1_auto_eff:c1For(),
        raw:{ ...base.raw, g_bx:String(blLim), g_by:String(blLim), g_hblock:String(Hs) }, _pure:true });
      return { H:Hs, eta:_dimEtaMin(r), gov:_dimGovName(r) };
    };
    // Aktuell = echte eingegebene Geometrie (unverändert)
    const cur=_doCalculate({ ...base, _pure:true });
    const curEta=_dimEtaMin(cur), curGov=_dimGovName(cur);
    const B0=+base.raw.g_bx||0, L0=+base.raw.g_by||0, H0=+base.raw.g_hblock||0;
    // Tiefen-Scan: kleinstes H mit η ≥ 1.0
    const Hmin=0.8, Hmax=4.5;
    let found=null, below=null;
    for(let H=Hmin; H<=Hmax+1e-9; H+=step){
      const c=calcH(H);
      if(c.eta>=1.0){ found=c; break; }
      below=c;
    }
    html+=row('M_res,k (MG+MW)', MresK.toFixed(1)+' kNm → B×L '+fmt(blLim)+' m'+(_dimBLManual?' (Hand)':' (Staffel)'),
              'var(--on2)');
    if(!stf && !_dimBLManual)
      html+='<div class="hint" style="margin:2px 0 4px;color:var(--fail)">M_res,k über der Staffel (230 kNm) — B×L 1.40 angesetzt, ggf. von Hand erhöhen.</div>';
    html+=row('Aktuell  '+fmt(B0)+'×'+fmt(L0)+' m · H '+fmt(H0)+' m', 'η = '+fe(curEta)+' ('+curGov+')',
              etaCol(curEta));
    if(found){
      const above=calcH(found.H+step);
      html+=row('Vorschlag '+fmt(blLim)+'×'+fmt(blLim)+' m · H '+fmt(found.H)+' m', 'η = '+fe(found.eta)+' ('+found.gov+')','var(--ok)');
      if(below) html+=row('Sensitivität H −0.05 m ('+fmt(below.H)+')','η = '+fe(below.eta),'var(--fail)');
      html+=row('Sensitivität H +0.05 m ('+fmt(above.H)+')','η = '+fe(above.eta),'var(--ok)');
      html+=`<button class="btn btn-tonal btn-full btn-sm" style="margin-top:6px" onclick="_dimApply(${blLim},${blLim},${found.H})">Übernehmen (${fmt(blLim)} × ${fmt(blLim)} · H ${fmt(found.H)} m)</button>`;
      html+='<div class="hint" style="margin-top:4px">C₁ wird je Suchschritt live nachgeführt (folgt der Blocktiefe t = H + ü). Vorher galt der C₁ der Eingangsgeometrie für den ganzen Sweep — je nach Startwert zu gross oder zu klein, bei grosser Startgeometrie <b>unkonservativ</b>.</div>';
    } else {
      html+='<div class="hint" style="margin-top:4px">Keine Lösung bis H = '+fmt(Hmax)+' m bei B×L = '+fmt(blLim)+' m — Limit erhöhen oder Boden/Lasten prüfen.</div>';
    }
    _dimRestore();               // Suchgeometrie zurücknehmen (die Felder waren nur Rechenvehikel)
    out.innerHTML=html;
    return;
  }

  // ── FLACH: kleinste B×L (Seitenverhältnis fest, H fest) — begrenzt auf das Limit
  const B0=+base.raw.g_bx||1, L0=+base.raw.g_by||1;
  const ratio=(B0>0.01)?Math.max(0.2,Math.min(5,L0/B0)):1;
  const Bmax=blLim;
  const Bmin=Math.max(0.5, Math.ceil(Math.max(Bk_, Lk_/ratio)/step)*step || 0.5);
  const calc=B=>{
    const Bs=snap(B), Ls=snap(B*ratio);
    const r=_doCalculate({ ...base, raw:{ ...base.raw, g_bx:String(Bs), g_by:String(Ls) }, _pure:true });
    return { B:Bs, L:Ls, eta:_dimEtaMin(r), gov:_dimGovName(r) };
  };
  const cur=calc(B0);
  let found=null, below=null;
  for(let B=Bmin; B<=Bmax+1e-9; B+=step){
    const c=calc(B);
    if(c.eta>=1.0){ found=c; break; }
    below=c;
  }
  html+=row('Aktuell  B×L '+fmt(cur.B)+'×'+fmt(cur.L)+' m', 'η = '+fe(cur.eta)+' ('+cur.gov+')',
            etaCol(cur.eta));
  if(found){
    const above=calc(found.B+step);
    html+=row('Vorschlag B×L '+fmt(found.B)+'×'+fmt(found.L)+' m', 'η = '+fe(found.eta)+' ('+found.gov+')','var(--ok)');
    if(below) html+=row('Sensitivität −0.05 m ('+fmt(below.B)+'×'+fmt(below.L)+')','η = '+fe(below.eta),'var(--fail)');
    html+=row('Sensitivität +0.05 m ('+fmt(above.B)+'×'+fmt(above.L)+')','η = '+fe(above.eta),'var(--ok)');
    html+=`<button class="btn btn-tonal btn-full btn-sm" style="margin-top:6px" onclick="_dimApply(${found.B},${found.L})">Übernehmen (${fmt(found.B)} × ${fmt(found.L)} m)</button>`;
    html+='<div class="hint" style="margin-top:4px">Nach Übernehmen rechnet die App exakt (C₁ live) — massgebende Ampel prüfen.</div>';
  } else {
    html+='<div class="hint" style="margin-top:4px">Keine Lösung mit B×L ≤ '+fmt(Bmax)+' m — Limit erhöhen (Feld oben) oder Blockfundament wählen.</div>';
  }
  out.innerHTML=html;
}
function _dimApply(B,L,H){
  const set=(id,v)=>{ si(id, v.toFixed(2)); const r=document.getElementById(id+'_r'); if(r) r.value=v; };
  set('g_bx',B); set('g_by',L);
  if(H!==undefined) set('g_hblock',H);
  calculate();
  if(typeof formatMeterInputs==='function') formatMeterInputs();
  toast('Geometrie übernommen: '+B.toFixed(2)+' × '+L.toFixed(2)+(H!==undefined?' · H '+H.toFixed(2):'')+' m');
}
