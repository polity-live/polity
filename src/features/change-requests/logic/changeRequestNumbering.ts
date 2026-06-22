export function parseChangeRequestCrId(value: string | null | undefined): number | null {
  const match = value?.match(/^CR-(\d+)$/);
  return match ? Number.parseInt(match[1], 10) : null;
}

export function formatChangeRequestCrId(sequenceNumber: number | null | undefined) {
  return typeof sequenceNumber === 'number' && Number.isFinite(sequenceNumber) && sequenceNumber > 0
    ? `CR-${Math.floor(sequenceNumber)}`
    : null;
}

export function getChangeRequestSequenceNumber(row: {
  branch_sequence_number?: number | null;
  branchSequenceNumber?: number | null;
  crNumber?: number | null;
  crId?: string | null;
  cr_id?: string | null;
  title?: string | null;
}) {
  const persisted = row.branch_sequence_number ?? row.branchSequenceNumber;
  if (typeof persisted === 'number' && Number.isFinite(persisted) && persisted > 0) {
    return Math.floor(persisted);
  }

  if (typeof row.crNumber === 'number' && Number.isFinite(row.crNumber) && row.crNumber > 0) {
    return Math.floor(row.crNumber);
  }

  return parseChangeRequestCrId(row.crId ?? row.cr_id ?? row.title) ?? null;
}

export function getCanonicalChangeRequestCrId(row: {
  branch_sequence_number?: number | null;
  branchSequenceNumber?: number | null;
  crNumber?: number | null;
  crId?: string | null;
  cr_id?: string | null;
  title?: string | null;
}) {
  return formatChangeRequestCrId(getChangeRequestSequenceNumber(row));
}
