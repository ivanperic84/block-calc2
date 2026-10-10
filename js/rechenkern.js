// BlockCalc — js/rechenkern.js
// Modell-Registry, calculate, Eingabepaket, Rechenkern Block/Flach
// Modell-Registry — EINE Stelle, an der die drei Tragsysteme ihre Schnittstelle erklären.
//   label/kopf     Bezeichnung (Titel) bzw. Kopfzeile des Berichts
//   Fähigkeiten    standard (typengeprüftes Standardfundament) · sicherung (Modul Sicherung/Aushub)
//                  gl66 (Steckner-Spannungsbild im 3D) · dimensionierbar (Dimensionierung, Bemessungsdiagramm)
//   berechnen()    Berechnung inkl. Ergebnis-Panel und 3D
//   hatErgebnis()  liegt ein Ergebnis für den Bericht vor?
//   bericht()      HTML des Nachweisberichts
//   auswerten()    kompakte Auswertung {dims, geom, etaT, etaG, gov, lf} für Fundamentliste/Embed
// Zugriff über curModel(). Neue Verzweigungen nach CALC_MODEL möglichst hier ansiedeln statt
// als weiteres if/else im Code.
function _evalBlockFlach(model){
  const num=id=>+gi(id)||0;
  const res=_doCalculate({ ...collectCalcInputs(), _pure:true });
  const w=res&&res.worst;
  const B=num('g_bx'),L=num('g_by'),H=num('g_hblock'),ue=num('g_uberd');
  const o={ dims:B.toFixed(2)+' × '+L.toFixed(2)+' × '+H.toFixed(2)+' m'+(ue?' · ü '+ue.toFixed(2):''),
            geom:{ B, L, H_Block:H, B_Kopf:num('g_kx'), L_Kopf:num('g_ky'),
                   H_Kopf:num('g_hkopf'), ueberdeckung:ue, e_x:num('g_ex'), e_y:num('g_ey') },
            etaT:null, etaG:null, gov:'–', lf:null };
  if(model==='block'){ o.etaT=w&&isFinite(w.etaGZT)?w.etaGZT:null; o.etaG=w&&isFinite(w.etaGZG)?w.etaGZG:null; }
  else { const R=(res&&res.results)||[];
         const uls=R.filter(r=>r.nw!=='gzg').flatMap(r=>[r.etaGB, r.etaGL, r.eta_klaf]).filter(isFinite);
         o.etaT = uls.length?Math.min(...uls):null;
         const sls=R.filter(r=>r.gzgF && nwOn('flach','gzg')).map(r=>r.etaGZG).filter(isFinite);
         o.etaG = sls.length?Math.min(...sls):null; }   // Flach: GZG = Kernweite + Verkippung
  try{ o.gov=_dimGovName(res); }catch(_){}
  o.lf = (w&&w.name) || null;
  return o;
}
function _evalPfahl(){
  const num=id=>+gi(id)||0;
  if(typeof renderPfahlbock==='function') renderPfahlbock();
  const r=(RESULT.pfahlbock&&RESULT.pfahlbock.r)||{};
  const uls=[[r.etaGeo,'Mantelreibung'],[r.etaTors,'Torsion'],[r.etaAuf,'Aufbruchsicherheit'],[r.etaSteel,'Querschnitt N+M'],[r.etaKnick,'Knicken'],
             [r.etaLat,'Laterale Bodentragfähigkeit']].filter(([v])=>isFinite(v));
  const o={ dims:'—', geom:null, gov:'–', lf:r.govCombo||null,
            etaT: uls.length?Math.min(...uls.map(([v])=>v)):null,
            etaG: isFinite(r.etaGZG)?r.etaGZG:null };
  const gv=[...uls,[o.etaG,'GZG Schiefstellung']].filter(([v])=>v!=null&&isFinite(v))
           .sort((a,b)=>a[0]-b[0])[0];
  o.gov = gv?gv[1]:'–';
  const bx=num('pb_bx'), by=num('pb_by'), L=num('pb_L');
  // Einzelpfahl hat KEIN Bankett — dann sind Pfahllänge/Profil die Abmessung, nicht B×L.
  if(gi('pb_mode')==='einzel'){
    const prof=(document.getElementById('pb_prof')||{}).value||'';
    o.dims='Einzelpfahl · L = '+L.toFixed(2)+' m'+(prof?' · '+prof:'');
    o.geom={ pfahlAnzahl:1, pfahlLaenge:L, profil:prof, ueberstand:num('pb_e') };
  } else {
    o.dims='Bankett '+bx.toFixed(2)+'×'+by.toFixed(2)+' m (Pfahlfundament)';
    o.geom={ B:bx, L:by, H_Bankett:num('pb_bank_d'), B_Kopf:num('pb_kx'), L_Kopf:num('pb_ky'),
             H_Kopf:num('pb_hk'), ueberdeckung:num('pb_ue'),
             pfahlAnzahl:num('pb_n'), pfahlLaenge:L };
  }
  return o;
}
// ── Grundbruchwiderstand: erweiterte Tragfähigkeitsformel ────────────────────────────────────────
// Die SIA 267 gibt keine Formel vor (Vorwort: Berechnungsmethoden sind nicht Gegenstand der Norm).
// Die SIA-Dokumentation D 0197 «Geotechnik — Bemessungsbeispiele zur Norm SIA 267» (Kap. 5.3.4.3)
// führt den Nachweis E_N,d ≤ R_N,d = σ_f·b̄ mit der erweiterten Tragfähigkeitsformel nach
// Lang / Huder / Amann (/ Puzrin), «Bodenmechanik und Grundbau», Abschnitt 9.2.5–9.2.17. Diese
// Formel ist hier umgesetzt (beide Quellen liegen in Grundlagen/):
//   σ_f = c·N_c·s_c·d_c·i_c·g_c + (γ·t + q)·N_q·s_q·d_q·i_q·g_q + ½·γ·b̄·N_γ·s_γ·d_γ·i_γ·g_γ
//   9.2.6   N_q = e^(π·tanφ)·tan²(45° + φ/2) · N_c = (N_q − 1)/tanφ · N_γ ≈ 1.8·(N_q − 1)·tanφ
//   9.2.11  b̄ = b − 2·e_b, l̄ = l − 2·e_l; alle Faktoren mit b̄ statt b;  P_f = σ_f·b̄·l̄
//   9.2.12  s_c = 1 + (b̄/l̄)·N_q/N_c · s_q = 1 + (b̄/l̄)·tanφ · s_γ = 1 − 0.4·b̄/l̄
//   9.2.13  d_c = 1 + 0.007·arctan(t/b̄) · d_q = 1 + 0.035·tanφ·(1 − sinφ)²·arctan(t/b̄) · d_γ = 1
//           (arctan in Grad)
//   9.2.14  i_q = [1 − ½·T/(N + b̄·l̄·c/tanφ)]⁵ · i_γ = [1 − 0.7·T/(N + b̄·l̄·c/tanφ)]⁵ (Sohle
//           waagrecht, α = 0) · i_c = i_q − (1 − i_q)/(N_q − 1)
//   9.2.15  g_c = 1 − β°/147° · g_q = g_γ = (1 − ½·tanβ)⁵      (kommen als fertige Faktoren herein)
//   9.2.17  φ = 0:  σ_f = 5.1·s_u·(1 + s̄_c + d̄_c − ī_c − ḡ_c) + (γ·t + q)  mit  s̄_c = 0.2·b̄/l̄,
//           d̄_c = 0.4·t/b̄ (t < b̄) bzw. 0.007·arctan(t/b̄), ī_c = 0.5 − ½·√(1 − T/(s_u·b̄·l̄)), ḡ_c = β°/147°
// Mit Bemessungswerten φ_d, c_d gerechnet (D 0197). B = b̄ (kleinere), L = l̄ (grössere) wirksame
// Seite; T = Horizontalkraft, N = Normalkraft, t = Einbindetiefe, q = wirksamer Überlagerungsdruck
// auf Sohlhöhe (γ·t + Auflast). Fundamentneigung b′ entfällt (Sohle waagrecht).
function grundbruchSIA(p){
  const phi=Math.max(0,p.phi||0), c=Math.max(0,p.c||0), B=Math.max(1e-6,p.B), L=Math.max(B,p.L||B), A=B*L, r=B/L;
  const T=Math.abs(p.T||0), N=Math.max(1e-6, p.N||0), t=Math.max(0,p.t||0);
  const gc=p.gc??1, gq=p.gq??1, gg=p.gg??1;
  const at=Math.atan(t/B)*180/Math.PI;                       // arctan(t/b̄) in Grad
  if(phi <= 0.001){
    const scB=0.2*r, dcB = t < B ? 0.4*t/B : 0.007*at;
    const icB = c>1e-9 ? 0.5-0.5*Math.sqrt(Math.max(0, 1-T/(c*A))) : 0.5, gcB=1-gc;
    return { Nq:1, Nc:5.1, Ng:0, sq:1, sc:1+scB, sg:1, dq:1, dc:1+dcB, dg:1, iq:1, ic:1-icB, ig:1, al: c>1e-9 ? T/(c*A) : 0,
             undraen:true, sigf: 5.1*c*(1+scB+dcB-icB-gcB) + (p.q||0) };
  }
  const tp=Math.tan(phi), sp=Math.sin(phi);
  const Nq=Math.exp(Math.PI*tp)*Math.tan(Math.PI/4+phi/2)**2, Nc=(Nq-1)/tp, Ng=1.8*(Nq-1)*tp;
  const sq=1+r*tp, sc=1+r*Nq/Nc, sg=1-0.4*r;
  const dc=1+0.007*at, dq=1+0.035*tp*(1-sp)**2*at, dg=1;
  const al=T/(N + A*c/tp);
  const iq=Math.pow(Math.max(0,1-0.5*al),5), ig=Math.pow(Math.max(0,1-0.7*al),5), ic=Math.max(0, iq-(1-iq)/(Nq-1));
  return { Nq, Nc, Ng, sq, sc, sg, dq, dc, dg, iq, ic, ig, al, undraen:false,
           sigf: c*Nc*sc*dc*ic*gc + (p.q||0)*Nq*sq*dq*iq*gq + 0.5*(p.gam||0)*B*Ng*sg*dg*ig*gg };
}
// ── Flachfundament: Gebrauchstauglichkeit (SIA 267 Ziff. 8.5.4) ─────────────────────────────────
// 1) Ziff. 8.5.4.7: «Ohne besonderen Nachweis soll in der Regel im Grenzzustand Gebrauchstauglichkeit
//    die Exzentrizität der resultierenden Fundamentlast die EINFACHE KERNWEITE der Fundamentsohlfläche
//    nicht überschreiten (Beschränkung der Verkippung).» Rechteck: |e_x|/B + |e_y|/L ≤ 1/6.
// 2) Verkippung gegen den Grenzwert des Bauwerks (Ziff. 8.5.4.1: objektbezogen — hier SBB 1:100 / 1:200).
//    Die Norm regelt das Berechnungsverfahren nicht (Vorwort). Angesetzt wird das starre Fundament auf
//    dem elastischen Halbraum (Borowicka): tan α = 3·(1−ν)·M / (8·G·r³), mit dem Ersatzradius gleichen
//    Trägheitsmoments r = (4·I/π)^¼ (I = L·B³/12 für die Verkippung quer) und G = M_E·(1−2ν)/(2·(1−ν)),
//    ν = 0.3. M_E = harmonisches Mittel der Schichten zwischen Sohle und 1.5·Breite darunter.
//    Einbindung und seitliche Stützung werden nicht angesetzt (sichere Seite). Das Modell ist linear und
//    gilt nur bei geschlossener Sohlfuge — darum bleibt die Kernweite als eigene Bedingung bestehen.
// Lasten charakteristisch (γ_F = 1.0, Ziff. 5.3.3.6), Baugrundwerte charakteristisch (Ziff. 5.3.2.8).
function meMittelHarm(z0, z1){
  const S=cSchichten(), fb=Math.max(0.5, +cgi('bg_me')||20); let z=0, sum=0, len=0;
  for(let i=0;i<S.length;i++){ const s=S[i], bot=(s.d===999||i===S.length-1) ? Infinity : z+(+s.d||0);
    const a=Math.max(z,z0), b=Math.min(bot,z1);
    if(b>a){ const me=Math.max(0.5, S.length>1 ? (s.me ?? fb) : fb); sum+=(b-a)/me; len+=b-a; }
    z=bot; if(z>=z1) break; }
  return len>0 ? len/sum : fb;
}
function flachGZG(p){
  const nu=0.3, B=p.B, L=p.L, N=Math.max(1e-6, p.N);
  const ex=Math.abs(p.May)/N, ey=Math.abs(p.Max)/N;
  const kern=ex/B+ey/L, etaKern = kern>1e-9 ? (1/6)/kern : Infinity;
  const dir=(b,l,M,z)=>{ const ME=meMittelHarm(z, z+1.5*b), G=ME*1000*(1-2*nu)/(2*(1-nu));
    const r=Math.pow(4*(l*Math.pow(b,3)/12)/Math.PI, 0.25), K=8*G*Math.pow(r,3)/(3*(1-nu));
    return { ME, G, r, K, tan: Math.abs(M)/K }; };
  const X=dir(B, L, p.May, p.t), Y=dir(L, B, p.Max, p.t);      // X: Verkippung quer (um die y-Achse)
  const quer = X.tan >= Y.tan, tan=Math.max(X.tan, Y.tan);
  const etaTilt = tan>1e-12 ? p.tanZul/tan : Infinity;
  return { N, Max:p.Max, May:p.May, ex, ey, kern, etaKern, X, Y, quer, tan, tanZul:p.tanZul, etaTilt, nu,
           eta: Math.min(etaKern, etaTilt) };
}
const MODELS = {
  block: { id:'block', label:'Blockfundament', kopf:'Steckner Blockfundament',
    standard:true, sicherung:true, gl66:true, dimensionierbar:true,
    berechnen(){ _doCalculate(); },
    hatErgebnis(){ return !!RESULT.block; },
    bericht(){ return buildNachweisDoc(RESULT.block.results, RESULT.block.G); },
    auswerten(){ return _evalBlockFlach('block'); } },
  flach: { id:'flach', label:'Flachfundament', kopf:'Flachfundament (starre Sohle)',
    standard:false, sicherung:false, gl66:false, dimensionierbar:true,
    berechnen(){ _doCalculate(); },
    hatErgebnis(){ return !!RESULT.flach; },
    bericht(){ return buildNachweisDocFlach(RESULT.flach.results, RESULT.flach.G); },
    auswerten(){ return _evalBlockFlach('flach'); } },
  pfahlbock: { id:'pfahlbock', label:'Pfahlfundament', kopf:'Pfahlfundament (Mikropfähle)',
    standard:false, sicherung:false, gl66:false, dimensionierbar:false,
    berechnen(){ renderPfahlbock(); },
    hatErgebnis(){ return !!(RESULT.pfahlbock && RESULT.pfahlbock.r); },
    bericht(){ const p=RESULT.pfahlbock; return buildNachweisDocPfahl(p.r, p.piles, p.n); },
    auswerten(){ return _evalPfahl(); } }
};
function curModel(){ return MODELS[(typeof CALC_MODEL!=='undefined') ? CALC_MODEL : 'block'] || MODELS.block; }

function calculate(){
  if(typeof _flashCalc==='function') _flashCalc();                      // dezenter „aktualisiert"-Hinweis
  if(typeof _plausCheck==='function') try{ _plausCheck(); }catch(_){}   // Live-Plausibilität der Eingaben
  if(typeof lastKoppelAbgleich==='function') lastKoppelAbgleich();      // Kopplung längs = quer nie mit abweichenden Werten
  try { curModel().berechnen(); } catch(e){ console.error('calculate() Fehler ('+CALC_MODEL+'):', e); }
  // Embed: Leiste mitführen (Bauart-Wechsel und Grenzüberschreitung sollen beim Dimensionieren
  // sichtbar sein, nicht erst nach dem Übernehmen)
  if(window._EMBED_MODE) try{ _embedRenderBar(); }catch(_){}
}
// Live-Plausibilitätsprüfung der Kern-Eingaben → kompakte Warnzeilen oben im Eingabe-Panel.
// Ersetzt das stille ||0-Verschlucken offensichtlich falscher/leerer Werte durch sichtbare Hinweise.
function _plausCheck(){
  const bar=document.getElementById('plaus-bar'); if(!bar) return;
  const w=[], num=id=>{ const el=document.getElementById(id); if(!el) return NaN; const v=parseFloat(el.value); return isFinite(v)?v:NaN; };
  const phi=num('bg_phi'); if(isFinite(phi) && (phi<10||phi>50)) w.push(['warn',`φ′ = ${phi}° ungewöhnlich (üblich 20–45°)`]);
  const c=num('bg_c');     if(isFinite(c) && c<0)               w.push(['fail','c′ negativ — unzulässig']);
  const gam=num('bg_gamma');if(isFinite(gam) && (gam<14||gam>24))w.push(['warn',`γ = ${gam} kN/m³ ungewöhnlich (14–24)`]);
  if(CALC_MODEL==='block' || CALC_MODEL==='flach'){
    const bx=num('g_bx'),by=num('g_by'),hb=num('g_hblock');
    if(!(bx>0)||!(by>0)||!(hb>0)) w.push(['fail','Geometrie unvollständig — B/L/H müssen > 0 sein']);
    // Kopf vollständig unter Terrain: rechnerisch zulässig, aber unüblich — meist ein Eingabefehler
    // (H_Kopf ist die GESAMTHÖHE ab OK Block, nicht der Überstand über Terrain).
    if(CALC_MODEL==='block'){ const hk=num('g_hkopf'), ue=num('g_uberd');
      if(hk>0 && ue>hk+1e-9) w.push(['warn',`Fundamentkopf liegt ganz unter Terrain (ü = ${ue.toFixed(2)} m > H_Kopf = ${hk.toFixed(2)} m) — H_Kopf ist die Gesamthöhe ab OK Block`]); }
    try{ if(typeof gwDepth==='function'){ const gw=gwDepth(), t=(hb||0)+(num('g_uberd')||0);
      if(isFinite(gw)&&gw>=0&&gw<t-0.01) w.push(['warn','Grundwasser über Fundamentsohle — Auftrieb/Wasserdruck prüfen']); } }catch(_){}
  }
  if(!w.length){ bar.style.display='none'; bar.innerHTML=''; return; }
  bar.style.display='';
  bar.innerHTML=w.map(([s,m])=>`<div class="plaus-item plaus-${s}">${m}</div>`).join('');
}
// ── A1: Eingabepaket für den Block/Flach-Rechenkern ─────────────────────────────
// Snapshot ALLER Feldwerte, die _doCalculate liest — der Kern konsumiert dann das
// Paket statt des DOM (lokal geschattetes gi). Programmatischer Aufruf (Sweeps,
// Dimensionierung, Tests): _doCalculate({...collectCalcInputs(), raw:{...überschrieben},
// _pure:true}) → liefert {results, worst, G} OHNE UI-Seiteneffekte.
// Noch DOM-gebunden (Inkrement 2): tiefe Helfer intEarthPress/sigVeffTo/avgSigV/
// gwDepth (bg_gw/bg_gwt), govSoilHansen & Co. (SCHICHTEN global) sowie getGF (lw_G/lw_Q)
// — für Geometrie-Sweeps konstant und daher unkritisch.
const _CALC_FIELDS = ['g_bx','g_by','g_hblock','g_uberd','g_kx','g_ky','g_hkopf','g_ex','g_ey',
  'g_gbeton','g_gauf','bg_qu','bg_c1','bg_beta','bg_btyp','bg_bhoehe','bg_delta_fac','bg_delta_sohle','bg_c_gleit','bg_me_ratio','bg_me',
  'tw_phi','tw_c','tw_Ea','tw_Ep',
  'l_NG','l_HGx','l_HGy','l_HWx','l_HWy','l_MGx','l_MGy','l_MWx','l_MWy','l_TG','l_TW',
  'lw_G','lw_Q','lw_G1_sup','lw_G1_inf','lw_Q1','lw_G_inf','lw_G_gzg','lw_Q_gzg',
  'bg_gw','bg_gwt','bg_me',
  'pfahl_dex','pfahl_dex_seite'];
function collectCalcInputs(){
  _clampKopfEcc('g_bx','g_kx','g_by','g_ky','g_ex','g_ey');   // Kopf klemmen VOR dem Snapshot
  const raw={};
  _CALC_FIELDS.forEach(id=>{ raw[id]=gi(id); });
  let c1auto=null;
  try{ if(typeof c1AutoValue==='function') c1auto=c1AutoValue().c1_eff; }catch(_){ }
  return {
    raw,
    kopf_in_gk: document.getElementById('kopf_in_gk')?.checked !== false,
    c1_manual: (typeof _c1Manual!=='undefined' && _c1Manual),
    c1_auto_eff: c1auto,
    LF: LF,
    SCHICHTEN: SCHICHTEN,   // für Varianten eine eigene Kopie übergeben
    _pure: false
  };
}

function _doCalculate(inp){
  const P = inp || collectCalcInputs();
  const _prevCtx = _CALC_CTX; _CALC_CTX = P;
  try { return _doCalculateKern(P); } finally { _CALC_CTX = _prevCtx; }
}
function _doCalculateKern(P){
  // Lokales gi: liest den Snapshot statt des DOM — der GESAMTE Kern (inkl. der nested
  // computeGZT_dir/Combo-Closures) wird damit über das Eingabepaket parametrisierbar.
  const gi = id => (P.raw && P.raw[id] !== undefined) ? P.raw[id] : '0';
  const B=+gi('g_bx'), L=+gi('g_by'), Hb=+gi('g_hblock');
  const ue=Math.max(0,+gi('g_uberd')||0);  // Block: Erdüberdeckung ab OK Block · Flach: Einbindetiefe der Sohle unter GOK
  // Effektive Einbindetiefe t (Sohltiefe unter GOK, treibt q₀/Tiefenbeiwerte):
  //   Block — H_Block + ü (vergrabener Block).  Flach — Feldwert direkt (0 ⇒ Sohle auf GOK, q₀=0).
  const t = (CALC_MODEL==='block') ? (Hb+ue) : ue;
  const Bk=+gi('g_kx'), Lk=+gi('g_ky'), Hk=+gi('g_hkopf');
  const exk=+gi('g_ex'), eyk=+gi('g_ey'), gb=+gi('g_gbeton');
  const qu=+gi('bg_qu');
  const gph=+gi('tw_phi'), gc_=+gi('tw_c');
  const gEa = Math.max(1, +gi('tw_Ea') || 1.35);  // γ_Ea aktiver Erddruck
  const gEp = Math.max(1, +gi('tw_Ep') || 1.40);  // γ_Ep passiver Erddruck
  const delt_fac=+gi('bg_delta_fac');
  const isBlock = CALC_MODEL === 'block';

  // ── Bodenschichten
  const soil  = schichtAtDepth(t);         // Schicht an der Sohle (für γ_b, Steckner φ)
  const govHB = govSoilHansen(t, B);       // Massgebende Schicht für Grundbruch (min φ')
  const phi_k = govHB.phi * Math.PI/180;   // Für Hansen-Grundbruch und Gleiten
  const c_k   = govHB.c;
  const gs    = avgGammaToDepth(t);        // mittlere Wichte bis Sohle
  const gs_b  = soil.gamma;                // Wichte unter Sohle (Hansen Ng-Term)
  const phi_d = Math.atan(Math.tan(phi_k)/gph);
  const c_d   = c_k / gc_;
  const delta_d = delt_fac * phi_d;        // Wandreibungswinkel (Bemessungswert)

  // ── Erddruckbeiwerte
  const Kp = Math.tan(Math.PI/4 + phi_d/2)**2;  // passiv (Rankine, konservativ)
  const Ka = Math.tan(Math.PI/4 - phi_d/2)**2;  // aktiv
  const K0 = 1 - Math.sin(phi_d);               // Ruhedruck (Jaky)

  // ── Steckner GZG/GZT Kennwerte (ausserhalb LF-Loop, geometrieabhängig)
  // Ideelle Druckwandbreite nach Steckner (1989):
  //   bid = B + 0.6·t·tan(φ_k)  [φ_k charakteristisch, Steckner Gl.25/26]
  const phi_k_bid = Math.atan(Math.tan(phi_d) * gph);
  const bid = B + 0.6 * t * Math.tan(phi_k_bid);
  // C₁ nach Steckner 1989 Gl.3/4: {4+0.6(φ−20)}·10⁴·t/2·(1+β/40) [kN/m³]
  // Mehrschicht: tiefengewichteter Mittelwert φ_k; Einzelschicht: φ_k global
  const beta_deg_c1 = +gi('bg_beta') || 0;
  const hbeta_c1 = Math.max(0, +gi('bg_bhoehe') || 0);   // Böschungshöhe (0 = durchlaufend)
  const phi_k_c1 = SCHICHTEN.length > 1 ? avgPhiToDepth(t) : (phi_k * 180/Math.PI);
  const C1_auto = c1Steckner(phi_k_c1, t, beta_deg_c1, hbeta_c1);  // MN/m³ (Steckner-Anteil, Fallback)
  // C₁: im Auto-Modus den Auto-Wert (min Steckner / M_E·Kp/B) live nehmen (folgt β/B/t/φ) und das
  // Feld nachführen; im manuellen Modus (_c1Manual) den Feldwert verwenden.
  const _c1m = P.c1_manual;
  const C1_val = _c1m
    ? Math.max(1, +gi('bg_c1') || C1_auto)
    : Math.max(1, (P.c1_auto_eff != null ? P.c1_auto_eff : C1_auto));
  if(!_c1m && !P._pure){
    const _c1El = document.getElementById('bg_c1');
    if(_c1El && Math.abs((+_c1El.value || 0) - C1_val) > 0.05) _c1El.value = C1_val.toFixed(1);
  }
  const C1_kN = C1_val * 1000;

  // ── Geländeneigung
  const beta_deg=+gi('bg_beta'), btyp=gi('bg_btyp');
  const beta=beta_deg*Math.PI/180;
  let gb_c=1, gb_q=1, gb_g=1;
  if(btyp!=='none' && Math.abs(beta_deg)>0.1){
    // Geländeneigungsfaktoren nach Lang/Huder/Amann 9.2.15: g_c = 1 − β°/147°, g_q = g_γ = (1 − ½·tanβ)⁵
    gb_q=Math.pow(Math.max(0, 1-0.5*Math.tan(Math.abs(beta))), 5); gb_g=gb_q;
    gb_c=Math.max(0, 1-Math.abs(beta_deg)/147);
    // Höhenwirkung (Jul 2026): endliche Böschung (h_β>0) mindert die Grundbruch-Abminderung nur über den
    // Anteil h_β/B_char der Bruchkörpertiefe (B_char = min(B,L)) → weniger Reduktion; durchlaufend (h_β=0)
    // = volle Reduktion (rückwärtskompatibel). Gilt für Block- und Flach-Grundbruch (gemeinsame gb_*).
    const _hbG=Math.max(0,+gi('bg_bhoehe')||0), _frG = _hbG>0 ? Math.min(1, _hbG/Math.max(0.1, Math.min(B,L))) : 1;
    gb_c=1-(1-gb_c)*_frG; gb_q=1-(1-gb_q)*_frG; gb_g=1-(1-gb_g)*_frG;
  }

  // ── Eigengewichte
  const gauf = +gi('g_gauf');
  const V_block = B*L*Hb;
  const V_kopf  = Bk*Lk*Hk;
  // Kopfgewicht in G_k einschliessen? (Option B: DP2a-Kompatibilität = ausschalten)
  const _inclKopf = P.kopf_in_gk;
  // Überdeckung: NUR der Kopf-Beton im ü-Bereich zählt zur ständigen Vertikallast.
  // Die seitliche Auffüllung (Boden über OK Block) wird bewusst NICHT angesetzt
  // (Nutzerentscheid: ständige Vertikallast = nur Betonkörper Block+Kopf + Einwirkung N_G).
  // H_Kopf ist seit Aug 2026 die GESAMTHÖHE des Kopfes (OK Block → OK Kopf). V_kopf = B_K·L_K·H_Kopf
  // enthält den in der Überdeckungszone liegenden Teil damit bereits — der frühere Zusatzterm
  // B_K·L_K·ü wäre jetzt eine Doppelzählung und entfällt.
  const G_ue = 0;
  const _coverFlach = Math.max(0, ue - Hb);           // Flach: Erdüberdeckung über der Platte (Sohltiefe − Plattendicke, nur bei tieferer Einbindung)
  // Erdüberdeckung: der Fundamentkopf verdrängt Boden über seiner Grundfläche
  const _coverVol = _coverFlach > 0
    ? Math.max(0, B*L*_coverFlach - Bk*Lk*Math.min(Hk, _coverFlach)) : 0;
  const Gk0 = isBlock
    ? (V_block + (_inclKopf ? V_kopf : 0))*gb + G_ue  // Block: Kopf optional
    // Flach: Platte + Fundamentkopf (Beton, wie beim Block über kopf_in_gk steuerbar)
    // + Erdüberdeckung. Der Kopfterm fehlte bis Aug 2026 ganz — H_Kopf hatte beim
    // Flachfundament KEINEN Einfluss auf die Vertikallast, obwohl der Kopf im 3D
    // gezeichnet und im Bericht bemasst wird.
    : (B*L*Hb + (_inclKopf ? V_kopf : 0))*gb + _coverVol*gauf;
  // Auftrieb: Fundamentkörper unter GW-Spiegel (γw=10 kN/m³, effektive Gewichte)
  // ST-Fundament-verifiziert (Test02): N = Block + Auffüllung − Auftrieb = 111.2 kN
  const _subH = Math.min(Math.max(0, t - gwDepth()), Hb);
  // Auftrieb auch auf den eingetauchten Teil des Fundamentkopfes (Okt 2026): steht der GW-Spiegel
  // ÜBER der Oberkante des Körpers, taucht der Kopf mit ein. Kopf-Unterkante = OK Körper
  // (Block: Tiefe ü · Flach: Tiefe t − H_Platte), Oberkante höchstens GOK. Nur wenn das Kopfgewicht
  // überhaupt in G_k steckt (kopf_in_gk). Ohne GW über OK Körper = 0 ⇒ ST-Werte unberührt.
  const _zKbot = isBlock ? ue : Math.max(0, t - Hb);
  const _zKtop = Math.max(0, _zKbot - Hk);
  const _subK  = _inclKopf ? Math.max(0, _zKbot - Math.max(gwDepth(), _zKtop)) : 0;
  const G_auftrieb = (_subH > 0 ? B*L*_subH*10 : 0) + Bk*Lk*_subK*10;
  const Gk = Gk0 - G_auftrieb;

  // ── Auflasten (Ballastierung — nur Flach + Stahl)
  let N_auf_k=0, Mx_auf_k=0, My_auf_k=0;
  if(!isBlock && FLACH_MAT==='stahl'){
    AUFLASTEN.forEach(a=>{ if(a.active===false) return; N_auf_k+=a.Pk; Mx_auf_k+=a.Pk*a.dy; My_auf_k+=a.Pk*a.dx; });
  }

  // ── Mastlasten
  const NG=+gi('l_NG'), HGx=+gi('l_HGx'), HGy=+gi('l_HGy');
  const HWx=+gi('l_HWx'), HWy=+gi('l_HWy');
  const MGx=+gi('l_MGx'), MGy=+gi('l_MGy');
  const MWx=+gi('l_MWx'), MWy=+gi('l_MWy');
  // Momentenarm Sohle → OK Kopf = Körperhöhe + H_Kopf — für BEIDE Modelle gleich.
  // Seit H_Kopf die GESAMTHÖHE des Kopfes ist (Aug 2026), ist der Arm einbindungsunabhängig:
  // eine grössere Überdeckung senkt die Sohle um ü UND den Kopf um ü, der Abstand bleibt.
  // (Vorher stand hier beim Block t + H_Kopf = H_Block + ü + Überstand — mit der neuen
  //  Definition wäre das um ü zu lang und Sohldruck/Ausmitte/Grundbruch fielen zu ungünstig aus.)
  const arm = Hb + Hk;

  // Sohlfläche
  const A = B*L, Wx_=B*L**2/6, Wy_=L*B**2/6;
  const NW = _nwFor(isBlock?'block':'flach');

  // ── Seitenwiderstände des Blocks (nur für die INFORMATIVEN Sohlgrössen; der massgebende
  //    Steckner-GZT rechnet eigenständig in computeGZT_dir)
  //    Mantelreibung T = (c_d + σ'v,m·tan δ_d)·A_Mantel → Zuschlag zum GRUNDBRUCH
  //    Passiver Erddruck Ep_x/Ep_y                       → Widerstand beim GLEITEN
  const sigma_v_avg = avgSigV(t);

  // Reibung pro Seitenfläche (Mantelreibung vertikal)
  const Tf_x = (c_d + sigma_v_avg*Math.tan(delta_d)) * (L*t); // 2 Flächen in x-Richtung (B×t je)
  const Tf_y = (c_d + sigma_v_avg*Math.tan(delta_d)) * (B*t); // 2 Flächen in y-Richtung

  // Passiver Erddruck schichtweise integriert [kN/m Breite], Bemessungswerte
  const Ep_per_m = intEarthPress(t, 1, 'p', gph, gc_, false, false).E;
  const Ep_x = Ep_per_m * L;
  const Ep_y = Ep_per_m * B;

  // Mantelreibung vertikal, alle vier Seitenflächen (geht nur in den Grundbruch ein)
  const Tf_total = 2*(Tf_x + Tf_y); // beide Seiten × 2


  // Lastbeiwerte — einmal lesen, nicht pro LF-Iteration
  const _gG1sup = +gi('lw_G1_sup') || 1.20;  // Typ 1 sup (Kippen, destabilisierend)
  const _gG1inf = +gi('lw_G1_inf') || 0.80;  // Typ 1 inf (Kippen, stabilisierend N)
  const _gQ1    = +gi('lw_Q1')     || 1.50;  // Typ 1 veränderlich
  const _gG2inf = gGinfT2(isBlock ? 'block' : 'flach');  // Typ 2 inf (Gleiten, günstiger N)

  const results = (P.LF||LF).map(lf=>{
    const c = lf.comp;
    const NG_lf  = c.NG  ? NG  : 0;
    const HGx_lf = c.HGx ? HGx : 0;
    const HGy_lf = c.HGy ? HGy : 0;
    const MGx_lf = c.MGx ? MGx : 0;
    const MGy_lf = c.MGy ? MGy : 0;
    const HWx_lf = c.HWx ? HWx : 0;
    const HWy_lf = c.HWy ? HWy : 0;
    const MWx_lf = c.MWx ? MWx : 0;
    const MWy_lf = c.MWy ? MWy : 0;

    // Lastbeiwerte aus zentraler Karte (Typ 2/ST für GZT, GZG für Gebrauchstauglichkeit)
    const {gG, gW} = getGF(lf);

    // ── Typ-2-Nachweise (Sohlspannung, Grundbruch, Gleiten) für EINE Kombination
    //    fE = Beiwert Fundament-Eigengewicht · fG = ständige Mastlasten (N_G, H_G, M_G gemeinsam)
    //    · fQ = veränderliche Lasten. Gerechnet wird je Lastfall der volle Satz aus buildCombos
    //    (SIA 260 Typ 2) — derselbe wie im Steckner-GZT und im Pfahlfundament. Massgebend ist je
    //    Nachweis das kleinste η; jeder Nachweis führt seine eigene Kombination mit (r.t2).
    const _isGzgLF = lf.nw === 'gzg';
    // Charakteristische Horizontallasten (ohne γ)
    const Hxk_lf = HGx_lf + HWx_lf;
    const Hyk_lf = HGy_lf + HWy_lf;
    const evalT2 = (fE, fG, fQ) => {
      const Nd_mast = fG*NG_lf + fE*Gk;
      // Auflasten: ständig mit γ_G
      const Nd  = Nd_mast + fG*N_auf_k;
      const Hxd = fG*HGx_lf + fQ*HWx_lf;
      const Hyd = fG*HGy_lf + fQ*HWy_lf;
      const Hd  = Math.sqrt(Hxd**2 + Hyd**2);

      // Momente in Sohle (inkl. Auflasten-Momente)
      const Mxd = Hxd*arm + fG*MGx_lf + fQ*MWx_lf + Nd_mast*eyk + fG*Mx_auf_k;
      const Myd = Hyd*arm + fG*MGy_lf + fQ*MWy_lf + Nd_mast*exk + fG*My_auf_k;
      // Externe Momentanteile ohne H×arm (für Pfahlsicherung: M_d am Mastfuss)
      const Md_ext_x = fG*MGx_lf + fQ*MWx_lf + Nd_mast*eyk + fG*Mx_auf_k;
      const Md_ext_y = fG*MGy_lf + fQ*MWy_lf + Nd_mast*exk + fG*My_auf_k;

      // ── 1. SOHLSPANNUNGEN (beide Modelle gleich)
      // Achsbezogene Momente für Sohldruck + Ausmitte: eine Horizontalkraft in x erzeugt ein
      // Moment um die y-Achse (→ Ausmitte in x, Kante B), eine Kraft in y ein Moment um die
      // x-Achse (→ Ausmitte in y, Kante L). Mxd/Myd (oben) folgen der Lastrichtungs-Konvention
      // für Block-GZT/3D/Bericht — hier daher eigene, korrekt gepaarte Achsmomente
      // (behebt: Last in x erzeugte fälschlich Ausmitte in y).
      const M_ax = Hyd*arm + fG*MGx_lf + fQ*MWx_lf + Nd_mast*eyk + fG*Mx_auf_k;  // um x-Achse → Ausmitte y
      const M_ay = Hxd*arm + fG*MGy_lf + fQ*MWy_lf + Nd_mast*exk + fG*My_auf_k;  // um y-Achse → Ausmitte x
      const s0=Nd/A, smx=M_ax/Wx_, smy=M_ay/Wy_;
      // Eckspannungen aus den BETRÄGEN der Momentenanteile: das Vorzeichen legt nur fest, WELCHE Ecke
      // gedrückt wird — die massgebende Max-/Min-Ecke ist richtungssymmetrisch. Vorher (signierte Summe)
      // wanderte bei negativem Moment das echte Maximum in `smin` → Sohlspannung/Grundbruch rechneten mit
      // der KLEINEREN Ecke (unkonservativ) und die klaffende Fuge (smin<0) wurde nicht erkannt.
      const _amx=Math.abs(smx), _amy=Math.abs(smy);
      const smax=s0+_amx+_amy, smin=s0-_amx-_amy;
      const ex_=M_ay/Nd, ey_=M_ax/Nd;
      const kB=B/6, kL=L/6, inKern=Math.abs(ex_)<=kB && Math.abs(ey_)<=kL;
      const etaSIG = qu/(smax>0.001?smax:0.001);

      // Effektive Fläche (Meyerhof) — Be/Le = effektive Abmessung in x bzw. y.
      // GÜLTIGKEIT (Aug 2026): der Clamp auf 0.1 m täuschte bei sehr grosser Ausmitte eine Rest-
      // fläche vor, die es physikalisch nicht gibt → R_d fror ein statt gegen 0 zu gehen
      // (verifiziert: M = 60 und 120 kNm lieferten beide R_d = 169.97). Liegt die Resultierende
      // AUSSERHALB der Sohlfläche (|e| ≥ B/2 bzw. L/2), existiert keine effektive Fläche mehr —
      // der Grundbruchnachweis ist dann nicht führbar (das Fundament kippt, Gleichgewicht in der
      // Sohle unmöglich). Zusätzlich wird die EC7/DIN-4017-Anwendungsgrenze |e|/B > 1/3 markiert,
      // ab der die Meyerhof-Ersatzfläche als Näherung gilt.
      const _eRx = Math.abs(ex_)/Math.max(1e-9, B), _eRy = Math.abs(ey_)/Math.max(1e-9, L);
      const effAusserhalb = _eRx >= 0.5 || _eRy >= 0.5;      // Resultierende ausserhalb der Sohle
      const effUeberDrittel = !effAusserhalb && (_eRx > 1/3 || _eRy > 1/3);
      const Be=Math.max(0.01,B-2*Math.abs(ex_));
      const Le=Math.max(0.01,L-2*Math.abs(ey_));
      // Bruchmechanik-Breite: kleinere effektive Abmessung (Hansen B'), grössere = L'
      // (Nγ-Term + Formbeiwerte über B'/L' ≤ 1 — richtungsunabhängig, egal ob Ausmitte in x oder y)
      const B_eff=Math.min(Be,Le), L_eff=Math.max(Be,Le);
      const rBL = L_eff>0.01 ? B_eff/L_eff : 1;
      // ── Auflastspannung q₀ neben der Sohle — EFFEKTIVE Vertikalspannung (Aug 2026, Bugfix).
      // Vorher `gs*t` mit gs = avgGammaToDepth(t) = TOTALwichte → unter GW bis 2× zu hoch
      // (verifiziert: t=2.0 m, γ=19/γ'=9.5, GW an GOK ⇒ q₀ 38 statt 19 kPa) und damit der
      // Grundbruchwiderstand unkonservativ. `sigVeffTo(t)` integriert schichtweise mit γ' unter
      // dem GW-Spiegel; ohne GW identisch zu gs·t (Golden unberührt).
      const q0 = sigVeffTo(t);
      // Wichte UNTER der Sohle für den Nγ-Term: der Prandtl-Bruchkörper reicht ~0.5·B′ unter die
      // Sohle. Liegt der GW-Spiegel darüber, wirkt dort γ' (Auftrieb) — anteilig interpoliert
      // (DIN 4017 / EC7: γ₂ = γ′ bei GW über Sohle, Übergang innerhalb der Bruchzone).
      const _zgw   = gwDepth();
      const _dBr   = Math.max(0.1, 0.5*B_eff);                       // Tiefe der Bruchzone
      const _fSub  = Math.min(1, Math.max(0, (t + _dBr - _zgw)/_dBr)); // Anteil unter GW
      const gs_b_e = gs_b*(1-_fSub) + gamEff(soil)*_fSub;

      // ── 2. GRUNDBRUCH — erweiterte Tragfähigkeitsformel (Lang/Huder/Amann 9.2, SIA D 0197), Format
      // E_N,d ≤ R_N,d = σ_f,d·b̄·l̄. Block: ohne Tiefenfaktoren, weil dort die Mantelreibung separat zählt.
      const A_eff = Be*Le;
      const GB = grundbruchSIA({ phi:phi_d, c:c_d, q:q0, gam:gs_b_e, B:B_eff, L:L_eff, T:Hd, N:Nd, t: isBlock ? 0 : t,
                                 gc:gb_c, gq:gb_q, gg:gb_g });
      const Nq=GB.Nq, Nc=GB.Nc, Ng=GB.Ng, ic=GB.ic, iq=GB.iq, ig=GB.ig, al=GB.al;
      let Rd, etaGB;
      if(isBlock){
        // Block (informativ): Sohlwiderstand + Mantelreibungsanteil, verglichen mit der Kantenpressung —
        // die Resultierende liegt beim eingespannten Block regelmässig ausserhalb des Kerns, eine
        // Ersatzfläche im Normformat wäre dort nicht aussagekräftig.
        Rd = GB.sigf + Tf_total / A;
        etaGB = Rd / (smax>0 ? smax : 0.001);
      } else {
        // Flach: R_d = σ_f,d·A′ gegen N_d (σ_f,d auf der Ersatzfläche, Rd bleibt als Spannung [kPa] geführt)
        Rd = GB.sigf;
        etaGB = Rd*A_eff / Math.max(0.001, Nd);
      }
      const gbD = { Aeff:A_eff, sEff:Nd/Math.max(1e-9,A_eff), RdKN:GB.sigf*A_eff, sq:GB.sq, sc:GB.sc, sg:GB.sg, dq:GB.dq, dc:GB.dc, undraen:GB.undraen, t: isBlock ? 0 : t,
                    iq:GB.iq, ic:GB.ic, ig:GB.ig, Nq:GB.Nq, Nc:GB.Nc, Ng:GB.Ng, gam:gs_b_e, Bp:B_eff, Lp:L_eff };
      // Resultierende ausserhalb der Sohlfläche ⇒ keine effektive Fläche ⇒ Nachweis NICHT führbar.
      // Kein Zahlenwert ausweisen (der geklemmte R_d wäre frei erfunden) → η = 0 (nicht erfüllt).
      // NUR beim FLACHFUNDAMENT: dort ist der Sohldruck ein echtes Versagenskriterium. Beim
      // eingespannten BLOCK ist die Sohldruckverteilung explizit informativ (Standsicherheit läuft
      // über Steckner Gl.66) und |e| ≥ B/2 ist dort der Regelfall — ein η_GB = 0 wäre irreführend.
      if(effAusserhalb && !isBlock){ Rd = 0; etaGB = 0; }

      // ── 3. GLEITEN — SIA 267 Typ 2: Widerstand und Einwirkung aus DERSELBEN Kombination
      const Nd_gl = Nd;
      let Rgl, etaGL, gl_dK=0, gl_dD=0, gl_cR=0, gl_cAn=false;
      if(isBlock){
        // Block: Sohlreibung (volles φ'_d) + passiver Erddruck der Stirnfläche
        const Rgl_sohle = Nd_gl*Math.tan(phi_d) + c_d*A;
        // Passiver Widerstand in massgebender Richtung
        const Rgl_ep = Math.abs(Hxd)>=Math.abs(Hyd) ? Ep_x : Ep_y;
        Rgl = Rgl_sohle + Rgl_ep;
        etaGL = Rgl / (Hd>0.001 ? Hd : 0.001);
      } else {
        // Gleiten: δ_Sohle aus Selektor
        const dSohleFac = +gi('bg_delta_sohle') || +gi('bg_delta_fac') || 0.667;
        // SIA 267 Ziff. 8.4.1.1: δ_k = φ'_k (rau) bzw. ½…⅔·φ'_k (glatt), höchstens 35°; der
        // Bemessungswert δ_d entsteht mit γ_φ auf tan δ (Ziff. 8.5.2.2). Vorher: Faktor·φ'_d, ohne Grenze.
        const _phiK_gl = Math.atan(Math.tan(phi_d) * gph);
        gl_dK = Math.min(dSohleFac * _phiK_gl, 35*Math.PI/180);
        gl_dD = Math.atan(Math.tan(gl_dK) / Math.max(1, gph));
        // Ziff. 8.4.1.2: Kohäsion im Gleitwiderstand nur, wenn sie dauerhaft erhalten bleibt (Wahl
        // bg_c_gleit, Vorgabe: nicht ansetzen). Gl. (31): R_T,d = (E_N,d·tan δ_d + A'_d·c'_d)/γ_R —
        // mit der WIRKSAMEN Fläche A', γ_R = 1.0.
        gl_cAn = String(gi('bg_c_gleit')) === '1';
        gl_cR = gl_cAn ? c_d * A_eff : 0;
        Rgl = Nd_gl*Math.tan(gl_dD) + gl_cR;
        etaGL = Rgl / (Hd>0.001 ? Hd : 0.001);
      }
      return { Nd_mast, Nd, Hxd, Hyd, Hd, Mxd, Myd, Md_ext_x, Md_ext_y, M_ax, M_ay, s0, smx, smy, _amx, _amy, smax, smin, ex_, ey_, kB, kL, inKern, etaSIG, Nq, Nc, Ng, al, ic, iq, ig, _eRx, _eRy, effAusserhalb, effUeberDrittel, Be, Le, B_eff, L_eff, rBL, q0, _zgw, _dBr, _fSub, gs_b_e, Rd, etaGB, gbD, Nd_gl, Rgl, etaGL, glD:{dK:gl_dK, dD:gl_dD, cR:gl_cR, cAn:gl_cAn, Aeff:A_eff} };
    };
    // Anzeige-Kombination der flachen Ergebnisfelder: alles ungünstig (= Komb. 8); bei reinen
    // GZG-Lastfällen die charakteristische Kombination.
    let { Nd_mast, Nd, Hxd, Hyd, Hd, Mxd, Myd, Md_ext_x, Md_ext_y, M_ax, M_ay, s0, smx, smy, _amx, _amy, smax, smin, ex_, ey_, kB, kL, inKern, etaSIG, Nq, Nc, Ng, al, ic, iq, ig, _eRx, _eRy, effAusserhalb, effUeberDrittel, Be, Le, B_eff, L_eff, rBL, q0, _zgw, _dBr, _fSub, gs_b_e, Rd, etaGB, gbD, Nd_gl, Rgl, etaGL, glD } = _isGzgLF ? evalT2(1.00, gG, gW) : evalT2(gG, gG, gW);
    let t2 = null;
    if(!_isGzgLF){
      const _all = buildCombos(_gG2inf, gG, gW).map(cb =>
        Object.assign(evalT2(cb.fE, cb.fG, cb.fQ), {komb:cb.nr, fE:cb.fE, fG:cb.fG, fQ:cb.fQ}));
      const _pick = k => _all.reduce((x,y) => y[k] < x[k] ? y : x);
      const _view = o => ({ Nd:o.Nd, Hxd:o.Hxd, Hyd:o.Hyd, Hd:o.Hd, Mxd:o.Mxd, Myd:o.Myd,
        ex:o.ex_, ey:o.ey_, inKern:o.inKern, smax:o.smax, smin:o.smin, s0:o.s0,
        effAusserhalb:o.effAusserhalb, effUeberDrittel:o.effUeberDrittel,
        eRx:+o._eRx.toFixed(3), eRy:+o._eRy.toFixed(3),
        etaSIG:o.etaSIG, etaGB:o.etaGB, etaGL:o.etaGL, Rd:o.Rd, Rgl:o.Rgl, Nd_gl:o.Nd,
        Be:o.Be, Le:o.Le, q0:o.q0, gbD:o.gbD, glD:o.glD, komb:o.komb, fE:o.fE, fG:o.fG, fQ:o.fQ });
      t2 = { sig:_view(_pick('etaSIG')), gb:_view(_pick('etaGB')), gl:_view(_pick('etaGL')),
             // alle 8 Kombinationen (Berichtstabelle, Nachvollziehbarkeit)
             all:_all.map(o => ({ nr:o.komb, fE:o.fE, fG:o.fG, fQ:o.fQ, Nd:o.Nd, Hd:o.Hd,
                                  etaSIG:o.etaSIG, etaGB:o.etaGB, etaGL:o.etaGL })) };
      etaSIG = t2.sig.etaSIG;
      etaGB  = t2.gb.etaGB;  Rd  = t2.gb.Rd;
      etaGL  = t2.gl.etaGL;  Rgl = t2.gl.Rgl;  Nd_gl = t2.gl.Nd;
    }

    // ── 4. KIPPNACHWEIS (klaffende Fuge) — SIA 267 GZT Typ 1 (Stabilität)
    // γ_G,sup (1.20) für destabilisierende Momente, γ_G,inf (0.80) für stabilisierende Normalkraft
    // Normalkraft mit günstigem Faktor (stabilisierend → kleiner N = ungünstiger für Ausmitte)
    // G_k beim Kippen günstig wirkend → γ_G,inf (Typ 1)
    const Nd_kipp  = _gG1inf*NG_lf + _gG1inf*Gk + _gG1inf*N_auf_k;
    const Hxd_kipp = _gG1sup*HGx_lf + _gQ1*HWx_lf;
    const Hyd_kipp = _gG1sup*HGy_lf + _gQ1*HWy_lf;
    // Achsbezogen: Kraft in x → Moment um y-Achse (Ausmitte x), Kraft in y → Moment um x-Achse (Ausmitte y)
    const Mxd_kipp = Hyd_kipp*arm + _gG1sup*MGx_lf + _gQ1*MWx_lf + Nd_kipp*eyk + _gG1sup*Mx_auf_k;  // um x → Ausmitte y
    const Myd_kipp = Hxd_kipp*arm + _gG1sup*MGy_lf + _gQ1*MWy_lf + Nd_kipp*exk + _gG1sup*My_auf_k;  // um y → Ausmitte x
    const ex_kipp  = Myd_kipp / Math.max(0.001, Nd_kipp);
    const ey_kipp  = Mxd_kipp / Math.max(0.001, Nd_kipp);
    const etaKx=kB/Math.max(0.001,Math.abs(ex_kipp));
    const etaKy=kL/Math.max(0.001,Math.abs(ey_kipp));
    // SIA 267 klaffende Fuge (Flachfundament): (ea/a)² + (eb/b)² ≤ 1/9
    const ea_a  = Math.abs(ex_kipp) / B;
    const eb_b  = Math.abs(ey_kipp) / L;
    const klaf_val  = ea_a**2 + eb_b**2;
    const eta_klaf  = !isBlock ? (1/9) / Math.max(1e-6, klaf_val) : Infinity;

    // (Verkippen-Nachweis entfernt Jun 2026 — Steckner GZT Gl.66 deckt das
    //  Kippen des eingespannten Blocks vollständig und genauer ab)

    // ── 6. GZG-Variablen — Berechnung erfolgt nach dem GZT-Block (braucht phi_k_rad)
    let etaGZG = Infinity, alpha_GZG_calc = 0;
    let tan_a1_GZG=0, tan_a2_GZG=0, M1_GZG_val=0, M2_GZG_val=0;
    let Malpha_GZG_val=0, Mu_char_GZG=0, M_ok_char_GZG=0;
    let tanZul_GZG_=0.005, gzgPerm_=true;   // verwendeter Grenzwert + Lastfalltyp (fuer Anzeige)
    // Massgebende GZG-Kombination (Anzeige): Richtung + Vergleichswerte + Lastbeiwerte
    let gzgDir_='—', gzgHxk_=0, gzgHyk_=0, gzgMxk_=0, gzgMyk_=0, gzgGamG_=1, gzgGamQ_=1;
    let H_k_GZG=0, N_k_GZG=0, gzgBettungKollaps=false;

    // ── 7. GZT STANDSICHERHEIT STECKNER (Nulllinie + Grenzmoment)
    // Modell nach Steckner (Bautechnik 2/1989), §5, ST-Fundament-verifiziert:
    //   Ew  = Ep/γ_Ep − Ea·γ_Ea + R0      (Gl.43, über NL)
    //   E'w = E'p/γ_Ep + R'0              (Gl.44, unter NL)
    //   NL aus Gl.54: Ew − E'w = H* + Ru  (Bisektion, δp-Reduktion nach Gl.49/50)
    //   Nu = (V+G+Ra−Rp+R'p)/γ_Ep (Gl.46) · u=(A−x)/2, x=Nu/(B·pu) (Gl.47/48)
    let etaGZT = Infinity, Mu_GZT = 0, y_NL_GZT = 0;
    let Ea_GZT = 0, Ew_GZT = 0, E0b_GZT = 0, E0a_GZT = 0, Epb_GZT = 0, Nu_GZT = 0, Ru_GZT = 0;
    // GZT erweiterte Terme — ausserhalb if(isBlock) für return-Objekt zugänglich
    let Epa_GZT_=0, Ra_v_GZT_=0, Rp_va_GZT_=0, Rp_vb_GZT_=0;
    let u_ecc_GZT_=0, arm_v_GZT_=0, arm_vp_GZT_=0;
    let komb_GZT_=0;   // massgebende Lastfall-Kombination (1-8, 0 = n/a)
    let kombs_GZT_=[]; // ALLE Kombinationen dieses Lastfalls (Auswahl im 3D, Nachvollziehbarkeit)
    let Nd_GZT_=0;     // N_d DIESER Kombination (die Gl.46-Herleitung muss damit aufgehen)
    let bzGred_=0, bzGredAktiv_=false;   // Bauzustand: effektiver γ_G im Aushubzustand
    // Zustand A — Aushub ohne Massnahme (Sicherungs-Modul)
    let etaGZT_ex_=Infinity, Mu_GZT_ex_=0, komb_GZT_ex_=0, dEx_used_=0, dEx_side_='', dEx_gov_=0, yNL_ex_=0;
    let dEx_degen_=false;   // Steckner-Mechanismus im Aushubzustand degeneriert (s. Zustand-A-Loop)
    let Mokx_sign_=0;       // signiertes Kippmoment (Quer) der massgebenden Kombination
    let etaGZG_ex_=Infinity, alpha_GZG_ex_=0, Mu_char_GZG_ex_=0;
    const mob = SETTINGS.mob ?? 0.25;  // ausserhalb if(isBlock) — wird im return-Objekt benötigt
    const _stMobExp = !(typeof SETTINGS!=='undefined' && SETTINGS.stecknerMob===false);
    // Passivdruck über NL mobilisieren (Standard AN): E_p,mob = E_p0 + mob·(E_p − E_p0), E_p0 = Ruhedruck K0
    // auf der Stirnfläche. Entspricht DC-Fundament („abgemindert zu mob·E_p,k") und dem Diagramm-Ew.
    // Abschaltbar (SETTINGS.stecknerMob===false) → voller Passivdruck λ_p (Steckner-Papier Gl.32).
    const _stMob = !(typeof SETTINGS!=='undefined' && SETTINGS.stecknerMob===false);
    const _lfNW = lf.nw || 'beide';
    const doGZT = _lfNW !== 'gzg';   // false nur wenn LF explizit nur GZG
    const doGZG = _lfNW !== 'gzt';   // false nur wenn LF explizit nur GZT
    if(isBlock) {
      // Charakteristische Kennwerte (φ_k zurückrechnen aus φ_d)
      const phi_k_rad = Math.atan(Math.tan(phi_d) * gph);
      const tan_p2 = Math.tan(phi_k_rad);        // Sohlreibungswinkel φ₂ = φ_k (Steckner §3.5)
      const tan_d1 = Math.tan((2/3)*phi_k_rad);  // δ₁ = 2/3·φ (Gl.8) — Ra/R0-Reibungen

      // ── Grenzwert Bodenpressung pu (Steckner Gl.5-7), als Widerstand /γ_Ep
      // σ'v(t): effektive Überlagerung an der Sohle (GW-wirksam)
      // ST-verifiziert Test02: pu0 = 1445.4, pu_d = 1032.5 (φ=30°, σ'v=54.0)
      const pu0 = (1 + 3.15*tan_p2*(1 - Math.sin(phi_k_rad))**2)
                * Math.exp(Math.PI * tan_p2)
                * Math.tan(Math.PI/4 + phi_k_rad/2)**2 * sigVeffTo(t);
      const _bp_pu = (btyp!=='none' && beta < 0) ? beta : 0;   // βp<0 → Abminderung Gl.7
      const pu0_eff = pu0 * (_bp_pu < 0 ? Math.max(0, 1 + 0.5*_bp_pu)**5 : 1);

      // ── GZT-Berechnung je Richtung (Steckner Gl.27-66, ST-Fundament-verifiziert)
      // A_pl: Fundamentbreite in der Momentenebene, B_q: Breite quer dazu
      // fac (optional): {gEa, gEp, N}   — charakteristische Basis (GZG Gl.21: gEa=gEp=1, N=N_k)
      //                 {dExP}          — einseitiger Aushub auf der PASSIVSEITE [m ab GOK]:
      //                                   Ep-Integrale ab Aushubsohle, bid und pu reduziert
      //                 {dExA}          — Aushub auf der AKTIVSEITE: Ea (günstig) und E'p/R'p
      //                                   (ungünstig: E'w und Nu sinken) ab Aushubsohle
      //                 {dExS}          — Aushub PARALLEL zur Bewegungsrichtung (Längsfall): legt
      //                                   genau EINE der beiden Steckner-Seitenflächen frei →
      //                                   Ruhedruck E0/E0' und damit R0/R'0 dort reduziert (Gl.34/35).
      //                                   Geometrie: E0 wirkt auf die 2 Flächen PARALLEL zur Last
      //                                   (Breite 2·A_pl); der gleisparallele Graben liegt genau an
      //                                   einer davon, sobald die Längsrichtung massgebend ist.
      function computeGZT_dir(H_d_dir, M_ok_dir, A_pl, B_q, fac) {
        const _gEa = fac && fac.gEa !== undefined ? fac.gEa : gEa;
        const _gEp = fac && fac.gEp !== undefined ? fac.gEp : gEp;
        const _N   = fac && fac.N   !== undefined ? fac.N   : Nd;
        const _dExP = fac && fac.dExP > 0 ? Math.min(fac.dExP, t*0.99) : 0;
        const _dExA = fac && fac.dExA > 0 ? Math.min(fac.dExA, t*0.99) : 0;
        const _dExS = fac && fac.dExS > 0 ? Math.min(fac.dExS, t*0.99) : 0;
        // Steckner-Erweiterung (Option): Böschungs-Abminderung des passiven Erdwiderstands.
        // fEp  → E_p (über NL, auf der Bewegungs-/Passivseite) · fEpp → E'_p (unter NL, Gegenseite).
        // Beide default 1 ⇒ Original-Steckner (β_a=β_p=0), bit-identisch.
        const _fEp  = fac && fac.fEp  !== undefined ? fac.fEp  : 1;
        const _fEpp = fac && fac.fEpp !== undefined ? fac.fEpp : 1;
        // pu (Gl.5): Sohldruckkeil liegt auf der Passivseite — Überlagerung dort reduziert
        const _svT  = sigVeffTo(t);
        const _puFac = (_dExP > 0 && _svT > 1e-6)
          ? Math.max(0, _svT - sigVeffTo(_dExP)) / _svT : 1;
        const pu_d = pu0_eff * _puFac / _gEp;
        if(H_d_dir < 0.01) return {
          eta:Infinity, Mu:0, y_nl:0,
          Ew:0, E0b:0, E0a:0, Epb:0, Epa:0, Ea_d:0,
          Nu:Math.max(0, _N)/_gEp, Ru:0, u_ecc:A_pl/2,
          Ra_v:0, Rp_va:0, Rp_vb:0, arm_v:0, arm_vp:0, dp_fac:0.5, x_keil:0, pu_d
        };

        // Ideelle Druckwandbreite in Bewegungsrichtung (Gl.23-26, Regelfall B ≥ b_kr)
        const bidD = A_pl + 0.6 * t * Math.tan(phi_k_rad);
        // Passivseite mit Aushub: ideelle Breite aus wirksamer Resttiefe (Gl.25, konservativ)
        const bidP = _dExP > 0 ? A_pl + 0.6 * Math.max(0, t - _dExP) * Math.tan(phi_k_rad) : bidD;

        // ── Kräfte bei NL-Lage y und Wandreibungsfaktor dpf (δp = dpf·φ_k)
        // Erddrücke charakteristisch, NUR auf Blockfläche (ü→h bzw. h→t):
        //   Ea: λa(δ₁=2/3φ) Gl.27/31 · Ep: λp(δp) Gl.28/32 · E'p: λ'p(δp) Gl.29/33
        // Ruhedruck auf die 2 Seitenflächen: Breite A ×2, OHNE γ-Faktor (Gl.34/35)
        // ST-verifiziert Test02: Ea=32.4 Ep=294.7 E'p=174.5 E0=47.0 E0'=71.7 exakt
        const F = (y, dpf) => {
          const h = Math.max(0.001, t - y);
          const Ea_k  = Math.max(0, intEarthPress(h, bidD,'a',gph,gc_,true,true,undefined,_dExA).E
                                  - intEarthPress(ue,bidD,'a',gph,gc_,true,true,undefined,_dExA).E);
          let Ep_k    = _fEp * Math.max(0, intEarthPress(h, bidP,'p',gph,gc_,true,true,dpf,_dExP).E
                                  - intEarthPress(ue,bidP,'p',gph,gc_,true,true,dpf,_dExP).E);
          // Mobilisierung über NL (Standard): E_p,mob = E_p0 + mob·(E_p − E_p0), E_p0 = Ruhedruck K0 auf
          // der Stirnfläche (Breite bidP). Reduziert Passivdruck+Reibung R_p (Gl.39 folgt Ep_k). Nur über NL.
          if(_stMob){
            const Ep0 = _fEp * Math.max(0, intEarthPress(h, bidP,'0',gph,gc_,true,false,undefined,_dExP).E
                                    - intEarthPress(ue,bidP,'0',gph,gc_,true,false,undefined,_dExP).E);
            Ep_k = Ep0 + mob*(Ep_k - Ep0);
          }
          const Epp_k = _fEpp * Math.max(0, intEarthPress(t, bidD,'pp',gph,gc_,true,true,dpf,_dExA).E
                                  - intEarthPress(h, bidD,'pp',gph,gc_,true,true,dpf,_dExA).E);
          // Ruhedruck auf die 2 Seitenflächen (Gl.34/35), Breite 2·A_pl. Bei gleisparallelem Aushub
          // (_dExS, Längsfall) ist genau EINE der beiden Flächen freigelegt → getrennt integrieren:
          // eine Fläche voll (A_pl), eine ab Aushubsohle (A_pl mit zSurf). Ohne _dExS bit-identisch.
          const _e0 = (zTo, zFrom) => _dExS > 0
            ? Math.max(0, intEarthPress(zTo, A_pl,'0',gph,gc_,true,false).E
                        - intEarthPress(zFrom, A_pl,'0',gph,gc_,true,false).E)
            + Math.max(0, intEarthPress(zTo, A_pl,'0',gph,gc_,true,false,undefined,_dExS).E
                        - intEarthPress(zFrom, A_pl,'0',gph,gc_,true,false,undefined,_dExS).E)
            : Math.max(0, intEarthPress(zTo, 2*A_pl,'0',gph,gc_,true,false).E
                        - intEarthPress(zFrom, 2*A_pl,'0',gph,gc_,true,false).E);
          const E0_k  = _e0(h, ue);
          const E0p_k = _e0(t, h);
          const tdp = Math.tan(dpf * phi_k_rad);
          // Reibungskräfte charakteristisch (Gl.38-42) — ST-verifiziert: Rp = Ep_k·tanδp
          const Ra  = Ea_k * tan_d1;                      // Gl.38 (δ₁ = 2/3φ)
          const Rp  = Ep_k * tdp, Rpp = Epp_k * tdp;      // Gl.39/40 (δp)
          const R0  = E0_k * tan_d1, R0p = E0p_k * tan_d1;// Gl.41/42 (×2 in Breite enthalten)
          // Bemessungswerte horizontal
          const Ea_d = Ea_k*_gEa, Ep_d = Ep_k/_gEp, Epp_d = Epp_k/_gEp;
          const Ew_d  = Math.max(0, Ep_d - Ea_d + R0);    // Gl.43
          const Ewp_d = Epp_d + R0p;                       // Gl.44
          // Bodendruckkraft Gl.46: R'p wirkt ABWÄRTS (+), als Widerstand /γ_Ep
          // ST-verifiziert: Nu_k/1.40 = 53.5 (Test02) bzw. 72.8 (Test03) exakt
          const Nu_k = _N + Ra - Rp + Rpp;
          const Nu_d = Math.max(0, Nu_k) / _gEp;
          const Ru   = Nu_d * tan_p2;                      // Gl.51
          return {h, Ea_d, Ep_d, Epp_d, E0_k, E0p_k, Ra, Rp, Rpp, R0, R0p, Ew_d, Ewp_d, Nu_k, Nu_d, Ru};
        };

        // ── δp stufenweise herabsetzen bis Nu ≥ 0 (Gl.49/50, §5.4); Start δp = φ/2 (ST-konform)
        let dpf = 0.5, y_nl = 0.001, f = null;
        for(let step=0; step<11; step++){
          // Nulllinie aus Gl.54: Ew − E'w − H* − Ru = 0  (monoton fallend in y)
          const g = y => { const q = F(y, dpf); return q.Ew_d - q.Ewp_d - H_d_dir - q.Ru; };
          let ylo=0.001, yhi=t*0.98;
          if(g(ylo) <= 0)      y_nl = 0.001;               // Ew zu klein → NL in Sohle (Gl.64/65)
          else if(g(yhi) >= 0) y_nl = yhi;
          else { for(let i=0;i<60;i++){ const ym=(ylo+yhi)/2; g(ym)>0 ? ylo=ym : yhi=ym; } y_nl=(ylo+yhi)/2; }
          f = F(y_nl, dpf);
          if(f.Nu_k >= 0 || dpf <= 0.001) break;
          dpf = Math.max(0, dpf - 0.05);                   // Gl.50: δp reduzieren
        }
        const h = f.h;

        // ── Hebelarme ab OK Block (Gl.36/37, trapezkorrigiert für Überdeckung ü)
        const arm_v   = Math.max(0.001, (h - ue) * (2*h + ue) / (3 * (h + ue)));
        const arm_vp  = Math.max(0.001, h + y_nl*(2*t + h)/(3*(t + h)) - ue);

        // ── Bodendruckkeil (Gl.47/48): x = Nu/(B·pu),  u = (A−x)/2
        // ST-verifiziert: u = 0.630 (Test02), u ≈ 0.599 (Test03)
        const x_keil = Math.min(A_pl, f.Nu_d / Math.max(1e-6, B_q * pu_d));
        const u_ecc  = Math.max(0.001, (A_pl - x_keil) / 2);

        // ── Grenzmoment Gl.66 (Bezugspunkt OK Block):
        //   Mu = −Ew·v + E'w·v' + (Rp+Ra+R'p)·A/2 + Ru·(t−ü) + Nu·u
        // R0/R'0 wirken horizontal — nur in Ew/E'w, NICHT im A/2-Term (ST-verifiziert 404.2/277.2)
        const Mu = -f.Ew_d * arm_v
                 + f.Ewp_d * arm_vp
                 + (f.Ra + f.Rp + f.Rpp) * (A_pl / 2)
                 + f.Ru * (t - ue)
                 + f.Nu_d * u_ecc;

        return {
          eta: Math.max(Mu, 0) / Math.max(0.001, M_ok_dir),
          Mu: Math.max(0, Mu), y_nl,
          Ew: f.Ew_d, E0b: f.E0p_k, E0a: f.E0_k, Epb: f.Epp_d, Epa: f.Ep_d, Ea_d: f.Ea_d,
          Nu: f.Nu_d, Ru: f.Ru, u_ecc, Ra_v: f.Ra, Rp_va: f.Rp, Rp_vb: f.Rpp, arm_v, arm_vp,
          dp_fac: dpf, x_keil, pu_d
        };
      }

      // M_d an OK Block (= GOK − ü) für Steckner GZT — Arm von Lastangriff (OK Kopf) bis OK Block
      // Quer  (x): H_xd×H_Kopf + M_Gy_d + M_Wy_d
      // Längs (y): H_yd×H_Kopf + M_Gx_d + M_Wx_d
      // H_Kopf = Gesamthöhe OK Block → OK Kopf (Konvention Aug 2026), daher kein +ü mehr.
      // N·e: der Versatz QUER (e_x) erzeugt das Moment um die y-Achse = Quer-Kippen ⇒ gehört zu
      // M_ok_x (das mit Hxd/MGy gepaart ist); e_y entsprechend zu M_ok_y. Vorher vertauscht
      // (Aug 2026, Bugfix — wirkte nur bei asymmetrischem Mastversatz e_x ≠ e_y).
      const M_ok_x = Math.abs(Hxd*(Hk) + gG*MGy_lf + gW*MWy_lf + Nd*exk);
      const M_ok_y = Math.abs(Hyd*(Hk) + gG*MGx_lf + gW*MWx_lf + Nd*eyk);

      // ── Lastfall-Kombinationen (ST-Fundament-konform, SIA 260):
      // Komb 1-8 = EG ∈ {γ_G,inf, γ_G,sup} × Ständig ∈ {inf, sup} × Variabel ∈ {0, γ_Q}
      // Generiert aus den Lastbeiwerten (keine separate Eingabe) — massgebend = min η
      const _gGi_c = +gi('lw_G_inf') || 0.80;
      const COMBOS = buildCombos(_gGi_c, gG, gW);
      // Bauzustand (Option, SIA 267 Ziff. 5.4.3.6): im AUSHUBZUSTAND darf der ständige
      // Lastbeiwert reduziert werden (γ_G,red ≈ 1.20). Der Endzustand-Nachweis oben bleibt
      // unberührt — deshalb ein eigener Kombinationssatz nur für den Zustand-A-Loop.
      // Option aus ⇒ _gG_bz === gG ⇒ COMBOS_EX ist mit COMBOS identisch (bit-gleich).
      const _gG_bz = _bzGred(gG);
      bzGred_ = _gG_bz; bzGredAktiv_ = Math.abs(_gG_bz - gG) > 1e-9;
      const COMBOS_EX = (Math.abs(_gG_bz - gG) < 1e-9) ? COMBOS : buildCombos(_gGi_c, _gG_bz, gW);
      // Kombinationslasten — vorzeichenbehaftet (Vorzeichen → Bewegungsrichtung/Passivseite)
      const comboLoads = cb => {
        const Nd_c  = cb.fG*NG_lf + cb.fE*Gk + cb.fG*N_auf_k;
        const Hxd_c = cb.fG*HGx_lf + cb.fQ*HWx_lf;
        const Hyd_c = cb.fG*HGy_lf + cb.fQ*HWy_lf;
        const Mokx_s = Hxd_c*(Hk) + cb.fG*MGy_lf + cb.fQ*MWy_lf + Nd_c*exk;   // Quer: e_x
        const Moky_s = Hyd_c*(Hk) + cb.fG*MGx_lf + cb.fQ*MWx_lf + Nd_c*eyk;   // Längs: e_y
        return {Nd_c, Hxd_c, Hyd_c, Mokx_s, Moky_s};
      };
      // ── Steckner-Erweiterung (Option SETTINGS.stecknerSlope): Böschungswinkel im GZT
      // Original-Steckner rechnet die Erddrücke mit waagrechtem Gelände (β_a = β_p = 0) → beide
      // Lastrichtungen liefern dasselbe η. Mit der Option wird der PASSIVE Erdwiderstand auf der
      // TALSEITE mit K_p,β (Rankine, geneigtes Gelände) abgemindert, bergseitig bleibt der volle K_p
      // — der Nachweis wird damit richtungsabhängig (Kippen zur Böschung = massgebend).
      // Konvention: Böschung liegt auf +x (Feldseite). h_β mildert die Abminderung anteilig ab.
      const _slpOn = (typeof SETTINGS!=='undefined' && SETTINGS.stecknerSlope===true)
                     && btyp!=='none' && beta_deg < -0.1;
      let _slpFac = 1;
      if(_slpOn){
        const _phiDeg = phi_k_rad*180/Math.PI;
        const _full = Math.max(0.1, kpSlopeRankine(_phiDeg, Math.abs(beta_deg))
                                  / Math.max(1e-6, kpSlopeRankine(_phiDeg, 0)));
        const _hb = Math.max(0, +gi('bg_bhoehe')||0);
        const _fr = _hb>0 ? Math.min(1, _hb/Math.max(0.1, t)) : 1;
        _slpFac = 1 - (1-_full)*_fr;
      }
      // Bewegung nach +x ⇒ E_p liegt talseitig (reduziert); nach −x ⇒ E'_p (unter NL) talseitig.
      const _slpF = dirX => _slpOn ? (dirX > 0 ? {fEp:_slpFac} : {fEpp:_slpFac}) : null;
      let best = null;
      for(const cb of COMBOS){
        const {Nd_c, Hxd_c, Hyd_c, Mokx_s, Moky_s} = comboLoads(cb);
        // Richtung aus dem signierten Kippmoment (s. Zustand-A-Loop) — nicht aus H allein
        const _dirXc = (Mokx_s !== 0 ? Mokx_s : Hxd_c) >= 0 ? 1 : -1;
        const rx_c = computeGZT_dir(Math.abs(Hxd_c), Math.abs(Mokx_s), B, L, Object.assign({N: Nd_c}, _slpF(_dirXc)));
        const ry_c = computeGZT_dir(Math.abs(Hyd_c), Math.abs(Moky_s), L, B, {N: Nd_c});
        const ux_c = Math.abs(Hxd_c) >= Math.abs(Hyd_c);
        const eta_c = ux_c ? rx_c.eta : ry_c.eta;
        kombs_GZT_.push({ nr:cb.nr, fE:cb.fE, fG:cb.fG, fQ:cb.fQ, eta:eta_c, ux:ux_c, Nd:Nd_c, Hxd:Hxd_c, Hyd:Hyd_c,
                          Mok:Math.abs(ux_c ? Mokx_s : Moky_s), r: ux_c ? rx_c : ry_c });
        if(!best || eta_c < best.eta){ best = {eta:eta_c, nr:cb.nr, cb, rx:rx_c, ry:ry_c, ux:ux_c, mokx_s:Mokx_s}; }
      }

      // ── Zustand A: Aushub OHNE Massnahme (Sicherungs-Modul aktiv) ──────────
      // Gleiche 8 Kombinationen, einseitige Oberflächenabsenkung d_ex seitenabhängig:
      // Gleisseite = −x (Viewer-Konvention) · Passivseite = Bewegungsrichtung des Blockkopfs
      const d_ex_sich = (typeof showPfahl !== 'undefined' && showPfahl)
        ? Math.max(0, +gi('pfahl_dex') || 0) : 0;
      let best_ex = null;
      if(d_ex_sich > 0.01){
        const exSign = (gi('pfahl_dex_seite') || 'gleis') === 'gleis' ? -1 : 1;
        // Bauzustands-Logik: der Aushub DURCHLÄUFT alle Zwischentiefen — massgebend ist
        // das Minimum über den Aushubpfad. Festes 0.25-m-Raster: Stützstellen sind für
        // grösseres d_ex eine Obermenge → η_ex(d_ex) monoton fallend.
        //
        // DEGENERATIONS-ERKENNUNG (Aug 2026): Das Pfad-Minimum war bislang ein WORKAROUND für das
        // Gl.64/65-Artefakt (NL wandert in die Sohle → der Term −E_w·v entfällt → M_u STEIGT bei
        // tieferem Aushub wieder an). Es verhinderte den sichtbaren Anstieg, lieferte aber für jeden
        // tiefen Aushub die Kapazität einer viel FLACHEREN Grube — stark unkonservativ.
        // Verifiziert (t=3.10, φ=30, Aushub passivseitig): M_u,ex 279.3 → 238.0 (0.25 m) → 196.1
        // (0.50 m) → 156.4 (0.75 m), y_NL 0.407 → 0.051 (NL in Sohle); ab 0.75 m friert der Wert ein
        // und wird bis d_ex = 3.00 m (von t = 3.10 m!) unverändert als η = 2.03 „erfüllt" gemeldet.
        // Steckner Gl.66 setzt eine INNENLIEGENDE Neutrallinie mit Erdwiderstand ober- UND unterhalb
        // voraus; ein tiefer einseitiger Aushub macht daraus ein Kragarm-/Stützwandproblem → Formel
        // ausserhalb ihres Gültigkeitsbereichs. Liegt das Minimum einer Kombination VOR der Endtiefe,
        // hat die Kapazitätskurve umgekehrt ⇒ `exDegen` → der Nachweis wird als NICHT FÜHRBAR
        // deklariert (statt eine zu günstige Zahl auszuweisen).
        const _exDepths = [];
        for(let _dz = 0.25; _dz < d_ex_sich - 0.01; _dz += 0.25) _exDepths.push(_dz);
        _exDepths.push(d_ex_sich);
        for(const cb of COMBOS_EX){
          const {Nd_c, Hxd_c, Hyd_c, Mokx_s, Moky_s} = comboLoads(cb);
          const ux_e = Math.abs(Hxd_c) >= Math.abs(Hyd_c);
          if(!ux_e){
            // Längsrichtung massgebend: der gleisparallele Graben liegt PARALLEL zur Bewegungs-
            // richtung. Die passiven Stirnflächen (y-normal) bleiben intakt — aber der Aushub legt
            // genau EINE der beiden Steckner-Seitenflächen frei (x-normal, Breite A_pl je Fläche)
            // → Ruhedruck E0/E0' und die Mantelreibungen R0/R'0 dort reduziert (fac.dExS).
            // Vorher wurde der Aushub in dieser Richtung KOMPLETT vernachlässigt (unkonservativ).
            for(const dyi of _exDepths){
              const ry_e = computeGZT_dir(Math.abs(Hyd_c), Math.abs(Moky_s), L, B, {N: Nd_c, dExS: dyi});
              if(!best_ex || ry_e.eta < best_ex.eta)
                best_ex = {eta: ry_e.eta, nr: cb.nr, r: ry_e, ux: false, side: 'parallel', dGov: dyi};
            }
            continue;
          }
          // Bewegungsrichtung aus dem VORZEICHENBEHAFTETEN Kippmoment am OK Kopf (Mokx_s enthält
          // bereits H·H_Kopf + M_ext + N·e). Vorher wurde primär das Vorzeichen von Hxd_c
          // genommen — bei gegenläufigem H und M_ext (z. B. H = +5, M_ext = −100) kippt der Block
          // aber entgegen H, und Passiv-/Aktivseite waren VERTAUSCHT.
          const dirX = (Mokx_s !== 0 ? Mokx_s : Hxd_c) >= 0 ? 1 : -1;
          const isP  = dirX === exSign;                   // Aushub auf Passivseite?
          let cbBest = null;                              // Pfad-Minimum DIESER Kombination
          for(const dxi of _exDepths){
            const rx_e = computeGZT_dir(Math.abs(Hxd_c), Math.abs(Mokx_s), B, L,
                          Object.assign({N: Nd_c}, isP ? {dExP: dxi} : {dExA: dxi}, _slpF(dirX)));
            if(!cbBest || rx_e.eta < cbBest.eta) cbBest = {eta: rx_e.eta, d: dxi};
            if(!best_ex || rx_e.eta < best_ex.eta)
              best_ex = {eta: rx_e.eta, nr: cb.nr, r: rx_e, ux: true,
                         side: isP ? 'passiv' : 'aktiv', dGov: dxi};
          }
          // Nur auf der PASSIVSEITE ist ein Minimum vor der Endtiefe ein Degenerations-Signal: dort
          // zehrt der Aushub den Erdwiderstand ÜBER der NL auf, die NL wandert in die Sohle (Gl.64/65)
          // und M_u steigt rechnerisch wieder an. Auf der AKTIVSEITE ist dasselbe Muster GUTARTIG —
          // der Wegfall des aktiven Erddrucks wirkt anfangs günstig (M_u steigt leicht), danach fällt
          // die Kurve regulär; das Pfad-Minimum ist dort eine legitime Bauzustands-Einhüllende.
          // (Je Kombination geprüft, nicht nur an der global massgebenden — sonst könnte eine
          // parallele/aktive Kombination die Degeneration der Querrichtung verdecken.)
          if(isP && cbBest && cbBest.d < d_ex_sich - 0.01) dEx_degen_ = true;
        }
      }
      const rx = best.rx, ry = best.ry, use_x = best.ux;
      Mokx_sign_ = best.mokx_s || 0;
      komb_GZT_ = isFinite(best.eta) ? best.nr : 0;
      Nd_GZT_   = comboLoads(best.cb).Nd_c;
      etaGZT   = use_x ? rx.eta  : ry.eta;
      Mu_GZT   = use_x ? rx.Mu   : ry.Mu;
      y_NL_GZT = use_x ? rx.y_nl : ry.y_nl;
      Ew_GZT   = use_x ? rx.Ew   : ry.Ew;
      Ea_GZT   = use_x ? rx.Ea_d : ry.Ea_d;
      E0b_GZT  = use_x ? rx.E0b  : ry.E0b;
      E0a_GZT  = use_x ? rx.E0a  : ry.E0a;
      Epb_GZT  = use_x ? rx.Epb   : ry.Epb;
      Nu_GZT   = use_x ? rx.Nu    : ry.Nu;
      Ru_GZT   = use_x ? rx.Ru    : ry.Ru;
      // Erweiterte Terme für return-Objekt
      Epa_GZT_    = use_x ? rx.Epa   : ry.Epa;
      Ra_v_GZT_   = use_x ? rx.Ra_v  : ry.Ra_v;
      Rp_va_GZT_  = use_x ? rx.Rp_va : ry.Rp_va;
      Rp_vb_GZT_  = use_x ? rx.Rp_vb : ry.Rp_vb;
      u_ecc_GZT_  = use_x ? rx.u_ecc : ry.u_ecc;
      arm_v_GZT_  = use_x ? rx.arm_v : ry.arm_v;
      arm_vp_GZT_ = use_x ? rx.arm_vp: ry.arm_vp;
      // Zustand A — Exporte
      if(best_ex){
        etaGZT_ex_   = best_ex.eta;
        Mu_GZT_ex_   = best_ex.r.Mu;
        komb_GZT_ex_ = isFinite(best_ex.eta) ? best_ex.nr : 0;
        dEx_side_    = best_ex.side;
        dEx_gov_     = best_ex.dGov || d_ex_sich;
        yNL_ex_      = best_ex.r.y_nl ?? 0;
      }
      dEx_used_ = d_ex_sich;

      // ── 6. GZG SCHIEFSTELLUNG — Steckner 1989, Gl.11–21
      // Kenngrössen: tan α₁ (Gl.11), tan α₂ (Gl.12)
      // M₁: stirnseitige Einspannung (Gl.13/14/15)
      // M₂: Sohlenreaktionsmoment (Gl.16/17)
      // M_α = M₁ + M₂ − HD (Gl.18/19/20), begrenzt auf M_u,char (Gl.21)
      {
        // Grenzwert nach Lastfalltyp: enthaelt die GZG-Kombination den staendigen Anteil
        // (γ_G,GZG > 0), gilt 1:100, sonst der strengere Veraenderlich-Wert 1:200.
        // NICHT _gzgFac() verwenden: das liest das DOM, hier gilt der Eingabe-Schnappschuss
        // (gi ist in _doCalculate auf P.raw geschattet, damit die _pure-Sweeps greifen).
        const _rawGz    = gi('lw_G_gzg');
        const _gGzRaw   = (_rawGz == null || String(_rawGz).trim() === '') ? 1.00 : (+_rawGz || 0);
        const _gzgPerm  = _gGzRaw > 0.001;
        const tan_zul   = _tanZul(_gzgPerm);
        tanZul_GZG_ = tan_zul; gzgPerm_ = _gzgPerm;
        // GZG-Lastbeiwerte aus Lastbeiwerte-Karte (Default 1.00 = charakteristisch, SIA)
        const gGz_ = _gGzRaw;
        const _rawQz = gi('lw_Q_gzg');
        const gQz_ = (_rawQz == null || String(_rawQz).trim() === '') ? 1.00 : (+_rawQz || 0);
        const Hxk_g  = gGz_*HGx_lf + gQz_*HWx_lf;
        const Hyk_g  = gGz_*HGy_lf + gQz_*HWy_lf;
        const Nk_g   = gGz_*NG_lf + Gk;   // G_k Eigengewicht: γ=1.00 (SIA 267 §4.4.3, GZG)
        // Momente an OK-Block mit GZG-Beiwerten (korrekte Richtungs-Zuordnung)
        const Mxk_g = Math.abs(Hxk_g*(Hk) + gGz_*MGy_lf + gQz_*MWy_lf + Nk_g*exk);   // Quer: e_x
        const Myk_g = Math.abs(Hyk_g*(Hk) + gGz_*MGx_lf + gQz_*MWx_lf + Nk_g*eyk);   // Längs: e_y
        const ux_g  = Math.abs(Hxk_g) >= Math.abs(Hyk_g);
        const H_kg  = ux_g ? Math.abs(Hxk_g) : Math.abs(Hyk_g);
        const M_ok_g= ux_g ? Mxk_g : Myk_g;
        M_ok_char_GZG = M_ok_g;
        // Massgebende Kombination für die Anzeige: Richtung (quer/längs) + die beiden Vergleichswerte
        // und die verwendeten GZG-Lastbeiwerte. Anders als der GZT (8 γ-Kombinationen) kennt der GZG
        // nur EINEN Lastansatz je Lastfall — die „Kombination" ist hier die gewählte RICHTUNG.
        gzgDir_ = ux_g ? 'quer' : 'längs';
        gzgHxk_ = Math.abs(Hxk_g); gzgHyk_ = Math.abs(Hyk_g);
        gzgMxk_ = Mxk_g;           gzgMyk_ = Myk_g;
        gzgGamG_ = gGz_;           gzgGamQ_ = gQz_;
        const N_al  = Math.max(0.1, Nk_g);
        H_k_GZG = H_kg; N_k_GZG = N_al;

        const tan_p2 = Math.tan(phi_k_rad);  // φ₂ = φ'_k (Sohlreibungswinkel)
        const A_g   = L;   // A = Fundamentlänge
        const C1_g  = C1_kN;  // [kN/m³]
        const C2_g  = C1_kN;  // C₂ = C₁ (nach Steckner)

        // Gl.12 — tan α₂: Abheben der hinteren Sohlkante (Sohle intakt, D-unabhängig)
        tan_a2_GZG = (A_g*A_g*B*C2_g > 0.001)
          ? 2*N_al / (A_g*A_g*B*C2_g) : 0;
        // M₂(tan α) — Gl.16 / 17 (Sohlenreaktion, D-unabhängig)
        const M2fn = ta => {
          if(ta <= tan_a2_GZG) return (1/12)*B*A_g*A_g*A_g*C2_g*ta;   // Gl.16
          const sq2 = 2*N_al / Math.max(1e-9, B*C2_g*ta);
          return N_al*(A_g/2 - Math.sqrt(Math.max(0,sq2))/3);           // Gl.17
        };

        // Factory: Stirnseiten-Terme (Gl.11/13-15/18-20) als Funktion der wirksamen
        // Stirnbettungs-Höhe D_g. Steckner kennt KEIN ü (D = volle Blockhöhe ab GOK);
        // diese App modelliert einen vergrabenen Block, und der GZT zieht ü konsistent ab
        // (Erddruck ü→t, Hebel v=(h−ü)…, R_u·(t−ü)). Die Stirnbettung muss daher ebenso über
        // die ECHTE Blockfläche H_Block = t−ü wirken (Bestand: D_g = t−ü). Zustand A reduziert
        // zusätzlich um den Aushub. C₁ bleibt über die wahre Tiefe (t/2) unverändert —
        // nur die Bettungs-HÖHE ändert sich. ü=0 (reiner Steckner, Tab. 2) ⇒ D_g = t ⇒ identisch.
        const mkGZG = D_g => {
          const ta1 = (B*D_g*D_g*C1_g > 0.001)
            ? 6*(N_al*tan_p2 + H_kg) / (B*D_g*D_g*C1_g) : 0;        // Gl.11
          const M1fn = ta => {
            if(ta <= ta1)   return (1/12)*B*D_g*D_g*D_g*C1_g*ta;    // Gl.13
            if(ta <= 3*ta1) return 0.5*D_g*(N_al*tan_p2 + H_kg);    // Gl.14 konstant
            return (1/36)*B*D_g*D_g*D_g*C1_g*ta;                    // Gl.15
          };
          const HDfn = ta => {
            if(ta <= ta1)   return H_kg*D_g;                                      // Gl.18
            if(ta <= 3*ta1) return (1/6)*H_kg*D_g*(7-ta/Math.max(1e-10,ta1));     // Gl.19
            return (2/3)*H_kg*D_g;                                                // Gl.20
          };
          return { ta1, M1fn, Mafn: ta => M1fn(ta) + M2fn(ta) - HDfn(ta) };
        };
        // Bisektion tan α_res aus M_α(α) = M_ok (ohne M_u-Limit → physikalisches α)
        const solveAlpha = Mafn => {
          if(H_kg <= 0.01 || M_ok_g <= 0.001) return 0;
          let alo=1e-7, ahi=tan_zul*20;
          for(let i=0;i<5;i++){if(Mafn(ahi)<M_ok_g) ahi*=2; else break;}
          for(let i=0;i<60;i++){const am=(alo+ahi)/2;Mafn(am)<M_ok_g?alo=am:ahi=am;}
          return (alo+ahi)/2;
        };

        // ── Bestand: Stirnbettung über die echte Blockfläche D = t − ü (H_Block)
        const D_bed = Math.max(0.1, t - ue);
        const gzgB = mkGZG(D_bed);
        tan_a1_GZG = gzgB.ta1;

        // Gl.21 — M_u,char: GZT Grenzmoment unter charakteristischen Lasten
        // Gleicher Rechenpfad wie GZT (computeGZT_dir), aber N = N_k und γ_Ea = γ_Ep = 1
        let Mu_c = 0;
        if(H_kg > 0.01) {
          const _Ag = ux_g ? B : L, _Bq = ux_g ? L : B;
          // Böschungs-Erweiterung (Option) auch im GZG-Deckel: gleicher Mechanismus wie GZT,
          // nur in Querrichtung (Böschung liegt in x), Richtung aus dem char. Lastvorzeichen.
          const _MxkG = Hxk_g*(Hk) + gGz_*MGy_lf + gQz_*MWy_lf + Nk_g*exk;   // Quer: e_x
          const _slpG = ux_g ? _slpF((Hxk_g !== 0 ? Hxk_g : _MxkG) >= 0 ? 1 : -1) : null;
          Mu_c = Math.max(0.001,
            computeGZT_dir(H_kg, Math.max(0.001, M_ok_g), _Ag, _Bq,
              Object.assign({gEa:1, gEp:1, N:N_al}, _slpG)).Mu);
        }
        Mu_char_GZG = Mu_c;

        // M_α bei tan_zul, begrenzt auf M_u,char (Gl.21)
        M1_GZG_val    = gzgB.M1fn(tan_zul);
        M2_GZG_val    = M2fn(tan_zul);
        const Mraw    = gzgB.Mafn(tan_zul);
        // Floor bei 0: Mraw < 0 (z. B. steile Böschung → C₁ kollabiert, M₁ < H·D) heisst
        // „Bettung kann H·D bei tan_zul nicht aufnehmen" = Nachweis nicht erfüllt (η→0),
        // KEIN negatives η (sinnlos). gzgBettungKollaps flaggt den Modellgrenzfall fürs UI.
        gzgBettungKollaps = Mraw < 0;
        Malpha_GZG_val= Math.max(0, Mu_c > 0 ? Math.min(Mraw, Mu_c) : Mraw);
        alpha_GZG_calc= solveAlpha(gzgB.Mafn);
        // η_GZG = M_α_limited / M_ok (Nachweis erfüllt wenn η ≥ 1)
        etaGZG = M_ok_g > 0.001 ? Malpha_GZG_val / M_ok_g : Infinity;

        // ── Zustand A: GZG mit Aushub ohne Massnahme (Näherung D_eff)
        if(d_ex_sich > 0.01){
          if(!ux_g){
            // Längsrichtung massgebend — Aushub parallel: Einfluss vernachlässigt (Näherung)
            etaGZG_ex_ = etaGZG; alpha_GZG_ex_ = alpha_GZG_calc; Mu_char_GZG_ex_ = Mu_char_GZG;
          } else {
            const exSign_g = (gi('pfahl_dex_seite') || 'gleis') === 'gleis' ? -1 : 1;
            const Mxk_s_g  = Hxk_g*(Hk) + gGz_*MGy_lf + gQz_*MWy_lf + Nk_g*exk;   // Quer: e_x
            const dirX_g   = (Mxk_s_g !== 0 ? Mxk_s_g : Hxk_g) >= 0 ? 1 : -1;   // signiertes Kippmoment
            const exPas    = dirX_g === exSign_g;   // Aushub auf Stirnseite (passiv)?
            // Stirnbettung nur bei Aushub auf der Stirnseite reduziert; aktivseitig intakt.
            // Wirksame Bettungshöhe ab UK Aushub: Aushub frisst von GOK her, Blockoberkante
            // liegt bei ü ⇒ wirksame Höhe = t − max(ü, d_ex).
            const gzgE = exPas ? mkGZG(Math.max(0.1, t - Math.max(ue, d_ex_sich))) : gzgB;
            // Mu_char-Deckel: Minimum über den Aushubpfad (Bauzustand, 0.25-m-Raster wie GZT)
            let Mu_ce = 0;
            if(H_kg > 0.01){
              Mu_ce = Infinity;
              const _gzgDepths = [];
              for(let _dz = 0.25; _dz < d_ex_sich - 0.01; _dz += 0.25) _gzgDepths.push(_dz);
              _gzgDepths.push(d_ex_sich);
              for(const dxi of _gzgDepths){
                Mu_ce = Math.min(Mu_ce, Math.max(0.001,
                  computeGZT_dir(H_kg, Math.max(0.001, M_ok_g), B, L,
                    Object.assign({gEa:1, gEp:1, N:N_al},
                      exPas ? {dExP:dxi} : {dExA:dxi}, _slpF(dirX_g))).Mu));
              }
            }
            Mu_char_GZG_ex_ = Mu_ce;
            const Mraw_e    = gzgE.Mafn(tan_zul);
            const Malpha_e  = Math.max(0, Mu_ce > 0 ? Math.min(Mraw_e, Mu_ce) : Mraw_e);
            alpha_GZG_ex_   = solveAlpha(gzgE.Mafn);
            etaGZG_ex_      = M_ok_g > 0.001 ? Malpha_e / M_ok_g : Infinity;
          }
        }
      }
    }

    // ── FLACH: Gebrauchstauglichkeit (Kernweite + Verkippung), charakteristische Lasten
    let gzgF = null;
    if(!isBlock && doGZG){
      const gGzF = _gzgFac('lw_G_gzg', 1.00), gQzF = _gzgFac('lw_Q_gzg', 1.00);
      const kF = evalT2(1.00, gGzF, gQzF);                   // Eigengewicht immer 1.00, wie beim Block
      gzgF = flachGZG({ B, L, t, N:kF.Nd, Max:kF.M_ax, May:kF.M_ay, tanZul:_tanZul(gGzF > 0) });
      gzgF.gamG = gGzF; gzgF.gamQ = gQzF; gzgF.perm = gGzF > 0; gzgF.Hk = kF.Hd;
      etaGZG = gzgF.eta; alpha_GZG_calc = gzgF.tan; tanZul_GZG_ = gzgF.tanZul; gzgPerm_ = gzgF.perm;
    }
    const chk=[];
    // Sohlspannung: nur für Flachfundament als Versagenskriterium.
    // Bei Block (Steckner) ist σ_max informativ — Kraftübertragung über Erdwiderstand/Mantel.
    // Block: nur GZT (Steckner Gl.66) + GZG (Schiefstellung) sind massgebend
    // Flach: Sohlspannung + Grundbruch + Gleiten + Kippen
    if(isBlock){
      if(NW.gzt && doGZT) chk.push(_etaOk(etaGZT));
      if(NW.gzg && doGZG) chk.push(_etaOk(etaGZG));
    } else if(doGZT){   // Flach kennt keinen GZG — ein reiner GZG-Lastfall führt keinen Nachweis
      if(NW.sohlsp) chk.push(_etaOk(etaSIG));
      if(NW.grundb) chk.push(_etaOk(etaGB));
      if(NW.gleiten)chk.push(_etaOk(etaGL));
      if(NW.kippen) chk.push(isBlock ? inKern : _etaOk(eta_klaf));
    }
    if(!isBlock && gzgF && nwOn('flach','gzg')) chk.push(_etaOk(etaGZG));   // Flach: Kernweite + Verkippung

    return {
      name:lf.name, comp:lf.comp, nw:_lfNW, Nd, Hxd, Hyd, Hd, Mxd, Myd, Md_ext_x, Md_ext_y,
      ex:ex_, ey:ey_, inKern, smax, smin, s0, Wx:Wx_, Wy:Wy_,
      effAusserhalb, effUeberDrittel, eRx:+_eRx.toFixed(3), eRy:+_eRy.toFixed(3),
      ex_kipp, ey_kipp,
      etaGB, etaGL, etaKx, etaKy, eta_klaf, klaf_val, ea_a, eb_b, etaSIG, etaGZG, etaGZT,
      tan_a1_GZG, tan_a2_GZG, M1_GZG_val, M2_GZG_val,
      Malpha_GZG_val, Mu_char_GZG, M_ok_char_GZG, alpha_GZG_calc, gzgBettungKollaps,
      tanZul_GZG: tanZul_GZG_, gzgPerm: gzgPerm_,
      gzgDir:gzgDir_, gzgHxk:gzgHxk_, gzgHyk:gzgHyk_, gzgMxk:gzgMxk_, gzgMyk:gzgMyk_,
      gzgGamG:gzgGamG_, gzgGamQ:gzgGamQ_,
      H_k_GZG, N_k_GZG, C1_GZG: C1_kN,
      Rd, Rgl, Nd_gl, Nq, Nc, Ng, Be, Le, phi_d, c_d, t2, gbD, glD, gzgF,
      // Setzung unter charakteristischer Vertikallast (nur ausgewiesen, kein Grenzwert — Nutzerentscheid Okt 2026)
      // Torsion beim Blockfundament — RESERVEBETRACHTUNG (Nutzerentscheid Okt 2026): Steckner bildet Torsion nicht
      // ab; ausgewiesen wird nur, was die Sohlreibung allein aufnähme: T_R,d = N_d,min·tan φ_d·r_m mit dem mittleren
      // Abstand r_m der Sohlfläche vom Schwerpunkt (gleichmässige Pressung), N_d,min = γ_G,inf·(G_k + N_G). Ohne
      // Überlagerung mit H, ohne Seitenflächen. Geht NICHT in η_massg ein.
      torsB: (isBlock && doGZT) ? (()=>{ const TG=+gi('l_TG')||0, TW=+gi('l_TW')||0; if(Math.abs(TG)+Math.abs(TW) < 1e-9) return null;
        const Td = Math.abs((+gi('lw_G')||1.35)*TG + (+gi('lw_Q')||1.50)*TW);
        let sr=0; const n=40; for(let i=0;i<n;i++) for(let j=0;j<n;j++) sr += Math.hypot(((i+0.5)/n-0.5)*B, ((j+0.5)/n-0.5)*L);
        const rm = sr/(n*n), Nmin = Math.max(0, _gG2inf*(Gk + NG_lf)), TRd = Nmin*Math.tan(phi_d)*rm;
        return { Td, Nmin, rm, TRd, phi_d:phi_d*180/Math.PI, eta: Td>1e-9 ? TRd/Td : Infinity }; })() : null,
      setz: doGZG ? (()=>{ try{ return setzungFund({B, L, t, N:Math.max(0, NG_lf + Gk), ratio:_meRatio()}); }catch(_){ return null; } })() : null,
      gb_q, gb_g, q0, soilName:soil.name, govSoilName:govHB.phi+'°',
      // Steckner extras
      Ep_x, Ep_y, Tf_total,
      delta_d, Kp,
      // GZG/GZT extras
      bid, alpha_GZG_calc, y_NL_GZT, Mu_GZT, Ea_GZT, Ew_GZT, E0b_GZT, E0a_GZT, Epb_GZT, Nu_GZT, Ru_GZT,
      // GZT erweiterte Terme (Steckner Gl. 66)
      Epa_GZT:    Epa_GZT_,
      Ra_v_GZT:   Ra_v_GZT_,
      Rp_va_GZT:  Rp_va_GZT_,
      Rp_vb_GZT:  Rp_vb_GZT_,
      u_ecc_GZT:  u_ecc_GZT_,
      arm_v_GZT:  arm_v_GZT_,
      arm_vp_GZT: arm_vp_GZT_,
      komb_GZT:   komb_GZT_,
      kombs_GZT:  kombs_GZT_,
      Nd_GZT:     Nd_GZT_,
      bzGred: bzGred_, bzGredAktiv: bzGredAktiv_,
      // Zustand A — Aushub ohne Massnahme (Sicherungs-Modul)
      etaGZT_ex: etaGZT_ex_, Mu_GZT_ex: Mu_GZT_ex_, komb_GZT_ex: komb_GZT_ex_, y_NL_GZT_ex: yNL_ex_,
      dEx_degen: dEx_degen_,
      // Signiertes Kippmoment am OK Kopf der massgebenden Kombination (Quer) — gibt die
      // Bewegungs-/Passivseite vor (H allein reicht nicht, wenn M_ext gegenläufig ist)
      M_ok_x_signed: Mokx_sign_,
      etaGZG_ex: etaGZG_ex_, alpha_GZG_ex: alpha_GZG_ex_, Mu_char_GZG_ex: Mu_char_GZG_ex_,
      dEx_used: dEx_used_, dEx_side: dEx_side_, dEx_gov: dEx_gov_,
      ue_GZT: isBlock ? ue : 0,
      Hxk: Hxk_lf, Hyk: Hyk_lf,
      M_ok_x_k: Math.abs(Hxk_lf*(Hk) + (MGy_lf + MWy_lf) + (NG_lf+Gk)*exk),   // Quer: e_x
      M_ok_y_k: Math.abs(Hyk_lf*(Hk) + (MGx_lf + MWx_lf) + (NG_lf+Gk)*eyk),   // Längs: e_y
      M_ok_x_d: isBlock ? Math.abs(Hxd*(Hk) + gG*MGy_lf + gW*MWy_lf + Nd*exk) : 0,
      M_ok_y_d: isBlock ? Math.abs(Hyd*(Hk) + gG*MGx_lf + gW*MWx_lf + Nd*eyk) : 0,
      gG_lf: gG, gW_lf: gW,
      phi_k_GZT: isBlock ? Math.atan(Math.tan(phi_d) * gph) : 0,
      // Bodenparameter für Spannungsdarstellung im Diagramm
      gs_GZT: isBlock ? gs : 0,
      Ka_GZT: isBlock ? (()=>{ const pk=Math.atan(Math.tan(phi_d)*gph); const da=(2/3)*pk; const inner=Math.sin(pk+da)*Math.sin(pk)/Math.cos(da); const denom=1+Math.sqrt(Math.max(0,inner)); return denom>0.001?(Math.cos(pk)/denom)**2:0.001; })() : 0,  // λa Gl.27, δ₁=2/3φ
      Kph_GZT: isBlock ? (() => { const pk=Math.atan(Math.tan(phi_d)*gph); const dp=0.5*pk; const cd=Math.cos(dp); const sq=Math.sin(pk+dp)*Math.sin(pk)/cd; const den=1-Math.sqrt(Math.max(0,Math.min(0.9999,sq))); return (Math.cos(pk)/Math.max(0.05,den))**2; })() : 0,  // λp Gl.28, δp=φ/2
      K0_GZT: isBlock ? (1-Math.sin(Math.atan(Math.tan(phi_d)*gph))) : 0,
      cd_GZT: c_d, gEa_GZT: gEa, gEp_GZT: gEp, mob_GZT: mob,
      // λ'_p (Gl.29, δ=φ/2) — das REDUZIERTE Passivmass unter der Nulllinie. Die Diagramme
      // zeichneten dort bis Aug 2026 λ_p (Gl.28) und damit einen ~2.6× zu breiten Druckkörper.
      Kpp_GZT: isBlock ? (() => { const pk=Math.atan(Math.tan(phi_d)*gph); const dp=0.5*pk; const cd=Math.cos(dp); const sq=Math.sin(pk-dp)*Math.sin(pk)/cd; const den=1-Math.sqrt(Math.max(0,Math.min(0.9999,sq))); return (Math.cos(pk)/Math.max(0.05,den))**2; })() : 0,
      // Wirksamer Mobilisierungsgrad: bei abgeschalteter Option rechnet der Kern mit vollem
      // λ_p — mob=1 lässt die Diagramme demselben Ansatz folgen.
      mobEff_GZT: isBlock ? (_stMobExp ? mob : 1) : mob,
      // tan δ₁ = tan(⅔·φ_k) — für R₀ = E₀·tan δ₁ (Gl.41/42) in der Vektordarstellung
      tanD1_GZT: isBlock ? Math.tan((2/3)*Math.atan(Math.tan(phi_d)*gph)) : 0,
      ok:chk.length===0||chk.every(Boolean)
    };
  });

  const _relevantEtas = r => isBlock
    ? [r.etaGZT, r.etaGZG]
    : [...(r.nw!=='gzg' ? [r.etaSIG, r.etaGB, r.etaGL] : []), ...(r.gzgF && nwOn('flach','gzg') ? [r.etaGZG] : [])];
  if(!results.length) return null;
  const worst = results.reduce((a, b) => {
    const ma = Math.min(..._relevantEtas(a).filter(isFinite));
    const mb = Math.min(..._relevantEtas(b).filter(isFinite));
    return mb < ma ? b : a;
  });
  const G = {B,L,Hb:t,qu,beta_deg,btyp,isBlock,uberd:+gi('g_uberd'),
    ue: ue, Bk:+gi('g_kx')||B, Hkopf:+gi('g_hkopf')||0,
    Gk, gb, gauf,
    // Eigengewichtsanteile für den Bericht — exakt die Terme aus Gk0 oben, damit die
    // gedruckte Tabelle auf G_k aufgeht (bis Aug 2026 zeigte G_hinterfuel B·L·ü·γ, die
    // Rechnung nutzt aber nur die Erdüberdeckung ÜBER der Platte, ohne Kopf-Grundfläche).
    G_platte:     B*L*Hb*gb,
    G_kopf:       _inclKopf ? V_kopf*gb : 0,
    G_hinterfuel: isBlock ? 0 : _coverVol*gauf,
    G_auftrieb:   G_auftrieb};

  // ── UI-Seiteneffekte nur im Normalbetrieb (nicht bei _pure-Aufrufen aus Sweeps/Tests)
  if(!P._pure){
    renderResults(results, worst, G);

    // Bemessungswerte in Flachfundament-Panel anzeigen
    if(!isBlock){
      // Tragfähigkeitsbeiwerte aus worst-LF (phi_d identisch für alle LF)
      const _sv = v => (v !== undefined && isFinite(v)) ? v : '—';
      const _set = (id, v) => { const e = document.getElementById(id); if(e) e.textContent = v; };
      _set('disp-phi-d', (phi_d * 180 / Math.PI).toFixed(1) + '°');
      _set('disp-c-d',   c_d.toFixed(1) + ' kPa');
      _set('disp-Nq',    _sv(worst.Nq.toFixed(2)));
      _set('disp-Ng',    _sv(worst.Ng.toFixed(2)));
      _set('disp-Nc',    _sv(worst.Nc.toFixed(2)));
    }

    rebuildScene();   // Einwirkungs-Pfeile + alle Layer nach Neuberechnung aktualisieren
    updateSB();
    // Pfahlsicherung neu berechnen (verwendet RESULT.block)
    if(curModel().sicherung) calcPfahlsicherung();
  }
  return {results, worst, G};
}
