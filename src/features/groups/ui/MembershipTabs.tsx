/**
 * Membership Tabs Component
 *
 * Tabs for navigating between memberships and roles management.
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/features/shared/ui/ui/tabs';
import type { MembershipTab } from '../types/group.types';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface MembershipTabsProps {
  activeTab: MembershipTab;
  onTabChange: (tab: MembershipTab) => void;
  membershipsByUserContent: React.ReactNode;
  membershipsByRoleContent: React.ReactNode;
  compositionContent?: React.ReactNode;
  rightsAlignmentContent?: React.ReactNode;
  openAssignmentsContent?: React.ReactNode;
  guestsContent?: React.ReactNode;
  rolesContent: React.ReactNode;
  tabBarAction?: React.ReactNode;
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

export function MembershipTabs({
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
}: MembershipTabsProps) {
  return (
    <Tabs
      value={activeTab}
      onValueChange={value => onTabChange(value as MembershipTab)}
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
