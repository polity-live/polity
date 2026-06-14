/**
 * Group Document Card Component
 *
 * Displays a single document card with metadata.
 */

import { Card, CardHeader, CardTitle, CardDescription } from '@/features/shared/ui/ui/card';
import { SmartLink } from '@/features/shared/ui/navigation/SmartLink.tsx';
import { FileText, Calendar } from 'lucide-react';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface GroupDocumentCardProps {
  document: {
    id: string;
    title?: string | null;
    created_at: number;
    updated_at: number;
    collaborators?: readonly {
      id: string;
      user?: { id: string } | null;
    }[];
  };
  href?: string;
}

/**
 * Format date to localized string
 */
function formatDate(timestamp: number | string | Date): string {
  const date = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp);
  return date.toLocaleDateString('de-DE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function GroupDocumentCard({ document, href }: GroupDocumentCardProps) {
  const collaboratorCount = document.collaborators?.length || 0;
  const content = (
    <>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {document.title}
            </CardTitle>
          </div>
        </div>
        <CardDescription className="mt-2 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs">
            <Calendar className="h-3 w-3" />
            <span>
              {translateText('generated.inline.0413_updated_702cad2f')}
              {formatDate(document.updated_at || document.created_at)}
            </span>
          </div>
          {collaboratorCount > 0 && (
            <div className="text-muted-foreground text-xs">
              {collaboratorCount}
              {translateText('generated.inline.0052_collaborator_722018f2')}
              {collaboratorCount > 1 ? 's' : ''}
            </div>
          )}
        </CardDescription>
      </CardHeader>
    </>
  );

  if (href) {
    return (
      <Card asChild className="transition-shadow hover:shadow-lg">
        <SmartLink href={href} className="block cursor-pointer">
          {content}
        </SmartLink>
      </Card>
    );
  }

  return <Card className="transition-shadow hover:shadow-lg">{content}</Card>;
}
