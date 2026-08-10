import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

export const pushSubscriptionInputSchema = z.object({
  deviceId: z.string().uuid(),
  endpoint: z.string().url(),
  auth: z.string().min(1),
  p256dh: z.string().min(1),
  userAgent: z.string().max(1000).optional(),
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionInputSchema>;
type ServerSupabase = SupabaseClient<any, 'public', any>;

export class PushSubscriptionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PushSubscriptionConflictError';
  }
}

function getSupabase(): ServerSupabase {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error('Missing Supabase configuration');
  return createClient(url, key);
}

function table(supabase: ServerSupabase, name: string): any {
  return (supabase.from as any)(name);
}

async function setPushDeliverySetting(supabase: ServerSupabase, userId: string, enabled: boolean) {
  const { data: settings, error } = await table(supabase, 'notification_setting')
    .select('id,delivery_settings')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const deliverySettings = {
    ...(settings?.delivery_settings ?? {}),
    pushNotifications: enabled,
  };
  const now = new Date().toISOString();
  if (settings) {
    const { error: updateError } = await table(supabase, 'notification_setting')
      .update({ delivery_settings: deliverySettings, updated_at: now })
      .eq('id', settings.id);
    if (updateError) throw new Error(updateError.message);
    return;
  }

  const { error: insertError } = await table(supabase, 'notification_setting').insert({
    id: crypto.randomUUID(),
    user_id: userId,
    delivery_settings: deliverySettings,
    created_at: now,
    updated_at: now,
  });
  if (insertError) throw new Error(insertError.message);
}

export async function getPushSubscriptionForDevice(
  userId: string,
  deviceId: string,
  supabase = getSupabase()
) {
  const { data, error } = await table(supabase, 'push_subscription')
    .select('id,user_id,device_id,endpoint,auth,p256dh,updated_at')
    .eq('user_id', userId)
    .eq('device_id', deviceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Registers the browser endpoint authoritatively. A known endpoint may move
 * between accounts only when both Web Push keys still match, which proves the
 * caller holds the same browser subscription.
 */
export async function registerPushSubscriptionForUser(
  userId: string,
  input: PushSubscriptionInput,
  supabase = getSupabase()
) {
  const parsed = pushSubscriptionInputSchema.parse(input);
  const [{ data: endpointRow, error: endpointError }, { data: deviceRow, error: deviceError }] =
    await Promise.all([
      table(supabase, 'push_subscription')
        .select('id,user_id,device_id,endpoint,auth,p256dh')
        .eq('endpoint', parsed.endpoint)
        .maybeSingle(),
      table(supabase, 'push_subscription')
        .select('id,user_id,device_id,endpoint,auth,p256dh')
        .eq('user_id', userId)
        .eq('device_id', parsed.deviceId)
        .maybeSingle(),
    ]);

  if (endpointError) throw new Error(endpointError.message);
  if (deviceError) throw new Error(deviceError.message);

  if (
    endpointRow &&
    endpointRow.user_id !== userId &&
    (endpointRow.auth !== parsed.auth || endpointRow.p256dh !== parsed.p256dh)
  ) {
    throw new PushSubscriptionConflictError('Push endpoint belongs to another subscription');
  }

  if (deviceRow && (!endpointRow || deviceRow.id !== endpointRow.id)) {
    const { error } = await table(supabase, 'push_subscription')
      .delete()
      .eq('id', deviceRow.id)
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
  }

  const now = new Date().toISOString();
  const values = {
    user_id: userId,
    device_id: parsed.deviceId,
    endpoint: parsed.endpoint,
    auth: parsed.auth,
    p256dh: parsed.p256dh,
    user_agent: parsed.userAgent ?? null,
    updated_at: now,
  };

  if (endpointRow) {
    const { data, error } = await table(supabase, 'push_subscription')
      .update(values)
      .eq('id', endpointRow.id)
      .select('id,user_id,device_id,endpoint,updated_at')
      .single();
    if (error) throw new Error(error.message);
    await setPushDeliverySetting(supabase, userId, true);
    if (endpointRow.user_id !== userId) {
      const { count, error: previousOwnerCountError } = await table(supabase, 'push_subscription')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', endpointRow.user_id);
      if (previousOwnerCountError) throw new Error(previousOwnerCountError.message);
      if ((count ?? 0) === 0) {
        await setPushDeliverySetting(supabase, endpointRow.user_id, false);
      }
    }
    return data;
  }

  const { data, error } = await table(supabase, 'push_subscription')
    .insert({ id: crypto.randomUUID(), ...values, created_at: now })
    .select('id,user_id,device_id,endpoint,updated_at')
    .single();
  if (error) throw new Error(error.message);
  await setPushDeliverySetting(supabase, userId, true);
  return data;
}

export async function unregisterPushSubscriptionForUser(
  userId: string,
  deviceId: string,
  supabase = getSupabase()
) {
  const { error } = await table(supabase, 'push_subscription')
    .delete()
    .eq('user_id', userId)
    .eq('device_id', z.string().uuid().parse(deviceId));
  if (error) throw new Error(error.message);

  const { count, error: countError } = await table(supabase, 'push_subscription')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (countError) throw new Error(countError.message);
  if ((count ?? 0) === 0) await setPushDeliverySetting(supabase, userId, false);
}

export const pushSubscriptionContracts = {
  getSupabase,
  setPushDeliverySetting,
};
