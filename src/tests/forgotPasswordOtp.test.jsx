// @vitest-environment jsdom
// Tests the 2-step OTP forgot-password flow:
// email -> code sent -> enter OTP + new password -> reset -> redirect to login.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from '../components/ui/Toast.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';

const postMock = vi.fn((path, body) => {
  if (path === '/auth/forgot-password') {
    return Promise.resolve({ message: 'If an account exists for that email, a 6-digit verification code has been sent.', otp: '123456', note: 'development only — no email sent' });
  }
  if (path === '/auth/reset-password') {
    expect(body.email).toBe('user@example.com');
    expect(body.otp).toBe('123456');
    expect(body.newPassword).toBe('brandnewpass1');
    return Promise.resolve({ ok: true });
  }
  return Promise.resolve(null);
});

vi.mock('../services/api.js', () => ({
  api: {
    get: vi.fn((path) => {
      if (path === '/auth/me') return Promise.reject(Object.assign(new Error('no session'), { status: 401 }));
      return Promise.resolve(null);
    }),
    post: (...args) => postMock(...args),
    patch: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(null),
    download: vi.fn().mockResolvedValue(undefined),
    uploadWithProgress: vi.fn().mockResolvedValue({}),
  },
  ApiError: class ApiError extends Error {
    constructor({ status, code, message } = {}) {
      super(message || 'Request failed.');
      this.name = 'ApiError';
      this.status = status ?? null;
      this.code = code || null;
    }
  },
}));

import ForgotPassword from '../pages/ForgotPassword.jsx';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/forgot-password']}>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/login" element={<div>login page</div>} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>
  );
}

describe('forgot-password OTP flow', () => {
  beforeEach(() => { localStorage.clear(); postMock.mockClear(); });
  afterEach(() => { cleanup(); });

  it('sends a code, then resets the password with the OTP', async () => {
    renderPage();
    await screen.findByText('Reset your password');

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send verification code/i }));

    // Step 2 appears with the dev OTP shown.
    await screen.findByText(/6-digit code we sent/i);
    expect(screen.getByText('123456')).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/verification code/i), { target: { value: '123456' } });
    fireEvent.change(screen.getByLabelText(/^new password/i), { target: { value: 'brandnewpass1' } });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: 'brandnewpass1' } });
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText('login page')).toBeTruthy();
    }, { timeout: 3000 });
    expect(postMock).toHaveBeenCalledWith('/auth/reset-password', expect.objectContaining({ otp: '123456' }));
  });

  it('blocks a malformed OTP client-side', async () => {
    renderPage();
    await screen.findByText('Reset your password');

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send verification code/i }));
    await screen.findByText(/6-digit code we sent/i);

    fireEvent.change(screen.getByLabelText(/verification code/i), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText(/^new password/i), { target: { value: 'brandnewpass1' } });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: 'brandnewpass1' } });
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    await screen.findByText('Enter the 6-digit code.');
    expect(postMock).not.toHaveBeenCalledWith('/auth/reset-password', expect.anything());
  });
});
