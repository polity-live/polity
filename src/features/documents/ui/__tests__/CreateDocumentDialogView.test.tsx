/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CreateDocumentDialogView } from '../CreateDocumentDialogView';

vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));

afterEach(cleanup);

describe('CreateDocumentDialogView', () => {
  it('opens and submits a titled document through stable disabled-aware actions', () => {
    const onCreate = vi.fn();
    const onTitleChange = vi.fn();
    const { container } = render(
      <CreateDocumentDialogView
        groupName="Council"
        isCreating={false}
        isOpen
        onCreate={onCreate}
        onKeyDown={vi.fn()}
        onOpenChange={vi.fn()}
        onTitleChange={onTitleChange}
        title="Policy"
      />
    );
    const open = container.querySelector<HTMLElement>('[data-action-id="documents.create.open"]')!;
    const submit = document.querySelector<HTMLElement>(
      '[data-action-id="documents.create.submit"]'
    )!;
    open.focus();
    fireEvent.keyDown(open, { key: 'Enter' });
    submit.focus();
    fireEvent.keyDown(submit, { key: 'Enter' });
    fireEvent.click(submit);
    expect(onCreate).toHaveBeenCalledOnce();
    const input = document.querySelector<HTMLInputElement>('#title')!;
    fireEvent.change(input, { target: { value: 'Updated' } });
    expect(onTitleChange).toHaveBeenCalledWith('Updated');
  });
});
