// @vitest-environment jsdom
// REGRESSION test for the "[object Object]" bug found during live Chrome QA:
// assessment list items are objects shaped { text, ... } (schema.js), but
// SectionBlock rendered them with String(item), printing "[object Object]"
// for every claim, disagreement, and evidence cross-reference.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AssessmentItem } from '../components/ui/AssessmentItem.jsx';

afterEach(cleanup);

describe('AssessmentItem', () => {
  it('never prints [object Object] for structured engine items', () => {
    const { container } = render(
      <ul>
        <li>
          <AssessmentItem
            item={{ text: 'The screen was undamaged.', source: 'user-listed', side: 'A' }}
          />
        </li>
        <li>
          <AssessmentItem
            item={{
              text: 'Both sides talk about "screen" but describe it differently.',
              topic: 'screen',
              aSays: 'It was perfect.',
              bSays: 'It had a crack.',
            }}
          />
        </li>
        <li>
          <AssessmentItem
            item={{
              text: 'No uploaded evidence description shares supporting details with this claim.',
              claim: 'It slipped off the table.',
              side: 'A',
              note: 'Stated without supporting material in the descriptions provided.',
            }}
          />
        </li>
        <li>
          <AssessmentItem item="A plain string claim" />
        </li>
      </ul>
    );
    expect(container.textContent).not.toContain('[object Object]');
    expect(screen.getByText('The screen was undamaged.')).toBeTruthy();
    expect(screen.getByText(/A says:/)).toBeTruthy();
    expect(screen.getByText(/B says:/)).toBeTruthy();
    expect(screen.getByText(/Claim:/)).toBeTruthy();
    expect(screen.getByText('A plain string claim')).toBeTruthy();
  });

  it('renders nothing for empty/null items', () => {
    const { container } = render(
      <ul>
        <li><AssessmentItem item={null} /></li>
        <li><AssessmentItem item={{}} /></li>
      </ul>
    );
    expect(container.textContent.trim()).toBe('');
  });
});
