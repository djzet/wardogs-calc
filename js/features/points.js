// js/features/points.js — Владение точками A/B

window.AppPoints = (function (utils) {
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
        const gx = parseFloat(ix.value), gy = parseFloat(iy.value);
        if (isNaN(gx) || isNaN(gy)) return null;
        const maxGame = mapSize / 100;
        return {
            x: utils.clamp(gx, 0, maxGame) * 100,
            y: utils.clamp(gy, 0, maxGame) * 100
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