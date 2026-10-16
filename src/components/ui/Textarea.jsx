// Labeled textarea with optional hint / error text.
import './ui.css';

export default function Textarea({
  label,
  id,
  error,
  hint,
  required = false,
  rows = 4,
  ...rest
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
        {required && (
          <span className="required-star" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <textarea
        id={id}
        rows={rows}
        className="field-input"
        aria-invalid={!!error}
        aria-describedby={describedBy}
        required={required}
        {...rest}
      />
      {hint && !error && (
        <p className="field-hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field-error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
