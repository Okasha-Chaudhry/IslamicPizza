# PROJECT GUIDE — Islamic Pizza POS (restaurant-pos)

> Purpose of this file: complete context for any developer or AI assistant
> resuming work on this project after months/years. Read this fully before
> changing anything. Keep it updated when architecture changes.

---

## 1. WHAT THIS IS

Offline Windows desktop POS application for "Islamic Pizza & Fast Food",
a small fast food restaurant in Shehar Sultan, Pakistan (Jatoi Road,
Near Allah Wali Market; phones 0305-1415678 / 0306-1415678).

- Fully offline, single PC, no server, no accounts/login
- Used daily for real business: taking orders, printing receipts,
  kitchen slips, and daily sales reports
- Thermal printer: Black Copper BC-96AC (80mm, USB, uses XP-80C driver)
- Developer: Okasha Chaudhry (github.com/Okasha-Chaudhry/IslamicPizza, private)
- Development style: milestone by milestone, all file edits done via
  PowerShell commands (Windows PowerShell 5.1), verified after every step

## 2. TECH STACK (do not replace without strong reason)

- Electron (electron-vite scaffold) + React 19 + TypeScript (strict)
- Vite, TailwindCSS v4 (CSS-first config, NO tailwind.config.js),
  shadcn/ui (components copied into repo, CLI: npx shadcn@latest add X)
- better-sqlite3 (synchronous SQLite driver) + Drizzle ORM
- Zustand (cart state), React Hook Form + Zod (forms), react-router-dom
  (HashRouter — REQUIRED for Electron file:// in production)
- electron-builder for packaging (not yet configured for release)

## 3. ARCHITECTURE — THE GOLDEN RULES

1. Database and printing live ONLY in the Electron main process.
   The React renderer NEVER touches SQLite or printers directly.
2. Renderer talks to main via typed IPC:
   renderer -> window.api.<domain>.<action>() -> preload (src/preload/index.ts)
   -> ipcRenderer.invoke('<domain>:<action>') -> handler (src/main/ipc/index.ts)
   -> service (src/main/services/*.service.ts) -> Drizzle/SQLite
3. Every IPC response is ApiResult<T> = { ok, data?, error? }.
   Services throw Errors; the handle() wrapper in src/main/ipc/index.ts
   catches them so the app can never crash from a DB error.
4. MONEY IS ALWAYS INTEGER RUPEES. Never floats. No decimals anywhere.
5. Order items store SNAPSHOTS (productName, variantName, unitPrice at
   time of sale) so menu edits never corrupt order history.
6. Totals are computed in the main process (orders.service.ts), never
   trusted from the renderer. Renderer only shows a preview.
7. All user-facing UI text is ENGLISH. Conversation with Okasha happens
   in Roman Urdu, but the product is English-only.
8. Source files must be ASCII-only (no fancy dashes/quotes) — see 9.2.

## 4. FOLDER MAP

src/
  main/                  Electron main process
    db/
      index.ts           connection, WAL mode, MIGRATIONS array, initDatabase()
      schema.ts          Drizzle table definitions (mirror of migrations)
      seed.ts            seedIfEmpty() — full real menu, runs once on empty DB
    ipc/index.ts         ALL ipcMain handlers + handle() safety wrapper
    printing/
      receipt-template.ts buildReceiptHtml(order, settings, mode) — receipt & kitchen
      print.service.ts   hidden BrowserWindow silent printing; printReceipt/
                         printKitchenSlip/printReport/printTest
    services/            one file per domain; pure functions, throw on error
      categories.service.ts, named-entity.service.ts (tables+waiters via
      factory), products.service.ts, orders.service.ts, settings.service.ts,
      reports.service.ts, backup.service.ts
  preload/index.ts       window.api definition; export type Api = typeof api
  preload/index.d.ts     global Window typing
  shared/types.ts        ALL shared TS interfaces (single source of truth)
  renderer/src/
    App.tsx              HashRouter + routes
    layouts/MainLayout.tsx  sidebar + global 'O' golden key
    pages/               Dashboard, NewOrder, Orders, Products(=Menu UI),
                         Categories, Tables, Waiters, Reports, Settings
    components/
      ui/                shadcn components (button, dialog, input, label,
                         select, switch)
      shared/EntityManagerPage.tsx  reusable CRUD page (Tables/Waiters/Categories)
      products/ProductFormDialog.tsx  RHF+Zod form with variants editor
      orders/VariantPickerDialog.tsx  keyboard-driven variant popup
    stores/cart-store.ts Zustand cart (lines keyed by productId:variantId)
    providers/theme-provider.tsx  dark/light, persisted in localStorage

## 5. DATABASE

Location: C:\Users\<user>\AppData\Roaming\restaurant-pos\restaurant-pos.db
Mode: WAL, foreign_keys ON.

MIGRATIONS: versioned SQL strings in MIGRATIONS array (src/main/db/index.ts),
tracked via PRAGMA user_version. To change schema: append a new SQL string
to the array (never edit old ones) AND update schema.ts to match.
- v1: full initial schema (categories, products, variants, restaurant_tables,
  waiters, orders, order_items, settings + indexes)
- v2: orders + customer_phone, customer_address, discount_percent

Key columns worth remembering:
- products.times_sold, products.last_sold_at — bumped on every order,
  used for search ranking on New Order screen
- orders.order_number — format YYYYMMDD-NNN, resets daily (nextOrderNumber())
- orders.status: pending | kitchen_printed | paid | cancelled
  (orders are never deleted; cancel is a status)
- orders.order_type: dine_in | take_away | delivery
- settings: key-value TEXT table; defaults in settings.service.ts

Seeding: seed.ts inserts the real menu (11 categories, ~57 items with
variants) ONLY when products table is empty. Real prices from the printed
menu card. Delete the .db* files to re-seed in dev.

## 6. BUSINESS RULES (client requirements)

- Order types: Dine In (requires table; waiter optional), Take Away,
  Delivery (customer phone + address printed on receipt)
- Discount: PERCENTAGE only (0-100), stored with computed amount
- NO TAX anywhere, not on receipts (prices are final)
- Payment buttons: Paid + Print / Paid Only / Kitchen Slip / Print Receipt
- Kitchen slip: big font, quantities + item names + notes, NO PRICES
- Product deletion blocked if used in orders (disable instead);
  category deletion blocked if it has products
- Extra Large Pizza is its own menu item with variants 2300/2500/2700
  (price depends on flavor tier; flavor written in item note)

## 6.5 AUTH / LOGIN SYSTEM (Milestone 13)

- PIN-based (4-6 digits), two roles: admin | cashier
- users table (v3 migration): pin stored as SHA-256(salt:pin) + per-user
  salt (Node crypto). PIN hashes NEVER sent to renderer (SafeUser type).
- First run (no users): Setup Admin screen -> creates owner account.
  After that: PIN pad lock screen; PIN alone identifies the user.
- Session lives in Zustand auth-store (memory only). Lock button in
  sidebar logs out. App restart = locked.
- Role enforcement in THREE places (all must stay in sync):
  1. MainLayout navItems adminOnly flags (sidebar visibility)
  2. App.tsx AdminOnly route wrapper (URL-level guard)
  3. Feature locks: discount field (NewOrder) + cancel button (Orders)
     are admin-only
- Users management: Settings -> Users section (UsersManager.tsx).
  Add user, edit name/role, reset PIN, enable/disable. Cannot disable
  yourself; cannot demote/disable the last active admin (service guard).
- orders.user_id records who created each order; receipts print
  "Served by: <name>" (resolveNames in print.service.ts).
- ADMIN PIN RECOVERY (owner forgot PIN): stop app, open the DB at
  %APPDATA%/restaurant-pos/restaurant-pos.db with any SQLite tool
  (must use Electron-compatible tooling or a standalone sqlite3.exe;
  system Node cannot load the Electron-built better-sqlite3 binding),
  then: DELETE FROM users WHERE role='admin' AND name='<owner>';
  -- if that leaves zero users, app shows Setup Admin again on next
  launch. Alternatively UPDATE a known test user to role='admin'.

## 7. UI / KEYBOARD SYSTEM

- Golden key 'O': anywhere in app (unless typing in an input) ->
  navigates to New Order + focuses search. Implemented in MainLayout;
  NewOrder listens for CustomEvent 'pos:focus-search'.
- New Order: Ctrl+K / Ctrl+F / F3 focus search; Enter adds top result;
  ArrowDown from search enters product grid; arrows move (auto-scroll
  via scrollIntoView); Escape returns to search.
- VariantPickerDialog: manages its own highlight index; ArrowKeys move,
  Enter picks, number keys 1-9 pick directly, Esc cancels. Uses a
  capture-phase window keydown listener (Radix does NOT provide arrow nav).
- Touch targets: minimum h-10/h-11 buttons, h-12 payment buttons.
- Theme: dark/light toggle bottom of sidebar, localStorage 'pos-theme'.

## 8. PRINTING SYSTEM

Flow: buildReceiptHtml() -> data: URL -> hidden BrowserWindow ->
webContents.print({ silent: true, deviceName }) -> destroy window.

- Printer names are NEVER hardcoded. Settings page lists Windows printers
  via webContents.getPrintersAsync(); user picks receipt + kitchen printer
  (kitchen falls back to receipt printer if unset).
- Receipt width setting: 58 / 80 / A4. CSS body width for 80mm is 64mm
  (BC-96AC printable area — found by physical testing; 72mm and 68mm
  were cut off on the right).
- Header hierarchy on receipt: restaurantName (big bold) -> receiptHeader
  (bold subhead, e.g. "Shehar Sultan") -> address/phone (small).
- Test Print button in Settings for client self-diagnosis.

### 8.1 KNOWN HARDWARE ISSUE — USB port shuffle (IMPORTANT)
BC-96AC (and USB thermal printers generally) can silently switch between
USB001/USB002 when unplugged/replugged. Jobs then sit "Normal" in queue,
nothing prints. Fix (admin PowerShell):
  Stop-Service Spooler -Force
  Remove-Item "$env:SystemRoot\System32\spool\PRINTERS\*" -Force
  Start-Service Spooler
  Set-Printer -Name "BC-96AC" -PortName "USB001"   # or USB002 — try both
  "TEST" | Out-Printer -Name "BC-96AC"
Client instruction: keep printer in the same physical USB socket, always.
Permanent alternative if it recurs: use the printer's Ethernet port (fixed IP).

## 9. DEVELOPMENT WORKFLOW & GOTCHAS

Commands: npm run dev (dev with HMR). Work happens via PowerShell file
writes, then verify with Select-String, then run.

### 9.1 File writing from PowerShell — ALWAYS this pattern:
  $content = @' ... '@
  [System.IO.File]::WriteAllText("C:\full\path\file.ts", $content)
NEVER Set-Content for code files: PowerShell 5.1 writes a UTF-8 BOM which
BREAKS shadcn CLI JSON parsing (components.json) and can corrupt files.
When reading for edits: Get-Content -Raw -Encoding UTF8.

### 9.2 Encoding rule
Source files ASCII-only. Fancy characters (en-dash, curly quotes) got
mojibake'd (A-cir-euro-oe garbage) through a PowerShell read/write cycle
once. Use "-", not fancy dashes, in UI strings.

### 9.3 .Replace() edits
String .Replace() replaces ALL occurrences — a seed item was once
duplicated this way. After every scripted edit, VERIFY with Select-String
before running. For risky edits, rewrite the whole file instead.

### 9.3.5 PowerShell double-quote trap (JS template literals)
In PowerShell double-quoted strings, backtick is the ESCAPE character and
$ triggers interpolation — a JS line like metaLines.push(`Served by: ${x}`)
gets silently mangled. ALWAYS use single-quoted PowerShell strings or
here-strings (@'...'@) when the payload contains backticks or ${}.

### 9.4 Other gotchas learned
- shadcn CLI cannot detect electron-vite -> components.json was created
  manually; npx shadcn@latest add <component> works fine after that.
- Drizzle + better-sqlite3 is synchronous: always end queries with
  .get() / .all() / .run(); .returning() needs .get() after it.
- Multi-step DB writes use getSqlite().transaction(() => ...)().
- npm postinstall runs electron-builder install-app-deps which rebuilds
  better-sqlite3 for Electron's Node. If native errors appear after
  npm installs, run: npx electron-builder install-app-deps
- Node on dev machine is v25 (non-LTS); prebuilt binaries worked, but if
  a native build ever fails, switch to Node 22 LTS via nvm-windows.
- AUTOINCREMENT ids never reuse after delete — gaps are normal and wanted.

## 10. STATUS — WHAT IS DONE / WHAT REMAINS

DONE (Milestones 1-12):
 1. electron-vite scaffold (React+TS), updater removed
 2. Tailwind v4 + shadcn/ui + zinc theme, dark/light
 3. DB foundation: schema, migrations, WAL, IPC bridge pattern
 4. App shell: sidebar, HashRouter, theme toggle
 5. Tables + Waiters CRUD (shared EntityManagerPage)
 6. Menu (products) + variants CRUD, category filter, RHF+Zod dialog
    + real menu seeded from the printed menu card
 7. New Order screen: instant ranked search, category tabs, variant
    popup, cart (qty/notes/discount), 4 payment buttons, full keyboard
    system + golden 'O' key
 8. Printing: receipt + kitchen slip on BC-96AC, settings page with
    printer selection, width, restaurant info, test print
 9. Orders page: date + status filters, detail panel, reprint
    (receipt/kitchen), mark paid, cancel
10. Reports: date range, summary, popular products, daily breakdown,
    printable report
11. Dashboard: today snapshot, auto-refresh 30s, quick actions
12. Backup/Restore (SQLite .backup API, safety copy before restore)
    + integrity check — all in Settings
13. PIN login system: setup flow, lock screen, roles (admin/cashier),
    users management in Settings, order attribution + served-by on
    receipt, cashier locks (no discount, no cancel, no admin pages)

REMAINING:
- Milestone 14: production build & installer (electron-builder config,
  app icon, name "Islamic Pizza POS", NSIS installer, test on clean PC)
- Nice-to-haves discussed but not committed: PDF export of reports,
  fix-printer.ps1 helper script for client desktop, logo on receipt,
  multi-language UI

## 11. HOW TO ADD A NEW FEATURE (the recipe)

Example: adding domain "riders":
1. Migration: append SQL to MIGRATIONS in src/main/db/index.ts
2. Mirror table in src/main/db/schema.ts
3. Types in src/shared/types.ts
4. Service src/main/services/riders.service.ts (throw Errors)
5. Register channels in src/main/ipc/index.ts via handle()
6. Expose in src/preload/index.ts under api.riders
7. UI page/components in renderer; navigation item in MainLayout
8. Test each layer, commit with a descriptive message, push

Follow existing files as templates — named-entity.service.ts +
EntityManagerPage.tsx is the fastest path for simple CRUD domains.