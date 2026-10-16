// Tests for the case status state machine (src/utils/caseWorkflow.js).
import { describe, it, expect } from 'vitest';
import {
  canTransition,
  isValidStatus,
  nextStatuses,
  STATUSES,
  TRANSITIONS,
} from '../utils/caseWorkflow.js';

describe('case status workflow', () => {
  it('allows the full happy chain from draft to review-completed', () => {
    const chain = [
      'draft',
      'submitted',
      'awaiting-evidence',
      'ready-for-analysis',
      'analysis-in-progress',
      'assessment-available',
      'awaiting-human-review',
      'review-completed',
    ];
    for (let i = 0; i < chain.length - 1; i++) {
      expect(
        canTransition(chain[i], chain[i + 1]),
        `${chain[i]} -> ${chain[i + 1]} should be allowed`,
      ).toBe(true);
    }
  });

  it('allows appealed -> ready-for-analysis', () => {
    expect(canTransition('appealed', 'ready-for-analysis')).toBe(true);
  });

  it('rejects skipping steps (draft -> assessment-available)', () => {
    expect(canTransition('draft', 'assessment-available')).toBe(false);
  });

  it('rejects downgrades (submitted -> draft)', () => {
    expect(canTransition('submitted', 'draft')).toBe(false);
  });

  it('treats archived as terminal (no next statuses)', () => {
    expect(nextStatuses('archived')).toEqual([]);
    for (const s of STATUSES.map((s) => s.value)) {
      expect(canTransition('archived', s)).toBe(false);
    }
  });

  it('rejects unknown statuses', () => {
    expect(canTransition('draft', 'nope')).toBe(false);
    expect(canTransition('nope', 'draft')).toBe(false);
    expect(canTransition('nope', 'alsono')).toBe(false);
    expect(isValidStatus('nope')).toBe(false);
  });

  it('has 10 statuses with non-empty labels', () => {
    expect(STATUSES).toHaveLength(10);
    for (const s of STATUSES) {
      expect(typeof s.label).toBe('string');
      expect(s.label.length).toBeGreaterThan(0);
    }
  });

  it('only lists known statuses in TRANSITIONS', () => {
    const known = new Set(STATUSES.map((s) => s.value));
    for (const [from, tos] of Object.entries(TRANSITIONS)) {
      expect(known.has(from)).toBe(true);
      for (const to of tos) expect(known.has(to)).toBe(true);
    }
  });
});
