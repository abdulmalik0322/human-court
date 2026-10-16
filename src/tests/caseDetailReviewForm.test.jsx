// @vitest-environment jsdom
// The review form must only be shown to viewers who can actually review.
// Owners (and other non-invited viewers) previously saw an enabled form
// that always failed with 403 — now they see an explanatory note instead.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from '../components/ui/Toast.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';

let viewerFlags = { isOwner: true, canReview: false };

vi.mock('../services/api.js', () => ({
  api: {
    get: vi.fn((path) => {
      if (path === '/auth/me') {
        return Promise.resolve({ user: { id: 'u1', name: 'Owner', email: 'o@o.com', createdAt: new Date().toISOString() } });
      }
      if (path.startsWith('/cases/')) {
        return Promise.resolve({
          case: { id: 'c1', title: 'Test case', status: 'submitted', ownerId: 'u1', privacy: 'private', category: 'Friendship', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), personA: { name: 'A', statement: 's' }, personB: { name: 'B', statement: 's' } },
          evidence: [],
          latestAssessment: null,
          viewer: viewerFlags,
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

import CaseDetail from '../pages/CaseDetail.jsx';

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={['/cases/c1']}>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/cases/:id" element={<CaseDetail />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>
  );
}

describe('case detail review form visibility', () => {
  beforeEach(() => { localStorage.clear(); });
  afterEach(() => { cleanup(); });

  it('hides the review form from the owner with an explanatory note', async () => {
    viewerFlags = { isOwner: true, canReview: false };
    renderDetail();
    await screen.findByText('Test case');
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /submit review/i })).toBeNull();
    });
    expect(screen.getByText(/as the case owner you cannot review your own case/i)).toBeTruthy();
  });

  it('shows the review form to an invited reviewer', async () => {
    viewerFlags = { isOwner: false, canReview: true };
    renderDetail();
    await screen.findByText('Test case');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /submit review/i })).toBeTruthy();
    });
  });

  it('shows the not-invited note to other viewers', async () => {
    viewerFlags = { isOwner: false, canReview: false };
    renderDetail();
    await screen.findByText('Test case');
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /submit review/i })).toBeNull();
    });
    expect(screen.getByText(/you are not invited to review this case/i)).toBeTruthy();
  });

  it('offers only server-accepted opinion values in the review form', async () => {
    viewerFlags = { isOwner: false, canReview: true };
    renderDetail();
    await screen.findByText('Test case');
    const select = await screen.findByLabelText(/your opinion/i);
    const values = Array.from(select.querySelectorAll('option')).map((o) => o.value).filter(Boolean);
    // Must match the server's REVIEW_OPINIONS, otherwise submission 400s.
    expect(values).toEqual([
      'leans_a',
      'leans_b',
      'mixed',
      'insufficient_evidence',
      'expectations_not_facts',
      'no_clear_lean',
    ]);
  });

  it('shows "Continue to AI analysis" for a submitted case', async () => {
    viewerFlags = { isOwner: true, canReview: false };
    renderDetail();
    await screen.findByText('Test case');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /continue to ai analysis/i })).toBeTruthy();
    });
  });
});
