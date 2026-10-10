import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
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
import { MutationRequestCompletion } from './mutation-request-completion';
import { mutationErrorShape, mutationSDKErrorDiagnostic } from './mutation-error-diagnostics';
import { watchMutationObservation as watch } from './mutation-observation';

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
function errorCode(error: unknown) {
  const parsed = parseAppError(error);
  if (parsed) return parsed.code;
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string')
    return error.code;
  return 'mutation_server_failed';
}

function fixtureFailureCode(error: unknown): string {
  if (
    !error ||
    typeof error !== 'object' ||
    !('code' in error) ||
    typeof error.code !== 'string' ||
    !/^[A-Z0-9]{5}$/.test(error.code)
  )
    return '';
  // PostgreSQL codes identify the failure without printing SQL, parameters or data.
  return ` (SQLSTATE ${error.code})`;
}

function restorationProofLabel(error: unknown): string {
  if (
    !error ||
    typeof error !== 'object' ||
    !('message' in error) ||
    typeof error.message !== 'string'
  )
    return '';
  const firstLine = error.message.split('\n')[0];
  // Only labels produced by our SQL fixture proofs; never assertion diffs or data.
  return /^(Restoration proof: [a-z_]+|Scope restoration proof: [a-z_]+\.[a-z_]+)$/.test(firstLine)
    ? ` (${firstLine})`
    : '';
}

function rollbackProofLabel(error: unknown): string {
  if (!(error instanceof Error)) return '';
  const firstLine = error.message.split('\n')[0];
  return /^Rollback (row|field) proof: [A-Za-z_]+(?:\.[A-Za-z_]+)?$/.test(firstLine)
    ? ` (${firstLine})`
    : '';
}

function databaseProofLabel(error: unknown): string {
  if (!(error instanceof Error)) return '';
  const firstLine = error.message.split('\n')[0];
  return /^Database field proof: [a-z_]+\.[a-z_]+$/.test(firstLine) ? ` (${firstLine})` : '';
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
  const requestCompletion = new MutationRequestCompletion(
    path.join(
      required(process.env.ZERO_PERFORMANCE_LOG_OUTPUT ?? process.env.ZERO_PERFORMANCE_OUTPUT),
      'app.log'
    )
  );
  const sql = postgres(required(process.env.E2E_DATABASE_URL), {
    max: 2,
    prepare: false,
    onnotice: () => undefined,
  });
  const identities = { owner: OWNER, outsider: OUTSIDER };
  const tokens: Record<string, string> = {};
  async function authenticate(actor: 'owner' | 'outsider') {
    const context = identities[actor];
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
  const sdkErrors = new WeakMap<Zero, ReturnType<typeof mutationSDKErrorDiagnostic>[]>();
  async function client(actor: 'owner' | 'outsider' | 'anonymous') {
    const diagnostics: ReturnType<typeof mutationSDKErrorDiagnostic>[] = [];
    const context = actor === 'anonymous' ? { userID: 'anon', email: '' } : identities[actor];
    if (actor !== 'anonymous') await authenticate(actor);
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
        log(level, context, ...args) {
          if (level === 'error' && diagnostics.length < 32)
            diagnostics.push(mutationSDKErrorDiagnostic(context, args));
          if (
            level === 'warn' &&
            args.some(value => typeof value === 'string' && /Slow query/i.test(value))
          )
            infrastructure.push('Mutation client slow-query warning');
        },
      },
    });
    sdkErrors.set(zero, diagnostics);
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
    // Anonymous-first selections still need real FK parents for resource owners
    // and independent counterparties before any SQL fixture is prepared.
    await authenticate('owner');
    await authenticate('outsider');
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
        let sample:
          | (MutationSample & {
              sdkErrors?: ReturnType<typeof mutationSDKErrorDiagnostic>[];
              clientErrorShape?: ReturnType<typeof mutationErrorShape>;
              serverErrorShape?: ReturnType<typeof mutationErrorShape>;
            })
          | undefined;
        let restored = false;
        let settled = true;
        let requestsSettled = true;
        let stage = 'client setup';
        let fixtureReadiness: ReturnType<typeof watch>['readiness'] | undefined;
        const additionalWriterBaselines: { read: () => unknown; baseline: unknown }[] = [];
        try {
          writer = await client(actor);
          stage = 'fixture setup';
          prepared = await entry.prepare({
            sql,
            id: randomUUID(),
            ownerID: OWNER.userID,
            outsiderID: OUTSIDER.userID,
            actorID: actor === 'anonymous' ? 'anon' : identities[actor].userID,
            actor: entry.actor,
          });
          stage = 'observer setup';
          observer = await client(prepared.observe?.actor === 'writer' ? actor : 'owner');
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
              observation = watch(view, preparedObservation.after, false);
              cancellations.push(observation.cancel);
            }
          }
          for (const preload of prepared.writerPreloads ?? []) {
            stage = 'additional writer fixture replication';
            const view = writer.materialize(preload.request as never, {
              ttl: 'none',
            }) as unknown as View;
            views.push(view);
            let current: unknown;
            cancellations.push(
              view.addListener(data => {
                current = data;
              })
            );
            const initial = watch(view, preload.before);
            cancellations.push(initial.cancel);
            await deadline(initial.promise, 'Additional writer fixture replication');
            initial.cancel();
            additionalWriterBaselines.push({
              read: () => current,
              baseline: structuredClone(current),
            });
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
            sdkErrors: sdkErrors.get(writer),
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
            observation?.arm();
          } catch (error) {
            sample.clientAppliedAt = performance.now();
            sample.outcome = 'client-error';
            sample.error = errorCode(error);
            sample.clientErrorShape = mutationErrorShape(error);
          }
          if (result) {
            settled = false;
            requestsSettled = false;
            const local = Promise.resolve(result.client).then(
              value => {
                measured.clientAppliedAt = performance.now();
                if (value.type === 'error') {
                  measured.outcome = 'client-error';
                  measured.error = errorCode(value.error);
                  measured.clientErrorShape = mutationErrorShape(value.error);
                }
              },
              error => {
                measured.clientAppliedAt = performance.now();
                measured.outcome = 'client-error';
                measured.error = errorCode(error);
                measured.clientErrorShape = mutationErrorShape(error);
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
                  measured.serverErrorShape = mutationErrorShape(value.error);
                }
              },
              error => {
                settled = true;
                if (measured.outcome === 'client-error') return;
                measured.confirmedAt = performance.now();
                measured.outcome = 'server-error';
                measured.error = errorCode(error);
                measured.serverErrorShape = mutationErrorShape(error);
              }
            );
            // Both promises are registered immediately; retries remain in the original elapsed time.
            await deadline(Promise.all([local, server]), 'Mutation completion');
            // Zero mirrors a local rejection into result.server. That promise can
            // settle first; it is not an acknowledgement from the server. Any
            // actual API attempt is retained and independently fails the gate.
            if (measured.outcome === 'client-error') {
              delete measured.confirmedAt;
              requestsSettled = true;
            }
          }
          sample.clientApplyMs = sample.clientAppliedAt - sample.startedAt;
          if (sample.confirmedAt !== undefined)
            sample.serverConfirmedMs = sample.confirmedAt - sample.startedAt;
          if (entry.outcome !== 'success' && prepared.observe && 'query' in expectation.observer) {
            observation = watch(views[0], prepared.observe.after);
            cancellations.push(observation.cancel);
          }
          // Zero may acknowledge the replicated commit before the API's queued
          // notification work ends. Preserve that SDK timestamp and await the
          // correlated API completion before SQL proofs or fixture cleanup.
          if (sample.outcome !== 'client-error') {
            stage = 'mutation API completion';
            const completion = await requestCompletion.wait({
              clientGroupID: sample.clientGroupID,
              clientID: sample.clientID,
              name: entry.name,
            });
            sample.completionRequestIDs = completion.requestIDs;
            sample.serverWorkObservedAt = completion.observedAt;
            requestsSettled = true;
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
            let applied;
            try {
              applied = required(await deadline(snapshot.promise, 'Writer mutation snapshot'));
            } catch (error) {
              stage =
                snapshot.diagnostics.state === 'map-rejected'
                  ? 'writer inspector map read'
                  : snapshot.diagnostics.state === 'invalid-response'
                    ? 'writer snapshot invalid response'
                    : 'writer snapshot missing marker';
              throw error;
            }
            sample.snapshotAppliedAt = applied.at;
            sample.snapshotMutationID = applied.mutationID;
          } else snapshot.cancel();
          stage = 'independent database verification';
          await prepared.verify();
          sample.databaseVerified = true;
          stage = 'optimistic rollback verification';
          if (sample.outcome !== 'success') {
            if (prepared.verifyRollback) await prepared.verifyRollback(writer);
            else if (prepared.observe) {
              await waitForRollback(() => writerCurrent, writerBaseline);
              for (const baseline of additionalWriterBaselines)
                await waitForRollback(baseline.read, baseline.baseline);
            } else assert.fail('Rejected mutation needs independent local rollback proof');
          }
          sample.rollbackVerified = true;
        } catch (error) {
          // Do not print arguments or errors that might contain sensitive fixture data.
          row.failures.push(
            `Mutation sample ${repeat + 1}: ${stage} failed` +
              fixtureFailureCode(error) +
              (stage === 'independent database verification' ? databaseProofLabel(error) : '') +
              (stage === 'optimistic rollback verification' ? rollbackProofLabel(error) : '') +
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
          if (prepared && settled && requestsSettled) {
            let restorationStage = 'cleanup';
            try {
              await prepared.restore();
              restorationStage = 'independent verification';
              await prepared.verifyRestored();
              restorationStage = 'WAL replication';
              await waitForZeroReady({ timeoutMs: 15_000, pollIntervalMs: 50 });
              restored = settled;
              if (sample) sample.restored = restored;
            } catch (error) {
              row.failures.push(
                `Mutation fixture restoration ${restorationStage} failed` +
                  fixtureFailureCode(error) +
                  restorationProofLabel(error)
              );
            }
          }
        }
        await progress();
        row.elapsedMs = performance.now() - caseStartedAt;
        // Closing a client cannot cancel an already dispatched transaction. Do not
        // continue into another fixture while an unconfirmed request may commit.
        if (!settled || !requestsSettled)
          throw new Error('Mutation still in flight; measurement section stopped');
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
