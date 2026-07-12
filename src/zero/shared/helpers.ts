import { z } from 'zod';

export const timestampSchema = z.number();

export const nullableTimestampSchema = z
  .union([z.number(), z.null()])
  .transform(val => (val === null ? 0 : val));

export const jsonSchema = z.json();
export type MutableJSONValue = z.infer<typeof jsonSchema>;

export function toMutableJSONValue(value: unknown): MutableJSONValue {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new TypeError('Value is not JSON-serializable');
  }
  return jsonSchema.parse(JSON.parse(serialized));
}

/** Typed JSON schema for string arrays (tags, etc.) */
export const jsonStringArraySchema = z.array(z.string());

/** Typed JSON schema for number arrays (recurrence_days, etc.) */
export const jsonNumberArraySchema = z.array(z.number());

/** Typed JSON schema for Record<string, string> (metadata, etc.) */
export const jsonStringRecordSchema = z.record(z.string(), z.string());

/** Typed JSON schema for Record<string, number> (stats, etc.) */
export const jsonNumberRecordSchema = z.record(z.string(), z.number());

/** Typed JSON schema for Record<string, boolean> (notification settings, etc.) */
export const jsonBooleanRecordSchema = z.record(z.string(), z.boolean());

/** Typed JSON schema for Record<string, boolean | string> (timeline settings, etc.) */
export const jsonBooleanOrStringRecordSchema = z.record(
  z.string(),
  z.union([z.boolean(), z.string()])
);

/** Typed JSON schema for Record<string, string> (delegate states, etc.) */
export const jsonStringStringRecordSchema = z.record(z.string(), z.string());
