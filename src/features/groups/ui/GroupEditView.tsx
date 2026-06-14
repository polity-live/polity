/**
 * Group Edit Component
 *
 * Complete group editing UI with loading and error states.
 * Handles data fetching, form display, and navigation.
 */

import { Button } from '@/features/shared/ui/ui/button';
import { Loader2 } from 'lucide-react';
import { GroupEditForm } from './GroupEditForm';
import type { GroupType } from '../hooks/useGroupUpdate';
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
}

export function GroupEditView({
  groupId,
  navigate,
  t,
  group,
  isLoading,
  user,
  initialFormData,
}: GroupEditViewProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
        <p className="text-muted-foreground">{t('features.groups.editPage.loading')}</p>
      </div>
    );
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
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{t('features.groups.editPage.title')}</h1>
        <p className="text-muted-foreground">{t('features.groups.editPage.subtitle')}</p>
      </div>

      <GroupEditForm
        groupId={groupId}
        initialData={initialFormData}
        onCancel={() => navigate({ to: `/group/${groupId}` })}
        actorId={user?.id ?? undefined}
        visibility={group?.visibility as 'public' | 'private' | 'authenticated' | undefined}
        groupType={group.group_type as GroupType}
      />
    </div>
  );
}
