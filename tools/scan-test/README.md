# Scanner test bench

There are no real Algerian ID cards available for development, so these tools make realistic stand-ins and measure how
well the program reads them. Use them after any change to `src/main/scan.ts`, `src/renderer/src/scanPipeline.ts` or
`components/CameraPanel.tsx`.

```bash
npm run build
py tools/scan-test/make_cards.py <folder>/cards
py tools/scan-test/run_cards.py <folder>/cards <folder>/data <folder>/results.json
```

Needs Python with `numpy`, `opencv-python`, `Pillow` and `playwright`. Windows only (fonts, `electron.exe`).

- `make_cards.py` writes 37 pictures: three people, back of an Algerian-style ID card (TD1 zone, valid check digits) and
  one passport (TD3), each as: flat and filled, small on the desk, rotated and blurred, tilted with perspective, glare and
  low contrast, soft focus. Two fonts: **Consolas** (a stand-in for the OCR-B of real cards) and **OCR-A Extended**
  (harsh: the reader's model was trained on OCR-B, so this set is expected to fail often; do not optimise for it).
- `run_cards.py` drives the real app through its debugging port, imports each picture on the Visitor entry screen and
  checks the document number, the name and the birth date the form received.

**Results on 20 Oct 2026:** Consolas set 17/18 (13/18 before the multi-version pipeline) and the passport read; OCR-A set 4/18.
Synthetic cards prove the pipeline, not the result on real cards: real cards are OCR-B printed, but also worn, laminated
and shiny. Test with real cards before relying on it.
