// BlockCalc — js/viewer.js
// 3D-Viewer (Three.js): Szene, Kamera, Layer, Vermassung, Spannungsbild
// THREE.JS VIEWER
// ════════════════════════════════════════════
let scene, camera, renderer;
let showGnd=true, showStr=false, showDim=true, showLabels=true, showLyr=false, showVec=false, showText=true, showGrid=true, showPfahl=false;

// ── 3D-Darstellungs-Stil (zentrales Modul · SINGLE SOURCE) ───────────────────
// Defaults = Block-Konvention; via SETTINGS.viz überschreibbar (→ Optionen, Phase 2).
// vizStyle() liefert die aktiven Werte (Defaults überlagert mit SETTINGS.viz).
const VIZ_DEFAULTS = {
  concrete:0x48568a, concreteDim:0x606068,           // Beton (Block/Bankett/Kopf)
  edge:0x5a6898, edgeDim:0x888890,                   // Kanten
  pile:0x8899aa, pileDim:0x606068,                   // Pfahl-Tragglied
  druck:0xd0a050, zug:0x4db8c9,                      // Pfahlkraft Druck/Zug
  terrain:0x3a3c48, terrainLight:0xb8b8c4,           // Terrain dunkel/hell
  layer:[0x8a7550,0x6a5838,0x4a3e26,0x2e2818],       // Bodenschichten
  sigma:0xc98b5a,                                    // σ'v-Profil
  forceN:0x555555, forceH:0x888888, moment:0x8899bb, // Einwirkungen (wie Block)
  dim:0xffffff, dimOp:0.55,                          // Vermassung (Linienfarbe/-opazität — dezent)
  solidOp:0.85, ghostOp:0.28,                        // Fundament-Transparenz (normal / ausgegraut)
  gridShow:true, gridCol:null,                       // Raster: an/aus · Farbe (null = Theme-Default)
  cameraIso:false,                                   // Kamera: false=perspektivisch · true=isometrisch
  dimInteractive:false                               // Vermassung klickbar (→ Eingabefeld fokussieren)
};
function vizStyle(){ return Object.assign({}, VIZ_DEFAULTS, (typeof SETTINGS!=='undefined' && SETTINGS.viz) || {}); }
// Raster-Stil aus VIZ anwenden (Sichtbarkeit + Farbe) — auf das persistente 'grid'-Objekt
function applyGridStyle(){
  if(typeof scene==='undefined' || !scene) return;
  const g=scene.getObjectByName('grid'); if(!g) return;
  const C=vizStyle();
  g.visible = (typeof showGrid==='undefined' || showGrid!==false) && C.gridShow!==false;
  if(C.gridCol!=null){ (Array.isArray(g.material)?g.material:[g.material]).forEach(m=>{ if(m&&m.color) m.color.setHex(C.gridCol); }); }
  if(typeof invalidateViewer==='function') invalidateViewer();
}
let showPfahlKeil=false;  // Bodenpressung-Keile (Block-/Pfahlkeil + Schattenband) — Start aus
let _stressHidden=null;
let _calcTimer=null;
function scheduleCalc(ms){ clearTimeout(_calcTimer); _calcTimer=setTimeout(calculate, ms??420); scheduleHistPush(); }

// ── Undo / Redo ────────────────────────────────────────────────────────
const _HIST_MAX=60;
let _hist=[];        // Array von State-Snapshots (JSON-Strings)
let _histIdx=-1;     // Zeiger auf aktuellen Stand
let _histTimer=null;
let _applyingHist=false;

function _histSnap(){ return JSON.stringify(collectState()); }

function scheduleHistPush(){
  clearTimeout(_histTimer);
  _histTimer=setTimeout(()=>{
    if(_applyingHist) return;
    const snap=_histSnap();
    if(_histIdx>=0 && _hist[_histIdx]===snap) return; // keine Änderung
    // Redo-Stack abschneiden
    _hist=_hist.slice(0,_histIdx+1);
    _hist.push(snap);
    if(_hist.length>_HIST_MAX) _hist.shift();
    _histIdx=_hist.length-1;
    updateUndoBtn();
    if(typeof _checkDirty==='function'){ _checkDirty(); _saveDraft(); }   // Dirty-Status + Auto-Entwurf
  }, 600);
}

function histUndo(){
  if(_histIdx<=0){ toast('Kein weiterer Schritt zurück'); return; }
  if(_histIdx===_hist.length-1){
    // Aktuellen Stand noch sichern falls noch nicht
    const snap=_histSnap();
    if(_hist[_histIdx]!==snap){ _hist[_histIdx]=snap; }
  }
  _histIdx--;
  _applyingHist=true;
  applyState(JSON.parse(_hist[_histIdx]));
  _applyingHist=false;
  updateUndoBtn();
  toast('Rückgängig');
}

function histRedo(){
  if(_histIdx>=_hist.length-1){ toast('Nichts zum Wiederholen'); return; }
  _histIdx++;
  _applyingHist=true;
  applyState(JSON.parse(_hist[_histIdx]));
  _applyingHist=false;
  updateUndoBtn();
  toast('Wiederherstellen');
}

function updateUndoBtn(){
  const u=document.getElementById('btn-undo'); if(u) u.disabled=_histIdx<=0;
  const r=document.getElementById('btn-redo'); if(r) r.disabled=_histIdx>=_hist.length-1;
}

// Initialen Stand in History aufnehmen (nach App-Start)
function histInit(){ const snap=_histSnap(); _hist=[snap]; _histIdx=0; updateUndoBtn(); }

// ── Dirty-State + Auto-Entwurf (Datensicherheit, Jun 2026) ──────────────────────
// _savedSnap = Stand beim letzten Speichern/Laden bzw. Default → Referenz für „ungespeichert".
let _savedSnap=null, _dirty=false;
function _markSaved(){ _savedSnap=_histSnap(); _dirty=false; _updateDirtyUI(); _saveDraft(); }
function _checkDirty(){ const d=(_savedSnap!==null && _histSnap()!==_savedSnap); if(d!==_dirty){ _dirty=d; _updateDirtyUI(); } }
function _updateDirtyUI(){
  const btn=document.getElementById('btn-save'); if(!btn) return;
  btn.classList.toggle('dirty', _dirty);
  btn.title=(_currentProjKey?'Speichern (überschreibt geladenes Fundament)':'Speichern (neues Fundament — Banner öffnet sich)')+(_dirty?' · ungespeicherte Änderungen':'');
}
function _saveDraft(){ if(window._SELFTEST_MODE || window._EMBED_MODE) return; /* Selbsttest/Embed dürfen den echten Arbeitsstand nie überschreiben */
  try{ dbSet('bc_draft',{ st:_histSnap(), ts:Date.now(), projKey:_currentProjKey, savedSnap:_savedSnap }); }catch(_){} }
function _restoreDraft(){
  let d; try{ d=dbGet('bc_draft'); }catch(_){ return false; }
  if(!d || !d.st) return false;
  try{
    _applyingHist=true; applyState(JSON.parse(d.st)); _applyingHist=false;
    _currentProjKey=d.projKey||null; _savedSnap=d.savedSnap||null;
    if(typeof updateSB==='function') updateSB();
    _checkDirty();
    return true;
  }catch(_){ _applyingHist=false; return false; }
}
function slSync(fieldId, val){
  const num=document.getElementById(fieldId);
  const rng=document.getElementById(fieldId+'_r');
  if(num && num!==event?.target) num.value=val;
  if(rng && rng!==event?.target) rng.value=val;
}

// Kopf-Exzentrizität auf die Aussenkante begrenzen: der Fundamentkopf darf nicht über den
// Block bzw. das Bankett hinausragen → |e| ≤ (Aussenmass − Kopfmass)/2. Geklemmter Wert wird
// ins Feld (und einen etwaigen Slider) zurückgeschrieben. bx/kx = Aussen-/Kopfmass quer, by/ky längs.
function _clampKopfEcc(bxId,kxId,byId,kyId,exId,eyId){
  const g=id=>+((document.getElementById(id)||{}).value)||0;
  const exMax=Math.max(0,(g(bxId)-g(kxId))/2), eyMax=Math.max(0,(g(byId)-g(kyId))/2);
  const cl=(id,mx)=>{ const el=document.getElementById(id); if(!el) return; const v=+el.value||0;
    const c=Math.max(-mx,Math.min(mx,v)); if(Math.abs(c-v)>1e-9){ el.value=c.toFixed(2);
      const r=document.getElementById(id+'_r'); if(r) r.value=c; } };
  cl(exId,exMax); cl(eyId,eyMax);
}

// ── Eingaben mit Einheit m app-weit auf 2 Dezimalstellen anzeigen ────────────────
// Erkennung über das Einheiten-<em> im Feld-Label (exakt "m", nicht mm/kN/m³/MN/m² …).
function _isMeterField(el){
  const f = el.closest && el.closest('.field'); if(!f) return false;
  const em = f.querySelector('label em');
  return !!em && em.textContent.trim() === 'm';
}
function formatMeterInputs(root){
  (root||document).querySelectorAll('input[type=number]').forEach(el=>{
    if(el.value==='' || !_isMeterField(el)) return;
    const num = parseFloat(el.value);
    if(isFinite(num)) el.value = num.toFixed(2);
  });
}
// Formatierung bei Fokusverlust/Änderung (nicht während des Tippens) — auch nach Slider-Loslassen
document.addEventListener('change', e=>{
  const el = e.target; if(!el || !el.tagName) return;
  if(el.tagName==='INPUT' && el.type==='number' && el.value!=='' && _isMeterField(el)){
    const num = parseFloat(el.value); if(isFinite(num)) el.value = num.toFixed(2);
  } else if(el.classList && el.classList.contains('sl-rng')){
    const num = document.getElementById(el.id.replace(/_r$/,''));
    if(num && _isMeterField(num)){ const v = parseFloat(num.value); if(isFinite(v)) num.value = v.toFixed(2); }
  }
});
// Dezenter Highlight Vermassung ↔ Eingabe: Fokus eines Geometriefeldes (oder Slider _r) markiert das
// zugehörige Mass-Label im 3D (und das Feld selbst). KEINE Kamerafahrt/Ausgrauen.
document.addEventListener('focusin', e=>{
  const el=e.target; if(!el || el.tagName!=='INPUT'){ return; }
  let id=el.id||''; if(id.endsWith('_r')) id=id.slice(0,-2);
  if(typeof _setActiveDim==='function') _setActiveDim(id);
});
document.addEventListener('focusout', e=>{
  const el=e.target; if(!el || el.tagName!=='INPUT') return;
  setTimeout(()=>{ const a=document.activeElement;
    let aid=(a && a.tagName==='INPUT' && a.id)?(a.id.endsWith('_r')?a.id.slice(0,-2):a.id):'';
    if(typeof _setActiveDim==='function' && (!aid || !_vlEls.some(o=>o.field===aid))) _setActiveDim(null);
  }, 60);
});
let drag=false, panning=false, pm={x:0,y:0}, _downXY=null, _moved=false;
let sph={t:0.6,p:1.0,r:12};
let _camTarget=new THREE.Vector3(0,0,0);   // Kamera-Blickpunkt (Default Ursprung; Kamerafahrt schwenkt ihn aufs Bauteil)
let _panOff=new THREE.Vector3(0,0,0);      // manueller Pan-Versatz (Mittlere Maustaste / Zwei-Finger) — Welt-Koord.
let _drawerShiftCur=0, _drawerShiftTarget=0, _drawerRAF=null;  // Modell-Verschiebung (px) wenn Nachweis-Schublade offen
// Weltdistanz pro Bildschirm-Pixel auf Höhe des Blickpunkts (für Pan + Schublade-Shift)
function _worldPerPixel(r){ const dom=renderer&&renderer.domElement, H=Math.max(1,(dom&&dom.clientHeight)||1);
  return camera&&camera.isOrthographicCamera ? (1.1*r)/H : (2*r*Math.tan(22*Math.PI/180))/H; }
// Kamera-Rechts-Vektor (Bildschirm-x) aus Blickrichtung
function _camRight(camPos,T){ const f=T.clone().sub(camPos).normalize();
  return new THREE.Vector3().crossVectors(f,new THREE.Vector3(0,1,0)).normalize(); }
let _camRAF=null;                          // laufende Kamerafahrt (requestAnimationFrame-Handle)
let _pendingFit=true;                       // Gesamtmodell EINMAL rahmen (Erststart/Modellwechsel), nicht bei jedem Rebuild
let _vlEls=[];
let _activeDimField=null;   // aktuell dezent hervorgehobenes Mass (Feld-id) — Vermassung ↔ Eingabe
// Dezenter Highlight: Mass-Label(s) zum Feld id markieren (und Spiegelung am Eingabefeld via Klasse).
function _setActiveDim(id){
  const has = id && _vlEls.some(o=>o.field===id);
  _activeDimField = has ? id : null;
  document.querySelectorAll('.vl.vl-active').forEach(e=>e.classList.remove('vl-active'));
  document.querySelectorAll('input.dim-active').forEach(e=>e.classList.remove('dim-active'));
  if(has){
    _vlEls.forEach(o=>{ if(o.field===id) o.el.classList.add('vl-active'); });
    const f=document.getElementById(id); if(f) f.classList.add('dim-active');
  }
}
function _vlClear(){_vlEls.forEach(o=>o.el.remove());_vlEls=[];}
function _vlAdd(text,pos3d,cls,field){
  const el=document.createElement('div');
  el.className='vl '+cls; el.textContent=text;
  if(field && field===_activeDimField) el.classList.add('vl-active');   // Highlight über Rebuilds halten
  // Klickbare Vermassung: Label blendet das zugehörige Eingabefeld ein (dimInteractive ODER Kamerafahrt)
  const _vz=(typeof vizStyle==='function')?vizStyle():{};
  if(field && _vz.dimInteractive){
    el.style.cursor='pointer'; el.style.pointerEvents='auto'; el.title='Klicken: Eingabefeld anpassen';
    el.classList.add('vl-click');
    el.addEventListener('click',e=>{ e.stopPropagation(); vizFocusField(field); });
  }
  document.getElementById('viewer').appendChild(el);
  _vlEls.push({el,pos:pos3d.clone(),field});
}
// Eingabefeld zu einer geklickten Vermassung/Bauteil einblenden + fokussieren (Sidebar/Tab/Feld)
function vizFocusField(id){
  const el=document.getElementById(id); if(!el) return;
  if(typeof _setActiveDim==='function') _setActiveDim(id);   // dezenter Highlight sofort (unabhängig vom focusin)
  // Geometrie-Tab aktivieren (Felder liegen alle im Geometrie-Tab) + auf Mobil Eingabe-Pane zeigen
  if(typeof switchTab==='function' && _FIELD_COMP && _FIELD_COMP[id]) try{ switchTab('geometrie'); }catch(_){ }
  if(window.innerWidth<768 && typeof mobSwitch==='function') mobSwitch('input');
  try{ el.scrollIntoView({behavior:'smooth',block:'center'}); }catch(_){ }
  setTimeout(()=>{ el.focus(); if(el.select) try{el.select();}catch(_){ }
    el.style.transition='box-shadow .2s'; el.style.boxShadow='0 0 0 2px var(--acc)';
    setTimeout(()=>{ el.style.boxShadow=''; },900); },180);
}
// Dynamischer Zoom: Distanz so wählen, dass das Modell formatfüllend ist (origin-zentriert)
function fitCameraToModel(){
  if(typeof scene==='undefined' || !scene || !camera) return;
  const g=scene.getObjectByName('pb3d')||scene.getObjectByName('blk'); if(!g) return;
  if(_camTarget) _camTarget.set(0,0,0);   // Gesamtmodell wieder origin-zentriert rahmen
  const box=new THREE.Box3().setFromObject(g); if(box.isEmpty()) return;
  const cs=[[box.min.x,box.min.y,box.min.z],[box.max.x,box.max.y,box.max.z],
    [box.min.x,box.min.y,box.max.z],[box.min.x,box.max.y,box.min.z],[box.max.x,box.min.y,box.min.z],
    [box.max.x,box.max.y,box.min.z],[box.max.x,box.min.y,box.max.z],[box.min.x,box.max.y,box.max.z]];
  let rad=1.5; cs.forEach(c=>{ rad=Math.max(rad, Math.hypot(c[0],c[1],c[2])); });
  const dist = camera.isOrthographicCamera ? rad*2.2
             : rad/Math.sin(((camera.fov||44)/2)*Math.PI/180)*1.12;
  sph.r=Math.max(3, Math.min(70, dist)); moveCam();
}
function _vlUpdate(){
  if(!camera)return;
  const vEl=document.getElementById('viewer');
  const W=vEl.clientWidth||vEl.offsetWidth, H=vEl.clientHeight||vEl.offsetHeight;
  const tmp=new THREE.Vector3();
  _vlEls.forEach(({el,pos})=>{
    tmp.copy(pos).project(camera);
    const isFrc = el.classList.contains('vl-frc');
    const isDim = el.classList.contains('vl-dim');
    if(tmp.z>1 || (isFrc&&!showText) || (isDim&&!showDim)){el.style.display='none';return;}
    el.style.display='';
    el.style.left=((tmp.x*.5+.5)*W)+'px';
    el.style.top= ((-.5*tmp.y+.5)*H)+'px';
  });
  _vlEntzerren();
  updateAxisWidget();
}

// Überlappende Beschriftungen auseinanderschieben (Bildschirmebene). Liegen zwei Labels
// übereinander, wandert das untere nach unten — bei kleinem Modell (Pfahlfundament mit langen
// Pfählen) oder flachem Blickwinkel fielen sonst mehrere Masse und Lastwerte auf einen Fleck.
// Die 3D-Ankerpunkte bleiben, verschoben wird nur die Anzeige; wenige Durchgänge genügen.
function _vlEntzerren(){
  const items=[];
  _vlEls.forEach(({el})=>{ if(el.style.display==='none') return;
    const w=el.offsetWidth, h=el.offsetHeight; if(!w||!h) return;
    items.push({el, x:parseFloat(el.style.left)||0, y:parseFloat(el.style.top)||0, w, h}); });
  if(items.length<2) return;
  items.sort((a,b)=>a.y-b.y);
  const PAD=3;
  for(let pass=0; pass<4; pass++){
    let moved=false;
    for(let i=0;i<items.length;i++) for(let j=i+1;j<items.length;j++){
      const a=items[i], b=items[j];
      // Labels sind um ihren Ankerpunkt zentriert (CSS translate(-50%,-50%))
      const dx=Math.abs(a.x-b.x), dy=b.y-a.y;
      if(dx < (a.w+b.w)/2+PAD && Math.abs(dy) < (a.h+b.h)/2+PAD){
        b.y = a.y + (a.h+b.h)/2 + PAD; moved=true;
      }
    }
    if(!moved) break;
    items.sort((a,b)=>a.y-b.y);
  }
  items.forEach(it=>{ it.el.style.top=it.y+'px'; });
}
function updateAxisWidget(){
  const w=document.getElementById('axis-widget');
  if(!w||!camera)return;
  const S=220, L=80, C=S/2;
  const ox=50, oy=S-50; // Ursprung unten-links im SVG
  // App-Achsen in Three.js-Coords: x→(1,0,0), y→(0,0,-1), z→(0,1,0)
  const axes=[
    {v:new THREE.Vector3(1,0,0),  col:'#7c8de0', lbl:'x'},
    {v:new THREE.Vector3(0,0,-1), col:'#6fcf8e', lbl:'y'},
    {v:new THREE.Vector3(0,1,0),  col:'#9a9caa', lbl:'z'},
  ];
  const cr=new THREE.Vector3(), cu=new THREE.Vector3();
  camera.matrixWorld.extractBasis(cr, cu, new THREE.Vector3());
  const cf=new THREE.Vector3(); camera.getWorldDirection(cf);
  // Sortiere nach Tiefe damit vordere Achsen zuletzt (oben) gezeichnet werden
  const sorted=axes.map(a=>({...a, depth:a.v.dot(cf)})).sort((a,b)=>b.depth-a.depth);
  let svg=`<svg width="${S}" height="${S}" style="display:block">`;
  for(const a of sorted){
    const ex=ox+a.v.dot(cr)*L, ey=oy-a.v.dot(cu)*L;
    const dx=ex-ox, dy=ey-oy, dl=Math.sqrt(dx*dx+dy*dy)||1;
    const px=-dy/dl*4, py=dx/dl*4;
    svg+=`<line x1="${ox}" y1="${oy}" x2="${ex}" y2="${ey}" stroke="${a.col}" stroke-width="2.5" stroke-linecap="round"/>`;
    svg+=`<polygon points="${ex+dx/dl*5},${ey+dy/dl*5} ${ex-dx/dl*8+px},${ey-dy/dl*8+py} ${ex-dx/dl*8-px},${ey-dy/dl*8-py}" fill="${a.col}"/>`;
    const lx=ox+a.v.dot(cr)*(L+16), ly=oy-a.v.dot(cu)*(L+16);
    svg+=`<text x="${lx}" y="${ly+4}" fill="${a.col}" font-family="monospace" font-size="13" font-weight="700" text-anchor="middle">${a.lbl}</text>`;
  }
  svg+='</svg>';
  w.innerHTML=svg;
}

// Render-Pixelratio: bei niedrigem devicePixelRatio (Standard-Monitore, DPR<1.5)
// auf 2× supersamplen → Raster-/Vermassungslinien werden scharf statt schwammig.
// DPR≥1.5 (Surface, Mobile) unverändert min(DPR,2). Obergrenze 2 (Performance).
function _viewerPR(){ const d = window.devicePixelRatio || 1; return d < 1.5 ? 2 : Math.min(d, 2); }

function initViewer(){
  const el=document.getElementById('viewer');
  scene=new THREE.Scene();
  scene.background=new THREE.Color(SETTINGS.theme==='light'?0xe8e8ee:0x090a0d);

  // Use offsetWidth/Height — reliable on Android WebView
  const W = el.offsetWidth  || window.innerWidth;
  const H = el.offsetHeight || (window.innerHeight - 106);

  camera=new THREE.PerspectiveCamera(44, W/H, 0.1, 200);
  moveCam();
  renderer=new THREE.WebGLRenderer({antialias:true, powerPreference:'high-performance', preserveDrawingBuffer:true});
  renderer.setPixelRatio(_viewerPR());
  renderer.setSize(W, H);
  renderer.shadowMap.enabled=true;
  el.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0x8899bb,0.9));
  const d=new THREE.DirectionalLight(0xffffff,1.5); d.position.set(7,14,9); d.castShadow=true; scene.add(d);
  const d2=new THREE.DirectionalLight(0xaabbdd,0.3); d2.position.set(-8,4,-6); scene.add(d2);
  const _lt2=SETTINGS.theme==='light';
  const _gh=new THREE.GridHelper(20,20,_lt2?0x8898b0:0x2e3040,_lt2?0xa0a8bc:0x252635); _gh.name='grid';
  _gh.material.transparent=true; _gh.material.opacity=_lt2?0.45:0.25; scene.add(_gh);
  // Achsanzeige wird in rebuildScene gebaut

  // Mouse
  el.addEventListener('mousedown',e=>{_cancelCamFly(false);
    if(e.button===1){ e.preventDefault(); panning=true; pm={x:e.clientX,y:e.clientY}; return; }  // Mittlere Taste = Ausschnitt schieben
    drag=true;pm={x:e.clientX,y:e.clientY};_downXY={x:e.clientX,y:e.clientY};_moved=false;});
  el.addEventListener('mouseup',e=>{ if(panning){panning=false;return;} drag=false; if(_downXY && !_moved) _viewerClick(e.clientX,e.clientY); _downXY=null; });
  el.addEventListener('mouseleave',()=>{drag=false;panning=false;_downXY=null;});
  el.addEventListener('mousemove',e=>{
    if(panning){ _panCamera(e.clientX-pm.x, e.clientY-pm.y); pm={x:e.clientX,y:e.clientY}; return; }
    if(!drag)return;
    if(_downXY && Math.hypot(e.clientX-_downXY.x,e.clientY-_downXY.y)>4) _moved=true;
    sph.t-=(e.clientX-pm.x)*0.01;
    sph.p=Math.max(0.1,Math.min(Math.PI/2-0.05,sph.p+(e.clientY-pm.y)*0.01));
    pm={x:e.clientX,y:e.clientY};moveCam();
  });
  el.addEventListener('auxclick',e=>{ if(e.button===1) e.preventDefault(); });   // Mittelklick-Autoscroll unterdrücken
  el.addEventListener('wheel',e=>{_cancelCamFly(false);sph.r=Math.max(3,Math.min(42,sph.r+e.deltaY*0.02));moveCam();},{passive:true});

  // Touch — pinch-to-zoom + pan
  let t0=null, pinch0=null, mid0=null;
  const _mid=tt=>({x:(tt[0].clientX+tt[1].clientX)/2, y:(tt[0].clientY+tt[1].clientY)/2});
  el.addEventListener('touchstart',e=>{
    e.preventDefault(); _cancelCamFly(false);
    if(e.touches.length===1){t0={x:e.touches[0].clientX,y:e.touches[0].clientY}; pinch0=null; mid0=null; _downXY={x:e.touches[0].clientX,y:e.touches[0].clientY}; _moved=false;}
    if(e.touches.length===2){
      const dx=e.touches[0].clientX-e.touches[1].clientX;
      const dy=e.touches[0].clientY-e.touches[1].clientY;
      pinch0=Math.sqrt(dx*dx+dy*dy); mid0=_mid(e.touches); t0=null;
    }
  },{passive:false});
  el.addEventListener('touchmove',e=>{
    e.preventDefault();
    if(e.touches.length===1&&t0){
      if(_downXY && Math.hypot(e.touches[0].clientX-_downXY.x,e.touches[0].clientY-_downXY.y)>6) _moved=true;
      sph.t-=(e.touches[0].clientX-t0.x)*0.012;
      sph.p=Math.max(0.1,Math.min(Math.PI/2-0.05,sph.p+(e.touches[0].clientY-t0.y)*0.012));
      t0={x:e.touches[0].clientX,y:e.touches[0].clientY};moveCam();
    }
    if(e.touches.length===2&&pinch0!==null){
      const dx=e.touches[0].clientX-e.touches[1].clientX;
      const dy=e.touches[0].clientY-e.touches[1].clientY;
      const dist=Math.sqrt(dx*dx+dy*dy);
      sph.r=Math.max(3,Math.min(42,sph.r-(dist-pinch0)*0.04));
      pinch0=dist;
      const m=_mid(e.touches);                          // Zwei-Finger-Mittelpunkt verschieben = Ausschnitt schieben
      if(mid0){ _panCamera(m.x-mid0.x, m.y-mid0.y); } mid0=m;
      moveCam();
    }
  },{passive:false});
  el.addEventListener('touchend',e=>{ if(_downXY && !_moved && t0) _viewerClick(_downXY.x,_downXY.y); t0=null;pinch0=null;mid0=null;_downXY=null; });

  // ResizeObserver — most reliable way on mobile
  if(window.ResizeObserver){
    new ResizeObserver(()=>resizeViewer()).observe(el);
  }
  window.addEventListener('resize', resizeViewer);

  applyCameraMode(); applyGridStyle();   // gespeicherten Kamera-/Raster-Stil (SETTINGS.viz) anwenden
  rebuildScene();
  // Render-on-Demand: nur rendern, wenn sich Kamera/Szene geändert hat (_renderDirty).
  // Spart auf Feldgeräten (Android) massiv Akku — vorher lief renderer.render 60×/s im Leerlauf.
  (function loop(){requestAnimationFrame(loop);
    if(_renderDirty){ _renderDirty=false; renderer.render(scene,camera); _vlUpdate(); }})();
}

let _renderDirty = true;                              // erster Frame rendert immer
function invalidateViewer(){ _renderDirty = true; }   // von moveCam/rebuildScene/... gesetzt

function moveCam(){const{t,p,r}=sph; const b=_camTarget||{x:0,y:0,z:0};
  // Blickpunkt inkl. manuellem Pan-Versatz — Kamera + Blickpunkt bleiben am Modell (Orbit-Drehpunkt zentral)
  const T=new THREE.Vector3(b.x+_panOff.x, b.y+_panOff.y, b.z+_panOff.z);
  const camPos=new THREE.Vector3(T.x+r*Math.sin(p)*Math.sin(t), T.y+r*Math.cos(p), T.z+r*Math.sin(p)*Math.cos(t));
  camera.position.copy(camPos);
  const dom=renderer&&renderer.domElement, W=(dom&&dom.clientWidth)||0, H=(dom&&dom.clientHeight)||0;
  if(camera.isOrthographicCamera){const asp=W?W/H:1.6,d=r*0.55;
    camera.left=-d*asp;camera.right=d*asp;camera.top=d;camera.bottom=-d;}
  // Nachweis-Schublade offen → Bild um _drawerShiftCur px nach links schieben als LINSEN-/View-Offset
  // (nicht die Kamera verschieben!) → Modell wandert in den sichtbaren Bereich, der Orbit-Drehpunkt
  // bleibt aber auf dem Modell (zentral), statt in den leeren, verdeckten Raum zu wandern.
  if(Math.abs(_drawerShiftCur)>0.5 && W>0){ camera.setViewOffset(W,H,_drawerShiftCur,0,W,H); }
  else if(camera.view && camera.view.enabled){ camera.clearViewOffset(); }
  else { camera.updateProjectionMatrix(); }
  camera.lookAt(T.x,T.y,T.z);
  invalidateViewer();}
// Manueller Pan (Mittlere Maustaste / Zwei-Finger): Blickpunkt entlang Bildschirm-x/-y verschieben
function _panCamera(dx,dy){
  const{t,p,r}=sph, b=_camTarget||{x:0,y:0,z:0};
  const T=new THREE.Vector3(b.x+_panOff.x,b.y+_panOff.y,b.z+_panOff.z);
  const camPos=new THREE.Vector3(T.x+r*Math.sin(p)*Math.sin(t),T.y+r*Math.cos(p),T.z+r*Math.sin(p)*Math.cos(t));
  const right=_camRight(camPos,T), up=new THREE.Vector3().crossVectors(right,T.clone().sub(camPos).normalize()).normalize();
  const wpp=_worldPerPixel(r);
  _panOff.add(right.multiplyScalar(-dx*wpp)).add(up.multiplyScalar(dy*wpp));   // Inhalt folgt der Maus
  moveCam();
}
// Schublade-Shift sanft animieren (Modell aus dem von der Schublade verdeckten Bereich schieben)
function _animateDrawerShift(){
  if(_drawerRAF) cancelAnimationFrame(_drawerRAF);
  (function step(){
    _drawerShiftCur += (_drawerShiftTarget-_drawerShiftCur)*0.2;
    if(Math.abs(_drawerShiftTarget-_drawerShiftCur)<0.5) _drawerShiftCur=_drawerShiftTarget;
    moveCam();
    _drawerRAF = Math.abs(_drawerShiftTarget-_drawerShiftCur)>0.4 ? requestAnimationFrame(step) : null;
  })();
}
// Beide Overlay-Schubladen (Eingabe links, Nachweise rechts) → Modell-View-Offset setzen, damit das
// Modell mittig im SICHTBAREN Bereich bleibt (halbe Schubladenbreite je Seite). Nur ≥768px (Overlay);
// mobil sind es Tabs. Rechts schiebt das Bild nach links (+), links nach rechts (−) → Netto-Versatz.
function setViewerDrawerShift(immediate){
  const desktop = window.innerWidth>=768;
  const ws=_wsEl?_wsEl():document.querySelector('.workspace');
  const pr=document.getElementById('panel-results'), pi=document.getElementById('panel-input');
  const rOpen = desktop && ws && ws.classList.contains('res-open');
  const rW = (rOpen && pr) ? pr.offsetWidth : 0;
  // Eingabe-Schublade immer sichtbar (Overlay); Breite = Ziel-Spaltenbreite --col-l (nicht das während
  // der Breiten-Transition nachhinkende offsetWidth → Controls/Modell zielen sofort auf die Endbreite).
  const colL = desktop && ws ? (parseFloat(getComputedStyle(ws).getPropertyValue('--col-l'))||0) : 0;
  const iW = (desktop && pi) ? colL : 0;
  _drawerShiftTarget = Math.max(0, rW*0.5) - Math.max(0, iW*0.5);
  // Viewer-Overlay-Controls mitschieben (rechts über --drawer-w, links über --inp-w) → klickbar halten
  const viewer=document.getElementById('viewer');
  if(viewer){ viewer.style.setProperty('--drawer-w', rW+'px'); viewer.style.setProperty('--inp-w', iW+'px'); }
  if(immediate){ _drawerShiftCur=_drawerShiftTarget; if(typeof moveCam==='function') moveCam(); }
  else _animateDrawerShift();
}
// Kamerafahrt abbrechen (wenn der Nutzer selbst dreht/zoomt) — optional Target zurück auf Ursprung
function _cancelCamFly(resetTarget){ if(_camRAF){ cancelAnimationFrame(_camRAF); _camRAF=null; }
  if(resetTarget && _camTarget) _camTarget.set(0,0,0); }
// ── Bauteil-Fokus: Highlight durch AUSGRAUEN der übrigen Bauteile (kein Pulsieren) ──────────
// Feld → Komponente (Bauteil). Solange ein Feld eines Bauteils aktiv ist, bleibt dieses normal,
// die übrigen werden ausgegraut; die Kamera rahmt den Fundamentkörper (Pfähle dürfen abschneiden).
const _FIELD_COMP = {
  g_bx:'block', g_by:'block', g_hblock:'block', g_uberd:'block',
  g_kx:'kopf', g_ky:'kopf', g_hkopf:'kopf',
  pb_bx:'bankett', pb_by:'bankett', pb_bank_d:'bankett', pb_ue:'bankett',
  pb_hk:'kopf', pb_kx:'kopf', pb_ky:'kopf', pb_L:'pile'
};
// Raycaster: Klick auf ein Bauteil im 3D → zugehöriges Eingabefeld einblenden (nur „Vermassung klickbar").
// KEINE Kamerafahrt, KEIN Ausgrauen der übrigen Bauteile (auf Nutzerwunsch entfernt).
const _ray=new THREE.Raycaster(), _ndc=new THREE.Vector2();
function _viewerPick(cx,cy){ if(!scene||!camera) return null;
  const el=document.getElementById('viewer'); if(!el) return null; const r=el.getBoundingClientRect();
  _ndc.x=((cx-r.left)/r.width)*2-1; _ndc.y=-((cy-r.top)/r.height)*2+1; _ray.setFromCamera(_ndc,camera);
  const tg=[]; scene.traverse(o=>{ if(o.isMesh && o.userData && Array.isArray(o.userData.ffields) && o.userData.ffields.length) tg.push(o); });
  const h=_ray.intersectObjects(tg,false); return h.length?h[0].object:null; }
function _viewerClick(cx,cy){ if(!vizStyle().dimInteractive) return;
  const m=_viewerPick(cx,cy);
  if(m && m.userData.ffields && m.userData.ffields.length && typeof vizFocusField==='function') vizFocusField(m.userData.ffields[0]); }
// Kamera-Modus aus VIZ: perspektivisch (Default) oder isometrisch (orthographisch)
function applyCameraMode(){
  if(typeof scene==='undefined'||!scene||!renderer||!camera) return;
  const iso=vizStyle().cameraIso===true, isOrtho=!!camera.isOrthographicCamera;
  if(iso===isOrtho){ moveCam(); return; }
  const dom=renderer.domElement, asp=(dom.clientWidth||1)/Math.max(1,dom.clientHeight||1);
  if(iso){ const d=(typeof sph!=='undefined'?sph.r:12)*0.55; camera=new THREE.OrthographicCamera(-d*asp,d*asp,d,-d,0.1,400); }
  else   { camera=new THREE.PerspectiveCamera(44,asp,0.1,200); }
  moveCam();
}
// ── VIZ-Optionen schreiben/laden (Optionen-Overlay → SETTINGS.viz) ───────────
function _vizHex(n){ return '#'+((n>>>0)&0xffffff).toString(16).padStart(6,'0'); }
function setViz(key,val){ SETTINGS.viz=Object.assign({},SETTINGS.viz); SETTINGS.viz[key]=val;
  dbSet('bc_settings',SETTINGS);
  if(key==='cameraIso') applyCameraMode();
  applyGridStyle(); rebuildScene(); }
function setVizColor(key,hex){ setViz(key, parseInt(hex.replace('#',''),16)); }
function setVizLayer(idx,hex){ const a=((SETTINGS.viz&&SETTINGS.viz.layer)||VIZ_DEFAULTS.layer).slice();
  a[idx]=parseInt(hex.replace('#',''),16); setViz('layer',a); }
function loadVizUI(){ const C=vizStyle();
  const sc=(id,v)=>{const e=document.getElementById(id); if(e) e.value=v;};
  const ck=(id,v)=>{const e=document.getElementById(id); if(e) e.checked=!!v;};
  sc('viz-concrete',_vizHex(C.concrete)); sc('viz-pile',_vizHex(C.pile));
  sc('viz-druck',_vizHex(C.druck)); sc('viz-zug',_vizHex(C.zug));
  sc('viz-forceN',_vizHex(C.forceN)); sc('viz-forceH',_vizHex(C.forceH)); sc('viz-moment',_vizHex(C.moment));
  sc('viz-solidOp', Math.round((C.solidOp||0.85)*100));
  { const e=document.getElementById('viz-solidOp-v');
    if(e) e.textContent = Math.round((C.solidOp||0.85)*100)+' %'; }
  ck('viz-grid', C.gridShow!==false);
  ck('viz-diminter', C.dimInteractive===true);
  sc('viz-iso-sel', C.cameraIso===true?'iso':'persp');
  (C.layer||VIZ_DEFAULTS.layer).forEach((c,i)=>sc('viz-layer'+i,_vizHex(c)));
}
function resetVizStyle(){ SETTINGS.viz={}; dbSet('bc_settings',SETTINGS); loadVizUI(); applyCameraMode(); applyGridStyle(); rebuildScene(); }
function clr(n){const o=scene.getObjectByName(n);if(o)scene.remove(o);}

// ── Zentrale 3D-Vermassung (einheitlich für Block / Flach / Pfahlfundament) ───────────────
// Misst zwischen zwei Bauteilpunkten a,b; die Masslinie liegt um n·off versetzt, mit
// Hilfslinien vom Bauteil und 45°-Endmarken. EIN Abstand (DIM3_OFF) für alle Typen.
const DIM3_OFF=0.5, DIM3_LBL=0.20, DIM3_TICK=0.07, DIM3_OVER=0.05, DIM3_RAD=0.006;
const _DIM_YUP=new THREE.Vector3(0,1,0);
let _DIM_GRP=null, _DIM_MAT=null, _DIM_TMAT=null;       // Container + (Mesh-)Material für dicke Masslinien
// Theme-bewusste Vermassungsfarbe: Nutzer-Override gewinnt, sonst hell→dunkel / dunkel→weiss
function _dimColor(){
  if(typeof SETTINGS!=='undefined' && SETTINGS.viz && SETTINGS.viz.dim!=null) return SETTINGS.viz.dim;
  return (document.documentElement.getAttribute('data-theme')==='light')?0x70727e:0xffffff;
}
function _dimBegin(grp, mat){ _DIM_GRP=grp; _DIM_MAT=mat;
  // dicke Masslinien als dünne Zylinder (WebGL/Android ignorieren linewidth) → MeshBasic aus der Linienfarbe
  _DIM_TMAT=new THREE.MeshBasicMaterial({color:mat.color.clone(), opacity:(mat.opacity!=null?mat.opacity:0.85), transparent:true}); }
function _dim3(a, b, n, opt){
  if(!_DIM_GRP||!_DIM_TMAT) return;
  opt=opt||{};
  const off=opt.off ?? DIM3_OFF, nn=n.clone().normalize();
  const a2=a.clone().add(nn.clone().multiplyScalar(off));
  const b2=b.clone().add(nn.clone().multiplyScalar(off));
  const L=(p,q)=>{ const dir=q.clone().sub(p), len=dir.length(); if(len<1e-6) return;
    const m=new THREE.Mesh(new THREE.CylinderGeometry(DIM3_RAD,DIM3_RAD,len,5), _DIM_TMAT);
    m.position.copy(p.clone().add(q).multiplyScalar(0.5));
    m.quaternion.setFromUnitVectors(_DIM_YUP, dir.normalize());
    _DIM_GRP.add(m); };
  L(a2,b2);                                              // Masslinie
  const ov=nn.clone().multiplyScalar(DIM3_OVER);
  L(a, a2.clone().add(ov)); L(b, b2.clone().add(ov));    // Hilfslinien (vom Bauteil, knapp über die Masslinie)
  const dir=b2.clone().sub(a2).normalize();
  const slash=dir.clone().add(nn).normalize().multiplyScalar(DIM3_TICK);   // 45°-Endmarke in der Massebene
  L(a2.clone().sub(slash), a2.clone().add(slash));
  L(b2.clone().sub(slash), b2.clone().add(slash));
  if(opt.label) _vlAdd(opt.label, a2.clone().lerp(b2,0.5).add(nn.clone().multiplyScalar(opt.lblGap ?? DIM3_LBL)), 'vl-dim', opt.field);
}

// Moment-Bogen-Pfeil als TubeGeometry (sichtbar als 3D-Rohr)
function mkMomArc(grp,pos,axis,M,col,angleOffset=0){
  if(Math.abs(M)<0.01)return null;
  const n=axis.clone().normalize();
  let u=new THREE.Vector3(0,1,0);
  if(Math.abs(n.dot(u))>0.8)u.set(1,0,0);
  const v1=new THREE.Vector3().crossVectors(n,u).normalize();
  const v2=new THREE.Vector3().crossVectors(n,v1).normalize();
  const r=0.80;
  const sign=M>=0?1:-1;
  const arc=Math.PI*0.85;
  const steps=32;
  const pts=[];
  for(let i=0;i<=steps;i++){
    const a=sign*(arc/steps*i-arc/2)+angleOffset;
    pts.push(pos.clone().add(v1.clone().multiplyScalar(Math.cos(a)*r).add(v2.clone().multiplyScalar(Math.sin(a)*r))));
  }
  const curve=new THREE.CatmullRomCurve3(pts);
  const mat=new THREE.MeshLambertMaterial({color:col,transparent:true,opacity:0.85});
  grp.add(new THREE.Mesh(new THREE.TubeGeometry(curve,steps,0.045,6,false),mat));
  const ep=pts[pts.length-1],pp=pts[pts.length-2];
  const tang=ep.clone().sub(pp).normalize();
  const co=new THREE.Mesh(new THREE.ConeGeometry(0.10,0.24,8),new THREE.MeshLambertMaterial({color:col}));
  co.position.copy(ep);co.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),tang);
  grp.add(co);
  return {start:pts[0], end:ep};
}

// ── 3D-Modell Pfahlfundament: Bankett + geneigte Pfähle + Bodenschichten + σ'v-Spannungs-
//    profil + Kraftvektoren (Pfahl-Axialkräfte Druck/Zug + resultierende Last am Sockel).
//    Szene-Koordinaten: x = quer (pile.x), z = längs (pile.y), y = vertikal (GOK=0, abwärts neg.).
//    Pfahlkräfte aus RESULT.pfahlbock.viz (von renderPfahlbock gesetzt); Geometrie steht auch ohne.
function buildPfahlbockViz(){
  const _ein=_pbEinzel();                                        // Einzelpfahl: ohne Bankett/Kopf
  const n=_ein ? 1 : (+gi('pb_n')||4), sx=+gi('pb_sx')||1.2, sy=+gi('pb_sy')||1.2;
  const ax=_ein ? 0 : (+gi('pb_ax')||0), ay=_ein ? 0 : (+gi('pb_ay')||0);
  const L=Math.max(0.5,+gi('pb_L')||10);
  const ueber=_ein ? Math.max(0,+gi('pb_e')||0) : 0;             // Überstand über GOK (freie Länge, nur Einzelpfahl)
  // Einzelpfahl: Querschnitt aus dem Profil-Katalog (HEB/Krinner) → laterale Breite/Form; sonst Verpresskörper-Ø
  const _profShape=_ein ? pfahlSection((document.getElementById('pb_prof')||{}).value||'HEB200') : null;
  const dG=(_ein && _profShape) ? Math.max(0.05,_profShape.b) : Math.max(0.05,(+gi('pb_dG')||150)/1000);
  const dBank=_ein ? 0 : Math.max(0.2,+gi('pb_bank_d')||0.8);
  const ue=_ein ? 0 : Math.max(0,+gi('pb_ue')||0);               // Überdeckung über OK Bankett
  const kx=_ein ? 0 : Math.max(0,+gi('pb_kx')||0), ky=_ein ? 0 : Math.max(0,+gi('pb_ky')||0),
        hKopf=_ein ? 0 : Math.max(0,+gi('pb_hk')||0);
  const exK=_ein ? 0 : (+gi('pb_ex')||0), eyK=_ein ? 0 : (+gi('pb_ey')||0);   // Kopf-Exzentrizität quer(x)/längs(z)
  const piles=_pbPileLayout(n,sx,sy).map(p=>({x:p.x,y:p.y,..._pbIncl(p,ax,ay)}));
  const Bbank=_ein ? 0.6 : Math.max(0.3,+gi('pb_bx')||2.0), Lbank=_ein ? 0.6 : Math.max(0.3,+gi('pb_by')||2.0);
  const yBankTop=_ein ? ueber : -ue, yUK=_ein ? ueber : -ue-dBank;   // Pfahlkopf-Niveau (Einzel: Überstand über GOK; Gruppe: UK Bankett)
  const Lviz=_ein ? (ueber+L) : L;                               // gezeichnete Pfahllänge (Einzel: Überstand + Einbindung)
  const _lt=document.documentElement.getAttribute('data-theme')==='light';
  const _dim=showStr||showVec;
  const grp=new THREE.Group(); grp.name='pb3d';
  const viz=_vcPbViz((RESULT.pfahlbock&&RESULT.pfahlbock.viz)||{}); const pr=viz.pileRes||null;
  const C=vizStyle();   // zentrale Darstellungs-Farben (Block-Konvention, via SETTINGS.viz konfigurierbar)

  // ── Bankett (OK an −ü, eingebettet) + Fundamentkopf darauf (ragt durch GOK)
  const matBank=new THREE.MeshLambertMaterial({color:_dim?C.concreteDim:C.concrete,transparent:true,opacity:_dim?C.ghostOp:C.solidOp});
  const edgeMat=new THREE.LineBasicMaterial({color:_dim?C.edgeDim:C.edge,transparent:true,opacity:0.6});
  const addBox=(w,h,d,cy,ffields,ox,oz)=>{ ox=ox||0; oz=oz||0; const g=new THREE.BoxGeometry(w,h,d);
    const m=new THREE.Mesh(g, ffields?matBank.clone():matBank); m.position.set(ox,cy,oz);
    if(ffields) m.userData.ffields=ffields; grp.add(m);
    const ed=new THREE.LineSegments(new THREE.EdgesGeometry(g),edgeMat.clone()); ed.position.set(ox,cy,oz);
    grp.add(ed); };
  // Einzelpfahl: weder Bankett noch Kopf — der Pfahlkopf liegt auf GOK (yUK = 0)
  if(!_ein){
    addBox(Bbank,dBank,Lbank, yBankTop-dBank/2, ['pb_bx','pb_by','pb_bank_d','pb_ue']);  // Bankett (OK an −ü)
    if(hKopf>0.01 && kx>0.01 && ky>0.01) addBox(kx,hKopf,ky, yBankTop+hKopf/2, ['pb_hk','pb_kx','pb_ky'], exK, eyK);  // Fundamentkopf auf Bankett (exzentrisch e_x/e_y)
  }

  // ── Pfähle — Zylinder (Verpresskörper/Krinner-Rundrohr) bzw. I-Profil (Einzelpfahl HEB), eingefärbt nach Druck/Zug
  const yAxis=new THREE.Vector3(0,1,0);
  piles.forEach((p,i)=>{
    const tx=Math.tan(p.axDeg*Math.PI/180), ty=Math.tan(p.ayDeg*Math.PI/180), Ln=Math.hypot(tx,ty,1);
    const head=new THREE.Vector3(p.x,yUK,p.y);
    const foot=new THREE.Vector3(p.x+Lviz*tx/Ln, yUK-Lviz/Ln, p.y+Lviz*ty/Ln);
    const dv=new THREE.Vector3().subVectors(foot,head), len=dv.length();
    // Neutrale Tragglied-Farbe; ausgegraut wenn Vektoren/Spannungen aktiv (Druck/Zug steckt in den Pfeilen)
    const pcol=_dim?C.pileDim:C.pile, pOp=_dim?C.ghostOp:C.solidOp;
    const pMat=new THREE.MeshLambertMaterial({color:pcol,transparent:true,opacity:pOp});
    if(_ein && _profShape && !_profShape.round){
      // HEB-I-Profil (Einzelpfahl senkrecht): 2 Flansche + Steg entlang der Pfahlachse (Steg-Höhe = X, Breite = Z)
      const ph=_profShape.h, pb=_profShape.b, tw=_profShape.tw, tf=_profShape.tf, hw=Math.max(0.001,ph-2*tf);
      const sub=new THREE.Group(); sub.position.copy(head).addScaledVector(dv,0.5);
      const eM=new THREE.LineBasicMaterial({color:_dim?C.edgeDim:C.edge,transparent:true,opacity:0.6});
      [[tf,len,pb,ph/2-tf/2],[tf,len,pb,-(ph/2-tf/2)],[hw,len,tw,0]].forEach(([w,l,d,dx])=>{
        const g=new THREE.BoxGeometry(w,l,d), m=new THREE.Mesh(g,pMat); m.position.set(dx,0,0); sub.add(m);
        const ed=new THREE.LineSegments(new THREE.EdgesGeometry(g),eM.clone()); ed.position.set(dx,0,0); sub.add(ed);
      });
      grp.add(sub);
    } else {
      const cyl=new THREE.Mesh(new THREE.CylinderGeometry(dG/2,dG/2,len,(_profShape&&_profShape.round)?16:12),pMat);
      cyl.position.copy(head).addScaledVector(dv,0.5);
      cyl.quaternion.setFromUnitVectors(yAxis, dv.clone().normalize());
      cyl.userData.ffields=['pb_L'];
      grp.add(cyl);
    }
  });

  // ── GOK / Terrain (inkl. Böschung — wie Block-Viewer; Slope in +x = Feldseite)
  if(showGnd){
    const gndMatP=new THREE.MeshBasicMaterial({color:_lt?C.terrainLight:C.terrain,transparent:true,opacity:0.4,side:THREE.DoubleSide,depthWrite:false});
    const _bBeta=+gi('bg_beta')||0, _bBtyp=(document.getElementById('bg_btyp')||{}).value||'none',
          _bFuss=Math.max(0,+gi('bg_bfuss')||0), _bH=Math.max(0,+gi('bg_bhoehe')||0);
    const gW=Bbank+4, gD=Lbank+4, hzP=gD/2;
    if(_bBtyp!=='none' && Math.abs(_bBeta)>0.1){
      const betaR=_bBeta*Math.PI/180, sDir=betaR>0?1:-1, tanB=Math.tan(Math.abs(betaR));
      const flatEnd=Bbank/2+_bFuss;
      // ebener Teil bis zum Böschungsfuss
      const fm=new THREE.Mesh(new THREE.PlaneGeometry(flatEnd+gW/2, gD), gndMatP);
      fm.rotation.x=-Math.PI/2; fm.position.set((flatEnd-gW/2)/2,0.02,0); grp.add(fm);
      // Böschungsfläche (bei h_β>0 auf Böschungshöhe begrenzt)
      const slopeLen=_bH>0.05 && tanB>0.001 ? Math.min(12,Math.max(0.3,_bH/tanB)) : 4;
      const dx=slopeLen, dyv=tanB*slopeLen*sDir, fx=flatEnd;
      const sGeo=new THREE.BufferGeometry();
      sGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array([fx,0.02,-hzP, fx+dx,dyv,-hzP, fx+dx,dyv,hzP, fx,0.02,hzP]),3));
      sGeo.setIndex(new THREE.BufferAttribute(new Uint16Array([0,1,2,0,2,3]),1)); sGeo.computeVertexNormals();
      grp.add(new THREE.Mesh(sGeo,gndMatP));
      const bfMatP=new THREE.LineBasicMaterial({color:0x7888a0,opacity:0.65,transparent:true});
      grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(fx,0.03,-hzP),new THREE.Vector3(fx,0.03,hzP)]),bfMatP));
      // Plateau (2. Ebene) bei h_β>0
      if(_bH>0.05 && tanB>0.001){
        const px0=fx+dx, px1=fx+dx+3.5;
        const pG=new THREE.BufferGeometry();
        pG.setAttribute('position',new THREE.BufferAttribute(new Float32Array([px0,dyv,-hzP,px1,dyv,-hzP,px1,dyv,hzP,px0,dyv,hzP]),3));
        pG.setIndex(new THREE.BufferAttribute(new Uint16Array([0,1,2,0,2,3]),1)); pG.computeVertexNormals();
        grp.add(new THREE.Mesh(pG,gndMatP));
        grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(px0,dyv+0.01,-hzP),new THREE.Vector3(px0,dyv+0.01,hzP)]),bfMatP));
        if(showDim) _vlAdd(`h_β = ${_bH.toFixed(1)} m`, new THREE.Vector3(px0+0.6,dyv+0.3,hzP+0.3),'vl-dim');
      }
      if(showDim) _vlAdd(`β = ${_bBeta}°`, new THREE.Vector3(fx+dx/2,dyv/2+0.3,hzP+0.3),'vl-dim');
    } else {
      const gMesh=new THREE.Mesh(new THREE.PlaneGeometry(gW,gD), gndMatP);
      gMesh.rotation.x=-Math.PI/2; gMesh.position.y=0.02; grp.add(gMesh);
    }
  }

  // ── Bodenschichten (Horizontflächen auf der −x-Seite, mit Tiefen-Labels)
  if(showLyr){
    const lyrCols=C.layer;
    const EXT=Math.max(Bbank,Lbank)/2+2.5; let ly=0;
    SCHICHTEN.forEach((s,i)=>{
      const thick=s.d===999?Math.max(2.5,(ue+dBank+L)-ly+1.0):s.d, col=lyrCols[i%lyrCols.length];
      if(i>0){ const pl=new THREE.Mesh(new THREE.PlaneGeometry(EXT,EXT),
          new THREE.MeshLambertMaterial({color:col,transparent:true,opacity:0.20,side:THREE.DoubleSide,depthWrite:false}));
        pl.rotation.x=-Math.PI/2; pl.position.set(-EXT/2,-ly,0); grp.add(pl); }
      const depBot=s.d===999?'∞':(ly+s.d).toFixed(1);
      _vlAdd(`${s.name}  ${ly.toFixed(1)}–${depBot} m`,new THREE.Vector3(-EXT-0.1,-(ly+Math.min(thick,(ue+dBank+L)-ly)/2),-EXT/2+0.3),'vl-dim');
      ly+=thick;
    });
  }

  // ── σ'v(z)-Spannungsprofil — NUR Layer «Spannungen»: kompaktes Profil mit Tiefenachse +
  //    Werte-Marken an Schichtgrenzen / GW / Basis (statt grosser freistehender Fläche)
  if(showStr){
    const zmax=ue+dBank+L, Nseg=24;
    const sig=z=>{ try{ return Math.max(0,sigVeffTo(Math.max(0,z))); }catch(_){ return 0; } };
    const sMax=Math.max(1,sig(zmax)), wScale=0.8/sMax;
    // xB klar RECHTS der Pfahl-Spreizung (Fuss-Max in x) → kein Überlappen der Pfähle
    const footMaxX=Math.max(Bbank/2, ...piles.map(p=>{ const tx=Math.tan(p.axDeg*Math.PI/180), ty=Math.tan(p.ayDeg*Math.PI/180), Ln=Math.hypot(tx,ty,1); return Math.abs(p.x+L*tx/Ln); }));
    const xB=footMaxX+0.7, zPl=0, col=C.sigma, X=z=>xB+sig(z)*wScale;
    // Tiefenachse (Bezugslinie an OK)
    grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(xB,0,zPl),new THREE.Vector3(xB,-zmax,zPl)]),
      new THREE.LineBasicMaterial({color:col,transparent:true,opacity:0.6})));
    // gefülltes Profil + Umriss
    const sh=new THREE.Shape(); sh.moveTo(xB,0);
    for(let k=0;k<=Nseg;k++){ const z=zmax*k/Nseg; sh.lineTo(X(z),-z); }
    sh.lineTo(xB,-zmax); sh.closePath();
    const sMesh=new THREE.Mesh(new THREE.ShapeGeometry(sh),
      new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.28,side:THREE.DoubleSide,depthWrite:false}));
    sMesh.position.set(0,0,zPl); grp.add(sMesh);
    const outPts=[]; for(let k=0;k<=Nseg;k++){ const z=zmax*k/Nseg; outPts.push(new THREE.Vector3(X(z),-z,zPl)); }
    grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(outPts),new THREE.LineBasicMaterial({color:col,transparent:true,opacity:0.75})));
    // Werte-Marken an Schichtgrenzen + GW + Basis
    const marks=[0]; let lyd=0;
    SCHICHTEN.forEach(s=>{ if(s.d!==999){ lyd+=s.d; if(lyd<zmax-0.05) marks.push(lyd); } });
    const gw=(typeof gwDepth==='function')?gwDepth():Infinity; if(isFinite(gw)&&gw>0.05&&gw<zmax) marks.push(gw);
    marks.push(zmax);
    marks.forEach(z=>{ const xv=X(z);
      grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(xB,-z,zPl),new THREE.Vector3(xv,-z,zPl)]),
        new THREE.LineBasicMaterial({color:col,transparent:true,opacity:0.5})));
      _vlAdd(sig(z).toFixed(0)+' kPa',new THREE.Vector3(xv+0.1,-z,zPl),'vl-frc'); });
    _vlAdd("σ'v(z)",new THREE.Vector3(xB,0.18,zPl),'vl-dim');
  }

  // ── Layer «Vektoren» (showVec = resultierende Kräfte): Pfahl-Reaktionskräfte Druck/Zug
  if(showVec && pr){ const Fmax=Math.max(1,...pr.map(q=>Math.abs(q.F||0))), fSc=1.4/Fmax;
      piles.forEach((p,i)=>{ const F=pr[i]?pr[i].F:0; if(!F||Math.abs(F)<0.5) return;
        const tx=Math.tan(p.axDeg*Math.PI/180), ty=Math.tan(p.ayDeg*Math.PI/180), Ln=Math.hypot(tx,ty,1);
        const axisDown=new THREE.Vector3(tx/Ln,-1/Ln,ty/Ln).normalize();
        const zug=pr[i].zug||F<0, dir=zug?axisDown.clone().negate():axisDown;
        const len=Math.max(0.4,Math.min(2.2,Math.abs(F)*fSc)), origin=new THREE.Vector3(p.x,yUK,p.y);
        grp.add(new THREE.ArrowHelper(dir,origin,len,new THREE.Color(zug?C.zug:C.druck),len*0.22,dG*1.6));
        // Reaktionskraft-Label auf die Vektormitte
        _vlAdd('P'+(i+1)+'  '+(F<0?'−':'')+Math.abs(F).toFixed(0)+' kN',
          origin.clone().addScaledVector(dir,len/2).add(new THREE.Vector3(dG*1.6+0.05,0,0)),'vl-frc'); });
  }
  // ── Layer «Einwirkungen» (showLabels, wie Block): Mastlasten N/H/M am Kopf
  if(showLabels){
    // Stil/Farben 1:1 vom Blockfundament; Werte k/d wie Block
    const glD=viz.govLoad||{}, topY=yBankTop+hKopf, S_MIN=0.55, S_MAX=2.0;
    const isChar=(typeof _gztCharMode!=='undefined')&&_gztCharMode, sfx=isChar?'k':'d';
    const glL=(isChar&&viz.govLoadChar)?viz.govLoadChar:glD;   // angezeigte Werte (Pfeilgrösse bleibt Bemessung)
    // Vertikal-Vektor = MASTLAST ohne Bankett/Kopf-Eigengewicht (wie Block). Grösse aus char. Mastlast
    // (stabil beim k/d-Umschalten, analog NG_/50 beim Block); Label k/d je nach Modus.
    const Hx=glD.Hx||0, Hy=glD.Hy||0, Hmag=Math.hypot(Hx,Hy);
    const mN=viz.mastN||{k:Math.abs(glD.N||0), d:Math.abs(glD.N||0)};
    const nDisp=Math.abs(isChar?(mN.k||0):(mN.d||0)), nSizeV=Math.abs(mN.k||0);
    if(Math.max(nSizeV,nDisp)>0.5){ const s=Math.max(S_MIN,Math.min(S_MAX,nSizeV/50)), m=new THREE.MeshLambertMaterial({color:C.forceN});
      const cy=new THREE.Mesh(new THREE.CylinderGeometry(0.032,0.032,s,8),m); cy.position.set(exK,topY+s/2+0.15,eyK); grp.add(cy);
      const co=new THREE.Mesh(new THREE.ConeGeometry(0.09,0.25,8),m); co.position.set(exK,topY+0.07,eyK); co.rotation.z=Math.PI; grp.add(co);
      _vlAdd('N'+sfx+' = '+nDisp.toFixed(0)+' kN',new THREE.Vector3(exK+0.4,topY+s/2+0.15,eyK),'vl-frc'); }
    if(Hmag>0.5){ const s=Math.max(S_MIN,Math.min(S_MAX,Hmag/35)), d=new THREE.Vector3(Hx,0,Hy).normalize();
      const m=new THREE.MeshLambertMaterial({color:C.forceH}), q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d), base=new THREE.Vector3(exK,topY,eyK);
      const cy=new THREE.Mesh(new THREE.CylinderGeometry(0.032,0.032,s*1.4,8),m); cy.position.copy(base.clone().add(d.clone().multiplyScalar(s*0.7))); cy.applyQuaternion(q); grp.add(cy);
      const co=new THREE.Mesh(new THREE.ConeGeometry(0.09,0.25,8),m); co.position.copy(base.clone().add(d.clone().multiplyScalar(s*1.4))); co.applyQuaternion(q); grp.add(co);
      _vlAdd('H = '+Math.hypot(glL.Hx||0,glL.Hy||0).toFixed(0)+' kN',base.clone().add(d.clone().multiplyScalar(s*1.4+0.4)),'vl-frc'); }
    // Mast-Moment am OK Kopf (MxApp/MyApp) — wie Block, OHNE H·Hebel-Transfer auf UK Bankett
    const Mx=(glD.MxApp!==undefined?glD.MxApp:glD.Mx)||0, My=(glD.MyApp!==undefined?glD.MyApp:glD.My)||0, Mres=Math.hypot(Mx,My);
    if(Mres>0.5 && typeof mkMomArc==='function'){
      const axisRes=new THREE.Vector3(Mx,0,-My).normalize();
      const arc=mkMomArc(grp,new THREE.Vector3(exK,topY+0.1,eyK),axisRes,Mres,C.moment,-Math.PI/2);
      const MxL=(glL.MxApp!==undefined?glL.MxApp:glL.Mx)||0, MyL=(glL.MyApp!==undefined?glL.MyApp:glL.My)||0;
      if(arc&&arc.start) _vlAdd('M'+sfx+' = '+Math.hypot(MxL,MyL).toFixed(0)+' kNm',arc.start.clone().add(new THREE.Vector3(0.45,0.55,0.25)),'vl-frc');
    }
  }

  // ── Vermassung (zentral via _dim3 — identische Abstände/Hilfslinien wie Block)
  if(showDim){
    _dimBegin(grp, new THREE.LineBasicMaterial({color:_dimColor(),opacity:C.dimOp,transparent:true}));
    const V=(x,y,z)=>new THREE.Vector3(x,y,z);
    if(_ein){
      // Einzelpfahl: kein Bankett → nur Überstand (falls vorhanden) über GOK + Einbindelänge L vermassen
      const xr=dG/2;
      if(ueber>0.01) _dim3(V(xr,0,0), V(xr,ueber,0), V(1,0,0), {label:'Überstand = '+ueber.toFixed(2)+' m', field:'pb_e'});
      _dim3(V(xr,0,0), V(xr,-L,0), V(1,0,0), {off:DIM3_OFF+0.7, label:'L = '+L.toFixed(2)+' m', field:'pb_L'});
    } else {
      const yb=yBankTop;
      // B (x) vorne · L Bankett (z) links-aussen — auf OK-Bankett-Ebene
      _dim3(V(-Bbank/2,yb,Lbank/2), V(Bbank/2,yb,Lbank/2), V(0,0,1), {label:'B = '+Bbank.toFixed(2)+' m', field:'pb_bx'});
      _dim3(V(-Bbank/2,yb,-Lbank/2), V(-Bbank/2,yb,Lbank/2), V(-1,0,0), {off:DIM3_OFF+0.7, label:'L = '+Lbank.toFixed(2)+' m', field:'pb_by'});
      // Links-innen vertikale Kette (z=0): H_Kopf (oben) + Bankettdicke d (unten) — neben der L-Bankett-Vermassung
      if(hKopf>0.01) _dim3(V(-Bbank/2,yBankTop,0), V(-Bbank/2,yBankTop+hKopf,0), V(-1,0,0), {label:'H_Kopf = '+hKopf.toFixed(2)+' m', field:'pb_hk'});
      _dim3(V(-Bbank/2,yBankTop,0), V(-Bbank/2,yUK,0), V(-1,0,0), {label:'d = '+dBank.toFixed(2)+' m', field:'pb_bank_d'});
      // Rechts vertikale Kette (z=0): ü (oben, GOK→OK Bankett) + Pfahllänge L (tief, aussen)
      if(ue>0.01) _dim3(V(Bbank/2,0,0), V(Bbank/2,yBankTop,0), V(1,0,0), {label:'ü = '+ue.toFixed(2)+' m', field:'pb_ue'});
      _dim3(V(Bbank/2,yUK,0), V(Bbank/2,yUK-L,0), V(1,0,0), {off:DIM3_OFF+0.7, label:'L = '+L.toFixed(2)+' m', field:'pb_L'});
    }
  }

  scene.add(grp);
}

function rebuildScene(){
  invalidateViewer();   // Szene ändert sich → nächster Frame rendert (Render-on-Demand)
  try{ syncLFSel(); }catch(_){}   // gezeigter Lastfall/Kombination folgt dem Ergebnis
  const bx=+gi('g_bx'),by=+gi('g_by'),hb=+gi('g_hblock');
  const kx=+gi('g_kx'),ky=+gi('g_ky'),hk=+gi('g_hkopf');
  _clampKopfEcc('g_bx','g_kx','g_by','g_ky','g_ex','g_ey');   // Kopf innerhalb Blockkante halten
  const ex=+gi('g_ex'),ey=+gi('g_ey');
  const ue=Math.max(0,+gi('g_uberd')||0);  // Überdeckung
  ['blk','gnd','lyr','arH','arN','arM','axs','spl','vec','dim','pfahl3d','pb3d'].forEach(clr);
  // Auflasten-Pfeile aus vorherigem Frame entfernen (feste Obergrenze → kein Hängenbleiben nach Löschen)
  for(let _i=0;_i<20;_i++) clr('arAuf'+_i);
  _vlClear();
  // Legende je Modus: Pfahlfundament eigene Einträge, sonst Block/Flach
  const _isPb=CALC_MODEL==='pfahlbock';
  const _lgB=document.getElementById('lg-block'), _lgP=document.getElementById('lg-pfahlbock');
  if(_lgB) _lgB.style.display=_isPb?'none':''; if(_lgP) _lgP.style.display=_isPb?'':'none';
  applyGridStyle();   // Raster-Stil (VIZ) — beide Modi
  // Pfahlfundament: eigenes 3D-Modell statt Block/Flach (Bankett + geneigte Pfähle + σ'v + Kräfte)
  if(_isPb){ try{ buildPfahlbockViz(); if(_pendingFit){_pendingFit=false; fitCameraToModel();} }catch(err){ console.error('buildPfahlbockViz:', err); } updateSB(); return; }
  const C=vizStyle();   // zentrales Darstellungs-Modul (auch Block liest jetzt hier, via SETTINGS.viz konfigurierbar)
  const bg=new THREE.Group();bg.name='blk';
  // Block: sitzt ue unterhalb GOK
  const bGeo=new THREE.BoxGeometry(bx,hb,by);
  const _dimMode=showStr||showVec;
  const bCol=_dimMode?C.concreteDim:C.concrete, bOp=_dimMode?C.ghostOp:C.solidOp;
  const bMesh=new THREE.Mesh(bGeo,new THREE.MeshLambertMaterial({color:bCol,transparent:true,opacity:bOp}));
  // Block: Körper sitzt ü unter GOK (OK Block bei −ü, Sohle bei −(ü+H)).
  // Flach: ü = Einbindetiefe der Sohle → Sohle bei −ü, Platte ragt nach oben (bei ü=0 auf GOK).
  const _yBodyC = (CALC_MODEL==='flach') ? (-ue+hb/2) : (-ue-hb/2);
  bMesh.position.set(0,_yBodyC,0);bMesh.castShadow=true;bMesh.renderOrder=1;
  bMesh.userData.ffields=['g_bx','g_by','g_hblock','g_uberd'];bg.add(bMesh);
  const bEdgeCol=_dimMode?C.edgeDim:C.edge;
  const bEdge=new THREE.LineSegments(new THREE.EdgesGeometry(bGeo),new THREE.LineBasicMaterial({color:bEdgeCol,opacity:_dimMode?0.5:0.7,transparent:true}));
  bEdge.position.copy(bMesh.position);bg.add(bEdge);
  // Kopf: nur bei Block oder Beton-Flach (nicht bei Stahl-Platte)
  const _showKopf = CALC_MODEL==='block' || FLACH_MAT==='beton';
  // Kopf sitzt auf der Körper-Oberkante: Block OK Block (−ü), Flach OK Platte (−ü+H)
  const _yKopfBase = (CALC_MODEL==='flach') ? (-ue+hb) : -ue;
  // Gezeichnete Kopfhöhe = H_Kopf. KONVENTION (Aug 2026, wie in den übrigen Apps): H_Kopf ist die
  // GESAMTHÖHE des Kopfes von der Körper-Oberkante bis OK Kopf — beim Block also ab −ü, beim Flach
  // ab OK Platte. Der Überstand über Terrain ist H_Kopf − ü und keine Eingabegrösse mehr.
  // Der Kern rechnet konsistent: Eigengewicht B_Kopf·L_Kopf·H_Kopf, Hebelarm H_Block + H_Kopf.
  const _hKopfDraw = hk;
  if(_showKopf && kx>0.01 && ky>0.01 && _hKopfDraw>0.01){
    const kGeo=new THREE.BoxGeometry(kx,_hKopfDraw,ky);
    const kCol=_dimMode?C.concreteDim:C.concrete, kOp=_dimMode?C.ghostOp:C.solidOp;
    const kMesh=new THREE.Mesh(kGeo,new THREE.MeshLambertMaterial({color:kCol,transparent:true,opacity:kOp}));
    kMesh.position.set(ex,_yKopfBase+_hKopfDraw/2,ey);kMesh.castShadow=true;kMesh.renderOrder=1;
    kMesh.userData.ffields=['g_hkopf','g_kx','g_ky'];bg.add(kMesh);
    const kEdge=new THREE.LineSegments(new THREE.EdgesGeometry(kGeo),new THREE.LineBasicMaterial({color:C.edge,opacity:0.7,transparent:true}));
    kEdge.position.copy(kMesh.position);bg.add(kEdge);
  }
  // Auflasten (Stahl-Platte) als graue Quader auf der Platte
  if(CALC_MODEL==='flach' && FLACH_MAT==='stahl'){
    AUFLASTEN.forEach(a=>{
      if(a.Pk<=0 || a.active===false) return;  // inaktive Auflasten komplett ausblenden
      const asz=Math.max(0.1, Math.cbrt(a.Pk/25)*0.5);
      const aGeo=new THREE.BoxGeometry(asz,asz,asz);
      const aMesh=new THREE.Mesh(aGeo,new THREE.MeshLambertMaterial({color:0x888890}));
      aMesh.position.set(a.dx, -ue+hb+asz/2, -a.dy);
      bg.add(aMesh);
    });
  }
  scene.add(bg);
  // ── Bodenschichten als Horizontflächen (nur Schichtgrenzen, keine Volumenkörper)
  if(showLyr){
    const lyrGrp=new THREE.Group();lyrGrp.name='lyr';
    const lyrCols=C.layer;
    const EXT=5;   // halbe Ausdehnung der Horizontfläche [m]
    let ly=0;
    SCHICHTEN.forEach((s,i)=>{
      const thick=s.d===999?Math.max(2.5,hb-ly+1.5):s.d;
      const col=lyrCols[i%lyrCols.length];
      // Horizontfläche an der Schicht-Oberkante (Schicht 1 beginnt an GOK → Terrain vorhanden)
      // An der Blockmitte angesetzt (Halbfläche nach −x): Schnittlinie mit dem Block zeigt die Tiefe
      if(i>0){
        const pl=new THREE.Mesh(
          new THREE.PlaneGeometry(EXT,EXT),
          new THREE.MeshLambertMaterial({color:col,transparent:true,opacity:0.22,side:THREE.DoubleSide,depthWrite:false}));
        pl.rotation.x=-Math.PI/2;
        pl.position.set(-EXT/2,-ly,0);
        lyrGrp.add(pl);
        // Umriss
        lyrGrp.add(new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0,-ly,-EXT/2),    new THREE.Vector3(-EXT,-ly,-EXT/2),
            new THREE.Vector3(-EXT,-ly,EXT/2),  new THREE.Vector3(0,-ly,EXT/2),
            new THREE.Vector3(0,-ly,-EXT/2)]),
          new THREE.LineBasicMaterial({color:col,transparent:true,opacity:0.55})));
      }
      // Label mit Tiefenbereich (knapp unter der Schicht-Oberkante)
      const depBot=s.d===999?'∞':(ly+s.d).toFixed(1);
      _vlAdd(`${s.name}   ${ly.toFixed(1)} – ${depBot} m`,
        new THREE.Vector3(-bx/2-1.0,-ly-Math.min(thick/2,0.8),0.01),'vl-dim');
      ly+=thick;
    });
    scene.add(lyrGrp);
  }

  // ── Terrain (GOK + Böschung)
  if(showGnd){
    const gndGrp=new THREE.Group();gndGrp.name='gnd';
    const beta_deg=+gi('bg_beta'), bfuss=+gi('bg_bfuss'), btyp=gi('bg_btyp');
    const bhoehe=Math.max(0,+gi('bg_bhoehe')||0);   // Böschungshöhe bis 2. Ebene (0 = durchlaufend)
    const beta=beta_deg*Math.PI/180;
    const _lt=SETTINGS.theme==='light';
    const _gndCol = _lt ? C.terrainLight : C.terrain;
    const gndMat=new THREE.MeshBasicMaterial({color:_gndCol,transparent:true,opacity:0.45,side:THREE.DoubleSide,depthWrite:false});

    // Aushub-Parameter zuerst (bestimmen Terraingrösse in y)
    const d_ex_t   = showPfahl ? Math.max(0, +gi('pfahl_dex') || 0) : 0;
    const ex_s_t   = gi('pfahl_dex_seite') || 'gleis';
    const ex_sgn_t = ex_s_t === 'gleis' ? -1 : 1;
    const ex_ext   = bx/2 + 2.8;   // Ausdehnung der Aushubsohle in x
    const ex_len_t = by/2 + 2.5;   // halbe Länge des Aushubs in y (längs Gleis)
    const gndW=bx+2.5, gndD=by+2.5+(d_ex_t>0.05?4.5:0);
    // Hilfsfunktion: ShapeGeometry mit Aussparung — ein einziger Mesh, keine Nahtprobleme
    // Bei Flachfundament: Loch = Plattenfootprint (bx×by); bei Block: Loch = Kopf (kx×ky)
    const _isFlach = CALC_MODEL === 'flach';
    // Überdeckung aktiv (Fundament unter Erde) → keine Aussparung in der Geländefläche (Block UND Flach)
    const _uberdActive = ue > 0.001;
    const _holeOn = !_uberdActive;
    const holeW = _isFlach ? bx : kx;
    const holeD = _isFlach ? by : ky;

    const makeFlatMesh=(x0,x1,z0,z1,cy)=>{
      const sh=new THREE.Shape();
      sh.moveTo(x0,z0); sh.lineTo(x1,z0); sh.lineTo(x1,z1); sh.lineTo(x0,z1); sh.closePath();
      // Loch 1: Fundamentkopf / Platte (beim Block nur ohne aktive Überdeckung)
      const hx0=ex-holeW/2, hx1=ex+holeW/2, hz0=-ey-holeD/2, hz1=-ey+holeD/2;
      if(_holeOn && hx0>x0&&hx1<x1&&hz0>z0&&hz1<z1){
        const hole=new THREE.Path();
        hole.moveTo(hx0,hz0); hole.lineTo(hx0,hz1); hole.lineTo(hx1,hz1); hole.lineTo(hx1,hz0); hole.closePath();
        sh.holes.push(hole);
      }
      // Loch 2: Aushub (nur wenn aktiv)
      if(d_ex_t > 0.05){
        const ax0 = Math.min(ex_sgn_t * bx/2, ex_sgn_t * ex_ext);
        const ax1 = Math.max(ex_sgn_t * bx/2, ex_sgn_t * ex_ext);
        const ay0 = -ex_len_t;
        const ay1 =  ex_len_t;
        if(ax0 > x0 - 0.01 && ax1 < x1 + 0.01 && ay0 > z0 + 0.01 && ay1 < z1 - 0.01){
          const exHole = new THREE.Path();
          exHole.moveTo(ax0,ay0); exHole.lineTo(ax0,ay1); exHole.lineTo(ax1,ay1); exHole.lineTo(ax1,ay0); exHole.closePath();
          sh.holes.push(exHole);
        }
      }
      const geo=new THREE.ShapeGeometry(sh);
      const m=new THREE.Mesh(geo,gndMat);
      m.rotation.x=-Math.PI/2; m.position.y=cy; gndGrp.add(m);
    };
    if(btyp!=='none'&&Math.abs(beta_deg)>0.1){
      const flatEnd=bx/2+Math.max(0,bfuss);
      makeFlatMesh(-gndD/2, flatEnd, -gndD/2, gndD/2, 0.04);

      // Böschungsfläche als custom Quad — bei h_β > 0 auf Böschungshöhe begrenzt
      const sDir=beta>0?1:-1;
      const tanB=Math.tan(Math.abs(beta));
      const slopeLen = bhoehe>0.05 && tanB>0.001
        ? Math.min(12, Math.max(0.3, bhoehe/tanB))   // Länge bis 2. Ebene
        : 4;                                          // durchlaufend (bisheriges Verhalten)
      const dx=slopeLen, dy=tanB*slopeLen*sDir;
      const fx=flatEnd;
      const hz=gndD/2;
      const verts=new Float32Array([fx,0.01,-hz, fx+dx,dy,-hz, fx+dx,dy,hz, fx,0.01,hz]);
      const idx=new Uint16Array([0,1,2,0,2,3]);
      const sGeo=new THREE.BufferGeometry();
      sGeo.setAttribute('position',new THREE.BufferAttribute(verts,3));
      sGeo.setIndex(new THREE.BufferAttribute(idx,1));
      sGeo.computeVertexNormals();
      gndGrp.add(new THREE.Mesh(sGeo,gndMat));

      // Böschungsfuss-Linie
      const bfMat=new THREE.LineBasicMaterial({color:0x7888a0,opacity:0.65,transparent:true});
      const bfGeo=new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(fx,0.02,-hz),new THREE.Vector3(fx,0.02,hz)]);
      gndGrp.add(new THREE.Line(bfGeo,bfMat));

      // Zweite Ebene (Plateau) ab Böschungskopf, horizontal auf Höhe ±h_β
      if(bhoehe>0.05 && tanB>0.001){
        const platLen=3.5;
        const px0=fx+dx, px1=fx+dx+platLen;
        const pVerts=new Float32Array([px0,dy,-hz, px1,dy,-hz, px1,dy,hz, px0,dy,hz]);
        const pGeo=new THREE.BufferGeometry();
        pGeo.setAttribute('position',new THREE.BufferAttribute(pVerts,3));
        pGeo.setIndex(new THREE.BufferAttribute(new Uint16Array([0,1,2,0,2,3]),1));
        pGeo.computeVertexNormals();
        gndGrp.add(new THREE.Mesh(pGeo,gndMat));
        // Böschungskopf-Linie
        gndGrp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(px0,dy+0.01,-hz),new THREE.Vector3(px0,dy+0.01,hz)]),bfMat));
        if(showDim) _vlAdd(`h_β = ${bhoehe.toFixed(1)} m`,
          new THREE.Vector3(px0+0.6,dy+0.3,hz+0.3),'vl-dim');
      }

      // Label Böschung
      if(showDim) _vlAdd(`β = ${beta_deg}°`,new THREE.Vector3(fx+dx/2,dy/2+0.3,hz+0.3),'vl-dim');
    } else {
      makeFlatMesh(-gndW/2, gndW/2, -gndD/2, gndD/2, 0.04);
    }

    // ── Baugrundausschnitt (Grube) für Flachfundament ──────────────────
    // Nur Umriss an GOK (Plattenfootprint) — keine braunen Erdflächen mehr (Nutzerwunsch).
    if(_isFlach && (ue + hb) > 0.02){
      const px0 = ex - bx/2, px1 = ex + bx/2;
      const pz0 = ey - by/2, pz1 = ey + by/2;
      // Grubenkanten (Umriss an GOK)
      const edgeMat = new THREE.LineBasicMaterial({color: 0x7888a0, opacity: 0.8, transparent: true});
      const edgePts = [
        new THREE.Vector3(px0, 0.01, -pz0), new THREE.Vector3(px1, 0.01, -pz0),
        new THREE.Vector3(px1, 0.01, -pz1), new THREE.Vector3(px0, 0.01, -pz1),
        new THREE.Vector3(px0, 0.01, -pz0)
      ];
      gndGrp.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(edgePts), edgeMat
      ));
    }

    scene.add(gndGrp);
  }
  // ── Kraftpfeile: immer wenn showLabels aktiv (unabhängig von Sicherungsmodus)
  if(showLabels){
    const HGx_=+gi('l_HGx'),HGy_=+gi('l_HGy'),HWx_=+gi('l_HWx'),HWy_=+gi('l_HWy'),NG_=+gi('l_NG');
    const lfIdx=Math.min(_vcLfIdx, Math.max(0, LF.length-1));
    const lf_=LF[lfIdx]||LF[0];
    const c_=lf_.comp||{};
    const HGx=c_.HGx?HGx_:0, HGy=c_.HGy?HGy_:0;
    const HWx=c_.HWx?HWx_:0, HWy=c_.HWy?HWy_:0;
    const NG=(c_.NG??true)?NG_:0;
    const _kf=_vcFak(lf_), gG=_kf.fG, gW=_kf.fQ;
    const Hxd=gG*HGx+gW*HWx, Hyd=gG*HGy+gW*HWy;
    const Ht=Math.sqrt(Hxd**2+Hyd**2);
    const _gb=+gi('g_gbeton'),_ga=+gi('g_gauf'),_ue=Math.max(0,+gi('g_uberd')||0);
    const _kpf=document.getElementById('kopf_in_gk')?.checked!==false;
    const _kx=+gi('g_kx'),_ky=+gi('g_ky');
    // Nur Betonkörper (Block + Kopf inkl. ü-Bereich); seitliche Auffüllung zählt nicht zur ständigen Vertikallast (wie im Rechenkern).
  const _Gk=_gb*(bx*by*hb+(_kpf?_kx*_ky*hk:0));
    const Nd=_kf.fG*NG+_kf.fE*_Gk;   // gezeigte Kombination (Vorgabe: massgebende)
    const S_MIN=0.55, S_MAX=2.0; // Mindest- / Maximallänge Vektoren [m] (N kappt bei grossen Lasten, z. B. 150 kN)
    // OK Fundamentkopf (Lastangriff) in Welt-y — Einwirkung setzt IMMER hier an, inkl. Kopf-Exzentrizität (ex/ey).
    // Block: H_Kopf ist die Gesamthöhe ab OK Block → OK Kopf über GOK = H_Kopf − ü.
    // Flach: OK Platte (−ü+H_Platte) + H_Kopf (bei Stahl ohne Kopf = OK Platte).
    const okKopf = (CALC_MODEL==='flach') ? (-_ue + hb + hk) : (hk - _ue);
    if(Ht>0.001){
      const s=Math.max(S_MIN,Math.min(S_MAX,Ht/35));
      const d=new THREE.Vector3(Hxd,0,Hyd).normalize();
      const g=new THREE.Group();g.name='arH';
      const m=new THREE.MeshLambertMaterial({color:C.forceH});
      const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d);
      const base=new THREE.Vector3(ex,okKopf,ey);
      const cy=new THREE.Mesh(new THREE.CylinderGeometry(0.032,0.032,s*1.4,8),m);
      cy.position.copy(base.clone().add(d.clone().multiplyScalar(s*0.7)));cy.applyQuaternion(q);g.add(cy);
      const co=new THREE.Mesh(new THREE.ConeGeometry(0.09,0.25,8),m);
      co.position.copy(base.clone().add(d.clone().multiplyScalar(s*1.4)));co.applyQuaternion(q);g.add(co);scene.add(g);
    }
    if(NG_>0.001){
      const s=Math.max(S_MIN,Math.min(S_MAX,NG_/50));
      const g=new THREE.Group();g.name='arN';
      const m=new THREE.MeshLambertMaterial({color:C.forceN});
      const cy=new THREE.Mesh(new THREE.CylinderGeometry(0.032,0.032,s,8),m);cy.position.set(ex,okKopf+s/2+0.15,ey);g.add(cy);
      const co=new THREE.Mesh(new THREE.ConeGeometry(0.09,0.25,8),m);co.position.set(ex,okKopf+0.07,ey);co.rotation.z=Math.PI;g.add(co);scene.add(g);
    }
    // Auflasten: separate Pfeile pro Auflast (nur Stahl-Flachfundament)
    if(CALC_MODEL==='flach' && FLACH_MAT==='stahl' && AUFLASTEN.length){
      AUFLASTEN.forEach((a,ai)=>{
        if(a.Pk<=0 || a.active===false) return;  // inaktive Auflasten komplett ausblenden
        const mAuf=new THREE.MeshLambertMaterial({color:0x7a7a8a});
        const s=Math.max(S_MIN*0.85, Math.min(S_MAX,a.Pk/50));
        const grp=new THREE.Group(); grp.name='arAuf'+ai;
        // Pfeil von oben nach unten auf Plattenoberkante (y = -ue + hb/2 ≈ 0)
        const y_base = Math.max(0.05, -ue + hb);  // OK Platte
        const cy=new THREE.Mesh(new THREE.CylinderGeometry(0.028,0.028,s,8),mAuf);
        cy.position.set(a.dx, y_base+s/2+0.10, -a.dy);
        grp.add(cy);
        const co=new THREE.Mesh(new THREE.ConeGeometry(0.08,0.22,8),mAuf);
        co.position.set(a.dx, y_base+0.05, -a.dy);
        co.rotation.z=Math.PI;
        grp.add(co);
        scene.add(grp);
      });
    }
    // Force labels aktualisieren — k (charakteristisch) oder d (Bemessung)
    if(showLabels){
      const isChar = (typeof _gztCharMode !== 'undefined') && _gztCharMode;
      const sfx = isChar ? 'k' : 'd';
      if(Ht>0.001){
        const s=Math.max(S_MIN,Math.min(S_MAX,Ht/35));
        const d=new THREE.Vector3(Hxd,0,Hyd).normalize();
        const Hxk=HGx+HWx, Hyk=HGy+HWy;
        const Htk=Math.sqrt(Hxk**2+Hyk**2);
        const Hlbl = isChar ? Htk : Ht;
        _vlAdd(`H = ${Hlbl.toFixed(0)} kN`,
          new THREE.Vector3(ex,okKopf,ey).add(d.clone().multiplyScalar(s*1.4+0.4)),'vl-frc');
      }
      if(NG_>0.001){
        const s=Math.max(S_MIN,Math.min(S_MAX,NG_/50));
        // Vertikal-Vektor = reine MASTLAST (ohne Eigengewicht), wie Pfahlfundament: k=NG, d=γ_G·NG
        const Nlbl = isChar ? NG_ : (gG*NG);
        _vlAdd(`N${sfx} = ${Nlbl.toFixed(0)} kN`,new THREE.Vector3(ex+0.4,okKopf+s/2+0.15,ey),'vl-frc');
      }
      // Labels für Auflasten
      if(CALC_MODEL==='flach' && FLACH_MAT==='stahl'){
        AUFLASTEN.forEach((a,ai)=>{
          if(a.Pk<=0 || a.active===false) return;
          const s=Math.max(S_MIN*0.85,Math.min(S_MAX,a.Pk/50));
          const y_base=Math.max(0.05,-ue+hb);
          _vlAdd(`P${sfx}=${a.Pk.toFixed(0)} kN`,
            new THREE.Vector3(a.dx+0.25, y_base+s+0.25, -a.dy),'vl-frc');
        });
      }
    }
  } // end showLabels
  // Block-Spannungen + Kräftevektoren nur wenn Sicherung inaktiv
  if(!showPfahl && showStr && curResult()) buildStress();
  if(!showPfahl && showVec && curResult()) buildVectors();
  // Badge: bei inaktiver Sicherung zurücksetzen (wird von renderResults neu gesetzt)
  if(!showPfahl){ const b=document.getElementById('viewer-nw-badge'); if(b) b.style.display='none'; }
  const lgPfahl = document.getElementById('lg-pfahl');
  if(curModel().sicherung && showPfahl){
    buildPfahlViz();
    if(lgPfahl) lgPfahl.style.display = 'block';
  } else {
    if(lgPfahl) lgPfahl.style.display = 'none';
  }

  // ── Vermassung (zentral via _dim3 — einheitliche Abstände/Hilfslinien wie Pfahlfundament)
  if(showDim){
    const dg=new THREE.Group();dg.name='dim';
    _dimBegin(dg, new THREE.LineBasicMaterial({color:_dimColor(),opacity:C.dimOp,transparent:true}));
    const V=(x,y,z)=>new THREE.Vector3(x,y,z);
    const _flach=CALC_MODEL==='flach';
    // Bezugsebenen — Block: OK Block −ü, Sohle −(H+ü) · Flach: OK Platte −ü+H, Sohle −ü (ü=Einbindetiefe)
    const okPlane = _flach ? (-ue+hb) : -ue;   // Oberkante Körper
    const ukPlane = _flach ? -ue : -(hb+ue);   // Sohle
    const tGOK    = _flach ? ue : (hb+ue);     // Sohltiefe unter GOK
    const okKopf  = _flach ? (okPlane + hk) : (hk - ue);   // OK Kopf über GOK = H_Kopf − ü
    // B (x) vorne · L (z) rechts — auf der OK-Körper-Ebene
    _dim3(V(-bx/2,okPlane,by/2), V(bx/2,okPlane,by/2), V(0,0,1), {label:`B = ${bx.toFixed(2)} m`, field:'g_bx'});
    _dim3(V(bx/2,okPlane,-by/2), V(bx/2,okPlane,by/2), V(1,0,0), {label:`L = ${by.toFixed(2)} m`, field:'g_by'});
    // RECHTS vertikal (z=0): ü innen (GOK → OK Körper) · Einbindetiefe t aussen (GOK → Sohle).
    // Beide starten an der GOK → klassische Kette „Teilmass innen, Gesamtmass aussen".
    // Block: ü = Erdüberdeckung über OK Block. Flach: Erdüberdeckung über der Platte (ü−H, nur bei tiefer Einbindung).
    const _cover = _flach ? Math.max(0, ue-hb) : ue;
    if(_cover>0.01) _dim3(V(bx/2,0,0), V(bx/2,okPlane,0), V(1,0,0), {off:DIM3_OFF+0.7, label:`ü = ${_cover.toFixed(2)} m`, field:'g_uberd'});
    if(tGOK>0.005) _dim3(V(bx/2,0,0), V(bx/2,-tGOK,0), V(1,0,0), {off:DIM3_OFF+1.4, label:`t = ${tGOK.toFixed(2)} m`, field:_flach?'g_uberd':'g_hblock'});
    // LINKS vertikal (z=0): durchgehende Kette H_Kopf + H_Körper, beide ab OK Körper.
    // (ü stand früher hier innen — seit H_Kopf ab OK Block misst, liegen die beiden
    // Kettenmitten fast gleich hoch und die Labels überlagerten sich.)
    const _hkVon = _flach ? okPlane : -ue;   // H_Kopf ab OK Körper (Block: OK Block = −ü)
    if(hk>0.05) _dim3(V(-bx/2,_hkVon,0), V(-bx/2,okKopf,0), V(-1,0,0), {label:`H_Kopf = ${hk.toFixed(2)} m`, field:'g_hkopf'});
    // Körperhöhe H (OK → Sohle), gleiche Flucht wie H_Kopf → durchgehende Kette
    // (Label „H_Block"/„H_Platte", nicht „H" — „H" ist schon der Horizontalkraft-Vektor)
    _dim3(V(-bx/2,okPlane,0), V(-bx/2,ukPlane,0), V(-1,0,0), {label:`${_flach?'H_Platte':'H_Block'} = ${hb.toFixed(2)} m`, field:'g_hblock'});
    scene.add(dg);
  }

  updateAxisWidget();

  // ── Momentenbögen für selektierten LF — nur wenn Lasten-Layer aktiv
  if(showLabels){
    const MGx_=+gi('l_MGx'),MGy_=+gi('l_MGy'),MWx_=+gi('l_MWx'),MWy_=+gi('l_MWy');
    const lfIdx=Math.min(_vcLfIdx, Math.max(0, LF.length-1));
    const lf_=LF[lfIdx]||LF[0]; const c_=lf_.comp||{};
    const _kf=_vcFak(lf_), gG=_kf.fG, gW=_kf.fQ;
    const Mx=(c_.MGx?gG*MGx_:0)+(c_.MWx?gW*MWx_:0);
    const My=(c_.MGy?gG*MGy_:0)+(c_.MWy?gW*MWy_:0);
    const Mres=Math.sqrt(Mx*Mx+My*My);
    const gM=new THREE.Group();gM.name='arM';
    // OK Kopf inkl. Kopf-Exzentrizität (ex/ey); Flach: Platte (−ü+H) + H_Kopf.
    // Block: H_Kopf ist die Gesamthöhe ab OK Block → OK Kopf über GOK = H_Kopf − ü (wie N/H).
    const pos=new THREE.Vector3(ex, (CALC_MODEL==='flach'?(-ue+hb+hk):(hk-ue)), ey);
    // Resultierendes Moment: Drehachse = normierter Vektor aus Mx*(1,0,0) + My*(0,0,-1)
    let arcMres=null;
    if(Mres>0.5){
      const axisRes=new THREE.Vector3(Mx,0,-My).normalize();
      arcMres=mkMomArc(gM,pos,axisRes,Mres,C.moment,-Math.PI/2);
    }
    scene.add(gM);
    // Label — k/d je nach Modus
    {const isChar=(typeof _gztCharMode!=='undefined')&&_gztCharMode;
    const Mxk=(c_.MGx?MGx_:0)+(c_.MWx?MWx_:0);
    const Myk=(c_.MGy?MGy_:0)+(c_.MWy?MWy_:0);
    const Mresk=Math.sqrt(Mxk*Mxk+Myk*Myk);
    const sfx=isChar?'k':'d';
    const Mlbl=isChar?Mresk:Mres;
    if(arcMres&&Mlbl>0.5) _vlAdd(`M${sfx} = ${Mlbl.toFixed(0)} kNm`,
      arcMres.start.clone().add(new THREE.Vector3(0,0.15,0.15)),'vl-frc');}
  }

  if(_pendingFit){ _pendingFit=false; fitCameraToModel(); }
  updateSB();
}
const updateViewer=rebuildScene;

// Beide GZT-Ebenen (Spannungen, resultierende Kräfte) zeigen das Steckner-Bild — das gibt es
// NUR beim Blockfundament und nur für GZT-Lastfälle. Ohne diese Prüfung blieben die zuletzt
// gerechneten Block-Daten in window._gzt_* stehen und wurden nach einem Modellwechsel auf die
// Flach-Geometrie gezeichnet (Aug 2026: t=0.40 m zeigte den Drehpunkt eines 3.10-m-Blocks).
function _gztLayerHint(){
  if(!curModel().gl66){
    _vlAdd('Spannungsbild nur beim Blockfundament (Steckner Gl. 66)',
           new THREE.Vector3(0, 0.6, 0), 'vl-frc');
    return true;
  }
  const _lf = LF[Math.min(_vcLfIdx, Math.max(0, LF.length-1))];
  _vlAdd('Kein GZT-Ergebnis für «'+((_lf&&_lf.name)||'diesen Lastfall')+'» — Spannungsbild nur für GZT-Lastfälle',
         new THREE.Vector3(0, 0.6, 0), 'vl-frc');
  return true;
}

function _getGZTData(){
  if(!curModel().gl66) return null;
  const lfIdx=Math.min(_vcLfIdx, Math.max(0, LF.length-1));
  const lf=LF[lfIdx]; if(!lf) return null;
  const dat=window['_gzt_'+lf.name.replace(/\W/g,'_')];
  if(!(dat&&dat.R&&dat.G)) return null;
  // Einzelkombination gewählt → deren Erddrücke, Nulllinie und Sohlkräfte zeigen
  const k=_vcKomb>0 && dat.R.kombs_GZT && dat.R.kombs_GZT.find(x=>x.nr===_vcKomb);
  return {...dat, R: k ? gztKombView(dat.R,k) : dat.R, lf, lfIdx};
}

function buildStress(){
  clr('spl');
  if(!curResult()) return;
  const d=_getGZTData(); if(!d){ _gztLayerHint(); return; }
  const {R,G,lf}=d;
  const lfIdx=d.lfIdx;

  // ── Geometrie ─────────────────────────────────────────────────────
  const t = G.Hb, ue = G.ue, B = G.B, L = G.L;
  const y_nl = R.y_NL_GZT;           // Abstand NL von UK [m]

  // Three.js Y-Koordinaten (GOK = 0, nach unten negativ)
  const y_okb = -ue;                  // OK Block
  const y_nl3 = -(t - y_nl);         // Nulllinie
  const y_uk  = -t;                   // UK (Sohle)

  // ── Bodenparameter ────────────────────────────────────────────────
  const Ka  = R.Ka_GZT  || 0.291;
  const Kph = R.Kph_GZT || 4.807;   // λ_p  (Gl.28) — über der NL
  const Kpp = R.Kpp_GZT || 1.866;   // λ'_p (Gl.29) — REDUZIERT, unter der NL
  const K0  = R.K0_GZT  || 0.5;
  const gEp = R.gEp_GZT || 1.5;
  const gEa = R.gEa_GZT || 1.35;
  const mob = (R.mobEff_GZT != null ? R.mobEff_GZT : (R.mob_GZT || 0.25));   // folgt der mob-Option
  const gs  = R.gs_GZT  || (+gi('bg_gamma')||20);

  // ── Basis wie d/k-Toggle: k = charakteristisch (Start), d = Bemessung ──
  const isChar = (typeof _gztCharMode !== 'undefined') && _gztCharMode;
  const fEa = isChar ? 1 : gEa;      // aktiv: ×γ_Ea im d-Modus
  const fEp = isChar ? 1 : 1/gEp;    // passiv: /γ_Ep im d-Modus

  // ── Spannungen an Eckpunkten [kPa] ───────────────────────────────
  // Tiefe von GOK: z_okb = ue, z_nl = t-y_nl, z_uk = t
  const z_okb = ue, z_nl = t - y_nl, z_uk = t;
  const ea_okb  = Ka  * gs * z_okb * fEa;
  const ea_nl   = Ka  * gs * z_nl  * fEa;
  // Unter der NL wirkt λ'_p (Gl.29), nicht λ_p — wie in computeGZT_dir (mode 'pp')
  const epp_nl  = Kpp * gs * z_nl  * fEp;
  const epp_uk  = Kpp * gs * z_uk  * fEp;
  const Kmob = (K0 + mob*(Kph-K0)) * fEp;
  const ew_okb  = Kmob * gs * z_okb;
  const ew_nl   = Kmob * gs * z_nl;
  // E0 nach Gl.34/35 charakteristisch — kein γ-Faktor (in beiden Modi)
  const e0b_nl  = K0   * gs * z_nl;
  const e0b_uk  = K0   * gs * z_uk;

  // ── Skalierung: max σ → 0.7×B Visualbreite ────────────────────────
  const sigMax = Math.max(epp_uk, ea_nl, ew_nl, e0b_uk, 1);
  const sc = (B * 0.7) / sigMax;

  const grp = new THREE.Group(); grp.name = 'spl';

  // ── HTML-Label (wie Einwirkungs-Labels) ───────────────────────────
  function mkLbl(txt, x, y, z) {
    _vlAdd(txt, new THREE.Vector3(x,y,z), 'vl-frc');
  }

  // ── Druckkörper (Trapez-Fin) ──────────────────────────────────────
  // face_x: X-Position der Blockfläche
  // dir: +1 → Fin nach rechts (+x), -1 → Fin nach links (-x)
  // y_bot/y_top: vertikale Ausdehnung (Three.js Y)
  // sig_bot/sig_top: Spannung [kPa] an UK/OK der Zone
  // Gibt Eckpunkt-Daten zurück für Labels
  // axis 'x' = Stirnfläche (⊥ zur Last), axis 'z' = Seitenfläche (∥ zur Last, Gl.34/35).
  // `face` ist die Koordinate der Fläche, `dir` die Richtung der Auslenkung, `half` die halbe
  // Ausdehnung längs der Fläche.
  function makeFin(face, dir, y_bot, y_top, sig_bot, sig_top, hexCol, alpha, axis, half) {
    axis = axis || 'x';
    if(half == null) half = (axis === 'x') ? L/2 : B/2;
    const wb = sig_bot * sc * dir, wt = sig_top * sc * dir;
    const hL = half;
    // P(w, y, s): w = Auslenkung senkrecht zur Fläche, s = Lauf entlang der Fläche
    const P = (axis === 'x') ? (w,y,s)=>[face+w, y, s] : (w,y,s)=>[s, y, face+w];
    const v = new Float32Array([
      ...P(0, y_top,-hL), ...P(wt, y_top,-hL), ...P(wb, y_bot,-hL), ...P(0, y_bot,-hL),
      ...P(0, y_top, hL), ...P(wt, y_top, hL), ...P(wb, y_bot, hL), ...P(0, y_bot, hL),
    ]);
    const ix=[0,2,1,0,3,2, 4,5,6,4,6,7, 0,1,5,0,5,4, 3,6,2,3,7,6, 1,2,6,1,6,5];
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.BufferAttribute(v,3));
    geo.setIndex(ix); geo.computeVertexNormals();
    grp.add(new THREE.Mesh(geo,new THREE.MeshLambertMaterial(
      {color:new THREE.Color(hexCol),transparent:true,opacity:alpha,side:THREE.DoubleSide})));
    // Umriss vordere Fläche
    grp.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(...P(0, y_top,-hL)), new THREE.Vector3(...P(wt, y_top,-hL)),
        new THREE.Vector3(...P(wb, y_bot,-hL)), new THREE.Vector3(...P(0, y_bot,-hL)),
        new THREE.Vector3(...P(0, y_top,-hL)),
      ]),
      new THREE.LineBasicMaterial({color:new THREE.Color(hexCol),opacity:0.9,transparent:true})
    ));
    // Eckpunkte zurückgeben (Spannungsangabe nur am äusseren Rand). Seitenflächen liefern
    // zusätzlich z — der Label-Code setzt solche Beschriftungen auf x = 0.
    const zn = (y_top <= y_nl3 + 1e-6) ? 'b' : 'a';   // Zone des KÖRPERS (unter/über NL)
    return (axis === 'x')
      ? [{x:face+wt, y:y_top, sig:sig_top, col:hexCol, zone:zn},
         {x:face+wb, y:y_bot, sig:sig_bot, col:hexCol, zone:zn}]
      : [{x:0, z:face+wt, y:y_top, sig:sig_top, col:hexCol, zone:zn},
         {x:0, z:face+wb, y:y_bot, sig:sig_bot, col:hexCol, zone:zn}];
  }

  const cEa='#e05540', cEw='#4488cc', cEp='#44bb88', cE0='#888899', cNL='#ffcc44';
  // Dominante Lastrichtung bestimmen (wie in buildVectors)
  const _useX = Math.abs(R.Hxd||0) >= Math.abs(R.Hyd||0);
  const _Hval = _useX ? (R.Hxd||0) : (R.Hyd||0);
  // Fallback: wenn H=0, Moment-Richtung aus Mxd/Myd verwenden
  const _Mval = _useX ? (R.Mxd||0) : (R.Myd||0);
  const hSign = (_Hval !== 0 ? _Hval : _Mval) >= 0 ? 1 : -1;
  // Fins werden immer in X-Richtung gebaut; Gruppe wird für Y-Richtung um 90° rotiert
  const fP =  hSign * B/2;
  const fA = -hSign * B/2;
  const zLbl = -(L/2+0.06);

  // E0_a (Ruhedruck über NL) — charakteristisch, kein γ-Faktor (Gl.34/35)
  const e0a_okb = K0 * gs * z_okb;
  const e0a_nl  = K0 * gs * z_nl;

  let lbls = [];

  // ── Stirnflächen (⊥ zur Last) ────────────────────────────────────
  // Passivseite (Richtung H): mobilisierter Erdwiderstand über der NL
  lbls.push(...makeFin(fP, hSign, y_nl3, y_okb, ew_nl,  ew_okb, cEw, 0.55)); // Ew mobilisiert
  // Aktivseite (entgegen H): Ea über der NL, E'p darunter (Block dreht um die NL)
  lbls.push(...makeFin(fA, -hSign, y_nl3, y_okb, ea_nl, ea_okb, cEa, 0.50)); // Ea über NL
  lbls.push(...makeFin(fA, -hSign, y_uk,  y_nl3, epp_uk, epp_nl, cEp, 0.30)); // E'p unter NL (λ'_p, Gl.29)

  // ── Seitenflächen (∥ zur Last): Ruhedruck E₀ / E'₀ — Gl.34/35 ────
  // Diese Flächen liefern über die Reibung R₀ = E₀·tan δ₁ bzw. R'₀ den Beitrag zu Ew/E'w
  // (Gl.41–44). Sie lagen bis Aug 2026 fälschlich als Keil auf der PASSIVEN Stirnfläche und
  // überlagerten dort Ew; E'₀ unter der NL fehlte ganz.
  [ 1, -1 ].forEach(sgn => {
    const zf = sgn * L/2;
    lbls.push(...makeFin(zf, sgn, y_nl3, y_okb, e0a_nl, e0a_okb, cE0, 0.30, 'z', B/2)); // E₀ über NL
    lbls.push(...makeFin(zf, sgn, y_uk,  y_nl3, e0b_uk, e0b_nl,  cE0, 0.22, 'z', B/2)); // E'₀ unter NL
  });

  // ── Drehpunkt (Nulllinie als Punkt + Kreuzmarker) ─────────────────
  const dpSph=new THREE.Mesh(new THREE.SphereGeometry(0.07,14,10),
    new THREE.MeshBasicMaterial({color:0xffcc44}));
  dpSph.position.set(0,y_nl3,0); grp.add(dpSph);
  [[-B*0.75,B*0.75],[- L*0.75,L*0.75]].forEach((r,ax)=>{
    const pts=[new THREE.Vector3(ax?0:r[0],y_nl3,ax?r[0]:0),
               new THREE.Vector3(ax?0:r[1],y_nl3,ax?r[1]:0)];
    grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({color:0xffcc44,opacity:0.85,transparent:true})));
  });
  mkLbl('Drehpunkt  y_NL='+y_nl.toFixed(3)+'m', 0, y_nl3+0.16, 0);   // mittig, nicht in der Label-Flucht

  // ── Spannungs-Labels an Eckpunkten (mit Kollisions-Absatz) ──────────
  // Pro Y-Position (gerundet), Seite UND Zone (über/unter NL) nur den grössten σ-Wert
  // Zone-Trennung verhindert dass E'p-Top den Ea-Bottom-Wert an der NL unterdrückt
  const yMax = new Map();
  lbls.forEach(l => {
    if(l.sig < 0.3) return;
    const zone = l.zone || (l.y >= y_nl3 ? 'a' : 'b'); // a=über NL, b=unter NL
    // Seitenflächen ('s') bekommen einen eigenen Schlüssel — sonst verdrängt der grössere
    // Stirnflächenwert (Ew) den Ruhedruck E₀ auf derselben Höhe.
    const face = (l.z !== undefined) ? 's' : (l.x>=0?'r':'l');
    // Auf den Seitenflächen läuft der Ruhedruck stetig durch die NL (gleiches K₀) — dort
    // ohne Zone im Schlüssel, sonst stünde derselbe Wert an der NL doppelt. Vorn gibt es
    // dagegen einen echten Sprung (Ea über der NL, E'p darunter), da bleibt die Zone drin.
    const yKey = Math.round(l.y*50)+':'+face+(face==='s' ? '' : ':'+zone);
    if(!yMax.has(yKey)||l.sig>yMax.get(yKey).sig) yMax.set(yKey,l);
  });
  const lblCandidates = [];
  yMax.forEach(l => lblCandidates.push({ sig:l.sig, y:l.y, x0:l.x,
    z0:(l.z !== undefined ? l.z : null), extra:0,
    grp:(l.z !== undefined ? 's'+(l.z>0?'+':'-') : (l.x>0?'r':'l')) }));
  // Entzerrung GRUPPENWEISE (linke/rechte Stirnfläche, beide Seitenflächen). Labels auf
  // verschiedenen Flächen stehen im Bild ohnehin auseinander — sie gegeneinander zu schieben
  // trüge sie nur unnötig weit von ihrem Körper weg.
  // Zusätzlich wird ein verschobenes Label seitlich VERSETZT (extra): der reine Höhenversatz
  // reicht in der Perspektive nicht, wenn zwei Körper sehr unterschiedlich breit sind (Ea an
  // der NL gegen E'p) — ein zu grosser Höhenabstand risse das Label dagegen vom Körper weg.
  const minGap = 0.45;
  ['l','r','s+','s-'].forEach(g => {
    const G = lblCandidates.filter(l=>l.grp===g).sort((a,b)=>b.y-a.y);
    for(let i=1;i<G.length;i++){
      const prev=G[i-1], cur=G[i];
      if(prev.y - cur.y < minGap){ cur.y = prev.y - minGap; cur.extra = prev.extra > 0 ? 0 : 0.36; }
    }
  });
  lblCandidates.forEach(l => {
    const off = 0.10 + l.extra;
    const lx = (l.z0 !== null) ? 0 : (l.x0>0 ? l.x0+off : l.x0-off);
    const lz = (l.z0 !== null) ? (l.z0>0 ? l.z0+off : l.z0-off) : zLbl;
    mkLbl(l.sig.toFixed(1)+' kPa', lx, l.y, lz);
  });

  // Nu / Ru: im Layer "Resultierende Kräfte" enthalten → hier nicht doppelt darstellen

  // Y-Richtung: gesamte Gruppe um 90° um Y-Achse rotieren
  if(!_useX) grp.rotation.y = -Math.PI/2;

  scene.add(grp);

  // ── Legende aktualisieren ─────────────────────────────────────────
  document.getElementById('lg-str').innerHTML=
    `<div style="margin-top:4px;font-size:8px;color:var(--xdim);letter-spacing:.06em;text-transform:uppercase">`+
    `GZT — ${lf.name}</div>`+
    `<div class="lg-row"><div class="lg-sq" style="background:${cEa}"></div>Ea aktiv</div>`+
    `<div class="lg-row"><div class="lg-sq" style="background:${cEw}"></div>Ew mobilisiert</div>`+

    `<div class="lg-row"><div class="lg-sq" style="background:${cEp}"></div>E'p passiv (unter NL)</div>`+
    `<div class="lg-row"><div class="lg-sq" style="background:${cE0}"></div>E0 Ruhedruck</div>`+
    `<div class="lg-row"><div class="lg-sq" style="background:${cNL}"></div>Nulllinie y_NL</div>`;
  document.getElementById('lg-str').style.display='block';
}
function resetCam(){_cancelCamFly(true);_panOff.set(0,0,0);sph={t:0.6,p:1.0,r:12};moveCam();}
function setCamTop(){sph={t:0,p:0.08,r:14};moveCam();}
function setCamFront(){sph={t:0,p:Math.PI/2-0.08,r:14};moveCam();}
function setCamSide(){sph={t:Math.PI/2,p:Math.PI/2-0.08,r:14};moveCam();}
function toggleGround(){showGnd=!showGnd;document.getElementById('vc-gnd').classList.toggle('on',showGnd);rebuildScene();}
function toggleGrid(){
  showGrid=!showGrid;
  document.getElementById('vc-grid').classList.toggle('on',showGrid);
  const g=scene.getObjectByName('grid'); if(g) g.visible=showGrid;
  invalidateViewer();
}
function togglePfahlViz(){
  showPfahl=!showPfahl;
  document.getElementById('vc-pfahl').classList.toggle('on',showPfahl);
  _updateKeilBtnVis();
  _updateSicherungBtn();
  calculate();     // Zustand A (Aushub ohne Massnahme) mitberechnen
  rebuildScene();  // stets komplett neu: Block-Labels + Pfähle synchron
}

// Bodenpressung-Keile separat ein-/ausblenden (Start: aus, sobald Sicherung aktiv)
function togglePfahlKeil(){
  showPfahlKeil = !showPfahlKeil;
  const b = document.getElementById('vc-pfahl-keil');
  if(b) b.classList.toggle('on', showPfahlKeil);
  rebuildScene();
}
// Sicherungs-Layer-Buttons nur sichtbar, wenn die Sicherung AKTIV ist (und Modell = Block).
// Betrifft „Sicherung" (vc-pfahl) UND „Keile" (vc-pfahl-keil) — ohne aktive Sicherung sind beide
// bedeutungslos und würden die Layer-Leiste nur zumüllen. Aktiviert wird im Tab «Sicherung».
function _updateKeilBtnVis(){
  const isBlk = curModel().sicherung;
  const p = document.getElementById('vc-pfahl');
  if(p){ p.style.display = (isBlk && showPfahl) ? '' : 'none'; p.classList.toggle('on', showPfahl); }
  const b = document.getElementById('vc-pfahl-keil');
  if(!b) return;
  b.style.display = (isBlk && showPfahl) ? '' : 'none';
  b.classList.toggle('on', showPfahlKeil);
}

// Sicherung/Aushub ist ein SELTENER Nachweis → standardmässig ausgeblendet. Ein Toggle unter
// «Berechnungsmodell» (nur Blockfundament) blendet den Tab «Sicherung» ein. Zustand global in SETTINGS.
let _sichEnabled = false;
function toggleSichEnabled(){
  const el = document.getElementById('sich-enable');
  _sichEnabled = !!(el && el.checked);
  SETTINGS.sichEnabled = _sichEnabled;
  try{ dbSet('bc_settings', SETTINGS); }catch(_){ }
  _applySichEnabledUI();
}
// Sichtbarkeit Tab «Sicherung» + Toggle-Zeile nach _sichEnabled & Modell; deaktiviert die Sicherung,
// wenn der Toggle ausgeschaltet wird (verlässt ggf. den Tab).
function _applySichEnabledUI(){
  const isBlock = curModel().sicherung;
  const row = document.getElementById('sich-enable-row');
  if(row) row.style.display = isBlock ? 'flex' : 'none';
  const chk = document.getElementById('sich-enable'); if(chk) chk.checked = _sichEnabled;
  const nav = document.getElementById('tab-nav-sicherung');
  if(nav) nav.style.display = (isBlock && _sichEnabled) ? '' : 'none';
  if(!_sichEnabled){
    // Sicherung deaktivieren (falls aktiv) + Tab verlassen
    if(showPfahl){ showPfahl = false; _updateSicherungBtn(); _updateKeilBtnVis();
      try{ calculate(); rebuildScene(); }catch(_){ } }
    if(document.getElementById('tab-sicherung')?.classList.contains('active')) switchTab('geometrie');
  }
  try{ _updateDeltaFacUI(); }catch(_){ }
}
function toggleSicherungAktiv(){
  showPfahl = !showPfahl;
  _updateSicherungBtn();
  const vcPf = document.getElementById('vc-pfahl');
  if(vcPf) vcPf.classList.toggle('on', showPfahl);
  _updateKeilBtnVis();
  calculate();     // Zustand A (Aushub ohne Massnahme) mitberechnen
  // Immer komplette Szene neu bauen:
  // → Pfähle+Erddruckdiagramme ein/aus
  // → Block-Kräfte/Spannungen ein/aus (abhängig von showPfahl)
  rebuildScene();
}

function _updateSicherungBtn(){
  const btn      = document.getElementById('btn-sicherung-aktiv');
  const lbl      = document.getElementById('btn-sicherung-lbl');
  const resNorm  = document.getElementById('res-scroll');
  const resPfahl = document.getElementById('pfahl-result-panel');
  const hdrLbl   = document.getElementById('res-hdr-lbl');
  const btnPlot  = document.getElementById('btn-plot');

  if(showPfahl){
    // Aktiv: nur Sicherungs-Ergebnisse, Block-NW ausblenden
    if(resNorm)  resNorm.style.display  = 'none';
    if(resPfahl) resPfahl.style.display = '';
    if(hdrLbl)   hdrLbl.textContent    = 'Pfahlsicherung';
    if(btnPlot)  btnPlot.style.display  = 'none';
    if(btn){
      btn.style.background  = 'var(--acc-s)';
      btn.style.borderColor = 'var(--acc)';
      btn.style.color       = 'var(--acc)';
    }
    if(lbl) lbl.textContent = 'Sicherung aktiv';
  } else {
    // Inaktiv: normale Nachweise zeigen, Sicherungs-Panel verstecken
    if(resNorm)  resNorm.style.display  = '';
    if(resPfahl) resPfahl.style.display = 'none';
    if(hdrLbl)   hdrLbl.textContent    = 'Nachweise';
    if(btn){
      btn.style.background  = 'var(--s2)';
      btn.style.borderColor = 'var(--ol)';
      btn.style.color       = 'var(--dim)';
    }
    if(lbl) lbl.textContent = 'Sicherung inaktiv — klicken zum Aktivieren';
    // Sicherungs-Diagramme zurücksetzen → res-wide nur noch durch GZT gesteuert
    window['_pfahl_ep_diag_wide'] = false;
    window['_pfahl_ov_diag_wide'] = false;
    if(typeof _updateResWide === 'function') _updateResWide();
    if(btnPlot) btnPlot.style.display = '';
  }
}
function toggleDim(){showDim=!showDim;document.getElementById('vc-dim').classList.toggle('on',showDim);rebuildScene();}
function toggleText(){showText=!showText;document.getElementById('vc-txt').classList.toggle('on',showText);invalidateViewer();}
function toggleLabels(){showLabels=!showLabels;document.getElementById('vc-lbl').classList.toggle('on',showLabels);rebuildScene();}
function toggleLyr(){showLyr=!showLyr;document.getElementById('vc-lyr').classList.toggle('on',showLyr);rebuildScene();}

let _vcLfIdx = 0;        // im Viewer gezeigter Lastfall
let _vcLfMode = 'global'; // 'global' | 'quer' | 'laengs' = massgebender Lastfall (folgt dem Ergebnis) · 'lf' = fest gewählt
let _vcKomb = 0;          // 0 = massgebende Kombination · 1–8 = Einzelkombination nach SIA 260
// Richtung eines Lastfalls aus seinen aktiven Komponenten
function _lfRichtung(lf){ const c=(lf&&lf.comp)||{};
  const x=!!(c.HGx||c.HWx||c.MGy||c.MWy), y=!!(c.HGy||c.HWy||c.MGx||c.MWx);
  return x&&!y ? 'quer' : y&&!x ? 'laengs' : 'beide'; }
// Kleinstes η eines Lastfalls über seine aktiven Nachweise (aus dem letzten Ergebnis)
function _lfEtaMin(i){ const lf=LF[i]; if(!lf) return Infinity;
  try{
    if(CALC_MODEL==='pfahlbock'){ const r=RESULT.pfahlbock&&RESULT.pfahlbock.r; if(!r||!r.kombs) return Infinity;
      const e=r.kombs.filter(k=>k.lf===lf.name).map(k=>k.eta); return e.length?Math.min(...e):Infinity; }
    const R=curResult(), r=R&&R.results&&R.results.find(x=>x.name===lf.name); if(!r) return Infinity;
    const gzt=r.nw!=='gzg', gzg=r.nw!=='gzt', e=[];
    if(CALC_MODEL==='block'){ if(gzt&&nwOn('block','gzt')) e.push(r.etaGZT); if(gzg&&nwOn('block','gzg')) e.push(r.etaGZG); }
    else { if(r.gzgF && nwOn('flach','gzg')) e.push(r.etaGZG); }
    if(CALC_MODEL!=='block' && gzt){ if(nwOn('flach','sohlsp')) e.push(r.etaSIG); if(nwOn('flach','grundb')) e.push(r.etaGB);
                  if(nwOn('flach','gleiten')) e.push(r.etaGL); if(nwOn('flach','kippen')&&r.eta_klaf!=null) e.push(r.eta_klaf); }
    const f=e.filter(v=>v!=null&&!isNaN(v)); return f.length?Math.min(...f):Infinity;
  }catch(_){ return Infinity; } }
// Modus «massgebend»: Lastfall mit dem kleinsten η (global bzw. innerhalb der Richtung) bestimmen
let _vcOhneTreffer = false;
function _vcResolveLf(){
  if(_vcLfIdx>=LF.length) _vcLfIdx=0;
  _vcOhneTreffer = false;
  if(_vcLfMode==='lf') return;
  let best=-1, be=Infinity;
  LF.forEach((lf,i)=>{ const d=_lfRichtung(lf);
    if(_vcLfMode==='quer' && d==='laengs') return;
    if(_vcLfMode==='laengs' && d==='quer') return;
    const e=_lfEtaMin(i); if(best<0 || e<be){ best=i; be=e; } });
  _vcOhneTreffer = best<0;   // kein Lastfall in der gewählten Richtung definiert
  if(best>=0) _vcLfIdx=best; }
// Kombinationen des gezeigten Lastfalls: [{nr,fE,fG,fQ,eta?}] + Nummer der massgebenden
function _vcKombListe(){
  const lf=LF[_vcLfIdx]; if(!lf || lf.nw==='gzg') return {list:[], gov:0};
  try{
    if(CALC_MODEL==='pfahlbock'){ const r=RESULT.pfahlbock&&RESULT.pfahlbock.r, ks=(r&&r.kombs||[]).filter(k=>k.lf===lf.name);
      if(!ks.length) return {list:[], gov:0};
      const g=ks.reduce((a,b)=>b.eta<a.eta?b:a);
      return { list:ks.map(k=>({nr:k.nr, fE:k.load.fE, fG:k.load.fG, fQ:k.load.fQ, eta:k.eta})), gov:g.nr }; }
    const R=curResult(), r=R&&R.results&&R.results.find(x=>x.name===lf.name);
    if(CALC_MODEL==='block' && r && r.kombs_GZT && r.kombs_GZT.length)
      return { list:r.kombs_GZT.map(k=>({nr:k.nr, fE:k.fE, fG:k.fG, fQ:k.fQ, eta:k.eta})), gov:r.komb_GZT||8 };
    // Flach: die Typ-2-Nachweise haben je eine eigene massgebende Kombination → Anzeige = Komb. 8 (alles ungünstig)
    const gf=getGF({nw:'gzt'});
    return { list:buildCombos(gGinfT2('flach'), gf.gG, gf.gW).map(k=>({...k})), gov:8 };
  }catch(_){ return {list:[], gov:0}; } }
// Lastbeiwerte der gezeigten Kombination (für die Einwirkungs-Pfeile im d-Modus)
function _vcFak(lf){
  const g=getGF(lf);
  if(!lf || lf.nw==='gzg') return { fE:g.gG, fG:g.gG, fQ:g.gW };
  const K=_vcKombListe(), k=K.list.find(x=>x.nr===(_vcKomb||K.gov));
  return k ? { fE:k.fE, fG:k.fG, fQ:k.fQ } : { fE:g.gG, fG:g.gG, fQ:g.gW }; }
// Ergebnis-Sicht einer Einzelkombination des Blockfundaments (Spannungsbild, Resultierende)
function gztKombView(R, k){ const r=k.r||{};
  return { ...R, etaGZT:k.eta, komb_GZT:k.nr, Nd_GZT:k.Nd, Hxd:k.Hxd, Hyd:k.Hyd,
    Mu_GZT:r.Mu, y_NL_GZT:r.y_nl, Ew_GZT:r.Ew, Ea_GZT:r.Ea_d, E0b_GZT:r.E0b, E0a_GZT:r.E0a, Epb_GZT:r.Epb,
    Nu_GZT:r.Nu, Ru_GZT:r.Ru, Epa_GZT:r.Epa, Ra_v_GZT:r.Ra_v, Rp_va_GZT:r.Rp_va, Rp_vb_GZT:r.Rp_vb,
    u_ecc_GZT:r.u_ecc, arm_v_GZT:r.arm_v, arm_vp_GZT:r.arm_vp }; }
// Pfahlfundament: Lasten und Pfahlkräfte der gezeigten Kombination statt der global massgebenden
function _vcPbViz(viz){
  try{ const r=RESULT.pfahlbock&&RESULT.pfahlbock.r; if(!r||!r.kombs||!r.kombs.length) return viz;
    if(_vcLfMode==='global' && !_vcKomb) return viz;
    const lf=LF[_vcLfIdx], ks=r.kombs.filter(k=>lf&&k.lf===lf.name); if(!ks.length) return viz;
    const k=(_vcKomb&&ks.find(x=>x.nr===_vcKomb)) || ks.reduce((a,b)=>b.eta<a.eta?b:a);
    if(!k.F) return viz;
    return { ...viz, pileRes:k.F.map(F=>({F:+F.toFixed(1), zug:F<0})), govLoad:k.load, govLoadChar:k.loadChar, govCombo:k.label,
             mastN:{ k:Math.max(0,(k.loadChar&&k.loadChar.NMast)||0), d:Math.max(0,k.load.NMast||0) } };
  }catch(_){ return viz; } }
function syncLFSel(){
  _vcResolveLf();
  const wrap=document.getElementById('vc-lf-btns'); if(!wrap) return;
  const mw=document.getElementById('vc-lf-mode');
  if(mw) mw.innerHTML=[['global','Massg.','Massgebender Lastfall über alle Richtungen (kleinstes η) — folgt dem Ergebnis'],
                       ['quer','Quer','Massgebender Lastfall quer zum Gleis'],['laengs','Längs','Massgebender Lastfall längs zum Gleis']]
    .map(([m,t,ti])=>`<button class="vc-lf-btn${_vcLfMode===m?' on':''}" title="${ti}" onclick="selectVcMode('${m}')">${t}</button>`).join('');
  wrap.innerHTML=LF.map((lf,i)=>
    `<button class="vc-lf-btn${i===_vcLfIdx?(_vcLfMode==='lf'?' on':' akt'):''}" title="${esc(lf.name)}" onclick="selectVcLF(${i})">LF ${i+1}</button>`
  ).join('');
  // Kombinationswahl
  const sel=document.getElementById('vc-komb'), info=document.getElementById('vc-komb-info');
  const K=_vcKombListe(); if(_vcKomb && !K.list.some(k=>k.nr===_vcKomb)) _vcKomb=0;
  const fz=v=>(+v).toFixed(2).replace(/\.?0+$/,'')||'0', et=k=>(k.eta!=null&&isFinite(k.eta))?' · η '+k.eta.toFixed(2):'';
  if(sel){
    const h = K.list.length
      ? `<option value="0">Komb. massg.${K.gov?' ('+K.gov+')':''}</option>`+K.list.map(k=>`<option value="${k.nr}">Komb. ${k.nr}${et(k)}</option>`).join('')
      : `<option value="0">ohne Kombination</option>`;
    if(sel._h!==h){ sel.innerHTML=h; sel._h=h; }
    sel.value=String(_vcKomb); sel.disabled=!K.list.length;
    sel.classList.toggle('on', _vcKomb>0);
  }
  if(info){ const lf=LF[_vcLfIdx], k=K.list.find(x=>x.nr===(_vcKomb||K.gov));
    info.textContent = !lf ? '' : ((_vcOhneTreffer ? 'Kein Lastfall '+(_vcLfMode==='quer'?'quer':'längs')+' zum Gleis definiert — gezeigt: ' : '') + lf.name + (k
      ? ` · Komb. ${k.nr}${_vcKomb?'':' (massgebend)'}: Eigengewicht ${fz(k.fE)} · ständig ${fz(k.fG)} · veränderlich ${fz(k.fQ)}${et(k)}`
      : ' · charakteristisch (Gebrauchstauglichkeit)')); }
}
function selectVcMode(m){ _vcLfMode=m; _vcKomb=0; syncLFSel(); updateViewer(); }
function selectVcLF(i){
  _vcLfIdx=i; _vcLfMode='lf'; _vcKomb=0;
  syncLFSel();
  updateViewer();
}
function selectVcKomb(n){ _vcKomb=+n||0; syncLFSel(); updateViewer(); }
function toggleStress(){
  showStr=!showStr;
  document.getElementById('vc-str').classList.toggle('on',showStr);
  if(!showStr){ clr('spl'); document.getElementById('lg-str').style.display='none'; }
  rebuildScene();
}

function toggleVec(){
  showVec=!showVec;
  document.getElementById('vc-vec').classList.toggle('on',showVec);
  if(!showVec){ clr('vec'); document.getElementById('lg-vec').style.display='none'; }
  rebuildScene();
}

function buildVectors(){
  clr('vec');
  if(!curResult()) return;
  // Hinweis setzt buildStress bereits — hier nur still aussteigen (sonst doppelt).
  const d=_getGZTData(); if(!d){ if(!showStr) _gztLayerHint(); return; }
  const {R,G,lf}=d;
  const t=G.Hb,ue=G.ue,B=G.B,L=G.L,y_nl=R.y_NL_GZT;
  const y_okb=-ue, y_nl3=-(t-y_nl), y_uk=-t;

  // Lastrichtung: grösste horizontale Komponente bestimmt Achse; Fallback: Moment
  const Hx=Math.abs(R.Hxd||0), Hy=Math.abs(R.Hyd||0);
  const useX = Hx>=Hy;
  const Hval = useX ? (R.Hxd||0) : (R.Hyd||0);
  const Mval = useX ? (R.Mxd||0) : (R.Myd||0);
  const hSign = (Hval!==0 ? Hval : Mval) >= 0 ? 1 : -1;
  // Passivseite: in Lastrichtung, Aktivseite: entgegen Last
  const fP = hSign*B/2, fA = -hSign*B/2;
  const hV = useX ? new THREE.Vector3(hSign,0,0) : new THREE.Vector3(0,0,hSign);
  const hVn= useX ? new THREE.Vector3(-hSign,0,0): new THREE.Vector3(0,0,-hSign);

  const grp=new THREE.Group(); grp.name='vec';

  // Skalierung: max horizontale Kraft → 1.0 m Pfeillänge
  const forces=[R.Ea_GZT,R.Ew_GZT,R.Epb_GZT,R.E0b_GZT,R.Nu_GZT,R.Ru_GZT,Math.abs(Hval)];
  const fMax=Math.max(...forces.filter(f=>f&&f>0),1);
  const sc=2.4/fMax;  // Skalierungsfaktor erhöht für bessere Sichtbarkeit
  function arL(f){return Math.max(0.35,Math.min(3.2,f*sc));}

  // Y-Positionen: Schwerpunkte der Zonen
  const y_above = y_okb + (y_nl3-y_okb)*0.55;  // Schwerpunkt über NL
  const y_below = y_nl3 + (y_uk-y_nl3)*0.40;   // Schwerpunkt unter NL

  const cEa='#e05540',cEw='#4488cc',cEp='#44bb88',cE0='#888899';
  const gap=0.08; // Abstand zwischen Pfeilen

  // mkVec: Pfeil von AUSSERHALB auf Blockfläche zu (Pfeilspitze = Blockfläche)
  // face: x-Position der Blockfläche
  // outDir: Richtungsvektor weg vom Block (Pfeil kommt aus dieser Richtung)
  function mkVec(face, outDir, yPos, force, col, label){
    const len=arL(force);
    const origin=new THREE.Vector3().copy(face).addScaledVector(outDir, len);
    const dir=outDir.clone().negate(); // Pfeil zeigt ZUR Fläche hin
    const ah=new THREE.ArrowHelper(dir, origin, len, new THREE.Color(col), len*0.26, 0.12);
    grp.add(ah);
    // Label am Pfeilanfang (Schwanz, weit weg vom Block)
    const lblPos=origin.clone().addScaledVector(outDir, 0.28);
    _vlAdd(label, lblPos, 'vl-frc');
  }

  // Hilfsvektoren: Blockflächen-Positionen
  const posA = useX ? new THREE.Vector3(fA, 0, 0) : new THREE.Vector3(0, 0, fA);
  const posP = useX ? new THREE.Vector3(fP, 0, 0) : new THREE.Vector3(0, 0, fP);
  const posAy=(y)=>posA.clone().setY(y);
  const posPy=(y)=>posP.clone().setY(y);

  // ── Aktivseite (entgegen H): Ea über NL, E'p unter NL ──────────────
  if(R.Ea_GZT>0.5)  mkVec(posAy(y_above), hVn, y_above, R.Ea_GZT,  cEa, 'Ea = '+R.Ea_GZT.toFixed(0)+' kN');
  if(R.Epb_GZT>0.5) mkVec(posAy(y_below+0.15), hVn, y_below, R.Epb_GZT, cEp, "E'p = "+R.Epb_GZT.toFixed(0)+' kN');

  // ── Passivseite (Richtung H): Ew + Ep (oben) + E0 (unten) ──────────
  if(R.Ew_GZT>0.5)  mkVec(posPy(y_above), hV, y_above, R.Ew_GZT,  cEw, 'Ew = '+R.Ew_GZT.toFixed(0)+' kN');
  if(R.E0b_GZT>0.5) mkVec(posPy(y_below), hV, y_below, R.E0b_GZT, cE0, "E'0 = "+R.E0b_GZT.toFixed(0)+' kN');

  // ── R₀ / R₀' (Ruhedruck-Resultanten) ────────────────────────────────
  // R₀ = E₀·tan δ₁ (Gl.41/42) — bis Aug 2026 wurde hier E₀ selbst gezeichnet und beschriftet,
  // also um 1/tan(⅔φ) zu gross (bei φ=30°: 93 statt 34 kN).
  const _tD1 = (R.tanD1_GZT != null && R.tanD1_GZT > 0) ? R.tanD1_GZT : Math.tan(2/3*Math.PI/6);
  const E0a=(R.E0a_GZT||0)*_tD1, E0b=(R.E0b_GZT||0)*_tD1;
  const y_R0  = y_okb + (y_nl3-y_okb)*0.60;
  const y_R0p = y_nl3 + (y_uk-y_nl3)*0.35;
  // R₀: auf Passivseite, destabilisierend → zeigt in Richtung H (schwächt Ew)
  if(E0a>0.5) mkVec(posPy(y_R0-0.10), hV, y_R0, E0a, '#888899', 'R₀ = '+E0a.toFixed(0)+' kN');
  // R₀': unter NL, stabilisierend → zeigt entgegen H
  if(E0b>0.5) mkVec(posPy(y_R0p+0.10), hVn, y_R0p, E0b, '#aaaaaa', "R₀' = "+E0b.toFixed(0)+' kN');

  // ── Sohlkräfte Nu ↑ und Ru (in H-Richtung: Sohle bewegt sich entgegen H → Reibung mit H) ────
  const scV=(B*0.9)/Math.max(Math.max(R.Nu_GZT||0, R.Ru_GZT||0),1);
  if((R.Nu_GZT||0)>0.5){
    const len=Math.max(0.25,Math.min(1.4,(R.Nu_GZT||0)*scV));
    grp.add(new THREE.ArrowHelper(new THREE.Vector3(0,1,0),
      new THREE.Vector3(0,y_uk,0),len,0x6fcf8e,len*0.24,0.09));
    _vlAdd('Nu = '+(R.Nu_GZT||0).toFixed(0)+' kN', new THREE.Vector3(0.15,y_uk+len*0.5,0),'vl-frc');
  }
  if((R.Ru_GZT||0)>0.5){
    const len=Math.max(0.20,Math.min(1.2,(R.Ru_GZT||0)*scV));
    // R_u zeigt in H-Richtung (hV); Moment R_u·(t−ü) rückstellend (Steckner Gl.54/66)
    const ruOrg=new THREE.Vector3(-fA*0.55,y_uk+0.10,0);
    grp.add(new THREE.ArrowHelper(hV, ruOrg, len, 0x6fcf8e, len*0.24, 0.09));
    _vlAdd('Ru = '+(R.Ru_GZT||0).toFixed(0)+' kN',
      ruOrg.clone().addScaledVector(hVn, 0.18),'vl-frc');
  }

  // ── H* angreifende Last (vom Mast) ───────────────────────────────────
  const Hd=Math.abs(Hval);
  if(Hd>0.5){
    const len=arL(Hd)*1.1;
    // Pfeil von aussen kommend, Spitze an OK Block
    const hOrigin=posAy(y_okb).addScaledVector(hVn,len+0.3);
    const ah=new THREE.ArrowHelper(hV,hOrigin,len+0.3,new THREE.Color('#c9a84c'),(len+0.3)*0.18,0.07);
    grp.add(ah);
    _vlAdd('H* = '+Hd.toFixed(0)+' kN', hOrigin.clone().addScaledVector(hVn,0.15),'vl-frc');
  }

  // ── Drehpunkt (Nulllinie) ─────────────────────────────────────────
  if(y_nl > 0.001){
    const dpSph=new THREE.Mesh(new THREE.SphereGeometry(0.08,14,10),
      new THREE.MeshBasicMaterial({color:0xffcc44}));
    dpSph.position.set(0,y_nl3,0); grp.add(dpSph);
    // Kreuzlinie
    const nlMat=new THREE.LineBasicMaterial({color:0xffcc44,opacity:0.75,transparent:true});
    [[-B*0.9,B*0.9],[-L*0.9,L*0.9]].forEach((r,ax)=>{
      const pts=[new THREE.Vector3(ax?0:r[0],y_nl3,ax?r[0]:0),
                 new THREE.Vector3(ax?0:r[1],y_nl3,ax?r[1]:0)];
      grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),nlMat));
    });
    _vlAdd('Drehpunkt  y_NL='+y_nl.toFixed(3)+'m', new THREE.Vector3(B*0.95,y_nl3+0.12,0),'vl-frc');
  }

  scene.add(grp);

  // Legende
  document.getElementById('lg-vec').innerHTML=
    `<div style="margin-top:4px;font-size:8px;color:var(--xdim);letter-spacing:.06em;text-transform:uppercase">Vektoren — ${lf.name}</div>`+
    `<div class="lg-row"><div class="lg-sq" style="background:${cEa}"></div>Ea aktiv</div>`+
    `<div class="lg-row"><div class="lg-sq" style="background:${cEw}"></div>Ew mobilisiert</div>`+
    `<div class="lg-row"><div class="lg-sq" style="background:${cEp}"></div>E'p passiv</div>`+
    `<div class="lg-row"><div class="lg-sq" style="background:${cE0}"></div>E'0 Ruhe</div>`+
    `<div class="lg-row"><div class="lg-sq" style="background:#6fcf8e"></div>Nu / Ru</div>`+
    `<div class="lg-row"><div class="lg-sq" style="background:#c9a84c"></div>H*</div>`+
    `<div class="lg-row"><div class="lg-sq" style="background:#888899"></div>R₀ (destab.)</div>`+
    `<div class="lg-row"><div class="lg-sq" style="background:#aaaaaa"></div>R₀' (stabilis.)</div>`;
  document.getElementById('lg-vec').style.display='block';
}

// ════════════════════════════════════════════
