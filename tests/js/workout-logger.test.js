import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = (await readFile(new URL('../../GymLogger/wwwroot/js/views/workout-logger.js', import.meta.url), 'utf8'))
    .replace(/^import .*;\r?\n/gm, '')
    .replace(/^export /gm, '');

function createHarness(sessionId = 'active_local_workout', response = {}) {
    const requests = [];
    const messages = [];
    const View = vm.runInNewContext(`${source}\nWorkoutLoggerView;`, {
        window: { addEventListener() {} },
        document: { getElementById() { return null; } },
        console: { error() {} },
        api: { async addSet(...args) { requests.push(args); return response; } },
        notification: {
            success(message) { messages.push(['success', message]); },
            warning(message) { messages.push(['warning', message]); },
            error(message) { messages.push(['error', message]); }
        }
    });
    const view = new View();
    view.session = { id: sessionId };
    view.program = { exercises: [{ exerciseId: 'squat', targetWeight: 105 }] };
    view.preferences = { defaultWeightUnit: 'LBS' };
    let savedSets;
    let renderedSets;
    view.saveDraftWorkout = async () => { savedSets = structuredClone(view.sets); };
    view.renderWorkout = async () => { renderedSets = structuredClone(view.sets); };
    return { view, requests, messages, get savedSets() { return savedSets; }, get renderedSets() { return renderedSets; } };
}

test('warmup rows are saved and rendered locally without posting a draft session to the server', async () => {
    const harness = createHarness();
    await harness.view.addWarmupSets();

    assert.equal(harness.requests.length, 0);
    assert.equal(harness.savedSets.length, 5);
    assert.deepEqual(harness.renderedSets, harness.savedSets);
    assert.deepEqual(harness.savedSets.map(set => set.weight), [52.5, 63, 73.5, 84, 94.5]);
    assert.deepEqual(harness.savedSets.map(set => set.reps), [5, 5, 3, 2, 1]);
    assert.deepEqual(harness.savedSets.map(set => set.setNumber), [1, 2, 3, 4, 5]);
    assert.equal(new Set(harness.savedSets.map(set => set.id)).size, 5);
    assert.ok(harness.savedSets.every(set => set.isWarmup && set.sessionId === 'active_local_workout' && set.weightUnit === 'LBS' && set.loggedAt && set.createdAt));
    assert.equal(harness.view.shouldShowWarmupButton(harness.view.sets, harness.view.program.exercises[0]), false);
    assert.equal(harness.messages[0][0], 'success');
});

test('server sessions still add returned warmup sets', async () => {
    const harness = createHarness('server-session', { success: true, data: { id: 'server-set', isWarmup: true } });
    harness.view.preferences.warmupPercentages = [50];
    harness.view.preferences.warmupReps = [8];
    await harness.view.addWarmupSets();

    assert.equal(harness.requests.length, 1);
    assert.equal(harness.requests[0][0], 'server-session');
    assert.equal(harness.requests[0][1].reps, 8);
    assert.equal(harness.savedSets[0].id, 'server-set');
});

test('failed server saves do not report warmup success', async () => {
    const harness = createHarness('server-session', { success: false, error: 'Session not found' });
    await harness.view.addWarmupSets();

    assert.equal(harness.requests.length, 1);
    assert.equal(harness.view.sets.length, 0);
    assert.deepEqual(harness.messages, [['error', 'Failed to add warmup sets: Session not found']]);
});