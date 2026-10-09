// BlockCalc — js/helfer.js
// Kleine UI-Helfer: gi/si, esc, Tab-Wechsel, Statuszeile, Toast
// UI HELPERS
// ════════════════════════════════════════════
function gi(id){ return document.getElementById(id)?.value ?? '0'; }
function si(id,v){ const el = document.getElementById(id); if(el) el.value = v; }
// HTML-Maskierung für FREIE Nutzertexte (Projekt-/Fundament-/Schicht-/Traggliednamen, Bemerkungen,
// Firma, KM, Mast-Nr.). Nötig überall dort, wo solche Werte per innerHTML/document.write in Markup
// interpoliert werden — sowohl als Elementinhalt als auch in Attributen (daher auch " und ').
// Zwei Gründe: (a) importierte Projekt-JSON aus fremder Quelle könnte Markup/Skript einschleusen,
// (b) ein legitimes „B > 2 & L < 3" in einer Bemerkung zerlegte sonst das Layout.
function esc(v){
  return String(v==null?'':v)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function switchTab(n){
  const ns=['geometrie','baugrund','lasten','sicherung'];   // 'projekt' liegt jetzt im Topbar-Banner
  document.querySelectorAll('.nav-tab').forEach((t,i)=>t.classList.toggle('active',ns[i]===n));
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  document.getElementById('tab-'+n)?.classList.add('active');
}
function updateSB(){
  const B = gi('g_bx'), L = gi('g_by'), H = gi('g_hblock');
  document.getElementById('sb-geo').textContent = `${B}×${L}×${H} m`;
  document.getElementById('sb-lf').textContent  = `${LF.length} Lastfälle`;
  // Projektname im Topbar
  const pname = (gi('p_name') || '').trim();
  const pfund = (gi('p_fundname') || '').trim();
  const pnEl  = document.getElementById('tb-projname');
  if(pnEl) pnEl.textContent = (pname && pfund) ? `${pname}  ·  ${pfund}` : (pname || pfund || 'Projektangaben');
}
function toast(msg){
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(-50%) translateY(6px)';
    setTimeout(() => el.remove(), 280);
  }, 2200);
}

// ════════════════════════════════════════════
