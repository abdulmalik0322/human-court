// Reusable button with variant + size + loading state.
import Spinner from './Spinner.jsx';
import './ui.css';

export default function Button({
  children,
  variant = 'primary', // primary | secondary | ghost | danger
  size = 'md',         // sm | md | lg
  type = 'button',
  disabled = false,
  loading = false,
  onClick,
  className = '',
  ...rest
}) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      className={`btn btn-${variant} btn-${size} ${className}`}
      disabled={isDisabled}
      aria-busy={loading}
      onClick={onClick}
      {...rest}
    >
      {loading && <Spinner size={16} />}
      {children}
    </button>
  );
}
