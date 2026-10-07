/* @vitest-environment jsdom */
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useCreateStudioProjectForm } from '../useCreateStudioProjectForm';
import { BUILTIN_THEMES } from '@/features/shared/appearance-theme';

const io = vi.hoisted(() => ({
  request: vi.fn(),
  navigate: vi.fn(),
  chatCreate: vi.fn(),
  confirm: vi.fn(),
  projects: [] as { id: string; title: string; is_template: boolean }[],
  groups: [] as { id: string; name: string }[],
}));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => io.navigate }));
vi.mock('@rocicorp/zero/react', () => ({
  useZero: () => ({ mutate: io.chatCreate }),
  useQuery: () => [io.groups],
}));
vi.mock('@/zero/queries', () => ({ queries: { studio: { manageGroups: () => ({}) } } }));
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
  io.groups = [];
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
      visibility: 'private',
    })
  );
  expect(io.navigate).toHaveBeenCalledWith({
    to: '/studio/$projectId',
    params: { projectId: 'new-project' },
  });
  expect(outcome).toMatchObject({ status: 'success', target: { to: '/studio/$projectId' } });
});

it('keeps the draft when an optional prefilled group changes', async () => {
  io.groups = [
    { id: 'group-1', name: 'Original' },
    { id: 'group-2', name: 'Destination' },
  ];
  const { result } = renderHook(() => useCreateStudioProjectForm('group-1'));
  const title = field(result, 'title');
  if (title?.kind !== 'text') throw new Error('Missing title');
  act(() => title.onValueChange('Draft kept'));
  const group = field(result, 'group');
  if (group?.kind !== 'typeahead') throw new Error('Missing group selector');
  expect(group.props.value).toBe('group-1');
  act(() => group.props.onChange?.({ id: 'group-2', label: 'Destination', entityType: 'group' }));
  expect((field(result, 'title') as typeof title).value).toBe('Draft kept');
  await act(async () => {
    await result.current.onSubmit();
  });
  expect(io.request).toHaveBeenCalledWith(
    'create',
    expect.objectContaining({
      title: 'Draft kept',
      groupId: 'group-2',
      visibility: 'private',
    })
  );
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

it('keeps built-in themes after a failed theme request and ignores a late response after unmount', async () => {
  io.request.mockRejectedValueOnce(new Error('Themes unavailable'));
  const failed = renderHook(() => useCreateStudioProjectForm(null));
  await act(async () => undefined);
  const theme = field(failed.result, 'theme');
  if (theme?.kind !== 'custom') throw new Error('Missing theme');
  const view = render(theme.node);
  expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(
    BUILTIN_THEMES.map(item => item.name)
  );
  view.unmount();
  failed.unmount();
  let resolve: (rows: Record<string, unknown>[]) => void = () => {
    throw new Error('Missing pending request');
  };
  io.request.mockImplementationOnce(
    () =>
      new Promise<Record<string, unknown>[]>(done => {
        resolve = done;
      })
  );
  const late = renderHook(() => useCreateStudioProjectForm(null));
  late.unmount();
  await act(async () => resolve([{ id: 'invalid-theme' }]));
  expect(io.request).toHaveBeenCalledTimes(2);
});

it('rejects an invalid saved draft and restores defaults for an empty statement draft', () => {
  sessionStorage.setItem('studio:statement-return', '{broken');
  const malformed = renderHook(() => useCreateStudioProjectForm(null));
  expect(field(malformed.result, 'title')).toMatchObject({ value: '' });
  expect(malformed.result.current.steps[2].isValid()).toBe(false);
  malformed.unmount();
  sessionStorage.setItem('studio:statement-return', '{}');
  const restored = renderHook(() => useCreateStudioProjectForm(null));
  expect(field(restored.result, 'title')).toMatchObject({ value: 'Neuer Beitrag' });
  expect(restored.result.current.steps[2].isValid()).toBe(true);
  const kind = field(restored.result, 'kind');
  if (kind?.kind !== 'custom') throw new Error('Missing kind');
  render(kind.node);
  expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('single');
});

it('accepts only manageable group candidates and preserves an unresolved group in the summary', () => {
  io.groups = [{ id: 'group-1', name: 'Managed group' }];
  const { result, rerender } = renderHook(() => useCreateStudioProjectForm('group-1'));
  const group = field(result, 'group');
  if (group?.kind !== 'typeahead') throw new Error('Missing group');
  expect(
    group.props.filterFn?.({ id: 'group-1', label: 'Managed group', entityType: 'group' })
  ).toBe(true);
  expect(
    group.props.filterFn?.({ id: 'other', label: 'Unavailable group', entityType: 'group' })
  ).toBe(false);
  const summary = field(result, 'summary');
  if (summary?.kind !== 'customComponent') throw new Error('Missing summary');
  expect(summary.props?.fields).toContainEqual({
    label: 'pages.create.event.associatedGroupLabel',
    value: 'Managed group',
  });
  io.groups = undefined as unknown as typeof io.groups;
  rerender();
  const unloaded = field(result, 'group');
  if (unloaded?.kind !== 'typeahead') throw new Error('Missing group');
  expect(
    unloaded.props.filterFn?.({ id: 'group-1', label: 'Managed group', entityType: 'group' })
  ).toBe(false);
  const unresolved = field(result, 'summary');
  if (unresolved?.kind !== 'customComponent') throw new Error('Missing summary');
  expect(unresolved.props?.fields).toContainEqual({
    label: 'pages.create.event.associatedGroupLabel',
    value: 'group-1',
  });
  act(() => unloaded.props.onChange?.(null));
  const personal = field(result, 'group');
  if (personal?.kind !== 'typeahead') throw new Error('Missing group');
  expect(personal.props.value).toBeUndefined();
});

it('validates the review for AI briefings and resumes a saved conversation after navigation fails', async () => {
  const { result } = renderHook(() => useCreateStudioProjectForm(null));
  expect(result.current.steps[2].isValid()).toBe(false);
  const title = field(result, 'title');
  if (title?.kind !== 'text') throw new Error('Missing title');
  act(() => title.onValueChange('Valid title'));
  expect(result.current.steps[2].isValid()).toBe(true);
  const mode = field(result, 'mode');
  if (mode?.kind !== 'custom') throw new Error('Missing mode');
  render(mode.node);
  fireEvent.click(screen.getByRole('radio', { name: 'features.studio.ai' }));
  expect(result.current.steps[2].isValid()).toBe(false);
  const brief = field(result, 'brief');
  if (brief?.kind !== 'text') throw new Error('Missing brief');
  act(() => brief.onValueChange('Valid briefing'));
  expect(result.current.steps[2].isValid()).toBe(true);
  io.navigate.mockRejectedValueOnce(new Error('Navigation unavailable'));
  await expect(act(async () => result.current.onSubmit())).rejects.toThrow(
    'Navigation unavailable'
  );
  const conversationId = localStorage.getItem('project-chat:studio:new-project');
  expect(conversationId).toBeTruthy();
  await act(async () => {
    await result.current.onSubmit();
  });
  expect(io.chatCreate).toHaveBeenCalledTimes(1);
  expect(io.request.mock.calls.filter(([operation]) => operation === 'create')).toHaveLength(1);
  expect(localStorage.getItem('project-chat:studio:new-project')).toBe(conversationId);
  expect(result.current.isSubmitting).toBe(false);
});

it('preserves selected template and theme identifiers if their sources disappear before review', async () => {
  const builtin = BUILTIN_THEMES[0];
  io.projects = [{ id: 'source-project', title: 'Shared template', is_template: true }];
  io.request.mockResolvedValueOnce([
    {
      id: '8ffae3d7-a33c-44c1-99fe-405cda8f0033',
      name: 'Temporary theme',
      light_palette: builtin.light,
      dark_palette: builtin.dark,
      fonts: builtin.fonts,
    },
  ]);
  const { result, rerender } = renderHook(() => useCreateStudioProjectForm(null));
  await act(async () => undefined);
  const template = field(result, 'template');
  if (template?.kind !== 'custom') throw new Error('Missing template');
  const templateView = render(template.node);
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'project:source-project' } });
  templateView.unmount();
  const theme = field(result, 'theme');
  if (theme?.kind !== 'custom') throw new Error('Missing theme');
  const themeView = render(theme.node);
  fireEvent.change(screen.getByRole('combobox'), {
    target: { value: '8ffae3d7-a33c-44c1-99fe-405cda8f0033' },
  });
  themeView.unmount();
  io.projects = [];
  io.request.mockResolvedValueOnce([]);
  const group = field(result, 'group');
  if (group?.kind !== 'typeahead') throw new Error('Missing group');
  act(() => group.props.onChange?.({ id: 'group-1', label: 'Group', entityType: 'group' }));
  rerender();
  await waitFor(() => {
    const summary = field(result, 'summary');
    if (summary?.kind !== 'customComponent') throw new Error('Missing summary');
    expect(summary.props?.fields).toContainEqual({ label: 'features.studio.theme', value: '' });
    expect(summary.props?.fields).toContainEqual({
      label: 'features.studio.template',
      value: 'project:source-project',
    });
  });
});

it('uses the briefing conversation name fallback for an empty restored title', async () => {
  const { result } = renderHook(() => useCreateStudioProjectForm(null));
  const mode = field(result, 'mode');
  if (mode?.kind !== 'custom') throw new Error('Missing mode');
  render(mode.node);
  fireEvent.click(screen.getByRole('radio', { name: 'features.studio.ai' }));
  await act(async () => {
    await result.current.onSubmit();
  });
  expect(io.chatCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Briefing' }));
});
