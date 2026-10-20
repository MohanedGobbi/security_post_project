# Handoff: Security Register

Status on 17 October 2026. Read this first, then `README.md` (features and how to run) and `PLAN.md` (research and roadmap).

## What it is
A digital logbook for security guard posts (companies, universities, any guard post) that replaces the paper register.
It is trilingual Arabic / English / French, with right-to-left layout for Arabic. It has three parts:

| Part | Folder | Runs on | Purpose |
|---|---|---|---|
| Reception app | `src/` | Windows PC at the desk (Electron) | Guards log visitors, vehicles, parcels, incidents, patrols, keys and shifts. Scans ID cards offline. |
| Organisation server | `server/` | Any PC / VPS with Node.js 22.5+ | Optional. Syncs several posts and serves the web dashboard. |
| Supervisor dashboard | `dashboard/` | Browser (served by the server) | Managers see every site live, search records, invite visitors, manage watchlist and users. |
| Web demo | `demo/` | Vercel (static) | Showcase: the real app UI and dashboard UI, running in the browser on sample data. |

Each reception PC works fully offline on its own. The server is optional.

## Tech stack
- Electron 44, electron-vite, Vite 8, React 19, TypeScript 5.9, i18next.
- Local database: `node:sqlite` (`DatabaseSync`).
  - Sensitive fields are encrypted with AES-256-GCM. The key is protected by Electron `safeStorage` (Windows DPAPI).
  - ID numbers are looked up with an HMAC hash, so the clear number is never stored.
  - PINs are hashed with scrypt.
  - Every sensitive action is written to the audit table. Old records are purged according to the retention setting.
- Scanning is fully offline:
  - `tesseract.js` reads text, with the models in `resources/tessdata` (ara, fra, eng and `mrz`).
  - The `mrz` package parses passport and ID card machine-readable zones.
  - `zxing-wasm` reads and writes barcodes and QR codes. QR prefixes: `SECREG-CP:` (checkpoint), `SECREG-P:` (pass), `SECREG-V:` (badge).
- Server: plain `node:http` with a small router. It runs `.ts` files directly through Node type stripping, so `server/` and `src/shared/` contain a `package.json` with `"type":"module"`.
- Shared code in `src/shared/`:
  - `types.ts` holds the `Api` interface between the UI and the main process.
  - `sync.ts` holds the post ↔ server sync contract.
  - `features.ts` holds the feature switches and the small / company / large profiles.
  - `locales/{en,fr,ar}.json` holds the translations.

## Folder map
```
src/main/         Electron main process: one file per domain (visits in db.ts, vehicles.ts, keys.ts, patrols.ts, sync.ts, badges.ts ...), ipc.ts wires them
src/preload/      exposes window.api (typed by Api in src/shared/types.ts)
src/renderer/src/ React UI: pages/, components/ (CameraPanel, QrScanner, BrandMark ...), styles.css, brand.ts (organisation branding)
src/shared/       types, sync contract, feature switches, AR/EN/FR locales
resources/tessdata/  OCR models (licences in NOTICE.md)
server/           index.ts (start), routes-device.ts (sync API for posts), routes-dashboard.ts, auth.ts, db.ts, crypto.ts
dashboard/src/    dashboard SPA; api.ts talks to /api/* (or to the demo mock when VITE_DEMO=1)
demo/             web demo: landing page, mock window.api (reception-api.ts), mock /api/* (dashboard-api.ts), shared localStorage store (store.ts), demo data per brand (flavors.ts)
vercel.json       Vercel build settings for the demo
```

## Commands
| Command | What it does |
|---|---|
| `npm install` | Install dependencies. Electron downloads its binary here; set `ELECTRON_SKIP_BINARY_DOWNLOAD=1` if you only need the demo. |
| `npm run dev` | Reception app in development mode. |
| `npm run build` / `npm start` | Build the app / run the built app. |
| `npm run dist` | Windows installer (electron-builder, NSIS). **Not tested yet.** |
| `npm run build:dashboard` then `npm run server` | Build the dashboard into `server/public`, then start the server on port 8787. The console prints a one-time setup code for the owner account. |
| `npm run dev:demo` / `npm run build:demo` | Web demo in development mode / build it into `demo-dist/`. |
| `npm run typecheck` | Type-check the app, server, dashboard and demo. |

Environment variables:
- App: `SECREG_DATA_DIR` sets the data folder; `SECREG_EXPORT_DIR` saves exports without a dialog.
- Server: `SECREG_PORT`, `SECREG_HOST`, `SECREG_DATA`, `SECREG_TLS_CERT` and `SECREG_TLS_KEY`. The README has the table.

## Web demo (Vercel)
- `vercel.json` installs with `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm install`, builds with `npm run build:demo` and publishes `demo-dist/`.
  - There is no server side: everything runs in the visitor's browser.
- Pages:
  - `/` is the trilingual landing page.
  - `/app/` is the reception app. Log in as **Admin**, PIN **1234**, or as Sonia (guard), PIN 5678.
  - `/dashboard/` is the dashboard. Log in with **demo@security-register.app** / **demo1234**.
- How it works:
  - `demo/app/main.ts` sets `window.api = demoApi` before importing the real renderer.
  - The dashboard's `api.ts` switches to `demo/dashboard-api.ts` when `import.meta.env.VITE_DEMO === '1'`.
  - Both read and write one localStorage store (`secreg-demo-v1`), so an invitation created in the dashboard appears in the app.
  - The orange demo bar has a reset button.
- Differences from the real product:
  - OCR is replaced by sample cards. One of them, Karim Ben Youssef, is on the watchlist to show the refusal.
  - The "Scan a sample card (demo)" button appears only when no webcam is available (flag `window.__SECREG_DEMO__`).
  - QR codes on imported images or from a webcam are read for real.
  - Exports open a printable page or download a CSV.
  - Sync is simulated.
- To add a new `Api` method, implement it in `demo/reception-api.ts` too, or the demo type-check fails.
  To add a new dashboard route, add it to `demo/dashboard-api.ts`.

## Branding (white-label builds)
- `src/renderer/src/brand.ts` defines the brands; each one has a name in three languages, a logo, colour overrides of the CSS tokens in `styles.css`, and a badge colour.
  - Today there are two: generic (default) and `ghardaia` (University of Ghardaia, green and red from its logo).
- The brand is chosen at build time: `VITE_BRAND=ghardaia` or `--mode ghardaia`.
  - The three vite configs (`electron.vite.config.ts`, `dashboard/vite.config.ts`, `demo/vite.config.ts`) turn it into the `__BRAND__` constant.
  - `__BRAND__` is compared with string literals so the bundler drops the other brands' code and data.
- `BrandMark` shows the logo instead of the shield. `applyBrand()` sets the colours and the favicon.
- Demo data per brand is in `demo/flavors.ts`: names, places, companies, licence plates, ID number format and card text.
  - Each brand has its own localStorage key.
- Not branded yet: printed badges and reports of the desktop app (main process).
  - Next step: a logo upload in Settings, so each organisation can brand its own install without a special build.
- On Vercel there are two projects from the same repository. The second one sets the environment variable `VITE_BRAND=ghardaia`.
- The third brand, `ghardaia-law`, is the Faculty of Law and Political Science (the first paying client in discussion).
  - Its plan and status live in `PLAN_FACULTY.md`.
  - Brands can also set `appName`, `logo2`, `loginMode` (`'pick'` | `'pin'`) and `defaultLang`.
  - PIN-only login uses `users.pin_lookup`, a keyed hash of the PIN, so PINs must be unique.
  - Roles are now `admin`, `leader` and `guard`. Existing desktop databases are migrated in `migrate()` in `src/main/db.ts`.

## Register engine (generic registers)
- **What it is:** a register is a definition (name in three languages, icon, fields, who may fill it, optional closing step) plus numbered entries. It is the base for the faculty's paper books (`PLAN_FACULTY.md` §4).
- **Code:**
  - shared rules: `src/shared/registers.ts`;
  - desktop storage: `src/main/registers.ts` (tables `registers`, `register_fields`, `register_entries`, `register_corrections`);
  - page: `RegistersPage.tsx`;
  - inputs: `components/RegisterFields.tsx`;
  - demo: `registers` in `demo/reception-api.ts`.
- **Rules:**
  - An entry is never erased. A correction keeps the old and new values, encrypted, with the reason and who made it.
  - Sensitive fields (always `person`) are stored encrypted and left out of search.
  - A `signature` field asks for a PIN and stores who confirmed, never the PIN.
  - Non-admins see the last 24 hours plus open entries; admins see the full history, and that viewing is logged.
- **Tested on the real desktop app** through the Chrome debugging port, with a throw-away data folder (`SECREG_DATA_DIR`).
- **Administration page** (`pages/AdminPage.tsx`, administrators only; where PIN-only builds send them):
  - accounts (`UserSettings` from `SettingsPage.tsx`);
  - the register builder (`components/RegisterBuilder.tsx`);
  - the audit trail (`components/AuditLog.tsx`, API `audit.list`, labels in `audit.actions.*`).
- **Audit trail in the demo:** the demo keeps its own copy in `demo/store.ts` (`audit`), filled by `log()` in `demo/reception-api.ts`.

## What was tested
- Server API script: 25/25 checks passed.
- End to end on one PC:
  1. Dashboard invitation, then the pass QR scanned at the webcam, then check-in.
  2. Badge preview, then the badge QR scanned at exit.
  3. Sync: the dashboard shows the arrival, the masked ID and the post online.
  4. An organisation watchlist entry blocks entry on the PC.
- Web demo, built and served locally:
  - Landing page on desktop and at phone width, with no horizontal scroll.
  - App login, shift handover and home screen with alerts.
  - Visitor IN: sample card fill and the watchlist refusal.
  - Dashboard login, overview, and an invitation with its QR pass that then appears in the app.

## Not tested / known gaps
- Real badge printers, HTTPS on the server, several physical PCs, the server running on another machine, and the Windows installer (`npm run dist`).
- Scanning real Tunisian, Algerian and Moroccan ID cards. MRZ passports work; the front side of Arabic cards relies on generic OCR and needs per-country templates.
- Code signing and auto-update of the desktop app.
- No automated UI test suite. Checks so far are type-checks, the server API script and manual runs.

## Suggested next steps
1. Build and test the Windows installer on a clean PC, then add code signing.
2. Test with real ID cards from the target countries and add front-side templates (name and number zones) for national IDs.
3. Notify the host when a visitor arrives (e-mail or WhatsApp link from the server).
4. Server deployment guide (Caddy reverse proxy with HTTPS, backups of `server.db` + `server.key`).
5. Automated tests: unit tests for `src/main/*` domains and Playwright runs against the web demo.

## Security notes for whoever continues
- Never send photos or full ID numbers to the server. The sync contract in `src/shared/sync.ts` masks them on purpose.
- The local encryption key is tied to the Windows account through DPAPI.
  - Backups are exports, not copies of the data folder.
- Dashboard API requests must send `X-Requested-With: secreg` (the CSRF check). Cookies are HttpOnly and SameSite=Strict.
- Server secrets: `server-data/server.key` encrypts watchlist ID numbers. Losing it makes them unreadable.
  - `server-data/` is gitignored; keep it that way.
