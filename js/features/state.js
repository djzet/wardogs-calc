window.AppStorage = (function (utils) {
    const STATE_KEY = 'wardogs_mortar_state';
    const WEAPON_KEY = 'wardogs_weapon';
    const THEME_KEY = 'wardogs_theme';
    const TOWERS_KEY = 'wardogs_towers';
    const MAP_KEY = 'wardogs_map';
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
    function saveMap(mapId) {
        localStorage.setItem(MAP_KEY, mapId);
    }
    function loadMap(defaultMap) {
        return localStorage.getItem(MAP_KEY) || defaultMap;
    }
    return {
        saveState, loadState,
        saveWeapon, loadWeapon,
        saveTheme, loadTheme,
        saveTowers, loadTowers,
        saveMap, loadMap
    };
})(window.AppUtils);
window.AppPoints = (function (utils) {
    let pointA = null;
    let pointB = null;
    let mapSize = 16000;
    let coordScale = 100;
    let onChange = null;
    function configure(opts) {
        mapSize = opts.mapSize;
        coordScale = opts.coordScale || 100;
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
    function readPoint(ix, iy, existingPoint) {
        const rawX = String(ix.value).replace(',', '.');
        const rawY = String(iy.value).replace(',', '.');
        const hasX = rawX !== '';
        const hasY = rawY !== '';
        if (!hasX && !hasY) return null;
        const maxGame = mapSize / coordScale;
        let gx, gy;
        if (hasX) {
            gx = parseFloat(rawX);
            if (isNaN(gx)) return null;
        } else {
            gx = existingPoint ? existingPoint.x / coordScale : NaN;
            if (isNaN(gx)) return null;
        }
        if (hasY) {
            gy = parseFloat(rawY);
            if (isNaN(gy)) return null;
        } else {
            gy = existingPoint ? existingPoint.y / coordScale : NaN;
            if (isNaN(gy)) return null;
        }
        return {
            x: utils.clamp(gx, 0, maxGame) * coordScale,
            y: utils.clamp(gy, 0, maxGame) * coordScale
        };
    }
    function pointEq(a, b) {
        if (a === b) return true;
        if (!a || !b) return false;
        return a.x === b.x && a.y === b.y;
    }
    function applyFromInputs(ax, ay, bx, by) {
        const newA = readPoint(ax, ay, pointA);
        const newB = readPoint(bx, by, pointB);
        if (pointEq(pointA, newA) && pointEq(pointB, newB)) return;
        pointA = newA;
        pointB = newB;
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
window.AppWeapons = (function (storage) {
    let currentWeapon = null;
    function init(defaultWeapon, onChange) {
        currentWeapon = storage.loadWeapon(defaultWeapon);
        if (!['mortar', 'artillery'].includes(currentWeapon)) {
            currentWeapon = defaultWeapon;
            storage.saveWeapon(currentWeapon);
        }
        bind(onChange);
    }
    function get() { return currentWeapon; }
    function set(w) {
        if (!['mortar', 'artillery'].includes(w)) return;
        currentWeapon = w;
        storage.saveWeapon(w);
        document.querySelectorAll('input[name="weapon"]').forEach(r => {
            r.checked = r.value === w;
        });
    }
    let _boundOnChange = null;
    function bind(onChange) {
        if (_boundOnChange) {
            document.querySelectorAll('input[name="weapon"]').forEach(radio => {
                radio.removeEventListener('change', _boundOnChange);
            });
        }
        _boundOnChange = (e) => {
            currentWeapon = e.target.value;
            storage.saveWeapon(currentWeapon);
            if (onChange) onChange();
        };
        const radios = document.querySelectorAll('input[name="weapon"]');
        radios.forEach(radio => {
            if (radio.value === currentWeapon) radio.checked = true;
            radio.addEventListener('change', _boundOnChange);
        });
    }
    return { init, get, set };
})(window.AppStorage);
window.AppShare = (function (utils) {
    let toastTimer = null;
    function generateUrl(pointA, pointB, currentWeapon, mapSize, mapId) {
        const params = new URLSearchParams();
        if (pointA) {
            params.set('ax', utils.metersToPercent(pointA.x, mapSize).toFixed(2));
            params.set('ay', utils.metersToPercent(pointA.y, mapSize).toFixed(2));
        }
        if (pointB) {
            params.set('bx', utils.metersToPercent(pointB.x, mapSize).toFixed(2));
            params.set('by', utils.metersToPercent(pointB.y, mapSize).toFixed(2));
        }
        params.set('w', currentWeapon);
        if (mapId) params.set('map', mapId);
        return location.origin + location.pathname + '?' + params.toString();
    }
    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (e) {
            const input = document.createElement('input');
            input.value = text;
            input.style.position = 'fixed';
            input.style.opacity = '0';
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            return true;
        }
    }
    function showToast(message, type = 'success') {
        let toast = document.getElementById('toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            toast.className = 'toast';
            const wrap = document.querySelector('.map-wrap') || document.body;
            wrap.appendChild(toast);
        }
        toast.textContent = message;
        toast.className = 'toast ' + type;
        void toast.offsetWidth;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toast.classList.remove('show');
        }, 2500);
    }
    function parseSharedParams(mapSize, knownMaps) {
        const params = new URLSearchParams(location.search);
        const result = { applied: false, pointA: null, pointB: null, weapon: null, mapId: null };
        if (params.has('map') && knownMaps && knownMaps[params.get('map')]) {
            result.mapId = params.get('map');
            result.applied = true;
        }
        if (params.has('ax') && params.has('ay')) {
            const ax = parseFloat(params.get('ax'));
            const ay = parseFloat(params.get('ay'));
            if (!isNaN(ax) && !isNaN(ay)) {
                result.pointA = {
                    x: utils.percentToMeters(utils.clamp(ax, 0, 100), mapSize),
                    y: utils.percentToMeters(utils.clamp(ay, 0, 100), mapSize)
                };
                result.applied = true;
            }
        }
        if (params.has('bx') && params.has('by')) {
            const bx = parseFloat(params.get('bx'));
            const by = parseFloat(params.get('by'));
            if (!isNaN(bx) && !isNaN(by)) {
                result.pointB = {
                    x: utils.percentToMeters(utils.clamp(bx, 0, 100), mapSize),
                    y: utils.percentToMeters(utils.clamp(by, 0, 100), mapSize)
                };
                result.applied = true;
            }
        }
        if (params.has('w')) {
            const w = params.get('w');
            if (w === 'mortar' || w === 'artillery') {
                result.weapon = w;
                result.applied = true;
            }
        }
        return result;
    }
    return {
        generateUrl,
        copyToClipboard,
        showToast,
        parseSharedParams
    };
})(window.AppUtils);