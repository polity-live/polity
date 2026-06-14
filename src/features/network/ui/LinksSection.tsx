/**
 * Links Section Component
 *
 * Displays group links with add functionality.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/features/shared/ui/ui/card';
import { ExternalLink } from 'lucide-react';
import type { GroupLink } from '@/features/groups/types/group.types';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface LinksSectionProps {
  links: GroupLink[];
  addLinkButton: React.ReactNode;
}

export function LinksSection({ links, addLinkButton }: LinksSectionProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{translateText('generated.inline.0799_links_014bcd65')}</CardTitle>
          {addLinkButton}
        </div>
      </CardHeader>
      <CardContent>
        {links.length === 0 ? (
          <p className="text-muted-foreground">
            {translateText('generated.inline.0800_no_links_available_fe55b35d')}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {links.map(link => (
              <a
                key={link.id}
                href={link.url ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:bg-accent flex items-center gap-2 rounded-lg border p-3 transition-colors"
              >
                <ExternalLink className="text-muted-foreground h-4 w-4" />
                <span className="font-medium">{link.label}</span>
              </a>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
