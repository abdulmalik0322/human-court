// Sticky site header: brand, desktop nav, notifications, auth actions, mobile menu.
import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Bell, Scale, Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../services/api.js';
import Button from '../ui/Button.jsx';
import './layout.css';

const NAV_ITEMS = [
  { to: '/', label: 'Home' },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/about', label: 'About' },
  { to: '/faq', label: 'FAQ' },
  { to: '/example', label: 'Example' },
];

const NOTIF_POLL_MS = 60_000;

function navLinkClass({ isActive }) {
  return `nav-link${isActive ? ' active' : ''}`;
}

// Notifications bell with an unread-count badge. The count is fetched from
// the server on mount and refreshed every 60 seconds while signed in.
function NotificationsBell({ onNavigate }) {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnread(0);
      return undefined;
    }
    let cancelled = false;
    const fetchUnread = () => {
      api
        .get('/notifications', { params: { page: 1, pageSize: 1 } })
        .then((data) => {
          if (!cancelled) setUnread(Number(data?.unreadCount) || 0);
        })
        .catch(() => {
          // Notifications are non-critical; a failed fetch just leaves the
          // badge hidden rather than breaking the header.
          if (!cancelled) setUnread(0);
        });
    };
    fetchUnread();
    const timer = setInterval(fetchUnread, NOTIF_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [user]);

  if (!user) return null;

  return (
    <Link
      to="/notifications"
      className="notif-bell"
      aria-label={unread > 0 ? `${unread} unread notifications` : 'Notifications'}
      onClick={onNavigate}
    >
      <Bell size={20} aria-hidden="true" />
      {unread > 0 && (
        <span className="notif-badge" aria-hidden="true">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  );
}

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  async function handleLogout() {
    await logout();
    closeMenu();
    navigate('/', { replace: true });
  }

  // Desktop nav shown ≥768px; mobile panel below that breakpoint.
  const navLinks = NAV_ITEMS.map((item) => (
    <NavLink key={item.to} to={item.to} className={navLinkClass} end onClick={closeMenu}>
      {item.label}
    </NavLink>
  ));

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link to="/" className="brand-link" onClick={closeMenu}>
          <Scale size={24} aria-hidden="true" />
          <strong>Human Court</strong>
        </Link>

        <nav className="main-nav" aria-label="Primary">
          <ul>
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} className={navLinkClass} end>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="header-actions">
          {user ? (
            <>
              <NotificationsBell onNavigate={closeMenu} />
              <Link to="/dashboard" className="link-like auth-desktop">
                Dashboard
              </Link>
              <Link to="/settings" className="link-like auth-desktop">
                Settings
              </Link>
              <Button variant="ghost" size="sm" className="auth-desktop" onClick={handleLogout}>
                Log out
              </Button>
            </>
          ) : (
            <>
              <Link to="/login" className="link-like auth-desktop">
                Log in
              </Link>
              <Button size="sm" className="auth-desktop" onClick={() => navigate('/cases/new')}>
                Bring Your Case
              </Button>
            </>
          )}

          <button
            type="button"
            className="menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? (
              <X size={20} aria-hidden="true" />
            ) : (
              <Menu size={20} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      <nav
        id="mobile-nav"
        className={`mobile-nav container${menuOpen ? ' open' : ''}`}
        aria-label="Mobile"
      >
        {navLinks}
        {user && (
          <NavLink to="/notifications" className={navLinkClass} end onClick={closeMenu}>
            Notifications
          </NavLink>
        )}
        {user ? (
          <>
            <NavLink to="/dashboard" className={navLinkClass} end onClick={closeMenu}>
              Dashboard
            </NavLink>
            <NavLink to="/settings" className={navLinkClass} end onClick={closeMenu}>
              Settings
            </NavLink>
            <button type="button" className="nav-link nav-action-btn" onClick={handleLogout}>
              Log out
            </button>
          </>
        ) : (
          <>
            <NavLink to="/login" className={navLinkClass} end onClick={closeMenu}>
              Log in
            </NavLink>
            <NavLink to="/cases/new" className={navLinkClass} end onClick={closeMenu}>
              Bring Your Case
            </NavLink>
          </>
        )}
      </nav>
    </header>
  );
}
