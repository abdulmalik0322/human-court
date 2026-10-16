// Generic labeled wrapper for any custom control
// (checkbox groups, file pickers, date pickers, etc.).
import './ui.css';

export default function Field({
  label,
  htmlFor,
  error,
  hint,
  required = false,
  children,
}) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={htmlFor}>
        {label}
        {required && (
          <span className="required-star" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && <p className="field-hint">{hint}</p>}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
