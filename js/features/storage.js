// js/features/storage.js — Сохранение состояния в localStorage

window.AppStorage = (function(utils) {
    const STATE_KEY = 'wardogs_mortar_state';
    const WEAPON_KEY = 'wardogs_weapon';
    const THEME_KEY = 'wardogs_theme';
    const TOWERS_KEY = 'wardogs_towers';
    function saveState(pointA, pointB, view, mapSize) {
        const state = {
            pointA: pointA ? {
                px: utils.metersToPercent(pointA.x, mapSize),
                py: utils.metersToPercent(pointA.y, mapSize)
            } : null,
            pointB: pointB ? {
                px: utils.metersToPercent(pointB.x, mapSize),
                py: utils.metersToPercent(pointB.y, mapSize)
            } : null,
            view: { scale: view.scale, ox: view.ox, oy: view.oy }
        };
        try {
            localStorage.setItem(STATE_KEY, JSON.stringify(state));
        } catch (e) {
            console.warn('Failed to save state:', e);
        }
    }
    function loadState(mapSize) {
        const saved = localStorage.getItem(STATE_KEY);
        if (!saved) return null;
        try {
            const state = JSON.parse(saved);
            const result = { view: null, pointA: null, pointB: null };

            if (state.pointA) {
                result.pointA = {
                    x: utils.percentToMeters(state.pointA.px, mapSize),
                    y: utils.percentToMeters(state.pointA.py, mapSize)
                };
            }
            if (state.pointB) {
                result.pointB = {
                    x: utils.percentToMeters(state.pointB.px, mapSize),
                    y: utils.percentToMeters(state.pointB.py, mapSize)
                };
            }
            if (state.view) {
                result.view = state.view;
            }
            return result;
        } catch (e) {
            console.warn('Failed to load state:', e);
            return null;
        }
    }
    function saveWeapon(weapon) {
        localStorage.setItem(WEAPON_KEY, weapon);
    }
    function loadWeapon(defaultWeapon) {
        return localStorage.getItem(WEAPON_KEY) || defaultWeapon;
    }
    function saveTheme(theme) {
        localStorage.setItem(THEME_KEY, theme);
    }
    function loadTheme(defaultTheme) {
        return localStorage.getItem(THEME_KEY) || defaultTheme;
    }
    function saveTowers(show) {
        localStorage.setItem(TOWERS_KEY, show ? '1' : '0');
    }
    function loadTowers() {
        return localStorage.getItem(TOWERS_KEY) !== '0';
    }
    return {
        saveState, loadState,
        saveWeapon, loadWeapon,
        saveTheme, loadTheme,
        saveTowers, loadTowers
    };
})(window.AppUtils);