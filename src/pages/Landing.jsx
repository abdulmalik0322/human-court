import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../components/ui/Card.jsx';
import Alert from '../components/ui/Alert.jsx';
import { sampleCase } from '../data/sampleCase.js';
import { useReveal } from '../hooks/useReveal.js';
import { img } from '../utils/img.js';
import './Landing.css';

// The 8 steps shown both here (compact) and on /how-it-works (detailed).
const STEPS = [
  'Create a case',
  'Explain both perspectives',
  'Add evidence',
  'Review claims & missing information',
  'Request an AI-assisted assessment',
  'Invite reviewers (optional)',
  'Review feedback',
  'Update or appeal',
];

const FAQ = [
  {
    q: 'What is Human Court?',
    a: 'Human Court is a structured way to work through a disagreement. You describe the situation from both sides, add evidence, and — if you want — request an AI-assisted assessment that reviews the claims and reasoning fairly. It is a thinking tool, not a real court.',
  },
  {
    q: 'Is this legal advice?',
    a: 'No. Human Court is not a court of law and nothing here is legal advice. AI assessments are not verdicts. For real legal disputes, talk to a qualified professional.',
  },
  {
    q: 'Is the AI always right?',
    a: 'No. The AI can be incomplete, mistaken, or biased, and it never claims to detect lies. Its assessment is a second opinion on the reasoning — you decide what to do with it.',
  },
  {
    q: 'Are my cases public?',
    a: 'No — cases are private by default. Nothing is shared unless you explicitly choose to share it, and sharing is reversible.',
  },
  {
    q: 'Do both sides need to participate?',
    a: 'No. You can describe both perspectives yourself, which is often the fastest way to get unstuck. Inviting the other person — or neutral reviewers — is optional.',
  },
  {
    q: 'Can I delete my data?',
    a: 'Yes. You can edit drafts and delete a case at any time with a confirmation step. In this demo, data is stored locally in your browser.',
  },
];

// The three principles, each with a cinematic image.
const PRINCIPLES = [
  {
    img: img('images/hear-both-sides.jpg'),
    alt: 'Two people facing each other in balanced dialogue, golden light between them',
    title: 'Hear both sides',
    text: 'Every case starts with both perspectives written down — yours and theirs — so neither side gets lost in the heat of the moment.',
  },
  {
    img: img('images/question-assumptions.jpg'),
    alt: 'A magnifying glass examining documents on a dark desk',
    title: 'Question assumptions',
    text: 'Human Court pushes you to separate what you know from what you\u2019re assuming, and to ask what information is missing.',
  },
  {
    img: img('images/find-perspective.jpg'),
    alt: 'Golden scales of justice perfectly balanced in dramatic light',
    title: 'Find perspective',
    text: 'When you can see the full picture laid out fairly, better decisions — and calmer conversations — follow naturally.',
  },
];

// Scroll-reveal wrapper for landing sections.
function Reveal({ children, className = '', delay = 0 }) {
  const ref = useReveal();
  return (
    <div
      ref={ref}
      className={`reveal-on-scroll ${className}`}
      style={{ '--reveal-delay': `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function PrincipleCards() {  const ref = useReveal();
  return (
    <div ref={ref} className="landing-grid-3 reveal-on-scroll">
      {PRINCIPLES.map((p, i) => (
        <article
          key={p.title}
          className="principle-card"
          style={{ '--reveal-delay': `${i * 100}ms` }}
        >
          <div className="principle-card-img">
            <img src={p.img} alt={p.alt} loading="lazy" />
          </div>
          <div className="principle-card-body">
            <h3>{p.title}</h3>
            <p>{p.text}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

function SampleTabs() {
  const tabs = ['The situation', 'Person A', 'Person B', 'Sample assessment'];
  const [active, setActive] = useState(0);

  // Tolerate whichever shape the data file uses.
  const personA = sampleCase.personA || sampleCase.parties?.[0] || {};
  const personB = sampleCase.personB || sampleCase.parties?.[1] || {};
  const excerpt = (text, n = 320) =>
    typeof text === 'string' && text.length > n ? `${text.slice(0, n).trim()}…` : text;

  return (
    <div className="landing-tabs">
      <div role="tablist" aria-label="Sample case demonstration" className="landing-tablist">
        {tabs.map((label, i) => (
          <button
            key={label}
            type="button"
            role="tab"
            id={`demo-tab-${i}`}
            aria-selected={active === i}
            aria-controls={`demo-panel-${i}`}
            tabIndex={active === i ? 0 : -1}
            className={`landing-tab${active === i ? ' is-active' : ''}`}
            onClick={() => setActive(i)}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id="demo-panel-0"
        aria-labelledby="demo-tab-0"
        hidden={active !== 0}
        className="landing-panel"
      >
        <h3>The situation</h3>
        <p>{excerpt(sampleCase.situation)}</p>
      </div>
      <div
        role="tabpanel"
        id="demo-panel-1"
        aria-labelledby="demo-tab-1"
        hidden={active !== 1}
        className="landing-panel"
      >
        <h3>{personA.name || 'Person A'}</h3>
        <p>{excerpt(personA.statement)}</p>
      </div>
      <div
        role="tabpanel"
        id="demo-panel-2"
        aria-labelledby="demo-tab-2"
        hidden={active !== 2}
        className="landing-panel"
      >
        <h3>{personB.name || 'Person B'}</h3>
        <p>{excerpt(personB.statement)}</p>
      </div>
      <div
        role="tabpanel"
        id="demo-panel-3"
        aria-labelledby="demo-tab-3"
        hidden={active !== 3}
        className="landing-panel"
      >
        <span className="demo-label">Sample demonstration</span>
        <h3>{sampleCase.assessment?.outcomeLabel || 'Sample assessment'}</h3>
        <p>{excerpt(sampleCase.assessment?.overall)}</p>
        <p className="landing-sample-note">
          Sample demonstration — not real AI analysis.
        </p>
      </div>
    </div>
  );
}

function FaqAccordion() {
  const [open, setOpen] = useState(null);
  return (
    <div className="landing-faq">
      {FAQ.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q} className="landing-faq-item">
            <h3>
              <button
                type="button"
                className="landing-faq-trigger"
                aria-expanded={isOpen}
                aria-controls={`landing-faq-panel-${i}`}
                onClick={() => setOpen(isOpen ? null : i)}
              >
                {item.q}
                <span aria-hidden="true" className="landing-faq-chev">
                  {isOpen ? '−' : '+'}
                </span>
              </button>
            </h3>
            <div
              id={`landing-faq-panel-${i}`}
              role="region"
              hidden={!isOpen}
              className="landing-faq-panel"
            >
              <p>{item.a}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Landing() {
  useEffect(() => {
    document.title = 'Fair hearing for every argument — Human Court';
  }, []);

  return (
    <>
      {/* Hero */}
      <section className="landing-hero">
        <div className="container landing-hero-inner">
          <div className="landing-hero-copy">
            <h1 className="reveal" style={{ '--reveal-delay': '0ms' }}>
              Every argument deserves a fair hearing.
            </h1>
            <p className="reveal" style={{ '--reveal-delay': '120ms' }}>
              Human Court helps you untangle everyday disagreements — with a roommate, a
              colleague, a partner — by hearing both sides, checking the evidence, and
              reasoning about it calmly and fairly.
            </p>
            <div className="landing-hero-ctas reveal" style={{ '--reveal-delay': '240ms' }}>
              <Link className="btn btn-primary btn-lg" to="/cases/new">
                Bring Your Case
              </Link>
              <Link className="btn btn-secondary btn-lg" to="/example">
                Explore an Example
              </Link>
            </div>
          </div>
          <figure className="landing-hero-visual reveal" style={{ '--reveal-delay': '160ms' }}>
            <img
              src={img('images/hero-discussion.jpg')}
              alt="Two people in calm, respectful discussion across a table in warm golden light"
              className="landing-hero-img"
            />
            <figcaption className="landing-hero-caption">
              Two sides. One fair hearing.
            </figcaption>
          </figure>
        </div>
      </section>

      {/* Principles */}
      <section className="landing-section">
        <div className="container">
          <h2>Three principles</h2>
          <PrincipleCards />
        </div>
      </section>

      {/* Interactive illustrative example */}
      <section className="landing-section landing-demo">
        <div className="container">
          <Reveal>
            <span className="demo-label">Sample demonstration</span>
            <h2>See how a case takes shape</h2>
            <p className="landing-lead">
              A sample case, shown step by step — from the situation to a sample assessment.
            </p>
            <SampleTabs />
          </Reveal>
        </div>
      </section>

      {/* How it works */}
      <section className="landing-section">
        <div className="container">
          <Reveal>
            <h2>How it works</h2>
            <ol className="landing-steps landing-steps-animated">
              {STEPS.map((step, i) => (
                <li
                  key={step}
                  style={{ '--reveal-delay': `${i * 70}ms` }}
                >
                  <span className="landing-step-num" aria-hidden="true">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <Link className="btn btn-secondary" to="/how-it-works">
              Learn more
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Benefits */}
      <section className="landing-section">
        <div className="container">
          <Reveal>
            <h2>Why people bring their cases here</h2>
            <div className="landing-grid-4">
              <Card title="Clearer thinking">
                Writing both sides down forces your thoughts into order — and order reveals
                what actually matters.
              </Card>
              <Card title="Calmer conversations">
                A shared, structured case gives you something neutral to point at instead
                of each other.
              </Card>
              <Card title="Fairer outcomes">
                When claims are weighed against evidence instead of volume, resolutions
                feel fair to everyone involved.
              </Card>
              <Card title="Private by default">
                Your disagreements are yours. Cases stay private unless you explicitly
                choose to share them.
              </Card>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Responsible AI */}
      <section className="landing-section">
        <div className="container">
          <Reveal>
            <h2>Responsible AI</h2>
            <ul className="landing-list">
              <li>AI assistance can be incomplete, mistaken, or biased — it is a second opinion, not a verdict.</li>
              <li>It never claims to detect lies or read anyone's intentions.</li>
              <li>It clearly distinguishes claims from evidence, and marks what is unknown or missing.</li>
              <li>Uncertainty is stated plainly — never hidden behind confident wording.</li>
            </ul>
            <Alert variant="warning" title="Important">
              Human Court is not a court of law. Nothing here is legal advice, and AI
              assessments are not verdicts.
            </Alert>
          </Reveal>
        </div>
      </section>

      {/* Privacy & safety */}
      <section className="landing-section">
        <div className="container">
          <Reveal>
            <h2>Privacy &amp; safety</h2>
            <div className="landing-grid-3">
              <Card title="Private by default">
                Cases are visible only to you unless you explicitly share them.
              </Card>
              <Card title="You control sharing">
                Sharing is always your choice, and you can reverse it.
              </Card>
              <Card title="Delete anytime">
                You can delete a case whenever you like — with a confirmation step.
              </Card>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section className="landing-section">
        <div className="container">
          <Reveal>
            <h2>Questions, answered</h2>
            <FaqAccordion />
            <Link className="btn btn-secondary" to="/faq">
              View all FAQs
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Final CTA */}
      <section className="landing-cta">
        <div className="container">
          <Reveal className="landing-cta-inner">
            <h2>Ready for a fair hearing?</h2>
            <p>Put the disagreement down in writing and see it clearly — both sides.</p>
            <Link className="btn btn-primary btn-lg landing-cta-btn" to="/cases/new">
              Bring Your Case
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  );
}
