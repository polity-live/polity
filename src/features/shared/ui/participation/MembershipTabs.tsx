import type { ReactNode } from 'react';

import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/features/shared/ui/ui/tabs';

export type ParticipationTabValue =
  | 'membershipsByUser'
  | 'membershipsByRole'
  | 'composition'
  | 'rightsAlignment'
  | 'openAssignments'
  | 'guests'
  | 'roles';

export interface ParticipationTabsProps<TTab extends string = ParticipationTabValue> {
  activeTab: TTab;
  onTabChange: (tab: TTab) => void;
  membershipsByUserContent: ReactNode;
  membershipsByRoleContent: ReactNode;
  compositionContent?: ReactNode;
  rightsAlignmentContent?: ReactNode;
  openAssignmentsContent?: ReactNode;
  guestsContent?: ReactNode;
  rolesContent: ReactNode;
  tabBarAction?: ReactNode;
  showMembershipsByUser?: boolean;
  showMembershipsByRole?: boolean;
  showComposition?: boolean;
  showRightsAlignment?: boolean;
  showOpenAssignments?: boolean;
  showGuests?: boolean;
  showRoles?: boolean;
  membershipsByUserLabel?: string;
  membershipsByRoleLabel?: string;
  compositionLabel?: string;
  rightsAlignmentLabel?: string;
  openAssignmentsLabel?: string;
  guestsLabel?: string;
  rolesLabel?: string;
}

export function ParticipationTabs<TTab extends string = ParticipationTabValue>({
  activeTab,
  onTabChange,
  membershipsByUserContent,
  membershipsByRoleContent,
  compositionContent,
  rightsAlignmentContent,
  openAssignmentsContent,
  guestsContent,
  rolesContent,
  tabBarAction,
  showMembershipsByUser = true,
  showMembershipsByRole = true,
  showComposition = false,
  showRightsAlignment = false,
  showOpenAssignments = false,
  showGuests = true,
  showRoles = true,
  membershipsByUserLabel = translateText('generated.inline.0097_memberships_by_user_6e8b52a5'),
  membershipsByRoleLabel = translateText('generated.inline.0098_memberships_by_role_b2e0e498'),
  compositionLabel = 'Zusammensetzung',
  rightsAlignmentLabel = translateText('generated.inline.0099_rights_alignment_3350d985'),
  openAssignmentsLabel = translateText('generated.inline.0100_offene_auftr_ge_d99433e5'),
  guestsLabel = 'Guests',
  rolesLabel = 'Roles',
}: ParticipationTabsProps<TTab>) {
  return (
    <Tabs
      value={activeTab}
      onValueChange={value => onTabChange(value as TTab)}
      className="space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          {showMembershipsByUser ? (
            <TabsTrigger value="membershipsByUser">{membershipsByUserLabel}</TabsTrigger>
          ) : null}
          {showMembershipsByRole ? (
            <TabsTrigger value="membershipsByRole">{membershipsByRoleLabel}</TabsTrigger>
          ) : null}
          {showComposition ? (
            <TabsTrigger value="composition">{compositionLabel}</TabsTrigger>
          ) : null}
          {showRightsAlignment ? (
            <TabsTrigger value="rightsAlignment">{rightsAlignmentLabel}</TabsTrigger>
          ) : null}
          {showOpenAssignments ? (
            <TabsTrigger value="openAssignments">{openAssignmentsLabel}</TabsTrigger>
          ) : null}
          {showGuests ? <TabsTrigger value="guests">{guestsLabel}</TabsTrigger> : null}
          {showRoles ? <TabsTrigger value="roles">{rolesLabel}</TabsTrigger> : null}
        </TabsList>
        {tabBarAction}
      </div>

      {showMembershipsByUser ? (
        <TabsContent value="membershipsByUser" className="space-y-6">
          {membershipsByUserContent}
        </TabsContent>
      ) : null}

      {showMembershipsByRole ? (
        <TabsContent value="membershipsByRole" className="space-y-6">
          {membershipsByRoleContent}
        </TabsContent>
      ) : null}

      {showComposition ? (
        <TabsContent value="composition" className="space-y-6">
          {compositionContent}
        </TabsContent>
      ) : null}

      {showRightsAlignment ? (
        <TabsContent value="rightsAlignment" className="space-y-6">
          {rightsAlignmentContent}
        </TabsContent>
      ) : null}

      {showOpenAssignments ? (
        <TabsContent value="openAssignments" className="space-y-6">
          {openAssignmentsContent}
        </TabsContent>
      ) : null}

      {showGuests ? (
        <TabsContent value="guests" className="space-y-6">
          {guestsContent}
        </TabsContent>
      ) : null}

      {showRoles ? (
        <TabsContent value="roles" className="space-y-6">
          {rolesContent}
        </TabsContent>
      ) : null}
    </Tabs>
  );
}
