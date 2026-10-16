// useLocalStorage(key, initialValue)
// A useState hook that persists its value to localStorage as JSON.
import { useState } from 'react';

export default function useLocalStorage(key, initialValue) {
  // Lazy init: read localStorage only once, on first render.
  const [value, setValue] = useState(() => {
    if (typeof localStorage === 'undefined') return initialValue;
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : initialValue;
    } catch {
      // Corrupt or unreadable storage — fall back to the initial value.
      return initialValue;
    }
  });

  // Setter that also writes to localStorage.
  const setStoredValue = (next) => {
    setValue((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      try {
        localStorage.setItem(key, JSON.stringify(resolved));
      } catch {
        // Storage full or unavailable — keep the in-memory value.
      }
      return resolved;
    });
  };

  return [value, setStoredValue];
}
