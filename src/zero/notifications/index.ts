// Table
export {
  notification,
  pushSubscription,
  notificationSetting,
  notificationRead,
  notificationUserState,
} from './table';

// Zod Schemas
export {
  selectNotificationSchema,
  markReadNotificationSchema,
  deleteNotificationSchema,
  selectPushSubscriptionSchema,
  createPushSubscriptionSchema,
  deletePushSubscriptionSchema,
  selectNotificationSettingSchema,
  updateNotificationSettingSchema,
  selectNotificationReadSchema,
  createNotificationReadSchema,
  deleteNotificationReadSchema,
  selectNotificationUserStateSchema,
  setNotificationReadSchema,
  notificationStateTargetSchema,
  notificationEntityScopeSchema,
  setAllNotificationsReadSchema,
  updateEntityNotificationSchema,
  createEntityNotificationSchema,
  type Notification,
  type PushSubscription,
  type NotificationSetting,
  type NotificationRead,
  type NotificationUserState,
} from './schema';

// Queries & Mutators
export { notificationQueries } from './queries';
export { notificationSharedMutators } from './shared-mutators';

// Hooks
export { useNotificationState } from './useNotificationState';
export { useNotificationActions } from './useNotificationActions';
export { useEntityUnreadCount } from './useEntityUnreadCount';
