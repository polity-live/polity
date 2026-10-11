vi.mock('@rocicorp/zero/react', async importOriginal => {
  const { studioSnapshotFixture } = await import('@/test/studio-snapshot.fixture');
  return {
    ...(await importOriginal<typeof import('@rocicorp/zero/react')>()),
    useQuery: (q: any) => studioSnapshotFixture(q, io),
  };
});
vi.mock('@/zero/queries', async () => {
  const { studioQueryFixture } = await import('@/test/studio-client.fixture');
  return { queries: { studio: studioQueryFixture } };
});
import { forwardRef, useImperativeHandle } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createDocument } from '../../logic/templates';
import { legacyDocumentToV3 } from '../../logic/v3-adapter';
import { StudioProjectAccess } from '../StudioProjectAccess';
import '@/styles.css';
const io = vi.hoisted(() => ({
  user: { id: 'reader' } as { id: string } | null,
  fetch: vi.fn(),
  snapshot: {} as any,
  t: (key: string) => key,
  request: vi.fn(),
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: io.user }) }));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }) } }),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: io.t,
  useTranslation: () => ({ t: io.t }),
}));
vi.mock('@tanstack/react-router', async importOriginal => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useNavigate: () => vi.fn(),
}));
vi.mock('@/zero/communication-studio/useStudioClient', async () => {
  const { studioClientFixture } = await import('@/test/studio-client.fixture');
  return { useStudioClient: () => studioClientFixture(io) };
});
vi.mock('../KonvaStudioCanvas', () => ({
  default: forwardRef((props: any, ref) => {
    useImperativeHandle(ref, () => ({ execute: async () => undefined }), []);
    return <output aria-label="Active frame">{props.activeFrameId}</output>;
  }),
}));
vi.mock('../StudioWorkspace', () => ({ StudioWorkspace: () => null }));
vi.mock('@/features/project-chat/ui/ProjectChatPanel', () => ({ ProjectChatPanel: () => null }));
beforeEach(() => {
  vi.clearAllMocks();
  io.user = { id: 'reader' };
  io.snapshot = {
    project: { id: 'project', title: 'Reader project', groupId: null, canEdit: false },
    document: legacyDocumentToV3(createDocument('carousel', 'Reader')),
    assets: [],
  };
  io.fetch.mockResolvedValue(new Response(new Blob(['media'])));
  vi.stubGlobal('fetch', io.fetch);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const mount = () =>
  render(<StudioProjectAccess groupId={null} projectId="project" open={vi.fn()} />);
it('selects and restores reader frames with native keyboard input while retaining the pressed state and focus', async () => {
  mount();
  const first = page.getByRole('button', { name: '1', exact: true }),
    second = page.getByRole('button', { name: '2', exact: true });
  await expect.element(first).toHaveAttribute('aria-pressed', 'true');
  await expect.element(second).toHaveAttribute('aria-pressed', 'false');
  second.element().focus();
  await expect.element(second).toHaveFocus();
  await userEvent.keyboard('{Enter}');
  await expect.element(second).toHaveAttribute('aria-pressed', 'true');
  await expect.element(first).toHaveAttribute('aria-pressed', 'false');
  await expect.element(second).toHaveFocus();
  const frames = io.snapshot.document.nodes.filter((node: any) => node.type === 'frame');
  await expect
    .element(page.getByRole('status', { name: 'Active frame' }))
    .toHaveTextContent(frames[1].id);
  first.element().focus();
  await userEvent.keyboard(' ');
  await expect.element(first).toHaveAttribute('aria-pressed', 'true');
  await expect.element(first).toHaveFocus();
});
it.each(['cancel', 'escape'])(
  'opens the real clone dialog with the native keyboard and restores reader focus after %s',
  async exit => {
    mount();
    const trigger = page.getByRole('button', { name: 'features.studio.cloneProject', exact: true });
    await expect.element(trigger).toBeVisible();
    trigger.element().focus();
    await expect.element(trigger).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    const dialog = page.getByRole('dialog', { name: 'features.studio.cloneProject' });
    await expect.element(dialog).toBeVisible();
    if (exit === 'cancel') {
      const cancel = dialog.getByRole('button', { name: 'common.cancel' });
      cancel.element().focus();
      await expect.element(cancel).toHaveFocus();
      await userEvent.keyboard('{Enter}');
    } else await userEvent.keyboard('{Escape}');
    await expect.element(dialog).not.toBeInTheDocument();
    await expect.element(trigger).toHaveFocus();
    expect(io.request).not.toHaveBeenCalled();
  }
);
it('keeps public frame navigation available to guests while withholding cloning', async () => {
  io.user = null;
  mount();
  await expect.element(page.getByRole('heading', { name: 'Reader project' })).toBeVisible();
  await expect
    .element(page.getByRole('button', { name: 'features.studio.cloneProject' }))
    .not.toBeInTheDocument();
  const second = page.getByRole('button', { name: '2', exact: true });
  second.element().focus();
  await userEvent.keyboard('{Enter}');
  await expect.element(second).toHaveAttribute('aria-pressed', 'true');
});

it('closes a reader clone dialog safely if authentication disappears while it is open', async () => {
  const view = mount();
  const trigger = page.getByRole('button', { name: 'features.studio.cloneProject', exact: true });
  await expect.element(trigger).toBeVisible();
  trigger.element().focus();
  await userEvent.keyboard('{Enter}');
  const dialog = page.getByRole('dialog', { name: 'features.studio.cloneProject' });
  await expect.element(dialog).toBeVisible();
  io.user = null;
  view.rerender(<StudioProjectAccess groupId={null} projectId="project" open={vi.fn()} />);
  await expect.element(dialog).not.toBeInTheDocument();
  await expect.element(page.getByRole('heading', { name: 'Reader project' })).toBeVisible();
  await expect.element(trigger).not.toBeInTheDocument();
  expect(io.request).not.toHaveBeenCalled();
});
