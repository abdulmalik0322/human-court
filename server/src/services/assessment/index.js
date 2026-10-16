// Engine selection: LLM when AI_API_KEY is set, otherwise the
// built-in local heuristic engine (zero-config, honest about limits).
import { analyzeLocal } from './localEngine.js';
import { assessWithLlm } from './llmProvider.js';

export function aiMode(config) {
  return config.aiApiKey ? 'llm' : 'local-heuristic';
}

export async function generateAssessment(caseObj, evidenceList, config) {
  if (config.aiApiKey) {
    return assessWithLlm({ caseObj, evidenceList, config });
  }
  return analyzeLocal(caseObj, evidenceList || []);
}
