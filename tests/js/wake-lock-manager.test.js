import assert from 'node:assert/strict';
import test from 'node:test';

import { WakeLockManager } from '../../GymLogger/wwwroot/js/utils/wake-lock-manager.js';

class FakeDocument extends EventTarget {
    constructor() {
        super();
        this.visibilityState = 'visible';
    }

    setVisibility(state) {
        this.visibilityState = state;
        this.dispatchEvent(new Event('visibilitychange'));
    }
}

class FakeWakeLockSentinel extends EventTarget {
    constructor() {
        super();
        this.released = false;
    }

    async release() {
        if (this.released) return;
        this.released = true;
        this.dispatchEvent(new Event('release'));
    }

    revoke() {
        this.released = true;
        this.dispatchEvent(new Event('release'));
    }
}

function createHarness(requestImplementation) {
    const documentRef = new FakeDocument();
    const requests = [];
    const scheduledRetries = [];
    const clearedRetries = [];
    const navigatorRef = {
        wakeLock: {
            async request(type) {
                requests.push(type);
                return requestImplementation(requests.length);
            }
        }
    };

    const manager = new WakeLockManager({
        documentRef,
        navigatorRef,
        retryDelays: [1000, 3000],
        setTimeoutFn(callback, delay) {
            const timer = { callback, delay };
            scheduledRetries.push(timer);
            return timer;
        },
        clearTimeoutFn(timer) {
            clearedRetries.push(timer);
        }
    });

    return { manager, documentRef, requests, scheduledRetries, clearedRetries };
}

async function flushPromises() {
    await Promise.resolve();
    await Promise.resolve();
}

test('reacquires a system-revoked lock while the workout remains active', async () => {
    const sentinels = [];
    const harness = createHarness(() => {
        const sentinel = new FakeWakeLockSentinel();
        sentinels.push(sentinel);
        return sentinel;
    });

    assert.equal(await harness.manager.enable(), true);
    sentinels[0].revoke();

    assert.equal(harness.scheduledRetries.length, 1);
    assert.equal(harness.scheduledRetries[0].delay, 1000);

    harness.scheduledRetries[0].callback();
    await flushPromises();

    assert.equal(harness.requests.length, 2);
    assert.equal(harness.manager.isActive(), true);
});

test('reacquires immediately when returning to a visible app', async () => {
    const sentinels = [];
    const harness = createHarness(() => {
        const sentinel = new FakeWakeLockSentinel();
        sentinels.push(sentinel);
        return sentinel;
    });

    await harness.manager.enable();
    harness.documentRef.setVisibility('hidden');
    sentinels[0].revoke();

    assert.equal(harness.scheduledRetries.length, 0);

    harness.documentRef.setVisibility('visible');
    await flushPromises();

    assert.equal(harness.requests.length, 2);
    assert.equal(harness.manager.isActive(), true);
});

test('retries transient acquisition failures with bounded backoff', async () => {
    const sentinel = new FakeWakeLockSentinel();
    const harness = createHarness((attempt) => {
        if (attempt < 3) {
            throw new DOMException('Temporarily unavailable', 'NotAllowedError');
        }
        return sentinel;
    });

    assert.equal(await harness.manager.enable(), false);
    assert.equal(harness.scheduledRetries[0].delay, 1000);

    harness.scheduledRetries[0].callback();
    await flushPromises();
    assert.equal(harness.scheduledRetries[1].delay, 3000);

    harness.scheduledRetries[1].callback();
    await flushPromises();

    assert.equal(harness.requests.length, 3);
    assert.equal(harness.manager.isActive(), true);
});

test('disabling cancels recovery and releases the current lock', async () => {
    const sentinel = new FakeWakeLockSentinel();
    const harness = createHarness(() => sentinel);

    await harness.manager.enable();
    sentinel.revoke();
    const retry = harness.scheduledRetries[0];

    await harness.manager.disable();
    retry.callback();
    await flushPromises();

    assert.equal(harness.manager.isEnabled(), false);
    assert.equal(harness.requests.length, 1);
    assert.ok(harness.clearedRetries.includes(retry));
});

test('resume recovers a lock after a page is restored from back-forward cache', async () => {
    const sentinels = [];
    const harness = createHarness(() => {
        const sentinel = new FakeWakeLockSentinel();
        sentinels.push(sentinel);
        return sentinel;
    });

    await harness.manager.enable();
    sentinels[0].revoke();
    await harness.manager.resume();

    assert.equal(harness.requests.length, 2);
    assert.equal(harness.manager.isActive(), true);
});
