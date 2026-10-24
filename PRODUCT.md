# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Confirmed in chat: a separate static site in `landing/` (Vite, TypeScript, Three.js, GSAP), bundled with no CDN so it works offline on the presentation laptop; deployable to Vercel. The Electron app itself is not touched.

## Users
The landing page is presented to the **faculty administration** (the dean and deanship of the Faculty of Law and Political Science, University of Ghardaia), who decide whether the faculty uses the system. The software itself is used daily by the security office: guards (عون الأمن), team leaders (رئيس فرقة الأمن) and an administrator, on one Windows PC.

## Product Purpose
Faculty Security Management (برنامج إدارة الأمن بالكلية) replaces the paper registers of the faculty's internal security office: visitors, incidents, shift and custody handovers, lost and found, letters, events, and more. The landing page exists to make the faculty's decision-makers see, in a presentation, what the system does and want it. Goal of the page: the audience is impressed (a showcase, no hard call to action).

## Positioning
Built for this one faculty, from its own paper registers. Arabic first (right to left), French and English; PIN-only login; works fully offline; every record is encrypted and nothing is ever erased (corrections stay visible). Made by ROWD Tech.

## Operating Context
Presented live (projector or laptop) in Arabic to administrators; also hosted as a link. The real product runs on a Windows PC at the security office with no network. A browser demo with sample data in Arabic exists in `demo/` (built to `demo-dist/`).

## Capabilities and Constraints
- Registers as tiles: shift, custody handover, incidents (with the deanship's visa), lost and found, letters, events; optional: reports, maintenance, official visits, evacuation drills, fire alarms. Entries are numbered and never erased.
- Visitors with ID card / passport scanning by webcam (MRZ, QR, OCR of printed Arabic and Latin text), every scanned card photographed and stored encrypted; watchlist; people on site and exit.
- Student directory imported from Excel/CSV, searched by name or card number.
- Print / PDF / Excel export of every register and period report, A4 with the faculty header and both logos.
- Administration: accounts and permission levels, a register builder, the audit trail; password-protected backup and daily safety copies.
- Privacy: AES-256-GCM encryption of personal data, key tied to the Windows account (DPAPI), ID numbers searched through a keyed hash, all OCR local, no data leaves the PC.
- Not done / not to be claimed: statistics and reports by day/week/month/year are in progress; card scanning is not yet tested on real Algerian cards; no pilot has run at the security office; the Debian package is untested. No usage numbers, testimonials or benchmarks exist.

## Brand Commitments
- Faculty and university identity: both logos (`resources/brand/ghardaia-law-faculty.png`, `resources/brand/ghardaia-university.png`), green `#0f4426` / `#16703a` and red `#d81830` from those logos.
- "Made by ROWD Tech" credit (`resources/brand/rowd-tech-wordmark.png`, `rowd-tech.png`).
- Arabic first and right to left; French and English available.
- Binding from the user: a 3D ID card hero that follows the cursor (no 3D security-guard character); identity inspired by Ghardaia and the M'zab valley; scroll story from the paper register to the digital one; the real demo embedded; an offline/encrypted section; AR/FR/EN switch; a presentation mode.
- User-named things to avoid: hacker / neon look, generic SaaS template, cartoon / playful.

## Evidence on Hand
- The real app and a working web demo (`demo-dist/`, built with `npm run build:demo`), Arabic sample data, sample PINs shown in the demo bar.
- Scan test material in `tools/scan-test` (synthetic cards).
- Not available: photos of the real security office or its paper registers, real statistics, testimonials. Anything illustrative must be labelled synthetic.

## Product Principles
1. Show the real mechanism (the card being read, the register filling) before describing it.
2. Arabic is the primary language of the page, not a translation of it.
3. Serious and institutional: this protects a faculty of law; confidence over spectacle, but still memorable.
4. Claim only what is built; mark what is a sample or not finished.
5. Works offline on presentation day.

## Accessibility & Inclusion
Right-to-left layout done properly in all three languages. Respect `prefers-reduced-motion` (static card, no scroll choreography). Readable on a projector (strong contrast, large type).
