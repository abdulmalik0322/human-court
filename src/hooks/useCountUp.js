// useCountUp — animated integer counter.
//
// Usage:
//   import { useCountUp } from '../hooks/useCountUp';
//   const n = useCountUp(value);        // render {n}
//   const n = useCountUp(value, { duration: 1200 });
//
// Returns a number that eases out (cubic) from its current value to `target`
// over `duration` ms, re-animating whenever `target` changes. The returned
// value is always rounded to an integer. Under prefers-reduced-motion it
// returns `target` immediately with no animation.
import { useEffect, useRef, useState } from 'react';

function reducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function useCountUp(target, { duration = 900 } = {}) {
  const end = Number(target) || 0;

  const [value, setValue] = useState(() => (reducedMotion() ? end : 0));
  const fromRef = useRef(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (reducedMotion()) {
      setValue(end);
      fromRef.current = end;
      return;
    }

    const start = fromRef.current;
    if (start === end) {
      setValue(end);
      return;
    }

    const t0 = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      const current = Math.round(start + (end - start) * eased);
      fromRef.current = current;
      setValue(current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [end, duration]);

  return value;
}
