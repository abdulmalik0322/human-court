# Human Court — Backend API

Express API for the Human Court app. Dual-store design: a zero-config JSON
store by default, MongoDB for production. AI assessment via a built-in
local heuristic engine by default, or an OpenAI-compatible LLM when
`AI_API_KEY` is set.

## Quick start

```bash
cd server
npm install
cp .env.example .env   # then set JWT_SECRET at minimum
npm start              # node src/index.js, default port 4000
```

Health check: `GET /api/health` → `{ ok, store: 'json'|'mongodb', ai: 'local-heuristic'|'llm' }`.

## Storage: JSON (default) vs MongoDB (production)

- **JSON store (default, zero-config):** collections live as JSON files under
  `HC_DATA_DIR` (default `<server>/data/`). No setup, no services. Good for
  local development and demos.
- **MongoDB (production path):** set `MONGO_URI` and the server connects with
  Mongoose on startup. This is the path to use in production — the JSON
  store rewrites whole files on every mutation and is not suited to
  concurrent production traffic.

Both stores implement the identical repository interface documented in
`src/db/repository.js` (also enforced by `tests/store.test.js`). The active
store is logged at startup; secrets are never logged.

## AI assessment engine

- **Default (`local-heuristic`):** a built-in, fully transparent engine
  (`src/services/assessment/localEngine.js`). It sentence-splits the
  statements, sources claims (user-listed vs extracted), detects agreement
  (token Jaccard ≥ 0.5) and disagreement (shared topic, Jaccard < 0.35),
  cross-references claims against evidence descriptions (≥2 content-word
  overlap = reflected), checks a missing-information list, and picks an
  outcome category. It is honest about being a heuristic — see the
  `limitations` section of every assessment.
- **LLM (`llm`):** set `AI_API_KEY` (plus optional `AI_BASE_URL`,
  `AI_MODEL`). The provider POSTs to `{AI_BASE_URL}/chat/completions` with
  a 90s timeout, asks for JSON, validates it against
  `src/services/assessment/schema.js`, retries once on invalid JSON, and
  never logs prompts or keys.

Both engines obey the IRON RULES (`src/utils/constants.js`): never invent
evidence or quotations (only exact substrings), no lie detection, no intent
claims, no favoritism, no numeric truthfulness probabilities, observation
vs inference kept separate, no inflammatory language, not legal advice.

Assessments are **append-only history** — never overwritten. A reassessment
requires a reason AND (new evidence since the last assessment OR an open
appeal), otherwise 409.

## Auth

- JWT in an httpOnly `hc_token` cookie (`SameSite=Lax`, `Secure` in
  production, 7-day expiry). bcryptjs, 12 rounds.
- `POST /api/auth/register` → 201 `{user}` (never returns `passwordHash`)
- `POST /api/auth/login` → 200 `{user}` + cookie
- `POST /api/auth/logout` → 200, clears cookie
- `GET /api/auth/me` → 200 `{user}` or 401
- `POST /api/auth/forgot-password` → creates a 1-hour token. If SMTP
  (`EMAIL_*`) is configured, the reset link is emailed. Otherwise, in
  development the token is returned honestly labeled
  "development only — no email sent"; in production a clear
  `email_not_configured` message is returned. Delivery is never faked.
- `POST /api/auth/reset-password {token, newPassword}`

## API overview

- **Cases** (`/api/cases`, owner-only unless noted): `POST /` (validates
  title/summary/category; `idempotencyKey` returns the existing case on
  repeat), `GET /` (`q`, `status`, `category`, `from`/`to`, `sort`, paginated,
  max 50/page), `GET /:id` (includes evidence metadata + latest assessment
  summary; visible to owner, accepted invitees, or anyone if public),
  `PATCH /:id` (drafts only), `DELETE /:id` (cascade),
  `POST /:id/submit`, `POST /:id/archive`, `POST /:id/appeal {reason,newInfo?}`,
  `POST /:id/transition {to}` (generic, table-enforced move).
  Every status change goes through the transition table ported from the
  frontend (`src/utils/caseWorkflow.js`); invalid moves → 409. Accessing
  another user's private case → 404 (existence is never leaked).
- **Evidence** (`/api/cases/:id/evidence`): `POST` (multipart field `file`,
  10 MB max; allowlist jpg/jpeg/png/webp/pdf/txt verified by extension,
  mimetype, AND magic bytes via `file-type`; executables rejected;
  crypto-random filenames under `HC_UPLOAD_DIR`, never served statically),
  `GET /` (metadata), `GET /:evidenceId/download` (authorized stream),
  `DELETE /:evidenceId` (owner only, deletes the file).
- **Assessments** (`/api/cases/:id/assessments`): `POST {reason?}` → 202
  `{id, status:'pending'}`; the engine runs async, moving the case
  `ready-for-analysis → analysis-in-progress → assessment-available`
  (or back on failure) and notifying the owner. `GET /` (history, newest
  first), `GET /:assessmentId` (poll until complete),
  `POST /:assessmentId/report {reason}`.
- **Human review**: `POST /api/cases/:id/invitations {email?,note?}` → 201
  `{token (shown once), expiresAt}` (SHA-256 hash stored, 7-day expiry);
  `POST /api/invitations/:token/accept` (logged in);
  `POST /api/cases/:id/reviews {opinion, reasoning, ...}` (one per user per
  case → 409; invitees or public-audience+public-case);
  `GET /api/cases/:id/reviews`; `GET /api/cases/:id/reviews/aggregate`
  (distribution + keyword themes + "not representative of the public"
  disclaimer); `POST /api/reviews/:reviewId/report {reason}`.
- **Sharing**: `POST /api/cases/:id/share {includeTitle?}` → 201
  `{token, url:'/s/'+token}`; `GET /api/shared/:token` (no auth — returns
  only brand/title/outcomeCategory/short uncertainty-noted
  summary/assessmentDate; never statements, evidence, names, emails);
  `DELETE /api/cases/:id/share` revokes (old tokens 404).
- **Notifications**: `GET /api/notifications` (`{items, unreadCount, page,
  total}`), `PATCH /api/notifications/:id/read`.
- **Users** (`/api/users`, all authenticated): `GET /me`, `PATCH /me`,
  `POST /me/change-password`, `GET /me/export` (JSON download of all their
  data), `DELETE /me {password}` (cascade-deletes cases, files,
  assessments, reviews, invitations, share links, notifications).

Errors are always `{ error: { code, message } }` — no stack traces or
secrets in responses.

## Security & limits

- `helmet`, CORS pinned to `CLIENT_URL` with credentials.
- Rate limits: 100/min general; 10/min on auth routes; 10/hour/user for
  assessments; 20/hour/user for uploads and reviews.
- Invitation/share tokens are SHA-256 hashed at rest; reset tokens expire
  in 1 hour; all inputs validated.
- Graceful shutdown on SIGTERM/SIGINT.

## Environment

See `.env.example`. Key vars: `PORT`, `CLIENT_URL`, `JWT_SECRET`
(required in production), `HC_DATA_DIR`, `HC_UPLOAD_DIR`, `MONGO_URI`,
`AI_API_KEY`/`AI_BASE_URL`/`AI_MODEL`, `EMAIL_HOST`/`EMAIL_PORT`/
`EMAIL_USER`/`EMAIL_PASS`/`EMAIL_FROM`. `RATE_LIMIT_AUTH_MAX` overrides the
10/min auth rate limit (tests set it high; production keeps 10).

## Tests

```bash
# from the repo root (vitest picks up server/tests/*.test.js):
npx vitest run server/tests
# or inside server/:
npm test
```

Tests run against the JSON store in temp dirs (`HC_DATA_DIR` is not read
from the environment — each test builds its own isolated app). They cover:
auth validation, ownership (change-the-ID → 404), evidence upload
validation + auth, the local engine on the headphone dispute
(`insufficient_evidence` asserted), schema validation, a mocked LLM
provider (no real API calls), assessment rate limiting, 409 on invalid
transitions, share revocation, and repository interface conformance.

Note: `nodemailer` is used for the optional SMTP password-reset email;
`supertest` is used by the test suite.
