// BlockCalc — js/fundamentliste.js
// Auswertung des aktuellen Fundaments, Fundamentliste
// Bewertet den AKTUELL im UI stehenden Zustand (Abmessung + η). Von _fundEval (Fundamentliste)
// und vom Embed-Modus (Ergebnisrückgabe an die Host-App) gemeinsam genutzt.
function _evalCurrent(){
  const model=CALC_MODEL;
  let dims='—', etaT=null, etaG=null, gov='–', geom=null, lf=null;
  try{ ({dims, geom, etaT, etaG, gov, lf} = curModel().auswerten()); }
  catch(_){ /* Ergebnis bleibt leer → in der Tabelle als „–" */ }
  const es=[etaT,etaG].filter(v=>v!=null&&isFinite(v));
  const etaMin = es.length?Math.min(...es):null;
  return { model, dims, geom, gov, lf, etaT, etaG, etaMin, ok: etaMin!=null && _etaOk(etaMin) };
}
// Fundamentliste des gewählten Projekts als PDF: Abmessungen + Erfüllungsgrade (η) in Tabellenform.
function exportFundamentliste(){
  const curName=((document.getElementById('proj-sel')||{}).value||(gi('p_name')||'')).trim();
  let entries=dbKeys().filter(k=>k.startsWith('proj_')).map(k=>({k,p:dbGet(k)})).filter(e=>e.p);
  if(curName) entries=entries.filter(e=>(e.p.p_name||'')===curName);
  if(!entries.length){ toast(curName?('Projekt «'+curName+'» hat keine gespeicherten Fundamente'):'Kein Projekt gewählt — zuerst speichern/laden'); return; }
  entries.sort((a,b)=>(a.p.p_fundname||'').localeCompare(b.p.p_fundname||'','de',{numeric:true}));
  // Aktuellen Zustand sichern, jedes Fundament rechnen, danach restaurieren
  const backup=collectState();
  const rows=[];
  try{ entries.forEach(({p})=>rows.push({p, e:_fundEval(p)})); }
  finally{ applyState(backup); calculate(); }
  // PDF (feste Druckfarben)
  const now=new Date().toLocaleDateString('de-CH');
  const modelLbl={block:'Block (Steckner)',flach:'Flach (Hansen)',pfahlbock:'Pfahlfundament'};
  const etaTxt=v=> (v==null||!isFinite(v)) ? '<span style="color:#999">–</span>'
    : '<span style="color:'+(v>=1?'#2f9e54':'#a02020')+';font-weight:600">'+v.toFixed(2)+'</span>';
  const nOk=rows.filter(r=>r.e.ok).length;
  const trs=rows.map(({p,e})=>`<tr>
      <td>${esc(p.p_fundname||'–')}</td><td>${esc(p.p_km||'')}</td><td>${esc(p.p_mastnr||'')}</td>
      <td>${modelLbl[e.model]||e.model||'–'}</td><td>${e.dims}</td>
      <td style="text-align:right">${etaTxt(e.etaT)}</td>
      <td style="text-align:right">${etaTxt(e.etaG)}</td>
      <td style="text-align:right">${etaTxt(e.etaMin)}</td>
      <td style="text-align:center;color:${e.ok?'#2f9e54':'#a02020'};font-weight:600">${e.ok?'erfüllt':'nicht erfüllt'}</td>
    </tr>`).join('');
  const w=window.open('','_blank');
  if(!w){ toast('Popup blockiert — Druckfenster zulassen'); return; }
  w.document.write(`<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Fundamentliste — BlockCalc</title>
    <style>
      body{ font-family:'DM Mono',ui-monospace,monospace; color:#111; margin:26px 30px; }
      .hd{ display:flex; justify-content:space-between; align-items:baseline; border-bottom:2px solid #111; padding-bottom:8px; margin-bottom:6px; }
      .hd .t{ font-size:16px; font-weight:600; }
      .meta{ font-size:10px; color:#555; margin-bottom:16px; line-height:1.7; }
      table{ border-collapse:collapse; width:100%; font-size:9.5px; }
      th,td{ padding:4px 8px; text-align:left; border-bottom:1px solid #ddd; vertical-align:top; }
      th{ font-size:8px; letter-spacing:0.06em; text-transform:uppercase; color:#888; border-bottom:1.5px solid #333; white-space:nowrap; }
      tfoot td{ border-bottom:none; border-top:1.5px solid #333; font-size:9px; color:#555; padding-top:8px; }
      .note{ font-size:8px; color:#888; margin-top:12px; line-height:1.6; }
      @media print { body{ margin:10mm; } }
    </style></head><body>
    <div class="hd"><span class="t">Fundamentliste — Dimensionierung</span>
      <span style="font-size:11px">${esc(SETTINGS.firma||'BlockCalc')}</span></div>
    <div class="meta">Projekt: ${curName||'(alle)'} · ${rows.length} Fundament${rows.length!==1?'e':''} · ${nOk}/${rows.length} erfüllt ·
      Bearbeiter: ${(gi('p_bearbeiter')||SETTINGS.bearbeiter||'–')} · ${now} · SIA 267</div>
    <table>
      <thead><tr>
        <th>Fundament</th><th>KM</th><th>Mast-Nr.</th><th>Modell</th><th>Abmessung (B×L×H)</th>
        <th style="text-align:right">η Tragsicherheit</th><th style="text-align:right">η Gebrauch</th>
        <th style="text-align:right">η min</th><th style="text-align:center">Status</th>
      </tr></thead>
      <tbody>${trs}</tbody>
      <tfoot><tr><td colspan="9">η Tragsicherheit = massgebender GZT-Nachweis (Block: Steckner Standsicherheit · Flach: min Grundbruch/Gleiten/Kippen · Pfahl: min Mantelreibung/Stahl/Knicken) · η Gebrauch = GZG (Block/Pfahl Schiefstellung; Flach: entfällt) · η ≥ 1.0 = erfüllt.</td></tr></tfoot>
    </table>
    <div class="note">Werte aus der aktuell gespeicherten Geometrie, Baugrund und Einwirkung je Fundament (SIA 267). Massgebende Lastfallkombination je Nachweis. Für die vollständige Herleitung je Fundament den Nachweisbericht öffnen.</div>
    <script>window.onload=function(){ setTimeout(function(){ window.print(); }, 200); };<\/script>
    </body></html>`);
  w.document.close();
}

// ════════════════════════════════════════════
