// BlockCalc — js/pfahlfundament-ergebnis.js
// Pfahlfundament: Diagramme und Ergebnis-Panel
// PFAHLFUNDAMENT — NACHWEIS-DIAGRAMME (expandierbar via toggleGZTExpand)
// ════════════════════════════════════════════
const _pbE = e => etaCol(e);

// Geotechnik: Axialkraft pro Pfahl vs. R_s,d (Mantelreibung; Druck/Zug getrennt)
// Mantelreibungswiderstand über die Tiefe (kumulativ) + Schichtbänder, Druck- und Zug-Bemessungswert,
// mit den angesetzten max. Pfahl-Axialkräften (Druck/Zug) als Vergleichslinien → zeigt, ab welcher
// Tiefe der Widerstand die Last deckt (Ausnutzung über die Einbindelänge).
function buildPbAxialDiagram(r, n, wide){
  const LY = r && r.skinLayers ? r.skinLayers : [];
  if(!LY.length) return '';
  const L = r.L||6, Rd = r.Rskin_d||0, RdZ = (r.Rskin_dZ!=null?r.Rskin_dZ:Rd), hasZ = Math.abs(RdZ-Rd)>0.5;
  const pr = r.pileRes||[];
  const Nd_max = Math.max(0, ...pr.filter(p=>!p.zug).map(p=>Math.abs(p.F)));
  const Nz_max = Math.max(0, ...pr.filter(p=>p.zug).map(p=>Math.abs(p.F)));
  const xmax = Math.max(Rd, RdZ, Nd_max, Nz_max, 1)*1.16;
  const AMB='var(--warn)', TEAL='#4db8c9';
  const VB=wide?560:272, padL=32, padR=wide?54:14, padTop=30, padBot=34;
  const plotH=wide?300:200, plotW=VB-padL-padR, HB=padTop+plotH+padBot;
  const X=R=>padL+R/xmax*plotW, Y=z=>padTop+z/Math.max(0.01,L)*plotH;
  let s=`<svg viewBox="0 0 ${VB} ${HB}" width="100%" style="display:block">
   <rect width="${VB}" height="${HB}" fill="var(--s2)"/>
   <text x="6" y="13" font-family="var(--f-mono)" font-size="8.5" letter-spacing=".05em" fill="var(--dim)">MANTELREIBUNGSWIDERSTAND ÜBER TIEFE</text>`;
  // Schichtbänder (monochrom, alternierend) + q_s,k-Label
  LY.forEach((l,i)=>{ const y0=Y(l.z0), y1=Y(l.z1);
    s+=`<rect x="${padL}" y="${y0.toFixed(1)}" width="${plotW.toFixed(1)}" height="${Math.max(0,y1-y0).toFixed(1)}" fill="var(--s3)" fill-opacity="${i%2?0.35:0.62}"/>
        <line x1="${padL}" y1="${y0.toFixed(1)}" x2="${(padL+plotW).toFixed(1)}" y2="${y0.toFixed(1)}" stroke="var(--ol)" stroke-width="0.6" stroke-dasharray="3,2"/>
        <text x="${(padL+4).toFixed(1)}" y="${((y0+y1)/2+3).toFixed(1)}" font-family="var(--f-mono)" font-size="7.5" fill="var(--xdim)">${(l.name||l.preset||'Schicht '+(i+1))} · q_s,k=${l.qs} kPa</text>`; });
  // Achsen
  s+=`<line x1="${padL}" y1="${padTop}" x2="${padL}" y2="${(padTop+plotH).toFixed(1)}" stroke="var(--ol2)" stroke-width="1"/>
      <line x1="${padL}" y1="${(padTop+plotH).toFixed(1)}" x2="${(padL+plotW).toFixed(1)}" y2="${(padTop+plotH).toFixed(1)}" stroke="var(--ol2)" stroke-width="1"/>
      <text x="${(padL-3)}" y="${(padTop+4)}" font-family="var(--f-mono)" font-size="7" text-anchor="end" fill="var(--dim)">0</text>
      <text x="${(padL-3)}" y="${(padTop+plotH+3).toFixed(1)}" font-family="var(--f-mono)" font-size="7" text-anchor="end" fill="var(--dim)">${L.toFixed(1)}</text>
      <text x="9" y="${(padTop+plotH/2).toFixed(1)}" font-family="var(--f-mono)" font-size="7.5" text-anchor="middle" fill="var(--dim)" transform="rotate(-90 9 ${(padTop+plotH/2).toFixed(1)})">Tiefe [m]</text>
      <text x="${(padL+plotW/2).toFixed(1)}" y="${(HB-5)}" font-family="var(--f-mono)" font-size="7.5" text-anchor="middle" fill="var(--dim)">kumul. Widerstand R [kN]</text>`;
  // Kumulative Widerstandskurven (linear je Schicht, da q_s,k schichtkonstant)
  let cumD=0, cumZ=0; const pD=[[X(0),Y(0)]], pZ=[[X(0),Y(0)]];
  LY.forEach(l=>{ cumD+=l.dRd; cumZ+=l.dRdZ; pD.push([X(cumD),Y(l.z1)]); pZ.push([X(cumZ),Y(l.z1)]); });
  const poly=(pts,col,dash)=>`<polyline points="${pts.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ')}" fill="none" stroke="${col}" stroke-width="1.8"${dash?' stroke-dasharray="4,2"':''}/>`;
  if(hasZ) s+=poly(pZ,TEAL,true);
  s+=poly(pD,AMB,false);
  s+=`<circle cx="${X(Rd).toFixed(1)}" cy="${Y(L).toFixed(1)}" r="2.6" fill="${AMB}"/>
      <text x="${(X(Rd)-5).toFixed(1)}" y="${(Y(L)-5).toFixed(1)}" font-family="var(--f-mono)" font-size="7.5" text-anchor="end" fill="${AMB}">R_s,d ${Rd.toFixed(0)} kN${hasZ?' Druck':''}</text>`;   // links vom Punkt: rechts lief die Beschriftung aus dem Bild
  if(hasZ) s+=`<circle cx="${X(RdZ).toFixed(1)}" cy="${Y(L).toFixed(1)}" r="2.6" fill="${TEAL}"/>
      <text x="${(X(RdZ)+4).toFixed(1)}" y="${(Y(L)+9).toFixed(1)}" font-family="var(--f-mono)" font-size="7.5" text-anchor="end" fill="${TEAL}">${RdZ.toFixed(0)} kN Zug</text>`;
  // Angesetzte max. Pfahl-Axialkräfte als Vergleichslinien (Druck/Zug)
  const appl=(N,col,lbl,yl)=>N>0.5?`<line x1="${X(N).toFixed(1)}" y1="${padTop}" x2="${X(N).toFixed(1)}" y2="${(padTop+plotH).toFixed(1)}" stroke="${col}" stroke-width="1" stroke-dasharray="2,2"/>
      <text x="${X(N).toFixed(1)}" y="${yl}" font-family="var(--f-mono)" font-size="7" text-anchor="middle" fill="${col}">${lbl} ${N.toFixed(0)}</text>`:'';
  s+=appl(Nd_max,AMB,'|N| Druck',padTop-3);
  s+=appl(Nz_max,TEAL,'|N| Zug',padTop-12);
  return s+`</svg>`;
}

// Stahl: N+M-Interaktionsdiagramm (Tragglied)
function buildPbSteelDiagram(r, n, wide){
  if(!r || !r.pileRes || !r.pileRes.length) return '';
  const S=wide?300:182, VB=wide?440:248, padL=46, padTop=20, padBot=30;
  const HB=padTop+S+padBot, x0=padL, y0=padTop+S;
  const X=u=>x0+Math.min(1.18,u)/1.2*S, Y=v=>y0-Math.min(1.18,v)/1.2*S;
  let s=`<svg viewBox="0 0 ${VB} ${HB}" width="100%" style="display:block">
   <rect width="${VB}" height="${HB}" fill="var(--s2)"/>
   <text x="6" y="13" font-family="var(--f-mono)" font-size="8.5" letter-spacing=".05em" fill="var(--dim)">N+M-INTERAKTION  |N|/R_t,d + |M|/M_Rd ≤ 1</text>
   <line x1="${x0}" y1="${y0}" x2="${X(1.2).toFixed(1)}" y2="${y0}" stroke="var(--ol2)" stroke-width="1"/>
   <line x1="${x0}" y1="${y0}" x2="${x0}" y2="${Y(1.2).toFixed(1)}" stroke="var(--ol2)" stroke-width="1"/>
   <line x1="${X(1).toFixed(1)}" y1="${y0}" x2="${x0}" y2="${Y(1).toFixed(1)}" stroke="var(--fail)" stroke-width="1.3" stroke-dasharray="4,2"/>
   <text x="${X(1).toFixed(1)}" y="${y0+12}" font-family="var(--f-mono)" font-size="7.5" text-anchor="middle" fill="var(--xdim)">1.0</text>
   <text x="${x0-4}" y="${(Y(1)+3).toFixed(1)}" font-family="var(--f-mono)" font-size="7.5" text-anchor="end" fill="var(--xdim)">1.0</text>
   <text x="${((x0+X(1.2))/2).toFixed(1)}" y="${y0+24}" font-family="var(--f-mono)" font-size="8" text-anchor="middle" fill="var(--dim)">M / M_Rd</text>
   <text x="13" y="${((y0+Y(1.2))/2).toFixed(1)}" font-family="var(--f-mono)" font-size="8" text-anchor="middle" fill="var(--dim)" transform="rotate(-90 13 ${((y0+Y(1.2))/2).toFixed(1)})">|N| / R_t,d</text>`;
  let govDone=false;   // gleich ausgenutzte Pfähle liegen aufeinander → nur einmal beschriften
  r.pileRes.forEach((p,i)=>{ const un=Math.abs(p.F)/Math.max(0.01,r.Rt_d), um=Math.abs(p.Mp)/Math.max(0.01,r.M_Rd);
    const cx=X(um), cy=Y(un), gov=(p.eSteel===r.etaSteel), col=_pbE(p.eSteel);
    s+=`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${gov?4.6:3}" fill="${col}" stroke="var(--s2)" stroke-width="0.8"/>`;
    if(gov && !govDone){ govDone=true; const gl=r.pileRes.map((q,j)=>q.eSteel===r.etaSteel?'P'+(j+1):null).filter(Boolean).join(', ');
      s+=`<text x="${(cx+6).toFixed(1)}" y="${(cy+3).toFixed(1)}" font-family="var(--f-mono)" font-size="7.5" fill="${col}">${gl} · η = ${(+r.etaSteel).toFixed(2)}</text>`; } });
  return s+`</svg>`;
}

// Knicken: SIA-263-Knickkurve χ(λ̄) mit Betriebspunkt (Euler-Referenz gestrichelt)
function buildPbKnickDiagram(r, n, wide){
  if(!r || !isFinite(r.lamBar)) return '';
  const lam=r.lamBar, chi=r.chi, alpha=0.49, lamMax=Math.max(2.0, lam*1.18);
  const VB=wide?440:248, HB=wide?300:206, padL=30, padR=12, padT=22, padB=28;
  const x0=padL, y0=HB-padB, pw=VB-padL-padR, ph=HB-padT-padB;
  const X=l=>x0+Math.min(l,lamMax)/lamMax*pw, Y=c=>y0-Math.min(c,1.05)/1.1*ph;
  const chiF=l=>{ if(l<=0.2) return 1; const P=0.5*(1+alpha*(l-0.2)+l*l); return Math.min(1,1/(P+Math.sqrt(Math.max(0,P*P-l*l)))); };
  const eul=l=>l>0.25?Math.min(1.08,1/(l*l)):1.08;
  let cv='', ev='';
  for(let i=0;i<=60;i++){ const l=i/60*lamMax; cv+=`${X(l).toFixed(1)},${Y(chiF(l)).toFixed(1)} `; ev+=`${X(l).toFixed(1)},${Y(eul(l)).toFixed(1)} `; }
  const eC=_pbE(r.etaKnick);
  let grid='';
  for(let l=0;l<=lamMax+0.01;l+=0.5){ const gx=X(l); grid+=`<line x1="${gx.toFixed(1)}" y1="${padT}" x2="${gx.toFixed(1)}" y2="${y0}" stroke="var(--ol)" stroke-width="0.4" stroke-dasharray="1,2"/>
    <text x="${gx.toFixed(1)}" y="${y0+10}" font-family="var(--f-mono)" font-size="6.5" text-anchor="middle" fill="var(--xdim)">${l.toFixed(1)}</text>`; }
  for(const c of [0.5,1.0]){ const gy=Y(c); grid+=`<line x1="${x0}" y1="${gy.toFixed(1)}" x2="${VB-padR}" y2="${gy.toFixed(1)}" stroke="var(--ol)" stroke-width="0.4" stroke-dasharray="1,2"/>
    <text x="${x0-3}" y="${(gy+2).toFixed(1)}" font-family="var(--f-mono)" font-size="6.5" text-anchor="end" fill="var(--xdim)">${c.toFixed(1)}</text>`; }
  const px=X(lam), py=Y(chi);
  // Katalog-Stäbe als Punkte auf der Kurve (gewählter ausgeschlossen — separater Hauptpunkt)
  let dots='';
  (r.knickAll||[]).forEach(b=>{ if(b.sel || !isFinite(b.lam)) return;
    dots+=`<circle cx="${X(b.lam).toFixed(1)}" cy="${Y(b.chi).toFixed(1)}" r="1.9" fill="var(--dim)" fill-opacity="0.7"><title>${b.sys} ${b.bez}: λ̄=${b.lam.toFixed(2)}, χ=${b.chi.toFixed(2)}</title></circle>`; });
  const nAll=(r.knickAll||[]).length;
  return `<svg viewBox="0 0 ${VB} ${HB}" width="100%" style="display:block">
   <rect width="${VB}" height="${HB}" fill="var(--s2)"/>
   <text x="${VB/2}" y="13" font-family="var(--f-mono)" font-size="8" letter-spacing=".05em" text-anchor="middle" fill="var(--dim)">KNICKKURVE SIA 263 (Kurve c, α=0.49)</text>
   ${grid}
   <line x1="${x0}" y1="${padT}" x2="${x0}" y2="${y0}" stroke="var(--dim)" stroke-width="0.7"/>
   <line x1="${x0}" y1="${y0}" x2="${VB-padR}" y2="${y0}" stroke="var(--dim)" stroke-width="0.7"/>
   <polyline points="${ev}" fill="none" stroke="var(--xdim)" stroke-width="1" stroke-dasharray="3,2"/>
   <polyline points="${cv}" fill="none" stroke="var(--acc)" stroke-width="1.6"/>
   ${dots}
   <line x1="${px.toFixed(1)}" y1="${y0}" x2="${px.toFixed(1)}" y2="${py.toFixed(1)}" stroke="${eC}" stroke-width="0.7" stroke-dasharray="2,2"/>
   <line x1="${x0}" y1="${py.toFixed(1)}" x2="${px.toFixed(1)}" y2="${py.toFixed(1)}" stroke="${eC}" stroke-width="0.7" stroke-dasharray="2,2"/>
   <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3.2" fill="${eC}"/>
   <text x="${(px+5).toFixed(1)}" y="${(py-4).toFixed(1)}" font-family="var(--f-mono)" font-size="7" fill="${eC}">λ̄=${lam.toFixed(2)} · χ=${chi.toFixed(2)}</text>
   <text x="${VB-padR}" y="${(padT+8).toFixed(1)}" font-family="var(--f-mono)" font-size="6.5" text-anchor="end" fill="var(--xdim)">Euler 1/λ̄²</text>
   ${nAll>1?`<g><circle cx="${(x0+8).toFixed(1)}" cy="${(y0-13).toFixed(1)}" r="1.9" fill="var(--dim)" fill-opacity="0.7"/><text x="${(x0+13).toFixed(1)}" y="${(y0-10.5).toFixed(1)}" font-family="var(--f-mono)" font-size="6.5" fill="var(--xdim)">${nAll} Tragglieder im Katalog · ● gewählt</text></g>`:''}
   <text x="${(x0+6).toFixed(1)}" y="${(padT-2+ph*0.5).toFixed(1)}" font-family="var(--f-mono)" font-size="6.5" fill="var(--dim)" transform="rotate(-90 ${(x0-18).toFixed(1)} ${(padT+ph*0.5).toFixed(1)})">χ</text>
   <text x="${(VB-padR-2).toFixed(1)}" y="${(y0-3).toFixed(1)}" font-family="var(--f-mono)" font-size="6.5" text-anchor="end" fill="var(--dim)">λ̄</text>
   </svg>`;
}

// Schnittgrössen des massgebenden Pfahls: Verformung y(z) | Querkraft V(z) | Moment M(z)
// aus dem p-y-FE-Profil (je Einheits-Laterallast) × reale Lateral-Kopfkraft FLatMax
function buildPbSchnittSVG(r, n, wide){
  const prof=r.pyProfile; if(!prof || prof.length<4) return '';
  const sc=r.FLatMax||0; if(sc<1e-6) return '';
  const e=Math.max(0,r.e||0), L=r.L||6, Mrd=r.M_Rd||0, etaS=r.etaSteel;
  const eC=etaCol(etaS);
  const py=prof.map(p=>({z:p.z, v:p.y_mm*sc})), pV=prof.map(p=>({z:p.z, v:(p.V||0)*sc})), pM=prof.map(p=>({z:p.z, v:(p.M||0)*sc}));
  const yMx=Math.max(1e-3,...py.map(p=>Math.abs(p.v))), VMx=Math.max(1e-3,...pV.map(p=>Math.abs(p.v)));
  const MMx=Math.max(1e-3,...pM.map(p=>Math.abs(p.v))), MScale=Math.max(MMx, Mrd*1.05);
  const Mgov=pM.reduce((a,p)=>Math.abs(p.v)>Math.abs(a.v)?p:a,{v:0,z:0});
  const yGov=py.reduce((a,p)=>Math.abs(p.v)>Math.abs(a.v)?p:a,{v:0,z:py[0].z});   // max Verformung
  const vGov=pV.reduce((a,p)=>Math.abs(p.v)>Math.abs(a.v)?p:a,{v:0,z:pV[0].z});   // max Querkraft
  const VB=wide?520:248, HB=wide?420:300, PADL=18,PADR=8,PADT=42,PADB=26, ph=HB-PADT-PADB, pw=VB-PADL-PADR, cw=pw/3;
  const axc=i=>PADL+cw*(i+0.5), depY=z=>PADT+((z+e)/(e+L))*ph, gokY=depY(0);
  const S=(v,mx)=>v/mx*cw*0.40;
  const curve=(pts,ax,mx,col,fill)=>{ const lp=pts.map(p=>`${(ax+S(p.v,mx)).toFixed(1)},${depY(p.z).toFixed(1)}`).join(' ');
    return (fill?`<polygon points="${ax},${depY(pts[0].z).toFixed(1)} ${lp} ${ax},${depY(pts[pts.length-1].z).toFixed(1)}" fill="${col}" fill-opacity="0.13"/>`:'')+
      `<polyline points="${lp}" fill="none" stroke="${col}" stroke-width="1.5"/>`; };
  let ticks=''; const stp=L<=2?0.5:1;
  for(let z=0;z<=L+0.01;z+=stp){ const ty=depY(z);
    ticks+=`<line x1="${PADL-1}" y1="${ty.toFixed(1)}" x2="${PADL+3}" y2="${ty.toFixed(1)}" stroke="var(--dim)" stroke-width="0.7"/>
      <text x="${PADL-3}" y="${(ty+3).toFixed(1)}" font-family="var(--f-mono)" font-size="6.5" fill="var(--xdim)" text-anchor="end">${z.toFixed(z%1?1:0)}</text>`; }
  const aM=axc(2), mLim=S(Mrd,MScale), mLimOK=Mrd>0 && mLim<cw*0.46;
  return `<svg viewBox="0 0 ${VB} ${HB}" width="100%" style="display:block">
   <rect width="${VB}" height="${HB}" fill="var(--s2)"/>
   <text x="${VB/2}" y="13" font-family="var(--f-mono)" font-size="8" letter-spacing=".05em" text-anchor="middle" fill="var(--dim)">SCHNITTGRÖSSEN PFAHL — p-y-BETTUNG (massg. P${(r.govLatPile??0)+1})</text>
   <text x="${VB/2}" y="24" font-family="var(--f-mono)" font-size="7" text-anchor="middle" fill="var(--xdim)">H_lat = ${sc.toFixed(1)} kN · e = ${e.toFixed(1)} m · L = ${L.toFixed(1)} m</text>
   <rect x="${PADL}" y="${gokY.toFixed(1)}" width="${pw}" height="${(depY(L)-gokY).toFixed(1)}" fill="var(--dim)" fill-opacity="0.05"/>
   ${[1,2].map(i=>`<line x1="${(PADL+cw*i).toFixed(1)}" y1="${PADT-6}" x2="${(PADL+cw*i).toFixed(1)}" y2="${PADT+ph+3}" stroke="var(--ol)" stroke-width="0.7" stroke-dasharray="3,2"/>`).join('')}
   ${[0,1,2].map(i=>`<line x1="${axc(i).toFixed(1)}" y1="${PADT}" x2="${axc(i).toFixed(1)}" y2="${PADT+ph}" stroke="var(--dim)" stroke-width="0.6" stroke-dasharray="2,2"/>`).join('')}
   <line x1="${PADL}" y1="${gokY.toFixed(1)}" x2="${VB-PADR}" y2="${gokY.toFixed(1)}" stroke="var(--dim)" stroke-width="0.8"/>
   <text x="${VB-PADR}" y="${(gokY-2).toFixed(1)}" font-family="var(--f-mono)" font-size="6.5" text-anchor="end" fill="var(--dim)">GOK</text>
   <text x="${axc(0).toFixed(1)}" y="${PADT-7}" font-family="var(--f-mono)" font-size="7.5" text-anchor="middle" fill="var(--acc)">y [mm]</text>
   <text x="${axc(1).toFixed(1)}" y="${PADT-7}" font-family="var(--f-mono)" font-size="7.5" text-anchor="middle" fill="#4db8c9">V [kN]</text>
   <text x="${axc(2).toFixed(1)}" y="${PADT-7}" font-family="var(--f-mono)" font-size="7.5" text-anchor="middle" fill="${eC}">M [kNm]</text>
   ${ticks}
   ${curve(py,axc(0),yMx,'var(--acc)',true)}
   <circle cx="${(axc(0)+S(yGov.v,yMx)).toFixed(1)}" cy="${depY(yGov.z).toFixed(1)}" r="2.4" fill="var(--acc)"/>
   ${curve(pV,axc(1),VMx,'#4db8c9',false)}
   <circle cx="${(axc(1)+S(vGov.v,VMx)).toFixed(1)}" cy="${depY(vGov.z).toFixed(1)}" r="2.4" fill="#4db8c9"/>
   ${mLimOK?`<line x1="${(aM+mLim).toFixed(1)}" y1="${PADT}" x2="${(aM+mLim).toFixed(1)}" y2="${PADT+ph}" stroke="${eC}" stroke-width="0.8" stroke-dasharray="3,2"/>
   <line x1="${(aM-mLim).toFixed(1)}" y1="${PADT}" x2="${(aM-mLim).toFixed(1)}" y2="${PADT+ph}" stroke="${eC}" stroke-width="0.8" stroke-dasharray="3,2"/>
   <text x="${(aM+mLim).toFixed(1)}" y="${(PADT+ph+9).toFixed(1)}" font-family="var(--f-mono)" font-size="6" text-anchor="middle" fill="${eC}">M_Rd</text>`:''}
   ${curve(pM,axc(2),MScale,eC,true)}
   <circle cx="${(aM+S(Mgov.v,MScale)).toFixed(1)}" cy="${depY(Mgov.z).toFixed(1)}" r="2.6" fill="${eC}"/>
   <text x="${axc(0).toFixed(1)}" y="${(PADT+ph+17).toFixed(1)}" font-family="var(--f-mono)" font-size="6.5" text-anchor="middle" fill="var(--acc)">y_max ${Math.abs(yGov.v).toFixed(1)}</text>
   <text x="${axc(1).toFixed(1)}" y="${(PADT+ph+17).toFixed(1)}" font-family="var(--f-mono)" font-size="6.5" text-anchor="middle" fill="#4db8c9">V_max ${Math.abs(vGov.v).toFixed(1)}</text>
   <text x="${axc(2).toFixed(1)}" y="${(PADT+ph+17).toFixed(1)}" font-family="var(--f-mono)" font-size="6.5" text-anchor="middle" fill="${eC}">M_max ${Math.abs(Mgov.v).toFixed(1)}</text>
   </svg>`;
}

// Systemverformung (Elevation quer, überhöht): Bankett-Rotation + Pfahl-Axialkräfte (Druck/Zug)
function buildPbSystemSVG(r, piles, n, wide){
  if(!piles || !piles.length || !r.gzgFull) return '';
  const g=r.gzgFull, e=Math.max(0,r.e||0), L=r.L||6;
  // GZG-Nachweis → durchgängig die massgebende CHARAKTERISTISCHE (GZG) Lösung zeigen:
  // Pfahl-Axialkräfte, Verdrehung und Sway aus gzgFull.sol (nicht die ULS-Bemessungslösung).
  const sol = (g.sol && g.sol.F) ? g.sol : r.uls;
  if(!sol) return '';
  const F=sol.F, q=sol.q;
  // Pfähle auf x-Spalten projizieren (Elevation in Querrichtung)
  const m=new Map();
  piles.forEach((p,i)=>{ const k=(+p.x).toFixed(3), cur=m.get(k);
    if(!cur || Math.abs(F[i])>Math.abs(cur.F)) m.set(k,{x:+p.x, ax:p.axDeg||0, F:F[i]}); });
  const cols=[...m.values()].sort((a,b)=>a.x-b.x);
  cols.forEach(c=>{ c.footx=c.x + L*Math.sin((c.ax)*Math.PI/180); });
  const xall=[...cols.map(c=>c.x),...cols.map(c=>c.footx)];
  const xmin=Math.min(...xall), xmax=Math.max(...xall), xc=(xmin+xmax)/2;
  const VB=wide?470:264, HB=wide?400:322, PADL=30, PADR=14, PADT=58, PADB=24;
  const plotW=VB-PADL-PADR, plotH=HB-PADT-PADB;
  const sc=Math.min(plotW/Math.max(0.6,(xmax-xmin)+0.5), plotH/Math.max(0.6,e+L+0.3));
  const cx0=PADL+plotW/2;                                  // horizontale Plotmitte
  const X=x=>cx0+(x-xc)*sc, Y=z=>PADT+(z+e)*sc;
  const dir=(q[4]>=0?1:-1), visT=9*Math.PI/180*dir;       // Verdrehung überhöht auf 9° zur Anschauung
  const cxp=X(xc), cyp=Y(-e);
  const rot=(px,py)=>{ const dx=px-cxp, dy=py-cyp;
    return [cxp+dx*Math.cos(visT)-dy*Math.sin(visT), cyp+dx*Math.sin(visT)+dy*Math.cos(visT)]; };
  const colC=f=>f>=0?'var(--warn)':'#4db8c9';             // Druck (warn) / Zug (teal)
  const gy=Y(0), capY0=Y(-e), tilt=1000*g.tiltQuer;
  let ticks=''; const stp=L<=2?0.5:1;                     // Tiefenachse
  for(let z=0;z<=L+0.01;z+=stp){ const ty=Y(z);
    ticks+=`<line x1="${(PADL-3).toFixed(1)}" y1="${ty.toFixed(1)}" x2="${PADL}" y2="${ty.toFixed(1)}" stroke="var(--dim)" stroke-width="0.7"/>
      <text x="${(PADL-5).toFixed(1)}" y="${(ty+2.4).toFixed(1)}" font-family="var(--f-mono)" font-size="6" text-anchor="end" fill="var(--xdim)">${z.toFixed(z%1?1:0)}</text>`; }
  let s=`<svg viewBox="0 0 ${VB} ${HB}" width="100%" style="display:block">
   <rect width="${VB}" height="${HB}" fill="var(--s2)"/>
   <text x="${VB/2}" y="12" font-family="var(--f-mono)" font-size="8" letter-spacing=".05em" text-anchor="middle" fill="var(--dim)">SYSTEMVERFORMUNG QUER</text>
   <text x="${VB/2}" y="23" font-family="var(--f-mono)" font-size="7" text-anchor="middle" fill="var(--xdim)">θ = ${tilt.toFixed(1)} ‰ (char.) · <tspan fill="var(--warn)">Druck</tspan> / <tspan fill="#4db8c9">Zug</tspan> [kN] · überhöht</text>
   <rect x="${PADL}" y="${(PADT-3).toFixed(1)}" width="${plotW.toFixed(1)}" height="${(HB-PADB-PADT+3).toFixed(1)}" fill="none" stroke="var(--ol)" stroke-width="0.6"/>
   <rect x="${PADL}" y="${gy.toFixed(1)}" width="${plotW.toFixed(1)}" height="${(HB-PADB-gy).toFixed(1)}" fill="var(--dim)" fill-opacity="0.05"/>
   <line x1="${PADL}" y1="${gy.toFixed(1)}" x2="${(PADL+plotW).toFixed(1)}" y2="${gy.toFixed(1)}" stroke="var(--dim)" stroke-width="0.8" stroke-dasharray="4,3"/>
   <text x="${(PADL+plotW-2).toFixed(1)}" y="${(gy-2).toFixed(1)}" font-family="var(--f-mono)" font-size="6.5" text-anchor="end" fill="var(--dim)">GOK</text>
   <line x1="${PADL}" y1="${PADT.toFixed(1)}" x2="${PADL}" y2="${(HB-PADB).toFixed(1)}" stroke="var(--ol2)" stroke-width="0.8"/>
   <text x="9" y="${(PADT+plotH/2).toFixed(1)}" font-family="var(--f-mono)" font-size="7" text-anchor="middle" fill="var(--dim)" transform="rotate(-90 9 ${(PADT+plotH/2).toFixed(1)})">Tiefe [m]</text>
   ${ticks}`;
  // ── Unverformtes Referenzsystem (gestrichelt, grau)
  s+=`<line x1="${X(xmin).toFixed(1)}" y1="${capY0.toFixed(1)}" x2="${X(xmax).toFixed(1)}" y2="${capY0.toFixed(1)}" stroke="var(--xdim)" stroke-width="1.3" stroke-dasharray="3,2" opacity="0.55"/>`;
  cols.forEach(c=>{ s+=`<line x1="${X(c.x).toFixed(1)}" y1="${capY0.toFixed(1)}" x2="${X(c.footx).toFixed(1)}" y2="${Y(L).toFixed(1)}" stroke="var(--xdim)" stroke-width="0.9" stroke-dasharray="3,2" opacity="0.5"/>`; });
  s+=`<text x="${(X(xmin)).toFixed(1)}" y="${(capY0-4).toFixed(1)}" font-family="var(--f-mono)" font-size="6" fill="var(--xdim)">unverformt</text>`;
  // ── Verformtes System: Bankett rotiert (Verdrehung) + horizontal verschoben (Sway),
  //    Pfähle als laterale Auslenkung zwischen verschobenem Kopf und ~festem Fuss.
  //    Verformungsfigur aus DEMSELBEN freien-Kopf-p-y-Profil wie Berechnung/Schnittgrössen
  //    (Konsistenz Berechnung↔Darstellung); Horizontalverschiebung selbst steckt in q[0].
  const ux = q[0] || 0;                                    // laterale Kopfverschiebung x (ULS-Kombo)
  const spF = (r.pyProfile && r.pyProfile.length > 3) ? r.pyProfile : null;
  const yH  = spF ? (spF[0].y_mm || 1e-9) : 1;             // Kopfwert (z=−e) zur Normierung
  // Überhöhte, illustrative Sway-Amplitude (wie die 9°-Verdrehung rein zur Anschauung)
  const driftPx = Math.abs(ux) < 1e-7 ? 0 : Math.sign(ux) * ((xmax-xmin)+0.4) * sc * 0.18;
  const sway = spF && Math.abs(driftPx) > 0.5;
  const [bx1,by1]=rot(X(xmin),capY0), [bx2,by2]=rot(X(xmax),capY0);
  // Verdrehungswinkel θ am Bankettzentrum (Bogen zwischen unverformt-horizontal und rotiert)
  const rA=Math.min(20, (xmax-xmin)*sc*0.34+8);
  s+=`<path d="M ${(cxp+rA+driftPx).toFixed(1)} ${cyp.toFixed(1)} A ${rA} ${rA} 0 0 ${visT>=0?1:0} ${(cxp+rA*Math.cos(visT)+driftPx).toFixed(1)} ${(cyp+rA*Math.sin(visT)).toFixed(1)}" fill="none" stroke="var(--on2)" stroke-width="0.8"/>
      <text x="${(cxp+rA+driftPx+3).toFixed(1)}" y="${(cyp+ (visT>=0?7:-3)).toFixed(1)}" font-family="var(--f-mono)" font-size="6.5" fill="var(--on2)">θ</text>`;
  s+=`<line x1="${(bx1+driftPx).toFixed(1)}" y1="${by1.toFixed(1)}" x2="${(bx2+driftPx).toFixed(1)}" y2="${by2.toFixed(1)}" stroke="var(--on)" stroke-width="3" stroke-linecap="round"/>`;
  cols.forEach(c=>{ const [hx,hy]=rot(X(c.x),capY0), fx=X(c.footx), fy=Y(L), headX=hx+driftPx;
    if(sway){
      const pts=spF.map(p=>{ const t=Math.min(1,Math.max(0,(p.z+e)/(e+L)));
        const baseX=hx+(fx-hx)*t, baseY=hy+(fy-hy)*t, off=(p.y_mm/yH)*driftPx;
        return `${(baseX+off).toFixed(1)},${baseY.toFixed(1)}`; }).join(' ');
      s+=`<polyline points="${pts}" fill="none" stroke="${colC(c.F)}" stroke-width="2.4"/>`;
    } else {
      s+=`<line x1="${headX.toFixed(1)}" y1="${hy.toFixed(1)}" x2="${fx.toFixed(1)}" y2="${fy.toFixed(1)}" stroke="${colC(c.F)}" stroke-width="2.4"/>`;
    }
    s+=`<circle cx="${headX.toFixed(1)}" cy="${hy.toFixed(1)}" r="2.6" fill="${colC(c.F)}"/>
      <text x="${fx.toFixed(1)}" y="${(fy+10).toFixed(1)}" font-family="var(--f-mono)" font-size="7" text-anchor="middle" fill="${colC(c.F)}">${c.F<0?'−':''}${Math.abs(c.F).toFixed(0)}</text>`; });
  // ── Horizontalverschiebung quer aufgeteilt: Anteil aus HORIZONTALLAST (H) + aus MOMENT (M),
  //    als Tip-to-Tail-Vektorkette (macht die Kompensation sichtbar: gekoppelt gegensinnig →
  //    Resultierende klein; entkoppelt M-Anteil ≈ 0). Zahlen real (mm), Länge illustrativ skaliert.
  const uH=(sol.uH!=null)?sol.uH:0, uM=(sol.uM!=null)?sol.uM:0, uR=uH+uM;   // [mm]
  if(Math.abs(uH)+Math.abs(uM) > 0.003){
    const budget=(wide?120:82), ppm=budget/(Math.abs(uH)+Math.abs(uM)+1e-3), yD=44;
    let ox=cxp, xH=ox+uH*ppm, xR=xH+uM*ppm;
    const lo=Math.min(ox,xH,xR), hi=Math.max(ox,xH,xR), off=cxp-(lo+hi)/2;   // Kette um cxp zentrieren
    ox+=off; xH+=off; xR+=off;
    const MCOL='#b07cd0';
    const seg=(x0,x1,col)=>Math.abs(x1-x0)<0.5?'':`<line x1="${x0.toFixed(1)}" y1="${yD}" x2="${x1.toFixed(1)}" y2="${yD}" stroke="${col}" stroke-width="1.7"/>`
      +(Math.abs(x1-x0)>3?`<path d="M ${x1.toFixed(1)} ${yD} l ${(x1>x0?-4:4)} -2.6 v5.2 z" fill="${col}"/>`:'');
    const rEnd=Math.max(ox,xH,xR)+5;   // rechter Rand der Kette (nach Zentrierung)
    s+=`<line x1="${ox.toFixed(1)}" y1="${(yD-5).toFixed(1)}" x2="${ox.toFixed(1)}" y2="${(yD+5).toFixed(1)}" stroke="var(--xdim)" stroke-width="0.7"/>`;
    s+=seg(ox,xH,'var(--acc)') + seg(xH,xR,MCOL);
    s+=`<text x="${((ox+xH)/2).toFixed(1)}" y="${(yD-4).toFixed(1)}" font-family="var(--f-mono)" font-size="6.5" text-anchor="middle" fill="var(--acc)">aus H ${Math.abs(uH).toFixed(1)}</text>`;
    s+=`<text x="${((xH+xR)/2).toFixed(1)}" y="${(yD-11.5).toFixed(1)}" font-family="var(--f-mono)" font-size="6.5" text-anchor="middle" fill="${MCOL}">aus M ${Math.abs(uM).toFixed(1)}</text>`;
    s+=`<text x="${rEnd.toFixed(1)}" y="${(yD+3).toFixed(1)}" font-family="var(--f-mono)" font-size="6.5" text-anchor="start" fill="var(--on)">Σ=${uR>=0?'':'−'}${Math.abs(uR).toFixed(1)} mm</text>`;
  }
  return s+`</svg>`;
}

function _pbResultHTML(r, piles, n){
  if(!r || !r.uls) return '<div style="color:var(--fail);font-size:11px">Berechnung nicht möglich — Eingaben prüfen.</div>';
  const cV=e=>etaCol(e);
  const row=(l,v)=>`<div class="nw-row"><span>${l}</span><span>${v}</span></div>`;
  // Anklickbare Zeile mit Aufschlüsselung (gleicher Mechanismus wie Block: toggleGZTFormula)
  const rowD=(l,v,detail)=>detail
    ? `<div class="nw-row clickable" onclick="toggleGZTFormula(null,this)"><span>${l} <span style="color:var(--xdim);font-size:9px">▸</span></span><span>${v}</span></div><div class="nw-row-formula"><div class="f-num">${detail}</div></div>`
    : row(l,v);
  const etaRow=(l,e,detail)=>detail
    ? `<div class="nw-row clickable" style="font-weight:600" onclick="toggleGZTFormula(null,this)"><span>${l} <span style="color:var(--xdim);font-size:9px">▸</span></span><span style="color:${cV(e)}">η = ${isFinite(e)?e.toFixed(2):'∞'}</span></div><div class="nw-row-formula"><div class="f-num">${detail}</div></div>`
    : `<div class="nw-row" style="font-weight:600"><span>${l}</span><span style="color:${cV(e)}">η = ${isFinite(e)?e.toFixed(2):'∞'}</span></div>`;
  const cardHd=nwCardHd, CARD_END=NW_CARD_END;   // gemeinsame Nachweis-Karte
  // ── Diagramm-Daten registrieren (Expand via toggleGZTExpand, gleicher Mechanismus wie Block)
  window['_pbdiag_axial']  ={R:r,n:n,fn:'buildPbAxialDiagram'};
  window['_pbdiag_schnitt']={R:r,n:n,fn:'buildPbSchnittSVG'};
  window['_pbdiag_steel']  ={R:r,n:n,fn:'buildPbSteelDiagram'};
  window['_pbdiag_knick']  ={R:r,n:n,fn:'buildPbKnickDiagram'};
  window['_pbdiag_system'] ={R:r,n:n,piles:piles,fn:'buildPbSystemSVG'};
  const diagWrap=(key,svg)=>svg?`<div class="gzt-diagram" style="position:relative;margin-top:6px;border-radius:var(--r1);overflow:hidden;border:1px solid var(--ol)" data-gzt-key="${key}">
    <button onclick="toggleGZTExpand(event,'${key}')" title="Vergrössern" style="position:absolute;top:5px;right:6px;z-index:2;background:var(--s3);border:1px solid var(--ol2);border-radius:3px;cursor:pointer;color:var(--dim);padding:1px 6px;font-size:11px;line-height:1.5">${_gztExpanded?'✕':'⤢'}</button>
    ${svg}</div>`:'';
  // ── massgebenden Nachweis identifizieren
  const govName=(()=>{ const m=r.eta_massg;
    if(m===r.etaGeo || (r.etaTors!=null && m===r.etaTors) || (r.etaAuf!=null && m===r.etaAuf)) return 'Geo'; if(m===r.etaSteel) return 'Stahl';
    if(m===r.etaKnick) return 'Knick'; if(r.etaLat!=null && m===r.etaLat) return 'Lat';
    if(m===r.etaGZG) return 'GZG'; return ''; })();
  const gL=r.govLoad||{}, Hd=Math.hypot(gL.Hx||0, gL.Hy||0);   // Sohlkräfte massg. Kombo (UK Bankett)
  const govF=r.govPile>=0?Math.abs(r.pileRes[r.govPile]?.F||0):0;
  const govZug=r.govPile>=0 && !!r.pileRes[r.govPile]?.zug;
  const gRv=r.gMD||1.3;   // γ_M,a Druck (SIA 267 Gl. 43)
  const _aTxt='η_a = '+(r.etaA||0.7).toFixed(2)+' · γ_M,a = '+(r.gMD||1.3).toFixed(2)+' Druck / '+(r.gMZ||1.6).toFixed(2)+' Zug';
  const RdGeo = govZug ? r.Rskin_dZ : +(r.Rskin_d + (r.Rb_d||0)).toFixed(1);   // Zug: nur Mantel · Druck: Mantel + Spitze
  const etaGeoK = Math.min(r.etaGeo, r.etaTors!=null ? r.etaTors : Infinity, r.etaAuf!=null ? r.etaAuf : Infinity);
  const g=r.gzgFull, gv=r.gzgVar;
  const shortLF=s=>/quer/i.test(s||'')?'quer':/l(ä|ae)ngs/i.test(s||'')?'längs':(s||'').replace(/\s*·.*/,'').slice(0,10);
  const pll=r.pileRes.map((p,i)=>{ const eg=Math.min(p.eGeo,p.eSteel);
    const d=r.pileDecomp&&r.pileDecomp[i];
    const ln=(k,v,note)=>`<div style="display:flex;justify-content:space-between;padding:1px 0"><span style="color:var(--dim)">${k}${note?' <span style="color:var(--xdim)">'+note+'</span>':''}</span><span>${v>=0?'+':''}${(+v).toFixed(1)} kN</span></div>`;
    const detail=d?(`<div style="color:var(--acc);margin-bottom:2px">massgebend: ${d.lf||'—'}</div>`+ln('N (vertikal)',d.parts.N)+ln('aus M_x',d.parts.Mx)+ln('aus M_y',d.parts.My)+ln('aus H_x',d.parts.Hx,'(über Neigung α)')+ln('aus H_y',d.parts.Hy,'(über Neigung α)')+(Math.abs(d.parts.Mz||0)>0.05?ln('aus Torsion T',d.parts.Mz):'')+
      `<div style="display:flex;justify-content:space-between;border-top:1px solid var(--ol);margin-top:2px;padding-top:2px;color:var(--on2)"><span>Σ = N_Pfahl</span><span>${d.total>=0?'+':''}${d.total.toFixed(1)} kN ${d.total<0?'(Zug)':'(Druck)'}</span></div>`+
      `<div style="display:flex;justify-content:space-between;padding-top:1px"><span style="color:var(--dim)">η_Geo = R_s,d / |N|</span><span style="color:${cV(p.eGeo)}">${(p.zug?r.Rskin_dZ:r.Rskin_d+(r.Rb_d||0)).toFixed(0)} / ${Math.abs(p.F).toFixed(0)} = ${isFinite(p.eGeo)?p.eGeo.toFixed(2):'∞'}</span></div>`):'(keine Aufschlüsselung)';
    return `<div class="nw-row clickable" onclick="toggleGZTFormula(null,this)">
        <span>P${i+1} <span style="color:var(--xdim);font-size:9px">▸ ${shortLF(p.lf)}</span></span>
        <span>N = ${p.F} kN (${p.zug?'Zug':'Druck'}) · M = ${p.Mp} kNm · η = ${isFinite(eg)?eg.toFixed(2):'∞'}</span>
      </div><div class="nw-row-formula"><div class="f-num">${detail}</div></div>`; }).join('');
  // ── Mantelreibungswiderstand je Schicht (Drill-down): q_s,k · U · Δz → ΔR, aufsummiert
  const skL=r.skinLayers||[];
  const skRow=(k,v,note)=>`<div style="display:flex;justify-content:space-between;padding:1px 0"><span style="color:var(--dim)">${k}${note?' <span style="color:var(--xdim)">'+note+'</span>':''}</span><span>${v}</span></div>`;
  const skinDetail = skL.length
    ? skL.map((l,i)=>skRow(`${l.name||l.preset||'Schicht '+(i+1)} · z ${l.z0}–${l.z1} m`, `+${l.dRk.toFixed(1)} kN`, `q_s,k=${l.qs} kPa · Δz=${l.dz} m`)).join('')
      + `<div style="display:flex;justify-content:space-between;border-top:1px solid var(--ol);margin-top:2px;padding-top:2px;color:var(--on2)"><span>Σ R_s,k (Druck · η_g=${(r.grpEta||1).toFixed(2)})</span><span>${(r.Rskin_k||0).toFixed(1)} kN</span></div>`
      + skRow('R_s,d = η_a·R_s,k / γ_M,a (Druck)', `${(r.Rskin_d||0).toFixed(1)} kN`)
      + (r.zugFac<0.999?skRow(`R_s,d Zug (×${r.zugFac.toFixed(2)}, Herausziehen)`, `${(r.Rskin_dZ||0).toFixed(1)} kN`):skRow('R_s,d Zug (= Druck, zugFac=1)', `${(r.Rskin_dZ||0).toFixed(1)} kN`))
      + `<div style="color:var(--xdim);margin-top:2px">U = π·d_G = ${(Math.PI*(r.dG||0.15)).toFixed(3)} m · q_s,k schichtkonstant (Verpresspfahl)</div>`
    : '(keine Schichtdaten)';
  // ── Innerer Widerstand Tragglied (Drill-down): Herleitung R_t,d (Stahl axial) + M_Rd (Biegung) + N+M
  const stP = r.pileRes.find(p=>p.eSteel===r.etaSteel) || r.pileRes[0] || {F:0,Mp:0};
  const NEd = Math.abs(stP.F||0), MEd = Math.abs(stP.Mp||0);
  const un = NEd/Math.max(0.01, r.Rt_d||1), um = MEd/Math.max(0.01, r.M_Rd||1);
  const stI = r.pileRes.indexOf(stP);
  const steelDetail =
      skRow('R_t,k Streckgrenzkraft Tragglied', `${(r.N_pl_k||0).toFixed(0)} kN`, 'Katalog (F_yk bzw. A_s·f_y)')
    + skRow(r.einzel ? 'R_t,d = R_t,k / γ_M1 (Druck/Zug)' : 'R_t,d = η_i·R_t,k / γ_s (Druck/Zug)', `${(r.Rt_d||0).toFixed(1)} kN`, r.einzel ? `γ_M1=${(r.gammaS||1.05).toFixed(2)} (SIA 263)` : `η_i=${(r.etaI||0.8).toFixed(2)} · γ_s=${(r.gammaS||1.15).toFixed(2)}`)
    + (r.einzel
      ? skRow('M_Rd quer / längs = W_pl·f_yk/γ_M1', `${r.einzel.MRq.toFixed(1)} / ${r.einzel.MRl.toFixed(1)} kNm`, r.einzel.starkQuer ? 'starke Achse trägt quer' : 'starke Achse trägt längs')
      + skRow('M_Ed quer / längs (Bettungsbalken, H und M am Kopf)', `${r.einzel.Mq.toFixed(1)} / ${r.einzel.Ml.toFixed(1)} kNm`, 'Kopfmoment geht voll in die Biegung ein')
      : skRow('W_pl = (d_a³−d_i³)/6', `${((r.Wpl||0)*1e6).toFixed(1)} cm³`, `d_a=${((r.da||0)*1000).toFixed(0)} · d_i=${((r.di||0)*1000).toFixed(0)} mm`)
      + skRow('M_Rd = η_i·W_pl·f_yk/γ_s', `${(r.M_Rd||0).toFixed(1)} kNm`, `f_yk=${r.fyk||500} N/mm²`)
      + skRow('M_max Pfahl (p-y)', `${(r.Mmax||0).toFixed(1)} kNm`))
    + `<div style="display:flex;justify-content:space-between;border-top:1px solid var(--ol);margin-top:2px;padding-top:2px;color:var(--on2)"><span>massg. Pfahl P${stI+1} · N_Ed / M_Ed</span><span>${NEd.toFixed(1)} kN / ${MEd.toFixed(1)} kNm</span></div>`
    + (r.einzel && r.einzel.T>0.005
      ? skRow('Ausnutzung Normalspannung |N|/R_t,d + ΣM/M_Rd', `${r.einzel.us.toFixed(2)}`)
      + skRow('Torsion T_Ed / T_Rd = W_t·f_yk/(√3·γ_M1)', `${r.einzel.T.toFixed(1)} / ${r.einzel.TRst.toFixed(1)} kNm`, `= ${r.einzel.uT.toFixed(2)}`)
      + skRow('Ausnutzung √(σ-Anteil² + τ-Anteil²)', `${Math.hypot(r.einzel.us, r.einzel.uT).toFixed(2)}`, 'von Mises')
      : skRow('Ausnutzung |N|/R_t,d + |M|/M_Rd', `${(un+um).toFixed(2)}`, `${un.toFixed(2)} + ${um.toFixed(2)}`))
    + skRow('η = 1 / Ausnutzung', `${isFinite(r.etaSteel)?r.etaSteel.toFixed(2):'∞'}`);
  return `
  <div style="font-family:var(--f-mono);font-size:11px">
    <div style="font-size:9px;color:var(--xdim);padding:8px 0 2px">Modell: <span style="color:var(--acc)">${r.einzel ? 'Einzelpfahl · '+(r.skinModel==='ramm'?'gerammtes Stahlprofil':'in Bohrung verpresst') : 'Pfahlfundament · Mikropfahl-Gruppe'}</span> · SIA 267</div>
    ${SCHICHTEN.length>1?`<div style="font-size:9px;color:var(--xdim);padding:0 0 4px">${SCHICHTEN.length} Bodenschichten</div>`:''}

    <div class="summary"><div class="summary-ttl">Massgebend — ${r.govCombo||'—'}</div>
      <div class="kv-grid">
        <div class="kv"><span>N_d</span><span>${(gL.N||0).toFixed(1)} kN</span></div>
        <div class="kv"><span>H_d</span><span>${Hd.toFixed(1)} kN</span></div>
        <div class="kv"><span>M_xd</span><span>${(gL.Mx||0).toFixed(1)} kNm</span></div>
        <div class="kv"><span>M_yd</span><span>${(gL.My||0).toFixed(1)} kNm</span></div>
      </div></div>

    ${r.slopeActive ? wBox('warn', 'Böschung aktiv (β = '+r.slopeBeta.toFixed(0)+'°) — Bettung reduziert',
      `Die laterale Bettung ist talseitig auf <b>${(r.slopeFac*100).toFixed(0)} %</b> reduziert
       (K<sub>p,β</sub>/K<sub>p</sub>${(+gi('bg_bhoehe')||0)>0.05?', h<sub>β</sub>-abgemildert':''}) →
       Verformung und Biegemoment fallen ungünstiger aus. Die <b>globale Standsicherheit (Gleitkreis)</b>
       ist damit NICHT abgedeckt und separat nachzuweisen.`) : ''}

    ${r.headFixReq ? wBox('warn', 'Kollineare Anordnung — biegesteifer Kopfanschluss vorausgesetzt',
      `Die Rotationsstabilität um die Pfahllinie erfordert hier einen <b>biegesteifen Kopfanschluss</b>
       (kRot angesetzt). Bei ≥3 nicht-kollinearen Pfählen rechnet das Modell rein gelenkig (konservativ).`) : ''}

    <!-- Pfahlkräfte-Übersicht — immer sichtbar, Zeile anklicken = Aufschlüsselung -->
    <div style="font-size:9px;color:var(--dim);margin:0 0 3px">Pfahlkräfte ULS (Bemessungswerte) · massgebend je Pfahl über ${r.ulsCombosN||0} Kombinationen &nbsp;<span style="color:var(--xdim)">(N: + Druck / − Zug · Zeile anklicken → Lastanteile + LF)</span></div>
    <div style="margin-bottom:10px">${pll}</div>

    <div class="lf-grp">GZT — Grenzzustand der Tragfähigkeit · ${r.einzel?'Einzelpfahl':'Mikropfahl-Gruppe'}</div>

    ${cardHd(r.Rb_k>0 ? 'Äusserer Tragwiderstand (Mantel + Spitze)' : 'Äusserer Tragwiderstand (Mantelreibung)', etaGeoK, null, govName==='Geo')}
      <div class="nw-formula">q_s,k je Schicht = q_s,Tab/Probebelastung  ODER  Erfahrungswert (EA-Pfähle/DIN 4128, bodenartabh.)  ·  R_s,d = R_s,k/γ_R</div>
      ${row('q_s,k '+(r.qsTab?'(Tab./Erfahrung)':'Erfahrungswert')+', Mittel', r.qsAvg+' kPa')}
      ${r.qsMax>r.qsMin+0.1?row('q_s,k Bereich (je Schicht)', r.qsMin+' … '+r.qsMax+' kPa'):''}
      ${r.grpEta<0.999?row('Gruppenwirkungsgrad η_g (s̄/D='+r.grpSd+')', '×'+r.grpEta.toFixed(2)+' &nbsp;<span style="color:var(--xdim)">s̄='+r.grpSMean+' m (Kopf '+r.grpSCap+' → Fuss '+r.grpSToe+')</span>'):row('Gruppenwirkung (s̄/D='+(isFinite(r.grpSd)?r.grpSd:'∞')+')', 'η_g = 1.00 (gespreizt)')}
      ${rowD('R_s,k Druck (Mantelreibung, η_g)', r.Rskin_k+' kN', skinDetail)}
      ${row('R_s,d = η_a·R_s,k / γ_M,a (Druck)', r.Rskin_d+' kN')}
      ${r.Rb_k>0 ? row('R_b,k = q_b,k·A_b (Spitze, nur Druck)', r.Rb_k+' kN &nbsp;<span style="color:var(--xdim)">'+r.qb+' kPa · '+(r.Ab*1e4).toFixed(0)+' cm²</span>') + row('R_d Druck = η_a·(R_s,k + R_b,k) / γ_M,a', RdGeo+' kN') : ''}
      ${r.zugFac<0.999?row('R_s,d Zug (×'+r.zugFac.toFixed(2)+', Herausziehen)', r.Rskin_dZ+' kN'):''}
      ${r.skinFac<0.999?row('Abminderung Verrohrung', '×'+r.skinFac.toFixed(2)):''}
      ${r.zykFac<0.999?row('Abminderung zyklische Beanspruchung (in R_s,k enthalten)', '×'+r.zykFac.toFixed(2)):''}
      ${row('|N|_max (P'+(r.govPile+1)+', '+(govZug?'Zug':'Druck')+')', govF.toFixed(1)+' kN')}
      ${etaRow('η Geotechnik', r.etaGeo, 'η = '+(r.Rb_k>0&&!govZug?'R_d':'R_s,d')+' '+(govZug?'(Zug)':'(Druck)')+' / |N|_max<br>= '+(+RdGeo).toFixed(0)+' / '+govF.toFixed(0)+' = '+(isFinite(r.etaGeo)?r.etaGeo.toFixed(2):'∞')+'<br>massgebend Pfahl P'+(r.govPile+1))}
      ${r.auf ? row('Aufbruch: Zugkraft Z_d ('+r.auf.nZ+' Zugpf'+(r.auf.nZ>1?'ähle':'ahl')+')', r.auf.Z+' kN')
        + row('angehängter Bodenkörper G_E,k', r.auf.GEk+' kN &nbsp;<span style="color:var(--xdim)">'+r.auf.la+' × '+r.auf.lb+' × '+r.auf.hE+' m · η_Z 0.80 · γ′ '+r.auf.gam+'</span>')
        + etaRow('η Aufbruchsicherheit (SIA 267 Ziff. 9.5.3.3)', r.etaAuf, 'η = 0.90·G_E,k / Z_d = 0.90·'+r.auf.GEk+' / '+r.auf.Z+' = '+r.etaAuf.toFixed(2)+'<br>G_E,k = n_Z·[l_a·l_b·(L − ⅓·√(l_a²+l_b²)·cot φ′)]·η_Z·γ′<br>'+(r.auf.label||'')) : ''}
      ${r.tors ? row('Torsion T_Ed / T_Rd = r_T·R_s,d', r.tors.T+' / '+r.tors.TRgeo+' kNm &nbsp;<span style="color:var(--xdim)">r_T = '+(r.tors.rT*1000).toFixed(0)+' mm</span>')
        + etaRow('η Torsion (Mantelreibung, mit N überlagert)', r.etaTors, 'η = 1 / √((|N|/R_d)² + (T/T_Rd)²)<br>= 1 / √('+r.tors.uN.toFixed(2)+'² + '+r.tors.uT.toFixed(2)+'²) = '+(isFinite(r.etaTors)?r.etaTors.toFixed(2):'∞')+'<br>'+(r.tors.label||'')) : ''}
      <div style="font-size:9px;color:var(--xdim);margin-top:2px">${r.skinModel==='ramm' ? 'Gerammtes/eingedrehtes Stahlprofil ohne Verpresskörper: q_s(z) = K₀·σ′v·tan(⅔·φ′) am Profilumriss (tiefenabhängig, Kohäsion nicht angesetzt'+(r.Rb_k>0?', Spitzenwiderstand aus eingegebenem q_b,k)':', <b>Spitzenwiderstand nicht angesetzt</b>)') : 'q_s,k Erfahrungswert je Schicht (EA-Pfähle, verpresster Mikropfahl, tiefenkonstant — Vordimensionierung)'} · ${_aTxt} (SIA 267 Ziff. 9.5.2.2) · η_g aus mittlerem Achsabstand s̄/D (volle Effizienz ab 6·D, geneigte Pfähle spreizen auf → η_g≈1) · ${r.Rb_k>0 ? 'Spitzenwiderstand aus eingegebenem q_b,k (nur Druck)' : '<b>Spitzendruck NICHT angesetzt</b>'+(r.einzel?'':' (Mikropfahl d_G ≤ 300 mm — reine Mantelreibung als Tragwiderstand)')} · wirksame Verpresslänge L_eff = ${(r.skinLeff||0).toFixed(2)} m${r.skinCapped?' (auf L_crit = '+(r.skinLcrit||0).toFixed(2)+' m gedeckelt)':(r.skinLcrit?' (unter L_crit = '+(r.skinLcrit||0).toFixed(2)+' m)':' (kein Deckel)')}</div>
      ${(() => {
        // q_s,k-Plausibilität: Preset-Tabellenwert vs. eingegebenes φ' (unkonservative Richtung)
        const mm = (typeof _qsPlausibility==='function') ? _qsPlausibility(r.L||0) : [];
        if(!mm.length) return '';
        const li = mm.map(m=>`<b>${m.name}</b>: φ' = ${m.phiI}° eingegeben, Profil unterstellt ${m.phiP}° →
          q_s,k = ${m.qsT} kPa (Tabelle) statt ≈ ${m.qsH} kPa (aus φ') = <b>+${m.over} %</b>`).join('<br>');
        return wBox('warn', 'q_s,k passt nicht zum eingegebenen φ′ ('+mm.length+' Schicht'+(mm.length>1?'en':'')+')',
          `Der Erfahrungswert q_s,k stammt aus dem gewählten <b>Bodenprofil</b> (EA-Pfähle/DIN 4128) und ist
           <b>unabhängig von φ′</b>. Hier liegt φ′ deutlich unter dem Wert, den das Profil unterstellt — der
           Mantelreibungswiderstand ist damit <b>unkonservativ</b>:<br>${li}<br>
           Abhilfe: q_s,k je Schicht im Tab «Boden» manuell setzen (Tabelle/Probebelastung) oder ein
           passenderes Bodenprofil wählen.`);
      })()}
      ${r.skinCapped ? `<div class="nw-row" style="color:var(--warn)"><span>Angesetzte Länge L_eff (Optionen: L_crit)</span><span>${(r.skinLeff||0).toFixed(2)} m von ${(r.L||0).toFixed(2)} m</span></div>` : ''}
      ${r.skinCapped ? wBox('warn', 'Wirksame Verpresslänge gedeckelt — L_eff = '+(r.skinLeff||0).toFixed(2)+' m von '+(r.L||0).toFixed(2)+' m',
        `Die Mantelreibung ist tiefenkonstant angesetzt (Erfahrungswert EA-Pfähle/DIN 4128); ohne Deckel
         wüchse R_s,k <b>unbegrenzt linear</b> mit der Länge. Angesetzt wird daher nur
         <b>L_eff = min(L, L_crit) = ${(r.skinLeff||0).toFixed(2)} m</b> (L_crit = ${(r.skinLcrit||0).toFixed(2)} m),
         die restlichen ${((r.L||0)-(r.skinLeff||0)).toFixed(2)} m bleiben unberücksichtigt.
         Grund: der Verpresskörper entbindet fortschreitend, und die q_s,k-Tabellen sind für übliche
         Verpresslängen kalibriert.<br>
         <b>Konstruktive Bemessungsregel, keine Normformel</b> — L_crit ist in den Optionen einstellbar
         (0 = kein Deckel); massgebend bleibt die Probebelastung.`) : ''}
      ${diagWrap('_pbdiag_axial', buildPbAxialDiagram(r,n,_gztExpanded))}
    ${CARD_END}

    ${cardHd('Laterale Bodentragfähigkeit', r.etaLat, null, govName==='Lat')}
      <div class="nw-formula">Grenzgleichgewicht der p_u-Hüllkurve (Reibung 3·Kp·σ'v·d, bindig 9·c_u·d) · Interaktion V/V_u,d + M_gl/M_u,d ≤ 1</div>
      ${r.latGrpFac!=null && r.latGrpFac<0.999
        ? row('Lateraler Gruppeneffekt (p-Multiplier, s̄/D='+(isFinite(r.grpSd)?r.grpSd:'∞')+')',
              '×'+r.latGrpFac.toFixed(2)+' &nbsp;<span style="color:var(--xdim)">auf k_s und p_u</span>')
        : row('Lateraler Gruppeneffekt (s̄/D='+(isFinite(r.grpSd)?r.grpSd:'∞')+')',
              r.latGrpOn===false ? 'aus (Optionen)' : 'p_m = 1.00 (gespreizt)')}
      ${row('V_u,d = η_a·V_u,k / γ_M,a quer', r.Vcap_d+' kN')}
      ${row('M_u,d = η_a·M_u,k / γ_M,a quer', r.Mcap_d+' kNm')}
      ${row('Einwirkung V_d / M_gl,d', r.latVd+' kN / '+r.latMd+' kNm')}
      ${etaRow('η lateral', r.etaLat, 'η = 1 / (V_d/V_u,d + M_gl,d/M_u,d)<br>= 1 / ('+r.latVd+'/'+r.Vcap_d+' + '+r.latMd+'/'+r.Mcap_d+') = '+(isFinite(r.etaLat)?r.etaLat.toFixed(2):'∞'))}
      <div style="font-size:9px;color:var(--xdim);margin-top:2px">Rotations-/Kick-out-Versagen des Pfahls im Boden (plastische p_u-Hüllkurve, Böschung via Bettungsfaktor). ${_pbEinzel()?'Einzelpfahl: der Kopf trägt die volle Mast-Horizontallast <b>und</b> das Mast-Moment (M_gl = M_Kopf + V·freie Länge).':'Gruppe: massgebender Pfahl über die laterale Kopfkraft (Kopfmoment ≈ 0, im axialen Kräftepaar erfasst).'} · η_a = ${(r.etaA||0.7).toFixed(2)} · γ_M,a quer = ${(r.gMQ||1.4).toFixed(2)} (SIA 267 Ziff. 9.5.2.3).</div>
    ${CARD_END}

    ${cardHd('Innerer Tragwiderstand (Tragglied)', Math.min(r.etaSteel, r.etaKnick), null, govName==='Stahl'||govName==='Knick')}
      <!-- Querschnitt N+M -->
      <div style="font-size:9px;letter-spacing:.05em;text-transform:uppercase;color:var(--acc);margin:0 0 4px">Querschnitt — N+M-Interaktion</div>
      <div class="nw-formula">|N|/R_t,d + |M|/M_Rd ≤ 1  ·  η = 1 / Ausnutzung</div>
      ${row('R_t,d Stahl axial', r.Rt_d+' kN')}
      ${row(r.einzel ? 'M_Rd = W_pl·f_yk/γ_M1' : 'M_Rd = η_i·W_pl·f_yk/γ_s', r.M_Rd+' kNm')}
      ${row('M_max Pfahl (p-y)', r.Mmax+' kNm')}
      ${etaRow('η Querschnitt (N+M)', r.etaSteel, steelDetail)}
      ${diagWrap('_pbdiag_schnitt', buildPbSchnittSVG(r,n,_gztExpanded))}
      ${diagWrap('_pbdiag_steel', buildPbSteelDiagram(r,n,_gztExpanded))}
      <!-- Knicken SIA 263 -->
      <div style="font-size:9px;letter-spacing:.05em;text-transform:uppercase;color:var(--acc);margin:10px 0 4px;padding-top:7px;border-top:1px solid var(--ol)">Knicken (SIA 263, elast. Bettung)</div>
      <div class="nw-formula">N_cr = 2·√(k_bed·EI) · λ̄ = √(N_pl,k/N_cr) · N_b,Rd = η_i·χ·N_pl,k/γ_s · η = N_b,Rd/N_Ed</div>
      ${row('N_Ed Druck max', r.Ncomp+' kN')}
      ${row('N_cr elast. Knicklast (Winkler)', r.N_cr+' kN')}
      ${row('N_pl,k = R_t,k Tragglied', r.N_pl_k+' kN')}
      ${row('λ̄ bez. Schlankheit', r.lamBar.toFixed(2))}
      ${row('χ Abminderung (Kurve c)', r.chi.toFixed(3))}
      ${row(r.einzel ? 'N_b,Rd = χ·N_pl,k/γ_M1' : 'N_b,Rd = η_i·χ·N_pl,k/γ_s', r.N_bRd+' kN')}
      ${etaRow('η Knicken', r.etaKnick, 'η = N_b,Rd / N_Ed = '+r.N_bRd.toFixed(0)+' / '+r.Ncomp.toFixed(0)+' = '+(isFinite(r.etaKnick)?r.etaKnick.toFixed(2):'∞')+'<br>N_b,Rd = '+(r.einzel?'':'η_i·')+'χ·N_pl,k/'+(r.einzel?'γ_M1':'γ_s')+' = '+(r.einzel?'':(r.etaI||0.8).toFixed(2)+'·')+r.chi.toFixed(2)+'·'+r.N_pl_k.toFixed(0)+'/'+(r.gammaS||1.15).toFixed(2))}
      ${diagWrap('_pbdiag_knick', buildPbKnickDiagram(r,n,_gztExpanded))}
      ${r.knickValid===false ? wBox('warn', 'Knickformel ungültig (L < Knick-Halbwelle)',
        `L = ${r.L.toFixed(2)} m &lt; L_hw = ${r.L_hw.toFixed(2)} m — die längenunabhängige
         Euler-auf-Bettung-Formel N_cr = 2·√(k·EI) setzt mindestens eine Knick-Halbwelle Einbindung
         voraus und ist hier <b>nicht gültig</b>. Massgebend ist die laterale Bodentragfähigkeit
         (Rotation/Kick-out).`) : ''}
      <div style="font-size:9px;color:var(--xdim);margin-top:3px">Knickkurve c (Stahl-Voll/Hohlstab, α=0.49) · Bettung weichste Schicht · im weichen Boden massgebend, sonst Querschnitt</div>
      <!-- massgebend innerer Tragwiderstand -->
      <div style="display:flex;justify-content:space-between;padding:5px 0 0;margin-top:6px;border-top:1px solid var(--ol);font-weight:600"><span>η innerer Tragwiderstand = min(Querschnitt, Knicken)</span><span style="color:${cV(Math.min(r.etaSteel,r.etaKnick))}">η = ${isFinite(Math.min(r.etaSteel,r.etaKnick))?Math.min(r.etaSteel,r.etaKnick).toFixed(2):'∞'}</span></div>
    ${CARD_END}

    <div class="lf-grp">GZG — Gebrauchstauglichkeit · SBB 0161.1011.0007</div>

    ${cardHd('Schiefstellung & Verschiebung', r.etaGZG, null, govName==='GZG')}
      <div class="nw-formula">θ ≤ 1:100 (st+ver) · 1:200 (ver quer)${n<=2?' · u ≤ ±20/±10 mm':''}</div>
      ${(()=>{
        // Massgebende Kombination: gzgEval prüft je Lastfall eine charakteristische Kombination
        // (st+ver = G+Q mit γ=1 · ver = nur Q) und meldet den grössten Wert — hier wird sichtbar
        // gemacht, WELCHE davon den massgebenden Ausschlag gab.
        const gq = g && (g.tiltQuer>=g.tiltLaengs ? g.govTiltQuer : g.govTiltLaengs);
        const ax = g && (g.tiltQuer>=g.tiltLaengs ? 'quer' : 'längs');
        if(!g && !gv) return '';
        // Zahlenvergleich statt Erklärtext: je Kriterium der massgebende Lastfall + sein Wert.
        const cr = (lbl, komb, val, unit, grenz) =>
          `<div style="display:flex;gap:8px;padding:1px 0">
             <span style="width:92px;color:var(--dim)">${lbl}</span>
             <span style="width:132px;color:var(--acc)">${esc(komb||'—')}</span>
             <span style="color:var(--on2)">${val} ${unit}</span>
             <span style="color:var(--xdim)">&nbsp;/ ${grenz}</span></div>`;
        const det =
          (g ? cr('θ st+ver', gq, (1000*Math.max(g.tiltQuer,g.tiltLaengs)).toFixed(2)+' ‰ ('+ax+')', '', '10 ‰') : '') +
          (gv ? cr('θ quer, ver', gv.govTiltQuer, (1000*gv.tiltQuer).toFixed(2)+' ‰', '', '5 ‰') : '') +
          ((g&&n<=2) ? cr('u st+ver', (g.uQuer>=g.uLaengs?g.govUQuer:g.govULaengs), Math.max(g.uQuer,g.uLaengs).toFixed(2), 'mm', '20 mm') : '') +
          ((gv&&n<=2) ? cr('u quer, ver', gv.govUQuer, gv.uQuer.toFixed(2), 'mm', '10 mm') : '') +
          `<div style="margin-top:4px;color:var(--xdim)">Charakteristische Kombinationen (γ = 1.00):
            <b>st+ver</b> = ständig + veränderlich${g&&g.nCombos?' über '+g.nCombos+' Lastfall'+(g.nCombos!==1?'e':''):''} ·
            <b>ver</b> = nur veränderlich. Kleinstes η massgebend.</div>`;
        const lbl = gq ? gq+' · '+ax : '—';
        return `<div class="nw-row clickable" onclick="toggleGZTFormula('fml-pbGzgKomb',this)">
          <span>Massgebende Kombination</span><span>${esc(lbl)}</span></div>
          <div class="nw-row-formula" id="fml-pbGzgKomb"><div class="f-num">${det}</div></div>`;
      })()}
      ${g?row('Schiefstellung st+ver', (1000*Math.max(g.tiltQuer,g.tiltLaengs)).toFixed(1)+' ‰ ≤ 10 (1:100)'
             + (g.govTiltQuer||g.govTiltLaengs ? '  ·  '+esc((g.tiltQuer>=g.tiltLaengs?g.govTiltQuer:g.govTiltLaengs)||'') : '')):''}
      ${gv?row('Schiefstellung quer (ver)', (1000*gv.tiltQuer).toFixed(1)+' ‰ ≤ 5 (1:200)'
             + (gv.govTiltQuer ? '  ·  '+esc(gv.govTiltQuer) : '')):''}
      ${(g&&n<=2)?row('Horiz.versch. st+ver', Math.max(g.uQuer,g.uLaengs).toFixed(1)+' mm ≤ 20'):''}
      ${(gv&&n<=2)?row('Horiz.versch. quer (ver)', gv.uQuer.toFixed(1)+' mm ≤ 10'):''}
      ${n>2?'<div style="font-size:9px;color:var(--xdim);padding:2px 0">Verschiebungslimit ±20/±10 mm gilt für 1-/2-Pfahlfundamente</div>':''}
      ${etaRow('η GZG', r.etaGZG, 'η = min(Grenzwert / Wert) über alle Kriterien<br>'+(g?'θ_st+ver: 0.010 / '+Math.max(g.tiltQuer,g.tiltLaengs).toFixed(4)+' = '+(0.010/Math.max(1e-9,Math.max(g.tiltQuer,g.tiltLaengs))).toFixed(2):'')+(gv?'<br>θ_quer,ver: 0.005 / '+gv.tiltQuer.toFixed(4)+' = '+(0.005/Math.max(1e-9,gv.tiltQuer)).toFixed(2):'')+'<br>Minimum ist massgebend')}
      ${diagWrap('_pbdiag_system', buildPbSystemSVG(r,piles,n,_gztExpanded))}
    ${CARD_END}

    ${cardHd((_pbEinzel()?'Setzung Pfahlkopf':'Setzung Bankett')+' (informativ — kein Grenzwert)', null, r.settle_mm+' mm')}
      <div class="nw-formula">k_ax = EA·λ·tanh(λL) (Lastübertragung t-z) · λ = √(k_shaft/EA) · k_shaft = 2π·G/ζ</div>
      ${row((_pbEinzel()?'Setzung Pfahlkopf':'Setzung Bankett')+' (char.)', r.settle_mm+' mm')}
      ${row('k_ax (Stahl + Boden-Last-Setzung)', (r.kAx/1000).toFixed(1)+' MN/m')}
      ${row('davon Stahl allein E·A/L', (r.kAxSteel/1000).toFixed(1)+' MN/m')}
      <div style="font-size:9px;color:var(--xdim);margin-top:3px">Lastübertragungsmodell (Randolph): Stahldehnung mit Lastabbau + Mantelmobilisierung (G aus M_E je Schicht), freier Fuss (keine Spitze). Bankett <b>starr</b> angenommen — verteilt die Setzung als Starrkörper (Translation + Kippen), keine Eigenbiegung; bei dünnem/grossem Bankett gesondert prüfen.</div>
    ${CARD_END}

    <div style="font-size:9px;color:var(--xdim);margin-top:8px;line-height:1.5">${r.einzel ? 'Einzelpfahl · Bettungsbalken mit H und M am Kopf (beide Profilachsen) · Mantelreibung '+(r.Rb_k>0?'mit Spitzenwiderstand (eingegebenes q_b,k)':'ohne Spitzenwiderstand')+' · Torsion '+(r.tors?'über Mantelreibung und Querschnitt nachgewiesen':'= 0')+' · Vordimensionierung, kein Ersatz für den normativen Nachweis.' : `Mikropfahl · Mantelreibung + Biegung (p-y, geschichtet) · voller A_s (kein Abrostzuschlag, SIA 267) · Knicken = N_cr,elast. (Imperfektion gem. Lieferant) · Vordimensionierung, kein Ersatz für normativen Nachweis.`}</div>
  </div>`;
}
