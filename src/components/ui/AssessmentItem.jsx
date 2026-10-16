// AssessmentItem — renders one assessment list item.
//
// Engine items are either plain strings or objects shaped { text, ... }
// (see server/src/services/assessment/schema.js) with optional extras:
// claim, aSays/bSays, evidence, note. Never String() an object — that
// prints "[object Object]".
export function AssessmentItem({ item }) {
  if (typeof item === 'string') return <>{item}</>;
  if (!item || typeof item !== 'object') return null;
  const text = item.text || item.claim || item.question || '';
  if (!text && !item.aSays && !item.bSays) return null;
  return (
    <span className="assessment-item">
      {text && <span className="assessment-item-text">{text}</span>}
      {item.claim && item.text && (
        <span className="assessment-item-detail">Claim: “{item.claim}”</span>
      )}
      {item.aSays && (
        <span className="assessment-item-detail">A says: “{item.aSays}”</span>
      )}
      {item.bSays && (
        <span className="assessment-item-detail">B says: “{item.bSays}”</span>
      )}
      {item.evidence && (
        <span className="assessment-item-detail">Evidence: {item.evidence}</span>
      )}
      {item.note && (
        <span className="assessment-item-detail muted">{item.note}</span>
      )}
    </span>
  );
}
