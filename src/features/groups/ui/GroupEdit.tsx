/**
 * Group Edit Component
 *
 * Complete group editing UI with loading and error states.
 * Handles data fetching, form display, and navigation.
 */

interface GroupEditProps {
  groupId: string;
  activeTab?: 'general' | 'relationships' | 'contact';
  onTabChange?: (tab: 'general' | 'relationships' | 'contact') => void;
}

import { useGroupEditController } from './useGroupEditController';
import { GroupEditView } from './GroupEditView';

export function GroupEdit({ groupId, activeTab, onTabChange }: GroupEditProps) {
  const viewProps = useGroupEditController({ groupId });

  return <GroupEditView {...viewProps} activeTab={activeTab} onTabChange={onTabChange} />;
}
