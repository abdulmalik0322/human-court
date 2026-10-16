// @vitest-environment node
// Chat endpoint: the no-key path must honestly report unavailable
// (never fake replies); the keyed path is tested with a mocked LLM.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { createTestApp, registerAndLogin } from './helpers.js';

describe('AI chat without key', () => {
  let app;
  let alice;

  beforeAll(async () => {
    app = await createTestApp();
    alice = app.agentFor();
    await registerAndLogin(alice, { name: 'Alice', email: 'alice@example.com' });
  });

  afterAll(() => {
    app.cleanup();
  });

  it('reports unavailable honestly when no AI key is configured', async () => {
    const res = await alice.post('/api/chat/messages').send({ message: 'Hello' });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('ai_not_configured');
  });

  it('status endpoint reflects availability', async () => {
    const res = await alice.get('/api/chat/status');
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
  });

  it('requires auth', async () => {
    const res = await request(app.app).post('/api/chat/messages').send({ message: 'hi' });
    expect(res.status).toBe(401);
  });
});

describe('AI chat with key (mocked LLM)', () => {
  let testApp;
  let alice;

  beforeAll(async () => {
    const { getConfig } = await import('../src/config/env.js');
    const { makeJsonRepository } = await import('../src/db/jsonStore.js');
    const { buildApp } = await import('../src/app.js');
    const dataDir = mkdtempSync(join(tmpdir(), 'hc-test-chat-'));
    const uploadDir = mkdtempSync(join(tmpdir(), 'hc-test-chat-up-'));
    const config = {
      ...getConfig(),
      dataDir,
      uploadDir,
      jwtSecret: 'test-secret-key-do-not-use-in-prod',
      clientUrl: 'http://localhost',
      isProd: false,
      nodeEnv: 'test',
      aiApiKey: 'test-key',
      aiBaseUrl: 'https://llm.example.com/v1',
      aiModel: 'test-model',
    };
    const repo = makeJsonRepository(dataDir);
    const expressApp = buildApp({ repo, storeName: 'json', config });
    testApp = {
      app: expressApp,
      cleanup: () => {
        rmSync(dataDir, { recursive: true, force: true });
        rmSync(uploadDir, { recursive: true, force: true });
      },
    };
    alice = request.agent(expressApp);
    await registerAndLogin(alice, { name: 'Alice', email: 'alice@example.com' });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({ choices: [{ message: { content: 'Hello! I can help with Human Court questions.' } }] }),
        ),
      ),
    );
  });

  afterAll(() => {
    vi.unstubAllGlobals();
    testApp.cleanup();
  });

  it('returns the LLM reply with history', async () => {
    const res = await alice.post('/api/chat/messages').send({
      message: 'How do I create a case?',
      history: [
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello!' },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.reply).toContain('Human Court');
    expect(res.body.model).toBe('test-model');
  });

  it('rejects empty and overlong messages', async () => {
    const empty = await alice.post('/api/chat/messages').send({ message: '  ' });
    expect(empty.status).toBe(400);
    const long = await alice.post('/api/chat/messages').send({ message: 'x'.repeat(2001) });
    expect(long.status).toBe(400);
  });
});
