import { useEffect, useState } from 'react';
import './Faq.css';

const QA = [
  {
    q: 'How do cases work?',
    a: 'A case is your private workspace for a disagreement. You name the situation, write out both perspectives, add evidence, and review the claims and missing information. When you\u2019re ready, you can request an AI-assisted assessment — a structured second opinion on the reasoning, not a verdict.',
  },
  {
    q: 'Is the AI always correct?',
    a: 'No. The AI can be incomplete, mistaken, or biased, and it only knows what was entered into the case. It never claims to detect lies or read intentions, and it states its uncertainty plainly. Treat every assessment as one perspective to consider, not the final word.',
  },
  {
    q: 'What evidence can I upload?',
    a: 'You can upload JPG, PNG, WebP, PDF, and TXT files, up to 10MB each. In this demo, only the file metadata is stored locally in your browser — the full file contents are not kept.',
  },
  {
    q: 'Are cases public or private?',
    a: 'Private by default. Only you can see your cases unless you explicitly choose to share them — and sharing is reversible, so you can take a case back to private at any time.',
  },
  {
    q: 'How do human reviewers participate?',
    a: 'Inviting trusted reviewers to look at a case and share their perspective is a planned feature (Phase 7). Reviewers will see the same structured case — perspectives, claims, and evidence — so feedback stays about the issue, not the drama.',
  },
  {
    q: 'Can I edit or delete a case?',
    a: 'Yes. Drafts are editable at any time, and you can delete a case whenever you like. Deletion asks for confirmation first so it never happens by accident.',
  },
  {
    q: 'How do reports and appeals work?',
    a: 'If you disagree with an AI assessment, you can appeal it — the assessment is reconsidered with your reasoning attached. Appeals need an existing assessment to appeal against. Reporting and content moderation are planned features.',
  },
  {
    q: 'Does Human Court provide legal advice?',
    a: 'No. Human Court is not a court of law and nothing here is legal advice. AI assessments are not verdicts. For real legal disputes, talk to a qualified professional.',
  },
  {
    q: 'How is my data handled?',
    a: 'In this demo, your data is stored locally in your browser using localStorage — nothing is sent to a server. Export and full deletion controls are available in Settings, so your data is always yours to take or remove.',
  },
  {
    q: 'Do both sides need to participate?',
    a: 'No. You can describe both perspectives yourself, which is often the fastest way to get unstuck. Inviting the other person — or neutral reviewers — is optional and planned for a later phase.',
  },
];

export default function Faq() {
  useEffect(() => {
    document.title = 'FAQ — Human Court';
  }, []);

  const [open, setOpen] = useState(null);

  return (
    <>
      <section className="faq-hero">
        <div className="container">
          <h1>Frequently asked questions</h1>
          <p className="faq-lead">
            The honest answers — including what Human Court can\u2019t do.
          </p>
        </div>
      </section>

      <section className="faq-body">
        <div className="container">
          <div className="faq-list">
            {QA.map((item, i) => {
              const isOpen = open === i;
              return (
                <div key={item.q} className="faq-item">
                  <h3>
                    <button
                      type="button"
                      className="faq-trigger"
                      aria-expanded={isOpen}
                      aria-controls={`faq-panel-${i}`}
                      onClick={() => setOpen(isOpen ? null : i)}
                    >
                      {item.q}
                      <span aria-hidden="true" className="faq-chev">
                        {isOpen ? '−' : '+'}
                      </span>
                    </button>
                  </h3>
                  <div
                    id={`faq-panel-${i}`}
                    role="region"
                    aria-hidden={!isOpen}
                    className={`faq-panel accordion-panel${
                      isOpen ? ' is-open' : ''
                    }`}
                  >
                    <div className="accordion-panel-inner">
                      <p>{item.a}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
