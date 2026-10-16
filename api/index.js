/**
 * Vercel serverless entry point for the Human Court Express API.
 *
 * Uses dynamic imports inside the handler so that any initialization
 * failure (missing env, DB down, import error) returns a proper JSON
 * 503 instead of FUNCTION_INVOCATION_FAILED.
 *
 * The Mongoose connection is cached on `globalThis` so warm invocations
 * reuse it instead of reconnecting (standard serverless pattern).
 */
const GLOBAL_KEY = '__humancourt_serverless__';

async function getServerlessApp() {
  if (!globalThis[GLOBAL_KEY]) {
    globalThis[GLOBAL_KEY] = (async () => {
      try {
        const { getConfig } = await import('../server/src/config/env.js');
        const { createRepository } = await import('../server/src/db/repository.js');
        const { buildApp } = await import('../server/src/app.js');
        const config = getConfig();
        if (!config.mongoUri) {
          throw new Error('MONGO_URI is not set — the serverless API needs MongoDB.');
        }
        const { storeName, repo } = await createRepository(config);
        console.log(`[serverless] ready — store=${storeName}`);
        return buildApp({ repo, storeName, config });
      } catch (err) {
        globalThis[GLOBAL_KEY] = null;
        throw err;
      }
    })();
  }
  return globalThis[GLOBAL_KEY];
}

/** Vercel entry: (req, res) -> ensure app+DB -> Express app. */
export default async function vercelHandler(req, res) {
  let app;
  try {
    app = await getServerlessApp();
  } catch (err) {
    console.error('[serverless] init failed:', err && err.message);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: {
        code: 'db_unavailable',
        message: 'Database unavailable.',
        detail: String((err && err.message) || err).slice(0, 200),
      },
    }));
    return;
  }
  return app(req, res);
}

// TEMPORARY DEBUG: expose real error messages (remove before going fully live)
const _origHandler = null;
