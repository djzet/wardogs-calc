// js/core/utils.js — Чистые утилиты (без зависимостей)

window.AppUtils = (function () {
    const NBSP = '\u00A0';

    function clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
    }

    function percentToMeters(percent, mapSize) {
        return (percent * mapSize) / 100;
    }

    function metersToPercent(meters, mapSize) {
        return (meters * 100) / mapSize;
    }

    function formatPercent(v) {
        return v.toFixed(2);
    }

    function worldToScreen(wx, wy, view) {
        return {
            x: wx * view.scale + view.ox,
            y: -wy * view.scale + view.oy
        };
    }

    function screenToWorld(sx, sy, view) {
        return {
            x: (sx - view.ox) / view.scale,
            y: (view.oy - sy) / view.scale
        };
    }

    function fmtWithNbsp(num) {
        return String(Math.round(num)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
    }

    function fmtCoord(meters, step, str) {
        if (step >= 1000) {
            const km = meters / 1000;
            const v = Number.isInteger(km) ? String(km) : km.toFixed(1);
            return v + NBSP + str.u_km;
        }
        return Math.round(meters) + NBSP + str.u_m;
    }

    function fmtDist(d, str) {
        return fmtWithNbsp(d) + NBSP + str.u_m;
    }

    function gameCoord(meters) {
        // Игровые координаты: метры / 100 (как на скриншотах x23.30, y129.60)
        return (meters / 100).toFixed(2);
    }

    return {
        NBSP,
        clamp,
        percentToMeters,
        metersToPercent,
        formatPercent,
        worldToScreen,
        screenToWorld,
        fmtWithNbsp,
        fmtCoord,
        fmtDist,
        gameCoord
    };
})();