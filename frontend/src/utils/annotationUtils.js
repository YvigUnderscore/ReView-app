export const isPointInShape = (point, shape, canvasSize) => {
    // point is { x: normalized, y: normalized }
    // shape has normalized coords
    // canvasSize is { width, height } for aspect ratio adjustments (though we work in normalized mostly)

    if (!shape) return false;

    // Helper: Distance between two points
    const dist = (p1, p2) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));

    // Helper: Distance from point p to line segment v-w
    const distToSegment = (p, v, w) => {
        const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
        if (l2 === 0) return dist(p, v);
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        return dist(p, { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) });
    };

    // Hit threshold logic:
    // We want the hit radius to be roughly constant in *screen pixels* (e.g. 15px),
    // but our coordinates are normalized (0-1).
    // The canvasSize passed here should be the *displayed* size (getBoundingClientRect),
    // NOT the internal resolution (width/height attributes), to ensure UX consistency.

    // Default to a safe fallback if canvasSize is missing or zero
    const w = canvasSize?.width || 1000;
    const h = canvasSize?.height || 1000;

    const hitRadiusX = 15 / w;
    const hitRadiusY = 15 / h;

    // Use the max dimension to avoid being too strict on very wide/tall aspects
    const threshold = Math.max(hitRadiusX, hitRadiusY);

    if (shape.tool === 'pencil' || shape.tool === 'highlighter' || shape.tool === 'eraser') {
        if (!shape.points || shape.points.length < 2) return false;
        for (let i = 0; i < shape.points.length - 1; i++) {
            if (distToSegment(point, shape.points[i], shape.points[i+1]) < threshold) {
                return true;
            }
        }
        return false;
    } else if (shape.tool === 'rect') {
        // Normalize rect coords
        const x = shape.w < 0 ? shape.x + shape.w : shape.x;
        const y = shape.h < 0 ? shape.y + shape.h : shape.y;
        const w = Math.abs(shape.w);
        const h = Math.abs(shape.h);

        return point.x >= x && point.x <= x + w && point.y >= y && point.y <= y + h;

    } else if (shape.tool === 'circle') {
        const cx = shape.x + shape.w / 2;
        const cy = shape.y + shape.h / 2;
        const rx = Math.abs(shape.w / 2);
        const ry = Math.abs(shape.h / 2);

        // Check ellipse equation
        const val = Math.pow(point.x - cx, 2) / Math.pow(rx, 2) + Math.pow(point.y - cy, 2) / Math.pow(ry, 2);
        return val <= 1.1;

    } else if (shape.tool === 'line' || shape.tool === 'arrow') {
        const p1 = { x: shape.x, y: shape.y };
        const p2 = { x: shape.x + shape.w, y: shape.y + shape.h };
        return distToSegment(point, p1, p2) < threshold;

    } else if (shape.tool === 'text') {
        // Approximate text box hit area
        const estimatedHeight = 0.05;
        const estimatedWidth = (shape.text?.length || 5) * (estimatedHeight * 0.6);

        return point.x >= shape.x && point.x <= shape.x + estimatedWidth &&
               point.y >= shape.y - estimatedHeight && point.y <= shape.y + estimatedHeight;

    } else if (shape.tool === 'curve') {
        const p0 = { x: shape.x, y: shape.y };
        const p2 = { x: shape.x + shape.w, y: shape.y + shape.h };
        const midX = (p0.x + p2.x) / 2;
        const midY = (p0.y + p2.y) / 2;
        const cp = {
            x: midX,
            y: midY - Math.abs(shape.w) * 0.5
        };

        for (let t = 0; t <= 1; t += 0.1) {
            const x = (1-t)*(1-t)*p0.x + 2*(1-t)*t*cp.x + t*t*p2.x;
            const y = (1-t)*(1-t)*p0.y + 2*(1-t)*t*cp.y + t*t*p2.y;
            if (dist(point, {x, y}) < threshold) return true;
        }
        return false;
    }

    return false;
};

export const moveShape = (shape, delta) => {
    // delta is { x: normalizedDeltaX, y: normalizedDeltaY }
    const newShape = { ...shape };

    if (shape.points) {
        newShape.points = shape.points.map(p => ({
            x: p.x + delta.x,
            y: p.y + delta.y
        }));
    } else {
        newShape.x += delta.x;
        newShape.y += delta.y;
    }

    return newShape;
};
