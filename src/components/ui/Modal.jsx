// Accessible modal dialog: Escape closes, focus moves to the heading on open.
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import './ui.css';

export default function Modal({ open, onClose, title, children, footer }) {
  const titleRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    // Move focus to the dialog heading for screen-reader users.
    titleRef.current?.focus();

    const handleKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  // Clicking the dimmed overlay (not the dialog) closes the modal.
  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header">
          <h2 className="modal-title" ref={titleRef} tabIndex={-1}>
            {title}
          </h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
