/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => `translated:${key}` }),
}));

import { useTargetSelectionDialogController } from '../useTargetSelectionDialogController';

describe('useTargetSelectionDialogController A04 branch accountability', () => {
  afterEach(() => cleanup());

  it('maps collaborators and confirms a complete target selection', () => {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();
    const { result } = renderHook(() =>
      useTargetSelectionDialogController({
        currentUserId: 'current',
        allUsers: [
          { id: 'one', name: 'One', email: 'one@example.com', avatar: 'avatar.png' },
          { id: 'two', name: 'Two', email: null, avatar: null },
        ],
        onOpenChange,
        onConfirm,
        title: 'Title',
        description: 'Description',
        confirmButtonText: 'Confirm',
      })
    );

    expect(result.current.collaborators).toEqual([
      { id: 'one', name: 'One', email: 'one@example.com', avatar: 'avatar.png' },
      { id: 'two', name: 'Two', email: undefined, avatar: undefined },
    ]);
    expect(result.current.dialogTitle).toBe('Title');
    expect(result.current.dialogDescription).toBe('Description');
    expect(result.current.confirmText).toBe('Confirm');

    const selection = {
      sourceGroupId: 'source',
      groupId: 'group',
      groupData: { id: 'group' },
      eventId: 'event',
      eventData: { id: 'event' },
      selectedUserId: 'selected',
      pathWithEvents: [{ groupId: 'group' }],
      pathMode: 'workflow',
      workflowId: 'workflow',
    } as any;
    act(() => result.current.onTargetSelect(selection));
    act(() => result.current.onConfirmClick());

    expect(onConfirm).toHaveBeenCalledWith({
      sourceGroupId: 'source',
      groupId: 'group',
      groupData: { id: 'group' },
      eventId: 'event',
      eventData: { id: 'event' },
      collaboratorUserId: 'selected',
      pathWithEvents: [{ groupId: 'group' }],
      pathMode: 'workflow',
      workflowId: 'workflow',
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('uses every empty-selection and default-copy fallback', () => {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();
    const { result } = renderHook(() =>
      useTargetSelectionDialogController({
        currentUserId: 'current',
        allUsers: [],
        onOpenChange,
        onConfirm,
        title: '',
        description: '',
        confirmButtonText: '',
      })
    );

    expect(result.current.dialogTitle).toContain('defaultTitle');
    expect(result.current.dialogDescription).toContain('defaultDescription');
    expect(result.current.confirmText).toContain('defaultConfirm');
    act(() => result.current.onConfirmClick());

    expect(onConfirm).toHaveBeenCalledWith({
      sourceGroupId: null,
      groupId: null,
      groupData: null,
      eventId: null,
      eventData: null,
      collaboratorUserId: 'current',
      pathWithEvents: [],
      pathMode: 'hierarchy',
      workflowId: null,
    });
  });

  it('retains pending state on open and clears it on close and cancel', () => {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();
    const { result } = renderHook(() =>
      useTargetSelectionDialogController({
        currentUserId: 'current',
        allUsers: [],
        onOpenChange,
        onConfirm,
      })
    );

    act(() => result.current.onTargetSelect({ groupId: 'first' } as any));
    act(() => result.current.onOpenChange(true));
    act(() => result.current.onConfirmClick());
    expect(onConfirm).toHaveBeenLastCalledWith(expect.objectContaining({ groupId: 'first' }));

    act(() => result.current.onTargetSelect({ groupId: 'second' } as any));
    act(() => result.current.onOpenChange(false));
    act(() => result.current.onConfirmClick());
    expect(onConfirm).toHaveBeenLastCalledWith(expect.objectContaining({ groupId: null }));

    act(() => result.current.onTargetSelect({ groupId: 'third' } as any));
    act(() => result.current.onCancel());
    act(() => result.current.onConfirmClick());
    expect(onConfirm).toHaveBeenLastCalledWith(expect.objectContaining({ groupId: null }));
  });
});
