interface ObservationView {
  addListener(callback: (data: unknown, type: string) => void): () => void;
}

/** Retain real complete callbacks before invocation, but stamp success only after arming. */
export function watchMutationObservation(
  view: ObservationView,
  predicate: (data: unknown) => boolean,
  armed = true,
  now: () => number = () => performance.now()
) {
  let cancelled = false;
  let settled = false;
  let latest: unknown;
  let latestComplete = false;
  let resolve!: (at: number) => void;
  let reject!: (error: unknown) => void;
  const readiness = { events: 0, lastType: 'none', predicateMatched: false };
  const promise = new Promise<number>((finish, fail) => {
    resolve = finish;
    reject = fail;
  });
  void promise.catch(() => undefined);
  const check = () => {
    if (cancelled || settled || !latestComplete) return;
    try {
      readiness.predicateMatched = predicate(latest);
      if (armed && readiness.predicateMatched) {
        settled = true;
        resolve(now());
      }
    } catch (error) {
      settled = true;
      reject(error);
    }
  };
  const release = view.addListener((data, type) => {
    if (cancelled || settled) return;
    readiness.events++;
    readiness.lastType = type;
    latestComplete = type === 'complete';
    readiness.predicateMatched = false;
    if (type === 'error') {
      settled = true;
      reject(new Error('Mutation observation query rejected'));
      return;
    }
    if (latestComplete) {
      latest = data;
      check();
    }
  });
  return {
    promise,
    readiness,
    arm() {
      if (cancelled || settled) return;
      armed = true;
      check();
    },
    cancel() {
      if (!cancelled) {
        cancelled = true;
        release();
      }
    },
  };
}
