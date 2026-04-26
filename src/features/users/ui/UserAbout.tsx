import React from 'react';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { RichTextPreview } from '@/features/shared/ui/rich-text/RichTextPreview';

interface UserAboutProps {
  about: unknown;
}

export const UserAbout: React.FC<UserAboutProps> = ({ about }) => (
  <Card>
    <CardContent className="pt-6">
      <RichTextPreview content={about} />
    </CardContent>
  </Card>
);
