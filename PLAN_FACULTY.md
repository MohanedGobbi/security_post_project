# Plan: Faculty of Law and Political Science, University of Ghardaïa

**Product name for this client:** برنامج إدارة الأمن بالكلية (Faculty Security Management Program)
**Client:** كلية الحقوق والعلوم السياسية, جامعة غرداية, مكتب الأمن الداخلي للكلية (Dean: Prof. Dr. Ferrouhat Said)
**Sources:**
- The client's feedback messages (20 Oct 2026).
- Eight Word templates of their paper registers (`D:\Temppp\سجل … .docx`).
- The two logos.

**Status:** phase A is built and tested in the web demo (20 Oct 2026); phases B–G are not started.
- **Brand `ghardaia-law`:** both logos, the Arabic program name, Arabic by default.
- **PIN-only login:** both logos on the page; administrators go straight to administration (the Settings page until phase D).
- **Accounts:** team leader role (`leader`); unique PINs; administrators create admin, team leader and guard accounts.
- **Database:** existing desktop databases are migrated automatically (the users table is rebuilt to allow the new role; the rebuild was tested on a copy).
- **Faculty demo:** `npm run build:demo:faculty`; `/` opens the login page. Sample PINs: administrator 1234, team leader 2580, guard 5678.

---

## 1. What the client asked for (from the messages)

| # | Request | Where it goes in the plan |
|---|---|---|
| 1 | Put their paper registers in the app. One of them (the shift register) is filled every day by the team leader when his shift starts | §3 registers, §4 register engine |
| 2 | Home screen: each register as a tile (name + light icon), no details; tapping it records an entry | §5 home screen |
| 3 | Landing page replaced by a simple login page with the faculty logo. After login: guard → guards' page, manager/admin → admin page directly. No "who are you" step, no username | §2 login |
| 4 | Faculty logo and name come from the Word files | §2 branding |
| 5 | Program name: برنامج إدارة الأمن بالكلية | §2 branding |
| 6 | Parcels: only one kind, letters addressed to a body (mostly the deanship / the dean) | §3.7 letters register |
| 7 | Lost items: their own register, not an option inside incidents | §3.6 lost-and-found register |
| 8 | Admin creates admin accounts and team leader accounts, and can add any register, which then shows up directly for guards | §4 register builder, §6 admin page |
| 9 | Statistics per register, by day / week / month / year, as a printed report | §7 reports |
| 10 | Login page in Arabic, with **both** the faculty logo and the university logo | §2 login |
| 11 | Guards and team leaders need no username: one personal PIN each identifies the person. The admin sees who did what | §2 login (one point to confirm, §9 Q1) |

---

## 2. Identity, login and roles

### Branding: new brand `ghardaia-law`
- **Built on the existing brand system** (`src/renderer/src/brand.ts`). The generic product and the University of Ghardaïa brand stay untouched.
- **Name:** برنامج إدارة الأمن بالكلية, with the subtitle كلية الحقوق والعلوم السياسية · جامعة غرداية.
- **Two logos:**
  - **University:** use the PNG embedded in the Word files (288 × 236, transparent), which is better than the one we have now.
  - **Faculty:** use the large photo sent in chat (1290 × 1418). Crop it and remove its white background to get a transparent PNG.
- **Colours:** the faculty logo's green and red. They are close to the current Ghardaïa palette, so only small adjustments are needed.
- **Language:** Arabic by default, right to left. French and English stay available in the language switch (to confirm, Q12).
- **Page header (reports and printed pages):** the same as the paper registers, in this order:
  - الجمهورية الجزائرية الديمقراطية الشعبية
  - وزارة التعليم العالي والبحث العلمي
  - جامعة غرداية
  - كلية الحقوق والعلوم السياسية
  - مكتب الأمن الداخلي للكلية
  - Both logos on the sides.

### Login page (replaces the landing page for this brand)
- **One screen:**
  - both logos;
  - the program name in Arabic;
  - a PIN pad.
- **No user tiles and no username.** The person types their PIN and the app knows who they are.
- **Routing after login:**
  - guard → guards' home (register tiles);
  - team leader → guards' home plus the handover registers (see §3.1–3.2);
  - admin → admin page.
- **PINs:**
  - Each PIN must be unique: the app refuses a PIN that another account already uses.
  - Guards and team leaders: 4 to 6 digits.
  - Admins: a longer secret (see Q2).
  - The current lock-out after wrong attempts and the audit log stay.
- **Web demo:** for this brand, `/` opens the login page directly. The demo bar shows the sample PINs.

### Roles (today: admin, guard)
| Role | Arabic | Can do |
|---|---|---|
| Admin | المسير / المدير | Accounts, registers (create / edit / switch off), all reports, settings, audit log |
| Team leader | رئيس فرقة الأمن | Everything a guard does, plus the shift and custody handover registers, the team's attendance, lost-item returns, sending incidents for the deanship's visa |
| Guard | عون الأمن | Fills the registers the admin allows for guards |
| *(optional)* Deanship | العمادة | Views and stamps (visa) the incidents register; read-only reports. Only if they will use the app (Q3) |

**Code impact:**
- `Role` in `src/shared/types.ts` gains `leader`, plus `dean` if Q3 says yes.
- The `users` table gets the new role and a unique PIN index.
- The settings page gains account creation per role.

---

## 3. The faculty's registers (from their Word templates)

Every paper template carries the same rules, and the app keeps them:
- **No crossing out, tearing or correction fluid.** In the app, a saved entry cannot be edited or deleted; a mistake is fixed with a dated *correction* linked to the entry, signed by the person's PIN.
- **The register stays in the security office.** No copy or viewing without the dean's written permission: only admins can browse history and print or export. Every view and export is logged.
- **The outgoing team leader hands the registers to the incoming one,** who reports any problem to the deanship within one hour. This is built into the shift register (§3.1).
- **"Opened by the dean on date …":** each register keeps an opening date and the name of who opened it, printed on the report cover.

### 3.1 سجل المناوبة (shift register): filled by the team leader at each shift change
- **When:** at the start of each shift. This is the daily register from message 1.
- **The entry records:**
  - date and time;
  - incoming team leader (or deputy), taken from the PIN;
  - outgoing team leader.
- **Checklist:**
  - State of the registers: good / damaged (specify).
  - Incidents register stamped by the deanship: yes / no.
  - All members of the incoming team present: yes / no, with the names of absent or late members.
- **Confirmation:** both team leaders confirm with their PIN, which replaces the two signatures.
- **App side:**
  - Reuses and extends today's shift and handover screen.
  - Team composition comes from the accounts, so attendance is ticked from the team list instead of typed (needs Q8).

### 3.2 سجل تسليم واستلام العهدة (custody handover register): same moment, same two team leaders
- **Keys in the security office:** all present / missing (specify which).
- **Cameras:** working / broken or unclear picture (specify).
- **Equipment in the security office:** good / other (specify).
- **Rooms, lecture halls and offices:** good / other (specify).
- **Confirmation:** both team leaders' PINs.
- **Their overview file adds** radios and inspection devices to the items list. These become checklist lines the admin can edit.
- **Proposal:** sections 3.1 and 3.2 form **one "start of shift" flow** with two pages, saved as two entries in two registers.

### 3.3 سجل الزوار (visitors): the existing visitor module, adjusted to their columns
- **Columns:**
  - no.;
  - full name;
  - ID number;
  - ID type;
  - person or office visited;
  - date;
  - time in;
  - time out.
- **The rules also require, when applicable:** the visitor's organisation, and the reason for the visit.
- **Kept as is:** ID card scanning, watchlist check, "people on site" and exit. These already exist.
- **Switched off for this brand:** fields not on their sheet (phone, badge number, photo…). They can be switched back on.

### 3.4 سجل الحوادث بالكلية ومحيطها (incidents): existing module, plus the deanship visa
- **Columns:**
  - date;
  - precise short description;
  - people involved or responsible, when applicable;
  - action taken;
  - reported to faculty services: date, time, service notified;
  - deanship's "seen" stamp: date, time, stamp;
  - agent(s) who witnessed the incident.
- **Rule:** at the end of each shift, the team leader presents the register to the deanship for review and visa.
- **App side:**
  - An open incident shows **"awaiting deanship visa"** until it is stamped.
  - A dean / deanship account stamps it (Q3). Otherwise the team leader records "stamped on paper on …".
  - The *lost & found* type is removed from incidents; see §3.6.

### 3.5 سجل الفعاليات والنشاطات (events and activities): new register
- **Fields:**
  - date and time;
  - the activity;
  - organising body;
  - number of organisers;
  - time from / to;
  - target audience;
  - incidents recorded, when applicable.
- **The overview file adds:** expected attendance, special security measures.

### 3.6 سجل المفقودات المسلمة لمكتب الأمن (lost and found): new register with its own tile
- **On receipt:**
  - description of the item;
  - where it was found;
  - date found;
  - name of the finder, who confirms.
- **Then:** action taken.
- **Return to the owner:**
  - receiver's name;
  - ID number with type, issue date and issuing authority;
  - address;
  - signature.
  - The return can be done only by the **team leader in person** (their rule). The app restricts it to the leader role.
- **States:** held / returned, with a list of items still held.

### 3.7 سجل المراسلات / البريد (letters): replaces "parcels" for this brand
- **The only kind of item:** letters addressed to a faculty body, mostly the deanship or the dean.
- **Proposed fields (to confirm, Q5):**
  - date and time received;
  - sender;
  - addressed to (a list the admin edits: العمادة, العميد, نيابة العمادة…, other);
  - number of letters;
  - handed to (name), date and time handed over.
- **State:** waiting / delivered.

### 3.8 Extra registers suggested in "سجلات مركز الأمن بالكلية"
These are delivered as ready **templates**, switched off until the admin turns them on (Q6):

| Register | Fields |
|---|---|
| سجل البلاغات (reports received) | report type, reporting party, time received, action taken |
| سجل الصيانة والملاحظات (maintenance) | gate faults, camera faults, inspection-device faults, date reported, follow-up |
| سجل الشخصيات الرسمية والزيارات البروتوكولية (official visits) | name, official title, visit date, special security arrangements |
| سجل خطط الإخلاء والطوارئ (evacuation drills) | drill date, participants, evaluation notes |
| سجل إنذارات الحريق والطوارئ (fire and emergency alarms) | alarm time, cause, action taken |

Note: the overview file starts at "سجل البلاغات". Its sections 1 and 2 seem to be missing (Q13).

### Modules the client did not mention (default for this brand)
- **Keep on:** ID scanning and the watchlist. They support the visitors register.
- **Off:**
  - vehicles;
  - patrol rounds with QR;
  - key loans (the custody register covers the keys check);
  - expected visitors;
  - badges;
  - multi-site sync.
- **Unchanged:** all of them stay in the product and can be switched back on (Q7).

---

## 4. Register engine and register builder (the core change)

The admin must be able to **add any register that appears directly for guards** (message 8). Today each register is hand-coded (visits, deliveries, incidents…) and admins can only add extra fields (`custom_fields`). The plan is a generic engine. The faculty's registers in §3 become pre-filled templates of it, so this work also benefits every future client.

**Data (local SQLite, same encryption and audit as today):**
- `registers`:
  - id, key, name (ar/fr/en), icon, colour, order;
  - opened_at and opened_by (the "opened by the dean" line);
  - active;
  - who can fill it (guard / leader / admin);
  - whether entries have a *closing step* (returned, delivered, stamped, exited), and its fields.
- `register_fields`:
  - register, key, label (ar/fr/en), order;
  - type: short text, long text, number, date, time, date-time, yes/no, yes/no + "specify", choice list, person (name + ID number + ID type), account (picked from users), checklist;
  - required;
  - sensitive (encrypt);
  - which step it belongs to (opening or closing).
- `register_entries`:
  - register, number (running per register, like the paper "الرقم");
  - data (JSON; sensitive values encrypted);
  - created_by, created_at;
  - closed_by, closed_at.
- `register_corrections`: entry, corrected field, old and new value, reason, by, at. Entries themselves are never updated (the "no erasing" rule).

**Screens:**
- **Entry form:** generated from the fields. RTL, large inputs, works with the keyboard.
- **Register page:**
  - today's entries;
  - open items (not yet closed);
  - search.
  - Guards see only their shift; admins see everything (the confidentiality rule).
- **Register builder (admin):**
  - name, icon (from a small set of light line icons);
  - fields: add, reorder, choose type and required;
  - who can fill it, closing step;
  - preview, activate.
  - A field cannot be removed once entries exist: it can only be hidden, so history stays readable.

**Migration:**
- **Specialised modules stay:** visitors (scanning, on-site list, exit) and incidents (photos) keep their own code, and appear as tiles like the others.
- **On the engine:**
  - shifts, custody, lost and found, events, letters;
  - the extra templates in §3.8.
- **Existing custom fields** for visitors and incidents become engine fields, so the builder edits them too.

---

## 5. Home screen (guards and team leaders)
- **A grid of tiles:** one per active register the person may fill, each with its name and a light icon. No counts or details on the tiles (message 2).
- **Tapping a tile** opens the new-entry form. Recent entries are one tap further, under the form.
- **Removed from this brand's home screen:** the alerts panel and the "people on site" list.
  - A small badge in the top bar keeps alerts reachable (a visitor still inside, an incident awaiting visa, a lost item held).
- **Team leaders** see the "start of shift" tile first.

---

## 6. Admin page (where admins land after login)
1. **Accounts:**
   - create, edit and deactivate admins, team leaders and guards;
   - set or reset a PIN (unique);
   - assign guards to a team.
2. **Registers:** the builder (§4); turn templates on or off; order of the tiles.
3. **Reports and statistics** (§7).
4. **Records:** browse and search all registers; corrections history.
5. **Settings:** faculty name, posts, lists (offices for letters, ID types, item types), data retention.
6. **Audit log:** who logged in, viewed, printed or exported what.

---

## 7. Statistics and printed reports
- **Period:** day, week, month, year, or custom dates. Per register or "all registers".
- **Report content:**
  - the official header (§2);
  - register name and period;
  - totals;
  - breakdowns per field. For example:
    - visitors per office visited and per day;
    - incidents per type and whether stamped;
    - lost items held vs returned;
    - letters per addressee;
    - shifts with absences;
    - custody checks with problems.
  - a chart per breakdown;
  - the list of entries as a table;
  - signature boxes: team leader, head of security, dean's visa.
- **Output:** A4 PDF in Arabic (French and English also work), printed from the app. This is built on the existing PDF export (`src/main/export.ts`).
- **"Print the register":** prints any register over a period in the **same layout as their paper book** (cover page with the dean's opening text, rules page, then the table pages). The digital register can then be archived on paper if the faculty wants.

---

## 8. Delivery phases (proposed order)

| Phase | Content | Size |
|---|---|---|
| **A. Identity** | Brand `ghardaia-law` (logos, name, Arabic first); PIN-only login with routing; roles admin / leader / guard; unique PINs; account creation by the admin; login page as the demo's entry | M |
| **B. Register engine** | Tables, form renderer, register page, append-only entries with corrections, permissions per role | L |
| **C. Faculty registers** | Templates for §3.1–3.8; start-of-shift flow; lost-and-found return; letters; incidents visa; visitors' columns; tiles home screen | L |
| **D. Admin page + builder** | Accounts, register builder, records, audit view | M |
| **E. Reports** | Statistics by period, official header, charts, PDF; "print the register" | M |
| **F. Demo and presentation** | Demo build for this brand with sample data in Arabic; second Vercel project; update the deck's screenshots | S |
| **G. Pilot** | Install at the security office, train team leaders and guards, collect feedback | depends on Q4 |

A and the faculty branding can be shown to the client early (a login page with their two logos), before B–E are finished.

---

## 9. Questions for the client (to send before or during phase A)
1. **PIN login:** does every guard log in with their own PIN? Or does only the team leader log in, with each guard's PIN asked only to record who did an action?
2. **Admin login:** PIN like the others, or a longer password? We recommend a longer secret for admins.
3. **Deanship visa:** will the deanship stamp the incidents register *in the app* (it needs its own account, and a second PC in the deanship linked over the network)? Or keep stamping on paper and only record it in the app?
4. **PCs:** only one PC at the main entrance's security office, or others too (deanship, second gate)? This decides whether the server is needed.
5. **Letters:** which fields, and which offices letters are usually addressed to (the list for the "addressed to" field)? Do they need to record who picked the letter up?
6. **Extra registers (§3.8):** which ones from day one?
7. **Other modules:** vehicles, patrol rounds, key loans, watchlist, ID scanning, badges. Which to keep?
8. **Teams:** how many teams, shift hours (for example 24 h on / 48 h off), and is each guard always in the same team?
9. **Reports:** which statistics matter most to the dean, and who signs the printed report?
10. **Corrections:** confirm that saved entries are never edited, only corrected with a reason (as on paper).
11. **Viewing history:** may guards see past entries of their own shift, or only admins (the "no viewing without written permission" rule)?
12. **Languages:** Arabic only, or keep French and English in the switch? Is a French name needed for printed reports?
13. **"سجلات مركز الأمن بالكلية":** the file starts at "سجل البلاغات". Are sections 1 and 2 missing?

---

## 10. Files to add when work starts
- `src/renderer/src/assets/brands/ghardaia-law-faculty.png`: the faculty logo, cropped, background removed.
- `src/renderer/src/assets/brands/ghardaia-university.png`: from the Word files (`word/media/image1.png`).
- `demo/flavors.ts`: an Arabic sample-data set for this brand. Names and offices are invented; the dean's name is not used in sample data.
