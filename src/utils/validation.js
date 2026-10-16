// Form validation helpers.
// Each rule returns an error string, or null when the value passes.

export const CHAR_LIMITS = {
  title: 120,
  summary: 300,
  situation: 8000,
  statement: 5000,
  claim: 400,
  desiredOutcome: 1000,
  displayName: 40,
  evidenceDescription: 300,
  name: 80,
  appealReason: 2000,
};

// True when the value is null/undefined/empty-or-whitespace string.
export function isBlank(v) {
  return v == null || String(v).trim() === '';
}

// Fails when the value is blank.
export function required(value, fieldName = 'This field') {
  return isBlank(value) ? `${fieldName} is required.` : null;
}

// Returns a rule: fails when the value is longer than the limit.
export function maxLength(limit, fieldName = 'This field') {
  return (value) =>
    value != null && String(value).length > limit
      ? `${fieldName} must be ${limit} characters or fewer (currently ${String(value).length}).`
      : null;
}

// Returns a rule: fails when the value is shorter than the limit (blank values pass).
export function minLength(limit, fieldName = 'This field') {
  return (value) =>
    isBlank(value) || String(value).length >= limit
      ? null
      : `${fieldName} must be at least ${limit} characters.`;
}

// Fails when the value is not a valid email address.
export function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
    ? null
    : 'Enter a valid email address.';
}

// Runs rules in order; returns the first error, or null if all pass.
export function runRules(value, rules) {
  for (const r of rules) {
    const e = r(value);
    if (e) return e;
  }
  return null;
}
