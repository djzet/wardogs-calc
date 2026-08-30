// js/core/utils.js — Чистые утилиты

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
        const n = Math.round(num);
        const s = String(Math.abs(n));
        const formatted = s.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
        return n < 0 ? '-' + formatted : formatted;
    }
    function fmtCoord(meters, step, str) {
        if (step >= 1000) {
            const km = meters / 1000;
            const v = Number.isInteger(km) ? String(km) : km.toFixed(1);
            return v + NBSP + (str?.u_km || 'km');
        }
        return Math.round(meters) + NBSP + (str?.u_m || 'm');
    }
    function fmtDist(d, str) {
        return fmtWithNbsp(d) + NBSP + (str?.u_m || 'm');
    }
    function gameCoord(meters) {
        return (meters / 100).toFixed(2).replaceAll('-0.00', '0.00');
    }
    /** Путь относительно base (Vite: './' или '/wardogs-calc/') */
    function assetUrl(path) {
        const base = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || './';
        const rel = String(path).replace(/^\//, '');
        // './' + 'maps/...' → './maps/...' ; '/wardogs-calc/' + ... → абсолютный от корня сайта
        return base.endsWith('/') ? base + rel : base + '/' + rel;
    }
    return {
        NBSP,
        clamp,
        percentToMeters,
        metersToPercent,
        worldToScreen,
        screenToWorld,
        fmtWithNbsp,
        fmtCoord,
        fmtDist,
        gameCoord,
        assetUrl
    };
})();