'use strict';

// Конфиги из отдельных файлов
const CONFIG = window.CONFIG_APP;
const WEAPONS = window.CONFIG_WEAPONS.weapons;

// Ссылки на конфигурацию для удобства
const MAP = CONFIG.map;
const ZONE = CONFIG.zone;
const TOWERS = CONFIG.towers;
const TILES = CONFIG.tiles;
const TILE_CACHE_MAX = CONFIG.tiles.cacheMax;
const INPUT_DEBOUNCE_MS = CONFIG.timing.inputDebounceMs;
const TAP_THRESHOLD = CONFIG.timing.tapThreshold;
const LONG_PRESS_MS = CONFIG.timing.longPressMs;

// Короткие ссылки на утилиты из модуля
const { clamp, percentToMeters, metersToPercent, formatPercent,
    worldToScreen, screenToWorld, fmtCoord, fmtDist, NBSP } = window.AppUtils;

const tileCache = new Map();

// Обёртка для совместимости со старым кодом
const STR = new Proxy({}, {
    get(target, prop) {
        return window.LocaleManager ? window.LocaleManager.t(prop) : prop;
    }
});

window.I18N = {};

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

let showTowers = AppStorage.loadTowers();
let selectedTower = null;
let currentWeapon = AppStorage.loadWeapon(CONFIG.defaultWeapon);
let theme = AppStorage.loadTheme(CONFIG.defaultTheme);

const view = { scale: 0.05, ox: 0, oy: 0 };
let pointA = null;
let pointB = null;
let menuWorld = null;
let menuPointKey = null;
let dragging = null;
let inputTimer = null;

const towerIcon = new Image();
towerIcon.src = 'assets/icons/tower.webp';
towerIcon.onload = () => draw();

function getTile(z, x, y) {
    const key = `${z}/${x}_${y}`;
    let t = tileCache.get(key);
    if (t) {
        tileCache.delete(key);
        tileCache.set(key, t);
        return t;
    }
    const img = new Image();
    t = { img, loaded: false, error: false };
    img.onload = () => { t.loaded = true; draw(); };
    img.onerror = () => { t.error = true; };
    img.src = TILES.path(z, x, y);
    tileCache.set(key, t);

    if (tileCache.size > TILE_CACHE_MAX) {
        const oldestKey = tileCache.keys().next().value;
        const oldest = tileCache.get(oldestKey);
        if (oldest && oldest.img) {
            oldest.img.src = '';
            oldest.img.onload = null;
            oldest.img.onerror = null;
        }
        tileCache.delete(oldestKey);
    }
    return t;
}

function drawTiles() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const z = Math.max(0, Math.min(TILES.maxZoom,
        Math.round(Math.log2((view.scale * MAP.size) / TILES.size))));
    const tps = 2 ** z;
    const tileScale = (tps * TILES.size) / MAP.size;
    const drawSize = TILES.size * (view.scale / tileScale);

    const a = screenToWorld(0, 0, view), b = screenToWorld(w, h, view);
    const x0 = Math.max(0, Math.floor((a.x / MAP.size) * tps));
    const x1 = Math.min(tps - 1, Math.floor((b.x / MAP.size) * tps));
    const y0 = Math.max(0, Math.floor(((MAP.size - a.y) / MAP.size) * tps));
    const y1 = Math.min(tps - 1, Math.floor(((MAP.size - b.y) / MAP.size) * tps));

    for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
            const wx0 = (tx / tps) * MAP.size;
            const wy0 = MAP.size - (ty / tps) * MAP.size;
            const s = worldToScreen(wx0, wy0, view);
            const t = getTile(z, tx, ty);
            if (t.loaded) {
                ctx.drawImage(t.img, s.x, s.y, drawSize + 0.5, drawSize + 0.5);
            } else if (!t.error) {
                ctx.fillStyle = CT().mapBg;
                ctx.fillRect(s.x, s.y, drawSize, drawSize);
            }
        }
    }
}

const CANVAS_THEMES = {
    dark: {
        bg: '#10151b', mapBg: '#161d25',
        gridMinor: 'rgba(255, 255, 255, 0.08)',
        gridMajor: 'rgba(255, 255, 255, 0.18)',
        axes: 'rgba(255, 255, 255, 0.35)',
        dim: 'rgba(6, 8, 12, 0.55)',
        border: '#46536b', labels: '#5c6875',
        line: '#e8c35a',
    },
    light: {
        bg: '#dfe5ec', mapBg: '#f2f5f8',
        gridMinor: 'rgba(15, 25, 40, 0.10)',
        gridMajor: 'rgba(15, 25, 40, 0.22)',
        axes: 'rgba(15, 25, 40, 0.40)',
        dim: 'rgba(255, 255, 255, 0.6)',
        border: '#7d8896', labels: '#5c6875',
        line: '#8a6d00',
    },
};
function CT() { return CANVAS_THEMES[theme] || CANVAS_THEMES.dark; }

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
    draw();
}
window.addEventListener('resize', resize);

function resetView() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    view.scale = Math.min(w, h) / MAP.size * 0.9;
    view.ox = w / 2 - (MAP.size / 2) * view.scale;
    view.oy = h / 2 + (MAP.size / 2) * view.scale;
    draw();
    debouncedSaveView();
}
document.getElementById('resetView').onclick = resetView;

const drawer = document.getElementById('drawer');
const drawerBackdrop = document.getElementById('drawerBackdrop');

function openDrawer(state) {
    drawer.classList.toggle('open', state);
    drawerBackdrop.classList.toggle('hidden', !state);
}
document.getElementById('drawerToggle').onclick = () => openDrawer(true);
document.getElementById('drawerClose').onclick = () => openDrawer(false);
drawerBackdrop.onclick = () => openDrawer(false);

const helpModal = document.getElementById('helpModal');

function openHelp(state) {
    helpModal.classList.toggle('hidden', !state);
}
document.getElementById('helpToggle').onclick = () => openHelp(true);
document.getElementById('helpClose').onclick = () => openHelp(false);
helpModal.addEventListener('mousedown', e => {
    if (e.target === helpModal) openHelp(false);
});

const towersToggle = document.getElementById('towersToggle');
towersToggle.checked = showTowers;
towersToggle.addEventListener('change', () => {
    showTowers = towersToggle.checked;
    AppStorage.saveTowers(showTowers);
    if (!showTowers) selectedTower = null;
    draw();
});

const themeToggle = document.getElementById('themeToggle');
function applyTheme() {
    document.body.classList.toggle('light', theme === 'light');
    draw();
}
themeToggle.onclick = () => {
    theme = (theme === 'dark') ? 'light' : 'dark';
    AppStorage.saveTheme(theme);
    applyTheme();
};

function niceStep() {
    const raw = 70 / view.scale;
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    for (const m of [1, 2, 5, 10]) if (m * pow >= raw) return m * pow;
    return 10 * pow;
}

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
    const halfSize = getTowerIconSize() / 2;
    for (const p of TOWERS) {
        const s = worldToScreen(percentToMeters(p.x, MAP.size), percentToMeters(p.y, MAP.size), view);
        if (Math.abs(s.x - sx) <= halfSize && Math.abs(s.y - sy) <= halfSize) {
            return p;
        }
    }
    return null;
}

function drawRangeCircle() {
    if (!pointA) return;

    const weapon = WEAPONS[currentWeapon];
    if (!weapon || !weapon.maxRangeKm) return;

    const maxRangeMeters = weapon.maxRangeKm * 1000;
    const sa = worldToScreen(pointA.x, pointA.y, view);
    const radiusPx = maxRangeMeters * view.scale;
    const color = weapon.rangeColor || '#9fd356';

    ctx.beginPath();
    ctx.arc(sa.x, sa.y, radiusPx, 0, Math.PI * 2);
    ctx.fillStyle = color + '14';
    ctx.fill();

    ctx.strokeStyle = color + '99';
    ctx.setLineDash([10, 6]);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 1;

    const label = weapon.maxRangeKm < 1
        ? Math.round(weapon.maxRangeKm * 1000) + NBSP + STR.u_m
        : weapon.maxRangeKm.toFixed(1) + NBSP + STR.u_km;

    ctx.fillStyle = color;
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, sa.x, sa.y - radiusPx - 4);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
}

function draw() {
    const c = CT();
    const w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.fillStyle = c.bg;
    ctx.fillRect(0, 0, w, h);

    const m0 = worldToScreen(0, 0, view);
    const m1 = worldToScreen(MAP.size, MAP.size, view);
    ctx.fillStyle = c.mapBg;
    ctx.fillRect(m0.x, m1.y, m1.x - m0.x, m0.y - m1.y);

    drawTiles();

    const step = niceStep(), minor = step / 5;
    const a = screenToWorld(0, 0, view), b = screenToWorld(w, h, view);
    const minX = a.x, maxX = b.x, minY = b.y, maxY = a.y;
    ctx.lineWidth = 1;

    if (minor * view.scale >= 9) {
        ctx.strokeStyle = c.gridMinor;
        ctx.beginPath();
        for (let gx = Math.ceil(minX / minor) * minor; gx <= maxX; gx += minor) {
            const s = worldToScreen(gx, 0, view);
            ctx.moveTo(Math.round(s.x) + .5, 0); ctx.lineTo(Math.round(s.x) + .5, h);
        }
        for (let gy = Math.ceil(minY / minor) * minor; gy <= maxY; gy += minor) {
            const s = worldToScreen(0, gy, view);
            ctx.moveTo(0, Math.round(s.y) + .5); ctx.lineTo(w, Math.round(s.y) + .5);
        }
        ctx.stroke();
    }

    ctx.strokeStyle = c.gridMajor;
    ctx.beginPath();
    for (let gx = Math.ceil(minX / step) * step; gx <= maxX; gx += step) {
        const s = worldToScreen(gx, 0, view);
        ctx.moveTo(Math.round(s.x) + .5, 0); ctx.lineTo(Math.round(s.x) + .5, h);
    }
    for (let gy = Math.ceil(minY / step) * step; gy <= maxY; gy += step) {
        const s = worldToScreen(0, gy, view);
        ctx.moveTo(0, Math.round(s.y) + .5); ctx.lineTo(w, Math.round(s.y) + .5);
    }
    ctx.stroke();

    ctx.strokeStyle = c.axes;
    ctx.beginPath();
    const zero = worldToScreen(0, 0, view);
    ctx.moveTo(zero.x + .5, 0); ctx.lineTo(zero.x + .5, h);
    ctx.moveTo(0, zero.y + .5); ctx.lineTo(w, zero.y + .5);
    ctx.stroke();

    ctx.fillStyle = c.dim;
    ctx.fillRect(0, 0, w, m1.y);
    ctx.fillRect(0, m0.y, w, h - m0.y);
    ctx.fillRect(0, m1.y, m0.x, m0.y - m1.y);
    ctx.fillRect(m1.x, m1.y, w - m1.x, m0.y - m1.y);

    ctx.strokeStyle = c.border;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(m0.x, m1.y, m1.x - m0.x, m0.y - m1.y);
    ctx.lineWidth = 1;

    const zc = worldToScreen(ZONE.cx, ZONE.cy, view);
    ctx.beginPath();
    ctx.arc(zc.x, zc.y, ZONE.r * view.scale, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(159, 211, 86, 0.05)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(124, 180, 60, 0.55)';
    ctx.setLineDash([10, 6]);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 1;

    if (showTowers) TOWERS.forEach(drawTower);

    ctx.fillStyle = c.labels;
    ctx.font = '11px monospace';
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
    for (let gx = Math.ceil(minX / step) * step; gx <= maxX; gx += step)
        ctx.fillText(fmtCoord(gx, step, STR), worldToScreen(gx, 0, view).x + 4, h - 6);
    for (let gy = Math.ceil(minY / step) * step; gy <= maxY; gy += step)
        ctx.fillText(fmtCoord(gy, step, STR), 4, worldToScreen(0, gy, view).y - 4);

    if (pointA && pointB) {
        const sa = worldToScreen(pointA.x, pointA.y, view);
        const sb = worldToScreen(pointB.x, pointB.y, view);
        ctx.strokeStyle = c.line;
        ctx.setLineDash([6, 6]);
        ctx.beginPath(); ctx.moveTo(sa.x, sa.y); ctx.lineTo(sb.x, sb.y); ctx.stroke();
        ctx.setLineDash([]);
        const d = Math.hypot(pointB.x - pointA.x, pointB.y - pointA.y);
        ctx.fillStyle = c.line;
        ctx.font = '12px monospace';
        ctx.fillText(fmtDist(d, STR), (sa.x + sb.x) / 2 + 8, (sa.y + sb.y) / 2 - 8);
    }

    drawRangeCircle();

    if (pointA) drawPoint(pointA, '#7bc95e', 'A');
    if (pointB) drawPoint(pointB, '#e05656', 'B');
}

function drawPoint(p, color, label) {
    const s = worldToScreen(p.x, p.y, view);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(s.x, s.y, 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(label, s.x + 11, s.y - 9);
}

function getTowerIconSize() {
    return Math.max(16, Math.min(30, 22 * view.scale * 80));
}

function drawTower(p) {
    const wx = percentToMeters(p.x, MAP.size), wy = percentToMeters(p.y, MAP.size);
    const s = worldToScreen(wx, wy, view);
    const iconSize = getTowerIconSize();

    if (towerIcon.complete && towerIcon.naturalWidth > 0) {
        ctx.drawImage(towerIcon,
            s.x - iconSize / 2,
            s.y - iconSize / 2,
            iconSize, iconSize);

        if (selectedTower === p) {
            drawTowerTooltip(p, s);
        }
    } else {
        ctx.fillStyle = '#ff9d5c';
        ctx.beginPath();
        ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawTowerTooltip(p, s) {
    const label = STR[p.name] || p.name;
    ctx.font = 'bold 12px sans-serif';
    const textWidth = ctx.measureText(label).width;
    const padX = 8, padY = 4;
    const w = textWidth + padX * 2;
    const h = 22;
    const x = s.x - w / 2;
    const y = s.y - getTowerIconSize() / 2 - 28;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(x + 2, y + 2, w, h);
    ctx.fillStyle = '#1a1f27';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#9fd356';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    ctx.beginPath();
    ctx.moveTo(s.x - 6, y + h);
    ctx.lineTo(s.x + 6, y + h);
    ctx.lineTo(s.x, y + h + 6);
    ctx.closePath();
    ctx.fillStyle = '#1a1f27';
    ctx.fill();
    ctx.strokeStyle = '#9fd356';
    ctx.stroke();
    ctx.fillStyle = '#e6e6e6';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, s.x, y + h / 2);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
}

function setPoint(key, x, y) {
    let p = null;
    if (x != null && y != null) {
        p = {
            x: clamp(x, 0, MAP.size),
            y: clamp(y, 0, MAP.size)
        };
    }
    if (key === 'A') pointA = p; else pointB = p;
    syncInputs(); recalc(); draw();
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
    recalc(); draw();
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

const pointers = new Map();
let pinch = null;
let longPressTimer = null;
let longPressFired = false;
let lastTouchTs = 0;

function canvasPos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
}

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

function startLongPress(sx, sy) {
    clearTimeout(longPressTimer);
    longPressFired = false;
    longPressTimer = setTimeout(() => {
        longPressFired = true;
        dragging = null;
        canvas.style.cursor = 'crosshair';
        openMenuAt(sx, sy);
    }, LONG_PRESS_MS);
}
function stopLongPress() { clearTimeout(longPressTimer); }

canvas.addEventListener('pointerdown', e => {
    const p = canvasPos(e);
    if (e.pointerType !== 'mouse') lastTouchTs = performance.now();

    try { canvas.setPointerCapture(e.pointerId); } catch (_) { }
    pointers.set(e.pointerId, p);

    if (e.button !== 0) return;

    hideMenu();

    if (pointers.size === 2) {
        stopLongPress();
        dragging = null;
        const [p1, p2] = [...pointers.values()];
        const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        pinch = {
            dist: Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1,
            scale: view.scale,
            anchor: screenToWorld(mid.x, mid.y, view),
        };
        return;
    }
    if (pointers.size > 2) return;

    if (e.pointerType !== 'mouse') startLongPress(p.x, p.y);

    const hit = hitPoint(p.x, p.y);
    if (hit) {
        dragging = { mode: 'point', key: hit };
        canvas.style.cursor = 'grabbing';
        return;
    }

    const towerHit = findTowerAt(p.x, p.y);
    if (towerHit) {
        dragging = {
            mode: 'tower-or-pan', tower: towerHit,
            startX: p.x, startY: p.y, ox: view.ox, oy: view.oy,
        };
        return;
    }

    dragging = { mode: 'pan', startX: p.x, startY: p.y, ox: view.ox, oy: view.oy };
    canvas.style.cursor = 'grabbing';
});

window.addEventListener('pointermove', e => {
    const p = canvasPos(e);
    const tracked = pointers.has(e.pointerId);
    if (tracked) {
        pointers.set(e.pointerId, p);
        if (e.pointerType !== 'mouse') lastTouchTs = performance.now();
    }

    if (pinch && pointers.size >= 2) {
        const [p1, p2] = [...pointers.values()];
        const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1;
        const newScale = clamp(pinch.scale * dist / pinch.dist, 0.005, 1);
        view.scale = newScale;
        view.ox = mid.x - pinch.anchor.x * newScale;
        view.oy = mid.y + pinch.anchor.y * newScale;
        draw();
        debouncedSaveView();
        return;
    }

    if (!tracked) {
        if (e.pointerType === 'mouse' && !dragging) {
            const overPoint = hitPoint(p.x, p.y);
            const overTower = !overPoint && findTowerAt(p.x, p.y);
            canvas.style.cursor = overPoint ? 'grab' : (overTower ? 'pointer' : 'crosshair');
        }
        return;
    }

    if (!dragging) return;

    if (dragging.mode === 'tower-or-pan') {
        const moved = Math.hypot(p.x - dragging.startX, p.y - dragging.startY) > TAP_THRESHOLD;
        if (!moved) return;
        stopLongPress();
        dragging = { mode: 'pan', startX: dragging.startX, startY: dragging.startY, ox: dragging.ox, oy: dragging.oy };
        canvas.style.cursor = 'grabbing';
    }

    if (dragging.mode === 'pan') {
        stopLongPress();
        view.ox = dragging.ox + (p.x - dragging.startX);
        view.oy = dragging.oy + (p.y - dragging.startY);
        draw();
        debouncedSaveView();
    } else if (dragging.mode === 'point') {
        stopLongPress();
        const wpt = screenToWorld(p.x, p.y, view);
        const px = clamp(Math.round(metersToPercent(wpt.x, MAP.size) * 100) / 100, 0, 100);
        const py = clamp(Math.round(metersToPercent(wpt.y, MAP.size) * 100) / 100, 0, 100);
        setPoint(dragging.key, percentToMeters(px, MAP.size), percentToMeters(py, MAP.size));
    }
});

function onPointerUp(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) { }

    stopLongPress();

    if (pinch) {
        if (pointers.size >= 2) return;
        pinch = null;
        if (pointers.size === 1) {
            const [rest] = [...pointers.values()];
            dragging = { mode: 'pan', startX: rest.x, startY: rest.y, ox: view.ox, oy: view.oy };
        } else {
            dragging = null;
        }
        return;
    }

    if (dragging && dragging.mode === 'tower-or-pan' && !longPressFired && e.button === 0) {
        const p = canvasPos(e);
        if (findTowerAt(p.x, p.y) === dragging.tower) {
            selectedTower = (selectedTower === dragging.tower) ? null : dragging.tower;
            draw();
        }
    }
    longPressFired = false;

    if (pointers.size === 0) {
        dragging = null;
        canvas.style.cursor = 'crosshair';
    }
}
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('pointercancel', onPointerUp);

window.addEventListener('blur', () => {
    pointers.clear();
    pinch = null;
    dragging = null;
    stopLongPress();
    longPressFired = false;
    canvas.style.cursor = 'crosshair';
});

canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * 0.0015);
    const newScale = clamp(view.scale * factor, 0.005, 1);
    const wpt = screenToWorld(e.offsetX, e.offsetY, view);
    view.scale = newScale;
    view.ox = e.offsetX - wpt.x * view.scale;
    view.oy = e.offsetY + wpt.y * view.scale;
    draw();
    debouncedSaveView();
}, { passive: false });

canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    const fromTouch = performance.now() - lastTouchTs < 1000;
    if (fromTouch && longPressFired) return;
    stopLongPress();
    const p = canvasPos(e);
    openMenuAt(p.x, p.y);
});

menu.addEventListener('click', e => {
    const action = e.target.dataset.action;
    if (!action) return;
    if (action === 'setA') setPoint('A', menuWorld.x, menuWorld.y);
    if (action === 'setB') setPoint('B', menuWorld.x, menuWorld.y);
    if (action === 'delete') setPoint(menuPointKey, null);
    hideMenu();
});

function hideMenu() { menu.classList.add('hidden'); }
window.addEventListener('pointerdown', e => { if (!menu.contains(e.target)) hideMenu(); });
window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        hideMenu();
        openHelp(false);
    }
});

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
    draw();
    AppStorage.saveState(pointA, pointB, view, MAP.size);
    setTimeout(() => AppShare.showToast(STR.shareApplied, 'success'), 400);
    history.replaceState({}, '', location.pathname);
}

document.getElementById('shareBtn').addEventListener('click', copyShareLink);

const weaponRadios = document.querySelectorAll('input[name="weapon"]');
weaponRadios.forEach(radio => {
    if (radio.value === currentWeapon) radio.checked = true;
    radio.addEventListener('change', (e) => {
        currentWeapon = e.target.value;
        AppStorage.saveWeapon(currentWeapon);
        recalc();
        draw();
    });
});

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
draw();
applyTheme();