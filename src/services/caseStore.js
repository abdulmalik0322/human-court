// @deprecated — legacy in-browser store.
// The app now talks to the real server API via src/services/api.js.
// This module is kept ONLY so the existing unit tests
// (src/tests/caseStore.test.js) keep passing — do not use it for new code,
// and do not treat anything it returns as real data.
// DEMO store — data lives in this browser's localStorage only.
// Phase 3 replaces this with a real backend API.
// Do not treat as secure or multi-device.
//
// Case shape:
// {
//   id, ownerId, title, summary, situation, category,
//   personA: { name, statement, claims: [] },
//   personB: { name, statement, claims: [] },
//   desiredOutcome,
//   privacy: 'private' | 'invite-only',
//   displayName,
//   evidence: [{ id, name, size, type, description, uploadedAt }],
//   assessment: null,          // filled by the AI phase (Phase 6), never faked
//   reviews: [],
//   status,                    // one of the statuses in utils/caseWorkflow.js
//   idempotencyKey,            // prevents duplicate creates on double-submit
//   createdAt, updatedAt, archivedAt,
//   timeline: [{ at, by, action, detail }]
// }

import { canTransition, statusLabel } from '../utils/caseWorkflow.js';

const LS_KEY = 'hc_cases_v1';

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

// A short unique id for cases, evidence items, etc.
function genId() {
  return 'hc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// Current time as an ISO string (UTC).
function nowIso() {
  return new Date().toISOString();
}

// Error with a machine-readable `code` attached, e.g. err.code === 'NOT_FOUND'.
function makeError(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

// Default empty "person" block used for personA / personB.
function blankPerson() {
  return { name: '', statement: '', claims: [] };
}

// Fields a user is allowed to change on a draft via updateCase().
// Anything else in the patch object is silently ignored.
const EDITABLE_FIELDS = [
  'title',
  'summary',
  'situation',
  'category',
  'personA',
  'personB',
  'desiredOutcome',
  'privacy',
  'displayName',
];

// Evidence can only be added while the case is still gathering information.
const EVIDENCE_ALLOWED_STATUSES = ['draft', 'submitted', 'awaiting-evidence'];

// ---------------------------------------------------------------------------
// Storage adapters
// ---------------------------------------------------------------------------

// localStorage adapter. Every access is guarded so that importing this module
// in Node (e.g. when vitest runs the tests) never throws.
function localStorageAdapter(key) {
  return {
    load() {
      if (typeof localStorage === 'undefined') return { cases: [] };
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return { cases: [] };
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.cases)) return { cases: [] };
        return parsed;
      } catch {
        return { cases: [] };
      }
    },
    save(state) {
      if (typeof localStorage === 'undefined') return;
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch {
        // Storage full or unavailable in this browser — demo keeps going
        // in memory for this page load.
      }
    },
  };
}

// In-memory adapter for tests (and anywhere else we don't want persistence).
// Uses a closure variable so each adapter instance has its own private store.
export function createMemoryAdapter(initialCases = []) {
  let state = { cases: [...initialCases] };
  return {
    load() {
      return { cases: [...state.cases] };
    },
    save(newState) {
      state = { cases: [...(newState && newState.cases ? newState.cases : [])] };
    },
  };
}

// ---------------------------------------------------------------------------
// Case store
// ---------------------------------------------------------------------------

export function createCaseStore(adapter) {
  // Read the whole list of cases from the adapter.
  function _read() {
    const data = adapter.load();
    if (!data || !Array.isArray(data.cases)) return [];
    return data.cases;
  }

  // Write the whole list back to the adapter.
  function _write(cases) {
    adapter.save({ cases });
  }

  // Find a case that belongs to ownerId, or throw NOT_FOUND.
  // (Ownership is enforced on every method: a user can never see or touch
  // another user's cases through this store.)
  function _require(ownerId, id) {
    const found = _read().find((c) => c.id === id && c.ownerId === ownerId);
    if (!found) throw makeError('NOT_FOUND', 'Case not found.');
    return found;
  }

  // Persist one changed case back into the list and return it.
  function _saveOne(cases, updated) {
    _write(cases.map((c) => (c.id === updated.id ? updated : c)));
    return updated;
  }

  // Add an entry to the case's timeline (an audit trail of what happened).
  function _log(c, ownerId, action, detail) {
    c.timeline.push({ at: nowIso(), by: ownerId, action, detail });
  }

  const store = {
    // -- Create -----------------------------------------------------------
    createCase(ownerId, input = {}, { idempotencyKey } = {}) {
      const cases = _read();

      // Duplicate-submission prevention: if the caller passes an
      // idempotencyKey and we already created a case with it, hand the
      // existing case back instead of creating a second one.
      if (idempotencyKey) {
        const existing = cases.find(
          (c) => c.ownerId === ownerId && c.idempotencyKey === idempotencyKey,
        );
        if (existing) return existing;
      }

      // Basic validation — a case needs a title, summary and category.
      if (!input.title || !String(input.title).trim()) {
        throw makeError('VALIDATION', 'Title is required.');
      }
      if (!input.summary || !String(input.summary).trim()) {
        throw makeError('VALIDATION', 'Summary is required.');
      }
      if (!input.category || !String(input.category).trim()) {
        throw makeError('VALIDATION', 'Category is required.');
      }

      const now = nowIso();
      const c = {
        id: genId(),
        ownerId,
        title: String(input.title).trim(),
        summary: String(input.summary).trim(),
        situation: input.situation ? String(input.situation).trim() : '',
        category: String(input.category).trim(),
        personA: { ...blankPerson(), ...(input.personA || {}) },
        personB: { ...blankPerson(), ...(input.personB || {}) },
        desiredOutcome: input.desiredOutcome ? String(input.desiredOutcome).trim() : '',
        privacy: input.privacy === 'invite-only' ? 'invite-only' : 'private',
        displayName: input.displayName ? String(input.displayName).trim() : '',
        evidence: [],
        assessment: null,
        reviews: [],
        status: 'draft',
        idempotencyKey: idempotencyKey || null,
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
        timeline: [
          { at: now, by: ownerId, action: 'created', detail: 'Case created as draft.' },
        ],
      };
      cases.push(c);
      _write(cases);
      return c;
    },

    // -- Read -------------------------------------------------------------
    getCase(ownerId, id) {
      return _read().find((c) => c.id === id && c.ownerId === ownerId) || null;
    },

    listCases(
      ownerId,
      { q = '', status = 'all', category = 'all', sort = 'newest', page = 1, pageSize = 8 } = {},
    ) {
      // Only this owner's cases, in their original creation order.
      let items = _read().filter((c) => c.ownerId === ownerId);
      // Remember each item's position so ties on timestamps stay stable.
      const position = new Map(items.map((c, i) => [c.id, i]));

      // Text search across title + summary (case-insensitive).
      const needle = String(q).trim().toLowerCase();
      if (needle) {
        items = items.filter((c) =>
          `${c.title} ${c.summary}`.toLowerCase().includes(needle),
        );
      }

      if (status !== 'all') items = items.filter((c) => c.status === status);
      if (category !== 'all') items = items.filter((c) => c.category === category);

      // Sorting. On equal timestamps we fall back to creation order.
      const ts = (c) => Date.parse(c.createdAt) || 0;
      const tsUpdated = (c) => Date.parse(c.updatedAt) || 0;
      if (sort === 'oldest') {
        items = [...items].sort(
          (a, b) => ts(a) - ts(b) || position.get(a.id) - position.get(b.id),
        );
      } else if (sort === 'updated') {
        items = [...items].sort(
          (a, b) => tsUpdated(b) - tsUpdated(a) || position.get(b.id) - position.get(a.id),
        );
      } else {
        // 'newest' (default)
        items = [...items].sort(
          (a, b) => ts(b) - ts(a) || position.get(b.id) - position.get(a.id),
        );
      }

      const total = items.length;
      const safePageSize = Math.max(1, Number(pageSize) || 8);
      const totalPages = Math.max(1, Math.ceil(total / safePageSize));
      const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
      const start = (safePage - 1) * safePageSize;

      return {
        items: items.slice(start, start + safePageSize),
        total,
        page: safePage,
        pageSize: safePageSize,
        totalPages,
      };
    },

    // -- Update (drafts only) ---------------------------------------------
    updateCase(ownerId, id, patch = {}) {
      const cases = _read();
      const c = cases.find((x) => x.id === id && x.ownerId === ownerId);
      if (!c) throw makeError('NOT_FOUND', 'Case not found.');
      if (c.status !== 'draft') {
        throw makeError('NOT_DRAFT', 'Only draft cases can be edited.');
      }
      for (const field of EDITABLE_FIELDS) {
        if (patch[field] !== undefined) c[field] = patch[field];
      }
      c.updatedAt = nowIso();
      _log(c, ownerId, 'updated', 'Draft updated.');
      return _saveOne(cases, c);
    },

    // -- Status transitions -------------------------------------------------
    transitionCase(ownerId, id, to, detail = '') {
      const cases = _read();
      const c = cases.find((x) => x.id === id && x.ownerId === ownerId);
      if (!c) throw makeError('NOT_FOUND', 'Case not found.');
      if (!canTransition(c.status, to)) {
        throw makeError(
          'BAD_TRANSITION',
          `Cannot move from ${statusLabel(c.status)} to ${statusLabel(to)}.`,
        );
      }
      c.status = to;
      c.updatedAt = nowIso();
      if (to === 'archived') c.archivedAt = nowIso();
      _log(c, ownerId, 'status', detail || `Status changed to ${statusLabel(to)}.`);
      return _saveOne(cases, c);
    },

    submitCase(ownerId, id) {
      return store.transitionCase(ownerId, id, 'submitted', 'Case submitted for review.');
    },

    archiveCase(ownerId, id) {
      return store.transitionCase(ownerId, id, 'archived', 'Case archived.');
    },

    // -- Delete -------------------------------------------------------------
    deleteCase(ownerId, id) {
      const cases = _read();
      const c = cases.find((x) => x.id === id && x.ownerId === ownerId);
      if (!c) throw makeError('NOT_FOUND', 'Case not found.');
      _write(cases.filter((x) => x.id !== id));
      return true;
    },

    deleteCasesForOwner(ownerId) {
      const cases = _read();
      const kept = cases.filter((c) => c.ownerId !== ownerId);
      _write(kept);
      return cases.length - kept.length;
    },

    // -- Evidence -------------------------------------------------------------
    addEvidence(ownerId, caseId, { name, size, type, description = '' } = {}) {
      const cases = _read();
      const c = cases.find((x) => x.id === caseId && x.ownerId === ownerId);
      if (!c) throw makeError('NOT_FOUND', 'Case not found.');
      if (!EVIDENCE_ALLOWED_STATUSES.includes(c.status)) {
        throw makeError(
          'BAD_STATUS',
          `Evidence can only be added while a case is a draft, submitted, or awaiting evidence (current: ${statusLabel(c.status)}).`,
        );
      }
      if (!name || !String(name).trim()) {
        throw makeError('VALIDATION', 'Evidence needs a file name.');
      }
      const item = {
        id: genId(),
        name: String(name),
        size: size ?? null,
        type: type || '',
        description: String(description),
        uploadedAt: nowIso(),
      };
      c.evidence.push(item);
      c.updatedAt = nowIso();
      _log(c, ownerId, 'evidence-added', `Evidence added: ${item.name}.`);
      _saveOne(cases, c);
      return item;
    },

    removeEvidence(ownerId, caseId, evidenceId) {
      const cases = _read();
      const c = cases.find((x) => x.id === caseId && x.ownerId === ownerId);
      if (!c) throw makeError('NOT_FOUND', 'Case not found.');
      const item = c.evidence.find((e) => e.id === evidenceId);
      if (!item) throw makeError('NOT_FOUND', 'Evidence item not found.');
      c.evidence = c.evidence.filter((e) => e.id !== evidenceId);
      c.updatedAt = nowIso();
      _log(c, ownerId, 'evidence-removed', `Evidence removed: ${item.name}.`);
      _saveOne(cases, c);
      return true;
    },

    // -- Assessment & appeal ----------------------------------------------------
    // HONESTY: there is no AI service in this demo. We refuse to fabricate an
    // assessment rather than pretend one exists. Phase 6 connects the real one.
    requestAssessment(ownerId, id) {
      _require(ownerId, id);
      throw makeError(
        'AI_NOT_CONFIGURED',
        'Demo mode: the AI assessment service is not connected yet (arrives in Phase 6). ' +
          'No assessment was generated and nothing was sent anywhere.',
      );
    },

    appealCase(ownerId, id, reason = '') {
      const cases = _read();
      const c = cases.find((x) => x.id === id && x.ownerId === ownerId);
      if (!c) throw makeError('NOT_FOUND', 'Case not found.');
      if (!c.assessment) {
        throw makeError(
          'NO_ASSESSMENT',
          'Appeals require an existing assessment. Assessments arrive with the AI phase (Phase 6).',
        );
      }
      return store.transitionCase(
        ownerId,
        id,
        'appealed',
        reason ? `Appeal filed: ${reason}` : 'Appeal filed.',
      );
    },

    // -- Dashboard numbers ------------------------------------------------------
    stats(ownerId) {
      const mine = _read().filter((c) => c.ownerId === ownerId);
      const inList = (statuses) => mine.filter((c) => statuses.includes(c.status)).length;
      return {
        total: mine.length,
        drafts: inList(['draft']),
        // Everything still working its way toward an assessment.
        awaitingAnalysis: inList([
          'submitted',
          'awaiting-evidence',
          'ready-for-analysis',
          'analysis-in-progress',
        ]),
        assessmentsAvailable: inList(['assessment-available']),
        // Cases with a human reviewer involved.
        inHumanReview: inList(['awaiting-human-review', 'review-completed']),
        archived: inList(['archived']),
      };
    },

    // -- Export (Settings → "Download my data") -----------------------------------
    exportCases(ownerId) {
      return _read().filter((c) => c.ownerId === ownerId);
    },
  };

  return store;
}

// The shared store used by the app: data lives in this browser's
// localStorage under the key 'hc_cases_v1'.
export const caseStore = createCaseStore(localStorageAdapter(LS_KEY));
