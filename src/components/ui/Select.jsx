// Labeled dropdown select with optional hint / error text.
import './ui.css';

export default function Select({
  label,
  id,
  error,
  hint,
  required = false,
  options = [], // [{ value, label }]
  placeholder = 'Select…',
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
      <select
        id={id}
        className="field-input"
        aria-invalid={!!error}
        aria-describedby={describedBy}
        required={required}
        {...rest}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
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
