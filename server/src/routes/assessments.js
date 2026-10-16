import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { createAssessmentsController } from '../controllers/assessments.js';

export function createAssessmentsRouter(ctx) {
  const c = createAssessmentsController(ctx);
  const { requireAuth } = ctx.auth;
  const { assessmentLimiter } = ctx.limiters;
  const r = Router();

  r.use(asyncHandler(requireAuth));
  r.post('/:id/assessments', assessmentLimiter, asyncHandler(c.createAssessment));
  r.get('/:id/assessments', asyncHandler(c.listAssessments));
  r.get('/:id/assessments/:assessmentId', asyncHandler(c.getAssessment));
  r.post('/:id/assessments/:assessmentId/report', asyncHandler(c.reportAssessment));

  return r;
}
