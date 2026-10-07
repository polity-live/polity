import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { useCreateStudioProjectForm } from '../useCreateStudioProjectForm';

const io = vi.hoisted(() => ({
  request: vi.fn(),
  navigate: vi.fn(),
  mutate: vi.fn(),
  confirm: vi.fn(),
}));
vi.mock('@tanstack/react-router', async importOriginal => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useNavigate: () => io.navigate,
}));
vi.mock('@rocicorp/zero/react', () => ({
  useZero: () => ({ mutate: io.mutate }),
  useQuery: () => [[{ id: 'group-owner', name: 'Project owners' }]],
}));
vi.mock('@/zero/queries', () => ({ queries: { studio: { manageGroups: () => ({}) } } }));
vi.mock('@/zero/mutators', () => ({
  mutators: { projectChat: { create: (input: unknown) => input } },
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  serverConfirmed: (input: unknown) => io.confirm(input),
}));
vi.mock('@/zero/communication-studio/useStudioClient', async () => {
  const { studioClientFixture } = await import('@/test/studio-client.fixture');
  return { useStudioClient: () => studioClientFixture(io) };
});
vi.mock('@/zero/communication-studio/useStudioState', () => ({
  useStudioState: () => ({
    projects: [
      { id: 'source-project', title: 'Saved template', is_template: true },
      { id: 'ordinary', title: 'Ordinary project', is_template: false },
    ],
  }),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  io.request.mockImplementation(async (operation: string) =>
    operation === 'create' ? { id: 'new-project' } : []
  );
  io.navigate.mockResolvedValue(undefined);
  io.mutate.mockReturnValue({ server: Promise.resolve({ type: 'success' }) });
  io.confirm.mockResolvedValue(undefined);
  localStorage.clear();
  sessionStorage.clear();
});

function Harness() {
  const config = useCreateStudioProjectForm(null);
  const [outcome, setOutcome] = useState('');
  return (
    <form
      onSubmit={async event => {
        event.preventDefault();
        await config.onSubmit();
        setOutcome('Project opened');
      }}
    >
      {config.steps
        .flatMap(step => step.fields ?? [])
        .map(field => {
          if (field.kind === 'custom') return <div key={field.key}>{field.node}</div>;
          if (field.kind !== 'text') return null;
          return (
            <label key={field.key}>
              {field.label}
              {field.multiline ? (
                <textarea
                  value={field.value ?? ''}
                  onChange={event => field.onValueChange(event.target.value)}
                />
              ) : (
                <input
                  value={field.value ?? ''}
                  onChange={event => field.onValueChange(event.target.value)}
                />
              )}
            </label>
          );
        })}
      <button
        type="submit"
        disabled={config.isSubmitting || config.steps.some(step => !step.isValid())}
      >
        Create project
      </button>
      <output>{outcome}</output>
    </form>
  );
}

async function choose(label: string, key: string, value: string) {
  const select = screen.getByRole('combobox', { name: `features.studio.${label}` });
  expect(select.getAttribute('data-action-id')).toBe('create.studio.option.select');
  select.focus();
  await userEvent.keyboard(key);
  await waitFor(() => expect((select as HTMLSelectElement).value).toBe(value));
  expect(document.activeElement).toBe(select);
}

it('changes and restores every project option through native keyboard selections and submits the selected template', async () => {
  render(<Harness />);
  await userEvent.fill(
    screen.getByRole('textbox', { name: 'features.studio.name' }),
    'Native project'
  );
  await choose('templateName', '{End}', 'presentation');
  await choose('templateName', '{Home}', 'single');
  await choose('template', '{End}', 'project:source-project');
  expect(screen.queryByRole('option', { name: 'Ordinary project' })).toBeNull();
  await choose('template', '{Home}', 'announcement');
  await choose('template', '{End}', 'project:source-project');
  const theme = screen.getByRole('combobox', {
    name: 'features.studio.theme',
  }) as HTMLSelectElement;
  const first = theme.options[0].value;
  const last = theme.options[theme.options.length - 1].value;
  await choose('theme', '{End}', last);
  await choose('theme', '{Home}', first);
  await choose('themeMode', '{End}', 'dark');
  await choose('themeMode', '{Home}', 'light');
  await choose('themeMode', '{End}', 'dark');
  await userEvent.click(screen.getByRole('button', { name: 'Create project' }));
  await screen.findByText('Project opened');
  expect(io.request).toHaveBeenCalledWith(
    'create',
    expect.objectContaining({
      kind: 'single',
      template: { kind: 'project', id: 'source-project' },
      themeId: first,
      themeMode: 'dark',
    })
  );
});

it('switches AI and template modes with native radio keys and requires the typed briefing before opening the conversation', async () => {
  render(<Harness />);
  await userEvent.fill(screen.getByRole('textbox', { name: 'features.studio.name' }), 'AI project');
  const template = screen.getByRole('radio', {
    name: 'features.studio.template',
  }) as HTMLInputElement;
  const ai = screen.getByRole('radio', { name: 'features.studio.ai' }) as HTMLInputElement;
  expect(ai.getAttribute('data-action-id')).toBe('create.studio.mode.select');
  template.focus();
  await userEvent.keyboard('{ArrowRight}');
  await waitFor(() => expect(ai.checked).toBe(true));
  expect(template.checked).toBe(false);
  expect(document.activeElement).toBe(ai);
  expect(
    (screen.getByRole('button', { name: 'Create project' }) as HTMLButtonElement).disabled
  ).toBe(true);
  await userEvent.keyboard('{ArrowLeft}');
  await waitFor(() => expect(template.checked).toBe(true));
  expect(document.activeElement).toBe(template);
  expect(screen.queryByRole('textbox', { name: 'features.studio.brief' })).toBeNull();
  await userEvent.keyboard('{ArrowRight}');
  await userEvent.fill(
    screen.getByRole('textbox', { name: 'features.studio.brief' }),
    '  Build the campaign  '
  );
  await userEvent.click(screen.getByRole('button', { name: 'Create project' }));
  await screen.findByText('Project opened');
  expect(io.mutate).toHaveBeenCalledWith(
    expect.objectContaining({
      scope: { kind: 'studio', projectId: 'new-project' },
      name: 'AI project',
    })
  );
  expect(sessionStorage.getItem('studio-brief:new-project')).toBe('Build the campaign');
  expect(localStorage.getItem('project-chat:studio:new-project')).toBeTruthy();
});

it('clamps campaign counts at both bounds while preserving native input focus and submits the final counts', async () => {
  render(<Harness />);
  await userEvent.fill(screen.getByRole('textbox', { name: 'features.studio.name' }), 'Campaign');
  await choose('templateName', '{End}{ArrowUp}', 'campaign');
  for (const [label, minimum, maximum, final] of [
    ['weeks', 1, 12, 8],
    ['core', 1, 3, 2],
    ['stories', 0, 3, 1],
  ] as const) {
    const input = screen.getByRole('spinbutton', {
      name: `features.studio.${label}`,
    }) as HTMLInputElement;
    expect(input.getAttribute('data-action-id')).toBe('create.studio.campaign.edit-count');
    await userEvent.fill(input, String(minimum - 1));
    await waitFor(() => expect(input.value).toBe(String(minimum)));
    expect(document.activeElement).toBe(input);
    await userEvent.fill(input, String(maximum + 1));
    await waitFor(() => expect(input.value).toBe(String(maximum)));
    await userEvent.fill(input, String(final));
    await waitFor(() => expect(input.value).toBe(String(final)));
    expect(document.activeElement).toBe(input);
  }
  await userEvent.click(screen.getByRole('button', { name: 'Create project' }));
  await screen.findByText('Project opened');
  expect(io.request).toHaveBeenCalledWith(
    'create',
    expect.objectContaining({ kind: 'campaign', campaign: { weeks: 8, core: 2, stories: 1 } })
  );
});
