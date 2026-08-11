/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../PqlQueryEditor', () => ({
  PqlQueryEditor: () => <textarea aria-label="Query" />,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));

import { PqlFilterBuilderDialogView } from '../PqlFilterBuilderDialogView';

afterEach(cleanup);

describe('PqlFilterBuilderDialogView actions', () => {
  it('cancels, disables invalid save, and submits valid filters through stable actions', () => {
    const onOpenChange = vi.fn();
    const onSave = vi.fn();
    const props = {
      fields: [],
      filter: null,
      isLabelValid: true,
      isQueryValid: true,
      isValid: false,
      issues: [],
      label: 'Open work',
      onLabelChange: vi.fn(),
      onOpenChange,
      onQueryChange: vi.fn(),
      onSave,
      open: true,
      query: 'status = open',
      queryPlaceholder: 'PQL',
    };
    const { container, rerender } = render(<PqlFilterBuilderDialogView {...props} />);

    const cancel = document.querySelector<HTMLElement>(
      '[data-action-id="pql.filter-builder.cancel"]'
    )!;
    const invalidSave = document.querySelector<HTMLButtonElement>(
      '[data-action-id="pql.filter-builder.save"]'
    )!;
    expect(invalidSave.disabled).toBe(true);
    cancel.focus();
    expect(document.activeElement).toBe(cancel);
    fireEvent.click(cancel);
    expect(onOpenChange).toHaveBeenCalledWith(false);

    rerender(<PqlFilterBuilderDialogView {...props} isValid />);
    fireEvent.click(
      document.querySelector<HTMLElement>('[data-action-id="pql.filter-builder.save"]')!
    );
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(container).toBeTruthy();
  });
});
