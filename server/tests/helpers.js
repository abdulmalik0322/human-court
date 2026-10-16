// Shared test setup: builds the Express app against a JSON store in a
// temp dir. Each test file gets its own isolated app + data.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';

export async function createTestApp() {
  const dataDir = mkdtempSync(join(tmpdir(), 'hc-test-data-'));
  const uploadDir = mkdtempSync(join(tmpdir(), 'hc-test-uploads-'));

  const { getConfig } = await import('../src/config/env.js');
  const base = getConfig();
  const config = {
    ...base,
    dataDir,
    uploadDir,
    jwtSecret: 'test-secret-key-do-not-use-in-prod',
    clientUrl: 'http://localhost',
    isProd: false,
    nodeEnv: 'test',
    // Note: rate limiting is bypassed for NODE_ENV=test inside buildApp
    // (see src/app.js), so no per-test limit overrides are needed here.
  };
  const { makeJsonRepository } = await import('../src/db/jsonStore.js');
  const repo = makeJsonRepository(dataDir);
  const { buildApp } = await import('../src/app.js');
  const app = buildApp({ repo, storeName: 'json', config });

  return {
    app,
    repo,
    config,
    dataDir,
    uploadDir,
    agentFor: () => request.agent(app),
    cleanup() {
      rmSync(dataDir, { recursive: true, force: true });
      rmSync(uploadDir, { recursive: true, force: true });
    },
  };
}

export async function registerAndLogin(agent, { name = 'Test User', email, password = 'password123' }) {
  const reg = await agent.post('/api/auth/register').send({ name, email, password });
  if (reg.status !== 201) throw new Error(`register failed: ${reg.status} ${JSON.stringify(reg.body)}`);
  const login = await agent.post('/api/auth/login').send({ email, password });
  if (login.status !== 200) throw new Error(`login failed: ${login.status} ${JSON.stringify(login.body)}`);
  return login.body.user;
}

export async function createCase(agent, overrides = {}) {
  const res = await agent.post('/api/cases').send({
    title: 'Test case',
    summary: 'A summary of the dispute for testing.',
    category: 'Friendship',
    ...overrides,
  });
  if (res.status !== 201) throw new Error(`createCase failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.case;
}

// Move a draft case to ready-for-analysis through the transition table.
export async function makeReadyForAnalysis(agent, caseId) {
  for (const to of ['submitted', 'awaiting-evidence', 'ready-for-analysis']) {
    const res = await agent.post(`/api/cases/${caseId}/transition`).send({ to });
    if (res.status !== 200) throw new Error(`transition to ${to} failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
}

// Poll an assessment until it leaves 'pending' (or the timeout hits).
export async function waitForAssessment(agent, caseId, assessmentId, timeoutMs = 15000) {
  const start = Date.now();
  for (;;) {
    const res = await agent.get(`/api/cases/${caseId}/assessments/${assessmentId}`);
    if (res.status !== 200) throw new Error(`get assessment failed: ${res.status}`);
    const status = res.body.assessment.status;
    if (status !== 'pending') return res.body.assessment;
    if (Date.now() - start > timeoutMs) throw new Error('timed out waiting for assessment to complete');
    await new Promise((r) => setTimeout(r, 100));
  }
}

export const HEADPHONE_CASE = {
  title: 'Borrowed headphones',
  summary: 'A lent B wireless headphones for a week. They came back with a cracked headband.',
  situation: 'A lent the headphones for a week. They were returned with a cracked headband.',
  category: 'Friendship',
  personA: {
    name: 'Person A',
    statement: 'I lent B my headphones. The headphones were undamaged before lending.',
    claims: ['The headphones were undamaged before lending.'],
  },
  personB: {
    name: 'Person B',
    statement: 'I borrowed the headphones. The headphones were already damaged when I received them.',
    claims: ['The headphones were already damaged before I borrowed them.'],
  },
  desiredOutcome: 'Decide who should pay for the repair.',
};
