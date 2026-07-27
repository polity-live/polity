import postgres from 'postgres';

type AppTutorialSql = ReturnType<typeof postgres>;

export class AppTutorialDatabaseUnavailableError extends Error {
  constructor() {
    super('Tutorial database is not configured.');
    this.name = 'AppTutorialDatabaseUnavailableError';
  }
}

let appTutorialSql: AppTutorialSql | null = null;

export function getAppTutorialSql() {
  if (appTutorialSql) return appTutorialSql;

  const connectionString = process.env.ZERO_UPSTREAM_DB;
  if (!connectionString) {
    throw new AppTutorialDatabaseUnavailableError();
  }

  appTutorialSql = postgres(connectionString, {
    max: 4,
    idle_timeout: 20,
  });
  return appTutorialSql;
}
