// Users controller: profile, password change, data export, account deletion.
import bcrypt from 'bcryptjs';
import { HttpError } from '../middleware/errorHandler.js';
import { publicUser, deleteCaseCascade } from './helpers.js';
import { notify } from '../services/notifications.js';

function validatePassword(password, field = 'newPassword') {
  if (typeof password !== 'string' || password.length < 8) {
    throw new HttpError(400, 'validation_error', `${field} must be at least 8 characters.`);
  }
  return password;
}

export function createUsersController(ctx) {
  const { repo, config, uploadDir } = ctx;

  async function getMe(req, res) {
    res.json({ user: publicUser(req.user) });
  }

  async function patchMe(req, res) {
    const { name, notificationPrefs, privacy } = req.body || {};
    const patch = {};
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 100) {
        throw new HttpError(400, 'validation_error', 'Name must be 1–100 characters.');
      }
      patch.name = name.trim();
    }
    if (notificationPrefs !== undefined) {
      if (!notificationPrefs || typeof notificationPrefs !== 'object' || Array.isArray(notificationPrefs)) {
        throw new HttpError(400, 'validation_error', 'notificationPrefs must be an object.');
      }
      patch.notificationPrefs = notificationPrefs;
    }
    if (privacy !== undefined) {
      if (!privacy || typeof privacy !== 'object' || Array.isArray(privacy)) {
        throw new HttpError(400, 'validation_error', 'privacy must be an object.');
      }
      patch.privacy = privacy;
    }
    if (Object.keys(patch).length === 0) {
      throw new HttpError(400, 'validation_error', 'Nothing to update.');
    }
    const updated = await repo.updateUser(req.user.id, patch);
    res.json({ user: publicUser(updated) });
  }

  async function changePassword(req, res) {
    const { currentPassword, newPassword } = req.body || {};
    if (typeof currentPassword !== 'string' || currentPassword.length === 0) {
      throw new HttpError(400, 'validation_error', 'currentPassword is required.');
    }
    validatePassword(newPassword);
    const ok = await bcrypt.compare(currentPassword, req.user.passwordHash);
    if (!ok) throw new HttpError(401, 'invalid_current_password', 'Current password is incorrect.');
    const passwordHash = await bcrypt.hash(newPassword, config.bcryptRounds);
    await repo.updateUser(req.user.id, { passwordHash });
    await notify(repo, req.user.id, {
      type: 'password_changed',
      title: 'Password changed',
      body: 'Your account password was changed.',
    });
    res.json({ ok: true });
  }

  async function exportData(req, res) {
    const userId = req.user.id;
    const { items: cases } = await repo.listCasesByOwner(userId, { limit: 100000 });
    const evidence = [];
    for (const c of cases) {
      const evs = await repo.listEvidenceByCase(c.id);
      // Metadata only — never file contents or internal stored names.
      evidence.push(...evs.map(({ storedName: _stored, ...meta }) => meta));
    }
    const assessments = [];
    for (const c of cases) assessments.push(...(await repo.listAssessmentsByCase(c.id)));
    const reviews = [];
    for (const c of cases) reviews.push(...(await repo.listReviewsByCase(c.id)));
    const invitations = [];
    for (const c of cases) invitations.push(...(await repo.listInvitationsByCase(c.id)));
    const shareLinks = [];
    for (const c of cases) {
      const links = await repo.listShareLinksByCase(c.id);
      // Token hashes stay server-side.
      shareLinks.push(...links.map(({ tokenHash: _hash, ...meta }) => meta));
    }
    const { items: notifications } = await repo.listNotificationsByUser(userId, { limit: 100000 });

    const payload = {
      exportedAt: new Date().toISOString(),
      user: publicUser(req.user),
      cases,
      evidence,
      assessments,
      reviews,
      invitations,
      shareLinks,
      notifications,
    };
    const filename = `human-court-export-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(payload);
  }

  async function deleteMe(req, res) {
    const { password } = req.body || {};
    if (typeof password !== 'string' || password.length === 0) {
      throw new HttpError(400, 'validation_error', 'Password is required to delete your account.');
    }
    const ok = await bcrypt.compare(password, req.user.passwordHash);
    if (!ok) throw new HttpError(401, 'invalid_credentials', 'Password is incorrect.');
    const userId = req.user.id;

    // Cascade: owned cases (with files, assessments, reviews, invitations, share links),
    // reviews authored elsewhere, notifications, reset tokens, then the user.
    const { items: cases } = await repo.listCasesByOwner(userId, { limit: 100000 });
    for (const c of cases) {
      await deleteCaseCascade(repo, uploadDir, c.id);
    }
    await repo.deleteReviewsByUser(userId);
    await repo.deleteNotificationsByUser(userId);
    await repo.deletePasswordResetsByUser(userId);
    await repo.deleteUser(userId);

    ctx.auth.clearAuthCookie(res);
    res.json({ ok: true });
  }

  return { getMe, patchMe, changePassword, exportData, deleteMe };
}
