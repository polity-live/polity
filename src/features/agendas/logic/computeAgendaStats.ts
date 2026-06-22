/**
 * Pure functions for computing agenda statistics from agenda items.
 */

export interface AgendaStats {
  electionsCount: number;
  amendmentsCount: number;
  openChangeRequestsCount: number;
}

interface AgendaStatsChangeRequest {
  id?: string | null;
  status?: string | null;
}

interface AgendaStatsAmendment {
  id?: string | null;
  change_requests?: readonly AgendaStatsChangeRequest[] | null;
}

interface AgendaStatsChangeRequestTimelineItem {
  id?: string | null;
  change_request_id?: string | null;
  is_closing_vote?: boolean | null;
  status?: string | null;
}

interface AgendaStatsAgendaItem {
  id?: string | null;
  amendment_id?: string | null;
  amendment?: AgendaStatsAmendment | null;
  election?: readonly unknown[] | null;
  change_request_timeline?: readonly AgendaStatsChangeRequestTimelineItem[] | null;
}

function isOpenChangeRequest(changeRequest: AgendaStatsChangeRequest) {
  return !changeRequest.status || changeRequest.status === 'open';
}

function isOpenTimelineChangeRequest(item: AgendaStatsChangeRequestTimelineItem) {
  return !item.is_closing_vote && (item.status === 'pending' || item.status === 'voting');
}

export function computeAgendaStats(agendaItems: readonly AgendaStatsAgendaItem[]): AgendaStats {
  const electionsCount = agendaItems.reduce(
    (count, item) => count + (item.election?.length ?? 0),
    0
  );
  const amendmentsCount = agendaItems.filter(item => item.amendment_id || item.amendment).length;
  const openChangeRequestIds = new Set<string>();

  agendaItems.forEach(item => {
    const timelineItems = item.change_request_timeline ?? [];
    if (timelineItems.length > 0) {
      timelineItems.forEach((timelineItem, index) => {
        if (!isOpenTimelineChangeRequest(timelineItem)) return;

        openChangeRequestIds.add(
          timelineItem.change_request_id ??
            timelineItem.id ??
            `${item.id ?? item.amendment_id ?? item.amendment?.id}:timeline:${index}`
        );
      });
      return;
    }

    item.amendment?.change_requests?.forEach((changeRequest, index) => {
      if (!isOpenChangeRequest(changeRequest)) return;

      openChangeRequestIds.add(
        changeRequest.id ?? `${item.id ?? item.amendment_id ?? item.amendment?.id}:unknown:${index}`
      );
    });
  });

  const openChangeRequestsCount = openChangeRequestIds.size;

  return { electionsCount, amendmentsCount, openChangeRequestsCount };
}
