import { Link } from '@tanstack/react-router';
import { Building2, ChevronDown, ChevronRight, ExternalLink, ScrollText } from 'lucide-react';

import { AmendmentForwardingPreview } from '@/features/amendments/ui/AmendmentForwardingPreview';
import type { AmendmentForwardingPreviewModel } from '@/features/amendments/logic/amendmentForwardingPreview';
import {
  AmendmentPathVisualization,
  type AmendmentPathVisualizationSegment,
} from '@/features/network/ui/AmendmentPathVisualization';
import { BadgeControl, EditingModeBadge } from '@/features/shared/ui/status';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/features/shared/ui/ui/collapsible';
import {
  getBranchEditingMode,
  getOrderedBranches,
} from '@/features/amendments/logic/amendmentBranchDisplay';
import { normalizeEditingMode } from '@/zero/amendments/editing-mode-policy';

interface AmendmentProcessDetailsPanelViewProps {
  amendment: {
    id: string;
    title?: string | null;
    reason?: string | null;
    preamble?: string | null;
    editing_mode?: string | null;
    current_process_run?: {
      branches?:
        | readonly {
            id: string;
            created_at?: number | string | null;
            editing_mode?: string | null;
          }[]
        | null;
    } | null;
    group?: { id: string; name?: string | null } | null;
  };
  forwardingPreview?: AmendmentForwardingPreviewModel | null;
  pathVisualizationData?: AmendmentPathVisualizationSegment[];
  groupTypeById?: Map<string, string | null>;
  onGroupClick?: (groupId: string) => void;
  onEventClick?: (eventId: string) => void;
  variant?: 'default' | 'agenda';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labels: {
    amendmentDetails: string;
    viewAmendment: string;
    title: string;
    reason: string;
    preamble: string;
    pathVisualization: string;
  };
}

export function AmendmentProcessDetailsPanelView({
  amendment,
  forwardingPreview,
  pathVisualizationData,
  groupTypeById,
  onGroupClick,
  onEventClick,
  variant = 'default',
  open,
  onOpenChange,
  labels,
}: AmendmentProcessDetailsPanelViewProps) {
  const firstBranch = getOrderedBranches(amendment.current_process_run?.branches ?? [])[0] ?? null;
  const editingMode = firstBranch
    ? getBranchEditingMode(firstBranch)
    : amendment.editing_mode
      ? normalizeEditingMode(amendment.editing_mode)
      : null;

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <div className="bg-muted/30 rounded-lg border">
        <CollapsibleTrigger className="hover:bg-muted/50 flex w-full items-center gap-2 px-4 py-3 text-sm font-medium transition-colors">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <ScrollText className="text-muted-foreground h-4 w-4" />
          <span>{labels.amendmentDetails}</span>
          {editingMode ? <EditingModeBadge mode={editingMode} variant="secondary" /> : null}
          {variant === 'default' ? (
            <Link
              to="/amendment/$id"
              params={{ id: amendment.id }}
              className="text-primary ml-auto flex items-center gap-1 text-xs hover:underline"
              onClick={event => event.stopPropagation()}
            >
              {labels.viewAmendment}
              <ExternalLink className="h-3 w-3" />
            </Link>
          ) : null}
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="space-y-3 border-t px-4 py-3">
            {variant === 'default' && amendment.title ? (
              <div>
                <p className="text-muted-foreground text-xs font-medium">{labels.title}</p>
                <Link
                  to="/amendment/$id"
                  params={{ id: amendment.id }}
                  className="text-sm hover:underline"
                >
                  {amendment.title}
                </Link>
              </div>
            ) : null}

            {variant === 'default' && amendment.reason ? (
              <div>
                <p className="text-muted-foreground text-xs font-medium">{labels.reason}</p>
                <p className="text-sm whitespace-pre-wrap">{amendment.reason}</p>
              </div>
            ) : null}

            {amendment.preamble ? (
              <div>
                <p className="text-muted-foreground text-xs font-medium">{labels.preamble}</p>
                <p className="text-sm whitespace-pre-wrap">{amendment.preamble}</p>
              </div>
            ) : null}

            {variant === 'default' ? (
              <div className="flex flex-wrap gap-2">
                {amendment.group?.id && amendment.group?.name ? (
                  <BadgeControl variant="outline" size="xs">
                    <Link
                      to="/group/$id"
                      params={{ id: amendment.group.id }}
                      className="inline-flex items-center gap-1 hover:underline"
                    >
                      <Building2 className="h-3 w-3" />
                      {amendment.group.name}
                    </Link>
                  </BadgeControl>
                ) : amendment.group?.name ? (
                  <BadgeControl variant="outline" size="xs">
                    <Building2 className="mr-1 h-3 w-3" />
                    {amendment.group.name}
                  </BadgeControl>
                ) : null}
              </div>
            ) : null}

            {forwardingPreview ? (
              <div className="space-y-3">
                <AmendmentForwardingPreview
                  status={forwardingPreview.status}
                  nextEventId={forwardingPreview.nextEventId}
                  nextGroupName={forwardingPreview.nextGroupName}
                  nextEventTitle={forwardingPreview.nextEventTitle}
                  nextEventStartDate={forwardingPreview.nextEventStartDate}
                  compact
                />
                <div className="flex flex-wrap gap-2 text-xs">
                  {forwardingPreview.nextGroupId && forwardingPreview.nextGroupName ? (
                    <Link
                      to="/group/$id"
                      params={{ id: forwardingPreview.nextGroupId }}
                      className="text-primary inline-flex items-center gap-1 hover:underline"
                    >
                      <Building2 className="h-3 w-3" />
                      {forwardingPreview.nextGroupName}
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : null}

            {pathVisualizationData && pathVisualizationData.length > 0 ? (
              <div className="space-y-2">
                <p className="text-muted-foreground text-xs font-medium">
                  {labels.pathVisualization}
                </p>
                <div className="h-[340px] rounded-lg border">
                  <AmendmentPathVisualization
                    enrichedPathData={pathVisualizationData}
                    groupTypeById={groupTypeById ?? new Map<string, string | null>()}
                    onGroupClick={onGroupClick}
                    onNodeClick={onEventClick}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
