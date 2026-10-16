// Shared domain constants.

export const CATEGORIES = [
  'Friendship',
  'Family',
  'Relationships',
  'Roommates',
  'Money and shared expenses',
  'School and university',
  'Workplace disagreements',
  'Buying and selling',
  'Shared responsibilities',
  'Other',
];

export const OUTCOME_CATEGORIES = [
  'leans_a',
  'leans_b',
  'mixed',
  'insufficient_evidence',
  'expectations_not_facts',
];

export const REVIEW_OPINIONS = [...OUTCOME_CATEGORIES, 'no_clear_lean'];

export const PRIVACY_VALUES = ['private', 'invite-only', 'public'];
export const REVIEW_AUDIENCE_VALUES = ['invite-only', 'public'];

// Hard rules every assessment engine must obey.
export const IRON_RULES = [
  'Never invent evidence or quotations — only quote exact substrings from the user-provided text.',
  'Never claim to detect lies or determine who is telling the truth.',
  'Never claim to know what anyone intended — distinguish observation from inference.',
  'Never favor the first participant; treat both sides symmetrically.',
  'Never give a numeric probability of truthfulness.',
  'Use neutral, non-inflammatory language.',
  'This is not legal advice.',
];

export const AUTHENTICITY_NOTE = 'Authenticity of uploaded files cannot be independently verified.';
