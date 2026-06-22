process.env.ZERO_UPSTREAM_DB ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

await import('@/i18n/i18n');
