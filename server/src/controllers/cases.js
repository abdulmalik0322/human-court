// Cases controller: CRUD + submit/archive/appeal/transition.
// Ownership is enforced on every route; a wrong-owner id returns 404.
import { HttpError } from '../middleware/errorHandler.js';
import { isValidStatus } from '../utils/caseWorkflow.js';
import { CATEGORIES, PRIVACY_VALUES, REVIEW_AUDIENCE_VALUES } from '../utils/constants.js';
import { parsePagination, pageResult } from '../utils/pagination.js';
import {
  getOwnedCase,
  requireViewableCase,
  transitionCase,
  timelineEvent,
  deleteCaseCascade,
  evidenceMetadata,
  assessmentSummary,
  viewerCanReview,
} from './helpers.js';
import { notify } from '../services/notifications.js';

function validatePerson(value, label) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'validation_error', `${label} must be an object.`);
  }
  const out = {};
  for (const key of ['label', 'name', 'statement']) {
    if (value[key] !== undefined) {
      if (typeof value[key] !== 'string' || value[key].length > 10000) {
        throw new HttpError(400, 'validation_error', `${label}.${key} must be a string (max 10000 chars).`);
      }
      out[key] = value[key];
    }
  }
  if (value.claims !== undefined) {
    if (!Array.isArray(value.claims) || value.claims.some((c) => typeof c !== 'string' || c.length > 2000)) {
      throw new HttpError(400, 'validation_error', `${label}.claims must be an array of strings.`);
    }
    out.claims = value.claims.slice(0, 50);
  }
  return out;
}

function validateCaseInput(body, { partial = false } = {}) {
  const data = {};
  if (!partial || body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.trim().length === 0 || body.title.length > 200) {
      throw new HttpError(400, 'validation_error', 'title is required (max 200 characters).');
    }
    data.title = body.title.trim();
  }
  if (!partial || body.summary !== undefined) {
    if (typeof body.summary !== 'string' || body.summary.trim().length === 0 || body.summary.length > 5000) {
      throw new HttpError(400, 'validation_error', 'summary is required (max 5000 characters).');
    }
    data.summary = body.summary.trim();
  }
  if (!partial || body.category !== undefined) {
    if (typeof body.category !== 'string' || !CATEGORIES.includes(body.category)) {
      throw new HttpError(400, 'validation_error', `category must be one of: ${CATEGORIES.join(', ')}`);
    }
    data.category = body.category;
  }
  for (const key of ['situation', 'desiredOutcome', 'displayName']) {
    if (body[key] !== undefined) {
      if (typeof body[key] !== 'string' || body[key].length > 10000) {
        throw new HttpError(400, 'validation_error', `${key} must be a string (max 10000 characters).`);
      }
      data[key] = body[key];
    }
  }
  const personA = validatePerson(body.personA, 'personA');
  if (personA !== undefined) data.personA = personA;
  const personB = validatePerson(body.personB, 'personB');
  if (personB !== undefined) data.personB = personB;
  if (body.privacy !== undefined) {
    if (!PRIVACY_VALUES.includes(body.privacy)) {
      throw new HttpError(400, 'validation_error', `privacy must be one of: ${PRIVACY_VALUES.join(', ')}`);
    }
    data.privacy = body.privacy;
  }
  if (body.reviewAudience !== undefined) {
    if (!REVIEW_AUDIENCE_VALUES.includes(body.reviewAudience)) {
      throw new HttpError(400, 'validation_error', `reviewAudience must be one of: ${REVIEW_AUDIENCE_VALUES.join(', ')}`);
    }
    data.reviewAudience = body.reviewAudience;
  }
  return data;
}

export function createCasesController(ctx) {
  const { repo, uploadDir } = ctx;

  async function createCase(req, res) {
    const data = validateCaseInput(req.body || {});
    const { idempotencyKey } = req.body || {};
    if (idempotencyKey !== undefined) {
      if (typeof idempotencyKey !== 'string' || idempotencyKey.length === 0 || idempotencyKey.length > 128) {
        throw new HttpError(400, 'validation_error', 'idempotencyKey must be a non-empty string (max 128 chars).');
      }
      const existing = await repo.getCaseByIdempotencyKey(req.user.id, idempotencyKey);
      if (existing) return res.json({ case: existing, deduped: true });
      data.idempotencyKey = idempotencyKey;
    }
    const now = new Date().toISOString();
    const c = await repo.createCase({
      ownerId: req.user.id,
      privacy: 'private',
      reviewAudience: 'invite-only',
      status: 'draft',
      evidence: [],
      timeline: [{ at: now, event: 'created', detail: 'Case created' }],
      ...data,
    });
    res.status(201).json({ case: c });
  }

  async function listCases(req, res) {
    const { q, status, category, from, to, sort } = req.query || {};
    if (status !== undefined && !isValidStatus(status)) {
      throw new HttpError(400, 'validation_error', 'Invalid status filter.');
    }
    if (category !== undefined && !CATEGORIES.includes(category)) {
      throw new HttpError(400, 'validation_error', 'Invalid category filter.');
    }
    if (sort !== undefined && !['newest', 'oldest', 'updated'].includes(sort)) {
      throw new HttpError(400, 'validation_error', 'sort must be newest, oldest, or updated.');
    }
    for (const [key, value] of [['from', from], ['to', to]]) {
      if (value !== undefined && Number.isNaN(Date.parse(value))) {
        throw new HttpError(400, 'validation_error', `${key} must be a valid date.`);
      }
    }
    const { page, pageSize, skip, limit } = parsePagination(req.query || {}, { maxPageSize: 50 });
    const { items, total } = await repo.listCasesByOwner(req.user.id, {
      q, status, category, from, to, sort, skip, limit,
    });
    res.json(pageResult(items, total, { page, pageSize }));
  }

  async function getCase(req, res) {
    const c = await requireViewableCase(repo, req.params.id, req.user.id);
    const evidence = (await repo.listEvidenceByCase(c.id)).map(evidenceMetadata);
    const assessments = await repo.listAssessmentsByCase(c.id);
    const latest = assessments.find((a) => a.status === 'complete') || null;
    res.json({
      case: c,
      evidence,
      latestAssessment: assessmentSummary(latest),
      viewer: {
        isOwner: c.ownerId === req.user.id,
        canReview: await viewerCanReview(repo, c, req.user.id),
      },
    });
  }

  async function updateCase(req, res) {
    const c = await getOwnedCase(repo, req.params.id, req.user.id);
    if (c.status !== 'draft') {
      throw new HttpError(409, 'not_draft', 'Only draft cases can be edited.');
    }
    const data = validateCaseInput(req.body || {}, { partial: true });
    if (Object.keys(data).length === 0) {
      throw new HttpError(400, 'validation_error', 'Nothing to update.');
    }
    const updated = await repo.updateCase(c.id, {
      ...data,
      timeline: timelineEvent(c, 'updated', 'Case edited'),
    });
    res.json({ case: updated });
  }

  async function deleteCase(req, res) {
    const c = await getOwnedCase(repo, req.params.id, req.user.id);
    await deleteCaseCascade(repo, uploadDir, c.id);
    res.json({ ok: true });
  }

  async function submitCase(req, res) {
    const c = await getOwnedCase(repo, req.params.id, req.user.id);
    const updated = await transitionCase(repo, c, 'submitted');
    await repo.updateCase(updated.id, { timeline: timelineEvent(updated, 'submitted', 'Case submitted') });
    await notify(repo, req.user.id, {
      type: 'case_submitted',
      title: 'Case submitted',
      body: `"${updated.title}" was submitted.`,
      caseId: updated.id,
    });
    res.json({ case: await repo.getCaseById(updated.id) });
  }

  async function archiveCase(req, res) {
    const c = await getOwnedCase(repo, req.params.id, req.user.id);
    const updated = await transitionCase(repo, c, 'archived');
    res.json({ case: updated });
  }

  async function appealCase(req, res) {
    const c = await getOwnedCase(repo, req.params.id, req.user.id);
    const { reason, newInfo } = req.body || {};
    if (typeof reason !== 'string' || reason.trim().length === 0 || reason.length > 5000) {
      throw new HttpError(400, 'validation_error', 'reason is required (max 5000 characters).');
    }
    if (newInfo !== undefined && (typeof newInfo !== 'string' || newInfo.length > 10000)) {
      throw new HttpError(400, 'validation_error', 'newInfo must be a string (max 10000 characters).');
    }
    const updated = await transitionCase(repo, c, 'appealed');
    const withAppeal = await repo.updateCase(updated.id, {
      appeal: {
        reason: reason.trim(),
        newInfo: newInfo || null,
        at: new Date().toISOString(),
        status: 'open',
      },
      timeline: timelineEvent(updated, 'appealed', 'Owner appealed the assessment'),
    });
    await notify(repo, req.user.id, {
      type: 'appeal_updated',
      title: 'Appeal recorded',
      body: `Your appeal on "${withAppeal.title}" was recorded.`,
      caseId: withAppeal.id,
    });
    res.json({ case: withAppeal });
  }

  // Generic, table-enforced status move (e.g. submitted -> awaiting-evidence
  // -> ready-for-analysis). Complements the named submit/archive/appeal routes.
  async function transition(req, res) {
    const c = await getOwnedCase(repo, req.params.id, req.user.id);
    const { to } = req.body || {};
    if (typeof to !== 'string' || !isValidStatus(to)) {
      throw new HttpError(400, 'validation_error', 'to must be a valid status value.');
    }
    const updated = await transitionCase(repo, c, to);
    res.json({ case: updated });
  }

  return { createCase, listCases, getCase, updateCase, deleteCase, submitCase, archiveCase, appealCase, transition };
}
