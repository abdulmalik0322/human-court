import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { createUsersController } from '../controllers/users.js';

export function createUsersRouter(ctx) {
  const c = createUsersController(ctx);
  const { requireAuth } = ctx.auth;
  const r = Router();

  r.use(asyncHandler(requireAuth));
  r.get('/me', asyncHandler(c.getMe));
  r.patch('/me', asyncHandler(c.patchMe));
  r.post('/me/change-password', asyncHandler(c.changePassword));
  r.get('/me/export', asyncHandler(c.exportData));
  r.delete('/me', asyncHandler(c.deleteMe));

  return r;
}
