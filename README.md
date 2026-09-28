# LBSTIMN Admissions CRM

Navy-themed Enquiries + Fees admin portal with persistent storage. It runs
with a local Express + SQLite backend by default so every form submission,
edit, and payment is saved to a real database and still appears after page
reload. The original Supabase-ready frontend code remains available in the
project as an option, but the local backend is the easiest way to make it
work immediately without extra credentials.

## Quick start
1. Install dependencies:
   npm install
2. Start the server:
   npm start
3. Open the app in the browser:
   http://localhost:3001

The app saves enquiries, remarks, and fee records in the SQLite file at
[data/lbstimn.db](data/lbstimn.db). Refreshing the browser reloads live data
from the database and recalculates the charts automatically.

## Files
- index.html          Page structure (login, dashboard, forms, tables, modal)
- css/style.css        Navy design system, responsive layout, sticky footer
- schema.sql            Run this in Supabase SQL Editor once (tables, RLS, realtime)
- js/config.js          Settings: BACKEND mode, statuses, courses, counselors...
- js/supabase.js        Supabase client init — put your Project URL + anon key here
- js/auth.js            Sign in/out, session restore, role lookup
- js/utils.js           Date/formatting helpers
- js/api.js             Data model + the Api facade (Supabase / REST / demo)
- js/charts.js          Dependency-free SVG charts, hover tooltips, click-to-filter
- js/app.js             UI logic

## 1. Set up Supabase (5 minutes)
1. Create a free project at supabase.com.
2. Project -> SQL Editor -> New query -> paste all of `schema.sql` -> Run.
3. Project -> Authentication -> Providers -> make sure Email is enabled.
4. Project -> Authentication -> Users -> Add user (email + password) for
   each counselor/admin who should log in.
5. In the SQL Editor, promote whoever should be an admin:
   `update public.profiles set role = 'admin' where id = '<their-user-uuid>';`
   (find the uuid on the Authentication -> Users page). Everyone else
   defaults to 'counselor'.
6. Project -> Settings -> API -> copy the **Project URL** and **anon public
   key** into `js/supabase.js`:
       const SUPABASE_URL = "https://xxxx.supabase.co";
       const SUPABASE_ANON_KEY = "eyJ...";
   The anon key is safe to ship in frontend code — Row Level Security
   (already set up by schema.sql) is what actually protects the data.
7. Open index.html (or push to GitHub Pages). You'll get a real login
   screen; sign in with one of the accounts from step 4.

Leave `js/supabase.js` at its placeholder values and the app runs on
built-in demo data instead (useful for previewing the UI without a
database) — see `CONFIG.BACKEND` in js/config.js.

**Loading behaviour:** the Supabase SDK is loaded asynchronously (jsDelivr,
then unpkg as backup, 8s timeout each) and only when `js/supabase.js` is
filled in. A slow or blocked CDN can never freeze the page — you'll see a
"Loading…" screen, then either the app or a clear error message.

## 2. What's dynamic (nothing hardcoded)
- **All CRUD** (new leads, edits, remarks, admission confirmation, fee
  payments) writes straight to Supabase via `js/api.js`'s Supabase
  backend, and reads back from it.
- **Realtime**: `Api.subscribe()` opens a Supabase Realtime channel on
  `enquiries`, `remarks` and `fees`. Any insert/update/delete — from this
  browser tab, a teammate's tab, or the Supabase dashboard — triggers a
  silent background refresh, so dashboard numbers and charts update
  live without a manual reload.
- **Follow-up reminders**: the bell and the "Daily Follow-up Reminder"
  card are computed from real rows (`follow_up_date` vs today), not a
  fixed number.
- **Charts**: Inquiry Trends, Enquiries by Course, Counselor Workload,
  Lead Status Overview, Leads by Source — all computed from live data,
  with hover tooltips (14px value labels, 12px axis ticks) and now
  **click-to-filter**: click any bar/segment/legend item and it jumps to
  the Enquiries Table pre-filtered to that course/counselor/status/source.

## 3. Auth & roles
- Login uses Supabase Auth (`signInWithPassword`) with email + password.
- `profiles.role` is `'admin'` or `'counselor'`.
- Row Level Security enforces the split at the database level (not just
  hidden in the UI): counselors only ever receive rows where
  `enquiries.assigned_to` matches their own `full_name`; admins receive
  everything. This applies to enquiries, remarks and fees alike.
- **Important**: keep each counselor's Supabase `profiles.full_name`
  identical to how they're assigned in the app (the Counselor dropdown,
  `js/config.js` -> `COUNSELORS`) — the match is a plain text compare.

## 4. Fees (new, separate section)
A dedicated "Fees" tab, independent of the Enquiries table:
- Record a payment against any existing lead (search by name/phone,
  amount, date, mode, notes).
- Payment history table with delete, and CSV export.
- Stats: total collected, collected this month, average payment.
- Table: `public.fees` (schema.sql), RLS mirrors enquiries (a counselor
  only sees/adds payments for leads assigned to them; admins see all).

## 5. Course list, statuses, counselors, batches
All defined once in `js/config.js` / `Model` (js/api.js) and used
everywhere (forms, filters, charts) automatically:
- Statuses: New, No Response, Counseling Scheduled, Counseling done,
  Confirmed, Dropped — matches the `enquiries.status` check constraint
  in schema.sql. Change both together if you rename any.
- Courses: `Model.COURSES` in js/api.js — the full ADCA/DIT/CTT/... list
  plus MERN/Full Stack/React JS/... technology tracks.
- Counselors: `CONFIG.COUNSELORS` seeds the dropdown; any name already
  used in the data is picked up automatically too.

## 6. Speech-to-text + translation
Each remarks/notes field has a mic button (Chrome/Edge, HTTPS or
localhost, needs mic permission) and a Translate button. Translate calls
a free MyMemory API by default (no key) and shows the English
translation in a preview box — it never overwrites what was typed; you
choose to insert it. Set `CONFIG.TRANSLATE.provider` to `"google"` with
an `apiKey` for Google Cloud Translate instead, or `"none"` to hide it.

## 7. Deploying to GitHub Pages
Nothing special — Pages serves static files, and this is a static site
that talks to Supabase over HTTPS from the browser. Push the repo, turn
on Pages (Settings -> Pages -> Deploy from branch), done. Just make sure
`js/supabase.js` has your real URL/key committed (or, better for a
public repo, keep them out of git and paste them in after cloning —
they're not secret, but you may still prefer that).

## 8. REST-API mode (optional, instead of Supabase)
If you'd rather point this at your own backend instead of Supabase, set
`CONFIG.BACKEND = "rest"` and fill in `API_BASE` / `ENDPOINTS` — the
original REST implementation (Bearer token or cookie auth) is still in
js/api.js and works exactly as before. `CONFIG.BACKEND = "demo"` (or
leaving Supabase unconfigured) runs on in-memory sample data.
