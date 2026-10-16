import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import Card from '../components/ui/Card.jsx';
import Alert from '../components/ui/Alert.jsx';
import { required, isEmail, runRules } from '../utils/validation.js';
import './Auth.css';

// Login page. Server-backed auth — the session cookie is set by the server.
export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({}); // per-field errors shown under each input
  const [serverError, setServerError] = useState(''); // e.g. wrong email/password
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = 'Log in — Human Court';
  }, []);

  // Already signed in? Go straight to the dashboard.
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();

    // Validate each field before calling the auth API.
    const nextErrors = {
      email: runRules(email.trim(), [required, isEmail]),
      password: runRules(password, [required]),
    };
    setErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) return;

    setLoading(true);
    setServerError('');
    try {
      await login({ email: email.trim(), password });
      // Return to the page that required login, or the dashboard.
      navigate(location.state?.from || '/dashboard', { replace: true });
    } catch (err) {
      setServerError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <Card className="auth-card">
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-sub">Log in to your Human Court account.</p>

        {new URLSearchParams(location.search).get('reset') === 'done' && (
          <Alert variant="success" role="status">
            Your password was reset. Log in with your new password.
          </Alert>
        )}

        {serverError && (
          <Alert variant="error" role="alert">
            {serverError}
          </Alert>
        )}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <Input
            label="Email"
            id="login-email"
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
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
          />
          <Button
            variant="primary"
            type="submit"
            loading={loading}
            className="auth-submit"
          >
            {loading ? 'Logging in…' : 'Log in'}
          </Button>
        </form>

        <nav className="auth-links" aria-label="Account links">
          <Link to="/signup">Create an account</Link>
          <Link to="/forgot-password">Forgot password?</Link>
        </nav>
      </Card>
    </main>
  );
}
