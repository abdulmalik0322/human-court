// Case status state machine — ported from the frontend
// (src/utils/caseWorkflow.js). This is the server-side source of truth:
// every status change goes through canTransition() and invalid moves
// are rejected with 409.

export const STATUSES = [
  { value: 'draft', label: 'Draft', description: 'Being written. Only you can see it.' },
  { value: 'submitted', label: 'Submitted', description: 'Sent for the next step of the process.' },
  { value: 'awaiting-evidence', label: 'Awaiting evidence', description: 'Waiting for supporting material to be added.' },
  { value: 'ready-for-analysis', label: 'Ready for analysis', description: 'Complete and ready to be assessed.' },
  { value: 'analysis-in-progress', label: 'Analysis in progress', description: 'An assessment is being prepared.' },
  { value: 'assessment-available', label: 'Assessment available', description: 'An assessment can be reviewed.' },
  { value: 'awaiting-human-review', label: 'Awaiting human review', description: 'Invited reviewers have been asked for opinions.' },
  { value: 'review-completed', label: 'Review completed', description: 'Human reviewers have shared their opinions.' },
  { value: 'appealed', label: 'Appealed', description: 'The owner asked for a reassessment.' },
  { value: 'archived', label: 'Archived', description: 'Closed and stored. No further changes.' },
];

// Allowed next statuses for each status.
export const TRANSITIONS = {
  draft: ['submitted', 'archived'],
  submitted: ['awaiting-evidence', 'archived'],
  'awaiting-evidence': ['ready-for-analysis', 'archived'],
  'ready-for-analysis': ['analysis-in-progress', 'archived'],
  'analysis-in-progress': ['assessment-available', 'archived'],
  'assessment-available': ['awaiting-human-review', 'appealed', 'archived'],
  'awaiting-human-review': ['review-completed', 'archived'],
  'review-completed': ['archived'],
  appealed: ['ready-for-analysis', 'archived'],
  archived: [],
};

export function statusLabel(v) {
  const s = STATUSES.find((s) => s.value === v);
  return s ? s.label : v;
}

export function isValidStatus(v) {
  return STATUSES.some((s) => s.value === v);
}

export function canTransition(from, to) {
  if (!isValidStatus(from) || !isValidStatus(to)) return false;
  return (TRANSITIONS[from] || []).includes(to);
}

export function nextStatuses(s) {
  return TRANSITIONS[s] || [];
}
