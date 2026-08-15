'use strict';

/* ===== КАРТА WARDOGS =====
   256 км² = квадрат 16 × 16 км */
const MAP = { size: 16000 }; // размер в метрах

/* Зона контроля — круг Ø 2 км (радиус 1 км) в центре */
const ZONE = { cx: 8000, cy: 8000, r: 1000 };

/* ===== БАЛЛИСТИКА =====
   TODO: после релиза заменить на реальные значения игры */
const MORTAR = { v0: 240, g: 9.8 };

/* ===== ТАЙЛЫ КАРТЫ (скачаны с metaforge.app) =====
   Пирамида: zoom_N содержит 2^N × 2^N тайлов размером size×size */
const TILES = {
    maxZoom: 5,
    size: 256, // если тайлы 512×512 — поставьте 512
    path: (z, x, y) => `tiles/zoom_${z}/${x}_${y}.webp`,
};
const tileCache = new Map();

function getTile(z, x, y) {
    const key = `${z}/${x}_${y}`;
    let t = tileCache.get(key);
    if (!t) {
        const img = new Image();
        t = { img, loaded: false, error: false };
        img.onload = () => { t.loaded = true; draw(); };
        img.onerror = () => { t.error = true; };
        img.src = TILES.path(z, x, y);
        tileCache.set(key, t);
    }
    return t;
}

/* Отрисовка видимых тайлов, стык в стык, с автоподбором уровня зума */
function drawTiles() {
    const w = canvas.clientWidth, h = canvas.clientHeight;

    // уровень пирамиды, ближайший к текущему масштабу экрана
    const z = Math.max(0, Math.min(TILES.maxZoom,
        Math.round(Math.log2((view.scale * MAP.size) / TILES.size))));
    const tps = 2 ** z;                                  // тайлов на сторону
    const tileScale = (tps * TILES.size) / MAP.size;     // px на метр у этого зума
    const drawSize = TILES.size * (view.scale / tileScale);

    // видимая область в мировых координатах
    const a = screenToWorld(0, 0), b = screenToWorld(w, h);

    // индексы тайлов (y в именах файлов идёт сверху вниз: ty=0 — верх карты)
    const x0 = Math.max(0, Math.floor((a.x / MAP.size) * tps));
    const x1 = Math.min(tps - 1, Math.floor((b.x / MAP.size) * tps));
    const y0 = Math.max(0, Math.floor(((MAP.size - a.y) / MAP.size) * tps));
    const y1 = Math.min(tps - 1, Math.floor(((MAP.size - b.y) / MAP.size) * tps));

    for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
            // мировой левый-верхний угол тайла
            const wx0 = (tx / tps) * MAP.size;
            const wy0 = MAP.size - (ty / tps) * MAP.size;
            const s = worldToScreen(wx0, wy0);
            const t = getTile(z, tx, ty);
            if (t.loaded) {
                // +0.5 px — убирает волосяные щели между тайлами
                ctx.drawImage(t.img, s.x, s.y, drawSize + 0.5, drawSize + 0.5);
            } else if (!t.error) {
                ctx.fillStyle = '#161d25'; // заглушка, пока грузится
                ctx.fillRect(s.x, s.y, drawSize, drawSize);
            }
        }
    }
}

/* ===== DOM ===== */
const canvas = document.getElementById('map');
const ctx = canvas.getContext('2d');
const menu = document.getElementById('ctxMenu');
const langSelect = document.getElementById('langSelect');
const inputs = {
    ax: document.getElementById('ax'), ay: document.getElementById('ay'),
    bx: document.getElementById('bx'), by: document.getElementById('by'),
};
const out = {
    dist: document.getElementById('dist'), az: document.getElementById('azimuth'),
    el: document.getElementById('elevation'), time: document.getElementById('flightTime'),
};

/* ===== ПЕРЕВОД ИНТЕРФЕЙСА (I18N) =====
   Эти строки — дефолтные на русском. Они же являются fallback
   на случай если словарь не найден. */
const I18N_STRINGS = {
    title: 'Миномётный калькулятор',
    posA: 'Огневая позиция (A)',
    posB: 'Цель (B)',
    dist: 'Дистанция',
    az: 'Азимут',
    el: 'Угол возвышения',
    time: 'Время подлёта',
    hint: 'ПКМ по карте — поставить или удалить точку.<br>ЛКМ — двигать карту (или саму точку).<br>Колесо мыши — масштаб.',
    reset: 'Сбросить вид',
    menuA: '📍 Позиция миномёта (A)',
    menuB: '🎯 Цель (B)',
    menuDel: '✕ Удалить точку',
    langLabel: 'Язык интерфейса',
    contactLabel: '✉️ Связь',
    oor: 'вне досягаемости',
    u_m: 'м',
    u_km: 'км',
    u_s: 'с',
};
const DYNAMIC_KEYS = ['oor', 'u_m', 'u_km', 'u_s'];
const STR = { ...I18N_STRINGS }; // активные строки текущего языка

/* ===== СОСТОЯНИЕ ===== */
const view = { scale: 0.05, ox: 0, oy: 0 };
let pointA = null; // в метрах
let pointB = null; // в метрах
let menuWorld = null;
let menuPointKey = null;
let dragging = null;

/* ===== ДЕБАУНС СОХРАНЕНИЯ ===== */
let saveViewTimer = null;
function debouncedSaveView() {
    clearTimeout(saveViewTimer);
    saveViewTimer = setTimeout(saveState, 200);
}

/* ===== ПЕРЕКОНВЕРТАЦИЯ: проценты (0-100) ↔ метры ===== */
function percentToMeters(percent) {
    return (percent * MAP.size) / 100;
}

function metersToPercent(meters) {
    return (meters * 100) / MAP.size;
}

function formatPercent(v) {
    return v.toFixed(2);
}

/* ===== КООРДИНАТНЫЕ СИСТЕМЫ ===== */
function worldToScreen(wx, wy) { return { x: wx * view.scale + view.ox, y: -wy * view.scale + view.oy }; }
function screenToWorld(sx, sy) { return { x: (sx - view.ox) / view.scale, y: (view.oy - sy) / view.scale }; }

/* ===== CANVAS ===== */
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

/* ===== ФОРМАТИРОВАНИЕ ===== */
function niceStep() {
    const raw = 70 / view.scale;
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    for (const m of [1, 2, 5, 10]) if (m * pow >= raw) return m * pow;
    return 10 * pow;
}

function fmtCoord(meters, step) {
    if (step >= 1000) {
        const km = meters / 1000;
        return (Number.isInteger(km) ? String(km) : km.toFixed(1)) + ' ' + STR.u_km;
    }
    return Math.round(meters) + ' ' + STR.u_m;
}

function fmtDist(d) {
    return d >= 1000 ? (d / 1000).toFixed(2) + ' ' + STR.u_km : Math.round(d) + ' ' + STR.u_m;
}

/* ===== ОТРИСОВКА ===== */
function draw() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.fillStyle = '#10151b';
    ctx.fillRect(0, 0, w, h);

    // квадрат карты 16 × 16 км (фон)
    const m0 = worldToScreen(0, 0);
    const m1 = worldToScreen(MAP.size, MAP.size);
    ctx.fillStyle = '#161d25';
    ctx.fillRect(m0.x, m1.y, m1.x - m0.x, m0.y - m1.y);

    // тайлы карты (под сеткой)
    drawTiles();

    const step = niceStep(), minor = step / 5;
    const a = screenToWorld(0, 0), b = screenToWorld(w, h);
    const minX = a.x, maxX = b.x, minY = b.y, maxY = a.y;
    ctx.lineWidth = 1;

    // мелкая сетка
    if (minor * view.scale >= 9) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
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

    // основная сетка
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
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

    // оси X=0 и Y=0
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath();
    const zero = worldToScreen(0, 0);
    ctx.moveTo(zero.x + .5, 0); ctx.lineTo(zero.x + .5, h);
    ctx.moveTo(0, zero.y + .5); ctx.lineTo(w, zero.y + .5);
    ctx.stroke();

    // затемнение за пределами карты
    ctx.fillStyle = 'rgba(6, 8, 12, 0.55)';
    ctx.fillRect(0, 0, w, m1.y);
    ctx.fillRect(0, m0.y, w, h - m0.y);
    ctx.fillRect(0, m1.y, m0.x, m0.y - m1.y);
    ctx.fillRect(m1.x, m1.y, w - m1.x, m0.y - m1.y);

    // граница карты
    ctx.strokeStyle = '#46536b';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(m0.x, m1.y, m1.x - m0.x, m0.y - m1.y);
    ctx.lineWidth = 1;

    // зона контроля — круг Ø 2 км
    const zc = worldToScreen(ZONE.cx, ZONE.cy);
    ctx.beginPath();
    ctx.arc(zc.x, zc.y, ZONE.r * view.scale, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(159, 211, 86, 0.05)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(159, 211, 86, 0.55)';
    ctx.setLineDash([10, 6]);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 1;

    // подписи координат
    ctx.fillStyle = '#5c6875';
    ctx.font = '11px monospace';
    for (let gx = Math.ceil(minX / step) * step; gx <= maxX; gx += step)
        ctx.fillText(fmtCoord(gx, step), worldToScreen(gx, 0).x + 4, h - 6);
    for (let gy = Math.ceil(minY / step) * step; gy <= maxY; gy += step)
        ctx.fillText(fmtCoord(gy, step), 4, worldToScreen(0, gy).y - 4);

    // линия A → B
    if (pointA && pointB) {
        const sa = worldToScreen(pointA.x, pointA.y);
        const sb = worldToScreen(pointB.x, pointB.y);
        ctx.strokeStyle = '#e8c35a';
        ctx.setLineDash([6, 6]);
        ctx.beginPath(); ctx.moveTo(sa.x, sa.y); ctx.lineTo(sb.x, sb.y); ctx.stroke();
        ctx.setLineDash([]);
        const d = Math.hypot(pointB.x - pointA.x, pointB.y - pointA.y);
        ctx.fillStyle = '#e8c35a';
        ctx.font = '12px monospace';
        ctx.fillText(fmtDist(d), (sa.x + sb.x) / 2 + 8, (sa.y + sb.y) / 2 - 8);
    }

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
    ctx.fillText(label, s.x + 11, s.y - 9);
}

/* ===== ТОЧКИ И ФОРМА ===== */
function setPoint(key, x, y) {
    const p = (x === null) ? null : { x, y };
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

function onInput() {
    pointA = readPair(inputs.ax, inputs.ay);
    pointB = readPair(inputs.bx, inputs.by);
    recalc(); draw(); saveState();
}

function readPair(ix, iy) {
    const px = parseFloat(ix.value), py = parseFloat(iy.value);
    if (isNaN(px) || isNaN(py)) return null;
    return { x: percentToMeters(px), y: percentToMeters(py) };
}

Object.values(inputs).forEach(i => i.addEventListener('input', onInput));
document.getElementById('clearA').onclick = () => setPoint('A', null);
document.getElementById('clearB').onclick = () => setPoint('B', null);

/* ===== РАСЧЁТ ===== */
function recalc() {
    if (!pointA || !pointB) {
        out.dist.textContent = out.az.textContent = out.el.textContent = out.time.textContent = '—';
        return;
    }
    const dx = pointB.x - pointA.x, dy = pointB.y - pointA.y;
    const dist = Math.hypot(dx, dy);
    const az = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
    out.dist.textContent = fmtDist(dist);
    out.az.textContent = az.toFixed(1) + '°';

    const { v0, g } = MORTAR;
    const v2 = v0 * v0;
    const disc = v2 * v2 - g * g * dist * dist;
    if (dist === 0 || disc < 0) {
        out.el.textContent = STR.oor;
        out.time.textContent = '—';
        return;
    }
    const el = Math.atan((v2 - Math.sqrt(disc)) / (g * dist));
    out.el.textContent = (el * 180 / Math.PI).toFixed(1) + '°';
    out.time.textContent = (dist / (v0 * Math.cos(el))).toFixed(1) + ' ' + STR.u_s;
}

/* ===== МЫШЬ ===== */
function hitPoint(sx, sy) {
    for (const [key, p] of [['A', pointA], ['B', pointB]]) {
        if (!p) continue;
        const s = worldToScreen(p.x, p.y);
        if (Math.hypot(s.x - sx, s.y - sy) <= 10) return key;
    }
    return null;
}

canvas.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    hideMenu();
    const hit = hitPoint(e.offsetX, e.offsetY);
    dragging = hit
        ? { mode: 'point', key: hit }
        : { mode: 'pan', startX: e.offsetX, startY: e.offsetY, ox: view.ox, oy: view.oy };
    canvas.style.cursor = 'grabbing';
});

window.addEventListener('mousemove', e => {
    if (!dragging) return;
    const r = canvas.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    if (dragging.mode === 'pan') {
        view.ox = dragging.ox + (sx - dragging.startX);
        view.oy = dragging.oy + (sy - dragging.startY);
        draw();
        debouncedSaveView();
    } else {
        const wpt = screenToWorld(sx, sy);
        const px = metersToPercent(wpt.x);
        const py = metersToPercent(wpt.y);
        setPoint(dragging.key, percentToMeters(Math.round(px * 100) / 100), percentToMeters(Math.round(py * 100) / 100));
    }
});

window.addEventListener('mouseup', () => { dragging = null; canvas.style.cursor = 'crosshair'; });

canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * 0.0015);
    // ограничиваем зум сверху: 1 px/м — максимальный детальный уровень тайлов
    const newScale = Math.min(1, Math.max(0.005, view.scale * factor));
    const wpt = screenToWorld(e.offsetX, e.offsetY);
    view.scale = newScale;
    view.ox = e.offsetX - wpt.x * view.scale;
    view.oy = e.offsetY + wpt.y * view.scale;
    draw();
    debouncedSaveView();
}, { passive: false });

/* ===== КОНТЕКСТНОЕ МЕНЮ (ПКМ) ===== */
canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    menuWorld = screenToWorld(sx, sy);
    menuPointKey = hitPoint(sx, sy);
    document.getElementById('menuDelete').classList.toggle('hidden', !menuPointKey);
    menu.classList.remove('hidden');
    const wrap = canvas.parentElement.getBoundingClientRect();
    let left = e.clientX - wrap.left, top = e.clientY - wrap.top;
    if (left + menu.offsetWidth > wrap.width) left -= menu.offsetWidth;
    if (top + menu.offsetHeight > wrap.height) top -= menu.offsetHeight;
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
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
window.addEventListener('mousedown', e => { if (!menu.contains(e.target)) hideMenu(); });
window.addEventListener('keydown', e => { if (e.key === 'Escape') hideMenu(); });

/* ===== LOCALSTORAGE ===== */
function saveState() {
    const state = {
        pointA: pointA ? { px: metersToPercent(pointA.x), py: metersToPercent(pointA.y) } : null,
        pointB: pointB ? { px: metersToPercent(pointB.x), py: metersToPercent(pointB.y) } : null,
        view: { scale: view.scale, ox: view.ox, oy: view.oy }
    };
    localStorage.setItem('wardogs_mortar_state', JSON.stringify(state));
}

function loadState() {
    const saved = localStorage.getItem('wardogs_mortar_state');
    if (!saved) return false;
    try {
        const state = JSON.parse(saved);
        if (state.pointA) {
            pointA = { x: percentToMeters(state.pointA.px), y: percentToMeters(state.pointA.py) };
        }
        if (state.pointB) {
            pointB = { x: percentToMeters(state.pointB.px), y: percentToMeters(state.pointB.py) };
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

/* ===== ПРИМЕНЕНИЕ ПЕРЕВОДА К DOM ===== */
function applyDict(dict) {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if (dict[key] !== undefined) el.innerHTML = dict[key];
    });
    DYNAMIC_KEYS.forEach(k => { if (dict[k]) STR[k] = dict[k]; });
    recalc();
    draw();
}

/* ===== ПЕРЕКЛЮЧЕНИЕ ЯЗЫКА =====
   Переводы лежат в js/i18n.js (объект I18N).
   Работает без сервера — даже при открытии двойным кликом. */
function translateUI(lang) {
    const dict = (typeof I18N !== 'undefined' && I18N[lang]) ? I18N[lang] : I18N_STRINGS;
    applyDict(dict);
}

langSelect.addEventListener('change', () => {
    const lang = langSelect.value;
    localStorage.setItem('wardogs_lang', lang);
    translateUI(lang);
});

function initLang() {
    const lang = localStorage.getItem('wardogs_lang') || 'ru';
    langSelect.value = lang;
    translateUI(lang);
}

/* ===== СТАРТ ===== */
resize();
const loaded = loadState();
if (!loaded) resetView();
draw();
initLang();