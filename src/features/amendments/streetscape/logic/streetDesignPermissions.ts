import {
  isBranchEditable,
  type AmendmentProcessBranchSource,
} from '@/features/amendments/logic/amendmentBranchDisplay';
import {
  getAmendmentPermissionFlags,
  type RawAmendmentPermissionEntity,
} from '@/features/amendments/logic/amendmentPermissions';

interface StreetDesignAccessOptions {
  amendment: RawAmendmentPermissionEntity | null | undefined;
  hasDocumentModeTarget?: boolean;
  hasProcessBranch?: boolean;
  selectedProcessBranch: AmendmentProcessBranchSource | null | undefined;
  userId?: string;
}

export interface StreetDesignAccess {
  canChangeMode: boolean;
  canEdit: boolean;
  readOnly: boolean;
}

export function getStreetDesignAccess({
  amendment,
  hasDocumentModeTarget,
  hasProcessBranch,
  selectedProcessBranch,
  userId,
}: StreetDesignAccessOptions): StreetDesignAccess {
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
    canChangeMode,
    readOnly: !canEdit,
  };
}
