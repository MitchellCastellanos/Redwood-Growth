# Redwood Growth — Graphic Asset Plan

Brand name everywhere: **REDWOOD GROWTH** · Offer: **Staffing & Workforce Solutions in Mexico**.
Site stack: static HTML + Bootstrap 5.3 + Bootstrap Icons (GitHub Pages, `CNAME` = `redwoodgrowth.io`).

## A. Existing assets

| File | Current purpose | Recommendation |
|---|---|---|
| `assets/img/logo-gaban.png` (180×180) | "Website by GABAN Solutions" footer credit | **Reuse** (kept in the new footer) |
| `assets/favicon/*` (referenced by the old pages) | Referenced but **never existed in the repo** (404s) | **Replace** — now created, see below |
| `assets/img/og-image.jpg` (referenced with `yourdomain.com`) | Referenced but **never existed**; URL was a placeholder | **Replace** — `og-image.png` created |
| Old brand mark (Bootstrap `bi-tree-fill` icon + Playfair text) | Header/footer brand | **Replace** with vector logo |
| `Backup/` (old site copy) | Backup of the previous site | **Keep, but excluded from search** (`robots.txt` disallow). Consider deleting once the new site is live. |

## B. Assets created in this change (vector / rendered locally — no AI needed)

| Asset | Section | Format / size | File |
|---|---|---|---|
| Primary logo (light backgrounds) | Header | SVG, 172×72 viewBox, wordmark outlined from Montserrat | `assets/brand/logo.svg` |
| Logo for dark backgrounds | Footer, OG image | SVG | `assets/brand/logo-dark.svg` |
| Tree symbol only | Reuse anywhere | SVG, 64×72 | `assets/brand/logo-icon.svg` |
| Favicon (vector) | Browser tab | SVG | `assets/favicon/favicon.svg` |
| Favicons 16/32 px, Apple touch icon 180 px, 512 px icon | Browser / iOS / structured data | PNG | `assets/favicon/favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png`, `icon-512.png` |
| Open Graph / social card | Link previews | PNG 1200×630 | `assets/img/og-image.png` |

Logo concept: the redwood is modernized into three stacked, evenly weighted chevrons (tree + upward growth) on a short trunk; wordmark set in Montserrat ExtraBold/Bold with wide tracking on "GROWTH". Light = navy `#142B45` text with green/teal tiers; dark = white text with lighter green tiers; icon-only variant for favicon and small sizes.
Interface icons, the geometric hero details, and the comparison table are CSS/Bootstrap Icons — no images needed.

## C. Photography — delivered and integrated

| Asset | Section | File | Notes |
|---|---|---|---|
| Hero team photo | Hero | `assets/img/hero-team.jpg` (1536×1024, ~145 KB) | Uploaded as a PNG with a `.jpg` name; converted to a real progressive JPEG. Cropped by an angular clip-path; `object-position` keeps the subject in frame. |
| Why Mexico photo | Why Mexico | `assets/img/why-mexico-guadalajara.jpg` (1448×1086, ~300 KB) | Same conversion. Lazy-loaded. |

Prompts used are kept below for regenerating or extending the set.

## D. Image-generation prompts (format from the `image-prompts` skill — paste the whole block into a new ChatGPT chat)

LOTE 1 DE 1

```
Vas a generar 2 imágenes para el sitio web corporativo de REDWOOD GROWTH, una empresa B2B de reclutamiento, staffing y soluciones de fuerza laboral en México para empresas de Estados Unidos. Te voy a dar las 2 descripciones de una vez, pero quiero que las generes de UNA EN UNA: genera solo la primera ahora y espera. Cuando yo escriba "siguiente", genera la imagen 2. No generes más de una imagen por turno.

Estilo visual que deben compartir las 2 (aplícalo a todas): fotografía editorial corporativa realista, tomada con cámara full-frame y lente de 35–85 mm, luz natural suave de ventana con tonos limpios y luminosos, paleta fría y brillante con blancos, grises azulados y acentos sutiles de verde esmeralda y azul marino (#142B45), colores naturales sin saturar, piel y texturas auténticas, profundidad de campo moderada, composición limpia con espacio negativo, aspecto de fotografía real de una marca B2B premium (no stock genérico, no render, no ilustración, no look generado por IA). Sin texto, sin logotipos, sin marcas de agua, sin pantallas con software ni dashboards visibles, sin manos o dedos deformados, sin caras distorsionadas, sin gente posando exageradamente para la cámara. Formato horizontal. Los costados pueden recortarse en ángulo en el sitio, por lo que los sujetos importantes deben quedar lejos de los bordes.

IMAGEN 1 — archivo: assets/img/hero-team.jpg
Proporción 3:2 horizontal. Equipo pequeño de profesionales latinos de unos 25–40 años en una oficina moderna y luminosa, trabajando de forma natural y concentrada. En primer plano a la derecha-centro, una mujer con cabello oscuro ondulado y lentes, suéter verde bosque, sonriendo levemente mientras mira hacia su laptop de lado; detrás de ella, desenfocados, dos colegas (un hombre con barba y audífonos, otra persona de espaldas parcial) colaborando en un escritorio compartido. Ventanales grandes al fondo con luz difusa y plantas discretas. Deja el tercio izquierdo de la imagen más despejado y ligeramente más oscuro/neutro, sin rostros ni objetos importantes en ese tercio.

IMAGEN 2 — archivo: assets/img/why-mexico-guadalajara.jpg
Proporción 4:3 horizontal. Vista urbana profesional de Guadalajara, México, al final de la tarde con cielo despejado y luz dorada suave: la Catedral de Guadalajara con sus torres neogóticas amarillentas ocupando el centro-izquierda de la imagen, rodeada de edificios históricos de cantera y calles limpias, con algunos peatones vestidos de forma profesional caminando a lo lejos, y al fondo siluetas azuladas de montañas. Debe sentirse una ciudad moderna y ordenada, no una postal turística: sin sombreros, sin banderas, sin elementos folclóricos, sin multitudes. Mantén el cielo y el lado derecho tranquilos, con poco detalle.

Empieza generando solo la IMAGEN 1 y espera mi "siguiente".
```

## E. Notes for the logo (vector rebuild)

Do not use raster/AI logos. If the identity is refined later, edit the SVGs in `assets/brand/` (wordmark is outlined, so no font dependency) and re-export the PNG favicons and `og-image.png` from them.
