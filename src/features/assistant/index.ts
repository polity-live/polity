// Constants
export {
  ARIA_KAI_USER_ID,
  ARIA_KAI_EMAIL,
  ARIA_KAI_AVATAR_URL,
  ARIA_KAI_WELCOME_MESSAGE,
  ENTITY_DESCRIPTIONS,
} from './constants';
export type { EntityTopic } from './constants';

// Logic
export {
  isAssistantUser,
  isAssistantConversation,
  resolveAssistantAvatar,
} from './logic/assistantHelpers';

// Hooks
export { useAssistantConversation } from './hooks/useAssistantConversation';

// UI
export { AriaKaiStep } from './ui/AriaKaiStep';
