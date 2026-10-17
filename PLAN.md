# Security Register — Project Plan

A digital logbook for security guards at company gates, university entrances and any guard post.
It replaces the paper register: visitors, vehicles, deliveries, incidents, patrols and shift handovers,
with ID-card scanning to fill forms automatically. Languages: Arabic (RTL), English, French.

---

## 1. What already exists (and what we take from each)

| Product | Type | Best ideas to copy |
|---|---|---|
| **EvTrack** (guard app) | Commercial, Android | Guard scans ID/passport with the phone camera; vehicle + passengers logged together; QR pass issued; works without a fixed kiosk |
| **LogBook360** | Commercial VMS | Every entry/exit timestamped; "who is inside right now"; **emergency evacuation list**; watchlist / blacklist |
| **Lobbytrack** (Jolly Tech) | Commercial VMS | Badge printing with photo + QR; ID scan at the desk; pre-printed badges for expected visitors |
| **Envoy** | Commercial VMS | Pre-registration (host invites visitor, guard just confirms); host notification on arrival |
| **GuardsPro / GoCanvas / Jotform / MiraTag** | Guard reporting apps | Daily Activity Report (DAR): timestamped entries, incident forms with photos + signature, patrol log, shift handover, supervisor review, export/email to management |

**Gaps we can win on**
- Most tools are English-first and cloud-only. None of the ones found handle **Arabic + French + English with proper RTL**.
- Gatehouses often have **weak internet** → our app must work fully **offline**.
- Commercial tools are either "visitor kiosk" OR "guard report" — we combine both in one guard-focused app.
- Few handle **local national ID cards** (non-MRZ, Arabic text) — generic scanners target US driver licences.

---

## 2. Core principles

1. **3 taps for the common case.** Visitor in = Scan → Confirm → Save.
2. **Simple by default, details on demand.** Each form shows only required fields; a "More details" section expands optional fields (purpose, host, vehicle, notes, photos, custom fields).
3. **Scanner never blocks the guard.** OCR fills the form; the guard always reviews/edits. If the scan fails, typing is always available.
4. **Offline first.** Everything saved locally instantly; sync when a connection exists.
5. **Trilingual from day one.** AR / EN / FR switchable at any time, full RTL layout for Arabic.
6. **Privacy by design.** ID data is sensitive — encrypted, role-restricted, auto-deleted after a set period.

---

## 3. Features

### 3.1 Log types (the main buttons on the home screen)
| Button | Required fields | Optional ("More details") |
|---|---|---|
| **Visitor IN** | Name, ID number, time (auto) | Photo, company, person visited, purpose, badge no., phone, vehicle, items carried, signature, notes |
| **Visitor OUT** | Pick from "inside now" list (1 tap) | Badge returned?, notes |
| **Vehicle IN/OUT** | Plate number | Driver (link to visitor), passengers, type/color, photo, cargo |
| **Delivery** | Courier/company, recipient | Package count, photo, signature of recipient |
| **Incident** | Type, description, time | Location, photos, people involved, severity, action taken, signature |
| **Patrol / Round** | Checkpoint, status OK/issue | Photo, note (later: QR/NFC checkpoints) |
| **Key / Equipment** | Item, person, out/in | Notes |
| **Note / Occurrence** | Free text | Photo, category |

### 3.2 ID card scanning
Strategy, from most to least reliable:
1. **MRZ** (the `<<<<` lines on passports and many modern ID cards) → very accurate, Latin characters only.
2. **Barcode / QR / PDF417** on the card (driver licences, some national IDs, student/employee badges).
3. **OCR of the card front** with per-card-type templates (field positions for the national ID, residence permit, student card, etc.).
   - Latin text (French/English fields).
   - **Arabic text** (names/addresses) — needs an Arabic-capable OCR engine (see §5).
4. **Manual entry** fallback, always available.

Extras:
- Take a photo of the visitor (and optionally the card) — configurable, since storing card images is sensitive.
- **Returning visitor recognition**: scan the same ID again → form pre-filled from last visit, shows visit history.
- **Watchlist check** on every scan → full-screen red alert if the ID is banned.

### 3.3 Live views
- **Inside now** — everyone currently on site, how long they've been inside, with one-tap check-out.
- **Evacuation list** — the same list, printable/shareable in one tap during an emergency.
- **Overstay alert** — visitor still inside after closing time / after X hours.

### 3.4 Shift & reporting
- Shift start/end with guard name (PIN login), auto-generated **Daily Activity Report** for the shift.
- **Handover note** shown to the next guard when they log in.
- Search & filter by date, name, ID, plate, type.
- Export **PDF** (printable, looks like the official register) and **Excel/CSV**.

### 3.5 Admin / supervisor
- Sites & posts (main gate, back gate, building B…).
- Users & roles: Guard, Supervisor, Admin.
- **Custom fields** per site (e.g. a university adds "Faculty", a factory adds "Safety briefing done?").
- Manage watchlist, expected visitors (pre-registration), card templates, data retention period.
- Supervisor dashboard (later, web): visits per day, peak hours, incidents, guard activity.

### 3.6 Later / nice-to-have
- Pre-registration link: host registers a guest → guard sees "expected visitors" and confirms with one tap.
- Host notification by SMS / WhatsApp / email when their visitor arrives.
- Badge / pass printing (thermal printer) with QR code for exit scan.
- Licence-plate recognition from the camera.
- NFC/QR patrol checkpoints with GPS.
- Panic / SOS button to supervisor.

---

## 4. Languages (AR / EN / FR)
- All UI text in translation files (`ar`, `en`, `fr`); language chosen per user, switchable from the top bar.
- Arabic: full RTL mirroring, Arabic font (e.g. Noto Sans Arabic / Cairo), option for Western or Arabic-Indic digits.
- Dates and times formatted per locale.
- PDF reports generated in the user's language (RTL-aware PDF for Arabic).
- Stored data stays as entered (an Arabic name stays in Arabic); search should match both scripts when the card provides both.

---

## 5. Recommended technology

### 5.0 Decision for Phase 1: Windows PC at the reception desk
Flutter is not installed on the dev machine and Google ML Kit does not run on Windows, so Phase 1 uses:

| Part | Choice | Why |
|---|---|---|
| App shell | **Electron + React + TypeScript** (electron-vite) | Runs on the Node.js already installed; Chromium gives perfect Arabic shaping + RTL |
| Local database | **SQLite** (`node:sqlite` built into Electron's Node) | Offline, single file, no native build tools needed |
| Encryption | Sensitive fields (ID number, birth date, phone, photos) encrypted with **AES-256-GCM**; key protected by **Windows DPAPI** (Electron `safeStorage`); ID lookup via HMAC | Data unreadable if the DB file is copied to another PC |
| PIN login | scrypt-hashed PINs, roles Admin / Guard | Fast for guards, no passwords to remember |
| Webcam / scanner | `getUserMedia` webcam preview, or import an image from a flatbed/document scanner | Works with any USB webcam |
| MRZ OCR | **tesseract.js** (offline, `eng` model, MRZ character whitelist) + **`mrz`** parser with check digits | Passports and modern ID cards |
| Text OCR (AR/FR/EN) | **tesseract.js** `ara+fra+eng`, results shown as clickable lines that fill the focused field | For cards without MRZ / barcode |
| Barcodes | **zxing-wasm** (QR, PDF417, Code128, DataMatrix…) | Offline, many formats |
| Reports | HTML report → Electron `printToPDF` (perfect Arabic), **ExcelJS** for .xlsx | Offline export |

The Flutter table below stays as the option for a later Android/tablet version.

| Part | Choice | Why |
|---|---|---|
| App | **Flutter** | One codebase → Android tablet/phone (main target), Windows PC at reception, iOS, web. Excellent RTL + i18n support. Native camera access. |
| Local database | **SQLite (Drift) with encryption (SQLCipher)** | Offline, fast, encrypted at rest |
| MRZ + Latin OCR | **Google ML Kit Text Recognition** (on-device, free) | Fast and accurate for Latin text/MRZ. ⚠ Does **not** support Arabic script. |
| Arabic OCR | **Tesseract (`ara` model)** or **PaddleOCR Arabic model** on-device; optional cloud fallback (Google Cloud Vision) when online | Studies show open-source Arabic OCR is ~75% accurate on raw text, so templates + guard review are essential. Must be tested on real cards. |
| Barcodes | **ML Kit Barcode Scanning** (QR, PDF417, Code128…) | On-device, free |
| Backend (phase 3) | **Supabase** (Postgres + auth + storage) or a small Node/NestJS API | Multi-site sync, supervisor dashboard |
| Reports | `pdf` + `excel` Flutter packages | Offline export |

Hardware: any mid-range Android tablet/phone with a decent camera is enough. Optional: USB/Bluetooth thermal badge printer, dedicated document scanner for high-volume desks.

---

## 6. Data model (simplified)

```
Site(id, name, address, settings)
Post(id, site_id, name)
User(id, name, role, pin_hash, language, site_id)
Shift(id, user_id, post_id, start, end, handover_note)
Person(id, full_name_latin, full_name_ar, id_type, id_number, nationality, dob, phone, company, photo, first_seen, last_seen)
Visit(id, person_id, post_id, shift_id, time_in, time_out, host, purpose, badge_no, vehicle_id, custom_fields_json, notes, signature)
Vehicle(id, plate, type, color)
LogEntry(id, type[incident|delivery|patrol|key|note], post_id, shift_id, time, data_json, photos, severity)
Watchlist(id, id_number, name, reason, added_by, active)
CardTemplate(id, name, country, field_regions_json)
AuditLog(id, user_id, action, entity, time)   -- who changed what
```

---

## 7. Privacy & legal (important — ID data is personal data)
- Show a short notice to visitors ("Your ID data is recorded for security purposes, kept X days").
- Configurable **retention** (e.g. 90 days) with automatic deletion of old visits/photos.
- Store the minimum: don't keep full card images unless the site requires it.
- Encrypted database, PIN/role access, audit log of edits/deletions, entries can't be silently deleted by guards.
- Check the personal-data protection law of each country you deploy in (most require declaring this kind of processing).

---

## 8. Roadmap

### Phase 1 — MVP (single post, offline) — built 2026-10-17 for Windows PC (see README.md)
Also done early: notes with categories, evacuation list PDF, data retention, audit log.
Still to do: test the scanner on real local ID cards, test the Windows installer (`npm run dist`).
- Flutter app, PIN login, AR/EN/FR + RTL
- Visitor IN / OUT, Inside-now list, Note entry
- MRZ + barcode scanning, manual entry fallback, visitor photo
- Returning-visitor auto-fill
- Search + PDF/Excel export
- Encrypted local DB

### Phase 2 — Full guard logbook — built 2026-10-17: vehicles, deliveries, incidents with photos, shifts + handover + daily report, watchlist
Then (same day): patrol checkpoints with QR labels, keys & equipment log, overstay / closing-time / key / patrol alerts, custom fields per site.
Still to do from this list: Arabic card templates for local ID cards without MRZ (needs real card samples).
- Vehicle, Delivery, Incident, Patrol, Key logs
- Shifts, handover notes, auto Daily Activity Report
- Arabic OCR + card templates for local ID cards
- Watchlist alerts, evacuation list, overstay alerts
- Custom fields per site, retention auto-delete

### Phase 3 — Multi-site & cloud
- Backend sync (offline queue), multiple posts/sites
- Web supervisor dashboard + statistics
- Pre-registration + host notifications
- Badge/QR pass printing, QR exit scan

#### Phase 3 design (2026-10-17)
- **Server** (`server/`): a self-hosted Node.js program (TypeScript run directly by Node ≥ 22.18), one SQLite file, no cloud service.
  Runs on any PC / server / VPS of the organization; HTTPS with its own certificate or behind a reverse proxy.
- **Posts (reception PCs)** stay offline-first. An administrator links a post to the server with the server address +
  a one-time **enrollment code** created in the dashboard; the post receives its own device token (stored encrypted, server keeps only its hash).
- **Sync** every minute: the post uploads new / changed records (visits, vehicles, deliveries, incidents, notes, shifts,
  patrol rounds, key loans) and downloads the organization **watchlist** and the **expected visitors** of its site.
  **Data minimisation**: photos and full ID numbers never leave the post; the server gets a masked ID (••••4567).
- **Dashboard** (`dashboard/`, served by the server): roles *owner* (everything), *supervisor* (their sites), *host*
  (only pre-registers their own guests). Pages: overview of all sites live, records search, expected visitors, sites & posts,
  watchlist, users, settings.
- **Pre-registration**: created in the dashboard (or locally on a post without server); visitor gets a code + QR;
  guard picks from "Expected today" or scans the QR; arrival is reported back to the dashboard.
- **Badges**: printed on check-in (automatic or button) on any Windows printer; card / label / A6 sizes; QR on the badge
  checks the visitor out when scanned at exit.
- Not in this step: host notifications by e-mail / SMS / WhatsApp (needs a mail or SMS provider).
- **Built and tested 2026-10-17**: server + dashboard + sync + pre-registration + badges, tested end to end on one PC
  (server on localhost, a reception app linked with a code, invitation → pass QR scan → check-in → badge QR scan → check-out → dashboard).

### Phase 4 — Extras
- Licence-plate recognition, NFC patrol checkpoints, SOS button, access-control integration

---

## 9. Open decisions
1. Main device: Android tablet at the post, or Windows PC at the reception desk? (Flutter covers both; affects which we polish first.)
2. Which ID cards must be supported first? (Collect 5–10 real sample photos per card type to build and test templates.)
3. Single site to start, or multi-site cloud from the beginning?
4. Free / internal tool, or a product to sell to companies (affects licensing, multi-tenant design)?

---

## Sources
- EvTrack security guarding: https://evtrack.com/applications/security-guarding
- Visitor management best practices (SecurityInfoWatch): https://www.securityinfowatch.com/access-identity/access-control/article/10713995/how-to-do-visitor-management-guidelines-and-best-practices-for-deploying-visitor-management-systems-in-schools
- Visitor management guide (Yarooms): https://www.yarooms.com/blog/visitor-management-system
- 2026 VMS rankings (iTechGuides, affiliate): https://www.itechguides.com/directory/visitor-management-software/
- LogBook360 listing: https://www.softwareadvice.co.uk/software/551301/LogBook360
- Lobbytrack vs Envoy: https://www.lobbytrack.com/best-visitor-management-practices/best-cost-saving-alternative-to-envoy
- GuardsPro DAR: https://support.guardspro.com/hc/en-us/articles/36241647490715-How-to-view-DAR-on-the-Guard-Mobile-App
- GoCanvas security officer DAR: https://www.gocanvas.com/mobile-forms-apps/18315-Security-Officer-Daily-Activity-Log
- Jotform security guard app: https://www.jotform.com/app-templates/security-guard-app
- MiraTag DAR template: https://miratag.com/en/checklist-templates/security-guard-daily-activity-report
- Open-source OCR for Arabic & others (ICON 2024): https://aclanthology.org/2024.icon-1.48.pdf
- MRZ pipeline research: https://media-hp.technikum-wien.at/media/20260616094052/Master_Thesis_Eberdorfer_Poster_A0.pdf
- MRZ OCR for ID cards (GdPicture): https://www.gdpicture.com/?p=8201
