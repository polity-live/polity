import { useId, type ComponentProps, type ReactNode } from 'react';

import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { cn } from '@/features/shared/utils/utils';

export function AgendaPageShell({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('mx-auto w-full max-w-7xl space-y-6 pt-2 pb-10 sm:space-y-7', className)}
      {...props}
    />
  );
}

export function AgendaSurface({ className, ...props }: ComponentProps<'section'>) {
  return (
    <section
      className={cn(
        'bg-card/70 border-border/70 overflow-hidden rounded-xl border shadow-none',
        className
      )}
      {...props}
    />
  );
}

export function AgendaSectionHeading({
  action,
  description,
  eyebrow,
  title,
}: {
  action?: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        {eyebrow ? (
          <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {eyebrow}
          </div>
        ) : null}
        <h2 className="text-lg leading-tight font-semibold tracking-tight sm:text-xl">{title}</h2>
        {description ? (
          <p className="text-muted-foreground max-w-3xl text-sm">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function AgendaContentHeader({
  action,
  badges,
  className,
  description,
  eyebrow,
  title,
  ...props
}: Omit<ComponentProps<'header'>, 'title'> & {
  action?: ReactNode;
  badges?: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
}) {
  return (
    <header
      className={cn(
        'border-border/70 bg-card/45 flex flex-wrap items-start justify-between gap-4 rounded-xl border px-4 py-4 shadow-none sm:px-5 sm:py-5',
        className
      )}
      {...props}
    >
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {eyebrow ? (
            <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              {eyebrow}
            </span>
          ) : null}
          {badges}
        </div>
        <h1 className="text-xl leading-tight font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {description ? (
          <p className="text-muted-foreground max-w-4xl text-sm whitespace-pre-wrap">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </header>
  );
}

export function AgendaSection({
  action,
  children,
  className,
  contentClassName,
  description,
  eyebrow,
  title,
  ...props
}: Omit<ComponentProps<'section'>, 'title'> & {
  action?: ReactNode;
  contentClassName?: string;
  description?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
}) {
  return (
    <section className={cn('space-y-3', className)} {...props}>
      <AgendaSectionHeading
        action={action}
        description={description}
        eyebrow={eyebrow}
        title={title}
      />
      <AgendaSurface className={cn('p-4 sm:p-5', contentClassName)}>{children}</AgendaSurface>
    </section>
  );
}

export type AgendaVotingWorkspaceMode = 'overview' | 'detail' | 'fullscreen';

export interface AgendaVotingWorkspaceProps extends Omit<ComponentProps<'section'>, 'title'> {
  mode: AgendaVotingWorkspaceMode;
  title: ReactNode;
  description?: ReactNode;
  changeRequests?: ReactNode;
  election?: ReactNode;
  vote?: ReactNode;
  emptyState?: ReactNode;
}

export function AgendaVotingWorkspace({
  changeRequests,
  className,
  description,
  election,
  emptyState,
  mode,
  title,
  vote,
  ...props
}: AgendaVotingWorkspaceProps) {
  const hasContent = Boolean(changeRequests || election || vote);

  return (
    <section className={cn('space-y-3', className)} data-agenda-voting-workspace={mode} {...props}>
      <AgendaSectionHeading title={title} description={description} />
      {hasContent ? (
        <div className="space-y-4">
          {changeRequests}
          {election}
          {vote}
        </div>
      ) : (
        (emptyState ?? null)
      )}
    </section>
  );
}

export type AgendaContextPane = 'details' | 'speakers';

export function AgendaContextTabs({
  details,
  detailsLabel,
  onValueChange,
  speakers,
  speakersLabel,
  value,
}: {
  details: ReactNode;
  detailsLabel: ReactNode;
  onValueChange: (value: AgendaContextPane) => void;
  speakers: ReactNode;
  speakersLabel: ReactNode;
  value: AgendaContextPane;
}) {
  const prefix = useId();
  const panes: { value: AgendaContextPane; label: ReactNode; content: ReactNode }[] = [
    { value: 'details', label: detailsLabel, content: details },
    { value: 'speakers', label: speakersLabel, content: speakers },
  ];
  const tabProps = (pane: AgendaContextPane) => ({
    type: 'button' as const,
    role: 'tab',
    id: `${prefix}-${pane}-tab`,
    'aria-controls': `${prefix}-${pane}-panel`,
    'aria-selected': value === pane,
    tabIndex: value === pane ? 0 : -1,
    'data-state': value === pane ? 'active' : 'inactive',
    className:
      'ring-offset-background focus-visible:ring-ring data-[state=active]:text-foreground inline-flex items-center justify-center rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-[color,background-color,box-shadow,transform] duration-[var(--motion-duration-base)] ease-[var(--motion-ease-standard)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none data-[state=active]:border-current data-[state=active]:bg-transparent data-[state=active]:shadow-none',
  });
  return (
    <div className="space-y-3" data-orientation="horizontal">
      <div
        role="tablist"
        aria-orientation="horizontal"
        className="scrollbar-hide text-muted-foreground border-border/70 inline-flex min-h-10 w-full max-w-full min-w-0 items-center justify-start overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-none border border-x-0 border-t-0 bg-transparent p-0 shadow-none"
        onKeyDown={event => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const next =
            event.key === 'Home'
              ? 'details'
              : event.key === 'End'
                ? 'speakers'
                : value === 'details'
                  ? 'speakers'
                  : 'details';
          document.getElementById(`${prefix}-${next}-tab`)?.focus();
        }}
      >
        <button
          {...tabProps('details')}
          data-action-id="agendas.context.details.select"
          data-action-kind="selection"
          onMouseDown={event => {
            if (event.button === 0 && !event.ctrlKey) onValueChange('details');
          }}
          onFocus={() => onValueChange('details')}
          onClick={() => onValueChange('details')}
        >
          {detailsLabel}
        </button>
        <button
          {...tabProps('speakers')}
          data-action-id="agendas.context.speakers.select"
          data-action-kind="selection"
          onMouseDown={event => {
            if (event.button === 0 && !event.ctrlKey) onValueChange('speakers');
          }}
          onFocus={() => onValueChange('speakers')}
          onClick={() => onValueChange('speakers')}
        >
          {speakersLabel}
        </button>
      </div>
      {panes.map(pane => (
        <div
          key={pane.value}
          role="tabpanel"
          id={`${prefix}-${pane.value}-panel`}
          aria-labelledby={`${prefix}-${pane.value}-tab`}
          tabIndex={0}
          hidden={value !== pane.value}
          data-state={value === pane.value ? 'active' : 'inactive'}
          className="ring-offset-background focus-visible:ring-ring mt-0 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {value === pane.value ? pane.content : null}
        </div>
      ))}
    </div>
  );
}

export const agendaDialogContentClassName = {
  standard:
    '!z-[140] gap-0 overflow-hidden rounded-xl p-0 sm:max-w-xl [&_[data-slot=dialog-header]]:px-5 [&_[data-slot=dialog-header]]:py-4 [&_[data-slot=dialog-footer]]:px-5 [&_[data-slot=dialog-footer]]:py-4',
  wide: '!z-[140] gap-0 overflow-hidden rounded-xl p-0 sm:max-w-3xl [&_[data-slot=dialog-header]]:px-5 [&_[data-slot=dialog-header]]:py-4 [&_[data-slot=dialog-footer]]:px-5 [&_[data-slot=dialog-footer]]:py-4',
  fullscreen:
    'bg-background !fixed !inset-0 !z-[100] flex h-dvh !h-[100dvh] max-h-none !max-h-[100dvh] w-screen !w-[100dvw] max-w-none !max-w-[100dvw] !translate-x-0 !translate-y-0 flex-col gap-0 !overflow-hidden rounded-none !rounded-none border-0 !border-0 p-0 !p-0 shadow-none',
} as const;

export function AgendaDialogContent({
  className,
  size = 'standard',
  ...props
}: ComponentProps<typeof ScrollableDialogContent> & {
  size?: keyof typeof agendaDialogContentClassName;
}) {
  return (
    <ScrollableDialogContent
      className={cn(agendaDialogContentClassName[size], className)}
      {...props}
    />
  );
}

export function AgendaDialogBody({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('space-y-4 overflow-y-auto px-5 py-5', className)} {...props} />;
}
