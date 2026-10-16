// Terms of Service — honest draft. NOT legal advice and NOT final:
// it must be reviewed by a lawyer before any commercial launch.
import { useEffect } from 'react';
import { Scale } from 'lucide-react';
import Card from '../components/ui/Card.jsx';
import Alert from '../components/ui/Alert.jsx';
import './Legal.css';

export default function Terms() {
  useEffect(() => {
    document.title = 'Terms of Service · Human Court';
  }, []);

  return (
    <main className="container legal-page">
      <Alert variant="warning" title="Draft — requires legal review before commercial launch">
        These terms are a working draft written to describe the product
        honestly. They have not been reviewed by a lawyer and must not be
        relied on as a final legal document.
      </Alert>

      <div className="legal-brand">
        <Scale size={24} aria-hidden="true" />
        <h1>Terms of Service</h1>
      </div>
      <p className="muted">Last updated: October 2026 (draft)</p>

      <Card className="legal-card">
        <h2>What Human Court is</h2>
        <p>
          Human Court helps you organize a dispute — both sides, the evidence,
          and a structured assessment — so you can reason about it more
          clearly. <strong>Human Court is not a court of law.</strong>
        </p>

        <h2>Not legal advice</h2>
        <p>
          Nothing on Human Court — including AI-generated assessments, reviewer
          opinions, and shared summaries — is legal advice. We are not lawyers
          and we do not represent you. For legal questions, consult a
          qualified lawyer in your jurisdiction.
        </p>

        <h2>About AI assessments</h2>
        <ul>
          <li>
            Assessments are generated automatically from the information you
            provide. They reflect what you told us — not an independent
            investigation.
          </li>
          <li>
            Assessments can be wrong, incomplete, or biased by missing or
            one-sided information. Always read the stated limitations and
            missing information before acting on one.
          </li>
          <li>
            We label the analysis engine honestly (built-in engine vs. external
            AI model) so you know what produced each assessment.
          </li>
        </ul>

        <h2>Your responsibilities</h2>
        <ul>
          <li>Provide information truthfully and in good faith.</li>
          <li>
            Do not submit content you do not have the right to share, or that
            is unlawful, harassing, or defamatory.
          </li>
          <li>
            Keep your password secret. You are responsible for activity on your
            account.
          </li>
        </ul>

        <h2>Accounts and termination</h2>
        <p>
          You may delete your account at any time from Settings; deletion is
          permanent. We may suspend or close accounts that abuse the service
          or violate these terms.
        </p>

        <h2>Liability</h2>
        <p>
          The service is provided "as is". To the extent permitted by law, we
          are not liable for decisions you make based on assessments or
          reviews shown on the platform.
        </p>

        <h2>Changes</h2>
        <p>
          We may update these terms; material changes will be announced in the
          app before they take effect. Continued use after changes take effect
          means you accept the updated terms.
        </p>
      </Card>
    </main>
  );
}
