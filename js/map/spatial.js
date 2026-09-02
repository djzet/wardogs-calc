/**
 *
 * Пространственный индекс для быстрого поиска вышек на экране.
 *
 * Заменяет линейный перебор O(n) на хеш-сетку O(1) в среднем при hit-testing.
 * Экранные позиции вышек вычисляются один раз за кадр (rebuild) и
 * разделяются между рендерингом (drawTower) и поиском (findTowerAt).
 *
 * Предвычисляет мировые координаты вышек (метры) при смене карты,
 * чтобы не вызывать percentToMeters() на каждый вызов.
 *
 * Алгоритм:
 *   1. configure() — при смене карты: конвертирует % → метры для всех вышек
 *   2. rebuild()   — при каждом кадре: конвертирует метры → экран + строит сетку
 *   3. findTowerAt() — O(1): находит ячейку сетки, проверяет попадание
 *
 * Зависимости: window.AppUtils.percentToMeters
 *
 * Экспорт: window.MapSpatial
 */
window.MapSpatial = (function () {

    const { percentToMeters } = window.AppUtils;

    // ── Кэш мировых координат (метры) ─────────────────────
    /** @type {Array<{wx: number, wy: number, data: object}>} */
    let _world = [];

    // ── Кэш экранных координат ────────────────────────────
    /** @type {Array<{x: number, y: number}>} */
    let _screen = [];

    // ── Хеш-сетка ─────────────────────────────────────────
    /** @type {Map<number, number[]>} cellKey → [indices] */
    let _grid = new Map();

    /** Размер ячейки сетки (px), адаптируется к размеру иконки */
    let _cellSize = 64;

    // ── Кэш view (для пропуска пересчёта при стабильном камере) ──
    let _vScale = 0;
    let _vOx = 0;
    let _vOy = 0;

    // ──────────────────────────────────────────────────────
    //  Внутренние утилиты
    // ──────────────────────────────────────────────────────

    /**
     * Хеш-функция координат ячейки → одномерный ключ.
     * Безопасна для экранных координат (обычно -2000..5000).
     *
     * @param {number} cx — номер ячейки по X
     * @param {number} cy — номер ячейки по Y
     * @returns {number} уникальный ключ
     */
    function _cellKey(cx, cy) {
        return (cx << 16) | (cy & 0xFFFF);
    }

    // ──────────────────────────────────────────────────────
    //  Публичный API
    // ──────────────────────────────────────────────────────

    /**
     * Предвычисляет мировые координаты вышек (метры).
     * Вызывается при смене карты (switchMap) и при инициализации.
     *
     * @param {Array<{x: number, y: number, name: string}>} towers — вышки в %
     * @param {number} mapSize — размер карты в метрах
     */
    function configure(towers, mapSize) {
        _world = new Array(towers.length);
        _screen = [];
        for (let i = 0; i < towers.length; i++) {
            _world[i] = {
                wx: percentToMeters(towers[i].x, mapSize),
                wy: percentToMeters(towers[i].y, mapSize),
                data: towers[i]
            };
        }
        _grid.clear();
        /** Сброс кэша view → rebuild() гарантированно пересчитает */
        _vScale = 0;
        _vOx = 0;
        _vOy = 0;
    }

    /**
     * Пересчитывает экранные позиции вышек и перестраивает хеш-сетку.
     * Вызывается один раз за кадр (в renderMap или перед findTowerAt).
     *
     * Пропускает пересчёт, если камера не изменилась (оптимизация
     * для статичного просмотра: idle cursor moves без pan/zoom).
     *
     * @param {{scale: number, ox: number, oy: number}} view — камера
     * @param {number} halfSize — половина размера иконки вышки (px)
     */
    function rebuild(view, halfSize) {
        /** Пропуск: view не изменился с прошлого rebuild */
        if (view.scale === _vScale && view.ox === _vOx && view.oy === _vOy) return;

        _vScale = view.scale;
        _vOx = view.ox;
        _vOy = view.oy;

        const n = _world.length;
        const scale = view.scale;
        const ox = view.ox;
        const oy = view.oy;

        // ── 1. Конвертация метры → экран (один проход) ─────
        _screen = new Array(n);
        for (let i = 0; i < n; i++) {
            const t = _world[i];
            _screen[i] = {
                x: t.wx * scale + ox,
                y: -t.wy * scale + oy
            };
        }

        // ── 2. Построение хеш-сетки ───────────────────────
        _cellSize = Math.max(32, halfSize * 2);
        _grid.clear();

        for (let i = 0; i < n; i++) {
            const s = _screen[i];
            const minCX = Math.floor((s.x - halfSize) / _cellSize);
            const maxCX = Math.floor((s.x + halfSize) / _cellSize);
            const minCY = Math.floor((s.y - halfSize) / _cellSize);
            const maxCY = Math.floor((s.y + halfSize) / _cellSize);

            for (let cx = minCX; cx <= maxCX; cx++) {
                for (let cy = minCY; cy <= maxCY; cy++) {
                    const key = _cellKey(cx, cy);
                    let bucket = _grid.get(key);
                    if (!bucket) { bucket = []; _grid.set(key, bucket); }
                    bucket.push(i);
                }
            }
        }
    }

    /**
     * Быстрый поиск вышки по экранным координатам.
     * Среднее время O(1) для разреженных вышек (каждая в своей ячейке).
     *
     * @param {number} sx — экранная X (пиксели)
     * @param {number} sy — экранная Y (пиксели)
     * @param {number} halfSize — половина размера иконки (px)
     * @returns {object|null} объект вышки или null
     */
    function findTowerAt(sx, sy, halfSize) {
        const cx = Math.floor(sx / _cellSize);
        const cy = Math.floor(sy / _cellSize);
        const bucket = _grid.get(_cellKey(cx, cy));
        if (!bucket) return null;

        for (let j = 0; j < bucket.length; j++) {
            const s = _screen[bucket[j]];
            if (s && Math.abs(s.x - sx) <= halfSize && Math.abs(s.y - sy) <= halfSize) {
                return _world[bucket[j]].data;
            }
        }
        return null;
    }

    /**
     * Возвращает предвычисленную экранную позицию вышки.
     * Используется drawTower для устранения повторного worldToScreen.
     *
     * @param {number} index — индекс вышки в массиве TOWERS
     * @returns {{x: number, y: number}|null}
     */
    function getTowerScreenPos(index) {
        return _screen[index] || null;
    }

    return { configure, rebuild, findTowerAt, getTowerScreenPos };
})();
