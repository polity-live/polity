import { createContext, useContext, useRef, type ReactNode } from 'react';
import { useNavigate, useRouter, useRouterState } from '@tanstack/react-router';
import { useQuery } from '@rocicorp/zero/react';
import { Eye } from 'lucide-react';
import { queries } from '@/zero/queries';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { SmartLink } from '../navigation/SmartLink';
import { FavoriteButton } from '../navigation/FavoriteButton';
import { PreviewSearchDetails } from './PreviewSearchDetails';
import {
  previewHref,
  previewTargetFromHash,
  previewTargetFromHref,
  type PreviewTarget,
} from './preview-target';

interface PreviewContextValue {
  openPreview: (target: PreviewTarget) => void;
}
const PreviewContext = createContext<PreviewContextValue | null>(null);
export const workspacePreviewClassName =
  'top-0 left-auto right-0 h-dvh max-h-dvh w-full max-w-full translate-x-0 translate-y-0 rounded-none sm:w-[min(36rem,90vw)] sm:max-w-none overflow-y-auto content-start';

export function useWorkspacePreview() {
  return useContext(PreviewContext);
}

function textContent(value: unknown): string {
  if (typeof value === 'string') {
    if (value.trim().startsWith('[') || value.trim().startsWith('{')) {
      try {
        return textContent(JSON.parse(value));
      } catch {
        /* Plain text may begin with a bracket. */
      }
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(textContent).join('\n');
  if (value && typeof value === 'object') {
    const node = value as { text?: unknown; children?: unknown };
    return textContent(node.text ?? node.children);
  }
  return '';
}

function PreviewBody({
  target,
  title,
  description,
  loading,
  available,
  metadata,
}: {
  target: PreviewTarget;
  title?: string | null;
  description?: unknown;
  loading: boolean;
  available: boolean;
  metadata?: ReactNode;
}) {
  const { t } = useTranslation();
  const displayTitle = title || t(`common.entities.${target.kind}`);
  return (
    <>
      <DialogTitle className="pr-8 font-sans text-xl font-semibold">{displayTitle}</DialogTitle>
      <DialogDescription className="sr-only">{t('common.workspace.preview')}</DialogDescription>
      {loading ? (
        <p role="status">{t('common.workspace.loading')}</p>
      ) : !available ? (
        <p role="status">{t('common.workspace.unavailable')}</p>
      ) : (
        <>
          <div className="border-border/60 flex items-center gap-2 border-b pb-3">
            <Button asChild size="sm" data-action-id="workspace.preview.open-page">
              <SmartLink href={previewHref(target)} data-action-id="workspace.preview.open-page">
                {t('common.workspace.openPage')}
              </SmartLink>
            </Button>
            {target.kind !== 'todo' ? (
              <FavoriteButton
                favorite={{ kind: target.kind, href: previewHref(target), title: displayTitle }}
              />
            ) : null}
          </div>
          {metadata}
          <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
            {textContent(description)}
          </p>
          <PreviewSearchDetails target={target} />
        </>
      )}
    </>
  );
}

function AmendmentPreview({ target }: { target: PreviewTarget }) {
  const [row, result] = useQuery(queries.amendments.byId({ id: target.id }));
  return (
    <PreviewBody
      target={target}
      title={row?.title}
      description={row?.preamble || row?.reason}
      loading={result.type === 'unknown'}
      available={Boolean(row)}
      metadata={
        row ? (
          <div className="text-muted-foreground flex flex-wrap gap-3 text-xs">
            <span>{row.code}</span>
          </div>
        ) : null
      }
    />
  );
}

function EventPreview({ target }: { target: PreviewTarget }) {
  const [row, result] = useQuery(queries.events.byId({ id: target.id }));
  const { language } = useTranslation();
  return (
    <PreviewBody
      target={target}
      title={row?.title}
      description={row?.description}
      loading={result.type === 'unknown'}
      available={Boolean(row)}
      metadata={
        row ? (
          <div className="text-muted-foreground space-y-1 text-sm">
            {row.start_date ? (
              <p>
                {new Intl.DateTimeFormat(language, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(row.start_date)}
              </p>
            ) : null}
            {row.end_date ? (
              <p>
                –{' '}
                {new Intl.DateTimeFormat(language, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(row.end_date)}
              </p>
            ) : null}
            <p>
              {[row.location_name, row.street, row.house_number, row.city]
                .filter(Boolean)
                .join(', ')}
            </p>
          </div>
        ) : null
      }
    />
  );
}

function TodoPreview({ target }: { target: PreviewTarget }) {
  const [row, result] = useQuery(queries.todos.byIdWithRelations({ id: target.id }));
  const { t, language } = useTranslation();
  return (
    <PreviewBody
      target={target}
      title={row?.title}
      description={row?.description}
      loading={result.type === 'unknown'}
      available={Boolean(row)}
      metadata={
        row ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">{t('features.todos.detail.status')}</dt>
            <dd>{t(`features.todos.status.${row.status}`)}</dd>
            <dt className="text-muted-foreground">{t('features.todos.assignee.title')}</dt>
            <dd>
              {row.assignments
                ?.map(assignment =>
                  [assignment.user?.first_name, assignment.user?.last_name]
                    .filter(Boolean)
                    .join(' ')
                )
                .filter(Boolean)
                .join(', ') || t('features.todos.assignee.unassigned')}
            </dd>
            {row.due_date ? (
              <>
                <dt className="text-muted-foreground">{t('features.todos.dueDate.title')}</dt>
                <dd>{new Date(row.due_date).toLocaleString(language)}</dd>
              </>
            ) : null}
            {row.group?.name ? (
              <>
                <dt className="text-muted-foreground">{t('features.todos.group.title')}</dt>
                <dd>{row.group.name}</dd>
              </>
            ) : null}
          </dl>
        ) : null
      }
    />
  );
}

export function WorkspacePreviewProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const router = useRouter();
  const location = useRouterState({ select: state => state.location });
  const triggerRef = useRef<HTMLElement | null>(null);
  const pushedFrom = useRef<string | null>(null);
  const target = previewTargetFromHash(location.hash);
  const openPreview = (next: PreviewTarget) => {
    triggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!target) pushedFrom.current = location.pathname;
    void navigate({
      to: '.',
      search: true,
      hash: `preview=${next.kind}:${next.id}`,
      resetScroll: false,
      replace: Boolean(target),
    });
  };
  const closePreview = () => {
    if (pushedFrom.current === location.pathname) {
      pushedFrom.current = null;
      router.history.back();
    } else {
      void navigate({ to: '.', search: true, hash: '', replace: true, resetScroll: false });
    }
  };
  return (
    <PreviewContext.Provider value={{ openPreview }}>
      {children}
      <Dialog
        open={Boolean(target)}
        onOpenChange={open => {
          if (!open) closePreview();
        }}
      >
        {target ? (
          <DialogContent
            data-workspace-preview
            className={workspacePreviewClassName}
            onCloseAutoFocus={event => {
              event.preventDefault();
              if (triggerRef.current?.isConnected)
                triggerRef.current.focus({ preventScroll: true });
            }}
          >
            {target.kind === 'amendment' ? (
              <AmendmentPreview key={target.id} target={target} />
            ) : target.kind === 'event' ? (
              <EventPreview key={target.id} target={target} />
            ) : (
              <TodoPreview key={target.id} target={target} />
            )}
          </DialogContent>
        ) : null}
      </Dialog>
    </PreviewContext.Provider>
  );
}

export function PreviewButton({ href, className }: { href: string; className?: string }) {
  const preview = useWorkspacePreview();
  const target = previewTargetFromHref(href);
  const { t } = useTranslation();
  if (!preview || !target) return null;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={className}
      aria-keyshortcuts="Space"
      data-workspace-preview-button
      data-action-id="workspace.preview.open"
      aria-label={t('common.workspace.preview')}
      title={`${t('common.workspace.preview')} · ${t('common.workspace.previewHint')}`}
      onClick={event => {
        event.preventDefault();
        event.stopPropagation();
        preview.openPreview(target);
      }}
    >
      <Eye className="size-4" />
    </Button>
  );
}
