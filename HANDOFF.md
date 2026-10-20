# Handoff: برنامج إدارة الأمن بالكلية (faculty security program)

Status on 20 October 2026. Read this first, then `README.md` (features, how to run) and `PLAN_FACULTY.md` (what the client asked for, phases and status).

## What it is
The security office program of the **Faculty of Law and Political Science, University of Ghardaia**. It replaces the paper registers
of the office. Arabic first (right to left), French and English. Parts:

| Part | Folder | Runs on | Purpose |
|---|---|---|---|
| Reception app | `src/` | Windows PC at the security office (Electron) | Registers, visitors with ID scanning, shifts. Works offline. |
| Organisation server | `server/` | Any PC with Node.js 22.5+ | Optional. Links several posts, serves the dashboard. |
| Supervisor dashboard | `dashboard/` | Browser (served by the server) | Records search, invitations, shared watchlist, users. |
| Web demo | `demo/` | Vercel (static) | The real app screens with their API answered in the browser, on Arabic sample data. |

The earlier generic and University-of-Ghardaia versions were removed on 20 Oct 2026: there is one program, no brand switch, no build modes.

## Tech stack
- Electron 44, electron-vite, Vite 8, React 19, TypeScript 5.9, i18next.
- Local database: `node:sqlite` (`DatabaseSync`).
  - Sensitive fields are AES-256-GCM encrypted; the key is protected by Electron `safeStorage` (Windows DPAPI).
  - ID numbers are looked up through an HMAC hash, so the clear number is never stored.
  - PINs are scrypt hashes. `users.pin_lookup` is a keyed hash of the PIN so the PIN alone finds its owner (PINs are unique).
  - Every sensitive action goes to the `audit` table; old records are purged by the retention setting.
- Scanning (offline): `tesseract.js` (models in `resources/tessdata`: ara, fra, eng, `mrz`), the `mrz` package, `zxing-wasm` for QR / barcodes.
- Server: plain `node:http`; runs `.ts` directly (Node type stripping), hence `package.json` with `"type":"module"` in `server/` and `src/shared/`.

## Folder map
```
src/main/         Electron main process: db.ts, registers.ts, scan.ts, export.ts, ipc.ts (wires everything) ...
src/preload/      window.api (typed by Api in src/shared/types.ts)
src/renderer/src/ React UI: pages/, components/, styles.css, brand.ts (the faculty's name, logos, colours, settings), scanPipeline.ts
src/shared/       types, AR/EN/FR locales, register rules (registers.ts) and templates (registerTemplates.ts), sync contract, feature switches
resources/tessdata/  OCR models (licences in NOTICE.md)
server/, dashboard/  optional multi-site server and its web dashboard
demo/             web demo: mock window.api (reception-api.ts), mock /api/* (dashboard-api.ts), store.ts, sample data (flavors.ts)
vercel.json       Vercel build settings for the demo
```

## Commands
| Command | What it does |
|---|---|
| `npm install` | Install dependencies (set `ELECTRON_SKIP_BINARY_DOWNLOAD=1` if you only need the demo). |
| `npm run dev` | The app in development mode. |
| `npm run build` / `npm start` | Build / run the built app. |
| `npm run dist` | Windows installer (electron-builder). **Not tested yet.** |
| `npm run build:dashboard` then `npm run server` | Dashboard into `server/public`, then the server on port 8787 (prints a one-time setup code). |
| `npm run dev:demo` / `npm run build:demo` | Web demo in development / build into `demo-dist/`. |
| `npm run typecheck` | Type-check app, server, dashboard and demo. |

Environment: `SECREG_DATA_DIR` (data folder of the app), `SECREG_EXPORT_DIR` (exports without a dialog); server: `SECREG_PORT`, `SECREG_HOST`, `SECREG_DATA`, `SECREG_TLS_CERT`, `SECREG_TLS_KEY`.

## The faculty's program
- `src/renderer/src/brand.ts` holds everything specific to the faculty: the name in three languages, both logos, colours, the feature switches applied
  at first setup, the registers opened at the first administrator login, the tiles-only home screen, and which registers a team leader fills before a shift.
- **No setup screen.** `src/shared/faculty.ts` holds the settings and the first two accounts (administrator, team leader, with starting PINs); `src/main/seed.ts` creates them at the first start
  and opens the registers (also completed at later starts). A warning on the accounts page stays until the starting PINs are changed.
  If the program is killed within the first seconds of its very first start, Windows can lose the key protecting the data key: `initKey()` reports it, and `index.ts`
  starts over when nothing but the seeded data exists, or shows an error (tested).
- **Login is PIN only.** Roles: `admin`, `leader` (رئيس فرقة الأمن), `guard`. Administrators land on the Administration page and never start a guard shift.
  Databases from older versions are migrated in `migrate()` in `src/main/db.ts`.
- Plan, phases and decisions to confirm with the client: `PLAN_FACULTY.md`.

## Register engine (generic registers)
- A register is a definition (name in three languages, icon, fields, who may fill and close it, optional closing step) plus numbered entries.
  The faculty's paper books are templates of it (`src/shared/registerTemplates.ts`).
- **Code:** shared rules `src/shared/registers.ts`; storage `src/main/registers.ts` (tables `registers`, `register_fields`, `register_entries`,
  `register_corrections`); page `pages/RegistersPage.tsx`; inputs `components/RegisterFields.tsx`, `RegisterEntryForm.tsx`; demo: `registers` in `demo/reception-api.ts`.
- **Rules:**
  - An entry is never erased. A correction keeps the old and new values (encrypted), the reason and the author.
  - Confidential fields (always `person`) are stored encrypted and left out of search.
  - A `signature` field asks for a PIN and stores who confirmed, never the PIN.
  - Guards see the last 24 hours plus open entries; administrators see everything, and that viewing is logged.
- Team leaders fill the shift and custody registers at the start of every shift (`pages/ShiftStartPage.tsx`).

## Administration page (administrators only)
`pages/AdminPage.tsx`: accounts (`UserSettings` in `SettingsPage.tsx`), the **register builder** (`components/RegisterBuilder.tsx`: create or change a register, fields of
12 types, live preview, order, on/off; saved fields keep their type and encryption and are only hidden), and the **audit trail** (`components/AuditLog.tsx`,
API `audit.list`, action names in `audit.actions.*`). The demo keeps its own audit trail in `demo/store.ts`.

## ID card scanning
- `src/main/scan.ts` reads the MRZ (TD1 ID cards, TD3 passports, TD2) with check-digit validation, QR / barcodes, and has a text fallback (Arabic, French, English).
- `src/renderer/src/scanPipeline.ts` tries several enhanced versions of one frame (MRZ strip, adaptive threshold, sharpening, small rotations) until the document validates.
  `components/CameraPanel.tsx` runs it automatically on the live camera, and on the Scan button and imported photos.
- Tested on synthetic Algerian-style cards (TD1 and a passport, with glare, tilt and soft focus) through the real app. **Not tested on real Algerian cards.**

## Web demo (Vercel)
- `vercel.json` installs with `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm install`, builds with `npm run build:demo`, publishes `demo-dist/`. No server side.
- `/` redirects to `/app/` (the login page); `/dashboard/` is the dashboard demo (`demo@security-register.app` / `demo1234`). Sample PINs are shown in the bar at the bottom.
- `demo/app/main.ts` sets `window.api = demoApi` before importing the real renderer. Everything is stored in localStorage (`secreg-demo-faculty`); the bar has a reset button.
- To add an `Api` method, implement it in `demo/reception-api.ts` too, or the demo type-check fails.

## What was tested
- Server API script: 25/25. End to end on one PC: dashboard invitation, pass QR at the webcam, badge, exit, sync, watchlist.
- Registers, the team leader handover, the administration page and the audit trail: in the demo and on the real desktop app, through its debugging port, on a fresh data folder.
- Database migration of the users table on an old-style database (accounts and links kept).

## Not tested / known gaps
- Real Algerian ID cards, real badge printers, HTTPS, several PCs, the Windows installer, code signing, auto-update.
- Cards without a machine-readable zone (older ID cards) only have the text fallback.
- Phase E (statistics and printed reports), team assignment (waits for the client's answer), photos on incidents.
- No automated UI test suite.

## Security notes
- Photos and full ID numbers never leave the post PC: `src/shared/sync.ts` masks them on purpose.
- The encryption key is tied to the Windows account through DPAPI: back up by exports, not by copying the data folder.
- Dashboard API calls send `X-Requested-With: secreg` (CSRF check); cookies are HttpOnly and SameSite=Strict.
- `server-data/server.key` encrypts the watchlist ID numbers; losing it makes them unreadable. Keep `server-data/` out of git.
