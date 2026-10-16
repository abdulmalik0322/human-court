// Repository interface: the single contract both stores implement.
//
// jsonStore.js (default, zero-config) and mongooseStore.js (used when
// MONGO_URI is set) implement every method below with identical
// signatures and return shapes: plain objects with string `id` and
// ISO-string `createdAt`/`updatedAt`. Callers never know which store
// is active.
//
// Method groups:
//   users:            createUser(data) -> user
//                     getUserById(id) -> user|null
//                     getUserByEmail(email) -> user|null (case-insensitive)
//                     updateUser(id, patch) -> user|null
//                     deleteUser(id) -> bool
//   passwordResets:   createPasswordReset({userId, otpHash, attempts, expiresAt})
//                     getPasswordResetByUserId(userId) -> reset|null (newest)
//                     updatePasswordReset(id, patch) -> reset|null
//                     deletePasswordReset(id) -> bool
//                     deletePasswordResetsByUser(userId) -> count
//   cases:            createCase(data) -> case
//                     getCaseById(id) -> case|null
//                     getCaseByIdempotencyKey(ownerId, key) -> case|null
//                     listCasesByOwner(ownerId, {q,status,category,from,to,
//                       sort:'newest'|'oldest'|'updated', skip, limit})
//                       -> {items, total}
//                     updateCase(id, patch) -> case|null
//                     deleteCase(id) -> bool
//   evidence:         createEvidence({caseId, ownerId, originalName,
//                       storedName, mimeType, size, description})
//                     getEvidenceById(id) -> evidence|null
//                     listEvidenceByCase(caseId) -> [evidence] (oldest first)
//                     deleteEvidence(id) -> bool
//                     deleteEvidenceByCase(caseId) -> count
//   assessments:      createAssessment({caseId, ownerId, reason, status,
//                       version, ...}) -> assessment
//                     getAssessmentById(id) -> assessment|null
//                     listAssessmentsByCase(caseId) -> [assessment] (newest first)
//                     countAssessmentsByCase(caseId) -> number
//                     updateAssessment(id, patch) -> assessment|null
//                     deleteAssessmentsByCase(caseId) -> count
//   reviews:          createReview({caseId, userId, reviewerName, opinion,
//                       reasoning, missingEvidence, nextSteps})
//                     getReviewById(id) -> review|null
//                     getReviewByCaseAndUser(caseId, userId) -> review|null
//                     listReviewsByCase(caseId) -> [review] (newest first)
//                     updateReview(id, patch) -> review|null
//                     deleteReviewsByCase(caseId) -> count
//                     deleteReviewsByUser(userId) -> count
//   invitations:      createInvitation({caseId, ownerId, email, note,
//                       tokenHash, status, expiresAt})
//                     getInvitationByTokenHash(hash) -> invitation|null
//                     listInvitationsByCase(caseId) -> [invitation]
//                     updateInvitation(id, patch) -> invitation|null
//                     deleteInvitationsByCase(caseId) -> count
//   shareLinks:       createShareLink({caseId, ownerId, tokenHash, includeTitle})
//                     getShareLinkByTokenHash(hash) -> shareLink|null
//                     listShareLinksByCase(caseId) -> [shareLink]
//                     deleteShareLinksByCase(caseId) -> count
//   notifications:    createNotification({userId, type, title, body, caseId})
//                     listNotificationsByUser(userId, {skip, limit})
//                       -> {items, total, unreadCount} (newest first)
//                     markNotificationRead(id, userId) -> notification|null
//                     deleteNotificationsByUser(userId) -> count
//
// Conventions:
// - Inserts stamp createdAt/updatedAt (ISO strings); updates refresh updatedAt.
// - Updates return the updated record, or null when the id does not exist.
// - Deletes return true/false (single) or a deleted count (bulk).
// - User records include passwordHash; it must be stripped before any
//   API response (see controllers/helpers.js publicUser).
import { initDatabase } from './connection.js';

export const REPOSITORY_METHODS = [
  'createUser',
  'getUserById',
  'getUserByEmail',
  'updateUser',
  'deleteUser',
  'createPasswordReset',
  'getPasswordResetByUserId',
  'updatePasswordReset',
  'deletePasswordReset',
  'deletePasswordResetsByUser',
  'createCase',
  'getCaseById',
  'getCaseByIdempotencyKey',
  'listCasesByOwner',
  'updateCase',
  'deleteCase',
  'createEvidence',
  'getEvidenceById',
  'listEvidenceByCase',
  'deleteEvidence',
  'deleteEvidenceByCase',
  'createAssessment',
  'getAssessmentById',
  'listAssessmentsByCase',
  'countAssessmentsByCase',
  'updateAssessment',
  'deleteAssessmentsByCase',
  'createReview',
  'getReviewById',
  'getReviewByCaseAndUser',
  'listReviewsByCase',
  'updateReview',
  'deleteReviewsByCase',
  'deleteReviewsByUser',
  'createInvitation',
  'getInvitationByTokenHash',
  'listInvitationsByCase',
  'updateInvitation',
  'deleteInvitationsByCase',
  'createShareLink',
  'getShareLinkByTokenHash',
  'listShareLinksByCase',
  'deleteShareLinksByCase',
  'createNotification',
  'listNotificationsByUser',
  'markNotificationRead',
  'deleteNotificationsByUser',
];

export async function createRepository(config) {
  return initDatabase(config);
}
