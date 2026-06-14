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
}: GroupEditFormProps) {
  const viewProps = useGroupEditFormController({
    groupId,
    initialData,
    onCancel,
    actorId,
    visibility,
    groupType,
  });

  return <GroupEditFormView {...viewProps} />;
}
