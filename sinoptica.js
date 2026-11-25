// ---------------- TEMPS SINÒPTIC ----------------
// Mapa del temps (isòbares, anticiclons i depressions, fronts estimats, vent a 850 hPa, núvols, pluja i T a 850 hPa),
// explicació en llenguatge planer, pressió i temperatura segons l'altura, tipus de núvols i evolució al Xalet.
// Dades: Open-Meteo. Una graella de 2° sobre l'Atlàntic nord-est i Europa occidental + 3 punts de la ruta.
// Tot es desa al mòbil (localStorage) i es pot actualitzar quan es vulgui amb cobertura. Sense cobertura es veu l'última baixada.
// Els fronts NO són l'anàlisi oficial: s'estimen a partir del gradient de temperatura a 850 hPa i del vent (veure «Com llegir-ho»).
const sino = (() => {
  const KEY = "sino2", KP = "sinoPref";
  const LON0 = -20, LAT0 = 32, D = 2, NX = 19, NY = 12, K = 5, SPX = 36, SPY = 22; // graella 19×12 (2°), interpolada ×5
  const NXU = (NX - 1) * K + 1, NYU = (NY - 1) * K + 1;
  const PT = ["P0", "P6", "P5"].map(c => { const r = COORD.find(x => x[0] === c); return {c, lat: r[2], lon: r[3], e: r[5]}; });
  const RUTA = PT[1]; // el Xalet (bivac)
  const NIV = [925, 850, 700, 500];
  const GV = "pressure_msl,temperature_850hPa,wind_speed_850hPa,wind_direction_850hPa,geopotential_height_500hPa,cloud_cover,precipitation";
  const LV = ["pressure_msl", "surface_pressure", "temperature_2m", "wind_speed_10m", "wind_gusts_10m", "cloud_cover_low", "cloud_cover_mid", "cloud_cover_high", "cape", "precipitation", "weather_code", "freezing_level_height"]
    .concat(NIV.flatMap(n => ["temperature", "relative_humidity", "cloud_cover", "wind_speed", "wind_direction", "geopotential_height"].map(v => v + "_" + n + "hPa"))).join(",");
  const DS = ["Dg", "Dl", "Dt", "Dc", "Dj", "Dv", "Ds"], DSL = ["diumenge", "dilluns", "dimarts", "dimecres", "dijous", "divendres", "dissabte"];
  const dec = s => s.split("|").map(l => { let x = 0, y = 0; return l.split(" ").map(t => { const [a, b] = t.split(","); x += parseInt(a, 36); y += parseInt(b, 36); return [x / 10 - 21, y / 10 + 31]; }); });
  const LAND = dec(COSTA.l), BORD = dec(COSTA.f);

  let DATA = store.get(KEY, null), step = -1, carregant = false, playT = null, cache = {s: -1};
  const pref = Object.assign({capa: "cap", iso: true, fro: true, ven: true}, store.get(KP, {}));

  // ---------- utilitats ----------
  const pad = n => String(n).padStart(2, "0");
  const isoD = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const dIso = d => { const [y, m, dd] = DATES[d]; return y + "-" + pad(m) + "-" + pad(dd); };
  const dateOf = t => new Date(+t.slice(0, 4), +t.slice(5, 7) - 1, +t.slice(8, 10));
  const lab = t => DS[dateOf(t).getDay()] + " " + (+t.slice(8, 10)) + " · " + t.slice(11, 13) + " h";
  const labL = t => DSL[dateOf(t).getDay()] + " " + (+t.slice(8, 10));
  const n_ = x => x == null ? NaN : x;
  const f0 = x => isFinite(x) ? String(Math.round(x)) : "–";
  const f1 = x => isFinite(x) ? x.toFixed(1) : "–";
  const dirT = d => isFinite(d) ? CARD[Math.round(d / 45) % 8] : "";
  const adiff = (a, b) => ((a - b + 540) % 360) - 180; // a-b en (-180,180]
  const edatTxt = () => { if (!DATA) return ""; const m = Math.round((Date.now() - DATA.ts) / 60000); return m < 60 ? `fa ${m} min` : m < 2880 ? `fa ${Math.round(m / 60)} h` : `fa ${Math.round(m / 1440)} dies`; };
  const li = t => DATA.loc.t.indexOf(t);
  const hv = (k, i, p) => n_(DATA.loc.pts[p == null ? 1 : p][k][i]);

  // ---------- baixada ----------
  async function fj(u) {
    const c = new AbortController(), to = setTimeout(() => c.abort(), 45000);
    try { const r = await fetch(u, {signal: c.signal}); if (!r.ok) throw new Error(r.status); return await r.json(); } finally { clearTimeout(to); }
  }
  async function carrega(manual) {
    if (carregant) return;
    const estat = t => { const e = $("#sinoAct"); if (e) e.innerHTML = t; };
    if (!manual && DATA && Date.now() - DATA.ts < 3 * 3600e3) return;
    if (!navigator.onLine) { pinta(); if (manual) estat(`<span class="warn">Sense cobertura.</span> ${DATA ? "Es mostra el temps de " + edatTxt() + "." : ""}`); return; }
    carregant = true; estat("Baixant el mapa i la previsió…"); const b = $("#sinoBtn"); if (b) b.disabled = true;
    try {
      const la = [], lo = []; for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) { la.push(LAT0 + y * D); lo.push(LON0 + x * D); }
      const ug = "https://api.open-meteo.com/v1/forecast?latitude=" + la.join(",") + "&longitude=" + lo.join(",") + "&hourly=" + GV + "&timezone=Europe%2FMadrid&forecast_days=7&wind_speed_unit=kmh";
      const ul = "https://api.open-meteo.com/v1/forecast?latitude=" + PT.map(p => p.lat).join(",") + "&longitude=" + PT.map(p => p.lon).join(",") + "&elevation=" + PT.map(p => p.e).join(",") + "&hourly=" + LV + "&timezone=Europe%2FMadrid&forecast_days=7&wind_speed_unit=kmh";
      const [jg, jl] = await Promise.all([fj(ug), fj(ul)]);
      const ag = Array.isArray(jg) ? jg : [jg], al = Array.isArray(jl) ? jl : [jl];
      const T = ag[0].hourly.time, ix = []; T.forEach((t, i) => { if (+t.slice(11, 13) % 3 === 0) ix.push(i); });
      const R = (x, f) => x == null ? null : Math.round(x * f) / f;
      const g = {p: [], t8: [], ws: [], wd: [], z5: [], cc: [], pr: []};
      ix.forEach(i => {
        g.p.push(ag.map(a => R(a.hourly.pressure_msl[i], 10)));
        g.t8.push(ag.map(a => R(a.hourly.temperature_850hPa[i], 10)));
        g.ws.push(ag.map(a => R(a.hourly.wind_speed_850hPa[i], 1)));
        g.wd.push(ag.map(a => R(a.hourly.wind_direction_850hPa[i], 1)));
        g.z5.push(ag.map(a => R(a.hourly.geopotential_height_500hPa[i], 1)));
        g.cc.push(ag.map(a => R(a.hourly.cloud_cover[i], 1)));
        g.pr.push(ag.map(a => { const h = a.hourly.precipitation; return R((h[i] || 0) + (h[i - 1] || 0) + (h[i - 2] || 0), 10); }));
      });
      const nou = {ts: Date.now(), t: ix.map(i => T[i]), el: ag.map(a => Math.round(a.elevation || 0)), g, loc: {t: al[0].hourly.time, pts: al.map(a => a.hourly)}};
      const tSel = DATA && step >= 0 && step < DATA.t.length ? DATA.t[step] : null;
      DATA = nou; cache = {s: -1};
      try { localStorage.setItem("catll_" + KEY, JSON.stringify(DATA)); } catch (e) { estat(`<span class="warn">No s'ha pogut desar al mòbil (memòria plena): només es veurà mentre l'app estigui oberta.</span>`); }
      step = tSel && DATA.t.indexOf(tSel) >= 0 ? DATA.t.indexOf(tSel) : stepDefecte();
    } catch (e) {
      carregant = false; if (b) b.disabled = false; pinta();
      estat(`<span class="warn">No s'ha pogut actualitzar.</span> ${DATA ? "Es mostra el temps de " + edatTxt() + "." : ""}`); return;
    }
    carregant = false; if (b) b.disabled = false; pinta(); estat("Actualitzat ara mateix.");
  }

  function stepDefecte() {
    if (!DATA) return -1;
    const now = new Date(), T = DATA.t;
    if ([1, 2].some(d => dIso(d) === isoD(now))) { const i = T.indexOf(isoD(now) + "T" + pad(Math.floor(now.getHours() / 3) * 3) + ":00"); if (i >= 0) return i; }
    const i = T.indexOf(dIso(1) + "T12:00"); return i >= 0 ? i : 0;
  }

  // ---------- camps de la graella ----------
  const camp = (k, s) => { const a = DATA.g[k][s], f = new Float32Array(NX * NY); for (let i = 0; i < f.length; i++) f[i] = a[i] == null ? NaN : a[i]; return f; };
  const cr = (p0, p1, p2, p3, t) => p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
  function up(f) { // interpolació bicúbica ×K
    const tmp = new Float32Array(NXU * NY);
    for (let y = 0; y < NY; y++) for (let X = 0; X < NXU; X++) {
      const x = Math.min(NX - 2, Math.floor(X / K)), t = X / K - x, g = i => f[y * NX + Math.max(0, Math.min(NX - 1, i))];
      tmp[y * NXU + X] = cr(g(x - 1), g(x), g(x + 1), g(x + 2), t);
    }
    const out = new Float32Array(NXU * NYU);
    for (let Y = 0; Y < NYU; Y++) {
      const y = Math.min(NY - 2, Math.floor(Y / K)), t = Y / K - y;
      for (let X = 0; X < NXU; X++) { const g = j => tmp[Math.max(0, Math.min(NY - 1, j)) * NXU + X]; out[Y * NXU + X] = cr(g(y - 1), g(y), g(y + 1), g(y + 2), t); }
    }
    return out;
  }
  function blur(f, n) {
    let a = f, b = new Float32Array(f.length);
    for (let k = 0; k < n; k++) {
      for (let y = 0; y < NYU; y++) for (let x = 0; x < NXU; x++) {
        let s = 0, c = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= NXU || yy >= NYU) continue; s += a[yy * NXU + xx]; c++; }
        b[y * NXU + x] = s / c;
      }
      const t = a; a = b; b = t;
    }
    return a;
  }
  function contour(F, lv, mask) { // segments [x1,y1,x2,y2] en coordenades de la graella interpolada
    const segs = [], w = NXU, h = NYU;
    for (let y = 0; y < h - 1; y++) for (let x = 0; x < w - 1; x++) {
      if (mask && !mask[y * w + x]) continue;
      const a = F[y * w + x], b = F[y * w + x + 1], c = F[(y + 1) * w + x + 1], d = F[(y + 1) * w + x];
      if (a !== a || b !== b || c !== c || d !== d) continue;
      const q = [], r = (v0, v1) => (lv - v0) / (v1 - v0);
      if ((a < lv) !== (b < lv)) q[0] = [x + r(a, b), y];
      if ((b < lv) !== (c < lv)) q[1] = [x + 1, y + r(b, c)];
      if ((d < lv) !== (c < lv)) q[2] = [x + r(d, c), y + 1];
      if ((a < lv) !== (d < lv)) q[3] = [x, y + r(a, d)];
      const e = []; for (let k = 0; k < 4; k++) if (q[k]) e.push(k);
      if (e.length === 2) segs.push([...q[e[0]], ...q[e[1]]]);
      else if (e.length === 4) {
        if (((a + b + c + d) / 4 < lv) === (a < lv)) segs.push([...q[0], ...q[1]], [...q[2], ...q[3]]); else segs.push([...q[0], ...q[3]], [...q[1], ...q[2]]);
      }
    }
    return segs;
  }
  function chain(segs) {
    const key = (x, y) => Math.round(x * 1000) + "," + Math.round(y * 1000), m = new Map();
    segs.forEach((s, i) => { for (const k of [key(s[0], s[1]), key(s[2], s[3])]) { if (!m.has(k)) m.set(k, []); m.get(k).push(i); } });
    const used = new Uint8Array(segs.length), out = [];
    for (let i = 0; i < segs.length; i++) {
      if (used[i]) continue; used[i] = 1; const pts = [[segs[i][0], segs[i][1]], [segs[i][2], segs[i][3]]];
      for (const fwd of [true, false]) for (;;) {
        const p = fwd ? pts[pts.length - 1] : pts[0], k = key(p[0], p[1]), c = (m.get(k) || []).find(j => !used[j]);
        if (c === undefined) break; used[c] = 1; const s = segs[c], nx = key(s[0], s[1]) === k ? [s[2], s[3]] : [s[0], s[1]];
        if (fwd) pts.push(nx); else pts.unshift(nx);
      }
      out.push(pts);
    }
    return out;
  }
  const kmCell = lat => [D / K * 111.2 * Math.cos(lat * Math.PI / 180), D / K * 111.2]; // km per cel·la (lon, lat)
  const latU = y => LAT0 + y / (NYU - 1) * SPY, lonU = x => LON0 + x / (NXU - 1) * SPX;

  // ---------- anticiclons i depressions ----------
  function centres(F) {
    const R = 10, out = [];
    for (let y = R; y < NYU - R; y++) for (let x = R; x < NXU - R; x++) {
      const v = F[y * NXU + x]; if (v !== v) continue; let mn = true, mx = true;
      for (let dy = -R; dy <= R && (mn || mx); dy += 2) for (let dx = -R; dx <= R; dx += 2) {
        if ((!dx && !dy) || dx * dx + dy * dy > R * R) continue; const w = F[(y + dy) * NXU + x + dx];
        if (w < v) mn = false; if (w > v) mx = false; if (!mn && !mx) break;
      }
      if (mn && v < 1014) out.push({t: "D", x, y, v}); else if (mx && v > 1018) out.push({t: "A", x, y, v});
    }
    out.sort((a, b) => Math.abs(b.v - 1016) - Math.abs(a.v - 1016));
    const res = []; for (const c of out) if (!res.some(r => r.t === c.t && Math.hypot(r.x - c.x, r.y - c.y) < 22) && !res.some(r => r.t !== c.t && Math.hypot(r.x - c.x, r.y - c.y) < 8)) res.push(c);
    return res.map(c => ({...c, lon: lonU(c.x), lat: latU(c.y), v: Math.round(c.v)}));
  }

  // ---------- fronts estimats (T a 850 hPa + vent) ----------
  function fronts(s) {
    if (cache.s === s && cache.F) return cache.F;
    const r = fronts_(s); if (cache.s === s) cache.F = r; return r;
  }
  function fronts_(s) {
    const w = NXU, h = NYU, T = blur(up(camp("t8", s)), 5);
    const ws = camp("ws", s), wd = camp("wd", s), U = new Float32Array(NX * NY), V = new Float32Array(NX * NY);
    for (let i = 0; i < U.length; i++) { const r = wd[i] * Math.PI / 180; U[i] = -ws[i] * Math.sin(r); V[i] = -ws[i] * Math.cos(r); }
    const Uu = up(U), Vu = up(V), gx = new Float32Array(w * h), gy = new Float32Array(w * h), G = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const [dx, dy] = kmCell(latU(y)), i = y * w + x;
      gx[i] = (T[i + 1] - T[i - 1]) / (2 * dx) * 100; gy[i] = (T[i + w] - T[i - w]) / (2 * dy) * 100; G[i] = Math.hypot(gx[i], gy[i]);
    }
    const F = new Float32Array(w * h).fill(NaN), GMIN = 1.0;
    for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
      const [dx, dy] = kmCell(latU(y)), i = y * w + x; if (!(G[i] > 0.05)) continue;
      F[i] = -(((G[i + 1] - G[i - 1]) / (2 * dx) * 100) * gx[i] + ((G[i + w] - G[i - w]) / (2 * dy) * 100) * gy[i]) / G[i];
    }
    const EL = DATA.el ? blur(up(Float32Array.from(DATA.el)), 2) : null; // relleu: on 850 hPa (~1500 m) és sota terra la T és extrapolada
    const mask = new Uint8Array(w * h); for (let y = 0; y < h - 1; y++) for (let x = 0; x < w - 1; x++) { const i = y * w + x; if ((G[i] + G[i + 1] + G[i + w] + G[i + w + 1]) / 4 >= GMIN && !(EL && Math.max(EL[i], EL[i + 1], EL[i + w], EL[i + w + 1]) > 1100)) mask[i] = 1; }
    const samp = (A, x, y) => { const x0 = Math.max(0, Math.min(w - 2, Math.floor(x))), y0 = Math.max(0, Math.min(h - 2, Math.floor(y))), tx = x - x0, ty = y - y0; return A[y0 * w + x0] * (1 - tx) * (1 - ty) + A[y0 * w + x0 + 1] * tx * (1 - ty) + A[(y0 + 1) * w + x0] * (1 - tx) * ty + A[(y0 + 1) * w + x0 + 1] * tx * ty; };
    const out = [];
    for (const pts of chain(contour(F, 0, mask))) {
      let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (len < 14) continue; // < ~600 km: descartat
      let adv = 0, nx = 0, ny = 0, gm = 0;
      for (const [x, y] of pts) { const g1 = samp(G, x, y) || 1e-6, ex = samp(gx, x, y) / g1, ey = samp(gy, x, y) / g1; adv += samp(Uu, x, y) * ex + samp(Vu, x, y) * ey; nx += ex; ny += ey; gm += g1; }
      adv /= pts.length; gm /= pts.length; const nn = Math.hypot(nx, ny) || 1; nx /= nn; ny /= nn;
      const tipus = adv > 6 ? "fred" : adv < -6 ? "càlid" : "estacionari", sg = adv >= 0 ? 1 : -1;
      if (tipus === "estacionari" && (gm < 2.2 || len < 20)) continue; // els estacionaris febles són soroll
      out.push({tipus, pts, mx: nx * sg, my: ny * sg, adv, gm, len});
    }
    return out;
  }

  // ---------- dibuix del mapa ----------
  const RAMP = {
    t8: [[-16, [110, 70, 170, .6]], [-8, [60, 120, 205, .55]], [-2, [110, 200, 225, .5]], [3, [190, 225, 170, .45]], [8, [250, 230, 120, .5]], [13, [245, 165, 80, .55]], [19, [215, 75, 60, .6]]],
    pr: [[0.1, [130, 195, 250, .30]], [1, [70, 150, 240, .5]], [4, [40, 95, 210, .62]], [10, [115, 45, 190, .7]], [20, [200, 30, 150, .78]]]
  };
  function ramp(st, v) {
    if (v < st[0][0]) return st === RAMP.pr ? null : st[0][1];
    for (let i = 1; i < st.length; i++) if (v <= st[i][0]) { const [v0, c0] = st[i - 1], [v1, c1] = st[i], t = (v - v0) / (v1 - v0); return c0.map((a, k) => a + (c1[k] - a) * t); }
    return st[st.length - 1][1];
  }
  function capaImatge(kind, s) {
    const f = up(camp(kind, s)), cv = document.createElement("canvas"); cv.width = NXU; cv.height = NYU; const c = cv.getContext("2d"), im = c.createImageData(NXU, NYU);
    for (let Y = 0; Y < NYU; Y++) for (let X = 0; X < NXU; X++) {
      const v = f[Y * NXU + X], o = ((NYU - 1 - Y) * NXU + X) * 4; let col = null;
      if (v === v) {
        if (kind === "cc") { const a = Math.max(0, Math.min(100, v)) / 100; col = [70, 82, 100, a * .62]; }
        else if (kind === "pr") col = ramp(RAMP.pr, Math.max(0, v)); else col = ramp(RAMP.t8, v);
      }
      if (col) { im.data[o] = col[0]; im.data[o + 1] = col[1]; im.data[o + 2] = col[2]; im.data[o + 3] = Math.round(col[3] * 255); }
    }
    c.putImageData(im, 0, 0); return cv;
  }
  function dibuixa() {
    const cv = $("#sinoCv"); if (!cv) return;
    const wrap = cv.parentElement, W = Math.max(300, wrap.clientWidth), H = Math.round(W * SPY / (SPX * Math.cos(43 * Math.PI / 180))), dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + "px"; cv.style.height = H + "px";
    const c = cv.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const X = lon => (lon - LON0) / SPX * W, Y = lat => H - (lat - LAT0) / SPY * H, gX = x => x / (NXU - 1) * W, gY = y => H - y / (NYU - 1) * H;
    c.fillStyle = "#cfe0ee"; c.fillRect(0, 0, W, H);
    c.fillStyle = "#ece8dc"; for (const p of LAND) { c.beginPath(); p.forEach(([x, y], i) => i ? c.lineTo(X(x), Y(y)) : c.moveTo(X(x), Y(y))); c.closePath(); c.fill(); }
    if (!DATA || step < 0) { c.fillStyle = "#334"; c.font = "600 15px sans-serif"; c.textAlign = "center"; c.fillText("Sense dades: prem «Actualitzar el temps» amb cobertura", W / 2, H / 2); c.textAlign = "start"; return; }
    const s = step;
    if (cache.s !== s) cache = {s, P: up(camp("p", s))};
    const P = cache.P;
    if (pref.capa !== "cap") { c.imageSmoothingEnabled = true; c.drawImage(capaImatge(pref.capa, s), 0, 0, W, H); }
    c.lineWidth = .8; c.strokeStyle = "rgba(120,60,60,.55)"; c.setLineDash([4, 3]);
    for (const p of BORD) { c.beginPath(); p.forEach(([x, y], i) => i ? c.lineTo(X(x), Y(y)) : c.moveTo(X(x), Y(y))); c.stroke(); }
    c.setLineDash([]); c.lineWidth = 1; c.strokeStyle = "#4b5a66";
    for (const p of LAND) { c.beginPath(); p.forEach(([x, y], i) => i ? c.lineTo(X(x), Y(y)) : c.moveTo(X(x), Y(y))); c.stroke(); }
    // isòbares
    if (pref.iso) {
      let mn = 1e9, mx = -1e9; for (const v of P) if (v === v) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
      const labs = []; c.font = "600 10px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
      for (let lv = Math.ceil(mn / 4) * 4; lv <= mx; lv += 4) {
        const gros = lv % 20 === 0; c.strokeStyle = gros ? "#1d2b4a" : "#4a5d85"; c.lineWidth = gros ? 1.8 : .9;
        for (const pts of chain(contour(P, lv))) {
          if (pts.length < 3) continue;
          c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(gX(x), gY(y)) : c.moveTo(gX(x), gY(y))); c.stroke();
          let L = 0; const px = pts.map(([x, y]) => [gX(x), gY(y)]); for (let i = 1; i < px.length; i++) L += Math.hypot(px[i][0] - px[i - 1][0], px[i][1] - px[i - 1][1]);
          if (L < 70) continue;
          for (const fr of L > 380 ? [.2, .5, .8] : [.5]) {
            const p = px[Math.floor(px.length * fr)]; if (p[0] < 14 || p[0] > W - 14 || p[1] < 8 || p[1] > H - 8 || labs.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < 70)) continue; labs.push(p);
            c.lineWidth = 3; c.strokeStyle = "rgba(255,255,255,.85)"; c.strokeText(String(lv), p[0], p[1]); c.fillStyle = gros ? "#1d2b4a" : "#34476e"; c.fillText(String(lv), p[0], p[1]);
            c.lineWidth = gros ? 1.8 : .9; c.strokeStyle = gros ? "#1d2b4a" : "#4a5d85";
          }
        }
      }
      c.textBaseline = "alphabetic"; c.textAlign = "start";
    }
    // fronts
    if (pref.fro) {
      for (const f of fronts(s)) {
        const px = f.pts.map(([x, y]) => [gX(x), gY(y)]), nxs = f.mx, nys = -f.my; // eix y de pantalla invertit
        const col = f.tipus === "fred" ? "#1f5fd0" : f.tipus === "càlid" ? "#d03030" : "#8a3fb0";
        c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 2.4; c.setLineDash(f.tipus === "estacionari" ? [8, 5] : []);
        c.beginPath(); px.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); c.setLineDash([]);
        if (f.tipus === "estacionari") continue;
        let acc = 12;
        for (let i = 1; i < px.length; i++) {
          const [x0, y0] = px[i - 1], [x1, y1] = px[i], sl = Math.hypot(x1 - x0, y1 - y0); if (!sl) continue; const tx = (x1 - x0) / sl, ty = (y1 - y0) / sl;
          let nx = -ty, ny = tx; if (nx * nxs + ny * nys < 0) { nx = -nx; ny = -ny; }
          let pos = 0;
          while (acc <= sl - pos) {
            pos += acc; acc = 24; const bx = x0 + tx * pos, by = y0 + ty * pos;
            c.beginPath();
            if (f.tipus === "fred") { c.moveTo(bx - tx * 6, by - ty * 6); c.lineTo(bx + nx * 9, by + ny * 9); c.lineTo(bx + tx * 6, by + ty * 6); c.closePath(); }
            else c.arc(bx, by, 6.5, Math.atan2(-ty, -tx), Math.atan2(ty, tx), (nx * -ty + ny * tx) > 0);
            c.fill();
          }
          acc -= sl - pos;
        }
      }
    }
    // vent a 850 hPa
    if (pref.ven) {
      const ws = camp("ws", s), wd = camp("wd", s);
      for (let j = 1; j < NY - 1; j += 2) for (let i = 1; i < NX - 1; i += 2) {
        const v = ws[j * NX + i], d = wd[j * NX + i]; if (v !== v || d !== d) continue;
        const cx = X(LON0 + i * D), cy = Y(LAT0 + j * D), r = d * Math.PI / 180, ux = -Math.sin(r), uy = Math.cos(r), L = Math.min(38, 8 + v * .45);
        const x0 = cx - ux * L / 2, y0 = cy - uy * L / 2, x1 = cx + ux * L / 2, y1 = cy + uy * L / 2;
        c.strokeStyle = v >= 60 ? "#b03a2e" : v >= 35 ? "#c27c0e" : "#587390"; c.fillStyle = c.strokeStyle; c.lineWidth = v >= 60 ? 2.2 : 1.5;
        c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
        c.beginPath(); c.moveTo(x1, y1); c.lineTo(x1 - ux * 6 + uy * 3.5, y1 - uy * 6 - ux * 3.5); c.lineTo(x1 - ux * 6 - uy * 3.5, y1 - uy * 6 + ux * 3.5); c.closePath(); c.fill();
      }
    }
    // A i D
    c.textAlign = "center";
    for (const ct of centres(P)) {
      const x = gX(ct.x), y = gY(ct.y); c.font = "800 28px sans-serif"; c.lineWidth = 4; c.strokeStyle = "rgba(255,255,255,.9)"; c.strokeText(ct.t, x, y + 8);
      c.fillStyle = ct.t === "A" ? "#1a4fb5" : "#c62828"; c.fillText(ct.t, x, y + 8);
      c.font = "700 11px sans-serif"; c.lineWidth = 3; c.strokeText(String(ct.v), x, y + 22); c.fillText(String(ct.v), x, y + 22);
    }
    // Catllaràs
    const rx = X(RUTA.lon), ry = Y(RUTA.lat); c.fillStyle = "#e8a400"; c.strokeStyle = "#222"; c.lineWidth = 1.5; c.beginPath();
    for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 4.5 : 10; c.lineTo(rx + Math.cos(a) * r, ry + Math.sin(a) * r); } c.closePath(); c.fill(); c.stroke();
    c.font = "700 11px sans-serif"; c.textAlign = "start"; c.lineWidth = 3; c.strokeStyle = "rgba(255,255,255,.9)"; c.strokeText("Catllaràs", rx + 12, ry + 4); c.fillStyle = "#222"; c.fillText("Catllaràs", rx + 12, ry + 4);
    // títol
    const tt = lab(DATA.t[s]); c.font = "700 13px sans-serif"; const tw = c.measureText(tt).width; c.fillStyle = "rgba(20,30,20,.78)"; c.fillRect(6, 6, tw + 14, 24); c.fillStyle = "#fff"; c.fillText(tt, 13, 23);
  }

  // ---------- llegenda ----------
  function llegenda() {
    const el = $("#sinoLeg"); if (!el) return;
    const sw = (col, txt) => `<span><i style="border-color:${col}"></i>${txt}</span>`;
    let h = sw("#4a5d85", "isòbara cada 4 hPa (gruixuda cada 20)") + `<span><b style="color:#1a4fb5">A</b>&nbsp;anticicló · <b style="color:#c62828">D</b>&nbsp;depressió (hPa)</span>` +
      sw("#1f5fd0", "front fred ▲") + sw("#d03030", "front càlid ●") + sw("#8a3fb0", "estacionari") + `<span>→ vent a 850 hPa (~1500 m), cap on va</span><span>★ Catllaràs</span>`;
    const g = (a, b, txt) => `<span style="flex-basis:100%">${txt}: <i style="display:inline-block;width:110px;height:9px;border:0;vertical-align:middle;background:linear-gradient(90deg,${a.join(",")})"></i> ${b}</span>`;
    if (pref.capa === "cc") h += g(["rgba(70,82,100,0)", "rgba(70,82,100,.6)"], "0 → 100 % de cel cobert", "Núvols");
    if (pref.capa === "pr") h += g(["rgba(130,195,250,.5)", "#2d5fd2", "#7330be", "#c81e96"], "0,1 → 20 mm en 3 h", "Pluja");
    if (pref.capa === "t8") h += g(["#6e46aa", "#3c78cd", "#6ec8e1", "#bee1aa", "#fae678", "#f5a550", "#d74b3c"], "−16 → 19 °C", "T a 850 hPa");
    el.innerHTML = h;
  }

  // ---------- explicació de la situació ----------
  function propers(F, s) {
    const cs = centres(F), out = {};
    for (const t of ["A", "D"]) {
      let best = null; for (const c of cs) if (c.t === t) { const d = hav(RUTA.lat, RUTA.lon, c.lat, c.lon) / 1000; if (!best || d < best.d) best = {...c, d, b: bearing(RUTA.lat, RUTA.lon, c.lat, c.lon)}; }
      out[t] = best;
    }
    return out;
  }
  function gradP(F) { // gradient de pressió a la ruta en hPa/100 km
    const x = (RUTA.lon - LON0) / SPX * (NXU - 1), y = (RUTA.lat - LAT0) / SPY * (NYU - 1), xi = Math.round(x), yi = Math.round(y), [dx, dy] = kmCell(RUTA.lat), r = 4;
    const gx = (F[yi * NXU + xi + r] - F[yi * NXU + xi - r]) / (2 * r * dx) * 100, gy = (F[(yi + r) * NXU + xi] - F[(yi - r) * NXU + xi]) / (2 * r * dy) * 100;
    return Math.hypot(gx, gy);
  }
  function textMapa(s) {
    const t = DATA.t[s], F = cache.s === s ? cache.P : up(camp("p", s)), pr = propers(F, s), ix = li(t), o = [];
    const pm = ix >= 0 ? hv("pressure_msl", ix) : NaN;
    if (isFinite(pm)) o.push(`Pressió al nivell del mar sobre la ruta: <b>${f0(pm)} hPa</b> ${pm >= 1022 ? "(alta: ambient anticiclònic)" : pm <= 1008 ? "(baixa: ambient depressionari)" : "(normal)"}.`);
    for (const [k, nom] of [["A", "Anticicló"], ["D", "Depressió"]]) { const c = pr[k]; if (c) o.push(`${nom} de <b>${c.v} hPa</b> a uns ${f0(Math.round(c.d / 50) * 50)} km al ${dirT(c.b)} de la ruta.`); }
    if (!pr.A && !pr.D) o.push("No es veu cap centre d'alta ni de baixa clar a prop: pressions i vent dependen del gradient, no d'un sistema concret.");
    const g = gradP(F); o.push(`Gradient de pressió a la ruta: ${g.toFixed(1)} hPa/100 km → ${g < .4 ? "feble: vent fluix i variable, dominen les brises i la inversió" : g < 1 ? "moderat" : "fort: vent sostingut, sobretot a les carenes"}.`);
    const ff = fronts(s).map(f => { let best = null; for (const [x, y] of f.pts) { const d = hav(RUTA.lat, RUTA.lon, latU(y), lonU(x)) / 1000; if (!best || d < best.d) best = {d, b: bearing(RUTA.lat, RUTA.lon, latU(y), lonU(x)), x, y}; } return {...f, ...best}; }).filter(f => f.d < 1500).sort((a, b) => a.d - b.d).slice(0, 3);
    if (ff.length) for (const f of ff) {
      const vx = lonU(f.x) - RUTA.lon, vy = latU(f.y) - RUTA.lat, cap = f.tipus !== "estacionari" && (f.mx * -vx + f.my * -vy) > 0;
      o.push(`Front ${f.tipus} estimat a uns ${f0(Math.round(f.d / 50) * 50)} km al ${dirT(f.b)}${f.tipus === "estacionari" ? " (gairebé aturat)" : cap ? ", avançant cap a la ruta" : ", allunyant-se de la ruta"}.`);
    } else o.push("Cap front estimat a menys de 1.500 km.");
    return o;
  }

  // ---------- episodis de canvi de massa d'aire (fronts al Xalet) ----------
  function episodis() {
    if (!DATA) return [];
    const T = DATA.loc.pts[1].temperature_850hPa, Dd = DATA.loc.pts[1].wind_direction_850hPa, tm = DATA.loc.t, ev = [];
    for (let i = 12; i < T.length; i++) {
      if (T[i] == null || T[i - 12] == null) continue;
      const dT = T[i] - T[i - 12], dd = Dd[i] != null && Dd[i - 12] != null ? adiff(Dd[i], Dd[i - 12]) : NaN;
      const tipus = dT <= -3.5 ? "fred" : dT >= 3.5 ? "càlid" : null; if (!tipus) continue;
      let wmx = 0; for (let k = i - 12; k <= i; k++) wmx = Math.max(wmx, DATA.loc.pts[1].wind_speed_850hPa[k] || 0);
      const last = ev[ev.length - 1];
      if (last && last.tipus === tipus && i - last.fi <= 6) { last.fi = i; last.wmx = Math.max(last.wmx, wmx); if (Math.abs(dT) > Math.abs(last.dT)) { last.dT = dT; last.dd = dd; } continue; }
      ev.push({tipus, i0: i - 12, fi: i, dT, dd, wmx});
    }
    return ev.map(e => {
      let best = e.i0 + 1, mx = 0; for (let i = e.i0 + 3; i <= e.fi; i++) { const d = Math.abs((T[i] ?? 0) - (T[i - 3] ?? 0)); if (d > mx) { mx = d; best = i; } }
      return {...e, t: tm[best], tIni: tm[e.i0], tFi: tm[e.fi], front: e.wmx >= 20};
    });
  }

  // ---------- núvols ----------
  function nuvols(i) {
    const g = (k, p) => hv(k, i, p), low = g("cloud_cover_low"), mid = g("cloud_cover_mid"), high = g("cloud_cover_high"), cape = g("cape") || 0, pr = g("precipitation") || 0, code = g("weather_code");
    const c925 = g("cloud_cover_925hPa"), c850 = g("cloud_cover_850hPa"), r850 = g("relative_humidity_850hPa"), cap = [];
    let a;
    if (high < 10) a = ["Cap o gairebé cap", "cel net a gran alçada"]; else if (high < 40) a = ["Cirrus", "filaments blancs: bon temps, sense canvis immediats"];
    else if (high < 80) a = ["Cirrus i cirrostrats", "si engruixen i la pressió baixa, anuncien un front en 12–24 h"]; else a = ["Cirrostrats", "vel blanquinós amb halo al sol: el temps empitjorarà en 12–24 h si baixa la pressió"];
    cap.push({capa: "Alts (> 6 km)", cob: high, tipus: a[0], nota: a[1]});
    if (mid < 10) a = ["Cap o gairebé cap", ""]; else if (mid < 40) a = ["Altocúmuls dispersos", "sense conseqüències"]; else if (mid < 75) a = ["Altocúmuls / altostrats en bandes", "sol difús; pot canviar el temps"];
    else a = pr >= .2 ? ["Nimbostrats", "pluja o neu contínua i cel gris, poca visibilitat"] : ["Altostrats", "sol difús o tapat, cel gris"];
    cap.push({capa: "Mitjans (2–6 km)", cob: mid, tipus: a[0], nota: a[1]});
    let cb = false;
    if (low < 10) a = ["Cap o gairebé cap", ""];
    else if (cape >= 500 && (pr > .3 || code >= 80)) { a = ["Cumulonimbus", "tempestes, calamarsa i ratxes: evitar carenes"]; cb = true; }
    else if (cape >= 150) a = ["Cúmuls (congestus si creixen)", "ruixats aïllats a la tarda si es desenvolupen"];
    else if (low >= 70) a = ["Estrats / estratocúmuls", "cel tancat i baix; boira o plugim possibles"]; else a = ["Estratocúmuls o cúmuls humils", "poc significatius"];
    cap.push({capa: "Baixos (< 2 km)", cob: low, tipus: a[0], nota: a[1], cb});
    let ruta;
    if (code === 45 || code === 48) ruta = ["bad", "El model dona boira a la ruta."];
    else if (c850 >= 60 && r850 >= 85) ruta = ["warn", "El Xalet (1.372 m) i P5 (1.563 m) són probablement dins del núvol: boira i poca visibilitat."];
    else if (c925 >= 60 && c850 < 40) ruta = ["ok", "Núvols baixos a les valls (sota ~1.200 m): possible mar de núvols; P0 (916 m) pot ser dins la boira i el Xalet quedar per sobre."];
    else ruta = ["ok", "Sense indicis de boira a la ruta."];
    return {cap, ruta};
  }

  // ---------- pressió, temperatura i vent segons l'altura ----------
  function perfil(i) {
    const rows = []; for (const n of [500, 700, 850, 925]) rows.push({n, z: hv("geopotential_height_" + n + "hPa", i), t: hv("temperature_" + n + "hPa", i), rh: hv("relative_humidity_" + n + "hPa", i), cc: hv("cloud_cover_" + n + "hPa", i), ws: hv("wind_speed_" + n + "hPa", i), wd: hv("wind_direction_" + n + "hPa", i)});
    const fz = hv("freezing_level_height", i), ps = PT.map((p, k) => ({...p, ps: hv("surface_pressure", i, k), t: hv("temperature_2m", i, k), ws: hv("wind_speed_10m", i, k)}));
    const msl = hv("pressure_msl", i);
    // taula
    let h = `<div class="scroll"><table class="met"><tr><th>Nivell</th><th>Alçada</th><th>Pressió</th><th>T</th><th>Vent km/h</th><th>Humitat</th><th>Núvol</th></tr>`;
    for (const r of rows) h += `<tr><td><b>${r.n} hPa</b></td><td>${f0(r.z)} m</td><td>${r.n} hPa</td><td>${f0(r.t)}°</td><td>${f0(r.ws)} (${dirT(r.wd)})</td><td>${f0(r.rh)} %</td><td>${f0(r.cc)} %</td></tr>`;
    for (const p of ps.slice().reverse()) h += `<tr style="background:var(--card2)"><td><b>${p.c}</b> terra</td><td>${f0(p.e)} m</td><td><b>${f0(p.ps)} hPa</b></td><td>${f0(p.t)}°</td><td>${f0(p.ws)} (10 m)</td><td>–</td><td>–</td></tr>`;
    h += `<tr><td>Nivell del mar</td><td>0 m</td><td>${f0(msl)} hPa</td><td colspan="4" class="mut">pressió reduïda al nivell del mar</td></tr></table></div>`;
    h += `<p class="small mut" style="margin:6px 0">La pressió baixa uns 11–12 hPa cada 100 m a aquesta alçada. Les alçades dels nivells de 925/850/700/500 hPa canvien amb la massa d'aire: més baixes amb aire fred.${isFinite(fz) ? ` Isoterma de 0 °C a <b>${f0(Math.round(fz / 50) * 50)} m</b>.` : ""}</p>`;
    // gràfic
    const Wd = 360, Ht = 280, ymax = 6000, Y = z => 260 - z / ymax * 240, Xt = t => 34 + (t + 32) / 52 * 190;
    let s = `<svg viewBox="0 0 ${Wd} ${Ht}" style="width:100%;max-width:460px;background:var(--card2);border-radius:10px" font-family="sans-serif" font-size="10">`;
    for (let z = 0; z <= ymax; z += 1000) s += `<line x1="34" x2="${Wd - 6}" y1="${Y(z)}" y2="${Y(z)}" stroke="var(--line)"/><text x="30" y="${Y(z) + 3}" text-anchor="end" fill="var(--mut)">${z / 1000} km</text>`;
    s += `<rect x="34" y="${Y(PT[2].e)}" width="${Wd - 40}" height="${Y(PT[0].e) - Y(PT[2].e)}" fill="rgba(127,201,127,.22)"/><text x="38" y="${Y(PT[2].e) - 3}" fill="var(--ok)">ruta 916–1563 m</text>`;
    if (isFinite(fz)) s += `<line x1="34" x2="${Wd - 6}" y1="${Y(fz)}" y2="${Y(fz)}" stroke="var(--blue)" stroke-dasharray="4 3"/><text x="38" y="${Y(fz) - 2}" fill="var(--blue)">0 °C a ${f0(Math.round(fz / 50) * 50)} m</text>`;
    s += `<line x1="${Xt(0)}" x2="${Xt(0)}" y1="20" y2="260" stroke="var(--blue)" stroke-opacity=".35"/>`;
    const pts = [[PT[1].e, ps[1].t]].concat(rows.slice().sort((a, b) => a.z - b.z).filter(r => r.z > PT[1].e + 50 && isFinite(r.t)).map(r => [r.z, r.t])).filter(p => isFinite(p[1]));
    s += `<polyline fill="none" stroke="var(--warn)" stroke-width="2.5" points="${pts.map(p => Xt(p[1]).toFixed(1) + "," + Y(p[0]).toFixed(1)).join(" ")}"/>`;
    pts.forEach(p => s += `<circle cx="${Xt(p[1])}" cy="${Y(p[0])}" r="3" fill="var(--warn)"/><text x="${Xt(p[1]) + 6}" y="${Y(p[0]) + 3}" fill="var(--tx)">${f0(p[1])}°</text>`);
    for (const r of rows) {
      if (!isFinite(r.z)) continue; const y = Y(r.z);
      s += `<text x="${34 + 2}" y="${y + 12}" fill="var(--mut)">${r.n} hPa</text>`;
      s += `<rect x="${Wd - 100}" y="${y - 6}" width="${(isFinite(r.cc) ? r.cc : 0) / 100 * 40}" height="12" rx="3" fill="#8794a8"/><text x="${Wd - 100}" y="${y - 9}" fill="var(--mut)" font-size="9">núvol ${f0(r.cc)} %</text>`;
      if (isFinite(r.ws) && isFinite(r.wd)) { const a = r.wd + 180; s += `<g transform="translate(${Wd - 28},${y}) rotate(${a})"><line x1="0" y1="10" x2="0" y2="-10" stroke="${r.ws >= 60 ? "var(--bad)" : r.ws >= 35 ? "var(--warn)" : "var(--tx)"}" stroke-width="2"/><polygon points="0,-12 -4,-5 4,-5" fill="${r.ws >= 60 ? "var(--bad)" : r.ws >= 35 ? "var(--warn)" : "var(--tx)"}"/></g><text x="${Wd - 28}" y="${y + 22}" text-anchor="middle" fill="var(--mut)" font-size="9">${f0(r.ws)}</text>`; }
    }
    s += `<text x="${Xt(-32)}" y="14" fill="var(--mut)" font-size="9">T (°C): -32 … +20</text><text x="${Wd - 28}" y="14" text-anchor="middle" fill="var(--mut)" font-size="9">vent km/h</text></svg>`;
    return h + s + `<p class="small mut" style="margin:6px 0 0">Línia taronja: temperatura segons l'altura (des del Xalet). Franja verda: alçada de la ruta. Fletxa: cap on va el vent a cada nivell. Barra grisa: % de núvol a aquell nivell.</p>`;
  }

  // ---------- evolució al Xalet ----------
  function evo(s) {
    const L = DATA.loc, P = L.pts[1], n = L.t.length, W = 360, H = 200, x0 = 34, x1 = 326, xs = i => x0 + i / (n - 1) * (x1 - x0);
    let pmn = 1e9, pmx = -1e9, tmn = 1e9, tmx = -1e9; for (let i = 0; i < n; i++) { const p = P.pressure_msl[i], t = P.temperature_850hPa[i]; if (p != null) { pmn = Math.min(pmn, p); pmx = Math.max(pmx, p); } if (t != null) { tmn = Math.min(tmn, t); tmx = Math.max(tmx, t); } }
    pmn = Math.floor(pmn / 4) * 4 - 2; pmx = Math.ceil(pmx / 4) * 4 + 2; tmn = Math.floor(tmn / 2) * 2 - 1; tmx = Math.ceil(tmx / 2) * 2 + 1;
    const yp = v => 150 - (v - pmn) / (pmx - pmn) * 130, yt = v => 150 - (v - tmn) / (tmx - tmn) * 130;
    let svg = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:520px;background:var(--card2);border-radius:10px" font-family="sans-serif" font-size="10">`;
    for (const d of [1, 2]) { const a = L.t.indexOf(dIso(d) + "T00:00"); if (a >= 0) svg += `<rect x="${xs(a)}" y="14" width="${xs(Math.min(n - 1, a + 24)) - xs(a)}" height="136" fill="rgba(127,201,127,.16)"/>`; }
    for (let i = 0; i < n; i += 24) svg += `<line x1="${xs(i)}" x2="${xs(i)}" y1="14" y2="154" stroke="var(--line)"/><text x="${xs(i) + 3}" y="166" fill="var(--mut)">${DS[dateOf(L.t[i]).getDay()]} ${+L.t[i].slice(8, 10)}</text>`;
    for (let i = 0; i < n; i++) { const pr = P.precipitation[i]; if (pr > 0) svg += `<rect x="${xs(i) - 1}" y="${150 - Math.min(pr, 6) / 6 * 40}" width="2.2" height="${Math.min(pr, 6) / 6 * 40}" fill="#4a90e2" opacity=".75"/>`; }
    const line = (arr, f, col) => { let d = "", on = false; arr.forEach((v, i) => { if (v == null) { on = false; return; } d += (on ? "L" : "M") + xs(i).toFixed(1) + " " + f(v).toFixed(1); on = true; }); return `<path d="${d}" fill="none" stroke="${col}" stroke-width="2"/>`; };
    svg += line(P.pressure_msl, yp, "#79b8ff") + line(P.temperature_850hPa, yt, "#ffb84d");
    for (let v = Math.ceil(pmn / 4) * 4; v <= pmx; v += 4) svg += `<text x="31" y="${yp(v) + 3}" text-anchor="end" fill="#79b8ff">${v}</text>`;
    for (let v = Math.ceil(tmn / 4) * 4; v <= tmx; v += 4) svg += `<text x="${x1 + 4}" y="${yt(v) + 3}" fill="#ffb84d">${v}°</text>`;
    const cx = L.t.indexOf(DATA.t[s]); if (cx >= 0) svg += `<line x1="${xs(cx)}" x2="${xs(cx)}" y1="14" y2="154" stroke="var(--bad)" stroke-width="1.5"/>`;
    for (const e of episodis().filter(e => e.front)) svg += `<text x="${xs(L.t.indexOf(e.t))}" y="11" text-anchor="middle" font-size="12" fill="${e.tipus === "fred" ? "#79b8ff" : "#ff8a80"}">${e.tipus === "fred" ? "▲" : "●"}</text>`;
    svg += `<text x="${x0}" y="${H - 8}" fill="#79b8ff">— pressió al nivell del mar (hPa)</text><text x="${x0 + 150}" y="${H - 8}" fill="#ffb84d">— T a 850 hPa (°C)</text><text x="${x0 + 270}" y="${H - 8}" fill="#4a90e2">▮ pluja</text></svg>`;
    return svg + `<p class="small mut" style="margin:6px 0 0">Franja verda: dissabte 28 i diumenge 29. Línia vermella: l'hora del mapa. ▲ caiguda de T a 850 hPa (pas de front fred o aire més fred) · ● pujada (aire més càlid o front càlid).</p>`;
  }

  // ---------- resum del cap de setmana ----------
  function resum() {
    if (!DATA) return "";
    const ev = episodis(); let h = "";
    for (const d of [1, 2]) {
      const di = dIso(d), i12 = li(di + "T12:00");
      if (i12 < 0 || DATA.t.indexOf(di + "T12:00") < 0) { h += `<div class="fblk"><b>${labL(di + "T12:00")}</b><p class="mut small">La previsió desada no arriba a aquesta data. Torna-hi més a prop de la sortida.</p></div>`; continue; }
      const s12 = DATA.t.indexOf(di + "T12:00"), pm = hv("pressure_msl", i12), d12 = pm - hv("pressure_msl", i12 - 12), d24 = i12 >= 24 ? pm - hv("pressure_msl", i12 - 24) : NaN;
      const t8 = hv("temperature_850hPa", i12), t8a = i12 >= 24 ? hv("temperature_850hPa", i12 - 24) : NaN, w8 = hv("wind_speed_850hPa", i12), wd8 = hv("wind_direction_850hPa", i12);
      const tend = !isFinite(d12) ? "" : d12 >= 3 ? "puja amb força (millora, aire fred i sec)" : d12 >= 1.5 ? "puja (millora)" : d12 <= -3 ? "baixa amb força (empitjora: s'acosta un front o una depressió)" : d12 <= -1.5 ? "baixa (empitjora)" : "estable";
      const F = up(camp("p", s12)), pr = propers(F, s12), li_ = [];
      li_.push(`Pressió al Xalet a les 12 h: <b>${f0(pm)} hPa</b> (nivell del mar) · últimes 12 h: <b>${isFinite(d12) ? (d12 > 0 ? "+" : "") + f1(d12) : "–"} hPa</b>${tend ? " → " + tend : ""}.`);
      const sist = []; if (pr.A) sist.push(`anticicló de ${pr.A.v} hPa a ~${f0(Math.round(pr.A.d / 50) * 50)} km al ${dirT(pr.A.b)}`); if (pr.D) sist.push(`depressió de ${pr.D.v} hPa a ~${f0(Math.round(pr.D.d / 50) * 50)} km al ${dirT(pr.D.b)}`);
      li_.push("Sistemes: " + (sist.length ? sist.join("; ") : "cap centre clar de pressió a prop") + ".");
      if (isFinite(t8)) li_.push(`Aire a 850 hPa (~1500 m): <b>${f0(t8)} °C</b>${isFinite(t8a) ? ` (${t8 - t8a >= 0 ? "+" : ""}${f0(t8 - t8a)} °C respecte d'ahir)` : ""}, vent <b>${f0(w8)} km/h</b> (${dirT(wd8)}). ${isFinite(t8a) && t8 - t8a <= -3 ? "Entra aire més fred." : isFinite(t8a) && t8 - t8a >= 3 ? "Entra aire més càlid." : "Massa d'aire similar a la del dia abans."}`);
      const dels = ev.filter(e => { const te = dateOf(e.t); te.setHours(+e.t.slice(11, 13) + 6); return isoD(te) === di; }); // de les 18 h del dia abans a les 18 h d'aquest dia
      if (dels.length) for (const e of dels) {
        const gir = isFinite(e.dd) && Math.abs(e.dd) >= 25 && e.front ? `, amb gir del vent de ${f0(Math.abs(e.dd))}° cap a ${e.dd > 0 ? "la dreta (sentit horari)" : "l'esquerra"}` : "", hora = `cap a les <b>${e.t.slice(11, 13)} h del ${labL(e.t)}</b>`, dt = `T a 850 hPa ${e.dT > 0 ? "+" : ""}${f0(e.dT)} °C en 12 h`;
        if (e.front) li_.push(`<b class="warn">${e.tipus === "fred" ? "Front fred (o entrada d'aire més fred)" : "Front càlid (o entrada d'aire més càlid)"}</b> ${hora}: ${dt}${gir}. ${e.tipus === "fred" ? "Sol portar vent fort, ruixats i baixada de la cota de neu, i després aclarida i fred." : "Sol portar núvols alts que engruixeixen, pluja feble contínua i cota de neu alta."}`);
        else li_.push(`${e.tipus === "fred" ? "Refredament" : "Escalfament"} lent de l'aire ${hora}: ${dt}, amb vent fluix a 850 hPa. Canvi de massa d'aire sense front clar.`);
      }
      else li_.push("Cap front clar al Xalet aquest dia (la temperatura a 850 hPa no canvia de forma brusca).");
      const n9 = nuvols(li(di + "T09:00")), n15 = nuvols(li(di + "T15:00"));
      const rs = c => c.cap.filter(x => x.cob >= 10).map(x => `${x.tipus.toLowerCase()} (${f0(x.cob)} %)`).join(", ") || "cel gairebé net";
      li_.push(`Núvols a les 9 h: ${rs(n9)}. A les 15 h: ${rs(n15)}.`);
      h += `<div class="fblk"><b>${labL(di + "T12:00")}</b><ul>${li_.map(x => `<li>${x}</li>`).join("")}</ul></div>`;
    }
    return h;
  }

  // ---------- interfície ----------
  function pinta() {
    const act = $("#sinoAct"); if (act && DATA && !carregant) act.textContent = "Actualitzat " + edatTxt() + (Date.now() - DATA.ts > 12 * 3600e3 ? " · massa antic: actualitza'l amb cobertura" : "");
    const sl = $("#sinoSl"); if (sl && DATA) { sl.max = DATA.t.length - 1; sl.value = step; }
    document.querySelectorAll("#sinoCapa button").forEach(b => b.classList.toggle("on", b.dataset.v === pref.capa));
    document.querySelectorAll("#sinoTog button").forEach(b => b.classList.toggle("on", !!pref[b.dataset.v]));
    if (!DATA) { for (const id of ["sinoText", "sinoResum", "sinoPerfil", "sinoNuv", "sinoEvo"]) { const e = $("#" + id); if (e) e.innerHTML = '<span class="mut small">Sense dades desades. Prem «Actualitzar el temps» amb cobertura.</span>'; } dibuixa(); llegenda(); return; }
    if (step < 0 || step >= DATA.t.length) step = stepDefecte();
    const t = DATA.t[step]; $("#sinoLab").textContent = lab(t);
    const pre = $("#sinoPre"); if (pre) pre.innerHTML = [["Ds 28 · 9 h", dIso(1) + "T09:00"], ["Ds 28 · 15 h", dIso(1) + "T15:00"], ["Ds 28 · 21 h", dIso(1) + "T21:00"], ["Dg 29 · 9 h", dIso(2) + "T09:00"], ["Dg 29 · 15 h", dIso(2) + "T15:00"]].filter(x => DATA.t.indexOf(x[1]) >= 0).map(x => `<button data-t="${x[1]}" class="${x[1] === t ? "on" : ""}">${x[0]}</button>`).join("");
    dibuixa(); llegenda();
    $("#sinoText").innerHTML = `<p class="small mut" style="margin:0 0 6px"><b>${labL(t)} a les ${t.slice(11, 13)} h</b> (el moment del mapa)</p><ul>${textMapa(step).map(x => `<li>${x}</li>`).join("")}</ul>`;
    $("#sinoResum").innerHTML = resum();
    const i = li(t);
    if (i < 0) { for (const id of ["sinoPerfil", "sinoNuv"]) $("#" + id).innerHTML = '<span class="mut small">Sense dades locals per a aquesta hora.</span>'; }
    else {
      $("#sinoPerfil").innerHTML = perfil(i);
      const nv = nuvols(i);
      $("#sinoNuv").innerHTML = `<div class="scroll"><table class="met"><tr><th>Capa</th><th>Cobertura</th><th>Tipus</th><th>Què vol dir</th></tr>${nv.cap.map(x => `<tr><td>${x.capa}</td><td>${f0(x.cob)} %</td><td><b class="${x.cb ? "bad" : ""}">${x.tipus}</b></td><td style="white-space:normal;min-width:170px">${x.nota}</td></tr>`).join("")}</table></div><p class="${nv.ruta[0]}" style="margin:8px 0 0"><b>A la ruta:</b> ${nv.ruta[1]}</p><p class="small mut" style="margin:6px 0 0">Els tipus de núvol s'dedueixen de la cobertura per capes, la humitat, la inestabilitat (CAPE) i la pluja del model: són orientatius.</p>`.replace("s'dedueixen", "es dedueixen");
    }
    $("#sinoEvo").innerHTML = evo(step);
  }
  function posa(s) { step = Math.max(0, Math.min(DATA.t.length - 1, s)); pinta(); }
  function atura() { if (playT) { clearInterval(playT); playT = null; const b = $("#sinoPlay"); if (b) b.textContent = "▶"; } }

  return {
    init() {
      if (DATA && !DATA.loc) DATA = null;
      step = stepDefecte();
      $("#sinoBtn").onclick = () => { atura(); carrega(true); };
      $("#sinoSl").oninput = e => { atura(); posa(+e.target.value); };
      $("#sinoPrev").onclick = () => { atura(); if (DATA) posa(step - 1); };
      $("#sinoNext").onclick = () => { atura(); if (DATA) posa(step + 1); };
      $("#sinoPlay").onclick = () => { if (!DATA) return; if (playT) return atura(); $("#sinoPlay").textContent = "❚❚"; playT = setInterval(() => posa(step + 1 >= DATA.t.length ? 0 : step + 1), 900); };
      $("#sinoPre").addEventListener("click", e => { const b = e.target.closest("button"); if (!b || !DATA) return; atura(); const i = DATA.t.indexOf(b.dataset.t); if (i >= 0) posa(i); });
      $("#sinoCapa").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; pref.capa = b.dataset.v; store.set(KP, pref); pinta(); });
      $("#sinoTog").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; pref[b.dataset.v] = !pref[b.dataset.v]; store.set(KP, pref); pinta(); });
      window.addEventListener("online", () => { if ($("#s-temps").classList.contains("act")) carrega(false); });
      window.addEventListener("resize", () => { if ($("#s-temps").classList.contains("act")) { dibuixa(); } });
    },
    // en obrir la pestanya: pinta i, si les dades tenen més de 3 h i hi ha cobertura, les actualitza
    mostra() { pinta(); carrega(false); },
    carrega
  };
})();
