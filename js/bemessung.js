// BlockCalc — js/bemessung.js
// Bemessungsdiagramm je Lastniveau
// ── Bemessungsdiagramm (Nutzerwunsch Jul 2026): erforderliche B×L je STANDARDLAST
// (Lastniveau = Masttyp, Einwirkungen konstant), Kurvenschar H_Block, zwei wählbare
// Böschungsneigungen (β₁ durchgezogen, β₂ gestrichelt). Je Punkt werden Lasten/H/β
// temporär in die Felder geschrieben → collectCalcInputs (C₁-Blend wie die App) →
// B-Scan über den Pure-Kern; danach wird der Originalzustand wiederhergestellt.
const _BEM_FIELDS=['l_NG','l_HGx','l_HGy','l_MGx','l_MGy','l_HWx','l_HWy','l_MWx','l_MWy','g_hblock','g_bx','g_by','bg_beta','bg_btyp'];
let _bemLast=null;   // letztes Diagramm {svg, meta} für Drucken/PDF
function openBemessung(){
  if(!curModel().dimensionierbar){ toast('Bemessungsdiagramm: nur Block-/Flachfundament'); return; }
  const box=document.getElementById('bem-lvls');
  if(!LOAD_LVLS.length){
    box.innerHTML='<div class="hint" style="margin:0">Keine Lastniveaus gespeichert — im Tab «Lasten» unter «Lastniveaus» die Standardlasten der Masttypen hinterlegen.</div>';
  } else {
    // Zeile je Lastniveau: Checkbox + klickbarer Name → klappt die Lastwerte auf
    box.innerHTML=LOAD_LVLS.map((ll,i)=>{
      const mres=Math.hypot((ll.MGx||0)+(ll.MWx||0),(ll.MGy||0)+(ll.MWy||0));
      return `<div>
        <div style="display:flex;align-items:center;gap:7px;font-size:11px;color:var(--on2)">
          <input type="checkbox" class="bem-lvl-cb" data-i="${i}" checked style="accent-color:var(--acc)">
          <span style="cursor:pointer" onclick="const d=document.getElementById('bem-lvl-d${i}');d.style.display=d.style.display==='none'?'':'none'">
            <span style="color:var(--xdim)">▸</span> ${esc(ll.name||('Niveau '+(i+1)))}</span>
        </div>
        <div id="bem-lvl-d${i}" style="display:none;font-family:var(--f-mono);font-size:9.5px;color:var(--dim);padding:2px 0 4px 24px;line-height:1.7">
          N_G ${ll.NG} kN · H_G ${ll.HGx}/${ll.HGy} kN · M_G ${ll.MGx}/${ll.MGy} kNm<br>
          H_W ${ll.HWx}/${ll.HWy} kN · M_W ${ll.MWx}/${ll.MWy} kNm · <span style="color:var(--on2)">M_res,k ${mres.toFixed(1)} kNm</span>
        </div>
      </div>`;
    }).join('');
  }
  // Baugrund-Zusammenfassung + Details
  const gw=gi('bg_gw'), btyp=gi('bg_btyp'), beta=+gi('bg_beta')||0;
  document.getElementById('bem-soil-sum').textContent=
    SCHICHTEN.length+' Schicht'+(SCHICHTEN.length!==1?'en':'')+' · φ′ '+SCHICHTEN.map(s=>s.phi+'°').join('/')
    +' · GW '+(gw?gw+' m':'—')+' · β '+((btyp!=='none'&&Math.abs(beta)>0.1)?beta+'°':'—');
  document.getElementById('bem-soil-body').innerHTML=_bemSoilHTML();
  // Modus + Kurvenwerte vorbelegen (Default: Blocktiefe H mit B×L-Staffelwerten)
  _bemModeUI();
  si('bem-b1','0');
  const bCur=+gi('bg_beta')||0;
  si('bem-b2', (bCur!==0 && gi('bg_btyp')!=='none') ? String(bCur) : '');
  document.getElementById('bem-status').textContent='';
  document.getElementById('bem-chart').innerHTML='';
  _bemLast=null; document.getElementById('bem-pdf').disabled=true;
  // Gespeicherte Berechnung wiederherstellen (Auswahl + Diagramm), falls vorhanden
  _bemRestoreSaved();
  document.getElementById('ov-bemessung').classList.add('open');
}
// Zuletzt berechnetes Bemessungsdiagramm wiederherstellen (persistiert in dbGet('bc_bem_last')):
// Auswahl (Lastniveaus/Modus/Kurven/β) immer, das gerenderte Diagramm nur bei passendem Modell.
function _bemRestoreSaved(){
  let saved=null; try{ saved=dbGet('bc_bem_last'); }catch(_){}
  if(!saved||!saved.ui) return;
  const u=saved.ui;
  const modeSel=document.getElementById('bem-mode');
  if(modeSel && u.mode){ modeSel.value=u.mode; _bemModeUI(); }
  if(u.hs!=null) si('bem-hs', u.hs);
  si('bem-b1', u.b1!=null?u.b1:'0');
  const b2=document.getElementById('bem-b2'); if(b2) b2.value=u.b2||'';
  if(u.maxh!=null) si('bem-maxh', u.maxh);
  if(Array.isArray(u.lvlNames)){
    document.querySelectorAll('.bem-lvl-cb').forEach(cb=>{
      const nm=(LOAD_LVLS[+cb.dataset.i]||{}).name;
      cb.checked = u.lvlNames.includes(nm);
    });
  }
  // Diagramm nur zeigen, wenn es zum aktuellen Modell passt (SVG/Tabelle sind modellspezifisch)
  if(saved.result && saved.model===CALC_MODEL){
    _bemLast=saved.result;
    document.getElementById('bem-chart').innerHTML =
      saved.result.svg + '<div style="margin-top:12px;overflow-x:auto">'+(saved.result.table||'')+'</div>';
    document.getElementById('bem-pdf').disabled=false;
    const d=saved.ts?new Date(saved.ts).toLocaleDateString('de-CH'):'';
    document.getElementById('bem-status').innerHTML='<span style="color:var(--xdim)">Gespeichertes Diagramm'
      +(d?' · '+d:'')+' — bei geänderten Lasten/Baugrund neu berechnen.</span>';
  }
}
// Modus-Umschaltung y-Achse: H (Kurven = B×L, Staffelwerte) oder B (Kurven = H_Block)
function _bemModeUI(){
  const mode=(document.getElementById('bem-mode')||{}).value||'H';
  const lbl=document.getElementById('bem-hs-label');
  // max. Blockhöhe nur im H-Modus relevant (dort ist H die Suchgrösse)
  const mh=document.getElementById('bem-maxh'), mhl=document.getElementById('bem-maxh-label');
  if(mh){ const on=mode==='H'; mh.disabled=!on; mh.style.opacity=on?'':'0.4'; if(mhl) mhl.style.opacity=on?'':'0.4'; }
  if(mode==='H'){
    if(lbl) lbl.textContent='B×L-Werte [m, kommagetrennt]';
    si('bem-hs', _DIM_BL_STAFFEL.map(([,b])=>b.toFixed(2)).join(', '));
  } else {
    if(lbl) lbl.textContent='H_Block-Werte [m, kommagetrennt]';
    const H0=+gi('g_hblock')||2.2;
    si('bem-hs',[Math.max(0.8,H0-0.5),H0,H0+0.5,H0+1.0].map(v=>v.toFixed(1)).join(', '));
  }
}
// Baugrund-Detailtabelle fürs Overlay + den Druckkopf
function _bemSoilHTML(){
  const th='padding:3px 8px;text-align:left;font-size:8px;letter-spacing:0.06em;text-transform:uppercase;color:var(--xdim);border-bottom:1px solid var(--ol);white-space:nowrap';
  const td='padding:3px 8px;color:var(--on2)';
  const rows=SCHICHTEN.map((s,i)=>`<tr>
    <td style="${td}">${i+1}</td><td style="${td}">${esc(s.name||'—')}</td>
    <td style="${td}">${s.d===999?'∞':s.d}</td><td style="${td}">${s.phi}</td>
    <td style="${td}">${s.c}</td><td style="${td}">${s.gamma} / ${s.gamma2}</td>
    <td style="${td}">${s.me??'—'}</td></tr>`).join('');
  const gw=gi('bg_gw'), btyp=gi('bg_btyp'), beta=+gi('bg_beta')||0, bh=gi('bg_bhoehe');
  return `<table style="border-collapse:collapse;font-family:var(--f-mono);font-size:9.5px;width:100%">
    <thead><tr><th style="${th}">Nr</th><th style="${th}">Schicht</th><th style="${th}">d [m]</th>
      <th style="${th}">φ′ [°]</th><th style="${th}">c′ [kPa]</th><th style="${th}">γ/γ′ [kN/m³]</th>
      <th style="${th}">M_E [MN/m²]</th></tr></thead><tbody>${rows}</tbody></table>
    <div style="font-family:var(--f-mono);font-size:9.5px;color:var(--dim);margin-top:6px">
      Grundwasser: ${gw?gw+' m u. GOK':'keines'} · Gelände: ${(btyp!=='none'&&Math.abs(beta)>0.1)?(btyp+' β = '+beta+'° · h_β = '+(bh||'—')+' m'):'eben'}
      · γ_φ ${gi('tw_phi')} · γ_c ${gi('tw_c')} · γ_Ep ${gi('tw_Ep')}</div>`;
}
async function runBemessung(){
  const status=document.getElementById('bem-status'), chart=document.getElementById('bem-chart');
  const mode=(document.getElementById('bem-mode')||{}).value||'H';   // 'H' = Blocktiefe (Kurven B×L) · 'B' = Seitenlänge (Kurven H)
  const lvls=[...document.querySelectorAll('.bem-lvl-cb:checked')].map(cb=>LOAD_LVLS[+cb.dataset.i]).filter(Boolean);
  if(!lvls.length){ status.textContent='Mindestens ein Lastniveau auswählen.'; return; }
  const curveVals=(gi('bem-hs')||'').split(',').map(s=>+s.trim()).filter(v=>isFinite(v)&&v>0.3).slice(0,5);
  if(!curveVals.length){ status.textContent='Werte prüfen (kommagetrennt, z. B. '+(mode==='H'?'1.10, 1.20, 1.40':'1.8, 2.2, 2.7')+').'; return; }
  const b1=+gi('bem-b1')||0;
  const b2raw=(document.getElementById('bem-b2').value||'').trim();
  const betas=[b1]; if(b2raw!=='' && isFinite(+b2raw) && +b2raw!==b1) betas.push(+b2raw);
  // Lastniveaus nach resultierendem Moment sortieren (x-Achse aufsteigend)
  const mRes=ll=>Math.hypot((ll.MGx||0)+(ll.MWx||0),(ll.MGy||0)+(ll.MWy||0));
  lvls.sort((a,b)=>mRes(a)-mRes(b));
  // Originalzustand sichern
  const bak={}; _BEM_FIELDS.forEach(id=>bak[id]=gi(id));
  const btn=document.getElementById('bem-run'); btn.disabled=true;
  const step=0.05, Bmax=3.6, Hmin=0.8;
  const Hmax=Math.max(1.0, +gi('bem-maxh')||3.5);   // Obergrenze H-Suche (Feld „max. Blockhöhe")
  const ratio=(()=>{ const B0=+gi('g_bx')||1, L0=+gi('g_by')||1; return B0>0.01?Math.max(0.2,Math.min(5,L0/B0)):1; })();
  const Bk_=+gi('g_kx')||0, Lk_=+gi('g_ky')||0;
  const ue_=+gi('g_uberd')||0, hkopf_=+gi('g_hkopf')||0;   // Kopfhöhe gesamt → Betonkubatur
  // Betonkubatur [m³] = Fundamentkörper (B·L·H) + Kopf (Bk·Lk·(ü+H_Kopf)) — wie der Beton-Anteil von Gk
  const betonVol=(Bv,Lv,Hv)=> Bv*Lv*Hv + Bk_*Lk_*hkopf_;   // H_Kopf = Gesamthöhe des Kopfes
  const BminG=Math.max(0.5, Math.ceil(Math.max(Bk_, Lk_/ratio)/step)*step||0.5);
  const snap=v=>+(Math.round(v/step)*step).toFixed(2);
  const setLoads=ll=>{ si('l_NG',ll.NG); si('l_HGx',ll.HGx); si('l_HGy',ll.HGy);
    si('l_MGx',ll.MGx); si('l_MGy',ll.MGy);
    si('l_HWx',ll.HWx); si('l_HWy',ll.HWy); si('l_MWx',ll.MWx); si('l_MWy',ll.MWy); };
  // Live-C₁ je Sweep-Schritt: c1AutoValue() liest die (soeben gesetzte) Suchgeometrie aus dem DOM →
  // C₁ folgt der Blocktiefe/Seitenlänge exakt (kein Freeze mehr). Manueller C₁ bleibt konstant (Feldwert).
  const liveC1=fb=>{ try{ return c1AutoValue().c1_eff; }catch(_){ return fb; } };
  try{
    const series=[];   // {label, beta, pts:[{name, val|null}]}
    let done=0, total=betas.length*curveVals.length;
    for(const beta of betas){
      for(const cv of curveVals){
        status.textContent='Berechne Balken '+(++done)+' / '+total+'  ('+(mode==='H'?'B×L = '+cv.toFixed(2):'H = '+cv.toFixed(2))+' m, β = '+beta+'°)…';
        await new Promise(r=>setTimeout(r,10));   // UI-Repaint zwischen Kurven
        // Kurven-Zustand in die Felder schreiben (C₁/Kombis exakt wie die App)
        si('bg_beta',String(beta));
        const bt=document.getElementById('bg_btyp'); if(bt) bt.value = Math.abs(beta)>0.1?'boeschung':'none';
        if(mode==='H'){ si('g_bx',String(cv)); si('g_by',String(cv)); }
        else          { si('g_hblock',String(cv)); }
        const pts=[]; let start=(mode==='H')?Hmin:BminG;
        for(const ll of lvls){
          setLoads(ll);
          const base=collectCalcInputs();
          let found=null, foundR=null;   // foundR = Result am Treffer → massgebender Nachweis
          if(mode==='H'){
            // y = kleinste Blocktiefe H bei festem B×L=cv
            if(cv < Math.max(Bk_,Lk_)-1e-9){ found=null; }   // Kopf passt nicht in dieses B×L
            else for(let H=start; H<=Hmax+1e-9; H+=step){
              const Hs=snap(H);
              si('g_hblock',String(Hs));                                  // DOM setzen → C₁ live (t = H+ü)
              const c1e = base.c1_manual ? base.c1_auto_eff : liveC1(base.c1_auto_eff);
              const r=_doCalculate({ ...base, c1_auto_eff:c1e, raw:{ ...base.raw, g_hblock:String(Hs) }, _pure:true });
              if(r && _dimEtaMin(r)>=1.0){ found=Hs; foundR=r; break; }
            }
          } else {
            // y = kleinste Seitenlänge B bei festem H=cv
            for(let B=start; B<=Bmax+1e-9; B+=step){
              const Bs=snap(B), Ls=snap(B*ratio);
              si('g_bx',String(Bs)); si('g_by',String(Ls));              // DOM setzen → C₁ live (B-abhängig)
              const c1e = base.c1_manual ? base.c1_auto_eff : liveC1(base.c1_auto_eff);
              const r=_doCalculate({ ...base, c1_auto_eff:c1e, raw:{ ...base.raw, g_bx:String(Bs), g_by:String(Ls) }, _pure:true });
              if(r && _dimEtaMin(r)>=1.0){ found=Bs; foundR=r; break; }
            }
          }
          // Betonkubatur am Treffer (Wirtschaftlichkeits-Richtwert)
          let vol=null;
          if(found!=null){
            const Bv = mode==='H' ? cv : found;
            const Lv = mode==='H' ? cv : snap(found*ratio);
            const Hv = mode==='H' ? found : cv;
            vol = betonVol(Bv, Lv, Hv);
          }
          pts.push({ name:ll.name||'?', val:found, gov: foundR?_dimGovName(foundR):null, vol });
          if(found!=null) start=Math.max((mode==='H')?Hmin:BminG, found-2*step);   // monoton in der Lastfolge
        }
        series.push({ label:(mode==='H'?'B×L '+cv.toFixed(2):'H '+cv.toFixed(2)), beta, cv, pts });
      }
    }
    const meta={ mode, ratio, betas,
      mres: lvls.map(ll=>mRes(ll)),   // M_res,k je Lastniveau (ständig+veränderlich) für die Achsenbeschriftung
      ylabel: mode==='H' ? 'H erforderlich [m]' : 'B erforderlich [m]',
      ymissing: mode==='H' ? 'H = '+Hmax.toFixed(1) : 'B = '+Bmax.toFixed(1),
      title: mode==='H'
        ? 'erforderliche Blocktiefe H (B×L fest) · η ≥ 1.0'
        : 'erforderliche Abmessung B (L = '+ratio.toFixed(2)+'·B) · η ≥ 1.0' };
    const svg=buildBemessungSVG(series, lvls.map(l=>l.name||'?'), meta);
    const table=_bemTableHTML(series, lvls, meta);
    chart.innerHTML=svg+'<div style="margin-top:12px;overflow-x:auto">'+table+'</div>';
    _bemLast={ svg, table, meta, soil:_bemSoilHTML(), grid:{ mode:meta.mode, ratio:meta.ratio, series, lvls } };
    document.getElementById('bem-pdf').disabled=false;
    // Berechnung persistieren → beim nächsten Öffnen sofort da (keine erneute Auswahl/Klick nötig)
    try{ dbSet('bc_bem_last', { model:CALC_MODEL, ts:Date.now(), result:_bemLast,
      ui:{ lvlNames:lvls.map(l=>l.name||''), mode, hs:gi('bem-hs'),
           b1:gi('bem-b1'), b2:(document.getElementById('bem-b2').value||''), maxh:gi('bem-maxh') } }); }catch(_){}
    status.textContent='';
  } catch(e){
    status.textContent='Diagramm fehlgeschlagen: '+(e&&e.message||e);
  } finally {
    // Originalzustand wiederherstellen
    _BEM_FIELDS.forEach(id=>{ si(id,bak[id]); const r=document.getElementById(id+'_r'); if(r) r.value=bak[id]; });
    btn.disabled=false;
    calculate();
  }
}
// Kürzel des massgebenden Nachweises (für die Wertetabelle)
function _bemGovAbbr(g){ return ({'GZT Standsicherheit':'GZT','GZG Schiefstellung':'GZG',
  'Grundbruch':'GB','Gleiten':'GL','Kippen':'Ki','Sohlspannung':'σ','Gebrauchstauglichkeit':'GZG'})[g]||'–'; }
// Wertetabelle: Lastniveau × Kurve → erf. Abmessung + massgebender Nachweis (ablesesicher, auch fürs PDF)
function _bemTableHTML(series, lvls, meta){
  const betas=meta.betas;
  const mRes=ll=>Math.hypot((ll.MGx||0)+(ll.MWx||0),(ll.MGy||0)+(ll.MWy||0));
  const nB=Math.max(1,betas.length), nC=Math.max(1, Math.round(series.length/nB));
  const th='padding:3px 9px 3px 0;border-bottom:1px solid var(--ol);color:var(--xdim);font-weight:500;font-size:8.5px;letter-spacing:.04em;text-transform:uppercase';
  const DIV='border-left:0.5px solid var(--ol2)';                     // dezente Trennlinie zwischen den Böschungsfällen (Gruppenkopf + Einrückung trennen zusätzlich)
  const grpStart=si=>nB>1 && si>0 && (si%nC===0);                     // erste Spalte einer neuen β-Gruppe
  let h='<style>#bem-chart .bem-cell:hover{outline:1.5px solid var(--acc);outline-offset:-1.5px}</style>'
    +'<table style="border-collapse:collapse;font-size:10px;font-family:var(--f-mono)"><thead>';
  // Gruppenkopf: je Böschung ein zusammengefasster Titel (nur bei >1 Böschung)
  if(nB>1){
    h+='<tr><th style="'+th+'"></th><th style="'+th+'"></th>';
    betas.forEach((b,bi)=>{ h+='<th colspan="'+nC+'" style="text-align:center;'+th+(bi>0?';'+DIV+';padding-left:16px':'')+'">Böschung β = '+b+'°</th>'; });
    h+='</tr>';
  }
  // Einzelkopf (Balken-Wert je Spalte)
  h+='<tr><th style="text-align:left;'+th+'">Lastniveau</th><th style="text-align:right;'+th+'">M_res,k [kNm]</th>';
  series.forEach((sr,si)=>{ h+='<th style="text-align:right;'+th+(grpStart(si)?';'+DIV+';padding-left:16px':'')+'">'+sr.label+'</th>'; });
  h+='</tr></thead><tbody>';
  lvls.forEach((ll,i)=>{
    h+='<tr><td style="padding:3px 9px 3px 0;color:var(--on2)">'+(ll.name||'?')+'</td>'
      +'<td style="text-align:right;padding:3px 9px;color:var(--dim)">'+mRes(ll).toFixed(0)+'</td>';
    series.forEach((sr,sIdx)=>{ const p=sr.pts[i], gs=grpStart(sIdx);
      const clickable=!!(p&&p.val!=null);
      const cell= clickable
        ? p.val.toFixed(2)+' <span style="color:var(--xdim)">('+_bemGovAbbr(p.gov)+')</span>'
          +(p.vol!=null?'<div style="color:var(--dim);font-size:8.5px">'+p.vol.toFixed(1)+' m³</div>':'')
        : '<span style="color:var(--fail)">—</span>';
      h+='<td '+(clickable?'class="bem-cell" onclick="_bemApplyCell('+sIdx+','+i+')" title="Abmessung ins Modell übernehmen"':'')
        +' style="text-align:right;padding:3px 9px'+(gs?';padding-left:16px;'+DIV:'')+';color:var(--on);vertical-align:top'+(clickable?';cursor:pointer':'')+'">'+cell+'</td>'; });
    h+='</tr>';
  });
  h+='</tbody></table>'
    +'<div style="font-size:8.5px;color:var(--xdim);margin-top:5px;line-height:1.6">Werte = erforderliche '
    +(meta.mode==='H'?'Blocktiefe H':'Seitenlänge B')+' [m] (η ≥ 1.0) · Kürzel = massgebender Nachweis: '
    +(CALC_MODEL==='block'?'GZT Standsicherheit · GZG Schiefstellung':'GB Grundbruch · GL Gleiten · Ki Kippen · σ Sohlspannung · GZG Gebrauchstauglichkeit')
    +' · <b>m³ = Betonkubatur</b> (Fundamentkörper + Kopf, Wirtschaftlichkeits-Richtwert) · <b>Zelle anklicken → Abmessung ins Modell übernehmen</b> · — keine Lösung im Suchbereich</div>';
  return h;
}
// Zelle der Bemessungstabelle ins Modell übernehmen: NUR die Abmessung (Lasten/Böschung bleiben,
// die sind je Standort/Masttyp vordefiniert). Klick öffnet ein Bestätigungs-Modal (statt sofort zu setzen).
let _bemPendingApply=null;
function _bemApplyCell(sIdx, lIdx){
  const g=_bemLast&&_bemLast.grid; if(!g) return;
  const sr=g.series[sIdx], p=sr&&sr.pts[lIdx];
  if(!sr||!p||p.val==null) return;
  // Abmessung: H-Modus → B×L fest (cv), H = gefunden · B-Modus → B = gefunden, L = B·ratio, H fest (cv)
  let B,L,H;
  if(g.mode==='H'){ B=sr.cv; L=sr.cv; H=p.val; }
  else           { B=p.val; L=+(p.val*g.ratio).toFixed(2); H=sr.cv; }
  _bemPendingApply={ B, L, H, vol:p.vol, lvlName:p.name||'?', gov:p.gov, beta:sr.beta };
  const row=(k,v)=>`<div style="display:flex;justify-content:space-between;gap:18px"><span style="color:var(--dim)">${k}</span><span style="color:var(--on)">${v}</span></div>`;
  document.getElementById('bem-apply-body').innerHTML=
    row('Lastniveau', p.name||'?')
    + row('B × L', B.toFixed(2)+' × '+L.toFixed(2)+' m')
    + row('H_Block', H.toFixed(2)+' m')
    + (p.vol!=null?row('Betonkubatur', p.vol.toFixed(1)+' m³'):'')
    + (p.gov?row('massgebend', p.gov):'')
    + (sr.beta?row('Böschung', 'β = '+sr.beta+'°'):'');
  document.getElementById('ov-bem-apply').classList.add('open');
}
function _bemConfirmApply(){
  const a=_bemPendingApply; if(!a){ closeOverlay('ov-bem-apply'); return; }
  const setF=(id,v)=>{ si(id,String(v)); const r=document.getElementById(id+'_r'); if(r) r.value=v; };
  setF('g_bx',a.B); setF('g_by',a.L); setF('g_hblock',a.H);
  closeOverlay('ov-bem-apply'); closeOverlay('ov-bemessung');
  calculate();
  toast('Abmessung übernommen — B×L '+a.B.toFixed(2)+'×'+a.L.toFixed(2)+' m · H '+a.H.toFixed(2)+' m'
    +(a.vol!=null?' · '+a.vol.toFixed(1)+' m³':''));
  _bemPendingApply=null;
}
// Gruppiertes Balkendiagramm (Jul 2026): x = Lastniveau (kategorial, diskrete Masttypen — KEINE
// Verbindungslinie, die eine unsinnige Interpolation suggeriert), pro Gruppe ein Balken je Kurve
// (B×L bzw. H_Block). β₁ = voll gefüllt, β₂ = hohl (nur Umriss). Balken anklickbar → Übernahme-Modal.
function buildBemessungSVG(series, names, meta){
  const n=names.length, betas=meta.betas, m=series.length;
  const VB=760, HB=452, padL=64, padR=138, padT=40, padB=118;
  const pw=VB-padL-padR, phh=HB-padT-padB;
  // Balken ab 0 (ehrliche Balkendarstellung)
  let hi=-Infinity;
  series.forEach(s=>s.pts.forEach(p=>{ if(p.val!=null) hi=Math.max(hi,p.val); }));
  if(!isFinite(hi)) hi=2.0;
  const lo=0; hi=Math.ceil((hi+0.15)/0.5)*0.5;
  const Y=v=>padT + phh*(1-(v-lo)/(hi-lo));
  const cols=['var(--acc)','var(--on2)','var(--dim)','var(--warn)','var(--xdim)'];
  const labels=[...new Set(series.map(sr=>sr.label))];
  const colOf=sr=>cols[labels.indexOf(sr.label)%cols.length];
  const slot=pw/Math.max(1,n), groupW=Math.min(slot*0.76, m*30), bw=groupW/Math.max(1,m);
  const gx=i=>padL + slot*(i+0.5);
  const y0=Y(lo);
  let s=`<svg viewBox="0 0 ${VB} ${HB}" width="100%" style="display:block;background:var(--s2);border:1px solid var(--ol);border-radius:6px">
    <style>.bem-bar:hover rect{stroke:var(--acc);stroke-width:2.2}</style>
    <text x="14" y="20" font-family="var(--f-mono)" font-size="10" letter-spacing=".06em" fill="var(--dim)">BEMESSUNGSDIAGRAMM — ${meta.title}</text>`;
  // y-Gitter + Achse
  for(let v=lo; v<=hi+1e-9; v+=0.5){
    const y=Y(v);
    s+=`<line x1="${padL}" y1="${y.toFixed(1)}" x2="${VB-padR}" y2="${y.toFixed(1)}" stroke="var(--ol)" stroke-width="0.6"/>
        <text x="${padL-8}" y="${(y+3).toFixed(1)}" font-family="var(--f-mono)" font-size="8.5" text-anchor="end" fill="var(--dim)">${v.toFixed(2)}</text>`;
  }
  s+=`<line x1="${padL}" y1="${y0.toFixed(1)}" x2="${VB-padR}" y2="${y0.toFixed(1)}" stroke="var(--dim)" stroke-width="1"/>`;
  s+=`<text x="16" y="${(padT+phh/2).toFixed(1)}" font-family="var(--f-mono)" font-size="8.5" fill="var(--dim)" transform="rotate(-90 16 ${(padT+phh/2).toFixed(1)})" text-anchor="middle">${meta.ylabel}</text>`;
  const showVal = m<=4;
  const nB=Math.max(1, betas.length), nC=Math.max(1, Math.round(m/nB));
  const gp=Math.max(5, groupW*0.06);                 // Lücke zwischen den β-Subgruppen
  const subW=(groupW-(nB-1)*gp)/nB, barW=subW/nC;    // Subgruppenbreite / Balkenbreite
  names.forEach((nm,i)=>{
    const cx=gx(i), gLeft=cx-groupW/2;
    for(let bIdx=0;bIdx<nB;bIdx++){
      const subLeft=gLeft+bIdx*(subW+gp);
      for(let cIdx=0;cIdx<nC;cIdx++){
        const sIdx=bIdx*nC+cIdx, sr=series[sIdx]; if(!sr) continue;
        const p=sr.pts[i], col=colOf(sr), solid=(sr.beta===betas[0]);
        const bx=subLeft+cIdx*barW+barW*0.12, bwEff=barW*0.76;
        if(p && p.val!=null){
          const by=Y(p.val), bh=y0-by;
          s+=`<g class="bem-bar" style="cursor:pointer" onclick="_bemApplyCell(${sIdx},${i})"><title>${nm} · ${sr.label}${solid?'':' · β'+sr.beta+'°'} → ${meta.mode==='H'?'H':'B'} ${p.val.toFixed(2)} m — anklicken zum Übernehmen</title>`
            +`<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bwEff.toFixed(1)}" height="${bh.toFixed(1)}" fill="${col}" fill-opacity="${solid?0.9:0.28}" stroke="${col}" stroke-width="${solid?0:1.3}"/></g>`;
          if(showVal) s+=`<text x="${(bx+bwEff/2).toFixed(1)}" y="${(by-3).toFixed(1)}" font-family="var(--f-mono)" font-size="7.5" fill="${col}" text-anchor="middle">${p.val.toFixed(2)}</text>`;
        } else {
          s+=`<text x="${(bx+bwEff/2).toFixed(1)}" y="${(y0-4).toFixed(1)}" font-family="var(--f-mono)" font-size="9" fill="var(--fail)" text-anchor="middle">×</text>`;
        }
      }
      // β-Winkel direkt unter der jeweiligen Subgruppe
      const subCx=subLeft+subW/2;
      s+=`<text x="${subCx.toFixed(1)}" y="${(y0+13).toFixed(1)}" font-family="var(--f-mono)" font-size="7.5" fill="var(--dim)" text-anchor="middle">β=${betas[bIdx]}°</text>`;
    }
    // Lastniveau-Name + Momentsumme M_res,k (ständig+veränderlich) unter der ganzen Gruppe
    const mv=(meta.mres&&meta.mres[i]!=null)?` (M=${Math.round(meta.mres[i])} kNm)`:'';
    const gnm=nm+mv;
    if(n<=6) s+=`<text x="${cx.toFixed(1)}" y="${(y0+28).toFixed(1)}" font-family="var(--f-mono)" font-size="9" fill="var(--on2)" text-anchor="middle">${gnm}</text>`;
    else s+=`<text x="${cx.toFixed(1)}" y="${(y0+26).toFixed(1)}" font-family="var(--f-mono)" font-size="8.5" fill="var(--on2)" text-anchor="end" transform="rotate(-18 ${cx.toFixed(1)} ${(y0+26).toFixed(1)})">${gnm}</text>`;
  });
  // Legende (Kurven-Farben + β) rechts
  let ly=padT+6;
  labels.forEach((lb,k)=>{ const col=cols[k%cols.length];
    s+=`<rect x="${VB-padR+10}" y="${ly}" width="10" height="10" fill="${col}" fill-opacity="0.9"/>
        <text x="${VB-padR+24}" y="${ly+9}" font-family="var(--f-mono)" font-size="8.5" fill="var(--dim)">${lb}</text>`;
    ly+=16; });
  if(betas.length>1){ ly+=4;
    s+=`<rect x="${VB-padR+10}" y="${ly}" width="10" height="10" fill="var(--dim)" fill-opacity="0.9"/><text x="${VB-padR+24}" y="${ly+9}" font-family="var(--f-mono)" font-size="8" fill="var(--dim)">β₁ = ${betas[0]}° (voll)</text>`;
    s+=`<rect x="${VB-padR+10}" y="${ly+16}" width="10" height="10" fill="none" stroke="var(--dim)" stroke-width="1.3"/><text x="${VB-padR+24}" y="${ly+25}" font-family="var(--f-mono)" font-size="8" fill="var(--dim)">β₂ = ${betas[1]}° (hohl)</text>`;
  }
  // Fussnoten
  s+=`<text x="${padL}" y="${(HB-32).toFixed(1)}" font-family="var(--f-mono)" font-size="8" fill="var(--dim)">Balken = erf. ${meta.mode==='H'?'Blocktiefe H (je B×L, fest)':'Seitenlänge B (je H_Block)'} je Lastniveau · <tspan fill="var(--acc)">Balken anklicken → übernehmen</tspan> · × = keine Lösung bis ${meta.ymissing} m</text>
      <text x="${padL}" y="${(HB-20).toFixed(1)}" font-family="var(--f-mono)" font-size="8" fill="var(--xdim)">Lastniveaus sind eigenständige Masttypen (keine Interpolation dazwischen) · Baugrund/Kopf/ü/Teilsicherheiten wie Eingabe · Modell: ${CALC_MODEL==='block'?'Blockfundament (Steckner)':'Flachfundament (Hansen)'} · Raster 0.05 m</text>
      <text x="${padL}" y="${(HB-8).toFixed(1)}" font-family="var(--f-mono)" font-size="8" fill="var(--xdim)">${CALC_MODEL==='block'?'Block-GZG kollabiert modellbedingt ab β ≈ −30° (Steckner Gl.4)':'Globale Böschungsstandsicherheit (Gleitkreis) bei β ≠ 0 separat prüfen'}</text>`;
  return s+'</svg>';
}
// Druck/PDF: eigenes Druckfenster mit Kopf (Firma/Projekt), Baugrund und dem Diagramm.
// CSS-Variablen der App werden für den Druck durch feste Hell-Farben ersetzt.
function printBemessung(){
  if(!_bemLast){ toast('Zuerst Diagramm berechnen'); return; }
  const PRINT_COLORS={ 'var(--acc)':'#4a5cb8', 'var(--on2)':'#33363f', 'var(--on)':'#111319',
    'var(--dim)':'#70727e', 'var(--xdim)':'#9a9ca6', 'var(--warn)':'#d9822b', 'var(--fail)':'#a02020',
    'var(--ok)':'#2f9e54', 'var(--ol)':'#c9c9d4', 'var(--s1)':'#ffffff', 'var(--s2)':'#ffffff',
    'var(--f-mono)':"'DM Mono',ui-monospace,monospace" };
  const fix=html=>{ let h=html; Object.entries(PRINT_COLORS).forEach(([k,v])=>{ h=h.split(k).join(v); }); return h; };
  const st=collectState();
  const now=new Date().toLocaleDateString('de-CH');
  const w=window.open('','_blank');
  if(!w){ toast('Popup blockiert — Druckfenster zulassen'); return; }
  w.document.write(`<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Bemessungsdiagramm — BlockCalc</title>
    <style>
      body{ font-family:'DM Mono',ui-monospace,monospace; color:#111; margin:26px 30px; }
      .hd{ display:flex; justify-content:space-between; align-items:baseline; border-bottom:2px solid #111; padding-bottom:8px; margin-bottom:6px; }
      .hd .t{ font-size:16px; font-weight:600; }
      .meta{ font-size:10px; color:#555; margin-bottom:14px; line-height:1.7; }
      .sh{ font-size:9px; letter-spacing:0.08em; text-transform:uppercase; color:#888; margin:14px 0 4px; }
      table{ border-collapse:collapse; font-size:9.5px; }
      th,td{ padding:3px 10px 3px 0; text-align:left; }
      th{ font-size:8px; letter-spacing:0.06em; text-transform:uppercase; color:#888; border-bottom:1px solid #ccc; }
      svg{ width:100%; max-width:960px; }
      @media print { body{ margin:10mm; } }
    </style></head><body>
    <div class="hd"><span class="t">Bemessungsdiagramm — ${CALC_MODEL==='block'?'Blockfundament (Steckner / SIA 267)':'Flachfundament (SIA 267)'}</span>
      <span style="font-size:11px">${esc(SETTINGS.firma||'BlockCalc')}</span></div>
    <div class="meta">Projekt: ${esc(st.p_name||'–')} · Fundament: ${esc(st.p_fundname||'–')} · Nr. ${esc(st.p_nr||'–')} ·
      Bearbeiter: ${esc(st.p_bearbeiter||SETTINGS.bearbeiter||'–')} · ${now}</div>
    <div class="sh">Baugrund und Parameter</div>
    ${fix(_bemLast.soil)}
    <div class="sh" style="margin-top:16px">Diagramm</div>
    ${fix(_bemLast.svg)}
    <div class="sh" style="margin-top:16px">Erforderliche Abmessungen</div>
    ${fix(_bemLast.table||'')}
    <script>window.onload=function(){ setTimeout(function(){ window.print(); }, 150); };<\/script>
    </body></html>`);
  w.document.close();
}

// Ein Fundament rechnen (für die Fundamentliste): setzt den Zustand, liefert Abmessung + Erfüllungsgrade.
// ACHTUNG: mutiert den Modellzustand — Aufrufer sichert/restauriert via collectState/applyState.
function _fundEval(p){
  applyState(p);
  return _evalCurrent();
}
