// Assessment output schema. Both engines (local heuristic and LLM)
// must produce records that validate here before they are saved.
import { OUTCOME_CATEGORIES } from '../../utils/constants.js';

export const ASSESSMENT_SECTIONS = [
  'neutralSummary',
  'personAClaims',
  'personBClaims',
  'areasOfAgreement',
  'pointsOfDisagreement',
  'supportedByEvidence',
  'unverifiedClaims',
  'missingInformation',
  'alternativeExplanations',
  'reasoning',
  'clarifyingQuestions',
  'nextSteps',
  'limitations',
  'overallAssessment',
  'decision',
];

const STRING_SECTIONS = new Set(['neutralSummary', 'overallAssessment', 'decision']);
const ENGINE_VALUES = ['local-heuristic', 'llm'];

function isSectionItem(item) {
  if (typeof item === 'string') return item.length > 0;
  return (
    item !== null &&
    typeof item === 'object' &&
    !Array.isArray(item) &&
    typeof item.text === 'string' &&
    item.text.length > 0
  );
}

export function validateAssessment(a) {
  const errors = [];
  if (!a || typeof a !== 'object' || Array.isArray(a)) {
    return { valid: false, errors: ['assessment must be an object'] };
  }
  errors.push(...validateAssessmentSections(a).errors);
  if (!ENGINE_VALUES.includes(a.engine)) {
    errors.push(`engine must be one of: ${ENGINE_VALUES.join(', ')}`);
  }
  if (typeof a.model !== 'string' || a.model.trim().length === 0) {
    errors.push('model must be a non-empty string');
  }
  if (typeof a.createdAt !== 'string' || Number.isNaN(Date.parse(a.createdAt))) {
    errors.push('createdAt must be an ISO date string');
  }
  return { valid: errors.length === 0, errors };
}

// Validates what an engine (human or LLM) produces before the server
// stamps engine/model/createdAt on it: the 15 sections + outcomeCategory.
export function validateAssessmentSections(a) {
  const errors = [];
  if (!a || typeof a !== 'object' || Array.isArray(a)) {
    return { valid: false, errors: ['assessment must be an object'] };
  }
  for (const section of ASSESSMENT_SECTIONS) {
    const value = a[section];
    if (STRING_SECTIONS.has(section)) {
      if (typeof value !== 'string' || value.trim().length === 0) {
        errors.push(`section '${section}' must be a non-empty string`);
      }
    } else if (!Array.isArray(value)) {
      errors.push(`section '${section}' must be an array`);
    } else {
      const bad = value.findIndex((item) => !isSectionItem(item));
      if (bad !== -1) errors.push(`section '${section}' item ${bad} must be a non-empty string or {text, ...}`);
    }
  }
  if (!OUTCOME_CATEGORIES.includes(a.outcomeCategory)) {
    errors.push(`outcomeCategory must be one of: ${OUTCOME_CATEGORIES.join(', ')}`);
  }
  return { valid: errors.length === 0, errors };
}
