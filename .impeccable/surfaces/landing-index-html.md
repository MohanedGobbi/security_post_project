---
version: 1
slug: "landing-index-html"
primary_target: "landing/index.html"
related_targets: []
---

# Landing page (landing/index.html)

## Scope and mode
Persuade. A presentation page for the faculty administration; goal is to impress (no hard CTA). Arabic first, RTL; FR and EN switchable. Works offline.

## Audience, proof, constraints
Dean and deanship of the Faculty of Law and Political Science, University of Ghardaia. Proof: the real app (demo embedded), real register names, real security facts from the README. No invented numbers; the ID card shown is a labelled specimen. Not claimed: statistics reports (in progress), tested on real Algerian cards, pilot.

## Direction contract
THESIS: The page is a ksar of M'zab seen from the valley, built as layered paper-cut plaster, and the visitor climbs it as they scroll. One 3D identity card follows the cursor and travels with the scroll, being read. It refuses the dark-glow security look and the SaaS section stack.
OWN-WORLD: Plaster palette taken from Ghardaia's walls: rose #c9735f, ochre #dca24c, wash blue #6f9bb0, indigo night #1b2f45, faculty green #0f4426 / #16703a, lime-wash #f3ead9 only for paper and the card interior, Algerian red #d81830 for the scan line and stamps. Matte flat layers with soft offset shadows and fine plaster grain, no glows. Also from the M'zab wall washes: lilac #a893c2 and palm green #6aa57e on the doors; the doors ground is #35607a, a deeper wash blue so lime text keeps 5:1. Arch niches and stepped houses, no right-angle boilerplate. Reem Kufi display, Readex Pro body, Overpass Mono for MRZ and data.
STORY: Visitor understands that paper registers fail (errors scratched out, lost), that this system numbers and never erases, that it reads a card in seconds, runs offline inside the faculty's walls, and is already working (live demo). They leave impressed and trust it.
FIRST VIEWPORT: Sky-wash ground. Layered ksar skyline fills the lower third, rising to a minaret on the left edge (RTL start side is right; the minaret sits at the inline-end). The 3D specimen card, large (about 40% of the width), floats high in the inline-end column, tilting toward the cursor; it flips to its back and a flat red scan line reads the MRZ while the visitor form under the headline fills name, birth date and document number. The minaret rises in the gap between card and headline (moved from the inline-end edge so the card never hides it). Headline in Reem Kufi at the inline-start top, quiet nav (both logos, section links, language switch, Start presentation).
FORM: A single persistent WebGL card that moves between DOM slots as you scroll; sections are stacked house-colour terraces. Brief-pinned direction (the user named the card, the M'zab identity and the sections), so the roll was skipped. seed: none (brief-pinned, roll skipped)
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Unresolved
Specimen card identity (fictional name). No photos of the office; none fabricated.
