import {
  isBranchEditable,
  type AmendmentProcessBranchSource,
} from '@/features/amendments/logic/amendmentBranchDisplay';
import {
  getAmendmentPermissionFlags,
  type RawAmendmentPermissionEntity,
} from '@/features/amendments/logic/amendmentPermissions';

interface CityDesignAccessOptions {
  amendment: RawAmendmentPermissionEntity | null | undefined;
  hasDocumentModeTarget?: boolean;
  hasProcessBranch?: boolean;
  selectedProcessBranch: AmendmentProcessBranchSource | null | undefined;
  userId?: string;
  hasActiveEventVotingRight?: boolean;
}

export interface CityDesignAccess {
  canChangeMode: boolean;
  canEdit: boolean;
  canEditDirectly: boolean;
  canSuggestInternally: boolean;
  canSuggestInEvent: boolean;
  readOnly: boolean;
}

export function getCityDesignAccess({
  amendment,
  hasDocumentModeTarget,
  hasProcessBranch,
  selectedProcessBranch,
  userId,
  hasActiveEventVotingRight = false,
}: CityDesignAccessOptions): CityDesignAccess {
  const permissionFlags = getAmendmentPermissionFlags(amendment, userId);
  const canEdit = permissionFlags.canChangeMode;
  const shouldUseProcessBranch = hasProcessBranch ?? Boolean(selectedProcessBranch?.id);
  const canChangeMode =
    canEdit &&
    (shouldUseProcessBranch
      ? Boolean(selectedProcessBranch?.id) && isBranchEditable(selectedProcessBranch)
      : Boolean(hasDocumentModeTarget));

  return {
    canEdit,
    canEditDirectly: canEdit,
    canSuggestInternally: canEdit,
    canSuggestInEvent: hasActiveEventVotingRight,
    canChangeMode,
    readOnly: !(canEdit || hasActiveEventVotingRight),
  };
}
