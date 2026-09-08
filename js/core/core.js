window.AppUtils = (function () {
    const NBSP = '\u00A0';
    function clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
    }

    function gameToMeters(gameCoord, coordScale) {
        return gameCoord * (coordScale || 100);
    }

    function metersToGame(meters, coordScale) {
        return meters / (coordScale || 100);
    }

    function percentToWorld(percent, worldSize) {
        return (percent * worldSize) / 100;
    }

    function worldToPercent(worldCoord, worldSize) {
        return (worldCoord * 100) / worldSize;
    }
    function gameToScreen(gameX, gameY, view, _coordScale) {
        return {
            x: gameX * view.scale + view.ox,
            y: -(gameY * view.scale) + view.oy
        };
    }
    function screenToGame(screenX, screenY, view, _coordScale) {
        return {
            x: (screenX - view.ox) / view.scale,
            y: (view.oy - screenY) / view.scale
        };
    }
    function worldToScreen(wx, wy, view) {
        return {
            x: wx * view.scale + view.ox,
            y: -(wy * view.scale) + view.oy
        };
    }
    function screenToWorld(sx, sy, view) {
        return {
            x: (sx - view.ox) / view.scale,
            y: (view.oy - sy) / view.scale
        };
    }
    function fmtWithNbsp(num) {
        const n = Math.round(num);
        const s = String(Math.abs(n));
        const formatted = s.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
        return n < 0 ? '-' + formatted : formatted;
    }
    function fmtCoord(value, coordScale) {
        const precision = (coordScale || 100) === 100 ? 2 : 0;
        return Number(value).toFixed(precision);
    }
    function fmtDist(meters, str) {
        if (meters >= 1000) {
            const km = meters / 1000;
            const v = Number.isInteger(km) ? String(km) : km.toFixed(1);
            return v + NBSP + (str?.u_km || 'km');
        }
        return fmtWithNbsp(meters) + NBSP + (str?.u_m || 'm');
    }
    function gameCoord(meters, coordScale) {
        const v = Object.is(meters, -0) ? 0 : meters;
        return (v / (coordScale || 100)).toFixed(2);
    }
    function assetUrl(path) {
        const base = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || './';
        const rel = String(path).replace(/^\//, '');
        return base.endsWith('/') ? base + rel : base + '/' + rel;
    }
    function isValidBounds(bounds) {
        return Boolean(
            bounds &&
            typeof bounds.minX === 'number' &&
            typeof bounds.maxX === 'number' &&
            typeof bounds.minY === 'number' &&
            typeof bounds.maxY === 'number' &&
            bounds.maxX > bounds.minX &&
            bounds.maxY > bounds.minY
        );
    }
    return {
        NBSP,
        clamp,
        gameToMeters,
        metersToGame,
        percentToWorld,
        worldToPercent,
        gameToScreen,
        screenToGame,
        worldToScreen,
        screenToWorld,
        fmtWithNbsp,
        fmtCoord,
        fmtDist,
        gameCoord,
        assetUrl,
        isValidBounds
    };
})();
window.AppCalculator = (function () {
    function distToMils(distMeters, table) {
        if (!table || table.length === 0) return null;
        if (distMeters > table[0].dist) return null;
        if (distMeters < table[table.length - 1].dist) return null;
        let lo = 0;
        let hi = table.length - 1;
        while (lo < hi - 1) {
            const mid = (lo + hi) >> 1;
            if (distMeters >= table[mid].dist) {
                hi = mid;
            } else {
                lo = mid;
            }
        }
        const p1 = table[lo];
        const p2 = table[hi];
        const range = p1.dist - p2.dist;
        const t = range > 0 ? (p1.dist - distMeters) / range : 0;
        return p1.mils + t * (p2.mils - p1.mils);
    }
    function calculate(pointA, pointB, weapon, coordScale) {
        if (!pointA || !pointB) {
            return { status: 'noPoints' };
        }
        const cs = coordScale || 100;

        const dx = (pointB.x - pointA.x) * cs;
        const dy = (pointB.y - pointA.y) * cs;
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
})();
