// Account settings: profile, notifications, privacy, password, data export, delete.
// All reads and writes go through the server API.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { required, minLength, runRules } from '../utils/validation.js';
import { ApiError } from '../services/api.js';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import Select from '../components/ui/Select.jsx';
import Card from '../components/ui/Card.jsx';
import Alert from '../components/ui/Alert.jsx';
import Modal from '../components/ui/Modal.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import './Settings.css';

const DEFAULT_PREFS = {
  caseUpdates: true,
  reviewActivity: false,
  productNews: false,
};

function friendlyError(err, fallback) {
  if (err instanceof ApiError) return err.message;
  return err?.message || fallback || 'Something went wrong.';
}

export default function Settings() {
  const {
    user,
    updateProfile,
    changePassword,
    deleteAccount,
    exportData,
    logout,
  } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Profile form state.
  const [name, setName] = useState(user?.name || '');
  const [nameError, setNameError] = useState(null);
  const [savingName, setSavingName] = useState(false);

  // Server-backed preferences.
  const [notifPrefs, setNotifPrefs] = useState({ ...DEFAULT_PREFS, ...(user?.notificationPrefs || {}) });
  const [defaultPrivacy, setDefaultPrivacy] = useState(user?.privacy || 'private');
  const [prefsError, setPrefsError] = useState('');
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Change-password form state.
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwErrors, setPwErrors] = useState({});
  const [pwServerError, setPwServerError] = useState('');
  const [changingPw, setChangingPw] = useState(false);

  // Export state.
  const [exporting, setExporting] = useState(false);

  // Delete-account modal state.
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    document.title = 'Settings — Human Court';
  }, []);

  // Keep the forms in sync once the user profile arrives.
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setNotifPrefs({ ...DEFAULT_PREFS, ...(user.notificationPrefs || {}) });
      setDefaultPrivacy(user.privacy || 'private');
    }
  }, [user]);

  // The router guards this page, but stay safe if user is missing.
  if (!user) {
    return (
      <main className="settings-page">
        <div className="settings-inner wizard-center">
          <Spinner label="Loading settings…" />
        </div>
      </main>
    );
  }

  // First letters of the first two name words, e.g. "Abdul Malik" -> "AM".
  const initials = (user.name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

  // --- Profile ---
  async function handleNameSave(e) {
    e.preventDefault();
    const error = runRules(name.trim(), [required]);
    setNameError(error);
    if (error) return;
    setSavingName(true);
    try {
      await updateProfile({ name: name.trim() });
      toast('Display name updated');
    } catch (err) {
      toast(friendlyError(err, 'Could not update your name.'));
    } finally {
      setSavingName(false);
    }
  }

  // --- Notification toggles + default privacy (saved to the server) ---
  async function savePrefs(nextPrefs, nextPrivacy) {
    setSavingPrefs(true);
    setPrefsError('');
    try {
      await updateProfile({ notificationPrefs: nextPrefs, privacy: nextPrivacy });
    } catch (err) {
      setPrefsError(friendlyError(err, 'Could not save your preferences.'));
    } finally {
      setSavingPrefs(false);
    }
  }

  function togglePref(key) {
    return (e) => {
      const next = { ...notifPrefs, [key]: e.target.checked };
      setNotifPrefs(next);
      savePrefs(next, defaultPrivacy);
    };
  }

  function handlePrivacyChange(e) {
    const next = e.target.value;
    setDefaultPrivacy(next);
    savePrefs(notifPrefs, next);
  }

  // --- Change password ---
  async function handlePasswordChange(e) {
    e.preventDefault();
    const nextErrors = {
      currentPassword: runRules(currentPassword, [required]),
      newPassword: runRules(newPassword, [required, minLength(8)]),
      confirmPassword: runRules(confirmPassword, [
        required,
        (value) => (value === newPassword ? null : 'Passwords do not match.'),
      ]),
    };
    setPwErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setChangingPw(true);
    setPwServerError('');
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast('Password changed');
    } catch (err) {
      setPwServerError(friendlyError(err, 'Could not change your password.'));
    } finally {
      setChangingPw(false);
    }
  }

  // --- Export my data (real JSON download from the server) ---
  async function handleExport() {
    setExporting(true);
    try {
      await exportData();
      toast('Export downloaded');
    } catch (err) {
      toast(friendlyError(err, 'Could not export your data.'));
    } finally {
      setExporting(false);
    }
  }

  // --- Delete account (the server cascades: cases, evidence, reviews, etc.) ---
  async function handleDeleteConfirm() {
    setDeleteError('');
    if (!deletePassword) {
      setDeleteError('Please enter your password to confirm.');
      return;
    }
    setDeleting(true);
    try {
      await deleteAccount({ password: deletePassword });
      toast('Account deleted');
      navigate('/', { replace: true });
    } catch (err) {
      setDeleteError(friendlyError(err, 'Could not delete your account.'));
    } finally {
      setDeleting(false);
    }
  }

  // --- Log out ---
  async function handleLogout() {
    await logout();
    toast('Logged out');
    navigate('/', { replace: true });
  }

  return (
    <main className="settings-page">
      <div className="settings-inner">
        <h1 className="settings-title">Settings</h1>
        <p className="settings-sub">
          Manage your account, preferences, and data.
        </p>

        <div className="settings-stack">
          {/* a. Profile */}
          <Card>
            <h2 className="settings-section-title">Profile</h2>
            <div className="settings-profile-row">
              <div className="settings-avatar" aria-hidden="true">
                {initials}
              </div>
              <div>
                <p className="settings-profile-name">
                  {user.name}
                  <span className="verify-badge">Email verification — not yet available</span>
                </p>
                <p className="settings-profile-email">{user.email}</p>
              </div>
            </div>
            <form className="settings-form" onSubmit={handleNameSave} noValidate>
              <Input
                label="Display name"
                id="settings-name"
                name="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={nameError}
              />
              <div>
                <Button variant="secondary" type="submit" loading={savingName}>
                  {savingName ? 'Saving…' : 'Save name'}
                </Button>
              </div>
            </form>
          </Card>

          {/* b. Notifications */}
          <Card>
            <h2 className="settings-section-title">Notifications</h2>
            <p className="settings-section-sub">
              Choose what you want to hear about. Saved to your account.
            </p>
            {prefsError && (
              <Alert variant="error" role="alert">
                {prefsError}
              </Alert>
            )}
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={!!notifPrefs.caseUpdates}
                onChange={togglePref('caseUpdates')}
                disabled={savingPrefs}
              />
              <span>
                <span className="settings-toggle-label">Case updates</span>
              </span>
            </label>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={!!notifPrefs.reviewActivity}
                onChange={togglePref('reviewActivity')}
                disabled={savingPrefs}
              />
              <span>
                <span className="settings-toggle-label">Review activity</span>
              </span>
            </label>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={!!notifPrefs.productNews}
                onChange={togglePref('productNews')}
                disabled={savingPrefs}
              />
              <span>
                <span className="settings-toggle-label">Product news</span>
              </span>
            </label>
          </Card>

          {/* c. Privacy */}
          <Card>
            <h2 className="settings-section-title">Privacy</h2>
            <p className="settings-section-sub">
              Default privacy for new cases you file.
            </p>
            <Select
              label="Default case privacy"
              id="settings-privacy"
              name="defaultPrivacy"
              value={defaultPrivacy}
              onChange={handlePrivacyChange}
              options={[
                { value: 'private', label: 'Private' },
                { value: 'invite-only', label: 'Invite-only' },
              ]}
            />
            <p className="settings-helper">
              Private cases are visible only to you. Invite-only cases are
              visible only to reviewers you invite.
            </p>
          </Card>

          {/* d. Change password */}
          <Card>
            <h2 className="settings-section-title">Change password</h2>
            <p className="settings-section-sub">
              Your password is stored securely on our servers.
            </p>
            {pwServerError && (
              <Alert variant="error" role="alert">
                {pwServerError}
              </Alert>
            )}
            <form
              className="settings-form"
              onSubmit={handlePasswordChange}
              noValidate
            >
              <Input
                label="Current password"
                id="settings-current-password"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                error={pwErrors.currentPassword}
              />
              <Input
                label="New password"
                id="settings-new-password"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                error={pwErrors.newPassword}
              />
              <Input
                label="Confirm new password"
                id="settings-confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={pwErrors.confirmPassword}
              />
              <div>
                <Button variant="secondary" type="submit" loading={changingPw}>
                  {changingPw ? 'Updating…' : 'Change password'}
                </Button>
              </div>
            </form>
          </Card>

          {/* e. Export my data */}
          <Card>
            <h2 className="settings-section-title">Export my data</h2>
            <p className="settings-section-sub">
              Download everything stored about you as a JSON file — your
              profile, cases, evidence metadata, and reviews.
            </p>
            <Button variant="secondary" onClick={handleExport} loading={exporting}>
              {exporting ? 'Preparing…' : 'Download my data (JSON)'}
            </Button>
          </Card>

          {/* f. Delete account (danger zone) */}
          <Card className="settings-danger">
            <h2 className="settings-section-title">Danger zone</h2>
            <p className="settings-section-sub">
              Deleting your account permanently removes your account and
              everything attached to it — cases, evidence, and reviews. This
              cannot be undone.
            </p>
            <div className="settings-danger-actions">
              <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                Delete account and all my cases
              </Button>
            </div>
          </Card>

          {/* g. Log out */}
          <div className="settings-footer">
            <Button variant="secondary" onClick={handleLogout}>
              Log out
            </Button>
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      <Modal
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setDeleteError('');
          setDeletePassword('');
        }}
        title="Delete your account?"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteConfirm}
              loading={deleting}
            >
              {deleting ? 'Deleting…' : 'Yes, delete everything'}
            </Button>
          </>
        }
      >
        {deleteError && (
          <Alert variant="error" role="alert">
            {deleteError}
          </Alert>
        )}
        <p>
          This will permanently delete your account and{' '}
          <strong>all cases you have filed</strong>. This cannot be undone.
        </p>
        <Input
          label="Confirm with your password"
          id="delete-password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={deletePassword}
          onChange={(e) => setDeletePassword(e.target.value)}
        />
      </Modal>
    </main>
  );
}
