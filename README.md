# LBSTIMN Admissions CRM (Admin Portal UI)

Navy-themed rebuild of the Enquiries admin portal, matching the real
lbstimn.com system: same statuses, same course list, same New Lead form
layout. Plain HTML, CSS and JavaScript. No build step, no libraries.

## Files
- index.html      Page structure (login, dashboard, forms, table, edit modal)
- css/style.css   Navy design system, responsive layout
- js/config.js    Backend + branding settings. THE FILE YOU EDIT.
- js/utils.js     Small helpers (dates, escaping)
- js/api.js       Data model, course/status lists, API client, demo data
- js/charts.js    Dependency-free SVG charts with hover tooltips
- js/app.js       UI logic

## Run
Open index.html in a browser. With API_BASE empty it runs on demo data
(a "Demo data" chip shows in the header).
Local server: `python3 -m http.server 8000` then open http://localhost:8000

## Connect to your existing backend
Edit js/config.js:

    API_BASE:  "https://db.lbstimn.com/api"
    AUTH_MODE: "token"       // "token" | "cookie" | "none"
    PAYLOAD_STYLE: "camel"   // or "snake"
    ENDPOINTS: { login, enquiries, remarks, confirm }
    STATUS_VALUES: { New, "No Response", "Counseling Scheduled", "Counseling done", Confirmed, Dropped }
    COUNSELORS: ["Sahil", "Harjot"]      // seeds the Counselor dropdown
    BATCHES: [...]                        // Preferred Batch Time options
    TRANSLATE: { provider, apiKey, targetLang }

Existing endpoints used (unchanged):
- POST   {login}                   {username, password} -> {token, user?}
- GET    {enquiries}               array, or {data|results|enquiries|items: [...]}
- POST   {enquiries}               create
- PATCH  {enquiries}/:id           update (only changed fields are sent)
- DELETE {enquiries}/:id           delete

Field names are matched flexibly (name/student_name, phone/mobile,
course/course_interested, source/lead_source, assignedTo/assigned_to/counselor,
batch/preferred_batch, follow_up_date/followUpDate, created_at...). If yours
differ, adjust normalize() in js/api.js.

### Statuses (match the real system)
New, No Response, Counseling Scheduled, Counseling done, Confirmed, Dropped.
"Open" leads (shown in Pending follow-ups, workload, etc.) are everything
except Confirmed and Dropped. Edit STATUS_VALUES in config.js if your
backend stores these under different exact strings.

### Course list
js/api.js -> Model.COURSES holds the full course list (the real ADCA/DIT/CTT/...
list plus the requested MERN/Full Stack/React JS/... technology tracks). Edit
that array directly to add, remove or rename courses — it's used everywhere
(New Enquiry, Edit Lead, filters, charts) automatically.

### Admission confirmation
"Confirm admission" sends PATCH {enquiries}/:id {status: "Confirmed"} by
default. A normal edit cannot set a lead to Confirmed — only this button can.
If your backend has a dedicated confirm route, set ENDPOINTS.confirm.

### Remarks / activity timeline (the one NEW backend piece)
    GET  /enquiries/{id}/remarks   -> [{id, remark|text, author|created_by, created_at}]
    POST /enquiries/{id}/remarks   {remark: "..."}  -> the created entry
Every remark is a separate, timestamped entry; nothing is ever overwritten.

### Speech-to-text + translation
Each remarks/notes field has a mic button (Chrome/Edge, HTTPS or localhost,
needs mic permission) and a Translate button. Translate calls a free
MyMemory API by default (no key, works from any hosted HTTPS page) and shows
the English translation in a preview box — it never overwrites what was
typed; you choose to insert it. Set TRANSLATE.provider to "google" with an
apiKey for Google Cloud Translate instead, or "none" to hide the button.

## Dashboard (all computed from your data, nothing hardcoded)
- Total enquiries, Active/assigned, Dropped, Confirmed admissions, Pending follow-ups
- Inquiry Trends (line), Enquiries by Course (scrollable bar), Counselor
  Workload (bar), Lead Status Overview (bar, colour-coded), Leads by Source
  (donut) — all with hover tooltips
- Daily Follow-up Reminder: dismissible card, bottom-right, dynamic counts
- Date filter: All Time / Today / Yesterday / This Week / This Month / Last
  Month / Custom Range

## Table
Search by name/phone, filters for course/source/counselor/status/date range
(combinable), clear filters, refresh, pagination, CSV export.

## Notes
- If the API is on another domain it must allow CORS for the site serving
  this page (needed for both your data API and, once hosted on HTTPS, the
  translation API already works without any server-side change).
- Logo: put your emblem at img/logo.png and set ORG.logoUrl in js/config.js.
