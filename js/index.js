'use strict';

// Конфиги
const CONFIG = window.CONFIG_APP;
const WEAPONS = window.CONFIG_WEAPONS.weapons;
const MAP = CONFIG.map;
const ZONE = CONFIG.zone;
const TOWERS = CONFIG.towers;
const TILES = CONFIG.tiles;
const TILE_CACHE_MAX = CONFIG.tiles.cacheMax;
const INPUT_DEBOUNCE_MS = CONFIG.timing.inputDebounceMs;
const TAP_THRESHOLD = CONFIG.timing.tapThreshold;
const LONG_PRESS_MS = CONFIG.timing.longPressMs;

const { clamp, percentToMeters, metersToPercent, formatPercent,
    worldToScreen, screenToWorld, fmtCoord, fmtDist, NBSP } = window.AppUtils;

const STR = new Proxy({}, {
    get(target, prop) {
        return window.LocaleManager ? window.LocaleManager.t(prop) : prop;
    }
});

window.I18N = {};

// DOM
const canvas = document.getElementById('map');
const ctx = canvas.getContext('2d');
const langSelect = document.getElementById('langSelect');

const inputs = {
    ax: document.getElementById('ax'),
    ay: document.getElementById('ay'),
    bx: document.getElementById('bx'),
    by: document.getElementById('by'),
};

const out = {
    dist: document.getElementById('dist'),
    az: document.getElementById('azimuth'),
    el: document.getElementById('elevation'),
    time: document.getElementById('flightTime'),
};

// Состояние
let selectedTower = null;
let currentWeapon = AppStorage.loadWeapon(CONFIG.defaultWeapon);
const view = { scale: 0.05, ox: 0, oy: 0 };

const towerIcon = new Image();
towerIcon.src = 'assets/icons/tower.webp';
towerIcon.onload = () => renderMap();

MapTiles.configure(TILE_CACHE_MAX);

// Координация: при изменении точек — обновить UI, пересчитать, перерисовать, сохранить
function onPointsChanged() {
    UIInputs.sync();
    recalc();
    renderMap();
    AppStorage.saveState(AppPoints.getA(), AppPoints.getB(), view, MAP.size);
}

AppPoints.configure({ mapSize: MAP.size, onChange: onPointsChanged });

function renderMap() {
    MapRenderer.draw(ctx, canvas, {
        view, MAP, ZONE, TOWERS,
        WEAPONS, currentWeapon,
        pointA: AppPoints.getA(),
        pointB: AppPoints.getB(),
        theme: UIPanels.getTheme(),
        showTowers: UIPanels.getShowTowers(),
        selectedTower,
        STR, towerIcon, TILES,
        onTileLoaded: renderMap
    });
}

let saveViewTimer = null;
function debouncedSaveView() {
    clearTimeout(saveViewTimer);
    saveViewTimer = setTimeout(() => {
        AppStorage.saveState(AppPoints.getA(), AppPoints.getB(), view, MAP.size);
    }, 200);
}

function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderMap();
}
window.addEventListener('resize', resize);

function resetView() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    view.scale = Math.min(w, h) / MAP.size * 0.9;
    view.ox = w / 2 - (MAP.size / 2) * view.scale;
    view.oy = h / 2 + (MAP.size / 2) * view.scale;
    renderMap();
    debouncedSaveView();
}
document.getElementById('resetView').onclick = resetView;

function findTowerAt(sx, sy) {
    if (!UIPanels.getShowTowers()) return null;
    const halfSize = MapRenderer.getTowerIconSize(view.scale) / 2;
    for (const p of TOWERS) {
        const s = worldToScreen(percentToMeters(p.x, MAP.size), percentToMeters(p.y, MAP.size), view);
        if (Math.abs(s.x - sx) <= halfSize && Math.abs(s.y - sy) <= halfSize) {
            return p;
        }
    }
    return null;
}

function recalc() {
    out.el.classList.remove('oor', 'warn');
    out.dist.classList.remove('oor', 'warn');

    const weapon = WEAPONS[currentWeapon];
    const result = AppCalculator.calculate(AppPoints.getA(), AppPoints.getB(), weapon);

    if (result.status === 'noPoints') {
        out.dist.textContent = out.az.textContent = out.el.textContent = out.time.textContent = '—';
        return;
    }

    out.dist.textContent = fmtDist(result.dist, STR);
    out.az.textContent = result.azimuth.toFixed(1) + '°';

    switch (result.status) {
        case 'coincide':
            out.el.textContent = STR.zero;
            out.el.classList.add('warn');
            out.time.textContent = '—';
            break;
        case 'tooClose':
            out.el.textContent = STR.tooClose || 'слишком близко';
            out.el.classList.add('warn');
            out.time.textContent = '—';
            break;
        case 'outOfRange':
        case 'noSolution':
            out.el.textContent = STR.oor;
            out.el.classList.add('oor');
            out.time.textContent = '—';
            break;
        case 'ok':
            out.el.textContent = result.mils + NBSP + STR.u_mil;
            out.time.textContent = (result.flightTime !== null
                ? result.flightTime.toFixed(1)
                : '—') + NBSP + STR.u_s;
            break;
    }
}

// Инициализация UI-модулей
UIPanels.init({ onChange: () => {
    if (!UIPanels.getShowTowers()) selectedTower = null;
    renderMap();
}});

UIInputs.init({ inputs, debounceMs: INPUT_DEBOUNCE_MS, mapSize: MAP.size });

UIContextMenu.init({
    getView: () => view,
    hitPoint: (sx, sy) => AppPoints.hitPoint(sx, sy, view),
    setPoint: (k, x, y) => AppPoints.setPoint(k, x, y),
    getWrapRect: () => canvas.parentElement.getBoundingClientRect()
});

AppAnalytics.init();

document.getElementById('clearA').onclick = () => AppPoints.setPoint('A', null);
document.getElementById('clearB').onclick = () => AppPoints.setPoint('B', null);

// Map interactions
canvas.addEventListener('pointerdown', e => {
    MapInteractions.handlePointerDown(e, canvas, {
        view,
        hitPoint: (sx, sy) => AppPoints.hitPoint(sx, sy, view),
        findTowerAt,
        openMenuAt: (sx, sy) => UIContextMenu.openMenuAt(sx, sy),
        hideMenu: () => UIContextMenu.hideMenu(),
        LONG_PRESS_MS, utils: window.AppUtils
    });
});

window.addEventListener('pointermove', e => {
    MapInteractions.handlePointerMove(e, canvas, {
        view, renderMap, debouncedSaveView,
        hitPoint: (sx, sy) => AppPoints.hitPoint(sx, sy, view),
        findTowerAt,
        setPoint: (k, x, y) => AppPoints.setPoint(k, x, y),
        utils: window.AppUtils, TAP_THRESHOLD, MAP
    });
});

function onPointerUp(e) {
    MapInteractions.handlePointerUp(e, canvas, {
        view, renderMap, findTowerAt, selectedTower,
        setSelectedTower: t => { selectedTower = t; }
    });
}
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('pointercancel', onPointerUp);

window.addEventListener('blur', () => MapInteractions.handleBlur(canvas));

canvas.addEventListener('wheel', e => {
    MapInteractions.handleWheel(e, canvas, {
        view, renderMap, debouncedSaveView, utils: window.AppUtils
    });
}, { passive: false });

canvas.addEventListener('contextmenu', e => {
    MapInteractions.handleContextMenu(e, canvas, {
        openMenuAt: (sx, sy) => UIContextMenu.openMenuAt(sx, sy)
    });
});

window.addEventListener('pointerdown', e => {
    const menu = document.getElementById('ctxMenu');
    if (!menu.contains(e.target)) UIContextMenu.hideMenu();
});

window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        UIContextMenu.hideMenu();
        UIPanels.openHelp(false);
    }
});

// Share
async function copyShareLink() {
    const url = AppShare.generateUrl(AppPoints.getA(), AppPoints.getB(), currentWeapon, MAP.size);
    await AppShare.copyToClipboard(url);
    AppShare.showToast(STR.shareCopied, 'success');
}

function applySharedParams() {
    const parsed = AppShare.parseSharedParams(MAP.size);
    if (!parsed.applied) return;

    const newA = parsed.pointA || AppPoints.getA();
    const newB = parsed.pointB || AppPoints.getB();
    AppPoints.assign(newA, newB);

    if (parsed.weapon) {
        currentWeapon = parsed.weapon;
        AppStorage.saveWeapon(currentWeapon);
        document.querySelectorAll('input[name="weapon"]').forEach(r => {
            r.checked = r.value === currentWeapon;
        });
    }

    UIInputs.sync();
    recalc();
    renderMap();
    AppStorage.saveState(AppPoints.getA(), AppPoints.getB(), view, MAP.size);
    setTimeout(() => AppShare.showToast(STR.shareApplied, 'success'), 400);
    history.replaceState({}, '', location.pathname);
}

document.getElementById('shareBtn').addEventListener('click', copyShareLink);

// Weapon selection
const weaponRadios = document.querySelectorAll('input[name="weapon"]');
weaponRadios.forEach(radio => {
    if (radio.value === currentWeapon) radio.checked = true;
    radio.addEventListener('change', (e) => {
        currentWeapon = e.target.value;
        AppStorage.saveWeapon(currentWeapon);
        recalc();
        renderMap();
    });
});

// Initialization
resize();
const loadedState = AppStorage.loadState(MAP.size);
const loaded = !!loadedState;
if (loaded) {
    AppPoints.assign(loadedState.pointA, loadedState.pointB);
    if (loadedState.view) {
        view.scale = loadedState.view.scale;
        view.ox = loadedState.view.ox;
        view.oy = loadedState.view.oy;
    }
    UIInputs.sync();
}
applySharedParams();
if (!loaded) resetView();
renderMap();