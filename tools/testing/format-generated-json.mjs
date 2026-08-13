import { format, resolveConfig } from 'prettier';

export async function formatGeneratedJson(serialized, target) {
  return format(serialized, {
    ...(await resolveConfig(target)),
    filepath: target,
  });
}
