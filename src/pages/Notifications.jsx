// Notifications: list the user's notifications, mark them read.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BellOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { api, ApiError } from '../services/api.js';
import { useToast } from '../components/ui/Toast.jsx';
import { useReveal } from '../hooks/useReveal.js';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Alert from '../components/ui/Alert.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import Pagination from '../components/ui/Pagination.jsx';
import './Notifications.css';

const PAGE_SIZE = 15;

function formatDateTime(iso) {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function Notifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const revealRef = useReveal();

  const [data, setData] = useState({ items: [], unreadCount: 0, page: 1, pageSize: PAGE_SIZE, total: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [marking, setMarking] = useState({}); // id -> true while the PATCH is in flight

  useEffect(() => {
    document.title = 'Notifications · Human Court';
  }, []);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get('/notifications', { params: { page, pageSize: PAGE_SIZE } });
      setData({
        items: result?.items || [],
        unreadCount: Number(result?.unreadCount) || 0,
        page: result?.page || page,
        pageSize: result?.pageSize || PAGE_SIZE,
        total: result?.total || 0,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load notifications.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
  }, [user, fetchNotifications]);

  if (!user) return null;

  async function markRead(id) {
    if (marking[id]) return;
    setMarking((m) => ({ ...m, [id]: true }));
    try {
      await api.patch(`/notifications/${id}/read`);
      setData((d) => ({
        ...d,
        items: d.items.map((n) => (n.id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n)),
        unreadCount: Math.max(0, d.unreadCount - 1),
      }));
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not mark the notification as read.');
    } finally {
      setMarking((m) => {
        const next = { ...m };
        delete next[id];
        return next;
      });
    }
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <main className="container notifications-page">
      <div className="notifications-header">
        <div>
          <h1>Notifications</h1>
          <p className="muted">
            {data.unreadCount > 0
              ? `${data.unreadCount} unread`
              : 'You are all caught up.'}
          </p>
        </div>
      </div>

      {loading ? (
        <div aria-label="Loading notifications">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="notif-card">
              <div className="skeleton" style={{ height: 16, width: '70%', marginBottom: 10 }} />
              <div className="skeleton" style={{ height: 13, width: '40%' }} />
            </Card>
          ))}
        </div>
      ) : error ? (
        <Alert variant="error" title="Could not load notifications">
          {error}
        </Alert>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title="No notifications yet"
          message="When something needs your attention — an assessment finishing, reviewer activity, case updates — it will appear here."
        />
      ) : (
        <div ref={revealRef} className="reveal-on-scroll">
          <ul className="notif-list">
            {data.items.map((n) => {
              const isUnread = !n.read && !n.readAt;
              return (
                <li key={n.id}>
                  <Card className={`notif-card${isUnread ? ' notif-unread' : ''}`}>
                    <div className="notif-row">
                      <span className="notif-icon" aria-hidden="true">
                        <Bell size={18} />
                      </span>
                      <div className="notif-body">
                        <p className="notif-text">{n.text || n.title || n.message}</p>
                        <div className="notif-meta">
                          {n.createdAt && <time>{formatDateTime(n.createdAt)}</time>}
                          {n.caseId && (
                            <Link to={`/cases/${n.caseId}`} className="notif-case-link">
                              View case
                            </Link>
                          )}
                        </div>
                      </div>
                      {isUnread && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!!marking[n.id]}
                          onClick={() => markRead(n.id)}
                        >
                          {marking[n.id] ? 'Saving…' : 'Mark read'}
                        </Button>
                      )}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
          {totalPages > 1 && (
            <div className="notifications-pagination">
              <Pagination page={page} totalPages={totalPages} onChange={setPage} />
            </div>
          )}
        </div>
      )}
    </main>
  );
}
