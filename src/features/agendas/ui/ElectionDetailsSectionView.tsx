import { Link } from '@tanstack/react-router';
import {
  Building2,
  Calendar,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  UserCheck,
} from 'lucide-react';

import type { ElectionMode } from '@/features/elections/logic/electionMode';

import { BadgeControl } from '@/features/shared/ui/status';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/features/shared/ui/ui/collapsible';

import { AgendaElectionModeBadge } from './AgendaBadges';

interface ElectionDetailsSectionViewProps {
  election: {
    election_mode?: ElectionMode | null;
    seat_count?: number | null;
    role?: {
      id: string;
      title?: string | null;
      description?: string | null;
      term?: string | null;
      group_id?: string | null;
      group?: { id: string; name?: string | null } | null;
    } | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labels: {
    roleDetails: string;
    viewGroup: string;
    role: string;
    description: string;
    term: string;
  };
}

export function ElectionDetailsSectionView({
  election,
  open,
  onOpenChange,
  labels,
}: ElectionDetailsSectionViewProps) {
  const role = election.role;
  const group = role?.group;

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <div className="bg-muted/30 rounded-lg border">
        <CollapsibleTrigger className="hover:bg-muted/50 flex w-full items-center gap-2 px-4 py-3 text-sm font-medium transition-colors">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <UserCheck className="text-muted-foreground h-4 w-4" />
          <span>{labels.roleDetails}</span>
          {group && (
            <Link
              to="/group/$id"
              params={{ id: group.id }}
              className="text-primary ml-auto flex items-center gap-1 text-xs hover:underline"
              onClick={e => e.stopPropagation()}
            >
              {group.name ?? labels.viewGroup}
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="space-y-3 border-t px-4 py-3">
            {role?.title && (
              <div>
                <p className="text-muted-foreground text-xs font-medium">{labels.role}</p>
                <p className="text-sm">{role.title}</p>
              </div>
            )}

            {role?.description && (
              <div>
                <p className="text-muted-foreground text-xs font-medium">{labels.description}</p>
                <p className="text-sm whitespace-pre-wrap">{role.description}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {election.election_mode ? (
                <AgendaElectionModeBadge
                  electionMode={election.election_mode}
                  seatCount={election.seat_count}
                />
              ) : null}
              {role?.term && (
                <BadgeControl variant="secondary" size="xs">
                  <Calendar className="mr-1 h-3 w-3" />
                  {labels.term}: {role.term}
                </BadgeControl>
              )}
              {group?.name && (
                <BadgeControl variant="outline" size="xs">
                  <Building2 className="mr-1 h-3 w-3" />
                  {group.name}
                </BadgeControl>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
