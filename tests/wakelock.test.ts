import { describe, expect, it } from 'vitest';
import { createWakeLock } from '../src/system/wakelock';

function fakeEnv({ refuse = false } = {}) {
  const sentinels: { released: boolean; fire: () => void }[] = [];
  let requests = 0;
  const api = {
    request: async () => {
      requests++;
      if (refuse) throw new Error('NotAllowedError');
      const listeners: (() => void)[] = [];
      const s = {
        released: false,
        release: async () => {
          s.released = true;
          listeners.forEach((fn) => fn());
        },
        addEventListener: (_: 'release', fn: () => void) => listeners.push(fn),
        fire: () => {
          s.released = true;
          listeners.forEach((fn) => fn());
        },
      };
      sentinels.push(s);
      return s;
    },
  };
  const docListeners: (() => void)[] = [];
  const doc = {
    visibilityState: 'visible' as DocumentVisibilityState,
    addEventListener: (_: string, fn: () => void) => docListeners.push(fn),
  };
  const setVisible = (v: boolean) => {
    doc.visibilityState = v ? 'visible' : 'hidden';
    docListeners.forEach((fn) => fn());
  };
  return { api, doc, sentinels, setVisible, requests: () => requests };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('wake lock', () => {
  it('holds the lock only while wanted', async () => {
    const env = fakeEnv();
    const wl = createWakeLock(env.api, env.doc as never);
    expect(wl.active).toBe(false);
    wl.want('reader', true);
    await tick();
    expect(wl.active).toBe(true);
    wl.want('reader', false);
    await tick();
    expect(wl.active).toBe(false);
    expect(env.sentinels[0].released).toBe(true);
  });

  it('keeps the lock while any source wants it', async () => {
    const env = fakeEnv();
    const wl = createWakeLock(env.api, env.doc as never);
    wl.want('a', true);
    wl.want('b', true);
    await tick();
    wl.want('a', false);
    await tick();
    expect(wl.active).toBe(true);
    expect(env.requests()).toBe(1);
  });

  it('respects the setting', async () => {
    const env = fakeEnv();
    const wl = createWakeLock(env.api, env.doc as never);
    wl.setEnabled(false);
    wl.want('reader', true);
    await tick();
    expect(env.requests()).toBe(0);
    wl.setEnabled(true);
    await tick();
    expect(wl.active).toBe(true);
  });

  it('re-acquires after the browser drops it on hide', async () => {
    const env = fakeEnv();
    const wl = createWakeLock(env.api, env.doc as never);
    wl.want('reader', true);
    await tick();
    env.setVisible(false);
    env.sentinels[0].fire(); // browser releases it
    await tick();
    expect(wl.active).toBe(false);
    env.setVisible(true);
    await tick();
    expect(wl.active).toBe(true);
    expect(env.requests()).toBe(2);
  });

  it('releases if no longer wanted by the time the request resolves', async () => {
    const env = fakeEnv();
    const wl = createWakeLock(env.api, env.doc as never);
    wl.want('reader', true);
    wl.want('reader', false);
    await tick();
    await tick();
    expect(wl.active).toBe(false);
  });

  it('fails silently when refused or unsupported', async () => {
    const env = fakeEnv({ refuse: true });
    const wl = createWakeLock(env.api, env.doc as never);
    wl.want('reader', true);
    await tick();
    expect(wl.active).toBe(false);

    const none = createWakeLock(undefined, env.doc as never);
    expect(none.supported).toBe(false);
    expect(() => none.want('reader', true)).not.toThrow();
  });
});
