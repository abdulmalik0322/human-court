// Sample demo case shown to new users: a borrowed-headphones dispute.
// All content is illustrative sample data — never presented as real.

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

export const sampleCase = {
  id: 'sample-headphones-001',
  title: 'The borrowed headphones',
  category: 'Friendship',
  summary:
    'Amir lent Bilal his wireless headphones for a week. They came back with a cracked headband. Amir says Bilal broke them; Bilal says the crack was already there.',
  situation:
    'Amir bought a pair of wireless over-ear headphones about two months ago. Three weeks ago, Bilal asked to borrow them for a week while traveling, and Amir agreed. Amir says he told Bilal to handle them carefully because they were still new. Bilal returned them on time, in their case.\n\nWhen Amir used the headphones the next day, he noticed a crack along the right side of the headband. He sent Bilal a photo immediately. Bilal replied that the crack must have already been there, because he kept them in the case the whole trip and never dropped them. Amir says the headphones were in perfect condition when he lent them. Bilal says Amir never showed him the headphones before handing them over, so there is no proof they were undamaged. They have not been able to agree on who should pay for the repair, which would cost roughly a third of the price of a new pair.',
  desiredOutcome:
    'Amir wants Bilal to pay for half the repair cost, or at least agree on a fair split. Bilal says he should not pay anything unless there is proof the damage happened while the headphones were with him. Both say they would accept a fair assessment based on whatever evidence can be gathered.',
  personA: {
    label: 'Person A',
    name: 'Amir (the owner)',
    statement:
      'I lent Bilal my headphones because he is my friend and I trusted him. They were two months old and in perfect condition — I take care of my things. Before lending them, I told him to handle them carefully because they were still new. When they came back, the headband was cracked. I noticed it the day after he returned them and sent him a photo right away. Headphones do not crack by themselves. He had them for a full week, so the damage must have happened while they were with him. I am not asking him to buy me a new pair — I am only asking him to share the repair cost, since he was responsible for them when the crack appeared.',
    claims: [
      'The headphones were undamaged when I lent them.',
      'I told Bilal to handle them carefully because they were still new.',
      'The crack was discovered the day after Bilal returned them.',
      'The damage happened while the headphones were in Bilal\u2019s possession.',
    ],
  },
  personB: {
    label: 'Person B',
    name: 'Bilal (the borrower)',
    statement:
      'I borrowed the headphones for my trip and kept them in the case the entire time. I never dropped them, sat on them, or treated them roughly. When Amir sent me the photo of the crack, I was surprised — I had not noticed any damage when I returned them. Amir never showed me the headphones before lending them; he just handed me the case. For all I know, the crack was already there, or it developed from normal use. Amir says they were in perfect condition, but there is no photo or record proving that. I returned them on time and in the same condition I received them, as far as I know. I do not think it is fair to ask me to pay without proof that I caused the damage.',
    claims: [
      'The headphones were kept in their case during the whole trip.',
      'Bilal never dropped or mishandled the headphones.',
      'Amir did not show the headphones\u2019 condition before lending them.',
      'The crack was already there before I borrowed them.',
    ],
  },
  evidence: [
    {
      id: 'ev1',
      name: 'cracked-headband.jpg',
      kind: 'Photo (illustrative)',
      description:
        'Photo of the cracked headband taken after the headphones were returned. Shows the damage exists now; does not show when it happened.',
    },
    {
      id: 'ev2',
      name: 'chat-excerpt.txt',
      kind: 'Message excerpt (illustrative)',
      description:
        'Amir wrote "handle them carefully, they are still new" before lending. Shows what Amir believed, not proof of condition.',
    },
  ],
  assessment: {
    note: 'Sample demonstration — not real AI analysis',
    outcomeLabel: 'Insufficient evidence',
    summary:
      'Both sides agree on the basic facts: the headphones were lent for a week and returned with a cracked headband. What is disputed — whether the crack existed before the loan — cannot be settled from the available information. The photo proves the crack exists now, but nothing shows the headphones\u2019 condition before the loan. Amir\u2019s belief that they were undamaged and Bilal\u2019s belief that the crack predates the loan are both stated as recollections, not supported by records. A fair next step would be to gather anything that could establish the condition at handover: a dated photo, a witness, or warranty and repair information.',
    claimsA: [
      'Amir believes the headphones were undamaged when lent — stated as recollection; no dated photo or inspection supports it.',
      'Amir\u2019s message "handle them carefully, they are still new" is on record — it shows his expectation, not the headphones\u2019 condition.',
      'Amir noticed and reported the crack the day after the return — the timing of the report is not disputed, but it does not establish when the crack formed.',
    ],
    claimsB: [
      'Bilal says the headphones stayed in the case and were never mishandled — stated as his account; no independent record confirms or contradicts it.',
      'Bilal\u2019s claim that the crack predates the loan — stated as a possibility he raises, not supported by any evidence.',
      'Bilal says the headphones\u2019 condition was never shown to him at handover — this is consistent with Amir\u2019s account, which does not describe an inspection either.',
    ],
    agreements: [
      'Both agree the headphones were lent and returned.',
      'Both agree there is now a crack in the headband.',
    ],
    disagreements: ['Whether the crack existed before the loan.'],
    supportedByEvidence: [
      'The photo confirms the headband is currently cracked.',
    ],
    unverified: [
      'Amir\u2019s claim the headphones were undamaged before lending — no photo or inspection record from that time.',
      'Bilal\u2019s claim the crack predates the loan — no evidence offered.',
      'Neither side\u2019s account of how the headphones were handled during the week — no independent record either way.',
    ],
    missingInformation: [
      'A dated photo or inspection from before the loan.',
      'Purchase receipt or warranty terms.',
      'Whether anyone else saw the headphones around the time of the loan.',
    ],
    alternativeExplanations: [
      'The crack developed during normal use by either person.',
      'A pre-existing hairline crack widened during the loan.',
    ],
    reasoning: [
      'The only documented fact is the current condition: the headband is cracked. Both sides agree on this.',
      'The central question — when the crack formed — has no documentation on either side, so it cannot be resolved from what is available.',
      'Amir\u2019s request for shared repair cost rests on the assumption that damage occurred during the loan. Bilal\u2019s refusal rests on the assumption that it did not. Both assumptions are currently unproven.',
      'The chat message supports that Amir cared about the headphones and warned Bilal, but it is evidence of his attitude, not of the headphones\u2019 condition.',
      'This assessment does not determine who is telling the truth — it only maps what is supported, what is stated without support, and what is missing.',
    ],
    questions: [
      'Is there any dated photo of the headphones taken before the loan — for example, shared with a friend or posted online?',
      'Did anyone else see the headphones around the time they were handed over?',
      'What are the warranty or repair terms, and what would an authorized repair cost?',
    ],
    nextSteps: [
      'Look for any dated photo or message showing the headphones before the loan.',
      'Get a repair quote from the manufacturer or an authorized shop.',
      'If both sides can agree on what the headphones looked like at handover, revisit how to share the cost.',
    ],
    limitations:
      'This sample assessment is illustrative only. It is not a real analysis, cannot verify any claim, and does not determine who is telling the truth.',
    overall:
      'The facts everyone agrees on are simple: the headphones were lent, returned, and now have a cracked headband. Everything else — when the crack appeared and whose handling caused it — is each person\u2019s recollection without supporting records. On the information available, there is no fair basis for deciding who should pay, so the most useful step is to try to find evidence of the headphones\u2019 condition at the time of handover before arguing about the bill.',
  },
};
