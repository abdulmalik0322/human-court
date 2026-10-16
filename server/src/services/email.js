// Password-reset email. Returns null when no SMTP provider is
// configured — callers then fall back to the honest dev/prod behavior.
import nodemailer from 'nodemailer';
import { emailConfigured } from '../config/env.js';

export function createMailer(config) {
  if (!emailConfigured(config)) return null;
  const transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.port === 465,
    auth: { user: config.email.user, pass: config.email.pass },
  });
  return {
    async sendPasswordReset({ to, resetUrl }) {
      await transporter.sendMail({
        from: config.email.from,
        to,
        subject: 'Reset your Human Court password',
        text:
          `You requested a password reset for your Human Court account.\n\n` +
          `Reset your password here (valid for 1 hour):\n${resetUrl}\n\n` +
          `If you did not request this, you can ignore this email.`,
      });
    },
    async sendPasswordOtp({ to, otp }) {
      await transporter.sendMail({
        from: config.email.from,
        to,
        subject: 'Your Human Court verification code',
        text:
          `You requested a password reset for your Human Court account.\n\n` +
          `Your verification code is: ${otp}\n\n` +
          `Enter this code in the app within 10 minutes to set a new password.\n` +
          `If you did not request this, you can ignore this email.`,
      });
    },
  };
}
