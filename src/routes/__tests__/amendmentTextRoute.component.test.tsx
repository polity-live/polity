/* @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  amendmentState: {} as Record<string, any>,
  authUser: null as null | { id: string },
  buildCandidates: vi.fn(),
  displayEvent: vi.fn(),
  editor: vi.fn(),
  latest: vi.fn(),
  navigate: vi.fn(),
  pathLabel: vi.fn(),
  resolveSelected: vi.fn(),
  search: { branch: undefined as string | undefined },
  selector: vi.fn(),
  userRecord: undefined as undefined | Record<string, any>,
  winner: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useParams: () => ({ id: 'amendment-1' }),
    useSearch: () => mocks.search,
  }),
  useNavigate: () => mocks.navigate,
}));
vi.mock('lucide-react', () => ({ MessageSquareWarning: () => <span data-icon="warning" /> }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values?.branch ? `${key}:${values.branch}` : key,
  }),
}));
vi.mock('@/features/editor/ui/EditorView', () => ({
  EditorView: (props: Record<string, unknown>) => {
    mocks.editor(props);
    return <div>editor</div>;
  },
}));
vi.mock('@/features/amendments/ui/AmendmentBranchSelectorSection', () => ({
  AmendmentBranchSelectorSection: (props: Record<string, unknown>) => {
    mocks.selector(props);
    return <div>selector</div>;
  },
}));
vi.mock('@/features/amendments/logic/amendmentBranchDisplay', () => ({
  READONLY_BRANCH_RESOLUTIONS: new Set(['readonly']),
  TERMINAL_BRANCH_STATUSES: new Set(['terminal']),
  buildBranchDiffCandidates: mocks.buildCandidates,
  getBranchDisplayEvent: mocks.displayEvent,
  getBranchPathLabel: mocks.pathLabel,
  getLatestBranchWithContent: mocks.latest,
  getWinnerBranch: mocks.winner,
  resolveSelectedBranchId: mocks.resolveSelected,
}));
vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: mocks.authUser }),
}));
vi.mock('@/zero/users/useUserState', () => ({
  useUserState: () => ({ user: mocks.userRecord }),
}));
vi.mock('@/zero/amendments/useAmendmentState', () => ({
  useAmendmentState: () => mocks.amendmentState,
}));

import { Route } from '../_authed/amendment/$id/text';

const Component = (Route as unknown as { component: React.ComponentType }).component;

function branch(overrides: Record<string, any> = {}) {
  return {
    id: 'branch-1',
    status: 'active',
    resolution: null,
    merged_into_branch_id: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.amendmentState = { amendment: undefined, amendmentProcess: undefined, documents: [] };
  mocks.authUser = null;
  mocks.buildCandidates.mockReturnValue([]);
  mocks.displayEvent.mockReturnValue(null);
  mocks.latest.mockReturnValue(undefined);
  mocks.navigate.mockResolvedValue(undefined);
  mocks.pathLabel.mockReturnValue('Branch path');
  mocks.resolveSelected.mockReturnValue(null);
  mocks.search = { branch: undefined };
  mocks.userRecord = undefined;
  mocks.winner.mockReturnValue(null);
});

afterEach(() => cleanup());

describe('amendment text route', () => {
  it('renders the empty anonymous state with safe defaults', () => {
    render(<Component />);
    expect(screen.queryByText('selector')).toBeNull();
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.buildCandidates).toHaveBeenCalledWith({
      branches: [],
      originalContent: null,
      activeBranchId: null,
    });
    expect(mocks.editor).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: undefined,
        readOnly: true,
        showTopToolbar: false,
        userRecord: undefined,
        agendaItemId: undefined,
        processBranchId: null,
      })
    );
  });

  it('renders a selected branch, matching document and authenticated user', () => {
    const selected = branch();
    mocks.search = { branch: 'branch-1' };
    mocks.resolveSelected.mockReturnValue('branch-1');
    mocks.winner.mockReturnValue(selected);
    mocks.displayEvent.mockReturnValue({ agenda_item_id: 'agenda-event' });
    mocks.authUser = { id: 'user-1' };
    mocks.userRecord = {
      id: 'user-1',
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@example.com',
      avatar: 'avatar.png',
    };
    mocks.amendmentState = {
      amendment: { document_id: 'document-2' },
      amendmentProcess: {
        current_process_run: { active_branch_id: 'branch-1', branches: [selected] },
        agenda_items: [{ id: 'agenda-fallback' }],
      },
      documents: [
        { id: 'document-1', content: 'first' },
        { id: 'document-2', content: 'original' },
      ],
    };

    render(<Component />);
    expect(screen.getByText('selector')).toBeTruthy();
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.buildCandidates).toHaveBeenCalledWith(
      expect.objectContaining({ originalContent: 'original' })
    );
    expect(mocks.selector).toHaveBeenLastCalledWith(
      expect.objectContaining({ defaultDiffRightCandidateId: 'branch-1' })
    );
    expect(mocks.editor).toHaveBeenLastCalledWith(
      expect.objectContaining({
        readOnly: false,
        showTopToolbar: true,
        agendaItemId: 'agenda-event',
        userRecord: {
          id: 'user-1',
          name: 'Ada Lovelace',
          email: 'ada@example.com',
          avatar: 'avatar.png',
        },
      })
    );

    const onBranchChange = mocks.selector.mock.calls.at(-1)?.[0].onBranchChange;
    onBranchChange(null);
    onBranchChange('branch-2');
    expect(mocks.navigate).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: { branch: 'branch-2' } })
    );
  });

  it('canonicalizes selection and shows a terminal merged-branch notice', async () => {
    const mergeTarget = branch({ id: 'winner' });
    const selected = branch({
      id: 'rejected',
      status: 'terminal',
      merged_into_branch_id: 'winner',
    });
    mocks.resolveSelected.mockReturnValue('rejected');
    mocks.latest.mockReturnValue(mergeTarget);
    mocks.amendmentState = {
      amendment: { document_id: 'missing-document' },
      amendmentProcess: {
        current_process_run: { active_branch_id: null, branches: [selected, mergeTarget] },
        agenda_items: [{ id: 'agenda-fallback' }],
      },
      documents: [{ id: 'document-1', content: undefined }],
    };
    mocks.userRecord = { id: 'user-1', first_name: '', last_name: '', handle: null };
    mocks.authUser = { id: 'user-1' };

    render(<Component />);
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({
        to: '/amendment/$id/text',
        params: { id: 'amendment-1' },
        search: { branch: 'rejected' },
        replace: true,
      })
    );
    expect(document.querySelector('[data-icon="warning"]')).toBeTruthy();
    expect(screen.getByText(/rejectedInFavorOf:Branch path/)).toBeTruthy();
    expect(mocks.buildCandidates).toHaveBeenCalledWith(
      expect.objectContaining({ originalContent: null })
    );
    expect(mocks.selector).toHaveBeenLastCalledWith(
      expect.objectContaining({ defaultDiffRightCandidateId: 'winner' })
    );
    expect(mocks.editor).toHaveBeenLastCalledWith(
      expect.objectContaining({
        agendaItemId: 'agenda-fallback',
        userRecord: expect.objectContaining({
          name: undefined,
          email: undefined,
          avatar: undefined,
        }),
      })
    );
  });

  it('uses embedded merge targets and readonly resolutions without a terminal status', () => {
    const mergeTarget = branch({ id: 'embedded' });
    const selected = branch({
      id: 'rejected',
      resolution: 'readonly',
      merged_into_branch_id: 'missing',
      merged_into_branch: mergeTarget,
    });
    mocks.search = { branch: 'rejected' };
    mocks.resolveSelected.mockReturnValue('rejected');
    mocks.amendmentState = {
      amendment: {},
      amendmentProcess: {
        current_process_run: { active_branch_id: undefined, branches: [selected] },
        agenda_items: [],
      },
      documents: [],
    };
    render(<Component />);
    expect(document.querySelector('[data-icon="warning"]')).toBeTruthy();
  });

  it('suppresses the notice when a merge target is absent or not readonly', () => {
    const selected = branch({ merged_into_branch_id: 'missing' });
    mocks.search = { branch: 'branch-1' };
    mocks.resolveSelected.mockReturnValue('branch-1');
    mocks.amendmentState = {
      amendment: {},
      amendmentProcess: {
        current_process_run: { active_branch_id: null, branches: [selected] },
      },
      documents: [],
    };
    render(<Component />);
    expect(document.querySelector('[data-icon="warning"]')).toBeNull();
  });

  it('canonicalizes an invalid requested branch to an empty search value', async () => {
    mocks.search = { branch: 'unknown' };
    mocks.resolveSelected.mockReturnValue(null);
    mocks.userRecord = { id: 'user-1', first_name: undefined, last_name: null };
    mocks.authUser = { id: 'user-1' };
    mocks.amendmentState = {
      amendment: {},
      amendmentProcess: {
        current_process_run: { active_branch_id: null, branches: [branch()] },
      },
      documents: [],
    };
    render(<Component />);
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith(
        expect.objectContaining({ search: { branch: undefined }, replace: true })
      )
    );
    expect(mocks.editor).toHaveBeenLastCalledWith(
      expect.objectContaining({ userRecord: expect.objectContaining({ name: undefined }) })
    );
  });
});
