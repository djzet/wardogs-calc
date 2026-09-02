/**
 *
 * Содержит математические, координатные и форматирующие функции,
 * не имеющие побочных эффектов. Все зависимости отсутствуют.
 *
 * Экспортируется через window.AppUtils (IIFE-модуль).
 */

window.AppUtils = (function () {

    /** Unicode неразрывный пробел (U+00A0) — используется вместо обычного пробела в числах */
    const NBSP = '\u00A0';

    // ═══════════════════════════════════════════════════════════
    //  Математические утилиты
    // ═══════════════════════════════════════════════════════════

    /**
     * Ограничивает значение v в пределах [min, max] (clamp / saturate).
     * @param {number} v — исходное значение
     * @param {number} min — нижняя граница
     * @param {number} max — верхняя граница
     * @returns {number} значение, зажатое между min и max
     */
    function clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
    }

    // ═══════════════════════════════════════════════════════════
    //  Координатные преобразования
    // ═══════════════════════════════════════════════════════════

    /**
     * Переводит процентные координаты карты (0–100%) в метры.
     * Используется при конвертации из URL/localStorage в мировые координаты.
     *
     * @param {number} percent — координата в процентах (0–100)
     * @param {number} mapSize — размер карты в метрах (например, 16000)
     * @returns {number} координата в метрах
     */
    function percentToMeters(percent, mapSize) {
        return (percent * mapSize) / 100;
    }

    /**
     * Переводит метры в процентные координаты карты (0–100%).
     * Обратная функция к percentToMeters.
     *
     * @param {number} meters — координата в метрах
     * @param {number} mapSize — размер карты в метрах
     * @returns {number} координата в процентах (0–100)
     */
    function metersToPercent(meters, mapSize) {
        return (meters * 100) / mapSize;
    }

    /**
     * Конвертирует мировые координаты (метры) в экранные пиксели.
     * Ось Y инвертирована: положительные world Y → вверх на экране.
     *
     * Формула:
     *   screen.x = world.x × scale + offsetX
     *   screen.y = -world.y × scale + offsetY
     *
     * @param {number} wx — мировая X координата (метры)
     * @param {number} wy — мировая Y координата (метры)
     * @param {{scale: number, ox: number, oy: number}} view — объект камеры:
     *   scale — масштаб (px/м), ox/oy — смещение центра камеры
     * @returns {{x: number, y: number}} экранные координаты в пикселях
     */
    function worldToScreen(wx, wy, view) {
        return {
            x: wx * view.scale + view.ox,
            y: -wy * view.scale + view.oy
        };
    }

    /**
     * Конвертирует экранные пиксели обратно в мировые координаты (метры).
     * Обратная функция к worldToScreen.
     *
     * @param {number} sx — экранная X координата (пиксели)
     * @param {number} sy — экранная Y координата (пиксели)
     * @param {{scale: number, ox: number, oy: number}} view — объект камеры
     * @returns {{x: number, y: number}} мировые координаты в метрах
     */
    function screenToWorld(sx, sy, view) {
        return {
            x: (sx - view.ox) / view.scale,
            y: (view.oy - sy) / view.scale
        };
    }

    // ═══════════════════════════════════════════════════════════
    //  Форматирование вывода
    // ═══════════════════════════════════════════════════════════

    /**
     * Форматирует число, разделяя разряды неразрывными пробелами.
     * Пример: 12345 → "12 345" (с NBSP).
     * Используется для отображения расстояний и координат.
     *
     * @param {number} num — исходное число (округляется до целого)
     * @returns {string} отформатированная строка
     */
    function fmtWithNbsp(num) {
        const n = Math.round(num);
        const s = String(Math.abs(n));
        /** Regex: вставляет NBSP перед каждой группой из 3 цифр */
        const formatted = s.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
        return n < 0 ? '-' + formatted : formatted;
    }

    /**
     * Форматирует координату сетки с единицей измерения.
     * Если шаг сетки ≥ 1000 м — выводит в км, иначе — в м.
     *
     * @param {number} meters — значение координаты в метрах
     * @param {number} step — шаг сетки в метрах
     * @param {object} [str] — объект локализации с u_km / u_m
     * @returns {string} отформатированная строка, например "8.0 км" или "500 м"
     */
    function fmtCoord(meters, step, str) {
        if (step >= 1000) {
            const km = meters / 1000;
            const v = Number.isInteger(km) ? String(km) : km.toFixed(1);
            return v + NBSP + (str?.u_km || 'km');
        }
        return Math.round(meters) + NBSP + (str?.u_m || 'm');
    }

    /**
     * Форматирует расстояние в метрах с единицей измерения.
     * @param {number} d — расстояние в метрах
     * @param {object} [str] — объект локализации с u_m
     * @returns {string} отформатированная строка, например "1 234 м"
     */
    function fmtDist(d, str) {
        return fmtWithNbsp(d) + NBSP + (str?.u_m || 'm');
    }

    /**
     * Конвертирует метры в игровые координаты (деление на 100).
     * Формат: "XX.YY" — 2 знака после запятой.
     * Используется для отображения в полях ввода и tooltip.
     *
     * @param {number} meters — координата в метрах
     * @returns {string} строка с координатой, например "82.40"
     */
    function gameCoord(meters) {
        /** Обработка negative zero: (-0).toFixed(2) → "0.00", но на некоторых платформах может быть "-0.00" */
        const v = Object.is(meters, -0) ? 0 : meters;
        return (v / 100).toFixed(2);
    }

    /**
     * Формирует URL ресурса относительно базового пути приложения.
     * Учитывает import.meta.env.BASE_URL из Vite ("./" или "/wardogs-calc/").
     *
     * @param {string} path — относительный путь к ресурсу (например, "maps/bakurani/tiles/...")
     * @returns {string} полный путь для использования в src/href
     */
    function assetUrl(path) {
        const base = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || './';
        const rel = String(path).replace(/^\//, '');
        // './' + 'maps/...' → './maps/...' ; '/wardogs-calc/' + ... → абсолютный от корня сайта
        return base.endsWith('/') ? base + rel : base + '/' + rel;
    }

    return {
        NBSP,
        clamp,
        percentToMeters,
        metersToPercent,
        worldToScreen,
        screenToWorld,
        fmtWithNbsp,
        fmtCoord,
        fmtDist,
        gameCoord,
        assetUrl
    };
})();

/**
 *
 * Содержит чистую математику:
 * - Интерполяцию баллистической таблицы (mils ↔ расстояние)
 * - Расчёт параметров стрельбы между двумя точками
 *
 * Зависимости: window.AppUtils (IIFE-модуль).
 * Экспорт: window.AppCalculator
 */

window.AppCalculator = (function (utils) {

    /**
     * Интерполирует расстояние (метры) в углы возвышения (миллирадианы)
     * по баллистической таблице оружия.
     *
     * Таблица отсортирована по убыванию dist: чем дальше цель — тем меньше mils.
     * Используется линейная интерполяция между соседними узлами таблицы.
     *
     * Пример: таблица [{dist:700,mils:290}, {dist:650,mils:340}]
     *   distToMils(675) → 315 (середина между 290 и 340)
     *
     * @param {number} dist — расстояние до цели в метрах
     * @param {{dist: number, mils: number}[]} table — баллистическая таблица [{dist, mils}]
     * @returns {number|null} mils — угол возвышения, или null если расстояние вне таблицы
     */
    function distToMils(dist, table) {
        if (!table || table.length === 0) return null;

        /** Расстояние больше максимального — выходим за пределы таблицы */
        if (dist > table[0].dist) return null;

        /** Расстояние меньше минимального — выходим за пределы таблицы */
        if (dist < table[table.length - 1].dist) return null;

        /**
         * Бинарный поиск интервала [table[lo], table[hi]],
         * между которыми лежит dist.
         * Таблица отсортирована по убыванию dist,
         * поэтому lo — левая (большая) граница, hi — правая (меньшая).
         */
        let lo = 0;
        let hi = table.length - 1;

        while (lo < hi - 1) {
            const mid = (lo + hi) >> 1;
            if (dist >= table[mid].dist) {
                hi = mid;
            } else {
                lo = mid;
            }
        }

        /** Интерполяция между найденными узлами таблицы */
        const p1 = table[lo];
        const p2 = table[hi];
        const range = p1.dist - p2.dist;
        /** Параметр интерполяции t ∈ [0, 1] */
        const t = range > 0 ? (p1.dist - dist) / range : 0;
        return p1.mils + t * (p2.mils - p1.mils);
    }

    /**
     * Рассчитывает параметры стрельбы между двумя точками для указанного оружия.
     *
     * Алгоритм:
     * 1. Проверка: заданы ли обе точки
     * 2. Вычисление Euclidean расстояния и азимута
     * 3. Проверка на совпадение точек
     * 4. Проверка минимальной/максимальной дальности
     * 5. Интерполяция угла возвышения по баллистической таблице
     * 6. Округление угла до ближайшего шага сетки
     *
     * @param {{x: number, y: number}|null} pointA — позиция огня (метры)
     * @param {{x: number, y: number}|null} pointB — позиция цели (метры)
     * @param {object} weapon — объект оружия из CONFIG_WEAPONS
     * @returns {{status: string, dist?: number, azimuth?: number, mils?: number}}
     *   status: 'noPoints' | 'coincide' | 'tooClose' | 'outOfRange' | 'noSolution' | 'ok'
     */
    function calculate(pointA, pointB, weapon) {
        /** Одна или обе точки не заданы */
        if (!pointA || !pointB) {
            return { status: 'noPoints' };
        }

        /** Расчёт расстояния (Euclidean) и азимута */
        const dx = pointB.x - pointA.x;
        const dy = pointB.y - pointA.y;
        const dist = Math.hypot(dx, dy);

        /**
         * Азимут: atan2(dx, dy) даёт угол от оси Y (N) по часовой стрелке.
         * +360 % 360 — приведение к диапазону [0, 360).
         */
        const azimuth = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;

        /** Точки совпадают — расчёт невозможен */
        if (dist === 0) {
            return { status: 'coincide', dist, azimuth };
        }

        /** Проверка минимальной дальности */
        const minRange = (weapon.minRangeKm || 0) * 1000;
        if (dist < minRange) {
            return { status: 'tooClose', dist, azimuth };
        }

        /** Проверка максимальной дальности */
        const maxRange = (weapon.maxRangeKm || 0) * 1000;
        if (dist > maxRange) {
            return { status: 'outOfRange', dist, azimuth };
        }

        /** Интерполяция угла возвышения по баллистической таблице */
        const { table, step } = weapon;
        const milsExact = distToMils(dist, table);

        if (milsExact === null) {
            return { status: 'noSolution', dist, azimuth };
        }

        /**
         * Округление mils до ближайшего шага сетки (вниз).
         * Ограничение сверху maxElevationMil.
         */
        const mils = Math.min(weapon.maxElevationMil, Math.round(milsExact / step) * step);

        /** Проверка: полученный угол не меньше минимального */
        if (mils < weapon.minElevationMil) {
            return { status: 'noSolution', dist, azimuth };
        }

        return {
            status: 'ok',
            dist,
            azimuth,
            mils
        };
    }

    return { distToMils, calculate };
})(window.AppUtils);
