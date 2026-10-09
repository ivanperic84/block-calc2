// BlockCalc — js/speicher.js
// IndexedDB-Speicher mit Cache, Datenaustausch und Komplett-Backup
// INDEXEDDB
// ════════════════════════════════════════════
let _store = {}, _idb = null;
// A8: Fallback auf localStorage, wenn IndexedDB nicht verfügbar ist (Private Mode,
// restriktive WebViews). Ganzer _store als ein JSON-Eintrag — funktional identisch,
// nur Grössenlimit ~5 MB statt quasi unbegrenzt.
const _LS_FALLBACK_KEY='bc_kv_fallback';
function _lsPersist(){ if(_idb) return; try{ localStorage.setItem(_LS_FALLBACK_KEY, JSON.stringify(_store)); }catch(_){} }
function dbGet(key){ return _store[key]; }
function dbSet(key, val){ _store[key]=val; if(_idb){const tx=_idb.transaction('kv','readwrite');tx.objectStore('kv').put(val,key);} else _lsPersist(); }
function dbDel(key){ delete _store[key]; if(_idb){const tx=_idb.transaction('kv','readwrite');tx.objectStore('kv').delete(key);} else _lsPersist(); }
function dbKeys(){ return Object.keys(_store); }
async function dbInit(){
  return new Promise((res)=>{
    const fallback=()=>{ _idb=null;
      try{ const s=localStorage.getItem(_LS_FALLBACK_KEY); if(s) _store=JSON.parse(s)||{}; }catch(_){}
      res(); };
    let req=null;
    try{ req=indexedDB.open('blockCalcDB',1); }catch(_){ return fallback(); }
    if(!req) return fallback();
    req.onupgradeneeded=e=>{e.target.result.createObjectStore('kv');};
    req.onsuccess=e=>{
      _idb=e.target.result;
      const tx=_idb.transaction('kv','readonly'),st=tx.objectStore('kv');
      const rK=st.getAllKeys(), rV=st.getAll();
      let keys=null, vals=null;
      function done(){ if(keys&&vals){keys.forEach((k,i)=>{_store[k]=vals[i];});res();} }
      rK.onsuccess=()=>{keys=rK.result;done();};
      rV.onsuccess=()=>{vals=rV.result;done();};
      rK.onerror=rV.onerror=()=>res();
    };
    req.onerror=()=>fallback();
  });
}
// ── Selektiver Datenaustausch (Optionen → Datenaustausch) ───────────────────────
// Ergänzt das Komplett-Backup um eine gezielte Auswahl: nur die angehakten Bereiche
// werden exportiert. Der Import zeigt erst eine Übersicht des Dateiinhalts (inkl.
// Kollisionswarnung) und schreibt erst nach Bestätigung.
const _EXCHANGE_PARTS = [
  { cb:'exp-projects',    label:'Projekte',          keys:()=>dbKeys().filter(k=>k.startsWith('proj_')) },
  { cb:'exp-templates',   label:'Projekt-Templates', keys:()=>['bc_tpls'] },
  { cb:'exp-bgTemplates', label:'Bodenprofile',      keys:()=>['bc_bg_tpls','bc_bgp_over'] },
  { cb:'exp-loadLevels',  label:'Lastniveaus',       keys:()=>['bc_load_lvls'] },
  { cb:'exp-settings',    label:'Einstellungen',     keys:()=>['bc_settings'] },
];
function exportData(){
  const store={}, summary=[];
  _EXCHANGE_PARTS.forEach(p=>{
    const cb=document.getElementById(p.cb);
    if(!cb || !cb.checked) return;
    let n=0;
    p.keys().forEach(k=>{ const v=dbGet(k); if(v!==undefined && v!==null){ store[k]=v; n++; } });
    if(n) summary.push(p.label+' ('+n+')');
  });
  if(!Object.keys(store).length){ toast('Nichts ausgewählt oder keine Daten vorhanden'); return; }
  const data={ _type:'blockcalc-export', _v:1, _date:new Date().toISOString(), store };
  const blob=new Blob([JSON.stringify(data)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download='BlockCalc_Export_'+new Date().toISOString().slice(0,10)+'.json';
  a.click(); URL.revokeObjectURL(a.href);
  toast('Exportiert: '+summary.join(' · '));
}
let _impPending=null;
function openImportDialog(){
  const f=document.getElementById('imp-file');
  if(f){ f.value=''; f.click(); }   // value leeren: sonst feuert change bei gleicher Datei nicht
}
function handleImportFile(ev){
  const file = ev && ev.target && ev.target.files && ev.target.files[0];
  if(!file) return;
  file.text().then(txt=>{
    let data; try{ data=JSON.parse(txt); }catch(_){ toast('Keine gültige JSON-Datei'); return; }
    let store=null;
    if(data && data.store && (data._type==='blockcalc-export' || data._type==='blockcalc-backup')){
      store=data.store;                                   // Export- oder Backup-Datei
    } else if(Array.isArray(data) || data.p_name || data.g_bx){
      store={};                                           // reine Projekt-JSON (Altformat / Share-Export)
      (Array.isArray(data)?data:[data]).forEach(st=>{
        if(!st || (!st.p_name && !st.g_bx)) return;
        const k='proj_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
        st._k=k; st._d=st._d||new Date().toLocaleDateString('de-CH');
        store[k]=st;
      });
    }
    if(!store || !Object.keys(store).length){ toast('Datei enthält keine BlockCalc-Daten'); return; }
    _impPending=store;
    const keys=Object.keys(store);
    const rows=[];
    const nProj=keys.filter(k=>k.startsWith('proj_')).length;
    if(nProj) rows.push(['Fundamente', nProj]);
    [['bc_tpls','Projekt-Templates'],['bc_bg_tpls','Bodenprofile (eigene)'],
     ['bc_bgp_over','Bodenprofile (angepasst)'],['bc_load_lvls','Lastniveaus'],
     ['bc_micropiles','Eigene Tragglieder'],['bc_settings','Einstellungen']]
      .forEach(([k,l])=>{ if(k in store) rows.push([l,'ja']); });
    const collide=keys.filter(k=>dbGet(k)!==undefined && dbGet(k)!==null).length;
    document.getElementById('imp-dialog-body').innerHTML=
      '<div style="font-size:11px;color:var(--on2);line-height:1.9">'+
      rows.map(r=>'<div style="display:flex;justify-content:space-between;gap:14px">'+
        '<span>'+esc(r[0])+'</span>'+
        '<span style="font-family:var(--f-mono);color:var(--dim)">'+esc(r[1])+'</span></div>').join('')+
      '</div>'+
      (data._date ? '<div class="hint" style="margin-top:8px">Datei vom '+esc(String(data._date).slice(0,10))+'</div>' : '')+
      (collide ? '<div class="hint" style="margin-top:6px;color:var(--warn)">'+collide+
                 ' vorhandene Einträge werden überschrieben.</div>' : '');
    document.getElementById('imp-dialog').classList.add('open');
  }).catch(err=>toast('Import: '+err.message));
}
function doImport(){
  const dlg=document.getElementById('imp-dialog');
  if(!_impPending){ if(dlg) dlg.classList.remove('open'); return; }
  const keys=Object.keys(_impPending);
  const onlyProjects=keys.every(k=>k.startsWith('proj_'));
  Object.entries(_impPending).forEach(([k,v])=>dbSet(k,v));
  _impPending=null;
  if(dlg) dlg.classList.remove('open');
  if(onlyProjects){
    renderProjList();                                     // Projekte sind ohne Neuladen sichtbar
    toast(keys.length+' Fundament'+(keys.length!==1?'e':'')+' importiert');
  } else {
    // Einstellungen/Templates/Lastniveaus wirken erst nach einem Neuaufbau der UI
    toast(keys.length+' Einträge importiert — App lädt neu');
    setTimeout(()=>location.reload(), 700);
  }
}

// A8: Komplett-Backup — ALLE Daten (Projekte, Templates, Bodenprofile, Lastniveaus,
// eigene Tragglieder, Einstellungen, Entwurf) als eine Datei; Wiederherstellen merged
// per Schlüssel (überschreibt Gleiches, löscht nichts) und lädt die App neu.
function exportFullBackup(){
  const data={ _type:'blockcalc-backup', _v:1, _date:new Date().toISOString(), store:{..._store} };
  const blob=new Blob([JSON.stringify(data)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download='BlockCalc_Backup_'+new Date().toISOString().slice(0,10)+'.json';
  a.click(); URL.revokeObjectURL(a.href);
  toast('Backup exportiert ('+Object.keys(_store).length+' Einträge)');
}
function importFullBackup(){
  const inp=document.createElement('input'); inp.type='file'; inp.accept='.json';
  inp.onchange=async e=>{
    const f=e.target.files[0]; if(!f) return;
    try{
      const data=JSON.parse(await f.text());
      if(data._type!=='blockcalc-backup' || !data.store) throw new Error('Keine BlockCalc-Backup-Datei');
      const n=Object.keys(data.store).length;
      confirmDelete('Backup vom '+(data._date||'?').slice(0,10)+' einspielen ('+n+' Einträge)? '+
        'Bestehende Einträge mit gleichem Schlüssel werden überschrieben, die App lädt danach neu.',
        ()=>{ _applyFullBackup(data); });
    }catch(err){ toast('Backup-Import: '+err.message); }
  };
  inp.click();
}
function _applyFullBackup(data, noReload){
  Object.entries(data.store).forEach(([k,v])=>dbSet(k,v));
  if(!noReload){ toast('Backup eingespielt — App lädt neu'); setTimeout(()=>location.reload(), 700); }
}

// ════════════════════════════════════════════
