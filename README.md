# برنامج إدارة الأمن بالكلية

Security management program of the **Faculty of Law and Political Science, University of Ghardaia**
(مكتب الأمن الداخلي للكلية). It replaces the paper registers of the security office: visitors, incidents, shift
and custody handovers, lost items, letters, events and more. Arabic first (right to left), French and English.
It runs on a Windows PC at the security office and works without a network.

- [PLAN_FACULTY.md](PLAN_FACULTY.md): what the faculty asked for, and the delivery phases.
- [HANDOFF.md](HANDOFF.md): architecture, status, what is and is not tested.

## What it does
- **PIN-only login.** Each person types their own PIN; it says who they are. Roles: administrator (المسير),
  team leader (رئيس فرقة الأمن) and guard (عون الأمن). PINs are unique.
- **Registers**, one tile each on the home screen, built from the faculty's paper books:
  shift, custody handover, incidents (with the deanship's visa), lost and found, letters, events and activities;
  and, switched off until needed: reports, maintenance, official visits, evacuation drills, fire alarms.
  - Entries are numbered, never erased: a mistake is corrected, and the correction stays visible.
  - A team leader fills the shift and custody registers at the start of every shift, confirmed with the outgoing
    leader's PIN (the signatures on paper).
  - Guards see the last 24 hours; administrators see the whole history, and that viewing is logged.
- **Visitors** with ID card scanning (see below), watchlist, people on site and exit.
- **Administration page** (administrators): accounts, a **register builder** (create or change any register and its
  fields, preview, order, on/off) and the **audit trail**.
- **Reports and statistics** by day, week, month and year (in progress, phase E).

## ID card scanning
All reading is offline, on the PC. A webcam reads passports and ID cards through their machine-readable zone
(MRZ), and QR codes. The camera reads **automatically** while a card is held in the frame; the Scan button and
importing a photo work too. Each frame is tried in several enhanced versions until the check digits of the document
validate. Cards without an MRZ fall back to a text read that lets the guard pick lines.

## Run it
Requires Node.js.

```bash
npm install
```

```bash
npm run dev
```

Other scripts: `npm run build` (production build), `npm start` (run the built app), `npm run typecheck`,
`npm run dist` (Windows installer; not tested yet).

There is no setup screen. On its first start the program creates the faculty's settings, its registers and two accounts:

| Account | Role | Starting PIN |
|---|---|---|
| مسؤول الأمن | administrator | `246810` |
| رئيس فرقة الأمن | team leader | `135790` |

The administrator logs in, changes both PINs and adds the guards in **Administration → Accounts** (a warning stays there
until the starting PINs are changed). The starting PINs and names are in `src/shared/faculty.ts`.
Set `SECREG_DATA_DIR` to use another data folder, for example for tests. Data folder by default: `%APPDATA%\FacultySecurity`.

## Web demo (Vercel)
A browser-only demo (the same screens, sample data in Arabic, nothing sent anywhere) lives in `demo/`.

```bash
npm run dev:demo
```

`npm run build:demo` builds it into `demo-dist/`. On Vercel, import the repository: `vercel.json` already sets
the install command, build command and output folder. Sample PINs are shown in the bar at the bottom:
administrator `1234`, team leaders `2580` and `1357`, guard `5678`. Dashboard demo: `demo@security-register.app` / `demo1234`.

## Several sites: server and dashboard (optional)
A small server (`server/`, Node.js, one SQLite file) can link several posts and serves a supervisor dashboard
(`dashboard/`) with invitations, a watchlist shared by all posts, and records search. Posts keep working
when the network is down and catch up later; photos and full ID numbers never leave the post PC.

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

Use **HTTPS** outside a closed network (certificate files above, or a reverse proxy such as Caddy, IIS or nginx).

## Privacy and security
- ID numbers, birth dates, phone numbers, photos and the confidential fields of registers are encrypted
  (AES-256-GCM) in the database. The key is protected by Windows DPAPI, so a copied database file is unreadable
  on another PC or Windows account.
- ID numbers are found through a keyed hash, so the clear number is never stored.
- Every login, entry, view, correction and export is written to the audit trail.
- All OCR runs locally. No data leaves the PC.

> Because the key is tied to the Windows account, back up by exporting (PDF/Excel). A raw copy of the
> data folder cannot be restored on another machine.

## Project layout
```
src/main/       Electron main process: database, encryption, registers, scanning (OCR/MRZ/barcodes), exports, IPC
src/preload/    the bridge exposing window.api to the UI
src/renderer/   React UI (pages, components, styles); brand.ts = the faculty's name, logos, colours, settings
src/shared/     types, AR/EN/FR texts, register rules and templates, shared by the app, the server and the dashboard
resources/tessdata/  offline OCR models (see NOTICE.md)
server/         organisation server (Node.js, runs TypeScript directly)
dashboard/      web dashboard (React), built into server/public
demo/           web demo for Vercel (the app with its API answered in the browser), built into demo-dist
```
