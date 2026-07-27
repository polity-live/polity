export function getCalendarEventRoute(tutorialRunId?: string | null) {
  return tutorialRunId ? ('/event/$id/agenda' as const) : ('/event/$id' as const);
}
