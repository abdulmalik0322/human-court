// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import {
  createTestApp,
  registerAndLogin,
  createCase,
  makeReadyForAnalysis,
  waitForAssessment,
  HEADPHONE_CASE,
} from './helpers.js';
import { validateAssessment } from '../src/services/assessment/schema.js';
import { analyzeLocal } from '../src/services/assessment/localEngine.js';
import { assessWithLlm } from '../src/services/assessment/llmProvider.js';

let app;
let alice;

beforeAll(async () => {
  app = await createTestApp();
  alice = app.agentFor();
  await registerAndLogin(alice, { name: 'Alice', email: 'alice@example.com' });
});

afterAll(() => {
  app.cleanup();
  vi.unstubAllGlobals();
});

function validLlmPayload() {
  const section = (text) => [{ text }];
  return {
    neutralSummary: 'A neutral summary of the dispute.',
    personAClaims: section('A claim'),
    personBClaims: section('B claim'),
    areasOfAgreement: [],
    pointsOfDisagreement: section('A disagreement'),
    supportedByEvidence: [],
    unverifiedClaims: section('Unverified'),
    missingInformation: ['Dates — not specified.'],
    alternativeExplanations: ['Memory may be incomplete.'],
    reasoning: ['Read the statements.'],
    clarifyingQuestions: ['Any dated photo?'],
    nextSteps: ['Write timelines.'],
    limitations: ['Not legal advice.'],
    overallAssessment: 'Overall assessment text.',
    decision: 'No fair recommendation is possible yet — there is not enough material to decide between the accounts.',
    outcomeCategory: 'insufficient_evidence',
  };
}

describe('localEngine on the headphone dispute', () => {
  it("returns 'insufficient_evidence' when A and B conflict with no evidence", () => {
    const result = analyzeLocal(HEADPHONE_CASE, []);
    expect(result.outcomeCategory).toBe('insufficient_evidence');
    expect(result.engine).toBe('local-heuristic');
  });

  it('output validates against schema.js', () => {
    const result = analyzeLocal(HEADPHONE_CASE, []);
    const { valid, errors } = validateAssessment(result);
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('quotes only exact substrings from the user text', () => {
    const result = analyzeLocal(HEADPHONE_CASE, []);
    const corpus = [
      HEADPHONE_CASE.summary,
      HEADPHONE_CASE.situation,
      HEADPHONE_CASE.personA.statement,
      HEADPHONE_CASE.personB.statement,
      ...HEADPHONE_CASE.personA.claims,
      ...HEADPHONE_CASE.personB.claims,
    ].join('\n');
    for (const section of ['areasOfAgreement', 'pointsOfDisagreement']) {
      for (const item of result[section]) {
        for (const key of ['aSays', 'bSays']) {
          if (item[key]) expect(corpus).toContain(item[key]);
        }
      }
    }
  });

  it('never claims lie detection or numeric truthfulness', () => {
    const result = analyzeLocal(HEADPHONE_CASE, []);
    const text = JSON.stringify(result).toLowerCase();
    // Claims *of* lie detection — not the honest "does not detect" disclaimers.
    expect(text).not.toMatch(/\b(lying|lied|liar|liars)\b/);
    expect(text).not.toMatch(/deception (was|has been|is) detected/);
    // Positive verdicts ("X is telling the truth") — the honest disclaimer
    // "cannot verify who is telling the truth" must not trip this.
    expect(text).not.toMatch(/(?<!who )(is|was|are|were) telling the truth/);
    expect(text).not.toMatch(/\d+%\s*(certain|likely|truth)/);
    // And it does carry the honest disclaimer.
    expect(text).toContain('does not detect deception');
  });

  it('always appends the authenticity note', () => {
    const result = analyzeLocal(HEADPHONE_CASE, []);
    const text = JSON.stringify(result);
    expect(text).toContain('Authenticity of uploaded files cannot be independently verified');
  });

  it('leans_a when only A has evidence support', () => {
    const result = analyzeLocal(HEADPHONE_CASE, [
      { originalName: 'photo.jpg', description: 'Photo showing the headphones were undamaged before lending, timestamped.' },
    ]);
    expect(result.outcomeCategory).toBe('leans_a');
    expect(validateAssessment(result).valid).toBe(true);
  });
});

describe('assessment API flow', () => {
  it('runs async: 202 pending -> complete, case -> assessment-available, notification sent', async () => {
    const c = await createCase(alice, HEADPHONE_CASE);
    await makeReadyForAnalysis(alice, c.id);

    const started = await alice.post(`/api/cases/${c.id}/assessments`).send({});
    expect(started.status).toBe(202);
    expect(started.body.status).toBe('pending');
    expect(started.body.version).toBe(1);

    const done = await waitForAssessment(alice, c.id, started.body.id);
    expect(done.status).toBe('complete');
    expect(done.outcomeCategory).toBe('insufficient_evidence');
    expect(typeof done.sections.decision).toBe('string');
    expect(done.sections.decision.length).toBeGreaterThan(50);
    expect(validateAssessment({ ...done.sections, outcomeCategory: done.outcomeCategory, engine: done.engine, model: done.model, createdAt: done.createdAt }).valid).toBe(true);

    const detail = await alice.get(`/api/cases/${c.id}`);
    expect(detail.body.case.status).toBe('assessment-available');

    const notifs = await alice.get('/api/notifications');
    expect(notifs.body.items.some((n) => n.type === 'assessment_complete')).toBe(true);
  });

  it('rejects assessments from a wrong status with 409', async () => {
    const c = await createCase(alice, { title: 'Draft case', summary: 's', category: 'Friendship' });
    const res = await alice.post(`/api/cases/${c.id}/assessments`).send({});
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('invalid_case_status');
  });

  it('auto-advances a submitted case so one click starts the assessment', async () => {
    const c = await createCase(alice, HEADPHONE_CASE);
    await alice.post(`/api/cases/${c.id}/submit`);
    const started = await alice.post(`/api/cases/${c.id}/assessments`).send({});
    expect(started.status).toBe(202);
    const done = await waitForAssessment(alice, c.id, started.body.id);
    expect(done.status).toBe('complete');
    expect(typeof done.sections.decision).toBe('string');
    const detail = await alice.get(`/api/cases/${c.id}`);
    expect(detail.body.case.status).toBe('assessment-available');
  });

  it('keeps history append-only across reassessments', async () => {
    const c = await createCase(alice, HEADPHONE_CASE);
    await makeReadyForAnalysis(alice, c.id);
    const first = await alice.post(`/api/cases/${c.id}/assessments`).send({});
    await waitForAssessment(alice, c.id, first.body.id);

    // Reassessment without reason -> 409.
    await alice.post(`/api/cases/${c.id}/appeal`).send({ reason: 'Missed context' });
    const noReason = await alice.post(`/api/cases/${c.id}/assessments`).send({});
    expect(noReason.status).toBe(409);
    expect(noReason.body.error.code).toBe('reassessment_not_allowed');

    // Reason + open appeal -> allowed; case moves appealed -> ready-for-analysis -> analysis-in-progress.
    const second = await alice.post(`/api/cases/${c.id}/assessments`).send({ reason: 'New context provided' });
    expect(second.status).toBe(202);
    expect(second.body.version).toBe(2);
    const done = await waitForAssessment(alice, c.id, second.body.id);
    expect(done.status).toBe('complete');

    const history = await alice.get(`/api/cases/${c.id}/assessments`);
    expect(history.body.items).toHaveLength(2);
    expect(history.body.items[0].version).toBe(2); // newest first
    expect(history.body.items[1].version).toBe(1);

    const detail = await alice.get(`/api/cases/${c.id}`);
    expect(detail.body.case.appeal.status).toBe('addressed');
  });

  it('records assessment reports', async () => {
    const c = await createCase(alice, HEADPHONE_CASE);
    await makeReadyForAnalysis(alice, c.id);
    const started = await alice.post(`/api/cases/${c.id}/assessments`).send({});
    const done = await waitForAssessment(alice, c.id, started.body.id);
    const rep = await alice.post(`/api/cases/${c.id}/assessments/${done.id}/report`).send({ reason: 'Biased wording' });
    expect(rep.status).toBe(200);
    const got = await alice.get(`/api/cases/${c.id}/assessments/${done.id}`);
    expect(got.body.assessment.reports).toHaveLength(1);
  });
});

describe('llmProvider (mocked fetch — no real API calls)', () => {
  const config = { aiApiKey: 'test-key', aiBaseUrl: 'https://llm.example.com/v1', aiModel: 'test-model' };

  it('returns schema-valid output with engine llm', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(validLlmPayload()) } }] })),
    );
    vi.stubGlobal('fetch', fetchMock);
    try {
      const result = await assessWithLlm({ caseObj: HEADPHONE_CASE, evidenceList: [], config });
      expect(result.engine).toBe('llm');
      expect(result.model).toBe('test-model');
      expect(validateAssessment(result).valid).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toBe('https://llm.example.com/v1/chat/completions');
      expect(JSON.stringify(opts.body)).not.toContain('test-key');
      expect(opts.headers.Authorization).toBe('Bearer test-key');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('retries once on invalid JSON, then throws', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'not json{{' } }] })));
    vi.stubGlobal('fetch', fetchMock);
    try {
      await expect(assessWithLlm({ caseObj: HEADPHONE_CASE, evidenceList: [], config })).rejects.toThrow();
      expect(fetchMock).toHaveBeenCalledTimes(2); // one attempt + one retry
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('assessment rate limit (10/hour per user)', () => {
  it('returns 429 on the 11th assessment in an hour', async () => {
    // Fresh app so earlier tests in this file do not consume the quota.
    const fresh = await createTestApp();
    try {
      const agent = fresh.agentFor();
      await registerAndLogin(agent, { name: 'R', email: 'r@example.com' });
      const statuses = [];
      for (let i = 0; i < 11; i++) {
        const c = await createCase(agent, { title: `Rate case ${i}`, summary: 's', category: 'Friendship' });
        await makeReadyForAnalysis(agent, c.id);
        const res = await agent.post(`/api/cases/${c.id}/assessments`).send({});
        statuses.push(res.status);
      }
      expect(statuses.slice(0, 10).every((s) => s === 202)).toBe(true);
      expect(statuses[10]).toBe(429);
    } finally {
      fresh.cleanup();
    }
  }, 120000);
});
