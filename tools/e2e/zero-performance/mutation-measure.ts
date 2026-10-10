import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { Zero } from '@rocicorp/zero';
import { schema } from '../../../src/zero/schema';
import { mutators } from '../../../src/zero/mutators';
import { parseAppError } from '../../../src/features/shared/errors/app-error';
import { actorUser, ensureE2EAuthUser } from '../../../e2e/fixtures/auth';
import { getLocalActorAccessToken } from '../../../e2e/fixtures/domains/datasets';
import { waitForZeroReady } from '../../../e2e/fixtures/zero-readiness';
import { OWNER, OUTSIDER } from './catalog';
import type { MutationCase } from './mutation-case-types';
import {
  mutationSummary,
  type MutationExpectation,
  type MutationMeasurement,
  type MutationSample,
} from './mutation-metrics';
import type { Execution } from './sharding';
import { required } from './required';
import { watchMutationSnapshot, waitForRollback } from './mutation-snapshot';

interface View {
  addListener: (callback: (data: unknown, type: string) => void) => () => void;
  destroy: () => void;
}
function deadline<T>(promise: Promise<T>, label: string, ms = 15_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}
function watch(view: View, predicate: (data: unknown) => boolean) {
  let release = () => {
    /* Subscription assigned synchronously below. */
  };
  const readiness = { events: 0, lastType: 'none', predicateMatched: false };
  const promise = new Promise<number>((resolve, reject) => {
    release = view.addListener((data, type) => {
      readiness.events++;
      readiness.lastType = type;
      readiness.predicateMatched = predicate(data);
      if (type === 'error') reject(new Error('Mutation observation query rejected'));
      if (type === 'complete' && readiness.predicateMatched) resolve(performance.now());
    });
  });
  return { promise, readiness, cancel: () => release() };
}
function errorCode(error: unknown) {
  const parsed = parseAppError(error);
  if (parsed) return parsed.code;
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string')
    return error.code;
  return 'mutation_server_failed';
}

/** Writers and observers share this process's monotone clock, never server wall clocks. */
export async function measureMutations(
  cases: MutationCase[],
  expectations: MutationExpectation[],
  execution: Execution | undefined,
  rows: MutationMeasurement[],
  infrastructure: string[],
  progress: () => Promise<void>,
  interrupted: () => boolean
) {
  if (!cases.length) return;
  const sql = postgres(required(process.env.E2E_DATABASE_URL), {
    max: 2,
    prepare: false,
    onnotice: () => undefined,
  });
  const identities = { owner: OWNER, outsider: OUTSIDER };
  const tokens: Record<string, string> = {};
  async function client(actor: 'owner' | 'outsider' | 'anonymous') {
    const context = actor === 'anonymous' ? { userID: 'anon', email: '' } : identities[actor];
    if (actor !== 'anonymous') {
      const user = {
        ...actorUser(`zero-performance-${actor}`),
        id: context.userID,
        email: context.email,
      };
      const claims = tokens[actor]
        ? JSON.parse(Buffer.from(tokens[actor].split('.')[1], 'base64url').toString())
        : undefined;
      if (!claims || claims.exp * 1_000 <= Date.now() + 60_000) {
        if (!tokens[actor]) await ensureE2EAuthUser(user);
        tokens[actor] = await getLocalActorAccessToken(user);
      }
    }
    const zero = new Zero({
      schema,
      mutators,
      context,
      ...(actor === 'anonymous' ? {} : { userID: context.userID }),
      auth: tokens[actor],
      cacheURL: required(process.env.VITE_ZERO_CACHE_URL),
      queryURL: `${process.env.VITE_ZERO_API_URL ?? process.env.VITE_APP_URL}/api/query`,
      mutateURL: `${process.env.VITE_ZERO_API_URL ?? process.env.VITE_APP_URL}/api/mutate`,
      queryHeaders: { 'x-zero-performance-client-id': randomUUID() },
      kvStore: 'mem',
      storageKey: `mutation-benchmark-${randomUUID()}`,
      logLevel: 'warn',
      logSink: {
        log(level, _context, ...args) {
          if (
            level === 'warn' &&
            args.some(value => typeof value === 'string' && /Slow query/i.test(value))
          )
            infrastructure.push('Mutation client slow-query warning');
        },
      },
    });
    try {
      if (zero.connection.state.current.name !== 'connected')
        await deadline(
          new Promise<void>((resolve, reject) => {
            const unsubscribe = zero.connection.state.subscribe(state => {
              if (state.name === 'connected') {
                unsubscribe();
                resolve();
              }
              if (['error', 'needs-auth', 'closed'].includes(state.name)) {
                unsubscribe();
                reject(new Error(`Mutation connection ${state.name}`));
              }
            });
          }),
          'Mutation connection'
        );
      return zero;
    } catch (error) {
      await zero.close();
      throw error;
    }
  }
  try {
    for (const entry of cases) {
      const caseStartedAt = performance.now();
      if (interrupted()) throw new Error('Mutation collection interrupted');
      const expectation = required(
        expectations.find(
          row =>
            row.name === entry.name && row.variant === entry.variant && row.actor === entry.actor
        )
      );
      const row: MutationMeasurement = {
        execution,
        expectation,
        key: expectation.key,
        samples: [],
        failures: [],
      };
      rows.push(row);
      for (let repeat = 0; repeat < 5; repeat++) {
        const actor =
          entry.actor === 'anonymous'
            ? 'anonymous'
            : entry.actor === 'outsider'
              ? 'outsider'
              : 'owner';
        let writer: Awaited<ReturnType<typeof client>> | undefined;
        let observer: Awaited<ReturnType<typeof client>> | undefined;
        const views: View[] = [];
        const cancellations: (() => void)[] = [];
        let prepared: Awaited<ReturnType<MutationCase['prepare']>> | undefined;
        let sample: MutationSample | undefined;
        let restored = false;
        let settled = true;
        let stage = 'client setup';
        let fixtureReadiness: ReturnType<typeof watch>['readiness'] | undefined;
        try {
          writer = await client(actor);
          observer = await client('owner');
          stage = 'fixture setup';
          prepared = await entry.prepare({
            sql,
            id: randomUUID(),
            ownerID: OWNER.userID,
            outsiderID: OUTSIDER.userID,
            actorID: actor === 'anonymous' ? 'anon' : identities[actor].userID,
            actor: entry.actor,
          });
          stage = 'fixture WAL replication';
          await waitForZeroReady({ timeoutMs: 15_000, pollIntervalMs: 50 });
          let observation: ReturnType<typeof watch> | undefined;
          let writerBaseline: unknown;
          let writerCurrent: unknown;
          if ('query' in expectation.observer)
            assert.ok(prepared.observe, 'Missing declared observer');
          if (prepared.observe) {
            const preparedObservation = prepared.observe;
            stage = 'fixture replication';
            const view = observer.materialize(prepared.observe.request as never, {
              ttl: 'none',
            }) as unknown as View;
            views.push(view);
            const initial = watch(view, prepared.observe.before);
            cancellations.push(initial.cancel);
            fixtureReadiness = initial.readiness;
            await deadline(initial.promise, 'Observer fixture replication');
            initial.cancel();
            const local = writer.materialize(prepared.observe.request as never, {
              ttl: 'none',
            }) as unknown as View;
            views.push(local);
            await deadline(
              new Promise<void>((resolve, reject) => {
                cancellations.push(
                  local.addListener((data, type) => {
                    if (type === 'error') reject(new Error('Writer fixture query rejected'));
                    if (type === 'complete') {
                      writerCurrent = data;
                      // Denied actors may legitimately see a permission-filtered baseline.
                      if (
                        (entry.outcome !== 'success' && !prepared?.requireWriterBefore) ||
                        preparedObservation.before(data)
                      )
                        resolve();
                    }
                  })
                );
              }),
              'Writer fixture replication'
            );
            writerBaseline = structuredClone(writerCurrent);
            // Attach before invocation so a fast replication cannot be lost.
            if (entry.outcome === 'success') {
              observation = watch(
                view,
                data => Number.isFinite(sample?.startedAt) && preparedObservation.after(data)
              );
              cancellations.push(observation.cancel);
            }
          }
          stage = 'pre-invocation fixture transition';
          await prepared.beforeInvoke?.();
          sample = {
            clientGroupID: await writer.clientGroupID,
            clientID: writer.clientID,
            observerGroupID: await observer.clientGroupID,
            observerClientID: observer.clientID,
            startedAt: NaN,
            clientAppliedAt: NaN,
            clientApplyMs: NaN,
            outcome: 'success',
            databaseVerified: false,
            rollbackVerified: false,
            restored: false,
            attempts: [],
          };
          row.samples.push(sample);
          const measured = sample;
          stage = 'mutation completion';
          let fn: unknown = mutators;
          for (const segment of entry.name.split('.'))
            fn = (fn as Record<string, unknown>)[segment];
          assert.equal(typeof fn, 'function', 'Unregistered mutation implementation');
          const snapshot = watchMutationSnapshot(writer);
          cancellations.push(snapshot.cancel);
          let result: ReturnType<typeof writer.mutate> | undefined;
          try {
            const request = (fn as (args: unknown) => never)(prepared.args);
            sample.startedAt = performance.now();
            result = writer.mutate(request);
          } catch (error) {
            sample.clientAppliedAt = performance.now();
            sample.outcome = 'client-error';
            sample.error = errorCode(error);
          }
          if (result) {
            settled = false;
            const local = Promise.resolve(result.client).then(
              value => {
                measured.clientAppliedAt = performance.now();
                if (value.type === 'error') {
                  measured.outcome = 'client-error';
                  measured.error = errorCode(value.error);
                }
              },
              error => {
                measured.clientAppliedAt = performance.now();
                measured.outcome = 'client-error';
                measured.error = errorCode(error);
              }
            );
            const server = Promise.resolve(result.server).then(
              value => {
                settled = true;
                if (measured.outcome === 'client-error') return;
                measured.confirmedAt = performance.now();
                if (value.type !== 'success') {
                  measured.outcome = 'server-error';
                  measured.error = errorCode(value.error);
                }
              },
              error => {
                settled = true;
                if (measured.outcome === 'client-error') return;
                measured.confirmedAt = performance.now();
                measured.outcome = 'server-error';
                measured.error = errorCode(error);
              }
            );
            // Both promises are registered immediately; retries remain in the original elapsed time.
            await deadline(Promise.all([local, server]), 'Mutation completion');
          }
          sample.clientApplyMs = sample.clientAppliedAt - sample.startedAt;
          if (sample.confirmedAt !== undefined)
            sample.serverConfirmedMs = sample.confirmedAt - sample.startedAt;
          if (entry.outcome !== 'success' && prepared.observe && 'query' in expectation.observer) {
            observation = watch(views[0], prepared.observe.after);
            cancellations.push(observation.cancel);
          }
          if (observation && 'query' in expectation.observer && sample.confirmedAt !== undefined) {
            stage = 'observer replication';
            sample.observedAt = await deadline(observation.promise, 'Mutation observer');
            sample.observerTotalMs = sample.observedAt - sample.startedAt;
            sample.observerAfterConfirmMs = Math.max(
              0,
              sample.observedAt - required(sample.confirmedAt)
            );
          }
          if (sample.outcome === 'server-error') {
            stage = 'writer snapshot replication';
            const applied = required(await deadline(snapshot.promise, 'Writer mutation snapshot'));
            sample.snapshotAppliedAt = applied.at;
            sample.snapshotMutationID = applied.mutationID;
          } else snapshot.cancel();
          stage = 'independent database verification';
          await prepared.verify();
          sample.databaseVerified = true;
          stage = 'optimistic rollback verification';
          if (sample.outcome !== 'success') {
            if (prepared.verifyRollback) await prepared.verifyRollback(writer);
            else if (prepared.observe) await waitForRollback(() => writerCurrent, writerBaseline);
            else assert.fail('Rejected mutation needs independent local rollback proof');
          }
          sample.rollbackVerified = true;
        } catch {
          // Do not print arguments or errors that might contain sensitive fixture data.
          row.failures.push(
            `Mutation sample ${repeat + 1}: ${stage} failed` +
              (stage === 'fixture replication' && fixtureReadiness
                ? ` (${JSON.stringify(fixtureReadiness)})`
                : '')
          );
        } finally {
          cancellations.forEach(cancel => cancel());
          views.forEach(view => view.destroy());
          const closed = await Promise.allSettled(
            [writer, observer]
              .filter((client): client is NonNullable<typeof client> => client !== undefined)
              .map(client => deadline(client.close(), 'Mutation client shutdown'))
          );
          if (closed.some(result => result.status === 'rejected'))
            row.failures.push('Mutation client shutdown failed');
          if (prepared)
            try {
              await prepared.restore();
              await prepared.verifyRestored();
              await waitForZeroReady({ timeoutMs: 15_000, pollIntervalMs: 50 });
              restored = settled;
              if (sample) sample.restored = restored;
            } catch {
              row.failures.push('Mutation fixture restoration failed');
            }
        }
        await progress();
        row.elapsedMs = performance.now() - caseStartedAt;
        // Closing a client cannot cancel an already dispatched transaction. Do not
        // continue into another fixture while an unconfirmed request may commit.
        if (!settled) throw new Error('Mutation still in flight; measurement section stopped');
        if (!restored)
          throw new Error('Mutation fixture restoration unproved; measurement section stopped');
      }
      process.stdout.write(
        JSON.stringify({
          ...mutationSummary(row),
          samples: row.samples.length,
          failures: row.failures,
        }) + '\n'
      );
    }
  } finally {
    await sql.end();
  }
}
