import { Link } from '@tanstack/react-router';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import { FilterToggleGroupItem } from '@/features/shared/ui/filter-controls';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Badge } from '@/features/shared/ui/ui/badge';
import { Button } from '@/features/shared/ui/ui/button';
import { ToggleGroup } from '@/features/shared/ui/ui/toggle-group';
import type { ActivityChange, ActivitySeverityFilter } from '@/zero/activity/types';

function userName(user: any, fallback: string) {
  return [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.handle || fallback;
}

function humanize(value: string) {
  return value.replaceAll('_', ' ').replace(/^./, letter => letter.toUpperCase());
}

function formatValue(
  field: string,
  value: unknown,
  language: string,
  empty: string,
  translate: (
    key: string,
    options?: string | Record<string, string | number | null | undefined>,
    fallback?: string
  ) => string,
  subjectUser?: any
): string {
  if (value === null || value === undefined || value === '') return empty;
  if (
    typeof value === 'number' &&
    (field.includes('date') || field.endsWith('_at') || field.includes('time'))
  ) {
    return new Date(value).toLocaleString(language);
  }
  if (Array.isArray(value))
    return value.length
      ? value
          .map(entry => formatValue(field, entry, language, empty, translate, subjectUser))
          .join(', ')
      : empty;
  if (typeof value === 'object') return JSON.stringify(value);
  const raw = String(value);
  if (
    subjectUser?.id === raw &&
    (field === 'assignees' || field === 'assignee_id' || field.endsWith('_user_id'))
  ) {
    return userName(subjectUser, raw);
  }
  return translate(`components.activityLog.values.${field}.${raw}`, humanize(raw));
}

export interface ActivityLogController {
  activities: readonly any[];
  severity: ActivitySeverityFilter;
  setSeverity: (severity: ActivitySeverityFilter) => void;
  isLoading: boolean;
  hasMore: boolean;
  loadMore: () => void;
}

export function ActivityLogView({ activity }: { activity: ActivityLogController }) {
  const { t, language } = useTranslation();
  const deletedUser = t('components.activityLog.deletedUser');
  const system = t('components.activityLog.system');
  const empty = t('components.activityLog.emptyValue');

  return (
    <div className="space-y-4">
      <div>
        <ToggleGroup
          type="single"
          value={activity.severity}
          onValueChange={value => {
            if (value === 'all' || value === 'normal' || value === 'high') {
              activity.setSeverity(value);
            }
          }}
          variant="outline"
          size="sm"
          className="justify-start"
          aria-label={t('components.activityLog.filter.label')}
        >
          {(['all', 'normal', 'high'] as const).map(value => (
            <FilterToggleGroupItem
              key={value}
              value={value}
              data-action-id={`activity-log.filter.${value}`}
              aria-label={t(`components.activityLog.filter.${value}`)}
            >
              {t(`components.activityLog.filter.${value}`)}
            </FilterToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      {activity.isLoading && activity.activities.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
          {t('components.activityLog.loading')}
        </p>
      ) : activity.activities.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
          {t('components.activityLog.empty')}
        </p>
      ) : (
        <ol className="space-y-4">
          {activity.activities.map(item => {
            const actorName =
              item.actor_type === 'system' ? system : userName(item.actor, deletedUser);
            const changes = (Array.isArray(item.changes) ? item.changes : []) as ActivityChange[];
            const context =
              item.context && typeof item.context === 'object'
                ? (item.context as Record<string, unknown>)
                : {};
            const contextLabel =
              context.name ??
              context.title ??
              (context.count !== undefined
                ? t(
                    'components.activityLog.context.count',
                    { count: Number(context.count) },
                    `${context.count}`
                  )
                : null);
            const contextEntries = Object.entries(context).filter(
              ([field]) => !['name', 'title', 'count'].includes(field)
            );
            return (
              <li
                key={item.id}
                className={
                  item.severity === 'high'
                    ? 'border-destructive/40 rounded-lg border-2 p-4'
                    : 'rounded-lg border p-4'
                }
              >
                <div className="flex items-start gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={item.actor?.avatar ?? undefined} />
                    <AvatarFallback>{actorName[0]?.toUpperCase() ?? '?'}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      {item.actor?.id && item.actor_type !== 'system' ? (
                        <Link
                          to="/user/$id"
                          params={{ id: item.actor.id }}
                          className="font-medium hover:underline"
                        >
                          {actorName}
                        </Link>
                      ) : (
                        <span className="font-medium">{actorName}</span>
                      )}
                      <span>
                        {t(`components.activityLog.actions.${item.action}`, humanize(item.action))}
                      </span>
                      {item.subject_user ? (
                        <span className="font-medium">
                          {userName(item.subject_user, deletedUser)}
                        </span>
                      ) : null}
                      {contextLabel !== null ? (
                        <span className="text-muted-foreground">{String(contextLabel)}</span>
                      ) : null}
                      <Badge variant={item.severity === 'high' ? 'destructive' : 'secondary'}>
                        {t(`components.activityLog.severity.${item.severity}`)}
                      </Badge>
                    </div>
                    <time className="text-muted-foreground block text-xs">
                      {new Date(item.created_at).toLocaleString(language)}
                    </time>
                    {changes.length > 0 ? (
                      <dl className="space-y-2 text-sm">
                        {changes.map((change, index) => (
                          <div
                            key={`${change.field}-${index}`}
                            className="grid gap-1 sm:grid-cols-3"
                          >
                            <dt className="font-medium">
                              {t(
                                `components.activityLog.fields.${change.field}`,
                                humanize(change.field)
                              )}
                            </dt>
                            <dd className="text-muted-foreground wrap-break-word">
                              {formatValue(
                                change.field,
                                change.from,
                                language,
                                empty,
                                t,
                                item.subject_user
                              )}
                            </dd>
                            <dd className="wrap-break-word">
                              <span aria-hidden="true" className="mr-2">
                                →
                              </span>
                              {formatValue(
                                change.field,
                                change.to,
                                language,
                                empty,
                                t,
                                item.subject_user
                              )}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                    {contextEntries.length > 0 ? (
                      <dl className="text-muted-foreground grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                        {contextEntries.map(([field, value]) => (
                          <div key={field} className="flex min-w-0 gap-2">
                            <dt className="font-medium">
                              {t(`components.activityLog.fields.${field}`, humanize(field))}
                            </dt>
                            <dd className="wrap-break-word">
                              {formatValue(field, value, language, empty, t)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {activity.hasMore ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={activity.loadMore} disabled={activity.isLoading}>
            {t('components.activityLog.loadMore')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
