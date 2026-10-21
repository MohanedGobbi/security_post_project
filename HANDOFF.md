# Handoff: برنامج إدارة الأمن بالكلية (faculty security program)

Written 20 October 2026, last commit `f947bbb` on `main` (pushed to https://github.com/MohanedGobbi/security_post_project).
Read this first. Then `README.md` (features, how to run) and `PLAN_FACULTY.md` (what the client asked for, the phases, the questions for the client).

## 1. What this is
The security-office program of the **Faculty of Law and Political Science, University of Ghardaia** (مكتب الأمن الداخلي للكلية,
dean: Prof. Dr. Ferrouhat Said). It replaces the paper registers of the office with a Windows desktop program that works offline,
reads ID cards with the webcam, keeps numbered registers that cannot be erased, and logs everything. Arabic first (right to left),
French and English. Built by ROWD Tech (Mohaned Gobbi, CTO) as a client project. There is **one program**: the earlier generic
and University-of-Ghardaia versions were deleted on 20 Oct 2026.

| Part | Folder | Runs on | Purpose |
|---|---|---|---|
| Desktop app | `src/` | Windows PC at the security office (Electron) | Registers, visitors with ID scanning, shifts, administration. Offline. |
| Organisation server | `server/` | Any PC with Node.js 22.5+ | Optional: links several posts, serves the dashboard. Not part of the faculty's current need. |
| Supervisor dashboard | `dashboard/` | Browser, served by the server | Optional, same. |
| Web demo | `demo/` | Vercel (static) | The real screens with their API answered in the browser, Arabic sample data, for showing the client. |
| Test bench | `tools/scan-test/` | Windows, Python | Synthetic ID cards and a runner that measures the scanner on the real app. |

## 2. Run it, log in
```bash
npm install
npm run dev          # the desktop app in development mode (a window opens)
npm run typecheck    # all five TypeScript projects
npm run build        # production build into out/
npm run dev:demo     # the web demo
```
- **No setup screen.** The first start creates the faculty settings, 11 registers and two accounts (`src/shared/faculty.ts`, created by `src/main/seed.ts`):

  | Account | Role | Starting PIN |
  |---|---|---|
  | مسؤول الأمن | administrator | `246810` |
  | رئيس فرقة الأمن | team leader | `135790` |

  A warning on Administration → Accounts stays until the PINs are changed. Guards are added there.
- Demo PINs (shown in the demo's bottom bar): administrator `1234`, team leaders `2580` and `1357`, guard `5678`; dashboard demo `demo@security-register.app` / `demo1234`.
- Data folder of the dev app: `%APPDATA%\FacultySecurity` (old test data of the previous product name sits in `%APPDATA%\Security Register`). `SECREG_DATA_DIR` overrides it (all tests use scratch folders).
- Environment: `SECREG_EXPORT_DIR` (exports without a dialog); server: `SECREG_PORT`, `SECREG_HOST`, `SECREG_DATA`, `SECREG_TLS_CERT`, `SECREG_TLS_KEY`.

## 3. Pushing to GitHub from this machine
`github.com` on the developer's network often times out on the IP DNS returns. Pushing works through another GitHub address, for one command only:
```bash
git -c http.curloptResolve=github.com:443:140.82.112.3 push origin main
```
If it times out, try `140.82.113.3`, `20.201.28.151` or `20.205.243.166`. Git identity is already set (MohanedGobbi). Commits end with the `Co-Authored-By` line given by the session.

## 4. Tech stack
- Electron 44, electron-vite, Vite 8, React 19, TypeScript 5.9, i18next. Fonts: Cairo.
- Database `node:sqlite` (`DatabaseSync`), file `register.db` in the data folder.
  - Sensitive fields are AES-256-GCM encrypted. The data key (`data.key`) is protected by Electron `safeStorage` (Windows DPAPI).
  - ID numbers are looked up through an HMAC hash; PINs are scrypt hashes; `users.pin_lookup` is a keyed hash of the PIN so the PIN alone finds its owner (PINs are unique).
  - Every sensitive action goes to the `audit` table. Old records are purged by the retention setting (default 365 days); card pictures and other children go with their parent (`ON DELETE CASCADE`).
- Scanning (offline): `tesseract.js` (models in `resources/tessdata`: ara, fra, eng and `mrz`), the `mrz` package, `zxing-wasm` for QR codes.
- Server: plain `node:http`, runs `.ts` directly (Node type stripping), hence `package.json` with `"type":"module"` in `server/` and `src/shared/`.

## 5. Folder map
```
src/main/         Electron main process: db.ts, registers.ts, seed.ts, scan.ts, export.ts, crypto.ts, ipc.ts (wires every handler), index.ts (startup)
src/preload/      window.api (typed by Api in src/shared/types.ts)
src/renderer/src/ React UI: pages/, components/, styles.css, brand.ts (names, logos, colours of the faculty), scanPipeline.ts
src/shared/       types.ts (Api), faculty.ts (first-start settings and accounts), registers.ts (rules), registerTemplates.ts, features.ts, locales/{ar,fr,en}.json
resources/tessdata/  OCR models (licences in NOTICE.md)
server/, dashboard/  optional multi-site server and its web dashboard
demo/             web demo: reception-api.ts (mock of window.api), dashboard-api.ts, store.ts, flavors.ts (sample data)
tools/scan-test/  scanner test bench (README inside)
vercel.json       Vercel build settings for the demo
```

## 6. What exists

### Identity
PIN-only login (`pages/LoginPage.tsx`): both logos, the program name, a PIN pad, nothing else. Roles `admin`, `leader` (رئيس فرقة الأمن), `guard`.
Administrators land on the Administration page and never start a guard shift. Failed attempts are rate-limited and audited.

### Registers (the core)
- A register is a definition (name in three languages, icon, fields, who may fill and close it, optional closing step) plus numbered entries.
- Code: rules `src/shared/registers.ts`; storage `src/main/registers.ts` (tables `registers`, `register_fields`, `register_entries`, `register_corrections`);
  page `pages/RegistersPage.tsx`; inputs `components/RegisterFields.tsx`, `RegisterEntryForm.tsx`; the demo has its own copy of the storage in `demo/reception-api.ts`.
- 12 field types: short and long text, number, date, time, date-time, yes/no, yes/no with "specify", list, person, account, PIN confirmation.
- Rules taken from the faculty's paper books: an entry is **never erased** (a correction keeps old and new value, encrypted, with reason and author);
  confidential fields (always `person`) are encrypted and not searchable; a `signature` field stores who confirmed with their PIN, never the PIN;
  guards see the last 24 hours plus open entries, administrators see everything and that viewing is logged.
- **Templates** (`src/shared/registerTemplates.ts`), from their Word files: shift, custody handover, incidents (closing step = the deanship's visa), lost and found,
  letters (replaces parcels), events; switched off until needed: reports, maintenance, official visits, evacuation drills, fire alarms.
  `seed.ts` opens the missing ones at every start. A team leader fills the shift and custody registers before starting a shift (`pages/ShiftStartPage.tsx`).
- Home screen: one tile per allowed register (name and light icon only) next to visitor in / out (`brand.homeTilesOnly`).

### Administration (administrators)
`pages/AdminPage.tsx`: accounts (create, change PIN, deactivate), the **register builder** (`components/RegisterBuilder.tsx`: new register or change one, names in three languages,
icon, who records and closes, closing step, fields, live preview, order, on/off; saved fields keep their type and encryption and are only hidden),
and the **audit trail** (`components/AuditLog.tsx`, API `audit.list`, readable action names in `audit.actions.*`).

### Permission levels (21 Oct)
`levels` table (key, names in 3 languages, permissions, built-in flag). `Role` is now a level key (`users.role` has no CHECK any more: an older table is rebuilt at start, ids and PIN lookups kept).
Built-ins: `guard`, `leader`, `admin` (renamed or re-ticked freely, never deleted; `admin` always has everything and alone manages accounts, levels, registers, settings, audit).
Permissions (`src/shared/permissions.ts`): visitors, history, cardPictures, students, studentsEdit, exports, correctAny, shiftHandover. Enforced in the main process by `PERMISSION_OF` in `ipc.ts` (plus
`visits:get` strips photo and card pictures without cardPictures, `students:list` hides phone / national number / birth date without studentsEdit, `registers.correctEntry` needs correctAny or authorship) and mirrored in the UI by `pageAllowed` (`App.tsx`).
Registers list level keys in `fillRoles` / `closeRoles`. UI: `components/LevelsEditor.tsx` (Administration → Accounts), `levels.ts` (hook and names). The default guard level keeps today's behaviour (history and card pictures on): untick them in Administration if the faculty wants the dean's-permission rule (open question 5 below).

### Student directory (21 Oct)
`students` table; names / level / department as text, card number, national number, birth date, phone encrypted, numbers found by the keyed hash (the same hash as visitors' ID numbers, so a visitor registered with a student's card number IS that student: presence, last seen, visit count come from that join).
`src/main/students.ts` (search, `suggestStudents` = same number first, then alike names by `src/shared/names.ts`: accents, Arabic letter variants, word order and spaces ignored, edit distance; import of xlsx/csv by recognised column titles in Arabic, French, English; template file), `pages/StudentsPage.tsx`, and in `VisitorInPage.tsx`: a matching card or national number is applied once by itself, alike names are suggested as buttons.
Import test file for the tests: `SECREG_IMPORT_FILE`. Students are not purged by the retention setting.

### Printing (21 Oct)
`src/main/printouts.ts` + `export.ts` (`reportHtml` now carries both logos from `resources/brand/`): register (period or recent), one entry, visit record, audit trail, student list, and the period export now also holds every register. Buttons: `components/PrintButton.tsx` on the register list and entry, visit record, audit trail, student list. What a user may print is what they may see (same functions give the rows).
A bug fixed on the way: a register without a closing step showed guards its whole history ("open entries" are only those of a register that has a closing step).

### System: backups, restore, reset, deleting registers (21 Oct)
`src/main/backup.ts`, panel `components/SystemPanel.tsx` (Administration → System), dialogs `components/SecureDialog.tsx` (PIN again, password, typed word).
- **Safety copies**: folder `userData/backups/<kind>-<time>/` with `register.db` (made with `VACUUM INTO`, consistent) and `data.key`; kinds auto (at start, when the last is older than 20 h; 14 kept), before-restore / -erase / -reset / -delete (10 kept). Restorable with the PIN, same Windows account only (the key file is DPAPI-bound).
- **Backup file** `.secbak`: `SECBAK01` + scrypt(password) + AES-256-GCM over [header incl. the raw data key | database]. Restoring writes the database, re-protects the key for this PC, then `app.relaunch()`. The program cannot restore a file whose password is wrong: checked before anything is touched.
- **Erase records** keeps settings, accounts, levels, register definitions, watchlist, checkpoints and the audit trail (`RECORD_TABLES`); **factory reset** deletes database and key. Both, and every restore, make a safety copy first. All need the administrator's PIN again (`checkAdminPin`, shares the login lock-out).
- **Recovery mode**: `index.ts` no longer quits when the key is lost on a non-fresh install; `auth.status` says `recovery` and `RecoveryPage` offers a backup file (`system:recover`, public only in this mode).
- **Deleting a register** (`registers:delete`): empty ones need only a confirmation, ones with entries need the PIN and a safety copy first; ready-made registers that were deleted are remembered (`settings.deletedTemplates`) so the next start does not open them again.
- Tests use `SECREG_EXPORT_DIR` (where a backup is saved) and `SECREG_BACKUP_FILE` (the file picked for a restore).

### Register appearance (21 Oct)
Per register an accent colour (`REGISTER_COLORS`), per field help text (`hint`) and half width (`half`); builder UI and form updated. The shift and custody registers lost the registers-condition, deanship-visa and PIN-confirmation questions and got a yes/no plus a separate box for the absent or late names (`updateTemplateRegisters` hides the old fields on existing installs).

### Visitors, ID scanning, card pictures
- `src/main/scan.ts` reads the MRZ (TD1 ID cards, TD3 passports, TD2) with check-digit validation, QR codes, and has a text fallback (Arabic, French, English) that lets the guard pick lines.
- `src/renderer/src/scanPipeline.ts` tries up to 9 enhanced versions of a frame (MRZ strip, adaptive threshold, sharpening, small rotations) until the check digits validate.
  `components/CameraPanel.tsx` runs it **automatically on the live camera** (every 0.4 s while text is in the guide frame), and on the Scan button and imported photos.
- **Every scan is photographed**: a color JPEG (~100-300 KB) is kept with the visit, encrypted, up to 3 per entry (`MAX_CARD_PICTURES`), table `visit_cards`.
  The guard sees them under the scanner and can remove one; the log marks entries with pictures; the record shows them (`components/CardPictures.tsx`). They never leave the PC.
- The visitor form has a watchlist check (refusal needs an administrator's PIN), visitor photo and badge number switched off for the faculty (`FACULTY.features`).

### Safety net found by testing
If the program is killed within the first seconds of its very first start, Windows can lose the key that protects the data key. `initKey()` in `crypto.ts` reports `'lost'`;
`index.ts` starts over when only the seeded data exists, otherwise shows an Arabic and English error. Tested (kill after 4 s, three times).

## 7. How it was tested (and what that proves)
All of it on the **real desktop app** driven through Chrome's debugging port (`--remote-debugging-port`, Playwright for Python) on scratch data folders, plus the web demo in the browser pane:
registers and corrections, the team leader handover, the register builder, the audit trail, first start and restart, lost-key recovery, card pictures (also: unreadable in the database files, removed with the visit).
Scanner: `tools/scan-test` (synthetic cards). Server API script: 25/25 (earlier phases). **No automated test suite exists**; these were manual scripted runs (the scripts are not in the repo except the scanner bench).

## 8. Scanner status (read before touching it)
- Synthetic Algerian-style cards through the real app: readable-font set **17/18** (was 13/18 with a single shot), passport read, harsh OCR-A set 4/18 (not representative: the model is OCR-B).
- **Not tested on real Algerian cards.** Real cards are OCR-B printed but worn, laminated and shiny. Get real cards (CNIBE biometric ID back, biometric passport) and run them before promising anything to the client.
- Known weaknesses, in order of importance:
  1. A wrong **letter in the name** (`Benvoucef` for `Benyoucef`) is possible even when all check digits pass: check digits do not cover the name. Plan: confirm with a second, different read and vote per character.
  2. **Nationality** can be misread (`0ZA` for `DZA`): snap to a known country code (the `mrz` package has the list in `lib/generated/states.js`).
  3. The automatic camera loop was never run against a **live camera**. Plan: Chromium flags `--use-fake-device-for-media-stream --use-file-for-fake-video-capture=<file.mjpeg>` with a video made from the test cards.
  4. Reading time varies a lot with machine load (2 s to 20 s per card in the last runs). Profile on the target PC.
  5. Cards **without a machine-readable zone** (older Algerian ID cards, driving licences, student cards, the front of the biometric card): handled by the printed-text reader below, with weaker accuracy, always checked by the guard.
- **Decision (20 Oct): no cloud AI.** A Gemini reader (several keys and models as fallback) was built and then removed on the user's request: sending ID card pictures to Google contradicts "no data leaves the PC", free-tier content may be used by Google to improve its products, and it needs internet. It was never committed, so it is gone; if the faculty ever agrees in writing it can be rebuilt (the design: admin consent switch, encrypted keys, a button per picture, audit lines, fallback across keys and models).
  - **Offline printed-text reader (built 20 Oct, replaces the "local model" idea):** `src/main/winocr.ts` + `resources/ocr/winocr.ps1` keep a PowerShell helper alive that calls the OCR built into Windows (pictures go over stdin, nothing on disk; ~0.2 s per picture); `src/main/front.ts` (pure) turns its lines into fields by labels (Nom, Prénom, Date de naissance, اللقب, الاسم, …) and shapes (18-digit national number, dates); `scan.ts: readFront` ties them, Tesseract is the fallback when no Windows OCR language is installed (`windowsOcr` returns null). `CameraPanel` calls `readFront` first on a manual scan and on the live camera (first look and every 3rd failed look); a result with a name and a national number or birth date (`complete`) skips the slow MRZ pipeline (12 s → 0.7 s per front); otherwise the MRZ pipeline runs and the text fields fill its gaps. Result `source: 'ocr'` is never `valid` and always shows "check every field".
    Measured on 48 synthetic fronts (`make_fronts.py`, `run_fronts.py`): national number 48/48, birth date 47/48, Latin name 44/48, **Arabic name only 18/48** (Windows OCR drops or misreads Arabic words, worst on Naskh-style fonts; EasyOCR got 81-83% but needs 9.5 s and PyTorch). MRZ bench unchanged (21/37). `tools/scan-test/score_ocr.py` compares engines, `extract_bench.ts` tests `front.ts` on stored OCR output, `front_only.py` calls `readFront` alone.
    Windows OCR also reads MRZ lines and validates check digits (8/18 on the Consolas set at 0.25 s) but drops the `<` between name words (`Hadjsaid`), so it is deliberately **not** used as the MRZ reader; it is the natural second reader for the planned name vote (weakness 1 below). **Never tested on a real card**: run `py tools/scan-test/run_fronts.py <folder of photos> <scratch dir> <out.json>` on photos without an `expect.json` to print what the form receives.
    The Arabic OCR recognizer must be installed in Windows (Settings → Time & language → Language → Arabic → Optional features → OCR); without it only Latin text is read well.
  - Not done: a local vision model (heavy: 4-8 GB of RAM or graphics memory, 20-60 s per card on a CPU), EasyOCR (best Arabic names, 9.5 s, PyTorch), a second reader to vote per character on MRZ names (Windows OCR is the candidate).

## 9. Not done / next steps (suggested order)
1. Finish the scanner items 1-3 above (name vote with a second reader, country code snap, live-camera test) and **test with real cards** (printed-text reader included: section 8).
2. **Phase E: statistics and printed reports** by day, week, month and year, per register, with the official header of their paper books (`PLAN_FACULTY.md` §7), plus "print the register" in the layout of their book. Not started.
3. **Questions for the client** (13 in `PLAN_FACULTY.md` §9, plus these decisions made without them): the incidents register is an engine register whose closing step is the deanship visa and has no photos yet;
   the visitors register stays the visitor module; the letters addressee list is a guess. Team assignment (which guards belong to which team) waits for the answer to Q8.
4. Pictures for registers (e.g. a lost item), and photos on incidents.
5. Guards can currently open **any** visit record in the log (`F8`), pictures included. The faculty's rule ("no viewing without the dean's written permission") suggests limiting guards to the last 24 hours like registers. Ask the client.
6. Windows installer (`npm run dist`, electron-builder, never run), code signing, a backup/export routine (a copy of the data folder does not restore on another PC/Windows account).
7. Refresh the presentation deck (below) and the demo with the faculty version; add automated tests (unit tests for `src/main`, Playwright against the demo).

## 10. Web demo and presentation
- Demo: `vercel.json` installs with `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm install`, builds `npm run build:demo`, publishes `demo-dist/`. `/` redirects to `/app/`. **Vercel has not been set up for the faculty yet**: import the GitHub repository in Vercel, nothing else (the old two-project instructions are obsolete).
  Data is in localStorage (`secreg-demo-faculty`), the bottom bar has a reset button. After a rebuild the browser may keep the old script: open `/app/?fresh=1`.
- To add an `Api` method, implement it in `demo/reception-api.ts` too, or the demo type-check fails.
- Presentation made for the university (24 slides in the ROWD brand, Claude artifact): https://claude.ai/artifact/9vWEMMpdcszDaGPeRmxWom . It was made **before** the faculty pivot: screenshots show the old University-of-Ghardaia version, the generic feature list and two placeholders (`[demo link]`, `[__ weeks]`). It needs a rebuild around the faculty version.
- Client material (not in the repo): Word files of the paper registers in `D:\Temppp\` (`سجل … .docx`, `سجلات مركز الأمن بالكلية.docx`), the logos (cropped copies are in `src/renderer/src/assets/brands/`). ROWD brand files: `D:\rowd tech stuff\`.

## 11. Gotchas that cost time
- Windows + Git Bash: long `node -e` one-liners with quotes or backticks break. Write a script file and run it.
- The three TypeScript projects that share `src/renderer` code (`tsconfig.web.json`, `dashboard/`, `demo/`) resolve different aliases: code shared with the dashboard must import `@desktop/...`, not `@renderer/...`.
- `electron-vite build` writes `out/` (used by the test scripts); `npm run dev` uses its own dev server and restarts the main process on change.
- Killing the app hard (`taskkill /F`) in its first seconds is exactly the lost-key case above; the tests use it on purpose.
- Typing in the browser pane's tools does not send real key events: set input values with the native setter and an `input` event (see how the tests do it).
- `.gitattributes` forces LF; Windows may warn about CRLF, ignore.

## 12. Security notes
- Photos, card pictures and full ID numbers never leave the post PC: `src/shared/sync.ts` masks them on purpose (only matters if the optional server is used).
- The encryption key is tied to the Windows account through DPAPI: back up by exports, not by copying the data folder.
- Starting PINs are public in this repository (`src/shared/faculty.ts`): the administrator must change them at the first login (the warning insists).
- Dashboard API calls send `X-Requested-With: secreg` (CSRF check); cookies are HttpOnly and SameSite=Strict. `server-data/server.key` encrypts the watchlist ID numbers: keep `server-data/` out of git.
