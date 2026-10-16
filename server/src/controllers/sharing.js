// Public share links. GET /api/shared/:token needs NO auth and returns
// only a redacted summary — never statements, evidence, names, or emails.
import { HttpError } from '../middleware/errorHandler.js';
import { getOwnedCase } from './helpers.js';
import { newToken, sha256 } from '../utils/ids.js';

export function createSharingController(ctx) {
  const { repo } = ctx;

  async function latestCompletedAssessment(caseId) {
    const items = await repo.listAssessmentsByCase(caseId);
    return items.find((a) => a.status === 'complete') || null;
  }

  async function createShare(req, res) {
    const c = await getOwnedCase(repo, req.params.id, req.user.id);
    const { includeTitle = true } = req.body || {};
    if (typeof includeTitle !== 'boolean') {
      throw new HttpError(400, 'validation_error', 'includeTitle must be a boolean.');
    }
    const assessment = await latestCompletedAssessment(c.id);
    if (!assessment) {
      throw new HttpError(409, 'no_assessment', 'A case can only be shared once it has a completed assessment.');
    }
    const token = newToken(32);
    await repo.createShareLink({
      caseId: c.id,
      ownerId: req.user.id,
      tokenHash: sha256(token),
      includeTitle,
    });
    // Token is shown ONCE — only the hash is stored.
    res.status(201).json({ token, url: `/s/${token}` });
  }

  async function getShared(req, res) {
    const link = await repo.getShareLinkByTokenHash(sha256(req.params.token));
    if (!link) throw new HttpError(404, 'not_found', 'This shared link is invalid or has been revoked.');
    const c = await repo.getCaseById(link.caseId);
    const assessment = c ? await latestCompletedAssessment(c.id) : null;
    if (!c || !assessment) throw new HttpError(404, 'not_found', 'This shared link is invalid or has been revoked.');

    const sections = assessment.sections || {};
    const neutral = String(sections.neutralSummary || '');
    const short = neutral.length > 280 ? `${neutral.slice(0, 277).trimEnd()}…` : neutral;
    const payload = {
      brand: 'Human Court',
      outcomeCategory: assessment.outcomeCategory,
      summary: `${short} Note: this is an automated summary of the parties' own accounts and may be incomplete.`,
      assessmentDate: assessment.completedAt || assessment.createdAt,
    };
    if (link.includeTitle) payload.title = c.title;
    res.json(payload);
  }

  async function revokeShare(req, res) {
    const c = await getOwnedCase(repo, req.params.id, req.user.id);
    const revoked = await repo.deleteShareLinksByCase(c.id);
    res.json({ revoked });
  }

  return { createShare, getShared, revokeShare };
}
