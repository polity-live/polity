'use client';

import { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { Button } from '@/features/shared/ui/ui/button.tsx';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card.tsx';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation.ts';
import { cn } from '@/features/shared/utils/utils.ts';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import {
  AgendaStatusBadge,
  AgendaTypeBadge,
  AgendaEntityBadge,
  AgendaElectionModeBadge,
} from './AgendaBadges';
import type { ElectionMode } from '@/features/elections/logic/electionMode';

export type AgendaItemType = 'election' | 'vote' | 'speech' | 'discussion' | 'accreditation';
export type AgendaItemStatus = 'completed' | 'in-progress' | 'pending' | 'planned';

interface AgendaCardProps {
  id: string;
  title: string;
  description?: string;
  subtitle?: string;
  type: AgendaItemType;
  status: AgendaItemStatus;
  creatorName?: string;
  creatorAvatar?: string;
  detailsLink: string;
  detailsLabel?: string;
  footer?: ReactNode;
  className?: string;
  isActive?: boolean;
  actionButton?: ReactNode;
  dragHandle?: ReactNode;
  showMoveButton?: boolean;
  onMoveClick?: () => void;
  footerRight?: ReactNode;
  /** Related amendment — shown as a clickable tag linking to amendment wiki */
  amendment?: { id: string; title?: string | null } | null;
  /** Related election with role — shown as a clickable tag linking to group wiki */
  election?: {
    election_mode?: ElectionMode | null;
    seat_count?: number | null;
    role?: {
      title?: string | null;
      group?: { id: string; name?: string | null } | null;
    } | null;
  } | null;
}

export function AgendaCard({
  title,
  description,
  subtitle,
  type,
  status,
  creatorName,
  creatorAvatar,
  detailsLink,
  footer,
  className,
  isActive = false,
  actionButton,
  dragHandle,
  showMoveButton = false,
  onMoveClick,
  footerRight,
  amendment,
  election,
}: AgendaCardProps) {
  const { t } = useTranslation();
  const visualStatus = isActive ? 'active' : status;

  return (
    <Link to={detailsLink} className="block">
      <Card
        className={cn(
          'cursor-pointer transition-all hover:shadow-md',
          isActive &&
            'before:animate-spin-slow relative overflow-hidden before:absolute before:inset-0 before:-z-10 before:rounded-lg before:bg-gradient-to-r before:from-green-500 before:via-emerald-500 before:to-green-500 before:p-[3px]',
          className
        )}
      >
        <div className={cn(isActive && 'bg-background relative z-10 rounded-lg')}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1 space-y-1">
                <CardTitle className="text-lg">{title}</CardTitle>
                {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
                <div className="flex flex-wrap items-center gap-2">
                  <AgendaTypeBadge type={type} />
                  <AgendaStatusBadge status={visualStatus} />
                  {amendment?.title && (
                    <AgendaEntityBadge
                      label={amendment.title}
                      href={`/amendment/${amendment.id}`}
                      variant="amendment"
                    />
                  )}
                  {election?.role?.group && (
                    <AgendaEntityBadge
                      label={election.role.title ?? election.role.group.name ?? 'Role'}
                      href={`/group/${election.role.group.id}`}
                      variant="role"
                    />
                  )}
                  {election?.election_mode ? (
                    <AgendaElectionModeBadge
                      electionMode={election.election_mode}
                      seatCount={election.seat_count}
                    />
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                {dragHandle}
                {showMoveButton && onMoveClick && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={e => {
                      e.preventDefault();
                      onMoveClick();
                    }}
                    title={t('features.events.agenda.moveToEvent')}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
                {actionButton}
              </div>
            </div>
          </CardHeader>

          {description && (
            <CardContent className="pt-0">
              <p className="text-muted-foreground">{description}</p>
            </CardContent>
          )}

          {(creatorName || footer || footerRight) && (
            <CardFooter className="pt-3">
              {footer || (
                <div
                  className={cn(
                    'flex w-full items-center gap-3',
                    creatorName ? 'justify-between' : 'justify-end'
                  )}
                >
                  {creatorName ? (
                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={creatorAvatar} />
                        <AvatarFallback className="text-xs">
                          {creatorName?.[0]?.toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <span>
                        {t('features.events.agenda.by', {
                          name: creatorName || t('features.events.agenda.unspecified'),
                        })}
                      </span>
                    </div>
                  ) : null}
                  {footerRight ? <div className="flex items-center">{footerRight}</div> : null}
                </div>
              )}
            </CardFooter>
          )}
        </div>
      </Card>
    </Link>
  );
}
