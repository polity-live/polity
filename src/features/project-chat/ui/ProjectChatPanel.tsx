import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useQuery, useZero } from '@rocicorp/zero/react';
import { MessageSquare, Minus } from 'lucide-react';
import { queries } from '@/zero/queries';
import { mutators } from '@/zero/mutators';
import { serverConfirmed } from '@/zero/mutate-with-server-check';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { ProjectScope, EditorContext } from '../logic/contracts';
import { scopeKey } from '../hooks/editor-bridge';
import { ProjectConversation } from './ProjectConversation';

export function ProjectChatPanel({
  scope,
  context,
  conversationId,
  initialInstruction,
}: {
  scope: ProjectScope;
  context: EditorContext;
  conversationId?: string;
  initialInstruction?: string;
}) {
  const zero = useZero(),
    { t } = useTranslation(),
    tr = (key: string) => t(`features.projectChat.${key}`);
  const [conversations] = useQuery(queries.projectChat.conversations(scope));
  const [selected, setSelected] = useState(conversationId ?? ''),
    [open, setOpen] = useState(false),
    [error, setError] = useState(''),
    [creating, setCreating] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const restoreTriggerFocus = useRef(false);
  const key = scopeKey(scope);
  useEffect(() => {
    setSelected(conversationId ?? localStorage.getItem(`project-chat:${key}`) ?? '');
  }, [key, conversationId]);
  useEffect(() => {
    if (!open && restoreTriggerFocus.current) {
      restoreTriggerFocus.current = false;
      triggerRef.current?.focus();
    }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      restoreTriggerFocus.current = true;
      setOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);
  const current = conversations.find(c => c.id === selected)?.id ?? conversations[0]?.id;
  const choose = (id: string) => {
    setSelected(id);
    localStorage.setItem(`project-chat:${key}`, id);
  };
  async function create() {
    setCreating(true);
    setError('');
    try {
      const id = crypto.randomUUID();
      await serverConfirmed(
        zero.mutate(
          mutators.projectChat.create({
            id,
            scope,
            name: `${tr('title')} ${conversations.length + 1}`,
          })
        )
      );
      choose(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('failed'));
    } finally {
      setCreating(false);
    }
  }
  const minimize = () => {
    restoreTriggerFocus.current = true;
    setOpen(false);
  };
  return (
    <div
      className="fixed right-[calc(max(var(--app-shell-desktop-right-offset,0rem),var(--app-shell-chat-dock-right-offset,0rem))+1rem)] bottom-[calc(max(var(--app-shell-mobile-bottom-offset,0rem),var(--app-shell-chat-dock-bottom-offset,0rem))+env(safe-area-inset-bottom,0px)+0.5rem)] z-30"
      data-project-chat-dock
    >
      <button
        ref={triggerRef}
        type="button"
        className="bg-background hover:bg-muted flex h-11 min-w-44 items-center gap-2 rounded-t-lg border px-4 text-sm font-medium shadow-lg"
        aria-controls={panelId}
        aria-expanded={open}
        hidden={open}
        data-action-id="project-chat.dock.open"
        onClick={() => setOpen(true)}
      >
        <MessageSquare className="size-4" aria-hidden="true" />
        <span>{tr('title')}</span>
      </button>
      <section
        id={panelId}
        role="dialog"
        aria-modal="false"
        aria-label={tr('title')}
        aria-hidden={!open}
        hidden={!open}
        inert={!open ? true : undefined}
        className="bg-background flex h-[min(72dvh,42rem)] max-h-[calc(100dvh-var(--app-shell-mobile-top-offset,0rem)-var(--app-shell-mobile-bottom-offset,0rem)-1rem)] min-h-0 w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-t-xl border shadow-2xl md:h-[min(70dvh,42rem)] md:w-[25rem] md:rounded-t-lg"
      >
        <header className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
          <MessageSquare className="size-4" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{tr('title')}</span>
          <button
            type="button"
            className="hover:bg-muted rounded p-1.5"
            aria-label={tr('minimize')}
            data-action-id="project-chat.dock.minimize"
            onClick={minimize}
          >
            <Minus className="size-4" aria-hidden="true" />
          </button>
        </header>
        <div className="flex shrink-0 gap-2 p-2">
          <select
            aria-label={tr('choose')}
            value={current ?? ''}
            onChange={e => choose(e.target.value)}
            className="bg-background min-w-0 flex-1 rounded border p-1 text-sm"
          >
            <option value="" disabled>
              {tr('choose')}
            </option>
            {conversations.map((c: { id: string; name?: string | null }) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="rounded border px-2 text-sm"
            disabled={creating}
            data-action-id="project-chat.conversation.create"
            onClick={() => void create()}
          >
            {tr('new')}
          </button>
        </div>
        {error && (
          <p role="alert" className="text-destructive p-2 text-sm">
            {error}
          </p>
        )}
        <div className="min-h-0 flex-1">
          {current ? (
            <ProjectConversation
              key={current}
              conversationId={current}
              context={context}
              initialInstruction={initialInstruction}
              compact
              active={open}
            />
          ) : (
            <div className="p-4 text-sm">
              <p>{tr('empty')}</p>
              <button
                type="button"
                className="mt-3 rounded border p-2"
                disabled={creating}
                data-action-id="project-chat.conversation.start"
                onClick={() => void create()}
              >
                {tr('start')}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export function ProjectChatWorkspace({
  children,
  ...props
}: Parameters<typeof ProjectChatPanel>[0] & { children: ReactNode }) {
  return (
    <>
      {children}
      <ProjectChatPanel {...props} />
    </>
  );
}
