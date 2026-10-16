// In-app notifications. Respects the user's notificationPrefs
// (a type set to false is skipped). Failures never break the caller.
export const NOTIFICATION_TYPES = [
  'case_submitted',
  'evidence_added',
  'assessment_complete',
  'assessment_failed',
  'invitation_received',
  'review_submitted',
  'appeal_updated',
  'password_changed',
];

export async function notify(repo, userId, { type, title, body, caseId = null }) {
  try {
    if (!userId) return null;
    const user = await repo.getUserById(userId);
    if (!user) return null;
    const prefs = user.notificationPrefs || {};
    if (prefs[type] === false) return null;
    return await repo.createNotification({ userId, type, title, body, caseId });
  } catch (err) {
    console.error(`[notify] failed for user: ${err.message}`);
    return null;
  }
}
