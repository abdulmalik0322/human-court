// Auth controller: register, login, logout, me, forgot/reset password.
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { HttpError } from '../middleware/errorHandler.js';
import { publicUser } from './helpers.js';
import { sha256 } from '../utils/ids.js';
import { notify } from '../services/notifications.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

function validateEmail(email) {
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    throw new HttpError(400, 'validation_error', 'A valid email address is required.');
  }
  return email.trim().toLowerCase();
}

function validatePassword(password, field = 'password') {
  if (typeof password !== 'string' || password.length < 8) {
    throw new HttpError(400, 'validation_error', `${field} must be at least 8 characters.`);
  }
  return password;
}

export function createAuthController(ctx) {
  const { repo, config, auth, mailer } = ctx;

  async function register(req, res) {
    const { name, email, password } = req.body || {};
    if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 100) {
      throw new HttpError(400, 'validation_error', 'Name is required (max 100 characters).');
    }
    const cleanEmail = validateEmail(email);
    validatePassword(password);
    const existing = await repo.getUserByEmail(cleanEmail);
    if (existing) throw new HttpError(409, 'email_taken', 'An account with this email already exists.');
    const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
    const user = await repo.createUser({
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      notificationPrefs: {},
      privacy: {},
    });
    // Registering also signs the user in (the frontend relies on this).
    auth.setAuthCookie(res, auth.signToken(user.id));
    res.status(201).json({ user: publicUser(user) });
  }

  async function login(req, res) {
    const { email, password } = req.body || {};
    const cleanEmail = validateEmail(email);
    if (typeof password !== 'string' || password.length === 0) {
      throw new HttpError(400, 'validation_error', 'Password is required.');
    }
    const user = await repo.getUserByEmail(cleanEmail);
    // Same response whether the email or the password is wrong.
    const ok = user && (await bcrypt.compare(password, user.passwordHash));
    if (!ok) throw new HttpError(401, 'invalid_credentials', 'Email or password is incorrect.');
    auth.setAuthCookie(res, auth.signToken(user.id));
    res.json({ user: publicUser(user) });
  }

  async function logout(_req, res) {
    auth.clearAuthCookie(res);
    res.json({ ok: true });
  }

  async function me(req, res) {
    res.json({ user: publicUser(req.user) });
  }

  async function forgotPassword(req, res) {
    const { email } = req.body || {};
    const cleanEmail = validateEmail(email);
    const generic = 'If an account exists for that email, a 6-digit verification code has been sent.';
    const user = await repo.getUserByEmail(cleanEmail);
    if (!user) return res.json({ message: generic });

    // One active OTP per user: invalidate any previous codes first.
    await repo.deletePasswordResetsByUser(user.id);
    const otp = String(crypto.randomInt(100000, 1000000));
    await repo.createPasswordReset({
      userId: user.id,
      otpHash: sha256(otp),
      attempts: 0,
      expiresAt: new Date(Date.now() + OTP_TTL_MS).toISOString(),
    });

    if (mailer) {
      try {
        await mailer.sendPasswordOtp({ to: user.email, otp });
      } catch (err) {
        console.error(`[auth] password-reset email failed: ${err.message}`);
        await repo.deletePasswordResetsByUser(user.id);
        return res
          .status(502)
          .json({ error: { code: 'email_failed', message: 'Could not send the verification code. Please try again later.' } });
      }
      return res.json({ message: generic });
    }
    if (!config.isProd) {
      // Honest dev fallback: no email is actually sent.
      return res.json({ message: generic, otp, note: 'development only — no email sent' });
    }
    // Production without email configured: say so plainly, never fake delivery.
    return res.status(503).json({
      error: {
        code: 'email_not_configured',
        message: 'Password reset email is not configured on this server. Please contact the administrator.',
      },
    });
  }

  function otpMatches(record, otp) {
    const a = Buffer.from(record.otpHash || '', 'utf8');
    const b = Buffer.from(sha256(String(otp || '')), 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  async function resetPassword(req, res) {
    const { email, otp, newPassword } = req.body || {};
    const cleanEmail = validateEmail(email);
    if (typeof otp !== 'string' || !/^\d{6}$/.test(otp.trim())) {
      throw new HttpError(400, 'validation_error', 'A 6-digit verification code is required.');
    }
    validatePassword(newPassword, 'newPassword');
    const user = await repo.getUserByEmail(cleanEmail);
    // Same response whether the email is wrong or the code is wrong.
    const record = user ? await repo.getPasswordResetByUserId(user.id) : null;
    const expired = !record || new Date(record.expiresAt).getTime() < Date.now();
    if (expired) {
      if (record) await repo.deletePasswordReset(record.id);
      throw new HttpError(400, 'invalid_or_expired_code', 'This verification code is invalid or has expired. Request a new one.');
    }
    if (!otpMatches(record, otp.trim())) {
      const attempts = (record.attempts || 0) + 1;
      if (attempts >= OTP_MAX_ATTEMPTS) {
        await repo.deletePasswordReset(record.id);
        throw new HttpError(429, 'too_many_attempts', 'Too many wrong attempts. Request a new verification code.');
      }
      await repo.updatePasswordReset(record.id, { attempts });
      throw new HttpError(400, 'invalid_or_expired_code', 'This verification code is invalid or has expired. Request a new one.');
    }
    const passwordHash = await bcrypt.hash(newPassword, config.bcryptRounds);
    await repo.updateUser(record.userId, { passwordHash });
    await repo.deletePasswordResetsByUser(record.userId);
    await notify(repo, record.userId, {
      type: 'password_changed',
      title: 'Password changed',
      body: 'Your password was reset with a verification code.',
    });
    res.json({ ok: true });
  }

  return { register, login, logout, me, forgotPassword, resetPassword };
}
