# Landing page

The presentation page for the Faculty Security Management program: a 3D specimen ID card that follows the cursor
and is read on screen, the ksar of Ghardaia in layered plaster, the paper register turning into the digital one,
the six registers, the real web demo embedded, and the offline/encrypted story. Arabic first, French and English.

It is a separate static site (Vite, TypeScript, three.js, GSAP, Lenis). It does not touch the Electron app.

## Present it (offline)
Double-click `present.cmd`. The first time it installs and builds; then it serves the page on
http://localhost:4173 and opens the browser. Nothing is loaded from the internet.

In the page, **Start presentation** (or the `P` key) goes full screen and moves one slide at a time:
Space, Enter, Page Down, Down, or the arrow pointing the way the page reads (Left in Arabic). Esc leaves.
`?lang=fr` or `?lang=en` opens the page in that language.

## Develop
```bash
npm install
```

```bash
npm run dev
```

`npm run site` builds the web demo into `public/demo/` and then the page into `dist/`; `npm run serve` serves `dist/`.
The page must be served over http (the browser refuses ES modules from `file://`), which is why `serve.mjs` exists.

The ID card is a specimen with fictional data (its MRZ check digits are computed, so it would pass a reader); it carries no state emblem.
