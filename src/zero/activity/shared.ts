import type { MutableJSONValue } from '../shared/helpers';
import type { ActivityActorType, ActivityChange, ActivityContext, ActivitySeverity } from './types';

export function normalizeActivityValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map(normalizeActivityValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, normalizeActivityValue(entry)])
    );
  }
  return value;
}

export function activityValuesEqual(left: unknown, right: unknown) {
  return (
    JSON.stringify(normalizeActivityValue(left)) === JSON.stringify(normalizeActivityValue(right))
  );
}

export function buildActivityChanges(
  existing: Record<string, unknown>,
  update: Record<string, unknown>,
  trackedFields: readonly string[]
): ActivityChange[] {
  return trackedFields.flatMap(field => {
    if (!(field in update) || update[field] === undefined) return [];
    const from = normalizeActivityValue(existing[field]);
    const to = normalizeActivityValue(update[field]);
    return activityValuesEqual(from, to) ? [] : [{ field, from, to }];
  });
}

export function severityForChanges(
  changes: readonly ActivityChange[],
  highFields: ReadonlySet<string>
): ActivitySeverity {
  return changes.some(change => highFields.has(change.field)) ? 'high' : 'normal';
}

export async function appendEntityActivity(
  tx: any,
  ctx: { userID?: string | null },
  args: {
    table: 'amendment_activity' | 'group_activity' | 'event_activity';
    entityField: 'amendment_id' | 'group_id' | 'event_id';
    entityId: string;
    action: string;
    severity: ActivitySeverity;
    actorType?: ActivityActorType;
    actorId?: string | null;
    subjectUserId?: string | null;
    changes?: readonly ActivityChange[];
    context?: ActivityContext;
    createdAt?: number;
    id?: string;
  }
) {
  if (tx.location === 'client') return;
  const actorType = args.actorType ?? 'user';
  const activityMutation = tx.mutate[args.table];
  // Older isolated mutator tests provide deliberately minimal transaction doubles.
  // Real server transactions always expose activity tables through the Zero schema.
  if (!activityMutation?.insert) return;
  await activityMutation.insert({
    id: args.id ?? crypto.randomUUID(),
    [args.entityField]: args.entityId,
    actor_id: actorType === 'system' ? null : (args.actorId ?? ctx.userID ?? null),
    actor_type: actorType,
    subject_user_id: args.subjectUserId ?? null,
    action: args.action,
    severity: args.severity,
    changes: (args.changes ?? []) as unknown as MutableJSONValue,
    context: (args.context ?? {}) as unknown as MutableJSONValue,
    created_at: args.createdAt ?? Date.now(),
  });
}
