/**
 * Membership Tabs Component
 *
 * Tabs for navigating between memberships and roles management.
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/features/shared/ui/ui/tabs';
import type { MembershipTab } from '../types/group.types';

interface MembershipTabsProps {
  activeTab: MembershipTab;
  onTabChange: (tab: MembershipTab) => void;
  membershipsByUserContent: React.ReactNode;
  membershipsByRoleContent: React.ReactNode;
  rolesContent: React.ReactNode;
  tabBarAction?: React.ReactNode;
  membershipsByUserLabel?: string;
  membershipsByRoleLabel?: string;
  rolesLabel?: string;
}

export function MembershipTabs({
  activeTab,
  onTabChange,
  membershipsByUserContent,
  membershipsByRoleContent,
  rolesContent,
  tabBarAction,
  membershipsByUserLabel = 'Memberships by user',
  membershipsByRoleLabel = 'Memberships by role',
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
          <TabsTrigger value="membershipsByUser">{membershipsByUserLabel}</TabsTrigger>
          <TabsTrigger value="membershipsByRole">{membershipsByRoleLabel}</TabsTrigger>
          <TabsTrigger value="roles">{rolesLabel}</TabsTrigger>
        </TabsList>
        {tabBarAction}
      </div>

      <TabsContent value="membershipsByUser" className="space-y-6">
        {membershipsByUserContent}
      </TabsContent>

      <TabsContent value="membershipsByRole" className="space-y-6">
        {membershipsByRoleContent}
      </TabsContent>

      <TabsContent value="roles" className="space-y-6">
        {rolesContent}
      </TabsContent>
    </Tabs>
  );
}
