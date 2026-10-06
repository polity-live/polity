// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ProjectContextChips } from '../ProjectContextChips';
import { ProjectContextNavigation } from '../ProjectContextNavigation';
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key.split('.').at(-1) }),
}));
afterEach(cleanup);
const element = {
  kind: 'element' as const,
  id: 'title',
  label: 'Heading',
  origin: 'manual' as const,
  workspaceId: null,
};
it('activates repeatedly without removing and keeps structural context noninteractive', () => {
  const activate = vi.fn(),
    remove = vi.fn();
  render(
    <ProjectContextNavigation.Provider value={activate}>
      <ProjectContextChips
        references={[
          element,
          { ...element, kind: 'frame', id: 'page', label: 'Page' },
          { ...element, kind: 'workspace', id: 'canonical', label: 'canonical' },
        ]}
        onRemove={remove}
      />
    </ProjectContextNavigation.Provider>
  );
  const chip = screen.getByRole('button', { name: 'element · Heading' });
  fireEvent.click(chip);
  fireEvent.click(chip);
  expect(activate).toHaveBeenCalledTimes(2);
  expect(activate).toHaveBeenCalledWith(element, undefined);
  expect(remove).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'remove Heading' }));
  expect(remove).toHaveBeenCalledWith(element);
  expect(activate).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('button', { name: /workspace/ })).toBeNull();
});
it('allows an explicit callback and source workspace while remaining readable without one', () => {
  const activate = vi.fn();
  const source = { surface: 'studio' as const, proposalId: 'draft' };
  const ui = render(
    <ProjectContextChips references={[element]} onActivate={activate} sourceContext={source} />
  );
  fireEvent.click(screen.getByRole('button'));
  expect(activate).toHaveBeenCalledWith(element, source);
  ui.rerender(<ProjectContextChips references={[element]} />);
  expect(screen.queryByRole('button')).toBeNull();
  expect(screen.getByText('Heading', { exact: false })).toBeTruthy();
});
