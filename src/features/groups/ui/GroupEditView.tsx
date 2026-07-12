/**
 * Group Edit Component
 *
 * Complete group editing UI with loading and error states.
 * Handles data fetching, form display, and navigation.
 */

import { Button } from '@/features/shared/ui/ui/button';
import { PageSkeleton } from '@/features/shared/ui/feedback';
import { GroupEditForm } from './GroupEditForm';
import type { GroupType } from '../hooks/useGroupUpdate';
import { SettingsPage } from '@/features/shared/ui/form';
export interface GroupEditViewProps {
  groupId: any;
  navigate: any;
  t: any;
  group: any;
  isLoading: any;
  groupConnections: any;
  user: any;
  connectedRelationshipDirections: any;
  connectedGroupId: any;
  primarySiblingConnection: any;
  fallbackCanonicalMembershipMode: any;
  getRelativeSiblingMembershipDirection: any;
  initialFormData: any;
  activeTab?: 'general' | 'relationships' | 'contact';
  onTabChange?: (tab: 'general' | 'relationships' | 'contact') => void;
}

export function GroupEditView({
  groupId,
  navigate,
  t,
  group,
  isLoading,
  user,
  initialFormData,
  activeTab,
  onTabChange,
}: GroupEditViewProps) {
  // Loading state
  if (isLoading) {
    return <PageSkeleton variant="settings" label={t('features.groups.editPage.loading')} />;
  }

  // Not found state
  if (!group) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-lg font-semibold">{t('features.groups.editPage.notFound')}</p>
          <p className="text-muted-foreground">
            {t('features.groups.editPage.notFoundDescription')}
          </p>
          <div className="mt-6">
            <Button onClick={() => navigate({ to: '/home' })} variant="default">
              {t('features.groups.backToGroups')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Main edit view
  return (
    <SettingsPage
      title={t('features.groups.editPage.title')}
      description={t('features.groups.editPage.subtitle')}
      headingMode="sr-only"
    >
      <GroupEditForm
        groupId={groupId}
        initialData={initialFormData}
        onCancel={() => navigate({ to: `/group/${groupId}` })}
        actorId={user?.id ?? undefined}
        visibility={group?.visibility as 'public' | 'private' | 'authenticated' | undefined}
        groupType={group.group_type as GroupType}
        hasHierarchyChildren={group.has_hierarchy_children}
        hasSiblingConnections={group.has_sibling_connections}
        activeTab={activeTab}
        onTabChange={onTabChange}
      />
    </SettingsPage>
  );
}
