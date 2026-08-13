/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ controllerArgs: null as any, viewProps: null as any }));
vi.mock('@/features/amendments/hooks/useTargetSelectionDialogController', () => ({
  useTargetSelectionDialogController: (args: any) => {
    mocks.controllerArgs = args;
    return { controller: true };
  },
}));
vi.mock('../TargetSelectionDialogView', () => ({
  TargetSelectionDialogView: (props: any) => {
    mocks.viewProps = props;
    return <div />;
  },
}));
import { TargetSelectionDialog } from '../TargetSelectionDialog';

describe('TargetSelectionDialog A04 branch accountability', () => {
  afterEach(cleanup);

  it('uses default and explicit saving and collaborator-selection values', () => {
    const base = {
      open: true,
      onOpenChange: vi.fn(),
      currentUserId: 'user',
      allUsers: [],
      onConfirm: vi.fn(),
    };
    const { rerender } = render(<TargetSelectionDialog {...base} />);
    expect(mocks.viewProps).toEqual(
      expect.objectContaining({ isSaving: false, showCollaboratorSelection: true })
    );
    rerender(<TargetSelectionDialog {...base} isSaving showCollaboratorSelection={false} />);
    expect(mocks.viewProps).toEqual(
      expect.objectContaining({ isSaving: true, showCollaboratorSelection: false })
    );
    expect(mocks.controllerArgs.currentUserId).toBe('user');
  });
});
