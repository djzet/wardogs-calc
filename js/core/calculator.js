// js/core/calculator.js — Расчёты артиллерии

window.AppCalculator = (function(utils) {
    /**
     * Конвертация дистанции в mils по таблице оружия
     */
    function distToMils(dist, table) {
        if (!table || table.length === 0) return null;
        if (dist > table[0].dist) return null;
        if (dist <= table[table.length - 1].dist) {
            return table[table.length - 1].mils;
        }

        for (let i = 0; i < table.length - 1; i++) {
            const p1 = table[i];
            const p2 = table[i + 1];

            if (dist <= p1.dist && dist >= p2.dist) {
                const range = p1.dist - p2.dist;
                const t = range > 0 ? (p1.dist - dist) / range : 0;
                return Math.round(p1.mils + t * (p2.mils - p1.mils));
            }
        }
        return null;
    }

    /**
     * Расчёт параметров выстрела
     * @returns {{ dist, azimuth, mils, flightTime, status }}
     *   status: 'ok' | 'noPoints' | 'coincide' | 'tooClose' | 'outOfRange' | 'noSolution'
     */
    function calculate(pointA, pointB, weapon) {
        if (!pointA || !pointB) {
            return { status: 'noPoints' };
        }

        const dx = pointB.x - pointA.x;
        const dy = pointB.y - pointA.y;
        const dist = Math.hypot(dx, dy);
        const azimuth = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;

        if (dist < 0.001) {
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

        const { table, step, v0 } = weapon;
        const milsExact = distToMils(dist, table);

        if (milsExact === null) {
            return { status: 'noSolution', dist, azimuth };
        }

        const isExactInTable = table.some(p => p.mils === milsExact);
        const mils = isExactInTable ? milsExact : Math.round(milsExact / step) * step;
        const theta = mils / 1000;
        const flightTime = dist / (v0 * Math.cos(theta));

        return {
            status: 'ok',
            dist,
            azimuth,
            mils,
            flightTime: isFinite(flightTime) ? flightTime : null
        };
    }

    return { distToMils, calculate };
})(window.AppUtils);