// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, registerAndLogin } from './helpers.js';

let app;
let agent;

beforeAll(async () => {
  app = await createTestApp();
  agent = app.agentFor();
});

afterAll(() => {
  app.cleanup();
});

describe('auth', () => {
  it('registers a user and never returns the password hash', async () => {
    const res = await agent.post('/api/auth/register').send({
      name: 'Abdul',
      email: 'abdul@example.com',
      password: 'password123',
    });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('abdul@example.com');
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.user.id).toBeTruthy();
  });

  it('register also signs the user in (sets the httpOnly cookie)', async () => {
    // The signup page relies on this: after register, the user must have
    // a session without a separate login step.
    const res = await agent.post('/api/auth/register').send({
      name: 'Cookie Check',
      email: 'cookiecheck@example.com',
      password: 'password123',
    });
    expect(res.status).toBe(201);
    const cookies = res.headers['set-cookie'] || [];
    const tokenCookie = cookies.find((c) => c.startsWith('hc_token='));
    expect(tokenCookie).toBeTruthy();
    expect(tokenCookie).toMatch(/httponly/i);
  });

  it('rejects duplicate emails', async () => {
    const res = await agent.post('/api/auth/register').send({
      name: 'Abdul 2',
      email: 'abdul@example.com',
      password: 'password123',
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('email_taken');
  });

  it('rejects invalid registration input', async () => {
    const badEmail = await agent.post('/api/auth/register').send({ name: 'X', email: 'nope', password: 'password123' });
    expect(badEmail.status).toBe(400);
    const shortPw = await agent.post('/api/auth/register').send({ name: 'X', email: 'x2@example.com', password: 'short' });
    expect(shortPw.status).toBe(400);
    const noName = await agent.post('/api/auth/register').send({ email: 'x3@example.com', password: 'password123' });
    expect(noName.status).toBe(400);
  });

  it('logs in, sets the httpOnly cookie, and serves /me', async () => {
    const login = await agent.post('/api/auth/login').send({ email: 'abdul@example.com', password: 'password123' });
    expect(login.status).toBe(200);
    expect(login.body.user.passwordHash).toBeUndefined();
    const cookies = login.headers['set-cookie'] || [];
    const tokenCookie = cookies.find((c) => c.startsWith('hc_token='));
    expect(tokenCookie).toBeTruthy();
    expect(tokenCookie).toMatch(/httponly/i);

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('abdul@example.com');
  });

  it('rejects wrong passwords without saying which part was wrong', async () => {
    const res = await agent.post('/api/auth/login').send({ email: 'abdul@example.com', password: 'wrongpassword' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('invalid_credentials');
    const unknown = await agent.post('/api/auth/login').send({ email: 'nobody@example.com', password: 'password123' });
    expect(unknown.status).toBe(401);
    expect(unknown.body.error.code).toBe('invalid_credentials');
  });

  it('returns 401 for protected routes without a session', async () => {
    const fresh = app.agentFor();
    const res = await fresh.get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthorized');
  });

  it('logs out and clears the session', async () => {
    const out = await agent.post('/api/auth/logout');
    expect(out.status).toBe(200);
    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(401);
  });

  it('forgot-password returns a dev OTP honestly labeled (no email configured)', async () => {
    await registerAndLogin(app.agentFor(), { email: 'reset@example.com' });
    const res = await agent.post('/api/auth/forgot-password').send({ email: 'reset@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.otp).toMatch(/^\d{6}$/);
    expect(res.body.note).toMatch(/no email sent/);

    const reset = await agent
      .post('/api/auth/reset-password')
      .send({ email: 'reset@example.com', otp: res.body.otp, newPassword: 'newpassword123' });
    expect(reset.status).toBe(200);

    const login = await agent.post('/api/auth/login').send({ email: 'reset@example.com', password: 'newpassword123' });
    expect(login.status).toBe(200);
  });

  it('rejects wrong OTPs and locks out after 5 attempts', async () => {
    await registerAndLogin(app.agentFor(), { email: 'otplock@example.com' });
    const res = await agent.post('/api/auth/forgot-password').send({ email: 'otplock@example.com' });
    expect(res.status).toBe(200);
    // 4 wrong attempts -> 400
    for (let i = 0; i < 4; i++) {
      const bad = await agent
        .post('/api/auth/reset-password')
        .send({ email: 'otplock@example.com', otp: '000000', newPassword: 'newpassword123' });
      expect(bad.status).toBe(400);
      expect(bad.body.error.code).toBe('invalid_or_expired_code');
    }
    // 5th wrong attempt -> 429 lockout, code invalidated
    const locked = await agent
      .post('/api/auth/reset-password')
      .send({ email: 'otplock@example.com', otp: '000000', newPassword: 'newpassword123' });
    expect(locked.status).toBe(429);
    expect(locked.body.error.code).toBe('too_many_attempts');
    // Even the correct OTP no longer works after lockout
    const after = await agent
      .post('/api/auth/reset-password')
      .send({ email: 'otplock@example.com', otp: res.body.otp, newPassword: 'newpassword123' });
    expect(after.status).toBe(400);
  });

  it('rejects invalid or reused OTPs', async () => {
    const bad = await agent.post('/api/auth/reset-password').send({ email: 'reset@example.com', otp: '123456', newPassword: 'newpassword123' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('invalid_or_expired_code');
  });

  it('does not leak whether an email exists on forgot-password', async () => {
    const res = await agent.post('/api/auth/forgot-password').send({ email: 'ghost@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.otp).toBeUndefined();
  });
});
