/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: () => 'Kommunikationsstudio' }),
}));
import { StudioStatementEntry } from '../StudioStatementEntry';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  sessionStorage.clear();
});
it('preserves the unfinished statement when opening the group or personal Studio', () => {
  const assign = vi.fn(),
    original = window;
  vi.stubGlobal(
    'window',
    new Proxy(original, {
      get(target, key) {
        return key === 'location' ? { assign } : Reflect.get(target, key);
      },
    })
  );
  const form = { title: 'Unfinished statement', text: 'Keep my draft', image_url: null };
  const view = render(<StudioStatementEntry groupId="group-one" form={form} />);
  fireEvent.click(screen.getByRole('button', { name: 'Kommunikationsstudio' }));
  expect(JSON.parse(sessionStorage.getItem('studio:statement-return')!)).toEqual(form);
  expect(assign).toHaveBeenLastCalledWith('/group/group-one/studio');
  view.rerender(<StudioStatementEntry form={form} />);
  fireEvent.click(screen.getByRole('button', { name: 'Kommunikationsstudio' }));
  expect(assign).toHaveBeenLastCalledWith('/studio');
});
it('keeps the Studio entry hidden in a production build until explicitly enabled', () => {
  vi.stubEnv('DEV', false);
  vi.stubEnv('VITE_STUDIO_ENABLED', 'false');
  const view = render(<StudioStatementEntry form={{ text: 'draft' }} />);
  expect(screen.queryByRole('button')).toBeNull();
  vi.stubEnv('VITE_STUDIO_ENABLED', 'true');
  view.rerender(<StudioStatementEntry form={{ text: 'draft' }} />);
  expect(screen.getByRole('button')).toBeTruthy();
});
