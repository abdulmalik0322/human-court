// Tests for the demo case store (src/services/caseStore.js).
// Uses the in-memory adapter so no test touches a real browser's localStorage.
import { describe, it, expect } from 'vitest';
import { createCaseStore, createMemoryAdapter } from '../services/caseStore.js';

const OWNER_A = 'user-a';
const OWNER_B = 'user-b';

function makeStore() {
  return createCaseStore(createMemoryAdapter());
}

function caseInput(overrides = {}) {
  return {
    title: 'Test case',
    summary: 'A short summary of the dispute.',
    situation: 'Some background.',
    category: 'family',
    personA: { name: 'Ali', statement: 'My side.', claims: ['claim 1'] },
    personB: { name: 'Sara', statement: 'Her side.', claims: [] },
    desiredOutcome: 'A fair hearing.',
    privacy: 'private',
    displayName: 'Ali',
    ...overrides,
  };
}

describe('caseStore', () => {
  it('createCase creates a draft with a created timeline entry', () => {
    const store = makeStore();
    const c = store.createCase(OWNER_A, caseInput());
    expect(c.id).toBeTruthy();
    expect(c.ownerId).toBe(OWNER_A);
    expect(c.status).toBe('draft');
    expect(c.assessment).toBeNull();
    expect(c.evidence).toEqual([]);
    expect(c.timeline).toHaveLength(1);
    expect(c.timeline[0].action).toBe('created');
    expect(c.timeline[0].detail).toBe('Case created as draft.');
    expect(c.createdAt).toBeTruthy();
  });

  it('createCase requires title, summary and category', () => {
    const store = makeStore();
    expect(() => store.createCase(OWNER_A, caseInput({ title: ' ' }))).toThrowError();
    try {
      store.createCase(OWNER_A, caseInput({ title: '' }));
    } catch (e) {
      expect(e.code).toBe('VALIDATION');
    }
    try {
      store.createCase(OWNER_A, caseInput({ summary: '' }));
    } catch (e) {
      expect(e.code).toBe('VALIDATION');
    }
    try {
      store.createCase(OWNER_A, caseInput({ category: '' }));
    } catch (e) {
      expect(e.code).toBe('VALIDATION');
    }
  });

  it('idempotency: same key returns the same case without duplicating', () => {
    const store = makeStore();
    const key = 'idem-123';
    const first = store.createCase(OWNER_A, caseInput({ title: 'First' }), { idempotencyKey: key });
    const second = store.createCase(OWNER_A, caseInput({ title: 'Second' }), {
      idempotencyKey: key,
    });
    expect(second.id).toBe(first.id);
    expect(second.title).toBe('First'); // original is kept, not overwritten
    expect(store.listCases(OWNER_A).total).toBe(1);
    // Same key for a different owner is a separate case.
    const other = store.createCase(OWNER_B, caseInput(), { idempotencyKey: key });
    expect(other.id).not.toBe(first.id);
  });

  it('ownership: one owner cannot read another owner\'s case', () => {
    const store = makeStore();
    const c = store.createCase(OWNER_A, caseInput());
    expect(store.getCase(OWNER_A, c.id).id).toBe(c.id);
    expect(store.getCase(OWNER_B, c.id)).toBeNull();
    expect(store.getCase(OWNER_A, 'missing-id')).toBeNull();
  });

  it('listCases: filters by owner', () => {
    const store = makeStore();
    for (let i = 0; i < 10; i++) store.createCase(OWNER_A, caseInput({ title: `A${i}` }));
    for (let i = 0; i < 2; i++) store.createCase(OWNER_B, caseInput({ title: `B${i}` }));
    expect(store.listCases(OWNER_A).total).toBe(10);
    expect(store.listCases(OWNER_B).total).toBe(2);
  });

  it('listCases: q searches title + summary case-insensitively', () => {
    const store = makeStore();
    store.createCase(OWNER_A, caseInput({ title: 'Landlord dispute', summary: 'rent' }));
    store.createCase(OWNER_A, caseInput({ title: 'Family matter', summary: 'LANDLORD mention' }));
    store.createCase(OWNER_A, caseInput({ title: 'Unrelated', summary: 'nothing here' }));
    const res = store.listCases(OWNER_A, { q: 'landlord' });
    expect(res.total).toBe(2);
  });

  it('listCases: status filter works', () => {
    const store = makeStore();
    const a = store.createCase(OWNER_A, caseInput({ title: 'one' }));
    store.createCase(OWNER_A, caseInput({ title: 'two' }));
    store.submitCase(OWNER_A, a.id);
    expect(store.listCases(OWNER_A, { status: 'submitted' }).total).toBe(1);
    expect(store.listCases(OWNER_A, { status: 'draft' }).total).toBe(1);
    expect(store.listCases(OWNER_A, { status: 'all' }).total).toBe(2);
  });

  it('listCases: sort oldest vs newest', () => {
    const store = makeStore();
    const ids = [];
    for (let i = 0; i < 4; i++) {
      ids.push(store.createCase(OWNER_A, caseInput({ title: `case ${i}` })).id);
    }
    const newest = store.listCases(OWNER_A, { sort: 'newest' }).items.map((c) => c.id);
    const oldest = store.listCases(OWNER_A, { sort: 'oldest' }).items.map((c) => c.id);
    expect(oldest).toEqual(ids);
    expect(newest).toEqual([...ids].reverse());
  });

  it('listCases: pagination clamps and slices', () => {
    const store = makeStore();
    for (let i = 0; i < 10; i++) store.createCase(OWNER_A, caseInput({ title: `c${i}` }));
    const p1 = store.listCases(OWNER_A, { pageSize: 3, page: 1 });
    expect(p1.total).toBe(10);
    expect(p1.totalPages).toBe(4);
    expect(p1.items).toHaveLength(3);
    const p2 = store.listCases(OWNER_A, { pageSize: 3, page: 2 });
    expect(p2.page).toBe(2);
    expect(p2.items).toHaveLength(3);
    const last = store.listCases(OWNER_A, { pageSize: 3, page: 4 });
    expect(last.items).toHaveLength(1);
    // Out-of-range pages are clamped into [1, totalPages].
    const beyond = store.listCases(OWNER_A, { pageSize: 3, page: 99 });
    expect(beyond.page).toBe(4);
    const zero = store.listCases(OWNER_A, { pageSize: 3, page: 0 });
    expect(zero.page).toBe(1);
  });

  it('updateCase edits a draft and blocks edits after submit', () => {
    const store = makeStore();
    const c = store.createCase(OWNER_A, caseInput({ title: 'before' }));
    const updated = store.updateCase(OWNER_A, c.id, { title: 'after', category: 'work' });
    expect(updated.title).toBe('after');
    expect(updated.category).toBe('work');
    expect(updated.timeline[updated.timeline.length - 1].action).toBe('updated');
    store.submitCase(OWNER_A, c.id);
    try {
      store.updateCase(OWNER_A, c.id, { title: 'nope' });
      expect.unreachable('should have thrown NOT_DRAFT');
    } catch (e) {
      expect(e.code).toBe('NOT_DRAFT');
    }
  });

  it('transitionCase rejects bad jumps with BAD_TRANSITION', () => {
    const store = makeStore();
    const c = store.createCase(OWNER_A, caseInput());
    try {
      store.transitionCase(OWNER_A, c.id, 'assessment-available');
      expect.unreachable('should have thrown BAD_TRANSITION');
    } catch (e) {
      expect(e.code).toBe('BAD_TRANSITION');
      expect(e.message).toContain('Draft');
    }
    // And the case is unchanged.
    expect(store.getCase(OWNER_A, c.id).status).toBe('draft');
  });

  it('submitCase + archiveCase move through the workflow', () => {
    const store = makeStore();
    const c = store.createCase(OWNER_A, caseInput());
    store.submitCase(OWNER_A, c.id);
    expect(store.getCase(OWNER_A, c.id).status).toBe('submitted');
    store.archiveCase(OWNER_A, c.id);
    const archived = store.getCase(OWNER_A, c.id);
    expect(archived.status).toBe('archived');
    expect(archived.archivedAt).toBeTruthy();
  });

  it('deleteCase removes the case (owner only)', () => {
    const store = makeStore();
    const c = store.createCase(OWNER_A, caseInput());
    expect(store.deleteCase(OWNER_A, c.id)).toBe(true);
    expect(store.getCase(OWNER_A, c.id)).toBeNull();
    const d = store.createCase(OWNER_A, caseInput());
    try {
      store.deleteCase(OWNER_B, d.id);
      expect.unreachable('should have thrown NOT_FOUND');
    } catch (e) {
      expect(e.code).toBe('NOT_FOUND');
    }
  });

  it('deleteCasesForOwner removes only that owner\'s cases', () => {
    const store = makeStore();
    for (let i = 0; i < 3; i++) store.createCase(OWNER_A, caseInput());
    for (let i = 0; i < 2; i++) store.createCase(OWNER_B, caseInput());
    expect(store.deleteCasesForOwner(OWNER_A)).toBe(3);
    expect(store.listCases(OWNER_A).total).toBe(0);
    expect(store.listCases(OWNER_B).total).toBe(2);
  });

  it('addEvidence stores metadata; removeEvidence deletes it', () => {
    const store = makeStore();
    const c = store.createCase(OWNER_A, caseInput());
    const item = store.addEvidence(OWNER_A, c.id, {
      name: 'photo.jpg',
      size: 12345,
      type: 'image/jpeg',
      description: 'Front door photo',
    });
    expect(item.id).toBeTruthy();
    expect(item.name).toBe('photo.jpg');
    expect(item.size).toBe(12345);
    expect(item.uploadedAt).toBeTruthy();
    expect(store.getCase(OWNER_A, c.id).evidence).toHaveLength(1);
    expect(store.removeEvidence(OWNER_A, c.id, item.id)).toBe(true);
    expect(store.getCase(OWNER_A, c.id).evidence).toHaveLength(0);
  });

  it('addEvidence rejects wrong statuses with BAD_STATUS', () => {
    const store = makeStore();
    const c = store.createCase(OWNER_A, caseInput());
    store.submitCase(OWNER_A, c.id); // submitted still allows evidence
    store.addEvidence(OWNER_A, c.id, { name: 'ok.pdf' });
    store.transitionCase(OWNER_A, c.id, 'awaiting-evidence');
    store.transitionCase(OWNER_A, c.id, 'ready-for-analysis'); // no longer allowed
    try {
      store.addEvidence(OWNER_A, c.id, { name: 'late.pdf' });
      expect.unreachable('should have thrown BAD_STATUS');
    } catch (e) {
      expect(e.code).toBe('BAD_STATUS');
    }
  });

  it('requestAssessment always throws AI_NOT_CONFIGURED (never fakes one)', () => {
    const store = makeStore();
    const c = store.createCase(OWNER_A, caseInput());
    try {
      store.requestAssessment(OWNER_A, c.id);
      expect.unreachable('should have thrown AI_NOT_CONFIGURED');
    } catch (e) {
      expect(e.code).toBe('AI_NOT_CONFIGURED');
      expect(e.message).toContain('Phase 6');
    }
    expect(store.getCase(OWNER_A, c.id).assessment).toBeNull();
  });

  it('appealCase throws NO_ASSESSMENT without an assessment', () => {
    const store = makeStore();
    const c = store.createCase(OWNER_A, caseInput());
    try {
      store.appealCase(OWNER_A, c.id, 'I disagree');
      expect.unreachable('should have thrown NO_ASSESSMENT');
    } catch (e) {
      expect(e.code).toBe('NO_ASSESSMENT');
    }
  });

  it('stats counts statuses into the right buckets', () => {
    const store = makeStore();
    const mk = (statusFlow) => {
      const c = store.createCase(OWNER_A, caseInput());
      for (const s of statusFlow) store.transitionCase(OWNER_A, c.id, s);
      return c;
    };
    mk([]); // draft
    mk(['submitted']); // awaitingAnalysis
    const ev = mk(['submitted', 'awaiting-evidence']); // awaitingAnalysis
    store.addEvidence(OWNER_A, ev.id, { name: 'x.pdf' });
    mk(['submitted', 'awaiting-evidence', 'ready-for-analysis']); // awaitingAnalysis
    mk(['archived']); // archived (draft -> archived)
    // Walk the full chain to assessment-available.
    const full = store.createCase(OWNER_A, caseInput());
    for (const s of [
      'submitted',
      'awaiting-evidence',
      'ready-for-analysis',
      'analysis-in-progress',
      'assessment-available',
    ]) {
      store.transitionCase(OWNER_A, full.id, s);
    }
    const stats = store.stats(OWNER_A);
    expect(stats.total).toBe(6);
    expect(stats.drafts).toBe(1);
    expect(stats.awaitingAnalysis).toBe(3);
    expect(stats.assessmentsAvailable).toBe(1);
    expect(stats.inHumanReview).toBe(0);
    expect(stats.archived).toBe(1);
    // Other owners are not counted.
    store.createCase(OWNER_B, caseInput());
    expect(store.stats(OWNER_A).total).toBe(6);
  });

  it('exportCases returns only the owner\'s cases', () => {
    const store = makeStore();
    store.createCase(OWNER_A, caseInput({ title: 'mine' }));
    store.createCase(OWNER_B, caseInput({ title: 'theirs' }));
    const exported = store.exportCases(OWNER_A);
    expect(exported).toHaveLength(1);
    expect(exported[0].title).toBe('mine');
  });
});
