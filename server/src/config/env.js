// Environment configuration. Read fresh via getConfig() (no module-level
// caching) so tests can point at temp dirs without cross-file leakage.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, '..', '..');

function str(name, def = '') {
  const v = process.env[name];
  return v === undefined || v === '' ? def : v;
}

function num(name, def) {
  const v = process.env[name];
  const n = Number(v);
  return v === undefined || v === '' || Number.isNaN(n) ? def : n;
}

export function getConfig() {
  const nodeEnv = str('NODE_ENV', 'development');
  let jwtSecret = str('JWT_SECRET', '');
  if (!jwtSecret) {
    if (nodeEnv === 'production') {
      throw new Error('JWT_SECRET must be set in production');
    }
    jwtSecret = 'dev-only-secret-change-me';
    console.warn('[config] JWT_SECRET not set — using an insecure dev default. Set JWT_SECRET for anything real.');
  }
  return {
    nodeEnv,
    isProd: nodeEnv === 'production',
    port: num('PORT', 4000),
    clientUrl: str('CLIENT_URL', 'http://localhost:5173'),
    jwtSecret,
    bcryptRounds: num('BCRYPT_ROUNDS', 12),
    // Resolved against the server directory so the default works
    // regardless of the process working directory.
    dataDir: path.resolve(str('HC_DATA_DIR', path.join(SERVER_ROOT, 'data'))),
    uploadDir: path.resolve(str('HC_UPLOAD_DIR', path.join(SERVER_ROOT, 'uploads'))),
    mongoUri: str('MONGO_URI', ''),
    // Cross-origin production (frontend on GitHub Pages, API on Vercel)
    // needs SameSite=None cookies. Set COOKIE_SAMESITE=none in production.
    cookieSameSite: str('COOKIE_SAMESITE', 'lax'),
    aiApiKey: str('AI_API_KEY', ''),
    aiBaseUrl: str('AI_BASE_URL', 'https://api.openai.com/v1').replace(/\/+$/, ''),
    aiModel: str('AI_MODEL', 'gpt-4o-mini'),
    email: {
      host: str('EMAIL_HOST', ''),
      port: num('EMAIL_PORT', 587),
      user: str('EMAIL_USER', ''),
      pass: str('EMAIL_PASS', ''),
      from: str('EMAIL_FROM', 'Human Court <no-reply@example.com>'),
    },
    // Rate-limit ceilings. The auth ceiling only matters outside tests:
    // buildApp bypasses the incidental limiters when NODE_ENV=test.
    rateLimits: {
      authMax: num('RATE_LIMIT_AUTH_MAX', 10),
    },
  };
}

export function emailConfigured(config) {
  const e = config.email;
  return Boolean(e.host && e.user && e.pass);
}
