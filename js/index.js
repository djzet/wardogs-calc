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

// DOM элементы
const canvas = document.getElementById('map');
const ctx = canvas.getContext('2d');
const menu = document.getElementById('ctxMenu');
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
let showTowers = AppStorage.loadTowers();
let selectedTower = null;
let currentWeapon = AppStorage.loadWeapon(CONFIG.defaultWeapon);
let theme = AppStorage.loadTheme(CONFIG.defaultTheme);

const view = { scale: 0.05, ox: 0, oy: 0 };
let pointA = null;
let pointB = null;
let menuWorld = null;
let menuPointKey = null;
let inputTimer = null;

const towerIcon = new Image();
towerIcon.src = 'assets/icons/tower.webp';
towerIcon.onload = () => renderMap();

MapTiles.configure(TILE_CACHE_MAX);

function renderMap() {
    MapRenderer.draw(ctx, canvas, {
        view, MAP, ZONE, TOWERS,
        WEAPONS, currentWeapon,
        pointA, pointB,
        theme, showTowers, selectedTower,
        STR, towerIcon, TILES,
        onTileLoaded: renderMap
    });
}

let saveViewTimer = null;
function debouncedSaveView() {
    clearTimeout(saveViewTimer);
    saveViewTimer = setTimeout(() => {
        AppStorage.saveState(pointA, pointB, view, MAP.size);
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

// Drawer
const drawer = document.getElementById('drawer');
const drawerBackdrop = document.getElementById('drawerBackdrop');

function openDrawer(state) {
    drawer.classList.toggle('open', state);
    drawerBackdrop.classList.toggle('hidden', !state);
}
document.getElementById('drawerToggle').onclick = () => openDrawer(true);
document.getElementById('drawerClose').onclick = () => openDrawer(false);
drawerBackdrop.onclick = () => openDrawer(false);

// Help modal
const helpModal = document.getElementById('helpModal');

function openHelp(state) {
    helpModal.classList.toggle('hidden', !state);
}
document.getElementById('helpToggle').onclick = () => openHelp(true);
document.getElementById('helpClose').onclick = () => openHelp(false);
helpModal.addEventListener('mousedown', e => {
    if (e.target === helpModal) openHelp(false);
});

// Toggles
const towersToggle = document.getElementById('towersToggle');
towersToggle.checked = showTowers;
towersToggle.addEventListener('change', () => {
    showTowers = towersToggle.checked;
    AppStorage.saveTowers(showTowers);
    if (!showTowers) selectedTower = null;
    renderMap();
});

const themeToggle = document.getElementById('themeToggle');
function applyTheme() {
    document.body.classList.toggle('light', theme === 'light');
    renderMap();
}
themeToggle.onclick = () => {
    theme = (theme === 'dark') ? 'light' : 'dark';
    AppStorage.saveTheme(theme);
    applyTheme();
};

// Hit detection
function hitPoint(sx, sy) {
    for (const [key, p] of [['A', pointA], ['B', pointB]]) {
        if (!p) continue;
        const s = worldToScreen(p.x, p.y, view);
        if (Math.hypot(s.x - sx, s.y - sy) <= 12) return key;
    }
    return null;
}

function findTowerAt(sx, sy) {
    if (!showTowers) return null;
    const halfSize = MapRenderer.getTowerIconSize(view.scale) / 2;
    for (const p of TOWERS) {
        const s = worldToScreen(percentToMeters(p.x, MAP.size), percentToMeters(p.y, MAP.size), view);
        if (Math.abs(s.x - sx) <= halfSize && Math.abs(s.y - sy) <= halfSize) {
            return p;
        }
    }
    return null;
}

// Points management
function setPoint(key, x, y) {
    let p = null;
    if (x != null && y != null) {
        p = {
            x: clamp(x, 0, MAP.size),
            y: clamp(y, 0, MAP.size)
        };
    }
    if (key === 'A') pointA = p; else pointB = p;
    syncInputs(); recalc(); renderMap();
    AppStorage.saveState(pointA, pointB, view, MAP.size);
}

function syncInputs() {
    if (pointA) {
        inputs.ax.value = formatPercent(metersToPercent(pointA.x, MAP.size));
        inputs.ay.value = formatPercent(metersToPercent(pointA.y, MAP.size));
    } else {
        inputs.ax.value = ''; inputs.ay.value = '';
    }
    if (pointB) {
        inputs.bx.value = formatPercent(metersToPercent(pointB.x, MAP.size));
        inputs.by.value = formatPercent(metersToPercent(pointB.y, MAP.size));
    } else {
        inputs.bx.value = ''; inputs.by.value = '';
    }
}

function readPoint(ix, iy) {
    const px = parseFloat(ix.value), py = parseFloat(iy.value);
    if (isNaN(px) || isNaN(py)) return null;
    return {
        x: percentToMeters(clamp(px, 0, 100), MAP.size),
        y: percentToMeters(clamp(py, 0, 100), MAP.size)
    };
}

function onInputImmediate() {
    pointA = readPoint(inputs.ax, inputs.ay);
    pointB = readPoint(inputs.bx, inputs.by);
    recalc(); renderMap();
    AppStorage.saveState(pointA, pointB, view, MAP.size);
}

function onInput() {
    clearTimeout(inputTimer);
    inputTimer = setTimeout(onInputImmediate, INPUT_DEBOUNCE_MS);
}

Object.values(inputs).forEach(i => i.addEventListener('input', onInput));
Object.values(inputs).forEach(i => i.addEventListener('blur', () => {
    clearTimeout(inputTimer);
    onInputImmediate();
}));

document.getElementById('clearA').onclick = () => setPoint('A', null);
document.getElementById('clearB').onclick = () => setPoint('B', null);

// Calculations
function recalc() {
    out.el.classList.remove('oor', 'warn');
    out.dist.classList.remove('oor', 'warn');

    const weapon = WEAPONS[currentWeapon];
    const result = AppCalculator.calculate(pointA, pointB, weapon);

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

// Context menu
function openMenuAt(sx, sy) {
    menuWorld = screenToWorld(sx, sy, view);
    menuPointKey = hitPoint(sx, sy);
    document.getElementById('menuDelete').classList.toggle('hidden', !menuPointKey);
    menu.classList.remove('hidden');
    const wrap = canvas.parentElement.getBoundingClientRect();
    let left = sx, top = sy;
    if (left + menu.offsetWidth > wrap.width) left -= menu.offsetWidth;
    if (top + menu.offsetHeight > wrap.height) top -= menu.offsetHeight;
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
}

function hideMenu() { menu.classList.add('hidden'); }

menu.addEventListener('click', e => {
    const action = e.target.dataset.action;
    if (!action) return;
    if (action === 'setA') setPoint('A', menuWorld.x, menuWorld.y);
    if (action === 'setB') setPoint('B', menuWorld.x, menuWorld.y);
    if (action === 'delete') setPoint(menuPointKey, null);
    hideMenu();
});

window.addEventListener('pointerdown', e => { if (!menu.contains(e.target)) hideMenu(); });
window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        hideMenu();
        openHelp(false);
    }
});

// Map interactions setup
function setSelectedTower(tower) {
    selectedTower = tower;
}

canvas.addEventListener('pointerdown', e => {
    MapInteractions.handlePointerDown(e, canvas, {
        view, hitPoint, findTowerAt, openMenuAt, hideMenu,
        LONG_PRESS_MS, utils: window.AppUtils
    });
});

window.addEventListener('pointermove', e => {
    MapInteractions.handlePointerMove(e, canvas, {
        view, renderMap, debouncedSaveView, hitPoint, findTowerAt, setPoint,
        utils: window.AppUtils, TAP_THRESHOLD, MAP
    });
});

window.addEventListener('pointerup', e => {
    MapInteractions.handlePointerUp(e, canvas, {
        view, renderMap, findTowerAt, selectedTower, setSelectedTower
    });
});

window.addEventListener('pointercancel', e => {
    MapInteractions.handlePointerUp(e, canvas, {
        view, renderMap, findTowerAt, selectedTower, setSelectedTower
    });
});

window.addEventListener('blur', () => {
    MapInteractions.handleBlur(canvas);
});

canvas.addEventListener('wheel', e => {
    MapInteractions.handleWheel(e, canvas, {
        view, renderMap, debouncedSaveView, utils: window.AppUtils
    });
}, { passive: false });

canvas.addEventListener('contextmenu', e => {
    MapInteractions.handleContextMenu(e, canvas, { openMenuAt });
});

// Discord tracking
function sendDiscordEvent(source) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
        event: 'select_promotion',
        ecommerce: {
            creative_name: source,
            creative_slot: 'panel',
            promotion_id: 'discord_invite',
        },
    });
    if (typeof ym === 'function') ym(111625912, 'reachGoal', 'discord_qr_click');
}

document.getElementById('discordQr').addEventListener('click', () => {
    sendDiscordEvent('Discord QR');
});

document.getElementById('discordBtn').addEventListener('click', () => {
    sendDiscordEvent('Discord Button');
});

// Share
async function copyShareLink() {
    const url = AppShare.generateUrl(pointA, pointB, currentWeapon, MAP.size);
    await AppShare.copyToClipboard(url);
    AppShare.showToast(STR.shareCopied, 'success');
}

function applySharedParams() {
    const parsed = AppShare.parseSharedParams(MAP.size);
    if (!parsed.applied) return;

    if (parsed.pointA) pointA = parsed.pointA;
    if (parsed.pointB) pointB = parsed.pointB;
    if (parsed.weapon) {
        currentWeapon = parsed.weapon;
        AppStorage.saveWeapon(currentWeapon);
        document.querySelectorAll('input[name="weapon"]').forEach(r => {
            r.checked = r.value === currentWeapon;
        });
    }

    syncInputs();
    recalc();
    renderMap();
    AppStorage.saveState(pointA, pointB, view, MAP.size);
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
    pointA = loadedState.pointA;
    pointB = loadedState.pointB;
    if (loadedState.view) {
        view.scale = loadedState.view.scale;
        view.ox = loadedState.view.ox;
        view.oy = loadedState.view.oy;
    }
    syncInputs();
}
applySharedParams();
if (!loaded) resetView();
renderMap();
applyTheme();