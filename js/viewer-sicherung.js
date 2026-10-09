// BlockCalc — js/viewer-sicherung.js
// 3D-Darstellung der Pfahlsicherung
// PFAHLSICHERUNG — 3D-Visualisierung
// ════════════════════════════════════════════
function buildPfahlViz(){
  clr('pfahl3d');
  const L = +gi('pfahl_l') || 0;
  if(L < 0.1) return;

  const bx      = +gi('g_bx'), by = +gi('g_by');
  const ue      = Math.max(0, +gi('g_uberd') || 0);
  const hk      = Math.max(0, +gi('g_hkopf') || 0);  // Gesamthöhe Kopf (OK Block → OK Kopf)
  const kx      = Math.max(0, +gi('g_kx')    || 0);  // Fundamentkopf-Breite
  const ex_off  = +gi('g_ex') || 0;                   // Versatz Kopf in x
  // OK Fundamentkopf in Szenenkoordinaten: y = -ue + hk (Kopf sitzt auf Block-Oberkante)
  const y_ok_kopf = -ue + hk;
  const n       = +gi('pfahl_anzahl') || 2;
  const s       = +gi('pfahl_s')      || 0.5;
  const alpha   = (+gi('pfahl_alpha') || 60) * Math.PI / 180;
  const e_h     = +(document.getElementById('pfahl_e')?.value ?? '0');
  const d_ex    = Math.max(0, +gi('pfahl_dex') || 0);
  const ex_s    = gi('pfahl_dex_seite') || 'gleis';   // 'gleis' | 'feld'
  const p_seite = 'gegenueber';  // Pfähle stehen fix auf der gleisabgewandten Seite (Feldseite)
  // Richtstütze immer an Fundamentkopf-Achse
  const typ     = gi('pfahl_typ')      || 'HEB200';
  const prof    = pfahlSection(typ);
  const B_pf    = prof.b;

  const _lt  = document.documentElement.getAttribute('data-theme') === 'light';
  const grp  = new THREE.Group(); grp.name = 'pfahl3d';
  const ln   = (a, b, mat) => grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a,b]), mat));

  // ── Seiten bestimmen
  // ex_sign: +1 = Pfahl auf +x Seite, -1 = -x Seite (Gleisseite)
  const ex_sign   = ex_s === 'gleis' ? -1 : +1;  // Aushub auf Gleisseite = -x
  const pfahl_sign = p_seite === 'beide'       ? [+1, -1]
                   : p_seite === 'gleisseite'  ? [-1]
                   : [-ex_sign];  // Standard: gegenüber Aushub

  // Pfähle ausgegraut wenn Spannungen-Layer aktiv (konsistent mit Fundamentblock)
  const _dimPfahl = showStr || showVec;
  const matPfahl  = new THREE.MeshLambertMaterial({
    color:   _dimPfahl ? 0x606068 : (_lt ? 0x6688aa : 0x8899aa),
    transparent: true,
    opacity: _dimPfahl ? 0.22 : 0.90
  });
  const matEdge   = new THREE.LineBasicMaterial({
    color:   _dimPfahl ? 0x888890 : (_lt ? 0x8899bb : 0xaabbdd),
    opacity: _dimPfahl ? 0.30 : 0.55,
    transparent: true
  });
  const matStrut  = new THREE.MeshLambertMaterial({
    color:   _dimPfahl ? 0x888890 : (_lt ? 0x99aacc : 0xbbccdd),
    transparent: true,
    opacity: _dimPfahl ? 0.25 : 0.80
  });
  const matMeas   = new THREE.LineBasicMaterial({ color:0x88aacc, opacity:0.7, transparent:true });
  const matExFloor= new THREE.LineBasicMaterial({ color:0xb06040, opacity:0.65, transparent:true });

  const d_abstand = Math.max(0.5, +gi('pfahl_abstand') || 2.0);  // Abstand Blockkante–Pfahl [m]
  const z_offsets = n === 1 ? [0] : n === 2 ? [-s/2, s/2] : [-s, 0, s];

  // ── Aushubsohle: nur horizontale Fläche + Randlinien (kein Vollkörper)
  if(d_ex > 0.05){
    const ex_x0 = ex_sign * bx/2;          // Blockkante auf Aushubseite
    const ex_x1 = ex_sign * (bx/2 + 2.5);  // Aushub reicht 2.5m über Blockkante
    // Länge in y (Gleisrichtung): grabenartig, deckt mind. die Erddruck-Wirkbreite
    // b_id = B + 0.6·t·tanφ ab (Berechnungsannahme: seitlich durchgehender Aushub)
    const ex_z0 = -(by/2 + 2.5), ex_z1 = by/2 + 2.5;
    const y_sohle = -d_ex;

    // Transparente Fläche (Plane)
    const plW = Math.abs(ex_x1 - ex_x0), plD = ex_z1 - ex_z0;
    const plGeo = new THREE.PlaneGeometry(plW, plD);
    const plMesh = new THREE.Mesh(plGeo, new THREE.MeshLambertMaterial({
      color:0xb06040, transparent:true, opacity:0.18, side:THREE.DoubleSide, depthWrite:false
    }));
    plMesh.rotation.x = -Math.PI/2;
    plMesh.position.set((ex_x0+ex_x1)/2, y_sohle, (ex_z0+ex_z1)/2);
    grp.add(plMesh);

    // Randlinien der Aushubsohle
    const corners = [
      new THREE.Vector3(ex_x0, y_sohle, ex_z0),
      new THREE.Vector3(ex_x1, y_sohle, ex_z0),
      new THREE.Vector3(ex_x1, y_sohle, ex_z1),
      new THREE.Vector3(ex_x0, y_sohle, ex_z1),
      new THREE.Vector3(ex_x0, y_sohle, ex_z0),
    ];
    grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(corners), matExFloor));

    // Senkrechte Tiefenlinien an den 4 Ecken (GOK → Sohle)
    [[ex_x0,ex_z0],[ex_x0,ex_z1],[ex_x1,ex_z0],[ex_x1,ex_z1]].forEach(([cx,cz])=>{
      ln(new THREE.Vector3(cx, 0,       cz),
         new THREE.Vector3(cx, y_sohle, cz), matExFloor);
    });

    // Vermassung d_ex: Linie + Label an Blockkante
    const vx = ex_x0 + ex_sign * 0.3;
    ln(new THREE.Vector3(vx, 0,       ex_z1 + 0.15),
       new THREE.Vector3(vx, y_sohle, ex_z1 + 0.15), matExFloor);
    _vlAdd(`d_ex = ${d_ex.toFixed(1)} m`,
      new THREE.Vector3(vx + ex_sign*0.25, y_sohle/2, ex_z1 + 0.15), 'vl-dim');
  }

  // ── Blockkeil (Rankine) + Wirkungsschatten am Pfahl — eigener Layer (Start aus)
  // Keil von der Sohlenvorderkante unter 45°−φ/2 zur Oberfläche (Pfahlseite);
  // Pfähle innerhalb des Keils: Schattenband 0…z_ov (teilbeanspruchter Boden)
  if(showPfahlKeil){
    const _phiW  = (SCHICHTEN[0]?.phi ?? (+gi('bg_phi') || 30)) * Math.PI / 180;
    const _tanW  = Math.tan(Math.PI/4 + _phiW/2);
    const _t_bl  = Math.max(0.1, +gi('g_hblock') || 2.0) + ue;
    const _L_emb = L;  // Pfähle stehen gegenüber dem Aushub → volle Einbindung
    const _sprT  = Math.tan(_phiW / 2);                  // seitliche Keilausbreitung im Grundriss
    // ── Reale Geländeoberfläche für die Keil-Begrenzung (Aushubsohle / Böschung).
    //    Keile enden an dieser Fläche statt an der flachen GOK (y=0).
    const _beta = (+gi('bg_beta') || 0) * Math.PI/180;
    const _btyp = gi('bg_btyp') || 'none';
    const _bfu  = +gi('bg_bfuss') || 0;
    const _bho  = Math.max(0, +gi('bg_bhoehe') || 0);
    const surfY = (x, z) => {
      // Aushub: innerhalb der Grube auf der Aushubseite → Sohle bei −d_ex
      if(d_ex > 0.05){
        const onEx = ex_sign > 0 ? x > bx/2 - 0.01 : x < -bx/2 + 0.01;
        if(onEx && Math.abs(x) < bx/2 + 2.5 && Math.abs(z) < by/2 + 2.5) return -d_ex;
      }
      // Böschung: +x jenseits Böschungsfuss, geneigt, durch h_β begrenzt
      if(_btyp !== 'none' && Math.abs(_beta) > 0.002){
        const fuss = bx/2 + Math.max(0, _bfu);
        if(x > fuss){
          let dy = (x - fuss) * Math.tan(_beta);
          if(_bho > 0.05) dy = Math.sign(dy) * Math.min(Math.abs(dy), _bho);
          return dy;
        }
      }
      return 0;
    };
    pfahl_sign.forEach(ps => {
      const x0 = ps * bx/2;                              // Blockflanke
      const reach = _t_bl * _tanW;
      const x1 = ps * (bx/2 + reach);                    // Keilspitze an GOK
      const hZ0 = by/2;                                  // halbe Breite an der Blockflanke
      const hZ1 = by/2 + reach * _sprT;                  // halbe Breite an der Spitze (Spreizung φ/2)
      // Keildecke folgt der realen Oberfläche (Aushubsohle / Böschung) statt y=0
      const ky0n = surfY(x0, -hZ0), ky1n = surfY(x1, -hZ1);
      const ky0p = surfY(x0,  hZ0), ky1p = surfY(x1,  hZ1);
      // Keilprisma (6 Vertices): Flanke oben/unten + Spitzlinie, seitlich gespreizt
      const v = new Float32Array([
        x0, ky0n, -hZ0,  x0, -_t_bl, -hZ0,  x1, ky1n, -hZ1,
        x0, ky0p,  hZ0,  x0, -_t_bl,  hZ0,  x1, ky1p,  hZ1,
      ]);
      const ix = [0,1,2, 3,5,4, 0,2,5,0,5,3, 1,4,5,1,5,2, 0,3,4,0,4,1];
      const wgeo = new THREE.BufferGeometry();
      wgeo.setAttribute('position', new THREE.BufferAttribute(v,3));
      wgeo.setIndex(ix); wgeo.computeVertexNormals();
      grp.add(new THREE.Mesh(wgeo, new THREE.MeshLambertMaterial(
        {color:0xc9a84c, transparent:true, opacity:0.10, side:THREE.DoubleSide, depthWrite:false})));
      // Gleitflächen-Kontur (vordere Fläche) + Grundriss-Umriss an der Oberfläche
      ln(new THREE.Vector3(x0, -_t_bl, -hZ0), new THREE.Vector3(x1, ky1n, -hZ1),
         new THREE.LineBasicMaterial({color:0xc9a84c, transparent:true, opacity:0.6}));
      ln(new THREE.Vector3(x0, ky0n, -hZ0), new THREE.Vector3(x1, ky1n, -hZ1),
         new THREE.LineBasicMaterial({color:0xc9a84c, transparent:true, opacity:0.45}));
      ln(new THREE.Vector3(x0, ky0p, hZ0), new THREE.Vector3(x1, ky1p, hZ1),
         new THREE.LineBasicMaterial({color:0xc9a84c, transparent:true, opacity:0.45}));
      _vlAdd(`Blockkeil 45°−φ/2`, new THREE.Vector3((x0+x1)/2, -_t_bl*0.35, -hZ0-0.05), 'vl-dim');
      // Schattenband PRO Pfahl: Grundriss-Prüfung gegen die Keilkante (wie Berechnung)
      // Zugfall (Moment zum Aushub): Interferenz nur mit der Aktivzone (steil, kurz)
      const _zugV   = !!window._pfahlZug;
      const xp = ps * (bx/2 + d_abstand);
      const _zovGeo = _zugV
        ? Math.min(_L_emb, Math.max(0, _t_bl - d_abstand * _tanW))
        : Math.min(_L_emb, Math.max(0, _t_bl - d_abstand / _tanW));
      let _zovMax = 0, _zovPos = null;
      z_offsets.forEach(zo => {
        const e_lat = Math.max(0, Math.abs(zo) - by/2);
        const over  = e_lat - d_abstand * _sprT;
        const zov_i = (over < B_pf) ? _zovGeo : 0;   // ausserhalb Keilkante (+B-Rampe) → kein Band
        if(zov_i > 0.05){
          const _sBand = surfY(xp, zo);   // Oberkante Band an realer Oberfläche
          const band = new THREE.Mesh(
            new THREE.BoxGeometry(B_pf+0.06, zov_i, B_pf+0.06),
            new THREE.MeshLambertMaterial({color:0xc9a84c, transparent:true, opacity:0.30, depthWrite:false}));
          band.position.set(xp, _sBand - zov_i/2, zo);
          grp.add(band);
          if(zov_i > _zovMax){ _zovMax = zov_i; _zovPos = zo; }
        }
      });
      if(_zovMax > 0.05){
        _vlAdd(`z_ov = ${_zovMax.toFixed(1)} m`,
          new THREE.Vector3(xp + ps*(B_pf+0.25), -_zovMax/2, _zovPos), 'vl-dim');
      }
      // ── Pfahlkeile (passiver Druckkegel pro Pfahl, Richtung vom Block weg)
      // Starrer Pfahl rotiert um NL z_r → Widerstandskeil von z_r unter 45°−φ/2
      // zur Oberfläche, seitliche Spreizung φ/2 (analog Blockkeil) — macht die
      // Überschneidung mit dem Blockkeil im Grundriss sichtbar
      {
        const _e_p  = Math.max(0, e_h);
        const _z_r  = Math.min(_L_emb, (2*_L_emb + 3*_e_p) * _L_emb / (3 * (2*_e_p + _L_emb)));
        const reachP = _z_r * _tanW;
        const matPK  = new THREE.MeshLambertMaterial(
          {color:0x7c8de0, transparent:true, opacity:0.10, side:THREE.DoubleSide, depthWrite:false});
        const matPKl = new THREE.LineBasicMaterial({color:0x7c8de0, transparent:true, opacity:0.5});
        const wDir = (_zugV ? -1 : 1) * ps;        // Zugfall: Keil ZUM Block hin
        z_offsets.forEach((zo, zi) => {
          const xf0 = xp + wDir * B_pf/2;          // Pfahlfront (Widerstandsseite)
          const xf1 = xf0 + wDir * reachP;         // Keilspitze an GOK
          const hp0 = B_pf/2;
          const hp1 = B_pf/2 + reachP * _sprT;     // Spreizung φ/2 im Grundriss
          // Keildecke folgt der realen Oberfläche (Aushubsohle / Böschung)
          const py0n = surfY(xf0, zo-hp0), py1n = surfY(xf1, zo-hp1);
          const py0p = surfY(xf0, zo+hp0), py1p = surfY(xf1, zo+hp1);
          const py1c = surfY(xf1, zo);
          const vp = new Float32Array([
            xf0, py0n, zo-hp0,  xf0, -_z_r, zo-hp0,  xf1, py1n, zo-hp1,
            xf0, py0p, zo+hp0,  xf0, -_z_r, zo+hp0,  xf1, py1p, zo+hp1,
          ]);
          const pgeo = new THREE.BufferGeometry();
          pgeo.setAttribute('position', new THREE.BufferAttribute(vp,3));
          pgeo.setIndex([0,1,2, 3,5,4, 0,2,5,0,5,3, 1,4,5,1,5,2, 0,3,4,0,4,1]);
          pgeo.computeVertexNormals();
          grp.add(new THREE.Mesh(pgeo, matPK));
          // Grundriss-Umriss an der Oberfläche + Gleitflächen-Linie
          ln(new THREE.Vector3(xf0, py0n, zo-hp0), new THREE.Vector3(xf1, py1n, zo-hp1), matPKl);
          ln(new THREE.Vector3(xf0, py0p, zo+hp0), new THREE.Vector3(xf1, py1p, zo+hp1), matPKl);
          ln(new THREE.Vector3(xf0, -_z_r, zo), new THREE.Vector3(xf1, py1c, zo), matPKl);
          if(zi === 0) _vlAdd(`Pfahlkeil 45°−φ/2`,
            new THREE.Vector3((xf0+xf1)/2, -_z_r*0.3, zo - hp1 - 0.1), 'vl-dim');
        });
      }
    });
  }

  // ── HEB-Profil: vertikaler Pfahl (Pfahlachse = y)
  // Steg zeigt in x-Richtung (Richtung Richtstütze / Block)
  // Flansche in z-Richtung (links/rechts) — H sichtbar von Stützen-Seite (+x)
  // Querschnitt (Draufsicht xz): Flansche bei x = ±(h/2-tf/2), Steg entlang x-Achse
  // rotY: Rotation um y-Achse [rad] → dreht Steg in radiale Richtung
  function addHEB(cx, cy, cz, profil, length, mat, matE, rotY = 0){
    const { b, h, tw, tf } = profil;
    // Krinner V (Rundrohr) → Zylinder statt I-Profil
    if(profil.round){
      const geo=new THREE.CylinderGeometry(b/2, b/2, length, 16);
      const m=new THREE.Mesh(geo, mat); m.position.set(cx, cy, cz); m.rotation.y=rotY; grp.add(m);
      const e=new THREE.LineSegments(new THREE.EdgesGeometry(geo), matE); e.position.copy(m.position); e.rotation.y=rotY; grp.add(e);
      return;
    }
    const hw = h - 2*tf;
    const sub = new THREE.Group();
    sub.position.set(cx, cy, cz);
    sub.rotation.y = rotY;
    const parts = [
      { geo: new THREE.BoxGeometry(tf, length, b),  dx: +(h/2 - tf/2) },
      { geo: new THREE.BoxGeometry(tf, length, b),  dx: -(h/2 - tf/2) },
      { geo: new THREE.BoxGeometry(hw, length, tw), dx: 0 },
    ];
    parts.forEach(({geo, dx}) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(dx, 0, 0);
      sub.add(m);
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), matE);
      e.position.copy(m.position);
      sub.add(e);
    });
    grp.add(sub);
  }

  // ── Richtstütze als Volumenkörper: Rohrquerschnitt 60×4mm (abstrahiert)
  function addStrut(ptA, ptB, mat){
    const dir = new THREE.Vector3().subVectors(ptB, ptA);
    const len = dir.length();
    if(len < 0.01) return;
    const geo = new THREE.CylinderGeometry(0.030, 0.030, len, 8);
    const mesh = new THREE.Mesh(geo, mat);
    // Zylinder-Achse = y → zur Stützen-Achse rotieren
    mesh.position.copy(ptA).addScaledVector(dir.normalize(), len/2);
    const axis = new THREE.Vector3(0,1,0);
    mesh.quaternion.setFromUnitVectors(axis, dir);
    grp.add(mesh);
  }

  // ── p_u-Grenzhülle am Pfahl (3D-Overlay) ─────────────────────────────────
  // Vollständig isoliert — kein Eingriff in calculate() / renderResults()
  // Visualisiert die Bettungsgrenzhülle p_u(z)=3·Kp·σ'v·B (schichtweise, GW) entlang des Pfahls
  function addErddruckDiagPfahl(cx, cz, e_h_val, L_val, phi_deg, gamma_val, prof_val, rot_y_val){
    const B_pf  = prof_val.b;
    // p_u [kN/m] schichtweise (GW-wirksam); d = Abstand vom Kopf, Tiefe ab GOK = d−e_h.
    const pu3d  = d => {
      const z = Math.max(0, d - e_h_val);              // Tiefe unter GOK (freie Länge ohne Druck)
      const s = schichtAtDepth(z), ph = s.phi ?? phi_deg;
      if(ph <= 5) return z > 1.5*B_pf ? 9*Math.max(0, s.c ?? 0)*B_pf : 0;
      const Kpi = Math.tan(Math.PI/4 + ph*Math.PI/360)**2;
      return 3 * Kpi * sigVeffTo(z) * B_pf;
    };
    let p_max = 0; for(let i=0;i<=16;i++) p_max = Math.max(p_max, pu3d(i/16*L_val));
    if(p_max < 0.5) return;

    // Visuelle Skalierung: p_max kPa → max. 0.55m Bildbreite
    // vis [m/kPa]: px = p(z) [kPa] × vis = 0.55m bei p_max
    const vis = 0.55 / Math.max(1, p_max);

    // Shape in XY-Ebene: X = Druckrichtung (zur Blockseite), Y = Tiefe
    const nSeg  = 16;
    const shape = new THREE.Shape();
    shape.moveTo(0, e_h_val);                            // Pfahlkopf, kein Druck
    for(let i = 1; i <= nSeg; i++){
      const t  = i / nSeg;
      const py = e_h_val - t * L_val;                   // y-Tiefe
      const px = pu3d(t * L_val) * vis;                 // Druckbreite (schichtweise p_u)
      shape.lineTo(px, py);
    }
    shape.lineTo(0, e_h_val - L_val);                   // Pfahlspitze, zurück
    shape.closePath();

    // Fläche (halbtransparent, Amber)
    const geoFill = new THREE.ShapeGeometry(shape);
    const matFill = new THREE.MeshBasicMaterial({
      color: 0xffaa44, transparent: true, opacity: 0.40, side: THREE.DoubleSide, depthWrite: false
    });
    // Umrisslinie
    const pts2d = [];
    for(let i = 0; i <= nSeg; i++){
      const t  = i / nSeg;
      const py = e_h_val - t * L_val;
      const px = pu3d(t * L_val) * vis;
      pts2d.push(new THREE.Vector3(px, py, 0));
    }
    pts2d.unshift(new THREE.Vector3(0, e_h_val, 0));   // Pfahlkopf (kein Druck)
    pts2d.push(new THREE.Vector3(0, e_h_val - L_val, 0));
    const geoLine = new THREE.BufferGeometry().setFromPoints(pts2d);
    const matLine = new THREE.LineBasicMaterial({color: 0xffaa44, opacity: 0.75, transparent: true});

    // Teilgruppe: Position = Pfahlachse, Rotation = radial zur Blockseite
    const sub = new THREE.Group();
    sub.position.set(cx, 0, cz);
    sub.rotation.y = rot_y_val;

    sub.add(new THREE.Mesh(geoFill, matFill));
    sub.add(new THREE.Line(geoLine, matLine));

    // Horizontale Tiefenmarkierungen (alle 1m oder L/4)
    const step = L_val <= 2 ? L_val/4 : 1.0;
    const matTick = new THREE.LineBasicMaterial({color:0xffaa44, opacity:0.4, transparent:true});
    for(let z_d = step; z_d < L_val - 0.01; z_d += step){
      const py   = e_h_val - z_d;
      const px   = pu3d(z_d) * vis;
      sub.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, py, 0),
          new THREE.Vector3(px, py, 0)
        ]), matTick));
    }
    grp.add(sub);

    // Labels: p_u an Spitze + Mitte (kN/m, schichtweise)
    const p_mid = pu3d(L_val/2);
    _vlAdd(`p_u ${p_max.toFixed(0)} kN/m`,
      new THREE.Vector3(cx, e_h_val - L_val * 0.92, cz), 'vl-dim');
    _vlAdd(`${p_mid.toFixed(0)} kN/m`,
      new THREE.Vector3(cx, e_h_val - L_val * 0.5, cz), 'vl-dim');
  }

  // Gemeinsame Konstanten (ausserhalb Schleifen)
  const ey_off  = +gi('g_ey') || 0;
  const hs_off  = +gi('pfahl_hs') || 0;
  // Bodenkennwerte für Erddruckdiagramm — direkt aus Schicht 1, unabhängig von calculate()
  const s0_viz  = SCHICHTEN[0] || {};
  const phi_deg = s0_viz.phi  ?? (+gi('bg_phi')   || 30);
  const gamma   = s0_viz.gamma?? (+gi('bg_gamma') || 20);

  // ── Pfähle (auf konfigurierten Seiten)
  pfahl_sign.forEach(sign => {
    const x_p = sign * (bx/2 + d_abstand);

    z_offsets.forEach(zoff => {
      // Pfahl: Kopf bei y=e_h (OK Pfahlkopf über GOK), Spitze bei y=e_h-L
      const dx_rad = ex_off - x_p;   // radiale Richtung Pfahl → Fundamentkopf
      const dz_rad = ey_off - zoff;
      // Three.js Y-Rotation: lokaler +x → Welt (cosθ, 0, −sinθ)
      // → rot_y = atan2(−dz, dx) damit Steg in radiale Richtung zeigt
      const rot_y  = Math.atan2(-dz_rad, dx_rad);
      addHEB(x_p, e_h - L/2, zoff, prof, L, matPfahl, matEdge, rot_y);
      // Erddruckdiagramm nur wenn Spannungen-Layer aktiv (konsistent mit Steckner-Darstellung)
      if(showStr) addErddruckDiagPfahl(x_p, zoff, e_h, L, phi_deg, gamma, prof, rot_y);

      // Richtstütze — Endpunkt auf Pfahlachse (x_p, GOK=0), Startpunkt an Fundamentkopf
      const y_pk        = e_h;                  // Endpunkt = OK Pfahlkopf
      const y_ma        = y_ok_kopf + hs_off;  // Startpunkt = OK Kopf + Offset
      const x_kopf_face = kx > 0.01 ? ex_off + sign * (kx / 2) : sign * (bx / 2);
      // z_ma: radial interpoliert — Anteil zoff → ey_off entsprechend Verhältnis x-Abstand
      const dx_total = x_p - ex_off;                         // Gesamtabstand x: Pfahl → Achse
      const dx_to_face = x_p - x_kopf_face;                  // Abstand Pfahl → Kopffläche
      const t_face  = Math.abs(dx_total) > 0.01
        ? dx_to_face / dx_total : 1;
      const x_ma   = x_kopf_face;
      // z_ma am Fundamentkopf: fixer 0.4m Abstand (±0.2m), nicht radial → klare Anschlusspunkte
      const z_ma   = ey_off + (zoff !== 0 ? Math.sign(zoff) * 0.20 : 0);
      const ptPf   = new THREE.Vector3(x_p,  y_pk, zoff);
      const ptMa   = new THREE.Vector3(x_ma, y_ma, z_ma);
      addStrut(ptPf, ptMa, matStrut);
    });

    // ── Vermassung — an der äusseren z-Kante, Pfahl-Bezug immer GOK=0
    const x_out = x_p + sign * (B_pf/2 + 0.20);
    const z_ref = z_offsets[z_offsets.length-1] + 0.15;

    // 1. L-Vermassung: OK Pfahlkopf → UK Pfahl
    ln(new THREE.Vector3(x_out, e_h,      z_ref),
       new THREE.Vector3(x_out, e_h - L,  z_ref), matMeas);
    ln(new THREE.Vector3(x_out-0.08, e_h,     z_ref), new THREE.Vector3(x_out+0.08, e_h,     z_ref), matMeas);
    ln(new THREE.Vector3(x_out-0.08, e_h - L, z_ref), new THREE.Vector3(x_out+0.08, e_h - L, z_ref), matMeas);
    _vlAdd(`L = ${L.toFixed(1)} m`,
      new THREE.Vector3(x_out + sign*0.20, e_h - L/2, z_ref), 'vl-dim');

    // 2. e-Vermassung: GOK → Stützenanschluss am Block (h_s = OK Kopf + hs_off)
    const h_s_disp = y_ok_kopf + (+gi('pfahl_hs') || 0);
    if(Math.abs(h_s_disp) > 0.02){
      ln(new THREE.Vector3(x_out, 0,         z_ref),
         new THREE.Vector3(x_out, h_s_disp,  z_ref), matMeas);
      _vlAdd(`h_s = ${h_s_disp.toFixed(2)} m`,
        new THREE.Vector3(x_out + sign*0.20, h_s_disp/2, z_ref), 'vl-dim');
    }

    // 3. Horizontalabstand d: Blockkante → Pfahl (auf GOK-Ebene)
    const z_horiz = z_offsets[0] - 0.22;
    const x_block_edge = sign * bx/2;
    ln(new THREE.Vector3(x_block_edge, 0.06, z_horiz),
       new THREE.Vector3(x_p,          0.06, z_horiz), matMeas);
    ln(new THREE.Vector3(x_block_edge, 0.16, z_horiz), new THREE.Vector3(x_block_edge, -0.04, z_horiz), matMeas);
    ln(new THREE.Vector3(x_p,          0.16, z_horiz), new THREE.Vector3(x_p,          -0.04, z_horiz), matMeas);
    _vlAdd(`d = ${d_abstand.toFixed(2)} m`,
      new THREE.Vector3((x_block_edge + x_p)/2, 0.24, z_horiz), 'vl-dim');

    // 4. h_s-Vermassung: GOK → Stützenanschluss am Mast
    const hs_off_v  = +gi('pfahl_hs') || 0;
    const h_s       = y_ok_kopf + hs_off_v;   // Anschlusshöhe über GOK
    const x_kopf_edge = kx > 0.01 ? ex_off + sign*(kx/2) : sign*(bx/2);
    const x_mast_edge = x_kopf_edge + sign * 0.06;
    ln(new THREE.Vector3(x_mast_edge, -ue,      z_horiz + 0.28),
       new THREE.Vector3(x_mast_edge, h_s - ue, z_horiz + 0.28), matMeas);
    ln(new THREE.Vector3(x_mast_edge-0.08, -ue,      z_horiz+0.28), new THREE.Vector3(x_mast_edge+0.08, -ue,      z_horiz+0.28), matMeas);
    ln(new THREE.Vector3(x_mast_edge-0.08, h_s - ue, z_horiz+0.28), new THREE.Vector3(x_mast_edge+0.08, h_s - ue, z_horiz+0.28), matMeas);
    _vlAdd(`h_s = ${h_s.toFixed(2)} m`,
      new THREE.Vector3(x_mast_edge + sign*0.20, (h_s - ue)/2, z_horiz + 0.28), 'vl-dim');

    // 5. Winkel-Bogen: 3D-Winkel aus tatsächlicher Stützengeometrie
    // Referenz-Pfahl: z_offsets[0], radialer z_ma für diesen Pfahl
    {
      const z_ref    = z_offsets[0];
      const t_ref    = Math.abs(x_p - ex_off) > 0.01 ? (x_p - x_kopf_edge) / (x_p - ex_off) : 1;
      const z_ma_ref = z_ref + t_ref * (ey_off - z_ref);
      const dx_pf    = x_p - x_kopf_edge;
      const dz_pf    = z_ref - z_ma_ref;
      const horiz_dist = Math.sqrt(dx_pf*dx_pf + dz_pf*dz_pf);
      const alpha_eff     = Math.atan2(h_s, horiz_dist);
      const alpha_eff_deg = (alpha_eff * 180 / Math.PI).toFixed(1);
      si('pfahl_alpha', alpha_eff_deg);  // α readonly

      // β: Horizontalwinkel zwischen Stützen (nur für n≥2)
      if(n >= 2 && z_offsets.length >= 2){
        const z1 = z_offsets[0], z2 = z_offsets[1];
        const x_k = kx > 0.01 ? ex_off + sign*(kx/2) : sign*(bx/2);
        const zm1_ = ey_off + Math.sign(z1)*0.20;
        const zm2_ = ey_off + Math.sign(z2)*0.20;
        const v1x = x_k - x_p, v1z_ = zm1_ - z1;
        const v2x = x_k - x_p, v2z_ = zm2_ - z2;
        const dot_  = v1x*v2x + v1z_*v2z_;
        const l1_ = Math.sqrt(v1x*v1x + v1z_*v1z_);
        const l2_ = Math.sqrt(v2x*v2x + v2z_*v2z_);
        const beta_ = l1_>0&&l2_>0 ? Math.acos(Math.min(1,Math.max(-1,dot_/(l1_*l2_))))*180/Math.PI : 0;
        si('pfahl_beta', beta_.toFixed(1));
      }

      const r = 0.40, z_bogen = z_offsets[0] - 0.38;
      const bpts = [];
      for(let i=0; i<=16; i++){
        const a = (i/16) * alpha_eff;
        bpts.push(new THREE.Vector3(x_p + sign*r*Math.cos(a), e_h + r*Math.sin(a), z_bogen));
      }
      grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(bpts),
        new THREE.LineBasicMaterial({color:0xffcc44, opacity:0.85, transparent:true})));
      _vlAdd(`α = ${alpha_eff_deg}°`,
        new THREE.Vector3(x_p + sign*r*1.5*Math.cos(alpha_eff/2), e_h + r*1.5*Math.sin(alpha_eff/2), z_bogen),
        'vl-dim');
    } // end scope Winkel
  });

  // ── d_ex Vermassung an der Aushubsohle (falls Aushub vorhanden)
  if(d_ex > 0.05){
    const ex_sign_v = ex_s === 'gleis' ? -1 : +1;
    const x_ex_edge = ex_sign_v * bx/2;
    const z_ex_ref  = by/2 + 0.35;
    const matDex = new THREE.LineBasicMaterial({color:0xb06040, opacity:0.75, transparent:true});
    // Vertikale Linie GOK → Aushubsohle
    ln(new THREE.Vector3(x_ex_edge + ex_sign_v*0.3, 0,     z_ex_ref),
       new THREE.Vector3(x_ex_edge + ex_sign_v*0.3, -d_ex, z_ex_ref), matDex);
    // Endticks
    ln(new THREE.Vector3(x_ex_edge + ex_sign_v*0.18, 0,     z_ex_ref),
       new THREE.Vector3(x_ex_edge + ex_sign_v*0.42, 0,     z_ex_ref), matDex);
    ln(new THREE.Vector3(x_ex_edge + ex_sign_v*0.18, -d_ex, z_ex_ref),
       new THREE.Vector3(x_ex_edge + ex_sign_v*0.42, -d_ex, z_ex_ref), matDex);
    if(!showPfahl) _vlAdd(`d_ex = ${d_ex.toFixed(1)} m`,
      new THREE.Vector3(x_ex_edge + ex_sign_v*0.65, -d_ex/2, z_ex_ref), 'vl-dim');
  }

  scene.add(grp);
}

let _legOpen=false;
function toggleLegend(){
  _legOpen=!_legOpen;
  document.getElementById('vleg-body').style.display=_legOpen?'':'none';
  const _vc=document.getElementById('vleg-chev'); if(_vc) _vc.style.transform=_legOpen?'rotate(90deg)':'';
}

// ════════════════════════════════════════════
