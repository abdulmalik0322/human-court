// Case Wizard — one component serves /cases/new and /cases/:id/edit.
// Drafts, evidence, and submission all go through the server API.
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, CheckCircle2, FileText, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { api, ApiError } from '../services/api.js';
import { useToast } from '../components/ui/Toast.jsx';
import { required, maxLength, runRules, CHAR_LIMITS } from '../utils/validation.js';
import { CATEGORIES } from '../data/sampleCase.js';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import Textarea from '../components/ui/Textarea.jsx';
import Select from '../components/ui/Select.jsx';
import Alert from '../components/ui/Alert.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import './NewCaseWizard.css';

const STEPS = ['Basics', 'Perspectives', 'Evidence', 'Review & submit'];
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain'];

// Char limits: prefer the shared constants, fall back to the spec'd numbers.
const L = {
  title: CHAR_LIMITS?.title ?? 120,
  summary: CHAR_LIMITS?.summary ?? 300,
  situation: CHAR_LIMITS?.situation ?? 8000,
  desiredOutcome: CHAR_LIMITS?.desiredOutcome ?? 1000,
  displayName: CHAR_LIMITS?.displayName ?? 40,
  statement: CHAR_LIMITS?.statement ?? 5000,
  name: CHAR_LIMITS?.personName ?? 80,
};

const emptyForm = () => ({
  title: '',
  summary: '',
  situation: '',
  category: '',
  desiredOutcome: '',
  privacy: 'private',
  displayName: '',
  personAName: '',
  personAStatement: '',
  personAClaims: '',
  personBName: '',
  personBStatement: '',
  personBClaims: '',
  // Evidence entries: { id?, localId?, name, size, type, description,
  //   status: 'uploading'|'done'|'error', progress, errorMsg?, uploadedAt? }
  evidence: [],
});

// Run validation rules safely (works even if the util has a different shape).
function check(value, rules) {
  if (typeof runRules === 'function') return runRules(value, rules) || null;
  for (const rule of rules) {
    const err = typeof rule === 'function' ? rule(value) : rule;
    if (err) return err;
  }
  return null;
}

const linesToArray = (text) =>
  text.split('\n').map((l) => l.trim()).filter(Boolean);

function friendlyError(err, fallback) {
  if (err instanceof ApiError) return err.message;
  return err?.message || fallback || 'Something went wrong.';
}

export default function NewCaseWizard() {
  const { id: editId } = useParams();
  const editMode = !!editId;
  const navigate = useNavigate();
  const { user } = useAuth();
  const toastApi = useToast();
  const notify = toastApi?.toast || toastApi?.showToast || (() => {});

  const [step, setStep] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [blockError, setBlockError] = useState(''); // "Next" blocked summary
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [caseId, setCaseId] = useState(editId || null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [fileError, setFileError] = useState('');
  const [loading, setLoading] = useState(editMode);
  const [loadError, setLoadError] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const idemRef = useRef(`wiz_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`);
  const saveTimer = useRef(null);
  const blockAlertRef = useRef(null);

  useEffect(() => {
    document.title = editMode ? 'Edit case — Human Court' : 'New case — Human Court';
  }, [editMode]);

  // Edit mode: load the existing draft and prefill the form.
  useEffect(() => {
    if (!editMode || !user) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await api.get(`/cases/${editId}`);
        const c = res?.case || null;
        if (cancelled) return;
        if (!c || c.status !== 'draft') {
          setLoadError(true);
          return;
        }
        setCaseId(c.id);
        setForm({
          title: c.title || '',
          summary: c.summary || '',
          situation: c.situation || '',
          category: c.category || '',
          desiredOutcome: c.desiredOutcome || '',
          privacy: c.privacy || 'private',
          displayName: c.displayName || '',
          personAName: c.personA?.name === 'Person A' ? '' : c.personA?.name || '',
          personAStatement: c.personA?.statement || '',
          personAClaims: Array.isArray(c.personA?.claims) ? c.personA.claims.join('\n') : c.personA?.claims || '',
          personBName: c.personB?.name === 'Person B' ? '' : c.personB?.name || '',
          personBStatement: c.personB?.statement || '',
          personBClaims: Array.isArray(c.personB?.claims) ? c.personB.claims.join('\n') : c.personB?.claims || '',
          evidence: [],
        });
        try {
          const ev = await api.get(`/cases/${editId}/evidence`);
          if (!cancelled) {
            setForm((f) => ({
              ...f,
              evidence: (ev?.items || []).map((e) => ({ ...e, status: 'done', progress: 100 })),
            }));
          }
        } catch {
          // Evidence list failing shouldn't block editing the draft.
        }
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editMode, editId, user]);

  const set = (name, value) => {
    setForm((f) => ({ ...f, [name]: value }));
    setDirty(true);
    setErrors((e) => ({ ...e, [name]: null }));
  };

  // Shape the form into an API input (claims become arrays).
  const buildInput = () => ({
    title: form.title.trim(),
    summary: form.summary.trim(),
    situation: form.situation.trim(),
    category: form.category,
    desiredOutcome: form.desiredOutcome.trim(),
    privacy: form.privacy,
    displayName: form.displayName.trim(),
    personA: {
      name: form.personAName.trim() || 'Person A',
      statement: form.personAStatement.trim(),
      claims: linesToArray(form.personAClaims),
    },
    personB: {
      name: form.personBName.trim() || 'Person B',
      statement: form.personBStatement.trim(),
      claims: linesToArray(form.personBClaims),
    },
  });

  // Save (or create) the draft via the API. Returns the case id.
  // The idempotency key makes double-submits safe: the server returns the
  // same case instead of creating a duplicate.
  const saveDraft = async () => {
    if (!user) return null;
    const input = buildInput();
    try {
      if (caseId) {
        await api.patch(`/cases/${caseId}`, input);
        return caseId;
      }
      const created = await api.post('/cases', {
        ...input,
        idempotencyKey: idemRef.current,
      });
      const newId = created?.case?.id;
      if (!newId) throw new Error('The server did not return a case id.');
      setCaseId(newId);
      return newId;
    } catch (err) {
      // The draft may have been submitted or removed elsewhere — keep the id
      // we have instead of failing the whole wizard.
      if (err?.code === 'NOT_DRAFT' || err?.status === 404 || err?.status === 409) {
        return caseId;
      }
      throw err;
    }
  };

  // Draft autosave: debounced 900ms, only while editing (not on review/submit).
  useEffect(() => {
    if (!dirty || step >= 3 || submitted || done || !user) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveDraft()
        .then((id) => {
          if (id) {
            setSavedAt(new Date());
            setDirty(false);
          }
        })
        .catch(() => {});
    }, 900);
    return () => clearTimeout(saveTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, dirty, step, submitted, done, user, caseId]);

  const categoryValues = CATEGORIES.map((c) => (typeof c === 'string' ? c : c.value));

  // Validate one step; returns an errors object (empty when valid).
  const validateStep = (n) => {
    const e = {};
    if (n === 0) {
      e.title = check(form.title.trim(), [(v) => required(v, 'Title'), maxLength(L.title)]);
      e.summary = check(form.summary.trim(), [(v) => required(v, 'Summary'), maxLength(L.summary)]);
      e.category = check(form.category, [(v) => required(v, 'Category')]);
      if (!e.category && form.category && !categoryValues.includes(form.category)) {
        e.category = 'Please choose a valid category.';
      }
      e.situation = check(form.situation, [maxLength(L.situation)]);
      e.desiredOutcome = check(form.desiredOutcome, [maxLength(L.desiredOutcome)]);
      e.displayName = check(form.displayName, [maxLength(L.displayName)]);
    }
    if (n === 1) {
      e.personAStatement = check(form.personAStatement.trim(), [(v) => required(v, "Person A's statement"), maxLength(L.statement)]);
      e.personBStatement = check(form.personBStatement.trim(), [(v) => required(v, "Person B's statement"), maxLength(L.statement)]);
      e.personAName = check(form.personAName, [maxLength(L.name)]);
      e.personBName = check(form.personBName, [maxLength(L.name)]);
    }
    return Object.fromEntries(Object.entries(e).filter(([, v]) => v));
  };

  const goNext = () => {
    const errs = validateStep(step);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      setBlockError('Please fix the highlighted fields.');
      // The blocking message renders above the form — on small screens it can
      // be off-screen, making it look like the button did nothing. Move the
      // user's attention to it and focus the first invalid field.
      const reduceMotion =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      requestAnimationFrame(() => {
        blockAlertRef.current?.scrollIntoView?.({
          behavior: reduceMotion ? 'auto' : 'smooth',
          block: 'center',
        });
        const firstKey = Object.keys(errs)[0];
        document.getElementById(`wiz-${firstKey}`)?.focus({ preventScroll: true });
      });
      return;
    }
    setBlockError('');
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setBlockError('');
    setStep((s) => Math.max(s - 1, 0)); // back is always allowed, no data loss
  };

  // Upload one file to the server immediately, with progress.
  const uploadFile = async (id, tempId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('description', '');
    try {
      const meta = await api.uploadWithProgress(
        `/cases/${id}/evidence`,
        formData,
        (pct) => {
          setForm((f) => ({
            ...f,
            evidence: f.evidence.map((e) =>
              e.localId === tempId ? { ...e, progress: pct } : e
            ),
          }));
        }
      );
      setForm((f) => ({
        ...f,
        evidence: f.evidence.map((e) =>
          e.localId === tempId
            ? { ...e, ...(meta || {}), status: 'done', progress: 100 }
            : e
        ),
      }));
    } catch (err) {
      setForm((f) => ({
        ...f,
        evidence: f.evidence.map((e) =>
          e.localId === tempId
            ? { ...e, status: 'error', errorMsg: friendlyError(err, 'Upload failed.') }
            : e
        ),
      }));
    }
  };

  // Evidence file picking: uploads start immediately with a progress bar.
  // Client-side guard: 10 MB max + allowed types, before anything is sent.
  const onFilesPicked = async (event) => {
    setFileError('');
    const files = Array.from(event.target.files || []);
    event.target.value = ''; // allow re-picking the same file
    const valid = [];
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        setFileError(`"${file.name}" is over 10 MB and was skipped.`);
        continue;
      }
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setFileError(`"${file.name}": unsupported file type.`);
        continue;
      }
      valid.push(file);
    }
    if (valid.length === 0) return;

    let id;
    try {
      id = await saveDraft();
    } catch {
      setFileError('Could not save the draft. Your files were not uploaded.');
      return;
    }
    if (!id) {
      setFileError('Could not save the draft. Your files were not uploaded.');
      return;
    }

    const entries = valid.map((file) => ({
      localId: `ev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      size: file.size,
      type: file.type,
      description: '',
      status: 'uploading',
      progress: 0,
      _file: file,
    }));
    setForm((f) => ({ ...f, evidence: [...f.evidence, ...entries] }));
    // Uploads run in parallel; each row shows its own progress.
    await Promise.all(entries.map((entry) => uploadFile(id, entry.localId, entry._file)));
    // Drop the in-memory File objects for successful uploads; keep them on
    // failed rows so "Retry" can re-send without re-picking the file.
    setForm((f) => ({
      ...f,
      evidence: f.evidence.map((e) => {
        if (e.status === 'done' && e._file) {
          const { _file, ...rest } = e;
          return rest;
        }
        return e;
      }),
    }));
  };

  const retryUpload = (idx) => {
    const entry = form.evidence[idx];
    if (!entry || !entry._file || !caseId) return;
    setForm((f) => ({
      ...f,
      evidence: f.evidence.map((e, i) =>
        i === idx ? { ...e, status: 'uploading', progress: 0, errorMsg: undefined } : e
      ),
    }));
    uploadFile(caseId, entry.localId, entry._file).then(() => {
      // Keep _file on failed rows so Retry stays possible.
      setForm((f) => ({
        ...f,
        evidence: f.evidence.map((e) => {
          if (e.status === 'done' && e._file) {
            const { _file, ...rest } = e;
            return rest;
          }
          return e;
        }),
      }));
    });
  };

  const removeEvidence = async (idx) => {
    const entry = form.evidence[idx];
    if (!entry || entry.status === 'uploading') return;
    if (entry.id && caseId) {
      try {
        await api.delete(`/cases/${caseId}/evidence/${entry.id}`);
      } catch (err) {
        notify(friendlyError(err, 'Could not delete that file.'), 'error');
        return;
      }
    }
    setForm((f) => ({ ...f, evidence: f.evidence.filter((_, i) => i !== idx) }));
    setDirty(true);
  };

  const saveAndExit = async () => {
    try {
      await saveDraft();
      navigate('/dashboard');
    } catch {
      notify('Could not save the draft. Please try again.', 'error');
    }
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitError('');
    setSubmitting(true);
    try {
      const id = await saveDraft();
      if (!id) throw new Error('Could not save the draft.');
      await api.post(`/cases/${id}/submit`);
      setSubmitted(true);
      setDone(true);
    } catch (err) {
      setSubmitError(friendlyError(err, 'Submission failed. Your draft is safe — please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  // ---- render guards ----
  if (!user) {
    return (
      <main className="container wizard-page">
        <EmptyState
          title="Please sign in"
          message="You need an account to file a case."
          action={<Link className="btn btn-secondary" to="/login">Sign in</Link>}
        />
      </main>
    );
  }
  if (loading) {
    return (
      <main className="container wizard-page wizard-center">
        <Spinner />
      </main>
    );
  }
  if (loadError) {
    return (
      <main className="container wizard-page">
        <EmptyState
          title="Case not available"
          message="This case was not found, or it is no longer a draft and cannot be edited."
          action={<Link className="btn btn-secondary" to="/dashboard">Back to dashboard</Link>}
        />
      </main>
    );
  }

  // ---- success screen ----
  if (done) {
    return (
      <main className="container wizard-page wizard-center">
        <CheckCircle2 size={64} className="success-icon" aria-hidden="true" />
        <h1>{editMode ? 'Changes saved.' : 'Your case has been submitted.'}</h1>
        <p className="muted">Case ID: {caseId}</p>
        <div className="btn-row">
          <Link className="btn-link-primary" to={`/cases/${caseId}`}>View case</Link>
          {editMode ? (
            <Link className="btn-link-secondary" to={`/cases/${caseId}`}>Back to case</Link>
          ) : (
            <>
              <Link className="btn-link-secondary" to="/dashboard">Back to dashboard</Link>
              <Link className="btn-link-secondary" to="/cases/new">Create another</Link>
            </>
          )}
        </div>
      </main>
    );
  }

  const fmtTime = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <main className="container wizard-page">
      <h1>{editMode ? 'Edit case' : 'File a new case'}</h1>
      <p className="muted wizard-sub">Your draft saves automatically as you type.</p>

      {/* Stepper */}
      <ol className="stepper" aria-label="Case progress">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={i === step ? 'current' : i < step ? 'done' : ''}
            aria-current={i === step ? 'step' : undefined}
          >
            <span className="step-num" aria-hidden="true">
              {i < step ? <Check size={14} /> : i + 1}
            </span>
            <span className="step-label">{label}</span>
          </li>
        ))}
      </ol>

      {savedAt && (
        <p className="autosave-note">
          <Check size={14} aria-hidden="true" /> Draft saved · {fmtTime(savedAt)}
        </p>
      )}

      <div ref={blockAlertRef}>
        {blockError && <Alert variant="error">{blockError}</Alert>}
      </div>
      {submitError && <Alert variant="error">{submitError}</Alert>}

      {/* STEP 0 — Basics */}
      {step === 0 && (
        <section aria-label="Basics">
          <Input
            id="wiz-title"
            label="Case title"
            required
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            error={errors.title}
            maxLength={L.title}
            placeholder="Give your case a short title"
          />
          <Textarea
            id="wiz-summary"
            label="Summary"
            required
            value={form.summary}
            onChange={(e) => set('summary', e.target.value)}
            error={errors.summary}
            maxLength={L.summary}
            placeholder="What is this case about, in a few sentences?"
          />
          <Select
            id="wiz-category"
            label="Category"
            required
            value={form.category}
            onChange={(e) => set('category', e.target.value)}
            error={errors.category}
            options={[{ value: '', label: 'Choose a category' }, ...CATEGORIES.map((c) => (
              typeof c === 'string' ? { value: c, label: c } : c
            ))]}
          />
          <Textarea
            id="wiz-situation"
            label="Situation (optional)"
            value={form.situation}
            onChange={(e) => set('situation', e.target.value)}
            error={errors.situation}
            maxLength={L.situation}
            hint="Background and context — what led to this dispute?"
          />
          <Textarea
            id="wiz-desiredOutcome"
            label="Desired outcome (optional)"
            value={form.desiredOutcome}
            onChange={(e) => set('desiredOutcome', e.target.value)}
            error={errors.desiredOutcome}
            maxLength={L.desiredOutcome}
            placeholder="What would a fair resolution look like to you?"
          />
          <Input
            id="wiz-displayName"
            label="Display name (optional)"
            value={form.displayName}
            onChange={(e) => set('displayName', e.target.value)}
            error={errors.displayName}
            maxLength={L.displayName}
            hint="The name shown publicly on your case."
          />
          <fieldset className="privacy-field">
            <legend>Privacy</legend>
            <label>
              <input
                type="radio"
                name="privacy"
                value="private"
                checked={form.privacy === 'private'}
                onChange={(e) => set('privacy', e.target.value)}
              />
              Private — only you can see it
            </label>
            <label>
              <input
                type="radio"
                name="privacy"
                value="invite-only"
                checked={form.privacy === 'invite-only'}
                onChange={(e) => set('privacy', e.target.value)}
              />
              Invite-only — only people you invite can see it
            </label>
          </fieldset>
        </section>
      )}

      {/* STEP 1 — Perspectives */}
      {step === 1 && (
        <section aria-label="Perspectives">
          <h2>Person A</h2>
          <Input
            id="wiz-personAName"
            label="Name (optional — defaults to “Person A”)"
            value={form.personAName}
            onChange={(e) => set('personAName', e.target.value)}
            error={errors.personAName}
            maxLength={L.name}
          />
          <Textarea
            id="wiz-personAStatement"
            label="Person A's statement"
            required
            value={form.personAStatement}
            onChange={(e) => set('personAStatement', e.target.value)}
            error={errors.personAStatement}
            maxLength={L.statement}
            placeholder="Describe the situation from Person A's side."
          />
          <Textarea
            id="wiz-personAClaims"
            label="Person A's key claims (optional, one per line)"
            value={form.personAClaims}
            onChange={(e) => set('personAClaims', e.target.value)}
            hint="One claim per line, e.g. “The payment was agreed for the 5th.”"
          />
          <h2>Person B</h2>
          <Input
            id="wiz-personBName"
            label="Name (optional — defaults to “Person B”)"
            value={form.personBName}
            onChange={(e) => set('personBName', e.target.value)}
            error={errors.personBName}
            maxLength={L.name}
          />
          <Textarea
            id="wiz-personBStatement"
            label="Person B's statement"
            required
            value={form.personBStatement}
            onChange={(e) => set('personBStatement', e.target.value)}
            error={errors.personBStatement}
            maxLength={L.statement}
            placeholder="Describe the situation from Person B's side."
          />
          <Textarea
            id="wiz-personBClaims"
            label="Person B's key claims (optional, one per line)"
            value={form.personBClaims}
            onChange={(e) => set('personBClaims', e.target.value)}
            hint="One claim per line."
          />
        </section>
      )}

      {/* STEP 2 — Evidence */}
      {step === 2 && (
        <section aria-label="Evidence">
          <Alert variant="info">
            Files are uploaded immediately and stored securely server-side.
            Descriptions are attached at upload time.
          </Alert>
          <label className="file-label" htmlFor="evidence-files">
            Add evidence (optional)
          </label>
          <input
            id="evidence-files"
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,.pdf,.txt"
            onChange={onFilesPicked}
            className="file-input"
          />
          <p className="muted hint">JPG, PNG, WebP, PDF or TXT — up to 10 MB each.</p>
          {fileError && <Alert variant="error">{fileError}</Alert>}
          {form.evidence.length > 0 && (
            <ul className="evidence-list">
              {form.evidence.map((ev, i) => (
                <li key={ev.localId || ev.id || i} className="evidence-item">
                  <FileText size={20} aria-hidden="true" />
                  <div className="evidence-meta">
                    <span className="evidence-name">{ev.name}</span>
                    <span className="muted evidence-sub">
                      {Math.max(1, Math.round(ev.size / 1024))} KB · {ev.type}
                    </span>
                    {ev.status === 'uploading' && (
                      <div
                        className="upload-progress"
                        role="progressbar"
                        aria-valuenow={ev.progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Uploading ${ev.name}`}
                      >
                        <div
                          className="upload-progress-bar"
                          style={{ width: `${ev.progress || 0}%` }}
                        />
                        <span className="muted evidence-sub">{ev.progress || 0}%</span>
                      </div>
                    )}
                    {ev.status === 'error' && (
                      <Alert variant="error">
                        {ev.errorMsg || 'Upload failed.'}{' '}
                        <Button variant="ghost" size="sm" onClick={() => retryUpload(i)}>
                          Retry
                        </Button>
                      </Alert>
                    )}
                    {ev.status === 'done' && ev.description && (
                      <span className="muted evidence-sub">{ev.description}</span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => removeEvidence(i)}
                    disabled={ev.status === 'uploading'}
                    aria-label={`Remove ${ev.name}`}
                  >
                    <X size={16} aria-hidden="true" /> Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* STEP 3 — Review & submit */}
      {step === 3 && (
        <section aria-label="Review and submit">
          <h2>Review your case</h2>
          <dl className="review-list">
            <div><dt>Title</dt><dd>{form.title}</dd></div>
            <div><dt>Summary</dt><dd>{form.summary}</dd></div>
            <div><dt>Category</dt><dd>{form.category}</dd></div>
            {form.situation && (
              <div>
                <dt>Situation</dt>
                <dd><LongText text={form.situation} /></dd>
              </div>
            )}
            {form.desiredOutcome && (
              <div>
                <dt>Desired outcome</dt><dd>{form.desiredOutcome}</dd>
              </div>
            )}
            <div><dt>Privacy</dt><dd>{form.privacy === 'invite-only' ? 'Invite-only' : 'Private'}</dd></div>
            {form.displayName && <div><dt>Display name</dt><dd>{form.displayName}</dd></div>}
            <div>
              <dt>{form.personAName.trim() || 'Person A'} — statement</dt>
              <dd><LongText text={form.personAStatement} /></dd>
            </div>
            {linesToArray(form.personAClaims).length > 0 && (
              <div>
                <dt>{form.personAName.trim() || 'Person A'} — key claims</dt>
                <dd><ul className="claims-list">{linesToArray(form.personAClaims).map((c, i) => <li key={i}>{c}</li>)}</ul></dd>
              </div>
            )}
            <div>
              <dt>{form.personBName.trim() || 'Person B'} — statement</dt>
              <dd><LongText text={form.personBStatement} /></dd>
            </div>
            {linesToArray(form.personBClaims).length > 0 && (
              <div>
                <dt>{form.personBName.trim() || 'Person B'} — key claims</dt>
                <dd><ul className="claims-list">{linesToArray(form.personBClaims).map((c, i) => <li key={i}>{c}</li>)}</ul></dd>
              </div>
            )}
            <div>
              <dt>Evidence</dt>
              <dd>
                {form.evidence.length === 0 ? (
                  <span className="muted">None added.</span>
                ) : (
                  <ul className="claims-list">
                    {form.evidence.map((ev, i) => (
                      <li key={ev.localId || ev.id || i}>
                        {ev.name}
                        {ev.status === 'uploading' ? ' (uploading…)' : ''}
                        {ev.status === 'error' ? ' (upload failed)' : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </dd>
            </div>
          </dl>
        </section>
      )}

      {/* Navigation */}
      <div className="wizard-nav">
        {step > 0 && !done && (
          <Button variant="secondary" onClick={goBack}>Back</Button>
        )}
        {step < STEPS.length - 1 && (
          <Button variant="primary" onClick={goNext}>Next</Button>
        )}
        {step === STEPS.length - 1 && (
          <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting…' : editMode ? 'Save changes' : 'Submit case'}
          </Button>
        )}
        <Button variant="ghost" onClick={saveAndExit}>Save &amp; exit</Button>
      </div>
    </main>
  );
}

// Long text in review: truncated behind a <details> expander.
function LongText({ text }) {
  const LIMIT = 400;
  if (!text || text.length <= LIMIT) return <span>{text}</span>;
  return (
    <details className="long-text">
      <summary>View full text ({text.length} characters)</summary>
      <p className="long-text-body">{text}</p>
    </details>
  );
}
