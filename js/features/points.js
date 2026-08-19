// js/features/points.js — Владение точками A/B

window.AppPoints = (function(utils) {
    let pointA = null;
    let pointB = null;
    let mapSize = 16000;
    let onChange = null;

    function configure(opts) {
        mapSize = opts.mapSize;
        onChange = opts.onChange || null;
    }

    function emit() { if (onChange) onChange(); }

    function getA() { return pointA; }
    function getB() { return pointB; }

    function setPoint(key, x, y) {
        let p = null;
        if (x != null && y != null) {
            p = { x: utils.clamp(x, 0, mapSize), y: utils.clamp(y, 0, mapSize) };
        }
        if (key === 'A') pointA = p; else pointB = p;
        emit();
    }

    function assign(a, b) {
        pointA = a;
        pointB = b;
    }

    function readPoint(ix, iy) {
        const px = parseFloat(ix.value), py = parseFloat(iy.value);
        if (isNaN(px) || isNaN(py)) return null;
        return {
            x: utils.percentToMeters(utils.clamp(px, 0, 100), mapSize),
            y: utils.percentToMeters(utils.clamp(py, 0, 100), mapSize)
        };
    }

    function applyFromInputs(ax, ay, bx, by) {
        pointA = readPoint(ax, ay);
        pointB = readPoint(bx, by);
        emit();
    }

    function hitPoint(sx, sy, view) {
        for (const [key, p] of [['A', pointA], ['B', pointB]]) {
            if (!p) continue;
            const s = utils.worldToScreen(p.x, p.y, view);
            if (Math.hypot(s.x - sx, s.y - sy) <= 12) return key;
        }
        return null;
    }

    return { configure, getA, getB, setPoint, assign, applyFromInputs, hitPoint };
})(window.AppUtils);