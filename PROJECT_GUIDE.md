# PROJECT GUIDE - Islamic Pizza POS (islamic-pizza-pos)

> Complete context for any developer or AI assistant resuming work on
> this project after months/years. Read fully before changing anything.
> Keep updated when architecture changes.

## 1. WHAT THIS IS

Offline Windows desktop POS for "Islamic Pizza & Fast Food", a fast food
restaurant in Shehar Sultan, Pakistan (Jatoi Road, Near Allah Wali Market,
0305-1415678 / 0306-1415678). Fully offline, single PC, used daily for
real business: orders, thermal receipts, kitchen slips, reports.

- Thermal printer: Black Copper BC-96AC (80mm USB, uses XP-80C driver)
- Developer: Okasha Chaudhry
- App repo (private): github.com/Okasha-Chaudhry/IslamicPizza
- Keygen repo (private, SEPARATE): github.com/Okasha-Chaudhry/pos-keygen
- Dev style: milestone by milestone, all file edits via PowerShell 5.1,
  verified with Select-String after every scripted edit
- Product UI text: ENGLISH only. Dev conversation: Roman Urdu.

## 2. TECH STACK (do not replace without strong reason)

Electron (electron-vite) + React 19 + TypeScript strict. Vite.
TailwindCSS v4 (CSS-first, NO tailwind.config.js). shadcn/ui (components
copied into repo; add via: npx shadcn@latest add X). better-sqlite3
(synchronous) + Drizzle ORM. Zustand (cart + auth stores). React Hook
Form + Zod. react-router-dom with HashRouter (REQUIRED for production
file:// loading). electron-builder (NSIS).

## 3. ARCHITECTURE - GOLDEN RULES

1. Database and printing live ONLY in the Electron main process.
2. Renderer talks via typed IPC: window.api.<domain>.<action>() ->
   preload (src/preload/index.ts) -> ipcMain handler (src/main/ipc/
   index.ts) -> service (src/main/services/*.service.ts) -> SQLite.
3. Every IPC response is ApiResult<T> = { ok, data?, error? }. Services
   throw; the handle() wrapper catches. App must never crash on errors.
4. MONEY IS ALWAYS INTEGER RUPEES. Never floats.
5. order_items store SNAPSHOTS (productName, variantName, unitPrice at
   sale time) so menu edits never corrupt history.
6. Totals computed in main process (orders.service.ts); renderer preview
   is never trusted.
7. Source files ASCII-only (see 10.2).

## 4. FOLDER MAP

src/main/
  db/index.ts        connection, WAL, MIGRATIONS array, initDatabase()
  db/schema.ts       Drizzle tables (mirror of migrations)
  db/seed.ts         seedIfEmpty() - real menu, runs once on empty DB
  ipc/index.ts       ALL ipcMain handlers + handle() wrapper
  printing/receipt-template.ts   buildReceiptHtml (receipt + kitchen modes)
  printing/print.service.ts      hidden BrowserWindow silent printing;
                                 printReceipt/KitchenSlip/Report/Test
  services/          categories, named-entity (tables+waiters factory),
                     products, orders, settings, reports, backup, users,
                     license - one file per domain, throw on error
src/preload/index.ts   window.api definition; export type Api = typeof api
src/shared/types.ts    ALL shared interfaces (single source of truth)
src/renderer/src/
  App.tsx            license gate -> auth gate -> HashRouter + AdminOnly
  layouts/MainLayout.tsx   sidebar (role-filtered), golden O key, Lock
  pages/             Dashboard, NewOrder, Orders, Products(=Menu UI),
                     Categories, Tables, Waiters, Reports, Settings,
                     LoginScreen, ActivationScreen
  components/ui/     shadcn: button dialog input label select switch
  components/shared/EntityManagerPage.tsx   reusable CRUD page
  components/products/ProductFormDialog.tsx RHF+Zod + variants editor
  components/orders/VariantPickerDialog.tsx keyboard variant popup
  components/auth/   PinPad.tsx, UsersManager.tsx
  stores/            cart-store.ts (lines keyed productId:variantId),
                     auth-store.ts (session, memory only)
  providers/theme-provider.tsx   dark/light, localStorage
convert-logo.js      logo pipeline: resources/logo-source.webp ->
                     trim -> circle mask -> logo.png + icon PNGs + .ico

## 5. DATABASE

Location: %APPDATA%/islamic-pizza-pos/restaurant-pos.db (package.json
name = islamic-pizza-pos determines the folder; dev and prod SHARE it).
WAL mode, foreign_keys ON.

Migrations: versioned SQL strings in MIGRATIONS array (db/index.ts),
tracked by PRAGMA user_version. To change schema: APPEND new SQL string
(never edit old ones) AND mirror in schema.ts.
- v1: categories, products, variants, restaurant_tables, waiters,
  orders, order_items, settings + indexes
- v2: orders + customer_phone, customer_address, discount_percent
- v3: users table (PIN auth) + orders.user_id

Key facts:
- products.times_sold / last_sold_at: bumped per order, drive search rank
- orders.order_number: YYYYMMDD-NNN, resets daily
- orders.status: pending | kitchen_printed | paid | cancelled
  (never deleted - cancel is a status)
- orders.order_type: dine_in | take_away | delivery
- settings: key-value TEXT (defaults in settings.service.ts); also
  stores licenseKey
- seed: real menu (11 categories incl Extras, ~57 items) only when
  products empty. Extra Large Pizza = own item, variants 2300/2500/2700.

## 6. BUSINESS RULES

- Dine In requires table (waiter optional); Delivery prints phone+address
- Discount: PERCENTAGE only (0-100). NO TAX anywhere.
- Buttons: Paid + Print / Paid Only / Kitchen Slip / Print Receipt
- Kitchen slip: big font, qty + names + notes, NO PRICES
- Product delete blocked if used in orders (disable instead); category
  delete blocked if it has products
- Cashier CANNOT: see Reports/Settings/Menu/Categories/Tables/Waiters,
  give discount, cancel orders. Admin can do everything.

## 7. AUTH SYSTEM (Milestone 13)

- PIN login (4-6 digits), roles: admin | cashier
- pin stored as SHA-256(salt:pin) + per-user salt; hashes never leave
  main process (SafeUser type)
- First run (no users): Setup Admin screen. After: PIN pad lock screen;
  PIN alone identifies user (so PINs must be unique in practice).
- Session in auth-store (memory). Lock button = logout. Restart = locked.
- Role enforcement in 3 sync'd places: MainLayout navItems adminOnly,
  App.tsx AdminOnly wrapper, feature locks (discount, cancel).
- Users management: Settings -> Users (add, edit, PIN reset, disable).
  Cannot disable self; cannot remove last active admin (service guard).
- orders.user_id -> receipt prints "Served by: <name>".
- ADMIN PIN RECOVERY: stop app, open %APPDATA%/islamic-pizza-pos/
  restaurant-pos.db with a standalone SQLite tool (system Node canNOT
  load the Electron-built better-sqlite3), DELETE the admin row from
  users; if zero users remain the app shows Setup Admin on next launch.

## 8. LICENSING (Milestone 14) - IMPORTANT

- Device-locked keys: HMAC-SHA256(LICENSE_SECRET, machineId:expiry),
  first 20 hex chars formatted XXXXX-XXXXX-XXXXX-XXXXX-YYYYMMDD.
  Lifetime = expiry 99991231. Expiry is inside the signed payload.
- machineId = Windows registry MachineGuid (license.service.ts).
- App gate: App.tsx checks license:status before anything; not activated
  -> ActivationScreen (shows Machine ID + key input).
- Key saved in settings table; re-verified every launch (device + expiry).
- KEYGEN lives in SEPARATE private repo pos-keygen (keygen.js +
  KeyGenerator.bat + KeyGenerator.hta GUI + client log in README).
  NEVER commit keygen or discuss secret in THIS repo. Secret also backed
  up in owner phone. Secret must match license.service.ts LICENSE_SECRET.
- Business model: this client lifetime; future clients yearly (365).
- Same installer for ALL clients; only the key differs per machine.

## 9. PRINTING

buildReceiptHtml() -> data: URL -> hidden BrowserWindow ->
webContents.print({silent:true, deviceName}) -> destroy.
- Printer names NEVER hardcoded; Settings lists Windows printers via
  getPrintersAsync(); receipt + kitchen printer saved in settings
  (kitchen falls back to receipt printer).
- Width setting 58/80/A4; body width for 80mm is 64mm (BC-96AC physical
  printable area - 72 and 68 were cut off; found by test prints).
- Receipt header hierarchy: restaurantName (big bold) -> receiptHeader
  (bold subhead) -> address/phone (small). No logo on receipts (chosen).
- Test Print button in Settings for client self-diagnosis.

### 9.1 KNOWN HARDWARE ISSUE - USB port shuffle
BC-96AC silently switches USB001/USB002 on replug; jobs sit "Normal" in
queue, nothing prints. Fix (admin PowerShell):
  Stop-Service Spooler -Force
  Remove-Item "$env:SystemRoot\System32\spool\PRINTERS\*" -Force
  Start-Service Spooler
  Set-Printer -Name "BC-96AC" -PortName "USB001"   # try USB002 if not
  "TEST" | Out-Printer -Name "BC-96AC"
Client rule: printer cable stays in the SAME physical USB socket.
Permanent fallback: printer Ethernet port with fixed IP.

## 10. DEV WORKFLOW & GOTCHAS (hard-earned)

Run: npm run dev. Build: npm run build:win ->
dist/islamic-pizza-pos-X.X.X-setup.exe. Version bump before release
builds: npm version patch --no-git-tag-version.

### 10.1 PowerShell file writing - ALWAYS:
  $content = @' ... '@   (single-quote here-string)
  [System.IO.File]::WriteAllText("C:\full\path", $content)
NEVER Set-Content for code files (PS 5.1 writes UTF-8 BOM -> broke
shadcn CLI JSON parsing). Read with: Get-Content -Raw -Encoding UTF8.

### 10.2 Encoding: source files ASCII-only. Fancy dashes/quotes got
mojibake'd through a PS read/write cycle once. Use "-".

### 10.3 PowerShell double-quote trap: in double-quoted PS strings,
backtick is the escape char and $ interpolates - a JS template literal
like `Served by: ${x}` gets silently mangled. Single-quoted strings or
here-strings only when payload has backticks or ${}.

### 10.4 .Replace() replaces ALL occurrences (a seed item got duplicated
once). After every scripted edit VERIFY with Select-String before
running. For risky edits rewrite the whole file.

### 10.5 Other:
- shadcn CLI cannot detect electron-vite; components.json was created
  manually (BOM-free); after that "npx shadcn@latest add X" works.
- Drizzle + better-sqlite3 is sync: end queries with .get()/.all()/
  .run(); .returning() needs .get().
- Multi-step writes: getSqlite().transaction(() => ...)().
- npm postinstall rebuilds better-sqlite3 for Electron. Native errors
  after installs: npx electron-builder install-app-deps
- System Node (v25 here) CANNOT load the Electron-built better-sqlite3
  binding (NODE_MODULE_VERSION mismatch) - verify DB via the running
  app (F12 console: await window.api...) not via node -e.
- electron-builder.yml: asarUnpack '**/*.node' is REQUIRED or SQLite
  fails in production. TS typecheck runs on build (not dev) - expect
  strict errors to surface at build time.
- AUTOINCREMENT ids never reuse; gaps are normal and wanted.
- Radix dialogs do NOT provide arrow-key nav; VariantPickerDialog uses
  its own capture-phase window keydown listener.

## 11. STATUS - v1.0.0 SHIPPED

Milestones 1-15 all DONE:
1 scaffold (updater removed) / 2 Tailwind v4 + shadcn + themes /
3 DB foundation + IPC pattern / 4 shell + sidebar + HashRouter /
5 Tables + Waiters CRUD / 6 Menu + variants + real seeded menu /
7 New Order screen (ranked instant search, variant popup, cart,
4 payment buttons, full keyboard + golden O key) / 8 printing
(receipt + kitchen, printer settings, test print) / 9 Orders page
(filters, detail, reprint, mark paid, cancel) / 10 Reports (range,
summary, popular, daily, printable) / 11 Dashboard (30s refresh) /
12 Backup/Restore (.backup API + safety copy) + integrity check /
13 PIN auth + users + roles + served-by / 14 licensing /
15 production NSIS installer (pizza logo icon set via convert-logo.js,
window title "Restaurant POS", productName "Islamic Pizza POS")

NICE-TO-HAVES (not committed): PDF report export, fix-printer.ps1 for
client desktop, logo on receipt, multi-language UI, white-label build
for future clients (rename app per client - 10 min job).

## 12. DELIVERY CHECKLIST (per client)

1. Installer (from Google Drive or dist/) to client PC, install
2. App opens -> Activation screen -> client sends Machine ID (WhatsApp)
3. Generate key: KeyGenerator.hta (GUI) or .bat in pos-keygen; log the
   client in pos-keygen README table, commit
4. Activate -> Setup Admin (owner sets own PIN)
5. Settings: restaurant info, select printer, Test Print
6. Create cashier users (Settings -> Users)
7. Train: golden O key, 4 payment buttons, Lock, daily report print,
   Create Backup to USB weekly
8. Printer rule: same USB socket always; if no print: Test Print ->
   power cycle printer -> call developer (see 9.1)

## 12.5 BRANCHES & HOW TO RESUME WORK (with AI or alone)
- main = generic Restaurant POS product (v1.1.0+, seed OFF, all clients)
- islamic-pizza branch = that client's build (seed ON, their branding)
- FIRST STEP of any session: git branch (check where you are), then
  git checkout <main | islamic-pizza> for the world you're changing.
- Fix needed in BOTH: do it on main, commit, then
  git checkout islamic-pizza; git cherry-pick <commit-id>; push.
- Old releases rebuildable anytime: git checkout v1.0.0 / v1.1.0
- Resuming with an AI assistant: tell it (1) read PROJECT_GUIDE.md
  first, (2) which branch the change targets, (3) the change itself.
  All file edits in this project are done via PowerShell 5.1 patterns
  described in section 10.

## 13. HOW TO ADD A NEW FEATURE (recipe)

Example domain "riders": 1) append migration SQL in db/index.ts
2) mirror in schema.ts 3) types in shared/types.ts 4) service file
(throw on error) 5) register in ipc/index.ts via handle() 6) expose in
preload under api.riders 7) UI page + nav item (adminOnly if needed)
8) test each layer, commit, push. Fastest CRUD path: copy
named-entity.service.ts + EntityManagerPage.tsx pattern.