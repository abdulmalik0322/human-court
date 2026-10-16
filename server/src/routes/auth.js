import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { createAuthController } from '../controllers/auth.js';

export function createAuthRouter(ctx) {
  const c = createAuthController(ctx);
  const { requireAuth } = ctx.auth;
  const { authLimiter } = ctx.limiters;
  const r = Router();

  r.post('/register', authLimiter, asyncHandler(c.register));
  r.post('/login', authLimiter, asyncHandler(c.login));
  r.post('/logout', asyncHandler(c.logout));
  r.get('/me', asyncHandler(requireAuth), asyncHandler(c.me));
  r.post('/forgot-password', authLimiter, asyncHandler(c.forgotPassword));
  r.post('/reset-password', authLimiter, asyncHandler(c.resetPassword));

  return r;
}
