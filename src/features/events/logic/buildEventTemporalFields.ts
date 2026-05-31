import { toLocalDateTimeTimestamp, toLocalTimestamp } from '@/features/shared/logic/localDateTime';

interface BuildEventTemporalFieldsArgs {
  startDate?: string | null;
  startTime?: string | null;
  endDate?: string | null;
  endTime?: string | null;
  registrationDeadline?: string | null;
  amendmentDeadline?: string | null;
  candidacyDeadline?: string | null;
  delegatesNominationDeadline?: string | null;
}

export function buildEventTemporalFields({
  startDate,
  startTime,
  endDate,
  endTime,
  registrationDeadline,
  amendmentDeadline,
  candidacyDeadline,
  delegatesNominationDeadline,
}: BuildEventTemporalFieldsArgs) {
  return {
    start_date: toLocalTimestamp(startDate, startTime),
    end_date: toLocalTimestamp(endDate, endTime),
    registration_deadline: toLocalDateTimeTimestamp(registrationDeadline),
    amendment_deadline: toLocalDateTimeTimestamp(amendmentDeadline),
    candidacy_deadline: toLocalDateTimeTimestamp(candidacyDeadline),
    delegates_nomination_deadline: toLocalDateTimeTimestamp(delegatesNominationDeadline),
  };
}
