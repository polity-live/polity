/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  controllerOptions: undefined as Record<string, unknown> | undefined,
  viewProps: undefined as Record<string, unknown> | undefined,
}));

vi.mock('../../hooks/useCreateDocumentDialogController', () => ({
  useCreateDocumentDialogController: (options: Record<string, unknown>) => {
    state.controllerOptions = options;
    return {
      isOpen: false,
      onCreate: vi.fn(),
      onKeyDown: vi.fn(),
      onOpenChange: vi.fn(),
      onTitleChange: vi.fn(),
      title: '',
    };
  },
}));
vi.mock('../CreateDocumentDialogView', () => ({
  CreateDocumentDialogView: (props: Record<string, unknown>) => {
    state.viewProps = props;
    return <div data-testid="dialog-view" />;
  },
}));

import { CreateDocumentDialog } from '../CreateDocumentDialog';

afterEach(cleanup);

describe('CreateDocumentDialog default branches', () => {
  it('defaults isCreating to false and forwards an explicit true value', () => {
    const onCreateDocument = vi.fn(async () => undefined);
    const { rerender } = render(
      <CreateDocumentDialog groupId="group-1" onCreateDocument={onCreateDocument} />
    );
    expect(state.controllerOptions).toMatchObject({ isCreating: false, onCreateDocument });
    expect(state.viewProps).toMatchObject({ isCreating: false });

    rerender(
      <CreateDocumentDialog
        groupId="group-1"
        groupName="Group"
        onCreateDocument={onCreateDocument}
        isCreating
      />
    );
    expect(state.viewProps).toMatchObject({ groupName: 'Group', isCreating: true });
  });
});
