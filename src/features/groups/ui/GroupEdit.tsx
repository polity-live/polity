/**
 * Group Edit Component
 *
 * Complete group editing UI with loading and error states.
 * Handles data fetching, form display, and navigation.
 */

interface GroupEditProps {
  groupId: string;
}

import { useGroupEditController } from './useGroupEditController';
import { GroupEditView } from './GroupEditView';

export function GroupEdit({ groupId }: GroupEditProps) {
  const viewProps = useGroupEditController({ groupId });

  return <GroupEditView {...viewProps} />;
}
