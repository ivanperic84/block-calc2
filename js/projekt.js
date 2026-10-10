// BlockCalc — js/projekt.js
// Projektverwaltung: FDS, collectState/applyState, Speichern/Laden, Verlauf
// PROJEKTVERWALTUNG
// ════════════════════════════════════════════
const FDS=['p_name','p_fundname','p_nr','p_km','p_mastnr','p_bearbeiter','p_datum','p_bemerk',
  'g_bx','g_by','g_hblock','g_kx','g_ky','g_hkopf','g_uberd','g_uberd_flach','g_ex','g_ey','g_gbeton','g_gauf','flach-material',
  'bg_phi','bg_c','bg_gamma','bg_gamma2','bg_qu','bg_me','bg_c1','bg_koernig','bg_c1_methode','bg_delta_fac','bg_delta_sohle','bg_gw','bg_gwt',
  'bg_beta','bg_bfuss','bg_bhoehe','bg_btyp',
  'tw_phi','tw_c','tw_Ea','tw_Ep',
  'lw_G','lw_G_inf','lw_Q','lw_G1_sup','lw_G1_inf','lw_Q1','lw_G_gzg','lw_Q_gzg',
  'l_NG','l_HGx','l_HGy','l_MGx','l_MGy',
  'l_HWx','l_HWy','l_MWx','l_MWy',
  'pfahl_typ','pfahl_anzahl','pfahl_l','pfahl_s','pfahl_alpha','pfahl_e',
  'pfahl_dm','pfahl_dk',
  'pfahl_dex','pfahl_dex_seite','pfahl_abstand','pfahl_hs','pfahl_laf','pfahl_lv_mode','pfahl_zugfest','pfahl_stab_nrd',
  'pb_mode','pb_prof','pb_stahl','pb_orient','pb_einbau','pb_qb','pb_spitze','l_TG','l_TW','pb_n','pb_rot','pb_auto','pb_sx','pb_sy','pb_ax','pb_ay','pb_L','pb_e','pb_dG','pb_sys','pb_var','pb_korr',
  'pb_bx','pb_by','pb_bank_d','pb_kx','pb_ky','pb_hk','pb_ex','pb_ey','pb_ue','pb_gR','pb_gS','pb_skinfac','pb_zugfac'];

function collectState(){
  const st={};FDS.forEach(f=>{const el=document.getElementById(f);if(el)st[f]=el.value;});
  st.kopf_in_gk = document.getElementById('kopf_in_gk')?.checked ?? true;
  st.hkopf_conv = 2;   // H_Kopf = Gesamthöhe OK Block → OK Kopf (siehe Migration in applyState)
  // Geometrie-Slots pro Modell (Block/Flach entkoppelt) — aktiven Slot mit den aktuellen Feldern sichern
  { const g=Object.assign({}, _geom); g[_geomOwner]=_readGeom();
    st._geom=JSON.stringify(g); st.geomOwner=_geomOwner; }
  st.LF=JSON.stringify(LF);
  st.SCHICHTEN=JSON.stringify(SCHICHTEN);
  st.MODEL=CALC_MODEL;
  st.FLACH_MAT=FLACH_MAT;
  st.AUFLASTEN=JSON.stringify(AUFLASTEN);
  return st;
}
function applyState(st){
  FDS.forEach(f=>{
    const el=document.getElementById(f);
    if(el&&st[f]!==undefined){
      el.value=st[f];
      const rng=document.getElementById(f+'_r'); // Slider synchronisieren
      if(rng) rng.value=st[f];
    }
  });
  // ── Migration Altprojekte (Aug 2026): H_Kopf war der ÜBERSTAND über Terrain, ist jetzt die
  // GESAMTHÖHE OK Block → OK Kopf. Ohne Umrechnung wäre der Kopf um ü zu kurz und der Hebelarm
  // zu klein (unkonservativ). Betrifft nur den BLOCK — beim Flach sass der Kopf schon immer auf
  // der Plattenoberkante, dort war H_Kopf bereits die Gesamthöhe.
  if(st.hkopf_conv !== 2 && st.hkopf_conv !== '2'){
    const _mig = h => (Math.round(((+h||0) + (+st.g_uberd||0))*1000)/1000).toString();
    if(st.MODEL !== 'flach' && st.g_hkopf !== undefined){
      const el=document.getElementById('g_hkopf'), rg=document.getElementById('g_hkopf_r');
      const v=_mig(st.g_hkopf); if(el) el.value=v; if(rg) rg.value=v;
    }
    if(st._geom){ try{
      const _g=JSON.parse(st._geom);
      if(_g && _g.block && _g.block.g_hkopf!==undefined)
        _g.block.g_hkopf = (Math.round(((+_g.block.g_hkopf||0)+(+(_g.block.g_uberd??st.g_uberd)||0))*1000)/1000).toString();
      st = Object.assign({}, st, {_geom: JSON.stringify(_g)});
    }catch(e){} }
  }
  if(st.kopf_in_gk !== undefined){ const cb=document.getElementById('kopf_in_gk'); if(cb) cb.checked = !!st.kopf_in_gk; }
  // Ausrichtung der Pfahlanordnung: Stände ohne das Feld (vor Okt 2026) sind ungedreht
  if(st.pb_rot === undefined) si('pb_rot','0');
  // Felder vom Okt 2026 (Torsion, Stahlgüte, Spitzenwiderstand): ältere Stände bekommen die Vorgabe,
  // sonst bliebe der Wert des zuvor geladenen Projekts stehen.
  [['l_TG','0'],['l_TW','0'],['pb_stahl','355'],['pb_qb','0'],['pb_spitze','stahl'],['pb_orient','quer'],['pb_einbau','ramm']]
    .forEach(([id,v]) => { if(st[id] === undefined) si(id, v); });
  // Migration Altprojekte: Überdeckungs-Toggle (g_uberd_on) entfernt Jul 2026 → war er aus, ü auf 0 setzen
  if(st.g_uberd_on===false){ const uf=document.getElementById('g_uberd'), ur=document.getElementById('g_uberd_r'); if(uf) uf.value='0'; if(ur) ur.value='0'; }
  // Migration Altprojekte: γ_G/γ_Q lagen vor Jun 2026 in tw_G/tw_Q (Felder entfernt)
  if(st.lw_G === undefined && st.tw_G !== undefined) si('lw_G', st.tw_G);
  if(st.lw_Q === undefined && st.tw_Q !== undefined) si('lw_Q', st.tw_Q);
  if(st.bg_koernig){ _bgKoernig=st.bg_koernig; const kSel=document.getElementById('bg_koernig'); if(kSel) kSel.value=_bgKoernig; }
  if(st.bg_c1_methode){ _c1Methode=st.bg_c1_methode; const mSel=document.getElementById('bg_c1_methode'); if(mSel) mSel.value=_c1Methode; }
  if(st.LF){LF=JSON.parse(st.LF);renderLF();}
  if(st.SCHICHTEN){SCHICHTEN=JSON.parse(st.SCHICHTEN);renderSchichten();}
  if(st.FLACH_MAT){ FLACH_MAT=st.FLACH_MAT; const sel=document.getElementById('flach-material'); if(sel)sel.value=FLACH_MAT; }
  if(st.AUFLASTEN){ AUFLASTEN=JSON.parse(st.AUFLASTEN); renderAuflasten(); }
  // g_uberd_flach synchronisieren: wenn nicht explizit gespeichert, aus g_uberd ableiten
  const ufEl = document.getElementById('g_uberd_flach');
  if(ufEl){
    if(st.g_uberd_flach) ufEl.value = st.g_uberd_flach;
    else if(st.g_uberd)  ufEl.value = st.g_uberd;
    const ufr=document.getElementById('g_uberd_flach_r'); if(ufr) ufr.value=ufEl.value;
  }
  // bg_qu_flach synchronisieren
  const quFlEl = document.getElementById('bg_qu_flach');
  if(quFlEl && st.bg_qu) quFlEl.value = st.bg_qu;
  // Geometrie-Slots pro Modell wiederherstellen (Block/Flach entkoppelt); leer = Altprojekt
  try{ _geom = st._geom ? JSON.parse(st._geom) : {}; }catch(_){ _geom={}; }
  if(st.MODEL){ _applyingState=true; try{ setModel(st.MODEL,true); } finally { _applyingState=false; } }
  // Besitzer der g_-Felder bestimmen und dessen Slot mit den geladenen Feldern synchron halten.
  // Altstände ohne geomOwner: bei Block/Flach das Modell selbst, beim Pfahlfundament aus dem
  // Material geschlossen (Stahlplatte ⇒ die Felder gehören dem Flachfundament).
  _geomOwner = (st.geomOwner==='block'||st.geomOwner==='flach') ? st.geomOwner
             : (st.MODEL==='block'||st.MODEL==='flach') ? st.MODEL
             : ((st.FLACH_MAT==='stahl' && (+st.g_gbeton||0) > 40) ? 'flach' : 'block');
  _geom[_geomOwner]=_readGeom();
  // Pfahlbock-Selects nach setModel (Optionen sind erst dann populiert) nachsetzen
  if(st.MODEL==='pfahlbock'){
    const ss=document.getElementById('pb_sys');
    if(ss && st.pb_sys!=null){ ss.value=st.pb_sys; if(typeof onPbSys==='function') onPbSys(true); }
    const vs=document.getElementById('pb_var'); if(vs && st.pb_var!=null) vs.value=st.pb_var;
    const ks=document.getElementById('pb_korr'); if(ks && st.pb_korr!=null) ks.value=st.pb_korr;
    if(typeof renderPfahlbock==='function') renderPfahlbock();
  }
  rebuildScene();
  _checkTWOverrides();
  formatMeterInputs(); // m-Felder nach Laden auf 2 Dezimalstellen
  // Projekt-/Fundament-Dropdown mit dem geladenen Stand synchron halten
  if(st.p_name!==undefined){ const psel=document.getElementById('proj-sel'); if(psel) psel.value=st.p_name||''; }
  if(typeof renderFundSel==='function') renderFundSel();
  scheduleCalc(150); // Ergebnis nach Laden neu berechnen
}
let _currentProjKey = null; // gesetzt beim Laden eines Projekts

function saveProject(){
  if(_currentProjKey){
    // Bestehendes Fundament überschreiben
    const st=collectState(); st._k=_currentProjKey; st._d=new Date().toLocaleDateString('de-CH');
    dbSet(_currentProjKey,st); renderProjList();
    // Dropdown auf p_name des aktuellen Projekts setzen
    const sel=document.getElementById('proj-sel'); if(sel) sel.value=st.p_name||'';
    updateSaveBtnTitle(); _markSaved();
    toast('Gespeichert: '+st.p_name+(st.p_fundname?' · '+st.p_fundname:'')); return;
  }
  // Kein Fundament geladen → als neue Position in der Liste anlegen (gleiche Validierung
  // wie „+ Neues Fundament speichern"): Projekt gewählt + Fundamentname vorhanden → speichern,
  // sonst öffnet saveNewEntry das Banner und markiert das fehlende Pflichtfeld.
  const projSelVal=(document.getElementById('proj-sel')||{}).value||'';
  const fundname=(document.getElementById('p_fundname')?.value||'').trim();
  if(!projSelVal && !fundname){
    // gar nichts eingegeben → Banner öffnen und zum Ausfüllen auffordern
    toggleProjBanner(true);
    toast('Projekt und Fundamentname eingeben, dann speichern');
    return;
  }
  saveNewEntry();
}

function doSaveDlg(){
  const name=document.getElementById('dlg-fname').value.trim();
  const projSel=document.getElementById('dlg-proj-sel').value;
  if(name) { const el=document.getElementById('p_name'); if(el) el.value=name; }
  if(projSel) { const el=document.getElementById('p_nr'); if(el) el.value=projSel; }
  const k='proj_'+Date.now(); _currentProjKey=k;
  const st=collectState(); st._k=k; st._d=new Date().toLocaleDateString('de-CH');
  dbSet(k,st); renderProjList();
  const selEl=document.getElementById('proj-sel'); if(selEl){ selEl.value=k; }
  updateSaveBtnTitle();
  closeOverlay('ov-save-dlg');
  toast('Gespeichert: '+st.p_name+(projSel?' → Projekt '+projSel:''));
}

function updateSaveBtnTitle(){ if(typeof _updateDirtyUI==='function') _updateDirtyUI(); }
function renderProjSel(){
  const sel=document.getElementById('proj-sel'); if(!sel) return;
  const prevVal=sel.value;
  sel.innerHTML='<option value="">— Projekt auswählen —</option>';
  // Eindeutige p_name-Werte als flache Optionen (value = p_name-String)
  const keys=dbKeys().filter(k=>k.startsWith('proj_')).sort().reverse();
  const seen=new Map(); // p_name → p_nr (für Anzeige)
  keys.forEach(k=>{
    const p=dbGet(k);
    if(p.p_name && !seen.has(p.p_name)) seen.set(p.p_name, p.p_nr||'');
  });
  seen.forEach((nr,name)=>{
    const opt=document.createElement('option');
    opt.value=name;
    opt.textContent=name+(nr?' · '+nr:'');
    sel.add(opt);
  });
  const newOpt=document.createElement('option');
  newOpt.value='__new__'; newOpt.textContent='+ Neues Projekt';
  sel.add(newOpt);
  if(prevVal) sel.value=prevVal;
}
function onProjSelChange(){
  const val=document.getElementById('proj-sel').value;
  const nf=document.getElementById('new-proj-name-field');
  if(val==='__new__'){
    if(nf) nf.style.display='';
    si('p_name','');
    // Datum vorausfüllen
    si('p_datum', new Date().toISOString().slice(0,10));
  } else if(val){
    if(nf) nf.style.display='none';
    si('p_name', val);
    // Datum vorausfüllen falls leer
    const datEl=document.getElementById('p_datum');
    if(datEl && !datEl.value) si('p_datum', new Date().toISOString().slice(0,10));
  } else {
    if(nf) nf.style.display='none';
    si('p_name','');
  }
  renderFundSel();   // Fundament-Auswahl auf das gewählte Projekt filtern
  updateSB();
}
// Fundament-Dropdown mit den Fundamenten des gewählten Projekts füllen (analog proj-sel)
function renderFundSel(){
  const sel=document.getElementById('fund-sel'); if(!sel) return;
  const projName=((document.getElementById('proj-sel')||{}).value)||'';
  sel.innerHTML='';
  const hasProj = projName && projName!=='__new__';
  if(hasProj){
    const keys=dbKeys().filter(k=>k.startsWith('proj_')).sort().reverse();
    keys.forEach(k=>{
      const p=dbGet(k); if(!p || (p.p_name||'')!==projName) return;
      const opt=document.createElement('option');
      opt.value=k; opt.textContent=p.p_fundname||'(ohne Name)';
      sel.add(opt);
    });
  }
  const newOpt=document.createElement('option');
  newOpt.value='__new__'; newOpt.textContent='+ Neues Fundament';
  sel.add(newOpt);
  // Auswahl: geladenes Fundament falls in diesem Projekt, sonst „neu"
  if(_currentProjKey && sel.querySelector('option[value="'+_currentProjKey+'"]')) sel.value=_currentProjKey;
  else sel.value='__new__';
  const nf=document.getElementById('fund-newname-field');
  if(nf) nf.style.display = (sel.value==='__new__') ? '' : 'none';
}
function onFundSelChange(){
  const sel=document.getElementById('fund-sel'); if(!sel) return;
  const val=sel.value;
  const nf=document.getElementById('fund-newname-field');
  if(val==='__new__'){
    // Neues Fundament im aktuellen Projekt: Key lösen, Name leeren, Namensfeld zeigen
    if(nf) nf.style.display='';
    _currentProjKey=null;
    si('p_fundname','');
    const nn=document.getElementById('fund-newname'); if(nn) nn.value='';
    updateSaveBtnTitle(); updateSB();
    if(nn) setTimeout(()=>{ try{ nn.focus(); }catch(_){} }, 0);
  } else if(val){
    if(nf) nf.style.display='none';
    loadProj(val);   // bestehendes Fundament laden
  }
}
// Projektnamen nachträglich ändern: benennt ALLE Fundamente dieses Projekts um
function renameProjGroup(oldName,newName){
  newName=(newName||'').trim();
  if(!newName || newName===oldName){ renderProjList(); return; }
  dbKeys().filter(k=>k.startsWith('proj_')).forEach(k=>{
    const p=dbGet(k); if(p && (p.p_name||'—')===oldName){ p.p_name=newName; dbSet(k,p); }
  });
  if(_currentProjKey){ const cp=dbGet(_currentProjKey); if(cp) si('p_name', cp.p_name||''); }
  renderProjList();
  const psel=document.getElementById('proj-sel'); if(psel) psel.value=newName;
  renderFundSel(); updateSB();
  toast('Projekt umbenannt: '+newName);
}
// Pflichtfeld markieren: Banner öffnen, Feld fokussieren + kurz rot umranden
function _flagField(id){
  const el=document.getElementById(id); if(!el) return;
  toggleProjBanner(true);
  setTimeout(()=>{ try{ el.focus(); }catch(_){ } el.classList.add('field-invalid'); el.scrollIntoView({block:'center'});
    setTimeout(()=>el.classList.remove('field-invalid'), 2200); }, 80);
}
function saveNewEntry(){
  const projSelVal=document.getElementById('proj-sel').value;
  const newName=(document.getElementById('new-proj-name')?.value||'').trim();
  const fundname=(document.getElementById('p_fundname')?.value||'').trim();
  let projName;
  if(projSelVal==='__new__'){
    projName=newName;
    if(!projName){ toast('Projektname eingeben'); _flagField('new-proj-name'); return; }
  } else if(projSelVal){
    projName=projSelVal;
  } else {
    toast('Projekt auswählen'); _flagField('proj-sel'); return;
  }
  if(!fundname){
    const fs=document.getElementById('fund-sel'); if(fs){ fs.value='__new__'; onFundSelChange(); }
    toast('Fundamentbezeichnung eingeben'); _flagField('fund-newname'); return;
  }
  si('p_name', projName);
  const k='proj_'+Date.now();
  const st=collectState(); st._k=k; st._d=new Date().toLocaleDateString('de-CH');
  dbSet(k,st);
  _currentProjKey=k;
  renderProjList(); // baut proj-sel-Optionen (inkl. neuem Projektnamen) + renderFundSel()
  // Erst JETZT (Option existiert) das Projekt selektieren, dann Fundament-Liste passend filtern
  const sel=document.getElementById('proj-sel');
  if(sel) sel.value=projName;
  renderFundSel();
  // Neues-Projekt-Feld ausblenden
  const nf=document.getElementById('new-proj-name-field');
  if(nf) nf.style.display='none';
  updateSaveBtnTitle(); _markSaved(); updateSB();
  toast('Gespeichert: '+projName+' · '+fundname);
}
function renderProjList(){
  const list=document.getElementById('proj-list'); list.innerHTML='';
  renderProjSel();
  const keys=dbKeys().filter(k=>k.startsWith('proj_')).sort().reverse();
  if(!keys.length){
    list.innerHTML='<div style="color:var(--xdim);font-size:9.5px;font-family:var(--f-mono);padding:8px 0">Keine gespeicherten Projekte</div>';
    renderFundSel();
    return;
  }
  // Suche + Sortierung (U5)
  const q=((document.getElementById('proj-search')||{}).value||'').trim().toLowerCase();
  const sortBy=((document.getElementById('proj-sort')||{}).value)||'neu';
  const match=p=>!q || [p.p_fundname,p.p_km,p.p_mastnr,p.p_name,p.p_bemerk]
    .some(v=>(v||'').toLowerCase().includes(q));
  const cmp={
    name:(a,b)=>(a.p.p_fundname||'').localeCompare(b.p.p_fundname||'', 'de', {numeric:true}),
    km:  (a,b)=>(a.p.p_km||'').localeCompare(b.p.p_km||'', 'de', {numeric:true}),
    mast:(a,b)=>(a.p.p_mastnr||'').localeCompare(b.p.p_mastnr||'', 'de', {numeric:true}),
  }[sortBy];   // 'neu' = Key-Reihenfolge (Timestamp absteigend) beibehalten
  // Gruppieren nach Projektname (p_name)
  const groups={};
  keys.forEach(k=>{
    const p=dbGet(k);
    if(!match(p)) return;
    const grpKey=p.p_name||'—';
    if(!groups[grpKey]) groups[grpKey]={name:grpKey, entries:[]};
    groups[grpKey].entries.push({k,p});
  });
  Object.values(groups).forEach(g=>{ if(cmp) g.entries.sort(cmp); });
  if(!Object.keys(groups).length){
    list.innerHTML='<div style="color:var(--xdim);font-size:9.5px;font-family:var(--f-mono);padding:8px 0">Keine Treffer für «'+q+'»</div>';
    renderFundSel();
    return;
  }

  Object.values(groups).forEach((grp,gi)=>{
    const grpId='pg_'+gi;
    const card=document.createElement('div');
    card.className='lf-card open';
    card.innerHTML=`
      <div class="lf-card-head" onclick="this.closest('.lf-card').classList.toggle('open')">
        <span class="proj-grp-name" contenteditable="true" spellcheck="false" title="Klicken zum Umbenennen des Projekts" style="font-weight:500;font-size:11px;outline:none;cursor:text;border-radius:3px;padding:1px 3px">${esc(grp.name||'Projekt')}</span>
        <span style="flex:1"></span>
        <span style="font-family:var(--f-mono);font-size:9px;color:var(--xdim);margin-right:6px">${grp.entries.length} Fundament${grp.entries.length!==1?'e':''}</span>
        <svg class="lf-chevron" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14"><path d="M6 8l4 4 4-4"/></svg>
      </div>
      <div class="lf-card-body" style="padding:0;overflow-x:auto">
        <table style="border-collapse:separate;border-spacing:0;font-family:var(--f-mono);font-size:9.5px;min-width:480px;width:100%">
          <thead>
            <tr style="background:var(--s2)">
              <th style="padding:5px 8px;text-align:left;font-weight:500;font-size:9px;letter-spacing:0.07em;text-transform:uppercase;color:var(--xdim);border-bottom:1px solid var(--ol);white-space:nowrap">Fundamentname</th>
              <th style="padding:5px 6px;text-align:left;font-weight:500;font-size:9px;letter-spacing:0.07em;text-transform:uppercase;color:var(--xdim);border-bottom:1px solid var(--ol);white-space:nowrap">KM</th>
              <th style="padding:5px 6px;text-align:left;font-weight:500;font-size:9px;letter-spacing:0.07em;text-transform:uppercase;color:var(--xdim);border-bottom:1px solid var(--ol);white-space:nowrap">Mast-Nr.</th>
              <th style="padding:5px 6px;text-align:left;font-weight:500;font-size:9px;letter-spacing:0.07em;text-transform:uppercase;color:var(--xdim);border-bottom:1px solid var(--ol);white-space:nowrap">Datum</th>
              <th style="padding:5px 6px;text-align:left;font-weight:500;font-size:9px;letter-spacing:0.07em;text-transform:uppercase;color:var(--xdim);border-bottom:1px solid var(--ol);white-space:nowrap">Bemerkung</th>
              <th style="padding:5px 6px;border-bottom:1px solid var(--ol)"></th>
            </tr>
          </thead>
          <tbody id="${grpId}"></tbody>
        </table>
      </div>`;
    list.appendChild(card);
    // Projektname inline umbenennbar (benennt alle Fundamente der Gruppe um)
    const nameEl=card.querySelector('.proj-grp-name');
    if(nameEl){
      const _old=grp.name;
      nameEl.addEventListener('click',e=>e.stopPropagation());
      nameEl.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); nameEl.blur(); } });
      nameEl.addEventListener('blur',()=>renameProjGroup(_old, nameEl.textContent));
    }
    const tbody=card.querySelector('#'+grpId);
    if(grp.entries.some(e=>e.k===_currentProjKey)){
      card.style.borderColor='var(--acc)'; card.style.boxShadow='0 0 0 1.5px var(--acc)';
    }
    grp.entries.forEach(({k,p})=>{
      const isActive=k===_currentProjKey;
      const tr=document.createElement('tr');
      tr.style.borderBottom='1px solid var(--ol)';
      if(isActive){ tr.style.background='rgba(124,141,224,0.10)'; }
      const ec=(field,val,color)=>
        `<td contenteditable="true" spellcheck="false"
           style="padding:5px 8px;color:${color||'var(--on2)'};outline:none;cursor:text;min-width:40px"
           class="proj-ed"
           onblur="saveProjField('${k}','${field}',this.textContent.trim())"
           onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur()}"
           >${esc(val||'')}</td>`;
      tr.innerHTML=`
        ${ec('p_fundname',p.p_fundname,'var(--on2)')}
        ${ec('p_km',p.p_km,'var(--dim)')}
        ${ec('p_mastnr',p.p_mastnr,'var(--dim)')}
        <td style="padding:5px 6px;color:var(--xdim);font-size:9px">${(p._d||'—').split(',')[0]}</td>
        ${ec('p_bemerk',p.p_bemerk,'var(--xdim)')}
        <td style="padding:5px 6px;text-align:right;white-space:nowrap">
          <button class="btn btn-tonal btn-xs" onclick="loadProj('${k}')">Laden</button>
          <button class="btn btn-tonal btn-xs" onclick="reassignProj('${k}')" title="Projekt zuweisen" style="margin-left:3px"><svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 7h12l-3-3M16 13H4l3 3"/></svg></button>
          <button class="btn btn-danger btn-xs" onclick="delProj('${k}')" title="Entfernen" style="margin-left:3px"><svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 6h12M8 6V4.5a1 1 0 011-1h2a1 1 0 011 1V6M6.5 6l.5 9.5a1 1 0 001 1h4a1 1 0 001-1l.5-9.5"/></svg></button>
        </td>`;
      tbody.appendChild(tr);
    });
  });
  renderFundSel();   // Fundament-Dropdown mit der aktuellen Auswahl synchron halten
}
function loadProj(k){
  const p=dbGet(k); if(!p) return;
  applyState(p);
  _currentProjKey = k;
  if(typeof renderProjList==='function') renderProjList();   // baut proj-sel-Optionen + Aktiv-Markierung
  // Erst nach renderProjList (Option existiert) selektieren, dann Fundament-Liste passend filtern
  const sel=document.getElementById('proj-sel'); if(sel) sel.value=p.p_name||'';
  renderFundSel();
  // Neues-Projekt-Feld ausblenden
  const nf=document.getElementById('new-proj-name-field'); if(nf) nf.style.display='none';
  updateSB(); updateSaveBtnTitle();
  setTimeout(()=>{ histInit(); _markSaved(); }, 200); // Neuer History-Stack + sauberer Referenzstand
  toast('Geladen: '+p.p_name+(p.p_fundname?' · '+p.p_fundname:''));
}
function delProj(k){
  const p=dbGet(k);
  const name=p?.p_name||'Fundament';
  confirmDelete('Fundament «'+name+'» entfernen?', ()=>{
    if(k===_currentProjKey){
      _currentProjKey=null;
      const sel=document.getElementById('proj-sel'); if(sel) sel.value='';
    }
    dbDel(k); renderProjList(); updateSaveBtnTitle();
  });
}
function importJSON(){
  const inp=document.createElement('input'); inp.type='file'; inp.accept='.json';
  inp.onchange=async e=>{
    const file=e.target.files[0]; if(!file) return;
    try{
      const txt=await file.text();
      const data=JSON.parse(txt);
      const arr=Array.isArray(data)?data:[data];
      let loaded=0; let lastKey=null;
      arr.forEach(st=>{
        if(!st.p_name&&!st.g_bx) return;
        const k='proj_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
        lastKey=k; st._k=k; st._d=st._d||new Date().toLocaleDateString('de-CH');
        dbSet(k,st); loaded++;
      });
      renderProjList();
      if(loaded===1 && lastKey){ loadProj(lastKey); }
      toast(loaded+' Fundament'+(loaded!==1?'e':'')+' importiert');
    }catch(err){ toast('Fehler beim Import: '+err.message); }
  };
  inp.click();
}
function doReset(){
  _currentProjKey=null;
  closeOverlay('ov-reset');
  loadTemplate('empty');
  const sel=document.getElementById('proj-sel'); if(sel) sel.value='__new__';
  updateSaveBtnTitle();
  toast('Bereit für neues Fundament');
}

// ── Selektion Hilfsfunktionen ───────────────────────────────────────
// ── Teilen / Export Modal ───────────────────────────────────────────
function openShare(preselKeys){
  const sl=document.getElementById('share-list'); sl.innerHTML='';
  // Alle Fundamente gruppiert anzeigen
  const keys=dbKeys().filter(k=>k.startsWith('proj_')).sort().reverse();
  const groups={};
  keys.forEach(k=>{
    const p=dbGet(k); const grpKey=p.p_nr||'—';
    if(!groups[grpKey]) groups[grpKey]={nr:grpKey, name:p.p_name||'', entries:[]};
    groups[grpKey].entries.push({k,p});
  });
  Object.values(groups).forEach(grp=>{
    const hdr=document.createElement('div');
    hdr.style.cssText='font-family:var(--f-mono);font-size:9px;color:var(--xdim);padding:8px 0 4px;letter-spacing:0.06em;text-transform:uppercase';
    hdr.textContent=(grp.name||'Projekt')+(grp.nr!=='—'?' · '+grp.nr:'');
    sl.appendChild(hdr);
    grp.entries.forEach(({k,p})=>{
      const row=document.createElement('label');
      row.style.cssText='display:flex;align-items:center;gap:10px;padding:6px 8px;border-radius:var(--r1);cursor:pointer;background:var(--s2);border:1px solid var(--ol);margin-bottom:3px';
      row.innerHTML=`<input type="checkbox" class="share-cb" data-key="${k}" style="accent-color:var(--acc)"${preselKeys&&preselKeys.includes(k)?' checked':''}>
        <span style="flex:1;font-size:10.5px;color:var(--on2)">${esc(p.p_name||'—')}</span>
        <span style="font-family:var(--f-mono);font-size:9px;color:var(--dim)">${esc(p.p_km||'')} ${p.p_mastnr?'Mast '+esc(p.p_mastnr):''}</span>`;
      row.addEventListener('change', updateShareAll);
      sl.appendChild(row);
    });
  });
  updateShareAll();
  document.getElementById('ov-share').classList.add('open');
}
function shareToggleAll(checked){
  document.querySelectorAll('.share-cb').forEach(cb=>cb.checked=checked);
}
function updateShareAll(){
  const cbs=[...document.querySelectorAll('.share-cb')];
  const n=cbs.filter(c=>c.checked).length;
  const allCb=document.getElementById('share-all');
  if(allCb){ allCb.checked=n===cbs.length&&cbs.length>0; allCb.indeterminate=n>0&&n<cbs.length; }
}
function doShare(){
  const keys=[...document.querySelectorAll('.share-cb:checked')].map(cb=>cb.dataset.key);
  if(!keys.length){ toast('Keine Fundamente ausgewählt'); return; }
  const fmt=document.querySelector('input[name="share-fmt"]:checked')?.value||'json';
  closeOverlay('ov-share');
  if(fmt==='json') exportKeysJSON(keys);
  else exportKeysPDF(keys);
}
function exportKeysJSON(keys){
  const data=keys.map(k=>dbGet(k)).filter(Boolean);
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  const projName=(data[0]?.p_name||'projekt').replace(/[^a-zA-Z0-9_-]/g,'_');
  a.download='BlockCalc_'+projName+(keys.length>1?'_'+keys.length+'x':'')+'.json';
  a.click(); URL.revokeObjectURL(a.href);
  toast('JSON exportiert ('+keys.length+' Fundamente)');
}

// ── Export PDF ─────────────────────────────────────────────────────
function exportKeysPDF(keys){
  if(!keys.length){ toast('Keine Fundamente ausgewählt'); return; }
  try {
    const {jsPDF}=window.jspdf;
    const doc=new jsPDF({orientation:'p',unit:'mm',format:'a4'});
    const m=14, lh=6;
    keys.forEach((k,pi)=>{
      const p=dbGet(k); if(!p) return;
      if(pi>0) doc.addPage();
      let y=m;
      const ln=(txt,sz,bold)=>{ doc.setFontSize(sz||9); doc.setFont('helvetica',bold?'bold':'normal'); doc.text(String(txt),m,y); y+=lh; };
      const row=(lbl,val)=>{ doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.text(lbl+':',m,y); doc.setFont('helvetica','normal'); doc.text(String(val||'—'),m+46,y); y+=5; };
      ln('BlockCalc — Fundamentnachweis SIA 267',13,true); y+=2;
      ln('─'.repeat(60),8); y+=1;
      ln((p.p_name||'Fundament')+(p.p_mastnr?' · Mast '+p.p_mastnr:'')+(p.p_km?' · km '+p.p_km:''),10,true); y+=2;
      row('Projekt-Nr.',p.p_nr); row('Bearbeiter',p.p_bearbeiter); row('Datum',p.p_datum); row('Bemerkung',p.p_bemerk);
      y+=3; ln('Geometrie',9,true); y+=1;
      row('B × L × H_Block [m]',(p.g_bx||'?')+'×'+(p.g_by||'?')+'×'+(p.g_hblock||'?'));
      row('Überdeckung ü [m]',p.g_uberd); row('Kopf B×L×H [m]',(p.g_kx||'?')+'×'+(p.g_ky||'?')+'×'+(p.g_hkopf||'?'));
      y+=3; ln('Boden',9,true); y+=1;
      row("φ' [°]",p.bg_phi); row("c' [kPa]",p.bg_c); row('γ [kN/m³]',p.bg_gamma);
      y+=3; ln('Seite '+(pi+1)+' / '+keys.length,7);
    });
    const fname='BlockCalc_Projekt'+(keys.length>1?'_'+keys.length+'x':'')+'.pdf';
    doc.save(fname);
    toast('PDF exportiert ('+keys.length+' Fundamente)');
  } catch(e){ toast('PDF-Export fehlgeschlagen'); console.error(e); }
}

// ── Inline-Edit: Feld direkt in DB speichern ───────────────────────
function saveProjField(k, field, val){
  const p=dbGet(k); if(!p) return;
  p[field]=val; dbSet(k,p);
  // Wenn aktuelles Projekt: DOM-Input sofort mitaktualisieren (verhindert Revert beim Speichern)
  if(k===_currentProjKey){
    const el=document.getElementById(field);
    if(el && el.value !== val) el.value = val;
  }
  // Gruppen-Header / Liste neu rendern bei Namens-/Nr-Änderung
  if(field==='p_name'||field==='p_nr'||field==='p_fundname') renderProjList();
  if(k===_currentProjKey && (field==='p_name'||field==='p_fundname')) updateSB();
}

// ── Fundament einem anderen Projekt zuweisen ────────────────────────
// ── Generisches Bestätigungs-Modal ──────────────────────────────────
let _confirmCb=null;
function confirmDelete(msg, cb){
  document.getElementById('confirm-msg').textContent=msg;
  _confirmCb=cb;
  document.getElementById('confirm-ok').onclick=()=>{ closeOverlay('ov-confirm'); if(_confirmCb) _confirmCb(); _confirmCb=null; };
  document.getElementById('ov-confirm').classList.add('open');
}

let _reassignKey=null;
function reassignProj(k){
  const p=dbGet(k); if(!p) return;
  _reassignKey=k;
  // Info-Zeile
  document.getElementById('reassign-cur').textContent=
    'Fundament: '+(p.p_fundname||k)+' · aktuell in: '+(p.p_name||'—');
  // Dropdown mit bestehenden Projektnamen
  const sel=document.getElementById('reassign-sel');
  const names=[...new Set(dbKeys().filter(j=>j.startsWith('proj_')).map(j=>dbGet(j)?.p_name).filter(Boolean))];
  sel.innerHTML='<option value="">(kein Projekt)</option>'+
    names.map(n=>`<option value="${esc(n)}"${n===p.p_name?' selected':''}>${esc(n)}</option>`).join('');
  // Freitextfeld auf aktuellen Projektnamen setzen
  document.getElementById('reassign-nr').value=p.p_name||'';
  // Sync: Dropdown → Freitext
  sel.oninput=()=>{ document.getElementById('reassign-nr').value=sel.value; };
  document.getElementById('ov-reassign').classList.add('open');
}
function doReassign(){
  if(!_reassignKey) return;
  const p=dbGet(_reassignKey); if(!p) return;
  const newName=document.getElementById('reassign-nr').value.trim();
  p.p_name=newName; dbSet(_reassignKey,p); renderProjList();
  closeOverlay('ov-reassign');
  toast('Verschoben zu Projekt: '+(newName||'(kein)'));
}

// ════════════════════════════════════════════
