import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, Trash2, Plus } from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import './ChatWidget.css';

const STORAGE_KEY = 'hc-chat-history-v1';
const MAX_STORED = 40;

function loadHistory(userId) {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${userId}`);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(-MAX_STORED) : [];
  } catch {
    return [];
  }
}

function saveHistory(userId, messages) {
  try {
    localStorage.setItem(`${STORAGE_KEY}:${userId}`, JSON.stringify(messages.slice(-MAX_STORED)));
  } catch {
    // Storage full or unavailable — chat still works for this session.
  }
}

export default function ChatWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [available, setAvailable] = useState(null); // null = checking
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const bottomRef = useRef(null);
  const clearTimer = useRef(null);

  useEffect(() => {
    if (!user) return;
    setMessages(loadHistory(user.id));
    let cancelled = false;
    api
      .get('/chat/status')
      .then((s) => {
        if (!cancelled) setAvailable(Boolean(s?.available));
      })
      .catch(() => {
        if (!cancelled) setAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    const el = bottomRef.current;
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, open, sending]);

  const pushMessages = useCallback(
    (next) => {
      setMessages(next);
      if (user) saveHistory(user.id, next);
    },
    [user],
  );

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || !available) return;
    setError('');
    const userMsg = { role: 'user', content: text, at: Date.now() };
    const next = [...messages, userMsg];
    pushMessages(next);
    setInput('');
    setSending(true);
    try {
      const history = next.slice(-20).map((m) => ({ role: m.role, content: m.content }));
      const res = await api.post('/chat/messages', { message: text, history: history.slice(0, -1) });
      pushMessages([...next, { role: 'assistant', content: res?.reply || '', at: Date.now() }]);
    } catch (err) {
      const code = err?.code;
      if (code === 'ai_not_configured' || err?.status === 503) {
        setAvailable(false);
        setError('The AI assistant is not available right now. Please try again later.');
      } else if (err?.status === 429) {
        setError('You have sent a lot of messages — please wait a little while before trying again.');
      } else if (code === 'ai_timeout') {
        setError('The AI is taking too long to respond. Please try again in a moment.');
      } else if (code === 'ai_config_error') {
        setError(err?.message || 'The AI service rejected the request. Check your API key and model name.');
      } else {
        setError('Could not send your message. Please check your connection and try again.');
      }
    } finally {
      setSending(false);
    }
  }, [input, sending, available, messages, pushMessages]);

  // Two-step clear: first click arms the button ("Sure?"), second click clears.
  // Auto-disarms after 3 seconds so a stray click never wipes history.
  const clearHistory = useCallback(() => {
    if (!user) return;
    if (!confirmClear) {
      setConfirmClear(true);
      clearTimer.current = setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    clearTimeout(clearTimer.current);
    setConfirmClear(false);
    setMessages([]);
    setError('');
    try {
      localStorage.removeItem(`${STORAGE_KEY}:${user.id}`);
    } catch {
      // ignore
    }
  }, [user, confirmClear]);

  useEffect(() => () => clearTimeout(clearTimer.current), []);

  // Friendly one-click fresh start: clears the current conversation and
  // shows the welcome message again. (The trash button is the careful,
  // two-step "delete my history" path.)
  const newChat = useCallback(() => {
    if (!user) return;
    clearTimeout(clearTimer.current);
    setConfirmClear(false);
    setMessages([]);
    setError('');
    setInput('');
    try {
      localStorage.removeItem(`${STORAGE_KEY}:${user.id}`);
    } catch {
      // ignore
    }
  }, [user]);

  return (
    <div className="chat-widget">
      {open && !user && (
        <section className="chat-panel" aria-label="AI assistant chat" role="dialog">
          <header className="chat-header">
            <div>
              <h2 className="chat-title">Human Court Assistant</h2>
              <p className="chat-subtitle">Please log in to chat</p>
            </div>
            <button type="button" className="chat-close" onClick={() => setOpen(false)} aria-label="Close chat">×</button>
          </header>
          <div className="chat-body">
            <p className="chat-empty">Please <a href="/human-court/login">log in</a> to use the AI assistant.</p>
          </div>
        </section>
      )}
      {open && user && (
        <section className="chat-panel" aria-label="AI assistant chat" role="dialog">
          <header className="chat-header">
            <div>
              <h2 className="chat-title">Human Court Assistant</h2>
              <p className="chat-subtitle">
                {available === null ? 'Connecting…' : available ? 'Ask about Human Court' : 'Currently unavailable'}
              </p>
            </div>
            <div className="chat-header-actions">
              <button
                type="button"
                className="chat-new"
                onClick={newChat}
                aria-label="Start a new chat"
                title="Start a new chat"
              >
                <Plus size={16} aria-hidden="true" />
              </button>
              {messages.length > 0 && (
                <button
                  type="button"
                  className={`chat-clear${confirmClear ? ' is-confirm' : ''}`}
                  onClick={clearHistory}
                  aria-label={confirmClear ? 'Click again to confirm clearing chat history' : 'Clear chat history'}
                  title={confirmClear ? 'Click again to confirm' : 'Clear chat history'}
                >
                  <Trash2 size={16} aria-hidden="true" />
                  {confirmClear && <span className="chat-clear-text">Sure?</span>}
                </button>
              )}
              <button type="button" className="chat-close" onClick={() => setOpen(false)} aria-label="Close chat">
                <X size={18} />
              </button>
            </div>
          </header>

          <div className="chat-messages">
            {messages.length === 0 && available && (
              <p className="chat-empty">
                Hi! Ask me anything about Human Court — how cases work, how to write a good statement, or what
                evidence helps.
              </p>
            )}
            {messages.length === 0 && available === false && (
              <p className="chat-empty">The AI assistant is not available right now. Please try again later.</p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg chat-msg-${m.role}`}>
                <p>{m.content}</p>
              </div>
            ))}
            {sending && (
              <div className="chat-msg chat-msg-assistant chat-typing" aria-label="Assistant is typing">
                <span />
                <span />
                <span />
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {error && (
            <p className="chat-error" role="alert">
              {error}
            </p>
          )}

          <form
            className="chat-input-row"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <input
              className="chat-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={available ? 'Type your question…' : 'Unavailable'}
              maxLength={2000}
              disabled={!available || sending}
              aria-label="Type your question"
            />
            <button type="submit" className="chat-send" disabled={!available || sending || !input.trim()} aria-label="Send message">
              <Send size={18} />
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        className="chat-fab"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close AI assistant' : 'Open AI assistant'}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </div>
  );
}
