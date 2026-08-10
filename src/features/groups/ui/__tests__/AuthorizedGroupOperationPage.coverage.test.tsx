/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  viewProps: undefined as any,
  operation: {
    userId: 'u',
    groupName: 'G',
    links: [],
    linkDialogOpen: false,
    setLinkDialogOpen: vi.fn(),
    handleAddLink: vi.fn(),
    payments: [],
    summary: {},
    incomeData: [],
    expenditureData: [],
    todos: [],
    todoViewMode: 'kanban',
    setTodoViewMode: vi.fn(),
    toggleTodoComplete: vi.fn(),
  },
}));
vi.mock('@/features/groups/hooks/useGroupOperationPage', () => ({
  useGroupOperationPage: () => mocks.operation,
}));
vi.mock('../GroupOperationPageContainerView', () => ({
  GroupOperationPageView: (props: any) => {
    mocks.viewProps = props;
    return <div />;
  },
}));

import { AuthorizedGroupOperationPage } from '../AuthorizedGroupOperationPage';

const props = {
  canManageDatasets: true,
  canManageDocuments: true,
  canManageLinks: true,
  canManagePayments: true,
  canManageTodos: true,
  canViewDatasets: true,
  canViewDocuments: true,
  canViewLinks: true,
  canViewPayments: true,
  canViewTodos: true,
  groupId: 'g',
};
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(1);
    return 7;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AuthorizedGroupOperationPage hash navigation', () => {
  it('ignores empty hashes and hashes without a section id', () => {
    const view = render(<AuthorizedGroupOperationPage {...props} hash="" />);
    view.rerender(<AuthorizedGroupOperationPage {...props} hash="#" />);
    expect(mocks.viewProps.groupId).toBe('g');
  });

  it('scrolls hash and plain section ids and cancels scheduled frames', () => {
    const scroll = vi.fn();
    vi.spyOn(document, 'getElementById').mockReturnValue({ scrollIntoView: scroll } as any);
    const view = render(<AuthorizedGroupOperationPage {...props} hash="#payments" />);
    expect(scroll).toHaveBeenCalled();
    view.rerender(<AuthorizedGroupOperationPage {...props} hash="todos" />);
    view.unmount();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(7);
  });

  it('tolerates a missing hash target', () => {
    vi.spyOn(document, 'getElementById').mockReturnValue(null);
    render(<AuthorizedGroupOperationPage {...props} hash="#missing" />);
    expect(document.getElementById).toHaveBeenCalledWith('missing');
  });
});
