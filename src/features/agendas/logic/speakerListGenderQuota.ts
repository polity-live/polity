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
      return 'maennlich';
    case 'female':
      return 'weiblich';
    case 'diverse':
      return 'divers';
    default:
      return 'keine Angabe';
  }
}

export function getGenderQuotaErrorMessage(result: GenderQuotaValidationResult) {
  switch (result.reason) {
    case 'missing-gender':
      return 'Please set a gender in your user settings before joining a gender-quoted speaker list.';
    case 'unsupported-gender':
      return 'This gender-quoted speaker list currently only accepts male and female speakers.';
    case 'expected-male':
      return 'The next speaker must be male.';
    case 'expected-female':
      return 'The next speaker must be female.';
    default:
      return 'You cannot join this gender-quoted speaker list right now.';
  }
}

export function getGenderQuotaFeedbackMessage(
  result: GenderQuotaValidationResult,
  t: (key: string, fallback?: string) => string
) {
  switch (result.reason) {
    case 'missing-gender':
      return t(
        'features.events.agenda.genderQuota.missingGender',
        'Bitte waehle in deinen Profileinstellungen ein Gender aus, bevor du dich auf diese Redeliste setzt.'
      );
    case 'unsupported-gender':
      return t(
        'features.events.agenda.genderQuota.unsupportedGender',
        'Diese genderquotierte Redeliste akzeptiert aktuell nur maennlich oder weiblich.'
      );
    case 'expected-male':
      return t(
        'features.events.agenda.genderQuota.expectedMale',
        'Als Naechstes muss sich ein Mann auf die Redeliste setzen.'
      );
    case 'expected-female':
      return t(
        'features.events.agenda.genderQuota.expectedFemale',
        'Als Naechstes muss sich eine Frau auf die Redeliste setzen.'
      );
    default:
      return t(
        'features.events.agenda.genderQuota.blocked',
        'Du kannst dich gerade nicht auf diese genderquotierte Redeliste setzen.'
      );
  }
}
