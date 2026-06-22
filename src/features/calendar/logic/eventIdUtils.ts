/**
 * Extract the base event ID from a potentially compound instance ID.
 *
 * Recurring events generate instance IDs like: eventId_rrule_index
 * This function extracts the original event UUID for navigation.
 *
 * @param instanceId - The event ID which might be an instance ID
 * @returns The base event UUID
 */
export function getBaseEventId(instanceId: string): string {
  // RRule-backed recurring instances append an index marker to the base event ID.
  if (instanceId.includes('_rrule_')) {
    return instanceId.split('_rrule_')[0];
  }

  // Otherwise return the ID as-is
  return instanceId;
}
