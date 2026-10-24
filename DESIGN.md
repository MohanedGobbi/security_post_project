---
name: Faculty Security Register, landing world
description: The ksar of Ghardaia in layered paper-cut plaster, climbed by scroll, with one 3D identity card being read.
colors:
  ink: "#10281f"
  ink-soft: "#2d4a3c"
  on-rose: "#1d0f0b"
  rose: "#c9735f"
  ochre: "#dca24c"
  ochre-deep: "#8a5a12"
  ochre-light: "#ecc782"
  sky: "#8fb6c6"
  wash-blue: "#35607a"
  night: "#1b2f45"
  faculty-green: "#0f4426"
  faculty-green-2: "#16703a"
  lime-wash: "#f3ead9"
  algerian-red: "#d81830"
  door-sand: "#e6d3b0"
  palm-green: "#6aa57e"
  lilac: "#a893c2"
  ledger-paper: "#f1e6cd"
  ledger-ink: "#1d3f8a"
  sheet-white: "#ffffff"
typography:
  display:
    fontFamily: "Reem Kufi, Readex Pro, system-ui, sans-serif"
    fontSize: "clamp(2.2rem, 3.9vw, 4.4rem)"
    fontWeight: 700
    lineHeight: 1.32
    letterSpacing: "0"
  display-latin:
    fontFamily: "Reem Kufi, Readex Pro, system-ui, sans-serif"
    fontSize: "clamp(2rem, 3.3vw, 3.7rem)"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "Reem Kufi, Readex Pro, system-ui, sans-serif"
    fontSize: "clamp(1.9rem, 3.6vw, 3.4rem)"
    fontWeight: 600
    lineHeight: 1.3
  title:
    fontFamily: "Reem Kufi, Readex Pro, system-ui, sans-serif"
    fontSize: "1.45rem"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "Readex Pro, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "Readex Pro, system-ui, sans-serif"
    fontSize: "0.88rem"
    fontWeight: 600
    lineHeight: 1.3
  data:
    fontFamily: "Overpass Mono, ui-monospace, monospace"
    fontSize: "0.9rem"
    fontWeight: 500
  hand:
    fontFamily: "Aref Ruqaa, Readex Pro, serif"
    fontSize: "1.32rem"
    fontWeight: 400
    lineHeight: "2.4rem"
rounded:
  sm: "0.5rem"
  md: "0.9rem"
  lg: "1.1rem"
  pill: "99px"
  plaster: "1.1rem 0.4rem 1.1rem 0.4rem"
  arch: "50% 50% 0.4rem 0.4rem / 26% 26% 0.4rem 0.4rem"
  card: "5%"
spacing:
  bar: "4.4rem"
  bar-narrow: "3.6rem"
  page-inline: "max(clamp(1.6rem, 5vw, 6rem), calc((100vw - 90rem) / 2))"
  column-gap: "clamp(1.5rem, 4vw, 4rem)"
  terrace-edge: "56px"
components:
  button-solid:
    backgroundColor: "{colors.faculty-green}"
    textColor: "{colors.lime-wash}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0.95rem 1.7rem"
  button-solid-hover:
    backgroundColor: "{colors.faculty-green-2}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0.95rem 1.7rem"
  button-present:
    backgroundColor: "{colors.ochre}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0.7rem 1.1rem"
  chip-green:
    backgroundColor: "{colors.faculty-green}"
    textColor: "{colors.lime-wash}"
    rounded: "{rounded.pill}"
    padding: "0.7rem 1.25rem"
  readout:
    backgroundColor: "{colors.lime-wash}"
    textColor: "{colors.ink}"
    rounded: "{rounded.plaster}"
    padding: "1rem 1.3rem 0.9rem"
  door:
    backgroundColor: "{colors.rose}"
    textColor: "{colors.ink}"
    rounded: "{rounded.arch}"
    padding: "1.5rem 0.5rem 1rem"
  nav-bar-scrolled:
    backgroundColor: "{colors.lime-wash}"
    textColor: "{colors.ink}"
    height: "{spacing.bar}"
---

# Design System: Faculty Security Register, landing world

## Overview

**Creative North Star: "The Plaster Ksar"**

The landing page is the ksar of M'zab seen from the valley, built from layered paper-cut plaster. Each section is a terrace in its own house colour, sitting on the one below behind a stepped silhouette, and the visitor climbs from sky-wash morning at the hero to indigo night at the close. One physical object, a 3D specimen identity card, lives on a fixed WebGL canvas and travels between DOM slots as the page scrolls, being read.

Surfaces are matte and flat. Depth comes from stacked layers, soft offset shadows with negative spread, and a fine multiply grain laid over everything. The only shine in the world belongs to the card's clearcoat laminate and its holographic M'zab star. The dark-glow security look and the SaaS section stack are rejected.

**Scope boundary.** This world covers the landing page only (`landing/`). The Electron app in `src/renderer` keeps its own older look (the green and red colours in `brand.ts`, the Cairo font). This system does not replace it, and app screens should not take tokens from this file unless someone explicitly decides to migrate them.

**Key Characteristics:**
- Stacked house-colour terraces joined by a tiled stepped edge (56px tall, 480px repeat).
- Arch niches and asymmetric plaster corners, never right-angle boilerplate.
- Matte layers, soft offset shadows, plaster grain (multiply, 0.55 opacity); no glows.
- One persistent WebGL card: neutral tone mapping, clearcoat laminate, bevelled green core.
- Arabic first and RTL; inline-logical properties throughout; FR and EN switchable.

## Colors

The plaster of Ghardaia's walls: warm rose, ochre and lime-wash against wash blues and an indigo night, with faculty green as the institutional voice and Algerian red kept for reading and correction.

### Primary
- **Faculty Green** (faculty-green): solid buttons, chips, the register header, the walls terrace ground, and the card's core. Hover moves to **Faculty Green Bright** (faculty-green-2), which also marks success states and dt labels on lime.

### Secondary
- **Ksar Rose** (rose): the story terrace ground (text in **Rose Shadow**, on-rose), the default door tone, the minaret cap.
- **Ochre Plaster** (ochre): the scan terrace ground, the Start-presentation button, selection highlight, bullet ticks on night, the active HUD dot. **Burnt Ochre** (ochre-deep) is the focus ring on light grounds, the nav underline. The page hides its scrollbar. **Pale Ochre** (ochre-light) is for small headings on green and night.

### Tertiary
- **Algerian Red** (algerian-red): the scan read-head and read band on the card, the active step numeral, the live "reading" status, the register header rule, strike-throughs. Nothing else.
- **Door washes**: door-sand, sky, palm-green, lilac, alongside rose and ochre, are the door and panel tones and are only used there.

### Neutral
- **Lime-Wash** (lime-wash): paper. The readout, the demo terrace, the scrolled bar, pills on coloured grounds, and text on every dark ground.
- **Ksar Ink** (ink) and **Soft Ink** (ink-soft): body text and secondary text on light grounds.
- **Sky Wash** (sky) to **Wash Blue** (wash-blue) to **Indigo Night** (night): the hero sky gradient start, the doors terrace ground (deepened so lime text holds 5:1), and the night close plus the page body behind everything.
- **Ledger Paper** / **Ledger Ink**: the paper register in the story only, ruled at 2.4rem with a red margin line. **Sheet White** is only for the digital register and the device screen.

### Named Rules
**The Red Reads Rule.** Algerian red means "being read" or "corrected": scan line, active step, strike-through, the register rule. It is never decoration and never a section ground.

**The Terrace Ground Rule.** Every full section owns one house colour as its ground (sky gradient, rose, wash blue, ochre, lime-wash, faculty green, night), in that climbing order. Two adjacent terraces never share a ground.

## Typography

**Display Font:** Reem Kufi (with Readex Pro, system-ui)
**Body Font:** Readex Pro (with system-ui)
**Label/Mono Font:** Overpass Mono for MRZ, numbers and register data; Aref Ruqaa for handwriting on the paper ledger only.

**Character:** A geometric Kufi display carved like plaster lettering over a calm, open bilingual sans; mono and ruq'a hand mark the two record worlds, machine and paper.

### Hierarchy
- **Display** (700, clamp(2.2rem, 3.9vw, 4.4rem), 1.32 in Arabic; Latin uses display-latin at 1.08 and -0.015em): hero headline and the close headline only.
- **Headline** (600, clamp(1.9rem, 3.6vw, 3.4rem), 1.3; 1.12 and -0.01em for Latin): one per terrace.
- **Title** (600, 1.4 to 1.5rem, 1.3 to 1.4): step titles, door panel name, facts.
- **Body** (400, 1rem/1.7; leads 1.08 to 1.12rem): measure capped at about 33 to 38rem.
- **Label** (600, 0.82 to 0.95rem): buttons, chips, language switch, door names, HUD.
- **Data** (Overpass Mono 500, 0.86 to 0.95rem): left-to-right data fields inside RTL text.

### Named Rules
**The Script Height Rule.** Arabic runs get taller line heights (1.3 headlines, 1.7 body). Tightened leading and negative tracking apply only under `html:not([lang='ar'])`.

**The Two Hands Rule.** Aref Ruqaa belongs to the paper ledger and Overpass Mono to machine data. Neither is used for interface text.

## Layout

The page is a vertical stack of full-viewport terraces (`min-height: 100svh`). Each one is padded by the fixed bar height plus 1.4 to 4rem on top, and uses a fluid inline gutter (page-inline) that clamps to a centred 90rem column on wide screens. Two-column grids (hero 0.95fr/1.2fr, scan 1fr/1.05fr, walls 1fr/1fr) use column-gap and collapse to one column at 820px. On phones the hero copy dissolves (`display: contents`) so the card comes straight after the promise and before the readout. The brand wordmark hides below 1240px; nav, Start presentation and the scroll hint hide below 820px, where the bar shrinks to 3.6rem. Every edge uses inline-logical properties, and the ksar skyline mirrors under RTL.

## Elevation & Depth

Layered and matte. Depth is built from stacked plaster layers (five seeded skyline SVGs that drift apart on scroll), terraces overlapping through the stepped edge, and soft offset shadows with large negative spread that read as paper lifted off a wall. A multiply grain texture sits over the whole page at 0.55 opacity. No glows, no blurred halos behind elements.

### Shadow Vocabulary
- **Paper lift** (`0 22px 30px -18px rgba(16,40,31,.55)`): the readout and lime paper cards.
- **Sheet drop** (`0 34px 44px -24px rgba(60,20,10,.65)`): the ledger and register on the rose terrace.
- **Door stand** (`0 14px 20px -12px rgba(8,20,30,.7), inset 0 -10px 0 rgba(16,40,31,.12)`): doors; the inset is the threshold.
- **Button press** (`0 10px 18px -10px rgba(15,68,38,.8)`): the solid green button.
- **Skyline haze** (`drop-shadow(0 -10px 16px rgba(16,36,50,.2))`): the ksar layers.

### Named Rules
**The Shine Belongs To The Card Rule.** Only the WebGL card has gloss: neutral tone mapping (exposure 1.05), print roughness 0.6 under clearcoat 0.6, a bevelled green core under clearcoat 1, a soft light band that slides with the tilt, and a hue-shifting eight-point star hologram. DOM surfaces stay matte.

## Shapes

The geometry is M'zab plaster. Doors are round-headed arches (rounded.arch) whose heights step up across the row. Paper cards get asymmetric hand-trowelled corners (rounded.plaster; the ledger 0.3rem 0.8rem 0.3rem 0.3rem, door panels 1.2rem 1.2rem 0.4rem 0.4rem). Interactive controls are full pills (99px). Terrace boundaries are stepped parapet silhouettes, and the skyline is stacked cubes with arched window holes rising to a tapered minaret. The eight-point interlaced star is the one ornament, used on the card. Dividers are 1.5px lines or dashed rules at ink 28%.

## Components

### Buttons
- **Shape:** full pill (99px), 2px border slot.
- **Solid:** faculty green with lime text, 0.95rem 1.7rem, button-press shadow; hover lifts by 2px and brightens to faculty-green-2.
- **Ghost:** 2px ink outline, transparent; hover tints ink at 8%.
- **Present:** ochre pill in the bar, smaller (0.7rem 1.1rem).
- **Focus:** 3px solid outline offset by 3px in burnt ochre, switching to lime-wash on dark terraces through the `--focus` variable.

### Chips
- **Style:** filled green pills with lime text (story outcomes), or 1.5px ink-outline pills on door panels.

### Cards / Containers
- **Readout:** lime-wash paper, plaster corners, paper-lift shadow, dashed underlines on fields, a status dot that blinks red while reading and turns into a green check when done.
- **Register:** white sheet, 0.9rem radius, green header with a 4px red rule, rows ruled with #e8e1d2, corrected rows tinted #e3f1e7.

### Navigation
- **Bar:** fixed, transparent over the hero, lime-wash with a hairline and a soft shadow once scrolled. Section links at 0.92rem with a 3px burnt-ochre underline that scales in from zero on hover or when the section is active. The language switch is a currentColor-outlined pill segment, with the pressed language filled ink.
- **Presentation HUD:** dark green pill at 92% opacity, line icons at stroke 2.4, progress dots that grow 1.5x in ochre when active. The bar hides in presentation mode.

### Doors (signature)
A row of arch-headed doors in wash tones on wash blue, one per paper register, with an inline line icon (stroke 1.75) and a label. Hover rises 0.5rem; the selected door rises 0.9rem with a lime outline offset by 5px. The panel below takes the selected door's tone. The "add" door is a dashed lime outline.

### Specimen Card (signature)
A single WebGL card (aspect 1.586) that follows the cursor, flips, and is scanned by a flat red read-head over the MRZ. It is always labelled as a specimen. With reduced motion or no WebGL it falls back to a flat image with a paper-drop shadow.

### Motion
Ease `cubic-bezier(0.16, 1, 0.3, 1)` for every state change. Lenis smooth scroll (lerp 0.085). The hero rises in 1s with a 0.12s stagger; skyline layers climb over 1.6s with a 0.14s stagger. Under reduced motion, all animation and transitions are off.

## Do's and Don'ts

### Do:
- **Do** give each new terrace one house colour ground and seat it on the stepped terrace edge in the colour of the section above.
- **Do** use soft offset shadows with negative spread and the plaster grain for depth.
- **Do** switch `--focus` to lime-wash on any dark terrace.
- **Do** write layout with inline-logical properties and test RTL first.
- **Do** keep text on wash grounds at 4.5:1 or better by deepening the ground (as the doors went to #35607a), not by lightening the text.

### Don't:
- **Don't** add glows, neon, or dark-glow security styling; the night terrace is matte indigo with lit windows, not light bloom.
- **Don't** use Algerian red as a fill, ground, or decoration outside reading and correction.
- **Don't** give DOM surfaces gloss or gradients other than the hero sky; shine belongs to the card.
- **Don't** apply this landing world's tokens to the Electron app in `src/renderer` without an explicit migration decision.
- **Don't** use Aref Ruqaa or Overpass Mono for interface text.
