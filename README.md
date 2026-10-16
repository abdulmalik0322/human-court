# Human Court — "Every argument deserves a fair hearing."

A full-stack platform where people can submit everyday disagreements, present two
perspectives, attach evidence, and get a fair, uncertainty-honest assessment.

**Stack:** React 19 + Vite frontend · Node.js + Express API · dual data store
(JSON files by default, MongoDB when `MONGO_URI` is set) · built-in heuristic AI
engine with optional pluggable LLM.

---

## 1. What's real vs. what falls back

| Feature | Status |
|---|---|
| Landing, How it works, About, FAQ, Example, Privacy, Terms pages | Real, fully working |
| Sign up / log in / log out | Real — bcrypt-hashed passwords, HTTP-only session cookie |
| Forgot / reset password | Real flow. **No email configured?** The API honestly returns a dev reset token labeled "no email sent" instead of pretending |
| Case wizard (4 steps, validation, drafts, autosave) | Real — persisted in the database |
| Dashboard (search, filters, sort, pagination, real counts) | Real — computed from your cases |
| Case detail, status workflow, timeline, archive, appeal | Real — illegal status jumps rejected server-side |
| Evidence upload (JPG/PNG/WebP/PDF/TXT, 10 MB) | Real — type + size validated, safe filenames, authorized downloads only |
| "Request AI assessment" | Real. **No `AI_API_KEY`?** The built-in heuristic engine analyzes the case (clearly labeled `local-heuristic`). **Key set?** A real LLM is called via any OpenAI-compatible endpoint |
| AI honesty rules | Enforced — never claims lie detection, never gives numeric truthfulness odds, never invents quotes; uncertainty is always stated |
| Human review (invite-only / public) | Real — invitations with expiring tokens, aggregation, reporting |
| Share links (`/s/:token`) | Real — revocable public links showing a redacted summary only |
| Export my data / delete account | Real — JSON download; deletion cascades to cases, evidence, assessments |
| Notifications | Real, in-app (bell icon). Email notifications only when SMTP is configured |

---

## 2. Prerequisites (Windows 10/11)

1. **Node.js 20 or newer** — download from https://nodejs.org (LTS). Verify:
   ```powershell
   node -v
   npm -v
   ```
2. **VS Code** — https://code.visualstudio.com
3. **Git** (optional) — https://git-scm.com

---

## 3. Setup — exact PowerShell steps

You need **two terminals**: one for the backend API, one for the frontend.

```powershell
# TERMINAL 1 — backend API
cd C:\path\to\human-court
npm install --prefix server     # install API dependencies (once)
Copy-Item .env.example .env     # create your env file (repo root)

# Generate a real JWT secret and put it in .env as JWT_SECRET=...
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

npm run server                  # starts the API on http://localhost:4000
# You should see: [server] Human Court API listening on :4000 — store=json ai=local-heuristic
```

```powershell
# TERMINAL 2 — frontend (open a second PowerShell / VS Code terminal with Ctrl+Shift+`)
cd C:\path\to\human-court
npm install                     # install frontend dependencies (once)
npm run dev                     # starts the app on http://localhost:5173
# The dev server forwards /api calls to the backend automatically.
```

Open **http://localhost:5173** and try the main workflow:

1. **Bring Your Case** → create a real account (name, email, password).
2. Fill the 4-step wizard. Watch for the **"Draft saved"** banner.
3. Submit → open the case from the **Dashboard**.
4. Move it to *Ready for analysis* (Submit → the status buttons) and click
   **Request AI assessment** — watch the progress UI, then read the structured
   assessment (summary, claims, agreements, disagreements, evidence analysis,
   missing info, next steps, limitations).
5. Try **Settings** → export your data as JSON, or delete the account.

### Stop the servers
Press **Ctrl+C** in each terminal.

---

## 4. Optional: use MongoDB Atlas instead of JSON files

The JSON store is fine for development. For anything shared or long-lived:

1. Create a free cluster at https://www.mongodb.com/cloud/atlas (M0 free tier).
2. In Atlas: **Database Access** → add a user + password; **Network Access** →
   allow your IP (or `0.0.0.0/0` for testing only).
3. Click **Connect** → *Drivers* → copy the connection string. It looks like:
   `mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/human-court`
4. In your `.env`, set `MONGO_URI` to that string (with your real user/password).
5. Restart `npm run server` — the log line will say `store=mongodb`.

Collections are created automatically on first use; indexes are defined in
`server/src/models/`.

## 5. Optional: use a real LLM for assessments

Without a key you get the built-in `local-heuristic` engine (transparent,
zero-cost, honest about limits). To use a real model:

1. Get an API key from your provider (OpenAI or any OpenAI-compatible endpoint).
2. In `.env` set:
   ```
   AI_API_KEY=your-key-here
   AI_BASE_URL=https://api.openai.com/v1   # or your provider's base URL
   AI_MODEL=gpt-4o-mini
   ```
3. Restart `npm run server` — the log line will say `ai=llm`.
4. The UI labels LLM assessments with the model name; output is schema-validated
   server-side and a failed/invalid response never overwrites a good one.

> Never put the key in a `VITE_` variable or in frontend code — it stays on the
> server. Never paste secrets into chat.

## 6. Optional: send real emails (password resets)

Without SMTP configured, forgot-password returns an honestly-labeled dev token.
To send real reset emails, fill in your `.env`:

```
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=you@example.com
EMAIL_PASS=your-app-password
EMAIL_FROM=Human Court <no-reply@example.com>
```

(Gmail needs an [App Password](https://myaccount.google.com/apppasswords), not
your normal password.)

---

## 7. API endpoints

Base path `/api`. Auth uses an HTTP-only `hc_token` cookie. Every private
resource is ownership-checked server-side.

| Method & path | Auth | What it does |
|---|---|---|
| `GET /api/health` | — | Liveness: store + AI mode |
| `POST /api/auth/register` | — | Create account (bcrypt hash, sets cookie) |
| `POST /api/auth/login` | — | Log in (sets cookie) |
| `POST /api/auth/logout` | ✓ | Clear session |
| `GET /api/auth/me` | ✓ | Current user |
| `POST /api/auth/forgot-password` | — | Dev reset token, or real email if SMTP set |
| `POST /api/auth/reset-password` | — | Set a new password with a token |
| `GET /api/users/me` | ✓ | Profile |
| `PATCH /api/users/me` | ✓ | Update name / preferences |
| `POST /api/users/me/change-password` | ✓ | Change password (needs current) |
| `GET /api/users/me/export` | ✓ | Download all my data (JSON) |
| `DELETE /api/users/me` | ✓ | Delete account + everything owned |
| `POST /api/cases` | ✓ | Create draft case |
| `GET /api/cases` | ✓ | List my cases (search, filter, sort, paginate) |
| `GET /api/cases/:id` | ✓ owner | Case detail |
| `PATCH /api/cases/:id` | ✓ owner | Edit draft fields |
| `DELETE /api/cases/:id` | ✓ owner | Delete case |
| `POST /api/cases/:id/submit` | ✓ owner | Draft → submitted |
| `POST /api/cases/:id/transition` | ✓ owner | Move status (validated transitions only) |
| `POST /api/cases/:id/archive` | ✓ owner | Archive |
| `POST /api/cases/:id/appeal` | ✓ owner | Open an appeal (enables reassessment) |
| `POST /api/cases/:id/evidence` | ✓ owner | Upload file (multipart, ≤10 MB) |
| `GET /api/cases/:id/evidence` | ✓ owner | List evidence metadata |
| `GET /api/cases/:id/evidence/:evidenceId/download` | ✓ owner | Authorized download |
| `DELETE /api/cases/:id/evidence/:evidenceId` | ✓ owner | Remove evidence |
| `POST /api/cases/:id/assessments` | ✓ owner | Start assessment (10/hour/user) |
| `GET /api/cases/:id/assessments` | ✓ owner | Assessment history (newest first) |
| `GET /api/cases/:id/assessments/:assessmentId` | ✓ owner | One assessment (poll while `pending`) |
| `POST /api/cases/:id/assessments/:assessmentId/report` | ✓ | Report a problematic assessment |
| `POST /api/cases/:id/invitations` | ✓ owner | Invite a reviewer (expiring token) |
| `POST /api/invitations/:token/accept` | ✓ | Accept an invitation |
| `POST /api/cases/:id/reviews` | ✓ invited | Submit a review |
| `GET /api/cases/:id/reviews` | ✓ | Reviews + aggregate summary |
| `POST /api/reviews/:reviewId/report` | ✓ | Report a review for moderation |
| `POST /api/cases/:id/share` | ✓ owner | Create revocable public link |
| `DELETE /api/cases/:id/share` | ✓ owner | Revoke the public link |
| `GET /api/shared/:token` | — | Public redacted summary (no private data) |
| `GET /api/notifications` | ✓ | In-app notifications |
| `PATCH /api/notifications/:id/read` | ✓ | Mark read |

---

## 8. Project structure

```
human-court/
├── index.html / vite.config.js  # /api proxy → localhost:4000 in dev
├── package.json                 # dev, build, preview, lint, server, test (both suites)
├── .env.example                 # All backend + frontend vars (placeholders only)
├── src/                         # React frontend (pages, components, api.js, …)
└── server/
    ├── package.json             # Express deps + test script
    └── src/
        ├── index.js             # Entry: loads config, picks store, listens
        ├── app.js               # Express factory (helmet, cors, cookies, rate limits)
        ├── config/env.js        # Env parsing + validation
        ├── db/                  # repository.js interface, jsonStore, mongooseStore
        ├── models/              # Mongoose schemas + indexes
        ├── routes/              # auth, users, cases, evidence, assessments,
        │                        # reviews, sharing, notifications
        ├── controllers/         # Request handling (thin; logic lives in services)
        ├── services/
        │   ├── assessment/      # localEngine (heuristic), llmProvider, schema,
        │   │                    # index (engine selection)
        │   ├── invitations.js   # Expiring unguessable tokens
        │   ├── storage.js       # Safe filenames, type/size validation
        │   ├── notifications.js # In-app notification creation
        │   └── email.js         # SMTP or honest dev-token fallback
        ├── middleware/          # auth (JWT cookie), errorHandler, requestLog
        └── utils/               # caseWorkflow, ids, pagination, constants
```

---

## 9. Useful commands

```powershell
npm run server     # Backend API (http://localhost:4000)
npm run dev        # Frontend (http://localhost:5173)
npm run build      # Production frontend build → dist/
npm run preview    # Serve the production build locally
npm run lint       # oxlint check
npm test           # ALL tests: frontend (37) + backend (70) — must be green
```

---

## 10. Environment variables

| Variable | Required? | Default | Purpose |
|---|---|---|---|
| `PORT` | No | `4000` | API listen port |
| `JWT_SECRET` | **Yes for anything real** | dev fallback (warns) | Signs session cookies — generate with the node one-liner above |
| `CLIENT_URL` | No | `http://localhost:5173` | CORS origin + email links |
| `NODE_ENV` | No | `development` | `production` enforces `JWT_SECRET` |
| `MONGO_URI` | No | *(empty → JSON store)* | MongoDB connection string |
| `AI_API_KEY` | No | *(empty → built-in engine)* | LLM provider key (server only!) |
| `AI_BASE_URL` | No | `https://api.openai.com/v1` | OpenAI-compatible endpoint |
| `AI_MODEL` | No | `gpt-4o-mini` | Model identifier |
| `EMAIL_HOST/PORT/USER/PASS/FROM` | No | *(empty → dev tokens)* | SMTP for real reset emails |
| `VITE_APP_NAME` | No | `Human Court` | Frontend display name |

---

## 11. Troubleshooting

| Problem | Fix |
|---|---|
| `npm run server` → `JWT_SECRET must be set in production` | You're running with `NODE_ENV=production` — either set a real `JWT_SECRET` in `.env` or unset `NODE_ENV` |
| Port 4000 already in use | Change `PORT` in `.env` (e.g. `4001`) **and** update the proxy target in `vite.config.js` |
| Frontend shows "Network error" / API calls fail | Is Terminal 1 (`npm run server`) still running? The proxy needs it |
| Login works but refresh logs me out | The API and frontend must be same-origin in dev — use `http://localhost:5173`, not `127.0.0.1:5173` (cookie domain) |
| `MONGO_URI` connection fails | Check the Atlas user/password, IP allowlist, and that the string starts with `mongodb+srv://` |
| Assessment stuck on `pending` | Check Terminal 1 for errors; the local engine runs in-process, the LLM path needs network + valid key |
| `npm install --prefix server` fails | Check internet; `npm cache clean --force`, retry |
| Tests fail with 429 | Shouldn't happen — limiters are bypassed when `NODE_ENV=test`. If you see it, report it as a bug |

---

## 12. Honesty notes (please read before showing this to anyone)

- The sample case ("The borrowed headphones") is **fiction**, labeled
  *"Sample demonstration"* everywhere it appears.
- The built-in AI engine is a **transparent keyword heuristic**, not human
  judgment — it says what it can and cannot do, every time.
- Human Court is **not a court of law** and provides **no legal advice**.
- Never reuse a real password here while running someone else's build.
