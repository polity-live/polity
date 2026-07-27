export const ATTENDANCE_MODE_CHANGE_LOCKED_MESSAGE =
  'The attendance mode cannot be changed because a final vote or election has already started. Close it first.';

export type EventAttendanceMode = 'online' | 'hybrid' | 'offline';
export type ParticipationChannel = 'online' | 'offline';

export function resolveEventAttendanceMode(event: {
  attendance_mode?: string | null;
  location_type?: string | null;
}): EventAttendanceMode {
  if (
    event.attendance_mode === 'online' ||
    event.attendance_mode === 'hybrid' ||
    event.attendance_mode === 'offline'
  ) {
    return event.attendance_mode;
  }

  return event.location_type === 'online' ? 'online' : 'offline';
}

export function resolveParticipationChannel(args: {
  attendanceMode: EventAttendanceMode;
  hasConfirmedOfflineAssignment: boolean;
}): ParticipationChannel {
  if (args.attendanceMode === 'offline') {
    return 'offline';
  }

  if (args.attendanceMode === 'hybrid' && args.hasConfirmedOfflineAssignment) {
    return 'offline';
  }

  return 'online';
}

export function hasOpenElectorateSnapshot(
  ballots:
    | readonly {
        electorate_snapshotted_at?: number | null;
        status?: string | null;
      }[]
    | null
    | undefined
): boolean {
  return Boolean(
    ballots?.some(ballot => ballot.electorate_snapshotted_at != null && ballot.status !== 'closed')
  );
}
