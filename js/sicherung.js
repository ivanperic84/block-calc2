// BlockCalc — js/sicherung.js
// Sicherung/Aushub: Bauzustand, Starrkörperbilanz, calcPfahlsicherung
// γ_G,red (typ. 1.20 statt 1.35) für Zustände mit kurzer Standzeit. So wurde in der
// Typenzulassungsstatik gerechnet. Für SPEZIALFUNDAMENTE ist der Ansatz nicht zulässig —
// dort greift er nur über die ausdrückliche Ausnahme.
// Abgrenzung: typengeprüft ist das Standard-BLOCKfundament; Flach- und Pfahlfundament
// gelten hier als Spezialfundament.
function _bzSpezialfundament(){
  return !curModel().standard;
}
function _bzGredActive(){
  if(!SETTINGS || SETTINGS.bauzustandGred !== true) return false;
  if(_bzSpezialfundament() && SETTINGS.bauzustandGredSpezial !== true) return false;
  return true;
}
// Wird für Spezialfundamente unterdrückt, obwohl eingeschaltet? → für den Warnhinweis
function _bzGredBlocked(){
  return SETTINGS && SETTINGS.bauzustandGred === true
      && _bzSpezialfundament() && SETTINGS.bauzustandGredSpezial !== true;
}
// Effektiver ständiger Lastbeiwert im Bauzustand; gGsup = der reguläre Wert (γ_G,sup).
// Nie grösser als gGsup — die Option darf nur reduzieren, nie erhöhen.
function _bzGred(gGsup){
  const g = Math.max(1, +gGsup || 1.35);
  if(!_bzGredActive()) return g;
  return Math.min(g, Math.max(1.0, +(SETTINGS.bauzustandGredVal ?? 1.20)));
}

// ══ Starrkörperbilanz um die Fusskante (Zweitmodell zu Steckner Gl.66) ═════════════
// Klassisches Kippen des freigelegten Blocks um die Aushubkante O an der Unterkante:
//   treibend  M_t,d = M_d + H_d·z_H + E_a,d·z_a
//   haltend   M_h,d = E_p,d·z_p + V_d,inf·b/2
// Warum das zusätzlich zu Gl.66 gerechnet wird (Aug 2026, aus dem Vergleich mit dem
// MaFuSi-Konzept der Aegerter & Bosshardt AG für die SBB):
//   (a) Gl.66 setzt eine Nulllinie IM Block voraus. Zehrt ein tiefer einseitiger Aushub
//       den Erdwiderstand über der NL auf, verlässt die Formel ihren Gültigkeitsbereich
//       (`dEx_degen`) und liefert gar kein Ergebnis mehr. Diese Bilanz bleibt bis zum
//       vollständigen Freilegen (h_p = 0) gültig und geht dort stetig in den freien,
//       von der Sicherung gehaltenen Körper über.
//   (b) Sie liefert die Sohlexzentrizität e und damit den Kernweite-Nachweis, den Gl.66
//       nicht kennt: dort ist e → b/2 zulässig, solange der Boden p_u auf schmalem
//       Streifen trägt (Tragfähigkeitslimit). e ≤ κ_e·b ist dagegen ein Robustheitslimit.
//   (c) Sie ist durchgehend konservativer als Gl.66 (alle dort zusätzlich angesetzten
//       Terme — Seitenflächen-Erddruck, Wandreibungen, Widerstand unter der NL — wirken
//       netto stabilisierend). Als Zweitmeinung zeigt sie, wie viel Kapazität aus ihnen stammt.
// Erddruck über `intEarthPress` → Schichtung und Grundwasser wirken wie im übrigen Kern
// (das Vergleichswerkzeug rechnet hier mit einer homogenen Schicht ohne GW).
function rigidBlockBalance(cfg){
  cfg = cfg || {};
  const b   = Math.max(0.05, +cfg.b   || 1);      // Breite in Lastrichtung
  const LF  = Math.max(0.05, +cfg.LF  || 1);      // Länge quer dazu
  const hF  = Math.max(0.05, +cfg.hF  || 1);      // Blockhöhe
  const ue  = Math.max(0,    +cfg.ue  || 0);      // Überdeckung über OK Block
  const t   = hF + ue;                            // Einbindetiefe UK Block ab GOK
  const hA  = Math.min(t, Math.max(0, +cfg.hA || 0));   // einseitige Aushubtiefe ab GOK
  const hp  = Math.max(0, t - hA);                // Resteinbindung auf der Aushubseite
  const gph = Math.max(1, +cfg.gPhi || 1.2), gc_ = Math.max(1, +cfg.gC || 1.5);
  const gM  = Math.max(1, +cfg.gM   || 1.4);      // Widerstandsbeiwert Baugrund
  const gGs = Math.max(1, +cfg.gGsup|| 1.35);
  const etaP= Math.min(1, Math.max(0.05, cfg.etaP != null ? +cfg.etaP : 0.5));  // Mobilisierung E_p

  // Resultierende UND Schwerpunkt zwischen zwei Tiefen. Der `cz`-Rückgabewert von
  // intEarthPress ist die MITTE des Integrationsbereichs, nicht der Schwerpunkt der
  // Druckfigur — für Hebelarme daher unbrauchbar. Hier wird der Schwerpunkt numerisch
  // aus den Integralwerten gebildet (N Stufen), was Schichtung und Grundwasser mitnimmt.
  const _res = (mode, zTop, zBot, zSurf) => {
    if(zBot <= zTop + 1e-6) return {E:0, cz:(zTop+zBot)/2, arm:0};
    const N = 24, Eat = z => intEarthPress(z, LF, mode, gph, gc_, true, true,
                                           +cfg.dpFac || 0.5, zSurf || 0).E;
    let E=0, M=0, prev = Eat(zTop);
    for(let i=1;i<=N;i++){
      const z  = zTop + (zBot-zTop)*i/N;
      const zm = zTop + (zBot-zTop)*(i-0.5)/N;
      const cur = Eat(z), dE = cur - prev;
      E += dE; M += dE*zm; prev = cur;
    }
    const cz = E > 1e-9 ? M/E : (zTop+zBot)/2;
    return {E:Math.max(0,E), cz, arm:Math.max(0, zBot - cz)};
  };

  // Aktiver Erddruck auf die Rückseite: von OK Block (Tiefe ü) bis UK (Tiefe t)
  const _a  = _res('a', ue, t, 0);
  const Ea_k = _a.E;
  const za   = _a.arm;                              // Hebelarm über UK

  // Passiver Erdwiderstand nur über die Resteinbindung h_p ab der Aushubsohle.
  // zSurf = hA senkt die wirksame Oberfläche ab (gleiche Konvention wie Zustand A).
  const _p   = hp > 1e-6 ? _res('p', hA, t, hA) : {E:0, cz:t, arm:0};
  const Ep_k = _p.E * etaP;
  const zp   = _p.arm;

  const Ea_d = Ea_k * gGs;        // ungünstig
  const Ep_d = Ep_k / gM;         // Widerstand

  const Hd = Math.abs(+cfg.Hd || 0), Md = Math.abs(+cfg.Md || 0);
  const zH = (+cfg.zH != null && +cfg.zH > 0) ? +cfg.zH : (t + Math.max(0, +cfg.hK || 0));
  const Vinf = Math.max(0, +cfg.Vinf || 0), Vsup = Math.max(0, +cfg.Vsup || Vinf);

  const Mt_d = Md + Hd*zH + Ea_d*za;                 // treibend um O
  const Mh_d = Ep_d*zp + Vinf*(b/2);                 // haltend um O (ohne Sicherung)
  const etaM = Mh_d > 1e-9 ? Mt_d / Mh_d : Infinity; // > 1 ⇒ Sicherung erforderlich

  // Erforderliche Rückhaltekraft auf Höhe z_R über UK — zwei unabhängige Bedingungen
  const zR   = Math.max(0.05, +cfg.zR || zH);
  const kapE = Math.min(0.5, Math.max(0.01, +cfg.kappaE || (1/6)));
  const HR_St   = Math.max(0, (Mt_d - Mh_d) / zR);
  const HR_eLim = Math.max(0, (Mt_d - Ep_d*zp - kapE*b*Vinf) / zR);
  const HR_tot  = Math.max(HR_St, HR_eLim);

  // Sohlexzentrizität bei tatsächlich vorhandener Sicherungskraft H_R.
  // M_t,d enthält nur Horizontalkräfte und das aufgebrachte Moment; deren Hebelarme sind
  // vertikale Abstände und damit um Sohlmitte und Fusskante identisch → die Bilanz ist
  // bezugspunktneutral, e folgt direkt aus dem Restmoment geteilt durch die Vertikallast.
  const HR   = Math.max(0, +cfg.HR || 0);
  const Vecc = Math.max(0.1, Vinf);
  const e    = Math.abs(Mt_d - Ep_d*zp - HR*zR) / Vecc;
  const eLim = kapE * b;
  const etaE = e > 1e-9 ? eLim / e : Infinity;       // ≥ 1 ⇒ erfüllt (App-Konvention)

  return { b, LF, hF, ue, t, hA, hp, Ea_k, Ea_d, za, Ep_k, Ep_d, zp, etaP,
           zH, zR, Hd, Md, Vinf, Vsup, Mt_d, Mh_d, etaM,
           HR_St, HR_eLim, HR_tot, HR, e, eLim, kappaE:kapE, etaE,
           // Kapazität in der Konvention des übrigen Kerns (Widerstand/Einwirkung):
           Mu_equiv: Mh_d, Md_equiv: Mt_d, eta_equiv: Mt_d > 1e-9 ? Mh_d/Mt_d : Infinity };
}

function calcPfahlsicherung(){
  // Ergebnis in rechte Sidebar (pfahl-result-panel), nicht mehr im Tab
  const box = document.getElementById('pfahl-result-panel');
  if(!box) return;
  _updateLvModeUI();
  _updateSichSummaries();
  // Nur berechnen wenn Sicherung aktiv
  if(!showPfahl){ box.style.display = 'none'; return; }

  // Eingaben lesen
  const typ     = gi('pfahl_typ') || 'HEB200';
  const n       = +gi('pfahl_anzahl') || 2;
  const L       = +gi('pfahl_l')      || 4.0;
  const s_abst  = +gi('pfahl_s')      || 0.5;
  const e_last  = +(document.getElementById('pfahl_e')?.value ?? '0');
  const d_abst  = +gi('pfahl_abstand')|| 2.0;
  // α aus der Geometrie ableiten — MUSS vor dem Lesen von pfahl_alpha laufen (Aug 2026, Bugfix):
  // α ist ein readonly-Feld, das _updatePfahlGeomHint() aus d/e/h_s/H_Kopf/ü berechnet. Vorher wurde
  // `alpha` VOR diesem Aufruf gelesen → die Berechnung lief mit dem α des VORHERIGEN Renders
  // (verifiziert: Feld 5.7°, verwendet 4.8°). Folge: F_s, V_Pfahl und η_Axial hingen an der
  // Aufrufreihenfolge statt allein an der Geometrie (~2 % Streuung, Ergebnis nicht reproduzierbar).
  _updatePfahlGeomHint();
  const alpha   = (() => { const v = +gi('pfahl_alpha'); return isFinite(v) ? v : 60; })();  // signiert (kann < 0)
  const d_mass  = +gi('pfahl_dm')    || 5;
  const d_krit  = +gi('pfahl_dk')    || 15;
  // h_mess entfernt — mm/m = tan α × 1000 = direkte Neigungsangabe (h_Referenz = 1m)
  // Bodenkennwerte direkt aus Schicht 1 (Eingabe im Boden-Tab)
  const s0      = SCHICHTEN[0] || {};
  const phi_deg = s0.phi    ?? (+gi('bg_phi')    || 30);
  const c_kPa   = s0.c      ?? (+gi('bg_c')      || 0);
  const gamma   = s0.gamma  ?? (+gi('bg_gamma')  || 20);
  const gamma2  = s0.gamma2 ?? (+gi('bg_gamma2') || 10);  // γ' unter GW
  const me      = s0.me     ?? (+gi('bg_me')     || 30);

  // Grundwasser
  const hasGW = gi('bg_gw') === 'ja';
  const z_gw  = hasGW ? Math.max(0, +gi('bg_gwt') || 3.0) : Infinity;

  // Bodenmodell-Typ für Hinweise
  const useClay  = phi_deg <= 5;
  const hasC     = c_kPa > 0.5 && !useClay;  // c' vorhanden, aber im Reibungsboden ignoriert

  // Info-Label aktualisieren
  const soilInfo = document.getElementById('pfahl-soil-info');
  if(soilInfo){
    let info;
    if(SCHICHTEN.length > 1){
      // Mehrschicht: Profil kompakt auflisten (Pfahl rechnet schichtweise)
      let zc = 0;
      const parts = SCHICHTEN.map((s, i) => {
        const top = zc; const bot = s.d === 999 ? '∞' : (zc + s.d).toFixed(1);
        zc += s.d === 999 ? 0 : s.d;
        return `${top.toFixed(1)}–${bot}m: φ=${s.phi}° c=${s.c} γ=${s.gamma}`;
      });
      info = `Boden (${SCHICHTEN.length} Schichten, schichtweise): ` + parts.join(' · ');
    } else {
      info = `Boden (Schicht 1): φ = ${phi_deg}° · c = ${c_kPa} kPa · γ = ${gamma} kN/m³ · M_E = ${me} MN/m²`;
      if(useClay) info += ' · Formel: bindig (c_u, undrainiert)';
      if(hasC)    info += ' · Reibungsboden (φ′ massgebend) — c′ konservativ vernachlässigt';
    }
    if(hasGW)   info += ` · GW=${z_gw.toFixed(1)}m`;
    soilInfo.textContent = info;
  }

  const d_ex     = Math.max(0, +gi('pfahl_dex') || 0);  // Aushubtiefe [m]
  const ex_seite = gi('pfahl_dex_seite') || 'gleis';

  const prof = pfahlSection(typ);
  const B    = prof.b;              // Profilbreite [m]
  const EI   = 210e6 * prof.Iy;    // [kNm²]
  const Mpl  = 355e3 * prof.Wply;  // [kNm]  f_y=355 MPa=355000 kN/m²

  // ── Aushub: Einfluss auf Pfahlberechnung
  // Pfähle stehen IMMER auf der Gegenseite des Aushubs (3D-Viewer: pfahl_sign = [-ex_sign])
  // → unabhängig von Gleis-/Feldseite nie im Aushubbereich, volle Einbindung
  const pfaehle_im_aushub = false;
  const L_emb = L;
  const e_eff = e_last;

  // Info-Meldung
  const dexInfo = document.getElementById('pfahl-dex-info');
  if(dexInfo){
    if(d_ex > 0){
      dexInfo.style.display='';
      dexInfo.textContent = `Aushub ${d_ex.toFixed(1)} m (${ex_seite==='gleis'?'Gleisseite':'Feldseite'}) — Pfähle auf Gegenseite, vollständig im gewachsenen Boden (L_emb = ${L.toFixed(1)} m)`;
    } else {
      dexInfo.style.display='none';
    }
  }

  // Profilinfo aktualisieren
  const eiEl = document.getElementById('pfahl-ei-row');
  if(eiEl) eiEl.textContent =
    `EI = ${(EI/1000).toFixed(0)} MNm²  ·  ${prof.round?'Ø':'B'} = ${(B*100).toFixed(0)} cm  ·  W_pl = ${(prof.Wply*1e6).toFixed(0)} cm³`;

  // H_d, M_d und Block-GZT aus letztem Berechnungsergebnis (massgebender LF nach H)
  let H_d_bemessung = 0, M_d_bemessung = 0, lfName = '—';
  let Mu_block = 0, etaGZT_block = Infinity, Md_Hst_block = 0;
  let worst = null;
  if(RESULT.block && RESULT.block.results.length){
    worst = RESULT.block.results.reduce((a,b) =>
      Math.max(Math.abs(b.Hxd), Math.abs(b.Hyd)) > Math.max(Math.abs(a.Hxd), Math.abs(a.Hyd)) ? b : a
    );
    H_d_bemessung = Math.max(Math.abs(worst.Hxd), Math.abs(worst.Hyd));
    // Achsen-Crossover (wie M_ok_x): Quer-Richtung (Hx) wirkt mit den Momenten
    // um die y-Achse (MGy/MWy) — die liegen in Md_ext_y. Längs entsprechend Md_ext_x.
    M_d_bemessung = Math.abs(worst.Hxd) >= Math.abs(worst.Hyd)
      ? Math.abs(worst.Md_ext_y ?? worst.Myd ?? 0)
      : Math.abs(worst.Md_ext_x ?? worst.Mxd ?? 0);
    lfName = worst.name || 'LF';
    // GZT Block (Steckner)
    Mu_block      = worst.Mu_GZT  ?? 0;
    etaGZT_block  = isFinite(worst.etaGZT) ? worst.etaGZT : Infinity;
    Md_Hst_block  = etaGZT_block > 0 && isFinite(etaGZT_block)
      ? Mu_block / etaGZT_block : 0;
  }
  // Zustand A (Aushub ohne Massnahme) aus dem Block-GZT
  const Mu_block_ex  = worst ? (worst.Mu_GZT_ex || 0) : 0;
  const etaGZT_ex    = worst && isFinite(worst.etaGZT_ex) ? worst.etaGZT_ex : Infinity;
  const etaGZG_block = worst && isFinite(worst.etaGZG)    ? worst.etaGZG    : Infinity;
  const etaGZG_ex    = worst && isFinite(worst.etaGZG_ex) ? worst.etaGZG_ex : Infinity;
  const komb_ex      = worst ? (worst.komb_GZT_ex || 0) : 0;
  const dEx_side     = worst ? (worst.dEx_side || '') : '';
  const dEx_gov      = worst ? (worst.dEx_gov || 0) : 0;
  const hasExState   = d_ex > 0.01 && worst && (worst.dEx_used || 0) > 0.01;
  // Steckner-Mechanismus im Aushubzustand degeneriert (NL in Sohle, Kapazitätskurve kehrt um) →
  // M_u,ex ist KEINE gültige Kapazität mehr, sondern der eingefrorene Wert einer flacheren Grube.
  const dEx_degen    = hasExState && worst ? !!worst.dEx_degen : false;

  // ── Richtungsfall Stütze (gleiche dirX-Konvention wie Zustand A):
  // Pfähle stehen gegenüber dem Aushub. Moment ZUM Aushub → Blockkopf bewegt sich
  // vom Pfahl weg → Stütze auf ZUG, Pfahl drückt Boden zum Block hin.
  const exSign_p = ex_seite === 'gleis' ? -1 : 1;
  const quer_gov = worst ? Math.abs(worst.Hxd) >= Math.abs(worst.Hyd) : true;
  let fall_zug = false;
  if(worst && quer_gov){
    // Bewegungsrichtung aus dem signierten Kippmoment der massgebenden Kombination (konsistent zum
    // Zustand-A-Loop). Fallback auf H, falls das Feld fehlt (Altprojekte/Modellwechsel).
    const _mokS = worst.M_ok_x_signed;
    const _dirX = ((isFinite(_mokS) && _mokS !== 0) ? _mokS
                  : (worst.Hxd !== 0 ? worst.Hxd : (worst.Md_ext_y ?? 0))) >= 0 ? 1 : -1;
    fall_zug = _dirX === exSign_p;
  }
  const zugfest     = (gi('pfahl_zugfest') || 'ja') !== 'nein';
  const pile_active = !(fall_zug && !zugfest);   // Druckstrebe trägt im Zugfall nicht
  window._pfahlZug  = fall_zug;                  // Keilrichtung im 3D-Viewer

  // Geometrie Block (für arm_stuetze, Lastverteilung und Ep-Verlust)
  const G_bx   = Math.max(0.5, +gi('g_bx')     || 1.0);  // Blockbreite [m]
  const G_hb_b = Math.max(0.1, +gi('g_hblock') || 2.0);  // Blockhöhe [m]
  const G_ue_b = Math.max(0,   +gi('g_uberd')  || 0  );  // Überdeckung ü [m]
  const G_hk_b = Math.max(0,   +gi('g_hkopf') || 0  );  // Kopfhöhe gesamt (ab OK Block) [m]
  const hs_ans = +(document.getElementById('pfahl_hs')?.value ?? '0'); // Anschlusshöhe [m]
  const alpha_rad   = alpha * Math.PI / 180;
  // H_Kopf ist die Gesamthöhe ab OK Block ⇒ Sohle → OK Kopf = H_Block + H_Kopf (kein +ü mehr)
  const arm_stuetze = Math.max(0.5, G_hb_b + G_hk_b + hs_ans); // [m] ab Sohle
  const t_bl   = G_hb_b + G_ue_b;  // effektive Einbindetiefe Block [m]
  const phi_r_b  = phi_deg * Math.PI / 180;
  const Kp_bl    = Math.tan(Math.PI/4 + phi_r_b/2)**2;  // Kp am Block (ohne δ, konservativ)

  // ── A) k_s Lateral-Korrekturfaktor
  // Laterale Bettungssteifigkeit ≈ 20–40% der vertikalen (Oedometer → M_E).
  // α_lat Standard 0.30; einstellbar via SETTINGS.pfahlAlphaLat
  const alpha_lat  = Math.min(1.0, Math.max(0.1, +(SETTINGS.pfahlAlphaLat ?? 0.30)));
  const nu         = 0.3;
  // Mehrschicht: M_E schichtdickengewichtet über die Einbindelänge (1 Schicht → me)
  const multiLayer = SCHICHTEN.length > 1;
  let me_eff = me;
  if(multiLayer){
    let zz = 0, sumM = 0, tt = 0;
    for(const s of SCHICHTEN){
      const th = Math.min(s.d === 999 ? Math.max(0, L_emb - zz) : s.d, Math.max(0, L_emb - zz));
      if(th <= 0) break;
      sumM += Math.max(0.5, s.me ?? me) * th; tt += th;
      zz   += s.d === 999 ? th : s.d;
      if(zz >= L_emb) break;
    }
    if(tt > 0.01) me_eff = sumM / tt;
  }
  const k_s_vert   = me_eff * 1000 / ((1 - nu**2) * B);   // vertikal [kN/m³]
  const k_s        = k_s_vert * alpha_lat;                 // lateral  [kN/m³]

  // Charakteristische Länge
  const lam  = Math.pow(k_s * B / (4 * EI), 0.25);
  const aL   = lam * L_emb;
  const pfahlTypLabel = aL < 1.5 ? 'kurzer Pfahl' : aL < 2.5 ? 'mittellanger Pfahl' : 'langer Pfahl';

  // Gruppeneffekt (Pfahl↔Pfahl, abstandsabhängig)
  const sB   = s_abst / B;
  const f_gr = latGroupFactor(sB);   // gemeinsame p-Multiplier-Kurve (auch im Pfahlfundament-Modul)

  // ── Wirkungsschatten Block → Pfahl (Rankine-Keil, tiefengestaffelt, GRUNDRISS-bewusst)
  // Blockkeil von der Sohlenvorderkante (Tiefe t_bl) unter 45°−φ/2 zur Oberfläche.
  // Die Pfähle stehen im Grundriss seitlich versetzt (z = ±s/2 bzw. ±s) — massgebend ist
  // der EBENE Abstand d_eff zur Blockfront (Breite b_y), abzüglich der seitlichen
  // Keilausbreitung im Grundriss (Winkel ≈ φ/2, Ingenieurnäherung analog b_id-Spreizung).
  const tanW      = Math.tan(Math.PI/4 + phi_r_b/2);
  const d_abst_m  = d_abst;
  const d_krit_ov = t_bl * tanW;                                  // Keil-Reichweite an GOK [m]
  const by_blk    = Math.max(0.5, +gi('g_by') || 1.0);
  const zOffs     = n === 1 ? [0] : n === 2 ? [-s_abst/2, s_abst/2] : [-s_abst, 0, s_abst];
  const spreadT   = Math.tan(phi_r_b / 2);                        // seitliche Keilspreizung [−]
  // Schattentiefe aus x-Abstand (Schnitt) — gilt nur, wenn der Pfahl im Grundriss
  // innerhalb der Keilkante liegt; Übergang linear über die Pfahlbreite B.
  // Druckfall: Block-PASSIVKEIL (flach, Reichweite t·tanW). Zugfall: Pfahl widersteht
  // zum Block hin — Interferenz nur mit der AKTIV entspannten Zone (steil, t/tanW).
  const zov_geo   = fall_zug
    ? Math.min(L_emb, Math.max(0, t_bl - d_abst_m * tanW))
    : Math.min(L_emb, Math.max(0, t_bl - d_abst_m / tanW));
  const f_geo     = bromsShadowFactor(phi_deg, c_kPa, gamma, gamma2, z_gw, L_emb, B, zov_geo, e_eff);
  let _fshSum = 0, z_ov = 0;
  const pileShadow = zOffs.map(zp => {
    const e_lat = Math.max(0, Math.abs(zp) - by_blk/2);           // seitl. Überstand über Block
    const w_lat = d_abst_m * spreadT;                             // Keilkante am Pfahlabstand
    const over  = e_lat - w_lat;
    const latFac = over <= 0 ? 1 : over >= B ? 0 : 1 - over / B;  // Rampe über Pfahlbreite
    const f_i   = 1 - (1 - f_geo) * latFac;                       // ausserhalb Keil → f=1
    const zov_i = latFac > 0.05 ? zov_geo : 0;
    _fshSum += f_i; z_ov = Math.max(z_ov, zov_i);
    return {zp, e_lat, w_lat, latFac, zov_i, f_i};
  });
  const f_shadow  = _fshSum / Math.max(1, zOffs.length);          // Mittel über die Pfähle
  // Kompatibilität Diagramme: f_overlap = f_shadow
  const f_overlap = f_shadow;
  const r_overlap = z_ov > 0.01 ? z_ov / Math.max(0.1, t_bl) : 0;

  // ── p-y-Pfahl: laterale Bettungsziffer je Tiefe (schichtweise, M_E·α_lat)
  const ksAt = z => {
    const meZ = multiLayer ? Math.max(0.5, schichtAtDepth(Math.max(0, z)).me ?? me) : me_eff;
    return meZ * 1000 / ((1 - nu**2) * B) * alpha_lat;               // [kN/m³]
  };
  // Einheitslast-FE-Solve (linear → mit tatsächlicher Last skalierbar): Kopf-/GOK-
  // Verschiebung [mm/kN] und max. Biegemoment [kNm/kN]. Fallback Winkler-Closed-Form.
  const py1 = bddBeamPY(EI, B, e_eff, L_emb, 1, ksAt);
  const yHead1 = py1 ? py1.yHead_mm : winklerDeflection(1, e_eff, L_emb, EI, k_s, B);
  const Mmax1  = py1 ? py1.Mmax_kNm : (e_eff + 0.4 * L_emb);          // [kNm pro kN]
  // ── Gestossene Pfähle (Krinner): Stoss = Gelenk (nur N+V, nicht biegesteif) → das Biegemoment
  //    baut sich nur über das LÄNGSTE Einzelelement (~2 m) auf (M=0 am Stoss). Für den Stahl-N+M-
  //    Nachweis die Biegelänge darauf begrenzen; laterale Bettung/Grenzlast + Verformung (η_H/η_V)
  //    laufen weiter über die volle Einbindelänge L_emb (die Gelenke reduzieren den Bodenwiderstand nicht).
  const LbendMax_p = prof.round ? 2.0 : 0;                            // Krinner rund → Elementlänge; HEB = voll
  const Lbend_p    = LbendMax_p > 0 ? Math.min(L_emb, LbendMax_p) : L_emb;
  const spliced_p  = Lbend_p < L_emb - 1e-6;
  const Mmax1b     = spliced_p ? ((bddBeamPY(EI, B, e_eff, Lbend_p, 1, ksAt)||{}).Mmax_kNm || Mmax1) : Mmax1;

  // ── Steifigkeitsbasierte Lastverteilung Block ↔ Pfahlsystem (Serienfedern)
  // Pfahlkopf-Horizontalfeder (n Pfähle, Gruppenabminderung wie Verformung)
  const _d1mm   = yHead1;                                             // [mm] bei H = 1 kN (p-y)
  const k_pf    = n * f_gr * 1000 / Math.max(0.01, _d1mm);            // [kN/m]
  // Richtstütze axial als Horizontalfeder (Rohr 60×4, E = 210 GPa)
  const A_st    = 7.04e-4;                                            // [m²]
  const L_st    = Math.max(0.5, d_abst_m / Math.max(0.2, Math.cos(alpha_rad)));
  const k_st_h  = (210e6 * A_st / L_st) * Math.cos(alpha_rad)**2;     // [kN/m]
  const k_sys_h = 1 / (1/Math.max(1, k_pf) + 1/Math.max(1, k_st_h));  // Serie
  const K_pfahl_rot = k_sys_h * arm_stuetze**2;                       // [kNm/rad]
  // Block-Drehfeder aus Steckner-GZG-Anfangssteifigkeit (Gl.13 + Gl.16): M(α)/α
  // Im Aushubzustand (Stirnseite) mit D_eff = t − d_ex
  const C1_blk = Math.max(0.1, +gi('bg_c1') || 50) * 1000;            // [kN/m³]
  const exPas_lv = hasExState && dEx_side === 'passiv';
  const D_lv   = Math.max(0.1, exPas_lv ? t_bl - d_ex : t_bl);
  const A_blk  = Math.max(0.5, +gi('g_by') || 1.0);
  const K_block_rot = (1/12)*G_bx*D_lv**3*C1_blk + (1/12)*G_bx*A_blk**3*C1_blk; // [kNm/rad]
  const f_auto = K_pfahl_rot / Math.max(1, K_block_rot + K_pfahl_rot);

  // f_eff: auto (Steifigkeitsverteilung) oder manuell (pfahl_laf)
  const lv_auto = (gi('pfahl_lv_mode') || 'auto') !== 'manuell';
  const f_man   = Math.min(1.0, Math.max(0.05, +(document.getElementById('pfahl_laf')?.value ?? '1.0')));
  const f_eff   = lv_auto ? Math.min(1.0, Math.max(0.05, f_auto)) : f_man;
  const H_d   = H_d_bemessung * f_eff;
  const M_d   = M_d_bemessung * f_eff;

  // Kräfte am Pfahlkopf — Moment-Anteil via Richtstütze.
  // Freikörper (VERTIKALER Pfahl, geneigte Stütze, Winkel α von Horizontale):
  //   Die Stütze muss horizontal H_eff liefern → Stabkraft F_s = H_eff / cos α.
  //   Am Pfahlkopf zerlegt sich F_s in: Horizontal F_s·cos α = H_eff  (Broms-Lateral, ⊥ vert. Pfahl)
  //                                     Vertikal   F_s·sin α = H_eff·tan α  (axial, Mantelreibung).
  // FRÜHER: H_pfahl_d = H_eff·cos α — zusätzliches cos α war falsch (Lateral um cos α
  //   unterschätzt, unkonservativ; bei steiler Stütze gravierend). Korrigiert Jun 2026.
  const H_eff       = H_d + M_d / arm_stuetze;
  const H_pfahl_d   = H_eff;                         // Horizontallast am vertikalen Pfahl (Broms)
  const F_s         = H_eff / Math.max(0.01, Math.abs(Math.cos(alpha_rad)));  // Stützenstabkraft (axial)
  const V_pfahl     = H_eff * Math.abs(Math.tan(alpha_rad));  // |Vertikalkomponente| → axiale Pfahllast
  // Knicknachweis Richtstütze über Datenblatt-Grenzwert (Systemanbieter). Nur wenn die Stütze
  // auf DRUCK steht (kein Zugfall) — Zugstab knickt nicht. N_b,Rd = Bemessungs-Knickwiderstand.
  const N_bRd_stab     = +gi('pfahl_stab_nrd') || 0;
  const eta_knick_stab = (N_bRd_stab > 0 && !fall_zug && F_s > 0.05) ? N_bRd_stab / F_s : Infinity;
  // Axialrichtung: Herausziehen iff (Stütze Zug & Anschluss höher) oder (Druck & Pfahlkopf höher).
  // α-Vorzeichen = sign(h_anschluss − e): α>0 Anschluss höher · α<0 Pfahlkopf höher.
  const axial_pullout = fall_zug ? (alpha_rad > 0) : (alpha_rad < 0);

  // ── Ep-Verlust durch Aushub (Anzeige; als Einwirkung nur im MANUELLEN Modus —
  //    im Auto-Modus steckt der Verlust rigoros in Mu_ex und D_eff der Verteilung)
  const z_top_ep = G_ue_b;
  const z_bot_ep = Math.min(d_ex, t_bl);
  const h_ep_los = Math.max(0, z_bot_ep - z_top_ep);
  let Ep_lost = 0, dH_ep = 0, arm_Ep_sohle = 0, arm_st_sohle = 0;
  if(h_ep_los > 0.01){
    const p_top = Kp_bl * gamma * z_top_ep * G_bx;   // [kN/m] Druck oben × Breite
    const p_bot = Kp_bl * gamma * z_bot_ep * G_bx;   // [kN/m] Druck unten × Breite
    Ep_lost = 0.5 * (p_top + p_bot) * h_ep_los;      // [kN] Trapezintegral
    const cz_ep = z_top_ep + h_ep_los/3 * (2*p_bot + p_top) / Math.max(0.001, p_bot + p_top);
    arm_Ep_sohle = t_bl - cz_ep;                     // [m] Hebelarm Ep-Schwerpunkt → Sohle
    arm_st_sohle = arm_stuetze;                      // [m] Sohle → Anschluss = H_Block + H_Kopf + h_s
    dH_ep = (Ep_lost * arm_Ep_sohle) / Math.max(0.5, arm_st_sohle);  // [kN]
  }
  const dH_ep_eff = lv_auto ? 0 : dH_ep;

  // Massgebende Gesamtlast am Pfahlkopf
  const H_pfahl_total = H_pfahl_d + dH_ep_eff;

  // ── Böschung: Pfahl widersteht in eine abfallende Böschung? → passiver Beiwert reduziert.
  // Geometrie: Böschung liegt im Viewer immer auf +x (Feldseite); Pfähle stehen gegenüber
  // dem Aushub. Talseitig (ungünstig) nur, wenn die Pfähle auf der Böschungsseite stehen
  // (Aushub gleisseitig → Pfähle +x) UND die Böschung dort ABFÄLLT (β < 0). Bergauf (β > 0)
  // ist günstig → konservativ ignoriert. Aushub feldseitig → Pfähle auf −x, keine Böschung.
  const _slBeta  = +gi('bg_beta') || 0;
  const _slBtyp  = gi('bg_btyp') || 'none';
  const betaRed  = (_slBtyp !== 'none' && ex_seite === 'gleis' && _slBeta < -0.1)
                 ? Math.abs(_slBeta) : 0;
  const kp_full  = Math.tan(Math.PI/4 + phi_r_b/2)**2;
  const kp_eff   = betaRed > 0.1 ? kpSlopeRankine(phi_deg, betaRed) : kp_full;

  // ── Aushub-Begrenzung des Pfahl-Bruchkörpers (NUR Zugfall):
  // Im Zugfall mobilisiert der Pfahl seinen passiven Keil zum Block/Aushub hin. Reicht der
  // Keil über die Aushubkante (Horizontaldistanz Pfahl → Aushubkante = G_bx + d_abst),
  // daylightet er in die Grube → wirksame Überdeckung dort reduziert. Block-Abschirmung
  // konservativ vernachlässigt. Druckfall: Keil zeigt vom Aushub weg → keine Begrenzung.
  const L_horiz_ex = G_bx + d_abst;
  const exClip = (fall_zug && d_ex > 0.01)
               ? {dEx: Math.min(d_ex, 0.95 * L_emb), Lhor: L_horiz_ex} : null;

  // ── B) Widerstandsteilsicherheit γ_R (SIA 267 §14, Pfahlwiderstände)
  const gamma_R  = Math.max(1.0, +(SETTINGS.pfahlGammaR ?? 1.40));

  // ── p-y-Grenzwert der Bettungsreaktion p_u(z) [kN/m] — Reibungsboden 3·Kp·σ'v·B
  //    (schichtweise, GW-wirksam, Böschung über betaRed), bindig 9·c_u·B (z > 1.5B).
  //    Identische Hüllkurve für p-y-Antwort UND Grenzlast → konsistent.
  const puAt = z => {
    const s = schichtAtDepth(Math.max(0, z)), ph = s.phi ?? phi_deg;
    if(ph <= 5) return z > 1.5*B ? 9 * Math.max(0, s.c ?? 0) * B : 0;
    const Kp_i = betaRed > 0.1 ? kpSlopeRankine(ph, betaRed) : Math.tan(Math.PI/4 + ph*Math.PI/360)**2;
    return 3 * Kp_i * sigVeffTo(z) * B;
  };
  // Aushub-Begrenzung (Zugfall): p_u über die Aushubkante reduziert (Keil daylightet)
  const puAtEx = exClip ? (z => {
    const tanW = Math.tan(Math.PI/4 + phi_r_b/2), xd = z * tanW;
    const frac = Math.max(0, xd - Math.max(0.01, exClip.Lhor)) / Math.max(0.01, xd);
    const z_eff = Math.max(0.05*z, z - exClip.dEx * frac);
    return puAt(z) * z_eff / Math.max(1e-6, z);
  }) : puAt;

  // ── Laterale Grenzlast aus dem p-y-Modell: inkrementeller Push (Tangenten-Kollaps),
  //    gebracketed durch das plastische Grenzgleichgewicht (Rotationspunkt). Fallback:
  //    Grenzgleichgewicht, dann alte Broms-Formel. Ersetzt die simplifizierte Broms-
  //    Momentenformel (die den kurzen Pfahl überschätzte).
  const bromsFallback = clip => multiLayer
    ? bromsLayered(L_emb, B, e_eff, betaRed, clip)
    : bromsFreeShort(phi_deg, c_kPa, gamma, L_emb, B, e_eff, gamma2, z_gw, betaRed, clip);
  const latCap = (pu, clip) => {
    const le = pileLatCapLimitEq(L_emb, B, e_eff, pu);
    if(!(le > 0)) return bromsFallback(clip);
    return pileLatCapPush(EI, B, e_eff, L_emb, ksAt, pu, le) || le;
  };
  const Hcap_full = latCap(puAt, null);
  const Hcap      = exClip ? latCap(puAtEx, exClip) : Hcap_full;
  const Hu_1k_full = Hcap_full * f_shadow;          // ohne Aushub-Clip (Referenz)
  const Hu_1k    = Hcap      * f_shadow;            // schattenreduziert (+ Böschung + Aushub-Clip)
  const exClipRed = (exClip && Hu_1k_full > 0.01) ? (1 - Hu_1k / Hu_1k_full) : 0;
  const Hu_1     = Hu_1k / gamma_R;                 // Bemessungswert

  // Nichtlinearer p-y-Service-Solve bei der tatsächlichen Last/Pfahl (Reaktion auf p_u gedeckelt).
  // KONVERGENZ-BEDEUTUNG (Jul 2026, verifiziert): Nicht-Konvergenz tritt GENAU im Grenzlastband auf
  // (L=1.0 m, H_u,k=5.76 kN → keine Konvergenz für H=5.5…6.45 kN; darunter y=4.3 mm, darüber 47.5 mm).
  // Der frühere lineare Ersatzwert lieferte dort 0.98 mm statt real ≫47 mm (~50× unkonservativ) und
  // meldete η_V „erfüllt", obwohl η_H<1 → die nicht monotonen, unschlüssigen Erfüllungsgrade.
  // Nach Reese/Matlock (API RP-2A) wächst die p-y-Verformung beim Erreichen der Grenzlast über alle
  // Grenzen — eine linear gerechnete Verformung ist dort bedeutungslos. Jetzt: divergiert der Solve,
  // gelten Verformung/Moment als nicht nachweisbar (η = 0, nicht erfüllt).
  // Ein STRUKTURELLER Solver-Ausfall (Rückgabe null) behält den linearen Ersatzwert (Robustheit).
  const H_per  = H_pfahl_total / n;
  const pyNL   = bddBeamPY(EI, B, e_eff, L_emb, H_per, ksAt, {puAt});
  const pyUse  = (pyNL && pyNL.converged) ? pyNL : null;
  const pyDiverged = !!(pyNL && pyNL.converged === false);   // im/über dem Grenzlastbereich
  // Max. Bettungs-Ausnutzung p/p_u im Pfahl (für die p-y-Kennlinien-Skizze)
  let pyMob = 0.5;
  if(pyUse){ pyMob = 0; for(const pt of pyUse.profile){ if(pt.z>0){ const pu=puAt(pt.z); if(pu>0.1) pyMob=Math.max(pyMob, Math.abs(pt.p)/pu); } } }
  else if(pyDiverged) pyMob = 1;                              // Bettung voll ausgeschöpft

  // Stahlnachweis pro Pfahl: M_max aus der nichtlinearen p-y-Biegelinie.
  // Gestossen (Krinner): Biegemoment über die begrenzte Biegelänge Lbend_p (Stoss = Gelenk).
  const pyNLb     = spliced_p ? bddBeamPY(EI, B, e_eff, Lbend_p, H_per, ksAt, {puAt}) : pyNL;
  const pyBUse    = (pyNLb && pyNLb.converged) ? pyNLb : (spliced_p ? null : pyUse);
  const pyBDiverg = spliced_p ? !!(pyNLb && pyNLb.converged === false) : pyDiverged;
  const M_max_1   = pyBUse ? pyBUse.Mmax_kNm : (pyBDiverg ? Infinity : Mmax1b * H_per);
  // Querschnittsnachweis mit N+M-INTERAKTION (SIA 263). Der Pfahl trägt über die Richtstütze auch
  // AXIAL (N = H_eff·|tan α| / n) — vorher war der Nachweis reine Biegung (η = M_pl/M_max), also
  // unkonservativ; spürbar bei steiler Stütze + kleinem Profil. Das Pfahlfundament-Modul rechnet die
  // Interaktion seit je (|N|/R_t,d + |M|/M_Rd) → jetzt konsistent (Aug 2026).
  // WIDERSTANDSBASIS (Aug 2026): Querschnittswiderstand jetzt als BEMESSUNGSWERT mit γ_M nach
  // SIA 263 (γ_M0 = 1.05 für den Querschnittsnachweis von Baustahl; überschreibbar via
  // SETTINGS.sichGammaM). Vorher war f_yk = 355 N/mm² ungeteilt angesetzt — im GZT inkonsistent,
  // da die Einwirkungsseite mit γ_G/γ_Q bemessen ist. Wirkt auf BEIDE Interaktionsterme.
  // Divergiert der p-y-Solve, ist M_max_1 = Infinity ⇒ util = Infinity ⇒ η = 0 (nicht erfüllt).
  const gamma_M   = Math.max(1.0, +(SETTINGS.sichGammaM ?? 1.05));
  const N_pl      = 355e3 * (prof.A || 0) / gamma_M;    // [kN] N_pl,Rd Querschnitt
  const M_pl_Rd   = Mpl / gamma_M;                      // [kNm] M_pl,Rd
  const N_ax_1    = Math.abs(V_pfahl) / n;              // [kN] Axialkraft je Pfahl (Zug ODER Druck)
  const utilN     = N_pl > 0.01 ? N_ax_1 / N_pl : 0;
  const utilM     = Math.abs(M_max_1) / Math.max(0.001, M_pl_Rd);
  const utilSt    = utilN + utilM;
  const etaStahl  = utilSt > 1e-9 ? 1 / utilSt : Infinity;

  const Hu_gruppe = n * Hu_1 * f_gr;

  // ── C) Gesamtnachweis Tragfähigkeit
  const eta_H = H_pfahl_total > 0.01 ? Hu_gruppe / H_pfahl_total : Infinity;

  // Verformung — Kopfverschiebung aus der nichtlinearen p-y-Biegelinie. Divergenz = Grenzlastbereich
  // → unbeschränkte Verformung, KEIN linearer Ersatzwert (s. Kommentar beim Service-Solve oben).
  const delta_1_mm = pyUse ? pyUse.yHead_mm : (pyDiverged ? Infinity : yHead1 * H_per);
  const delta_gruppe_mm = delta_1_mm * (1 / f_gr);       // Gruppe verformt sich mehr
  // Verkippung θ: die Pfahlkopfverschiebung δ wird über die (axial steife) Richtstütze auf den
  // Blockanschluss übertragen; der Block dreht um seine Sohle ⇒ θ = δ / arm_stuetze [mm/m].
  // FRÜHER: neig_mm_m = delta_gruppe_mm, also h_Ref = 1 m fix („tan α × 1000") — die Eingabefelder
  // heissen aber „Schiefstellung [mm/m]" ⇒ Label und Rechnung widersprachen sich und die Verkippung
  // wurde um den Faktor arm_stuetze (typ. 3–4) ÜBERSCHÄTZT (η_V entsprechend zu klein).
  const h_ref_tilt = Math.max(0.5, arm_stuetze);          // [m] Sohle → Anschluss Richtstütze
  const neig_mm_m  = delta_gruppe_mm / h_ref_tilt;        // [mm/m] echte Schiefstellung
  const eta_V = d_krit / Math.max(0.001, neig_mm_m);

  // ── Axialer Pfahlnachweis: V = H_eff·tan(α) drückt den Pfahl (Mantelreibung HEB-Kasten)
  const V_1     = V_pfahl / n;
  const U_box   = 2 * (prof.h + prof.b);                    // Kastenumfang [m]
  // Mantelreibung schichtweise: ∫ K₀(z)·σ'v(z)·tan(2/3·φ(z))·U_box dz (Spitze vernachlässigt).
  // 1 Schicht: identisch zu K₀·avgSigV·tan(2/3φ)·U·L (avgSigV = mittlere σ'v).
  let R_ax_k = 0;
  { const Na = 40, dza = L_emb / Na;
    for(let i = 0; i < Na; i++){
      const z  = (i + 0.5) * dza;
      const ph = (schichtAtDepth(z).phi ?? phi_deg) * Math.PI/180;
      R_ax_k  += (1 - Math.sin(ph)) * sigVeffTo(z) * Math.tan((2/3)*ph) * U_box * dza;
    }
  }
  const R_ax_d  = R_ax_k / gamma_R;
  const eta_ax  = V_1 > 0.05 ? R_ax_d / V_1 : Infinity;

  // ── Systemnachweis Block + Pfahl (GZT) — Blockkapazität im AUSHUBZUSTAND,
  //    Pfahlbeitrag kapazitätsgedeckelt, volle Bemessungslast im Nenner
  // Bei degeneriertem Mechanismus wird dem Block KEINE Restkapazität gutgeschrieben (Aug 2026):
  // M_u,ex ist dort der eingefrorene Wert einer viel flacheren Grube (verifiziert: d_ex = 3.00 m von
  // t = 3.10 m liefert die Kapazität einer 0.75-m-Grube). Eine nicht berechenbare Kapazität darf im
  // Systemnachweis nicht angerechnet werden → das System trägt allein über die Pfähle.
  const H_pf_full  = (H_d_bemessung + M_d_bemessung / arm_stuetze) * Math.cos(alpha_rad);
  const M_pile_cap = pile_active ? Math.min(H_pf_full, Hu_gruppe) * arm_stuetze : 0;

  // ── Zweitmodell: Starrkörperbilanz um die Fusskante (immer mitgerechnet) ──────────
  // Liefert (a) eine Kapazität, die auch bei degeneriertem Gl.66-Mechanismus gültig bleibt
  // und (b) die Sohlexzentrizität für den Kernweite-Nachweis. Siehe rigidBlockBalance().
  const _gGinf_s = Math.max(0, +gi('lw_G_inf') || 0.80);
  // Bauzustand (Option): reduzierter ständiger Lastbeiwert für die Sicherungsbemessung.
  // Wirkt auf die treibende Seite der Starrkörperbilanz und auf V_d,sup; die Endzustand-
  // Nachweise oben bleiben unberührt. Option aus ⇒ _gGsup_s === γ_G,sup wie bisher.
  const _gGsupFull = Math.max(1, +gi('lw_G') || 1.35);
  const _gGsup_s = _bzGred(_gGsupFull);
  const bzAktiv  = Math.abs(_gGsup_s - _gGsupFull) > 1e-9;
  const bzBlockiert = _bzGredBlocked();
  const _gBet_s  = Math.max(1, +gi('g_gbeton') || 25);
  const _NG_s    = Math.max(0, +gi('l_NG')     || 0);
  // Eigengewicht wie im Hauptkern: Block immer, Kopf nur wenn eingerechnet
  const _kopfIn  = document.getElementById('kopf_in_gk')?.checked !== false;
  const _Gblk    = G_bx * by_blk * G_hb_b * _gBet_s
                 + (_kopfIn ? Math.max(0,+gi('g_kx')||0) * Math.max(0,+gi('g_ky')||0)
                              * (G_hk_b + G_ue_b) * _gBet_s : 0);
  const _HR_vorh = arm_stuetze > 0.05 ? M_pile_cap / arm_stuetze : 0;   // vorhandene Rückhaltekraft
  const rb = rigidBlockBalance({
    b: G_bx, LF: by_blk, hF: G_hb_b, ue: G_ue_b, hK: G_hk_b, hA: d_ex,
    Hd: H_d_bemessung, Md: M_d_bemessung,
    zH: G_hb_b + G_ue_b + G_hk_b, zR: arm_stuetze, HR: _HR_vorh,
    Vinf: _gGinf_s * (_NG_s + _Gblk), Vsup: _gGsup_s * (_NG_s + _Gblk),
    gPhi: +gi('tw_phi') || 1.2, gC: +gi('tw_c') || 1.5,
    gM: +gi('tw_Ep') || 1.4, gGsup: _gGsup_s,
    dpFac: +gi('bg_delta_fac') || 0.5,
    kappaE: SETTINGS.kappaE ?? (1/6)
  });
  // E1 — Kernweite-Nachweis: nur im Aushubzustand geführt. Beim voll eingebundenen Block
  // deckt Steckner Gl.66 die Standsicherheit ab und der Sohldruck ist dort bewusst nur
  // informativ; freigelegt trägt dieses Argument nicht mehr.
  const eccActive = hasExState;
  const eta_ecc   = eccActive ? rb.etaE : Infinity;

  // E2 — bei degeneriertem Gl.66-Mechanismus tritt die Starrkörperbilanz an seine Stelle,
  // statt dem Block gar keine Kapazität zuzugestehen. Der Wechsel wird im Panel ausgewiesen.
  const sysErsatz  = hasExState && dEx_degen && rb.Mu_equiv > 0.01;
  const Mu_sys     = hasExState ? (dEx_degen ? (sysErsatz ? rb.Mu_equiv : 0) : Mu_block_ex)
                                : Mu_block;
  const eta_sys = (isFinite(etaGZT_block) && Md_Hst_block >= 0.1)
    ? (Mu_sys + M_pile_cap) / Math.max(0.1, Md_Hst_block)
    : Infinity;

  // ── System-GZG: Schiefstellung Block + Pfahl als Parallelfedern (Drehfedern)
  const M_ok_char_g = worst ? (worst.M_ok_char_GZG || 0) : 0;
  const alpha_sys   = M_ok_char_g > 0.01
    ? M_ok_char_g / Math.max(1, K_block_rot + (pile_active ? K_pfahl_rot : 0)) : 0;
  const neig_sys_mm = alpha_sys * 1000;                     // [mm/m]
  const tanZulS     = _tanZul(_gzgFac('lw_G_gzg', 1.00) > 0.001);   // wie Block-GZG
  const eta_GZG_sys = alpha_sys > 1e-9 ? tanZulS / alpha_sys : Infinity;

  // ── Globale Böschungsstandsicherheit (Bishop) hier ENTFERNT (Jul 2026, Nutzerentscheid):
  // Das Lamellenverfahren setzt Bodenscheiben voraus. Beim eingespannten Blockfundament schneidet
  // der kritische Gleitkreis regelmässig den Betonblock → Modell nicht gültig, Ergebnis irreführend.
  // Die Stabilität des Blocks gegenüber der Böschung deckt der Steckner-GZT (mobilisierter
  // Erdwiderstand, Gl.66) ab; die Böschung geht dort über Kp,β/C₁ ein.
  const bishopRes = null;
  // ── D) Massgebende Gesamtsicherheit (Minimum aller Nachweise)
  // GZG System (Schiefstellung Block+Pfahl) gehört in die massgebende Gesamtsicherheit — sonst kann
  // eine verletzte Schiefstellung nie „MASSGEBEND" werden und schlägt nicht auf den Status durch
  // (Jul 2026; das Pfahlfundament-Modul führt η_GZG seit je in eta_massg → jetzt konsistent).
  // Nur AKTIVE Nachweise (Optionen je Tragsystem) bestimmen die massgebende Sicherheit.
  const _etas = [['System', eta_sys, 'sys'], ['Tragf.', eta_H, 'lat'], ['Verform.', eta_V, 'verf'],
                 ['Stahl', etaStahl, 'stahl'], ['Axial', eta_ax, 'ax'],
                 ['Knick Stütze', eta_knick_stab, 'stahl'],
                 ['GZG System', eta_GZG_sys, 'gzgsys'], ['Kernweite', eta_ecc, 'kern']]
                .filter(e => nwOn('sich', e[2]));
  let eta_massgebend = Infinity, nw_massgebend = '—';
  for(const [_nm, _ev] of _etas){
    if(isFinite(_ev) && _ev < eta_massgebend){ eta_massgebend = _ev; nw_massgebend = _nm; }
  }

  // Ergebnis-HTML
  const ok  = v => `<span style="color:var(--ok);font-weight:500">${v}</span>`;
  const wrn = v => `<span style="color:var(--warn);font-weight:500">${v}</span>`;
  const fal = v => `<span style="color:var(--fail);font-weight:500">${v}</span>`;
  const eta_cls = e => e >= 1.0 ? ok : fal;

  const row = (lbl, val, unit='') =>
    `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--ol)">
      <span style="color:var(--dim)">${lbl}</span>
      <span style="font-weight:500;font-family:var(--f-mono)">${val}${(unit && !/≫/.test(String(val)))?'<span style="color:var(--xdim);font-weight:400"> '+unit+'</span>':''}</span>
    </div>`;
  // Zahlenformat mit Grenzlast-Fall: divergierter p-y-Solve liefert Infinity (unbeschränkt)
  const nfx = (v, d=1) => isFinite(v) ? v.toFixed(d) : '≫ Grenzlast';
  // Hinweis, wenn der Pfahl im/über dem Grenzlastbereich liegt (p-y-Solve divergiert)
  const divNote = wBox('fail', 'Pfahl im Grenzlastbereich der Bettung',
    `Die p-y-Verformung wächst beim Erreichen der Grenzlast unbeschränkt (Reese/Matlock, API RP-2A).
     Verformung und Biegemoment sind hier nicht nachweisbar; massgebend ist die Lateraltragfähigkeit (η_H).`);

  const warn_s = neig_mm_m >= d_krit
    ? `<div style="margin-top:6px;padding:6px 10px;background:var(--fail-s);border-left:2px solid var(--fail);border-radius:3px;font-size:9.5px;color:var(--fail);font-family:var(--f-mono)">Kritischer Grenzwert überschritten — Sofortmassnahme</div>`
    : neig_mm_m >= d_mass
    ? `<div style="margin-top:6px;padding:6px 10px;background:var(--warn-s);border-left:2px solid var(--warn);border-radius:3px;font-size:9.5px;color:var(--warn);font-family:var(--f-mono)">Grenzwert Massnahme überschritten</div>`
    : '';

  // p_u,max [kN/m] — Maximum der Bettungsgrenzhüllkurve (schichtweise/GW/Böschung via puAt)
  let Ep_max = 0;
  for(let i=0;i<=20;i++) Ep_max = Math.max(Ep_max, puAt(i/20*L_emb));

  const cardHd=nwCardHd, CARD_END=NW_CARD_END;   // gemeinsame Nachweis-Karte

  box.style.display = '';
  box.innerHTML = `
    <div style="font-family:var(--f-mono);font-size:11px">

      <!-- Header (Boden-/Klassierungsdetails stehen im Eingabe-Tab bzw. Diagramm) -->
      <div style="font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--xdim);margin-bottom:4px">Pfahlsicherung — Vordimensionierung</div>
      <div style="font-size:10px;color:var(--on2);margin-bottom:8px" title="${pfahlTypLabel} · φ = ${phi_deg}° · γ = ${gamma} kN/m³ · M_E = ${me} MN/m²">${n}× ${typ} · L = ${L} m${d_ex>0?' · Aushub '+d_ex.toFixed(1)+' m ('+(ex_seite==='gleis'?'Gleis':'Feld')+')':''}</div>

      ${(() => {
        // ── Zustandsvergleich Bestand / A ohne Massnahme / B mit Massnahme
        if(d_ex <= 0.01) return `<div style="margin:6px 0 8px;padding:5px 8px;background:var(--s2);border-radius:var(--r1);font-size:9px;color:var(--xdim)">Kein Aushub definiert — Zustandsvergleich erscheint bei d_ex &gt; 0</div>`;
        const pill = e => { const c = !isFinite(e) ? 'var(--xdim)' : etaCol(e);
          return `<span style="color:${c};font-weight:600">${isFinite(e)?e.toFixed(2):'n.m.'}</span>`; };
        const sideLbl = dEx_side==='passiv' ? 'Erdwiderstandsseite' : dEx_side==='aktiv' ? 'aktive Seite'
                      : dEx_side==='parallel' ? 'parallel zur Lastrichtung' : '—';
        // Degeneration ⇒ Zustand A ist NICHT NACHWEISBAR (kein gültiges M_u,ex) ⇒ Sicherung zwingend
        const needSich = dEx_degen || (isFinite(etaGZT_ex)&&etaGZT_ex<1)||(isFinite(etaGZG_ex)&&etaGZG_ex<1);
        const warnDeep = d_ex >= t_bl - 0.01;
        const colC = (tt, rows) => `<div style="flex:1;min-width:90px;background:var(--s2);border-radius:var(--r1);padding:6px 8px">
          <div style="font-size:9px;letter-spacing:.06em;text-transform:uppercase;color:var(--xdim);margin-bottom:4px">${tt}</div>${rows}</div>`;
        const kv = (k,v) => `<div style="display:flex;justify-content:space-between;font-size:9.5px;padding:1px 0;gap:4px"><span style="color:var(--dim)">${k}</span><span style="font-family:var(--f-mono);white-space:nowrap">${v}</span></div>`;
        return `
        <div style="margin:8px 0 10px">
          <div style="font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--xdim);margin-bottom:4px">Zustandsvergleich — Aushub ${d_ex.toFixed(2)} m (${ex_seite==='gleis'?'Gleisseite':'Feldseite'} · ${sideLbl})</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${colC('Bestand',
                kv('GZT η', pill(etaGZT_block)) +
                kv('GZG η', pill(etaGZG_block)) +
                kv('M_u', Mu_block.toFixed(0)+' kNm'))}
            ${colC('A — ohne Massnahme',
                kv('GZT η'+(komb_ex?' · K'+komb_ex:''), dEx_degen
                    ? '<span style="color:var(--fail);font-weight:600">n. führbar</span>'
                    : pill(hasExState?etaGZT_ex:NaN)) +
                kv('GZG η <span style="color:var(--xdim)">(Näh.)</span>', pill(hasExState?etaGZG_ex:NaN)) +
                kv('M_u,ex', !hasExState ? '—'
                    : dEx_degen ? '<span style="color:var(--fail)">ungültig</span>'
                    : Mu_block_ex.toFixed(0)+' kNm') +
                (hasExState && dEx_gov > 0.01 && dEx_gov < d_ex - 0.01
                  ? kv('Kurvenumkehr ab', 'd = '+dEx_gov.toFixed(2)+' m') : ''))}
            ${colC('B — mit Massnahme',
                kv('η_System', pill(eta_sys)) +
                kv('GZG_sys η', pill(eta_GZG_sys)) +
                kv('Anteil Pfähle', (f_eff*100).toFixed(0)+' %'+(lv_auto?'':' (man.)')))}
          </div>
          <div style="margin-top:5px;padding:5px 8px;border-left:2px solid ${needSich?'var(--warn)':'var(--ok)'};background:${needSich?'var(--warn-s)':'var(--ok-s)'};font-size:9.5px;color:${needSich?'var(--warn)':'var(--ok)'}">
            ${!hasExState ? 'Zustand A noch nicht berechnet — Berechnen ausführen'
              : dEx_degen ? 'Sicherung zwingend — Zustand A rechnerisch NICHT NACHWEISBAR'
              : needSich ? 'Sicherung erforderlich — Aushub ohne Massnahme nicht nachgewiesen'
              : 'Aushub ohne Massnahme rechnerisch zulässig'}
          </div>
          ${dEx_degen ? wBox('fail', 'Steckner-Mechanismus degeneriert — Nachweis nicht führbar',
            `Der Erdwiderstand oberhalb der Neutrallinie ist durch den Aushub aufgezehrt, die NL wandert in die
             Sohle (Gl.64/65). Ab d = ${dEx_gov.toFixed(2)} m liefert Gl.66 keine fallende Kapazität mehr
             (rechnerisch steigt M_u wieder an) → ausserhalb des Gültigkeitsbereichs. Es wird KEIN M_u,ex
             ausgewiesen und dem Block im Systemnachweis KEINE Restkapazität angerechnet
             (Kragarm-/Stützwandproblem → gesonderter Nachweis erforderlich).`) : ''}
          ${warnDeep ? wBox('fail', 'Aushub bis/unter Sohle',
            'Steckner-Modell nicht mehr gültig — gesonderter Nachweis erforderlich.') : ''}
          ${hasGW && z_gw < d_ex ? wBox('warn', 'GW über Aushubsohle',
            'Wasserhaltung vorausgesetzt; einseitiger Wasserdruck ist nicht modelliert.') : ''}
          <div style="margin-top:4px;font-size:9px;color:var(--xdim);line-height:1.5">Näherungen: GZG D_eff = t − d_ex · Rankine-Keil ohne δ${dEx_side==='parallel'?' · Aushub parallel: nur die freigelegte E₀-Seitenfläche angesetzt (passive Stirnflächen intakt)':''}</div>
        </div>`;
      })()}

      <!-- Massgebender Nachweis — immer sichtbar -->
      <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;margin:0 0 8px;background:var(--s3);border-radius:var(--r1)">
        <span style="font-size:9px;letter-spacing:.06em;text-transform:uppercase;color:var(--dim)">Massgebender Nachweis</span>
        <span style="font-weight:600;color:${!isFinite(eta_massgebend)?'var(--xdim)':etaCol(eta_massgebend)}">${isFinite(eta_massgebend)?'η = '+eta_massgebend.toFixed(2)+' · '+nw_massgebend:'n.m.'}</span>
      </div>

      <!-- Richtungsfall Stütze — immer sichtbar -->
      ${fall_zug ? (pile_active
        ? wBox('warn', 'Richtstütze wirkt auf ZUG',
            'Momentrichtung zum Aushub — die Anschlüsse müssen zugfest ausgebildet sein (Annahme: zugfest).')
        : wBox('fail', 'Pfahlsystem trägt in diesem Lastfall NICHT',
            'Momentrichtung zum Aushub + Anschluss nur druckfest (Kontaktstoss) → M_Pfahl = 0.'))
        : ''}

      ${cardHd('Einwirkung + Lastverteilung', null, 'F_s = '+F_s.toFixed(1)+' kN '+(fall_zug?'(Zug)':'(Druck)'))}
      <!-- Stützenstabkraft — prominent -->
      <div style="background:var(--s3);border-radius:var(--r1);padding:8px 10px;margin-bottom:8px">
        <div style="font-size:9px;color:${fall_zug?'var(--warn)':'var(--xdim)'};margin-bottom:3px">Stützenstabkraft (H + M-Anteil) — ${fall_zug?'ZUG (Moment zum Aushub)':'Druck'}</div>
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <span>F_s = H_eff / cos(${alpha.toFixed(1)}°)</span>
          <span style="font-size:13px;font-weight:500;color:var(--on)">${F_s.toFixed(1)} kN</span>
        </div>
        ${dH_ep > 0.01 ? `<div style="margin-top:4px;font-size:9px;color:var(--warn)">+ ΔH = ${dH_ep.toFixed(1)} kN aus Ep-Verlust (Aushub)</div>` : ''}
      </div>
      ${row('H_d Bemessung ('+lfName+')', H_d_bemessung.toFixed(1), 'kN')}
      ${row('M_d Bemessung (Sohle)', M_d_bemessung.toFixed(1), 'kNm')}
      ${lv_auto ? `
      <div style="margin:3px 0;padding:5px 8px;background:var(--s2);border-left:2px solid var(--ol2);border-radius:3px;font-size:9.5px">
        <div style="color:var(--dim);margin-bottom:2px;font-size:9px;letter-spacing:.05em;text-transform:uppercase">Steifigkeitsverteilung (Drehfedern um Sohle)</div>
        ${row('K_Block (C₁-Bettung'+(exPas_lv?', D_eff='+D_lv.toFixed(2)+' m':'')+')', (K_block_rot/1000).toFixed(0), 'MNm/rad')}
        ${row('K_Pfahl (Winkler + Stütze, Serie)', (K_pfahl_rot/1000).toFixed(0), 'MNm/rad')}
        ${row('f_auto = K_Pf / (K_Bl + K_Pf)', f_eff.toFixed(2), '')}
      </div>` : row('f_eff Lastanteil (manuell)', f_eff.toFixed(2), '')}
      ${f_eff < 1.0 ? row('H_d,eff', H_d.toFixed(1), 'kN') : ''}
      ${f_eff < 1.0 ? row('M_d,eff', M_d.toFixed(1), 'kNm') : ''}
      ${row('Arm Stütze ab Sohle', arm_stuetze.toFixed(2), 'm')}
      ${M_d > 1 ? `<div style="margin:3px 0;padding:5px 8px;background:var(--acc-s);border-left:2px solid var(--acc);border-radius:3px;font-size:10px">
        <div style="color:var(--dim);margin-bottom:2px">Moment-Anteil via Richtstütze</div>
        ${row('H_eff = H_d + M_d / arm', H_eff.toFixed(1), 'kN')}
      </div>` : ''}
      ${row('H_Pfahl = H_eff (⊥ vert. Pfahl)', H_pfahl_d.toFixed(1), 'kN')}
      ${row('V_Pfahl = H_eff · |tan(α)| ('+(axial_pullout?'Herausziehen':'Druck')+')', V_pfahl.toFixed(1), 'kN')}
      ${row('F_s = H_eff / cos(α) — Stützenstab', F_s.toFixed(1), 'kN')}
      ${N_bRd_stab > 0 ? row('N_b,Rd Stütze (Datenblatt)', N_bRd_stab.toFixed(0), 'kN')
        + `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--ol)"><span style="color:var(--dim)">η Knick Stütze = N_b,Rd / F_s${fall_zug?' (Zug — n.a.)':''}</span><span style="font-weight:600;font-family:var(--f-mono)">${isFinite(eta_knick_stab)?eta_cls(eta_knick_stab)('η = '+eta_knick_stab.toFixed(2)):'n.a.'}</span></div>` : ''}
      ${Math.abs(alpha) < 4 ? `<div style="font-size:9px;color:var(--xdim);padding:1px 0 2px">α = ${alpha.toFixed(1)}° — Stütze fast waagrecht (Pfahlkopf ≈ Anschlusshöhe) → geringe Axialkraft</div>` : ''}
      <div style="margin-top:6px">${buildStrutDecompSVG(alpha, H_eff, F_s, V_pfahl, H_pfahl_d, fall_zug, axial_pullout)}</div>
      ${dH_ep > 0.01 ? `
      <div style="margin:6px 0 2px;padding:6px 8px;background:${lv_auto?'var(--s2)':'var(--warn-s)'};border-left:2px solid ${lv_auto?'var(--ol2)':'var(--warn)'};border-radius:3px">
        <div style="font-size:9px;color:${lv_auto?'var(--xdim)':'var(--warn)'};margin-bottom:3px;letter-spacing:.05em">Ep-Verlust durch Aushub (d_ex = ${d_ex.toFixed(1)} m)${lv_auto?' — informativ, steckt im Auto-Modus in M_u,ex / D_eff':''}</div>
        ${row('Ep_lost (Block, h='+h_ep_los.toFixed(2)+'m)', Ep_lost.toFixed(1), 'kN')}
        ${row('Arm Ep-Schwerpunkt → Sohle', arm_Ep_sohle.toFixed(2), 'm')}
        ${row('Arm Stütze → Sohle', arm_st_sohle.toFixed(2), 'm')}
        ${row('ΔH_Pfahl'+(lv_auto?' (nicht angesetzt)':' = Ep_lost × arm_Ep / arm_St'), dH_ep.toFixed(1), 'kN')}
      </div>` : ''}
      <div style="display:flex;justify-content:space-between;padding:4px 0;border-top:1px solid var(--ol);font-weight:500">
        <span style="color:var(--dim)">H_Pfahl,total (massgebend)</span>
        <span style="font-family:var(--f-mono)">${H_pfahl_total.toFixed(1)} <span style="color:var(--xdim);font-weight:400">kN</span></span>
      </div>

      ${CARD_END}

      <div class="lf-grp">Äussere Tragsicherheit — Boden (GZT)</div>
      ${cardHd('Lateraltragfähigkeit (Grenzgleichgewicht p_u)', eta_H, null, nw_massgebend==='Tragf.')}
      ${betaRed > 0.1 ? `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--ol)">
        <span style="color:var(--warn)">Böschung talseitig (β = ${_slBeta}°)
          <span style="color:var(--xdim);font-size:9px"> Kp,β geneigtes Gelände (Rankine)</span>
        </span>
        <span style="font-weight:500;font-family:var(--f-mono);color:var(--warn)">Kp ${kp_full.toFixed(2)} → ${kp_eff.toFixed(2)} (−${((1-kp_eff/kp_full)*100).toFixed(0)}%)</span>
      </div>` : ''}
      ${exClip && exClipRed > 0.005 ? `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--ol)">
        <span style="color:var(--warn)">Bruchkörper reicht in Aushub (Zugfall)
          <span style="color:var(--xdim);font-size:9px"> Keil daylightet ab z=${(L_horiz_ex/Math.tan(Math.PI/4+phi_r_b/2)).toFixed(2)}m in Grube · Überdeckung −d_ex</span>
        </span>
        <span style="font-weight:500;font-family:var(--f-mono);color:var(--warn)">H_u −${(exClipRed*100).toFixed(0)}%</span>
      </div>
      <div style="font-size:9px;color:var(--xdim);padding:1px 0 3px;border-bottom:1px solid var(--ol)">Block-Abschirmung konservativ vernachlässigt — globale Standsicherheit gesondert prüfen</div>` : ''}
      ${row('p_u,max Bettungsgrenzwert (3·Kp·σ′v·B)', Ep_max.toFixed(0), 'kN/m')}
      ${row('H_u,1,k (p-y-Push, Rotationsmech.)'+(exClip&&exClipRed>0.005?' (Aushub-red.)':''), Hu_1k.toFixed(1), 'kN')}
      ${row('γ_R Widerstandsteilsicherheit', gamma_R.toFixed(2), '')}
      ${row('H_u,1,d = H_u,k / γ_R', Hu_1.toFixed(1), 'kN')}
      ${row('f_gr Gruppeneffekt (s/B='+sB.toFixed(1)+')', f_gr.toFixed(2), '')}
      <div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--ol)">
        <span style="color:var(--dim)">Wirkungsschatten Block${fall_zug?' <span style="color:var(--xdim)">(Aktivkeil, Zugfall)</span>':''}
          <span style="color:var(--xdim);font-size:9px"> z_ov=${z_ov.toFixed(2)}m · seitl. ${(pileShadow[0]?.e_lat ?? 0).toFixed(2)}m vs. Keilkante ${(pileShadow[0]?.w_lat ?? 0).toFixed(2)}m (Grundriss)</span>
        </span>
        <span style="font-weight:500;font-family:var(--f-mono);color:${z_ov>0.01?'var(--warn)':'var(--dim)'}">f_sch=${f_shadow.toFixed(2)}${z_ov<0.01?' — Pfähle ausserhalb Keil':' ← Abminderung'}</span>
      </div>
      ${row('H_u,Gruppe ('+n+'× H_u,1,d · f_gr)', Hu_gruppe.toFixed(1), 'kN')}
      <div style="display:flex;justify-content:space-between;padding:5px 0;margin-top:2px;border-top:1px solid var(--ol)">
        <span style="color:var(--dim)">η_Tragfähigkeit</span>
        <span style="font-weight:500">${eta_cls(eta_H)(isFinite(eta_H)?'η = '+eta_H.toFixed(2):'n.m.')}</span>
      </div>

      ${CARD_END}
      ${cardHd('Axialer Pfahlnachweis'+(fall_zug?' (Herausziehen)':''), eta_ax, null, nw_massgebend==='Axial')}
      ${row((fall_zug?'Zugkraft (Herausziehen)':'V_Pfahl')+' pro Pfahl = H_eff·tan(α)/n', V_1.toFixed(1), 'kN')}
      ${row('q̄_s = K₀·σ′v·tan(2/3φ)'+(multiLayer?' (schichtweise)':''), (R_ax_k/Math.max(0.01,U_box*L_emb)).toFixed(1), 'kPa')}
      ${row('R_ax,k (Kastenumfang '+(U_box*100).toFixed(0)+' cm × L)', R_ax_k.toFixed(1), 'kN')}
      ${row('R_ax,d = R_ax,k / γ_R', R_ax_d.toFixed(1), 'kN')}
      <div style="display:flex;justify-content:space-between;padding:5px 0;margin-top:2px;border-top:1px solid var(--ol)">
        <span style="color:var(--dim)">η_Axial</span>
        <span style="font-weight:500">${eta_cls(eta_ax)(isFinite(eta_ax)?'η = '+eta_ax.toFixed(2):'n.m.')}</span>
      </div>
      <div style="font-size:9px;color:var(--xdim);margin-top:2px">Mantelreibung HEB-Kasten, Spitzendruck vernachlässigt (konservativ)${fall_zug?' · Herausziehen: gleiche Mantelreibung, Eigengewicht günstig vernachlässigt':''}</div>
      ${CARD_END}

      <div class="lf-grp">Innere Tragsicherheit — Bauteil (GZT)</div>
      ${cardHd('Stahlquerschnitt ('+typ+')', etaStahl, null, nw_massgebend==='Stahl')}
      ${row('M_max,1 (p-y'+(pyBUse?((pyBUse.yielded?', plastisch':', elastisch')+', z='+(pyBUse.sMmax-e_eff).toFixed(2)+'m u.GOK'):(pyBDiverg?' — Grenzlast':' — Näherung'))+')', nfx(M_max_1), 'kNm')}
      ${pyBDiverg ? divNote : ''}
      ${spliced_p ? `<div style="font-size:9px;color:var(--xdim);padding:1px 0 2px">gestossen (Krinner): Stoss = Gelenk → M+N über längstes Element L_bend = ${Lbend_p.toFixed(2)} m (Grenzlast/Verformung über volle Länge L = ${L_emb.toFixed(2)} m)</div>` : ''}
      ${row('M_pl,k (S355, f_yk = 355 N/mm²)', Mpl.toFixed(1), 'kNm')}
      ${row('γ_M (SIA 263, Querschnitt)', gamma_M.toFixed(2), '')}
      ${row('M_pl,Rd = M_pl,k / γ_M', M_pl_Rd.toFixed(1), 'kNm')}
      ${row('N_Pfahl'+(axial_pullout?' (Zug)':' (Druck)')+' = H_eff·tan(α)/n', N_ax_1.toFixed(1), 'kN')}
      ${row('N_pl,Rd = A·f_yk/γ_M (A = '+((prof.A||0)*1e4).toFixed(1)+' cm²)', N_pl.toFixed(0), 'kN')}
      <div class="nw-formula" style="margin-top:3px">|N|/N_pl,Rd + |M|/M_pl,Rd ≤ 1  ·  η = 1 / Ausnutzung</div>
      ${row('Ausnutzung = '+utilN.toFixed(3)+' (N) + '+(isFinite(utilM)?utilM.toFixed(3):'≫')+' (M)', isFinite(utilSt)?utilSt.toFixed(3):'≫ Grenzlast', '')}
      <div style="display:flex;justify-content:space-between;padding:5px 0;margin-top:2px;border-top:1px solid var(--ol)">
        <span style="color:var(--dim)">η_Stahl = 1 / (|N|/N_pl,Rd + |M|/M_pl,Rd)</span>
        <span style="font-weight:500">${eta_cls(etaStahl)(isFinite(etaStahl)?'η = '+etaStahl.toFixed(2):'n.m.')}</span>
      </div>
      <div style="font-size:9px;color:var(--xdim);margin-top:2px">N+M-Interaktion (SIA 263) mit γ_M = ${gamma_M.toFixed(2)} auf beide Terme; Knicken des Pfahls nicht massgebend (allseitig gebettet)</div>
      ${CARD_END}
      ${(isFinite(etaGZT_block) && Md_Hst_block >= 0.1) ? '<div class="lf-grp">Stabilität — System Block + Pfahl (GZT)</div>' : ''}
      ${(() => {
        // ── Systemnachweis Block + Pfahl (GZT + GZG) — Blockkapazität im Aushubzustand
        if(!isFinite(etaGZT_block) || Md_Hst_block < 0.1) return '';
        const eta_sys_c = etaCol(eta_sys);
        const eta_blk_c = etaCol(etaGZT_block);
        const eta_ex_c  = !hasExState ? 'var(--xdim)' : etaCol(etaGZT_ex);
        const capped    = H_pf_full > Hu_gruppe + 0.01;
        const deficit   = Math.max(0, Md_Hst_block - Mu_sys);
        // Die System-GZG-Zeile (Schiefstellung) sitzt in dieser Karte → Karte auch dann als
        // massgebend markieren, wenn η_GZG,sys das Minimum stellt (sonst trüge keine Karte den Tag).
        return cardHd('Systemnachweis Block + Pfahl', eta_sys, null,
                      nw_massgebend==='System' || nw_massgebend==='GZG System') + `
            ${row('M_d,H* (Steckner, Block)', Md_Hst_block.toFixed(1), 'kNm')}
            <div style="display:flex;justify-content:space-between;padding:3px 0">
              <span style="color:var(--dim)">M_u Block intakt</span>
              <span style="font-family:var(--f-mono);color:${eta_blk_c}">${Mu_block.toFixed(1)} kNm · η=${etaGZT_block.toFixed(2)}</span>
            </div>
            ${hasExState ? (dEx_degen ? `<div style="display:flex;justify-content:space-between;padding:3px 0">
              <span style="color:var(--warn)">M_u,ex Block — Gl.66 ungültig${dEx_side?' ('+dEx_side+')':''}</span>
              <span style="font-family:var(--f-mono);color:var(--warn)">${sysErsatz ? 'Ersatzmodell' : 'nicht anrechenbar · 0.0 kNm'}</span>
            </div>
            ${sysErsatz ? `<div style="display:flex;justify-content:space-between;padding:3px 0">
              <span style="color:var(--dim)">M_u aus Starrkörperbilanz (Fusskante)</span>
              <span style="font-family:var(--f-mono);color:${etaCol(rb.eta_equiv)}">${rb.Mu_equiv.toFixed(1)} kNm · η=${isFinite(rb.eta_equiv)?rb.eta_equiv.toFixed(2):'n.m.'}</span>
            </div>
            <div style="font-size:9px;color:var(--warn);padding:0 0 3px;line-height:1.5">Steckner Gl.66 verlässt bei diesem Aushub den Gültigkeitsbereich (NL in Sohle). Angerechnet wird stattdessen die <b>Starrkörperbilanz um die Fusskante</b> — durchgehend konservativer, aber bis h_p = 0 gültig.</div>`
            : `<div style="font-size:9px;color:var(--fail);padding:0 0 3px;line-height:1.5">Mechanismus degeneriert (NL in Sohle) → das System trägt allein über die Pfähle</div>`}` : `<div style="display:flex;justify-content:space-between;padding:3px 0">
              <span style="color:var(--dim)">M_u,ex Block (Aushub${dEx_side?', '+dEx_side:''})</span>
              <span style="font-family:var(--f-mono);color:${eta_ex_c}">${Mu_block_ex.toFixed(1)} kNm · η=${isFinite(etaGZT_ex)?etaGZT_ex.toFixed(2):'n.m.'}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:9.5px">
              <span style="color:var(--xdim)">Zweitmeinung Starrkörperbilanz (Fusskante)</span>
              <span style="font-family:var(--f-mono);color:var(--xdim)">${rb.Mu_equiv.toFixed(1)} kNm · η=${isFinite(rb.eta_equiv)?rb.eta_equiv.toFixed(2):'n.m.'}</span>
            </div>`) : ''}
            ${pile_active
              ? row('M_Pfahl = min(H_voll, H_u,Gruppe) × arm'+(capped?' — kapazitätsgedeckelt':''), M_pile_cap.toFixed(1), 'kNm')
              : `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--ol)"><span style="color:var(--fail)">M_Pfahl — Anschluss nur druckfest, Zugfall</span><span style="font-family:var(--f-mono);color:var(--fail)">0.0 kNm</span></div>`}
            ${deficit > 0.1 ? `<div style="padding:3px 0;font-size:9px;color:var(--warn)">Defizit Block${hasExState?' (Aushub)':''}: ${deficit.toFixed(1)} kNm → ${M_pile_cap >= deficit ? 'durch Pfähle gedeckt' : 'nicht gedeckt'}</div>` : ''}
            <div style="display:flex;justify-content:space-between;padding:5px 0;margin-top:4px;border-top:1px solid var(--ol);font-weight:500">
              <span>η_System = (M_u${hasExState?',ex':''} + M_Pfahl) / M_d</span>
              <span style="font-family:var(--f-mono);color:${eta_sys_c}">η = ${eta_sys.toFixed(2)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:3px 0;border-top:1px solid var(--ol);font-size:9.5px">
              <span style="color:var(--dim)">Schiefstellung System (Block+Pfahl, GZG)${nw_massgebend==='GZG System'?' <span style="color:var(--acc);font-size:9px;letter-spacing:.05em">MASSGEBEND</span>':''}</span>
              <span style="font-family:var(--f-mono)">${neig_sys_mm.toFixed(1)} mm/m · ${eta_cls(eta_GZG_sys)(isFinite(eta_GZG_sys)?'η = '+eta_GZG_sys.toFixed(2):'n.m.')}</span>
            </div>
            <div style="font-size:9px;color:var(--xdim);margin-top:3px">Kapazitätssumme: Blockwiderstand im Aushubzustand + kapazitätsgedeckelter Pfahlbeitrag vs. volle Bemessungslast</div>
        ` + CARD_END;
      })()}

      ${eccActive ? (()=>{
        // ── E1: Kernweite / Sohlexzentrizität im Aushubzustand ────────────────────
        // Steckner Gl.66 lässt e → b/2 zu, solange der Boden p_u auf schmalem Streifen trägt
        // (Tragfähigkeitslimit). e ≤ κ_e·b ist ein davon unabhängiges ROBUSTHEITSlimit: es hält
        // die Sohlfuge klaffungsfrei bzw. innerhalb der SIA-Grenze und verhindert, dass die
        // Ersatzfläche nach Meyerhof rechnerisch verschwindet.
        return cardHd('Kernweite / Sohlexzentrizität (Aushubzustand)', eta_ecc, null,
                      nw_massgebend==='Kernweite') + `
            <div class="nw-formula">e = |M_t,d − E_p,d·z_p − H_R·z_R| / V_d,inf ≤ κ_e · b</div>
            ${row('M_t,d treibend (M_d + H_d·z_H + E_a,d·z_a)', rb.Mt_d.toFixed(1), 'kNm')}
            ${row('E_p,d · z_p (Resteinbindung h_p = '+rb.hp.toFixed(2)+' m)', (rb.Ep_d*rb.zp).toFixed(1), 'kNm')}
            ${row('H_R · z_R (vorhandene Sicherung)', (rb.HR*rb.zR).toFixed(1), 'kNm')}
            ${row('V_d,inf', rb.Vinf.toFixed(1), 'kN')}
            <div style="display:flex;justify-content:space-between;padding:3px 0">
              <span style="color:var(--dim)">e vorhanden</span>
              <span style="font-family:var(--f-mono)">${rb.e.toFixed(3)} m = b/${rb.e>1e-6?(rb.b/rb.e).toFixed(1):'∞'}</span>
            </div>
            ${row('e_zul = κ_e · b  (κ_e = 1/'+(1/rb.kappaE).toFixed(0)+')', rb.eLim.toFixed(3), 'm')}
            <div style="display:flex;justify-content:space-between;padding:5px 0;margin-top:4px;border-top:1px solid var(--ol);font-weight:500">
              <span>η_Kernweite = e_zul / e</span>
              <span style="font-family:var(--f-mono);color:${etaCol(eta_ecc)}">η = ${isFinite(eta_ecc)?eta_ecc.toFixed(2):'∞'}</span>
            </div>
            ${rb.HR_tot > rb.HR + 0.05 ? `<div style="font-size:9px;color:var(--warn);padding:4px 0 0;line-height:1.5">
              Erforderliche Rückhaltekraft aus dieser Bedingung: <b>${rb.HR_eLim.toFixed(1)} kN</b>
              (aus der reinen Momentenbilanz: ${rb.HR_St.toFixed(1)} kN) — vorhanden ${rb.HR.toFixed(1)} kN.</div>` : ''}
            <div style="font-size:9px;color:var(--xdim);margin-top:3px">κ_e in den Optionen einstellbar: 1/6 = klaffungsfreie Kernweite (Voreinstellung, für provisorische Zustände) · 1/3 = SIA 267 Ziff. 5.4.2.4. Nur im Aushubzustand geführt — beim voll eingebundenen Block deckt Steckner Gl.66 die Standsicherheit ab.</div>
        ` + CARD_END;
      })() : ''}

      ${bzAktiv ? wBox('warn', 'Bauzustand: γ_G,red = '+_gGsup_s.toFixed(2)+' angesetzt (statt '+_gGsupFull.toFixed(2)+')',
        `Nach SIA 267 Ziff. 5.4.3.6 darf der ständige Lastbeiwert für Zustände mit kurzer Standzeit
         reduziert werden; so wurde auch in der <b>Typenzulassungsstatik</b> gerechnet. Der Ansatz wirkt
         auf den <b>Aushubzustand</b>, die <b>Sicherungsbemessung</b> und die <b>Dimensionierung</b> —
         die Endzustand-Nachweise oben rechnen unverändert mit γ_G,sup = ${_gGsupFull.toFixed(2)}.<br>
         ${_bzSpezialfundament()
           ? '<b style="color:var(--fail)">Achtung: Spezialfundament.</b> Der Ansatz ist hier grundsätzlich '+
             'nicht zulässig und nur über die ausdrücklich gesetzte Ausnahme aktiv — die Anwendungs&shy;'+
             'bedingungen sind projektspezifisch nachzuweisen und im Bericht zu begründen.'
           : 'Voraussetzung ist eine tatsächlich kurze Standzeit des Bauzustands; die Begründung gehört '+
             'in den Nachweisbericht.'}`) : ''}
      ${bzBlockiert ? wBox('fail', 'γ_G,red für Spezialfundamente unterdrückt',
        `Der reduzierte Lastbeiwert für Bauzustände ist in den Optionen eingeschaltet, greift hier aber
         <b>nicht</b>: Typengeprüft ist das Standard-Blockfundament — beim
         ${CALC_MODEL==='flach'?'Flachfundament':'Pfahlfundament'} handelt es sich um ein
         <b>Spezialfundament</b>, für das der Ansatz nicht zulässig ist. Gerechnet wird mit dem vollen
         γ_G,sup = ${_gGsupFull.toFixed(2)}.<br>
         Soll er dennoch angewandt werden, ist in den Optionen zusätzlich die Ausnahme zu setzen und
         projektspezifisch zu begründen.`) : ''}

      <!-- Globale Böschungsstandsicherheit (Bishop) hier entfernt (Jul 2026, Nutzerentscheid, ohne
           Hinweiszeile): beim eingespannten Blockfundament läge die Gleitfläche teilweise im Betonkörper
           → Lamellenverfahren nicht gültig. Stabilität ggü. der Böschung deckt der Steckner-GZT ab. -->

      <div class="lf-grp">Gebrauchstauglichkeit (GZG)</div>
      ${cardHd('Verformung (p-y-Bettung, FE)', eta_V, null, nw_massgebend==='Verform.')}
      <div style="font-size:9px;color:var(--xdim);margin:0 0 4px">Biegelinie/Moment siehe Schnittgrössen-Diagramm (FE-Bettung)</div>
      ${row('k_s lateral'+(multiLayer?' (schichtweise, M̄_E='+me_eff.toFixed(0)+')':' (M_E)'), (k_s/1000).toFixed(0), 'MN/m³')}
      ${row('α_lat Lateral-Faktor', alpha_lat.toFixed(2), '')}
      ${row('λL Pfahlklasse', aL.toFixed(2)+' → '+pfahlTypLabel, '')}
      ${row('δ Pfahlkopf bei H_d (p-y)', nfx(delta_gruppe_mm), 'mm')}
      ${row('h_Bezug Verkippung (Sohle → Anschluss)', h_ref_tilt.toFixed(2), 'm')}
      ${row('Verkippung θ = δ / h_Bezug', nfx(neig_mm_m), 'mm/m')}
      ${pyDiverged ? divNote : ''}
      <div style="display:flex;gap:8px;margin-top:2px">
        <div style="flex:1;padding:3px 6px;background:${neig_mm_m>=d_krit?'var(--fail-s)':neig_mm_m>=d_mass?'var(--warn-s)':'var(--ok-s)'};border-radius:3px;font-size:9px">
          Massnahme: ${d_mass.toFixed(0)} mm/m
        </div>
        <div style="flex:1;padding:3px 6px;background:${neig_mm_m>=d_krit?'var(--fail-s)':'var(--s3)'};border-radius:3px;font-size:9px">
          Kritisch: ${d_krit.toFixed(0)} mm/m
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;padding:5px 0;margin-top:6px;border-top:1px solid var(--ol)">
        <span style="color:var(--dim)">η_Verformung</span>
        <span style="font-weight:500">${eta_cls(eta_V)(isFinite(eta_V)?'η = '+eta_V.toFixed(2):'n.m.')}</span>
      </div>
      ${warn_s}
      ${CARD_END}

      <div style="margin-top:10px;padding:5px 8px;background:var(--s3);border-radius:3px;font-size:9px;color:var(--xdim);line-height:1.55">
        Vordimensionierung · p-y-Bettungsmodell (elasto-plastisch, Grenzlast aus p_u-Hüllkurve) · Stütze: ${fall_zug?'Zugfall':'Druckfall (Knicknachweis offen)'} · ${multiLayer?'schichtweiser Boden':'Boden Schicht 1'} · Kein Ersatz für normativen Nachweis
      </div>
    </div>`;

  // ── Systemschnitt (kombiniert: Geometrie + Ep + Bruchkörper)
  const sysParams = {
    phi_deg, gamma, gamma2, z_gw, hasGW, useClay, hasC,
    t_bl, G_ue: G_ue_b, G_bx,
    d_abst: d_abst_m, B_pf: B, L_emb, e_h: e_eff, d_ex,
    d_krit_ov, r_overlap, f_overlap, z_ov, f_shadow,
    Hu_1, Hu_gruppe, H_pfahl_total, eta_H, eta_V, etaStahl,
    delta_gruppe_mm, neig_mm_m, n, typ,
    k_s, k_s_vert, alpha_lat, gamma_R, aL, pfahlTypLabel,
    d_mass, d_krit_v: d_krit, pfaehle_im_aushub, Hu_1k, ex_seite, fall_zug,
    kp_eff, betaRed, exClipRed, L_horiz_ex, puAt, puAtEx, multiLayer
  };
  const sysId = '_pfahl_sys_diag';
  let sysWide = window[sysId+'_wide'] || false;
  const sysDiv = document.createElement('div');
  sysDiv.style.cssText = 'margin-top:12px';
  sysDiv.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <span style="font-family:var(--f-mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--xdim)">Systemschnitt Block / Pfahl</span>
      <button onclick="togglePfahlDiagWide('${sysId}')"
        style="background:var(--s3);border:1px solid var(--ol);border-radius:3px;color:var(--dim);font-family:var(--f-mono);font-size:9px;padding:1px 7px;cursor:pointer">
        ${sysWide ? '↙' : '⤢'}
      </button>
    </div>
    ${buildPfahlSystemSVG(sysParams, sysWide)}`;
  box.appendChild(sysDiv);

  // ── Winkler Schnittgrössen-Diagramm (y, p, M)
  const snId = '_pfahl_sn_diag';
  let snWide = window[snId+'_wide'] || false;
  const snDiv = document.createElement('div');
  snDiv.style.cssText = 'margin-top:10px';
  snDiv.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <span style="font-family:var(--f-mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--xdim)">Schnittgrössen — p-y (FE)</span>
      <button onclick="togglePfahlDiagWide('${snId}')"
        style="background:var(--s3);border:1px solid var(--ol);border-radius:3px;color:var(--dim);font-family:var(--f-mono);font-size:9px;padding:1px 7px;cursor:pointer">
        ${snWide ? '↙' : '⤢'}
      </button>
    </div>
    ${buildPfahlSchnittSVG({
      H_1: H_pfahl_total/n, e_eff, L_emb, k_s, B_pf: B, EI, Mpl,
      etaStahl, phi_deg, gamma, gamma2, z_gw, hasGW, useClay, hasC,
      aL, pfahlTypLabel, d_ex, pfaehle_im_aushub, alpha_lat, gamma_R, kp_eff, betaRed,
      pyProfile: pyUse ? pyUse.profile : (py1 ? py1.profile : null),
      pyScale: pyUse ? 1 : (H_pfahl_total/n),
      puAt, pyYielded: pyUse ? pyUse.yielded : false, pyNonlin: !!pyUse, multiLayer
    }, snWide)}
    <details style="margin-top:6px">
      <summary style="font-family:var(--f-mono);font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:var(--xdim);cursor:pointer">p-y-Kennlinie erklärt</summary>
      <div style="margin-top:4px">${buildPyKennlinieSVG(pyMob, pyUse?pyUse.yielded:false)}</div>
      <div style="font-size:8.5px;color:var(--xdim);line-height:1.5;margin-top:4px">
        Jede Bodentiefe ist eine Feder: Reaktion <b>p</b> steigt elastisch mit der Verschiebung (Steigung k_s·B),
        bis sie den Grenzwert <b>p_u</b> (Bodenfliessen) erreicht — danach konstant. Die <b>p_u-Grenzhülle</b>
        im Schnittgrössen-Diagramm ist p_u(z) über die Tiefe; die Querkraft V(z) = ∫p dz. Grenzlast = wenn p
        über genügend Länge an p_u klebt (Mechanismus).
      </div>
    </details>`;
  box.appendChild(snDiv);

  // ── Viewer-Badge im Sicherungsmodus aktualisieren
  _updateSicherungsBadge(eta_H, eta_V, etaStahl, neig_mm_m, d_krit, d_mass,
                         eta_massgebend, nw_massgebend);
}

function _updateSicherungsBadge(eta_H, eta_V, etaStahl, neig_mm_m, d_krit, d_mass,
                                 eta_massgebend, nw_massgebend){
  const badge = document.getElementById('viewer-nw-badge');
  if(!badge) return;
  if(!showPfahl){ badge.style.display='none'; return; }

  const isOk   = eta_massgebend >= 1.0;
  const isCrit = neig_mm_m >= d_krit;
  const isWarn = !isOk || neig_mm_m >= d_mass;

  const cls  = isCrit ? 'pill-f' : isWarn ? 'pill-w' : 'pill-ok';
  const icon = isCrit ? '● Kritisch' : isWarn ? '● Massnahme erf.' : '● Sicherung nachgew.';
  const etaStr = isFinite(eta_massgebend) ? eta_massgebend.toFixed(2) : 'n.m.';
  const txt  = `${icon} · η=${etaStr} (${nw_massgebend}) · ${isFinite(neig_mm_m)?neig_mm_m.toFixed(1)+' mm/m':'≫ Grenzlast'}`;

  badge.style.display = 'block';
  badge.innerHTML = `<span class="pill ${cls}" style="white-space:nowrap;backdrop-filter:blur(4px)">${txt}</span>`;
}

// Sicherung-Tab beim Start initialisieren
function initSicherung(){
  onPfahlTyp('HEB200');
  _updatePfahlGeomHint();
  _updateSicherungBtn();
  const btn = document.getElementById('vc-pfahl');
  if(btn) btn.classList.toggle('on', showPfahl);
  _updateKeilBtnVis();
}

let _calcFlashT=null;
function _flashCalc(){ const el=document.getElementById('sb-calc'); if(!el) return; el.style.opacity='1'; clearTimeout(_calcFlashT); _calcFlashT=setTimeout(()=>{el.style.opacity='0';}, 650); }
// ════════════════════════════════════════════════════════════════════════════════
