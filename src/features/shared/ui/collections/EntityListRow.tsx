import type { ReactNode } from 'react';
import { SmartLink } from '../navigation/SmartLink';
import { Button } from '../ui/button';
import { useTranslation } from '@/features/shared/hooks/use-translation';

export const entityTypeDotClasses: Record<string, string> = {
  amendment: 'bg-[var(--entity-amendment-base)]',
  event: 'bg-[var(--entity-event-base)]',
  group: 'bg-[var(--entity-group-base)]',
  user: 'bg-[var(--entity-user-base)]',
  blog: 'bg-[var(--entity-blog-base)]',
  todo: 'bg-amber-500',
  vote: 'bg-red-500',
  election: 'bg-indigo-500',
  video: 'bg-fuchsia-500',
  image: 'bg-cyan-500',
  statement: 'bg-lime-500',
  action: 'bg-slate-400',
  change_request: 'bg-orange-500',
  document: 'bg-sky-500',
  agenda: 'bg-teal-500',
};

export interface EntityListRowProps {
  type: string;
  typeLabel?: string;
  title: string;
  summary?: ReactNode;
  metadata?: ReactNode;
  href?: string;
  onOpen?: () => void;
  actions?: ReactNode;
  actionId?: string;
}

export function EntityListRow({
  type,
  typeLabel,
  title,
  summary,
  metadata,
  href,
  onOpen,
  actions,
  actionId,
}: EntityListRowProps) {
  const { t } = useTranslation();
  const content = (
    <>
      <span className="block truncate text-sm font-medium">{title}</span>
      {summary && <span className="text-muted-foreground block truncate text-xs">{summary}</span>}
    </>
  );
  const className =
    'focus-visible:ring-ring block min-w-0 rounded-sm text-left outline-none focus-visible:ring-2';
  return (
    <div
      data-workspace-row
      className="border-border/60 hover:bg-muted/40 flex min-h-16 min-w-0 items-center gap-3 border-b px-3 py-2"
    >
      <span className="text-muted-foreground flex shrink-0 items-center gap-2 text-xs sm:w-28">
        <span
          aria-hidden="true"
          data-search-type-dot={type}
          className={`size-2 shrink-0 rounded-full ${entityTypeDotClasses[type] ?? 'bg-slate-500'}`}
        />
        <span className="sr-only sm:not-sr-only sm:truncate">
          {typeLabel ?? t(`common.entities.${type}`)}
        </span>
      </span>
      <div className="min-w-0 flex-1">
        {onOpen ? (
          <Button
            type="button"
            variant="ghost"
            className={`${className} block h-auto px-0 font-normal`}
            onClick={onOpen}
            data-action-id={actionId ?? 'collection.entity.open'}
          >
            {content}
          </Button>
        ) : href ? (
          <SmartLink
            href={href}
            className={className}
            data-workspace-open
            data-action-id={actionId ?? 'collection.entity.open'}
          >
            {content}
          </SmartLink>
        ) : (
          <div className={className}>{content}</div>
        )}
        {metadata && (
          <div className="text-muted-foreground flex min-w-0 items-center gap-2 overflow-hidden text-xs whitespace-nowrap">
            {metadata}
          </div>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  );
}
