import { cleanup, render, screen } from '@testing-library/react';
import { page, userEvent } from 'vitest/browser';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BUILTIN_THEMES } from '@/features/shared/appearance-theme';
import { GroupThemeSettings } from '../GroupThemeSettings';
import '@/styles.css';
const io = vi.hoisted(() => ({ rows: [] as any[], mutate: vi.fn() }));
vi.mock('@rocicorp/zero/react', () => ({
  useZero: () => ({ mutate: io.mutate }),
  useQuery: () => [io.rows, { type: 'complete' }],
}));
vi.mock('@/zero/queries', () => ({
  queries: { appearanceThemes: { groupEditor: () => ({}), personalEditor: () => ({}) } },
}));
vi.mock('@/zero/mutators', () => ({
  mutators: {
    appearanceThemes: Object.fromEntries(
      ['createGroup', 'createPersonal', 'updateDraft', 'publish', 'delete'].map(name => [
        name,
        (args: unknown) => ({ name, args }),
      ])
    ),
  },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  io.rows = [];
  io.mutate.mockReturnValue({
    client: Promise.resolve(),
    server: Promise.resolve({ type: 'success' }),
  });
});
afterEach(cleanup);
const label = (name: string) => 'pages.group.themes.textStyles.' + name;
function fixture(styles = 1) {
  const preset = BUILTIN_THEMES[0];
  return {
    id: crypto.randomUUID(),
    slug: 'theme',
    name: 'Theme fixture',
    group_id: '00000000-0000-4000-a000-000000000001',
    current_revision: {
      id: crypto.randomUUID(),
      version: 1,
      status: 'published',
      light_palette: preset.light,
      dark_palette: preset.dark,
      fonts: preset.fonts,
      text_styles: Array.from({ length: styles }, (_, i) => ({
        ...structuredClone(preset.textStyles[0]),
        id: crypto.randomUUID(),
        name: 'Style ' + (i + 1),
        bold: false,
        italic: false,
        underline: false,
      })),
    },
    revisions: [],
  };
}
async function editor(styles = 1) {
  io.rows = [fixture(styles)];
  render(<GroupThemeSettings groupId="00000000-0000-4000-a000-000000000001" />);
  const edit = page.getByRole('button', { name: 'pages.group.themes.edit', exact: true });
  await expect.element(edit).toBeVisible();
  await edit.click();
}
it('adds and deletes a local text style with native keyboard activation and retains the other styles', async () => {
  await editor();
  const add = page.getByRole('button', { name: label('add') });
  add.element().focus();
  await expect.element(add).toHaveFocus();
  await userEvent.keyboard('{Enter}');
  expect(screen.getAllByRole('textbox', { name: label('name') })).toHaveLength(2);
  await expect.element(add).toHaveFocus();
  const removes = screen.getAllByRole('button', { name: label('delete') });
  removes[1].focus();
  expect(document.activeElement).toBe(removes[1]);
  await userEvent.keyboard('{Enter}');
  expect(screen.getAllByRole('textbox', { name: label('name') })).toHaveLength(1);
  expect((screen.getByRole('textbox', { name: label('name') }) as HTMLInputElement).value).toBe(
    'Style 1'
  );
  expect(io.mutate).not.toHaveBeenCalled();
});
it('disables adding beyond the supported fifty text styles without mutating the theme', async () => {
  await editor(50);
  const add = page.getByRole('button', { name: label('add') });
  await expect.element(add).toBeDisabled();
  await userEvent.keyboard('{Tab}{Enter}');
  expect(screen.getAllByRole('textbox', { name: label('name') })).toHaveLength(50);
  expect(io.mutate).not.toHaveBeenCalled();
});
it.each(['font', 'color', 'alignment'])(
  'selects and restores the text style %s using native arrow keys and saves its actual value',
  async field => {
    await editor();
    const select = page.getByRole('combobox', { name: label(field) });
    const before = (select.element() as HTMLSelectElement).value;
    select.element().focus();
    await expect.element(select).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}{Enter}');
    const after = (select.element() as HTMLSelectElement).value;
    expect(after).not.toBe(before);
    await expect.element(select).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}{Enter}');
    await expect.element(select).toHaveValue(before);
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await page.getByRole('button', { name: 'pages.group.themes.saveDraft', exact: true }).click();
    expect(io.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'updateDraft',
        args: expect.objectContaining({
          text_styles: [
            expect.objectContaining({ [field === 'alignment' ? 'align' : field]: after }),
          ],
        }),
      })
    );
  }
);
it.each(['bold', 'italic', 'underline'])(
  'toggles the %s text style mark in both directions with the native keyboard and saves the selected mark',
  async mark => {
    await editor();
    const checkbox = page.getByRole('checkbox', { name: label('marks.' + mark) });
    await expect.element(checkbox).not.toBeChecked();
    checkbox.element().focus();
    await expect.element(checkbox).toHaveFocus();
    await userEvent.keyboard(' ');
    await expect.element(checkbox).toBeChecked();
    await expect.element(checkbox).toHaveFocus();
    await userEvent.keyboard(' ');
    await expect.element(checkbox).not.toBeChecked();
    await userEvent.keyboard(' ');
    await page.getByRole('button', { name: 'pages.group.themes.saveDraft', exact: true }).click();
    expect(io.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'updateDraft',
        args: expect.objectContaining({ text_styles: [expect.objectContaining({ [mark]: true })] }),
      })
    );
  }
);
it('edits text style typography and prevents saving invalid numeric values without losing its fields', async () => {
  await editor();
  const name = page.getByRole('textbox', { name: label('name') });
  await name.click();
  await userEvent.keyboard('{Control>}a{/Control}New typography');
  for (const [field, value] of [
    ['size', '42'],
    ['lineHeight', '1.5'],
    ['letterSpacing', '2'],
  ]) {
    const input = page.getByRole('spinbutton', { name: label(field) });
    await input.click();
    await userEvent.keyboard('{Control>}a{/Control}' + value);
    await expect.element(input).toHaveFocus();
    await expect.element(input).toHaveValue(Number(value));
  }
  const size = page.getByRole('spinbutton', { name: label('size') });
  await size.click();
  await userEvent.keyboard('{Control>}a{/Control}500');
  const save = page.getByRole('button', { name: 'pages.group.themes.saveDraft', exact: true });
  await expect.element(save).toBeDisabled();
  await expect.element(name).toHaveValue('New typography');
  expect(io.mutate).not.toHaveBeenCalled();
  await userEvent.keyboard('{Control>}a{/Control}42');
  await expect.element(save).not.toBeDisabled();
  await save.click();
  expect(io.mutate).toHaveBeenCalledWith(
    expect.objectContaining({
      name: 'updateDraft',
      args: expect.objectContaining({
        text_styles: [
          expect.objectContaining({
            name: 'New typography',
            size: 42,
            lineHeight: 1.5,
            letterSpacing: 2,
          }),
        ],
      }),
    })
  );
});

it('creates and saves a personal preset with the native keyboard without attaching a group context', async () => {
  render(<GroupThemeSettings />);
  const preset = page.getByRole('button', { name: 'Polity', exact: true });
  await expect.element(preset).toBeVisible();
  preset.element().focus();
  await expect.element(preset).toHaveFocus();
  await userEvent.keyboard('{Enter}');
  expect(io.mutate).toHaveBeenCalledWith(
    expect.objectContaining({
      name: 'createPersonal',
      args: expect.objectContaining({ name: expect.stringContaining('Polity') }),
    })
  );
  const description = page.getByRole('textbox', { name: 'pages.group.themes.description' });
  await description.click();
  await userEvent.keyboard('Personal theme description');
  await page.getByRole('button', { name: 'pages.group.themes.saveDraft', exact: true }).click();
  expect(io.mutate).toHaveBeenCalledWith(
    expect.objectContaining({
      name: 'updateDraft',
      args: expect.objectContaining({ description: 'Personal theme description' }),
    })
  );
  expect(io.mutate.mock.calls.some(([mutation]) => mutation.name === 'createGroup')).toBe(false);
});
