import { render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { Toolbar } from '@/features/shared/ui/layout';
import { Frame } from 'lucide-react';
import { StudioMenuItem, StudioToolbarMenu } from '../StudioToolbarMenu';
import { DropdownMenuLabel, DropdownMenuSeparator } from '@/features/shared/ui/ui/dropdown-menu';
import { StudioFrameTemplates, useStudioFrameTemplateSelection } from '../StudioFrameTemplates';
import { StudioLiveTools } from '../StudioLiveTools';
import { createEventTemplate } from '../../logic/event-templates';
import '@/font-faces.css';
import '@/styles.css';

const fixture = vi.hoisted(() => ({
  id: '11111111-1111-4111-8111-111111111111',
  rows: [
    {
      source_type: 'event' as const,
      source_id: '11111111-1111-4111-8111-111111111111',
      payload: { title: 'Delegiertenversammlung 2026' },
    },
    {
      source_type: 'event' as const,
      source_id: '22222222-2222-4222-8222-222222222222',
      payload: { title: 'Kommunalpolitischer Austausch' },
    },
  ],
}));
vi.mock('@/zero/observed-query', () => ({ useQuery: () => [fixture.rows] }));
vi.mock('../KonvaStudioCanvas', () => ({ default: () => <div /> }));

function Harness({
  disabled = false,
  onInsertData,
}: {
  disabled?: boolean;
  onInsertData?: () => void;
}) {
  const [document, setDocument] = useState(() => createEventTemplate('cover', fixture.id));
  const [portrait, setPortrait] = useState(false);
  const selection = useStudioFrameTemplateSelection();
  const update = (edit: (d: typeof document) => void) =>
    setDocument(current => {
      const next = structuredClone(current);
      edit(next);
      return next;
    });
  return (
    <div className="bg-background min-h-screen p-4">
      <Toolbar className="bg-card rounded border p-2">
        <StudioToolbarMenu label="Frame" icon={<Frame />}>
          <DropdownMenuLabel>Format</DropdownMenuLabel>
          {['square', 'portrait', 'story', 'widescreen', 'standard'].map(format => (
            <StudioMenuItem key={format} label={format} icon={<Frame />} onSelect={vi.fn()} />
          ))}
          <DropdownMenuSeparator />
          {['single', 'carousel', 'story', 'video', 'presentation'].map(kind => (
            <StudioMenuItem key={kind} label={kind} icon={<Frame />} onSelect={vi.fn()} />
          ))}
          <DropdownMenuSeparator />
          <StudioMenuItem label="Free Frame" icon={<Frame />} onSelect={vi.fn()} />
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Event template</DropdownMenuLabel>
          <StudioFrameTemplates selection={selection} update={update} disabled={disabled} />
        </StudioToolbarMenu>
        <StudioLiveTools
          document={document}
          frameId={document.nodes[0].id}
          selectedId={document.nodes.find(n => n.liveBinding?.field === 'title')?.id}
          sources={fixture.rows}
          assets={[{ id: fixture.id, name: 'Opening music', mime: 'audio/mpeg' }]}
          update={edit =>
            setDocument(current => {
              const next = structuredClone(current);
              edit(next);
              return next;
            })
          }
          portrait={portrait}
          setPortrait={setPortrait}
          disabled={disabled}
          onInsertData={onInsertData}
        />
      </Toolbar>
      <output data-testid="frame-count">
        {document.nodes.filter(n => n.type === 'frame').length}
      </output>
      <output data-testid="last-source">
        {[...document.nodes].reverse().find(n => n.liveBinding)?.liveBinding?.sourceId}
      </output>
    </div>
  );
}

beforeEach(async () => {
  await page.viewport(1280, 900);
});
afterEach(async () => {
  await page.viewport(1280, 900);
});

it.each([
  { width: 1280, height: 900, name: 'desktop' },
  { width: 390, height: 844, name: 'mobile' },
])(
  'offers a direct visualization icon with keyboard access on $name',
  async ({ width, height }) => {
    await page.viewport(width, height);
    const onInsertData = vi.fn();
    render(<Harness onInsertData={onInsertData} />);
    const trigger = screen.getByRole('button', { name: 'Insert data visualization' });
    expect(trigger.querySelectorAll('svg')).toHaveLength(1);
    expect(trigger.textContent?.trim()).toBe('');
    expect(trigger.nextElementSibling).toBe(screen.getByRole('button', { name: /Polity data/i }));
    trigger.focus();
    await waitFor(() =>
      expect(screen.getByRole('tooltip')).toHaveTextContent('Insert data visualization')
    );
    await userEvent.keyboard('{Enter}');
    expect(onInsertData).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: /Polity data/i }));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Entity' })).toBeVisible());
    const panel = screen.getByRole('textbox', { name: 'Entity' }).closest('fieldset')!;
    expect(within(panel).queryByRole('button', { name: 'Insert data visualization' })).toBeNull();
    expect(within(panel).queryByRole('heading', { name: /Polity data/i })).toBeNull();
  }
);

it('disables the visualization icon for read-only documents', async () => {
  const onInsertData = vi.fn();
  render(<Harness disabled onInsertData={onInsertData} />);
  const trigger = screen.getByRole('button', { name: 'Insert data visualization' });
  expect(trigger).toHaveAttribute('aria-disabled', 'true');
  expect(trigger.querySelector('button')).toBeDisabled();
  trigger.focus();
  await userEvent.keyboard('{Enter}');
  expect(onInsertData).not.toHaveBeenCalled();
});

it('opens icon panels by keyboard and retains the selected entity across panel changes', async () => {
  render(<Harness />);
  const dataTrigger = screen.getByRole('button', { name: /Polity data/i });
  dataTrigger.focus();
  await userEvent.keyboard('{Enter}');
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Entity' })).toBeVisible());
  const input = screen.getByRole('textbox', { name: 'Entity' });
  await userEvent.fill(input, 'Delegierten');
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /Delegierten.*versammlung 2026/ })).toBeVisible()
  );
  expect(screen.queryByText('Kommunalpolitischer Austausch')).toBeNull();
  await page.screenshot({ path: '../../../../../output/playwright/studio-data-desktop.png' });
  await userEvent.keyboard('{Enter}');
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(dataTrigger).toHaveFocus());
  await userEvent.click(screen.getByRole('button', { name: 'Responsive Layout' }));
  await waitFor(() =>
    expect(screen.getByRole('combobox', { name: 'Layout preview' })).toBeVisible()
  );
  expect(screen.queryByRole('textbox', { name: 'Entity' })).toBeNull();
  await page.screenshot({ path: '../../../../../output/playwright/studio-layout-desktop.png' });
  await userEvent.keyboard('{Escape}');
  await userEvent.click(screen.getByRole('button', { name: 'Music & Animation' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add music' })).toBeVisible());
  expect(screen.getByRole('region', { name: 'Animations' })).toBeVisible();
  await page.screenshot({ path: '../../../../../output/playwright/studio-music-desktop.png' });
  await userEvent.keyboard('{Escape}');
  await userEvent.click(dataTrigger);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Remove Delegiertenversammlung 2026' })).toBeVisible()
  );
  expect(screen.getByRole('button', { name: 'Insert variable' })).not.toBeDisabled();
});

it('keeps typeahead results inside the mobile sheet and permits selecting and removing an entity', async () => {
  await page.viewport(390, 844);
  render(<Harness />);
  await userEvent.click(screen.getByRole('button', { name: /Polity data/i }));
  const sheet = await screen.findByRole('dialog', { name: /Polity data/i });
  expect(sheet).toHaveClass('bottom-0');
  const input = screen.getByRole('textbox', { name: 'Entity' });
  await userEvent.fill(input, 'Kommunal');
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /Kommunal.*politischer Austausch/ })).toBeVisible()
  );
  const dropdown = sheet.querySelector('[data-typeahead-dropdown]');
  expect(dropdown).toBeTruthy();
  expect(input).toHaveFocus();
  await Promise.all(sheet.getAnimations().map(animation => animation.finished));
  await page.screenshot({ path: '../../../../../output/playwright/studio-data-mobile.png' });
  await userEvent.keyboard('{Enter}');
  await userEvent.click(
    screen.getByRole('button', { name: 'Remove Kommunalpolitischer Austausch' })
  );
  expect(screen.getByRole('button', { name: 'Insert variable' })).toBeDisabled();
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 5000 });
  await userEvent.click(screen.getByRole('button', { name: 'Music & Animation' }));
  await waitFor(() =>
    expect(screen.getByRole('dialog', { name: 'Music & Animation' })).toBeVisible()
  );
  expect(screen.getByRole('button', { name: 'Add music' })).toBeVisible();
});

it('keeps read-only typeahead and edit controls disabled inside the panels', async () => {
  render(<Harness disabled />);
  await userEvent.click(screen.getByRole('button', { name: /Polity data/i }));
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Entity' })).toBeDisabled());
  expect(screen.getByRole('combobox', { name: 'Source' })).toBeDisabled();
  await userEvent.keyboard('{Escape}');
  await userEvent.click(screen.getByRole('button', { name: 'Music & Animation' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add music' })).toBeDisabled());
});

it.each([
  { width: 1280, height: 900, name: 'desktop' },
  { width: 390, height: 844, name: 'mobile' },
])(
  'adds templates directly from Frame on $name and keeps independent selections',
  async ({ width, height, name }) => {
    await page.viewport(width, height);
    render(<Harness />);
    const frameTrigger = screen.getByRole('button', { name: 'Frame' });
    frameTrigger.focus();
    await userEvent.keyboard('{Enter}');
    const input = await screen.findByRole('textbox', { name: 'Entity' });
    await userEvent.fill(input, 'Delegierten');
    expect(input).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}{ArrowUp}{Enter}');
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Remove Delegiertenversammlung 2026' })
      ).toBeVisible()
    );
    const templates = screen.getByRole('combobox', { name: 'Event template' });
    await userEvent.selectOptions(templates, 'election');
    templates.focus();
    await userEvent.keyboard('{Tab}');
    expect(screen.getByRole('button', { name: 'Add template' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByTestId('frame-count')).toHaveTextContent('2');
    expect(screen.getByTestId('last-source')).toHaveTextContent(fixture.id);
    expect(screen.getByRole('combobox', { name: 'Event template' })).toBeVisible();
    await page.screenshot({
      path: `../../../../../output/playwright/studio-frame-templates-${name}.png`,
    });
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(frameTrigger).toHaveFocus());
    await userEvent.click(screen.getByRole('button', { name: /Polity data/i }));
    expect(screen.queryByRole('combobox', { name: 'Event template' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Insert variable' })).toBeDisabled();
    await userEvent.fill(screen.getByRole('textbox', { name: 'Entity' }), 'Kommunal');
    await userEvent.keyboard('{Enter}');
    const insert = screen.getByRole('button', { name: 'Insert variable' });
    const bind = screen.getByRole('button', { name: 'Bind selection' });
    const panel = insert.closest('[data-canvas-focus-occluder]')!;
    await Promise.all(panel.getAnimations().map(animation => animation.finished));
    const first = insert.getBoundingClientRect();
    const second = bind.getBoundingClientRect();
    expect(getComputedStyle(insert.parentElement!).gap).toBe('8px');
    expect(second.left - first.right >= 7.99 || second.top - first.bottom >= 7.99).toBe(true);
    await userEvent.keyboard('{Escape}');
    await userEvent.click(frameTrigger);
    expect(screen.getByRole('combobox', { name: 'Event template' })).toHaveValue('election');
    expect(
      screen.getByRole('button', { name: 'Remove Delegiertenversammlung 2026' })
    ).toBeVisible();
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove Delegiertenversammlung 2026' })
    );
    expect(screen.getByRole('button', { name: 'Add template' })).toBeDisabled();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: /Polity data/i }));
    expect(
      screen.getByRole('button', { name: 'Remove Kommunalpolitischer Austausch' })
    ).toBeVisible();
  }
);

it('disables the Frame template form in read-only documents', async () => {
  render(<Harness disabled />);
  await userEvent.click(screen.getByRole('button', { name: 'Frame' }));
  expect(await screen.findByRole('textbox', { name: 'Entity' })).toBeDisabled();
  expect(screen.getByRole('combobox', { name: 'Source' })).toBeDisabled();
  expect(screen.getByRole('combobox', { name: 'Event template' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Add template' })).toBeDisabled();
});

it.each([
  { width: 1280, height: 900, name: 'desktop' },
  { width: 390, height: 844, name: 'mobile' },
])(
  'uses themed music sequence controls with native keyboard access on $name',
  async ({ width, height, name }) => {
    await page.viewport(width, height);
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Music & Animation' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add music' }));
    await userEvent.click(screen.getByRole('combobox', { name: 'Music or sound' }));
    await userEvent.click(screen.getByRole('option', { name: /Cinematic opening/ }));
    const loop = screen.getByRole('checkbox', { name: 'Repeat music' });
    expect(loop.tagName).toBe('BUTTON');
    expect(loop).toBeChecked();
    await userEvent.click(loop);
    expect(loop).not.toBeChecked();
    const slider = screen.getByRole('slider', { name: /^Volume/ });
    slider.focus();
    await userEvent.keyboard('{End}{ArrowLeft}');
    expect(slider).toHaveAttribute('aria-valuenow', '0.95');
    expect(screen.getByText('Volume 95 %')).toBeVisible();
    expect(
      document.querySelector('input[type="range"][data-action-id="studio.live.input2.change"]')
    ).toBeNull();
    const panel = loop.closest('[data-studio-show-dialog]')!;
    await Promise.all(panel.getAnimations().map(animation => animation.finished));
    expect(panel.getBoundingClientRect().right).toBeLessThanOrEqual(width + 1);
    await userEvent.click(loop);
    expect(loop).toBeChecked();
    await page.screenshot({
      path: `../../../../../output/playwright/studio-sequence-controls-${name}.png`,
    });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add music' }));
    await userEvent.click(screen.getByRole('combobox', { name: 'Music or sound' }));
    await userEvent.click(screen.getByRole('option', { name: /Test sound/ }));
    expect(screen.getByRole('checkbox', { name: 'Repeat music' })).toBeDisabled();
  }
);
