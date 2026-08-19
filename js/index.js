'use strict';

const MAP = { size: 16000 };
const ZONE = { cx: 8240, cy: 7330, r: 1000 };

const TOWERS = [
    { x: 51.59, y: 44.61, name: 'tower1' },
    { x: 47.86, y: 44.77, name: 'tower2' },
    { x: 47.86, y: 48.62, name: 'tower3' },
    { x: 55.07, y: 48.00, name: 'tower4' },
    { x: 53.50, y: 43.01, name: 'tower5' },
];

const NBSP = '\u00A0';

const MORTAR_TABLE = [
    { mils: 290, dist: 700 },
    { mils: 340, dist: 650 },
    { mils: 390, dist: 600 },
    { mils: 440, dist: 550 },
    { mils: 490, dist: 500 },
    { mils: 540, dist: 450 },
    { mils: 590, dist: 400 },
    { mils: 640, dist: 350 },
    { mils: 690, dist: 300 },
    { mils: 700, dist: 290 },
    { mils: 750, dist: 240 },
    { mils: 800, dist: 187 },
    { mils: 850, dist: 132 },
    { mils: 900, dist: 110 },
];

const ARTILLERY_TABLE = [
    { mils: 290, dist: 2500 },
    { mils: 900, dist: 2352 },
    { mils: 910, dist: 2331 },
    { mils: 920, dist: 2310 },
    { mils: 930, dist: 2289 },
    { mils: 940, dist: 2268 },
    { mils: 950, dist: 2247 },
    { mils: 960, dist: 2226 },
    { mils: 970, dist: 2204 },
    { mils: 980, dist: 2182 },
    { mils: 990, dist: 2160 },
    { mils: 1000, dist: 2138 },
];

const WEAPONS = {
    mortar: {
        milsTable: MORTAR_TABLE,
        step: 50,
        v0: 290 / (22 * Math.cos(700 / 1000)),
        maxRange: 700,
        rangeColor: '#5ba8d3'
    },
    artillery: {
        milsTable: ARTILLERY_TABLE,
        step: 10,
        v0: 2500 / (12 * Math.cos(290 / 1000)),
        maxRange: 2500,
        rangeColor: '#5ba8d3'
    }
};

const TILES = {
    maxZoom: 5,
    size: 256,
    path: (z, x, y) => `maps/tiles/zoom_${z}/${x}_${y}.webp`,
};

const TILE_CACHE_MAX = 500;
const tileCache = new Map();

const INPUT_DEBOUNCE_MS = 80;
const TAP_THRESHOLD = 5;
const LONG_PRESS_MS = 500;

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

let showTowers = localStorage.getItem('wardogs_towers') !== '0';
let selectedTower = null;
let currentWeapon = localStorage.getItem('wardogs_weapon') || 'mortar';
let theme = localStorage.getItem('wardogs_theme') || 'dark';

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

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function percentToMeters(percent) {
    return (percent * MAP.size) / 100;
}

function metersToPercent(meters) {
    return (meters * 100) / MAP.size;
}

function formatPercent(v) {
    return v.toFixed(2);
}

function worldToScreen(wx, wy) {
    return { x: wx * view.scale + view.ox, y: -wy * view.scale + view.oy };
}

function screenToWorld(sx, sy) {
    return { x: (sx - view.ox) / view.scale, y: (view.oy - sy) / view.scale };
}

function fmtWithNbsp(num) {
    return String(Math.round(num)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

function fmtCoord(meters, step) {
    if (step >= 1000) {
        const km = meters / 1000;
        const v = Number.isInteger(km) ? String(km) : km.toFixed(1);
        return v + NBSP + STR.u_km;
    }
    return Math.round(meters) + NBSP + STR.u_m;
}

function fmtDist(d) {
    return fmtWithNbsp(d) + NBSP + STR.u_m;
}

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

    const a = screenToWorld(0, 0), b = screenToWorld(w, h);
    const x0 = Math.max(0, Math.floor((a.x / MAP.size) * tps));
    const x1 = Math.min(tps - 1, Math.floor((b.x / MAP.size) * tps));
    const y0 = Math.max(0, Math.floor(((MAP.size - a.y) / MAP.size) * tps));
    const y1 = Math.min(tps - 1, Math.floor(((MAP.size - b.y) / MAP.size) * tps));

    for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
            const wx0 = (tx / tps) * MAP.size;
            const wy0 = MAP.size - (ty / tps) * MAP.size;
            const s = worldToScreen(wx0, wy0);
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

const I18N_STRINGS = {
    title: 'Миномётный калькулятор',
    posA: 'Огневая позиция (A)',
    posB: 'Цель (B)',
    dist: 'Дистанция',
    az: 'Азимут',
    el: 'Угол возвышения',
    time: 'Время подлёта',
    controlsTitle: 'Настройки',
    weaponType: 'Тип орудия',
    weaponMortar: 'Миномёт (700 м)',
    weaponArtillery: 'Артиллерия (>2 км)',
    hint: 'ПКМ по карте — поставить или удалить точку.<br>ЛКМ — двигать карту (или саму точку).<br>Колесо мыши — масштаб.',
    reset: 'Сбросить вид',
    menuA: '📍 Позиция миномёта (A)',
    menuB: '🎯 Цель (B)',
    menuDel: '✕ Удалить точку',
    langLabel: 'Язык интерфейса',
    contactLabel: '✉️ Связь',
    oor: 'вне досягаемости',
    zero: 'точки совпадают',
    u_m: 'м',
    u_km: 'км',
    u_s: 'с',
    u_mil: 'mil',
    extra: 'Дополнительно',
    towers: 'Иконки вышек',
    discordTitle: 'Discord',
    discord: 'Wardogs СНГ / CIS',
    discordBtn: 'Перейти в Discord',
    tower1: 'Башня 1',
    tower2: 'Башня 2',
    tower3: 'Башня 3',
    tower4: 'Башня 4',
    tower5: 'Башня 5',
    helpTitle: 'Как пользоваться калькулятором',
    helpP1: '<b>Установка точек.</b> Укажите свою позицию (точка A) и цель (точка B) — калькулятор рассчитает дистанцию, азимут, угол возвышения и время подлёта снаряда.',
    helpP2: '<b>Работа с картой.</b> Правый клик по карте открывает меню. Левая кнопка мыши перемещает карту. Колесо мыши изменяет масштаб. На сенсорных экранах: один палец — перемещение, два пальца — масштаб, долгое нажатие — контекстное меню.',
    helpP3: '<b>Координаты.</b> X и Y вводятся в процентах карты (0–100). Значения можно ввести вручную или поставить точки прямо на карте.',
    helpP4: '<b>Результаты.</b> Дистанция, азимут от севера, угол ствола в mils, время подлёта. Если цель вне досягаемости — соответствующее сообщение.',
    helpP5: '<b>Сохранение.</b> Все данные автоматически сохраняются и восстанавливаются после перезагрузки страницы.',
    helpP6: '<b>О калькуляторе.</b> Фан-инструмент для игры WARDOGS. Неофициальный проект, не аффилирован с разработчиками игры.',
    share: 'Поделиться',
    shareCopied: 'Ссылка скопирована!',
    shareApplied: 'Координаты применены из ссылки',
};

const DYNAMIC_KEYS = [
    'oor', 'zero', 'u_m', 'u_km', 'u_s', 'u_mil',
    'tower1', 'tower2', 'tower3', 'tower4', 'tower5',
    'share', 'shareCopied', 'shareApplied'
];

const STR = { ...I18N_STRINGS };

const HTML_KEYS = new Set([
    'hint',
    'helpP1', 'helpP2', 'helpP3', 'helpP4', 'helpP5', 'helpP6'
]);

function applyDict(dict) {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if (dict[key] === undefined) return;
        if (HTML_KEYS.has(key)) {
            el.innerHTML = dict[key];
        } else {
            el.textContent = dict[key];
        }
    });
    DYNAMIC_KEYS.forEach(k => { if (dict[k]) STR[k] = dict[k]; });
    recalc();
    draw();
}

function translateUI(lang) {
    const dict = (typeof I18N !== 'undefined' && I18N[lang]) ? I18N[lang] : I18N_STRINGS;
    applyDict(dict);
}

langSelect.addEventListener('change', () => {
    const lang = langSelect.value;
    localStorage.setItem('wardogs_lang', lang);
    translateUI(lang);
});

let saveViewTimer = null;
function debouncedSaveView() {
    clearTimeout(saveViewTimer);
    saveViewTimer = setTimeout(saveState, 200);
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
    localStorage.setItem('wardogs_towers', showTowers ? '1' : '0');
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
    localStorage.setItem('wardogs_theme', theme);
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
        const s = worldToScreen(p.x, p.y);
        if (Math.hypot(s.x - sx, s.y - sy) <= 12) return key;
    }
    return null;
}

function findTowerAt(sx, sy) {
    if (!showTowers) return null;
    const halfSize = getTowerIconSize() / 2;
    for (const p of TOWERS) {
        const s = worldToScreen(percentToMeters(p.x), percentToMeters(p.y));
        if (Math.abs(s.x - sx) <= halfSize && Math.abs(s.y - sy) <= halfSize) {
            return p;
        }
    }
    return null;
}

function drawRangeCircle() {
    if (!pointA) return;

    const weapon = WEAPONS[currentWeapon];
    if (!weapon || !weapon.maxRange) return;

    const sa = worldToScreen(pointA.x, pointA.y);
    const radiusPx = weapon.maxRange * view.scale;
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

    const label = currentWeapon === 'mortar'
        ? '700' + NBSP + STR.u_m
        : '2.5' + NBSP + STR.u_km;
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

    const m0 = worldToScreen(0, 0);
    const m1 = worldToScreen(MAP.size, MAP.size);
    ctx.fillStyle = c.mapBg;
    ctx.fillRect(m0.x, m1.y, m1.x - m0.x, m0.y - m1.y);

    drawTiles();

    const step = niceStep(), minor = step / 5;
    const a = screenToWorld(0, 0), b = screenToWorld(w, h);
    const minX = a.x, maxX = b.x, minY = b.y, maxY = a.y;
    ctx.lineWidth = 1;

    if (minor * view.scale >= 9) {
        ctx.strokeStyle = c.gridMinor;
        ctx.beginPath();
        for (let gx = Math.ceil(minX / minor) * minor; gx <= maxX; gx += minor) {
            const s = worldToScreen(gx, 0);
            ctx.moveTo(Math.round(s.x) + .5, 0); ctx.lineTo(Math.round(s.x) + .5, h);
        }
        for (let gy = Math.ceil(minY / minor) * minor; gy <= maxY; gy += minor) {
            const s = worldToScreen(0, gy);
            ctx.moveTo(0, Math.round(s.y) + .5); ctx.lineTo(w, Math.round(s.y) + .5);
        }
        ctx.stroke();
    }

    ctx.strokeStyle = c.gridMajor;
    ctx.beginPath();
    for (let gx = Math.ceil(minX / step) * step; gx <= maxX; gx += step) {
        const s = worldToScreen(gx, 0);
        ctx.moveTo(Math.round(s.x) + .5, 0); ctx.lineTo(Math.round(s.x) + .5, h);
    }
    for (let gy = Math.ceil(minY / step) * step; gy <= maxY; gy += step) {
        const s = worldToScreen(0, gy);
        ctx.moveTo(0, Math.round(s.y) + .5); ctx.lineTo(w, Math.round(s.y) + .5);
    }
    ctx.stroke();

    ctx.strokeStyle = c.axes;
    ctx.beginPath();
    const zero = worldToScreen(0, 0);
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

    const zc = worldToScreen(ZONE.cx, ZONE.cy);
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
        ctx.fillText(fmtCoord(gx, step), worldToScreen(gx, 0).x + 4, h - 6);
    for (let gy = Math.ceil(minY / step) * step; gy <= maxY; gy += step)
        ctx.fillText(fmtCoord(gy, step), 4, worldToScreen(0, gy).y - 4);

    if (pointA && pointB) {
        const sa = worldToScreen(pointA.x, pointA.y);
        const sb = worldToScreen(pointB.x, pointB.y);
        ctx.strokeStyle = c.line;
        ctx.setLineDash([6, 6]);
        ctx.beginPath(); ctx.moveTo(sa.x, sa.y); ctx.lineTo(sb.x, sb.y); ctx.stroke();
        ctx.setLineDash([]);
        const d = Math.hypot(pointB.x - pointA.x, pointB.y - pointA.y);
        ctx.fillStyle = c.line;
        ctx.font = '12px monospace';
        ctx.fillText(fmtDist(d), (sa.x + sb.x) / 2 + 8, (sa.y + sb.y) / 2 - 8);
    }

    drawRangeCircle();

    if (pointA) drawPoint(pointA, '#7bc95e', 'A');
    if (pointB) drawPoint(pointB, '#e05656', 'B');
}

function drawPoint(p, color, label) {
    const s = worldToScreen(p.x, p.y);
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
    const wx = percentToMeters(p.x), wy = percentToMeters(p.y);
    const s = worldToScreen(wx, wy);
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
    syncInputs(); recalc(); draw(); saveState();
}

function syncInputs() {
    if (pointA) {
        inputs.ax.value = formatPercent(metersToPercent(pointA.x));
        inputs.ay.value = formatPercent(metersToPercent(pointA.y));
    } else {
        inputs.ax.value = ''; inputs.ay.value = '';
    }
    if (pointB) {
        inputs.bx.value = formatPercent(metersToPercent(pointB.x));
        inputs.by.value = formatPercent(metersToPercent(pointB.y));
    } else {
        inputs.bx.value = ''; inputs.by.value = '';
    }
}

function readPoint(ix, iy) {
    const px = parseFloat(ix.value), py = parseFloat(iy.value);
    if (isNaN(px) || isNaN(py)) return null;
    return {
        x: percentToMeters(clamp(px, 0, 100)),
        y: percentToMeters(clamp(py, 0, 100))
    };
}

function onInputImmediate() {
    pointA = readPoint(inputs.ax, inputs.ay);
    pointB = readPoint(inputs.bx, inputs.by);
    recalc(); draw(); saveState();
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

function distToMils(dist, table) {
    if (!table || table.length === 0) return null;

    if (dist > table[0].dist) return null;

    if (dist <= table[table.length - 1].dist) {
        return table[table.length - 1].mils;
    }

    for (let i = 0; i < table.length - 1; i++) {
        const p1 = table[i];
        const p2 = table[i + 1];

        if (dist <= p1.dist && dist >= p2.dist) {
            const range = p1.dist - p2.dist;
            const t = range > 0 ? (p1.dist - dist) / range : 0;
            return Math.round(p1.mils + t * (p2.mils - p1.mils));
        }
    }

    return null;
}

function recalc() {
    out.el.classList.remove('oor', 'warn');
    out.dist.classList.remove('oor', 'warn');

    if (!pointA || !pointB) {
        out.dist.textContent = out.az.textContent = out.el.textContent = out.time.textContent = '—';
        return;
    }

    const dx = pointB.x - pointA.x, dy = pointB.y - pointA.y;
    const dist = Math.hypot(dx, dy);
    const az = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
    out.dist.textContent = fmtDist(dist);
    out.az.textContent = az.toFixed(1) + '°';

    if (dist < 0.001) {
        out.el.textContent = STR.zero;
        out.el.classList.add('warn');
        out.time.textContent = '—';
        return;
    }

    const weapon = WEAPONS[currentWeapon];
    const { milsTable, step, v0 } = weapon;

    const milsExact = distToMils(dist, milsTable);

    if (milsExact === null) {
        out.el.textContent = STR.oor;
        out.el.classList.add('oor');
        out.time.textContent = '—';
        return;
    }

    const isExactInTable = milsTable.some(p => p.mils === milsExact);
    const mils = isExactInTable ? milsExact : Math.round(milsExact / step) * step;

    const theta = mils / 1000;
    const flightTime = dist / (v0 * Math.cos(theta));

    out.el.textContent = mils + NBSP + STR.u_mil;
    out.time.textContent = (isFinite(flightTime) ? flightTime.toFixed(1) : '—') + NBSP + STR.u_s;
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
    menuWorld = screenToWorld(sx, sy);
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
            anchor: screenToWorld(mid.x, mid.y),
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
        const wpt = screenToWorld(p.x, p.y);
        const px = clamp(Math.round(metersToPercent(wpt.x) * 100) / 100, 0, 100);
        const py = clamp(Math.round(metersToPercent(wpt.y) * 100) / 100, 0, 100);
        setPoint(dragging.key, percentToMeters(px), percentToMeters(py));
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
    const wpt = screenToWorld(e.offsetX, e.offsetY);
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

let toastTimer = null;

function showToast(message, type = 'success') {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        document.querySelector('.map-wrap').appendChild(toast);
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

function generateShareUrl() {
    const params = new URLSearchParams();
    if (pointA) {
        params.set('ax', metersToPercent(pointA.x).toFixed(2));
        params.set('ay', metersToPercent(pointA.y).toFixed(2));
    }
    if (pointB) {
        params.set('bx', metersToPercent(pointB.x).toFixed(2));
        params.set('by', metersToPercent(pointB.y).toFixed(2));
    }
    params.set('w', currentWeapon);
    return location.origin + location.pathname + '?' + params.toString();
}

async function copyShareLink() {
    const url = generateShareUrl();
    try {
        await navigator.clipboard.writeText(url);
        showToast(STR.shareCopied, 'success');
    } catch (e) {
        const input = document.createElement('input');
        input.value = url;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        showToast(STR.shareCopied, 'success');
    }
}

function applySharedParams() {
    const params = new URLSearchParams(location.search);
    let applied = false;

    if (params.has('ax') && params.has('ay')) {
        const ax = parseFloat(params.get('ax'));
        const ay = parseFloat(params.get('ay'));
        if (!isNaN(ax) && !isNaN(ay)) {
            pointA = {
                x: percentToMeters(clamp(ax, 0, 100)),
                y: percentToMeters(clamp(ay, 0, 100))
            };
            applied = true;
        }
    }

    if (params.has('bx') && params.has('by')) {
        const bx = parseFloat(params.get('bx'));
        const by = parseFloat(params.get('by'));
        if (!isNaN(bx) && !isNaN(by)) {
            pointB = {
                x: percentToMeters(clamp(bx, 0, 100)),
                y: percentToMeters(clamp(by, 0, 100))
            };
            applied = true;
        }
    }

    if (params.has('w')) {
        const w = params.get('w');
        if (w === 'mortar' || w === 'artillery') {
            currentWeapon = w;
            localStorage.setItem('wardogs_weapon', w);
            document.querySelectorAll('input[name="weapon"]').forEach(r => {
                r.checked = r.value === w;
            });
            applied = true;
        }
    }

    if (applied) {
        syncInputs();
        recalc();
        draw();
        saveState();
        setTimeout(() => showToast(STR.shareApplied, 'success'), 400);
        history.replaceState({}, '', location.pathname);
    }
}

document.getElementById('shareBtn').addEventListener('click', copyShareLink);

function saveState() {
    const state = {
        pointA: pointA ? {
            px: metersToPercent(pointA.x),
            py: metersToPercent(pointA.y)
        } : null,
        pointB: pointB ? {
            px: metersToPercent(pointB.x),
            py: metersToPercent(pointB.y)
        } : null,
        view: { scale: view.scale, ox: view.ox, oy: view.oy }
    };
    try {
        localStorage.setItem('wardogs_mortar_state', JSON.stringify(state));
    } catch (e) {
        console.warn('Failed to save state:', e);
    }
}

function loadState() {
    const saved = localStorage.getItem('wardogs_mortar_state');
    if (!saved) return false;
    try {
        const state = JSON.parse(saved);
        if (state.pointA) {
            pointA = {
                x: percentToMeters(state.pointA.px),
                y: percentToMeters(state.pointA.py)
            };
        }
        if (state.pointB) {
            pointB = {
                x: percentToMeters(state.pointB.px),
                y: percentToMeters(state.pointB.py)
            };
        }
        if (state.view) {
            view.scale = state.view.scale;
            view.ox = state.view.ox;
            view.oy = state.view.oy;
        }
        syncInputs();
        recalc();
        return true;
    } catch (e) {
        console.warn('Failed to load state:', e);
        return false;
    }
}

const weaponRadios = document.querySelectorAll('input[name="weapon"]');
weaponRadios.forEach(radio => {
    if (radio.value === currentWeapon) radio.checked = true;
    radio.addEventListener('change', (e) => {
        currentWeapon = e.target.value;
        localStorage.setItem('wardogs_weapon', currentWeapon);
        recalc();
        draw();
    });
});

function initLang() {
    const lang = localStorage.getItem('wardogs_lang') || 'ru';
    langSelect.value = lang;
    translateUI(lang);
}

resize();
const loaded = loadState();
applySharedParams();
if (!loaded) resetView();
draw();
applyTheme();
initLang();