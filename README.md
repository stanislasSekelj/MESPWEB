# mespapp.com

Static site for MESP / PompierMES. No build step: GitHub Pages serves the `docs/` folder of the `main` branch as-is.
The site is developed in the app repository under `website/`; paths below written `website/…` correspond to `docs/…` here.

## Publish

GitHub Pages, custom domain `mespapp.com` (see `CNAME`), behind Cloudflare.
Folders starting with `_` (`_tools/`, `_review/`) are not published by GitHub Pages' default Jekyll build.
Do not add a `.nojekyll` file, or they will be.

## Before going live: fill in the TODOs

Every open item shows on the page as a dashed yellow-green `TODO` box. Search for `class="todo"`.

| What | Where |
|---|---|
| Publisher identity, legal form, SIREN, address, publication director | `mentions-legales.html`; `confidentialite.html` (`#responsable`) |
| Host confirmation and postal addresses | `mentions-legales.html`; `confidentialite.html` (`#site`) |
| Privacy policy date | `confidentialite.html`, first paragraph |
| Purchase data kept with a licence (holder name, e-mail) and retention | `confidentialite.html`, `#destinataires` |

The site states "Licence à vie" and "Mises à jour incluses à vie" (owner decision, 2026-11-19; may change after the first 100 sales).
This is only true once the `stripe-webhook` function and the `20261119000000_stripe_lifetime_licenses` migration are deployed.

Not shown on the site until confirmed: SDIS 44 / J. Fauchart credit, "support prioritaire", volume pricing, quantity choice in Stripe.

## Hero demo: removed

The interactive hero demo was removed at the owner's request. Its markup and script are kept in `_tools/removed-demo/` (not published);
the matching CSS is still in `css/site.css`. To restore it, paste `demo-block.html` back at the end of the hero's `.wrap`, move `demo.js` to `js/` and re-add its `<script>` tag.

## Replace the placeholder scene with a real photo

The demo background is an illustration (`assets/img/scene.webp`, drawn in `_tools/scene.svg`).
To use a real photo:

1. Export it at 1600×1000 px to `assets/img/scene.webp`.
2. In `js/demo.js`, update `SCENE0` (starting positions of the three effects) and `MASK0`
   (the polygon traced around the foreground object the fire should pass behind). Coordinates are in pixels of that 1600×1000 image.
3. In `index.html`, update the `data-crop` values and the inline `clip-path` of the figures in steps 01, 03 and 04, the image `alt` texts, and remove the "illustration provisoire" labels.
4. Update `_tools/og.html` the same way and re-run `node website/_tools/og.mjs`.

## Rebuilding assets (run from the repo root)

| Asset | Command |
|---|---|
| Effects in `assets/fx/` (≤ 600 KB each, plus `.poster.webp` stills) | `python website/_tools/build_fx.py` (needs Pillow) |
| Share image `assets/img/og.jpg` | `node website/_tools/og.mjs` |
| Placeholder scene PNG from the SVG | `node website/_tools/scene.mjs out.png`, then convert to WebP |
| Favicons (`favicon.ico`, `assets/img/icon-*.png`, `apple-touch-icon.png`) | resized from `assets/icon.png` with Pillow |

Looping effects (fire, smoke) are shortened to 3–4 s with a cross-faded loop point so they fit the size budget. Explosions and electric arcs keep every frame.

## Checks

`node website/_tools/review.mjs` serves the folder locally and, at 360 / 390 / 430 / 768 / 1024 / 1440 / 1920 px:
screenshots every page into `_review/`, fails on horizontal overflow, console errors, tap targets under 44 px or a first load over 1.5 MB,
then drives the hero demo with touch emulation (scroll, select, drag, pinch, handles, mask, tint, add, delete, reset), keyboard, mouse drag and reduced motion.

## Notes

- No cookies, trackers, analytics or third-party requests. Fonts are self-hosted (Big Shoulders Display, IBM Plex Sans, IBM Plex Mono: SIL Open Font License).
- `404.html` uses `<base href="/">` so its links work at any path depth. Every other link is relative.
- The Google Play badge is the official French artwork, unmodified; keep the trademark line next to it.
