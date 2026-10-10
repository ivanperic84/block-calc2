// BlockCalc — js/templates.js
// Projekt-Templates
// TEMPLATES
// ════════════════════════════════════════════

const BUILTIN_TPLS = [
  { id:'stahlplatte_sbb', name:'Stahlplatte', desc:'3.0×1.5×0.09m · φ=27° · Stahl 78.5 kN/m³',
    data:{
      p_name:'Stahlplatte', p_fundname:'SP quer', p_nr:'2024-001', p_km:'', p_mastnr:'',
      p_bearbeiter:'', p_datum:'', p_bemerk:'',
      g_bx:'3', g_by:'1.5', g_hblock:'0.09',
      g_kx:'0', g_ky:'0', g_hkopf:'0',   // Stahlplatte: kein Fundamentkopf
      hkopf_conv:2,                      // H_Kopf bereits als Gesamthöhe hinterlegt (keine Migration)
      g_uberd:'0.10', g_uberd_flach:'0.10', g_ex:'0.0', g_ey:'0.0',
      g_gbeton:'78.5', g_gauf:'20.0', 'flach-material':'stahl',
      bg_phi:'27', bg_c:'0', bg_gamma:'20', bg_gamma2:'10',
      bg_qu:'250', bg_me:'25', bg_c1:'7.8', bg_delta_fac:'0.667',
      bg_gw:'nein', bg_gwt:'3.0', bg_beta:'0', bg_bfuss:'0', bg_bhoehe:'0', bg_btyp:'none',
      tw_G:'1.35', tw_Q:'1.5', tw_phi:'1.20', tw_c:'1.5', tw_Ea:'1.35', tw_Ep:'1.40',
      lw_G:'1.35', lw_G_inf:'0.80', lw_Q:'1.50',
      lw_G1_sup:'1.20', lw_G1_inf:'0.80', lw_Q1:'1.50',
      lw_G_gzg:'1.00', lw_Q_gzg:'1.00',
      l_NG:'7', l_HGx:'0', l_HGy:'0', l_MGx:'0', l_MGy:'0',
      l_HWx:'2', l_HWy:'2', l_MWx:'10', l_MWy:'10',
      MODEL:'flach', FLACH_MAT:'stahl',
      AUFLASTEN:JSON.stringify([
        {Pk:10, dx:1,  dy:0, active:true},
        {Pk:10, dx:-1, dy:0, active:true}
      ]),
      LF:JSON.stringify([
        {name:'LF 1 — Quer zum Gleis', preset:'quer', nw:'beide',
         comp:{NG:true,HGx:true,HGy:false,MGx:false,MGy:true,HWx:true,HWy:false,MWx:false,MWy:true}},
        {name:'LF 2 — Längs zum Gleis', preset:'laengs', nw:'beide',
         comp:{NG:true,HGx:false,HGy:true,MGx:true,MGy:false,HWx:false,HWy:true,MWx:true,MWy:false}}
      ]),
      SCHICHTEN:JSON.stringify([{phi:27,c:0,gamma:20,gamma2:10,d:999,name:'Schicht 1 (ab GOK)',preset:'custom',me:25}])
    }
  },
  { id:'beispiel', name:'Beispiel', desc:'1.0×1.0×1.8m · φ=27° · SIA 267',
    data:{
      p_name:'Beispiel', p_nr:'',
      p_bemerk:'Blockfundament B=1.0m, t=2.2m · Modellboden φ=27° · SIA 267',
      g_bx:'1.0', g_by:'1.0', g_hblock:'1.8', g_uberd:'0.4',
      g_kx:'0.6', g_ky:'0.6', g_hkopf:'1.0', g_ex:'0', g_ey:'0',
      hkopf_conv:2,                      // H_Kopf = Gesamthöhe OK Block → OK Kopf (keine Migration)
      g_gbeton:'25', g_gauf:'20',
      bg_phi:'27', bg_c:'0', bg_gamma:'20', bg_gamma2:'10',
      bg_qu:'400', bg_me:'25', bg_c1:'60', bg_delta_fac:'0.667',
      bg_gw:'nein', bg_gwt:'3.0', bg_beta:'0', bg_bfuss:'0', bg_bhoehe:'0', bg_btyp:'none',
      tw_G:'1.35', tw_Q:'1.50', tw_phi:'1.20', tw_c:'1.50', tw_Ea:'1.35', tw_Ep:'1.40',
      l_NG:'0', l_HGx:'5', l_HGy:'5', l_MGx:'40', l_MGy:'40',
      l_HWx:'5', l_HWy:'5', l_MWx:'40', l_MWy:'40', l_hmast:'0',
      MODEL:'block',
      // Quer UND längs — 0161.1011.0002_a verlangt die Nachweise für die maximalen Lasten
      // beider Richtungen einzeln. Der frühere Satz (GZT quer / GZG quer) prüfte nur quer;
      // bei HP2a ist aber längs massgebend (M_l 230 > M_q 154). nw:'beide' ist korrekt:
      // der GZG nutzt intern immer lw_G_gzg/lw_Q_gzg, lf.nw steuert nur den GZT.
      LF:JSON.stringify([
        {name:'LF 1 — Quer zum Gleis', preset:'quer', gG:1.35, gW:1.5, nw:'beide',
         comp:{NG:true,HGx:true,HGy:false,MGx:false,MGy:true,HWx:true,HWy:false,MWx:false,MWy:true}},
        {name:'LF 2 — Längs zum Gleis', preset:'laengs', gG:1.35, gW:1.5, nw:'beide',
         comp:{NG:true,HGx:false,HGy:true,MGx:true,MGy:false,HWx:false,HWy:true,MWx:true,MWy:false}}
      ]),
      SCHICHTEN:JSON.stringify([{phi:27,c:0,gamma:20.0,gamma2:10.0,d:999,name:'Modellboden',preset:'custom',me:25}])
    }
  }
];

function getCustomTpls(){
  return dbGet('bc_tpls') || [];
}
function saveCustomTpls(arr){
  dbSet('bc_tpls', arr);
}

function renderTemplates(){
  const grid = document.getElementById('tpl-grid');
  grid.innerHTML = '';
  const all = [...BUILTIN_TPLS, ...getCustomTpls()];
  all.forEach(tpl => {
    const d = document.createElement('div');
    d.className = 'tpl-card';
    d.innerHTML = `<div class="tpl-icon" style="font-size:16px;margin-bottom:4px">
      <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="3" y="8" width="14" height="9" rx="1"/><rect x="6" y="5" width="3" height="3"/><path d="M3 12h14"/></svg>
    </div>
    <div class="tpl-name">${esc(tpl.name)}</div>
    <div class="tpl-desc">${tpl.desc||''}</div>`;
    // Löschen nur für eigene Templates (nicht Built-ins: empty, ref_typ*)
    const isBuiltin = BUILTIN_TPLS.some(b=>b.id===tpl.id);
    const isCustom = !isBuiltin && !tpl.id.startsWith('empty') && !tpl.id.startsWith('ref_');
    if(isCustom){
      d.innerHTML += `<button class="btn btn-danger btn-xs" style="margin-top:8px;width:100%" onclick="deleteTpl('${tpl.id}',event)">Löschen</button>`;
    } else {
      d.innerHTML += `<div style="font-size:8.5px;color:var(--xdim);font-family:var(--f-mono);margin-top:6px;text-align:center;letter-spacing:0.06em">REFERENZ</div>`;
    }
    d.addEventListener('click', e=>{if(e.target.closest('.btn-danger'))return; loadTemplate(tpl);});
    grid.appendChild(d);
  });
}

function loadTemplate(tpl){
  if(!tpl || !tpl.data){ toast('Template ohne Daten — nicht geladen'); return; }
  applyState(tpl.data);
  _currentProjKey = null; updateSaveBtnTitle(); updateSB();
  toast('Template geladen: '+tpl.name);
}

function saveAsTemplate(){
  const name = prompt('Templatename:', gi('p_name')||'Mein Template');
  if(!name) return;
  const arr = getCustomTpls();
  arr.push({ id:'tpl_'+Date.now(), name, desc:gi('p_bemerk')||'Eigenes Template', data:collectState() });
  saveCustomTpls(arr);
  renderTemplates();
  toast('Template gespeichert: '+name);
}

function deleteTpl(id, e){
  e.stopPropagation();
  const tpl=getCustomTpls().find(t=>t.id===id);
  confirmDelete('Template «'+(tpl?.name||id)+'» löschen?', ()=>{
    saveCustomTpls(getCustomTpls().filter(t=>t.id!==id));
    renderTemplates();
  });
}

// ════════════════════════════════════════════
