// Server entry point: node src/index.js
import { mkdirSync } from 'node:fs';
import { getConfig } from './config/env.js';
import { createRepository } from './db/repository.js';
import { buildApp } from './app.js';
import { ensureUploadDir } from './services/storage.js';
import { aiMode } from './services/assessment/index.js';

const config = getConfig();
mkdirSync(config.dataDir, { recursive: true });
await ensureUploadDir(config.uploadDir);

const { storeName, repo, close } = await createRepository(config);
const app = buildApp({ repo, storeName, config });

const server = app.listen(config.port, () => {
  console.log(
    `[server] Human Court API listening on :${config.port} — store=${storeName} ai=${aiMode(config)}`,
  );
});

async function shutdown(signal) {
  console.log(`[server] ${signal} received — shutting down`);
  server.close(async () => {
    try {
      await close();
    } finally {
      process.exit(0);
    }
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
