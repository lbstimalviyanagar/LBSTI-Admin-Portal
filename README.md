# LBSTIMN Admissions CRM

A React/Vite admissions CRM with a separate Express API and a PostgreSQL or MySQL database. The React screens retain the existing dashboard, enquiry workflow, analytics, reminders, speech/translation helpers, fees, receipts, and responsive navigation.

## Project layout

```text
frontend/
  src/components/   React UI and chart components
  src/services/     API client
  src/utils/        Shared formatting, date, and browser helpers
  public/           Logo and static assets
  .env.example
backend/
  config/           Environment and database configuration
  controllers/      Authentication, enquiry, fee, and receipt handlers
  middleware/       Auth, CORS, and error handling
  models/           Database connection and schema setup
  routes/           REST endpoints
  schema/           Hostinger MySQL schema reference
  scripts/          Database and operator commands
  .env.example
  server.js
.gitignore
```

The root `package.json` provides convenience commands. Dependency folders and build output are ignored by Git.

## Local development

Requires Node.js 20.19 or newer.

```powershell
npm run install:all
```

Run the API and frontend in separate terminals:

```powershell
npm run dev:backend
npm run dev:frontend
```

The frontend is at `http://localhost:5173`; Vite proxies `/api` to the development API on port 5000. Development may use SQLite. Production startup explicitly rejects SQLite and localhost database hosts.

There are no default login credentials. To create a local account, provide a password through a temporary environment variable, then remove it:

```powershell
$secure = Read-Host 'Account password' -AsSecureString
$env:NEW_USER_PASSWORD = [System.Net.NetworkCredential]::new('', $secure).Password
npm --prefix backend run create-user -- admin 'Portal Administrator' admin
Remove-Item Env:NEW_USER_PASSWORD
```

## Hosted database and existing data

Provision a persistent PostgreSQL database (for example, Neon, Render PostgreSQL, or Supabase) or use the existing remotely hosted MySQL service. Configure the backend with one of:

- `DATABASE_URL=postgresql://...` for PostgreSQL
- `DATABASE_URL=mysql://...` for MySQL
- `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, and `DATABASE_NAME` for MySQL

The backend creates the required `enquiries`, `remarks`, `fees`, and `portal_users` tables at startup. To run schema setup separately after configuring the backend environment:

```powershell
npm --prefix backend run migrate
```

If `backend/data/lbstimn.db` is available, it is ignored by Git and is not changed by deployment. To copy its enquiries, users, remarks, and payments to a newly provisioned, empty hosted database, run this once from the repository root with the hosted database URL and a strong signing secret set in the shell. Set `SQLITE_SOURCE` only if your source file is at a different path:

```powershell
$env:NODE_ENV = 'production'
$env:DATABASE_URL = 'postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require'
$env:AUTH_SECRET = '<random value with at least 32 characters>'
npm --prefix backend run migrate:sqlite
Remove-Item Env:NODE_ENV, Env:DATABASE_URL, Env:AUTH_SECRET
```

The importer reads `backend/data/lbstimn.db` in read-only mode and refuses to write into a target with existing records. Back up both databases first. If the old data is already in hosted MySQL, point the API at that database instead; do not import it a second time.

If the import contains no portal user, create one using the command above while connected to the hosted database. Otherwise, imported user accounts and password hashes are retained.

## Deploy the API

Deploy `backend/` as a Node web service on Render, Railway, Fly.io, or an equivalent host. Use:

- Build command: `npm ci --omit=dev`
- Start command: `npm start`
- Runtime: Node.js 20.19+

Set these service environment variables in the host dashboard:

```text
NODE_ENV=production
AUTH_SECRET=<unique random value, at least 32 characters>
FRONTEND_URL=https://<your-frontend-domain>
DATABASE_URL=<hosted PostgreSQL or MySQL connection string>
```

The hosting platform supplies `PORT`. The API listens on `0.0.0.0` and exposes `GET /api/health`; it reports database availability. CORS allows only exact origins in `FRONTEND_URL` (comma-separated for multiple known domains). Do not use `*` or include a trailing path in the origin.

## Deploy the frontend

Deploy `frontend/` as a Vite static site on Vercel, Netlify, Cloudflare Pages, or equivalent:

- Root directory: `frontend`
- Build command: `npm run build`
- Output directory: `dist`
- Environment variable: `VITE_API_URL=https://<your-api-domain>`

`VITE_API_URL` is the public HTTPS API origin; the React client appends `/api`. Rebuild/redeploy the frontend after changing this variable. Production code refuses to silently fall back to a same-origin API when it is unset.

## API and verification

The API requires a Bearer token for enquiry, remark, fee, and receipt operations.

- `POST /api/auth/login`, `GET /api/auth/me`
- `GET|POST /api/enquiries`, `PATCH|DELETE /api/enquiries/:id`
- `POST /api/enquiries/:id/confirm`
- `GET|POST /api/enquiries/:id/remarks`
- `GET|POST /api/fees`, `DELETE /api/fees/:id`
- `POST /api/receipts`
- `GET /api/health`

Build the frontend:

```powershell
$env:VITE_API_URL = 'https://<your-api-domain>'
npm --prefix frontend run build
Remove-Item Env:VITE_API_URL
```

Run the live API create/read/update/delete check with an account authorized for fees. It removes the temporary enquiry and payment it creates:

```powershell
$env:API_BASE_URL = 'https://<your-api-domain>'
$env:FRONTEND_ORIGIN = 'https://<your-frontend-domain>'
$env:TEST_USERNAME = '<test-account>'
$secure = Read-Host 'Test account password' -AsSecureString
$env:TEST_PASSWORD = [System.Net.NetworkCredential]::new('', $secure).Password
npm --prefix backend run test:api
Remove-Item Env:API_BASE_URL, Env:FRONTEND_ORIGIN, Env:TEST_USERNAME, Env:TEST_PASSWORD
```

Verify CORS from the deployed browser origin, sign in, create/update/delete a test enquiry and payment, issue a receipt, and refresh the frontend. The smoke test needs a deployed API and a real database-backed account; it is intentionally not run against the preserved local database.

## Deployment status

Source code is prepared for separate frontend, API, and hosted-database deployment, but this workspace does not contain hosting-provider access or database credentials. Therefore no public frontend/API URLs have been provisioned or verified here. The example domains above are placeholders, not live services; supply the hosting accounts and real database connection settings before a public deployment can be completed.
