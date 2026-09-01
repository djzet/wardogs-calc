/**
 *
 * Точка входа для всей бизнес-логики:
 * 1. Загружает конфигурацию и определяет глобальные константы
 * 2. Инициализирует все модули (камера, точки, UI, оружие)
 * 3. Привязывает глобальные обработчики событий (pointer, wheel, keyboard)
 * 4. Восстанавливает состояние из localStorage
 * 5. Применяет параметры из URL (шаринг)
 * 6. Запускает первый renderMap()
 *
 * Порядок выполнения критичен — модули инициализируются по порядку.
 * Работает в 'use strict' режиме.
 */

'use strict';

// ═══════════════════════════════════════════════════════════
//  Константы и ссылки на модули
// ═══════════════════════════════════════════════════════════

/** Конфигурация приложения (maps, timing, defaultWeapon) */
const CONFIG = window.CONFIG_APP;

/** Объект оружия (mortar, artillery) с баллистическими таблицами */
const WEAPONS = window.CONFIG_WEAPONS.weapons;

/** Конфиги всех карт */
const MAPS = CONFIG.maps;

/** Макс. количество тайлов в LRU-кэше (по умолчанию) */
const TILE_CACHE_MAX = 500;

/** Задержка debounce для полей ввода (мс) */
const INPUT_DEBOUNCE_MS = CONFIG.timing.inputDebounceMs;

/** Порог движения для различия tap vs drag (px) */
const TAP_THRESHOLD = CONFIG.timing.tapThreshold;

/** Длительность долгого нажатия для контекстного меню (мс) */
const LONG_PRESS_MS = CONFIG.timing.longPressMs;

/** Деструктуризация утилит (для краткости в коде) */
const { percentToMeters, worldToScreen } = window.AppUtils;

/**
 * Прокси для локализации: STR.key → LocaleManager.t(key).
 * Позволяет писать STR.title вместо window.LocaleManager.t('title').
 */
const STR = new Proxy({}, {
    get: (t, prop) => window.LocaleManager ? window.LocaleManager.t(prop) : prop
});

/**
 * Удобная функция для получения DOM-элемента по ID.
 * @param {string} id
 * @returns {HTMLElement}
 */
function el(id) { return document.getElementById(id); }

// ═══════════════════════════════════════════════════════════
//  Загрузка текущей карты из localStorage
// ═══════════════════════════════════════════════════════════

/** ID текущей карты (восстанавливается из localStorage) */
let currentMapId = AppStorage.loadMap(CONFIG.defaultMap);
if (!MAPS[currentMapId]) currentMapId = CONFIG.defaultMap;

/** Конфиг текущей карты */
let mapCfg = MAPS[currentMapId];

/** Объекты-обёртки для передачи по ссылке в renderMap */
let MAP = { size: mapCfg.size };
let ZONE = mapCfg.zone;
let TOWERS = mapCfg.towers;
let TILES = mapCfg.tiles;

// ═══════════════════════════════════════════════════════════
//  Canvas и DOM-элементы
// ═══════════════════════════════════════════════════════════

/** Элемент canvas для отрисовки карты */
const canvas = el('map');

/** Предотвращаем скролл средней кнопкой мыши */
canvas.addEventListener('mousedown', e => {
    if (e.button === 1) e.preventDefault();
});

/** Контекст canvas для рисования */
const ctx = canvas.getContext('2d');

/** DOM-элементы полей ввода координат */
const inputs = { ax: el('ax'), ay: el('ay'), bx: el('bx'), by: el('by') };

/** DOM-элементы панели результатов */
const out = { dist: el('dist'), az: el('azimuth'), el: el('elevation') };

/** Выбранная вышка (для tooltip) */
let selectedTower = null;

/** Объект камеры (view) — задаётся после init MapViewport */
let view;

// ═══════════════════════════════════════════════════════════
//  Загрузка иконки вышки
// ═══════════════════════════════════════════════════════════

const towerIcon = new Image();
towerIcon.src = window.AppUtils.assetUrl('assets/icons/tower.webp');
towerIcon.onload = () => renderMap();

// ═══════════════════════════════════════════════════════════
//  Конфигурация модулей
// ═══════════════════════════════════════════════════════════

MapTiles.configure(TILES.cacheMax || TILE_CACHE_MAX);
AppDraw.configure(MAP.size, STR);
AppDraw.setOnStrokeComplete(() => renderMap());

// ═══════════════════════════════════════════════════════════
//  Основные функции
// ═══════════════════════════════════════════════════════════

/**
 * Главная функция перерисовки карты.
 * Собирает все данные и передаёт в MapRenderer.draw().
 * Вызывается при любом изменении (точки, зум, перемещение, тема).
 */
function renderMap() {
    MapRenderer.draw(ctx, canvas, {
        view, MAP, ZONE, TOWERS, WEAPONS,
        currentWeapon: AppWeapons.get(),
        pointA: AppPoints.getA(), pointB: AppPoints.getB(),
        theme: UIPanels.getTheme(), showTowers: UIPanels.getShowTowers(),
        selectedTower, STR, towerIcon, TILES,
        onTileLoaded: scheduleRender /** Перерисовка при загрузке нового тайла */
    });
}

/**
 * Планирует отложенную перерисовку через requestAnimationFrame.
 * Группирует несколько вызовов в один кадр — вместо N перерисовок
 * за pointermove (60×/сек) будет ровно 1.
 *
 * Используется в горячих путях: pan, zoom, draw, erase.
 * Для единичных действий (смена карты, оружия) — вызывайте renderMap() напрямую.
 */
let _rafId = 0;
function scheduleRender() {
    if (_rafId) return; /** Уже запланирован — пропускаем */
    _rafId = requestAnimationFrame(() => {
        _rafId = 0;
        renderMap();
    });
}

/**
 * Сохраняет текущее состояние в localStorage.
 * Вызывается после каждого изменения точек/камеры.
 */
function saveState() {
    AppStorage.saveState(AppPoints.getA(), AppPoints.getB(), view, MAP.size);
}

/**
 * Колбэк при изменении точек A/B.
 * Синхронизирует UI, обновляет результаты и перерисовывает карту.
 */
function onPointsChanged() {
    UIInputs.sync();
    UIResults.update();
    renderMap();
    saveState();
}

/**
 * Переключает карту (bakurani ↔ ozeti).
 * Сбрасывает точки, рисунки, кэш тайлов и камера.
 *
 * @param {string} mapId — ID новой карты
 */
function switchMap(mapId) {
    if (!MAPS[mapId] || mapId === currentMapId) return;

    currentMapId = mapId;
    mapCfg = MAPS[mapId];
    MAP = { size: mapCfg.size };
    ZONE = mapCfg.zone;
    TOWERS = mapCfg.towers;
    TILES = mapCfg.tiles;

    selectedTower = null;
    AppStorage.saveMap(mapId);
    MapTiles.clearCache();
    MapTiles.configure(TILES.cacheMax || TILE_CACHE_MAX);

    /** Сбрасываем рисунки при смене карты */
    if (window.AppDraw) {
        AppDraw.cancelStroke();
        AppDraw.clearDrawings();
        AppDraw.configure(MAP.size, STR);
    }

    MapViewport.setMapSize(MAP.size);
    AppPoints.configure({ mapSize: MAP.size, onChange: onPointsChanged });
    MapViewport.resetView();
    UIInputs.setMapSize(MAP.size);
    UIInputs.sync();
    UIResults.update();
    renderMap();
    saveState();

    /** Синхронизируем select в drawer */
    const sel = el('mapSelect');
    if (sel) sel.value = mapId;
}

/**
 * Проверяет попадание на вышку в экраниной позиции.
 * Используется при клике/tap для выбора вышки.
 *
 * @param {number} sx — экраниая X
 * @param {number} sy — экраниая Y
 * @returns {object|null} объект вышки или null
 */
function findTowerAt(sx, sy) {
    if (!UIPanels.getShowTowers()) return null;
    const halfSize = MapRenderer.getTowerIconSize(view.scale) / 2;
    for (const p of TOWERS) {
        const s = worldToScreen(percentToMeters(p.x, MAP.size), percentToMeters(p.y, MAP.size), view);
        if (Math.abs(s.x - sx) <= halfSize && Math.abs(s.y - sy) <= halfSize) return p;
    }
    return null;
}

/**
 * Применяет параметры из URL (шаринг).
 * Вызывается один раз при загрузке.
 * После применения очищает URL (history.replaceState).
 */
function applySharedParams() {
    /** Сначала определяем карту из URL (без парсинга координат) */
    const params = new URLSearchParams(location.search);
    let mapApplied = false;

    if (params.has('map') && MAPS[params.get('map')]) {
        const targetMapId = params.get('map');
        if (targetMapId !== currentMapId) {
            switchMap(targetMapId);
            mapApplied = true;
        }
    }

    /** Парсим координаты и оружие ПОСЛЕ возможного switchMap (с правильным mapSize) */
    const parsed = AppShare.parseSharedParams(MAP.size, MAPS);

    /** Устанавливаем точки из URL */
    AppPoints.assign(parsed.pointA || AppPoints.getA(), parsed.pointB || AppPoints.getB());

    /** Устанавливаем оружие из URL */
    if (parsed.weapon) AppWeapons.set(parsed.weapon);

    if (parsed.applied || mapApplied) {
        UIInputs.sync(); UIResults.update(); renderMap(); saveState();
        setTimeout(() => AppShare.showToast(STR.shareApplied, 'success'), 400);
    }

    /** Очищаем URL-параметры (чтобы не применялись повторно при F5) */
    history.replaceState({}, '', location.pathname);
}

// ═══════════════════════════════════════════════════════════
//  Инициализация модулей
// ═══════════════════════════════════════════════════════════

/** Камера: привязка resize, начальная позиция */
MapViewport.init({ canvas, renderMap, saveState, mapSize: MAP.size });
view = MapViewport.get();

/** Точки A/B: размер карты + колбэк обновления */
AppPoints.configure({ mapSize: MAP.size, onChange: onPointsChanged });

/** Панель результатов: привязка DOM-элементов и зависимостей */
UIResults.init({ out, getWeapons: () => WEAPONS, getCurrentWeapon: () => AppWeapons.get(), STR });

/** Панели (drawer, тема, вышки): привязка колбэков */
UIPanels.init({
    onChange: () => {
        if (!UIPanels.getShowTowers()) selectedTower = null;
        renderMap();
    },
    renderMap: renderMap,
    saveState: saveState
});

/** Поля ввода координат */
UIInputs.init({ inputs, debounceMs: INPUT_DEBOUNCE_MS, mapSize: MAP.size });

/** Контекстное меню на карте */
UIContextMenu.init({
    getView: () => view,
    hitPoint: (sx, sy) => AppPoints.hitPoint(sx, sy, view),
    setPoint: (k, x, y) => AppPoints.setPoint(k, x, y),
    getWrapRect: () => canvas.parentElement.getBoundingClientRect()
});

/** Оружие: загрузка сохранённого + привязка radio-кнопок */
AppWeapons.init(CONFIG.defaultWeapon, () => { UIResults.update(); renderMap(); });

/** Аналитика: привязка кликов Discord */
AppAnalytics.init();

/** Перерисовка canvas при смене языка (сетка, круг дальности, линейка, вышки) */
LocaleManager.setOnLocaleChange(() => renderMap());

// ═══════════════════════════════════════════════════════════
//  Привязка UI-кнопок
// ═══════════════════════════════════════════════════════════

el('resetView').onclick = () => MapViewport.resetView();
el('clearA').onclick = () => AppPoints.setPoint('A', null);
el('clearB').onclick = () => AppPoints.setPoint('B', null);

/** Кнопки инструментов рисования */
document.querySelectorAll('.draw-tool').forEach(btn => {
    btn.addEventListener('click', () => {
        window.AppDraw.setTool(btn.dataset.tool);
        /** Меняем курсор в зависимости от инструмента */
        canvas.style.cursor = btn.dataset.tool === 'pan' ? 'grab' : (btn.dataset.tool === 'eraser' ? 'cell' : 'crosshair');
    });
});

/** Кнопки толщины линии */
document.querySelectorAll('.width-opt').forEach(btn => {
    btn.addEventListener('click', () => window.AppDraw.setWidth(btn.dataset.width));
});

/** Кнопка очистки всех рисунков */
el('clearDrawingsBtn').addEventListener('click', () => {
    window.AppDraw.clearDrawings();
    renderMap();
});

// ═══════════════════════════════════════════════════════════
//  Глобальные обработчики событий
// ═══════════════════════════════════════════════════════════

/** Blur окна → сброс всех состояний */
window.addEventListener('blur', () => MapInteractions.handleBlur(canvas));

/** Resize окна → инвалидация кеша wrapRect (для tooltip координат) */
window.addEventListener('resize', () => MapInteractions.invalidateWrapRect());

/** Pointer leave canvas → скрытие tooltip координат (из кеша MapInteractions) */
canvas.addEventListener('pointerleave', () => {
    const cc = MapInteractions.getCursorCoordsEl();
    if (cc) cc.classList.remove('visible');
});

/** Колёсико мыши → zoom */
canvas.addEventListener('wheel', e => MapInteractions.handleWheel(e, canvas, {
    view, renderMap, scheduleRender, debouncedSaveView: () => MapViewport.debouncedSave(), utils: window.AppUtils
}), { passive: false });

/** Pointer up / cancel → завершение drag/pinch/draw */
const onUp = e => MapInteractions.handlePointerUp(e, canvas, {
    view, renderMap, scheduleRender, findTowerAt, selectedTower, setSelectedTower: t => { selectedTower = t; }
});

/** Pointer move (глобально) → drag/pinch/draw/erase/tooltip */
window.addEventListener('pointermove', e => MapInteractions.handlePointerMove(e, canvas, {
    /** Геттеры: берут актуальные значения через замыкание */
    get view() { return view; },
    get mapSize() { return MAP.size; },
    renderMap, scheduleRender, debouncedSaveView: () => MapViewport.debouncedSave(),
    hitPoint: (sx, sy) => AppPoints.hitPoint(sx, sy, view), findTowerAt,
    setPoint: (k, x, y) => AppPoints.setPoint(k, x, y),
    utils: window.AppUtils, TAP_THRESHOLD
}));

/** Pointer down на canvas → pan/draw/point/tower */
canvas.addEventListener('pointerdown', e => MapInteractions.handlePointerDown(e, canvas, {
    view, mapSize: MAP.size, renderMap, scheduleRender,
    hitPoint: (sx, sy) => AppPoints.hitPoint(sx, sy, view), findTowerAt,
    openMenuAt: (sx, sy) => UIContextMenu.openMenuAt(sx, sy), hideMenu: () => UIContextMenu.hideMenu(),
    LONG_PRESS_MS, utils: window.AppUtils
}));

window.addEventListener('pointerup', onUp);
window.addEventListener('pointercancel', onUp);

/** ПКМ → контекстное меню */
canvas.addEventListener('contextmenu', e => MapInteractions.handleContextMenu(e, canvas, {
    openMenuAt: (sx, sy) => UIContextMenu.openMenuAt(sx, sy)
}));

/** Клик вне контекстного меню → скрыть */
window.addEventListener('pointerdown', e => {
    const ctxMenu = el('ctxMenu');
    if (ctxMenu && !ctxMenu.contains(e.target)) UIContextMenu.hideMenu();
});

/** Escape → закрыть контекстное меню и справку */
window.addEventListener('keydown', e => {
    if (e.key === 'Escape') { UIContextMenu.hideMenu(); UIPanels.openHelp(false); if (window.AppDraw) AppDraw.hideMarkerModal(); }
});

// ═══════════════════════════════════════════════════════════
//  Шаринг: генерация ссылки и копирование
// ═══════════════════════════════════════════════════════════

el('shareBtn').addEventListener('click', async () => {
    const url = AppShare.generateUrl(AppPoints.getA(), AppPoints.getB(), AppWeapons.get(), MAP.size, currentMapId);
    await AppShare.copyToClipboard(url);
    AppShare.showToast(STR.shareCopied, 'success');
});

// ═══════════════════════════════════════════════════════════
//  Селектор карт в drawer
// ═══════════════════════════════════════════════════════════

const mapSelect = el('mapSelect');
if (mapSelect) {
    mapSelect.value = currentMapId;
    mapSelect.addEventListener('change', () => switchMap(mapSelect.value));
}

// ═══════════════════════════════════════════════════════════
//  Финальная инициализация
// ═══════════════════════════════════════════════════════════

/** Подгоняем canvas под текущий DPR */
MapViewport.resize();

/** Восстанавливаем сохранённое состояние (точки + камера) */
const loadedState = AppStorage.loadState(MAP.size);
if (loadedState) {
    AppPoints.assign(loadedState.pointA, loadedState.pointB);
    MapViewport.restore(loadedState.view);
    UIInputs.sync();
}

/** Применяем параметры из URL (шаринг) — после localStorage, чтобы шаринг имел приоритет */
applySharedParams();

/** Если нет сохранённого состояния — сбрасываем вид в центр карты */
if (!loadedState) MapViewport.resetView();

/** Устанавливаем курсор по умолчанию для текущего инструмента */
canvas.style.cursor = 'grab';

/** Первый renderMap — отрисовка начального состояния */
renderMap();
