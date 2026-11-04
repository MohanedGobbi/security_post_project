# برنامج إدارة الأمن بالكلية

<img src="resources/brand/rowd-tech-wordmark.png" alt="ROWD Tech" height="48">

**Made by ROWD Tech.**

Security management program of the **Faculty of Law and Political Science, University of Ghardaia**
(مكتب الأمن الداخلي للكلية). It replaces the paper registers of the security office: visitors, incidents, shift
and custody handovers, lost items, letters, events and more. Arabic first (right to left), French and English.
It runs on a Windows PC at the security office and works without a network.

- [PLAN_FACULTY.md](PLAN_FACULTY.md): what the faculty asked for, and the delivery phases.
- [HANDOFF.md](HANDOFF.md): architecture, status, what is and is not tested.

## What it does
- **PIN-only login.** Each person types their own PIN; it says who they are. PINs are unique. Every account has a
  **permission level**: administrator (everything), team leader (رئيس فرقة الأمن), guard (عون الأمن), or a level the
  administrator makes by ticking what it may do (see visit history, see card pictures, look up or maintain students,
  print and export, correct others' entries, fill the shift handover registers). Each register says which levels fill and close it.
- **Registers**, one tile each on the home screen, built from the faculty's paper books:
  shift, custody handover, incidents (with the deanship's visa), lost and found, letters, events and activities;
  and, switched off until needed: reports, maintenance, official visits, evacuation drills, fire alarms.
  - Entries are numbered, never erased: a mistake is corrected, and the correction stays visible.
  - A team leader fills the shift and custody registers at the start of every shift, naming the outgoing
    leader (replacing the paper handover).
  - Guards see the last 24 hours; administrators see the whole history, and that viewing is logged.
- **Visitors** with ID card scanning (see below), watchlist, people on site and exit.
- **Student directory** (Students page): import the faculty's Excel / CSV list, search by name (Arabic or Latin, any spelling
  close enough) or card number, see who is inside. At the gate, a typed or scanned name or card number that matches a student
  is recognised and the form is filled from the directory, which also corrects what the card scan misread.
- **Print button** in the top bar (and Ctrl+P): one place to print or export the inside list, any register, the period report, the student list or the audit trail.
  Each is available as a **PDF** and as an **Excel** file (real date cells, filters, right-to-left sheets for Arabic) to work on in a spreadsheet.
  The student sheet of a level that maintains the directory can be corrected in Excel and imported back.
- **System tab** (administrators): a password-protected **backup file** (database and its key, restorable on any PC), **safety copies** the program makes
  itself every day and before anything that erases (restorable with the PIN), restore, erase all records, back to the first start, restart. If the data key
  cannot be opened (another Windows account or PC) the program starts in recovery mode and asks for a backup file.
- **Print / PDF everywhere**: every register (a period, or one entry), the visit record with its pictures, the audit trail, the
  student list, and the period report; A4 with the faculty's header and both logos.
- **Administration page** (administrators): accounts and permission levels, a **register builder** (create or change any
  register and its fields, colour, help text, half-width fields, preview, order, on/off) and the **audit trail**.
- **Reports and statistics** by day, week, month and year (in progress, phase E).

## ID card scanning
All reading is offline, on the PC. A webcam reads passports and ID cards through their machine-readable zone
(MRZ), and QR codes. The camera reads **automatically** while a card is held in the frame; the Scan button and
importing a photo work too. Each frame is tried in several enhanced versions until the check digits of the document
validate. Cards without an MRZ (the front of an ID card, older cards, licences, student cards) are read from their printed
text, Arabic and Latin, with the OCR built into Windows (offline; Tesseract if the Arabic OCR language is not installed): the form
is filled from the labels (Nom, Prénom, اللقب, الاسم, …) and the 18-digit national number, and the guard checks every field.
Nothing is sent over the internet.

**Every scanned card is photographed.** The picture (color, about 100-300 KB) is kept with the visitor's entry, encrypted
like the other personal data, up to 3 per entry (e.g. both sides of a card). The guard sees the pictures under the scanner and can
remove one before saving; the log shows a mark on entries that have pictures, and the record shows them. They are deleted
with their entry by the retention clean-up and never leave the PC.

## Run it
Requires Node.js.

```bash
npm install
```

```bash
npm run dev
```

Other scripts: `npm run build` (production build), `npm start` (run the built app), `npm run typecheck`,
`npm run dist` (Windows installer, see below).

There is no setup screen. On its first start the program creates the faculty's settings, its registers and two accounts:

| Account | Role | Starting PIN |
|---|---|---|
| مسؤول الأمن | administrator | `246810` |
| رئيس فرقة الأمن | team leader | `135790` |

The administrator logs in, changes both PINs and adds the guards in **Administration → Accounts** (a warning stays there
until the starting PINs are changed). The starting PINs and names are in `src/shared/faculty.ts`.
Set `SECREG_DATA_DIR` to use another data folder, for example for tests. Data folder by default: `%APPDATA%\FacultySecurity`.

## Install on a PC (no Node.js, no repository)
The ready-made installers are **not published in this repository**: `FacultySecurity-Setup-0.1.0.exe` for Windows (about 160 MB) and
`FacultySecurity-0.1.0-amd64.deb` for Debian / Ubuntu (about 150 MB).
**To get one, contact Mohaned Gobbi (ROWD Tech)**, who will send it. Nothing else has to be installed (no Node.js, no npm).

- **Windows:** run the `.exe`; it installs the program and adds a desktop and Start menu shortcut. It is not code-signed, so SmartScreen may show
  "Windows protected your PC": click **More info**, then **Run anyway**. Uninstalling keeps the data folder (`%APPDATA%FacultySecurity`).
- **Debian / Ubuntu:** `sudo apt install ./FacultySecurity-0.1.0-amd64.deb`, then start it from the applications menu (the command is `security-register`).
  Data folder: `~/.config/FacultySecurity`. The Windows OCR helper is not available there, so cards are read with Tesseract only (a little slower).
  The Debian package was built but not tested on a real machine.

To build them yourself (needs internet and a few minutes the first time):

```bash
npm run dist
```

builds the Windows installer into `release/` on a Windows PC. The Debian package cannot be built on Windows directly; run `npm run dist:linux` on Linux, or inside a Linux
container (for example Docker with the `node:24-bookworm` image), with the repository copied in and `npm ci` run there.

## Linux
The scripts are in `scripts/linux/`; run them as the person who uses the program, not as root (they ask for sudo).

| Script | What it does |
|---|---|
| `setup.sh` | Installs the libraries Electron needs, Node.js (asks first), the npm packages and the sandbox fix, builds, adds a menu entry (`--autostart`: open at login) |
| `start.sh` | Rebuilds and opens the program from the source folder; log in `~/.local/state/faculty-security/start.log` |
| `build-packages.sh` | Builds `release/FacultySecurity-0.1.0-amd64.deb` (`--rpm`, `--appimage`, `--all` for the others) |
| `kit/` | The install kit's scripts: `install.sh` (installs the `.deb` next to it), `check-pc.sh` (checks the PC, changes nothing), `uninstall.sh`, `00-START-HERE.txt` |

- **The data key.** On Linux it is protected by the desktop keyring (GNOME keyring or KDE Wallet). Started from a terminal, the program prints
  `[faculty-security] data key protection: …`: `gnome_libsecret` or `kwallet…` is good, `basic_text` means no keyring was found (install
  `gnome-keyring` before the first real start). The keyring is chosen at the first start; if it changes later the program opens in recovery
  mode and asks for a backup file. `start.sh` can fix the choice with `SECREG_PASSWORD_STORE` (`gnome-libsecret`, `kwallet5`, `kwallet6`, `basic`)
  in `~/.config/faculty-security.env`.
- **The sandbox.** Ubuntu 23.10 and newer block Electron's sandbox for programs run from a source folder; `setup.sh` makes `chrome-sandbox`
  setuid root (the standard fix) and has to run again after every `npm ci`. The `.deb` sets it up by itself, with an AppArmor profile on Ubuntu 24.04.
  `SECREG_NO_SANDBOX=1` runs without it (last resort). An AppImage cannot use the sandbox on Ubuntu 24.04: prefer the `.deb`.
- **Other `start.sh` settings** (in `~/.config/faculty-security.env`): `SECREG_SKIP_BUILD=1` (open the last build), `SECREG_FLAGS` (more Electron
  flags, for example `--disable-gpu` or `--ozone-platform=x11`), `SECREG_DATA_DIR`.

## Web demo (Vercel)
A browser-only demo (the same screens, sample data in Arabic, nothing sent anywhere) lives in `demo/`.

```bash
npm run dev:demo
```

`npm run build:demo` builds it into `demo-dist/`. On Vercel, import the repository: `vercel.json` already sets
the install command, build command and output folder. The site Vercel publishes is the 3D presentation landing page
([landing-guard/](landing-guard/README.md)); the first design is kept in [landing/](landing/README.md). The demo is embedded at `/demo/app/` (old `/app/` links redirect there). Sample PINs are shown in the bar at the bottom:
administrator `1234`, team leaders `2580` and `1357`, guard `5678`.

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
src/shared/     types, AR/EN/FR texts, register rules and templates, shared by the app and the demo
resources/tessdata/  offline OCR models (see NOTICE.md)
demo/           web demo for Vercel (the app with its API answered in the browser), built into demo-dist
```
