import { useEffect } from 'react';
import Card from '../components/ui/Card.jsx';
import Alert from '../components/ui/Alert.jsx';
import { useReveal } from '../hooks/useReveal.js';
import './About.css';

// Note: this page deliberately names no founders, history, awards,
// partnerships, or user statistics — none exist to describe.

// Scroll-reveal wrapper.
function Reveal({ children }) {
  const ref = useReveal();
  return (
    <div ref={ref} className="reveal-on-scroll">
      {children}
    </div>
  );
}

export default function About() {
  useEffect(() => {
    document.title = 'About — Human Court';
  }, []);

  return (
    <>
      <section className="about-hero">
        <div className="container about-hero-inner">
          <div>
            <h1>About Human Court</h1>
            <p className="about-lead">
              A place where everyday disagreements get a fair hearing — built on the
              belief that most arguments go wrong long before anyone starts shouting.
            </p>
          </div>
          <figure className="page-hero-visual">
            <img
              src="/images/about-hero.jpg"
              alt="Two people shaking hands in agreement in warm golden light"
              className="page-hero-img"
            />
          </figure>
        </div>
      </section>

      <section className="about-section">
        <div className="container">
          <Reveal>
          <h2>Why it exists</h2>
          <p>
            Most disagreements aren't really about who's right. They're about being
            heard. Two people walk away from the same conversation with two completely
            different stories — and without a shared picture of what happened, every
            discussion becomes a fight about the past instead of a plan for the future.
          </p>
          <p>
            Human Court exists to bring fair reasoning to everyday disagreements: the
            roommate dispute, the family tension, the falling-out with a friend, the
            disagreement with a colleague. It gives the argument a structure — both
            perspectives, the claims, the evidence — so it can be looked at calmly
            instead of felt loudly.
          </p>
          </Reveal>
        </div>
      </section>

      <section className="about-section">
        <div className="container">
          <Reveal>
          <h2>Commitment to fair reasoning</h2>
          <div className="about-commitment">
            <figure className="page-hero-visual about-commitment-img">
              <img
                src="/images/about-values.jpg"
                alt="Golden scales perfectly balanced in warm light"
                className="page-hero-img"
              />
            </figure>
            <div className="about-grid">
              <Card title="Both sides, always">
                No case is heard with only one side on the record. Writing the other
                perspective down — even when it's uncomfortable — is the foundation of
                everything else here.
              </Card>
              <Card title="Claims vs. evidence">
                What's asserted and what's shown are two different things. Human Court
                keeps them visibly separate, so feelings and facts can't quietly trade
                places.
              </Card>
              <Card title="Honest uncertainty">
                Where information is missing, that's marked — not guessed. A fair hearing
                includes admitting what can't be known yet.
              </Card>
            </div>
          </div>
          </Reveal>
        </div>
      </section>

      <section className="about-section">
        <div className="container">
          <Reveal>
          <h2>Limitations</h2>
          <p>
            Honesty about what Human Court is not matters as much as what it is:
          </p>
          <ul className="about-list">
            <li>It is not a court of law, and nothing here is legal advice.</li>
            <li>AI assessments are structured second opinions — not verdicts, and not always correct.</li>
            <li>The AI cannot detect lies, read intentions, or know anything outside what was entered into the case.</li>
            <li>Serious disputes — legal, financial, or safety-related — belong with qualified professionals.</li>
          </ul>
          <Alert variant="warning" title="Important">
            Human Court is not a court of law. Nothing here is legal advice, and AI
            assessments are not verdicts.
          </Alert>
          </Reveal>
        </div>
      </section>

      <section className="about-section">
        <div className="container">
          <Reveal>
          <h2>Privacy approach</h2>
          <ul className="about-list">
            <li>Cases are private by default — only you can see them.</li>
            <li>Sharing is always explicit and reversible; nothing is shared by accident.</li>
            <li>You can edit drafts and delete a case at any time with a confirmation step.</li>
            <li>In this demo, data is stored locally in your browser — export and deletion controls live in Settings.</li>
          </ul>
          </Reveal>
        </div>
      </section>

      <section className="about-section">
        <div className="container">
          <Reveal>
          <h2>Responsible AI</h2>
          <ul className="about-list">
            <li>AI assistance can be incomplete, mistaken, or biased — it is a thinking aid, not an authority.</li>
            <li>It distinguishes claims from evidence and marks what is missing or unknown.</li>
            <li>It never claims to detect lies or judge anyone's character.</li>
            <li>Uncertainty is stated plainly — confident wording is never used to hide doubt.</li>
          </ul>
          </Reveal>
        </div>
      </section>

      <section className="about-section">
        <div className="container">
          <Reveal>
          <h2>Respectful disagreement</h2>
          <p>
            Disagreements are welcome here; disrespect is not. Cases and reviews must
            not include harassment, shaming, threats, or personal attacks. The point of
            a fair hearing is to lower the temperature — content that raises it has no
            place here.
          </p>
          <p>
            Write about the issue, not the person. "The payment was late" is a claim;
            "he's a liar" is an attack. Human Court is built for the first kind.
          </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}
