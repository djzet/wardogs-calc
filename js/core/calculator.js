// js/core/calculator.js — Расчёты артиллерии

window.AppCalculator = (function (utils) {
    function distToMils(dist, table) {
        if (!table || table.length === 0) return null;
        if (dist > table[0].dist) return null;
        for (let i = 0; i < table.length - 1; i++) {
            const p1 = table[i];
            const p2 = table[i + 1];

            if (dist <= p1.dist && dist >= p2.dist) {
                const range = p1.dist - p2.dist;
                const t = range > 0 ? (p1.dist - dist) / range : 0;
                return p1.mils + t * (p2.mils - p1.mils);
            }
        }
        return null;
    }
    function calculate(pointA, pointB, weapon) {
        if (!pointA || !pointB) {
            return { status: 'noPoints' };
        }
        const dx = pointB.x - pointA.x;
        const dy = pointB.y - pointA.y;
        const dist = Math.hypot(dx, dy);
        const azimuth = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
        if (dist === 0) {
            return { status: 'coincide', dist, azimuth };
        }
        const minRange = (weapon.minRangeKm || 0) * 1000;
        if (dist < minRange) {
            return { status: 'tooClose', dist, azimuth };
        }
        const maxRange = (weapon.maxRangeKm || 0) * 1000;
        if (dist > maxRange) {
            return { status: 'outOfRange', dist, azimuth };
        }
        const { table, step } = weapon;
        const milsExact = distToMils(dist, table);
        if (milsExact === null) {
            return { status: 'noSolution', dist, azimuth };
        }
        const mils = Math.min(weapon.maxElevationMil, Math.round(milsExact / step) * step);
        if (mils < weapon.minElevationMil) {
            return { status: 'noSolution', dist, azimuth };
        }
        return {
            status: 'ok',
            dist,
            azimuth,
            mils
        };
    }
    return { distToMils, calculate };
})(window.AppUtils);