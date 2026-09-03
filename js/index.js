'use strict';
const CONFIG = window.CONFIG_APP;
const WEAPONS = window.CONFIG_WEAPONS.weapons;
const MAPS = CONFIG.maps;
const TILE_CACHE_MAX = 500;
const INPUT_DEBOUNCE_MS = CONFIG.timing.inputDebounceMs;
const TAP_THRESHOLD = CONFIG.timing.tapThreshold;
const LONG_PRESS_MS = CONFIG.timing.longPressMs;
const { percentToMeters, worldToScreen } = window.AppUtils;
const STR = new Proxy({}, {
    get: (t, prop) => window.LocaleManager ? window.LocaleManager.t(prop) : prop
});
function el(id) { return document.getElementById(id); }
let currentMapId = AppStorage.loadMap(CONFIG.defaultMap);
if (!MAPS[currentMapId]) currentMapId = CONFIG.defaultMap;
let mapCfg = MAPS[currentMapId];
let MAP = { size: mapCfg.size, coordScale: mapCfg.coordScale };
let ZONE = mapCfg.zone;
let TOWERS = mapCfg.towers;
let TILES = mapCfg.tiles;
MapSpatial.configure(TOWERS, MAP.size);
const canvas = el('map');
canvas.addEventListener('mousedown', e => {
    if (e.button === 1) e.preventDefault();
});
const ctx = canvas.getContext('2d');
const inputs = { ax: el('ax'), ay: el('ay'), bx: el('bx'), by: el('by') };
const out = { dist: el('dist'), az: el('azimuth'), el: el('elevation') };
let selectedTower = null;
let view;
const towerIcon = new Image();
towerIcon.src = window.AppUtils.assetUrl('assets/icons/tower.webp');
towerIcon.onload = () => renderMap();
MapTiles.configure(TILES.cacheMax || TILE_CACHE_MAX);
AppDraw.configure(MAP.size, STR);
AppDraw.initButtons();
AppDraw.setOnStrokeComplete(() => renderMap());
function renderMap() {
    MapRenderer.invalidateBgCache();
    if (UIPanels.getShowTowers()) {
        MapSpatial.rebuild(view, MapRenderer.getTowerIconSize(view.scale) / 2);
    }
    MapRenderer.draw(ctx, canvas, {
        view, MAP, ZONE, TOWERS, WEAPONS,
        currentWeapon: AppWeapons.get(),
        pointA: AppPoints.getA(), pointB: AppPoints.getB(),
        showTowers: UIPanels.getShowTowers(),
        selectedTower, STR, towerIcon, TILES,
        onTileLoaded: onTileLoaded
    });
}
let _rafId = 0;
function scheduleRender() {
    if (_rafId) return;
    _rafId = requestAnimationFrame(() => {
        _rafId = 0;
        renderMap();
    });
}
let _tileRafId = 0;
function scheduleTileRender() {
    if (_tileRafId) return;
    _tileRafId = requestAnimationFrame(() => {
        _tileRafId = 0;
        MapRenderer.drawComposite(ctx, canvas, {
            view, MAP, TILES, onTileLoaded
        });
    });
}
let _tileDebounce = 0;
function onTileLoaded() {
    clearTimeout(_tileDebounce);
    _tileDebounce = setTimeout(scheduleTileRender, 50);
}
function saveState() {
    AppStorage.saveState(AppPoints.getA(), AppPoints.getB(), view, MAP.size);
}
function onPointsChanged() {
    UIInputs.sync();
    UIResults.update();
    renderMap();
    saveState();
}
function switchMap(mapId) {
    if (!MAPS[mapId] || mapId === currentMapId) return;
    currentMapId = mapId;
    mapCfg = MAPS[mapId];
    MAP = { size: mapCfg.size, coordScale: mapCfg.coordScale };
    ZONE = mapCfg.zone;
    TOWERS = mapCfg.towers;
    TILES = mapCfg.tiles;
    MapSpatial.configure(TOWERS, MAP.size);
    selectedTower = null;
    AppStorage.saveMap(mapId);
    MapTiles.clearCache();
    MapTiles.configure(TILES.cacheMax || TILE_CACHE_MAX);
    MapRenderer.invalidateBgCache();
    if (window.AppDraw) {
        AppDraw.cancelStroke();
        AppDraw.clearDrawings();
        AppDraw.configure(MAP.size, STR);
    }
    MapViewport.setMapSize(MAP.size, MAP.coordScale);
    AppPoints.configure({ mapSize: MAP.size, coordScale: MAP.coordScale, onChange: onPointsChanged });
    MapViewport.resetView();
    UIInputs.setMapSize(MAP.size, MAP.coordScale);
    UIInputs.sync();
    UIResults.update();
    renderMap();
    saveState();
    const sel = el('mapSelect');
    if (sel) sel.value = mapId;
    const badge = el('mapBadge');
    if (badge) badge.textContent = mapId.charAt(0).toUpperCase() + mapId.slice(1);
}
function findTowerAt(sx, sy) {
    if (!UIPanels.getShowTowers()) return null;
    const halfSize = MapRenderer.getTowerIconSize(view.scale) / 2;
    MapSpatial.rebuild(view, halfSize);
    return MapSpatial.findTowerAt(sx, sy, halfSize);
}
function applySharedParams() {
    const params = new URLSearchParams(location.search);
    let mapApplied = false;
    if (params.has('map') && MAPS[params.get('map')]) {
        const targetMapId = params.get('map');
        if (targetMapId !== currentMapId) {
            switchMap(targetMapId);
            mapApplied = true;
        }
    }
    const parsed = AppShare.parseSharedParams(MAP.size, MAPS);
    AppPoints.assign(parsed.pointA || AppPoints.getA(), parsed.pointB || AppPoints.getB());
    if (parsed.weapon) AppWeapons.set(parsed.weapon);
    if (parsed.applied || mapApplied) {
        UIInputs.sync(); UIResults.update(); renderMap(); saveState();
        setTimeout(() => AppShare.showToast(STR.shareApplied, 'success'), 400);
    }
    const langParam = params.get('lang');
    history.replaceState({}, '', location.pathname + (langParam ? '?lang=' + langParam : ''));
}
MapViewport.init({ canvas, renderMap, saveState, mapSize: MAP.size, coordScale: MAP.coordScale });
view = MapViewport.get();
AppPoints.configure({ mapSize: MAP.size, coordScale: MAP.coordScale, onChange: onPointsChanged });
UIResults.init({ out, getWeapons: () => WEAPONS, getCurrentWeapon: () => AppWeapons.get(), STR });
UIPanels.init({
    onChange: () => {
        if (!UIPanels.getShowTowers()) selectedTower = null;
        renderMap();
    },
    renderMap: renderMap,
    saveState: saveState
});
UIInputs.init({ inputs, debounceMs: INPUT_DEBOUNCE_MS, mapSize: MAP.size, coordScale: MAP.coordScale });
UIContextMenu.init({
    getView: () => view,
    hitPoint: (sx, sy) => AppPoints.hitPoint(sx, sy, view),
    setPoint: (k, x, y) => AppPoints.setPoint(k, x, y),
    getWrapRect: () => canvas.parentElement.getBoundingClientRect()
});
AppWeapons.init(CONFIG.defaultWeapon, () => { UIResults.update(); renderMap(); });
AppAnalytics.init();
LocaleManager.setOnLocaleChange(() => renderMap());
document.querySelectorAll('.controls-section h2').forEach(h2 => {
    h2.addEventListener('click', () => {
        h2.closest('.controls-section').classList.toggle('collapsed');
    });
});
el('resetView').onclick = () => MapViewport.resetView();
el('clearA').onclick = () => AppPoints.setPoint('A', null);
el('clearB').onclick = () => AppPoints.setPoint('B', null);
const toolNames = {
    pen: () => STR.toolPen || 'Карандаш',
    line: () => STR.toolLine || 'Линейка',
    marker: () => STR.toolMarker || 'Метка',
    eraser: () => STR.toolEraser || 'Ластик',
    pan: () => STR.toolPan || 'Перемещение'
};
document.querySelectorAll('.draw-tool').forEach(btn => {
    btn.addEventListener('click', () => {
        const tool = btn.dataset.tool;
        window.AppDraw.setTool(tool);
        canvas.style.cursor = tool === 'pan' ? 'grab' : (tool === 'eraser' ? 'cell' : 'crosshair');
        const statusEl = el('toolStatus');
        if (statusEl && toolNames[tool]) statusEl.textContent = toolNames[tool]();
    });
});
document.querySelectorAll('.width-opt').forEach(btn => {
    btn.addEventListener('click', () => window.AppDraw.setWidth(btn.dataset.width));
});
el('clearDrawingsBtn').addEventListener('click', () => {
    window.AppDraw.clearDrawings();
    renderMap();
});
window.addEventListener('blur', () => MapInteractions.handleBlur(canvas));
window.addEventListener('resize', () => {
    MapInteractions.invalidateWrapRect();
    MapInteractions.invalidateCanvasRect();
});
canvas.addEventListener('pointerleave', () => {
    const cc = MapInteractions.getCursorCoordsEl();
    if (cc) cc.classList.remove('visible');
});
canvas.addEventListener('wheel', e => MapInteractions.handleWheel(e, canvas, {
    view, renderMap, scheduleRender, debouncedSaveView: () => MapViewport.debouncedSave(), utils: window.AppUtils
}), { passive: false });
const onUp = e => MapInteractions.handlePointerUp(e, canvas, {
    view, renderMap, scheduleRender, findTowerAt, selectedTower, setSelectedTower: t => { selectedTower = t; }
});
window.addEventListener('pointermove', e => MapInteractions.handlePointerMove(e, canvas, {
    get view() { return view; },
    get mapSize() { return MAP.size; },
    renderMap, scheduleRender, debouncedSaveView: () => MapViewport.debouncedSave(),
    hitPoint: (sx, sy) => AppPoints.hitPoint(sx, sy, view), findTowerAt,
    setPoint: (k, x, y) => AppPoints.setPoint(k, x, y),
    utils: window.AppUtils, TAP_THRESHOLD, get coordScale() { return MAP.coordScale; }
}));
canvas.addEventListener('pointerdown', e => MapInteractions.handlePointerDown(e, canvas, {
    view, mapSize: MAP.size, renderMap, scheduleRender,
    hitPoint: (sx, sy) => AppPoints.hitPoint(sx, sy, view), findTowerAt,
    openMenuAt: (sx, sy) => UIContextMenu.openMenuAt(sx, sy), hideMenu: () => UIContextMenu.hideMenu(),
    LONG_PRESS_MS, utils: window.AppUtils
}));
window.addEventListener('pointerup', onUp);
window.addEventListener('pointercancel', onUp);
canvas.addEventListener('contextmenu', e => MapInteractions.handleContextMenu(e, canvas, {
    openMenuAt: (sx, sy) => UIContextMenu.openMenuAt(sx, sy)
}));
window.addEventListener('pointerdown', e => {
    const ctxMenu = el('ctxMenu');
    if (ctxMenu && !ctxMenu.contains(e.target)) UIContextMenu.hideMenu();
});
window.addEventListener('keydown', e => {
    if (e.key === 'Escape') { UIContextMenu.hideMenu(); UIPanels.openHelp(false); if (window.AppDraw) AppDraw.hideMarkerModal(); }
});
el('shareBtn').addEventListener('click', async () => {
    const url = AppShare.generateUrl(AppPoints.getA(), AppPoints.getB(), AppWeapons.get(), MAP.size, currentMapId);
    await AppShare.copyToClipboard(url);
    AppShare.showToast(STR.shareCopied, 'success');
});
const mapSelect = el('mapSelect');
if (mapSelect) {
    mapSelect.value = currentMapId;
    mapSelect.addEventListener('change', () => switchMap(mapSelect.value));
}
MapViewport.resize();
const loadedState = AppStorage.loadState(MAP.size);
if (loadedState) {
    AppPoints.assign(loadedState.pointA, loadedState.pointB);
    MapViewport.restore(loadedState.view);
    UIInputs.sync();
}
const badge = el('mapBadge');
if (badge) badge.textContent = currentMapId.charAt(0).toUpperCase() + currentMapId.slice(1);
applySharedParams();
if (!loadedState) MapViewport.resetView();
canvas.style.cursor = 'grab';
renderMap();