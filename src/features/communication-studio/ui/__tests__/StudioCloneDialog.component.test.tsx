/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const io = vi.hoisted(() => ({
  navigate: vi.fn(),
  request: vi.fn(),
  translate: (key: string) => key,
}));
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => io.navigate }));
vi.mock('@rocicorp/zero/react', () => ({
  useQuery: () => [[{ id: 'group-1', name: 'Editor group' }]],
}));
vi.mock('@/zero/queries', () => ({ queries: { studio: { manageGroups: () => ({}) } } }));
vi.mock('@/zero/communication-studio/useStudioApi', () => ({ studioRequest: io.request }));
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
