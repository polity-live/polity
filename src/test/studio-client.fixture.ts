import { vi } from 'vitest';
import { useEffect, useState } from 'react';

const listeners = new WeakMap<object, Set<(name: string, input: any) => void>>();
export const studioQueryFixture = new Proxy(
  {},
  { get: (_target, name) => (args: unknown) => ({ name, args }) }
);
export function useStudioQueryFixture(query: any, io: { request: (...args: any[]) => any }) {
  const [result, setResult] = useState<any>([[], { type: 'unknown' }]);
  const key = JSON.stringify(query);
  useEffect(() => {
    let live = true;
    const update = async () => {
      setResult([[], { type: 'unknown' }]);
      try {
        const raw = query
          ? await io.request(
              query.name === 'invitations' ? 'myInvitations' : query.name,
              query.args
            )
          : [];
        const rows = raw.map((r: any) =>
          query?.name === 'invitations'
            ? { ...r, project: { title: r.title, owner_id: r.owner_id, owner: r } }
            : { ...r, user: r }
        );
        if (live) setResult([rows, { type: 'complete' }]);
      } catch (error) {
        if (live)
          setResult([
            [],
            {
              type: 'error',
              error: { message: error instanceof Error ? error.message : String(error) },
            },
          ]);
      }
    };
    void update();
    const changed = (name: string, input: any) => {
      if (query?.name === 'invitations' && name === 'respondInvitation')
        setResult(([rows, status]: any) => [
          rows.filter((r: any) => r.id !== input.invitationId),
          status,
        ]);
      else if (
        query?.name === 'collaborators' &&
        ['inviteCollaborators', 'removeCollaborator'].includes(name)
      )
        void update();
    };
    let attached = listeners.get(io);
    if (!attached) {
      attached = new Set();
      listeners.set(io, attached);
    }
    attached.add(changed);
    return () => {
      live = false;
      attached.delete(changed);
    };
  }, [key, io]);
  return result;
}

// Preserve existing domain scenario assertions while mocking the typed client boundary.
const clients = new WeakMap<object, Record<string, any>>();
export function studioClientFixture(io: {
  request: (...args: any[]) => any;
  upload?: unknown;
  notifyError?: unknown;
}) {
  const existing = clients.get(io);
  if (existing) return existing;
  const names = {
    create: 'create',
    duplicate: 'duplicate',
    setVisibility: 'visibility',
    setTemplate: 'template',
    delete: 'delete',
    inviteCollaborators: 'inviteCollaborators',
    respondInvitation: 'respondInvitation',
    removeCollaborator: 'removeCollaborator',
    beginUpload: 'beginUpload',
    finishUpload: 'finishUpload',
    cancelUpload: 'cancelUpload',
    requestExport: 'export',
    cancelExport: 'cancel',
    createElementSet: 'elementSetCreate',
    instantiateElementSet: 'elementSetInstantiate',
    renameElementSet: 'elementSetRename',
    archiveElementSet: 'elementSetArchive',
    publishElementSet: 'elementSetPublish',
    synchronizeElements: 'synchronizeElements',
    claimEditorActions: 'editorActions',
    completeEditorAction: 'editorResult',
    operation: 'receipt',
    assets: 'assets',
    themes: 'themes',
    elementSets: 'elementSets',
    collaborators: 'collaborators',
    invitations: 'myInvitations',
    exportStatus: 'exportStatus',
    handoff: 'handoff',
    load: 'load',
  };
  const client: Record<string, any> = Object.fromEntries(
    Object.entries(names).map(([name, op]) => [
      name,
      async (input: unknown) => {
        const result = await io.request(op, input);
        listeners.get(io)?.forEach(listener => listener(name, input));
        return result;
      },
    ])
  );
  Object.assign(client, {
    upload: io.upload ?? vi.fn(),
    notifyError: io.notifyError ?? vi.fn(),
    canvas: (input: unknown) => io.request('canvas', input),
    session: (input: object) => io.request('canvas', { action: 'session', ...input }),
    loadDraft: (input: object) => io.request('canvas', { action: 'loadDraft', ...input }),
    libraries: (input: object) => io.request('canvas', { action: 'libraries', ...input }),
    watchSession: (
      input: object,
      next: (value: unknown) => void,
      fail: (error: unknown) => void
    ) => {
      let live = true;
      const refresh = () =>
        Promise.resolve(client.session(input)).then(
          value => {
            if (live && value?.proposals) next(value);
          },
          error => {
            if (live) fail(error);
          }
        );
      void refresh();
      window.addEventListener('online', refresh);
      return () => {
        live = false;
        window.removeEventListener('online', refresh);
      };
    },
    watchEditorActions: (_input: unknown, changed: () => void) => {
      queueMicrotask(changed);
      return () => undefined;
    },
    watchAssets: () => () => undefined,
  });
  clients.set(io, client);
  return client;
}
