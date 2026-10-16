// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createTestApp, registerAndLogin, createCase } from './helpers.js';

let app;
let alice;
let bob;
let caseId;

beforeAll(async () => {
  app = await createTestApp();
  alice = app.agentFor();
  bob = app.agentFor();
  await registerAndLogin(alice, { name: 'Alice', email: 'alice@example.com' });
  await registerAndLogin(bob, { name: 'Bob', email: 'bob@example.com' });
  caseId = (await createCase(alice, { title: 'Evidence case' })).id;
});

afterAll(() => {
  app.cleanup();
});

// Minimal valid PNG (1x1) — real magic bytes.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('evidence', () => {
  it('uploads a valid image and lists metadata (no file contents)', async () => {
    const res = await alice
      .post(`/api/cases/${caseId}/evidence`)
      .field('description', 'Photo of the damage')
      .attach('file', PNG, 'damage.png');
    expect(res.status).toBe(201);
    expect(res.body.evidence.name).toBe('damage.png');
    expect(res.body.evidence.mimeType).toBe('image/png');
    expect(res.body.evidence.description).toBe('Photo of the damage');
    expect(res.body.evidence.storedName).toBeUndefined();
    expect(res.body.evidence.id).toBeTruthy();

    const list = await alice.get(`/api/cases/${caseId}/evidence`);
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);
  });

  it('rejects disallowed extensions', async () => {
    const res = await alice.post(`/api/cases/${caseId}/evidence`).attach('file', Buffer.from('x'), 'evil.exe');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_file_type');
  });

  it('rejects files whose magic bytes do not match the extension', async () => {
    const res = await alice
      .post(`/api/cases/${caseId}/evidence`)
      .attach('file', Buffer.from('this is not a png at all'), 'fake.png');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_file_type');
  });

  it('rejects executables masquerading with an allowed extension', async () => {
    const mz = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(100)]);
    const res = await alice.post(`/api/cases/${caseId}/evidence`).attach('file', mz, 'run.txt');
    expect(res.status).toBe(400);
  });

  it('accepts plain text files', async () => {
    const res = await alice
      .post(`/api/cases/${caseId}/evidence`)
      .field('description', 'Chat excerpt')
      .attach('file', Buffer.from('Alice: handle them carefully'), 'chat.txt');
    expect(res.status).toBe(201);
    expect(res.body.evidence.mimeType).toBe('text/plain');
  });

  it('requires auth for downloads', async () => {
    const list = await alice.get(`/api/cases/${caseId}/evidence`);
    const evId = list.body.items[0].id;
    const anon = app.agentFor();
    const res = await anon.get(`/api/cases/${caseId}/evidence/${evId}/download`);
    expect(res.status).toBe(401);
  });

  it('streams the file to the owner with a safe filename', async () => {
    const list = await alice.get(`/api/cases/${caseId}/evidence`);
    const evId = list.body.items.find((e) => e.name === 'damage.png').id;
    const res = await alice.get(`/api/cases/${caseId}/evidence/${evId}/download`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['content-disposition']).toMatch(/attachment/);
  });

  it("does not let another user download or delete the owner's evidence", async () => {
    const list = await alice.get(`/api/cases/${caseId}/evidence`);
    const evId = list.body.items[0].id;
    const dl = await bob.get(`/api/cases/${caseId}/evidence/${evId}/download`);
    expect(dl.status).toBe(404);
    const del = await bob.delete(`/api/cases/${caseId}/evidence/${evId}`);
    expect(del.status).toBe(404);
  });

  it('deletes the record and the file from disk', async () => {
    const up = await alice.post(`/api/cases/${caseId}/evidence`).attach('file', PNG, 'todelete.png');
    const evId = up.body.evidence.id;
    const storedOnDisk = (await app.repo.listEvidenceByCase(caseId)).find((e) => e.id === evId).storedName;
    expect(existsSync(join(app.uploadDir, storedOnDisk))).toBe(true);

    const del = await alice.delete(`/api/cases/${caseId}/evidence/${evId}`);
    expect(del.status).toBe(200);
    expect(existsSync(join(app.uploadDir, storedOnDisk))).toBe(false);
  });

  it('uploaded files are never served statically', async () => {
    const up = await alice.post(`/api/cases/${caseId}/evidence`).attach('file', PNG, 'nostatic.png');
    const storedOnDisk = (await app.repo.listEvidenceByCase(caseId)).find(
      (e) => e.id === up.body.evidence.id,
    ).storedName;
    const direct = await alice.get(`/${storedOnDisk}`);
    expect(direct.status).toBe(404);
    const uploadsPath = await alice.get(`/uploads/${storedOnDisk}`);
    expect(uploadsPath.status).toBe(404);
  });
});
