# Landing page B: the morning gate

A second, security-first presentation page, kept beside the first one in `landing/`. The whole page is one 3D scene
of the faculty gate in the morning: the guard stands by his booth in tactical gear and turns his head toward the cursor, the security
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
`public/models/guard.glb` is the **SWAT** character by Quaternius (CC0, public domain), downloaded from poly.pizza
(https://poly.pizza/m/Btfn3G5Xv4). The page recolours the tactical suit to the faculty security navy, gives the visor a gloss and
adds a gold badge in code; it uses the character's neutral idle and its wave (when the shift section arrives), and turns his head
toward the cursor. The character's weapon and combat animations are not used.
