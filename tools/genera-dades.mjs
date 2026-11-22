// Genera camins.js (camins d'OpenStreetMap al voltant de la ruta) i orientacio.js
// (solell / obaga de cada tram a partir d'un model d'elevacions).
// S'executa a GitHub Actions (.github/workflows/dades.yml) o en local amb: node tools/genera-dades.mjs
import { readFileSync, writeFileSync } from "node:fs";
import vm from "node:vm";

const ROOT = new URL("../", import.meta.url);
const code = readFileSync(new URL("dades.js", ROOT), "utf8");
const D = vm.runInNewContext(code + "\n;({TRACK, KMS, PTS, COORD})");
const { TRACK, KMS, PTS, COORD } = D;
const avui = new Date().toISOString().slice(0, 10);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchJson(url, opts = {}, intents = 3) {
  for (let i = 0; i < intents; i++) {
    try {
      const r = await fetch(url, { ...opts, headers: { "User-Agent": "catllaras-guia/1.0 (app del guia, GitHub Pages)", ...(opts.headers || {}) } });
      if (r.ok) return await r.json();
      console.warn("HTTP", r.status, url.slice(0, 80));
    } catch (e) { console.warn("Error", e.message); }
    await sleep(3000 * (i + 1));
  }
  throw new Error("No s'ha pogut descarregar " + url.slice(0, 80));
}

// ---------- 1. Camins OSM ----------
const BUF = 1500; // metres al voltant de la ruta i dels punts (inclou PB, JB i el circuit C)
let S = 90, W = 180, N = -90, E = -180;
for (const [la, lo] of [...TRACK.map(p => [p[0], p[1]]), ...COORD.map(c => [c[2], c[3]])]) {
  S = Math.min(S, la); N = Math.max(N, la); W = Math.min(W, lo); E = Math.max(E, lo);
}
const dLat = BUF / 110540, dLon = BUF / (111320 * Math.cos((S + N) / 2 * Math.PI / 180));
S -= dLat; N += dLat; W -= dLon; E += dLon;
const bbox = [S, W, N, E].map(v => v.toFixed(5)).join(",");

function tipus(h) {
  if (/^(motorway|trunk|primary|secondary|tertiary)(_link)?$/.test(h)) return 0;   // carretera
  if (/^(unclassified|residential|service|living_street|road)$/.test(h)) return 1; // carrer o camí asfaltat
  if (h === "track") return 2;                                                     // pista
  if (/^(path|footway|bridleway|cycleway|pedestrian)$/.test(h)) return 3;          // sender
  if (h === "steps") return 4;                                                     // escales
  return -1;
}
const q = `[out:json][timeout:90];way["highway"](${bbox});out tags geom;`;
let osm = null;
for (const srv of ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"]) {
  try { osm = await fetchJson(srv, { method: "POST", body: "data=" + encodeURIComponent(q), headers: { "Content-Type": "application/x-www-form-urlencoded" } }, 2); break; }
  catch (e) { console.warn(e.message); }
}
if (!osm) throw new Error("Overpass no respon");

const ways = [];
for (const el of osm.elements || []) {
  if (el.type !== "way" || !el.geometry || !el.tags) continue;
  const t = tipus(el.tags.highway || "");
  if (t < 0) continue;
  const pts = [];
  let pl = null, po = null;
  for (const g of el.geometry) {
    const la = Math.round(g.lat * 1e5), lo = Math.round(g.lon * 1e5);
    if (la === pl && lo === po) continue;
    pts.push(la, lo); pl = la; po = lo;
  }
  if (pts.length < 4) continue;
  const w = [t, pts];
  const nom = el.tags.ref || el.tags.name;
  if (nom) w.push(nom);
  ways.push(w);
}
ways.sort((a, b) => a[0] - b[0]);
writeFileSync(new URL("camins.js", ROOT),
  `// Camins d'OpenStreetMap al voltant de la ruta. © OpenStreetMap contributors, llicència ODbL (openstreetmap.org/copyright)\n` +
  `// Generat per tools/genera-dades.mjs el ${avui}. Coordenades en graus × 100000: [tipus, [lat, lon, lat, lon…], nom?]\n` +
  `// Tipus: 0 carretera · 1 camí asfaltat · 2 pista · 3 sender · 4 escales\n` +
  `const CAMINS = ${JSON.stringify({ data: avui, bbox: [S, W, N, E].map(v => +v.toFixed(5)), ways })};\n`);
console.log(`camins.js: ${ways.length} camins`);

// ---------- 2. Orientació (solell / obaga) ----------
// Mostra el terreny cada 100 m del track i calcula el pendent i l'orientació amb 4 cotes a ±40 m.
const PAS = 100, OFF = 40;
function puntA(m) {
  for (let i = 0; i < TRACK.length - 1; i++) {
    const p = TRACK[i], q2 = TRACK[i + 1];
    if (m >= p[3] && m <= q2[3]) { const f = (m - p[3]) / Math.max(1, q2[3] - p[3]); return [p[0] + f * (q2[0] - p[0]), p[1] + f * (q2[1] - p[1])]; }
  }
  return TRACK[TRACK.length - 1].slice(0, 2);
}
const total = TRACK[TRACK.length - 1][3];
const mostres = [];
for (let m = 0; m <= total; m += PAS) mostres.push({ m, ll: puntA(m) });
const coords = [];
for (const s of mostres) {
  const [la, lo] = s.ll, dla = OFF / 110540, dlo = OFF / (111320 * Math.cos(la * Math.PI / 180));
  coords.push([la + dla, lo], [la - dla, lo], [la, lo + dlo], [la, lo - dlo]);
}
const elev = [];
for (let i = 0; i < coords.length; i += 100) {
  const c = coords.slice(i, i + 100);
  const u = "https://api.open-meteo.com/v1/elevation?latitude=" + c.map(x => x[0].toFixed(5)).join(",") + "&longitude=" + c.map(x => x[1].toFixed(5)).join(",");
  const j = await fetchJson(u);
  elev.push(...j.elevation);
  await sleep(400);
}
const orient = mostres.map((s, k) => {
  const [zn, zs, ze, zw] = elev.slice(k * 4, k * 4 + 4);
  const gx = (ze - zw) / (2 * OFF), gy = (zn - zs) / (2 * OFF);      // pujada cap a l'est i cap al nord
  const pend = Math.round(Math.hypot(gx, gy) * 100);                  // %
  const asp = Math.round((Math.atan2(-gx, -gy) * 180 / Math.PI + 360) % 360); // cap on mira el vessant (baixada)
  return [s.m, pend, asp];
});
function classe(p, a) {
  if (p < 6) return "pla";
  if (a >= 315 || a < 45) return "obaga";
  if (a >= 135 && a < 225) return "solell";
  return a < 135 ? "llevant" : "ponent";
}
const trams = {};
for (const d of [1, 2]) {
  const ps = PTS.filter(p => p.d === d);
  for (let i = 0; i < ps.length - 1; i++) {
    if (!ps[i].tr) continue; // un tram va d'un punt amb «tr» fins al següent punt que no és de pas (est)
    const fi = ps.slice(i + 1).find(p => !p.est) || ps[ps.length - 1];
    const ma = KMS[ps[i].k][0], mb = KMS[fi.k][0];
    const sel = orient.filter(o => o[0] >= ma && o[0] < mb);
    const n = { obaga: 0, solell: 0, llevant: 0, ponent: 0, pla: 0 };
    for (const o of sel) n[classe(o[1], o[2])]++;
    const tot = Math.max(1, sel.length);
    for (const k in n) n[k] = Math.round(n[k] * 100 / tot);
    const dom = Object.entries(n).sort((a, b) => b[1] - a[1])[0][0];
    trams[d + ":" + ps[i].k] = { ...n, dom };
  }
}
writeFileSync(new URL("orientacio.js", ROOT),
  `// Orientació del terreny al llarg del track (solell / obaga). Model d'elevacions Copernicus GLO-90 via Open-Meteo.\n` +
  `// Generat per tools/genera-dades.mjs el ${avui}. mostres: [metres des de P0, pendent %, orientació en graus (0 = mira al nord)]\n` +
  `const ORIENTACIO = ${JSON.stringify({ data: avui, pas: PAS, trams, mostres: orient })};\n`);
console.log(`orientacio.js: ${orient.length} mostres, ${Object.keys(trams).length} trams`);
