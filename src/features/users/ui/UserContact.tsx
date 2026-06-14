import React from 'react';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { formatLocation } from '@/features/shared/logic/locationHelpers';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

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
          <span className="font-semibold">
            {translateText('generated.inline.1199_email_4c4e6b2d')}
          </span>
          <span>{contact.email}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">
            {translateText('generated.inline.1200_twitter_8f799b51')}
          </span>
          <span>{contact.twitter}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">
            {translateText('generated.inline.1201_website_fdba1256')}
          </span>
          <span>{contact.website}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">
            {translateText('generated.inline.1202_location_1bf39944')}
          </span>
          <span>{location}</span>
        </div>
      </CardContent>
    </Card>
  );
};
