// ---------------- METEO ----------------
// Previsió d'Open-Meteo per a 3 punts de la ruta a diferent altitud. Es desa al mòbil (localStorage)
// i, sense cobertura, es mostra l'última previsió amb l'hora en què es va baixar.
// Per a cada punt es fa servir l'hora prevista de pas i s'interpola per altitud.
const meteo = (() => {
  const PTS_MET = ["P0", "P6", "P5"].map(c => { const r = COORD.find(x => x[0] === c); return {c, lat: r[2], lon: r[3], e: r[5]}; });
  const VARS = "temperature_2m,apparent_temperature,precipitation_probability,precipitation,snowfall,wind_speed_10m,wind_gusts_10m,wind_direction_10m,cloud_cover,weather_code,freezing_level_height";
  const KEY = "meteo";
  // llindars de la fitxa (taula «Llindars que activen B o C»)
  const LL = {vent: 50, ratxa: 70, cotaCarena: 1400, cotaNeu: 1400, pluja: 3, fredBivac: -5};
  const WMO = {0: "Serè", 1: "Gairebé serè", 2: "Mig ennuvolat", 3: "Cobert", 45: "Boira", 48: "Boira gebradora", 51: "Plugim feble", 53: "Plugim", 55: "Plugim intens",
    56: "Plugim gelant", 57: "Plugim gelant", 61: "Pluja feble", 63: "Pluja", 65: "Pluja forta", 66: "Pluja gelant", 67: "Pluja gelant forta", 71: "Neu feble", 73: "Neu",
    75: "Neu forta", 77: "Neu granulada", 80: "Ruixats", 81: "Ruixats", 82: "Ruixats forts", 85: "Ruixats de neu", 86: "Ruixats de neu forts", 95: "Tempesta", 96: "Tempesta i calamarsa", 99: "Tempesta i calamarsa"};
  let MET = store.get(KEY, null), sel = null, carregant = false;

  const iso = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const dataDia = d => { const [y, m, dd] = DATES[d]; return `${y}-${String(m).padStart(2, "0")}-${String(dd).padStart(2, "0")}`; };
  const esDiaSortida = () => [1, 2].some(d => dataDia(d) === iso(new Date()));
  const maxEdat = () => (esDiaSortida() ? 1 : 3) * 3600e3;
  const edatTxt = () => { if (!MET) return ""; const m = Math.round((Date.now() - MET.ts) / 60000); return m < 60 ? `fa ${m} min` : m < 2880 ? `fa ${Math.round(m / 60)} h` : `fa ${Math.round(m / 1440)} dies`; };

  async function carrega(manual) {
    if (carregant) return;
    if (!manual && MET && Date.now() - MET.ts < maxEdat()) return pinta();
    if (!navigator.onLine) { pinta(); return; }
    carregant = true; $("#metAct").textContent = "Actualitzant…";
    const u = "https://api.open-meteo.com/v1/forecast?latitude=" + PTS_MET.map(p => p.lat).join(",") + "&longitude=" + PTS_MET.map(p => p.lon).join(",") +
      "&elevation=" + PTS_MET.map(p => p.e).join(",") + "&hourly=" + VARS + "&daily=sunrise,sunset&timezone=Europe%2FMadrid&forecast_days=16&wind_speed_unit=kmh";
    try {
      const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 25000);
      const r = await fetch(u, {signal: ctl.signal}); clearTimeout(to);
      if (!r.ok) throw new Error(r.status);
      const j = await r.json(), arr = Array.isArray(j) ? j : [j];
      MET = {ts: Date.now(), pts: arr.map(x => ({h: x.hourly, d: x.daily}))};
      store.set(KEY, MET);
    } catch (e) {
      carregant = false; pinta(); $("#metAct").innerHTML = `<span class="warn">No s'ha pogut actualitzar.</span> ${MET ? "Es mostra la previsió de " + edatTxt() + "." : ""}`; return;
    }
    carregant = false; pinta(); tick();
  }

  function idx(dataIso, min) { // índex horari més proper a l'hora (minuts) d'aquell dia
    if (!MET) return -1; const h = Math.min(23, Math.round(min / 60));
    return MET.pts[0].h.time.indexOf(dataIso + "T" + String(h).padStart(2, "0") + ":00");
  }
  function a(i, alt) { // valors interpolats per altitud a l'índex horari i
    if (i < 0 || !MET) return null;
    const E = PTS_MET.map(p => p.e), P = MET.pts;
    let lo = 0, hi = 1; if (alt > E[1]) { lo = 1; hi = 2; }
    const f = Math.max(0, Math.min(1, (alt - E[lo]) / (E[hi] - E[lo])));
    const g = k => { const x = P[lo].h[k][i], y = P[hi].h[k][i]; return x == null || y == null ? (x ?? y) : x + (y - x) * f; };
    const prop = f < .5 ? lo : hi;
    return {t: g("temperature_2m"), at: g("apparent_temperature"), ws: g("wind_speed_10m"), wg: g("wind_gusts_10m"), wd: P[prop].h.wind_direction_10m[i],
      pp: g("precipitation_probability"), pr: g("precipitation"), sn: g("snowfall"), cc: g("cloud_cover"), code: P[prop].h.weather_code[i], fz: g("freezing_level_height")};
  }
  function avisos(v, cota) {
    const o = [];
    const carena = cota >= LL.cotaCarena;
    if (v.ws >= LL.vent || v.wg >= LL.ratxa) o.push([carena ? "bad" : "warn", `vent ${Math.round(v.ws)} km/h, ratxes ${Math.round(v.wg)} km/h`]);
    if (v.code >= 95) o.push(["bad", "tempesta"]);
    if (v.fz != null && v.fz < LL.cotaNeu) o.push(["warn", `cota 0 °C a ${Math.round(v.fz / 50) * 50} m`]);
    if (v.sn > 0) o.push(["warn", "neu"]);
    if (v.pr >= LL.pluja) o.push(["warn", `pluja ${v.pr.toFixed(1)} mm/h`]);
    return o;
  }
  const cls = (bad, warn) => bad ? "bad" : warn ? "warn" : "";
  const dir = d => d == null ? "" : CARD[Math.round(((d + 180) % 360) / 45) % 8]; // cap on bufa → fletxa
  const fletxa = d => d == null ? "" : `<span style="display:inline-block;transform:rotate(${d + 180}deg)">↑</span>`;

  function diesBotons() {
    const ops = [[1, "Ds 28 · dia 1"], [2, "Dg 29 · dia 2"]];
    if (!esDiaSortida()) ops.push(["avui", "Avui (pla del dia " + day + ")"]);
    if (sel == null) sel = esDiaSortida() ? day : 1;
    $("#metDia").innerHTML = ops.map(([v, t]) => `<button data-v="${v}" class="${String(v) === String(sel) ? "on" : ""}">${t}</button>`).join("");
  }
  function pinta() {
    diesBotons();
    $("#metAct").textContent = MET ? "Actualitzada " + edatTxt() + (Date.now() - MET.ts > 12 * 3600e3 ? " · massa antiga: actualitza-la amb cobertura" : "") : "";
    if (!MET) { $("#metBody").innerHTML = "Sense previsió desada. Prem «Actualitzar previsió» amb cobertura."; return; }
    const d = sel === "avui" ? day : sel, dIso = sel === "avui" ? iso(new Date()) : dataDia(sel);
    if (idx(dIso, 720) < 0) { $("#metBody").innerHTML = `La previsió desada no arriba al ${dIso.split("-").reverse().join("/")} (Open-Meteo dona 16 dies). Torna-hi més a prop de la data.`; return; }
    const rows = dayPts(d).map(p => {
      const tm = toMin(p.dep || p.t), v = a(idx(dIso, tm), p.cota); if (!v) return "";
      const carena = p.cota >= LL.cotaCarena;
      return `<tr><td><b>${p.c}</b></td><td>${fmtMin(tm)}</td><td>${p.cota}</td>
        <td>${Math.round(v.t)}° <span class="mut">(${Math.round(v.at)}°)</span></td>
        <td class="${cls(carena && (v.ws >= LL.vent || v.wg >= LL.ratxa), v.ws >= LL.vent || v.wg >= LL.ratxa)}">${fletxa(v.wd)} ${Math.round(v.ws)}/${Math.round(v.wg)}</td>
        <td class="${cls(false, v.pr >= LL.pluja || v.sn > 0)}">${Math.round(v.pp ?? 0)} % · ${v.pr.toFixed(1)}</td>
        <td class="${cls(false, v.fz != null && v.fz < LL.cotaNeu)}">${v.fz == null ? "–" : Math.round(v.fz / 50) * 50}</td>
        <td class="${cls(v.code >= 95, v.code === 45 || v.code === 48)}">${WMO[v.code] || "–"} <span class="mut">${Math.round(v.cc)} %</span></td></tr>`;
    }).join("");
    let extra = "";
    const iD = MET.pts[0].d.time.indexOf(dIso);
    if (iD >= 0) { const sr = MET.pts[1].d.sunrise[iD].slice(11), ss = MET.pts[1].d.sunset[iD].slice(11); extra += `<p style="margin:6px 0 0">Sol: surt ${sr} · es pon <b>${ss}</b></p>`; }
    if (d === 1) { // nit al Xalet (bivac): de les 18 h a les 8 h
      const xa = COORD.find(r => r[0] === "P6")[5], dema = new Date(dIso + "T12:00"); dema.setDate(dema.getDate() + 1);
      let mn = null, mnA = null;
      for (let h = 18; h <= 31; h++) { const i = idx(h < 24 ? dIso : iso(dema), (h % 24) * 60), v = a(i, xa); if (v) { mn = mn == null ? v.t : Math.min(mn, v.t); mnA = mnA == null ? v.at : Math.min(mnA, v.at); } }
      if (mn != null) extra += `<p style="margin:6px 0 0">Nit al Xalet (bivac): mínima <b class="${mn < LL.fredBivac ? "bad" : mn < 0 ? "warn" : ""}">${Math.round(mn)} °C</b> · sensació ${Math.round(mnA)} °C${mn < LL.fredBivac ? " → llindar de la fitxa: C o B2 sense material adequat" : ""}</p>`;
    }
    $("#metBody").innerHTML = `<div class="scroll"><table class="met"><tr><th>Punt</th><th>Hora</th><th>m</th><th>T (sens.)</th><th>Vent/ratxa km/h</th><th>Pluja %·mm</th><th>Cota 0°</th><th>Cel</th></tr>${rows}</table></div>${extra}`;
  }

  return {
    init() {
      $("#metBtn").onclick = () => carrega(true);
      $("#metDia").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; sel = b.dataset.v === "avui" ? "avui" : +b.dataset.v; pinta(); });
      window.addEventListener("online", () => carrega(false));
      pinta(); carrega(false);
    },
    // targeta «Meteo» de la pantalla Ara: l'hora actual a la cota on ets
    ara() {
      const el = $("#metAraBody"); if (!el) return;
      if (!MET) { el.className = "mut small"; el.textContent = "Sense previsió desada. Obre «Info» amb cobertura i prem «Actualitzar previsió»."; return; }
      const now = new Date(), i = idx(iso(now), now.getHours() * 60 + now.getMinutes());
      const alt = gps && gps.alt != null ? gps.alt : gps && gps.snap ? gps.snap.ele : (dayPts(day)[0] || {}).cota || 1372;
      const v = a(i, alt);
      if (!v) { el.className = "mut small"; el.textContent = "La previsió desada no cobreix l'hora actual."; return; }
      const av = avisos(v, alt);
      el.className = "small";
      el.innerHTML = `<div class="grid2">
        <div class="kv"><b>${Math.round(v.t)} °C</b><span>sensació ${Math.round(v.at)} °C · a ${Math.round(alt)} m</span></div>
        <div class="kv"><b class="${cls(v.ws >= LL.vent || v.wg >= LL.ratxa, v.wg >= 50)}">${Math.round(v.ws)}/${Math.round(v.wg)}</b><span>vent/ratxes km/h ${fletxa(v.wd)} cap al ${dir(v.wd)}</span></div>
        <div class="kv"><b>${Math.round(v.pp ?? 0)} %</b><span>prob. pluja · ${v.pr.toFixed(1)} mm/h</span></div>
        <div class="kv"><b>${v.fz == null ? "–" : Math.round(v.fz / 50) * 50 + " m"}</b><span>cota 0 °C · ${WMO[v.code] || ""}</span></div></div>
        ${av.length ? `<p style="margin:8px 0 0">${av.map(x => `<b class="${x[0]}">${x[1]}</b>`).join(" · ")}</p>` : ""}
        <p class="mut" style="margin:6px 0 0">Model Open-Meteo, actualitzat ${edatTxt()}. Mana el que veus al terreny.</p>`;
    },
    // avisos per a la pantalla Ara a partir de la previsió del dia de la sortida que es mira
    alertes(d) {
      if (!MET || Date.now() - MET.ts > 48 * 3600e3) return [];
      const dIso = dataDia(d), out = [], fets = new Set();
      for (const p of dayPts(d)) {
        const v = a(idx(dIso, toMin(p.dep || p.t)), p.cota); if (!v) continue;
        for (const [nivell, txt] of avisos(v, p.cota)) {
          const k = txt.split(" ")[0]; if (fets.has(k)) continue; fets.add(k);
          out.push([nivell, `Previsió ${p.c} (${p.dep || p.t}, ${p.cota} m): ${txt}. Revisa els llindars a «Plans».`]);
        }
      }
      return out.slice(0, 3);
    },
    carrega
  };
})();
