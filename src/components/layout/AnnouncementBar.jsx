// Dismissible announcement bar (dismissal persisted in localStorage).
import { Megaphone, X } from 'lucide-react';
import useLocalStorage from '../../hooks/useLocalStorage.js';
import './layout.css';

const DISMISS_KEY = 'hc_announce_dismissed_v2';

export default function AnnouncementBar() {
  const [dismissed, setDismissed] = useLocalStorage(DISMISS_KEY, false);

  if (dismissed) return null;

  return (
    <div className="announcement-bar" role="region" aria-label="Announcement">
      <div className="container announcement-inner">
        <Megaphone size={18} className="announcement-icon" aria-hidden="true" />
        <p className="announcement-text">
          Your cases are now stored securely in your Human Court account —
          sign in to access them from any device.
        </p>
        <button
          type="button"
          className="announcement-dismiss"
          aria-label="Dismiss announcement"
          onClick={() => setDismissed(true)}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
