/**
 * Pure functions for computing agenda statistics from agenda items.
 */

export interface AgendaStats {
  electionsCount: number;
  amendmentsCount: number;
  openChangeRequestsCount: number;
}

export function computeAgendaStats(
  agendaItems: readonly { election?: readonly unknown[] | null }[]
): AgendaStats {
  const electionsCount = agendaItems.filter(item => item.election?.length).length;
  // amendmentVote relation is not currently on the wiki agenda query
  const amendmentsCount = 0;
  const openChangeRequestsCount = 0;

  return { electionsCount, amendmentsCount, openChangeRequestsCount };
}
