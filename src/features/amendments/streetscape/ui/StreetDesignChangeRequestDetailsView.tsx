import { MessageSquare, PencilLine, Vote, X } from 'lucide-react';
import { Button } from '@/features/shared/ui/ui/button';
import { BadgeControl } from '@/features/shared/ui/status';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { StreetDesignChangeRequest } from '../logic/streetDesignChangeRequests';
import {
  formatStreetDesignChangeRequestIdentifier,
  formatStreetDesignChangeRequestTitle,
  getStreetDesignChangeRequestDiffRows,
  getStreetDesignChangeRequestTone,
} from '../logic/streetDesignChangeRequests';

interface StreetDesignChangeRequestDetailsViewProps {
  changeRequest: StreetDesignChangeRequest;
  onClearSelection: () => void;
}

export function StreetDesignChangeRequestDetailsView({
  changeRequest,
  onClearSelection,
}: StreetDesignChangeRequestDetailsViewProps) {
  const { t } = useTranslation();
  const diffRows = getStreetDesignChangeRequestDiffRows(changeRequest);
  const tone = getStreetDesignChangeRequestTone(changeRequest);

  return (
    <aside className="bg-background/95 min-w-0 border-b p-4 xl:border-b-0 xl:border-l">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <BadgeControl variant="outline">
            {t('features.amendments.streetscape.changeRequests.badge')}
          </BadgeControl>
          <div>
            <p className="text-muted-foreground font-mono text-[11px]">
              {formatStreetDesignChangeRequestIdentifier(changeRequest)}
            </p>
            <h2 className="text-base leading-tight font-semibold">
              {formatStreetDesignChangeRequestTitle(changeRequest)}
            </h2>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          title={t('features.amendments.streetscape.changeRequests.close')}
          aria-label={t('features.amendments.streetscape.changeRequests.close')}
          onClick={onClearSelection}
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="space-y-4">
        <div className="bg-muted/15 rounded-md border p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold">
              {t('features.amendments.streetscape.changeRequests.type')}
            </span>
            <BadgeControl variant="secondary">
              {t(`features.amendments.streetscape.changeRequests.tones.${tone}`)}
            </BadgeControl>
          </div>
          <p className="text-muted-foreground text-xs leading-5">
            {changeRequest.description ??
              changeRequest.source_title ??
              t('features.amendments.streetscape.changeRequests.noDescription')}
          </p>
        </div>

        <Button type="button" variant="outline" className="w-full justify-start" disabled>
          <PencilLine className="size-4" />
          {t('features.amendments.streetscape.changeRequests.edit')}
        </Button>

        <section className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <PencilLine className="text-muted-foreground size-4" />
            {t('features.amendments.streetscape.changeRequests.diff')}
          </div>
          {diffRows.length === 0 ? (
            <div className="text-muted-foreground bg-background/80 rounded-md border px-3 py-3 text-sm">
              {t('features.amendments.streetscape.changeRequests.emptyDiff')}
            </div>
          ) : (
            <div className="max-h-56 space-y-2 overflow-auto">
              {diffRows.map(row => (
                <div key={row.key} className="bg-background/80 rounded-md border p-3 text-xs">
                  <p className="font-semibold">{row.key}</p>
                  <div className="mt-2 grid gap-2">
                    <div>
                      <p className="text-muted-foreground">
                        {t('features.amendments.streetscape.changeRequests.before')}
                      </p>
                      <p className="break-words">{row.before}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">
                        {t('features.amendments.streetscape.changeRequests.after')}
                      </p>
                      <p className="break-words">{row.after}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Vote className="text-muted-foreground size-4" />
            {t('features.amendments.streetscape.changeRequests.votes')}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <VoteCount
              label={t('features.amendments.streetscape.changeRequests.votesFor')}
              value={changeRequest.votes_for ?? 0}
            />
            <VoteCount
              label={t('features.amendments.streetscape.changeRequests.votesAgainst')}
              value={changeRequest.votes_against ?? 0}
            />
            <VoteCount
              label={t('features.amendments.streetscape.changeRequests.votesAbstain')}
              value={changeRequest.votes_abstain ?? 0}
            />
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <MessageSquare className="text-muted-foreground size-4" />
            {t('features.amendments.streetscape.changeRequests.comments')}
          </div>
          <div className="text-muted-foreground bg-background/80 rounded-md border px-3 py-3 text-sm">
            {t('features.amendments.streetscape.changeRequests.noComments')}
          </div>
        </section>
      </div>
    </aside>
  );
}

function VoteCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-background/80 rounded-md border px-3 py-2 text-center">
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-muted-foreground text-[11px]">{label}</p>
    </div>
  );
}
