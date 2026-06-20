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

interface AgendaStatsAgendaItem {
  id?: string | null;
  amendment_id?: string | null;
  amendment?: AgendaStatsAmendment | null;
  election?: readonly unknown[] | null;
}

function isOpenChangeRequest(changeRequest: AgendaStatsChangeRequest) {
  return !changeRequest.status || changeRequest.status === 'open';
}

export function computeAgendaStats(agendaItems: readonly AgendaStatsAgendaItem[]): AgendaStats {
  const electionsCount = agendaItems.reduce(
    (count, item) => count + (item.election?.length ?? 0),
    0
  );
  const amendmentsCount = agendaItems.filter(item => item.amendment_id || item.amendment).length;
  const openChangeRequestIds = new Set<string>();

  agendaItems.forEach(item => {
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
