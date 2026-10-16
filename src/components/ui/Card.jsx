// Content card with an optional header (title, subtitle, actions).
import './ui.css';

export default function Card({
  title,
  subtitle,
  actions,
  children,
  className = '',
}) {
  const hasHeader = title || subtitle || actions;

  return (
    <section className={`card ${className}`}>
      {hasHeader && (
        <header className="card-header">
          <div>
            {title && <h3 className="card-title">{title}</h3>}
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
