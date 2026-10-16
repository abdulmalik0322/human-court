// SharePage — public shared-case view at /s/:token.
//
// Renders ONLY what GET /api/shared/:token returns: brand, title,
// outcomeCategory, summary, assessmentDate. Nothing else is assumed or
// displayed, so a shared link can never leak private case details.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Scale, AlertTriangle } from 'lucide-react';
import { api, ApiError } from '../services/api.js';
import Card from '../components/ui/Card.jsx';
import Alert from '../components/ui/Alert.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import './SharePage.css';

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function SharePage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    document.title = 'Shared case · Human Court';
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get(`/shared/${encodeURIComponent(token)}`)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        if (result?.title) document.title = `${result.title} · Human Court`;
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setError('This shared link is invalid or has been revoked.');
        } else {
          setError(err instanceof ApiError ? err.message : 'Could not load this shared case.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <main className="container share-page">
      <div className="share-brand">
        <Scale size={28} aria-hidden="true" />
        <strong>{data?.brand || 'Human Court'}</strong>
      </div>

      {loading ? (
        <Spinner label="Loading shared case…" />
      ) : error ? (
        <EmptyState
          icon={AlertTriangle}
          title="Link unavailable"
          message={error}
          action={
            <Link className="btn btn-primary" to="/">
              Go to Human Court
            </Link>
          }
        />
      ) : (
        <>
          <Card className="share-card reveal">
            {data.title && <h1 className="share-title">{data.title}</h1>}
            {data.outcomeCategory && (
              <p className="share-outcome">
                <strong>Assessment outcome:</strong> {data.outcomeCategory}
              </p>
            )}
            {data.summary && <p className="share-summary">{data.summary}</p>}
            {formatDate(data.assessmentDate) && (
              <p className="muted share-date">
                Assessed on {formatDate(data.assessmentDate)}
              </p>
            )}
          </Card>

          <Alert variant="warning" title="Please read this carefully">
            <p>
              This is a shared summary of one perspective on a dispute, not the
              full case. It reflects the information available at the time and
              may be incomplete — some details could not be verified.
            </p>
            <p>
              <strong>This is not legal advice.</strong> Human Court is not a
              court of law. For legal questions, consult a qualified lawyer.
            </p>
          </Alert>
        </>
      )}
    </main>
  );
}
