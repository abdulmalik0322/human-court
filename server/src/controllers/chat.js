// AI assistant chat: real LLM conversation about Human Court.
// Stateless per request — the client keeps the conversation history and
// sends recent turns with each message. Requires AI_API_KEY; without it
// the endpoint honestly reports unavailable (never fake replies).
import { HttpError } from '../middleware/errorHandler.js';
import { chatWithLlm } from '../services/assessment/llmProvider.js';

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_TURNS = 20;

const ASSISTANT_SYSTEM_PROMPT = [
  'You are the AI assistant for "Human Court", a platform where people can examine everyday disagreements fairly: hear both sides, question assumptions, and find perspective.',
  '',
  'How Human Court works (tell users when asked):',
  '- A user creates a case describing a disagreement, with Person A and Person B perspectives plus optional evidence.',
  '- They submit the case, then request an AI assessment, which reads both sides and produces a structured analysis with a recommendation.',
  '- They can invite trusted reviewers to share opinions, and share a public read-only link.',
  '- Reviews and assessments are opinions to help people think, not court rulings.',
  '',
  'Your role:',
  '- Answer questions about using Human Court and about resolving disagreements well.',
  '- Help users write clearer case statements and think about what evidence would help.',
  '- Be concise, warm, and practical.',
  '',
  'Hard rules:',
  '- Never provide legal advice. If asked, say you are not a lawyer and suggest consulting one for legal questions.',
  '- Never claim to know who is telling the truth in a specific real dispute, and never present yourself as a court.',
  '- Never invent facts about the user, their cases, or the platform.',
  '- If you do not know something, say so honestly.',
].join('\n');

function toApi(text) {
  return { reply: text, model: null };
}

export function createChatController(ctx) {
  const { config } = ctx;

  async function sendMessage(req, res) {
    if (!config.aiApiKey) {
      throw new HttpError(
        503,
        'ai_not_configured',
        'The AI assistant is not available right now. Please try again later.',
      );
    }
    const { message, history } = req.body || {};
    if (typeof message !== 'string' || message.trim().length === 0) {
      throw new HttpError(400, 'validation_error', 'message must be a non-empty string.');
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      throw new HttpError(400, 'validation_error', `message must be at most ${MAX_MESSAGE_LENGTH} characters.`);
    }
    const turns = Array.isArray(history) ? history.slice(-MAX_HISTORY_TURNS) : [];
    const messages = [];
    for (const t of turns) {
      if (!t || typeof t !== 'object') continue;
      if ((t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string' && t.content.trim()) {
        messages.push({ role: t.role, content: t.content.slice(0, MAX_MESSAGE_LENGTH) });
      }
    }
    messages.push({ role: 'user', content: message.trim() });

    let reply;
    try {
      reply = await chatWithLlm({ system: ASSISTANT_SYSTEM_PROMPT, messages, config });
    } catch (err) {
      const timedOut = /timed out/i.test(err?.message || '');
      const upstream = err?.upstreamStatus;
      if (timedOut) {
        throw new HttpError(502, 'ai_timeout', 'The AI assistant is taking too long to respond. Please try again in a moment.');
      }
      if (upstream && upstream >= 400 && upstream < 500) {
        // Bad key, unknown/discontinued model, bad request — a config problem,
        // not a transient outage. Tell the user exactly what to check.
        throw new HttpError(
          502,
          'ai_config_error',
          'The AI service rejected the request. Please check that your API key is valid and AI_MODEL is a current model name (e.g. gemini-3.8-flash), then restart the server.',
        );
      }
      throw new HttpError(502, 'ai_unavailable', 'The AI assistant could not respond right now. Please try again in a moment.');
    }
    res.json({ ...toApi(reply), model: config.aiModel });
  }

  // Lets the client show/hide the chat honestly.
  async function getStatus(req, res) {
    res.json({ available: Boolean(config.aiApiKey), model: config.aiApiKey ? config.aiModel : null });
  }

  return { sendMessage, getStatus };
}
