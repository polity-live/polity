/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useCreateStudioProjectForm } from '../useCreateStudioProjectForm';

const io = vi.hoisted(() => ({
  request: vi.fn(),
  navigate: vi.fn(),
  chatCreate: vi.fn(),
  confirm: vi.fn(),
  projects: [] as { id: string; title: string; is_template: boolean }[],
}));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => io.navigate }));
vi.mock('@rocicorp/zero/react', () => ({ useZero: () => ({ mutate: io.chatCreate }) }));
vi.mock('@/zero/mutators', () => ({
  mutators: { projectChat: { create: (value: unknown) => value } },
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  serverConfirmed: (value: unknown) => io.confirm(value),
}));
vi.mock('@/zero/communication-studio/useStudioApi', () => ({
  useStudioApi: () => ({ request: io.request }),
}));
vi.mock('@/zero/communication-studio/useStudioState', () => ({
  useStudioState: () => ({ projects: io.projects }),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));

beforeEach(() => {
  io.request.mockImplementation(async (operation: string) =>
    operation === 'create' ? { id: 'new-project' } : []
  );
  io.navigate.mockResolvedValue(undefined);
  io.chatCreate.mockReturnValue({ server: Promise.resolve({ type: 'success' }) });
  io.confirm.mockResolvedValue(undefined);
  io.projects = [];
  sessionStorage.clear();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function field(result: { current: ReturnType<typeof useCreateStudioProjectForm> }, key: string) {
  return result.current.steps.flatMap(step => step.fields ?? []).find(item => item.key === key);
}

it('validates the title and opens a confirmed personal project', async () => {
  const { result } = renderHook(() => useCreateStudioProjectForm(null));
  expect(result.current.steps[0].isValid()).toBe(false);
  const title = field(result, 'title');
  if (title?.kind !== 'text') throw new Error('Missing title');
  act(() => title.onValueChange('  My Studio project  '));
  expect(result.current.steps[0].isValid()).toBe(true);

  let outcome: Awaited<ReturnType<typeof result.current.onSubmit>> | undefined;
  await act(async () => {
    outcome = await result.current.onSubmit();
  });
  expect(io.request).toHaveBeenCalledWith(
    'create',
    expect.objectContaining({
      groupId: null,
      title: 'My Studio project',
      kind: 'single',
      template: { kind: 'builtin', id: 'announcement' },
    })
  );
  expect(io.navigate).toHaveBeenCalledWith({
    to: '/studio/$projectId',
    params: { projectId: 'new-project' },
  });
  expect(outcome).toMatchObject({ status: 'success', target: { to: '/studio/$projectId' } });
});

it('preserves group context, project template, theme and campaign settings', async () => {
  io.projects = [{ id: 'source-project', title: 'Shared template', is_template: true }];
  const { result } = renderHook(() => useCreateStudioProjectForm('group-1'));
  const title = field(result, 'title');
  if (title?.kind !== 'text') throw new Error('Missing title');
  act(() => title.onValueChange('Campaign'));
  const kind = field(result, 'kind');
  if (kind?.kind !== 'custom') throw new Error('Missing kind');
  const kindView = render(kind.node);
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'campaign' } });
  kindView.unmount();
  const template = field(result, 'template');
  if (template?.kind !== 'custom') throw new Error('Missing template');
  const templateView = render(template.node);
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'project:source-project' } });
  templateView.unmount();
  const themeMode = field(result, 'themeMode');
  if (themeMode?.kind !== 'custom') throw new Error('Missing theme mode');
  const themeModeView = render(themeMode.node);
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'dark' } });
  themeModeView.unmount();
  const weeks = field(result, 'weeks');
  if (weeks?.kind !== 'custom') throw new Error('Missing weeks');
  render(weeks.node);
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '8' } });

  await act(async () => {
    await result.current.onSubmit();
  });
  expect(io.request).toHaveBeenCalledWith(
    'create',
    expect.objectContaining({
      groupId: 'group-1',
      kind: 'campaign',
      campaign: { weeks: 8, core: 3, stories: 2 },
      template: { kind: 'project', id: 'source-project' },
      themeMode: 'dark',
    })
  );
  expect(io.navigate).toHaveBeenCalledWith({
    to: '/group/$id/studio/$projectId',
    params: { id: 'group-1', projectId: 'new-project' },
  });
});

it('restores a statement draft and retries AI chat setup without creating another project', async () => {
  sessionStorage.setItem(
    'studio:statement-return',
    JSON.stringify({
      title: 'Draft title',
      text: 'Draft briefing',
      isStory: true,
    })
  );
  const { result } = renderHook(() => useCreateStudioProjectForm(null));
  expect(field(result, 'title')).toMatchObject({ value: 'Draft title' });
  const mode = field(result, 'mode');
  if (mode?.kind !== 'custom') throw new Error('Missing mode');
  render(mode.node);
  fireEvent.click(screen.getByRole('radio', { name: 'features.studio.ai' }));
  expect(result.current.steps[1].isValid()).toBe(true);
  io.confirm.mockRejectedValueOnce(new Error('Chat unavailable'));
  const setRecoveryTarget = vi.fn();
  await expect(
    act(async () =>
      result.current.onSubmit({
        reportProgress: vi.fn(),
        setRecoveryTarget,
      })
    )
  ).rejects.toThrow('Chat unavailable');
  expect(setRecoveryTarget).toHaveBeenCalledWith(
    expect.objectContaining({
      to: '/studio/$projectId',
      params: { projectId: 'new-project' },
    })
  );
  expect(io.navigate).not.toHaveBeenCalled();

  await act(async () => {
    await result.current.onSubmit();
  });
  expect(io.request.mock.calls.filter(([operation]) => operation === 'create')).toHaveLength(1);
  expect(io.chatCreate).toHaveBeenCalledWith(
    expect.objectContaining({
      scope: { kind: 'studio', projectId: 'new-project' },
    })
  );
  expect(sessionStorage.getItem('studio-brief:new-project')).toBe('Draft briefing');
  expect(io.navigate).toHaveBeenCalledWith({
    to: '/studio/$projectId',
    params: { projectId: 'new-project' },
  });
});

it('keeps the form open when project creation fails', async () => {
  io.request.mockImplementation(async (operation: string) => {
    if (operation === 'create') throw new Error('Create failed');
    return [];
  });
  const { result } = renderHook(() => useCreateStudioProjectForm(null));
  const title = field(result, 'title');
  if (title?.kind !== 'text') throw new Error('Missing title');
  act(() => title.onValueChange('Title'));
  await expect(act(async () => result.current.onSubmit())).rejects.toThrow('Create failed');
  expect(io.navigate).not.toHaveBeenCalled();
});

it('requires a briefing only in AI mode', () => {
  const { result } = renderHook(() => useCreateStudioProjectForm(null));
  expect(result.current.steps[1].isValid()).toBe(true);
  const mode = field(result, 'mode');
  if (mode?.kind !== 'custom') throw new Error('Missing mode');
  render(mode.node);
  fireEvent.click(screen.getByRole('radio', { name: 'features.studio.ai' }));
  expect(result.current.steps[1].isValid()).toBe(false);
  const brief = field(result, 'brief');
  if (brief?.kind !== 'text') throw new Error('Missing brief');
  act(() => brief.onValueChange('Please make a campaign'));
  expect(result.current.steps[1].isValid()).toBe(true);
});
