'use strict';

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

const { percentToMeters, worldToScreen } = window.AppUtils;

const STR = new Proxy({}, {
    get: (t, prop) => window.LocaleManager ? window.LocaleManager.t(prop) : prop
});
window.I18N = {};

function el(id) { return document.getElementById(id); }
const canvas = el('map');
const ctx = canvas.getContext('2d');
const inputs = { ax: el('ax'), ay: el('ay'), bx: el('bx'), by: el('by') };
const out = { dist: el('dist'), az: el('azimuth'), el: el('elevation'), time: el('flightTime') };

let selectedTower = null;
let view;

const towerIcon = new Image();
towerIcon.src = 'assets/icons/tower.webp';
towerIcon.onload = () => renderMap();

MapTiles.configure(TILE_CACHE_MAX);
AppDraw.configure(MAP.size);

function renderMap() {
    MapRenderer.draw(ctx, canvas, {
        view, MAP, ZONE, TOWERS, WEAPONS,
        currentWeapon: AppWeapons.get(),
        pointA: AppPoints.getA(), pointB: AppPoints.getB(),
        theme: UIPanels.getTheme(), showTowers: UIPanels.getShowTowers(),
        selectedTower, STR, towerIcon, TILES,
        onTileLoaded: renderMap
    });
}

function saveState() {
    AppStorage.saveState(AppPoints.getA(), AppPoints.getB(), view, MAP.size);
}

function onPointsChanged() {
    UIInputs.sync();
    UIResults.update();
    renderMap();
    saveState();

    if (AppLobby.isConnected()) {
        AppLobby.syncState({
            pointA: AppPoints.getA(),
            pointB: AppPoints.getB(),
            weapon: AppWeapons.get()
        });
    }
}

// Инициализация модулей
MapViewport.init({ canvas, renderMap, saveState, mapSize: MAP.size });
view = MapViewport.get();

AppPoints.configure({ mapSize: MAP.size, onChange: onPointsChanged });

UIResults.init({ out, getWeapons: () => WEAPONS, getCurrentWeapon: () => AppWeapons.get(), STR });

UIPanels.init({
    onChange: () => {
        if (!UIPanels.getShowTowers()) selectedTower = null;
        renderMap();
    },
    renderMap: renderMap,
    saveState: saveState  
});

UIInputs.init({ inputs, debounceMs: INPUT_DEBOUNCE_MS, mapSize: MAP.size });

UIContextMenu.init({
    getView: () => view,
    hitPoint: (sx, sy) => AppPoints.hitPoint(sx, sy, view),
    setPoint: (k, x, y) => AppPoints.setPoint(k, x, y),
    getWrapRect: () => canvas.parentElement.getBoundingClientRect()
});

AppWeapons.init(CONFIG.defaultWeapon, () => { UIResults.update(); renderMap(); });

AppLobby.setOnRemoteState((remote) => {
    if (remote.pointA !== undefined || remote.pointB !== undefined) {
        AppPoints.assign(remote.pointA, remote.pointB);
        if (remote.weapon) AppWeapons.set(remote.weapon);
        UIInputs.sync();
        UIResults.update();
        renderMap();
    }
});

AppLobby.setOnDrawing(() => { renderMap(); });

AppLobby.setOnCursor(() => { renderMap(); });

AppLobby.setOnPlayersChange(() => {
    UIPanels.renderLobbyPlayers();
});

AppAnalytics.init();

el('resetView').onclick = () => MapViewport.resetView();
el('clearA').onclick = () => AppPoints.setPoint('A', null);
el('clearB').onclick = () => AppPoints.setPoint('B', null);

document.querySelectorAll('.draw-tool').forEach(btn => {
    btn.addEventListener('click', () => {
        window.AppDraw.setTool(btn.dataset.tool);
        canvas.style.cursor = btn.dataset.tool === 'pan' ? 'crosshair' : 'default';
    });
});

document.querySelectorAll('.width-opt').forEach(btn => {
    btn.addEventListener('click', () => window.AppDraw.setWidth(btn.dataset.width));
});

el('clearDrawingsBtn').addEventListener('click', () => {
    window.AppDraw.clearDrawings();
    renderMap();
});

function findTowerAt(sx, sy) {
    if (!UIPanels.getShowTowers()) return null;
    const halfSize = MapRenderer.getTowerIconSize(view.scale) / 2;
    for (const p of TOWERS) {
        const s = worldToScreen(percentToMeters(p.x, MAP.size), percentToMeters(p.y, MAP.size), view);
        if (Math.abs(s.x - sx) <= halfSize && Math.abs(s.y - sy) <= halfSize) return p;
    }
    return null;
}

// Map interactions
canvas.addEventListener('pointerdown', e => MapInteractions.handlePointerDown(e, canvas, {
    view, mapSize: MAP.size, renderMap,   // ← добавить renderMap
    hitPoint: (sx, sy) => AppPoints.hitPoint(sx, sy, view), findTowerAt,
    openMenuAt: (sx, sy) => UIContextMenu.openMenuAt(sx, sy), hideMenu: () => UIContextMenu.hideMenu(),
    LONG_PRESS_MS, utils: window.AppUtils
}));

canvas.addEventListener('pointerleave', () => {
    const cc = document.getElementById('cursorCoords');
    if (cc) cc.classList.remove('visible');
});

window.addEventListener('pointermove', e => MapInteractions.handlePointerMove(e, canvas, {
    view, mapSize: MAP.size, renderMap, debouncedSaveView: () => MapViewport.debouncedSave(),
    hitPoint: (sx, sy) => AppPoints.hitPoint(sx, sy, view), findTowerAt,
    setPoint: (k, x, y) => AppPoints.setPoint(k, x, y),
    utils: window.AppUtils, TAP_THRESHOLD
}));

const onUp = e => MapInteractions.handlePointerUp(e, canvas, {
    view, renderMap, findTowerAt, selectedTower, setSelectedTower: t => { selectedTower = t; }
});
window.addEventListener('pointerup', onUp);
window.addEventListener('pointercancel', onUp);
window.addEventListener('blur', () => MapInteractions.handleBlur(canvas));

canvas.addEventListener('wheel', e => MapInteractions.handleWheel(e, canvas, {
    view, renderMap, debouncedSaveView: () => MapViewport.debouncedSave(), utils: window.AppUtils
}), { passive: false });

canvas.addEventListener('contextmenu', e => MapInteractions.handleContextMenu(e, canvas, {
    openMenuAt: (sx, sy) => UIContextMenu.openMenuAt(sx, sy)
}));

window.addEventListener('pointerdown', e => {
    if (!el('ctxMenu').contains(e.target)) UIContextMenu.hideMenu();
});

window.addEventListener('keydown', e => {
    if (e.key === 'Escape') { UIContextMenu.hideMenu(); UIPanels.openHelp(false); }
});

// Share
el('shareBtn').addEventListener('click', async () => {
    const url = AppShare.generateUrl(AppPoints.getA(), AppPoints.getB(), AppWeapons.get(), MAP.size);
    await AppShare.copyToClipboard(url);
    AppShare.showToast(STR.shareCopied, 'success');
});

function applySharedParams() {
    const parsed = AppShare.parseSharedParams(MAP.size);
    if (!parsed.applied) return;
    AppPoints.assign(parsed.pointA || AppPoints.getA(), parsed.pointB || AppPoints.getB());
    if (parsed.weapon) AppWeapons.set(parsed.weapon);
    UIInputs.sync(); UIResults.update(); renderMap(); saveState();
    setTimeout(() => AppShare.showToast(STR.shareApplied, 'success'), 400);
    history.replaceState({}, '', location.pathname);
}

// Initialization
MapViewport.resize();
const loadedState = AppStorage.loadState(MAP.size);
if (loadedState) {
    AppPoints.assign(loadedState.pointA, loadedState.pointB);
    MapViewport.restore(loadedState.view);
    UIInputs.sync();
}
applySharedParams();
if (!loadedState) MapViewport.resetView();
renderMap();