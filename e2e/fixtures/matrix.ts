export type MatrixDimensions = Record<string, readonly unknown[]>;

export interface MatrixScenario<TCase extends Record<string, unknown> = Record<string, unknown>> {
  name: string;
  data: TCase;
}

export function cartesianProduct<TDimensions extends MatrixDimensions>(
  dimensions: TDimensions,
  options: {
    name?: (data: Record<keyof TDimensions, unknown>) => string;
    filter?: (data: Record<keyof TDimensions, unknown>) => boolean;
    max?: number;
  } = {}
): MatrixScenario<Record<keyof TDimensions, unknown>>[] {
  const entries = Object.entries(dimensions) as [keyof TDimensions, readonly unknown[]][];
  const scenarios: MatrixScenario<Record<keyof TDimensions, unknown>>[] = [];

  function visit(index: number, current: Partial<Record<keyof TDimensions, unknown>>) {
    if (options.max && scenarios.length >= options.max) return;

    if (index === entries.length) {
      const data = current as Record<keyof TDimensions, unknown>;
      if (!options.filter || options.filter(data)) {
        scenarios.push({
          name:
            options.name?.(data) ??
            Object.entries(data)
              .map(([key, value]) => `${key}=${value}`)
              .join(', '),
          data,
        });
      }
      return;
    }

    const [key, values] = entries[index];
    for (const value of values) {
      visit(index + 1, { ...current, [key]: value });
    }
  }

  visit(0, {});
  return scenarios;
}

export function matrixLimit(defaultLimit = 48) {
  const raw = process.env.E2E_CREATE_MATRIX_LIMIT;
  if (!raw) return defaultLimit;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function scenarioLabel(value: Record<string, unknown>) {
  return Object.entries(value)
    .map(([key, item]) => `${key}:${String(item)}`)
    .join(' ');
}
