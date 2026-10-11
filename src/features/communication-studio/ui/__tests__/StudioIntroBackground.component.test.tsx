// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { createEventTemplate } from '../../logic/event-templates';
import { StudioIntroBackground } from '../StudioIntroBackground';

const io = vi.hoisted(() => ({ dispose: vi.fn(), create: vi.fn() }));
vi.mock('../../logic/event-intro-player', () => ({
  createIntroPlayer: (...args: unknown[]) => {
    io.create(...args);
    return io.dispose;
  },
}));
vi.mock('react-konva', () => ({ Image: () => <div data-testid="intro-background" /> }));

it('keeps the scene alive across live document and clock updates and disposes it on actual changes', () => {
  const document = createEventTemplate('cover', crypto.randomUUID());
  const frame = document.nodes[0];
  if (frame.type !== 'frame') throw new Error('frame');
  const r = render(<StudioIntroBackground frame={frame} theme={document.theme} animate />);
  expect(io.create).toHaveBeenCalledOnce();
  const now = io.create.mock.calls[0][4] as () => number;
  const before = now();
  r.rerender(
    <StudioIntroBackground
      frame={structuredClone(frame)}
      theme={structuredClone(document.theme)}
      animate
      clockOffset={4000}
    />
  );
  expect(io.create).toHaveBeenCalledOnce();
  expect(now() - before).toBeGreaterThanOrEqual(4000);
  const changed = structuredClone(frame);
  if (!changed.intro) throw new Error('intro');
  changed.intro.intensity = 0.9;
  r.rerender(<StudioIntroBackground frame={changed} theme={document.theme} animate />);
  expect(io.dispose).toHaveBeenCalledOnce();
  expect(io.create).toHaveBeenCalledTimes(2);
  changed.intro.scene = 'democracy-illustrated';
  r.rerender(
    <StudioIntroBackground frame={changed} theme={document.theme} animate clockOffset={4000} />
  );
  expect(io.create).toHaveBeenCalledTimes(3);
  expect(io.create.mock.calls[2][1].scene).toBe('democracy-illustrated');
  expect((io.create.mock.calls[2][4] as () => number)() - Date.now()).toBeGreaterThanOrEqual(3999);
  changed.intro.mode = 'static';
  r.rerender(<StudioIntroBackground frame={changed} theme={document.theme} animate />);
  expect(io.dispose).toHaveBeenCalledTimes(3);
  expect(r.queryByTestId('intro-background')).toBeNull();
  r.unmount();
  expect(io.dispose).toHaveBeenCalledTimes(3);
});
