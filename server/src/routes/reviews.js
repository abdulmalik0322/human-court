import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { createReviewsController } from '../controllers/reviews.js';

export function createReviewsRouter(ctx) {
  const c = createReviewsController(ctx);
  const { requireAuth } = ctx.auth;
  const { reviewLimiter } = ctx.limiters;
  const caseRouter = Router();
  const inviteRouter = Router();
  const reviewRouter = Router();

  caseRouter.use(asyncHandler(requireAuth));
  caseRouter.post('/:id/invitations', asyncHandler(c.createInvite));
  caseRouter.post('/:id/reviews', reviewLimiter, asyncHandler(c.createReview));
  caseRouter.get('/:id/reviews', asyncHandler(c.listReviews));
  caseRouter.get('/:id/reviews/aggregate', asyncHandler(c.aggregateReviews));

  inviteRouter.use(asyncHandler(requireAuth));
  inviteRouter.post('/:token/accept', asyncHandler(c.acceptInvite));

  reviewRouter.use(asyncHandler(requireAuth));
  reviewRouter.post('/:reviewId/report', asyncHandler(c.reportReview));

  return { caseRouter, inviteRouter, reviewRouter };
}
