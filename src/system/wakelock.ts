// Keeps the screen awake while words are playing, the way a video player does.
// Uses the Screen Wake Lock API where available and fails silently elsewhere.
//
// Several parts of the app can ask for the lock (the reader, the speed test);
// it's held while any of them wants it and the feature is enabled.

type Sentinel = { released: boolean; release(): Promise<void>; addEventListener(t: 'release', fn: () => void): void };
type WakeLockApi = { request(type: 'screen'): Promise<Sentinel> };

export type WakeLock = {
  /** Say whether `source` currently wants the screen kept on. */
  want(source: string, on: boolean): void;
  /** Master switch (the "Keep screen awake" setting). */
  setEnabled(on: boolean): void;
  readonly supported: boolean;
  /** True while a lock is actually held. */
  readonly active: boolean;
};

export function createWakeLock(
  api: WakeLockApi | undefined = (globalThis.navigator as unknown as { wakeLock?: WakeLockApi } | undefined)
    ?.wakeLock,
  doc: Pick<Document, 'visibilityState' | 'addEventListener'> | undefined = globalThis.document,
): WakeLock {
  const wanted = new Set<string>();
  let enabled = true;
  let sentinel: Sentinel | null = null;
  let pending: Promise<void> | null = null;

  const shouldHold = () => !!api && enabled && wanted.size > 0 && (!doc || doc.visibilityState === 'visible');

  const sync = () => {
    if (shouldHold()) {
      if (sentinel && !sentinel.released) return;
      if (pending) return;
      pending = api!
        .request('screen')
        .then((s) => {
          sentinel = s;
          // The browser drops the lock when the tab is hidden; take it back
          // when we return if we still want it.
          s.addEventListener('release', () => {
            if (sentinel === s) sentinel = null;
          });
          // Things may have changed while the request was in flight.
          if (!shouldHold()) void release();
        })
        .catch(() => {
          /* refused (battery saver, permissions policy…) — carry on without it */
        })
        .finally(() => {
          pending = null;
        });
    } else {
      void release();
    }
  };

  const release = async () => {
    const s = sentinel;
    sentinel = null;
    if (s && !s.released) {
      try {
        await s.release();
      } catch {
        /* ignore */
      }
    }
  };

  doc?.addEventListener('visibilitychange', sync);

  return {
    want(source, on) {
      if (on) wanted.add(source);
      else wanted.delete(source);
      sync();
    },
    setEnabled(on) {
      enabled = on;
      sync();
    },
    get supported() {
      return !!api;
    },
    get active() {
      return !!sentinel && !sentinel.released;
    },
  };
}

/** The app-wide instance. */
export const wakeLock = createWakeLock();
