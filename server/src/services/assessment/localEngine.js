// Local heuristic assessment engine (engine: 'local-heuristic').
// A REAL but simple and fully transparent analysis: sentence splitting,
// claim sourcing, token-overlap agreement/disagreement detection, and
// evidence cross-referencing by content-word overlap. Every quotation it
// emits is an exact substring of the user-provided text (IRON RULES).
import { AUTHENTICITY_NOTE } from '../../utils/constants.js';

const STOPWORDS = new Set(
  'a,an,the,and,or,but,if,then,else,when,while,of,at,by,for,with,about,into,through,during,before,after,above,below,to,from,up,down,in,out,on,off,over,under,again,further,once,here,there,all,any,both,each,few,more,most,other,some,such,no,nor,not,only,own,same,so,than,too,very,can,will,just,should,now,is,are,was,were,be,been,being,have,has,had,having,do,does,did,doing,would,could,ought,might,must,shall,may,i,me,my,myself,we,our,ours,ourselves,you,your,yours,yourself,yourselves,he,him,his,himself,she,her,hers,herself,it,its,itself,they,them,their,theirs,themselves,what,which,who,whom,this,that,these,those,am,as,because,until,also'.split(
    ',',
  ),
);

function splitSentences(text) {
  return String(text ?? '')
    .split(/\r?\n+/)
    .flatMap((para) => para.split(/(?<=[.!?])\s+/))
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
}

function contentTokens(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^'+|'+$/g, ''))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function jaccard(aTokens, bTokens) {
  const A = new Set(aTokens);
  const B = new Set(bTokens);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  return inter / (A.size + B.size - inter);
}

function normalizeClaims(rawClaims, side) {
  return (Array.isArray(rawClaims) ? rawClaims : [])
    .map((c) => String(c).trim())
    .filter(Boolean)
    .map((text) => ({ text, source: 'user-listed', side }));
}

// Sentences that look informative and are not restatements of listed claims.
function extractKeySentences(sentences, listedClaims, max = 5) {
  const listedTokenSets = listedClaims.map((c) => contentTokens(c.text));
  const candidates = sentences
    .filter((s) => contentTokens(s.text).length >= 5)
    .filter(
      (s) =>
        !listedTokenSets.some((lt) => jaccard(lt, contentTokens(s.text)) >= 0.8),
    )
    .sort((a, b) => contentTokens(b.text).length - contentTokens(a.text).length)
    .slice(0, max);
  return candidates;
}

const MISSING_CHECKS = [
  {
    key: 'dates_times',
    label: 'Specific dates or times',
    question:
      'Can either side provide a specific date or time — for example from a message timestamp, receipt, or dated photo?',
    present: (t) =>
      /\b\d{1,2}:\d{2}\b|\b\d{1,2}\s*(am|pm)\b|\b\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?\b|\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}\b/i.test(
        t,
      ),
  },
  {
    key: 'location',
    label: 'Where it happened (location)',
    question:
      'Where exactly did the key events happen, and is there any record from that place (a register, camera, or another person)?',
    present: (t) =>
      /\b(home|house|apartment|flat|office|workplace|shop|store|street|road|city|town|village|hostel|room|building|market|station|school|university)\b/i.test(
        t,
      ),
  },
  {
    key: 'amounts',
    label: 'Exact amounts or costs',
    question: 'What is the exact amount in dispute, and is there a receipt, quote, or written figure for it?',
    present: (t) => /(\brs\.?\b|pkr|\$|€|£|\d[\d,]*\s?(rupees|dollars|pkr))\b/i.test(t),
  },
  {
    key: 'witnesses',
    label: 'Witnesses or other people present',
    question: 'Was anyone else present who could describe what they observed?',
    present: (t) => /\b(witness|saw|seen|observed|present|someone else|anyone else)\b/i.test(t),
  },
  {
    key: 'prior_condition',
    label: 'Documented condition from before the dispute',
    question:
      'Is there any dated photo, message, or record showing the condition of things before the dispute?',
    present: (t) => /\b(before|previously|prior|undamaged|intact|condition|already)\b/i.test(t),
  },
  {
    key: 'written_record',
    label: 'Written agreement, receipt, or dated record',
    question:
      'Is there any written agreement, receipt, chat message, or dated photo connected to this case?',
    present: (t) => /\b(agreement|contract|written|receipt|invoice|message|text|chat|email|photo|picture|video|record)\b/i.test(t),
  },
];

const EXPECTATION_RE = /\b(should|supposed|agreed|promised|expected|expectation|fair|deserve|deserves)\b/gi;

const OUTCOME_WORDS = {
  leans_a:
    "the documented material leans toward Person A's account on the points the documents cover — it does not prove Person A is right overall",
  leans_b:
    "the documented material leans toward Person B's account on the points the documents cover — it does not prove Person B is right overall",
  mixed:
    'each side has some documented support on different points, so the material points in both directions',
  insufficient_evidence:
    'there is not enough documented material to fairly resolve the disputed points — more records are needed before any conclusion',
  expectations_not_facts:
    'the disagreement is mostly about expectations of fairness rather than disputed facts, so it calls for negotiation rather than fact-finding',
};

export function analyzeLocal(caseObj, evidenceList = []) {
  const personA = caseObj.personA || {};
  const personB = caseObj.personB || {};
  const aName = personA.name || 'Person A';
  const bName = personB.name || 'Person B';

  const aSents = splitSentences(personA.statement).map((text) => ({ text, tokens: contentTokens(text) }));
  const bSents = splitSentences(personB.statement).map((text) => ({ text, tokens: contentTokens(text) }));

  // ---- claim sourcing ----
  const aListed = normalizeClaims(personA.claims, 'A');
  const bListed = normalizeClaims(personB.claims, 'B');
  const personAClaims = [
    ...aListed,
    ...extractKeySentences(aSents, aListed).map((s) => ({ text: s.text, source: 'extracted', side: 'A' })),
  ];
  const personBClaims = [
    ...bListed,
    ...extractKeySentences(bSents, bListed).map((s) => ({ text: s.text, source: 'extracted', side: 'B' })),
  ];
  const allClaims = [...personAClaims, ...personBClaims];

  // ---- agreement: high token overlap between A and B sentences ----
  const areasOfAgreement = [];
  const seenPairs = new Set();
  for (const a of aSents) {
    for (const b of bSents) {
      if (areasOfAgreement.length >= 6) break;
      const key = `${a.text}|||${b.text}`;
      if (seenPairs.has(key)) continue;
      if (jaccard(a.tokens, b.tokens) >= 0.5) {
        seenPairs.add(key);
        areasOfAgreement.push({
          text: `Both accounts describe the same point in similar words.`,
          aSays: a.text,
          bSays: b.text,
        });
      }
    }
  }

  // ---- disagreement: same topic word, low token overlap ----
  const freq = new Map();
  for (const s of [...aSents, ...bSents]) {
    for (const t of new Set(s.tokens)) freq.set(t, (freq.get(t) || 0) + 1);
  }
  const topics = [...freq.entries()]
    .filter(([, n]) => n >= 2)
    .sort((x, y) => y[1] - x[1])
    .slice(0, 12)
    .map(([t]) => t);
  const pointsOfDisagreement = [];
  const seenDis = new Set();
  for (const topic of topics) {
    if (pointsOfDisagreement.length >= 6) break;
    const aHits = aSents.filter((s) => s.tokens.includes(topic));
    const bHits = bSents.filter((s) => s.tokens.includes(topic));
    for (const a of aHits) {
      for (const b of bHits) {
        if (pointsOfDisagreement.length >= 6) break;
        const key = `${a.text}|||${b.text}`;
        if (seenDis.has(key)) continue;
        if (jaccard(a.tokens, b.tokens) < 0.35) {
          seenDis.add(key);
          pointsOfDisagreement.push({
            text: `Both sides talk about "${topic}" but describe it differently.`,
            topic,
            aSays: a.text,
            bSays: b.text,
          });
        }
      }
    }
  }

  // ---- evidence cross-reference: content-word overlap with descriptions ----
  const supportedByEvidence = [];
  const unverifiedClaims = [];
  for (const claim of allClaims) {
    const claimTokens = new Set(contentTokens(claim.text));
    const matches = [];
    for (const ev of evidenceList) {
      const descTokens = new Set(contentTokens(`${ev.description || ''} ${ev.originalName || ''}`));
      let overlap = 0;
      for (const t of claimTokens) if (descTokens.has(t)) overlap += 1;
      if (overlap >= 2) matches.push(ev);
    }
    if (matches.length > 0) {
      for (const ev of matches) {
        supportedByEvidence.push({
          text: `Claim reflected in an evidence description (${ev.originalName || 'uploaded file'}). ${AUTHENTICITY_NOTE}`,
          claim: claim.text,
          side: claim.side,
          evidence: ev.description || ev.originalName || 'uploaded file',
        });
      }
    } else {
      unverifiedClaims.push({
        text: `No uploaded evidence description shares supporting details with this claim. ${AUTHENTICITY_NOTE}`,
        claim: claim.text,
        side: claim.side,
        note: 'Stated without supporting material in the descriptions provided.',
      });
    }
  }
  const supportedA = supportedByEvidence.filter((e) => e.side === 'A').length;
  const supportedB = supportedByEvidence.filter((e) => e.side === 'B').length;

  // ---- missing information checklist ----
  const corpus = [caseObj.summary, caseObj.situation, personA.statement, personB.statement, caseObj.desiredOutcome]
    .filter(Boolean)
    .join('\n');
  const missingInformation = [];
  const clarifyingQuestions = [];
  for (const check of MISSING_CHECKS) {
    if (!check.present(corpus)) {
      missingInformation.push(`${check.label} — not specified in the provided accounts.`);
      clarifyingQuestions.push(check.question);
    }
  }

  // ---- outcome category ----
  let outcomeCategory;
  if (supportedA > 0 && supportedB === 0) outcomeCategory = 'leans_a';
  else if (supportedB > 0 && supportedA === 0) outcomeCategory = 'leans_b';
  else if (supportedA > 0 && supportedB > 0) outcomeCategory = 'mixed';
  else {
    const factualDispute = pointsOfDisagreement.length > 0;
    const expectationHits = (corpus.match(EXPECTATION_RE) || []).length;
    outcomeCategory = !factualDispute && expectationHits >= 3 ? 'expectations_not_facts' : 'insufficient_evidence';
  }

  // ---- neutral summary ----
  const summarySents = splitSentences(caseObj.summary).slice(0, 2);
  const neutralSummary =
    summarySents.length > 0
      ? `This case concerns a disagreement between ${aName} and ${bName}. ${summarySents.join(' ')}`
      : `This case concerns a disagreement between ${aName} and ${bName}.`;

  const alternativeExplanations = [
    'One or both sides may be misremembering details — memory of stressful events is often incomplete rather than dishonest.',
    'The disputed facts may have a cause neither side has considered.',
  ];
  for (const d of pointsOfDisagreement.slice(0, 3)) {
    alternativeExplanations.push(
      `The differing descriptions of "${d.topic}" could come from each side noticing different details, not from either side being wrong about everything.`,
    );
  }

  const reasoning = [
    `Read ${aSents.length} sentences from ${aName}'s statement and ${bSents.length} from ${bName}'s, plus ${aListed.length + bListed.length} user-listed claims.`,
    `Compared sentences by shared content words: ${areasOfAgreement.length} high-overlap pair(s) treated as agreement, ${pointsOfDisagreement.length} same-topic/low-overlap pair(s) treated as disagreement.`,
    `Matched each claim against the ${evidenceList.length} uploaded evidence description(s) by content-word overlap (2+ shared words = reflected in a description). Result: ${supportedA} supported claim(s) for Person A, ${supportedB} for Person B, ${unverifiedClaims.length} without reflection.`,
    `${missingInformation.length} kind(s) of information are absent from the accounts; they are listed as missing rather than assumed.`,
    `Outcome category "${outcomeCategory}" was chosen because ${outcomeCategoryReason(outcomeCategory)}.`,
    'No lie detection was attempted, no intent was inferred, and no numeric probability of truthfulness was computed.',
  ];

  const nextSteps = [
    'Each side writes a short, dated timeline of what happened, sticking to observable facts.',
    'Gather anything that could fill the gaps above — dated photos, messages, receipts, or a witness account.',
    'Compare the two timelines and mark the points where both sides agree; those are the settled facts.',
    'Discuss how to resolve the outcome only after the facts are mapped — not before.',
    'If direct discussion stalls, ask a neutral person both sides trust to help talk it through.',
  ];

  const limitations = [
    'This analysis is produced by a transparent keyword-and-overlap heuristic, not by human judgment.',
    'It works only from the text and file descriptions provided; it cannot verify who is telling the truth.',
    AUTHENTICITY_NOTE,
    'It does not detect deception, does not infer what anyone intended, and does not favor either participant.',
    'Observations are kept separate from inferences; anything inferred is labeled as an inference.',
    'This is not legal advice.',
  ];

  const missingList =
    missingInformation.length > 0
      ? ` Key gaps: ${missingInformation.map((m) => m.split(' — ')[0].toLowerCase()).join('; ')}.`
      : ' No major information gaps were detected by the checklist.';
  const overallAssessment =
    `${aName} puts forward ${personAClaims.length} claim(s) and ${bName} puts forward ${personBClaims.length} claim(s). ` +
    `The analysis found ${areasOfAgreement.length} point(s) where both accounts overlap and ` +
    `${pointsOfDisagreement.length} point(s) where they describe the same topic differently. ` +
    `${supportedA + supportedB} claim(s) are reflected in the uploaded evidence descriptions; ` +
    `${unverifiedClaims.length} claim(s) are stated without such reflection.${missingList} ` +
    `Overall: ${OUTCOME_WORDS[outcomeCategory]}.`;

  // ---- decision: a plain-language recommendation ----
  // This is the engine's recommendation from the provided material — not a
  // finding of truth, not a legal judgment. It says who the material favors,
  // why, and what could change it.
  const topSupport = supportedByEvidence.slice(0, 2).map((s) => s.claim || (typeof s === 'string' ? s : s.text || '')).filter(Boolean);
  const supportLine = topSupport.length > 0 ? ` Key supporting points: ${topSupport.map((t) => `"${t}"`).join('; ')}.` : '';
  const gapLine =
    missingInformation.length > 0
      ? ` What could change this: ${missingInformation.slice(0, 2).map((m) => m.split(' — ')[0].toLowerCase()).join('; ')}.`
      : '';
  const decisionHeadline = {
    leans_a: `On the material provided, the case favors ${aName}.`,
    leans_b: `On the material provided, the case favors ${bName}.`,
    mixed: 'On the material provided, neither side is clearly stronger — each is supported on different points.',
    insufficient_evidence: 'No fair recommendation is possible yet — there is not enough material to decide between the accounts.',
    expectations_not_facts: 'This is a disagreement about expectations, not about facts — it calls for negotiation, not a verdict on who is right.',
  }[outcomeCategory];
  const decision =
    `${decisionHeadline}${supportLine}${gapLine} ` +
    `This recommendation comes only from the statements, claims, and evidence descriptions given; it cannot verify who is telling the truth and is not legal advice.`;

  return {
    neutralSummary,
    personAClaims,
    personBClaims,
    areasOfAgreement,
    pointsOfDisagreement,
    supportedByEvidence,
    unverifiedClaims,
    missingInformation,
    alternativeExplanations,
    reasoning,
    clarifyingQuestions: clarifyingQuestions.slice(0, 6),
    nextSteps,
    limitations,
    overallAssessment,
    decision,
    outcomeCategory,
    engine: 'local-heuristic',
    model: 'local-heuristic-v1',
    createdAt: new Date().toISOString(),
  };
}

function outcomeCategoryReason(outcomeCategory) {
  switch (outcomeCategory) {
    case 'leans_a':
      return 'only Person A has claims reflected in the evidence descriptions';
    case 'leans_b':
      return 'only Person B has claims reflected in the evidence descriptions';
    case 'mixed':
      return 'both sides have claims reflected in the evidence descriptions';
    case 'expectations_not_facts':
      return 'there is no clear factual dispute and the language is dominated by expectations of fairness';
    default:
      return 'the disputed points have no documented support on either side';
  }
}
