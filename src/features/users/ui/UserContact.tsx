import React from 'react';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { formatLocation } from '@/features/shared/logic/locationHelpers';

interface UserContactProps {
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

export const UserContact: React.FC<UserContactProps> = ({ contact }) => {
  const location = contact.location || formatLocation(contact);

  return (
    <Card>
      <CardContent className="space-y-2 pt-6">
        <div className="flex items-center gap-2">
          <span className="font-semibold">Email:</span>
          <span>{contact.email}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">Twitter:</span>
          <span>{contact.twitter}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">Website:</span>
          <span>{contact.website}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">Location:</span>
          <span>{location}</span>
        </div>
      </CardContent>
    </Card>
  );
};
