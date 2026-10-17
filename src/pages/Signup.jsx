import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import Card from '../components/ui/Card.jsx';
import Alert from '../components/ui/Alert.jsx';
import { required, isEmail, minLength, runRules } from '../utils/validation.js';
import './Auth.css';

// Signup page. Server-backed auth — accounts are created on the server.
export default function Signup() {
  const { user, register } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({}); // per-field errors shown under each input
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = 'Create your account — Human Court';
  }, []);

  // Already signed in? Go straight to the dashboard.
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();

    // Validate each field before creating the account.
    const nextErrors = {
      name: runRules(name.trim(), [required]),
      email: runRules(email.trim(), [required, isEmail]),
      password: runRules(password, [required, minLength(8)]),
      confirm: runRules(confirm, [
        required,
        (value) => (value === password ? null : 'Passwords do not match.'),
      ]),
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setLoading(true);
    setServerError('');
    try {
      // register() also signs the user in, so no separate login step is needed.
      await register({ name: name.trim(), email: email.trim(), password });
      toast('Account created');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setServerError(err.message || 'Could not create your account. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <Card className="auth-card">
        <h1 className="auth-title">Create your account</h1>
        <p className="auth-sub">Start filing cases with Human Court.</p>

        {serverError && (
          <Alert variant="error" role="alert">
            {serverError}
          </Alert>
        )}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <Input
            label="Display name"
            id="signup-name"
            name="name"
            type="text"
            autoComplete="name"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
          />
          <Input
            label="Email"
            id="signup-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
          />
          <Input
            label="Password"
            id="signup-password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
          />
          <Input
            label="Confirm password"
            id="signup-confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            placeholder="Repeat your password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={errors.confirm}
          />
          <Button
            variant="primary"
            type="submit"
            loading={loading}
            className="auth-submit"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </Button>
        </form>

        <nav className="auth-links auth-links--center" aria-label="Account links">
          <Link to="/login">Already have an account? Log in</Link>
        </nav>
      </Card>
    </main>
  );
}
