import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { createNotificationsController } from '../controllers/notifications.js';

export function createNotificationsRouter(ctx) {
  const c = createNotificationsController(ctx);
  const { requireAuth } = ctx.auth;
  const r = Router();

  r.use(asyncHandler(requireAuth));
  r.get('/', asyncHandler(c.listNotifications));
  r.patch('/:id/read', asyncHandler(c.markRead));

  return r;
}
