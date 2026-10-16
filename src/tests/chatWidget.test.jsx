// @vitest-environment jsdom
// ChatWidget: shows for logged-in users, checks availability honestly,
// sends messages and renders the real AI reply, clears history on demand.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import ChatWidget from '../components/ChatWidget.jsx';
import { api } from '../services/api.js';

const { postMock, mockUser } = vi.hoisted(() => ({
  postMock: vi.fn(),
  mockUser: { id: 'u1', name: 'Test' },
}));

vi.mock('../services/api.js', () => ({
  api: {
    get: vi.fn((path) => {
      if (path === '/chat/status') return Promise.resolve({ available: true, model: 'test-model' });
      return Promise.resolve(null);
    }),
    post: (...args) => postMock(...args),
  },
  ApiError: class ApiError extends Error {},
}));

// Stable user identity — a fresh object per render would retrigger effects forever.
vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: mockUser }),
}));

describe('ChatWidget', () => {
  beforeEach(() => {
    localStorage.clear();
    postMock.mockReset();
    vi.mocked(api.get).mockImplementation((path) => {
      if (path === '/chat/status') return Promise.resolve({ available: true, model: 'test-model' });
      return Promise.resolve(null);
    });
  });
  afterEach(() => cleanup());

  it('opens the panel and sends a message, rendering the reply', async () => {
    postMock.mockResolvedValue({ reply: 'Here is how cases work.', model: 'test-model' });
    render(<ChatWidget />);

    fireEvent.click(screen.getByRole('button', { name: /open ai assistant/i }));
    await screen.findByText(/ask me anything about human court/i);

    fireEvent.change(screen.getByLabelText(/type your question/i), {
      target: { value: 'How do cases work?' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith(
        '/chat/messages',
        expect.objectContaining({ message: 'How do cases work?' }),
      );
    });
    await screen.findByText('Here is how cases work.');
    expect(JSON.parse(localStorage.getItem('hc-chat-history-v1:u1')).length).toBe(2);
  });

  it('shows an honest message when the AI is unavailable', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ available: false, model: null });
    render(<ChatWidget />);
    fireEvent.click(screen.getByRole('button', { name: /open ai assistant/i }));
    await screen.findByText(/not available right now/i);
    expect(screen.getByLabelText(/type your question/i).disabled).toBe(true);
  });

  it('clears history with a two-step confirm', async () => {
    postMock.mockResolvedValue({ reply: 'Hi there.', model: 'test-model' });
    render(<ChatWidget />);

    fireEvent.click(screen.getByRole('button', { name: /open ai assistant/i }));
    await screen.findByText(/ask me anything about human court/i);

    // Send a message so there is history to clear.
    fireEvent.change(screen.getByLabelText(/type your question/i), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));
    await screen.findByText('Hi there.');
    expect(JSON.parse(localStorage.getItem('hc-chat-history-v1:u1')).length).toBe(2);

    // First click arms the confirm, second click clears.
    fireEvent.click(screen.getByRole('button', { name: /clear chat history/i }));
    expect(screen.getByRole('button', { name: /click again to confirm/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /click again to confirm/i }));

    expect(localStorage.getItem('hc-chat-history-v1:u1')).toBeNull();
    expect(screen.queryByText('Hi there.')).toBeNull();
    // Button hides when there is nothing to clear.
    expect(screen.queryByRole('button', { name: /clear chat history/i })).toBeNull();
  });

  it('starts a new chat with one click', async () => {
    postMock.mockResolvedValue({ reply: 'Hi there.', model: 'test-model' });
    render(<ChatWidget />);

    fireEvent.click(screen.getByRole('button', { name: /open ai assistant/i }));
    await screen.findByText(/ask me anything about human court/i);

    fireEvent.change(screen.getByLabelText(/type your question/i), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));
    await screen.findByText('Hi there.');

    // One click on "Start a new chat" — no confirm needed.
    fireEvent.click(screen.getByRole('button', { name: /start a new chat/i }));

    expect(localStorage.getItem('hc-chat-history-v1:u1')).toBeNull();
    expect(screen.queryByText('Hi there.')).toBeNull();
    expect(screen.queryByText('Hello')).toBeNull();
    // Welcome message is back.
    await screen.findByText(/ask me anything about human court/i);
  });
});
