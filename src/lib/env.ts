export function getRequiredEnvVar(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} is not defined`);
  }

  return value;
}
