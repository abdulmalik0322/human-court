// Inline notice banner with a per-variant icon + optional dismiss button.
import { Info, CheckCircle2, AlertTriangle, AlertCircle, X } from 'lucide-react';
import './ui.css';

const ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
};

export default function Alert({
  variant = 'info', // info | success | warning | error
  title,
  children,
  onDismiss,
}) {
  const Icon = ICONS[variant] ?? Info;

  return (
    <div
      className={`alert alert-${variant}`}
      role={variant === 'error' ? 'alert' : 'status'}
    >
      <span className="alert-icon">
        <Icon size={18} aria-hidden="true" />
      </span>
      <div className="alert-body">
        {title && <h4 className="alert-title">{title}</h4>}
        {children}
      </div>
      {onDismiss && (
        <button
          type="button"
          className="alert-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss alert"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
