/**
 *
 * Реализует тайловую подложку (как в Google Maps):
 * - Картинка карты разбита на квадратные тайлы (256×256 px)
 * - Тайлы загружаются по требованию и кэшируются в Map
 * - Автоматически определяет уровень зума по масштабу
 * - LRU-кэш: при переполнении удаляются старые тайлы
 *
 * Экспорт: window.MapTiles
 */

window.MapTiles = (function () {

    /** LRU-кэш загруженных тайлов: ключ → {img, loaded, error} */
    const tileCache = new Map();

    /** Максимальное количество тайлов в кэше (LRU eviction) */
    let cacheMax = 500;

    /**
     * Устанавливает максимальный размер кэша тайлов.
     * @param {number} max — макс. количество тайлов
     */
    function configure(max) {
        cacheMax = max;
    }

    /**
     * Полностью очищает кэш тайлов.
     * Освобождает память: обнуляет src и обработчики у Image.
     * Вызывается при смене карты.
     */
    function clearCache() {
        tileCache.forEach((t) => {
            if (t && t.img) {
                t.img.src = '';
                t.img.onload = null;
                t.img.onerror = null;
            }
        });
        tileCache.clear();
    }

    /**
     * Получает тайл из кэша или начинает его загрузку.
     *
     * Ключ кэша: "mapId/z/x_y" — чтобы тайлы разных карт не пересекались.
     * При попадании в кэш — перемещает тайл в конец (LRU refresh).
     * При превышении cacheMax — удаляет самый старый тайл.
     *
     * @param {number} z — уровень зума
     * @param {number} x — X-координата тайла
     * @param {number} y — Y-координата тайла
     * @param {object} tilesConfig — конфиг тайлов из CONFIG_APP (mapId, path)
     * @param {Function} [onLoaded] — колбэк при загрузке тайла (для перерисовки)
     * @returns {{img: HTMLImageElement, loaded: boolean, error: boolean}}
     */
    function getTile(z, x, y, tilesConfig, onLoaded) {
        const mapId = tilesConfig.mapId || 'default';
        const key = `${mapId}/${z}/${x}_${y}`;

        /** LRU: при попадании — перемещаем в конец Map (самый свежий) */
        let t = tileCache.get(key);
        if (t) {
            tileCache.delete(key);
            tileCache.set(key, t);
            return t;
        }

        /** Тайл не в кэше — создаём Image и начинаем загрузку */
        const img = new Image();
        t = { img, loaded: false, error: false };

        img.onload = () => {
            t.loaded = true;
            onLoaded && onLoaded(); /** Тайл загружен — перерисовываем карту */
        };
        img.onerror = () => { t.error = true; };

        /** Формируем URL через path() из конфига тайлов */
        const rel = tilesConfig.path(z, x, y);
        img.src = (window.AppUtils && window.AppUtils.assetUrl) ? window.AppUtils.assetUrl(rel) : rel;

        tileCache.set(key, t);

        /** LRU eviction: удаляем самый старый тайл при переполнении */
        if (tileCache.size > cacheMax) {
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

    /**
     * Отрисовывает видимые тайлы на canvas.
     *
     * Алгоритм:
     * 1. Вычисляет уровень зума (z) по масштабу и размеру тайла
     * 2. Определяет сетку тайлов, попадающих в видимую область (viewBox)
     * 3. Для каждого тайла: загружает из кэша и рисует на canvas
     * 4. Если тайл ещё грузится — рисует заглушку (фоновый цвет)
     *
     * @param {CanvasRenderingContext2D} ctx — контекст canvas
     * @param {HTMLCanvasElement} canvas — элемент canvas
     * @param {{scale: number, ox: number, oy: number}} view — объект камеры
     * @param {{size: number}} mapConfig — конфиг карты (size в метрах)
     * @param {object} tilesConfig — конфиг тайлов (maxZoom, size, path)
     * @param {object} themeColors — цвета темы (для заглушки)
     * @param {Function} [onTileLoaded] — колбэк при загрузке любого тайла
     */
    function drawTiles(ctx, canvas, view, mapConfig, tilesConfig, themeColors, onTileLoaded) {
        const w = canvas.clientWidth, h = canvas.clientHeight;
        const utils = window.AppUtils;

        /**
         * Вычисляем уровень зума:
         * z = log2(scale × mapSize / tileSize)
         * Ограничиваем в пределах [0, maxZoom]
         */
        const z = Math.max(0, Math.min(tilesConfig.maxZoom,
            Math.round(Math.log2((view.scale * mapConfig.size) / tilesConfig.size))));

        const tps = 2 ** z; /** Количество тайлов по одной оси (2^z) */

        /**
         * Масштаб тайлового слоя:
         * tileScale = (количество тайлов × размер тайла) / размер карты
         */
        const tileScale = (tps * tilesConfig.size) / mapConfig.size;

        /** Размер тайла на экране в пикселях */
        const drawSize = tilesConfig.size * (view.scale / tileScale);

        /** Преобразуем видимую область в мировые координаты */
        const a = utils.screenToWorld(0, 0, view);      /** Верхний-левый угол экрана */
        const b = utils.screenToWorld(w, h, view);      /** Нижний-правый угол экрана */

        /** Вычисляем диапазон индексов тайлов, попадающих в экран */
        const x0 = Math.max(0, Math.floor((a.x / mapConfig.size) * tps));
        const x1 = Math.min(tps - 1, Math.floor((b.x / mapConfig.size) * tps));
        const y0 = Math.max(0, Math.floor(((mapConfig.size - a.y) / mapConfig.size) * tps));
        const y1 = Math.min(tps - 1, Math.floor(((mapConfig.size - b.y) / mapConfig.size) * tps));

        /** Отрисовываем каждый видимый тайл */
        for (let ty = y0; ty <= y1; ty++) {
            for (let tx = x0; tx <= x1; tx++) {
                /** Мировые координаты верхнего-левого угла тайла */
                const wx0 = (tx / tps) * mapConfig.size;
                const wy0 = mapConfig.size - (ty / tps) * mapConfig.size;
                const s = utils.worldToScreen(wx0, wy0, view);

                const t = getTile(z, tx, ty, tilesConfig, onTileLoaded);

                if (t.loaded) {
                    /** Тайл загружен — рисуем (+0.5 для устранения зазоров) */
                    ctx.drawImage(t.img, s.x, s.y, drawSize + 0.5, drawSize + 0.5);
                } else if (!t.error) {
                    /** Тайл ещё грузится — рисуем заглушку фоновым цветом */
                    ctx.fillStyle = themeColors.mapBg;
                    ctx.fillRect(s.x, s.y, drawSize, drawSize);
                }
                /** Ошибка загрузки — пропускаем тайл */
            }
        }
    }

    return { configure, clearCache, getTile, drawTiles };
})();

/**
 *
 * Отрисовывает все визуальные слои карты (снизу вверх):
 * 1. Фон и область карты
 * 2. Тайловая подложка (MapTiles)
 * 3. Мелкая и крупная сетка с подписями координат
 * 4. Оси координат (0,0)
 * 5. Затемнение за пределами карты
 * 6. Граница карты
 * 7. Боевая зона (круг)
 * 8. Вышки (иконки)
 * 9. Рисунки пользователя
 * 10. Линия A→B с дистанцией
 * 11. Круг дальности оружия
 * 12. Точки A и B
 *
 * Зависимости: window.AppUtils, window.MapTiles
 * Экспорт: window.MapRenderer
 */

window.MapRenderer = (function (utils, tiles) {

    /** Цветовые палитры для тёмной и светлой тем */
    const CANVAS_THEMES = {
        dark: {
            bg: '#10151b',          /** Фон за пределами карты */
            mapBg: '#161d25',       /** Фон области карты */
            gridMinor: 'rgba(255, 255, 255, 0.10)',  /** Мелкая сетка */
            gridMajor: 'rgba(255, 255, 255, 0.28)',  /** Крупная сетка — контуры */
            axes: 'rgba(255, 255, 255, 0.35)',       /** Оси координат */
            dim: 'rgba(6, 8, 12, 0.55)',             /** Затемнение за картой */
            border: '#46536b',       /** Граница карты */
            labels: '#5c6875',       /** Подписи координат */
            line: '#e8c35a',         /** Линия A→B */
        },
        light: {
            bg: '#dfe5ec',
            mapBg: '#f2f5f8',
            gridMinor: 'rgba(15, 25, 40, 0.12)',
            gridMajor: 'rgba(15, 25, 40, 0.30)',
            axes: 'rgba(15, 25, 40, 0.40)',
            dim: 'rgba(255, 255, 255, 0.6)',
            border: '#7d8896',
            labels: '#5c6875',
            line: '#8a6d00',
        },
    };

    /**
     * Возвращает цвета темы по имени.
     * @param {string} theme — 'dark' | 'light'
     * @returns {object} палитра цветов
     */
    function getThemeColors(theme) { return CANVAS_THEMES[theme] || CANVAS_THEMES.dark; }

    /**
     * Вычисляет размер иконки вышки в пикселях.
     * Масштабируется с зумом, но с ограничениями [16, 30] px.
     *
     * @param {number} scale — текущий масштаб камеры
     * @returns {number} размер иконки в пикселях
     */
    function getTowerIconSize(scale) {
        return Math.max(16, Math.min(30, 22 * scale * 80));
    }

    /**
     * Вычисляет видимую область карты в мировых координатах (метры).
     * Используется для оптимизации отрисовки сетки (рисуем только видимое).
     *
     * @param {{scale: number, ox: number, oy: number}} view — камера
     * @param {number} w — ширина canvas (px)
     * @param {number} h — высота canvas (px)
     * @param {number} mapSize — размер карты (м)
     * @returns {{left, right, top, bottom}} границы видимой области
     */
    function getViewBox(view, w, h, mapSize) {
        const a = utils.screenToWorld(0, 0, view);
        const b = utils.screenToWorld(w, h, view);
        return {
            left: Math.max(0, Math.min(a.x, b.x)),
            right: Math.min(mapSize, Math.max(a.x, b.x)),
            top: Math.max(0, Math.min(a.y, b.y)),
            bottom: Math.min(mapSize, Math.max(a.y, b.y))
        };
    }

    /**
     * Возвращает шаги сетки в зависимости от масштаба.
     * Чем дальше (меньше scale) — тем реже сетка.
     *
     * - scale < 0.01  — далёкий зум: крупная сетка 2000 м, мелкая 200 м
     * - scale < 0.1   — средний зум: классические 1000 / 100 м
     * - scale >= 0.1  — близкий зум: мелкая сетка 50 м для детализации
     *
     * @param {number} scale — текущий масштаб камеры
     * @returns {{major: number, minor: number}} шаги в метрах
     */
    function getGridSteps(scale) {
        if (scale < 0.01) return { major: 2000, minor: 200 };
        if (scale >= 0.1) return { major: 1000, minor: 50 };
        return { major: 1000, minor: 100 };
    }

    // ═══════════════════════════════════════════════════════════
    //  Отрисовка отдельных элементов
    // ═══════════════════════════════════════════════════════════

    /**
     * Рисует точку (A или B) — кружок с обводкой и подписью.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {object} view — камера
     * @param {{x: number, y: number}} p — точка в мировых координатах
     * @param {string} color — HEX-цвет
     * @param {string} label — подпись ('A' или 'B')
     */
    function drawPoint(ctx, view, p, color, label) {
        const s = utils.worldToScreen(p.x, p.y, view);
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(s.x, s.y, 7, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        ctx.lineWidth = 1;
        ctx.fillStyle = color;
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(label, s.x + 11, s.y - 9);
    }

    /**
     * Рисует всплывающую подсказку (tooltip) для выбранной вышки.
     * Тёмный прямоугольник со стрелкой и локализованным именем.
     */
    function drawTowerTooltip(ctx, view, p, s, STR, themeColors) {
        const label = STR[p.name] || p.name;
        ctx.font = 'bold 12px sans-serif';
        const textWidth = ctx.measureText(label).width;
        const padX = 8;
        const w = textWidth + padX * 2;
        const h = 22;
        const x = s.x - w / 2;
        const y = s.y - getTowerIconSize(view.scale) / 2 - 28;

        /** Тень */
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(x + 2, y + 2, w, h);
        /** Фон */
        ctx.fillStyle = themeColors.mapBg || '#1a1f27';
        ctx.fillRect(x, y, w, h);
        /** Обводка */
        ctx.strokeStyle = themeColors.border || '#9fd356';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, h);
        /** Стрелка вниз */
        ctx.beginPath();
        ctx.moveTo(s.x - 6, y + h);
        ctx.lineTo(s.x + 6, y + h);
        ctx.lineTo(s.x, y + h + 6);
        ctx.closePath();
        ctx.fillStyle = themeColors.mapBg || '#1a1f27';
        ctx.fill();
        ctx.strokeStyle = themeColors.border || '#9fd356';
        ctx.stroke();
        /** Текст */
        ctx.fillStyle = themeColors.labels || '#e6e6e6';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, s.x, y + h / 2);
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
    }

    /**
     * Рисует одну вышку: иконку tower.webp (или fallback-кружок).
     * Если вышка выбрана — рисует tooltip.
     */
    function drawTower(ctx, view, p, towerIcon, selectedTower, STR, mapSize, themeColors) {
        const wx = utils.percentToMeters(p.x, mapSize);
        const wy = utils.percentToMeters(p.y, mapSize);
        const s = utils.worldToScreen(wx, wy, view);
        const iconSize = getTowerIconSize(view.scale);

        if (towerIcon.complete && towerIcon.naturalWidth > 0) {
            ctx.drawImage(towerIcon, s.x - iconSize / 2, s.y - iconSize / 2, iconSize, iconSize);
            if (selectedTower === p) drawTowerTooltip(ctx, view, p, s, STR, themeColors);
        } else {
            /** Fallback: оранжевый кружок если иконка не загрузилась */
            ctx.fillStyle = '#ff9d5c';
            ctx.beginPath(); ctx.arc(s.x, s.y, 6, 0, Math.PI * 2); ctx.fill();
        }
    }

    /**
     * Рисует круг дальности оружия вокруг точки A.
     * Полупрозрачная заливка + пунктирная обводка + подпись расстояния.
     */
    /**
     * Конвертирует HEX-цвет (#RRGGBB) в строку rgba().
     * Обеспечивает совместимость со старыми браузерами (не поддерживают 8-digit hex).
     *
     * @param {string} hex — HEX-цвет (например '#9fd356')
     * @param {number} a — альфа-канал [0, 1]
     * @returns {string} rgba()-строка
     */
    function hexToRgba(hex, a) {
        const h = hex.replace('#', '');
        const r = parseInt(h.substring(0, 2), 16);
        const g = parseInt(h.substring(2, 4), 16);
        const b = parseInt(h.substring(4, 6), 16);
        return `rgba(${r},${g},${b},${a})`;
    }

    function drawRangeCircle(ctx, view, pointA, weapon, STR) {
        if (!pointA) return;
        if (!weapon || !weapon.maxRangeKm) return;

        const maxRangeMeters = weapon.maxRangeKm * 1000;
        const sa = utils.worldToScreen(pointA.x, pointA.y, view);
        const radiusPx = maxRangeMeters * view.scale;
        const color = weapon.rangeColor || '#9fd356';

        /** Полупрозрачная заливка */
        ctx.beginPath();
        ctx.arc(sa.x, sa.y, radiusPx, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(color, 0.08); /** ~8% opacity */
        ctx.fill();

        /** Пунктирная обводка */
        ctx.strokeStyle = hexToRgba(color, 0.6); /** ~60% opacity */
        ctx.setLineDash([10, 6]);
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 1;

        /** Подпись расстояния (в м или км в зависимости от величины) */
        const label = weapon.maxRangeKm < 1
            ? Math.round(weapon.maxRangeKm * 1000) + utils.NBSP + STR.u_m
            : weapon.maxRangeKm.toFixed(1) + utils.NBSP + STR.u_km;
        ctx.fillStyle = color;
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(label, sa.x, sa.y - radiusPx - 4);
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
    }

    /**
     * Рисует маркер (метку) — пин с кругом и текстовой подписью.
     */
    function drawMarker(ctx, s, stroke) {
        const color = stroke.color || '#fff';
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 1.5;

        /** Круг (шляпка пина) */
        ctx.beginPath();
        ctx.arc(s.x, s.y - 6, 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(s.x, s.y - 6, 1.5, 0, Math.PI * 2);
        ctx.fill();

        /** Ножка пина */
        ctx.beginPath();
        ctx.moveTo(s.x - 3, s.y - 2);
        ctx.lineTo(s.x, s.y + 6);
        ctx.lineTo(s.x + 3, s.y - 2);
        ctx.stroke();

        /** Текстовая подпись (если есть) */
        if (stroke.label) {
            ctx.font = 'bold 11px sans-serif';
            const tw = ctx.measureText(stroke.label).width;
            const x = s.x + 9, y = s.y - 12;
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(x - 3, y - 8, tw + 6, 15);
            ctx.fillStyle = color;
            ctx.textAlign = 'start';
            ctx.textBaseline = 'middle';
            ctx.fillText(stroke.label, x, y);
            ctx.textBaseline = 'alphabetic';
        }
    }

    /**
     * Рисует линейку — пунктирную линию между двумя точками
     * с кружками на концах и подписью расстояния посередине.
     */
    function drawRuler(ctx, view, mapSize, stroke, STR) {
        const a = stroke.points[0];
        const b = stroke.points[stroke.points.length - 1];
        const sa = utils.worldToScreen(utils.percentToMeters(a.x, mapSize), utils.percentToMeters(a.y, mapSize), view);
        const sb = utils.worldToScreen(utils.percentToMeters(b.x, mapSize), utils.percentToMeters(b.y, mapSize), view);
        const color = stroke.color || '#fff';

        /** Пунктирная линия */
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, stroke.width || 1);
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(sa.x, sa.y);
        ctx.lineTo(sb.x, sb.y);
        ctx.stroke();
        ctx.setLineDash([]);

        /** Кружки на концах */
        ctx.fillStyle = color;
        [sa, sb].forEach(s => {
            ctx.beginPath(); ctx.arc(s.x, s.y, 2.5, 0, Math.PI * 2); ctx.fill();
        });

        /** Подпись расстояния посередине линии */
        if (STR) {
            const d = Math.hypot(
                utils.percentToMeters(b.x, mapSize) - utils.percentToMeters(a.x, mapSize),
                utils.percentToMeters(b.y, mapSize) - utils.percentToMeters(a.y, mapSize)
            );
            const label = utils.fmtDist(d, STR);
            const mx = (sa.x + sb.x) / 2;
            const my = Math.min(sa.y, sb.y) - 10;
            ctx.font = '11px monospace';
            const tw = ctx.measureText(label).width;
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(mx - tw / 2 - 4, my - 12, tw + 8, 15);
            ctx.fillStyle = color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, mx, my - 4);
            ctx.textAlign = 'start';
            ctx.textBaseline = 'alphabetic';
        }
    }

    /**
     * Рисует свободное рисование (карандаш) — ломаную линию по массиву точек.
     * @param {boolean} isPreview — true для текущего (незавершённого) штриха
     */
    function drawPen(ctx, view, mapSize, stroke, isPreview) {
        ctx.beginPath();
        const first = stroke.points[0];
        const s0 = utils.worldToScreen(utils.percentToMeters(first.x, mapSize), utils.percentToMeters(first.y, mapSize), view);
        ctx.moveTo(s0.x, s0.y);
        for (let i = 1; i < stroke.points.length; i++) {
            const pt = stroke.points[i];
            const s = utils.worldToScreen(utils.percentToMeters(pt.x, mapSize), utils.percentToMeters(pt.y, mapSize), view);
            ctx.lineTo(s.x, s.y);
        }
        ctx.strokeStyle = stroke.color || '#fff';
        ctx.lineWidth = Math.max(1, stroke.width || 1);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (isPreview) ctx.setLineDash([3, 3]); /** Пунктир для предпросмотра */
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineCap = 'butt';
        ctx.lineJoin = 'miter';
    }

    /**
     * Отрисовывает один штрих (маркер/линию/карандаш) по типу.
     */
    function drawSingleStroke(ctx, view, mapSize, stroke, isPreview, STR) {
        if (!stroke.points || stroke.points.length === 0) return;
        if (stroke.tool === 'marker') {
            const p = stroke.points[0];
            const s = utils.worldToScreen(utils.percentToMeters(p.x, mapSize), utils.percentToMeters(p.y, mapSize), view);
            drawMarker(ctx, s, stroke);
            return;
        }
        if (stroke.tool === 'line') {
            if (stroke.points.length >= 2) drawRuler(ctx, view, mapSize, stroke, STR);
            return;
        }
        drawPen(ctx, view, mapSize, stroke, isPreview);
    }

    /**
     * Отрисовывает все рисунки: удалённые (из лобби или локальные)
     * + текущий незавершённый штрих (preview).
     */
    function drawDrawings(ctx, view, mapSize, STR) {
        const local = window.AppDraw ? window.AppDraw.getLocalDrawings() : [];

        local.forEach(stroke => {
            drawSingleStroke(ctx, view, mapSize, stroke, false, STR);
        });

        /** Рисуем текущий незавершённый штрих (пунктиром) */
        const current = window.AppDraw ? window.AppDraw.getCurrentStroke() : null;
        if (current) drawSingleStroke(ctx, view, mapSize, current, true, STR);
    }

    /**
     * Рисует мелкую сетку (minor grid).
     * Рисуется только если расстояние между линиями ≥ 4 px.
     */
    function drawMinorGrid(ctx, view, c, w, h, mapSize) {
        const steps = getGridSteps(view.scale);
        const minor = steps.minor;
        if (minor * view.scale < 4) return; /** Слишком мелко — пропускаем */
        const vb = getViewBox(view, w, h, mapSize);

        /** Границы карты на экране для clip */
        const m0 = utils.worldToScreen(0, 0, view);
        const m1 = utils.worldToScreen(mapSize, mapSize, view);

        /** Clip: рисуем сетку только внутри карты */
        ctx.save();
        ctx.beginPath();
        ctx.rect(m0.x, m1.y, m1.x - m0.x, m0.y - m1.y);
        ctx.clip();

        const startX = Math.floor(vb.left / minor) * minor;
        const endX = Math.ceil(vb.right / minor) * minor;
        const startY = Math.floor(vb.top / minor) * minor;
        const endY = Math.ceil(vb.bottom / minor) * minor;

        ctx.strokeStyle = c.gridMinor;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        for (let x = startX; x <= endX; x += minor) {
            const sx = utils.worldToScreen(x, 0, view).x;
            ctx.moveTo(Math.round(sx) + .5, 0);
            ctx.lineTo(Math.round(sx) + .5, h);
        }
        for (let y = startY; y <= endY; y += minor) {
            const sy = utils.worldToScreen(0, y, view).y;
            ctx.moveTo(0, Math.round(sy) + .5);
            ctx.lineTo(w, Math.round(sy) + .5);
        }
        ctx.stroke();
        ctx.restore();
    }

    /**
     * Рисует крупную сетку (major grid) с подписями координат.
     */
    function drawGrid(ctx, view, c, w, h, mapSize, STR) {
        const steps = getGridSteps(view.scale);
        const step = steps.major;
        const vb = getViewBox(view, w, h, mapSize);

        /** Границы карты на экране */
        const m0 = utils.worldToScreen(0, 0, view);
        const m1 = utils.worldToScreen(mapSize, mapSize, view);
        const mapL = m0.x, mapR = m1.x;
        const mapT = m1.y, mapB = m0.y;

        const startX = Math.floor(vb.left / step) * step;
        const endX = Math.ceil(vb.right / step) * step;
        const startY = Math.floor(vb.top / step) * step;
        const endY = Math.ceil(vb.bottom / step) * step;

        /** Clip: рисуем линии сетки только внутри карты */
        ctx.save();
        ctx.beginPath();
        ctx.rect(mapL, mapT, mapR - mapL, mapB - mapT);
        ctx.clip();

        /** Линии сетки — контуры крупных ячеек (чуть толще) */
        ctx.strokeStyle = c.gridMajor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let x = startX; x <= endX; x += step) {
            const sx = utils.worldToScreen(x, 0, view).x;
            ctx.moveTo(Math.round(sx) + .5, 0);
            ctx.lineTo(Math.round(sx) + .5, h);
        }
        for (let y = startY; y <= endY; y += step) {
            const sy = utils.worldToScreen(0, y, view).y;
            ctx.moveTo(0, Math.round(sy) + .5);
            ctx.lineTo(w, Math.round(sy) + .5);
        }
        ctx.stroke();
        ctx.restore();

        /** Подписи координат — снаружи карты (в тёмной области) */
        ctx.font = '10px monospace';

        /** X-подписи: под картой */
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (let x = startX; x <= endX; x += step) {
            const sx = utils.worldToScreen(x, 0, view).x;
            if (sx < mapL - 1 || sx > mapR + 1) continue;
            const label = utils.fmtCoord(x, step, STR);
            const ly = mapB + 5;
            const tw = ctx.measureText(label).width;
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            ctx.fillRect(sx - tw / 2 - 3, ly - 1, tw + 6, 13);
            ctx.fillStyle = c.labels;
            ctx.fillText(label, sx, ly);
        }

        /** Y-подписи: слева от карты */
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let y = startY; y <= endY; y += step) {
            const sy = utils.worldToScreen(0, y, view).y;
            if (sy < mapT - 1 || sy > mapB + 1) continue;
            const label = utils.fmtCoord(y, step, STR);
            const lx = mapL - 6;
            const tw = ctx.measureText(label).width;
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            ctx.fillRect(lx - tw - 5, sy - 7, tw + 7, 14);
            ctx.fillStyle = c.labels;
            ctx.fillText(label, lx, sy);
        }

        /** Сброс align/baseline */
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
    }

    // ═══════════════════════════════════════════════════════════
    //  Главная функция отрисовки
    // ═══════════════════════════════════════════════════════════

    /**
     * Главная функция отрисовки всей карты.
     * Вызывается при каждом обновлении (перемещение, зум, изменение точек).
     *
     * @param {CanvasRenderingContext2D} ctx — контекст canvas
     * @param {HTMLCanvasElement} canvas — элемент canvas
     * @param {object} opts — все данные для отрисовки:
     *   view, MAP, ZONE, TOWERS, WEAPONS, currentWeapon,
     *   pointA, pointB, theme, showTowers, selectedTower,
     *   STR, towerIcon, TILES, onTileLoaded
     */
    function draw(ctx, canvas, opts) {
        const { view, MAP, ZONE, TOWERS, WEAPONS, currentWeapon,
            pointA, pointB, theme, showTowers, selectedTower,
            STR, towerIcon, TILES, onTileLoaded } = opts;

        const c = getThemeColors(theme);
        const w = canvas.clientWidth, h = canvas.clientHeight;

        /** Слой 1: Фон за пределами карты */
        ctx.fillStyle = c.bg;
        ctx.fillRect(0, 0, w, h);

        /** Слой 2: Область карты (прямоугольник) */
        const m0 = utils.worldToScreen(0, 0, view);
        const m1 = utils.worldToScreen(MAP.size, MAP.size, view);
        ctx.fillStyle = c.mapBg;
        ctx.fillRect(m0.x, m1.y, m1.x - m0.x, m0.y - m1.y);

        /** Слой 3: Тайловая подложка */
        tiles.drawTiles(ctx, canvas, view, MAP, TILES, c, onTileLoaded);

        /** Слой 3.5: Затемнение тайлов (только для ozeti) */
        if (TILES.mapId === 'ozeti') {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(m0.x, m1.y, m1.x - m0.x, m0.y - m1.y);
        }

        /** Слой 4: Сетка (мелкая + крупная с подписями) */
        drawMinorGrid(ctx, view, c, w, h, MAP.size);
        drawGrid(ctx, view, c, w, h, MAP.size, STR);

        /** Слой 5: Оси координат (пересечение 0,0) */
        ctx.strokeStyle = c.axes;
        ctx.beginPath();
        const zero = utils.worldToScreen(0, 0, view);
        ctx.moveTo(zero.x + .5, 0); ctx.lineTo(zero.x + .5, h);
        ctx.moveTo(0, zero.y + .5); ctx.lineTo(w, zero.y + .5);
        ctx.stroke();

        /** Слой 6: Затемнение за пределами карты (4 прямоугольника) */
        ctx.fillStyle = c.dim;
        ctx.fillRect(0, 0, w, m1.y);             /** Сверху */
        ctx.fillRect(0, m0.y, w, h - m0.y);      /** Снизу */
        ctx.fillRect(0, m1.y, m0.x, m0.y - m1.y); /** Слева */
        ctx.fillRect(m1.x, m1.y, w - m1.x, m0.y - m1.y); /** Справа */

        /** Слой 7: Граница карты */
        ctx.strokeStyle = c.border;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(m0.x, m1.y, m1.x - m0.x, m0.y - m1.y);
        ctx.lineWidth = 1;

        /** Слой 8: Боевая зона (круг) — если задана и радиус > 0 */
        if (ZONE && ZONE.r > 0) {
            const zc = utils.worldToScreen(ZONE.cx, ZONE.cy, view);
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
        }

        /** Слой 9: Вышки (если включены в настройках) */
        if (showTowers) TOWERS.forEach(p => drawTower(ctx, view, p, towerIcon, selectedTower, STR, MAP.size, c));

        /** Слой 10: Рисунки пользователя */
        drawDrawings(ctx, view, MAP.size, STR);

        /** Слой 11: Линия A→B с подписью расстояния (пунктир) */
        if (pointA && pointB) {
            const sa = utils.worldToScreen(pointA.x, pointA.y, view);
            const sb = utils.worldToScreen(pointB.x, pointB.y, view);
            ctx.strokeStyle = c.line;
            ctx.lineWidth = 1;
            ctx.lineCap = 'butt';
            ctx.setLineDash([6, 6]);
            ctx.beginPath(); ctx.moveTo(sa.x, sa.y); ctx.lineTo(sb.x, sb.y); ctx.stroke();
            ctx.setLineDash([]);

            /** Подпись расстояния рядом с линией */
            const d = Math.hypot(pointB.x - pointA.x, pointB.y - pointA.y);
            ctx.fillStyle = c.line;
            ctx.font = '12px monospace';
            ctx.fillText(utils.fmtDist(d, STR), (sa.x + sb.x) / 2 + 8, (sa.y + sb.y) / 2 - 8);
        }

        /** Слой 12: Круг дальности текущего оружия */
        drawRangeCircle(ctx, view, pointA, WEAPONS[currentWeapon], STR);

        /** Слой 13: Точки A (зелёная) и B (красная) */
        if (pointA) drawPoint(ctx, view, pointA, '#7bc95e', 'A');
        if (pointB) drawPoint(ctx, view, pointB, '#e05656', 'B');
    }

    return { getTowerIconSize, draw };
})(window.AppUtils, window.MapTiles);

/**
 *
 * Центральный обработчик всех pointer/touch/wheel событий на canvas.
 * Управляет следующими режимами:
 *
 * Режимы dragging:
 *   pan           — перемещение карты (ЛКМ/СКМ drag)
 *   point         — перетаскивание точки A/B
 *   tower-or-pan  — начальный клик по вышке (может стать pan или tap)
 *   draw          — рисование (pen/line/marker)
 *   erase         — ластик (удаление рисунков)
 *
 * Pinch-to-zoom:
 *   Двумя пальцами можно масштабировать карту.
 *   Масштабируемся относительно центра между пальцами.
 *
 * Зависимости: AppDraw, AppUtils
 * Экспорт: window.MapInteractions
 */

window.MapInteractions = (function () {

    /** Ограничения масштаба */
    const MIN_SCALE = 0.005;  /** Минимальный зум (очень далеко) */
    const MAX_SCALE = 4;      /** Максимальный зум (очень близко) */

    /** Map активных pointer-событий (для multi-touch) */
    let pointers = new Map();

    /** Состояние pinch-to-zoom (null = неактивно) */
    let pinch = null;

    /** Таймер долгого нажатия для контекстного меню */
    let longPressTimer = null;

    /** Флаг: сработало ли долгое нажатие (чтобы не обрабатывать как tap) */
    let longPressFired = false;

    /** Timestamp последнего touch-события (для различия touch vs mouse contextmenu) */
    let lastTouchTs = 0;

    /** Текущий режим перетаскивания (dragging state) */
    let dragging = null;

    // ═══════════════════════════════════════════════════════════
    //  Кеш DOM-элементов (hot path optimization)
    //  Не делаем getElementById/createElement в pointermove!
    // ═══════════════════════════════════════════════════════════

    /** Tooltip координат под курсором — создаётся один раз */
    let _cursorCoords = null;

    /** Спаны x/y внутри tooltip — создаются один раз, обновляется textContent */
    let _cxSpan = null;
    let _cySpan = null;

    /** Кеш rect'а map-wrap — обновляется при resize, не при каждом pointermove */
    let _wrapRect = null;

    /** Кеш rect'а canvas — обновляется при resize, не при каждом pointermove (hot path) */
    let _canvasRect = null;

    /**
     * Инициализирует кеш DOM-элементов.
     * Вызывается один раз из init или при первом pointermove.
     */
    function ensureTooltipCache() {
        if (_cursorCoords) return;
        _cursorCoords = document.getElementById('cursorCoords');
        if (!_cursorCoords) return;
        _cxSpan = document.createElement('span');
        _cySpan = document.createElement('span');
        _cursorCoords.appendChild(_cxSpan);
        _cursorCoords.appendChild(_cySpan);
    }

    /**
     * Обновляет кеш rect'а map-wrap.
     * Вызывается при resize (через resize observer илиручной инвалидации).
     */
    function invalidateWrapRect() { _wrapRect = null; invalidateCanvasRect(); }

    /** Возвращает кешированный rect map-wrap (без reflow на каждом move) */
    function getWrapRect(canvas) {
        if (!_wrapRect) _wrapRect = canvas.parentElement.getBoundingClientRect();
        return _wrapRect;
    }

    /**
     * Инвалидирует кеш rect'а canvas.
     * Вызывается при resize и blur — при следующем pointermove rect будет запрошен заново.
     */
    function invalidateCanvasRect() { _canvasRect = null; }

    /**
     * Конвертирует координаты pointer-события в координаты canvas.
     * Использует кеш _canvasRect чтобы избежать reflow 60×/сек при pan/draw.
     * @param {PointerEvent} e — событие указателя
     * @param {HTMLCanvasElement} canvas
     * @returns {{x: number, y: number}} координаты внутри canvas
     */
    function canvasPos(e, canvas) {
        if (!_canvasRect) _canvasRect = canvas.getBoundingClientRect();
        const r = _canvasRect;
        return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    /** Останавливает таймер долгого нажатия */
    function stopLongPress() { clearTimeout(longPressTimer); }

    /**
     * Запускает таймер долгого нажатия.
     * По истечении delay вызывает callback и устанавливает longPressFired.
     *
     * @param {number} sx — экраниая X
     * @param {number} sy — экраниая Y
     * @param {number} delay — задержка в мс
     * @param {Function} callback — функция при долгом нажатии
     */
    function startLongPress(sx, sy, delay, callback) {
        clearTimeout(longPressTimer);
        longPressFired = false;
        longPressTimer = setTimeout(() => {
            longPressFired = true;
            dragging = null;
            callback(sx, sy);
        }, delay);
    }

    // ═══════════════════════════════════════════════════════════
    //  Обработчики событий
    // ═══════════════════════════════════════════════════════════

    /**
     * Обрабатывает нажатие указателя (mouse/touch/pen).
     *
     * Определяет режим:
     * - СКМ → pan
     * - Два пальца → pinch-to-zoom
     * - Long press (touch) → контекстное меню
     * - Клик по точке A/B → перетаскивание точки
     * - Клик по вышке → tower-or-pan (сначала ждём движение)
     * - Режим eraser → удаление рисунков
     * - Режим draw → начало рисования
     * - По умолчанию → pan
     */
    function handlePointerDown(e, canvas, opts) {
        const { view, hitPoint, findTowerAt, openMenuAt, hideMenu, LONG_PRESS_MS, utils, mapSize, renderMap, scheduleRender } = opts;
        const p = canvasPos(e, canvas);

        /** Фиксируем время touch для различия с contextmenu */
        if (e.pointerType !== 'mouse') lastTouchTs = performance.now();

        /** Захватываем pointer (для получения move/up событий) */
        try { canvas.setPointerCapture(e.pointerId); } catch (_) { }
        pointers.set(e.pointerId, p);

        /** СКМ (button === 1) → pan */
        if (e.button === 1) {
            e.preventDefault();
            stopLongPress();
            /** Cancel any active drawing stroke */
            if (window.AppDraw) window.AppDraw.cancelStroke();
            dragging = { mode: 'pan', startX: p.x, startY: p.y, ox: view.ox, oy: view.oy };
            canvas.style.cursor = 'grabbing';
            return;
        }

        /** Только ЛКМ (button === 0) для остальных действий */
        if (e.button !== 0) return;

        /** Скрываем контекстное меню при любом клике */
        if (typeof hideMenu === 'function') hideMenu();

        /** Два пальца → начало pinch-to-zoom */
        if (pointers.size === 2) {
            stopLongPress();
            dragging = null;
            /** Извлекаем два pointer'а без spread — итератор не аллоцирует массив */
            const _it = pointers.values();
            const p1 = _it.next().value;
            const p2 = _it.next().value;
            const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            pinch = {
                dist: Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1, /** Расстояние между пальцами */
                scale: view.scale,      /** Масштаб до pinch */
                anchor: utils.screenToWorld(mid.x, mid.y, view), /** Точка-якорь (мировые коорд.) */
            };
            return;
        }

        if (pointers.size > 2) return;

        /** Touch: запускаем таймер долгого нажатия для контекстного меню */
        if (e.pointerType !== 'mouse') {
            startLongPress(p.x, p.y, LONG_PRESS_MS, (sx, sy) => {
                openMenuAt(sx, sy);
            });
        }

        /** Попадание на точку A/B → режим перетаскивания точки */
        const hit = hitPoint(p.x, p.y);
        if (hit) {
            stopLongPress();
            dragging = { mode: 'point', key: hit };
            canvas.style.cursor = 'grabbing';
            return;
        }

        /** Попадание на вышку → tower-or-pan (определим при движении) */
        const towerHit = findTowerAt(p.x, p.y);
        if (towerHit) {
            dragging = { mode: 'tower-or-pan', tower: towerHit, startX: p.x, startY: p.y, ox: view.ox, oy: view.oy };
            return;
        }

        /** Ластик → режим erase (удаление по клику + движению) */
        const drawTool = window.AppDraw ? window.AppDraw.getTool() : 'pan';
        if (drawTool === 'eraser') {
            stopLongPress();
            dragging = { mode: 'erase' };
            if (window.AppDraw.eraseAt(p.x, p.y, view) && renderMap) renderMap();
            canvas.style.cursor = 'cell';
            return;
        }

        /** Инструмент рисования → начало штриха */
        if (drawTool !== 'pan') {
            stopLongPress();
            const wpt = utils.screenToWorld(p.x, p.y, view);
            const px = utils.metersToPercent(wpt.x, mapSize);
            const py = utils.metersToPercent(wpt.y, mapSize);
            window.AppDraw.startStroke(px, py);
            dragging = { mode: 'draw' };
            if (renderMap) renderMap();
            canvas.style.cursor = 'crosshair';
            return;
        }

        /** По умолчанию → pan (перемещение карты) */
        dragging = { mode: 'pan', startX: p.x, startY: p.y, ox: view.ox, oy: view.oy };
        canvas.style.cursor = 'grabbing';
    }

    /**
     * Обрабатывает движение указателя.
     *
     * Pinch-to-zoom: масштабирует камеру относительно центра между пальцами.
     * Pan: перемещает карту.
     * Point: двигает точку A/B (с привязкой к сетке 0.01%).
     * Draw/erase: продолжает рисование/стирание.
     * Cursor coords: обновляет tooltip координат под курсором.
     */
    function handlePointerMove(e, canvas, opts) {
        const { view, renderMap, scheduleRender, debouncedSaveView, hitPoint, findTowerAt, setPoint, utils, TAP_THRESHOLD, mapSize } = opts;
        const p = canvasPos(e, canvas);
        const tracked = pointers.has(e.pointerId);

        if (tracked) {
            pointers.set(e.pointerId, p);
            if (e.pointerType !== 'mouse') lastTouchTs = performance.now();
        }

        /** Pinch-to-zoom: вычисляем новый масштаб и смещение */
        if (pinch && pointers.size >= 2) {
            /** Извлекаем два pointer'а без spread — итератор не аллоцирует массив */
            const _it = pointers.values();
            const p1 = _it.next().value;
            const p2 = _it.next().value;
            const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1;
            const newScale = utils.clamp(pinch.scale * dist / pinch.dist, MIN_SCALE, MAX_SCALE);
            view.scale = newScale;
            /** Масштабируем относительно якоря (anchor) — точка под курсором не сдвигается */
            view.ox = mid.x - pinch.anchor.x * newScale;
            view.oy = mid.y + pinch.anchor.y * newScale;
            scheduleRender();
            debouncedSaveView();
            return;
        }

        /** Обновляем tooltip координат под курсором (без DOM-запросов!) */
        ensureTooltipCache();
        if (_cursorCoords) {
            const wpt = utils.screenToWorld(p.x, p.y, view);
            /** Обновляем textContent — не пересоздаём элементы */
            _cxSpan.textContent = `x${utils.gameCoord(wpt.x)}`;
            _cySpan.textContent = `y${utils.gameCoord(wpt.y)}`;

            /** Позиционирование tooltip (rect из кеша — без reflow) */
            const wrap = getWrapRect(canvas);
            let lx = p.x + 14;
            let ly = p.y + 18;
            if (lx + 80 > wrap.width) lx = p.x - 90;
            if (ly + 44 > wrap.height) ly = p.y - 50;
            _cursorCoords.style.transform = `translate(${lx}px, ${ly}px)`;
            _cursorCoords.classList.add('visible');
        }

        /** Ластик: стираем при движении */
        if (dragging && dragging.mode === 'erase') {
            stopLongPress();
            if (window.AppDraw.eraseAt(p.x, p.y, view)) scheduleRender();
            return;
        }

        /** Рисование: продолжаем штрих */
        if (dragging && dragging.mode === 'draw') {
            stopLongPress();
            const wpt = utils.screenToWorld(p.x, p.y, view);
            const px = utils.metersToPercent(wpt.x, mapSize);
            const py = utils.metersToPercent(wpt.y, mapSize);
            window.AppDraw.continueStroke(px, py);
            scheduleRender();
            return;
        }

        /** Если pointer не отслеживается — только обновляем курсор */
        if (!tracked) {
            if (e.pointerType === 'mouse' && !dragging) {
                const overPoint = hitPoint(p.x, p.y);
                const overTower = !overPoint && findTowerAt(p.x, p.y);
                if (overPoint) {
                    canvas.style.cursor = 'grab';
                } else if (overTower) {
                    canvas.style.cursor = 'pointer';
                } else {
                    const tool = window.AppDraw ? window.AppDraw.getTool() : 'pan';
                    canvas.style.cursor = tool === 'eraser' ? 'cell' : (tool === 'pan' ? 'grab' : 'crosshair');
                }
            }
            return;
        }

        if (!dragging) return;

        /** tower-or-pan: если движение > TAP_THRESHOLD → переключаем на pan */
        if (dragging.mode === 'tower-or-pan') {
            const moved = Math.hypot(p.x - dragging.startX, p.y - dragging.startY) > TAP_THRESHOLD;
            if (!moved) return;
            stopLongPress();
            dragging = { mode: 'pan', startX: dragging.startX, startY: dragging.startY, ox: dragging.ox, oy: dragging.oy };
            canvas.style.cursor = 'grabbing';
        }

        /** Pan: перемещение карты */
        if (dragging.mode === 'pan') {
            stopLongPress();
            view.ox = dragging.ox + (p.x - dragging.startX);
            view.oy = dragging.oy + (p.y - dragging.startY);
            scheduleRender();
            debouncedSaveView();
        }

        /** Point: перемещение точки A/B (с привязкой к сетке 0.01%) */
        else if (dragging.mode === 'point') {
            stopLongPress();
            const wpt = utils.screenToWorld(p.x, p.y, view);
            /** Округляем до 0.01% для привязки к сетке */
            const px = utils.clamp(Math.round(utils.metersToPercent(wpt.x, mapSize) * 100) / 100, 0, 100);
            const py = utils.clamp(Math.round(utils.metersToPercent(wpt.y, mapSize) * 100) / 100, 0, 100);
            setPoint(dragging.key, utils.percentToMeters(px, mapSize), utils.percentToMeters(py, mapSize));
        }
    }

    /**
     * Обрабатывает отпускание указателя.
     *
     * Завершает:
     * - Pinch → плавный переход в pan (если остался 1 палец)
     * - Draw → сохранение штриха
     * - Tower-or-pan → toggle выделения вышки (если не было движения)
     */
    function handlePointerUp(e, canvas, opts) {
        const { view, renderMap, scheduleRender, findTowerAt, selectedTower, setSelectedTower } = opts;

        if (!pointers.has(e.pointerId)) return;
        pointers.delete(e.pointerId);
        try { canvas.releasePointerCapture(e.pointerId); } catch (_) { }
        stopLongPress();

        /** Скрываем tooltip координат при отпускании указателя */
        const cc = getCursorCoordsEl();
        if (cc) cc.classList.remove('visible');

        /** Завершение pinch-to-zoom */
        if (pinch) {
            if (pointers.size >= 2) return; /** Ещё есть 2+ пальца */
            pinch = null;
            /** Если остался 1 палец — переходим в pan */
            if (pointers.size === 1) {
                /** Извлекаем единственный pointer без spread — итератор не аллоцирует массив */
                const rest = pointers.values().next().value;
                dragging = { mode: 'pan', startX: rest.x, startY: rest.y, ox: view.ox, oy: view.oy };
            } else {
                dragging = null;
            }
            return;
        }

        /** Завершение ластика */
        if (dragging && dragging.mode === 'erase') {
            dragging = null;
            canvas.style.cursor = 'cell';
            return;
        }

        /** Завершение рисования — сохраняем штрих */
        if (dragging && dragging.mode === 'draw') {
            window.AppDraw.finishStroke();
            dragging = null;
            renderMap();
            const tool = window.AppDraw ? window.AppDraw.getTool() : 'pan';
            canvas.style.cursor = tool === 'eraser' ? 'cell' : (tool === 'pan' ? 'grab' : 'crosshair');
            return;
        }

        /** Tower-or-pan без движения → toggle выделения вышки */
        if (dragging && dragging.mode === 'tower-or-pan' && !longPressFired && e.button === 0) {
            const p = canvasPos(e, canvas);
            if (findTowerAt(p.x, p.y) === dragging.tower) {
                setSelectedTower((selectedTower === dragging.tower) ? null : dragging.tower);
                renderMap();
            }
        }
        longPressFired = false;

        /** Все указатели отпущены → сброс состояния */
        if (pointers.size === 0) {
            dragging = null;
            const tool = window.AppDraw ? window.AppDraw.getTool() : 'pan';
            canvas.style.cursor = tool === 'eraser' ? 'cell' : (tool === 'pan' ? 'grab' : 'crosshair');
        }
    }

    /**
     * Обрабатывает потерю фокуса окном (blur).
     * Сбрасывает все состояния: pointers, pinch, dragging, рисование.
     */
    function handleBlur(canvas) {
        pointers.clear();
        pinch = null;
        dragging = null;
        stopLongPress();
        longPressFired = false;
        invalidateCanvasRect();
        const tool = window.AppDraw ? window.AppDraw.getTool() : 'pan';
        canvas.style.cursor = tool === 'eraser' ? 'cell' : (tool === 'pan' ? 'grab' : 'crosshair');
        if (window.AppDraw) window.AppDraw.cancelStroke();
    }

    /**
     * Обрабатывает колёсико мыши (zoom).
     * Масштабирование относительно позиции курсора.
     * factor = e^(-deltaY × 0.0015) — экспоненциальное, плавное.
     */
    function handleWheel(e, canvas, opts) {
        const { view, renderMap, scheduleRender, debouncedSaveView, utils } = opts;
        e.preventDefault(); /** Предотвращаем скролл страницы */

        const p = canvasPos(e, canvas);
        const factor = Math.exp(-e.deltaY * 0.0015);
        const newScale = utils.clamp(view.scale * factor, MIN_SCALE, MAX_SCALE);

        /** Масштабируем относительно позиции курсора (используем canvasPos для консистентности) */
        const wpt = utils.screenToWorld(p.x, p.y, view);
        view.scale = newScale;
        view.ox = p.x - wpt.x * view.scale;
        view.oy = p.y + wpt.y * view.scale;

        scheduleRender();
        debouncedSaveView();
    }

    /**
     * Обрабатывает контекстное меню (ПКМ).
     * Предотвращает стандартное браузерное меню и открывает своё.
     * Игнорирует если недавно был touch (longPress уже открыл меню).
     */
    function handleContextMenu(e, canvas, opts) {
        const { openMenuAt } = opts;
        e.preventDefault();

        /** Игнорируем ПКМ сразу после touch (longPress уже обработал) */
        const fromTouch = performance.now() - lastTouchTs < 1000;
        if (fromTouch && longPressFired) return;

        stopLongPress();
        const p = canvasPos(e, canvas);
        openMenuAt(p.x, p.y);
    }

    /** Возвращает кешированный DOM-элемент tooltip координат (для pointerleave) */
    function getCursorCoordsEl() {
        ensureTooltipCache();
        return _cursorCoords;
    }

    return {
        handlePointerDown, handlePointerMove, handlePointerUp,
        handleBlur, handleWheel, handleContextMenu,
        invalidateWrapRect, invalidateCanvasRect, getCursorCoordsEl
    };
})();

/**
 *
 * Отвечает за:
 * - Хранение параметров камеры (scale, offsetX, offsetY)
 * - Сброс вида в центр карты
 * - Подгонку canvas под DPR (devicePixelRatio) при resize
 * - Debounced сохранение состояния камеры в localStorage
 *
 * Объект view = { scale, ox, oy }:
 *   scale — масштаб (пикселей на метр)
 *   ox, oy — экранные координаты мировой точки (0,0)
 *
 * Экспорт: window.MapViewport
 */

window.MapViewport = (function () {

    /** Параметры камеры: scale и смещение экрана */
    const view = { scale: 0.05, ox: 0, oy: 0 };

    /** Ссылки на DOM/canvas и колбэки (задаются в init) */
    let canvas = null, renderMap = null, saveState = null;

    /** Размер карты в метрах и таймер debounce */
    let mapSize = 16000, saveTimer = null;

    /** rAF id для debounce resize — предотвращает множественную перерисовку */
    let resizeRafId = 0;

    /**
     * Инициализирует модуль камеры.
     * Привязывает обработчик resize окна.
     *
     * @param {object} opts — параметры:
     *   canvas — HTMLCanvasElement
     *   renderMap — функция перерисовки карты
     *   saveState — функция сохранения состояния в localStorage
     *   mapSize — размер карты в метрах
     */
    function init(opts) {
        canvas = opts.canvas;
        renderMap = opts.renderMap;
        saveState = opts.saveState;
        mapSize = opts.mapSize;
        window.addEventListener('resize', resize);
    }

    /** Возвращает объект камеры (по ссылке). @returns {{scale: number, ox: number, oy: number}} */
    function get() { return view; }

    /**
     * Обрабатывает изменение размера окна.
     * Подгоняет canvas под devicePixelRatio для чёткой отрисовки на Retina.
     * Применяет масштабирование контекста для компенсации DPR.
     * Использует rAF: resize может вызываться 100+ раз/сек при ресайзе окна.
     */
    function resize() {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = canvas.clientWidth * dpr;   /** Физический размер canvas = CSS × DPR */
        canvas.height = canvas.clientHeight * dpr;
        /** Устанавливаем transform для масштабирования контекста (DPR-компенсация) */
        canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
        if (resizeRafId) cancelAnimationFrame(resizeRafId);
        resizeRafId = requestAnimationFrame(() => {
            resizeRafId = 0;
            renderMap();
        });
    }

    /**
     * Сбрасывает камеру: центрирует карту и подбирает масштаб.
     * Масштаб = min(w, h) / mapSize × 0.9 (90% заполнение экрана).
     */
    function resetView() {
        const w = canvas.clientWidth, h = canvas.clientHeight;
        view.scale = Math.min(w, h) / mapSize * 0.9;

        /**
         * ox, oy — смещение такое, чтобы центр карты (mapSize/2, mapSize/2)
         * оказался в центре экрана.
         */
        view.ox = w / 2 - (mapSize / 2) * view.scale;
        view.oy = h / 2 + (mapSize / 2) * view.scale;

        renderMap();
        debouncedSave();
    }

    /**
     * Debounced сохранение: откладывает saveState на 200 мс.
     * Предотвращает частую запись в localStorage при скролле/зуме.
     */
    function debouncedSave() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => { if (saveState) saveState(); }, 200);
    }

    /**
     * Восстанавливает камеру из сохранённого объекта view.
     * @param {object} v — {scale, ox, oy}
     */
    function restore(v) {
        if (v) { view.scale = v.scale; view.ox = v.ox; view.oy = v.oy; }
    }

    /**
     * Обновляет размер карты (при смене карты).
     * @param {number} size — новый размер карты в метрах
     */
    function setMapSize(size) {
        mapSize = size;
    }

    return { init, get, resize, resetView, debouncedSave, restore, setMapSize };
})();
