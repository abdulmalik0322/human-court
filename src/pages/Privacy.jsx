// Privacy Policy — honest draft. NOT legal advice and NOT final:
// it must be reviewed by a lawyer before any commercial launch.
import { useEffect } from 'react';
import { Scale } from 'lucide-react';
import Card from '../components/ui/Card.jsx';
import Alert from '../components/ui/Alert.jsx';
import './Legal.css';

export default function Privacy() {
  useEffect(() => {
    document.title = 'Privacy Policy · Human Court';
  }, []);

  return (
    <main className="container legal-page">
      <Alert variant="warning" title="Draft — requires legal review before commercial launch">
        This privacy policy is a working draft written to describe the product
        honestly. It has not been reviewed by a lawyer and must not be relied
        on as a final legal document.
      </Alert>

      <div className="legal-brand">
        <Scale size={24} aria-hidden="true" />
        <h1>Privacy Policy</h1>
      </div>
      <p className="muted">Last updated: October 2026 (draft)</p>

      <Card className="legal-card">
        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Account information:</strong> your name, email address, and
            password (stored as a one-way hash — we never store your password
            in readable form).
          </li>
          <li>
            <strong>Case content:</strong> the titles, summaries, perspectives,
            claims, and evidence files you choose to submit for a case.
          </li>
          <li>
            <strong>Preferences:</strong> your notification and privacy settings.
          </li>
          <li>
            <strong>Technical data:</strong> basic session information needed to
            keep you signed in (a secure session cookie) and to operate the
            service.
          </li>
        </ul>

        <h2>How we use it</h2>
        <ul>
          <li>To run your account: sign-in, sessions, and security.</li>
          <li>To store and process your cases and generate assessments.</li>
          <li>
            To send the notifications you asked for. We do not sell your data
            and we do not use your case content for advertising.
          </li>
        </ul>

        <h2>Sharing</h2>
        <p>
          Your cases are private by default. We only share case information
          when you ask us to: inviting a reviewer, or creating a public share
          link. A shared link shows only the summary fields you approved — not
          your full case file.
        </p>

        <h2>Your rights</h2>
        <ul>
          <li>
            <strong>Export:</strong> download everything we store about you as
            JSON from Settings.
          </li>
          <li>
            <strong>Delete:</strong> deleting your account permanently removes
            your account, cases, evidence, and reviews. This cannot be undone.
          </li>
        </ul>

        <h2>Data security</h2>
        <p>
          We protect accounts with hashed passwords and session cookies, and
          evidence files are stored server-side with access limited to you.
          No system is perfectly secure; if we learn of a breach affecting
          your data, we will tell you.
        </p>

        <h2>Children</h2>
        <p>
          Human Court is not intended for children under 13, and we do not
          knowingly collect their data.
        </p>

        <h2>Changes</h2>
        <p>
          If this policy changes materially, we will notify you in the app
          before the changes take effect.
        </p>
      </Card>
    </main>
  );
}
