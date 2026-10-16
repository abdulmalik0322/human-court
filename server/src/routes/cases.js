import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { createCasesController } from '../controllers/cases.js';

export function createCasesRouter(ctx) {
  const c = createCasesController(ctx);
  const { requireAuth } = ctx.auth;
  const r = Router();

  r.use(asyncHandler(requireAuth));
  r.post('/', asyncHandler(c.createCase));
  r.get('/', asyncHandler(c.listCases));
  r.get('/:id', asyncHandler(c.getCase));
  r.patch('/:id', asyncHandler(c.updateCase));
  r.delete('/:id', asyncHandler(c.deleteCase));
  r.post('/:id/submit', asyncHandler(c.submitCase));
  r.post('/:id/archive', asyncHandler(c.archiveCase));
  r.post('/:id/appeal', asyncHandler(c.appealCase));
  // Generic table-enforced transition (e.g. submitted -> awaiting-evidence -> ready-for-analysis).
  r.post('/:id/transition', asyncHandler(c.transition));

  return r;
}
