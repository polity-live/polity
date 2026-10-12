/* @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { StudioDatasetEditButton } from '../StudioDatasetEditButton';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(cleanup);
it('opens the saved data editor with keyboard focus and prevents disabled edits', async () => {
  const edit = vi.fn();
  const user = userEvent.setup();
  const { rerender } = render(<StudioDatasetEditButton disabled={false} onEdit={edit} />);
  const button = screen.getByRole('button');
  await user.tab();
  expect(document.activeElement).toBe(button);
  await user.keyboard('{Enter}');
  expect(edit).toHaveBeenCalledOnce();
  rerender(<StudioDatasetEditButton disabled onEdit={edit} />);
  await user.click(button);
  expect(edit).toHaveBeenCalledOnce();
});
