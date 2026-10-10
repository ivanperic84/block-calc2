// BlockCalc — js/selbsttest.js
// Selbsttest (?selftest=1) mit Golden-Werten
// SELBSTTEST (?selftest=1) — Golden-/Analytik-Anker
// Schützt die Norm-Verankerung: analytische Referenzen (Hetényi, Gruppengleichgewicht,
// Mantelreibung) + eingefrorene Golden-Werte eines vollständig expliziten Zustands.
// Draft-Save ist im Selbsttest unterdrückt (echter Arbeitsstand bleibt unberührt).
// ════════════════════════════════════════════
const _ST_STATE = {"AUFLASTEN":"[]","FLACH_MAT":"beton","LF":"[{\"name\":\"LF 1 — GZT (quer)\",\"preset\":\"quer\",\"gG\":1.35,\"gW\":1.5,\"nw\":\"gzt\",\"comp\":{\"NG\":true,\"HGx\":true,\"HGy\":false,\"MGx\":false,\"MGy\":true,\"HWx\":true,\"HWy\":false,\"MWx\":false,\"MWy\":true}},{\"name\":\"LF 2 — GZG (quer)\",\"preset\":\"quer\",\"gG\":1,\"gW\":1,\"nw\":\"gzg\",\"comp\":{\"NG\":true,\"HGx\":true,\"HGy\":false,\"MGx\":false,\"MGy\":true,\"HWx\":true,\"HWy\":false,\"MWx\":false,\"MWy\":true}}]","MODEL":"block","SCHICHTEN":"[{\"phi\":30,\"c\":0,\"gamma\":20,\"gamma2\":10,\"d\":999,\"name\":\"Testboden\",\"preset\":\"custom\",\"me\":30}]","bg_beta":"0","bg_bfuss":"0.00","bg_bhoehe":"0","bg_btyp":"none","bg_c":"0","bg_c1":"155.0","bg_c1_methode":"auto","bg_delta_fac":"0.667","bg_delta_sohle":"0.667","bg_gamma":"20","bg_gamma2":"10","bg_gw":"","bg_gwt":"3.00","bg_koernig":"grob","bg_me":"30","bg_phi":"30","bg_qu":"400","flach-material":"beton","g_bx":"1.3","g_by":"1.3","g_ex":"0","g_ey":"0","g_gauf":"20","g_gbeton":"25","g_hblock":"2.7","g_hkopf":"1.0","g_kx":"0.6","g_ky":"0.6","g_uberd":"0.4","g_uberd_flach":"0.40","hkopf_conv":2,"kopf_in_gk":true,"l_HGx":"8","l_HGy":"8","l_HWx":"6","l_HWy":"6","l_MGx":"45","l_MGy":"45","l_MWx":"35","l_MWy":"35","l_NG":"50","lw_G":"1.35","lw_G1_inf":"0.80","lw_G1_sup":"1.20","lw_G_eig":"1","lw_G_gzg":"1.00","lw_G_inf":"0.8","lw_Q":"1.5","lw_Q1":"1.50","lw_Q_gzg":"1.00","p_bearbeiter":"","p_bemerk":"","p_datum":"2026-01-01","p_fundname":"Selbsttest","p_km":"","p_mastnr":"","p_name":"Selbsttest","p_nr":"","pb_L":"10.00","pb_auto":"1","pb_ax":"12","pb_ay":"12","pb_bank_d":"0.80","pb_bx":"2.00","pb_by":"2.00","pb_dG":"150","pb_ex":"0.00","pb_ey":"0.00","pb_gR":"1.40","pb_gS":"1.15","pb_hk":"1.00","pb_korr":"temp","pb_kx":"0.60","pb_ky":"0.60","pb_mode":"gruppe","pb_orient":"quer","pb_einbau":"ramm","pb_n":"4","pb_rot":"0","pb_skinfac":"1.0","pb_sx":"1.40","pb_sy":"1.40","pb_sys":"0","pb_ue":"0.40","pb_var":"0","pb_zugfac":"1.0","pfahl_abstand":"2.50","pfahl_alpha":"2.3","pfahl_anzahl":"2","pfahl_dex":"1.8","pfahl_dex_seite":"gleis","pfahl_dk":"15","pfahl_dm":"5","pfahl_e":"0.5","pfahl_hs":"0","pfahl_l":"4.00","pfahl_laf":"1.0","pfahl_lv_mode":"auto","pfahl_s":"4.00","pfahl_stab_nrd":"0","pfahl_typ":"HEB200","pfahl_zugfest":"ja","tw_Ea":"1.35","tw_Ep":"1.4","tw_c":"1.5","tw_phi":"1.2"};

function runSelfTest(){
  const _stRes=()=>(curResult()||{}).results;   // Ergebnisliste des aktiven Modells
  const T=[];   // {name, val, exp, tol, mode:'rel'|'abs', ok}
  const add=(name,val,exp,tol,mode)=>{
    let ok=false;
    if(isFinite(val)&&isFinite(exp)){
      const d=Math.abs(val-exp);
      ok = (mode==='abs') ? d<=tol : d<=tol*Math.max(1e-12,Math.abs(exp));
    }
    T.push({name,val,exp,tol,mode,ok});
  };
  // SETTINGS-Parameter pinnen (in-memory, nichts persistieren), danach wiederherstellen
  const bak={ mob:SETTINGS.mob, alphaZul:SETTINGS.alphaZul, alphaZulFull:SETTINGS.alphaZulFull,
    pfahlRandMin:SETTINGS.pfahlRandMin,
              stecknerSlope:SETTINGS.stecknerSlope, stecknerMob:SETTINGS.stecknerMob,
              pfahlGzgDecouple:SETTINGS.pfahlGzgDecouple, pfahlAlphaLat:SETTINGS.pfahlAlphaLat, sichAlphaLat:SETTINGS.sichAlphaLat,
              pfahlLatGroup:SETTINGS.pfahlLatGroup, pfahlLcrit:SETTINGS.pfahlLcrit,
              kappaE:SETTINGS.kappaE, bzG:SETTINGS.bauzustandGred,
              bzGv:SETTINGS.bauzustandGredVal, bzGs:SETTINGS.bauzustandGredSpezial,
              nw:SETTINGS.nw };
  SETTINGS.mob=0.25; SETTINGS.alphaZul=0.005; SETTINGS.alphaZulFull=0.010;
  SETTINGS.pfahlRandMin=0.30; SETTINGS.pfahlGzgDecouple=true;
  SETTINGS.pfahlAlphaLat=1.0; SETTINGS.sichAlphaLat=1.0;   // Golden = SIA 267 Gl. (53), k_s = E_s/D
  SETTINGS.pfahlLatGroup=true;     // Golden = p-Multiplier AN (bei gespreizten Pfählen ohnehin 1.0)
  SETTINGS.pfahlLcrit=10;          // Golden = Default-Deckel; T6-Pfahl hat L=10 m ⇒ kein Abzug
  SETTINGS.kappaE=1/6;             // Golden = Voreinstellung (wirkt nur bei aktivem Aushub)
  SETTINGS.bauzustandGred=false;   // Golden = voller γ_G,sup (Bauzustands-Reduktion ist opt-in)
  SETTINGS.bauzustandGredSpezial=false;
  SETTINGS.stecknerSlope=false;   // Golden = Original-Steckner (β_a=β_p=0)
  SETTINGS.stecknerMob=true;      // Golden = Passivdruck mobilisiert (Standard AN)
  // Bishop-Golden (T7) braucht den aktiven Nachweis; Struktur je Tragsystem (Aug 2026).
  // Alle uebrigen Nachweise werden ebenfalls gepinnt, damit die Golden nicht von einer
  // Nutzer-Abwahl in den Optionen abhaengen.
  _nwNorm();
  SETTINGS.nw = { block:{gzt:true,gzg:true,info:true},
                  flach:{sohlsp:true,grundb:true,gleiten:true,kippen:true,bishop:true},
                  pfahl:{geo:true,stahl:true,knick:true,lat:true,gzg:true},
                  sich:{lat:true,ax:true,stahl:true,sys:true,kern:true,verf:true,gzgsys:true} };
  // Selbsttest-Flag während des Laufs setzen (auch bei eval-Aufruf ohne ?selftest=1) → unterdrückt
  // Seiteneffekt-Defaults wie die Frisch-Flach-Stahlplatten-Vorbelegung (Golden-Zustand bleibt exakt).
  const _stModeBak = window._SELFTEST_MODE; window._SELFTEST_MODE = true;
  try{
    // ── T1 Hetényi: p-y-FE (bddBeamPY) gegen geschlossene Halbunendlich-Lösung y=2λ/k_w
    (()=>{ const ks=20000,B=0.2,EI=50000;
      const py=bddBeamPY(EI,B,0,10,1,z=>ks);
      const kw=ks*B, lam=Math.pow(kw/(4*EI),0.25);
      add('p-y-FE vs. Hetényi y=2λ/k_w', py?py.yHead_mm:NaN, 2*lam/kw*1000, 0.005,'rel'); })();
    // ── T2 Gruppengleichgewicht solvePfahlbock: N=400 auf 4 Pfähle → je +100 · My=100 → ±25
    (()=>{ const piles=[{x:-1,y:-1},{x:1,y:-1},{x:-1,y:1},{x:1,y:1}]
        .map(p=>({x:p.x,y:p.y,axDeg:0,ayDeg:0,kAx:50000,kLat:2500}));
      const sN=solvePfahlbock(piles,{N:400}), sM=solvePfahlbock(piles,{My:100});
      add('Gruppe N=400 → F je Pfahl', sN?Math.max(...sN.F.map(f=>Math.abs(f-100))):NaN, 0, 1e-6,'abs');
      add('Gruppe My=100 → |F|=25, ΣF=0', sM?Math.max(...sM.F.map(f=>Math.abs(Math.abs(f)-25)))+Math.abs(sM.F.reduce((a,b)=>a+b,0)):NaN, 0, 1e-6,'abs'); })();
    // ── T3 Mantelreibung analytisch: Kies q_s,k=200 · π·d_G·L
    (()=>{ const SB=SCHICHTEN;
      SCHICHTEN=[{phi:38,c:0,gamma:20,gamma2:10.5,d:999,name:'Kies',preset:'kies',me:80}];
      const sk=microSkinFriction(10,0.15,1.0,1.0);
      SCHICHTEN=SB;
      add('Mantelreibung Kies R_s,k=q_s·π·d·L', sk?sk.Rk:NaN, 160*Math.PI*0.15*10, 1e-6,'rel'); })();   // Kies 160 kPa (Okt 2026 gesenkt)
    // ── T4 Block/Steckner (Golden, kanonischer Zustand)
    applyState(_ST_STATE); calculate();
    (()=>{ const r=_stRes()&&_stRes()[0]||{};
      add('Block GZT η (Steckner Gl.66)', r.etaGZT, 2.0326494454949895, 1e-3,'rel');
      add('Block M_u [kNm]',              r.Mu_GZT, 270.44400872310837, 1e-3,'rel');
      add('Block GZG η (Schiefstellung)', r.etaGZG, 4.4150063488403495, 1e-3,'rel');
      // ── T4b Hebelarm Sohle → OK Kopf und die davon abhaengigen Sohlgroessen.
      // LUECKE, die Aug 2026 einen Fehler durchliess: die Golden pinnten nur etaGZT/M_u/etaGZG/N_d —
      // die laufen alle ueber M_ok_* und sind vom Hebelarm `arm` UNABHAENGIG. Als bei der H_Kopf-
      // Umstellung `arm = t + H_Kopf` stehenblieb (um ue zu lang), blieb der Selbsttest gruen,
      // waehrend Sohldruck, Ausmitte und Grundbruch beim Block zu unguenstig ausfielen.
      // arm ist einbindungsunabhaengig: H_Block + H_Kopf (nicht t + H_Kopf).
      add('Block Hebelarm Sohle→OK Kopf = H_Block + H_Kopf',
          _stRes()[0].Mxd / _stRes()[0].Hxd, 3.70, 1e-9,'abs');
      // Golden Okt 2026: Typ-2-Nachweise laufen über die 8 Kombinationen; die flachen Felder zeigen
      // Komb. 8 (alles ungünstig, auch das Eigengewicht mit γ_G,sup). Unabhängig am Vorstand
      // nachgestellt (8 einzeln gerechnete Kombinationen): σ_max 647.6134, η_GB,min 0.910692.
      add('Block σ_max [kPa] (arm-abhängig)', _stRes()[0].smax, 647.6133932635412, 1e-4,'rel');
      add('Block η_Grundbruch (informativ, arm-abhängig)', _stRes()[0].etaGB, 1.01509, 1e-4,'rel');
      add('Block N_d [kN] (Komb. 8 = 1.35·(N_G+G_k))', r.Nd, 233.65125, 1e-6,'rel'); })();
    // ── T4c Bettungsziffer C₁ (Okt 2026): automatisch der KLEINERE Wert aus Steckner Gl.3 und M_E·Kp/B.
    // Im Referenzfall deckelt M_u,char den GZG (η unverändert 4.415) — die Regel wird darum an C₁, tan α
    // und einem weichen Boden (M_E = 10) gepinnt.
    (()=>{ const mB=_c1Methode, cB=_c1Manual; _c1Methode='auto'; _c1Manual=false;
      const lauf=me=>{ applyState(_ST_STATE); _c1Methode='auto'; _c1Manual=false; SCHICHTEN[0].me=me; si('bg_me',String(me)); calculate();
                       return { a:c1AutoValue(), r:(_stRes()||[])[1]||{} }; };
      const m30=lauf(30), m10=lauf(10), m100=lauf(100);
      add('C₁ auto, M_E 30: min(Steckner 155 ; 30·3/1.3) [MN/m³]', m30.a.c1_eff, 30*3/1.3, 1e-6,'rel');
      add('C₁ auto, M_E 30: tan α',                               m30.r.alpha_GZG_calc, 0.0008031687995, 1e-4,'rel');
      add('C₁ auto, M_E 10: η_GZG (M_E begrenzt Steckner)',        m10.r.etaGZG, 2.014396844, 1e-4,'rel');
      add('C₁ auto, M_E 100: Steckner Gl.3 ist der kleinere Wert', m100.a.c1_eff, 155, 1e-6,'rel');
      // Setzungsmethode (Lang/Huder/Amann 11.6 / 8.5), unabhängig in Python nachgerechnet: G = 123.075 kN,
      // p = 72.83 kPa, davon 62 kPa Wiederbelastung; M′_E = 5·M_E → s = 0.6353 mm, k = 114.63 MN/m³; Verhältnis 1 → 36.56.
      applyState(_ST_STATE); _c1Methode='setzung'; _c1Manual=false; si('bg_me_ratio','5'); calculate();
      add('C₁ Setzung mit Wiederbelastung (M′_E = 5·M_E) [MN/m³]', c1AutoValue().c1_eff, 114.6324118, 1e-5,'rel');
      add('C₁ Setzung: Rechenkern übernimmt den Wert',            +gi('bg_c1'), 114.6, 0.06,'abs');
      si('bg_me_ratio','1');
      add('C₁ Setzung ohne Wiederbelastung (Verhältnis 1) [MN/m³]', c1AutoValue().c1_eff, 36.55849519, 1e-5,'rel');
      si('bg_me_ratio','5');
      _c1Methode=mB; _c1Manual=cB; applyState(_ST_STATE); calculate();
      // Ausgewiesene Setzung (kein Grenzwert): N_k = G_k + N_G = 173.075 kN, p = 102.41 kPa, davon 62 kPa Wiederbelastung
      add('Block Setzung s [mm] (N_k, M′_E = 5·M_E)', ((_stRes()||[])[1]||{}).setz ? _stRes()[1].setz.s*1000 : NaN, 1.444568, 1e-5,'rel'); })();
    // ── T5 Flach/Hansen (Golden). B×L auf 2.60 m VERGRÖSSERT gegenüber dem ST-Zustand:
    // Golden-Historie Aug 2026 — mit B = 1.30 liegt die Lastresultierende bei e_x/B = 0.757, also
    // AUSSERHALB der Sohlfläche; dort ist die Meyerhof-Ersatzfläche nicht definiert. Der frühere
    // Golden (η_GB 0.14457 / R_d 86.04) stammte aus dem auf Be = 0.1 m GEKLEMMTEN Wert und war damit
    // ein Phantomwert — er hat die Hansen-Formel gar nicht geprüft. Mit 2.60 m (e_x/B = 0.131,
    // Kippnachweis η = 4.37 erfüllt) liegt der Fall im Gültigkeitsbereich und T5 prüft die Formel.
    // g_hkopf explizit: der ST-Zustand traegt seit der Konventionsumstellung 1.00 (Gesamthoehe des
    // BLOCK-Kopfes). Beim Flach war H_Kopf schon immer die Gesamthoehe ab OK Platte — mit 0.60 pinnt
    // T5 unveraendert denselben physischen Fall wie vor der Umstellung.
    setModel('flach'); si('g_bx','2.60'); si('g_by','2.60'); si('g_hkopf','0.60'); calculate();
    (()=>{ const r=_stRes()&&_stRes()[0]||{};
      // Golden Okt 2026 (8 Kombinationen statt einer von Hand gewählten; unabhängig nachgestellt):
      // Grundbruch massgebend Komb. 8 (η 1.7975 → 1.6459, das Eigengewicht trägt jetzt γ_G,sup),
      // Gleiten massgebend Komb. 4 (η 6.3752 → 6.8035, N und H aus DERSELBEN Kombination).
      // Golden Okt 2026, dritte Fassung (Nutzerentscheid «Grundbruch nach SIA»): erweiterte Tragfähigkeitsformel
      // nach Lang/Huder/Amann 9.2 wie in SIA D 0197 Kap. 5.3.4.3 (N_γ = 1.8·(N_q−1)·tanφ, s_γ = 1 − 0.4·b̄/l̄,
      // Tiefenfaktoren, i_q = (1 − ½T/N)⁵, i_γ = (1 − 0.7T/N)⁵). Unabhängig nachgerechnet: φ_d 25.693°, b̄ 2.0829,
      // N_q 11.4734, N_γ 9.0702, s_q 1.3854, s_γ 0.6795, d_q 1.0587, i_q 0.9304, i_γ 0.9036 ⇒ σ_f,d 241.2728 kPa,
      // R_d 1306.65 kN, η = 1.891516 (EN 1997-1 Anh. D: 2.087308; ursprünglich gegen σ_max: 1.645932).
      add('Flach Grundbruch η', r.etaGB, 1.891516,  1e-5,'rel');
      // Golden Okt 2026: γ_G,inf = 1.00 für Gleiten/Grundbruch von Fundationen (SIA 267 Ziff. 8.5.2.4, am Normtext
      // nachgelesen) statt des allgemeinen Werts aus lw_G_inf (0.80): Komb. 4 mit N_d = 1.00·461.7 + 1.35·50 =
      // 529.2 kN ⇒ η = 529.2·tan(0.667·25.6934°)/19.8 = 8.241527 (vorher 6.803465).
      // Okt 2026, zweite Anpassung (Nutzerentscheid): δ nach Ziff. 8.4.1.1 — δ_k = 0.667·30° = 20.01°,
      // δ_d = arctan(tan 20.01°/1.2) = 16.8816° (vorher 0.667·φ_d = 17.137°) ⇒ η = 529.2·tan δ_d/19.8 = 8.111012.
      add('Flach Gleiten η',    r.etaGL, 8.111012,  1e-5,'rel');
      add('Flach Gleiten: δ_d = arctan(tan δ_k/γ_φ)', r.t2&&r.t2.gl.glD.dD*180/Math.PI, 16.881640, 1e-6,'rel');
      add('Flach Gleiten: Kohäsion ohne Wahl nicht angesetzt', r.t2&&r.t2.gl.glD.cR, 0, 0,'abs');
      { const b=collectCalcInputs(), S=(b.SCHICHTEN||SCHICHTEN).map(x=>({...x, c:15}));
        const v=_doCalculate({...b, raw:{...b.raw, bg_c_gleit:'1'}, SCHICHTEN:S, _pure:true}).results[0].t2.gl;
        add('Flach Gleiten: Kohäsion gewählt ⇒ A′·c′_d (Gl. 31)', v.glD.cR, (15/1.5)*v.Be*v.Le, 1e-9,'rel');
        const o=_doCalculate({...b, SCHICHTEN:S, _pure:true}).results[0].t2.gl;
        add('Flach Gleiten: c′ > 0 ohne Wahl bleibt ohne Kohäsion', o.glD.cR, 0, 0,'abs'); }
      add('Flach σ_f,d [kPa]',  r.Rd,    241.27279, 1e-5,'rel');
      add('Flach R_d = σ_f,d·A′ [kN]', r.t2&&r.t2.gb.gbD.RdKN, 1306.6498, 1e-5,'rel');
      // grundbruchSIA gegen die Tabellen des Buchs: Tab. 9.2.8 (φ 30°: N_c 30.1, N_q 18.4, N_γ 18.1),
      // Tab. 9.2.14 (t/b = 1, φ 30°: d_c 1.32, d_q 1.23), Tab. 9.2.16 (δ_R = 10°: i_q 0.63, i_γ 0.52)
      { const g=grundbruchSIA({phi:Math.PI/6,c:0,q:10,gam:18,B:2,L:2,t:2,N:1000,T:1000*Math.tan(10*Math.PI/180)});
        add('Buch Tab. 9.2.8: N_γ(30°) ≈ 18.1', g.Ng, 18.1, 0.05,'abs');
        add('Buch Tab. 9.2.14: d_q(t/b = 1, 30°) ≈ 1.23', g.dq, 1.23, 0.006,'abs');
        add('Buch Tab. 9.2.16: i_q(10°) ≈ 0.63 · i_γ ≈ 0.52', Math.abs(g.iq-0.63)<0.006 && Math.abs(g.ig-0.52)<0.006 ? 1:0, 1, 0,'abs');
        add('SIA D 0197 Tab. 5.3-6: N_γ(φ_d 25.7°) = 9.07', grundbruchSIA({phi:Math.atan(Math.tan(Math.PI/6)/1.2),c:0,q:0,gam:20,B:1,L:1e6,N:1}).Ng, 9.07, 0.006,'abs'); }
      add('Undräniert (9.2.17): σ_f = 5.1·s_u·(1 + 0.2·b/l) + q', grundbruchSIA({phi:0,c:50,q:10,B:2,L:2,N:1000}).sigf, 5.1*50*1.2+10, 1e-9,'rel');
      add('Flach Grundbruch: massgebende Kombination', r.t2&&r.t2.gb.komb, 8, 0,'abs');
      add('Flach Gleiten: massgebende Kombination',    r.t2&&r.t2.gl.komb, 4, 0,'abs');
      add('Flach N_d [kN] (Komb. 8 = 1.35·(N_G+G_k))', r.Nd, 690.795, 1e-6,'rel');
      // Gebrauchstauglichkeit (SIA 267 Ziff. 8.5.4), LF 2 charakteristisch: N_k = 50 + 461.7 = 511.7 kN,
      // M_k = (8+6)·3.30 + 80 = 126.2 kNm ⇒ e = 0.24663 m, e/B = 0.094857 ⇒ η_Kern = 1.757041.
      // Verkippung: G = 30000·0.4/1.4 = 8571.43 kPa, r = 2.6·(1/(3π))^¼ = 1.483903 m,
      // K = 8·G·r³/(3·0.7) = 106694.15 kNm ⇒ tan α = 1.182820e-3, η = 0.01/tan α = 8.4544.
      const z=(_stRes()[1]||{}).gzgF||{};
      add('Flach GZG: η Kernweite (8.5.4.7)', z.etaKern, (1/6)/((126.2/511.7)/2.6), 1e-6,'rel');
      add('Flach GZG: tan α (Borowicka)', z.tan, 126.2/(8*(30000*0.4/1.4)*Math.pow(2.6*Math.pow(1/(3*Math.PI),0.25),3)/2.1), 1e-6,'rel');
      add('Flach GZG: η = min(Kernweite, Verkippung)', (_stRes()[1]||{}).etaGZG, 1.757041, 1e-5,'rel'); })();
    // ── T5c H_Kopf wirkt beim Flach auf die Vertikallast. Bis Aug 2026 zaehlte der
    // Fundamentkopf beim Flachfundament GAR NICHT mit — H_Kopf war dort ohne jeden
    // Einfluss auf N_d, obwohl der Kopf im 3D gezeichnet und im Bericht bemasst wird.
    // Erwartung: ΔN_d = γ_G,sup·B_Kopf·L_Kopf·ΔH_Kopf·γ_Beton = 1.35·0.6·0.6·0.60·25 = 7.29 kN.
    (()=>{ const n1=_stRes()[0].Nd;
      si('g_hkopf','0'); calculate(); const n0=_stRes()[0].Nd;
      si('g_hkopf','0.60'); calculate();
      add('Flach ΔN_d aus H_Kopf [kN]', n1-n0, 7.29, 1e-6,'abs'); })();
    // ── T5b Ausmitte-Guard: Resultierende ausserhalb der Sohlfläche ⇒ Grundbruch NICHT führbar
    // (schützt den Aug-2026-Fix gegen Rückfall auf den geklemmten Phantomwert)
    si('g_bx','1.30'); si('g_by','1.30'); calculate();
    (()=>{ const r=_stRes()&&_stRes()[0]||{};
      add('Flach Ausmitte-Guard: η_GB = 0 bei e/B ≥ 0.5', r.etaGB, 0, 1e-9,'abs'); })();
    // ── T6 Pfahlfundament (Golden; Result-Felder sind auf 2 Dez. gerundet → abs-Toleranz)
    setModel('pfahlbock');
    (()=>{ const r=RESULT.pfahlbock&&RESULT.pfahlbock.r||{};
      // Golden Okt 2026 (SIA 267 Kap. 9 am Normtext, Nutzerentscheid P1–P3 mit η_a = 0.7): R_a,d = η_a·R_a,k/γ_M,a
      // statt R_k/1.40, innerer Widerstand η_i·R_mat,d. Herleitung aus den bisherigen Werten:
      //   R_s,d  336.6·1.40·0.7/1.3 = 253.75 kN   ·   η_Geo  3.27·1.40·0.7/1.3 = 2.465
      //   η_Stahl 2.09·0.80 = 1.672   ·   η_Knick 2.42·0.80 = 1.936   ·   η_GZG unverändert (charakteristisch)
      add('Pfahl η_Geo (Mantelreibung)', r.etaGeo,   2.46, 0.015,'abs');
      add('Pfahl: η_Geo folgt R_k·η_a/γ_M,a (0.7/1.3 gegen 1/1.4)', r.etaGeo, 3.27*1.4*0.7/1.3, 0.015,'abs');
      add('Pfahl η_Stahl (N+M)',         r.etaSteel, 1.84, 0.015,'abs');   // Okt 2026: k_s = E_s/D (vorher 1.67 mit α = 0.30)
      add('Pfahl η_Knick (SIA 263)',     r.etaKnick, 2.32, 0.015,'abs');
      add('Pfahl η_GZG',                 r.etaGZG,   7.41, 0.015,'abs');
      // Zyklische Abminderung der Mantelreibung: Faktor 0.80 ⇒ R_s,d = 0.80·336.6 = 269.3 kN; 1.0 ⇒ unverändert
      si('pb_zykfac','0.8'); renderPfahlbock();
      add('Pfahl zyklisch 0.80: R_skin,d', (RESULT.pfahlbock.r||{}).Rskin_d, 0.8*253.75, 0.15,'abs');
      add('Pfahl zyklisch 0.80: η_Geo', (RESULT.pfahlbock.r||{}).etaGeo, 0.8*2.465, 0.02,'abs');
      si('pb_zykfac','1.0'); renderPfahlbock();
      add('Pfahl zyklisch 1.00: R_skin,d unverändert', (RESULT.pfahlbock.r||{}).Rskin_d, 253.75, 0.06,'abs');
      // Zug strenger als Druck: R_s,d,Zug / R_s,d,Druck = γ_M,a,Druck/γ_M,a,Zug = 1.3/1.6
      add('Pfahl: R_s,d Zug / Druck = 1.3/1.6', (RESULT.pfahlbock.r||{}).Rskin_dZ/(RESULT.pfahlbock.r||{}).Rskin_d, 1.3/1.6, 2e-3,'abs');
      // η_a = 1.0 (statische Probebelastung) hebt den Widerstand um 1/0.7
      si('pb_etaA','1.0'); renderPfahlbock();
      add('Pfahl η_a = 1.0: R_s,d = R_s,k/1.3', (RESULT.pfahlbock.r||{}).Rskin_d, 253.75/0.7, 0.1,'abs');
      si('pb_etaA','0.7'); renderPfahlbock();
      add('Pfahl R_s,d [kN]',            r.Rskin_d,  253.75, 0.5,'abs');
      // Aufbruchsicherheit der Zugpfähle (SIA 267 Ziff. 9.5.3.3): ohne Zug kein Nachweis; mit grossem Moment
      // G_E,k je Zugpfahl = l_a·l_b·(L − ⅓·√(l_a²+l_b²)·cot 30°)·0.80·γ, η = 0.90·n_Z·G_E,1/Z_d
      // (im Referenzfall zieht bereits die Kombination mit γ_G,inf und vollem γ_Q an zwei Pfählen)
      add('Aufbruch: Referenzfall hat Zugpfähle und erfüllt den Nachweis', (r.etaAuf!=null && r.etaAuf>1 && r.auf.nZ===2)?1:0, 1, 0,'abs');
      si('l_MWy','600'); renderPfahlbock();
      { const q=RESULT.pfahlbock.r||{}, a=q.auf||{}, sx=+gi('pb_sx'), sy=+gi('pb_sy'), L=+gi('pb_L');
        const GE1=sx*sy*(L-Math.hypot(sx,sy)/3/Math.tan(Math.PI/6))*0.80*20;
        add('Aufbruch: G_E,k je Zugpfahl (EA-Pfähle-Formel)', a.GE1, GE1, 0.06,'abs');
        add('Aufbruch: η = 0.90·n_Z·G_E,1/Z_d', q.etaAuf, 0.90*a.nZ*GE1/a.Z, 0.011,'abs'); }
      si('l_MWy','35'); renderPfahlbock(); })();
    // ── T6b Lastbeiwerte wirken auch beim Pfahlfundament (Okt 2026: es las bis dahin die im
    // LF-Objekt eingefrorenen 1.35/1.50 statt der Felder). Mit γ = 1.00: N_d = N_G + G_eig
    // = 50 + (2.0·2.0·0.8 + 0.6·0.6·1.0)·25 = 139.00 kN.
    (()=>{ si('lw_G','1.00'); si('lw_Q','1.00'); renderPfahlbock();
      const r=RESULT.pfahlbock&&RESULT.pfahlbock.r||{};
      add('Pfahl N_d folgt γ_G (γ=1.00 ⇒ N_G+G_eig)', r.govLoad&&r.govLoad.N, 139.00, 1e-6,'abs');
      si('lw_G','1.35'); si('lw_Q','1.50'); })();
    // ── T7 Bishop-Gleitkreis (Golden: Flach + Böschung β=−30°, h_β=3 m)
    // Zustand frisch herstellen — T5/T5b haben g_bx/g_by verändert, und q_block des Gleitkreises
    // hängt vom Footprint ab (sonst würde der Bishop-Golden mitwandern).
    applyState(_ST_STATE);
    setModel('flach');
    si('bg_beta','-30'); si('bg_bhoehe','3'); si('bg_bfuss','1.0');
    (()=>{ const bt=document.getElementById('bg_btyp'); if(bt) bt.value='boeschung'; })();
    calculate();
    (()=>{ const b=RESULT.flach&&RESULT.flach.bishop;
      // Golden Aug 2026 korrigiert: y_H (Angriffspunkt H) lag um ü zu tief — die Zeile rechnete
      // schon immer g_hkopf−ü, das Feld führte aber den Überstand statt der Gesamthöhe.
      // Verifiziert: y_H 0.20 → 0.60 (= OK Kopf), M_H 13.81 → 12.45, η 0.956756 → 0.993085.
      add('Bishop Böschung η (β=−30°)', b&&b.ok?b.eta:NaN, 0.9930846, 5e-3,'rel'); })();
    // ── T8 Modellwechsel: die Flach-Geometrie und die Stahlwichte dürfen weder ins Pfahlfundament
    // noch (über den Umweg Pfahlfundament) in den Block durchschlagen (Okt 2026).
    applyState(_ST_STATE);
    setModel('flach');
    si('g_bx','1.50'); si('g_by','3.00'); si('g_hblock','0.09'); si('g_hkopf','0');
    si('g_gbeton','78.5'); FLACH_MAT='stahl';
    setModel('pfahlbock');
    (()=>{ const r=RESULT.pfahlbock&&RESULT.pfahlbock.r||{};
      add('Wechsel Flach(Stahl)→Pfahl: N_d mit Betonwichte', r.govLoad&&r.govLoad.N, 187.65, 1e-6,'abs'); })();
    setModel('block'); calculate();
    (()=>{ const r=_stRes()&&_stRes()[0]||{};
      add('Wechsel Flach→Pfahl→Block: η_GZT unverändert', r.etaGZT, 2.0326494, 1e-3,'rel');
      add('Wechsel Flach→Pfahl→Block: γ_Beton = 25', +gi('g_gbeton'), 25, 1e-9,'abs'); })();
    FLACH_MAT='beton'; applyState(_ST_STATE);
    // ── T9 Rechenkontext: Varianten laufen über das Eingabepaket, ohne die Eingabefelder zu
    // berühren (Lastbeiwerte, Grundwasser und Schichten erreichten den Kern früher nur über das DOM;
    // der reduzierte Bauzustands-Beiwert der Dimensionierung blieb dadurch wirkungslos).
    (()=>{ const b=collectCalcInputs();
      const v=_doCalculate({...b, raw:{...b.raw, lw_G:'1.00', lw_Q:'1.00', lw_G_inf:'1.00'}, _pure:true}).results[0];
      add('Variante γ=1.00 über Eingabepaket: N_d = N_G+G_k', v.Nd, 173.075, 1e-6,'rel');
      add('Variante lässt das Eingabefeld unberührt (lw_G)', +gi('lw_G'), 1.35, 1e-9,'abs');
      const g=_doCalculate({...b, raw:{...b.raw, bg_gw:'ja', bg_gwt:'1.0'}, _pure:true}).results[0];
      add('Variante Grundwasser 1.0 m: η_GZT', g.etaGZT, 1.53068, 1e-4,'rel'); })();
    // ── T9b Auftrieb am Fundamentkopf: GW 0.20 m unter GOK, OK Block bei ü = 0.40 ⇒ der Kopf taucht
    // 0.20 m ein: ΔAuftrieb = B_K·L_K·0.20·10 = 0.6·0.6·0.20·10 = 0.72 kN gegenüber GW an OK Block.
    (()=>{ const b=collectCalcInputs(), A=z=>_doCalculate({...b, raw:{...b.raw, bg_gw:'ja', bg_gwt:z}, _pure:true}).G.G_auftrieb;
      add('Auftrieb am Kopf: Δ bei GW 0.20 m über OK Block [kN]', A('0.20')-A('0.40'), 0.72, 1e-9,'abs'); })();
    // ── T11 Bettungsbalken mit KOPFMOMENT gegen Hetényi (langer Balken, k_w = k_s·B konstant):
    // y0 = 2·M·λ²/k_w, θ0 = 4·M·λ³/k_w. Grundlage des Einzelpfahl-Nachweises (Okt 2026).
    (()=>{ const EI=11962, B=0.2, ks=30000, kw=ks*B, lam=Math.pow(kw/(4*EI),0.25);
      const m=bddBeamPY(EI,B,0,14,0,()=>ks,{M0:1});
      add('p-y-FE Kopfmoment: y0 = 2Mλ²/k_w', m?m.yHead_mm/1000:NaN, 2*lam*lam/kw, 5e-3,'rel');
      add('p-y-FE Kopfmoment: θ0 = 4Mλ³/k_w', m?m.thetaHead:NaN, 4*Math.pow(lam,3)/kw, 5e-3,'rel'); })();
    // ── T12 Einzelpfahl: das Mastmoment am Kopf muss in den Stahlnachweis eingehen
    // (bis Okt 2026 rechnete er nur mit dem Moment aus der Querkraft: η 13.2 statt 1.65).
    applyState(_ST_STATE); setModel('pfahlbock'); si('pb_mode','einzel'); si('pb_prof','HEB200');
    si('pb_orient','quer'); si('pb_einbau','ramm'); si('pb_e','0'); onPbMode();
    (()=>{ const r=RESULT.pfahlbock&&RESULT.pfahlbock.r||{}, ld=r.govLoad||{};
      add('Einzelpfahl: M_Ed ≥ Kopfmoment M_d', (r.Mmax>=Math.abs(ld.My||0)-0.5)?1:0, 1, 0,'abs');
      // Stahlprofil nach SIA 263 Ziff. 4.1.3: γ_M1 = 1.05 statt 1.15 ⇒ η 1.65·1.15/1.05 = 1.807
      add('Einzelpfahl HEB 200: η_Stahl', r.etaSteel, 1.77, 0.015,'abs');
      add('Einzelpfahl HEB 200: η_GZG', r.etaGZG, 0.97, 0.015,'abs'); })();
    // ── T13 Ergänzungen Okt 2026: Spitzenwiderstand, Torsion, Rammrohr, Längenbemessung
    (()=>{ const R=()=>RESULT.pfahlbock&&RESULT.pfahlbock.r||{};
      const eta0=R().etaGeo;
      si('pb_qb','5000'); si('pb_spitze','voll'); renderPfahlbock();
      add('Spitze: unter 300 mm Breite nicht angesetzt (HEB 200)', R().Rb_k, 0, 1e-9,'abs');
      si('pb_prof','HEB300'); renderPfahlbock(); const eta3=R().etaGeo;
      add('Spitze: R_b,k = q_b,k·b·h = 5000·0.09 (HEB 300)', R().Rb_k, 450, 0.05,'abs');
      si('pb_qb','0'); renderPfahlbock();
      add('Spitze erhöht η_Geo (Druck)', eta3>R().etaGeo?1:0, 1, 0,'abs');
      // Krinner V 140: Rohr 139.7 × 6.3, S235, 1.5 mm Abrostung (DIBt Z-34.15-253)
      si('pb_prof','KRV140'); renderPfahlbock();
      add('Krinner V 140: N_pl,k = A(t − 1.5 mm)·235', R().N_pl_k, Math.PI/4*(Math.pow(0.1367,2)-Math.pow(0.1271,2))*235000, 1.0,'abs');
      si('pb_prof','HEB200'); si('pb_spitze','stahl'); renderPfahlbock();
      // Torsion HEB 200: W_t = I_T/t_f, I_T = (2·b·t_f³ + h_w·t_w³)/3 ⇒ T_Rd = W_t·f_yk/(√3·γ_s)
      const eS0=R().etaSteel; si('l_TW','2'); renderPfahlbock();
      const It=(2*0.2*Math.pow(0.015,3)+0.17*Math.pow(0.009,3))/3;
      add('Torsion: T_Rd Stahl HEB 200', R().tors?R().tors.TRst:NaN, It/0.015*355000/Math.sqrt(3)/(+gi('pb_gM1')||1.05), 0.01,'abs');
      add('Torsion senkt η_Stahl', R().etaSteel<eS0?1:0, 1, 0,'abs');
      add('Torsion: Nachweis über Mantelreibung geführt', (R().etaTors!=null&&isFinite(R().etaTors))?1:0, 1, 0,'abs');
      si('l_TW','0'); renderPfahlbock();
      add('Ohne Torsion: η_Stahl unverändert', R().etaSteel, eS0, 1e-9,'abs');
      si('pb_prof','RR324'); renderPfahlbock();
      add('Rammrohr Ø 323.9: Breite im Rechenkern', R().dG, 0.3239, 1e-4,'abs');
      si('pb_prof','HEB200'); })();
    // ── T14 Felsfundament (Sockel 2.0×2.0 m, 4 Anker s = 1.40 m, l_v = 3.0 m, τ_k = 600 kPa, σ_R,d = 2000 kPa).
    // Handrechnung Komb. 4 (N = 138.7 kN, M_y = 148.89 kNm): x = (N+Z)/(σ·l), Z = (M − N·(b/2 − x/2))/(a + b/2 − x/2)
    // → Z = 7.567 kN auf 2 Anker; R_a,d = 0.7·600·π·0.15·3/1.6 = 371.1 kN; G_E = 25·π/3·1.732²·3·(1.4/3.464) = 95.2 kN (Kürzung nur entlang der Zugreihe).
    (()=>{ applyState(_ST_STATE); setModel('pfahlbock'); si('pb_mode','fels'); onPbMode();
      si('pb_L','3'); si('pb_ftau','600'); si('pb_fsig','2000'); si('pb_fmu','0.60'); si('pb_fkeg','30'); si('pb_fgam','25'); calculate();
      const r=(RESULT.pfahlbock||{}).r||{}, k4=(r.kombs||[]).find(k=>k.nr===4)||{qx:{}};
      add('Fels: Ankerzug Z Komb. 4 [kN]',           k4.qx.Z, 7.567213, 1e-5,'rel');
      add('Fels: Verbund R_a,d [kN]',                 r.Ra_d, 371.1, 0.06,'abs');
      add('Fels: η Felsausbruch',                     r.etaAusb, 22.65, 0.015,'abs');
      add('Fels: η Felspressung (Komb. 8, ohne Zug)', r.etaPress, 8.81, 0.015,'abs');
      add('Fels: η Gleiten',                          r.etaGleit, 3.69, 0.015,'abs');
      // Schiefstellung: unter den charakteristischen Lasten des Referenzfalls kein Ankerzug ⇒ η = ∞. Mit M_Wy = 120 kNm:
      // N_k 139, M_k 190.2 → Z = 32.2745 kN (2 Anker), δ = 16.137·2.3/164820 = 0.2252 mm, Hebel 1.6786 m,
      // tan α = 1.3415e-4; nur ständig: kein Zug ⇒ Zuwachs = 1.3415e-4 gegen 1:200 → η = 37.27.
      add('Fels: GZG ohne Ankerzug η = ∞', isFinite(r.etaGZG) ? 0 : 1, 1, 1e-9,'abs');
      si('l_MWy','120'); calculate();
      add('Fels: η Schiefstellung (Zuwachs aus veränderlich, 1:200)', ((RESULT.pfahlbock||{}).r||{}).etaGZG, 37.27, 0.02,'abs');
      si('l_MWy','35'); si('pb_ftau','0'); calculate();
      add('Fels: ohne τ_k ist der Verbundnachweis nicht erfüllt (η = 0)', ((RESULT.pfahlbock||{}).r||{}).etaVerb, 0, 1e-9,'abs'); })();
    si('pb_mode','gruppe'); onPbMode(); applyState(_ST_STATE); setModel('pfahlbock');
    (()=>{ pbDimLaenge(); const L=+gi('pb_L'), r=RESULT.pfahlbock&&RESULT.pfahlbock.r||{};
      const kurz=renderPfahlbock({nurRechnen:true, L:L-0.5});
      add('Längenbemessung: gefundene Länge erfüllt', etaErf(r.eta_massg)?1:0, 1, 0,'abs');
      add('Längenbemessung: 0.5 m kürzer erfüllt nicht', (L<=1.0 || !etaErf(kurz.eta_massg))?1:0, 1, 0,'abs'); })();
    applyState(_ST_STATE);
    // ── T10 Erfüllt-Regel: entschieden wird auf dem angezeigten 2-Dezimal-Wert
    add('etaErf(0.997) = erfüllt', etaErf(0.997)?1:0, 1, 0,'abs');
    add('etaErf(0.994) = nicht erfüllt', etaErf(0.994)?1:0, 0, 0,'abs');
    add('etaErf(∞) = erfüllt', etaErf(Infinity)?1:0, 1, 0,'abs');
  } catch(err){
    T.push({name:'AUSNAHME: '+(err&&err.message||err), val:NaN, exp:NaN, tol:0, mode:'abs', ok:false});
  } finally {
    SETTINGS.mob=bak.mob; SETTINGS.alphaZul=bak.alphaZul; SETTINGS.alphaZulFull=bak.alphaZulFull;
    SETTINGS.pfahlRandMin=bak.pfahlRandMin;
    SETTINGS.stecknerSlope=bak.stecknerSlope; SETTINGS.stecknerMob=bak.stecknerMob;
    SETTINGS.pfahlGzgDecouple=bak.pfahlGzgDecouple; SETTINGS.pfahlAlphaLat=bak.pfahlAlphaLat; SETTINGS.sichAlphaLat=bak.sichAlphaLat;
    SETTINGS.pfahlLatGroup=bak.pfahlLatGroup; SETTINGS.pfahlLcrit=bak.pfahlLcrit;
    SETTINGS.kappaE=bak.kappaE; SETTINGS.bauzustandGred=bak.bzG;
    SETTINGS.bauzustandGredVal=bak.bzGv; SETTINGS.bauzustandGredSpezial=bak.bzGs;
    SETTINGS.nw=bak.nw;
    window._SELFTEST_MODE = _stModeBak;
  }
  _renderSelfTest(T);
  return T;
}
function _renderSelfTest(T){
  const nOk=T.filter(t=>t.ok).length, all=T.length, pass=nOk===all;
  const fmt=v=>!isFinite(v)?'–':(Math.abs(v)>=100?v.toFixed(2):v.toPrecision(6));
  let el=document.getElementById('selftest-ov');
  if(!el){ el=document.createElement('div'); el.id='selftest-ov'; document.body.appendChild(el); }
  el.style.cssText='position:fixed;inset:0;z-index:200;background:var(--bg);color:var(--on);overflow:auto;padding:28px 32px;font-family:var(--f-mono);font-size:11px';
  el.innerHTML=`
    <div style="max-width:860px;margin:0 auto">
      <div style="display:flex;align-items:baseline;gap:14px;border-bottom:2px solid var(--on);padding-bottom:10px;margin-bottom:4px">
        <span style="font-size:15px;font-weight:600;letter-spacing:0.03em">BlockCalc Selbsttest</span>
        <span style="color:var(--dim)">Golden- und Analytik-Anker · SIA-267-Verankerung</span>
        <span style="flex:1"></span>
        <span style="font-weight:600;color:${pass?'var(--ok)':'var(--fail)'}">${nOk} / ${all} ${pass?'BESTANDEN':'FEHLGESCHLAGEN'}</span>
      </div>
      <div style="color:var(--xdim);font-size:9.5px;margin-bottom:14px">Der Selbsttest überschreibt den Auto-Entwurf nicht. Zum normalen Betrieb: Seite ohne <span style="color:var(--dim)">?selftest=1</span> laden.</div>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>
          <th style="text-align:left;padding:5px 8px;border-bottom:1px solid var(--ol);font-size:8.5px;letter-spacing:0.07em;text-transform:uppercase;color:var(--xdim)">Test</th>
          <th style="text-align:right;padding:5px 8px;border-bottom:1px solid var(--ol);font-size:8.5px;letter-spacing:0.07em;text-transform:uppercase;color:var(--xdim)">Wert</th>
          <th style="text-align:right;padding:5px 8px;border-bottom:1px solid var(--ol);font-size:8.5px;letter-spacing:0.07em;text-transform:uppercase;color:var(--xdim)">Erwartet</th>
          <th style="text-align:right;padding:5px 8px;border-bottom:1px solid var(--ol);font-size:8.5px;letter-spacing:0.07em;text-transform:uppercase;color:var(--xdim)">Toleranz</th>
          <th style="text-align:right;padding:5px 8px;border-bottom:1px solid var(--ol);font-size:8.5px;letter-spacing:0.07em;text-transform:uppercase;color:var(--xdim)">Status</th>
        </tr></thead>
        <tbody>${T.map(t=>`<tr style="border-bottom:1px solid var(--ol)">
          <td style="padding:5px 8px;color:var(--on2)">${esc(t.name)}</td>
          <td style="padding:5px 8px;text-align:right">${fmt(t.val)}</td>
          <td style="padding:5px 8px;text-align:right;color:var(--dim)">${fmt(t.exp)}</td>
          <td style="padding:5px 8px;text-align:right;color:var(--xdim)">${t.mode==='rel'?(+(t.tol*100).toPrecision(2))+'%':t.tol}</td>
          <td style="padding:5px 8px;text-align:right;font-weight:600;color:${t.ok?'var(--ok)':'var(--fail)'}">${t.ok?'OK':'ABWEICHUNG'}</td>
        </tr>`).join('')}</tbody>
      </table>
      <div style="margin-top:16px;color:var(--xdim);font-size:9.5px;line-height:1.7">
        Anker: Hetényi-Halbunendlich-Balken (p-y-FE) · räumliches Gruppengleichgewicht (starres Bankett) ·
        Mantelreibung EA-Pfähle (analytisch) · Steckner Gl. 66 / GZG Gl. 21 · Hansen-Grundbruch/Gleiten ·
        Bishop-Gleitkreis (Taylor-validierte Suche). Golden-Werte eingefroren Jul 2026.
      </div>
    </div>`;
  document.title='Selbsttest '+(pass?'OK':'FEHLER')+' · BlockCalc';
}

// ════════════════════════════════════════════
