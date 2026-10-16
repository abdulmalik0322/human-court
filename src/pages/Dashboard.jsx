// Dashboard: stats overview + searchable / filterable list of the user's cases.
// Data comes from the server API (GET /api/cases) — nothing here is hardcoded.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderOpen, Hourglass, Pencil, Scale, SearchX, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { api, ApiError } from '../services/api.js';
import { useToast } from '../components/ui/Toast.jsx';
import { useCountUp } from '../hooks/useCountUp.js';
import { useReveal } from '../hooks/useReveal.js';
import { STATUSES } from '../utils/caseWorkflow.js';
import { CATEGORIES } from '../data/sampleCase.js';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import Select from '../components/ui/Select.jsx';
import Card from '../components/ui/Card.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import Pagination from '../components/ui/Pagination.jsx';
import Alert from '../components/ui/Alert.jsx';
import './Dashboard.css';

const PAGE_SIZE = 8;

// Fetch enough items to compute honest overview stats. Most accounts have far
// fewer cases than this cap; if an account ever exceeds it, the stats reflect
// the first STATS_CAP items and the list pagination remains exact.
const STATS_CAP = 500;

function computeStats(items) {
  const inList = (statuses) => items.filter((c) => statuses.includes(c.status)).length;
  return {
    total: items.length,
    drafts: inList(['draft']),
    awaitingAnalysis: inList([
      'submitted',
      'awaiting-evidence',
      'ready-for-analysis',
      'analysis-in-progress',
    ]),
    assessmentsAvailable: inList(['assessment-available']),
    inHumanReview: inList(['awaiting-human-review', 'review-completed']),
  };
}

// Shared date formatter for case cards.
function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function friendlyError(err) {
  if (err instanceof ApiError) return err.message;
  return err?.message || 'Something went wrong while loading your cases.';
}

function StatCard({ label, value, icon: Icon, delay }) {
  const display = useCountUp(value);
  return (
    <Card className="stat-card reveal" style={{ '--reveal-delay': delay }}>
      <span className="stat-icon" aria-hidden="true">
        <Icon size={20} />
      </span>
      <span className="stat-value">{display}</span>
      <span className="stat-label">{label}</span>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const statsRevealRef = useReveal();

  // Filter + paging state.
  const [qInput, setQInput] = useState(''); // raw search field value
  const [q, setQ] = useState(''); // debounced value actually used for queries
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);

  // Data state.
  const [data, setData] = useState({ items: [], total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 0 });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Debounce the search field so we don't query on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [qInput]);

  // Page title.
  useEffect(() => {
    document.title = 'Dashboard · Human Court';
  }, []);

  // Fetch the case list whenever filters, sort, or page change.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get('/cases', {
        params: {
          q,
          status,
          category,
          sort,
          page,
          pageSize: PAGE_SIZE,
        },
      })
      .then((result) => {
        if (cancelled) return;
        setData(result || { items: [], total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 0 });
      })
      .catch((err) => {
        if (!cancelled) setError(friendlyError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, q, status, category, sort, page]);

  // Fetch the full list once (up to the cap) to compute honest stats.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setStatsLoading(true);
    api
      .get('/cases', { params: { page: 1, pageSize: STATS_CAP } })
      .then((result) => {
        if (cancelled) return;
        setStats(computeStats(result?.items || []));
      })
      .catch(() => {
        if (!cancelled) setStats(null);
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) return null;

  const firstName = (user.name || '').split(' ')[0] || 'there';

  const statDefs = [
    { key: 'total', label: 'Total cases', icon: FolderOpen },
    { key: 'drafts', label: 'Drafts', icon: Pencil },
    { key: 'awaitingAnalysis', label: 'Awaiting analysis', icon: Hourglass },
    { key: 'assessmentsAvailable', label: 'Assessments available', icon: Scale },
    { key: 'inHumanReview', label: 'In human review', icon: Users },
  ];

  const hasFilters = Boolean(q || status || category);

  const clearFilters = () => {
    setQInput('');
    setQ('');
    setStatus('');
    setCategory('');
    setPage(1);
    toast('Filters cleared.');
  };

  return (
    <main className="dashboard container">
      {/* Header row: greeting + primary action */}
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Welcome back, {firstName}</h1>
          <p className="dashboard-subtitle">Here is what is happening with your cases.</p>
        </div>
        <Link className="btn btn-primary" to="/cases/new">
          + New case
        </Link>
      </div>

      {/* Stats overview */}
      <section
        className="stats-grid reveal-on-scroll"
        aria-label="Case statistics"
        ref={statsRevealRef}
      >
        {statsLoading ? (
          statDefs.map(({ key, label }) => (
            <Card key={key} className="stat-card">
              <span className="stat-value skeleton" aria-label={label}>
                &nbsp;
              </span>
              <span className="stat-label">{label}</span>
            </Card>
          ))
        ) : stats ? (
          statDefs.map(({ key, label, icon }, i) => (
            <StatCard
              key={key}
              label={label}
              value={stats[key] ?? 0}
              icon={icon}
              delay={`${i * 80}ms`}
            />
          ))
        ) : (
          <Alert variant="warning" title="Stats unavailable">
            Could not compute your stats right now — the case list below is still accurate.
          </Alert>
        )}
      </section>

      {/* Search + filter toolbar */}
      <Card className="toolbar-card reveal" style={{ '--reveal-delay': '120ms' }}>
        <div className="toolbar">
          <Input
            label="Search cases"
            placeholder="Search titles and summaries…"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
          />
          <Select
            label="Status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
          <Select
            label="Category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select
            label="Sort by"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="updated">Recently updated</option>
          </Select>
        </div>
      </Card>

      {/* Results area: loading / error / empty / list */}
      <section aria-label="Your cases" className="results">
        {loading ? (
          <div className="case-list" aria-label="Loading cases">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="case-card">
                <div className="skeleton" style={{ height: 18, width: '60%', marginBottom: 12 }} />
                <div className="skeleton" style={{ height: 14, width: '90%' }} />
                <div className="skeleton" style={{ height: 14, width: '75%', marginTop: 8 }} />
              </Card>
            ))}
          </div>
        ) : error ? (
          <Alert variant="error" title="Could not load your cases">
            {error}
          </Alert>
        ) : data.total === 0 && !hasFilters ? (
          <EmptyState
            icon={Scale}
            title="No cases yet"
            message="Bring your first case to the court and get a fair hearing."
            action={
              <Link className="btn btn-primary" to="/cases/new">
                + New case
              </Link>
            }
          />
        ) : data.total === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No matches"
            message="No cases match your current search and filters."
            action={
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <>
            <div className="case-list">
              {data.items.map((c, i) => (
                <article
                  key={c.id}
                  className="case-card reveal"
                  style={{ '--reveal-delay': `${(i % PAGE_SIZE) * 60}ms` }}
                >
                  <div className="case-card-top">
                    <Link to={`/cases/${c.id}`} className="case-card-title">
                      {c.title}
                    </Link>
                    <StatusBadge status={c.status} />
                  </div>
                  <div className="case-card-meta">
                    <span className="chip">{c.category}</span>
                    <span>Updated {formatDate(c.updatedAt)}</span>
                  </div>
                  <p className="case-card-summary">{c.summary}</p>
                </article>
              ))}
            </div>
            {data.totalPages > 1 && (
              <div className="dashboard-pagination">
                <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
