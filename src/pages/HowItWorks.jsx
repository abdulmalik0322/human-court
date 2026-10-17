import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useReveal } from '../hooks/useReveal.js';
import { img } from '../utils/img.js';
import {
  FilePlus2,
  MessagesSquare,
  Paperclip,
  SearchCheck,
  Sparkles,
  Users,
  ClipboardCheck,
  RefreshCw,
} from 'lucide-react';
import Card from '../components/ui/Card.jsx';
import Alert from '../components/ui/Alert.jsx';
import './HowItWorks.css';

const STEPS = [
  {
    icon: FilePlus2,
    title: 'Create a case',
    text: 'Give your disagreement a name and a short summary. A case is a private workspace where the whole argument can be laid out — no audience, no pressure, just the facts as you see them.',
  },
  {
    icon: MessagesSquare,
    title: 'Explain both perspectives',
    text: 'Write out Person A\u2019s side and Person B\u2019s side in their own words. This is the heart of Human Court: hearing both sides before deciding anything. You can describe the other side yourself, or invite them to speak for themselves.',
  },
  {
    icon: Paperclip,
    title: 'Add evidence',
    text: 'Attach what supports each side — messages, documents, photos, notes. Evidence is kept separate from opinions, so it\u2019s always clear what\u2019s claimed and what\u2019s shown.',
  },
  {
    icon: SearchCheck,
    title: 'Review claims & missing information',
    text: 'Human Court walks you through each claim: what supports it, what contradicts it, and what information is simply missing. Gaps are marked plainly instead of being quietly filled in.',
  },
  {
    icon: Sparkles,
    title: 'Request an AI-assisted assessment',
    text: 'When you\u2019re ready, you can ask for an AI-assisted assessment. It reviews the perspectives, claims, and evidence, weighs the reasoning, and states its uncertainty openly. It is a structured second opinion — never a verdict.',
  },
  {
    icon: Users,
    title: 'Invite reviewers (optional)',
    text: 'You can invite trusted people to review the case and share their perspective. Reviewers see the same structured case you do — perspectives, claims, and evidence — so feedback stays about the issue, not the drama.',
  },
  {
    icon: ClipboardCheck,
    title: 'Review feedback',
    text: 'Read the AI assessment and any reviewer feedback side by side. Look for where they agree, where they differ, and what new questions they raise. The goal is understanding, not winning.',
  },
  {
    icon: RefreshCw,
    title: 'Update or appeal',
    text: 'Cases aren\u2019t frozen. You can add new evidence, update perspectives, and request a fresh assessment as the situation changes. If you disagree with an assessment, an appeal asks for it to be reconsidered with your reasoning attached.',
  },
];

const CANNOT_DO = [
  'It cannot detect lies, read intentions, or know what happened outside the case file.',
  'It can be incomplete, mistaken, or biased — its reasoning is only as good as what was entered.',
  'It does not provide legal advice and its assessments are not verdicts.',
  'It will not flatter one side to keep the peace — fairness means being honest with both.',
];

const CAN_DO = [
  'Separates claims from evidence and marks what is missing or unknown.',
  'Checks reasoning: which claims support each other, and which fall apart?',
  'Summarizes both perspectives so each side feels genuinely heard.',
  'States its uncertainty plainly instead of hiding behind confident wording.',
];

// Scroll-reveal wrapper.
function Reveal({ children, className = '' }) {
  const ref = useReveal();
  return (
    <div ref={ref} className={`reveal-on-scroll ${className}`}>
      {children}
    </div>
  );
}

export default function HowItWorks() {
  useEffect(() => {
    document.title = 'How it works — Human Court';
  }, []);

  return (
    <>
      <section className="how-hero">
        <div className="container how-hero-inner">
          <div>
            <h1>How Human Court works</h1>
            <p className="how-lead">
              Eight steps from a heated disagreement to a clear, fair picture — in your own
              private workspace, at your own pace.
            </p>
          </div>
          <figure className="page-hero-visual">
            <img
              src={img('images/how-hero.jpg')}
              alt="A person thoughtfully working through a case with documents at a desk in warm light"
              className="page-hero-img"
            />
          </figure>
        </div>
      </section>

      <section className="how-steps">
        <div className="container">
          <Reveal>
            <ol className="how-step-list">
              {STEPS.map((step, i) => {
                const Icon = step.icon;
                return (
                  <li key={step.title}>
                    <Card
                      title={step.title}
                      icon={<Icon size={22} aria-hidden="true" />}
                    >
                      <span className="how-step-num" aria-hidden="true">
                        {i + 1}
                      </span>
                      <p>{step.text}</p>
                    </Card>
                  </li>
                );
              })}
            </ol>
          </Reveal>
        </div>
      </section>

      <section className="how-ai">
        <div className="container">
          <Reveal>
            <span className="demo-label">Sample demonstration</span>
            <h2>What AI can and cannot do</h2>
            <div className="how-ai-grid">
              <Card title="What the AI assessment can do">
                <ul className="how-list">
                  {CAN_DO.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </Card>
              <Card title="What it cannot do">
                <ul className="how-list">
                  {CANNOT_DO.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </Card>
            </div>
            <Alert variant="warning" title="Important">
              Human Court is not a court of law. Nothing here is legal advice, and AI
              assessments are not verdicts.
            </Alert>
          </Reveal>
        </div>
      </section>

      <section className="how-data">
        <div className="container">
          <Reveal>
            <h2>What happens to your data</h2>
            <ul className="how-list">
              <li>Cases are private by default — only you can see them unless you explicitly share them.</li>
              <li>Sharing is always your choice, and it is reversible.</li>
              <li>You can edit drafts and delete a case at any time with a confirmation step.</li>
              <li>In this demo, your data is stored locally in your browser (localStorage) — nothing is sent anywhere.</li>
              <li>Export and full deletion controls live in Settings.</li>
            </ul>
          </Reveal>
        </div>
      </section>

      <section className="how-cta">
        <div className="container">
          <h2>Start your first case</h2>
          <p>It takes a few minutes — and your disagreement stays private.</p>
          <Link className="btn btn-primary btn-lg" to="/cases/new">
            Bring Your Case
          </Link>
        </div>
      </section>
    </>
  );
}
