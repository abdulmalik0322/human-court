// useReveal — IntersectionObserver scroll-reveal hook.
//
// Usage:
//   import { useReveal } from '../hooks/useReveal';
//   const revealRef = useReveal();
//   <div ref={revealRef} className="reveal-on-scroll" style={{ '--reveal-delay': '80ms' }}>
//
// When the element first enters the viewport, 'is-visible' is added to it and
// the CSS transition in motion.css fades/slides it in. The class is added
// once (the observer unobserves after the first hit), so it never flickers
// on re-scroll. Options:
//   useReveal({ threshold: 0.2, rootMargin: '0px 0px -40px 0px' })
// Fallback: if IntersectionObserver is unavailable, 'is-visible' is added
// immediately so content is never stuck hidden.
//
// Implemented as a callback ref (not useEffect + useRef) so observation
// attaches whenever the element actually mounts — including when it appears
// later due to async data loading or conditional rendering. A plain
// useEffect with [] deps would run before a conditionally-rendered element
// exists and never observe it, leaving content permanently invisible.
import { useCallback, useEffect, useRef } from 'react';

export function useReveal(options = {}) {
  const observerRef = useRef(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const setRef = useCallback((el) => {
    // Tear down any previous observation (unmount / ref change).
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (!el) return;

    // No IntersectionObserver (old browser / test env): show immediately.
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('is-visible');
      return;
    }

    const { threshold = 0.1, rootMargin = '0px' } = optionsRef.current;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold, rootMargin }
    );

    observer.observe(el);
    observerRef.current = observer;
  }, []);

  // Safety net on unmount.
  useEffect(() => () => observerRef.current?.disconnect(), []);

  return setRef;
}
