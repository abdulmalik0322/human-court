/**
 * Vercel serverless entry point for the Human Court Express API.
 *
 * Vercel's Node.js runtime invokes the default export as `(req, res)` with
 * plain Node http objects — so the Express app (itself a valid
 * `(req, res)` listener) is called directly after ensuring the database
 * is connected.
 *
 * The Mongoose connection is cached on `globalThis` so warm invocations
 * reuse it instead of reconnecting (standard serverless pattern). A failed
 * attempt clears the cache so the next invocation retries.
 *
 * File uploads: there is no persistent disk on Vercel, so when the MongoDB
 * store is active the evidence controller keeps file bytes in the document
 * (see server/src/controllers/evidence.js `useBinaryStore`).
 */
import { getConfig } from '../server/src/config/env.js';
import { createRepository } from '../server/src/db/repository.js';
import { buildApp } from '../server/src/app.js';

const GLOBAL_KEY = '__humancourt_serverless__';

async function getServerlessApp() {
  if (!globalThis[GLOBAL_KEY]) {
    globalThis[GLOBAL_KEY] = (async () => {
      try {
        const config = getConfig();
        if (!config.mongoUri) {
          throw new Error('MONGO_URI is not set — the serverless API needs MongoDB.');
        }
        // initDatabase connects Mongoose (cached by Mongoose itself on warm
        // containers) and returns the repository.
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
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: { code: 'db_unavailable', message: 'Database unavailable.' } }));
    return;
  }
  return app(req, res);
}
