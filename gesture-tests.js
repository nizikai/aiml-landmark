// gesture-tests.js — Property-based tests for mediapipe-3d-gesture-interaction
// Run with: node gesture-tests.js

import fc from 'fast-check';
import assert from 'node:assert/strict';

// ── CONFIG (copied from test-opt.html) ────────────────────────────────────────
const CONFIG = {
    PINCH_THRESHOLD:         0.08,
    GESTURE_DEBOUNCE_FRAMES: 3,
    DEPTH_MIN:               -300,
    DEPTH_MAX:                300,
    HAND_SIZE_MIN:            0.10,
    HAND_SIZE_MAX:            0.40,
    DEPTH_LERP:               0.10,
};

// ── PURE FUNCTIONS (extracted from test-opt.html) ─────────────────────────────

function dist2D(a, b) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// classifyPinch: returns true if distance < threshold (Property 1)
function classifyPinch(a, b) {
    return dist2D(a, b) < CONFIG.PINCH_THRESHOLD;
}

// classifyGesture: returns one of 'pinch' | 'point' | 'open_hand' | 'none'
function classifyGesture(landmarks) {
    if (dist2D(landmarks[4], landmarks[8]) < CONFIG.PINCH_THRESHOLD) {
        return 'pinch';
    }
    const indexExtended  = landmarks[8].y  < landmarks[5].y;
    const middleCurled   = landmarks[12].y > landmarks[9].y;
    const ringCurled     = landmarks[16].y > landmarks[13].y;
    const pinkyCurled    = landmarks[20].y > landmarks[17].y;
    const middleExtended = landmarks[12].y < landmarks[9].y;
    const ringExtended   = landmarks[16].y < landmarks[13].y;
    const pinkyExtended  = landmarks[20].y < landmarks[17].y;
    if (indexExtended && middleCurled && ringCurled && pinkyCurled) return 'point';
    if (indexExtended && middleExtended && ringExtended && pinkyExtended) return 'open_hand';
    return 'none';
}

// applyDebounce: applies debounce logic and returns the committed gesture
// buffer: { candidate: string, count: number }
// committed: current committed gesture
// Returns: { buffer, committed }
function applyDebounce(buffer, committed, rawGesture) {
    if (rawGesture === buffer.candidate) {
        const newCount = buffer.count + 1;
        if (newCount >= CONFIG.GESTURE_DEBOUNCE_FRAMES) {
            return { buffer: { candidate: rawGesture, count: newCount }, committed: rawGesture };
        }
        return { buffer: { candidate: rawGesture, count: newCount }, committed };
    } else {
        return { buffer: { candidate: rawGesture, count: 1 }, committed };
    }
}

// computeTargetZ: maps bboxWidth to a Z value (larger hand → smaller Z)
function computeTargetZ(bboxWidth) {
    const t = Math.max(0, Math.min(1,
        (bboxWidth - CONFIG.HAND_SIZE_MIN) / (CONFIG.HAND_SIZE_MAX - CONFIG.HAND_SIZE_MIN)
    ));
    return CONFIG.DEPTH_MAX - t * (CONFIG.DEPTH_MAX - CONFIG.DEPTH_MIN);
}

// clampZ: clamps Z to [DEPTH_MIN, DEPTH_MAX]
function clampZ(z) {
    return Math.max(CONFIG.DEPTH_MIN, Math.min(CONFIG.DEPTH_MAX, z));
}

// computeTwoHandPinch: returns true iff both hands are 'pinch'
function computeTwoHandPinch(leftGesture, rightGesture) {
    return leftGesture === 'pinch' && rightGesture === 'pinch';
}

// ── PROPERTY TESTS ────────────────────────────────────────────────────────────

const GESTURE_LABELS = ['none', 'pinch', 'point', 'open_hand'];
const numRuns = 100;

// Property 1: classifyPinch ↔ dist < threshold
// Feature: mediapipe-3d-gesture-interaction, Property 1
console.log('Running Property 1: pinch ↔ distance < threshold...');
fc.assert(
    fc.property(
        fc.record({ x: fc.float({ min: 0, max: 1, noNaN: true }), y: fc.float({ min: 0, max: 1, noNaN: true }) }),
        fc.record({ x: fc.float({ min: 0, max: 1, noNaN: true }), y: fc.float({ min: 0, max: 1, noNaN: true }) }),
        (a, b) => {
            const result = classifyPinch(a, b);
            const expected = dist2D(a, b) < CONFIG.PINCH_THRESHOLD;
            return result === expected;
        }
    ),
    { numRuns }
);
console.log('  ✓ Property 1 passed');

// Property 2: debounce — committed gesture only changes after GESTURE_DEBOUNCE_FRAMES consecutive matching frames
// Feature: mediapipe-3d-gesture-interaction, Property 2
console.log('Running Property 2: debounce suppresses transient state changes...');
fc.assert(
    fc.property(
        fc.array(fc.constantFrom(...GESTURE_LABELS), { minLength: 1, maxLength: 50 }),
        (sequence) => {
            let buffer = { candidate: 'none', count: 0 };
            let committed = 'none';
            let consecutiveCount = 0;
            let prevRaw = null;

            for (const raw of sequence) {
                if (raw === prevRaw) {
                    consecutiveCount++;
                } else {
                    consecutiveCount = 1;
                }
                prevRaw = raw;

                const prev = committed;
                ({ buffer, committed } = applyDebounce(buffer, committed, raw));

                // If committed changed, it must have been after >= GESTURE_DEBOUNCE_FRAMES consecutive frames
                if (committed !== prev) {
                    if (consecutiveCount < CONFIG.GESTURE_DEBOUNCE_FRAMES) {
                        return false;
                    }
                }
            }
            return true;
        }
    ),
    { numRuns }
);
console.log('  ✓ Property 2 passed');

// Property 3: monotonic depth — w1 < w2 → computeTargetZ(w1) > computeTargetZ(w2)
// Feature: mediapipe-3d-gesture-interaction, Property 3
console.log('Running Property 3: monotonic depth mapping...');
fc.assert(
    fc.property(
        fc.float({ min: Math.fround(CONFIG.HAND_SIZE_MIN), max: Math.fround(CONFIG.HAND_SIZE_MAX), noNaN: true }),
        fc.float({ min: Math.fround(CONFIG.HAND_SIZE_MIN), max: Math.fround(CONFIG.HAND_SIZE_MAX), noNaN: true }),
        (w1, w2) => {
            if (Math.abs(w1 - w2) < 1e-6) return true; // skip near-equal values
            const smaller = Math.min(w1, w2);
            const larger  = Math.max(w1, w2);
            return computeTargetZ(smaller) >= computeTargetZ(larger);
        }
    ),
    { numRuns }
);
console.log('  ✓ Property 3 passed');

// Property 4: Z clamping — clamped Z is always in [DEPTH_MIN, DEPTH_MAX]
// Feature: mediapipe-3d-gesture-interaction, Property 4
console.log('Running Property 4: Z clamping within bounds...');
fc.assert(
    fc.property(
        fc.float({ min: -1000, max: 1000, noNaN: true }),
        (z) => {
            const clamped = clampZ(z);
            return clamped >= CONFIG.DEPTH_MIN && clamped <= CONFIG.DEPTH_MAX;
        }
    ),
    { numRuns }
);
console.log('  ✓ Property 4 passed');

// Property 6: single gesture per frame — classifyGesture returns exactly one label
// Feature: mediapipe-3d-gesture-interaction, Property 6
console.log('Running Property 6: single gesture per frame...');
const landmarkArb = fc.record({
    x: fc.float({ min: 0, max: 1, noNaN: true }),
    y: fc.float({ min: 0, max: 1, noNaN: true }),
    z: fc.float({ min: -1, max: 1, noNaN: true }),
});
fc.assert(
    fc.property(
        fc.array(landmarkArb, { minLength: 21, maxLength: 21 }),
        (landmarks) => {
            const result = classifyGesture(landmarks);
            return GESTURE_LABELS.includes(result);
        }
    ),
    { numRuns }
);
console.log('  ✓ Property 6 passed');

// Property 7: two-hand pinch invariant
// Feature: mediapipe-3d-gesture-interaction, Property 7
console.log('Running Property 7: two-hand pinch invariant...');
fc.assert(
    fc.property(
        fc.constantFrom(...GESTURE_LABELS),
        fc.constantFrom(...GESTURE_LABELS),
        (leftGesture, rightGesture) => {
            const twoHandPinch = computeTwoHandPinch(leftGesture, rightGesture);
            const expected = leftGesture === 'pinch' && rightGesture === 'pinch';
            return twoHandPinch === expected;
        }
    ),
    { numRuns }
);
console.log('  ✓ Property 7 passed');

console.log('\nAll property tests passed! ✓');
