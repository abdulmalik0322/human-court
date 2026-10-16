// Assessments controller. POST returns 202 immediately; the engine runs
// async (setImmediate), moves the case through the transition table, and
// notifies the owner on completion or failure. History is append-only.
import { HttpError } from '../middleware/errorHandler.js';
import { getOwnedCase, requireViewableCase, transitionCase, timelineEvent } from './helpers.js';
import { generateAssessment } from '../services/assessment/index.js';
import { notify } from '../services/notifications.js';

const ASSESSABLE_FROM = ['ready-for-analysis', 'appealed'];

function toApi(a) {
  if (!a) return null;
  return {
    id: a.id,
    caseId: a.caseId,
    version: a.version,
    status: a.status,
    reason: a.reason || null,
    engine: a.engine || null,
    model: a.model || null,
    outcomeCategory: a.outcomeCategory || null,
    sections: a.sections || null,
    reports: a.reports || [],
    error: a.error || null,
    createdAt: a.createdAt,
    completedAt: a.completedAt || null,
  };
}

export function createAssessmentsController(ctx) {
  const { repo, config } = ctx;

  // Runs after the 202 response. Never throws — failures are recorded
  // on the assessment and the case is moved back honestly.
  async function runAssessment(assessmentId) {
    const record = await repo.getAssessmentById(assessmentId);
    if (!record) return;
    try {
      const caseObj = await repo.getCaseById(record.caseId);
      if (!caseObj) throw new Error('case not found');
      const evidence = await repo.listEvidenceByCase(record.caseId);
      const result = await generateAssessment(caseObj, evidence, config);
      await repo.updateAssessment(record.id, {
        status: 'complete',
        engine: result.engine,
        model: result.model,
        outcomeCategory: result.outcomeCategory,
        sections: {
          neutralSummary: result.neutralSummary,
          personAClaims: result.personAClaims,
          personBClaims: result.personBClaims,
          areasOfAgreement: result.areasOfAgreement,
          pointsOfDisagreement: result.pointsOfDisagreement,
          supportedByEvidence: result.supportedByEvidence,
          unverifiedClaims: result.unverifiedClaims,
          missingInformation: result.missingInformation,
          alternativeExplanations: result.alternativeExplanations,
          reasoning: result.reasoning,
          clarifyingQuestions: result.clarifyingQuestions,
          nextSteps: result.nextSteps,
          limitations: result.limitations,
          overallAssessment: result.overallAssessment,
          decision: result.decision,
        },
        completedAt: new Date().toISOString(),
      });
      const fresh = await repo.getCaseById(record.caseId);
      await transitionCase(repo, fresh, 'assessment-available');
      if (fresh.appeal && fresh.appeal.status === 'open') {
        await repo.updateCase(fresh.id, { appeal: { ...fresh.appeal, status: 'addressed' } });
      }
      await notify(repo, record.ownerId, {
        type: 'assessment_complete',
        title: 'Assessment ready',
        body: `The assessment for "${fresh.title}" is ready.`,
        caseId: fresh.id,
      });
    } catch (err) {
      console.error(`[assessment] engine failed for ${assessmentId}: ${err.message}`);
      await repo.updateAssessment(assessmentId, { status: 'failed', error: 'The assessment engine failed. Please try again.' });
      const caseObj = await repo.getCaseById(record.caseId);
      if (caseObj && caseObj.status === 'analysis-in-progress') {
        try {
          await transitionCase(repo, caseObj, 'ready-for-analysis');
        } catch {
          // Status may have moved on; the failed assessment record is the source of truth.
        }
      }
      await notify(repo, record.ownerId, {
        type: 'assessment_failed',
        title: 'Assessment failed',
        body: 'The assessment could not be completed. You can try again.',
        caseId: record.caseId,
      });
    }
  }

  async function createAssessment(req, res) {
    let c = await getOwnedCase(repo, req.params.id, req.user.id);
    // Auto-advance pre-analysis statuses so one click is enough:
    // submitted -> awaiting-evidence -> ready-for-analysis.
    // Each step is a valid table transition, recorded on the timeline.
    for (const next of ['awaiting-evidence', 'ready-for-analysis']) {
      if (c.status === 'submitted' || c.status === 'awaiting-evidence') {
        c = await transitionCase(repo, c, next);
      }
    }
    if (!ASSESSABLE_FROM.includes(c.status)) {
      throw new HttpError(
        409,
        'invalid_case_status',
        `Assessments can only start from: ${ASSESSABLE_FROM.join(', ')}.`,
      );
    }
    const { reason } = req.body || {};
    const prior = await repo.listAssessmentsByCase(c.id);
    const completedPrior = prior.filter((a) => a.status === 'complete');

    if (completedPrior.length > 0) {
      // Reassessment rules: reason AND (new evidence OR an open appeal).
      if (typeof reason !== 'string' || reason.trim().length === 0) {
        throw new HttpError(409, 'reassessment_not_allowed', 'A reassessment requires a reason.');
      }
      const lastAt = completedPrior[0].createdAt;
      const evidence = await repo.listEvidenceByCase(c.id);
      const newEvidence = evidence.some((e) => e.createdAt > lastAt);
      const openAppeal = c.appeal && c.appeal.status === 'open';
      if (!newEvidence && !openAppeal) {
        throw new HttpError(
          409,
          'reassessment_not_allowed',
          'A reassessment requires new evidence since the last assessment or an open appeal.',
        );
      }
    } else if (reason !== undefined && (typeof reason !== 'string' || reason.length > 2000)) {
      throw new HttpError(400, 'validation_error', 'reason must be a string (max 2000 characters).');
    }

    const version = (await repo.countAssessmentsByCase(c.id)) + 1;
    const record = await repo.createAssessment({
      caseId: c.id,
      ownerId: req.user.id,
      reason: typeof reason === 'string' ? reason.trim() || null : null,
      status: 'pending',
      version,
    });

    // appealed -> ready-for-analysis -> analysis-in-progress: each step is
    // a valid table transition, recorded on the timeline.
    let current = c;
    if (current.status === 'appealed') {
      current = await transitionCase(repo, current, 'ready-for-analysis');
    }
    current = await transitionCase(repo, current, 'analysis-in-progress');
    await repo.updateCase(current.id, {
      timeline: timelineEvent(current, 'assessment_started', `Assessment v${version} started`),
    });

    setImmediate(() => {
      runAssessment(record.id).catch((err) => console.error(`[assessment] runner crashed: ${err.message}`));
    });
    res.status(202).json({ id: record.id, status: 'pending', version });
  }

  async function listAssessments(req, res) {
    const c = await requireViewableCase(repo, req.params.id, req.user.id);
    const items = (await repo.listAssessmentsByCase(c.id)).map(toApi);
    res.json({ items });
  }

  async function getAssessment(req, res) {
    const c = await requireViewableCase(repo, req.params.id, req.user.id);
    const a = await repo.getAssessmentById(req.params.assessmentId);
    if (!a || a.caseId !== c.id) throw new HttpError(404, 'not_found', 'Assessment not found.');
    res.json({ assessment: toApi(a) });
  }

  async function reportAssessment(req, res) {
    const c = await requireViewableCase(repo, req.params.id, req.user.id);
    const a = await repo.getAssessmentById(req.params.assessmentId);
    if (!a || a.caseId !== c.id) throw new HttpError(404, 'not_found', 'Assessment not found.');
    const { reason } = req.body || {};
    if (typeof reason !== 'string' || reason.trim().length === 0 || reason.length > 2000) {
      throw new HttpError(400, 'validation_error', 'reason is required (max 2000 characters).');
    }
    const reports = [...(a.reports || []), { userId: req.user.id, reason: reason.trim(), at: new Date().toISOString() }];
    await repo.updateAssessment(a.id, { reports });
    res.json({ ok: true });
  }

  return { createAssessment, listAssessments, getAssessment, reportAssessment };
}
