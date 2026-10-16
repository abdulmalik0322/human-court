import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { createSharingController } from '../controllers/sharing.js';

export function createSharingRouter(ctx) {
  const c = createSharingController(ctx);
  const { requireAuth } = ctx.auth;
  const caseRouter = Router();
  const publicRouter = Router();

  caseRouter.use(asyncHandler(requireAuth));
  caseRouter.post('/:id/share', asyncHandler(c.createShare));
  caseRouter.delete('/:id/share', asyncHandler(c.revokeShare));

  // No auth: redacted payload only (see controller).
  publicRouter.get('/:token', asyncHandler(c.getShared));

  return { caseRouter, publicRouter };
}
