// BlockCalc — js/lastniveaus.js
// Lastniveaus (Standardlasten)
// LASTNIVEAUS
// ════════════════════════════════════════════
let LOAD_LVLS = [];

function saveLLVLS(){ dbSet('bc_load_lvls', LOAD_LVLS); }
function loadLLVLS(){ const s=dbGet('bc_load_lvls'); if(s) LOAD_LVLS=s; }

function collectLoadVals(name){
  return { name: name||`Niveau ${LOAD_LVLS.length+1}`,
    NG:+gi('l_NG'), HGx:+gi('l_HGx'), HGy:+gi('l_HGy'),
    MGx:+gi('l_MGx'), MGy:+gi('l_MGy'),
    HWx:+gi('l_HWx'), HWy:+gi('l_HWy'),
    MWx:+gi('l_MWx'), MWy:+gi('l_MWy') };
}

function applyLoadVals(ll){
  si('l_NG',ll.NG); si('l_HGx',ll.HGx); si('l_HGy',ll.HGy);
  si('l_MGx',ll.MGx); si('l_MGy',ll.MGy);
  si('l_HWx',ll.HWx); si('l_HWy',ll.HWy);
  si('l_MWx',ll.MWx); si('l_MWy',ll.MWy);
  rebuildScene(); toast('Lastniveau geladen: '+ll.name);
}

function addLoadLvl(){
  const name=prompt('Bezeichnung:', gi('p_name')||`Niveau ${LOAD_LVLS.length+1}`);
  if(!name) return;
  LOAD_LVLS.push(collectLoadVals(name));
  saveLLVLS(); renderLoadLvls();
  toast('Lastniveau gespeichert: '+name);
}

function removeLoadLvl(i){
  if(!confirm('Löschen?')) return;
  LOAD_LVLS.splice(i,1); _activeLoadLvlIdx=null; saveLLVLS(); renderLoadLvls();
}

// Dropdown zeigt das geladene Niveau (bleibt sichtbar) → springt erst auf den Platzhalter zurück,
// wenn unten ein Lastfeld von Hand geändert wird (_onLoadFieldEdit). _activeLoadLvlIdx = aktives Niveau.
let _activeLoadLvlIdx=null;
const _LL_KEYS=['NG','HGx','HGy','MGx','MGy','HWx','HWy','MWx','MWy'];
// Index des Lastniveaus, dessen Werte EXAKT den aktuellen Mastlast-Feldern entsprechen (−1 = keins)
function _matchLoadLvl(){
  const cur=_LL_KEYS.map(k=>+gi('l_'+k)||0);
  return LOAD_LVLS.findIndex(ll=>_LL_KEYS.every((k,j)=>Math.abs((+ll[k]||0)-cur[j])<1e-6));
}
// Dropdown auf das passende Niveau (oder Platzhalter) setzen — spiegelt immer die aktuellen Felder
function _syncLoadLvlSelect(){
  const i=_matchLoadLvl();
  _activeLoadLvlIdx = i>=0 ? i : null;
  const sel=document.querySelector('#load-lvls-list select');
  if(sel) sel.value = i>=0 ? String(i) : '';
}
function _loadLvlByIdx(i){
  if(!LOAD_LVLS[i]) return;
  applyLoadVals(LOAD_LVLS[i]);          // Felder via si() (kein input-Event) → danach explizit abgleichen
  _syncLoadLvlSelect();
}
function _loadLvlPick(sel){
  if(sel.value==='' || isNaN(+sel.value)) return;
  _loadLvlByIdx(+sel.value);
}
// Manuelle Feldänderung → Dropdown neu abgleichen: zeigt das Niveau wieder, sobald die Werte wieder passen,
// sonst den Platzhalter (delegiert; si() feuert kein input → programmatische Loads triggern nicht doppelt).
document.addEventListener('input', e=>{
  if(e.target && /^l_(NG|HGx|HGy|MGx|MGy|HWx|HWy|MWx|MWy)$/.test(e.target.id)) _syncLoadLvlSelect();
});
let _llManageOpen=false;   // „Niveaus verwalten"-Bereich auf/zu (überlebt Rebuilds)
function _toggleLLManage(){ _llManageOpen=!_llManageOpen;
  const c=document.querySelector('#load-lvls-list .ll-manage'); if(c) c.classList.toggle('open', _llManageOpen); }
function renderLoadLvls(){
  const el=document.getElementById('load-lvls-list');
  if(!el) return;
  if(!LOAD_LVLS.length){
    el.innerHTML='<div class="hint" style="padding:2px 0 6px">Noch keine Lastniveaus gespeichert — unten „Aktuelle Werte als Lastniveau speichern".</div>';
    return;
  }
  const cols=[['NG','N_G'],['HGx','HGx'],['HGy','HGy'],['MGx','MGx'],['MGy','MGy'],
              ['HWx','HWx'],['HWy','HWy'],['MWx','MWx'],['MWy','MWy']];
  const _actIdx=_matchLoadLvl();   // Dropdown spiegelt die aktuellen Felder
  _activeLoadLvlIdx = _actIdx>=0 ? _actIdx : null;
  el.innerHTML=`
    <div style="margin:2px 0 8px">
      <select onchange="_loadLvlPick(this)" title="Standardlast laden"
        style="width:100%;background:var(--s1);border:1px solid var(--ol);border-radius:var(--r1);color:var(--on);padding:8px 10px;font-family:var(--f-mono);font-size:11px;cursor:pointer;outline:none">
        <option value="">Lastniveau laden…</option>
        ${LOAD_LVLS.map((l,i)=>`<option value="${i}"${_actIdx===i?' selected':''}>${l.name||('Niveau '+(i+1))}</option>`).join('')}
      </select>
    </div>
    <div class="lf-card ll-manage${_llManageOpen?' open':''}">
      <div class="lf-card-head" onclick="_toggleLLManage()" style="cursor:pointer">
        <span style="font-weight:500;font-size:11px">Niveaus verwalten</span>
        <span style="flex:1"></span>
        <span style="font-family:var(--f-mono);font-size:9px;color:var(--xdim);margin-right:6px">${LOAD_LVLS.length} Niveau${LOAD_LVLS.length!==1?'s':''}</span>
        <svg class="lf-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 2l4 4-4 4"/></svg>
      </div>
      <div class="lf-card-body" style="padding:0;overflow-x:auto">
        <table class="ll-tbl" style="width:100%">
          <thead><tr><th>Bezeichnung</th>${cols.map(c=>`<th>${c[1]}</th>`).join('')}<th></th></tr></thead>
          <tbody>${LOAD_LVLS.map((ll,i)=>`<tr>
            <td><input class="ll-inp ll-name" value="${ll.name}"
              onchange="LOAD_LVLS[${i}].name=this.value;saveLLVLS();renderLoadLvls()"/></td>
            ${cols.map(c=>`<td><input class="ll-inp" type="number" value="${ll[c[0]]??0}"
              onchange="LOAD_LVLS[${i}]['${c[0]}']=+this.value;saveLLVLS()"/></td>`).join('')}
            <td style="white-space:nowrap;text-align:right">
              <button class="btn btn-tonal btn-xs" onclick="_loadLvlByIdx(${i})">Laden</button>
              <button class="btn btn-danger btn-xs" style="margin-left:3px" title="Entfernen" onclick="removeLoadLvl(${i})"><svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 6h12M8 6V4.5a1 1 0 011-1h2a1 1 0 011 1V6M6.5 6l.5 9.5a1 1 0 001 1h4a1 1 0 001-1l.5-9.5"/></svg></button>
            </td></tr>`).join('')}
          </tbody></table>
      </div>
    </div>`;
}

// ════════════════════════════════════════════
