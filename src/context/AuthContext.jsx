// Human Court — session context backed by the real server API.
//
// Authentication is session-based: the server sets an httpOnly cookie on
// login/register, so the client never sees a token. This module calls
// /api/auth/* via the shared api client and keeps only the public user
// profile ({ id, name, email, verified, createdAt, notificationPrefs, privacy })
// in React state.
//
// Honest labels kept: email verification is not implemented server-side yet,
// so the UI shows "Not yet available" — never claims verification works.

import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../services/api.js';

const AuthContext = createContext(null);

// Normalize the server's user payload to the shape the app uses.
function publicUser(serverUser) {
  if (!serverUser) return null;
  return {
    id: serverUser.id,
    name: serverUser.name,
    email: serverUser.email,
    verified: serverUser.verified ?? false,
    createdAt: serverUser.createdAt,
    notificationPrefs: serverUser.notificationPrefs ?? null,
    privacy: serverUser.privacy ?? null,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  // On first mount, ask the server who is signed in (the cookie decides).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get('/auth/me');
        if (!cancelled) setUser(publicUser(data?.user ?? data));
      } catch {
        // 401 (not signed in) and network errors both mean "no user".
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Create an account; the server signs the user in (sets the cookie).
  async function register({ name, email, password }) {
    const data = await api.post('/auth/register', {
      name: (name || '').trim(),
      email: (email || '').trim(),
      password,
    });
    const pub = publicUser(data?.user ?? data);
    setUser(pub);
    return pub;
  }

  // Log in; the server sets the httpOnly session cookie.
  async function login({ email, password }) {
    const data = await api.post('/auth/login', {
      email: (email || '').trim(),
      password,
    });
    const pub = publicUser(data?.user ?? data);
    setUser(pub);
    return pub;
  }

  async function logout() {
    try {
      await api.post('/auth/logout');
    } catch {
      // Logout is idempotent client-side: even if the request fails, the
      // local session is cleared. The server cookie may persist, but we
      // cannot rely on a logout call that already failed.
    }
    setUser(null);
  }

  // Profile fields (name, notificationPrefs, privacy).
  async function updateProfile({ name, notificationPrefs, privacy }) {
    if (!user) throw new Error('You are not logged in.');
    const patch = {};
    if (name !== undefined) patch.name = name;
    if (notificationPrefs !== undefined) patch.notificationPrefs = notificationPrefs;
    if (privacy !== undefined) patch.privacy = privacy;
    const data = await api.patch('/users/me', patch);
    const pub = publicUser(data?.user ?? data);
    setUser(pub);
    return pub;
  }

  async function changePassword({ currentPassword, newPassword }) {
    if (!user) throw new Error('You are not logged in.');
    await api.post('/users/me/change-password', { currentPassword, newPassword });
    return true;
  }

  // Forgot-password: the server sends the reset email itself. The response
  // message is shown VERBATIM — we never claim an email was sent; the server
  // tells us what it did. A dev-only OTP may be returned in dev.
  async function forgotPassword({ email }) {
    const data = await api.post('/auth/forgot-password', {
      email: (email || '').trim(),
    });
    return data; // { message, otp?, note? }
  }

  async function resetPassword({ email, otp, newPassword }) {
    await api.post('/auth/reset-password', {
      email: (email || '').trim(),
      otp,
      newPassword,
    });
    return true;
  }

  // Export: real JSON download from the server (all cases, evidence metadata, etc.).
  async function exportData() {
    const filename = `human-court-export-${user?.id || 'account'}.json`;
    await api.download('/users/me/export', filename);
    return true;
  }

  // Delete account: the server cascades (cases, evidence, reviews, etc.).
  async function deleteAccount({ password }) {
    if (!user) throw new Error('You are not logged in.');
    await api.delete('/users/me', { password });
    setUser(null);
    return true;
  }

  // Refresh the user from the server (after external changes).
  async function refreshUser() {
    const data = await api.get('/auth/me');
    const pub = publicUser(data?.user ?? data);
    setUser(pub);
    return pub;
  }

  const value = {
    user,
    initializing,
    register,
    login,
    logout,
    updateProfile,
    changePassword,
    forgotPassword,
    resetPassword,
    exportData,
    deleteAccount,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
