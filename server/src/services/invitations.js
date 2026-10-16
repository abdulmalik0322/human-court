// Reviewer invitations. Tokens are shown ONCE (in the create response);
// only the SHA-256 hash is stored. 7-day expiry.
import { newToken, sha256 } from '../utils/ids.js';
import { HttpError } from '../middleware/errorHandler.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function createInvitation(repo, { caseId, ownerId, email, note }) {
  const token = newToken(32);
  const expiresAt = new Date(Date.now() + SEVEN_DAYS_MS).toISOString();
  const invitation = await repo.createInvitation({
    caseId,
    ownerId,
    email: email || null,
    note: note || null,
    tokenHash: sha256(token),
    status: 'pending',
    expiresAt,
  });
  return { invitation, token, expiresAt };
}

export async function acceptInvitation(repo, token, userId) {
  const invitation = await repo.getInvitationByTokenHash(sha256(token));
  if (!invitation) throw new HttpError(404, 'not_found', 'Invitation not found.');
  if (invitation.status === 'accepted') {
    if (invitation.acceptedBy === userId) return invitation;
    throw new HttpError(409, 'conflict', 'This invitation was already accepted by someone else.');
  }
  if (invitation.status !== 'pending') {
    throw new HttpError(400, 'invalid_invitation', 'This invitation is no longer valid.');
  }
  if (new Date(invitation.expiresAt).getTime() < Date.now()) {
    await repo.updateInvitation(invitation.id, { status: 'expired' });
    throw new HttpError(400, 'invitation_expired', 'This invitation has expired.');
  }
  if (invitation.ownerId === userId) {
    throw new HttpError(409, 'conflict', 'You cannot accept your own invitation.');
  }
  return repo.updateInvitation(invitation.id, {
    status: 'accepted',
    acceptedBy: userId,
    acceptedAt: new Date().toISOString(),
  });
}
