// LLM assessment provider (engine: 'llm'). OpenAI-compatible
// POST {AI_BASE_URL}/chat/completions. Active only when AI_API_KEY is set.
// Prompts and keys are NEVER logged.
import { IRON_RULES, OUTCOME_CATEGORIES } from '../../utils/constants.js';
import { validateAssessmentSections, ASSESSMENT_SECTIONS } from './schema.js';

const TIMEOUT_MS = 90_000;
const CHAT_TIMEOUT_MS = 45_000;

function systemPrompt() {
  return [
    'You are an impartial dispute-analysis assistant for "Human Court", a tool that helps two people understand a disagreement.',
    'IRON RULES — you must obey all of them:',
    ...IRON_RULES.map((r, i) => `${i + 1}. ${r}`),
    '',
    'Analyze the case and return ONLY valid JSON (no markdown, no commentary) with exactly these fields:',
    ...ASSESSMENT_SECTIONS.map((s) => `- ${s}`),
    '- outcomeCategory: one of ' + OUTCOME_CATEGORIES.join(', '),
    'Array sections hold objects shaped {text: string, ...optional extra fields}; neutralSummary, overallAssessment and decision are strings.',
    'decision is a plain-language recommendation: state who the provided material favors (or that no fair recommendation is possible), the 1-2 key supporting points, and what could change it. It is a recommendation from the material, not a finding of truth and not legal advice.',
    'supportedByEvidence items must reference the provided evidence descriptions; claims with no 2+ content-word overlap go in unverifiedClaims.',
    'missingInformation lists which of these are absent: dates/times, location, amounts, witnesses, prior condition, written agreement.',
  ].join('\n');
}

function userPrompt(caseObj, evidenceList) {
  const personA = caseObj.personA || {};
  const personB = caseObj.personB || {};
  const lines = [
    `Title: ${caseObj.title || ''}`,
    `Category: ${caseObj.category || ''}`,
    `Summary: ${caseObj.summary || ''}`,
    `Situation: ${caseObj.situation || ''}`,
    `Desired outcome: ${caseObj.desiredOutcome || ''}`,
    '',
    `Person A (${personA.name || 'Person A'}) statement:`,
    personA.statement || '',
    `Person A listed claims: ${(personA.claims || []).join(' | ')}`,
    '',
    `Person B (${personB.name || 'Person B'}) statement:`,
    personB.statement || '',
    `Person B listed claims: ${(personB.claims || []).join(' | ')}`,
    '',
    'Evidence descriptions (do NOT assume the files are authentic):',
    ...(evidenceList.length === 0
      ? ['(none uploaded)']
      : evidenceList.map((e) => `- ${e.originalName || 'file'}: ${e.description || '(no description)'}`)),
  ];
  return lines.join('\n');
}

function extractJson(text) {
  const trimmed = String(text).trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error('LLM response was not valid JSON');
  }
}

async function callLlm({ config, system, user, isRetry }) {  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${config.aiBaseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.aiApiKey}`,
      },
      body: JSON.stringify({
        model: config.aiModel,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system + (isRetry ? '\nYour previous reply was not valid. Reply with ONLY the JSON object.' : '') },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) {
      const err = new Error(`LLM request failed with status ${res.status}`);
      err.upstreamStatus = res.status;
      throw err;
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('LLM returned an empty response');
    return extractJson(content);
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('LLM request timed out');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function assessWithLlm({ caseObj, evidenceList, config }) {
  const system = systemPrompt();
  const user = userPrompt(caseObj, evidenceList);
  let lastError = null;
  // One attempt + ONE retry on invalid JSON/schema.
  for (const attempt of [0, 1]) {
    try {
      const parsed = await callLlm({ config, system, user, isRetry: attempt === 1 });
      // The LLM provides the analysis sections; the server stamps
      // engine/model/createdAt itself (the model must not invent them).
      const { valid, errors } = validateAssessmentSections(parsed);
      if (!valid) throw new Error(`LLM output failed schema validation: ${errors.join('; ')}`);
      return {
        ...parsed,
        engine: 'llm',
        model: config.aiModel,
        createdAt: new Date().toISOString(),
      };
    } catch (err) {
      lastError = err;
      const retryable = /json|schema|empty response/i.test(err.message);
      if (attempt === 0 && retryable) continue;
      throw err;
    }
  }
  throw lastError;
}

// Plain-text chat completion for the AI assistant (no JSON schema).
// `messages` is an array of {role: 'user'|'assistant', content: string}.
// Returns the assistant's reply text.
export async function chatWithLlm({ system, messages, config, maxTokens = 800 }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);
  try {
    const res = await fetch(`${config.aiBaseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.aiApiKey}`,
      },
      body: JSON.stringify({
        model: config.aiModel,
        temperature: 0.7,
        max_tokens: maxTokens,
        messages: [{ role: 'system', content: system }, ...messages],
      }),
    });
    if (!res.ok) {
      const err = new Error(`LLM request failed with status ${res.status}`);
      err.upstreamStatus = res.status;
      throw err;
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content || !String(content).trim()) throw new Error('LLM returned an empty response');
    return String(content).trim();
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('LLM request timed out');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
