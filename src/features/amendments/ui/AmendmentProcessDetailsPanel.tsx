'use client';

import { BadgeControl } from '@/features/shared/ui/status';
import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Building2, ChevronDown, ChevronRight, ExternalLink, ScrollText } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/features/shared/ui/ui/collapsible';
import { EditingModeBadge } from '@/features/shared/ui/ui/editing-mode.tsx';
import { AmendmentForwardingPreview } from '@/features/amendments/ui/AmendmentForwardingPreview';
import {
  AmendmentPathVisualization,
  type AmendmentPathVisualizationSegment,
} from '@/features/network/ui/AmendmentPathVisualization';

interface AmendmentProcessDetailsPanelProps {
  amendment: {
    id: string;
    title?: string | null;
    reason?: string | null;
    preamble?: string | null;
    editing_mode?: string | null;
    group?: { id: string; name?: string | null } | null;
  };
  forwardingPreview?: {
    nextGroupId?: string | null;
    nextGroupName?: string | null;
    nextEventId?: string | null;
    nextEventTitle: string;
    nextEventStartDate?: number | null;
  } | null;
  pathVisualizationData?: AmendmentPathVisualizationSegment[];
  groupTypeById?: Map<string, string | null>;
  onGroupClick?: (groupId: string) => void;
  onEventClick?: (eventId: string) => void;
  defaultOpen?: boolean;
}

export function AmendmentProcessDetailsPanel({
  amendment,
  forwardingPreview,
  pathVisualizationData,
  groupTypeById,
  onGroupClick,
  onEventClick,
  defaultOpen = true,
}: AmendmentProcessDetailsPanelProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="bg-muted/30 rounded-lg border">
        <CollapsibleTrigger className="hover:bg-muted/50 flex w-full items-center gap-2 px-4 py-3 text-sm font-medium transition-colors">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <ScrollText className="text-muted-foreground h-4 w-4" />
          <span>{t('features.events.agenda.amendmentDetails')}</span>
          {amendment.editing_mode ? (
            <EditingModeBadge mode={amendment.editing_mode} variant="secondary" />
          ) : null}
          <Link
            to="/amendment/$id"
            params={{ id: amendment.id }}
            className="text-primary ml-auto flex items-center gap-1 text-xs hover:underline"
            onClick={event => event.stopPropagation()}
          >
            {t('features.events.agenda.viewAmendment')}
            <ExternalLink className="h-3 w-3" />
          </Link>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="space-y-3 border-t px-4 py-3">
            {amendment.title ? (
              <div>
                <p className="text-muted-foreground text-xs font-medium">{t('common.title')}</p>
                <Link
                  to="/amendment/$id"
                  params={{ id: amendment.id }}
                  className="text-sm hover:underline"
                >
                  {amendment.title}
                </Link>
              </div>
            ) : null}

            {amendment.reason ? (
              <div>
                <p className="text-muted-foreground text-xs font-medium">
                  {t('features.amendments.reason')}
                </p>
                <p className="text-sm whitespace-pre-wrap">{amendment.reason}</p>
              </div>
            ) : null}

            {amendment.preamble ? (
              <div>
                <p className="text-muted-foreground text-xs font-medium">
                  {t('features.amendments.preamble')}
                </p>
                <p className="text-sm whitespace-pre-wrap">{amendment.preamble}</p>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {amendment.group?.id && amendment.group?.name ? (
                <BadgeControl variant="outline" className="text-xs">
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
                <BadgeControl variant="outline" className="text-xs">
                  <Building2 className="mr-1 h-3 w-3" />
                  {amendment.group.name}
                </BadgeControl>
              ) : null}
            </div>

            {forwardingPreview ? (
              <div className="space-y-3">
                <AmendmentForwardingPreview
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
                  {t('features.amendments.process.pathVisualization')}
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
