import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useQuery, useZero } from '@rocicorp/zero/react';
import { MessageSquare, MessageSquarePlus, Minus } from 'lucide-react';
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
  initiallyOpen = false,
}: {
  scope: ProjectScope;
  context: EditorContext;
  conversationId?: string;
  initialInstruction?: string;
  initiallyOpen?: boolean;
}) {
  const zero = useZero(),
    { t } = useTranslation(),
    tr = (key: string) => t(`features.projectChat.${key}`);
  const [conversations, conversationsResult] = useQuery(queries.projectChat.conversations(scope));
  const [selected, setSelected] = useState(conversationId ?? ''),
    [open, setOpen] = useState(initiallyOpen),
    [error, setError] = useState(''),
    [creating, setCreating] = useState(false);
  const panelId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const [size, setSize] = useState<{ width: number; height: number }>();
  const drag = useRef<{
    pointerId: number;
    x: number;
    y: number;
    width: number;
    height: number;
    direction: 'width' | 'height' | 'both';
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const restoreTriggerFocus = useRef(false);
  const autoCreateAttempt = useRef('');
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
    if (conversations.length === 0) autoCreateAttempt.current = key;
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
  useEffect(() => {
    if (conversations.length > 0) {
      if (autoCreateAttempt.current === key) autoCreateAttempt.current = '';
      return;
    }
    if (
      !open ||
      conversationsResult.type !== 'complete' ||
      creating ||
      autoCreateAttempt.current === key
    ) {
      return;
    }
    autoCreateAttempt.current = key;
    void create();
  }, [open, conversationsResult.type, conversations.length, creating, key]);
  const minimize = () => {
    restoreTriggerFocus.current = true;
    setOpen(false);
  };
  const resize = (width: number, height: number) => {
    const panel = panelRef.current;
    if (!panel) return;
    const bounds = panel.getBoundingClientRect();
    const maxWidth = Math.max(0, bounds.right - 16);
    const maxHeight = Math.max(
      0,
      Math.min(bounds.bottom - 8, parseFloat(getComputedStyle(panel).maxHeight) || Infinity)
    );
    setSize({
      width: Math.min(maxWidth, Math.max(280, width)),
      height: Math.min(maxHeight, Math.max(320, height)),
    });
  };
  const startResize = (
    event: PointerEvent<HTMLButtonElement>,
    direction: 'width' | 'height' | 'both'
  ) => {
    if (event.button !== 0 || !panelRef.current) return;
    event.preventDefault();
    const bounds = panelRef.current.getBoundingClientRect();
    drag.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      width: bounds.width,
      height: bounds.height,
      direction,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveResize = (event: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    resize(
      current.width + (current.direction !== 'height' ? current.x - event.clientX : 0),
      current.height + (current.direction !== 'width' ? current.y - event.clientY : 0)
    );
  };
  const endResize = (event: PointerEvent<HTMLButtonElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  const keyboardResize = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    direction: 'width' | 'height' | 'both'
  ) => {
    const bounds = panelRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const step = event.shiftKey ? 40 : 10;
    const dx =
      direction === 'height'
        ? undefined
        : event.key === 'ArrowLeft'
          ? step
          : event.key === 'ArrowRight'
            ? -step
            : undefined;
    const dy =
      direction === 'width'
        ? undefined
        : event.key === 'ArrowUp'
          ? step
          : event.key === 'ArrowDown'
            ? -step
            : undefined;
    if (dx === undefined && dy === undefined) return;
    event.preventDefault();
    resize(bounds.width + (dx ?? 0), bounds.height + (dy ?? 0));
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
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-modal="false"
        aria-label={tr('title')}
        aria-hidden={!open}
        hidden={!open}
        inert={!open ? true : undefined}
        style={size ? { width: size.width, height: size.height } : undefined}
        className="bg-background relative flex h-[min(72dvh,42rem)] max-h-[calc(100dvh-var(--app-shell-mobile-top-offset,0rem)-max(var(--app-shell-mobile-bottom-offset,0rem),var(--app-shell-chat-dock-bottom-offset,0rem))-env(safe-area-inset-bottom,0px)-1rem)] min-h-0 w-[calc(100vw-2rem)] max-w-[calc(100vw-max(var(--app-shell-desktop-right-offset,0rem),var(--app-shell-chat-dock-right-offset,0rem))-2rem)] flex-col overflow-hidden rounded-t-xl border shadow-2xl md:h-[min(70dvh,42rem)] md:w-[25rem] md:rounded-t-lg"
      >
        {(['width', 'height', 'both'] as const).map(direction => (
          <button
            key={direction}
            type="button"
            aria-label={tr(
              direction === 'both'
                ? 'resize'
                : direction === 'width'
                  ? 'resizeWidth'
                  : 'resizeHeight'
            )}
            className={`focus-visible:bg-primary/20 hover:bg-primary/10 absolute z-10 touch-none select-none ${
              direction === 'width'
                ? 'top-3 bottom-0 left-0 w-1.5 cursor-ew-resize'
                : direction === 'height'
                  ? 'top-0 right-0 left-3 h-1.5 cursor-ns-resize'
                  : 'top-0 left-0 size-3 cursor-nwse-resize'
            }`}
            onPointerDown={event => startResize(event, direction)}
            onPointerMove={moveResize}
            onPointerUp={endResize}
            onPointerCancel={endResize}
            onLostPointerCapture={() => {
              drag.current = null;
            }}
            onKeyDown={event => keyboardResize(event, direction)}
          />
        ))}
        <header className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
          <MessageSquare className="size-4" aria-hidden="true" />
          <select
            aria-label={tr('choose')}
            value={current ?? ''}
            onChange={e => choose(e.target.value)}
            className="bg-background min-w-0 flex-1 rounded border px-2 py-1 text-sm"
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
            className="hover:bg-muted rounded p-1.5"
            aria-label={tr('new')}
            disabled={creating || conversationsResult.type === 'unknown'}
            data-action-id="project-chat.conversation.create"
            onClick={() => void create()}
          >
            <MessageSquarePlus className="size-4" aria-hidden="true" />
          </button>
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
              <p role="status">
                {creating || conversationsResult.type === 'unknown'
                  ? tr('unavailable')
                  : tr('empty')}
              </p>
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
