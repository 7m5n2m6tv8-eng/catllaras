# Catllaràs · Guia de ruta (28–29/11/2026)

App web offline per al guia de la travessa amb bivac a la serra del Catllaràs: horaris, límits de decisió, plans B i C, mapa amb GPS, previsió meteo per punts, coordenades per al 112 i material.

**Instal·lar a l'iPhone:** obrir la web amb Safari amb cobertura → Compartir → «Afegir a la pantalla d'inici». Després funciona sense connexió.
**Android:** obrir amb Chrome → menú → «Instal·lar aplicació».

## Abans de sortir (amb wifi)

1. Obrir l'app perquè es desi la versió nova.
2. **Mapa → «Descarregar el mapa de la ruta»**: teselles ICGC dels zooms 12 a 16 al voltant del track i dels plans B i C (uns 200 fitxers).
3. **Info → «Actualitzar previsió»**: la previsió queda desada i es veu sense cobertura, amb l'hora en què es va baixar.

## Fitxers

| Fitxer | Què és |
|---|---|
| `index.html` | Pantalles i lògica de l'app (horari, GPS, decisions, llum, 112) |
| `dades.js` | Dades de la fitxa: track, punts, horaris, plans, riscos, material. **Per fer una altra ruta, es canvia aquest fitxer.** |
| `interpretacio.js` | Què explicar a cada punt (amb pregunta per al grup) i temes de la serra: Gaudí, mines, història, geologia, llegendes, flora i fauna. Ve de la guia d'interpretació de la ruta. |
| `mapa.js` | Mapa propi en canvas: teselles ICGC desades, mapa de la fitxa a sota, camins OSM, track, punts i GPS |
| `meteo.js` | Previsió Open-Meteo per a P0, el Xalet i P5, interpolada per altitud i a l'hora de pas de cada punt |
| `camins.js` | Camins d'OpenStreetMap al voltant de la ruta (generat) |
| `orientacio.js` | Solell / obaga de cada tram (generat) |
| `img/` | Mapa de la fitxa i perfils dels dos dies |
| `sw.js` | Funcionament sense cobertura |
| `tools/genera-dades.mjs` | Genera `camins.js` i `orientacio.js` |

## Camins OSM i orientació

Es generen sols amb GitHub Actions (`.github/workflows/dades.yml`) cada vegada que canvia `dades.js`, o a mà a **Actions → «Genera camins OSM i orientació» → Run workflow**. Així els camins no depenen que Overpass respongui el dia de la sortida: van dins de l'app.

## Publicar canvis

Canvieu `CACHE` a `sw.js` (p. ex. `catllaras-v6`) perquè els mòbils baixin la versió nova. El mapa desat no s'esborra.

## Fonts i llicències

- Mapa topogràfic © Institut Cartogràfic i Geològic de Catalunya, CC BY 4.0.
- Camins © OpenStreetMap contributors, ODbL.
- Previsió i elevacions: Open-Meteo (CC BY 4.0; elevacions Copernicus GLO-90). L'API gratuïta d'Open-Meteo és per a ús no comercial: si l'app es fa servir en sortides de pagament, cal valorar-ne el pla comercial.
- Fitxa tècnica v4 d'Izan Pimentel Pérez. Temps i pendents són estimacions que el guia valida al terreny.
