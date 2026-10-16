// Badge showing a case's workflow status (icon + text, never color-only).
import {
  Pencil,
  Send,
  Hourglass,
  ClipboardCheck,
  Loader2,
  Scale,
  Users,
  CheckCircle2,
  Flag,
  Archive,
} from 'lucide-react';
import { STATUSES } from '../../utils/caseWorkflow.js';
import './ui.css';

// Icon per status; analysis-in-progress spins via the .spin class.
const ICONS = {
  draft: Pencil,
  submitted: Send,
  'awaiting-evidence': Hourglass,
  'ready-for-analysis': ClipboardCheck,
  'analysis-in-progress': Loader2,
  'assessment-available': Scale,
  'awaiting-human-review': Users,
  'review-completed': CheckCircle2,
  appealed: Flag,
  archived: Archive,
};

export default function StatusBadge({ status }) {
  const Icon = ICONS[status];
  const label = STATUSES[status]?.label ?? status;
  const spinning = status === 'analysis-in-progress';

  return (
    <span className={`status-badge status-${status}`}>
      {Icon && (
        <Icon size={14} aria-hidden="true" className={spinning ? 'spin' : ''} />
      )}
      {label}
    </span>
  );
}
