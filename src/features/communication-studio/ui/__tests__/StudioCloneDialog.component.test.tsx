/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const io = vi.hoisted(() => ({
  navigate: vi.fn(),
  request: vi.fn(),
  translate: (key: string) => key,
  groups: [{ id: 'group-1', name: 'Editor group' }] as { id: string; name: string }[] | undefined,
}));
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => io.navigate }));
vi.mock('@rocicorp/zero/react', () => ({
  useQuery: () => [io.groups],
}));
vi.mock('@/zero/queries', () => ({ queries: { studio: { manageGroups: () => ({}) } } }));
vi.mock('@/zero/communication-studio/useStudioClient', async () => {
  const { studioClientFixture } = await import('@/test/studio-client.fixture');
  return { useStudioClient: () => studioClientFixture(io) };
});
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: io.translate }),
  translate: io.translate,
}));
vi.mock('@/features/create/ui/inputs/VisibilityInput', () => ({
  VisibilityInput: ({ value, onChange }: any) => (
    <select aria-label="Visibility" value={value} onChange={event => onChange(event.target.value)}>
      <option value="private">Private</option>
      <option value="public">Public</option>
      <option value="authenticated">Authenticated</option>
    </select>
  ),
}));

import { StudioCloneDialog } from '../StudioCloneDialog';

beforeEach(() => {
  io.groups = [{ id: 'group-1', name: 'Editor group' }];
  io.navigate.mockResolvedValue(undefined);
  io.request.mockResolvedValue({ id: 'copy-1' });
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it('clones into the personal studio as private by default', async () => {
  const beforeClone = vi.fn().mockResolvedValue(undefined);
  render(
    <StudioCloneDialog sourceId="source" open onOpenChange={vi.fn()} beforeClone={beforeClone} />
  );
  fireEvent.click(screen.getByRole('button', { name: 'features.studio.cloneProject' }));
  await waitFor(() =>
    expect(io.request).toHaveBeenCalledWith('duplicate', {
      id: 'source',
      groupId: null,
      visibility: 'private',
    })
  );
  expect(beforeClone).toHaveBeenCalledOnce();
  expect(io.navigate).toHaveBeenCalledWith({
    to: '/studio/$projectId',
    params: { projectId: 'copy-1' },
  });
});

it('clones into a manageable group with selected visibility', async () => {
  render(<StudioCloneDialog sourceId="source" open onOpenChange={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('features.studio.cloneDestination'), {
    target: { value: 'group-1' },
  });
  fireEvent.change(screen.getByLabelText('Visibility'), { target: { value: 'public' } });
  fireEvent.click(screen.getByRole('button', { name: 'features.studio.cloneProject' }));
  await waitFor(() =>
    expect(io.request).toHaveBeenCalledWith('duplicate', {
      id: 'source',
      groupId: 'group-1',
      visibility: 'public',
    })
  );
  expect(io.navigate).toHaveBeenCalledWith({
    to: '/group/$id/studio/$projectId',
    params: { id: 'group-1', projectId: 'copy-1' },
  });
});

it('preserves the dialog and shows a copy error', async () => {
  io.request.mockRejectedValue(new Error('Cannot copy media'));
  const onOpenChange = vi.fn();
  render(<StudioCloneDialog sourceId="source" open onOpenChange={onOpenChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'features.studio.cloneProject' }));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Cannot copy media');
  expect(onOpenChange).not.toHaveBeenCalled();
  expect(io.navigate).not.toHaveBeenCalled();
});
it('selects and clears a destination with native focus and keeps the private default without manageable groups', async () => {
  const view = render(<StudioCloneDialog sourceId="source" open onOpenChange={vi.fn()} />);
  const user = userEvent.setup();
  const destination = screen.getByLabelText('features.studio.cloneDestination');
  destination.focus();
  expect(document.activeElement).toBe(destination);
  await user.keyboard('{Enter}');
  expect(document.activeElement).toBe(destination);
  expect(destination).toHaveProperty('value', '');
  await user.selectOptions(destination, 'group-1');
  expect(destination).toHaveProperty('value', 'group-1');
  await user.selectOptions(destination, '');
  expect(destination).toHaveProperty('value', '');
  io.groups = undefined;
  view.rerender(<StudioCloneDialog sourceId="source" open onOpenChange={vi.fn()} />);
  expect(
    screen.getAllByRole('option').filter(option => option.textContent === 'Editor group')
  ).toHaveLength(0);
  expect(destination).toHaveProperty('value', '');
});
it('clones by keyboard, prevents repeat submission and cancellation while awaiting confirmation, then closes and navigates', async () => {
  let resolve!: (value: unknown) => void;
  io.request.mockReturnValue(
    new Promise(complete => {
      resolve = complete;
    })
  );
  const close = vi.fn();
  render(<StudioCloneDialog sourceId="source" open onOpenChange={close} />);
  const submit = screen.getByRole('button', { name: 'features.studio.cloneProject' });
  const cancel = screen.getByRole('button', { name: 'common.cancel' });
  const user = userEvent.setup();
  expect(submit).toHaveProperty('disabled', false);
  submit.focus();
  expect(document.activeElement).toBe(submit);
  await user.keyboard('{Enter}');
  expect(submit).toHaveProperty('disabled', true);
  expect(cancel).toHaveProperty('disabled', true);
  await user.click(submit);
  await user.click(cancel);
  expect(io.request).toHaveBeenCalledOnce();
  expect(close).not.toHaveBeenCalled();
  await act(async () => resolve({ id: 'copy-1' }));
  expect(close).toHaveBeenCalledWith(false);
  expect(io.navigate).toHaveBeenCalledWith({
    to: '/studio/$projectId',
    params: { projectId: 'copy-1' },
  });
});
it.each([new Error('Authentication required'), 'unrecognized failure'])(
  'retains a failed clone for keyboard cancellation when the server rejects %s',
  async reason => {
    io.request.mockRejectedValueOnce(reason);
    const close = vi.fn();
    render(<StudioCloneDialog sourceId="source" open onOpenChange={close} />);
    const user = userEvent.setup();
    const submit = screen.getByRole('button', { name: 'features.studio.cloneProject' });
    submit.focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      reason instanceof Error ? reason.message : 'features.studio.cloneFailed'
    );
    expect(submit).toHaveProperty('disabled', false);
    expect(io.navigate).not.toHaveBeenCalled();
    const cancel = screen.getByRole('button', { name: 'common.cancel' });
    expect(cancel).toHaveProperty('disabled', false);
    cancel.focus();
    expect(document.activeElement).toBe(cancel);
    await user.keyboard(' ');
    expect(close).toHaveBeenCalledWith(false);
  }
);
