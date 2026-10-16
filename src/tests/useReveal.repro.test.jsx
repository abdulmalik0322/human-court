// @vitest-environment jsdom
// REGRESSION test for the invisible-content bug found during live Chrome QA:
// `useReveal` used `useEffect(..., [])` + `useRef`, so when the revealed
// element mounted LATER (async data load / conditional render — exactly what
// CaseDetail does after fetching the case), the effect had already run with
// ref.current === null and the element was never observed, leaving the whole
// perspectives/evidence/assessment block permanently at opacity: 0.
// The hook is now a callback ref, so observation attaches on every mount.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { useState } from 'react';
import { useReveal } from '../hooks/useReveal.js';

// Minimal IntersectionObserver mock: records observed elements and lets the
// test drive intersection manually.
let observed = [];
let callbacks = [];
function installObserverMock() {
  observed = [];
  callbacks = [];
  const MockIO = vi.fn(function (cb) {
    callbacks.push(cb);
    return {
      observe: vi.fn((el) => observed.push(el)),
      unobserve: vi.fn((el) => {
        observed = observed.filter((e) => e !== el);
      }),
      disconnect: vi.fn(),
    };
  });
  vi.stubGlobal('IntersectionObserver', MockIO);
}
function intersect(el, isIntersecting = true) {
  act(() => {
    callbacks.forEach((cb) => cb([{ target: el, isIntersecting }]));
  });
}

function LateMount() {
  const revealRef = useReveal();
  const [ready, setReady] = useState(false);
  return (
    <div>
      <button onClick={() => setReady(true)}>load</button>
      {ready && (
        <div ref={revealRef} className="reveal-on-scroll" data-testid="late">
          content
        </div>
      )}
    </div>
  );
}

function ImmediateMount() {
  const revealRef = useReveal();
  return (
    <div ref={revealRef} className="reveal-on-scroll" data-testid="immediate">
      content
    </div>
  );
}

beforeEach(() => {
  installObserverMock();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('useReveal', () => {
  it('reveals an element mounted immediately', () => {
    render(<ImmediateMount />);
    const el = screen.getByTestId('immediate');
    expect(observed).toContain(el);
    expect(el.classList.contains('is-visible')).toBe(false);
    intersect(el);
    expect(el.classList.contains('is-visible')).toBe(true);
  });

  it('reveals an element that mounts LATER (async/conditional render)', () => {
    render(<LateMount />);
    // Nothing to observe yet.
    expect(observed).toHaveLength(0);
    // Simulate the async data load finishing.
    act(() => {
      screen.getByText('load').click();
    });
    const el = screen.getByTestId('late');
    // The bug: with useEffect([]) the element was never observed.
    expect(observed).toContain(el);
    intersect(el);
    expect(el.classList.contains('is-visible')).toBe(true);
  });

  it('shows content immediately when IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(<ImmediateMount />);
    const el = screen.getByTestId('immediate');
    expect(el.classList.contains('is-visible')).toBe(true);
  });
});
