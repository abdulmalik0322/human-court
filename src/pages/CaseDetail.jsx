// CaseDetail: full view of one case — perspectives, evidence, AI assessment,
// reviewer feedback, timeline, sharing, and case actions. All data comes
// from the server API; nothing is invented on the client.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Copy,
  FileText,
  Scale,
  Share2,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { api, ApiError } from '../services/api.js';
import { useToast } from '../components/ui/Toast.jsx';
import { useReveal } from '../hooks/useReveal.js';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import Textarea from '../components/ui/Textarea.jsx';
import Select from '../components/ui/Select.jsx';
import Card from '../components/ui/Card.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import Modal from '../components/ui/Modal.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import Alert from '../components/ui/Alert.jsx';
import './CaseDetail.css';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Shorten a long id for display; the full id stays in the title attribute.
function shortId(id) {
  return id && id.length > 16 ? `${id.slice(0, 10)}…` : id;
}

function friendlyError(err, fallback) {
  if (err instanceof ApiError) return err.message;
  return err?.message || fallback || 'Something went wrong.';
}

// ===========================================================================
// Assessment panel
// ===========================================================================

const ASSESSMENT_SECTIONS = [
  { key: 'decision', label: 'AI recommendation', type: 'decision' },
  { key: 'neutralSummary', label: 'Neutral summary', type: 'text' },
  { key: 'personAClaims', label: "Person A's claims", type: 'list' },
  { key: 'personBClaims', label: "Person B's claims", type: 'list' },
  { key: 'areasOfAgreement', label: 'Areas of agreement', type: 'list' },
  { key: 'pointsOfDisagreement', label: 'Points of disagreement', type: 'list' },
  { key: 'supportedByEvidence', label: 'Supported by evidence', type: 'list' },
  { key: 'unverifiedClaims', label: 'Unverified claims', type: 'list' },
  { key: 'missingInformation', label: 'Missing information', type: 'list' },
  { key: 'alternativeExplanations', label: 'Alternative explanations', type: 'list' },
  { key: 'reasoning', label: 'Reasoning', type: 'list' },
  { key: 'clarifyingQuestions', label: 'Clarifying questions', type: 'list' },
  { key: 'nextSteps', label: 'Suggested next steps', type: 'list' },
  { key: 'limitations', label: 'Limitations', type: 'list' },
  { key: 'overallAssessment', label: 'Overall assessment', type: 'text' },
];

// Honest, high-level descriptions of the analysis process shown while an
// assessment is being prepared. They describe the process, never claim
// specific internal steps.
const PROGRESS_MESSAGES = [
  'Reading both perspectives…',
  'Cross-checking claims against evidence…',
  'Weighing what remains uncertain…',
];

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 3 * 60 * 1000; // ~3 minutes

function engineLabel(assessment) {
  if (!assessment) return '';
  return assessment.engine === 'llm'
    ? `AI model: ${assessment.model || 'external model'}`
    : 'Built-in analysis engine (no external AI)';
}

import { AssessmentItem } from '../components/ui/AssessmentItem.jsx';

function SectionBlock({ section, value, index }) {
  const items = Array.isArray(value) ? value.filter(Boolean) : [];
  const text = typeof value === 'string' ? value.trim() : '';
  if (section.type === 'list' && items.length === 0) return null;
  if ((section.type === 'text' || section.type === 'decision') && !text) return null;
  return (
    <section
      aria-label={section.label}
      className={`assessment-section reveal${section.type === 'decision' ? ' assessment-decision' : ''}`}
      style={{ '--reveal-delay': `${index * 60}ms` }}
    >
      <h3 className="assessment-section-title">{section.label}</h3>
      {section.type === 'list' ? (
        <ul className="claims-list">
          {items.map((item, i) => (
            <li key={i}>
              <AssessmentItem item={item} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="statement">{text}</p>
      )}
    </section>
  );
}

function AssessmentView({ assessment, onReport, onReassess }) {
  const sections = assessment.sections || {};
  const missing = Array.isArray(sections.missingInformation)
    ? sections.missingInformation.filter(Boolean)
    : [];
  const questions = Array.isArray(sections.clarifyingQuestions)
    ? sections.clarifyingQuestions.filter(Boolean)
    : [];

  return (
    <div>
      <div className="assessment-meta reveal">
        <span className="chip">{engineLabel(assessment)}</span>
        {assessment.outcomeCategory && (
          <span className="chip chip-outcome">{assessment.outcomeCategory}</span>
        )}
        {assessment.version != null && <span className="muted">v{assessment.version}</span>}
        {assessment.createdAt && (
          <time className="muted">{formatDateTime(assessment.createdAt)}</time>
        )}
      </div>

      {missing.length > 0 && (
        <Alert variant="warning" title="Missing information" className="reveal" style={{ '--reveal-delay': '60ms' }}>
          The assessment flagged {missing.length} piece{missing.length === 1 ? '' : 's'} of
          missing information. Adding it would make any future assessment more reliable —
          see the "Missing information" section below.
        </Alert>
      )}
      {questions.length > 0 && (
        <Alert variant="info" title="Unanswered questions" className="reveal" style={{ '--reveal-delay': '120ms' }}>
          The assessment raised {questions.length} clarifying question{questions.length === 1 ? '' : 's'}
          that could not be answered from the case file — see "Clarifying questions" below.
        </Alert>
      )}

      <div className="assessment-sections">
        {ASSESSMENT_SECTIONS.map((section, i) => (
          <SectionBlock key={section.key} section={section} value={sections[section.key]} index={i} />
        ))}
      </div>

      <Alert variant="info">
        This assessment is an automated analysis of the information in your
        case file — not legal advice, and not a court ruling. Read the
        limitations before acting on it.
      </Alert>

      <div className="actions-row">
        <Button variant="secondary" size="sm" onClick={onReport}>
          Report a problem
        </Button>
        <Button variant="ghost" size="sm" onClick={onReassess}>
          Request reassessment
        </Button>
      </div>
    </div>
  );
}

function AssessmentPanel({ caseId, status }) {
  const { toast } = useToast();
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState(null);

  // Request flow state.
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reassessOpen, setReassessOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reassessReason, setReassessReason] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState('');

  // Pending / polling state.
  const [pendingId, setPendingId] = useState(null);
  const [pendingTimedOut, setPendingTimedOut] = useState(false);
  const [pendingFailed, setPendingFailed] = useState(false);
  const [progressIdx, setProgressIdx] = useState(0);
  const pollTimer = useRef(null);
  const progressTimer = useRef(null);

  const canRequest = !['draft', 'archived'].includes(status);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    setError(null);
    try {
      const data = await api.get(`/cases/${caseId}/assessments`);
      const items = data?.items || [];
      setHistory(items);
      if (items.length > 0 && !selected && !pendingId) {
        // Load the newest assessment's full detail — unless it's still
        // pending, in which case the resume effect below picks up polling.
        const detail = await api.get(`/cases/${caseId}/assessments/${items[0].id}`);
        const assessment = detail?.assessment;
        if (assessment?.status !== 'pending') setSelected(assessment);
      }
    } catch (err) {
      setError(friendlyError(err, 'Could not load assessments.'));
    } finally {
      setLoadingHistory(false);
    }
  }, [caseId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Resume polling when the user returns while the newest assessment is
  // still pending (e.g. they left the page during preparation).
  useEffect(() => {
    if (!loadingHistory && history.length > 0 && !selected && !pendingId) {
      if (history[0]?.status === 'pending' && history[0]?.id) {
        startPolling(history[0].id);
      }
    }
    // startPolling is stable (refs + setState only); run on history changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingHistory, history, selected, pendingId]);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    if (progressTimer.current) clearInterval(progressTimer.current);
    pollTimer.current = null;
    progressTimer.current = null;
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  async function viewAssessment(assessmentId) {
    setLoadingDetail(true);
    try {
      const detail = await api.get(`/cases/${caseId}/assessments/${assessmentId}`);
      setSelected(detail?.assessment || null);
    } catch (err) {
      toast(friendlyError(err, 'Could not load that assessment.'));
    } finally {
      setLoadingDetail(false);
    }
  }

  function startPolling(assessmentId) {
    setPendingId(assessmentId);
    setPendingTimedOut(false);
    setPendingFailed(false);
    setProgressIdx(0);
    const startedAt = Date.now();

    progressTimer.current = setInterval(() => {
      setProgressIdx((i) => (i + 1) % PROGRESS_MESSAGES.length);
    }, 4000);

    pollTimer.current = setInterval(async () => {
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        stopPolling();
        setPendingId(null);
        setPendingTimedOut(true);
        return;
      }
      try {
        const detail = await api.get(`/cases/${caseId}/assessments/${assessmentId}`);
        const assessment = detail?.assessment;
        if (assessment?.status === 'complete') {
          stopPolling();
          setPendingId(null);
          setSelected(assessment);
          loadHistory();
          toast('Assessment ready.');
        } else if (assessment?.status === 'failed') {
          stopPolling();
          setPendingId(null);
          setPendingFailed(true);
        }
      } catch {
        // A single failed poll is not fatal; keep trying until the timeout.
      }
    }, POLL_INTERVAL_MS);
  }

  async function requestAssessment(reasonText) {
    setRequesting(true);
    setRequestError('');
    try {
      const data = await api.post(`/cases/${caseId}/assessments`, reasonText ? { reason: reasonText } : {});
      setReasonOpen(false);
      setReassessOpen(false);
      setReason('');
      setReassessReason('');
      const assessmentId = data?.id;
      if (data?.status === 'complete' && assessmentId) {
        await viewAssessment(assessmentId);
        loadHistory();
      } else if (assessmentId) {
        startPolling(assessmentId);
      } else {
        loadHistory();
      }
    } catch (err) {
      // 409 (e.g. an assessment is already in progress) is shown verbatim —
      // the server explains the rule, we don't invent one.
      setRequestError(friendlyError(err, 'Could not request the assessment.'));
    } finally {
      setRequesting(false);
    }
  }

  async function submitReport() {
    if (!selected?.id) return;
    if (!reportReason.trim()) {
      toast('Please describe the problem first.');
      return;
    }
    try {
      await api.post(`/cases/${caseId}/assessments/${selected.id}/report`, {
        reason: reportReason.trim(),
      });
      setReportOpen(false);
      setReportReason('');
      toast('Thanks — your report was sent.');
    } catch (err) {
      toast(friendlyError(err, 'Could not send your report.'));
    }
  }

  const latestComplete = selected && selected.status === 'complete';

  return (
    <Card title="AI assessment" className="section-card">
      {loadingHistory ? (
        <Spinner label="Loading assessments…" />
      ) : error ? (
        <Alert variant="error" title="Could not load assessments">
          {error}
        </Alert>
      ) : pendingId ? (
        <div className="pending-panel">
          <Spinner label={PROGRESS_MESSAGES[progressIdx]} />
          <p className="pending-message reveal" key={progressIdx}>
            {PROGRESS_MESSAGES[progressIdx]}
          </p>
          <p className="muted pending-note">
            Your assessment is being prepared on our servers. These steps
            describe the process at a high level. This usually takes under a
            minute — you can leave this page and come back.
          </p>
        </div>
      ) : pendingTimedOut ? (
        <EmptyState
          icon={AlertTriangle}
          title="Still working on it"
          message="The assessment is taking longer than expected. It may still finish — check back shortly, or request a new one."
          action={
            canRequest ? (
              <Button variant="primary" onClick={() => setReasonOpen(true)}>
                Request AI assessment
              </Button>
            ) : null
          }
        />
      ) : pendingFailed ? (
        <Alert variant="error" title="Assessment failed">
          The assessment could not be completed. Nothing was invented — please
          try requesting it again.
        </Alert>
      ) : latestComplete ? (
        <AssessmentView
          assessment={selected}
          onReport={() => setReportOpen(true)}
          onReassess={() => setReassessOpen(true)}
        />
      ) : (
        <EmptyState
          icon={Scale}
          title="No assessment yet"
          message={
            canRequest
              ? 'Ask for an AI assessment of this case. It reads both perspectives and the evidence, then reasons through what is supported, what is uncertain, and what is missing.'
              : status === 'submitted' || status === 'awaiting-evidence'
                ? 'Click "Continue to AI analysis" in Case actions below, then request the assessment.'
                : 'Assessments can be requested once the case leaves the draft stage.'
          }
          action={
            canRequest ? (
              <Button variant="primary" onClick={() => setReasonOpen(true)}>
                Request AI assessment
              </Button>
            ) : null
          }
        />
      )}

      {/* History */}
      {history.length > 1 && (
        <div className="assessment-history">
          <h3 className="claims-heading">Past assessments</h3>
          <ul className="history-list">
            {history.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  className={`history-item${selected?.id === a.id ? ' active' : ''}`}
                  onClick={() => viewAssessment(a.id)}
                  disabled={loadingDetail}
                >
                  <span>
                    {a.status === 'complete' ? 'Assessment' : `Assessment (${a.status})`}
                    {a.version != null ? ` · v${a.version}` : ''}
                  </span>
                  <time className="muted">{formatDateTime(a.createdAt)}</time>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Request (first assessment) — optional reason */}
      <Modal
        open={reasonOpen}
        onClose={() => setReasonOpen(false)}
        title="Request AI assessment"
        footer={
          <>
            <Button variant="ghost" onClick={() => setReasonOpen(false)} disabled={requesting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => requestAssessment(reason.trim())} loading={requesting}>
              {requesting ? 'Requesting…' : 'Request assessment'}
            </Button>
          </>
        }
      >
        {requestError && (
          <Alert variant="error" role="alert">
            {requestError}
          </Alert>
        )}
        <p className="muted">
          Optionally, tell the analysis what to focus on. Leave blank for a
          full assessment.
        </p>
        <Textarea
          id="assess-reason"
          label="Focus (optional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={1000}
          placeholder="e.g. focus on the payment timeline"
        />
      </Modal>

      {/* Reassessment — reason is required */}
      <Modal
        open={reassessOpen}
        onClose={() => setReassessOpen(false)}
        title="Request reassessment"
        footer={
          <>
            <Button variant="ghost" onClick={() => setReassessOpen(false)} disabled={requesting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!reassessReason.trim()) {
                  setRequestError('Please give a reason for the reassessment.');
                  return;
                }
                requestAssessment(reassessReason.trim());
              }}
              loading={requesting}
            >
              {requesting ? 'Requesting…' : 'Request reassessment'}
            </Button>
          </>
        }
      >
        {requestError && (
          <Alert variant="error" role="alert">
            {requestError}
          </Alert>
        )}
        <p className="muted">
          A reason is required — for example, new evidence was added or a claim
          was corrected.
        </p>
        <Textarea
          id="reassess-reason"
          label="Reason for reassessment"
          required
          value={reassessReason}
          onChange={(e) => setReassessReason(e.target.value)}
          maxLength={1000}
          placeholder="What changed since the last assessment?"
        />
      </Modal>

      {/* Report a problem with the selected assessment */}
      <Modal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Report a problem"
        footer={
          <>
            <Button variant="ghost" onClick={() => setReportOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submitReport}>
              Send report
            </Button>
          </>
        }
      >
        <p className="muted">
          Tell us what is wrong with this assessment — for example, it missed
          key evidence or misread a claim.
        </p>
        <Textarea
          id="report-reason"
          label="What is the problem?"
          required
          value={reportReason}
          onChange={(e) => setReportReason(e.target.value)}
          maxLength={2000}
          placeholder="Describe the problem…"
        />
      </Modal>
    </Card>
  );
}

// ===========================================================================
// Evidence panel
// ===========================================================================

function EvidencePanel({ caseId }) {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/cases/${caseId}/evidence`);
      setItems(data?.items || []);
    } catch (err) {
      setError(friendlyError(err, 'Could not load evidence.'));
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(evidenceId, name) {
    if (deleting[evidenceId]) return;
    setDeleting((d) => ({ ...d, [evidenceId]: true }));
    try {
      await api.delete(`/cases/${caseId}/evidence/${evidenceId}`);
      setItems((list) => list.filter((e) => e.id !== evidenceId));
      toast(`Removed "${name}".`);
    } catch (err) {
      toast(friendlyError(err, 'Could not delete that file.'));
    } finally {
      setDeleting((d) => {
        const next = { ...d };
        delete next[evidenceId];
        return next;
      });
    }
  }

  return (
    <Card title="Evidence" className="section-card">
      {loading ? (
        <Spinner label="Loading evidence…" />
      ) : error ? (
        <Alert variant="error" title="Could not load evidence">
          {error}
        </Alert>
      ) : items.length > 0 ? (
        <ul className="evidence-list">
          {items.map((file) => (
            <li key={file.id} className="evidence-item">
              <span className="evidence-icon" aria-hidden="true">
                <FileText size={20} />
              </span>
              <div className="evidence-details">
                <strong className="evidence-name">{file.name}</strong>
                <span className="evidence-meta">
                  {file.size != null ? `${(file.size / 1024).toFixed(1)} KB` : ''}
                  {file.type ? ` · ${file.type}` : ''}
                  {file.uploadedAt ? ` · uploaded ${formatDate(file.uploadedAt)}` : ''}
                </span>
                {file.description && <p className="evidence-desc">{file.description}</p>}
                <div className="evidence-links">
                  <a
                    href={`/api/cases/${caseId}/evidence/${file.id}/download`}
                    className="link-like"
                    download
                  >
                    Download
                  </a>
                  <button
                    type="button"
                    className="link-like link-danger"
                    disabled={!!deleting[file.id]}
                    onClick={() => handleDelete(file.id, file.name)}
                  >
                    {deleting[file.id] ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No evidence attached yet.</p>
      )}
      <div className="section-alert">
        <Alert variant="info">
          Files are uploaded securely and stored server-side. Add evidence from
          the case wizard while the case is a draft.
        </Alert>
      </div>
    </Card>
  );
}

// ===========================================================================
// Reviews panel
// ===========================================================================

const OPINIONS = [
  { value: 'leans_a', label: 'Leans toward Person A' },
  { value: 'leans_b', label: 'Leans toward Person B' },
  { value: 'mixed', label: 'Mixed — both sides have a point' },
  { value: 'insufficient_evidence', label: 'Not enough evidence to say' },
  { value: 'expectations_not_facts', label: 'About expectations, not facts' },
  { value: 'no_clear_lean', label: 'No clear lean' },
];

function ReviewsPanel({ caseId, viewer }) {
  const { toast } = useToast();
  const canReview = Boolean(viewer?.canReview);
  const isOwner = Boolean(viewer?.isOwner);
  const [aggregate, setAggregate] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Invite form state.
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteNote, setInviteNote] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);
  const [inviteError, setInviteError] = useState('');

  // Review form state.
  const [opinion, setOpinion] = useState('no_clear_lean');
  const [reasoning, setReasoning] = useState('');
  const [missingEvidence, setMissingEvidence] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [agg, list] = await Promise.all([
        api.get(`/cases/${caseId}/reviews/aggregate`).catch(() => null),
        api.get(`/cases/${caseId}/reviews`).catch(() => ({ items: [] })),
      ]);
      setAggregate(agg);
      setReviews(list?.items || []);
    } catch (err) {
      setError(friendlyError(err, 'Could not load reviews.'));
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleInvite(e) {
    e.preventDefault();
    setInviting(true);
    setInviteError('');
    setInviteResult(null);
    try {
      const data = await api.post(`/cases/${caseId}/invitations`, {
        email: inviteEmail.trim() || undefined,
        note: inviteNote.trim() || undefined,
      });
      setInviteResult(data);
    } catch (err) {
      setInviteError(friendlyError(err, 'Could not create the invitation.'));
    } finally {
      setInviting(false);
    }
  }

  async function handleReviewSubmit(e) {
    e.preventDefault();
    setReviewError('');
    if (!reasoning.trim()) {
      setReviewError('Please write your reasoning.');
      return;
    }
    setSubmittingReview(true);
    try {
      await api.post(`/cases/${caseId}/reviews`, {
        opinion,
        reasoning: reasoning.trim(),
        missingEvidence: missingEvidence.trim() || undefined,
        nextSteps: nextSteps.trim() || undefined,
      });
      setReasoning('');
      setMissingEvidence('');
      setNextSteps('');
      setOpinion('no_clear_lean');
      toast('Review submitted.');
      load();
    } catch (err) {
      setReviewError(friendlyError(err, 'Could not submit your review.'));
    } finally {
      setSubmittingReview(false);
    }
  }

  const opinionLabel = (value) =>
    OPINIONS.find((o) => o.value === value)?.label || value;

  return (
    <Card title="Reviewer feedback" className="section-card">
      {loading ? (
        <Spinner label="Loading reviews…" />
      ) : error ? (
        <Alert variant="error" title="Could not load reviews">
          {error}
        </Alert>
      ) : (
        <>
          {aggregate && (
            <div className="review-aggregate">
              <p>
                <strong>{aggregate.count ?? 0}</strong> reviewer opinion
                {(aggregate.count ?? 0) === 1 ? '' : 's'}
              </p>
              {aggregate.distribution && (
                <ul className="distribution-list">
                  {Object.entries(aggregate.distribution).map(([key, value]) => (
                    <li key={key}>
                      <span>{opinionLabel(key)}</span>
                      <strong>{value}</strong>
                    </li>
                  ))}
                </ul>
              )}
              {Array.isArray(aggregate.themes) && aggregate.themes.length > 0 && (
                <div>
                  <h3 className="claims-heading">Common themes</h3>
                  <ul className="claims-list">
                    {aggregate.themes.map((theme, i) => (
                      <li key={i}>{String(theme)}</li>
                    ))}
                  </ul>
                </div>
              )}
              {aggregate.disclaimer && (
                <p className="muted review-disclaimer">{aggregate.disclaimer}</p>
              )}
            </div>
          )}

          {reviews.length > 0 ? (
            <ul className="review-list">
              {reviews.map((review) => (
                <li key={review.id} className="review-item">
                  <div className="review-top">
                    <span className="chip">{opinionLabel(review.opinion)}</span>
                    {review.createdAt && (
                      <time className="muted">{formatDateTime(review.createdAt)}</time>
                    )}
                  </div>
                  <p className="statement">{review.reasoning}</p>
                  {review.missingEvidence && (
                    <p>
                      <strong>Missing evidence:</strong> {review.missingEvidence}
                    </p>
                  )}
                  {review.nextSteps && (
                    <p>
                      <strong>Suggested next steps:</strong> {review.nextSteps}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={Users}
              title="No reviewer feedback yet"
              message="Invite someone you trust to read the case and share their opinion."
            />
          )}
        </>
      )}

      <div className="actions-row">
        <Button variant="secondary" size="sm" onClick={() => setInviteOpen(true)}>
          Invite a reviewer
        </Button>
      </div>

      <div className="review-form-wrap">
        <h3 className="claims-heading">Share your own review</h3>
        {canReview ? (
          <>
            {reviewError && (
              <Alert variant="error" role="alert">
                {reviewError}
              </Alert>
            )}
            <form onSubmit={handleReviewSubmit} noValidate>
              <Select
                id="review-opinion"
                label="Your opinion"
                value={opinion}
                onChange={(e) => setOpinion(e.target.value)}
                options={OPINIONS}
              />
              <Textarea
                id="review-reasoning"
                label="Reasoning"
                required
                value={reasoning}
                onChange={(e) => setReasoning(e.target.value)}
                maxLength={5000}
                placeholder="Explain how you see this case…"
              />
              <Textarea
                id="review-missing"
                label="Missing evidence (optional)"
                value={missingEvidence}
                onChange={(e) => setMissingEvidence(e.target.value)}
                maxLength={2000}
                placeholder="What would help you decide?"
              />
              <Textarea
                id="review-next"
                label="Suggested next steps (optional)"
                value={nextSteps}
                onChange={(e) => setNextSteps(e.target.value)}
                maxLength={2000}
                placeholder="What should happen next?"
              />
              <Button variant="primary" type="submit" loading={submittingReview}>
                {submittingReview ? 'Submitting…' : 'Submit review'}
              </Button>
            </form>
          </>
        ) : (
          <Alert variant="info" role="note">
            {isOwner
              ? 'As the case owner you cannot review your own case — invite someone you trust to share their opinion instead.'
              : 'You are not invited to review this case.'}
          </Alert>
        )}
      </div>

      {/* Invite modal */}
      <Modal
        open={inviteOpen}
        onClose={() => {
          setInviteOpen(false);
          setInviteResult(null);
          setInviteError('');
        }}
        title="Invite a reviewer"
        footer={
          inviteResult ? (
            <Button variant="secondary" onClick={() => setInviteOpen(false)}>
              Done
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setInviteOpen(false)} disabled={inviting}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleInvite} loading={inviting}>
                {inviting ? 'Creating…' : 'Create invitation'}
              </Button>
            </>
          )
        }
      >
        {inviteError && (
          <Alert variant="error" role="alert">
            {inviteError}
          </Alert>
        )}
        {inviteResult ? (
          <div>
            <Alert variant="success" title="Invitation created">
              Share this token with your reviewer. It expires{' '}
              {inviteResult.expiresAt ? formatDateTime(inviteResult.expiresAt) : 'as scheduled by the server'}.
            </Alert>
            <p>
              <code className="case-id">{inviteResult.token}</code>
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(inviteResult.token).catch(() => {});
                  toast('Token copied.');
                }
              }}
            >
              <Copy size={14} aria-hidden="true" /> Copy token
            </Button>
          </div>
        ) : (
          <form onSubmit={handleInvite} noValidate>
            <Input
              id="invite-email"
              label="Reviewer email (optional)"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="reviewer@example.com"
              hint="If left blank, share the token yourself."
            />
            <Textarea
              id="invite-note"
              label="Note (optional)"
              value={inviteNote}
              onChange={(e) => setInviteNote(e.target.value)}
              maxLength={1000}
              placeholder="Context for your reviewer…"
            />
          </form>
        )}
      </Modal>
    </Card>
  );
}

// ===========================================================================
// Share card
// ===========================================================================

function ShareCard({ caseId }) {
  const { toast } = useToast();
  const [share, setShare] = useState(null);
  const [working, setWorking] = useState(false);

  async function createShare() {
    setWorking(true);
    try {
      const data = await api.post(`/cases/${caseId}/share`);
      setShare(data);
      toast('Share link created.');
    } catch (err) {
      toast(friendlyError(err, 'Could not create a share link.'));
    } finally {
      setWorking(false);
    }
  }

  async function revokeShare() {
    setWorking(true);
    try {
      await api.delete(`/cases/${caseId}/share`);
      setShare(null);
      toast('Share link revoked.');
    } catch (err) {
      toast(friendlyError(err, 'Could not revoke the share link.'));
    } finally {
      setWorking(false);
    }
  }

  function copyUrl() {
    if (share?.url && navigator.clipboard) {
      navigator.clipboard.writeText(share.url).then(
        () => toast('Link copied.'),
        () => toast('Could not copy the link.')
      );
    }
  }

  return (
    <Card title="Share" className="section-card">
      {share?.url ? (
        <div>
          <p className="muted">
            Anyone with this link can view the shared summary — not your full
            case file.
          </p>
          <p className="share-url">
            <a href={share.url} target="_blank" rel="noreferrer">
              {share.url}
            </a>
          </p>
          <div className="actions-row">
            <Button variant="secondary" size="sm" onClick={copyUrl}>
              <Copy size={14} aria-hidden="true" /> Copy link
            </Button>
            <Button variant="danger" size="sm" onClick={revokeShare} loading={working}>
              Revoke link
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <p className="muted">
            Create a public link that shows only the shared summary of this
            case. You can revoke it at any time.
          </p>
          <Button variant="secondary" size="sm" onClick={createShare} loading={working}>
            <Share2 size={14} aria-hidden="true" /> Create share link
          </Button>
        </div>
      )}
    </Card>
  );
}

// ===========================================================================
// CaseDetail page
// ===========================================================================

export default function CaseDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const revealRef = useReveal();

  const [caseData, setCaseData] = useState(null);
  const [viewer, setViewer] = useState({ isOwner: false, canReview: false });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [working, setWorking] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [appealOpen, setAppealOpen] = useState(false);
  const [appealReason, setAppealReason] = useState('');
  const [appealInfo, setAppealInfo] = useState('');
  const [appealError, setAppealError] = useState('');

  // Load the case once (and when the route id changes).
  useEffect(() => {
    document.title = 'Case · Human Court';
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    api
      .get(`/cases/${id}`)
      .then((c) => {
        if (cancelled) return;
        const caseObj = c?.case || null;
        setCaseData(caseObj);
        setViewer(c?.viewer || { isOwner: false, canReview: false });
        if (caseObj) document.title = `${caseObj.title} · Human Court`;
      })
      .catch((err) => {
        if (!cancelled) setLoadError(friendlyError(err, 'Could not load this case.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, id]);

  const reload = useCallback(async () => {
    try {
      const c = await api.get(`/cases/${id}`);
      setCaseData(c?.case || null);
      setViewer(c?.viewer || { isOwner: false, canReview: false });
    } catch (err) {
      setLoadError(friendlyError(err, 'Could not reload this case.'));
    }
  }, [id]);

  async function doAction(fn, successMsg) {
    setActionError(null);
    setWorking(true);
    try {
      await fn();
      await reload();
      toast(successMsg);
    } catch (err) {
      setActionError(friendlyError(err));
    } finally {
      setWorking(false);
    }
  }

  const handleSubmit = () => doAction(() => api.post(`/cases/${id}/submit`), 'Case submitted for review.');

  // Advance through the workflow until the case is ready for analysis
  // (submitted -> awaiting-evidence -> ready-for-analysis).
  const handleAdvanceToAnalysis = () =>
    doAction(async () => {
      const order = ['submitted', 'awaiting-evidence', 'ready-for-analysis'];
      let current = caseData?.status;
      while (current && current !== 'ready-for-analysis') {
        const next = order[order.indexOf(current) + 1];
        if (!next) break;
        const res = await api.post(`/cases/${id}/transition`, { to: next });
        current = res?.case?.status || next;
      }
    }, 'Case is ready for analysis. You can now request the AI assessment.');

  const handleArchive = () => {
    setArchiveOpen(false);
    doAction(() => api.post(`/cases/${id}/archive`), 'Case archived.');
  };

  const handleDelete = async () => {
    setDeleteOpen(false);
    setActionError(null);
    try {
      await api.delete(`/cases/${id}`);
      toast('Case deleted.');
      navigate('/dashboard');
    } catch (err) {
      setActionError(friendlyError(err, 'Could not delete the case.'));
    }
  };

  async function handleAppeal() {
    setAppealError('');
    if (!appealReason.trim()) {
      setAppealError('Please give a reason for your appeal.');
      return;
    }
    setWorking(true);
    try {
      const updated = await api.post(`/cases/${id}/appeal`, {
        reason: appealReason.trim(),
        newInfo: appealInfo.trim() || undefined,
      });
      setCaseData(updated?.case || null);
      setAppealOpen(false);
      setAppealReason('');
      setAppealInfo('');
      toast('Appeal filed.');
    } catch (err) {
      setAppealError(friendlyError(err, 'Could not file the appeal.'));
    } finally {
      setWorking(false);
    }
  }

  if (!user) return null;

  if (loading) {
    return (
      <main className="case-detail container">
        <div aria-label="Loading case">
          <div className="skeleton" style={{ height: 36, width: '55%', marginBottom: 16 }} />
          <div className="skeleton" style={{ height: 14, width: '90%', marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 14, width: '75%', marginBottom: 24 }} />
          <div className="skeleton" style={{ height: 200, width: '100%' }} />
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="case-detail container">
        <Alert variant="error" title="Could not load this case">
          {loadError}
        </Alert>
        <Link className="btn btn-secondary" to="/dashboard">
          Back to dashboard
        </Link>
      </main>
    );
  }

  if (!caseData) {
    return (
      <main className="case-detail container">
        <EmptyState
          icon={Scale}
          title="Case not found"
          message="This case does not exist or you do not have access to it."
          action={
            <Link className="btn btn-primary" to="/dashboard">
              Back to dashboard
            </Link>
          }
        />
      </main>
    );
  }

  const privacyLabel = caseData.privacy === 'invite-only' ? 'Invite-only' : 'Private';
  const canAppeal = !['draft', 'archived', 'appealed'].includes(caseData.status);

  return (
    <main className="case-detail container">
      <Link className="back-link" to="/dashboard">
        <ArrowLeft size={16} aria-hidden="true" /> Back to dashboard
      </Link>

      {/* Header */}
      <header className="case-header reveal">
        <h1 className="case-title">{caseData.title}</h1>
        <dl className="case-meta">
          <div className="meta-item">
            <dt>Case ID</dt>
            <dd>
              <code className="case-id" title={caseData.id}>
                {shortId(caseData.id)}
              </code>
            </dd>
          </div>
          <div className="meta-item">
            <dt>Category</dt>
            <dd>{caseData.category}</dd>
          </div>
          <div className="meta-item">
            <dt>Created</dt>
            <dd>{formatDate(caseData.createdAt)}</dd>
          </div>
          <div className="meta-item">
            <dt>Last updated</dt>
            <dd>{formatDate(caseData.updatedAt)}</dd>
          </div>
          <div className="meta-item">
            <dt>Privacy</dt>
            <dd>{privacyLabel}</dd>
          </div>
          <div className="meta-item">
            <dt>Status</dt>
            <dd>
              <StatusBadge status={caseData.status} />
            </dd>
          </div>
        </dl>
      </header>

      <div ref={revealRef} className="reveal-on-scroll">
        {/* Perspectives: both sides of the story */}
        <section aria-label="Perspectives" className="perspectives">
          {[
            ['Person A', caseData.personA],
            ['Person B', caseData.personB],
          ].map(([side, person]) => (
            <Card key={side} title={`${side} — ${person?.name || side}`}>
              <p className="statement">{person?.statement}</p>
              <h3 className="claims-heading">Key claims</h3>
              {person?.claims && person.claims.length > 0 ? (
                <ul className="claims-list">
                  {person.claims.map((claim, i) => (
                    <li key={i}>{claim}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No claims listed.</p>
              )}
            </Card>
          ))}
        </section>

        {caseData.situation && (
          <Card title="Situation" className="section-card">
            <p className="statement">{caseData.situation}</p>
          </Card>
        )}

        {caseData.desiredOutcome && (
          <Card title="Desired outcome" className="section-card">
            <p className="statement">{caseData.desiredOutcome}</p>
          </Card>
        )}

        {/* Evidence (server-stored) */}
        <EvidencePanel caseId={id} />

        {/* AI assessment */}
        <AssessmentPanel caseId={id} status={caseData.status} />

        {/* Reviewer feedback */}
        <ReviewsPanel caseId={id} viewer={viewer} />

        {/* Sharing */}
        <ShareCard caseId={id} />

        {/* Timeline */}
        <Card title="Timeline" className="section-card">
          {caseData.timeline && caseData.timeline.length > 0 ? (
            <ol className="timeline">
              {caseData.timeline.map((entry, i) => (
                <li key={i} className="timeline-entry">
                  <strong className="timeline-action">{entry.action}</strong>
                  {entry.detail && <p className="timeline-detail">{entry.detail}</p>}
                  <time className="timeline-date">{formatDateTime(entry.at)}</time>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">No timeline entries yet.</p>
          )}
        </Card>

        {/* Actions */}
        {actionError && (
          <Alert variant="error" title="Action failed">
            {actionError}
          </Alert>
        )}
        <Card title="Case actions" className="section-card">
          <div className="actions-row">
            {caseData.status === 'draft' && (
              <>
                <Link className="btn btn-primary btn-sm" to={`/cases/${id}/edit`}>
                  Edit draft
                </Link>
                <Button variant="secondary" size="sm" onClick={handleSubmit} loading={working}>
                  Submit for review
                </Button>
              </>
            )}
            {(caseData.status === 'submitted' || caseData.status === 'awaiting-evidence') && (
              <Button variant="primary" size="sm" onClick={handleAdvanceToAnalysis} loading={working}>
                Continue to AI analysis
              </Button>
            )}
            {caseData.status !== 'archived' && (
              <Button variant="secondary" size="sm" onClick={() => setArchiveOpen(true)} disabled={working}>
                Archive
              </Button>
            )}
            {canAppeal && (
              <Button variant="secondary" size="sm" onClick={() => setAppealOpen(true)} disabled={working}>
                Appeal
              </Button>
            )}
            <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)} disabled={working}>
              Delete
            </Button>
          </div>
          <p className="muted actions-note">
            Status changes follow the case workflow on the server — for example,
            submitting a draft, archiving a closed case, or appealing for a
            reassessment.
          </p>
        </Card>
      </div>

      {/* Archive confirmation */}
      <Modal
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        title="Archive this case?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setArchiveOpen(false)}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={handleArchive}>
              Archive case
            </Button>
          </>
        }
      >
        <p>
          Archived cases become read-only and move out of your active list. You can still open and
          read them later.
        </p>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this case?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Delete case
            </Button>
          </>
        }
      >
        <p>
          This permanently deletes the case and everything attached to it. This cannot be undone.
        </p>
      </Modal>

      {/* Appeal */}
      <Modal
        open={appealOpen}
        onClose={() => setAppealOpen(false)}
        title="Appeal for reassessment"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAppealOpen(false)} disabled={working}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleAppeal} loading={working}>
              {working ? 'Filing…' : 'File appeal'}
            </Button>
          </>
        }
      >
        {appealError && (
          <Alert variant="error" role="alert">
            {appealError}
          </Alert>
        )}
        <p className="muted">
          Explain why the current outcome should be reconsidered. Your appeal is
          recorded on the case timeline.
        </p>
        <Textarea
          id="appeal-reason"
          label="Reason for appeal"
          required
          value={appealReason}
          onChange={(e) => setAppealReason(e.target.value)}
          maxLength={2000}
          placeholder="Why should this case be reassessed?"
        />
        <Textarea
          id="appeal-new-info"
          label="New information (optional)"
          value={appealInfo}
          onChange={(e) => setAppealInfo(e.target.value)}
          maxLength={5000}
          placeholder="Anything new since the last assessment…"
        />
      </Modal>
    </main>
  );
}
