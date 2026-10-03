import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const apiSource = (await readFile(new URL('../../GymLogger/wwwroot/js/utils/api-client.js', import.meta.url), 'utf8'))
    .replace(/^import .*;\r?\n/gm, '')
    .replace(/^export /gm, '');
const dialogSource = (await readFile(new URL('../../GymLogger/wwwroot/js/components/exercise-history-dialog.js', import.meta.url), 'utf8'))
    .replace(/^import .*;\r?\n/gm, '')
    .replace(/^export /gm, '');

function apiHarness({ online = true, cached = null, fetchImpl } = {}) {
    const writes = [];
    const events = [];
    const timers = [];
    const client = vm.runInNewContext(`${apiSource}\nnew ApiClient();`, {
        navigator: { onLine: online },
        AbortController,
        console: { error() {}, warn() {} },
        eventBus: { on() {}, emit(...args) { events.push(args); } },
        offlineManager: {
            async getCachedData() { return cached; },
            async cacheData(...args) { writes.push(args); }
        },
        fetch: fetchImpl,
        setTimeout(callback, delay) { timers.push({ callback, delay, cleared: false }); return timers.length - 1; },
        clearTimeout(id) { timers[id].cleared = true; }
    });
    return { client, writes, events, timers };
}

const oldHistory = [{ date: '2026-09-01', sets: [{ weight: 80, reps: 5 }] }];
const newHistory = [{ date: '2026-10-02', sets: [{ weight: 90, reps: 5 }] }];

test('history fetches newer sets rather than returning an older valid cache', async () => {
    const harness = apiHarness({
        cached: oldHistory,
        fetchImpl: async () => new Response(JSON.stringify(newHistory))
    });
    const result = await harness.client.getExerciseHistory('squat', 5, { showLoader: false });
    assert.equal(result.source, 'network');
    assert.equal(result.data[0].sets[0].weight, 90);
    assert.equal(harness.writes[0][0], 'history_squat_5');
    assert.equal(harness.writes[0][2], 604800000);
    assert.equal(harness.timers[0].delay, 10000);
    assert.equal(harness.timers[0].cleared, true);
    assert.equal(harness.events.length, 0);
});

test('failed online request identifies old sets as cached; retry fetches newer sets', async () => {
    let fail = true;
    const harness = apiHarness({
        cached: oldHistory,
        fetchImpl: async () => {
            if (fail) throw new TypeError('Failed to fetch');
            return new Response(JSON.stringify(newHistory));
        }
    });
    const first = await harness.client.getExerciseHistory('squat', 5);
    assert.equal(first.source, 'cache');
    assert.equal(first.data[0].sets[0].weight, 80);
    fail = false;
    const second = await harness.client.getExerciseHistory('squat', 5);
    assert.equal(second.source, 'network');
    assert.equal(second.data[0].sets[0].weight, 90);
});

test('service worker fallback is not mistaken for fresh network history or recached', async () => {
    const harness = apiHarness({
        fetchImpl: async () => new Response(JSON.stringify(oldHistory), {
            headers: { 'X-Offline-Response': 'true' }
        })
    });
    const result = await harness.client.getExerciseHistory('squat', 5);
    assert.equal(result.source, 'cache');
    assert.equal(result.online, false);
    assert.equal(harness.writes.length, 0);
});

test('offline history returns saved sets and reports an error if cache is missing or expired', async () => {
    const cached = apiHarness({ online: false, cached: oldHistory });
    assert.equal((await cached.client.getExerciseHistory('squat', 5)).source, 'cache');
    const missing = apiHarness({ online: false });
    const result = await missing.client.getExerciseHistory('squat', 5);
    assert.equal(result.success, false);
    assert.equal(result.error, 'No cached data available');
});

test('a stalled history request times out and falls back to saved sets', async () => {
    const harness = apiHarness({
        cached: oldHistory,
        fetchImpl: (_, { signal }) => new Promise((resolve, reject) => {
            signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        })
    });
    const pending = harness.client.getExerciseHistory('squat', 5);
    harness.timers[0].callback();
    const result = await pending;
    assert.equal(result.source, 'cache');
    assert.equal(harness.client.activeControllers.size, 0);
    assert.equal(harness.timers[0].cleared, true);
});

test('a stalled request without saved history reports a timeout, not a cancellation', async () => {
    const harness = apiHarness({
        fetchImpl: (_, { signal }) => new Promise((resolve, reject) => {
            signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        })
    });
    const pending = harness.client.getExerciseHistory('squat', 5);
    harness.timers[0].callback();
    const result = await pending;
    assert.equal(result.success, false);
    assert.match(result.error, /timed out/);
});

test('timeout also covers a response whose body stalls after headers arrive', async () => {
    let bodyStarted;
    const started = new Promise(resolve => { bodyStarted = resolve; });
    const harness = apiHarness({
        fetchImpl: async (_, { signal }) => ({
            ok: true,
            json: () => new Promise((resolve, reject) => {
                signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
                bodyStarted();
            })
        })
    });
    const pending = harness.client.getExerciseHistory('squat', 5);
    await started;
    assert.equal(harness.timers[0].cleared, false);
    harness.timers[0].callback();
    assert.match((await pending).error, /timed out/);
    assert.equal(harness.timers[0].cleared, true);
});

function dialogHarness(response) {
    const requests = [];
    const overlays = [];
    const Dialog = vm.runInNewContext(`${dialogSource}\nExerciseHistoryDialog;`, {
        console: { error() {} },
        api: { async getExerciseHistory(...args) { requests.push(args); return await response; } },
        document: {
            createElement() {
                const overlay = {
                    style: {}, innerHTML: '', isConnected: false,
                    remove() { this.isConnected = false; }
                };
                overlays.push(overlay);
                return overlay;
            },
            body: { appendChild(overlay) { overlay.isConnected = true; } },
            getElementById() { return overlays.find(overlay => overlay.isConnected); }
        }
    });
    const dialog = new Dialog();
    dialog.attachCloseListener = () => {};
    return { dialog, requests, overlays };
}

test('dialog uses its own loader and passes cache status to rendering', async () => {
    const harness = dialogHarness({ success: true, source: 'cache', data: oldHistory });
    let rendered;
    harness.dialog.renderHistory = (...args) => { rendered = args; };
    await harness.dialog.show({ id: 'squat', name: 'Squat' }, {});
    assert.equal(harness.requests[0][2].showLoader, false);
    assert.equal(rendered[4], true);
});

test('cached history has a warning and retry, while fresh history has no warning', () => {
    const harness = dialogHarness();
    harness.dialog.attachRetryListener = () => {};
    let html;
    const overlay = { querySelector() { return { set outerHTML(value) { html = value; } }; } };
    harness.dialog.renderHistory(overlay, { name: 'Squat' }, [], 'KG', true);
    assert.match(html, /Showing saved history/);
    assert.match(html, /retry-history-btn/);
    harness.dialog.renderHistory(overlay, { name: 'Squat' }, [], 'KG', false);
    assert.doesNotMatch(html, /Showing saved history/);
});

test('retry requests history again and closed dialogs ignore late responses', async () => {
    const harness = dialogHarness({ success: true, source: 'network', data: [] });
    let retry;
    harness.dialog.attachRetryListener({
        querySelector() { return { addEventListener(event, callback) { retry = callback; } }; }
    }, { id: 'squat', name: 'Squat' });
    harness.dialog.renderHistory = () => {};
    await retry();
    assert.equal(harness.requests.length, 1);

    let resolve;
    const late = dialogHarness(new Promise(done => { resolve = done; }));
    let rendered = false;
    late.dialog.renderHistory = () => { rendered = true; };
    const pending = late.dialog.show({ id: 'squat', name: 'Squat' }, {});
    late.dialog.close();
    resolve({ success: true, source: 'network', data: [] });
    await pending;
    assert.equal(rendered, false);
});

test('dialog surfaces the specific failure and provides retry', async () => {
    const harness = dialogHarness({ success: false, error: 'Request timed out. Please try again.' });
    let message;
    harness.dialog.showError = (overlay, exercise, error) => { message = error; };
    await harness.dialog.show({ id: 'squat', name: 'Squat' }, {});
    assert.match(message, /timed out/);

    const renderedHarness = dialogHarness();
    renderedHarness.dialog.attachRetryListener = () => {};
    let html;
    const overlay = { querySelector() { return { set outerHTML(value) { html = value; } }; } };
    renderedHarness.dialog.showError(overlay, { name: 'Squat' }, message);
    assert.match(html, /retry-history-btn/);
    assert.match(html, /timed out/);
});
