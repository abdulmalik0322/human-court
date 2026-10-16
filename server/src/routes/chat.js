import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { createChatController } from '../controllers/chat.js';

export function createChatRouter(ctx) {
  const c = createChatController(ctx);
  const { requireAuth } = ctx.auth;
  const { chatLimiter } = ctx.limiters;
  const r = Router();

  r.use(asyncHandler(requireAuth));
  r.get('/status', asyncHandler(c.getStatus));
  r.post('/messages', chatLimiter, asyncHandler(c.sendMessage));

  return r;
}
