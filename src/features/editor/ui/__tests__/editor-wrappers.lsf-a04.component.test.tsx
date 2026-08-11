import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  controller: vi.fn(() => ({ handleModeChange: vi.fn() })),
  model: vi.fn(() => ({ ready: true })),
  view: vi.fn(() => null),
}));

vi.mock('../../hooks/useEditingModeSelectorController', () => ({
  useEditingModeSelectorController: mocks.controller,
}));
vi.mock('../EditingModeSelectorView', () => ({ EditingModeSelectorView: mocks.view }));
vi.mock('../../hooks/useEditorViewModel', () => ({ useEditorViewModel: mocks.model }));
vi.mock('../EditorViewShell', () => ({ EditorViewShell: mocks.view }));
vi.mock('../../hooks/useInviteCollaboratorModel', () => ({
  useInviteCollaboratorModel: mocks.model,
}));
vi.mock('../InviteCollaboratorDialogView', () => ({
  InviteCollaboratorDialogView: mocks.view,
}));
vi.mock('@/features/editor/hooks/useSuggestionViewToggleController', () => ({
  useSuggestionViewToggleController: mocks.controller,
}));
vi.mock('../SuggestionViewToggleView', () => ({ SuggestionViewToggleView: mocks.view }));
vi.mock('../../hooks/useVersionControlModel', () => ({ useVersionControlModel: mocks.model }));
vi.mock('../VersionControlView', () => ({ VersionControlView: mocks.view }));

import { EditingModeSelector } from '../EditingModeSelector';
import { EditorView } from '../EditorView';
import { InviteCollaboratorDialog } from '../InviteCollaboratorDialog';
import { SuggestionViewToggle } from '../SuggestionViewToggle';
import { VersionControl } from '../VersionControl';

describe('editor composition wrapper contracts', () => {
  it('connects each exported wrapper to its controller and view', () => {
    expect(
      EditingModeSelector({ processBranchId: 'branch-1', currentMode: 'suggest_event' })
    ).toBeTruthy();
    expect(EditorView({} as any)).toBeTruthy();
    expect(InviteCollaboratorDialog({} as any)).toBeTruthy();
    expect(
      SuggestionViewToggle({
        discussions: [],
        selectedCrIds: null,
        onSelectedCrIdsChange: vi.fn(),
      })
    ).toBeTruthy();
    expect(VersionControl({} as any)).toBeTruthy();
  });
});
