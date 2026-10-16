// Notifications controller: list + mark read.
import { HttpError } from '../middleware/errorHandler.js';
import { parsePagination } from '../utils/pagination.js';

export function createNotificationsController(ctx) {
  const { repo } = ctx;

  async function listNotifications(req, res) {
    const { page, pageSize, skip, limit } = parsePagination(req.query || {}, { maxPageSize: 50 });
    const { items, total, unreadCount } = await repo.listNotificationsByUser(req.user.id, { skip, limit });
    res.json({ items, unreadCount, page, pageSize, total });
  }

  async function markRead(req, res) {
    const notification = await repo.markNotificationRead(req.params.id, req.user.id);
    if (!notification) throw new HttpError(404, 'not_found', 'Notification not found.');
    res.json({ notification });
  }

  return { listNotifications, markRead };
}
