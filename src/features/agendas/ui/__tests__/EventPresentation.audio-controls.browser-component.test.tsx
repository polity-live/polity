import { render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createEventTemplate } from '@/features/communication-studio/logic/event-templates';
import { EventPresentation } from '../EventPresentation';
import '@/font-faces.css';
import '@/styles.css';

const fixture = vi.hoisted(() => ({ show: {} as any, command: vi.fn() }));
vi.mock('@/zero/communication-studio/useEventPresentation', () => ({
  useEventPresentation: () => fixture.show,
}));
vi.mock('../../hooks/usePresentationAudio', () => ({
  usePresentationAudio: () => ({ enabled: true, error: '', activate: vi.fn() }),
}));
vi.mock('../../hooks/useAnimatedStudioDocument', () => ({
  useAnimatedStudioDocument: (document: unknown) => document,
}));
vi.mock('@/features/communication-studio/ui/KonvaStudioCanvas', () => ({
  default: () => <div className="bg-muted h-full w-full" />,
}));

function Harness() {
  const document = createEventTemplate('cover', '11111111-1111-4111-8111-111111111111');
  const [audio, setAudio] = useState({
    builtin: 'cinematic-sequence',
    status: 'paused',
    position: 42,
    at: Date.now(),
    volume: 0.65,
    loop: true,
  });
  fixture.command.mockImplementation(async (input: any) => {
    if (input.audio) setAudio(current => ({ ...current, ...input.audio }));
  });
  fixture.show = {
    document,
    projected: document,
    project: { id: 'project' },
    state: {
      mode: 'studio',
      frame_id: document.nodes[0].id,
      running: true,
      audio,
      audio_device_id: 'screen',
      lease_until: Date.now() + 60000,
    },
    deviceId: 'screen',
    now: Date.now(),
    online: true,
    connectionChecking: false,
    clockOffset: 0,
    canManage: true,
    hasControl: true,
    devices: [{ id: 'screen', name: 'This device', last_seen: Date.now() }],
    sources: [],
    eventSources: [],
    assets: [],
    command: fixture.command,
    exportSnapshot: vi.fn(),
  };
  return (
    <div className="bg-background text-foreground">
      <EventPresentation eventId="11111111-1111-4111-8111-111111111111" regie />
    </div>
  );
}

beforeEach(() => vi.clearAllMocks());

it.each([
  { width: 1280, height: 900, name: 'desktop' },
  { width: 390, height: 844, name: 'mobile' },
])(
  'shows themed director controls and complete sequence credits on $name',
  async ({ width, height, name }) => {
    await page.viewport(width, height);
    render(<Harness />);
    const loop = screen.getByRole('checkbox', { name: 'Loop' });
    expect(loop.tagName).toBe('BUTTON');
    expect(loop).toBeChecked();
    loop.focus();
    await userEvent.keyboard(' ');
    expect(loop).not.toBeChecked();
    const slider = screen.getByRole('slider', { name: /^Volume/ });
    slider.focus();
    await userEvent.keyboard('{ArrowLeft}');
    await waitFor(() => expect(slider).toHaveAttribute('aria-valuenow', '0.6'));
    expect(fixture.command).toHaveBeenLastCalledWith(
      expect.objectContaining({ audio: expect.objectContaining({ volume: 0.6, position: 42 }) })
    );
    expect(screen.getByText('Volume 60 %')).toBeVisible();
    const credits = screen.getByLabelText('Music credits');
    expect(credits.getBoundingClientRect().bottom).toBeLessThanOrEqual(height + 1);
    expect(credits.getBoundingClientRect().right).toBeLessThanOrEqual(width + 1);
    expect(screen.getAllByRole('link', { name: 'CC BY 4.0' })).toHaveLength(3);
    expect(document.querySelector('input[type="range"]')).toBeNull();
    expect(
      screen.getByRole('combobox', { name: 'Music' }).getBoundingClientRect().right
    ).toBeLessThanOrEqual(width + 1);
    await userEvent.click(loop);
    expect(loop).toBeChecked();
    await page.screenshot({
      path: `../../../../../output/playwright/director-sequence-controls-${name}.png`,
    });
    await userEvent.click(screen.getByRole('button', { name: 'Show controls' }));
    await userEvent.hover(screen.getByRole('main', { name: 'Event presentation' }));
    await waitFor(
      () =>
        expect(document.querySelector('.polity-presentation-buttons')).toHaveAttribute(
          'data-visible',
          'false'
        ),
      { timeout: 5000 }
    );
    expect(screen.getByRole('link', { name: 'Impact Prelude' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'The Complex' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Eternal Hope' })).toBeVisible();
  }
);
