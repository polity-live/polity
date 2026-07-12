/**
 * Group Edit Form Component
 *
 * Complete form for editing group information including basic info,
 * location, social media, and image upload.
 */

import type { GroupFormData, GroupType } from '../hooks/useGroupUpdate';
interface GroupEditFormProps {
  groupId: string;
  initialData?: Partial<GroupFormData>;
  onCancel?: () => void;
  actorId?: string;
  visibility?: 'public' | 'private' | 'authenticated';
  groupType?: GroupType;
  hasHierarchyChildren?: boolean | null;
  hasSiblingConnections?: boolean | null;
  activeTab?: 'general' | 'relationships' | 'contact';
  onTabChange?: (tab: 'general' | 'relationships' | 'contact') => void;
}

import { useGroupEditFormController } from './useGroupEditFormController';
import { GroupEditFormView } from './GroupEditFormView';

export function GroupEditForm({
  groupId,
  initialData,
  onCancel,
  actorId,
  visibility,
  groupType,
  hasHierarchyChildren,
  hasSiblingConnections,
  activeTab,
  onTabChange,
}: GroupEditFormProps) {
  const viewProps = useGroupEditFormController({
    groupId,
    initialData,
    onCancel,
    actorId,
    visibility,
    groupType,
    hasHierarchyChildren,
    hasSiblingConnections,
    activeTab,
    onTabChange,
  });

  return <GroupEditFormView {...viewProps} />;
}
