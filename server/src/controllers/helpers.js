// Shared controller helpers: ownership, visibility, transitions, cascade delete.
import { HttpError } from '../middleware/errorHandler.js';
import { canTransition } from '../utils/caseWorkflow.js';
import { deleteUpload } from '../services/storage.js';

// Strip secrets before anything leaves the server.
export function publicUser(user) {
  if (!user) return null;
  const rest = { ...user };
  delete rest.passwordHash;
  return rest;
}

// Owner-only lookup. A wrong-owner id is indistinguishable from a
// missing case (404) so existence is never leaked.
export async function getOwnedCase(repo, caseId, userId) {
  const c = await repo.getCaseById(caseId);
  if (!c || c.ownerId !== userId) throw new HttpError(404, 'not_found', 'Case not found.');
  return c;
}

export async function isAcceptedReviewer(repo, caseId, userId) {
  if (!userId) return false;
  const invitations = await repo.listInvitationsByCase(caseId);
  return invitations.some((i) => i.status === 'accepted' && i.acceptedBy === userId);
}

// Whether the viewer may submit a human review on this case.
export async function viewerCanReview(repo, caseObj, userId) {
  if (!caseObj || !userId) return false;
  if (await isAcceptedReviewer(repo, caseObj.id, userId)) return true;
  return caseObj.reviewAudience === 'public' && caseObj.privacy === 'public';
}

export async function canViewCase(repo, caseObj, userId) {
  if (!caseObj) return false;
  if (caseObj.ownerId === userId) return true;
  if (caseObj.privacy === 'public') return true;
  if (await isAcceptedReviewer(repo, caseObj.id, userId)) return true;
  return false;
}

export async function requireViewableCase(repo, caseId, userId) {
  const c = await repo.getCaseById(caseId);
  if (!c || !(await canViewCase(repo, c, userId))) {
    throw new HttpError(404, 'not_found', 'Case not found.');
  }
  return c;
}

// Enforce the transition table; invalid moves are 409.
export async function transitionCase(repo, caseObj, to) {
  if (!canTransition(caseObj.status, to)) {
    throw new HttpError(
      409,
      'invalid_transition',
      `Cannot move case from '${caseObj.status}' to '${to}'.`,
    );
  }
  const timeline = [
    ...(caseObj.timeline || []),
    { at: new Date().toISOString(), event: 'status', detail: `${caseObj.status} -> ${to}` },
  ];
  const patch = { status: to, timeline };
  if (to === 'archived') patch.archivedAt = new Date().toISOString();
  const updated = await repo.updateCase(caseObj.id, patch);
  if (!updated) throw new HttpError(404, 'not_found', 'Case not found.');
  return updated;
}

export function timelineEvent(caseObj, event, detail) {
  return [
    ...(caseObj.timeline || []),
    { at: new Date().toISOString(), event, detail: detail || '' },
  ];
}

// Delete a case and everything attached to it, including files on disk.
export async function deleteCaseCascade(repo, uploadDir, caseId) {
  const evidenceItems = await repo.listEvidenceByCase(caseId);
  for (const ev of evidenceItems) {
    await deleteUpload(uploadDir, ev.storedName);
  }
  await repo.deleteEvidenceByCase(caseId);
  await repo.deleteAssessmentsByCase(caseId);
  await repo.deleteReviewsByCase(caseId);
  await repo.deleteInvitationsByCase(caseId);
  await repo.deleteShareLinksByCase(caseId);
  await repo.deleteCase(caseId);
}

export function evidenceMetadata(ev) {
  if (!ev) return null;
  return {
    id: ev.id,
    name: ev.originalName,
    mimeType: ev.mimeType,
    size: ev.size,
    description: ev.description || null,
    uploadedAt: ev.createdAt,
  };
}

export function assessmentSummary(a) {
  if (!a) return null;
  return {
    id: a.id,
    version: a.version,
    status: a.status,
    outcomeCategory: a.outcomeCategory || null,
    engine: a.engine || null,
    createdAt: a.createdAt,
    completedAt: a.completedAt || null,
  };
}
