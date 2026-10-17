// Express app factory. buildApp({repo, storeName, config}) returns a
// fully-wired app without listening — index.js listens, tests inject
// temp dirs and a JSON repo.
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { rateLimit } from 'express-rate-limit';
import { getConfig } from './config/env.js';
import { createAuth } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLog } from './middleware/requestLog.js';
import { createMailer } from './services/email.js';
import { aiMode } from './services/assessment/index.js';
import { createAuthRouter } from './routes/auth.js';
import { createUsersRouter } from './routes/users.js';
import { createCasesRouter } from './routes/cases.js';
import { createEvidenceRouter } from './routes/evidence.js';
import { createAssessmentsRouter } from './routes/assessments.js';
import { createReviewsRouter } from './routes/reviews.js';
import { createSharingRouter } from './routes/sharing.js';
import { createNotificationsRouter } from './routes/notifications.js';
import { createChatRouter } from './routes/chat.js';

function rateLimitHandler(_req, res) {
  res.status(429).json({
    error: { code: 'rate_limited', message: 'Too many requests. Please slow down and try again later.' },
  });
}

export function buildApp({ repo, storeName = 'json', config = getConfig() } = {}) {
  if (!repo) throw new Error('buildApp requires a repository');

  const app = express();
  app.disable('x-powered-by');
  // Behind Render/Heroku-style platforms TLS terminates at a proxy and the
  // client IP arrives in X-Forwarded-For. Without this, express-rate-limit
  // treats every visitor as the proxy's single IP (and v7 errors loudly),
  // so real users get wrongly rate-limited. Only production runs behind a
  // proxy — dev/test keep the default.
  if (config.isProd) app.set('trust proxy', 1);
  app.use(helmet());
  // CORS: the browser's Origin header never includes a path, so compare
  // origins (scheme + host + port) instead of full URLs. CLIENT_URL may
  // carry a subpath like /human-court — strip it for the comparison.
  // Requests with no Origin (curl, native mobile apps) are allowed through.
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        try {
          const allowed = new URL(config.clientUrl).origin;
          if (new URL(origin).origin === allowed) return callback(null, true);
        } catch {
          // malformed URL — fall through to rejection below
        }
        return callback(new Error('CORS: origin not allowed'));
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(requestLog);

  const auth = createAuth({
    repo,
    jwtSecret: config.jwtSecret,
    isProd: config.isProd,
    cookieSameSite: config.cookieSameSite,
  });
  const mailer = createMailer(config);

  const keyByUser = (req) => (req.user && req.user.id ? req.user.id : req.ip);
  // Standard practice: rate limiting is a production safeguard, not test
  // behavior. When NODE_ENV=test we bypass the incidental limiters (global
  // API, auth, upload, review) so suites can make many requests from one IP
  // without flaky 429s. The per-user assessment limiter stays active even in
  // tests because the 10-assessments/hour ceiling is explicit product
  // behavior with its own dedicated test (tests/assessments.test.js).
  const testEnv = config.nodeEnv === 'test';
  const passThrough = (_req, _res, next) => next();
  const limiters = {
    apiLimiter: testEnv ? passThrough : rateLimit({ windowMs: 60_000, max: 100, standardHeaders: 'draft-7', legacyHeaders: false, handler: rateLimitHandler }),
    authLimiter: testEnv ? passThrough : rateLimit({ windowMs: 60_000, max: config.rateLimits.authMax, standardHeaders: 'draft-7', legacyHeaders: false, handler: rateLimitHandler }),
    assessmentLimiter: rateLimit({ windowMs: 60 * 60_000, max: 10, keyGenerator: keyByUser, standardHeaders: 'draft-7', legacyHeaders: false, handler: rateLimitHandler }),
    uploadLimiter: testEnv ? passThrough : rateLimit({ windowMs: 60 * 60_000, max: 20, keyGenerator: keyByUser, standardHeaders: 'draft-7', legacyHeaders: false, handler: rateLimitHandler }),
    reviewLimiter: testEnv ? passThrough : rateLimit({ windowMs: 60 * 60_000, max: 20, keyGenerator: keyByUser, standardHeaders: 'draft-7', legacyHeaders: false, handler: rateLimitHandler }),
    chatLimiter: testEnv ? passThrough : rateLimit({ windowMs: 60 * 60_000, max: 30, keyGenerator: keyByUser, standardHeaders: 'draft-7', legacyHeaders: false, handler: rateLimitHandler }),
  };

  const ctx = { repo, config, auth, mailer, storeName, uploadDir: config.uploadDir, limiters };

  app.use('/api', limiters.apiLimiter);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, store: storeName, ai: aiMode(config) });
  });

  app.use('/api/auth', createAuthRouter(ctx));
  app.use('/api/users', createUsersRouter(ctx));
  app.use('/api/cases', createCasesRouter(ctx));
  app.use('/api/cases', createEvidenceRouter(ctx));
  app.use('/api/cases', createAssessmentsRouter(ctx));

  const reviews = createReviewsRouter(ctx);
  app.use('/api/cases', reviews.caseRouter);
  app.use('/api/invitations', reviews.inviteRouter);
  app.use('/api/reviews', reviews.reviewRouter);

  const sharing = createSharingRouter(ctx);
  app.use('/api/cases', sharing.caseRouter);
  app.use('/api/shared', sharing.publicRouter);

  app.use('/api/notifications', createNotificationsRouter(ctx));

  app.use('/api/chat', createChatRouter(ctx));

  // Single-origin production serving. When the frontend has been built
  // (`npm run build` produces <repo>/dist), serve it from the same origin
  // as the API so auth cookies stay first-party — no CORS changes needed.
  // In dev/test there is no dist/, so nothing changes there.
  const clientDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'dist');
  if (fs.existsSync(clientDir)) {
    console.log(`[static] serving client from ${clientDir}`);
    app.use(express.static(clientDir, { maxAge: '1h', index: false }));
    // SPA fallback for every non-API GET (e.g. /cases/123 reloads).
    // Paths that look like files (have an extension) keep the JSON 404
    // below — in particular, uploaded evidence must never be reachable
    // directly (see server/tests/evidence.test.js).
    app.get(/^\/(?!api([/?#]|$)).*$/, (req, res, next) => {
      if (path.extname(req.path)) return next();
      res.sendFile(path.join(clientDir, 'index.html'));
    });
  }

  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'not_found', message: 'Not found.' } });
  });
  app.use(errorHandler);

  return app;
}
