// @vitest-environment jsdom
// REPRODUCTION tests for the reported bug:
// "fill the first form, click Next, but it does not go to the next step."
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from '../components/ui/Toast.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';

// The wizard now talks to src/services/api.js — mock it so these
// validation/Next behavior tests run offline. The API client keeps the same
// shape the wizard uses (get/post/patch/delete + uploadWithProgress).
// AuthContext calls GET /api/auth/me on mount, so the mock answers it with
// a signed-in user, mirroring what the real server would return.
vi.mock('../services/api.js', () => ({
  api: {
    get: vi.fn((path) => {
      if (path === '/auth/me') {
        return Promise.resolve({
          user: {
            id: 'hu_test1',
            name: 'Tester',
            email: 't@t.com',
            verified: false,
            createdAt: new Date().toISOString(),
          },
        });
      }
      return Promise.resolve(null);
    }),
    post: vi.fn().mockResolvedValue(null),
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

import NewCaseWizard from '../pages/NewCaseWizard.jsx';

function seedUser() {
  const u = {
    id: 'hu_test1', name: 'Tester', email: 't@t.com', emailLower: 't@t.com',
    verified: false, createdAt: new Date().toISOString(), salt: 'x', passwordHash: 'y',
  };
  localStorage.setItem('hc_users_v1', JSON.stringify([u]));
  localStorage.setItem('hc_session_v1', JSON.stringify('hu_test1'));
}

function renderWizard() {
  return render(
    <MemoryRouter initialEntries={['/cases/new']}>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/cases/new" element={<NewCaseWizard />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>
  );
}

describe('wizard Next button (bug repro)', () => {
  beforeEach(() => {
    localStorage.clear();
    seedUser();
  });

  afterEach(() => {
    cleanup();
  });

  it('advances from Basics to Perspectives after filling required fields', async () => {
    const { container } = renderWizard();

    // Wait for the wizard to render (auth restores from localStorage).
    await screen.findByText('File a new case');

    const basics = container.querySelector('section[aria-label="Basics"]');
    expect(basics).toBeTruthy();

    fireEvent.change(basics.querySelector('input[type="text"]'), {
      target: { value: 'Roommate rent dispute' },
    });
    fireEvent.change(basics.querySelector('textarea'), {
      target: { value: 'My roommate and I disagree about the electricity bill split for March.' },
    });
    fireEvent.change(basics.querySelector('select'), {
      target: { value: 'Roommates' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    // The wizard should now show step 2 (Perspectives).
    await waitFor(() => {
      expect(container.querySelector('section[aria-label="Perspectives"]')).toBeTruthy();
    }, { timeout: 3000 });

    // And no blocking error should be shown.
    expect(container.querySelector('.alert-error')).toBeNull();
  });

  it('blocks Next and shows errors when category is missing', async () => {
    const { container } = renderWizard();
    await screen.findByText('File a new case');

    const basics = container.querySelector('section[aria-label="Basics"]');
    fireEvent.change(basics.querySelector('input[type="text"]'), {
      target: { value: 'Roommate rent dispute' },
    });
    fireEvent.change(basics.querySelector('textarea'), {
      target: { value: 'We disagree about the bill split.' },
    });
    // NOTE: category intentionally left unselected.

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(container.querySelector('.alert-error')).toBeTruthy();
    });
    // Still on step 1:
    expect(container.querySelector('section[aria-label="Basics"]')).toBeTruthy();
    expect(container.querySelector('section[aria-label="Perspectives"]')).toBeNull();
    // The fix: focus must move to the first invalid field so the user
    // notices what is missing (previously the button appeared to do nothing).
    await waitFor(() => {
      expect(document.activeElement?.id).toBe('wiz-category');
    });
  });
});
