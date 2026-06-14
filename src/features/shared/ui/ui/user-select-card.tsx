'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/features/shared/ui/ui/card.tsx';
import { Badge } from '@/features/shared/ui/ui/badge.tsx';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar.tsx';
import { User as UserIcon } from 'lucide-react';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface UserSelectCardProps {
  user: {
    id: string;
    name?: string;
    avatar?: string;
    handle?: string;
    bio?: string;
    contactEmail?: string;
  };
}

export function UserSelectCard({ user }: UserSelectCardProps) {
  return (
    <Card className="transition-all hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            {user.avatar ? <AvatarImage src={user.avatar} alt={user.name || ''} /> : null}
            <AvatarFallback>{user.name?.[0]?.toUpperCase() || '?'}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-base">
                {user.name || translateText('generated.inline.0140_unnamed_user_7e1c1a5e')}
              </CardTitle>
              <Badge variant="outline" className="flex-shrink-0">
                <UserIcon className="mr-1 h-3 w-3" />
                {translateText('generated.inline.0090_user_9f8a2389')}
              </Badge>
            </div>
            <div className="text-muted-foreground text-xs">
              {user.handle ? `@${user.handle}` : user.contactEmail}
            </div>
          </div>
        </div>
      </CardHeader>
      {user.bio && (
        <CardContent className="pt-0">
          <p className="text-muted-foreground line-clamp-2 text-xs">{user.bio}</p>
        </CardContent>
      )}
    </Card>
  );
}
