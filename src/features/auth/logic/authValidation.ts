const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 6;

export function isValidEmailAddress(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

export function isValidPassword(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}

export function passwordsMatch(password: string, confirmPassword: string): boolean {
  return password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;
}
