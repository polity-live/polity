import React from 'react';
import { Tabs, TabsContent, TabsTrigger } from '@/features/shared/ui/ui/tabs';
import { ScrollableTabsList } from '@/features/shared/ui/ui/scrollable-tabs';
import { UserAbout } from './UserAbout';
import { UserContact } from './UserContact';

interface UserInfoTabsProps {
  about: unknown;
  contact: {
    email: string;
    twitter: string;
    website: string;
    location?: string;
    country?: string;
    region?: string;
    post_code?: string;
    city?: string;
    street?: string;
    house_number?: string;
  };
}

export const UserInfoTabs: React.FC<UserInfoTabsProps> = ({ about, contact }) => (
  <Tabs defaultValue="about" className="mb-12">
    <ScrollableTabsList>
      <TabsTrigger value="about">About</TabsTrigger>
      <TabsTrigger value="contact">Contact</TabsTrigger>
    </ScrollableTabsList>
    <TabsContent value="about" className="mt-4">
      <UserAbout about={about} />
    </TabsContent>
    <TabsContent value="contact" className="mt-4">
      <UserContact contact={contact} />
    </TabsContent>
  </Tabs>
);
