// @vitest-environment jsdom
// REPRODUCTION for Abdul's 2026-10-14 01:10 PKT report:
// on wizard step 2 (Perspectives), with both statements filled, clicking
// Next did not advance to step 3 (Evidence).
//
// Root cause found: validateStep for step 2 called `required("Person A's
// statement")` directly instead of wrapping it as `(v) => required(v, ...)`.
// `required` is a direct validator (not a rule factory), so it executed
// immediately, returned null, and runRules threw "r is not a function" —
// a silent crash on every Next click at step 2, for any input.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from '../components/ui/Toast.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';

vi.mock('../services/api.js', () => ({
  api: {
    get: vi.fn((path) => {
      if (path === '/auth/me') {
        return Promise.resolve({
          user: { id: 'hu_test1', name: 'Tester', email: 't@t.com', createdAt: new Date().toISOString() },
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

async function fillBasicsAndGoToPerspectives(container) {
  await screen.findByText('File a new case');
  const basics = container.querySelector('section[aria-label="Basics"]');
  fireEvent.change(basics.querySelector('input[type="text"]'), { target: { value: 'Headphone dispute' } });
  fireEvent.change(basics.querySelector('textarea'), { target: { value: 'Friend broke my headphones, disagrees about repair.' } });
  fireEvent.change(basics.querySelector('select'), { target: { value: 'Friendship' } });
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await waitFor(() => {
    expect(container.querySelector('section[aria-label="Perspectives"]')).toBeTruthy();
  }, { timeout: 3000 });
}

describe('wizard step 2 Next (Abdul repro 2026-10-14)', () => {
  beforeEach(() => { localStorage.clear(); });
  afterEach(() => { cleanup(); });

  it('advances from Perspectives to Evidence with both statements filled', async () => {
    const { container } = renderWizard();
    await fillBasicsAndGoToPerspectives(container);

    // Fill exactly like Abdul's screenshots.
    const persp = container.querySelector('section[aria-label="Perspectives"]');
    const textareas = persp.querySelectorAll('textarea');
    const inputs = persp.querySelectorAll('input[type="text"]');
    fireEvent.change(inputs[0], { target: { value: 'Abdul Malik' } });
    fireEvent.change(textareas[0], { target: { value: 'I lent my friend my headphones yesterday. They were working perfectly before I gave them to him. When he returned them, one side was not working. I believe he should pay for the repair.' } });
    fireEvent.change(textareas[2], { target: { value: "I returned the headphones in the same condition I received them. I did not drop them or misuse them. They might have already had a problem, and I don't think I should pay without proof." } });

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(container.querySelector('section[aria-label="Evidence"]')).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('still blocks when a statement is missing (shows the error)', async () => {
    const { container } = renderWizard();
    await fillBasicsAndGoToPerspectives(container);

    // Fill only Person A's statement; leave B's empty.
    const persp = container.querySelector('section[aria-label="Perspectives"]');
    const textareas = persp.querySelectorAll('textarea');
    fireEvent.change(textareas[0], { target: { value: 'My side of the story.' } });

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    // Should NOT advance, and Person B's error should be shown.
    await new Promise((r) => setTimeout(r, 400));
    expect(container.querySelector('section[aria-label="Evidence"]')).toBeNull();
    expect(container.querySelector('section[aria-label="Perspectives"]')).toBeTruthy();
    const errs = [...container.querySelectorAll('.field-error, .error')].map((e) => e.textContent);
    expect(errs.some((t) => t.includes("Person B's statement"))).toBe(true);
  });
});
