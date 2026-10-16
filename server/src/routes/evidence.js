import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { createEvidenceController } from '../controllers/evidence.js';

export function createEvidenceRouter(ctx) {
  const c = createEvidenceController(ctx);
  const { requireAuth } = ctx.auth;
  const { uploadLimiter } = ctx.limiters;
  const r = Router();

  r.use(asyncHandler(requireAuth));
  r.post('/:id/evidence', uploadLimiter, asyncHandler(c.addEvidence));
  r.get('/:id/evidence', asyncHandler(c.listEvidence));
  r.get('/:id/evidence/:evidenceId/download', asyncHandler(c.downloadEvidence));
  r.delete('/:id/evidence/:evidenceId', asyncHandler(c.deleteEvidence));

  return r;
}
