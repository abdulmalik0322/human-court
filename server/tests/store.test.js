// @vitest-environment node
// Repository conformance: both stores expose the full interface, and the
// JSON store round-trips records correctly. (The MongoDB store needs a
// live database, so only its interface shape is checked here.)
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeJsonRepository } from '../src/db/jsonStore.js';
import { makeMongooseRepository } from '../src/db/mongooseStore.js';
import { REPOSITORY_METHODS } from '../src/db/repository.js';

let dir;
let repo;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'hc-store-test-'));
  repo = makeJsonRepository(dir);
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('repository interface', () => {
  it('jsonStore implements every interface method', () => {
    for (const m of REPOSITORY_METHODS) {
      expect(typeof repo[m], m).toBe('function');
    }
  });

  it('mongooseStore exposes every interface method without a connection', () => {
    const mongo = makeMongooseRepository();
    for (const m of REPOSITORY_METHODS) {
      expect(typeof mongo[m], m).toBe('function');
    }
  });

  it('round-trips a user and a case', async () => {
    const user = await repo.createUser({ name: 'U', email: 'u@example.com', passwordHash: 'h' });
    expect(user.id).toBeTruthy();
    expect(user.createdAt).toBeTruthy();
    expect((await repo.getUserByEmail('U@EXAMPLE.COM')).id).toBe(user.id);

    const c = await repo.createCase({ ownerId: user.id, title: 'T', summary: 'S', category: 'Friendship', status: 'draft' });
    const { items, total } = await repo.listCasesByOwner(user.id, { q: 't', sort: 'newest', skip: 0, limit: 10 });
    expect(total).toBe(1);
    expect(items[0].id).toBe(c.id);

    const updated = await repo.updateCase(c.id, { title: 'T2' });
    expect(updated.title).toBe('T2');
    expect(updated.updatedAt >= c.updatedAt).toBe(true);
  });

  it('persists across repository instances (same dir)', async () => {
    const repo2 = makeJsonRepository(dir);
    const found = await repo2.getUserByEmail('u@example.com');
    expect(found).toBeTruthy();
  });
});
