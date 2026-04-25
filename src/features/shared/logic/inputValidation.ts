import { isValidEmailAddress } from '@/features/auth/logic/authValidation';

const URL_PROTOCOL_REGEX = /^[a-z][a-z\d+.-]*:\/\//i;
const GENERIC_SOCIAL_HANDLE_REGEX = /^[A-Za-z0-9._/-]{2,100}$/;
const TWITTER_HANDLE_REGEX = /^@?[A-Za-z0-9_]{1,15}$/;
const LINKEDIN_HANDLE_REGEX = /^\/?(?:in|company)\/[A-Za-z0-9-_%]{2,100}$/;
const WHATSAPP_PHONE_REGEX = /^\+?[0-9][0-9().\s-]{5,}$/;
const HOUSE_NUMBER_REGEX = /^\d+[A-Za-z0-9/-]*$/;

function normalizeUrlCandidate(value: string): string {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return trimmedValue;
  }

  if (URL_PROTOCOL_REGEX.test(trimmedValue)) {
    return trimmedValue;
  }

  return `https://${trimmedValue}`;
}

export function hasMinLength(value: string, minLength: number): boolean {
  return value.trim().length >= minLength;
}

export function isOptionalMinLength(value: string, minLength: number): boolean {
  const trimmedValue = value.trim();
  return trimmedValue.length === 0 || trimmedValue.length >= minLength;
}

export function isNonNegativeInteger(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

export function isPositiveInteger(value: string): boolean {
  const trimmedValue = value.trim();
  return /^\d+$/.test(trimmedValue) && Number.parseInt(trimmedValue, 10) > 0;
}

export function isValidUrlLike(value: string): boolean {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return false;
  }

  try {
    const parsedUrl = new URL(normalizeUrlCandidate(trimmedValue));
    return (
      parsedUrl.hostname.length > 0 &&
      (parsedUrl.hostname.includes('.') || parsedUrl.hostname === 'localhost')
    );
  } catch {
    return false;
  }
}

export function isValidOptionalUrlLike(value: string): boolean {
  const trimmedValue = value.trim();
  return trimmedValue.length === 0 || isValidUrlLike(trimmedValue);
}

export function isValidOptionalEmailAddress(value: string): boolean {
  const trimmedValue = value.trim();
  return trimmedValue.length === 0 || isValidEmailAddress(trimmedValue);
}

export type SocialInputPlatform =
  | 'youtube'
  | 'linkedin'
  | 'whatsapp'
  | 'instagram'
  | 'twitter'
  | 'facebook'
  | 'snapchat'
  | 'tiktok';

function isValidGenericSocialHandle(value: string): boolean {
  const sanitizedValue = value.trim().replace(/^@/, '');
  return GENERIC_SOCIAL_HANDLE_REGEX.test(sanitizedValue);
}

export function isValidSocialInput(platform: SocialInputPlatform, value: string): boolean {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return false;
  }

  if (isValidUrlLike(trimmedValue)) {
    return true;
  }

  switch (platform) {
    case 'twitter':
      return TWITTER_HANDLE_REGEX.test(trimmedValue);
    case 'linkedin':
      return LINKEDIN_HANDLE_REGEX.test(trimmedValue) || isValidGenericSocialHandle(trimmedValue);
    case 'whatsapp':
      return WHATSAPP_PHONE_REGEX.test(trimmedValue);
    default:
      return isValidGenericSocialHandle(trimmedValue);
  }
}

export function isValidOptionalSocialInput(platform: SocialInputPlatform, value: string): boolean {
  const trimmedValue = value.trim();
  return trimmedValue.length === 0 || isValidSocialInput(platform, trimmedValue);
}

export function isValidHouseNumberFormat(value: string): boolean {
  return HOUSE_NUMBER_REGEX.test(value.trim());
}
