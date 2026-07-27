import { z } from 'zod';
import {
  timestampSchema,
  nullableTimestampSchema,
  jsonBooleanRecordSchema,
  jsonBooleanOrStringRecordSchema,
} from '../shared/helpers';

// ============================================
// Notification
// ============================================
const baseNotificationSchema = z.object({
  id: z.string(),
  recipient_id: z.string().nullable(),
  sender_id: z.string().nullable(),
  title: z.string().nullable(),
  message: z.string().nullable(),
  type: z.string().nullable(),
  action_url: z.string().nullable(),
  is_read: z.boolean(),
  related_entity_type: z.string().nullable(),
  on_behalf_of_entity_type: z.string().nullable(),
  on_behalf_of_entity_id: z.string().nullable(),
  recipient_entity_type: z.string().nullable(),
  recipient_entity_id: z.string().nullable(),
  related_user_id: z.string().nullable(),
  related_group_id: z.string().nullable(),
  related_amendment_id: z.string().nullable(),
  related_event_id: z.string().nullable(),
  related_blog_id: z.string().nullable(),
  on_behalf_of_group_id: z.string().nullable(),
  on_behalf_of_event_id: z.string().nullable(),
  on_behalf_of_amendment_id: z.string().nullable(),
  on_behalf_of_blog_id: z.string().nullable(),
  recipient_group_id: z.string().nullable(),
  recipient_event_id: z.string().nullable(),
  recipient_amendment_id: z.string().nullable(),
  recipient_blog_id: z.string().nullable(),
  category: z.string().nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
  deleted_at: nullableTimestampSchema,
  deleted_by_user_id: z.string().nullable(),
});

export const selectNotificationSchema = baseNotificationSchema;
export const createNotificationSchema = baseNotificationSchema
  .omit({
    id: true,
    created_at: true,
    updated_at: true,
    deleted_at: true,
    deleted_by_user_id: true,
    is_read: true,
  })
  .extend({ id: z.string() });
export const markReadNotificationSchema = z.object({ id: z.string() });
export const deleteNotificationSchema = z.object({ id: z.string() });

// ============================================
// Push Subscription
// ============================================
const basePushSubscriptionSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  device_id: z.string().nullable(),
  endpoint: z.string(),
  auth: z.string().nullable(),
  p256dh: z.string().nullable(),
  user_agent: z.string().nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const selectPushSubscriptionSchema = basePushSubscriptionSchema;
export const createPushSubscriptionSchema = basePushSubscriptionSchema
  .omit({ id: true, user_id: true, created_at: true, updated_at: true, device_id: true })
  .extend({ id: z.string(), device_id: z.string().uuid().optional() });
export const deletePushSubscriptionSchema = z.object({ id: z.string() });

// ============================================
// Notification Setting
// ============================================
const baseNotificationSettingSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  group_notifications: jsonBooleanRecordSchema.nullable(),
  event_notifications: jsonBooleanRecordSchema.nullable(),
  amendment_notifications: jsonBooleanRecordSchema.nullable(),
  blog_notifications: jsonBooleanRecordSchema.nullable(),
  todo_notifications: jsonBooleanRecordSchema.nullable(),
  social_notifications: jsonBooleanRecordSchema.nullable(),
  delivery_settings: jsonBooleanRecordSchema.nullable(),
  timeline_settings: jsonBooleanOrStringRecordSchema.nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const selectNotificationSettingSchema = baseNotificationSettingSchema;
export const createNotificationSettingSchema = baseNotificationSettingSchema
  .omit({ id: true, created_at: true, updated_at: true, user_id: true })
  .extend({ id: z.string() });
export const updateNotificationSettingSchema = baseNotificationSettingSchema
  .pick({
    group_notifications: true,
    event_notifications: true,
    amendment_notifications: true,
    blog_notifications: true,
    todo_notifications: true,
    social_notifications: true,
    delivery_settings: true,
    timeline_settings: true,
  })
  .partial()
  .extend({ id: z.string() });

// ============================================
// Inferred Types
// ============================================
export type Notification = z.infer<typeof selectNotificationSchema>;
export type PushSubscription = z.infer<typeof selectPushSubscriptionSchema>;
export type NotificationSetting = z.infer<typeof selectNotificationSettingSchema>;

// ============================================
// Notification Read (entity-level shared read tracking)
// ============================================
const baseNotificationReadSchema = z.object({
  id: z.string(),
  notification_id: z.string(),
  entity_type: z.string(),
  entity_id: z.string(),
  read_by_user_id: z.string().nullable(),
  read_at: timestampSchema,
});

export const selectNotificationReadSchema = baseNotificationReadSchema;
export const createNotificationReadSchema = baseNotificationReadSchema
  .omit({ id: true, read_at: true, read_by_user_id: true })
  .extend({ id: z.string() });
export const deleteNotificationReadSchema = z.object({ id: z.string() });
export type NotificationRead = z.infer<typeof selectNotificationReadSchema>;

// ============================================
// Notification User State (canonical per-user inbox state)
// ============================================
const baseNotificationUserStateSchema = z.object({
  id: z.string(),
  notification_id: z.string(),
  user_id: z.string(),
  read_at: nullableTimestampSchema,
  dismissed_at: nullableTimestampSchema,
  purged_at: nullableTimestampSchema,
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const selectNotificationUserStateSchema = baseNotificationUserStateSchema;
export const setNotificationReadSchema = z.object({
  notificationId: z.string(),
  read: z.boolean(),
});
export const notificationStateTargetSchema = z.object({ notificationId: z.string() });
export const notificationEntityScopeSchema = z.object({
  entityType: z.enum(['group', 'event', 'amendment', 'blog']),
  entityId: z.string(),
});
export const setAllNotificationsReadSchema = z.object({
  scope: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('inbox') }),
    z.object({
      kind: z.literal('entity'),
      entityType: z.enum(['group', 'event', 'amendment', 'blog']),
      entityId: z.string(),
    }),
  ]),
  read: z.boolean(),
});
export const updateEntityNotificationSchema = z
  .object({
    notificationId: z.string(),
    title: z.string().nullable().optional(),
    message: z.string().nullable().optional(),
    action_url: z.string().nullable().optional(),
  })
  .refine(
    value =>
      value.title !== undefined || value.message !== undefined || value.action_url !== undefined,
    {
      message: 'At least one notification field must be provided',
    }
  );
export const createEntityNotificationSchema = createNotificationSchema.superRefine((value, ctx) => {
  const entityType = value.recipient_entity_type;
  const entityId = value.recipient_entity_id;
  const typedTargets = {
    group: value.recipient_group_id,
    event: value.recipient_event_id,
    amendment: value.recipient_amendment_id,
    blog: value.recipient_blog_id,
  };

  if (
    value.recipient_id !== null ||
    !entityType ||
    !['group', 'event', 'amendment', 'blog'].includes(entityType) ||
    !entityId ||
    typedTargets[entityType as keyof typeof typedTargets] !== entityId ||
    Object.values(typedTargets).filter(Boolean).length !== 1
  ) {
    ctx.addIssue({
      code: 'custom',
      message: 'Entity notifications require one canonical entity recipient',
    });
  }
});

export type NotificationUserState = z.infer<typeof selectNotificationUserStateSchema>;
