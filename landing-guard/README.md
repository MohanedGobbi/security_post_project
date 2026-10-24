# Landing page B: the morning gate

A second, security-first presentation page, kept beside the first one in `landing/`. The whole page is one 3D scene
of the faculty gate in the morning: the guard stands by his booth and turns his head toward the cursor, the security
camera on the booth roof follows it too, the camera moves from the guard to the register shelf inside the booth
(hover or pick a ledger), to the barrier that lifts for a visitor, and up over the whole post. Arabic first, French and English.

Vite, TypeScript, three.js and Lenis, no CDN: it works offline.

## Run
```bash
npm install
```

```bash
npm run dev
```

`npm run site` builds the web demo into `public/demo/` and the page into `dist/`; `npm run serve` serves `dist/` on
http://localhost:4173 (the page must be served over http, not opened as a file). `?lang=fr` or `?lang=en` picks a language;
**Start presentation** or `P` goes slide by slide.

## The guard model
`public/models/guard.glb` is `Xbot.glb` from the three.js examples (github.com/mrdoob/three.js, examples/models/gltf),
a Mixamo character with its idle and nod animations. The page recolours it as a navy uniform and adds a cap, a badge and a radio
in code. Mixamo characters may be used in projects; check Adobe's Mixamo terms before reusing the file on its own.
