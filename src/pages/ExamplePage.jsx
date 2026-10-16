// Example page — a full walkthrough of the fictional sample case.
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { sampleCase } from '../data/sampleCase.js';
import Card from '../components/ui/Card.jsx';
import Alert from '../components/ui/Alert.jsx';
import './ExamplePage.css';

// Render a string as a paragraph, an array as a list, anything else as-is.
function Block({ value }) {
  if (!value) return null;
  if (Array.isArray(value)) {
    return (
      <ul className="example-list">
        {value.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    );
  }
  return <p>{value}</p>;
}

export default function ExamplePage() {
  useEffect(() => {
    document.title = 'Example case — Human Court';
  }, []);

  const c = sampleCase || {};
  const personA = c.personA || {};
  const personB = c.personB || {};
  const a = c.assessment || {};

  // Assessment subsections in display order: [heading, value].
  const sections = [
    ['Summary', a.summary],
    ["Person A's main claims", a.claimsA],
    ["Person B's main claims", a.claimsB],
    ['Where they agree', a.agreements],
    ['Where they disagree', a.disagreements],
    ['Supported by evidence', a.supportedByEvidence],
    ['Still unverified', a.unverified],
    ['Missing information', a.missingInformation],
    ['Alternative explanations', a.alternativeExplanations],
    ['Questions that could help', a.questions],
    ['Suggested next steps', a.nextSteps],
    ['Limitations', a.limitations],
    ['Overall assessment', a.overall],
  ].filter(([, value]) => value && (!Array.isArray(value) || value.length > 0));

  return (
    <main className="container example-page">
      <header className="example-header">
        <div className="example-header-inner">
          <div>
            <span className="demo-label">Sample demonstration</span>
            <h1>{c.title || 'Example case'}</h1>
            <p className="muted">
              {c.category ? `${c.category} · ` : ''}Sample case · Not a real submission
            </p>
          </div>
          <figure className="page-hero-visual example-header-img">
            <img
              src="/images/example-hero.jpg"
              alt="An open case file with documents and notes arranged on a dark desk"
              className="page-hero-img"
            />
          </figure>
        </div>
      </header>

      {/* The situation */}
      <Card className="example-card">
        <h2>The situation</h2>
        {Array.isArray(c.situation) ? (
          c.situation.map((p, i) => <p key={i}>{p}</p>)
        ) : (
          <p>{c.situation}</p>
        )}
      </Card>

      {/* Two perspectives */}
      <section aria-label="Two perspectives">
        <h2 className="example-h2">Two perspectives</h2>
        <div className="perspectives-grid">
          <Card className="example-card">
            <h3>{personA.name || 'Person A'}</h3>
            <p>{personA.statement}</p>
            {personA.claims?.length > 0 && (
              <>
                <h4>Key claims</h4>
                <ul className="example-list">
                  {personA.claims.map((claim, i) => (
                    <li key={i}>{claim}</li>
                  ))}
                </ul>
              </>
            )}
          </Card>
          <Card className="example-card">
            <h3>{personB.name || 'Person B'}</h3>
            <p>{personB.statement}</p>
            {personB.claims?.length > 0 && (
              <>
                <h4>Key claims</h4>
                <ul className="example-list">
                  {personB.claims.map((claim, i) => (
                    <li key={i}>{claim}</li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        </div>
      </section>

      {/* Evidence */}
      <Card className="example-card">
        <h2>Evidence (illustrative)</h2>
        {c.evidence?.length > 0 ? (
          <ul className="example-list evidence-kind-list">
            {c.evidence.map((item, i) => (
              <li key={i}>
                <strong>{item.kind || item.name || 'Item'}</strong>
                {item.description ? ` — ${item.description}` : ''}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No evidence items in this example.</p>
        )}
      </Card>

      {/* Sample assessment */}
      <Card className="example-card">
        <span className="demo-label">Sample demonstration — not real AI analysis</span>
        <h2>Sample assessment</h2>
        {a.outcomeLabel && (
          <p className="outcome-line">
            Overall: <span className="outcome-badge">{a.outcomeLabel}</span>
          </p>
        )}
        {sections.map(([heading, value]) => (
          <div key={heading} className="assessment-section">
            <h3>{heading}</h3>
            <Block value={value} />
          </div>
        ))}
      </Card>

      {/* Honesty box */}
      <Alert variant="warning">
        This is a fictional example. It is not a real case, not a real analysis,
        and proves nothing about anyone.
      </Alert>

      {/* Calls to action */}
      <div className="example-cta">
        <Link className="cta-primary" to="/cases/new">Bring Your Case</Link>
        <Link className="cta-secondary" to="/how-it-works">How it works</Link>
      </div>
    </main>
  );
}
