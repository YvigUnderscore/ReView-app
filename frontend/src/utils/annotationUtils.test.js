import { isPointInShape, moveShape } from './annotationUtils.js';

// Mock canvas size 1000x1000
const canvasSize = { width: 1000, height: 1000 };

const runTests = () => {
    let passed = 0;
    let failed = 0;

    const assert = (condition, message) => {
        if (condition) {
            console.log(`✅ ${message}`);
            passed++;
        } else {
            console.error(`❌ ${message}`);
            failed++;
        }
    };

    console.log("--- Testing Rect ---");
    const rect = { tool: 'rect', x: 0.1, y: 0.1, w: 0.2, h: 0.2 }; // Rect from (0.1, 0.1) to (0.3, 0.3)
    assert(isPointInShape({ x: 0.2, y: 0.2 }, rect, canvasSize), "Point inside rect should return true");
    assert(!isPointInShape({ x: 0.4, y: 0.4 }, rect, canvasSize), "Point outside rect should return false");

    console.log("--- Testing Line ---");
    const line = { tool: 'line', x: 0.1, y: 0.1, w: 0.2, h: 0 }; // Horizontal line from (0.1, 0.1) to (0.3, 0.1)
    // Hit radius is approx 0.015
    assert(isPointInShape({ x: 0.2, y: 0.105 }, line, canvasSize), "Point near line should return true");
    assert(!isPointInShape({ x: 0.2, y: 0.2 }, line, canvasSize), "Point far from line should return false");

    console.log("--- Testing Pencil ---");
    const pencil = { tool: 'pencil', points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }] };
    assert(isPointInShape({ x: 0.15, y: 0.15 }, pencil, canvasSize), "Point on pencil stroke should return true");

    console.log("--- Testing Move ---");
    const delta = { x: 0.1, y: 0.1 };
    const movedRect = moveShape(rect, delta);
    assert(Math.abs(movedRect.x - 0.2) < 0.0001 && Math.abs(movedRect.y - 0.2) < 0.0001, "Rect should move by delta");

    const movedPencil = moveShape(pencil, delta);
    assert(Math.abs(movedPencil.points[0].x - 0.2) < 0.0001, "Pencil point 0 should move");
    assert(Math.abs(movedPencil.points[1].x - 0.3) < 0.0001, "Pencil point 1 should move");

    console.log(`\nTests Completed: ${passed} Passed, ${failed} Failed`);
    if (failed > 0) process.exit(1);
};

runTests();
