import { encodeAppError } from '@/features/shared/errors';

export interface DelegateAssemblyGroupEligibilityLike {
  group_type?: string | null;
  has_hierarchy_children?: boolean | null;
  has_sibling_connections?: boolean | null;
}

export function canCreateDelegateAssemblyForGroup(
  group: DelegateAssemblyGroupEligibilityLike | null | undefined
) {
  if (!group) {
    return false;
  }

  return group.has_hierarchy_children ?? group.group_type === 'hierarchical';
}

export const DELEGATE_ASSEMBLY_GROUP_ELIGIBILITY_MESSAGE = encodeAppError(
  'delegate_assembly_invalid'
);
