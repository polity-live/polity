export interface BranchPreservingAmendmentNavTarget {
  href: string;
  params: { id: string };
  search: { branch: string };
  to: string;
}

export function getBranchPreservingAmendmentNavTarget({
  itemId,
  amendmentId,
  branchId,
}: {
  itemId: string;
  amendmentId?: string | null;
  branchId?: string | null;
}): BranchPreservingAmendmentNavTarget | null {
  if (!amendmentId || !branchId) return null;

  const route =
    itemId === 'text'
      ? {
          hrefPath: `/amendment/${encodeURIComponent(amendmentId)}/text`,
          to: '/amendment/$id/text',
        }
      : itemId === 'changeRequests'
        ? {
            hrefPath: `/amendment/${encodeURIComponent(amendmentId)}/change-requests`,
            to: '/amendment/$id/change-requests',
          }
        : itemId === 'process'
          ? {
              hrefPath: `/amendment/${encodeURIComponent(amendmentId)}/process`,
              to: '/amendment/$id/process',
            }
          : null;

  if (!route) return null;

  return {
    to: route.to,
    params: { id: amendmentId },
    href: `${route.hrefPath}?branch=${encodeURIComponent(branchId)}`,
    search: { branch: branchId },
  };
}
