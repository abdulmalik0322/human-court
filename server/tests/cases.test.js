// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, registerAndLogin, createCase } from './helpers.js';

let app;
let alice;
let bob;
let aliceCase;

beforeAll(async () => {
  app = await createTestApp();
  alice = app.agentFor();
  bob = app.agentFor();
  await registerAndLogin(alice, { name: 'Alice', email: 'alice@example.com' });
  await registerAndLogin(bob, { name: 'Bob', email: 'bob@example.com' });
  aliceCase = await createCase(alice, { title: "Alice's private case" });
});

afterAll(() => {
  app.cleanup();
});

describe('cases', () => {
  it('validates case creation input', async () => {
    const noTitle = await alice.post('/api/cases').send({ summary: 's', category: 'Friendship' });
    expect(noTitle.status).toBe(400);
    const badCat = await alice.post('/api/cases').send({ title: 't', summary: 's', category: 'Nope' });
    expect(badCat.status).toBe(400);
    const badPrivacy = await alice.post('/api/cases').send({
      title: 't', summary: 's', category: 'Friendship', privacy: 'everyone',
    });
    expect(badPrivacy.status).toBe(400);
  });

  it('creates a draft case with the frontend caseStore shape', async () => {
    expect(aliceCase.status).toBe('draft');
    expect(aliceCase.privacy).toBe('private');
    expect(aliceCase.reviewAudience).toBe('invite-only');
    expect(Array.isArray(aliceCase.timeline)).toBe(true);
    expect(aliceCase.ownerId).toBeTruthy();
  });

  it('supports idempotency keys — repeat returns the existing case', async () => {
    const first = await alice.post('/api/cases').send({
      title: 'Idempotent', summary: 's', category: 'Friendship', idempotencyKey: 'key-123',
    });
    expect(first.status).toBe(201);
    const second = await alice.post('/api/cases').send({
      title: 'Idempotent', summary: 's', category: 'Friendship', idempotencyKey: 'key-123',
    });
    expect(second.status).toBe(200);
    expect(second.body.deduped).toBe(true);
    expect(second.body.case.id).toBe(first.body.case.id);
  });

  it('lists with filters, search, sort, and validated pagination', async () => {
    await createCase(alice, { title: 'Zebra dispute', category: 'Family' });
    const res = await alice.get('/api/cases').query({ q: 'zebra', sort: 'newest', page: 1, pageSize: 10 });
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    expect(res.body.items[0].title).toMatch(/zebra/i);
    expect(res.body.page).toBe(1);
    expect(res.body.totalPages).toBeGreaterThanOrEqual(1);

    const cat = await alice.get('/api/cases').query({ category: 'Family' });
    expect(cat.body.items.every((i) => i.category === 'Family')).toBe(true);

    const badPage = await alice.get('/api/cases').query({ pageSize: 500 });
    expect(badPage.body.pageSize).toBeLessThanOrEqual(50);

    const badSort = await alice.get('/api/cases').query({ sort: 'random' });
    expect(badSort.status).toBe(400);
  });

  it('lets the owner read, update (draft only), submit, and delete', async () => {
    const c = await createCase(alice, { title: 'Lifecycle case' });
    const get = await alice.get(`/api/cases/${c.id}`);
    expect(get.status).toBe(200);
    expect(get.body.case.id).toBe(c.id);
    expect(Array.isArray(get.body.evidence)).toBe(true);
    // Viewer flags: owner cannot review their own case.
    expect(get.body.viewer).toMatchObject({ isOwner: true, canReview: false });

    const patch = await alice.patch(`/api/cases/${c.id}`).send({ title: 'Renamed case' });
    expect(patch.status).toBe(200);
    expect(patch.body.case.title).toBe('Renamed case');

    const submit = await alice.post(`/api/cases/${c.id}/submit`);
    expect(submit.status).toBe(200);
    expect(submit.body.case.status).toBe('submitted');

    const patchAfter = await alice.patch(`/api/cases/${c.id}`).send({ title: 'Nope' });
    expect(patchAfter.status).toBe(409);
    expect(patchAfter.body.error.code).toBe('not_draft');

    const del = await alice.delete(`/api/cases/${c.id}`);
    expect(del.status).toBe(200);
    const gone = await alice.get(`/api/cases/${c.id}`);
    expect(gone.status).toBe(404);
  });

  it('rejects invalid status transitions with 409', async () => {
    const c = await createCase(alice, { title: 'Transition case 2' });
    const bad = await alice.post(`/api/cases/${c.id}/transition`).send({ to: 'ready-for-analysis' });
    expect(bad.status).toBe(409);
    expect(bad.body.error.code).toBe('invalid_transition');

    const unknown = await alice.post(`/api/cases/${c.id}/transition`).send({ to: 'flying' });
    expect(unknown.status).toBe(400);

    // Valid path works step by step.
    for (const to of ['submitted', 'awaiting-evidence', 'ready-for-analysis']) {
      const r = await alice.post(`/api/cases/${c.id}/transition`).send({ to });
      expect(r.status).toBe(200);
      expect(r.body.case.status).toBe(to);
    }
  });

  it('appeal records reason and moves assessment-available -> appealed', async () => {
    const c = await createCase(alice, { title: 'Appeal case' });
    for (const to of ['submitted', 'awaiting-evidence', 'ready-for-analysis']) {
      await alice.post(`/api/cases/${c.id}/transition`).send({ to });
    }
    // Appeal requires assessment-available; from ready-for-analysis it must fail.
    const early = await alice.post(`/api/cases/${c.id}/appeal`).send({ reason: 'too early' });
    expect(early.status).toBe(409);

    // Simulate the assessment having run: move through analysis states.
    await alice.post(`/api/cases/${c.id}/transition`).send({ to: 'analysis-in-progress' });
    await alice.post(`/api/cases/${c.id}/transition`).send({ to: 'assessment-available' });
    const appeal = await alice.post(`/api/cases/${c.id}/appeal`).send({ reason: 'Missed context', newInfo: 'More info' });
    expect(appeal.status).toBe(200);
    expect(appeal.body.case.status).toBe('appealed');
    expect(appeal.body.case.appeal.reason).toBe('Missed context');
    expect(appeal.body.case.appeal.status).toBe('open');
  });

  describe('ownership (change-the-ID attacks -> 404)', () => {
    it("Bob cannot read Alice's private case", async () => {
      const res = await bob.get(`/api/cases/${aliceCase.id}`);
      expect(res.status).toBe(404);
    });

    it("Bob cannot update Alice's private case", async () => {
      const res = await bob.patch(`/api/cases/${aliceCase.id}`).send({ title: 'Hacked' });
      expect(res.status).toBe(404);
    });

    it("Bob cannot delete Alice's private case", async () => {
      const res = await bob.delete(`/api/cases/${aliceCase.id}`);
      expect(res.status).toBe(404);
    });

    it("Bob cannot submit Alice's private case", async () => {
      const res = await bob.post(`/api/cases/${aliceCase.id}/submit`);
      expect(res.status).toBe(404);
    });

    it("Bob cannot start an assessment on Alice's private case", async () => {
      await alice.post(`/api/cases/${aliceCase.id}/transition`).send({ to: 'submitted' });
      await alice.post(`/api/cases/${aliceCase.id}/transition`).send({ to: 'awaiting-evidence' });
      await alice.post(`/api/cases/${aliceCase.id}/transition`).send({ to: 'ready-for-analysis' });
      const res = await bob.post(`/api/cases/${aliceCase.id}/assessments`).send({});
      expect(res.status).toBe(404);
    });

    it("Bob cannot upload evidence to Alice's private case", async () => {
      const res = await bob
        .post(`/api/cases/${aliceCase.id}/evidence`)
        .attach('file', Buffer.from('hello'), 'note.txt');
      expect(res.status).toBe(404);
    });
  });
});
