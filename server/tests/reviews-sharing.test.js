// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestApp,
  registerAndLogin,
  createCase,
  makeReadyForAnalysis,
  waitForAssessment,
  HEADPHONE_CASE,
} from './helpers.js';

let app;
let alice;
let bob;
let caseId;

async function readyCaseWithAssessment(agent, payload = HEADPHONE_CASE) {
  const c = await createCase(agent, payload);
  await makeReadyForAnalysis(agent, c.id);
  const started = await agent.post(`/api/cases/${c.id}/assessments`).send({});
  await waitForAssessment(agent, c.id, started.body.id);
  return c.id;
}

beforeAll(async () => {
  app = await createTestApp();
  alice = app.agentFor();
  bob = app.agentFor();
  await registerAndLogin(alice, { name: 'Alice', email: 'alice@example.com' });
  await registerAndLogin(bob, { name: 'Bob', email: 'bob@example.com' });
  caseId = await readyCaseWithAssessment(alice);
});

afterAll(() => {
  app.cleanup();
});

describe('human review', () => {
  let inviteToken;

  it('owner creates an invitation; token shown once, hash stored', async () => {
    const res = await alice.post(`/api/cases/${caseId}/invitations`).send({ note: 'Please review' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.expiresAt).toBeTruthy();
    inviteToken = res.body.token;

    const stored = (await app.repo.listInvitationsByCase(caseId))[0];
    expect(stored.tokenHash).toBeTruthy();
    expect(stored.tokenHash).not.toBe(inviteToken);

    // Case moved into awaiting-human-review on first invitation.
    const detail = await alice.get(`/api/cases/${caseId}`);
    expect(detail.body.case.status).toBe('awaiting-human-review');
  });

  it('invitee accepts with the token while logged in', async () => {
    const res = await bob.post(`/api/invitations/${inviteToken}/accept`).send({});
    expect(res.status).toBe(200);
    expect(res.body.invitation.status).toBe('accepted');
  });

  it('rejects bogus tokens', async () => {
    const res = await bob.post('/api/invitations/bogus-token/accept').send({});
    expect(res.status).toBe(404);
  });

  it('invitee can now view the case and submits one review', async () => {
    const view = await bob.get(`/api/cases/${caseId}`);
    expect(view.status).toBe(200);
    // Viewer flags: accepted invitee can review, is not the owner.
    expect(view.body.viewer).toMatchObject({ isOwner: false, canReview: true });

    const review = await bob.post(`/api/cases/${caseId}/reviews`).send({
      opinion: 'insufficient_evidence',
      reasoning: 'Neither side has documentation of the prior condition.',
    });
    expect(review.status).toBe(201);
    expect(review.body.review.opinion).toBe('insufficient_evidence');

    const detail = await alice.get(`/api/cases/${caseId}`);
    expect(detail.body.case.status).toBe('review-completed');
  });

  it('rejects duplicate reviews with 409', async () => {
    const res = await bob.post(`/api/cases/${caseId}/reviews`).send({
      opinion: 'leans_a',
      reasoning: 'Second try.',
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('duplicate_review');
  });

  it('rejects invalid opinions', async () => {
    const third = app.agentFor();
    await registerAndLogin(third, { name: 'Cara', email: 'cara@example.com' });
    const inv = await alice.post(`/api/cases/${caseId}/invitations`).send({});
    await third.post(`/api/invitations/${inv.body.token}/accept`).send({});
    const res = await third.post(`/api/cases/${caseId}/reviews`).send({ opinion: 'definitely_a', reasoning: 'x' });
    expect(res.status).toBe(400);
  });

  it('non-invitees cannot review an invite-only case', async () => {
    const stranger = app.agentFor();
    await registerAndLogin(stranger, { name: 'Zed', email: 'zed@example.com' });
    const res = await stranger.post(`/api/cases/${caseId}/reviews`).send({
      opinion: 'no_clear_lean',
      reasoning: 'I was not invited.',
    });
    expect(res.status).toBe(404); // cannot even see the case
  });

  it('aggregate returns distribution, themes, and the disclaimer', async () => {
    const res = await alice.get(`/api/cases/${caseId}/reviews/aggregate`);
    expect(res.status).toBe(200);
    expect(res.body.count).toBeGreaterThanOrEqual(1);
    expect(res.body.distribution.insufficient_evidence).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(res.body.themes)).toBe(true);
    expect(res.body.disclaimer).toMatch(/not representative of the public/);
  });

  it('reports a review', async () => {
    const list = await alice.get(`/api/cases/${caseId}/reviews`);
    const reviewId = list.body.items[0].id;
    const res = await alice.post(`/api/reviews/${reviewId}/report`).send({ reason: 'Inappropriate' });
    expect(res.status).toBe(200);
  });

  it('notifies the owner when a review is submitted', async () => {
    const notifs = await alice.get('/api/notifications');
    expect(notifs.body.items.some((n) => n.type === 'review_submitted')).toBe(true);
  });
});

describe('sharing', () => {
  let token;

  it('creates a share link; returns token shown once', async () => {
    const res = await alice.post(`/api/cases/${caseId}/share`).send({ includeTitle: true });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.url).toBe(`/s/${res.body.token}`);
    token = res.body.token;
  });

  it('public endpoint returns a redacted payload with no auth', async () => {
    const anon = app.agentFor();
    const res = await anon.get(`/api/shared/${token}`);
    expect(res.status).toBe(200);
    expect(res.body.brand).toBe('Human Court');
    expect(res.body.title).toBeTruthy();
    expect(res.body.outcomeCategory).toBe('insufficient_evidence');
    expect(res.body.summary).toBeTruthy();
    expect(res.body.assessmentDate).toBeTruthy();
    const text = JSON.stringify(res.body);
    expect(text).not.toMatch(/undamaged before lending/);
    expect(text).not.toMatch(/alice@example\.com/);
  });

  it('revocation makes the old token 404', async () => {
    const revoke = await alice.delete(`/api/cases/${caseId}/share`);
    expect(revoke.status).toBe(200);
    const anon = app.agentFor();
    const res = await anon.get(`/api/shared/${token}`);
    expect(res.status).toBe(404);
  });

  it('refuses to share a case with no completed assessment', async () => {
    const c = await createCase(alice, { title: 'Unassessed', summary: 's', category: 'Friendship' });
    const res = await alice.post(`/api/cases/${c.id}/share`).send({});
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('no_assessment');
  });
});
