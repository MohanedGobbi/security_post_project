# Security Register

Digital logbook for security guard posts (companies, universities, gatehouses). It replaces the paper register:
visitors in/out, who is inside now, notes and incidents, and printable or exportable registers.
Arabic (right-to-left), French and English. It runs fully offline on a Windows PC at the reception desk.

See [PLAN.md](PLAN.md) for the full product plan and roadmap.

## Made to fit small and large sites
At first setup, pick the kind of site. Every switch can be changed later in **Settings → Features** (administrators).

| Profile | Switched on |
|---|---|
| Small office | Visitors in / out and logbook notes. No shifts, no extra screens. |
| Company | Plus vehicles, deliveries, incidents, watchlist, shifts and handover. |
| University / large site | Everything, including patrol rounds and keys & equipment. |

- **Modules** (each on or off): vehicles, deliveries, incidents, patrol rounds, keys & equipment, logbook notes, watchlist, shifts & handover.
  A module that is off disappears from the menu, keyboard shortcuts, home tiles and counters, alerts, register tabs, reports,
  exports and custom-field forms. The backend also refuses its actions. Records already saved are kept, and come back
  if the module is switched on again.
- **Visitor form options**: ID card scanning, visitor photo, ID number required (off: a name is enough), visitor badge numbers.
  With scanning and photo both off, the visitor screen is just the form.
- Always on: visitors in / out, people inside, evacuation list, register and export.
- Installations made before this setting existed keep everything switched on.

## Phase 1 features
- First-run setup (site, post, administrator) and PIN login with an on-screen keypad. Five wrong PINs lock the account for 30 s.
- **Visitor IN**: scan the ID card with the webcam (or import a scanned image). Fields are filled automatically from:
  - the MRZ (`<<<` lines on passports and modern ID cards), checked with check digits;
  - barcodes (QR, PDF417, …), including AAMVA driving licences;
  - "Read text on card" (Arabic, French and English OCR). Click a field, then click a text line to copy it there.
- Visitor photo, returning-visitor auto-fill, and a warning when someone is already inside.
- Quick-pick chips for frequent hosts and purposes. Optional fields sit under "More details".
- **Inside now** list with one-tap exit, a filterable Visitor OUT screen, and a printable evacuation list (PDF).
- **Notes** (log of events and incidents) with categories: general, incident, delivery, maintenance, shift handover.
- **Register**: search by date, name, ID number, company or plate. Visit details include the photo. Export to PDF or Excel.
- Admin settings: site and post names, users and roles, data retention (old records are deleted automatically at start-up).

## Phase 2 features
- **Vehicles**: entry and exit with plate, type, colour, driver, company, passengers, cargo and a photo. A known plate pre-fills the last details.
  A visitor who gives a plate at check-in gets a linked vehicle entry that is released when they leave.
- **Deliveries**: receive parcels (carrier, recipient, count, tracking, photo). A "waiting for pickup" list lets you hand them over and record who collected them.
- **Incidents**: type, severity, time, location, description, people involved, action taken, and up to 8 photos (webcam or imported).
  Open incidents are listed by severity and closed with a written resolution.
- **Shifts and handover**: after login a guard reads the previous guard's handover note and the live situation (people and vehicles inside,
  parcels waiting, open incidents), then starts their shift. **End shift** shows the shift summary, asks for a handover note,
  and saves the **Daily Activity Report** PDF (counters, handover note, and a timeline of every event).
- **Watchlist**: people (ID number and/or name) and vehicles (plate) set to *Deny entry* or *Alert only*. Every visitor and vehicle entry is checked:
  a red full-screen alert appears as soon as a match is scanned or typed. A *deny* match on an ID number or plate blocks the entry
  (checked in the backend too) unless an administrator's PIN is entered. Matches and overrides go to the audit log.
  Same-name matches only warn, because names are not unique. Only administrators can edit the list.
- **Patrol rounds**: the administrator defines checkpoints and prints an A4 sheet of **QR labels** to stick at each point.
  A guard starts a round and marks each checkpoint *OK* or *Problem* (with a note), by hand or by showing its QR label to the webcam
  (useful on a Windows tablet carried on the round). Missed checkpoints are reported when the round is finished.
- **Keys & equipment**: register of keys, access badges, radios and equipment. Hand out to a person (optional due time) and record the return.
  Each item shows whether it is available, out, or overdue.
- **Alerts** (Home panel and red badge in the top bar, refreshed every minute): visitor inside longer than *N* hours,
  visitors still inside after closing time, vehicle parked longer than *N* hours, key not returned on time, and patrol round due.
  Thresholds are in Settings (0 or empty turns an alert off).
- **Custom fields per site** (Settings, administrators): extra questions for the visitor, vehicle or delivery forms. Types are text, number,
  yes/no, list of choices and date, with labels in Arabic / French / English. A required field appears with the main fields
  and is enforced in the backend; optional ones go under "More details". Values are searchable and exported.
- **Register** tabs: visitors, vehicles, deliveries, incidents, patrols, keys, notes, shifts (each with its report) and a combined
  activity timeline. The PDF / Excel export includes all of them, with the custom-field columns.
- Keyboard: F1 home, F2 visitor in, F3 visitor out, F4 vehicles, F5 deliveries, F6 incidents, F7 notes, F8 register, F9 settings,
  F10 patrols, F11 keys, F12 expected visitors, Space to scan, Esc back.

## Phase 3: several sites, supervisor dashboard, pre-registration, badges
Everything below is optional: a single PC keeps working alone, offline, exactly as before.

- **Server** (`server/`): a small program the organisation runs on one of its own PCs or servers (or a rented VPS).
  It uses Node.js and one SQLite file; there is no cloud subscription.
- **Linking a reception PC**: in the dashboard, *Sites & posts → Link a post* shows the server address and a one-time code
  (valid 24 h). On the PC: *Settings → Server connection*. The PC then syncs every minute and keeps working if the network is down.
  The top bar shows *Connected / Offline*.
- **What is shared**: posts upload their records (visitors, vehicles, deliveries, incidents, notes, shifts, patrol rounds, keys).
  **Photos and full ID numbers never leave the PC**; the server receives masked numbers (••••4567).
  Posts download the organisation's **watchlist** (checked like the local one) and the **expected visitors** of their site.
- **Web dashboard** (open the server address in a browser), in AR / EN / FR:
  overview of every site (people inside, vehicles, open incidents, parcels, keys, expected visitors, posts online), today's activity,
  records search with CSV export, expected visitors, sites & posts, organisation watchlist, users, settings.
  Roles: *owner* (everything), *supervisor* (their sites), *host* (only invites their own visitors).
- **Expected visitors (pre-registration)**: invited from the dashboard, or added on the reception PC (works without a server).
  The visitor gets a pass with a code and QR (print, download, or copy a ready-made message for e-mail / WhatsApp).
  At the gate: *Expected visitors → Check in*, *Visitor IN → Expected visitor*, or show the pass QR to the webcam.
  The arrival is reported back to the dashboard.
- **Visitor badges**: card (86 × 54 mm), label (62 × 100 mm) or A6, printed on any Windows printer, automatically at check-in or with
  the printer button; the badge has a QR that checks the visitor out when scanned at *Visitor OUT → Scan badge*.
  Settings → Badges shows a live preview.
- Two feature switches control this on each PC: *Expected visitors* and *Visitor badges*.

### Run the server
```bash
npm run build:dashboard
```

```bash
npm run server
```

On first start the console prints a **setup code**: open `http://<server>:8787` and create the owner account with it.

| Variable | Default | |
|---|---|---|
| `SECREG_PORT` | `8787` | listening port |
| `SECREG_HOST` | `0.0.0.0` | listening address |
| `SECREG_DATA` | `./server-data` | database `server.db` and key `server.key` (back up both together) |
| `SECREG_TLS_CERT`, `SECREG_TLS_KEY` | – | PEM certificate and key to serve HTTPS directly |

> Use **HTTPS** outside a closed test network (certificate files above, or a reverse proxy such as Caddy / IIS / nginx):
> the posts send visitor records and their access token. Sessions use HttpOnly SameSite cookies, passwords are scrypt hashes,
> post tokens and session tokens are stored only as hashes, and watchlist ID numbers are encrypted at rest.

## Privacy and security
- ID numbers, birth dates, phone numbers and photos are encrypted (AES-256-GCM) in the database.
  The key is protected by Windows DPAPI, so a copied database file is unreadable on another PC or Windows account.
- ID numbers are found through a keyed hash, so the clear number is never stored.
- Each login, check-in, check-out, record view and export is written to an audit table.
- All OCR runs locally. No data leaves the PC.

> Because the key is tied to the Windows account, back up by exporting (PDF/Excel). A raw copy of the
> data folder cannot be restored on another machine. Data folder: `%APPDATA%\security-register`.

## Run it
Requires Node.js (already installed on this PC).

```bash
npm install
```

```bash
npm run dev
```

Other scripts: `npm run build` (production build), `npm start` (run the built app), `npm run typecheck`,
`npm run dist` (Windows installer via electron-builder; not tested yet).

Set `SECREG_DATA_DIR` to use a different data folder, for example for testing or a portable install.
Set `SECREG_EXPORT_DIR` to save every PDF / Excel export straight into that folder without the Save dialog.

## Web demo
A browser-only showcase (landing page, reception app and dashboard on sample data, nothing sent anywhere) lives in `demo/`.

```bash
npm run dev:demo
```

`npm run build:demo` builds it into `demo-dist/`. On Vercel, import the repository: `vercel.json` already sets the install
command, build command and output folder. Logins: app *Admin* / PIN `1234`, dashboard `demo@security-register.app` / `demo1234`.

## Branded builds (organisation logo and colours)
The same code builds the generic product or a version branded for one organisation. Brands are defined in
`src/renderer/src/brand.ts` (name in AR/EN/FR, logo, colours) and the demo data of each brand in `demo/flavors.ts`.
Without a brand, nothing changes: the generic look and data are used.

| Brand | How to build |
|---|---|
| Generic | `npm run dev`, `npm run build:demo` … (as usual) |
| University of Ghardaia | `npm run dev:ghardaia`, `npm run dev:demo:ghardaia`, `npm run build:demo:ghardaia`, `npm run build:dashboard:ghardaia`, or set `VITE_BRAND=ghardaia` before any build |
| Faculty of Law and Political Science, Ghardaia (برنامج إدارة الأمن بالكلية) | `npm run dev:faculty`, `npm run dev:demo:faculty`, `npm run build:demo:faculty`, `npm run build:dashboard:faculty`, or `VITE_BRAND=ghardaia-law`. Arabic first, both logos, PIN-only login (see `PLAN_FACULTY.md`) |

A brand can also change the login: `loginMode: 'pin'` drops the list of names, and the PIN alone says who is logging in
(PINs are unique). Accounts are administrator, team leader (رئيس فرقة الأمن) or guard.

Each build only contains its own brand. The branded demo keeps its data apart from the generic one in the browser.
To add an organisation: put its logo in `src/renderer/src/assets/brands/`, add an entry in `brand.ts` and, for the demo, a flavour in `demo/flavors.ts`.

**Two demos on Vercel from one repository**: keep the first project (generic). Create a second Vercel project from the same
repository and add the environment variable `VITE_BRAND` = `ghardaia` in its settings. Both projects redeploy on every push.

## Project layout
```
src/main/       Electron main process: database, encryption, scanning (OCR/MRZ/barcodes), exports, IPC
src/preload/    the bridge exposing window.api to the UI
src/renderer/   React UI (pages, components, styles)
src/shared/     types, AR/EN/FR translations and the sync contract, shared by the app, the server and the dashboard
resources/tessdata/  offline OCR models (see NOTICE.md)
server/         organisation server (Node.js, runs TypeScript directly): sync API for posts + dashboard API
dashboard/      web dashboard (React), built into server/public
demo/           web demo for Vercel (mock data in the browser), built into demo-dist
```
