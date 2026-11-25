// Eines de camp: guió del dia per al grup, briefing d'una pantalla, text per dictar al 112 i simulació de caminada.
// Usa només dades pròpies de l'app (PTS, EXPLICAR, TEMES, HORARI, LLINDARS, QUEFER, MAT_B).
(() => {
  const css = document.createElement("style");
  css.textContent = `
  #ov .bar{padding:4px 0 8px;display:flex;gap:8px;align-items:center}
  #ovFix{position:fixed;left:0;right:0;bottom:calc(62px + env(safe-area-inset-bottom));z-index:40;display:none;gap:8px;padding:8px 12px;background:var(--bg);border-top:1px solid var(--line);align-items:center}
  #ovFix .seg button{padding:12px 8px}#ovFix .btn{padding:12px 16px}
  #ov .bar b{flex:1;font-size:17px}
  #ov h3{margin:14px 0 4px;font-size:15px}
  #ov table{width:100%;border-collapse:collapse;font-size:14px}
  #ov td,#ov th{padding:4px 6px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
  #ov .pg{border:1px solid var(--line);background:var(--card);border-radius:12px;padding:10px 12px;margin:0 0 10px}
  #ov .pg .hd{display:flex;gap:8px;align-items:baseline}
  #ov .pg .hr{margin-left:auto;font-weight:700}
  #ov .q{border-left:3px solid var(--blue);padding-left:8px;margin:6px 0 0}
  .campRow{display:flex;gap:8px;margin:0 0 10px}.campRow .btn{flex:1}
  #sosTxt{white-space:pre-wrap;background:var(--card2);border-radius:8px;padding:10px;font-size:14px;margin:6px 0}
  `;
  document.head.appendChild(css);

  const sec = document.createElement("section"); sec.id = "s-ov"; document.querySelector("main").appendChild(sec);
  const ov = document.createElement("div"); ov.id = "ov"; sec.appendChild(ov);
  const fix = document.createElement("div"); fix.id = "ovFix"; document.body.appendChild(fix);
  const pintaFix = () => { fix.innerHTML = `<div class="seg" style="margin:0;flex:1"><button data-od="1" class="${ovDay === 1 ? "on" : ""}">Dia 1</button><button data-od="2" class="${ovDay === 2 ? "on" : ""}">Dia 2</button></div><button class="btn ac" id="ovX2">✕ Tancar</button>`; };
  let prev = "s-ara", actiu = false;
  const restore = () => {
    if (!actiu) return; actiu = false; ov.innerHTML = ""; fix.style.display = "none";
    document.querySelectorAll("main section").forEach(x => x.classList.toggle("act", x.id === prev));
    if (prev === "s-mapa" && typeof mapa !== "undefined") mapa.mostra();
    window.scrollTo(0, 0);
  };
  const close = () => { if (actiu && history.state && history.state.ov) history.back(); else restore(); };
  window.addEventListener("popstate", restore);
  document.querySelectorAll("#nav button").forEach(b => b.addEventListener("click", () => { if (actiu) { actiu = false; ov.innerHTML = ""; fix.style.display = "none"; } }));
  let ovDay = 1;
  const dayName = d => d === 1 ? "Dia 1 · dissabte 28/11" : "Dia 2 · diumenge 29/11";
  const bar = (titol, ambDia) => `<div class="bar"><b>${titol}</b>${ambDia ? `<div class="seg" style="margin:0;width:150px"><button data-od="1" class="${ovDay === 1 ? "on" : ""}">D1</button><button data-od="2" class="${ovDay === 2 ? "on" : ""}">D2</button></div>` : ""}<button class="btn sm" id="ovX">Tancar</button></div>`;

  function guio(d) {
    const idees = (TEMES.find(t => t.id === "idees") || {}).llista || [];
    const pts = PTS.filter(p => p.d === d);
    const fil = d === 1
      ? `<div class="pg"><h3 style="margin-top:0">Fil del dia</h3><ul style="margin:4px 0 0;padding-left:18px">${idees.map(x => `<li class="small">${esc(x)}</li>`).join("")}</ul><p class="q small"><b>Pregunta que obre el dia:</b> «Per què hi ha una casa de Gaudí a dalt d'una serra?» Es respon al final del D2.</p></div>`
      : `<div class="pg"><h3 style="margin-top:0">Fil del dia</h3><p class="small" style="margin:4px 0 0">Ahir: mines, Güell i el Xalet. Avui: la serra com a lloc viscut (masies, pastures, despoblament), el bosc i el gall fer, i el tancament amb la pregunta inicial.</p></div>`;
    return bar("Què explicarem · " + dayName(d), true) + fil + pts.map(p => {
      const e = EXPLICAR[d + ":" + p.k] || (p.i ? { i: p.i } : null);
      const tm = e && e.temes ? e.temes.filter(id => TEMA[id]).map(id => `<button class="temabtn" data-tema="${id}">${esc(TEMA[id].t)} →</button>`).join("") : "";
      return `<div class="pg"><div class="hd"><span class="code">${p.c}</span><b>${esc(p.n)}</b><span class="hr">${p.t}</span></div>
        <div class="small mut">${p.cota} m${p.km ? " · km " + p.km : ""}</div>
        ${e ? `<div class="small" style="margin-top:6px">${esc(e.i)}</div>${e.q ? `<p class="q small"><b>Pregunta:</b> ${esc(e.q)}</p>` : ""}${tm}` : `<div class="small mut">Sense text d'interpretació.</div>`}</div>`;
    }).join("");
  }

  const briefTxt = d => {
    const L = llum(d), c = d === 1 ? 1 : 3, h = d === 1 ? 0 : 2;
    return `Briefing ${dayName(d)}\nPosta de sol ${fmtMin(L.posta)} · lloc segur abans de ${fmtMin(L.safe)}\n\nHorari\n` +
      HORARI.map(r => `${r[c]}  ${r[h]}`).join("\n") +
      `\n\nLlindars per canviar de pla\n` + LLINDARS.map(r => `- ${r[0]}: ${r[1]} → ${r[2]}`).join("\n") +
      `\n\nContacte extern: sense notícies a les 17:00 del D2, truca al 112.`;
  };

  function briefing(d) {
    const L = llum(d), c = d === 1 ? 1 : 3, h = d === 1 ? 0 : 2;
    const dec = QUEFER.filter(q => q[2] !== "112").map(q => `<tr><td><b>${esc(q[2])}</b></td><td>${esc(q[0])}</td><td>${esc(q[5])}</td></tr>`).join("");
    return bar("Briefing · " + dayName(d), true) +
      `<div class="pg"><b>Llum:</b> posta de sol <b>${fmtMin(L.posta)}</b> · estar en lloc segur abans de <b>${fmtMin(L.safe)}</b></div>
       <h3>Horari previst</h3><table>${HORARI.map(r => `<tr><td>${esc(r[h])}</td><td><b>${r[c]}</b></td></tr>`).join("")}</table>
       <h3>Normes del grup</h3>
       <ul class="small" style="margin:0;padding-left:18px"><li>El guia obre i marca el ritme del més lent; el tancador tanca.</li><li>Reagrupar a cada punt i a les cruïlles; recompte als punts marcats.</li><li>Ningú entra a bocamines ni pous. No sortir del track ni collir res.</li>${d === 1 ? `<li>Pas equipat de P5: d'un en un, amb el guia. Si la roca o les grapes estan glaçades o mullades, no es passa.</li>` : ""}</ul>
       <h3>Quan canviem de pla</h3><table><tr><th>Factor</th><th>Llindar</th><th>Pla</th></tr>${LLINDARS.map(r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td><b>${esc(r[2])}</b></td></tr>`).join("")}</table>
       <h3>Punts de decisió</h3><table>${dec}</table>
       ${d === 1 ? `<h3>Bivac (cada persona)</h3><p class="small" style="margin:0">${MAT_B.map(esc).join(" · ")}</p>` : ""}
       <p class="small mut" style="margin-top:12px">Contacte extern: sense notícies a les 17:00 del D2, truca al 112.</p>
       <div class="campRow" style="margin-top:12px"><button class="btn ac" id="briefShare">Compartir text</button></div>`;
  }

  function obre(kind, d) {
    ovDay = d || ovDay;
    ov.innerHTML = kind === "guio" ? guio(ovDay) : briefing(ovDay);
    ov.dataset.kind = kind; pintaFix(); fix.style.display = "flex";
    if (!actiu) {
      const cur = document.querySelector("main section.act"); prev = cur ? cur.id : "s-ara"; actiu = true;
      document.querySelectorAll("main section").forEach(x => x.classList.toggle("act", x.id === "s-ov"));
      try { history.pushState({ ov: 1 }, ""); } catch (e) {}
    }
    window.scrollTo(0, 0);
  }
  const onClick = e => {
    if (e.target.id === "ovX" || e.target.id === "ovX2") return close();
    const od = e.target.closest("[data-od]"); if (od) return obre(ov.dataset.kind, +od.dataset.od);
    if (e.target.closest("[data-tema]")) restore(); // el gestor global obre el tema a Info
    if (e.target.id === "briefShare") {
      const t = briefTxt(ovDay);
      if (navigator.share) navigator.share({ title: "Briefing Catllaràs", text: t }).catch(() => {});
      else if (navigator.clipboard) navigator.clipboard.writeText(t).then(() => { e.target.textContent = "Copiat"; });
    }
  };
  ov.addEventListener("click", onClick); fix.addEventListener("click", onClick);

  // botons a «Ara»
  const ara = document.getElementById("s-ara");
  if (ara) {
    const row = document.createElement("div"); row.className = "campRow";
    row.innerHTML = `<button class="btn" id="btnGuio">📖 Què explicarem</button><button class="btn" id="btnBrief">📣 Briefing</button>`;
    ara.insertBefore(row, document.getElementById("alerts"));
    row.querySelector("#btnGuio").onclick = () => obre("guio", day);
    row.querySelector("#btnBrief").onclick = () => obre("brief", day);
  }

  // ---------- 112: text per dictar i ubicació ----------
  const sos = document.getElementById("s-sos");
  const sosCard = document.createElement("div"); sosCard.className = "card";
  sosCard.innerHTML = `<h2>Text per dictar al 112</h2><div id="sosTxt" class="small mut">Activa el GPS per omplir-lo amb la posició.</div>
    <div class="campRow"><button class="btn sm" id="sosCopia">Copiar</button><button class="btn sm ac" id="sosShare">Compartir ubicació</button></div>
    <p class="small mut" id="sosOld" style="margin:0"></p>`;
  if (sos) { const first = sos.querySelector(".card"); sos.insertBefore(sosCard, first ? first.nextSibling : null); }
  let ultima = store.get("ultimaPos", null), texte = "", linkPos = "";
  function pintaSos() {
    let pos = null, vella = false;
    if (typeof gps !== "undefined" && gps) { pos = { lat: gps.lat, lon: gps.lon, acc: gps.acc, alt: gps.alt, t: gps.t }; ultima = pos; if (!pintaSos.k || Date.now() - pintaSos.k > 15000) { store.set("ultimaPos", pos); pintaSos.k = Date.now(); } }
    else if (ultima) { pos = ultima; vella = true; }
    const el = document.getElementById("sosTxt"); if (!el) return;
    if (!pos) { texte = ""; el.textContent = "Activa el GPS per omplir-lo amb la posició."; el.className = "small mut"; return; }
    const [X, Y] = utm(pos.lat, pos.lon);
    let near = null; COORD.forEach(r => { const dd = hav(pos.lat, pos.lon, r[2], r[3]); if (!near || dd < near.d) near = { c: r[0], n: r[1], d: dd }; });
    const hh = new Date(pos.t).toLocaleTimeString("ca", { hour: "2-digit", minute: "2-digit" });
    linkPos = `https://maps.google.com/?q=${pos.lat.toFixed(5)},${pos.lon.toFixed(5)}`;
    texte = `Truco des de la serra del Catllaràs (Berguedà). Sóc el guia d'un grup de 14 persones. Necessito ajuda.\n` +
      `Coordenades: ${pos.lat.toFixed(5)} nord, ${pos.lon.toFixed(5)} est. UTM 31 N: X ${X}, Y ${Y}.\n` +
      `Cota aproximada: ${pos.alt != null ? Math.round(pos.alt) : "—"} m. Punt més proper: ${near.c}, ${near.n}, a ${Math.round(near.d)} m.\n` +
      `Què ha passat: ______ · Persones afectades: ___ · Estat: ______`;
    el.textContent = texte; el.className = "small";
    document.getElementById("sosOld").textContent = vella ? `Última posició coneguda, de les ${hh}. Pot no ser l'actual.` : `Posició de les ${hh}, precisió ±${Math.round(pos.acc || 0)} m.`;
  }
  setInterval(pintaSos, 2000); pintaSos();
  document.getElementById("sosCopia") && (document.getElementById("sosCopia").onclick = e => { if (texte && navigator.clipboard) navigator.clipboard.writeText(texte).then(() => { e.target.textContent = "Copiat"; setTimeout(() => e.target.textContent = "Copiar", 1500); }); });
  document.getElementById("sosShare") && (document.getElementById("sosShare").onclick = () => {
    if (!texte) return;
    if (navigator.share) navigator.share({ title: "Ubicació", text: texte + "\n" + linkPos }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(texte + "\n" + linkPos);
  });

  // ---------- Mode prova: caminada simulada ----------
  const info = document.querySelector("#simOff");
  if (info) {
    const r = document.createElement("div"); r.className = "campRow"; r.style.marginTop = "8px";
    r.innerHTML = `<button class="btn sm" id="walkOn">Simular caminada (GPS)</button><button class="btn sm" id="walkOff">Aturar</button>`;
    info.parentElement.insertAdjacentElement("afterend", r);
    let timer = null;
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } gps = null; sim = null; mapa.gps(); renderSos(); tick(); };
    r.querySelector("#walkOff").onclick = stop;
    r.querySelector("#walkOn").onclick = () => {
      if (watchId !== null) { alert("Atura primer el GPS real."); return; }
      if (timer) return;
      let m = dayStart(day), end = day === 1 ? D1END : TRK[TRK.length - 1][3], i = 0;
      timer = setInterval(() => {
        m += 30; if (m >= end) { stop(); return; }
        while (i < TRK.length - 2 && TRK[i + 1][3] < m) i++;
        const a = TRK[i], b = TRK[i + 1], f = Math.min(1, Math.max(0, (m - a[3]) / Math.max(1, b[3] - a[3])));
        const lat = a[0] + (b[0] - a[0]) * f, lon = a[1] + (b[1] - a[1]) * f, ele = a[2] + (b[2] - a[2]) * f;
        const s = snap(lat, lon, day); if (s && s.dist < 300) lastKm[day] = s.m;
        gps = { lat, lon, acc: 8, alt: ele, snap: s, t: Date.now(), hdg: bearing(a[0], a[1], b[0], b[1]), spd: 1.1 };
        sim = planAt(m, day) + 6; // simula anar 6 min tard sobre el pla
        $("#gpsStat").textContent = "Caminada simulada";
        $("#offTrack").textContent = s ? Math.round(s.dist) + " m" : "--";
        renderSos(); mapa.gps(); tick();
      }, 400);
    };
  }

  // ---------- Vista simple de «Ara» ----------
  (() => {
    const ara = document.getElementById("s-ara"); if (!ara) return;
    const st = document.createElement("style");
    st.textContent = `#s-ara.simple>*:not(#simpleCard):not(#alerts):not(.campRow):not(#daySeg):not(.vistaRow){display:none!important}
    #simpleCard .nm{font-size:22px;font-weight:800;margin:2px 0 8px}
    #simpleCard .big{font-size:34px;font-weight:800;line-height:1.1}
    #simpleCard .g3{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px}
    #simpleCard .g3 div{background:var(--card2);border-radius:10px;padding:8px 10px}
    #simpleCard .g3 span{display:block;font-size:12px;color:var(--mut)}
    #simpleCard .g3 b{font-size:22px}`;
    document.head.appendChild(st);
    const card = document.createElement("div"); card.className = "card"; card.id = "simpleCard";
    card.innerHTML = `<div class="small mut">Pròxim punt</div><div class="nm" id="spNom">—</div>
      <div class="big" id="spEta">--:--</div><div class="small mut">hora d'arribada estimada</div>
      <div class="g3"><div><b id="spKm">--</b><span>falten</span></div><div><b id="spDelay">--</b><span>respecte al pla</span></div>
      <div><b id="spLlum">--</b><span>fins a lloc segur</span></div><div><b id="spPosta">--</b><span>fins a la posta</span></div></div>
      <div class="campRow" style="margin:12px 0 0"><button class="btn ac" id="spGps">Activar GPS</button></div>
      <p class="small mut" style="margin:8px 0 0" id="spNota"></p>`;
    ara.insertBefore(card, document.getElementById("alerts").nextSibling);
    const row = document.createElement("div"); row.className = "campRow vistaRow";
    row.innerHTML = `<button class="btn sm" id="spToggle"></button>`;
    ara.appendChild(row);
    let simple = store.get("vistaSimple", true);
    const aplica = () => { ara.classList.toggle("simple", simple); document.getElementById("spToggle").textContent = simple ? "Veure totes les dades" : "Vista simple"; store.set("vistaSimple", simple); };
    document.getElementById("spToggle").onclick = () => { simple = !simple; aplica(); };
    document.getElementById("spGps").onclick = () => document.getElementById("gpsBtn").click();
    aplica();
    const t = id => (document.getElementById(id) || {}).textContent || "--";
    setInterval(() => {
      const nb = document.getElementById("nextBody"), kv = nb ? nb.querySelectorAll(".kv b") : [];
      const hd = nb && nb.querySelector(".hd");
      document.getElementById("spNom").textContent = hd ? hd.textContent.trim() : "Marca l'últim punt o activa el GPS";
      document.getElementById("spKm").textContent = kv[0] ? kv[0].textContent : "--";
      document.getElementById("spEta").textContent = kv[2] ? kv[2].textContent : "--:--";
      const d = document.getElementById("delay"), sd = document.getElementById("spDelay");
      sd.textContent = d ? d.textContent : "--"; sd.className = d ? d.className : "";
      document.getElementById("spLlum").textContent = t("safeLeft"); document.getElementById("spPosta").textContent = t("sunLeft");
      document.getElementById("spGps").textContent = t("gpsBtn");
      document.getElementById("spNota").textContent = kv[0] ? "" : "Sense posició: marca a «Punts» l'últim punt per on heu passat.";
    }, 1000);
  })();

  // ---------- Desplaçament amb el dit al mòbil ----------
  (() => {
    const st = document.createElement("style");
    st.textContent = `#sinoCv{touch-action:pan-y}
    .mapGuard{height:34px;margin:6px 0 0;border-radius:10px;background:var(--card2);color:var(--mut);font-size:13px;display:flex;align-items:center;justify-content:center;touch-action:pan-y}`;
    document.head.appendChild(st);
    const mw = document.getElementById("mapwrap");
    if (mw) { const g = document.createElement("div"); g.className = "mapGuard"; g.textContent = "↕ Llisca aquí per moure la pàgina (el mapa captura el dit)"; mw.parentNode.insertBefore(g, mw.nextSibling); }
  })();
})();
