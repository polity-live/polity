export type ActivitySeverity = 'normal' | 'high';
export type ActivitySeverityFilter = 'all' | ActivitySeverity;
export type ActivityActorType = 'user' | 'system';

export interface ActivityChange {
  field: string;
  from: unknown;
  to: unknown;
}

export type ActivityContext = Record<string, unknown>;
