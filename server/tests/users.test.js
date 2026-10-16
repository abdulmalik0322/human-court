// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createTestApp, registerAndLogin, createCase } from './helpers.js';

let app;
let alice;

beforeAll(async () => {
  app = await createTestApp();
  alice = app.agentFor();
  await registerAndLogin(alice, { name: 'Alice', email: 'alice@example.com', password: 'password123' });
});

afterAll(() => {
  app.cleanup();
});

describe('users', () => {
  it('updates profile fields with validation', async () => {
    const res = await alice.patch('/api/users/me').send({
      name: 'Alice Updated',
      notificationPrefs: { review_submitted: false },
    });
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Alice Updated');
    expect(res.body.user.notificationPrefs.review_submitted).toBe(false);
    expect(res.body.user.passwordHash).toBeUndefined();

    const bad = await alice.patch('/api/users/me').send({ name: '' });
    expect(bad.status).toBe(400);
  });

  it('changes the password and notifies', async () => {
    const wrong = await alice.post('/api/users/me/change-password').send({
      currentPassword: 'nope-nope-nope',
      newPassword: 'newpassword123',
    });
    expect(wrong.status).toBe(401);

    const ok = await alice.post('/api/users/me/change-password').send({
      currentPassword: 'password123',
      newPassword: 'newpassword123',
    });
    expect(ok.status).toBe(200);

    const notifs = await alice.get('/api/notifications');
    expect(notifs.body.items.some((n) => n.type === 'password_changed')).toBe(true);

    // New password works for a fresh login.
    const fresh = app.agentFor();
    const login = await fresh.post('/api/auth/login').send({ email: 'alice@example.com', password: 'newpassword123' });
    expect(login.status).toBe(200);
  });

  it('exports all user data as a JSON download', async () => {
    await createCase(alice, { title: 'Export case' });
    const res = await alice.get('/api/users/me/export');
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    expect(res.body.user.email).toBe('alice@example.com');
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(Array.isArray(res.body.cases)).toBe(true);
    expect(res.body.cases.length).toBeGreaterThanOrEqual(1);
    for (const key of ['evidence', 'assessments', 'reviews', 'invitations', 'shareLinks', 'notifications']) {
      expect(Array.isArray(res.body[key])).toBe(true);
    }
  });

  it('lists notifications with unreadCount and marks them read', async () => {
    const list = await alice.get('/api/notifications');
    expect(list.status).toBe(200);
    expect(typeof list.body.unreadCount).toBe('number');
    expect(list.body.total).toBe(list.body.items.length);
    expect(list.body.page).toBe(1);

    const first = list.body.items[0];
    const read = await alice.patch(`/api/notifications/${first.id}/read`);
    expect(read.status).toBe(200);
    expect(read.body.notification.read).toBe(true);

    const after = await alice.get('/api/notifications');
    expect(after.body.unreadCount).toBe(list.body.unreadCount - 1);
  });

  it('requires the password to delete the account', async () => {
    const bad = await alice.delete('/api/users/me').send({ password: 'wrong-password' });
    expect(bad.status).toBe(401);
  });

  it('cascade-deletes everything owned by the user', async () => {
    const doomed = app.agentFor();
    const user = await registerAndLogin(doomed, { name: 'Doomed', email: 'doomed@example.com', password: 'password123' });
    const c = await createCase(doomed, { title: 'Doomed case' });
    const up = await doomed.post(`/api/cases/${c.id}/evidence`).attach('file', Buffer.from('data'), 'note.txt');
    expect(up.status).toBe(201);
    const storedName = (await app.repo.listEvidenceByCase(c.id))[0].storedName;
    expect(existsSync(join(app.uploadDir, storedName))).toBe(true);

    const del = await doomed.delete('/api/users/me').send({ password: 'password123' });
    expect(del.status).toBe(200);

    // Data is gone.
    expect(await app.repo.getUserById(user.id)).toBeNull();
    expect(await app.repo.getCaseById(c.id)).toBeNull();
    expect(existsSync(join(app.uploadDir, storedName))).toBe(false);
    const { total } = await app.repo.listNotificationsByUser(user.id, {});
    expect(total).toBe(0);

    // Session is cleared.
    const me = await doomed.get('/api/auth/me');
    expect(me.status).toBe(401);
  });
});
