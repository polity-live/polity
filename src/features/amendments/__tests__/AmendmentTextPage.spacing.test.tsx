/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const useAuthMock = vi.fn();
const useUserStateMock = vi.fn();
const useAmendmentStateMock = vi.fn();

vi.mock('@tanstack/react-router', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-router')>('@tanstack/react-router');

  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('@/zero/users/useUserState', () => ({
  useUserState: (...args: unknown[]) => useUserStateMock(...args),
}));

vi.mock('@/zero/amendments/useAmendmentState', () => ({
  useAmendmentState: (...args: unknown[]) => useAmendmentStateMock(...args),
}));

vi.mock('@/features/editor/ui/EditorView', () => ({
  EditorView: () => <div data-testid="editor-view" />,
}));

vi.mock('@/features/amendments/ui/AmendmentBranchSelectorSection', () => ({
  AmendmentBranchSelectorSection: () => <div data-testid="amendment-branch-selector" />,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { Route } from '../../../routes/_authed/amendment/$id/text';

const AmendmentTextPage =
  Route.options.component ??
  (() => {
    throw new Error('Amendment text route component is missing.');
  });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('AmendmentTextPage spacing', () => {
  it('uses the app shell as its only source of top spacing', () => {
    vi.spyOn(Route, 'useParams').mockReturnValue({ id: 'amendment-1' } as never);
    vi.spyOn(Route, 'useSearch').mockReturnValue({} as never);
    useAuthMock.mockReturnValue({ user: null });
    useUserStateMock.mockReturnValue({ user: null });
    useAmendmentStateMock.mockReturnValue({
      amendment: { id: 'amendment-1', document_id: 'document-1' },
      amendmentProcess: null,
      documents: [],
    });

    const { container } = render(<AmendmentTextPage />);
    const page = container.firstElementChild;

    expect(page?.className).toContain('space-y-2');
    expect(page?.className).not.toContain('pt-5');
  });
});
