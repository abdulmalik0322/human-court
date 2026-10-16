// Store selection. MongoDB activates automatically when MONGO_URI is set;
// otherwise the zero-config JSON store is used. Secrets are NEVER logged.
import mongoose from 'mongoose';
import { makeJsonRepository } from './jsonStore.js';
import { makeMongooseRepository } from './mongooseStore.js';

export async function initDatabase(config) {
  if (config.mongoUri) {
    await mongoose.connect(config.mongoUri);
    // Log only that a URI was provided — never the URI itself.
    console.log('[db] store=mongodb (MONGO_URI is set)');
    return {
      storeName: 'mongodb',
      repo: makeMongooseRepository(),
      close: () => mongoose.disconnect(),
    };
  }
  console.log(`[db] store=json (data dir: ${config.dataDir})`);
  return {
    storeName: 'json',
    repo: makeJsonRepository(config.dataDir),
    close: async () => {},
  };
}
