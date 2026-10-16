// Site footer: brand, link columns, and the legal bottom bar.
import { Link } from 'react-router-dom';
import { Scale } from 'lucide-react';
import './layout.css';

const COLUMNS = [
  {
    heading: 'Explore',
    links: [
      { to: '/how-it-works', label: 'How it works' },
      { to: '/example', label: 'Example' },
      { to: '/faq', label: 'FAQ' },
    ],
  },
  {
    heading: 'Company',
    links: [{ to: '/about', label: 'About' }],
  },
  {
    heading: 'Account',
    links: [
      { to: '/dashboard', label: 'Dashboard' },
      { to: '/settings', label: 'Settings' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { to: '/privacy', label: 'Privacy Policy' },
      { to: '/terms', label: 'Terms of Service' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Link to="/" className="brand-link">
            <Scale size={24} aria-hidden="true" />
            <strong>Human Court</strong>
          </Link>
          <p className="footer-tagline">
            Your story. Both sides. Fair reasoning.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div className="footer-col" key={col.heading}>
            <h4>{col.heading}</h4>
            <ul>
              {col.links.map((link) => (
                <li key={link.to}>
                  <Link to={link.to}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="container footer-bottom">
        <p>
          © 2026 Human Court — Human Court is not a court of law
          and does not provide legal advice.
        </p>
      </div>
    </footer>
  );
}
