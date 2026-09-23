import { useEffect, useRef } from 'react';
import type { useStudioController } from './useStudioController';
import type { StudioEditorRequest } from '../logic/editor-commands';
import type { StudioElement } from '../logic/document';
import { studioRequest } from '@/zero/communication-studio/useStudioApi';
export function useStudioEditorTools(c: ReturnType<typeof useStudioController>) {
  const latest = useRef(c);
  latest.current = c;
  const clipboard = useRef<StudioElement[]>([]);
  useEffect(() => {
    if (!c.id || c.workspaceId) return;
    const projectId = c.id;
    const clientId = sessionStorage.getItem('studio-editor-client') ?? crypto.randomUUID();
    sessionStorage.setItem('studio-editor-client', clientId);
    let disposed = false,
      running = false;
    const poll = async () => {
      if (running || disposed || !navigator.onLine) return;
      running = true;
      try {
        const actions = await studioRequest<StudioEditorRequest[]>('editorActions', {
          projectId,
          clientId,
        });
        for (const action of actions) {
          if (disposed) return;
          const c = latest.current,
            key = `studio-ui:${action.id}`;
          let result = JSON.parse(sessionStorage.getItem(key) || 'null');
          if (!result) {
            // A reload after an ambiguous interruption must never execute the action twice.
            sessionStorage.setItem(
              key,
              JSON.stringify({
                status: 'failed',
                error:
                  'Editor interrupted; inspect the current state before requesting a new action.',
              })
            );
            try {
              const a = action.input as {
                pageId?: string;
                elementIds?: string[];
                playing?: boolean;
                visible?: boolean;
                panel?: string;
              };
              if (!c.value) continue;
              switch (action.name) {
                case 'studio_select_page':
                case 'studio_select_elements':
                  if (!c.value.pages.some(p => p.id === a.pageId))
                    throw new Error('Page no longer exists');
                  if (
                    a.elementIds?.some(
                      id =>
                        !c.value?.pages
                          .find(p => p.id === a.pageId)
                          ?.elements.some(e => e.id === id)
                    )
                  )
                    throw new Error('Element no longer exists');
                  c.setPageId(a.pageId ?? '');
                  c.select(a.elementIds ?? []);
                  break;
                case 'studio_preview':
                  window.dispatchEvent(
                    new CustomEvent('studio-preview', { detail: { open: !!a.playing } })
                  );
                  break;
                case 'studio_guides':
                  c.setGuides(!!a.visible);
                  break;
                case 'studio_copy_selection':
                  clipboard.current = structuredClone(
                    c.page?.elements.filter(e => c.selected.includes(e.id)) ?? []
                  );
                  break;
                case 'studio_paste_selection':
                  if (!c.canEdit) throw new Error('Read only');
                  if (!clipboard.current.length) throw new Error('Copy a selection first');
                  c.transact(d => {
                    const p = d.pages.find(p => p.id === c.page?.id);
                    if (!p) throw new Error('Page no longer exists');
                    p.elements.push(
                      ...clipboard.current.map((e, i) => ({
                        ...e,
                        id: crypto.randomUUID(),
                        group: null,
                        order: p.elements.length + i,
                        x: e.x + 30,
                        y: e.y + 30,
                      }))
                    );
                  });
                  break;
                case 'studio_undo_local':
                  if (!c.canEdit || !c.canUndo) throw new Error('Nothing available to undo');
                  if (!c.undo()) throw new Error('Undo conflicts with a later edit');
                  break;
                case 'studio_redo_local':
                  if (!c.canEdit || !c.canRedo) throw new Error('Nothing available to redo');
                  if (!c.redo()) throw new Error('Redo conflicts with a later edit');
                  break;
                case 'studio_copy_project':
                  await c.commit();
                  {
                    const copy = await studioRequest<{ id: string }>('duplicate', {
                      id: projectId,
                    });
                    result = { status: 'completed', projectId: copy.id };
                  }
                  break;
                case 'studio_save_template':
                  await c.commit();
                  await studioRequest('template', { id: projectId, value: true });
                  break;
                case 'studio_open_panel':
                  window.dispatchEvent(new CustomEvent('studio-open-panel', { detail: a.panel }));
                  break;
              }
              // Allow React to render the requested view before acknowledging it.
              await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
              const revision = await latest.current.commit();
              result ??= { status: 'completed', revision };
            } catch (e) {
              result = { status: 'failed', error: e instanceof Error ? e.message : String(e) };
            }
            sessionStorage.setItem(key, JSON.stringify(result));
          }
          await studioRequest('editorResult', { projectId, clientId, id: action.id, result });
        }
      } catch {
        /* Poll again after reconnection. */
      } finally {
        running = false;
      }
    };
    const timer = setInterval(() => void poll(), 1000);
    void poll();
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [c.id, c.workspaceId]);
}
