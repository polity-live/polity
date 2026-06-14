export function getAmendmentProcessStatusBadgeClassName(status?: string | null) {
  switch (status) {
    case 'approved':
    case 'accepted':
    case 'completed':
    case 'merged':
      return 'border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
    case 'rejected':
    case 'withdrawn':
      return 'border-rose-500/30 bg-rose-500/15 text-rose-700 dark:text-rose-300';
    case 'pending_event':
    case 'scheduled':
      return 'border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300';
    case 'in_vote':
    case 'supported':
      return 'border-sky-500/30 bg-sky-500/15 text-sky-700 dark:text-sky-300';
    case 'previous_decision_outstanding':
      return 'border-orange-500/30 bg-orange-500/15 text-orange-700 dark:text-orange-300';
    case 'forward_confirmed':
      return 'border-indigo-500/30 bg-indigo-500/15 text-indigo-700 dark:text-indigo-300';
    default:
      return 'border-slate-500/25 bg-slate-500/10 text-slate-700 dark:text-slate-300';
  }
}

export function getAmendmentProcessInfoBadgeClassName(
  tone: 'group' | 'workflow' | 'count' | 'step' | 'current' | 'task'
) {
  switch (tone) {
    case 'group':
      return 'border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300';
    case 'workflow':
      return 'border-violet-500/30 bg-violet-500/15 text-violet-700 dark:text-violet-300';
    case 'count':
      return 'border-cyan-500/30 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300';
    case 'step':
      return 'border-slate-500/25 bg-slate-500/10 text-slate-700 dark:text-slate-300';
    case 'current':
      return 'border-lime-500/30 bg-lime-500/15 text-lime-700 dark:text-lime-300';
    case 'task':
      return 'border-fuchsia-500/30 bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300';
  }
}

export function getRelationshipBadgeClassName(type: 'parent' | 'child' | 'sibling' | string) {
  switch (type) {
    case 'sibling':
      return 'border-violet-300 bg-violet-50 text-violet-800';
    case 'parent':
      return 'border-emerald-300 bg-emerald-50 text-emerald-800';
    case 'child':
      return 'border-sky-300 bg-sky-50 text-sky-800';
    default:
      return 'border-muted bg-muted/50 text-foreground';
  }
}
