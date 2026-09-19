/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CalendarExportButton } from '../CalendarExportButton';
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: () => 'Export calendar' }),
}));
afterEach(cleanup);
it.each([true, false])(
  'keeps the export action named and keyboard accessible with iconOnly=%s',
  iconOnly => {
    const exportFile = vi.fn();
    const view = render(<CalendarExportButton iconOnly={iconOnly} onExport={exportFile} />);
    fireEvent.click(screen.getByRole('button', { name: 'Export calendar' }));
    expect(exportFile).toHaveBeenCalledOnce();
    view.rerender(
      <CalendarExportButton
        iconOnly={iconOnly}
        label="Download agenda"
        onExport={exportFile}
        disabled
      />
    );
    const button = screen.getByRole('button', { name: 'Download agenda' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(exportFile).toHaveBeenCalledOnce();
  }
);
