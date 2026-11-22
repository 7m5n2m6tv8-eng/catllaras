// Funcionament sense cobertura.
// - CACHE: l'app (canvieu el número de versió quan pugeu canvis perquè els mòbils baixin la nova).
// - TILES: teselles del mapa ICGC; NO s'esborren en actualitzar l'app.
// - La previsió d'Open-Meteo no passa per aquí: l'app la desa al mòbil.
const CACHE = "catllaras-v6";
const TILES = "catllaras-teselles-v1";
const FILES = ["./", "./index.html", "./dades.js", "./interpretacio.js", "./camins.js", "./orientacio.js", "./mapa.js", "./meteo.js",
  "./img/mapa-fitxa.jpg", "./img/perfil-d1.jpg", "./img/perfil-d2.jpg",
  "./manifest.webmanifest", "./icon-180.png", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, {cache: "reload"})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== TILES).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  // Teselles ICGC: primer les desades; si no hi són i hi ha cobertura, es baixen i es desen.
  if (url.hostname === "geoserveis.icgc.cat") {
    e.respondWith(caches.open(TILES).then(c => c.match(e.request.url).then(hit => hit || fetch(e.request.url, {mode: "cors"}).then(res => {
      if (res.ok) c.put(e.request.url, res.clone());
      return res;
    }))).catch(() => new Response("", {status: 504})));
    return;
  }
  if (url.origin !== location.origin) return; // Open-Meteo i altres: directe a la xarxa
  // Fitxers de l'app: primer la còpia desada (funciona sense cobertura).
  e.respondWith(
    caches.match(e.request, {ignoreSearch: true}).then(hit => hit || fetch(e.request).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match("./index.html")))
  );
});
