import { open } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { performance } from 'node:perf_hooks';

export interface MutationRequestIdentity {
  clientGroupID: string;
  clientID: string;
  name: string;
}
interface Stamp {
  at: number;
  elapsed: number;
  order: number;
}
type Identity = MutationRequestIdentity & { mutationID: number };
interface Attempt {
  arrivals: { stamp: Stamp; identities: Identity[] }[];
  delivery: Stamp[];
  response: Stamp[];
  invalid: boolean;
}
const failure = () => new Error('Mutation request completion correlation failed');
const prefix = '{"benchmark":"mutation-api"';
const chunkSize = 64 * 1024;
const groupKey = (identity: MutationRequestIdentity) =>
  JSON.stringify([identity.clientGroupID, identity.clientID, identity.name]);
const clientKey = (identity: MutationRequestIdentity) =>
  JSON.stringify([identity.clientGroupID, identity.clientID]);

/** The returned time is when this client observed API completion, never a server ACK timestamp. */
export class MutationRequestCompletion {
  private offset = 0;
  private partial = Buffer.alloc(0);
  private order = 0;
  private attempts = new Map<string, Attempt>();
  private groups = new Map<string, Set<string>>();
  private mutations = new Map<string, Set<number>>();
  constructor(private readonly logFile: string) {}

  private line(line: string) {
    if (!line.startsWith(prefix)) return;
    let value: Record<string, unknown>;
    try {
      value = JSON.parse(line) as Record<string, unknown>;
    } catch {
      throw failure();
    }
    if (!['arrival', 'delivery', 'response'].includes(String(value.phase))) return;
    if (typeof value.requestID !== 'string' || !value.requestID) throw failure();
    const attempt: Attempt = this.attempts.get(value.requestID) ?? {
      arrivals: [],
      delivery: [],
      response: [],
      invalid: false,
    };
    this.attempts.set(value.requestID, attempt);
    const valid =
      typeof value.at === 'number' &&
      Number.isFinite(value.at) &&
      value.at >= 0 &&
      typeof value.elapsed === 'number' &&
      Number.isFinite(value.elapsed) &&
      value.elapsed >= 0;
    if (!valid) {
      attempt.invalid = true;
      return;
    }
    const stamp = { at: value.at as number, elapsed: value.elapsed as number, order: this.order++ };
    if (value.phase === 'arrival') {
      if (!Array.isArray(value.identities)) throw failure();
      const identities = value.identities.map(item => {
        if (!item || typeof item !== 'object') throw failure();
        const identity = item as Record<string, unknown>;
        if (
          typeof identity.clientGroupID !== 'string' ||
          typeof identity.clientID !== 'string' ||
          typeof identity.name !== 'string' ||
          !Number.isSafeInteger(identity.mutationID) ||
          Number(identity.mutationID) < 1
        )
          throw failure();
        return {
          clientGroupID: identity.clientGroupID,
          clientID: identity.clientID,
          name: identity.name,
          mutationID: Number(identity.mutationID),
        };
      });
      attempt.arrivals.push({ stamp, identities });
      for (const identity of identities) {
        const requests = this.groups.get(groupKey(identity)) ?? new Set<string>();
        requests.add(value.requestID);
        this.groups.set(groupKey(identity), requests);
        const ids = this.mutations.get(clientKey(identity)) ?? new Set<number>();
        ids.add(identity.mutationID);
        this.mutations.set(clientKey(identity), ids);
      }
    } else if (value.phase === 'delivery') attempt.delivery.push(stamp);
    else attempt.response.push(stamp);
  }

  private async read(deadline: number) {
    const file = await open(this.logFile, 'r').catch(() => {
      throw failure();
    });
    try {
      if ((await file.stat()).size < this.offset) throw failure();
      const buffer = Buffer.alloc(chunkSize);
      while (performance.now() < deadline) {
        const { bytesRead } = await file.read(buffer, 0, buffer.length, this.offset);
        if (!bytesRead) return;
        this.offset += bytesRead;
        const contents = Buffer.concat([this.partial, buffer.subarray(0, bytesRead)]);
        let start = 0;
        for (let end = contents.indexOf(10); end >= 0; end = contents.indexOf(10, start)) {
          if (end - start > chunkSize) throw failure();
          this.line(contents.subarray(start, end).toString('utf8').replace(/\r$/, ''));
          start = end + 1;
        }
        this.partial = Buffer.from(contents.subarray(start));
        if (this.partial.length > chunkSize) throw failure();
      }
      throw failure();
    } catch {
      throw failure();
    } finally {
      await file.close().catch(() => {
        throw failure();
      });
    }
  }

  async wait(
    identity: MutationRequestIdentity,
    timeoutMs = 15_000
  ): Promise<{ requestIDs: string[]; observedAt: number }> {
    if (
      !Number.isFinite(timeoutMs) ||
      timeoutMs <= 0 ||
      !identity ||
      ['clientGroupID', 'clientID', 'name'].some(
        field =>
          typeof identity[field as keyof MutationRequestIdentity] !== 'string' ||
          !identity[field as keyof MutationRequestIdentity]
      )
    )
      throw failure();
    const deadline = performance.now() + timeoutMs;
    while (performance.now() < deadline) {
      await this.read(deadline);
      const matched: [string, Attempt][] = [];
      if ((this.mutations.get(clientKey(identity))?.size ?? 0) > 1) throw failure();
      for (const id of this.groups.get(groupKey(identity)) ?? []) {
        const attempt = this.attempts.get(id);
        if (!attempt) throw failure();
        const identities = attempt.arrivals
          .flatMap(arrival => arrival.identities)
          .filter(
            item =>
              item.clientGroupID === identity.clientGroupID &&
              item.clientID === identity.clientID &&
              item.name === identity.name
          );
        if (!identities.length) continue;
        if (
          attempt.invalid ||
          attempt.arrivals.length !== 1 ||
          identities.length !== 1 ||
          attempt.delivery.length > 1 ||
          attempt.response.length > 1
        )
          throw failure();
        matched.push([id, attempt]);
      }
      let complete = matched.length > 0;
      for (const [, attempt] of matched) {
        const arrival = attempt.arrivals[0].stamp;
        const delivery = attempt.delivery[0];
        const response = attempt.response[0];
        if (arrival.elapsed !== 0) throw failure();
        const toleranceMs = 0.1;
        if (delivery && delivery.elapsed > delivery.at - arrival.at + toleranceMs) throw failure();
        if (response && Math.abs(response.elapsed - (response.at - arrival.at)) > toleranceMs)
          throw failure();
        if (
          response &&
          delivery &&
          (delivery.elapsed > response.elapsed + toleranceMs ||
            delivery.at - arrival.at > response.elapsed + toleranceMs)
        )
          throw failure();
        if (response && !delivery) throw failure();
        if (delivery && (delivery.order <= arrival.order || delivery.at < arrival.at))
          throw failure();
        if (response && delivery && (response.order <= delivery.order || response.at < delivery.at))
          throw failure();
        if (!delivery || !response) complete = false;
      }
      if (complete)
        return { requestIDs: matched.map(([id]) => id).sort(), observedAt: performance.now() };
      await sleep(Math.min(5, Math.max(0, deadline - performance.now())));
    }
    throw failure();
  }
}
