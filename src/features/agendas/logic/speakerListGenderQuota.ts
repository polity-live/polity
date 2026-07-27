export const SPEAKER_GENDERS = ['male', 'female', 'diverse'] as const;
export type SpeakerGender = (typeof SPEAKER_GENDERS)[number];
export type BinarySpeakerGender = 'male' | 'female';

export type GenderQuotaBlockReason =
  'missing-gender' | 'unsupported-gender' | 'expected-male' | 'expected-female';

export interface SpeakerListGenderQuotaSpeaker {
  order?: number | null;
  order_index?: number | null;
  created_at?: number | string | null;
  completed?: boolean | null;
  user?: {
    gender?: string | null;
  } | null;
}

export interface GenderQuotaValidationResult {
  allowed: boolean;
  expectedGender?: BinarySpeakerGender;
  reason?: GenderQuotaBlockReason;
}

export function isSpeakerGender(value: unknown): value is SpeakerGender {
  return typeof value === 'string' && SPEAKER_GENDERS.includes(value as SpeakerGender);
}

export function isBinarySpeakerGender(value: unknown): value is BinarySpeakerGender {
  return value === 'male' || value === 'female';
}

export function getOppositeBinaryGender(gender: BinarySpeakerGender): BinarySpeakerGender {
  return gender === 'male' ? 'female' : 'male';
}

function getSpeakerOrderValue(speaker: SpeakerListGenderQuotaSpeaker) {
  return speaker.order_index ?? speaker.order ?? 0;
}

function getSpeakerCreatedValue(speaker: SpeakerListGenderQuotaSpeaker) {
  const createdAt = speaker.created_at;
  if (typeof createdAt === 'number') return createdAt;
  if (typeof createdAt === 'string') {
    const parsed = Date.parse(createdAt);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export function getLastActiveSpeaker(
  speakers: readonly SpeakerListGenderQuotaSpeaker[]
): SpeakerListGenderQuotaSpeaker | null {
  const activeSpeakers = speakers.filter(speaker => !speaker.completed);
  if (activeSpeakers.length === 0) return null;

  return [...activeSpeakers].sort((left, right) => {
    const orderDiff = getSpeakerOrderValue(left) - getSpeakerOrderValue(right);
    if (orderDiff !== 0) return orderDiff;
    return getSpeakerCreatedValue(left) - getSpeakerCreatedValue(right);
  })[activeSpeakers.length - 1];
}

export function getExpectedNextSpeakerGender(
  speakers: readonly SpeakerListGenderQuotaSpeaker[]
): BinarySpeakerGender | null {
  const lastActiveSpeaker = getLastActiveSpeaker(speakers);
  const lastGender = lastActiveSpeaker?.user?.gender;

  if (!isBinarySpeakerGender(lastGender)) {
    return null;
  }

  return getOppositeBinaryGender(lastGender);
}

export function validateSpeakerGenderQuota({
  enabled,
  speakerGender,
  speakers,
}: {
  enabled: boolean;
  speakerGender?: string | null;
  speakers: readonly SpeakerListGenderQuotaSpeaker[];
}): GenderQuotaValidationResult {
  if (!enabled) {
    return { allowed: true };
  }

  const expectedGender = getExpectedNextSpeakerGender(speakers);
  const expectedGenderPatch = expectedGender ? { expectedGender } : {};

  if (speakerGender == null) {
    return { allowed: false, ...expectedGenderPatch, reason: 'missing-gender' };
  }

  if (!isBinarySpeakerGender(speakerGender)) {
    return { allowed: false, ...expectedGenderPatch, reason: 'unsupported-gender' };
  }

  if (expectedGender && speakerGender !== expectedGender) {
    return {
      allowed: false,
      expectedGender,
      reason: expectedGender === 'male' ? 'expected-male' : 'expected-female',
    };
  }

  return { allowed: true, ...expectedGenderPatch };
}

export function getSpeakerGenderLabel(gender?: string | null) {
  switch (gender) {
    case 'male':
      return translate('features.events.agenda.genderQuota.genderLabels.male');
    case 'female':
      return translate('features.events.agenda.genderQuota.genderLabels.female');
    case 'diverse':
      return translate('features.events.agenda.genderQuota.genderLabels.diverse');
    default:
      return translate('features.events.agenda.genderQuota.genderLabels.unspecified');
  }
}

export function getGenderQuotaErrorMessage(result: GenderQuotaValidationResult) {
  switch (result.reason) {
    case 'missing-gender':
      return encodeAppError('gender_quota_missing_gender');
    case 'unsupported-gender':
      return encodeAppError('gender_quota_unsupported_gender');
    case 'expected-male':
      return encodeAppError('gender_quota_expected_male');
    case 'expected-female':
      return encodeAppError('gender_quota_expected_female');
    default:
      return encodeAppError('gender_quota_blocked');
  }
}

export function getGenderQuotaFeedbackMessage(
  result: GenderQuotaValidationResult,
  t: (key: string, fallback?: string) => string
) {
  switch (result.reason) {
    case 'missing-gender':
      return t('features.events.agenda.genderQuota.missingGender');
    case 'unsupported-gender':
      return t('features.events.agenda.genderQuota.unsupportedGender');
    case 'expected-male':
      return t('features.events.agenda.genderQuota.expectedMale');
    case 'expected-female':
      return t('features.events.agenda.genderQuota.expectedFemale');
    default:
      return t('features.events.agenda.genderQuota.blocked');
  }
}
import { encodeAppError } from '@/features/shared/errors';
import { translate } from '@/features/shared/hooks/use-translation';
