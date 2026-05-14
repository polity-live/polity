export function getEventTypeTranslationKey(eventType?: string | null) {
  switch (eventType) {
    case 'delegate_assembly':
      return 'delegateAssembly';
    case 'general_assembly':
      return 'generalAssembly';
    case 'meeting':
      return 'meeting';
    case 'on_invite':
      return 'onInvite';
    default:
      return 'open';
  }
}
