// BlockCalc — js/mobil.js
// Mobile Navigation
// MOBILE NAVIGATION
// ════════════════════════════════════════════
let currentMobView = 'input';
let viewerInited = false;

function resizeViewer(){
  if(!renderer) return;
  const el = document.getElementById('viewer');
  const w = el.offsetWidth, h = el.offsetHeight;
  if(w < 10 || h < 10) return; // not visible yet
  const _pr = _viewerPR();                                   // DPR kann sich (Monitorwechsel) ändern
  if(Math.abs(renderer.getPixelRatio() - _pr) > 0.01) renderer.setPixelRatio(_pr);
  renderer.setSize(w, h);
  if(camera.isOrthographicCamera){ const d=(typeof sph!=='undefined'?sph.r:12)*0.55, asp=w/h;
    camera.left=-d*asp; camera.right=d*asp; camera.top=d; camera.bottom=-d; }
  else { camera.aspect = w / h; }
  camera.updateProjectionMatrix();
  // Schublade offen → View-Offset mit neuer Canvas-Breite neu setzen (fullWidth in setViewOffset sonst stale)
  if(typeof _drawerShiftCur!=='undefined' && Math.abs(_drawerShiftCur)>0.5 && typeof moveCam==='function') moveCam();
  // Sofort neu zeichnen: nach setSize ist der WebGL-Buffer geleert; ohne synchrones Render zeigt der
  // Compositor während einer CSS-Transition (Splitter-Ziehen / Banner-Ausrollen) einen schwarzen Frame.
  try{ if(scene && camera) renderer.render(scene, camera); }catch(e){}
  if(typeof invalidateViewer==='function') invalidateViewer();   // Labels im nächsten Frame nachführen
}

function mobSwitch(view){
  const isMob = window.innerWidth < 768;
  currentMobView = view;

  if(isMob){
    // Input panel
    const pinput = document.getElementById('panel-input');
    const presults = document.getElementById('panel-results');
    const pvwrap = document.getElementById('viewer-wrap');

    pinput.classList.toggle('mob-hidden', view !== 'input');
    presults.classList.toggle('mob-hidden', view !== 'results');

    if(view === 'viewer'){
      pvwrap.classList.add('mob-visible');
    } else {
      pvwrap.classList.remove('mob-visible');
    }

    // Resize viewer after CSS transition settles
    if(view === 'viewer'){
      requestAnimationFrame(()=>{
        requestAnimationFrame(()=>{
          resizeViewer();
        });
      });
    }
  }

  // Nav tabs
  document.getElementById('mnav-input').classList.toggle('active',   view==='input');
  document.getElementById('mnav-viewer').classList.toggle('active',  view==='viewer');
  document.getElementById('mnav-results').classList.toggle('active', view==='results');

  // Protokoll btn: in Sidebar-Nachweise (nicht Topbar)
}

// ════════════════════════════════════════════
