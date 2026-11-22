// ---------------- MAPA ----------------
// Mapa propi en canvas (sense llibreries): teselles ICGC desades per anar sense cobertura,
// mapa de la fitxa com a base sempre disponible, camins OSM pregenerats, track, punts i GPS.
const mapa = (() => {
  const TILE_URL = "https://geoserveis.icgc.cat/servei/catalunya/mapa-base/wmts/topografic/MON3857NW/{z}/{x}/{y}.png";
  const TILE_CACHE = "catllaras-teselles-v1";
  const ZMIN = 11, ZMAX = 18, TZMIN = 12, TZDESC = 16;
  // metres al voltant del track (i dels plans B i C) que es descarreguen a cada zoom
  const BUF = {12: 3000, 13: 2000, 14: 1100, 15: 650, 16: 350};
  // trams dels plans B i C (línia recta entre punts, amb marge ampli) per tenir-los també offline
  const PLANS_BC = [["P6","PB"],["PB","P0"],["P8","JB"],["JB","P11"],["P1","PB"]];
  const BUF_BC = {12: 3000, 13: 2000, 14: 1300, 15: 900, 16: 700};
  const COL = {d1: "#8e44ad", d2: "#1f6fd1", dec: "#e67e22"};
  const OSM_EST = [ // [color, gruix, guions] per tipus: carretera, camí asfaltat, pista, sender, escales
    ["#7f8c8d", 3, []], ["#95a5a6", 2.2, []], ["#d35400", 2, [7, 4]], ["#c0392b", 1.8, [2, 3]], ["#c0392b", 2.4, [1, 2]]];

  let cv, ctx, W = 0, H = 0, dpr = 1;
  let cLat = 42.222, cLon = 1.978, Z = 13.3;
  let base = store.get("mapBase", "icgc"), caminsOn = store.get("mapCamins", true);
  const tiles = new Map(); // "z/x/y" -> {img, ok, err}
  let fitxaImg = null, fitxaInv = null, pendent = false, mostrat = false;

  const wx = (lon, z) => (lon + 180) / 360 * 256 * 2 ** z;
  const wy = (lat, z) => { const s = Math.sin(lat * Math.PI / 180); return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 256 * 2 ** z; };
  const lonOf = (x, z) => x / (256 * 2 ** z) * 360 - 180;
  const latOf = (y, z) => { const n = Math.PI - 2 * Math.PI * y / (256 * 2 ** z); return 180 / Math.PI * Math.atan(Math.sinh(n)); };
  function scr(lat, lon) { return [W / 2 + wx(lon, Z) - wx(cLon, Z), H / 2 + wy(lat, Z) - wy(cLat, Z)]; }
  const tileUrl = (z, x, y) => TILE_URL.replace("{z}", z).replace("{x}", x).replace("{y}", y);
  const coord = c => COORD.find(r => r[0] === c);

  // ----- mapa de la fitxa (imatge georeferenciada) -----
  function fitxaLL(px, py) { // píxel de la imatge -> [lat, lon] invertint la transformació afí
    const M = MAPA_FITXA.M, a = M[0][0], b = M[1][0], c = M[0][1], d = M[1][1], det = a * d - b * c;
    const X = px - M[2][0], Y = py - M[2][1];
    return [(a * Y - c * X) / det, (d * X - b * Y) / det];
  }

  // ----- dibuix -----
  function dibuixa() { if (!pendent) { pendent = true; requestAnimationFrame(pinta); } }
  function pinta() {
    pendent = false; if (!ctx || !W) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#e8e6df"; ctx.fillRect(0, 0, W, H);
    // 1) mapa de la fitxa a sota: sempre disponible, també cobreix els forats sense teselles
    if (fitxaImg && fitxaImg.complete && fitxaImg.naturalWidth) {
      const [w, h] = MAPA_FITXA.size, p0 = scr(...fitxaLL(0, 0)), p1 = scr(...fitxaLL(w, 0)), p2 = scr(...fitxaLL(0, h));
      ctx.save();
      ctx.setTransform(dpr * (p1[0] - p0[0]) / w, dpr * (p1[1] - p0[1]) / w, dpr * (p2[0] - p0[0]) / h, dpr * (p2[1] - p0[1]) / h, dpr * p0[0], dpr * p0[1]);
      ctx.drawImage(fitxaImg, 0, 0); ctx.restore();
    }
    // 2) teselles ICGC
    if (base === "icgc") pintaTeselles();
    // 3) camins OSM
    if (caminsOn && base === "icgc" && typeof CAMINS !== "undefined" && CAMINS) pintaCamins();
    // 4) track, punts i GPS
    if (base === "icgc") { pintaTrack(); pintaPunts(); }
    pintaGps();
    // escala
    const mpp = 156543.034 * Math.cos(cLat * Math.PI / 180) / 2 ** Z;
    let m = [50, 100, 200, 500, 1000, 2000, 5000].find(v => v / mpp > 70) || 5000, px = m / mpp;
    ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.fillRect(8, H - 26, px + 12, 18);
    ctx.strokeStyle = "#222"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(14, H - 14); ctx.lineTo(14 + px, H - 14); ctx.stroke();
    ctx.fillStyle = "#222"; ctx.font = "11px system-ui,sans-serif"; ctx.fillText(m >= 1000 ? m / 1000 + " km" : m + " m", 18, H - 17);
  }
  function tile(z, x, y) {
    const k = z + "/" + x + "/" + y; let t = tiles.get(k);
    if (!t) {
      t = {img: new Image(), ok: false, err: false};
      t.img.onload = () => { t.ok = true; dibuixa(); };
      t.img.onerror = () => { t.err = true; };
      t.img.src = tileUrl(z, x, y); tiles.set(k, t);
    }
    return t;
  }
  function pintaTeselles() {
    const tz = Math.max(TZMIN, Math.min(navigator.onLine ? 17 : TZDESC, Math.round(Z))), s = 2 ** (Z - tz);
    const x0 = wx(cLon, tz) - W / 2 / s, y0 = wy(cLat, tz) - H / 2 / s;
    for (let tx = Math.floor(x0 / 256); tx <= Math.floor((x0 + W / s) / 256); tx++)
      for (let ty = Math.floor(y0 / 256); ty <= Math.floor((y0 + H / s) / 256); ty++) {
        const sx = (tx * 256 - x0) * s, sy = (ty * 256 - y0) * s, sz = 256 * s;
        const t = tile(tz, tx, ty);
        if (t.ok) { ctx.drawImage(t.img, sx, sy, sz + .5, sz + .5); continue; }
        // si no hi és, es fa servir una tesella pare ampliada (si està carregada)
        for (let up = 1; up <= 4 && tz - up >= TZMIN; up++) {
          const f = 2 ** up, px = Math.floor(tx / f), py = Math.floor(ty / f), pk = (tz - up) + "/" + px + "/" + py, pt = tiles.get(pk);
          if (pt && pt.ok) { const ss = 256 / f; ctx.drawImage(pt.img, (tx - px * f) * ss, (ty - py * f) * ss, ss, ss, sx, sy, sz + .5, sz + .5); break; }
          if (!pt && up === 1) tile(tz - up, px, py);
        }
      }
  }
  function pintaCamins() {
    const m = CAMINS.ways, lw = Math.max(.6, Math.min(1.4, (Z - 11) / 4));
    for (const w of m) {
      const st = OSM_EST[w[0]] || OSM_EST[3], c = w[1];
      ctx.strokeStyle = st[0]; ctx.lineWidth = st[1] * lw; ctx.setLineDash(st[2]); ctx.globalAlpha = .85;
      ctx.beginPath();
      for (let i = 0; i < c.length; i += 2) { const [x, y] = scr(c[i] / 1e5, c[i + 1] / 1e5); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
    }
    ctx.setLineDash([]); ctx.globalAlpha = 1;
  }
  function pintaTrack() {
    for (const [d, col] of [[1, COL.d1], [2, COL.d2]]) {
      const lo = d === 1 ? 0 : D1END, hi = d === 1 ? D1END : 1e9;
      ctx.beginPath(); let first = true;
      for (const p of TRK) { if (p[3] < lo || p[3] > hi) continue; const [x, y] = scr(p[0], p[1]); first ? ctx.moveTo(x, y) : ctx.lineTo(x, y); first = false; }
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 7; ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = d === day ? 4.5 : 3; ctx.globalAlpha = d === day ? 1 : .6; ctx.stroke(); ctx.globalAlpha = 1;
    }
  }
  function pintaPunts() {
    const decs = new Set(PTS.filter(p => p.dec).map(p => p.c));
    ctx.font = "bold 12px system-ui,sans-serif"; ctx.textBaseline = "middle";
    for (const r of COORD) {
      const [x, y] = scr(r[2], r[3]); if (x < -40 || y < -40 || x > W + 40 || y > H + 40) continue;
      if (decs.has(r[0])) { ctx.fillStyle = COL.dec; ctx.beginPath(); ctx.moveTo(x, y - 8); ctx.lineTo(x + 8, y); ctx.lineTo(x, y + 8); ctx.lineTo(x - 8, y); ctx.closePath(); ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.stroke(); }
      else { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill(); ctx.strokeStyle = "#222"; ctx.lineWidth = 2; ctx.stroke(); }
      if (Z >= 12.5) { const tw = ctx.measureText(r[0]).width; ctx.fillStyle = "rgba(255,255,255,.88)"; ctx.fillRect(x + 9, y - 8, tw + 6, 16); ctx.fillStyle = "#111"; ctx.fillText(r[0], x + 12, y); }
    }
  }
  function pintaGps() {
    if (!gps) return;
    const [x, y] = scr(gps.lat, gps.lon), mpp = 156543.034 * Math.cos(gps.lat * Math.PI / 180) / 2 ** Z, r = Math.max(8, gps.acc / mpp);
    ctx.fillStyle = "rgba(30,136,255,.15)"; ctx.strokeStyle = "rgba(30,136,255,.5)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#1e88ff"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, 8, 0, 7); ctx.stroke(); ctx.fill();
  }

  // ----- interacció: arrossegar, pessigar, roda, doble toc -----
  const ptrs = new Map(); let pinch = null, lastTap = 0;
  function moveBy(dx, dy) { cLon = lonOf(wx(cLon, Z) - dx, Z); cLat = latOf(wy(cLat, Z) - dy, Z); }
  function zoomAt(nz, px, py) {
    nz = Math.max(ZMIN, Math.min(ZMAX, nz));
    const lat = latOf(wy(cLat, Z) + py - H / 2, Z), lon = lonOf(wx(cLon, Z) + px - W / 2, Z);
    Z = nz; cLon = lonOf(wx(lon, Z) - (px - W / 2), Z); cLat = latOf(wy(lat, Z) - (py - H / 2), Z);
    guarda(); dibuixa();
  }
  function guarda() { store.set("mapView", [cLat, cLon, Z]); }
  function lligaEvents() {
    cv.addEventListener("pointerdown", e => {
      cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.offsetX, e.offsetY]);
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = {d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: Z}; }
      const t = Date.now(); if (ptrs.size === 1 && t - lastTap < 300) zoomAt(Z + 1, e.offsetX, e.offsetY); lastTap = t;
    });
    cv.addEventListener("pointermove", e => {
      const p = ptrs.get(e.pointerId); if (!p) return;
      if (ptrs.size === 1) { moveBy(e.offsetX - p[0], e.offsetY - p[1]); dibuixa(); }
      ptrs.set(e.pointerId, [e.offsetX, e.offsetY]);
      if (ptrs.size === 2 && pinch) {
        const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        zoomAt(pinch.z + Math.log2(d / pinch.d), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      }
    });
    const up = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; guarda(); };
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
    cv.addEventListener("wheel", e => { e.preventDefault(); zoomAt(Z - e.deltaY / 300, e.offsetX, e.offsetY); }, {passive: false});
    $("#zIn").onclick = () => zoomAt(Z + 1, W / 2, H / 2);
    $("#zOut").onclick = () => zoomAt(Z - 1, W / 2, H / 2);
    $("#zMe").onclick = () => { if (!gps) { startGps(); return; } cLat = gps.lat; cLon = gps.lon; if (Z < 15) Z = 15; guarda(); dibuixa(); };
    $("#capaBtn").onclick = () => { base = base === "icgc" ? "fitxa" : "icgc"; store.set("mapBase", base); botons(); dibuixa(); };
    $("#caminsBtn").onclick = () => { caminsOn = !caminsOn; store.set("mapCamins", caminsOn); botons(); dibuixa(); };
    window.addEventListener("resize", mida);
    window.addEventListener("online", () => { tiles.forEach((t, k) => { if (t.err) tiles.delete(k); }); dibuixa(); estatTeselles(); });
    $("#tilesBtn").onclick = descarrega; $("#tilesDel").onclick = esborra;
  }
  function botons() {
    $("#capaBtn").textContent = base === "icgc" ? "Base: ICGC" : "Base: mapa de la fitxa";
    const hiHa = typeof CAMINS !== "undefined" && CAMINS;
    $("#caminsBtn").textContent = hiHa ? (caminsOn ? "Camins OSM ✓" : "Camins OSM") : "Camins OSM (no generats)";
    $("#caminsBtn").disabled = !hiHa || base !== "icgc";
    $("#caminsBtn").classList.toggle("on", !!hiHa && caminsOn && base === "icgc");
  }
  function mida() {
    if (!cv) return; const r = cv.getBoundingClientRect(); if (!r.width) return;
    dpr = window.devicePixelRatio || 1; W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); dibuixa();
  }

  // ----- teselles per anar sense cobertura -----
  function llistaTeselles() {
    const set = new Set();
    const afegeix = (lat, lon, b, z) => {
      const dl = b / 110540, dn = b / (111320 * Math.cos(lat * Math.PI / 180));
      const xa = Math.floor(wx(lon - dn, z) / 256), xb = Math.floor(wx(lon + dn, z) / 256);
      const ya = Math.floor(wy(lat + dl, z) / 256), yb = Math.floor(wy(lat - dl, z) / 256);
      for (let x = xa; x <= xb; x++) for (let y = ya; y <= yb; y++) set.add(z + "/" + x + "/" + y);
    };
    for (let z = TZMIN; z <= TZDESC; z++) {
      for (let i = 0; i < TRK.length; i += 2) afegeix(TRK[i][0], TRK[i][1], BUF[z], z);
      for (const [a, b] of PLANS_BC) {
        const A = coord(a), B = coord(b), n = Math.ceil(hav(A[2], A[3], B[2], B[3]) / 150);
        for (let i = 0; i <= n; i++) afegeix(A[2] + (B[2] - A[2]) * i / n, A[3] + (B[3] - A[3]) * i / n, BUF_BC[z], z);
      }
    }
    return [...set].map(k => tileUrl(...k.split("/")));
  }
  async function estatTeselles() {
    const el = $("#tilesStat"); if (!("caches" in window)) { el.textContent = "Aquest navegador no pot desar el mapa."; return; }
    const urls = llistaTeselles(), c = await caches.open(TILE_CACHE), keys = new Set((await c.keys()).map(r => r.url));
    const fetes = urls.filter(u => keys.has(u)).length, pc = Math.round(fetes * 100 / urls.length);
    $("#tilesProg").style.width = pc + "%";
    let mb = ""; try { const e = await navigator.storage.estimate(); mb = ` · ${Math.round(e.usage / 1048576)} MB fets servir`; } catch (e) {}
    el.innerHTML = fetes === urls.length ? `<b class="ok">Mapa de la ruta desat: ${fetes}/${urls.length} teselles.</b>${mb}` :
      `<b class="${fetes ? "warn" : ""}">${fetes}/${urls.length} teselles desades (${pc} %).</b>${mb}`;
    return {urls, keys};
  }
  let baixant = false;
  async function descarrega() {
    if (baixant) return; if (!navigator.onLine) { $("#tilesStat").textContent = "Cal connexió (millor wifi) per descarregar el mapa."; return; }
    baixant = true; $("#tilesBtn").disabled = true;
    try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) {}
    const {urls, keys} = await estatTeselles(), falta = urls.filter(u => !keys.has(u)), c = await caches.open(TILE_CACHE);
    let fet = urls.length - falta.length, errs = 0, i = 0;
    const worker = async () => {
      while (i < falta.length) {
        const u = falta[i++];
        try { const r = await fetch(u, {mode: "cors"}); if (!r.ok) throw 0; await c.put(u, r); fet++; } catch (e) { errs++; }
        if (fet % 10 === 0) { $("#tilesProg").style.width = Math.round(fet * 100 / urls.length) + "%"; $("#tilesStat").textContent = `Descarregant… ${fet}/${urls.length}`; }
      }
    };
    await Promise.all([1, 2, 3, 4, 5, 6].map(worker));
    baixant = false; $("#tilesBtn").disabled = false;
    await estatTeselles();
    if (errs) $("#tilesStat").innerHTML += ` <span class="warn">${errs} han fallat: torna a prémer el botó.</span>`;
    tiles.clear(); dibuixa();
  }
  async function esborra() {
    if (!confirm("Esborrar el mapa desat? Sense cobertura només es veurà el mapa de la fitxa.")) return;
    await caches.delete(TILE_CACHE); tiles.clear(); estatTeselles(); dibuixa();
  }

  return {
    init() {
      cv = $("#mapcv"); ctx = cv.getContext("2d");
      const v = store.get("mapView", null); if (v) [cLat, cLon, Z] = v;
      fitxaImg = new Image(); fitxaImg.onload = dibuixa; fitxaImg.src = MAPA_FITXA.src;
      lligaEvents(); botons(); estatTeselles();
    },
    mostra() { mostrat = true; mida(); estatTeselles(); },
    gps() { $("#mapStat").textContent = gps ? `GPS ±${Math.round(gps.acc)} m` : "GPS aturat"; if (mostrat) dibuixa(); },
    dibuixa,
    llistaTeselles
  };
})();
