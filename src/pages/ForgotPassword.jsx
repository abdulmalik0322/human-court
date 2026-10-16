// Forgot password page — 2-step OTP flow.
//
// Step 1: user enters their email -> server sends a 6-digit verification
// code to the account email (or returns it honestly-labeled in dev).
// Step 2: user enters the code + a new password -> password is reset.
//
// The server's message is shown VERBATIM — this page never claims an email
// was sent; the server tells us what it did.
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ApiError } from '../services/api.js';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import Card from '../components/ui/Card.jsx';
import Alert from '../components/ui/Alert.jsx';
import { required, isEmail, minLength, runRules } from '../utils/validation.js';
import './Auth.css';

export default function ForgotPassword() {
  const { user, forgotPassword, resetPassword } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [serverMessage, setServerMessage] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = 'Reset your password — Human Court';
  }, []);

  // Already signed in? Go straight to the dashboard.
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSendCode(e) {
    e.preventDefault();
    const emailError = runRules(email.trim(), [required, isEmail]);
    setErrors(emailError ? { email: emailError } : {});
    if (emailError) return;

    setLoading(true);
    setServerError('');
    try {
      const data = await forgotPassword({ email: email.trim() });
      setServerMessage(data?.message || 'If an account exists for that email, a 6-digit verification code has been sent.');
      setDevOtp(data?.otp || '');
      setStep(2);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Could not send the code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e) {
    e.preventDefault();
    const next = {};
    const otpError = runRules(otp.trim(), [required, (v) => (/^\d{6}$/.test(v) ? null : 'Enter the 6-digit code.')]);
    if (otpError) next.otp = otpError;
    const pwError = runRules(newPassword, [required, minLength(8)]);
    if (pwError) next.newPassword = pwError;
    if (!pwError && newPassword !== confirm) next.confirm = 'Passwords do not match.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    setServerError('');
    try {
      await resetPassword({ email: email.trim(), otp: otp.trim(), newPassword });
      navigate('/login?reset=done');
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Could not reset your password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <Card className="auth-card">
        <h1 className="auth-title">Reset your password</h1>

        {step === 1 && (
          <>
            <p className="auth-sub">Enter the email address you used for your account. We will send you a 6-digit verification code.</p>
            {serverError && <Alert variant="error" role="alert">{serverError}</Alert>}
            <form className="auth-form" onSubmit={handleSendCode} noValidate>
              <Input
                label="Email"
                id="forgot-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={errors.email}
              />
              <Button variant="primary" type="submit" className="auth-submit" loading={loading}>
                {loading ? 'Sending…' : 'Send verification code'}
              </Button>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <p className="auth-sub">Enter the 6-digit code we sent to <strong>{email}</strong>, then choose a new password.</p>
            {serverMessage && <Alert variant="success" role="status">{serverMessage}</Alert>}
            {serverError && <Alert variant="error" role="alert">{serverError}</Alert>}
            {devOtp && (
              <Alert variant="warning" title="Development only — no email sent">
                The development server returned this code instead of sending an email:
                <p><code className="case-id">{devOtp}</code></p>
              </Alert>
            )}
            <form className="auth-form" onSubmit={handleReset} noValidate>
              <Input
                label="Verification code"
                id="forgot-otp"
                name="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                error={errors.otp}
              />
              <Input
                label="New password"
                id="forgot-new-password"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                error={errors.newPassword}
              />
              <Input
                label="Confirm new password"
                id="forgot-confirm"
                name="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                error={errors.confirm}
              />
              <Button variant="primary" type="submit" className="auth-submit" loading={loading}>
                {loading ? 'Resetting…' : 'Reset password'}
              </Button>
              <Button variant="ghost" type="button" onClick={() => { setStep(1); setServerError(''); }}>
                Use a different email
              </Button>
            </form>
          </>
        )}

        <nav className="auth-links auth-links--center" aria-label="Account links">
          <Link to="/login">Back to log in</Link>
        </nav>
      </Card>
    </main>
  );
}
