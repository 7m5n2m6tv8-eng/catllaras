// ---------------- SEGUIR UN PLA B o C ----------------
// Quan se segueix un pla B o C, la pantalla «Ara» mostra el progrés sobre el traçat d'aquell pla:
// km fets, distància al track, i què falta fins a la pròxima fita i fins al final (km, desnivell, temps i arribada).
// Km, desnivell i temps de cada tram són els de la fitxa; dins del tram es reparteixen segons el traçat.
const pla = (() => {
  let actiu = store.get("pla", "A");
  let marques = store.get("plaMarques", {}); // {"B2:PB": minuts}
  let lastM = null;
  if (actiu !== "A" && !PLANS_BC[actiu]) actiu = "A";
  // desnivell acumulat del traçat de cada pla, per repartir el de la fitxa dins de cada tram
  for (const k in PLANS_BC) {
    const p = PLANS_BC[k].pts, up = [0], dn = [0];
    for (let i = 1; i < p.length; i++) { const dz = p[i][2] - p[i - 1][2]; up.push(up[i - 1] + Math.max(0, dz)); dn.push(dn[i - 1] + Math.max(0, -dz)); }
    PLANS_BC[k].cu = up; PLANS_BC[k].cd = dn;
  }
  const P = () => PLANS_BC[actiu];
  const nomFita = c => (COORD.find(r => r[0] === c) || [])[1] || NOMS_FITES[c] || c;
  function cumAtP(pl, arr, m) {
    const p = pl.pts; if (m <= 0) return 0;
    for (let i = 1; i < p.length; i++) if (p[i][3] >= m) { const f = (m - p[i - 1][3]) / Math.max(1, p[i][3] - p[i - 1][3]); return arr[i - 1] + f * (arr[i] - arr[i - 1]); }
    return arr[arr.length - 1];
  }
  // què falta entre dos punts del traçat (metres del traçat): km, desnivell i minuts de marxa segons la fitxa
  function falta(pl, m0, m1) {
    let km = 0, up = 0, dn = 0, min = 0;
    for (const s of pl.segs) {
      const a = Math.max(m0, s.m0), b = Math.min(m1, s.m1); if (b <= a) continue;
      const fr = (b - a) / Math.max(1, s.m1 - s.m0);
      const tu = cumAtP(pl, pl.cu, s.m1) - cumAtP(pl, pl.cu, s.m0), td = cumAtP(pl, pl.cd, s.m1) - cumAtP(pl, pl.cd, s.m0);
      km += s.km * fr; min += s.min * fr;
      up += s.up * (tu > 0 ? (cumAtP(pl, pl.cu, b) - cumAtP(pl, pl.cu, a)) / tu : fr);
      dn += s.dn * (td > 0 ? (cumAtP(pl, pl.cd, b) - cumAtP(pl, pl.cd, a)) / td : fr);
    }
    return {km, up: Math.round(up), dn: Math.round(dn), min: min * 1.15}; // +15 % de parades, com a la fitxa
  }
  function snapP(pl, lat, lon) {
    const kx = Math.cos(lat * Math.PI / 180) * 111320, ky = 110540, p = pl.pts;
    let best = null, win = null;
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i], b = p[i + 1], ax = (a[1] - lon) * kx, ay = (a[0] - lat) * ky, bx = (b[1] - lon) * kx, by = (b[0] - lat) * ky;
      const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy; let t = L ? -(ax * dx + ay * dy) / L : 0; t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(ax + t * dx, ay + t * dy), m = a[3] + t * (b[3] - a[3]), c = {dist: d, m};
      if (!best || d < best.dist) best = c;
      if (lastM !== null && m >= lastM - 300 && m <= lastM + 1500 && (!win || d < win.dist)) win = c;
    }
    if (win && win.dist < best.dist + 40) best = win;
    return best;
  }
  function progres(pl) {
    if (gps) { const s = snapP(pl, gps.lat, gps.lon); if (s && s.dist < 300) { lastM = s.m; return {m: s.m, src: "gps", dist: s.dist}; } }
    let last = null; pl.fites.forEach(([c, m]) => { if (marques[actiu + ":" + c] !== undefined) last = {c, m}; });
    return last ? {m: last.m, src: "marca", c: last.c} : null;
  }
  const g4 = (f, arr, n) => `<div class="g4"><div><b>${f.km.toFixed(2).replace(".", ",")} km</b><span>distància</span></div><div><b>+${f.up} / −${f.dn} m</b><span>desnivell</span></div><div><b>${fmtDur(f.min)}</b><span>temps</span></div><div><b>${fmtMin(arr)}</b><span>arribada</span></div></div>`;

  function selector() {
    const ops = ["A", ...Object.keys(PLANS_BC)];
    $("#plaSeg").innerHTML = ops.map(k => `<button data-pla="${k}" class="${k === actiu ? "on" : ""}">${k}</button>`).join("");
  }
  function tria(k, inicial) {
    actiu = k; lastM = null; store.set("pla", k); selector();
    const enB = k !== "A";
    ["#nextCard", "#faltaCard", "#decCard"].forEach(s => $(s).style.display = enB ? "none" : "");
    $("#plaCard").style.display = enB ? "" : "none";
    if (enB && !inicial && PLANS_BC[k].dia !== day) setDay(PLANS_BC[k].dia); else tick();
    if (typeof mapa !== "undefined") mapa.dibuixa();
  }
  // Pinta la targeta del pla. Retorna les alertes; null si se segueix el pla A.
  function render(n, SAFEm) {
    if (actiu === "A") return null;
    const pl = P(), pr = progres(pl), out = [], tot = pl.pts[pl.pts.length - 1][3];
    let h = `<div class="hd"><span class="code">${actiu}</span> <b>${esc(pl.nom.split(" · ").slice(1).join(" · "))}</b></div><p class="small mut" style="margin:4px 0 8px">S'activa: ${esc(pl.quan)}</p>`;
    h += `<p class="small" style="margin:0 0 8px">Total: ${pl.tot.km.toFixed(1).replace(".", ",")} km · +${pl.tot.up} / −${pl.tot.dn} m · marxa ${fmtDur(pl.tot.min)}</p>`;
    if (!pr) {
      h += `<p class="mut small">Activa el GPS (a menys de 300 m del traçat) o marca a sota la fita per on heu passat.</p>`;
    } else {
      const base = pr.src === "marca" ? marques[actiu + ":" + pr.c] : n;
      const fet = falta(pl, 0, pr.m).km;
      h += `<div class="grid2" style="margin-bottom:8px"><div class="kv"><b>${fet.toFixed(2).replace(".", ",")} km</b><span>fets d'aquest pla</span></div>
        <div class="kv"><b class="${pr.dist > 100 ? "bad" : pr.dist > 40 ? "warn" : "ok"}">${pr.src === "gps" ? Math.round(pr.dist) + " m" : "—"}</b><span>distància al traçat</span></div></div>`;
      const nx = pl.fites.find(([c, m]) => m > pr.m + 20);
      if (nx) {
        const f1 = falta(pl, pr.m, nx[1]), a1 = base + f1.min;
        h += `<div class="fblk"><div class="hd"><span class="code">${nx[0]}</span> <b>${esc(nomFita(nx[0]))}</b> <span class="mut small">· pròxima fita</span></div>${g4(f1, a1, n)}</div>`;
        const fi = pl.fites[pl.fites.length - 1];
        if (nx !== fi) { const f2 = falta(pl, pr.m, tot), a2 = base + f2.min; h += `<div class="fblk"><div class="hd"><span class="code">${fi[0]}</span> <b>${esc(nomFita(fi[0]))}</b> <span class="mut small">· final del pla</span></div>${g4(f2, a2, n)}</div>`; }
        const fiArr = base + falta(pl, pr.m, tot).min, marge = SAFEm - fiArr;
        h += `<p class="small" style="margin:6px 0 0">Final cap a les <b>${fmtMin(fiArr)}</b>: <b class="${marge < 0 ? "bad" : marge < 30 ? "warn" : "ok"}">${marge < 0 ? "falten " + fmtDur(-marge) + " de llum útil" : "marge de " + fmtDur(marge)}</b> abans de les ${fmtMin(SAFEm)}.</p>`;
        if (marge < 0) out.push(["bad", `Seguint el ${actiu} arribeu cap a les ${fmtMin(fiArr)}, després de les ${fmtMin(SAFEm)}: frontals i avís al contacte extern.`]);
      } else h += `<b>Final del pla.</b>`;
      if (pr.src === "gps" && pr.dist > 100) out.unshift(["bad", `Fora del traçat del ${actiu} (${Math.round(pr.dist)} m).`]);
    }
    h += `<details style="margin-top:8px"><summary>Fites del pla</summary>${pl.fites.map(([c, m], i) => {
      const mk = marques[actiu + ":" + c], s = i ? falta(pl, 0, m) : {km: 0, min: 0};
      return `<div class="row small" style="justify-content:space-between;border-top:1px solid var(--line);padding:6px 0"><span><span class="code">${c}</span> ${esc(nomFita(c))}<br><span class="mut">km ${s.km.toFixed(2).replace(".", ",")} · +${fmtDur(s.min)}${mk !== undefined ? " · <b>passat " + fmtMin(mk) + "</b>" : ""}</span></span><button class="btn sm" data-plamarca="${c}">${mk !== undefined ? "Desmarcar" : "Hi som"}</button></div>`;
    }).join("")}<p class="small mut">«+» = temps des de l'inici del pla, amb parades.</p></details>`;
    h += `<p class="small mut" style="margin:8px 0 0">Traçat reconstruït sobre camins d'OpenStreetMap seguint el mapa de la fitxa: valida'l al terreny. Km, desnivell i temps: fitxa v5.</p>`;
    const obert = !!document.querySelector("#plaBody details[open]");
    $("#plaBody").innerHTML = h;
    if (obert) { const d = document.querySelector("#plaBody details"); if (d) d.open = true; }
    return out;
  }
  function init() {
    selector();
    $("#plaSeg").addEventListener("click", e => { const b = e.target.closest("[data-pla]"); if (b) tria(b.dataset.pla); });
    document.addEventListener("click", e => {
      const m = e.target.closest("[data-plamarca]");
      if (m) { const k = actiu + ":" + m.dataset.plamarca; if (marques[k] !== undefined) delete marques[k]; else marques[k] = Math.round(nowMin()); store.set("plaMarques", marques); tick(); }
      const s = e.target.closest("[data-seguir]");
      if (s) { tria(s.dataset.seguir); document.querySelector('#nav button[data-s="ara"]').click(); }
    });
    tria(actiu, true);
  }
  return {init, render, actiu: () => actiu, esborra() { marques = {}; store.set("plaMarques", marques); }};
})();
