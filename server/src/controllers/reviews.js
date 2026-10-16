// Human review: invitations, accepting, reviews, aggregate, reports.
import { HttpError } from '../middleware/errorHandler.js';
import { REVIEW_OPINIONS } from '../utils/constants.js';
import {
  getOwnedCase,
  requireViewableCase,
  isAcceptedReviewer,
  viewerCanReview,
  canViewCase,
  transitionCase,
  timelineEvent,
} from './helpers.js';
import { createInvitation, acceptInvitation } from '../services/invitations.js';
import { notify } from '../services/notifications.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AGGREGATE_DISCLAIMER = 'A small self-selected group — not representative of the public';

function toApi(r) {
  if (!r) return null;
  return {
    id: r.id,
    caseId: r.caseId,
    userId: r.userId,
    reviewerName: r.reviewerName || null,
    opinion: r.opinion,
    reasoning: r.reasoning,
    missingEvidence: r.missingEvidence || null,
    nextSteps: r.nextSteps || null,
    reports: r.reports || [],
    createdAt: r.createdAt,
  };
}

export function createReviewsController(ctx) {
  const { repo } = ctx;

  async function createInvite(req, res) {
    const c = await getOwnedCase(repo, req.params.id, req.user.id);
    const { email, note } = req.body || {};
    if (email !== undefined && (typeof email !== 'string' || !EMAIL_RE.test(email.trim()))) {
      throw new HttpError(400, 'validation_error', 'email must be a valid email address.');
    }
    if (note !== undefined && (typeof note !== 'string' || note.length > 2000)) {
      throw new HttpError(400, 'validation_error', 'note must be a string (max 2000 characters).');
    }
    const { invitation, token, expiresAt } = await createInvitation(repo, {
      caseId: c.id,
      ownerId: req.user.id,
      email: email ? email.trim().toLowerCase() : null,
      note: note || null,
    });
    // First invitation moves the case into human review (valid transition).
    if (c.status === 'assessment-available') {
      const moved = await transitionCase(repo, c, 'awaiting-human-review');
      await repo.updateCase(moved.id, { timeline: timelineEvent(moved, 'review_invited', 'Reviewer invited') });
    }
    // Token is shown ONCE — only the hash is stored.
    res.status(201).json({ id: invitation.id, token, expiresAt });
  }

  async function acceptInvite(req, res) {
    const invitation = await acceptInvitation(repo, req.params.token, req.user.id);
    await notify(repo, invitation.ownerId, {
      type: 'invitation_received',
      title: 'Invitation accepted',
      body: `${req.user.name} accepted your review invitation.`,
      caseId: invitation.caseId,
    });
    res.json({ invitation: { id: invitation.id, caseId: invitation.caseId, status: invitation.status } });
  }

  async function canReview(repo, caseObj, userId) {
    return viewerCanReview(repo, caseObj, userId);
  }

  async function createReview(req, res) {
    const c = await requireViewableCase(repo, req.params.id, req.user.id);
    if (!(await canReview(repo, c, req.user.id))) {
      throw new HttpError(403, 'review_not_allowed', 'You are not invited to review this case.');
    }
    const { opinion, reasoning, missingEvidence, nextSteps } = req.body || {};
    if (!REVIEW_OPINIONS.includes(opinion)) {
      throw new HttpError(400, 'validation_error', `opinion must be one of: ${REVIEW_OPINIONS.join(', ')}`);
    }
    if (typeof reasoning !== 'string' || reasoning.trim().length === 0 || reasoning.length > 5000) {
      throw new HttpError(400, 'validation_error', 'reasoning is required (max 5000 characters).');
    }
    for (const [key, value] of [['missingEvidence', missingEvidence], ['nextSteps', nextSteps]]) {
      if (value !== undefined && (typeof value !== 'string' || value.length > 5000)) {
        throw new HttpError(400, 'validation_error', `${key} must be a string (max 5000 characters).`);
      }
    }
    const assessments = await repo.listAssessmentsByCase(c.id);
    if (!assessments.some((a) => a.status === 'complete')) {
      throw new HttpError(409, 'no_assessment', 'Reviews require a completed assessment first.');
    }
    const existing = await repo.getReviewByCaseAndUser(c.id, req.user.id);
    if (existing) throw new HttpError(409, 'duplicate_review', 'You have already reviewed this case.');

    const review = await repo.createReview({
      caseId: c.id,
      userId: req.user.id,
      reviewerName: req.user.name,
      opinion,
      reasoning: reasoning.trim(),
      missingEvidence: missingEvidence || null,
      nextSteps: nextSteps || null,
    });
    if (c.status === 'awaiting-human-review') {
      const moved = await transitionCase(repo, c, 'review-completed');
      await repo.updateCase(moved.id, { timeline: timelineEvent(moved, 'review_submitted', 'A reviewer submitted an opinion') });
    }
    await notify(repo, c.ownerId, {
      type: 'review_submitted',
      title: 'New review',
      body: `${req.user.name} submitted a review on "${c.title}".`,
      caseId: c.id,
    });
    res.status(201).json({ review: toApi(review) });
  }

  async function listReviews(req, res) {
    const c = await requireViewableCase(repo, req.params.id, req.user.id);
    const items = (await repo.listReviewsByCase(c.id)).map(toApi);
    res.json({ items });
  }

  async function aggregateReviews(req, res) {
    const c = await requireViewableCase(repo, req.params.id, req.user.id);
    const items = await repo.listReviewsByCase(c.id);
    const distribution = {};
    for (const opinion of REVIEW_OPINIONS) distribution[opinion] = 0;
    const STOP = new Set(['the', 'and', 'that', 'this', 'with', 'have', 'from', 'they', 'them', 'their', 'there', 'would', 'should', 'could', 'about', 'into', 'because']);
    const keywordCounts = new Map();
    for (const r of items) {
      if (distribution[r.opinion] !== undefined) distribution[r.opinion] += 1;
      const words = `${r.reasoning || ''} ${r.missingEvidence || ''} ${r.nextSteps || ''}`
        .toLowerCase()
        .replace(/[^a-z\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 4 && !STOP.has(w));
      for (const w of new Set(words)) keywordCounts.set(w, (keywordCounts.get(w) || 0) + 1);
    }
    const themes = [...keywordCounts.entries()]
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([keyword, mentions]) => ({ keyword, mentions }));
    res.json({ count: items.length, distribution, themes, disclaimer: AGGREGATE_DISCLAIMER });
  }

  async function reportReview(req, res) {
    const r = await repo.getReviewById(req.params.reviewId);
    if (!r) throw new HttpError(404, 'not_found', 'Review not found.');
    const c = await repo.getCaseById(r.caseId);
    if (!c || !(await canViewCase(repo, c, req.user.id))) {
      throw new HttpError(404, 'not_found', 'Review not found.');
    }
    const { reason } = req.body || {};
    if (typeof reason !== 'string' || reason.trim().length === 0 || reason.length > 2000) {
      throw new HttpError(400, 'validation_error', 'reason is required (max 2000 characters).');
    }
    const reports = [...(r.reports || []), { userId: req.user.id, reason: reason.trim(), at: new Date().toISOString() }];
    await repo.updateReview(r.id, { reports });
    res.json({ ok: true });
  }

  return { createInvite, acceptInvite, createReview, listReviews, aggregateReviews, reportReview };
}
